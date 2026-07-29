import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireRole } from '../lib/auth-plugin.js';

export async function supportRoutes(app: FastifyInstance) {
  // CREATE TABLE IF NOT EXISTS support_faq
  await pool.query(`
    CREATE TABLE IF NOT EXISTS support_faq (
      id SERIAL PRIMARY KEY,
      category VARCHAR(50) DEFAULT 'general',
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  app.get('/api/support/faqs', async () => {
    const { rows } = await pool.query('SELECT * FROM support_faq ORDER BY sort_order, id');
    return { data: rows };
  });

  app.post('/api/support/faqs', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { category = 'general', question, answer, sort_order = 0 } = req.body as any;
    if (!question || !answer) return reply.status(400).send({ error: '질문과 답변은 필수입니다.' });
    const { rows: [row] } = await pool.query(
      'INSERT INTO support_faq (category, question, answer, sort_order) VALUES ($1,$2,$3,$4) RETURNING *',
      [category, question, answer, sort_order]
    );
    return { data: row };
  });

  app.delete('/api/support/faqs/:id', { preHandler: requireRole('admin') }, async (req) => {
    await pool.query('DELETE FROM support_faq WHERE id=$1', [(req.params as any).id]);
    return { ok: true };
  });
}
