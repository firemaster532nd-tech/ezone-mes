import XLSX from 'xlsx';
import pg from 'pg';
const { Pool } = pg;
import path from 'path';
import fs from 'fs';

const file6 = 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\upload\\에프엔테크\\에프엔테크 입출고 관리(2606)-1.xlsx';
const file7 = 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\upload\\에프엔테크\\에프엔테크 입출고 관리(2607)-1.xlsx';

const pool = new Pool({
  connectionString: "postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
  ssl: { rejectUnauthorized: false }
});

// 품목 매핑 헬퍼 함수
async function getOrCreateItems(client) {
  // 50A 완제품이 없을 수 있으므로 동적 추가
  const check50A = await client.query("SELECT item_id FROM item_master WHERE item_code = 'FP-FN-50A'");
  let itemId50A;
  if (check50A.rows.length === 0) {
    const insertRes = await client.query(`
      INSERT INTO item_master (item_code, item_name, item_category, item_subcategory, spec, unit, is_active)
      VALUES ('FP-FN-50A', '발포소켓(50A)', 'FP', '발포소켓', '50A', 'EA', true)
      RETURNING item_id
    `);
    itemId50A = insertRes.rows[0].item_id;
    console.log(`[INIT] FP-FN-50A 품목 생성 완료 (item_id: ${itemId50A})`);
  } else {
    itemId50A = check50A.rows[0].item_id;
  }

  // 매핑 정보 빌드
  const mapping = {
    // 완제품
    '발포소켓 몸체(100)(210H)': 74,  // FP-FN-100A
    '100(210H)': 74,
    '발포소켓 몸체(75)': 75,         // FP-FN-75A
    '75': 75,
    '발포소켓 몸체(50)': itemId50A,  // FP-FN-50A
    '50': itemId50A,
    
    // 원부자재/반제품
    '발포소켓 몸체(100)-몸통': 14,    // SM-FN
    '100(몸통)': 14,
    '보호철판 / 100': 15,            // SM-SP
    '보호철판 / 75': 15,
    '보호철판 / 50': 15,
    '보호철판(100)': 15,
    '보호철판(75)': 15,
    '보호철판(50)': 15,
    '볼트,너트,와샤': 2301,          // SM-SCREW
    
    // 시트 반제품
    '시트(재단)100': 21,             // SA-CUT-SK
    '시트(재단)75': 21,
    '시트(재단)50': 21,
    '시트(압출)': 17,                // SA-EXT-5190
    '시트(압출) - 재단수량': 17,
  };

  return mapping;
}

