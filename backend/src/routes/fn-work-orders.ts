import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';

// ─────────────────────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────────────────────

type FnWoType =
  | 'FN_SHEET_CUT'    // 에프엔테크 차열시트 재단 (압출시트 사용)
  | 'FN_SOCKET_ASSY'; // 방화소켓 조립 (슬리브+보호철판 인수검사 후)

// ─────────────────────────────────────────────────────────────────────────────
// DB 마이그레이션
// ─────────────────────────────────────────────────────────────────────────────

async function migrateFnWO() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fn_work_order (
      wo_id         SERIAL PRIMARY KEY,
      wo_number     VARCHAR(30) UNIQUE NOT NULL,
      wo_type       VARCHAR(20) NOT NULL,
      project_id    INTEGER REFERENCES project_master(project_id) ON DELETE SET NULL,
      project_name  TEXT,
      wo_date       DATE DEFAULT CURRENT_DATE,
      delivery_date DATE,
      worker_name   TEXT,
      status        VARCHAR(20) DEFAULT 'PLANNED',
      remarks       TEXT,
      created_by    INTEGER,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      completed_at  TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS fn_work_order_item (
      item_id       SERIAL PRIMARY KEY,
      wo_id         INTEGER REFERENCES fn_work_order(wo_id) ON DELETE CASCADE,
      seq_no        INTEGER,
      diameter_mm   INTEGER,
      qty           INTEGER DEFAULT 1,
      remarks       TEXT
    );

    CREATE TABLE IF NOT EXISTS sleeve_stock (
      stock_id      SERIAL PRIMARY KEY,
      diameter_mm   INTEGER NOT NULL,
      qty           INTEGER DEFAULT 0,
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // 슬리브 초기 데이터 (없을 경우에만 삽입)
  await pool.query(`
    INSERT INTO sleeve_stock (diameter_mm, qty)
    SELECT unnest(ARRAY[100,75,50]), 0
    WHERE NOT EXISTS (SELECT 1 FROM sleeve_stock);
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// 번호 자동 채번
// ─────────────────────────────────────────────────────────────────────────────

async function generateFnWoNumber(wo_type: FnWoType): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = wo_type === 'FN_SHEET_CUT'
    ? `FNSC-${year}`
    : `FNSA-${year}`;
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM fn_work_order WHERE wo_number LIKE $1`,
    [`${prefix}-%`],
  );
  const seq = parseInt(rows[0].cnt) + 1;
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 라우트 export
// ─────────────────────────────────────────────────────────────────────────────

export async function fnWorkOrderRoutes(app: FastifyInstance) {
  await migrateFnWO();

  // ── GET /api/fn-work-orders — 목록 ──────────────────────────────────────
  app.get('/api/fn-work-orders', { preHandler: requireAuth }, async (req) => {
    const { wo_type, project_id, status } = req.query as any;
    let q = `
      SELECT w.*,
             pm.project_name AS pm_name,
             COUNT(i.item_id) AS item_count,
             SUM(i.qty) AS total_qty
      FROM fn_work_order w
      LEFT JOIN project_master pm ON pm.project_id = w.project_id
      LEFT JOIN fn_work_order_item i ON i.wo_id = w.wo_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (wo_type)    { params.push(wo_type);              q += ` AND w.wo_type = $${params.length}`; }
    if (project_id) { params.push(parseInt(project_id)); q += ` AND w.project_id = $${params.length}`; }
    if (status)     { params.push(status);               q += ` AND w.status = $${params.length}`; }
    q += ' GROUP BY w.wo_id, pm.project_name ORDER BY w.created_at DESC';
    const res = await pool.query(q, params);
    return { data: res.rows };
  });

  // ── GET /api/fn-work-orders/:id — 상세 ──────────────────────────────────
  app.get('/api/fn-work-orders/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const wo = await pool.query(
      `SELECT w.*, pm.project_name AS pm_name
       FROM fn_work_order w
       LEFT JOIN project_master pm ON pm.project_id = w.project_id
       WHERE w.wo_id = $1`,
      [id],
    );
    if (!wo.rows[0]) return reply.code(404).send({ error: 'not_found' });
    const items = await pool.query(
      `SELECT * FROM fn_work_order_item WHERE wo_id = $1 ORDER BY seq_no`,
      [id],
    );
    return { data: { ...wo.rows[0], items: items.rows } };
  });

  // ── POST /api/fn-work-orders — 생성 ─────────────────────────────────────
  app.post('/api/fn-work-orders', { preHandler: requireAuth }, async (req, reply) => {
    const {
      wo_type, project_id, project_name,
      wo_date, delivery_date, worker_name, remarks,
      items = [],
      created_by,
    } = req.body as any;

    if (!wo_type) return reply.code(400).send({ error: 'wo_type은 필수입니다.' });
    if (!['FN_SHEET_CUT', 'FN_SOCKET_ASSY'].includes(wo_type)) {
      return reply.code(400).send({ error: '유효하지 않은 wo_type입니다.' });
    }

    const wo_number = await generateFnWoNumber(wo_type as FnWoType);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const ins = await client.query(
        `INSERT INTO fn_work_order
           (wo_number, wo_type, project_id, project_name,
            wo_date, delivery_date, worker_name, remarks, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING wo_id`,
        [
          wo_number, wo_type, project_id || null, project_name || null,
          wo_date || null, delivery_date || null, worker_name || null,
          remarks || null, created_by || null,
        ],
      );
      const wo_id = ins.rows[0].wo_id;

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(
          `INSERT INTO fn_work_order_item (wo_id, seq_no, diameter_mm, qty, remarks)
           VALUES ($1,$2,$3,$4,$5)`,
          [wo_id, i + 1, it.diameter_mm || null, it.qty ?? 1, it.remarks || null],
        );
      }

      await client.query('COMMIT');
      return reply.code(201).send({ data: { wo_id, wo_number } });
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.code(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ── PATCH /api/fn-work-orders/:id/start — 시작 ──────────────────────────
  app.patch('/api/fn-work-orders/:id/start', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const res = await pool.query(
      `UPDATE fn_work_order SET status='IN_PROGRESS'
       WHERE wo_id=$1 AND status='PLANNED'
       RETURNING wo_id`,
      [id],
    );
    if (res.rowCount === 0) return reply.code(400).send({ error: '시작할 수 없는 상태입니다.' });
    return { data: { success: true } };
  });

  // ── POST /api/fn-work-orders/:id/complete — 완료 처리 ───────────────────
  app.post('/api/fn-work-orders/:id/complete', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);

    const woRes = await pool.query(
      `SELECT * FROM fn_work_order WHERE wo_id = $1`, [id],
    );
    if (!woRes.rows[0]) return reply.code(404).send({ error: 'not_found' });
    const wo = woRes.rows[0];
    if (wo.status === 'COMPLETED') {
      return reply.code(400).send({ error: '이미 완료된 작업지시입니다.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // FN_SOCKET_ASSY: sleeve_stock에서 diameter별 qty 차감
      if (wo.wo_type === 'FN_SOCKET_ASSY') {
        const itemsRes = await client.query(
          `SELECT diameter_mm, SUM(qty) AS total_qty
           FROM fn_work_order_item
           WHERE wo_id = $1
           GROUP BY diameter_mm`,
          [id],
        );
        for (const row of itemsRes.rows) {
          if (!row.diameter_mm) continue;
          await client.query(
            `UPDATE sleeve_stock
             SET qty = GREATEST(0, qty - $1), updated_at = NOW()
             WHERE diameter_mm = $2`,
            [parseInt(row.total_qty), row.diameter_mm],
          );
        }
      }

      await client.query(
        `UPDATE fn_work_order SET status='COMPLETED', completed_at=NOW() WHERE wo_id=$1`,
        [id],
      );

      await client.query('COMMIT');
      return { data: { success: true, wo_id: id, wo_type: wo.wo_type } };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.code(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ── DELETE /api/fn-work-orders/:id — 삭제 ───────────────────────────────
  app.delete('/api/fn-work-orders/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const check = await pool.query(
      `SELECT status FROM fn_work_order WHERE wo_id = $1`, [id],
    );
    if (!check.rows[0]) return reply.code(404).send({ error: 'not_found' });
    if (check.rows[0].status === 'COMPLETED') {
      return reply.code(400).send({ error: '완료된 작업지시는 삭제할 수 없습니다.' });
    }
    await pool.query(`DELETE FROM fn_work_order WHERE wo_id = $1`, [id]);
    return { data: { success: true } };
  });

  // ── GET /api/sleeve-stock — 슬리브 재고 ─────────────────────────────────
  app.get('/api/sleeve-stock', { preHandler: requireAuth }, async () => {
    const res = await pool.query(
      `SELECT * FROM sleeve_stock ORDER BY diameter_mm DESC`,
    );
    return { data: res.rows };
  });

  // ── POST /api/sleeve-stock/receive — 슬리브 입고 ────────────────────────
  app.post('/api/sleeve-stock/receive', { preHandler: requireAuth }, async (req, reply) => {
    const { items = [], memo } = req.body as any;
    // items: [{ diameter_mm, qty }]
    if (!items.length) return reply.code(400).send({ error: '입고 항목이 없습니다.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const it of items) {
        if (!it.diameter_mm || !it.qty || it.qty <= 0) continue;
        await client.query(
          `INSERT INTO sleeve_stock (diameter_mm, qty, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (diameter_mm) DO UPDATE
             SET qty = sleeve_stock.qty + EXCLUDED.qty,
                 updated_at = NOW()`,
          [it.diameter_mm, it.qty],
        );
      }
      await client.query('COMMIT');
      return { data: { success: true, memo: memo || null } };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.code(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ── PATCH /api/sleeve-stock/:stock_id/adjust — 재고 조정 ────────────────
  app.patch('/api/sleeve-stock/:stock_id/adjust', { preHandler: requireAuth }, async (req, reply) => {
    const stock_id = parseInt((req.params as any).stock_id);
    const { qty, memo } = req.body as any;
    if (qty === undefined || qty === null) {
      return reply.code(400).send({ error: 'qty는 필수입니다.' });
    }
    const res = await pool.query(
      `UPDATE sleeve_stock SET qty = $1, updated_at = NOW()
       WHERE stock_id = $2 RETURNING *`,
      [Math.max(0, qty), stock_id],
    );
    if (res.rowCount === 0) return reply.code(404).send({ error: 'not_found' });
    return { data: { ...res.rows[0], memo: memo || null } };
  });
}
