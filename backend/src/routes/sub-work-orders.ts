import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';

// ─────────────────────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────────────────────

type SubWoType =
  | 'OUTER_SHEET_CUT'  // 외부차열재 - 차열시트 재단
  | 'OUTER_WOOL_CUT'   // 외부차열재 - 세라믹울 재단 (128K, 폭200)
  | 'OUTER_ASSY'       // 외부차열재 - 조립 (→ assembly_lot 생성)
  | 'THERMAL_ATTACH'   // 소켓 외부차열재 부착 (assembly_lot 사용)
  | 'GAP_SHEET_CUT'    // 틈새시트 - 차열시트 재단
  | 'GAP_WOOL_CUT'     // 틈새시트 - 세라믹울 재단
  | 'GAP_ASSY'         // 틈새시트 - 조립 (→ gap_sheet_stock 입고)
  | 'FLASH_I'          // 플래싱 I형 생산
  | 'FLASH_Z'          // 플래싱 Z형 생산
  | 'FLASH_L';         // 플래싱 L형 생산

// ─────────────────────────────────────────────────────────────────────────────
// 계산 함수
// ─────────────────────────────────────────────────────────────────────────────

/** 외부차열재 세라믹울(128K, 폭200) 재단 길이 계산 */
function calcOuterWool(w: number, h: number, qty: number) {
  // 총 길이 = (W+60)×2 + H×2
  const length_per_piece = (w + 60) * 2 + h * 2;
  const total_length = length_per_piece * qty;
  return {
    density: '128K',
    width_mm: 200,
    length_per_piece,
    total_length,
    qty_rolls: parseFloat((total_length / 7320).toFixed(4)), // 1롤 = 7320mm
  };
}

/** 외부차열재 차열시트 재단 계산 */
function calcOuterSheet(w: number, h: number, qty: number) {
  // 상하: W+60 × qty×2장
  // 좌우: H × qty×2장
  return {
    top_bottom: { length: w + 60, qty: qty * 2 },
    left_right: { length: h, qty: qty * 2 },
  };
}

