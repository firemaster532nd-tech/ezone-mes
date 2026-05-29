import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';
import XLSX from 'xlsx';

// ──────────────────────────────────────────────────────────// 셀 값 정리 헬퍼
const cv = (v: any) => String(v ?? '').replace(/\n/g, ' ').trim();

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
  const R: any[][] = XLSX.utils.sheet_to_json(firstWs, { header: 1, defval: '' });

  // ─────────────────────────────────────────────────
  // 이지원 발주서 고정 레이아웃 기반 파싱
  // ─────────────────────────────────────────────────

  let bizName = '', bizNo = '', bizCeo = '', bizAddress = '', bizContact = '', bizManager = '';
  let orderDate = '', deliveryDate = '';
  let submitter = '', submitterAddress = '';
  let projectName = '', constructionSite = '', siteAddress = '';
  let contractor = '', contractorAddress = '';
  let supervisor = '', supervisorOffice = '', supervisorAddress = '';
  let deliveryAddress = '', consignee = '', specialNotes = '', builderName = '';

  for (let i = 0; i < Math.min(R.length, 30); i++) {
    const r = R[i];
    const c0 = cv(r[0]);
    const c3 = cv(r[3]);
    const c4 = cv(r[4]);
    const c12 = cv(r[12]);
    const c14 = cv(r[14]);
    const c18 = cv(r[18]);

    if (c0.includes('발') && (c0.includes('주 일자') || c0.includes('주일자'))) {
      orderDate = c4 || c3;
    }
    if (c0.includes('납기') || c0.startsWith('납기요청')) {
      deliveryDate = c4 || c3;
      if (c12.includes('담당')) bizManager = c14;
      if (c12.includes('연락') || c18.includes('연락') || c12.includes('담당')) {
        bizContact = cv(r[19]) || cv(r[18]);
      }
    }
    if (c12.includes('사업자')) bizNo = c14;
    if (c12.includes('업체명')) {
      bizName = c14;
      bizCeo = c18;
    }
    if (c12 === '주소') bizAddress = c14;
    if (c12.includes('담당자')) {
      bizManager = bizManager || c14;
      bizContact = bizContact || cv(r[19]) || cv(r[18]);
    }

    if (c0.includes('제출인') || c0.includes('건축주')) {
      if (R[i + 1]) {
        submitter = cv(R[i + 1][3]);
        submitterAddress = cv(R[i + 1][9]);
      }
    }
    if (c0.includes('공사현장') || (c0.includes('공사') && c0.includes('현장'))) {
      if (R[i + 1]) {
        projectName = projectName || cv(R[i + 1][3]);
        constructionSite = constructionSite || cv(R[i + 1][9]);
      }
    }
    if (c0.includes('시공자') || (c0.includes('공사') && c0.includes('시공'))) {
      if (R[i + 1]) {
        contractor = contractor || cv(R[i + 1][9]);
        contractorAddress = contractorAddress || cv(R[i + 1][15]);
      }
    }
    if (c0.includes('감리자') || (c0.includes('공사') && c0.includes('감리'))) {
      if (R[i + 1]) {
        const sv = cv(R[i + 1][3]);
        supervisorOffice = cv(R[i + 1][9]);
        supervisorAddress = cv(R[i + 1][15]);
        supervisor = [sv, supervisorOffice].filter(Boolean).join(' / ');
      }
    }

    if (c0.includes('현  장  명') || c0 === '현  장  명' || (c0.includes('현장명') && !c0.includes('공사'))) {
      projectName = projectName || c3;
      builderName = builderName || cv(r[15]);
    }
    if (c0.includes('납품지 주소') || c0.includes('납품지주소')) {
      deliveryAddress = c3;
      consignee = cv(r[15]);
    }
    if (c0.includes('특기 사항') || c0.includes('특기사항')) {
      specialNotes = c3;
    }
  }

  result.project = {
    project_name:       projectName || '미등록 현장',
    order_date:         orderDate,
    delivery_date:      deliveryDate,
    // 발주처 정보
    biz_name:           bizName,
    biz_no:             bizNo,
    biz_ceo:            bizCeo,
    biz_address:        bizAddress,
    biz_manager:        bizManager,
    biz_contact:        bizContact,
    // 제출인 (건축주)
    submitter,
    submitter_address:  submitterAddress,
    // 공사 정보
    construction_site:  constructionSite,
    contractor:         contractor.replace(/\n.*/s, ''),
    contractor_address: contractorAddress,
    supervisor:         supervisor.replace(/\n/g, ' ').substring(0, 300),
    supervisor_office:  supervisorOffice,
    supervisor_address: supervisorAddress,
    // 납품 정보
    site_address:       deliveryAddress || constructionSite,
    consignee,
    builder_name:       builderName,
    special_notes:      specialNotes.substring(0, 500),
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

  // DB 마이그레이션: 발주서 테이블 생성
  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchase_order (
      po_id              SERIAL PRIMARY KEY,
      project_id         INT REFERENCES project_master(project_id) ON DELETE SET NULL,
      file_name          VARCHAR(500) NOT NULL,
      project_name       VARCHAR(300),
      order_date         VARCHAR(100),
      delivery_date      VARCHAR(100),
      -- 발주처 정보
      biz_name           VARCHAR(300),
      biz_no             VARCHAR(50),
      biz_ceo            VARCHAR(100),
      biz_address        VARCHAR(500),
      biz_manager        VARCHAR(100),
      biz_contact        VARCHAR(100),
      -- 제출인 / 공사 정보
      submitter          VARCHAR(300),
      submitter_address  VARCHAR(500),
      construction_site  VARCHAR(500),
      contractor         VARCHAR(300),
      contractor_address VARCHAR(500),
      supervisor         VARCHAR(500),
      supervisor_office  VARCHAR(300),
      supervisor_address VARCHAR(500),
      -- 납품 정보
      site_address       VARCHAR(500),
      consignee          VARCHAR(200),
      builder_name       VARCHAR(200),
      special_notes      TEXT,
      status             VARCHAR(20) DEFAULT 'ACTIVE',
      uploaded_by        INT,
      created_at         TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  // 기존 테이블 컬럼 추가 (이미 생성된 경우)
  const newCols = [
    ['biz_name',           'VARCHAR(300)'],
    ['biz_no',             'VARCHAR(50)'],
    ['biz_ceo',            'VARCHAR(100)'],
    ['biz_address',        'VARCHAR(500)'],
    ['biz_manager',        'VARCHAR(100)'],
    ['biz_contact',        'VARCHAR(100)'],
    ['submitter_address',  'VARCHAR(500)'],
    ['contractor_address', 'VARCHAR(500)'],
    ['supervisor_office',  'VARCHAR(300)'],
    ['supervisor_address', 'VARCHAR(500)'],
    ['consignee',          'VARCHAR(200)'],
    ['builder_name',       'VARCHAR(200)'],
  ];
  for (const [col, type] of newCols) {
    await pool.query(`ALTER TABLE purchase_order ADD COLUMN IF NOT EXISTS ${col} ${type}`).catch(() => {});
  }

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
  // { file_base64: string, file_name: string }
  app.post('/api/purchase-orders/parse', { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body as any;
    if (!body?.file_base64) {
      return reply.code(400).send({ error: 'no_file', message: '파일 데이터가 없습니다.' });
    }
    try {
      const buffer = Buffer.from(body.file_base64, 'base64');
      const parsed = parsePurchaseOrderExcel(buffer);
      return { data: parsed };
    } catch (err: any) {
      return reply.code(422).send({ error: 'parse_failed', message: `파싱 실패: ${err.message}` });
    }
  });

  // ── POST /api/purchase-orders/upload ── 업로드 + 파싱 + DB 저장
  // { file_base64: string, file_name: string }
  app.post('/api/purchase-orders/upload', { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body as any;
    if (!body?.file_base64) {
      return reply.code(400).send({ error: 'no_file', message: '파일 데이터가 업습니다.' });
    }

    const fileName: string = body.file_name || 'upload.xlsx';
    let buffer: Buffer;
    try {
      buffer = Buffer.from(body.file_base64, 'base64');
    } catch {
      return reply.code(422).send({ error: 'decode_failed', message: 'Base64 디코딩 실패' });
    }

    const user = (req as any).user;

    // 파싱
    let parsed: ReturnType<typeof parsePurchaseOrderExcel>;
    try {
      parsed = parsePurchaseOrderExcel(buffer);
    } catch (err: any) {
      return reply.code(422).send({ error: 'parse_failed', message: `파싱 실패: ${err.message}` });
    }

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
          biz_name, biz_no, biz_ceo, biz_address, biz_manager, biz_contact,
          submitter, submitter_address,
          construction_site, contractor, contractor_address,
          supervisor, supervisor_office, supervisor_address,
          site_address, consignee, builder_name, special_notes,
          uploaded_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING po_id`,
        [
          projectId,
          fileName,
          project.project_name,
          project.order_date        || null,
          project.delivery_date     || null,
          project.biz_name          || null,
          project.biz_no            || null,
          project.biz_ceo           || null,
          project.biz_address       || null,
          project.biz_manager       || null,
          project.biz_contact       || null,
          project.submitter         || null,
          project.submitter_address || null,
          project.construction_site || null,
          project.contractor        || null,
          project.contractor_address|| null,
          project.supervisor        || null,
          project.supervisor_office || null,
          project.supervisor_address|| null,
          project.site_address      || null,
          project.consignee         || null,
          project.builder_name      || null,
          project.special_notes     || null,
          user?.worker_id           || null,
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
