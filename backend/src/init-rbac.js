import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

async function runRbac() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const sql = fs.readFileSync(path.join(projectRoot, 'docker/postgres/init/04_rbac.sql'), 'utf-8');
    await client.query(sql);
    console.log('✅ 04_rbac.sql executed successfully.');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await client.end();
  }
}
runRbac();
