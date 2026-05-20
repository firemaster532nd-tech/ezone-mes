import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import * as XLSX from 'xlsx';

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
      created_at       TIMESTAMPTZ DEFAULT now()
    );
  `);
  try { await pool.query(`ALTER TABLE order_bom_result ADD COLUMN calc_note TEXT`); } catch {}

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
      sort_order       INTEGER DEFAULT 0
    );
  `);
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
  cwDensity: number;      // 세라믹울 밀도 (kg/m³)
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
  const is0910 = d.certVersion?.includes('0910') || d.certVersion?.includes('09');
  const is0310 = !is0910;

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
  const socketH = isFloor ? 300 : 200;
  lines.push({
    component: '금속소켓 본체',
    item_code: '__FP_SOCKET__',
    qty: d.N,
    unit: 'EA',
    length_mm: d.W,
    width_mm: d.H,
    spec: `아연도금강판 t1.6, ${Math.floor(d.W/d.N)}×${d.H}×${socketH}`,
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

  // ── 4. 브라켓 ──
  let bracketQty: number;
  if (isWall && d.N >= 2 && is0910) {
    bracketQty = 3;  // VAG-1.69: 상하2+중앙1
  } else if (isWall && d.N >= 2 && is0310) {
    bracketQty = 28; // VT-01: 받침대4+브라켓28 → 구조DB 기준 조정
  } else if (isFloor && d.N >= 2) {
    bracketQty = 6;  // HTG-1.69
  } else if (isFloor) {
    bracketQty = 2;  // HTG(DC)-064, HTG-064
  } else {
    bracketQty = 2;  // 벽체 소형
  }
  lines.push({
    component: '브라켓(고정구)', item_code: 'SM-STL-I', qty: bracketQty, unit: 'EA',
    spec: `아연도금 t0.6~1.6, W${isFloor ? 265 : sheetW < 195 ? 190 : 195}`,
    calc: `${bracketQty}EA (구조별 고정)`,
  });

  // ── 5. 세라믹블랭킷 (소켓 외부, 25T) ── 벽체 구조에 적용
  // 공식: EA × 규격길이 / 1000 = M
  // 0310: 25×200×L, 0910 입상: 25×300×L
  const cbWidth = is0910 && isFloor ? 300 : 200;  // 세라믹블랭킷 너비
  if (isWall && d.N === 1) {
    // 소형 벽체: 상하2+좌우2
    const cbTBL = d.W + 60;
    const cbLRL = d.H;
    const cbTBM = Math.round(2 * cbTBL / 1000 * 100) / 100;
    const cbLRM = Math.round(2 * cbLRL / 1000 * 100) / 100;
    const cbTotalM = Math.round((cbTBM + cbLRM) * 100) / 100;
    lines.push({
      component: '세라믹블랭킷(상하)', item_code: 'SM-CW-96', qty: cbTBM, unit: 'M',
      length_mm: cbTBL, width_mm: cbWidth,
      spec: `밀도96kg/m³, 두께25mm, W${cbWidth}, L${cbTBL}`,
      calc: `상하2EA × ${cbTBL}mm ÷ 1000 = ${cbTBM}M`,
    });
    lines.push({
      component: '세라믹블랭킷(좌우)', item_code: 'SM-CW-96', qty: cbLRM, unit: 'M',
      length_mm: cbLRL, width_mm: cbWidth,
      spec: `밀도96kg/m³, 두께25mm, W${cbWidth}, L${cbLRL}`,
      calc: `좌우2EA × ${cbLRL}mm ÷ 1000 = ${cbLRM}M`,
    });
  } else if (isWall && d.N >= 2) {
    // 대형 벽체(VAG, VT-01): 상하2+좌우2
    const cbTBL = is0910 ? Math.floor(d.W / 2) + 30 : d.W + 60;
    const cbLRL = d.H;
    const cbTBM = Math.round(2 * cbTBL / 1000 * 100) / 100;
    const cbLRM = Math.round(2 * cbLRL / 1000 * 100) / 100;
    lines.push({
      component: '세라믹블랭킷(상하)', item_code: 'SM-CW-96', qty: cbTBM, unit: 'M',
      length_mm: cbTBL, width_mm: cbWidth,
      spec: `밀도96kg/m³, 두께25mm, W${cbWidth}, L${cbTBL}`,
      calc: `상하2EA × ${cbTBL}mm ÷ 1000 = ${cbTBM}M`,
    });
    lines.push({
      component: '세라믹블랭킷(좌우)', item_code: 'SM-CW-96', qty: cbLRM, unit: 'M',
      length_mm: cbLRL, width_mm: cbWidth,
      spec: `밀도96kg/m³, 두께25mm, W${cbWidth}, L${cbLRL}`,
      calc: `좌우2EA × ${cbLRL}mm ÷ 1000 = ${cbLRM}M`,
    });
  } else if (isFloor) {
    // 바닥형: HTG-1.69, HTG-064에서 세라믹블랭킷 사용 (300W)
    const cbTBL = d.W + 60;
    const cbLRL = d.H;
    const cbTBM = Math.round(2 * cbTBL / 1000 * 100) / 100;
    const cbLRM = Math.round(2 * cbLRL / 1000 * 100) / 100;
    lines.push({
      component: '세라믹블랭킷(상하)', item_code: 'SM-CW-96', qty: cbTBM, unit: 'M',
      length_mm: cbTBL, width_mm: cbWidth,
      spec: `밀도96kg/m³, 두께25mm, W${cbWidth}, L${cbTBL}`,
      calc: `상하2EA × ${cbTBL}mm ÷ 1000 = ${cbTBM}M`,
    });
    lines.push({
      component: '세라믹블랭킷(좌우)', item_code: 'SM-CW-96', qty: cbLRM, unit: 'M',
      length_mm: cbLRL, width_mm: cbWidth,
      spec: `밀도96kg/m³, 두께25mm, W${cbWidth}, L${cbLRL}`,
      calc: `좌우2EA × ${cbLRL}mm ÷ 1000 = ${cbLRM}M`,
    });
  }

  // ── 6. 방화플래싱 ──
  // REV-008 교차검증 기준 (RPT-005 산정기준_벽체)
  // 벽체: 1면둘레 = (W+250)×2 + H×2, 양면 ×2, 로스 적용, 올림
  // 바닥: Z형 ROUNDUP(둘레÷1000)×2, L형(DC) ROUNDUP(둘레÷1000)
  const lossRate = d.lossRate ?? 10;  // 기본 10% (최적재단)
  const plus60 = d.flashingPlus60 ?? false;

  if (isWall) {
    // 벽체: 일반형 (I형) — REV-008 기본원칙
    const flash = calcFlashingWall(d.W, d.H, plus60, lossRate);
    lines.push({
      component: '방화플래싱(일반)', item_code: 'FP-FL-I', qty: flash.qty, unit: 'EA',
      length_mm: 1000, width_mm: 125,
      spec: `강판0.5t + 차열시트${sheetT}t, W125, L1000, 양면시공`,
      calc: flash.calc,
    });
  } else {
    // 바닥형: Z형 (상하면) 또는 L형 (DC 선시공)
    const isDC = d.structureCode?.includes('DC');
    if (isDC) {
      // HTG(DC): L형 — 1면만
      const theoryQty = Math.ceil(perimeter / 1000);
      const withLoss = Math.ceil(theoryQty * (1 + lossRate / 100));
      lines.push({
        component: '방화플래싱(L형)', item_code: 'FP-FL-I', qty: withLoss, unit: 'EA',
        length_mm: 1000, width_mm: 125,
        spec: `강판0.5t + 차열시트${sheetT}t, W125+W75, L1000`,
        calc: `L형: 둘레${perimeter}÷1000=ROUNDUP→${theoryQty}EA × 로스${lossRate}% = ${withLoss}EA`,
      });
    } else {
      // HTG-1.69, HTG-064: Z형 — 양면
      const theoryQty = Math.ceil(perimeter / 1000) * 2;
      const withLoss = Math.ceil(theoryQty * (1 + lossRate / 100));
      lines.push({
        component: '방화플래싱(Z형)', item_code: 'FP-FL-I', qty: withLoss, unit: 'EA',
        length_mm: 1000, width_mm: 125,
        spec: `강판0.5t + 차열시트${sheetT}t, W125+W170, L1000`,
        calc: `Z형: 둘레${perimeter}÷1000=ROUNDUP→${Math.ceil(perimeter/1000)} × 양면2 = ${theoryQty}EA × 로스${lossRate}% = ${withLoss}EA`,
      });
    }
  }

  // ── 7. 외부 보강대 (바닥형 전용) ──
  if (isFloor) {
    lines.push({
      component: '외부보강대', item_code: 'SM-STL-I', qty: 3, unit: 'EA',
      spec: `아연도금강판 t1.6, 30×${d.H - 5}`,
      calc: `좌/중/우 3EA (바닥형 전용)`,
    });
  }

  // ── 8. 글라스울 덕트보온재 ──
  // 공식: (관통재W + 관통재H) × 2 × 4면 ÷ 1000 ÷ 롤폭1.4 = M
  const gwDuctM = Math.round((d.W + d.H) * 2 * 4 / 1000 / 1.4 * 100) / 100;
  lines.push({
    component: '글라스울 덕트보온재(24K)', item_code: 'SM-GW-24', qty: gwDuctM, unit: 'M',
    spec: `밀도24kg/m³, 두께25mm, W1400(롤폭)`,
    calc: `(${d.W}+${d.H})×2×4면÷1000÷1.4=${gwDuctM}M`,
  });

  // ── 9. 지지구조 주변단열재 ──
  // 그라스울 1단 (25T×1400 또는 25T×1000) + 세라믹차열재 2단 (50T×600 또는 38T×600)
  const cwCode = d.cwDensity >= 120 ? 'SM-CW-128' : 'SM-CW-96';
  const cwDensityLabel = d.cwDensity >= 120 ? '128' : '96';

  if (isWall) {
    // 벽체: 세라믹차열재 전체보온 (50×전체보온)
    // 공식: 배관길이 × 4면 ÷ 1000 ÷ 롤폭(0.6)
    const pipeLength = d.W;  // 관통재 가로 기준
    const cwSupportM = Math.round(pipeLength * 4 / 1000 / 0.6 * 100) / 100;
    lines.push({
      component: `지지구조 세라믹차열재(${cwDensityLabel}K)`, item_code: cwCode, qty: cwSupportM, unit: 'M',
      spec: `밀도${d.cwDensity}kg/m³, 두께50mm, W600, 전체보온`,
      calc: `배관길이${pipeLength}mm × 4면 ÷ 1000 ÷ 0.6(롤폭) = ${cwSupportM}M`,
    });
  } else {
    // 바닥형: 그라스울1단 + 세라믹차열재2단
    lines.push({
      component: '지지구조 글라스울1단(24K)', item_code: 'SM-GW-24',
      qty: Math.round(d.W * 4 / 1000 / 1.4 * 100) / 100, unit: 'M',
      spec: `밀도24kg/m³, 두께25mm, W1400`,
      calc: `${d.W}mm×4면÷1000÷1.4=${Math.round(d.W * 4 / 1000 / 1.4 * 100) / 100}M`,
    });
    // 2단 세라믹차열재
    const cwSupport2M = Math.round(d.W * 4 / 1000 / 0.6 * 100) / 100;
    lines.push({
      component: `지지구조 세라믹차열재2단(${cwDensityLabel}K)`, item_code: cwCode, qty: cwSupport2M, unit: 'M',
      spec: `밀도${d.cwDensity}kg/m³, 두께50mm, W600`,
      calc: `${d.W}mm×4면÷1000÷0.6=${cwSupport2M}M`,
    });
  }

  // ── 10. 실란트 ──
  const sealantQty = Math.ceil(perimeter / 3000) * d.N;
  lines.push({
    component: '실리콘 실란트', item_code: 'SM-SIL', qty: sealantQty, unit: 'EA',
    spec: `KS F 4910 F-12.5E, t3이상, 오버랩3이상`,
    calc: `둘레${perimeter}mm ÷ 3000mm/EA × ${d.N}소켓 = ${sealantQty}EA`,
  });

  // ── 11. 보호철판 ──
  lines.push({
    component: '보호철판', item_code: 'SM-GP', qty: d.N, unit: 'EA',
    spec: `3인치이상, 간격650이하`,
    calc: `소켓 ${d.N}개 = ${d.N}EA`,
  });

  // ── 12. 강재류(방화댐퍼/C-BAR) ── 대형 구조
  if (d.N >= 2) {
    lines.push({
      component: '방화댐퍼(강재)', item_code: 'SM-STL-I', qty: 1, unit: 'EA',
      spec: `아연도금강판 t1.6, ${d.W}×${d.H}×h${socketH}`,
      calc: `관통부 전체 1EA (대형구조)`,
    });
    // C/BAR: ROUNDUP(덕트둘레÷0.05)
    const cbarQty = Math.ceil(perimeter / 50);
    lines.push({
      component: 'C/BAR(덕트클립)', item_code: 'SM-STL-I', qty: cbarQty, unit: 'EA',
      spec: `t1.0×150L, 간격50mm이하`,
      calc: `ROUNDUP(둘레${perimeter}÷50)=${cbarQty}EA`,
    });
  }

  // ── 13. 직결피스 ──
  // RPT-005 공식: 세트수 × (ROUNDUP(1000/237) + 1) = 세트수 × 6EA
  // 간격 237mm 이하, #8×64mm
  const flashingSets = lines.filter(l => l.component.includes('방화플래싱')).reduce((s, l) => s + l.qty, 0);
  const screwPerSet = Math.ceil(1000 / 237) + 1;  // = 6EA/세트
  const screwQty = flashingSets * screwPerSet;
  lines.push({
    component: '직결피스(#8×64)', item_code: 'SM-GP', qty: screwQty, unit: 'EA',
    spec: `#8×64mm, 간격237mm이하`,
    calc: `플래싱${flashingSets}세트 × ${screwPerSet}EA/세트(ROUNDUP(1000/237)+1) = ${screwQty}EA`,
  });

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
    'VT-01': 'FP-VT01', 'VT-049': 'FP-VT049', 'VA-064': 'FP-VA064',
    'VT-064': 'FP-VT064', 'VAG-1.69': 'FP-VAG169', 'VTI-064': 'FP-VTI064',
    'HAG-1.69': 'FP-HTG169', 'HTG-1.69': 'FP-HTG169', 'HTG-064': 'FP-HTG064',
    'HTG(DC)-064': 'FP-HTGDC064',
  };
  return map[structureCode] || 'FP-STR';
}

