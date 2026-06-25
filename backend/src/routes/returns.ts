import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

/**
 * 반품입고 API (신규 — REUSE/DISPOSE 방식)
 * 출하이력(shipment_ready + shipment_ready_item + lot_transaction)을 기준으로
 * 반품 대상 품목을 선택하고 반품입고를 등록한다.
 */
export async function returnRoutes(app: FastifyInstance) {

  // ─── DB 마이그레이션 (테이블이 없으면 생성) ───────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS return_receipt (
      rr_id         SERIAL PRIMARY KEY,
      rr_number     VARCHAR(30) UNIQUE NOT NULL,
      rr_date       DATE NOT NULL,
      statement_id  INTEGER,
      so_id         INTEGER,
      customer_id   INTEGER,
      customer_name VARCHAR(200),
      reason        TEXT,
      status        VARCHAR(20) DEFAULT 'PENDING',
      worker        VARCHAR(100),
      remarks       TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS return_receipt_item (
      rri_id              SERIAL PRIMARY KEY,
      rr_id               INTEGER REFERENCES return_receipt(rr_id) ON DELETE CASCADE,
      item_id             INTEGER,
      item_name           VARCHAR(200),
      item_code           VARCHAR(50),
      item_category       VARCHAR(10),
      spec                VARCHAR(300),
      unit                VARCHAR(20),
      qty                 NUMERIC(12,2),
      original_lot_id     INTEGER,
      original_lot_number VARCHAR(100),
      return_type         VARCHAR(30),
      new_lot_id          INTEGER,
      new_lot_number      VARCHAR(100),
      dispose_reason      VARCHAR(200),
      remarks             VARCHAR(500)
    );
  `).catch((e: unknown) => console.error('[Migration] return_receipt:', e));

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/returns  — 반품 목록
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/returns', async (req) => {
    const q = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (q.status) { params.push(q.status); conditions.push(`status = $${params.length}`); }
    if (q.from)   { params.push(q.from);   conditions.push(`rr_date >= $${params.length}`); }
    if (q.to)     { params.push(q.to);     conditions.push(`rr_date <= $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await pool.query(`
      SELECT rr.*,
             (SELECT COUNT(*) FROM return_receipt_item WHERE rr_id = rr.rr_id) AS item_count
      FROM return_receipt rr
      ${where}
      ORDER BY rr.rr_date DESC, rr.rr_id DESC
    `, params);
    return { data: rows, total: rows.length };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/returns/shipment-history  — 출하이력 조회 (반품 소스 선택용)
  // 필터: project_id, po_id, site_name(ILIKE), from_date, to_date
  // 출하된(shipped_qty > 0) 품목만 반환
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/returns/shipment-history', async (req) => {
    const q = req.query as Record<string, string>;
    const conditions: string[] = ['sri.shipped_qty > 0'];
    const params: unknown[] = [];
    let pi = 1;

    if (q.project_id) {
      conditions.push(`sr.project_id = $${pi++}`);
      params.push(parseInt(q.project_id));
    }
    if (q.po_id) {
      conditions.push(`sr.po_id = $${pi++}`);
      params.push(parseInt(q.po_id));
    }
    if (q.site_name) {
      conditions.push(`sr.site_name ILIKE $${pi++}`);
      params.push(`%${q.site_name}%`);
    }
    if (q.from_date) {
      conditions.push(`sr.delivery_date >= $${pi++}`);
      params.push(q.from_date);
    }
    if (q.to_date) {
      conditions.push(`sr.delivery_date <= $${pi++}`);
      params.push(q.to_date);
    }

    const where = 'WHERE ' + conditions.join(' AND ');

    const { rows } = await pool.query(`
      SELECT
        sri.sri_id,
        sri.sr_id,
        sri.item_id,
        im.item_name,
        im.item_code,
        im.item_category,
        sri.item_spec         AS spec,
        im.unit,
        sri.planned_qty,
        COALESCE(sri.shipped_qty, 0) AS shipped_qty,
        sri.lot_id            AS original_lot_id,
        sri.lot_number        AS original_lot_number,
        sr.site_name,
        sr.delivery_date,
        sr.distributor,
        sr.contractor,
        sr.project_id,
        pm.project_name,
        sr.po_id
      FROM shipment_ready_item sri
      JOIN shipment_ready sr ON sri.sr_id = sr.sr_id
      LEFT JOIN item_master im ON sri.item_id = im.item_id
      LEFT JOIN project_master pm ON sr.project_id = pm.project_id
      ${where}
      ORDER BY sr.delivery_date DESC, sr.sr_id DESC, sri.sri_id ASC
      LIMIT 500
    `, params);

    return { data: rows, total: rows.length };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/returns/shipped-lots  — 출하된 LOT 조회
  // lot_transaction 기준: staging_status='SHIPPED' 또는 remaining_qty < qty
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/returns/shipped-lots', async (req) => {
    const q = req.query as Record<string, string>;
    const conditions: string[] = [
      "(lt.staging_status = 'SHIPPED' OR lt.remaining_qty < lt.qty)"
    ];
    const params: unknown[] = [];
    let pi = 1;

    if (q.lot_number) {
      conditions.push(`lt.lot_number ILIKE $${pi++}`);
      params.push(`%${q.lot_number}%`);
    }
    if (q.item_category) {
      conditions.push(`im.item_category = $${pi++}`);
      params.push(q.item_category);
    }
    if (q.site_name) {
      conditions.push(`sr.site_name ILIKE $${pi++}`);
      params.push(`%${q.site_name}%`);
    }
    if (q.project_id) {
      conditions.push(`sr.project_id = $${pi++}`);
      params.push(parseInt(q.project_id));
    }
    if (q.po_id) {
      conditions.push(`sr.po_id = $${pi++}`);
      params.push(parseInt(q.po_id));
    }

    const where = 'WHERE ' + conditions.join(' AND ');

    const { rows } = await pool.query(`
      SELECT DISTINCT
        lt.lot_id,
        lt.lot_number,
        lt.lot_type,
        lt.item_id,
        im.item_name,
        im.item_code,
        im.item_category,
        im.unit,
        lt.qty,
        lt.remaining_qty,
        (lt.qty - COALESCE(lt.remaining_qty, 0)) AS shipped_qty,
        lt.created_at,
        sr.sr_id,
        sr.site_name,
        sr.delivery_date,
        pm.project_name,
        sr.po_id
      FROM lot_transaction lt
      LEFT JOIN item_master im ON lt.item_id = im.item_id
      LEFT JOIN shipment_ready_item sri ON sri.lot_id = lt.lot_id
      LEFT JOIN shipment_ready sr ON sri.sr_id = sr.sr_id
      LEFT JOIN project_master pm ON sr.project_id = pm.project_id
      ${where}
      ORDER BY lt.created_at DESC
      LIMIT 300
    `, params);

    return { data: rows, total: rows.length };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/returns/:id — 반품 상세
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/returns/:id', async (req, reply) => {
    const rrId = parseInt((req.params as any).id, 10);
    const [rrRes, itemsRes] = await Promise.all([
      pool.query('SELECT * FROM return_receipt WHERE rr_id = $1', [rrId]),
      pool.query(`
        SELECT rri.*
        FROM return_receipt_item rri
        WHERE rri.rr_id = $1
        ORDER BY rri.rri_id
      `, [rrId]),
    ]);
    if (!rrRes.rows[0]) return reply.status(404).send({ error: 'Not Found' });
    return { data: { ...rrRes.rows[0], items: itemsRes.rows } };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/returns  — 반품 등록 (헤더 + 품목 한번에)
  // ─────────────────────────────────────────────────────────────────────────
  app.post('/api/returns', async (req, reply) => {
    const body = req.body as Record<string, any>;
    const {
      rr_date, customer_id, customer_name, reason, remarks, worker,
      statement_id, so_id, items = [],
    } = body;

    if (!rr_date) return reply.status(400).send({ error: 'rr_date 필수' });
    if (items.length === 0) return reply.status(400).send({ error: '반품 품목이 없습니다' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 반품번호 자동생성: RR-YYYYMMDD-NNN
      const dateStr = rr_date.replace(/-/g, '');
      const cntRes = await client.query(
        `SELECT COUNT(*) AS cnt FROM return_receipt WHERE rr_date = $1`, [rr_date]
      );
      const seq = parseInt(cntRes.rows[0].cnt, 10) + 1;
      const rr_number = `RR-${dateStr}-${String(seq).padStart(3, '0')}`;

      const rrRes = await client.query(`
        INSERT INTO return_receipt (rr_number, rr_date, statement_id, so_id, customer_id,
          customer_name, reason, status, worker, remarks)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING',$8,$9)
        RETURNING *
      `, [rr_number, rr_date, statement_id || null, so_id || null, customer_id || null,
          customer_name || null, reason || null, worker || null, remarks || null]);
      const rr = rrRes.rows[0];

      // 품목 등록
      for (const it of items) {
        await client.query(`
          INSERT INTO return_receipt_item (rr_id, item_id, item_name, item_code, item_category,
            spec, unit, qty, original_lot_id, original_lot_number, return_type, dispose_reason, remarks)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        `, [
          rr.rr_id,
          it.item_id || null,
          it.item_name || null,
          it.item_code || null,
          it.item_category || null,
          it.spec || null,
          it.unit || 'EA',
          it.qty || 0,
          it.original_lot_id || null,
          it.original_lot_number || null,
          it.return_type || 'DISPOSE',
          it.dispose_reason || null,
          it.remarks || null,
        ]);
      }

      await client.query('COMMIT');
      return { data: rr };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/returns/:rr_id/complete  — 반품 완료 처리
  //   REUSE  → new_lot_number 생성 + lot_transaction IN + remaining_qty 복원
  //   DISPOSE → lot_transaction OUT 기록만
  // ─────────────────────────────────────────────────────────────────────────
  app.post('/api/returns/:rr_id/complete', async (req, reply) => {
    const rrId = parseInt((req.params as any).rr_id, 10);
    const body = req.body as Record<string, any>;

    const rrCheck = await pool.query(
      'SELECT * FROM return_receipt WHERE rr_id = $1', [rrId]
    );
    if (!rrCheck.rows[0]) return reply.status(404).send({ error: '반품 내역을 찾을 수 없습니다' });
    if (rrCheck.rows[0].status === 'COMPLETED') {
      return reply.status(400).send({ error: '이미 처리완료된 반품입니다' });
    }

    const itemsRes = await pool.query(`
      SELECT rri.*, im.item_code AS im_item_code, im.item_category AS im_item_category
      FROM return_receipt_item rri
      LEFT JOIN item_master im ON im.item_id = rri.item_id
      WHERE rri.rr_id = $1
    `, [rrId]);
    const items = itemsRes.rows;

    const rr = rrCheck.rows[0];
    const processDate = (body.process_date || rr.rr_date) as string;
    const _worker = body.worker || rr.worker || 'system'; // reserved for future audit log

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const processedItems: any[] = [];

      for (const item of items) {
        const returnType: string = item.return_type || 'DISPOSE';

        if (returnType === 'REUSE') {
          // ── 재입고: 새 LOT 생성 + lot_transaction IN ──
          const dateStr = processDate.replace(/-/g, '').slice(2); // YYMMDD
          const baseLotNum = item.original_lot_number || 'LOT';
          const newLotNumber = `RTN${dateStr}-${baseLotNum}`;

          // 중복 방지: 이미 있으면 suffix 추가
          const existCheck = await client.query(
            `SELECT COUNT(*) AS cnt FROM lot_transaction WHERE lot_number LIKE $1`,
            [`${newLotNumber}%`]
          );
          const suffix = parseInt(existCheck.rows[0].cnt, 10);
          const finalLotNumber = suffix > 0 ? `${newLotNumber}-${suffix}` : newLotNumber;

          // lot_transaction 재입고 (lot_type='IN')
          const newLotRes = await client.query(`
            INSERT INTO lot_transaction
              (lot_number, lot_type, item_id, qty, unit, supplier_lot,
               inspection_result, status, remaining_qty)
            VALUES ($1, 'IN', $2, $3, $4, $5, 'PASS', 'ACTIVE', $3)
            RETURNING *
          `, [
            finalLotNumber,
            item.item_id,
            item.qty,
            item.unit || 'EA',
            item.original_lot_number ? `RTN:${item.original_lot_number}` : null,
          ]);
          const newLot = newLotRes.rows[0];

          // return_receipt_item 업데이트
          await client.query(`
            UPDATE return_receipt_item
            SET new_lot_id=$1, new_lot_number=$2
            WHERE rri_id=$3
          `, [newLot.lot_id, finalLotNumber, item.rri_id]);

          processedItems.push({
            rri_id: item.rri_id,
            result: 'REUSE',
            new_lot_number: finalLotNumber,
          });

        } else {
          // ── 폐기: lot_transaction OUT 기록 ──
          // 원본 LOT가 있으면 OUT 트랜잭션 기록
          if (item.original_lot_id) {
            await client.query(`
              INSERT INTO lot_transaction
                (lot_number, lot_type, item_id, qty, unit, status, remaining_qty, supplier_lot)
              VALUES ($1, 'OUT', $2, $3, $4, 'SCRAPPED', 0, $5)
            `, [
              `DISP-${item.original_lot_number || item.rri_id}`,
              item.item_id,
              item.qty,
              item.unit || 'EA',
              item.original_lot_number || null,
            ]);
          }

          processedItems.push({
            rri_id: item.rri_id,
            result: 'DISPOSED',
            new_lot_number: null,
          });
        }
      }

      // 반품 상태 완료로 업데이트
      await client.query(
        `UPDATE return_receipt SET status='COMPLETED' WHERE rr_id=$1`, [rrId]
      );

      await client.query('COMMIT');
      return { data: { rr_id: rrId, processed: processedItems } };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE /api/returns/:id — 반품 삭제 (PENDING 상태만)
  // ─────────────────────────────────────────────────────────────────────────
  app.delete('/api/returns/:id', async (req, reply) => {
    const rrId = parseInt((req.params as any).id, 10);
    const check = await pool.query(
      'SELECT status FROM return_receipt WHERE rr_id = $1', [rrId]
    );
    if (!check.rows[0]) return reply.status(404).send({ error: 'Not Found' });
    if (check.rows[0].status !== 'PENDING') {
      return reply.status(400).send({ error: 'PENDING 상태만 삭제 가능합니다' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM return_receipt_item WHERE rr_id = $1', [rrId]);
      await client.query('DELETE FROM return_receipt WHERE rr_id = $1', [rrId]);
      await client.query('COMMIT');
      return { data: { success: true } };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
}
