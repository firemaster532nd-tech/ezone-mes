import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { traceBack, traceForward } from './lot-utils.js';

export async function lotRoutes(app: FastifyInstance) {
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
}
