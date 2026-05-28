import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

/** 운영 엑셀 기반 item_master 정리 - 중복 제거 및 엑셀 38건 기준 정합성 확보 */
async function migrateItemMaster() {
  // 1단계: 정규 item_code 목록 (엑셀 기준 + BOM 엔진에서 사용하는 코드)
  const validCodes = [
    // RM 4건
    'RM-EA', 'RM-EP', 'RM-EG50', 'RM-MB',
    // SM - 엑셀 기준 코드
    'SM-STL-I', 'SM-STL-L', 'SM-STL-Z',
    'SM-CW-128', 'SM-CW-100', 'SM-CW-96',
    'SM-CW-96-25W2', 'SM-CW-96-25W3', 'SM-CW-96-50', 'SM-CW-96-38', // 세라믹 96K 규격별
    'SM-CW-128-25',                                                    // 세라믹 128K 블랭킷
    'SM-GW-24', 'SM-GW-24-14', 'SM-GW-24-10',                        // 그라스울 폭별
    'SM-PE-INS', 'SM-SIL', 'SM-FN-SK', 'SM-GP',
    // SM - 시드/BOM 엔진에서 사용하는 코드 (03_seed.sql 기준)
    'SM-GI-I', 'SM-GI-L', 'SM-GI-Z',        // 아연도금강판 (레거시)
    'SM-GI-I-10', 'SM-GI-Z-10', 'SM-GI-L-10', // 아연도금강판 L1000 (추후 -05/-15 확장)
    'SM-GP-10',                                 // 고정자재 L1000
    'SM-CW128', 'SM-CW100', 'SM-CW96',       // 세라믹울 (시드 원본)
    'SM-GW24',                                 // 그라스울 (시드 원본)
    'SM-PE', 'SM-FN', 'SM-SP',               // 보온재/발포소켓/보호철판 (시드 원본, SM-SIL은 위에 이미 있음)
    'SM-SCREW',                                // 피스 (#8×64mm, 소모자재)
    'SM-BRK-TB', 'SM-BRK-MD',                 // 소켓 브라켓 (차열시트 고정용)
    'SM-SK-BODY',                              // 금속소켓 본체 (아연도금강판, product_bom 전개용)
    // SA 7건 + BOM 엔진 코드
    'SA-MIX-MB', 'SA-EXT-5190', 'SA-EXT-65415',
    'SA-EXT-5125I', 'SA-EXT-4125Z', 'SA-CUT-SK', 'SA-CUT-FL',
    'SA-EXT-5125', 'SA-EXT-4125',             // BOM 엔진에서 사용하는 코드
    // FP 20건
    'FP-VT01', 'FP-VS01', 'FP-VT049', 'FP-VT064', 'FP-VA064',
    'FP-VAG169', 'FP-VTI064',
    'FP-HTG169', 'FP-HTG064', 'FP-HTGDC064',
    'FP-FL-I', 'FP-FL-Z', 'FP-FL-L',
    'FP-BD-FL-SUS', 'FP-BD-FL-GI-L', 'FP-BD-FL-GI-S',
    'FP-GAP-SH', 'FP-FN-100A', 'FP-FN-75A', 'FP-STRUCT',
    'FP-TS', 'FP-FN100',                      // 시드 원본 코드
  ];

  // 2단계: 중복/구형 item_code를 비활성화 + 정규 코드를 활성화
  const placeholders = validCodes.map((_, i) => `$${i + 1}`).join(', ');
  await pool.query(
    `UPDATE item_master SET is_active = false WHERE item_code NOT IN (${placeholders})`,
    validCodes
  );
  // 정규 코드 중 비활성화된 항목을 다시 활성화
  await pool.query(
    `UPDATE item_master SET is_active = true WHERE item_code IN (${placeholders}) AND is_active = false`,
    validCodes
  );

  // 3단계: 정규 품목 UPSERT (엑셀 기준 이름/스펙/단위 업데이트)
  // --- Raw Materials (RM) 4건 ---
  await pool.query(`
    INSERT INTO item_master (item_code, item_name, item_category, item_subcategory, spec, unit)
    VALUES
      ('RM-EA',   'EVA-EA33045',            'RM', '배합원료', '배합원료', 'kg'),
      ('RM-EP',   'EVA-EP100',              'RM', '배합원료', '배합원료', 'kg'),
      ('RM-EG50', '팽창흑연 #50',           'RM', '배합원료', '배합원료', 'kg'),
      ('RM-MB',   '난연컴파운드(PE3005MB)', 'RM', '배합원료', '배합원료', 'kg')
    ON CONFLICT (item_code) DO UPDATE SET
      item_name = EXCLUDED.item_name,
      item_subcategory = EXCLUDED.item_subcategory,
      spec = EXCLUDED.spec,
      unit = EXCLUDED.unit,
      is_active = true
  `);

  // --- Sub Materials (SM) 12건 ---
  await pool.query(`
    INSERT INTO item_master (item_code, item_name, item_category, item_subcategory, spec, unit, cert_min_thickness, cert_min_density, value_direction)
    VALUES
      ('SM-STL-I',  '강재류(I형)',       'SM', '강재류',   'W125×L1000, T:0.5', 'EA', 0.5,  NULL,   'MIN'),
      ('SM-STL-L',  '강재류(L형)',       'SM', '강재류',   'W185×L1000, T:0.5', 'EA', 0.5,  NULL,   'MIN'),
      ('SM-STL-Z',  '강재류(Z형)',       'SM', '강재류',   'W215×L1000, T:0.5', 'EA', 0.5,  NULL,   'MIN'),
      ('SM-CW-128', '세라믹차열재(128K)', 'SM', '세라믹차열재', '밀도128kg/m³, t50, W600', 'M', NULL, 128.00, 'MIN'),
      ('SM-CW-100', '세라믹차열재(100K)', 'SM', '세라믹차열재', '밀도100kg/m³, t50, W600', 'M', NULL, 100.00, 'MIN'),
      ('SM-CW-96',  '세라믹차열재(96K)',  'SM', '세라믹차열재', '밀도96kg/m³, t25~50, W200~600', 'M', NULL,  96.00, 'MIN'),
      ('SM-GW-24',  '그라스울(24K)',      'SM', '그라스울', '밀도24kg/m³, t25, W1400', 'M', NULL,  24.00, 'MIN'),
      ('SM-PE-INS', 'PE보온재',          'SM', '보온재',   '관통부 보온',        'EA', NULL,  NULL,   NULL),
      ('SM-SIL',    '실란트',            'SM', '밀봉재',   '실리콘실란트',       'EA', NULL,  NULL,   NULL),
      ('SM-FN-SK',  '발포소켓(FN Tech)', 'SM', '발포소켓', '규격별',             'EA', NULL,  NULL,   NULL),
      ('SM-GP',     '고정자재',          'SM', '고정자재', '아연도금강판 SGCC, L1000×H200×t0.5', 'EA', NULL,  NULL,   NULL),
      ('SM-GI-I-10','강재류 아연도금강판(I형) L1000','SM','강재류','SGCC t0.5, W125×L1000','EA', 0.5, NULL, 'MIN'),
      ('SM-GI-Z-10','강재류 아연도금강판(Z형) L1000','SM','강재류','SGCC t0.5, W215×L1000','EA', 0.5, NULL, 'MIN'),
      ('SM-GI-L-10','강재류 아연도금강판(L형) L1000','SM','강재류','SGCC t0.5, W185×L1000','EA', 0.5, NULL, 'MIN'),
      ('SM-GP-10','고정자재 L1000','SM','고정자재','아연도금강판 SGCC t0.5, L1000','EA', NULL, NULL, NULL),
      ('SM-SK-BODY','금속소켓 본체(아연도금강판)','SM','강재류','아연도금강판 SGCC t1.6, 소켓본체','EA', 1.6,  NULL,   'MIN'),
      ('SM-CW-96-25W2','세라믹차열재 96K t25 W200','SM','세라믹차열재','밀도96kg/m³, t25, W200 (블랭킷 벽체)','M', NULL, 96.00, 'MIN'),
      ('SM-CW-96-25W3','세라믹차열재 96K t25 W300','SM','세라믹차열재','밀도96kg/m³, t25, W300 (블랭킷 바닥)','M', NULL, 96.00, 'MIN'),
      ('SM-CW-96-50','세라믹차열재 96K t50 W600','SM','세라믹차열재','밀도96kg/m³, t50, W600 (지지구조)','M', NULL, 96.00, 'MIN'),
      ('SM-CW-96-38','세라믹차열재 96K t38 W600','SM','세라믹차열재','밀도96kg/m³, t38, W600 (지지구조 1.69)','M', NULL, 96.00, 'MIN'),
      ('SM-CW-128-25','세라믹차열재 128K t25 W200','SM','세라믹차열재','밀도128kg/m³, t25, W200 (블랭킷)','M', NULL, 128.00, 'MIN'),
      ('SM-GW-24-14','그라스울 24K W1400','SM','그라스울','밀도24kg/m³, t25, W1400','M', NULL, 24.00, 'MIN'),
      ('SM-GW-24-10','그라스울 24K W1000','SM','그라스울','밀도24kg/m³, t25, W1000','M', NULL, 24.00, 'MIN')
    ON CONFLICT (item_code) DO UPDATE SET
      item_name = EXCLUDED.item_name,
      item_subcategory = EXCLUDED.item_subcategory,
      spec = EXCLUDED.spec,
      unit = EXCLUDED.unit,
      cert_min_thickness = EXCLUDED.cert_min_thickness,
      cert_min_density = EXCLUDED.cert_min_density,
      value_direction = EXCLUDED.value_direction,
      is_active = true
  `);

  // --- Semi-finished (SA) 7건 ---
  await pool.query(`
    INSERT INTO item_master (item_code, item_name, item_category, item_subcategory, spec, unit)
    VALUES
      ('SA-MIX-MB',    '인정배합',                    'SA', '배합', 'C-601 준수',       'kg'),
      ('SA-EXT-5190',  '압출(5T-190) 소켓용',        'SA', '압출', '5T×190mm',         'm'),
      ('SA-EXT-65415', '압출(6.5T-415) FN용',        'SA', '압출', '6.5T×415mm',       'm'),
      ('SA-EXT-5125I', '압출(5T-125) I형',           'SA', '압출', '5T×125mm 플래싱',  'm'),
      ('SA-EXT-4125Z', '압출(4T-125) Z형',           'SA', '압출', '4T×125mm 플래싱',  'm'),
      ('SA-CUT-SK',    '재단(소켓용)',                'SA', '재단', '규격별',            '매'),
      ('SA-CUT-FL',    '재단(플래싱용)',              'SA', '재단', '규격별',            '매')
    ON CONFLICT (item_code) DO UPDATE SET
      item_name = EXCLUDED.item_name,
      item_subcategory = EXCLUDED.item_subcategory,
      spec = EXCLUDED.spec,
      unit = EXCLUDED.unit,
      is_active = true
  `);

  // --- Finished Products (FP) 17건 ---
  await pool.query(`
    INSERT INTO item_master (item_code, item_name, item_category, item_subcategory, spec, unit)
    VALUES
      ('FP-VT01',      '방화소켓(VT-01)',           'FP', '방화소켓', 'VT200 벽체',          'EA'),
      ('FP-VS01',      '방화소켓(VS-01)',           'FP', '방화소켓', 'VS200+VG200 벽체 2소켓', 'EA'),
      ('FP-VT049',     '방화소켓(VT-049)',          'FP', '방화소켓', 'VM200 벽체',          'EA'),
      ('FP-VT064',     '방화소켓(VT-064)',          'FP', '방화소켓', 'VM200 벽체',          'EA'),
      ('FP-VA064',     '방화소켓(VA-064)',          'FP', '방화소켓', 'VM200 벽체 4면',      'EA'),
      ('FP-VAG169',    '방화소켓(VAG-1.69)',        'FP', '방화소켓', 'VTG200 벽체 2개조립', 'EA'),
      ('FP-VTI064',    '방화소켓(VTI-064)',         'FP', '방화소켓', 'VIG200 벽체',         'EA'),
      ('FP-HTG169',    '방화소켓(HTG-1.69)',        'FP', '방화소켓', 'HTG300C 바닥 2개조립','EA'),
      ('FP-HTG064',    '방화소켓(HTG-064)',         'FP', '방화소켓', 'HMG300C 바닥',        'EA'),
      ('FP-HTGDC064',  '방화소켓(HTG(DC)-064)',     'FP', '방화소켓', 'HMG300 바닥 DC형',    'EA'),
      ('FP-FL-I',      '플래싱(I형)',               'FP', '플래싱',   'W125×L1000',          'EA'),
      ('FP-FL-Z',      '플래싱(Z형)',               'FP', '플래싱',   'W170×L1000',          'EA'),
      ('FP-FL-L',      '플래싱(L형)',               'FP', '플래싱',   'W185×L1000',          'EA'),
      ('FP-BD-FL-SUS', 'BD플래싱(SUS304)',          'FP', 'BD플래싱', 'SUS304 t0.5, W190×L380', 'EA'),
      ('FP-BD-FL-GI-L','BD플래싱(아연도금,대형)',    'FP', 'BD플래싱', '아연도금 t1.6, W175×L1100', 'EA'),
      ('FP-BD-FL-GI-S','BD플래싱(아연도금,소형)',    'FP', 'BD플래싱', '아연도금 t1.6, W95×L195', 'EA'),
      ('FP-GAP-SH',    '틈새복합시트',              'FP', '틈새시트', '200×1000',            'EA'),
      ('FP-FN-100A',   '발포소켓(100A)',            'FP', '발포소켓', '100A',                'EA'),
      ('FP-FN-75A',    '발포소켓(75A)',             'FP', '발포소켓', '75A',                 'EA'),
      ('FP-STRUCT',    '구조체',                    'FP', '구조체',   '발주별 SET',          'SET')
    ON CONFLICT (item_code) DO UPDATE SET
      item_name = EXCLUDED.item_name,
      item_subcategory = EXCLUDED.item_subcategory,
      spec = EXCLUDED.spec,
      unit = EXCLUDED.unit,
      is_active = true
  `);

  const { rows } = await pool.query(
    `SELECT item_category, COUNT(*) as cnt FROM item_master WHERE is_active = true GROUP BY item_category ORDER BY item_category`
  );
  console.log('[migrateItemMaster] 엑셀 기준 품목 정리 완료:', rows.map(r => `${r.item_category}:${r.cnt}`).join(', '));
}

