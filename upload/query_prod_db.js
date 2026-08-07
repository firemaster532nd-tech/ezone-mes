// Supabase production DB 재고 조회
const fs = require('fs');
const { Pool } = require('pg');

const content = fs.readFileSync('.env.prod.real', 'utf8');
const lines = content.split('\n');
const dbLine = lines.find(l => l.startsWith('DATABASE_URL'));

if (!dbLine) {
  console.log('DATABASE_URL not found. Available vars:');
  lines.filter(l => l && !l.startsWith('#') && l.includes('=')).forEach(l => console.log(l.split('=')[0]));
  process.exit(1);
}

const url = dbLine.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
console.log('DB URL prefix:', url.substring(0, 35) + '...');

const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function main() {
  // 1. 카테고리별 합산
  console.log('\n=== 카테고리/품목별 합산 재고 ===');
  const r1 = await pool.query(`
    SELECT category, item_name, 
           ROUND(SUM(qty_current)::numeric, 1) as total_qty, 
           COUNT(*) as lot_count
    FROM material_lots
    WHERE is_active = TRUE
    GROUP BY category, item_name
    ORDER BY category, item_name
  `);
  r1.rows.forEach(row => console.log(JSON.stringify(row)));
  
  // 2. 전체 LOT 목록
  console.log('\n=== 전체 LOT 목록 (qty_current 포함) ===');
  const r2 = await pool.query(`
    SELECT lot_number, category, item_name, density, thickness, width_mm, length_mm, unit, 
           ROUND(qty_current::numeric, 1) as qty_current, location, received_date
    FROM material_lots
    WHERE is_active = TRUE
    ORDER BY category, received_date DESC
  `);
  r2.rows.forEach(row => console.log(JSON.stringify(row)));
  console.log('\n총 LOT 수:', r2.rowCount);
  
  await pool.end();
}

main().catch(e => {
  console.error('오류:', e.message);
  pool.end();
});
