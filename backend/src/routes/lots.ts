import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { traceBack, traceForward } from './lot-utils.js';

export async function lotRoutes(app: FastifyInstance) {
  // ── DB 마이그레이션: 스테이징 컬럼 추가 ──
  await pool.query(`
    ALTER TABLE lot_transaction
      ADD COLUMN IF NOT EXISTS staging_status  VARCHAR(20) DEFAULT 'STOCK',
      ADD COLUMN IF NOT EXISTS staging_location VARCHAR(100),
      ADD COLUMN IF NOT EXISTS staged_at        TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS staged_by        VARCHAR(100)
  `).catch(() => {});

  // GET /api/lots - LOT 목록
  app.get('/api/lots', async (request) => {
    const { lot_type, status, item_id } = request.query as {
      lot_type?: string;
      status?: string;
      item_id?: string;
    };

    let query = `
      SELECT lt.*, i.item_name, i.item_code, w.wo_number, w.process_code
      FROM lot_transaction lt
      LEFT JOIN item_master i ON i.item_id = lt.item_id
      LEFT JOIN work_order w ON w.wo_id = lt.wo_id
    `;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (lot_type) {
      params.push(lot_type);
      conditions.push(`lt.lot_type = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`lt.status = $${params.length}`);
    }
    if (item_id) {
      params.push(parseInt(item_id, 10));
      conditions.push(`lt.item_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY lt.created_at DESC';

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });

  // GET /api/lots/:id/trace - LOT 역추적 (WITH RECURSIVE)
  app.get('/api/lots/:id/trace', async (request, reply) => {
    const { id } = request.params as { id: string };
    const lotId = parseInt(id, 10);

    // WITH RECURSIVE로 부모→자식 전체 계보 추적
    const result = await pool.query(
      `WITH RECURSIVE trace AS (
        -- 시작점: 대상 LOT
        SELECT lt.lot_id, lt.lot_number, lt.lot_type, lt.qty, lt.unit, lt.status,
               lt.inspection_result, lt.item_id,
               i.item_name, i.item_code,
               0 as depth,
               lt.lot_id as root_id
        FROM lot_transaction lt
        LEFT JOIN item_master i ON i.item_id = lt.item_id
        WHERE lt.lot_id = $1

        UNION ALL

        -- 재귀: 부모 LOT 탐색
        SELECT lt.lot_id, lt.lot_number, lt.lot_type, lt.qty, lt.unit, lt.status,
               lt.inspection_result, lt.item_id,
               i.item_name, i.item_code,
               t.depth + 1 as depth,
               t.root_id
        FROM lot_genealogy lg
        JOIN lot_transaction lt ON lt.lot_id = lg.parent_lot_id
        LEFT JOIN item_master i ON i.item_id = lt.item_id
        JOIN trace t ON t.lot_id = lg.child_lot_id
        WHERE t.depth < 10
      )
      SELECT * FROM trace ORDER BY depth, lot_id`,
      [lotId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'LOT를 찾을 수 없습니다.' });
    }

    // 계보 관계도 함께 반환
    const genealogy = await pool.query(
      `WITH RECURSIVE trace AS (
        SELECT lot_id FROM lot_transaction WHERE lot_id = $1
        UNION ALL
        SELECT lg.parent_lot_id FROM lot_genealogy lg
        JOIN trace t ON t.lot_id = lg.child_lot_id
      )
      SELECT lg.* FROM lot_genealogy lg
      WHERE lg.child_lot_id IN (SELECT lot_id FROM trace)
         OR lg.parent_lot_id IN (SELECT lot_id FROM trace)`,
      [lotId]
    );

    return {
      data: {
        nodes: result.rows,
        edges: genealogy.rows,
      },
    };
  });

  // GET /api/lots/:id/forward-trace - 정추적 (원재료→완제품)
  app.get('/api/lots/:id/forward-trace', async (request, reply) => {
    const { id } = request.params as { id: string };
    const lotId = parseInt(id, 10);

    const result = await pool.query(
      `WITH RECURSIVE trace AS (
        SELECT lt.lot_id, lt.lot_number, lt.lot_type, lt.qty, lt.unit, lt.status,
               lt.inspection_result, lt.item_id,
               i.item_name, i.item_code,
               0 as depth
        FROM lot_transaction lt
        LEFT JOIN item_master i ON i.item_id = lt.item_id
        WHERE lt.lot_id = $1

        UNION ALL

        SELECT lt.lot_id, lt.lot_number, lt.lot_type, lt.qty, lt.unit, lt.status,
               lt.inspection_result, lt.item_id,
               i.item_name, i.item_code,
               t.depth + 1
        FROM lot_genealogy lg
        JOIN lot_transaction lt ON lt.lot_id = lg.child_lot_id
        LEFT JOIN item_master i ON i.item_id = lt.item_id
        JOIN trace t ON t.lot_id = lg.parent_lot_id
        WHERE t.depth < 10
      )
      SELECT * FROM trace ORDER BY depth, lot_id`,
      [lotId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'LOT를 찾을 수 없습니다.' });
    }

    return { data: result.rows };
  });

  // POST /api/lots - LOT 수동 생성 (입고 LOT 등)
  app.post('/api/lots', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const lotType = body.lot_type as string;
    const itemId = body.item_id as number;
    const qty = body.qty as number;

    if (!lotType || !itemId || qty === undefined) {
      return reply.status(400).send({ error: 'Bad Request', message: 'lot_type, item_id, qty는 필수입니다.' });
    }

    // 입고 LOT 번호 생성
    const today = new Date().toISOString().slice(0, 10);
    const yy = today.slice(2, 4);
    const mm = today.slice(5, 7);
    const dd = today.slice(8, 10);

    const item = await pool.query('SELECT item_code FROM item_master WHERE item_id = $1', [itemId]);
    const itemCode = item.rows[0]?.item_code || 'XX';
    const codeAbbrev = itemCode.replace(/^[A-Z]+-/, '');

    const countResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM lot_transaction WHERE lot_type = $1 AND created_at::date = CURRENT_DATE`,
      [lotType]
    );
    const seq = parseInt(countResult.rows[0].cnt, 10) + 1;
    const lotNumber = `${yy}${mm}${dd}${codeAbbrev}${String(seq).padStart(3, '0')}`;

    const result = await pool.query(
      `INSERT INTO lot_transaction (lot_number, lot_type, item_id, qty, unit, supplier_lot,
        status, remaining_qty, location)
       VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE',$4,$7)
       RETURNING *`,
      [
        lotNumber, lotType, itemId, qty,
        body.unit || 'EA', body.supplier_lot || null, body.location || null,
      ]
    );

    return { data: result.rows[0] };
  });

  // GET /api/lots/:id/trace-back - 역추적 (완제품 → 원자재) using lot-utils
  app.get('/api/lots/:id/trace-back', async (request, reply) => {
    const { id } = request.params as { id: string };
    const lotId = parseInt(id, 10);

    const rows = await traceBack(lotId);
    if (rows.length === 0) {
      // LOT 자체가 존재하는지 확인
      const lotCheck = await pool.query('SELECT lot_id FROM lot_transaction WHERE lot_id = $1', [lotId]);
      if (lotCheck.rows.length === 0) {
        return reply.status(404).send({ error: 'Not Found', message: 'LOT를 찾을 수 없습니다.' });
      }
      return { data: [], message: '연결된 상위 LOT가 없습니다.' };
    }

    return { data: rows };
  });

  // GET /api/lots/:id/trace-forward - 정추적 (원자재 → 완제품) using lot-utils
  app.get('/api/lots/:id/trace-forward', async (request, reply) => {
    const { id } = request.params as { id: string };
    const lotId = parseInt(id, 10);

    const rows = await traceForward(lotId);
    if (rows.length === 0) {
      const lotCheck = await pool.query('SELECT lot_id FROM lot_transaction WHERE lot_id = $1', [lotId]);
      if (lotCheck.rows.length === 0) {
        return reply.status(404).send({ error: 'Not Found', message: 'LOT를 찾을 수 없습니다.' });
      }
      return { data: [], message: '연결된 하위 LOT가 없습니다.' };
    }

    return { data: rows };
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/lots/scan/:lotNumber — 바코드/QR 스캔으로 LOT 조회
  // ─────────────────────────────────────────────────────────────
  app.get('/api/lots/scan/:lotNumber', async (request, reply) => {
    const { lotNumber } = request.params as { lotNumber: string };
    const result = await pool.query(
      `SELECT lt.*,
              i.item_name, i.item_code, i.item_category, i.unit as item_unit,
              w.wo_number, w.process_code
       FROM lot_transaction lt
       LEFT JOIN item_master i ON i.item_id = lt.item_id
       LEFT JOIN work_order w ON w.wo_id = lt.wo_id
       WHERE lt.lot_number = $1`,
      [lotNumber.trim()]
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'not_found', message: `LOT번호 '${lotNumber}'을(를) 찾을 수 없습니다.` });
    }
    return { data: result.rows[0] };
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/lots/:id/label-data — 라벨 출력용 데이터
  // ─────────────────────────────────────────────────────────────
  app.get('/api/lots/:id/label-data', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      `SELECT lt.*,
              i.item_name, i.item_code, i.item_category, i.unit as item_unit,
              i.spec as item_spec
       FROM lot_transaction lt
       LEFT JOIN item_master i ON i.item_id = lt.item_id
       WHERE lt.lot_id = $1`,
      [parseInt(id, 10)]
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'not_found', message: 'LOT를 찾을 수 없습니다.' });
    }
    return { data: result.rows[0] };
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/lots/staging — 스테이징 중인 LOT 목록 (출하대기)
  // ─────────────────────────────────────────────────────────────
  app.get('/api/lots/staging', async (request) => {
    const { staging_status } = request.query as { staging_status?: string };
    let q = `
      SELECT lt.*,
             i.item_name, i.item_code, i.item_category, i.unit as item_unit
      FROM lot_transaction lt
      LEFT JOIN item_master i ON i.item_id = lt.item_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (staging_status) {
      params.push(staging_status);
      q += ` AND lt.staging_status = $${params.length}`;
    } else {
      q += ` AND lt.staging_status IN ('PACKING', 'SHIPPED')`;
    }
    q += ' ORDER BY lt.staged_at DESC';
    const result = await pool.query(q, params);
    return { data: result.rows, total: result.rows.length };
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /api/lots/:id/stage — 출하대기(PACKING) 처리
  // body: { location, staged_by, ship_qty? }
  // ─────────────────────────────────────────────────────────────
  app.patch('/api/lots/:id/stage', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      location?: string;
      staged_by?: string;
      ship_qty?: number;
    };
    const lotId = parseInt(id, 10);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // LOT 상태 확인
      const lotRes = await client.query(
        `SELECT lt.*, i.item_name, i.item_code FROM lot_transaction lt
         LEFT JOIN item_master i ON i.item_id = lt.item_id
         WHERE lt.lot_id = $1`,
        [lotId]
      );
      if (lotRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'not_found', message: 'LOT를 찾을 수 없습니다.' });
      }
      const lot = lotRes.rows[0];

      if (lot.staging_status === 'PACKING') {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'already_staged', message: '이미 출하대기 상태입니다.' });
      }

      const shipQty = body.ship_qty ?? (parseFloat(lot.remaining_qty) || parseFloat(lot.qty));

      // 1. 재고 차감 (OUT 기록)
      await client.query(
        `INSERT INTO inventory_transaction
           (item_id, lot_id, txn_type, txn_date, qty, purpose, ref_lot_number, worker)
         VALUES ($1, $2, 'OUT', CURRENT_DATE, $3, '출하포장', $4, $5)`,
        [lot.item_id, lot.lot_id, shipQty, lot.lot_number, body.staged_by || 'SYSTEM']
      );

      // 2. LOT remaining_qty 차감
      await client.query(
        `UPDATE lot_transaction
         SET remaining_qty = GREATEST(0, remaining_qty - $1),
             staging_status = 'PACKING',
             staging_location = $2,
             staged_at = NOW(),
             staged_by = $3
         WHERE lot_id = $4`,
        [shipQty, body.location || null, body.staged_by || null, lotId]
      );

      await client.query('COMMIT');
      const updated = await pool.query(
        `SELECT lt.*, i.item_name, i.item_code FROM lot_transaction lt
         LEFT JOIN item_master i ON i.item_id = lt.item_id
         WHERE lt.lot_id = $1`,
        [lotId]
      );
      return { data: updated.rows[0] };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /api/lots/:id/ship-out — 출하 완료 처리 (PACKING→SHIPPED)
  // body: { so_id?, statement_id?, shipped_by? }
  // ─────────────────────────────────────────────────────────────
  app.patch('/api/lots/:id/ship-out', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      so_id?: number;
      statement_id?: number;
      shipped_by?: string;
    };
    const lotId = parseInt(id, 10);

    const result = await pool.query(
      `UPDATE lot_transaction
       SET staging_status = 'SHIPPED',
           status = 'SHIPPED',
           staged_at = NOW()
       WHERE lot_id = $1 AND staging_status = 'PACKING'
       RETURNING *`,
      [lotId]
    );
    if (result.rows.length === 0) {
      return reply.status(400).send({
        error: 'invalid_state',
        message: '출하대기(PACKING) 상태의 LOT만 출하처리 가능합니다.',
      });
    }
    return { data: result.rows[0] };
  });

  // ─────────────────────────────────────────────────────────────
  // POST /api/lots/check-fifo — FIFO 선입선출 검사
  // body: { item_id, lot_id }
  // → fifo_ok: false + older_lots 리스트 → 프론트에서 완전 차단
  // ─────────────────────────────────────────────────────────────
  app.post('/api/lots/check-fifo', async (request) => {
    const { item_id, lot_id } = request.body as { item_id: number; lot_id: number };

    // 같은 품목(item_id)에서 lot_id보다 입고일(created_at)이 빠르고
    // 아직 ACTIVE + remaining_qty > 0 인 LOT가 있으면 FIFO 위반
    const olderRes = await pool.query(
      `SELECT lot_id, lot_number, created_at, remaining_qty
       FROM lot_transaction
       WHERE item_id = $1
         AND lot_id   != $2
         AND status IN ('ACTIVE')
         AND COALESCE(staging_status, 'STOCK') = 'STOCK'
         AND COALESCE(remaining_qty, qty)  > 0
         AND created_at < (SELECT created_at FROM lot_transaction WHERE lot_id = $2)
       ORDER BY created_at ASC`,
      [item_id, lot_id]
    );

    if (olderRes.rows.length > 0) {
      return {
        data: {
          fifo_ok: false,
          older_lots: olderRes.rows,
        }
      };
    }
    return { data: { fifo_ok: true, older_lots: [] } };
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /api/lots/:id/location — 로케이션만 업데이트 (재고 차감 없음)
  // body: { location }
  // ─────────────────────────────────────────────────────────────
  app.patch('/api/lots/:id/location', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { location } = request.body as { location: string };
    const lotId = parseInt(id, 10);

    // 1로케이션 1LOT 체크: 이미 해당 위치에 다른 ACTIVE LOT가 있으면 차단
    const conflict = await pool.query(
      `SELECT lot_id, lot_number FROM lot_transaction
       WHERE staging_location = $1 AND lot_id != $2 AND status = 'ACTIVE'
       LIMIT 1`,
      [location, lotId]
    );
    if (conflict.rows.length > 0) {
      return reply.status(409).send({
        error: 'location_conflict',
        message: `로케이션 ${location}에 이미 LOT(${conflict.rows[0].lot_number})가 있습니다. 1로케이션 1LOT 규칙 위반.`,
        conflict_lot: conflict.rows[0],
      });
    }

    // HOLD존 이동 시 상태 변경
    const isHold = location.startsWith('H-');
    const result = await pool.query(
      `UPDATE lot_transaction
       SET staging_location = $1,
           staged_at = NOW()
           ${isHold ? ", status = 'ACTIVE', staging_status = 'HOLD'" : ''}
       WHERE lot_id = $2
       RETURNING *`,
      [location, lotId]
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'not_found' });
    }
    return { data: result.rows[0] };
  });
}
