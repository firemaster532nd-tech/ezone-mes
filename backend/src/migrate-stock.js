import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });


const { Client } = pg;
const uploadDir = 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\upload';
const filename = '차열재_재고관리_v10.xlsx';
const filePath = path.join(uploadDir, filename);

let connectionString = process.env.DATABASE_URL;
if (connectionString && connectionString.includes('@db:')) {
  connectionString = connectionString.replace('@db:', '@localhost:');
}


async function migrateStock() {
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return;
  }

  console.log('Connecting to database...');
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to Database successfully.');

  try {
    const workbook = XLSX.readFile(filePath);
    const indexSheet = workbook.Sheets['인덱스'];
    if (!indexSheet) {
      throw new Error('Sheet "인덱스" not found in Excel file');
    }

    const rows = XLSX.utils.sheet_to_json(indexSheet, { header: 1 });
    console.log(`Loaded '인덱스' sheet, total raw rows: ${rows.length}`);

    // 규격 데이터 파싱 시작 (Row 10부터 데이터)
    // 인덱스 시트 구조:
    // Row 9: ["No","제품군","규격코드","규격(통합ID)","단위","초기재고","총 입고","총 출고","현재고", ...]
    const itemsToMigrate = [];
    for (let i = 9; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0 || row[0] === '합계' || !row[2]) {
        continue;
      }
      
      const no = row[0];
      const categoryName = row[1]; // 예: 세라믹울 96K 국산
      const specCode = String(row[2]).trim(); // 예: 252007320
      const spec = String(row[3]).trim(); // 예: 96K국산 25T × 200W × 7320L
      const unit = String(row[4] || '매').trim();
      const initialStock = parseFloat(row[5] || 0);
      const totalIn = parseFloat(row[6] || 0);
      const totalOut = parseFloat(row[7] || 0);
      const currentStock = parseFloat(row[8] || 0);

      itemsToMigrate.push({
        specCode,
        spec,
        categoryName,
        unit,
        currentStock
      });
    }

    console.log(`Parsed ${itemsToMigrate.length} items to migrate.`);

    // 트랜잭션 시작
    await client.query('BEGIN');

    for (const item of itemsToMigrate) {
      console.log(`Migrating item: ${item.spec} (Code: ${item.specCode}, Stock: ${item.currentStock})`);

      // 1. 품목코드 생성 (기존 체계: SM-CW- + 규격코드 또는 스펙 기반 가공)
      const itemCode = `SM-CW-${item.specCode}`;
      
      // item_master에 등록여부 확인
      const checkRes = await client.query('SELECT item_id FROM item_master WHERE item_code = $1', [itemCode]);
      let itemId;

      if (checkRes.rows.length > 0) {
        itemId = checkRes.rows[0].item_id;
        console.log(`  -> Item code ${itemCode} already exists (ID: ${itemId}). Updating spec info.`);
        await client.query(
          `UPDATE item_master SET item_name = $1, spec = $2, item_category = 'SM', item_subcategory = '차열재' WHERE item_id = $3`,
          [item.spec, item.spec, itemId]
        );
      } else {
        // 새 품목 등록
        const insertRes = await client.query(
          `INSERT INTO item_master (item_code, item_name, item_category, item_subcategory, spec, unit, is_active)
           VALUES ($1, $2, 'SM', '차열재', $3, $4, TRUE) RETURNING item_id`,
          [itemCode, item.spec, item.spec, item.unit === '매' ? 'EA' : item.unit]
        );
        itemId = insertRes.rows[0].item_id;
        console.log(`  -> Registered NEW item code ${itemCode} (ID: ${itemId})`);
      }

      // 2. 초기 재고 및 LOT 정보 세팅 (현재고가 0보다 큰 경우에만 주입)
      if (item.currentStock > 0) {
        const lotNumber = `INIT-CW-${item.specCode}`;
        
        // 기존 동일 LOT가 있는지 체크
        const checkLot = await client.query('SELECT lot_id FROM lot_transaction WHERE lot_number = $1', [lotNumber]);
        let lotId;

        if (checkLot.rows.length > 0) {
          lotId = checkLot.rows[0].lot_id;
          console.log(`  -> LOT ${lotNumber} already exists (ID: ${lotId}). Updating qty.`);
          await client.query(
            `UPDATE lot_transaction SET qty = $1, remaining_qty = $2 WHERE lot_id = $3`,
            [item.currentStock, item.currentStock, lotId]
          );
        } else {
          // 새 LOT 등록
          const insertLot = await client.query(
            `INSERT INTO lot_transaction (lot_number, lot_type, item_id, qty, remaining_qty, status, unit)
             VALUES ($1, 'CW', $2, $3, $4, 'ACTIVE', $5) RETURNING lot_id`,
            [lotNumber, itemId, item.currentStock, item.currentStock, item.unit === '매' ? 'EA' : item.unit]
          );
          lotId = insertLot.rows[0].lot_id;
          console.log(`  -> Created LOT ${lotNumber} (ID: ${lotId})`);
        }

        // 수불대장(inventory_transaction)에 이관 기록 추가
        // 동일 날짜/LOT 입고이관 건이 있는지 체크
        const checkInv = await client.query(
          `SELECT inv_id FROM inventory_transaction WHERE item_id = $1 AND lot_id = $2 AND txn_type = 'IN'`,
          [itemId, lotId]
        );

        if (checkInv.rows.length > 0) {
          await client.query(
            `UPDATE inventory_transaction SET qty = $1 WHERE inv_id = $2`,
            [item.currentStock, checkInv.rows[0].inv_id]
          );
          console.log(`  -> Updated inventory txn quantity.`);
        } else {
          await client.query(
            `INSERT INTO inventory_transaction (item_id, lot_id, txn_type, txn_date, qty, purpose)
             VALUES ($1, $2, 'IN', CURRENT_DATE, $3, '차열재 엑셀 마이그레이션 이관 현재고')`,
            [itemId, lotId, item.currentStock]
          );
          console.log(`  -> Logged inventory transaction.`);
        }
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Stock Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during migration:', err);
  } finally {
    await client.end();
    console.log('Disconnected.');
  }
}

migrateStock();
