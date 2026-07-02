import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

/** DB 마이그레이션: inventory_transaction 테이블에 수불대장 컬럼 추가 */
async function migrateInventoryTransaction() {
  const newColumns = [
    { name: 'source_lot', type: 'VARCHAR(100)' },       // 입고처/전공정 LOT번호
    { name: 'linked_lot', type: 'VARCHAR(100)' },        // 연계 LOT
    { name: 'issuer_name', type: 'VARCHAR(100)' },       // 불출자
    { name: 'verifier_name', type: 'VARCHAR(100)' },     // 확인자
  ];
  for (const col of newColumns) {
    await pool.query(`
      ALTER TABLE inventory_transaction ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};
    `);
  }
  await pool.query(`
    INSERT INTO department (dept_code, dept_name, sort_order)
    VALUES ('PURCHASING', '구매팀', 6)
    ON CONFLICT (dept_code) DO NOTHING;
  `);
}

export async function inventoryRoutes(app: FastifyInstance) {
  // Run migration on route registration
  await migrateInventoryTransaction();
  // GET /api/inventory/dashboard - 재고 대시보드 (카테고리별 요약)
  app.get('/api/inventory/dashboard', async () => {
    const result = await pool.query(`
      SELECT
        i.item_category as category,
        COUNT(DISTINCT i.item_id) as total_items,
        COALESCE(SUM(
          CASE WHEN inv.balance_qty > 0 THEN inv.balance_qty ELSE 0 END
        ), 0) as total_balance,
        COUNT(DISTINCT CASE WHEN inv.balance_qty < i.safety_stock THEN i.item_id END) as below_safety_count,
        COUNT(DISTINCT CASE WHEN lt.status = 'ACTIVE' THEN lt.lot_id END) as active_lot_count
      FROM item_master i
      LEFT JOIN (
        SELECT item_id, SUM(CASE WHEN txn_type = 'IN' THEN qty
                                  WHEN txn_type = 'OUT' THEN -qty
                                  ELSE qty END) as balance_qty
        FROM inventory_transaction
        GROUP BY item_id
      ) inv ON inv.item_id = i.item_id
      LEFT JOIN lot_transaction lt ON lt.item_id = i.item_id AND lt.status = 'ACTIVE'
      WHERE i.is_active = true
      GROUP BY i.item_category
      ORDER BY i.item_category
    `);
    return { data: result.rows };
  });

  // GET /api/inventory/summary - 품목별 재고 현황
  app.get('/api/inventory/summary', async (request) => {
    const { category } = request.query as { category?: string };

    let query = `
      SELECT
        i.item_id, i.item_code, i.item_name, i.item_category, i.unit, i.safety_stock,
        COALESCE(SUM(CASE WHEN it.txn_type = 'IN' THEN it.qty ELSE 0 END), 0) as total_in,
        COALESCE(SUM(CASE WHEN it.txn_type = 'OUT' THEN it.qty ELSE 0 END), 0) as total_out,
        COALESCE(SUM(CASE WHEN it.txn_type = 'IN' THEN it.qty
                          WHEN it.txn_type = 'OUT' THEN -it.qty
                          ELSE it.qty END), 0) as balance,
        COUNT(DISTINCT CASE WHEN lt.status = 'ACTIVE' THEN lt.lot_id END) as active_lots
      FROM item_master i
      LEFT JOIN inventory_transaction it ON it.item_id = i.item_id
      LEFT JOIN lot_transaction lt ON lt.item_id = i.item_id AND lt.status = 'ACTIVE'
      WHERE i.is_active = true
    `;
    const params: unknown[] = [];

    if (category) {
      params.push(category);
      query += ` AND i.item_category = $${params.length}`;
    }

    query += ` GROUP BY i.item_id, i.item_code, i.item_name, i.item_category, i.unit, i.safety_stock
               ORDER BY i.item_category, i.item_code`;

    const result = await pool.query(query, params);
    const rows = result.rows.map((r: any) => ({
      ...r,
      is_below_safety: parseFloat(r.balance) < parseFloat(r.safety_stock),
    }));
    return { data: rows, total: rows.length };
  });

  // GET /api/inventory/transactions - 수불 내역
  app.get('/api/inventory/transactions', async (request) => {
    const { item_id, txn_type, from, to } = request.query as {
      item_id?: string;
      txn_type?: string;
      from?: string;
      to?: string;
    };

    let query = `
      SELECT it.*, i.item_name, i.item_code, i.item_category, i.unit
      FROM inventory_transaction it
      JOIN item_master i ON i.item_id = it.item_id
    `;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (item_id) {
      params.push(parseInt(item_id, 10));
      conditions.push(`it.item_id = $${params.length}`);
    }
    if (txn_type) {
      params.push(txn_type);
      conditions.push(`it.txn_type = $${params.length}`);
    }
    if (from) {
      params.push(from);
      conditions.push(`it.txn_date >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`it.txn_date <= $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY it.txn_date DESC, it.inv_id DESC';

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });

  /**
   * POST /api/inventory/transactions - 수불 기록 생성
   * 입고(IN)는 인수검사 합격 시 자동 생성됨 → 여기서는 출고(OUT)/조정(ADJ) 위주
   * 수동 입고도 가능하나, lot_id 필수 (합격된 LOT만)
   */
  app.post('/api/inventory/transactions', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const { item_id, txn_type, qty, txn_date } = body as {
      item_id: number;
      txn_type: string;
      qty: number;
      txn_date: string;
    };

    if (!item_id || !txn_type || qty === undefined || !txn_date) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'item_id, txn_type, qty, txn_date는 필수입니다.',
      });
    }

    const result = await pool.query(
      `INSERT INTO inventory_transaction
        (item_id, lot_id, txn_type, txn_date, qty, purpose, ref_wo_id, ref_lot_number, worker, confirmed_by,
         source_lot, linked_lot, issuer_name, verifier_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        item_id, body.lot_id || null, txn_type, txn_date, qty,
        body.purpose || null, body.ref_wo_id || null,
        body.ref_lot_number || null, body.worker || null, body.confirmed_by || null,
        body.source_lot || null, body.linked_lot || null,
        body.issuer_name || null, body.verifier_name || null,
      ]
    );

    return { data: result.rows[0] };
  });

  // GET /api/inventory/lots - 입고 LOT 목록 (인수검사 연동용)
  app.get('/api/inventory/lots', async (request) => {
    const { status, inspection_result, item_category } = request.query as {
      status?: string;
      inspection_result?: string;
      item_category?: string;
    };

    let query = `
      SELECT lt.*, i.item_name, i.item_code, i.item_category, i.unit as item_unit
      FROM lot_transaction lt
      JOIN item_master i ON i.item_id = lt.item_id
      WHERE lt.lot_type = 'IN'
    `;
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      query += ` AND lt.status = $${params.length}`;
    }
    if (inspection_result) {
      params.push(inspection_result);
      query += ` AND lt.inspection_result = $${params.length}`;
    }
    if (item_category) {
      params.push(item_category);
      query += ` AND i.item_category = $${params.length}`;
    }

    query += ' ORDER BY lt.created_at DESC';

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });

  // GET /api/inventory/lot-inventory - LOT별 재고 현황 (수불대장 형식)
  app.get('/api/inventory/lot-inventory', async (request) => {
    const { category, item_id, status } = request.query as {
      category?: string;
      item_id?: string;
      status?: string;
    };

    let query = `
      SELECT
        lt.lot_id, lt.lot_number, lt.lot_type, lt.supplier_lot, lt.inspection_lot,
        lt.inspection_result, lt.status as lot_status, lt.qty as lot_qty,
        lt.remaining_qty, lt.created_at as lot_date,
        i.item_id, i.item_code, i.item_name, i.item_category, i.unit,
        COALESCE(inv_agg.total_in, 0) as total_in,
        COALESCE(inv_agg.total_out, 0) as total_out,
        COALESCE(inv_agg.balance, 0) as balance
      FROM lot_transaction lt
      JOIN item_master i ON i.item_id = lt.item_id
      LEFT JOIN (
        SELECT lot_id,
          SUM(CASE WHEN txn_type = 'IN' THEN qty ELSE 0 END) as total_in,
          SUM(CASE WHEN txn_type = 'OUT' THEN qty ELSE 0 END) as total_out,
          SUM(CASE WHEN txn_type = 'IN' THEN qty
                    WHEN txn_type = 'OUT' THEN -qty
                    ELSE qty END) as balance
        FROM inventory_transaction
        WHERE lot_id IS NOT NULL
        GROUP BY lot_id
      ) inv_agg ON inv_agg.lot_id = lt.lot_id
      WHERE lt.lot_type = 'IN'
    `;
    const params: unknown[] = [];

    if (category) {
      params.push(category);
      query += ` AND i.item_category = $${params.length}`;
    }
    if (item_id) {
      params.push(parseInt(item_id, 10));
      query += ` AND i.item_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND lt.status = $${params.length}`;
    }

    query += ' ORDER BY lt.created_at DESC';

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });

  // GET /api/inventory/lot-transactions/:lotId - 특정 LOT의 수불 내역
  app.get('/api/inventory/lot-transactions/:lotId', async (request) => {
    const { lotId } = request.params as { lotId: string };

    const result = await pool.query(`
      SELECT it.*, i.item_name, i.item_code, i.unit
      FROM inventory_transaction it
      JOIN item_master i ON i.item_id = it.item_id
      WHERE it.lot_id = $1
      ORDER BY it.txn_date DESC, it.inv_id DESC
    `, [parseInt(lotId, 10)]);

    return { data: result.rows, total: result.rows.length };
  });

  // GET /api/inventory/ledger/:itemId - 품목별 수불대장 (잔량 자동계산)
  app.get('/api/inventory/ledger/:itemId', async (request) => {
    const { itemId } = request.params as { itemId: string };
    const { from, to } = request.query as { from?: string; to?: string };

    let query = `
      SELECT it.inv_id, it.item_id, it.lot_id, it.txn_type, it.txn_date, it.qty,
             it.purpose, it.ref_lot_number, it.worker, it.confirmed_by,
             it.source_lot, it.linked_lot, it.issuer_name, it.verifier_name,
             it.created_at,
             i.item_name, i.item_code, i.item_category, i.unit,
             lt.lot_number, lt.supplier_lot, lt.inspection_lot
      FROM inventory_transaction it
      JOIN item_master i ON i.item_id = it.item_id
      LEFT JOIN lot_transaction lt ON lt.lot_id = it.lot_id
      WHERE it.item_id = $1
    `;
    const params: unknown[] = [parseInt(itemId, 10)];

    if (from) {
      params.push(from);
      query += ` AND it.txn_date >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      query += ` AND it.txn_date <= $${params.length}`;
    }

    query += ' ORDER BY it.txn_date ASC, it.inv_id ASC';

    const result = await pool.query(query, params);

    // Calculate running balance
    let balance = 0;
    const ledger = result.rows.map((row: any) => {
      const qty = parseFloat(row.qty);
      if (row.txn_type === 'IN') {
        balance += qty;
      } else if (row.txn_type === 'OUT') {
        balance -= qty;
      } else {
        // ADJ: qty can be positive or negative
        balance += qty;
      }
      return {
        ...row,
        running_balance: Math.round(balance * 100) / 100,
      };
    });

    return { data: ledger, total: ledger.length };
  });

  // DELETE /api/inventory/transactions/:id - 수불 기록 삭제
  app.delete('/api/inventory/transactions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      'DELETE FROM inventory_transaction WHERE inv_id = $1 RETURNING *',
      [parseInt(id, 10)]
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found' });
    }
    return { data: { success: true } };
  });

  // PATCH /api/inventory/transactions/:id - 수불 기록 수정
  app.patch('/api/inventory/transactions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const key of ['txn_type', 'qty', 'txn_date', 'purpose', 'worker', 'confirmed_by',
                        'source_lot', 'linked_lot', 'issuer_name', 'verifier_name']) {
      if (body[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(body[key]);
      }
    }

    if (fields.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: '수정할 항목이 없습니다.' });
    }

    values.push(parseInt(id, 10));
    const result = await pool.query(
      `UPDATE inventory_transaction SET ${fields.join(', ')} WHERE inv_id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found' });
    }
    return { data: result.rows[0] };
  });

  // ──────────────────────────────────────────────
  // POST /api/inventory/apply-process-result — 공정 결과 재고 반영
  // ──────────────────────────────────────────────
  app.post('/api/inventory/apply-process-result', async (request, reply) => {
    const body = request.body as {
      log_id: number;
      wo_id?: number;
      process_code?: string;
      lot_number?: string;
      input_items?: Array<{ item_id: number; lot_id?: number; qty: number }>;
      output_item_id?: number;
      output_qty?: number;
      loss_qty?: number;
      worker?: string;
    };

    if (!body.log_id) {
      return reply.status(400).send({ error: 'Bad Request', message: 'log_id는 필수입니다.' });
    }

    // 이미 반영되었는지 확인
    const logCheck = await pool.query(
      `SELECT pl.log_id, pl.inventory_applied, pl.process_code, pl.raw_material_inputs, pl.wo_id, pl.worker_id, pl.worker_names,
              pl.produced_qty, pl.weighed_loss,
              wo.item_id as output_item_id, wo.lot_number as wo_lot_number,
              im.unit as output_unit
       FROM process_log pl
       LEFT JOIN work_order wo ON wo.wo_id = pl.wo_id
       LEFT JOIN item_master im ON im.item_id = wo.item_id
       WHERE pl.log_id = $1`,
      [body.log_id]
    );
    if (logCheck.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '공정 로그를 찾을 수 없습니다.' });
    }
    const logRow = logCheck.rows[0];
    if (logRow.inventory_applied) {
      return reply.status(400).send({ error: 'Bad Request', message: '이미 재고 반영된 공정 로그입니다.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const txnDate = new Date().toISOString().slice(0, 10);
      const createdTxns: unknown[] = [];

      const processCode = logRow.process_code;
      const woId = logRow.wo_id;
      const woLotNumber = logRow.wo_lot_number;
      const outputItemId = logRow.output_item_id;
      const outputQty = Number(logRow.produced_qty || body.output_qty || 0);
      const lossQty = Number(logRow.weighed_loss || body.loss_qty || 0);
      const outputUnit = logRow.output_unit || 'kg';

      let workerName = '';
      if (logRow.worker_names) {
        try {
          const parsed = JSON.parse(logRow.worker_names);
          if (Array.isArray(parsed) && parsed.length > 0) {
            workerName = parsed[0];
          } else if (typeof parsed === 'string') {
            workerName = parsed;
          }
        } catch {
          workerName = logRow.worker_names;
        }
      }

      if (processCode === 'MIX') {
        // ─── 배합 공정 전용 재고 연계 로직 ───
        let rawInputs: Array<{ item_id: number; qty: number }> = [];
        if (logRow.raw_material_inputs) {
          try {
            const parsed = JSON.parse(logRow.raw_material_inputs);
            if (Array.isArray(parsed)) {
              rawInputs = parsed;
            }
          } catch {
            rawInputs = [];
          }
        }
        const inputAllocations: Array<{ item_id: number; lot_id: number; qty: number }> = [];

        // A. 원재료 출고 및 LOT 잔량 차감 (FIFO 선입선출)
        for (const input of rawInputs) {
          const itemId = input.item_id;
          const requiredQty = Number(input.qty);

          if (requiredQty <= 0) continue;

          // 가용 LOT 목록 조회 (FIFO)
          const lotsRes = await client.query(
            `SELECT lot_id, lot_number, qty, remaining_qty
             FROM lot_transaction
             WHERE item_id = $1 AND status = 'ACTIVE' AND COALESCE(remaining_qty, qty) > 0
             ORDER BY created_at ASC`,
            [itemId]
          );

          let remainingNeed = requiredQty;
          for (const lot of lotsRes.rows) {
            if (remainingNeed <= 0) break;

            const available = parseFloat(lot.remaining_qty ?? lot.qty);
            const allocate = Math.min(available, remainingNeed);

            // 1. lot_transaction remaining_qty 감산
            await client.query(
              `UPDATE lot_transaction
               SET remaining_qty = GREATEST(0, remaining_qty - $1),
                   status = CASE WHEN remaining_qty - $1 <= 0 THEN 'SHIPPED' ELSE status END
               WHERE lot_id = $2`,
              [allocate, lot.lot_id]
            );

            // 2. inventory_transaction OUT 기록
            const r = await client.query(
              `INSERT INTO inventory_transaction
                (item_id, lot_id, txn_type, txn_date, qty, purpose, ref_wo_id, ref_lot_number, worker)
               VALUES ($1, $2, 'OUT', $3, $4, '공정투입', $5, $6, $7)
               RETURNING *`,
              [itemId, lot.lot_id, txnDate, allocate, woId, woLotNumber || null, workerName || null]
            );
            createdTxns.push(r.rows[0]);
            inputAllocations.push({ item_id: itemId, lot_id: lot.lot_id, qty: allocate });

            remainingNeed -= allocate;
          }

          // 만약 가용 LOT 잔량이 부족해도, 남은 수량은 무LOT 혹은 기존 마지막 LOT에 임의 차감하여 이력은 남김
          if (remainingNeed > 0) {
            const r = await client.query(
              `INSERT INTO inventory_transaction
                (item_id, lot_id, txn_type, txn_date, qty, purpose, ref_wo_id, ref_lot_number, worker)
               VALUES ($1, NULL, 'OUT', $2, $3, '공정투입(LOT부족)', $4, $5, $6)
               RETURNING *`,
              [itemId, txnDate, remainingNeed, woId, woLotNumber || null, workerName || null]
            );
            createdTxns.push(r.rows[0]);
          }
        }

        // B. 배합물 산출 LOT 생성 (lot_transaction 입고)
        let outputLotId: number | null = null;
        if (outputItemId && outputQty > 0) {
          const lotRes = await client.query(
            `INSERT INTO lot_transaction (lot_number, lot_type, item_id, qty, remaining_qty, unit, status, wo_id)
             VALUES ($1, 'PRODUCTION', $2, $3, $3, $4, 'ACTIVE', $5)
             ON CONFLICT (lot_number) DO UPDATE SET qty = lot_transaction.qty + $3, remaining_qty = lot_transaction.remaining_qty + $3
             RETURNING lot_id`,
            [woLotNumber || `MIX-${body.log_id}`, 'SA', outputItemId, outputQty, outputUnit, woId]
          );
          outputLotId = lotRes.rows[0]?.lot_id;

          // inventory_transaction IN 기록
          const r = await client.query(
            `INSERT INTO inventory_transaction
              (item_id, lot_id, txn_type, txn_date, qty, purpose, ref_wo_id, ref_lot_number, worker)
             VALUES ($1, $2, 'IN', $3, $4, '공정산출', $5, $6, $7)
             RETURNING *`,
            [outputItemId, outputLotId, txnDate, outputQty, woId, woLotNumber || null, workerName || null]
          );
          createdTxns.push(r.rows[0]);
        }

        // C. 배합 로스 기록
        if (lossQty > 0 && inputAllocations.length > 0) {
          const firstAlloc = inputAllocations[0];
          const r = await client.query(
            `INSERT INTO inventory_transaction
              (item_id, lot_id, txn_type, txn_date, qty, purpose, ref_wo_id, ref_lot_number, worker)
             VALUES ($1, $2, 'LOSS', $3, $4, '공정로스', $5, $6, $7)
             RETURNING *`,
            [firstAlloc.item_id, firstAlloc.lot_id, txnDate, lossQty, woId, woLotNumber || null, workerName || null]
          );
          createdTxns.push(r.rows[0]);
        }

      } else {
        // ─── 타 공정 (압출/재단/조립 등) 기존 범용 로직 ───
        // 1. 투입 자재 출고 (OUT)
        if (body.input_items && body.input_items.length > 0) {
          for (const input of body.input_items) {
            // 타 공정 자재 차감 시에도 lot_transaction.remaining_qty 차감 적용
            if (input.lot_id) {
              await client.query(
                `UPDATE lot_transaction
                 SET remaining_qty = GREATEST(0, remaining_qty - $1),
                     status = CASE WHEN remaining_qty - $1 <= 0 THEN 'SHIPPED' ELSE status END
                 WHERE lot_id = $2`,
                [input.qty, input.lot_id]
              );
            }
            const r = await client.query(
              `INSERT INTO inventory_transaction
                (item_id, lot_id, txn_type, txn_date, qty, purpose, ref_wo_id, ref_lot_number, worker)
               VALUES ($1, $2, 'OUT', $3, $4, '공정투입', $5, $6, $7)
               RETURNING *`,
              [input.item_id, input.lot_id || null, txnDate, input.qty,
               woId || null, woLotNumber || null, workerName || null]
            );
            createdTxns.push(r.rows[0]);
          }
        }

        // 2. 산출물 입고 (IN)
        if (body.output_item_id && body.output_qty && body.output_qty > 0) {
          // 타 공정 생산 입고 시에도 lot_transaction 생성
          let finalLotNumber = woLotNumber || `PROD-${body.log_id}`;
          if (processCode === 'EXT' && logRow.parent_lot_number) {
            finalLotNumber = logRow.parent_lot_number.endsWith('-E') ? logRow.parent_lot_number : `${logRow.parent_lot_number}-E`;
          } else if (processCode === 'CUT' && logRow.parent_lot_number) {
            const base = logRow.parent_lot_number.endsWith('-E') ? logRow.parent_lot_number.slice(0, -2) : logRow.parent_lot_number;
            finalLotNumber = base.endsWith('-C') ? base : `${base}-C`;
          }

          if (finalLotNumber !== woLotNumber) {
            await client.query(`UPDATE work_order SET lot_number = $1 WHERE wo_id = $2`, [finalLotNumber, woId]);
          }

          let outputLotId: number | null = null;
          const lotRes = await client.query(
            `INSERT INTO lot_transaction (lot_number, lot_type, item_id, qty, remaining_qty, unit, status, wo_id)
             VALUES ($1, 'PRODUCTION', $2, $3, $3, $4, 'ACTIVE', $5)
             ON CONFLICT (lot_number) DO UPDATE SET qty = lot_transaction.qty + $3, remaining_qty = lot_transaction.remaining_qty + $3
             RETURNING lot_id`,
            [finalLotNumber, 'SA', body.output_item_id, body.output_qty, outputUnit, woId]
          );
          outputLotId = lotRes.rows[0]?.lot_id;

          const r = await client.query(
            `INSERT INTO inventory_transaction
              (item_id, lot_id, txn_type, txn_date, qty, purpose, ref_wo_id, ref_lot_number, worker)
             VALUES ($1, $2, 'IN', $3, $4, '공정산출', $5, $6, $7)
             RETURNING *`,
            [body.output_item_id, outputLotId, txnDate, body.output_qty,
             woId || null, finalLotNumber, workerName || null]
          );
          createdTxns.push(r.rows[0]);
        }

        // 3. 로스 기록 (LOSS)
        if (body.loss_qty && body.loss_qty > 0 && body.input_items && body.input_items.length > 0) {
          const firstInput = body.input_items[0];
          const r = await client.query(
            `INSERT INTO inventory_transaction
              (item_id, lot_id, txn_type, txn_date, qty, purpose, ref_wo_id, ref_lot_number, worker)
             VALUES ($1, $2, 'LOSS', $3, $4, '공정로스', $5, $6, $7)
             RETURNING *`,
            [firstInput.item_id, firstInput.lot_id || null, txnDate, body.loss_qty,
             woId || null, woLotNumber || null, workerName || null]
          );
          createdTxns.push(r.rows[0]);
        }
      }

      // 4. process_log.inventory_applied = true 업데이트
      await client.query(
        `UPDATE process_log SET inventory_applied = true WHERE log_id = $1`,
        [body.log_id]
      );

      await client.query('COMMIT');

      return {
        data: {
          log_id: body.log_id,
          inventory_applied: true,
          transactions_created: createdTxns.length,
          transactions: createdTxns,
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // GET /api/inventory/available-lots - 가용 LOT 목록 (FIFO 선입선출, 작업지시 투입용)
  app.get('/api/inventory/available-lots', async (request) => {
    const { item_category } = request.query as {
      item_category?: string;
    };

    let query = `
      SELECT * FROM (
        SELECT
          lt.lot_id, lt.lot_number, lt.lot_type, lt.item_id,
          i.item_code, i.item_name, i.item_category, i.unit,
          GREATEST(
            COALESCE(lt.remaining_qty, lt.qty),
            COALESCE(
              (SELECT SUM(CASE WHEN it.txn_type = 'IN' THEN it.qty
                               WHEN it.txn_type = 'OUT' THEN -it.qty
                               ELSE it.qty END)
               FROM inventory_transaction it WHERE it.lot_id = lt.lot_id), 0
            )
          ) as balance,
          lt.remaining_qty, lt.qty as lot_qty,
          lt.supplier_lot, lt.inspection_lot, lt.created_at,
          lt.wo_id,
          wo.wo_number, wo.ext_spec
        FROM lot_transaction lt
        JOIN item_master i ON i.item_id = lt.item_id
        LEFT JOIN work_order wo ON wo.wo_id = lt.wo_id
        WHERE lt.status = 'ACTIVE'
    `;
    const params: unknown[] = [];

    if (item_category) {
      params.push(item_category);
      query += ` AND i.item_category = $${params.length}`;
    }

    query += `
      ) sub WHERE sub.balance > 0
      ORDER BY sub.created_at ASC
    `;

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });

  // ──────────────────────────────────────────────
  // POST /api/inventory/initialize — 초기 재고 설정
  // ──────────────────────────────────────────────
  app.post('/api/inventory/initialize', async (request, reply) => {
    const body = request.body as {
      items: Array<{ item_code: string; qty: number; note?: string }>;
    };

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'items 배열이 필요합니다. [{ item_code, qty, note? }]',
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const lotNumber = `INIT-${today.replace(/-/g, '')}`;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const created: unknown[] = [];

      for (const entry of body.items) {
        if (!entry.item_code || entry.qty == null) continue;

        // Look up item by item_code
        const itemRes = await client.query(
          `SELECT item_id, item_code, item_name FROM item_master WHERE item_code = $1 AND is_active = true`,
          [entry.item_code]
        );
        if (itemRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return reply.status(400).send({
            error: 'Bad Request',
            message: `품목코드 '${entry.item_code}'을(를) 찾을 수 없습니다.`,
          });
        }

        const item = itemRes.rows[0];
        const r = await client.query(
          `INSERT INTO inventory_transaction
            (item_id, txn_type, txn_date, qty, purpose, ref_lot_number, worker)
           VALUES ($1, 'IN', $2, $3, $4, $5, $6)
           RETURNING *`,
          [item.item_id, today, entry.qty,
           entry.note || '초기재고 설정', lotNumber, 'SYSTEM']
        );
        created.push({ ...r.rows[0], item_code: item.item_code, item_name: item.item_name });
      }

      await client.query('COMMIT');

      return {
        data: {
          lot_number: lotNumber,
          items_initialized: created.length,
          transactions: created,
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ──────────────────────────────────────────────
  // GET /api/inventory/current-stock — 전 품목 현재 재고 잔량
  // ──────────────────────────────────────────────
  app.get('/api/inventory/current-stock', async (request) => {
    const { category } = request.query as { category?: string };

    let query = `
      SELECT
        i.item_id, i.item_code, i.item_name, i.item_category, i.unit, i.safety_stock,
        COALESCE(SUM(CASE WHEN it.txn_type = 'IN' THEN it.qty ELSE 0 END), 0) as total_in,
        COALESCE(SUM(CASE WHEN it.txn_type = 'OUT' THEN it.qty ELSE 0 END), 0) as total_out,
        COALESCE(SUM(CASE WHEN it.txn_type = 'IN' THEN it.qty
                          WHEN it.txn_type = 'OUT' THEN -it.qty
                          WHEN it.txn_type = 'LOSS' THEN -it.qty
                          ELSE it.qty END), 0) as balance
      FROM item_master i
      LEFT JOIN inventory_transaction it ON it.item_id = i.item_id
      WHERE i.is_active = true
    `;
    const params: unknown[] = [];

    if (category) {
      params.push(category);
      query += ` AND i.item_category = $${params.length}`;
    }

    query += ` GROUP BY i.item_id, i.item_code, i.item_name, i.item_category, i.unit, i.safety_stock
               HAVING COALESCE(SUM(CASE WHEN it.txn_type = 'IN' THEN it.qty
                                        WHEN it.txn_type = 'OUT' THEN -it.qty
                                        WHEN it.txn_type = 'LOSS' THEN -it.qty
                                        ELSE it.qty END), 0) != 0
               ORDER BY i.item_category, i.item_code`;

    const result = await pool.query(query, params);
    const rows = result.rows.map((r: any) => ({
      ...r,
      total_in: parseFloat(r.total_in),
      total_out: parseFloat(r.total_out),
      balance: parseFloat(r.balance),
      is_below_safety: parseFloat(r.balance) < parseFloat(r.safety_stock || '0'),
    }));
    return { data: rows, total: rows.length };
  });

  // GET /api/inventory/available-lots-by-item/:itemId - 특정 품목의 가용 LOT 목록 (FIFO)
  app.get('/api/inventory/available-lots-by-item/:itemId', async (request) => {
    const { itemId } = request.params as { itemId: string };

    const query = `
      SELECT * FROM (
        SELECT
          lt.lot_id, lt.lot_number, lt.item_id,
          i.item_code, i.item_name, i.item_category, i.unit,
          COALESCE(
            (SELECT SUM(CASE WHEN it.txn_type = 'IN' THEN it.qty
                             WHEN it.txn_type = 'OUT' THEN -it.qty
                             ELSE it.qty END)
             FROM inventory_transaction it WHERE it.lot_id = lt.lot_id), 0
          ) as balance,
          lt.supplier_lot, lt.inspection_lot, lt.created_at
        FROM lot_transaction lt
        JOIN item_master i ON i.item_id = lt.item_id
        WHERE lt.status = 'ACTIVE'
          AND lt.item_id = $1
      ) sub WHERE sub.balance > 0
      ORDER BY sub.created_at ASC
    `;

    const result = await pool.query(query, [parseInt(itemId, 10)]);
    return { data: result.rows, total: result.rows.length };
  });

  // GET /api/inventory/google-sheet-proxy - 구글 시트 CORS 우회용 프록시
  app.get('/api/inventory/google-sheet-proxy', async (request, reply) => {
    const { url } = request.query as { url?: string };
    if (!url) {
      return reply.status(400).send({ error: 'url_required', message: 'Google Sheet URL이 필요합니다.' });
    }
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      return reply.status(400).send({ error: 'invalid_url', message: '올바른 Google Sheet URL이 아닙니다.' });
    }
    const id = match[1];
    const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
    
    try {
      const res = await fetch(exportUrl);
      if (!res.ok) {
        throw new Error(`Google Sheets export failed: ${res.statusText}`);
      }
      const buffer = await res.arrayBuffer();
      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="sheet_${id}.xlsx"`)
        .send(Buffer.from(buffer));
    } catch (err: any) {
      app.log.error(err);
      return reply.status(500).send({ error: 'proxy_failed', message: err.message || '구글 시트 연동에 실패했습니다.' });
    }
  });

  // POST /api/inventory/import-excel - E-Count ERP 수불대장 일괄 연동 API
  app.post('/api/inventory/import-excel', async (request, reply) => {
    const { importType, records } = request.body as {
      importType: 'assembly_log' | 'finished_ledger';
      records: Array<{
        txn_date: string;
        item_code: string;
        txn_type: 'IN' | 'OUT';
        qty: number;
        lot_number?: string;
        source_lot?: string;
        linked_lot?: string;
        purpose?: string;
        issuer_name?: string;
        verifier_name?: string;
        remarks?: string;
      }>;
    };

    if (!records || !Array.isArray(records)) {
      return reply.status(400).send({ error: 'bad_request', message: 'records 배열이 필요합니다.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let insertedCount = 0;

      for (const rec of records) {
        // 1. 품목 ID 조회
        const itemRes = await client.query(
          `SELECT item_id, unit FROM item_master WHERE item_code = $1 AND is_active = TRUE`,
          [rec.item_code.trim()]
        );
        const item = itemRes.rows[0];
        if (!item) {
          throw new Error(`존재하지 않거나 비활성화된 품목 코드입니다: ${rec.item_code}`);
        }

        // 2. LOT ID 조회 또는 자동 생성
        let lotId: number | null = null;
        if (rec.lot_number && rec.lot_number.trim() !== '') {
          const lotNum = rec.lot_number.trim();
          const lotRes = await client.query(
            `SELECT lot_id FROM lot_transaction WHERE lot_number = $1`,
            [lotNum]
          );
          if (lotRes.rows[0]) {
            lotId = lotRes.rows[0].lot_id;
          } else {
            // LOT 자동 생성 (조립 수불대장은 ASM, 완제품은 OUT/IN 자동 판별)
            const lotType = importType === 'assembly_log' ? 'ASM' : (rec.txn_type === 'OUT' ? 'OUT' : 'IN');
            const newLotRes = await client.query(
              `INSERT INTO lot_transaction (lot_number, lot_type, item_id, qty, unit, remaining_qty, status)
               VALUES ($1, $2, $3, $4, $5, $4, 'ACTIVE')
               RETURNING lot_id`,
              [lotNum, lotType, item.item_id, rec.qty, item.unit]
            );
            lotId = newLotRes.rows[0].lot_id;
          }
        }

        // 3. 수불 거래 내역 추가
        await client.query(
          `INSERT INTO inventory_transaction (
             item_id, lot_id, txn_type, txn_date, qty, purpose,
             source_lot, linked_lot, issuer_name, verifier_name
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            item.item_id,
            lotId,
            rec.txn_type,
            rec.txn_date,
            rec.qty,
            rec.purpose || null,
            rec.source_lot || null,
            rec.linked_lot || null,
            rec.issuer_name || null,
            rec.verifier_name || null
          ]
        );

        insertedCount++;
      }

      await client.query('COMMIT');
      return { success: true, count: insertedCount };
    } catch (err: any) {
      await client.query('ROLLBACK');
      app.log.error(err);
      return reply.status(500).send({
        error: 'db_transaction_failed',
        message: err.message || '데이터베이스 반영에 실패했습니다.'
      });
    } finally {
      client.release();
    }
  });
}
