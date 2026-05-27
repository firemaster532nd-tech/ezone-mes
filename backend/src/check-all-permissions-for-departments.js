import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

async function check() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    console.log('--- ALL RECORDS IN department_permission ---');
    const res = await client.query(`
      SELECT d.dept_code, m.menu_code, dp.can_read
      FROM department_permission dp
      JOIN department d ON dp.dept_id = d.dept_id
      JOIN menu m ON dp.menu_id = m.menu_id
      ORDER BY d.dept_code, m.menu_code
    `);
    console.log(res.rows);

  } catch (e) {
    console.log(e.message);
  } finally {
    await client.end();
  }
}
check();
