import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import {
  generateIncomingLotNumber,
  generateIncomingLotNumberByAbbrev,
  toDatePrefix,
  isValidC302LotNumber,
  ITEM_CODE_TO_ABBREV,
} from './lot-utils.js';

/**
 * LOT 번호 검증 및 자동생성
 * ═══════════════════════════════════════════════════════════════
 * 기준: EZC-C-302 제품식별 및 추적성관리 규정 Rev.8 (2026.05.06)
 *
 * C302 LOT 형식 (원/부자재 인수):
 *   형식: YYMMDD[약호]NNN
 *   예시: 260120GW001 (그라스울), 260203CW001 (세라믹울), 260211GI001 (강재류)
 *   약호: GW·CW·GI·SS·MB·EA·EP·BK·U·MS·MWP·MWR 등 (C302 표1)
 * ═══════════════════════════════════════════════════════════════
 */

// C302 원/부자재 LOT 형식: YYMMDD[약호]NNN
const LOT_FORMAT_C302 = /^(\d{6})([A-Z]{2,6})(\d{3})$/;
// 배합 LOT 형식: YYMMDD-SNN
const LOT_FORMAT_MIX = /^(\d{6})-S(\d{2})$/;
// 조립 LOT 형식: J[YYMMDD][약호]NN
const LOT_FORMAT_ASM = /^J(\d{6})([A-Z]{1,6})(\d{2})$/;
// 덕트구조체/비금속배관: YYMMDD-[약호]-NNN
const LOT_FORMAT_STRUCT = /^(\d{6})-([A-Z][A-Z0-9-]{1,10})-(\d{3,4})(-\d{3,4})?$/;
// 품질관리서: EZ1-YY-MMDD-NNN
const LOT_FORMAT_QR = /^EZ1-(\d{2})-(\d{4})-(\d{3})$/;

// 유효한 약호 목록 (C302 표1)
const VALID_ABBREVS = new Set(Object.values(ITEM_CODE_TO_ABBREV));

/** C302 형식 LOT 번호 파싱 */
function parseLotNumber(lotNumber: string): {
  type: 'incoming' | 'mix' | 'asm' | 'struct' | 'qr' | 'unknown';
  yymmdd?: string;
  abbrev?: string;
  seq?: string;
} {
  let m;

  m = LOT_FORMAT_C302.exec(lotNumber);
  if (m) return { type: 'incoming', yymmdd: m[1], abbrev: m[2], seq: m[3] };

  m = LOT_FORMAT_MIX.exec(lotNumber);
  if (m) return { type: 'mix', yymmdd: m[1], seq: m[2] };

  m = LOT_FORMAT_ASM.exec(lotNumber);
  if (m) return { type: 'asm', yymmdd: m[1], abbrev: m[2], seq: m[3] };

  m = LOT_FORMAT_STRUCT.exec(lotNumber);
  if (m) return { type: 'struct', yymmdd: m[1], abbrev: m[2] };

  m = LOT_FORMAT_QR.exec(lotNumber);
  if (m) return { type: 'qr', yymmdd: `${m[1]}${m[2]}` };

  return { type: 'unknown' };
}

