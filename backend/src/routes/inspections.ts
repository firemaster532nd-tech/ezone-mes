import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import pg from 'pg';
import { determineSamplingMode } from './lot-validation.js';
import { generateIncomingLotNumber } from './lot-utils.js';

/**
 * Auto-judge helper: determine PASS/FAIL for a single inspection detail item.
 * Returns 'PASS', 'FAIL', or 'NA'.
 */
function judgeDetailItem(detail: {
  check_method: string | null;
  cert_standard: number | null;
  measured_n1: number | null;
  measured_n2: number | null;
  measured_n3: number | null;
  is_applicable: boolean;
}, direction?: string): 'PASS' | 'FAIL' | 'NA' {
  // Not applicable -> NA
  if (!detail.is_applicable) return 'NA';

  const method = (detail.check_method || '').trim();

  // Visual inspection: auto-pass if all three have truthy values
  if (method === '육안') {
    if (detail.measured_n1 != null && detail.measured_n2 != null && detail.measured_n3 != null) {
      return 'PASS';
    }
    // If at least one value is present, still pass (육안 = visual check marks)
    if (detail.measured_n1 != null || detail.measured_n2 != null || detail.measured_n3 != null) {
      return 'PASS';
    }
    return 'NA';
  }

  // Certificate / public institution: auto-pass if at least n1 has value
  if (method === '성적서' || method === '공인기관') {
    if (detail.measured_n1 != null) {
      // If there's a cert_standard, check it against n1
      if (detail.cert_standard != null) {
        const dir = (direction || 'MIN').toUpperCase();
        if (dir === 'MAX' || dir === '≤') {
          return Number(detail.measured_n1) <= Number(detail.cert_standard) ? 'PASS' : 'FAIL';
        }
        // Default MIN / ≥
        return Number(detail.measured_n1) >= Number(detail.cert_standard) ? 'PASS' : 'FAIL';
      }
      return 'PASS';
    }
    return 'NA';
  }

  // Measured items: all n1/n2/n3 must meet cert_standard
  if (detail.cert_standard != null) {
    const measurements = [detail.measured_n1, detail.measured_n2, detail.measured_n3].filter(v => v != null) as number[];
    if (measurements.length === 0) return 'NA';

    const dir = (direction || 'MIN').toUpperCase();
    const standard = Number(detail.cert_standard);

    for (const val of measurements) {
      const numVal = Number(val);
      if (dir === 'MAX' || dir === '≤') {
        if (numVal > standard) return 'FAIL';
      } else {
        // MIN or ≥ (default)
        if (numVal < standard) return 'FAIL';
      }
    }
    return 'PASS';
  }

  // No cert_standard and not visual/certificate -> check if values exist
  const measurements = [detail.measured_n1, detail.measured_n2, detail.measured_n3].filter(v => v != null);
  if (measurements.length > 0) return 'PASS';
  return 'NA';
}

/**
 * Calculate overall inspection result from detail items.
 * PASS only if ALL items are PASS or NA. FAIL if any item is FAIL.
 */
function calculateOverallResult(itemResults: string[]): 'PASS' | 'FAIL' | 'PENDING' {
  if (itemResults.length === 0) return 'PENDING';
  const hasAnyFail = itemResults.some(r => r === 'FAIL');
  if (hasAnyFail) return 'FAIL';
  const hasAnyPass = itemResults.some(r => r === 'PASS');
  if (hasAnyPass) return 'PASS';
  return 'PENDING';
}

/**
 * Auto-judge all detail items for an inspection and update overall result.
 * Uses a provided client (transaction) or the pool.
 */
async function autoJudgeInspection(inspId: number, dbClient?: pg.PoolClient): Promise<{
  details: Array<{ detail_id: number; item_result: string }>;
  overall_result: string;
}> {
  const db = dbClient || pool;

  // Fetch all details
  const detailsRes = await db.query(
    'SELECT * FROM inspection_detail WHERE insp_id = $1 ORDER BY item_no',
    [inspId]
  );

  const updatedDetails: Array<{ detail_id: number; item_result: string }> = [];

  for (const d of detailsRes.rows) {
    const itemResult = judgeDetailItem({
      check_method: d.check_method,
      cert_standard: d.cert_standard,
      measured_n1: d.measured_n1,
      measured_n2: d.measured_n2,
      measured_n3: d.measured_n3,
      is_applicable: d.is_applicable !== false,
    }, d.direction || 'MIN');

    await db.query(
      'UPDATE inspection_detail SET item_result = $1 WHERE detail_id = $2',
      [itemResult, d.detail_id]
    );

    updatedDetails.push({ detail_id: d.detail_id, item_result: itemResult });
  }

  // Calculate overall
  const overallResult = calculateOverallResult(updatedDetails.map(d => d.item_result));

  // Update inspection header
  await db.query(
    'UPDATE inspection SET result = $1 WHERE insp_id = $2',
    [overallResult, inspId]
  );

  // Update lot_transaction if linked
  const inspRes = await db.query('SELECT lot_id FROM inspection WHERE insp_id = $1', [inspId]);
  if (inspRes.rows.length > 0 && inspRes.rows[0].lot_id) {
    await db.query(
      'UPDATE lot_transaction SET inspection_result = $1 WHERE lot_id = $2',
      [overallResult, inspRes.rows[0].lot_id]
    );
  }

  return { details: updatedDetails, overall_result: overallResult };
}

/**
 * 인수검사 양식 프리셋
 * 원재료: D101~D104 계열 (배합원료 4종)
 * 부자재: D121~D130 계열 (강재류/그라스울/세라믹울/PE보온재/실란트/발포소켓/보호철판 등)
 */
export interface IncomingFormPreset {
  form_code: string;
  form_name: string;
  category: 'RM' | 'SM';
  category_label: string;
  material: string;
  spec_ref: string;
  ks_type: 'KS' | 'NON_KS' | 'KS_PROC';  // KS규격/비규격/KS가공품
  ks_number?: string;                        // KS 규격번호 (KS인 경우)
  cert_test_required: boolean;               // 공인시험성적서 필수 여부 (NON_KS=매로트, KS=1회/년)
  items: Array<{
    item_no: number;
    quality_item: string;
    check_item: string;
    check_method: string;
    cert_standard?: number;
    direction?: 'MIN' | 'MAX';  // MIN: ≥ (기본값), MAX: ≤
    unit: string;
    frequency: string; // '매로트' | '1회/입고' | '1회/년'
  }>;
}

