import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';
import XLSX from 'xlsx';

// ─────────────────────────────────────────────────────────────────────────────
// DB 마이그레이션: socket_order 테이블
// ─────────────────────────────────────────────────────────────────────────────
async function migrateSocketOrderTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS socket_order (
      so_id        SERIAL PRIMARY KEY,
      po_id        INTEGER REFERENCES purchase_order(po_id) ON DELETE SET NULL,
      project_name TEXT,
      items_json   JSONB NOT NULL DEFAULT '[]',
      status       TEXT DEFAULT 'DRAFT'
                   CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','RETURNED')),
      writer_id    INTEGER REFERENCES worker(worker_id),
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_socket_order_po  ON socket_order(po_id);
    CREATE INDEX IF NOT EXISTS idx_socket_order_status ON socket_order(status);
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// 소켓발주서 브라켓 계산 (자재발주서식.xlsx 수식 기반)
// ─────────────────────────────────────────────────────────────────────────────
function calcBrackets(code: string, w: number, h: number, q: number) {
  const sw = Math.round(w / 2 - 30);
  const rows: { material: string; t: number; bw: number; l: number; qty: number; label: string }[] = [];
  const add = (t: number, bw: number, l: number, qty: number, label: string) => {
    if (qty > 0 && l > 0) rows.push({ material: 'GI', t, bw, l: Math.round(l), qty, label });
  };
  switch (code) {
    case 'VT-049': case 'VT-064': case 'VA-064':
      add(1.6, 60,  w - 1,  q * 4, '상하 브라켓');
      add(1.6, 60,  h - 30, q * 4, '좌우 브라켓');
      break;
    case 'VT-01':
      add(1.6, 60,  Math.round(w / 2 - 16), q * 16, '상하 브라켓');
      add(1.6, 60,  Math.round(h / 2 - 20), q * 32, '좌우 브라켓');
      add(1.6, 225, Math.round(w / 2 - 16), q * 8,  '중앙 받침대');
      add(1.6, 237, h - 1,                  q * 4,  '세로 보강대');
      break;
    case 'VAG-1.69':
      add(1.6, 60,  sw - 1,  q * 4, '상하 브라켓');
      add(1.6, 60,  h - 30,  q * 4, '좌우 브라켓');
      break;
    case 'HTG-064': case 'HTG-064DC':
      add(1.6, 60,  w - 5,  q * 2, '상하 브라켓A');
      add(1.6, 274, w - 5,  q * 2, '상하 브라켓B');
      add(1.6, 60,  h - 35, q * 4, '좌우 브라켓');
      add(1.6, 50,  h,      q * 3, '보강대');
      break;
    case 'HTG-1.69':
      add(1.6, 60,  sw - 5,  q * 4, '상하 브라켓A');
      add(1.6, 274, sw - 5,  q * 4, '상하 브라켓B');
      add(1.6, 60,  h - 35,  q * 4, '좌우 브라켓');
      add(1.6, 50,  h,       q * 6, '보강대');
      break;
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Excel 생성: 소켓발주서 양식 (결재란 없음)
// ─────────────────────────────────────────────────────────────────────────────
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

  const aoa: any[][] = [];

  // 헤더
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

  // 소켓 명세
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

    // 브라켓 집계
    const bRows = calcBrackets(code, w, h, q);
    for (const b of bRows) {
      const key = `${b.t}_${b.bw}_${b.l}`;
      const existing = bracketMap.get(key);
      if (existing) existing.qty += b.qty;
      else bracketMap.set(key, { t: b.t, bw: b.bw, l: b.l, qty: b.qty });
    }
  }

  // 총합계
  const socketTotal = aoa.slice(10).filter(r => typeof r[0] === 'number').reduce((s, r) => s + (r[8] || 0), 0);
  aoa.push(['총합계', '', '', '', '', '', '', '', socketTotal, '']);

  // 평철 섹션
  aoa.push(['']);
  aoa.push(['평철사이즈(일반형)']);
  aoa.push(['두께(T)', '폭(mm)', '길이(mm)', '수량(개)', '', '두께(T)', '폭(mm)', '길이(mm)', '수량(개)', '', '', '비고']);

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

  // 납품 정보
  aoa.push(['']);
  aoa.push(['납품장소', '', '', '', '', '', projectName, '', '', '']);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 6 }, { wch: 6 }, { wch: 10 }, { wch: 8 }, { wch: 10 },
    { wch: 8 }, { wch: 8 }, { wch: 7 }, { wch: 7 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, '소켓발주서');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ─────────────────────────────────────────────────────────────────────────────
// 라우트 등록
// ─────────────────────────────────────────────────────────────────────────────
export async function socketOrderRoutes(app: FastifyInstance) {
  await migrateSocketOrderTable();

  // ── POST /api/socket-orders — 소켓발주서 초안 저장 (또는 갱신)
  app.post('/api/socket-orders', { preHandler: requireAuth }, async (req, reply) => {
    const { po_id, project_name, items_json, writer_id } = req.body as any;
    if (!items_json || !writer_id) return reply.code(400).send({ error: 'items_json, writer_id 필수' });

    // po_id로 기존 DRAFT/RETURNED 있으면 갱신
    if (po_id) {
      const exist = await pool.query(
        `SELECT so_id FROM socket_order WHERE po_id = $1 AND status IN ('DRAFT','RETURNED') LIMIT 1`,
        [po_id]
      );
      if (exist.rows.length > 0) {
        const row = await pool.query(
          `UPDATE socket_order SET items_json=$1, project_name=$2, updated_at=NOW()
           WHERE so_id=$3 RETURNING *`,
          [JSON.stringify(items_json), project_name || '', exist.rows[0].so_id]
        );
        return { data: row.rows[0] };
      }
    }

    const row = await pool.query(
      `INSERT INTO socket_order (po_id, project_name, items_json, status, writer_id)
       VALUES ($1, $2, $3, 'DRAFT', $4) RETURNING *`,
      [po_id || null, project_name || '', JSON.stringify(items_json), writer_id]
    );
    return { data: row.rows[0] };
  });

  // ── GET /api/socket-orders — 목록
  app.get('/api/socket-orders', { preHandler: requireAuth }, async (req) => {
    const { po_id } = req.query as any;
    let q = `SELECT so.*, w.worker_name as writer_name,
               (SELECT approval_id FROM approval WHERE doc_type='SOCKET_ORDER' AND doc_id=so.so_id ORDER BY created_at DESC LIMIT 1) as approval_id
             FROM socket_order so
             LEFT JOIN worker w ON w.worker_id = so.writer_id
             WHERE 1=1`;
    const params: any[] = [];
    if (po_id) { params.push(parseInt(po_id)); q += ` AND so.po_id = $${params.length}`; }
    q += ' ORDER BY so.updated_at DESC';
    const res = await pool.query(q, params);
    return { data: res.rows };
  });

  // ── GET /api/socket-orders/:id — 상세
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
       WHERE so.so_id = $1
       ORDER BY ap.created_at DESC
       LIMIT 1`,
      [id]
    );
    if (!res.rows[0]) return reply.code(404).send({ error: 'not_found' });
    return { data: res.rows[0] };
  });

  // ── PATCH /api/socket-orders/:id — 명세 수정 (DRAFT/RETURNED만 가능)
  app.patch('/api/socket-orders/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const { items_json } = req.body as any;
    const existing = await pool.query('SELECT * FROM socket_order WHERE so_id=$1', [id]);
    if (!existing.rows[0]) return reply.code(404).send({ error: 'not_found' });
    if (!['DRAFT', 'RETURNED'].includes(existing.rows[0].status)) {
      return reply.code(400).send({ error: '결재 중인 서류는 수정 불가합니다.' });
    }
    const row = await pool.query(
      `UPDATE socket_order SET items_json=$1, updated_at=NOW() WHERE so_id=$2 RETURNING *`,
      [JSON.stringify(items_json), id]
    );
    return { data: row.rows[0] };
  });

  // ── POST /api/socket-orders/:id/submit — 결재 제출
  app.post('/api/socket-orders/:id/submit', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const { writer_id, reviewer_id, approver_id } = req.body as any;

    const existing = await pool.query(
      `SELECT so.*, po.project_name as po_project FROM socket_order so
       LEFT JOIN purchase_order po ON po.po_id = so.po_id
       WHERE so.so_id = $1`, [id]
    );
    if (!existing.rows[0]) return reply.code(404).send({ error: 'not_found' });
    const so = existing.rows[0];
    if (!['DRAFT', 'RETURNED'].includes(so.status)) {
      return reply.code(400).send({ error: '이미 결재 중이거나 완료된 서류입니다.' });
    }
    if (!reviewer_id || !approver_id) {
      return reply.code(400).send({ error: '검토자와 승인자를 선택해주세요.' });
    }

    // 기존 결재 삭제 (재제출인 경우)
    await pool.query(`DELETE FROM approval WHERE doc_type='SOCKET_ORDER' AND doc_id=$1`, [id]);

    // approval 생성 (manual reviewer/approver)
    const apRes = await pool.query(
      `INSERT INTO approval (doc_type, doc_id, doc_title, doc_summary, status, writer_id, reviewer_id, approver_id)
       VALUES ('SOCKET_ORDER', $1, $2, $3, 'REVIEW', $4, $5, $6) RETURNING *`,
      [
        id,
        `소켓발주서 - ${so.project_name || so.po_project || ''}`,
        `소켓/평철 발주서 결재 요청`,
        writer_id,
        reviewer_id,
        approver_id,
      ]
    );

    // socket_order 상태 → SUBMITTED
    await pool.query(
      `UPDATE socket_order SET status='SUBMITTED', updated_at=NOW() WHERE so_id=$1`, [id]
    );

    return { data: apRes.rows[0] };
  });

  // ── GET /api/socket-orders/:id/download — Excel 다운로드 (APPROVED만)
  app.get('/api/socket-orders/:id/download', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const res = await pool.query(
      `SELECT so.*, po.biz_name,
              ap.status as approval_status
       FROM socket_order so
       LEFT JOIN purchase_order po ON po.po_id = so.po_id
       LEFT JOIN approval ap ON ap.doc_type='SOCKET_ORDER' AND ap.doc_id=so.so_id
       WHERE so.so_id=$1
       ORDER BY ap.created_at DESC LIMIT 1`,
      [id]
    );
    if (!res.rows[0]) return reply.code(404).send({ error: 'not_found' });
    const row = res.rows[0];

    if (row.approval_status !== 'APPROVED') {
      return reply.code(403).send({ error: '결재 완료 후 다운로드 가능합니다.' });
    }

    const buf = buildSocketOrderExcel(row);
    const safeName = (row.project_name || '소켓발주서').replace(/[<>:"/\\|?*]/g, '_').substring(0, 40);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `소켓발주서_${safeName}_${dateStr}.xlsx`;

    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`)
      .send(buf);
  });
}
