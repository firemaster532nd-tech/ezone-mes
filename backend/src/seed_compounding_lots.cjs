const pg = require('pg');

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
  ssl: { rejectUnauthorized: false }
});

async function initCompoundingLots() {
  const lots = [
    { lot_number: '260804EP001', category: '원자재(배합원료)', item_name: 'EP-100 (EP100)', qty_current: 1000, unit: 'kg', location: 'RAW-A1' },
    { lot_number: '260804GR001', category: '원자재(배합원료)', item_name: '팽창흑연 (흑연)', qty_current: 500, unit: 'kg', location: 'RAW-A2' },
    { lot_number: '260804EA001', category: '원자재(배합원료)', item_name: 'EA-33045 (EA33045)', qty_current: 300, unit: 'kg', location: 'RAW-A3' },
    { lot_number: '260804MB001', category: '원자재(배합원료)', item_name: '난연컴파운드 (MB)', qty_current: 1000, unit: 'kg', location: 'RAW-B1' },
  ];

  for (const l of lots) {
    const existing = await pool.query('SELECT lot_id FROM material_lots WHERE lot_number = $1', [l.lot_number]);
    if (existing.rows.length > 0) {
      await pool.query('UPDATE material_lots SET qty_current = $2, item_name = $3, category = $4, is_active = TRUE WHERE lot_number = $1', [l.lot_number, l.qty_current, l.item_name, l.category]);
    } else {
      await pool.query(`
        INSERT INTO material_lots (lot_number, category, item_name, qty_current, unit, location, is_active, stock_type, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE, 'NON_CERTIFIED', NOW())
      `, [l.lot_number, l.category, l.item_name, l.qty_current, l.unit, l.location]);
    }
  }

  console.log('✅ Seeded 4 compounding raw material LOTs into Supabase DB!');
  process.exit(0);
}

initCompoundingLots().catch(err => { console.error(err); process.exit(1); });
