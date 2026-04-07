import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { kgToMeters } from './lot-properties.js';

export async function processExecutionRoutes(app: FastifyInstance) {
  // Migration: add worker_ids and worker_names columns, expand shift column
  await pool.query(`ALTER TABLE process_log ADD COLUMN IF NOT EXISTS worker_ids TEXT`);
  await pool.query(`ALTER TABLE process_log ADD COLUMN IF NOT EXISTS worker_names TEXT`);
  await pool.query(`ALTER TABLE process_log ALTER COLUMN shift TYPE VARCHAR(20)`);
  await pool.query(`ALTER TABLE process_log DROP CONSTRAINT IF EXISTS process_log_shift_check`);

  // GET /api/process-logs - 공정 실행 로그 목록
  app.get('/api/process-logs', async (request) => {
    const { wo_id, process_code, date, shift, worker_id, status } = request.query as {
      wo_id?: string;
      process_code?: string;
      date?: string;
      shift?: string;
      worker_id?: string;
      status?: string;
    };

    let query = `
      SELECT pl.*, w.worker_name, w.department,
             wo.wo_number, wo.wo_date,
             pl.worker_ids, pl.worker_names
      FROM process_log pl
      LEFT JOIN worker w ON w.worker_id = pl.worker_id
      LEFT JOIN work_order wo ON wo.wo_id = pl.wo_id
    `;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (wo_id) {
      params.push(parseInt(wo_id, 10));
      conditions.push(`pl.wo_id = $${params.length}`);
    }
    if (process_code) {
      params.push(process_code);
      conditions.push(`pl.process_code = $${params.length}`);
    }
    if (date) {
      params.push(date);
      conditions.push(`pl.created_at::date = $${params.length}`);
    }
    if (shift) {
      params.push(shift);
      conditions.push(`pl.shift LIKE '%' || $${params.length} || '%'`);
    }
    if (worker_id) {
      params.push(parseInt(worker_id, 10));
      conditions.push(`pl.worker_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`pl.status = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY pl.created_at DESC';

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });

  // GET /api/process-logs/:id - 공정 실행 상세 (이벤트 포함)
  app.get('/api/process-logs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const logId = parseInt(id, 10);

    const logResult = await pool.query(
      `SELECT pl.*, w.worker_name, w.department,
              wo.wo_number, wo.wo_date
       FROM process_log pl
       LEFT JOIN worker w ON w.worker_id = pl.worker_id
       LEFT JOIN work_order wo ON wo.wo_id = pl.wo_id
       WHERE pl.log_id = $1`,
      [logId]
    );

    if (logResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '공정 로그를 찾을 수 없습니다.' });
    }

    const eventsResult = await pool.query(
      `SELECT pe.*, w.worker_name
       FROM process_event pe
       LEFT JOIN worker w ON w.worker_id = pe.worker_id
       WHERE pe.log_id = $1
       ORDER BY pe.created_at ASC`,
      [logId]
    );

    return {
      data: {
        ...logResult.rows[0],
        events: eventsResult.rows,
      },
    };
  });

  // POST /api/process-logs - 공정 로그 생성
  app.post('/api/process-logs', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const { wo_id, process_code, shift, worker_id, planned_qty, worker_ids, worker_names } = body;

    // shift can be comma-separated (e.g. "AM,PM") or single value
    const effectiveShift = shift as string || '';
    if (!wo_id || !process_code || !effectiveShift) {
      return reply.status(400).send({ error: 'Bad Request', message: 'wo_id, process_code, shift는 필수입니다.' });
    }

    // PLANNED 상태 작업지시를 자동으로 IN_PROGRESS 전환
    const woCheck = await pool.query('SELECT status FROM work_order WHERE wo_id = $1', [wo_id]);
    if (woCheck.rows.length > 0 && woCheck.rows[0].status === 'PLANNED') {
      await pool.query(`UPDATE work_order SET status = 'IN_PROGRESS' WHERE wo_id = $1`, [wo_id]);
    }

    // Determine worker_id: use provided worker_id, or first from worker_ids array
    const workerIdsArr = Array.isArray(worker_ids) ? worker_ids : [];
    const effectiveWorkerId = worker_id || (workerIdsArr.length > 0 ? workerIdsArr[0] : null);
    const workerIdsJson = workerIdsArr.length > 0 ? JSON.stringify(workerIdsArr) : null;
    const workerNamesJson = Array.isArray(worker_names) ? JSON.stringify(worker_names) : null;

    const result = await pool.query(
      `INSERT INTO process_log (wo_id, process_code, shift, worker_id, planned_qty, worker_ids, worker_names)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [wo_id, process_code, effectiveShift, effectiveWorkerId || null, planned_qty || null, workerIdsJson, workerNamesJson]
    );

    return { data: result.rows[0] };
  });

  // POST /api/process-logs/:id/start - 작업 시작
  app.post('/api/process-logs/:id/start', async (request, reply) => {
    const { id } = request.params as { id: string };
    const logId = parseInt(id, 10);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const logResult = await client.query('SELECT * FROM process_log WHERE log_id = $1', [logId]);
      if (logResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Not Found' });
      }

      const log = logResult.rows[0];
      if (log.status !== 'READY') {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'Bad Request', message: 'READY 상태에서만 시작할 수 있습니다.' });
      }

      await client.query(
        `UPDATE process_log SET status = 'RUNNING', started_at = NOW() WHERE log_id = $1`,
        [logId]
      );

      await client.query(
        `INSERT INTO process_event (log_id, event_type, worker_id, qty_at_event)
         VALUES ($1, 'START', $2, 0)`,
        [logId, log.worker_id]
      );

      await client.query('COMMIT');

      const updated = await pool.query(
        `SELECT pl.*, w.worker_name, w.department, wo.wo_number, wo.wo_date
         FROM process_log pl
         LEFT JOIN worker w ON w.worker_id = pl.worker_id
         LEFT JOIN work_order wo ON wo.wo_id = pl.wo_id
         WHERE pl.log_id = $1`,
        [logId]
      );
      return { data: updated.rows[0] };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // POST /api/process-logs/:id/pause - 일시정지
  app.post('/api/process-logs/:id/pause', async (request, reply) => {
    const { id } = request.params as { id: string };
    const logId = parseInt(id, 10);
    const { reason } = (request.body as Record<string, unknown>) || {};

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const logResult = await client.query('SELECT * FROM process_log WHERE log_id = $1', [logId]);
      if (logResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Not Found' });
      }

      const log = logResult.rows[0];
      if (log.status !== 'RUNNING') {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'Bad Request', message: 'RUNNING 상태에서만 일시정지할 수 있습니다.' });
      }

      await client.query(`UPDATE process_log SET status = 'PAUSED' WHERE log_id = $1`, [logId]);

      await client.query(
        `INSERT INTO process_event (log_id, event_type, worker_id, reason, qty_at_event)
         VALUES ($1, 'PAUSE', $2, $3, $4)`,
        [logId, log.worker_id, reason || null, log.produced_qty]
      );

      await client.query('COMMIT');
      const updated = await pool.query('SELECT * FROM process_log WHERE log_id = $1', [logId]);
      return { data: updated.rows[0] };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // POST /api/process-logs/:id/resume - 재개
  app.post('/api/process-logs/:id/resume', async (request, reply) => {
    const { id } = request.params as { id: string };
    const logId = parseInt(id, 10);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const logResult = await client.query('SELECT * FROM process_log WHERE log_id = $1', [logId]);
      if (logResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Not Found' });
      }

      const log = logResult.rows[0];
      if (log.status !== 'PAUSED') {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'Bad Request', message: 'PAUSED 상태에서만 재개할 수 있습니다.' });
      }

      await client.query(`UPDATE process_log SET status = 'RUNNING' WHERE log_id = $1`, [logId]);

      await client.query(
        `INSERT INTO process_event (log_id, event_type, worker_id, qty_at_event)
         VALUES ($1, 'RESUME', $2, $3)`,
        [logId, log.worker_id, log.produced_qty]
      );

      await client.query('COMMIT');
      const updated = await pool.query('SELECT * FROM process_log WHERE log_id = $1', [logId]);
      return { data: updated.rows[0] };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // POST /api/process-logs/:id/complete - 작업 완료
  app.post('/api/process-logs/:id/complete', async (request, reply) => {
    const { id } = request.params as { id: string };
    const logId = parseInt(id, 10);
    const body = request.body as Record<string, unknown>;
    const { produced_qty, defect_qty, remarks } = body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const logResult = await client.query('SELECT * FROM process_log WHERE log_id = $1', [logId]);
      if (logResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Not Found' });
      }

      const log = logResult.rows[0];
      if (log.status !== 'RUNNING' && log.status !== 'PAUSED') {
        await client.query('ROLLBACK');
        return reply.status(400).send({ error: 'Bad Request', message: 'RUNNING 또는 PAUSED 상태에서만 완료할 수 있습니다.' });
      }

      await client.query(
        `UPDATE process_log SET status = 'COMPLETED', produced_qty = $2, defect_qty = $3,
         completed_at = NOW(), remarks = COALESCE($4, remarks)
         WHERE log_id = $1`,
        [logId, produced_qty || 0, defect_qty || 0, remarks || null]
      );

      await client.query(
        `INSERT INTO process_event (log_id, event_type, worker_id, qty_at_event, reason)
         VALUES ($1, 'COMPLETE', $2, $3, $4)`,
        [logId, log.worker_id, produced_qty || 0, remarks || null]
      );

      await client.query('COMMIT');
      const updated = await pool.query(
        `SELECT pl.*, w.worker_name, w.department, wo.wo_number, wo.wo_date
         FROM process_log pl
         LEFT JOIN worker w ON w.worker_id = pl.worker_id
         LEFT JOIN work_order wo ON wo.wo_id = pl.wo_id
         WHERE pl.log_id = $1`,
        [logId]
      );
      return { data: updated.rows[0] };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // POST /api/process-logs/:id/change-worker - 작업자 변경
  app.post('/api/process-logs/:id/change-worker', async (request, reply) => {
    const { id } = request.params as { id: string };
    const logId = parseInt(id, 10);
    const body = request.body as Record<string, unknown>;
    const { new_worker_id, new_worker_ids, new_worker_names, reason } = body as {
      new_worker_id?: number;
      new_worker_ids?: number[];
      new_worker_names?: string[];
      reason?: string;
    };

    // Accept either new_worker_ids array or single new_worker_id
    const workerIdsArr = Array.isArray(new_worker_ids) ? new_worker_ids : (new_worker_id ? [new_worker_id] : []);
    if (workerIdsArr.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'new_worker_id 또는 new_worker_ids는 필수입니다.' });
    }

    const effectiveWorkerId = workerIdsArr[0];
    const workerIdsJson = JSON.stringify(workerIdsArr);
    const workerNamesJson = Array.isArray(new_worker_names) ? JSON.stringify(new_worker_names) : null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const logResult = await client.query('SELECT * FROM process_log WHERE log_id = $1', [logId]);
      if (logResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Not Found' });
      }

      const log = logResult.rows[0];
      const oldWorkerId = log.worker_id;

      await client.query(
        `UPDATE process_log SET worker_id = $2, worker_ids = $3, worker_names = $4 WHERE log_id = $1`,
        [logId, effectiveWorkerId, workerIdsJson, workerNamesJson]
      );

      await client.query(
        `INSERT INTO process_event (log_id, event_type, worker_id, reason, qty_at_event)
         VALUES ($1, 'WORKER_CHANGE', $2, $3, $4)`,
        [logId, effectiveWorkerId, reason || `작업자 변경 (이전: worker_id=${oldWorkerId})`, log.produced_qty]
      );

      await client.query('COMMIT');
      const updated = await pool.query(
        `SELECT pl.*, w.worker_name, w.department, wo.wo_number, wo.wo_date,
                pl.worker_ids, pl.worker_names
         FROM process_log pl
         LEFT JOIN worker w ON w.worker_id = pl.worker_id
         LEFT JOIN work_order wo ON wo.wo_id = pl.wo_id
         WHERE pl.log_id = $1`,
        [logId]
      );
      return { data: updated.rows[0] };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // POST /api/process-logs/:id/log-defect - 불량 기록
  app.post('/api/process-logs/:id/log-defect', async (request, reply) => {
    const { id } = request.params as { id: string };
    const logId = parseInt(id, 10);
    const { qty, reason } = request.body as { qty?: number; reason?: string };

    if (!qty) {
      return reply.status(400).send({ error: 'Bad Request', message: 'qty는 필수입니다.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const logResult = await client.query('SELECT * FROM process_log WHERE log_id = $1', [logId]);
      if (logResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Not Found' });
      }

      await client.query(
        `UPDATE process_log SET defect_qty = COALESCE(defect_qty, 0) + $2 WHERE log_id = $1`,
        [logId, qty]
      );

      await client.query(
        `INSERT INTO process_event (log_id, event_type, worker_id, reason, qty_at_event)
         VALUES ($1, 'DEFECT', $2, $3, $4)`,
        [logId, logResult.rows[0].worker_id, reason || null, qty]
      );

      await client.query('COMMIT');
      const updated = await pool.query('SELECT * FROM process_log WHERE log_id = $1', [logId]);
      return { data: updated.rows[0] };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // PATCH /api/process-logs/:id - 비고, 수량, 실측무게 등 수정
  app.patch('/api/process-logs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const logId = parseInt(id, 10);
    const body = request.body as Record<string, unknown>;

    const allowedFields = [
      'remarks', 'planned_qty', 'produced_qty', 'defect_qty',
      'actual_input_qty', 'weighed_input', 'weighed_output', 'weighed_loss',
      'loss_qty', 'loss_rate', 'bom_id',
    ];
    const updates: string[] = [];
    const values: unknown[] = [];

    for (const field of allowedFields) {
      if (field in body) {
        values.push(body[field]);
        updates.push(`${field} = $${values.length}`);
      }
    }

    // Auto-calculate loss if weighed_input and weighed_output are provided
    const weighedInput = body.weighed_input != null ? Number(body.weighed_input) : null;
    const weighedOutput = body.weighed_output != null ? Number(body.weighed_output) : null;

    if (weighedInput != null && weighedOutput != null) {
      // loss_qty 자동 계산 (명시적으로 입력하지 않은 경우)
      if (!('loss_qty' in body)) {
        const autoLoss = weighedInput - weighedOutput;
        values.push(autoLoss);
        updates.push(`loss_qty = $${values.length}`);
      }
      // weighed_loss 자동 계산 (명시적으로 입력하지 않은 경우)
      if (!('weighed_loss' in body)) {
        const autoWeighedLoss = weighedInput - weighedOutput;
        values.push(autoWeighedLoss);
        updates.push(`weighed_loss = $${values.length}`);
      }
      // loss_rate 자동 계산 (명시적으로 입력하지 않은 경우)
      if (!('loss_rate' in body) && weighedInput > 0) {
        const autoRate = Math.round(((weighedInput - weighedOutput) / weighedInput) * 10000) / 100;
        values.push(autoRate);
        updates.push(`loss_rate = $${values.length}`);
      }
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: '수정할 항목이 없습니다.' });
    }

    values.push(logId);
    const result = await pool.query(
      `UPDATE process_log SET ${updates.join(', ')} WHERE log_id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found' });
    }
    return { data: result.rows[0] };
  });

  // POST /api/process-logs/:id/apply-density - 밀도 환산 적용
  app.post('/api/process-logs/:id/apply-density', async (request, reply) => {
    const { id } = request.params as { id: string };
    const logId = parseInt(id, 10);
    const body = request.body as Record<string, unknown>;
    const { density, thickness, width } = body;

    const d = Number(density) || 0;
    const t = Number(thickness) || 0;
    const w = Number(width) || 0;

    if (!d || !t || !w) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'density, thickness, width는 필수입니다.',
      });
    }

    // Fetch the process log
    const logResult = await pool.query(
      `SELECT pl.*, wo.wo_number,
              (SELECT lt2.lot_number FROM lot_transaction lt2 WHERE lt2.wo_id = pl.wo_id LIMIT 1) as lot_number
       FROM process_log pl
       LEFT JOIN work_order wo ON wo.wo_id = pl.wo_id
       WHERE pl.log_id = $1`,
      [logId]
    );

    if (logResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '공정 로그를 찾을 수 없습니다.' });
    }

    const log = logResult.rows[0];
    const outputKg = Number(log.weighed_output) || 0;
    const inputKg = Number(log.weighed_input) || 0;
    const lossKg = Number(log.weighed_loss) || 0;
    const lotNumber = log.lot_number || `LOG-${logId}`;

    // Calculate conversions
    const outputLengthM = outputKg > 0 ? kgToMeters(outputKg, d, t, w) : 0;
    const lossLengthM = lossKg > 0 ? kgToMeters(lossKg, d, t, w) : 0;
    const theoreticalLossKg = inputKg > 0 && outputKg > 0 ? inputKg - outputKg : null;
    const actualVsTheoreticalDiff = theoreticalLossKg != null && lossKg > 0 ? lossKg - theoreticalLossKg : null;

    // Upsert lot_properties
    const existingProp = await pool.query(
      'SELECT prop_id FROM lot_properties WHERE log_id = $1 LIMIT 1',
      [logId]
    );

    if (existingProp.rows.length > 0) {
      await pool.query(`
        UPDATE lot_properties SET
          density = $1, thickness = $2, width = $3,
          input_weight_kg = $4, output_weight_kg = $5, loss_weight_kg = $6,
          output_length_m = $7, loss_length_m = $8, length_calculated = $7,
          theoretical_loss_kg = $9, actual_vs_theoretical_diff = $10
        WHERE prop_id = $11
      `, [d, t, w, inputKg || null, outputKg || null, lossKg || null,
          outputLengthM || null, lossLengthM || null,
          theoreticalLossKg, actualVsTheoreticalDiff,
          existingProp.rows[0].prop_id]);
    } else {
      await pool.query(`
        INSERT INTO lot_properties
          (lot_number, process_code, log_id, density, thickness, width,
           input_weight_kg, output_weight_kg, loss_weight_kg,
           output_length_m, loss_length_m, length_calculated,
           theoretical_loss_kg, actual_vs_theoretical_diff, recorded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $10, $12, $13, $14)
      `, [lotNumber, log.process_code, logId, d, t, w,
          inputKg || null, outputKg || null, lossKg || null,
          outputLengthM || null, lossLengthM || null,
          theoreticalLossKg, actualVsTheoreticalDiff,
          log.worker_id || null]);
    }

    return {
      data: {
        output_weight_kg: outputKg,
        density,
        thickness_mm: t,
        width_mm: w,
        output_length_m: outputLengthM,
        loss_weight_kg: lossKg,
        loss_length_m: lossLengthM,
        theoretical_loss_kg: theoreticalLossKg,
        actual_vs_theoretical_diff: actualVsTheoreticalDiff,
      },
    };
  });
}
