import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { generateProcessLotNumber } from './lot-utils.js';

export async function shipmentRoutes(app: FastifyInstance) {
  // GET /api/shipments - 출하 목록
  app.get('/api/shipments', async (request) => {
    const { status, from, to } = request.query as {
      status?: string;
      from?: string;
      to?: string;
    };

    let query = `
      SELECT w.*, c.cert_number, c.structure_code, c.structure_name,
             i.item_name, i.item_code, i.item_category,
             lt.lot_number, lt.lot_id
      FROM work_order w
      LEFT JOIN certification_master c ON c.cert_id = w.cert_id
      LEFT JOIN item_master i ON i.item_id = w.item_id
      LEFT JOIN lot_transaction lt ON lt.wo_id = w.wo_id
      WHERE w.process_code = 'SHP'
    `;
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      query += ` AND w.status = $${params.length}`;
    }
    if (from) {
      params.push(from);
      query += ` AND w.wo_date >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      query += ` AND w.wo_date <= $${params.length}`;
    }

    query += ' ORDER BY w.wo_date DESC, w.wo_id DESC';

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });

  // GET /api/shipments/:id - 출하 상세
  app.get('/api/shipments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const woId = parseInt(id, 10);

    const result = await pool.query(`
      SELECT w.*, c.cert_number, c.structure_code, c.structure_name,
             i.item_name, i.item_code, i.item_category, i.unit,
             lt.lot_number, lt.lot_id, lt.supplier_lot
      FROM work_order w
      LEFT JOIN certification_master c ON c.cert_id = w.cert_id
      LEFT JOIN item_master i ON i.item_id = w.item_id
      LEFT JOIN lot_transaction lt ON lt.wo_id = w.wo_id
      WHERE w.wo_id = $1 AND w.process_code = 'SHP'
    `, [woId]);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    return { data: result.rows[0] };
  });

  // POST /api/shipments - 출하 등록
  app.post('/api/shipments', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const woDate = body.ship_date as string;

    if (!woDate) {
      return reply.status(400).send({ error: 'Bad Request', message: 'ship_date는 필수입니다.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 출하번호 자동생성
      const dateStr = woDate.replace(/-/g, '');
      const cntResult = await client.query(
        `SELECT COUNT(*) as cnt FROM work_order WHERE process_code = 'SHP' AND wo_date = $1`,
        [woDate]
      );
      const seq = parseInt(cntResult.rows[0].cnt, 10) + 1;
      const woNumber = `SHP-${dateStr}-${String(seq).padStart(3, '0')}`;

      // 출하 작업지시 INSERT
      const woResult = await client.query(
        `INSERT INTO work_order (wo_number, wo_date, process_code, cert_id, item_id, planned_qty,
          purpose, spec_detail, remarks, status)
         VALUES ($1,$2,'SHP',$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          woNumber, woDate,
          body.cert_id || null, body.item_id || null, body.planned_qty || null,
          body.customer || null, body.destination || null, body.remarks || null,
          'PLANNED',
        ]
      );
      const wo = woResult.rows[0];

      // 출하 LOT 생성
      const certId = body.cert_id ? Number(body.cert_id) : undefined;
      const lotNumber = await generateProcessLotNumber('OUT', woDate, certId);

      const lotResult = await client.query(
        `INSERT INTO lot_transaction (lot_number, lot_type, item_id, wo_id, qty, unit, status, remaining_qty)
         VALUES ($1,'OUT',$2,$3,$4,'EA','ACTIVE',$4)
         RETURNING *`,
        [lotNumber, body.item_id || null, wo.wo_id, body.planned_qty || 0]
      );

      await client.query('COMMIT');

      return {
        data: {
          ...wo,
          lot_number: lotResult.rows[0].lot_number,
          lot_id: lotResult.rows[0].lot_id,
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // PATCH /api/shipments/:id - 출하 상태 변경
  app.patch('/api/shipments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const woId = parseInt(id, 10);
    const body = request.body as Record<string, unknown>;

    const fields: string[] = [];
    const values: unknown[] = [];

    for (const key of ['status', 'actual_qty', 'inspector', 'remarks', 'purpose', 'spec_detail']) {
      if (body[key] !== undefined) {
        values.push(body[key]);
        fields.push(`${key} = $${values.length}`);
      }
    }

    if (body.status === 'COMPLETED') {
      fields.push('completed_at = NOW()');
    }

    if (fields.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: '수정할 항목이 없습니다.' });
    }

    values.push(woId);
    const result = await pool.query(
      `UPDATE work_order SET ${fields.join(', ')} WHERE wo_id = $${values.length} AND process_code = 'SHP' RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    // 출하 완료 시 LOT 상태 변경 + 재고 출고
    if (body.status === 'COMPLETED') {
      const wo = result.rows[0];
      await pool.query(
        `UPDATE lot_transaction SET status = 'SHIPPED' WHERE wo_id = $1`,
        [woId]
      );
      if (wo.item_id && wo.actual_qty) {
        await pool.query(
          `INSERT INTO inventory_transaction (item_id, txn_type, txn_date, qty, purpose, ref_wo_id, worker)
           VALUES ($1, 'OUT', $2, $3, 'SHP_OUT', $4, $5)`,
          [wo.item_id, wo.wo_date, wo.actual_qty, wo.wo_id, wo.inspector]
        );
      }
    }

    return { data: result.rows[0] };
  });

  // DELETE /api/shipments/:id - 출하 삭제 (PLANNED만)
  app.delete('/api/shipments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const woId = parseInt(id, 10);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const wo = await client.query(
        `SELECT * FROM work_order WHERE wo_id = $1 AND process_code = 'SHP'`,
        [woId]
      );
      if (wo.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Not Found' });
      }
      if (wo.rows[0].status === 'COMPLETED') {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'Bad Request', message: '완료된 출하는 삭제할 수 없습니다.' });
      }

      await client.query('DELETE FROM inventory_transaction WHERE ref_wo_id = $1', [woId]);
      await client.query('DELETE FROM lot_transaction WHERE wo_id = $1', [woId]);
      await client.query('DELETE FROM work_order WHERE wo_id = $1', [woId]);

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
