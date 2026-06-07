import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';

// ─────────────────────────────────────────────────────────────────────────────
// DB 마이그레이션
// ─────────────────────────────────────────────────────────────────────────────
async function migrateMaterialStock() {
  await pool.query(`
    -- 세라믹울(차열재) 재고
    CREATE TABLE IF NOT EXISTS ceramic_wool_stock (
      stock_id     SERIAL PRIMARY KEY,
      density_k    VARCHAR(20) NOT NULL DEFAULT '96K',   -- 96K, 100K, 128K 등
      insert_type  VARCHAR(10) NOT NULL DEFAULT '롤',    -- '롤' or '삽입'
      thickness_mm NUMERIC(5,1) NOT NULL,                -- 두께 (25, 38, 50 등)
      width_mm     INTEGER NOT NULL,                     -- 폭 (150, 200, 300, 400, 600, 1000 등)
      length_mm    INTEGER NOT NULL DEFAULT 0,           -- 한 롤 길이 (mm)
      qty          NUMERIC(10,2) DEFAULT 0,              -- 수량 (롤)
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ceramic_wool_unique
      ON ceramic_wool_stock(density_k, insert_type, thickness_mm, width_mm);
    CREATE INDEX IF NOT EXISTS idx_ceramic_wool_thickness ON ceramic_wool_stock(thickness_mm, width_mm);

    -- 압출 차열시트 재고
    CREATE TABLE IF NOT EXISTS extruded_sheet_stock (
      stock_id     SERIAL PRIMARY KEY,
      thickness_mm INTEGER NOT NULL,   -- 두께 (mm)
      width_mm     INTEGER NOT NULL,   -- 폭 (mm)
      qty          INTEGER DEFAULT 0,  -- 장 수
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_extruded_sheet_unique
      ON extruded_sheet_stock(thickness_mm, width_mm);

    -- 자재 입출고 이력 (세라믹울/압출시트 공통)
    CREATE TABLE IF NOT EXISTS material_stock_tx (
      tx_id        SERIAL PRIMARY KEY,
      stock_type   VARCHAR(20) NOT NULL,   -- 'CERAMIC_WOOL' | 'EXTRUDED_SHEET'
      stock_id     INTEGER NOT NULL,
      tx_type      VARCHAR(10) NOT NULL,   -- 'IN' | 'OUT'
      qty          NUMERIC(10,3) NOT NULL,
      source_type  VARCHAR(30),
      source_id    INTEGER,
      memo         TEXT,
      created_by   INTEGER REFERENCES worker(worker_id) ON DELETE SET NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_material_tx_type ON material_stock_tx(stock_type, stock_id);
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// 라우트
// ─────────────────────────────────────────────────────────────────────────────
export async function materialStockRoutes(app: FastifyInstance) {
  await migrateMaterialStock();

  // ── GET /api/ceramic-wool-stock ─────────────────────────────────────────
  app.get('/api/ceramic-wool-stock', { preHandler: requireAuth }, async () => {
    const r = await pool.query(`
      SELECT * FROM ceramic_wool_stock ORDER BY density_k, insert_type, thickness_mm, width_mm
    `);
    return { data: r.rows };
  });

  // ── POST /api/ceramic-wool-stock/receive — 입고 ─────────────────────────
  app.post('/api/ceramic-wool-stock/receive', { preHandler: requireAuth }, async (req, reply) => {
    const { items, memo, worker_id } = req.body as {
      items: { density_k: string; insert_type: string; thickness_mm: number; width_mm: number; length_mm: number; qty: number }[];
      memo?: string; worker_id?: number;
    };
    if (!items?.length) return reply.code(400).send({ error: '입고 항목이 없습니다.' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of items) {
        const res = await client.query(`
          INSERT INTO ceramic_wool_stock (density_k, insert_type, thickness_mm, width_mm, length_mm, qty)
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (density_k, insert_type, thickness_mm, width_mm)
          DO UPDATE SET qty = ceramic_wool_stock.qty + $6, length_mm=$5, updated_at=NOW()
          RETURNING stock_id
        `, [item.density_k, item.insert_type, item.thickness_mm, item.width_mm, item.length_mm || 0, item.qty]);
        await client.query(`
          INSERT INTO material_stock_tx (stock_type,stock_id,tx_type,qty,source_type,memo,created_by)
          VALUES ('CERAMIC_WOOL',$1,'IN',$2,'RECEIVE',$3,$4)
        `, [res.rows[0].stock_id, item.qty, memo || '입고', worker_id || null]);
      }
      await client.query('COMMIT');
      return { data: { success: true } };
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  // ── POST /api/ceramic-wool-stock/use — 출고 ────────────────────────────
  app.post('/api/ceramic-wool-stock/use', { preHandler: requireAuth }, async (req, reply) => {
    const { stock_id, qty, memo, worker_id, source_type, source_id } = req.body as any;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        `UPDATE ceramic_wool_stock SET qty=qty-$1, updated_at=NOW() WHERE stock_id=$2 AND qty>=$1 RETURNING stock_id`,
        [qty, stock_id]
      );
      if (!r.rowCount) { await client.query('ROLLBACK'); return reply.code(400).send({ error: '재고 부족' }); }
      await client.query(`
        INSERT INTO material_stock_tx (stock_type,stock_id,tx_type,qty,source_type,source_id,memo,created_by)
        VALUES ('CERAMIC_WOOL',$1,'OUT',$2,$3,$4,$5,$6)
      `, [stock_id, qty, source_type || 'USAGE', source_id || null, memo || '출고', worker_id || null]);
      await client.query('COMMIT');
      return { data: { success: true } };
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  // ── GET /api/extruded-sheet-stock ───────────────────────────────────────
  app.get('/api/extruded-sheet-stock', { preHandler: requireAuth }, async () => {
    const r = await pool.query(`SELECT * FROM extruded_sheet_stock ORDER BY thickness_mm, width_mm`);
    return { data: r.rows };
  });

  // ── POST /api/extruded-sheet-stock/receive — 입고 (압출 후 등록) ────────
  app.post('/api/extruded-sheet-stock/receive', { preHandler: requireAuth }, async (req, reply) => {
    const { items, memo, worker_id } = req.body as {
      items: { thickness_mm: number; width_mm: number; qty: number }[];
      memo?: string; worker_id?: number;
    };
    if (!items?.length) return reply.code(400).send({ error: '입고 항목이 없습니다.' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of items) {
        const res = await client.query(`
          INSERT INTO extruded_sheet_stock (thickness_mm, width_mm, qty)
          VALUES ($1,$2,$3)
          ON CONFLICT (thickness_mm, width_mm)
          DO UPDATE SET qty = extruded_sheet_stock.qty + $3, updated_at=NOW()
          RETURNING stock_id
        `, [item.thickness_mm, item.width_mm, item.qty]);
        await client.query(`
          INSERT INTO material_stock_tx (stock_type,stock_id,tx_type,qty,source_type,memo,created_by)
          VALUES ('EXTRUDED_SHEET',$1,'IN',$2,'RECEIVE',$3,$4)
        `, [res.rows[0].stock_id, item.qty, memo || '압출 후 입고', worker_id || null]);
      }
      await client.query('COMMIT');
      return { data: { success: true } };
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  // ── POST /api/extruded-sheet-stock/use — 출고 ──────────────────────────
  app.post('/api/extruded-sheet-stock/use', { preHandler: requireAuth }, async (req, reply) => {
    const { stock_id, qty, memo, worker_id, source_type, source_id } = req.body as any;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        `UPDATE extruded_sheet_stock SET qty=qty-$1, updated_at=NOW() WHERE stock_id=$2 AND qty>=$1 RETURNING stock_id`,
        [qty, stock_id]
      );
      if (!r.rowCount) { await client.query('ROLLBACK'); return reply.code(400).send({ error: '재고 부족' }); }
      await client.query(`
        INSERT INTO material_stock_tx (stock_type,stock_id,tx_type,qty,source_type,source_id,memo,created_by)
        VALUES ('EXTRUDED_SHEET',$1,'OUT',$2,$3,$4,$5,$6)
      `, [stock_id, qty, source_type || 'USAGE', source_id || null, memo || '출고', worker_id || null]);
      await client.query('COMMIT');
      return { data: { success: true } };
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  // ── GET /api/material-stock-transactions ────────────────────────────────
  app.get('/api/material-stock-transactions', { preHandler: requireAuth }, async (req) => {
    const { stock_type, limit = '50' } = req.query as any;
    let q = `
      SELECT t.*, w.worker_name as created_by_name
      FROM material_stock_tx t
      LEFT JOIN worker w ON w.worker_id = t.created_by
      WHERE 1=1
    `;
    const params: any[] = [];
    if (stock_type) { params.push(stock_type); q += ` AND t.stock_type=$${params.length}`; }
    q += ` ORDER BY t.created_at DESC LIMIT ${parseInt(limit)}`;
    const r = await pool.query(q, params);
    return { data: r.rows };
  });
}
