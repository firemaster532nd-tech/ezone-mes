const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
  ssl: { rejectUnauthorized: false }
});
(async () => {
  const c = await pool.connect();
  try {
    // 1. inventory_transaction 전체 현황
    const r1 = await c.query(`
      SELECT txn_type, COUNT(*) cnt, SUM(qty) total_qty
      FROM inventory_transaction
      GROUP BY txn_type ORDER BY txn_type
    `);
    console.log("=== inventory_transaction 유형별 합계 ===");
    if(r1.rows.length===0) console.log("  (비어있음)");
    r1.rows.forEach(r => console.log(`  [${r.txn_type}] ${r.cnt}건 / 합계 qty=${r.total_qty}`));

    // 2. 최근 inventory_transaction 20건 (IN/OUT 모두)
    const cols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='inventory_transaction' ORDER BY ordinal_position`);
    const colList = cols.rows.map(r=>r.column_name);
    const idCol = colList.find(c=>c==='id') || 'id';
    const dateCol = colList.find(c=>c==='txn_date')||colList.find(c=>c.includes('date'))||'txn_date';
    
    const r2 = await c.query(`
      SELECT it.${idCol} as inv_id, it.txn_type, it.${dateCol}::text as txn_date,
             it.qty, it.purpose, it.balance,
             i.item_name, i.item_code,
             lt.lot_number, lt.lot_type
      FROM inventory_transaction it
      LEFT JOIN item_master i ON i.item_id = it.item_id
      LEFT JOIN lot_transaction lt ON lt.lot_id = it.lot_id
      ORDER BY it.${idCol} DESC LIMIT 20
    `);
    console.log("\n=== 최근 inventory_transaction 20건 ===");
    r2.rows.forEach(r => console.log(
      `  #${r.inv_id} [${r.txn_type}] ${r.txn_date} | ${r.item_name||'?'} | LOT:${r.lot_number||'-'} | qty=${r.qty} | balance=${r.balance} | ${r.purpose||''}`
    ));

    // 3. 현재고 요약 (item_master별 balance)
    const r3 = await c.query(`
      SELECT i.item_name, i.item_code,
             SUM(CASE WHEN it.txn_type='IN' THEN it.qty ELSE 0 END) total_in,
             SUM(CASE WHEN it.txn_type='OUT' THEN it.qty ELSE 0 END) total_out,
             SUM(CASE WHEN it.txn_type='IN' THEN it.qty ELSE -it.qty END) net_qty,
             MAX(it.balance) last_balance
      FROM inventory_transaction it
      LEFT JOIN item_master i ON i.item_id = it.item_id
      GROUP BY i.item_id, i.item_name, i.item_code
      HAVING SUM(CASE WHEN it.txn_type='IN' THEN it.qty ELSE -it.qty END) != 0
      ORDER BY net_qty DESC LIMIT 20
    `);
    console.log("\n=== 품목별 현재고 (net_qty 순) ===");
    if(r3.rows.length===0) console.log("  (데이터 없음)");
    r3.rows.forEach(r => console.log(
      `  ${r.item_code||'?'} | ${r.item_name||'?'} | IN=${r.total_in} OUT=${r.total_out} 잔량=${r.net_qty}`
    ));

    // 4. lot_transaction ACTIVE 현황 (remaining_qty > 0)
    const r4 = await c.query(`
      SELECT lt.lot_type, lt.lot_number, lt.qty, lt.remaining_qty, lt.unit, lt.status,
             i.item_name
      FROM lot_transaction lt
      LEFT JOIN item_master i ON i.item_id = lt.item_id
      WHERE lt.remaining_qty > 0
      ORDER BY lt.lot_type, lt.remaining_qty DESC
      LIMIT 20
    `);
    console.log("\n=== ACTIVE LOT (remaining_qty > 0) ===");
    if(r4.rows.length===0) console.log("  (없음) → 모든 LOT의 remaining_qty = 0");
    r4.rows.forEach(r => console.log(
      `  [${r.lot_type}] ${r.lot_number} | ${r.item_name||'?'} | qty=${r.qty} | remain=${r.remaining_qty}${r.unit} | ${r.status}`
    ));

    // 5. work_order 완료 현황
    const r5 = await c.query(`
      SELECT status, COUNT(*) cnt FROM work_order GROUP BY status ORDER BY cnt DESC
    `);
    console.log("\n=== work_order 상태 현황 ===");
    r5.rows.forEach(r => console.log(`  ${r.status}: ${r.cnt}건`));

  } finally {
    c.release();
    await pool.end();
  }
})().catch(e => { console.error("DB ERROR:", e.message); process.exit(1); });
