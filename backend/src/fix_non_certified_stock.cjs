const pg = require('pg');

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
  ssl: { rejectUnauthorized: false }
});

async function fixNcs() {
  console.log('🔍 Fixing category & specs in non_certified_stock table...\n');

  // Update items with '인정심사용_' in item_name to category = '인정시험용'
  const res1 = await pool.query(`
    UPDATE non_certified_stock
    SET category = '인정시험용'
    WHERE item_name LIKE '인정심사용%' OR category = '비인정'
  `);
  console.log('✅ Updated non_certified_stock categories to 인정시험용:', res1.rowCount);

  // Assign default spec based on item_name if spec is null
  const res2 = await pool.query(`
    UPDATE non_certified_stock
    SET spec = CASE
      WHEN item_name LIKE '%세라믹울%' THEN '100K 25T'
      WHEN item_name LIKE '%그라스울%' THEN '24K 25T'
      WHEN item_name LIKE '%강판%' THEN '1.6T'
      WHEN item_name LIKE '%미네랄울%' THEN '100K 50T'
      WHEN item_name LIKE '%시트%' THEN '2T 1000W'
      ELSE '표준규격'
    END
    WHERE spec IS NULL
  `);
  console.log('✅ Updated null specs in non_certified_stock:', res2.rowCount);

  process.exit(0);
}

fixNcs().catch(err => { console.error(err); process.exit(1); });
