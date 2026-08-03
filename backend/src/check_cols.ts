import { pool } from './db/pool.js';

async function main() {
  const tables = ['struct_work_order_item'];
  for (const tableName of tables) {
    const colRes = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [tableName]);
    console.log(`\nTable: ${tableName}`);
    colRes.rows.forEach(c => {
      console.log(`  - ${c.column_name} (${c.data_type}, nullable: ${c.is_nullable})`);
    });
  }
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});





