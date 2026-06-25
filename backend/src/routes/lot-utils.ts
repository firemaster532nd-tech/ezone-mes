import { pool } from '../db/pool.js';

/**
 * ═══════════════════════════════════════════════════════════════
 *  (주)이지원 LOT 번호 생성 유틸리티
 *  기준 문서: EZC-C-302 제품식별 및 추적성관리 규정 Rev.8
 * ═══════════════════════════════════════════════════════════════
 *
 * 【LOT 체계 요약】
 *
 * ① 원/부자재 인수검사:
 *    형식: YYMMDD[약호][3자리순번]
 *    예시: 260120GW001 (그라스울), 260203CW001 (세라믹울), 260211GI001 (강재류)
 *
 * ② 배합공정:
 *    형식: YYMMDD-S[2자리순번]
 *    예시: 260110-S01
 *
 * ③ 조립공정 (방화소켓/방화플래싱/버스덕트):
 *    형식: J[YYMMDD][제품약호][2자리순번]
 *    예시: J260110D01 (금속소켓류), J260110FI01 (방화플래싱 I형)
 *
 * ④ 덕트 내화채움구조체:
 *    형식: [YYMMDD]-[소켓약호]-[3자리순번]
 *    예시: 260110-VT-049-001
 *
 * ⑤ 비금속 배관류:
 *    형식: [YYMMDD]-[구조약호]-[규격]-[4자리시리얼]
 *    예시: 260110-FN-100-0001
 *
 * ⑥ 품질관리서 관리번호:
 *    형식: EZ1-[YY]-[MMDD]-[3자리]
 *    예시: EZ1-26-0110-001
 * ═══════════════════════════════════════════════════════════════
 */

// ──────────────────────────────────────────────────────────────
// C302 표1: 원자재·부자재 약호 매핑 (item_code prefix → LOT약호)
// ──────────────────────────────────────────────────────────────
export const ITEM_CODE_TO_ABBREV: Record<string, string> = {
  // 원자재
  'RM-MB':  'MB',   // 난연컴파운드 (PE3005MB)
  'RM-EG':  'EG',   // 흑연 50메쉬 (EG#5)
  'RM-EA':  'EA',   // EVA-EA33045
  'RM-EP':  'EP',   // EVA-EP100
  'RM-PE':  'PE',   // PE보온재

  // 부자재 - 원단/단열재
  'SM-CW':  'CW',   // 세라믹울-은박포장
  'SM-CWO': 'CWO',  // 세라믹울-생지
  'SM-GW':  'GW',   // 그라스울-롤 (GWR)
  'SM-GWB': 'GWB',  // 그라스울보온판-64K (덕트용)
  'SM-MW':  'MWP',  // 미네랄울 패드
  'SM-MWR': 'MWR',  // 미네랄울 롤

  // 부자재 - 강재/금속
  'SM-GI':  'GI',   // 강재류, 보호철판 (아연도금)
  'SM-SL':  'U',    // 일체형슬리브 (플라스틱ABS)
  'SM-MS':  'MS',   // 성형슬리브
  'SM-RDS': 'RDS',  // 우수드레인 전용슬리브

  // 부자재 - 화학/기타
  'SM-SS':  'SS',   // 실리콘 실란트
  'SM-PK':  'PK',   // 상,하부 고무패킹
  'SM-BK':  'BK',   // 브라켓
  'SM-BS':  'BS',   // 몸체 받침
  'SM-FSB': 'FSB',  // 내화채움재 브라켓
  'SM-VX':  'VX',   // 볼텍스

  // 레거시 매핑 (기존 코드 하위호환)
  'SM-SIL': 'SS',   // → SS로 통합
  'SM-BRK': 'BK',
  'SM-GP':  'GP',
  'SM-PM':  'PM',
  'SA-CUT': 'CT',
  'SA-EXT': 'EX',
  'SA-MIX': 'MX',
  'FP-':    'FP',
};

// ──────────────────────────────────────────────────────────────
// C302 표3: 조립 공정 제품명 약호
// ──────────────────────────────────────────────────────────────
export const ASSEMBLY_PRODUCT_ABBREV: Record<string, string> = {
  '방화플래싱 I형': 'FI',
  '방화플래싱 Z형': 'FZ',
  '방화플래싱 L형': 'FL',
  '방화플래싱 하이브리드형': 'FHY',
  'Curtain Wall-ALT-1 방화플래싱': 'CW-ALT-1',
  'Curtain Wall-ALT-2 방화플래싱': 'CW-ALT-2',
  '금속 소켓류': 'D',
  '버스덕트류': 'BD',
  '틈새시트': 'TS',
  '카플링내화채움구조': 'C',
};

