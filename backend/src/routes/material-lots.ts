import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';

// ─────────────────────────────────────────────────────────────────────────────
// DB 마이그레이션 — material_lots + material_transactions
// ─────────────────────────────────────────────────────────────────────────────
async function migrateMaterialLots() {
  await pool.query(`
    -- LOT별 현재 재고 마스터
    CREATE TABLE IF NOT EXISTS material_lots (
      lot_id        SERIAL PRIMARY KEY,
      lot_number    VARCHAR(60)  NOT NULL,
      category      VARCHAR(40)  NOT NULL DEFAULT '세라믹울',
        -- 세라믹울 | 차열재 | 그라스울 | 그라스울보드 | 소켓 | 기타부자재
      item_name     VARCHAR(200),
      density       NUMERIC(7,2),   -- K (밀도, kg/㎥)
      thickness     NUMERIC(7,2),   -- T (두께, mm)
      width_mm      NUMERIC(10,2),  -- W (폭, mm)
      length_mm     NUMERIC(12,2),  -- L (길이, mm 또는 m)
      depth_mm      NUMERIC(7,2),   -- D (소켓 깊이, mm)
      unit          VARCHAR(10)  DEFAULT 'EA',
      qty_current   NUMERIC(12,3) NOT NULL DEFAULT 0,
      location      VARCHAR(20)  DEFAULT '본재고',
        -- 시험용 | 출하대기 | 본재고
      supplier_name VARCHAR(200),
      supplier_lot  VARCHAR(100),   -- 밀시트 LOT
      received_date DATE,
      notes         TEXT,
      is_active     BOOLEAN DEFAULT TRUE,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_material_lots_lot
      ON material_lots(lot_number) WHERE is_active = TRUE;
    CREATE INDEX IF NOT EXISTS idx_material_lots_cat
      ON material_lots(category, location);
  `);

  await pool.query(`
    -- 수불 이력 원장
    CREATE TABLE IF NOT EXISTS material_transactions (
      txn_id         SERIAL PRIMARY KEY,
      txn_date       DATE        NOT NULL DEFAULT CURRENT_DATE,
      lot_id         INTEGER     NOT NULL REFERENCES material_lots(lot_id),
      lot_number     VARCHAR(60),   -- 빠른 조회용 비정규화
      category       VARCHAR(40),
      txn_type       VARCHAR(10) NOT NULL,
        -- IN | OUT | MOVE | ADJ
      qty            NUMERIC(12,3) NOT NULL,
        -- IN/MOVE-IN: 양수  |  OUT/MOVE-OUT: 음수  |  ADJ: 부호 포함
      qty_before     NUMERIC(12,3),
      qty_after      NUMERIC(12,3),
      source_type    VARCHAR(30),
        -- INCOMING_INSPECTION | BARCODE_SCAN | SHIPMENT | PRODUCTION | MANUAL
      source_id      INTEGER,
      location_from  VARCHAR(20),
      location_to    VARCHAR(20),
      project_name   VARCHAR(300),
      operator_id    INTEGER,
      notes          TEXT,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_material_txn_date
      ON material_transactions(txn_date, category);
    CREATE INDEX IF NOT EXISTS idx_material_txn_lot
      ON material_transactions(lot_id);
    CREATE INDEX IF NOT EXISTS idx_material_txn_lot_number
      ON material_transactions(lot_number);
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// 헬퍼: 트랜잭션 삽입 + 현재고 업데이트
// ─────────────────────────────────────────────────────────────────────────────
async function recordTransaction(client: any, {
  lot_id, lot_number, category, txn_type, qty, txn_date,
  source_type, source_id, location_from, location_to,
  project_name, operator_id, notes
}: {
  lot_id: number; lot_number: string; category: string;
  txn_type: 'IN' | 'OUT' | 'MOVE' | 'ADJ';
  qty: number; txn_date?: string;
  source_type?: string; source_id?: number;
  location_from?: string; location_to?: string;
  project_name?: string; operator_id?: number; notes?: string;
}) {
  const { rows: [lot] } = await client.query(
    `SELECT qty_current FROM material_lots WHERE lot_id=$1 FOR UPDATE`, [lot_id]
  );
  const qtyBefore = Number(lot.qty_current);
  const qtyAfter  = qtyBefore + qty;

  await client.query(
    `INSERT INTO material_transactions
      (txn_date,lot_id,lot_number,category,txn_type,qty,qty_before,qty_after,
       source_type,source_id,location_from,location_to,project_name,operator_id,notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [txn_date || new Date().toISOString().slice(0,10),
     lot_id, lot_number, category, txn_type, qty, qtyBefore, qtyAfter,
     source_type, source_id, location_from, location_to,
     project_name, operator_id, notes]
  );

  if (txn_type !== 'MOVE') {
    await client.query(
      `UPDATE material_lots SET qty_current=$1, updated_at=NOW() WHERE lot_id=$2`,
      [Math.max(0, qtyAfter), lot_id]
    );
  }
  if (txn_type === 'MOVE' && location_to) {
    await client.query(
      `UPDATE material_lots SET location=$1, updated_at=NOW() WHERE lot_id=$2`,
      [location_to, lot_id]
    );
  }
  return { qty_before: qtyBefore, qty_after: qtyAfter };
}

// ─────────────────────────────────────────────────────────────────────────────
// 라우트
// ─────────────────────────────────────────────────────────────────────────────
export async function materialLotsRoutes(app: FastifyInstance) {
  await migrateMaterialLots();

  // ── GET /api/material-lots ────────────────────────────────────────────────
  app.get('/api/material-lots', { preHandler: requireAuth }, async (req) => {
    const { category, location, search, active = '1' } = req.query as any;
    let sql = `
      SELECT ml.*,
        COALESCE(SUM(mt.qty) FILTER (WHERE mt.txn_type='IN' AND mt.txn_date = CURRENT_DATE), 0) AS today_in,
        COALESCE(SUM(ABS(mt.qty)) FILTER (WHERE mt.txn_type='OUT' AND mt.txn_date = CURRENT_DATE), 0) AS today_out
      FROM material_lots ml
      LEFT JOIN material_transactions mt USING(lot_id)
      WHERE 1=1
    `;
    const params: any[] = [];
    if (active !== '0') { sql += ` AND ml.is_active = TRUE`; }
    if (category) { params.push(category); sql += ` AND ml.category = $${params.length}`; }
    if (location) { params.push(location); sql += ` AND ml.location = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (ml.lot_number ILIKE $${params.length}
               OR ml.item_name ILIKE $${params.length}
               OR ml.notes ILIKE $${params.length})`;
    }
    sql += ` GROUP BY ml.lot_id ORDER BY ml.category, ml.density, ml.thickness, ml.width_mm, ml.lot_number`;
    const { rows } = await pool.query(sql, params);
    return { data: rows };
  });

  // ── GET /api/material-lots/:id ───────────────────────────────────────────
  app.get('/api/material-lots/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as any;
    const { rows: [lot] } = await pool.query(
      `SELECT * FROM material_lots WHERE lot_id=$1`, [id]
    );
    if (!lot) throw { statusCode: 404, message: 'LOT를 찾을 수 없습니다.' };
    const { rows: txns } = await pool.query(
      `SELECT * FROM material_transactions WHERE lot_id=$1 ORDER BY txn_date DESC, txn_id DESC LIMIT 100`,
      [id]
    );
    return { data: { ...lot, transactions: txns } };
  });

  // ── POST /api/material-lots (기초재고 등록) ───────────────────────────────
  app.post('/api/material-lots', { preHandler: requireAuth }, async (req) => {
    const b = req.body as any;
    const user = (req as any).user;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [lot] } = await client.query(
        `INSERT INTO material_lots
          (lot_number,category,item_name,density,thickness,width_mm,length_mm,depth_mm,
           unit,qty_current,location,supplier_name,supplier_lot,received_date,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
        [b.lot_number, b.category, b.item_name, b.density, b.thickness,
         b.width_mm, b.length_mm, b.depth_mm, b.unit || 'EA',
         b.qty_current || 0, b.location || '본재고',
         b.supplier_name, b.supplier_lot, b.received_date, b.notes]
      );
      // 기초재고 입고 트랜잭션 기록
      if ((b.qty_current || 0) > 0) {
        await client.query(
          `INSERT INTO material_transactions
            (txn_date,lot_id,lot_number,category,txn_type,qty,qty_before,qty_after,
             source_type,operator_id,notes)
           VALUES ($1,$2,$3,$4,'IN',$5,0,$5,'MANUAL',$6,'기초재고 등록')`,
          [b.received_date || new Date().toISOString().slice(0,10),
           lot.lot_id, lot.lot_number, lot.category, lot.qty_current,
           user?.worker_id || user?.user_id]
        );
      }
      await client.query('COMMIT');
      return { data: lot };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally { client.release(); }
  });

  // ── POST /api/material-lots/bulk (엑셀 일괄 등록) ──────────────────────────
  app.post('/api/material-lots/bulk', { preHandler: requireAuth }, async (req) => {
    const { lots } = req.body as { lots: any[] };
    const user = (req as any).user;
    const client = await pool.connect();
    const results = [];
    try {
      await client.query('BEGIN');
      for (const b of lots) {
        if (!b.lot_number || !b.category) continue;
        // 이미 있으면 건너뜀
        const { rows: exist } = await client.query(
          `SELECT lot_id FROM material_lots WHERE lot_number=$1 AND is_active=TRUE`,
          [b.lot_number]
        );
        if (exist.length) { results.push({ lot_number: b.lot_number, status: 'skip' }); continue; }
        const { rows: [lot] } = await client.query(
          `INSERT INTO material_lots
            (lot_number,category,item_name,density,thickness,width_mm,length_mm,
             unit,qty_current,location,supplier_name,supplier_lot,received_date,notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           RETURNING *`,
          [b.lot_number, b.category, b.item_name, b.density, b.thickness,
           b.width_mm, b.length_mm, b.unit || 'EA',
           b.qty_current || 0, b.location || '본재고',
           b.supplier_name, b.supplier_lot, b.received_date, b.notes]
        );
        if ((b.qty_current || 0) > 0) {
          await client.query(
            `INSERT INTO material_transactions
              (txn_date,lot_id,lot_number,category,txn_type,qty,qty_before,qty_after,source_type,operator_id,notes)
             VALUES ($1,$2,$3,$4,'IN',$5,0,$5,'MANUAL',$6,'기초재고 일괄등록')`,
            [b.received_date || new Date().toISOString().slice(0,10),
             lot.lot_id, lot.lot_number, lot.category, lot.qty_current,
             user?.worker_id || user?.user_id]
          );
        }
        results.push({ lot_number: b.lot_number, status: 'created', lot_id: lot.lot_id });
      }
      await client.query('COMMIT');
      return { data: results };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally { client.release(); }
  });

  // ── PATCH /api/material-lots/:id ─────────────────────────────────────────
  app.patch('/api/material-lots/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as any;
    const b = req.body as any;
    const fields: string[] = [];
    const vals: any[] = [];
    const allowed = ['item_name','category','density','thickness','width_mm','length_mm',
                     'depth_mm','unit','location','supplier_name','supplier_lot','received_date','notes'];
    for (const k of allowed) {
      if (b[k] !== undefined) { vals.push(b[k]); fields.push(`${k}=$${vals.length}`); }
    }
    if (!fields.length) throw { statusCode: 400, message: '수정할 필드가 없습니다.' };
    vals.push(id);
    const { rows: [lot] } = await pool.query(
      `UPDATE material_lots SET ${fields.join(',')}, updated_at=NOW() WHERE lot_id=$${vals.length} RETURNING *`,
      vals
    );
    return { data: lot };
  });

  // ── DELETE /api/material-lots/:id ─────────────────────────────────────────
  app.delete('/api/material-lots/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as any;
    await pool.query(`UPDATE material_lots SET is_active=FALSE WHERE lot_id=$1`, [id]);
    return { message: 'LOT가 비활성화되었습니다.' };
  });

  // ── GET /api/material-transactions ────────────────────────────────────────
  app.get('/api/material-transactions', { preHandler: requireAuth }, async (req) => {
    const { lot_id, category, txn_type, date_from, date_to,
            search, limit = '200', offset = '0' } = req.query as any;
    let sql = `
      SELECT mt.*, ml.item_name, ml.density, ml.thickness, ml.width_mm, ml.length_mm, ml.unit
      FROM material_transactions mt
      JOIN material_lots ml USING(lot_id)
      WHERE 1=1
    `;
    const params: any[] = [];
    if (lot_id)   { params.push(lot_id);  sql += ` AND mt.lot_id=$${params.length}`; }
    if (category) { params.push(category); sql += ` AND mt.category=$${params.length}`; }
    if (txn_type) { params.push(txn_type); sql += ` AND mt.txn_type=$${params.length}`; }
    if (date_from){ params.push(date_from); sql += ` AND mt.txn_date>=$${params.length}`; }
    if (date_to)  { params.push(date_to);  sql += ` AND mt.txn_date<=$${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (mt.lot_number ILIKE $${params.length} OR ml.item_name ILIKE $${params.length})`;
    }
    sql += ` ORDER BY mt.txn_date DESC, mt.txn_id DESC`;
    params.push(limit); sql += ` LIMIT $${params.length}`;
    params.push(offset); sql += ` OFFSET $${params.length}`;
    const { rows } = await pool.query(sql, params);
    return { data: rows };
  });

  // ── POST /api/material-transactions (입출고 기록) ──────────────────────────
  app.post('/api/material-transactions', { preHandler: requireAuth }, async (req) => {
    const b = req.body as any;
    const user = (req as any).user;
    if (!b.lot_id || !b.txn_type || !b.qty)
      throw { statusCode: 400, message: 'lot_id, txn_type, qty 필수' };

    const { rows: [lot] } = await pool.query(
      `SELECT * FROM material_lots WHERE lot_id=$1 AND is_active=TRUE`, [b.lot_id]
    );
    if (!lot) throw { statusCode: 404, message: 'LOT를 찾을 수 없습니다.' };

    const qty = b.txn_type === 'OUT' ? -Math.abs(Number(b.qty)) : Number(b.qty);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await recordTransaction(client, {
        lot_id: lot.lot_id,
        lot_number: lot.lot_number,
        category: lot.category,
        txn_type: b.txn_type,
        qty,
        txn_date: b.txn_date,
        source_type: b.source_type || 'MANUAL',
        source_id: b.source_id,
        location_from: lot.location,
        location_to: b.location_to,
        project_name: b.project_name,
        operator_id: user?.worker_id || user?.user_id,
        notes: b.notes,
      });
      await client.query('COMMIT');
      return { data: { ...result, lot_number: lot.lot_number } };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally { client.release(); }
  });

  // ── GET /api/material-ledger (수불대장 뷰) ─────────────────────────────────
  // 날짜별 전일이월 + 당일입고 + 당일출고 + 현재고
  app.get('/api/material-ledger', { preHandler: requireAuth }, async (req) => {
    const { date_from, date_to, category, location, lot_number } = req.query as any;
    const df = date_from || new Date().toISOString().slice(0,10);
    const dt = date_to   || new Date().toISOString().slice(0,10);

    const params: any[] = [df, dt];
    let catFilter = '';
    let locFilter = '';
    let lotFilter = '';
    if (category)   { params.push(category);   catFilter = `AND ml.category=$${params.length}`; }
    if (location)   { params.push(location);   locFilter = `AND ml.location=$${params.length}`; }
    if (lot_number) { params.push(`%${lot_number}%`); lotFilter = `AND ml.lot_number ILIKE $${params.length}`; }

    const sql = `
      WITH date_series AS (
        SELECT generate_series($1::date, $2::date, '1 day')::date AS d
      ),
      lot_dates AS (
        SELECT DISTINCT mt.lot_id, ds.d AS txn_date
        FROM material_transactions mt
        JOIN date_series ds ON mt.txn_date <= ds.d
        WHERE mt.txn_date BETWEEN ($1::date - INTERVAL '1 year') AND $2::date
      ),
      daily AS (
        SELECT
          mt.lot_id,
          mt.txn_date,
          COALESCE(SUM(mt.qty) FILTER (WHERE mt.txn_type='IN'),  0) AS qty_in,
          COALESCE(SUM(ABS(mt.qty)) FILTER (WHERE mt.txn_type='OUT'), 0) AS qty_out,
          COALESCE(SUM(mt.qty) FILTER (WHERE mt.txn_type='ADJ'), 0) AS qty_adj
        FROM material_transactions mt
        WHERE mt.txn_date BETWEEN $1 AND $2
        GROUP BY mt.lot_id, mt.txn_date
      )
      SELECT
        ld.txn_date,
        ml.lot_id,
        ml.lot_number,
        ml.category,
        ml.item_name,
        ml.density,
        ml.thickness,
        ml.width_mm,
        ml.length_mm,
        ml.unit,
        ml.location,
        ml.qty_current,
        COALESCE(d.qty_in,  0) AS qty_in,
        COALESCE(d.qty_out, 0) AS qty_out,
        COALESCE(d.qty_adj, 0) AS qty_adj
      FROM lot_dates ld
      JOIN material_lots ml ON ml.lot_id = ld.lot_id AND ml.is_active = TRUE
      LEFT JOIN daily d ON d.lot_id = ld.lot_id AND d.txn_date = ld.txn_date
      WHERE (d.qty_in IS NOT NULL OR d.qty_out IS NOT NULL OR d.qty_adj IS NOT NULL
             OR ld.txn_date = $2)
        ${catFilter} ${locFilter} ${lotFilter}
      ORDER BY ld.txn_date DESC, ml.category, ml.lot_number
    `;
    const { rows } = await pool.query(sql, params);
    return { data: rows };
  });

  // ── GET /api/material-stock-summary (카테고리별 집계) ──────────────────────
  app.get('/api/material-stock-summary', { preHandler: requireAuth }, async () => {
    const { rows } = await pool.query(`
      SELECT
        category,
        location,
        COUNT(*) AS lot_count,
        SUM(qty_current) AS total_qty
      FROM material_lots
      WHERE is_active = TRUE
      GROUP BY category, location
      ORDER BY category, location
    `);
    return { data: rows };
  });
}
