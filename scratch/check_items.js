import pkg from 'pg';
const { Pool } = pkg;
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : undefined
});

async function main() {
  const { rows } = await pool.query('SELECT item_id, item_code, item_name, spec, item_category, unit FROM item_master WHERE is_active = true ORDER BY item_category, item_code');
  const outputPath = path.resolve(__dirname, 'items_db.json');
  fs.writeFileSync(outputPath, JSON.stringify(rows, null, 2), 'utf-8');
  console.log('Saved item master to items_db.json successfully.');
  await pool.end();
}

main().catch(console.error);
