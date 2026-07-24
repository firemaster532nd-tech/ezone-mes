// 구글시트 데이터를 Supabase material_lots에 직접 삽입하는 스크립트
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
  ssl: { rejectUnauthorized: false },
  max: 5
});

// 구글시트 입출고이력DB에서 파싱한 LOT 있는 재고 데이터
// 위치 포맷: "RACK코드-P파레트번호" (예: A1-P1, A1-P2)
const LOT_DATA = [
  { lot_number: '260610CW002', location: 'A1-P1', item_name: '세라믹울', qty: 16, notes: '96K 50T 400W 3600L' },
  { lot_number: '260610CW002-A1P2', location: 'A1-P2', item_name: '세라믹울', qty: 15, notes: '96K 50T 400W 3600L' },
  { lot_number: '260203CW007', location: 'B1-P1', item_name: '세라믹울', qty: 7, notes: '96K 50T 400W 3600L' },
  { lot_number: '260610CW002-B1P2', location: 'B1-P2', item_name: '세라믹울', qty: 13, notes: '96K 50T 400W 3600L' },
  { lot_number: '260610CW002-B2P2', location: 'B2-P2', item_name: '세라믹울', qty: 16, notes: '96K 50T 400W 3600L' },
  { lot_number: '260203CW004', location: 'C1-P2', item_name: '세라믹울', qty: 6, notes: '100K 38T 600W 4800L' },
  { lot_number: '260203CW004-C1P1', location: 'C1-P1', item_name: '세라믹울', qty: 16, notes: '100K 38T 600W 4800L' },
  { lot_number: '260630CW001', location: 'D1-P2', item_name: '세라믹울', qty: 3, notes: '104K 50T 600W 3800L' },
  { lot_number: '260203CW004-D2P2', location: 'D2-P2', item_name: '세라믹울', qty: 16, notes: '100K 38T 600W 4800L' },
  { lot_number: '260203CW004-D2P1', location: 'D2-P1', item_name: '세라믹울', qty: 16, notes: '100K 38T 600W 4800L' },
  { lot_number: '260630CW001-E2P2', location: 'E2-P2', item_name: '세라믹울', qty: 16, notes: '104K 50T 600W 3800L' },
  { lot_number: '260630CW001-E2P1', location: 'E2-P1', item_name: '세라믹울', qty: 16, notes: '104K 50T 600W 3800L' },
  { lot_number: '260630CW001-E1P1', location: 'E1-P1', item_name: '세라믹울', qty: 16, notes: '104K 50T 600W 3800L' },
  { lot_number: '260630CW001-E1P2', location: 'E1-P2', item_name: '세라믹울', qty: 16, notes: '104K 50T 600W 3800L' },
  { lot_number: '260630CW003', location: 'F1-P1', item_name: '세라믹울', qty: 16, notes: '104K 25T 200W 7400L' },
  { lot_number: '260630CW003-F1P2', location: 'F1-P2', item_name: '세라믹울', qty: 16, notes: '104K 25T 200W 7400L' },
  { lot_number: '260630CW003-F2P1', location: 'F2-P1', item_name: '세라믹울', qty: 16, notes: '104K 25T 200W 7400L' },
  { lot_number: '260630CW003-F2P2', location: 'F2-P2', item_name: '세라믹울', qty: 16, notes: '104K 25T 200W 7400L' },
  { lot_number: '260630CW001-F3P2', location: 'F3-P2', item_name: '세라믹울', qty: 16, notes: '104K 50T 600W 3800L' },
  { lot_number: '260630CW001-F3P1', location: 'F3-P1', item_name: '세라믹울', qty: 16, notes: '104K 50T 600W 3800L' },
  { lot_number: '260630CW003-G2P1', location: 'G2-P1', item_name: '세라믹울', qty: 16, notes: '104K 25T 200W 7400L' },
  { lot_number: '260630CW003-G2P2', location: 'G2-P2', item_name: '세라믹울', qty: 16, notes: '104K 25T 200W 7400L' },
  { lot_number: '260722CW001', location: 'G3-P2', item_name: '세라믹울', qty: 8, notes: '104K 25T 200W 7400L' },
  { lot_number: '260722CW001-H3P2', location: 'H3-P2', item_name: '세라믹울', qty: 16, notes: '104K 25T 200W 7400L' },
  { lot_number: '260722CW001-H3P1', location: 'H3-P1', item_name: '세라믹울', qty: 16, notes: '104K 25T 200W 7400L' },
  { lot_number: '260722CW001-H2P1', location: 'H2-P1', item_name: '세라믹울', qty: 16, notes: '104K 25T 200W 7400L' },
  { lot_number: '260722CW001-H2P2', location: 'H2-P2', item_name: '세라믹울', qty: 16, notes: '104K 25T 200W 7400L' },
  { lot_number: '260722CW001-H1P1', location: 'H1-P1', item_name: '세라믹울', qty: 16, notes: '104K 25T 200W 7400L' },
  { lot_number: '260722CW001-H1P2', location: 'H1-P2', item_name: '세라믹울', qty: 16, notes: '104K 25T 200W 7400L' },
  { lot_number: '260722CW001-I1P1', location: 'I1-P1', item_name: '세라믹울', qty: 16, notes: '104K 25T 200W 7400L' },
  { lot_number: '260722CW001-I1P2', location: 'I1-P2', item_name: '세라믹울', qty: 16, notes: '104K 25T 200W 7400L' },
  { lot_number: '260722CW001-I2P2', location: 'I2-P2', item_name: '세라믹울', qty: 16, notes: '104K 25T 200W 7400L' },
  { lot_number: '260722CW001-I2P1', location: 'I2-P1', item_name: '세라믹울', qty: 16, notes: '104K 25T 200W 7400L' },
  { lot_number: '260722CW001-I3P1', location: 'I3-P1', item_name: '세라믹울', qty: 16, notes: '104K 25T 200W 7400L' },
  { lot_number: '260722CW001-I3P2', location: 'I3-P2', item_name: '세라믹울', qty: 16, notes: '104K 25T 200W 7400L' },
  { lot_number: '251001GW001', location: 'J3-P1', item_name: '그라스울보드', qty: 0, notes: '그라스울보드' },
  { lot_number: '260722CW003', location: 'J2-P1', item_name: '세라믹울', qty: 2, notes: '96K 50T 600W 3600L' },
  { lot_number: '260722CW003-J2P2', location: 'J2-P2', item_name: '세라믹울', qty: 16, notes: '96K 50T 600W 3600L' },
  { lot_number: '260722CW003-J1P1', location: 'J1-P1', item_name: '세라믹울', qty: 16, notes: '96K 50T 600W 3600L' },
  { lot_number: '260722CW003-J1P2', location: 'J1-P2', item_name: '세라믹울', qty: 16, notes: '96K 50T 600W 3600L' },
  { lot_number: '260227CW003', location: 'K2-P1', item_name: '세라믹울', qty: 18, notes: '100K 25T 300W 7400L, 2롤*9box' },
  { lot_number: '260227CW003-K1P1', location: 'K1-P1', item_name: '세라믹울', qty: 80, notes: '100K 25T 300W 7400L, 2롤*40box' },
  { lot_number: '260227CW005', location: 'L2-P1', item_name: '세라믹울', qty: 104, notes: '100K 25T 150W 7400L, 4롤*26box' },
  { lot_number: '260203CW004-L1P1', location: 'L1-P1', item_name: '세라믹울', qty: 40, notes: '100K 38T 600W 4800L' },
  { lot_number: '260203CW001', location: 'M2-P1', item_name: '세라믹울', qty: 52, notes: '100K 25T 300W 7400L (인정심사용)' },
  { lot_number: '260203CW004-M1P1', location: 'M1-P1', item_name: '세라믹울', qty: 40, notes: '100K 38T 600W 4800L (인정심사용)' },
  { lot_number: '260203CW001-N2P1', location: 'N2-P1', item_name: '세라믹울', qty: 58, notes: '100K 25T 300W 7400L (인정심사용)' },
  { lot_number: '260203CW001-N1P2', location: 'N1-P2', item_name: '세라믹울', qty: 10, notes: '100K 25T 300W 7400L (인정심사용)' },
  { lot_number: '260203CW006', location: 'O2-P1', item_name: '세라믹울', qty: 10, notes: '96K 50T 1000W 3600L (인정심사용)' },
  { lot_number: '260203CW001-O1P1', location: 'O1-P1', item_name: '세라믹울', qty: 80, notes: '100K 25T 300W 7400L (인정심사용)' },
  { lot_number: '260402GW002', location: 'P2-P2', item_name: '그라스울', qty: 0, notes: '인정심사용 그라스울' },
  { lot_number: '260203CW008', location: 'R1-P1', item_name: '세라믹울', qty: 90, notes: '96K 50T 150W 3600L, 15롤*6box' },
  { lot_number: '260203CW005', location: 'R2-P1', item_name: '세라믹울', qty: 40, notes: '96K 38T 150W 4800L, 4롤*10box' },
  { lot_number: '260203CW003', location: 'R2-P2', item_name: '세라믹울', qty: 40, notes: '96K 25T 150W 7400L, 4롤*10box' },
];

