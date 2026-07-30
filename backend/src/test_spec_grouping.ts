import { pool } from './db/pool.js';

async function testSpecGrouping() {
  const query = `
    SELECT 
      category,
      item_name,
      COALESCE(NULLIF(item_spec, ''), '표준규격') AS item_spec,
      unit,
      SUM(qty_current) AS total_qty_current,
      COUNT(lot_id) AS lot_count,
      STRING_AGG(lot_number, ', ' ORDER BY lot_number) AS lot_numbers,
      STRING_AGG(DISTINCT location, ', ') AS locations,
      CASE WHEN SUM(qty_current) <= 0 THEN TRUE ELSE FALSE END AS is_out_of_stock
    FROM material_lots
    WHERE is_active = TRUE
    GROUP BY category, item_name, COALESCE(NULLIF(item_spec, ''), '표준규격'), unit
    ORDER BY total_qty_current ASC, item_name ASC
  `;
  const { rows } = await pool.query(query);
  console.log('--- ALL ITEM SPECS GROUPED BY SPEC (SUMMED ACROSS ALL LOTS) ---');
  console.table(rows);
  await pool.end();
}

testSpecGrouping().catch(console.error);
