import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';

// ─────────────────────────────────────────────────────────────────────────────
// DB 마이그레이션
// ─────────────────────────────────────────────────────────────────────────────
async function migrateFnStock() {
  await pool.query(`
    -- 완제품 재고 (발포소켓 몸체)
    CREATE TABLE IF NOT EXISTS fn_finished_stock (
      stock_id    SERIAL PRIMARY KEY,
      diameter_mm INTEGER NOT NULL,
      spec        VARCHAR(30) NOT NULL,
      qty         INTEGER DEFAULT 0,
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_fn_finished ON fn_finished_stock(diameter_mm, spec);

    -- 부자재 재고
    CREATE TABLE IF NOT EXISTS fn_material_stock (
      stock_id    SERIAL PRIMARY KEY,
      item_name   VARCHAR(50) NOT NULL,
      spec        VARCHAR(30) NOT NULL,
      qty         INTEGER DEFAULT 0,
      unit        VARCHAR(10) DEFAULT 'ea',
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_fn_material ON fn_material_stock(item_name, spec);

    -- 인수검사 + 입고이력 (로트번호 포함)
    CREATE TABLE IF NOT EXISTS fn_stock_tx (
      tx_id          SERIAL PRIMARY KEY,
      tx_date        DATE DEFAULT CURRENT_DATE,
      tx_type        VARCHAR(10) NOT NULL,   -- IN / OUT / ADJUST / PRODUCE
      stock_type     VARCHAR(10) NOT NULL,   -- FINISHED / MATERIAL
      stock_id       INTEGER,
      item_name      TEXT,
      spec           TEXT,
      qty            INTEGER,
      lot_number     VARCHAR(50),            -- ★ 입고로트번호
      inspect_result VARCHAR(10),            -- PASS / FAIL / PENDING
      memo           TEXT,
      created_by     INTEGER,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_fn_stock_tx_date ON fn_stock_tx(tx_date DESC);
    CREATE INDEX IF NOT EXISTS idx_fn_stock_tx_lot  ON fn_stock_tx(lot_number);

    -- 일일 생산량 기록 (엑셀 시트 형식)
    CREATE TABLE IF NOT EXISTS fn_daily_production (
      prod_id     SERIAL PRIMARY KEY,
      prod_date   DATE NOT NULL,
      item_name   TEXT NOT NULL,    -- 발포소켓 몸체(100) / 보호철판/100 등
      diameter_mm INTEGER,
      spec        TEXT,
      qty         INTEGER DEFAULT 0,
      lot_number  VARCHAR(50),      -- 생산 로트
      worker_name TEXT,
      memo        TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_fn_daily ON fn_daily_production(prod_date, item_name, spec);
    CREATE INDEX IF NOT EXISTS idx_fn_daily_date ON fn_daily_production(prod_date DESC);

    -- 기존 lot_number 컬럼 없으면 추가
    ALTER TABLE fn_stock_tx ADD COLUMN IF NOT EXISTS lot_number     VARCHAR(50);
    ALTER TABLE fn_stock_tx ADD COLUMN IF NOT EXISTS inspect_result VARCHAR(10);
  `);

  // 초기 데이터
  await pool.query(`
    INSERT INTO fn_finished_stock (diameter_mm, spec, qty) VALUES
      (100, '몸통', 900),(100, '150H', 0),(100, '170H', 0),(100, '180H', 0),
      (100, '190H', 0),(100, '200H', 0),(100, '210H', 0),(100, '240H', 0),
      (100, '250H', 0),(100, '260H', 0),(75, '몸통', 0),(50, '몸통', 1260)
    ON CONFLICT (diameter_mm, spec) DO NOTHING;

    INSERT INTO fn_material_stock (item_name, spec, qty, unit) VALUES
      ('보호철판','100파이',5759,'ea'),('보호철판','75파이',1030,'ea'),
      ('보호철판','50파이',2876,'ea'),('볼트,너트,와샤','-',35700,'ea'),
      ('시트(재단)','100파이',1063,'ea'),('시트(재단)','75파이',13,'ea'),
      ('시트(재단)','50파이',-533,'ea'),('시트(압출)','-',31,'ea')
    ON CONFLICT (item_name, spec) DO NOTHING;
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// 라우트
// ─────────────────────────────────────────────────────────────────────────────
export async function fnStockRoutes(app: FastifyInstance) {
  await migrateFnStock();

  // ── GET 완제품 재고 (최근 로트번호 포함) ──────────────────────────────────
  app.get('/api/fn-stock/finished', { preHandler: requireAuth }, async () => {
    const r = await pool.query(`
      SELECT f.*,
        (
          SELECT t.lot_number FROM fn_stock_tx t
          WHERE t.stock_id = f.stock_id AND t.stock_type = 'FINISHED' AND t.tx_type = 'IN'
            AND t.lot_number IS NOT NULL
          ORDER BY t.created_at DESC LIMIT 1
        ) AS last_lot_number,
        (
          SELECT t.tx_date FROM fn_stock_tx t
          WHERE t.stock_id = f.stock_id AND t.stock_type = 'FINISHED' AND t.tx_type = 'IN'
          ORDER BY t.created_at DESC LIMIT 1
        ) AS last_receive_date
      FROM fn_finished_stock f
      ORDER BY f.diameter_mm DESC, f.spec
    `);
    return { data: r.rows };
  });

  // ── GET 부자재 재고 (최근 로트번호 포함) ────────────────────────────────
  app.get('/api/fn-stock/material', { preHandler: requireAuth }, async () => {
    const r = await pool.query(`
      SELECT m.*,
        (
          SELECT t.lot_number FROM fn_stock_tx t
          WHERE t.stock_id = m.stock_id AND t.stock_type = 'MATERIAL' AND t.tx_type = 'IN'
            AND t.lot_number IS NOT NULL
          ORDER BY t.created_at DESC LIMIT 1
        ) AS last_lot_number,
        (
          SELECT t.tx_date FROM fn_stock_tx t
          WHERE t.stock_id = m.stock_id AND t.stock_type = 'MATERIAL'
          ORDER BY t.created_at DESC LIMIT 1
        ) AS last_tx_date
      FROM fn_material_stock m
      ORDER BY m.item_name, m.spec
    `);
    return { data: r.rows };
  });

  // ── GET 입출고 이력 (로트번호 포함) ──────────────────────────────────────
  app.get('/api/fn-stock/transactions', { preHandler: requireAuth }, async (req) => {
    const { stock_type, tx_type, limit = '100' } = req.query as any;
    let q = `SELECT * FROM fn_stock_tx WHERE 1=1`;
    const params: any[] = [];
    if (stock_type) { params.push(stock_type); q += ` AND stock_type=$${params.length}`; }
    if (tx_type)    { params.push(tx_type);    q += ` AND tx_type=$${params.length}`; }
    q += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));
    const r = await pool.query(q, params);
    return { data: r.rows };
  });

  // ── POST 입고 (인수검사 + 로트번호 필수) ─────────────────────────────────
  app.post('/api/fn-stock/receive', { preHandler: requireAuth }, async (req, reply) => {
    const {
      stock_type, diameter_mm, spec, item_name,
      qty, lot_number, inspect_result = 'PASS',
      memo, created_by, tx_date
    } = req.body as any;

    if (!qty || qty <= 0) return reply.code(400).send({ error: '수량은 1 이상이어야 합니다.' });
    if (!lot_number?.trim()) return reply.code(400).send({ error: '입고 로트번호는 필수입니다.' });
    if (inspect_result === 'FAIL') {
      // 불합격 시 재고 반영 없이 이력만 기록
      await pool.query(
        `INSERT INTO fn_stock_tx (tx_date, tx_type, stock_type, item_name, spec, qty, lot_number, inspect_result, memo, created_by)
         VALUES ($1,'IN',$2,$3,$4,$5,$6,'FAIL',$7,$8)`,
        [tx_date || new Date(), stock_type,
         stock_type === 'FINISHED' ? `발포소켓(${diameter_mm}파이 ${spec})` : item_name,
         spec || '', qty, lot_number, memo || '인수검사 불합격', created_by || null]
      );
      return { data: { success: false, message: '인수검사 불합격 — 재고 미반영, 이력 기록됨' } };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let stockId: number | null = null;
      let itemLabel = '';

      if (stock_type === 'FINISHED') {
        if (!diameter_mm || !spec) return reply.code(400).send({ error: 'diameter_mm, spec 필요' });
        const r = await client.query(
          `INSERT INTO fn_finished_stock (diameter_mm, spec, qty)
           VALUES ($1, $2, $3)
           ON CONFLICT (diameter_mm, spec) DO UPDATE SET qty = fn_finished_stock.qty + $3, updated_at = NOW()
           RETURNING stock_id`,
          [diameter_mm, spec, qty]
        );
        stockId = r.rows[0].stock_id;
        itemLabel = `발포소켓(${diameter_mm}파이 ${spec})`;
      } else if (stock_type === 'MATERIAL') {
        if (!item_name || !spec) return reply.code(400).send({ error: 'item_name, spec 필요' });
        const r = await client.query(
          `INSERT INTO fn_material_stock (item_name, spec, qty)
           VALUES ($1, $2, $3)
           ON CONFLICT (item_name, spec) DO UPDATE SET qty = fn_material_stock.qty + $3, updated_at = NOW()
           RETURNING stock_id`,
          [item_name, spec, qty]
        );
        stockId = r.rows[0].stock_id;
        itemLabel = `${item_name}(${spec})`;
      } else {
        return reply.code(400).send({ error: 'stock_type: FINISHED | MATERIAL' });
      }

      await client.query(
        `INSERT INTO fn_stock_tx
           (tx_date, tx_type, stock_type, stock_id, item_name, spec, qty, lot_number, inspect_result, memo, created_by)
         VALUES ($1,'IN',$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [tx_date || new Date(), stock_type, stockId,
         itemLabel, spec || '', qty, lot_number, inspect_result,
         memo || null, created_by || null]
      );

      await client.query('COMMIT');
      return { data: { success: true, message: `${itemLabel} ${qty}개 입고 완료 (LOT: ${lot_number})` } };
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  // ── POST 출고 ─────────────────────────────────────────────────────────────
  app.post('/api/fn-stock/ship', { preHandler: requireAuth }, async (req, reply) => {
    const { diameter_mm, spec, qty, lot_number, memo, created_by, tx_date } = req.body as any;
    if (!diameter_mm || !spec || !qty) return reply.code(400).send({ error: 'diameter_mm, spec, qty 필요' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        `UPDATE fn_finished_stock SET qty = qty - $1, updated_at = NOW()
         WHERE diameter_mm = $2 AND spec = $3 RETURNING stock_id, qty`,
        [qty, diameter_mm, spec]
      );
      if (!r.rows[0]) return reply.code(404).send({ error: '해당 품목 없음' });
      const label = `발포소켓(${diameter_mm}파이 ${spec})`;
      await client.query(
        `INSERT INTO fn_stock_tx
           (tx_date, tx_type, stock_type, stock_id, item_name, spec, qty, lot_number, memo, created_by)
         VALUES ($1,'OUT','FINISHED',$2,$3,$4,$5,$6,$7,$8)`,
        [tx_date || new Date(), r.rows[0].stock_id, label, spec, qty,
         lot_number || null, memo || null, created_by || null]
      );
      await client.query('COMMIT');
      return { data: { success: true, remaining_qty: r.rows[0].qty } };
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  // ── PATCH 부자재 수량 조정 ────────────────────────────────────────────────
  app.patch('/api/fn-stock/material/:stock_id/adjust', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).stock_id);
    const { qty_delta, memo, created_by } = req.body as any;
    if (qty_delta === undefined) return reply.code(400).send({ error: 'qty_delta 필요' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        `UPDATE fn_material_stock SET qty = qty + $1, updated_at = NOW()
         WHERE stock_id = $2 RETURNING *`,
        [qty_delta, id]
      );
      if (!r.rows[0]) return reply.code(404).send({ error: '해당 품목 없음' });
      await client.query(
        `INSERT INTO fn_stock_tx (tx_type, stock_type, stock_id, item_name, spec, qty, memo, created_by)
         VALUES ('ADJUST','MATERIAL',$1,$2,$3,$4,$5,$6)`,
        [id, r.rows[0].item_name, r.rows[0].spec, qty_delta, memo || null, created_by || null]
      );
      await client.query('COMMIT');
      return { data: r.rows[0] };
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  // ── GET 일일 생산량 (월별) ────────────────────────────────────────────────
  app.get('/api/fn-stock/daily', { preHandler: requireAuth }, async (req) => {
    const { year, month } = req.query as any;
    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || new Date().getMonth() + 1;
    const r = await pool.query(
      `SELECT * FROM fn_daily_production
       WHERE EXTRACT(YEAR FROM prod_date) = $1 AND EXTRACT(MONTH FROM prod_date) = $2
       ORDER BY prod_date, item_name, spec`,
      [y, m]
    );
    return { data: r.rows };
  });

  // ── POST 일일 생산량 기록 ─────────────────────────────────────────────────
  app.post('/api/fn-stock/daily', { preHandler: requireAuth }, async (req, reply) => {
    const { prod_date, item_name, diameter_mm, spec, qty, lot_number, worker_name, memo } = req.body as any;
    if (!prod_date || !item_name || !spec) return reply.code(400).send({ error: 'prod_date, item_name, spec 필요' });

    const r = await pool.query(
      `INSERT INTO fn_daily_production (prod_date, item_name, diameter_mm, spec, qty, lot_number, worker_name, memo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (prod_date, item_name, spec) DO UPDATE
         SET qty = $5, lot_number = $6, worker_name = $7, memo = $8
       RETURNING *`,
      [prod_date, item_name, diameter_mm || null, spec, qty || 0, lot_number || null, worker_name || null, memo || null]
    );
    return { data: r.rows[0] };
  });

  // ── DELETE 일일 생산량 삭제 ───────────────────────────────────────────────
  app.delete('/api/fn-stock/daily/:prod_id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).prod_id);
    await pool.query(`DELETE FROM fn_daily_production WHERE prod_id = $1`, [id]);
    return { data: { success: true } };
  });
}
