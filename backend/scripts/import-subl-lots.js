/**
 * (주)이지원 수불대장 LOT 데이터 임포트 스크립트
 * 참조: RPT_20260212_이지원재고수불표_SELF_완료.xlsx
 * 기준: EZC-C-302 제품식별 및 추적성관리 규정 Rev.8
 *
 * 실행: node backend/scripts/import-subl-lots.js
 */

require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// xlsx 모듈 사용
let xlsx;
try {
  xlsx = require('xlsx');
} catch (e) {
  console.error('xlsx 모듈이 필요합니다: npm install xlsx');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '54322'),
  user: process.env.POSTGRES_USER || 'ezone',
  password: process.env.POSTGRES_PASSWORD || 'ezone1234',
  database: process.env.POSTGRES_DB || 'ezone_mes',
});

// ───────────────────────────────────────────────────────────────
// 수불대장에서 추출한 실제 LOT 데이터 (C302 형식)
// ───────────────────────────────────────────────────────────────
const SUBL_LOTS = [
  // ── 세라믹울 (CW) ──
  { lot_number: '250923CW001', lot_type: 'IN', item_abbrev: 'CW', item_name: '세라믹울',      lot_date: '2025-09-23' },
  { lot_number: '250627CW001', lot_type: 'IN', item_abbrev: 'CW', item_name: '세라믹울',      lot_date: '2025-06-27' },
  { lot_number: '250717CW001', lot_type: 'IN', item_abbrev: 'CW', item_name: '세라믹울',      lot_date: '2025-07-17' },
  { lot_number: '250820CW001', lot_type: 'IN', item_abbrev: 'CW', item_name: '세라믹울',      lot_date: '2025-08-20' },
  { lot_number: '250919CW002', lot_type: 'IN', item_abbrev: 'CW', item_name: '세라믹울',      lot_date: '2025-09-19' },
  { lot_number: '260109CW002', lot_type: 'IN', item_abbrev: 'CW', item_name: '세라믹울(96K)', lot_date: '2026-01-09' },
  { lot_number: '260109CW003', lot_type: 'IN', item_abbrev: 'CW', item_name: '세라믹울(96K)', lot_date: '2026-01-09' },
  { lot_number: '260114CW001', lot_type: 'IN', item_abbrev: 'CW', item_name: '세라믹울(96K)', lot_date: '2026-01-14' },
  { lot_number: '260202CW001', lot_type: 'IN', item_abbrev: 'CW', item_name: '세라믹울',      lot_date: '2026-02-02' },
  { lot_number: '260203CW001', lot_type: 'IN', item_abbrev: 'CW', item_name: '세라믹울(100K)',lot_date: '2026-02-03' },
  { lot_number: '260203CW002', lot_type: 'IN', item_abbrev: 'CW', item_name: '세라믹울',      lot_date: '2026-02-03' },
  { lot_number: '260203CW003', lot_type: 'IN', item_abbrev: 'CW', item_name: '세라믹울(96K)', lot_date: '2026-02-03' },
  { lot_number: '260203CW004', lot_type: 'IN', item_abbrev: 'CW', item_name: '세라믹울(100K)',lot_date: '2026-02-03' },
  { lot_number: '260203CW005', lot_type: 'IN', item_abbrev: 'CW', item_name: '세라믹울',      lot_date: '2026-02-03' },
  { lot_number: '260220CW001', lot_type: 'IN', item_abbrev: 'CW', item_name: '세라믹울',      lot_date: '2026-02-20' },
  { lot_number: '260227CW003', lot_type: 'IN', item_abbrev: 'CW', item_name: '세라믹울',      lot_date: '2026-02-27' },
  { lot_number: '260227CW004', lot_type: 'IN', item_abbrev: 'CW', item_name: '세라믹울(100K)',lot_date: '2026-02-27' },
  { lot_number: '260227CW005', lot_type: 'IN', item_abbrev: 'CW', item_name: '세라믹울(100K)',lot_date: '2026-02-27' },

  // ── 그라스울 (GW) ──
  { lot_number: '250923GW001', lot_type: 'IN', item_abbrev: 'GW', item_name: '그라스울-24K',  lot_date: '2025-09-23' },
  { lot_number: '251231GW002', lot_type: 'IN', item_abbrev: 'GW', item_name: '그라스울-24K',  lot_date: '2025-12-31' },
  { lot_number: '260120GW001', lot_type: 'IN', item_abbrev: 'GW', item_name: '그라스울-24K',  lot_date: '2026-01-20' },
  { lot_number: '260220GW001', lot_type: 'IN', item_abbrev: 'GW', item_name: '그라스울-24K',  lot_date: '2026-02-20' },

  // ── 강재류/소켓(GI) ──
  { lot_number: '250710GI003', lot_type: 'IN', item_abbrev: 'GI', item_name: '강재류(아연도금)',lot_date: '2025-07-10' },
  { lot_number: '250724GI032', lot_type: 'IN', item_abbrev: 'GI', item_name: '강재류',         lot_date: '2025-07-24' },
  { lot_number: '250901GI032', lot_type: 'IN', item_abbrev: 'GI', item_name: '강재류',         lot_date: '2025-09-01' },
  { lot_number: '250901GI033', lot_type: 'IN', item_abbrev: 'GI', item_name: '강재류',         lot_date: '2025-09-01' },
  { lot_number: '251105GI073', lot_type: 'IN', item_abbrev: 'GI', item_name: '강재류(L형)',     lot_date: '2025-11-05' },
  { lot_number: '251105GI074', lot_type: 'IN', item_abbrev: 'GI', item_name: '강재류(Z형)',     lot_date: '2025-11-05' },
  { lot_number: '251127GI007', lot_type: 'IN', item_abbrev: 'GI', item_name: '강재류',         lot_date: '2025-11-27' },
  { lot_number: '251127GI009', lot_type: 'IN', item_abbrev: 'GI', item_name: '강재류',         lot_date: '2025-11-27' },
  { lot_number: '260106GI001', lot_type: 'IN', item_abbrev: 'GI', item_name: '강재류(I형)',     lot_date: '2026-01-06' },
  { lot_number: '260111GI007', lot_type: 'IN', item_abbrev: 'GI', item_name: '강재류',         lot_date: '2026-01-11' },
  { lot_number: '260111GI009', lot_type: 'IN', item_abbrev: 'GI', item_name: '강재류',         lot_date: '2026-01-11' },
  { lot_number: '260116GI223', lot_type: 'IN', item_abbrev: 'GI', item_name: '강재류',         lot_date: '2026-01-16' },
  { lot_number: '260116GI234', lot_type: 'IN', item_abbrev: 'GI', item_name: '강재류',         lot_date: '2026-01-16' },
  { lot_number: '260123GI004', lot_type: 'IN', item_abbrev: 'GI', item_name: '강재류(I형)',     lot_date: '2026-01-23' },
  { lot_number: '260123GI005', lot_type: 'IN', item_abbrev: 'GI', item_name: '강재류',         lot_date: '2026-01-23' },
  { lot_number: '260211GI001', lot_type: 'IN', item_abbrev: 'GI', item_name: '소켓(방화)',      lot_date: '2026-02-11' },
  { lot_number: '260220GI001', lot_type: 'IN', item_abbrev: 'GI', item_name: '소켓(방화)',      lot_date: '2026-02-20' },
  { lot_number: '260220GI065', lot_type: 'IN', item_abbrev: 'GI', item_name: '소켓(방화)',      lot_date: '2026-02-20' },
  { lot_number: '260226GI112', lot_type: 'IN', item_abbrev: 'GI', item_name: '소켓(방화)',      lot_date: '2026-02-26' },
  { lot_number: '260226GI113', lot_type: 'IN', item_abbrev: 'GI', item_name: '소켓(방화)',      lot_date: '2026-02-26' },

  // ── 실란트 (SS) ──
  { lot_number: '250516SS001', lot_type: 'IN', item_abbrev: 'SS', item_name: '실리콘실란트',  lot_date: '2025-05-16' },
  { lot_number: '250710SS001', lot_type: 'IN', item_abbrev: 'SS', item_name: '실리콘실란트',  lot_date: '2025-07-10' },
  { lot_number: '250930SS001', lot_type: 'IN', item_abbrev: 'SS', item_name: '실리콘실란트',  lot_date: '2025-09-30' },
  { lot_number: '260220SS001', lot_type: 'IN', item_abbrev: 'SS', item_name: '실리콘실란트',  lot_date: '2026-02-20' },

  // ── 차열시트/배합(S) ──
  { lot_number: '260129-S04', lot_type: 'PROC', item_abbrev: 'S', item_name: '차열시트(배합)', lot_date: '2026-01-29' },
  { lot_number: '260129-S05', lot_type: 'PROC', item_abbrev: 'S', item_name: '차열시트(배합)', lot_date: '2026-01-29' },
  { lot_number: '260203-S01', lot_type: 'PROC', item_abbrev: 'S', item_name: '차열시트(배합)', lot_date: '2026-02-03' },
  { lot_number: '260203-S05', lot_type: 'PROC', item_abbrev: 'S', item_name: '차열시트(배합)', lot_date: '2026-02-03' },
  { lot_number: '260203-S08', lot_type: 'PROC', item_abbrev: 'S', item_name: '차열시트(배합)', lot_date: '2026-02-03' },
  { lot_number: '260205-S01', lot_type: 'PROC', item_abbrev: 'S', item_name: '차열시트(재단)', lot_date: '2026-02-05' },
  { lot_number: '260205-S02', lot_type: 'PROC', item_abbrev: 'S', item_name: '차열시트(재단)', lot_date: '2026-02-05' },
  { lot_number: '260210-S01', lot_type: 'PROC', item_abbrev: 'S', item_name: '차열시트(배합)', lot_date: '2026-02-10' },
  { lot_number: '260119-S07', lot_type: 'PROC', item_abbrev: 'S', item_name: '차열시트',       lot_date: '2026-01-19' },
  { lot_number: '260119-S09', lot_type: 'PROC', item_abbrev: 'S', item_name: '차열시트',       lot_date: '2026-01-19' },
  { lot_number: '260223-S01', lot_type: 'PROC', item_abbrev: 'S', item_name: '차열시트',       lot_date: '2026-02-23' },

  // ── 조립 LOT (J[YYMMDD]D[NN]) ──
  { lot_number: 'J260212D01', lot_type: 'ASM', item_abbrev: 'D', item_name: '방화소켓(조립)',  lot_date: '2026-02-12' },
  { lot_number: 'J260223D01', lot_type: 'ASM', item_abbrev: 'D', item_name: '방화소켓(조립)',  lot_date: '2026-02-23' },
  { lot_number: 'J260223D65', lot_type: 'ASM', item_abbrev: 'D', item_name: '방화소켓(조립)',  lot_date: '2026-02-23' },
  { lot_number: 'J260303D01', lot_type: 'ASM', item_abbrev: 'D', item_name: '방화소켓(조립)',  lot_date: '2026-03-03' },
];

