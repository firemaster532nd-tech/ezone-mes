import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';
import XLSX from 'xlsx';
import { expandAndSortSocketItems } from '../lib/socket-sort.js';

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
function buildSocketOrderExcel(soRow: any) {
  const items: any[] = soRow.items_json || [];
  const projectName = soRow.project_name || '현장명';
  const today = new Date().toLocaleDateString('ko-KR');

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

  const templatePath = 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\upload\\소켓발주서양식.xlsx';
  let wb: any;
  try {
    wb = XLSX.readFile(templatePath);
  } catch (err) {
    console.warn('소켓발주서양식.xlsx 템플릿 로드 실패, 기본 동적 생성 진행', err);
  }

  // 헬퍼 함수들 정의
  const getCellAddress = (colIndex: number, rowIndex: number): string => {
    let col = '';
    let temp = colIndex;
    while (temp >= 0) {
      col = String.fromCharCode((temp % 26) + 65) + col;
      temp = Math.floor(temp / 26) - 1;
    }
    return `${col}${rowIndex + 1}`;
  };

  if (wb) {
    // 템플릿 기반 생성 로직
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    const setCell = (addr: string, val: any) => {
      if (!ws[addr]) {
        ws[addr] = {};
      }
      ws[addr].v = val;
      if (typeof val === 'number') ws[addr].t = 'n';
      else if (typeof val === 'boolean') ws[addr].t = 'b';
      else ws[addr].t = 's';
    };

    // 수신처 및 날짜 채우기
    setCell('F3', soRow.biz_name || '선우산업');
    
    // 발주일자는 작성일(오늘 날짜)로 자동 입력
    const dToday = new Date();
    const dateVal = `${dToday.getFullYear()}. ${dToday.getMonth() + 1}. ${dToday.getDate()}`;
    setCell('F5', dateVal);

    // 발주처 상호를 '㈜ 이지원'으로 명시적으로 기입
    setCell('L4', '㈜ 이지원');

    // 소켓 아이템 채우기 (index 10 ~ 36, 즉 Row 11 ~ Row 37)
    const startRow = 10;
    const maxRows = 27;
    const bracketMap = new Map<string, { t: number; bw: number; l: number; qty: number }>();

    for (let i = 0; i < maxRows; i++) {
      const item = items[i];
      const rIdx = startRow + i;
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

        setCell(getCellAddress(0, rIdx), i + 1); // 순번
        setCell(getCellAddress(1, rIdx), item.material || 'GI'); // 재질
        setCell(getCellAddress(2, rIdx), '일반형'); // 품명
        setCell(getCellAddress(3, rIdx), item.structure || ''); // 위치
        setCell(getCellAddress(4, rIdx), code); // 구조명
        setCell(getCellAddress(5, rIdx), sw); // 가로
        setCell(getCellAddress(6, rIdx), h); // 세로
        setCell(getCellAddress(7, rIdx), depth); // 폭
        setCell(getCellAddress(8, rIdx), finalQty); // 발주(수량)
        setCell(getCellAddress(9, rIdx), projectName); // 비고(현장명)

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
        // 남은 행 공백 처리
        for (let c = 0; c < 10; c++) {
          setCell(getCellAddress(c, rIdx), '');
        }
      }
    }

    // 소계 및 총합계 매핑
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

    setCell('H38', vt01Sum);
    setCell('H50', vt049Sum);
    setCell('H52', vt064Sum);
    setCell('H54', va064Sum);
    setCell('I55', grandTotal);

    // 평철 브라켓 매핑 (Row 58 ~ Row 87)
    const bracketRows = [...bracketMap.values()].sort((a, b) => a.bw - b.bw || a.l - b.l);
    const halfLimit = 30;

    for (let i = 0; i < halfLimit; i++) {
      const rIdx = 57 + i;
      const L = bracketRows[i];
      const R = bracketRows[i + halfLimit];

      if (L) {
        setCell(getCellAddress(0, rIdx), 'GI');
        setCell(getCellAddress(1, rIdx), L.t);
        setCell(getCellAddress(2, rIdx), L.bw);
        setCell(getCellAddress(3, rIdx), L.l);
        setCell(getCellAddress(4, rIdx), L.qty);
      } else {
        for (let c = 0; c < 5; c++) setCell(getCellAddress(c, rIdx), '');
      }

      if (R) {
        setCell(getCellAddress(5, rIdx), 'GI');
        setCell(getCellAddress(6, rIdx), R.t);
        setCell(getCellAddress(7, rIdx), R.bw);
        setCell(getCellAddress(8, rIdx), R.l);
        setCell(getCellAddress(9, rIdx), R.qty);
      } else {
        for (let c = 5; c < 10; c++) setCell(getCellAddress(c, rIdx), '');
      }
    }

    const leftBracketTotal = bracketRows.slice(0, halfLimit).reduce((s, r) => s + r.qty, 0);
    const rightBracketTotal = bracketRows.slice(halfLimit).reduce((s, r) => s + r.qty, 0);

    setCell('E88', leftBracketTotal);
    setCell('K88', rightBracketTotal);

    // 납품일자
    if (soRow.delivery_date) {
      const d = new Date(soRow.delivery_date);
      if (!isNaN(d.getTime())) {
        setCell('M92', `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`);
      }
    }

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Fallback: 템플릿이 없을 경우 동적으로 AOA 생성 (기존 방식)
  // ────────────────────────────────────────────────────────────────────────
  const aoa: any[][] = [];
  aoa.push(['발 주 서']);
  aoa.push(['', '', '수 신:', '', '', soRow.biz_name || '', '', '', '', '']);
  aoa.push(['', '', '수 신 자:', '', '', '구매담당자', '', '', '', '']);
  aoa.push(['', '', '발주일자:', '', '', today, '', '', '', '']);
  aoa.push(['', '', '공급자:', '', '', '㈜ 이지원', '', '', '', '']);
  aoa.push(['', '', '주소:', '', '', '경기도 화성시 장안면 수촌리 1028-21', '', '', '', '']);
  aoa.push(['', '', '연락처:', '', '', '070-8870-0300', '', '', '', '']);
  aoa.push(['아래와 같이 발주합니다.']);
  aoa.push(['순번', '재질', '품명', '위치', '구조명', '가로', '세로', '폭', '발주', '비고(현장명)']);
  aoa.push(['', '', '', '', '', '(mm)', '(mm)', '(mm)', '(EA)', '']);

  let seq = 1;
  const bracketMap = new Map<string, { t: number; bw: number; l: number; qty: number }>();

  for (const item of items) {
    const code = (item.product_type || '').trim();
    const w = item.pipe_width_mm || 0;
    const h = item.pipe_height_mm || 0;
    const q = item.qty || 1;
    if (!w || !h || !code) continue;

    const swCalc = STRUCT_WIDTH_CALC[code];
    const sw = swCalc ? swCalc(w) : w;
    const mult = STRUCT_MULT[code] || 1;
    const depth = STRUCT_DEPTH[code] || 200;

    aoa.push([seq++, item.material || 'GI', '일반형', item.structure || '', code, sw, h, depth, q * mult, projectName]);

    const bRows = calcBrackets(code, w, h, q);
    for (const b of bRows) {
      const key = `${b.t}_${b.bw}_${b.l}`;
      const existing = bracketMap.get(key);
      if (existing) existing.qty += b.qty;
      else bracketMap.set(key, { t: b.t, bw: b.bw, l: b.l, qty: b.qty });
    }
  }

  const socketTotal = aoa.slice(10).filter(r => typeof r[0] === 'number').reduce((s, r) => s + (r[8] || 0), 0);
  aoa.push(['총합계', '', '', '', '', '', '', '', socketTotal, '']);

  aoa.push(['']);
  aoa.push(['평철사이즈(일반형)']);
  aoa.push(['두께(T)', '폭(mm)', '길이(mm)', '수량(개)', '', '두께(T)', '폭(mm)', '길이(mm)', '수량(개)', '', '', '', '비고']);

  const bracketRows = [...bracketMap.values()].sort((a, b) => a.bw - b.bw || a.l - b.l);
  const half = Math.ceil(bracketRows.length / 2);
  for (let i = 0; i < half; i++) {
    const L = bracketRows[i];
    const R = bracketRows[i + half];
    aoa.push([
      L?.t || '', L?.bw || '', L?.l || '', L?.qty || '',
      '',
      R?.t || '', R?.bw || '', R?.l || '', R?.qty || '',
      '', '', '',
    ]);
  }
  const bracketTotal = bracketRows.reduce((s, r) => s + r.qty, 0);
  aoa.push(['총합계', '', '', bracketTotal, '', '총합계', '', '', '', '']);

  aoa.push(['']);
  aoa.push(['납품장소', '', '', '', '', '', projectName, '', '', '']);

  const fallbackWb = XLSX.utils.book_new();
  const fallbackWs = XLSX.utils.aoa_to_sheet(aoa);
  fallbackWs['!cols'] = [
    { wch: 6 }, { wch: 6 }, { wch: 10 }, { wch: 8 }, { wch: 10 },
    { wch: 8 }, { wch: 8 }, { wch: 7 }, { wch: 7 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(fallbackWb, fallbackWs, '소켓발주서');
  return XLSX.write(fallbackWb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
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

    const buf = buildSocketOrderExcel(row);

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
