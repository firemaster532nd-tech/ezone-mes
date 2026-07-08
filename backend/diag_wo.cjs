const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
  ssl: { rejectUnauthorized: false }
});
(async () => {
  const c = await pool.connect();
  try {
    const s1 = await c.query("SELECT process_code, status, COUNT(*) cnt FROM work_order WHERE process_code IN ($1,$2,$3,$4) GROUP BY process_code, status ORDER BY process_code, status", ["MIX","EXT","CUT","ASM"]);
    console.log("=== WO 상태 분포 ===");
    s1.rows.forEach(r => console.log(JSON.stringify(r)));

    const s2 = await c.query("SELECT wo_id, wo_number, process_code, status, actual_qty, planned_qty, item_id FROM work_order WHERE process_code IN ($1,$2,$3,$4) ORDER BY wo_id DESC LIMIT 10", ["MIX","EXT","CUT","ASM"]);
    console.log("\n=== 최근 반제품 WO ===");
    s2.rows.forEach(r => console.log(JSON.stringify(r)));

    const s3 = await c.query("SELECT lot_id, lot_number, lot_type, qty, remaining_qty, status, wo_id, item_id FROM lot_transaction WHERE lot_type IN ($1,$2,$3,$4) ORDER BY lot_id DESC LIMIT 10", ["MIX","EXT","CUT","ASM"]);
    console.log("\n=== lot_transaction ===");
    s3.rows.forEach(r => console.log(JSON.stringify(r)));
  } finally {
    c.release();
    await pool.end();
  }
})().catch(e => console.error(e.message));
