import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';
import { expandAndSortSocketItems } from '../lib/socket-sort.js';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────

// 소켓 작업지시서 라우트
// ─────────────────────────────────────────────────────────────────────────────

/** SWO 번호 자동생성: SWO-YYYYMMDD-NNN */
async function generateSwoNumber(date: string): Promise<string> {
  const d = date.replace(/-/g, '').slice(0, 8);
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM socket_work_order WHERE swo_number LIKE $1`,
    [`SWO-${d}-%`],
  );
  const seq = parseInt(rows[0].cnt) + 1;
  return `SWO-${d}-${String(seq).padStart(3, '0')}`;
}

export async function socketWorkOrderRoutes(app: FastifyInstance) {
  // ── DB 마이그레이션 ──────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS socket_work_order (
      swo_id        SERIAL PRIMARY KEY,
      swo_number    VARCHAR(30) UNIQUE NOT NULL,
      po_id         INT REFERENCES purchase_order(po_id) ON DELETE RESTRICT,
      project_id    INT REFERENCES project_master(project_id) ON DELETE SET NULL,
      project_name  VARCHAR(300),
      sheet_name    VARCHAR(100),
      wo_date       DATE NOT NULL DEFAULT CURRENT_DATE,
      delivery_date DATE,
      status        VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
      worker        VARCHAR(100),
      remarks       TEXT,
      warnings      TEXT,
      created_by    INT,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS socket_work_order_item (
      swi_id            SERIAL PRIMARY KEY,
      swo_id            INT NOT NULL REFERENCES socket_work_order(swo_id) ON DELETE CASCADE,
      po_item_id        INT REFERENCES purchase_order_item(po_item_id) ON DELETE SET NULL,
      seq_no            INT,
      material          VARCHAR(50),
      structure         VARCHAR(100),
      pipe_width_mm     INT,
      pipe_height_mm    INT,
      opening_width_mm  INT,
      opening_height_mm INT,
      product_type      VARCHAR(100),
      item_name         VARCHAR(200),
      item_type         VARCHAR(20) DEFAULT 'socket',
      planned_qty       INT DEFAULT 1,
      actual_qty        INT,
      remark            TEXT,
      is_incomplete     BOOLEAN DEFAULT FALSE,
      created_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  // 신규 컬럼 추가 (이미 있으면 무시)
  await pool.query(`ALTER TABLE socket_work_order_item ADD COLUMN IF NOT EXISTS construction_seq INT DEFAULT 1`).catch(() => {});
  await pool.query(`ALTER TABLE socket_work_order_item ADD COLUMN IF NOT EXISTS insp_lot_no VARCHAR(50)`).catch(() => {});
  await pool.query(`ALTER TABLE socket_work_order_item ADD COLUMN IF NOT EXISTS sii_id INT`).catch(() => {});


  // ── GET /api/socket-work-orders ─ 목록 ────────────────────────────────────
  app.get('/api/socket-work-orders', { preHandler: requireAuth }, async (req, reply) => {
    const { po_id, status, search } = req.query as any;
    const params: any[] = [];
    const where: string[] = ["swo.status <> 'DELETED'"];

    if (po_id) { params.push(po_id); where.push(`swo.po_id = $${params.length}`); }
    if (status) { params.push(status); where.push(`swo.status = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(swo.project_name ILIKE $${params.length} OR swo.swo_number ILIKE $${params.length})`);
    }

    const sql = `
      SELECT
        swo.*,
        po.file_name        AS po_file_name,
        po.biz_name         AS po_biz_name,
        po.delivery_date    AS po_delivery_date,
        pm.project_code,
        (SELECT COUNT(*) FROM socket_work_order_item WHERE swo_id = swo.swo_id) AS item_count,
        (SELECT COUNT(*) FROM socket_work_order_item WHERE swo_id = swo.swo_id AND is_incomplete = TRUE) AS incomplete_count,
        EXISTS (
          SELECT 1 FROM socket_work_order_item swi2
          JOIN socket_work_order swo2 ON swo2.swo_id = swi2.swo_id
          WHERE swi2.po_item_id IN (
            SELECT po_item_id FROM socket_work_order_item WHERE swo_id = swo.swo_id
          )
          AND swo2.swo_id <> swo.swo_id
          AND swo2.status IN ('PLANNED','IN_PROGRESS')
        ) AS has_duplicate
      FROM socket_work_order swo
      LEFT JOIN purchase_order po ON po.po_id = swo.po_id
      LEFT JOIN project_master pm ON pm.project_id = swo.project_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY swo.created_at DESC
    `;

    const { rows } = await pool.query(sql, params);
    return { data: rows };
  });

  // ── GET /api/socket-work-orders/po/:po_id/check ─ 경고 사전 체크 ──────────
  app.get('/api/socket-work-orders/po/:po_id/check', { preHandler: requireAuth }, async (req, reply) => {
    const poId = (req.params as any).po_id;

    // 1. 소켓 발주 건 하위의 인수검사 완료(합격 및 LOT 부여 완료)된 품목들만 조회
    const { rows: items } = await pool.query(
      `SELECT 
         sii.sii_id,
         sii.so_id,
         sii.seq_no,
         sii.construction_seq,
         sii.product_type,
         sii.pipe_width_mm,
         sii.pipe_height_mm,
         sii.width_mm,
         sii.height_mm,
         sii.depth_mm,
         sii.insp_lot_no,
         sii.insp_result,
         sii.insp_result_2,
         poi.po_item_id,
         poi.po_id,
         poi.material,
         poi.structure,
         poi.opening_width_mm,
         poi.opening_height_mm,
         poi.sheet_name,
         poi.item_name,
         poi.item_type,
         poi.remark
       FROM socket_incoming_inspection sii
       JOIN socket_order so ON so.so_id = sii.so_id
       LEFT JOIN purchase_order_item poi ON poi.po_id = so.po_id AND poi.seq_no = sii.item_seq
       WHERE so.po_id = $1
         AND (sii.insp_result = 'PASS' OR sii.insp_result_2 = 'PASS')
         AND sii.insp_lot_no IS NOT NULL 
         AND sii.insp_lot_no <> ''
       ORDER BY poi.sheet_name, sii.seq_no`,
      [poId],
    );

    // 2. 중복 체크: 이미 PLANNED/IN_PROGRESS 상태 SWO 에 포함된 sii_id
    const { rows: dupRows } = await pool.query(`
      SELECT swi.sii_id
      FROM socket_work_order_item swi
      JOIN socket_work_order swo ON swo.swo_id = swi.swo_id
      WHERE swi.sii_id IN (
        SELECT sii.sii_id 
        FROM socket_incoming_inspection sii
        JOIN socket_order so ON so.so_id = sii.so_id
        WHERE so.po_id = $1
      )
      AND swo.status IN ('PLANNED','IN_PROGRESS')
    `, [poId]);
    const dupIds = new Set(dupRows.map(r => r.sii_id));

    // 3. 결과 조합
    const result = items.map(item => {
      const isIncomplete =
        !item.pipe_width_mm || !item.pipe_height_mm ||
        (!item.structure && !item.product_type);
      const isDuplicate = dupIds.has(item.sii_id);
      return { 
        ...item, 
        qty: 1, // 낱개 단위이므로 개별 수량은 항상 1
        is_incomplete: isIncomplete, 
        is_duplicate: isDuplicate 
      };
    });

    // 시트별 그룹
    const sheets: Record<string, typeof result> = {};
    result.forEach(r => {
      const s = r.sheet_name || '기타';
      if (!sheets[s]) sheets[s] = [];
      sheets[s].push(r);
    });

    return {
      data: {
        items: result,
        sheets: Object.keys(sheets),
        sheet_items: sheets,
        total: result.length,
        incomplete_count: result.filter(r => r.is_incomplete).length,
        duplicate_count: result.filter(r => r.is_duplicate).length,
      },
    };
  });


  // ── GET /api/socket-work-orders/:id ─ 상세 ────────────────────────────────
  app.get('/api/socket-work-orders/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = (req.params as any).id;
    const { rows } = await pool.query(`
      SELECT swo.*, po.file_name AS po_file_name, po.biz_name, po.site_address,
             po.consignee, po.special_notes AS po_special_notes,
             pm.project_code
      FROM socket_work_order swo
      LEFT JOIN purchase_order po ON po.po_id = swo.po_id
      LEFT JOIN project_master pm ON pm.project_id = swo.project_id
      WHERE swo.swo_id = $1
    `, [id]);
    if (!rows[0]) return reply.code(404).send({ error: 'not_found' });

    const { rows: items } = await pool.query(
      `SELECT * FROM socket_work_order_item WHERE swo_id = $1 ORDER BY seq_no`,
      [id],
    );
    return { data: { ...rows[0], items } };
  });

  // ── POST /api/socket-work-orders ─ 생성 ──────────────────────────────────
  app.post('/api/socket-work-orders', { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body as any;
    const user = (req as any).user;

    const {
      po_id, project_id, project_name, sheet_name,
      wo_date, delivery_date, worker, remarks,
      items = [],
    } = body;

    if (!po_id) return reply.code(400).send({ error: 'po_id 필수' });
    if (!items.length) return reply.code(400).send({ error: '품목을 1개 이상 선택하세요' });

    let finalProjectId = project_id;
    if (!finalProjectId && po_id) {
      const { rows: poRows } = await pool.query('SELECT project_id FROM purchase_order WHERE po_id = $1', [po_id]);
      if (poRows[0]) {
        finalProjectId = poRows[0].project_id;
      }
    }

    const date = wo_date || new Date().toISOString().slice(0, 10);
    const swoNumber = await generateSwoNumber(date);


    // 경고 메시지 수집
    const warnings: string[] = [];
    const incompleteItems = items.filter((it: any) =>
      !it.pipe_width_mm || !it.pipe_height_mm || !it.planned_qty || it.planned_qty < 1
    );
    if (incompleteItems.length > 0) {
      warnings.push(`미완성 발주내용 ${incompleteItems.length}건`);
    }

    // 중복 체크
    const poItemIds = items.map((it: any) => it.po_item_id).filter(Boolean);
    if (poItemIds.length > 0) {
      const { rows: dupRows } = await pool.query(`
        SELECT swi.po_item_id
        FROM socket_work_order_item swi
        JOIN socket_work_order swo ON swo.swo_id = swi.swo_id
        WHERE swi.po_item_id = ANY($1::int[])
        AND swo.status IN ('PLANNED','IN_PROGRESS')
      `, [poItemIds]);
      if (dupRows.length > 0) {
        warnings.push(`중복 작업지시 ${dupRows.length}건`);
      }
    }

    // ── 핵심: qty만큼 1개씩 분리 + 정렬 (인수검사 LOT 부여 + 가로↑세로↑)
    const hasSii = items.some((it: any) => it.sii_id);
    const expandedItems = hasSii ? items : expandAndSortSocketItems(items);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(`
        INSERT INTO socket_work_order
          (swo_number, po_id, project_id, project_name, sheet_name,
           wo_date, delivery_date, worker, remarks, warnings, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING swo_id, swo_number
      `, [
        swoNumber, po_id, finalProjectId || null, project_name || null, sheet_name || null,
        date, delivery_date || null, worker || null, remarks || null,
        warnings.length ? warnings.join(' / ') : null,
        user?.worker_id || null,
      ]);
      const swoId = rows[0].swo_id;

      for (const item of expandedItems) {
        const isIncomplete =
          !item.pipe_width_mm || !item.pipe_height_mm || !item.planned_qty || item.planned_qty < 1;
        await client.query(`
          INSERT INTO socket_work_order_item
            (swo_id, po_item_id, seq_no, material, structure,
             pipe_width_mm, pipe_height_mm, opening_width_mm, opening_height_mm,
             product_type, item_name, item_type, planned_qty, remark, is_incomplete,
             construction_seq, insp_lot_no, sii_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        `, [
          swoId,
          item.po_item_id || null, item.seq_no || null,
          item.material || null, item.structure || null,
          item.pipe_width_mm || null, item.pipe_height_mm || null,
          item.opening_width_mm || null, item.opening_height_mm || null,
          item.product_type || null, item.item_name || null,
          item.item_type || 'socket',
          1,  // 항상 1개
          item.remark || null, isIncomplete,
          parseInt(String(item.construction_seq ?? 1)) || 1,
          item.insp_lot_no || null,
          item.sii_id || null,
        ]);
      }

      await client.query('COMMIT');
      return reply.code(201).send({
        data: { swo_id: swoId, swo_number: rows[0].swo_number, warnings },
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      return reply.code(500).send({ error: err.message });
    } finally {
      client.release();
    }
  });

  // ── PATCH /api/socket-work-orders/:id ─ 수정/상태변경 ────────────────────
  app.patch('/api/socket-work-orders/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = (req.params as any).id;
    const body = req.body as any;

    const allowed = ['status', 'worker', 'remarks', 'delivery_date', 'wo_date'];
    const sets: string[] = [];
    const vals: any[] = [];

    for (const key of allowed) {
      if (key in body) {
        vals.push(body[key]);
        sets.push(`${key} = $${vals.length}`);
      }
    }
    if (!sets.length) return reply.code(400).send({ error: '변경할 항목 없음' });

    vals.push(new Date().toISOString());
    sets.push(`updated_at = $${vals.length}`);
    vals.push(id);

    await pool.query(
      `UPDATE socket_work_order SET ${sets.join(', ')} WHERE swo_id = $${vals.length}`,
      vals,
    );

    // 실적 수량 일괄 업데이트
    if (body.item_actuals && Array.isArray(body.item_actuals)) {
      for (const ia of body.item_actuals) {
        await pool.query(
          `UPDATE socket_work_order_item SET actual_qty = $1 WHERE swi_id = $2 AND swo_id = $3`,
          [ia.actual_qty, ia.swi_id, id],
        );
      }
    }

    return { ok: true };
  });

  // ── DELETE /api/socket-work-orders/:id ─ 삭제 ────────────────────────────
  app.delete('/api/socket-work-orders/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = (req.params as any).id;
    const { rows } = await pool.query(
      `SELECT status FROM socket_work_order WHERE swo_id = $1`, [id],
    );
    if (!rows[0]) return reply.code(404).send({ error: 'not_found' });
    if (rows[0].status === 'COMPLETED') {
      return reply.code(400).send({ error: '완료된 작업지시는 삭제할 수 없습니다.' });
    }
    await pool.query(`DELETE FROM socket_work_order WHERE swo_id = $1`, [id]);
    return { ok: true };
  });

  // 구조 코드명에 따른 소켓 종류 (VM vs VT) 정밀 분류 테이블 (품질인정서 및 BOM 총괄현황 기준)
  const SOCKET_TYPE_MAP: Record<string, 'VM' | 'VT'> = {
    'V-03':         'VM', // VM계열
    'VS-01':        'VM', // VS200+VG200 -> VM
    'VT-049':       'VM', // 소켓명: VM200 -> VM
    'VA-064':       'VM', // 소켓명: VM200 -> VM
    'VT-064':       'VM', // 소켓명: VM200 -> VM
    'HTG-064':      'VM', // 소켓명: HMG300C -> VM
    'HTG-064DC':    'VM', // 소켓명: HMG300 -> VM
    'HTG(DC)-064':  'VM', // 소켓명: HMG300 -> VM
    'BDCV-1S':      'VM', // 댐퍼계열 -> VM
    'BDRV-3S':      'VM', // 댐퍼계열 -> VM

    'VT-01':        'VT', // 소켓명: VT200 -> VT
    'VAG-1.69':     'VT', // 소켓명: VTG200 -> VT
    'VAG-169':      'VT', // 소켓명: VTG200 -> VT
    'VTI-064':      'VT', // 소켓명: VIG200 -> VT
    'HAG-1.69':     'VT', // 소켓명: HTG300C -> VT
    'HAG-169':      'VT', // 소켓명: HTG300C -> VT
    'HTG-1.69':     'VT', // 소켓명: HTG300C -> VT
    'HTG-169':      'VT', // 소켓명: HTG300C -> VT
  };

  const getSocketCategory = (productType: string, structure: string): 'RISER' | 'WALL' | 'BUSDUCT' => {
    const pt = (productType || '').trim().toUpperCase();
    const st = (structure || '').trim().toUpperCase();

    // 1. 부스덕트 판별
    if (pt.startsWith('BD') || st.startsWith('BD')) {
      return 'BUSDUCT';
    }

    // 2. 입상(Riser) 판별
    if (st.startsWith('H') || pt.startsWith('H') || pt.includes('HAG') || pt.includes('HTG')) {
      return 'RISER';
    }

    // 3. 벽체(Wall) 판별
    return 'WALL';
  };

  const getSocketType = (productType: string): 'VM' | 'VT' => {
    const pt = (productType || '').trim();
    if (SOCKET_TYPE_MAP[pt]) {
      return SOCKET_TYPE_MAP[pt];
    }
    const upper = pt.toUpperCase();
    if (upper.includes('VT') || upper.includes('HT') || upper.includes('VTI') || upper.includes('VAG')) {
      return 'VT';
    }
    return 'VM';
  };

  // ── GET /api/socket-work-orders/:id/excel ─ 엑셀 지시서 템플릿 다운로드 ───────
  app.get('/api/socket-work-orders/:id/excel', { preHandler: requireAuth }, async (req, reply) => {
    const id = (req.params as any).id;
    
    // 1. 데이터 조회
    const { rows: swoRows } = await pool.query(
      `SELECT swo.*, po.file_name AS po_file_name, po.project_name AS po_project_name 
       FROM socket_work_order swo
       LEFT JOIN purchase_order po ON po.po_id = swo.po_id
       WHERE swo.swo_id = $1`, [id]
    );
    if (!swoRows[0]) return reply.code(404).send({ error: 'not_found' });
    const swo = swoRows[0];

    const { rows: items } = await pool.query(
      `SELECT * FROM socket_work_order_item WHERE swo_id = $1 ORDER BY seq_no`
    );

    const projectTitle = swo.project_name || swo.po_project_name || '소켓 작업지시서';

    // 대표 카테고리 결정
    let category: 'RISER' | 'WALL' | 'BUSDUCT' = 'WALL';
    if (items.some(it => getSocketCategory(it.product_type, it.structure) === 'BUSDUCT')) {
      category = 'BUSDUCT';
    } else if (items.some(it => getSocketCategory(it.product_type, it.structure) === 'RISER')) {
      category = 'RISER';
    }

    const writeCell = (sheet: any, r: number, c: number, val: any) => {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!sheet[cellRef]) {
        sheet[cellRef] = { t: 's', v: '' };
      }
      sheet[cellRef].v = val;
      sheet[cellRef].t = typeof val === 'number' ? 'n' : 's';
    };

    let workbook;

    if (category === 'RISER') {
      // ─── [입상 전용 분기] ───
      const templatePath = path.join(__dirname, '../templates/26.06.04 씨에스_우진아이엔에스_포스코건설_양평동삼화인쇄(입상) 작업지시서.xlsx');
      try {
        workbook = XLSX.readFile(templatePath);
      } catch (e: any) {
        return reply.code(500).send({ error: '입상용 엑셀 템플릿 파일을 찾을 수 없습니다: ' + e.message });
      }

      // 시트 1: 1. 소켓인수검사
      const sheet1 = workbook.Sheets['1. 소켓인수검사'];
      if (sheet1) {
        writeCell(sheet1, 0, 3, projectTitle);
        let startRow = 8;
        items.forEach((item, idx) => {
          const r = startRow + idx;
          const noStr = String(idx + 1).padStart(2, '0');
          writeCell(sheet1, r, 0, noStr);
          writeCell(sheet1, r, 1, item.product_type || item.structure || '');
          const wVal = item.pipe_width_mm ? Number(item.pipe_width_mm) : '';
          const hVal = item.pipe_height_mm ? Number(item.pipe_height_mm) : '';
          writeCell(sheet1, r, 2, wVal);
          writeCell(sheet1, r, 3, hVal);
          writeCell(sheet1, r, 6, item.remark || '');
        });
        sheet1['!ref'] = `A1:O${startRow + items.length + 5}`;
      }

      // 시트 2: 2.1 재단(1.69,064)
      const sheet2 = workbook.Sheets['2.1 재단(1.69,064)'];
      if (sheet2) {
        writeCell(sheet2, 1, 9, projectTitle);
        let startRow = 7;
        items.forEach((item, idx) => {
          const r = startRow + idx;
          const noStr = String(idx + 1).padStart(2, '0');
          writeCell(sheet2, r, 0, noStr);
          writeCell(sheet2, r, 1, item.product_type || item.structure || '');
          const wVal = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
          const hVal = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
          writeCell(sheet2, r, 2, wVal);
          writeCell(sheet2, r, 3, hVal);
          writeCell(sheet2, r, 4, item.insp_lot_no || '');
          writeCell(sheet2, r, 5, 255); // 높이 고정 255
          writeCell(sheet2, r, 6, wVal > 0 ? wVal - 5 : ''); // 가로재단 W - 5
          writeCell(sheet2, r, 7, wVal > 0 ? 6 : ''); // 가로수량 6개
          writeCell(sheet2, r, 13, hVal > 0 ? hVal - 35 : ''); // 세로재단 H - 35
          writeCell(sheet2, r, 14, hVal > 0 ? 6 : ''); // 세로수량 6개
        });
        sheet2['!ref'] = `A1:T${startRow + items.length + 5}`;
      }

      // 시트 3: 3.1 절곡(HTG1.69)(브라켓,보강대,받침대)
      const sheet3 = workbook.Sheets['3.1 절곡(HTG1.69)(브라켓,보강대,받침대)'];
      if (sheet3) {
        writeCell(sheet3, 0, 12, projectTitle);
        let startRow = 7;
        items.forEach((item, idx) => {
          const r = startRow + idx;
          const noStr = String(idx + 1).padStart(2, '0');
          writeCell(sheet3, r, 0, noStr);
          const wVal = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
          const hVal = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
          writeCell(sheet3, r, 2, wVal);
          writeCell(sheet3, r, 3, hVal);
          writeCell(sheet3, r, 4, item.insp_lot_no || '');
          writeCell(sheet3, r, 5, 1);
          writeCell(sheet3, r, 8, wVal > 0 ? wVal - 5 : '');
          writeCell(sheet3, r, 9, wVal > 0 ? 2 : '');
          writeCell(sheet3, r, 12, wVal > 0 ? wVal - 5 : '');
          writeCell(sheet3, r, 13, wVal > 0 ? 23 : ''); // 고정 절곡치수 23
          writeCell(sheet3, r, 14, wVal > 0 ? 23 : '');
          writeCell(sheet3, r, 15, wVal > 0 ? 2 : '');
        });
        sheet3['!ref'] = `A1:P${startRow + items.length + 5}`;
      }

      // 시트 4: 4. 차열재 소켓용 (수정)
      const sheet4 = workbook.Sheets['4. 차열재 소켓용 (수정)'];
      if (sheet4) {
        writeCell(sheet4, 4, 12, projectTitle);
        let startRow = 10;
        items.forEach((item, idx) => {
          const r = startRow + idx;
          const noStr = String(idx + 1).padStart(2, '0');
          writeCell(sheet4, r, 0, noStr);
          writeCell(sheet4, r, 1, item.product_type || item.structure || '');
          const wVal = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
          const hVal = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
          writeCell(sheet4, r, 2, wVal);
          writeCell(sheet4, r, 3, hVal);
          writeCell(sheet4, r, 4, item.insp_lot_no || '');
          writeCell(sheet4, r, 7, wVal > 0 ? wVal + 60 : '');
          writeCell(sheet4, r, 8, wVal > 0 ? 2 : '');
          writeCell(sheet4, r, 9, hVal > 0 ? hVal : '');
          writeCell(sheet4, r, 10, hVal > 0 ? 2 : '');
        });
        sheet4['!ref'] = `A1:L${startRow + items.length + 5}`;
      }

      // 시트 5: 5. 차열재 출하용
      const sheet5 = workbook.Sheets['5. 차열재 출하용'];
      if (sheet5) {
        writeCell(sheet5, 4, 15, projectTitle);
        let startRow = 9;
        items.forEach((item, idx) => {
          const r = startRow + idx;
          const noStr = String(idx + 1).padStart(2, '0');
          writeCell(sheet5, r, 0, noStr);
          const wVal = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
          const hVal = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
          writeCell(sheet5, r, 1, wVal);
          writeCell(sheet5, r, 2, hVal);
          writeCell(sheet5, r, 3, item.product_type || item.structure || '');
          
          const area = wVal > 0 && hVal > 0 ? Number(((wVal * hVal) / 1000000).toFixed(4)) : 0;
          const perimeter = wVal > 0 && hVal > 0 ? Number((((wVal + hVal) * 2) / 1000).toFixed(1)) : 0;
          
          writeCell(sheet5, r, 4, area);
          writeCell(sheet5, r, 5, perimeter);
          writeCell(sheet5, r, 6, perimeter > 0 ? Number((perimeter + 0.4).toFixed(1)) : '');
          writeCell(sheet5, r, 7, 1);
          writeCell(sheet5, r, 8, perimeter > 0 ? Number((perimeter + 0.4).toFixed(1)) : '');
          writeCell(sheet5, r, 13, 2);
        });
        sheet5['!ref'] = `A1:U${startRow + items.length + 5}`;
      }

      // 시트 6: 라벨소요량
      const sheet6 = workbook.Sheets['라벨소요량'];
      if (sheet6) {
        writeCell(sheet6, 0, 9, projectTitle);
        let startRow = 6;
        items.forEach((item, idx) => {
          const r = startRow + idx;
          const noStr = String(idx + 1).padStart(2, '0');
          writeCell(sheet6, r, 0, noStr);
          writeCell(sheet6, r, 1, item.product_type || item.structure || '');
          const wVal = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
          const hVal = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
          writeCell(sheet6, r, 2, wVal);
          writeCell(sheet6, r, 3, hVal);
          writeCell(sheet6, r, 4, item.insp_lot_no || '');

          const area = wVal > 0 && hVal > 0 ? Number(((wVal * hVal) / 1000000).toFixed(4)) : 0;
          const perimeter = wVal > 0 && hVal > 0 ? Number((((wVal + hVal) * 2) / 1000).toFixed(1)) : 0;

          writeCell(sheet6, r, 5, area);
          writeCell(sheet6, r, 6, perimeter);
          writeCell(sheet6, r, 7, 2);
          writeCell(sheet6, r, 8, perimeter > 0 ? Number((perimeter + 0.4).toFixed(1)) : '');
          writeCell(sheet6, r, 14, perimeter > 0 ? Number((perimeter + 0.5).toFixed(1)) : '');
          writeCell(sheet6, r, 15, 2);
        });
        sheet6['!ref'] = `A1:P${startRow + items.length + 5}`;
      }

    } else if (category === 'BUSDUCT') {
      // ─── [부스덕트 신규 분기] ───
      // 템플릿 부재 시 동적 빌딩을 위해 빈 워크북 생성
      workbook = XLSX.utils.book_new();

      // 시트 1: 1. 소켓인수검사
      const aoa1 = [
        ['[부스덕트] 소켓인수검사 대장', '', '', projectTitle],
        [],
        ['No', '구조/모델명', '덕트 가로(mm)', '덕트 세로(mm)', '수량', '검사 LOT 번호', '비고']
      ];
      items.forEach((item, idx) => {
        aoa1.push([
          String(idx + 1).padStart(2, '0'),
          item.product_type || item.structure || '',
          item.pipe_width_mm ? Number(item.pipe_width_mm) : '',
          item.pipe_height_mm ? Number(item.pipe_height_mm) : '',
          1,
          item.insp_lot_no || '',
          item.remark || ''
        ]);
      });
      workbook.SheetNames.push('1. 소켓인수검사');
      workbook.Sheets['1. 소켓인수검사'] = XLSX.utils.aoa_to_sheet(aoa1);

      // 시트 2: 2.1 방화플래싱 재단 및 가공
      const aoa2 = [
        ['2.1 방화플래싱 재단 및 가공', '', '', projectTitle],
        [],
        ['No', '구조/모델명', '재질', '방화플래싱 길이(mm)', '방화플래싱 너비(mm)', '수량', '두께 기준']
      ];
      items.forEach((item, idx) => {
        const pt = (item.product_type || '').toUpperCase();
        const isCv = pt.includes('CV');
        aoa2.push([
          String(idx + 1).padStart(2, '0'),
          item.product_type || item.structure || '',
          isCv ? '스테인리스강판(SUS)' : '아연도금강판(GI)',
          isCv ? 380 : 1000,
          isCv ? 190 : 175,
          1,
          isCv ? '0.5 ㎜ 이상' : '1.0 ㎜ 이상'
        ]);
      });
      workbook.SheetNames.push('2.1 방화플래싱 재단 및 가공');
      workbook.Sheets['2.1 방화플래싱 재단 및 가공'] = XLSX.utils.aoa_to_sheet(aoa2);

      // 시트 3: 3.1 틈새복합시트(차열재) 재단
      const aoa3 = [
        ['3.1 틈새복합시트(차열재) 재단', '', '', projectTitle],
        [],
        ['No', '구조/모델명', '차열시트 길이(mm)', '차열시트 너비(mm)', '두께(mm)', '수량(개)', '비고']
      ];
      items.forEach((item, idx) => {
        const pt = (item.product_type || '').toUpperCase();
        const isCv = pt.includes('CV');
        aoa3.push([
          String(idx + 1).padStart(2, '0'),
          item.product_type || item.structure || '',
          isCv ? '150H 복합사양' : 1000,
          isCv ? '외경비례' : 125,
          isCv ? 5.5 : 5.0,
          isCv ? 1 : 2, // RV-3S는 상/하부 2세트 고정
          isCv ? '외경 200 mm 이하 틈새 시트' : '상/하부 밀도 1.2g/㎤ 이상 차열시트'
        ]);
      });
      workbook.SheetNames.push('3.1 틈새복합시트(차열재) 재단');
      workbook.Sheets['3.1 틈새복합시트(차열재) 재단'] = XLSX.utils.aoa_to_sheet(aoa3);

      // 시트 4: 4. 단열재 시공(세라믹 블랭킷)
      const aoa4 = [
        ['4. 단열재 시공(세라믹 블랭킷)', '', '', projectTitle],
        [],
        ['No', '구조/모델명', '단열재 종류', '밀도 기준(kg/㎥)', '너비 기준(mm)', '두께 기준(mm)', '고정 방식']
      ];
      items.forEach((item, idx) => {
        aoa4.push([
          String(idx + 1).padStart(2, '0'),
          item.product_type || item.structure || '',
          '세라믹 섬유 블랭킷',
          '96 kg/㎥ 이상',
          600,
          '25 ㎜ 이상',
          '양면 대칭 철사 고정'
        ]);
      });
      workbook.SheetNames.push('4. 단열재 시공(세라믹 블랭킷)');
      workbook.Sheets['4. 단열재 시공(세라믹 블랭킷)'] = XLSX.utils.aoa_to_sheet(aoa4);

      // 시트 5: 5. 라벨소요량
      const aoa5 = [
        ['5. 라벨소요량', '', '', projectTitle],
        [],
        ['No', '구조/모델명', '가로(mm)', '세로(mm)', '면적(㎡)', '둘레(m)', '필요 라벨 수량(개)']
      ];
      items.forEach((item, idx) => {
        const wVal = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
        const hVal = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
        const area = wVal > 0 && hVal > 0 ? Number(((wVal * hVal) / 1000000).toFixed(4)) : 0;
        const perimeter = wVal > 0 && hVal > 0 ? Number((((wVal + hVal) * 2) / 1000).toFixed(1)) : 0;

        aoa5.push([
          String(idx + 1).padStart(2, '0'),
          item.product_type || item.structure || '',
          wVal || '-',
          hVal || '-',
          area || '-',
          perimeter || '-',
          2 // 소켓당 라벨 2개 기본 소요
        ]);
      });
      workbook.SheetNames.push('5. 라벨소요량');
      workbook.Sheets['5. 라벨소요량'] = XLSX.utils.aoa_to_sheet(aoa5);

    } else {
      // ─── [벽체 전용 분기 (기존 벽체 로직 동일)] ───
      const templatePath = path.join(__dirname, '../templates/26.04.24 그린산업_ 일우엠이씨_GS건설_아산탕정자이퍼스트시티 작업지시서.xlsx');
      try {
        workbook = XLSX.readFile(templatePath);
      } catch (e: any) {
        return reply.code(500).send({ error: '엑셀 템플릿 파일을 찾을 수 없습니다: ' + e.message });
      }

      // ── 시트 1: 1. 소켓인수검사
      const sheet1 = workbook.Sheets['1. 소켓인수검사'];
      if (sheet1) {
        writeCell(sheet1, 0, 3, projectTitle);
        let startRow = 8;
        items.forEach((item, idx) => {
          const r = startRow + idx;
          const noStr = String(idx + 1).padStart(2, '0');
          writeCell(sheet1, r, 0, noStr);
          writeCell(sheet1, r, 1, item.product_type || item.structure || '');
          const wVal = item.pipe_width_mm ? Number(item.pipe_width_mm) : '';
          const hVal = item.pipe_height_mm ? Number(item.pipe_height_mm) : '';
          writeCell(sheet1, r, 2, wVal);
          writeCell(sheet1, r, 3, hVal);
          writeCell(sheet1, r, 6, item.remark || '');
        });
        sheet1['!ref'] = `A1:O${startRow + items.length + 5}`;
      }

      const vmItems = items.filter(it => getSocketType(it.product_type) === 'VM');
      const vtItems = items.filter(it => getSocketType(it.product_type) === 'VT');

      // ── 시트 2: 2.재단(VM)작업
      const sheet2 = workbook.Sheets['2.재단(VM)작업'];
      if (sheet2 && vmItems.length > 0) {
        writeCell(sheet2, 0, 7, projectTitle);
        let startRow = 7;
        vmItems.forEach((item, idx) => {
          const r = startRow + idx;
          const noStr = String(idx + 1).padStart(2, '0');
          writeCell(sheet2, r, 0, noStr);
          writeCell(sheet2, r, 1, item.product_type || item.structure || '');
          const wVal = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
          const hVal = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
          writeCell(sheet2, r, 2, wVal);
          writeCell(sheet2, r, 3, hVal);
          writeCell(sheet2, r, 4, item.insp_lot_no || '');
          writeCell(sheet2, r, 5, 1);
          writeCell(sheet2, r, 6, wVal > 0 ? wVal - 5 : '');
          writeCell(sheet2, r, 7, wVal > 0 ? 4 : '');
          writeCell(sheet2, r, 8, hVal > 0 ? hVal - 30 : '');
          writeCell(sheet2, r, 9, hVal > 0 ? 4 : '');
          writeCell(sheet2, r, 10, wVal > 0 ? wVal + 60 : '');
          writeCell(sheet2, r, 11, wVal > 0 ? 2 : '');
          writeCell(sheet2, r, 12, hVal > 0 ? hVal : '');
          writeCell(sheet2, r, 13, wVal > 0 ? 2 : '');
          writeCell(sheet2, r, 14, item.remark || '');
        });
        sheet2['!ref'] = `A1:O${startRow + vmItems.length + 5}`;
      }

      // ── 시트 3: 2.1 재단작업(VT)
      const sheet3 = workbook.Sheets['2.1 재단작업(VT)'];
      if (sheet3 && vtItems.length > 0) {
        writeCell(sheet3, 0, 7, projectTitle);
        let startRow = 7;
        vtItems.forEach((item, idx) => {
          const r = startRow + idx;
          const noStr = String(idx + 1).padStart(2, '0');
          writeCell(sheet3, r, 0, noStr);
          writeCell(sheet3, r, 1, item.product_type || item.structure || '');
          const wVal = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
          const hVal = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
          writeCell(sheet3, r, 2, wVal);
          writeCell(sheet3, r, 3, hVal);
          writeCell(sheet3, r, 4, item.insp_lot_no || '');
          writeCell(sheet3, r, 5, 1);
          writeCell(sheet3, r, 6, wVal > 0 ? (wVal - 40) / 2 : '');
          writeCell(sheet3, r, 7, wVal > 0 ? 16 : '');
          writeCell(sheet3, r, 8, hVal > 0 ? (hVal - 40) / 2 : '');
          writeCell(sheet3, r, 9, hVal > 0 ? 16 : '');
          writeCell(sheet3, r, 10, wVal > 0 ? wVal + 60 : '');
          writeCell(sheet3, r, 11, wVal > 0 ? 4 : '');
          writeCell(sheet3, r, 12, hVal > 0 ? hVal : '');
          writeCell(sheet3, r, 13, hVal > 0 ? 4 : '');
          writeCell(sheet3, r, 14, item.remark || '');
        });
        sheet3['!ref'] = `A1:O${startRow + vtItems.length + 5}`;
      }

      // ── 시트 4: 3.2 절곡(VT)
      const sheet4 = workbook.Sheets['3.2 절곡(VT)'];
      if (sheet4 && vtItems.length > 0) {
        writeCell(sheet4, 4, 13, projectTitle);
        let startRow = 10;
        vtItems.forEach((item, idx) => {
          const r = startRow + idx;
          const noStr = String(idx + 1).padStart(2, '0');
          writeCell(sheet4, r, 0, noStr);
          const wVal = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
          const hVal = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
          writeCell(sheet4, r, 1, wVal);
          writeCell(sheet4, r, 2, hVal);
          writeCell(sheet4, r, 3, 1);
          writeCell(sheet4, r, 4, item.insp_lot_no || '');
          writeCell(sheet4, r, 5, '1.6이상');
          writeCell(sheet4, r, 6, '60mm');
          writeCell(sheet4, r, 7, wVal > 0 ? (wVal - 40) / 2 + 4 : '');
          writeCell(sheet4, r, 8, wVal > 0 ? 16 : '');
          writeCell(sheet4, r, 10, hVal > 0 ? (hVal - 40) / 2 - 1 : '');
          writeCell(sheet4, r, 13, hVal > 0 ? 32 : '');
        });
        sheet4['!ref'] = `A1:O${startRow + vtItems.length + 5}`;
      }

      // ── 시트 5: 차열재 재단(VM,VT)
      const sheet5 = workbook.Sheets['차열재 재단(VM,VT)'];
      if (sheet5) {
        writeCell(sheet5, 0, 7, projectTitle);
        let startRow = 7;
        items.forEach((item, idx) => {
          const r = startRow + idx;
          const noStr = String(idx + 1).padStart(2, '0');
          const isVm = getSocketType(item.product_type) === 'VM';
          writeCell(sheet5, r, 0, noStr);
          writeCell(sheet5, r, 1, item.product_type || item.structure || '');
          const wVal = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
          const hVal = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
          writeCell(sheet5, r, 2, wVal);
          writeCell(sheet5, r, 3, hVal);
          writeCell(sheet5, r, 4, item.insp_lot_no || '');
          writeCell(sheet5, r, 5, 1);
          writeCell(sheet5, r, 6, wVal > 0 ? wVal + 60 : '');
          writeCell(sheet5, r, 7, wVal > 0 ? (isVm ? 2 : 4) : '');
          writeCell(sheet5, r, 8, hVal > 0 ? hVal : '');
          writeCell(sheet5, r, 9, hVal > 0 ? (isVm ? 2 : 4) : '');
        });
        sheet5['!ref'] = `A1:K${startRow + items.length + 5}`;
      }

      // ── 시트 6: 3. 1절곡(VM)
      const sheet6 = workbook.Sheets['3. 1절곡(VM)'];
      if (sheet6 && vmItems.length > 0) {
        writeCell(sheet6, 4, 13, projectTitle);
        let startRow = 10;
        vmItems.forEach((item, idx) => {
          const r = startRow + idx;
          const noStr = String(idx + 1).padStart(2, '0');
          writeCell(sheet6, r, 0, noStr);
          const wVal = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
          const hVal = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
          writeCell(sheet6, r, 1, wVal);
          writeCell(sheet6, r, 2, hVal);
          writeCell(sheet6, r, 3, 1);
          writeCell(sheet6, r, 4, item.insp_lot_no || '');
          writeCell(sheet6, r, 5, 1.6);
          writeCell(sheet6, r, 6, '');
          writeCell(sheet6, r, 7, wVal > 0 ? wVal - 1 : '');
          writeCell(sheet6, r, 8, wVal > 0 ? 4 : '');
          writeCell(sheet6, r, 10, hVal > 0 ? hVal - 30 : '');
          writeCell(sheet6, r, 13, hVal > 0 ? 4 : '');
        });
        sheet6['!ref'] = `A1:O${startRow + vmItems.length + 5}`;
      }

      // ── 시트 7: 3.3 절곡(VT-보강대)
      const sheet7 = workbook.Sheets['3.3 절곡(VT-보강대)'];
      if (sheet7 && vtItems.length > 0) {
        writeCell(sheet7, 4, 14, projectTitle);
        let startRow = 10;
        vtItems.forEach((item, idx) => {
          const r = startRow + idx;
          const noStr = String(idx + 1).padStart(2, '0');
          writeCell(sheet7, r, 0, noStr);
          const wVal = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
          const hVal = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
          writeCell(sheet7, r, 1, wVal);
          writeCell(sheet7, r, 2, hVal);
          writeCell(sheet7, r, 3, 1);
          writeCell(sheet7, r, 4, item.insp_lot_no || '');
          writeCell(sheet7, r, 5, '1.6이상');
          writeCell(sheet7, r, 6, 225);
          writeCell(sheet7, r, 7, wVal > 0 ? (wVal - 40) / 2 + 4 : '');
          writeCell(sheet7, r, 8, wVal > 0 ? 8 : '');
          writeCell(sheet7, r, 10, 237);
          writeCell(sheet7, r, 11, hVal > 0 ? hVal : '');
          writeCell(sheet7, r, 14, hVal > 0 ? 4 : '');
        });
        sheet7['!ref'] = `A1:O${startRow + vtItems.length + 5}`;
      }

      // ── 시트 8: 5. 차열재 출하용(VM,VT,VAG)
      const sheet8 = workbook.Sheets['5. 차열재 출하용(VM,VT,VAG)'];
      if (sheet8) {
        writeCell(sheet8, 4, 11, projectTitle);
        let startRow = 9;
        items.forEach((item, idx) => {
          const r = startRow + idx;
          const noStr = String(idx + 1).padStart(2, '0');
          const isVm = getSocketType(item.product_type) === 'VM';
          writeCell(sheet8, r, 0, noStr);
          const wVal = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
          const hVal = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
          writeCell(sheet8, r, 1, wVal);
          writeCell(sheet8, r, 2, hVal);
          writeCell(sheet8, r, 3, item.product_type || item.structure || '');

          const area = wVal > 0 && hVal > 0 ? Number(((wVal * hVal) / 1000000).toFixed(4)) : 0;
          const perimeter = wVal > 0 && hVal > 0 ? Number((((wVal + hVal) * 2) / 1000).toFixed(1)) : 0;
          writeCell(sheet8, r, 4, area);
          writeCell(sheet8, r, 5, perimeter);

          if (!isVm) {
            writeCell(sheet8, r, 6, '25*1400');
            writeCell(sheet8, r, 7, 1);
            writeCell(sheet8, r, 8, perimeter > 0 ? Number((perimeter + 0.5).toFixed(1)) : '');
            writeCell(sheet8, r, 9, '50*400');
            writeCell(sheet8, r, 10, 4);
            writeCell(sheet8, r, 11, perimeter > 0 ? Number((perimeter + 0.5).toFixed(1)) : '');
          } else {
            writeCell(sheet8, r, 12, '25*200');
            writeCell(sheet8, r, 13, 4);
            const vmUsage = perimeter > 0 ? Number((perimeter + 0.5).toFixed(1)) : 0;
            writeCell(sheet8, r, 14, vmUsage > 0 ? vmUsage * 4 : '');
          }
        });
        sheet8['!ref'] = `A1:O${startRow + items.length + 5}`;
      }

      // ── 시트 9: 6. 라벨소요량
      const sheet9 = workbook.Sheets['6. 라벨소요량'];
      if (sheet9) {
        writeCell(sheet9, 0, 10, projectTitle);
        let startRow = 6;
        items.forEach((item, idx) => {
          const r = startRow + idx;
          const noStr = String(idx + 1).padStart(2, '0');
          const isVm = getSocketType(item.product_type) === 'VM';
          writeCell(sheet9, r, 0, noStr);
          writeCell(sheet9, r, 1, item.seq_no || '');
          const wVal = item.pipe_width_mm ? Number(item.pipe_width_mm) : 0;
          const hVal = item.pipe_height_mm ? Number(item.pipe_height_mm) : 0;
          writeCell(sheet9, r, 2, wVal);
          writeCell(sheet9, r, 3, hVal);
          writeCell(sheet9, r, 4, item.insp_lot_no || '');

          const area = wVal > 0 && hVal > 0 ? Number(((wVal * hVal) / 1000000).toFixed(4)) : 0;
          const perimeter = wVal > 0 && hVal > 0 ? Number((((wVal + hVal) * 2) / 1000).toFixed(1)) : 0;
          writeCell(sheet9, r, 5, area);
          writeCell(sheet9, r, 6, perimeter);
          writeCell(sheet9, r, 7, 2);

          if (!isVm) {
            writeCell(sheet9, r, 8, perimeter > 0 ? Number((perimeter + 0.5).toFixed(1)) : '');
            writeCell(sheet9, r, 9, 1);
            writeCell(sheet9, r, 12, perimeter > 0 ? Number((perimeter + 0.5).toFixed(1)) : '');
            writeCell(sheet9, r, 13, 4);
          } else {
            writeCell(sheet9, r, 10, perimeter > 0 ? Number((perimeter + 0.5).toFixed(1)) : '');
            writeCell(sheet9, r, 11, 4);
          }
        });
        sheet9['!ref'] = `A1:O${startRow + items.length + 5}`;
      }
    }

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const safeFileName = encodeURIComponent(`${projectTitle}_작업지시서_${swo.swo_number}.xlsx`);
    
    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename*=UTF-8''${safeFileName}`)
      .send(excelBuffer);
  });
}

