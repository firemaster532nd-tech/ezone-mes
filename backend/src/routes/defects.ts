import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

/** DB 마이그레이션: 불량관리/폐기보고 테이블 + process_log 확장 컬럼 */
async function migrateDefects() {
  // 1. process_log 확장 컬럼 추가
  const processLogColumns = [
    { name: 'weighed_input', type: 'NUMERIC(12,2)' },       // 투입 실측무게(kg)
    { name: 'weighed_output', type: 'NUMERIC(12,2)' },      // 산출 실측무게(kg)
    { name: 'weighed_loss', type: 'NUMERIC(12,2)' },        // 로스 실측무게(kg)
    { name: 'inventory_applied', type: 'BOOLEAN DEFAULT false' }, // 재고 반영 여부
  ];
  for (const col of processLogColumns) {
    await pool.query(`ALTER TABLE process_log ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`);
  }

  // 2. defect_record 테이블
  await pool.query(`
    CREATE TABLE IF NOT EXISTS defect_record (
      defect_id SERIAL PRIMARY KEY,
      wo_id INTEGER REFERENCES work_order(wo_id),
      log_id INTEGER REFERENCES process_log(log_id),
      lot_number VARCHAR(50),
      process_code VARCHAR(10),
      defect_type VARCHAR(50) NOT NULL,
      qty NUMERIC(12,2) NOT NULL DEFAULT 1,
      unit VARCHAR(20) DEFAULT 'ea',
      weight NUMERIC(12,2),
      description TEXT,
      disposition VARCHAR(20) DEFAULT 'pending' CHECK (disposition IN ('pending','rework','scrap','downgrade')),
      disposal_report_id INTEGER,
      recorded_by INTEGER REFERENCES worker(worker_id),
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // 3. disposal_report 테이블
  await pool.query(`
    CREATE TABLE IF NOT EXISTS disposal_report (
      report_id SERIAL PRIMARY KEY,
      report_number VARCHAR(50) UNIQUE NOT NULL,
      defect_ids INTEGER[],
      total_qty NUMERIC(12,2),
      total_weight NUMERIC(12,2),
      disposal_method VARCHAR(50),
      reason TEXT,
      created_by INTEGER REFERENCES worker(worker_id),
      approved_by INTEGER REFERENCES worker(worker_id),
      status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','completed')),
      created_at TIMESTAMPTZ DEFAULT now(),
      approved_at TIMESTAMPTZ
    );
  `);

  // 4. inventory_transaction txn_type 제약조건 확장 (LOSS, SCRAP 추가)
  try {
    await pool.query(`ALTER TABLE inventory_transaction DROP CONSTRAINT IF EXISTS inventory_transaction_txn_type_check;`);
    await pool.query(`
      ALTER TABLE inventory_transaction ADD CONSTRAINT inventory_transaction_txn_type_check
        CHECK (txn_type IN ('IN','OUT','ADJ','LOSS','SCRAP'));
    `);
  } catch {
    // constraint may not exist or may already be correct
  }
}

export async function defectRoutes(app: FastifyInstance) {
  // await migrateDefects();

  // ──────────────────────────────────────────────
  // POST /api/defects — 불량 기록 생성
  // ──────────────────────────────────────────────
  app.post('/api/defects', async (request, reply) => {
    const body = request.body as {
      wo_id?: number;
      log_id?: number;
      lot_number?: string;
      process_code?: string;
      defect_type: string;
      qty?: number;
      unit?: string;
      weight?: number;
      description?: string;
      disposition?: string;
      recorded_by?: number;
    };

    if (!body.defect_type) {
      return reply.status(400).send({ error: 'Bad Request', message: 'defect_type은 필수입니다.' });
    }

    const result = await pool.query(
      `INSERT INTO defect_record
        (wo_id, log_id, lot_number, process_code, defect_type, qty, unit, weight, description, disposition, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        body.wo_id || null, body.log_id || null, body.lot_number || null,
        body.process_code || null, body.defect_type, body.qty ?? 1,
        body.unit ?? 'ea', body.weight || null, body.description || null,
        body.disposition ?? 'pending', body.recorded_by || null,
      ]
    );

    // log_id가 있으면 process_log.defect_qty도 갱신
    if (body.log_id) {
      await pool.query(
        `UPDATE process_log SET defect_qty = COALESCE(defect_qty, 0) + $2 WHERE log_id = $1`,
        [body.log_id, body.qty ?? 1]
      );
    }

    return { data: result.rows[0] };
  });

  // ──────────────────────────────────────────────
  // GET /api/defects — 불량 기록 목록 (필터)
  // ──────────────────────────────────────────────
  app.get('/api/defects', async (request) => {
    const { wo_id, process_code, disposition, log_id, lot_number } = request.query as {
      wo_id?: string;
      process_code?: string;
      disposition?: string;
      log_id?: string;
      lot_number?: string;
    };

    let query = `
      SELECT dr.*,
        w.worker_name AS recorded_by_name,
        wo.wo_number,
        pl.shift
      FROM defect_record dr
      LEFT JOIN worker w ON w.worker_id = dr.recorded_by
      LEFT JOIN work_order wo ON wo.wo_id = dr.wo_id
      LEFT JOIN process_log pl ON pl.log_id = dr.log_id
    `;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (wo_id) {
      params.push(parseInt(wo_id, 10));
      conditions.push(`dr.wo_id = $${params.length}`);
    }
    if (process_code) {
      params.push(process_code);
      conditions.push(`dr.process_code = $${params.length}`);
    }
    if (disposition) {
      params.push(disposition);
      conditions.push(`dr.disposition = $${params.length}`);
    }
    if (log_id) {
      params.push(parseInt(log_id, 10));
      conditions.push(`dr.log_id = $${params.length}`);
    }
    if (lot_number) {
      params.push(lot_number);
      conditions.push(`dr.lot_number = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY dr.created_at DESC';

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });

  // ──────────────────────────────────────────────
  // PATCH /api/defects/:id — 불량 기록 수정
  // ──────────────────────────────────────────────
  app.patch('/api/defects/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const defectId = parseInt(id, 10);
    const body = request.body as Record<string, unknown>;

    const allowedFields = [
      'defect_type', 'qty', 'unit', 'weight', 'description',
      'disposition', 'disposal_report_id', 'lot_number', 'process_code',
    ];
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        fields.push(`${field} = $${idx++}`);
        values.push(body[field]);
      }
    }

    if (fields.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: '수정할 항목이 없습니다.' });
    }

    values.push(defectId);
    const result = await pool.query(
      `UPDATE defect_record SET ${fields.join(', ')} WHERE defect_id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '불량 기록을 찾을 수 없습니다.' });
    }
    return { data: result.rows[0] };
  });

  // ══════════════════════════════════════════════
  //  Disposal Reports (폐기 보고서)
  // ══════════════════════════════════════════════

  // POST /api/disposal-reports — 폐기 보고서 생성
  app.post('/api/disposal-reports', async (request, reply) => {
    const body = request.body as {
      defect_ids?: number[];
      total_qty?: number;
      total_weight?: number;
      disposal_method?: string;
      reason?: string;
      created_by?: number;
    };

    // Auto-generate report_number: DR-YYMMDD-NNN
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const prefix = `DR-${yy}${mm}${dd}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM disposal_report WHERE report_number LIKE $1`,
      [`${prefix}-%`]
    );
    const seq = parseInt(countResult.rows[0].cnt, 10) + 1;
    const reportNumber = `${prefix}-${String(seq).padStart(3, '0')}`;

    const result = await pool.query(
      `INSERT INTO disposal_report
        (report_number, defect_ids, total_qty, total_weight, disposal_method, reason, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        reportNumber, body.defect_ids || null, body.total_qty || null,
        body.total_weight || null, body.disposal_method || null,
        body.reason || null, body.created_by || null,
      ]
    );

    // 연결된 defect_record에 disposal_report_id 업데이트
    if (body.defect_ids && body.defect_ids.length > 0) {
      await pool.query(
        `UPDATE defect_record SET disposal_report_id = $1 WHERE defect_id = ANY($2::int[])`,
        [result.rows[0].report_id, body.defect_ids]
      );
    }

    return { data: result.rows[0] };
  });

  // GET /api/disposal-reports — 폐기 보고서 목록
  app.get('/api/disposal-reports', async (request) => {
    const { status } = request.query as { status?: string };

    let query = `
      SELECT dr.*,
        w1.worker_name AS created_by_name,
        w2.worker_name AS approved_by_name
      FROM disposal_report dr
      LEFT JOIN worker w1 ON w1.worker_id = dr.created_by
      LEFT JOIN worker w2 ON w2.worker_id = dr.approved_by
    `;
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      query += ` WHERE dr.status = $${params.length}`;
    }

    query += ' ORDER BY dr.created_at DESC';

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });

  // GET /api/disposal-reports/:id — 폐기 보고서 상세 (연결된 불량 포함)
  app.get('/api/disposal-reports/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const reportId = parseInt(id, 10);

    const reportResult = await pool.query(`
      SELECT dr.*,
        w1.worker_name AS created_by_name,
        w2.worker_name AS approved_by_name
      FROM disposal_report dr
      LEFT JOIN worker w1 ON w1.worker_id = dr.created_by
      LEFT JOIN worker w2 ON w2.worker_id = dr.approved_by
      WHERE dr.report_id = $1
    `, [reportId]);

    if (reportResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '폐기 보고서를 찾을 수 없습니다.' });
    }

    // 연결된 불량 기록 조회
    const defectsResult = await pool.query(`
      SELECT dr.*, w.worker_name AS recorded_by_name
      FROM defect_record dr
      LEFT JOIN worker w ON w.worker_id = dr.recorded_by
      WHERE dr.disposal_report_id = $1
      ORDER BY dr.created_at DESC
    `, [reportId]);

    return {
      data: {
        ...reportResult.rows[0],
        defects: defectsResult.rows,
      },
    };
  });

  // PATCH /api/disposal-reports/:id — 폐기 보고서 상태 변경
  app.patch('/api/disposal-reports/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const reportId = parseInt(id, 10);
    const body = request.body as Record<string, unknown>;

    const allowedFields = [
      'status', 'approved_by', 'disposal_method', 'reason',
      'total_qty', 'total_weight', 'defect_ids',
    ];
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        fields.push(`${field} = $${idx++}`);
        values.push(body[field]);
      }
    }

    // status가 approved면 approved_at 자동 설정
    if (body.status === 'approved') {
      fields.push(`approved_at = NOW()`);
    }

    if (fields.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: '수정할 항목이 없습니다.' });
    }

    values.push(reportId);
    const result = await pool.query(
      `UPDATE disposal_report SET ${fields.join(', ')} WHERE report_id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '폐기 보고서를 찾을 수 없습니다.' });
    }

    // status가 completed이고 연결된 defect가 있으면 disposition을 scrap으로 변경
    if (body.status === 'completed') {
      const report = result.rows[0];
      if (report.defect_ids && report.defect_ids.length > 0) {
        await pool.query(
          `UPDATE defect_record SET disposition = 'scrap' WHERE defect_id = ANY($1::int[]) AND disposition = 'pending'`,
          [report.defect_ids]
        );
      }
    }

    return { data: result.rows[0] };
  });
}