// LOT 없는 비인정재고
const NON_CERT_DATA = [
  { rack_code: 'J3', pallet_no: 1, item_name: '그라스울보드', notes: '구글시트 2026-07-24' },
  { rack_code: 'K3', pallet_no: 2, item_name: '인정심사용_세라믹울', notes: '구글시트 2026-07-24' },
  { rack_code: 'K3', pallet_no: 1, item_name: '인정심사용_세라믹울', notes: '구글시트 2026-07-24' },
  { rack_code: 'L3', pallet_no: 1, item_name: '인정심사용_강판', notes: '구글시트 2026-07-24' },
  { rack_code: 'M3', pallet_no: 1, item_name: '인정심사용_미네랄울', notes: '구글시트 2026-07-24' },
  { rack_code: 'N3', pallet_no: 1, item_name: '인정심사용_미네랄울', notes: '구글시트 2026-07-24' },
  { rack_code: 'O3', pallet_no: 1, item_name: '인정심사용_미네랄울', notes: '구글시트 2026-07-24' },
  { rack_code: 'N1', pallet_no: 1, item_name: '인정심사용_시트', notes: '구글시트 2026-07-24' },
  { rack_code: 'P3', pallet_no: 1, item_name: '인정심사용_세라믹울', notes: '구글시트 2026-07-24' },
  { rack_code: 'P3', pallet_no: 2, item_name: '인정심사용_그라스울', notes: '구글시트 2026-07-24' },
  { rack_code: 'P2', pallet_no: 1, item_name: '인정심사용_미네랄울', notes: '구글시트 2026-07-24' },
  { rack_code: 'Q3', pallet_no: 2, item_name: '인정심사용_세라믹울', notes: '구글시트 2026-07-24' },
  { rack_code: 'Q3', pallet_no: 1, item_name: '인정심사용_세라믹울', lot_number: '251022CW001(미확인)', notes: '미확인 LOT 기재됨' },
  { rack_code: 'Q2', pallet_no: 1, item_name: '인정심사용_그라스울', notes: '구글시트 2026-07-24' },
  { rack_code: 'Q2', pallet_no: 2, item_name: '인정심사용_그라스울', notes: '구글시트 2026-07-24' },
  { rack_code: 'P1', pallet_no: 1, item_name: '소켓_반품', notes: '구글시트 2026-07-24' },
  { rack_code: 'P1', pallet_no: 2, item_name: '소켓_반품', notes: '구글시트 2026-07-24' },
  { rack_code: 'Q1', pallet_no: 1, item_name: '소켓_반품', notes: '구글시트 2026-07-24' },
  { rack_code: 'Q1', pallet_no: 2, item_name: '소켓_반품', notes: '구글시트 2026-07-24' },
  { rack_code: 'R1', pallet_no: 2, item_name: '인정심사용_플래싱2T', notes: '구글시트 2026-07-24' },
  { rack_code: 'R3', pallet_no: 1, item_name: '인정심사용_그라스울', notes: '구글시트 2026-07-24' },
  { rack_code: 'R3', pallet_no: 2, item_name: '인정심사용_그라스울', notes: '구글시트 2026-07-24' },
  { rack_code: 'D3', pallet_no: 1, item_name: '미출하_소켓및부자재', notes: '송도캠퍼스_소켓 및 부자재' },
  { rack_code: 'D3', pallet_no: 2, item_name: '미출하_소켓및부자재', notes: '김앤드이_검단신도시_부자재' },
];

