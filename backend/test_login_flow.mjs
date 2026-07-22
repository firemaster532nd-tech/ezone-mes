import pg from 'pg';
import { hashPassword, verifyPassword } from './dist/lib/password.js';
import { signToken } from './dist/lib/jwt.js';

const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function testFullLoginFlow() {
  try {
    const employee_no = 'admin';
    const password = 'admin'; // 사용자 입력

    console.log('--- 1. SELECT worker ---');
    const { rows } = await pool.query(
      `SELECT worker_id, employee_no, worker_name, password_hash, role, dept_id, is_active, must_change_pw,
              COALESCE(allowed_modes, 'shop') as allowed_modes
       FROM worker WHERE employee_no = $1`,
      [employee_no],
    );
    const w = rows[0];
    console.log('Worker row:', w);

    if (!w) throw new Error('user_not_found');

    console.log('--- 2. verifyPassword ---');
    let ok = await verifyPassword(password, w.password_hash);
    console.log('1차 검증:', ok);

    if (!ok && /^\d{10,11}$/.test(password)) {
      const formattedPhone = password.length === 11 
        ? `${password.slice(0, 3)}-${password.slice(3, 7)}-${password.slice(7)}`
        : `${password.slice(0, 3)}-${password.slice(3, 6)}-${password.slice(6)}`;
      ok = await verifyPassword(formattedPhone, w.password_hash);
      console.log('폰번호 검증:', ok);
    }

    console.log('--- 3. UPDATE last_login_at ---');
    await pool.query(`UPDATE worker SET last_login_at = NOW() WHERE worker_id = $1`, [w.worker_id]);

    console.log('--- 4. signToken ---');
    const token = signToken({
      worker_id: w.worker_id,
      employee_no: w.employee_no,
      role: w.role,
      dept_id: w.dept_id,
    });
    console.log('Token generated successfully:', token.slice(0, 25) + '...');

  } catch (err) {
    console.error('❌ Login flow Error:', err);
  } finally {
    await pool.end();
  }
}

testFullLoginFlow();
