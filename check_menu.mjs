import pg from './node_modules/pg/lib/index.js';
const { Pool } = pg;
const pool = new Pool({ host:'127.0.0.1', port:54322, user:'ezone', password:'ezone1234', database:'ezone_mes', max:2 });
try {
  const r = await pool.query("SELECT employee_no, role, must_change_pw, LEFT(password_hash,20) as hash_prefix FROM worker WHERE role='admin' LIMIT 3");
  console.log('ADMINS:', JSON.stringify(r.rows));
  const r2 = await pool.query("SELECT m.menu_code, m.path, COUNT(dp.dept_perm_id) as dept_count FROM menu m LEFT JOIN department_permission dp ON dp.menu_id=m.menu_id AND dp.can_read=TRUE WHERE m.menu_code IN ('INVENTORY_LABEL_REPRINT','INVENTORY_LOCATION','SHIPMENT_STAGING') GROUP BY m.menu_code, m.path");
  console.log('MENU_PERMS:', JSON.stringify(r2.rows));
  const r3 = await pool.query("SELECT ep.path, ep.can_read FROM effective_permission ep JOIN worker w ON w.worker_id=ep.worker_id WHERE w.role='admin' AND ep.path IN ('/inventory/label-reprint','/inventory/location','/shipment/staging') LIMIT 10");
  console.log('EFF_PERM:', JSON.stringify(r3.rows));
} finally { await pool.end(); }
