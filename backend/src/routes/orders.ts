import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import * as XLSX from 'xlsx';
import { INCOMING_FORM_PRESETS } from './inspections.js';
import { generateProcessLotNumber } from './lot-utils.js';

// ─── 입고 LOT 약호 매핑 (품목코드 prefix → LOT 약호) ───
const LOT_ABBREV_MAP: Record<string, string> = {
  'RM-MB': 'MB',       // 난연컴파운드
  'RM-EG50': '#5',     // 팽창흑연 #50
  'RM-EA': 'EA',       // EVA-EA33045
  'RM-EP': 'EP',       // EVA-EP100
  'SM-SK': 'GI',       // 금속소켓 본체 (아연도금강판)
  'SM-GI': 'GI',       // 강재류 아연도금강판
  'SM-STL': 'GI',      // 강재류
  'SM-CW': 'CW',       // 세라믹차열재
  'SM-GW': 'GW',       // 그라스울
  'SM-SIL': 'SS',      // 실란트
  'SM-SL': 'SS',       // 실리콘 실란트
  'SM-BRK': 'BK',      // 브라켓
  'SM-GP': 'GP',       // 고정자재
  'SM-SP': 'SP',       // 보호철판
  'SM-FN': 'FN',       // 발포소켓
  'SM-PE': 'PE',       // PE보온재
};

function resolveLotAbbrev(itemCode: string): string {
  for (const [prefix, ab] of Object.entries(LOT_ABBREV_MAP)) {
    if (itemCode.startsWith(prefix)) return ab;
  }
  return 'IN';
}

// ─── 마이그레이션 ───
async function migrateOrderTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sales_order (
      order_id         SERIAL PRIMARY KEY,
      order_number     VARCHAR(30) UNIQUE NOT NULL,
      order_date       DATE NOT NULL,
      customer_name    VARCHAR(200) NOT NULL,
      project_name     VARCHAR(300),
      delivery_date    DATE,
      status           VARCHAR(15) DEFAULT 'REGISTERED'
                         CHECK (status IN ('REGISTERED','BOM_EXPLODED','PO_CREATED','IN_PRODUCTION','SHIPPED','CANCELLED')),
      total_sets       INTEGER DEFAULT 0,
      remarks          TEXT,
      created_at       TIMESTAMPTZ DEFAULT now()
    );
  `);

  // Alter existing tables
  try { await pool.query(`ALTER TABLE order_bom_result ALTER COLUMN component_name TYPE TEXT`); } catch {}

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sales_order_item (
      order_item_id    SERIAL PRIMARY KEY,
      order_id         INTEGER NOT NULL REFERENCES sales_order(order_id) ON DELETE CASCADE,
      cert_id          INTEGER NOT NULL REFERENCES certification_master(cert_id),
      structure_code   VARCHAR(30) NOT NULL,
      qty              INTEGER NOT NULL DEFAULT 1,
      opening_w_mm     INTEGER,
      opening_h_mm     INTEGER,
      penetration_w_mm INTEGER,
      penetration_h_mm INTEGER,
      spec_note        TEXT,
      sort_order       INTEGER DEFAULT 0
    );
  `);

  // Add dimension columns to existing table
  const dimCols = ['opening_w_mm', 'opening_h_mm', 'penetration_w_mm', 'penetration_h_mm'];
  for (const col of dimCols) {
    try { await pool.query(`ALTER TABLE sales_order_item ADD COLUMN ${col} INTEGER`); } catch {}
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_bom_result (
      result_id        SERIAL PRIMARY KEY,
      order_id         INTEGER NOT NULL REFERENCES sales_order(order_id) ON DELETE CASCADE,
      order_item_id    INTEGER REFERENCES sales_order_item(order_item_id) ON DELETE CASCADE,
      item_id          INTEGER REFERENCES item_master(item_id),
      item_code        VARCHAR(30),
      item_name        VARCHAR(200),
      item_category    VARCHAR(10),
      required_qty     NUMERIC(12,2) NOT NULL DEFAULT 0,
      unit             VARCHAR(10),
      current_stock    NUMERIC(12,2) DEFAULT 0,
      shortage_qty     NUMERIC(12,2) DEFAULT 0,
      component_name   TEXT,
      spec_detail      TEXT,
      calc_note        TEXT,
      bom_level        INTEGER DEFAULT 0,
      parent_group     VARCHAR(30),
      source_type      VARCHAR(15) CHECK (source_type IN ('PURCHASE','MANUFACTURE')),
      group_sort       INTEGER DEFAULT 0,
      created_at       TIMESTAMPTZ DEFAULT now()
    );
  `);
  try { await pool.query(`ALTER TABLE order_bom_result ADD COLUMN calc_note TEXT`); } catch {}
  try { await pool.query(`ALTER TABLE order_bom_result ADD COLUMN bom_level INTEGER DEFAULT 0`); } catch {}
  try { await pool.query(`ALTER TABLE order_bom_result ADD COLUMN parent_group VARCHAR(30)`); } catch {}
  try { await pool.query(`ALTER TABLE order_bom_result ADD COLUMN source_type VARCHAR(15)`); } catch {}
  try { await pool.query(`ALTER TABLE order_bom_result ADD COLUMN group_sort INTEGER DEFAULT 0`); } catch {}

  // work_order 컬럼 확장 (VARCHAR 길이 부족 방지)
  try { await pool.query(`ALTER TABLE work_order ALTER COLUMN wo_number TYPE VARCHAR(50)`); } catch {}
  try { await pool.query(`ALTER TABLE work_order ALTER COLUMN product_type TYPE VARCHAR(10)`); } catch {}
  try { await pool.query(`ALTER TABLE work_order ALTER COLUMN structure_name TYPE VARCHAR(100)`); } catch {}

  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchase_request (
      pr_id            SERIAL PRIMARY KEY,
      pr_number        VARCHAR(30) UNIQUE NOT NULL,
      order_id         INTEGER REFERENCES sales_order(order_id),
      pr_date          DATE NOT NULL DEFAULT CURRENT_DATE,
      supplier_name    VARCHAR(200),
      status           VARCHAR(15) DEFAULT 'DRAFT'
                         CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','ORDERED','RECEIVED','CANCELLED')),
      remarks          TEXT,
      created_by       VARCHAR(50),
      created_at       TIMESTAMPTZ DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchase_request_item (
      pri_id           SERIAL PRIMARY KEY,
      pr_id            INTEGER NOT NULL REFERENCES purchase_request(pr_id) ON DELETE CASCADE,
      item_id          INTEGER NOT NULL REFERENCES item_master(item_id),
      item_code        VARCHAR(30),
      item_name        VARCHAR(200),
      required_qty     NUMERIC(12,2) NOT NULL,
      order_qty        NUMERIC(12,2),
      unit             VARCHAR(10),
      unit_price       NUMERIC(12,2),
      delivery_date    DATE,
      remarks          TEXT,
      sort_order       INTEGER DEFAULT 0,
      spec_detail      TEXT,
      calc_note        TEXT,
      component_name   TEXT
    );
  `);

  // 기존 테이블에 신규 컬럼 추가 (이미 있으면 무시)
  await pool.query(`ALTER TABLE purchase_request_item ADD COLUMN IF NOT EXISTS spec_detail TEXT`);
  await pool.query(`ALTER TABLE purchase_request_item ADD COLUMN IF NOT EXISTS calc_note TEXT`);
  await pool.query(`ALTER TABLE purchase_request_item ADD COLUMN IF NOT EXISTS component_name TEXT`);
  // 상세 발주용 컬럼 추가
  await pool.query(`ALTER TABLE purchase_request_item ADD COLUMN IF NOT EXISTS roll_count INTEGER`);
  await pool.query(`ALTER TABLE purchase_request_item ADD COLUMN IF NOT EXISTS roll_spec TEXT`);
  try { await pool.query(`ALTER TABLE purchase_request_item ALTER COLUMN roll_spec TYPE TEXT`); } catch {}
  await pool.query(`ALTER TABLE purchase_request_item ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2)`);
  await pool.query(`ALTER TABLE purchase_request_item ADD COLUMN IF NOT EXISTS item_subcategory VARCHAR(50)`);
  await pool.query(`ALTER TABLE purchase_request_item ADD COLUMN IF NOT EXISTS item_spec TEXT`);
  // 입고/검사 연결 컬럼
  await pool.query(`ALTER TABLE purchase_request_item ADD COLUMN IF NOT EXISTS receiving_status VARCHAR(20) DEFAULT 'PENDING'`);
  await pool.query(`ALTER TABLE purchase_request_item ADD COLUMN IF NOT EXISTS received_qty NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE purchase_request_item ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE purchase_request_item ADD COLUMN IF NOT EXISTS lot_id INTEGER REFERENCES lot_transaction(lot_id)`);
  await pool.query(`ALTER TABLE purchase_request_item ADD COLUMN IF NOT EXISTS insp_id INTEGER REFERENCES inspection(insp_id)`);
  // purchase_request에 합계금액
  await pool.query(`ALTER TABLE purchase_request ADD COLUMN IF NOT EXISTS total_amount NUMERIC(14,2) DEFAULT 0`);
}

// ═══════════════════════════════════════════════
// 치수 기반 BOM 계산 엔진
// RPT_20260121 / RPT_20260204 엑셀 산출 공식 기반
// ═══════════════════════════════════════════════

interface DimParams {
  W: number;      // 관통부 가로 (penetration_w_mm)
  H: number;      // 관통부 세로 (penetration_h_mm)
  OW: number;     // 개구부 가로 (opening_w_mm)
  OH: number;     // 개구부 세로 (opening_h_mm)
  N: number;      // 소켓 수량 (install_qty)
  certVersion: string;  // 0310 or 0910
  installPos: string;   // 수직벽체 or 수평바닥
  sheetThickness: number; // 차열시트 두께 (mm)
  cwDensity: number;      // 세라믹울 생산밀도 (cw_density_prod, kg/m³)
  cwDensityMin: number;   // 세라믹울 인정최소밀도 (cw_density_min, kg/m³)
  structureCode?: string; // 구조코드 (VAG-1.69 등)
  lossRate?: number;      // 플래싱 로스율 (기본 10%)
  flashingPlus60?: boolean; // +60 옵션 (소켓외부 결합철판 커버)
}

interface BomLine {
  component: string;     // 구성품명
  item_code: string;     // 품목코드
  qty: number;           // 수량
  unit: string;          // 단위
  length_mm?: number;    // 절단 길이
  width_mm?: number;     // 너비
  spec: string;          // 규격 상세
  calc: string;          // 산출 근거
}

function calculatePerimeter(W: number, H: number): number {
  return 2 * (W + H);
}

/**
 * 방화플래싱 소요량 산출 (REV-008 교차검증 기준)
 *
 * 벽체 기본: 1면 둘레 = (W+250)×2 + H×2
 *   - 상하변 = W + 250mm (플래싱 너비 125mm × 양끝)
 *   - 좌우변 = H (관통재 세로 그대로)
 * 벽체 +60: 1면 둘레 = (W+310)×2 + (H+60)×2
 *   - 소켓 외부시트 결합철판(60mm) 커버 반영
 * 양면: 인정서 기준 "벽체를 기준으로 양면으로 시공"
 * 로스율: 10%(최적재단) / 15%(표준) / 20%(단순)
 */
function calcFlashingWall(W: number, H: number, plus60: boolean, lossRate: number): {
  qty: number; perimeter1: number; theory1: number; theory2: number; withLoss: number; calc: string;
} {
  const topBot = plus60 ? (W + 310) : (W + 250);  // 상하변
  const leftRight = plus60 ? (H + 60) : H;          // 좌우변
  const perimeter1 = topBot * 2 + leftRight * 2;     // 1면 둘레
  const theory1 = perimeter1 / 1000;                  // 1면 세트
  const theory2 = theory1 * 2;                        // 양면 세트
  const withLoss = theory2 * (1 + lossRate / 100);    // 로스 적용
  const qty = Math.ceil(withLoss);                     // 정수 올림

  const p60str = plus60 ? '+60' : '';
  const calc = `상하(W${p60str}+250)=${topBot}×2 + 좌우(H${p60str})=${leftRight}×2 = ${perimeter1}mm/면`
    + ` → ${theory1}세트/면 × 양면2 = ${theory2}세트`
    + ` × 로스${lossRate}% = ${Math.round(withLoss * 100) / 100} → 올림 ${qty}EA`;
  return { qty, perimeter1, theory1, theory2, withLoss, calc };
}

/**
 * 치수 기반 BOM 자동 산출
 * RPT_20260121 구조DB + RPT_20260204 차열시트재단BOM 공식 기반
 * 관통부 가로(W) × 세로(H), 소켓 수(N) 기준으로 모든 자재 소요량 계산
 */
