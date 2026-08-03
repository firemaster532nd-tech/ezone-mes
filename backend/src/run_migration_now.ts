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

    // Sprint 1-1: inspection_criteria, inspection, inspection_detail 테이블 확장
    console.log('Adding inspection columns...');
    await pool.query(`ALTER TABLE inspection_criteria ADD COLUMN IF NOT EXISTS decimal_places INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE inspection ADD COLUMN IF NOT EXISTS is_outlier BOOLEAN DEFAULT FALSE`);
    await pool.query(`ALTER TABLE inspection ADD COLUMN IF NOT EXISTS outlier_reason TEXT`);
    await pool.query(`ALTER TABLE inspection_detail ADD COLUMN IF NOT EXISTS is_outlier BOOLEAN DEFAULT FALSE`);
    await pool.query(`ALTER TABLE inspection_detail ADD COLUMN IF NOT EXISTS outlier_reason TEXT`);

    // 시드 데이터 자릿수 업데이트
    console.log('Updating inspection_criteria decimal_places seed...');
    await pool.query(`
      UPDATE inspection_criteria 
      SET decimal_places = 3 
      WHERE item_name IN ('D101 난연컴파운드', 'D102 팽창흑연', 'D103 EVA', 'D104 EP100')
    `);
    await pool.query(`
      UPDATE inspection_criteria 
      SET decimal_places = 2 
      WHERE item_name = 'FN테크 슬리브 (FN-P100)'
    `);
    await pool.query(`
      UPDATE inspection_criteria 
      SET decimal_places = 3 
      WHERE item_name = '보호철판 (MS/BS)'
    `);

    console.log('Migration completed successfully.');
  } catch (err: any) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

main();

