import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

interface CheckItem {
  id: string;
  category: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  count: number;
  details: Array<Record<string, unknown>>;
}

async function safeQuery(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> {
  try {
    return await pool.query(sql, params);
  } catch {
    return { rows: [] };
  }
}

export async function complianceRoutes(app: FastifyInstance) {

  // GET /api/compliance/checklist - 미비사항 종합 점검
  app.get('/api/compliance/checklist', async () => {
    const checks: CheckItem[] = [];

    // ========================================
    // 1. 작업지시 관련 점검
    // ========================================

    // 1-1. 완료되었으나 실적수량 미입력
    const woNoActual = await safeQuery(`
      SELECT wo_id, wo_number, process_code, wo_date, planned_qty
      FROM work_order
      WHERE status = 'COMPLETED' AND (actual_qty IS NULL OR actual_qty = 0)
      ORDER BY wo_date DESC LIMIT 50
    `);
    if (woNoActual.rows.length > 0) {
      checks.push({
        id: 'wo-no-actual-qty',
        category: '작업지시',
        severity: 'critical',
        title: '완료 작업지시 실적수량 미입력',
        description: '상태가 완료(COMPLETED)이나 실적수량이 0 또는 미입력',
        count: woNoActual.rows.length,
        details: woNoActual.rows,
      });
    }

    // 1-2. 배합(MIX) 필수필드 미입력
    const mixMissing = await safeQuery(`
      SELECT wo_id, wo_number, wo_date,
        CASE WHEN mix_time_minutes IS NULL THEN '배합시간' ELSE '' END AS m1,
        CASE WHEN actual_weight_kg IS NULL THEN '무게실측' ELSE '' END AS m2,
        CASE WHEN incoming_inspection_status IS NULL OR incoming_inspection_status = '' THEN '입고검사' ELSE '' END AS m3
      FROM work_order
      WHERE process_code = 'MIX'
        AND status IN ('IN_PROGRESS', 'COMPLETED')
        AND (mix_time_minutes IS NULL OR actual_weight_kg IS NULL
             OR incoming_inspection_status IS NULL OR incoming_inspection_status = '')
      ORDER BY wo_date DESC LIMIT 50
    `);
    if (mixMissing.rows.length > 0) {
      checks.push({
        id: 'mix-missing-fields',
        category: '작업지시',
        severity: 'warning',
        title: '배합(MIX) 공정 필수정보 미입력',
        description: '배합시간/무게실측/입고검사완료 중 누락 항목 있음',
        count: mixMissing.rows.length,
        details: mixMissing.rows.map(r => ({
          ...r,
          missing: [r.m1, r.m2, r.m3].filter(Boolean).join(', '),
        })),
      });
    }

    // 1-3. 압출(EXT) 필수필드 미입력
    const extMissing = await safeQuery(`
      SELECT wo_id, wo_number, wo_date
      FROM work_order
      WHERE process_code = 'EXT'
        AND status IN ('IN_PROGRESS', 'COMPLETED')
        AND (thickness_mm IS NULL OR width_mm IS NULL OR density_gcm3 IS NULL)
      ORDER BY wo_date DESC LIMIT 50
    `);
    if (extMissing.rows.length > 0) {
      checks.push({
        id: 'ext-missing-fields',
        category: '작업지시',
        severity: 'warning',
        title: '압출(EXT) 공정 필수정보 미입력',
        description: '두께/너비/밀도 중 누락 항목 있음',
        count: extMissing.rows.length,
        details: extMissing.rows,
      });
    }

    // 1-4. 조립(ASM) LOT 미입력
    const asmMissing = await safeQuery(`
      SELECT wo_id, wo_number, wo_date, asm_structure
      FROM work_order
      WHERE process_code = 'ASM'
        AND status IN ('IN_PROGRESS', 'COMPLETED')
        AND (socket_lot IS NULL OR socket_lot = ''
             OR sheet_lot IS NULL OR sheet_lot = '')
      ORDER BY wo_date DESC LIMIT 50
    `);
    if (asmMissing.rows.length > 0) {
      checks.push({
        id: 'asm-missing-lots',
        category: '작업지시',
        severity: 'warning',
        title: '조립(ASM) 투입LOT 미입력',
        description: '소켓LOT/시트LOT 등 투입 자재 LOT 번호 누락',
        count: asmMissing.rows.length,
        details: asmMissing.rows,
      });
    }

    // 1-5. 작업지시 LOT번호 미부여
    const woNoLot = await safeQuery(`
      SELECT wo_id, wo_number, process_code, wo_date, status
      FROM work_order
      WHERE status IN ('IN_PROGRESS', 'COMPLETED')
        AND (lot_number IS NULL OR lot_number = '')
      ORDER BY wo_date DESC LIMIT 50
    `);
    if (woNoLot.rows.length > 0) {
      checks.push({
        id: 'wo-no-lot',
        category: '작업지시',
        severity: 'critical',
        title: '작업지시 LOT번호 미부여',
        description: '진행/완료 상태인데 LOT번호가 없어 추적 불가',
        count: woNoLot.rows.length,
        details: woNoLot.rows,
      });
    }

    // ========================================
    // 2. 중간검사 관련 점검
    // ========================================

    // 2-1. 완료 작업지시 중 중간검사 미실시
    const woNoInspection = await safeQuery(`
      SELECT w.wo_id, w.wo_number, w.process_code, w.wo_date
      FROM work_order w
      LEFT JOIN inspection ins ON ins.wo_id = w.wo_id AND ins.insp_type = 'PROCESS'
      WHERE w.status = 'COMPLETED'
        AND w.process_code IN ('EXT', 'CUT', 'ASM')
        AND ins.insp_id IS NULL
      ORDER BY w.wo_date DESC LIMIT 50
    `);
    if (woNoInspection.rows.length > 0) {
      checks.push({
        id: 'wo-no-process-insp',
        category: '중간검사',
        severity: 'critical',
        title: '완료 작업지시 중간검사 미실시',
        description: '공정 완료했으나 C-701 중간검사 기록이 없음',
        count: woNoInspection.rows.length,
        details: woNoInspection.rows,
      });
    }

    // 2-2. 중간검사 불합격 미처리
    const inspFail = await safeQuery(`
      SELECT ins.insp_id, ins.form_code, ins.wo_id, w.wo_number, ins.inspected_at
      FROM inspection ins
      JOIN work_order w ON w.wo_id = ins.wo_id
      WHERE ins.insp_type = 'PROCESS'
        AND ins.result = 'FAIL'
        AND w.status NOT IN ('HOLD', 'CANCELLED')
      ORDER BY ins.inspected_at DESC LIMIT 50
    `);
    if (inspFail.rows.length > 0) {
      checks.push({
        id: 'insp-fail-not-held',
        category: '중간검사',
        severity: 'critical',
        title: '중간검사 불합격 후 미조치',
        description: '검사 불합격인데 작업지시가 보류/취소 처리되지 않음',
        count: inspFail.rows.length,
        details: inspFail.rows,
      });
    }

    // ========================================
    // 3. LOT/추적성 관련 점검
    // ========================================

    // 3-1. 검사 미완료(PENDING) LOT
    const lotPending = await safeQuery(`
      SELECT lot_id, lot_number, lot_type, item_id, qty, created_at
      FROM lot_transaction
      WHERE inspection_result = 'PENDING'
        AND status = 'ACTIVE'
      ORDER BY created_at DESC LIMIT 50
    `);
    if (lotPending.rows.length > 0) {
      checks.push({
        id: 'lot-inspection-pending',
        category: 'LOT 추적성',
        severity: 'warning',
        title: 'LOT 검사 판정 대기',
        description: '입고/생산 LOT의 검사 판정이 PENDING 상태',
        count: lotPending.rows.length,
        details: lotPending.rows,
      });
    }

    // 3-2. LOT 계보 끊김 (부모 LOT 없는 생산 LOT)
    const lotNoParent = await safeQuery(`
      SELECT lt.lot_id, lt.lot_number, lt.lot_type, lt.qty
      FROM lot_transaction lt
      LEFT JOIN lot_genealogy lg ON lg.child_lot_id = lt.lot_id
      WHERE lt.lot_type IN ('MIX', 'EXT', 'CUT', 'ASM')
        AND lt.status = 'ACTIVE'
        AND lg.genealogy_id IS NULL
      ORDER BY lt.created_at DESC LIMIT 50
    `);
    if (lotNoParent.rows.length > 0) {
      checks.push({
        id: 'lot-no-genealogy',
        category: 'LOT 추적성',
        severity: 'warning',
        title: 'LOT 계보 미연결 (추적성 끊김)',
        description: '생산 LOT인데 부모 LOT 연결이 없어 역추적 불가',
        count: lotNoParent.rows.length,
        details: lotNoParent.rows,
      });
    }

    // ========================================
    // 4. 인수검사 관련 점검
    // ========================================

    // 4-1. 입고 LOT 중 인수검사 미실시
    const inLotNoInsp = await safeQuery(`
      SELECT lt.lot_id, lt.lot_number, lt.supplier_lot, lt.qty,
             i.item_name, i.item_category
      FROM lot_transaction lt
      JOIN item_master i ON i.item_id = lt.item_id
      LEFT JOIN inspection ins ON ins.lot_id = lt.lot_id AND ins.insp_type = 'INCOMING'
      WHERE lt.lot_type = 'IN'
        AND lt.status = 'ACTIVE'
        AND ins.insp_id IS NULL
      ORDER BY lt.created_at DESC LIMIT 50
    `);
    if (inLotNoInsp.rows.length > 0) {
      checks.push({
        id: 'incoming-lot-no-insp',
        category: '인수검사',
        severity: 'critical',
        title: '입고 LOT 인수검사 미실시',
        description: '원재료/부자재 입고 후 인수검사 기록이 없음',
        count: inLotNoInsp.rows.length,
        details: inLotNoInsp.rows,
      });
    }

    // ========================================
    // 5. 재고 관련 점검
    // ========================================

    // 5-1. 안전재고 미달 품목
    const belowSafety = await safeQuery(`
      SELECT i.item_id, i.item_code, i.item_name, i.item_category, i.unit,
             i.safety_stock,
             COALESCE(SUM(CASE WHEN iv.txn_type = 'IN' THEN iv.qty ELSE 0 END), 0) -
             COALESCE(SUM(CASE WHEN iv.txn_type = 'OUT' THEN iv.qty ELSE 0 END), 0) AS balance
      FROM item_master i
      LEFT JOIN inventory_transaction iv ON iv.item_id = i.item_id
      WHERE i.is_active = true AND i.safety_stock > 0
      GROUP BY i.item_id
      HAVING COALESCE(SUM(CASE WHEN iv.txn_type = 'IN' THEN iv.qty ELSE 0 END), 0) -
             COALESCE(SUM(CASE WHEN iv.txn_type = 'OUT' THEN iv.qty ELSE 0 END), 0) < i.safety_stock
    `);
    if (belowSafety.rows.length > 0) {
      checks.push({
        id: 'inventory-below-safety',
        category: '재고',
        severity: 'warning',
        title: '안전재고 미달 품목',
        description: '현 재고량이 설정된 안전재고 기준 미만',
        count: belowSafety.rows.length,
        details: belowSafety.rows,
      });
    }

    // 5-2. 당월 재고마감 미실시
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const monthLabel = `${curYear}-${String(curMonth).padStart(2, '0')}`;
    const closingCheck = await safeQuery(
      `SELECT closing_id, closing_year, closing_month, status FROM inventory_closing WHERE closing_year = $1 AND closing_month = $2 LIMIT 1`,
      [curYear, curMonth]
    );
    if (closingCheck.rows.length === 0 || closingCheck.rows[0].status === 'draft') {
      checks.push({
        id: 'inventory-closing-pending',
        category: '재고',
        severity: 'info',
        title: `${monthLabel} 월 재고마감 미완료`,
        description: closingCheck.rows.length === 0
          ? '당월 재고마감이 아직 시작되지 않음'
          : `현재 상태: ${closingCheck.rows[0].status}`,
        count: 1,
        details: closingCheck.rows,
      });
    }

    // ========================================
    // 6. 출하 관련 점검
    // ========================================

    // 6-1. 출하(SHP) 작업지시 중 납품처 미기재
    const shipNoClient = await safeQuery(`
      SELECT wo_id, wo_number, wo_date, status, customer_name
      FROM work_order
      WHERE process_code = 'SHP'
        AND status IN ('IN_PROGRESS', 'COMPLETED')
        AND (customer_name IS NULL OR customer_name = '')
      ORDER BY wo_date DESC LIMIT 50
    `);
    if (shipNoClient.rows.length > 0) {
      checks.push({
        id: 'ship-no-client',
        category: '출하',
        severity: 'warning',
        title: '출하 건 납품처 미기재',
        description: '출하 작업지시에 납품처가 입력되지 않음',
        count: shipNoClient.rows.length,
        details: shipNoClient.rows,
      });
    }

    // 6-2. 출하 완료인데 LOT번호 없음
    const shipNoLot = await safeQuery(`
      SELECT wo_id, wo_number, wo_date, customer_name
      FROM work_order
      WHERE process_code = 'SHP'
        AND status = 'COMPLETED'
        AND (lot_number IS NULL OR lot_number = '')
      ORDER BY wo_date DESC LIMIT 50
    `);
    if (shipNoLot.rows.length > 0) {
      checks.push({
        id: 'ship-no-lot',
        category: '출하',
        severity: 'critical',
        title: '출하 완료 건 LOT번호 미부여',
        description: '출하 완료인데 출하 LOT번호가 없어 추적 불가',
        count: shipNoLot.rows.length,
        details: shipNoLot.rows,
      });
    }

    // ========================================
    // 7. 자주검사 관련 점검
    // ========================================

    // 7-1. 진행중 작업지시 자주검사 미실시
    const woNoSelfInsp = await safeQuery(`
      SELECT w.wo_id, w.wo_number, w.process_code, w.wo_date
      FROM work_order w
      LEFT JOIN self_inspection si ON si.wo_id = w.wo_id
      WHERE w.status = 'IN_PROGRESS'
        AND w.process_code IN ('EXT', 'CUT', 'ASM')
        AND si.self_insp_id IS NULL
      ORDER BY w.wo_date DESC LIMIT 50
    `);
    if (woNoSelfInsp.rows.length > 0) {
      checks.push({
        id: 'wo-no-self-insp',
        category: '자주검사',
        severity: 'info',
        title: '진행중 작업지시 자주검사 미기록',
        description: '공정 진행중이나 작업자 자주검사 기록이 없음',
        count: woNoSelfInsp.rows.length,
        details: woNoSelfInsp.rows,
      });
    }

    // Summary counts
    const summary = {
      total: checks.reduce((s, c) => s + c.count, 0),
      critical: checks.filter(c => c.severity === 'critical').reduce((s, c) => s + c.count, 0),
      warning: checks.filter(c => c.severity === 'warning').reduce((s, c) => s + c.count, 0),
      info: checks.filter(c => c.severity === 'info').reduce((s, c) => s + c.count, 0),
      by_category: {} as Record<string, number>,
    };
    for (const c of checks) {
      summary.by_category[c.category] = (summary.by_category[c.category] || 0) + c.count;
    }

    return { data: checks, summary };
  });
}
