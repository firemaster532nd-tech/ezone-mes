import { pool } from './db/pool.js';

async function checkCols() {
  const { rows } = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'purchase_order'");
  console.log('purchase_order columns:');
  console.table(rows);
  await pool.end();
}

checkCols().catch(console.error);
