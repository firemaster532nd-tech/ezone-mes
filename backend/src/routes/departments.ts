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
      GROUP BY d.dept_id
      ORDER BY d.sort_order, d.dept_code
    `);
    return { data: rows };
  });

  // GET /api/departments/:id/members
  app.get<{ Params: { id: string } }>('/api/departments/:id/members', { preHandler: requireAuth }, async (req) => {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      `SELECT worker_id, employee_no, worker_name, role, position, email, phone, dept_id, is_active
       FROM worker WHERE dept_id = $1 ORDER BY worker_name`,
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

  // DELETE /api/departments/:id  (soft delete: is_active = false)
  app.delete<{ Params: { id: string } }>('/api/departments/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const r = await pool.query(
      `UPDATE department SET is_active = FALSE, updated_at = NOW() WHERE dept_id = $1 RETURNING dept_id`,
      [id],
    );
    if (!r.rows[0]) return reply.code(404).send({ error: 'not_found' });
    return { ok: true };
  });
}
