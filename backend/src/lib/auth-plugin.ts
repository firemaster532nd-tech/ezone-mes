import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, type JwtPayload } from './jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: JwtPayload;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'missing_token' });
  }
  try {
    req.auth = verifyToken(header.slice(7));
  } catch {
    return reply.code(401).send({ error: 'invalid_token' });
  }
}

export function requireRole(...roles: Array<'admin' | 'manager' | 'worker'>) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(req, reply);
    if (reply.sent) return;
    if (!roles.includes(req.auth!.role)) {
      return reply.code(403).send({ error: 'forbidden', required: roles });
    }
  };
}

// Permission check: ensure user has CRUD action on a menu_code
export function requirePerm(menu_code: string, action: 'read' | 'write' | 'update' | 'delete') {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(req, reply);
    if (reply.sent) return;
    const { pool } = await import('../db/pool.js');
    const col = `can_${action}`;
    const { rows } = await pool.query(
      `SELECT ${col} FROM effective_permission ep
       JOIN menu m ON m.menu_id = ep.menu_id
       WHERE ep.worker_id = $1 AND m.menu_code = $2`,
      [req.auth!.worker_id, menu_code],
    );
    if (!rows[0] || !rows[0][col]) {
      return reply.code(403).send({ error: 'permission_denied', menu_code, action });
    }
  };
}

export function registerAuthHooks(_app: FastifyInstance) {
  // optional: global pre-handler can be added here later
}
