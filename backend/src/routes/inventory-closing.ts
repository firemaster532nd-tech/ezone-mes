import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

/**
 * 월말 재고 실사 / 마감 시스템
 *
 * 워크플로우:
 * 1. 월마감 생성 (매월 말 마지막 생산일 기준)
 * 2. 시스템 재고 스냅샷 자동 생성 (전 품목 + LOT별)
 * 3. 실물 재고 실사 기록 (실사자가 실물 카운트 입력)
 * 4. 차이 분석 → 조정 필요 항목 식별
 * 5. 조정 요청 → 파트장 승인 → 재고 반영
 *
 * 관리 권한:
 * - 이동민 파트장: 원재료(RM) + 압출 관련(EXT 공정 재고)
 * - 임병용 파트장: 재단(CUT), 부자재(SM), 소켓(ASM), 완제품(FP)
 */

async function migrateInventoryClosing() {
  // 월마감 헤더
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_closing (
      closing_id    SERIAL PRIMARY KEY,
      closing_year  INT NOT NULL,
      closing_month INT NOT NULL,
      closing_date  DATE NOT NULL,          -- 실제 마감일 (마지막 생산일)
      status        VARCHAR(20) DEFAULT 'draft',  -- draft, counting, review, approved, finalized
      created_by    VARCHAR(100),           -- 생성자
      created_at    TIMESTAMPTZ DEFAULT now(),
      finalized_at  TIMESTAMPTZ,
      notes         TEXT,
      UNIQUE(closing_year, closing_month)
    );
  `);

  // 마감 품목별 실사 내역 (LOT 단위)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS closing_item (
      ci_id            SERIAL PRIMARY KEY,
      closing_id       INT NOT NULL REFERENCES inventory_closing(closing_id),
      item_id          INT NOT NULL,
      lot_id           INT,                    -- LOT별 실사 (NULL이면 품목 총량)
      lot_number       VARCHAR(100),
      item_category    VARCHAR(10),            -- RM, SM, SA, FP
      process_zone     VARCHAR(20),            -- 관리 영역: RM_EXT (이동민), CUT_SM_FP (임병용)
      system_qty       NUMERIC(12,2) DEFAULT 0, -- 시스템 재고 (스냅샷)
      physical_qty     NUMERIC(12,2),          -- 실물 재고 (실사 입력)
      difference       NUMERIC(12,2),          -- physical - system
      diff_rate        NUMERIC(8,4),           -- 차이율 %
      unit             VARCHAR(20),
      count_status     VARCHAR(20) DEFAULT 'pending', -- pending, counted, verified
      counted_by       VARCHAR(100),           -- 실사자
      counted_at       TIMESTAMPTZ,
      verified_by      VARCHAR(100),           -- 검증자
      verified_at      TIMESTAMPTZ,
      note             TEXT,                   -- 차이 사유
      created_at       TIMESTAMPTZ DEFAULT now()
    );
  `);

  // 재고 조정 기록 (파트장 승인 필요)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS closing_adjustment (
      adj_id         SERIAL PRIMARY KEY,
      closing_id     INT NOT NULL REFERENCES inventory_closing(closing_id),
      ci_id          INT REFERENCES closing_item(ci_id),
      item_id        INT NOT NULL,
      lot_id         INT,
      lot_number     VARCHAR(100),
      adj_type       VARCHAR(20) NOT NULL,     -- INCREASE, DECREASE, WRITE_OFF
      adj_qty        NUMERIC(12,2) NOT NULL,
      reason         TEXT NOT NULL,
      process_zone   VARCHAR(20),              -- 관리 영역
      approver_name  VARCHAR(100),             -- 승인권자 (이동민/임병용)
      status         VARCHAR(20) DEFAULT 'pending',  -- pending, approved, rejected, applied
      requested_by   VARCHAR(100),
      requested_at   TIMESTAMPTZ DEFAULT now(),
      approved_at    TIMESTAMPTZ,
      applied_at     TIMESTAMPTZ,              -- 재고 반영 시점
      inv_id         INT,                      -- 반영된 inventory_transaction ID
      note           TEXT
    );
  `);

  // purpose 컬럼 확장 (기존 VARCHAR(50) → TEXT)
  await pool.query(`ALTER TABLE inventory_transaction ALTER COLUMN purpose TYPE TEXT;`).catch(() => {});

  // 인덱스
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_closing_item_closing ON closing_item(closing_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_closing_item_item ON closing_item(item_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_closing_adj_closing ON closing_adjustment(closing_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_closing_adj_status ON closing_adjustment(status);`);
}

