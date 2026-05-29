import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';
import XLSX from 'xlsx';

// ────────────────────────────────────────────────────────────────────────────
// 이지원 발주서 엑셀 파서
// ────────────────────────────────────────────────────────────────────────────
function parsePurchaseOrderExcel(buffer: Buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });

  const result: {
    project: Record<string, string>;
    items: any[];
    sheets: { name: string; items: any[] }[];
    raw_sheets: string[];
  } = {
    project: {},
    items: [],
    sheets: [],
    raw_sheets: wb.SheetNames,
  };

  const firstWs = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(firstWs, { header: 1, defval: '' });

  // ── 프로젝트 헤더 파싱 ──
  let projectName = '', orderDate = '', deliveryDate = '';
  let submitter = '', constructionSite = '', contractor = '', supervisor = '';
  let siteAddress = '', specialNotes = '';

  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i];
    const col0 = String(row[0] || '').trim();
    const col3 = String(row[3] || '').trim();
    const col4 = String(row[4] || '').trim();
    const col9 = String(row[9] || '').trim();
    const col12 = String(row[12] || '').trim();
    const col15 = String(row[15] || '').trim();

    if (col0.includes('발주 일자') || col0.includes('발주일자')) {
      orderDate = col4 || col3;
    }
    if (col0.includes('납기') || col0.includes('기납')) {
      deliveryDate = col4 || col3;
    }
    if (col0.includes('제출인') || col0.includes('건축주')) {
      if (rows[i + 1]) submitter = String(rows[i + 1][3] || '').trim();
    }
    if (col0.includes('공사') && col0.includes('현장')) {
      if (rows[i + 1]) {
        const next = rows[i + 1];
        projectName = projectName || String(next[3] || '').trim();
        constructionSite = constructionSite || String(next[9] || '').trim();
      }
    }
    if ((col0.includes('시공') || (col0.includes('공사') && !constructionSite)) && rows[i + 1]) {
      if (!contractor) contractor = String(rows[i + 1][9] || '').trim().replace(/\n.*/s, '');
    }
    if (col0.includes('감리')) {
      if (rows[i + 1]) {
        const sv = String(rows[i + 1][3] || '').trim().replace(/\n/g, ' ');
        const svc = String(rows[i + 1][9] || '').trim().replace(/\n.*/s, '');
        supervisor = [sv, svc].filter(Boolean).join(' / ');
      }
    }
    if (col0.includes('현장명') || col0.includes('현 장 명')) {
      if (!projectName) projectName = col3 || col4;
    }
    if (col0.includes('납품지') || col0.includes('납품')) {
      if (!siteAddress) siteAddress = col3 || col4;
    }
    if (col0.includes('특기') || col0.includes('요청')) {
      if (!specialNotes) specialNotes = (col3 || col4).replace(/\n/g, ' ');
    }
  }

  // ── 현장명을 현장정보 행에서 재추출 (더 정확) ──
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const col0 = String(rows[i][0] || '').trim();
    if (col0.includes('현장명') || col0 === '현 장 명' || (col0 === '' && String(rows[i][3] || '').includes('공사'))) {
      const candidate = String(rows[i][3] || '').trim();
      if (candidate.includes('공사') || candidate.includes('아파트') || candidate.includes('신축')) {
        if (!projectName) projectName = candidate;
      }
    }
    if (col0 === '' && String(rows[i][3] || '').trim().length > 5) {
      const d3 = String(rows[i][3] || '').trim();
      // 납품지 주소 형태 감지
      if (d3.includes('시') && d3.includes('구') && !siteAddress) {
        // 현장 주소 형태면 skip
      }
    }
  }

  result.project = {
    project_name: projectName || '미등록 현장',
    order_date: orderDate,
    delivery_date: deliveryDate,
    submitter,
    construction_site: constructionSite,
    contractor: contractor.replace(/\n.*/s, ''),
    supervisor: supervisor.replace(/\n/g, ' ').substring(0, 200),
    site_address: siteAddress,
    special_notes: specialNotes.substring(0, 500),
  };

  // ── 시트(동)별 발주 명세 파싱 ──
  wb.SheetNames.forEach(sheetName => {
    const ws = wb.Sheets[sheetName];
    const sheetRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const sheetItems: any[] = [];
    let inMainTable = false;
    let inExtraTable = false;

    for (let i = 0; i < sheetRows.length; i++) {
      const row = sheetRows[i];
      const col0 = String(row[0] || '').trim();
      const col1 = String(row[1] || '').trim();

      // 메인 명세 헤더 (NO + 배관재질/재질)
      if (col0 === 'NO' && (col1.includes('배관') || col1.includes('재질') || col1 === '배관\n재질')) {
        inMainTable = true;
        inExtraTable = false;
        continue;
      }
      // 추가 품목 헤더 (NO + 품목명)
      if (col0 === 'NO' && (col1.includes('품목') || col1.includes('목명'))) {
        inMainTable = false;
        inExtraTable = true;
        continue;
      }
      // 안내/주의사항 구역 → 종료
      if (col0.startsWith('※') || col0.startsWith(' -') || col0.startsWith('  :') || col0 === '※ 주의 사항') {
        inMainTable = false;
        inExtraTable = false;
        continue;
      }

      const noNum = parseInt(col0);
      if (isNaN(noNum)) continue;

      // 메인 명세 (방화소켓)
      if (inMainTable && noNum > 0) {
        const material    = String(row[1] || '').trim();
        const structure   = String(row[3] || '').trim();
        const pipeW       = String(row[5] || '').trim();
        const pipeH       = String(row[7] || '').trim();
        const openingW    = String(row[9] || '').trim();
        const openingH    = String(row[11] || '').trim();
        const qty         = String(row[13] || '').trim();
        const productType = String(row[14] || '').trim();
        const remark      = String(row[15] || '').trim();

        if (material || structure || productType) {
          sheetItems.push({
            seq_no: noNum,
            item_type: 'socket',
            material,
            structure,
            pipe_width_mm:     pipeW ? parseInt(pipeW) : null,
            pipe_height_mm:    pipeH ? parseInt(pipeH) : null,
            opening_width_mm:  openingW ? parseInt(openingW) : null,
            opening_height_mm: openingH ? parseInt(openingH) : null,
            qty: qty ? parseInt(qty) : 1,
            product_type: productType,
            item_name: null,
            spec: null,
            remark,
            sheet_name: sheetName,
          });
        }
      }

      // 추가 품목
      if (inExtraTable && noNum > 0) {
        const itemName    = String(row[1] || '').trim();
        const specVal     = String(row[8] || '').trim();
        const productType = String(row[13] || '').trim();
        const unit        = String(row[15] || '').trim();

        if (itemName) {
          sheetItems.push({
            seq_no: noNum,
            item_type: 'extra',
            material: null,
            structure: null,
            pipe_width_mm: null,
            pipe_height_mm: null,
            opening_width_mm: null,
            opening_height_mm: null,
            qty: 1,
            product_type: productType,
            item_name: itemName,
            spec: specVal,
            remark: unit || null,
            sheet_name: sheetName,
          });
        }
      }
    }

    if (sheetItems.length > 0) {
      result.sheets.push({ name: sheetName, items: sheetItems });
      result.items.push(...sheetItems);
    }
  });

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
export async function purchaseOrderRoutes(app: FastifyInstance) {

  // DB 마이그레이션: 발주서 관련 테이블 자동 생성
  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchase_order (
      po_id          SERIAL PRIMARY KEY,
      project_id     INT REFERENCES project_master(project_id) ON DELETE SET NULL,
      file_name      VARCHAR(500) NOT NULL,
      project_name   VARCHAR(300),
      order_date     VARCHAR(100),
      delivery_date  VARCHAR(100),
      submitter      VARCHAR(300),
      construction_site VARCHAR(500),
      contractor     VARCHAR(300),
      supervisor     VARCHAR(500),
      site_address   VARCHAR(500),
      special_notes  TEXT,
      status         VARCHAR(20) DEFAULT 'ACTIVE',
      uploaded_by    INT,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchase_order_item (
      po_item_id        SERIAL PRIMARY KEY,
      po_id             INT NOT NULL REFERENCES purchase_order(po_id) ON DELETE CASCADE,
      sheet_name        VARCHAR(100),
      seq_no            INT,
      item_type         VARCHAR(20) DEFAULT 'socket',
      material          VARCHAR(50),
      structure         VARCHAR(100),
      pipe_width_mm     INT,
      pipe_height_mm    INT,
      opening_width_mm  INT,
      opening_height_mm INT,
      qty               INT DEFAULT 1,
      product_type      VARCHAR(100),
      item_name         VARCHAR(200),
      spec              VARCHAR(300),
      remark            TEXT,
      linked_item_id    INT REFERENCES item_master(item_id) ON DELETE SET NULL,
      created_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  // ── POST /api/purchase-orders/parse ── 업로드 전 미리보기 (저장 없음)
  app.post('/api/purchase-orders/parse', { preHandler: requireAuth }, async (req, reply) => {
    const data = await (req as any).file();
    if (!data) return reply.code(400).send({ error: 'no_file', message: '파일이 없습니다.' });

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    try {
      const parsed = parsePurchaseOrderExcel(buffer);
      return { data: parsed };
    } catch (err: any) {
      return reply.code(422).send({ error: 'parse_failed', message: `파싱 실패: ${err.message}` });
    }
  });

  // ── POST /api/purchase-orders/upload ── 업로드 + 파싱 + DB 저장
  app.post('/api/purchase-orders/upload', { preHandler: requireAuth }, async (req, reply) => {
    const data = await (req as any).file();
    if (!data) return reply.code(400).send({ error: 'no_file', message: '파일이 없습니다.' });

    const fileName = data.filename;
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    let parsed: ReturnType<typeof parsePurchaseOrderExcel>;
    try {
      parsed = parsePurchaseOrderExcel(buffer);
    } catch (err: any) {
      return reply.code(422).send({ error: 'parse_failed', message: `파싱 실패: ${err.message}` });
    }

    const user = (req as any).user;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { project } = parsed;

      // 프로젝트 자동 생성 or 기존 프로젝트 연결
      let projectId: number | null = null;

      if (project.project_name && project.project_name !== '미등록 현장') {
        // 동일 현장명 프로젝트 검색
        const existProj = await client.query(
          `SELECT project_id FROM project_master WHERE project_name = $1 LIMIT 1`,
          [project.project_name]
        );

        if (existProj.rows.length > 0) {
          projectId = existProj.rows[0].project_id;
        } else {
          // 신규 프로젝트 코드 생성 (PO-YYYYMMDD-NNN)
          const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const countRes = await client.query(
            `SELECT COUNT(*) as cnt FROM project_master WHERE project_code LIKE $1`,
            [`PO-${dateStr}-%`]
          );
          const cnt = parseInt(countRes.rows[0].cnt) + 1;
          const projectCode = `PO-${dateStr}-${String(cnt).padStart(3, '0')}`;

          // 납기일 파싱
          let deliveryDate: string | null = null;
          if (project.delivery_date) {
            const dm = project.delivery_date.match(/(\d{4})[^\d]+(\d{1,2})[^\d]+(\d{1,2})/);
            if (dm) deliveryDate = `${dm[1]}-${dm[2].padStart(2, '0')}-${dm[3].padStart(2, '0')}`;
          }

          const newProj = await client.query(
            `INSERT INTO project_master (
              project_code, project_name, customer_name, order_date, delivery_date, status, remarks
             ) VALUES ($1, $2, $3, CURRENT_DATE, $4, 'ACTIVE', $5) RETURNING project_id`,
            [
              projectCode,
              project.project_name,
              project.submitter || project.contractor || null,
              deliveryDate,
              `시공사: ${project.contractor || '-'} / 감리: ${project.supervisor || '-'}`,
            ]
          );
          projectId = newProj.rows[0].project_id;
        }
      }

      // 발주서 저장
      const poRes = await client.query(
        `INSERT INTO purchase_order (
          project_id, file_name, project_name, order_date, delivery_date,
          submitter, construction_site, contractor, supervisor, site_address, special_notes,
          uploaded_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING po_id`,
        [
          projectId,
          fileName,
          project.project_name,
          project.order_date || null,
          project.delivery_date || null,
          project.submitter || null,
          project.construction_site || null,
          project.contractor || null,
          project.supervisor || null,
          project.site_address || null,
          project.special_notes || null,
          user?.worker_id || null,
        ]
      );
      const poId = poRes.rows[0].po_id;

      // 발주 명세 저장
      for (const item of parsed.items) {
        await client.query(
          `INSERT INTO purchase_order_item (
            po_id, sheet_name, seq_no, item_type, material, structure,
            pipe_width_mm, pipe_height_mm, opening_width_mm, opening_height_mm,
            qty, product_type, item_name, spec, remark
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            poId,
            item.sheet_name,
            item.seq_no,
            item.item_type,
            item.material || null,
            item.structure || null,
            item.pipe_width_mm,
            item.pipe_height_mm,
            item.opening_width_mm,
            item.opening_height_mm,
            item.qty,
            item.product_type || null,
            item.item_name || null,
            item.spec || null,
            item.remark || null,
          ]
        );
      }

      await client.query('COMMIT');

      return {
        data: {
          po_id: poId,
          project_id: projectId,
          project_name: project.project_name,
          item_count: parsed.items.length,
          sheets: parsed.raw_sheets,
        }
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ── GET /api/purchase-orders ── 발주서 목록
  app.get('/api/purchase-orders', { preHandler: requireAuth }, async (req) => {
    const { search } = req.query as { search?: string };
    let q = `
      SELECT po.*, pm.project_code,
        (SELECT COUNT(*) FROM purchase_order_item WHERE po_id = po.po_id) AS item_count
      FROM purchase_order po
      LEFT JOIN project_master pm ON po.project_id = pm.project_id
      WHERE po.status = 'ACTIVE'
    `;
    const params: any[] = [];
    if (search) {
      params.push(`%${search}%`);
      q += ` AND (po.project_name ILIKE $1 OR po.contractor ILIKE $1 OR po.file_name ILIKE $1)`;
    }
    q += ` ORDER BY po.created_at DESC`;
    const { rows } = await pool.query(q, params);
    return { data: rows };
  });

  // ── GET /api/purchase-orders/:id ── 발주서 상세
  app.get<{ Params: { id: string } }>('/api/purchase-orders/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      `SELECT po.*, pm.project_code, pm.status as project_status
       FROM purchase_order po LEFT JOIN project_master pm ON po.project_id = pm.project_id
       WHERE po.po_id = $1`,
      [id]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'not_found' });
    const po = rows[0];

    const items = await pool.query(
      `SELECT * FROM purchase_order_item WHERE po_id = $1 ORDER BY sheet_name, seq_no`,
      [id]
    );
    po.items = items.rows;
    po.sheets = [...new Set(items.rows.map((r: any) => r.sheet_name))];

    return { data: po };
  });

  // ── DELETE /api/purchase-orders/:id ── 발주서 삭제 (soft)
  app.delete<{ Params: { id: string } }>('/api/purchase-orders/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      `UPDATE purchase_order SET status = 'DELETED' WHERE po_id = $1 RETURNING *`,
      [id]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'not_found' });
    return { data: rows[0] };
  });
}
