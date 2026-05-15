import pg from 'pg';
const { Client } = pg;
const connectionString = 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';

async function test() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Success IPv4 Pooler!');
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await client.end();
  }
}
test();