export async function itemRoutes(app: FastifyInstance) {
  // 서버 시작 시 마이그레이션 실행
  // await migrateItemMaster();

  // GET /api/items/spec-options — 규격 드롭다운 옵션 (기존 item_master 데이터 기반)
  app.get('/api/items/spec-options', async () => {
    const [densities, thicknesses, widths, lengths, heights] = await Promise.all([
      pool.query(`SELECT DISTINCT spec_density  AS v FROM item_master WHERE spec_density  IS NOT NULL AND spec_density  <> '' ORDER BY v`),
      pool.query(`SELECT DISTINCT spec_thickness AS v FROM item_master WHERE spec_thickness IS NOT NULL AND spec_thickness <> '' ORDER BY v`),
      pool.query(`SELECT DISTINCT spec_width    AS v FROM item_master WHERE spec_width    IS NOT NULL AND spec_width    <> '' ORDER BY v`),
      pool.query(`SELECT DISTINCT spec_length   AS v FROM item_master WHERE spec_length   IS NOT NULL AND spec_length   <> '' ORDER BY v`),
      pool.query(`SELECT DISTINCT spec_height   AS v FROM item_master WHERE spec_height   IS NOT NULL AND spec_height   <> '' ORDER BY v`),
    ]).catch(() => [{ rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }]);
    return {
      data: {
        densities:  (densities  as any).rows.map((r: any) => r.v),
        thicknesses:(thicknesses as any).rows.map((r: any) => r.v),
        widths:     (widths     as any).rows.map((r: any) => r.v),
        lengths:    (lengths    as any).rows.map((r: any) => r.v),
        heights:    (heights    as any).rows.map((r: any) => r.v),
      },
    };
  });

  // GET /api/items - 품목 목록
  app.get('/api/items', async (request, reply) => {
    const { category, search } = request.query as { category?: string; search?: string };

    let query = 'SELECT * FROM item_master WHERE is_active = true';
    const params: unknown[] = [];

    if (category) {
      params.push(category);
      query += ` AND item_category = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (item_code ILIKE $${params.length} OR item_name ILIKE $${params.length})`;
    }

    query += ' ORDER BY item_category, item_code';

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });

  // GET /api/items/:id - 품목 상세
  app.get('/api/items/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query('SELECT * FROM item_master WHERE item_id = $1', [parseInt(id, 10)]);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '품목을 찾을 수 없습니다.' });
    }

    return { data: result.rows[0] };
  });

  // POST /api/items - 품목 신규 등록
  app.post('/api/items', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const { item_code, item_name, item_category, item_subcategory, unit,
            cert_min_density, cert_min_thickness, cert_min_mass,
            production_value, tolerance_plus, value_direction,
            safety_stock, roll_length_m, roll_spec,
            spec_density, spec_thickness, spec_width, spec_length, spec_height } = body as any;

    if (!item_code || !item_name || !item_category || !unit) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: '품목코드, 품목명, 분류, 단위는 필수입니다.',
      });
    }

    // 규격 문자열 자동 생성 (SM 부자재 - 구조적 필드 기반)
    let specStr = (body.spec as string) || null;
    if (item_category === 'SM') {
      const parts: string[] = [];
      if (spec_density && spec_density !== '사용안함') parts.push(`밀도${spec_density}kg/m³`);
      if (spec_thickness) parts.push(`t${spec_thickness}`);
      if (spec_width)     parts.push(`W${spec_width}`);
      if (spec_length)    parts.push(`L${spec_length}`);
      if (spec_height)    parts.push(`H${spec_height}`);
      if (parts.length > 0) specStr = parts.join(', ');
    }

    // 중복 체크
    const existing = await pool.query('SELECT item_id FROM item_master WHERE item_code = $1', [item_code]);
    if (existing.rows.length > 0) {
      return reply.status(409).send({
        error: 'Conflict',
        message: `품목코드 ${item_code}가 이미 존재합니다.`,
      });
    }

    const result = await pool.query(`
      INSERT INTO item_master (item_code, item_name, item_category, item_subcategory, spec, unit,
        cert_min_density, cert_min_thickness, cert_min_mass,
        production_value, tolerance_plus, value_direction,
        safety_stock, roll_length_m, roll_spec,
        spec_density, spec_thickness, spec_width, spec_length, spec_height,
        is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,true)
      RETURNING *
    `, [
      item_code, item_name, item_category, item_subcategory || null, specStr, unit,
      cert_min_density || null, cert_min_thickness || null, cert_min_mass || null,
      production_value || null, tolerance_plus || null, value_direction || null,
      safety_stock || 0, roll_length_m || null, roll_spec || null,
      spec_density || null, spec_thickness || null, spec_width || null,
      spec_length || null, spec_height || null,
    ]);

    return { data: result.rows[0] };
  });

  // PATCH /api/items/:id - 품목 수정
  app.patch('/api/items/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const itemId = parseInt(id, 10);
    const body = request.body as Record<string, unknown>;

    const allowedFields = [
      'item_code', 'item_name', 'item_category', 'item_subcategory', 'spec', 'unit',
      'cert_min_density', 'cert_min_thickness', 'cert_min_mass',
      'production_value', 'tolerance_plus', 'value_direction',
      'safety_stock', 'is_active', 'roll_length_m', 'roll_spec',
      'spec_density', 'spec_thickness', 'spec_width', 'spec_length', 'spec_height',
    ];

    // SM 부자재: 구조적 필드로 spec 자동 생성
    const b = body as any;
    if (b.item_category === 'SM' || (!b.item_category && body.spec_density !== undefined)) {
      const parts: string[] = [];
      if (b.spec_density && b.spec_density !== '사용안함') parts.push(`밀도${b.spec_density}kg/m³`);
      if (b.spec_thickness) parts.push(`t${b.spec_thickness}`);
      if (b.spec_width)     parts.push(`W${b.spec_width}`);
      if (b.spec_length)    parts.push(`L${b.spec_length}`);
      if (b.spec_height)    parts.push(`H${b.spec_height}`);
      if (parts.length > 0) body.spec = parts.join(', ');
    }

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

    values.push(itemId);
    const query = `UPDATE item_master SET ${updates.join(', ')} WHERE item_id = $${values.length} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '품목을 찾을 수 없습니다.' });
    }

    return { data: result.rows[0] };
  });

  // DELETE /api/items/:id - 품목 비활성화 (soft delete)
  app.delete('/api/items/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const itemId = parseInt(id, 10);
    const result = await pool.query(
      'UPDATE item_master SET is_active = false WHERE item_id = $1 RETURNING *',
      [itemId]
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found' });
    }
    return { data: result.rows[0], message: '품목이 비활성화되었습니다.' };
  });

  // ─── 세분류 마스터 CRUD (테이블 생성은 authRoutes 시작 시 수행) ───

  // GET /api/item-subcategories — 세분류 목록
  // item_subcategory_master + item_master 양쪽을 UNION하여 반환
  // → 마스터 테이블 시드 여부와 무관하게 기존 데이터 항상 표시
  app.get('/api/item-subcategories', async (request, reply) => {
    const { category } = request.query as { category?: string };
    const params: unknown[] = [];
    let catFilter = '';
    if (category) {
      params.push(category);
      catFilter = `AND item_category = $${params.length}`;
    }

    try {
      // item_master 에서 현재 쓰이는 세분류를 마스터 테이블에 자동 동기화
      await pool.query(`
        INSERT INTO item_subcategory_master (item_category, subcategory_name)
        SELECT DISTINCT item_category, item_subcategory
        FROM item_master
        WHERE item_subcategory IS NOT NULL AND item_subcategory <> ''
        ON CONFLICT (item_category, subcategory_name) DO NOTHING
      `).catch(() => {});

      // 마스터 테이블에서 반환 (이미 item_master 값이 모두 포함됨)
      const q = `
        SELECT subcategory_id, item_category, subcategory_name, sort_order
        FROM item_subcategory_master
        WHERE is_active = true ${catFilter}
        ORDER BY item_category, sort_order, subcategory_name
      `;
      const result = await pool.query(q, params);
      return { data: result.rows };
    } catch (err) {
      console.error('[item-subcategories GET]', err);
      // 마스터 테이블이 없으면 item_master에서 직접 조회
      try {
        const fallback = await pool.query(`
          SELECT DISTINCT
            item_category,
            item_subcategory AS subcategory_name,
            0 AS subcategory_id,
            0 AS sort_order
          FROM item_master
          WHERE item_subcategory IS NOT NULL AND item_subcategory <> ''
          ${category ? `AND item_category = $1` : ''}
          ORDER BY item_category, subcategory_name
        `, params);
        return { data: fallback.rows };
      } catch {
        return { data: [] };
      }
    }
  });

  // POST /api/item-subcategories — 세분류 신규 등록
  app.post('/api/item-subcategories', async (request, reply) => {
    const { item_category, subcategory_name, sort_order } = request.body as any;
    if (!item_category || !subcategory_name?.trim()) {
      return reply.status(400).send({ error: 'Bad Request', message: '분류와 세분류명은 필수입니다.' });
    }
    try {
      const result = await pool.query(`
        INSERT INTO item_subcategory_master (item_category, subcategory_name, sort_order)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [item_category, subcategory_name.trim(), sort_order ?? 0]);
      return { data: result.rows[0] };
    } catch (e: any) {
      if (e.code === '23505') {
        return reply.status(409).send({ error: 'Conflict', message: '이미 존재하는 세분류입니다.' });
      }
      throw e;
    }
  });

  // DELETE /api/item-subcategories/:id — 세분류 삭제
  app.delete('/api/item-subcategories/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(
      `UPDATE item_subcategory_master SET is_active = false WHERE subcategory_id = $1 RETURNING *`,
      [parseInt(id, 10)]
    );
    if (result.rows.length === 0) return reply.status(404).send({ error: 'Not Found' });
    return { data: result.rows[0] };
  });
}
