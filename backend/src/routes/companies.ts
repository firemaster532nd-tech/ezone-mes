import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';

const companySchema = z.object({
  company_code: z.string().min(1).max(50),
  company_name: z.string().min(1).max(200),
  ceo_name: z.string().max(100).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  mobile: z.string().max(50).nullable().optional(),
  fax: z.string().max(50).nullable().optional(),
  email: z.string().max(100).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  business_type: z.string().max(100).nullable().optional(),
  business_item: z.string().max(100).nullable().optional(),
  company_type: z.enum(['CUSTOMER', 'VENDOR', 'BOTH', 'DISTRIBUTOR']).default('CUSTOMER'),
  is_active: z.boolean().default(true),
  remarks: z.string().nullable().optional(),
  
  // 신규 E-Count ERP 거래처정보 연동 필드
  corporate_no: z.string().max(50).nullable().optional(),
  code_type: z.enum(['BUSINESS_NO', 'NON_BUSINESS_DOMESTIC', 'NON_BUSINESS_FOREIGN']).default('BUSINESS_NO'),
  tax_reporting_type: z.enum(['SAME_AS_CODE', 'SEARCH', 'DIRECT']).default('SAME_AS_CODE'),
  tax_reporting_code: z.string().max(50).nullable().optional(),
  sub_biz_no: z.string().max(20).nullable().optional(),
  zipcode1: z.string().max(20).nullable().optional(),
  address1: z.string().max(300).nullable().optional(),
  zipcode2: z.string().max(20).nullable().optional(),
  address2: z.string().max(300).nullable().optional(),
});

export async function companyRoutes(app: FastifyInstance) {
  // GET /api/companies - 거래처 목록 조회
  app.get('/api/companies', { preHandler: requireAuth }, async (req) => {
    const { query } = req as { query: Record<string, string> };
    const search = query.search || '';
    const type = query.type || ''; // CUSTOMER, VENDOR, BOTH, DISTRIBUTOR
    const active = query.active || ''; // true, false

    let sql = `SELECT * FROM company_master WHERE 1=1`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      sql += ` AND (company_code LIKE $${paramIndex} OR company_name LIKE $${paramIndex} OR ceo_name LIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (type) {
      if (type === 'BOTH') {
        sql += ` AND company_type = 'BOTH'`;
      } else {
        sql += ` AND (company_type = $${paramIndex} OR company_type = 'BOTH')`;
        params.push(type);
        paramIndex++;
      }
    }

    if (active) {
      sql += ` AND is_active = $${paramIndex}`;
      params.push(active === 'true');
      paramIndex++;
    }

    sql += ` ORDER BY company_name ASC`;

    const { rows } = await pool.query(sql, params);
    return { data: rows, total: rows.length };
  });

  // GET /api/companies/:id - 특정 거래처 상세 조회
  app.get<{ Params: { id: string } }>('/api/companies/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query(`SELECT * FROM company_master WHERE company_id = $1`, [id]);
    if (!rows[0]) return reply.code(404).send({ error: 'not_found', message: '거래처를 찾을 수 없습니다.' });
    return { data: rows[0] };
  });

  // POST /api/companies - 거래처 신규 등록
  app.post('/api/companies', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = companySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }

    const {
      company_code, company_name, ceo_name, phone, mobile, fax,
      email, address, business_type, business_item, company_type, is_active, remarks,
      corporate_no, code_type, tax_reporting_type, tax_reporting_code, sub_biz_no,
      zipcode1, address1, zipcode2, address2
    } = parsed.data;

    try {
      const { rows } = await pool.query(
        `INSERT INTO company_master (
          company_code, company_name, ceo_name, phone, mobile, fax,
          email, address, business_type, business_item, company_type, is_active, remarks,
          corporate_no, code_type, tax_reporting_type, tax_reporting_code, sub_biz_no,
          zipcode1, address1, zipcode2, address2
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
         RETURNING *`,
        [
          company_code, company_name, ceo_name ?? null, phone ?? null, mobile ?? null, fax ?? null,
          email ?? null, address ?? null, business_type ?? null, business_item ?? null, company_type, is_active, remarks ?? null,
          corporate_no ?? null, code_type, tax_reporting_type, tax_reporting_code ?? null, sub_biz_no ?? null,
          zipcode1 ?? null, address1 ?? null, zipcode2 ?? null, address2 ?? null
        ]
      );
      return { data: rows[0] };
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.code(409).send({ error: 'duplicate_company_code', message: '이미 등록된 사업자등록번호(코드)입니다.' });
      }
      throw err;
    }
  });

  // PUT /api/companies/:id - 거래처 정보 수정
  app.put<{ Params: { id: string } }>('/api/companies/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const parsed = companySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    for (const [k, v] of Object.entries(parsed.data)) {
      fields.push(`${k} = $${i++}`);
      values.push(v);
    }

    if (!fields.length) {
      return reply.code(400).send({ error: 'no_fields', message: '수정할 데이터가 없습니다.' });
    }

    values.push(id);
    try {
      const { rows } = await pool.query(
        `UPDATE company_master SET ${fields.join(', ')} WHERE company_id = $${i} RETURNING *`,
        values
      );
      if (!rows[0]) return reply.code(404).send({ error: 'not_found', message: '거래처를 찾을 수 없습니다.' });
      return { data: rows[0] };
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.code(409).send({ error: 'duplicate_company_code', message: '이미 등록된 사업자등록번호(코드)입니다.' });
      }
      throw err;
    }
  });

  // DELETE /api/companies/:id - 거래처 삭제 (실제 삭제가 아닌 사용중단 처리)
  app.delete<{ Params: { id: string } }>('/api/companies/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      `UPDATE company_master SET is_active = FALSE WHERE company_id = $1 RETURNING *`,
      [id]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'not_found', message: '거래처를 찾을 수 없습니다.' });
    return { data: rows[0], success: true };
  });
}
