import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

export async function qualityReportRoutes(app: FastifyInstance) {
  /**
   * GET /api/quality-reports/:shipmentId - 품질관리서 데이터 조회
   * 출하 건에 대한 품질관리서 생성용 데이터를 종합 조회
   * - 출하 정보 (출하번호, 일자, 고객, 수량)
   * - 제품 정보 (인정구조, 품목, LOT번호)
   * - BOM 구성
   * - 인수검사 결과 (원재료/부자재)
   * - 중간검사 결과 (공정검사)
   * - LOT 추적 (역추적: 원자재→완제품)
   */
  app.get('/api/quality-reports/:shipmentId', async (request, reply) => {
    const { shipmentId } = request.params as { shipmentId: string };
    const woId = parseInt(shipmentId, 10);

    // 1. 출하 정보
    const shipResult = await pool.query(`
      SELECT w.*, c.cert_number, c.structure_code, c.structure_name, c.product_group,
             c.socket_name, c.opening_w_mm, c.opening_h_mm, c.gap_limit_mm,
             c.sheet_thickness_min, c.cw_density_min, c.cert_version,
             i.item_name, i.item_code, i.item_category, i.unit,
             lt.lot_number as ship_lot, lt.lot_id as ship_lot_id
      FROM work_order w
      LEFT JOIN certification_master c ON c.cert_id = w.cert_id
      LEFT JOIN item_master i ON i.item_id = w.item_id
      LEFT JOIN lot_transaction lt ON lt.wo_id = w.wo_id
      WHERE w.wo_id = $1
    `, [woId]);

    if (shipResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '출하 정보를 찾을 수 없습니다.' });
    }
    const shipment = shipResult.rows[0];

    // 2. BOM 구성 (인정구조 기반)
    let bom: any[] = [];
    if (shipment.cert_id) {
      const bomResult = await pool.query(`
        SELECT b.*, i.item_name, i.item_code, i.item_category, i.unit
        FROM bom_master b
        LEFT JOIN item_master i ON i.item_id = b.item_id
        WHERE b.cert_id = $1 AND b.is_applicable = true
        ORDER BY b.sort_order
      `, [shipment.cert_id]);
      bom = bomResult.rows;
    }

    // 3. LOT 계보 역추적 (출하LOT → 원재료LOT)
    let lotTrace: any[] = [];
    if (shipment.ship_lot_id) {
      const traceResult = await pool.query(`
        WITH RECURSIVE trace AS (
          SELECT lt.lot_id, lt.lot_number, lt.lot_type, lt.item_id, lt.supplier_lot,
                 lt.inspection_result, lt.qty, lt.wo_id, 0 as depth
          FROM lot_transaction lt
          WHERE lt.lot_id = $1
          UNION ALL
          SELECT p.lot_id, p.lot_number, p.lot_type, p.item_id, p.supplier_lot,
                 p.inspection_result, p.qty, p.wo_id, t.depth + 1
          FROM lot_genealogy g
          JOIN lot_transaction p ON p.lot_id = g.parent_lot_id
          JOIN trace t ON t.lot_id = g.child_lot_id
          WHERE t.depth < 10
        )
        SELECT t.*, i.item_name, i.item_code, i.item_category
        FROM trace t
        LEFT JOIN item_master i ON i.item_id = t.item_id
        ORDER BY t.depth DESC
      `, [shipment.ship_lot_id]);
      lotTrace = traceResult.rows;
    }

    // 4. 관련 인수검사 결과 (LOT 기반)
    const lotIds = lotTrace.filter(l => l.lot_type === 'IN').map(l => l.lot_id);
    let incomingInspections: any[] = [];
    if (lotIds.length > 0) {
      const inspResult = await pool.query(`
        SELECT ins.*, i.item_name, i.item_code, lt.lot_number, lt.supplier_lot,
               json_agg(json_build_object(
                 'quality_item', d.quality_item,
                 'check_item', d.check_item,
                 'cert_standard', d.cert_standard,
                 'measured_n1', d.measured_n1,
                 'measured_n2', d.measured_n2,
                 'measured_n3', d.measured_n3,
                 'item_result', d.item_result
               ) ORDER BY d.item_no) as details
        FROM inspection ins
        LEFT JOIN lot_transaction lt ON lt.lot_id = ins.lot_id
        LEFT JOIN item_master i ON i.item_id = lt.item_id
        LEFT JOIN inspection_detail d ON d.insp_id = ins.insp_id
        WHERE ins.lot_id = ANY($1) AND ins.insp_type = 'INCOMING'
        GROUP BY ins.insp_id, i.item_name, i.item_code, lt.lot_number, lt.supplier_lot
        ORDER BY ins.inspected_at
      `, [lotIds]);
      incomingInspections = inspResult.rows;
    }

    // 5. 관련 중간검사 결과 (작업지시 기반)
    const woIds = lotTrace.filter(l => l.wo_id).map(l => l.wo_id);
    let processInspections: any[] = [];
    if (woIds.length > 0) {
      const procResult = await pool.query(`
        SELECT ins.*, lt.lot_number,
               json_agg(json_build_object(
                 'quality_item', d.quality_item,
                 'check_item', d.check_item,
                 'cert_standard', d.cert_standard,
                 'measured_n1', d.measured_n1,
                 'measured_n2', d.measured_n2,
                 'measured_n3', d.measured_n3,
                 'item_result', d.item_result
               ) ORDER BY d.item_no) as details
        FROM inspection ins
        LEFT JOIN lot_transaction lt ON lt.lot_id = ins.lot_id
        LEFT JOIN inspection_detail d ON d.insp_id = ins.insp_id
        WHERE ins.wo_id = ANY($1) AND ins.insp_type IN ('PROCESS', 'FINAL')
        GROUP BY ins.insp_id, lt.lot_number
        ORDER BY ins.inspected_at
      `, [woIds]);
      processInspections = procResult.rows;
    }

    // 6. 인정기준 규칙
    let certRules: any[] = [];
    if (shipment.cert_id) {
      const rulesResult = await pool.query(`
        SELECT * FROM certification_rule WHERE cert_id = $1 ORDER BY rule_type
      `, [shipment.cert_id]);
      certRules = rulesResult.rows;
    }

    return {
      data: {
        shipment,
        bom,
        lotTrace,
        incomingInspections,
        processInspections,
        certRules,
        generatedAt: new Date().toISOString(),
      },
    };
  });

  // GET /api/quality-reports - 품질관리서 목록 (출하 완료건)
  app.get('/api/quality-reports', async (request) => {
    const { from, to } = request.query as { from?: string; to?: string };

    let query = `
      SELECT w.wo_id, w.wo_number, w.wo_date, w.status, w.actual_qty, w.purpose as customer,
             w.spec_detail as destination, w.inspector, w.completed_at,
             c.cert_number, c.structure_code, c.structure_name,
             i.item_name, i.item_code,
             lt.lot_number
      FROM work_order w
      LEFT JOIN certification_master c ON c.cert_id = w.cert_id
      LEFT JOIN item_master i ON i.item_id = w.item_id
      LEFT JOIN lot_transaction lt ON lt.wo_id = w.wo_id
      WHERE w.process_code = 'SHP'
    `;
    const params: unknown[] = [];

    if (from) {
      params.push(from);
      query += ` AND w.wo_date >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      query += ` AND w.wo_date <= $${params.length}`;
    }

    query += ' ORDER BY w.wo_date DESC, w.wo_id DESC';

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });
}
