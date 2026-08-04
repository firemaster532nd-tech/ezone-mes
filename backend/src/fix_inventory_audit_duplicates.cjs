const pg = require('pg');

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
  ssl: { rejectUnauthorized: false }
});

async function fixInventoryDuplicates() {
  console.log('🔧 Starting inventory stock & category correction...\n');

  // 1. 24K Glass Wool miscategorized under Ceramic Wool -> Change to '그라스울'
  const res1 = await pool.query(`
    UPDATE material_lots
    SET category = '그라스울'
    WHERE item_name LIKE '24K%' AND category = '세라믹울'
  `);
  console.log('✅ 1. Moved 24K Glass Wool items from 세라믹울 -> 그라스울:', res1.rowCount);

  // 2. Set stock_type = 'CERTIFIED_AUDIT' for items with notes containing '인정심사'
  const res2 = await pool.query(`
    UPDATE material_lots
    SET stock_type = 'CERTIFIED_AUDIT'
    WHERE notes LIKE '%인정심사%' OR lot_number LIKE '%-AUDIT'
  `);
  console.log('✅ 2. Updated stock_type to CERTIFIED_AUDIT for audit items & -AUDIT lots:', res2.rowCount);

  // 3. Adjust double-counted parent LOT quantities where -AUDIT lot exists with identical/split qty
  // For exact duplicates where parent and -AUDIT have identical qty (e.g. 260624CW001 81 & 260624CW001-AUDIT 81):
  // The parent LOT represents the total, and -AUDIT is the audit portion.
  // Or parent CERTIFIED qty = (Total - Audit qty).
  const { rows: auditLots } = await pool.query(`
    SELECT lot_id, lot_number, qty_current, category
    FROM material_lots
    WHERE lot_number LIKE '%-AUDIT'
  `);

  let countAdjusted = 0;
  for (const aLot of auditLots) {
    const parentLotNum = aLot.lot_number.replace('-AUDIT', '');
    const aQty = Number(aLot.qty_current || 0);

    const { rows: parentRows } = await pool.query(`
      SELECT lot_id, lot_number, qty_current
      FROM material_lots
      WHERE lot_number = $1
    `, [parentLotNum]);

    if (parentRows.length > 0) {
      const parent = parentRows[0];
      const pQty = Number(parent.qty_current || 0);

      // If parent and audit LOT have exact same quantity (e.g. 81 and 81), the parent lot was double-entered.
      // We zero out or deduct audit portion from parent lot so total sum equals real stock!
      if (pQty === aQty && pQty > 0) {
        // e.g. parent lot was 81, audit lot is 81 -> set parent lot to 0 or deduct
        await pool.query(`UPDATE material_lots SET qty_current = 0 WHERE lot_id = $1`, [parent.lot_id]);
        console.log(`✅ Deducted duplicate parent LOT [${parent.lot_number}] (${pQty} -> 0) because -AUDIT LOT [${aLot.lot_number}] holds the ${aQty} audit stock`);
        countAdjusted++;
      } else if (pQty > aQty && aQty > 0) {
        const newParentQty = pQty - aQty;
        await pool.query(`UPDATE material_lots SET qty_current = $1 WHERE lot_id = $2`, [newParentQty, parent.lot_id]);
        console.log(`✅ Adjusted parent LOT [${parent.lot_number}] (${pQty} -> ${newParentQty}) subtracting -AUDIT stock [${aLot.lot_number}] (${aQty})`);
        countAdjusted++;
      }
    }
  }

  console.log(`\n🎉 Total LOT quantities adjusted: ${countAdjusted}`);
  process.exit(0);
}

fixInventoryDuplicates().catch(err => { console.error(err); process.exit(1); });
