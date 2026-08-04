const pg = require('pg');

const items = [
  { spec: '100K 25T 150W 7400L', lot_number: '260227CW005', qty: 104, category: '세라믹울', density: 100, thickness: 25, width_mm: 150, length_mm: 7400, received_date: '2026-02-27' },
  { spec: '104K 25T 200W 7400L', lot_number: '260630CW003', qty: 356, category: '세라믹울', density: 104, thickness: 25, width_mm: 200, length_mm: 7400, received_date: '2026-06-30' },
  { spec: '104K 25T 200W 7400L', lot_number: '260722CW003', qty: 600, category: '세라믹울', density: 104, thickness: 25, width_mm: 200, length_mm: 7400, received_date: '2026-07-22' },
  { spec: '100K 25T 300W 7400L', lot_number: '260203CW001', qty: 200, category: '세라믹울', density: 100, thickness: 25, width_mm: 300, length_mm: 7400, received_date: '2026-02-03' },
  { spec: '100K 25T 300W 7400L', lot_number: '260227CW003', qty: 118, category: '세라믹울', density: 100, thickness: 25, width_mm: 300, length_mm: 7400, received_date: '2026-02-27' },
  { spec: '100K 38T 600W 4800L', lot_number: '260203CW004', qty: 166, category: '세라믹울', density: 100, thickness: 38, width_mm: 600, length_mm: 4800, received_date: '2026-02-03' },
  { spec: '96K 50T 400W 3600L', lot_number: '260203CW007', qty: 11, category: '세라믹울', density: 96, thickness: 50, width_mm: 400, length_mm: 3600, received_date: '2026-02-03' },
  { spec: '96K 50T 400W 3600L', lot_number: '260610CW002', qty: 172, category: '세라믹울', density: 96, thickness: 50, width_mm: 400, length_mm: 3600, received_date: '2026-06-10' },
  { spec: '104K 50T 400W 3600L', lot_number: '260730CW002', qty: 100, category: '세라믹울', density: 104, thickness: 50, width_mm: 400, length_mm: 3600, received_date: '2026-07-30' },
  { spec: '96K 50T 600W 3600L', lot_number: '260722CW003', qty: 98, category: '세라믹울', density: 96, thickness: 50, width_mm: 600, length_mm: 3600, received_date: '2026-07-22' },
  { spec: '104K 50T 600W 3600L', lot_number: '260630CW001', qty: 152, category: '세라믹울', density: 104, thickness: 50, width_mm: 600, length_mm: 3600, received_date: '2026-06-30' },
  { spec: '104K 50T 400W 3600L', lot_number: '260730CW001', qty: 450, category: '세라믹울', density: 104, thickness: 50, width_mm: 400, length_mm: 3600, received_date: '2026-07-30' },
  { spec: '128K 25T 200W 7400L', lot_number: '260630CW002', qty: 382, category: '세라믹울', density: 128, thickness: 25, width_mm: 200, length_mm: 7400, received_date: '2026-06-30' },
  { spec: '128K 25T 200W 7400L', lot_number: '260722CW002', qty: 825, category: '세라믹울', density: 128, thickness: 25, width_mm: 200, length_mm: 7400, received_date: '2026-07-22' },
  { spec: '24K 25T 1400W 20000L', lot_number: '260716GW001', qty: 14, category: '그라스울', density: 24, thickness: 25, width_mm: 1400, length_mm: 20000, received_date: '2026-07-16' },
  { spec: '24K 25T 1000W 20000L', lot_number: '260402GW002', qty: 2, category: '그라스울', density: 24, thickness: 25, width_mm: 1000, length_mm: 20000, received_date: '2026-04-02' },
  { spec: '24K 25T 1400W 20000L', lot_number: '260701GW001', qty: 60, category: '그라스울', density: 24, thickness: 25, width_mm: 1400, length_mm: 20000, received_date: '2026-07-01' },
  { spec: '24K 25T 1000W 20000L', lot_number: 'R250923GW001', qty: 3, category: '그라스울', density: 24, thickness: 25, width_mm: 1000, length_mm: 20000, received_date: '2025-09-23' },
  { spec: '24K 25T 1400W 20000L', lot_number: '260402GW002', qty: 4, category: '그라스울', density: 24, thickness: 25, width_mm: 1400, length_mm: 20000, received_date: '2026-04-02' },
  { spec: '24K 25T 1000W 20000L', lot_number: '260402CW002', qty: 1, category: '세라믹울', density: 24, thickness: 25, width_mm: 1000, length_mm: 20000, received_date: '2026-04-02' },
  { spec: '24K 25T 1400W 20000L', lot_number: '251120GW001', qty: 13, category: '그라스울', density: 24, thickness: 25, width_mm: 1400, length_mm: 20000, received_date: '2025-11-20' },
  { spec: '96K 25T 150W 3600L', lot_number: '260203CW003', qty: 40, category: '세라믹울', density: 96, thickness: 25, width_mm: 150, length_mm: 3600, received_date: '2026-02-03' },
  { spec: '96K 38T 150W 3600L', lot_number: '260203CW005', qty: 40, category: '세라믹울', density: 96, thickness: 38, width_mm: 150, length_mm: 3600, received_date: '2026-02-03' },
  { spec: '96K 25T 150W 3600L', lot_number: '260203CW008', qty: 60, category: '세라믹울', density: 96, thickness: 25, width_mm: 150, length_mm: 3600, received_date: '2026-02-03' },
  { spec: '96K 50T 600W 3600L', lot_number: 'RR251017CW001', qty: 4, category: '세라믹울', density: 96, thickness: 50, width_mm: 600, length_mm: 3600, received_date: '2025-10-17' },
  { spec: '96K 50T 600W 3600L', lot_number: 'R251230CW001', qty: 18, category: '세라믹울', density: 96, thickness: 50, width_mm: 600, length_mm: 3600, received_date: '2025-12-30' },
  { spec: '96K 50T 150W 3600L', lot_number: '260203CW006', qty: 10, category: '세라믹울', density: 96, thickness: 50, width_mm: 150, length_mm: 3600, received_date: '2026-02-03' },
  { spec: '24K 25T 1400W 20000L', lot_number: 'R260220GW001', qty: 4, category: '그라스울', density: 24, thickness: 25, width_mm: 1400, length_mm: 20000, received_date: '2026-02-20' },
  { spec: '104K 50T 600W 3600L', lot_number: 'R260227CW001', qty: 2, category: '세라믹울', density: 104, thickness: 50, width_mm: 600, length_mm: 3600, received_date: '2026-02-27' },
  { spec: '100K 38T 600W 4800L', lot_number: 'R251017CW002', qty: 34, category: '세라믹울', density: 100, thickness: 38, width_mm: 600, length_mm: 4800, received_date: '2025-10-17' },
  { spec: '104K 50T 600W 3600L', lot_number: '260624CW001', qty: 81, category: '세라믹울', density: 104, thickness: 50, width_mm: 600, length_mm: 3600, received_date: '2026-06-24' },
  { spec: '96K 25T 200W 7200L', lot_number: '260220CW002', qty: 18, category: '세라믹울', density: 96, thickness: 25, width_mm: 200, length_mm: 7200, received_date: '2026-02-20' },
];

