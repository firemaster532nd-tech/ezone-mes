import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

/**
 * C-701 Rev.5 통합양식 10종 검사항목 템플릿
 * 설계서 4.2절 기반
 * - C01: 압출검사
 * - G01R/G01A: 입상 재단/조립
 * - G02R/G02A: 벽체 재단/조립
 * - G03R/G03A: 부스덕트 재단/조립
 * - G04R/G04A: 비금속 재단/조립
 */
interface InspectionTemplate {
  form_code: string;
  form_name: string;
  process: string;
  group_code: string;
  items: Array<{
    item_no: number;
    quality_item: string;
    check_item: string;
    check_method: string;
    default_applicable: boolean;
  }>;
}

const INSPECTION_TEMPLATES: InspectionTemplate[] = [
  {
    form_code: 'C01',
    form_name: '압출검사 (EZC-C-701-C01)',
    process: 'EXT',
    group_code: 'EXT',
    items: [
      { item_no: 1, quality_item: '차열시트 압출', check_item: '두께(mm)', check_method: '버니어캘리퍼스', default_applicable: true },
      { item_no: 2, quality_item: '차열시트 압출', check_item: '너비(mm)', check_method: '줄자', default_applicable: true },
      { item_no: 3, quality_item: '차열시트 압출', check_item: '필름부착 상태', check_method: '육안', default_applicable: true },
      { item_no: 4, quality_item: '온도', check_item: 'Barrel #1', check_method: '온도계', default_applicable: true },
      { item_no: 5, quality_item: '온도', check_item: 'Barrel #2', check_method: '온도계', default_applicable: true },
      { item_no: 6, quality_item: '온도', check_item: 'Barrel #3', check_method: '온도계', default_applicable: true },
      { item_no: 7, quality_item: '온도', check_item: 'Barrel #4', check_method: '온도계', default_applicable: true },
      { item_no: 8, quality_item: '온도', check_item: 'Confluent', check_method: '온도계', default_applicable: true },
      { item_no: 9, quality_item: '온도', check_item: 'MOLD', check_method: '온도계', default_applicable: true },
      { item_no: 10, quality_item: '필름', check_item: '로고필름 사용', check_method: '체크', default_applicable: true },
      { item_no: 11, quality_item: '필름', check_item: '고로필름(배파베리어) 사용', check_method: '체크', default_applicable: true },
    ],
  },
  {
    form_code: 'G01R',
    form_name: '입상 재단검사 (EZC-C-701-G01R)',
    process: 'CUT',
    group_code: 'G01',
    items: [
      { item_no: 1, quality_item: '소켓용 재단', check_item: '길이(mm) 상/하', check_method: '줄자', default_applicable: true },
      { item_no: 2, quality_item: '소켓용 재단', check_item: '너비(mm) 상/하', check_method: '줄자', default_applicable: true },
      { item_no: 3, quality_item: '소켓용 재단', check_item: '길이(mm) 좌/우', check_method: '줄자', default_applicable: true },
      { item_no: 4, quality_item: '소켓용 재단', check_item: '너비(mm) 좌/우', check_method: '줄자', default_applicable: true },
      { item_no: 5, quality_item: '소켓용 재단', check_item: '길이(mm) 받침대', check_method: '줄자', default_applicable: true },
      { item_no: 6, quality_item: '소켓용 재단', check_item: '너비(mm) 받침대', check_method: '줄자', default_applicable: true },
      { item_no: 7, quality_item: '외부시트', check_item: '길이(mm) 상/하', check_method: '줄자', default_applicable: true },
      { item_no: 8, quality_item: '외부시트', check_item: '너비(mm) 상/하', check_method: '줄자', default_applicable: true },
      { item_no: 9, quality_item: '외부시트', check_item: '길이(mm) 좌/우', check_method: '줄자', default_applicable: true },
      { item_no: 10, quality_item: '외부시트', check_item: '너비(mm) 좌/우', check_method: '줄자', default_applicable: true },
      { item_no: 11, quality_item: '플래싱', check_item: '길이(mm)', check_method: '줄자', default_applicable: true },
      { item_no: 12, quality_item: '플래싱', check_item: '너비(mm)', check_method: '줄자', default_applicable: true },
    ],
  },
  {
    form_code: 'G01A',
    form_name: '입상 조립검사 (EZC-C-701-G01A)',
    process: 'ASM',
    group_code: 'G01',
    items: [
      { item_no: 1, quality_item: '내부', check_item: '차열시트 부착', check_method: '육안', default_applicable: true },
      { item_no: 2, quality_item: '내부', check_item: '브라켓 조립', check_method: '육안', default_applicable: true },
      { item_no: 3, quality_item: '내부', check_item: '실란트 마감', check_method: '육안', default_applicable: true },
      { item_no: 4, quality_item: '외부', check_item: '보온핀 부착', check_method: '육안', default_applicable: true },
      { item_no: 5, quality_item: '외부', check_item: '차열재 부착', check_method: '육안', default_applicable: true },
      { item_no: 6, quality_item: '외부', check_item: '차열시트 부착', check_method: '육안', default_applicable: true },
      { item_no: 7, quality_item: '플래싱', check_item: '차열시트 부착', check_method: '육안', default_applicable: true },
      { item_no: 8, quality_item: '플래싱', check_item: '강판 결합', check_method: '육안', default_applicable: true },
      { item_no: 9, quality_item: '틈새시트', check_item: '결합 상태', check_method: '육안', default_applicable: true },
    ],
  },
  {
    form_code: 'G02R',
    form_name: '벽체 재단검사 (EZC-C-701-G02R)',
    process: 'CUT',
    group_code: 'G02',
    items: [
      { item_no: 1, quality_item: '내부 재단', check_item: '길이(mm) 상/하', check_method: '줄자', default_applicable: true },
      { item_no: 2, quality_item: '내부 재단', check_item: '너비(mm) 상/하', check_method: '줄자', default_applicable: true },
      { item_no: 3, quality_item: '내부 재단', check_item: '길이(mm) 좌/우', check_method: '줄자', default_applicable: true },
      { item_no: 4, quality_item: '내부 재단', check_item: '너비(mm) 좌/우', check_method: '줄자', default_applicable: true },
      { item_no: 5, quality_item: '외부 재단', check_item: '길이(mm) 상/하', check_method: '줄자', default_applicable: true },
      { item_no: 6, quality_item: '외부 재단', check_item: '너비(mm) 상/하', check_method: '줄자', default_applicable: true },
      { item_no: 7, quality_item: '외부 재단', check_item: '길이(mm) 좌/우', check_method: '줄자', default_applicable: true },
      { item_no: 8, quality_item: '외부 재단', check_item: '너비(mm) 좌/우', check_method: '줄자', default_applicable: true },
      { item_no: 9, quality_item: '플래싱', check_item: '길이(mm)', check_method: '줄자', default_applicable: true },
      { item_no: 10, quality_item: '플래싱', check_item: '너비(mm)', check_method: '줄자', default_applicable: true },
    ],
  },
  {
    form_code: 'G02A',
    form_name: '벽체 조립검사 (EZC-C-701-G02A)',
    process: 'ASM',
    group_code: 'G02',
    items: [
      { item_no: 1, quality_item: '내부', check_item: '차열시트 부착', check_method: '육안', default_applicable: true },
      { item_no: 2, quality_item: '내부', check_item: '브라켓 조립', check_method: '육안', default_applicable: true },
      { item_no: 3, quality_item: '내부', check_item: '실란트 마감', check_method: '육안', default_applicable: true },
      { item_no: 4, quality_item: '외부', check_item: '보온핀 부착', check_method: '육안', default_applicable: true },
      { item_no: 5, quality_item: '외부', check_item: '차열재 부착', check_method: '육안', default_applicable: true },
      { item_no: 6, quality_item: '외부', check_item: '차열시트 부착', check_method: '육안', default_applicable: true },
      { item_no: 7, quality_item: '플래싱', check_item: '차열시트 부착', check_method: '육안', default_applicable: true },
      { item_no: 8, quality_item: '플래싱', check_item: '강판 결합', check_method: '육안', default_applicable: true },
      { item_no: 9, quality_item: '틈새시트', check_item: '결합 상태', check_method: '육안', default_applicable: true },
    ],
  },
  {
    form_code: 'G03R',
    form_name: '부스덕트 재단검사 (EZC-C-701-G03R)',
    process: 'CUT',
    group_code: 'G03',
    items: [
      { item_no: 1, quality_item: '내화채움재', check_item: '길이(mm)', check_method: '줄자', default_applicable: true },
      { item_no: 2, quality_item: '내화채움재', check_item: '너비(mm)', check_method: '줄자', default_applicable: true },
      { item_no: 3, quality_item: '플래싱', check_item: '길이(mm)', check_method: '줄자', default_applicable: true },
      { item_no: 4, quality_item: '플래싱', check_item: '너비(mm)', check_method: '줄자', default_applicable: true },
    ],
  },
  {
    form_code: 'G03A',
    form_name: '부스덕트 조립검사 (EZC-C-701-G03A)',
    process: 'ASM',
    group_code: 'G03',
    items: [
      { item_no: 1, quality_item: '조립 겉모양', check_item: '플래싱 결합 상태', check_method: '육안', default_applicable: true },
      { item_no: 2, quality_item: '틈새복합시트', check_item: '밀착 상태', check_method: '육안', default_applicable: true },
      { item_no: 3, quality_item: '틈새복합시트', check_item: '차열시트+세라믹울 결합', check_method: '육안', default_applicable: true },
      { item_no: 4, quality_item: '단열재', check_item: '부착/파손 유무', check_method: '육안', default_applicable: true },
      { item_no: 5, quality_item: '덕트 고정', check_item: '고정 상태', check_method: '육안', default_applicable: true },
    ],
  },
  {
    form_code: 'G04R',
    form_name: '비금속 재단검사 (EZC-C-701-G04R)',
    process: 'CUT',
    group_code: 'G04',
    items: [
      { item_no: 1, quality_item: '내화채움재', check_item: '길이(mm)', check_method: '줄자', default_applicable: true },
      { item_no: 2, quality_item: '내화채움재', check_item: '너비(mm)', check_method: '줄자', default_applicable: true },
      { item_no: 3, quality_item: '내화채움재', check_item: '중량(g)', check_method: '저울', default_applicable: true },
      { item_no: 4, quality_item: '플래싱', check_item: '길이(mm)', check_method: '줄자', default_applicable: true },
      { item_no: 5, quality_item: '플래싱', check_item: '너비(mm)', check_method: '줄자', default_applicable: true },
    ],
  },
  {
    form_code: 'G04A',
    form_name: '비금속 조립검사 (EZC-C-701-G04A)',
    process: 'ASM',
    group_code: 'G04',
    items: [
      { item_no: 1, quality_item: '조립 겉모양', check_item: '차열시트 삽입/부착', check_method: '육안', default_applicable: true },
      { item_no: 2, quality_item: '조립 겉모양', check_item: '보호철판 결합', check_method: '육안', default_applicable: true },
      { item_no: 3, quality_item: '조립 겉모양', check_item: '플래싱 결합', check_method: '육안', default_applicable: true },
      { item_no: 4, quality_item: '틈새복합시트', check_item: '결합 상태', check_method: '육안', default_applicable: true },
      { item_no: 5, quality_item: '단열재', check_item: '부착/파손 유무', check_method: '육안', default_applicable: true },
    ],
  },
];

