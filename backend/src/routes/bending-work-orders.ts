import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bending_work_order (
      bwo_id        SERIAL PRIMARY KEY,
      bwo_number    TEXT UNIQUE,
      project_id    INTEGER REFERENCES project_master(project_id) ON DELETE SET NULL,
      project_name  TEXT,
      wo_date       DATE NOT NULL DEFAULT CURRENT_DATE,
      delivery_date DATE,
      worker_name   TEXT,
      status        TEXT NOT NULL DEFAULT 'PLANNED'
                    CHECK (status IN ('PLANNED','IN_PROGRESS','COMPLETED')),
      remarks       TEXT,
      created_by    INTEGER REFERENCES worker(worker_id) ON DELETE SET NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      completed_at  TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_bwo_project ON bending_work_order(project_id);

    CREATE TABLE IF NOT EXISTS bending_work_order_item (
      bwoi_id       SERIAL PRIMARY KEY,
      bwo_id        INTEGER NOT NULL REFERENCES bending_work_order(bwo_id) ON DELETE CASCADE,
      stock_id      INTEGER REFERENCES bracket_stock(stock_id) ON DELETE SET NULL,
      material      TEXT NOT NULL DEFAULT 'GI',
      thickness_t   NUMERIC(4,2) NOT NULL,
      width_mm      INTEGER NOT NULL,
      length_mm     INTEGER NOT NULL,
      order_qty     INTEGER NOT NULL DEFAULT 1,
      completed_qty INTEGER NOT NULL DEFAULT 0,
      bending_type  TEXT NOT NULL DEFAULT '절곡',
      remarks       TEXT,
      stock_deducted BOOLEAN NOT NULL DEFAULT false,
      seq_no        INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_bwoi_bwo ON bending_work_order_item(bwo_id);
  `);
}

export async function bendingWorkOrderRoutes(app: FastifyInstance) {
  await migrate();

  // ── GET /api/bending-work-orders — 목록 조회 ──
  app.get('/api/bending-work-orders', { preHandler: requireAuth }, async (req) => {
    const { project_id, status } = req.query as any;
    let q = `
      SELECT b.*,
             pm.project_name as pm_name,
             w.worker_name as created_by_name,
             COUNT(i.bwoi_id) as item_count,
             SUM(i.order_qty) as total_order_qty
      FROM bending_work_order b
      LEFT JOIN project_master pm ON pm.project_id = b.project_id
      LEFT JOIN worker w ON w.worker_id = b.created_by
      LEFT JOIN bending_work_order_item i ON i.bwo_id = b.bwo_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (project_id) { params.push(parseInt(project_id)); q += ` AND b.project_id = $${params.length}`; }
    if (status)     { params.push(status);               q += ` AND b.status = $${params.length}`; }
    q += ' GROUP BY b.bwo_id, pm.project_name, w.worker_name ORDER BY b.created_at DESC';
    const res = await pool.query(q, params);
    return { data: res.rows };
  });

  // ── GET /api/bending-work-orders/:id — 상세 조회 ──
  app.get('/api/bending-work-orders/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const bwo = await pool.query(
      `SELECT b.*, pm.project_name as pm_name, w.worker_name as created_by_name
       FROM bending_work_order b
       LEFT JOIN project_master pm ON pm.project_id = b.project_id
       LEFT JOIN worker w ON w.worker_id = b.created_by
       WHERE b.bwo_id = $1`, [id]
    );
    if (!bwo.rows[0]) return reply.code(404).send({ error: 'not_found' });
    const items = await pool.query(
      `SELECT i.*, bs.qty as stock_qty
       FROM bending_work_order_item i
       LEFT JOIN bracket_stock bs ON bs.stock_id = i.stock_id
       WHERE i.bwo_id = $1 ORDER BY i.seq_no`,
      [id]
    );
    return { data: { ...bwo.rows[0], items: items.rows } };
  });

  // ── POST /api/bending-work-orders — 신규 생성 ──
  app.post('/api/bending-work-orders', { preHandler: requireAuth }, async (req, reply) => {
    const { project_id, project_name, wo_date, delivery_date, worker_name, remarks, items, created_by } = req.body as any;
    if (!project_id) return reply.code(400).send({ error: '현장을 선택하세요.' });
    if (!items || items.length === 0) return reply.code(400).send({ error: '절곡 항목이 없습니다.' });

    // 번호 자동 채번 BWO-YYYY-NNN
    const year = new Date().getFullYear();
    const cntRes = await pool.query(
      `SELECT COUNT(*) FROM bending_work_order WHERE bwo_number LIKE $1`,
      [`BWO-${year}-%`]
    );
    const seq = parseInt(cntRes.rows[0].count) + 1;
    const bwoNumber = `BWO-${year}-${String(seq).padStart(3, '0')}`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const ins = await client.query(
        `INSERT INTO bending_work_order (bwo_number, project_id, project_name, wo_date, delivery_date, worker_name, remarks, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING bwo_id`,
        [bwoNumber, project_id, project_name || null, wo_date || null, delivery_date || null, worker_name || null, remarks || null, created_by || null]
      );
      const bwoId = ins.rows[0].bwo_id;

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(
          `INSERT INTO bending_work_order_item
           (bwo_id, stock_id, material, thickness_t, width_mm, length_mm, order_qty, bending_type, remarks, seq_no)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [bwoId, it.stock_id || null, it.material || 'GI', it.thickness_t, it.width_mm, it.length_mm,
           it.order_qty, it.bending_type || '절곡', it.remarks || null, i + 1]
        );
      }
      await client.query('COMMIT');
      return { data: { bwo_id: bwoId, bwo_number: bwoNumber } };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });

  // ── PATCH /api/bending-work-orders/:id — 수정 ──
  app.patch('/api/bending-work-orders/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const { wo_date, delivery_date, worker_name, remarks, items } = req.body as any;

    const cur = await pool.query(`SELECT status FROM bending_work_order WHERE bwo_id = $1`, [id]);
    if (!cur.rows[0]) return reply.code(404).send({ error: 'not_found' });
    if (cur.rows[0].status === 'COMPLETED') return reply.code(400).send({ error: '완료된 작업지시는 수정할 수 없습니다.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE bending_work_order SET wo_date=$1, delivery_date=$2, worker_name=$3, remarks=$4 WHERE bwo_id=$5`,
        [wo_date || null, delivery_date || null, worker_name || null, remarks || null, id]
      );
      if (items) {
        await client.query(`DELETE FROM bending_work_order_item WHERE bwo_id = $1`, [id]);
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          await client.query(
            `INSERT INTO bending_work_order_item
             (bwo_id, stock_id, material, thickness_t, width_mm, length_mm, order_qty, bending_type, remarks, seq_no)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [id, it.stock_id || null, it.material || 'GI', it.thickness_t, it.width_mm, it.length_mm,
             it.order_qty, it.bending_type || '절곡', it.remarks || null, i + 1]
          );
        }
      }
      await client.query('COMMIT');
      return { data: { success: true } };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });

  // ── POST /api/bending-work-orders/:id/start — 작업 시작 ──
  app.post('/api/bending-work-orders/:id/start', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const res = await pool.query(
      `UPDATE bending_work_order SET status='IN_PROGRESS' WHERE bwo_id=$1 AND status='PLANNED' RETURNING bwo_id`,
      [id]
    );
    if (res.rowCount === 0) return reply.code(400).send({ error: '시작할 수 없는 상태입니다.' });
    return { data: { success: true } };
  });

  // ── POST /api/bending-work-orders/:id/complete — 작업 완료 + 재고 차감 ──
  app.post('/api/bending-work-orders/:id/complete', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const { completed_items, worker_id } = req.body as any;
    // completed_items: [{ bwoi_id, completed_qty }]

    const bwo = await pool.query(`SELECT * FROM bending_work_order WHERE bwo_id = $1`, [id]);
    if (!bwo.rows[0]) return reply.code(404).send({ error: 'not_found' });
    if (bwo.rows[0].status === 'COMPLETED') return reply.code(400).send({ error: '이미 완료된 작업지시입니다.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const ci of (completed_items || [])) {
        const itemRes = await client.query(
          `SELECT * FROM bending_work_order_item WHERE bwoi_id = $1 AND bwo_id = $2`,
          [ci.bwoi_id, id]
        );
        const item = itemRes.rows[0];
        if (!item || item.stock_deducted) continue;

        const qty = Math.min(ci.completed_qty || item.order_qty, item.order_qty);

        // 재고 차감 (bracket_stock)
        if (item.stock_id && qty > 0) {
          await client.query(
            `UPDATE bracket_stock SET qty = GREATEST(0, qty - $1), updated_at = NOW() WHERE stock_id = $2`,
            [qty, item.stock_id]
          );
          // 이력
          await client.query(
            `INSERT INTO stock_transaction (stock_type, stock_id, project_id, tx_type, qty, source_type, source_id, memo, created_by)
             VALUES ('BRACKET', $1, $2, 'OUT', $3, 'BENDING_WO', $4, '절곡 작업 출고', $5)`,
            [item.stock_id, bwo.rows[0].project_id, qty, id, worker_id || null]
          );
        }
        // 항목 업데이트
        await client.query(
          `UPDATE bending_work_order_item SET completed_qty=$1, stock_deducted=true WHERE bwoi_id=$2`,
          [qty, ci.bwoi_id]
        );
      }

      // 작업지시 완료 처리
      await client.query(
        `UPDATE bending_work_order SET status='COMPLETED', completed_at=NOW() WHERE bwo_id=$1`,
        [id]
      );
      await client.query('COMMIT');
      return { data: { success: true } };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });

  // ── DELETE /api/bending-work-orders/:id — 삭제 (PLANNED만) ──
  app.delete('/api/bending-work-orders/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const res = await pool.query(
      `DELETE FROM bending_work_order WHERE bwo_id=$1 AND status='PLANNED' RETURNING bwo_id`, [id]
    );
    if (res.rowCount === 0) return reply.code(400).send({ error: '계획 상태의 작업지시만 삭제 가능합니다.' });
    return { data: { success: true } };
  });
}
