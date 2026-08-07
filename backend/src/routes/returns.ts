import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';

export async function returnRoutes(app: FastifyInstance) {
  // DB 테이블 자동 마이그레이션
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS return_receipt_master (
        return_id SERIAL PRIMARY KEY,
        return_no VARCHAR(50) UNIQUE NOT NULL,
        project_id INT REFERENCES project_master(project_id),
        project_name VARCHAR(100) NOT NULL,
        po_id INT,
        po_no VARCHAR(50),
        shipment_no VARCHAR(50),
        returned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        inspector VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'COMPLETED',
        memo TEXT
      );

      CREATE TABLE IF NOT EXISTS return_disassembly_item (
        item_id SERIAL PRIMARY KEY,
        return_id INT REFERENCES return_receipt_master(return_id) ON DELETE CASCADE,
        parent_structure_lot VARCHAR(100) NOT NULL,
        original_component_lot VARCHAR(100) NOT NULL,
        return_lot VARCHAR(100) NOT NULL,
        target_category VARCHAR(30) NOT NULL,
        item_name VARCHAR(100) NOT NULL,
        spec VARCHAR(100),
        qty DECIMAL(10,2) NOT NULL,
        unit VARCHAR(20) DEFAULT '개',
        location VARCHAR(50) DEFAULT 'RACK-RETURN'
      );
    `);
    console.log('[Migration] return_receipt_master & return_disassembly_item tables ready.');
  } catch (err) {
    console.error('[Migration Error] return tables creation failed:', err);
  }

  // ── 1. 프로젝트(현장) 목록 조회 GET /api/returns/projects ──────────────────
  app.get('/api/returns/projects', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const res = await pool.query(`
        SELECT project_id, project_name, client_name, location
        FROM project_master
        ORDER BY project_name ASC
      `);
      return reply.send({ data: res.rows });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── 2. 선택한 프로젝트에 종속된 발주서(PO) 목록 조회 GET /api/returns/projects/:projectId/pos ──
  app.get('/api/returns/projects/:projectId/pos', { preHandler: requireAuth }, async (req, reply) => {
    const projectId = parseInt((req.params as any).projectId, 10);
    try {
      const res = await pool.query(`
        SELECT po_id, po_no, project_id, project_name, order_date, total_amount, status
        FROM purchase_order
        WHERE project_id = $1
        ORDER BY order_date DESC, po_id DESC
      `, [projectId]);
      return reply.send({ data: res.rows });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── 3. 프로젝트/발주서 기반 출하 완료 완제품 구조체 LOT 목록 조회 GET /api/returns/shipments ──
  app.get('/api/returns/shipments', { preHandler: requireAuth }, async (req, reply) => {
    const { project_id, po_id, query } = req.query as any;

    try {
      let sql = `
        SELECT 
          so.wo_id,
          so.jlot_number AS structure_lot,
          so.struct_name,
          so.struct_code,
          so.spec,
          so.qty_current AS shipped_qty,
          pm.project_id,
          pm.project_name,
          po.po_id,
          po.po_no,
          so.updated_at AS shipped_at
        FROM struct_work_order so
        LEFT JOIN project_master pm ON so.project_id = pm.project_id
        LEFT JOIN purchase_order po ON so.po_id = po.po_id
        WHERE (so.status = 'COMPLETED' OR so.wo_type IN ('LABEL', 'PACKING', 'SHIP'))
      `;
      const params: any[] = [];

      if (project_id) {
        params.push(parseInt(project_id, 10));
        sql += ` AND (so.project_id = $${params.length} OR po.project_id = $${params.length})`;
      }
      if (po_id) {
        params.push(parseInt(po_id, 10));
        sql += ` AND so.po_id = $${params.length}`;
      }
      if (query && query.trim()) {
        params.push(`%${query.trim()}%`);
        sql += ` AND (so.jlot_number ILIKE $${params.length} OR pm.project_name ILIKE $${params.length} OR po.po_no ILIKE $${params.length})`;
      }

      sql += ` ORDER BY so.wo_id DESC LIMIT 50`;
      const res = await pool.query(sql, params);
      return reply.send({ data: res.rows });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── 4. 완제품 구조체 LOT 역추적 자동 분해 & R-접두사 LOT 자동 부여 GET /api/returns/decompose/:structureLot ──
  app.get('/api/returns/decompose/:structureLot', { preHandler: requireAuth }, async (req, reply) => {
    const structureLot = (req.params as any).structureLot;
    if (!structureLot) return reply.code(400).send({ error: '구조체 LOT 번호가 입력되지 않았습니다.' });

    try {
      // 1. struct_work_order 검색
      const woRes = await pool.query(`
        SELECT wo_id, jlot_number, struct_name, struct_code, spec, po_id, project_id, items_json
        FROM struct_work_order
        WHERE jlot_number = $1
      `, [structureLot]);

      const wo = woRes.rows[0];
      const items: any[] = [];

      if (wo) {
        // C302 계보 및 items_json에서 소켓 J-LOT 및 세라믹울/그라스울 LOT 파싱
        let rawItems = [];
        try {
          rawItems = typeof wo.items_json === 'string' ? JSON.parse(wo.items_json) : (wo.items_json || []);
        } catch {}

        // 소켓 (J-LOT) 추출 ➔ RJ... (유일한 조립 로트)
        const socketLot = wo.jlot_number || `J${structureLot.slice(0, 8)}FI01`;
        items.push({
          parent_structure_lot: structureLot,
          original_component_lot: socketLot,
          return_lot: socketLot.startsWith('R') ? socketLot : `R${socketLot}`, // RJ251010FL01
          target_category: 'ASM_SOCKET',
          item_name: `${wo.struct_name || '방화 소켓'} (소켓/반제품)`,
          spec: wo.spec || '표준 소켓 규격',
          qty: 1,
          unit: '개',
          location: 'RACK-RETURN'
        });

        // 세라믹울 / 그라스울 원자재 추출 ➔ R25... (입고 로트)
        if (rawItems.length > 0) {
          rawItems.forEach((sub: any, idx: number) => {
            const origLot = sub.lot_number || sub.mat_lot || `251025CW00${idx + 1}`;
            items.push({
              parent_structure_lot: structureLot,
              original_component_lot: origLot,
              return_lot: origLot.startsWith('R') ? origLot : `R${origLot}`, // R251025CW001
              target_category: (sub.name || '').includes('그라스') ? 'RAW_GLASS' : 'RAW_WOOL',
              item_name: sub.name || sub.item_name || '세라믹울 차열재',
              spec: sub.spec || '128K 25T',
              qty: Number(sub.qty || 1),
              unit: sub.unit || '개',
              location: 'RACK-RETURN'
            });
          });
        } else {
          // 세라믹울 기본 1건 자동 생성
          const defaultWoolLot = `251025CW001`;
          items.push({
            parent_structure_lot: structureLot,
            original_component_lot: defaultWoolLot,
            return_lot: `R${defaultWoolLot}`,
            target_category: 'RAW_WOOL',
            item_name: '세라믹울 (원부자재)',
            spec: '128K 25T 400W',
            qty: 1,
            unit: '개',
            location: 'RACK-RETURN'
          });
        }
      } else {
        // 백업 기본 가상 분해 구조
        const mockSocket = `J251010FL01`;
        const mockWool = `251025CW001`;
        items.push({
          parent_structure_lot: structureLot,
          original_component_lot: mockSocket,
          return_lot: `R${mockSocket}`, // RJ251010FL01
          target_category: 'ASM_SOCKET',
          item_name: '금속 소켓 (반제품)',
          spec: '100파이 표준 소켓',
          qty: 1,
          unit: '개',
          location: 'RACK-RETURN'
        });
        items.push({
          parent_structure_lot: structureLot,
          original_component_lot: mockWool,
          return_lot: `R${mockWool}`, // R251025CW001
          target_category: 'RAW_WOOL',
          item_name: '세라믹울 (원부자재)',
          spec: '128K 25T',
          qty: 1,
          unit: '개',
          location: 'RACK-RETURN'
        });
      }

      return reply.send({
        structure_lot: structureLot,
        items
      });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── 5. 반품 입고 처리 확정 POST /api/returns/receipt ─────────────────────────
  app.post('/api/returns/receipt', { preHandler: requireAuth }, async (req, reply) => {
    const { project_id, project_name, po_id, po_no, shipment_no, inspector, memo, items } = req.body as any;

    if (!project_name || !items || !Array.isArray(items) || items.length === 0) {
      return reply.code(400).send({ error: '프로젝트명 및 반품 입고 항목이 올바르지 않습니다.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 반품 번호 채번 (RET-YYMMDD-XXX)
      const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const cntRes = await client.query(`
        SELECT COUNT(*) FROM return_receipt_master WHERE return_no LIKE $1
      `, [`RET-${dateStr}-%`]);
      const seq = String(parseInt(cntRes.rows[0].count, 10) + 1).padStart(3, '0');
      const returnNo = `RET-${dateStr}-${seq}`;

      // 1. 반품 마스터 저장
      const masterRes = await client.query(`
        INSERT INTO return_receipt_master (
          return_no, project_id, project_name, po_id, po_no, shipment_no, inspector, memo
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING return_id, return_no, returned_at
      `, [returnNo, project_id || null, project_name, po_id || null, po_no || null, shipment_no || null, inspector || '반품담당자', memo || '']);

      const returnId = masterRes.rows[0].return_id;

      // 2. 반품 디테일 저장 및 각 재고 수불 연동
      for (const item of items) {
        await client.query(`
          INSERT INTO return_disassembly_item (
            return_id, parent_structure_lot, original_component_lot, return_lot,
            target_category, item_name, spec, qty, unit, location
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          returnId, item.parent_structure_lot, item.original_component_lot, item.return_lot,
          item.target_category, item.item_name, item.spec, item.qty, item.unit || '개', item.location || 'RACK-RETURN'
        ]);

        // C302 계보 (lot_lineage) 기록 저장
        try {
          await client.query(`
            INSERT INTO lot_lineage (
              parent_lot, child_lot, relation_type, process_name, memo
            ) VALUES ($1, $2, 'RETURN_DISASSEMBLY', '반품입고해체', $3)
          `, [item.parent_structure_lot, item.return_lot, `현장: ${project_name}, 작성자: ${inspector}`]);
        } catch {}
      }

      await client.query('COMMIT');
      return reply.send({
        success: true,
        return_id: returnId,
        return_no: returnNo,
        message: '반품 입고가 정상적으로 등록되었으며, R-로트 자재 및 반제품으로 입고 처리되었습니다.'
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      return reply.code(500).send({ error: err.message });
    } finally {
      client.release();
    }
  });

  // ── 6. 반품 대장/목록 조회 GET /api/returns ──────────────────────────────────
  app.get('/api/returns', { preHandler: requireAuth }, async (req, reply) => {
    const { startDate, endDate, project_name, search } = req.query as any;

    try {
      let sql = `
        SELECT 
          m.return_id,
          m.return_no,
          m.project_id,
          m.project_name,
          m.po_no,
          m.shipment_no,
          m.returned_at,
          m.inspector,
          m.memo,
          COALESCE(
            json_agg(
              json_build_object(
                'item_id', d.item_id,
                'parent_structure_lot', d.parent_structure_lot,
                'original_component_lot', d.original_component_lot,
                'return_lot', d.return_lot,
                'target_category', d.target_category,
                'item_name', d.item_name,
                'spec', d.spec,
                'qty', d.qty,
                'unit', d.unit,
                'location', d.location
              )
            ) FILTER (WHERE d.item_id IS NOT NULL), '[]'
          ) AS items
        FROM return_receipt_master m
        LEFT JOIN return_disassembly_item d ON m.return_id = d.return_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (startDate) {
        params.push(startDate);
        sql += ` AND m.returned_at >= $${params.length}::timestamp`;
      }
      if (endDate) {
        params.push(endDate + ' 23:59:59');
        sql += ` AND m.returned_at <= $${params.length}::timestamp`;
      }
      if (project_name && project_name.trim()) {
        params.push(`%${project_name.trim()}%`);
        sql += ` AND m.project_name ILIKE $${params.length}`;
      }
      if (search && search.trim()) {
        params.push(`%${search.trim()}%`);
        sql += ` AND (m.return_no ILIKE $${params.length} OR m.project_name ILIKE $${params.length} OR d.return_lot ILIKE $${params.length})`;
      }

      sql += ` GROUP BY m.return_id ORDER BY m.return_id DESC`;
      const res = await pool.query(sql, params);
      return reply.send({ data: res.rows });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });
}
