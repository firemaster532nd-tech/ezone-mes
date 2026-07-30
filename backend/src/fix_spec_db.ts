import { pool } from './db/pool.js';

const KNOWN_LOT_SPECS: Record<string, { spec: string; name?: string; density?: number; thickness?: number; width?: number; length?: number }> = {
  '260227CW005': { spec: '25* 150*100K', name: '100K 25T 150W 7400L', density: 100, thickness: 25, width: 150, length: 7400 },
  '260227CW004': { spec: '25* 200*100K', name: '100K 25T 200W 7400L', density: 100, thickness: 25, width: 200, length: 7400 },
  '260203CW001': { spec: '25* 300*100K', name: '100K 25T 300W 7400L', density: 100, thickness: 25, width: 300, length: 7400 },
  '260227CW003': { spec: '25* 300*100K', name: '100K 25T 300W 7400L', density: 100, thickness: 25, width: 300, length: 7400 },
  '260203CW004': { spec: '38* 600*100K', name: '100K 38T 600W 4800L', density: 100, thickness: 38, width: 600, length: 4800 },
  '260203CW002': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
  '260514CW002': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
  '260722CW001': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
  '260630CW002': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
  '260203CW003': { spec: '25* 150*96K',  name: '96K 25T 150W 7400L',  density: 96,  thickness: 25, width: 150, length: 7400 },
  '260203CW005': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
  '260203CW006': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
  '260203CW007': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
  '260203CW008': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
  '260610CW002': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
  '260630CW001': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
  '260630CW003': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
  '260722CW003': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
  '260402GW002': { spec: '96K 50T 500W 1000L', name: '그라스울 96K', density: 96, thickness: 50, width: 500, length: 1000 },
  '251001GW001': { spec: '48K 50T 500W 1000L', name: '그라스울보드 48K', density: 48, thickness: 50, width: 500, length: 1000 }
};

async function fixDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('1. Adding item_spec column if not exists...');
    await client.query('ALTER TABLE material_lots ADD COLUMN IF NOT EXISTS item_spec VARCHAR(200)');

    const { rows: lots } = await client.query('SELECT * FROM material_lots');
    console.log(`Found ${lots.length} rows in material_lots.`);

    for (const lot of lots) {
      let lotNo = lot.lot_number;
      let rackLoc = lot.location;

      // 랙 위치 접미사 제거 및 순수 LOT 정리 (예: 260203CW001-N1P2 -> 260203CW001, location = N1-P2)
      const rackSuffixMatch = lotNo.match(/^([a-zA-Z0-9]+)-([A-Z][0-9][P][12])$/);
      if (rackSuffixMatch) {
        const baseLot = rackSuffixMatch[1];
        const rawRack = rackSuffixMatch[2];
        const formattedRack = `${rawRack.substring(0, 2)}-${rawRack.substring(2)}`;
        console.log(`Cleaning Suffix LOT: ${lotNo} -> Base: ${baseLot}, Rack: ${formattedRack}`);

        const { rows: baseRows } = await client.query(
          'SELECT * FROM material_lots WHERE lot_number = $1 AND is_active = TRUE AND lot_id != $2 LIMIT 1',
          [baseLot, lot.lot_id]
        );

        if (baseRows.length > 0) {
          const baseId = baseRows[0].lot_id;
          await client.query(
            'UPDATE material_lots SET qty_current = qty_current + $1, location = $2, updated_at = NOW() WHERE lot_id = $3',
            [Number(lot.qty_current || 0), formattedRack, baseId]
          );
          await client.query('UPDATE material_lots SET is_active = FALSE WHERE lot_id = $1', [lot.lot_id]);
          continue;
        } else {
          lotNo = baseLot;
          rackLoc = formattedRack;
        }
      }

      const basePrefix = lotNo.split('-')[0];
      const specData = KNOWN_LOT_SPECS[basePrefix] || KNOWN_LOT_SPECS[lotNo];

      let item_spec = lot.item_spec;
      let item_name = lot.item_name;
      let density = lot.density;
      let thickness = lot.thickness;
      let width_mm = lot.width_mm;
      let length_mm = lot.length_mm;

      if (specData) {
        item_spec = item_spec || specData.spec;
        if (!item_name || item_name === '세라믹울' || item_name === '그라스울') {
          item_name = specData.name || item_name;
        }
        density = density || specData.density;
        thickness = thickness || specData.thickness;
        width_mm = width_mm || specData.width;
        length_mm = length_mm || specData.length;
      }

      if (!item_spec || item_spec.trim() === '' || item_spec === '-') {
        if (lotNo.includes('CW')) item_spec = '25* 200*128K';
        else if (lotNo.includes('GW')) item_spec = '96K 50T';
        else item_spec = '표준규격';
      }

      await client.query(`
        UPDATE material_lots SET
          lot_number = $1,
          item_name = COALESCE($2, item_name),
          item_spec = $3,
          density = COALESCE($4, density),
          thickness = COALESCE($5, thickness),
          width_mm = COALESCE($6, width_mm),
          length_mm = COALESCE($7, length_mm),
          location = COALESCE($8, location),
          updated_at = NOW()
        WHERE lot_id = $9
      `, [lotNo, item_name, item_spec, density, thickness, width_mm, length_mm, rackLoc, lot.lot_id]);
    }

    await client.query('COMMIT');
    console.log('✅ DB Migration completed successfully! ALL item_spec columns populated!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

fixDatabase();
