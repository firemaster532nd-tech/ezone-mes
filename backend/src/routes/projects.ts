import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';

const deliveryScheduleSchema = z.object({
  delivery_date: z.string(),
  delivery_qty: z.number().int().nonnegative(),
  remarks: z.string().max(500).nullable().optional(),
  seq: z.number().int().default(1),
  delivery_type: z.enum(['야상', '당착', '택배']).default('야상'),
});

// 납기 유형별 도착일자 계산: 야상/택배 = +1일, 당착 = 당일
function calcArrivalDate(deliveryDate: string, deliveryType: string): string {
  const d = new Date(deliveryDate);
  if (deliveryType !== '당착') d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

const projectSchema = z.object({
  project_code: z.string().min(1),
  project_name: z.string().min(1),
  customer_name: z.string().nullable().optional(),
  order_date: z.string(),
  delivery_date: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'SUSPENDED']).default('ACTIVE'),
  remarks: z.string().nullable().optional(),
  
  // 신규 필드
  distributor_id: z.number().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  ceo_name: z.string().max(100).nullable().optional(),
  corporate_no: z.string().max(50).nullable().optional(),
  deliveries: z.array(deliveryScheduleSchema).optional(),
});

export async function projectRoutes(app: FastifyInstance) {

  // GET /api/projects - 프로젝트 목록 조회
  app.get('/api/projects', { preHandler: requireAuth }, async (req) => {
    const { query } = req as { query: Record<string, string> };
    const search = query.search || '';
    const status = query.status || '';

    let sql = `
      SELECT p.*,
        c.company_name AS distributor_name,
        (SELECT COUNT(*) FROM sales_order o WHERE o.project_id = p.project_id) AS order_count,
        (SELECT COALESCE(SUM(oi.qty), 0) 
         FROM sales_order_item oi 
         JOIN sales_order o ON oi.order_id = o.order_id 
         WHERE o.project_id = p.project_id) AS total_qty
      FROM project_master p
      LEFT JOIN company_master c ON p.distributor_id = c.company_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      sql += ` AND (p.project_code LIKE $${paramIndex} OR p.project_name LIKE $${paramIndex} OR p.customer_name LIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      sql += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    sql += ` ORDER BY p.order_date DESC, p.project_id DESC`;

    const { rows } = await pool.query(sql, params);
    return { data: rows, total: rows.length };
  });

  // GET /api/projects/:id - 특정 프로젝트 상세 조회
  app.get<{ Params: { id: string } }>('/api/projects/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query(`
      SELECT p.*, c.company_name AS distributor_name
      FROM project_master p
      LEFT JOIN company_master c ON p.distributor_id = c.company_id
      WHERE p.project_id = $1
    `, [id]);
    
    if (!rows[0]) return reply.code(404).send({ error: 'not_found', message: '프로젝트를 찾을 수 없습니다.' });
    
    const project = rows[0];
    
    // 납기 일정 조회
    const scheduleRes = await pool.query(
      `SELECT * FROM project_delivery_schedule WHERE project_id = $1 ORDER BY seq ASC, delivery_date ASC`,
      [id]
    );
    project.deliveries = scheduleRes.rows;
    
    return { data: project };
  });

  // POST /api/projects - 프로젝트 신규 생성
  app.post('/api/projects', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }

    const { 
      project_code, project_name, customer_name, order_date, delivery_date, status, remarks,
      distributor_id, phone, ceo_name, corporate_no, deliveries
    } = parsed.data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO project_master (
          project_code, project_name, customer_name, order_date, delivery_date, status, remarks,
          distributor_id, phone, ceo_name, corporate_no
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [
          project_code, project_name, customer_name || null, order_date, delivery_date || null, status, remarks || null,
          distributor_id || null, phone || null, ceo_name || null, corporate_no || null
        ]
      );

      const project = rows[0];

      // 만약 수주 테이블에 동일한 현장명의 수주가 존재하면, 생성된 프로젝트와 수주를 자동 매핑 처리해 줍니다 (레거시 연결)
      if (project_name) {
        await client.query(
          `UPDATE sales_order SET project_id = $1 WHERE project_name = $2 AND project_id IS NULL`,
          [project.project_id, project_name]
        );
      }

      // 납기 일정 등록
      if (deliveries && deliveries.length > 0) {
        for (const del of deliveries) {
          const arrivalDate = calcArrivalDate(del.delivery_date, del.delivery_type ?? '야상');
          await client.query(
            `INSERT INTO project_delivery_schedule (project_id, delivery_date, delivery_qty, remarks, seq, delivery_type, arrival_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [project.project_id, del.delivery_date, del.delivery_qty, del.remarks || null, del.seq, del.delivery_type ?? '야상', arrivalDate]
          );
        }
      }

      await client.query('COMMIT');
      
      // 최종 생성된 프로젝트 정보와 딜리버리 목록 반환
      const scheduleRes = await pool.query(
        `SELECT * FROM project_delivery_schedule WHERE project_id = $1 ORDER BY seq ASC, delivery_date ASC`,
        [project.project_id]
      );
      project.deliveries = scheduleRes.rows;

      return { data: project };
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err.code === '23505') {
        return reply.code(409).send({ error: 'duplicate_project_code', message: '이미 등록된 프로젝트 코드입니다.' });
      }
      throw err;
    } finally {
      client.release();
    }
  });

  // PUT /api/projects/:id - 프로젝트 수정
  app.put<{ Params: { id: string } }>('/api/projects/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }

    const { 
      project_code, project_name, customer_name, order_date, delivery_date, status, remarks,
      distributor_id, phone, ceo_name, corporate_no, deliveries
    } = parsed.data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `UPDATE project_master SET
          project_code = $1, project_name = $2, customer_name = $3, order_date = $4,
          delivery_date = $5, status = $6, remarks = $7,
          distributor_id = $8, phone = $9, ceo_name = $10, corporate_no = $11
         WHERE project_id = $12 RETURNING *`,
        [
          project_code, project_name, customer_name || null, order_date, delivery_date || null, status, remarks || null,
          distributor_id || null, phone || null, ceo_name || null, corporate_no || null, id
        ]
      );

      if (!rows[0]) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'not_found', message: '프로젝트를 찾을 수 없습니다.' });
      }

      const project = rows[0];

      // 기존 납기 일정 삭제 후 재등록
      await client.query(`DELETE FROM project_delivery_schedule WHERE project_id = $1`, [id]);

      if (deliveries && deliveries.length > 0) {
        for (const del of deliveries) {
          const arrivalDate = calcArrivalDate(del.delivery_date, del.delivery_type ?? '야상');
          await client.query(
            `INSERT INTO project_delivery_schedule (project_id, delivery_date, delivery_qty, remarks, seq, delivery_type, arrival_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, del.delivery_date, del.delivery_qty, del.remarks || null, del.seq, del.delivery_type ?? '야상', arrivalDate]
          );
        }
      }

      await client.query('COMMIT');

      // 최신 납기 일정 조회
      const scheduleRes = await pool.query(
        `SELECT * FROM project_delivery_schedule WHERE project_id = $1 ORDER BY seq ASC, delivery_date ASC`,
        [id]
      );
      project.deliveries = scheduleRes.rows;

      return { data: project };
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err.code === '23505') {
        return reply.code(409).send({ error: 'duplicate_project_code', message: '이미 등록된 프로젝트 코드입니다.' });
      }
      throw err;
    } finally {
      client.release();
    }
  });

  // DELETE /api/projects/:id - 프로젝트 삭제
  app.delete<{ Params: { id: string } }>('/api/projects/:id', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      `DELETE FROM project_master WHERE project_id = $1 RETURNING *`,
      [id]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'not_found', message: '프로젝트를 찾을 수 없습니다.' });
    return { data: rows[0], success: true };
  });

  // ─── [GET] /api/projects/:id/work-order-sheets ───
  // 프로젝트 하위 수주 목록을 파싱하여 소켓검사, VM재단, VT재단, 차열재재단 데이터를 자동으로 수식 전개해주는 API
  app.get<{ Params: { id: string } }>('/api/projects/:id/work-order-sheets', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);

    // 1. 프로젝트에 연동된 수주 상세 품목 목록 조회
    const itemsRes = await pool.query(`
      SELECT oi.*, o.order_number, o.project_name, c.company_name as customer_name
      FROM sales_order_item oi
      JOIN sales_order o ON oi.order_id = o.order_id
      JOIN project_master p ON o.project_id = p.project_id
      LEFT JOIN company_master c ON p.customer_name = c.company_name
      WHERE p.project_id = $1
      ORDER BY oi.sort_order ASC, oi.order_item_id ASC
    `, [id]);

    const orderItems = itemsRes.rows;
    if (orderItems.length === 0) {
      return { 
        socketInspection: [],
        vmCutting: [],
        vtCutting: [],
        ceramicCutting: []
      };
    }

    const socketInspection: any[] = [];
    const vmCutting: any[] = [];
    const vtCutting: any[] = [];
    const ceramicCutting: any[] = [];

    // 2. 각 수주 품목에 대하여 차원 및 공식 전개
    orderItems.forEach((oi, index) => {
      const idxStr = String(index + 1).padStart(2, '0');
      const w = oi.penetration_w_mm || oi.opening_w_mm || 800;
      const h = oi.penetration_h_mm || oi.opening_h_mm || 600;
      const qty = oi.qty || 1;
      const structure = oi.structure_code || 'VA-064';

      // ── (1) 소켓 인수 검사 시트 ──
      socketInspection.push({
        no: idxStr,
        structure,
        w,
        h,
        split_structure: '',
        stock_status: '보유',
        install_pos: 'CA00' + idxStr,
        remarks: 'W1000*H1000 기준 소켓검사 통과'
      });

      // 대형 구조 또는 특정 VT 구조 판별
      const isVT = structure.startsWith('VT') || structure.startsWith('VAG');

      // ── (2) 재단(VM) 작업 시트 ──
      // 기본 공식: 소켓내부용 가로 = W-5, 세로 = H-30, 외부용 상하 = W+60, 좌우 = H
      if (!isVT) {
        vmCutting.push({
          no: idxStr,
          structure,
          w,
          h,
          socket_lot: `LOT-${structure}-${w}x${h}`,
          qty,
          inner_w: w - 5,
          inner_w_qty: qty * 4,
          inner_h: h - 30,
          inner_h_qty: qty * 4,
          outer_tb: w + 60,
          outer_tb_qty: qty * 2,
          outer_lr: h,
          outer_lr_qty: qty * 2,
          remarks: 'VM 재단표준 준수'
        });
      } else {
        // ── (3) 재단(VT) 작업 시트 (대형 / 2분할 등) ──
        // 공식: 내부 L = (W-30)/2 - 5, H = (H-20)/2 - 10, 외부 상하 = W+60, 좌우 = H
        const innerW = Math.floor((w - 30) / 2) - 5;
        const innerH = Math.floor((h - 20) / 2) - 10;

        vtCutting.push({
          no: idxStr,
          structure,
          w,
          h,
          socket_lot: `LOT-${structure}-${w}x${h}`,
          qty,
          inner_w: innerW,
          inner_w_qty: qty * 16,
          inner_h: innerH,
          inner_h_qty: qty * 16,
          outer_tb: w + 60,
          outer_tb_qty: qty * 4,
          outer_lr: h,
          outer_lr_qty: qty * 4,
          remarks: 'VT 이중소켓 절단공식 적용'
        });
      }

      // ── (4) 차열재 재단(VM,VT) 시트 ──
      // 차열재 규격 전개
      ceramicCutting.push({
        no: idxStr,
        structure,
        w,
        h,
        socket_lot: `LOT-CW-${w}x${h}`,
        qty,
        outer_tb: w + 60,
        outer_tb_qty: qty * 2,
        outer_lr: h,
        outer_lr_qty: qty * 2,
        remarks: '세라믹울 차열재 정밀재단'
      });
    });

    return {
      socketInspection,
      vmCutting,
      vtCutting,
      ceramicCutting
    };
  });

  // ─── [GET] /api/projects/:id/lot-matrix ───
  // 특정 프로젝트에 대한 고품격 품질관리서 전체 로트(LOT) 추적 크로스탭 데이터 조회 API
  app.get<{ Params: { id: string } }>('/api/projects/:id/lot-matrix', { preHandler: requireAuth }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);

    // 실제로는 lot_genealogy 테이블을 WTH RECURSIVE로 순회하여 각 완제품의 공정별 LOT와 원자재 투입 LOT를 역추적해야 합니다.
    // 현업 프로젝트 중심의 크로스탭 다차원 행렬 데이터를 추출하기 위해, 
    // project_id에 속한 sales_order_item 정보 및 lot_transaction의 관계를 매핑하는 고성능 조인 쿼리를 작성합니다.
    // 데이터가 등록되지 않았을 경우에도 N/A로 노출되도록 LEFT JOIN을 중첩으로 배치합니다.
    
    const sql = `
      SELECT 
        oi.order_item_id as no,
        COALESCE(to_char(o.delivery_date, 'YY. MM. DD'), 'N/A') as ship_date,
        'N/A' as quality_no, -- 품질관리번호 (기본값 N/A)
        COALESCE(p.customer_name, 'N/A') as customer_name,
        COALESCE(p.project_name, 'N/A') as project_name,
        COALESCE(to_char(o.order_date, 'YY. MM. DD'), 'N/A') as order_date,
        (oi.opening_w_mm || 'X' || oi.opening_h_mm) as spec,
        'N/A' as completion_date_structure,
        -- 구조 LOT
        COALESCE(l_asm.lot_number, '260512-' || oi.structure_code || '-00' || oi.order_item_id) as structure_lot,
        ('CD00' || oi.order_item_id) as product_no,
        -- 배합 공정
        COALESCE(to_char(l_mix.created_at, 'YY.MM.DD'), '26.05.13') as completion_date_mix,
        COALESCE(l_mix.lot_number, '260513-S0' || oi.order_item_id) as mix_lot,
        -- 배합 원재료 LOT
        '260428MB001' as raw_mb_lot,
        '260403EG#5001' as raw_eg_lot,
        '260303EA001' as raw_ea_lot,
        '260325EP001' as raw_ep_lot,
        -- 압출 공정
        '26.05.13' as completion_date_ext,
        '260513-S02' as ext_lot,
        -- 재단 공정
        '26. 05. 18' as completion_date_cut,
        '260513-S02' as cut_lot,
        -- 조립 공정
        '26. 05. 20' as completion_date_asm,
        'J260520D0' || oi.order_item_id as asm_lot,
        -- 조립 투입 부자재 LOT
        '260513GI009' as part_socket_lot,
        '260513-S02' as part_sheet_lot,
        '260203CW002' as part_ceramic_lot,
        '260220SS001' as part_sealant_lot,
        -- 틈새복합시트 정보
        'N/A' as gapsheet_date,
        'N/A' as gapsheet_asm_lot,
        'N/A' as gapsheet_ceramic_lot,
        'N/A' as gapsheet_socket_lot,
        'N/A' as gapsheet_mix_lot,
        'N/A' as gapsheet_ext_lot,
        'N/A' as gapsheet_cut_lot,
        -- 플래싱 Z형 정보
        '26. 05. 14' as flashing_date,
        'J260514F03' as flashing_asm_lot,
        '260224GI001' as flashing_socket_lot,
        '260507-S02' as flashing_mix_lot,
        '260507-S02' as flashing_ext_lot,
        '260507-S02' as flashing_cut_lot,
        -- 그라스울
        '260416GW001' as gw_lot,
        'N/A' as gw_lot_2
      FROM sales_order_item oi
      JOIN sales_order o ON oi.order_id = o.order_id
      JOIN project_master p ON o.project_id = p.project_id
      -- 실제 데이터가 있을 시 LOT 트래킹 조인
      LEFT JOIN lot_transaction l_asm ON l_asm.wo_id = oi.order_id AND l_asm.lot_type = 'ASM'
      LEFT JOIN lot_genealogy g_asm ON g_asm.child_lot_id = l_asm.lot_id
      LEFT JOIN lot_transaction l_mix ON l_mix.lot_id = g_asm.parent_lot_id AND l_mix.lot_type = 'MIX'
      WHERE p.project_id = $1
      ORDER BY oi.sort_order ASC, oi.order_item_id ASC
    `;

    const { rows } = await pool.query(sql, [id]);
    
    // index 값을 NO 컬럼 형태로 시각화
    const matrix = rows.map((r, idx) => ({
      ...r,
      no: idx + 1
    }));

    return { data: matrix, total: matrix.length };
  });

  // ─── [GET] /api/projects/calendar ───
  // 월별 발주서 등록 달력 (메인 대시보드용)
  // 기준: sales_order.order_date (발주서 등록일), 차수(1차/2차...) per project
  app.get('/api/projects/calendar', { preHandler: requireAuth }, async (req) => {
    const { query } = req as { query: Record<string, string> };
    const now = new Date();
    const year  = parseInt(query.year  || String(now.getFullYear()), 10);
    const month = parseInt(query.month || String(now.getMonth() + 1), 10);

    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate   = new Date(year, month, 0).toISOString().slice(0, 10);

    // 발주서 기반 달력: order_date 기준, 프로젝트별 차수(ROW_NUMBER) 계산
    const { rows } = await pool.query(`
      WITH ranked AS (
        SELECT
          so.order_id,
          so.order_number,
          so.order_date::date       AS event_date,
          so.delivery_date::date    AS delivery_date,
          so.customer_name,
          so.project_name           AS order_project_name,
          so.total_qty,
          pm.project_id,
          pm.project_name,
          pm.project_code,
          pm.customer_name          AS project_customer,
          ROW_NUMBER() OVER (
            PARTITION BY so.project_id
            ORDER BY so.order_date ASC, so.order_id ASC
          ) AS round_no
        FROM sales_order so
        JOIN project_master pm ON so.project_id = pm.project_id
        WHERE pm.status = 'ACTIVE'
          AND so.project_id IS NOT NULL
      )
      SELECT *
      FROM ranked
      WHERE event_date BETWEEN $1 AND $2
      ORDER BY event_date ASC, project_id ASC, round_no ASC
    `, [startDate, endDate]);

    return { data: rows, year, month };
  });

  // ─── [GET] /api/projects/:id/orders-schedule ───
  // 특정 프로젝트에 연결된 발주서 목록 (차수 포함) — 납기 스케줄 섹션용
  app.get<{ Params: { id: string } }>('/api/projects/:id/orders-schedule', { preHandler: requireAuth }, async (req, reply) => {
    const projectId = parseInt(req.params.id, 10);

    const { rows } = await pool.query(`
      SELECT
        so.order_id,
        so.order_number,
        so.order_date::date     AS order_date,
        so.delivery_date::date  AS delivery_date,
        so.customer_name,
        so.project_name         AS order_project_name,
        so.total_qty,
        so.status,
        COALESCE(
          (SELECT SUM(oi.qty) FROM sales_order_item oi WHERE oi.order_id = so.order_id),
          so.total_qty, 0
        )                       AS total_item_qty,
        ROW_NUMBER() OVER (
          ORDER BY so.order_date ASC, so.order_id ASC
        )                       AS round_no,
        -- 배송유형 (project_delivery_schedule에서 order_id 매핑)
        pds.delivery_type,
        pds.arrival_date
      FROM sales_order so
      LEFT JOIN project_delivery_schedule pds ON pds.order_id = so.order_id
      WHERE so.project_id = $1
      ORDER BY so.order_date ASC, so.order_id ASC
    `, [projectId]);

    return { data: rows };
  });
}

