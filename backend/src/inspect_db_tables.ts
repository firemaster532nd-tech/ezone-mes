import { pool } from './db/pool.js';

async function main() {
  try {
    const daily = await pool.query('SELECT * FROM fn_daily_production ORDER BY prod_date DESC, prod_id DESC LIMIT 30');
    console.log('--- fn_daily_production (Recent 30) ---');
    console.table(daily.rows);

    const tx = await pool.query('SELECT * FROM fn_stock_tx ORDER BY created_at DESC LIMIT 30');
    console.log('--- fn_stock_tx (Recent 30) ---');
    console.table(tx.rows);

    // Check for duplicates in fn_daily_production
    const dupProd = await pool.query(`
      SELECT prod_date, item_name, spec, prod_type, COUNT(*) as cnt
      FROM fn_daily_production
      GROUP BY prod_date, item_name, spec, prod_type
      HAVING COUNT(*) > 1
    `);
    console.log('--- Duplicate rows in fn_daily_production ---');
    console.table(dupProd.rows);

    // Check for duplicates in fn_finished_stock
    const dupFinished = await pool.query(`
      SELECT diameter_mm, spec, COUNT(*) as cnt
      FROM fn_finished_stock
      GROUP BY diameter_mm, spec
      HAVING COUNT(*) > 1
    `);
    console.log('--- Duplicate rows in fn_finished_stock ---');
    console.table(dupFinished.rows);


  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
