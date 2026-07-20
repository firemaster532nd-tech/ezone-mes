import pkg from 'pg';
const { Pool } = pkg;
import path from 'path';
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
  const { rows } = await pool.query(`
    SELECT lt.lot_number, lt.qty, lt.remaining_qty, im.item_code, im.item_name
    FROM lot_transaction lt
    JOIN item_master im ON im.item_id = lt.item_id
    WHERE im.item_code LIKE 'FP-FN-%' OR im.item_code = 'SM-FN'
    ORDER BY im.item_code
  `);
  console.log('--- 에프엔테크 품목 DB 적재 데이터 내역 ---');
  console.log(rows);
  await pool.end();
}

main().catch(console.error);
