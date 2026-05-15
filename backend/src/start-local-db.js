import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

const pg = new EmbeddedPostgres({
  databaseDir: path.join(projectRoot, '.pgdata'),
  user: 'ezone',
  password: 'ezone_password123',
  port: 5433
});

async function run() {
  await pg.start();
  console.log('Local DB started on port 5433');
}
run();
