import { FastifyInstance } from 'fastify';
import { pool } from '../index.js';
import { requireAuth } from '../middleware/auth.js';

export async function certifiedReportsRoutes(app: FastifyInstance) {
  // 1. 공인성적서 전체 목록 및 3개월 전 만료 경고 상태 조회
  app.get('/api/certified-reports', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { category, search } = req.query as any;
      let query = `
        SELECT 
          report_id, category, item_name, test_item, test_standard, agency,
          issued_date, expire_date, test_result, min_value, max_value, unit, is_valid, notes,
          (expire_date - CURRENT_DATE) AS days_left,
          CASE 
            WHEN (expire_date - CURRENT_DATE) < 0 THEN 'EXPIRED'
            WHEN (expire_date - CURRENT_DATE) <= 90 THEN 'WARNING_3M'
            ELSE 'VALID'
          END AS alert_status
        FROM certified_test_reports
        WHERE is_valid = TRUE
      `;
      const params: any[] = [];

      if (category) {
        params.push(category);
        query += ` AND category = $${params.length}`;
      }
      if (search) {
        params.push(`%${search}%`);
        query += ` AND (item_name ILIKE $${params.length} OR test_item ILIKE $${params.length} OR agency ILIKE $${params.length})`;
      }

      query += ` ORDER BY expire_date ASC, category ASC`;

      const { rows } = await pool.query(query, params);
      return reply.send({ success: true, data: rows });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 2. 신규 공인성적서 등록 (1년 유효기간 자동 산출)
  app.post('/api/certified-reports', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const {
        category, item_name, test_item, test_standard, agency,
        issued_date, expire_date, test_result, min_value, max_value, unit, notes
      } = req.body as any;

      if (!category || !item_name || !test_item || !agency || !issued_date) {
        return reply.status(400).send({ success: false, error: '필수 항목(분류, 품명, 시험항목, 기관, 발행일)이 누락되었습니다.' });
      }

      // 유효기간 1년 자동 계산 (입력치 없을 시)
      let calcExpire = expire_date;
      if (!calcExpire) {
        const issued = new Date(issued_date);
        issued.setFullYear(issued.getFullYear() + 1);
        calcExpire = issued.toISOString().slice(0, 10);
      }

      const { rows } = await pool.query(`
        INSERT INTO certified_test_reports (
          category, item_name, test_item, test_standard, agency,
          issued_date, expire_date, test_result, min_value, max_value, unit, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        category, item_name, test_item, test_standard || '', agency,
        issued_date, calcExpire, test_result || '', min_value || null, max_value || null, unit || '', notes || ''
      ]);

      return reply.send({ success: true, data: rows[0] });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 3. 공인성적서 수정
  app.put('/api/certified-reports/:id', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { id } = req.params as any;
      const {
        category, item_name, test_item, test_standard, agency,
        issued_date, expire_date, test_result, min_value, max_value, unit, notes, is_valid
      } = req.body as any;

      const { rows } = await pool.query(`
        UPDATE certified_test_reports SET
          category = COALESCE($1, category),
          item_name = COALESCE($2, item_name),
          test_item = COALESCE($3, test_item),
          test_standard = COALESCE($4, test_standard),
          agency = COALESCE($5, agency),
          issued_date = COALESCE($6, issued_date),
          expire_date = COALESCE($7, expire_date),
          test_result = COALESCE($8, test_result),
          min_value = $9,
          max_value = $10,
          unit = COALESCE($11, unit),
          notes = COALESCE($12, notes),
          is_valid = COALESCE($13, is_valid),
          updated_at = CURRENT_TIMESTAMP
        WHERE report_id = $14
        RETURNING *
      `, [
        category, item_name, test_item, test_standard, agency,
        issued_date, expire_date, test_result, min_value, max_value, unit, notes, is_valid, id
      ]);

      if (rows.length === 0) {
        return reply.status(404).send({ success: false, error: '해당 공인성적서를 찾을 수 없습니다.' });
      }

      return reply.send({ success: true, data: rows[0] });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 4. 공인성적서 삭제 (소프트 삭제)
  app.delete('/api/certified-reports/:id', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { id } = req.params as any;
      await pool.query(`UPDATE certified_test_reports SET is_valid = FALSE WHERE report_id = $1`, [id]);
      return reply.send({ success: true, message: '공인성적서가 삭제 처리되었습니다.' });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
}
