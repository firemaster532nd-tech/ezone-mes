import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';

// ─────────────────────────────────────────────────────────────────────────────
// 재단 계산식 (엑셀 작업지시서 실측 검증 완료)
// ─────────────────────────────────────────────────────────────────────────────

// 단면시공 일 때 플래싱/세라믹울 qty 보정 (SINGLE = 옢0.5)
function singleFactor(ct: 'SINGLE' | 'DOUBLE' | null | undefined): number {
  return ct === 'SINGLE' ? 0.5 : 1;
}

function calcCutVM(w: number, h: number, qty: number, ct?: 'SINGLE' | 'DOUBLE' | null) {
  // VM형(VA-064, VT-049, VT-064)
  // 플래싱(외부용): 단면 시 전체 qty의 1/2
  const sf = singleFactor(ct);
  return {
    // 내부용 (단면/양면 무관)
    inner_w: w - 5,       inner_w_qty: qty * 4,
    inner_h: h - 30,      inner_h_qty: qty * 4,
    // 외부용 플래싱 (단면 시 1/2)
    outer_top: w + 60,    outer_top_qty: Math.round(qty * 2 * sf),
    outer_side: h,        outer_side_qty: Math.round(qty * 2 * sf),
    construction_type: ct ?? 'DOUBLE',
  };
}

function calcCutVT(w: number, h: number, qty: number, ct?: 'SINGLE' | 'DOUBLE' | null) {
  // VT형(VT-01): 분할 구조
  // 플래싱(외부용): 다면 시 전체 qty의 1/2
  const sf = singleFactor(ct);
  return {
    // 내부용 (다면/양면 무관)
    inner_w: Math.round(w / 2 - 20),  inner_w_qty: qty * 16,
    inner_h: Math.round(h / 2 - 20),  inner_h_qty: qty * 16,
    // 외부용 플래싱 (다면 시 1/2)
    outer_top: w + 60,                 outer_top_qty: Math.round(qty * 4 * sf),
    outer_side: h,                     outer_side_qty: Math.round(qty * 4 * sf),
    construction_type: ct ?? 'DOUBLE',
  };
}

function calcCutThermal(w: number, h: number, qty: number, ct?: 'SINGLE' | 'DOUBLE' | null) {
  // 차열재(세라믹울) 재단: 다면 시 1/2
  const sf = singleFactor(ct);
  return {
    outer_top: w + 60,   outer_top_qty: Math.round(qty * 2 * sf),
    outer_side: h,       outer_side_qty: Math.round(qty * 2 * sf),
    construction_type: ct ?? 'DOUBLE',
  };
}

function calcBracketVM(code: string, w: number, h: number, qty: number) {
  // VM형 절곱 브라켓 (VA-064, VT-049, VT-064) — 다면/양면 무관
  return [
    { label: '상하 브라켓', t: 1.6, bw: 60, l: w - 1, qty: qty * 4 },
    { label: '좌우 브라켓', t: 1.6, bw: 60, l: h - 30, qty: qty * 4 },
  ];
}

function calcBracketVAG(w: number, h: number, qty: number) {
  // VAG-1.69 절곱 (sw=반폭-30 기준, 폭204 특수 평철)
  const sw = Math.round(w / 2 - 30);
  return [
    { label: '상하평철1', t: 1.6, bw: 60,  l: sw - 5, qty: qty * 4 },
    { label: '상하평철2', t: 1.6, bw: 204, l: sw - 5, qty: qty * 4 },
  ];
}

function calcBracketVT(w: number, h: number, qty: number) {
  // VT-01 절곱 브라켓 — 다면/양면 무관
  return [
    { label: '상하 브라켓', t: 1.6, bw: 60, l: Math.round(w / 2 - 16), qty: qty * 16 },
    { label: '좌우 브라켓', t: 1.6, bw: 60, l: Math.round(h / 2 - 20), qty: qty * 32 },
  ];
}

