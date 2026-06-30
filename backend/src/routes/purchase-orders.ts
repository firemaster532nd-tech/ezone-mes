import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';
import XLSX from 'xlsx';

// ────────────────────────────────────────────// 셀 값 정리 헬퍼
const cv = (v: any) => String(v ?? '').replace(/\n/g, ' ').trim();

// 엑셀 날짜 파싱 헬퍼: 시리얼 넘버, Date 객체, 문자열 모두 대응
function parseExcelDate(v: any): string {
  if (!v) return '';
  // Date 객체 (cellDates 옵션)
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // 엑셀 시리얼 넘버 (예: 45833)
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const serial = parseFloat(s);
    const d = new Date(Date.UTC(1899, 11, 30 + Math.floor(serial)));
    return d.toISOString().slice(0, 10);
  }
  // "2026-06-29", "2026/06/29", "2026.06.29" 등
  const m = s.match(/(\d{4})[^\d]+(\d{1,2})[^\d]+(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  // "26.6.29" 같은 2자리 년도
  const m2 = s.match(/(\d{2})[^\d]+(\d{1,2})[^\d]+(\d{1,2})/);
  if (m2) return `20${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`;
  return s;
}

// ────────────────────────────────────────────────────────────────────────────
// 이지원 발주서 엑셀 파서
// ────────────────────────────────────────────────────────────────────────────
function parsePurchaseOrderExcel(buffer: Buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });

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
      orderDate = parseExcelDate(r[4]) || parseExcelDate(r[3]) || c4 || c3;
    }
    if (c0.includes('납기') || c0.startsWith('납기요청')) {
      deliveryDate = parseExcelDate(r[4]) || parseExcelDate(r[3]) || c4 || c3;
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
          // 단면/양면 감지: structure 엔 "벽체(단면)" / "벽체(양면)" 패턴
          const constructionType: 'SINGLE' | 'DOUBLE' = structure.includes('단면') ? 'SINGLE' : 'DOUBLE';
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
            construction_type: constructionType,
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
      lot_number        VARCHAR(60),
      linked_item_id    INT REFERENCES item_master(item_id) ON DELETE SET NULL,
      created_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  // lot_number 컬럼 추가 (기존 테이블)
  await pool.query(`ALTER TABLE purchase_order_item ADD COLUMN IF NOT EXISTS lot_number VARCHAR(60)`).catch(() => {});


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
  // { file_base64: string, file_name: string, project_id?: number }
  app.post('/api/purchase-orders/upload', { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body as any;
    if (!body?.file_base64) {
      return reply.code(400).send({ error: 'no_file', message: '파일 데이터가 업습니다.' });
    }

    const fileName: string = body.file_name || 'upload.xlsx';
    // ★ 프론트에서 명시적으로 선택한 프로젝트 ID (없으면 자동 매칭)
    const explicitProjectId: number | null = body.project_id ? parseInt(body.project_id) : null;

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

      // ── 프로젝트 연결 로직 ──────────────────────────────────────────
      let projectId: number | null = null;

      if (explicitProjectId) {
        // ① 프론트에서 명시적으로 선택한 경우: 존재 여부 확인 후 바로 사용
        const chk = await client.query(
          `SELECT project_id FROM project_master WHERE project_id = $1`,
          [explicitProjectId]
        );
        if (chk.rows.length > 0) {
          projectId = explicitProjectId;
        } else {
          await client.query('ROLLBACK');
          return reply.code(400).send({ error: 'project_not_found', message: '선택한 프로젝트를 찾을 수 없습니다.' });
        }
      } else if (project.project_name && project.project_name !== '미등록 현장') {
        // ② 명시적 선택 없음: 현장명 자동 매칭 or 신규 생성
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

          // 납기일 파싱 (엑셀 시리얼 넘버 + 다양한 날짜 포맷 대응)
          let deliveryDate: string | null = null;
          if (project.delivery_date) {
            const parsed = parseExcelDate(project.delivery_date);
            if (parsed && parsed.match(/^\d{4}-\d{2}-\d{2}$/)) deliveryDate = parsed;
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
      // ※ 소켓(item_type='socket')은 qty=1씩 개별 행으로 저장 (LOT 1:1 매핑 원칙)
      for (const item of parsed.items) {
        if (item.item_type === 'socket') {
          // qty만큼 개별 행으로 분리하여 삽입 (각 구조체 = 1개)
          const socketQty = item.qty && item.qty > 0 ? item.qty : 1;
          for (let qi = 0; qi < socketQty; qi++) {
            await client.query(
              `INSERT INTO purchase_order_item (
                po_id, sheet_name, seq_no, item_type, material, structure,
                pipe_width_mm, pipe_height_mm, opening_width_mm, opening_height_mm,
                qty, product_type, item_name, spec, remark, construction_type
               ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,$11,$12,$13,$14,$15)`,
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
                item.product_type || null,
                item.item_name || null,
                item.spec || null,
                item.remark || null,
                (item as any).construction_type || 'DOUBLE',
              ]
            );
          }
        } else {
          // 부자재·추가품목은 qty 그대로 1행
          await client.query(
            `INSERT INTO purchase_order_item (
              po_id, sheet_name, seq_no, item_type, material, structure,
              pipe_width_mm, pipe_height_mm, opening_width_mm, opening_height_mm,
              qty, product_type, item_name, spec, remark, construction_type
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'DOUBLE')`,
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
      }

      // ── 완제품 LOT 자동 부여 ──────────────────────────────────────────────
      // 형식: YYMMDD-구조체명-001 (발주일자 기준, 구조체별 연속 순번)
      // 정렬 우선순위: ① 구조체 종류 → ② 차수(sheet_name) → ③ 가로(W) → ④ 세로(H)

      // 발주일자 → YYMMDD
      let lotDateStr = '';
      if (project.order_date) {
        const dm = project.order_date.match(/(\d{4})[^\d]+(\d{1,2})[^\d]+(\d{1,2})/);
        if (dm) {
          const yy = dm[1].slice(2);
          const mm = dm[2].padStart(2, '0');
          const dd = dm[3].padStart(2, '0');
          lotDateStr = `${yy}${mm}${dd}`;
        }
      }
      if (!lotDateStr) {
        const t = new Date();
        lotDateStr = `${String(t.getFullYear()).slice(2)}${String(t.getMonth()+1).padStart(2,'0')}${String(t.getDate()).padStart(2,'0')}`;
      }

      // 소켓 항목 정렬 조회
      // 우선순위: ① 차수(sheet_name) → ② 구조체 종류 → ③ 가로(W) → ④ 세로(H)
      const socketLotRows = await client.query(`
        SELECT po_item_id, product_type, sheet_name, pipe_width_mm, pipe_height_mm
        FROM purchase_order_item
        WHERE po_id = $1 AND item_type = 'socket' AND product_type IS NOT NULL
        ORDER BY
          -- ① 차수(sheet_name) 오름차순 (최우선)
          COALESCE(sheet_name, '') ASC,
          -- ② 구조체 종류 그룹
          CASE product_type
            WHEN 'VT-049'    THEN 1  WHEN 'VT-064'    THEN 2
            WHEN 'VT-01'     THEN 3  WHEN 'VA-064'    THEN 4
            WHEN 'VAG-1.69'  THEN 5  WHEN 'HTG-064'   THEN 6
            WHEN 'HTG-064DC' THEN 7  WHEN 'HTG-1.69'  THEN 8
            ELSE 9
          END,
          -- ③ 관통재 가로 오름차순
          COALESCE(pipe_width_mm, 0) ASC,
          -- ④ 관통재 세로 오름차순
          COALESCE(pipe_height_mm, 0) ASC
      `, [poId]);

      // 구조체별 연속 순번 카운터 (차수가 달라도 같은 구조체는 번호 이어감)
      const lotCounters: Record<string, number> = {};
      for (const srow of socketLotRows.rows) {
        const pt: string = srow.product_type || 'SOCKET';
        if (!lotCounters[pt]) lotCounters[pt] = 1;
        const seq = String(lotCounters[pt]++).padStart(3, '0');
        const lotNum = `${lotDateStr}-${pt}-${seq}`;
        await client.query(
          'UPDATE purchase_order_item SET lot_number = $1 WHERE po_item_id = $2',
          [lotNum, srow.po_item_id]
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

  // ── GET /api/purchase-orders ── 발주서 목록 (발주서가 없는 프로젝트도 포함)
  app.get('/api/purchase-orders', { preHandler: requireAuth }, async (req) => {
    const { search, project_id, has_socket_inspected } = req.query as { search?: string; project_id?: string; has_socket_inspected?: string };

    const searchParam = search ? `%${search}%` : null;
    const projectIdParam = project_id ? parseInt(project_id) : null;

    // 파라미터 배열 구성
    const params: any[] = [];
    let p = 0; // 파라미터 인덱스

    // ① 발주서가 있는 항목
    const poConditions: string[] = [`po.status = 'ACTIVE'`];
    if (projectIdParam) {
      p++; params.push(projectIdParam);
      poConditions.push(`po.project_id = $${p}`);
    }
    if (searchParam) {
      p++; params.push(searchParam);
      poConditions.push(`(po.project_name ILIKE $${p} OR po.contractor ILIKE $${p} OR po.file_name ILIKE $${p} OR pm.project_name ILIKE $${p})`);
    }
    if (has_socket_inspected === 'true') {
      poConditions.push(`
        EXISTS (
          SELECT 1 
          FROM socket_order so
          JOIN socket_incoming_inspection sii ON sii.so_id = so.so_id
          WHERE so.po_id = po.po_id
            AND (sii.insp_result = 'PASS' OR sii.insp_result_2 = 'PASS')
            AND sii.insp_lot_no IS NOT NULL 
            AND sii.insp_lot_no <> ''
        )
      `);
    }


    const poQuery = `
      SELECT
        po.po_id,
        po.project_id,
        pm.project_code,
        COALESCE(po.project_name, pm.project_name) AS project_name,
        po.file_name,
        po.order_date,
        po.delivery_date,
        po.biz_name, po.biz_no, po.biz_ceo, po.biz_address, po.biz_manager, po.biz_contact,
        po.submitter, po.submitter_address,
        po.construction_site, po.contractor, po.contractor_address,
        po.supervisor, po.supervisor_office, po.supervisor_address,
        po.site_address, po.consignee, po.builder_name, po.special_notes,
        po.status, po.created_at,
        (SELECT COUNT(*) FROM purchase_order_item WHERE po_id = po.po_id)::int AS item_count,
        'PO' AS source_type,
        pm.customer_name,
        pm.remarks AS project_remarks,
        pm.status AS project_status
      FROM purchase_order po
      LEFT JOIN project_master pm ON po.project_id = pm.project_id
      WHERE ${poConditions.join(' AND ')}
    `;

    // ② 발주서가 없는 프로젝트 (project_id 필터 시에는 해당 프로젝트만, 전체 시에는 발주서 없는 전체)
    // ★ project_id 필터가 있으면 PROJECT_ONLY는 표시 안 함 (발주서 선택 목적이므로)
    let combined: string;
    if (projectIdParam) {
      // project_id 지정: 해당 프로젝트의 발주서만
      combined = `(${poQuery}) ORDER BY created_at DESC`;
    } else {
      const projOnlyConditions: string[] = [`pm.status = 'ACTIVE'`];
      if (searchParam) {
        projOnlyConditions.push(`(pm.project_name ILIKE $${p} OR pm.customer_name ILIKE $${p} OR pm.project_code ILIKE $${p})`);
      }
      const projOnlyQuery = `
        SELECT
          NULL::int AS po_id,
          pm.project_id,
          pm.project_code,
          pm.project_name,
          '(발주서 미첨부)' AS file_name,
          pm.order_date::text AS order_date,
          pm.delivery_date::text AS delivery_date,
          NULL AS biz_name, NULL AS biz_no, NULL AS biz_ceo, NULL AS biz_address,
          NULL AS biz_manager, NULL AS biz_contact,
          NULL AS submitter, NULL AS submitter_address,
          NULL AS construction_site,
          pm.customer_name AS contractor, NULL AS contractor_address,
          NULL AS supervisor, NULL AS supervisor_office, NULL AS supervisor_address,
          NULL AS site_address, NULL AS consignee, NULL AS builder_name,
          pm.remarks AS special_notes,
          pm.status,
          pm.created_at,
          0 AS item_count,
          'PROJECT_ONLY' AS source_type,
          pm.customer_name,
          pm.remarks AS project_remarks,
          pm.status AS project_status
        FROM project_master pm
        WHERE ${projOnlyConditions.join(' AND ')}
          AND NOT EXISTS (
            SELECT 1 FROM purchase_order po
            WHERE po.project_id = pm.project_id AND po.status = 'ACTIVE'
          )
      `;
      combined = `(${poQuery}) UNION ALL (${projOnlyQuery}) ORDER BY created_at DESC`;
    }

    try {
      const { rows } = await pool.query(combined, params);
      return { data: rows };
    } catch (err: any) {
      req.log.error({ err, sql: combined.substring(0, 200) }, 'purchase-orders list query failed');
      throw err;
    }
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

  // ── PATCH /api/purchase-orders/items/:po_item_id/construction-type ── 단면/양면 수동 변경
  app.patch<{ Params: { po_item_id: string }; Body: { construction_type: string } }>(
    '/api/purchase-orders/items/:po_item_id/construction-type',
    { preHandler: requireAuth },
    async (req, reply) => {
      const poItemId = parseInt(req.params.po_item_id, 10);
      const { construction_type } = req.body;
      if (!['SINGLE', 'DOUBLE'].includes(construction_type)) {
        return reply.code(400).send({ error: 'construction_type must be SINGLE or DOUBLE' });
      }
      const { rows } = await pool.query(
        `UPDATE purchase_order_item
         SET construction_type = $1
         WHERE po_item_id = $2
         RETURNING po_item_id, product_type, construction_type, lot_number`,
        [construction_type, poItemId]
      );
      if (!rows[0]) return reply.code(404).send({ error: 'not_found' });
      return { data: rows[0] };
    }
  );

  // ── PATCH /api/purchase-orders/:id/sheet-construction-type ── 차수별 일괄 단면/양면 변경
  app.patch<{ Params: { id: string }; Body: { sheet_name: string; construction_type: string } }>(
    '/api/purchase-orders/:id/sheet-construction-type',
    { preHandler: requireAuth },
    async (req, reply) => {
      const poId = parseInt(req.params.id, 10);
      const { sheet_name, construction_type } = req.body;
      if (!['SINGLE', 'DOUBLE'].includes(construction_type)) {
        return reply.code(400).send({ error: 'construction_type must be SINGLE or DOUBLE' });
      }
      const { rowCount } = await pool.query(
        `UPDATE purchase_order_item
         SET construction_type = $1
         WHERE po_id = $2 AND sheet_name = $3 AND item_type = 'socket'`,
        [construction_type, poId, sheet_name]
      );
      return { updated: rowCount, sheet_name, construction_type };
    }
  );

  app.get<{ Params: { id: string } }>(
    '/api/purchase-orders/:id/socket-order',
    { preHandler: requireAuth },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10);

      // PO 정보
      const poRes = await pool.query(
        `SELECT po.*, pm.project_code FROM purchase_order po
         LEFT JOIN project_master pm ON po.project_id = pm.project_id
         WHERE po.po_id = $1 AND po.status = 'ACTIVE'`,
        [id]
      );
      if (!poRes.rows[0]) return reply.code(404).send({ error: 'not_found' });
      const po = poRes.rows[0];

      // 소켓 명세 (product_type이 있는 것만) — 차수→구조체→W→H 순 정렬
      const itemsRes = await pool.query(
        `SELECT * FROM purchase_order_item
         WHERE po_id = $1 AND item_type = 'socket' AND product_type IS NOT NULL
         ORDER BY
           COALESCE(sheet_name, '') ASC,
           CASE product_type
             WHEN 'VT-049'    THEN 1  WHEN 'VT-064'    THEN 2
             WHEN 'VT-01'     THEN 3  WHEN 'VA-064'    THEN 4
             WHEN 'VAG-1.69'  THEN 5  WHEN 'HTG-064'   THEN 6
             WHEN 'HTG-064DC' THEN 7  WHEN 'HTG-1.69'  THEN 8
             ELSE 9
           END,
           COALESCE(pipe_width_mm, 0) ASC,
           COALESCE(pipe_height_mm, 0) ASC`,
        [id]
      );
      const items: any[] = itemsRes.rows;

      // ── 구조체 계산 설정 ──
      type StructCode = 'VT-01' | 'VT-049' | 'VT-064' | 'VA-064' | 'VAG-1.69' | 'HTG-064' | 'HTG-1.69';

      const STRUCT_CONFIG: Record<string, {
        widthCalc: (w: number) => number;
        qtyMult: number;
        depth: number;
        section: StructCode;
        location: string;
      }> = {
        'VT-01':     { widthCalc: w => w,                       qtyMult: 2, depth: 200, section: 'VT-01',   location: '단면' },
        'VT-049':    { widthCalc: w => w,                       qtyMult: 1, depth: 200, section: 'VT-049',  location: '단면' },
        'VT-064':    { widthCalc: w => w,                       qtyMult: 1, depth: 200, section: 'VT-064',  location: '단면' },
        'VA-064':    { widthCalc: w => w,                       qtyMult: 1, depth: 200, section: 'VA-064',  location: '단면' },
        'VAG-1.69':  { widthCalc: w => Math.round(w / 2 - 30), qtyMult: 2, depth: 200, section: 'VAG-1.69', location: '양면' },
        'HTG-064':   { widthCalc: w => w,                       qtyMult: 1, depth: 300, section: 'HTG-064', location: '입상' },
        'HTG-064DC': { widthCalc: w => w,                       qtyMult: 1, depth: 300, section: 'HTG-064', location: '입상' },
        'HTG-1.69':  { widthCalc: w => Math.round(w / 2 - 30), qtyMult: 2, depth: 300, section: 'HTG-1.69', location: '입상' },
      };

      interface SockRow {
        material: string; productName: string; location: string;
        structure: string; width: number; height: number; depth: number;
        qty: number; remark: string;
      }

      const sections: Record<StructCode, SockRow[]> = {
        'VT-01': [], 'VT-049': [], 'VT-064': [], 'VA-064': [],
        'VAG-1.69': [], 'HTG-064': [], 'HTG-1.69': [],
      };

      // 동일 구조+규격 그룹핑 (중복 합산)
      const grouped = new Map<string, { config: typeof STRUCT_CONFIG[string]; w: number; h: number; qty: number; item: any }>();
      for (const item of items) {
        const code = (item.product_type || '').trim();
        const cfg = STRUCT_CONFIG[code];
        if (!cfg) continue;
        const w = item.pipe_width_mm || 0;
        const h = item.pipe_height_mm || 0;
        if (!w || !h) continue;
        const key = `${cfg.section}|${cfg.widthCalc(w)}|${h}|${cfg.depth}`;
        const existing = grouped.get(key);
        if (existing) {
          existing.qty += (item.qty || 1) * cfg.qtyMult;
        } else {
          grouped.set(key, { config: cfg, w: cfg.widthCalc(w), h, qty: (item.qty || 1) * cfg.qtyMult, item });
        }
      }

      for (const [, g] of grouped) {
        const cfg = g.config;
        sections[cfg.section].push({
          material: g.item.material || 'GI',
          productName: '일반형',
          location: g.item.structure || cfg.location,
          structure: (g.item.product_type || '').trim(),
          width: g.w,
          height: g.h,
          depth: cfg.depth,
          qty: g.qty,
          remark: po.project_name || '',
        });
      }

      // ── Excel 생성 ──
      const wb = XLSX.utils.book_new();
      const aoa: any[][] = [];

      const today = new Date().toLocaleDateString('ko-KR');
      const pjName = po.project_name || '현장명';
      const bizName = po.biz_name || '';

      // 헤더 (행1~10)
      aoa.push(['발 주 서', '', '', '', '', '', '', '', '', '']);                            // 1
      aoa.push(['', '', '수 신:', '', '', bizName, '', '', '', '']);                         // 2
      aoa.push(['', '', '수 신 자:', '', '', '구매담당자', '', '', '', '']);                 // 3
      aoa.push(['', '', '발주일자:', '', '', today, '', '', '', '']);                        // 4
      aoa.push(['', '', '공급자:', '', '', '㈜ 이지원', '', '', '', '']);                    // 5
      aoa.push(['', '', '주소:', '', '', '경기도 화성시 장안면 수촌리', '', '', '', '']);    // 6
      aoa.push(['', '', '연락처:', '', '', '070-8870-0300', '', '', '', '']);                // 7
      aoa.push(['아래와 같이 발주합니다.', '', '', '', '', '', '', '', '', '']);             // 8
      aoa.push(['순번', '재질', '품명', '위치', '구조명', '가로', '세로', '폭', '발주', '비고(현장명)']); // 9
      aoa.push(['', '', '', '', '', '(mm)', '(mm)', '(mm)', '(EA)', '']);                   // 10

      // 헬퍼: 빈 행 추가
      const emptyRow = (seq: number) => [seq, 'GI', '일반형', '', '', '', '', '', '', ''];

      let seq = 1;

      // ── VT-01 섹션 (27슬롯) ──
      const vt01 = sections['VT-01'];
      for (let i = 0; i < 27; i++) {
        if (i < vt01.length) {
          const r = vt01[i];
          aoa.push([seq++, r.material, r.productName, r.location, r.structure, r.width, r.height, r.depth, r.qty, r.remark]);
        } else {
          aoa.push(emptyRow(seq++));
        }
      }
      aoa.push(['VT-01 소계', '', '', '', '', '', '', '', vt01.reduce((s, r) => s + r.qty, 0), '']); // 38

      // ── VT-049 섹션 (11슬롯) ──
      const vt049 = sections['VT-049'];
      for (let i = 0; i < 11; i++) {
        if (i < vt049.length) {
          const r = vt049[i];
          aoa.push([seq++, r.material, r.productName, r.location, r.structure, r.width, r.height, r.depth, r.qty, r.remark]);
        } else {
          aoa.push(emptyRow(seq++));
        }
      }
      aoa.push(['VT-049 소계', '', '', '', '', '', '', '', vt049.reduce((s, r) => s + r.qty, 0), '']); // 50

      // ── VT-064 섹션 (1슬롯) ──
      const vt064 = sections['VT-064'];
      if (vt064.length > 0) {
        const r = vt064[0];
        aoa.push([seq++, r.material, r.productName, r.location, r.structure, r.width, r.height, r.depth, r.qty, r.remark]);
      } else {
        aoa.push(emptyRow(seq++));
      }
      aoa.push(['VT-064 소계', '', '', '', '', '', '', '', vt064.reduce((s, r) => s + r.qty, 0), '']); // 52

      // ── VA-064 섹션 (1슬롯) ──
      const va064 = sections['VA-064'];
      if (va064.length > 0) {
        const r = va064[0];
        aoa.push([seq++, r.material, r.productName, r.location, r.structure, r.width, r.height, r.depth, r.qty, r.remark]);
      } else {
        aoa.push(emptyRow(seq++));
      }
      aoa.push(['VA-064 소계', '', '', '', '', '', '', '', va064.reduce((s, r) => s + r.qty, 0), '']); // 54

      // ── VAG-1.69 섹션 ──
      const vag169 = sections['VAG-1.69'];
      for (const r of vag169) {
        aoa.push([seq++, r.material, r.productName, r.location, r.structure, r.width, r.height, r.depth, r.qty, r.remark]);
      }
      if (vag169.length > 0) {
        aoa.push(['VAG-1.69 소계', '', '', '', '', '', '', '', vag169.reduce((s, r) => s + r.qty, 0), '']);
      }

      // ── HTG 섹션 ──
      const htg064 = sections['HTG-064'];
      for (const r of htg064) {
        aoa.push([seq++, r.material, r.productName, r.location, r.structure, r.width, r.height, r.depth, r.qty, r.remark]);
      }
      if (htg064.length > 0) {
        aoa.push(['HTG-064 소계', '', '', '', '', '', '', '', htg064.reduce((s, r) => s + r.qty, 0), '']);
      }

      const htg169 = sections['HTG-1.69'];
      for (const r of htg169) {
        aoa.push([seq++, r.material, r.productName, r.location, r.structure, r.width, r.height, r.depth, r.qty, r.remark]);
      }
      if (htg169.length > 0) {
        aoa.push(['HTG-1.69 소계', '', '', '', '', '', '', '', htg169.reduce((s, r) => s + r.qty, 0), '']);
      }

      // 총합계
      const totalQty = Object.values(sections).flat().reduce((s, r) => s + r.qty, 0);
      aoa.push(['총합계', '', '', '', '', '', '', '', totalQty, '']);

      // ── 평철(브라켓) 섹션 ──
      aoa.push(['']);
      aoa.push(['평철사이즈(일반형)', '', '', '', '', '', '', '', '', '']);
      aoa.push(['재질', '두께(T)', '폭(mm)', '길이(mm)', '수량', '재질', '두께(T)', '폭(mm)', '길이(mm)', '수량', '', '비고']);

      // 브라켓 계산
      const bracketRows: any[][] = [];
      const addBracket = (material: string, t: number, w: number, len: number, qty: number, remark: string) => {
        if (qty > 0 && len > 0) bracketRows.push([material, t, w, Math.round(len), qty, '', '', '', '', '', '', remark]);
      };

      // 구조체별 브라켓 계산 (원본 아이템 기반)
      for (const item of items) {
        const code = (item.product_type || '').trim();
        const cfg = STRUCT_CONFIG[code];
        if (!cfg) continue;
        const W = item.pipe_width_mm || 0;
        const H = item.pipe_height_mm || 0;
        const D = item.qty || 1;
        if (!W || !H) continue;

        const sw = cfg.widthCalc(W); // 소켓 가로

        if (code === 'VT-049' || code === 'VT-064' || code === 'VA-064') {
          addBracket('SS400', 1.6, 60,  W - 1,  D * 4, `${code} 브라켓(상하)`);
          addBracket('SS400', 1.6, 60,  H - 30, D * 4, `${code} 브라켓(좌우)`);
        } else if (code === 'VT-01') {
          addBracket('SS400', 1.6, 60,  W / 2 - 16, D * 16, 'VT-01 브라켓(상하)');
          addBracket('SS400', 1.6, 60,  H / 2 - 20, D * 32, 'VT-01 브라켓(좌우)');
          addBracket('SS400', 1.6, 225, W / 2 - 16, D * 8,  'VT-01 중앙받침대');
          addBracket('SS400', 1.6, 237, H - 1,      D * 4,  'VT-01 세로보강대');
        } else if (code === 'VAG-1.69') {
          addBracket('SS400', 0.6, 60,  sw - 5, D * 4, 'VAG-1.69 브라켓(상하1)');
          addBracket('SS400', 0.6, 204, sw - 5, D * 4, 'VAG-1.69 브라켓(상하2)');
          addBracket('SS400', 0.6, 235, sw,     D * 2, 'VAG-1.69 중앙받침대1');
          addBracket('SS400', 0.6, 190, sw,     D * 2, 'VAG-1.69 중앙받침대2');
          addBracket('SS400', 1.6, 60,  H,      D * 2, 'VAG-1.69 결합철판');
          addBracket('SS400', 1.6, 60,  H - 35, D * cfg.qtyMult * 4, 'VAG-1.69 좌우철판');
        } else if (code === 'HTG-064' || code === 'HTG-064DC') {
          addBracket('SS400', 0.6, 60,  W - 5,  D * 2, `${code} 브라켓(상하1)`);
          addBracket('SS400', 0.6, 274, W - 5,  D * 2, `${code} 브라켓(상하2)`);
          addBracket('SS400', 1.6, 60,  H - 35, D * 4, `${code} 브라켓(좌우)`);
          addBracket('SS400', 1.6, 50,  H,      D * 3, `${code} 보강대`);
        } else if (code === 'HTG-1.69') {
          addBracket('SS400', 0.6, 60,  sw - 5, D * 4, 'HTG-1.69 브라켓(상하1)');
          addBracket('SS400', 0.6, 274, sw - 5, D * 4, 'HTG-1.69 브라켓(상하2)');
          addBracket('SS400', 0.6, 318, sw,     D * 8, 'HTG-1.69 중앙받침대1');
          addBracket('SS400', 0.6, 255, sw,     D * 8, 'HTG-1.69 중앙받침대2');
          addBracket('SS400', 1.6, 60,  H,      D * 2, 'HTG-1.69 결합철판');
          addBracket('SS400', 1.6, 50,  H,      D * 6, 'HTG-1.69 보강대');
        }
      }

      // 두 열 레이아웃으로 배치 (양식 맞춤)
      const halfLen = Math.ceil(bracketRows.length / 2);
      for (let i = 0; i < halfLen; i++) {
        const left = bracketRows[i] || [];
        const right = bracketRows[i + halfLen] || [];
        aoa.push([
          left[0] || '', left[1] || '', left[2] || '', left[3] || '', left[4] || '',
          right[0] || '', right[1] || '', right[2] || '', right[3] || '', right[4] || '',
          '', (left[11] || right[11] || ''),
        ]);
      }

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // 열 너비 설정
      ws['!cols'] = [
        { wch: 6 },  // A: 순번
        { wch: 6 },  // B: 재질
        { wch: 10 }, // C: 품명
        { wch: 8 },  // D: 위치
        { wch: 10 }, // E: 구조명
        { wch: 8 },  // F: 가로
        { wch: 8 },  // G: 세로
        { wch: 7 },  // H: 폭
        { wch: 7 },  // I: 발주
        { wch: 30 }, // J: 비고
      ];

      XLSX.utils.book_append_sheet(wb, ws, '소켓발주서');

      // ── 계산 요약 시트 ──
      const summaryAoa: any[][] = [
        ['현장명', pjName],
        ['발주일자', today],
        [''],
        ['구조명', '소켓가로', '소켓세로', '폭', '발주수량'],
      ];
      for (const [section, rows] of Object.entries(sections)) {
        for (const r of rows) {
          summaryAoa.push([r.structure, r.width, r.height, r.depth, r.qty]);
        }
      }
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
      XLSX.utils.book_append_sheet(wb, wsSummary, '계산요약');

      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

      const safeName = pjName.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `소켓발주서_${safeName}_${dateStr}.xlsx`;

      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`)
        .send(buf);
    }
  );
}
