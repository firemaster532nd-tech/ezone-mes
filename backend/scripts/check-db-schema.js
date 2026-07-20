import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('--- incoming_inspection_preset columns ---');
  const cols1 = await client.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'incoming_inspection_preset'`
  );
  console.table(cols1.rows);

  console.log('\n--- inspection_preset_item columns ---');
  const cols2 = await client.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'inspection_preset_item'`
  );
  console.table(cols2.rows);

  await client.end();
}
run().catch(console.error);