export const INCOMING_FORM_PRESETS: IncomingFormPreset[] = [
  // ===== 원재료 (RM) =====
  {
    form_code: 'D101-1', form_name: '난연컴파운드 인수검사', category: 'RM', category_label: '원재료',
    material: '난연컴파운드(PE3005MB)', spec_ref: 'EZC-D101 Rev1',
    ks_type: 'NON_KS', cert_test_required: true,
    items: [
      { item_no: 1, quality_item: '외관', check_item: '외관상태 (흑색/회색)', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 2, quality_item: '외관', check_item: '성상 (고체)', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 3, quality_item: '외관', check_item: '냄새 (무취)', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 4, quality_item: 'UL94', check_item: 'UL94 등급 (V-2 이상)', check_method: '성적서', unit: 'V등급', frequency: '1회/입고' },
      { item_no: 5, quality_item: '밀도', check_item: '밀도', check_method: '성적서', cert_standard: 0.4, unit: 'g/cm³', frequency: '1회/입고' },
      { item_no: 6, quality_item: 'MI', check_item: 'Melt Index', check_method: '성적서', cert_standard: 50, direction: 'MAX', unit: 'g/10min', frequency: '1회/입고' },
      { item_no: 7, quality_item: '공인시험', check_item: 'UL94/밀도/MI 공인시험', check_method: '공인기관', unit: '-', frequency: '1회/년' },
    ],
  },
  {
    form_code: 'D102-1', form_name: '팽창흑연 인수검사', category: 'RM', category_label: '원재료',
    material: '팽창흑연 #50', spec_ref: 'EZC-D102 Rev1',
    ks_type: 'NON_KS', cert_test_required: true,
    items: [
      { item_no: 1, quality_item: '외관', check_item: '외관 (흑색 광물입자)', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 2, quality_item: '외관', check_item: '성상 (고체)', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 3, quality_item: '고정탄소', check_item: '고정탄소', check_method: '성적서', cert_standard: 95, unit: '%', frequency: '1회/입고' },
      { item_no: 4, quality_item: '팽창율', check_item: '팽창율', check_method: '성적서', cert_standard: 400, direction: 'MAX', unit: 'ml/g', frequency: '1회/입고' },
      { item_no: 5, quality_item: '수분', check_item: '수분', check_method: '성적서', unit: '%', frequency: '1회/입고' },
      { item_no: 6, quality_item: '입도', check_item: '입도(50mesh 통과)', check_method: '성적서', cert_standard: 70, unit: '%', frequency: '1회/입고' },
      { item_no: 7, quality_item: '공인시험', check_item: '체잔분(300μm) 공인시험', check_method: '공인기관', cert_standard: 70, unit: '%', frequency: '1회/년' },
    ],
  },
  {
    form_code: 'D103-1', form_name: 'EVA-EA33045 인수검사', category: 'RM', category_label: '원재료',
    material: 'EVA-EA33045', spec_ref: 'EZC-D103 Rev0',
    ks_type: 'NON_KS', cert_test_required: true,
    items: [
      { item_no: 1, quality_item: '외관', check_item: '외관 (투명 그래뉼)', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 2, quality_item: 'MI', check_item: 'Melt Index (41~49)', check_method: '성적서', unit: 'g/10min', frequency: '1회/입고' },
      { item_no: 3, quality_item: 'VA함량', check_item: 'VA 함량', check_method: '성적서', unit: '%', frequency: '1회/입고' },
      { item_no: 4, quality_item: '공인시험', check_item: 'MI/내약품성 공인시험', check_method: '공인기관', unit: '-', frequency: '1회/년' },
    ],
  },
  {
    form_code: 'D104-1', form_name: 'EP100 인수검사', category: 'RM', category_label: '원재료',
    material: 'EVA-EP100', spec_ref: 'EZC-D104 Rev0',
    ks_type: 'NON_KS', cert_test_required: true,
    items: [
      { item_no: 1, quality_item: '외관', check_item: '외관 (백색 분말)', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 2, quality_item: '겉보기밀도', check_item: '겉보기밀도', check_method: '성적서', cert_standard: 0.4, unit: 'g/cm³', frequency: '1회/입고' },
      { item_no: 3, quality_item: 'pH', check_item: '50% 용액 pH (7±1)', check_method: '성적서', unit: '-', frequency: '1회/입고' },
      { item_no: 4, quality_item: '공인시험', check_item: '겉보기밀도/pH 공인시험', check_method: '공인기관', unit: '-', frequency: '1회/년' },
    ],
  },
  // ===== 부자재 (SM) - 강재류/그라스울/세라믹울 (CLAUDE.md 기반) =====
  {
    form_code: 'D122-1', form_name: '그라스울 인수검사', category: 'SM', category_label: '부자재',
    material: '그라스울 24K', spec_ref: 'EZC-D122 Rev1, KS L 9102',
    ks_type: 'KS', ks_number: 'KS L 9102', cert_test_required: false,
    items: [
      { item_no: 1, quality_item: '겉모양', check_item: '색상/은박필름/파손', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 2, quality_item: '밀도', check_item: '밀도 (질량÷부피)', check_method: '질량÷부피', cert_standard: 24, unit: 'kg/m³', frequency: '매로트' },
      { item_no: 3, quality_item: '두께', check_item: '두께', check_method: '버니어캘리퍼스', cert_standard: 25, unit: 'mm', frequency: '매로트' },
      { item_no: 4, quality_item: '너비', check_item: '너비', check_method: '줄자', unit: 'mm', frequency: '매로트' },
      { item_no: 5, quality_item: '열전도율', check_item: '열전도율(20℃) ≤0.037', check_method: '성적서', unit: 'W/(m·K)', frequency: '1회/입고' },
      { item_no: 6, quality_item: '열전도율', check_item: '열전도율(70℃) ≤0.048', check_method: '성적서', unit: 'W/(m·K)', frequency: '1회/입고' },
      { item_no: 7, quality_item: '열간수축', check_item: '열간수축온도 ≥300℃', check_method: '성적서', unit: '℃', frequency: '1회/입고' },
      { item_no: 8, quality_item: '공인시험', check_item: '열전도율/열간수축 공인시험', check_method: '공인기관', unit: '-', frequency: '1회/년' },
    ],
  },
  {
    form_code: 'D121-2', form_name: '방화소켓 인수검사 (벽체)', category: 'SM', category_label: '부자재',
    material: '방화소켓 (아연도금, 벽체용)', spec_ref: 'EZC-D121 Rev3',
    ks_type: 'KS', ks_number: 'KS D 3030', cert_test_required: false,
    items: [
      { item_no: 1, quality_item: '본체 겉모양', check_item: '휨/비틀림/깨짐', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 2, quality_item: '본체 길이', check_item: '길이', check_method: '줄자', unit: 'mm', frequency: '매로트' },
      { item_no: 3, quality_item: '본체 너비', check_item: '너비', check_method: '줄자', unit: 'mm', frequency: '매로트' },
      { item_no: 4, quality_item: '본체 높이', check_item: '높이 ≥200mm', check_method: '줄자', cert_standard: 200, unit: 'mm', frequency: '매로트' },
      { item_no: 5, quality_item: '본체 두께', check_item: '두께 ≥1.6mm', check_method: '마이크로미터', cert_standard: 1.6, unit: 'mm', frequency: '매로트' },
      { item_no: 6, quality_item: '브라켓', check_item: '브라켓 겉모양', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 7, quality_item: '항복강도', check_item: '항복강도 ≥205 N/mm²', check_method: '성적서', cert_standard: 205, unit: 'N/mm²', frequency: '1회/입고' },
      { item_no: 8, quality_item: '인장강도', check_item: '인장강도 ≥270 N/mm²', check_method: '성적서', cert_standard: 270, unit: 'N/mm²', frequency: '1회/입고' },
      { item_no: 9, quality_item: '공인시험', check_item: '항복/인장강도 공인시험', check_method: '공인기관', unit: '-', frequency: '1회/년' },
    ],
  },
  {
    form_code: 'D121-7', form_name: '방화소켓 인수검사 (입상)', category: 'SM', category_label: '부자재',
    material: '방화소켓 (아연도금, 입상용)', spec_ref: 'EZC-D121 Rev3',
    ks_type: 'KS', ks_number: 'KS D 3030', cert_test_required: false,
    items: [
      { item_no: 1, quality_item: '본체 겉모양', check_item: '휨/비틀림/깨짐', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 2, quality_item: '본체 길이', check_item: '길이', check_method: '줄자', unit: 'mm', frequency: '매로트' },
      { item_no: 3, quality_item: '본체 너비', check_item: '너비', check_method: '줄자', unit: 'mm', frequency: '매로트' },
      { item_no: 4, quality_item: '본체 높이', check_item: '높이 ≥300mm', check_method: '줄자', cert_standard: 300, unit: 'mm', frequency: '매로트' },
      { item_no: 5, quality_item: '본체 두께', check_item: '두께 ≥1.6mm', check_method: '마이크로미터', cert_standard: 1.6, unit: 'mm', frequency: '매로트' },
      { item_no: 6, quality_item: '보강대', check_item: '보강대 두께 ≥1.6mm', check_method: '마이크로미터', cert_standard: 1.6, unit: 'mm', frequency: '매로트' },
      { item_no: 7, quality_item: '항복강도', check_item: '항복강도 ≥205 N/mm²', check_method: '성적서', cert_standard: 205, unit: 'N/mm²', frequency: '1회/입고' },
      { item_no: 8, quality_item: '인장강도', check_item: '인장강도 ≥270 N/mm²', check_method: '성적서', cert_standard: 270, unit: 'N/mm²', frequency: '1회/입고' },
      { item_no: 9, quality_item: '공인시험', check_item: '항복/인장강도 공인시험', check_method: '공인기관', unit: '-', frequency: '1회/년' },
    ],
  },
  {
    form_code: 'D121-4', form_name: '방화플래싱 인수검사', category: 'SM', category_label: '부자재',
    material: '방화플래싱 (아연도금강판)', spec_ref: 'EZC-D121 Rev3',
    ks_type: 'KS', ks_number: 'KS D 3030', cert_test_required: false,
    items: [
      { item_no: 1, quality_item: '겉모양', check_item: '휨/비틀림/깨짐', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 2, quality_item: '길이', check_item: '길이', check_method: '줄자', unit: 'mm', frequency: '매로트' },
      { item_no: 3, quality_item: '너비', check_item: '너비', check_method: '줄자', unit: 'mm', frequency: '매로트' },
      { item_no: 4, quality_item: '두께', check_item: '두께 ≥0.5mm', check_method: '마이크로미터', cert_standard: 0.5, unit: 'mm', frequency: '매로트' },
      { item_no: 5, quality_item: '항복강도', check_item: '항복강도 ≥205 N/mm²', check_method: '성적서', cert_standard: 205, unit: 'N/mm²', frequency: '1회/입고' },
      { item_no: 6, quality_item: '인장강도', check_item: '인장강도 ≥270 N/mm²', check_method: '성적서', cert_standard: 270, unit: 'N/mm²', frequency: '1회/입고' },
      { item_no: 7, quality_item: '공인시험', check_item: '항복/인장강도 공인시험', check_method: '공인기관', unit: '-', frequency: '1회/년' },
    ],
  },
  {
    form_code: 'D124-1', form_name: '세라믹울 인수검사 (96K)', category: 'SM', category_label: '부자재',
    material: '세라믹울 96K', spec_ref: 'EZC-D124 Rev4',
    ks_type: 'NON_KS', cert_test_required: true,
    items: [
      { item_no: 1, quality_item: '겉모양', check_item: '색상/포장/파손', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 2, quality_item: '두께', check_item: '두께', check_method: '줄자', unit: 'mm', frequency: '매로트' },
      { item_no: 3, quality_item: '너비', check_item: '너비', check_method: '줄자', unit: 'mm', frequency: '매로트' },
      { item_no: 4, quality_item: '밀도', check_item: '밀도 ≥96 kg/m³', check_method: '질량÷부피', cert_standard: 96, unit: 'kg/m³', frequency: '매로트' },
      { item_no: 5, quality_item: '숏함유량', check_item: '숏함유량 ≤25%', check_method: '성적서', unit: '%', frequency: '1회/입고' },
      { item_no: 6, quality_item: '가열선수축율', check_item: '가열선수축율 ≤3%', check_method: '성적서', unit: '%', frequency: '1회/입고' },
      { item_no: 7, quality_item: '공인시험', check_item: '밀도/숏/수축율 공인시험', check_method: '공인기관', unit: '-', frequency: '1회/년' },
    ],
  },
  {
    form_code: 'D124-3', form_name: '세라믹울 인수검사 (120K)', category: 'SM', category_label: '부자재',
    material: '세라믹울 120K', spec_ref: 'EZC-D124 Rev4',
    ks_type: 'NON_KS', cert_test_required: true,
    items: [
      { item_no: 1, quality_item: '겉모양', check_item: '색상/포장/파손', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 2, quality_item: '두께', check_item: '두께', check_method: '줄자', unit: 'mm', frequency: '매로트' },
      { item_no: 3, quality_item: '너비', check_item: '너비', check_method: '줄자', unit: 'mm', frequency: '매로트' },
      { item_no: 4, quality_item: '밀도', check_item: '밀도 ≥120 kg/m³', check_method: '질량÷부피', cert_standard: 120, unit: 'kg/m³', frequency: '매로트' },
      { item_no: 5, quality_item: '숏함유량', check_item: '숏함유량 ≤25%', check_method: '성적서', unit: '%', frequency: '1회/입고' },
      { item_no: 6, quality_item: '가열선수축율', check_item: '가열선수축율 ≤3%', check_method: '성적서', unit: '%', frequency: '1회/입고' },
      { item_no: 7, quality_item: '공인시험', check_item: '밀도/숏/수축율 공인시험', check_method: '공인기관', unit: '-', frequency: '1회/년' },
    ],
  },
  // ===== 부자재 - 에프엔테크/보호철판/기타 (D127~D130) =====

  {
    form_code: 'D128-1', form_name: '내화충전발포소켓 인수검사 (에프엔테크)', category: 'SM', category_label: '부자재',
    material: '발포소켓 몸체 (FN테크 슬리브)', spec_ref: 'EZC-D128 Rev0',
    ks_type: 'NON_KS', cert_test_required: true,
    items: [
      { item_no: 1, quality_item: '외관', check_item: '크랙/휨(±2mm)/표면거칠기', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 2, quality_item: '외관', check_item: '색상 (담백색 균일)', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 3, quality_item: '외관', check_item: '이물부착 여부', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 4, quality_item: '치수', check_item: '두께', check_method: '버니어캘리퍼스', unit: 'mm', frequency: '매로트' },
      { item_no: 5, quality_item: '인장강도', check_item: '인장강도 ≥270 MPa', check_method: '성적서', cert_standard: 270, unit: 'MPa', frequency: '1회/입고' },
      { item_no: 6, quality_item: '굴곡강도', check_item: '굴곡강도 ≥25 MPa', check_method: '성적서', cert_standard: 25, unit: 'MPa', frequency: '1회/입고' },
      { item_no: 7, quality_item: '충격강도', check_item: 'Izod 충격강도(23℃) ≥25', check_method: '성적서', cert_standard: 25, unit: 'kJ/m²', frequency: '1회/입고' },
      { item_no: 8, quality_item: '공인시험', check_item: '물성 공인시험', check_method: '공인기관', unit: '-', frequency: '1회/년' },
    ],
  },
  {
    form_code: 'D129-1', form_name: '보호철판 인수검사', category: 'SM', category_label: '부자재',
    material: '보호철판', spec_ref: 'EZC-D129 Rev0',
    ks_type: 'NON_KS', cert_test_required: true,
    items: [
      { item_no: 1, quality_item: '외관', check_item: '손상/표면/색상', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 2, quality_item: '치수', check_item: '외경/내경', check_method: '버니어캘리퍼스', unit: 'mm', frequency: '매로트' },
      { item_no: 3, quality_item: '치수', check_item: '두께', check_method: '버니어캘리퍼스', unit: 'mm', frequency: '매로트' },
      { item_no: 4, quality_item: '치수', check_item: '볼트홀 지름', check_method: '버니어캘리퍼스', unit: 'mm', frequency: '매로트' },
      { item_no: 5, quality_item: '치수', check_item: '평탄도', check_method: '틈새게이지', unit: 'mm', frequency: '매로트' },
    ],
  },
  {
    form_code: 'D127-1', form_name: '마이크로덕트보드 인수검사', category: 'SM', category_label: '부자재',
    material: 'MicroductBoard (그라스울보온판 64K)', spec_ref: 'EZC-D127 Rev0, KS L 9102',
    ks_type: 'KS', ks_number: 'KS L 9102', cert_test_required: false,
    items: [
      { item_no: 1, quality_item: '겉모양', check_item: '휨/비틀림/깨짐', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 2, quality_item: '두께', check_item: '두께 ≥25mm', check_method: '버니어캘리퍼스', cert_standard: 25, unit: 'mm', frequency: '매로트' },
      { item_no: 3, quality_item: '밀도', check_item: '밀도 ≥64 kg/m³', check_method: '성적서', cert_standard: 64, unit: 'kg/m³', frequency: '1회/년' },
      { item_no: 4, quality_item: '열간수축', check_item: '열간수축온도 ≥400℃', check_method: '성적서', cert_standard: 400, unit: '℃', frequency: '1회/년' },
      { item_no: 5, quality_item: '열전도율', check_item: '열전도율 ≤0.034', check_method: '성적서', unit: 'W/(m·K)', frequency: '1회/년' },
    ],
  },
  {
    form_code: 'D123-1', form_name: 'PE보온재 인수검사', category: 'SM', category_label: '부자재',
    material: '가교발포 PE보온재', spec_ref: 'EZC-D123 Rev0, KS M 3862',
    ks_type: 'KS', ks_number: 'KS M 3862', cert_test_required: false,
    items: [
      { item_no: 1, quality_item: '외관', check_item: '외관상태', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 2, quality_item: '두께', check_item: '두께', check_method: '버니어캘리퍼스', unit: 'mm', frequency: '매로트' },
      { item_no: 3, quality_item: '밀도', check_item: '밀도 ≥24 kg/m³', check_method: '질량÷부피', cert_standard: 24, unit: 'kg/m³', frequency: '매로트' },
      { item_no: 4, quality_item: '열전도율', check_item: '열전도율 ≤0.043', check_method: '성적서', unit: 'W/(m·K)', frequency: '1회/입고' },
      { item_no: 5, quality_item: '공인시험', check_item: '밀도/열전도율 공인시험', check_method: '공인기관', unit: '-', frequency: '1회/년' },
    ],
  },
  {
    form_code: 'D125-1', form_name: '실리콘실란트 인수검사', category: 'SM', category_label: '부자재',
    material: '실리콘 실란트 (Neutral-X)', spec_ref: 'EZC-D125 Rev0, KS F 4910',
    ks_type: 'KS', ks_number: 'KS F 4910', cert_test_required: false,
    items: [
      { item_no: 1, quality_item: '외관', check_item: '손상/색상', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 2, quality_item: '탄성복원력', check_item: '탄성복원력 ≥60%', check_method: '성적서', cert_standard: 60, unit: '%', frequency: '1회/입고' },
      { item_no: 3, quality_item: '체적손실', check_item: '체적손실 ≤10%', check_method: '성적서', unit: '%', frequency: '1회/입고' },
      { item_no: 4, quality_item: '공인시험', check_item: 'KS F 4910 공인시험', check_method: '공인기관', unit: '-', frequency: '1회/년' },
    ],
  },
  {
    form_code: 'D130-1', form_name: '상하부보호패킹 인수검사', category: 'SM', category_label: '부자재',
    material: '상하부 보호패킹 (고무)', spec_ref: 'EZC-D130 Rev0',
    ks_type: 'NON_KS', cert_test_required: true,
    items: [
      { item_no: 1, quality_item: '외관', check_item: '손상/표면/색상', check_method: '육안', unit: 'OK/NG', frequency: '매로트' },
      { item_no: 2, quality_item: '치수', check_item: '외경/내경', check_method: '버니어캘리퍼스', unit: 'mm', frequency: '매로트' },
      { item_no: 3, quality_item: '치수', check_item: '두께', check_method: '버니어캘리퍼스', unit: 'mm', frequency: '매로트' },
      { item_no: 4, quality_item: '경도', check_item: '경도 (규격±5 Hs)', check_method: '성적서', unit: 'Hs', frequency: '1회/입고' },
      { item_no: 5, quality_item: '인장강도', check_item: '인장강도', check_method: '성적서', unit: 'MPa', frequency: '1회/입고' },
      { item_no: 6, quality_item: '공인시험', check_item: '경도/인장 공인시험', check_method: '공인기관', unit: '-', frequency: '1회/년' },
    ],
  },
];

