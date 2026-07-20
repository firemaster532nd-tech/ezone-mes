import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    const itemsRes = await client.query(`
      SELECT item_id, item_code, item_name, item_category, unit
      FROM item_master
      WHERE item_code LIKE '%50%' OR item_name LIKE '%50%'
      ORDER BY item_code
    `);
    console.log('=== item_master 50 관련 품목 ===');
    console.table(itemsRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
