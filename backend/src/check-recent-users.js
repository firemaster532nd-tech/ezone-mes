import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

async function check() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    console.log('--- RECENTLY LOGGED IN WORKERS ---');
    const workers = await client.query(`
      SELECT worker_id, worker_name, employee_no, role, dept_id, last_login_at
      FROM worker
      WHERE last_login_at IS NOT NULL
      ORDER BY last_login_at DESC
      LIMIT 10
    `);
    console.log(workers.rows);

    if (workers.rows.length > 0) {
      const activeWorker = workers.rows[0];
      console.log(`\n--- ALL EFFECTIVE PERMISSIONS FOR '${activeWorker.worker_name}' (${activeWorker.worker_id}) ---`);
      const perms = await client.query(`
        SELECT menu_code, path, can_read, can_write
        FROM effective_permission
        WHERE worker_id = $1 AND can_read = TRUE
        ORDER BY menu_code
      `, [activeWorker.worker_id]);
      console.log(perms.rows);
    }

  } catch (e) {
    console.log(e.message);
  } finally {
    await client.end();
  }
}
check();