// ───────────────────────────────────────────────────────────────
// 임포트 실행
// ───────────────────────────────────────────────────────────────
async function importLots() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let inserted = 0;
    let skipped = 0;

    for (const lot of SUBL_LOTS) {
      // 이미 존재하는 lot_number는 skip
      const existing = await client.query(
        'SELECT lot_id FROM lot_transaction WHERE lot_number = $1',
        [lot.lot_number]
      );

      if (existing.rows.length > 0) {
        console.log(`⏭️  SKIP (이미 존재): ${lot.lot_number}`);
        skipped++;
        continue;
      }

      // item_master에서 매칭 아이템 찾기
      const itemRes = await client.query(
        `SELECT item_id, item_name, item_code, unit
         FROM item_master
         WHERE item_code LIKE $1 OR item_name LIKE $2
         LIMIT 1`,
        [`SM-${lot.item_abbrev}%`, `%${lot.item_name.split('(')[0]}%`]
      );

      const itemId = itemRes.rows.length > 0 ? itemRes.rows[0].item_id : null;
      const unit = itemRes.rows.length > 0 ? (itemRes.rows[0].unit || 'EA') : 'EA';

      await client.query(
        `INSERT INTO lot_transaction
           (lot_number, lot_type, item_id, qty, unit, supplier_lot, inspection_result, status, remaining_qty, lot_date)
         VALUES ($1, $2, $3, 0, $4, NULL, 'PENDING', 'ACTIVE', 0, $5)`,
        [lot.lot_number, lot.lot_type, itemId, unit, lot.lot_date]
      );

      console.log(`✅ INSERT: ${lot.lot_number} (${lot.item_name}) → item_id=${itemId || 'NULL'}`);
      inserted++;
    }

    await client.query('COMMIT');
    console.log(`\n✅ 완료: ${inserted}개 추가, ${skipped}개 건너뜀`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ 오류 발생, ROLLBACK:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// ───────────────────────────────────────────────────────────────
// 엑셀 파일에서 추가 LOT 자동 파싱
// ───────────────────────────────────────────────────────────────
async function parseAndImportFromExcel() {
  const filePath = path.resolve('upload/RPT_20260212_이지원재고수불표_SELF_완료.xlsx');

  if (!fs.existsSync(filePath)) {
    console.log('⚠️  수불대장 파일을 찾을 수 없습니다:', filePath);
    return;
  }

  const wb = xlsx.readFile(filePath);
  const allFoundLots = new Set();

  // 모든 시트에서 C302 형식 LOT 번호 추출
  wb.SheetNames.forEach(sheetName => {
    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });

    data.forEach(row => {
      row.forEach(cell => {
        const s = String(cell).trim();
        // C302 원/부자재 형식: YYMMDD[약호]NNN
        const matches = s.match(/\b\d{6}[A-Z]{2,5}\d{3}\b/g);
        if (matches) matches.forEach(m => allFoundLots.add(m));
        // 배합 형식: YYMMDD-SNN
        const mixMatches = s.match(/\b\d{6}-S\d{2}\b/g);
        if (mixMatches) mixMatches.forEach(m => allFoundLots.add(m));
        // 조립 형식: J[YYMMDD][약호][NN]
        const asmMatches = s.match(/\bJ\d{6}[A-Z]{1,4}\d{2}\b/g);
        if (asmMatches) asmMatches.forEach(m => allFoundLots.add(m));
      });
    });
  });

  console.log(`\n📊 엑셀에서 발견된 고유 LOT 번호 수: ${allFoundLots.size}`);
  [...allFoundLots].sort().forEach(lot => console.log('  ', lot));
}

// 실행
importLots()
  .then(() => parseAndImportFromExcel())
  .catch(console.error);
