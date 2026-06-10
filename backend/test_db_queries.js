import pg from 'pg';
const { Pool } = pg;
const p = new Pool({
  connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres'
});

async function main() {
  try {
    const workers = await p.query("SELECT * FROM worker");
    console.log('=== WORKERS ===');
    console.log(JSON.stringify(workers.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await p.end();
  }
}

main();
