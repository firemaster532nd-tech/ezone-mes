import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import path from 'path';
import fs from 'fs';

export async function certificationRoutes(app: FastifyInstance) {
  // VS-01 누락 보정 (2차 인정 0310, VS200+VG200 2소켓)
  await pool.query(`
    INSERT INTO certification_master (cert_number, product_group, structure_name, structure_code, install_position, fire_rating, socket_name, cert_area_sqmm, opening_w_mm, opening_h_mm, penetration_w_mm, penetration_h_mm, gap_limit_mm, gap_direction, install_qty, sheet_thickness_min, sheet_thickness_prod, cw_density_min, cw_density_prod, cert_version)
    VALUES ('FS-MP25-0310-2', 'MP', 'EZ-F.B-POSMAC Duct-VS-01', 'VS-01', '수직벽체', '차열 2시간', 'VS200+VG200', 2025000, 2700, 750, 2600, 650, 50, 'MAX', 2, 5.0, 5.0, 120, 120, '0310')
    ON CONFLICT (cert_number) DO NOTHING
  `);

  // BD 플래싱 전용 아이템 선등록 (bom_master INSERT 전에 필요)
  await pool.query(`
    INSERT INTO item_master (item_code, item_name, item_category, item_subcategory, spec, unit)
    VALUES
      ('FP-BD-FL-SUS',  'BD플래싱(SUS304)',         'FP', 'BD플래싱', 'SUS304 t0.5, W190×L380',      'EA'),
      ('FP-BD-FL-GI-L', 'BD플래싱(아연도금,대형)',   'FP', 'BD플래싱', '아연도금 t1.6, W175×L1100',   'EA'),
      ('FP-BD-FL-GI-S', 'BD플래싱(아연도금,소형)',   'FP', 'BD플래싱', '아연도금 t1.6, W95×L195',     'EA')
    ON CONFLICT (item_code) DO NOTHING
  `);

  // BD 구조 고정 BOM 등록 (인정서 3.3 기준)
  // cert_id는 런타임에서 조회
  const bdCerts = await pool.query(`SELECT cert_id, structure_code FROM certification_master WHERE product_group = 'BD'`);
  for (const bd of bdCerts.rows) {
    // item_id NULL이 하나라도 있으면 전체 삭제 후 재등록
    const hasNull = await pool.query(`SELECT COUNT(*) AS cnt FROM bom_master WHERE cert_id = $1 AND item_id IS NULL`, [bd.cert_id]);
    const hasAny = await pool.query(`SELECT COUNT(*) AS cnt FROM bom_master WHERE cert_id = $1`, [bd.cert_id]);
    if (parseInt(hasAny.rows[0].cnt) > 0 && parseInt(hasNull.rows[0].cnt) === 0) continue; // 전부 정상
    await pool.query(`DELETE FROM bom_master WHERE cert_id = $1`, [bd.cert_id]); // 불완전 또는 없는 데이터 삭제

    if (bd.structure_code === 'EZ-BD-CV-1S') {
      // CV-1S(200A): 틈새복합시트150H(상하/좌우) + SUS304플래싱x4 + 실란트 + 세라믹단열재
      await pool.query(`
        INSERT INTO bom_master (cert_id, component_name, item_id, qty_per_unit, spec_detail, sort_order) VALUES
        ($1, '틈새복합시트(상하) 차열시트', (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), 4, '밀도1.2g/cm³, t5.0, W125, L300, 상하2세트×2개', 1),
        ($1, '틈새복합시트(상하) 세라믹',   (SELECT item_id FROM item_master WHERE item_code='SM-CW-96'),  2, '96K, t25, H150, L300, 상하2세트',               2),
        ($1, '틈새복합시트(좌우) 차열시트', (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), 4, '밀도1.2g/cm³, t5.0, W125, L230, 좌우2세트×2개', 3),
        ($1, '틈새복합시트(좌우) 세라믹',   (SELECT item_id FROM item_master WHERE item_code='SM-CW-96'),  2, '96K, t25, H150, L230, 좌우2세트',               4),
        ($1, '방화플래싱(SUS304)',          (SELECT item_id FROM item_master WHERE item_code='FP-BD-FL-SUS'), 4, 'SUS304 t0.5, W190×L380 + 차열시트', 5),
        ($1, '실란트',                      (SELECT item_id FROM item_master WHERE item_code='SM-SIL'),    1, 'KS F 4910 F-12.5E',                              6),
        ($1, '지지구조 세라믹단열재',       (SELECT item_id FROM item_master WHERE item_code='SM-CW-96'),  2, '96K, t25, W600, 양면대칭',                       7)
      `, [bd.cert_id]);
    } else if (bd.structure_code === 'EZ-BD-RV-3S') {
      // RV-3S(025M): 틈새복합시트(상하/좌우/틈새) + 아연도금플래싱(상하/좌우) + 실란트 + 세라믹단열재
      await pool.query(`
        INSERT INTO bom_master (cert_id, component_name, item_id, qty_per_unit, spec_detail, sort_order) VALUES
        ($1, '틈새복합시트(상하) 차열시트', (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), 4, '밀도1.2g/cm³, t5.0, W125, L1000, 상하×4개',      1),
        ($1, '틈새복합시트(상하) 세라믹',   (SELECT item_id FROM item_master WHERE item_code='SM-CW-96'),  2, '96K, t25, H150, L1000, 상하×2개',                2),
        ($1, '틈새복합시트(좌우) 차열시트', (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), 4, '밀도1.2g/cm³, t5.0, W125, L180, 좌우×4개',       3),
        ($1, '틈새복합시트(좌우) 세라믹',   (SELECT item_id FROM item_master WHERE item_code='SM-CW-96'),  2, '96K, t25, H150, L180, 좌우×2개',                 4),
        ($1, '틈새 차열시트',               (SELECT item_id FROM item_master WHERE item_code='SA-CUT-SK'), 4, '밀도1.2g/cm³, t5.0, W125, L180, 틈새×4개',       5),
        ($1, '방화플래싱 상하(아연도금)',    (SELECT item_id FROM item_master WHERE item_code='FP-BD-FL-GI-L'), 4, '아연도금 t1.6, W175×L1100 + 차열시트', 6),
        ($1, '방화플래싱 좌우(아연도금)',    (SELECT item_id FROM item_master WHERE item_code='FP-BD-FL-GI-S'), 4, '아연도금 t1.6, W95×L195 + 차열시트',   7),
        ($1, '실란트',                      (SELECT item_id FROM item_master WHERE item_code='SM-SIL'),    1, 'KS F 4910 F-12.5E',                               8),
        ($1, '지지구조 세라믹단열재',       (SELECT item_id FROM item_master WHERE item_code='SM-CW-96'),  2, '96K, t25, W600, 양면대칭',                        9)
      `, [bd.cert_id]);
    }
    console.log(`[BD BOM] ${bd.structure_code} BOM 등록 완료`);
  }

  // GET /api/certifications - 인정구조 목록
  app.get('/api/certifications', async (request, reply) => {
    const { product_group } = request.query as { product_group?: string };

    let query = 'SELECT * FROM certification_master WHERE is_active = true';
    const params: string[] = [];

    if (product_group) {
      params.push(product_group);
      query += ` AND product_group = $${params.length}`;
    }

    query += ' ORDER BY cert_id';

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });

  // GET /api/certifications/:id - 인정구조 상세 + BOM + 규칙
  app.get('/api/certifications/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const certId = parseInt(id, 10);

    const [certResult, bomResult, rulesResult] = await Promise.all([
      pool.query('SELECT * FROM certification_master WHERE cert_id = $1', [certId]),
      pool.query(
        `SELECT b.*, i.item_name, i.item_code
         FROM bom_master b
         LEFT JOIN item_master i ON i.item_id = b.item_id
         WHERE b.cert_id = $1
         ORDER BY b.sort_order`,
        [certId]
      ),
      pool.query(
        'SELECT * FROM certification_rule WHERE cert_id = $1 ORDER BY rule_type',
        [certId]
      ),
    ]);

    if (certResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '인정구조를 찾을 수 없습니다.' });
    }

    return {
      data: {
        ...certResult.rows[0],
        bom: bomResult.rows,
        rules: rulesResult.rows,
      },
    };
  });

  // PATCH /api/certifications/:id - 인정구조 수정
  app.patch('/api/certifications/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const certId = parseInt(id, 10);
    const body = request.body as Record<string, unknown>;

    const allowedFields = [
      'structure_name', 'fire_rating', 'socket_name',
      'cert_area_sqmm', 'opening_w_mm', 'opening_h_mm',
      'penetration_w_mm', 'penetration_h_mm', 'gap_limit_mm',
      'gap_direction', 'install_qty', 'sheet_thickness_min',
      'sheet_thickness_prod', 'cw_density_min', 'cw_density_prod',
      'is_active', 'file_path',
    ];

    const updates: string[] = [];
    const values: unknown[] = [];

    for (const field of allowedFields) {
      if (field in body) {
        values.push(body[field]);
        updates.push(`${field} = $${values.length}`);
      }
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: '수정할 항목이 없습니다.' });
    }

    values.push(certId);
    const query = `UPDATE certification_master SET ${updates.join(', ')} WHERE cert_id = $${values.length} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '인정구조를 찾을 수 없습니다.' });
    }

    return { data: result.rows[0] };
  });

  // GET /api/certifications/:id/document - 인정서 PDF 파일 서빙
  app.get('/api/certifications/:id/document', async (request, reply) => {
    const { id } = request.params as { id: string };
    const certId = parseInt(id, 10);

    const result = await pool.query(
      'SELECT cert_number, structure_name, file_path FROM certification_master WHERE cert_id = $1',
      [certId]
    );

    if (result.rows.length === 0 || !result.rows[0].file_path) {
      return reply.status(404).send({ error: 'Not Found', message: '인정서 파일이 등록되지 않았습니다.' });
    }

    const { cert_number, structure_name, file_path } = result.rows[0];
    // UPLOAD_DIR은 backend 기준 상위 폴더의 upload
    const uploadDir = path.resolve(process.cwd(), '..', 'upload');
    const absPath = path.join(uploadDir, file_path);

    if (!fs.existsSync(absPath)) {
      return reply.status(404).send({ error: 'File Not Found', message: `파일을 찾을 수 없습니다: ${file_path}` });
    }

    const filename = encodeURIComponent(`${cert_number}_${structure_name}_품질인정서.pdf`);
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename*=UTF-8''${filename}`)
      .send(fs.createReadStream(absPath));
  });
}
