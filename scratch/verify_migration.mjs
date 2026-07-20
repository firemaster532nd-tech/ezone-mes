import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    const txCnt = await client.query('SELECT count(*)::int as cnt FROM inventory_transaction');
    const lotCnt = await client.query('SELECT count(*)::int as cnt FROM lot_transaction');
    console.log(`=== DB 총 레코드 수 ===`);
    console.log(`inventory_transaction: ${txCnt.rows[0].cnt}개`);
    console.log(`lot_transaction: ${lotCnt.rows[0].cnt}개`);

    const samples = await client.query(`
      SELECT inv_id, item_id, lot_id, txn_type, txn_date::text, qty, purpose 
      FROM inventory_transaction 
      ORDER BY inv_id DESC 
      LIMIT 10
    `);
    console.table(samples.rows);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