// 가로형 날짜 데이터 파싱 헬퍼
function parseSheetData(filePath, sheetName, startRowIndex = 8) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.warn(`[WARN] 시트 없음: ${sheetName} in ${filePath}`);
    return [];
  }

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  const data = [];

  // 날짜 헤더 읽기 (Row 6)
  const days = []; // index -> day number
  for (let c = 2; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 6, c })];
    if (cell && cell.v) {
      const dayStr = String(cell.v).replace('일', '').trim();
      const day = parseInt(dayStr, 10);
      if (!isNaN(day)) {
        days[c] = day;
      }
    }
  }

  // 데이터 행 순회
  for (let r = startRowIndex; r <= range.e.r; r++) {
    const nameCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    if (!nameCell || !nameCell.v) continue;
    const name = String(nameCell.v).trim();
    if (name === '' || name.includes('계') || name.startsWith('합계')) continue;

    // 날짜별 수량 파싱
    for (let c = 2; c <= range.e.c; c++) {
      if (!days[c]) continue;
      const valCell = ws[XLSX.utils.encode_cell({ r, c })];
      const qty = valCell && valCell.v !== '' ? parseFloat(valCell.v) : 0;
      if (qty > 0) {
        data.push({
          name,
          day: days[c],
          qty
        });
      }
    }
  }

  return data;
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const itemMapping = await getOrCreateItems(client);

    // 1. 기존 데이터 정리 (중복 방지)
    // 2026-06-01 ~ 2026-07-31 기간의 에프엔테크 관련 품목들의 트랜잭션 삭제
    const fnItemIds = Array.from(new Set(Object.values(itemMapping)));
    console.log(`[CLEANUP] 6월~7월 기존 트랜잭션 정리 대상 품목 IDs: ${fnItemIds.join(', ')}`);
    
    const delTx = await client.query(`
      DELETE FROM inventory_transaction 
      WHERE item_id = ANY($1) 
        AND txn_date >= '2026-06-01'::date 
        AND txn_date <= '2026-07-31'::date
    `, [fnItemIds]);
    console.log(`[CLEANUP] 삭제된 inventory_transaction 수: ${delTx.rowCount}`);

    const delLots = await client.query(`
      DELETE FROM lot_transaction
      WHERE item_id = ANY($1)
        AND lot_number NOT LIKE 'INIT-%'
        AND created_at >= '2026-06-01T00:00:00Z'
        AND created_at <= '2026-07-31T23:59:59Z'
    `, [fnItemIds]);
    console.log(`[CLEANUP] 삭제된 lot_transaction 수: ${delLots.rowCount}`);

    // 로트 및 인벤토리 추가를 관리하기 위한 캐시/맵
    const createdLots = new Map(); // lot_number -> lot_id

    async function getOrCreateLot(lotNumber, item_id, lotType, dateStr) {
      if (createdLots.has(lotNumber)) {
        return createdLots.get(lotNumber);
      }

      // DB에 이미 존재하는지 검사
      const check = await client.query("SELECT lot_id FROM lot_transaction WHERE lot_number = $1", [lotNumber]);
      if (check.rows.length > 0) {
        createdLots.set(lotNumber, check.rows[0].lot_id);
        return check.rows[0].lot_id;
      }

      // 신규 등록
      const res = await client.query(`
        INSERT INTO lot_transaction (lot_number, lot_type, item_id, qty, remaining_qty, unit, status, created_at)
        VALUES ($1, $2, $3, 0, 0, 'EA', 'ACTIVE', $4)
        RETURNING lot_id
      `, [lotNumber, lotType, item_id, `${dateStr}T12:00:00Z`]);
      
      const lotId = res.rows[0].lot_id;
      createdLots.set(lotNumber, lotId);
      console.log(`[LOT CREATED] ${lotNumber} (item_id: ${item_id}, type: ${lotType}) -> lot_id: ${lotId}`);
      return lotId;
    }

    // ── 6월 데이터 처리 ──
    const month6 = '2026-06';
    console.log(`\n==================== 6월 데이터 마이그레이션 ====================`);
    
    // 6.1 입고 데이터 파싱 & 적재
    const in6 = parseSheetData(file6, '입고(2606)');
    console.log(`6월 입고 데이터 건수: ${in6.length}`);
    for (const item of in6) {
      const itemId = itemMapping[item.name];
      if (!itemId) {
        console.warn(`[WARN] 매핑되지 않은 품목(입고): ${item.name}`);
        continue;
      }
      const dayStr = String(item.day).padStart(2, '0');
      const dateStr = `${month6}-${dayStr}`;
      // 로트명 빌드: 2606[일][약호]01
      const abbrev = itemId === 14 ? 'U' : (itemId === 15 ? 'SP' : 'RM');
      const lotNo = `2606${dayStr}${abbrev}001`;

      const lotId = await getOrCreateLot(lotNo, itemId, 'IN', dateStr);
      
      await client.query(`
        INSERT INTO inventory_transaction (item_id, lot_id, txn_type, txn_date, qty, purpose, created_at)
        VALUES ($1, $2, 'IN', $3, $4, '6월 수불대장 입고 적재', $5)
      `, [itemId, lotId, dateStr, item.qty, `${dateStr}T12:00:00Z`]);
    }

    // 6.2 출고 데이터 파싱 & 적재
    const out6 = parseSheetData(file6, '출고(2606)');
    console.log(`6월 출고 데이터 건수: ${out6.length}`);
    for (const item of out6) {
      const itemId = itemMapping[item.name];
      if (!itemId) {
        console.warn(`[WARN] 매핑되지 않은 품목(출고): ${item.name}`);
        continue;
      }
      const dayStr = String(item.day).padStart(2, '0');
      const dateStr = `${month6}-${dayStr}`;
      const abbrev = itemId === 14 ? 'U' : (itemId === 15 ? 'SP' : 'RM');
      // 출고 시 사용할 임시 로트 번호
      const lotNo = `2606${dayStr}${abbrev}001`;

      const lotId = await getOrCreateLot(lotNo, itemId, 'IN', dateStr);

      await client.query(`
        INSERT INTO inventory_transaction (item_id, lot_id, txn_type, txn_date, qty, purpose, created_at)
        VALUES ($1, $2, 'OUT', $3, $4, '6월 수불대장 출고 적재', $5)
      `, [itemId, lotId, dateStr, item.qty, `${dateStr}T12:00:00Z`]);
    }

    // 6.3 생산 데이터 파싱 & 적재
    const prod6 = parseSheetData(file6, '생산량(2606)');
    console.log(`6월 생산 데이터 건수: ${prod6.length}`);
    for (const item of prod6) {
      const itemId = itemMapping[item.name];
      if (!itemId) {
        console.warn(`[WARN] 매핑되지 않은 품목(생산): ${item.name}`);
        continue;
      }
      const dayStr = String(item.day).padStart(2, '0');
      const dateStr = `${month6}-${dayStr}`;
      
      // 완제품 생산 LOT: J2606[일]D01
      // 특수 케이스: 100(몸통)의 6월 29일 생산 LOT는 '260629-FN-100(1201~2100)'로 엑셀에 적혀 있음
      let lotNo = `J2606${dayStr}D01`;
      if (itemId === 74 && item.day === 29) {
        lotNo = '260629-FN-100(1201~2100)';
      }

      const lotId = await getOrCreateLot(lotNo, itemId, 'ASM', dateStr);

      // 완제품 생산량은 재고가 늘어나는 것이므로 'IN' 타입으로 등록
      await client.query(`
        INSERT INTO inventory_transaction (item_id, lot_id, txn_type, txn_date, qty, purpose, created_at)
        VALUES ($1, $2, 'IN', $3, $4, '6월 수불대장 완제품 생산 적재', $5)
      `, [itemId, lotId, dateStr, item.qty, `${dateStr}T12:00:00Z`]);
    }

    // ── 7월 데이터 처리 ──
    const month7 = '2026-07';
    console.log(`\n==================== 7월 데이터 마이그레이션 ====================`);

    // 7.1 입고 데이터 파싱 & 적재
    const in7 = parseSheetData(file7, '입고(2607)');
    console.log(`7월 입고 데이터 건수: ${in7.length}`);
    for (const item of in7) {
      const itemId = itemMapping[item.name];
      if (!itemId) {
        console.warn(`[WARN] 매핑되지 않은 품목(입고): ${item.name}`);
        continue;
      }
      const dayStr = String(item.day).padStart(2, '0');
      const dateStr = `${month7}-${dayStr}`;
      
      // 특수 케이스: 100(몸통)의 7월 20일 입고 LOT는 '260713U002/260713GI001'로 엑셀에 수기 매핑되어 있음
      let lotNo = `2607${dayStr}${itemId === 14 ? 'U' : (itemId === 15 ? 'SP' : 'RM')}001`;
      if (itemId === 14 && item.day === 20) {
        lotNo = '260713U002/260713GI001';
      }

      const lotId = await getOrCreateLot(lotNo, itemId, 'IN', dateStr);

      await client.query(`
        INSERT INTO inventory_transaction (item_id, lot_id, txn_type, txn_date, qty, purpose, created_at)
        VALUES ($1, $2, 'IN', $3, $4, '7월 수불대장 입고 적재', $5)
      `, [itemId, lotId, dateStr, item.qty, `${dateStr}T12:00:00Z`]);
    }

    // 7.2 출고 데이터 파싱 & 적재
    const out7 = parseSheetData(file7, '출고(2607)');
    console.log(`7월 출고 데이터 건수: ${out7.length}`);
    for (const item of out7) {
      const itemId = itemMapping[item.name];
      if (!itemId) {
        console.warn(`[WARN] 매핑되지 않은 품목(출고): ${item.name}`);
        continue;
      }
      const dayStr = String(item.day).padStart(2, '0');
      const dateStr = `${month7}-${dayStr}`;
      
      // 특수 케이스: 100(몸통)의 7월 13일 출고 LOT는 '260713-FN-100(1299~1898)'로 엑셀에 매핑되어 있음
      let lotNo = `2607${dayStr}${itemId === 14 ? 'U' : (itemId === 15 ? 'SP' : 'RM')}001`;
      if (itemId === 14 && item.day === 13) {
        lotNo = '260713-FN-100(1299~1898)';
      }

      const lotId = await getOrCreateLot(lotNo, itemId, 'IN', dateStr);

      await client.query(`
        INSERT INTO inventory_transaction (item_id, lot_id, txn_type, txn_date, qty, purpose, created_at)
        VALUES ($1, $2, 'OUT', $3, $4, '7월 수불대장 출고 적재', $5)
      `, [itemId, lotId, dateStr, item.qty, `${dateStr}T12:00:00Z`]);
    }

    // 7.3 생산 데이터 파싱 & 적재
    const prod7 = parseSheetData(file7, '생산량(2607)');
    console.log(`7월 생산 데이터 건수: ${prod7.length}`);
    for (const item of prod7) {
      const itemId = itemMapping[item.name];
      if (!itemId) {
        console.warn(`[WARN] 매핑되지 않은 품목(생산): ${item.name}`);
        continue;
      }
      const dayStr = String(item.day).padStart(2, '0');
      const dateStr = `${month7}-${dayStr}`;
      
      const lotNo = `J2607${dayStr}D01`;

      const lotId = await getOrCreateLot(lotNo, itemId, 'ASM', dateStr);

      await client.query(`
        INSERT INTO inventory_transaction (item_id, lot_id, txn_type, txn_date, qty, purpose, created_at)
        VALUES ($1, $2, 'IN', $3, $4, '7월 수불대장 완제품 생산 적재', $5)
      `, [itemId, lotId, dateStr, item.qty, `${dateStr}T12:00:00Z`]);
    }

    // ── 각 LOT의 합산 수량 및 잔량 일괄 업데이트 ──
    console.log(`\n[LOT QTY SYNC] 각 LOT의 수량 및 잔량 동기화 중...`);
    // 이지원 MES에서는 lot_transaction의 qty가 입고/생산 합계이고 remaining_qty가 현재고 잔량이 된다.
    // 각 LOT에 대해 inventory_transaction의 합산을 기반으로 업데이트한다.
    const lotsToUpdate = Array.from(createdLots.values());
    for (const lotId of lotsToUpdate) {
      // 입고합계 계산
      const sumInRes = await client.query(`
        SELECT COALESCE(SUM(qty), 0) as total
        FROM inventory_transaction
        WHERE lot_id = $1 AND txn_type = 'IN'
      `, [lotId]);
      const totalIn = parseFloat(sumInRes.rows[0].total);

      // 출고합계 계산
      const sumOutRes = await client.query(`
        SELECT COALESCE(SUM(qty), 0) as total
        FROM inventory_transaction
        WHERE lot_id = $1 AND txn_type = 'OUT'
      `, [lotId]);
      const totalOut = parseFloat(sumOutRes.rows[0].total);

      const remaining = totalIn - totalOut;

      await client.query(`
        UPDATE lot_transaction
        SET qty = $1, remaining_qty = $2
        WHERE lot_id = $3
      `, [totalIn, remaining, lotId]);
    }
    console.log(`[LOT QTY SYNC] ${lotsToUpdate.length}개 LOT 수량 동기화 완료!`);

    await client.query('COMMIT');
    console.log('\n🎉 에프엔테크 6월/7월 입출고 및 로트 데이터 마이그레이션 성공!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ 오류 발생, ROLLBACK:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
