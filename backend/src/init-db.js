import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });


const { Client } = pg;
const projectRoot = path.resolve(__dirname, '../..');

const connectionString = process.env.DATABASE_URL;

async function initDb() {
  console.log('Connecting to Supabase...');
  console.log('Using connection string:', connectionString);
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected!');

    const initDir = path.join(projectRoot, 'docker/postgres/init');
    const sqlFiles = ['01_ddl.sql', '02_indexes.sql', '03_seed.sql', '04_rbac.sql', '05_company_statement.sql', '06_quotations.sql', '07_project_deliveries.sql'];

    for (const file of sqlFiles) {
      const filePath = path.join(initDir, file);
      if (fs.existsSync(filePath)) {
        console.log(`Executing ${file}...`);
        const sql = fs.readFileSync(filePath, 'utf-8');
        try {
          await client.query(sql);
          console.log(`✅ ${file} executed successfully.`);
        } catch (e) {
          if (e.message?.includes('already exists') || e.code === '42P07' || e.code === '23505') {
            console.log(`ℹ️  ${file} already applied (skipping).`);
          } else {
            console.error(`⚠️  Error in ${file}:`, e.message);
          }
        }
      } else {
        console.log(`File not found: ${filePath}`);
      }
    }
  } catch (err) {
    console.error('Connection or execution error:', err);
  } finally {
    await client.end();
    console.log('Disconnected.');
  }
}

initDb();
