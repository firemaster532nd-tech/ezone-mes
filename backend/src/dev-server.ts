/**
 * 로컬 개발 서버 - embedded PostgreSQL 포함
 * PostgreSQL 설치 없이 실행 가능
 */
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

async function startDevServer() {
  console.log('🔧 Embedded PostgreSQL 시작 중...');

  const pg = new EmbeddedPostgres({
    databaseDir: path.join(projectRoot, '.pgdata'),
    user: 'ezone',
    password: 'ezone1234',
    port: 5432,
    persistent: true,
  });

  try {
    const pgDataDir = path.join(projectRoot, '.pgdata');
    if (!fs.existsSync(path.join(pgDataDir, 'PG_VERSION'))) {
      await pg.initialise();
    } else {
      console.log('ℹ️  기존 데이터 디렉토리 사용');
    }

    // Check if PostgreSQL is already running (e.g. from a previous session)
    let pgAlreadyRunning = false;
    try {
      const pgLib = await import('pg');
      const testClient = new pgLib.default.Client({
        connectionString: 'postgresql://ezone:ezone1234@localhost:5432/ezone_mes',
      });
      await testClient.connect();
      await testClient.end();
      pgAlreadyRunning = true;
      console.log('ℹ️  PostgreSQL 이미 실행 중 (재사용)');
    } catch {
      // Not running, need to start
    }

    if (!pgAlreadyRunning) {
      await pg.start();
      console.log('✅ PostgreSQL 시작 완료 (port 5432)');
    }

    // DB 생성
    try {
      await pg.createDatabase('ezone_mes');
      console.log('✅ Database ezone_mes 생성 완료');
    } catch {
      console.log('ℹ️  Database ezone_mes 이미 존재');
    }

    // DDL, 인덱스, 시드 실행
    const initDir = path.join(projectRoot, 'docker/postgres/init');
    const sqlFiles = ['01_ddl.sql', '02_indexes.sql', '03_seed.sql'];

    for (const file of sqlFiles) {
      const filePath = path.join(initDir, file);
      if (fs.existsSync(filePath)) {
        const sql = fs.readFileSync(filePath, 'utf-8');
        try {
          // pg 모듈로 직접 실행
          const pgLib = await import('pg');
          const client = new pgLib.default.Client({
            connectionString: 'postgresql://ezone:ezone1234@localhost:5432/ezone_mes',
          });
          await client.connect();
          await client.query(sql);
          await client.end();
          console.log(`✅ ${file} 실행 완료`);
        } catch (e: any) {
          if (e.message?.includes('already exists') || e.code === '42P07' || e.code === '23505') {
            console.log(`ℹ️  ${file} 이미 적용됨 (스킵)`);
          } else {
            console.error(`⚠️  ${file} 실행 오류:`, e.message);
          }
        }
      }
    }

    // 데이터 확인
    const pgLib = await import('pg');
    const client = new pgLib.default.Client({
      connectionString: 'postgresql://ezone:ezone1234@localhost:5432/ezone_mes',
    });
    await client.connect();
    const certCount = await client.query('SELECT COUNT(*) FROM certification_master');
    const itemCount = await client.query('SELECT COUNT(*) FROM item_master');
    const bomCount = await client.query('SELECT COUNT(*) FROM bom_master');
    const ruleCount = await client.query('SELECT COUNT(*) FROM certification_rule');
    console.log(`\n📊 시드 데이터 확인:`);
    console.log(`   인정구조: ${certCount.rows[0].count}건`);
    console.log(`   품목: ${itemCount.rows[0].count}건`);
    console.log(`   BOM: ${bomCount.rows[0].count}건`);
    console.log(`   인정기준: ${ruleCount.rows[0].count}건\n`);
    await client.end();

    // 환경변수 설정 후 메인 서버 시작
    process.env.DATABASE_URL = 'postgresql://ezone:ezone1234@localhost:5432/ezone_mes';
    process.env.PORT = '3000';
    process.env.CORS_ORIGIN = 'http://localhost:5173';

    console.log('🚀 Fastify 서버 시작...');
    await import('./index.js');

    // 종료 시 PostgreSQL 정리 (직접 시작한 경우에만)
    const cleanup = async () => {
      console.log('\n🛑 서버 종료 중...');
      if (!pgAlreadyRunning) {
        await pg.stop();
      }
      process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  } catch (err) {
    console.error('서버 시작 실패:', err);
    try { await pg.stop(); } catch {}
    process.exit(1);
  }
}

startDevServer();