// ──────────────────────────────────────────────────────────────
// C302 표5: 덕트 구조체 소켓명 약호
// ──────────────────────────────────────────────────────────────
export const DUCT_STRUCTURE_ABBREV: Record<string, string> = {
  'V-03':     'V-03',
  'VS-01':    'VS-01',
  'VT-01':    'VT-01',
  'VT-049':   'VT-049',
  'VT-064':   'VT-064',
  'VA-064':   'VA-064',
  'VAG-169':  'VAG-169',
  'HAG-169':  'HAG-169',
  'HTG-064':  'HTG-064',
  'HTG-169':  'HTG-169',
  'VTI-064':  'VTI-064',
  'BDCV-1S':  'BDCV-1S',
  'BDRV-3S':  'BDRV-3S',
  'BDRH-3S':  'BDRH-3S',
};

// ──────────────────────────────────────────────────────────────
// C302 표4: 비금속 배관류 구조약호
// ──────────────────────────────────────────────────────────────
export const PIPE_STRUCTURE_ABBREV: Record<string, string> = {
  'EZ-FN-P100':                     'FN',
  'EZ-V-P100-130':                  'VP',
  'EZ-PN-매립2단슬리브':             'PNR2',
  'EZ-PN-매립섹스티어':              'PNRS',
  'EZ-FN-P100(120H)':               'FN120',
  'EZ-FN-P100(180H)':               'FN180S',
  'EZ-HM-FD육가':                   'HMFD',
  'EZ-HM-볼텍스':                    'HMVX',
  'EZ-HM-P100':                     'HMP1',
  'EZ-HM-우수드레인':                'HMRD',
};

// ──────────────────────────────────────────────────────────────
// 유틸 함수
// ──────────────────────────────────────────────────────────────

/**
 * item_id로부터 C302 약호를 조회
 */
export async function getItemAbbrev(itemId: number): Promise<string> {
  const result = await pool.query(
    'SELECT item_code, item_category FROM item_master WHERE item_id = $1',
    [itemId]
  );
  if (result.rows.length === 0) return 'XX';

  const code = (result.rows[0].item_code as string) || '';
  const category = (result.rows[0].item_category as string) || '';

  // item_code prefix 매핑 우선
  for (const [prefix, abbrev] of Object.entries(ITEM_CODE_TO_ABBREV)) {
    if (code.startsWith(prefix)) return abbrev;
  }

  // 카테고리 기반 폴백
  const catMap: Record<string, string> = {
    '세라믹울':     'CW',
    '그라스울':     'GW',
    '강재류':      'GI',
    '보호철판':     'GI',
    '실란트':      'SS',
    '소켓':        'GI',
    '브라켓':      'BK',
    '슬리브':      'U',
    '미네랄울':    'MWP',
    '난연컴파운드': 'MB',
  };
  for (const [keyword, abbrev] of Object.entries(catMap)) {
    if (category.includes(keyword) || code.includes(keyword)) return abbrev;
  }

  return 'XX';
}

/**
 * 날짜 문자열에서 YYMMDD 추출
 * '2026-01-20' → '260120', '260120' → '260120'
 */
export function toDatePrefix(dateStr: string): string {
  const clean = dateStr.replace(/-/g, '');
  return clean.length >= 8 ? clean.slice(2, 8) : clean.slice(0, 6);
}

/**
 * structure_code에서 LOT용 코드 생성
 * VT-01 → VT-01, VAG-1.69 → VAG-169
 */
