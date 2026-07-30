import { pool } from './db/pool.js';

async function main() {
  const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'material_lots'");
  console.log('Columns in material_lots:');
  console.log(res.rows);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
