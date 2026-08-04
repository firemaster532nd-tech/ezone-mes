const pg = require('pg');

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
  ssl: { rejectUnauthorized: false }
});

async function inspectCwGw() {
  const { rows } = await pool.query(`
    SELECT lot_id, lot_number, category, item_name, qty_current, unit, location, stock_type, notes, created_at
    FROM material_lots
    WHERE category IN ('세라믹울', '그라스울', '그라스울보드')
    ORDER BY category, qty_current DESC
  `);

  console.log(`================================================================`);
  console.log(`📊 세라믹울 / 그라스울 재고 수량 전수 분석 (${rows.length}건)`);
  console.log(`================================================================\n`);

  for (const r of rows) {
    if (Number(r.qty_current) > 0) {
      console.log(`[${r.category}] LOT: ${r.lot_number} | 품목: ${r.item_name} | 수량: ${r.qty_current}${r.unit} | 구분: ${r.stock_type} | 위치: ${r.location} | 비고: ${r.notes || '-'}`);
    }
  }

  process.exit(0);
}

inspectCwGw().catch(err => { console.error(err); process.exit(1); });
