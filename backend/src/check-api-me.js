import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

async function check() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    const worker_id = 6;
    const [userRes, permRes] = await Promise.all([
      client.query(
        `SELECT w.worker_id, w.employee_no, w.worker_name, w.role, w.dept_id, d.dept_code, d.dept_name
         FROM worker w LEFT JOIN department d ON d.dept_id = w.dept_id
         WHERE w.worker_id = $1`,
        [worker_id],
      ),
      client.query(
        `SELECT menu_code, path, can_read, can_write, can_update, can_delete
         FROM effective_permission WHERE worker_id = $1`,
        [worker_id],
      ),
    ]);
    
    console.log('--- USER DATA ---');
    console.log(userRes.rows[0]);
    
    console.log('--- PERMISSIONS DATA ---');
    console.log(permRes.rows.filter(p => p.path && p.path.includes('companies')));
    console.log(permRes.rows.filter(p => p.path && p.path.includes('items')));

  } catch (e) {
    console.log(e.message);
  } finally {
    await client.end();
  }
}
check();
