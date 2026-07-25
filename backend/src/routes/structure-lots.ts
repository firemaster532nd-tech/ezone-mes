import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

/**
 * 구조 LOT (Structure LOT) 라우트
 * 형식: YYMMDD-{구조코드}-{WxH}-NNN
 * 예시: 260309-VT-049-200X150-001~050
 */
export async function structureLotRoutes(app: FastifyInstance) {
  // ── 서버 시작 시 명세 데이터 초기화 (비동기 백그라운드)
  setImmediate(async () => {
    try {
    // ─── DB 마이그레이션 ─────────────────────────────────────────────────────
      // lot_number_sequence: 구조체 LOT 번호 중복 방지용 전용 시퀀스 테이블
      // SELECT FOR UPDATE로 잠금 → 동시 요청 시 순차 처리 보장
      await pool.query(`
        CREATE TABLE IF NOT EXISTS lot_number_sequence (
          base_lot    VARCHAR(200) PRIMARY KEY,
          last_serial INTEGER NOT NULL DEFAULT 0,
          updated_at  TIMESTAMPTZ DEFAULT NOW()
        );
      `).catch((e: unknown) => console.error('[Migration] lot_number_sequence:', e));
    
      // lot_transaction.lot_number UNIQUE 제약 (안전망)
      await pool.query(`
        ALTER TABLE lot_transaction
        ADD CONSTRAINT uk_lot_number_unique UNIQUE (lot_number);
      `).catch(() => { /* 이미 존재하거나 다른 방식으로 처리 */ });
    
      // ★ 서버 시작 시 기존 lot_transaction → lot_number_sequence 자동 동기화
      // 기존에 시퀀스 테이블 없이 저장된 LOT들도 올바른 시퀀스로 초기화됨
      await pool.query(`
        INSERT INTO lot_number_sequence (base_lot, last_serial)
        SELECT base_lot, COALESCE(MAX(serial_end), 0)
        FROM lot_transaction
        WHERE base_lot IS NOT NULL
        GROUP BY base_lot
        ON CONFLICT (base_lot) DO UPDATE
          SET last_serial = GREATEST(
            lot_number_sequence.last_serial,
            EXCLUDED.last_serial
          ),
          updated_at = NOW()
      `).catch((e: unknown) => console.error('[Migration] sync lot_number_sequence:', e));
    
      console.log('[structureLotRoutes] LOT 시퀀스 테이블 초기화 완료');
    
    
      /**
       * POST /api/structure-lots/generate
       * 구조 LOT 번호 생성 (미리보기, DB 저장하지 않음)
       * NOTE: lot_number_sequence 테이블에서 현재 마지막 시리얼을 읽어 정확한 미리보기 제공
        */
    } catch (e) { console.warn('[structure-lots.ts init]', e); }
  });

  app.post('/api/structure-lots/generate', async (request, reply) => {

    const body = request.body as {
      cert_id: number;
      production_date: string; // YYYY-MM-DD
      spec_width: number;
      spec_height: number;
      serial_count: number;
    };

    if (!body.cert_id || !body.production_date || !body.spec_width || !body.spec_height || !body.serial_count) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'cert_id, production_date, spec_width, spec_height, serial_count는 필수입니다.',
      });
    }

    // 인정구조 조회
    const certResult = await pool.query(
      'SELECT structure_code FROM certification_master WHERE cert_id = $1',
      [body.cert_id]
    );
    if (certResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '인정구조를 찾을 수 없습니다.' });
    }

    const structureCode = certResult.rows[0].structure_code;
    const yymmdd = formatDateYYMMDD(body.production_date);
    const specStr = `${body.spec_width}X${body.spec_height}`;
    const baseLot = `${yymmdd}-${structureCode}-${specStr}`;

    // 기존 시리얼 최대값 조회
    const existingResult = await pool.query(
      'SELECT COALESCE(MAX(serial_end), 0) as max_serial, COUNT(*) as cnt FROM lot_transaction WHERE base_lot = $1',
      [baseLot]
    );
    const maxSerial = parseInt(existingResult.rows[0].max_serial, 10) || 0;
    const existingCount = maxSerial; // 기존 시리얼 수량

    const serialStart = maxSerial + 1;
    const serialEnd = serialStart + body.serial_count - 1;
    const lotNumber = `${baseLot}-${pad3(serialStart)}~${pad3(serialEnd)}`;

    return {
      data: {
        base_lot: baseLot,
        serial_start: serialStart,
        serial_end: serialEnd,
        lot_number: lotNumber,
        existing_count: existingCount,
        total_after: serialEnd,
      },
    };
  });

  /**
   * POST /api/structure-lots
   * 구조 LOT 생성 (DB 저장)
   * ★ 핵심 수정: lot_number_sequence 테이블을 사용한 원자적 시퀀스 관리
   *   - 기존: lot_transaction FOR UPDATE → 기존 행 없으면 잠금 불가 → 레이스 컨디션
   *   - 신규: lot_number_sequence UPSERT + SELECT FOR UPDATE → 행 항상 존재 → 완전 직렬화
   */
  app.post('/api/structure-lots', async (request, reply) => {
    const body = request.body as {
      cert_id: number;
      item_id: number;
      work_order_id?: number;
      production_date: string;
      spec_width: number;
      spec_height: number;
      serial_count: number;
      remarks?: string;
    };

    if (!body.cert_id || !body.item_id || !body.production_date || !body.spec_width || !body.spec_height || !body.serial_count) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'cert_id, item_id, production_date, spec_width, spec_height, serial_count는 필수입니다.',
      });
    }

    // 인정구조 조회
    const certResult = await pool.query(
      'SELECT structure_code FROM certification_master WHERE cert_id = $1',
      [body.cert_id]
    );
    if (certResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '인정구조를 찾을 수 없습니다.' });
    }

    const structureCode = certResult.rows[0].structure_code;
    const yymmdd = formatDateYYMMDD(body.production_date);
    const specStr = `${body.spec_width}X${body.spec_height}`;
    const baseLot = `${yymmdd}-${structureCode}-${specStr}`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // ★ STEP 1: lot_number_sequence에 행이 없으면 lot_transaction의 현재 최대값으로 초기화
      //   ON CONFLICT DO NOTHING → 이미 있으면 그대로 유지
      await client.query(`
        INSERT INTO lot_number_sequence (base_lot, last_serial)
        SELECT $1, COALESCE(MAX(serial_end), 0)
        FROM lot_transaction
        WHERE base_lot = $1
        ON CONFLICT (base_lot) DO NOTHING
      `, [baseLot]);

      // ★ STEP 2: 행을 잠금 (SELECT FOR UPDATE)
      //   이제 행이 반드시 존재 → 동시 요청 시 완전 직렬화 보장
      const seqRow = await client.query(
        'SELECT last_serial FROM lot_number_sequence WHERE base_lot = $1 FOR UPDATE',
        [baseLot]
      );
      const currentMax = parseInt(seqRow.rows[0].last_serial, 10);

      // ★ STEP 3: 시리얼 범위 계산
      const serialStart = currentMax + 1;
      const serialEnd = currentMax + body.serial_count;
      const lotNumber = `${baseLot}-${pad3(serialStart)}~${pad3(serialEnd)}`;

      // ★ STEP 4: 시퀀스 테이블 업데이트
      await client.query(
        'UPDATE lot_number_sequence SET last_serial = $1, updated_at = NOW() WHERE base_lot = $2',
        [serialEnd, baseLot]
      );

      // ★ STEP 5: lot_transaction INSERT
      //   lot_number UNIQUE 제약이 있으므로 중복 시 오류로 안전하게 차단
      const insertResult = await client.query(
        `INSERT INTO lot_transaction
         (lot_number, lot_type, item_id, wo_id, qty, unit, base_lot, serial_start, serial_end, status, remaining_qty)
         VALUES ($1, 'ASM', $2, $3, $4, 'EA', $5, $6, $7, 'ACTIVE', $4)
         RETURNING *`,
        [lotNumber, body.item_id, body.work_order_id || null, body.serial_count, baseLot, serialStart, serialEnd]
      );

      await client.query('COMMIT');

      return {
        data: {
          ...insertResult.rows[0],
          base_lot: baseLot,
          serial_start: serialStart,
          serial_end: serialEnd,
          lot_number: lotNumber,
          existing_count: currentMax,
          total_after: serialEnd,
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  /**
   * GET /api/structure-lots/check-duplicates
   * 중복 LOT 감지 — 관리자용
   * lot_number 기준 중복, serial 범위 겹침 모두 체크
   */
  app.get('/api/structure-lots/check-duplicates', async () => {
    // 1. lot_number 완전 중복
    const exactDupes = await pool.query(`
      SELECT lot_number, COUNT(*) AS cnt,
             array_agg(lot_id) AS lot_ids,
             array_agg(created_at::date) AS dates
      FROM lot_transaction
      WHERE base_lot IS NOT NULL
      GROUP BY lot_number
      HAVING COUNT(*) > 1
      ORDER BY lot_number
    `);

    // 2. 같은 base_lot 내 serial 범위 겹침
    const overlapDupes = await pool.query(`
      SELECT a.base_lot,
             a.lot_id AS lot_id_a, a.lot_number AS lot_number_a,
             a.serial_start AS start_a, a.serial_end AS end_a,
             b.lot_id AS lot_id_b, b.lot_number AS lot_number_b,
             b.serial_start AS start_b, b.serial_end AS end_b
      FROM lot_transaction a
      JOIN lot_transaction b ON a.base_lot = b.base_lot
        AND a.lot_id < b.lot_id
        AND a.serial_start <= b.serial_end
        AND b.serial_start <= a.serial_end
      WHERE a.base_lot IS NOT NULL
      ORDER BY a.base_lot, a.serial_start
    `);

    // 3. 시퀀스 테이블 vs lot_transaction 불일치
    const seqMismatch = await pool.query(`
      SELECT seq.base_lot,
             seq.last_serial AS seq_last,
             COALESCE(MAX(lt.serial_end), 0) AS lot_max
      FROM lot_number_sequence seq
      LEFT JOIN lot_transaction lt ON lt.base_lot = seq.base_lot
      GROUP BY seq.base_lot, seq.last_serial
      HAVING seq.last_serial != COALESCE(MAX(lt.serial_end), 0)
    `);

    return {
      summary: {
        exact_duplicates: exactDupes.rows.length,
        overlap_duplicates: overlapDupes.rows.length,
        sequence_mismatches: seqMismatch.rows.length,
        total_issues: exactDupes.rows.length + overlapDupes.rows.length + seqMismatch.rows.length,
      },
      exact_duplicates: exactDupes.rows,
      overlap_duplicates: overlapDupes.rows,
      sequence_mismatches: seqMismatch.rows,
    };
  });

  /**
   * POST /api/structure-lots/repair-sequence
   * 시퀀스 테이블을 lot_transaction 실제 데이터 기준으로 재초기화 (관리자용)
   */
  app.post('/api/structure-lots/repair-sequence', async () => {
    const { rows } = await pool.query(`
      INSERT INTO lot_number_sequence (base_lot, last_serial)
      SELECT base_lot, COALESCE(MAX(serial_end), 0)
      FROM lot_transaction
      WHERE base_lot IS NOT NULL
      GROUP BY base_lot
      ON CONFLICT (base_lot) DO UPDATE
        SET last_serial = GREATEST(
          lot_number_sequence.last_serial,
          EXCLUDED.last_serial
        ),
        updated_at = NOW()
      RETURNING *
    `);
    return { data: rows, message: `${rows.length}개 base_lot 시퀀스 재초기화 완료` };
  });


  /**
   * GET /api/structure-lots
   * 구조 LOT 목록 조회
   */
  app.get('/api/structure-lots', async (request) => {
    const { cert_id, date, base_lot } = request.query as {
      cert_id?: string;
      date?: string;
      base_lot?: string;
    };

    let query = `
      SELECT lt.*, i.item_name, i.item_code, w.wo_number,
             c.structure_code, c.structure_name
      FROM lot_transaction lt
      LEFT JOIN item_master i ON i.item_id = lt.item_id
      LEFT JOIN work_order w ON w.wo_id = lt.wo_id
      LEFT JOIN certification_master c ON c.structure_code = SPLIT_PART(lt.base_lot, '-', 2) || '-' || SPLIT_PART(lt.base_lot, '-', 3)
      WHERE lt.lot_type = 'ASM' AND lt.base_lot IS NOT NULL
    `;
    const params: unknown[] = [];

    if (cert_id) {
      // 인정구조 ID로 필터 - structure_code를 조회해서 base_lot에 포함된 것만
      const certRes = await pool.query('SELECT structure_code FROM certification_master WHERE cert_id = $1', [parseInt(cert_id, 10)]);
      if (certRes.rows.length > 0) {
        params.push(`%-${certRes.rows[0].structure_code}-%`);
        query += ` AND lt.base_lot LIKE $${params.length}`;
      }
    }

    if (date) {
      // YYYY-MM-DD → YYMMDD prefix
      const yymmdd = formatDateYYMMDD(date);
      params.push(`${yymmdd}-%`);
      query += ` AND lt.base_lot LIKE $${params.length}`;
    }

    if (base_lot) {
      params.push(base_lot);
      query += ` AND lt.base_lot = $${params.length}`;
    }

    query += ' ORDER BY lt.created_at DESC';

    const result = await pool.query(query, params);

    // 각 LOT에 대한 검사 상태 추가
    const lotsWithInspection = await Promise.all(
      result.rows.map(async (lot) => {
        const inspResult = await pool.query(
          `SELECT COUNT(*) as insp_count,
                  COUNT(CASE WHEN result = 'PASS' THEN 1 END) as pass_count,
                  COUNT(CASE WHEN result = 'FAIL' THEN 1 END) as fail_count
           FROM inspection WHERE lot_id = $1 AND insp_type = 'PROCESS'`,
          [lot.lot_id]
        );
        const inspInfo = inspResult.rows[0];
        return {
          ...lot,
          inspection_count: parseInt(inspInfo.insp_count, 10),
          inspection_pass: parseInt(inspInfo.pass_count, 10),
          inspection_fail: parseInt(inspInfo.fail_count, 10),
        };
      })
    );

    return { data: lotsWithInspection, total: lotsWithInspection.length };
  });

  /**
   * GET /api/structure-lots/:lotId/summary
   * 구조 LOT 상세 및 검사 현황
   */
  app.get('/api/structure-lots/:lotId/summary', async (request, reply) => {
    const { lotId } = request.params as { lotId: string };
    const id = parseInt(lotId, 10);

    const lotResult = await pool.query(
      `SELECT lt.*, i.item_name, i.item_code, w.wo_number
       FROM lot_transaction lt
       LEFT JOIN item_master i ON i.item_id = lt.item_id
       LEFT JOIN work_order w ON w.wo_id = lt.wo_id
       WHERE lt.lot_id = $1`,
      [id]
    );

    if (lotResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '구조 LOT을 찾을 수 없습니다.' });
    }

    const lot = lotResult.rows[0];

    // 이 LOT에 연결된 검사 목록
    const inspections = await pool.query(
      `SELECT ins.insp_id, ins.form_code, ins.result, ins.inspector, ins.inspected_at, ins.remarks
       FROM inspection ins
       WHERE ins.lot_id = $1 AND ins.insp_type = 'PROCESS'
       ORDER BY ins.inspected_at DESC`,
      [id]
    );

    return {
      data: {
        ...lot,
        inspections: inspections.rows,
      },
    };
  });
}

/** YYYY-MM-DD → YYMMDD */
function formatDateYYMMDD(dateStr: string): string {
  const d = new Date(dateStr);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/** 숫자를 3자리 패딩 */
function pad3(n: number): string {
  return String(n).padStart(3, '0');
}
