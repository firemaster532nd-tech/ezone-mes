import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('--- Workers List ---');
  const workers = await client.query(
    "SELECT worker_id, employee_no, worker_name, phone, role, is_active, must_change_pw, COALESCE(allowed_modes, 'shop') as allowed_modes, CASE WHEN password_hash IS NULL THEN 'NO' ELSE 'YES' END as has_hash FROM worker ORDER BY role, employee_no"
  );
  
  for (const w of workers.rows) {
    console.log(`${w.employee_no} | ${w.worker_name} | Role: ${w.role} | Active: ${w.is_active} | MustChangePW: ${w.must_change_pw} | AllowedModes: ${w.allowed_modes} | HasHash: ${w.has_hash} | Phone: ${w.phone}`);
  }

  await client.end();
}
run().catch(console.error);
