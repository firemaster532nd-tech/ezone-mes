// MES DB 재고 조회
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL 
});

async function main() {
  console.log('=== 현재 MES material_lots 재고 (qty_current > 0) ===');
  const r = await pool.query(`
    SELECT category, item_name, density, thickness, width_mm, length_mm, unit, 
           ROUND(qty_current::numeric, 1) as qty_current, lot_number, location
    FROM material_lots
    WHERE is_active = TRUE
    ORDER BY category, item_name, lot_number
    LIMIT 100
  `);
  
  r.rows.forEach(row => console.log(JSON.stringify(row, null, 0)));
  console.log('\n총 LOT 수:', r.rowCount);
  
  // 카테고리별 합산
  const r2 = await pool.query(`
    SELECT category, item_name, SUM(qty_current) as total_qty, COUNT(*) as lot_count
    FROM material_lots
    WHERE is_active = TRUE
    GROUP BY category, item_name
    ORDER BY category, item_name
  `);
  console.log('\n=== 카테고리/품목별 합산 ===');
  r2.rows.forEach(row => console.log(JSON.stringify(row, null, 0)));
  
  await pool.end();
}

main().catch(e => {
  console.error('DB 오류:', e.message);
  pool.end();
});
