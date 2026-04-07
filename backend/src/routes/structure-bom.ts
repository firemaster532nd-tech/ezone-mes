import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

/**
 * BOM 계층구조 API (2026.03.30 BOM 재설계)
 * - structure_bom: 구조 → 출하구성품 그룹 (Level 0→1)
 * - product_bom: 완제품 → 구성자재 (Level 1→2)
 */
export async function structureBomRoutes(app: FastifyInstance) {

  // GET /api/structure-bom - 전체 구조별 BOM 목록
  app.get('/api/structure-bom', async () => {
    const result = await pool.query(`
      SELECT sb.*, cm.structure_code, cm.cert_number, cm.structure_name,
             cm.install_position, cm.fire_rating,
             im.item_code AS output_item_code, im.item_name AS output_item_name
      FROM structure_bom sb
      JOIN certification_master cm ON cm.cert_id = sb.cert_id
      LEFT JOIN item_master im ON im.item_id = sb.output_item_id
      WHERE sb.is_active = true
      ORDER BY sb.cert_id, sb.sort_order
    `);
    return { data: result.rows, total: result.rows.length };
  });

  // GET /api/structure-bom/:certId - 특정 구조의 BOM 트리 (2레벨)
  app.get('/api/structure-bom/:certId', async (request, reply) => {
    const { certId } = request.params as { certId: string };
    const cid = parseInt(certId, 10);

    // 구조 정보
    const certRes = await pool.query(
      `SELECT * FROM certification_master WHERE cert_id = $1`, [cid]
    );
    if (certRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Structure not found' });
    }
    const structure = certRes.rows[0];

    // Level 1: structure_bom 그룹
    const groups = await pool.query(`
      SELECT sb.*, im.item_code AS output_item_code, im.item_name AS output_item_name
      FROM structure_bom sb
      LEFT JOIN item_master im ON im.item_id = sb.output_item_id
      WHERE sb.cert_id = $1 AND sb.is_active = true
      ORDER BY sb.sort_order
    `, [cid]);

    // Level 2: product_bom 구성자재 (모든 그룹의)
    const sbomIds = groups.rows.map((g: any) => g.sbom_id);
    let components: any[] = [];
    if (sbomIds.length > 0) {
      const compRes = await pool.query(`
        SELECT pb.*, im.item_code, im.item_name, im.item_category, im.unit AS item_unit
        FROM product_bom pb
        JOIN item_master im ON im.item_id = pb.item_id
        WHERE pb.sbom_id = ANY($1) AND pb.is_active = true
        ORDER BY pb.sbom_id, pb.sort_order
      `, [sbomIds]);
      components = compRes.rows;
    }

    // 트리 구조로 조합
    const tree = groups.rows.map((g: any) => ({
      ...g,
      components: components.filter((c: any) => c.sbom_id === g.sbom_id),
    }));

    return {
      data: {
        structure,
        groups: tree,
        summary: {
          total_groups: groups.rows.length,
          purchase_groups: groups.rows.filter((g: any) => g.source_type === 'PURCHASE').length,
          manufacture_groups: groups.rows.filter((g: any) => g.source_type === 'MANUFACTURE').length,
        },
      },
    };
  });

  // GET /api/structure-bom/:certId/procurement - 구매 필요 자재 목록 (발주용)
  app.get('/api/structure-bom/:certId/procurement', async (request) => {
    const { certId } = request.params as { certId: string };
    const cid = parseInt(certId, 10);

    // Level 1 구매품 (지지구조단열재, 실란트, 고정자재 등)
    const level1Purchase = await pool.query(`
      SELECT sb.group_code, sb.group_name, sb.group_type, sb.qty_fixed,
             im.item_id, im.item_code, im.item_name, im.unit, im.item_category
      FROM structure_bom sb
      JOIN item_master im ON im.item_id = sb.output_item_id
      WHERE sb.cert_id = $1 AND sb.source_type = 'PURCHASE' AND sb.is_active = true
      ORDER BY sb.sort_order
    `, [cid]);

    // Level 2 구매품 (완제품 내 구매 구성품: 소켓본체, 세라믹, 브라켓 등)
    const level2Purchase = await pool.query(`
      SELECT sb.group_code, sb.group_name, pb.component_name, pb.component_type,
             pb.qty_fixed, pb.qty_formula, pb.spec_detail,
             im.item_id, im.item_code, im.item_name, im.unit, im.item_category
      FROM product_bom pb
      JOIN structure_bom sb ON sb.sbom_id = pb.sbom_id
      JOIN item_master im ON im.item_id = pb.item_id
      WHERE sb.cert_id = $1 AND pb.source_type = 'PURCHASE' AND pb.is_active = true
      ORDER BY sb.sort_order, pb.sort_order
    `, [cid]);

    return {
      data: {
        level1_purchase: level1Purchase.rows,
        level2_purchase: level2Purchase.rows,
        total_purchase_items: level1Purchase.rows.length + level2Purchase.rows.length,
      },
    };
  });

  // GET /api/structure-bom/:certId/manufacture - 자체제조 필요 자재 목록 (생산지시용)
  app.get('/api/structure-bom/:certId/manufacture', async (request) => {
    const { certId } = request.params as { certId: string };
    const cid = parseInt(certId, 10);

    const result = await pool.query(`
      SELECT sb.group_code, sb.group_name, pb.component_name, pb.component_type,
             pb.qty_fixed, pb.qty_formula, pb.length_formula, pb.spec_detail,
             im.item_id, im.item_code, im.item_name, im.unit, im.item_category
      FROM product_bom pb
      JOIN structure_bom sb ON sb.sbom_id = pb.sbom_id
      JOIN item_master im ON im.item_id = pb.item_id
      WHERE sb.cert_id = $1 AND pb.source_type = 'MANUFACTURE' AND pb.is_active = true
      ORDER BY sb.sort_order, pb.sort_order
    `, [cid]);

    return { data: result.rows, total: result.rows.length };
  });

  // GET /api/structure-bom/compare - 전 구조 비교표 (어떤 구조에 뭐가 포함되는지)
  app.get('/api/structure-bom/compare', async () => {
    const result = await pool.query(`
      SELECT cm.cert_id, cm.structure_code, cm.structure_name, cm.install_position,
             sb.group_code, sb.group_name, sb.group_type, sb.source_type,
             im.item_code, sb.qty_fixed, sb.qty_formula
      FROM certification_master cm
      LEFT JOIN structure_bom sb ON sb.cert_id = cm.cert_id AND sb.is_active = true
      LEFT JOIN item_master im ON im.item_id = sb.output_item_id
      ORDER BY cm.cert_id, sb.sort_order
    `);
    return { data: result.rows };
  });
}
