import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

// 반품 LOT 유형 분류
// 그라스울(SM-GW*), 세라믹울(SM-CW*), 실리콘(SM-SIL*, SM-SL*) → INSPECTION_STOCK (인수검사 로트로)
// 기타 자재 SM-* → ASSEMBLY_STOCK (조립 LOT로 재고 복원)
// 완제품 FG, 구조체 → DISPOSE (폐기)
function classifyReturnType(itemCode: string, itemCategory: string): string {
  const code = (itemCode || '').toUpperCase();
  if (code.startsWith('SM-GW') || code.startsWith('SM-CW') ||
      code.startsWith('SM-SIL') || code.startsWith('SM-SL')) {
    return 'INSPECTION_STOCK';
  }
  if (itemCategory === 'SM' || itemCategory === 'RM') {
    return 'ASSEMBLY_STOCK';
  }
  return 'DISPOSE'; // FG, 구조체 등
}

export async function returnReceiptRoutes(app: FastifyInstance) {
  // ─── DB 마이그레이션 ─────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS return_receipt (
      rr_id        SERIAL PRIMARY KEY,
      rr_number    VARCHAR(30) UNIQUE NOT NULL,
      rr_date      DATE NOT NULL,
      statement_id INTEGER,
      so_id        INTEGER,
      customer_id  INTEGER,
      customer_name VARCHAR(200),
      reason       TEXT,
      status       VARCHAR(20) DEFAULT 'PENDING',
      worker       VARCHAR(100),
      remarks      TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS return_receipt_item (
      rri_id            SERIAL PRIMARY KEY,
      rr_id             INTEGER REFERENCES return_receipt(rr_id) ON DELETE CASCADE,
      item_id           INTEGER,
      item_name         VARCHAR(200),
      item_code         VARCHAR(50),
      item_category     VARCHAR(10),
      spec              VARCHAR(300),
      unit              VARCHAR(20),
      qty               NUMERIC(12,2),
      original_lot_id   INTEGER,
      original_lot_number VARCHAR(100),
      return_type       VARCHAR(30),
      new_lot_id        INTEGER,
      new_lot_number    VARCHAR(100),
      dispose_reason    VARCHAR(200),
      remarks           VARCHAR(500)
    );
  `).catch((e: unknown) => console.error('[Migration] return_receipt:', e));

  // ─── GET /api/return-receipts — 반품 목록 ───────────────────────────
  app.get('/api/return-receipts', async (req) => {
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

  // ─── GET /api/return-receipts/:id — 상세 ────────────────────────────
  app.get('/api/return-receipts/:id', async (req, reply) => {
    const rrId = parseInt((req.params as any).id, 10);
    const [rrRes, itemsRes] = await Promise.all([
      pool.query('SELECT * FROM return_receipt WHERE rr_id = $1', [rrId]),
      pool.query(`
        SELECT rri.*, lt.lot_number AS original_lot_check, lt.status AS lot_status
        FROM return_receipt_item rri
        LEFT JOIN lot_transaction lt ON lt.lot_id = rri.original_lot_id
        WHERE rri.rr_id = $1
        ORDER BY rri.rri_id
      `, [rrId]),
    ]);
    if (!rrRes.rows[0]) return reply.status(404).send({ error: 'Not Found' });
    return { data: { ...rrRes.rows[0], items: itemsRes.rows } };
  });

  // ─── POST /api/return-receipts — 반품 등록 ──────────────────────────
  app.post('/api/return-receipts', async (req, reply) => {
    const body = req.body as Record<string, any>;
    const { rr_date, customer_id, customer_name, reason, remarks, worker,
            statement_id, so_id, items = [] } = body;

    if (!rr_date) return reply.status(400).send({ error: 'rr_date 필수' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 번호 자동생성
      const dateStr = rr_date.replace(/-/g, '');
      const cntRes = await client.query(
        `SELECT COUNT(*) as cnt FROM return_receipt WHERE rr_date = $1`, [rr_date]
      );
      const seq = parseInt(cntRes.rows[0].cnt, 10) + 1;
      const rr_number = `RR-${dateStr}-${String(seq).padStart(3, '0')}`;

      const rrRes = await client.query(`
        INSERT INTO return_receipt (rr_number, rr_date, statement_id, so_id, customer_id,
          customer_name, reason, status, worker, remarks)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING',$8,$9)
        RETURNING *
      `, [rr_number, rr_date, statement_id||null, so_id||null, customer_id||null,
          customer_name||null, reason||null, worker||null, remarks||null]);
      const rr = rrRes.rows[0];

      // 품목 등록 (return_type 자동 분류)
      for (const it of items) {
        const returnType = it.return_type || classifyReturnType(it.item_code||'', it.item_category||'');
        await client.query(`
          INSERT INTO return_receipt_item (rr_id, item_id, item_name, item_code, item_category,
            spec, unit, qty, original_lot_id, original_lot_number, return_type, remarks)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        `, [rr.rr_id, it.item_id||null, it.item_name||null, it.item_code||null,
            it.item_category||null, it.spec||null, it.unit||'EA', it.qty||0,
            it.original_lot_id||null, it.original_lot_number||null, returnType, it.remarks||null]);
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

  // ─── PATCH /api/return-receipts/:id/process — 반품처리 ──────────────
  // LOT 분류:
  //   DISPOSE          → lot_transaction.status = 'SCRAPPED' (폐기)
  //   ASSEMBLY_STOCK   → 새 LOT 생성 (lot_type='IN', lot_number=RET-*) + 재고 IN
  //   INSPECTION_STOCK → 인수검사 연동 LOT 생성 (lot_type='IN') + 재고 IN
  app.patch('/api/return-receipts/:id/process', async (req, reply) => {
    const rrId = parseInt((req.params as any).id, 10);
    const body = req.body as Record<string, any>;

    const rrCheck = await pool.query('SELECT * FROM return_receipt WHERE rr_id = $1', [rrId]);
    if (!rrCheck.rows[0]) return reply.status(404).send({ error: 'Not Found' });
    if (rrCheck.rows[0].status === 'COMPLETED') return reply.status(400).send({ error: '이미 처리완료' });

    const itemsRes = await pool.query(`
      SELECT rri.*, im.item_code, im.item_category
      FROM return_receipt_item rri
      LEFT JOIN item_master im ON im.item_id = rri.item_id
      WHERE rri.rr_id = $1
    `, [rrId]);
    const items = itemsRes.rows;

    const rr = rrCheck.rows[0];
    const processDate = body.process_date || rr.rr_date;
    const worker = body.worker || rr.worker;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const processedItems: any[] = [];

      for (const item of items) {
        const returnType = item.return_type || classifyReturnType(item.item_code||'', item.item_category||'');

        if (returnType === 'DISPOSE') {
          // 구조체/완제품 LOT → 폐기
          if (item.original_lot_id) {
            await client.query(
              `UPDATE lot_transaction SET status = 'SCRAPPED' WHERE lot_id = $1`,
              [item.original_lot_id]
            );
          }
          processedItems.push({ rri_id: item.rri_id, result: 'DISPOSED', lot_number: null });

        } else if (returnType === 'ASSEMBLY_STOCK' || returnType === 'INSPECTION_STOCK') {
          // 자재 LOT 재고 복원
          const dateStr = processDate.replace(/-/g, '');
          const prefix = returnType === 'INSPECTION_STOCK' ? 'RET-INSP' : 'RET';
          const cntRes = await client.query(
            `SELECT COUNT(*) as cnt FROM lot_transaction WHERE lot_number LIKE $1`, [`${prefix}-${dateStr}%`]
          );
          const seq = parseInt(cntRes.rows[0].cnt, 10) + 1;
          const newLotNumber = `${prefix}-${dateStr}-${String(seq).padStart(3, '0')}`;

          // 새 LOT 생성
          const newLotRes = await client.query(`
            INSERT INTO lot_transaction (lot_number, lot_type, item_id, qty, unit,
              supplier_lot, inspection_result, status, remaining_qty)
            VALUES ($1, 'IN', $2, $3, $4, $5, 'PASS', 'ACTIVE', $3)
            RETURNING *
          `, [newLotNumber, item.item_id, item.qty, item.unit||'EA',
              item.original_lot_number ? `RET:${item.original_lot_number}` : null]);
          const newLot = newLotRes.rows[0];

          // 재고 IN 등록
          await client.query(`
            INSERT INTO inventory_transaction (item_id, lot_id, txn_type, txn_date, qty, purpose, worker)
            VALUES ($1, $2, 'IN', $3, $4, $5, $6)
          `, [item.item_id, newLot.lot_id, processDate, item.qty,
              returnType === 'INSPECTION_STOCK' ? 'RETURN_INSPECTION' : 'RETURN', worker]);

          // 원본 LOT 상태 복원 처리
          if (item.original_lot_id) {
            await client.query(
              `UPDATE lot_transaction SET status = 'SHIPPED', remaining_qty = 0 WHERE lot_id = $1`,
              [item.original_lot_id]
            );
          }

          // return_receipt_item 업데이트
          await client.query(`
            UPDATE return_receipt_item SET new_lot_id=$1, new_lot_number=$2, return_type=$3
            WHERE rri_id=$4
          `, [newLot.lot_id, newLotNumber, returnType, item.rri_id]);

          processedItems.push({ rri_id: item.rri_id, result: 'STOCKED', lot_number: newLotNumber });
        }
      }

      // 반품 상태 완료
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

  // ─── DELETE /api/return-receipts/:id — 삭제 (PENDING만) ─────────────
  app.delete('/api/return-receipts/:id', async (req, reply) => {
    const rrId = parseInt((req.params as any).id, 10);
    const check = await pool.query('SELECT status FROM return_receipt WHERE rr_id = $1', [rrId]);
    if (!check.rows[0]) return reply.status(404).send({ error: 'Not Found' });
    if (check.rows[0].status !== 'PENDING') return reply.status(400).send({ error: 'PENDING 상태만 삭제 가능' });
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
