import pg from 'pg';
const { Client } = pg;
const connectionString = 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres';

async function test() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Success Pooler!');
    await client.query('SELECT 1');
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await client.end();
  }
}
test();
