import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../lib/auth-plugin.js';

const deptSchema = z.object({
  dept_code: z.string().min(1).max(20),
  dept_name: z.string().min(1).max(60),
  parent_dept_id: z.number().int().positive().nullable().optional(),
  sort_order: z.number().int().default(0),
});

export async function departmentRoutes(app: FastifyInstance) {
  // GET /api/departments  (트리 구조용 평면 리스트, members 카운트 포함)
  app.get('/api/departments', { preHandler: requireAuth }, async () => {
    const { rows } = await pool.query(`
      SELECT d.dept_id, d.dept_code, d.dept_name, d.parent_dept_id, d.sort_order, d.is_active,
             COUNT(w.worker_id)::int AS member_count
      FROM department d
      LEFT JOIN worker w ON w.dept_id = d.dept_id AND w.is_active = TRUE
      WHERE d.is_active = TRUE
      GROUP BY d.dept_id
      ORDER BY COUNT(w.worker_id) DESC, d.dept_name
    `);
    return { data: rows };
  });

  // GET /api/departments/:id/members
  app.get<{ Params: { id: string } }>('/api/departments/:id/members', { preHandler: requireAuth }, async (req) => {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      `SELECT worker_id, employee_no, worker_name, role, position, email, phone, dept_id, is_active
       FROM worker WHERE dept_id = $1 AND COALESCE(is_active, TRUE) = TRUE AND role <> 'superadmin' ORDER BY worker_name`,
      [id],
    );
    return { data: rows };
  });

  // POST /api/departments  (admin only)
  app.post('/api/departments', { preHandler: requireRole('admin') }, async (req, reply) => {
    const parsed = deptSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    const { dept_code, dept_name, parent_dept_id, sort_order } = parsed.data;
    try {
      const { rows } = await pool.query(
        `INSERT INTO department (dept_code, dept_name, parent_dept_id, sort_order)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [dept_code, dept_name, parent_dept_id ?? null, sort_order],
      );
      return { data: rows[0] };
    } catch (err: any) {
      if (err.code === '23505') return reply.code(409).send({ error: 'duplicate_dept_code' });
      throw err;
    }
  });

  // PUT /api/departments/:id  (admin only)
  app.put<{ Params: { id: string } }>('/api/departments/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const parsed = deptSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(parsed.data)) {
      fields.push(`${k} = $${i++}`); values.push(v);
    }
    if (!fields.length) return reply.code(400).send({ error: 'no_fields' });
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE department SET ${fields.join(', ')} WHERE dept_id = $${i} RETURNING *`,
      values,
    );
    if (!rows[0]) return reply.code(404).send({ error: 'not_found' });
    return { data: rows[0] };
  });

  // DELETE /api/departments/:id  (소속 인원 · 하위부서 없을 때 실제 삭제, 있으면 409)
  app.delete<{ Params: { id: string } }>('/api/departments/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);

    // 소속 인원 확인
    const memberRes = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM worker WHERE dept_id = $1 AND is_active = TRUE`,
      [id],
    );
    if (memberRes.rows[0].cnt > 0) {
      return reply.code(409).send({
        error: 'has_members',
        message: `이 부서에 소속된 직원 ${memberRes.rows[0].cnt}명이 있어 삭제할 수 없습니다. 직원 부서를 먼저 변경해주세요.`,
      });
    }

    // 하위 부서 확인
    const subRes = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM department WHERE parent_dept_id = $1 AND is_active = TRUE`,
      [id],
    );
    if (subRes.rows[0].cnt > 0) {
      return reply.code(409).send({
        error: 'has_sub_departments',
        message: `하위 부서 ${subRes.rows[0].cnt}개가 있어 삭제할 수 없습니다. 하위 부서를 먼저 삭제해주세요.`,
      });
    }

    // 실제 삭제
    try {
      const r = await pool.query(
        `DELETE FROM department WHERE dept_id = $1 RETURNING dept_id`,
        [id],
      );
      if (!r.rows[0]) return reply.code(404).send({ error: 'not_found', message: '부서를 찾을 수 없습니다.' });
      return { ok: true };
    } catch (err: any) {
      if (err.code === '23503') {
        // FK 참조 존재 시 소프트 삭제로 폴백
        await pool.query(`UPDATE department SET is_active = FALSE, updated_at = NOW() WHERE dept_id = $1`, [id]);
        return { ok: true, fallback: 'soft_delete' };
      }
      throw err;
    }
  });

  // ── GET /api/departments/all-members  (사내 연락망 전체 다운로드용) ──────────
  app.get('/api/departments/all-members', { preHandler: requireRole('admin', 'manager') }, async () => {
    const { rows } = await pool.query(`
      SELECT
        sub.dept_name,
        sub.employee_no,
        sub.worker_name,
        sub.position,
        sub.role,
        sub.email,
        sub.phone
      FROM (
        SELECT DISTINCT ON (LOWER(TRIM(w.worker_name)))
          -- 부서: dept_id FK 우선, 없으면 구형 department 텍스트, 그도 없으면 '미지정'
          COALESCE(d.dept_name, w.department, '미지정')     AS dept_name,
          -- 사번: 5자리 LPAD, NULL이면 '-'
          CASE
            WHEN w.employee_no IS NOT NULL AND w.employee_no <> ''
            THEN LPAD(w.employee_no, 5, '0')
            ELSE '-'
          END                                                AS employee_no,
          COALESCE(w.worker_name, '-')                      AS worker_name,
          COALESCE(w.position, '-')                         AS position,
          COALESCE(w.role, 'worker')                        AS role,
          COALESCE(w.email, '')                             AS email,
          COALESCE(w.phone, '')                             AS phone,
          -- 정렬 우선순위용 (DISTINCT ON 내부)
          (w.dept_id IS NOT NULL)                            AS has_dept,
          (w.employee_no IS NOT NULL AND w.employee_no <> '') AS has_empno
        FROM worker w
        LEFT JOIN department d ON d.dept_id = w.dept_id
        WHERE COALESCE(w.is_active, TRUE) = TRUE
          AND w.role <> 'superadmin'
        ORDER BY
          LOWER(TRIM(w.worker_name)) ASC,   -- DISTINCT ON 키
          (w.dept_id IS NOT NULL) DESC,      -- dept_id 있는 신버전 우선
          (w.employee_no IS NOT NULL AND w.employee_no <> '') DESC,
          w.worker_id DESC                   -- 더 최신 레코드 우선
      ) sub
      ORDER BY
        CASE
          WHEN sub.employee_no <> '-'
          THEN LPAD(sub.employee_no, 10, '0')
          ELSE 'ZZZZZZZZZZ'
        END ASC,
        sub.worker_name ASC
    `);
    return { data: rows };
  });
}