/**
 * 인정구조에 따라 적용되는 양식코드 결정
 * 설계서 기반: 제품군(MP/BD/NP) + 설치위치(수직/수평) + 공정
 */
function getFormCodesForStructure(
  productGroup: string,
  installPosition: string,
  processCode: string
): string[] {
  if (processCode === 'EXT') return ['C01'];

  const groupMap: Record<string, string> = {
    'MP_수직벽체': 'G02',
    'MP_수평바닥': 'G01',
    'BD_수직벽체': 'G03',
    'BD_수평바닥': 'G03',
    'NP_수직벽체': 'G04',
    'NP_수평바닥': 'G04',
  };

  const key = `${productGroup}_${installPosition}`;
  const group = groupMap[key] || 'G01';

  if (processCode === 'CUT') return [`${group}R`];
  if (processCode === 'ASM') return [`${group}A`];
  return [];
}

export async function processInspectionRoutes(app: FastifyInstance) {
  // GET /api/process-inspections/templates - C-701 양식 목록
  app.get('/api/process-inspections/templates', async () => {
    return {
      data: INSPECTION_TEMPLATES.map((t) => ({
        form_code: t.form_code,
        form_name: t.form_name,
        process: t.process,
        group_code: t.group_code,
        item_count: t.items.length,
      })),
    };
  });

  // GET /api/process-inspections/templates/:formCode - 특정 양식 상세 + 검사항목
  app.get('/api/process-inspections/templates/:formCode', async (request, reply) => {
    const { formCode } = request.params as { formCode: string };
    const template = INSPECTION_TEMPLATES.find((t) => t.form_code === formCode);
    if (!template) {
      return reply.status(404).send({ error: 'Not Found', message: `양식 ${formCode}을 찾을 수 없습니다.` });
    }
    return { data: template };
  });

  // GET /api/process-inspections/for-wo/:woId - 작업지시에 적합한 양식 자동 결정
  app.get('/api/process-inspections/for-wo/:woId', async (request, reply) => {
    const { woId } = request.params as { woId: string };

    const woResult = await pool.query(
      `SELECT w.*, c.product_group, c.install_position, c.structure_code
       FROM work_order w
       LEFT JOIN certification_master c ON c.cert_id = w.cert_id
       WHERE w.wo_id = $1`,
      [parseInt(woId, 10)]
    );

    if (woResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    const wo = woResult.rows[0];
    const formCodes = getFormCodesForStructure(
      wo.product_group || 'MP',
      wo.install_position || '수직벽체',
      wo.process_code
    );

    const templates = formCodes
      .map((code) => INSPECTION_TEMPLATES.find((t) => t.form_code === code))
      .filter(Boolean);

    // 인정기준값 자동로드 (BOM + certification_rule 기반)
    let certStandards: Record<string, number> = {};
    if (wo.cert_id) {
      const rules = await pool.query(
        'SELECT rule_type, cert_value, direction FROM certification_rule WHERE cert_id = $1',
        [wo.cert_id]
      );
      for (const r of rules.rows) {
        certStandards[r.rule_type] = parseFloat(r.cert_value);
      }
    }

    return {
      data: {
        wo_id: wo.wo_id,
        wo_number: wo.wo_number,
        process_code: wo.process_code,
        structure_code: wo.structure_code,
        product_group: wo.product_group,
        form_codes: formCodes,
        templates,
        cert_standards: certStandards,
      },
    };
  });

  // POST /api/process-inspections - 중간검사 생성 (C-701 양식 기반)
  app.post('/api/process-inspections', async (request, reply) => {
    const body = request.body as {
      wo_id: number;
      form_code: string;
      inspector?: string;
      structure_lot_id?: number;       // 구조 LOT ID
      serial_range_start?: number;     // 검사 시리얼 범위 시작
      serial_range_end?: number;       // 검사 시리얼 범위 끝
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
      }>;
    };

    if (!body.wo_id || !body.form_code || !body.details) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'wo_id, form_code, details는 필수입니다.',
      });
    }

    // 작업지시 정보 조회
    const woResult = await pool.query(
      `SELECT w.*, lt.lot_id FROM work_order w
       LEFT JOIN lot_transaction lt ON lt.wo_id = w.wo_id
       WHERE w.wo_id = $1`,
      [body.wo_id]
    );
    if (woResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '작업지시를 찾을 수 없습니다.' });
    }
    const wo = woResult.rows[0];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. 검사 헤더 생성 (PROCESS 타입)
      // 구조 LOT가 지정된 경우 해당 lot_id 사용
      const lotId = body.structure_lot_id || wo.lot_id || null;

      // 시리얼 범위 정보를 remarks에 저장
      let remarks: string | null = null;
      if (body.serial_range_start && body.serial_range_end) {
        remarks = `시리얼범위:${String(body.serial_range_start).padStart(3, '0')}~${String(body.serial_range_end).padStart(3, '0')}`;
      }

      const inspResult = await client.query(
        `INSERT INTO inspection
         (insp_type, form_code, wo_id, lot_id, cert_id, sampling_n, accept_c, result, inspector, inspected_at, remarks)
         VALUES ('PROCESS', $1, $2, $3, $4, 3, 0, 'PENDING', $5, NOW(), $6)
         RETURNING *`,
        [body.form_code, body.wo_id, lotId, wo.cert_id || null, body.inspector || null, remarks]
      );
      const insp = inspResult.rows[0];

      // 2. 검사항목별 측정값 입력 + n=3, c=0 자동판정
      let allPass = true;
      let hasApplicable = false;

      for (const d of body.details) {
        let itemResult: string = 'NA';

        if (d.is_applicable !== false) {
          hasApplicable = true;
          const measurements = [d.measured_n1, d.measured_n2, d.measured_n3].filter(
            (v) => v != null
          );

          if (measurements.length > 0 && d.cert_standard != null) {
            // 육안검사 항목: 측정값 1 = OK, 0 = NG
            if (d.check_method === '육안') {
              const allOk = measurements.every((v) => v! >= 1);
              itemResult = allOk ? 'PASS' : 'FAIL';
            } else {
              // 치수/온도/밀도: 모든 측정값이 기준 이상(MIN) 또는 이하(MAX)
              const allMeet = measurements.every((v) => v! >= d.cert_standard!);
              itemResult = allMeet ? 'PASS' : 'FAIL';
            }
            if (itemResult === 'FAIL') allPass = false;
          } else if (measurements.length === 0) {
            // 측정값 미입력 → PENDING 유지
            itemResult = 'NA';
          }
        }

        await client.query(
          `INSERT INTO inspection_detail
           (insp_id, item_no, quality_item, check_item, check_method,
            cert_standard, prod_standard, measured_n1, measured_n2, measured_n3,
            is_applicable, item_result)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            insp.insp_id,
            d.item_no,
            d.quality_item,
            d.check_item,
            d.check_method,
            d.cert_standard ?? null,
            d.prod_standard ?? null,
            d.measured_n1 ?? null,
            d.measured_n2 ?? null,
            d.measured_n3 ?? null,
            d.is_applicable ?? true,
            itemResult,
          ]
        );
      }

      // 3. 전체 판정
      const overallResult = !hasApplicable ? 'NA' : allPass ? 'PASS' : 'FAIL';
      await client.query('UPDATE inspection SET result = $1 WHERE insp_id = $2', [
        overallResult,
        insp.insp_id,
      ]);

      await client.query('COMMIT');

      return {
        data: { ...insp, result: overallResult },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // DELETE /api/process-inspections/:id - 중간검사 삭제
  app.delete('/api/process-inspections/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const inspId = parseInt(id, 10);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM inspection_detail WHERE insp_id = $1', [inspId]);
      const result = await client.query(
        "DELETE FROM inspection WHERE insp_id = $1 AND insp_type = 'PROCESS' RETURNING *",
        [inspId]
      );
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

  // GET /api/process-inspections - 중간검사 목록
  app.get('/api/process-inspections', async (request) => {
    const { wo_id, form_code } = request.query as {
      wo_id?: string;
      form_code?: string;
    };

    let query = `
      SELECT ins.*, w.wo_number, w.process_code, c.structure_code, lt.lot_number,
             lt.base_lot, lt.serial_start, lt.serial_end
      FROM inspection ins
      LEFT JOIN work_order w ON w.wo_id = ins.wo_id
      LEFT JOIN certification_master c ON c.cert_id = ins.cert_id
      LEFT JOIN lot_transaction lt ON lt.lot_id = ins.lot_id
      WHERE ins.insp_type = 'PROCESS'
    `;
    const params: unknown[] = [];

    if (wo_id) {
      params.push(parseInt(wo_id, 10));
      query += ` AND ins.wo_id = $${params.length}`;
    }
    if (form_code) {
      params.push(form_code);
      query += ` AND ins.form_code = $${params.length}`;
    }

    query += ' ORDER BY ins.inspected_at DESC NULLS LAST, ins.insp_id DESC';

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });
}
