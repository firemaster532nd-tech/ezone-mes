import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

export async function shipmentOrderRoutes(app: FastifyInstance) {
  // ─── DB 마이그레이션 ─────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shipment_order (
      so_id        SERIAL PRIMARY KEY,
      so_number    VARCHAR(30) UNIQUE NOT NULL,
      so_date      DATE NOT NULL,
      po_id        INTEGER,
      project_id   INTEGER,
      customer_id  INTEGER,
      customer_name VARCHAR(200),
      destination  VARCHAR(500),
      contact_person VARCHAR(100),
      contact_phone VARCHAR(50),
      vehicle_number VARCHAR(30),
      driver_name  VARCHAR(50),
      remarks      TEXT,
      status       VARCHAR(20) DEFAULT 'DRAFT',
      statement_id INTEGER,
      created_by   INTEGER,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      shipped_at   TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS shipment_order_item (
      soi_id       SERIAL PRIMARY KEY,
      so_id        INTEGER REFERENCES shipment_order(so_id) ON DELETE CASCADE,
      item_id      INTEGER,
      item_name    VARCHAR(200),
      spec         VARCHAR(300),
      unit         VARCHAR(20) DEFAULT 'EA',
      qty          NUMERIC(12,2) DEFAULT 0,
      lot_id       INTEGER,
      lot_number   VARCHAR(100),
      unit_price   NUMERIC(15,2) DEFAULT 0,
      amount       NUMERIC(15,2) DEFAULT 0,
      remarks      VARCHAR(500),
      sort_order   INTEGER DEFAULT 0
    );
  `).catch((e: unknown) => console.error('[Migration] shipment_order:', e));

  // ─── GET /api/shipment-orders — 출하지시서 목록 ──────────────────────
  app.get('/api/shipment-orders', async (req) => {
    const q = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (q.status) { params.push(q.status); conditions.push(`so.status = $${params.length}`); }
    if (q.from)   { params.push(q.from);   conditions.push(`so.so_date >= $${params.length}`); }
    if (q.to)     { params.push(q.to);     conditions.push(`so.so_date <= $${params.length}`); }
    if (q.search) {
      params.push(`%${q.search}%`);
      conditions.push(`(so.so_number ILIKE $${params.length} OR so.customer_name ILIKE $${params.length} OR so.destination ILIKE $${params.length})`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await pool.query(`
      SELECT so.*,
             (SELECT COUNT(*) FROM shipment_order_item WHERE so_id = so.so_id) AS item_count,
             (SELECT SUM(amount) FROM shipment_order_item WHERE so_id = so.so_id) AS total_amount
      FROM shipment_order so
      ${where}
      ORDER BY so.so_date DESC, so.so_id DESC
    `, params);
    return { data: rows, total: rows.length };
  });

  // ─── GET /api/shipment-orders/:id — 상세 ────────────────────────────
  app.get('/api/shipment-orders/:id', async (req, reply) => {
    const soId = parseInt((req.params as any).id, 10);
    const [soRes, itemsRes] = await Promise.all([
      pool.query('SELECT * FROM shipment_order WHERE so_id = $1', [soId]),
      pool.query(`
        SELECT soi.*, lt.lot_number AS linked_lot, lt.remaining_qty,
               im.item_code, im.item_category
        FROM shipment_order_item soi
        LEFT JOIN lot_transaction lt ON lt.lot_id = soi.lot_id
        LEFT JOIN item_master im ON im.item_id = soi.item_id
        WHERE soi.so_id = $1
        ORDER BY soi.sort_order, soi.soi_id
      `, [soId]),
    ]);
    if (!soRes.rows[0]) return reply.status(404).send({ error: 'Not Found' });
    return { data: { ...soRes.rows[0], items: itemsRes.rows } };
  });

  // ─── POST /api/shipment-orders — 출하지시서 생성 ────────────────────
  app.post('/api/shipment-orders', async (req, reply) => {
    const body = req.body as Record<string, any>;
    const { so_date, customer_id, customer_name, destination, contact_person, contact_phone,
            vehicle_number, driver_name, remarks, po_id, project_id, items = [] } = body;

    if (!so_date) return reply.status(400).send({ error: 'so_date 필수' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 번호 자동생성
      const dateStr = so_date.replace(/-/g, '');
      const cntRes = await client.query(
        `SELECT COUNT(*) as cnt FROM shipment_order WHERE so_date = $1`, [so_date]
      );
      const seq = parseInt(cntRes.rows[0].cnt, 10) + 1;
      const so_number = `SH-${dateStr}-${String(seq).padStart(3, '0')}`;

      const soRes = await client.query(`
        INSERT INTO shipment_order (so_number, so_date, po_id, project_id, customer_id, customer_name,
          destination, contact_person, contact_phone, vehicle_number, driver_name, remarks, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'DRAFT')
        RETURNING *
      `, [so_number, so_date, po_id||null, project_id||null, customer_id||null, customer_name||null,
          destination||null, contact_person||null, contact_phone||null,
          vehicle_number||null, driver_name||null, remarks||null]);
      const so = soRes.rows[0];

      // 품목 INSERT
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(`
          INSERT INTO shipment_order_item (so_id, item_id, item_name, spec, unit, qty,
            lot_id, lot_number, unit_price, amount, remarks, sort_order)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        `, [so.so_id, it.item_id||null, it.item_name||null, it.spec||null,
            it.unit||'EA', it.qty||0, it.lot_id||null, it.lot_number||null,
            it.unit_price||0, it.amount||0, it.remarks||null, i]);
      }

      await client.query('COMMIT');
      return { data: so };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ─── PATCH /api/shipment-orders/:id — 수정 ──────────────────────────
  app.patch('/api/shipment-orders/:id', async (req, reply) => {
    const soId = parseInt((req.params as any).id, 10);
    const body = req.body as Record<string, any>;

    const check = await pool.query('SELECT status FROM shipment_order WHERE so_id = $1', [soId]);
    if (!check.rows[0]) return reply.status(404).send({ error: 'Not Found' });
    if (check.rows[0].status === 'SHIPPED') return reply.status(400).send({ error: '출하완료된 지시서는 수정 불가' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const fields: string[] = [];
      const vals: unknown[] = [];
      const allowed = ['customer_name','destination','contact_person','contact_phone',
                       'vehicle_number','driver_name','remarks','so_date','po_id','project_id','customer_id'];
      for (const k of allowed) {
        if (body[k] !== undefined) { vals.push(body[k]); fields.push(`${k} = $${vals.length}`); }
      }
      if (fields.length > 0) {
        vals.push(soId);
        await client.query(`UPDATE shipment_order SET ${fields.join(', ')} WHERE so_id = $${vals.length}`, vals);
      }

      // 품목 재설정
      if (Array.isArray(body.items)) {
        await client.query('DELETE FROM shipment_order_item WHERE so_id = $1', [soId]);
        for (let i = 0; i < body.items.length; i++) {
          const it = body.items[i];
          await client.query(`
            INSERT INTO shipment_order_item (so_id, item_id, item_name, spec, unit, qty,
              lot_id, lot_number, unit_price, amount, remarks, sort_order)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          `, [soId, it.item_id||null, it.item_name||null, it.spec||null,
              it.unit||'EA', it.qty||0, it.lot_id||null, it.lot_number||null,
              it.unit_price||0, it.amount||0, it.remarks||null, i]);
        }
      }

      await client.query('COMMIT');
      const updated = await pool.query('SELECT * FROM shipment_order WHERE so_id = $1', [soId]);
      return { data: updated.rows[0] };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ─── PATCH /api/shipment-orders/:id/confirm — 출하확정 ──────────────
  // 재고 OUT + 거래명세서 자동생성
  app.patch('/api/shipment-orders/:id/confirm', async (req, reply) => {
    const soId = parseInt((req.params as any).id, 10);
    const body = req.body as Record<string, any>;

    const soRes = await pool.query(`
      SELECT so.*, array_agg(row_to_json(soi.*)) as items_raw
      FROM shipment_order so
      LEFT JOIN shipment_order_item soi ON soi.so_id = so.so_id
      WHERE so.so_id = $1
      GROUP BY so.so_id
    `, [soId]);

    if (!soRes.rows[0]) return reply.status(404).send({ error: 'Not Found' });
    const so = soRes.rows[0];
    if (so.status === 'SHIPPED') return reply.status(400).send({ error: '이미 출하완료' });

    const itemsRes = await pool.query('SELECT * FROM shipment_order_item WHERE so_id = $1 ORDER BY sort_order', [soId]);
    const items = itemsRes.rows;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const shipDate = body.ship_date || so.so_date;

      // 1. 각 품목별 재고 OUT
      for (const item of items) {
        if (item.item_id && item.qty > 0) {
          // LOT 재고 차감
          if (item.lot_id) {
            await client.query(
              `UPDATE lot_transaction SET remaining_qty = GREATEST(0, remaining_qty - $1), status = CASE WHEN remaining_qty - $1 <= 0 THEN 'SHIPPED' ELSE status END WHERE lot_id = $2`,
              [item.qty, item.lot_id]
            );
          }
          // inventory_transaction OUT
          await client.query(`
            INSERT INTO inventory_transaction (item_id, lot_id, txn_type, txn_date, qty, purpose, ref_wo_id, worker)
            VALUES ($1, $2, 'OUT', $3, $4, 'SHP_ORDER', $5, $6)
          `, [item.item_id, item.lot_id||null, shipDate, item.qty, soId, body.worker||null]);
        }
      }

      // 2. 거래명세서 자동 생성
      const dateStr = (so.so_date || shipDate).replace(/-/g, '');
      const seqRes = await client.query(
        `SELECT COUNT(*) as cnt FROM transaction_statement WHERE statement_date = $1`, [shipDate]
      );
      const seq = parseInt(seqRes.rows[0].cnt, 10) + 1;
      const stmt_number = `TX-${dateStr}-${String(seq).padStart(3, '0')}`;

      const totalAmt = items.reduce((s, i) => s + (parseFloat(i.amount)||0), 0);
      const totalQty = items.reduce((s, i) => s + (parseFloat(i.qty)||0), 0);
      const totalVat = Math.round(totalAmt * 0.1);

      const stmtRes = await client.query(`
        INSERT INTO transaction_statement (
          statement_number, statement_date, customer_id,
          supplier_name, supplier_ceo, supplier_no, supplier_addr, supplier_phone,
          total_qty, total_amount, total_vat, remarks
        ) VALUES ($1,$2,$3,'(주)이지원','박민선','232-88-00624','경기도 화성시 장안면 장안로227번길 166-18','070-8870-0300',$4,$5,$6,$7)
        RETURNING *
      `, [stmt_number, shipDate, so.customer_id||null,
          totalQty, totalAmt, totalVat, `출하지시서 ${so.so_number}`]);
      const stmt = stmtRes.rows[0];

      // 거래명세서 품목 INSERT
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(`
          INSERT INTO transaction_statement_item (statement_id, item_name, spec, unit, qty, unit_price, amount, vat, remarks, sort_order)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `, [stmt.statement_id, it.item_name, it.spec||null, it.unit||'EA',
            it.qty, it.unit_price||0, it.amount||0, Math.round((it.amount||0)*0.1),
            it.lot_number ? `LOT: ${it.lot_number}` : null, i]);
      }

      // 3. 출하지시서 상태 업데이트
      await client.query(`
        UPDATE shipment_order SET status='SHIPPED', statement_id=$1, shipped_at=NOW() WHERE so_id=$2
      `, [stmt.statement_id, soId]);

      await client.query('COMMIT');
      return { data: { so_id: soId, statement_id: stmt.statement_id, statement_number: stmt_number, total_amount: totalAmt } };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ─── GET /api/shipment-orders/:id/exit-pass — 출차증 데이터 ─────────
  app.get('/api/shipment-orders/:id/exit-pass', async (req, reply) => {
    const soId = parseInt((req.params as any).id, 10);
    const [soRes, itemsRes] = await Promise.all([
      pool.query('SELECT * FROM shipment_order WHERE so_id = $1', [soId]),
      pool.query('SELECT * FROM shipment_order_item WHERE so_id = $1 ORDER BY sort_order', [soId]),
    ]);
    if (!soRes.rows[0]) return reply.status(404).send({ error: 'Not Found' });
    return { data: { ...soRes.rows[0], items: itemsRes.rows } };
  });

  // ─── DELETE /api/shipment-orders/:id — 삭제 (DRAFT만) ───────────────
  app.delete('/api/shipment-orders/:id', async (req, reply) => {
    const soId = parseInt((req.params as any).id, 10);
    const check = await pool.query('SELECT status FROM shipment_order WHERE so_id = $1', [soId]);
    if (!check.rows[0]) return reply.status(404).send({ error: 'Not Found' });
    if (check.rows[0].status !== 'DRAFT') return reply.status(400).send({ error: 'DRAFT 상태만 삭제 가능' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM shipment_order_item WHERE so_id = $1', [soId]);
      await client.query('DELETE FROM shipment_order WHERE so_id = $1', [soId]);
      await client.query('COMMIT');
      return { data: { success: true } };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ─── GET /api/shipment-orders/pending — 미출하현황 ──────────────────
  // 발주서 기준 미출하 집계 (purchase_order + purchase_order_item 실제 컬럼 기준)
  app.get('/api/shipment-orders/pending', async () => {
    const { rows } = await pool.query(`
      SELECT
        po.po_id,
        CONCAT('PO-', po.po_id)                          AS po_number,
        po.created_at::date                               AS po_date,
        COALESCE(po.biz_name, po.contractor)              AS customer_name,
        po.project_name,
        COALESCE(po.site_address, po.construction_site)   AS site_name,
        poi.po_item_id                                    AS poi_id,
        COALESCE(poi.product_type, poi.item_name, '미분류') AS item_name,
        CASE
          WHEN poi.pipe_width_mm IS NOT NULL
          THEN poi.pipe_width_mm::text || '×' || poi.pipe_height_mm::text
          ELSE poi.spec
        END                                               AS spec,
        poi.qty                                           AS ordered_qty,
        'EA'                                              AS unit
      FROM purchase_order po
      JOIN purchase_order_item poi ON poi.po_id = po.po_id
      WHERE po.status NOT IN ('CANCELLED', 'DELETED')
      ORDER BY po.created_at DESC, poi.po_item_id
    `);
    return { data: rows };
  });
}
