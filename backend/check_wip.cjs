const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://ezone:ezone1234@localhost:5432/ezone_mes' });

async function run() {
  try {
    const r1 = await pool.query(`SELECT lot_type, status, COUNT(*) cnt FROM lot_transaction WHERE lot_type IN ('MIX','EXT','CUT','ASM') GROUP BY lot_type,status ORDER BY lot_type`);
    console.log('=== lot_transaction 반제품 현황 ===');
    r1.rows.forEach(r => console.log(JSON.stringify(r)));

    const r2 = await pool.query(`SELECT it.txn_type, it.txn_date::text, it.qty, it.purpose, i.item_name FROM inventory_transaction it LEFT JOIN item_master i ON i.item_id=it.item_id WHERE it.purpose LIKE '%생산완료%' ORDER BY it.txn_id DESC LIMIT 10`);
    console.log('\n=== 최근 생산완료 inventory_transaction ===');
    if (r2.rows.length === 0) console.log('  (없음)');
    r2.rows.forEach(r => console.log(JSON.stringify(r)));

    const r3 = await pool.query(`SELECT item_type, COUNT(*) cnt FROM item_master GROUP BY item_type ORDER BY cnt DESC`);
    console.log('\n=== item_master 품목유형 분포 ===');
    r3.rows.forEach(r => console.log(JSON.stringify(r)));

    const r4 = await pool.query(`SELECT wo.process_code, wo.wo_number, wo.actual_qty, lt.lot_number, lt.lot_type, lt.qty, lt.status FROM work_order wo LEFT JOIN lot_transaction lt ON lt.wo_id=wo.wo_id WHERE wo.status='COMPLETED' AND wo.process_code IN ('MIX','EXT','CUT','ASM') ORDER BY wo.wo_id DESC LIMIT 10`);
    console.log('\n=== 완료 작업지시 LOT 상태 ===');
    if (r4.rows.length === 0) console.log('  (없음)');
    r4.rows.forEach(r => console.log(JSON.stringify(r)));

    const r5 = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='item_master' ORDER BY ordinal_position`);
    console.log('\n=== item_master 컬럼 목록 ===');
    console.log(r5.rows.map(r => r.column_name).join(', '));

    const r6 = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='lot_transaction' ORDER BY ordinal_position`);
    console.log('\n=== lot_transaction 컬럼 목록 ===');
    console.log(r6.rows.map(r => r.column_name).join(', '));

    const r7 = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='inventory_transaction' ORDER BY ordinal_position`);
    console.log('\n=== inventory_transaction 컬럼 목록 ===');
    console.log(r7.rows.map(r => r.column_name).join(', '));

    // 재고 잔량 현황 (반제품)
    const r8 = await pool.query(`
      SELECT lt.lot_type, lt.lot_number, lt.qty, lt.remaining_qty, lt.unit, lt.status,
             i.item_name, i.item_code
      FROM lot_transaction lt
      LEFT JOIN item_master i ON i.item_id = lt.item_id
      WHERE lt.lot_type IN ('MIX','EXT','CUT','ASM')
        AND lt.status = 'ACTIVE'
      ORDER BY lt.created_at DESC
      LIMIT 20
    `);
    console.log('\n=== ACTIVE 반제품 LOT (재고 잔량) ===');
    if (r8.rows.length === 0) console.log('  (없음)');
    r8.rows.forEach(r => console.log(JSON.stringify(r)));

  } catch(e) {
    console.error('DB ERROR:', e.message);
    console.log('(로컬 DB 접속 실패 - Vercel/원격 DB 사용 중일 가능성)');
  } finally {
    await pool.end();
  }
}
run();