async function syncInventory() {
  const pool = new pg.Pool({
    connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔄 Starting Google Sheets inventory sync to Supabase PostgreSQL...');
    
    // 1. 기존 과거 가짜/임시 0수량 재고 비활성화 또는 0 처리
    await pool.query("UPDATE material_lots SET qty_current = 0 WHERE category IN ('세라믹울', '그라스울', '그라스울보드')");

    let count = 0;
    for (const item of items) {
      const { spec, lot_number, qty, category, density, thickness, width_mm, length_mm, received_date } = item;
      
      const checkRes = await pool.query('SELECT lot_id FROM material_lots WHERE lot_number = $1', [lot_number]);
      
      if (checkRes.rows.length > 0) {
        await pool.query(`
          UPDATE material_lots
          SET item_name = $1, category = $2, density = $3, thickness = $4, width_mm = $5, length_mm = $6,
              qty_current = $7, is_active = TRUE, received_date = $8, updated_at = NOW()
          WHERE lot_number = $9
        `, [spec, category, density, thickness, width_mm, length_mm, qty, received_date, lot_number]);
      } else {
        await pool.query(`
          INSERT INTO material_lots (
            lot_number, category, item_name, density, thickness, width_mm, length_mm, unit, qty_current, received_date, is_active
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, '롤', $8, $9, TRUE
          )
        `, [lot_number, category, spec, density, thickness, width_mm, length_mm, qty, received_date]);
      }
      count++;
    }

    const { rows: summary } = await pool.query(`
      SELECT category, COUNT(*) as active_lots, SUM(qty_current) as total_qty
      FROM material_lots
      WHERE is_active = TRUE AND qty_current > 0
      GROUP BY category
    `);

    console.log(`✅ Successfully synced ${count} inventory LOT items from Google Sheets!`);
    console.log('📊 Updated Active Inventory Summary:');
    console.table(summary);

    process.exit(0);
  } catch (err) {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  }
}

syncInventory();
