import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';

// ─────────────────────────────────────────────────────────────────────────────
// 재단 계산식 (엑셀 작업지시서 실측 검증 완료)
// ─────────────────────────────────────────────────────────────────────────────
function calcCutVM(w: number, h: number, qty: number) {
  // VM형(VA-064, VT-049, VT-064): 내부용 + 외부용
  return {
    inner_w: w - 5,       inner_w_qty: qty * 4,
    inner_h: h - 30,      inner_h_qty: qty * 4,
    outer_top: w + 60,    outer_top_qty: qty * 2,
    outer_side: h,        outer_side_qty: qty * 2,
  };
}

function calcCutVT(w: number, h: number, qty: number) {
  // VT형(VT-01): 분할 구조 — 내부 가로/세로 = W/2-20, H/2-20
  return {
    inner_w: Math.round(w / 2 - 20),  inner_w_qty: qty * 16,
    inner_h: Math.round(h / 2 - 20),  inner_h_qty: qty * 16,
    outer_top: w + 60,                 outer_top_qty: qty * 4,
    outer_side: h,                     outer_side_qty: qty * 4,
  };
}

function calcCutThermal(w: number, h: number, qty: number) {
  // 차열재(세라믹울) 재단: 소켓 외부용만
  return {
    outer_top: w + 60,   outer_top_qty: qty * 2,
    outer_side: h,       outer_side_qty: qty * 2,
  };
}

function calcBracketVM(code: string, w: number, h: number, qty: number) {
  // VM형 절곡 브라켓 (VA-064, VT-049, VT-064)
  return [
    { label: '상하 브라켓', t: 1.6, bw: 60, l: w - 1, qty: qty * 4 },
    { label: '좌우 브라켓', t: 1.6, bw: 60, l: h - 30, qty: qty * 4 },
  ];
}

function calcBracketVT(w: number, h: number, qty: number) {
  // VT-01 절곡 브라켓 (상하/좌우)
  return [
    { label: '상하 브라켓', t: 1.6, bw: 60, l: Math.round(w / 2 - 16), qty: qty * 16 },
    { label: '좌우 브라켓', t: 1.6, bw: 60, l: Math.round(h / 2 - 20), qty: qty * 32 },
  ];
}

