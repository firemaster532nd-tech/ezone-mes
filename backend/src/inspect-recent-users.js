import { pool } from './db/pool.js';

async function run() {
  const { rows } = await pool.query('SELECT worker_id, employee_no, worker_name, role, dept_id, is_active FROM worker ORDER BY worker_id ASC');
  console.log('WORKERS IN DB:', rows);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
