import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';
import { expandAndSortSocketItems } from '../lib/socket-sort.js';

// ── C302 5.1 기준: 소켓 인수검사 LOT 번호 생성 ──────────────────────────
// 형식: YYMMDD + GI + 순번(3자리)   예) 260615GI001
async function generateInspLotNo(): Promise<string> {
  const today = new Date();
  const yy = String(today.getFullYear()).slice(2);
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const prefix = `${yy}${mm}${dd}GI`;

  const { rows } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM socket_incoming_inspection
     WHERE insp_lot_no LIKE $1`,
    [`${prefix}%`]
  );
  const seq = parseInt(rows[0].cnt, 10) + 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}


export async function socketIncomingRoutes(app: FastifyInstance) {

  // ─────────────────────────────────────────────────────────────────
  // POST /api/socket-orders/:id/start-inspection
  // 발주서 items_json → 1EA씩 분리, 정렬 후 인수검사 레코드 생성
  // ─────────────────────────────────────────────────────────────────
  app.post('/api/socket-orders/:id/start-inspection', { preHandler: requireAuth }, async (req, reply) => {
    const soId = parseInt((req.params as any).id);

    const soRes = await pool.query(
      `SELECT so.*
       FROM socket_order so
       WHERE so.so_id = $1`,
      [soId]
    );
    if (!soRes.rows[0]) return reply.code(404).send({ error: 'not_found' });
    const so = soRes.rows[0];

    if (so.status !== 'ORDERED' && so.status !== 'APPROVED' && so.status !== 'RECEIVED') {
      return reply.code(400).send({ error: '발주(ORDERED) 또는 입고완료(RECEIVED) 상태여야 인수검사를 시작할 수 있습니다.' });
    }

    // 이미 생성된 경우 확인
    const existing = await pool.query(
      `SELECT COUNT(*) AS cnt FROM socket_incoming_inspection WHERE so_id = $1`,
      [soId]
    );
    if (parseInt(existing.rows[0].cnt, 10) > 0) {
      return reply.code(400).send({ error: '이미 인수검사 목록이 생성되어 있습니다.' });
    }

    const items: any[] = so.items_json || [];
    if (items.length === 0) return reply.code(400).send({ error: '발주 명세가 없습니다.' });

    // ── 공유 유틸: qty 1개씩 분리 + 정렬 (차수↑ > 구조체표5순서 > 가로↑ > 세로↑)
    const expanded = expandAndSortSocketItems(items);

    // ── DB 삽입 ─────────────────────────────────────────────────
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (let i = 0; i < expanded.length; i++) {
        const item = expanded[i];
        const seqNo = i + 1;
        const constructionSeq = parseInt(String(item.construction_seq ?? 1)) || 1;

        await client.query(
          `INSERT INTO socket_incoming_inspection
             (so_id, seq_no, construction_seq, item_seq,
              product_type, pipe_width_mm, pipe_height_mm,
              width_mm, height_mm, depth_mm)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            soId, seqNo, constructionSeq, item.item_seq,
            item.product_type || null,
            item.pipe_width_mm || null,
            item.pipe_height_mm || null,
            item.width_mm || item.pipe_width_mm || null,
            item.height_mm || item.pipe_height_mm || null,
            item.depth_mm || null,
          ]
        );
      }

      // 발주서 상태를 INSPECTING으로 변경
      await client.query(
        `UPDATE socket_order SET status = 'INSPECTING' WHERE so_id = $1`,
        [soId]
      );

      await client.query('COMMIT');
      return { data: { success: true, count: expanded.length } };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // GET /api/socket-orders/:id/inspections
  // 인수검사 목록 조회 (seq_no 순)
  // ─────────────────────────────────────────────────────────────────
  app.get('/api/socket-orders/:id/inspections', { preHandler: requireAuth }, async (req, reply) => {
    const soId = parseInt((req.params as any).id);

    try {
      const soRes = await pool.query(
        `SELECT so.*, pm.project_name
         FROM socket_order so
         LEFT JOIN project_master pm ON pm.project_id = so.project_id
         WHERE so.so_id = $1`,
        [soId]
      );
      if (!soRes.rows[0]) return reply.code(404).send({ error: 'not_found' });

      const items = await pool.query(
        `SELECT sii.*, w.worker_name AS inspected_by_name, w2.worker_name AS inspected_by_2_name
         FROM socket_incoming_inspection sii
         LEFT JOIN worker w ON w.worker_id = sii.inspected_by
         LEFT JOIN worker w2 ON w2.worker_id = sii.inspected_by_2
         WHERE sii.so_id = $1
         ORDER BY sii.seq_no`,
        [soId]
      );

      return {
        data: {
          so: soRes.rows[0],
          items: items.rows,
          summary: {
            total: items.rows.length,
            passed: items.rows.filter(r => r.insp_result === 'PASS').length,
            failed: items.rows.filter(r => r.insp_result === 'FAIL').length,
            pending: items.rows.filter(r => r.insp_result === 'PENDING').length,
            lotAssigned: items.rows.filter(r => r.insp_lot_no).length,
          }
        }
      };
    } catch (e: any) {
      console.error('[inspections-get-error]', e);
      return reply.code(500).send({ error: 'db_error', message: e.message });
    }
  });


  // ─────────────────────────────────────────────────────────────────
  // POST /api/socket-orders/:id/assign-lots-bulk
  // C302 5.1 기준 LOT 일괄 부여 (미부여 항목에만)
  // ─────────────────────────────────────────────────────────────────
  app.post('/api/socket-orders/:id/assign-lots-bulk', { preHandler: requireAuth }, async (req, reply) => {
    const soId = parseInt((req.params as any).id);
    const { worker_id } = req.body as any;

    const items = await pool.query(
      `SELECT sii_id FROM socket_incoming_inspection
       WHERE so_id = $1 AND (insp_lot_no IS NULL OR insp_lot_no = '')
       ORDER BY seq_no`,
      [soId]
    );

    if (items.rows.length === 0) {
      return { data: { success: true, count: 0, message: '부여할 LOT가 없습니다.' } };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let count = 0;
      for (const row of items.rows) {
        const lotNo = await generateInspLotNo();
        await client.query(
          `UPDATE socket_incoming_inspection
           SET insp_lot_no = $1
           WHERE sii_id = $2`,
          [lotNo, row.sii_id]
        );
        count++;
      }
      await client.query('COMMIT');
      return { data: { success: true, count } };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // PATCH /api/socket-incoming/:sii_id
  // 개별 검사결과 + LOT 수동 수정
  // ─────────────────────────────────────────────────────────────────
  app.patch('/api/socket-incoming/:sii_id', { preHandler: requireAuth }, async (req, reply) => {
    const siiId = parseInt((req.params as any).sii_id);
    const { 
      insp_result, insp_note, insp_lot_no, worker_id,
      insp_result_2, insp_note_2
    } = req.body as any;

    const existing = await pool.query(
      `SELECT * FROM socket_incoming_inspection WHERE sii_id = $1`,
      [siiId]
    );
    if (!existing.rows[0]) return reply.code(404).send({ error: 'not_found' });

    const updates: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    if (insp_result !== undefined) { updates.push(`insp_result = $${idx++}`); vals.push(insp_result); }
    if (insp_note !== undefined)   { updates.push(`insp_note = $${idx++}`);   vals.push(insp_note); }
    if (insp_lot_no !== undefined) { updates.push(`insp_lot_no = $${idx++}`); vals.push(insp_lot_no); }

    if (insp_result === 'PASS' || insp_result === 'FAIL') {
      updates.push(`inspected_by = $${idx++}`);   vals.push(worker_id || null);
      updates.push(`inspected_at = NOW()`);
    }

    // 2차 검사 결과 반영
    if (insp_result_2 !== undefined) { updates.push(`insp_result_2 = $${idx++}`); vals.push(insp_result_2); }
    if (insp_note_2 !== undefined)   { updates.push(`insp_note_2 = $${idx++}`);   vals.push(insp_note_2); }
    if (insp_result_2 === 'PASS' || insp_result_2 === 'FAIL') {
      updates.push(`inspected_by_2 = $${idx++}`); vals.push(worker_id || null);
      updates.push(`inspected_at_2 = NOW()`);
    }

    if (updates.length === 0) return reply.code(400).send({ error: '변경할 내용이 없습니다.' });

    vals.push(siiId);
    await pool.query(
      `UPDATE socket_incoming_inspection SET ${updates.join(', ')} WHERE sii_id = $${idx}`,
      vals
    );

    const updated = await pool.query(
      `SELECT * FROM socket_incoming_inspection WHERE sii_id = $1`, [siiId]
    );
    return { data: updated.rows[0] };
  });

  // ─────────────────────────────────────────────────────────────────
  // GET /api/socket-incoming/:sii_id/label
  // 라벨 출력용 데이터
  // ─────────────────────────────────────────────────────────────────
  app.get('/api/socket-incoming/:sii_id/label', { preHandler: requireAuth }, async (req, reply) => {
    const siiId = parseInt((req.params as any).sii_id);

    const res = await pool.query(
      `SELECT sii.*, so.project_name, pm.project_name AS pm_project_name,
              w.worker_name AS inspected_by_name
       FROM socket_incoming_inspection sii
       JOIN socket_order so ON so.so_id = sii.so_id
       LEFT JOIN project_master pm ON pm.project_id = so.project_id
       LEFT JOIN worker w ON w.worker_id = sii.inspected_by
       WHERE sii.sii_id = $1`,
      [siiId]
    );

    if (!res.rows[0]) return reply.code(404).send({ error: 'not_found' });

    const row = res.rows[0];
    return {
      data: {
        lot_no: row.insp_lot_no,
        product_type: row.product_type,
        pipe_width_mm: row.pipe_width_mm,
        pipe_height_mm: row.pipe_height_mm,
        project_name: row.pm_project_name || row.project_name,
        insp_result: row.insp_result,
        inspected_by_name: row.inspected_by_name,
        inspected_at: row.inspected_at,
        seq_no: row.seq_no,
      }
    };
  });

  // ─────────────────────────────────────────────────────────────────
  // GET /api/socket-orders/:id/labels-all
  // 전체 라벨 일괄 출력용
  // ─────────────────────────────────────────────────────────────────
  app.get('/api/socket-orders/:id/labels-all', { preHandler: requireAuth }, async (req, reply) => {
    const soId = parseInt((req.params as any).id);
    const { result } = req.query as any; // 'PASS' | 'all'

    let whereResult = '';
    const vals: any[] = [soId];
    if (result === 'PASS') {
      whereResult = `AND sii.insp_result = 'PASS'`;
    }

    const soRes = await pool.query(
      `SELECT so.*, pm.project_name AS pm_project_name
       FROM socket_order so
       LEFT JOIN project_master pm ON pm.project_id = so.project_id
       WHERE so.so_id = $1`, [soId]
    );

    const items = await pool.query(
      `SELECT sii.*, w.worker_name AS inspected_by_name
       FROM socket_incoming_inspection sii
       LEFT JOIN worker w ON w.worker_id = sii.inspected_by
       WHERE sii.so_id = $1 ${whereResult}
         AND sii.insp_lot_no IS NOT NULL
       ORDER BY sii.seq_no`,
      vals
    );


    const so = soRes.rows[0];
    return {
      data: {
        project_name: so?.pm_project_name || so?.project_name,
        items: items.rows.map(r => ({
          sii_id: r.sii_id,
          seq_no: r.seq_no,
          lot_no: r.insp_lot_no,
          product_type: r.product_type,
          pipe_width_mm: r.pipe_width_mm,
          pipe_height_mm: r.pipe_height_mm,
          insp_result: r.insp_result,
          inspected_by_name: r.inspected_by_name,
          inspected_at: r.inspected_at,
        }))
      }
    };
  });

  // ─────────────────────────────────────────────────────────────────
  // POST /api/socket-orders/:id/complete-receive
  // 합격품 → socket_stock 반영 + status: RECEIVED
  // (기존 /receive 대체)
  // ─────────────────────────────────────────────────────────────────
  app.post('/api/socket-orders/:id/complete-receive', { preHandler: requireAuth }, async (req, reply) => {
    const soId = parseInt((req.params as any).id);
    const { worker_id } = req.body as any;

    const soRes = await pool.query(
      `SELECT so.*, pm.project_id AS proj_id
       FROM socket_order so
       LEFT JOIN purchase_order po ON po.po_id = so.po_id
       LEFT JOIN project_master pm ON pm.project_id = so.project_id
       WHERE so.so_id = $1`, [soId]
    );
    if (!soRes.rows[0]) return reply.code(404).send({ error: 'not_found' });
    const so = soRes.rows[0];

    if (so.status === 'RECEIVED') return reply.code(400).send({ error: '이미 입고 처리된 발주서입니다.' });

    // 합격 항목 조회 (1차 혹은 2차 합격 건 합산)
    const passedItems = await pool.query(
      `SELECT * FROM socket_incoming_inspection
       WHERE so_id = $1 AND (insp_result = 'PASS' OR insp_result_2 = 'PASS')`,
      [soId]
    );

    if (passedItems.rows.length === 0) {
      return reply.code(400).send({ error: '합격 처리된 항목이 없습니다. 인수검사를 먼저 완료해 주세요.' });
    }

    const projectId = so.project_id || so.proj_id;

    // 규격별로 합산
    const stockMap = new Map<string, { product_type: string; width_mm: number; height_mm: number; depth_mm: number; qty: number }>();
    for (const row of passedItems.rows) {
      const key = `${row.product_type}|${row.width_mm}|${row.height_mm}|${row.depth_mm}`;
      if (!stockMap.has(key)) {
        stockMap.set(key, {
          product_type: row.product_type,
          width_mm: row.width_mm,
          height_mm: row.height_mm,
          depth_mm: row.depth_mm || 200,
          qty: 0,
        });
      }
      stockMap.get(key)!.qty += 1;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const stock of stockMap.values()) {
        const sockRes = await client.query(
          `INSERT INTO socket_stock (project_id, product_type, width_mm, height_mm, depth_mm, qty)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (project_id, product_type, width_mm, height_mm, depth_mm)
           DO UPDATE SET qty = socket_stock.qty + $6, updated_at = NOW()
           RETURNING stock_id`,
          [projectId, stock.product_type, stock.width_mm, stock.height_mm, stock.depth_mm, stock.qty]
        );

        await client.query(
          `INSERT INTO stock_transaction
             (stock_type, stock_id, project_id, tx_type, qty, source_type, source_id, memo, created_by)
           VALUES ('SOCKET', $1, $2, 'IN', $3, 'SOCKET_ORDER_INSP', $4, $5, $6)`,
          [
            sockRes.rows[0].stock_id, projectId, stock.qty, soId,
            `소켓 인수검사 입고 (${so.project_name || ''})`,
            worker_id || null,
          ]
        );
      }

      // 발주서 상태 업데이트 (검사완료 INSPECTED 상태로 변경)
      await client.query(
        `UPDATE socket_order
         SET status='INSPECTED', received_at=NOW(), received_by=$1
         WHERE so_id=$2`,
        [worker_id || null, soId]
      );

      await client.query('COMMIT');

      return {
        data: {
          success: true,
          passed_count: passedItems.rows.length,
          failed_count: (await pool.query(
            `SELECT COUNT(*) AS cnt FROM socket_incoming_inspection WHERE so_id=$1 AND insp_result='FAIL'`,
            [soId]
          )).rows[0].cnt,
        }
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // PATCH /api/socket-orders/:id/inspection-approvers
  // 인수검사 결재라인 (담당자, 검토자, 승인자) 업데이트
  // ─────────────────────────────────────────────────────────────────
  app.patch('/api/socket-orders/:id/inspection-approvers', { preHandler: requireAuth }, async (req, reply) => {
    const soId = parseInt((req.params as any).id);
    const { insp_worker_id, insp_reviewer_id, insp_approver_id } = req.body as any;

    const res = await pool.query(
      `UPDATE socket_order 
       SET insp_worker_id = $1, insp_reviewer_id = $2, insp_approver_id = $3, updated_at = NOW()
       WHERE so_id = $4
       RETURNING so_id, insp_worker_id, insp_reviewer_id, insp_approver_id`,
      [
        insp_worker_id ? Number(insp_worker_id) : null,
        insp_reviewer_id ? Number(insp_reviewer_id) : null,
        insp_approver_id ? Number(insp_approver_id) : null,
        soId
      ]
    );
    if (!res.rows[0]) return reply.code(404).send({ error: 'not_found' });
    return { data: res.rows[0] };
  });

}
