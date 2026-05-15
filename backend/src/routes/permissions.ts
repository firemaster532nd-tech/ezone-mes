import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../lib/auth-plugin.js';

const permRow = z.object({
  can_read: z.boolean().default(false),
  can_write: z.boolean().default(false),
  can_update: z.boolean().default(false),
  can_delete: z.boolean().default(false),
});

const deptPermBatch = z.object({
  dept_id: z.number().int().positive(),
  permissions: z.array(
    permRow.extend({ menu_id: z.number().int().positive() }),
  ),
});

const userOverride = z.object({
  worker_id: z.number().int().positive(),
  menu_id: z.number().int().positive(),
  override_mode: z.enum(['ADD', 'REVOKE', 'REPLACE']),
}).merge(permRow);

export async function permissionRoutes(app: FastifyInstance) {
  // GET /api/menus  (메뉴 트리, 사이드바 구성용)
  app.get('/api/menus', { preHandler: requireAuth }, async () => {
    const { rows } = await pool.query(
      `SELECT menu_id, menu_code, menu_name, parent_menu_id, path, icon, sort_order, is_admin_only
       FROM menu WHERE is_active = TRUE ORDER BY sort_order, menu_id`,
    );
    return { data: rows };
  });

  // GET /api/permissions/effective?worker_id=...  (특정 사용자의 최종 권한)
  app.get<{ Querystring: { worker_id?: string } }>(
    '/api/permissions/effective',
    { preHandler: requireAuth },
    async (req, reply) => {
      const wid = req.query.worker_id ? parseInt(req.query.worker_id, 10) : req.auth!.worker_id;
      // 본인 권한만 조회 가능, 관리자는 누구든
      if (wid !== req.auth!.worker_id && req.auth!.role !== 'admin') {
        return reply.code(403).send({ error: 'forbidden' });
      }
      const { rows } = await pool.query(
        `SELECT menu_id, menu_code, path, can_read, can_write, can_update, can_delete
         FROM effective_permission WHERE worker_id = $1`,
        [wid],
      );
      return { data: rows };
    },
  );

  // GET /api/permissions/departments/:dept_id  (특정 부서의 권한 매트릭스)
  app.get<{ Params: { dept_id: string } }>(
    '/api/permissions/departments/:dept_id',
    { preHandler: requireRole('admin') },
    async (req) => {
      const dept_id = parseInt(req.params.dept_id, 10);
      const { rows } = await pool.query(
        `SELECT m.menu_id, m.menu_code, m.menu_name, m.parent_menu_id, m.sort_order,
                COALESCE(dp.can_read,   FALSE) AS can_read,
                COALESCE(dp.can_write,  FALSE) AS can_write,
                COALESCE(dp.can_update, FALSE) AS can_update,
                COALESCE(dp.can_delete, FALSE) AS can_delete
         FROM menu m
         LEFT JOIN department_permission dp ON dp.menu_id = m.menu_id AND dp.dept_id = $1
         WHERE m.is_active = TRUE
         ORDER BY m.sort_order, m.menu_id`,
        [dept_id],
      );
      return { data: rows };
    },
  );

  // PUT /api/permissions/departments  (부서 권한 일괄 저장)
  app.put('/api/permissions/departments', { preHandler: requireRole('admin') }, async (req, reply) => {
    const parsed = deptPermBatch.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    const { dept_id, permissions } = parsed.data;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const p of permissions) {
        await client.query(
          `INSERT INTO department_permission (dept_id, menu_id, can_read, can_write, can_update, can_delete, updated_by, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
           ON CONFLICT (dept_id, menu_id) DO UPDATE
             SET can_read = EXCLUDED.can_read,
                 can_write = EXCLUDED.can_write,
                 can_update = EXCLUDED.can_update,
                 can_delete = EXCLUDED.can_delete,
                 updated_by = EXCLUDED.updated_by,
                 updated_at = NOW()`,
          [dept_id, p.menu_id, p.can_read, p.can_write, p.can_update, p.can_delete, req.auth!.worker_id],
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK'); throw e;
    } finally {
      client.release();
    }
    return { ok: true, count: permissions.length };
  });

  // PUT /api/permissions/users  (개인 오버라이드 upsert)
  app.put('/api/permissions/users', { preHandler: requireRole('admin') }, async (req, reply) => {
    const parsed = userOverride.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    const p = parsed.data;
    await pool.query(
      `INSERT INTO user_permission_override
         (worker_id, menu_id, override_mode, can_read, can_write, can_update, can_delete, updated_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (worker_id, menu_id) DO UPDATE
         SET override_mode = EXCLUDED.override_mode,
             can_read = EXCLUDED.can_read,
             can_write = EXCLUDED.can_write,
             can_update = EXCLUDED.can_update,
             can_delete = EXCLUDED.can_delete,
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()`,
      [p.worker_id, p.menu_id, p.override_mode, p.can_read, p.can_write, p.can_update, p.can_delete, req.auth!.worker_id],
    );
    return { ok: true };
  });

  // DELETE /api/permissions/users/:worker_id/:menu_id  (개인 오버라이드 제거)
  app.delete<{ Params: { worker_id: string; menu_id: string } }>(
    '/api/permissions/users/:worker_id/:menu_id',
    { preHandler: requireRole('admin') },
    async (req) => {
      await pool.query(
        `DELETE FROM user_permission_override WHERE worker_id = $1 AND menu_id = $2`,
        [parseInt(req.params.worker_id, 10), parseInt(req.params.menu_id, 10)],
      );
      return { ok: true };
    },
  );
}
