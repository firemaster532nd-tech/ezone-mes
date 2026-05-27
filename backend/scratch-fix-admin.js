import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query("UPDATE worker SET employee_no = 'admin' WHERE worker_name = '관리자'");
  console.log('Updated employee_no. Rows affected:', res.rowCount);
  await client.end();
}
run().catch(console.error);
