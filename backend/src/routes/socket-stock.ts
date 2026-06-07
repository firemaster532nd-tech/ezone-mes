import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';

// ─────────────────────────────────────────────────────────────────────────────
// DB 마이그레이션
// ─────────────────────────────────────────────────────────────────────────────
async function migrateStockTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS socket_stock (
      stock_id     SERIAL PRIMARY KEY,
      project_id   INTEGER REFERENCES project_master(project_id) ON DELETE SET NULL,
      product_type VARCHAR(30) NOT NULL,
      width_mm     INTEGER NOT NULL,
      height_mm    INTEGER NOT NULL,
      depth_mm     INTEGER NOT NULL DEFAULT 200,
      qty          INTEGER NOT NULL DEFAULT 0,
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_socket_stock_unique
      ON socket_stock(project_id, product_type, width_mm, height_mm, depth_mm);
    CREATE INDEX IF NOT EXISTS idx_socket_stock_project ON socket_stock(project_id);

    CREATE TABLE IF NOT EXISTS bracket_stock (
      stock_id     SERIAL PRIMARY KEY,
      project_id   INTEGER REFERENCES project_master(project_id) ON DELETE SET NULL,
      material     VARCHAR(20) NOT NULL DEFAULT 'GI',
      thickness_t  NUMERIC(4,2) NOT NULL,
      width_mm     INTEGER NOT NULL,
      length_mm    INTEGER NOT NULL,
      qty          INTEGER NOT NULL DEFAULT 0,
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bracket_stock_unique
      ON bracket_stock(project_id, material, thickness_t, width_mm, length_mm);
    CREATE INDEX IF NOT EXISTS idx_bracket_stock_project ON bracket_stock(project_id);

    CREATE TABLE IF NOT EXISTS stock_transaction (
      tx_id        SERIAL PRIMARY KEY,
      stock_type   VARCHAR(20) NOT NULL CHECK (stock_type IN ('SOCKET','BRACKET')),
      stock_id     INTEGER NOT NULL,
      project_id   INTEGER,
      tx_type      VARCHAR(10) NOT NULL CHECK (tx_type IN ('IN','OUT')),
      qty          INTEGER NOT NULL,
      source_type  VARCHAR(30),
      source_id    INTEGER,
      memo         TEXT,
      created_by   INTEGER REFERENCES worker(worker_id) ON DELETE SET NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_stock_tx_project ON stock_transaction(project_id);
    CREATE INDEX IF NOT EXISTS idx_stock_tx_source  ON stock_transaction(source_type, source_id);

    -- socket_order에 received_at 컬럼 추가 (없으면)
    ALTER TABLE socket_order ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;
    ALTER TABLE socket_order ADD COLUMN IF NOT EXISTS received_by INTEGER REFERENCES worker(worker_id);
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// 평철 계산 헬퍼 (자재발주서식 수식 기반)
// ─────────────────────────────────────────────────────────────────────────────
function calcBracketsForStock(code: string, w: number, h: number, q: number) {
  const sw = Math.round(w / 2 - 30);
  const rows: { material: string; t: number; bw: number; l: number; qty: number }[] = [];
  const add = (t: number, bw: number, l: number, qty: number) => {
    if (qty > 0 && l > 0)
      rows.push({ material: 'GI', t, bw, l: Math.round(l), qty });
  };
  switch (code) {
    case 'VT-049': case 'VT-064': case 'VA-064':
      add(1.6, 60, w - 1, q * 4); add(1.6, 60, h - 30, q * 4); break;
    case 'VT-01':
      add(1.6, 60, Math.round(w / 2 - 16), q * 16);
      add(1.6, 60, Math.round(h / 2 - 20), q * 32);
      add(1.6, 225, Math.round(w / 2 - 16), q * 8);
      add(1.6, 237, h, q * 4); break;
    case 'VAG-1.69':
      add(1.6, 60, sw - 1, q * 4); add(1.6, 60, h - 30, q * 4); break;
    case 'HTG-064': case 'HTG-064DC':
      add(1.6, 60, w - 5, q * 2); add(1.6, 274, w - 5, q * 2);
      add(1.6, 60, h - 35, q * 4); add(1.6, 50, h, q * 3); break;
    case 'HTG-1.69':
      add(1.6, 60, sw - 5, q * 4); add(1.6, 274, sw - 5, q * 4);
      add(1.6, 60, h - 35, q * 4); add(1.6, 50, h, q * 6); break;
  }
  return rows;
}

const STRUCT_MULT: Record<string, number> = {
  'VT-01': 2, 'VAG-1.69': 2, 'HTG-1.69': 2,
};
const STRUCT_DEPTH: Record<string, number> = {
  'VT-01': 200, 'VT-049': 200, 'VT-064': 200, 'VA-064': 200,
  'VAG-1.69': 200, 'HTG-064': 300, 'HTG-064DC': 300, 'HTG-1.69': 300,
};
const STRUCT_WIDTH_CALC: Record<string, (w: number) => number> = {
  'VAG-1.69': w => Math.round(w / 2 - 30),
  'HTG-1.69': w => Math.round(w / 2 - 30),
};

// ─────────────────────────────────────────────────────────────────────────────
// 라우트
// ─────────────────────────────────────────────────────────────────────────────
export async function socketStockRoutes(app: FastifyInstance) {
  await migrateStockTables();

  // ── POST /api/socket-orders/:id/receive  — 입고 처리 ──
  app.post('/api/socket-orders/:id/receive', { preHandler: requireAuth }, async (req, reply) => {
    const soId = parseInt((req.params as any).id);
    const { worker_id } = req.body as any;

    // 발주서 조회
    const soRes = await pool.query(
      `SELECT so.*, po.project_id, po.project_name as po_project
       FROM socket_order so
       LEFT JOIN purchase_order po ON po.po_id = so.po_id
       WHERE so.so_id = $1`, [soId]
    );
    if (!soRes.rows[0]) return reply.code(404).send({ error: 'not_found' });
    const so = soRes.rows[0];

    if (so.received_at) return reply.code(400).send({ error: '이미 입고 처리된 발주서입니다.' });
    if (so.status !== 'APPROVED' && so.status !== 'SUBMITTED') {
      // 결재 미완료여도 입고는 가능 (실무 상 유연하게)
    }

    const items: any[] = so.items_json || [];
    if (items.length === 0) return reply.code(400).send({ error: '명세가 없습니다.' });

    const projectId = so.project_id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const item of items) {
        const code = (item.product_type || '').trim();
        const rawW = item.pipe_width_mm || 0;
        const h = item.pipe_height_mm || 0;
        const q = item.qty || 1;
        if (!rawW || !h || !code) continue;

        const swCalc = STRUCT_WIDTH_CALC[code];
        const sw = swCalc ? swCalc(rawW) : rawW;
        const depth = STRUCT_DEPTH[code] || 200;
        const mult = STRUCT_MULT[code] || 1;
        const socketQty = q * mult;

        // ─ 소켓 재고 upsert
        const sockRes = await client.query(`
          INSERT INTO socket_stock (project_id, product_type, width_mm, height_mm, depth_mm, qty)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (project_id, product_type, width_mm, height_mm, depth_mm)
          DO UPDATE SET qty = socket_stock.qty + $6, updated_at = NOW()
          RETURNING stock_id
        `, [projectId, code, sw, h, depth, socketQty]);

        // ─ 소켓 이력
        await client.query(`
          INSERT INTO stock_transaction (stock_type, stock_id, project_id, tx_type, qty, source_type, source_id, memo, created_by)
          VALUES ('SOCKET', $1, $2, 'IN', $3, 'SOCKET_ORDER', $4, $5, $6)
        `, [sockRes.rows[0].stock_id, projectId, socketQty, soId,
            `소켓발주서 입고 (${so.project_name || ''})`, worker_id || null]);

        // ─ 평철 재고 upsert
        const brackets = calcBracketsForStock(code, rawW, h, q);
        for (const b of brackets) {
          const brRes = await client.query(`
            INSERT INTO bracket_stock (project_id, material, thickness_t, width_mm, length_mm, qty)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (project_id, material, thickness_t, width_mm, length_mm)
            DO UPDATE SET qty = bracket_stock.qty + $6, updated_at = NOW()
            RETURNING stock_id
          `, [projectId, b.material, b.t, b.bw, b.l, b.qty]);

          await client.query(`
            INSERT INTO stock_transaction (stock_type, stock_id, project_id, tx_type, qty, source_type, source_id, memo, created_by)
            VALUES ('BRACKET', $1, $2, 'IN', $3, 'SOCKET_ORDER', $4, $5, $6)
          `, [brRes.rows[0].stock_id, projectId, b.qty, soId,
              String(`평철 입고 (${code})`), worker_id ? Number(worker_id) : null]);
        }
      }

      // 발주서 상태 업데이트
      await client.query(
        `UPDATE socket_order SET status='RECEIVED', received_at=NOW(), received_by=$1 WHERE so_id=$2`,
        [worker_id || null, soId]
      );

      await client.query('COMMIT');
      return { data: { success: true, message: '입고 처리 완료' } };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ── GET /api/socket-stock — 소켓 재고 현황 ──
  app.get('/api/socket-stock', { preHandler: requireAuth }, async (req) => {
    const { project_id } = req.query as any;
    let q = `
      SELECT ss.*,
             pm.project_name,
             SUM(ss.qty) OVER (PARTITION BY ss.product_type, ss.width_mm, ss.height_mm, ss.depth_mm) as total_qty
      FROM socket_stock ss
      LEFT JOIN project_master pm ON pm.project_id = ss.project_id
      WHERE ss.qty > 0
    `;
    const params: any[] = [];
    if (project_id) { params.push(parseInt(project_id)); q += ` AND ss.project_id = $${params.length}`; }
    q += ' ORDER BY ss.product_type, ss.width_mm, ss.height_mm';
    const res = await pool.query(q, params);
    return { data: res.rows };
  });

  // ── GET /api/bracket-stock — 평철 재고 현황 ──
  app.get('/api/bracket-stock', { preHandler: requireAuth }, async (req) => {
    const { project_id } = req.query as any;
    let q = `
      SELECT bs.*,
             pm.project_name,
             SUM(bs.qty) OVER (PARTITION BY bs.material, bs.thickness_t, bs.width_mm, bs.length_mm) as total_qty
      FROM bracket_stock bs
      LEFT JOIN project_master pm ON pm.project_id = bs.project_id
      WHERE bs.qty > 0
    `;
    const params: any[] = [];
    if (project_id) { params.push(parseInt(project_id)); q += ` AND bs.project_id = $${params.length}`; }
    q += ' ORDER BY bs.width_mm, bs.length_mm';
    const res = await pool.query(q, params);
    return { data: res.rows };
  });

  // ── GET /api/socket-stock/summary — 전체 집계 (현장별 합산) ──
  app.get('/api/socket-stock/summary', { preHandler: requireAuth }, async () => {
    const socket = await pool.query(`
      SELECT product_type, width_mm, height_mm, depth_mm, SUM(qty) as total_qty
      FROM socket_stock WHERE qty > 0
      GROUP BY product_type, width_mm, height_mm, depth_mm
      ORDER BY product_type, width_mm, height_mm
    `);
    const bracket = await pool.query(`
      SELECT material, thickness_t, width_mm, length_mm, SUM(qty) as total_qty
      FROM bracket_stock WHERE qty > 0
      GROUP BY material, thickness_t, width_mm, length_mm
      ORDER BY width_mm, length_mm
    `);
    return { data: { socket: socket.rows, bracket: bracket.rows } };
  });

  // ── POST /api/socket-stock/use — 소켓 사용 등록 (출고) ──
  app.post('/api/socket-stock/use', { preHandler: requireAuth }, async (req, reply) => {
    const { project_id, items, worker_id, memo } = req.body as {
      project_id: number;
      items: { stock_type: 'SOCKET'|'BRACKET'; stock_id: number; qty: number }[];
      worker_id: number;
      memo?: string;
    };
    if (!items || items.length === 0) return reply.code(400).send({ error: '사용 항목이 없습니다.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of items) {
        const table = item.stock_type === 'SOCKET' ? 'socket_stock' : 'bracket_stock';
        // 재고 차감
        const res = await client.query(
          `UPDATE ${table} SET qty = qty - $1, updated_at = NOW()
           WHERE stock_id = $2 AND qty >= $1
           RETURNING stock_id, qty`,
          [item.qty, item.stock_id]
        );
        if (res.rowCount === 0) {
          await client.query('ROLLBACK');
          return reply.code(400).send({ error: `재고 부족 (stock_id: ${item.stock_id})` });
        }
        // 이력 기록
        await client.query(`
          INSERT INTO stock_transaction (stock_type, stock_id, project_id, tx_type, qty, source_type, memo, created_by)
          VALUES ($1, $2, $3, 'OUT', $4, 'USAGE', $5, $6)
        `, [item.stock_type, item.stock_id, project_id, item.qty, memo || '현장 사용', worker_id]);
      }
      await client.query('COMMIT');
      return { data: { success: true } };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ── GET /api/stock-transactions — 입출고 이력 ──
  app.get('/api/stock-transactions', { preHandler: requireAuth }, async (req) => {
    const { project_id, stock_type, tx_type, limit = '50' } = req.query as any;
    let q = `
      SELECT st.*, w.worker_name as created_by_name,
             pm.project_name
      FROM stock_transaction st
      LEFT JOIN worker w ON w.worker_id = st.created_by
      LEFT JOIN project_master pm ON pm.project_id = st.project_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (project_id) { params.push(parseInt(project_id)); q += ` AND st.project_id = $${params.length}`; }
    if (stock_type) { params.push(stock_type); q += ` AND st.stock_type = $${params.length}`; }
    if (tx_type)    { params.push(tx_type);    q += ` AND st.tx_type = $${params.length}`; }
    q += ` ORDER BY st.created_at DESC LIMIT ${parseInt(limit)}`;
    const res = await pool.query(q, params);
    return { data: res.rows };
  });
}
