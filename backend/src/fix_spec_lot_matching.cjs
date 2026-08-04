const pg = require('pg');

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
  ssl: { rejectUnauthorized: false }
});

async function fixMatching() {
  console.log('🔍 Starting comprehensive audit & fix of material_lots spec/LOT matching...\n');

  // Fetch all material_lots
  const { rows } = await pool.query(`SELECT * FROM material_lots ORDER BY lot_id`);

  // Build map of parent lots (e.g. key '260610CW002' -> lot record)
  const parentMap = {};
  for (const r of rows) {
    if (!r.lot_number.includes('-')) {
      parentMap[r.lot_number] = r;
    }
  }

  let updatedCount = 0;

  for (const r of rows) {
    if (r.lot_number.includes('-')) {
      // Extract base parent LOT number (e.g., '260610CW002-A1P2' -> '260610CW002')
      const baseLotNum = r.lot_number.split('-')[0];
      const parent = parentMap[baseLotNum];

      if (parent) {
        // If child lacks spec or item_name is generic '세라믹울', inherit from parent!
        const newDensity = r.density ?? parent.density;
        const newThickness = r.thickness ?? parent.thickness;
        const newWidth = r.width_mm ?? parent.width_mm;
        const newLength = r.length_mm ?? parent.length_mm;

        let newItemName = r.item_name;
        if (!newItemName || newItemName === '세라믹울' || newItemName === '그라스울' || newItemName === '그라스울보드') {
          newItemName = parent.item_name;
        }

        const newCategory = r.category || parent.category;
        const newUnit = r.unit || parent.unit;

        await pool.query(`
          UPDATE material_lots
          SET density = $1, thickness = $2, width_mm = $3, length_mm = $4,
              item_name = $5, category = $6, unit = $7
          WHERE lot_id = $8
        `, [newDensity, newThickness, newWidth, newLength, newItemName, newCategory, newUnit, r.lot_id]);

        updatedCount++;
        console.log(`✅ Fixed child LOT [${r.lot_number}] -> Inherited spec [${newItemName}] (K:${newDensity} T:${newThickness} W:${newWidth} L:${newLength})`);
      }
    }
  }

  console.log(`\n🎉 Total child LOTs fixed and matched: ${updatedCount}`);
  process.exit(0);
}

fixMatching().catch(err => { console.error(err); process.exit(1); });
