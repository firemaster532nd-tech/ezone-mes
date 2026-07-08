import { pool } from './db/pool.js';

async function main() {
  try {
    console.log('Running database migrations...');
    await pool.query(`ALTER TABLE fn_finished_stock ADD COLUMN IF NOT EXISTS qty_semi INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE fn_daily_production ADD COLUMN IF NOT EXISTS prod_type VARCHAR(10) DEFAULT 'FINISHED'`);
    await pool.query(`DROP INDEX IF EXISTS uq_fn_daily`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_fn_daily ON fn_daily_production(prod_date, item_name, spec, prod_type)`);
    
    await pool.query(`
      INSERT INTO fn_material_stock (item_name, spec, qty, unit) VALUES
        ('소켓','100파이',0,'ea'),
        ('소켓','75파이',0,'ea'),
        ('소켓','50파이',0,'ea')
      ON CONFLICT (item_name, spec) DO NOTHING
    `);
    console.log('Migration completed successfully.');
  } catch (err: any) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

main();
