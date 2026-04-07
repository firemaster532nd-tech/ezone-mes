import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

export async function reportRoutes(app: FastifyInstance) {

  /**
   * GET /api/reports/daily?date=YYYY-MM-DD
   * 일일 브리핑 보고서
   */
  app.get('/api/reports/daily', async (request) => {
    const { date } = request.query as { date?: string };
    const targetDate = date || new Date().toISOString().slice(0, 10);

    // 1) 작업지시 현황
    const woResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
        COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress,
        COUNT(*) FILTER (WHERE status = 'PLANNED') as planned,
        COUNT(*) FILTER (WHERE status = 'HOLD') as hold,
        COALESCE(SUM(actual_qty) FILTER (WHERE status = 'COMPLETED'), 0) as total_produced
      FROM work_order WHERE wo_date::date = $1::date
    `, [targetDate]);

    // 2) 공정별 생산
    const processResult = await pool.query(`
      SELECT process_code,
        COUNT(*) as wo_count,
        COALESCE(SUM(planned_qty), 0) as planned_total,
        COALESCE(SUM(actual_qty), 0) as actual_total
      FROM work_order WHERE wo_date::date = $1::date
      GROUP BY process_code ORDER BY process_code
    `, [targetDate]);

    // 3) 검사 현황
    const inspResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE result = 'PASS') as pass_count,
        COUNT(*) FILTER (WHERE result = 'FAIL') as fail_count,
        COUNT(*) FILTER (WHERE result IS NULL) as pending_count
      FROM inspection WHERE inspected_at::date = $1::date
    `, [targetDate]);

    // 4) 공정 실행 로그
    const logResult = await pool.query(`
      SELECT pl.process_code, pl.shift, pl.status,
             w.worker_name, pl.produced_qty, pl.defect_qty,
             pl.started_at, pl.completed_at
      FROM process_log pl
      LEFT JOIN worker w ON w.worker_id = pl.worker_id
      WHERE pl.created_at::date = $1::date
      ORDER BY pl.started_at
    `, [targetDate]);

    // 5) 품질 이슈 (불합격 검사)
    const issueResult = await pool.query(`
      SELECT ins.insp_id, ins.form_code, ins.result, ins.remarks,
             lt.lot_number, i.item_name
      FROM inspection ins
      LEFT JOIN lot_transaction lt ON lt.lot_id = ins.lot_id
      LEFT JOIN item_master i ON i.item_id = lt.item_id
      WHERE ins.result = 'FAIL' AND ins.inspected_at::date = $1::date
    `, [targetDate]);

    // 6) TBM 안전회의
    const tbmResult = await pool.query(`
      SELECT m.tbm_id, m.session, m.meeting_date, m.safety_topics, m.work_topics,
             COUNT(a.attendee_id) as attendee_count
      FROM tbm_meeting m
      LEFT JOIN tbm_attendee a ON a.tbm_id = m.tbm_id
      WHERE m.meeting_date = $1::date
      GROUP BY m.tbm_id
      ORDER BY m.session
    `, [targetDate]);

    // 7) 미해결 이슈
    const openIssues = await pool.query(`
      SELECT * FROM tbm_issue WHERE status IN ('OPEN', 'IN_PROGRESS', 'DELAYED')
      ORDER BY priority DESC, created_at
    `);

    // 8) 결재 현황 - 전체 미완료 결재
    const approvalResult = await pool.query(`
      SELECT status, COUNT(*) as cnt
      FROM approval WHERE created_at::date = $1::date
      GROUP BY status
    `, [targetDate]);

    // 9) ★ 미완료 추적 - human error 방지
    // 9-1) 검사 미완료 작업지시 (진행 중인데 검사가 없거나 PENDING인 것)
    const missingInspections = await pool.query(`
      SELECT wo.wo_id, wo.wo_number, wo.process_code, wo.status as wo_status,
             i.item_name, wo.wo_date,
             (SELECT COUNT(*) FROM inspection ins WHERE ins.wo_id = wo.wo_id) as insp_count,
             (SELECT COUNT(*) FROM inspection ins WHERE ins.wo_id = wo.wo_id AND ins.result = 'PASS') as pass_count
      FROM work_order wo
      LEFT JOIN item_master i ON i.item_id = wo.item_id
      WHERE wo.status IN ('IN_PROGRESS', 'COMPLETED')
        AND wo.wo_date::date >= ($1::date - INTERVAL '7 days')
        AND wo.wo_date::date <= $1::date
        AND NOT EXISTS (
          SELECT 1 FROM inspection ins WHERE ins.wo_id = wo.wo_id AND ins.result = 'PASS'
        )
      ORDER BY wo.wo_date DESC
    `, [targetDate]);

    // 9-2) 결재 대기 중 (REVIEW, PENDING_APPROVE 상태)
    const pendingApprovals = await pool.query(`
      SELECT ap.approval_id, ap.doc_type, ap.doc_title, ap.status,
             w.worker_name as writer_name,
             rv.worker_name as reviewer_name,
             av.worker_name as approver_name,
             ap.created_at,
             EXTRACT(DAY FROM now() - ap.created_at) as days_pending
      FROM approval ap
      LEFT JOIN worker w ON w.worker_id = ap.writer_id
      LEFT JOIN worker rv ON rv.worker_id = ap.reviewer_id
      LEFT JOIN worker av ON av.worker_id = ap.approver_id
      WHERE ap.status IN ('REVIEW', 'PENDING_APPROVE')
      ORDER BY ap.created_at
    `);

    // 9-3) TBM 미실시 (오늘 날짜인데 TBM이 없으면)
    const tbmMissing = await pool.query(`
      SELECT 'AM' as session WHERE NOT EXISTS (
        SELECT 1 FROM tbm_meeting WHERE meeting_date = $1::date AND session = 'AM'
      )
      UNION ALL
      SELECT 'PM' WHERE NOT EXISTS (
        SELECT 1 FROM tbm_meeting WHERE meeting_date = $1::date AND session = 'PM'
      )
    `, [targetDate]);

    // 9-4) 공정 실행 중 멈춤 (PAUSED가 오래된 것)
    const stalledProcesses = await pool.query(`
      SELECT pl.log_id, pl.process_code, pl.status, pl.shift,
             w.worker_name, wo.wo_number,
             pl.started_at,
             EXTRACT(HOUR FROM now() - COALESCE(
               (SELECT MAX(pe.created_at) FROM process_event pe WHERE pe.log_id = pl.log_id),
               pl.started_at
             )) as hours_since_update
      FROM process_log pl
      LEFT JOIN worker w ON w.worker_id = pl.worker_id
      LEFT JOIN work_order wo ON wo.wo_id = pl.wo_id
      WHERE pl.status IN ('PAUSED', 'RUNNING')
        AND pl.created_at::date >= ($1::date - INTERVAL '1 day')
      ORDER BY hours_since_update DESC
    `, [targetDate]);

    return {
      data: {
        date: targetDate,
        work_orders: woResult.rows[0],
        by_process: processResult.rows,
        inspection: inspResult.rows[0],
        process_logs: logResult.rows,
        quality_issues: issueResult.rows,
        tbm_meetings: tbmResult.rows,
        open_issues: openIssues.rows,
        approvals: approvalResult.rows,
        // 미완료 추적
        missing_inspections: missingInspections.rows,
        pending_approvals: pendingApprovals.rows,
        tbm_missing: tbmMissing.rows,
        stalled_processes: stalledProcesses.rows,
      },
    };
  });

  /**
   * GET /api/reports/weekly?start=YYYY-MM-DD
   * 주간 보고서 (start부터 7일)
   */
  app.get('/api/reports/weekly', async (request) => {
    const { start } = request.query as { start?: string };
    const startDate = start || getMonday(new Date());
    const endDate = addDays(startDate, 6);

    // 일별 생산 현황
    const dailyProduction = await pool.query(`
      SELECT wo_date::date as date,
        COUNT(*) as total_wo,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
        COALESCE(SUM(actual_qty), 0) as produced
      FROM work_order
      WHERE wo_date::date BETWEEN $1::date AND $2::date
      GROUP BY wo_date::date ORDER BY wo_date::date
    `, [startDate, endDate]);

    // 공정별 합계
    const processTotal = await pool.query(`
      SELECT process_code,
        COUNT(*) as wo_count,
        COALESCE(SUM(actual_qty), 0) as total_produced,
        COALESCE(SUM(planned_qty), 0) as total_planned
      FROM work_order
      WHERE wo_date::date BETWEEN $1::date AND $2::date
      GROUP BY process_code
    `, [startDate, endDate]);

    // 검사 통계
    const inspStats = await pool.query(`
      SELECT insp_type,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE result = 'PASS') as pass_count,
        COUNT(*) FILTER (WHERE result = 'FAIL') as fail_count
      FROM inspection
      WHERE inspected_at::date BETWEEN $1::date AND $2::date
      GROUP BY insp_type
    `, [startDate, endDate]);

    // 작업자별 실적
    const workerStats = await pool.query(`
      SELECT w.worker_name, w.position,
        COUNT(*) as task_count,
        COALESCE(SUM(pl.produced_qty), 0) as total_produced,
        COALESCE(SUM(pl.defect_qty), 0) as total_defect
      FROM process_log pl
      JOIN worker w ON w.worker_id = pl.worker_id
      WHERE pl.created_at::date BETWEEN $1::date AND $2::date
      GROUP BY w.worker_id, w.worker_name, w.position
      ORDER BY total_produced DESC
    `, [startDate, endDate]);

    // 결재 현황
    const approvalStats = await pool.query(`
      SELECT status, COUNT(*) as cnt
      FROM approval
      WHERE created_at::date BETWEEN $1::date AND $2::date
      GROUP BY status
    `, [startDate, endDate]);

    return {
      data: {
        period: { start: startDate, end: endDate },
        daily_production: dailyProduction.rows,
        by_process: processTotal.rows,
        inspection: inspStats.rows,
        worker_performance: workerStats.rows,
        approvals: approvalStats.rows,
      },
    };
  });

  /**
   * GET /api/reports/monthly?year=YYYY&month=MM
   * 월간 보고서 (재고 실사 포함)
   */
  app.get('/api/reports/monthly', async (request) => {
    const q = request.query as { year?: string; month?: string };
    const now = new Date();
    const year = parseInt(q.year || String(now.getFullYear()));
    const month = parseInt(q.month || String(now.getMonth() + 1));
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().slice(0, 10); // last day

    // 월간 생산 합계
    const productionResult = await pool.query(`
      SELECT
        COUNT(*) as total_wo,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
        COALESCE(SUM(actual_qty), 0) as total_produced,
        COALESCE(SUM(planned_qty), 0) as total_planned
      FROM work_order
      WHERE wo_date::date BETWEEN $1::date AND $2::date
    `, [startDate, endDate]);

    // 주차별 생산
    const weeklyResult = await pool.query(`
      SELECT
        EXTRACT(WEEK FROM wo_date::date) as week_num,
        MIN(wo_date::date) as week_start,
        COUNT(*) as wo_count,
        COALESCE(SUM(actual_qty), 0) as produced
      FROM work_order
      WHERE wo_date::date BETWEEN $1::date AND $2::date
      GROUP BY EXTRACT(WEEK FROM wo_date::date)
      ORDER BY week_num
    `, [startDate, endDate]);

    // 공정별 현황
    const processResult = await pool.query(`
      SELECT process_code,
        COUNT(*) as wo_count,
        COALESCE(SUM(actual_qty), 0) as produced,
        COALESCE(SUM(planned_qty), 0) as planned
      FROM work_order
      WHERE wo_date::date BETWEEN $1::date AND $2::date
      GROUP BY process_code
    `, [startDate, endDate]);

    // 검사 합격률
    const inspResult = await pool.query(`
      SELECT insp_type,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE result = 'PASS') as pass_count,
        COUNT(*) FILTER (WHERE result = 'FAIL') as fail_count,
        ROUND(COUNT(*) FILTER (WHERE result = 'PASS')::numeric / NULLIF(COUNT(*), 0) * 100, 1) as pass_rate
      FROM inspection
      WHERE inspected_at::date BETWEEN $1::date AND $2::date
      GROUP BY insp_type
    `, [startDate, endDate]);

    // ★ 월말 재고 실사 (현재 재고 현황 스냅샷)
    const inventoryResult = await pool.query(`
      SELECT i.item_id, i.item_code, i.item_name, i.item_category, i.unit, i.safety_stock,
        COALESCE(
          (SELECT SUM(CASE WHEN txn_type = 'IN' THEN qty ELSE -qty END)
           FROM inventory_transaction WHERE item_id = i.item_id), 0
        ) as current_balance
      FROM item_master i
      WHERE i.is_active = true
      ORDER BY i.item_category, i.item_name
    `);

    // 재고 변동 요약 (월간 입출고)
    const txnSummary = await pool.query(`
      SELECT i.item_name, i.item_category,
        COALESCE(SUM(CASE WHEN it.txn_type = 'IN' THEN it.qty ELSE 0 END), 0) as total_in,
        COALESCE(SUM(CASE WHEN it.txn_type = 'OUT' THEN it.qty ELSE 0 END), 0) as total_out,
        COALESCE(SUM(CASE WHEN it.txn_type = 'ADJ' THEN it.qty ELSE 0 END), 0) as total_adj
      FROM inventory_transaction it
      JOIN item_master i ON i.item_id = it.item_id
      WHERE it.txn_date::date BETWEEN $1::date AND $2::date
      GROUP BY i.item_id, i.item_name, i.item_category
      ORDER BY i.item_category, total_out DESC
    `, [startDate, endDate]);

    // 결재 현황
    const approvalStats = await pool.query(`
      SELECT status, COUNT(*) as cnt
      FROM approval
      WHERE created_at::date BETWEEN $1::date AND $2::date
      GROUP BY status
    `, [startDate, endDate]);

    return {
      data: {
        period: { year, month, start: startDate, end: endDate },
        production: productionResult.rows[0],
        weekly_breakdown: weeklyResult.rows,
        by_process: processResult.rows,
        inspection: inspResult.rows,
        inventory_snapshot: inventoryResult.rows,
        inventory_movement: txnSummary.rows,
        approvals: approvalStats.rows,
      },
    };
  });
}

function getMonday(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