interface ValidationWarning {
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export async function lotValidationRoutes(app: FastifyInstance) {
  /**
   * POST /api/lots/validate - LOT 번호 유효성 검증
   * C302 Rev.8 기반 LOT 번호 형식 검증
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

    // 1. FORMAT_ERROR: LOT 형식 검증
    const parsed = parseLotNumber(lot_number);

    if (parsed.type === 'unknown') {
      // 하위호환: 구형 IN-YYMMDD-NNN 형식도 경고로 허용
      const oldFmt = /^IN-(\d{6})-(\d{3})$/.exec(lot_number);
      const oldFmtNew = /^IN-([A-Z]{2})-(\d{6})-(\d{3})$/.exec(lot_number);

      if (oldFmt || oldFmtNew) {
        warnings.push({
          code: 'FORMAT_WARNING',
          message: `구형 LOT 형식입니다. C302 규정(Rev.8) 형식인 YYMMDD[약호]NNN 사용을 권장합니다. 예: 260203CW001`,
          severity: 'warning',
        });
      } else {
        warnings.push({
          code: 'FORMAT_ERROR',
          message: [
            'LOT 번호 형식이 올바르지 않습니다.',
            'C302 규정(Rev.8) 올바른 형식:',
            '  • 원/부자재: YYMMDD[약호]NNN → 예) 260203CW001',
            '  • 배합공정: YYMMDD-SNN → 예) 260203-S01',
            '  • 조립공정: J[YYMMDD][약호]NN → 예) J260203D01',
          ].join('\n'),
          severity: 'error',
        });
        return {
          valid: false,
          warnings,
          suggestion: await generateNextLotNumber(lot_date, item_id),
          format_guide: getLotFormatGuide(),
        };
      }
    }

    // 2. ABBREV_CHECK: 약호가 C302 표1에 있는지 확인 (원/부자재인 경우)
    if (parsed.type === 'incoming' && parsed.abbrev) {
      if (!VALID_ABBREVS.has(parsed.abbrev)) {
        warnings.push({
          code: 'ABBREV_WARNING',
          message: `약호 '${parsed.abbrev}'가 C302 표1에 없습니다. 유효한 약호: ${[...VALID_ABBREVS].join(', ')}`,
          severity: 'warning',
        });
      }
    }

    // 3. DATE_MISMATCH: LOT 번호 날짜와 입고일 비교
    const inputDateStr = toDatePrefix(lot_date); // YYMMDD
    const lotDateStr = parsed.yymmdd;
    if (lotDateStr && lotDateStr !== inputDateStr) {
      warnings.push({
        code: 'DATE_MISMATCH',
        message: `LOT 번호의 날짜(${lotDateStr})와 입고일(${inputDateStr})이 일치하지 않습니다.`,
        severity: 'warning',
      });
    }

    // 4. DUPLICATE_LOT: 중복 LOT 번호 확인
    const dupResult = await pool.query(
      'SELECT lot_id FROM lot_transaction WHERE lot_number = $1',
      [lot_number]
    );
    if (dupResult.rows.length > 0) {
      warnings.push({
        code: 'DUPLICATE_LOT',
        message: '이미 존재하는 LOT 번호입니다. (중복 등록 불가)',
        severity: 'error',
      });
    }

    // 5. SAME_SPEC_SAME_DATE: 동일 품목 + 동일 날짜 LOT 존재 여부
    if (item_id && inputDateStr) {
      const sameSpecResult = await pool.query(
        `SELECT lot_number FROM lot_transaction
         WHERE item_id = $1 AND lot_number LIKE $2
         ORDER BY lot_number`,
        [item_id, `${inputDateStr}%`]
      );
      if (sameSpecResult.rows.length > 0) {
        const existingLots = sameSpecResult.rows.map((r: any) => r.lot_number).join(', ');
        warnings.push({
          code: 'SAME_SPEC_SAME_DATE',
          message: `동일 품목/날짜에 이미 LOT(${existingLots})가 존재합니다. 동일 규격이면 기존 LOT에 합산하세요.`,
          severity: 'warning',
        });
      }
    }

    const hasError = warnings.some((w) => w.severity === 'error');

    return {
      valid: !hasError,
      warnings,
      suggestion: hasError ? await generateNextLotNumber(lot_date, item_id) : undefined,
      format_guide: getLotFormatGuide(),
    };
  });

  /**
   * GET /api/lots/next-number - C302 형식 다음 LOT 번호 자동생성
   * Query params: date (YYYY-MM-DD), item_id (optional), abbrev (optional)
   */
  app.get('/api/lots/next-number', async (request) => {
    const { date, item_id, abbrev } = request.query as {
      date?: string;
      item_id?: string;
      abbrev?: string;
    };

    if (!date) {
      return { error: 'date 파라미터가 필요합니다.', next_number: null };
    }

    let nextNumber: string;

    if (abbrev) {
      // 약호 직접 지정
      nextNumber = await generateIncomingLotNumberByAbbrev(abbrev.toUpperCase(), date);
    } else if (item_id) {
      // item_id로부터 약호 자동 결정
      nextNumber = await generateIncomingLotNumber(parseInt(item_id, 10), date);
    } else {
      // item_id 없으면 XX 약호 사용 (수동 입력 유도)
      const yymmdd = toDatePrefix(date);
      const pattern = `${yymmdd}%`;
      const result = await pool.query(
        `SELECT lot_number FROM lot_transaction WHERE lot_number LIKE $1 ORDER BY lot_number DESC LIMIT 1`,
        [pattern]
      );
      if (result.rows.length === 0) {
        nextNumber = `${yymmdd}XX001`;
      } else {
        const last = result.rows[0].lot_number as string;
        const m = last.match(/(\d{3})$/);
        const seq = m ? parseInt(m[1], 10) + 1 : 1;
        nextNumber = `${yymmdd}XX${String(seq).padStart(3, '0')}`;
      }
    }

    return {
      next_number: nextNumber,
      format_guide: getLotFormatGuide(),
    };
  });

  /**
   * GET /api/lots/abbrev-list - C302 약호 목록 조회
   */
  app.get('/api/lots/abbrev-list', async () => {
    return {
      abbrevs: [
        // 원자재
        { abbrev: 'MB',  name: '난연컴파운드 (PE3005MB)',  type: '원자재' },
        { abbrev: 'EG',  name: '흑연 50메쉬',               type: '원자재' },
        { abbrev: 'EA',  name: 'EVA-EA33045',              type: '원자재' },
        { abbrev: 'EP',  name: 'EVA-EP100',                type: '원자재' },
        { abbrev: 'PE',  name: 'PE보온재',                   type: '원자재' },
        // 부자재 - 단열재
        { abbrev: 'CW',  name: '세라믹울 (은박포장)',        type: '부자재' },
        { abbrev: 'CWO', name: '세라믹울 (생지)',            type: '부자재' },
        { abbrev: 'GW',  name: '그라스울 롤',               type: '부자재' },
        { abbrev: 'GWR', name: '그라스울 롤',               type: '부자재' },
        { abbrev: 'GWB', name: '그라스울보온판 (64K)',       type: '부자재' },
        { abbrev: 'MWP', name: '미네랄울 패드',             type: '부자재' },
        { abbrev: 'MWR', name: '미네랄울 롤',               type: '부자재' },
        // 부자재 - 금속/기타
        { abbrev: 'GI',  name: '강재류, 보호철판',           type: '부자재' },
        { abbrev: 'SS',  name: '실리콘 실란트',              type: '부자재' },
        { abbrev: 'U',   name: '일체형슬리브 (플라스틱ABS)', type: '부자재' },
        { abbrev: 'MS',  name: '성형슬리브',                 type: '부자재' },
        { abbrev: 'BK',  name: '브라켓',                    type: '부자재' },
        { abbrev: 'BS',  name: '몸체 받침',                  type: '부자재' },
        { abbrev: 'FSB', name: '내화채움재 브라켓',          type: '부자재' },
        { abbrev: 'VX',  name: '볼텍스',                    type: '부자재' },
        { abbrev: 'PK',  name: '고무패킹',                   type: '부자재' },
        { abbrev: 'RDS', name: '우수드레인 전용슬리브',      type: '부자재' },
      ],
    };
  });

  /**
   * GET /api/inspections/sampling-info - 샘플링 모드 결정
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
 * C302 형식 안내 텍스트
 */
function getLotFormatGuide() {
  return {
    incoming: 'YYMMDD[약호]NNN  예) 260203CW001 (세라믹울), 260120GW001 (그라스울), 260211GI001 (강재류)',
    mix:      'YYMMDD-SNN       예) 260203-S01 (차열시트 배합)',
    asm:      'J[YYMMDD][약호]NN 예) J260203D01 (방화소켓), J260203FI01 (방화플래싱 I형)',
    duct:     'YYMMDD-[소켓]-NNN 예) 260203-VT-049-001 (VT-049 덕트구조체)',
    pipe:     'YYMMDD-[구조]-[규격]-NNNN 예) 260203-FN-100-0001 (EZ-FN-P100)',
    qr:       'EZ1-YY-MMDD-NNN  예) EZ1-26-0203-001 (품질관리서)',
  };
}

/**
 * 다음 LOT 번호 생성 (C302 형식)
 */
async function generateNextLotNumber(date: string, itemId?: number): Promise<string> {
  if (itemId) {
    return generateIncomingLotNumber(itemId, date);
  }
  // item_id 없으면 날짜만으로 생성 (약호 XX)
  const yymmdd = toDatePrefix(date);
  return `${yymmdd}XX001`;
}

/**
 * 샘플링 모드 결정 (C302 Rev.8 기반)
 * 동일 품목 + 동일 날짜 = SAMPLING (n=3, c=0)
 * 단독 LOT = FULL (n=1, c=0)
 */
export async function determineSamplingMode(
  lotId: number,
  itemId: number
): Promise<{ mode: string; n: number; c: number; description: string }> {
  const lotResult = await pool.query(
    'SELECT lot_number, lot_date FROM lot_transaction WHERE lot_id = $1',
    [lotId]
  );

  if (lotResult.rows.length === 0) {
    return { mode: 'SAMPLING', n: 3, c: 0, description: '기본 샘플링 (n=3, c=0)' };
  }

  const lotNumber = lotResult.rows[0].lot_number as string;
  const lotDate = lotResult.rows[0].lot_date;

  // LOT 번호에서 날짜 추출 (YYMMDD)
  const parsed = parseLotNumber(lotNumber);
  const datePart = parsed.yymmdd;

  if (!datePart) {
    return { mode: 'SAMPLING', n: 3, c: 0, description: '기본 샘플링 (n=3, c=0)' };
  }

  // 동일 품목 + 동일 날짜의 LOT 수 조회 (C302 형식: YYMMDD로 시작)
  const countResult = await pool.query(
    `SELECT COUNT(*) as cnt FROM lot_transaction
     WHERE item_id = $1 AND lot_number LIKE $2`,
    [itemId, `${datePart}%`]
  );

  const lotCount = parseInt(countResult.rows[0].cnt, 10);

  if (lotCount > 1) {
    return {
      mode: 'SAMPLING',
      n: 3,
      c: 0,
      description: `동일규격 ${lotCount}개 로트 랜덤 3회 샘플링`,
    };
  }

  return {
    mode: 'FULL',
    n: 1,
    c: 0,
    description: '전수조사 (n=1)',
  };
}
