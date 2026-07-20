/**
 * EZONE MES 테스트 데이터 초기화 스크립트
 * 실행 위치: backend 폴더에서
 *   dry-run (미리보기): node reset-data.cjs
 *   실제 실행:          node reset-data.cjs --execute
 */

const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const EXECUTE = process.argv.includes('--execute');

// 삭제 순서 (FK 의존성 고려 — 자식 먼저, 부모 나중)
const RESET_STEPS = [
  { table: 'audit_logs',                desc: '감사 로그' },
  { table: 'login_attempt',             desc: '로그인 시도 기록' },
  { table: 'approval',                  desc: '결재/승인 기록',       cascade: true },
  { table: 'shipment_order_item',       desc: '출하지시서 품목' },
  { table: 'shipment_order',            desc: '출하지시서' },
  { table: 'return_receipt_item',       desc: '반품 품목',           cascade: true },
  { table: 'return_receipt',            desc: '반품 접수',           cascade: true },
  { table: 'lot_properties',            desc: 'LOT 속성' },
  { table: 'lot_transaction',           desc: 'LOT 트랜잭션',        cascade: true },
  { table: 'lot_number_sequence',       desc: 'LOT 시퀀스' },
  { table: 'inspection_result',         desc: '검사 결과',           cascade: true },
  { table: 'process_inspection_result', desc: '공정 검사 결과',      cascade: true },
  { table: 'self_inspection_result',    desc: '자주 검사 결과',      cascade: true },
  { table: 'socket_incoming_item',      desc: '소켓 수입검사 항목',  cascade: true },
  { table: 'socket_incoming',           desc: '소켓 수입검사',       cascade: true },
  { table: 'process_execution',         desc: '공정 실행 기록',      cascade: true },
  { table: 'socket_order_item',         desc: '소켓 발주 품목' },
  { table: 'socket_order',              desc: '소켓 발주서' },
  { table: 'work_order',                desc: '작업지시서',           cascade: true },
  { table: 'purchase_order_item',       desc: '발주서 품목' },
  { table: 'purchase_order',            desc: '발주서' },
  { table: 'inventory_transaction',     desc: '재고 이동 기록' },
  { table: 'project',                   desc: '프로젝트 (현장)',      cascade: true },
];

const MASTER_CHECK = [
  { table: 'worker',                desc: '사용자 계정 (유지)' },
  { table: 'department',            desc: '부서 (유지)' },
  { table: 'item_master',           desc: '품목 마스터 (유지)' },
  { table: 'certification_master',  desc: '인정구조 마스터 (유지)' },
  { table: 'menu',                  desc: '메뉴 (유지)' },
  { table: 'department_permission', desc: '부서별 권한 (유지)' },
];

async function getCount(client, table) {
  try {
    const { rows } = await client.query(`SELECT count(*)::int as cnt FROM "${table}"`);
    return rows[0].cnt;
  } catch { return -1; }
}

(async () => {
  console.log('\n' + '='.repeat(60));
  console.log('  EZONE MES 테스트 데이터 초기화');
  console.log('  모드:', EXECUTE ? '[실행] 실제 삭제' : '[미리보기] DRY-RUN');
  console.log('='.repeat(60));

  const client = await pool.connect();
  try {
    // 현재 건수 확인
    console.log('\n[삭제 예정 데이터]');
    const counts = {};
    for (const s of RESET_STEPS) {
      counts[s.table] = await getCount(client, s.table);
      const c = counts[s.table];
      const mark = c > 0 ? '<-- 삭제 예정' : c === 0 ? '(비어있음)' : '(테이블없음)';
      console.log(`  ${s.desc.padEnd(25)} ${String(c < 0 ? '?' : c).padStart(6)}건  ${mark}`);
    }

    console.log('\n[유지되는 마스터 데이터]');
    for (const m of MASTER_CHECK) {
      const cnt = await getCount(client, m.table);
      console.log(`  ${m.desc.padEnd(30)} ${String(cnt < 0 ? '?' : cnt).padStart(6)}건`);
    }

    if (!EXECUTE) {
      console.log('\n[DRY-RUN 완료] 아무것도 삭제되지 않았습니다.');
      console.log('실제 실행하려면: node reset-data.cjs --execute');
      console.log('='.repeat(60) + '\n');
      await pool.end();
      return;
    }

    // 실제 삭제 실행
    console.log('\n[실행] 초기화 시작...');
    await client.query('BEGIN');
    let total = 0;

    for (const s of RESET_STEPS) {
      if (counts[s.table] < 0) { console.log(`  SKIP: ${s.desc}`); continue; }
      try {
        await client.query(`TRUNCATE TABLE "${s.table}"${s.cascade ? ' CASCADE' : ''}`);
        total += counts[s.table];
        console.log(`  OK: ${s.desc} (${counts[s.table]}건)`);
      } catch (e) {
        console.error(`  FAIL: ${s.desc} - ${e.message}`);
        await client.query('ROLLBACK');
        console.error('[ROLLBACK] 데이터 변경 없음');
        process.exit(1);
      }
    }

    await client.query('COMMIT');

    // 완료 후 검증
    console.log('\n[완료 후 건수 확인]');
    for (const s of RESET_STEPS) {
      const cnt = await getCount(client, s.table);
      console.log(`  ${cnt === 0 ? 'OK' : 'WARN'}: ${s.desc.padEnd(25)} ${cnt}건`);
    }
    console.log(`\n완료! 총 ${total}건 삭제됨.`);
    console.log('='.repeat(60) + '\n');

  } catch (err) {
    console.error('오류:', err.message);
    try { await client.query('ROLLBACK'); } catch {}
  } finally {
    client.release();
    await pool.end();
  }
})();
