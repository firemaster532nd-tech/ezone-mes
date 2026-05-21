import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';

// 수식 안전 계산 함수
function evaluateFormula(formula: string | null | undefined, variables: Record<string, number>): number {
  if (!formula) return 0;
  try {
    // 보안을 위해 허용된 문자(영어, 숫자, 사칙연산, 괄호, 소수점, 공백)만 추출
    const safeFormula = formula.replace(/[^a-zA-Z0-9\+\-\*\/\(\)\.\s]/g, '');
    let expression = safeFormula;

    // 변수 바인딩 (대소문자 무시)
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      expression = expression.replace(regex, String(value || 0));
    }

    // 치환되지 않은 영문자들은 안전을 위해 0으로 치환
    expression = expression.replace(/[a-zA-Z]+/g, '0');

    // 수식 실행
    const result = new Function(`return (${expression})`)();
    return typeof result === 'number' && !isNaN(result) ? result : 0;
  } catch (e) {
    console.error('BOM Formula Evaluation Error:', formula, e);
    return 0;
  }
}

const statementItemSchema = z.object({
  item_name: z.string().min(1).max(200),
  spec: z.string().max(100).nullable().optional(),
  unit: z.string().max(10).default('EA'),
  qty: z.number(),
  unit_price: z.number().default(0),
  amount: z.number().default(0),
  vat: z.number().default(0),
  remarks: z.string().max(200).nullable().optional(),
  sort_order: z.number().default(0),
});

const statementSchema = z.object({
  statement_date: z.string().min(1),
  order_id: z.number().nullable().optional(),
  customer_id: z.number(),
  supplier_name: z.string().default('(주)이지원'),
  supplier_ceo: z.string().default('박민선'),
  supplier_no: z.string().default('232-88-00624'),
  supplier_addr: z.string().default('경기도 화성시 장안면 장안로227번길 166-18'),
  supplier_phone: z.string().default('070-8870-0300'),
  total_qty: z.number().default(0),
  total_amount: z.number().default(0),
  total_vat: z.number().default(0),
  remarks: z.string().nullable().optional(),
  items: z.array(statementItemSchema),
});

