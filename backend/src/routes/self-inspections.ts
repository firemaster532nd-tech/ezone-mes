import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

/**
 * 공정별 자주검사 프리셋
 * 설계서 4.3절 기반 - 작업자가 생산 중 스스로 수행하는 검사
 *
 * MIX: 배합 중량/시간/외관
 * EXT: 6존 온도 + 시트 두께/너비/표면
 * CUT: 첫 제품 치수(길이/너비) + 표면상태
 * ASM: 접착/브라켓/실란트/틈새/외관
 */
interface CheckPreset {
  check_category: string;
  check_point: string;
  standard_value: number | null;
  tolerance: number | null;
  check_method: string;
  unit: string;
}

const PROCESS_PRESETS: Record<string, { label: string; description: string; items: CheckPreset[] }> = {
  MIX: {
    label: '배합 자주검사',
    description: '매 배치 투입량/시간/외관 확인',
    items: [
      { check_category: 'DIM', check_point: '투입 중량', standard_value: null, tolerance: 0.5, check_method: '저울', unit: 'kg' },
      { check_category: 'TEMP', check_point: '배합 온도', standard_value: null, tolerance: 5, check_method: '온도계', unit: '℃' },
      { check_category: 'VISUAL', check_point: '배합 상태 (균일성)', standard_value: 1, tolerance: 0, check_method: '육안', unit: 'OK/NG' },
      { check_category: 'VISUAL', check_point: '이물질 혼입 여부', standard_value: 1, tolerance: 0, check_method: '육안', unit: 'OK/NG' },
    ],
  },
  EXT: {
    label: '압출 자주검사',
    description: '6존 온도 수시 점검 + 시트 두께/너비/표면 확인',
    items: [
      // 6존 온도 (수시 점검)
      { check_category: 'TEMP', check_point: 'Barrel #1', standard_value: 170, tolerance: 10, check_method: '온도계', unit: '℃' },
      { check_category: 'TEMP', check_point: 'Barrel #2', standard_value: 175, tolerance: 10, check_method: '온도계', unit: '℃' },
      { check_category: 'TEMP', check_point: 'Barrel #3', standard_value: 180, tolerance: 10, check_method: '온도계', unit: '℃' },
      { check_category: 'TEMP', check_point: 'Barrel #4', standard_value: 185, tolerance: 10, check_method: '온도계', unit: '℃' },
      { check_category: 'TEMP', check_point: 'Confluent', standard_value: 190, tolerance: 10, check_method: '온도계', unit: '℃' },
      { check_category: 'TEMP', check_point: 'MOLD', standard_value: 195, tolerance: 10, check_method: '온도계', unit: '℃' },
      // 시트 품질 (수시 확인)
      { check_category: 'DIM', check_point: '시트 두께', standard_value: 5.0, tolerance: 0.3, check_method: '마이크로미터', unit: 'mm' },
      { check_category: 'DIM', check_point: '시트 너비', standard_value: null, tolerance: 5, check_method: '줄자', unit: 'mm' },
      { check_category: 'VISUAL', check_point: '시트 표면상태', standard_value: 1, tolerance: 0, check_method: '육안', unit: 'OK/NG' },
      { check_category: 'FILM', check_point: '필름 부착상태', standard_value: 1, tolerance: 0, check_method: '육안', unit: 'OK/NG' },
    ],
  },
  CUT: {
    label: '재단 자주검사',
    description: '첫 제품 치수 확인 후 연속생산, 수시 외관 점검',
    items: [
      // 첫 제품 치수검사
      { check_category: 'DIM', check_point: '재단 길이', standard_value: null, tolerance: 2, check_method: '줄자', unit: 'mm' },
      { check_category: 'DIM', check_point: '재단 너비', standard_value: null, tolerance: 2, check_method: '줄자', unit: 'mm' },
      { check_category: 'DIM', check_point: '재단 높이', standard_value: null, tolerance: 2, check_method: '줄자', unit: 'mm' },
      { check_category: 'DIM', check_point: '두께', standard_value: null, tolerance: 0.3, check_method: '마이크로미터', unit: 'mm' },
      // 외관
      { check_category: 'VISUAL', check_point: '절단면 상태', standard_value: 1, tolerance: 0, check_method: '육안', unit: 'OK/NG' },
      { check_category: 'VISUAL', check_point: '표면 손상 여부', standard_value: 1, tolerance: 0, check_method: '육안', unit: 'OK/NG' },
    ],
  },
  ASM: {
    label: '조립 자주검사',
    description: '조립 공정 중 접착/체결/도포/틈새/외관 수시 점검',
    items: [
      { check_category: 'VISUAL', check_point: '내측 접착상태', standard_value: 1, tolerance: 0, check_method: '육안', unit: 'OK/NG' },
      { check_category: 'VISUAL', check_point: '브라켓 체결상태', standard_value: 1, tolerance: 0, check_method: '육안', unit: 'OK/NG' },
      { check_category: 'VISUAL', check_point: '실란트 도포상태', standard_value: 1, tolerance: 0, check_method: '육안', unit: 'OK/NG' },
      { check_category: 'VISUAL', check_point: '핀 체결상태', standard_value: 1, tolerance: 0, check_method: '육안', unit: 'OK/NG' },
      { check_category: 'VISUAL', check_point: '방화시트 부착', standard_value: 1, tolerance: 0, check_method: '육안', unit: 'OK/NG' },
      { check_category: 'VISUAL', check_point: '차열시트 부착', standard_value: 1, tolerance: 0, check_method: '육안', unit: 'OK/NG' },
      { check_category: 'DIM', check_point: '틈새간격', standard_value: null, tolerance: 5, check_method: '줄자', unit: 'mm' },
      { check_category: 'VISUAL', check_point: '전체 외관', standard_value: 1, tolerance: 0, check_method: '육안', unit: 'OK/NG' },
    ],
  },
};

