import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

async function check() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    console.log('--- SCANNING ALL ACTIVE WORKERS FOR PERMISSIONS ---');
    const workers = await client.query(`SELECT worker_id, worker_name, role, employee_no FROM worker WHERE is_active = TRUE`);
    
    for (const w of workers.rows) {
      const perms = await client.query(`
        SELECT menu_code, path, can_read 
        FROM effective_permission 
        WHERE worker_id = $1 AND can_read = TRUE
      `, [w.worker_id]);
      
      const paths = perms.rows.map(p => p.path).filter(Boolean);
      console.log(`Worker '${w.worker_name}' (${w.worker_id}, role: ${w.role}, employee_no: ${w.employee_no}):`);
      console.log(`  - Read paths count: ${paths.length}`);
      if (paths.includes('/master/items')) {
        console.log(`  - Has '/master/items'`);
      }
      if (paths.includes('/master/companies')) {
        console.log(`  - Has '/master/companies'`);
      }
    }

  } catch (e) {
    console.log(e.message);
  } finally {
    await client.end();
  }
}
check();