/** 공정별 calc_data 자동 계산 */
function calcItemData(wo_type: SubWoType, w: number, h: number, qty: number): object | null {
  switch (wo_type) {
    case 'OUTER_WOOL_CUT':
    case 'GAP_WOOL_CUT':
      return calcOuterWool(w, h, qty);
    case 'OUTER_SHEET_CUT':
    case 'GAP_SHEET_CUT':
      return calcOuterSheet(w, h, qty);
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 플래싱·틈새시트 규격 (고정)
// ─────────────────────────────────────────────────────────────────────────────

const FLASH_SPEC = {
  I: { zinc_w: 125, zinc_l: 1000, zinc_t: 0.5, sheet_t: 5, sheet_w: 125, sheet_l: 4000 },
  Z: { zinc_w: 170, zinc_l: 1000, zinc_t: 0.5, sheet_t: 4, sheet_w: 125, sheet_l: 4000 },
  L: { zinc_w: 185, zinc_l: 1000, zinc_t: 0.5, sheet_t: 5, sheet_w: 125, sheet_l: 4000 },
} as const;

const GAP_SHEET_SPEC = {
  zinc_w: 200, zinc_l: 1000, zinc_t: 0.4,   // 틈새 복합 강판
  sheet_w: 185, sheet_l: 4000, sheet_t: 4,   // 틈새 차열시트
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// DB 마이그레이션
// ─────────────────────────────────────────────────────────────────────────────

async function migrateSubWO() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sub_work_order (
      swo_id        SERIAL PRIMARY KEY,
      swo_number    VARCHAR(30) UNIQUE NOT NULL,
      wo_type       VARCHAR(30) NOT NULL,
      po_id         INTEGER REFERENCES purchase_order(po_id) ON DELETE SET NULL,
      project_id    INTEGER REFERENCES project_master(project_id) ON DELETE SET NULL,
      project_name  TEXT,
      wo_date       DATE DEFAULT CURRENT_DATE,
      delivery_date DATE,
      worker_name   TEXT,
      status        VARCHAR(20) DEFAULT 'PLANNED',
      remarks       TEXT,
      created_by    INTEGER,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      completed_at  TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS sub_work_order_item (
      item_id            SERIAL PRIMARY KEY,
      swo_id             INTEGER REFERENCES sub_work_order(swo_id) ON DELETE CASCADE,
      seq_no             INTEGER,
      po_item_id         INTEGER,
      structure          TEXT,
      width_mm           INTEGER,
      height_mm          INTEGER,
      qty                INTEGER DEFAULT 1,
      calc_data          JSONB,
      remarks            TEXT
    );

    CREATE TABLE IF NOT EXISTS assembly_lot (
      lot_id        SERIAL PRIMARY KEY,
      lot_number    VARCHAR(30) UNIQUE NOT NULL,
      lot_type      VARCHAR(20) NOT NULL,
      swo_id        INTEGER REFERENCES sub_work_order(swo_id),
      qty           INTEGER DEFAULT 0,
      status        VARCHAR(20) DEFAULT 'ACTIVE',
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS gap_sheet_stock (
      stock_id      SERIAL PRIMARY KEY,
      lot_number    VARCHAR(30),
      qty           INTEGER DEFAULT 0,
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS flashing_stock (
      stock_id      SERIAL PRIMARY KEY,
      flash_type    VARCHAR(5) NOT NULL,
      qty           INTEGER DEFAULT 0,
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // 소켓 인수검사 로트번호 컨럼 추가 (IF NOT EXISTS)
  await pool.query(`
    ALTER TABLE sub_work_order_item
      ADD COLUMN IF NOT EXISTS socket_lot_number VARCHAR(100);
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// 번호 자동 채번
// ─────────────────────────────────────────────────────────────────────────────

async function generateSubWoNumber(wo_type: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SUBWO-${year}`;
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM sub_work_order WHERE swo_number LIKE $1`,
    [`${prefix}-%`],
  );
  const seq = parseInt(rows[0].cnt) + 1;
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

async function generateLotNumber(lot_type: string): Promise<string> {
  const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `LOT-${lot_type}-${yyyymmdd}`;
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM assembly_lot WHERE lot_number LIKE $1`,
    [`${prefix}-%`],
  );
  const seq = parseInt(rows[0].cnt) + 1;
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 라우트 export
// ─────────────────────────────────────────────────────────────────────────────

export async function subWorkOrderRoutes(app: FastifyInstance) {
  await migrateSubWO();

  // ── GET /api/sub-work-orders — 목록 ─────────────────────────────────────
  app.get('/api/sub-work-orders', { preHandler: requireAuth }, async (req) => {
    const { wo_type, project_id, status } = req.query as any;
    let q = `
      SELECT s.*,
             pm.project_name AS pm_name,
             COUNT(i.item_id) AS item_count,
             SUM(i.qty) AS total_qty
      FROM sub_work_order s
      LEFT JOIN project_master pm ON pm.project_id = s.project_id
      LEFT JOIN sub_work_order_item i ON i.swo_id = s.swo_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (wo_type)    { params.push(wo_type);              q += ` AND s.wo_type = $${params.length}`; }
    if (project_id) { params.push(parseInt(project_id)); q += ` AND s.project_id = $${params.length}`; }
    if (status)     { params.push(status);               q += ` AND s.status = $${params.length}`; }
    q += ' GROUP BY s.swo_id, pm.project_name ORDER BY s.created_at DESC';
    const res = await pool.query(q, params);
    return { data: res.rows };
  });

  // ── GET /api/sub-work-orders/:id — 상세 ─────────────────────────────────
  app.get('/api/sub-work-orders/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const swo = await pool.query(
      `SELECT s.*, pm.project_name AS pm_name
       FROM sub_work_order s
       LEFT JOIN project_master pm ON pm.project_id = s.project_id
       WHERE s.swo_id = $1`,
      [id],
    );
    if (!swo.rows[0]) return reply.code(404).send({ error: 'not_found' });
    const items = await pool.query(
      `SELECT * FROM sub_work_order_item WHERE swo_id = $1 ORDER BY seq_no`,
      [id],
    );
    return { data: { ...swo.rows[0], items: items.rows } };
  });

  // ── POST /api/sub-work-orders — 생성 ────────────────────────────────────
  app.post('/api/sub-work-orders', { preHandler: requireAuth }, async (req, reply) => {
    const {
      wo_type, po_id, project_id, project_name,
      wo_date, delivery_date, worker_name, remarks,
      items = [],
      created_by,
    } = req.body as any;

    if (!wo_type) return reply.code(400).send({ error: 'wo_type은 필수입니다.' });

    const swo_number = await generateSubWoNumber(wo_type);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const ins = await client.query(
        `INSERT INTO sub_work_order
           (swo_number, wo_type, po_id, project_id, project_name,
            wo_date, delivery_date, worker_name, remarks, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING swo_id`,
        [
          swo_number, wo_type, po_id || null, project_id || null,
          project_name || null, wo_date || null, delivery_date || null,
          worker_name || null, remarks || null, created_by || null,
        ],
      );
      const swo_id = ins.rows[0].swo_id;

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const w = it.width_mm ?? 0;
        const h = it.height_mm ?? 0;
        const qty = it.qty ?? 1;
        const calc_data = calcItemData(wo_type as SubWoType, w, h, qty);

        await client.query(
          `INSERT INTO sub_work_order_item
             (swo_id, seq_no, po_item_id, structure, width_mm, height_mm, qty, calc_data, remarks, socket_lot_number)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            swo_id, i + 1, it.po_item_id || null,
            it.structure || null, w || null, h || null, qty,
            calc_data ? JSON.stringify(calc_data) : null,
            it.remarks || null,
            it.socket_lot_number || null,
          ],
        );
      }

      await client.query('COMMIT');
      return reply.code(201).send({ data: { swo_id, swo_number } });
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.code(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ── PATCH /api/sub-work-orders/:id/start — IN_PROGRESS ──────────────────
  app.patch('/api/sub-work-orders/:id/start', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const res = await pool.query(
      `UPDATE sub_work_order SET status='IN_PROGRESS'
       WHERE swo_id=$1 AND status='PLANNED'
       RETURNING swo_id`,
      [id],
    );
    if (res.rowCount === 0) return reply.code(400).send({ error: '시작할 수 없는 상태입니다.' });
    return { data: { success: true } };
  });

  // ── POST /api/sub-work-orders/:id/complete — 완료 처리 ──────────────────
  app.post('/api/sub-work-orders/:id/complete', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const { qty } = req.body as any;  // 완료 수량 (플래싱/gap_sheet 입고 시 사용)

    const swoRes = await pool.query(
      `SELECT * FROM sub_work_order WHERE swo_id = $1`, [id],
    );
    if (!swoRes.rows[0]) return reply.code(404).send({ error: 'not_found' });
    const swo = swoRes.rows[0];
    if (swo.status === 'COMPLETED') {
      return reply.code(400).send({ error: '이미 완료된 작업지시입니다.' });
    }

    // 아이템 합계 수량
    const itemsRes = await pool.query(
      `SELECT COALESCE(SUM(qty), 0) AS total_qty FROM sub_work_order_item WHERE swo_id = $1`,
      [id],
    );
    const totalQty: number = qty ?? parseInt(itemsRes.rows[0].total_qty) ?? 1;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const wo_type: SubWoType = swo.wo_type;

      // ── 공정별 후처리 ──────────────────────────────────────────────────
      if (wo_type === 'OUTER_ASSY') {
        // assembly_lot 생성 (OUTER_ASSY)
        const lot_number = await generateLotNumber('OUTER_ASSY');
        await client.query(
          `INSERT INTO assembly_lot (lot_number, lot_type, swo_id, qty)
           VALUES ($1, 'OUTER_ASSY', $2, $3)`,
          [lot_number, id, totalQty],
        );
      } else if (wo_type === 'GAP_ASSY') {
        // gap_sheet_stock 입고 + assembly_lot 생성 (GAP_SHEET)
        const lot_number = await generateLotNumber('GAP_SHEET');
        await client.query(
          `INSERT INTO assembly_lot (lot_number, lot_type, swo_id, qty)
           VALUES ($1, 'GAP_SHEET', $2, $3)`,
          [lot_number, id, totalQty],
        );
        await client.query(
          `INSERT INTO gap_sheet_stock (lot_number, qty, updated_at)
           VALUES ($1, $2, NOW())`,
          [lot_number, totalQty],
        );
      } else if (wo_type === 'FLASH_I' || wo_type === 'FLASH_Z' || wo_type === 'FLASH_L') {
        // flashing_stock 업서트 (flash_type: I / Z / L, qty 증가)
        const flash_type = wo_type.replace('FLASH_', '') as 'I' | 'Z' | 'L';
        await client.query(
          `INSERT INTO flashing_stock (flash_type, qty, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (flash_type) DO UPDATE
             SET qty = flashing_stock.qty + EXCLUDED.qty,
                 updated_at = NOW()`,
          [flash_type, totalQty],
        );
      }

      // 상태 COMPLETED 업데이트
      await client.query(
        `UPDATE sub_work_order SET status='COMPLETED', completed_at=NOW() WHERE swo_id=$1`,
        [id],
      );

      await client.query('COMMIT');
      return { data: { success: true, swo_id: id, wo_type } };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.code(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ── DELETE /api/sub-work-orders/:id — 삭제 (COMPLETED 불가) ─────────────
  app.delete('/api/sub-work-orders/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const check = await pool.query(
      `SELECT status FROM sub_work_order WHERE swo_id = $1`, [id],
    );
    if (!check.rows[0]) return reply.code(404).send({ error: 'not_found' });
    if (check.rows[0].status === 'COMPLETED') {
      return reply.code(400).send({ error: '완료된 작업지시는 삭제할 수 없습니다.' });
    }
    await pool.query(`DELETE FROM sub_work_order WHERE swo_id = $1`, [id]);
    return { data: { success: true } };
  });

  // ── GET /api/assembly-lots — 조립 로트 목록 ──────────────────────────────
  app.get('/api/assembly-lots', { preHandler: requireAuth }, async (req) => {
    const { lot_type, status } = req.query as any;
    let q = `
      SELECT al.*, s.swo_number, s.wo_type, s.project_name
      FROM assembly_lot al
      LEFT JOIN sub_work_order s ON s.swo_id = al.swo_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (lot_type) { params.push(lot_type); q += ` AND al.lot_type = $${params.length}`; }
    if (status)   { params.push(status);   q += ` AND al.status = $${params.length}`; }
    q += ' ORDER BY al.created_at DESC';
    const res = await pool.query(q, params);
    return { data: res.rows };
  });

  // ── GET /api/flashing-stock — 플래싱 재고 ────────────────────────────────
  app.get('/api/flashing-stock', { preHandler: requireAuth }, async () => {
    const res = await pool.query(
      `SELECT * FROM flashing_stock ORDER BY flash_type`,
    );
    // 규격 정보 합쳐서 반환
    const rows = res.rows.map((r) => ({
      ...r,
      spec: FLASH_SPEC[r.flash_type as keyof typeof FLASH_SPEC] ?? null,
    }));
    return { data: rows };
  });

  // ── GET /api/gap-sheet-stock — 틈새시트 재고 ─────────────────────────────
  app.get('/api/gap-sheet-stock', { preHandler: requireAuth }, async () => {
    const res = await pool.query(
      `SELECT *, $1::jsonb AS spec
       FROM gap_sheet_stock
       ORDER BY updated_at DESC`,
      [JSON.stringify(GAP_SHEET_SPEC)],
    );
    return { data: res.rows };
  });
}
