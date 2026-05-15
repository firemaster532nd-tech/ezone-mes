import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

async function importData() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const data = JSON.parse(fs.readFileSync(path.join(projectRoot, 'legacy_data.json'), 'utf-8'));
  
  try {
    await client.connect();

    const tablesToMigrate = [
      'item_master',
      'worker',
      'certification_master',
      'certification_rule',
      'bom_master',
      'compounding_recipe',
      'compounding_recipe_item',
      'process_bom',
      'process_bom_item',
      'sales_order',
      'sales_order_item',
      'purchase_request',
      'purchase_request_item',
      'order_bom_result',
      'work_order',
      'lot_transaction',
      'inspection'
    ];

    for (const t of [...tablesToMigrate].reverse()) {
      try {
        await client.query(`TRUNCATE TABLE ${t} CASCADE`);
      } catch (e) { }
    }

    let totalImported = 0;

    for (const t of tablesToMigrate) {
      const rows = data[t];
      if (!rows || rows.length === 0) continue;

      // Get valid columns for destination table
      const colRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${t}'`);
      const validCols = new Set(colRes.rows.map(r => r.column_name));

      for (let r of rows) {
        if (t === 'item_master') {
          if (r.spec && r.spec.length > 100) r.spec = r.spec.substring(0, 97) + '...';
          if (r.item_name && r.item_name.length > 80) r.item_name = r.item_name.substring(0, 77) + '...';
          if (r.roll_spec && r.roll_spec.length > 100) r.roll_spec = r.roll_spec.substring(0, 97) + '...';
        }

        // Only include keys that exist in the destination table
        const filteredKeys = [];
        const filteredValues = [];
        for (const [k, v] of Object.entries(r)) {
          if (validCols.has(k)) {
            filteredKeys.push(k);
            filteredValues.push(v);
          }
        }

        const placeholders = filteredKeys.map((_, i) => `$${i + 1}`).join(', ');
        
        try {
          await client.query(
            `INSERT INTO ${t} (${filteredKeys.join(', ')}) VALUES (${placeholders})`,
            filteredValues
          );
          totalImported++;
        } catch (e) {
          console.log(`Failed to insert into ${t}:`, e.message);
        }
      }
    }
    
    // Reset sequences
    for (const t of tablesToMigrate) {
      try {
        const res = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${t}' AND ordinal_position = 1`);
        if (res.rows.length > 0) {
          const pk = res.rows[0].column_name;
          await client.query(`SELECT setval(pg_get_serial_sequence('${t}', '${pk}'), COALESCE(MAX(${pk}), 1)) FROM ${t}`);
        }
      } catch (e) {}
    }

    console.log(`✅ Successfully imported ${totalImported} rows.`);
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await client.end();
  }
}
importData();
