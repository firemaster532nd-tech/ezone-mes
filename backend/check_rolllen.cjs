const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
  ssl: { rejectUnauthorized: false }
});
(async () => {
  const c = await pool.connect();
  try {
    // roll_length_m 컬럼 데이터 확인
    const r = await c.query(`
      SELECT item_code, item_name, unit, roll_length_m, roll_spec, spec
      FROM item_master
      WHERE item_code LIKE 'SM-CW%' OR item_code LIKE 'SM-GW%'
         OR item_name LIKE '%세라믹%' OR item_name LIKE '%그라스울%'
      ORDER BY item_code
    `);
    console.log("=== roll_length_m 현황 ===");
    r.rows.forEach(row => console.log(
      `  [${row.item_code}] ${row.item_name} | unit=${row.unit} | roll_length_m=${row.roll_length_m} | roll_spec=${row.roll_spec}`
    ));
  } finally { c.release(); await pool.end(); }
})().catch(e => { console.error(e.message); process.exit(1); });
