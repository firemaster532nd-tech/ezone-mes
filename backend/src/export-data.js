import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

async function exportData() {
  const client = new Client({ connectionString: 'postgresql://ezone@localhost:5433/ezone_mes' });
  try {
    await client.connect();
    const res = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    const tables = res.rows.map(r => r.tablename);
    const data = {};
    for (const t of tables) {
      const cntRes = await client.query(`SELECT count(*) as c FROM ${t}`);
      const count = parseInt(cntRes.rows[0].c, 10);
      if (count > 0) {
        const rowsRes = await client.query(`SELECT * FROM ${t}`);
        data[t] = rowsRes.rows;
      }
    }
    fs.writeFileSync(path.join(projectRoot, 'legacy_data.json'), JSON.stringify(data, null, 2));
    console.log('✅ Data exported successfully to legacy_data.json');
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await client.end();
  }
}
exportData();
