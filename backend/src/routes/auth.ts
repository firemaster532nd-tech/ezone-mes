import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signToken } from '../lib/jwt.js';
import { requireAuth, requireRole } from '../lib/auth-plugin.js';

const loginSchema = z.object({
  employee_no: z.string().min(1).max(20),
  password: z.string().min(1).max(100),
});

const createUserSchema = z.object({
  employee_no: z.string().max(20).optional().or(z.literal('')),
  worker_name: z.string().min(1).max(50),
  password: z.string().min(1).max(100),
  dept_id: z.number().int().positive(),
  role: z.enum(['admin', 'manager', 'worker']).default('worker'),
  position: z.string().max(50).optional().or(z.literal('')),
  // 빈 문자열 전송 시 undefined 로 처리 — Zod .email() 검증 오류 방지
  email: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.string().email().optional()
  ),
  phone: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.string().max(30).optional()
  ),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(4).max(100),
});

export function validatePassword(password: string): string | null {
  if (!/[a-z]/.test(password)) {
    return '비밀번호에는 영어 소문자가 반드시 포함되어야 합니다.';
  }
  if (!/\d/.test(password)) {
    return '비밀번호에는 숫자가 반드시 포함되어야 합니다.';
  }
  if (!/[\W_]/.test(password)) {
    return '비밀번호에는 특수문자가 반드시 포함되어야 합니다.';
  }
  if (/(\d)\1\1/.test(password)) {
    return '비밀번호에 3개 이상의 반복된 숫자(예: 111)를 사용할 수 없습니다.';
  }
  for (let i = 0; i < password.length - 2; i++) {
    const c1 = password.charCodeAt(i);
    const c2 = password.charCodeAt(i + 1);
    const c3 = password.charCodeAt(i + 2);
    if (c1 >= 48 && c1 <= 57 && c2 >= 48 && c2 <= 57 && c3 >= 48 && c3 <= 57) {
      if ((c2 === c1 + 1 && c3 === c2 + 1) || (c2 === c1 - 1 && c3 === c2 - 1)) {
        return '비밀번호에 3개 이상의 연속된 숫자(예: 123, 321)를 사용할 수 없습니다.';
      }
    }
  }
  return null;
}

