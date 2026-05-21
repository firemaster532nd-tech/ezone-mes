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
  employee_no: z.string().min(1).max(20),
  worker_name: z.string().min(1).max(50),
  password: z.string().min(4).max(100),
  dept_id: z.number().int().positive(),
  role: z.enum(['admin', 'manager', 'worker']).default('worker'),
  position: z.string().max(50).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(4).max(100),
});

export async function authRoutes(app: FastifyInstance) {
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
      `SELECT worker_id, employee_no, worker_name, password_hash, role, dept_id, is_active, must_change_pw
       FROM worker WHERE employee_no = $1`,
      [employee_no],
    );
    const w = rows[0];
    if (!w) { logAttempt(false, 'user_not_found'); return reply.code(401).send({ error: 'invalid_credentials' }); }
    if (!w.is_active) { logAttempt(false, 'inactive'); return reply.code(403).send({ error: 'account_disabled' }); }
    if (!w.password_hash) { logAttempt(false, 'no_password'); return reply.code(403).send({ error: 'password_not_set' }); }

    const ok = await verifyPassword(password, w.password_hash);
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
      },
    };
  });

  // GET /api/auth/me  (현재 로그인한 사용자 + 권한 목록)
  app.get('/api/auth/me', { preHandler: requireAuth }, async (req) => {
    const { worker_id } = req.auth!;
    const [userRes, permRes] = await Promise.all([
      pool.query(
        `SELECT w.worker_id, w.employee_no, w.worker_name, w.role, w.dept_id, w.position, w.email,
                w.must_change_pw, d.dept_code, d.dept_name
         FROM worker w LEFT JOIN department d ON d.dept_id = w.dept_id
         WHERE w.worker_id = $1`,
        [worker_id],
      ),
      pool.query(
        `SELECT menu_code, path, can_read, can_write, can_update, can_delete
         FROM effective_permission WHERE worker_id = $1`,
        [worker_id],
      ),
    ]);
    if (!userRes.rows[0]) return { error: 'not_found' };
    return { user: userRes.rows[0], permissions: permRes.rows };
  });

  // POST /api/auth/change-password
  app.post('/api/auth/change-password', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const { current_password, new_password } = parsed.data;
    const { worker_id } = req.auth!;

    const { rows } = await pool.query(`SELECT password_hash FROM worker WHERE worker_id = $1`, [worker_id]);
    if (!rows[0]?.password_hash) return reply.code(404).send({ error: 'no_password_set' });

    const ok = await verifyPassword(current_password, rows[0].password_hash);
    if (!ok) return reply.code(401).send({ error: 'wrong_current_password' });

    const hash = await hashPassword(new_password);
    await pool.query(
      `UPDATE worker SET password_hash = $1, must_change_pw = FALSE, updated_at = NOW() WHERE worker_id = $2`,
      [hash, worker_id],
    );
    return { ok: true };
  });

  // POST /api/auth/users  (admin 전용: 신규 계정 등록)
  app.post('/api/auth/users', { preHandler: requireRole('admin') }, async (req, reply) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    const { employee_no, worker_name, password, dept_id, role, position, email, phone } = parsed.data;

    const hash = await hashPassword(password);
    try {
      const { rows } = await pool.query(
        `INSERT INTO worker (employee_no, worker_name, password_hash, dept_id, role, position, email, phone, must_change_pw)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)
         RETURNING worker_id, employee_no, worker_name, role, dept_id`,
        [employee_no, worker_name, hash, dept_id, role, position ?? null, email ?? null, phone ?? null],
      );
      return { ok: true, user: rows[0] };
    } catch (err: any) {
      if (err.code === '23505') return reply.code(409).send({ error: 'duplicate_employee_no' });
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
      if (np.length < 4) return reply.code(400).send({ error: 'password_too_short' });
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
}

