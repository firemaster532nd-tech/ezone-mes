/**
 * (주)이지원 MES — Supabase LOT 번호 C302 형식 마이그레이션
 * 기준: EZC-C-302 제품식별 및 추적성관리 규정 Rev.8
 *
 * 실행: node backend/scripts/migrate-lot-c302.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

// C302 표1: item_code prefix → LOT 약호
const CODE_TO_ABBREV = {
  'RM-MB':   'MB',   // 난연컴파운드
  'RM-EG':   'EG',   // 팽창흑연
  'RM-EA':   'EA',   // EVA-EA33045
  'RM-EP':   'EP',   // EVA-EP100
  'RM-PE':   'PE',   // PE보온재
  'SM-CW':   'CW',   // 세라믹울 (SM-CW-128, SM-CW-96 등)
  'SM-GW':   'GW',   // 그라스울 (SM-GW-24 등)
  'SM-GI':   'GI',   // 강재류
  'SM-STL':  'GI',   // 강재류 (SM-STL-I, SM-STL-L, SM-STL-Z)
  'SM-SP':   'GI',   // 보호철판
  'SM-SIL':  'SS',   // 실란트
  'SM-SL':   'SS',   // 실란트
  'SM-PE':   'PE',   // PE보온재
  'SM-FN':   'U',    // 발포소켓(슬리브)
  'SM-GP':   'BK',   // 고정자재(브라켓)
  'SM-BK':   'BK',   // 브라켓
  'SA-MIX':  'MB',   // 배합 (MB 기반)
  'SA-EXT':  'EA',   // 압출
  'SA-CUT':  'CT',   // 재단
};

// INIT-CW-NNN → 수불대장 실제 LOT 번호 매핑 (규격 기반)
// 참조: RPT_20260212_이지원재고수불표_SELF_완료.xlsx — 차열재재고LOT 시트
const INIT_CW_REMAP = {
  13: { newLot: '260109CW002', note: '96K국산 25T×300W×7320L' },
  14: { newLot: '260203CW004', note: '100K수입 38T×600W×4800L' },
  15: { newLot: '260227CW005', note: '100K수입 25T×150W×7400L' },
  16: { newLot: '260109CW003', note: '96K수입 38T×150W×4800L' },
  17: { newLot: '260114CW001', note: '96K수입 50T×150W×3600L' },
  18: { newLot: '260202CW001', note: '96K수입 50T×400W×3600L' },
  19: { newLot: '260203CW001', note: '100K수입 50T×600W×3600L' },
  20: { newLot: '260203CW005', note: '96K수입 50T×1000W×3600L' },
  21: { newLot: '260203CW003', note: '128K수입 25T×200W×7400L' },
  22: { newLot: '260227CW004', note: '100K수입 25T×300W×7400L' },
};

// 수불대장에서 추출한 실제 LOT 데이터 (신규 추가)
const SUBL_LOTS_TO_INSERT = [
  // ── 그라스울 (GW) ──────────────────────────────────────────
  { lot_number: '250923GW001', lot_type: 'IN', item_id: 48, note: '그라스울-24K' },
  { lot_number: '251231GW002', lot_type: 'IN', item_id: 48, note: '그라스울-24K' },
  { lot_number: '260120GW001', lot_type: 'IN', item_id: 48, note: '그라스울-24K' },
  { lot_number: '260220GW001', lot_type: 'IN', item_id: 48, note: '그라스울-24K' },

  // ── 세라믹울 (CW) ──────────────────────────────────────────
  { lot_number: '250923CW001', lot_type: 'IN', item_id: 47, note: '세라믹차열재(96K)' },
  { lot_number: '260227CW003', lot_type: 'IN', item_id: 45, note: '세라믹차열재(128K)' },

  // ── 강재류/소켓 (GI) ───────────────────────────────────────
  { lot_number: '260106GI001', lot_type: 'IN', item_id: 5,  note: '강재류 아연도금(I형)' },
  { lot_number: '251105GI073', lot_type: 'IN', item_id: 6,  note: '강재류 아연도금(L형)' },
  { lot_number: '251105GI074', lot_type: 'IN', item_id: 7,  note: '강재류 아연도금(Z형)' },
  { lot_number: '260123GI004', lot_type: 'IN', item_id: 5,  note: '강재류 아연도금(I형)' },
  { lot_number: '260211GI001', lot_type: 'IN', item_id: 5,  note: '방화소켓 강재류' },
  { lot_number: '260220GI001', lot_type: 'IN', item_id: 5,  note: '방화소켓 강재류' },
  { lot_number: '260226GI112', lot_type: 'IN', item_id: 5,  note: '방화소켓 강재류(1050×1000)' },
  { lot_number: '260226GI113', lot_type: 'IN', item_id: 5,  note: '방화소켓 강재류(300×300)' },

  // ── 실란트 (SS) ────────────────────────────────────────────
  { lot_number: '250516SS001', lot_type: 'IN', item_id: 50, note: '실란트' },
  { lot_number: '250710SS001', lot_type: 'IN', item_id: 50, note: '실란트' },
  { lot_number: '250930SS001', lot_type: 'IN', item_id: 50, note: '실란트' },
  { lot_number: '260220SS001', lot_type: 'IN', item_id: 50, note: '실란트' },

  // ── 차열시트 배합공정 (S) ──────────────────────────────────
  { lot_number: '260129-S04',  lot_type: 'MIX', item_id: 16, note: '배합공정' },
  { lot_number: '260203-S01',  lot_type: 'MIX', item_id: 16, note: '배합공정' },
  { lot_number: '260203-S05',  lot_type: 'MIX', item_id: 16, note: '배합공정(소켓용)' },
  { lot_number: '260203-S08',  lot_type: 'MIX', item_id: 16, note: '배합공정(플래싱용)' },
  { lot_number: '260205-S01',  lot_type: 'CUT', item_id: 21, note: '재단공정' },
  { lot_number: '260205-S02',  lot_type: 'CUT', item_id: 21, note: '재단공정' },
  { lot_number: '260210-S01',  lot_type: 'MIX', item_id: 16, note: '배합공정' },
  { lot_number: '260223-S01',  lot_type: 'CUT', item_id: 21, note: '재단공정' },
  { lot_number: '260119-S07',  lot_type: 'CUT', item_id: 21, note: '재단공정' },

  // ── 조립 LOT (J...D) ───────────────────────────────────────
  { lot_number: 'J260212D01',  lot_type: 'ASM', item_id: 24, note: '방화소켓(VT-049) 조립' },
  { lot_number: 'J260223D01',  lot_type: 'ASM', item_id: 24, note: '방화소켓(VT-049) 조립' },
  { lot_number: 'J260223D65',  lot_type: 'ASM', item_id: 30, note: '방화소켓(HTG-064) 조립' },
  { lot_number: 'J260227D01',  lot_type: 'ASM', item_id: 23, note: '방화소켓(VT-01) 조립' },
  { lot_number: 'J260303D01',  lot_type: 'ASM', item_id: 23, note: '방화소켓(VT-01) 조립' },
];

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('═══════════════════════════════════════════════════');
    console.log('  (주)이지원 LOT 번호 C302 형식 마이그레이션 시작');
    console.log('═══════════════════════════════════════════════════\n');

    // ── STEP 0: 백업 ─────────────────────────────────────────
    await client.query(`
      DROP TABLE IF EXISTS lot_number_migration_backup;
      CREATE TABLE lot_number_migration_backup AS
      SELECT lot_id, lot_number AS old_lot_number, lot_type, item_id, created_at AS backed_up_at
      FROM lot_transaction
    `);
    console.log('✅ STEP 0: 기존 LOT 번호 백업 완료\n');

    // ── STEP 1: IN-YYMMDD-NNN → YYMMDД[약호]NNN 변환 ───────
    console.log('── STEP 1: IN-YYMMDD-NNN 형식 → C302 형식 변환 ──');
    const inLots = await client.query(`
      SELECT lt.lot_id, lt.lot_number, lt.item_id, im.item_code
      FROM lot_transaction lt
      LEFT JOIN item_master im ON lt.item_id = im.item_id
      WHERE lt.lot_number ~ '^IN-[0-9]{6}-[0-9]{3}$'
    `);

    for (const row of inLots.rows) {
      const m = row.lot_number.match(/^IN-(\d{6})-(\d{3})$/);
      if (!m) continue;
      const yymmdd = m[1];
      const seq = m[2];

      let abbrev = 'XX';
      if (row.item_code) {
        for (const [prefix, ab] of Object.entries(CODE_TO_ABBREV)) {
          if (row.item_code.startsWith(prefix)) { abbrev = ab; break; }
        }
      }

      const newLot = `${yymmdd}${abbrev}${seq}`;
      await client.query(
        'UPDATE lot_transaction SET lot_number = $1 WHERE lot_id = $2',
        [newLot, row.lot_id]
      );
      console.log(`  lot_id=${row.lot_id}  ${row.lot_number.padEnd(18)} → ${newLot}  [${row.item_code || 'NULL'}]`);
    }

    // ── STEP 2: INIT-CW-NNN → 수불대장 실제 LOT 번호로 교체 ─
    console.log('\n── STEP 2: INIT-CW-NNN → 수불대장 실제 LOT 번호 교체 ──');
    for (const [lotId, { newLot, note }] of Object.entries(INIT_CW_REMAP)) {
      const old = await client.query(
        'SELECT lot_number FROM lot_transaction WHERE lot_id = $1',
        [parseInt(lotId)]
      );
      if (old.rows.length === 0) {
        console.log(`  lot_id=${lotId} 없음 - SKIP`);
        continue;
      }
      // 중복 체크
      const dup = await client.query(
        'SELECT lot_id FROM lot_transaction WHERE lot_number = $1 AND lot_id != $2',
        [newLot, parseInt(lotId)]
      );
      if (dup.rows.length > 0) {
        // 중복이면 시퀀스 올려서 새 번호 부여
        const base = newLot.replace(/\d{3}$/, '');
        const seq = parseInt(newLot.match(/(\d{3})$/)[1]) + dup.rows.length;
        const altLot = base + String(seq).padStart(3, '0');
        await client.query(
          'UPDATE lot_transaction SET lot_number = $1, lot_type = \'IN\' WHERE lot_id = $2',
          [altLot, parseInt(lotId)]
        );
        console.log(`  lot_id=${lotId}  ${old.rows[0].lot_number.padEnd(25)} → ${altLot}  [${note}] (중복회피)`);
      } else {
        await client.query(
          'UPDATE lot_transaction SET lot_number = $1, lot_type = \'IN\' WHERE lot_id = $2',
          [newLot, parseInt(lotId)]
        );
        console.log(`  lot_id=${lotId}  ${old.rows[0].lot_number.padEnd(25)} → ${newLot}  [${note}]`);
      }
    }

    // ── STEP 3: 수불대장 LOT 신규 추가 ─────────────────────
    console.log('\n── STEP 3: 수불대장 LOT 신규 추가 ──');
    let inserted = 0, skipped = 0;
    for (const lot of SUBL_LOTS_TO_INSERT) {
      const dup = await client.query(
        'SELECT lot_id FROM lot_transaction WHERE lot_number = $1',
        [lot.lot_number]
      );
      if (dup.rows.length > 0) {
        console.log(`  SKIP (이미 존재): ${lot.lot_number}`);
        skipped++;
        continue;
      }
      // 단위 조회
      const unitRes = await client.query(
        'SELECT unit FROM item_master WHERE item_id = $1',
        [lot.item_id]
      );
      const unit = unitRes.rows.length > 0 ? unitRes.rows[0].unit : 'EA';

      await client.query(`
        INSERT INTO lot_transaction (lot_number, lot_type, item_id, qty, unit, status, remaining_qty)
        VALUES ($1, $2, $3, 0, $4, 'ACTIVE', 0)
      `, [lot.lot_number, lot.lot_type, lot.item_id, unit]);
      console.log(`  INSERT: ${lot.lot_number.padEnd(20)} [${lot.note}]`);
      inserted++;
    }
    console.log(`\n  → ${inserted}개 추가, ${skipped}개 건너뜀`);

    // ── COMMIT ──────────────────────────────────────────────
    await client.query('COMMIT');
    console.log('\n✅ 마이그레이션 COMMIT 완료!\n');

    // ── 최종 결과 ────────────────────────────────────────────
    const result = await client.query(`
      SELECT lt.lot_id, lt.lot_number, lt.lot_type, im.item_name
      FROM lot_transaction lt
      LEFT JOIN item_master im ON lt.item_id = im.item_id
      ORDER BY lt.lot_id
    `);
    console.log('═══ 최종 LOT 목록 ═══');
    result.rows.forEach(r =>
      console.log(`  ${String(r.lot_id).padStart(4)} | ${r.lot_number.padEnd(22)} | ${r.lot_type.padEnd(6)} | ${r.item_name || ''}`)
    );
    console.log(`\n  총 ${result.rows.length}개`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ 오류 발생 → ROLLBACK:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
