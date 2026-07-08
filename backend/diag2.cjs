/**
 * 기존 LOT-WO 연결 복구 + qty 백필
 * lot_transaction의 lot_number와 work_order의 lot_number를 매핑하여 wo_id 연결
 */
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
  ssl: { rejectUnauthorized: false }
});
(async () => {
  const c = await pool.connect();
  try {
    // 1. WO에 lot_number 있는 것들 확인
    const wos = await c.query("SELECT wo_id, wo_number, process_code, lot_number, planned_qty, actual_qty, status, item_id FROM work_order WHERE lot_number IS NOT NULL AND process_code IN ($1,$2,$3,$4)", ["MIX","EXT","CUT","ASM"]);
    console.log("=== WO with lot_number ===");
    wos.rows.forEach(r => console.log(JSON.stringify(r)));

    // 2. lot_transaction에서 wo_id=null인 것들
    const lots = await c.query("SELECT lot_id, lot_number, lot_type, qty, wo_id FROM lot_transaction WHERE lot_type IN ($1,$2,$3,$4) AND wo_id IS NULL", ["MIX","EXT","CUT","ASM"]);
    console.log("\n=== lot_transaction wo_id=null ===");
    lots.rows.forEach(r => console.log(JSON.stringify(r)));
  } finally {
    c.release();
    await pool.end();
  }
})().catch(e => console.error(e.message));
