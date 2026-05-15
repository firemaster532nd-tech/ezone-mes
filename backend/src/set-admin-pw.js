import pg from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

async function setAdminPw() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const hash = await bcrypt.hash('admin1234', 10);
    const res = await client.query(`UPDATE worker SET password_hash = $1 WHERE employee_no = 'admin'`, [hash]);
    console.log(`Updated admin password. Rows affected: ${res.rowCount}`);
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await client.end();
  }
}
setAdminPw();