function calculateStructureBom(d: DimParams): BomLine[] {
  const lines: BomLine[] = [];
  const perimeter = calculatePerimeter(d.W, d.H);
  const isWall = d.installPos === '수직벽체';
  const isFloor = !isWall;
  const is0910 = d.certVersion === '0910' || d.certVersion?.startsWith('09');
  const is0310 = !is0910;

  // 구조코드별 특성 판별 (인정서 3.3 기준)
  const sc = d.structureCode || '';
  const isVAG = sc === 'VAG-1.69';
  const isHTG169 = sc === 'HTG-1.69';
  const isHAG169 = sc === 'HAG-1.69';
  const isHTG064 = sc === 'HTG-064';
  const isHTGDC = sc === 'HTG(DC)-064';
  const isVTI = sc === 'VTI-064';
  // 틈새복합시트 해당 구조
  const hasGapSheet = isHTG169 || isHTG064 || isHAG169 || isVTI;
  // 고정자재 해당 구조: VTI-064 제외
  const hasFixingPlate = isHTG169 || isHTG064 || isHAG169;
  // 소켓 외부 세라믹블랭킷 없는 구조: HTG(DC)-064, VTI-064
  const noSocketCeramic = isHTGDC || isVTI;

  // 차열시트 규격 결정: 0310→5mm/W190~195, 0910→4mm/W185~255
  let sheetW: number;      // 차열시트 가로(너비)
  let sheetT: number;      // 차열시트 두께
  if (isFloor && is0910) {
    sheetW = 255; sheetT = 4.0;  // 입상형 0910: 4T, W255
  } else if (isWall && is0910) {
    sheetW = 185; sheetT = 4.0;  // 벽체형 0910: 4T, W185
  } else if (isWall && d.N >= 2 && is0310) {
    sheetW = 195; sheetT = 5.0;  // 벽체 대형 0310 (VT-01): 5T, W195
  } else {
    sheetW = 190; sheetT = 5.0;  // 벽체 소형 0310: 5T, W190
  }
  // 사용자 입력 두께가 있으면 우선
  if (d.sheetThickness && d.sheetThickness > 0) sheetT = d.sheetThickness;

  // ── 1. 금속소켓 본체 (완제품) ──
  // VTI-064: 높이 230mm, 두께 1.2mm (인정서 3.3 기준)
  // 기타 벽체: 200mm, 바닥: 300mm, 두께 공통 1.6mm
  const socketH = isVTI ? 230 : isFloor ? 300 : 200;
  const socketT = isVTI ? 1.2 : 1.6;
  lines.push({
    component: '금속소켓 본체',
    item_code: '__FP_SOCKET__',
    qty: d.N,
    unit: 'EA',
    length_mm: d.W,
    width_mm: d.H,
    spec: `아연도금강판 t${socketT}, ${Math.floor(d.W/d.N)}×${d.H}×${socketH}`,
    calc: `소켓 수량 = ${d.N}개`,
  });

  // ── 2. 차열시트 (내부) ──
  // 공식: 벽체_DB원본 기준
  // N=1 벽체: 내부(상하) L=[W]-5, qty=4 | 내부(좌우) L=[H]-30, qty=4
  // N=2 벽체 0310(VT-01): 내부(상하) L=[W]/2-15, qty=8 | 내부(좌우) L=[H]/2-20, qty=16 | 내부(중앙) L=[W]/2-15, qty=8
  // N=2 벽체 0910(VAG): 내부(상하) L=[W]/2-35, qty=12 | 내부(중앙) L=[W]/2-35, qty=2
  // 바닥: 내부 L=[W]-5, qty=6, W=255 (HTG(DC)-064 등)
  let totalSheetEA = 0;
  let totalSheetM = 0;

  if (isWall && d.N === 1) {
    // 벽체 소형 (VA-064, VT-064, VT-049, VTI-064)
    const innerTBL = d.W - 5;
    const innerTBQty = 4;
    const innerLRL = d.H - 30;
    const innerLRQty = 4;
    lines.push({
      component: '차열시트 내부(상하)', item_code: 'SA-CUT-SK', qty: innerTBQty, unit: 'EA',
      length_mm: innerTBL, width_mm: sheetW,
      spec: `밀도1.2g/cm³, 두께${sheetT}mm, ${sheetW}×${innerTBL}`,
      calc: `상하4EA, L=[W]-5=${d.W}-5=${innerTBL}mm`,
    });
    lines.push({
      component: '차열시트 내부(좌우)', item_code: 'SA-CUT-SK', qty: innerLRQty, unit: 'EA',
      length_mm: innerLRL, width_mm: sheetW,
      spec: `밀도1.2g/cm³, 두께${sheetT}mm, ${sheetW}×${innerLRL}`,
      calc: `좌우4EA, L=[H]-30=${d.H}-30=${innerLRL}mm`,
    });
    totalSheetEA += innerTBQty + innerLRQty;
    totalSheetM += (innerTBQty * innerTBL + innerLRQty * innerLRL) / 1000;
  } else if (isWall && d.N >= 2 && is0310) {
    // 벽체 대형 0310 (VT-01): 받침대+상하+좌우+중앙
    const innerTBL = Math.floor(d.W / 2) - 15;
    const innerLRL = Math.floor(d.H / 2) - 20;
    lines.push({
      component: '차열시트 내부(상하)', item_code: 'SA-CUT-SK', qty: 8, unit: 'EA',
      length_mm: innerTBL, width_mm: sheetW,
      spec: `밀도1.2g/cm³, 두께${sheetT}mm, ${sheetW}×${innerTBL}`,
      calc: `상하8EA, L=[W]/2-15=${Math.floor(d.W/2)}-15=${innerTBL}mm`,
    });
    lines.push({
      component: '차열시트 내부(좌우)', item_code: 'SA-CUT-SK', qty: 16, unit: 'EA',
      length_mm: innerLRL, width_mm: sheetW,
      spec: `밀도1.2g/cm³, 두께${sheetT}mm, ${sheetW}×${innerLRL}`,
      calc: `좌우16EA, L=[H]/2-20=${Math.floor(d.H/2)}-20=${innerLRL}mm`,
    });
    lines.push({
      component: '차열시트 내부(중앙)', item_code: 'SA-CUT-SK', qty: 8, unit: 'EA',
      length_mm: innerTBL, width_mm: sheetW,
      spec: `밀도1.2g/cm³, 두께${sheetT}mm, ${sheetW}×${innerTBL}`,
      calc: `중앙8EA, L=[W]/2-15=${innerTBL}mm`,
    });
    totalSheetEA += 8 + 16 + 8;
    totalSheetM += (8 * innerTBL + 16 * innerLRL + 8 * innerTBL) / 1000;
  } else if (isWall && d.N >= 2 && is0910) {
    // 벽체 대형 0910 (VAG-1.69): 상하+중앙
    const innerL = Math.floor(d.W / 2) - 35;
    lines.push({
      component: '차열시트 내부(상하)', item_code: 'SA-CUT-SK', qty: 12, unit: 'EA',
      length_mm: innerL, width_mm: sheetW,
      spec: `밀도1.2g/cm³, 두께${sheetT}mm, ${sheetW}×${innerL}`,
      calc: `상하12EA (상하6+중앙6), L=[W]/2-35=${Math.floor(d.W/2)}-35=${innerL}mm`,
    });
    lines.push({
      component: '차열시트 내부(중앙)', item_code: 'SA-CUT-SK', qty: 2, unit: 'EA',
      length_mm: innerL, width_mm: sheetW,
      spec: `밀도1.2g/cm³, 두께${sheetT}mm, ${sheetW}×${innerL}`,
      calc: `중앙2EA, L=[W]/2-35=${innerL}mm`,
    });
    totalSheetEA += 14;
    totalSheetM += (14 * innerL) / 1000;
  } else if (isFloor) {
    // 바닥형: 내부 차열시트
    const innerL = d.W - 5;
    const innerQty = d.N >= 2 ? (6 + 8) : 6;  // HTG-1.69(2소켓):14, 기타:6
    lines.push({
      component: '차열시트 내부', item_code: 'SA-CUT-SK', qty: innerQty, unit: 'EA',
      length_mm: innerL, width_mm: sheetW,
      spec: `밀도1.2g/cm³, 두께${sheetT}mm, ${sheetW}×${innerL}`,
      calc: `내부${innerQty}EA, L=[W]-5=${d.W}-5=${innerL}mm`,
    });
    totalSheetEA += innerQty;
    totalSheetM += (innerQty * innerL) / 1000;
  }

  // ── 3. 차열시트 (외부) ── (벽체만 해당, 바닥 일부 구조)
  if (isWall) {
    let outerTBL: number, outerLRL: number, outerTBQty: number, outerLRQty: number;
    if (d.N >= 2 && is0910) {
      // VAG-1.69: 외부(상하) L=[W]/2+30, qty=4 | 외부(좌우) L=[H], qty=4
      outerTBL = Math.floor(d.W / 2) + 30;
      outerLRL = d.H;
      outerTBQty = 4; outerLRQty = 4;
    } else if (d.N >= 2 && is0310) {
      // VT-01: 외부(상하) L=[W]+60, qty=4 | 외부(좌우) L=[H], qty=4
      outerTBL = d.W + 60;
      outerLRL = d.H;
      outerTBQty = 4; outerLRQty = 4;
    } else {
      // 소형 N=1: 외부(상하) L=[W]+60, qty=2 | 외부(좌우) L=[H], qty=2
      outerTBL = d.W + 60;
      outerLRL = d.H;
      outerTBQty = 2; outerLRQty = 2;
    }
    lines.push({
      component: '차열시트 외부(상하)', item_code: 'SA-CUT-SK', qty: outerTBQty, unit: 'EA',
      length_mm: outerTBL, width_mm: sheetW,
      spec: `밀도1.2g/cm³, 두께${sheetT}mm, ${sheetW}×${outerTBL}`,
      calc: `외부상하${outerTBQty}EA, L=${outerTBL}mm`,
    });
    lines.push({
      component: '차열시트 외부(좌우)', item_code: 'SA-CUT-SK', qty: outerLRQty, unit: 'EA',
      length_mm: outerLRL, width_mm: sheetW,
      spec: `밀도1.2g/cm³, 두께${sheetT}mm, ${sheetW}×${outerLRL}`,
      calc: `외부좌우${outerLRQty}EA, L=${outerLRL}mm`,
    });
    totalSheetEA += outerTBQty + outerLRQty;
    totalSheetM += (outerTBQty * outerTBL + outerLRQty * outerLRL) / 1000;
  }

  // 차열시트 총 길이(M) 요약 추가
  totalSheetM = Math.round(totalSheetM * 100) / 100;

  // ── 4. 소켓 차열시트 고정용 브라켓 ──
  // 인정서 3.3 기준: 브라켓은 소켓에 차열시트를 잡아주는 전용 부품
  // 상/하 브라켓: H15×W190×L1265, t0.6이상, SGCC
  // 중앙 브라켓: H10×W190×L1265, t0.6이상, SGCC (N≥2 대형소켓만)
  // 수량: 소켓 내부구조에 따라 — 상하 각면에 2~4EA, 중앙 2~4EA
  {
    // 상/하 브라켓: 소켓당 상면2+하면2 = 4EA (N=1), 대형(N=2): 소켓당 4EA
    const brkTBPerSocket = 4;
    const brkTBQty = d.N * brkTBPerSocket;
    lines.push({
      component: '소켓 브라켓(상/하)',
      item_code: 'SM-BRK-TB',
      qty: brkTBQty,
      unit: 'EA',
      spec: `SGCC, H15×W190×L1265, t0.6이상`,
      calc: `소켓 ${d.N}개 × 상하${brkTBPerSocket}EA/소켓 = ${brkTBQty}EA`,
    });

    // 중앙 브라켓: 대형(N≥2) 소켓에만 해당 (VT-01, VS-01, VAG-1.69, HTG-1.69, HAG-1.69)
    if (d.N >= 2) {
      const brkMDPerSocket = 2;  // 중앙 브라켓 2EA/소켓
      const brkMDQty = d.N * brkMDPerSocket;
      lines.push({
        component: '소켓 브라켓(중앙)',
        item_code: 'SM-BRK-MD',
        qty: brkMDQty,
        unit: 'EA',
        spec: `SGCC, H10×W190×L1265, t0.6이상`,
        calc: `소켓 ${d.N}개 × 중앙${brkMDPerSocket}EA/소켓 = ${brkMDQty}EA`,
      });
    }
  }

  // ── 5. 세라믹블랭킷 (소켓 외부, 25T) ──
  // HTG(DC)-064, VTI-064: 인정서에 소켓 외부 세라믹블랭킷 없음
  // 인정기준 최소밀도(cw_density_min)에 따라 발주 제품 결정:
  //   cw_density_min ≥ 120 → SM-CW-128 (128K) 적용 (0310 구조: VA-064, VT-01 등)
  //   cw_density_min < 120 → SM-CW-96 (96K) 적용 (0910 구조: HTG-1.69 등)
  // 폭: 벽체 200mm, 바닥형(0910) 300mm
  const cbWidth = is0910 && isFloor ? 300 : 200;
  const cbMinDensity = d.cwDensityMin || 96;
  // 블랭킷 item_code: 밀도 + 폭(벽체200/바닥300)에 따라 분리
  const cbItemCode = cbMinDensity >= 120
    ? 'SM-CW-128-25'
    : (cbWidth >= 300 ? 'SM-CW-96-25W3' : 'SM-CW-96-25W2');
  const cbDensity = cbMinDensity >= 120 ? 128 : 96;
  const cbDensitySpec = `밀도${cbDensity}kg/m³(기준≥${cbMinDensity})`;

  if (noSocketCeramic) {
    // HTG(DC)-064, VTI-064: 소켓 외부 세라믹블랭킷 없음 — skip
  } else if (isWall && d.N === 1) {
    // 소형 벽체: 상하2+좌우2
    const cbTBL = d.W + 60;
    const cbLRL = d.H;
    const cbTBM = Math.round(2 * cbTBL / 1000 * 100) / 100;
    const cbLRM = Math.round(2 * cbLRL / 1000 * 100) / 100;
    const cbTotalM = Math.round((cbTBM + cbLRM) * 100) / 100;
    lines.push({
      component: '세라믹블랭킷(상하)', item_code: cbItemCode, qty: cbTBM, unit: 'M',
      length_mm: cbTBL, width_mm: cbWidth,
      spec: `${cbDensitySpec}, 두께25mm, W${cbWidth}, L${cbTBL}`,
      calc: `상하2EA × ${cbTBL}mm ÷ 1000 = ${cbTBM}M`,
    });
    lines.push({
      component: '세라믹블랭킷(좌우)', item_code: cbItemCode, qty: cbLRM, unit: 'M',
      length_mm: cbLRL, width_mm: cbWidth,
      spec: `${cbDensitySpec}, 두께25mm, W${cbWidth}, L${cbLRL}`,
      calc: `좌우2EA × ${cbLRL}mm ÷ 1000 = ${cbLRM}M`,
    });
  } else if (isWall && d.N >= 2) {
    // 대형 벽체(VAG, VT-01): 상하2+좌우2
    const cbTBL = is0910 ? Math.floor(d.W / 2) + 30 : d.W + 60;
    const cbLRL = d.H;
    const cbTBM = Math.round(2 * cbTBL / 1000 * 100) / 100;
    const cbLRM = Math.round(2 * cbLRL / 1000 * 100) / 100;
    lines.push({
      component: '세라믹블랭킷(상하)', item_code: cbItemCode, qty: cbTBM, unit: 'M',
      length_mm: cbTBL, width_mm: cbWidth,
      spec: `${cbDensitySpec}, 두께25mm, W${cbWidth}, L${cbTBL}`,
      calc: `상하2EA × ${cbTBL}mm ÷ 1000 = ${cbTBM}M`,
    });
    lines.push({
      component: '세라믹블랭킷(좌우)', item_code: cbItemCode, qty: cbLRM, unit: 'M',
      length_mm: cbLRL, width_mm: cbWidth,
      spec: `${cbDensitySpec}, 두께25mm, W${cbWidth}, L${cbLRL}`,
      calc: `좌우2EA × ${cbLRL}mm ÷ 1000 = ${cbLRM}M`,
    });
  } else if (isFloor) {
    // 바닥형: HTG-1.69, HTG-064에서 세라믹블랭킷 사용 (300W)
    const cbTBL = d.W + 60;
    const cbLRL = d.H;
    const cbTBM = Math.round(2 * cbTBL / 1000 * 100) / 100;
    const cbLRM = Math.round(2 * cbLRL / 1000 * 100) / 100;
    lines.push({
      component: '세라믹블랭킷(상하)', item_code: cbItemCode, qty: cbTBM, unit: 'M',
      length_mm: cbTBL, width_mm: cbWidth,
      spec: `${cbDensitySpec}, 두께25mm, W${cbWidth}, L${cbTBL}`,
      calc: `상하2EA × ${cbTBL}mm ÷ 1000 = ${cbTBM}M`,
    });
    lines.push({
      component: '세라믹블랭킷(좌우)', item_code: cbItemCode, qty: cbLRM, unit: 'M',
      length_mm: cbLRL, width_mm: cbWidth,
      spec: `${cbDensitySpec}, 두께25mm, W${cbWidth}, L${cbLRL}`,
      calc: `좌우2EA × ${cbLRL}mm ÷ 1000 = ${cbLRM}M`,
    });
  }

  // ── 6. 방화플래싱 ──
  // REV-008 교차검증 기준 (RPT-005 산정기준_벽체)
  // 벽체: 1면둘레 = (W+250)×2 + H×2, 양면 ×2, 로스 적용, 올림
  // 바닥: Z형 ROUNDUP(둘레÷1000)×2, L형(DC) ROUNDUP(둘레÷1000)
  const lossRate = d.lossRate ?? 10;  // 기본 10% (최적재단)
  const plus60 = d.flashingPlus60 ?? false;

  // 방화플래싱 형식 결정 (인정서 3.3 기준)
  // I형(FP-FL-I, W125): 0310 벽체, VAG-1.69, VTI-064, HAG-1.69
  // Z형(FP-FL-Z, W170): HTG-1.69, HTG-064
  // L형(FP-FL-L, W75+H50): HTG(DC)-064
  const isDC = d.structureCode?.includes('DC');
  const isZtype = d.structureCode === 'HTG-1.69' || d.structureCode === 'HTG-064';

  // 플래싱 구성자재 분해 헬퍼: 완제품(FP) + 강판(SM) + 차열시트(SA)
  // ※ 피스(#8×64mm)는 소모자재로 자재관리 대상 아님
  function addFlashingComponents(flashQty: number, type: 'I' | 'Z' | 'L', flashWidth: number) {
    // 강판 코드: I→SM-GI-I-10(L1000), Z→SM-GI-Z-10, L→SM-GI-L-10
    // 추후 -05(L500), -15(L1500) 등 길이별 코드 확장 예정
    const steelCode = `SM-GI-${type}-10`;
    const steelWidth = type === 'I' ? 125 : type === 'Z' ? 170 : 75;
    lines.push({
      component: `플래싱용 아연도금강판(${type}형)`,
      item_code: steelCode,
      qty: flashQty, unit: 'EA',
      length_mm: 1000, width_mm: steelWidth,
      spec: `아연도금강판 SGCC(KS D 3506), t0.5, W${steelWidth}, L1000`,
      calc: `플래싱 ${flashQty}세트 × 강판1장/세트 = ${flashQty}장`,
    });

    // 차열시트 (플래싱용, 자체제조 → 역전개 대상)
    lines.push({
      component: `플래싱용 차열시트(${type}형)`,
      item_code: 'SA-CUT-FL',
      qty: flashQty, unit: 'EA',
      length_mm: 1000, width_mm: steelWidth,
      spec: `밀도1.2g/cm³, t${sheetT}mm, W${steelWidth}, L1000`,
      calc: `플래싱 ${flashQty}세트 × 차열시트1장/세트 = ${flashQty}장`,
    });
  }

  if (isWall) {
    // 벽체: I형 — REV-008 기본원칙
    const flash = calcFlashingWall(d.W, d.H, plus60, lossRate);
    lines.push({
      component: '방화플래싱(I형)', item_code: 'FP-FL-I', qty: flash.qty, unit: 'EA',
      length_mm: 1000, width_mm: 125,
      spec: `강판0.5t + 차열시트${sheetT}t, W125, L1000, 양면시공`,
      calc: flash.calc,
    });
    addFlashingComponents(flash.qty, 'I', 125);
  } else if (isDC) {
    // HTG(DC)-064: L형 — 1면만
    const theoryQty = Math.ceil(perimeter / 1000);
    const withLoss = Math.ceil(theoryQty * (1 + lossRate / 100));
    lines.push({
      component: '방화플래싱(L형)', item_code: 'FP-FL-L', qty: withLoss, unit: 'EA',
      length_mm: 1000, width_mm: 75,
      spec: `강판0.5t + 차열시트${sheetT}t, W75+H50, L1000`,
      calc: `L형: 둘레${perimeter}÷1000=ROUNDUP→${theoryQty}EA × 로스${lossRate}% = ${withLoss}EA`,
    });
    addFlashingComponents(withLoss, 'L', 75);
  } else if (isZtype) {
    // HTG-1.69, HTG-064: Z형 — 양면
    const theoryQty = Math.ceil(perimeter / 1000) * 2;
    const withLoss = Math.ceil(theoryQty * (1 + lossRate / 100));
    lines.push({
      component: '방화플래싱(Z형)', item_code: 'FP-FL-Z', qty: withLoss, unit: 'EA',
      length_mm: 1000, width_mm: 170,
      spec: `강판0.5t + 차열시트${sheetT}t, W170, L1000`,
      calc: `Z형: 둘레${perimeter}÷1000=ROUNDUP→${Math.ceil(perimeter/1000)} × 양면2 = ${theoryQty}EA × 로스${lossRate}% = ${withLoss}EA`,
    });
    addFlashingComponents(withLoss, 'Z', 170);
  } else {
    // HAG-1.69, VTI-064 등 기타 바닥형: I형 — 양면
    const theoryQty = Math.ceil(perimeter / 1000) * 2;
    const withLoss = Math.ceil(theoryQty * (1 + lossRate / 100));
    lines.push({
      component: '방화플래싱(I형)', item_code: 'FP-FL-I', qty: withLoss, unit: 'EA',
      length_mm: 1000, width_mm: 125,
      spec: `강판0.5t + 차열시트${sheetT}t, W125, L1000`,
      calc: `I형: 둘레${perimeter}÷1000=ROUNDUP→${Math.ceil(perimeter/1000)} × 양면2 = ${theoryQty}EA × 로스${lossRate}% = ${withLoss}EA`,
    });
    addFlashingComponents(withLoss, 'I', 125);
  }

  // ── 8. 그라스울 덕트보온재 ──
  // VAG-1.69: 인정서에 그라스울 없음 (세라믹만 사용)
  // 나머지: (관통재W + 관통재H) × 2 × 4면 ÷ 1000 ÷ 롤폭1.4 = M
  if (!isVAG) {
    const gwDuctM = Math.round((d.W + d.H) * 2 * 4 / 1000 / 1.4 * 100) / 100;
    lines.push({
      component: '그라스울 덕트보온재(24K)', item_code: 'SM-GW-24-14', qty: gwDuctM, unit: 'M',
      spec: `밀도24kg/m³, 두께25mm, W1400(롤폭)`,
      calc: `(${d.W}+${d.H})×2×4면÷1000÷1.4=${gwDuctM}M`,
    });
  }

  // ── 9. 지지구조 주변단열재 ──
  // 인정서별 단열재 구성이 다름:
  //   VAG-1.69: 세라믹 only (50mm, 96K, 전체보온)
  //   VT-01: 세라믹1단(50mm, W600) + 그라스울2단(W1400)
  //   VT-049: 그라스울1단(W1400) + 그라스울2단(W1000) — 세라믹 없음
  //   VA-064, VT-064: 세라믹1단(50mm) + 그라스울2단(W1400)
  //   HTG-1.69, HAG-1.69: 그라스울1단 + 세라믹 3단(38mm각)
  //   HTG-064, HTG(DC)-064: 그라스울1단(W1400) + 세라믹2단(50mm, W600)
  //   VTI-064: 그라스울1단(W1000, 양면대칭) x2 + 세라믹2단(50mm, W600)

  if (isVAG) {
    // VAG-1.69: 세라믹만 사용, 그라스울 없음
    const cwSupportM = Math.round(d.W * 4 / 1000 / 0.6 * 100) / 100;
    lines.push({
      component: '지지구조 세라믹차열재(96K)', item_code: 'SM-CW-96-50', qty: cwSupportM, unit: 'M',
      spec: `밀도96kg/m³, 두께50mm, W600, 전체보온`,
      calc: `배관길이${d.W}mm × 4면 ÷ 1000 ÷ 0.6(롤폭) = ${cwSupportM}M`,
    });
  } else if (isWall) {
    // 벽체(VT-01, VA-064, VT-064): 세라믹1단 + 그라스울2단
    // VT-049: 그라스울만 (세라믹 없음) — 현재 구조코드로 분기
    const isVT049 = sc === 'VT-049';
    if (isVT049) {
      // VT-049: 그라스울1단(W1400) + 그라스울2단(W1000) — 세라믹 없음
      const gw1M = Math.round(d.W * 4 / 1000 / 1.4 * 100) / 100;
      const gw2M = Math.round(d.W * 4 / 1000 / 1.0 * 100) / 100;
      lines.push({
        component: '지지구조 그라스울1단(24K)', item_code: 'SM-GW-24-14', qty: gw1M, unit: 'M',
        spec: `밀도24kg/m³, 두께25mm, W1400, 양면대칭`,
        calc: `${d.W}mm×4면÷1000÷1.4=${gw1M}M`,
      });
      lines.push({
        component: '지지구조 그라스울2단(24K)', item_code: 'SM-GW-24-10', qty: gw2M, unit: 'M',
        spec: `밀도24kg/m³, 두께25mm, W1000, 양면대칭`,
        calc: `${d.W}mm×4면÷1000÷1.0=${gw2M}M`,
      });
    } else {
      // VT-01, VA-064, VT-064: 세라믹1단(50mm) + 그라스울2단(W1400)
      const cwSupportM = Math.round(d.W * 4 / 1000 / 0.6 * 100) / 100;
      const gwSupportM = Math.round(d.W * 4 / 1000 / 1.4 * 100) / 100;
      lines.push({
        component: '지지구조 세라믹차열재1단(96K)', item_code: 'SM-CW-96-50', qty: cwSupportM, unit: 'M',
        spec: `밀도96kg/m³, 두께50mm, W600, 양면대칭`,
        calc: `배관길이${d.W}mm × 4면 ÷ 1000 ÷ 0.6(롤폭) = ${cwSupportM}M`,
      });
      lines.push({
        component: '지지구조 그라스울2단(24K)', item_code: 'SM-GW-24-14', qty: gwSupportM, unit: 'M',
        spec: `밀도24kg/m³, 두께25mm, W1400, 양면대칭`,
        calc: `${d.W}mm×4면÷1000÷1.4=${gwSupportM}M`,
      });
    }
  } else if (isHTG169 || isHAG169) {
    // HTG-1.69, HAG-1.69: 그라스울1단 + 세라믹 3단(38mm각)
    const gw1M = Math.round(d.W * 4 / 1000 / 1.4 * 100) / 100;
    lines.push({
      component: '지지구조 그라스울1단(24K)', item_code: 'SM-GW-24-14', qty: gw1M, unit: 'M',
      spec: `밀도24kg/m³, 두께25mm, W1400`,
      calc: `${d.W}mm×4면÷1000÷1.4=${gw1M}M`,
    });
    // 3단 세라믹차열재 (38mm × 3 = 114mm)
    const cwPerLayer = Math.round(d.W * 4 / 1000 / 0.6 * 100) / 100;
    for (let layer = 1; layer <= 3; layer++) {
      lines.push({
        component: `지지구조 세라믹차열재${layer + 1}단(96K)`, item_code: 'SM-CW-96-38', qty: cwPerLayer, unit: 'M',
        spec: `밀도96kg/m³, 두께38mm, W600`,
        calc: `${d.W}mm×4면÷1000÷0.6=${cwPerLayer}M (${layer + 1}단)`,
      });
    }
  } else if (isVTI) {
    // VTI-064: 그라스울1단(W1000, 양면대칭) x2 + 세라믹2단(50mm, W600)
    const gw1M = Math.round(d.W * 4 / 1000 / 1.0 * 2 * 100) / 100;
    lines.push({
      component: '지지구조 그라스울1단(24K)', item_code: 'SM-GW-24-10', qty: gw1M, unit: 'M',
      spec: `밀도24kg/m³, 두께25mm, W1000, 양면대칭 x2`,
      calc: `${d.W}mm×4면÷1000÷1.0×양면2=${gw1M}M`,
    });
    const cwSupport2M = Math.round(d.W * 4 / 1000 / 0.6 * 100) / 100;
    lines.push({
      component: '지지구조 세라믹차열재2단(96K)', item_code: 'SM-CW-96-50', qty: cwSupport2M, unit: 'M',
      spec: `밀도96kg/m³, 두께50mm, W600, 양면대칭`,
      calc: `${d.W}mm×4면÷1000÷0.6=${cwSupport2M}M`,
    });
  } else {
    // 기타 바닥형 (HTG-064, HTG(DC)-064): 그라스울1단(W1400) + 세라믹2단(50mm, W600)
    lines.push({
      component: '지지구조 그라스울1단(24K)', item_code: 'SM-GW-24-14',
      qty: Math.round(d.W * 4 / 1000 / 1.4 * 100) / 100, unit: 'M',
      spec: `밀도24kg/m³, 두께25mm, W1400`,
      calc: `${d.W}mm×4면÷1000÷1.4=${Math.round(d.W * 4 / 1000 / 1.4 * 100) / 100}M`,
    });
    const cwSupport2M = Math.round(d.W * 4 / 1000 / 0.6 * 100) / 100;
    lines.push({
      component: '지지구조 세라믹차열재2단(96K)', item_code: 'SM-CW-96-50', qty: cwSupport2M, unit: 'M',
      spec: `밀도96kg/m³, 두께50mm, W600`,
      calc: `${d.W}mm×4면÷1000÷0.6=${cwSupport2M}M`,
    });
  }

  // ── 10. 실란트 ── (0310 구조만 해당: VA-064, VT-01, VT-049, VT-064)
  // 0910 구조(VAG-1.69, HTG-1.69 등)는 인정서에 실란트 없음
  if (is0310) {
    const sealantQty = Math.ceil(perimeter / 3000) * d.N;
    lines.push({
      component: '실리콘 실란트', item_code: 'SM-SIL', qty: sealantQty, unit: 'EA',
      spec: `KS F 4910 F-12.5E, t3이상, 오버랩3이상`,
      calc: `둘레${perimeter}mm ÷ 3000mm/EA × ${d.N}소켓 = ${sealantQty}EA`,
    });
  }

  // ── 11. 틈새복합시트 + 고정자재 ──
  // 인정서 3.3 기준:
  //   HTG-1.69, HTG-064: 200H (W185 차열시트 + W200 세라믹 + 고정자재 H200)
  //   HAG-1.69: 150H (W125 차열시트 + W150 세라믹 + 고정자재 H125)
  //   VTI-064: 150H (W125 차열시트 + W150 세라믹, 고정자재 없음)
  if (hasGapSheet) {
    const is200H = isHTG169 || isHTG064;
    const gapH = is200H ? 200 : 150;
    const gapSheetQty = Math.ceil(perimeter / 1000) * 2;  // 양면
    lines.push({
      component: `틈새복합시트(${gapH}H)`, item_code: 'FP-GAP-SH', qty: gapSheetQty, unit: 'EA',
      spec: `${gapH}×1000, 차열시트+세라믹블랭킷`,
      calc: `둘레${perimeter}÷1000=ROUNDUP→${Math.ceil(perimeter/1000)} × 양면2 = ${gapSheetQty}EA`,
    });

    // 고정자재: HAG-1.69, HTG-1.69, HTG-064만 해당 (VTI-064는 인정서에 고정자재 없음)
    if (hasFixingPlate) {
      const fixH = is200H ? 200 : 125;  // HAG-1.69: H125, HTG: H200
      lines.push({
        component: '고정자재(틈새시트 이탈방지)', item_code: 'SM-GP-10', qty: gapSheetQty, unit: 'EA',
        spec: `아연도금강판 SGCC, L1000×H${fixH}×t0.5`,
        calc: `틈새복합시트 ${gapSheetQty}EA × 1:1 = ${gapSheetQty}EA`,
      });
    }
  }
  // 0310 벽체, VAG-1.69, HTG(DC)-064: 틈새복합시트/고정자재 해당없음

  // 방화댐퍼, C-BAR, 직결피스, 보온핀: 인정서 3.2 구성재료이나 이지원 자재관리 범위 외 (현장 설치자재)

  return lines;
}

