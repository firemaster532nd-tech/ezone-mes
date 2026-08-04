const pg = require('pg');

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  // Update all material_lots where stock_type is NULL or 'NON_CERTIFIED' to 'CERTIFIED'
  const res1 = await pool.query(`
    UPDATE material_lots
    SET stock_type = 'CERTIFIED'
    WHERE stock_type IS NULL OR stock_type = 'NON_CERTIFIED' OR stock_type = ''
  `);
  console.log('✅ Updated material_lots stock_type to CERTIFIED:', res1.rowCount);

  // Check counts by stock_type
  const counts = await pool.query(`
    SELECT COALESCE(stock_type, 'NULL') AS stock_type, count(*)
    FROM material_lots
    GROUP BY stock_type
  `);
  console.log('✅ Current material_lots breakdown by stock_type:', counts.rows);

  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
