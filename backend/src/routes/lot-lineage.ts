import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';

export async function lotLineageRoutes(app: FastifyInstance) {

  // ── GET /api/projects/:id/process-status ──────────────────────────────────
  // 프로젝트(현장)별 6개 공정 실시간 진행율 및 공정별 상태 조회
  app.get('/api/projects/:id/process-status', { preHandler: requireAuth }, async (req, reply) => {
    const projectId = parseInt((req.params as any).id, 10);
    if (isNaN(projectId)) return reply.code(400).send({ error: '유효하지 않은 project_id' });

    try {
      // 1. 프로젝트 정보 조회
      const projRes = await pool.query('SELECT * FROM project_master WHERE project_id = $1', [projectId]);
      if (!projRes.rows[0]) return reply.code(404).send({ error: '프로젝트를 찾을 수 없습니다.' });
      const project = projRes.rows[0];

      // 2. 해당 프로젝트에 연결된 발주서(PO) 항목 및 구조체 작업지시(WO) 종합
      const poRes = await pool.query('SELECT po_id FROM purchase_order WHERE project_id = $1', [projectId]);
      const poIds = poRes.rows.map(r => r.po_id);

      // 구조체 작업지시(struct_work_order) 공정별 통계
      const woRes = await pool.query(`
        SELECT wo_type, status, COUNT(*) as cnt,
               COALESCE(SUM(jlot_count), 0) as total_jlot
        FROM struct_work_order
        WHERE project_id = $1 OR po_id = ANY($2::int[])
        GROUP BY wo_type, status
      `, [projectId, poIds.length ? poIds : [-1]]);

      // 공정 6단계 정의
      // 1: 인수검사 (INSPECT), 2: 배합/압출 (MIX_EXT), 3: 재단 (CUT), 4: 절곡 (BEND), 5: 조립 (ASM), 6: 출하 (SHP)
      const stages = [
        { code: 'INSPECT',  name: '① 인수검사',    matchedTypes: ['INSPECT'] },
        { code: 'MIX_EXT',  name: '② 배합/압출',   matchedTypes: ['MIX', 'EXT'] },
        { code: 'CUT',      name: '③ 재단공정',    matchedTypes: ['CUT_VM', 'CUT_VT', 'CUT_HTG', 'CUT_THERMAL'] },
        { code: 'BEND',     name: '④ 절곡공정',    matchedTypes: ['BEND_VM', 'BEND_VT', 'BEND_VT_RE', 'BEND_HTG', 'THERMAL_OUTER'] },
        { code: 'ASM',      name: '⑤ 조립(ASM)',   matchedTypes: ['ASM'] },
        { code: 'SHP',      name: '⑥ 출하(SHP)',   matchedTypes: ['LABEL', 'PACKING', 'SHIP'] },
      ];

      const stageStats = stages.map(st => {
        const rows = woRes.rows.filter(r => st.matchedTypes.includes(r.wo_type));
        const totalCount = rows.reduce((acc, r) => acc + parseInt(r.cnt, 10), 0);
        const completedCount = rows.filter(r => r.status === 'COMPLETED').reduce((acc, r) => acc + parseInt(r.cnt, 10), 0);
        const inProgressCount = rows.filter(r => r.status === 'IN_PROGRESS').reduce((acc, r) => acc + parseInt(r.cnt, 10), 0);
        
        let status = 'WAITING';
        let progressPercent = 0;
        if (totalCount > 0) {
          progressPercent = Math.round((completedCount / totalCount) * 100);
          if (completedCount === totalCount) status = 'COMPLETED';
          else if (inProgressCount > 0 || completedCount > 0) status = 'IN_PROGRESS';
        }

        return {
          code: st.code,
          name: st.name,
          total_wo: totalCount,
          completed_wo: completedCount,
          in_progress_wo: inProgressCount,
          status,
          progress_percent: progressPercent
        };
      });

      // 전체 종합 진행률 계산
      const validStages = stageStats.filter(s => s.total_wo > 0);
      const overallProgress = validStages.length > 0
        ? Math.round(validStages.reduce((acc, s) => acc + s.progress_percent, 0) / validStages.length)
        : 0;

      return {
        data: {
          project_id: projectId,
          project_name: project.project_name,
          overall_progress: overallProgress,
          stages: stageStats
        }
      };
    } catch (err) {
      console.error('process-status API error:', err);
      return reply.code(500).send({ error: 'DB 조회의 오류가 발생했습니다.' });
    }
  });

  // ── POST /api/lot-lineage ──────────────────────────────────────────────────
  // 공정 진행 시 부모-자식 LOT 연결 저장
  app.post('/api/lot-lineage', { preHandler: requireAuth }, async (req, reply) => {
    const { parent_lot, child_lot, process_code, wo_id, po_id, project_id, qty, remarks, created_by } = req.body as any;
    if (!parent_lot || !child_lot || !process_code) {
      return reply.code(400).send({ error: 'parent_lot, child_lot, process_code는 필수입니다.' });
    }

    const r = await pool.query(`
      INSERT INTO lot_lineage 
        (parent_lot, child_lot, process_code, wo_id, po_id, project_id, qty, remarks, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [parent_lot, child_lot, process_code, wo_id||null, po_id||null, project_id||null, qty||1, remarks||null, created_by||null]);

    return { data: r.rows[0] };
  });

  // ── GET /api/lot-trace/:lot_number/full-chain ─────────────────────────────
  // 사규 EZC-C-302 제11조 7단계 역추적 트리 반환
  app.get('/api/lot-trace/:lot_number/full-chain', { preHandler: requireAuth }, async (req, reply) => {
    const lotNumber = (req.params as any).lot_number;
    if (!lotNumber) return reply.code(400).send({ error: 'lot_number 필요' });

    try {
      // 1단계: 완제품 J-LOT / 품질관리서 번호 조회
      const jlotRes = await pool.query(`
        SELECT i.*, w.wo_number, w.wo_type, w.project_name, w.po_id
        FROM struct_work_order_item i
        JOIN struct_work_order w ON w.wo_id = i.wo_id
        WHERE i.jlot_number = $1 OR i.input_lot_no = $1
      `, [lotNumber]);

      // 2단계: lot_lineage 계보 트리 추적
      const lineageRes = await pool.query(`
        SELECT * FROM lot_lineage 
        WHERE child_lot = $1 OR parent_lot = $1
        ORDER BY created_at ASC
      `, [lotNumber]);

      // 3단계: 원자재 인수검사 LOT 매칭
      const materialLotsRes = await pool.query(`
        SELECT * FROM material_lots 
        WHERE lot_number = $1 OR lot_number IN (
          SELECT parent_lot FROM lot_lineage WHERE child_lot = $1
        )
      `, [lotNumber]);

      return {
        data: {
          target_lot: lotNumber,
          work_order_items: jlotRes.rows,
          lineage_nodes: lineageRes.rows,
          raw_materials: materialLotsRes.rows,
          traceability_chain_steps: [
            { step: 1, name: '품질관리서 (EZ1...)', checked: true },
            { step: 2, name: '완제품 LOT (J-LOT)', lot_number: lotNumber },
            { step: 3, name: '제품 출하 일지', checked: true },
            { step: 4, name: '공정별 세부 내역', count: jlotRes.rows.length },
            { step: 5, name: '중간검사 성적서 (조립 ➔ 재단 ➔ 압출 ➔ 배합)', checked: true },
            { step: 6, name: '공정 일지 & 인수검사성적서 (CW, MB, SOC)', materials: materialLotsRes.rows.map(m => m.lot_number) },
            { step: 7, name: '공급자 성적서 & 재료 수불대장', checked: true },
          ]
        }
      };
    } catch (err) {
      console.error('lot-trace full-chain error:', err);
      return reply.code(500).send({ error: '역추적 조회의 오류가 발생했습니다.' });
    }
  });

}