/** item_code → item_id 매핑 (캐시) */
async function getItemMap(): Promise<Map<string, { item_id: number; item_name: string; item_category: string; unit: string }>> {
  const { rows } = await pool.query(`SELECT item_id, item_code, item_name, item_category, unit FROM item_master WHERE is_active = true`);
  const map = new Map();
  for (const r of rows) map.set(r.item_code, r);
  return map;
}

/** 구조코드 → 완제품 item_code 매핑 */
function structureToFPCode(structureCode: string): string {
  const map: Record<string, string> = {
    'VT-01': 'FP-VT01', 'VS-01': 'FP-VS01', 'VT-049': 'FP-VT049', 'VA-064': 'FP-VA064',
    'VT-064': 'FP-VT064', 'VAG-1.69': 'FP-VAG169', 'VTI-064': 'FP-VTI064',
    'HAG-1.69': 'FP-HTG169', 'HTG-1.69': 'FP-HTG169', 'HTG-064': 'FP-HTG064',
    'HTG(DC)-064': 'FP-HTGDC064',
  };
  return map[structureCode] || 'FP-STR';
}

// ═══════════════════════════════════════════════

export async function orderRoutes(app: FastifyInstance) {
  // await migrateOrderTables();

  // ─── work_order 컬럼 폭 확장 마이그레이션 ───
  try { await pool.query(`ALTER TABLE work_order ALTER COLUMN wo_number TYPE VARCHAR(50)`); } catch {}
  try { await pool.query(`ALTER TABLE work_order ALTER COLUMN product_type TYPE VARCHAR(50)`); } catch {}

  // ────── 수주 CRUD ──────

  app.get('/api/orders', async (req) => {
    const { status } = req.query as { status?: string };
    let sql = `
      SELECT o.*,
        (SELECT COUNT(*) FROM sales_order_item si WHERE si.order_id = o.order_id) AS item_count,
        (SELECT COALESCE(SUM(si.qty), 0) FROM sales_order_item si WHERE si.order_id = o.order_id) AS total_qty
      FROM sales_order o
    `;
    const params: unknown[] = [];
    if (status) { sql += ` WHERE o.status = $1`; params.push(status); }
    sql += ` ORDER BY o.order_date DESC, o.order_id DESC`;
    const { rows } = await pool.query(sql, params);
    return { data: rows };
  });

  app.get('/api/orders/:id', async (req) => {
    const { id } = req.params as { id: string };
    const order = await pool.query(`SELECT * FROM sales_order WHERE order_id = $1`, [id]);
    if (order.rows.length === 0) return { error: '수주를 찾을 수 없습니다' };

    const items = await pool.query(`
      SELECT si.*, cm.structure_name, cm.structure_code AS cert_structure_code,
             cm.product_group, cm.install_position, cm.socket_name,
             cm.opening_w_mm AS default_ow, cm.opening_h_mm AS default_oh,
             cm.penetration_w_mm AS default_pw, cm.penetration_h_mm AS default_ph,
             cm.install_qty
      FROM sales_order_item si
      JOIN certification_master cm ON cm.cert_id = si.cert_id
      WHERE si.order_id = $1
      ORDER BY si.sort_order
    `, [id]);

    const bomResults = await pool.query(`
      SELECT obr.*, im.roll_length_m, im.roll_spec
      FROM order_bom_result obr
      LEFT JOIN item_master im ON im.item_id = obr.item_id
      WHERE obr.order_id = $1 ORDER BY obr.item_category, obr.item_code
    `, [id]);

    return {
      data: {
        ...order.rows[0],
        items: items.rows,
        bom_results: bomResults.rows,
      },
    };
  });

  app.post('/api/orders', async (req) => {
    const body = req.body as any;
    const { order_date, customer_name, project_name, delivery_date, remarks, items } = body;

    const dateStr = (order_date || new Date().toISOString().slice(0, 10)).replace(/-/g, '').slice(2);
    const seqRes = await pool.query(
      `SELECT COUNT(*) + 1 AS seq FROM sales_order WHERE order_number LIKE $1`,
      [`SO-${dateStr}-%`]
    );
    const seq = String(seqRes.rows[0].seq).padStart(3, '0');
    const orderNumber = `SO-${dateStr}-${seq}`;
    const totalSets = items?.reduce((s: number, i: any) => s + (i.qty || 1), 0) || 0;

    const result = await pool.query(`
      INSERT INTO sales_order (order_number, order_date, customer_name, project_name, delivery_date, remarks, total_sets)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [orderNumber, order_date, customer_name, project_name || null, delivery_date || null, remarks || null, totalSets]);

    const orderId = result.rows[0].order_id;

    if (items && Array.isArray(items)) {
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        // 치수: 사용자 입력 또는 인정구조 기본값
        await pool.query(`
          INSERT INTO sales_order_item (order_id, cert_id, structure_code, qty,
            opening_w_mm, opening_h_mm, penetration_w_mm, penetration_h_mm, spec_note, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          orderId, item.cert_id, item.structure_code, item.qty || 1,
          item.opening_w_mm || null, item.opening_h_mm || null,
          item.penetration_w_mm || null, item.penetration_h_mm || null,
          item.spec_note || null, idx,
        ]);
      }
    }

    return { data: result.rows[0] };
  });

  app.patch('/api/orders/:id/status', async (req) => {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: string };
    const { rows } = await pool.query(`UPDATE sales_order SET status = $1 WHERE order_id = $2 RETURNING *`, [status, id]);
    return { data: rows[0] };
  });

  app.delete('/api/orders/:id', async (req) => {
    const { id } = req.params as { id: string };
    const orderId = parseInt(id, 10);

    // CASCADE: 연관 데이터 모두 삭제
    // 1) work_order를 참조하는 자식 테이블 먼저 삭제 (process_issue, defect_record, loss_record)
    await pool.query(`DELETE FROM process_issue WHERE wo_id IN (SELECT wo_id FROM work_order WHERE order_id = $1)`, [orderId]);
    await pool.query(`DELETE FROM defect_record WHERE wo_id IN (SELECT wo_id FROM work_order WHERE order_id = $1)`, [orderId]);
    await pool.query(`DELETE FROM loss_record WHERE wo_id IN (SELECT wo_id FROM work_order WHERE order_id = $1)`, [orderId]);
    // 2) work_order 삭제
    await pool.query(`DELETE FROM work_order WHERE order_id = $1`, [orderId]);
    // 3) 발주서 (purchase_request_item → purchase_request)
    await pool.query(`DELETE FROM purchase_request_item WHERE pr_id IN (SELECT pr_id FROM purchase_request WHERE order_id = $1)`, [orderId]);
    await pool.query(`DELETE FROM purchase_request WHERE order_id = $1`, [orderId]);
    // 4) BOM 결과 → 수주아이템 → 수주
    await pool.query(`DELETE FROM order_bom_result WHERE order_id = $1`, [orderId]);
    await pool.query(`DELETE FROM sales_order_item WHERE order_id = $1`, [orderId]);
    await pool.query(`DELETE FROM sales_order WHERE order_id = $1`, [orderId]);
    return { success: true };
  });

  // ────── 수주 수정 ──────

  app.patch('/api/orders/:id', async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const col of ['customer_name', 'project_name', 'delivery_date', 'remarks', 'status']) {
      if (body[col] !== undefined) {
        fields.push(`${col} = $${idx}`);
        values.push(body[col] || null);
        idx++;
      }
    }
    if (fields.length === 0) return { error: '수정할 항목이 없습니다' };

    values.push(id);
    const { rows } = await pool.query(
      `UPDATE sales_order SET ${fields.join(', ')} WHERE order_id = $${idx} RETURNING *`,
      values
    );
    if (rows.length === 0) return { error: '수주를 찾을 수 없습니다' };
    return { data: rows[0] };
  });

  // ────── 수주 품목 추가 ──────

  app.post('/api/orders/:id/items', async (req) => {
    const { id } = req.params as { id: string };
    const item = req.body as any;

    const maxSort = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort FROM sales_order_item WHERE order_id = $1`, [id]
    );
    const sortOrder = maxSort.rows[0].next_sort;

    const { rows } = await pool.query(`
      INSERT INTO sales_order_item (order_id, cert_id, structure_code, qty,
        opening_w_mm, opening_h_mm, penetration_w_mm, penetration_h_mm, spec_note, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
    `, [
      id, item.cert_id, item.structure_code, item.qty || 1,
      item.opening_w_mm || null, item.opening_h_mm || null,
      item.penetration_w_mm || null, item.penetration_h_mm || null,
      item.spec_note || null, sortOrder,
    ]);

    await pool.query(`
      UPDATE sales_order SET total_sets = (
        SELECT COALESCE(SUM(qty), 0) FROM sales_order_item WHERE order_id = $1
      ) WHERE order_id = $1
    `, [id]);

    return { data: rows[0] };
  });

  // ────── 수주 품목 수정 ──────

  app.patch('/api/orders/:id/items/:itemId', async (req) => {
    const { id, itemId } = req.params as { id: string; itemId: string };
    const body = req.body as any;
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const col of ['qty', 'penetration_w_mm', 'penetration_h_mm', 'opening_w_mm', 'opening_h_mm', 'spec_note']) {
      if (body[col] !== undefined) {
        fields.push(`${col} = $${idx}`);
        values.push(body[col]);
        idx++;
      }
    }
    if (fields.length === 0) return { error: '수정할 항목이 없습니다' };

    values.push(itemId, id);
    const { rows } = await pool.query(
      `UPDATE sales_order_item SET ${fields.join(', ')} WHERE order_item_id = $${idx} AND order_id = $${idx + 1} RETURNING *`,
      values
    );
    if (rows.length === 0) return { error: '품목을 찾을 수 없습니다' };

    await pool.query(`
      UPDATE sales_order SET total_sets = (
        SELECT COALESCE(SUM(qty), 0) FROM sales_order_item WHERE order_id = $1
      ) WHERE order_id = $1
    `, [id]);

    return { data: rows[0] };
  });

  // ────── 수주 품목 삭제 ──────

  app.delete('/api/orders/:id/items/:itemId', async (req) => {
    const { id, itemId } = req.params as { id: string; itemId: string };
    await pool.query(`DELETE FROM sales_order_item WHERE order_item_id = $1 AND order_id = $2`, [itemId, id]);

    await pool.query(`
      UPDATE sales_order SET total_sets = (
        SELECT COALESCE(SUM(qty), 0) FROM sales_order_item WHERE order_id = $1
      ) WHERE order_id = $1
    `, [id]);

    return { success: true };
  });

  // ────── BOM 자동 전개 (치수 기반) ──────

  app.post('/api/orders/:id/explode-bom', async (req) => {
    const { id } = req.params as { id: string };
    const orderId = parseInt(id);

    // 1. 수주 품목 + 인정구조 치수
    const orderItems = await pool.query(`
      SELECT si.*, cm.structure_code AS cert_code, cm.structure_name,
             cm.install_qty, cm.install_position, cm.cert_version,
             cm.opening_w_mm AS cm_ow, cm.opening_h_mm AS cm_oh,
             cm.penetration_w_mm AS cm_pw, cm.penetration_h_mm AS cm_ph,
             cm.sheet_thickness_prod, cm.cw_density_prod, cm.cw_density_min
      FROM sales_order_item si
      JOIN certification_master cm ON cm.cert_id = si.cert_id
      WHERE si.order_id = $1
      ORDER BY si.sort_order
    `, [orderId]);

    if (orderItems.rows.length === 0) return { error: '수주 품목이 없습니다' };

    const client = await pool.connect();
    try {
    await client.query('BEGIN');

    await client.query(`DELETE FROM order_bom_result WHERE order_id = $1`, [orderId]);

    const itemMap = await getItemMap();

    // 자재별 집계: key = item_code
    interface MatAccum {
      item_id: number; item_code: string; item_name: string; item_category: string;
      required_qty: number; unit: string;
      details: Array<{ component: string; spec: string; calc: string; qty: number; structureCode: string }>;
    }
    const matMap = new Map<string, MatAccum>();

    const missingItems: string[] = [];
    function addMaterial(itemCode: string, qty: number, component: string, spec: string, calc: string, structureCode: string) {
      const itemInfo = itemMap.get(itemCode);
      if (!itemInfo) {
        if (!missingItems.includes(itemCode)) {
          missingItems.push(itemCode);
          console.warn(`[BOM] 품목코드 "${itemCode}" 가 item_master에 없습니다 (component: ${component})`);
        }
        return;
      }
      const existing = matMap.get(itemCode);
      if (existing) {
        existing.required_qty += qty;
        existing.details.push({ component, spec, calc, qty, structureCode });
      } else {
        matMap.set(itemCode, {
          item_id: itemInfo.item_id, item_code: itemCode,
          item_name: itemInfo.item_name, item_category: itemInfo.item_category,
          required_qty: qty, unit: itemInfo.unit,
          details: [{ component, spec, calc, qty, structureCode }],
        });
      }
    }

    // 2. 각 주문 품목별 치수 기반 BOM 계산
    for (const oi of orderItems.rows) {
      const orderQty = oi.qty;
      const structCode = oi.structure_code;

      // 치수: 수주 입력값 > 인정구조 기본값
      const W = oi.penetration_w_mm || oi.cm_pw || 0;
      const H = oi.penetration_h_mm || oi.cm_ph || 0;
      const OW = oi.opening_w_mm || oi.cm_ow || 0;
      const OH = oi.opening_h_mm || oi.cm_oh || 0;
      const N = oi.install_qty || 1;
      const sheetThickness = parseFloat(oi.sheet_thickness_prod || '5.0');
      const cwDensity = parseFloat(oi.cw_density_prod || '120');
      const cwDensityMin = parseFloat(oi.cw_density_min || '96');

      if (W === 0 || H === 0) {
        // 치수 없는 구조 (BD, NP 등) → bom_master 고정값 사용
        const bomItems = await client.query(`
          SELECT bm.*, im.item_code, im.item_name, im.item_category, im.unit
          FROM bom_master bm JOIN item_master im ON im.item_id = bm.item_id
          WHERE bm.cert_id = $1 AND bm.is_applicable != false ORDER BY bm.sort_order
        `, [oi.cert_id]);
        for (const bi of bomItems.rows) {
          addMaterial(bi.item_code, bi.qty_per_unit * orderQty, bi.component_name, bi.spec_detail, `고정BOM: ${bi.qty_per_unit} × ${orderQty}세트`, structCode);
        }
        continue;
      }

      const perimeter = calculatePerimeter(W, H);

      // 동적 BOM 계산
      const dimParams: DimParams = {
        W, H, OW, OH, N,
        certVersion: oi.cert_version || '0310',
        installPos: oi.install_position || '수직벽체',
        sheetThickness, cwDensity, cwDensityMin,
        structureCode: structCode,
      };
      const bomLines = calculateStructureBom(dimParams);

      // orderQty (세트 수) 적용
      for (const line of bomLines) {
        let itemCode = line.item_code;
        // 완제품 소켓: 동적 매핑
        if (itemCode === '__FP_SOCKET__') {
          itemCode = structureToFPCode(structCode);
        }
        const totalQty = line.qty * orderQty;
        const calcWithSets = `${line.calc} × ${orderQty}세트 = ${totalQty}`;
        addMaterial(itemCode, totalQty, line.component, line.spec, calcWithSets, structCode);
      }

      // 추가: 반제품(SA) 역전개 → 원재료(RM)
      // 재단시트 → 압출 → 배합 역추적
      // 총 SA-CUT-SK 수량으로 압출 소요량 계산
    }

    // 2-1. 완제품(FP) → product_bom 전개: 금속소켓 본체(SOCKET_BODY) 구매자재 추출
    //      ★ 수정: 집계된 FP가 아니라, 개별 수주 라인(orderItems)별로 순회하여
    //         각 라인의 실제 관통구 치수(penetration_w/h)로 소켓 본체 규격을 계산
    //         → 21개 라인이 모두 다른 관통구 치수를 가질 수 있으므로 각각 별도 spec 생성
    for (const oi of orderItems.rows) {
      const orderQty = oi.qty;
      const lineW = oi.penetration_w_mm || oi.cm_pw || 0;
      const lineH = oi.penetration_h_mm || oi.cm_ph || 0;
      if (lineW === 0 || lineH === 0) continue; // 치수 없는 라인 skip

      // 해당 주문 라인의 완제품(FP) item_id를 찾기 위해 structure_bom 조회
      const fpCode = structureToFPCode(oi.cert_code || oi.structure_code);
      const fpInfo = itemMap.get(fpCode);
      if (!fpInfo) continue;

      const pbItems = await client.query(`
        SELECT pb.component_name, pb.component_type, pb.qty_fixed, pb.unit AS pb_unit,
               pb.source_type, pb.spec_detail,
               im.item_id, im.item_code, im.item_name, im.item_category, im.unit,
               cm.structure_code, cm.socket_name,
               cm.install_qty, cm.install_position
        FROM product_bom pb
        JOIN item_master im ON im.item_id = pb.item_id
        JOIN structure_bom sb ON sb.sbom_id = pb.sbom_id
        LEFT JOIN certification_master cm ON cm.cert_id = sb.cert_id AND cm.is_active = true
        WHERE sb.output_item_id = $1
          AND pb.source_type = 'PURCHASE'
          AND pb.component_type = 'SOCKET_BODY'
          AND pb.is_active = true
      `, [fpInfo.item_id]);

      for (const pbi of pbItems.rows) {
        const qtyPerSocket = parseFloat(pbi.qty_fixed || '1');
        const subQty = Math.round(qtyPerSocket * orderQty * 100) / 100;

        // ★ 소켓 본체 규격: 수주 라인의 실제 관통구 치수(lineW, lineH) 사용
        const instQty = oi.install_qty || pbi.install_qty || 1;
        const socketW = instQty >= 2 ? Math.round(lineW / instQty) - 30 : lineW;
        const socketH = lineH;
        const installPos = oi.install_position || pbi.install_position || '수직벽체';
        const socketHeight = (installPos === '수평바닥') ? 300 : 200;
        const structInfo = oi.cert_code || pbi.structure_code || '';
        let specStr = `SGCC t1.6, W${socketW}×H${socketH}×높이${socketHeight}mm (${structInfo} ${pbi.socket_name || ''})`;
        if (instQty >= 2) {
          specStr += ` ×${instQty}개조립`;
        }

        const calcNote = `관통구${lineW}×${lineH} → 소켓W${socketW}×H${socketH} × ${orderQty}세트 = ${subQty}`;
        addMaterial(pbi.item_code, subQty, pbi.component_name,
          specStr,
          calcNote, structInfo);
      }
    }

    // 3. 다단계 역전개: SA-CUT → SA-EXT → SA-MIX → RM
    //    재단(SA-CUT) → 압출(SA-EXT) → 배합(SA-MIX) → 원재료(RM) 순서로 역추적
    //    최대 4단계까지 재귀 수행 (무한루프 방지)
    const processedItems = new Set<string>(); // 이미 역전개한 item_code 추적

    async function reverseExplode(sourceItem: { item_id: number; item_code: string; item_name: string; required_qty: number; unit: string }, depth: number) {
      if (depth > 4) return; // 무한루프 방지
      if (processedItems.has(sourceItem.item_code)) return;
      processedItems.add(sourceItem.item_code);

      const upBoms = await client.query(`
        SELECT pb.bom_id, pb.output_qty, pb.loss_rate, pb.output_unit,
               pbi.item_id, pbi.component_name, pbi.qty, pbi.unit,
               im.item_code, im.item_name, im.item_category
        FROM process_bom pb
        JOIN process_bom_item pbi ON pbi.bom_id = pb.bom_id
        JOIN item_master im ON im.item_id = pbi.item_id
        WHERE pb.output_item_id = $1 AND pb.is_active = true
      `, [sourceItem.item_id]);

      if (upBoms.rows.length === 0) return;

      const outputQty = parseFloat(upBoms.rows[0].output_qty || '1');
      const lossRate = parseFloat(upBoms.rows[0].loss_rate || '0');
      const lossMult = 1 + lossRate / 100;

      // 소요량을 M→kg 환산 필요 여부 확인
      let inputQty = sourceItem.required_qty;
      const outputUnit = upBoms.rows[0].output_unit;

      // 압출 BOM: output_unit='kg', 투입도 kg → M 단위 소요량을 kg으로 환산
      // 5T×190mm 시트: 밀도 1.2g/cm³ → 1M = 0.5cm × 19cm × 100cm × 1.2g/cm³ = 1,140g = 1.14kg
      // 5T×125mm 시트: 1M = 0.5cm × 12.5cm × 100cm × 1.2g/cm³ = 750g = 0.75kg
      // 4T×125mm 시트: 1M = 0.4cm × 12.5cm × 100cm × 1.2g/cm³ = 600g = 0.60kg
      if (sourceItem.unit === 'M' || sourceItem.unit === 'm') {
        let kgPerM = 1.14; // 기본: 5T×190
        if (sourceItem.item_code.includes('4125') || sourceItem.item_code.includes('4T')) {
          kgPerM = 0.60; // 4T×125
        } else if (sourceItem.item_code.includes('5125') || sourceItem.item_code.includes('125')) {
          kgPerM = 0.75; // 5T×125
        } else if (sourceItem.item_code.includes('65415') || sourceItem.item_code.includes('6.5')) {
          kgPerM = 3.24; // 6.5T×415
        }
        if (outputUnit === 'kg') {
          inputQty = sourceItem.required_qty * kgPerM;
        }
      }

      const batches = inputQty / outputQty; // 소수점 배치도 허용 (정확한 소요량 계산)
      const batchesRoundUp = Math.ceil(batches); // 실제 배치 횟수 (올림)

      for (const ub of upBoms.rows) {
        const qty = Math.round(ub.qty * batches * lossMult * 100) / 100;
        const calcNote = sourceItem.unit === 'M' || sourceItem.unit === 'm'
          ? `${sourceItem.required_qty}${sourceItem.unit} × ${inputQty !== sourceItem.required_qty ? (inputQty/sourceItem.required_qty).toFixed(2) + 'kg/M = ' + inputQty.toFixed(1) + 'kg' : ''} ÷ ${outputQty}kg/배치 = ${batches.toFixed(2)}배치 × ${ub.qty}${ub.unit} × 로스${lossRate}% = ${qty}`
          : `${sourceItem.required_qty}${sourceItem.unit} ÷ ${outputQty}/배치 = ${batches.toFixed(2)}배치 × ${ub.qty}${ub.unit} × 로스${lossRate}% = ${qty}`;

        addMaterial(ub.item_code, qty, ub.component_name,
          `${sourceItem.item_name} → ${ub.component_name}`,
          calcNote,
          '역전개');

        // SA 항목이면 더 깊이 역전개 (SA-EXT → SA-MIX → RM)
        if (ub.item_category === 'SA') {
          const newMat = matMap.get(ub.item_code);
          if (newMat) {
            await reverseExplode({
              item_id: ub.item_id,
              item_code: ub.item_code,
              item_name: ub.item_name,
              required_qty: newMat.required_qty,
              unit: newMat.unit,
            }, depth + 1);
          }
        }
      }
    }

    // SA 항목들에 대해 역전개 실행
    const saEntries = [...matMap.values()].filter(m => m.item_category === 'SA');
    for (const sa of saEntries) {
      await reverseExplode({
        item_id: sa.item_id,
        item_code: sa.item_code,
        item_name: sa.item_name,
        required_qty: sa.required_qty,
        unit: sa.unit,
      }, 0);
    }

    // 4. structure_bom 조회 → 계층 메타데이터 매핑
    // 수주 품목별 cert_id에 대해 structure_bom 그룹 정보를 가져온다
    const certIds = [...new Set(orderItems.rows.map((oi: any) => oi.cert_id))];
    interface SbomGroupInfo {
      group_code: string; group_type: string; sort_order: number;
      source_type: string; output_item_code: string;
    }
    const sbomGroupMap: SbomGroupInfo[] = [];
    for (const certId of certIds) {
      const sbomRes = await client.query(`
        SELECT sb.group_code, sb.group_type, sb.sort_order, sb.source_type,
               im.item_code AS output_item_code
        FROM structure_bom sb
        LEFT JOIN item_master im ON im.item_id = sb.output_item_id
        WHERE sb.cert_id = $1 AND sb.is_active = true
        ORDER BY sb.sort_order
      `, [certId]);
      sbomGroupMap.push(...sbomRes.rows);
    }

    /** Determine hierarchy metadata for a BOM result row */
    function resolveHierarchy(mat: MatAccum): { bom_level: number; parent_group: string; source_type: string; group_sort: number } {
      const code = mat.item_code;
      const cat = mat.item_category;
      const compNames = mat.details.map(d => d.component).join(' ');

      // Try to match against structure_bom output_item_code first
      const directMatch = sbomGroupMap.find(g => g.output_item_code === code);
      if (directMatch) {
        return {
          bom_level: 1,
          parent_group: directMatch.group_type,
          source_type: directMatch.source_type,
          group_sort: directMatch.sort_order,
        };
      }

      // FP items → map by item_code prefix
      if (cat === 'FP') {
        if (code.startsWith('FP-FL-') || code.startsWith('FP-BD-FL')) {
          const flGroup = sbomGroupMap.find(g => g.group_type === 'FLASHING');
          return { bom_level: 1, parent_group: 'FLASHING', source_type: 'MANUFACTURE', group_sort: flGroup?.sort_order ?? 20 };
        }
        if (code.startsWith('FP-GAP') || code === 'FP-TS') {
          const gsGroup = sbomGroupMap.find(g => g.group_type === 'GAP_SHEET');
          return { bom_level: 1, parent_group: 'GAP_SHEET', source_type: 'MANUFACTURE', group_sort: gsGroup?.sort_order ?? 30 };
        }
        // Default FP → SOCKET
        const skGroup = sbomGroupMap.find(g => g.group_type === 'SOCKET');
        return { bom_level: 1, parent_group: 'SOCKET', source_type: 'MANUFACTURE', group_sort: skGroup?.sort_order ?? 10 };
      }

      // SM items → direct purchase materials
      if (cat === 'SM') {
        // Insulation materials (ceramicwool, glasswool for support)
        if (code.startsWith('SM-CW') || code.startsWith('SM-GW')) {
          const spGroup = sbomGroupMap.find(g => g.group_type === 'SUPPORT');
          return { bom_level: 1, parent_group: 'SUPPORT', source_type: 'PURCHASE', group_sort: spGroup?.sort_order ?? 40 };
        }
        // Sealant
        if (code.startsWith('SM-SIL')) {
          const slGroup = sbomGroupMap.find(g => g.group_type === 'SEALANT');
          return { bom_level: 1, parent_group: 'SEALANT', source_type: 'PURCHASE', group_sort: slGroup?.sort_order ?? 50 };
        }
        // Fixing plate
        if (code.startsWith('SM-GP')) {
          const fxGroup = sbomGroupMap.find(g => g.group_type === 'FIXING');
          return { bom_level: 1, parent_group: 'FIXING', source_type: 'PURCHASE', group_sort: fxGroup?.sort_order ?? 60 };
        }
        // Other SM → SUPPORT by default
        return { bom_level: 1, parent_group: 'SUPPORT', source_type: 'PURCHASE', group_sort: 40 };
      }

      // SA items → sub-components of SOCKET or FLASHING
      if (cat === 'SA') {
        // Check component names for flashing association
        const isFlashingComponent = compNames.includes('플래싱') || compNames.includes('FL');
        if (isFlashingComponent) {
          return { bom_level: 2, parent_group: 'FLASHING', source_type: 'MANUFACTURE', group_sort: 20 };
        }
        // Default SA → SOCKET sub-component
        return { bom_level: 2, parent_group: 'SOCKET', source_type: 'MANUFACTURE', group_sort: 10 };
      }

      // RM items → Level 3 reverse explosion results
      if (cat === 'RM') {
        return { bom_level: 3, parent_group: 'PROCESS_REVERSE', source_type: 'PURCHASE', group_sort: 99 };
      }

      // Fallback
      return { bom_level: 1, parent_group: 'OTHER', source_type: 'PURCHASE', group_sort: 90 };
    }

    // 5. 현재고 & 부족량 계산 → DB 저장 (with hierarchy metadata)
    for (const [, mat] of matMap) {
      const stockRes = await client.query(`
        SELECT COALESCE(SUM(CASE WHEN txn_type='IN' THEN qty ELSE 0 END),0) -
               COALESCE(SUM(CASE WHEN txn_type='OUT' THEN qty ELSE 0 END),0) AS balance
        FROM inventory_transaction WHERE item_id = $1
      `, [mat.item_id]);
      const stock = parseFloat(stockRes.rows[0]?.balance || '0');
      mat.required_qty = Math.round(mat.required_qty * 100) / 100;
      const shortage = Math.max(0, mat.required_qty - stock);

      const hierarchy = resolveHierarchy(mat);

      // ★ 그라스울(SM-GW), 세라믹블랭킷(SM-CW): 총합량으로 요약 (개별 라인 spec 나열하지 않음)
      //   소켓 본체 등 치수별 구분이 필요한 자재: 개별 spec을 | 로 나열
      const isAggregateItem = mat.item_code.startsWith('SM-GW') || mat.item_code.startsWith('SM-CW');
      let componentName: string;
      let specDetail: string;
      let calcNote: string;

      if (isAggregateItem) {
        // 그라스울/세라믹: 대표 spec 1건 + 총합 수량 요약
        const uniqueComponents = [...new Set(mat.details.map(d => d.component))];
        componentName = uniqueComponents.join(', ');
        // 대표 스펙은 첫 번째 detail의 spec 사용
        const baseSpec = mat.details[0]?.spec || '';
        specDetail = baseSpec;
        // calc_note: 총합량 요약 (개별 라인 계산식 대신)
        const structureCodes = [...new Set(mat.details.map(d => d.structureCode).filter(Boolean))];
        calcNote = `${structureCodes.join(', ')} 총 ${mat.details.length}건 합산 = ${mat.required_qty}${mat.unit}`;
      } else {
        // 소켓 본체 등: 기존대로 개별 spec 나열
        componentName = mat.details.map(d => `${d.component}(${d.structureCode})`).join(', ');
        specDetail = mat.details.map(d => d.spec).filter(Boolean).join(' | ');
        calcNote = mat.details.map(d => d.calc).join('\n');
      }

      await client.query(`
        INSERT INTO order_bom_result (order_id, item_id, item_code, item_name, item_category,
          required_qty, unit, current_stock, shortage_qty, component_name, spec_detail, calc_note,
          bom_level, parent_group, source_type, group_sort)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      `, [
        orderId, mat.item_id, mat.item_code, mat.item_name, mat.item_category,
        mat.required_qty, mat.unit, stock, shortage,
        componentName, specDetail, calcNote,
        hierarchy.bom_level, hierarchy.parent_group, hierarchy.source_type, hierarchy.group_sort,
      ]);
    }

    await client.query(`UPDATE sales_order SET status = 'BOM_EXPLODED' WHERE order_id = $1`, [orderId]);
    await client.query('COMMIT');

    const results = await pool.query(`
      SELECT obr.*, im.roll_length_m, im.roll_spec FROM order_bom_result obr LEFT JOIN item_master im ON im.item_id = obr.item_id WHERE obr.order_id = $1 ORDER BY obr.item_category, obr.item_code
    `, [orderId]);

    // 둘레 정보 요약
    const dimSummary = orderItems.rows.map((oi: any) => {
      const W = oi.penetration_w_mm || oi.cm_pw || 0;
      const H = oi.penetration_h_mm || oi.cm_ph || 0;
      return {
        structure_code: oi.structure_code,
        qty: oi.qty,
        penetration: `${W} × ${H}`,
        perimeter: W && H ? calculatePerimeter(W, H) : 0,
        install_qty: oi.install_qty,
      };
    });

    return {
      data: {
        order_id: orderId,
        dimensions: dimSummary,
        materials: results.rows,
        summary: {
          total_items: results.rows.length,
          shortage_items: results.rows.filter((r: any) => parseFloat(r.shortage_qty) > 0).length,
          categories: {
            RM: results.rows.filter((r: any) => r.item_category === 'RM'),
            SM: results.rows.filter((r: any) => r.item_category === 'SM'),
            SA: results.rows.filter((r: any) => r.item_category === 'SA'),
            FP: results.rows.filter((r: any) => r.item_category === 'FP'),
          },
        },
        warnings: missingItems.length > 0 ? missingItems.map(c => `품목코드 "${c}"가 item_master에 없어 BOM에서 제외됨`) : undefined,
      },
    };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  app.get('/api/orders/:id/bom', async (req) => {
    const { id } = req.params as { id: string };
    const { rows } = await pool.query(`
      SELECT obr.*, im.roll_length_m, im.roll_spec
      FROM order_bom_result obr
      LEFT JOIN item_master im ON im.item_id = obr.item_id
      WHERE obr.order_id = $1 ORDER BY obr.item_category, obr.item_code
    `, [id]);
    return { data: rows };
  });

  // ────── BOM 트리 (계층구조 조회) ──────

  app.get('/api/orders/:id/bom-tree', async (request, reply) => {
    const { id } = request.params as { id: string };
    const orderId = parseInt(id, 10);

    // Verify order exists
    const orderRes = await pool.query(`SELECT * FROM sales_order WHERE order_id = $1`, [orderId]);
    if (orderRes.rows.length === 0) {
      return reply.status(404).send({ error: '수주를 찾을 수 없습니다' });
    }

    // Query BOM results with hierarchy columns, ordered by group_sort then bom_level
    const { rows } = await pool.query(`
      SELECT obr.*, im.roll_length_m, im.roll_spec
      FROM order_bom_result obr
      LEFT JOIN item_master im ON im.item_id = obr.item_id
      WHERE obr.order_id = $1
      ORDER BY obr.group_sort, obr.bom_level, obr.item_code
    `, [orderId]);

    if (rows.length === 0) {
      return { data: { order_id: orderId, groups: [], summary: { total_items: 0 } } };
    }

    // Group name mapping
    const groupNameMap: Record<string, string> = {
      SOCKET: '금속소켓',
      FLASHING: '방화플래싱',
      GAP_SHEET: '틈새복합시트',
      SUPPORT: '지지구조 단열재',
      SEALANT: '실란트',
      FIXING: '고정자재',
      PROCESS_REVERSE: '공정역전개 원재료',
      OTHER: '기타',
    };

    // Build grouped hierarchy
    const groupOrder: string[] = [];
    const groupMap = new Map<string, {
      group_code: string; group_name: string; source_type: string; group_sort: number;
      items: typeof rows;
    }>();

    for (const row of rows) {
      const pg = row.parent_group || 'OTHER';
      if (!groupMap.has(pg)) {
        groupOrder.push(pg);
        groupMap.set(pg, {
          group_code: pg,
          group_name: groupNameMap[pg] || pg,
          source_type: row.source_type || 'PURCHASE',
          group_sort: row.group_sort || 99,
          items: [],
        });
      }
      groupMap.get(pg)!.items.push(row);
    }

    // Sort groups by group_sort
    groupOrder.sort((a, b) => (groupMap.get(a)!.group_sort) - (groupMap.get(b)!.group_sort));

    const groups = groupOrder.map(pg => groupMap.get(pg)!);

    return {
      data: {
        order_id: orderId,
        order: orderRes.rows[0],
        groups,
        summary: {
          total_items: rows.length,
          total_groups: groups.length,
          shortage_items: rows.filter((r: any) => parseFloat(r.shortage_qty) > 0).length,
          by_level: {
            level_1: rows.filter((r: any) => r.bom_level === 1).length,
            level_2: rows.filter((r: any) => r.bom_level === 2).length,
            level_3: rows.filter((r: any) => r.bom_level === 3).length,
          },
        },
      },
    };
  });

  // ────── 자재발주서 ──────

  app.post('/api/orders/:id/create-pr', async (req) => {
    const { id } = req.params as { id: string };
    const orderId = parseInt(id);
    const body = (req.body || {}) as any;

    // ── 중복 생성 방지: 이미 해당 주문에 DRAFT/SUBMITTED/APPROVED 상태 발주서가 있으면 차단 ──
    const existingPR = await pool.query(
      `SELECT pr_id, pr_number, status FROM purchase_request
       WHERE order_id = $1 AND status NOT IN ('CANCELLED')
       ORDER BY pr_id DESC LIMIT 1`,
      [orderId]
    );
    if (existingPR.rows.length > 0) {
      const ep = existingPR.rows[0];
      return { error: `이미 발주서 ${ep.pr_number} (${ep.status === 'DRAFT' ? '초안' : ep.status === 'SUBMITTED' ? '제출됨' : ep.status === 'APPROVED' ? '승인됨' : ep.status === 'ORDERED' ? '발주완료' : ep.status === 'RECEIVED' ? '입고완료' : ep.status})이 존재합니다. 기존 발주서를 취소 후 재생성하세요.` };
    }

    // RM(배합원료)는 별도 발주서로 관리하므로 제외
    const shortageItems = await pool.query(`
      SELECT * FROM order_bom_result
      WHERE order_id = $1 AND shortage_qty > 0 AND item_category = 'SM'
      ORDER BY item_code
    `, [orderId]);

    if (shortageItems.rows.length === 0) return { error: '발주 대상 부족 자재가 없습니다 (재고 충분)' };

    const prClient = await pool.connect();
    try {
      await prClient.query('BEGIN');

      const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const seqRes = await prClient.query(`SELECT COUNT(*)+1 AS seq FROM purchase_request WHERE pr_number LIKE $1`, [`PR-${dateStr}-%`]);
      const prNumber = `PR-${dateStr}-${String(seqRes.rows[0].seq).padStart(3, '0')}`;

      const prResult = await prClient.query(`
        INSERT INTO purchase_request (pr_number, order_id, pr_date, supplier_name, remarks, created_by)
        VALUES ($1,$2,CURRENT_DATE,$3,$4,$5) RETURNING *
      `, [prNumber, orderId, body.supplier_name || null, body.remarks || null, body.created_by || null]);

      const prId = prResult.rows[0].pr_id;

      // 품목 마스터 정보 가져오기 (롤규격, 서브카테고리 등)
      const itemMasterMap = new Map<number, any>();
      const imRes = await prClient.query(`SELECT item_id, item_code, item_subcategory, spec, roll_length_m, roll_spec FROM item_master WHERE is_active = true`);
      for (const im of imRes.rows) itemMasterMap.set(im.item_id, im);

      let sortIdx = 0;
      for (let idx = 0; idx < shortageItems.rows.length; idx++) {
        const si = shortageItems.rows[idx];
        const im = itemMasterMap.get(si.item_id);

        // 롤수 자동환산: M 단위 자재 중 roll_length_m이 있는 경우
        let rollCount: number | null = null;
        let rollSpec: string | null = null;
        if (im?.roll_length_m && si.unit === 'M') {
          rollCount = Math.ceil(parseFloat(si.shortage_qty) / im.roll_length_m);
          rollSpec = im.roll_spec || `${im.roll_length_m}M/롤`;
        }

        // ★ 규격별 분리: spec_detail에 | 구분자가 있으면 규격별로 별도 발주품목 생성
        const specLines = (si.spec_detail || '').split('|').map((s: string) => s.trim()).filter(Boolean);
        const calcLines = (si.calc_note || '').split('\n').filter(Boolean);

        if (specLines.length > 1) {
          // 다중 규격 → 규격별로 분리
          for (let si_idx = 0; si_idx < specLines.length; si_idx++) {
            const specLine = specLines[si_idx];
            const calcLine = calcLines[si_idx] || '';

            // 산출식에서 수량 추출: "= 28" 형식
            const qtyMatch = calcLine.match(/=\s*([\d.]+)\s*$/);
            const lineQty = qtyMatch ? parseFloat(qtyMatch[1]) : Math.round(parseFloat(si.shortage_qty) / specLines.length * 100) / 100;

            // 구조코드 추출: (VA-064 VM200) 형식에서
            const structMatch = specLine.match(/\(([A-Z]{2,}[-.][\w.]+)\s+([^)]+)\)/);
            const structInfo = structMatch ? `${structMatch[1]} ${structMatch[2]}` : '';
            const compName = structInfo || (si.component_name || '').split(', ')[si_idx] || si.item_name;

            await prClient.query(`
              INSERT INTO purchase_request_item (pr_id, item_id, item_code, item_name, required_qty, order_qty, unit,
                sort_order, spec_detail, calc_note, component_name, roll_count, roll_spec, item_subcategory, item_spec)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
            `, [
              prId, si.item_id, si.item_code, `${si.item_name} [${compName}]`,
              lineQty, lineQty, si.unit, sortIdx++,
              specLine, calcLine, compName,
              null, null,
              im?.item_subcategory || null, im?.spec || null,
            ]);
          }
        } else {
          // 단일 규격 → 기존 로직
          await prClient.query(`
            INSERT INTO purchase_request_item (pr_id, item_id, item_code, item_name, required_qty, order_qty, unit,
              sort_order, spec_detail, calc_note, component_name, roll_count, roll_spec, item_subcategory, item_spec)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          `, [
            prId, si.item_id, si.item_code, si.item_name,
            si.shortage_qty, si.shortage_qty, si.unit, sortIdx++,
            si.spec_detail || null, si.calc_note || null, si.component_name || null,
            rollCount, rollSpec,
            im?.item_subcategory || null, im?.spec || null,
          ]);
        }
      }

      await prClient.query(`UPDATE sales_order SET status = 'PO_CREATED' WHERE order_id = $1`, [orderId]);
      await prClient.query('COMMIT');

      const prItems = await pool.query(`SELECT pri.*, im.roll_length_m, im.roll_spec, im.spec AS item_spec, im.item_subcategory FROM purchase_request_item pri LEFT JOIN item_master im ON im.item_id = pri.item_id WHERE pri.pr_id = $1 ORDER BY pri.sort_order`, [prId]);
      return { data: { ...prResult.rows[0], items: prItems.rows } };
    } catch (err) {
      await prClient.query('ROLLBACK');
      throw err;
    } finally {
      prClient.release();
    }
  });

  app.get('/api/purchase-requests', async () => {
    const { rows } = await pool.query(`
      SELECT pr.*, so.order_number, so.customer_name, so.project_name,
        (SELECT COUNT(*) FROM purchase_request_item pri WHERE pri.pr_id = pr.pr_id) AS item_count,
        (SELECT COALESCE(SUM(pri.order_qty),0) FROM purchase_request_item pri WHERE pri.pr_id = pr.pr_id) AS total_qty
      FROM purchase_request pr LEFT JOIN sales_order so ON so.order_id = pr.order_id
      ORDER BY pr.pr_date DESC, pr.pr_id DESC
    `);
    return { data: rows };
  });

  app.get('/api/purchase-requests/:id', async (req) => {
    const { id } = req.params as { id: string };
    const pr = await pool.query(`
      SELECT pr.*, so.order_number, so.customer_name, so.project_name
      FROM purchase_request pr LEFT JOIN sales_order so ON so.order_id = pr.order_id WHERE pr.pr_id = $1
    `, [id]);
    if (pr.rows.length === 0) return { error: '발주서를 찾을 수 없습니다' };
    const items = await pool.query(`SELECT pri.*, im.roll_length_m, im.roll_spec, im.spec AS item_spec, im.item_subcategory FROM purchase_request_item pri LEFT JOIN item_master im ON im.item_id = pri.item_id WHERE pri.pr_id = $1 ORDER BY pri.sort_order`, [id]);
    return { data: { ...pr.rows[0], items: items.rows } };
  });

  // GET /api/purchase-requests/:id/download-xlsx - 발주 상세 XLSX 다운로드 (4시트 개선)
  app.get('/api/purchase-requests/:id/download-xlsx', async (req, reply) => {
    const { id } = req.params as { id: string };
    const pr = await pool.query(`
      SELECT pr.*, so.order_number, so.customer_name, so.project_name
      FROM purchase_request pr LEFT JOIN sales_order so ON so.order_id = pr.order_id
      WHERE pr.pr_id = $1`, [id]);
    if (pr.rows.length === 0) return reply.status(404).send({ error: '발주서를 찾을 수 없습니다' });

    const items = await pool.query(`
      SELECT pri.*, im.roll_length_m, im.roll_spec AS im_roll_spec, im.spec AS im_spec, im.item_subcategory AS im_subcat
      FROM purchase_request_item pri
      LEFT JOIN item_master im ON im.item_id = pri.item_id
      WHERE pri.pr_id = $1 ORDER BY pri.sort_order
    `, [id]);

    const prData = pr.rows[0];
    const prDate = prData.pr_date?.toISOString?.().slice(0, 10) || String(prData.pr_date || '').slice(0, 10);
    let orderItems: any[] = [];
    if (prData.order_id) {
      const oi = await pool.query(`
        SELECT soi.*, cm.structure_name, cm.socket_name, cm.fire_rating, cm.install_position,
               cm.opening_w_mm, cm.opening_h_mm
        FROM sales_order_item soi
        LEFT JOIN certification_master cm ON cm.cert_id = soi.cert_id
        WHERE soi.order_id = $1 ORDER BY soi.sort_order
      `, [prData.order_id]);
      orderItems = oi.rows;
    }

    // ── 공통: 구조별 파싱 데이터 구조 생성 ──
    interface ParsedDetail {
      structCode: string;
      itemCode: string;
      itemName: string;
      component: string;   // 용도
      spec: string;        // 규격
      calc: string;        // 산출내역
      qty: number;         // 해당 구조 소요량 (산출식에서 추출)
      unit: string;
    }
    const parsedDetails: ParsedDetail[] = [];

    for (const item of items.rows) {
      const components = (item.component_name || '').split(', ').map((s: string) => s.trim()).filter(Boolean);
      const specs = (item.spec_detail || '').split('|').map((s: string) => s.trim()).filter(Boolean);
      const calcs = (item.calc_note || '').split('\n').filter(Boolean);

      if (components.length === 0) {
        parsedDetails.push({
          structCode: '(공통)',
          itemCode: item.item_code,
          itemName: item.item_name,
          component: item.item_name,
          spec: item.item_spec || item.im_spec || '',
          calc: calcs[0] || '',
          qty: parseFloat(item.required_qty) || 0,
          unit: item.unit || '',
        });
        continue;
      }

      for (let ci = 0; ci < components.length; ci++) {
        const comp = components[ci];
        const scMatch = comp.match(/\(([A-Z]{2,}[-.][\w.]+)\)/);
        let structCode = scMatch ? scMatch[1] : '(공통)';
        const cleanComp = comp.replace(/\([A-Z]{2,}[-.][\w.]+\)/, '').trim();

        // spec_detail에서도 구조코드 추출 시도 (소켓 본체 등)
        if (structCode === '(공통)' && specs[ci]) {
          const specScMatch = specs[ci].match(/\(([A-Z]{2,}[-.][\w.]+)\s/);
          if (specScMatch) structCode = specScMatch[1];
        }

        // 산출식에서 결과 수량 추출: "= 32" 또는 마지막 숫자
        const calcStr = calcs[ci] || '';
        const qtyMatch = calcStr.match(/=\s*([\d.]+)\s*$/);
        const lineQty = qtyMatch ? parseFloat(qtyMatch[1]) : 0;

        parsedDetails.push({
          structCode,
          itemCode: item.item_code,
          itemName: item.item_name,
          component: cleanComp,
          spec: specs[ci] || '',
          calc: calcStr,
          qty: lineQty,
          unit: item.unit || '',
        });
      }
    }

    const wb = XLSX.utils.book_new();

    // ════════════════════════════════════════════
    // 시트1: 발주서 (규격별 분리 — 공급자가 바로 납품 가능)
    // ════════════════════════════════════════════

    // ── 규격별 발주 라인 생성: 동일 품목이라도 규격이 다르면 별도 행 ──
    interface OrderLine {
      itemCode: string;
      itemName: string;
      category: string;
      spec: string;        // 상세 규격
      qty: number;         // 해당 규격 수량
      unit: string;
      structInfo: string;  // 적용 구조
    }
    const orderLines: OrderLine[] = [];

    for (const item of items.rows) {
      const cat = item.item_subcategory || item.im_subcat || '기타';
      const specs = (item.spec_detail || '').split('|').map((s: string) => s.trim()).filter(Boolean);
      const components = (item.component_name || '').split(', ').map((s: string) => s.trim()).filter(Boolean);
      const calcs = (item.calc_note || '').split('\n').filter(Boolean);

      // 규격이 여러 개이면 구조+규격별로 분리
      if (specs.length > 1) {
        // 구조+규격 복합키로 그룹핑 (같은 구조&규격이면 수량 합산)
        const specGroup = new Map<string, { spec: string; qty: number; structs: string[] }>();
        for (let si = 0; si < specs.length; si++) {
          const sp = specs[si];
          const calcStr = calcs[si] || '';
          const qtyMatch = calcStr.match(/=\s*([\d.]+)\s*$/);
          const lineQty = qtyMatch ? parseFloat(qtyMatch[1]) : 0;
          const comp = components[si] || '';
          const scMatch = comp.match(/\(([A-Z]{2,}[-.][\w.]+)\)/) || sp.match(/\(([A-Z]{2,}[-.][\w.]+)\s/);
          const sc = scMatch ? scMatch[1] : '';

          // 키: 구조+규격 (구조가 다르면 같은 규격이어도 분리)
          const groupKey = `${sc}||${sp}`;
          if (!specGroup.has(groupKey)) specGroup.set(groupKey, { spec: sp, qty: 0, structs: [] });
          const g = specGroup.get(groupKey)!;
          g.qty += lineQty;
          if (sc && !g.structs.includes(sc)) g.structs.push(sc);
        }

        for (const [, g] of specGroup.entries()) {
          orderLines.push({
            itemCode: item.item_code,
            itemName: item.item_name,
            category: cat,
            spec: g.spec,
            qty: g.qty > 0 ? g.qty : parseFloat(item.required_qty) / specGroup.size,
            unit: item.unit,
            structInfo: g.structs.join(', '),
          });
        }
      } else {
        // 규격이 1개 — 그대로
        // 구조코드 추출
        const structsFound: string[] = [];
        for (const c of components) {
          const m = c.match(/\(([A-Z]{2,}[-.][\w.]+)\)/);
          if (m && !structsFound.includes(m[1])) structsFound.push(m[1]);
        }
        if (structsFound.length === 0 && specs[0]) {
          const m = specs[0].match(/\(([A-Z]{2,}[-.][\w.]+)\s/);
          if (m) structsFound.push(m[1]);
        }

        orderLines.push({
          itemCode: item.item_code,
          itemName: item.item_name,
          category: cat,
          spec: specs[0] || item.item_spec || item.im_spec || '',
          qty: parseFloat(item.required_qty) || 0,
          unit: item.unit,
          structInfo: structsFound.join(', '),
        });
      }
    }

    // ── 발주서 시트 작성 ──
    const s1Rows: any[][] = [];
    s1Rows.push(['자 재 발 주 서']);
    s1Rows.push([]);
    s1Rows.push(['발주번호', prData.pr_number, '', '발주일자', prDate]);
    s1Rows.push(['수주번호', prData.order_number || '-', '', '고객사', prData.customer_name || '-']);
    s1Rows.push(['프로젝트', prData.project_name || '-', '', '공급처', prData.supplier_name || '미지정']);
    s1Rows.push([]);
    s1Rows.push(['No', '품목코드', '품목명', '상세규격', '수량', '단위', '적용구조', '비고']);

    const categories = ['배합원료', '세라믹차열재', '그라스울', '강재류', '브라켓', '고정자재', '밀봉재'];
    const catLineMap = new Map<string, OrderLine[]>();
    for (const line of orderLines) {
      if (!catLineMap.has(line.category)) catLineMap.set(line.category, []);
      catLineMap.get(line.category)!.push(line);
    }

    let rowNo = 1;
    let totalLines = 0;
    const allCats = [...categories, ...Array.from(catLineMap.keys()).filter(c => !categories.includes(c))];
    for (const cat of allCats) {
      const lines = catLineMap.get(cat);
      if (!lines || lines.length === 0) continue;

      s1Rows.push([`▸ ${cat}`, '', '', '', '', '', '', '']);

      for (const line of lines) {
        // 같은 품목코드가 여러 행이면 소계 표시용 비고
        const sameCodeLines = lines.filter(l => l.itemCode === line.itemCode);
        const remark = sameCodeLines.length > 1
          ? `소계 ${Math.round(sameCodeLines.reduce((s, l) => s + l.qty, 0) * 100) / 100}${line.unit} 중`
          : '';

        s1Rows.push([
          rowNo++,
          line.itemCode,
          line.itemName,
          line.spec,
          Math.round(line.qty * 100) / 100,
          line.unit,
          line.structInfo,
          remark,
        ]);
        totalLines++;
      }
    }

    s1Rows.push([]);
    s1Rows.push([`총 ${totalLines}개 발주항목 (${items.rows.length}개 품목)`]);
    s1Rows.push([]);
    s1Rows.push(['', '발주자', '', '', '확인자', '', '승인자', '']);
    s1Rows.push(['', '(인)', '', '', '(인)', '', '(인)', '']);

    const ws1 = XLSX.utils.aoa_to_sheet(s1Rows);
    ws1['!cols'] = [{ wch: 5 }, { wch: 16 }, { wch: 28 }, { wch: 52 }, { wch: 10 }, { wch: 5 }, { wch: 16 }, { wch: 18 }];
    ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
    XLSX.utils.book_append_sheet(wb, ws1, '발주서');

    // ════════════════════════════════════════════
    // 시트2: 구조별 자재명세 (구조 중심 - 한눈에 보기)
    // ════════════════════════════════════════════
    const s2Rows: any[][] = [];
    s2Rows.push([`구조별 자재명세 — ${prData.pr_number}`]);
    s2Rows.push([`수주: ${prData.order_number || '-'} | 고객: ${prData.customer_name || '-'} | 프로젝트: ${prData.project_name || '-'}`]);
    s2Rows.push([]);

    // 구조별로 그룹핑
    const structMap = new Map<string, ParsedDetail[]>();
    for (const d of parsedDetails) {
      if (!structMap.has(d.structCode)) structMap.set(d.structCode, []);
      structMap.get(d.structCode)!.push(d);
    }

    // 공통 자재 먼저
    const commonItems = structMap.get('(공통)');
    if (commonItems && commonItems.length > 0) {
      s2Rows.push(['■ 공통 자재 (배합원료 등)']);
      s2Rows.push(['', '품목코드', '품목명', '용도', '상세규격', '수량', '단위']);
      for (const d of commonItems) {
        s2Rows.push(['', d.itemCode, d.itemName, d.component, d.spec, d.qty, d.unit]);
      }
      s2Rows.push([]);
    }

    // 각 구조별
    for (const oi of orderItems) {
      const sc = oi.structure_code;
      const details = structMap.get(sc);
      if (!details || details.length === 0) continue;

      s2Rows.push([`■ ${sc}`, oi.structure_name || '', '', '', '', '', '']);
      s2Rows.push(['', '설치위치', oi.install_position || '-', '관통(W×H)', `${oi.penetration_w_mm || oi.opening_w_mm || '-'} × ${oi.penetration_h_mm || oi.opening_h_mm || '-'} mm`, `수량: ${oi.qty}세트`, '']);
      s2Rows.push(['', '소켓', oi.socket_name || '-', '내화등급', oi.fire_rating || '-', '', '']);
      s2Rows.push(['', '품목코드', '품목명', '용도', '상세규격', '수량', '단위']);

      for (const d of details) {
        // component 정리: "(product_bom 전개)" 제거
        const cleanComponent = d.component.replace(/\(product_bom\s*전개\)/g, '').trim() || d.itemName;
        s2Rows.push(['', d.itemCode, d.itemName, cleanComponent, d.spec, d.qty, d.unit]);
      }
      s2Rows.push([]);
    }

    const ws2 = XLSX.utils.aoa_to_sheet(s2Rows);
    ws2['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 24 }, { wch: 52 }, { wch: 10 }, { wch: 6 }];
    XLSX.utils.book_append_sheet(wb, ws2, '구조별 자재명세');

    // ════════════════════════════════════════════
    // 시트3: 자재별 구조배분 (자재 중심 - 어디에 얼마나)
    // ════════════════════════════════════════════
    const structCodes = orderItems.map((o: any) => o.structure_code);
    const s3Headers = ['품목코드', '품목명', '세분류', '총수량', '단위', ...structCodes.map((sc: string) => {
      const oi = orderItems.find((o: any) => o.structure_code === sc);
      return `${sc}\n(${oi?.qty || '?'}세트)`;
    })];

    const s3Rows: any[][] = [];
    s3Rows.push([`자재별 구조배분표 — ${prData.pr_number}`]);
    s3Rows.push([]);
    s3Rows.push(s3Headers);

    for (const item of items.rows) {
      const cat = item.item_subcategory || item.im_subcat || '기타';
      const row: any[] = [
        item.item_code,
        item.item_name,
        cat,
        parseFloat(item.required_qty),
        item.unit,
      ];

      // 각 구조별 수량 배분
      for (const sc of structCodes) {
        const matched = parsedDetails.filter(d => d.structCode === sc && d.itemCode === item.item_code);
        const scQty = matched.reduce((sum, d) => sum + d.qty, 0);
        row.push(scQty > 0 ? scQty : '');
      }
      s3Rows.push(row);
    }

    const ws3 = XLSX.utils.aoa_to_sheet(s3Rows);
    const s3ColWidths: { wch: number }[] = [{ wch: 16 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 5 }];
    for (let i = 0; i < structCodes.length; i++) s3ColWidths.push({ wch: 14 });
    ws3['!cols'] = s3ColWidths;
    XLSX.utils.book_append_sheet(wb, ws3, '자재별 구조배분');

    // ════════════════════════════════════════════
    // 시트4: 산출근거 (상세 계산식 - 참고용)
    // ════════════════════════════════════════════
    const s4Headers = ['구조코드', '품목코드', '품목명', '용도', '적용규격', '산출내역', '소요량', '단위'];
    const s4Rows: any[][] = [];
    s4Rows.push([`산출근거 상세 — ${prData.pr_number}`]);
    s4Rows.push([]);
    s4Rows.push(s4Headers);

    for (const d of parsedDetails) {
      const cleanComp = d.component.replace(/\(product_bom\s*전개\)/g, '').trim() || d.itemName;
      s4Rows.push([
        d.structCode,
        d.itemCode,
        d.itemName,
        cleanComp,
        d.spec,
        d.calc,
        d.qty,
        d.unit,
      ]);
    }

    const ws4 = XLSX.utils.aoa_to_sheet(s4Rows);
    ws4['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 28 }, { wch: 28 }, { wch: 42 }, { wch: 55 }, { wch: 10 }, { wch: 5 }];
    XLSX.utils.book_append_sheet(wb, ws4, '산출근거');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `${prData.pr_number}_발주상세.xlsx`;

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    return reply.send(Buffer.from(buf));
  });

  app.patch('/api/purchase-requests/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status, writer_id } = req.body as { status: string; writer_id?: number };
    const prId = parseInt(id);

    // 현재 PR 정보 조회
    const prRes = await pool.query(
      `SELECT pr.*, so.order_number, so.customer_name, so.project_name
       FROM purchase_request pr
       LEFT JOIN sales_order so ON so.order_id = pr.order_id
       WHERE pr.pr_id = $1`, [prId]
    );
    if (prRes.rows.length === 0) return reply.status(404).send({ error: '발주서를 찾을 수 없습니다.' });
    const pr = prRes.rows[0];

    // 상태 업데이트
    const { rows } = await pool.query(
      `UPDATE purchase_request SET status = $1 WHERE pr_id = $2 RETURNING *`, [status, prId]
    );

    // ── 제출(SUBMITTED) 시 결재 요청 자동 생성 ──
    if (status === 'SUBMITTED') {
      // 기존 결재가 있는지 확인 (중복 방지)
      const existingApproval = await pool.query(
        `SELECT approval_id FROM approval WHERE doc_type = 'PURCHASE_REQUEST' AND doc_id = $1 AND status NOT IN ('REJECTED', 'RETURNED')`,
        [prId]
      );

      if (existingApproval.rows.length === 0) {
        // 결재 라인에서 검토/승인자 자동 매핑
        const lineResult = await pool.query(
          `SELECT * FROM approval_line WHERE doc_type = 'PURCHASE_REQUEST' AND is_active = true ORDER BY line_id LIMIT 1`
        );

        let reviewerId = null;
        let approverId = null;
        if (lineResult.rows.length > 0) {
          reviewerId = lineResult.rows[0].reviewer_id;
          approverId = lineResult.rows[0].approver_id;
        }

        // 품목 수량 요약
        const itemCountRes = await pool.query(
          `SELECT COUNT(*) as cnt, COALESCE(SUM(order_qty), 0) as total_qty FROM purchase_request_item WHERE pr_id = $1`,
          [prId]
        );
        const itemInfo = itemCountRes.rows[0];

        const docTitle = `자재발주서 ${pr.pr_number}` +
          (pr.order_number ? ` (수주: ${pr.order_number})` : '');
        const docSummary = [
          pr.customer_name ? `고객사: ${pr.customer_name}` : null,
          pr.project_name ? `프로젝트: ${pr.project_name}` : null,
          pr.supplier_name ? `공급사: ${pr.supplier_name}` : null,
          `발주 품목: ${itemInfo.cnt}건`,
          pr.total_amount ? `총 금액: ${Number(pr.total_amount).toLocaleString()}원` : null,
        ].filter(Boolean).join(' | ');

        await pool.query(
          `INSERT INTO approval (doc_type, doc_id, doc_title, doc_summary, status, writer_id, reviewer_id, approver_id)
           VALUES ('PURCHASE_REQUEST', $1, $2, $3, 'REVIEW', $4, $5, $6)`,
          [prId, docTitle, docSummary, writer_id || null, reviewerId, approverId]
        );
      }
    }

    // ── 발주완료(ORDERED) 시 작업지시서 자동 생성 ──
    if (status === 'ORDERED' && pr.order_id) {
      try {
        const autoWoResult = await autoCreateWorkOrders(pr.order_id, pr.customer_name, pr.project_name);
        return { data: { ...rows[0], auto_work_orders: autoWoResult } };
      } catch (err: any) {
        console.error('[AutoWO] 자동 작업지시 생성 실패 (발주 상태는 변경됨):', err.message);
        return { data: { ...rows[0], auto_work_orders: null, auto_wo_error: err.message } };
      }
    }

    return { data: rows[0] };
  });

  // ── 발주완료 시 작업지시서 자동 생성 헬퍼 ──
  async function autoCreateWorkOrders(orderId: number, customerName: string | null, _projectName: string | null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 이미 해당 수주에 대한 작업지시가 있는지 확인 (중복 방지)
      const existingWo = await client.query(
        `SELECT wo_id FROM work_order WHERE order_id = $1 LIMIT 1`,
        [orderId]
      );
      if (existingWo.rows.length > 0) {
        await client.query('ROLLBACK');
        return { skipped: true, message: '이미 작업지시가 존재합니다.', existing_count: existingWo.rows.length };
      }

      // 수주 정보 조회
      const orderRes = await client.query(
        `SELECT so.*,
                (SELECT COUNT(*) FROM sales_order_item WHERE order_id = so.order_id) as item_count,
                (SELECT COALESCE(SUM(qty), 0) FROM sales_order_item WHERE order_id = so.order_id) as total_item_qty
         FROM sales_order so WHERE so.order_id = $1`,
        [orderId]
      );
      if (orderRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return { skipped: true, message: '연결된 수주를 찾을 수 없습니다.' };
      }
      const order = orderRes.rows[0];

      const woDate = new Date().toISOString().slice(0, 10);
      const dateStr = woDate.replace(/-/g, '');
      const createdOrders: any[] = [];
      // MIX는 별도 생성 (일일 생산계획/개별 작업지시에서 선택)
      const processes = ['EXT', 'CUT', 'ASM'];
      const totalSets = parseInt(order.total_sets || order.total_item_qty || '1', 10) || 1;

      // BOM 결과에서 실제 소요량 조회
      const bomReqRes = await client.query(
        `SELECT obr.item_code, obr.item_name, obr.required_qty, obr.unit, im.item_id
         FROM order_bom_result obr
         LEFT JOIN item_master im ON im.item_code = obr.item_code
         WHERE obr.order_id = $1 AND obr.item_code IN ('SA-MIX-MB', 'SA-EXT-5190', 'SA-EXT-5125', 'SA-EXT-4125', 'SA-EXT-65415', 'SA-CUT-SK', 'SA-CUT-FL', 'FP-VT01', 'FP-VA064')`,
        [orderId]
      );
      const bomQty: Record<string, number> = {};
      const bomItemId: Record<string, number | null> = {};
      for (const r of bomReqRes.rows) {
        bomQty[r.item_code] = (bomQty[r.item_code] || 0) + parseFloat(r.required_qty);
        bomItemId[r.item_code] = r.item_id;
      }
      const asmTotalQty = (bomQty['FP-VT01'] || 0) + (bomQty['FP-VA064'] || 0) || totalSets;

      // EXT 규격별 BOM 목록 구성: item_code → {thickness, width, qty, name, item_id}
      const EXT_SPEC_MAP: Record<string, { thickness: number; width: number }> = {
        'SA-EXT-5190': { thickness: 5, width: 190 },
        'SA-EXT-5125': { thickness: 5, width: 125 },
        'SA-EXT-4125': { thickness: 4, width: 125 },
        'SA-EXT-65415': { thickness: 6.5, width: 415 },
      };
      const extSpecs: Array<{ item_code: string; item_name: string; item_id: number | null; thickness: number; width: number; qty: number }> = [];
      for (const r of bomReqRes.rows) {
        if (r.item_code?.startsWith('SA-EXT-') && EXT_SPEC_MAP[r.item_code]) {
          const spec = EXT_SPEC_MAP[r.item_code];
          const existing = extSpecs.find(e => e.item_code === r.item_code);
          if (existing) {
            existing.qty += parseFloat(r.required_qty);
          } else {
            extSpecs.push({
              item_code: r.item_code,
              item_name: r.item_name,
              item_id: r.item_id,
              thickness: spec.thickness,
              width: spec.width,
              qty: parseFloat(r.required_qty),
            });
          }
        }
      }

      // 헬퍼: 단일 작업지시 생성
      async function createOneWO(
        procCode: string, qty: number, batch: number,
        itemId: number | null, itemName: string | null,
        thickness: number | null, width: number | null, extSpec: string | null,
      ) {
        const woSeqResult = await client.query(
          `SELECT COUNT(*) as cnt FROM work_order WHERE process_code = $1 AND wo_date = $2`,
          [procCode, woDate]
        );
        const woSeq = parseInt(woSeqResult.rows[0].cnt, 10) + 1;
        const woNumber = `WO-${procCode}-${dateStr}-${String(woSeq).padStart(3, '0')}`;

        // LOT 번호 생성 (client 기반 - 트랜잭션 내 중복 방지)
        const datePrefix = woDate.replace(/-/g, '').slice(2);
        let lotNumber: string;
        if (procCode === 'MIX') {
          const lotSeq = await client.query(`SELECT lot_number FROM lot_transaction WHERE lot_number LIKE $1 ORDER BY lot_number DESC LIMIT 1`, [`${datePrefix}-S%`]);
          const seq = lotSeq.rows.length > 0 ? (parseInt(lotSeq.rows[0].lot_number.match(/(\d+)$/)?.[1] || '0', 10) + 1) : 1;
          lotNumber = `${datePrefix}-S${String(seq).padStart(2, '0')}`;
        } else {
          const prefix = procCode === 'EXT' ? 'EXT' : (procCode === 'CUT' ? 'CUT' : (procCode === 'ASM' ? 'ASM-GEN' : procCode));
          const lotSeq = await client.query(`SELECT lot_number FROM lot_transaction WHERE lot_number LIKE $1 ORDER BY lot_number DESC LIMIT 1`, [`${prefix}-${datePrefix}-%`]);
          const seq = lotSeq.rows.length > 0 ? (parseInt(lotSeq.rows[0].lot_number.match(/(\d+)$/)?.[1] || '0', 10) + 1) : 1;
          lotNumber = `${prefix}-${datePrefix}-${String(seq).padStart(3, '0')}`;
        }

        // FIFO 자재 배정
        let inputLotNumbers: string | null = null;
        const pbResult = await client.query(
          `SELECT * FROM process_bom WHERE process_code = $1 AND is_active = true ORDER BY bom_id LIMIT 1`,
          [procCode]
        );
        const pbom = pbResult.rows[0] || null;
        if (pbom) {
          const bomItems = await client.query(
            `SELECT pbi.item_id, im.item_code, im.item_name, pbi.qty
             FROM process_bom_item pbi
             LEFT JOIN item_master im ON im.item_id = pbi.item_id
             WHERE pbi.bom_id = $1 AND pbi.item_id IS NOT NULL
             ORDER BY pbi.sort_order`,
            [pbom.bom_id]
          );
          if (bomItems.rows.length > 0) {
            const allocations: any[] = [];
            for (const bomItem of bomItems.rows) {
              const needQty = parseFloat(bomItem.qty) * batch;
              const lots = await client.query(
                `SELECT lot_id, lot_number, remaining_qty FROM lot_transaction
                 WHERE item_id = $1 AND status = 'ACTIVE' AND remaining_qty > 0
                 ORDER BY created_at ASC`,
                [bomItem.item_id]
              );
              let remaining = needQty;
              for (const lot of lots.rows) {
                if (remaining <= 0) break;
                const take = Math.min(parseFloat(lot.remaining_qty), remaining);
                allocations.push({ item_id: bomItem.item_id, item_code: bomItem.item_code, item_name: bomItem.item_name, lot_number: lot.lot_number, lot_id: lot.lot_id, qty: take });
                remaining -= take;
              }
              if (remaining > 0) {
                allocations.push({ item_id: bomItem.item_id, item_code: bomItem.item_code, item_name: bomItem.item_name, lot_number: null, lot_id: null, qty: remaining, shortage: true });
              }
            }
            inputLotNumbers = JSON.stringify(allocations);
          }
        }

        const insertResult = await client.query(
          `INSERT INTO work_order (
            wo_number, wo_date, process_code, status, order_id,
            item_id, planned_qty, customer_name, input_lot_numbers, remarks,
            thickness_mm, width_mm, ext_spec
          ) VALUES ($1, $2, $3, 'PLANNED', $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING wo_id`,
          [woNumber, woDate, procCode, orderId, itemId, qty,
           customerName, inputLotNumbers,
           `수주 ${order.order_number} 발주완료 → 자동생성`,
           thickness, width, extSpec]
        );
        const woId = insertResult.rows[0].wo_id;

        const lotUnit = procCode === 'MIX' ? 'kg' : (procCode === 'EXT' ? 'm' : 'ea');
        const createdLotNumbers: string[] = [];

        if (procCode === 'MIX' && batch > 1 && itemId) {
          // MIX: 배치당(300kg) LOT 개별 생성
          for (let b = 0; b < batch; b++) {
            let batchLotNumber: string;
            if (b === 0) {
              batchLotNumber = lotNumber; // 첫 번째는 이미 생성된 번호
            } else {
              const lotSeq2 = await client.query(
                `SELECT lot_number FROM lot_transaction WHERE lot_number LIKE $1 ORDER BY lot_number DESC LIMIT 1`,
                [`${datePrefix}-S%`]
              );
              const seq2 = lotSeq2.rows.length > 0 ? (parseInt(lotSeq2.rows[0].lot_number.match(/(\d+)$/)?.[1] || '0', 10) + 1) : 1;
              batchLotNumber = `${datePrefix}-S${String(seq2).padStart(2, '0')}`;
            }
            await client.query(
              `INSERT INTO lot_transaction (lot_number, lot_type, item_id, qty, remaining_qty, unit, status, wo_id)
               VALUES ($1, $2, $3, 0, 0, $4, 'ACTIVE', $5)`,
              [batchLotNumber, procCode, itemId, lotUnit, woId]
            );
            createdLotNumbers.push(batchLotNumber);
          }
        } else if (itemId) {
          // 기타 공정: LOT 1건
          await client.query(
            `INSERT INTO lot_transaction (lot_number, lot_type, item_id, qty, remaining_qty, unit, status, wo_id)
             VALUES ($1, $2, $3, 0, 0, $4, 'ACTIVE', $5)`,
            [lotNumber, procCode, itemId, lotUnit, woId]
          );
          createdLotNumbers.push(lotNumber);
        }

        // 작업지시의 lot_number에 전체 LOT 기록
        const displayLotNumber = createdLotNumbers.length > 1
          ? `${createdLotNumbers[0]}~${createdLotNumbers[createdLotNumbers.length - 1]}`
          : (createdLotNumbers[0] || lotNumber);
        await client.query(
          `UPDATE work_order SET lot_number = $1 WHERE wo_id = $2`,
          [displayLotNumber, woId]
        );

        createdOrders.push({
          wo_id: woId, wo_number: woNumber, process_code: procCode,
          planned_qty: qty, batch_count: batch, lot_number: displayLotNumber,
          item_name: itemName, ext_spec: extSpec,
        });
      }

      for (const processCode of processes) {
        if (processCode === 'EXT') {
          // EXT: 규격별로 각각 작업지시 생성
          if (extSpecs.length > 0) {
            for (const ext of extSpecs) {
              const extSpec = `${ext.thickness}T×${ext.width}mm`;
              await createOneWO('EXT', Math.ceil(ext.qty), 1,
                ext.item_id, ext.item_name,
                ext.thickness, ext.width, extSpec);
            }
          } else {
            // BOM에 압출 품목이 없으면 기본 1건
            await createOneWO('EXT', 300, 1, null, null, 5, 190, '5T×190mm');
          }
          continue;
        }

        if (processCode === 'CUT') {
          // CUT: 소켓용/플래싱용 분리 생성
          const cutSkQty = bomQty['SA-CUT-SK'] || 0;
          const cutFlQty = bomQty['SA-CUT-FL'] || 0;
          if (cutSkQty > 0) {
            await createOneWO('CUT', Math.ceil(cutSkQty), 1,
              bomItemId['SA-CUT-SK'] || null, '재단(소켓용)', null, null, null);
          }
          if (cutFlQty > 0) {
            await createOneWO('CUT', Math.ceil(cutFlQty), 1,
              bomItemId['SA-CUT-FL'] || null, '재단(플래싱용)', null, null, null);
          }
          if (cutSkQty === 0 && cutFlQty === 0) {
            await createOneWO('CUT', totalSets, 1, null, null, null, null, null);
          }
          continue;
        }

        // MIX / ASM
        const pbResult = await client.query(
          `SELECT * FROM process_bom WHERE process_code = $1 AND is_active = true ORDER BY bom_id LIMIT 1`,
          [processCode]
        );
        const pbom = pbResult.rows[0] || null;

        let plannedQty: number;
        let batchCount = 1;
        switch (processCode) {
          case 'ASM':
            plannedQty = asmTotalQty || totalSets;
            break;
          default:
            plannedQty = 1;
        }

        const outputItemId = pbom?.output_item_id || null;
        let itemName: string | null = null;
        if (outputItemId) {
          const itemRes = await client.query(`SELECT item_name FROM item_master WHERE item_id = $1`, [outputItemId]);
          if (itemRes.rows.length > 0) itemName = itemRes.rows[0].item_name;
        }

        await createOneWO(processCode, plannedQty, batchCount, outputItemId, itemName, null, null, null);
      }

      // 수주 상태 업데이트
      await client.query(
        `UPDATE sales_order SET status = 'IN_PRODUCTION' WHERE order_id = $1 AND status NOT IN ('SHIPPED', 'CANCELLED')`,
        [orderId]
      );

      await client.query('COMMIT');

      return {
        created: true,
        count: createdOrders.length,
        orders: createdOrders,
        message: `${createdOrders.length}개 공정 작업지시 자동 생성 완료 (MIX/EXT/CUT/ASM)`,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // PATCH /api/purchase-requests/items/:priId - 발주 품목 수정
  app.patch('/api/purchase-requests/items/:priId', async (req, reply) => {
    const { priId } = req.params as { priId: string };
    const body = req.body as Record<string, unknown>;
    const allowedFields = ['order_qty', 'unit_price', 'remarks', 'spec_detail', 'delivery_date', 'roll_count', 'roll_spec'];
    const updates: string[] = [];
    const values: unknown[] = [];
    for (const field of allowedFields) {
      if (field in body) {
        values.push(body[field]);
        updates.push(`${field} = $${values.length}`);
      }
    }
    if (updates.length === 0) return reply.status(400).send({ error: '수정할 항목이 없습니다.' });

    values.push(parseInt(priId));
    const { rows } = await pool.query(
      `UPDATE purchase_request_item SET ${updates.join(', ')} WHERE pri_id = $${values.length} RETURNING *`,
      values
    );
    if (rows.length === 0) return reply.status(404).send({ error: '품목을 찾을 수 없습니다.' });

    // 단가/수량 변경 시 금액 재계산 + 합계 갱신
    const prId = rows[0].pr_id;
    const pid = parseInt(priId);
    await pool.query(`UPDATE purchase_request_item SET amount = COALESCE(order_qty, 0) * COALESCE(unit_price, 0) WHERE pri_id = $1`, [pid]);
    await pool.query(`
      UPDATE purchase_request SET total_amount = (
        SELECT COALESCE(SUM(amount), 0) FROM purchase_request_item WHERE pr_id = $1
      ) WHERE pr_id = $1
    `, [prId]);

    // 재조회하여 갱신된 amount 포함 반환
    const updated = await pool.query(`SELECT * FROM purchase_request_item WHERE pri_id = $1`, [pid]);
    return { data: updated.rows[0] };
  });

  // DELETE /api/purchase-requests/:id - 발주서 삭제 (DRAFT/배합원료 발주만)
  app.delete('/api/purchase-requests/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const prId = parseInt(id);

    const prRes = await pool.query(`SELECT * FROM purchase_request WHERE pr_id = $1`, [prId]);
    if (prRes.rows.length === 0) return reply.status(404).send({ error: '발주서를 찾을 수 없습니다.' });
    const pr = prRes.rows[0];

    // 입고 진행된 품목이 있으면 삭제 불가
    const receivedCheck = await pool.query(
      `SELECT COUNT(*) as cnt FROM purchase_request_item WHERE pr_id = $1 AND receiving_status NOT IN ('PENDING') AND receiving_status IS NOT NULL`,
      [prId]
    );
    if (parseInt(receivedCheck.rows[0].cnt) > 0) {
      return reply.status(400).send({ error: '입고 처리된 품목이 있어 삭제할 수 없습니다.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM purchase_request_item WHERE pr_id = $1`, [prId]);
      await client.query(`DELETE FROM approval WHERE doc_type = 'PURCHASE_REQUEST' AND doc_id = $1`, [prId]);
      await client.query(`DELETE FROM purchase_request WHERE pr_id = $1`, [prId]);
      await client.query('COMMIT');
      return { data: { message: `발주서 ${pr.pr_number} 삭제 완료` } };
    } catch (err: any) {
      await client.query('ROLLBACK');
      return reply.status(500).send({ error: err.message });
    } finally {
      client.release();
    }
  });

  // DELETE /api/purchase-requests/items/:priId - 발주 품목 삭제
  app.delete('/api/purchase-requests/items/:priId', async (req, reply) => {
    const { priId } = req.params as { priId: string };
    const { rows } = await pool.query(
      `DELETE FROM purchase_request_item WHERE pri_id = $1 RETURNING *`,
      [parseInt(priId)]
    );
    if (rows.length === 0) return reply.status(404).send({ error: '품목을 찾을 수 없습니다.' });
    return { data: rows[0], message: '삭제되었습니다.' };
  });

  // ────── 구조 목록 ──────

  app.get('/api/orders/structures', async () => {
    const { rows } = await pool.query(`
      SELECT cm.cert_id, cm.structure_code, cm.structure_name, cm.product_group,
             cm.install_position, cm.socket_name, cm.fire_rating,
             cm.opening_w_mm, cm.opening_h_mm, cm.penetration_w_mm, cm.penetration_h_mm,
             cm.install_qty, cm.sheet_thickness_prod, cm.cw_density_prod,
             (SELECT COUNT(*) FROM bom_master bm WHERE bm.cert_id = cm.cert_id) AS bom_count
      FROM certification_master cm WHERE cm.is_active = true
      ORDER BY cm.product_group, cm.structure_code
    `);
    return { data: rows };
  });

  // ────── Excel 발주서 업로드 ──────

  app.post('/api/orders/upload-excel', async (req, reply) => {
    const confirm = (req.query as { confirm?: string }).confirm === 'true';
    const file = await req.file();
    if (!file) {
      return reply.status(400).send({ error: 'Bad Request', message: '파일이 첨부되지 않았습니다.' });
    }

    const buffer = await file.toBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

    // Load certification_master for auto-matching
    const certRows = (await pool.query(`
      SELECT cert_id, cert_number, structure_code, structure_name, install_position,
             penetration_w_mm, penetration_h_mm, opening_w_mm, opening_h_mm, install_qty
      FROM certification_master WHERE is_active = true
    `)).rows;

    function autoMatchStructure(installPos: string, w: number, h: number): { cert_id: number; structure_code: string; cert_number: string } | null {
      // Map Korean install position to DB values
      let dbInstallPos: string;
      if (installPos === '입상' || installPos === '바닥' || installPos.includes('바닥')) {
        dbInstallPos = '수평바닥';
      } else {
        dbInstallPos = '수직벽체';
      }

      const orderArea = w * h; // mm² 단위 관통면적

      // 면적 기반 매칭:
      // - 시험은 4:1 비율(가장 취약한 내화조건)로 진행
      // - 비율 관계없이 면적 이하면 적용 가능
      // - 1.69m²(1,690,000mm²)는 최대 시험면적이므로 그 이상도 적용 가능
      const MAX_TEST_AREA = 1_690_000; // 1.69m² in mm²

      const candidates = certRows.filter((c: any) => {
        if (c.install_position !== dbInstallPos) return false;
        if (!c.penetration_w_mm || !c.penetration_h_mm) return false;
        const certArea = c.penetration_w_mm * c.penetration_h_mm;
        // 1.69m² 구조: 최대 시험면적이므로 모든 크기 수용 가능
        if (certArea >= MAX_TEST_AREA) return true;
        // 그 외: 관통 면적이 인정 면적 이하여야 함
        return orderArea <= certArea;
      });

      if (candidates.length === 0) return null;

      // Pick the smallest fitting structure (best match)
      candidates.sort((a: any, b: any) => {
        const areaA = a.penetration_w_mm * a.penetration_h_mm;
        const areaB = b.penetration_w_mm * b.penetration_h_mm;
        return areaA - areaB;
      });

      const best = candidates[0];
      return { cert_id: best.cert_id, structure_code: best.structure_code, cert_number: best.cert_number };
    }

    function parseExcelDate(val: any): string | null {
      if (!val) return null;
      if (val instanceof Date) {
        return val.toISOString().slice(0, 10);
      }
      const s = String(val).trim();
      // Try YYYY-MM-DD or YYYY.MM.DD or YYYY/MM/DD
      const m = s.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
      if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
      return null;
    }

    function cellVal(sheet: XLSX.WorkSheet, r: number, c: number): any {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      return cell ? cell.v : null;
    }

    function cellStr(sheet: XLSX.WorkSheet, r: number, c: number): string {
      const v = cellVal(sheet, r, c);
      return v != null ? String(v).trim() : '';
    }

    const sheets: any[] = [];

    for (const sheetName of workbook.SheetNames) {
      const ws = workbook.Sheets[sheetName];
      if (!ws) continue;

      // Extract header info from 이지원 standard 발주서 format
      let projectName = '';
      let customerName = '';
      let orderDate: string | null = null;

      // Row 11, col 3: 현장명 (공사현장 섹션)
      projectName = cellStr(ws, 11, 3) || '';
      // Fallback: Row 20, col 3
      if (!projectName) projectName = cellStr(ws, 20, 3) || '';

      // Row 4, col 14: 업체명 (발주처 섹션)
      customerName = cellStr(ws, 4, 14) || '';
      // Fallback: Row 3, col 11~14 area
      if (!customerName) {
        for (let r = 3; r <= 6; r++) {
          for (let c = 0; c <= 16; c++) {
            const v = cellStr(ws, r, c);
            if (v && (v.includes('업체명') || v.includes('발주처'))) {
              customerName = cellStr(ws, r, c + 1) || cellStr(ws, r, c + 2) || '';
              break;
            }
          }
          if (customerName) break;
        }
      }
      // Fallback: Row 20 건설사/설비사
      if (!customerName) {
        customerName = cellStr(ws, 20, 15) || cellStr(ws, 20, 3) || '';
      }

      // Row 5, col 4: 발주일자
      const dateRaw = cellStr(ws, 5, 4);
      if (dateRaw) {
        // Parse "2026 년 03 월 26 일" format
        const m = dateRaw.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
        if (m) {
          orderDate = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
        }
      }
      // Fallback: search rows 3-6 for date
      if (!orderDate) {
        for (let r = 3; r <= 6; r++) {
          for (let c = 0; c <= 5; c++) {
            const v = cellStr(ws, r, c);
            if (v && (v.includes('일자') || v.includes('날짜'))) {
              orderDate = parseExcelDate(cellVal(ws, r, c + 1) || cellVal(ws, r, c + 2));
              if (orderDate) break;
            }
          }
          if (orderDate) break;
        }
      }

      // If still no project name, use sheet name
      if (!projectName) projectName = sheetName;
      if (!orderDate) orderDate = new Date().toISOString().slice(0, 10);

      // Parse data rows starting from row 27 (0-indexed)
      const items: any[] = [];
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const maxRow = range.e.r;

      // ── Phase 1: 숨겨진 Z~AD 열의 상세 데이터가 있는지 확인 ──
      // Z(25)=면적, AA(26)=구조코드, AB(27)=관통W, AC(28)=관통H, AD(29)=수량
      const hiddenItems: any[] = [];
      const mainRowContext: Record<number, { material: string; installPos: string; insulation: string; location: string; openingW: number | null; openingH: number | null }> = {};

      for (let r = 27; r <= maxRow; r++) {
        const noVal = cellVal(ws, r, 0);
        if (noVal != null && String(noVal).includes('■')) break;

        // 메인 행 컨텍스트 저장 (B~V 열에 데이터가 있는 행)
        const material = cellStr(ws, r, 1);
        const installPos = cellStr(ws, r, 3);
        if (material || installPos) {
          mainRowContext[r] = {
            material,
            installPos,
            insulation: cellStr(ws, r, 19),
            location: cellStr(ws, r, 21),
            openingW: parseFloat(cellStr(ws, r, 9)) || null,
            openingH: parseFloat(cellStr(ws, r, 11)) || null,
          };
        }

        // Z~AD 열 읽기
        const hiddenCode = cellStr(ws, r, 26);  // AA: 구조코드
        const hiddenW = parseFloat(cellStr(ws, r, 27)) || 0;  // AB: 관통W
        const hiddenH = parseFloat(cellStr(ws, r, 28)) || 0;  // AC: 관통H
        const hiddenQty = parseFloat(cellStr(ws, r, 29)) || 0; // AD: 수량
        if (hiddenCode && hiddenW > 0 && hiddenH > 0 && hiddenQty > 0) {
          hiddenItems.push({ row: r, structure_code: hiddenCode, w_mm: hiddenW, h_mm: hiddenH, qty: hiddenQty });
        }
      }

      const useHiddenData = hiddenItems.length > 0;

      if (useHiddenData) {
        // ── Z~AD 상세 데이터 기반 파싱 ──
        // 가장 가까운 메인 행의 컨텍스트(material, installPos 등) 찾기
        const contextRows = Object.keys(mainRowContext).map(Number).sort((a, b) => a - b);

        let itemNo = 0;
        for (const hi of hiddenItems) {
          itemNo++;
          // 가장 가까운 이전 메인 행 컨텍스트 찾기
          let ctx = { material: '', installPos: '', insulation: '', location: '', openingW: null as number | null, openingH: null as number | null };
          for (const cr of contextRows) {
            if (cr <= hi.row) ctx = mainRowContext[cr];
            else break;
          }

          // 구조코드에서 설치위치 판별 (H로 시작하면 입상/바닥, V로 시작하면 벽체)
          const isFloor = hi.structure_code.startsWith('H');
          const installPos = isFloor ? '바닥/차열' : '벽체/차열';

          let match: { cert_id: number; structure_code: string; cert_number: string } | null = null;
          const directMatch = certRows.find((c: any) => c.structure_code === hi.structure_code);
          if (directMatch) {
            match = { cert_id: directMatch.cert_id, structure_code: directMatch.structure_code, cert_number: directMatch.cert_number || '' };
          }
          if (!match) {
            match = autoMatchStructure(installPos, hi.w_mm, hi.h_mm);
          }

          items.push({
            no: itemNo,
            material: ctx.material || null,
            install_pos: installPos || null,
            w_mm: hi.w_mm,
            h_mm: hi.h_mm,
            opening_w: ctx.openingW,
            opening_h: ctx.openingH,
            qty: hi.qty,
            structure_code: match?.structure_code || hi.structure_code || null,
            cert_id: match?.cert_id || null,
            cert_number: match?.cert_number || '',
            insulation: ctx.insulation || '',
            location: ctx.location || '',
            note: '',
          });
        }
      } else {
        // ── 기존 방식: A~V 열 파싱 (Z~AD 없는 엑셀) ──
        for (let r = 27; r <= maxRow; r++) {
          const noVal = cellVal(ws, r, 0);
          if (noVal == null || noVal === '' || String(noVal).includes('■')) break;
          const no = typeof noVal === 'number' ? noVal : parseInt(String(noVal), 10);
          if (isNaN(no)) break;

          const material = cellStr(ws, r, 1);
          const installPos = cellStr(ws, r, 3);
          const w = parseFloat(cellStr(ws, r, 5)) || 0;
          const h = parseFloat(cellStr(ws, r, 7)) || 0;
          const openingW = parseFloat(cellStr(ws, r, 9)) || null;
          const openingH = parseFloat(cellStr(ws, r, 11)) || null;
          const qtyVal = parseFloat(cellStr(ws, r, 13));
          const qty = isNaN(qtyVal) || qtyVal <= 0 ? 1 : qtyVal;
          const structureCodeShort = cellStr(ws, r, 14);
          const certNumber = cellStr(ws, r, 16);
          const insulation = cellStr(ws, r, 19);
          const location = cellStr(ws, r, 21);

          if (!material && !installPos && w === 0 && h === 0 && !structureCodeShort) continue;

          let match: { cert_id: number; structure_code: string; cert_number: string } | null = null;
          if (structureCodeShort) {
            const directMatch = certRows.find((c: any) => c.structure_code === structureCodeShort);
            if (directMatch) {
              match = { cert_id: directMatch.cert_id, structure_code: directMatch.structure_code, cert_number: directMatch.cert_number || '' };
            }
          }
          if (!match && w > 0 && h > 0) {
            match = autoMatchStructure(installPos, w, h);
          }

          items.push({
            no,
            material: material || null,
            install_pos: installPos || null,
            w_mm: w || null,
            h_mm: h || null,
            opening_w: openingW,
            opening_h: openingH,
            qty,
            structure_code: match?.structure_code || structureCodeShort || null,
            cert_id: match?.cert_id || null,
            cert_number: match?.cert_number || certNumber || '',
            insulation: insulation || '',
            location: location || '',
            note: '',
          });
        }
      }

      const wallCount = items.filter(i => i.install_pos?.includes('벽체')).length;
      const floorCount = items.filter(i => i.install_pos?.includes('바닥') || i.install_pos?.includes('입상')).length;

      sheets.push({
        sheet_name: sheetName,
        project_name: projectName,
        customer_name: customerName,
        order_date: orderDate,
        items,
        summary: {
          total_items: items.length,
          wall: wallCount,
          floor: floorCount,
        },
      });
    }

    // If confirm=true, create a SINGLE sales order merging all sheets
    if (confirm) {
      // ── 중복 업로드 방지: 동일 프로젝트명+고객명+총세트수 조합이 이미 존재하면 차단 ──
      const firstSheet = sheets.find((s: any) => s.items.length > 0);
      if (firstSheet) {
        const totalSetsCheck = sheets.reduce((a: number, s: any) =>
          a + s.items.reduce((b: number, i: any) => b + (i.qty || 1), 0), 0);
        const dupCheck = await pool.query(
          `SELECT order_id, order_number FROM sales_order
           WHERE project_name = $1 AND customer_name = $2 AND total_sets = $3
             AND status != 'CANCELLED'
           LIMIT 1`,
          [firstSheet.project_name, firstSheet.customer_name, totalSetsCheck]
        );
        if (dupCheck.rows.length > 0) {
          return reply.status(409).send({
            error: 'Conflict',
            message: `동일한 발주서가 이미 등록되어 있습니다 (${dupCheck.rows[0].order_number}). 중복 업로드를 방지합니다.`,
            existing_order: dupCheck.rows[0],
          });
        }
      }

      // Merge all items from all sheets into one order
      const allItems: any[] = [];
      let mainProject = '';
      let mainCustomer = '';
      let mainDate = new Date().toISOString().slice(0, 10);
      const sheetNames: string[] = [];

      for (const sheet of sheets) {
        if (sheet.items.length === 0) continue;
        sheetNames.push(sheet.sheet_name);
        // Use first sheet's info as the main order info
        if (!mainProject) mainProject = sheet.project_name;
        if (!mainCustomer) mainCustomer = sheet.customer_name;
        if (sheet.order_date) mainDate = sheet.order_date;

        for (const item of sheet.items) {
          allItems.push({ ...item, sheet_name: sheet.sheet_name });
        }
      }

      if (allItems.length === 0) {
        return { data: { sheets, created_orders: [] } };
      }

      const dateStr = mainDate.replace(/-/g, '').slice(2);
      const seqRes = await pool.query(
        `SELECT COUNT(*) + 1 AS seq FROM sales_order WHERE order_number LIKE $1`,
        [`SO-${dateStr}-%`]
      );
      const seq = String(seqRes.rows[0].seq).padStart(3, '0');
      const orderNumber = `SO-${dateStr}-${seq}`;
      const totalSets = allItems.reduce((s: number, i: any) => s + (i.qty || 1), 0);

      const result = await pool.query(`
        INSERT INTO sales_order (order_number, order_date, customer_name, project_name, remarks, total_sets)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
      `, [orderNumber, mainDate, mainCustomer, mainProject,
          `엑셀업로드: ${sheetNames.join(', ')}`, totalSets]);

      const orderId = result.rows[0].order_id;

      for (let idx = 0; idx < allItems.length; idx++) {
        const item = allItems[idx];
        if (!item.cert_id) continue;  // Skip items without matched structure
        await pool.query(`
          INSERT INTO sales_order_item (order_id, cert_id, structure_code, qty,
            opening_w_mm, opening_h_mm, penetration_w_mm, penetration_h_mm, spec_note, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          orderId, item.cert_id, item.structure_code, item.qty,
          item.opening_w || null, item.opening_h || null,
          item.w_mm || null, item.h_mm || null,
          [item.material, item.insulation, item.location, `[${item.sheet_name}]`].filter(Boolean).join(' | ') || null,
          idx,
        ]);
      }

      const createdOrders = [{ order_id: orderId, order_number: orderNumber }];
      return { data: { sheets, created_orders: createdOrders } };
    }

    return { data: { sheets } };
  });

  // ────── BOM 기반 작업지시 일괄 생성 ──────

  app.post('/api/orders/:id/generate-work-orders', async (req, reply) => {
    const { id } = req.params as { id: string };
    const orderId = parseInt(id, 10);

    // Get sales order
    const orderRes = await pool.query(`SELECT * FROM sales_order WHERE order_id = $1`, [orderId]);
    if (orderRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '수주를 찾을 수 없습니다.' });
    }
    const order = orderRes.rows[0];

    // ── 중복 생성 방지: 이미 해당 주문에 작업지시가 있으면 차단 ──
    const existingWO = await pool.query(
      `SELECT wo_id, wo_number FROM work_order WHERE order_id = $1 LIMIT 1`,
      [orderId]
    );
    if (existingWO.rows.length > 0) {
      return reply.status(409).send({
        error: 'Conflict',
        message: `이미 작업지시가 생성되었습니다 (${existingWO.rows[0].wo_number} 등). 기존 작업지시를 삭제 후 재생성하세요.`
      });
    }

    // Get BOM results
    const bomRes = await pool.query(`
      SELECT obr.*, im.roll_length_m, im.roll_spec FROM order_bom_result obr LEFT JOIN item_master im ON im.item_id = obr.item_id WHERE obr.order_id = $1 ORDER BY obr.item_category, obr.item_code
    `, [orderId]);
    if (bomRes.rows.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'BOM 전개 결과가 없습니다. 먼저 BOM 전개를 실행하세요.' });
    }

    const plannedDate = order.delivery_date
      ? new Date(new Date(order.delivery_date).getTime() - 7 * 86400000).toISOString().slice(0, 10)
      : new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    const remarkBase = `BOM자동생성 - ${order.order_number}`;
    const createdWOs: any[] = [];

    // Helper to generate WO number
    async function genWoNum(processCode: string, woDate: string): Promise<string> {
      const dateStr = woDate.replace(/-/g, '');
      const result = await pool.query(
        `SELECT COUNT(*) as cnt FROM work_order WHERE process_code = $1 AND wo_date = $2`,
        [processCode, woDate]
      );
      const seq = parseInt(result.rows[0].cnt, 10) + 1;
      return `WO-${processCode}-${dateStr}-${String(seq).padStart(3, '0')}`;
    }

    // Group BOM items by category to determine which processes are needed
    const rmItems = bomRes.rows.filter((r: any) => r.item_category === 'RM');
    const saItems = bomRes.rows.filter((r: any) => r.item_category === 'SA');
    const fpItems = bomRes.rows.filter((r: any) => r.item_category === 'FP');

    // Determine needed SA sub-types
    const saExtItems = saItems.filter((r: any) => r.item_code?.startsWith('SA-EXT'));
    const saCutItems = saItems.filter((r: any) => r.item_code?.startsWith('SA-CUT'));

    // 1. MIX work orders - if RM materials exist
    if (rmItems.length > 0) {
      const totalRmQty = rmItems.reduce((s: number, r: any) => s + parseFloat(r.required_qty || 0), 0);
      const woNumber = await genWoNum('MIX', plannedDate);
      const rmNames = rmItems.map((r: any) => r.item_name).join(', ').slice(0, 500);
      const res = await pool.query(`
        INSERT INTO work_order (wo_number, wo_date, process_code, order_id, planned_qty, status,
          customer_name, remarks, product_type, spec_detail)
        VALUES ($1, $2, 'MIX', $3, $4, 'PLANNED', $5, $6, 'MIX', $7) RETURNING *
      `, [woNumber, plannedDate, orderId, Math.round(totalRmQty * 100) / 100,
          order.customer_name, remarkBase, rmNames]);
      createdWOs.push(res.rows[0]);
    }

    // 2. EXT work orders - if SA-EXT materials exist
    if (saExtItems.length > 0) {
      for (const sa of saExtItems) {
        const woNumber = await genWoNum('EXT', plannedDate);
        const res = await pool.query(`
          INSERT INTO work_order (wo_number, wo_date, process_code, order_id, item_id, planned_qty,
            status, customer_name, remarks, product_type, spec_detail, structure_name)
          VALUES ($1, $2, 'EXT', $3, $4, $5, 'PLANNED', $6, $7, 'EXT', $8, $9) RETURNING *
        `, [woNumber, plannedDate, orderId, sa.item_id, Math.round(parseFloat(sa.required_qty) * 100) / 100,
            order.customer_name, remarkBase, sa.item_name, (sa.spec_detail || '').slice(0, 50)]);
        createdWOs.push(res.rows[0]);
      }
    }

    // 3. CUT work orders - if SA-CUT materials exist
    if (saCutItems.length > 0) {
      for (const sa of saCutItems) {
        const woNumber = await genWoNum('CUT', plannedDate);
        const res = await pool.query(`
          INSERT INTO work_order (wo_number, wo_date, process_code, order_id, item_id, planned_qty,
            status, customer_name, remarks, product_type, spec_detail, structure_name)
          VALUES ($1, $2, 'CUT', $3, $4, $5, 'PLANNED', $6, $7, 'CUT', $8, $9) RETURNING *
        `, [woNumber, plannedDate, orderId, sa.item_id, Math.round(parseFloat(sa.required_qty) * 100) / 100,
            order.customer_name, remarkBase, sa.item_name, (sa.spec_detail || '').slice(0, 50)]);
        createdWOs.push(res.rows[0]);
      }
    }

    // 4. ASM work orders - for each FP (finished product)
    if (fpItems.length > 0) {
      for (const fp of fpItems) {
        const woNumber = await genWoNum('ASM', plannedDate);
        const res = await pool.query(`
          INSERT INTO work_order (wo_number, wo_date, process_code, order_id, item_id, planned_qty,
            status, customer_name, remarks, product_type, spec_detail, structure_name)
          VALUES ($1, $2, 'ASM', $3, $4, $5, 'PLANNED', $6, $7, 'ASM', $8, $9) RETURNING *
        `, [woNumber, plannedDate, orderId, fp.item_id, Math.round(parseFloat(fp.required_qty) * 100) / 100,
            order.customer_name, remarkBase, fp.item_name, (fp.component_name || '').slice(0, 50)]);
        createdWOs.push(res.rows[0]);
      }
    }

    // Update order status
    await pool.query(`UPDATE sales_order SET status = 'IN_PRODUCTION' WHERE order_id = $1`, [orderId]);

    return {
      data: {
        order_id: orderId,
        order_number: order.order_number,
        work_orders_created: createdWOs.length,
        work_orders: createdWOs,
        summary: {
          MIX: createdWOs.filter(w => w.process_code === 'MIX').length,
          EXT: createdWOs.filter(w => w.process_code === 'EXT').length,
          CUT: createdWOs.filter(w => w.process_code === 'CUT').length,
          ASM: createdWOs.filter(w => w.process_code === 'ASM').length,
        },
      },
    };
  });

  // ─── 입고등록 API: 발주 품목 → LOT 생성 → 인수검사(PENDING) 자동 생성 ───

  // item_code → form_code 매핑
  const ITEM_FORM_MAP: Record<string, string> = {
    'RM-MB': 'D101-1',    // 난연컴파운드
    'RM-EG50': 'D102-1',  // 팽창흑연
    'RM-EA': 'D103-1',    // EVA-EA33045
    'RM-EP': 'D104-1',    // EVA-EP100
    'SM-GW-24': 'D122-1', 'SM-GW24': 'D122-1',   // 그라스울 (레거시)
    'SM-GW-24-14': 'D122-1',                      // 그라스울 24K W1400
    'SM-GW-24-10': 'D122-1',                      // 그라스울 24K W1000
    'SM-CW-96': 'D124-1', 'SM-CW96': 'D124-1',   // 세라믹울 96K (레거시)
    'SM-CW-96-25W2': 'D124-1',                    // 세라믹 96K t25 W200
    'SM-CW-96-25W3': 'D124-1',                    // 세라믹 96K t25 W300
    'SM-CW-96-50': 'D124-1',                      // 세라믹 96K t50 W600
    'SM-CW-96-38': 'D124-1',                      // 세라믹 96K t38 W600
    'SM-CW-128': 'D124-3', 'SM-CW128': 'D124-3', // 세라믹울 128K (레거시)
    'SM-CW-128-25': 'D124-3',                     // 세라믹 128K t25 W200
    'SM-CW-100': 'D124-1', 'SM-CW100': 'D124-1', // 세라믹울 100K → 96K 양식
    'SM-GP': 'D121-4', 'SM-GP-10': 'D121-4',  // 고정자재 → 강재류 양식
    'SM-SIL': 'D104-1',   // 실란트 → 기본 양식
    'SM-STL-I': 'D121-2', 'SM-STL-L': 'D121-2', 'SM-STL-Z': 'D121-2', // 강재류
    'SM-GI-I': 'D121-2', 'SM-GI-L': 'D121-2', 'SM-GI-Z': 'D121-2',   // 강재류 (레거시)
    'SM-GI-I-10': 'D121-2', 'SM-GI-Z-10': 'D121-2', 'SM-GI-L-10': 'D121-2', // 강재류 L1000
    'SM-BRK-TB': 'D121-2', 'SM-BRK-MD': 'D121-2', // 소켓 브라켓 → 강재류 양식
  };

  function resolveFormCode(itemCode: string, itemSubcategory?: string): string | null {
    if (ITEM_FORM_MAP[itemCode]) return ITEM_FORM_MAP[itemCode];
    // subcategory fallback
    if (itemSubcategory) {
      if (itemSubcategory.includes('세라믹')) return 'D124-1';
      if (itemSubcategory.includes('글라스') || itemSubcategory.includes('그라스')) return 'D122-1';
      if (itemSubcategory.includes('강재') || itemSubcategory.includes('브라켓')) return 'D121-2';
      if (itemSubcategory.includes('밀봉')) return 'D104-1';
    }
    return null;
  }

  // ─── 자체 로트번호 자동생성용 시퀀스 조회 ───
  app.get('/api/lot-next-number', async (request) => {
    const { prefix } = request.query as { prefix?: string };
    const pfx = prefix || 'EZ';
    const today = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const pattern = `${pfx}-${today}-%`;
    const seqResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM lot_transaction WHERE inspection_lot LIKE $1`,
      [pattern]
    );
    const seq = parseInt(seqResult.rows[0].cnt, 10) + 1;
    const nextNumber = `${pfx}-${today}-${String(seq).padStart(3, '0')}`;
    return { data: nextNumber };
  });

  // POST /api/purchase-requests/:prId/items/:priId/receive
  // 입고등록: LOT 생성 + 인수검사(PENDING) 자동 생성 → 인수검사 대기 연결
  app.post('/api/purchase-requests/:prId/items/:priId/receive', async (request, reply) => {
    const { prId, priId } = request.params as { prId: string; priId: string };
    const body = request.body as Record<string, unknown>;
    const receivedQty = parseFloat(body.received_qty as string) || 0;
    const supplierLot = (body.supplier_lot as string) || null;
    const inspectionLot = (body.inspection_lot as string) || null;
    const inspector = (body.inspector as string) || null;
    const receiveDate = (body.receive_date as string) || new Date().toISOString().slice(0, 10);

    if (receivedQty <= 0) {
      return reply.status(400).send({ error: 'Bad Request', message: '입고수량은 0보다 커야 합니다.' });
    }

    // 발주 품목 조회
    const priRes = await pool.query(
      `SELECT pri.*, im.item_category, im.item_subcategory, im.item_code as master_item_code
       FROM purchase_request_item pri
       LEFT JOIN item_master im ON im.item_id = pri.item_id
       WHERE pri.pri_id = $1 AND pri.pr_id = $2`,
      [priId, prId]
    );
    if (priRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '발주 품목을 찾을 수 없습니다.' });
    }
    const pri = priRes.rows[0];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. LOT 생성 (품목코드 기반)
      const dateStr = receiveDate.replace(/-/g, '').slice(2);
      const singleItemCode = pri.item_code || pri.master_item_code || '';
      const singleAbbrev = resolveLotAbbrev(singleItemCode);

      // inspectionLot이 이미 품목기반 형식이면 그대로 사용, 아니면 자동생성
      let lotNumber: string;
      if (inspectionLot && !inspectionLot.startsWith('EZ-')) {
        lotNumber = inspectionLot;
      } else {
        const lotPattern = `${dateStr}${singleAbbrev}%`;
        const seqResult = await client.query(
          `SELECT lot_number FROM lot_transaction WHERE lot_number LIKE $1 ORDER BY lot_number DESC LIMIT 1`,
          [lotPattern]
        );
        let seq = 1;
        if (seqResult.rows.length > 0) {
          const m = seqResult.rows[0].lot_number.match(/(\d{3})$/);
          if (m) seq = parseInt(m[1], 10) + 1;
        }
        lotNumber = `${dateStr}${singleAbbrev}${String(seq).padStart(3, '0')}`;
      }
      const finalInspLot = lotNumber;

      const lotResult = await client.query(
        `INSERT INTO lot_transaction (lot_number, lot_type, item_id, qty, unit, supplier_lot, inspection_lot, inspection_result, status, remaining_qty)
         VALUES ($1, 'IN', $2, $3, $4, $5, $6, 'PENDING', 'ACTIVE', $3)
         RETURNING *`,
        [lotNumber, pri.item_id, receivedQty, pri.unit || 'EA', supplierLot, finalInspLot]
      );
      const lot = lotResult.rows[0];

      // 2. 인수검사(PENDING) 자동 생성
      const formCode = resolveFormCode(pri.item_code || '', pri.item_subcategory);
      const inspResult = await client.query(
        `INSERT INTO inspection (insp_type, form_code, lot_id, sampling_n, accept_c, result, inspector, inspected_at)
         VALUES ('INCOMING', $1, $2, 3, 0, 'PENDING', $3, NULL)
         RETURNING *`,
        [formCode, lot.lot_id, inspector]
      );
      const insp = inspResult.rows[0];

      // 3. 인수검사 상세항목 자동 생성 (form preset 기반)
      if (formCode) {
        const preset = INCOMING_FORM_PRESETS.find(p => p.form_code === formCode);
        if (preset) {
          // 발주 spec_detail에서 소켓 본체 치수 추출 (W너비×H길이×높이Nmm)
          let specW: number | null = null;
          let specH: number | null = null;
          const specDetail = pri.spec_detail || pri.item_spec || '';
          console.log('[Receive] spec_detail for inspection:', JSON.stringify({ pri_id: pri.pri_id, item_code: pri.item_code, spec_detail: specDetail }));
          const wMatch = specDetail.match(/W(\d+(?:\.\d+)?)/);
          const hMatch = specDetail.match(/[×x,]\s*H(\d+(?:\.\d+)?)/i);
          if (wMatch) specW = parseFloat(wMatch[1]);
          if (hMatch) specH = parseFloat(hMatch[1]);
          console.log('[Receive] Extracted dimensions:', JSON.stringify({ specW, specH, wMatch: wMatch?.[0], hMatch: hMatch?.[0] }));

          for (const item of preset.items) {
            // 본체 길이/너비는 발주서 spec에서 가져온 치수를 기준값으로 사용
            let certStd = item.cert_standard ?? null;
            let direction = (item as any).direction || null;
            if (item.quality_item === '본체 길이' && specH != null) {
              certStd = specH;
            } else if (item.quality_item === '본체 너비' && specW != null) {
              certStd = specW;
            }

            await client.query(
              `INSERT INTO inspection_detail
               (insp_id, item_no, quality_item, check_item, check_method,
                cert_standard, unit, is_applicable, item_result, direction)
               VALUES ($1, $2, $3, $4, $5, $6, $7, true, 'NA', $8)`,
              [
                insp.insp_id,
                item.item_no,
                item.quality_item,
                item.check_item,
                item.check_method,
                certStd,
                item.unit,
                direction || 'MIN',
              ]
            );
          }
        }
      }

      // 4. purchase_request_item 상태 업데이트 (order_qty=0이면 입고수량으로 자동설정)
      const newReceivedQty = parseFloat(pri.received_qty || '0') + receivedQty;
      let orderQty = parseFloat(pri.order_qty || pri.required_qty || '0');
      if (orderQty <= 0) {
        orderQty = receivedQty;
        await client.query(`UPDATE purchase_request_item SET order_qty = $1, required_qty = $1 WHERE pri_id = $2`, [orderQty, pri.pri_id || priId]);
      }
      const newStatus = newReceivedQty >= orderQty ? 'RECEIVED' : 'PARTIAL';

      await client.query(
        `UPDATE purchase_request_item
         SET receiving_status = $1, received_qty = $2, received_at = NOW(), lot_id = $3, insp_id = $4
         WHERE pri_id = $5`,
        [newStatus, newReceivedQty, lot.lot_id, insp.insp_id, priId]
      );

      // 5. PR 전체 상태 확인 및 업데이트
      const allItems = await client.query(
        `SELECT receiving_status FROM purchase_request_item WHERE pr_id = $1`,
        [prId]
      );
      const allReceived = allItems.rows.every((r: any) => r.receiving_status === 'RECEIVED' || r.receiving_status === 'INSPECTED');
      const anyReceived = allItems.rows.some((r: any) => r.receiving_status !== 'PENDING');
      if (allReceived) {
        await client.query(`UPDATE purchase_request SET status = 'RECEIVED' WHERE pr_id = $1`, [prId]);
      } else if (anyReceived) {
        // 부분 입고 상태는 기존 status가 ORDERED 이상이면 유지
      }

      await client.query('COMMIT');

      return {
        data: {
          pri_id: parseInt(priId),
          lot_number: lot.lot_number,
          lot_id: lot.lot_id,
          supplier_lot: lot.supplier_lot,
          inspection_lot: lot.inspection_lot,
          insp_id: insp.insp_id,
          received_qty: receivedQty,
          receiving_status: newStatus,
          form_code: formCode,
          message: `입고 완료 (자체LOT: ${lot.inspection_lot}) → 인수검사 INS-${String(insp.insp_id).padStart(4, '0')} 자동 생성 (대기)`,
        },
      };
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[Receive] Error:', err);
      return reply.status(500).send({ error: 'Server Error', message: err.message });
    } finally {
      client.release();
    }
  });

  // POST /api/purchase-requests/:prId/preview-lots
  // 일괄 입고 전 LOT 번호 미리보기
  app.post('/api/purchase-requests/:prId/preview-lots', async (request, reply) => {
    const { prId } = request.params as { prId: string };
    const body = request.body as Record<string, unknown>;
    const priIds = body.pri_ids as number[];
    const receiveDate = (body.receive_date as string) || new Date().toISOString().slice(0, 10);
    const dateStr = receiveDate.replace(/-/g, '').slice(2);

    if (!priIds || !Array.isArray(priIds) || priIds.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: '품목을 선택하세요.' });
    }

    // 약호별 현재 시퀀스 조회
    const seqCache: Record<string, number> = {};

    const previews: any[] = [];
    for (const priId of priIds) {
      const priRes = await pool.query(
        `SELECT pri.pri_id, pri.item_code, pri.item_name, pri.order_qty, pri.unit,
                im.item_code as master_item_code
         FROM purchase_request_item pri
         LEFT JOIN item_master im ON im.item_id = pri.item_id
         WHERE pri.pri_id = $1 AND pri.pr_id = $2
         AND (pri.receiving_status IS NULL OR pri.receiving_status = 'PENDING')`,
        [priId, prId]
      );
      if (priRes.rows.length === 0) continue;
      const pri = priRes.rows[0];

      const itemCode = pri.item_code || pri.master_item_code || '';
      const abbrev = resolveLotAbbrev(itemCode);

      // 시퀀스 계산 (같은 약호끼리 누적)
      if (!(abbrev in seqCache)) {
        const seqRes = await pool.query(
          `SELECT lot_number FROM lot_transaction WHERE lot_number LIKE $1 ORDER BY lot_number DESC LIMIT 1`,
          [`${dateStr}${abbrev}%`]
        );
        const match = seqRes.rows[0]?.lot_number?.match(/(\d{3})$/);
        seqCache[abbrev] = match ? parseInt(match[1], 10) + 1 : 1;
      } else {
        seqCache[abbrev]++;
      }

      const lotNumber = `${dateStr}${abbrev}${String(seqCache[abbrev]).padStart(3, '0')}`;

      previews.push({
        pri_id: pri.pri_id,
        item_code: itemCode,
        item_name: pri.item_name,
        order_qty: pri.order_qty,
        unit: pri.unit,
        abbrev,
        lot_number: lotNumber,
      });
    }

    return { data: previews };
  });

  // POST /api/purchase-requests/:prId/receive-batch
  // 일괄 입고등록: 여러 품목을 한 번에 입고 처리
  app.post('/api/purchase-requests/:prId/receive-batch', async (request, reply) => {
    const { prId } = request.params as { prId: string };
    const body = request.body as Record<string, unknown>;
    const items = body.items as Array<{ pri_id: number; received_qty: number; supplier_lot?: string }>;
    const inspector = (body.inspector as string) || null;
    const receiveDate = (body.receive_date as string) || new Date().toISOString().slice(0, 10);

    if (!items || !Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: '입고할 품목을 선택하세요.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const dateStr = receiveDate.replace(/-/g, '').slice(2);
      const results: any[] = [];

      for (const reqItem of items) {
        const receivedQty = parseFloat(String(reqItem.received_qty)) || 0;
        if (receivedQty <= 0) continue;

        const priRes = await client.query(
          `SELECT pri.*, im.item_category, im.item_subcategory, im.item_code as master_item_code
           FROM purchase_request_item pri
           LEFT JOIN item_master im ON im.item_id = pri.item_id
           WHERE pri.pri_id = $1 AND pri.pr_id = $2`,
          [reqItem.pri_id, prId]
        );
        if (priRes.rows.length === 0) continue;
        const pri = priRes.rows[0];

        // 이미 입고된 품목은 건너뜀
        if (pri.receiving_status === 'RECEIVED' || pri.receiving_status === 'INSPECTED') continue;

        // 품목코드 기반 LOT 약호
        const itemCode = pri.item_code || pri.master_item_code || '';
        const abbrev = resolveLotAbbrev(itemCode);

        // LOT 번호: 입고날짜 + 약호 + 시퀀스 (예: 260413MB001)
        const lotPattern = `${dateStr}${abbrev}%`;
        const seqResult = await client.query(
          `SELECT lot_number FROM lot_transaction WHERE lot_number LIKE $1 ORDER BY lot_number DESC LIMIT 1`,
          [lotPattern]
        );
        let seq = 1;
        if (seqResult.rows.length > 0) {
          const match = seqResult.rows[0].lot_number.match(/(\d{3})$/);
          if (match) seq = parseInt(match[1], 10) + 1;
        }
        // 프론트에서 커스텀 LOT를 넘겨준 경우 우선 사용
        const lotNumber = (reqItem as any).custom_lot || `${dateStr}${abbrev}${String(seq).padStart(3, '0')}`;

        // 자체 관리 로트번호 (inspection_lot)도 동일 규칙
        const finalInspLot = lotNumber;

        const supplierLot = reqItem.supplier_lot || null;

        const lotResult = await client.query(
          `INSERT INTO lot_transaction (lot_number, lot_type, item_id, qty, unit, supplier_lot, inspection_lot, inspection_result, status, remaining_qty)
           VALUES ($1, 'IN', $2, $3, $4, $5, $6, 'PENDING', 'ACTIVE', $3)
           RETURNING *`,
          [lotNumber, pri.item_id, receivedQty, pri.unit || 'EA', supplierLot, finalInspLot]
        );
        const lot = lotResult.rows[0];

        // 인수검사 자동 생성
        const formCode = resolveFormCode(pri.item_code || '', pri.item_subcategory);
        const inspResult = await client.query(
          `INSERT INTO inspection (insp_type, form_code, lot_id, sampling_n, accept_c, result, inspector, inspected_at)
           VALUES ('INCOMING', $1, $2, 3, 0, 'PENDING', $3, NULL)
           RETURNING *`,
          [formCode, lot.lot_id, inspector]
        );
        const insp = inspResult.rows[0];

        // 검사 상세항목 자동 생성
        if (formCode) {
          const preset = INCOMING_FORM_PRESETS.find(p => p.form_code === formCode);
          if (preset) {
            let specW: number | null = null;
            let specH: number | null = null;
            const specDetail = pri.spec_detail || pri.item_spec || '';
            const wMatch = specDetail.match(/W(\d+(?:\.\d+)?)/);
            const hMatch = specDetail.match(/[×x,]\s*H(\d+(?:\.\d+)?)/i);
            if (wMatch) specW = parseFloat(wMatch[1]);
            if (hMatch) specH = parseFloat(hMatch[1]);

            for (const detailItem of preset.items) {
              let certStd = detailItem.cert_standard ?? null;
              let direction = (detailItem as any).direction || null;
              if (detailItem.quality_item === '본체 길이' && specH != null) {
                certStd = specH;
              } else if (detailItem.quality_item === '본체 너비' && specW != null) {
                certStd = specW;
              }
              await client.query(
                `INSERT INTO inspection_detail
                 (insp_id, item_no, quality_item, check_item, check_method,
                  cert_standard, unit, is_applicable, item_result, direction)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, true, 'NA', $8)`,
                [insp.insp_id, detailItem.item_no, detailItem.quality_item, detailItem.check_item,
                 detailItem.check_method, certStd, detailItem.unit, direction || 'MIN']
              );
            }
          }
        }

        // 품목 상태 업데이트
        const newReceivedQty = parseFloat(pri.received_qty || '0') + receivedQty;
        const orderQty = parseFloat(pri.order_qty || pri.required_qty || '0');
        const newStatus = newReceivedQty >= orderQty ? 'RECEIVED' : 'PARTIAL';

        await client.query(
          `UPDATE purchase_request_item
           SET receiving_status = $1, received_qty = $2, received_at = NOW(), lot_id = $3, insp_id = $4
           WHERE pri_id = $5`,
          [newStatus, newReceivedQty, lot.lot_id, insp.insp_id, reqItem.pri_id]
        );

        results.push({
          pri_id: reqItem.pri_id,
          lot_number: lot.lot_number,
          inspection_lot: lot.inspection_lot,
          insp_id: insp.insp_id,
          received_qty: receivedQty,
          receiving_status: newStatus,
        });
      }

      // PR 전체 상태 확인
      const allItems = await client.query(
        `SELECT receiving_status FROM purchase_request_item WHERE pr_id = $1`,
        [prId]
      );
      const allReceived = allItems.rows.every((r: any) => r.receiving_status === 'RECEIVED' || r.receiving_status === 'INSPECTED');
      if (allReceived) {
        await client.query(`UPDATE purchase_request SET status = 'RECEIVED' WHERE pr_id = $1`, [prId]);
      }

      await client.query('COMMIT');

      return {
        data: {
          count: results.length,
          items: results,
          message: `${results.length}건 일괄 입고 완료`,
        },
      };
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[ReceiveBatch] Error:', err);
      return reply.status(500).send({ error: 'Server Error', message: err.message });
    } finally {
      client.release();
    }
  });

  // POST /api/purchase-requests/create-rm
  // 배합원료 전용 발주서 생성 (당일 날짜)
  app.post('/api/purchase-requests/create-rm', async (request, reply) => {
    const today = new Date().toISOString().slice(0, 10);
    const dateStr = today.replace(/-/g, '');

    // 번호 생성: PR-YYMMDD-NNN
    const seqRes = await pool.query(
      `SELECT COUNT(*) as cnt FROM purchase_request WHERE pr_number LIKE $1`,
      [`PR-${dateStr.slice(2)}-%`]
    );
    const seq = parseInt(seqRes.rows[0].cnt, 10) + 1;
    const prNumber = `PR-${dateStr.slice(2)}-${String(seq).padStart(3, '0')}`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 발주서 생성 (수주 미연결, 배합원료 전용)
      const prRes = await client.query(
        `INSERT INTO purchase_request (pr_number, pr_date, status, remarks)
         VALUES ($1, $2, 'DRAFT', '배합원료 발주')
         RETURNING *`,
        [prNumber, today]
      );
      const pr = prRes.rows[0];

      // RM 4종 품목 자동 추가
      const rmItems = await client.query(
        `SELECT item_id, item_code, item_name FROM item_master
         WHERE item_code IN ('RM-MB', 'RM-EG50', 'RM-EA', 'RM-EP')
         ORDER BY item_code`
      );

      // 현재고 조회
      for (const [idx, rm] of rmItems.rows.entries()) {
        const stockRes = await client.query(
          `SELECT COALESCE(SUM(GREATEST(remaining_qty, 0)), 0) as stock
           FROM lot_transaction WHERE item_id = $1 AND status = 'ACTIVE' AND remaining_qty > 0`,
          [rm.item_id]
        );
        const stock = parseFloat(stockRes.rows[0]?.stock || '0');

        await client.query(
          `INSERT INTO purchase_request_item (pr_id, item_id, item_code, item_name, required_qty, order_qty, unit, sort_order)
           VALUES ($1, $2, $3, $4, 0, 0, 'kg', $5)`,
          [pr.pr_id, rm.item_id, rm.item_code, rm.item_name, idx + 1]
        );
      }

      await client.query('COMMIT');
      return { data: pr };
    } catch (err: any) {
      await client.query('ROLLBACK');
      return reply.status(500).send({ error: 'Server Error', message: err.message });
    } finally {
      client.release();
    }
  });

  // GET /api/purchase-requests/:prId/rm-requirements
  // 배합원료(RM) 필요량 조회 (BOM 기반)
  app.get('/api/purchase-requests/:prId/rm-requirements', async (request, reply) => {
    const { prId } = request.params as { prId: string };

    // PR의 연결 수주 조회
    const prRes = await pool.query(
      `SELECT pr.order_id FROM purchase_request pr WHERE pr.pr_id = $1`, [prId]
    );
    if (prRes.rows.length === 0 || !prRes.rows[0].order_id) {
      return { data: [] };
    }
    const orderId = prRes.rows[0].order_id;

    // BOM 결과에서 RM 필요량
    const bomRes = await pool.query(
      `SELECT obr.item_code, obr.item_name, obr.required_qty, obr.unit,
              obr.current_stock, obr.shortage_qty, im.item_id
       FROM order_bom_result obr
       LEFT JOIN item_master im ON im.item_code = obr.item_code
       WHERE obr.order_id = $1 AND obr.item_code LIKE 'RM-%'
       ORDER BY obr.item_code`,
      [orderId]
    );

    // 이미 발주된 RM 품목 수량 조회
    const orderedRes = await pool.query(
      `SELECT pri.item_code, SUM(pri.order_qty) as ordered_qty
       FROM purchase_request_item pri
       JOIN purchase_request pr ON pr.pr_id = pri.pr_id
       WHERE pr.order_id = $1 AND pri.item_code LIKE 'RM-%'
       GROUP BY pri.item_code`,
      [orderId]
    );
    const orderedMap: Record<string, number> = {};
    for (const r of orderedRes.rows) {
      orderedMap[r.item_code] = parseFloat(r.ordered_qty);
    }

    // 현재 재고 조회
    const stockRes = await pool.query(
      `SELECT im.item_code,
              COALESCE(SUM(GREATEST(lt.remaining_qty, 0)), 0) as stock_qty
       FROM item_master im
       LEFT JOIN lot_transaction lt ON lt.item_id = im.item_id AND lt.status = 'ACTIVE' AND lt.remaining_qty > 0
       WHERE im.item_code LIKE 'RM-%'
       GROUP BY im.item_code`
    );
    const stockMap: Record<string, number> = {};
    for (const r of stockRes.rows) {
      stockMap[r.item_code] = parseFloat(r.stock_qty);
    }

    const items = bomRes.rows.map((r: any) => ({
      item_id: r.item_id,
      item_code: r.item_code,
      item_name: r.item_name,
      required_qty: parseFloat(r.required_qty),
      unit: r.unit,
      current_stock: stockMap[r.item_code] || 0,
      ordered_qty: orderedMap[r.item_code] || 0,
      shortage_qty: parseFloat(r.required_qty) - (stockMap[r.item_code] || 0),
    }));

    return { data: items };
  });

  // POST /api/purchase-requests/:prId/rm-order
  // 배합원료 발주입력 (RM 품목을 발주서에 추가)
  app.post('/api/purchase-requests/:prId/rm-order', async (request, reply) => {
    const { prId } = request.params as { prId: string };
    const body = request.body as Record<string, unknown>;
    const items = body.items as Array<{ item_id: number; item_code: string; item_name: string; order_qty: number; unit: string }>;

    if (!items || items.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: '발주할 원료를 입력하세요.' });
    }

    const prRes = await pool.query(`SELECT * FROM purchase_request WHERE pr_id = $1`, [prId]);
    if (prRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 기존 RM 품목 삭제 (재입력)
      await client.query(
        `DELETE FROM purchase_request_item WHERE pr_id = $1 AND item_code LIKE 'RM-%'`,
        [prId]
      );

      // 최대 sort_order 조회
      const maxSort = await client.query(
        `SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM purchase_request_item WHERE pr_id = $1`,
        [prId]
      );
      let sortOrder = parseInt(maxSort.rows[0].max_sort, 10);

      const created: any[] = [];
      for (const item of items) {
        if (!item.order_qty || item.order_qty <= 0) continue;
        sortOrder++;
        await client.query(
          `INSERT INTO purchase_request_item (pr_id, item_id, item_code, item_name, required_qty, order_qty, unit, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [prId, item.item_id, item.item_code, item.item_name, item.order_qty, item.order_qty, item.unit, sortOrder]
        );
        created.push({ item_code: item.item_code, order_qty: item.order_qty });
      }

      await client.query('COMMIT');
      return { data: { count: created.length, items: created, message: `배합원료 ${created.length}건 발주 입력 완료` } };
    } catch (err: any) {
      await client.query('ROLLBACK');
      return reply.status(500).send({ error: 'Server Error', message: err.message });
    } finally {
      client.release();
    }
  });

  // GET /api/purchase-requests/:prId/receiving-status
  // 발주서별 품목 입고/검사 상태 조회
  app.get('/api/purchase-requests/:prId/receiving-status', async (request, reply) => {
    const { prId } = request.params as { prId: string };
    const result = await pool.query(
      `SELECT pri.pri_id, pri.item_code, pri.item_name, pri.order_qty, pri.unit,
              pri.receiving_status, pri.received_qty, pri.received_at,
              pri.lot_id, pri.insp_id,
              lt.lot_number, lt.supplier_lot, lt.inspection_lot, lt.inspection_result,
              ins.result AS insp_result, ins.form_code, ins.inspector
       FROM purchase_request_item pri
       LEFT JOIN lot_transaction lt ON lt.lot_id = pri.lot_id
       LEFT JOIN inspection ins ON ins.insp_id = pri.insp_id
       WHERE pri.pr_id = $1
       ORDER BY pri.sort_order, pri.pri_id`,
      [prId]
    );
    return { data: result.rows };
  });

}
