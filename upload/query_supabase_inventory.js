// MES Supabase DB 재고 조회 (.env.prod 사용)
const { Pool } = require('pg');
const fs = require('fs');

// .env.prod 파일 파싱
const envContent = fs.readFileSync('.env.prod', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
  }
});

const connectionString = envVars['DATABASE_URL'];
if (!connectionString) {
  console.error('DATABASE_URL not found in .env.prod');
  process.exit(1);
}

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log('=== MES Supabase material_lots 전체 재고 ===');
  
  const r = await pool.query(`
    SELECT category, item_name, 
           COALESCE(density::text,'') as density,
           COALESCE(thickness::text,'') as thickness,
           COALESCE(width_mm::text,'') as width_mm,
           COALESCE(length_mm::text,'') as length_mm,
           unit, 
           ROUND(qty_current::numeric, 1) as qty_current, 
           lot_number, location
    FROM material_lots
    WHERE is_active = TRUE
    ORDER BY category, item_name, lot_number
  `);
  
  r.rows.forEach(row => console.log(JSON.stringify(row)));
  console.log('\n총 LOT 수:', r.rowCount);
  
  console.log('\n=== 카테고리/품목별 합산 재고 ===');
  const r2 = await pool.query(`
    SELECT category, item_name, 
           ROUND(SUM(qty_current)::numeric, 1) as total_qty, 
           COUNT(*) as lot_count
    FROM material_lots
    WHERE is_active = TRUE
    GROUP BY category, item_name
    ORDER BY category, item_name
  `);
  r2.rows.forEach(row => console.log(JSON.stringify(row)));
  
  await pool.end();
}

main().catch(e => {
  console.error('DB 오류:', e.message);
  pool.end();
});
