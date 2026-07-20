import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : undefined
});

const newPassword = 'edwardchoi76@';

async function main() {
  console.log('--- 관리자 비밀번호 변경 시작 ---');
  
  // 비밀번호 해싱
  const hash = await bcrypt.hash(newPassword, 10);
  console.log(`해싱 완료: ${hash}`);

  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE worker 
       SET password_hash = $1, is_active = true 
       WHERE employee_no = 'admin' 
       RETURNING worker_id, worker_name, employee_no`,
      [hash]
    );

    if (res.rows.length === 0) {
      console.error('❌ DB에서 admin 계정을 찾을 수 없습니다.');
    } else {
      console.log(`🎉 성공적으로 '${res.rows[0].worker_name}' (${res.rows[0].employee_no})의 비밀번호가 변경되었습니다!`);
    }
  } catch (err) {
    console.error('❌ 비밀번호 갱신 중 에러 발생:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
