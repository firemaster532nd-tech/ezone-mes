import { pool } from './db/pool.js';

async function run() {
  const { rows } = await pool.query('SELECT worker_id, worker_name, employee_no, password_hash IS NOT NULL as has_password, role FROM worker');
  console.log('WORKERS PASSWORD STATUS:', rows);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