// ═══════════════════════════════════════════════

export async function orderRoutes(app: FastifyInstance) {
  // await migrateOrderTables();

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
      SELECT * FROM order_bom_result WHERE order_id = $1 ORDER BY item_category, item_code
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
    await pool.query(`DELETE FROM sales_order WHERE order_id = $1`, [id]);
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
             cm.sheet_thickness_prod, cm.cw_density_prod
      FROM sales_order_item si
      JOIN certification_master cm ON cm.cert_id = si.cert_id
      WHERE si.order_id = $1
      ORDER BY si.sort_order
    `, [orderId]);

    if (orderItems.rows.length === 0) return { error: '수주 품목이 없습니다' };

    await pool.query(`DELETE FROM order_bom_result WHERE order_id = $1`, [orderId]);

    const itemMap = await getItemMap();

    // 자재별 집계: key = item_code
    interface MatAccum {
      item_id: number; item_code: string; item_name: string; item_category: string;
      required_qty: number; unit: string;
      details: Array<{ component: string; spec: string; calc: string; qty: number; structureCode: string }>;
    }
    const matMap = new Map<string, MatAccum>();

    function addMaterial(itemCode: string, qty: number, component: string, spec: string, calc: string, structureCode: string) {
      const itemInfo = itemMap.get(itemCode);
      if (!itemInfo) return;
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

      if (W === 0 || H === 0) {
        // 치수 없는 구조 (BD, NP 등) → bom_master 고정값 사용
        const bomItems = await pool.query(`
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
        sheetThickness, cwDensity,
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

    // 3. 반제품(SA) → 원재료(RM) 역전개
    const saEntries = [...matMap.values()].filter(m => m.item_category === 'SA');
    for (const sa of saEntries) {
      const upBoms = await pool.query(`
        SELECT pb.bom_id, pb.output_qty, pb.loss_rate,
               pbi.item_id, pbi.component_name, pbi.qty, pbi.unit,
               im.item_code, im.item_name, im.item_category
        FROM process_bom pb
        JOIN process_bom_item pbi ON pbi.bom_id = pb.bom_id
        JOIN item_master im ON im.item_id = pbi.item_id
        WHERE pb.output_item_id = $1 AND pb.is_active = true
      `, [sa.item_id]);

      if (upBoms.rows.length > 0) {
        const bomInfo = await pool.query(`SELECT output_qty, loss_rate FROM process_bom WHERE bom_id = $1`, [upBoms.rows[0].bom_id]);
        const outputQty = parseFloat(bomInfo.rows[0]?.output_qty || '1');
        const lossRate = parseFloat(bomInfo.rows[0]?.loss_rate || '0');
        const batches = Math.ceil(sa.required_qty / outputQty);
        const lossMult = 1 + lossRate / 100;

        for (const ub of upBoms.rows) {
          const qty = Math.round(ub.qty * batches * lossMult * 100) / 100;
          addMaterial(ub.item_code, qty, ub.component_name,
            `${sa.item_name} → ${ub.component_name}`,
            `${sa.required_qty}${sa.unit} ÷ ${outputQty}/배치 = ${batches}배치 × ${ub.qty} × 로스${lossRate}% = ${qty}`,
            '역전개');
        }
      }
    }

    // 4. 현재고 & 부족량 계산 → DB 저장
    for (const [, mat] of matMap) {
      const stockRes = await pool.query(`
        SELECT COALESCE(SUM(CASE WHEN txn_type='IN' THEN qty ELSE 0 END),0) -
               COALESCE(SUM(CASE WHEN txn_type='OUT' THEN qty ELSE 0 END),0) AS balance
        FROM inventory_transaction WHERE item_id = $1
      `, [mat.item_id]);
      const stock = parseFloat(stockRes.rows[0]?.balance || '0');
      mat.required_qty = Math.round(mat.required_qty * 100) / 100;
      const shortage = Math.max(0, mat.required_qty - stock);

      await pool.query(`
        INSERT INTO order_bom_result (order_id, item_id, item_code, item_name, item_category,
          required_qty, unit, current_stock, shortage_qty, component_name, spec_detail, calc_note)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `, [
        orderId, mat.item_id, mat.item_code, mat.item_name, mat.item_category,
        mat.required_qty, mat.unit, stock, shortage,
        mat.details.map(d => `${d.component}(${d.structureCode})`).join(', '),
        mat.details.map(d => d.spec).filter(Boolean).join(' | '),
        mat.details.map(d => d.calc).join('\n'),
      ]);
    }

    await pool.query(`UPDATE sales_order SET status = 'BOM_EXPLODED' WHERE order_id = $1`, [orderId]);

    const results = await pool.query(`
      SELECT * FROM order_bom_result WHERE order_id = $1 ORDER BY item_category, item_code
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
      },
    };
  });

  app.get('/api/orders/:id/bom', async (req) => {
    const { id } = req.params as { id: string };
    const { rows } = await pool.query(`SELECT * FROM order_bom_result WHERE order_id = $1 ORDER BY item_category, item_code`, [id]);
    return { data: rows };
  });

  // ────── 자재발주서 ──────

  app.post('/api/orders/:id/create-pr', async (req) => {
    const { id } = req.params as { id: string };
    const orderId = parseInt(id);
    const body = req.body as any;

    const shortageItems = await pool.query(`
      SELECT * FROM order_bom_result
      WHERE order_id = $1 AND shortage_qty > 0 AND item_category IN ('RM', 'SM')
      ORDER BY item_category, item_code
    `, [orderId]);

    if (shortageItems.rows.length === 0) return { error: '발주 대상 부족 자재가 없습니다 (재고 충분)' };

    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const seqRes = await pool.query(`SELECT COUNT(*)+1 AS seq FROM purchase_request WHERE pr_number LIKE $1`, [`PR-${dateStr}-%`]);
    const prNumber = `PR-${dateStr}-${String(seqRes.rows[0].seq).padStart(3, '0')}`;

    const prResult = await pool.query(`
      INSERT INTO purchase_request (pr_number, order_id, pr_date, supplier_name, remarks, created_by)
      VALUES ($1,$2,CURRENT_DATE,$3,$4,$5) RETURNING *
    `, [prNumber, orderId, body.supplier_name || null, body.remarks || null, body.created_by || null]);

    const prId = prResult.rows[0].pr_id;
    for (let idx = 0; idx < shortageItems.rows.length; idx++) {
      const si = shortageItems.rows[idx];
      await pool.query(`
        INSERT INTO purchase_request_item (pr_id, item_id, item_code, item_name, required_qty, order_qty, unit, sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [prId, si.item_id, si.item_code, si.item_name, si.shortage_qty, si.shortage_qty, si.unit, idx]);
    }

    await pool.query(`UPDATE sales_order SET status = 'PO_CREATED' WHERE order_id = $1`, [orderId]);
    const prItems = await pool.query(`SELECT * FROM purchase_request_item WHERE pr_id = $1 ORDER BY sort_order`, [prId]);
    return { data: { ...prResult.rows[0], items: prItems.rows } };
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
    const items = await pool.query(`SELECT * FROM purchase_request_item WHERE pr_id = $1 ORDER BY sort_order`, [id]);
    return { data: { ...pr.rows[0], items: items.rows } };
  });

  app.patch('/api/purchase-requests/:id/status', async (req) => {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: string };
    const { rows } = await pool.query(`UPDATE purchase_request SET status = $1 WHERE pr_id = $2 RETURNING *`, [status, id]);
    return { data: rows[0] };
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
      if (installPos === '입상' || installPos === '바닥') {
        dbInstallPos = '수평바닥';
      } else {
        dbInstallPos = '수직벽체';
      }

      // Find structures matching install position where W and H fit within the max penetration dims
      const candidates = certRows.filter((c: any) =>
        c.install_position === dbInstallPos &&
        c.penetration_w_mm && c.penetration_h_mm &&
        w <= c.penetration_w_mm && h <= c.penetration_h_mm
      );

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

      // Extract header info
      // Row 3-6: various header info; Row 11: 현장명; Row 20: 현장명, 건설사/설비사
      let projectName = '';
      let customerName = '';
      let orderDate: string | null = null;

      // Try to find project name from row 11 (0-indexed)
      projectName = cellStr(ws, 11, 0) || cellStr(ws, 11, 1) || cellStr(ws, 11, 3) || '';
      // Fallback: row 20
      if (!projectName) {
        projectName = cellStr(ws, 20, 0) || cellStr(ws, 20, 1) || '';
      }

      // Customer from rows 3-6
      for (let r = 3; r <= 6; r++) {
        for (let c = 0; c <= 5; c++) {
          const v = cellStr(ws, r, c);
          if (v && (v.includes('발주처') || v.includes('업체'))) {
            customerName = cellStr(ws, r, c + 1) || cellStr(ws, r, c + 2) || '';
          }
          if (v && v.includes('날짜') || v.includes('일자') || v.includes('일시')) {
            orderDate = parseExcelDate(cellVal(ws, r, c + 1) || cellVal(ws, r, c + 2));
          }
        }
      }

      // Also check row 20 for customer info
      if (!customerName) {
        const r20 = cellStr(ws, 20, 0) || '';
        if (r20) customerName = r20;
        const r20b = cellStr(ws, 20, 3) || cellStr(ws, 20, 5) || '';
        if (r20b && !customerName) customerName = r20b;
      }

      // If still no project name, use sheet name
      if (!projectName) projectName = sheetName;
      if (!orderDate) orderDate = new Date().toISOString().slice(0, 10);

      // Parse data rows starting from row 27 (0-indexed)
      const items: any[] = [];
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const maxRow = range.e.r;

      for (let r = 27; r <= maxRow; r++) {
        const noVal = cellVal(ws, r, 0);
        // Stop if NO is empty or contains stop marker
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

        // Auto-match structure
        const match = w > 0 && h > 0 ? autoMatchStructure(installPos, w, h) : null;

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

      const wallCount = items.filter(i => i.install_pos === '벽체').length;
      const floorCount = items.filter(i => i.install_pos === '입상' || i.install_pos === '바닥').length;

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

    // If confirm=true, actually create the sales orders
    if (confirm) {
      const createdOrders: any[] = [];
      for (const sheet of sheets) {
        if (sheet.items.length === 0) continue;

        const dateStr = (sheet.order_date || new Date().toISOString().slice(0, 10)).replace(/-/g, '').slice(2);
        const seqRes = await pool.query(
          `SELECT COUNT(*) + 1 AS seq FROM sales_order WHERE order_number LIKE $1`,
          [`SO-${dateStr}-%`]
        );
        const seq = String(seqRes.rows[0].seq).padStart(3, '0');
        const orderNumber = `SO-${dateStr}-${seq}`;
        const totalSets = sheet.items.reduce((s: number, i: any) => s + (i.qty || 1), 0);

        const result = await pool.query(`
          INSERT INTO sales_order (order_number, order_date, customer_name, project_name, remarks, total_sets)
          VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `, [orderNumber, sheet.order_date, sheet.customer_name, sheet.project_name,
            `엑셀업로드: ${sheet.sheet_name}`, totalSets]);

        const orderId = result.rows[0].order_id;

        for (let idx = 0; idx < sheet.items.length; idx++) {
          const item = sheet.items[idx];
          if (!item.cert_id) continue;  // Skip items without matched structure
          await pool.query(`
            INSERT INTO sales_order_item (order_id, cert_id, structure_code, qty,
              opening_w_mm, opening_h_mm, penetration_w_mm, penetration_h_mm, spec_note, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
            orderId, item.cert_id, item.structure_code, item.qty,
            item.opening_w || null, item.opening_h || null,
            item.w_mm || null, item.h_mm || null,
            [item.material, item.insulation, item.location].filter(Boolean).join(' | ') || null,
            idx,
          ]);
        }

        createdOrders.push({ order_id: orderId, order_number: orderNumber });
      }

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

    // Get BOM results
    const bomRes = await pool.query(`
      SELECT * FROM order_bom_result WHERE order_id = $1 ORDER BY item_category, item_code
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
      const res = await pool.query(`
        INSERT INTO work_order (wo_number, wo_date, process_code, order_id, planned_qty, status,
          customer_name, remarks, product_type)
        VALUES ($1, $2, 'MIX', $3, $4, 'DRAFT', $5, $6, $7) RETURNING *
      `, [woNumber, plannedDate, orderId, Math.round(totalRmQty * 100) / 100,
          order.customer_name, remarkBase,
          rmItems.map((r: any) => r.item_name).join(', ').slice(0, 200)]);
      createdWOs.push(res.rows[0]);
    }

    // 2. EXT work orders - if SA-EXT materials exist
    if (saExtItems.length > 0) {
      for (const sa of saExtItems) {
        const woNumber = await genWoNum('EXT', plannedDate);
        const res = await pool.query(`
          INSERT INTO work_order (wo_number, wo_date, process_code, order_id, item_id, planned_qty,
            status, customer_name, remarks, product_type)
          VALUES ($1, $2, 'EXT', $3, $4, $5, 'DRAFT', $6, $7, $8) RETURNING *
        `, [woNumber, plannedDate, orderId, sa.item_id, Math.round(parseFloat(sa.required_qty) * 100) / 100,
            order.customer_name, remarkBase, sa.item_name]);
        createdWOs.push(res.rows[0]);
      }
    }

    // 3. CUT work orders - if SA-CUT materials exist
    if (saCutItems.length > 0) {
      for (const sa of saCutItems) {
        const woNumber = await genWoNum('CUT', plannedDate);
        const res = await pool.query(`
          INSERT INTO work_order (wo_number, wo_date, process_code, order_id, item_id, planned_qty,
            status, customer_name, remarks, product_type)
          VALUES ($1, $2, 'CUT', $3, $4, $5, 'DRAFT', $6, $7, $8) RETURNING *
        `, [woNumber, plannedDate, orderId, sa.item_id, Math.round(parseFloat(sa.required_qty) * 100) / 100,
            order.customer_name, remarkBase, sa.item_name]);
        createdWOs.push(res.rows[0]);
      }
    }

    // 4. ASM work orders - for each FP (finished product)
    if (fpItems.length > 0) {
      for (const fp of fpItems) {
        const woNumber = await genWoNum('ASM', plannedDate);
        const res = await pool.query(`
          INSERT INTO work_order (wo_number, wo_date, process_code, order_id, item_id, planned_qty,
            status, customer_name, remarks, product_type)
          VALUES ($1, $2, 'ASM', $3, $4, $5, 'DRAFT', $6, $7, $8) RETURNING *
        `, [woNumber, plannedDate, orderId, fp.item_id, Math.round(parseFloat(fp.required_qty) * 100) / 100,
            order.customer_name, remarkBase, fp.item_name]);
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
}
