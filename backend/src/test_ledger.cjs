const pg = require('pg');

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const date_from = '2026-08-01';
  const date_to = '2026-08-04';
  const category = '원자재(배합원료)';

  const params = [date_from, date_to];
  let catFilter = '';
  if (category) {
    params.push(category);
    catFilter = `AND ml.category=$${params.length}`;
  }

  const sql = `
    WITH date_series AS (
      SELECT generate_series($1::date, $2::date, '1 day')::date AS d
    ),
    lot_dates AS (
      SELECT DISTINCT mt.lot_id, ds.d AS txn_date
      FROM material_transactions mt
      JOIN date_series ds ON mt.txn_date <= ds.d
      WHERE mt.txn_date BETWEEN ($1::date - INTERVAL '1 year') AND $2::date
    ),
    daily AS (
      SELECT
        mt.lot_id,
        mt.txn_date,
        COALESCE(SUM(mt.qty) FILTER (WHERE mt.txn_type='IN'),  0) AS qty_in,
        COALESCE(SUM(ABS(mt.qty)) FILTER (WHERE mt.txn_type='OUT'), 0) AS qty_out,
        COALESCE(SUM(mt.qty) FILTER (WHERE mt.txn_type='ADJ'), 0) AS qty_adj
      FROM material_transactions mt
      WHERE mt.txn_date BETWEEN $1::date AND $2::date
      GROUP BY mt.lot_id, mt.txn_date
    )
    SELECT
      ld.txn_date,
      ml.lot_id,
      ml.lot_number,
      ml.category,
      ml.item_name,
      ml.density,
      ml.thickness,
      ml.width_mm,
      ml.length_mm,
      ml.unit,
      ml.location,
      ml.qty_current,
      COALESCE(d.qty_in,  0) AS qty_in,
      COALESCE(d.qty_out, 0) AS qty_out,
      COALESCE(d.qty_adj, 0) AS qty_adj
    FROM lot_dates ld
    JOIN material_lots ml ON ml.lot_id = ld.lot_id AND ml.is_active = TRUE
    LEFT JOIN daily d ON d.lot_id = ld.lot_id AND d.txn_date = ld.txn_date
    WHERE (d.qty_in IS NOT NULL OR d.qty_out IS NOT NULL OR d.qty_adj IS NOT NULL
           OR ld.txn_date = $2::date)
      ${catFilter}
    ORDER BY ld.txn_date DESC, ml.category, ml.lot_number
  `;

  try {
    const { rows } = await pool.query(sql, params);
    console.log('✅ Query with category success! Rows count:', rows.length);
  } catch (err) {
    console.error('❌ Category Query Error:', err);
  } finally {
    await pool.end();
  }
}

run();
