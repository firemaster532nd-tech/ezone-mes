import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

/**
 * 구조 LOT (Structure LOT) 라우트
 * 형식: YYMMDD-{구조코드}-{WxH}-NNN
 * 예시: 260309-VT-049-200X150-001~050
 */
export async function structureLotRoutes(app: FastifyInstance) {

  /**
   * POST /api/structure-lots/generate
   * 구조 LOT 번호 생성 (미리보기, DB 저장하지 않음)
   */
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

      // 동시성 보호를 위해 해당 base_lot 행들을 먼저 잠금
      await client.query(
        'SELECT lot_id FROM lot_transaction WHERE base_lot = $1 FOR UPDATE',
        [baseLot]
      );
      // 기존 시리얼 최대값 조회
      const existingResult = await client.query(
        'SELECT COALESCE(MAX(serial_end), 0) as max_serial FROM lot_transaction WHERE base_lot = $1',
        [baseLot]
      );
      const maxSerial = parseInt(existingResult.rows[0].max_serial, 10) || 0;

      const serialStart = maxSerial + 1;
      const serialEnd = serialStart + body.serial_count - 1;
      const lotNumber = `${baseLot}-${pad3(serialStart)}~${pad3(serialEnd)}`;

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
          existing_count: maxSerial,
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