function calcBracketVTRe(w: number, h: number, qty: number) {
  // VT-01 절곱 보강대 — 다면/양면 무관
  return [
    { label: '중앙받침대', t: 1.6, bw: 225, l: Math.round(w / 2 - 16), qty: qty * 8 },
    { label: '세로보강대', t: 1.6, bw: 237, l: h, qty: qty * 4 },
  ];
}

function calcCutHTG(w: number, h: number, qty: number) {
  // HTG 입상형 — 세라믹울 재단
  // 엑셀 작업지시서 시트1 기준: 세라믹울(가로)=W-5×6, 차열재(세로)=H-35×2
  return {
    ceramic_w: w - 5,   ceramic_w_qty: qty * 6,  // 세라믹울 가로 재단
    thermal_h: h - 35,  thermal_h_qty: qty * 2,  // 내부 차열재 세로 재단
  };
}

function calcBracketHTG064(w: number, h: number, qty: number) {
  // HTG-064 / HTG-064DC 절곱
  // 엑셀 시트2: 상하평철1(60폭)×2, 상하평철2(274폭)×2, 좌우(60폭)×4, 보강대(50폭)×3
  return [
    { label: '상하평철1',       t: 1.6, bw: 60,  l: w - 5,  qty: qty * 2 },
    { label: '상하평철2',       t: 1.6, bw: 274, l: w - 5,  qty: qty * 2 },
    { label: '좌우브라켓',      t: 1.6, bw: 60,  l: h - 35, qty: qty * 4 },
    { label: '보강대(소켓하부)', t: 1.6, bw: 50,  l: h,      qty: qty * 3 },
  ];
}

