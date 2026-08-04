const pg = require('pg');

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const { rows } = await pool.query(`
      SELECT
        ncs.id, ncs.item_name, ncs.spec, ncs.lot_number, ncs.qty, ncs.unit,
        COALESCE(ncs.shipment_site_name, '기본 출하 현장') AS shipment_site_name,
        ncs.shipment_order_date,
        ncs.location_id,
        COALESCE(sl.location_code, ncs.rack_code) AS location_code,
        COALESCE(sl.display_name, ncs.rack_code) AS display_name,
        ncs.created_at
      FROM non_certified_stock ncs
      LEFT JOIN storage_locations sl ON sl.location_id = ncs.location_id
      WHERE (ncs.wms_status = 'SHIPMENT_READY' OR ncs.location_id IS NOT NULL OR ncs.rack_code IS NOT NULL)
        AND ncs.status != 'DISPOSED'

      UNION ALL

      SELECT
        al.lot_id AS id,
        COALESCE(al.item_name, al.lot_type, '반제품 조립품') AS item_name,
        '표준규격' AS spec, al.lot_number, COALESCE(al.remaining_qty, al.qty) AS qty, 'EA' AS unit,
        COALESCE(al.staging_location, '조립 현장') AS shipment_site_name,
        al.created_at::date AS shipment_order_date,
        al.location_id,
        COALESCE(sl.location_code, al.staging_location) AS location_code,
        COALESCE(sl.display_name, al.staging_location) AS display_name,
        al.created_at
      FROM assembly_lot al
      LEFT JOIN storage_locations sl ON sl.location_id = al.location_id
      WHERE (al.staging_location IS NOT NULL OR al.location_id IS NOT NULL)
        AND al.status IN ('ACTIVE', 'STOCK', 'COMPLETE')

      ORDER BY shipment_site_name, shipment_order_date, id
    `);
    console.log('✅ shipment-ready-items success! Rows:', rows.length);
  } catch (e) {
    console.error('❌ SQL Error:', e);
  } finally {
    await pool.end();
  }
}

run();
