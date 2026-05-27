import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

async function check() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    console.log('--- MASTER MENUS IN DATABASE ---');
    const menus = await client.query(`
      SELECT menu_id, menu_code, path FROM menu WHERE menu_code IN ('MASTER_ITEMS', 'MASTER_CERTS', 'MASTER_BOM', 'MASTER_COMPANIES')
    `);
    console.log(menus.rows);

    console.log('--- EFFECTIVE PERMISSIONS MATRIX FOR WORKERS ---');
    const res = await client.query(`
      SELECT 
        w.worker_name, 
        w.employee_no,
        w.role,
        d.dept_code,
        MAX(CASE WHEN ep.menu_code = 'MASTER_ITEMS' THEN ep.can_read::int END)::boolean as items_read,
        MAX(CASE WHEN ep.menu_code = 'MASTER_COMPANIES' THEN ep.can_read::int END)::boolean as companies_read,
        MAX(CASE WHEN ep.menu_code = 'MASTER_CERTS' THEN ep.can_read::int END)::boolean as certs_read,
        MAX(CASE WHEN ep.menu_code = 'MASTER_BOM' THEN ep.can_read::int END)::boolean as bom_read
      FROM worker w
      LEFT JOIN department d ON w.dept_id = d.dept_id
      LEFT JOIN effective_permission ep ON ep.worker_id = w.worker_id
      GROUP BY w.worker_id, w.worker_name, w.employee_no, w.role, d.dept_code
      ORDER BY w.worker_id
    `);
    console.log(res.rows);

  } catch (e) {
    console.log(e.message);
  } finally {
    await client.end();
  }
}
check();
