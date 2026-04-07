import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

export async function productionStatsRoutes(app: FastifyInstance) {
  // GET /api/production/stats?date=YYYY-MM-DD - 일별 생산 통계
  app.get('/api/production/stats', async (request) => {
    const { date } = request.query as { date?: string };
    const targetDate = date || new Date().toISOString().slice(0, 10);

    // 공정별 통계
    const byProcess = await pool.query(
      `SELECT
         process_code,
         COUNT(*) as total_logs,
         COUNT(*) FILTER (WHERE status = 'RUNNING') as running,
         COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
         COUNT(*) FILTER (WHERE status = 'PAUSED') as paused,
         COUNT(*) FILTER (WHERE status = 'READY') as ready,
         COALESCE(SUM(planned_qty), 0) as planned_qty,
         COALESCE(SUM(produced_qty), 0) as produced_qty,
         COALESCE(SUM(defect_qty), 0) as defect_qty,
         CASE WHEN COALESCE(SUM(produced_qty), 0) > 0
           THEN ROUND(((SUM(produced_qty) - SUM(defect_qty)) / SUM(produced_qty)) * 100, 1)
           ELSE 0
         END as yield_rate
       FROM process_log
       WHERE created_at::date = $1
       GROUP BY process_code
       ORDER BY process_code`,
      [targetDate]
    );

    // 작업자별 통계
    const byWorker = await pool.query(
      `SELECT
         w.worker_name,
         w.department,
         COALESCE(SUM(EXTRACT(EPOCH FROM (
           COALESCE(pl.completed_at, NOW()) - pl.started_at
         )) / 3600) FILTER (WHERE pl.started_at IS NOT NULL), 0) as hours_worked,
         COALESCE(SUM(pl.produced_qty), 0) as produced_qty,
         COALESCE(SUM(pl.defect_qty), 0) as defect_qty
       FROM process_log pl
       JOIN worker w ON w.worker_id = pl.worker_id
       WHERE pl.created_at::date = $1
       GROUP BY w.worker_id, w.worker_name, w.department
       ORDER BY produced_qty DESC`,
      [targetDate]
    );

    // 전체 통계
    const overall = await pool.query(
      `SELECT
         COALESCE(SUM(planned_qty), 0) as total_planned,
         COALESCE(SUM(produced_qty), 0) as total_produced,
         COALESCE(SUM(defect_qty), 0) as total_defect,
         CASE WHEN COALESCE(SUM(produced_qty), 0) > 0
           THEN ROUND(((SUM(produced_qty) - SUM(defect_qty)) / SUM(produced_qty)) * 100, 1)
           ELSE 0
         END as overall_yield,
         CASE WHEN COALESCE(SUM(planned_qty), 0) > 0
           THEN ROUND((SUM(produced_qty) / SUM(planned_qty)) * 100, 1)
           ELSE 0
         END as process_rate,
         COUNT(*) FILTER (WHERE status = 'RUNNING') as active_processes,
         COUNT(DISTINCT worker_id) FILTER (WHERE status IN ('RUNNING', 'PAUSED')) as active_workers
       FROM process_log
       WHERE created_at::date = $1`,
      [targetDate]
    );

    return {
      data: {
        date: targetDate,
        by_process: byProcess.rows,
        by_worker: byWorker.rows,
        overall: overall.rows[0],
      },
    };
  });

  // GET /api/production/stats/weekly - 주간 요약
  app.get('/api/production/stats/weekly', async () => {
    const result = await pool.query(
      `SELECT
         created_at::date as date,
         process_code,
         COUNT(*) as total_logs,
         COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
         COALESCE(SUM(planned_qty), 0) as planned_qty,
         COALESCE(SUM(produced_qty), 0) as produced_qty,
         COALESCE(SUM(defect_qty), 0) as defect_qty,
         CASE WHEN COALESCE(SUM(produced_qty), 0) > 0
           THEN ROUND(((SUM(produced_qty) - SUM(defect_qty)) / SUM(produced_qty)) * 100, 1)
           ELSE 0
         END as yield_rate
       FROM process_log
       WHERE created_at::date >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY created_at::date, process_code
       ORDER BY date DESC, process_code`
    );

    // Daily summary
    const dailySummary = await pool.query(
      `SELECT
         created_at::date as date,
         COUNT(*) as total_logs,
         COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
         COALESCE(SUM(produced_qty), 0) as produced_qty,
         COALESCE(SUM(defect_qty), 0) as defect_qty
       FROM process_log
       WHERE created_at::date >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY created_at::date
       ORDER BY date DESC`
    );

    return {
      data: {
        by_process: result.rows,
        daily_summary: dailySummary.rows,
      },
    };
  });
}
