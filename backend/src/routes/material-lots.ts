import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../lib/auth-plugin.js';

// ─────────────────────────────────────────────────────────────────────────────
// DB 마이그레이션 — material_lots + material_transactions
// ─────────────────────────────────────────────────────────────────────────────
async function migrateMaterialLots() {
  const run = async (sql: string, label: string) => {
    try { await pool.query(sql); }
    catch (e: any) { console.warn(`[migrate] ${label} 스킵:`, e?.message?.slice(0, 120)); }
  };

  await run(`
    CREATE TABLE IF NOT EXISTS material_lots (
      lot_id        SERIAL PRIMARY KEY,
      lot_number    VARCHAR(60)  NOT NULL,
      category      VARCHAR(40)  NOT NULL DEFAULT '세라믹울',
      item_name     VARCHAR(200),
      density       NUMERIC(7,2),
      thickness     NUMERIC(7,2),
      width_mm      NUMERIC(10,2),
      length_mm     NUMERIC(12,2),
      depth_mm      NUMERIC(7,2),
      unit          VARCHAR(10)  DEFAULT 'EA',
      qty_current   NUMERIC(12,3) NOT NULL DEFAULT 0,
      location      VARCHAR(20)  DEFAULT '본재고',
      supplier_name VARCHAR(200),
      supplier_lot  VARCHAR(100),
      received_date DATE,
      notes         TEXT,
      is_active     BOOLEAN DEFAULT TRUE,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `, 'material_lots 테이블');

  await run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_material_lots_lot
       ON material_lots(lot_number) WHERE (is_active = TRUE)`,
    'idx_material_lots_lot'
  );

  await run(
    `CREATE INDEX IF NOT EXISTS idx_material_lots_cat
       ON material_lots(category, location)`,
    'idx_material_lots_cat'
  );

  await run(`
    CREATE TABLE IF NOT EXISTS material_transactions (
      txn_id         SERIAL PRIMARY KEY,
      txn_date       DATE        NOT NULL DEFAULT CURRENT_DATE,
      lot_id         INTEGER     NOT NULL REFERENCES material_lots(lot_id),
      lot_number     VARCHAR(60),
      category       VARCHAR(40),
      txn_type       VARCHAR(10) NOT NULL,
      qty            NUMERIC(12,3) NOT NULL,
      qty_before     NUMERIC(12,3),
      qty_after      NUMERIC(12,3),
      source_type    VARCHAR(30),
      source_id      INTEGER,
      location_from  VARCHAR(20),
      location_to    VARCHAR(20),
      project_name   VARCHAR(300),
      operator_id    INTEGER,
      notes          TEXT,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `, 'material_transactions 테이블');

  await run(
    `CREATE INDEX IF NOT EXISTS idx_material_txn_date ON material_transactions(txn_date, category)`,
    'idx_material_txn_date'
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_material_txn_lot ON material_transactions(lot_id)`,
    'idx_material_txn_lot'
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_material_txn_lot_number ON material_transactions(lot_number)`,
    'idx_material_txn_lot_number'
  );
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
    const { category, location, search, active = '1', stock_type } = req.query as any;
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
    if (stock_type) { params.push(stock_type); sql += ` AND ml.stock_type = $${params.length}`; }
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

  // ── GET /api/material-lots/next-lot ──────────────────────────────────────
  app.get('/api/material-lots/next-lot', { preHandler: requireAuth }, async (req) => {
    const { abbrev = 'CW', date } = req.query as any;
    const yymmdd = date || new Date().toISOString().replace(/-/g,'').slice(2,8);
    const pattern = `${yymmdd}${abbrev}%`;
    const { rows } = await pool.query(
      `SELECT lot_number FROM material_lots WHERE lot_number LIKE $1 ORDER BY lot_number DESC LIMIT 1`,
      [pattern]
    );
    let nextSeq = 1;
    if (rows.length > 0) {
      const pureLot = rows[0].lot_number.split('-')[0];
      const m = pureLot.match(/(\d+)$/);
      if (m) nextSeq = parseInt(m[1]) + 1;
    }
    return { lot_number: `${yymmdd}${abbrev}${String(nextSeq).padStart(3,'0')}` };
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

    // 사규 C302 규격 강제: lot_number에 -A1P1 등 위치정보가 섞여있으면 Pure LOT만 추출
    let pureLot = String(b.lot_number || '').trim();
    let finalLoc = b.location || '본재고';
    if (pureLot.includes('-')) {
      const parts = pureLot.split('-');
      if (parts.length >= 2 && /^[A-Za-z0-9]+$/i.test(parts[1])) {
        pureLot = parts[0];
        if (!b.location || b.location === '본재고') {
          finalLoc = parts[1];
        }
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [lot] } = await client.query(
        `INSERT INTO material_lots
          (lot_number,category,item_name,density,thickness,width_mm,length_mm,depth_mm,
           unit,qty_current,location,supplier_name,supplier_lot,received_date,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (lot_number) WHERE (is_active = TRUE) DO UPDATE SET
           qty_current = material_lots.qty_current + EXCLUDED.qty_current,
           location = COALESCE(EXCLUDED.location, material_lots.location),
           updated_at = NOW()
         RETURNING *`,
        [pureLot, b.category, b.item_name, b.density, b.thickness,
         b.width_mm, b.length_mm, b.depth_mm, b.unit || 'EA',
         b.qty_current || 0, finalLoc,
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
           lot.lot_id, pureLot, lot.category, b.qty_current,
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

  // ── PATCH /api/material-lots/by-lot/:lot_number ───────────────────────────
  // 인수검사 결과 화면에서 LOT번호로 위치 직접 업데이트
  app.patch('/api/material-lots/by-lot/:lot_number', async (req) => {
    const { lot_number } = req.params as any;
    const b = req.body as any;
    const { rows: [lot] } = await pool.query(`
      UPDATE material_lots
      SET location = COALESCE($1, location),
          location_id = COALESCE($2, location_id),
          updated_at = NOW()
      WHERE lot_number = $3
      RETURNING lot_id, lot_number, location, location_id
    `, [b.location || null, b.location_id || null, decodeURIComponent(lot_number)]);
    if (!lot) return { data: null, message: 'LOT를 찾을 수 없습니다.' };
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

  // -- DELETE /api/material-transactions/:id (매니저 이상만) -------------------
  app.delete('/api/material-transactions/:id', { preHandler: requireRole('manager') }, async (req) => {
    const { id } = (req.params as any);
    const { rows: [txn] } = await pool.query(
      `SELECT mt.* FROM material_transactions mt WHERE mt.txn_id=$1`, [id]
    );
    if (!txn) throw { statusCode: 404, message: '수불 기록을 찾을 수 없습니다.' };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const reverseQty = -Number(txn.qty);
      await client.query(
        `UPDATE material_lots SET qty_current = qty_current + $1, updated_at=NOW() WHERE lot_id=$2`,
        [reverseQty, txn.lot_id]
      );
      await client.query(`DELETE FROM material_transactions WHERE txn_id=$1`, [id]);
      await client.query('COMMIT');
      return { message: `수불 기록 #${id} 삭제 완료` };
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
      SELECT
        CURRENT_DATE AS txn_date,
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
        COALESCE(SUM(mt.qty) FILTER (WHERE mt.txn_type='IN' AND mt.txn_date BETWEEN $1 AND $2), 0) AS qty_in,
        COALESCE(SUM(ABS(mt.qty)) FILTER (WHERE mt.txn_type='OUT' AND mt.txn_date BETWEEN $1 AND $2), 0) AS qty_out,
        COALESCE(SUM(mt.qty) FILTER (WHERE mt.txn_type='ADJ' AND mt.txn_date BETWEEN $1 AND $2), 0) AS qty_adj
      FROM material_lots ml
      LEFT JOIN material_transactions mt ON mt.lot_id = ml.lot_id
      WHERE ml.is_active = TRUE
        ${catFilter} ${locFilter} ${lotFilter}
      GROUP BY ml.lot_id
      ORDER BY ml.category, ml.item_name, ml.lot_number
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

  // ── GET /api/non-certified-stock ─────────────────────────────────────────
  app.get('/api/non-certified-stock', async (req) => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS non_certified_stock (
        id SERIAL PRIMARY KEY, rack_code VARCHAR(10), pallet_no INTEGER DEFAULT 1,
        item_name VARCHAR(200), spec VARCHAR(300), lot_number VARCHAR(100),
        qty NUMERIC(12,3) DEFAULT 0, unit VARCHAR(20) DEFAULT 'EA',
        reason VARCHAR(200) DEFAULT '로트미확인', status VARCHAR(20) DEFAULT 'ACTIVE',
        notes TEXT, registered_at DATE DEFAULT CURRENT_DATE, created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => {});
    const { status, rack_code } = req.query as any;
    let sql = `SELECT * FROM non_certified_stock WHERE 1=1`;
    const params: any[] = [];
    if (status)    { params.push(status);    sql += ` AND status=$${params.length}`; }
    if (rack_code) { params.push(rack_code); sql += ` AND rack_code=$${params.length}`; }
    sql += ` ORDER BY rack_code, pallet_no, created_at DESC`;
    const { rows } = await pool.query(sql, params);
    return { data: rows };
  });

  // ── POST /api/non-certified-stock ─────────────────────────────────────────
  app.post('/api/non-certified-stock', async (req, reply) => {
    const b = req.body as any;
    if (!b.rack_code || !b.item_name) return reply.status(400).send({ error: 'rack_code, item_name은 필수입니다.' });
    const { rows: [row] } = await pool.query(
      `INSERT INTO non_certified_stock (rack_code,pallet_no,item_name,spec,lot_number,qty,unit,reason,notes,registered_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_DATE) RETURNING *`,
      [b.rack_code, b.pallet_no||1, b.item_name, b.spec||null, b.lot_number||null, b.qty||0, b.unit||'EA', b.reason||'로트미확인', b.notes||null]
    );
    return { data: row };
  });

  // ── PATCH /api/non-certified-stock/:id ───────────────────────────────────
  app.patch('/api/non-certified-stock/:id', async (req) => {
    const { id } = req.params as any;
    const b = req.body as any;
    const { rows: [row] } = await pool.query(
      `UPDATE non_certified_stock SET status=COALESCE($1,status), item_name=COALESCE($2,item_name), notes=COALESCE($3,notes) WHERE id=$4 RETURNING *`,
      [b.status, b.item_name, b.notes, id]
    );
    return { data: row };
  });

  // ── DELETE /api/non-certified-stock/:id ───────────────────────────────────
  app.delete('/api/non-certified-stock/:id', async (req) => {
    const { id } = req.params as any;
    await pool.query(`UPDATE non_certified_stock SET status='DISPOSED' WHERE id=$1`, [id]);
    return { message: '폐기처리 완료' };
  });

  // ── POST /api/non-certified-stock/google-sheet-import ─────────────────────
  app.post('/api/non-certified-stock/google-sheet-import', async (req, reply) => {
    interface SheetRow { rack_code: string; pallet_no: number; item_name: string; spec?: string; lot_number?: string; qty?: number; notes?: string; }
    const { rows: sheetRows } = req.body as { rows: SheetRow[] };
    if (!Array.isArray(sheetRows) || sheetRows.length === 0) return reply.status(400).send({ error: '데이터 없음' });
    const client = await pool.connect();
    const certR: any[] = [], nonCR: any[] = [];
    try {
      await client.query('BEGIN');
      for (const row of sheetRows) {
        const { rack_code, pallet_no, item_name, spec, lot_number, qty, notes } = row;
        const location = `${rack_code}-P${pallet_no}`;
        const hasLot = lot_number && lot_number.trim() !== '';
        if (hasLot) {
          const cleanLot = lot_number!.trim();
          const { rows: ex } = await client.query(`SELECT lot_id FROM material_lots WHERE lot_number=$1 AND is_active=TRUE LIMIT 1`, [cleanLot]);
          if (ex.length) {
            await client.query(`UPDATE material_lots SET location=$1, qty_current=$2, updated_at=NOW() WHERE lot_id=$3`, [location, qty||0, ex[0].lot_id]);
            certR.push({ status: 'updated', lot_number: cleanLot });
          } else {
            const cat = item_name.includes('그라스울보드') ? '그라스울보드' : item_name.includes('그라스울') ? '그라스울' : '세라믹울';
            const { rows: [lot] } = await client.query(
              `INSERT INTO material_lots (lot_number,category,item_name,unit,qty_current,location,received_date,notes) VALUES ($1,$2,$3,'롤',$4,$5,CURRENT_DATE,$6) ON CONFLICT DO NOTHING RETURNING lot_id`,
              [cleanLot, cat, item_name, qty||0, location, notes||'구글시트 초기등록']
            );
            if (lot?.lot_id && (qty||0) > 0) {
              await client.query(`INSERT INTO material_transactions (txn_date,lot_id,lot_number,category,txn_type,qty,qty_before,qty_after,source_type,notes) VALUES (CURRENT_DATE,$1,$2,$3,'IN',$4,0,$4,'GOOGLE_SHEET_IMPORT','구글시트 기초재고') ON CONFLICT DO NOTHING`, [lot.lot_id, cleanLot, cat, qty||0]).catch(() => {});
            }
            certR.push({ status: lot?.lot_id ? 'created' : 'skipped', lot_number: cleanLot });
          }
        } else {
          const { rows: ex } = await client.query(`SELECT id FROM non_certified_stock WHERE rack_code=$1 AND pallet_no=$2 AND status='ACTIVE' LIMIT 1`, [rack_code, pallet_no]);
          if (ex.length) {
            await client.query(`UPDATE non_certified_stock SET item_name=$1 WHERE id=$2`, [item_name, ex[0].id]);
            nonCR.push({ status: 'updated' });
          } else {
            await client.query(`INSERT INTO non_certified_stock (rack_code,pallet_no,item_name,spec,lot_number,qty,reason,notes,registered_at) VALUES ($1,$2,$3,$4,$5,$6,'로트미확인',$7,CURRENT_DATE)`, [rack_code, pallet_no, item_name, spec||null, lot_number&&lot_number.trim()?lot_number.trim():null, qty||0, notes||'구글시트 초기등록']);
            nonCR.push({ status: 'created' });
          }
        }
      }
      await client.query('COMMIT');
      return { certResults: certR, nonCertResults: nonCR };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.status(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ── POST /api/material-lots/fix-specs-and-lots (사규 C302 LOT 번호 정제 및 규격 복원) ──
  app.post('/api/material-lots/fix-specs-and-lots', async (req, reply) => {
    const KNOWN_LOT_SPECS: Record<string, { spec: string; name?: string; density?: number; thickness?: number; width?: number; length?: number }> = {
      '260227CW005': { spec: '25* 150*100K', name: '100K 25T 150W 7400L', density: 100, thickness: 25, width: 150, length: 7400 },
      '260227CW004': { spec: '25* 200*100K', name: '100K 25T 200W 7400L', density: 100, thickness: 25, width: 200, length: 7400 },
      '260203CW001': { spec: '25* 300*100K', name: '100K 25T 300W 7400L', density: 100, thickness: 25, width: 300, length: 7400 },
      '260227CW003': { spec: '25* 300*100K', name: '100K 25T 300W 7400L', density: 100, thickness: 25, width: 300, length: 7400 },
      '260203CW004': { spec: '38* 600*100K', name: '100K 38T 600W 4800L', density: 100, thickness: 38, width: 600, length: 4800 },
      '260203CW002': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
      '260514CW002': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
      '260722CW001': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
      '260630CW002': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
      '260203CW003': { spec: '25* 150*96K',  name: '96K 25T 150W 7400L',  density: 96,  thickness: 25, width: 150, length: 7400 },
      '260203CW005': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
      '260203CW006': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
      '260203CW007': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
      '260203CW008': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
      '260610CW002': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
      '260630CW001': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
      '260630CW003': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
      '260722CW003': { spec: '25* 200*128K', name: '128K 25T 200W 7400L', density: 128, thickness: 25, width: 200, length: 7400 },
      '260402GW002': { spec: '96K 50T 500W 1000L', name: '그라스울 96K', density: 96, thickness: 50, width: 500, length: 1000 },
      '251001GW001': { spec: '48K 50T 500W 1000L', name: '그라스울보드 48K', density: 48, thickness: 50, width: 500, length: 1000 }
    };

    const client = await pool.connect();
    let updatedCount = 0;
    try {
      await client.query('BEGIN');
      const { rows: lots } = await client.query(`SELECT * FROM material_lots WHERE is_active = TRUE`);

      for (const lot of lots) {
        let lotNo = lot.lot_number;
        let rackLoc = lot.location;

        const basePrefix = lotNo.split('-')[0];
        const specData = KNOWN_LOT_SPECS[basePrefix] || KNOWN_LOT_SPECS[lotNo];
        
        let item_spec = lot.item_spec;
        let item_name = lot.item_name;
        let density = lot.density;
        let thickness = lot.thickness;
        let width_mm = lot.width_mm;
        let length_mm = lot.length_mm;

        if (specData) {
          item_spec = item_spec || specData.spec;
          if (!item_name || item_name === '세라믹울' || item_name === '그라스울') {
            item_name = specData.name || item_name;
          }
          density = density || specData.density;
          thickness = thickness || specData.thickness;
          width_mm = width_mm || specData.width;
          length_mm = length_mm || specData.length;
        }

        if (!item_spec) {
          if (lotNo.includes('CW')) item_spec = '25* 200*128K';
          else if (lotNo.includes('GW')) item_spec = '96K 50T';
          else item_spec = '표준규격';
        }

        await client.query(`
          UPDATE material_lots SET
            item_name = COALESCE($1, item_name),
            item_spec = COALESCE($2, item_spec),
            density = COALESCE($3, density),
            thickness = COALESCE($4, thickness),
            width_mm = COALESCE($5, width_mm),
            length_mm = COALESCE($6, length_mm),
            updated_at = NOW()
          WHERE lot_id = $7
        `, [item_name, item_spec, density, thickness, width_mm, length_mm, lot.lot_id]);

        updatedCount++;
      }

      await client.query('COMMIT');
      return { success: true, updated_count: updatedCount, message: `${updatedCount}개 LOT 규격 복원 완료` };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.status(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });

  // 서버 시동 시 자동 1회 정제 실행
  pool.query(`
    UPDATE material_lots SET item_spec = '25* 200*128K' WHERE (item_spec IS NULL OR item_spec = '') AND lot_number LIKE '%CW%';
    UPDATE material_lots SET item_spec = '96K 50T' WHERE (item_spec IS NULL OR item_spec = '') AND lot_number LIKE '%GW%';
  `).catch(() => {});
}