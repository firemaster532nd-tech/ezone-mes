import { pool } from '../db/pool.js';

/**
 * C-302 Rev.8 표1 약호 매핑
 * item_code prefix → LOT 약호
 */
const ITEM_CODE_TO_ABBREV: Record<string, string> = {
  'RM-MB': 'MB',
  'RM-EG': 'EG',
  'RM-EA': 'EA',
  'RM-EP': 'EP',
  'SM-GI': 'GI',
  'SM-CW': 'CW',
  'SM-GW': 'GW',
  'SM-SIL': 'SL',
  'SM-BRK': 'BK',
  'SM-GP': 'GP',
  'SM-SS': 'SS',
  'SM-PM': 'PM',
  'SA-CUT': 'CT',
  'SA-EXT': 'EX',
  'SA-MIX': 'MX',
  'FP-': 'FP',
};

/**
 * item_id로부터 약호를 조회
 */
export async function getItemAbbrev(itemId: number): Promise<string> {
  const result = await pool.query(
    'SELECT item_code FROM item_master WHERE item_id = $1',
    [itemId]
  );
  if (result.rows.length === 0) return 'XX';
  const code = result.rows[0].item_code as string;

  for (const [prefix, abbrev] of Object.entries(ITEM_CODE_TO_ABBREV)) {
    if (code.startsWith(prefix)) return abbrev;
  }
  return 'XX';
}

/**
 * structure_code에서 LOT용 코드 생성
 * VT-01 → VT01, VAG-1.69 → VAG169, HTG(DC)-064 → HTGDC064
 */
export function structureToLotCode(structureCode: string): string {
  return structureCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * 날짜 문자열에서 YYMMDD 추출
 */
export function toDatePrefix(dateStr: string): string {
  // Handle both YYYY-MM-DD and YYMMDD formats
  const clean = dateStr.replace(/-/g, '');
  return clean.length >= 8 ? clean.slice(2, 8) : clean.slice(0, 6);
}

/**
 * 다음 시퀀스 번호 조회 (MAX+1 방식으로 개선)
 */
export async function getNextSeq(pattern: string, digitCount: number = 3): Promise<string> {
  const result = await pool.query(
    `SELECT lot_number FROM lot_transaction WHERE lot_number LIKE $1 ORDER BY lot_number DESC LIMIT 1`,
    [pattern]
  );

  if (result.rows.length === 0) {
    return String(1).padStart(digitCount, '0');
  }

  const lastLot = result.rows[0].lot_number as string;
  // Extract trailing digits
  const match = lastLot.match(/(\d+)$/);
  if (!match) return String(1).padStart(digitCount, '0');

  const nextSeq = parseInt(match[1], 10) + 1;
  return String(nextSeq).padStart(digitCount, '0');
}

/**
 * 입고 LOT 번호 생성 (개선)
 * Format: IN-[약호]-YYMMDD-NNN
 */
export async function generateIncomingLotNumber(itemId: number, date: string): Promise<string> {
  const abbrev = await getItemAbbrev(itemId);
  const datePrefix = toDatePrefix(date);
  const pattern = `IN-${abbrev}-${datePrefix}-%`;
  const seq = await getNextSeq(pattern);
  return `IN-${abbrev}-${datePrefix}-${seq}`;
}

/**
 * 공정 LOT 번호 생성 (개선)
 * MIX: YYMMDD-SNN (현행유지, C-601 Rev.4)
 * EXT: EXT-YYMMDD-NNN
 * CUT: CUT-YYMMDD-NNN
 * ASM: ASM-[구조코드]-YYMMDD-NNN
 * OUT: OUT-[구조코드]-YYMMDD-NNN
 */
export async function generateProcessLotNumber(
  processCode: string,
  woDate: string,
  certId?: number
): Promise<string> {
  const datePrefix = toDatePrefix(woDate);

  switch (processCode) {
    case 'MIX': {
      // C-601 Rev.4 형식 유지: YYMMDD-SNN
      const pattern = `${datePrefix}-S%`;
      const seq = await getNextSeq(pattern, 2);
      return `${datePrefix}-S${seq}`;
    }
    case 'EXT': {
      const pattern = `EXT-${datePrefix}-%`;
      const seq = await getNextSeq(pattern);
      return `EXT-${datePrefix}-${seq}`;
    }
    case 'CUT': {
      const pattern = `CUT-${datePrefix}-%`;
      const seq = await getNextSeq(pattern);
      return `CUT-${datePrefix}-${seq}`;
    }
    case 'ASM': {
      let structCode = '';
      if (certId) {
        const certResult = await pool.query(
          'SELECT structure_code FROM certification_master WHERE cert_id = $1',
          [certId]
        );
        if (certResult.rows.length > 0) {
          structCode = structureToLotCode(certResult.rows[0].structure_code);
        }
      }
      if (!structCode) structCode = 'GEN';
      const pattern = `ASM-${structCode}-${datePrefix}-%`;
      const seq = await getNextSeq(pattern);
      return `ASM-${structCode}-${datePrefix}-${seq}`;
    }
    case 'OUT': {
      let structCode = '';
      if (certId) {
        const certResult = await pool.query(
          'SELECT structure_code FROM certification_master WHERE cert_id = $1',
          [certId]
        );
        if (certResult.rows.length > 0) {
          structCode = structureToLotCode(certResult.rows[0].structure_code);
        }
      }
      if (!structCode) structCode = 'GEN';
      const pattern = `OUT-${structCode}-${datePrefix}-%`;
      const seq = await getNextSeq(pattern);
      return `OUT-${structCode}-${datePrefix}-${seq}`;
    }
    default: {
      const pattern = `${processCode}-${datePrefix}-%`;
      const seq = await getNextSeq(pattern);
      return `${processCode}-${datePrefix}-${seq}`;
    }
  }
}

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
 * 역추적: 완제품 LOT → 모든 원자재 LOT
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
 * 정추적: 원자재 LOT → 모든 완제품 LOT
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
