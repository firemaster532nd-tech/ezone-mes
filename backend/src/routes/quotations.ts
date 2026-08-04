import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';

const quotationItemSchema = z.object({
  quotation_item_id: z.number().optional(),
  item_code: z.string().optional().default('ITEM'),
  item_name: z.string().optional().default('품목명'),
  spec: z.string().nullable().optional(),
  qty: z.number().optional().default(1),
  unit_price: z.number().nonnegative().optional().default(0),
  amount: z.number().nonnegative().optional().default(0),
  vat: z.number().nonnegative().optional().default(0),
  summary_note: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
}).passthrough();

const quotationMasterSchema = z.object({
  quotation_number: z.string().min(1),
  quotation_date: z.string(),
  customer_id: z.number().optional().default(0),
  company_name: z.string().optional(),
  project_code: z.string().nullable().optional(),
  manager_name: z.string().nullable().optional(),
  warehouse_id: z.string().nullable().optional(),
  tax_type: z.string().default('TAX_INCLUDED'),
  currency: z.string().default('KRW'),
  price_type: z.string().default('DEFAULT'),
  delivery_date: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
  summary_note: z.string().nullable().optional(),
  items: z.array(quotationItemSchema).default([]),
}).passthrough();

export async function quotationRoutes(app: FastifyInstance) {
  
  // GET /api/quotations - 견적서 목록 조회
  app.get('/api/quotations', { preHandler: requireAuth }, async (req) => {
    const { query } = req as { query: Record<string, string> };
    const search = query.search || '';
    const startDate = query.startDate || '';
    const endDate = query.endDate || '';
    const status = query.status || '';

    let sql = `
      SELECT q.*, 
             COALESCE(c.company_name, q.remarks, '거래처') as company_name, 
             COALESCE(c.company_code, 'BIZ-001') as customer_business_no
      FROM quotation_master q
      LEFT JOIN company_master c ON q.customer_id = c.company_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      sql += ` AND (q.quotation_number LIKE $${paramIndex} OR c.company_name LIKE $${paramIndex} OR q.project_code LIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (startDate) {
      sql += ` AND q.quotation_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      sql += ` AND q.quotation_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (status) {
      sql += ` AND q.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    sql += ` ORDER BY q.quotation_date DESC, q.quotation_id DESC`;

    const { rows } = await pool.query(sql, params);
    return { data: rows, total: rows.length };
  });

  // GET /api/quotations/unordered - 미주문현황 조회
  app.get('/api/quotations/unordered', { preHandler: requireAuth }, async () => {
    const sql = `
      SELECT qi.*, q.quotation_number, q.quotation_date, q.project_code, q.delivery_date, q.status,
             COALESCE(c.company_name, '자유입력 거래처') as company_name
      FROM quotation_item qi
      JOIN quotation_master q ON qi.quotation_id = q.quotation_id
      LEFT JOIN company_master c ON q.customer_id = c.company_id
      WHERE q.status = '진행중'
      ORDER BY q.quotation_date ASC, qi.quotation_item_id ASC
    `;
    const { rows } = await pool.query(sql);
    return { data: rows, total: rows.length };
  });

  // GET /api/quotations/:id - 견적서 상세 정보 조회 (아이템 목록 포함)
  app.get<{ Params: { id: string } }>('/api/quotations/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    
    const masterRes = await pool.query(`
      SELECT q.*, 
             COALESCE(c.company_name, '자유입력 거래처') as company_name, 
             c.company_code as customer_business_no, 
             c.ceo_name as customer_ceo, 
             c.phone as customer_phone, 
             c.address as customer_addr
      FROM quotation_master q
      LEFT JOIN company_master c ON q.customer_id = c.company_id
      WHERE q.quotation_id = $1
    `, [id]);
    
    if (!masterRes.rows[0]) {
      return reply.code(404).send({ error: 'not_found', message: '견적서를 찾을 수 없습니다.' });
    }

    const itemsRes = await pool.query(`
      SELECT * FROM quotation_item
      WHERE quotation_id = $1
      ORDER BY sort_order ASC, quotation_item_id ASC
    `, [id]);

    return { 
      data: {
        ...masterRes.rows[0],
        items: itemsRes.rows
      } 
    };
  });

  // POST /api/quotations - 견적서 신규 등록 (트랜잭션)
  app.post('/api/quotations', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = quotationMasterSchema.safeParse(req.body);
    if (!parsed.success) {
      console.warn('[quotationRoutes POST Error]:', parsed.error.issues);
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }

    const {
      quotation_number, quotation_date, customer_id = 0, project_code, manager_name,
      warehouse_id, tax_type, currency, price_type, delivery_date, remarks, summary_note, items
    } = parsed.data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. 합계 계산
      let totalQty = 0;
      let totalAmount = 0;
      let totalVat = 0;
      for (const item of items) {
        totalQty += Number(item.qty || 0);
        totalAmount += Number(item.amount || 0);
        totalVat += Number(item.vat || 0);
      }

      // 2. 마스터 인서트
      const masterRes = await client.query(`
        INSERT INTO quotation_master (
          quotation_number, quotation_date, customer_id, project_code, manager_name,
          warehouse_id, tax_type, currency, price_type, delivery_date, remarks, summary_note,
          total_qty, total_amount, total_vat, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, '진행중')
        RETURNING *
      `, [
        quotation_number, quotation_date, customer_id || 0, project_code || null, manager_name || null,
        warehouse_id || null, tax_type, currency, price_type, delivery_date || null, remarks || null, summary_note || null,
        totalQty, totalAmount, totalVat
      ]);

      const quotationId = masterRes.rows[0].quotation_id;

      // 3. 아이템 인서트
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const itemCode = item.item_code || `ITEM-${idx + 1}`;
        const itemName = item.item_name || '견적 품목';

        await client.query(`
          INSERT INTO quotation_item (
            quotation_id, item_code, item_name, spec, qty, unit_price, amount, vat, summary_note, remarks, sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          quotationId, itemCode, itemName, item.spec || null, Number(item.qty || 1),
          Number(item.unit_price || 0), Number(item.amount || 0), Number(item.vat || 0),
          item.summary_note || null, item.remarks || null, idx
        ]);
      }

      await client.query('COMMIT');
      return { data: masterRes.rows[0], success: true };
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[POST /api/quotations Error]:', err);
      if (err.code === '23505') {
        return reply.code(409).send({ error: 'duplicate_quotation_number', message: '이미 등록된 견적서 번호입니다.' });
      }
      return reply.code(500).send({ error: 'internal_error', message: err.message || '견적서 저장 오류가 발생했습니다.' });
    } finally {
      client.release();
    }
  });

  // PUT /api/quotations/:id - 견적서 정보 수정 (트랜잭션)
  app.put<{ Params: { id: string } }>('/api/quotations/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const parsed = quotationMasterSchema.safeParse(req.body);
    if (!parsed.success) {
      console.warn('[quotationRoutes PUT Error]:', parsed.error.issues);
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }

    const {
      quotation_number, quotation_date, customer_id = 0, project_code, manager_name,
      warehouse_id, tax_type, currency, price_type, delivery_date, remarks, summary_note, items
    } = parsed.data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. 합계 재계산
      let totalQty = 0;
      let totalAmount = 0;
      let totalVat = 0;
      for (const item of items) {
        totalQty += Number(item.qty || 0);
        totalAmount += Number(item.amount || 0);
        totalVat += Number(item.vat || 0);
      }

      // 2. 마스터 업데이트
      const masterRes = await client.query(`
        UPDATE quotation_master SET
          quotation_number = $1, quotation_date = $2, customer_id = $3, project_code = $4,
          manager_name = $5, warehouse_id = $6, tax_type = $7, currency = $8,
          price_type = $9, delivery_date = $10, remarks = $11, summary_note = $12,
          total_qty = $13, total_amount = $14, total_vat = $15, updated_at = NOW()
        WHERE quotation_id = $16 RETURNING *
      `, [
        quotation_number, quotation_date, customer_id || 0, project_code || null, manager_name || null,
        warehouse_id || null, tax_type, currency, price_type, delivery_date || null, remarks || null, summary_note || null,
        totalQty, totalAmount, totalVat, id
      ]);

      if (!masterRes.rows[0]) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'not_found', message: '견적서를 찾을 수 없습니다.' });
      }

      // 3. 기존 아이템 전체 삭제 후 재등록
      await client.query(`DELETE FROM quotation_item WHERE quotation_id = $1`, [id]);

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const itemCode = item.item_code || `ITEM-${idx + 1}`;
        const itemName = item.item_name || '견적 품목';

        await client.query(`
          INSERT INTO quotation_item (
            quotation_id, item_code, item_name, spec, qty, unit_price, amount, vat, summary_note, remarks, sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          id, itemCode, itemName, item.spec || null, Number(item.qty || 1),
          Number(item.unit_price || 0), Number(item.amount || 0), Number(item.vat || 0),
          item.summary_note || null, item.remarks || null, idx
        ]);
      }

      await client.query('COMMIT');
      return { data: masterRes.rows[0], success: true };
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[PUT /api/quotations/:id Error]:', err);
      if (err.code === '23505') {
        return reply.code(409).send({ error: 'duplicate_quotation_number', message: '이미 등록된 견적서 번호입니다.' });
      }
      return reply.code(500).send({ error: 'internal_error', message: err.message || '견적서 수정 오류가 발생했습니다.' });
    } finally {
      client.release();
    }
  });

  // DELETE /api/quotations/:id - 견적서 취소 처리 (실제 삭제가 아닌 취소 상태 전환)
  app.delete<{ Params: { id: string } }>('/api/quotations/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      `UPDATE quotation_master SET status = '취소' WHERE quotation_id = $1 RETURNING *`,
      [id]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'not_found', message: '견적서를 찾을 수 없습니다.' });
    return { data: rows[0], success: true };
  });

  // POST /api/quotations/:id/convert-order - 견적서 ➔ 수주 자동 주문 전환 API
  app.post<{ Params: { id: string } }>('/api/quotations/:id/convert-order', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 1. 견적서 조회
      const quoteRes = await client.query(`
        SELECT q.*, COALESCE(c.company_name, '자유입력 거래처') as company_name
        FROM quotation_master q
        LEFT JOIN company_master c ON q.customer_id = c.company_id
        WHERE q.quotation_id = $1 AND q.status = '진행중'
      `, [id]);

      if (!quoteRes.rows[0]) {
        await client.query('ROLLBACK');
        return reply.code(400).send({ error: 'invalid_status', message: '주문으로 전환할 수 없는 상태이거나 존재하지 않는 견적서입니다.' });
      }

      const quote = quoteRes.rows[0];

      const quoteItemsRes = await client.query(`
        SELECT * FROM quotation_item WHERE quotation_id = $1 ORDER BY sort_order ASC
      `, [id]);
      const quoteItems = quoteItemsRes.rows;

      // 2. 수주 번호 생성 (SO-YYYYMMDD-SEQ 형식)
      const orderDateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const seqRes = await client.query(
        `SELECT COALESCE(MAX(SUBSTRING(order_number FROM 13 FOR 3)::INTEGER), 0) + 1 as next_seq 
         FROM sales_order WHERE order_number LIKE $1`,
        [`SO-${orderDateStr}-%`]
      );
      const nextSeq = String(seqRes.rows[0].next_seq).padStart(3, '0');
      const orderNumber = `SO-${orderDateStr}-${nextSeq}`;

      // 3. 수주 마스터(sales_order) 등록
      const orderRes = await client.query(`
        INSERT INTO sales_order (
          order_number, order_date, customer_name, project_name, delivery_date, status, total_sets, remarks
        ) VALUES ($1, CURRENT_DATE, $2, $3, $4, 'REGISTERED', $5, $6)
        RETURNING *
      `, [
        orderNumber, quote.company_name, quote.project_code || '견적전환현장', quote.delivery_date,
        quote.total_qty, `견적서(${quote.quotation_number})에서 자동 주문 전환됨. 비고: ${quote.remarks || ''}`
      ]);

      const orderId = orderRes.rows[0].order_id;

      // 4. 수주 상세 품목(sales_order_item) 등록
      for (let i = 0; i < quoteItems.length; i++) {
        const item = quoteItems[i];

        const certRes = await client.query(
          `SELECT cert_id, structure_code FROM certification_master WHERE structure_code = $1 LIMIT 1`,
          [item.item_code.startsWith('FP-') ? item.item_code.replace('FP-', '') : 'VA-064']
        );
        const certId = certRes.rows[0] ? certRes.rows[0].cert_id : 1;
        const structureCode = certRes.rows[0] ? certRes.rows[0].structure_code : 'VA-064';

        let w = 800;
        let h = 600;
        if (item.spec) {
          const match = item.spec.toUpperCase().match(/(\d+)\s*[X*×]\s*(\d+)/);
          if (match) {
            w = parseInt(match[1], 10);
            h = parseInt(match[2], 10);
          }
        }

        await client.query(`
          INSERT INTO sales_order_item (
            order_id, cert_id, structure_code, qty, opening_w_mm, opening_h_mm, penetration_w_mm, penetration_h_mm, spec_note, sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $5, $6, $7, $8)
        `, [
          orderId, certId, structureCode, Math.ceil(item.qty), w, h, `견적 품목명: ${item.item_name}`, i
        ]);
      }

      // 4-2. 판매/매출납품(sales_delivery) 마스터 및 품목 등록 (판매 메뉴와 100% 자동 연동)
      const slNumRes = await client.query(
        `SELECT COALESCE(MAX(SUBSTRING(sl_number FROM 13 FOR 3)::INTEGER), 0) + 1 as next_seq 
         FROM sales_delivery WHERE sl_number LIKE $1`,
        [`SL-${orderDateStr}-%`]
      );
      const slSeq = String(slNumRes.rows[0].next_seq).padStart(3, '0');
      const slNumber = `SL-${orderDateStr}-${slSeq}`;

      const slRes = await client.query(`
        INSERT INTO sales_delivery (
          sl_number, customer_id, project_code, sl_date, delivery_date, tax_type, remarks, quotation_id,
          total_qty, total_supply, total_vat, total_amount, status, created_by
        ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7, $8, $9, $10, $11, 'CONFIRMED', 'SYSTEM')
        RETURNING sl_id
      `, [
        slNumber, quote.customer_id || 1, quote.project_code || '견적전환현장', quote.delivery_date,
        quote.tax_type || 'TAX_EXCLUDED', `견적서(${quote.quotation_number})에서 판매로 자동 전환됨. ${quote.remarks || ''}`,
        quote.quotation_id, quote.total_qty, quote.total_amount, quote.total_vat,
        Number(quote.total_amount) + Number(quote.total_vat)
      ]);
      const slId = slRes.rows[0].sl_id;

      for (let i = 0; i < quoteItems.length; i++) {
        const item = quoteItems[i];
        await client.query(`
          INSERT INTO sales_delivery_item (
            sl_id, item_code, item_name, spec, qty, unit_price, supply_amount, vat_amount, total_amount, remarks, sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          slId, item.item_code, item.item_name, item.spec, item.qty, item.unit_price,
          item.amount, item.vat, Number(item.amount) + Number(item.vat), item.remarks, i
        ]);
      }

      // 5. 견적서 상태 '주문완료'로 업데이트
      await client.query(`
        UPDATE quotation_master SET status = '주문완료' WHERE quotation_id = $1
      `, [id]);

      await client.query('COMMIT');
      return { 
        success: true, 
        message: '견적서가 수주 및 판매/매출납품으로 성공적으로 전환되었습니다.',
        order: orderRes.rows[0],
        sales_delivery_id: slId
      };
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
}
