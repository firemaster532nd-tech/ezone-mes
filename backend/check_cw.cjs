const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
  ssl: { rejectUnauthorized: false }
});
(async () => {
  const c = await pool.connect();
  try {
    // item_master 컬럼 목록
    const cols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='item_master' ORDER BY ordinal_position`);
    console.log("item_master 컬럼:", cols.rows.map(r=>r.column_name).join(", "));

    // CW/GW 품목 전체 조회
    const r1 = await c.query(`
      SELECT item_id, item_code, item_name, item_category, unit, spec
      FROM item_master
      WHERE item_code LIKE 'SM-CW%' OR item_code LIKE 'SM-GW%'
         OR item_name LIKE '%세라믹%' OR item_name LIKE '%그라스울%'
         OR item_name LIKE '%차열재%' OR item_name LIKE '%ceramic%'
      ORDER BY item_code
    `);
    console.log("\n=== CW/GW 품목 목록 ===");
    r1.rows.forEach(r => console.log(`  [${r.item_code}] ${r.item_name} | cat:${r.item_category} | unit:${r.unit} | spec:${r.spec}`));

    // lot_transaction에서 CW/GW lot 확인 (lot_number, unit, qty, length_m 등)
    const lotCols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='lot_transaction' ORDER BY ordinal_position`);
    console.log("\nlot_transaction 컬럼:", lotCols.rows.map(r=>r.column_name).join(", "));

    const r2 = await c.query(`
      SELECT lt.lot_number, lt.lot_type, lt.qty, lt.remaining_qty, lt.unit,
             i.item_code, i.item_name, i.spec
      FROM lot_transaction lt
      JOIN item_master i ON i.item_id = lt.item_id
      WHERE lt.lot_number LIKE '%CW%' OR lt.lot_number LIKE '%GW%'
         OR i.item_name LIKE '%세라믹%' OR i.item_name LIKE '%그라스울%'
      ORDER BY lt.lot_number DESC LIMIT 20
    `);
    console.log("\n=== CW/GW LOT 재고 ===");
    r2.rows.forEach(r => console.log(
      `  ${r.lot_number} | ${r.item_name} | spec:${r.spec||'-'} | qty=${r.qty} | remain=${r.remaining_qty} ${r.unit}`
    ));

  } finally { c.release(); await pool.end(); }
})().catch(e => { console.error(e.message); process.exit(1); });
