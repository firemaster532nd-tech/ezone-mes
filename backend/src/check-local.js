import pg from 'pg';
const { Client } = pg;

async function check() {
  const client = new Client({ connectionString: 'postgresql://ezone@localhost:5433/ezone_mes' });
  try {
    await client.connect();
    const res = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    const tables = res.rows.map(r => r.tablename);
    let totalRows = 0;
    for (const t of tables) {
      const cntRes = await client.query(`SELECT count(*) as c FROM ${t}`);
      const count = parseInt(cntRes.rows[0].c, 10);
      if (count > 0) {
        console.log(`Table ${t}: ${count} rows`);
        totalRows += count;
      }
    }
    console.log(`Total rows: ${totalRows}`);
  } catch (e) {
    console.log(e.message);
  } finally {
    await client.end();
  }
}
check();