function calcBracketVTRe(w: number, h: number, qty: number) {
  // VT-01 절곡 보강대 (받침대+보강대)
  return [
    { label: '중앙받침대', t: 1.6, bw: 225, l: Math.round(w / 2 - 16), qty: qty * 8 },
    { label: '세로보강대', t: 1.6, bw: 237, l: h, qty: qty * 4 },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// 어떤 공정에 어떤 구조체 코드가 해당되는지
// ─────────────────────────────────────────────────────────────────────────────
const VM_TYPES = new Set(['VA-064', 'VT-049', 'VT-064']);
const VT_TYPES = new Set(['VT-01']);
const HTG_TYPES = new Set(['HTG-064', 'HTG-064DC', 'HTG-1.69']);
const VAG_TYPES = new Set(['VAG-1.69']);

// ─────────────────────────────────────────────────────────────────────────────
// DB 마이그레이션
// ─────────────────────────────────────────────────────────────────────────────
async function migrateStructWO() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS struct_work_order (
      wo_id        SERIAL PRIMARY KEY,
      wo_number    VARCHAR(30) UNIQUE NOT NULL,
      wo_type      VARCHAR(30) NOT NULL,
      -- INSPECT | CUT_VM | CUT_VT | CUT_THERMAL | BEND_VM | BEND_VT | BEND_VT_RE | LABEL
      po_id        INTEGER REFERENCES purchase_order(po_id) ON DELETE SET NULL,
      project_id   INTEGER REFERENCES project_master(project_id) ON DELETE SET NULL,
      project_name TEXT,
      wo_date      DATE DEFAULT CURRENT_DATE,
      delivery_date DATE,
      worker_name  TEXT,
      status       VARCHAR(20) DEFAULT 'PLANNED',
      remarks      TEXT,
      created_by   INTEGER REFERENCES worker(worker_id) ON DELETE SET NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_struct_wo_type    ON struct_work_order(wo_type);
    CREATE INDEX IF NOT EXISTS idx_struct_wo_project ON struct_work_order(project_id);
    CREATE INDEX IF NOT EXISTS idx_struct_wo_po      ON struct_work_order(po_id);

    CREATE TABLE IF NOT EXISTS struct_work_order_item (
      item_id      SERIAL PRIMARY KEY,
      wo_id        INTEGER REFERENCES struct_work_order(wo_id) ON DELETE CASCADE,
      seq_no       INTEGER,
      po_item_id   INTEGER,
      product_type VARCHAR(30),
      width_mm     INTEGER,
      height_mm    INTEGER,
      qty          INTEGER DEFAULT 1,
      calc_data    JSONB,
      stock_type   VARCHAR(20),
      stock_id     INTEGER,
      deduct_qty   NUMERIC(10,3) DEFAULT 0,
      deducted     BOOLEAN DEFAULT false,
      completed_qty INTEGER DEFAULT 0,
      remarks      TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_struct_woi_wo ON struct_work_order_item(wo_id);
  `);
}

async function genWoNumber(type: string): Promise<string> {
  const prefix = {
    INSPECT: 'INS', CUT_VM: 'CVM', CUT_VT: 'CVT',
    CUT_THERMAL: 'CTH', BEND_VM: 'BVM', BEND_VT: 'BVT',
    BEND_VT_RE: 'BRE', THERMAL_OUTER: 'THO', PACKING: 'PKG', LABEL: 'LBL',
  }[type] || 'WO';
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const r = await pool.query(
    `SELECT COUNT(*)+1 as n FROM struct_work_order WHERE wo_number LIKE $1`,
    [`${prefix}-${today}-%`]
  );
  return `${prefix}-${today}-${String(r.rows[0].n).padStart(3, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 라우트
// ─────────────────────────────────────────────────────────────────────────────
export async function structWorkOrderRoutes(app: FastifyInstance) {
  await migrateStructWO();

  // ── GET /api/struct-work-orders ─────────────────────────────────────────
  app.get('/api/struct-work-orders', { preHandler: requireAuth }, async (req) => {
    const { wo_type, project_id, po_id, status } = req.query as any;
    let q = `
      SELECT w.*, 
        (SELECT COUNT(*) FROM struct_work_order_item i WHERE i.wo_id=w.wo_id) AS item_count
      FROM struct_work_order w
      WHERE 1=1
    `;
    const params: any[] = [];
    if (wo_type)    { params.push(wo_type);              q += ` AND w.wo_type=$${params.length}`; }
    if (project_id) { params.push(parseInt(project_id)); q += ` AND w.project_id=$${params.length}`; }
    if (po_id)      { params.push(parseInt(po_id));      q += ` AND w.po_id=$${params.length}`; }
    if (status)     { params.push(status);               q += ` AND w.status=$${params.length}`; }
    q += ' ORDER BY w.created_at DESC';
    const r = await pool.query(q, params);
    return { data: r.rows };
  });

  // ── GET /api/struct-work-orders/:id ────────────────────────────────────
  app.get('/api/struct-work-orders/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const wo = await pool.query('SELECT * FROM struct_work_order WHERE wo_id=$1', [id]);
    if (!wo.rows[0]) return reply.code(404).send({ error: 'not_found' });
    const items = await pool.query(
      'SELECT * FROM struct_work_order_item WHERE wo_id=$1 ORDER BY seq_no',
      [id]
    );
    return { data: { ...wo.rows[0], items: items.rows } };
  });

  // ── POST /api/struct-work-orders ────────────────────────────────────────
  app.post('/api/struct-work-orders', { preHandler: requireAuth }, async (req, reply) => {
    const {
      wo_type, po_id, project_id, project_name,
      wo_date, delivery_date, worker_name, remarks, created_by,
      items,
    } = req.body as any;

    if (!wo_type) return reply.code(400).send({ error: 'wo_type 필요' });
    if (!items?.length) return reply.code(400).send({ error: '항목이 없습니다.' });

    const wo_number = await genWoNumber(wo_type);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const wo = await client.query(`
        INSERT INTO struct_work_order
          (wo_number,wo_type,po_id,project_id,project_name,wo_date,delivery_date,worker_name,remarks,created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
      `, [wo_number, wo_type, po_id||null, project_id||null, project_name||null,
          wo_date||null, delivery_date||null, worker_name||null, remarks||null, created_by||null]);

      const woId = wo.rows[0].wo_id;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const W = it.width_mm || 0, H = it.height_mm || 0, Q = it.qty || 1;
        // 공정별 자동 계산
        let calc_data: any = null;
        if (wo_type === 'CUT_VM')            calc_data = calcCutVM(W, H, Q);
        else if (wo_type === 'CUT_VT')       calc_data = calcCutVT(W, H, Q);
        else if (wo_type === 'CUT_THERMAL')  calc_data = calcCutThermal(W, H, Q);
        else if (wo_type === 'BEND_VM')      calc_data = { brackets: calcBracketVM(it.product_type, W, H, Q) };
        else if (wo_type === 'BEND_VT')      calc_data = { brackets: calcBracketVT(W, H, Q) };
        else if (wo_type === 'BEND_VT_RE')   calc_data = { brackets: calcBracketVTRe(W, H, Q) };
        else if (wo_type === 'THERMAL_OUTER') calc_data = {
          outer_top: W + 60, outer_top_qty: Q * 2,
          outer_side: H,     outer_side_qty: Q * 2,
        };
        else if (wo_type === 'PACKING')      calc_data = { packing_qty: Q };
        // INSPECT, LABEL: calc_data = null

        await client.query(`
          INSERT INTO struct_work_order_item
            (wo_id,seq_no,po_item_id,product_type,width_mm,height_mm,qty,calc_data,stock_type,stock_id,remarks)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        `, [woId, i+1, it.po_item_id||null, it.product_type||null,
            W, H, Q, calc_data ? JSON.stringify(calc_data) : null,
            it.stock_type||null, it.stock_id||null, it.remarks||null]);
      }
      await client.query('COMMIT');
      return { data: wo.rows[0] };
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  // ── PATCH /api/struct-work-orders/:id/start ────────────────────────────
  app.patch('/api/struct-work-orders/:id/start', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const r = await pool.query(
      `UPDATE struct_work_order SET status='IN_PROGRESS' WHERE wo_id=$1 AND status='PLANNED' RETURNING *`,
      [id]
    );
    if (!r.rowCount) return reply.code(400).send({ error: '시작할 수 없는 상태입니다.' });
    return { data: r.rows[0] };
  });

  // ── POST /api/struct-work-orders/:id/complete ──────────────────────────
  // 완료 처리 + 재고 차감
  app.post('/api/struct-work-orders/:id/complete', { preHandler: requireAuth }, async (req, reply) => {
    const woId = parseInt((req.params as any).id);
    const { completed_items, worker_id } = req.body as any;

    const wo = await pool.query('SELECT * FROM struct_work_order WHERE wo_id=$1', [woId]);
    if (!wo.rows[0]) return reply.code(404).send({ error: 'not_found' });
    if (wo.rows[0].status === 'COMPLETED') return reply.code(400).send({ error: '이미 완료된 작업입니다.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const ci of (completed_items || [])) {
        const { item_id, completed_qty, stock_type, stock_id, deduct_qty } = ci;
        // 완료수량 업데이트
        await client.query(
          `UPDATE struct_work_order_item SET completed_qty=$1, deducted=true WHERE item_id=$2`,
          [completed_qty || 0, item_id]
        );
        // 재고 차감
        if (stock_id && deduct_qty > 0) {
          if (stock_type === 'BRACKET') {
            await client.query(
              `UPDATE bracket_stock SET qty=GREATEST(0,qty-$1), updated_at=NOW() WHERE stock_id=$2`,
              [deduct_qty, stock_id]
            );
            await client.query(`
              INSERT INTO stock_transaction (stock_type,stock_id,tx_type,qty,source_type,source_id,memo,created_by)
              VALUES ('BRACKET',$1,'OUT',$2,'STRUCT_WO',$3,$4,$5)
            `, [stock_id, deduct_qty, woId, `구조체작업지시 완료`, worker_id||null]);
          } else if (stock_type === 'CERAMIC_WOOL') {
            await client.query(
              `UPDATE ceramic_wool_stock SET qty=GREATEST(0,qty-$1), updated_at=NOW() WHERE stock_id=$2`,
              [deduct_qty, stock_id]
            );
            await client.query(`
              INSERT INTO material_stock_tx (stock_type,stock_id,tx_type,qty,source_type,source_id,memo,created_by)
              VALUES ('CERAMIC_WOOL',$1,'OUT',$2,'STRUCT_WO',$3,$4,$5)
            `, [stock_id, deduct_qty, woId, '구조체작업지시 완료', worker_id||null]);
          } else if (stock_type === 'EXTRUDED_SHEET') {
            await client.query(
              `UPDATE extruded_sheet_stock SET qty=GREATEST(0,qty-$1), updated_at=NOW() WHERE stock_id=$2`,
              [deduct_qty, stock_id]
            );
            await client.query(`
              INSERT INTO material_stock_tx (stock_type,stock_id,tx_type,qty,source_type,source_id,memo,created_by)
              VALUES ('EXTRUDED_SHEET',$1,'OUT',$2,'STRUCT_WO',$3,$4,$5)
            `, [stock_id, deduct_qty, woId, '구조체작업지시 완료', worker_id||null]);
          }
        }
      }

      await client.query(
        `UPDATE struct_work_order SET status='COMPLETED', completed_at=NOW() WHERE wo_id=$1`,
        [woId]
      );
      await client.query('COMMIT');
      return { data: { success: true } };
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  // ── DELETE /api/struct-work-orders/:id ─────────────────────────────────
  app.delete('/api/struct-work-orders/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const wo = await pool.query('SELECT status FROM struct_work_order WHERE wo_id=$1', [id]);
    if (!wo.rows[0]) return reply.code(404).send({ error: 'not_found' });
    if (wo.rows[0].status === 'COMPLETED') return reply.code(400).send({ error: '완료된 작업은 삭제할 수 없습니다.' });
    await pool.query('DELETE FROM struct_work_order WHERE wo_id=$1', [id]);
    return { data: { success: true } };
  });

  // ── GET /api/po-items-for-wo — PO 항목 조회 (작업지시 생성용) ─
  // po_id + 공정타입으로 필터링 후 qty=1씩 분리하여 반환
  app.get('/api/po-items-for-wo', { preHandler: requireAuth }, async (req) => {
    const { po_id, wo_type } = req.query as any;
    if (!po_id) return { data: [] };
    const items = await pool.query(
      `SELECT
         poi.po_item_id,
         poi.seq_no,
         poi.product_type,
         poi.product_type  AS structure,
         poi.pipe_width_mm  AS width_mm,
         poi.pipe_height_mm AS height_mm,
         poi.qty,
         poi.division,
         poi.install_location,
         poi.remark,
         poi.sheet_name,
         po.project_name,
         po.project_id
       FROM purchase_order_item poi
       JOIN purchase_order po ON po.po_id = poi.po_id
       WHERE poi.po_id=$1 AND poi.item_type='socket'
       ORDER BY poi.sheet_name, poi.seq_no`,
      [parseInt(po_id)]
    );
    let rows = items.rows;

    // 공정 타입별 필터링
    if (wo_type === 'CUT_VM' || wo_type === 'BEND_VM') {
      rows = rows.filter((r: any) => VM_TYPES.has(r.product_type) || VAG_TYPES.has(r.product_type));
    } else if (wo_type === 'CUT_VT' || wo_type === 'BEND_VT' || wo_type === 'BEND_VT_RE') {
      rows = rows.filter((r: any) => VT_TYPES.has(r.product_type));
    } else if (wo_type === 'CUT_THERMAL') {
      rows = rows.filter((r: any) => VM_TYPES.has(r.product_type) || VT_TYPES.has(r.product_type) || VAG_TYPES.has(r.product_type));
    }

    // ★ qty > 1인 항목을 1개씩 분리 (소켓은 1개 단위로 작업)
    const exploded: any[] = [];
    let globalSeq = 1;
    for (const row of rows) {
      const qty = parseInt(row.qty) || 1;
      for (let i = 0; i < qty; i++) {
        exploded.push({
          ...row,
          qty: 1,                        // 무조건 1개
          explode_index: i + 1,          // 분리 순서 (같은 소켓의 n번째)
          explode_total: qty,            // 원래 수량
          global_seq: globalSeq++,       // 전체 일련번호
        });
      }
    }

    return { data: exploded };
  });
}

