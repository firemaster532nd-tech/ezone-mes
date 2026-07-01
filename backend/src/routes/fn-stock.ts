import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';

// ─────────────────────────────────────────────────────────────────────────────
// DB 마이그레이션
// ─────────────────────────────────────────────────────────────────────────────
async function migrateFnStock() {
  // 1. 테이블 생성만 (인덱스 없이)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fn_finished_stock (
      stock_id    SERIAL PRIMARY KEY,
      diameter_mm INTEGER NOT NULL,
      spec        VARCHAR(30) NOT NULL,
      qty         INTEGER DEFAULT 0,
      qty_semi    INTEGER DEFAULT 0,
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS fn_material_stock (
      stock_id    SERIAL PRIMARY KEY,
      item_name   VARCHAR(50) NOT NULL,
      spec        VARCHAR(30) NOT NULL,
      qty         INTEGER DEFAULT 0,
      unit        VARCHAR(10) DEFAULT 'ea',
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS fn_stock_tx (
      tx_id       SERIAL PRIMARY KEY,
      tx_date     DATE DEFAULT CURRENT_DATE,
      tx_type     VARCHAR(10) NOT NULL,
      stock_type  VARCHAR(10) NOT NULL,
      stock_id    INTEGER,
      item_name   TEXT,
      spec        TEXT,
      qty         INTEGER,
      memo        TEXT,
      created_by  INTEGER,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS fn_daily_production (
      prod_id     SERIAL PRIMARY KEY,
      prod_date   DATE NOT NULL,
      item_name   TEXT NOT NULL,
      diameter_mm INTEGER,
      spec        TEXT,
      qty         INTEGER DEFAULT 0,
      lot_number  VARCHAR(50),
      worker_name TEXT,
      memo        TEXT,
      prod_type   VARCHAR(10) DEFAULT 'FINISHED',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // 2. 컬럼 추가 (반드시 인덱스보다 먼저)
  await pool.query(`ALTER TABLE fn_stock_tx ADD COLUMN IF NOT EXISTS lot_number     VARCHAR(50)`);
  await pool.query(`ALTER TABLE fn_stock_tx ADD COLUMN IF NOT EXISTS inspect_result VARCHAR(10)`);
  await pool.query(`ALTER TABLE fn_finished_stock ADD COLUMN IF NOT EXISTS qty_semi INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE fn_daily_production ADD COLUMN IF NOT EXISTS prod_type VARCHAR(10) DEFAULT 'FINISHED'`);

  // 3. 인덱스 (컬럼이 존재하는 상태에서)
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_fn_finished ON fn_finished_stock(diameter_mm, spec)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_fn_material ON fn_material_stock(item_name, spec)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_fn_stock_tx_date ON fn_stock_tx(tx_date DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_fn_stock_tx_lot  ON fn_stock_tx(lot_number)`);
  
  // uq_fn_daily 인덱스 재구성 (prod_type 포함)
  await pool.query(`DROP INDEX IF EXISTS uq_fn_daily`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_fn_daily ON fn_daily_production(prod_date, item_name, spec, prod_type)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_fn_daily_date ON fn_daily_production(prod_date DESC)`);

  // 4. 초기 데이터
  await pool.query(`
    INSERT INTO fn_finished_stock (diameter_mm, spec, qty) VALUES
      (100,'몸통',900),(100,'150H',0),(100,'170H',0),(100,'180H',0),
      (100,'190H',0),(100,'200H',0),(100,'210H',0),(100,'240H',0),
      (100,'250H',0),(100,'260H',0),(75,'몸통',0),(50,'몸통',1260)
    ON CONFLICT (diameter_mm, spec) DO NOTHING;

    INSERT INTO fn_material_stock (item_name, spec, qty, unit) VALUES
      ('보호철판','100파이',5759,'ea'),('보호철판','75파이',1030,'ea'),
      ('보호철판','50파이',2876,'ea'),('볼트,너트,와샤','-',35700,'ea'),
      ('시트(재단)','100파이',1063,'ea'),('시트(재단)','75파이',13,'ea'),
      ('시트(재단)','50파이',-533,'ea'),('시트(압출)','-',31,'ea'),
      ('소켓','100파이',0,'ea'),('소켓','75파이',0,'ea'),('소켓','50파이',0,'ea')
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
        COALESCE(
          (
            SELECT dp.lot_number FROM fn_daily_production dp
            WHERE dp.diameter_mm = f.diameter_mm AND dp.spec = f.spec AND dp.prod_type = 'FINISHED' AND dp.lot_number IS NOT NULL
            ORDER BY dp.prod_date DESC, dp.prod_id DESC LIMIT 1
          ),
          (
            SELECT t.lot_number FROM fn_stock_tx t
            WHERE t.stock_id = f.stock_id AND t.stock_type = 'FINISHED' AND t.tx_type = 'IN' AND t.lot_number IS NOT NULL
            ORDER BY t.created_at DESC LIMIT 1
          )
        ) AS last_finished_lot,
        (
          SELECT dp.lot_number FROM fn_daily_production dp
          WHERE dp.diameter_mm = f.diameter_mm AND dp.spec = f.spec AND dp.prod_type = 'SEMI' AND dp.lot_number IS NOT NULL
          ORDER BY dp.prod_date DESC, dp.prod_id DESC LIMIT 1
        ) AS last_semi_lot,
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
        if (item_name === '소켓') {
          // 1. 소켓 재고 증가
          const r1 = await client.query(
            `INSERT INTO fn_material_stock (item_name, spec, qty)
             VALUES ('소켓', $1, $2)
             ON CONFLICT (item_name, spec) DO UPDATE SET qty = fn_material_stock.qty + $2, updated_at = NOW()
             RETURNING stock_id`,
            [spec, qty]
          );
          stockId = r1.rows[0].stock_id;
          itemLabel = `소켓(${spec})`;

          // 2. 평철(보호철판) 재고 동시 증가
          const r2 = await client.query(
            `INSERT INTO fn_material_stock (item_name, spec, qty)
             VALUES ('보호철판', $1, $2)
             ON CONFLICT (item_name, spec) DO UPDATE SET qty = fn_material_stock.qty + $2, updated_at = NOW()
             RETURNING stock_id`,
            [spec, qty]
          );

          // 3. 소켓 입고 트랜잭션 기록
          await client.query(
            `INSERT INTO fn_stock_tx
               (tx_date, tx_type, stock_type, stock_id, item_name, spec, qty, lot_number, inspect_result, memo, created_by)
             VALUES ($1,'IN','MATERIAL',$2,$3,$4,$5,$6,$7,$8,$9)`,
            [tx_date || new Date(), stockId, itemLabel, spec, qty, lot_number, inspect_result, memo || null, created_by || null]
          );

          // 4. 평철(보호철판) 입고 트랜잭션 기록
          await client.query(
            `INSERT INTO fn_stock_tx
               (tx_date, tx_type, stock_type, stock_id, item_name, spec, qty, lot_number, inspect_result, memo, created_by)
             VALUES ($1,'IN','MATERIAL',$2,$3,$4,$5,$6,$7,$8,$9)`,
            [tx_date || new Date(), r2.rows[0].stock_id, `보호철판(${spec})`, spec, qty, lot_number, inspect_result, '소켓 입고에 따른 평철 자동 동시입고', created_by || null]
          );

          await client.query('COMMIT');
          return { data: { success: true, message: `소켓 및 평철(${spec}) ${qty}개 동시 입고 완료 (LOT: ${lot_number})` } };
        } else {
          const r = await client.query(
            `INSERT INTO fn_material_stock (item_name, spec, qty)
             VALUES ($1, $2, $3)
             ON CONFLICT (item_name, spec) DO UPDATE SET qty = fn_material_stock.qty + $3, updated_at = NOW()
             RETURNING stock_id`,
            [item_name, spec, qty]
          );
          stockId = r.rows[0].stock_id;
          itemLabel = `${item_name}(${spec})`;
        }
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
    const { year, month, prod_type } = req.query as any;
    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || new Date().getMonth() + 1;
    let queryStr = `SELECT * FROM fn_daily_production WHERE EXTRACT(YEAR FROM prod_date) = $1 AND EXTRACT(MONTH FROM prod_date) = $2`;
    const params: any[] = [y, m];
    if (prod_type) {
      params.push(prod_type);
      queryStr += ` AND prod_type = $${params.length}`;
    }
    queryStr += ` ORDER BY prod_date, item_name, spec`;
    const r = await pool.query(queryStr, params);
    return { data: r.rows };
  });

  // ── POST 일일 생산량 기록 ─────────────────────────────────────────────────
  app.post('/api/fn-stock/daily', { preHandler: requireAuth }, async (req, reply) => {
    const { prod_date, item_name, diameter_mm, spec, qty, lot_number, worker_name, memo, prod_type = 'FINISHED' } = req.body as any;
    if (!prod_date || !item_name || !spec) return reply.code(400).send({ error: 'prod_date, item_name, spec 필요' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. 기존 데이터 조회
      const prevRes = await client.query(
        `SELECT qty FROM fn_daily_production 
         WHERE prod_date = $1 AND item_name = $2 AND spec = $3 AND prod_type = $4`,
        [prod_date, item_name, spec, prod_type]
      );
      const prevQty = prevRes.rows[0] ? Number(prevRes.rows[0].qty) : 0;
      const delta = (qty || 0) - prevQty;

      if (delta !== 0) {
        const dia = diameter_mm || 100; // 기본 규격 지름
        const specName = `${dia}파이`;

        // 2. 재고 조정 분기
        if (prod_type === 'SEMI') {
          // --- 반제품 조립 등록: 부자재 차감 및 반제품 가산 ---
          // A. 소켓 차감
          await client.query(
            `UPDATE fn_material_stock SET qty = qty - $1, updated_at = NOW() WHERE item_name = '소켓' AND spec = $2`,
            [delta, specName]
          );
          // B. 보호철판 차감
          await client.query(
            `UPDATE fn_material_stock SET qty = qty - $1, updated_at = NOW() WHERE item_name = '보호철판' AND spec = $2`,
            [delta, specName]
          );
          // C. 볼트,너트,와샤 차감 (4ea)
          await client.query(
            `UPDATE fn_material_stock SET qty = qty - $1, updated_at = NOW() WHERE item_name = '볼트,너트,와샤'`,
            [delta * 4]
          );
          // D. 시트(재단) 차감
          await client.query(
            `UPDATE fn_material_stock SET qty = qty - $1, updated_at = NOW() WHERE item_name = '시트(재단)' AND spec = $2`,
            [delta, specName]
          );

          // E. 반제품 재고 가산 (fn_finished_stock.qty_semi)
          await client.query(
            `INSERT INTO fn_finished_stock (diameter_mm, spec, qty_semi)
             VALUES ($1, $2, $3)
             ON CONFLICT (diameter_mm, spec) DO UPDATE SET qty_semi = fn_finished_stock.qty_semi + $3, updated_at = NOW()`,
            [dia, spec, delta]
          );

          // F. 상세 입출고 트랜잭션 기록
          const socketStock = await client.query(`SELECT stock_id FROM fn_material_stock WHERE item_name='소켓' AND spec=$1`, [specName]);
          const plateStock = await client.query(`SELECT stock_id FROM fn_material_stock WHERE item_name='보호철판' AND spec=$1`, [specName]);
          const boltStock = await client.query(`SELECT stock_id FROM fn_material_stock WHERE item_name='볼트,너트,와샤'`);
          const sheetStock = await client.query(`SELECT stock_id FROM fn_material_stock WHERE item_name='시트(재단)' AND spec=$1`, [specName]);
          const finishedStock = await client.query(`SELECT stock_id FROM fn_finished_stock WHERE diameter_mm=$1 AND spec=$2`, [dia, spec]);

          if (socketStock.rows[0]) {
            await client.query(
              `INSERT INTO fn_stock_tx (tx_date, tx_type, stock_type, stock_id, item_name, spec, qty, lot_number, memo)
               VALUES ($1, 'OUT', 'MATERIAL', $2, '소켓', $3, $4, $5, '반제품 조립 소모')`,
              [prod_date, socketStock.rows[0].stock_id, specName, delta, lot_number]
            );
          }
          if (plateStock.rows[0]) {
            await client.query(
              `INSERT INTO fn_stock_tx (tx_date, tx_type, stock_type, stock_id, item_name, spec, qty, lot_number, memo)
               VALUES ($1, 'OUT', 'MATERIAL', $2, '보호철판', $3, $4, $5, '반제품 조립 소모')`,
              [prod_date, plateStock.rows[0].stock_id, specName, delta, lot_number]
            );
          }
          if (boltStock.rows[0]) {
            await client.query(
              `INSERT INTO fn_stock_tx (tx_date, tx_type, stock_type, stock_id, item_name, spec, qty, lot_number, memo)
               VALUES ($1, 'OUT', 'MATERIAL', $2, '볼트,너트,와샤', '-', $3, $4, '반제품 조립 소모')`,
              [prod_date, boltStock.rows[0].stock_id, delta * 4, lot_number]
            );
          }
          if (sheetStock.rows[0]) {
            await client.query(
              `INSERT INTO fn_stock_tx (tx_date, tx_type, stock_type, stock_id, item_name, spec, qty, lot_number, memo)
               VALUES ($1, 'OUT', 'MATERIAL', $2, '시트(재단)', $3, $4, $5, '반제품 조립 소모')`,
              [prod_date, sheetStock.rows[0].stock_id, specName, delta, lot_number]
            );
          }
          if (finishedStock.rows[0]) {
            await client.query(
              `INSERT INTO fn_stock_tx (tx_date, tx_type, stock_type, stock_id, item_name, spec, qty, lot_number, memo)
               VALUES ($1, 'IN', 'FINISHED', $2, $3, $4, $5, $6, '반제품 조립 생산')`,
              [prod_date, finishedStock.rows[0].stock_id, `발포소켓 반제품(${dia}파이 ${spec})`, spec, delta, lot_number]
            );
          }
        } else {
          // --- 완제품 생산 등록: 반제품 차감 및 완제품 가산 ---
          // A. 반제품 재고 차감 (fn_finished_stock.qty_semi)
          await client.query(
            `UPDATE fn_finished_stock SET qty_semi = qty_semi - $1, updated_at = NOW()
             WHERE diameter_mm = $2 AND spec = $3`,
            [delta, dia, spec]
          );

          // B. 완제품 재고 가산 (fn_finished_stock.qty)
          await client.query(
            `UPDATE fn_finished_stock SET qty = qty + $1, updated_at = NOW()
             WHERE diameter_mm = $2 AND spec = $3`,
            [delta, dia, spec]
          );

          // C. 상세 입출고 트랜잭션 기록
          const finishedStock = await client.query(`SELECT stock_id FROM fn_finished_stock WHERE diameter_mm=$1 AND spec=$2`, [dia, spec]);
          if (finishedStock.rows[0]) {
            // 반제품 소모 기록
            await client.query(
              `INSERT INTO fn_stock_tx (tx_date, tx_type, stock_type, stock_id, item_name, spec, qty, lot_number, memo)
               VALUES ($1, 'OUT', 'FINISHED', $2, $3, $4, $5, $6, '완제품 생산을 위한 반제품 소모')`,
              [prod_date, finishedStock.rows[0].stock_id, `발포소켓 반제품(${dia}파이 ${spec})`, spec, delta, lot_number]
            );
            // 완제품 생산 기록
            await client.query(
              `INSERT INTO fn_stock_tx (tx_date, tx_type, stock_type, stock_id, item_name, spec, qty, lot_number, memo)
               VALUES ($1, 'IN', 'FINISHED', $2, $3, $4, $5, $6, '구조체 완제품 조립 생산 완료')`,
              [prod_date, finishedStock.rows[0].stock_id, `발포소켓 완제품(${dia}파이 ${spec})`, spec, delta, lot_number]
            );
          }
        }
      }

      // 3. 일일 생산량 등록 처리
      const r = await client.query(
        `INSERT INTO fn_daily_production (prod_date, item_name, diameter_mm, spec, qty, lot_number, worker_name, memo, prod_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (prod_date, item_name, spec, prod_type) DO UPDATE
           SET qty = $5, lot_number = $6, worker_name = $7, memo = $8
         RETURNING *`,
        [prod_date, item_name, diameter_mm || null, spec, qty || 0, lot_number || null, worker_name || null, memo || null, prod_type]
      );

      await client.query('COMMIT');
      return { data: r.rows[0] };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });

  // ── DELETE 일일 생산량 삭제 (관리자용 + 재고 복구) ───────────────────────────
  app.delete('/api/fn-stock/daily/:prod_id', { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth;
    if (!auth || auth.role !== 'admin') {
      return reply.code(403).send({ error: '관리자 권한이 필요합니다.' });
    }

    const id = parseInt((req.params as any).prod_id);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. 기존 데이터 조회
      const rProd = await client.query('SELECT * FROM fn_daily_production WHERE prod_id = $1', [id]);
      if (!rProd.rows[0]) {
        return reply.code(404).send({ error: '해당 생산 기록이 존재하지 않습니다.' });
      }

      const prod = rProd.rows[0];
      const prevQty = Number(prod.qty);
      const delta = -prevQty; // 수량을 0으로 환원

      if (delta !== 0) {
        const dia = prod.diameter_mm || 100;
        const specName = `${dia}파이`;

        if (prod.prod_type === 'SEMI') {
          // 반제품 생산 취소 -> 원자재 복원 및 반제품 차감
          await client.query(`UPDATE fn_material_stock SET qty = qty - $1, updated_at = NOW() WHERE item_name = '소켓' AND spec = $2`, [delta, specName]);
          await client.query(`UPDATE fn_material_stock SET qty = qty - $1, updated_at = NOW() WHERE item_name = '보호철판' AND spec = $2`, [delta, specName]);
          await client.query(`UPDATE fn_material_stock SET qty = qty - $1, updated_at = NOW() WHERE item_name = '볼트,너트,와샤'`, [delta * 4]);
          await client.query(`UPDATE fn_material_stock SET qty = qty - $1, updated_at = NOW() WHERE item_name = '시트(재단)' AND spec = $2`, [delta, specName]);
          await client.query(`UPDATE fn_finished_stock SET qty_semi = qty_semi + $1, updated_at = NOW() WHERE diameter_mm = $2 AND spec = $3`, [delta, dia, prod.spec]);
        } else {
          // 완제품 생산 취소 -> 반제품 복원 및 완제품 차감
          await client.query(`UPDATE fn_finished_stock SET qty_semi = qty_semi - $1, updated_at = NOW() WHERE diameter_mm = $2 AND spec = $3`, [delta, dia, prod.spec]);
          await client.query(`UPDATE fn_finished_stock SET qty = qty + $1, updated_at = NOW() WHERE diameter_mm = $2 AND spec = $3`, [delta, dia, prod.spec]);
        }

        // 복구 트랜잭션 기록 적재
        const finishedStock = await client.query(`SELECT stock_id FROM fn_finished_stock WHERE diameter_mm=$1 AND spec=$2`, [dia, prod.spec]);
        if (finishedStock.rows[0]) {
          await client.query(
            `INSERT INTO fn_stock_tx (tx_date, tx_type, stock_type, stock_id, item_name, spec, qty, memo)
             VALUES ($1, 'ADJUST', 'FINISHED', $2, $3, $4, $5, '생산 기록 삭제로 인한 재고 복구')`,
            [prod.prod_date, finishedStock.rows[0].stock_id, `${prod.item_name}(${prod.spec})`, prod.spec, delta]
          );
        }
      }

      // 2. 생산 기록 삭제
      await client.query('DELETE FROM fn_daily_production WHERE prod_id = $1', [id]);

      await client.query('COMMIT');
      return { data: { success: true, message: '생산량 삭제 및 재고 복구 완료' } };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });

  // ── DELETE 입출고 이력 삭제 (관리자용 + 재고 복구) ───────────────────────────
  app.delete('/api/fn-stock/transactions/:tx_id', { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth;
    if (!auth || auth.role !== 'admin') {
      return reply.code(403).send({ error: '관리자 권한이 필요합니다.' });
    }

    const txId = parseInt((req.params as any).tx_id);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. 트랜잭션 정보 조회
      const rTx = await client.query('SELECT * FROM fn_stock_tx WHERE tx_id = $1', [txId]);
      if (!rTx.rows[0]) {
        return reply.code(404).send({ error: '해당 트랜잭션이 존재하지 않습니다.' });
      }

      const tx = rTx.rows[0];
      const qty = Number(tx.qty);
      const stockId = tx.stock_id;

      // 2. 재고 복구 연산
      if (stockId) {
        if (tx.stock_type === 'FINISHED') {
          const isSemi = tx.item_name && (tx.item_name.includes('반제품') || tx.item_name.includes('SEMI'));
          
          if (tx.tx_type === 'IN') {
            if (isSemi) {
              await client.query('UPDATE fn_finished_stock SET qty_semi = qty_semi - $1, updated_at = NOW() WHERE stock_id = $2', [qty, stockId]);
            } else {
              await client.query('UPDATE fn_finished_stock SET qty = qty - $1, updated_at = NOW() WHERE stock_id = $2', [qty, stockId]);
            }
          } else if (tx.tx_type === 'OUT') {
            if (isSemi) {
              await client.query('UPDATE fn_finished_stock SET qty_semi = qty_semi + $1, updated_at = NOW() WHERE stock_id = $2', [qty, stockId]);
            } else {
              await client.query('UPDATE fn_finished_stock SET qty = qty + $1, updated_at = NOW() WHERE stock_id = $2', [qty, stockId]);
            }
          }
        } else if (tx.stock_type === 'MATERIAL') {
          if (tx.tx_type === 'IN') {
            await client.query('UPDATE fn_material_stock SET qty = qty - $1, updated_at = NOW() WHERE stock_id = $2', [qty, stockId]);
          } else if (tx.tx_type === 'OUT') {
            await client.query('UPDATE fn_material_stock SET qty = qty + $1, updated_at = NOW() WHERE stock_id = $2', [qty, stockId]);
          } else if (tx.tx_type === 'ADJUST') {
            await client.query('UPDATE fn_material_stock SET qty = qty - $1, updated_at = NOW() WHERE stock_id = $2', [qty, stockId]);
          }
        }
      }

      // 3. 트랜잭션 삭제
      await client.query('DELETE FROM fn_stock_tx WHERE tx_id = $1', [txId]);

      await client.query('COMMIT');
      return { data: { success: true, message: '이력 삭제 및 재고 복구 완료' } };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });
}
