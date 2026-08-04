const pg = require('pg');

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
  ssl: { rejectUnauthorized: false }
});

async function runAudit() {
  const { rows } = await pool.query(`
    SELECT lot_id, lot_number, category, item_name, density, thickness, width_mm, length_mm, unit, qty_current, location, stock_type, created_at
    FROM material_lots
    ORDER BY category, lot_number
  `);

  console.log(`📊 Total material_lots records in DB: ${rows.length}\n`);

  const categoryGroups = {};
  for (const r of rows) {
    const cat = r.category || '미분류';
    if (!categoryGroups[cat]) categoryGroups[cat] = [];
    categoryGroups[cat].push(r);
  }

  for (const [cat, items] of Object.entries(categoryGroups)) {
    console.log(`========================================`);
    console.log(`📁 카테고리: [ ${cat} ] (${items.length}개 LOT)`);
    console.log(`========================================`);
    for (const item of items) {
      console.log(`ID:${item.lot_id} | LOT:${item.lot_number} | 품목명:${item.item_name} | K:${item.density} T:${item.thickness} W:${item.width_mm} L:${item.length_mm} | 재고:${item.qty_current}${item.unit} | 구분:${item.stock_type} | 위치:${item.location}`);
    }
    console.log('\n');
  }

  process.exit(0);
}

runAudit().catch(err => { console.error(err); process.exit(1); });
