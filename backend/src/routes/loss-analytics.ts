import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { kgToMeters } from './lot-properties.js';

/** DB 마이그레이션: process_issue 테이블 */
async function migrateProcessIssue() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS process_issue (
      issue_id SERIAL PRIMARY KEY,
      log_id INTEGER REFERENCES process_log(log_id),
      wo_id INTEGER REFERENCES work_order(wo_id),
      process_code VARCHAR(10) NOT NULL,
      lot_number VARCHAR(50),
      issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
      issue_type VARCHAR(50) NOT NULL,
      severity VARCHAR(20) DEFAULT 'minor' CHECK (severity IN ('minor','major','critical')),
      description TEXT NOT NULL,
      root_cause TEXT,
      corrective_action TEXT,
      loss_impact_kg NUMERIC(12,2),
      recorded_by INTEGER REFERENCES worker(worker_id),
      resolved BOOLEAN DEFAULT false,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
}

export async function lossAnalyticsRoutes(app: FastifyInstance) {
  await migrateProcessIssue();

  // ═══════════════════════════════════════
  // Loss Analytics Endpoints
  // ═══════════════════════════════════════

  /**
   * GET /api/loss-analytics/daily?date=2026-03-29&process_code=EXT
   * 일일 로스 데이터 (LOT별)
   */
  app.get('/api/loss-analytics/daily', async (request) => {
    const { date, process_code } = request.query as { date?: string; process_code?: string };
    const targetDate = date || new Date().toISOString().slice(0, 10);

    let query = `
      SELECT pl.log_id, pl.process_code, pl.weighed_input, pl.weighed_output,
             pl.weighed_loss, pl.loss_rate, pl.produced_qty, pl.started_at,
             pl.actual_input_qty, pl.loss_qty,
             wo.wo_number, wo.wo_id,
             (SELECT lt2.lot_number FROM lot_transaction lt2 WHERE lt2.wo_id = wo.wo_id LIMIT 1) as lot_number
      FROM process_log pl
      LEFT JOIN work_order wo ON wo.wo_id = pl.wo_id
      WHERE DATE(pl.started_at) = $1
        AND (pl.weighed_loss > 0 OR pl.loss_rate > 0 OR pl.weighed_input > 0)
    `;
    const params: unknown[] = [targetDate];

    if (process_code) {
      params.push(process_code);
      query += ` AND pl.process_code = $${params.length}`;
    }
    query += ' ORDER BY pl.started_at';

    const result = await pool.query(query, params);
    return { data: result.rows };
  });

  /**
   * GET /api/loss-analytics/monthly?year=2026&month=3&process_code=
   * 월간 로스 요약 (공정별 + 일별)
   */
  app.get('/api/loss-analytics/monthly', async (request) => {
    const q = request.query as { year?: string; month?: string; process_code?: string };
    const now = new Date();
    const year = parseInt(q.year || String(now.getFullYear()));
    const month = parseInt(q.month || String(now.getMonth() + 1));
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().slice(0, 10);

    const processFilter = q.process_code || null;

    // 공정별 요약
    let summaryQuery = `
      SELECT pl.process_code,
        COUNT(*) as batch_count,
        COALESCE(SUM(pl.weighed_input), 0) as total_input_kg,
        COALESCE(SUM(pl.weighed_output), 0) as total_output_kg,
        COALESCE(SUM(pl.weighed_loss), 0) as total_loss_kg,
        ROUND(AVG(pl.loss_rate)::numeric, 2) as avg_loss_rate,
        ROUND(MAX(pl.loss_rate)::numeric, 2) as max_loss_rate,
        ROUND(MIN(NULLIF(pl.loss_rate, 0))::numeric, 2) as min_loss_rate
      FROM process_log pl
      WHERE pl.started_at::date BETWEEN $1 AND $2
        AND pl.status = 'COMPLETED'
        AND (pl.weighed_input > 0 OR pl.loss_rate > 0)
    `;
    const summaryParams: unknown[] = [startDate, endDate];
    if (processFilter) {
      summaryParams.push(processFilter);
      summaryQuery += ` AND pl.process_code = $${summaryParams.length}`;
    }
    summaryQuery += ' GROUP BY pl.process_code ORDER BY pl.process_code';

    // 일별 분석
    let dailyQuery = `
      SELECT pl.started_at::date as date, pl.process_code,
        COALESCE(SUM(pl.weighed_input), 0) as input_kg,
        COALESCE(SUM(pl.weighed_output), 0) as output_kg,
        COALESCE(SUM(pl.weighed_loss), 0) as loss_kg,
        ROUND(AVG(pl.loss_rate)::numeric, 2) as loss_rate,
        COUNT(*) as batch_count
      FROM process_log pl
      WHERE pl.started_at::date BETWEEN $1 AND $2
        AND pl.status = 'COMPLETED'
        AND (pl.weighed_input > 0 OR pl.loss_rate > 0)
    `;
    const dailyParams: unknown[] = [startDate, endDate];
    if (processFilter) {
      dailyParams.push(processFilter);
      dailyQuery += ` AND pl.process_code = $${dailyParams.length}`;
    }
    dailyQuery += ' GROUP BY pl.started_at::date, pl.process_code ORDER BY date, pl.process_code';

    const [summaryResult, dailyResult] = await Promise.all([
      pool.query(summaryQuery, summaryParams),
      pool.query(dailyQuery, dailyParams),
    ]);

    // Worst / Best day calculation
    const dailyByDate = dailyResult.rows.reduce((acc: Record<string, { loss_rate: number; date: string }>, row: any) => {
      const d = row.date?.toISOString?.() ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10);
      if (!acc[d] || parseFloat(row.loss_rate) > acc[d].loss_rate) {
        acc[d] = { loss_rate: parseFloat(row.loss_rate), date: d };
      }
      return acc;
    }, {});

    const dateEntries = Object.values(dailyByDate) as { loss_rate: number; date: string }[];
    const worst_day = dateEntries.length > 0 ? dateEntries.reduce((a, b) => a.loss_rate > b.loss_rate ? a : b) : null;
    const best_day = dateEntries.length > 0 ? dateEntries.reduce((a, b) => a.loss_rate < b.loss_rate ? a : b) : null;

    return {
      data: {
        period: { year, month, start: startDate, end: endDate },
        by_process: summaryResult.rows,
        daily_breakdown: dailyResult.rows,
        worst_day,
        best_day,
      },
    };
  });

  /**
   * GET /api/loss-analytics/trend?months=6&process_code=EXT
   * 로스 추이 (N개월)
   */
  app.get('/api/loss-analytics/trend', async (request) => {
    const { months, process_code } = request.query as { months?: string; process_code?: string };
    const numMonths = parseInt(months || '6');

    let query = `
      SELECT
        DATE_TRUNC('month', pl.started_at)::date as month,
        pl.process_code,
        ROUND(AVG(pl.loss_rate)::numeric, 2) as avg_loss_rate,
        COALESCE(SUM(pl.weighed_loss), 0) as total_loss_kg,
        COUNT(*) as batch_count
      FROM process_log pl
      WHERE pl.started_at >= NOW() - ($1 || ' months')::interval
        AND pl.status = 'COMPLETED'
        AND (pl.weighed_input > 0 OR pl.loss_rate > 0)
    `;
    const params: unknown[] = [numMonths.toString()];
    if (process_code) {
      params.push(process_code);
      query += ` AND pl.process_code = $${params.length}`;
    }
    query += ' GROUP BY month, pl.process_code ORDER BY month, pl.process_code';

    const result = await pool.query(query, params);
    return { data: result.rows };
  });

  /**
   * GET /api/loss-analytics/lot-detail/:logId
   * LOT별 로스 상세 (관련 이슈 포함)
   */
  app.get('/api/loss-analytics/lot-detail/:logId', async (request, reply) => {
    const { logId } = request.params as { logId: string };
    const id = parseInt(logId, 10);

    const logResult = await pool.query(`
      SELECT pl.*, w.worker_name, wo.wo_number, wo.wo_date,
             pb.bom_name, pb.loss_rate as bom_loss_rate
      FROM process_log pl
      LEFT JOIN worker w ON w.worker_id = pl.worker_id
      LEFT JOIN work_order wo ON wo.wo_id = pl.wo_id
      LEFT JOIN process_bom pb ON pb.bom_id = pl.bom_id
      WHERE pl.log_id = $1
    `, [id]);

    if (logResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found' });
    }

    const issuesResult = await pool.query(`
      SELECT pi.*, w.worker_name as recorded_by_name
      FROM process_issue pi
      LEFT JOIN worker w ON w.worker_id = pi.recorded_by
      WHERE pi.log_id = $1
      ORDER BY pi.created_at
    `, [id]);

    return {
      data: {
        ...logResult.rows[0],
        issues: issuesResult.rows,
      },
    };
  });

  // ═══════════════════════════════════════
  // Process Issues CRUD
  // ═══════════════════════════════════════

  /**
   * POST /api/process-issues
   */
  app.post('/api/process-issues', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const {
      log_id, wo_id, process_code, lot_number, issue_date,
      issue_type, severity, description, root_cause,
      corrective_action, loss_impact_kg, recorded_by,
    } = body;

    if (!process_code || !issue_type || !description) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'process_code, issue_type, description은 필수입니다.',
      });
    }

    const result = await pool.query(`
      INSERT INTO process_issue
        (log_id, wo_id, process_code, lot_number, issue_date, issue_type,
         severity, description, root_cause, corrective_action, loss_impact_kg, recorded_by)
      VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE), $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      log_id || null, wo_id || null, process_code, lot_number || null,
      issue_date || null, issue_type, severity || 'minor', description,
      root_cause || null, corrective_action || null,
      loss_impact_kg || null, recorded_by || null,
    ]);

    return { data: result.rows[0] };
  });

  /**
   * GET /api/process-issues
   */
  app.get('/api/process-issues', async (request) => {
    const { process_code, date_from, date_to, resolved, severity } = request.query as {
      process_code?: string; date_from?: string; date_to?: string;
      resolved?: string; severity?: string;
    };

    let query = `
      SELECT pi.*, w.worker_name as recorded_by_name
      FROM process_issue pi
      LEFT JOIN worker w ON w.worker_id = pi.recorded_by
    `;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (process_code) {
      params.push(process_code);
      conditions.push(`pi.process_code = $${params.length}`);
    }
    if (date_from) {
      params.push(date_from);
      conditions.push(`pi.issue_date >= $${params.length}::date`);
    }
    if (date_to) {
      params.push(date_to);
      conditions.push(`pi.issue_date <= $${params.length}::date`);
    }
    if (resolved !== undefined && resolved !== '') {
      params.push(resolved === 'true');
      conditions.push(`pi.resolved = $${params.length}`);
    }
    if (severity) {
      params.push(severity);
      conditions.push(`pi.severity = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY pi.issue_date DESC, pi.created_at DESC';

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });

  /**
   * PATCH /api/process-issues/:id
   */
  app.patch('/api/process-issues/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const issueId = parseInt(id, 10);
    const body = request.body as Record<string, unknown>;

    const updates: string[] = [];
    const values: unknown[] = [];

    if ('root_cause' in body) {
      values.push(body.root_cause);
      updates.push(`root_cause = $${values.length}`);
    }
    if ('corrective_action' in body) {
      values.push(body.corrective_action);
      updates.push(`corrective_action = $${values.length}`);
    }
    if ('resolved' in body) {
      values.push(body.resolved);
      updates.push(`resolved = $${values.length}`);
      if (body.resolved === true) {
        updates.push(`resolved_at = NOW()`);
      }
    }
    if ('description' in body) {
      values.push(body.description);
      updates.push(`description = $${values.length}`);
    }
    if ('severity' in body) {
      values.push(body.severity);
      updates.push(`severity = $${values.length}`);
    }
    if ('loss_impact_kg' in body) {
      values.push(body.loss_impact_kg);
      updates.push(`loss_impact_kg = $${values.length}`);
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: '수정할 항목이 없습니다.' });
    }

    values.push(issueId);
    const result = await pool.query(
      `UPDATE process_issue SET ${updates.join(', ')} WHERE issue_id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found' });
    }
    return { data: result.rows[0] };
  });

  /**
   * GET /api/process-issues/summary?year=2026&month=3
   */
  app.get('/api/process-issues/summary', async (request) => {
    const q = request.query as { year?: string; month?: string };
    const now = new Date();
    const year = parseInt(q.year || String(now.getFullYear()));
    const month = parseInt(q.month || String(now.getMonth() + 1));
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().slice(0, 10);

    const [byType, bySeverity, byProcess, totals] = await Promise.all([
      pool.query(`
        SELECT issue_type, COUNT(*) as count
        FROM process_issue WHERE issue_date BETWEEN $1 AND $2
        GROUP BY issue_type ORDER BY count DESC
      `, [startDate, endDate]),
      pool.query(`
        SELECT severity, COUNT(*) as count
        FROM process_issue WHERE issue_date BETWEEN $1 AND $2
        GROUP BY severity
      `, [startDate, endDate]),
      pool.query(`
        SELECT process_code, COUNT(*) as count
        FROM process_issue WHERE issue_date BETWEEN $1 AND $2
        GROUP BY process_code ORDER BY count DESC
      `, [startDate, endDate]),
      pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE resolved = false) as unresolved,
          COALESCE(SUM(loss_impact_kg), 0) as total_loss_impact_kg
        FROM process_issue WHERE issue_date BETWEEN $1 AND $2
      `, [startDate, endDate]),
    ]);

    return {
      data: {
        by_type: byType.rows,
        by_severity: bySeverity.rows,
        by_process: byProcess.rows,
        total: parseInt(totals.rows[0]?.total) || 0,
        unresolved: parseInt(totals.rows[0]?.unresolved) || 0,
        total_loss_impact_kg: parseFloat(totals.rows[0]?.total_loss_impact_kg) || 0,
      },
    };
  });

  // ═══════════════════════════════════════
  // Monthly Loss Report (comprehensive)
  // ═══════════════════════════════════════

  /**
   * GET /api/reports/monthly-loss?year=2026&month=3
   */
  app.get('/api/reports/monthly-loss', async (request) => {
    const q = request.query as { year?: string; month?: string };
    const now = new Date();
    const year = parseInt(q.year || String(now.getFullYear()));
    const month = parseInt(q.month || String(now.getMonth() + 1));
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().slice(0, 10);

    // 1. Summary
    const overallResult = await pool.query(`
      SELECT
        COUNT(*) as total_batches,
        COALESCE(SUM(pl.weighed_input), 0) as total_input_kg,
        COALESCE(SUM(pl.weighed_output), 0) as total_output_kg,
        COALESCE(SUM(pl.weighed_loss), 0) as total_loss_kg,
        ROUND(
          CASE WHEN SUM(pl.weighed_input) > 0
            THEN (SUM(pl.weighed_loss) / SUM(pl.weighed_input) * 100)
            ELSE 0
          END::numeric, 2
        ) as overall_loss_rate
      FROM process_log pl
      WHERE pl.started_at::date BETWEEN $1 AND $2
        AND pl.status = 'COMPLETED'
        AND (pl.weighed_input > 0 OR pl.loss_rate > 0)
    `, [startDate, endDate]);

    const byProcessResult = await pool.query(`
      SELECT pl.process_code,
        COUNT(*) as batches,
        COALESCE(SUM(pl.weighed_input), 0) as input_kg,
        COALESCE(SUM(pl.weighed_output), 0) as output_kg,
        COALESCE(SUM(pl.weighed_loss), 0) as loss_kg,
        ROUND(
          CASE WHEN SUM(pl.weighed_input) > 0
            THEN (SUM(pl.weighed_loss) / SUM(pl.weighed_input) * 100)
            ELSE 0
          END::numeric, 2
        ) as loss_rate
      FROM process_log pl
      WHERE pl.started_at::date BETWEEN $1 AND $2
        AND pl.status = 'COMPLETED'
        AND (pl.weighed_input > 0 OR pl.loss_rate > 0)
      GROUP BY pl.process_code ORDER BY pl.process_code
    `, [startDate, endDate]);

    // 2. Daily trend
    const dailyTrend = await pool.query(`
      SELECT pl.started_at::date as date, pl.process_code,
        COALESCE(SUM(pl.weighed_input), 0) as input_kg,
        COALESCE(SUM(pl.weighed_output), 0) as output_kg,
        COALESCE(SUM(pl.weighed_loss), 0) as loss_kg,
        ROUND(
          CASE WHEN SUM(pl.weighed_input) > 0
            THEN (SUM(pl.weighed_loss) / SUM(pl.weighed_input) * 100)
            ELSE 0
          END::numeric, 2
        ) as loss_rate,
        COUNT(*) as batch_count
      FROM process_log pl
      WHERE pl.started_at::date BETWEEN $1 AND $2
        AND pl.status = 'COMPLETED'
        AND (pl.weighed_input > 0 OR pl.loss_rate > 0)
      GROUP BY pl.started_at::date, pl.process_code
      ORDER BY date, pl.process_code
    `, [startDate, endDate]);

    // 3. Worst 5 days
    const worstDays = await pool.query(`
      SELECT sub.date, sub.process_code, sub.loss_rate, sub.loss_kg,
             COALESCE(
               (SELECT pi.description FROM process_issue pi
                WHERE pi.issue_date = sub.date AND pi.process_code = sub.process_code
                LIMIT 1),
               ''
             ) as reason
      FROM (
        SELECT pl.started_at::date as date, pl.process_code,
          ROUND(
            CASE WHEN SUM(pl.weighed_input) > 0
              THEN (SUM(pl.weighed_loss) / SUM(pl.weighed_input) * 100)
              ELSE 0
            END::numeric, 2
          ) as loss_rate,
          COALESCE(SUM(pl.weighed_loss), 0) as loss_kg
        FROM process_log pl
        WHERE pl.started_at::date BETWEEN $1 AND $2
          AND pl.status = 'COMPLETED'
          AND pl.weighed_input > 0
        GROUP BY pl.started_at::date, pl.process_code
      ) sub
      ORDER BY sub.loss_rate DESC
      LIMIT 5
    `, [startDate, endDate]);

    // 4. Issues
    const issues = await pool.query(`
      SELECT pi.issue_date, pi.process_code, pi.issue_type, pi.severity,
             pi.description, pi.loss_impact_kg, pi.resolved
      FROM process_issue pi
      WHERE pi.issue_date BETWEEN $1 AND $2
      ORDER BY pi.issue_date DESC
    `, [startDate, endDate]);

    // 5. Defects summary
    const defectsResult = await pool.query(`
      SELECT
        COUNT(*) as total_count,
        COALESCE(SUM(CASE WHEN disposition = 'scrap' THEN 1 ELSE 0 END), 0) as scrap_count,
        COALESCE(SUM(CASE WHEN disposition = 'scrap' THEN weight ELSE 0 END), 0) as total_scrap_kg
      FROM defect_record
      WHERE created_at::date BETWEEN $1 AND $2
    `, [startDate, endDate]);

    const defectsByType = await pool.query(`
      SELECT defect_type, COUNT(*) as count
      FROM defect_record
      WHERE created_at::date BETWEEN $1 AND $2
      GROUP BY defect_type ORDER BY count DESC
    `, [startDate, endDate]);

    // 6. Recommendations (auto-generated)
    const recommendations: string[] = [];

    // Check if any process avg loss rate exceeds BOM loss_rate by >50%
    for (const proc of byProcessResult.rows) {
      const bomResult = await pool.query(`
        SELECT loss_rate FROM process_bom WHERE process_code = $1 AND is_active = true LIMIT 1
      `, [proc.process_code]);
      if (bomResult.rows.length > 0) {
        const bomRate = parseFloat(bomResult.rows[0].loss_rate) || 0;
        const actualRate = parseFloat(proc.loss_rate) || 0;
        if (bomRate > 0 && actualRate > bomRate * 1.5) {
          const processLabel = processCodeLabel(proc.process_code);
          recommendations.push(
            `${processLabel} 공정의 평균 로스율(${actualRate}%)이 BOM 기준(${bomRate}%)의 1.5배를 초과합니다. 원인 분석이 필요합니다.`
          );
        }
      }
    }

    // Check if any single day has loss rate > 2x overall average
    const overallAvg = parseFloat(overallResult.rows[0]?.overall_loss_rate) || 0;
    for (const day of dailyTrend.rows) {
      const dayRate = parseFloat(day.loss_rate) || 0;
      if (overallAvg > 0 && dayRate > overallAvg * 2) {
        const dateStr = day.date?.toISOString?.() ? day.date.toISOString().slice(0, 10) : String(day.date).slice(0, 10);
        const processLabel = processCodeLabel(day.process_code);
        recommendations.push(
          `${dateStr} ${processLabel} 공정의 로스율(${dayRate}%)이 월평균(${overallAvg}%)의 2배를 초과했습니다. 해당일 점검이 필요합니다.`
        );
      }
    }

    // Check unresolved issues count
    const unresolvedCount = await pool.query(`
      SELECT COUNT(*) as cnt FROM process_issue
      WHERE issue_date BETWEEN $1 AND $2 AND resolved = false
    `, [startDate, endDate]);
    const unresolved = parseInt(unresolvedCount.rows[0]?.cnt) || 0;
    if (unresolved > 3) {
      recommendations.push(
        `미해결 이슈가 ${unresolved}건입니다. 조속한 원인 분석 및 시정조치가 필요합니다.`
      );
    }

    const defects = defectsResult.rows[0] || {};

    // 7. Density comparison data
    const densityDataResult = await pool.query(`
      SELECT lp.lot_number, lp.process_code, lp.created_at::date as date,
             lp.density, lp.thickness, lp.width,
             lp.input_weight_kg, lp.output_weight_kg,
             lp.output_length_m, lp.loss_weight_kg, lp.loss_length_m,
             lp.theoretical_loss_kg, lp.actual_vs_theoretical_diff
      FROM lot_properties lp
      WHERE lp.created_at::date BETWEEN $1 AND $2
        AND lp.density IS NOT NULL AND lp.density > 0
      ORDER BY lp.created_at DESC
    `, [startDate, endDate]);

    const lotsWithDensity = densityDataResult.rows.length;

    // Count lots without density in the same period
    const lotsWithoutDensityResult = await pool.query(`
      SELECT COUNT(DISTINCT pl.log_id) as cnt
      FROM process_log pl
      WHERE pl.started_at::date BETWEEN $1 AND $2
        AND pl.status = 'COMPLETED'
        AND pl.weighed_input > 0
        AND NOT EXISTS (
          SELECT 1 FROM lot_properties lp
          WHERE lp.log_id = pl.log_id AND lp.density IS NOT NULL AND lp.density > 0
        )
    `, [startDate, endDate]);
    const lotsWithoutDensity = parseInt(lotsWithoutDensityResult.rows[0]?.cnt) || 0;

    const comparisonData = densityDataResult.rows.map((row: any) => {
      const inputKg = parseFloat(row.input_weight_kg) || 0;
      const outputKg = parseFloat(row.output_weight_kg) || 0;
      const density = parseFloat(row.density) || 0;
      const thicknessMm = parseFloat(row.thickness) || 0;
      const widthMm = parseFloat(row.width) || 0;
      const lossActualKg = parseFloat(row.loss_weight_kg) || 0;
      const outputM = parseFloat(row.output_length_m) || 0;

      // Calculated loss (input - output)
      const lossCalculatedKg = inputKg > 0 && outputKg > 0 ? inputKg - outputKg : 0;
      const diffKg = lossActualKg > 0 ? +(lossActualKg - lossCalculatedKg).toFixed(2) : 0;
      const lossRateActual = inputKg > 0 ? +((lossActualKg / inputKg) * 100).toFixed(2) : 0;
      const lossRateCalculated = inputKg > 0 ? +((lossCalculatedKg / inputKg) * 100).toFixed(2) : 0;
      const diffRate = +(lossRateActual - lossRateCalculated).toFixed(2);

      const dateStr = row.date?.toISOString?.() ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10);

      return {
        lot_number: row.lot_number,
        process_code: row.process_code,
        date: dateStr,
        density,
        thickness_mm: thicknessMm,
        width_mm: widthMm,
        input_kg: inputKg,
        output_kg: outputKg,
        output_m: outputM,
        loss_actual_kg: lossActualKg,
        loss_calculated_kg: lossCalculatedKg,
        diff_kg: diffKg,
        loss_rate_actual: lossRateActual,
        loss_rate_calculated: lossRateCalculated,
        diff_rate: diffRate,
      };
    });

    // Summary
    const avgDensity = lotsWithDensity > 0
      ? +(comparisonData.reduce((s: number, c: any) => s + c.density, 0) / lotsWithDensity).toFixed(2)
      : 0;
    const avgActualLossRate = lotsWithDensity > 0
      ? +(comparisonData.reduce((s: number, c: any) => s + c.loss_rate_actual, 0) / lotsWithDensity).toFixed(2)
      : 0;
    const avgCalculatedLossRate = lotsWithDensity > 0
      ? +(comparisonData.reduce((s: number, c: any) => s + c.loss_rate_calculated, 0) / lotsWithDensity).toFixed(2)
      : 0;
    const avgDiff = +(avgActualLossRate - avgCalculatedLossRate).toFixed(2);

    let insight = '';
    if (avgDiff > 0.5) {
      insight = `실측 로스가 밀도환산 대비 평균 ${avgDiff}%p 높음 → 재단 공정 개선 검토 필요`;
    } else if (avgDiff < -0.5) {
      insight = `실측 로스가 밀도환산 대비 평균 ${Math.abs(avgDiff)}%p 낮음 → 양호한 상태`;
    } else if (lotsWithDensity > 0) {
      insight = `실측 로스와 밀도환산 기준이 유사 (차이 ${avgDiff}%p) → 공정 안정`;
    } else {
      insight = '밀도 데이터가 아직 없습니다. 밀도 측정 후 비교 분석이 가능합니다.';
    }

    const densityComparison = {
      lots_with_density: lotsWithDensity,
      lots_without_density: lotsWithoutDensity,
      comparison_data: comparisonData,
      summary: {
        avg_density: avgDensity,
        avg_actual_loss_rate: avgActualLossRate,
        avg_calculated_loss_rate: avgCalculatedLossRate,
        avg_diff: avgDiff,
        insight,
      },
    };

    return {
      data: {
        period: `${year}년 ${month}월`,
        summary: {
          total_batches: parseInt(overallResult.rows[0]?.total_batches) || 0,
          total_input_kg: parseFloat(overallResult.rows[0]?.total_input_kg) || 0,
          total_output_kg: parseFloat(overallResult.rows[0]?.total_output_kg) || 0,
          total_loss_kg: parseFloat(overallResult.rows[0]?.total_loss_kg) || 0,
          overall_loss_rate: parseFloat(overallResult.rows[0]?.overall_loss_rate) || 0,
          by_process: byProcessResult.rows,
        },
        daily_trend: dailyTrend.rows,
        worst_days: worstDays.rows,
        issues: issues.rows,
        defects: {
          total_count: parseInt(defects.total_count) || 0,
          by_type: defectsByType.rows,
          total_scrap_kg: parseFloat(defects.total_scrap_kg) || 0,
          scrap_count: parseInt(defects.scrap_count) || 0,
        },
        recommendations,
        density_comparison: densityComparison,
      },
    };
  });
}

function processCodeLabel(code: string): string {
  const map: Record<string, string> = {
    MIX: '배합(MIX)',
    EXT: '압출(EXT)',
    CUT: '재단(CUT)',
    ASM: '조립(ASM)',
    SHP: '출하(SHP)',
  };
  return map[code] || code;
}
