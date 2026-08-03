import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';

async function migrateSalesDelivery() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sales_delivery (
      sl_id          SERIAL PRIMARY KEY,
      sl_number      VARCHAR(30) UNIQUE NOT NULL,
      quotation_id   INT REFERENCES quotation_master(quotation_id) ON DELETE SET NULL,
      po_id          INT REFERENCES purchase_order(po_id) ON DELETE SET NULL,
      customer_id    INT NOT NULL,
      project_code   VARCHAR(100),
      sl_date        DATE NOT NULL,
      delivery_date  DATE,
      tax_type       VARCHAR(20) DEFAULT 'TAX_EXCLUDED',
      total_qty      NUMERIC DEFAULT 0,
      total_supply   NUMERIC DEFAULT 0,
      total_vat      NUMERIC DEFAULT 0,
      total_amount   NUMERIC DEFAULT 0,
      status         VARCHAR(20) DEFAULT 'DRAFT',
      remarks        TEXT,
      created_by     INT,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sales_delivery_item (
      sl_item_id     SERIAL PRIMARY KEY,
      sl_id          INT NOT NULL REFERENCES sales_delivery(sl_id) ON DELETE CASCADE,
      item_code      VARCHAR(50),
      item_name      VARCHAR(200) NOT NULL,
      spec           VARCHAR(200),
      qty            NUMERIC NOT NULL DEFAULT 0,
      unit_price     NUMERIC DEFAULT 0,
      supply_amount  NUMERIC DEFAULT 0,
      vat_amount     NUMERIC DEFAULT 0,
      total_amount   NUMERIC DEFAULT 0,
      remarks        TEXT,
      sort_order     INT DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tax_invoice (
      ti_id          SERIAL PRIMARY KEY,
      ti_number      VARCHAR(30) UNIQUE NOT NULL,
      sl_id          INT REFERENCES sales_delivery(sl_id) ON DELETE SET NULL,
      customer_id    INT NOT NULL,
      issue_date     DATE NOT NULL,
      tax_type       VARCHAR(20) DEFAULT 'TAXABLE',
      invoice_type   VARCHAR(20) DEFAULT 'ELECTRONIC',
      total_supply   NUMERIC DEFAULT 0,
      total_vat      NUMERIC DEFAULT 0,
      total_amount   NUMERIC DEFAULT 0,
      status         VARCHAR(20) DEFAULT 'DRAFT',
      hometax_sent   BOOLEAN DEFAULT FALSE,
      remarks        TEXT,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tax_invoice_item (
      ti_item_id     SERIAL PRIMARY KEY,
      ti_id          INT NOT NULL REFERENCES tax_invoice(ti_id) ON DELETE CASCADE,
      item_name      VARCHAR(200) NOT NULL,
      spec           VARCHAR(200),
      qty            NUMERIC DEFAULT 0,
      unit_price     NUMERIC DEFAULT 0,
      supply_amount  NUMERIC DEFAULT 0,
      vat_amount     NUMERIC DEFAULT 0
    );
  `);
  // 컨럼 추가 (already-exists 안전하게)
  const cols: [string, string][] = [
    ['quotation_id','INT'],['po_id','INT'],['project_code','VARCHAR(100)'],
    ['delivery_date','DATE'],['updated_at','TIMESTAMPTZ DEFAULT NOW()']
  ];
  for (const [col, type] of cols) {
    await pool.query(`ALTER TABLE sales_delivery ADD COLUMN IF NOT EXISTS ${col} ${type}`).catch(()=>{});
  }
}

export async function salesDeliveryRoutes(app: FastifyInstance) {
  await migrateSalesDelivery();

  // 다음 연동직렜 번호 쿼리
  async function nextSlNumber(): Promise<string> {
    const yr = new Date().getFullYear().toString().slice(2);
    const r = await pool.query(
      `SELECT sl_number FROM sales_delivery WHERE sl_number LIKE $1 ORDER BY sl_number DESC LIMIT 1`,
      [`SL-${yr}-%`]
    );
    const last = r.rows[0]?.sl_number;
    const seq = last ? parseInt(last.split('-')[2]) + 1 : 1;
    return \`SL-\${yr}-\${String(seq).padStart(4,'0')}\`;
  }

  async function nextTiNumber(): Promise<string> {
    const yr = new Date().getFullYear().toString().slice(2);
    const r = await pool.query(
      `SELECT ti_number FROM tax_invoice WHERE ti_number LIKE $1 ORDER BY ti_number DESC LIMIT 1`,
      [`EZ-TI-${yr}-%`]
    );
    const last = r.rows[0]?.ti_number;
    const seq = last ? parseInt(last.split('-')[3]) + 1 : 1;
    return \`EZ-TI-\${yr}-\${String(seq).padStart(4,'0')}\`;
  }

  // GET 판매 목록
  app.get('/api/sales-delivery', { preHandler: requireAuth }, async (req) => {
    const { search='', startDate='', endDate='', status='' } = req.query as any;
    let q = \`SELECT s.*, c.company_name FROM sales_delivery s JOIN company_master c ON s.customer_id=c.company_id WHERE 1=1\`;
    const p: any[] = [];
    if (search) { p.push(\`%\${search}%\`); q += \` AND (s.sl_number ILIKE $\${p.length} OR c.company_name ILIKE $\${p.length} OR s.project_code ILIKE $\${p.length})\`; }
    if (startDate) { p.push(startDate); q += \` AND s.sl_date >= $\${p.length}\`; }
    if (endDate) { p.push(endDate); q += \` AND s.sl_date <= $\${p.length}\`; }
    if (status) { p.push(status); q += \` AND s.status = $\${p.length}\`; }
    q += \` ORDER BY s.sl_date DESC, s.sl_id DESC\`;
    const r = await pool.query(q, p);
    return { data: r.rows };
  });

  // GET 판매 현황 (월별 집계)
  app.get('/api/sales-delivery/status', { preHandler: requireAuth }, async (req) => {
    const { year = new Date().getFullYear() } = req.query as any;
    const r = await pool.query(\`
      SELECT
        EXTRACT(MONTH FROM sl_date)::INT AS month,
        COUNT(*)::INT AS cnt,
        SUM(total_supply)::NUMERIC AS supply,
        SUM(total_vat)::NUMERIC AS vat,
        SUM(total_amount)::NUMERIC AS amount
      FROM sales_delivery
      WHERE EXTRACT(YEAR FROM sl_date) = $1
      GROUP BY month ORDER BY month
    \`, [year]);
    const cust = await pool.query(\`
      SELECT c.company_name, COUNT(s.sl_id)::INT AS cnt, SUM(s.total_amount)::NUMERIC AS amount
      FROM sales_delivery s JOIN company_master c ON s.customer_id=c.company_id
      WHERE EXTRACT(YEAR FROM s.sl_date) = $1
      GROUP BY c.company_name ORDER BY amount DESC LIMIT 10
    \`, [year]);
    return { data: { monthly: r.rows, by_customer: cust.rows } };
  });

  // GET 판매 상세
  app.get('/api/sales-delivery/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as any;
    const [sl, items] = await Promise.all([
      pool.query('SELECT s.*, c.company_name, c.company_code, c.ceo_name, c.phone, c.address FROM sales_delivery s JOIN company_master c ON s.customer_id=c.company_id WHERE s.sl_id=$1', [id]),
      pool.query('SELECT * FROM sales_delivery_item WHERE sl_id=$1 ORDER BY sort_order, sl_item_id', [id])
    ]);
    if (!sl.rows[0]) return reply.code(404).send({ error: 'not_found' });
    return { data: { ...sl.rows[0], items: items.rows } };
  });

  // GET 다음 연번
  app.get('/api/sales-delivery/next-number', { preHandler: requireAuth }, async () => {
    return { data: { sl_number: await nextSlNumber() } };
  });

  // POST 판매 등록
  app.post('/api/sales-delivery', { preHandler: requireAuth }, async (req, reply) => {
    const { customer_id, project_code, sl_date, delivery_date, tax_type='TAX_EXCLUDED', remarks, items=[], quotation_id, po_id, created_by } = req.body as any;
    if (!customer_id || !sl_date || !items.length) return reply.code(400).send({ error: '필수값 누락' });
    const sl_number = await nextSlNumber();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const totalSupply = items.reduce((s: number, it: any) => s + (Number(it.supply_amount)||0), 0);
      const totalVat    = items.reduce((s: number, it: any) => s + (Number(it.vat_amount)||0), 0);
      const totalQty    = items.reduce((s: number, it: any) => s + (Number(it.qty)||0), 0);
      const totalAmount = totalSupply + totalVat;
      const slRes = await client.query(
        \`INSERT INTO sales_delivery (sl_number,customer_id,project_code,sl_date,delivery_date,tax_type,remarks,quotation_id,po_id,total_qty,total_supply,total_vat,total_amount,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING sl_id\`,
        [sl_number, customer_id, project_code||null, sl_date, delivery_date||null, tax_type, remarks||null, quotation_id||null, po_id||null, totalQty, totalSupply, totalVat, totalAmount, created_by||null]
      );
      const sl_id = slRes.rows[0].sl_id;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(
          \`INSERT INTO sales_delivery_item (sl_id,item_code,item_name,spec,qty,unit_price,supply_amount,vat_amount,total_amount,remarks,sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)\`,
          [sl_id, it.item_code||null, it.item_name, it.spec||null, it.qty||0, it.unit_price||0, it.supply_amount||0, it.vat_amount||0, (it.supply_amount||0)+(it.vat_amount||0), it.remarks||null, i]
        );
      }
      await client.query('COMMIT');
      return { data: { sl_id, sl_number, message: '판매 등록 완료' } };
    } catch(e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  // PUT 판매 수정
  app.put('/api/sales-delivery/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as any;
    const { customer_id, project_code, sl_date, delivery_date, tax_type, remarks, items=[] } = req.body as any;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const totalSupply = items.reduce((s: number, it: any) => s + (Number(it.supply_amount)||0), 0);
      const totalVat    = items.reduce((s: number, it: any) => s + (Number(it.vat_amount)||0), 0);
      const totalQty    = items.reduce((s: number, it: any) => s + (Number(it.qty)||0), 0);
      await client.query(
        \`UPDATE sales_delivery SET customer_id=$1,project_code=$2,sl_date=$3,delivery_date=$4,tax_type=$5,remarks=$6,total_qty=$7,total_supply=$8,total_vat=$9,total_amount=$10,updated_at=NOW() WHERE sl_id=$11\`,
        [customer_id, project_code||null, sl_date, delivery_date||null, tax_type||'TAX_EXCLUDED', remarks||null, totalQty, totalSupply, totalVat, totalSupply+totalVat, id]
      );
      await client.query('DELETE FROM sales_delivery_item WHERE sl_id=$1', [id]);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(
          \`INSERT INTO sales_delivery_item (sl_id,item_code,item_name,spec,qty,unit_price,supply_amount,vat_amount,total_amount,remarks,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)\`,
          [id, it.item_code||null, it.item_name, it.spec||null, it.qty||0, it.unit_price||0, it.supply_amount||0, it.vat_amount||0, (it.supply_amount||0)+(it.vat_amount||0), it.remarks||null, i]
        );
      }
      await client.query('COMMIT');
      return { data: { success: true } };
    } catch(e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  // DELETE 판매 취소
  app.delete('/api/sales-delivery/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as any;
    await pool.query("UPDATE sales_delivery SET status='CANCELLED' WHERE sl_id=$1", [id]);
    return { data: { success: true } };
  });

  // POST 판매 확정 (DRAFT -> CONFIRMED)
  app.patch('/api/sales-delivery/:id/confirm', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as any;
    await pool.query("UPDATE sales_delivery SET status='CONFIRMED', updated_at=NOW() WHERE sl_id=$1", [id]);
    return { data: { success: true } };
  });

  // POST 세금계산서 생성
  app.post('/api/sales-delivery/:id/tax-invoice', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as any;
    const sl = await pool.query('SELECT * FROM sales_delivery WHERE sl_id=$1', [id]);
    if (!sl.rows[0]) return reply.code(404).send({ error: 'not_found' });
    const existing = await pool.query('SELECT ti_id FROM tax_invoice WHERE sl_id=$1', [id]);
    if (existing.rows[0]) return { data: { ti_id: existing.rows[0].ti_id, message: '이미 세금계산서가 있습니다.' } };
    const ti_number = await nextTiNumber();
    const slData = sl.rows[0];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tiRes = await client.query(
        \`INSERT INTO tax_invoice (ti_number,sl_id,customer_id,issue_date,total_supply,total_vat,total_amount,status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'DRAFT') RETURNING ti_id\`,
        [ti_number, id, slData.customer_id, new Date().toISOString().slice(0,10), slData.total_supply, slData.total_vat, slData.total_amount]
      );
      const ti_id = tiRes.rows[0].ti_id;
      const items = await client.query('SELECT * FROM sales_delivery_item WHERE sl_id=$1', [id]);
      for (const it of items.rows) {
        await client.query(
          'INSERT INTO tax_invoice_item (ti_id,item_name,spec,qty,unit_price,supply_amount,vat_amount) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [ti_id, it.item_name, it.spec, it.qty, it.unit_price, it.supply_amount, it.vat_amount]
        );
      }
      await client.query("UPDATE sales_delivery SET status='INVOICED', updated_at=NOW() WHERE sl_id=$1", [id]);
      await client.query('COMMIT');
      return { data: { ti_id, ti_number, message: '세금계산서 생성 완료' } };
    } catch(e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  // GET 세금계산서 목록
  app.get('/api/tax-invoices', { preHandler: requireAuth }, async (req) => {
    const { year = new Date().getFullYear() } = req.query as any;
    const r = await pool.query(\`
      SELECT t.*, c.company_name, c.company_code, c.ceo_name, c.address
      FROM tax_invoice t JOIN company_master c ON t.customer_id=c.company_id
      WHERE EXTRACT(YEAR FROM t.issue_date)=$1
      ORDER BY t.issue_date DESC, t.ti_id DESC
    \`, [year]);
    return { data: r.rows };
  });

  // GET 세금계산서 상세 (품목 포함)
  app.get('/api/tax-invoices/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as any;
    const [ti, items] = await Promise.all([
      pool.query('SELECT t.*, c.company_name, c.company_code, c.ceo_name, c.phone, c.address, c.business_type, c.business_category FROM tax_invoice t JOIN company_master c ON t.customer_id=c.company_id WHERE t.ti_id=$1', [id]),
      pool.query('SELECT * FROM tax_invoice_item WHERE ti_id=$1 ORDER BY ti_item_id', [id])
    ]);
    if (!ti.rows[0]) return reply.code(404).send({ error: 'not_found' });
    return { data: { ...ti.rows[0], items: items.rows } };
  });
}
