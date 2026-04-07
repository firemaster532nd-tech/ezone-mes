import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

/**
 * 공인시험성적서 관리 API
 * - KS 비규격 제품의 공인시험성적서 CRUD
 * - 유효기간 관리 (1년 주기)
 * - 인수검사 시 성적서 유효성 확인용
 */
export async function certDocumentRoutes(app: FastifyInstance) {

  // GET /api/cert-documents - 공인성적서 목록 조회
  app.get('/api/cert-documents', async (request) => {
    const { item_id, is_valid, expired } = request.query as {
      item_id?: string;
      is_valid?: string;
      expired?: string;
    };

    let query = `
      SELECT cd.*, im.item_code, im.item_name, im.ks_type, im.ks_number
      FROM cert_document cd
      LEFT JOIN item_master im ON im.item_id = cd.item_id
    `;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (item_id) {
      params.push(parseInt(item_id, 10));
      conditions.push(`cd.item_id = $${params.length}`);
    }
    if (is_valid === 'true') {
      conditions.push(`cd.is_valid = TRUE`);
    } else if (is_valid === 'false') {
      conditions.push(`cd.is_valid = FALSE`);
    }
    if (expired === 'true') {
      conditions.push(`cd.expiry_date < CURRENT_DATE`);
    } else if (expired === 'false') {
      conditions.push(`cd.expiry_date >= CURRENT_DATE`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY cd.expiry_date DESC, cd.created_at DESC';

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });

  // GET /api/cert-documents/:id - 공인성적서 상세
  app.get('/api/cert-documents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const certDocId = parseInt(id, 10);

    const result = await pool.query(
      `SELECT cd.*, im.item_code, im.item_name, im.ks_type, im.ks_number
       FROM cert_document cd
       LEFT JOIN item_master im ON im.item_id = cd.item_id
       WHERE cd.cert_doc_id = $1`,
      [certDocId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '공인성적서를 찾을 수 없습니다.' });
    }

    // 이 성적서로 진행된 인수검사 이력
    const inspections = await pool.query(
      `SELECT ins.insp_id, ins.result, ins.inspected_at, ins.inspector,
              lt.lot_number, im2.item_name
       FROM inspection ins
       LEFT JOIN lot_transaction lt ON lt.lot_id = ins.lot_id
       LEFT JOIN item_master im2 ON im2.item_id = lt.item_id
       WHERE ins.cert_doc_id = $1
       ORDER BY ins.inspected_at DESC`,
      [certDocId]
    );

    return {
      data: {
        ...result.rows[0],
        linked_inspections: inspections.rows,
      },
    };
  });

  // POST /api/cert-documents - 공인성적서 등록
  app.post('/api/cert-documents', async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    const {
      item_id,
      supplier_name,
      supplier_lot,
      test_institution,
      cert_number,
      issued_date,
      expiry_date,
      test_items,
      test_results,
      remarks,
      file_path,
    } = body as {
      item_id: number;
      supplier_name?: string;
      supplier_lot?: string;
      test_institution: string;
      cert_number?: string;
      issued_date: string;
      expiry_date?: string;
      test_items?: string;
      test_results?: string;
      remarks?: string;
      file_path?: string;
    };

    if (!item_id || !test_institution || !issued_date) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'item_id, test_institution, issued_date는 필수입니다.',
      });
    }

    // 유효기간 미입력 시 발행일+1년으로 자동 설정
    const effectiveExpiry = expiry_date || (() => {
      const d = new Date(issued_date);
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().slice(0, 10);
    })();

    const result = await pool.query(
      `INSERT INTO cert_document
       (item_id, supplier_name, supplier_lot, test_institution, cert_number,
        issued_date, expiry_date, test_items, test_results, is_valid, remarks, file_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10, $11)
       RETURNING *`,
      [
        item_id,
        supplier_name || null,
        supplier_lot || null,
        test_institution,
        cert_number || null,
        issued_date,
        effectiveExpiry,
        test_items || null,
        test_results || null,
        remarks || null,
        file_path || null,
      ]
    );

    return { data: result.rows[0] };
  });

  // PATCH /api/cert-documents/:id - 공인성적서 수정
  app.patch('/api/cert-documents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const certDocId = parseInt(id, 10);

    const allowedFields = [
      'supplier_name', 'supplier_lot', 'test_institution', 'cert_number',
      'issued_date', 'expiry_date', 'test_items', 'test_results',
      'is_valid', 'remarks', 'file_path',
    ];

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(body[key]);
      }
    }

    if (fields.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: '수정할 항목이 없습니다.' });
    }

    values.push(certDocId);
    const result = await pool.query(
      `UPDATE cert_document SET ${fields.join(', ')} WHERE cert_doc_id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found' });
    }
    return { data: result.rows[0] };
  });

  // DELETE /api/cert-documents/:id - 공인성적서 삭제 (소프트 삭제 권장)
  app.delete('/api/cert-documents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const certDocId = parseInt(id, 10);

    // 연결된 인수검사가 있으면 소프트 삭제 (is_valid = FALSE)
    const linkedCount = await pool.query(
      'SELECT COUNT(*) as cnt FROM inspection WHERE cert_doc_id = $1',
      [certDocId]
    );

    if (parseInt(linkedCount.rows[0].cnt) > 0) {
      await pool.query(
        'UPDATE cert_document SET is_valid = FALSE WHERE cert_doc_id = $1',
        [certDocId]
      );
      return { data: { success: true, soft_deleted: true, message: '연결된 검사가 있어 무효화 처리되었습니다.' } };
    }

    const result = await pool.query(
      'DELETE FROM cert_document WHERE cert_doc_id = $1 RETURNING *',
      [certDocId]
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found' });
    }
    return { data: { success: true, soft_deleted: false } };
  });

  // GET /api/cert-documents/expiring-soon - 만료 임박 성적서 조회 (30일 이내)
  app.get('/api/cert-documents/expiring-soon', async (request) => {
    const { days } = request.query as { days?: string };
    const withinDays = parseInt(days || '30', 10);

    const result = await pool.query(
      `SELECT cd.*, im.item_code, im.item_name, im.ks_type
       FROM cert_document cd
       LEFT JOIN item_master im ON im.item_id = cd.item_id
       WHERE cd.is_valid = TRUE
         AND cd.expiry_date >= CURRENT_DATE
         AND cd.expiry_date <= CURRENT_DATE + $1 * INTERVAL '1 day'
       ORDER BY cd.expiry_date ASC`,
      [withinDays]
    );

    return { data: result.rows, total: result.rows.length };
  });

  // GET /api/cert-documents/summary - 품목별 공인성적서 현황 요약 (NON_KS 품목 중심)
  app.get('/api/cert-documents/summary', async () => {
    const result = await pool.query(`
      SELECT im.item_id, im.item_code, im.item_name, im.ks_type, im.ks_number,
             COUNT(cd.cert_doc_id) FILTER (WHERE cd.is_valid = TRUE AND cd.expiry_date >= CURRENT_DATE) AS valid_count,
             COUNT(cd.cert_doc_id) FILTER (WHERE cd.expiry_date < CURRENT_DATE) AS expired_count,
             MAX(cd.expiry_date) FILTER (WHERE cd.is_valid = TRUE) AS latest_expiry,
             MIN(cd.expiry_date) FILTER (WHERE cd.is_valid = TRUE AND cd.expiry_date >= CURRENT_DATE) AS nearest_expiry
      FROM item_master im
      LEFT JOIN cert_document cd ON cd.item_id = im.item_id
      WHERE im.item_category IN ('RM', 'SM')
      GROUP BY im.item_id, im.item_code, im.item_name, im.ks_type, im.ks_number
      ORDER BY im.ks_type DESC, im.item_code
    `);

    return {
      data: result.rows.map(r => ({
        ...r,
        status: r.ks_type === 'KS'
          ? 'KS_OK'
          : (parseInt(r.valid_count) > 0 ? 'CERT_VALID' : 'CERT_MISSING'),
      })),
      total: result.rows.length,
    };
  });
}
