import pg from 'pg';
const { Client } = pg;

async function test() {
  const client = new Client({
    user: 'postgres.ajncesrkhlusqginyscw',
    password: 'Ezone0300@@@',
    host: 'aws-1-ap-northeast-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });
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
