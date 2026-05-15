import pg from 'pg';
const { Client } = pg;
const connectionString = 'postgresql://postgres:Ezone0300%40%40%40@[2406:da14:1d62:b401:1b96:fe54:58c2:c623]:5432/postgres';

async function test() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Success IPv6!');
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await client.end();
  }
}
test();
