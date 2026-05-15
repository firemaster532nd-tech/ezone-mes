import pg from 'pg';
import 'dotenv/config';
const { Client } = pg;

async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const tables = ['worker', 'item_master', 'work_order', 'sales_order', 'lot_transaction', 'inspection', 'bom_master', 'process_bom'];
    for (const t of tables) {
      const colRes = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${t}'`);
      if (colRes.rowCount === 0) { console.log(`Table ${t} not found in Supabase`); continue; }
      console.log(`\nTable: ${t}`);
      console.log(colRes.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
    }
  } catch (e) {
    console.log(e.message);
  } finally {
    await client.end();
  }
}
check();
