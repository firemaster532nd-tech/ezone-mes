import { pool } from './db/pool.js';

async function fixGlasswoolAndCeramicwool() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('1. Correcting Glass Wool (그라스울) & Glass Wool Board (그라스울보드) specs in material_lots...');
    
    // 260402GW002: 그라스울 (24K 50T 1000W 10L)
    await client.query(`
      UPDATE material_lots SET
        item_name = '그라스울 24K',
        item_spec = '24K 50T 1000W',
        density = 24,
        thickness = 50,
        width_mm = 1000,
        length_mm = 10000,
        updated_at = NOW()
      WHERE lot_number LIKE '%GW%' AND (item_spec LIKE '%96K%' OR item_name LIKE '%96K%')
    `);

    // 251001GW001: 그라스울보드 (48K 50T 500W 1000L)
    await client.query(`
      UPDATE material_lots SET
        item_name = '그라스울보드 48K',
        item_spec = '48K 50T 500W 1000L',
        density = 48,
        thickness = 50,
        width_mm = 500,
        length_mm = 1000,
        updated_at = NOW()
      WHERE lot_number = '251001GW001'
    `);

    // Ensure 200폭, 400폭, 600폭 128K Ceramic Wool LOTs exist or are properly categorized for shortage alerts
    console.log('2. Verifying Ceramic Wool 128K target specs (200폭, 400폭, 600폭)...');
    
    // Check if 400폭 128K LOT exists; if missing, seed a standard master LOT record for alert tracking
    const { rows: cw400 } = await client.query(`SELECT * FROM material_lots WHERE item_spec LIKE '%400*128K%' OR item_spec LIKE '%400W%128K%' OR item_spec = '25* 400*128K'`);
    if (cw400.length === 0) {
      console.log('Seeding baseline LOT for 세라믹울 128K 400폭 (25* 400*128K)...');
      await client.query(`
        INSERT INTO material_lots (lot_number, category, item_name, item_spec, density, thickness, width_mm, length_mm, unit, qty_current, location, received_date, notes, is_active)
        VALUES ('260203CW009', '세라믹울', '128K 25T 400W 7400L', '25* 400*128K', 128, 25, 400, 7400, '롤', 0, 'R1-P2', CURRENT_DATE, '400폭 128K 기초재고 알림용', TRUE)
      `);
    }

    // Check if 600폭 128K LOT exists; if missing, seed a baseline LOT record
    const { rows: cw600 } = await client.query(`SELECT * FROM material_lots WHERE item_spec LIKE '%600*128K%' OR item_spec LIKE '%600W%128K%' OR item_spec = '25* 600*128K'`);
    if (cw600.length === 0) {
      console.log('Seeding baseline LOT for 세라믹울 128K 600폭 (25* 600*128K)...');
      await client.query(`
        INSERT INTO material_lots (lot_number, category, item_name, item_spec, density, thickness, width_mm, length_mm, unit, qty_current, location, received_date, notes, is_active)
        VALUES ('260203CW010', '세라믹울', '128K 25T 600W 7400L', '25* 600*128K', 128, 25, 600, 7400, '롤', 0, 'M2-P1', CURRENT_DATE, '600폭 128K 기초재고 알림용', TRUE)
      `);
    }

    await client.query('COMMIT');
    console.log('✅ Glass Wool & Ceramic Wool Spec Cleanup Completed!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error during cleanup:', err);
  } finally {
    client.release();
    pool.end();
  }
}

fixGlasswoolAndCeramicwool();