/** 관리 영역 결정: 이동민 vs 임병용 */
function getProcessZone(category: string, processCode?: string): string {
  // 이동민 파트장: 원재료(RM) + 압출 재고
  if (category === 'RM') return 'RM_EXT';
  if (processCode === 'EXT' || processCode === 'MIX') return 'RM_EXT';
  // 임병용 파트장: 재단, 부자재, 반제품, 완제품
  return 'CUT_SM_FP';
}

/** 관리 영역별 승인권자 */
function getApprover(zone: string): string {
  return zone === 'RM_EXT' ? '이동민' : '임병용';
}

export async function inventoryClosingRoutes(app: FastifyInstance) {
  // await migrateInventoryClosing();

  // ──────────────────────────────────────────────
  // GET /api/inventory-closing - 월마감 목록
  // ──────────────────────────────────────────────
  app.get('/api/inventory-closing', async (request) => {
    const { year } = request.query as { year?: string };

    let query = `
      SELECT ic.*,
        (SELECT COUNT(*) FROM closing_item ci WHERE ci.closing_id = ic.closing_id) as total_items,
        (SELECT COUNT(*) FROM closing_item ci WHERE ci.closing_id = ic.closing_id AND ci.count_status = 'counted') as counted_items,
        (SELECT COUNT(*) FROM closing_item ci WHERE ci.closing_id = ic.closing_id AND ci.difference != 0 AND ci.difference IS NOT NULL) as diff_items,
        (SELECT COUNT(*) FROM closing_adjustment ca WHERE ca.closing_id = ic.closing_id AND ca.status = 'pending') as pending_adjustments
      FROM inventory_closing ic
    `;
    const params: unknown[] = [];

    if (year) {
      params.push(parseInt(year, 10));
      query += ` WHERE ic.closing_year = $${params.length}`;
    }
    query += ' ORDER BY ic.closing_year DESC, ic.closing_month DESC';

    const result = await pool.query(query, params);
    return { data: result.rows };
  });

  // ──────────────────────────────────────────────
  // POST /api/inventory-closing - 월마감 생성 + 스냅샷
  // ──────────────────────────────────────────────
  app.post('/api/inventory-closing', async (request, reply) => {
    const body = request.body as {
      closing_year: number;
      closing_month: number;
      closing_date: string;  // YYYY-MM-DD (마지막 생산일)
      created_by?: string;
      notes?: string;
    };

    if (!body.closing_year || !body.closing_month || !body.closing_date) {
      return reply.status(400).send({ error: 'closing_year, closing_month, closing_date 필수' });
    }

    // 중복 체크
    const existing = await pool.query(
      `SELECT closing_id FROM inventory_closing WHERE closing_year = $1 AND closing_month = $2`,
      [body.closing_year, body.closing_month]
    );
    if (existing.rows.length > 0) {
      return reply.status(400).send({
        error: `${body.closing_year}년 ${body.closing_month}월 마감이 이미 존재합니다.`,
        closing_id: existing.rows[0].closing_id
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. 마감 헤더 생성
      const closingResult = await client.query(
        `INSERT INTO inventory_closing (closing_year, closing_month, closing_date, status, created_by, notes)
         VALUES ($1, $2, $3, 'counting', $4, $5)
         RETURNING *`,
        [body.closing_year, body.closing_month, body.closing_date, body.created_by || null, body.notes || null]
      );
      const closing = closingResult.rows[0];

      // 2. 시스템 재고 스냅샷 생성 (LOT별)
      const lotsSnap = await client.query(`
        SELECT
          lt.lot_id, lt.lot_number, lt.item_id,
          i.item_code, i.item_name, i.item_category, i.unit,
          COALESCE(
            (SELECT SUM(CASE WHEN it.txn_type = 'IN' THEN it.qty
                             WHEN it.txn_type = 'OUT' THEN -it.qty
                             ELSE it.qty END)
             FROM inventory_transaction it
             WHERE it.lot_id = lt.lot_id
               AND it.txn_date <= $1), 0
          ) as balance
        FROM lot_transaction lt
        JOIN item_master i ON i.item_id = lt.item_id
        WHERE lt.status = 'ACTIVE'
        ORDER BY i.item_category, i.item_code, lt.created_at
      `, [body.closing_date]);

      let insertCount = 0;
      for (const lot of lotsSnap.rows) {
        const balance = parseFloat(lot.balance);
        if (balance === 0) continue; // 잔량 0인 LOT 제외

        const zone = getProcessZone(lot.item_category);
        await client.query(
          `INSERT INTO closing_item
            (closing_id, item_id, lot_id, lot_number, item_category, process_zone, system_qty, unit)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [closing.closing_id, lot.item_id, lot.lot_id, lot.lot_number,
           lot.item_category, zone, balance, lot.unit]
        );
        insertCount++;
      }

      // 3. LOT 없는 품목도 포함 (수불 합계 기준)
      const itemSnap = await client.query(`
        SELECT
          i.item_id, i.item_code, i.item_name, i.item_category, i.unit,
          COALESCE(SUM(CASE WHEN it.txn_type = 'IN' THEN it.qty
                            WHEN it.txn_type = 'OUT' THEN -it.qty
                            ELSE it.qty END), 0) as balance,
          COUNT(DISTINCT CASE WHEN lt.status = 'ACTIVE' THEN lt.lot_id END) as lot_count
        FROM item_master i
        LEFT JOIN inventory_transaction it ON it.item_id = i.item_id AND it.txn_date <= $1
        LEFT JOIN lot_transaction lt ON lt.item_id = i.item_id AND lt.status = 'ACTIVE'
        WHERE i.is_active = true
        GROUP BY i.item_id, i.item_code, i.item_name, i.item_category, i.unit
        HAVING COALESCE(SUM(CASE WHEN it.txn_type = 'IN' THEN it.qty
                                  WHEN it.txn_type = 'OUT' THEN -it.qty
                                  ELSE it.qty END), 0) != 0
           AND COUNT(DISTINCT CASE WHEN lt.status = 'ACTIVE' THEN lt.lot_id END) = 0
      `, [body.closing_date]);

      for (const item of itemSnap.rows) {
        const zone = getProcessZone(item.item_category);
        await client.query(
          `INSERT INTO closing_item
            (closing_id, item_id, lot_id, lot_number, item_category, process_zone, system_qty, unit)
           VALUES ($1, $2, NULL, NULL, $3, $4, $5, $6)`,
          [closing.closing_id, item.item_id, item.item_category, zone, parseFloat(item.balance), item.unit]
        );
        insertCount++;
      }

      await client.query('COMMIT');

      return {
        data: {
          ...closing,
          snapshot_items: insertCount,
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
  // DELETE /api/inventory-closing/:id - 월마감 삭제 (draft/counting 상태만)
  // ──────────────────────────────────────────────
  app.delete('/api/inventory-closing/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const closingId = parseInt(id, 10);

    const closing = await pool.query(
      `SELECT status FROM inventory_closing WHERE closing_id = $1`, [closingId]
    );
    if (closing.rows.length === 0) return reply.status(404).send({ error: 'Not Found' });
    if (!['draft', 'counting'].includes(closing.rows[0].status)) {
      return reply.status(400).send({ error: '검토 이후 상태의 마감은 삭제할 수 없습니다.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM closing_adjustment WHERE closing_id = $1', [closingId]);
      await client.query('DELETE FROM closing_item WHERE closing_id = $1', [closingId]);
      await client.query('DELETE FROM inventory_closing WHERE closing_id = $1', [closingId]);
      await client.query('COMMIT');
      return { data: { success: true } };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ──────────────────────────────────────────────
  // GET /api/inventory-closing/:id - 월마감 상세
  // ──────────────────────────────────────────────
  app.get('/api/inventory-closing/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const closing = await pool.query(
      `SELECT * FROM inventory_closing WHERE closing_id = $1`, [parseInt(id, 10)]
    );
    if (closing.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    return { data: closing.rows[0] };
  });

  // ──────────────────────────────────────────────
  // GET /api/inventory-closing/:id/items - 실사 품목 목록
  // ──────────────────────────────────────────────
  app.get('/api/inventory-closing/:id/items', async (request) => {
    const { id } = request.params as { id: string };
    const { zone, category, status: countStatus, diff_only } = request.query as {
      zone?: string;
      category?: string;
      status?: string;
      diff_only?: string;
    };

    let query = `
      SELECT ci.*,
        i.item_code, i.item_name, i.unit as item_unit
      FROM closing_item ci
      JOIN item_master i ON i.item_id = ci.item_id
      WHERE ci.closing_id = $1
    `;
    const params: unknown[] = [parseInt(id, 10)];

    if (zone) {
      params.push(zone);
      query += ` AND ci.process_zone = $${params.length}`;
    }
    if (category) {
      params.push(category);
      query += ` AND ci.item_category = $${params.length}`;
    }
    if (countStatus) {
      params.push(countStatus);
      query += ` AND ci.count_status = $${params.length}`;
    }
    if (diff_only === 'true') {
      query += ` AND ci.difference != 0 AND ci.difference IS NOT NULL`;
    }

    query += ` ORDER BY ci.item_category, i.item_code, ci.lot_number`;

    const result = await pool.query(query, params);

    // 요약 통계
    const summary = await pool.query(`
      SELECT
        COUNT(*) as total_items,
        COUNT(CASE WHEN count_status = 'counted' THEN 1 END) as counted,
        COUNT(CASE WHEN count_status = 'verified' THEN 1 END) as verified,
        COUNT(CASE WHEN count_status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN difference != 0 AND difference IS NOT NULL THEN 1 END) as with_diff,
        COALESCE(SUM(CASE WHEN difference IS NOT NULL THEN ABS(difference) ELSE 0 END), 0) as total_abs_diff,
        COUNT(CASE WHEN process_zone = 'RM_EXT' THEN 1 END) as zone_rm_ext,
        COUNT(CASE WHEN process_zone = 'CUT_SM_FP' THEN 1 END) as zone_cut_sm_fp,
        COUNT(CASE WHEN process_zone = 'RM_EXT' AND count_status = 'counted' THEN 1 END) as zone_rm_ext_counted,
        COUNT(CASE WHEN process_zone = 'CUT_SM_FP' AND count_status = 'counted' THEN 1 END) as zone_cut_sm_fp_counted
      FROM closing_item
      WHERE closing_id = $1
    `, [parseInt(id, 10)]);

    return {
      data: result.rows,
      total: result.rows.length,
      summary: summary.rows[0],
    };
  });

  // ──────────────────────────────────────────────
  // PATCH /api/inventory-closing/:closingId/items/:ciId - 실사 기록 입력
  // ──────────────────────────────────────────────
  app.patch('/api/inventory-closing/:closingId/items/:ciId', async (request, reply) => {
    const { closingId, ciId } = request.params as { closingId: string; ciId: string };
    const body = request.body as {
      physical_qty?: number;
      counted_by?: string;
      note?: string;
    };

    // 마감 상태 확인
    const closing = await pool.query(
      `SELECT status FROM inventory_closing WHERE closing_id = $1`, [parseInt(closingId, 10)]
    );
    if (closing.rows.length === 0) return reply.status(404).send({ error: 'Not Found' });
    if (closing.rows[0].status === 'finalized') {
      return reply.status(400).send({ error: '이미 확정된 마감입니다.' });
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (body.physical_qty !== undefined) {
      // 실사 수량 입력 → 차이 자동 계산
      fields.push(`physical_qty = $${idx++}`);
      values.push(body.physical_qty);

      // 시스템 수량 조회
      const ci = await pool.query(
        `SELECT system_qty FROM closing_item WHERE ci_id = $1`, [parseInt(ciId, 10)]
      );
      if (ci.rows.length > 0) {
        const sysQty = parseFloat(ci.rows[0].system_qty);
        const diff = body.physical_qty - sysQty;
        const diffRate = sysQty !== 0 ? (diff / sysQty) * 100 : (diff !== 0 ? 100 : 0);
        fields.push(`difference = $${idx++}`);
        values.push(Math.round(diff * 100) / 100);
        fields.push(`diff_rate = $${idx++}`);
        values.push(Math.round(diffRate * 10000) / 10000);
      }

      fields.push(`count_status = 'counted'`);
      fields.push(`counted_at = now()`);
    }

    if (body.counted_by !== undefined) {
      fields.push(`counted_by = $${idx++}`);
      values.push(body.counted_by);
    }
    if (body.note !== undefined) {
      fields.push(`note = $${idx++}`);
      values.push(body.note);
    }

    if (fields.length === 0) {
      return reply.status(400).send({ error: '수정할 항목이 없습니다.' });
    }

    values.push(parseInt(ciId, 10));
    const result = await pool.query(
      `UPDATE closing_item SET ${fields.join(', ')} WHERE ci_id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return reply.status(404).send({ error: 'Not Found' });
    return { data: result.rows[0] };
  });

  // ──────────────────────────────────────────────
  // POST /api/inventory-closing/:closingId/items/batch-count - 일괄 실사 입력
  // ──────────────────────────────────────────────
  app.post('/api/inventory-closing/:closingId/items/batch-count', async (request, reply) => {
    const { closingId } = request.params as { closingId: string };
    const body = request.body as {
      counts: Array<{ ci_id: number; physical_qty: number; note?: string }>;
      counted_by: string;
    };

    if (!body.counts || body.counts.length === 0) {
      return reply.status(400).send({ error: '실사 데이터가 없습니다.' });
    }

    const closing = await pool.query(
      `SELECT status FROM inventory_closing WHERE closing_id = $1`, [parseInt(closingId, 10)]
    );
    if (closing.rows.length === 0) return reply.status(404).send({ error: 'Not Found' });
    if (closing.rows[0].status === 'finalized') {
      return reply.status(400).send({ error: '이미 확정된 마감입니다.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let updated = 0;

      for (const count of body.counts) {
        const ci = await client.query(
          `SELECT system_qty FROM closing_item WHERE ci_id = $1 AND closing_id = $2`,
          [count.ci_id, parseInt(closingId, 10)]
        );
        if (ci.rows.length === 0) continue;

        const sysQty = parseFloat(ci.rows[0].system_qty);
        const diff = count.physical_qty - sysQty;
        const diffRate = sysQty !== 0 ? (diff / sysQty) * 100 : (diff !== 0 ? 100 : 0);

        await client.query(
          `UPDATE closing_item SET
            physical_qty = $1, difference = $2, diff_rate = $3,
            count_status = 'counted', counted_by = $4, counted_at = now(),
            note = COALESCE($5, note)
           WHERE ci_id = $6`,
          [count.physical_qty, Math.round(diff * 100) / 100,
           Math.round(diffRate * 10000) / 10000, body.counted_by,
           count.note || null, count.ci_id]
        );
        updated++;
      }

      await client.query('COMMIT');
      return { data: { updated } };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ──────────────────────────────────────────────
  // PATCH /api/inventory-closing/:id/status - 마감 상태 변경
  // ──────────────────────────────────────────────
  app.patch('/api/inventory-closing/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { status: string };

    const validTransitions: Record<string, string[]> = {
      draft: ['counting'],
      counting: ['review'],
      review: ['approved', 'counting'],  // 반려 시 다시 counting
      approved: ['finalized'],
    };

    const closing = await pool.query(
      `SELECT * FROM inventory_closing WHERE closing_id = $1`, [parseInt(id, 10)]
    );
    if (closing.rows.length === 0) return reply.status(404).send({ error: 'Not Found' });

    const current = closing.rows[0].status;
    if (!validTransitions[current]?.includes(body.status)) {
      return reply.status(400).send({
        error: `${current} → ${body.status} 상태 전환이 불가합니다.`
      });
    }

    const updates: string[] = [`status = $1`];
    const params: unknown[] = [body.status];

    if (body.status === 'finalized') {
      updates.push(`finalized_at = now()`);
    }

    params.push(parseInt(id, 10));
    const result = await pool.query(
      `UPDATE inventory_closing SET ${updates.join(', ')} WHERE closing_id = $${params.length} RETURNING *`,
      params
    );

    return { data: result.rows[0] };
  });

  // ──────────────────────────────────────────────
  // POST /api/inventory-closing/:closingId/adjustments - 조정 요청
  // ──────────────────────────────────────────────
  app.post('/api/inventory-closing/:closingId/adjustments', async (request, reply) => {
    const { closingId } = request.params as { closingId: string };
    const body = request.body as {
      ci_id?: number;
      item_id: number;
      lot_id?: number;
      lot_number?: string;
      adj_type: string;  // INCREASE, DECREASE, WRITE_OFF
      adj_qty: number;
      reason: string;
      process_zone?: string;
      requested_by?: string;
    };

    if (!body.item_id || !body.adj_type || !body.adj_qty || !body.reason) {
      return reply.status(400).send({ error: 'item_id, adj_type, adj_qty, reason 필수' });
    }

    // process_zone 자동 결정
    let zone = body.process_zone;
    if (!zone) {
      const item = await pool.query(`SELECT item_category FROM item_master WHERE item_id = $1`, [body.item_id]);
      if (item.rows.length > 0) {
        zone = getProcessZone(item.rows[0].item_category);
      }
    }

    const approver = getApprover(zone || 'CUT_SM_FP');

    const result = await pool.query(
      `INSERT INTO closing_adjustment
        (closing_id, ci_id, item_id, lot_id, lot_number, adj_type, adj_qty, reason,
         process_zone, approver_name, requested_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [parseInt(closingId, 10), body.ci_id || null, body.item_id, body.lot_id || null,
       body.lot_number || null, body.adj_type, body.adj_qty, body.reason,
       zone, approver, body.requested_by || null]
    );

    return { data: result.rows[0] };
  });

  // ──────────────────────────────────────────────
  // GET /api/inventory-closing/:closingId/adjustments - 조정 목록
  // ──────────────────────────────────────────────
  app.get('/api/inventory-closing/:closingId/adjustments', async (request) => {
    const { closingId } = request.params as { closingId: string };
    const { status, zone } = request.query as { status?: string; zone?: string };

    let query = `
      SELECT ca.*, i.item_code, i.item_name, i.item_category, i.unit
      FROM closing_adjustment ca
      JOIN item_master i ON i.item_id = ca.item_id
      WHERE ca.closing_id = $1
    `;
    const params: unknown[] = [parseInt(closingId, 10)];

    if (status) {
      params.push(status);
      query += ` AND ca.status = $${params.length}`;
    }
    if (zone) {
      params.push(zone);
      query += ` AND ca.process_zone = $${params.length}`;
    }

    query += ` ORDER BY ca.requested_at DESC`;

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });

  // ──────────────────────────────────────────────
  // PATCH /api/inventory-closing/adjustments/:adjId - 조정 승인/반려
  // ──────────────────────────────────────────────
  app.patch('/api/inventory-closing/adjustments/:adjId', async (request, reply) => {
    const { adjId } = request.params as { adjId: string };
    const body = request.body as {
      status: string;  // approved, rejected
      note?: string;
    };

    if (!['approved', 'rejected'].includes(body.status)) {
      return reply.status(400).send({ error: 'status는 approved 또는 rejected만 가능합니다.' });
    }

    const adj = await pool.query(
      `SELECT * FROM closing_adjustment WHERE adj_id = $1`, [parseInt(adjId, 10)]
    );
    if (adj.rows.length === 0) return reply.status(404).send({ error: 'Not Found' });
    if (adj.rows[0].status !== 'pending') {
      return reply.status(400).send({ error: '이미 처리된 조정 건입니다.' });
    }

    const result = await pool.query(
      `UPDATE closing_adjustment
       SET status = $1, approved_at = now(), note = COALESCE($2, note)
       WHERE adj_id = $3 RETURNING *`,
      [body.status, body.note || null, parseInt(adjId, 10)]
    );

    return { data: result.rows[0] };
  });

  // ──────────────────────────────────────────────
  // POST /api/inventory-closing/adjustments/:adjId/apply - 승인된 조정 재고 반영
  // ──────────────────────────────────────────────
  app.post('/api/inventory-closing/adjustments/:adjId/apply', async (request, reply) => {
    const { adjId } = request.params as { adjId: string };

    const adj = await pool.query(
      `SELECT * FROM closing_adjustment WHERE adj_id = $1`, [parseInt(adjId, 10)]
    );
    if (adj.rows.length === 0) return reply.status(404).send({ error: 'Not Found' });

    const a = adj.rows[0];
    if (a.status !== 'approved') {
      return reply.status(400).send({ error: '승인된 조정 건만 재고 반영 가능합니다.' });
    }
    if (a.applied_at) {
      return reply.status(400).send({ error: '이미 재고 반영된 건입니다.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // ADJ 유형으로 재고 트랜잭션 생성
      const adjQty = a.adj_type === 'DECREASE' || a.adj_type === 'WRITE_OFF'
        ? -Math.abs(parseFloat(a.adj_qty))
        : Math.abs(parseFloat(a.adj_qty));

      const txnResult = await client.query(
        `INSERT INTO inventory_transaction
          (item_id, lot_id, txn_type, txn_date, qty, purpose, worker, confirmed_by)
         VALUES ($1, $2, 'ADJ', CURRENT_DATE, $3, $4, $5, $6)
         RETURNING inv_id`,
        [a.item_id, a.lot_id || null, adjQty,
         `월말실사조정`, a.requested_by || null, a.approver_name]
      );

      // 조정 기록 업데이트
      await client.query(
        `UPDATE closing_adjustment SET status = 'applied', applied_at = now(), inv_id = $1 WHERE adj_id = $2`,
        [txnResult.rows[0].inv_id, parseInt(adjId, 10)]
      );

      await client.query('COMMIT');

      return {
        data: {
          adj_id: parseInt(adjId, 10),
          inv_id: txnResult.rows[0].inv_id,
          applied: true,
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
  // GET /api/inventory-closing/:id/report - 월말 재고 실사 보고서
  // ──────────────────────────────────────────────
  app.get('/api/inventory-closing/:id/report', async (request, reply) => {
    const { id } = request.params as { id: string };
    const closingId = parseInt(id, 10);

    const closing = await pool.query(
      `SELECT * FROM inventory_closing WHERE closing_id = $1`, [closingId]
    );
    if (closing.rows.length === 0) return reply.status(404).send({ error: 'Not Found' });

    // 관리영역별 요약
    const zoneSummary = await pool.query(`
      SELECT
        process_zone,
        COUNT(*) as total_items,
        COUNT(CASE WHEN count_status IN ('counted','verified') THEN 1 END) as counted_items,
        COALESCE(SUM(system_qty), 0) as total_system_qty,
        COALESCE(SUM(physical_qty), 0) as total_physical_qty,
        COALESCE(SUM(CASE WHEN difference IS NOT NULL THEN ABS(difference) ELSE 0 END), 0) as total_abs_diff,
        COUNT(CASE WHEN difference > 0 THEN 1 END) as surplus_count,
        COUNT(CASE WHEN difference < 0 THEN 1 END) as shortage_count,
        COUNT(CASE WHEN difference = 0 OR difference IS NULL THEN 1 END) as match_count
      FROM closing_item
      WHERE closing_id = $1
      GROUP BY process_zone
    `, [closingId]);

    // 카테고리별 요약
    const categorySummary = await pool.query(`
      SELECT
        item_category,
        COUNT(*) as total_items,
        COALESCE(SUM(system_qty), 0) as total_system,
        COALESCE(SUM(physical_qty), 0) as total_physical,
        COALESCE(SUM(difference), 0) as net_diff,
        COUNT(CASE WHEN difference != 0 AND difference IS NOT NULL THEN 1 END) as diff_count
      FROM closing_item
      WHERE closing_id = $1
      GROUP BY item_category
      ORDER BY item_category
    `, [closingId]);

    // 차이 상위 10건
    const topDiffs = await pool.query(`
      SELECT ci.*, i.item_code, i.item_name
      FROM closing_item ci
      JOIN item_master i ON i.item_id = ci.item_id
      WHERE ci.closing_id = $1 AND ci.difference IS NOT NULL AND ci.difference != 0
      ORDER BY ABS(ci.difference) DESC
      LIMIT 10
    `, [closingId]);

    // 조정 현황
    const adjSummary = await pool.query(`
      SELECT
        status, COUNT(*) as count,
        COALESCE(SUM(adj_qty), 0) as total_qty
      FROM closing_adjustment
      WHERE closing_id = $1
      GROUP BY status
    `, [closingId]);

    return {
      data: {
        closing: closing.rows[0],
        zone_summary: zoneSummary.rows,
        category_summary: categorySummary.rows,
        top_diffs: topDiffs.rows,
        adjustment_summary: adjSummary.rows,
      },
    };
  });

  // ──────────────────────────────────────────────
  // GET /api/inventory-closing/:id/print - 인쇄용 보고서 데이터
  // ──────────────────────────────────────────────
  app.get('/api/inventory-closing/:id/print', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { zone } = request.query as { zone?: string };
    const closingId = parseInt(id, 10);

    const closing = await pool.query(
      `SELECT * FROM inventory_closing WHERE closing_id = $1`, [closingId]
    );
    if (closing.rows.length === 0) return reply.status(404).send({ error: 'Not Found' });

    let itemsQuery = `
      SELECT ci.*, i.item_code, i.item_name
      FROM closing_item ci
      JOIN item_master i ON i.item_id = ci.item_id
      WHERE ci.closing_id = $1
    `;
    const params: unknown[] = [closingId];

    if (zone) {
      params.push(zone);
      itemsQuery += ` AND ci.process_zone = $${params.length}`;
    }
    itemsQuery += ` ORDER BY ci.item_category, i.item_code, ci.lot_number`;

    const items = await pool.query(itemsQuery, params);

    const adjustments = await pool.query(`
      SELECT ca.*, i.item_code, i.item_name
      FROM closing_adjustment ca
      JOIN item_master i ON i.item_id = ca.item_id
      WHERE ca.closing_id = $1
      ORDER BY ca.status, ca.requested_at
    `, [closingId]);

    return {
      data: {
        closing: closing.rows[0],
        items: items.rows,
        adjustments: adjustments.rows,
        approvers: {
          RM_EXT: '이동민',
          CUT_SM_FP: '임병용',
        },
      },
    };
  });
}
