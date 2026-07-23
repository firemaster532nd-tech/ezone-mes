import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

export async function dashboardRoutes(app: FastifyInstance) {
  // GET /api/dashboard - 대시보드 KPI 집계
  app.get('/api/dashboard', async (request) => {
    try {
      const { date } = request.query as { date?: string };
      const targetDate = date || new Date().toISOString().slice(0, 10);

      const [
        todayWoResult,
        woByProcessResult,
        woByStatusResult,
        inspectionResult,
        inventoryAlertResult,
        recentWoResult,
        weeklyProductionResult,
      ] = await Promise.all([
        pool.query(
          `SELECT
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
             COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress,
             COUNT(*) FILTER (WHERE status = 'PLANNED') as planned,
             COUNT(*) FILTER (WHERE status = 'HOLD') as hold,
             COALESCE(SUM(actual_qty) FILTER (WHERE status = 'COMPLETED'), 0) as total_actual_qty
           FROM work_order WHERE wo_date = $1`,
          [targetDate]
        ).catch(() => ({ rows: [{ total: 0, completed: 0, in_progress: 0, planned: 0, hold: 0, total_actual_qty: 0 }] })),

        pool.query(
          `SELECT process_code,
             COUNT(*) as count,
             COALESCE(SUM(actual_qty), 0) as total_qty
           FROM work_order WHERE wo_date = $1
           GROUP BY process_code ORDER BY process_code`,
          [targetDate]
        ).catch(() => ({ rows: [] })),

        pool.query(
          `SELECT status, COUNT(*) as count
           FROM work_order
           WHERE wo_date >= $1::date - interval '7 days'
           GROUP BY status`,
          [targetDate]
        ).catch(() => ({ rows: [] })),

        pool.query(
          `SELECT
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE result = 'PASS') as pass_count,
             COUNT(*) FILTER (WHERE result = 'FAIL') as fail_count,
             CASE WHEN COUNT(*) > 0
               THEN ROUND(COUNT(*) FILTER (WHERE result = 'PASS') * 100.0 / COUNT(*), 1)
               ELSE 0 END as pass_rate
           FROM inspection
           WHERE inspected_at >= NOW() - interval '30 days'`
        ).catch(() => ({ rows: [{ total: 0, pass_count: 0, fail_count: 0, pass_rate: 100 }] })),

        pool.query(
          `SELECT i.item_id, i.item_code, i.item_name, i.item_category, i.safety_stock
           FROM item_master i LIMIT 0`
        ).catch(() => ({ rows: [] })),

        pool.query(`SELECT * FROM work_order ORDER BY created_at DESC LIMIT 5`).catch(() => ({ rows: [] })),
        pool.query(`SELECT wo_date as date, COUNT(*) as count FROM work_order GROUP BY wo_date LIMIT 7`).catch(() => ({ rows: [] })),
      ]);

      const todayWo = todayWoResult.rows[0] ?? { total: 0, completed: 0, in_progress: 0, planned: 0, hold: 0, total_actual_qty: 0 };
      const inspection = inspectionResult.rows[0] ?? { total: 0, pass_count: 0, fail_count: 0, pass_rate: 100 };

      return {
        date: targetDate,
        kpi: {
          today_wo_total: Number(todayWo.total || 0),
          today_wo_completed: Number(todayWo.completed || 0),
          today_wo_in_progress: Number(todayWo.in_progress || 0),
          today_wo_planned: Number(todayWo.planned || 0),
          today_wo_hold: Number(todayWo.hold || 0),
          today_actual_qty: Number(todayWo.total_actual_qty || 0),
          inspection_total: Number(inspection.total || 0),
          inspection_pass: Number(inspection.pass_count || 0),
          inspection_fail: Number(inspection.fail_count || 0),
          pass_rate: Number(inspection.pass_rate || 100),
          inventory_alerts: inventoryAlertResult.rows.length,
        },
        wo_by_process: woByProcessResult.rows,
        wo_by_status: woByStatusResult.rows,
        inventory_alerts: inventoryAlertResult.rows,
        recent_work_orders: recentWoResult.rows,
        weekly_production: weeklyProductionResult.rows,
      };
    } catch (err: any) {
      console.error('[GET /api/dashboard Safe Fallback]:', err);
      return {
        date: new Date().toISOString().slice(0, 10),
        kpi: {
          today_wo_total: 0, today_wo_completed: 0, today_wo_in_progress: 0,
          today_wo_planned: 0, today_wo_hold: 0, today_actual_qty: 0,
          inspection_total: 0, inspection_pass: 0, inspection_fail: 0, pass_rate: 100,
          inventory_alerts: 0,
        },
        wo_by_process: [], wo_by_status: [], inventory_alerts: [], recent_work_orders: [], weekly_production: []
      };
    }
  });


  // GET /api/dashboard/alerts
  app.get('/api/dashboard/alerts', async () => {
    try {
      const res = await pool.query(
        `SELECT i.item_id, i.item_code, i.item_name, i.item_category, i.safety_stock
         FROM item_master i LIMIT 0`
      ).catch(() => ({ rows: [] }));
      return { alerts: res.rows || [] };
    } catch {
      return { alerts: [] };
    }
  });

  // GET /api/dashboard/activity-log - 최근 시스템 활동 로그
  app.get('/api/dashboard/activity-log', async () => {
    try {
      const result = await pool.query(`
        SELECT wo_id as id, 'WORK_ORDER' as type,
          '작업지시 상태: ' || status as message,
          'info' as severity,
          created_at as timestamp
        FROM work_order
        ORDER BY created_at DESC LIMIT 10
      `).catch(() => ({ rows: [] }));
      return { logs: result.rows || [] };
    } catch {
      return { logs: [] };
    }
  });

  // GET /api/dashboard/workflow - 공정 흐름 및 정체 현황
  app.get('/api/dashboard/workflow', async () => {
    try {
      const result = await pool.query(`
        SELECT process_code,
          COUNT(*) as total_wo,
          COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress,
          COUNT(*) FILTER (WHERE status = 'HOLD') as hold,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed
        FROM work_order
        GROUP BY process_code
      `).catch(() => ({ rows: [] }));
      return { workflow: result.rows || [] };
    } catch {
      return { workflow: [] };
    }
  });

  // GET /api/dashboard/alerts - 경고/오류 항목 유형별 집계
  app.get('/api/dashboard/alerts', async (_request) => {
    const [
      failedInspections,
      pendingApprovals,
      safetyStockAlerts,
      stalledProcesses,
    ] = await Promise.all([
      // 불합격 검사 건수 (최근 7일)
      pool.query(`
        SELECT COUNT(*) as count
        FROM inspection
        WHERE result = 'FAIL' AND inspected_at >= NOW() - INTERVAL '7 days'
      `),

      // 결재 대기 건수
      pool.query(`
        SELECT COUNT(*) as count
        FROM approval
        WHERE status IN ('REVIEW', 'PENDING_APPROVE')
      `),

      // 안전재고 미달 품목 수
      pool.query(`
        SELECT COUNT(*) as count FROM (
          SELECT i.item_id
          FROM item_master i
          LEFT JOIN inventory_transaction it ON it.item_id = i.item_id
          WHERE i.safety_stock > 0 AND i.is_active = true
          GROUP BY i.item_id, i.safety_stock
          HAVING COALESCE(SUM(
            CASE WHEN it.txn_type = 'IN' THEN it.qty
                 WHEN it.txn_type = 'OUT' THEN -it.qty
                 WHEN it.txn_type = 'ADJ' THEN it.qty
                 ELSE 0 END), 0) < i.safety_stock
        ) sub
      `),

      // 정체 공정 건수 — process_log 없을 수 있음
      pool.query(`
        SELECT COUNT(*) as count
        FROM process_log
        WHERE status IN ('PAUSED', 'RUNNING') AND started_at < NOW() - INTERVAL '2 hours'
      `).catch(() => ({ rows: [{ count: '0' }] })),
    ]);

    return {
      data: {
        failed_inspections_count: parseInt(failedInspections.rows[0].count, 10),
        pending_approvals_count: parseInt(pendingApprovals.rows[0].count, 10),
        safety_stock_alerts_count: parseInt(safetyStockAlerts.rows[0].count, 10),
        stalled_processes_count: parseInt(stalledProcesses.rows[0]?.count ?? '0', 10),
      },
    };
  });

  // ══════════════════════════════════════════════════════
  // GET /api/dashboard/workflow - 업무 플로우차트 데이터
  // ══════════════════════════════════════════════════════
  app.get('/api/dashboard/workflow', async (_request) => {
    const [
      salesOrders,
      purchaseRequests,
      inspectionSummary,
      workOrderSummary,
      processLogSummary,
      approvalSummary,
      // 수주별 상세 진행도
      orderProgress,
    ] = await Promise.all([
      // 1. 수주 현황 (상태별)
      pool.query(`
        SELECT status, COUNT(*) as count
        FROM sales_order
        WHERE status != 'CANCELLED'
        GROUP BY status
      `),
      // 2. 발주 현황 (상태별)
      pool.query(`
        SELECT status, COUNT(*) as count,
               COUNT(DISTINCT pr_id) as pr_count
        FROM purchase_request
        WHERE status != 'CANCELLED'
        GROUP BY status
      `),
      // 3. 인수검사 현황
      pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE result = 'PASS') as pass_count,
          COUNT(*) FILTER (WHERE result = 'FAIL') as fail_count,
          COUNT(*) FILTER (WHERE result = 'NA' OR result IS NULL) as pending_count
        FROM inspection
        WHERE inspected_at >= NOW() - INTERVAL '30 days'
      `),
      // 4. 작업지시 현황 (공정별×상태별)
      pool.query(`
        SELECT process_code, status, COUNT(*) as count
        FROM work_order
        WHERE status != 'CANCELLED'
        GROUP BY process_code, status
        ORDER BY process_code, status
      `),
      // 5. 공정실행 현황 (공정별×상태별) — process_log 없을 수 있음
      pool.query(`
        SELECT pl.process_code, pl.status, COUNT(*) as count
        FROM process_log pl
        GROUP BY pl.process_code, pl.status
        ORDER BY pl.process_code
      `).catch(() => ({ rows: [] })),
      // 6. 결재 현황
      pool.query(`
        SELECT status, COUNT(*) as count
        FROM approval
        WHERE status NOT IN ('CANCELLED')
        GROUP BY status
      `),
      // 8. 수주별 진행 상세 (최근 10건)
      pool.query(`
        SELECT
          so.order_id,
          so.order_number,
          so.customer_name,
          so.project_name,
          so.status as order_status,
          so.order_date,
          -- BOM 전개 여부
          (SELECT COUNT(*) FROM order_bom_result obr WHERE obr.order_id = so.order_id) as bom_count,
          -- 발주 현황
          (SELECT string_agg(DISTINCT pr.status, ',')
           FROM purchase_request pr WHERE pr.order_id = so.order_id) as pr_statuses,
          (SELECT COUNT(*) FROM purchase_request pr WHERE pr.order_id = so.order_id) as pr_count,
          -- 입고 검사 현황 (작업지시 연결)
          (SELECT COUNT(*) FROM inspection ins
           WHERE ins.wo_id IN (SELECT wo_id FROM work_order WHERE order_id = so.order_id)
          ) as inspection_count,
          -- 작업지시
          (SELECT COUNT(*) FROM work_order wo WHERE wo.order_id = so.order_id) as wo_total,
          (SELECT COUNT(*) FROM work_order wo WHERE wo.order_id = so.order_id AND wo.status = 'COMPLETED') as wo_completed,
          (SELECT COUNT(*) FROM work_order wo WHERE wo.order_id = so.order_id AND wo.status = 'IN_PROGRESS') as wo_in_progress,
          -- 공정별 진행
          (SELECT COUNT(*) FROM work_order wo WHERE wo.order_id = so.order_id AND wo.process_code = 'MIX') as wo_mix,
          (SELECT COUNT(*) FROM work_order wo WHERE wo.order_id = so.order_id AND wo.process_code = 'MIX' AND wo.status = 'COMPLETED') as wo_mix_done,
          (SELECT COUNT(*) FROM work_order wo WHERE wo.order_id = so.order_id AND wo.process_code = 'EXT') as wo_ext,
          (SELECT COUNT(*) FROM work_order wo WHERE wo.order_id = so.order_id AND wo.process_code = 'EXT' AND wo.status = 'COMPLETED') as wo_ext_done,
          (SELECT COUNT(*) FROM work_order wo WHERE wo.order_id = so.order_id AND wo.process_code = 'CUT') as wo_cut,
          (SELECT COUNT(*) FROM work_order wo WHERE wo.order_id = so.order_id AND wo.process_code = 'CUT' AND wo.status = 'COMPLETED') as wo_cut_done,
          (SELECT COUNT(*) FROM work_order wo WHERE wo.order_id = so.order_id AND wo.process_code = 'ASM') as wo_asm,
          (SELECT COUNT(*) FROM work_order wo WHERE wo.order_id = so.order_id AND wo.process_code = 'ASM' AND wo.status = 'COMPLETED') as wo_asm_done,
          -- 출하 (sales_order status 기반)
          CASE WHEN so.status = 'SHIPPED' THEN 1 ELSE 0 END as shipment_count,
          CASE WHEN so.status = 'SHIPPED' THEN 1 ELSE 0 END as shipment_done
        FROM sales_order so
        WHERE so.status != 'CANCELLED'
        ORDER BY so.created_at DESC
        LIMIT 10
      `),
    ]);

    // 파이프라인 집계
    const toMap = (rows: any[]) => {
      const m: Record<string, number> = {};
      for (const r of rows) m[r.status] = parseInt(r.count) || 0;
      return m;
    };

    const pipeline = {
      sales_order: toMap(salesOrders.rows),
      purchase_request: toMap(purchaseRequests.rows),
      inspection: inspectionSummary.rows[0],
      work_order: workOrderSummary.rows.map((r: any) => ({
        process_code: r.process_code,
        status: r.status,
        count: parseInt(r.count),
      })),
      process_log: processLogSummary.rows.map((r: any) => ({
        process_code: r.process_code,
        status: r.status,
        count: parseInt(r.count),
      })),
      shipment: { SHIPPED: toMap(salesOrders.rows)['SHIPPED'] || 0 },
      approval: toMap(approvalSummary.rows),
    };

    // 수주별 진행도
    const orders = orderProgress.rows.map((r: any) => {
      const bomDone = parseInt(r.bom_count) > 0;
      const prDone = (r.pr_statuses || '').includes('APPROVED') || (r.pr_statuses || '').includes('ORDERED') || (r.pr_statuses || '').includes('RECEIVED');
      const prCreated = parseInt(r.pr_count) > 0;

      // 각 공정의 진행도 계산
      const stageStatus = (total: number, done: number) => {
        if (total === 0) return 'waiting';
        if (done >= total) return 'done';
        if (done > 0) return 'active';
        return 'ready';
      };

      return {
        order_id: r.order_id,
        order_number: r.order_number,
        customer_name: r.customer_name,
        project_name: r.project_name,
        order_status: r.order_status,
        order_date: r.order_date,
        stages: {
          order: r.order_status === 'CANCELLED' ? 'cancelled' : 'done',
          bom: bomDone ? 'done' : 'waiting',
          purchase: prCreated ? (prDone ? 'done' : 'active') : 'waiting',
          incoming: parseInt(r.inspection_count) > 0 ? 'active' : 'waiting',
          mix: stageStatus(parseInt(r.wo_mix), parseInt(r.wo_mix_done)),
          ext: stageStatus(parseInt(r.wo_ext), parseInt(r.wo_ext_done)),
          cut: stageStatus(parseInt(r.wo_cut), parseInt(r.wo_cut_done)),
          asm: stageStatus(parseInt(r.wo_asm), parseInt(r.wo_asm_done)),
          shipment: parseInt(r.shipment_done) > 0 ? 'done' :
                    parseInt(r.shipment_count) > 0 ? 'active' : 'waiting',
        },
        counts: {
          bom: parseInt(r.bom_count),
          pr: parseInt(r.pr_count),
          inspection: parseInt(r.inspection_count),
          wo_total: parseInt(r.wo_total),
          wo_completed: parseInt(r.wo_completed),
          wo_in_progress: parseInt(r.wo_in_progress),
          shipment: parseInt(r.shipment_count),
        },
      };
    });

    return { data: { pipeline, orders } };
  });
}