function calcBracketHTG169(w: number, h: number, qty: number) {
  // HTG-1.69 절곱 (sw=반폭-30 기준)
  // 엑셀 시트2: 상하평철1×4, 상하평철2(274폭)×4, 좌우×4, 보강대×6
  const sw = Math.round(w / 2 - 30);
  return [
    { label: '상하평철1',       t: 1.6, bw: 60,  l: sw - 5, qty: qty * 4 },
    { label: '상하평철2',       t: 1.6, bw: 274, l: sw - 5, qty: qty * 4 },
    { label: '좌우브라켓',      t: 1.6, bw: 60,  l: h - 35, qty: qty * 4 },
    { label: '보강대(소켓하부)', t: 1.6, bw: 50,  l: h,      qty: qty * 6 },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// 어떤 공정에 어떤 구조체 코드가 해당되는지 (유연한 정규화 매칭)
// ─────────────────────────────────────────────────────────────────────────────
function detectStructCategory(productType?: string | null, structure?: string | null): 'VM' | 'VT' | 'HTG' | 'VAG' {
  const str = `${productType || ''} ${structure || ''}`.toUpperCase().replace(/\s+/g, '');
  if (str.includes('VAG-1.69') || str.includes('VAG1.69') || str.includes('VAG')) return 'VAG';
  if (str.includes('VT-01') || str.includes('VT01') || str.includes('VT1')) return 'VT';
  if (str.includes('HTG') || str.includes('HAG') || str.includes('입상')) return 'HTG';
  // 기본값 VM (VA-064, VT-049, VT-064, V-03, VS-01, VTI-064 등)
  return 'VM';
}

const VM_TYPES  = new Set(['VA-064', 'VT-049', 'VT-064', 'V-03', 'VS-01', 'VTI-064']);
const VT_TYPES  = new Set(['VT-01']);
const HTG_TYPES = new Set(['HTG-064', 'HTG-064DC', 'HTG-1.69', 'HAG-1.69', 'HTG(DC)-064']);
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
      construction_type VARCHAR(10) DEFAULT 'DOUBLE',
      calc_data    JSONB,
      stock_type   VARCHAR(20),
      stock_id     INTEGER,
      deduct_qty   NUMERIC(10,3) DEFAULT 0,
      deducted     BOOLEAN DEFAULT false,
      completed_qty INTEGER DEFAULT 0,
      remarks      TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_struct_woi_wo ON struct_work_order_item(wo_id);
    -- construction_type 컨럼 없으면 추가
    ALTER TABLE struct_work_order_item ADD COLUMN IF NOT EXISTS construction_type VARCHAR(10) DEFAULT 'DOUBLE';
  `);
}

async function genWoNumber(type: string): Promise<string> {
  const prefix = {
    INSPECT: 'INS', CUT_VM: 'CVM', CUT_VT: 'CVT',
    CUT_HTG: 'CHT', BEND_HTG: 'BHT',
    CUT_THERMAL: 'CTH', BEND_VM: 'BVM', BEND_VT: 'BVT',
    BEND_VT_RE: 'BRE', THERMAL_OUTER: 'THO', ASM: 'ASM', PACKING: 'PKG', LABEL: 'LBL',
  }[type] || 'WO';
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const r = await pool.query(
    `SELECT COUNT(*)+1 as n FROM struct_work_order WHERE wo_number LIKE $1`,
    [`${prefix}-${today}-%`]
  );
  return `${prefix}-${today}-${String(r.rows[0].n).padStart(3, '0')}`;
}

function getWoSequence(type: string): number {
  switch (type) {
    case 'INSPECT':       return 1;
    case 'CUT_VM':
    case 'CUT_VT':
    case 'CUT_HTG':       return 2;
    case 'CUT_THERMAL':   return 3;
    case 'BEND_VM':
    case 'BEND_VT':
    case 'BEND_VT_RE':
    case 'BEND_HTG':      return 4;
    case 'THERMAL_OUTER': return 5;
    case 'ASM':           return 6;
    case 'LABEL':         return 7;
    default:              return 99;
  }
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
    const seq = getWoSequence(wo_type);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const wo = await client.query(`
        INSERT INTO struct_work_order
          (wo_number,wo_type,wo_sequence,po_id,project_id,project_name,wo_date,delivery_date,worker_name,remarks,created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
      `, [wo_number, wo_type, seq, po_id||null, project_id||null, project_name||null,
          wo_date||null, delivery_date||null, worker_name||null, remarks||null, created_by||null]);

      const woId = wo.rows[0].wo_id;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const W = it.width_mm || 0, H = it.height_mm || 0, Q = it.qty || 1;
        const CT: 'SINGLE' | 'DOUBLE' = it.construction_type === 'SINGLE' ? 'SINGLE' : 'DOUBLE';
        // 공정별 자동 계산 (단면/양면 반영)
        let calc_data: any = null;
        if (wo_type === 'CUT_VM')            calc_data = calcCutVM(W, H, Q, CT);
        else if (wo_type === 'CUT_VT')       calc_data = calcCutVT(W, H, Q, CT);
        else if (wo_type === 'CUT_THERMAL')  calc_data = calcCutThermal(W, H, Q, CT);
        else if (wo_type === 'CUT_HTG')      calc_data = calcCutHTG(W, H, Q);
        else if (wo_type === 'BEND_VM') {
          if (`${it.product_type||''} ${it.structure||''}`.includes('VAG')) {
            calc_data = { brackets: calcBracketVAG(W, H, Q) };
          } else {
            calc_data = { brackets: calcBracketVM(it.product_type, W, H, Q) };
          }
        }
        else if (wo_type === 'BEND_VT')      calc_data = { brackets: calcBracketVT(W, H, Q) };
        else if (wo_type === 'BEND_VT_RE')   calc_data = { brackets: calcBracketVTRe(W, H, Q) };
        else if (wo_type === 'BEND_HTG') {
          if (`${it.product_type||''} ${it.structure||''}`.includes('1.69')) {
            calc_data = { brackets: calcBracketHTG169(W, H, Q) };
          } else {
            calc_data = { brackets: calcBracketHTG064(W, H, Q) };
          }
        }
        else if (wo_type === 'THERMAL_OUTER') calc_data = {
          outer_top: W + 60, outer_top_qty: Math.round(Q * 2 * singleFactor(CT)),
          outer_side: H,     outer_side_qty: Math.round(Q * 2 * singleFactor(CT)),
          construction_type: CT,
        };
        else if (wo_type === 'PACKING')      calc_data = { packing_qty: Q };
        // INSPECT, LABEL: calc_data = null

        await client.query(`
          INSERT INTO struct_work_order_item
            (wo_id,seq_no,po_item_id,product_type,width_mm,height_mm,qty,construction_type,calc_data,stock_type,stock_id,remarks)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        `, [woId, i+1, it.po_item_id||null, it.product_type||null,
            W, H, Q, CT, calc_data ? JSON.stringify(calc_data) : null,
            it.stock_type||null, it.stock_id||null, it.remarks||null]);
      }
      await client.query('COMMIT');
      return { data: wo.rows[0] };
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  // ── POST /api/struct-work-orders/batch ─────────────────────────────────
  // 구조체 작업지시 일괄 자동 생성
  // PO의 소켓 구조체 유형에 따라 필요한 모든 공정 작업지시를 한 번에 생성
  app.post('/api/struct-work-orders/batch', { preHandler: requireAuth }, async (req, reply) => {
    const {
      po_id, project_id, project_name,
      wo_date, delivery_date, worker_name, created_by, remarks,
    } = req.body as any;
    if (!po_id) return reply.code(400).send({ error: 'po_id 필요' });

    // 1. PO 항목 전체 조회 (item_type 제한 없이 소켓/구조체 항목 전체 로드)
    const poItemsRes = await pool.query(`
      SELECT poi.po_item_id, poi.seq_no, poi.product_type, poi.structure,
             poi.pipe_width_mm  AS width_mm,
             poi.pipe_height_mm AS height_mm,
             poi.qty, poi.remark,
             COALESCE(poi.construction_type, 'DOUBLE') AS construction_type,
             po.project_name AS po_project_name,
             po.project_id   AS po_project_id
      FROM purchase_order_item poi
      JOIN purchase_order po ON po.po_id = poi.po_id
      WHERE poi.po_id = $1
      ORDER BY poi.seq_no
    `, [parseInt(po_id)]);

    const poItems = poItemsRes.rows;
    if (!poItems.length) return reply.code(400).send({ error: '발주서에 항목이 없습니다.' });

    // 각 항목별 구조체 유형 (VM / VT / HTG / VAG) 매핑
    poItems.forEach((r: any) => {
      r._cat = detectStructCategory(r.product_type, r.structure);
    });

    // 2. 구조체 유형 존재 여부 판별
    const hasVM  = poItems.some((r: any) => r._cat === 'VM');
    const hasVT  = poItems.some((r: any) => r._cat === 'VT');
    const hasVAG = poItems.some((r: any) => r._cat === 'VAG');
    const hasHTG = poItems.some((r: any) => r._cat === 'HTG');

    // 3. 공정별 생성 목록 결정 (중복 방지 위해 Set 사용)
    const woTypesSet = new Set<string>();
    // 벽체형 (VM, VAG)
    if (hasVM || hasVAG) {
      woTypesSet.add('CUT_VM');
      woTypesSet.add('BEND_VM');
    }
    // 벽체형 VT-01
    if (hasVT) {
      woTypesSet.add('CUT_VT');
      woTypesSet.add('BEND_VT');
      woTypesSet.add('BEND_VT_RE');
    }
    // 벽체형 공통 차열재
    if (hasVM || hasVT || hasVAG) {
      woTypesSet.add('CUT_THERMAL');
      woTypesSet.add('THERMAL_OUTER');
    }
    // 입상형 (HTG)
    if (hasHTG) {
      woTypesSet.add('INSPECT');
      woTypesSet.add('CUT_HTG');      // 세라믹울/차열재 재단
      woTypesSet.add('BEND_HTG');     // 브라켓/평철 절곡
      woTypesSet.add('GAP_SHEET');    // 📐 틈새시트 (입상)
      woTypesSet.add('GAP_PLATE');    // 🛡️ 틈새강판 (입상)
      woTypesSet.add('FLASH_Z');      // ⚡ Z형 플래싱 (입상)
      woTypesSet.add('THERMAL_OUTER'); // 외부 차열재
    }
    woTypesSet.add('ASM');   // 조립 (공통)
    woTypesSet.add('LABEL'); // 항상 생성
    const woTypesToCreate = [...woTypesSet];

    // 4. 공정별 항목 필터
    function filterForType(type: string): any[] {
      switch (type) {
        case 'CUT_VM':
        case 'BEND_VM':
          return poItems.filter((r: any) => r._cat === 'VM' || r._cat === 'VAG');
        case 'CUT_VT':
        case 'BEND_VT':
        case 'BEND_VT_RE':
          return poItems.filter((r: any) => r._cat === 'VT');
        case 'CUT_THERMAL':
          return poItems.filter((r: any) => r._cat === 'VM' || r._cat === 'VT' || r._cat === 'VAG');
        case 'THERMAL_OUTER':
          return poItems.filter((r: any) => r._cat === 'VM' || r._cat === 'VT' || r._cat === 'VAG' || r._cat === 'HTG');
        case 'INSPECT':
        case 'CUT_HTG':
        case 'BEND_HTG':
        case 'GAP_SHEET':
        case 'GAP_PLATE':
        case 'FLASH_Z':
          return poItems.filter((r: any) => r._cat === 'HTG');
        case 'ASM':
        case 'LABEL':
          return poItems;
        default:
          return poItems;
      }
    }

    const client = await pool.connect();
    const created: any[] = [];
    try {
      await client.query('BEGIN');

      const projName = project_name || poItems[0]?.po_project_name || null;
      const projId   = project_id   || poItems[0]?.po_project_id   || null;

      for (const woType of woTypesToCreate) {
        const typeItems = filterForType(woType);
        if (!typeItems.length) continue;

        const wo_number = await genWoNumber(woType);
        const seq = getWoSequence(woType);
        const wo = await client.query(`
          INSERT INTO struct_work_order
            (wo_number,wo_type,wo_sequence,po_id,project_id,project_name,
             wo_date,delivery_date,worker_name,remarks,created_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
        `, [wo_number, woType, seq, po_id, projId, projName,
            wo_date||null, delivery_date||null, worker_name||null,
            remarks||null, created_by||null]);

        const woId = wo.rows[0].wo_id;

        for (let i = 0; i < typeItems.length; i++) {
          const it = typeItems[i];
          const W  = it.width_mm  || 0;
          const H  = it.height_mm || 0;
          const Q  = it.qty       || 1;
          const CT: 'SINGLE' | 'DOUBLE' = it.construction_type === 'SINGLE' ? 'SINGLE' : 'DOUBLE';

          let calc_data: any = null;
          if      (woType === 'CUT_VM')       calc_data = calcCutVM(W, H, Q, CT);
          else if (woType === 'CUT_VT')       calc_data = calcCutVT(W, H, Q, CT);
          else if (woType === 'CUT_THERMAL')  calc_data = calcCutThermal(W, H, Q, CT);
          else if (woType === 'CUT_HTG')      calc_data = calcCutHTG(W, H, Q);
          else if (woType === 'BEND_VM') {
            // VAG-1.69는 별도 브라켓 공식 적용
            if (it._cat === 'VAG' || `${it.product_type||''} ${it.structure||''}`.includes('VAG')) {
              calc_data = { brackets: calcBracketVAG(W, H, Q) };
            } else {
              calc_data = { brackets: calcBracketVM(it.product_type, W, H, Q) };
            }
          }
          else if (woType === 'BEND_VT')      calc_data = { brackets: calcBracketVT(W, H, Q) };
          else if (woType === 'BEND_VT_RE')   calc_data = { brackets: calcBracketVTRe(W, H, Q) };
          else if (woType === 'BEND_HTG') {
            // HTG-1.69는 별도 브라켓 공식 (sw=반폭-30)
            if (`${it.product_type||''} ${it.structure||''}`.includes('1.69')) {
              calc_data = { brackets: calcBracketHTG169(W, H, Q) };
            } else {
              calc_data = { brackets: calcBracketHTG064(W, H, Q) };
            }
          }
          else if (woType === 'GAP_SHEET') calc_data = {
            item_name: '틈새복합시트(150H)',
            spec: 't5.0 × W125',
            qty: Q * 1,
            unit: 'EA'
          };
          else if (woType === 'GAP_PLATE') calc_data = {
            item_name: '아연도금 틈새강판',
            spec: 'SGCC t0.5, W215×L1000',
            qty: Q * 1,
            unit: 'EA'
          };
          else if (woType === 'FLASH_Z') {
            const perimeterMm = (W + H) * 2;
            const meterPerSet = Math.ceil(perimeterMm / 1000);
            calc_data = {
              item_name: '방화플래싱(Z형)',
              spec: 'W170×L1000 (t0.5)',
              perimeter_mm: perimeterMm,
              meter_per_set: meterPerSet,
              qty: meterPerSet * 2 * Q, // 양면 시공 × 2
              unit: 'EA'
            };
          }
          else if (woType === 'THERMAL_OUTER') calc_data = {
            outer_top:     W + 60,
            outer_top_qty: Math.round(Q * 2 * singleFactor(CT)),
            outer_side:    H,
            outer_side_qty: Math.round(Q * 2 * singleFactor(CT)),
            construction_type: CT,
          };
          else if (woType === 'PACKING') calc_data = { packing_qty: Q };
          else if (woType === 'LABEL') {
            const insulSides = CT === 'SINGLE' ? 1 : 2;
            calc_data = {
              flashing_label_qty:    Q,
              glass_wool_label_qty:  Q * insulSides,
              ceramic_wool_label_qty: Q * insulSides,
              socket_label_qty:      Q,
            };
          }

          await client.query(`
            INSERT INTO struct_work_order_item
              (wo_id,seq_no,po_item_id,product_type,width_mm,height_mm,
               qty,construction_type,calc_data,remarks)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          `, [woId, i+1, it.po_item_id||null, it.product_type||null,
              W, H, Q, CT,
              calc_data ? JSON.stringify(calc_data) : null,
              it.remark||null]);
        }

        created.push({
          wo_type:    woType,
          wo_id:      woId,
          wo_number,
          item_count: typeItems.length,
        });
      }

      await client.query('COMMIT');
      return { data: { created, total: created.length } };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });


  app.patch('/api/struct-work-orders/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const { worker_name, remarks, delivery_date } = req.body as any;
    const existing = await pool.query('SELECT * FROM struct_work_order WHERE wo_id=$1', [id]);
    if (!existing.rows[0]) return reply.code(404).send({ error: 'not_found' });
    const r = await pool.query(
      `UPDATE struct_work_order
         SET worker_name=COALESCE($1, worker_name),
             remarks=COALESCE($2, remarks),
             delivery_date=COALESCE($3::date, delivery_date)
       WHERE wo_id=$4 RETURNING *`,
      [worker_name ?? null, remarks ?? null, delivery_date ?? null, id]
    );
    return { data: r.rows[0] };
  });

  // J-LOT 자동채번 함수 (형식: YYMMDD-구조체코드-WxH-seq)
  async function generateJLot(productType: string, width: number, height: number): Promise<string> {
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const cleanType = (productType || 'STRUCT').replace(/[^a-zA-Z0-9.-]/g, '');
    const baseKey = `JLOT-${dateStr}-${cleanType}-${width}X${height}`;
    
    // lot_number_sequence 시퀀스 테이블 사용
    await pool.query(`
      INSERT INTO lot_number_sequence (base_lot, last_serial) VALUES ($1, 0)
      ON CONFLICT (base_lot) DO NOTHING
    `, [baseKey]);
    
    const seqRes = await pool.query(`
      UPDATE lot_number_sequence SET last_serial = last_serial + 1, updated_at = NOW()
      WHERE base_lot = $1 RETURNING last_serial
    `, [baseKey]);
    const serial = seqRes.rows[0]?.last_serial || 1;
    const seqStr = String(serial).padStart(3, '0');
    return `${dateStr}-${cleanType}-${width}X${height}-${seqStr}`;
  }

  // ── PATCH /api/struct-work-orders/:id/start ────────────────────────────
  // soft-gate 적용: 선행 공정이 미완료된 건이 있으면 warning 반환 (작업 시작 자체는 허용)
  app.patch('/api/struct-work-orders/:id/start', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const woRes = await pool.query('SELECT * FROM struct_work_order WHERE wo_id=$1', [id]);
    if (!woRes.rows[0]) return reply.code(404).send({ error: 'not_found' });
    const wo = woRes.rows[0];

    if (wo.status === 'COMPLETED') {
      return reply.code(400).send({ error: '이미 완료된 작업입니다.' });
    }

    let warning: string | null = null;
    if (wo.po_id && wo.wo_sequence > 1) {
      // 선행 공정(wo_sequence < wo.wo_sequence) 중 미완료(COMPLETED가 아닌) 건 확인
      const prevUncompleted = await pool.query(`
        SELECT wo_number, wo_type, wo_sequence, status 
        FROM struct_work_order 
        WHERE po_id = $1 AND wo_sequence < $2 AND status != 'COMPLETED'
        ORDER BY wo_sequence ASC
      `, [wo.po_id, wo.wo_sequence]);

      if (prevUncompleted.rows.length > 0) {
        const prevList = prevUncompleted.rows.map((r: any) => `[${r.wo_type}](상태:${r.status})`).join(', ');
        warning = `선행 공정 ${prevList}가 아직 완료되지 않았습니다. (Soft-gate 경고)`;
      }
    }

    const r = await pool.query(
      `UPDATE struct_work_order SET status='IN_PROGRESS' WHERE wo_id=$1 RETURNING *`,
      [id]
    );
    return { data: r.rows[0], warning };
  });

  // ── PATCH /api/struct-work-orders/items/:item_id/lot ────────────────────
  // 각 아이템에 투입 자재 LOT 지정
  app.patch('/api/struct-work-orders/items/:item_id/lot', { preHandler: requireAuth }, async (req, reply) => {
    const itemId = parseInt((req.params as any).item_id);
    const { input_lot_id, input_lot_no } = req.body as any;

    const r = await pool.query(`
      UPDATE struct_work_order_item
      SET input_lot_id = $1, input_lot_no = $2
      WHERE item_id = $3
      RETURNING *
    `, [input_lot_id || null, input_lot_no || null, itemId]);

    if (!r.rows[0]) return reply.code(404).send({ error: 'not_found' });
    return { data: r.rows[0] };
  });

  // ── POST /api/struct-work-orders/:id/complete ──────────────────────────
  // 완료 처리 + 재고 차감 + ASM 조립 공정 시 J-LOT 자동채번
  app.post('/api/struct-work-orders/:id/complete', { preHandler: requireAuth }, async (req, reply) => {
    const woId = parseInt((req.params as any).id);
    const { completed_items, worker_id } = req.body as any;

    const woRes = await pool.query('SELECT * FROM struct_work_order WHERE wo_id=$1', [woId]);
    if (!woRes.rows[0]) return reply.code(404).send({ error: 'not_found' });
    const wo = woRes.rows[0];
    if (wo.status === 'COMPLETED') return reply.code(400).send({ error: '이미 완료된 작업입니다.' });

    const client = await pool.connect();
    let generatedJLots: string[] = [];
    try {
      await client.query('BEGIN');

      const itemsRes = await client.query('SELECT * FROM struct_work_order_item WHERE wo_id=$1 ORDER BY seq_no', [woId]);
      const currentItems = itemsRes.rows;

      for (const ci of (completed_items || [])) {
        const { item_id, completed_qty, stock_type, stock_id, deduct_qty, input_lot_id, input_lot_no } = ci;
        const itemRow = currentItems.find((r: any) => r.item_id === item_id);

        let jlotNum: string | null = itemRow?.jlot_number || null;

        // ASM(조립) 공정일 경우 J-LOT 자동채번 (아직 없는 경우)
        if (wo.wo_type === 'ASM' && !jlotNum && itemRow) {
          jlotNum = await generateJLot(itemRow.product_type, itemRow.width_mm, itemRow.height_mm);
          generatedJLots.push(jlotNum);

          // lot_transaction 테이블에 완제품 J-LOT 기록
          await client.query(`
            INSERT INTO lot_transaction (lot_number, item_name, spec, transaction_type, qty, remark, created_by)
            VALUES ($1, $2, $3, 'PRODUCTION', $4, $5, $6)
            ON CONFLICT (lot_number) DO NOTHING
          `, [
            jlotNum,
            itemRow.product_type,
            `${itemRow.width_mm}X${itemRow.height_mm}`,
            completed_qty || 1,
            `ASM 조립완료 (WO: ${wo.wo_number})`,
            worker_id || null
          ]);
        }

        // 완료수량, 투입 LOT, J-LOT 정보 업데이트
        await client.query(`
          UPDATE struct_work_order_item 
          SET completed_qty = $1, 
              deducted = true,
              input_lot_id = COALESCE($2, input_lot_id),
              input_lot_no = COALESCE($3, input_lot_no),
              jlot_number = COALESCE($4, jlot_number),
              asm_worker_id = CASE WHEN $5::int IS NOT NULL THEN $5::int ELSE asm_worker_id END,
              asm_completed_at = CASE WHEN $5::int IS NOT NULL THEN NOW() ELSE asm_completed_at END
          WHERE item_id = $6
        `, [completed_qty || 0, input_lot_id || null, input_lot_no || null, jlotNum || null, worker_id || null, item_id]);

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
        `UPDATE struct_work_order SET status='COMPLETED', completed_at=NOW(), jlot_count=$2 WHERE wo_id=$1`,
        [woId, generatedJLots.length]
      );
      await client.query('COMMIT');
      return { data: { success: true, generated_jlots: generatedJLots } };
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
         poi.remark,
         poi.sheet_name,
         poi.construction_type,
         po.project_name,
         po.project_id
       FROM purchase_order_item poi
       JOIN purchase_order po ON po.po_id = poi.po_id
       WHERE poi.po_id=$1 AND poi.item_type='socket'
       ORDER BY
         COALESCE(poi.sheet_name, '') ASC,
         CASE poi.product_type
           WHEN 'VT-049'    THEN 1  WHEN 'VT-064'    THEN 2
           WHEN 'VT-01'     THEN 3  WHEN 'VA-064'    THEN 4
           WHEN 'VAG-1.69'  THEN 5  WHEN 'HTG-064'   THEN 6
           WHEN 'HTG-064DC' THEN 7  WHEN 'HTG-1.69'  THEN 8
           ELSE 9
         END,
         COALESCE(poi.pipe_width_mm,0) ASC,
         COALESCE(poi.pipe_height_mm,0) ASC`,
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