export async function ensureAdminUser() {
  const res = await pool.query("SELECT worker_id, password_hash FROM worker WHERE employee_no = 'admin'");
  if (res.rows.length === 0) {
    const deptRes = await pool.query("SELECT dept_id FROM department WHERE dept_code = 'ADMIN'");
    const deptId = deptRes.rows[0]?.dept_id || 1;
    const hash = await hashPassword('admin1234');
    await pool.query(
      `INSERT INTO worker (worker_name, employee_no, password_hash, dept_id, role, position, is_active, must_change_pw)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      ['시스템 관리자', 'admin', hash, deptId, 'admin', '시스템 관리자', true, true]
    );
    console.log('✅ Default admin user successfully created at startup.');
  } else {
    const admin = res.rows[0];
    if (!admin.password_hash) {
      const hash = await hashPassword('admin1234');
      await pool.query(
        `UPDATE worker SET password_hash = $1 WHERE worker_id = $2`,
        [hash, admin.worker_id]
      );
      console.log('✅ Default admin password hash initialized at startup.');
    }
  }
}

export async function initializeWorkerPasswords() {
  const { rows } = await pool.query(
    `SELECT worker_id, phone FROM worker 
     WHERE role <> 'admin' AND phone IS NOT NULL AND password_hash IS NULL`
  );
  for (const r of rows) {
    if (!r.phone) continue;
    const phonePassword = r.phone.trim();
    if (phonePassword) {
      const hash = await hashPassword(phonePassword);
      await pool.query(
        `UPDATE worker SET password_hash = $1, must_change_pw = TRUE, updated_at = NOW() WHERE worker_id = $2`,
        [hash, r.worker_id]
      );
    }
  }
}

export async function authRoutes(app: FastifyInstance) {
  // 서버 시작 시 admin 계정 보장 및 아직 패스워드가 세팅되지 않은 비관리자 계정들의 초기 비밀번호를 휴대폰 번호로 세팅
  // allowed_modes 콜럼 마이그레이션
  await pool.query(`
    ALTER TABLE worker ADD COLUMN IF NOT EXISTS allowed_modes VARCHAR(10) DEFAULT 'shop';
  `).catch(() => {});

  // 세분류 마스터 테이블 생성 (쿼리 1)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS item_subcategory_master (
      subcategory_id   SERIAL PRIMARY KEY,
      item_category    VARCHAR(10) NOT NULL,
      subcategory_name VARCHAR(100) NOT NULL,
      sort_order       INT DEFAULT 0,
      is_active        BOOLEAN DEFAULT TRUE,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (item_category, subcategory_name)
    )
  `).catch((err: unknown) => console.error('[Migration] CREATE item_subcategory_master:', err));

  // 기존 item_master 에서 세분류 시드 (쿼리 2 - 분리 필수)
  await pool.query(`
    INSERT INTO item_subcategory_master (item_category, subcategory_name)
    SELECT DISTINCT item_category, item_subcategory
    FROM item_master
    WHERE item_subcategory IS NOT NULL AND item_subcategory <> ''
    ON CONFLICT (item_category, subcategory_name) DO NOTHING
  `).catch((err: unknown) => console.error('[Migration] SEED item_subcategory_master:', err));

  // 구조적 규격 콜럼 추가 (다중 ALTER 단일 쿼리)
  await pool.query(`ALTER TABLE item_master ADD COLUMN IF NOT EXISTS spec_density  VARCHAR(30)`).catch(()=>{});
  await pool.query(`ALTER TABLE item_master ADD COLUMN IF NOT EXISTS spec_thickness VARCHAR(30)`).catch(()=>{});
  await pool.query(`ALTER TABLE item_master ADD COLUMN IF NOT EXISTS spec_width    VARCHAR(30)`).catch(()=>{});
  await pool.query(`ALTER TABLE item_master ADD COLUMN IF NOT EXISTS spec_length   VARCHAR(30)`).catch(()=>{});
  await pool.query(`ALTER TABLE item_master ADD COLUMN IF NOT EXISTS spec_height   VARCHAR(30)`).catch(()=>{});

  await ensureAdminUser().catch((err) => {
    console.error('Failed to ensure admin user:', err);
  });
  await initializeWorkerPasswords().catch((err) => {
    console.error('Failed to initialize worker passwords:', err);
  });

  // POST /api/auth/login  (사번 + 비밀번호)
  app.post('/api/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    const { employee_no, password } = parsed.data;

    const ip = req.ip;
    const ua = req.headers['user-agent'] ?? null;

    const logAttempt = (success: boolean, reason?: string) =>
      pool.query(
        `INSERT INTO login_attempt (employee_no, success, ip_address, user_agent, failure_reason)
         VALUES ($1,$2,$3,$4,$5)`,
        [employee_no, success, ip, ua, reason ?? null],
      ).catch(() => {});

    const { rows } = await pool.query(
      `SELECT worker_id, employee_no, worker_name, password_hash, role, dept_id, is_active, must_change_pw,
              COALESCE(allowed_modes, 'shop') as allowed_modes
       FROM worker WHERE employee_no = $1`,
      [employee_no],
    );
    const w = rows[0];
    if (!w) { logAttempt(false, 'user_not_found'); return reply.code(401).send({ error: 'invalid_credentials' }); }
    if (!w.is_active) { logAttempt(false, 'inactive'); return reply.code(403).send({ error: 'account_disabled' }); }
    if (!w.password_hash) { logAttempt(false, 'no_password'); return reply.code(403).send({ error: 'password_not_set' }); }

    let ok = await verifyPassword(password, w.password_hash);
    
    // 비밀번호가 일치하지 않고, 입력된 비밀번호가 하이픈이 빠진 휴대폰 번호 형식(10~11자리 숫자)인 경우 하이픈을 넣어서 추가 검증 시도
    if (!ok && /^\d{10,11}$/.test(password)) {
      const formattedPhone = password.length === 11 
        ? `${password.slice(0, 3)}-${password.slice(3, 7)}-${password.slice(7)}`
        : `${password.slice(0, 3)}-${password.slice(3, 6)}-${password.slice(6)}`;
      ok = await verifyPassword(formattedPhone, w.password_hash);
    }

    if (!ok) { logAttempt(false, 'bad_password'); return reply.code(401).send({ error: 'invalid_credentials' }); }

    await pool.query(`UPDATE worker SET last_login_at = NOW() WHERE worker_id = $1`, [w.worker_id]);
    logAttempt(true);

    const token = signToken({
      worker_id: w.worker_id,
      employee_no: w.employee_no,
      role: w.role,
      dept_id: w.dept_id,
    });

    return {
      token,
      user: {
        worker_id: w.worker_id,
        employee_no: w.employee_no,
        worker_name: w.worker_name,
        role: w.role,
        dept_id: w.dept_id,
        must_change_pw: w.must_change_pw,
        allowed_modes: w.allowed_modes ?? 'shop',
      },
    };
  });

  // GET /api/auth/me  (현재 로그인한 사용자 + 권한 목록)
  app.get('/api/auth/me', { preHandler: requireAuth }, async (req) => {
    const { worker_id } = req.auth!;
    const [userRes, permRes] = await Promise.all([
      pool.query(
        `SELECT w.worker_id, w.employee_no, w.worker_name, w.role, w.dept_id, w.position, w.email,
                w.must_change_pw, d.dept_code, d.dept_name,
                COALESCE(w.allowed_modes, 'shop') as allowed_modes
         FROM worker w LEFT JOIN department d ON d.dept_id = w.dept_id
         WHERE w.worker_id = $1`,
        [worker_id],
      ),
      pool.query(
        // can_read=TRUE인 권한만 반환 (CROSS JOIN으로 FALSE가 다 포함되는 문제 방지)
        // admin은 effective_permission에서 role='admin'으로 모두 TRUE
        `SELECT menu_code, path, can_read, can_write, can_update, can_delete
         FROM effective_permission
         WHERE worker_id = $1 AND can_read = TRUE`,
        [worker_id],
      ),
    ]);
    if (!userRes.rows[0]) return { error: 'not_found' };
    const u = userRes.rows[0];
    return { user: { ...u, allowed_modes: u.allowed_modes ?? 'shop' }, permissions: permRes.rows };
  });

  // POST /api/auth/change-password
  app.post('/api/auth/change-password', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const { current_password, new_password } = parsed.data;
    const { worker_id } = req.auth!;

    const { rows } = await pool.query(`SELECT password_hash FROM worker WHERE worker_id = $1`, [worker_id]);
    if (!rows[0]?.password_hash) return reply.code(404).send({ error: 'no_password_set' });

    let ok = await verifyPassword(current_password, rows[0].password_hash);
    
    // 현재 임시 비밀번호가 일치하지 않고, 입력된 값인 하이픈이 빠진 휴대폰 번호 형식(10~11자리 숫자)인 경우 하이픈을 넣어서 추가 검증 시도
    if (!ok && /^\d{10,11}$/.test(current_password)) {
      const formattedPhone = current_password.length === 11 
        ? `${current_password.slice(0, 3)}-${current_password.slice(3, 7)}-${current_password.slice(7)}`
        : `${current_password.slice(0, 3)}-${current_password.slice(3, 6)}-${current_password.slice(6)}`;
      ok = await verifyPassword(formattedPhone, rows[0].password_hash);
    }

    if (!ok) return reply.code(401).send({ error: 'wrong_current_password' });

    const pwErr = validatePassword(new_password);
    if (pwErr) return reply.code(400).send({ error: 'invalid_password_complexity', message: pwErr });

    const hash = await hashPassword(new_password);
    await pool.query(
      `UPDATE worker SET password_hash = $1, must_change_pw = FALSE, updated_at = NOW() WHERE worker_id = $2`,
      [hash, worker_id],
    );
    return { ok: true };
  });

  // GET /api/auth/next-employee-no  (사용 가능한 다음 사번 자동 조회)
  app.get('/api/auth/next-employee-no', { preHandler: requireRole('admin') }, async () => {
    const { rows } = await pool.query(
      `SELECT employee_no FROM worker WHERE employee_no ~ '^[0-9]+$' ORDER BY LENGTH(employee_no) DESC, employee_no DESC LIMIT 100`
    );
    const existing = new Set(rows.map((r: any) => r.employee_no));
    // 5자리 형식(00001~99999)에서 비어있는 첫 번째 사번 반환
    for (let i = 1; i <= 99999; i++) {
      const candidate = String(i).padStart(5, '0');
      if (!existing.has(candidate)) return { employee_no: candidate };
    }
    return { employee_no: null };
  });

  // GET /api/auth/users  (manager 이상: 전체 직원 목록 조회 — 관리자 전용)
  app.get('/api/auth/users', { preHandler: requireRole('admin', 'manager') }, async () => {
    const { rows } = await pool.query(`
      SELECT
        w.worker_id,
        w.employee_no,
        w.worker_name,
        w.position,
        w.role,
        w.email,
        w.phone,
        COALESCE(w.is_active, TRUE) AS is_active,
        d.dept_name,
        d.dept_id
      FROM worker w
      LEFT JOIN department d ON d.dept_id = w.dept_id
      WHERE COALESCE(w.is_active, TRUE) = TRUE
      ORDER BY d.dept_name NULLS LAST, w.worker_name
    `);
    return { workers: rows };
  });

  // GET /api/auth/worker-list  (모든 인증 사용자: 쪽지 보내기 대상 선택용 경량 목록)
  app.get('/api/auth/worker-list', { preHandler: requireAuth }, async (req) => {
    const me = req.auth!;
    const { rows } = await pool.query(`
      SELECT
        w.worker_id,
        w.worker_name,
        w.position,
        COALESCE(d.dept_name, '미지정') AS dept_name
      FROM worker w
      LEFT JOIN department d ON d.dept_id = w.dept_id
      WHERE COALESCE(w.is_active, TRUE) = TRUE
        AND w.worker_id != $1
      ORDER BY d.dept_name NULLS LAST, w.worker_name
    `, [me.worker_id]);
    return { workers: rows };
  });

  // POST /api/auth/users  (admin 전용: 신규 계정 등록)
  app.post('/api/auth/users', { preHandler: requireRole('admin') }, async (req, reply) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    let { employee_no, worker_name, password, dept_id, role, position, email, phone } = parsed.data;

    // 사번 미입력 시 자동 선택
    if (!employee_no || !employee_no.trim()) {
      const { rows } = await pool.query(
        `SELECT employee_no FROM worker WHERE employee_no ~ '^[0-9]+$' ORDER BY LENGTH(employee_no) DESC, employee_no DESC LIMIT 200`
      );
      const existing = new Set(rows.map((r: any) => r.employee_no));
      let found = '';
      for (let i = 1; i <= 99999; i++) {
        const c = String(i).padStart(5, '0');
        if (!existing.has(c)) { found = c; break; }
      }
      if (!found) return reply.code(500).send({ error: 'no_available_employee_no', message: '사용 가능한 사번이 없습니다.' });
      employee_no = found;
    }

    // 휴대폰 번호 하이픈 정규화 (비교용)
    const normalizePhone = (s?: string) => (s ?? '').replace(/[^0-9]/g, '');

    // 비밀번호 검증: 휴대폰번호 기반 임시 비밀번호인 경우는 복잡도 기준 면제
    const isPhoneBasedPw = phone && normalizePhone(password) === normalizePhone(phone);
    if (!isPhoneBasedPw) {
      const pwErr = validatePassword(password);
      if (pwErr) return reply.code(400).send({ error: 'invalid_password_complexity', message: pwErr });
    }

    const hash = await hashPassword(password);
    try {
      const { rows } = await pool.query(
        `INSERT INTO worker (employee_no, worker_name, password_hash, dept_id, role, position, email, phone, must_change_pw)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)
         RETURNING worker_id, employee_no, worker_name, role, dept_id`,
        [employee_no, worker_name, hash, dept_id, role, position || null, email || null, phone || null],
      );
      return { ok: true, user: rows[0] };
    } catch (err: any) {
      if (err.code === '23505') return reply.code(409).send({ error: 'duplicate_employee_no', message: '이미 사용 중인 사번입니다.' });
      throw err;
    }
  });

  // POST /api/auth/users/:id/reset-password  (admin: 비밀번호 초기화)
  app.post<{ Params: { id: string }; Body: { new_password: string } }>(
    '/api/auth/users/:id/reset-password',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10);
      const np = String(req.body?.new_password ?? '');
      
      const pwErr = validatePassword(np);
      if (pwErr) return reply.code(400).send({ error: 'invalid_password_complexity', message: pwErr });

      const hash = await hashPassword(np);
      const r = await pool.query(
        `UPDATE worker SET password_hash = $1, must_change_pw = TRUE, updated_at = NOW()
         WHERE worker_id = $2 RETURNING worker_id`,
        [hash, id],
      );
      if (!r.rows[0]) return reply.code(404).send({ error: 'not_found' });
      return { ok: true };
    },
  );

  // PATCH /api/auth/users/:id  (admin 전용: 계정 정보 수정)
  app.patch<{ Params: { id: string } }>(
    '/api/auth/users/:id',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10);
      const body = req.body as Record<string, any>;

      const allowedFields = ['employee_no', 'worker_name', 'dept_id', 'role', 'position', 'email', 'phone', 'is_active'];
      
      if ('password' in body && body.password) {
        const pwErr = validatePassword(String(body.password));
        if (pwErr) return reply.code(400).send({ error: 'invalid_password_complexity', message: pwErr });
        const hash = await hashPassword(String(body.password));
        body.password_hash = hash;
        allowedFields.push('password_hash');
      }

      const updates: string[] = [];
      const values: unknown[] = [];

      // If dept_id is provided, let's fetch the department name to keep it synced
      if ('dept_id' in body && body.dept_id) {
        const deptRes = await pool.query('SELECT dept_name FROM department WHERE dept_id = $1', [body.dept_id]);
        if (deptRes.rows[0]) {
          body.department = deptRes.rows[0].dept_name;
          allowedFields.push('department');
        }
      }

      for (const field of allowedFields) {
        if (field in body) {
          values.push(body[field]);
          updates.push(`${field} = $${values.length}`);
        }
      }

      if (updates.length === 0) {
        return reply.code(400).send({ error: 'invalid_body', message: '수정할 항목이 없습니다.' });
      }

      // Check unique constraint for employee_no
      if ('employee_no' in body && body.employee_no) {
        const dup = await pool.query(
          'SELECT 1 FROM worker WHERE employee_no = $1 AND worker_id <> $2',
          [body.employee_no, id]
        );
        if (dup.rows.length > 0) {
          return reply.code(409).send({ error: 'duplicate_employee_no', message: '이미 사용중인 사번입니다.' });
        }
      }

      values.push(id);
      const { rows } = await pool.query(
        `UPDATE worker SET ${updates.join(', ')}, updated_at = NOW()
         WHERE worker_id = $${values.length}
         RETURNING worker_id, employee_no, worker_name, role, dept_id, position, email, phone, is_active`,
        values
      );

      if (!rows[0]) {
        return reply.code(404).send({ error: 'not_found', message: '사용자를 찾을 수 없습니다.' });
      }

      return { ok: true, user: rows[0] };
    }
  );

  // DELETE /api/auth/users/:id  (admin 전용: 완전 삭제 시도 → FK 제약 시 소프트 삭제)
  app.delete<{ Params: { id: string } }>(
    '/api/auth/users/:id',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10);
      const me = req.auth!;

      // 자기 자신 삭제 방지
      if (id === me.worker_id) {
        return reply.code(400).send({ error: 'cannot_delete_self', message: '자기 자신을 삭제할 수 없습니다.' });
      }

      // admin(employee_no='admin') 계정 삭제 방지
      const { rows: [target] } = await pool.query(
        `SELECT worker_id, worker_name, employee_no, is_active FROM worker WHERE worker_id = $1`,
        [id]
      );
      if (!target) return reply.code(404).send({ error: 'not_found' });
      if (target.employee_no === 'admin') {
        return reply.code(403).send({ error: 'cannot_delete_admin', message: '시스템 관리자 계정은 삭제할 수 없습니다.' });
      }

      // ① 완전 삭제 시도 (FK 제약 없으면 성공)
      try {
        await pool.query(`DELETE FROM worker WHERE worker_id = $1`, [id]);
        return { ok: true, delete_type: 'hard', worker_name: target.worker_name };
      } catch (e: any) {
        // FK 제약 위반 → 소프트 삭제로 폴백
        if (e.code === '23503') {
          await pool.query(
            `UPDATE worker SET is_active = FALSE, updated_at = NOW() WHERE worker_id = $1`,
            [id]
          );
          return {
            ok: true,
            delete_type: 'soft',
            worker_name: target.worker_name,
            message: '연결된 업무 데이터가 있어 계정이 비활성화 처리되었습니다.',
          };
        }
        throw e;
      }
    }
  );

  // ── 로그인 기록 조회 (admin only) ─────────────────────────────────────────
  app.get('/api/auth/login-logs', { preHandler: requireRole('admin') }, async (req) => {
    const { from, to, success, q } = req.query as {
      from?: string; to?: string; success?: string; q?: string;
    };

    const conditions: string[] = [];
    const params: any[] = [];

    if (from) {
      params.push(from);
      conditions.push(`la.attempted_at >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      conditions.push(`la.attempted_at < ($${params.length}::date + interval '1 day')`);
    }
    if (success === 'true') conditions.push(`la.success = TRUE`);
    if (success === 'false') conditions.push(`la.success = FALSE`);
    if (q?.trim()) {
      params.push(`%${q.trim()}%`);
      conditions.push(`(la.employee_no ILIKE $${params.length} OR w.worker_name ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(`
      SELECT
        la.attempt_id,
        la.employee_no,
        la.success,
        la.failure_reason,
        la.ip_address,
        la.attempted_at,
        w.worker_name,
        d.dept_name
      FROM login_attempt la
      LEFT JOIN worker w ON w.employee_no = la.employee_no
      LEFT JOIN department d ON d.dept_id = w.dept_id
      ${where}
      ORDER BY la.attempted_at DESC
      LIMIT 1000
    `, params);

    return { logs: rows };
  });
}
