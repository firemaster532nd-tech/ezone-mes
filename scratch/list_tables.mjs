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
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('Tables:', rows.map(r => r.table_name).join(', '));

  // Let's also print details of inspection-related tables if they exist
  for (const t of ['incoming_inspection_preset', 'inspection_preset_item', 'inspection', 'inspection_detail', 'inspection_criteria']) {
    try {
      const colRes = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [t]);
      if (colRes.rows.length > 0) {
        console.log(`\nTable: ${t}`);
        colRes.rows.forEach(c => {
          console.log(`  - ${c.column_name} (${c.data_type}, nullable: ${c.is_nullable})`);
        });
      }
    } catch (e) {
      console.log(`Failed to inspect ${t}: ${e.message}`);
    }
  }

  await pool.end();
}

main().catch(console.error);
