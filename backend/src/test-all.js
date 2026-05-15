import pg from 'pg';
const { Client } = pg;

const regions = ['ap-northeast-1', 'ap-northeast-2'];
const pw = 'Ezone0300%40%40%40';

async function testPooler(region) {
  const connectionString = `postgresql://postgres:${pw}@aws-0-${region}.pooler.supabase.com:6543/postgres?options=-c%20search_path%3Dpublic`;
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log(`Success on ${region}!`);
    await client.end();
    return true;
  } catch (e) {
    console.log(`Error on ${region}:`, e.message);
    return false;
  }
}

async function run() {
  for (const r of regions) {
    if (await testPooler(r)) break;
  }
}
run();
