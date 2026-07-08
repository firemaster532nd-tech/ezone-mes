/**
 * 운영 DB(Supabase) 반제품 재고 & 배포 검증 스크립트
 * 실행: node check_wip_prod.cjs
 */
const { Pool } = require('pg');

// 운영 DB 연결 - .env의 DATABASE_URL 사용
const pool = new Pool({
  connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
  ssl: { rejectUnauthorized: false },
  max: 3,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('\n✅ 운영 DB(Supabase) 연결 성공\n');

    // ── 1. 반제품 LOT 현황 (lot_type 별 COUNT)
    const r1 = await client.query(`
      SELECT lot_type, status, COUNT(*) cnt, SUM(qty) total_qty, SUM(remaining_qty) total_remain
      FROM lot_transaction
      WHERE lot_type IN ('MIX','EXT','CUT','ASM')
      GROUP BY lot_type, status
      ORDER BY lot_type, status
    `);
    console.log('=== 반제품 LOT 유형별 현황 ===');
    if (r1.rows.length === 0) console.log('  (데이터 없음)');
    r1.rows.forEach(r => console.log(
      `  [${r.lot_type}] status=${r.status} | 건수=${r.cnt} | 총생산=${r.total_qty} | 잔량=${r.total_remain}`
    ));

    // ── 2. 최근 반제품 LOT 상세 (최근 20건)
    const r2 = await client.query(`
      SELECT lt.lot_type, lt.lot_number, lt.qty, lt.remaining_qty, lt.unit, lt.status,
             i.item_name, i.item_code,
             lt.created_at::date as date
      FROM lot_transaction lt
      LEFT JOIN item_master i ON i.item_id = lt.item_id
      WHERE lt.lot_type IN ('MIX','EXT','CUT','ASM')
      ORDER BY lt.created_at DESC
      LIMIT 20
    `);
    console.log('\n=== 반제품 LOT 상세 (최근 20건) ===');
    if (r2.rows.length === 0) console.log('  (없음)');
    r2.rows.forEach(r => console.log(
      `  [${r.lot_type}] ${r.lot_number} | ${r.item_name || '-'} | qty=${r.qty}${r.unit} | remain=${r.remaining_qty} | ${r.status} | ${r.date}`
    ));

    // ── 3. inventory_transaction 컬럼 확인 후 최근 IN 트랜잭션
    const schCols = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'inventory_transaction'
      ORDER BY ordinal_position
    `);
    const invCols = schCols.rows.map(r => r.column_name);
    console.log('\n=== inventory_transaction 컬럼 목록 ===');
    console.log('  ', invCols.join(', '));

    // ID 컬럼명 자동 감지
    const idCol = invCols.find(c => c === 'txn_id') || invCols.find(c => c === 'id') || invCols.find(c => c.endsWith('_id')) || 'id';
    const typeCol = invCols.find(c => c === 'txn_type') || invCols.find(c => c === 'type') || 'txn_type';
    const dateCol = invCols.find(c => c === 'txn_date') || invCols.find(c => c === 'date') || invCols.find(c => c.includes('date')) || 'txn_date';
    const purposeCol = invCols.includes('purpose') ? 'it.purpose' : "'N/A' as purpose";

    const r3 = await client.query(`
      SELECT it.${idCol} as inv_id, it.${typeCol} as txn_type, it.${dateCol}::text as txn_date,
             it.qty, ${purposeCol},
             i.item_name, lt.lot_number, lt.lot_type
      FROM inventory_transaction it
      LEFT JOIN item_master i ON i.item_id = it.item_id
      LEFT JOIN lot_transaction lt ON lt.lot_id = it.lot_id
      ORDER BY it.${idCol} DESC
      LIMIT 20
    `);
    console.log(`\n=== 최근 inventory_transaction (최근 ${r3.rows.length}건) ===`);
    if (r3.rows.length === 0) console.log('  (없음) → inventory_transaction 테이블 비어있음');
    r3.rows.forEach(r => console.log(
      `  #${r.inv_id} [${r.txn_type}] ${r.txn_date} | ${r.item_name || '?'} | LOT:${r.lot_number || '?'} | qty=${r.qty} | ${r.purpose || ''}` 
    ));

    // ── 4. 완료 WO ↔ LOT 매핑 현황
    const r4 = await client.query(`
      SELECT wo.wo_id, wo.wo_number, wo.process_code, wo.actual_qty, wo.lot_number,
             lt.lot_id, lt.qty as lot_qty, lt.status as lot_status
      FROM work_order wo
      LEFT JOIN lot_transaction lt ON lt.wo_id = wo.wo_id
      WHERE wo.status = 'COMPLETED'
        AND wo.process_code IN ('MIX','EXT','CUT','ASM')
      ORDER BY wo.wo_id DESC
      LIMIT 15
    `);
    console.log('\n=== 완료 WO ↔ LOT 매핑 현황 (최근 15건) ===');
    if (r4.rows.length === 0) console.log('  (완료된 반제품 WO 없음)');
    r4.rows.forEach(r => {
      const warn = !r.lot_id ? ' ⚠️ LOT없음' : (r.lot_qty === 0 || r.lot_qty === '0') ? ' ⚠️ qty=0' : ' ✅';
      console.log(
        `  WO#${r.wo_number} [${r.process_code}] actual=${r.actual_qty} | lot=${r.lot_number || '-'} | lot_qty=${r.lot_qty ?? '-'} | lot_status=${r.lot_status || '-'}${warn}`
      );
    });

    // ── 5. item_master 품목 유형 분포
    const r5 = await client.query(`
      SELECT item_type, COUNT(*) cnt
      FROM item_master
      GROUP BY item_type
      ORDER BY cnt DESC
    `);
    console.log('\n=== item_master 품목유형 분포 ===');
    r5.rows.forEach(r => console.log(`  item_type="${r.item_type}": ${r.cnt}건`));

    // ── 6. 배포 URL 헬스체크 (curl이 없으면 skip)
    console.log('\n=== 배포 URL 헬스체크 ===');
    const { execSync } = require('child_process');
    const endpoints = [
      'https://ezone-mes-backend.vercel.app/health',
      'https://ezone-mes.vercel.app',
    ];
    for (const url of endpoints) {
      try {
        const res = execSync(`curl -s -o NUL -w "%{http_code}" --max-time 10 "${url}"`, { encoding: 'utf-8', shell: 'cmd.exe' });
        console.log(`  ${url} → HTTP ${res.trim()}`);
      } catch {
        try {
          // PowerShell fallback
          const res2 = execSync(`powershell -Command "(Invoke-WebRequest -Uri '${url}' -UseBasicParsing -TimeoutSec 10).StatusCode"`, { encoding: 'utf-8' });
          console.log(`  ${url} → HTTP ${res2.trim()}`);
        } catch {
          console.log(`  ${url} → 확인 불가`);
        }
      }
    }

  } catch (err) {
    console.error('❌ DB 오류:', err.message);
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      console.log('  → Supabase 연결 실패. connectionString 및 SSL 설정 확인 필요.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run();
