import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { generateIncomingLotNumber, toDatePrefix } from './lot-utils.js';

/**
 * LOT 번호 검증 및 자동생성
 * C-302 Rev.8 기반 LOT 형식: IN-[약호]-YYMMDD-NNN (신규) 또는 IN-YYMMDD-NNN (하위호환)
 */

const LOT_FORMAT_REGEX_NEW = /^IN-([A-Z]{2})-(\d{6})-(\d{3})$/;
const LOT_FORMAT_REGEX_OLD = /^IN-(\d{6})-(\d{3})$/;

/** 신규/구형 LOT 번호 모두 지원하는 파싱 함수 */
function parseLotNumber(lotNumber: string): { abbrev: string | null; datePart: string; seq: string } | null {
  const matchNew = LOT_FORMAT_REGEX_NEW.exec(lotNumber);
  if (matchNew) {
    return { abbrev: matchNew[1], datePart: matchNew[2], seq: matchNew[3] };
  }
  const matchOld = LOT_FORMAT_REGEX_OLD.exec(lotNumber);
  if (matchOld) {
    return { abbrev: null, datePart: matchOld[1], seq: matchOld[2] };
  }
  return null;
}

interface ValidationWarning {
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export async function lotValidationRoutes(app: FastifyInstance) {
  /**
   * POST /api/lots/validate - LOT 번호 유효성 검증
   * C-302 Rev.8 제5절(표1 약호 14종)에 따른 LOT 번호 형식 검증
   */
  app.post('/api/lots/validate', async (request) => {
    const body = request.body as {
      item_id: number;
      lot_number: string;
      supplier_lot?: string;
      lot_date: string; // YYYY-MM-DD
    };

    const { item_id, lot_number, lot_date } = body;
    const warnings: ValidationWarning[] = [];

    // 1. FORMAT_ERROR: LOT 형식 검증 (IN-[약호]-YYMMDD-NNN 또는 IN-YYMMDD-NNN)
    const parsed = parseLotNumber(lot_number);
    if (!parsed) {
      warnings.push({
        code: 'FORMAT_ERROR',
        message: `LOT 번호 형식이 올바르지 않습니다. 올바른 형식: IN-XX-YYMMDD-NNN (예: IN-GW-260329-001)`,
        severity: 'error',
      });
      return {
        valid: false,
        warnings,
        suggestion: await generateNextLotNumber(lot_date, item_id),
      };
    }

    // 구형 포맷 사용 시 경고
    if (!parsed.abbrev) {
      warnings.push({
        code: 'FORMAT_WARNING',
        message: `구형 LOT 형식(IN-YYMMDD-NNN)입니다. 신규 형식 IN-XX-YYMMDD-NNN 사용을 권장합니다.`,
        severity: 'warning',
      });
    }

    const lotDatePart = parsed.datePart; // YYMMDD from LOT number

    // 2. ITEM_LOT_MISMATCH: LOT 번호 날짜와 입고일 비교
    const inputDateStr = lot_date.replace(/-/g, '').slice(2); // YYYY-MM-DD → YYMMDD
    if (lotDatePart !== inputDateStr) {
      warnings.push({
        code: 'ITEM_LOT_MISMATCH',
        message: `LOT 번호의 날짜(${lotDatePart})와 입고일(${inputDateStr})이 일치하지 않습니다.`,
        severity: 'warning',
      });
    }

    // 3. DUPLICATE_LOT: 중복 LOT 번호 확인
    const dupResult = await pool.query(
      'SELECT lot_id FROM lot_transaction WHERE lot_number = $1',
      [lot_number]
    );
    if (dupResult.rows.length > 0) {
      warnings.push({
        code: 'DUPLICATE_LOT',
        message: '이미 존재하는 LOT 번호입니다.',
        severity: 'error',
      });
    }

    // 4. SAME_SPEC_SAME_DATE: 동일 품목 + 동일 날짜 LOT 존재 여부 (신규+구형 형식 모두 검색)
    const datePatternNew = `IN-%-${inputDateStr}-%`;
    const datePatternOld = `IN-${inputDateStr}-%`;
    const sameSpecResult = await pool.query(
      `SELECT lot_number FROM lot_transaction WHERE item_id = $1 AND (lot_number LIKE $2 OR lot_number LIKE $3) ORDER BY lot_number`,
      [item_id, datePatternNew, datePatternOld]
    );
    if (sameSpecResult.rows.length > 0) {
      const existingLots = sameSpecResult.rows.map((r: any) => r.lot_number).join(', ');
      warnings.push({
        code: 'SAME_SPEC_SAME_DATE',
        message: `동일 품목/동일 날짜에 이미 LOT(${existingLots})가 존재합니다. 동일 규격이라면 기존 LOT에 시리얼을 추가하세요.`,
        severity: 'warning',
      });
    }

    const hasError = warnings.some((w) => w.severity === 'error');

    return {
      valid: !hasError,
      warnings,
      suggestion: hasError ? await generateNextLotNumber(lot_date, item_id) : undefined,
    };
  });

  /**
   * GET /api/lots/next-number - 다음 LOT 번호 자동생성
   * 해당 날짜의 기존 LOT 시리얼을 조회하여 다음 번호를 추천
   */
  app.get('/api/lots/next-number', async (request) => {
    const { date, item_id } = request.query as { date?: string; item_id?: string };
    if (!date) {
      return { error: 'date 파라미터가 필요합니다.', next_number: null };
    }

    const itemId = item_id ? parseInt(item_id, 10) : undefined;
    const nextNumber = await generateNextLotNumber(date, itemId);
    return { next_number: nextNumber };
  });

  /**
   * GET /api/inspections/sampling-info - 샘플링 모드 결정
   * 동일 규격 + 동일 날짜 = SAMPLING (n=3, c=0)
   * 단독 LOT = FULL (n=1, c=0)
   */
  app.get('/api/inspections/sampling-info', async (request) => {
    const { lot_id, item_id } = request.query as { lot_id?: string; item_id?: string };
    if (!lot_id || !item_id) {
      return { mode: 'SAMPLING', n: 3, c: 0, description: '기본 샘플링 (n=3, c=0)' };
    }

    const result = await determineSamplingMode(parseInt(lot_id, 10), parseInt(item_id, 10));
    return result;
  });
}

/**
 * 다음 LOT 번호 생성
 * item_id가 있으면 신규 형식(IN-XX-YYMMDD-NNN), 없으면 구형(IN-YYMMDD-NNN) fallback
 */
async function generateNextLotNumber(date: string, itemId?: number): Promise<string> {
  if (itemId) {
    return generateIncomingLotNumber(itemId, date);
  }
  // item_id 없으면 구형 형식 fallback
  const dateStr = toDatePrefix(date);
  const pattern = `IN-${dateStr}-%`;

  const result = await pool.query(
    `SELECT lot_number FROM lot_transaction WHERE lot_number LIKE $1 ORDER BY lot_number DESC LIMIT 1`,
    [pattern]
  );

  if (result.rows.length === 0) {
    return `IN-${dateStr}-001`;
  }

  const lastLot = result.rows[0].lot_number as string;
  const parsed = parseLotNumber(lastLot);
  if (!parsed) {
    return `IN-${dateStr}-001`;
  }

  const nextSeq = parseInt(parsed.seq, 10) + 1;
  return `IN-${dateStr}-${String(nextSeq).padStart(3, '0')}`;
}

/**
 * 샘플링 모드 결정 (C-302 Rev.8 기반)
 * - 동일 규격(item_id) + 동일 날짜에 여러 LOT가 있으면 SAMPLING (n=3, c=0)
 * - 단독 LOT이면 FULL (n=1, c=0) → 실제로는 전수조사이므로 n1만 사용
 */
export async function determineSamplingMode(
  lotId: number,
  itemId: number
): Promise<{ mode: string; n: number; c: number; description: string }> {
  // LOT 번호에서 날짜 추출
  const lotResult = await pool.query(
    'SELECT lot_number FROM lot_transaction WHERE lot_id = $1',
    [lotId]
  );

  if (lotResult.rows.length === 0) {
    return { mode: 'SAMPLING', n: 3, c: 0, description: '기본 샘플링 (n=3, c=0)' };
  }

  const lotNumber = lotResult.rows[0].lot_number as string;
  const parsed = parseLotNumber(lotNumber);
  if (!parsed) {
    return { mode: 'SAMPLING', n: 3, c: 0, description: '기본 샘플링 (n=3, c=0)' };
  }

  const datePart = parsed.datePart; // YYMMDD
  // 신규+구형 형식 모두 검색
  const patternNew = `IN-%-${datePart}-%`;
  const patternOld = `IN-${datePart}-%`;

  // 동일 품목 + 동일 날짜의 LOT 수 조회
  const countResult = await pool.query(
    `SELECT COUNT(*) as cnt FROM lot_transaction WHERE item_id = $1 AND (lot_number LIKE $2 OR lot_number LIKE $3)`,
    [itemId, patternNew, patternOld]
  );

  const lotCount = parseInt(countResult.rows[0].cnt, 10);

  if (lotCount > 1) {
    // 동일 규격 + 동일 날짜에 여러 LOT → 랜덤 3회 샘플링
    return {
      mode: 'SAMPLING',
      n: 3,
      c: 0,
      description: '동일규격 로트 랜덤 3회 샘플링',
    };
  }

  // 단독 LOT → 전수조사 (n=1)
  return {
    mode: 'FULL',
    n: 1,
    c: 0,
    description: '전수조사 (n=1)',
  };
}