async function run() {
  const client = await pool.connect();
  let inserted = 0, skipped = 0, ncInserted = 0, ncSkipped = 0;

  try {
    // 1. material_lots 테이블 존재 확인
    await client.query(`
      CREATE TABLE IF NOT EXISTS material_lots (
        lot_id SERIAL PRIMARY KEY,
        lot_number VARCHAR(60) NOT NULL,
        category VARCHAR(40) NOT NULL DEFAULT '세라믹울',
        item_name VARCHAR(200),
        unit VARCHAR(10) DEFAULT 'EA',
        qty_current NUMERIC(12,3) NOT NULL DEFAULT 0,
        location VARCHAR(20) DEFAULT '본재고',
        received_date DATE,
        notes TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});

    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_material_lots_lot ON material_lots(lot_number) WHERE (is_active = TRUE)`).catch(() => {});

    // 2. non_certified_stock 테이블 존재 확인
    await client.query(`
      CREATE TABLE IF NOT EXISTS non_certified_stock (
        id SERIAL PRIMARY KEY,
        rack_code VARCHAR(10) NOT NULL,
        pallet_no INTEGER NOT NULL DEFAULT 1,
        item_name VARCHAR(200) NOT NULL,
        spec VARCHAR(300),
        lot_number VARCHAR(100),
        qty NUMERIC(12,3) DEFAULT 0,
        unit VARCHAR(20) DEFAULT 'EA',
        reason VARCHAR(200) DEFAULT '로트미확인',
        status VARCHAR(20) DEFAULT 'ACTIVE',
        notes TEXT,
        registered_at DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});

    await client.query('BEGIN');

    // 3. material_lots 삽입
    console.log('\n=== LOT 있는 재고 → material_lots ===');
    for (const row of LOT_DATA) {
      const category = row.item_name.includes('그라스울보드') ? '그라스울보드'
                     : row.item_name.includes('그라스울')    ? '그라스울'
                     : '세라믹울';

      const { rows: exist } = await client.query(
        `SELECT lot_id FROM material_lots WHERE lot_number=$1 AND is_active=TRUE LIMIT 1`,
        [row.lot_number]
      );

      if (exist.length > 0) {
        // 위치와 수량 업데이트
        await client.query(
          `UPDATE material_lots SET location=$1, qty_current=$2, updated_at=NOW() WHERE lot_id=$3`,
          [row.location, row.qty, exist[0].lot_id]
        );
        console.log(`  [갱신] ${row.lot_number} → ${row.location} (qty: ${row.qty})`);
        skipped++;
      } else {
        const { rows: [lot] } = await client.query(
          `INSERT INTO material_lots (lot_number, category, item_name, unit, qty_current, location, received_date, notes)
           VALUES ($1,$2,$3,'롤',$4,$5,'2026-07-24',$6)
           ON CONFLICT DO NOTHING
           RETURNING lot_id`,
          [row.lot_number, category, row.item_name, row.qty, row.location, row.notes || '구글시트 초기등록 (2026-07-24)']
        );

        if (lot?.lot_id && row.qty > 0) {
          await client.query(
            `INSERT INTO material_transactions (txn_date,lot_id,lot_number,category,txn_type,qty,qty_before,qty_after,source_type,notes)
             VALUES ('2026-07-24',$1,$2,$3,'IN',$4,0,$4,'GOOGLE_SHEET_IMPORT','구글시트 기초재고 등록') ON CONFLICT DO NOTHING`,
            [lot.lot_id, row.lot_number, category, row.qty]
          ).catch(() => {}); // material_transactions 테이블 없으면 무시
        }

        console.log(`  [신규] ${row.lot_number} → ${row.location} (qty: ${row.qty})`);
        inserted++;
      }
    }

    // 4. non_certified_stock 삽입
    console.log('\n=== LOT 없는 재고 → non_certified_stock ===');
    for (const row of NON_CERT_DATA) {
      const { rows: exist } = await client.query(
        `SELECT id FROM non_certified_stock WHERE rack_code=$1 AND pallet_no=$2 AND status='ACTIVE' LIMIT 1`,
        [row.rack_code, row.pallet_no]
      );

      if (exist.length > 0) {
        await client.query(
          `UPDATE non_certified_stock SET item_name=$1, notes=$2 WHERE id=$3`,
          [row.item_name, row.notes, exist[0].id]
        );
        console.log(`  [갱신] ${row.rack_code}-P${row.pallet_no}: ${row.item_name}`);
        ncSkipped++;
      } else {
        await client.query(
          `INSERT INTO non_certified_stock (rack_code, pallet_no, item_name, lot_number, qty, reason, notes, registered_at)
           VALUES ($1,$2,$3,$4,0,'로트미확인',$5,'2026-07-24')`,
          [row.rack_code, row.pallet_no, row.item_name, row.lot_number || null, row.notes]
        );
        console.log(`  [신규] ${row.rack_code}-P${row.pallet_no}: ${row.item_name}`);
        ncInserted++;
      }
    }

    await client.query('COMMIT');

    console.log('\n==========================================');
    console.log(`✅ 완료!`);
    console.log(`   material_lots: 신규 ${inserted}건, 갱신 ${skipped}건`);
    console.log(`   non_certified_stock: 신규 ${ncInserted}건, 갱신 ${ncSkipped}건`);
    console.log('==========================================\n');

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ 오류:', e.message);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