export async function selfInspectionRoutes(app: FastifyInstance) {
  // GET /api/self-inspections/presets - 공정별 자주검사 프리셋 목록
  app.get('/api/self-inspections/presets', async () => {
    return {
      data: Object.entries(PROCESS_PRESETS).map(([code, preset]) => ({
        process_code: code,
        label: preset.label,
        description: preset.description,
        item_count: preset.items.length,
      })),
    };
  });

  // GET /api/self-inspections/presets/:processCode - 특정 공정 프리셋 상세
  app.get('/api/self-inspections/presets/:processCode', async (request, reply) => {
    const { processCode } = request.params as { processCode: string };
    const preset = PROCESS_PRESETS[processCode.toUpperCase()];
    if (!preset) {
      return reply.status(404).send({ error: 'Not Found', message: `공정 ${processCode} 프리셋 없음` });
    }
    return { data: { process_code: processCode.toUpperCase(), ...preset } };
  });

  // GET /api/self-inspections - 자주검사 목록 (공정별 필터 추가)
  app.get('/api/self-inspections', async (request) => {
    const { wo_id, check_category, process_code } = request.query as {
      wo_id?: string;
      check_category?: string;
      process_code?: string;
    };

    let query = `
      SELECT si.*, w.wo_number, w.process_code
      FROM self_inspection si
      LEFT JOIN work_order w ON w.wo_id = si.wo_id
    `;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (wo_id) {
      params.push(parseInt(wo_id, 10));
      conditions.push(`si.wo_id = $${params.length}`);
    }
    if (check_category) {
      params.push(check_category);
      conditions.push(`si.check_category = $${params.length}`);
    }
    if (process_code) {
      params.push(process_code);
      conditions.push(`w.process_code = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY si.check_time DESC, si.self_insp_id DESC';

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });

  // POST /api/self-inspections/batch - 자주검사 일괄 등록 (공정 프리셋 기반)
  app.post('/api/self-inspections/batch', async (request, reply) => {
    const { wo_id, worker, items } = request.body as {
      wo_id: number;
      worker?: string;
      items: Array<{
        check_category: string;
        check_point: string;
        standard_value?: number;
        tolerance?: number;
        measured_value?: number;
        remarks?: string;
      }>;
    };

    if (!wo_id || !items || items.length === 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'wo_id, items는 필수입니다.',
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const results = [];

      for (const item of items) {
        let isOk: boolean | null = null;
        if (item.standard_value != null && item.measured_value != null) {
          const tolerance = item.tolerance ?? 0;
          // 육안검사: 1=OK, 0=NG
          if (item.standard_value === 1 && tolerance === 0) {
            isOk = item.measured_value >= 1;
          } else {
            const diff = Math.abs(item.measured_value - item.standard_value);
            isOk = diff <= tolerance;
          }
        }

        const res = await client.query(
          `INSERT INTO self_inspection
           (wo_id, check_time, check_category, check_point, standard_value, tolerance, measured_value, is_ok, worker, remarks)
           VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            wo_id,
            item.check_category,
            item.check_point,
            item.standard_value ?? null,
            item.tolerance ?? null,
            item.measured_value ?? null,
            isOk,
            worker || null,
            item.remarks || null,
          ]
        );
        results.push(res.rows[0]);
      }

      await client.query('COMMIT');
      return { data: results };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // POST /api/self-inspections - 단건 등록
  app.post('/api/self-inspections', async (request, reply) => {
    const body = request.body as {
      wo_id: number;
      check_category: string;
      check_point?: string;
      standard_value?: number;
      tolerance?: number;
      measured_value?: number;
      worker?: string;
      remarks?: string;
    };

    if (!body.wo_id || !body.check_category) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'wo_id, check_category는 필수입니다.',
      });
    }

    let isOk: boolean | null = null;
    if (body.standard_value != null && body.measured_value != null) {
      const tolerance = body.tolerance ?? 0;
      if (body.standard_value === 1 && tolerance === 0) {
        isOk = body.measured_value >= 1;
      } else {
        const diff = Math.abs(body.measured_value - body.standard_value);
        isOk = diff <= tolerance;
      }
    }

    const result = await pool.query(
      `INSERT INTO self_inspection
       (wo_id, check_time, check_category, check_point, standard_value, tolerance, measured_value, is_ok, worker, remarks)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        body.wo_id,
        body.check_category,
        body.check_point || null,
        body.standard_value ?? null,
        body.tolerance ?? null,
        body.measured_value ?? null,
        isOk,
        body.worker || null,
        body.remarks || null,
      ]
    );

    return { data: result.rows[0] };
  });

  // PATCH /api/self-inspections/:id - 자주검사 수정
  app.patch('/api/self-inspections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const key of ['measured_value', 'is_ok', 'worker', 'remarks']) {
      if (body[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(body[key]);
      }
    }

    if (fields.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: '수정할 항목이 없습니다.' });
    }

    values.push(parseInt(id, 10));
    const result = await pool.query(
      `UPDATE self_inspection SET ${fields.join(', ')} WHERE self_insp_id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found' });
    }
    return { data: result.rows[0] };
  });

  // DELETE /api/self-inspections/:id - 자주검사 삭제
  app.delete('/api/self-inspections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      'DELETE FROM self_inspection WHERE self_insp_id = $1 RETURNING *',
      [parseInt(id, 10)]
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found' });
    }
    return { data: { success: true } };
  });
}
