const pg = require('pg');

// 인정시험용 재고 (공정심사용 - 그라스울 57롤 + 세라믹울 271롤 = 총 328롤)
const auditItems = [
  // 그라스울 공정심사용 (57롤)
  { spec: '24K 25T 1400W 20000L', lot_number: '260716GW001-AUDIT', category: '그라스울', density: 24, thickness: 25, width_mm: 1400, length_mm: 20000, qty: 14, received_date: '2026-07-16' },
  { spec: '24K 25T 1000W 20000L', lot_number: '260402CW002-AUDIT', category: '세라믹울', density: 24, thickness: 25, width_mm: 1000, length_mm: 20000, qty: 3, received_date: '2026-04-02' },
  { spec: '24K 25T 1400W 20000L', lot_number: '260701GW001-AUDIT', category: '그라스울', density: 24, thickness: 25, width_mm: 1400, length_mm: 20000, qty: 25, received_date: '2026-07-01' },
  { spec: '24K 25T 1000W 20000L', lot_number: 'R250923GW001-AUDIT', category: '그라스울', density: 24, thickness: 25, width_mm: 1000, length_mm: 20000, qty: 1, received_date: '2025-09-23' },
  { spec: '24K 25T 1000W 20000L', lot_number: '260402GW002-AUDIT', category: '그라스울', density: 24, thickness: 25, width_mm: 1000, length_mm: 20000, qty: 1, received_date: '2026-04-02' },
  { spec: '24K 25T 1400W 20000L', lot_number: '251120GW001-AUDIT', category: '그라스울', density: 24, thickness: 25, width_mm: 1400, length_mm: 20000, qty: 13, received_date: '2025-11-20' },

  // 세라믹울 공정심사용 (271롤)
  { spec: '104K 50T 600W 3600L', lot_number: '260630CW001-AUDIT', category: '세라믹울', density: 104, thickness: 50, width_mm: 600, length_mm: 3600, qty: 70, received_date: '2026-06-30' },
  { spec: '100K 38T 600W 4800L', lot_number: '260203CW004-AUDIT', category: '세라믹울', density: 100, thickness: 38, width_mm: 600, length_mm: 4800, qty: 29, received_date: '2026-02-03' },
  { spec: '96K 50T 400W 3600L', lot_number: '260610CW002-AUDIT', category: '세라믹울', density: 96, thickness: 50, width_mm: 400, length_mm: 3600, qty: 16, received_date: '2026-06-10' },
  { spec: '104K 50T 600W 3600L', lot_number: 'R260227CW001-AUDIT', category: '세라믹울', density: 104, thickness: 50, width_mm: 600, length_mm: 3600, qty: 2, received_date: '2026-02-27' },
  { spec: '100K 38T 600W 4800L', lot_number: 'R251017CW002-AUDIT', category: '세라믹울', density: 100, thickness: 38, width_mm: 600, length_mm: 4800, qty: 34, received_date: '2025-10-17' },
  { spec: '104K 50T 600W 3600L', lot_number: '260624CW001-AUDIT', category: '세라믹울', density: 104, thickness: 50, width_mm: 600, length_mm: 3600, qty: 81, received_date: '2026-06-24' },
  { spec: '96K 50T 400W 3600L', lot_number: '260203CW007-AUDIT', category: '세라믹울', density: 96, thickness: 50, width_mm: 400, length_mm: 3600, qty: 4, received_date: '2026-02-03' },
  { spec: '96K 25T 200W 7200L', lot_number: '260220CW002-AUDIT', category: '세라믹울', density: 96, thickness: 25, width_mm: 200, length_mm: 7200, qty: 18, received_date: '2026-02-20' },
  { spec: '104K 25T 200W 7400L', lot_number: '260630CW003-AUDIT', category: '세라믹울', density: 104, thickness: 25, width_mm: 200, length_mm: 7400, qty: 17, received_date: '2026-06-30' },
];

async function syncCertifiedAuditAndNonCertifiedStock() {
  const pool = new pg.Pool({
    connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔄 1. Adding stock_type column to material_lots...');
    await pool.query("ALTER TABLE material_lots ADD COLUMN IF NOT EXISTS stock_type VARCHAR(50) DEFAULT 'NON_CERTIFIED'");

    console.log('🔄 2. Syncing CERTIFIED_AUDIT (인정시험용 재고 - 공정심사용)...');
    let auditCount = 0;
    for (const item of auditItems) {
      const { spec, lot_number, qty, category, density, thickness, width_mm, length_mm, received_date } = item;
      
      const res = await pool.query('SELECT lot_id FROM material_lots WHERE lot_number = $1', [lot_number]);
      if (res.rows.length > 0) {
        await pool.query(`
          UPDATE material_lots
          SET item_name = $1, category = $2, density = $3, thickness = $4, width_mm = $5, length_mm = $6,
              qty_current = $7, stock_type = 'CERTIFIED_AUDIT', is_active = TRUE, received_date = $8, updated_at = NOW()
          WHERE lot_number = $9
        `, [spec, category, density, thickness, width_mm, length_mm, qty, received_date, lot_number]);
      } else {
        await pool.query(`
          INSERT INTO material_lots (
            lot_number, category, item_name, density, thickness, width_mm, length_mm, unit, qty_current, received_date, stock_type, is_active
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, '롤', $8, $9, 'CERTIFIED_AUDIT', TRUE
          )
        `, [lot_number, category, spec, density, thickness, width_mm, length_mm, qty, received_date]);
      }
      auditCount++;
    }

    const { rows: summary } = await pool.query(`
      SELECT stock_type, category, COUNT(*) as lot_count, SUM(qty_current) as total_qty
      FROM material_lots
      WHERE is_active = TRUE AND qty_current > 0
      GROUP BY stock_type, category
      ORDER BY stock_type, category
    `);

    console.log('✅ Successfully updated CERTIFIED_AUDIT & NON_CERTIFIED inventory in Supabase!');
    console.table(summary);

    process.exit(0);
  } catch (err) {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  }
}

syncCertifiedAuditAndNonCertifiedStock();