export function structureToLotCode(structureCode: string): string {
  // C302 표5 약호 직접 매핑 우선
  if (DUCT_STRUCTURE_ABBREV[structureCode]) {
    return DUCT_STRUCTURE_ABBREV[structureCode];
  }
  // 소수점 → 정수 변환 (1.69 → 169)
  return structureCode
    .replace(/\./g, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

/**
 * 다음 시퀀스 번호 조회 (LIKE 패턴 기반)
 * @param pattern  - SQL LIKE 패턴 (예: '260120GW%')
 * @param digitCount - 패딩 자릿수 (기본 3)
 * @param client   - 트랜잭션 클라이언트 (선택)
 */
export async function getNextSeq(
  pattern: string,
  digitCount: number = 3,
  client?: any
): Promise<string> {
  const db = client || pool;
  const result = await db.query(
    `SELECT lot_number FROM lot_transaction WHERE lot_number LIKE $1 ORDER BY lot_number DESC LIMIT 1`,
    [pattern]
  );

  if (result.rows.length === 0) {
    return String(1).padStart(digitCount, '0');
  }

  const lastLot = result.rows[0].lot_number as string;
  const match = lastLot.match(/(\d+)$/);
  if (!match) return String(1).padStart(digitCount, '0');

  const nextSeq = parseInt(match[1], 10) + 1;
  return String(nextSeq).padStart(digitCount, '0');
}

// ──────────────────────────────────────────────────────────────
// ① 원/부자재 인수검사 LOT 번호 생성
// ──────────────────────────────────────────────────────────────
/**
 * C302 §5.1.1 — 원·부자재 인수검사 LOT
 * 형식: YYMMDD[약호]NNN
 * 예시: 260120GW001, 260203CW001, 260211GI001
 *
 * @param itemId  - item_master.item_id
 * @param date    - 입고 날짜 (YYYY-MM-DD 또는 YYMMDD)
 * @param client  - 트랜잭션 클라이언트 (선택)
 */
export async function generateIncomingLotNumber(
  itemId: number,
  date: string,
  client?: any
): Promise<string> {
  const abbrev = await getItemAbbrev(itemId);
  const yymmdd = toDatePrefix(date);
  const pattern = `${yymmdd}${abbrev}%`;
  const seq = await getNextSeq(pattern, 3, client);
  return `${yymmdd}${abbrev}${seq}`;
}

/**
 * 약호를 직접 지정하여 인수검사 LOT 번호 생성 (수동 입력 보조용)
 * 예: generateIncomingLotNumberByAbbrev('GW', '2026-01-20') → '260120GW001'
 */
export async function generateIncomingLotNumberByAbbrev(
  abbrev: string,
  date: string,
  client?: any
): Promise<string> {
  const yymmdd = toDatePrefix(date);
  const pattern = `${yymmdd}${abbrev}%`;
  const seq = await getNextSeq(pattern, 3, client);
  return `${yymmdd}${abbrev}${seq}`;
}

// ──────────────────────────────────────────────────────────────
// ② 공정별 LOT 번호 생성
// ──────────────────────────────────────────────────────────────
/**
 * C302 §6 — 공정별 LOT 번호 생성
 *
 * MIX(배합): YYMMDD-SNN         예) 260110-S01
 * EXT(압출): 배합 LOT 계승 (배합 LOT 번호 그대로 사용)
 * CUT(재단): 배합/압출 LOT 계승 (배합 LOT 번호 그대로 사용)
 * ASM(조립, 방화소켓/플래싱): J[YYMMDD][제품약호][NN]  예) J260110D01
 * DUCT(덕트구조체): [YYMMDD]-[소켓약호]-[NNN]  예) 260110-VT-049-001
 * PIPE(비금속배관): [YYMMDD]-[구조약호]-[규격]-[NNNN]  예) 260110-FN-100-0001
 *
 * @param processCode - 'MIX'|'EXT'|'CUT'|'ASM'|'DUCT'|'PIPE'
 * @param woDate      - 작업지시 날짜
 * @param options     - certId, structureCode, productAbbrev, spec 등
 */
export async function generateProcessLotNumber(
  processCode: string,
  woDate: string,
  certId?: number,
  options?: {
    structureCode?: string;
    productAbbrev?: string;  // 조립 제품 약호 (D, FI, FZ, FL, FHY, BD, TS, C)
    spec?: string;           // 규격 (비금속배관용, 예: '100')
    client?: any;
  }
): Promise<string> {
  const yymmdd = toDatePrefix(woDate);
  const client = options?.client;

  switch (processCode) {
    // ② 배합공정: YYMMDD-SNN
    case 'MIX': {
      const pattern = `${yymmdd}-S%`;
      const seq = await getNextSeq(pattern, 2, client);
      return `${yymmdd}-S${seq}`;
    }

    // 압출·재단: 배합 LOT 계승 (호출 측에서 직접 배합 LOT 번호 사용)
    case 'EXT':
    case 'CUT': {
      // 배합공정 LOT 계승이 원칙이나, 독립 LOT이 필요한 경우 생성
      const pattern = `${yymmdd}-S%`;
      const seq = await getNextSeq(pattern, 2, client);
      return `${yymmdd}-S${seq}`;
    }

    // ③ 조립공정 (방화소켓/방화플래싱/버스덕트): J[YYMMDD][약호][NN]
    case 'ASM': {
      // 제품 약호 결정
      let productCode = options?.productAbbrev || '';
      if (!productCode && certId) {
        const certResult = await pool.query(
          `SELECT cm.structure_code, cm.cert_name
           FROM certification_master cm
           WHERE cm.cert_id = $1`,
          [certId]
        );
        if (certResult.rows.length > 0) {
          const structureCode = certResult.rows[0].structure_code as string;
          const certName = certResult.rows[0].cert_name as string;
          productCode = resolveAssemblyAbbrev(structureCode, certName);
        }
      }
      if (!productCode) productCode = 'D';  // 기본: 금속소켓류

      const pattern = `J${yymmdd}${productCode}%`;
      const seq = await getNextSeq(pattern, 2, client);
      return `J${yymmdd}${productCode}${seq}`;
    }

    // ④ 덕트 내화채움구조체: [YYMMDD]-[소켓약호]-[NNN]
    case 'DUCT': {
      let structCode = options?.structureCode
        ? structureToLotCode(options.structureCode)
        : 'VT-049';
      if (certId && !options?.structureCode) {
        const certResult = await pool.query(
          'SELECT structure_code FROM certification_master WHERE cert_id = $1',
          [certId]
        );
        if (certResult.rows.length > 0) {
          structCode = structureToLotCode(certResult.rows[0].structure_code);
        }
      }
      const pattern = `${yymmdd}-${structCode}-%`;
      const seq = await getNextSeq(pattern, 3, client);
      return `${yymmdd}-${structCode}-${seq}`;
    }

    // ⑤ 비금속 배관류: [YYMMDD]-[구조약호]-[규격]-[NNNN]
    case 'PIPE': {
      let structCode = options?.structureCode || 'FN';
      const spec = options?.spec || '100';
      if (PIPE_STRUCTURE_ABBREV[structCode]) {
        structCode = PIPE_STRUCTURE_ABBREV[structCode];
      }
      const pattern = `${yymmdd}-${structCode}-${spec}-%`;
      const seq = await getNextSeq(pattern, 4, client);
      return `${yymmdd}-${structCode}-${spec}-${seq}`;
    }

    // 기타 공정
    default: {
      const pattern = `${yymmdd}-${processCode}-%`;
      const seq = await getNextSeq(pattern, 3, client);
      return `${yymmdd}-${processCode}-${seq}`;
    }
  }
}

// ──────────────────────────────────────────────────────────────
// ⑥ 품질관리서 관리번호 생성
// ──────────────────────────────────────────────────────────────
/**
 * C302 §10.1 — 품질관리서 관리번호
 * 형식: EZ1-[YY]-[MMDD]-[3자리]
 * 예시: EZ1-26-0110-001
 */
export async function generateQualityReportNumber(date: string, client?: any): Promise<string> {
  const yymmdd = toDatePrefix(date);         // 260110
  const yy = yymmdd.slice(0, 2);             // 26
  const mmdd = yymmdd.slice(2, 6);           // 0110
  const pattern = `EZ1-${yy}-${mmdd}-%`;
  const seq = await getNextSeq(pattern, 3, client);
  return `EZ1-${yy}-${mmdd}-${seq}`;
}

// ──────────────────────────────────────────────────────────────
// 내부 헬퍼
// ──────────────────────────────────────────────────────────────

/**
 * 구조 코드/인증명에서 조립 약호 결정
 * C302 표3 참조
 */
function resolveAssemblyAbbrev(structureCode: string, certName: string): string {
  const upper = structureCode.toUpperCase();
  const name = certName.toUpperCase();

  if (upper.includes('BD') || name.includes('버스덕트')) return 'BD';
  if (upper.includes('TS') || name.includes('틈새')) return 'TS';
  if (upper.includes('FI') || name.includes('I형')) return 'FI';
  if (upper.includes('FZ') || name.includes('Z형')) return 'FZ';
  if (upper.includes('FL') || name.includes('L형')) return 'FL';
  if (upper.includes('FHY') || name.includes('하이브리드')) return 'FHY';
  if (upper.includes('CW-ALT')) return 'CW-ALT-1';
  if (upper.includes('VT') || upper.includes('VA') || upper.includes('HT')) return 'D';

  return 'D';  // 기본: 금속소켓류
}

// ──────────────────────────────────────────────────────────────
// LOT 계보 관리
// ──────────────────────────────────────────────────────────────

/**
 * LOT genealogy 자동 연결
 */
export async function linkLotGenealogy(
  parentLotId: number,
  childLotId: number,
  consumedQty?: number,
  componentPosition?: string
): Promise<void> {
  await pool.query(
    `INSERT INTO lot_genealogy (parent_lot_id, child_lot_id, consumed_qty, component_position)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (parent_lot_id, child_lot_id) DO NOTHING`,
    [parentLotId, childLotId, consumedQty || null, componentPosition || null]
  );
}

/**
 * 역추적: 완제품 LOT → 모든 원자재 LOT (C302 §9.1.1)
 */
export async function traceBack(lotId: number): Promise<any[]> {
  const result = await pool.query(`
    WITH RECURSIVE trace AS (
      SELECT lg.parent_lot_id, lg.child_lot_id, lg.consumed_qty, lg.component_position, 1 as depth
      FROM lot_genealogy lg
      WHERE lg.child_lot_id = $1
      UNION ALL
      SELECT lg.parent_lot_id, lg.child_lot_id, lg.consumed_qty, lg.component_position, t.depth + 1
      FROM lot_genealogy lg
      JOIN trace t ON lg.child_lot_id = t.parent_lot_id
      WHERE t.depth < 10
    )
    SELECT DISTINCT t.*,
           lt.lot_number, lt.lot_type, lt.qty, lt.item_id,
           im.item_name, im.item_code
    FROM trace t
    JOIN lot_transaction lt ON lt.lot_id = t.parent_lot_id
    LEFT JOIN item_master im ON im.item_id = lt.item_id
    ORDER BY t.depth DESC, lt.lot_type
  `, [lotId]);
  return result.rows;
}

/**
 * 정추적: 원자재 LOT → 모든 완제품 LOT (C302 §8)
 */
export async function traceForward(lotId: number): Promise<any[]> {
  const result = await pool.query(`
    WITH RECURSIVE trace AS (
      SELECT lg.parent_lot_id, lg.child_lot_id, lg.consumed_qty, lg.component_position, 1 as depth
      FROM lot_genealogy lg
      WHERE lg.parent_lot_id = $1
      UNION ALL
      SELECT lg.parent_lot_id, lg.child_lot_id, lg.consumed_qty, lg.component_position, t.depth + 1
      FROM lot_genealogy lg
      JOIN trace t ON lg.parent_lot_id = t.child_lot_id
      WHERE t.depth < 10
    )
    SELECT DISTINCT t.*,
           lt.lot_number, lt.lot_type, lt.qty, lt.item_id,
           im.item_name, im.item_code
    FROM trace t
    JOIN lot_transaction lt ON lt.lot_id = t.child_lot_id
    LEFT JOIN item_master im ON im.item_id = lt.item_id
    ORDER BY t.depth ASC, lt.lot_type
  `, [lotId]);
  return result.rows;
}

// ──────────────────────────────────────────────────────────────
// LOT 번호 유효성 검사
// ──────────────────────────────────────────────────────────────

/**
 * C302 형식의 LOT 번호인지 검사
 * 유효한 패턴:
 *  - YYMMDD[약호]NNN       (원/부자재 인수) ex) 260120GW001
 *  - YYMMDD-SNN            (배합)           ex) 260110-S01
 *  - J[YYMMDD][약호]NN     (조립)           ex) J260110D01
 *  - YYMMDD-[소켓]-NNN     (덕트구조체)     ex) 260110-VT-049-001
 *  - YYMMDD-[구조]-규격-NNNN (비금속배관)   ex) 260110-FN-100-0001
 */
export function isValidC302LotNumber(lotNumber: string): boolean {
  const patterns = [
    /^\d{6}[A-Z]{2,6}\d{3}$/,                        // 원/부자재
    /^\d{6}-S\d{2}$/,                                  // 배합
    /^J\d{6}[A-Z]{1,6}\d{2}$/,                        // 조립 (소켓/플래싱)
    /^\d{6}-[A-Z]{1,3}-\d{3}(-\d{4})?$/,              // 비금속배관
    /^\d{6}-[A-Z]{2,5}-\d{3}(-\d{3,4})?$/,            // 덕트구조체
    /^\d{6}-VT-\d{3}-\d{3}$/,                          // VT 덕트구조체
    /^\d{6}-[A-Z]{2,6}-[A-Z0-9-]+-\d{3,4}$/,          // 범용
    /^EZ1-\d{2}-\d{4}-\d{3}$/,                        // 품질관리서
  ];
  return patterns.some(p => p.test(lotNumber));
}