export async function inspectionRoutes(app: FastifyInstance) {
  // DB 마이그레이션: 스펙 치수 컬럼 추가
  await pool.query(`
    ALTER TABLE lot_transaction ADD COLUMN IF NOT EXISTS spec_thickness_mm NUMERIC(10,2);
    ALTER TABLE lot_transaction ADD COLUMN IF NOT EXISTS spec_width_mm NUMERIC(10,2);
    ALTER TABLE lot_transaction ADD COLUMN IF NOT EXISTS spec_length_mm NUMERIC(10,2);
    ALTER TABLE lot_transaction ADD COLUMN IF NOT EXISTS spec_density VARCHAR(30);
    ALTER TABLE lot_transaction ADD COLUMN IF NOT EXISTS total_length_mm BIGINT;
    ALTER TABLE inventory_transaction ADD COLUMN IF NOT EXISTS length_mm BIGINT;
  `).catch((e: unknown) => console.error('[Migration] spec columns:', e));


  // GET /api/inspections/incoming-presets - 인수검사 양식 목록
  // category='RM': 기존 하드코딩 배열 사용 (원재료)
  // category='SM'/'SK'/'BR'/'FL'/'CW'/'GW': DB 테이블 사용
  app.get('/api/inspections/incoming-presets', async (request) => {
    const { category } = request.query as { category?: string };

    // SM(부자재) 계열은 DB에서
    const smCategories = ['SK', 'BR', 'FL', 'CW', 'GW', 'SM'];
    if (category && smCategories.includes(category)) {
      const q = category === 'SM'
        ? 'SELECT * FROM incoming_inspection_preset WHERE is_active=true ORDER BY sort_order'
        : 'SELECT * FROM incoming_inspection_preset WHERE is_active=true AND item_category=$1 ORDER BY sort_order';
      const params = category === 'SM' ? [] : [category];
      const result = await pool.query(q, params);
      return { data: result.rows };
    }

    // category 없으면 전체: RM(하드코딩) + DB(SM계열) 합산
    if (!category) {
      const dbResult = await pool.query(
        'SELECT *, item_count_sub.cnt AS item_count FROM incoming_inspection_preset p LEFT JOIN LATERAL (SELECT COUNT(*) AS cnt FROM inspection_preset_item WHERE preset_id=p.preset_id) item_count_sub ON true WHERE p.is_active=true ORDER BY p.sort_order'
      );
      const rmPresets = INCOMING_FORM_PRESETS.filter(p => p.category === 'RM').map(p => ({
        form_code: p.form_code, form_name: p.form_name,
        item_category: 'RM', sub_type: null,
        file_path: null, sampling_n: p.items.length,
        accept_c: 0, is_active: true, sort_order: 0,
        item_count: p.items.length,
        cert_test_required: p.cert_test_required,
      }));
      return { data: [...rmPresets, ...dbResult.rows] };
    }

    // RM 카테고리: 기존 하드코딩
    let presets = INCOMING_FORM_PRESETS;
    if (category) {
      presets = presets.filter((p) => p.category === category);
    }
    return {
      data: presets.map((p) => ({
        form_code: p.form_code, form_name: p.form_name,
        item_category: p.category, sub_type: null,
        cert_test_required: p.cert_test_required,
        item_count: p.items.length,
      })),
    };
  });

  // GET /api/inspections/incoming-presets/:formCode - 양식 상세 + 전체 검사항목
  app.get('/api/inspections/incoming-presets/:formCode', async (request, reply) => {
    const { formCode } = request.params as { formCode: string };

    // DB에서 먼저 조회
    const dbPreset = await pool.query(
      'SELECT * FROM incoming_inspection_preset WHERE form_code=$1', [formCode]
    );
    if (dbPreset.rows.length > 0) {
      const preset = dbPreset.rows[0];
      const items = await pool.query(
        'SELECT * FROM inspection_preset_item WHERE preset_id=$1 ORDER BY seq_no',
        [preset.preset_id]
      );
      return { data: { ...preset, items: items.rows } };
    }

    // 하드코딩 배열에서 fallback
    const preset = INCOMING_FORM_PRESETS.find((p) => p.form_code === formCode);
    if (!preset) {
      return reply.status(404).send({ error: 'Not Found', message: `양식 ${formCode}을 찾을 수 없습니다.` });
    }
    return { data: preset };
  });

  // GET /api/inspections/incoming-presets/:formCode/items?method=CERT
  // 공인시험 항목만 또는 일반 항목만 조회
  app.get('/api/inspections/incoming-presets/:formCode/items', async (request, reply) => {
    const { formCode } = request.params as { formCode: string };
    const { method } = request.query as { method?: string }; // 'CERT' | 'VISUAL' | 'MEASURE' | undefined(전체)

    const dbPreset = await pool.query(
      'SELECT preset_id FROM incoming_inspection_preset WHERE form_code=$1', [formCode]
    );
    if (dbPreset.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: `양식 ${formCode}을 찾을 수 없습니다.` });
    }

    const presetId = dbPreset.rows[0].preset_id;
    let q = 'SELECT * FROM inspection_preset_item WHERE preset_id=$1';
    const params: unknown[] = [presetId];
    if (method) {
      q += ' AND check_method=$2';
      params.push(method);
    }
    q += ' ORDER BY seq_no';

    const items = await pool.query(q, params);
    return { data: items.rows, total: items.rows.length };
  });


  // GET /api/inspections - 검사 목록
  app.get('/api/inspections', async (request) => {
    const { insp_type, result: inspResult } = request.query as {
      insp_type?: string;
      result?: string;
    };

    let query = `
      SELECT ins.*, lt.lot_number, i.item_name, i.item_code, i.item_category, c.cert_number
      FROM inspection ins
      LEFT JOIN lot_transaction lt ON lt.lot_id = ins.lot_id
      LEFT JOIN item_master i ON i.item_id = lt.item_id
      LEFT JOIN certification_master c ON c.cert_id = ins.cert_id
    `;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (insp_type) {
      params.push(insp_type);
      conditions.push(`ins.insp_type = $${params.length}`);
    }
    if (inspResult) {
      params.push(inspResult);
      conditions.push(`ins.result = $${params.length}`);
    }
    if (request.query && (request.query as any).form_code) {
      params.push((request.query as any).form_code);
      conditions.push(`ins.form_code = $${params.length}`);
    }
    if (request.query && (request.query as any).material_category) {
      params.push((request.query as any).material_category);
      conditions.push(`i.item_category = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY ins.inspected_at DESC NULLS LAST, ins.insp_id DESC';

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });

  // GET /api/inspections/:id - 검사 상세 + 측정값
  app.get('/api/inspections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const inspId = parseInt(id, 10);

    const [inspResult, detailResult] = await Promise.all([
      pool.query(
        `SELECT ins.*, lt.lot_number, lt.base_lot, lt.serial_start, lt.serial_end,
                i.item_name, i.item_code, i.ks_type AS item_ks_type, i.ks_number AS item_ks_number,
                c.cert_number,
                cd.test_institution AS cert_institution, cd.cert_number AS cert_doc_number,
                cd.issued_date AS cert_issued_date, cd.expiry_date AS cert_expiry_date, cd.is_valid AS cert_is_valid
         FROM inspection ins
         LEFT JOIN lot_transaction lt ON lt.lot_id = ins.lot_id
         LEFT JOIN item_master i ON i.item_id = lt.item_id
         LEFT JOIN certification_master c ON c.cert_id = ins.cert_id
         LEFT JOIN cert_document cd ON cd.cert_doc_id = ins.cert_doc_id
         WHERE ins.insp_id = $1`,
        [inspId]
      ),
      pool.query(
        'SELECT * FROM inspection_detail WHERE insp_id = $1 ORDER BY item_no',
        [inspId]
      ),
    ]);

    if (inspResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '검사를 찾을 수 없습니다.' });
    }

    return {
      data: {
        ...inspResult.rows[0],
        details: detailResult.rows,
      },
    };
  });

  /**
   * POST /api/inspections - 인수검사 생성
   * 올바른 흐름: 인수검사(LOT/COA 기입) → 합격 판정 → 자동 재고 입고
   * - 인수검사 시 lot_transaction을 생성 (supplier_lot/COA 포함)
   * - 합격(PASS) 시 자동으로 inventory_transaction(IN) 생성
   * - 불합격 시 재고 미반영
   */
  // ── POST /api/inspections/socket ── 소켓 인수검사 등록 (발주서 기반)
  // 발주서 소켓 항목에 LOT 번호를 기재하여 인수검사 등록
  app.post('/api/inspections/socket', async (request, reply) => {
    const {
      po_item_id, po_id, lot_number, inspector, inspected_at,
      product_type, width_mm, height_mm, construction_type,
    } = request.body as any;

    if (!lot_number) return reply.code(400).send({ error: 'lot_number는 필수입니다.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. inspection 레코드 생성 (소켓 인수검사)
      const itemName = product_type
        ? `소켓(${product_type}) ${width_mm ?? '?'}×${height_mm ?? '?'}`
        : `소켓 ${width_mm ?? '?'}×${height_mm ?? '?'}`;

      const { rows: [ins] } = await client.query(
        `INSERT INTO inspection
           (insp_type, lot_number, item_name, item_code, item_category,
            inspector, inspected_at, result, remarks,
            sampling_n, accept_c, pr_number)
         VALUES ('SOCKET_IN', $1, $2, 'SOCKET', 'SK',
                 $3, $4, 'PASS', $5,
                 1, 0, $6)
         RETURNING insp_id`,
        [
          lot_number,
          itemName,
          inspector || null,
          inspected_at || new Date().toISOString().slice(0, 10),
          `${product_type || '소켓'} ${construction_type === 'SINGLE' ? '단면' : '양면'} W${width_mm}×H${height_mm}`,
          po_id ? `PO-${po_id}` : null,
        ],
      );

      // 2. po_item에 lot_number 업데이트 (있을 경우)
      if (po_item_id) {
        await client.query(
          `UPDATE purchase_order_item SET lot_number = $1 WHERE po_item_id = $2`,
          [lot_number, po_item_id],
        );
      }

      await client.query('COMMIT');
      return reply.code(201).send({ data: { insp_id: ins.insp_id, lot_number } });
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.code(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });

  app.post('/api/inspections', async (request, reply) => {

    const body = request.body as Record<string, unknown>;
    const { insp_type, details } = body as {
      insp_type: string;
      details: Array<{
        item_no: number;
        quality_item: string;
        check_item: string;
        check_method: string;
        cert_standard?: number;
        prod_standard?: number;
        measured_n1?: number;
        measured_n2?: number;
        measured_n3?: number;
        is_applicable?: boolean;
        direction?: string;
      }>;
    };

    if (!insp_type) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'insp_type은 필수입니다.',
      });
    }

    // 인수검사(INCOMING)인 경우: item_id, qty, supplier_lot 필수
    const isIncoming = insp_type === 'INCOMING';
    const itemId = body.item_id as number | undefined;
    const qty = body.qty as number | undefined;
    const supplierLot = (body.supplier_lot as string) || null;
    const inspDate = (body.insp_date as string) || new Date().toISOString().slice(0, 10);

    // 스펙 치수 필드 (SM 자재용: T, W, L, 밀도)
    const specThickness = (body.spec_thickness_mm as number) || null;
    const specWidth = (body.spec_width_mm as number) || null;
    const specLength = (body.spec_length_mm as number) || null;
    const specDensity = (body.spec_density as string) || null;
    // 길이 추적 자동 계산: L(mm) × 수량 = 총 길이
    const totalLengthMm = (specLength && qty) ? Math.round(Number(specLength) * Number(qty)) : null;

    if (isIncoming && (!itemId || !qty)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: '인수검사는 item_id, qty가 필수입니다.',
      });
    }

    // 공인성적서 연결 정보
    const certDocId = (body.cert_doc_id as number) || null;
    const formCode = (body.form_code as string) || null;

    // KS/비규격 공인성적서 검증 (인수검사 시)
    let ksVerified = false;
    let certDocVerified = false;
    let presetKsType: string | null = null;

    if (isIncoming && formCode) {
      const preset = INCOMING_FORM_PRESETS.find(p => p.form_code === formCode);
      if (preset) {
        presetKsType = preset.ks_type;
        // KS 제품: KS 인증 자체로 검증 완료
        if (preset.ks_type === 'KS') {
          ksVerified = true;
          certDocVerified = true; // KS는 제조사 성적서로 대체 가능
        }
        // NON_KS 제품: 반드시 유효한 공인성적서가 있어야 함
        if (preset.ks_type === 'NON_KS' && preset.cert_test_required) {
          if (certDocId) {
            // 제공된 cert_doc_id의 유효성 확인
            const certCheck = await pool.query(
              `SELECT cert_doc_id, expiry_date, is_valid
               FROM cert_document
               WHERE cert_doc_id = $1 AND is_valid = TRUE AND expiry_date >= CURRENT_DATE`,
              [certDocId]
            );
            if (certCheck.rows.length > 0) {
              certDocVerified = true;
            }
          }
          // certDocId 없이도 검사 진행은 허용하되 ks_verified/cert_doc_verified로 상태 추적
          ksVerified = false; // NON_KS이므로 KS 인증 없음
        }
      }
    }

    // 기존 lot_id 사용 (비인수검사용) 또는 새로 생성
    let lotId: number | null = (body.lot_id as number) || null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. 인수검사: lot_transaction 생성 (검사 대상 LOT)
      if (isIncoming && itemId && qty) {
        const lotNumber = await generateIncomingLotNumber(itemId, inspDate);

        const lotResult = await client.query(
          `INSERT INTO lot_transaction
             (lot_number, lot_type, item_id, qty, unit, supplier_lot, inspection_result, status, remaining_qty,
              spec_thickness_mm, spec_width_mm, spec_length_mm, spec_density, total_length_mm)
           VALUES ($1, 'IN', $2, $3, (SELECT unit FROM item_master WHERE item_id = $2), $4, 'PENDING', 'ACTIVE', $3,
                  $5, $6, $7, $8, $9)
           RETURNING *`,
          [lotNumber, itemId, qty, supplierLot,
           specThickness, specWidth, specLength, specDensity, totalLengthMm]
        );
        lotId = lotResult.rows[0].lot_id;
      }

      // 2. 검사 헤더 생성 (샘플링 모드 자동 결정)
      let samplingN = 3;
      let acceptC = 0;
      if (isIncoming && lotId && itemId) {
        const samplingInfo = await determineSamplingMode(lotId, itemId);
        samplingN = samplingInfo.n;
        acceptC = samplingInfo.c;
      }

      const inspResult = await client.query(
        `INSERT INTO inspection (insp_type, form_code, lot_id, cert_id, sampling_n, accept_c, result, inspector, inspected_at,
         cert_doc_id, ks_verified, cert_doc_verified)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, NOW(), $8, $9, $10)
         RETURNING *`,
        [insp_type, body.form_code || null, lotId, body.cert_id || null, samplingN, acceptC, body.inspector || null,
         certDocId, ksVerified, certDocVerified]
      );
      const insp = inspResult.rows[0];

      // 3. 측정 상세 입력 + 자동 판정 (enhanced auto-judge)
      const itemResults: string[] = [];
      if (details && details.length > 0) {
        for (const d of details) {
          const itemResult = judgeDetailItem({
            check_method: d.check_method,
            cert_standard: d.cert_standard ?? null,
            measured_n1: d.measured_n1 ?? null,
            measured_n2: d.measured_n2 ?? null,
            measured_n3: d.measured_n3 ?? null,
            is_applicable: d.is_applicable !== false,
          }, d.direction || undefined);

          itemResults.push(itemResult);

          await client.query(
            `INSERT INTO inspection_detail
             (insp_id, item_no, quality_item, check_item, check_method,
              cert_standard, prod_standard, measured_n1, measured_n2, measured_n3,
              is_applicable, item_result, direction)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [
              insp.insp_id, d.item_no, d.quality_item, d.check_item, d.check_method,
              d.cert_standard ?? null, d.prod_standard ?? null,
              d.measured_n1 ?? null, d.measured_n2 ?? null, d.measured_n3 ?? null,
              d.is_applicable ?? true, itemResult, d.direction || 'MIN',
            ]
          );
        }
      }

      // 4. 전체 판정 업데이트 (enhanced)
      const overallResult = calculateOverallResult(itemResults);
      await client.query(
        `UPDATE inspection SET result = $1 WHERE insp_id = $2`,
        [overallResult, insp.insp_id]
      );

      // 5. LOT에 검사결과 반영
      if (lotId) {
        await client.query(
          `UPDATE lot_transaction SET inspection_result = $1 WHERE lot_id = $2`,
          [overallResult, lotId]
        );
      }

      // 6. 합격(PASS) 시 자동 재고 입고
      let inventoryTxn = null;
      if (isIncoming && overallResult === 'PASS' && lotId && itemId && qty) {
        const invResult = await client.query(
          `INSERT INTO inventory_transaction (item_id, lot_id, txn_type, txn_date, qty, purpose, worker, length_mm)
           VALUES ($1, $2, 'IN', $3, $4, 'INSP_PASS', $5, $6)
           RETURNING *`,
          [itemId, lotId, inspDate, qty, body.inspector || null, totalLengthMm]
        );
        inventoryTxn = invResult.rows[0];
      }

      await client.query('COMMIT');

      // LOT 정보 조회
      let lotInfo = null;
      if (lotId) {
        const lr = await pool.query('SELECT * FROM lot_transaction WHERE lot_id = $1', [lotId]);
        lotInfo = lr.rows[0];
      }

      return {
        data: {
          ...insp,
          result: overallResult,
          lot: lotInfo,
          inventory_created: inventoryTxn != null,
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // DELETE /api/inspections/:id - 검사 삭제
  app.delete('/api/inspections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const inspId = parseInt(id, 10);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM inspection_detail WHERE insp_id = $1', [inspId]);
      const result = await client.query('DELETE FROM inspection WHERE insp_id = $1 RETURNING *', [inspId]);
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ error: 'Not Found' });
      }
      await client.query('COMMIT');
      return { data: { success: true } };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // POST /api/inspections/:id/auto-judge - 자동 판정 재계산
  app.post('/api/inspections/:id/auto-judge', async (request, reply) => {
    const { id } = request.params as { id: string };
    const inspId = parseInt(id, 10);

    // Check inspection exists
    const inspCheck = await pool.query('SELECT insp_id FROM inspection WHERE insp_id = $1', [inspId]);
    if (inspCheck.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '검사를 찾을 수 없습니다.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await autoJudgeInspection(inspId, client);

      // If incoming inspection passes, ensure inventory is created
      const inspRow = await client.query(
        `SELECT ins.*, lt.item_id, lt.qty FROM inspection ins
         LEFT JOIN lot_transaction lt ON lt.lot_id = ins.lot_id
         WHERE ins.insp_id = $1`,
        [inspId]
      );
      const insp = inspRow.rows[0];
      if (insp && insp.insp_type === 'INCOMING' && result.overall_result === 'PASS' && insp.lot_id && insp.item_id) {
        // Check if inventory already exists for this lot
        const existingInv = await client.query(
          'SELECT inv_id FROM inventory_transaction WHERE lot_id = $1 AND txn_type = $2',
          [insp.lot_id, 'IN']
        );
        if (existingInv.rows.length === 0) {
          await client.query(
            `INSERT INTO inventory_transaction (item_id, lot_id, txn_type, txn_date, qty, purpose, worker)
             VALUES ($1, $2, 'IN', CURRENT_DATE, $3, 'INSP_PASS', $4)`,
            [insp.item_id, insp.lot_id, insp.qty, insp.inspector]
          );
        }
      }

      await client.query('COMMIT');
      return { data: result };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // PATCH /api/inspections/:id - 검사 수정 (검사자, 비고 등)
  app.patch('/api/inspections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const inspId = parseInt(id, 10);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const key of ['inspector', 'result', 'remarks']) {
      if (body[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(body[key]);
      }
    }

    if (fields.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: '수정할 항목이 없습니다.' });
    }

    values.push(inspId);
    const result = await pool.query(
      `UPDATE inspection SET ${fields.join(', ')} WHERE insp_id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found' });
    }
    return { data: result.rows[0] };
  });

  // PATCH /api/inspections/:id/details - 검사 측정값 수정 + 자동 재판정
  app.patch('/api/inspections/:id/details', async (request, reply) => {
    const { id } = request.params as { id: string };
    const inspId = parseInt(id, 10);
    const body = request.body as {
      inspector?: string;
      remarks?: string;
      details: Array<{
        detail_id: number;
        measured_n1?: number | null;
        measured_n2?: number | null;
        measured_n3?: number | null;
        is_applicable?: boolean;
      }>;
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 검사자/비고 업데이트
      if (body.inspector !== undefined || body.remarks !== undefined) {
        const fields: string[] = [];
        const vals: unknown[] = [];
        let idx = 1;
        if (body.inspector !== undefined) { fields.push(`inspector = $${idx++}`); vals.push(body.inspector); }
        if (body.remarks !== undefined) { fields.push(`remarks = $${idx++}`); vals.push(body.remarks); }
        vals.push(inspId);
        await client.query(`UPDATE inspection SET ${fields.join(', ')} WHERE insp_id = $${idx}`, vals);
      }

      // 각 측정값 업데이트 + 항목별 자동 판정
      for (const d of body.details) {
        await client.query(
          `UPDATE inspection_detail
           SET measured_n1 = $1, measured_n2 = $2, measured_n3 = $3,
               is_applicable = COALESCE($4, is_applicable)
           WHERE detail_id = $5 AND insp_id = $6`,
          [d.measured_n1 ?? null, d.measured_n2 ?? null, d.measured_n3 ?? null,
           d.is_applicable, d.detail_id, inspId]
        );

        // 자동 판정
        const detailRow = await client.query(
          `SELECT * FROM inspection_detail WHERE detail_id = $1`, [d.detail_id]
        );
        if (detailRow.rows.length > 0) {
          const dr = detailRow.rows[0];
          const itemResult = judgeDetailItem({
            check_method: dr.check_method,
            cert_standard: dr.cert_standard != null ? Number(dr.cert_standard) : null,
            measured_n1: dr.measured_n1 != null ? Number(dr.measured_n1) : null,
            measured_n2: dr.measured_n2 != null ? Number(dr.measured_n2) : null,
            measured_n3: dr.measured_n3 != null ? Number(dr.measured_n3) : null,
            is_applicable: dr.is_applicable !== false,
          }, dr.direction || 'MIN');
          await client.query(
            `UPDATE inspection_detail SET item_result = $1 WHERE detail_id = $2`,
            [itemResult, d.detail_id]
          );
        }
      }

      // 전체 판정 재계산
      const allDetails = await client.query(
        `SELECT item_result FROM inspection_detail WHERE insp_id = $1`, [inspId]
      );
      const overallResult = calculateOverallResult(allDetails.rows.map(r => r.item_result));
      await client.query(
        `UPDATE inspection SET result = $1, inspected_at = NOW() WHERE insp_id = $2`,
        [overallResult, inspId]
      );

      // ★ PASS 판정 시: lot_transaction 업데이트 + 재고 입고 자동 생성
      const inspInfo = await client.query(
        `SELECT ins.insp_type, ins.lot_id, lt.item_id, lt.qty, ins.inspector
         FROM inspection ins
         LEFT JOIN lot_transaction lt ON lt.lot_id = ins.lot_id
         WHERE ins.insp_id = $1`,
        [inspId]
      );
      if (inspInfo.rows.length > 0) {
        const inf = inspInfo.rows[0];
        // lot_transaction inspection_result 업데이트
        if (inf.lot_id) {
          await client.query(
            `UPDATE lot_transaction SET inspection_result = $1 WHERE lot_id = $2`,
            [overallResult, inf.lot_id]
          );
        }
        // 인수검사 PASS → inventory_transaction 자동 생성 (중복 방지)
        if (inf.insp_type === 'INCOMING' && overallResult === 'PASS' && inf.lot_id && inf.item_id) {
          const existingInv = await client.query(
            `SELECT inv_id FROM inventory_transaction WHERE lot_id = $1 AND txn_type = 'IN'`,
            [inf.lot_id]
          );
          if (existingInv.rows.length === 0) {
            await client.query(
              `INSERT INTO inventory_transaction (item_id, lot_id, txn_type, txn_date, qty, purpose, worker)
               VALUES ($1, $2, 'IN', CURRENT_DATE, $3, 'INSP_PASS', $4)`,
              [inf.item_id, inf.lot_id, inf.qty, inf.inspector]
            );
          }
        }
      }

      await client.query('COMMIT');

      // 결과 반환
      const updated = await pool.query(
        `SELECT ins.*, lt.lot_number, i.item_name, i.item_code
         FROM inspection ins
         LEFT JOIN lot_transaction lt ON lt.lot_id = ins.lot_id
         LEFT JOIN item_master i ON i.item_id = lt.item_id
         WHERE ins.insp_id = $1`, [inspId]
      );
      const updatedDetails = await pool.query(
        `SELECT * FROM inspection_detail WHERE insp_id = $1 ORDER BY item_no`, [inspId]
      );

      return { data: { ...updated.rows[0], details: updatedDetails.rows } };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // GET /api/inspections/cert-status/:itemId - 특정 품목의 KS/공인성적서 현황 조회
  // 인수검사 시작 전 해당 품목이 KS인지, 유효한 공인성적서가 있는지 확인
  app.get('/api/inspections/cert-status/:itemId', async (request, reply) => {
    const { itemId } = request.params as { itemId: string };
    const id = parseInt(itemId, 10);

    // 품목 KS 정보 조회
    const itemRes = await pool.query(
      `SELECT item_id, item_code, item_name, ks_type, ks_number, cert_test_items, cert_test_cycle
       FROM item_master WHERE item_id = $1`,
      [id]
    );
    if (itemRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '품목을 찾을 수 없습니다.' });
    }
    const item = itemRes.rows[0];

    // 유효한 공인성적서 목록 조회
    const validCerts = await pool.query(
      `SELECT cert_doc_id, supplier_name, supplier_lot, test_institution, cert_number,
              issued_date, expiry_date, test_items, test_results, is_valid, remarks
       FROM cert_document
       WHERE item_id = $1 AND is_valid = TRUE AND expiry_date >= CURRENT_DATE
       ORDER BY expiry_date DESC`,
      [id]
    );

    // 만료된/전체 성적서 수
    const allCertsCount = await pool.query(
      `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE) as expired
       FROM cert_document WHERE item_id = $1`,
      [id]
    );

    const ksType = item.ks_type || 'NON_KS';
    const hasValidCert = validCerts.rows.length > 0;
    const needsCert = ksType === 'NON_KS';  // 비규격은 공인성적서 필수

    return {
      data: {
        item_id: item.item_id,
        item_code: item.item_code,
        item_name: item.item_name,
        ks_type: ksType,
        ks_number: item.ks_number,
        cert_test_items: item.cert_test_items,
        cert_test_cycle: item.cert_test_cycle,
        needs_cert_doc: needsCert,
        has_valid_cert: hasValidCert,
        // KS인 경우 항상 OK, NON_KS인 경우 유효 성적서 있어야 OK
        inspection_ready: ksType === 'KS' || hasValidCert,
        warning: needsCert && !hasValidCert
          ? '⚠ 비규격(NON-KS) 제품입니다. 유효한 공인시험성적서가 없습니다. 검사 전 공인성적서를 등록하세요.'
          : null,
        valid_cert_documents: validCerts.rows,
        cert_stats: {
          total: parseInt(allCertsCount.rows[0]?.total || '0'),
          expired: parseInt(allCertsCount.rows[0]?.expired || '0'),
          valid: validCerts.rows.length,
        },
      },
    };
  });

  // GET /api/inspections/pending-from-receiving
  // 입고에서 자동 생성된 인수검사 대기 목록 (발주서 연결 정보 포함)
  app.get('/api/inspections/pending-from-receiving', async (request, reply) => {
    const result = await pool.query(`
      SELECT ins.insp_id, ins.insp_type, ins.form_code, ins.result, ins.inspector, ins.inspected_at,
             ins.lot_id, ins.sampling_n,
             lt.lot_number, lt.qty AS lot_qty, lt.supplier_lot, lt.inspection_result,
             im.item_name, im.item_code, im.item_category
      FROM inspection ins
      JOIN lot_transaction lt ON lt.lot_id = ins.lot_id
      JOIN item_master im ON im.item_id = lt.item_id
      WHERE ins.insp_type = 'INCOMING' AND ins.result = 'PENDING'
      ORDER BY ins.insp_id DESC
    `);
    return { data: result.rows, total: result.rows.length };
  });
}