export async function statementRoutes(app: FastifyInstance) {
  // GET /api/statements - 거래명세서 목록 조회
  app.get('/api/statements', { preHandler: requireAuth }, async (req) => {
    const { query } = req as { query: Record<string, string> };
    const fromDate = query.from || '';
    const toDate = query.to || '';
    const customerId = query.customerId || '';

    let sql = `
      SELECT s.*, c.company_name, c.company_code, c.ceo_name
      FROM transaction_statement s
      JOIN company_master c ON c.company_id = s.customer_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (fromDate) {
      sql += ` AND s.statement_date >= $${paramIndex}`;
      params.push(fromDate);
      paramIndex++;
    }
    if (toDate) {
      sql += ` AND s.statement_date <= $${paramIndex}`;
      params.push(toDate);
      paramIndex++;
    }
    if (customerId) {
      sql += ` AND s.customer_id = $${paramIndex}`;
      params.push(parseInt(customerId, 10));
      paramIndex++;
    }

    sql += ` ORDER BY s.statement_date DESC, s.statement_number DESC`;

    const { rows } = await pool.query(sql, params);
    return { data: rows, total: rows.length };
  });

  // GET /api/statements/:id - 거래명세서 상세 조회 (품목 포함)
  app.get<{ Params: { id: string } }>('/api/statements/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const stmtRes = await pool.query(`
      SELECT s.*, c.company_name, c.company_code, c.ceo_name, c.address AS customer_address, c.phone AS customer_phone
      FROM transaction_statement s
      JOIN company_master c ON c.company_id = s.customer_id
      WHERE s.statement_id = $1
    `, [id]);

    if (!stmtRes.rows[0]) {
      return reply.code(404).send({ error: 'not_found', message: '거래명세서를 찾을 수 없습니다.' });
    }

    const itemsRes = await pool.query(`
      SELECT * FROM transaction_statement_item
      WHERE statement_id = $1
      ORDER BY sort_order, statement_item_id
    `, [id]);

    return {
      data: {
        ...stmtRes.rows[0],
        items: itemsRes.rows,
      },
    };
  });

  // POST /api/statements - 거래명세서 신규 발급 (마스터 + 상세 트랜잭션)
  app.post('/api/statements', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = statementSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const {
        statement_date, order_id, customer_id,
        supplier_name, supplier_ceo, supplier_no, supplier_addr, supplier_phone,
        total_qty, total_amount, total_vat, remarks, items
      } = parsed.data;

      // 1. 명세서 번호 생성 (TX-YYYYMMDD-SEQ)
      const dateStr = statement_date.replace(/-/g, '');
      const seqRes = await client.query(
        `SELECT COUNT(*) as cnt FROM transaction_statement WHERE statement_date = $1`,
        [statement_date]
      );
      const seq = parseInt(seqRes.rows[0].cnt, 10) + 1;
      const statement_number = `TX-${dateStr}-${String(seq).padStart(3, '0')}`;

      // 2. 마스터 INSERT
      const stmtResult = await client.query(
        `INSERT INTO transaction_statement (
          statement_number, statement_date, order_id, customer_id,
          supplier_name, supplier_ceo, supplier_no, supplier_addr, supplier_phone,
          total_qty, total_amount, total_vat, remarks
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        [
          statement_number, statement_date, order_id ?? null, customer_id,
          supplier_name, supplier_ceo, supplier_no, supplier_addr, supplier_phone,
          total_qty, total_amount, total_vat, remarks ?? null
        ]
      );
      const statement = stmtResult.rows[0];

      // 3. 품목 INSERT
      for (const item of items) {
        await client.query(
          `INSERT INTO transaction_statement_item (
            statement_id, item_name, spec, unit, qty, unit_price, amount, vat, remarks, sort_order
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            statement.statement_id, item.item_name, item.spec ?? null, item.unit,
            item.qty, item.unit_price, item.amount, item.vat, item.remarks ?? null, item.sort_order
          ]
        );
      }

      await client.query('COMMIT');
      return { data: statement, success: true };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // DELETE /api/statements/:id - 거래명세서 삭제
  app.delete<{ Params: { id: string } }>('/api/statements/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      `DELETE FROM transaction_statement WHERE statement_id = $1 RETURNING *`,
      [id]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'not_found', message: '거래명세서를 찾을 수 없습니다.' });
    return { data: rows[0], success: true };
  });

  // GET /api/statements/calculate-bom - 수주 정보 기반 인정구조 완제품 + 부자재 소요량 자동 연동 계산 API
  app.get('/api/statements/calculate-bom', { preHandler: requireAuth }, async (req, reply) => {
    const { query } = req as { query: Record<string, string> };
    const orderId = query.orderId ? parseInt(query.orderId, 10) : null;

    if (!orderId) {
      return reply.code(400).send({ error: 'bad_request', message: 'orderId 파라미터가 누락되었습니다.' });
    }

    // 1. 수주 마스터 정보 가져오기
    const orderRes = await pool.query(`
      SELECT * FROM sales_order WHERE order_id = $1
    `, [orderId]);

    if (!orderRes.rows[0]) {
      return reply.code(404).send({ error: 'not_found', message: '수주 정보를 찾을 수 없습니다.' });
    }
    const order = orderRes.rows[0];

    // 수주처(customer_name)와 맵핑되는 거래처 찾기
    const companyRes = await pool.query(`
      SELECT * FROM company_master 
      WHERE company_name LIKE $1 OR company_name = $2
      LIMIT 1
    `, [`%${order.customer_name}%`, order.customer_name]);
    const matchedCompany = companyRes.rows[0] || null;

    // 2. 수주 아이템 및 해당 아이템의 인정구조 상세 가져오기
    const itemsRes = await pool.query(`
      SELECT soi.*, cm.structure_code, cm.structure_name, cm.socket_name, cm.install_position, cm.cert_number
      FROM sales_order_item soi
      JOIN certification_master cm ON cm.cert_id = soi.cert_id
      WHERE soi.order_id = $1
      ORDER BY soi.sort_order, soi.order_item_id
    `, [orderId]);

    const proposedItems: any[] = [];
    let sortOrder = 1;

    // 각 수주 품목별로 루프를 돌며 완제품 항목 등록 및 부자재 소요량 계산
    for (const orderItem of itemsRes.rows) {
      const qty = parseFloat(orderItem.qty || '0');
      const w = orderItem.penetration_w_mm || orderItem.opening_w_mm || 0;
      const h = orderItem.penetration_h_mm || orderItem.opening_h_mm || 0;

      // (1) 완제품 항목 제안 추가
      const specStr = w && h ? `${w}W × ${h}H` : '기본 규격';
      proposedItems.push({
        item_name: `${orderItem.structure_code} (${orderItem.structure_name})`,
        spec: specStr,
        unit: 'EA',
        qty: qty,
        unit_price: 0, // 사용자가 입력하도록 0으로 세팅
        amount: 0,
        vat: 0,
        remarks: `수주 연동: ${orderItem.cert_number || ''}`,
        sort_order: sortOrder++
      });

      // (2) 해당 인정구조의 Level 1 structure_bom 및 Level 2 product_bom 조회하여 부자재 소요량 계산
      const certId = orderItem.cert_id;
      
      // Level 1: structure_bom 중 자재 조달 구분이 PURCHASE(부자재)인 것
      const sBomRes = await pool.query(`
        SELECT sb.*, im.item_name, im.spec AS item_spec, im.unit AS item_unit
        FROM structure_bom sb
        JOIN item_master im ON im.item_id = sb.output_item_id
        WHERE sb.cert_id = $1 AND sb.source_type = 'PURCHASE' AND sb.is_active = true
      `, [certId]);

      for (const sbom of sBomRes.rows) {
        let perUnitQty = parseFloat(sbom.qty_fixed || '0');
        if (sbom.qty_formula) {
          perUnitQty = evaluateFormula(sbom.qty_formula, { W: w, H: h, QTY: 1 });
        }
        const totalSubQty = perUnitQty * qty;

        if (totalSubQty > 0) {
          proposedItems.push({
            item_name: sbom.item_name,
            spec: sbom.item_spec || 'BOM 기본 규격',
            unit: sbom.item_unit || 'EA',
            qty: parseFloat(totalSubQty.toFixed(2)),
            unit_price: 0,
            amount: 0,
            vat: 0,
            remarks: `부자재 (Level 1: ${sbom.group_name})`,
            sort_order: sortOrder++
          });
        }
      }

      // Level 2: product_bom 자재 조달 구분이 PURCHASE인 구성품
      const pBomRes = await pool.query(`
        SELECT pb.*, im.item_name, im.spec AS item_spec, im.unit AS item_unit, sb.group_name
        FROM product_bom pb
        JOIN structure_bom sb ON sb.sbom_id = pb.sbom_id
        JOIN item_master im ON im.item_id = pb.item_id
        WHERE sb.cert_id = $1 AND pb.source_type = 'PURCHASE' AND pb.is_active = true AND sb.is_active = true
      `, [certId]);

      for (const pbom of pBomRes.rows) {
        let perUnitQty = parseFloat(pbom.qty_fixed || '0');
        if (pbom.qty_formula) {
          perUnitQty = evaluateFormula(pbom.qty_formula, { W: w, H: h, QTY: 1 });
        }
        const totalSubQty = perUnitQty * qty;

        if (totalSubQty > 0) {
          proposedItems.push({
            item_name: pbom.item_name,
            spec: pbom.item_spec || pbom.spec_detail || 'BOM 기본 규격',
            unit: pbom.item_unit || pbom.unit || 'EA',
            qty: parseFloat(totalSubQty.toFixed(2)),
            unit_price: 0,
            amount: 0,
            vat: 0,
            remarks: `부자재 (Level 2: ${pbom.group_name} > ${pbom.component_name})`,
            sort_order: sortOrder++
          });
        }
      }
    }

    // 동일한 품목명 + 규격을 가진 부자재가 있을 경우, 이를 하나로 병합하여 최종 전달
    const mergedMap = new Map<string, any>();
    const finalItems: any[] = [];
    let finalSortOrder = 1;

    for (const item of proposedItems) {
      // 수주 원본 완제품은 병합하지 않고 그대로 유지
      if (item.remarks.startsWith('수주 연동')) {
        item.sort_order = finalSortOrder++;
        finalItems.push(item);
        continue;
      }

      const key = `${item.item_name}__${item.spec}__${item.unit}`;
      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key);
        existing.qty = parseFloat((existing.qty + item.qty).toFixed(2));
      } else {
        const copy = { ...item };
        mergedMap.set(key, copy);
      }
    }

    // 병합된 부자재들을 최종 리스트에 추가
    mergedMap.forEach((item) => {
      item.sort_order = finalSortOrder++;
      finalItems.push(item);
    });

    return {
      data: {
        order,
        matched_company: matchedCompany,
        proposed_items: finalItems,
      },
    };
  });
}
