import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';
import XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { expandAndSortSocketItems } from '../lib/socket-sort.js';
import path from 'path';
import { fileURLToPath } from 'url';

// DB migration
async function migrateSocketOrderTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS socket_order (
      so_id        SERIAL PRIMARY KEY,
      po_id        INTEGER REFERENCES purchase_order(po_id) ON DELETE SET NULL,
      project_name TEXT,
      items_json   JSONB NOT NULL DEFAULT '[]',
      status       TEXT DEFAULT 'DRAFT',
      writer_id    INTEGER REFERENCES worker(worker_id),
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_socket_order_po     ON socket_order(po_id);
    CREATE INDEX IF NOT EXISTS idx_socket_order_status ON socket_order(status);
  `);
}

// bracket calculation
function calcBrackets(code: string, w: number, h: number, q: number) {
  const sw = Math.round(w / 2 - 30);
  const rows: { material: string; t: number; bw: number; l: number; qty: number; label: string }[] = [];
  const add = (t: number, bw: number, l: number, qty: number, label: string) => {
    if (qty > 0 && l > 0) rows.push({ material: 'GI', t, bw, l: Math.round(l), qty, label });
  };
  switch (code) {
    case 'VT-049': case 'VT-064': case 'VA-064':
      add(1.6, 60,  w - 1,  q * 4, '\uC0C1\uD558 \uBE0C\uB77C\uCF13');
      add(1.6, 60,  h - 30, q * 4, '\uC88C\uC6B0 \uBE0C\uB77C\uCF13');
      break;
    case 'VT-01':
      add(1.6, 60,  Math.round(w / 2 - 16), q * 16, '\uC0C1\uD558 \uBE0C\uB77C\uCF13');
      add(1.6, 60,  Math.round(h / 2 - 20), q * 32, '\uC88C\uC6B0 \uBE0C\uB77C\uCF13');
      add(1.6, 225, Math.round(w / 2 - 16), q * 8,  '\uC911\uC559 \uBC1B\uCE68\uB300');
      add(1.6, 237, h - 1,                  q * 4,  '\uC138\uB85C \uBCF4\uAC15\uB300');
      break;
    case 'VAG-1.69':
      add(1.6, 60,  sw - 1,  q * 4, '\uC0C1\uD558 \uBE0C\uB77C\uCF13');
      add(1.6, 60,  h - 30,  q * 4, '\uC88C\uC6B0 \uBE0C\uB77C\uCF13');
      break;
    case 'HTG-064': case 'HTG-064DC':
      add(1.6, 60,  w - 5,  q * 2, '\uC0C1\uD558 \uBE0C\uB77C\uCF13A');
      add(1.6, 274, w - 5,  q * 2, '\uC0C1\uD558 \uBE0C\uB77C\uCF13B');
      add(1.6, 60,  h - 35, q * 4, '\uC88C\uC6B0 \uBE0C\uB77C\uCF13');
      add(1.6, 50,  h,      q * 3, '\uBCF4\uAC15\uB300');
      break;
    case 'HTG-1.69':
      add(1.6, 60,  sw - 5,  q * 4, '\uC0C1\uD558 \uBE0C\uB77C\uCF13A');
      add(1.6, 274, sw - 5,  q * 4, '\uC0C1\uD558 \uBE0C\uB77C\uCF13B');
      add(1.6, 60,  h - 35,  q * 4, '\uC88C\uC6B0 \uBE0C\uB77C\uCF13');
      add(1.6, 50,  h,       q * 6, '\uBCF4\uAC15\uB300');
      break;
  }
  return rows;
}

// Excel generation
// Excel generation using ExcelJS to preserve styles and format
async function buildSocketOrderExcel(soRow: any, ourCompany: any = null): Promise<Buffer> {
  const items: any[] = soRow.items_json || [];
  const projectName = soRow.project_name || '현장명';

  const STRUCT_DEPTH: Record<string, number> = {
    'VT-01': 200, 'VT-049': 200, 'VT-064': 200, 'VA-064': 200,
    'VAG-1.69': 200, 'HTG-064': 300, 'HTG-064DC': 300, 'HTG-1.69': 300,
  };
  const STRUCT_MULT: Record<string, number> = {
    'VT-01': 2, 'VAG-1.69': 2, 'HTG-1.69': 2,
  };
  const STRUCT_WIDTH_CALC: Record<string, (w: number) => number> = {
    'VAG-1.69': w => Math.round(w / 2 - 30),
    'HTG-1.69': w => Math.round(w / 2 - 30),
  };

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const templatePath = path.join(__dirname, '..', 'templates', '소켓발주서양식.xlsx');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  const worksheet = workbook.worksheets[0];

  // 1페이지에 맞춤 인쇄 (A4용지 세로 방향, 1page 가로/세로 꽉 차게)
  worksheet.pageSetup = {
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    orientation: 'portrait',
    paperSize: 9, // A4
    margins: {
      left: 0.3, right: 0.3,
      top: 0.3, bottom: 0.3,
      header: 0.1, footer: 0.1
    }
  };

  // 1. 수신처 및 날짜 채우기
  worksheet.getCell('F3').value = soRow.biz_name || '선우산업';
  
  const dToday = new Date();
  const dateVal = `${dToday.getFullYear()}. ${dToday.getMonth() + 1}. ${dToday.getDate()}`;
  worksheet.getCell('F5').value = dateVal;

  // 2. 발주처(공급자) 정보 매핑 (기초정보 DB 연동)
  if (ourCompany) {
    if (ourCompany.corporate_no || ourCompany.company_code) {
      worksheet.getCell('L3').value = ourCompany.corporate_no || ourCompany.company_code;
    }
    if (ourCompany.company_name) {
      worksheet.getCell('L4').value = ourCompany.company_name;
    }
    if (ourCompany.ceo_name) {
      worksheet.getCell('O4').value = ourCompany.ceo_name;
    }
    if (ourCompany.address) {
      worksheet.getCell('L5').value = ourCompany.address;
    }
    if (ourCompany.business_type) {
      worksheet.getCell('L6').value = ourCompany.business_type;
    }
    if (ourCompany.business_item) {
      worksheet.getCell('O6').value = ourCompany.business_item;
    }
    if (ourCompany.phone) {
      worksheet.getCell('L7').value = ourCompany.phone;
    }
    if (ourCompany.fax) {
      worksheet.getCell('O7').value = ourCompany.fax;
    }
    if (ourCompany.email) {
      worksheet.getCell('L8').value = ourCompany.email;
    }
  } else {
    worksheet.getCell('L4').value = '㈜ 이지원';
  }

  // 3. 소켓 아이템 채우기 (Row 11 ~ Row 37)
  const startRow = 11;
  const maxRows = 27;
  const bracketMap = new Map<string, { t: number; bw: number; l: number; qty: number }>();

  for (let i = 0; i < maxRows; i++) {
    const item = items[i];
    const rNum = startRow + i;
    const row = worksheet.getRow(rNum);

    if (item) {
      const code = (item.product_type || '').trim();
      const w = item.pipe_width_mm || 0;
      const h = item.pipe_height_mm || 0;
      const q = item.qty || 1;

      const swCalc = STRUCT_WIDTH_CALC[code];
      const sw = swCalc ? swCalc(w) : w;
      const mult = STRUCT_MULT[code] || 1;
      const depth = STRUCT_DEPTH[code] || 200;
      const finalQty = q * mult;

      row.getCell(1).value = i + 1; // 순번
      row.getCell(2).value = item.material || 'GI'; // 재질
      row.getCell(3).value = '일반형'; // 품명
      row.getCell(4).value = item.structure || ''; // 위치
      row.getCell(5).value = code; // 구조명
      row.getCell(6).value = sw; // 가로
      row.getCell(7).value = h; // 세로
      row.getCell(8).value = depth; // 폭
      row.getCell(9).value = finalQty; // 발주(수량)
      row.getCell(10).value = projectName; // 비고(현장명)

      if (w && h && code) {
        const bRows = calcBrackets(code, w, h, q);
        for (const b of bRows) {
          const key = `${b.t}_${b.bw}_${b.l}`;
          const existing = bracketMap.get(key);
          if (existing) existing.qty += b.qty;
          else bracketMap.set(key, { t: b.t, bw: b.bw, l: b.l, qty: b.qty });
        }
      }
    } else {
      // 빈 행들은 지움
      for (let c = 1; c <= 10; c++) {
        row.getCell(c).value = null;
      }
    }
  }

  // 4. 소계 및 총합계 매핑
  let vt01Sum = 0;
  let vt049Sum = 0;
  let vt064Sum = 0;
  let va064Sum = 0;
  let grandTotal = 0;

  for (const item of items) {
    const code = (item.product_type || '').trim();
    const q = item.qty || 1;
    const mult = STRUCT_MULT[code] || 1;
    const finalQty = q * mult;
    grandTotal += finalQty;

    if (code === 'VT-01') vt01Sum += finalQty;
    else if (code === 'VT-049') vt049Sum += finalQty;
    else if (code === 'VT-064') vt064Sum += finalQty;
    else if (code === 'VA-064') va064Sum += finalQty;
  }

  worksheet.getCell('H38').value = vt01Sum;
  worksheet.getCell('H50').value = vt049Sum;
  worksheet.getCell('H52').value = vt064Sum;
  worksheet.getCell('H54').value = va064Sum;
  worksheet.getCell('I55').value = grandTotal;

  // 5. 평철 브라켓 매핑 (Row 58 ~ Row 87)
  const bracketRows = [...bracketMap.values()].sort((a, b) => a.bw - b.bw || a.l - b.l);
  const startBracketRow = 58;
  const halfLimit = 30;

  for (let i = 0; i < halfLimit; i++) {
    const rNum = startBracketRow + i;
    const row = worksheet.getRow(rNum);
    const L = bracketRows[i];
    const R = bracketRows[i + halfLimit];

    if (L) {
      row.getCell(1).value = 'GI';
      row.getCell(2).value = L.t;
      row.getCell(3).value = L.bw;
      row.getCell(4).value = L.l;
      row.getCell(5).value = L.qty;
    } else {
      for (let c = 1; c <= 5; c++) row.getCell(c).value = null;
    }

    if (R) {
      row.getCell(6).value = 'GI';
      row.getCell(7).value = R.t;
      row.getCell(8).value = R.bw;
      row.getCell(9).value = R.l;
      row.getCell(10).value = R.qty;
    } else {
      for (let c = 6; c <= 10; c++) row.getCell(c).value = null;
    }
  }

  const leftBracketTotal = bracketRows.slice(0, halfLimit).reduce((s, r) => s + r.qty, 0);
  const rightBracketTotal = bracketRows.slice(halfLimit).reduce((s, r) => s + r.qty, 0);

  worksheet.getCell('E88').value = leftBracketTotal;
  worksheet.getCell('K88').value = rightBracketTotal;

  // 6. 납품일자
  if (soRow.delivery_date) {
    const d = new Date(soRow.delivery_date);
    if (!isNaN(d.getTime())) {
      worksheet.getCell('M92').value = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
    }
  }

  const buffer = (await workbook.xlsx.writeBuffer()) as any;
  return buffer;
}


// Routes
export async function socketOrderRoutes(app: FastifyInstance) {
  await migrateSocketOrderTable();
  await pool.query(`ALTER TABLE socket_order ADD COLUMN IF NOT EXISTS vendor_email VARCHAR(200)`);
  await pool.query(`ALTER TABLE socket_order ADD COLUMN IF NOT EXISTS ordered_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE socket_order ADD COLUMN IF NOT EXISTS order_note TEXT`);
  await pool.query(`ALTER TABLE socket_order ADD COLUMN IF NOT EXISTS ordered_by INTEGER`);
  await pool.query(`ALTER TABLE socket_order DROP CONSTRAINT IF EXISTS socket_order_status_check`);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_table_usage
        WHERE table_name='socket_order' AND constraint_name='socket_order_status_check'
      ) THEN
        ALTER TABLE socket_order ADD CONSTRAINT socket_order_status_check
          CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','RETURNED','ORDERED','RECEIVED'));
      END IF;
    END $$
  `);


  // POST /api/socket-orders
  app.post('/api/socket-orders', { preHandler: requireAuth }, async (req, reply) => {
    const { po_id, project_name, items_json, writer_id } = req.body as any;
    if (!items_json || !writer_id) return reply.code(400).send({ error: 'items_json, writer_id 필수' });

    // ── 핵심: qty만큼 1개씩 분리 + 정렬 (인수검사 LOT 부여를 위해)
    const expandedItems = expandAndSortSocketItems(items_json);

    if (po_id) {
      const exist = await pool.query(
        `SELECT so_id FROM socket_order WHERE po_id = $1 AND status IN ('DRAFT','RETURNED') LIMIT 1`,
        [po_id]
      );
      if (exist.rows.length > 0) {
        const row = await pool.query(
          `UPDATE socket_order SET items_json=$1, project_name=$2, updated_at=NOW() WHERE so_id=$3 RETURNING *`,
          [JSON.stringify(expandedItems), project_name || '', exist.rows[0].so_id]
        );
        return { data: row.rows[0] };
      }
    }

    const row = await pool.query(
      `INSERT INTO socket_order (po_id, project_name, items_json, status, writer_id) VALUES ($1, $2, $3, 'DRAFT', $4) RETURNING *`,
      [po_id || null, project_name || '', JSON.stringify(expandedItems), writer_id]
    );
    return { data: row.rows[0] };
  });

  // GET /api/socket-orders
  app.get('/api/socket-orders', { preHandler: requireAuth }, async (req) => {
    const { po_id } = req.query as any;
    let q = `SELECT so.*, w.worker_name as writer_name,
               (SELECT approval_id FROM approval WHERE doc_type='SOCKET_ORDER' AND doc_id=so.so_id ORDER BY created_at DESC LIMIT 1) as approval_id
             FROM socket_order so
             LEFT JOIN worker w ON w.worker_id = so.writer_id WHERE 1=1`;
    const params: any[] = [];
    if (po_id) { params.push(parseInt(po_id)); q += ` AND so.po_id = $${params.length}`; }
    q += ' ORDER BY so.updated_at DESC';
    const res = await pool.query(q, params);
    return { data: res.rows };
  });

  // GET /api/socket-orders/wait — list for APPROVED/ORDERED/RECEIVED
  app.get('/api/socket-orders/wait', { preHandler: requireAuth }, async (req) => {
    const { status } = req.query as any;
    let statusFilter = `so.status IN ('APPROVED','ORDERED','RECEIVED')`;
    if (status === 'APPROVED') statusFilter = `so.status = 'APPROVED'`;
    else if (status === 'ORDERED') statusFilter = `so.status = 'ORDERED'`;
    else if (status === 'RECEIVED') statusFilter = `so.status = 'RECEIVED'`;

    const res = await pool.query(`
      SELECT so.*, w.worker_name as writer_name,
        po.biz_name, po.order_date, pm.project_code,
        ap.approval_id, ap.status as approval_status, ap.approved_at, ap.approve_comment,
        av.worker_name as approver_name,
        jsonb_array_length(so.items_json) as item_count
      FROM socket_order so
      LEFT JOIN worker w ON w.worker_id = so.writer_id
      LEFT JOIN purchase_order po ON po.po_id = so.po_id
      LEFT JOIN project_master pm ON pm.project_id = po.project_id
      LEFT JOIN LATERAL (
        SELECT * FROM approval WHERE doc_type='SOCKET_ORDER' AND doc_id=so.so_id
        ORDER BY created_at DESC LIMIT 1
      ) ap ON true
      LEFT JOIN worker av ON av.worker_id = ap.approver_id
      WHERE ${statusFilter}
      ORDER BY so.updated_at DESC
    `);
    return { data: res.rows };
  });

  // GET /api/socket-orders/:id
  app.get('/api/socket-orders/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const res = await pool.query(
      `SELECT so.*, w.worker_name as writer_name,
              ap.approval_id, ap.status as approval_status,
              ap.reviewer_id, rv.worker_name as reviewer_name,
              ap.approver_id, av.worker_name as approver_name,
              ap.reviewed_at, ap.approved_at, ap.review_comment, ap.approve_comment,
              po.biz_name
       FROM socket_order so
       LEFT JOIN worker w ON w.worker_id = so.writer_id
       LEFT JOIN approval ap ON ap.doc_type = 'SOCKET_ORDER' AND ap.doc_id = so.so_id
       LEFT JOIN worker rv ON rv.worker_id = ap.reviewer_id
       LEFT JOIN worker av ON av.worker_id = ap.approver_id
       LEFT JOIN purchase_order po ON po.po_id = so.po_id
       WHERE so.so_id = $1 ORDER BY ap.created_at DESC LIMIT 1`,
      [id]
    );
    if (!res.rows[0]) return reply.code(404).send({ error: 'not_found' });
    return { data: res.rows[0] };
  });

  // PATCH /api/socket-orders/:id
  app.patch('/api/socket-orders/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const { items_json } = req.body as any;
    const existing = await pool.query('SELECT * FROM socket_order WHERE so_id=$1', [id]);
    if (!existing.rows[0]) return reply.code(404).send({ error: 'not_found' });
    if (!['DRAFT', 'RETURNED'].includes(existing.rows[0].status)) {
      return reply.code(400).send({ error: '\uACB0\uC7AC \uC911\uC778 \uC11C\uB958\uB294 \uC218\uC815 \uBD88\uAC00\uD569\uB2C8\uB2E4.' });
    }
    const row = await pool.query(
      `UPDATE socket_order SET items_json=$1, updated_at=NOW() WHERE so_id=$2 RETURNING *`,
      [JSON.stringify(items_json), id]
    );
    return { data: row.rows[0] };
  });

  // PATCH /api/socket-orders/:id/vendor-email
  app.patch('/api/socket-orders/:id/vendor-email', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const { vendor_email, order_note } = req.body as any;
    const row = await pool.query(
      `UPDATE socket_order SET vendor_email=$1, order_note=$2, updated_at=NOW() WHERE so_id=$3 RETURNING so_id, vendor_email, order_note`,
      [vendor_email || null, order_note || null, id]
    );
    if (!row.rows[0]) return reply.code(404).send({ error: 'not_found' });
    return { data: row.rows[0] };
  });

  // PATCH /api/socket-orders/:id/mark-ordered
  app.patch('/api/socket-orders/:id/mark-ordered', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const { worker_id, order_note } = req.body as any;
    const existing = await pool.query('SELECT status FROM socket_order WHERE so_id=$1', [id]);
    if (!existing.rows[0]) return reply.code(404).send({ error: 'not_found' });
    if (existing.rows[0].status !== 'APPROVED') {
      return reply.code(400).send({ error: '\uC2B9\uC778\uC644\uB8CC \uC0C1\uD0DC\uC5D0\uC11C\uB9CC \uBC1C\uC8FC\uC644\uB8CC \uCC98\uB9AC \uAC00\uB2A5\uD569\uB2C8\uB2E4.' });
    }
    const row = await pool.query(
      `UPDATE socket_order SET status='ORDERED', ordered_at=NOW(), ordered_by=$1,
       order_note=COALESCE($2, order_note), updated_at=NOW() WHERE so_id=$3 RETURNING *`,
      [worker_id || null, order_note || null, id]
    );
    return { data: row.rows[0] };
  });

  // POST /api/socket-orders/:id/submit

  app.post('/api/socket-orders/:id/submit', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const { writer_id, reviewer_id, approver_id } = req.body as any;

    const existing = await pool.query(
      `SELECT so.*, po.project_name as po_project FROM socket_order so
       LEFT JOIN purchase_order po ON po.po_id = so.po_id WHERE so.so_id = $1`, [id]
    );
    if (!existing.rows[0]) return reply.code(404).send({ error: 'not_found' });
    const so = existing.rows[0];
    if (!['DRAFT', 'RETURNED'].includes(so.status)) {
      return reply.code(400).send({ error: '\uC774\uBBF8 \uACB0\uC7AC \uC911\uC774\uAC70\uB098 \uC644\uB8CC\uB41C \uC11C\uB958\uC785\uB2C8\uB2E4.' });
    }
    if (!reviewer_id || !approver_id) {
      return reply.code(400).send({ error: '\uAC80\uD1A0\uC790\uC640 \uC2B9\uC778\uC790\uB97C \uC120\uD0DD\uD574\uC8FC\uC138\uC694.' });
    }

    await pool.query(`DELETE FROM approval WHERE doc_type='SOCKET_ORDER' AND doc_id=$1`, [id]);

    const apRes = await pool.query(
      `INSERT INTO approval (doc_type, doc_id, doc_title, doc_summary, status, writer_id, reviewer_id, approver_id)
       VALUES ('SOCKET_ORDER', $1, $2, $3, 'REVIEW', $4, $5, $6) RETURNING *`,
      [
        id,
        `\uC18C\uCF13\uBC1C\uC8FC\uC11C - ${so.project_name || so.po_project || ''}`,
        `\uC18C\uCF13/\uD3C9\uCCA0 \uBC1C\uC8FC\uC11C \uACB0\uC7AC \uC694\uCCAD`,
        writer_id, reviewer_id, approver_id,
      ]
    );

    await pool.query(`UPDATE socket_order SET status='SUBMITTED', updated_at=NOW() WHERE so_id=$1`, [id]);
    return { data: apRes.rows[0] };
  });

  // GET /api/socket-orders/:id/download
  app.get('/api/socket-orders/:id/download', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const res = await pool.query(
      `SELECT so.*, po.biz_name, po.order_date, po.delivery_date, ap.status as approval_status
       FROM socket_order so
       LEFT JOIN purchase_order po ON po.po_id = so.po_id
       LEFT JOIN approval ap ON ap.doc_type='SOCKET_ORDER' AND ap.doc_id=so.so_id
       WHERE so.so_id=$1 ORDER BY ap.created_at DESC LIMIT 1`,
      [id]
    );
    if (!res.rows[0]) return reply.code(404).send({ error: 'not_found' });
    const row = res.rows[0];

    if (!['APPROVED', 'ORDERED', 'RECEIVED'].includes(row.status)) {
      return reply.code(403).send({ error: '결재 완료 후 다운로드 가능합니다.' });
    }

    // 우리 회사 (이지원) 기초정보 조회
    const ourCompanyRes = await pool.query(
      `SELECT * FROM company_master WHERE company_name LIKE '%이지원%' LIMIT 1`
    );
    const ourCompany = ourCompanyRes.rows[0] || null;

    const buf = await buildSocketOrderExcel(row, ourCompany);

    // 발주처명 + 발주일자 추출
    const bizName = (row.biz_name || '').trim();
    let dateStr = '';
    if (row.order_date) {
      const d = new Date(row.order_date);
      if (!isNaN(d.getTime())) {
        dateStr = d.toISOString().slice(0, 10);
      }
    }
    
    if (!dateStr && row.created_at) {
      const d = new Date(row.created_at);
      if (!isNaN(d.getTime())) {
        dateStr = d.toISOString().slice(0, 10);
      }
    }

    if (!dateStr) {
      dateStr = new Date().toISOString().slice(0, 10);
    }

    const displayName = bizName ? `${bizName}_${dateStr}` : `소켓발주서_${row.project_name || '미지정'}_${dateStr}`;
    const safeName = displayName.replace(/[<>:"/\\|?*]/g, '_').substring(0, 80);
    const fileName = `${safeName}.xlsx`;

    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`)
      .send(buf);
  });
}
