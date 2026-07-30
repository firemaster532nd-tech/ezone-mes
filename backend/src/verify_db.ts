import { pool } from './db/pool.js';

async function verify() {
  const { rows } = await pool.query("SELECT lot_id, lot_number, item_name, item_spec, location, qty_current FROM material_lots WHERE is_active = TRUE ORDER BY lot_number");
  console.log(`Active Clean LOTs Count: ${rows.length}`);
  console.table(rows);
  await pool.end();
}

verify().catch(console.error);
