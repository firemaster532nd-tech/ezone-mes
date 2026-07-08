const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
  ssl: { rejectUnauthorized: false }
});
(async () => {
  const c = await pool.connect();
  try {
    // 컬럼 목록 확인
    const cols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='inventory_transaction' ORDER BY ordinal_position`);
    const colList = cols.rows.map(r => r.column_name);
    console.log("inventory_transaction 컬럼:", colList.join(", "));

    // ID 컬럼 자동감지 (inv_id, txn_id, id 순)
    const idCol = colList.find(c => c==='inv_id') || colList.find(c => c==='txn_id') || colList[0];
    console.log("PK 컬럼:", idCol);

    // 1. 최근 inventory_transaction 20건
    const r2 = await c.query(`
      SELECT it.${idCol} as inv_id, it.txn_type, it.txn_date::text as txn_date,
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
      `  #${r.inv_id} [${r.txn_type}] ${r.txn_date} | ${r.item_name||'?'} | LOT:${r.lot_number||'-'} [${r.lot_type||'-'}] | qty=${r.qty} | balance=${r.balance} | ${(r.purpose||'').substring(0,30)}`
    ));

    // 2. 품목별 현재고 (IN-OUT 합산)
    const r3 = await c.query(`
      SELECT i.item_name, i.item_code,
             SUM(CASE WHEN it.txn_type='IN' THEN it.qty ELSE 0 END) total_in,
             SUM(CASE WHEN it.txn_type='OUT' THEN it.qty ELSE 0 END) total_out,
             SUM(CASE WHEN it.txn_type='IN' THEN it.qty ELSE -it.qty END) net_qty
      FROM inventory_transaction it
      LEFT JOIN item_master i ON i.item_id = it.item_id
      GROUP BY i.item_id, i.item_name, i.item_code
      ORDER BY net_qty DESC LIMIT 20
    `);
    console.log("\n=== 품목별 현재고 (IN-OUT net) ===");
    if(r3.rows.length===0) console.log("  (데이터 없음)");
    r3.rows.forEach(r => console.log(
      `  ${r.item_code||'?'} | ${r.item_name||'?'} | IN=${r.total_in} OUT=${r.total_out} → 잔량=${r.net_qty}`
    ));

    // 3. remaining_qty > 0인 LOT
    const r4 = await c.query(`
      SELECT lt.lot_type, lt.lot_number, lt.qty, lt.remaining_qty, lt.unit, lt.status,
             i.item_name
      FROM lot_transaction lt
      LEFT JOIN item_master i ON i.item_id = lt.item_id
      WHERE lt.remaining_qty > 0
      ORDER BY lt.lot_type, lt.remaining_qty DESC LIMIT 20
    `);
    console.log("\n=== remaining_qty > 0 LOT ===");
    if(r4.rows.length===0) console.log("  (없음) → 모든 LOT remaining_qty = 0");
    r4.rows.forEach(r => console.log(
      `  [${r.lot_type}] ${r.lot_number} | ${r.item_name||'?'} | qty=${r.qty} remain=${r.remaining_qty}${r.unit} | ${r.status}`
    ));

    // 4. WO 상태 현황
    const r5 = await c.query(`SELECT status, COUNT(*) cnt FROM work_order GROUP BY status ORDER BY cnt DESC`);
    console.log("\n=== work_order 상태 현황 ===");
    r5.rows.forEach(r => console.log(`  ${r.status}: ${r.cnt}건`));

  } finally {
    c.release();
    await pool.end();
  }
})().catch(e => { console.error("DB ERROR:", e.message); process.exit(1); });
