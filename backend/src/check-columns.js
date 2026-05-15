import pg from 'pg';
const { Client } = pg;

async function check() {
  const client = new Client({ connectionString: 'postgresql://ezone@localhost:5433/ezone_mes' });
  try {
    await client.connect();
    const res = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    const tables = res.rows.map(r => r.tablename);
    for (const t of tables) {
      const colRes = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${t}'`);
      console.log(`\nTable: ${t}`);
      console.log(colRes.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
    }
  } catch (e) {
    console.log(e.message);
  } finally {
    await client.end();
  }
}
check();
