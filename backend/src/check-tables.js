import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

async function check() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const res = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    console.log(res.rows.map(r => r.tablename));
  } catch (e) {
    console.log(e.message);
  } finally {
    await client.end();
  }
}
check();
