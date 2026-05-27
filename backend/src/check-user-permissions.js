import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

async function check() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    console.log('--- ALL WORKERS ---');
    const workers = await client.query(`
      SELECT w.worker_id, w.worker_name, w.employee_no, w.role, w.dept_id, d.dept_name, d.dept_code
      FROM worker w
      LEFT JOIN department d ON w.dept_id = d.dept_id
      ORDER BY w.worker_id
    `);
    console.log(workers.rows);

    console.log('--- ALL MENUS ---');
    const menus = await client.query(`
      SELECT menu_id, menu_code, menu_name, path, parent_menu_id, is_active
      FROM menu
      ORDER BY menu_id
    `);
    console.log(menus.rows);

    console.log('--- EFFECTIVE PERMISSIONS FOR MASTER_COMPANIES ---');
    const perms = await client.query(`
      SELECT ep.worker_id, w.worker_name, w.employee_no, ep.can_read, ep.can_write
      FROM effective_permission ep
      JOIN worker w ON ep.worker_id = w.worker_id
      WHERE ep.menu_code = 'MASTER_COMPANIES'
      ORDER BY ep.worker_id
    `);
    console.log(perms.rows);

  } catch (e) {
    console.log(e.message);
  } finally {
    await client.end();
  }
}
check();
