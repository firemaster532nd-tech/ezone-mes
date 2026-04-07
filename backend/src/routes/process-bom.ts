import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

/** DB 마이그레이션: 공정별 BOM 테이블 생성 */
async function migrateProcessBom() {
  // Process BOM (공정별 BOM)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS process_bom (
      bom_id SERIAL PRIMARY KEY,
      process_code VARCHAR(10) NOT NULL CHECK (process_code IN ('MIX','EXT','CUT','ASM','SHP')),
      bom_name VARCHAR(100) NOT NULL,
      bom_code VARCHAR(50) UNIQUE NOT NULL,
      cert_id INTEGER REFERENCES certification_master(cert_id),
      output_item_id INTEGER REFERENCES item_master(item_id),
      output_qty NUMERIC(12,2) DEFAULT 1,
      output_unit VARCHAR(20) DEFAULT 'ea',
      loss_rate NUMERIC(5,2) DEFAULT 0,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // Process BOM Items (투입 자재)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS process_bom_item (
      bom_item_id SERIAL PRIMARY KEY,
      bom_id INTEGER NOT NULL REFERENCES process_bom(bom_id) ON DELETE CASCADE,
      item_id INTEGER REFERENCES item_master(item_id),
      component_name VARCHAR(100) NOT NULL,
      qty NUMERIC(12,4) NOT NULL DEFAULT 1,
      unit VARCHAR(20) DEFAULT 'ea',
      spec_detail TEXT,
      is_key_material BOOLEAN DEFAULT true,
      sort_order INTEGER DEFAULT 0
    );
  `);

  // Loss Record (로스 기록)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loss_record (
      loss_id SERIAL PRIMARY KEY,
      wo_id INTEGER REFERENCES work_order(wo_id),
      log_id INTEGER REFERENCES process_log(log_id),
      process_code VARCHAR(10) NOT NULL,
      lot_number VARCHAR(50),
      planned_input NUMERIC(12,2),
      actual_input NUMERIC(12,2),
      actual_output NUMERIC(12,2),
      loss_qty NUMERIC(12,2),
      loss_rate NUMERIC(5,2),
      weighed_qty NUMERIC(12,2),
      remarks TEXT,
      recorded_by INTEGER REFERENCES worker(worker_id),
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // Add columns to process_log for actual tracking
  await pool.query(`ALTER TABLE process_log ADD COLUMN IF NOT EXISTS actual_input_qty NUMERIC(12,2);`);
  await pool.query(`ALTER TABLE process_log ADD COLUMN IF NOT EXISTS loss_qty NUMERIC(12,2);`);
  await pool.query(`ALTER TABLE process_log ADD COLUMN IF NOT EXISTS loss_rate NUMERIC(5,2);`);
  await pool.query(`ALTER TABLE process_log ADD COLUMN IF NOT EXISTS bom_id INTEGER REFERENCES process_bom(bom_id);`);

  // Seed initial BOMs
  await seedProcessBoms();
}

async function seedProcessBoms() {
  // Helper: lookup item_id by item_code
  async function itemId(code: string): Promise<number | null> {
    const r = await pool.query(`SELECT item_id FROM item_master WHERE item_code = $1`, [code]);
    return r.rows.length > 0 ? r.rows[0].item_id : null;
  }

  // ── MIX BOM ──
  await pool.query(`
    INSERT INTO process_bom (process_code, bom_name, bom_code, output_item_id, output_qty, output_unit, loss_rate, description)
    VALUES ('MIX', '인정배합 차열시트 배합물', 'BOM-MIX-CERT-300', $1, 300, 'kg', 2, '배합 공정 BOM (300kg 1배치)')
    ON CONFLICT (bom_code) DO NOTHING
  `, [await itemId('SA-MIX-MB')]);

  const mixBom = await pool.query(`SELECT bom_id FROM process_bom WHERE bom_code = 'BOM-MIX-CERT-300'`);
  if (mixBom.rows.length > 0) {
    const bomId = mixBom.rows[0].bom_id;
    const existingItems = await pool.query(`SELECT bom_item_id FROM process_bom_item WHERE bom_id = $1`, [bomId]);
    if (existingItems.rows.length === 0) {
      const mixItems = [
        { code: 'RM-MB', name: '난연컴파운드 PE3005MB', qty: 150, unit: 'kg', sort: 1 },
        { code: 'RM-EG50', name: '팽창흑연 #50', qty: 60, unit: 'kg', sort: 2 },
        { code: 'RM-EA', name: 'EVA-EA33045', qty: 45, unit: 'kg', sort: 3 },
        { code: 'RM-EP', name: 'EVA-EP100', qty: 45, unit: 'kg', sort: 4 },
      ];
      for (const mi of mixItems) {
        await pool.query(
          `INSERT INTO process_bom_item (bom_id, item_id, component_name, qty, unit, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [bomId, await itemId(mi.code), mi.name, mi.qty, mi.unit, mi.sort]
        );
      }
    }
  }

  // ── EXT BOMs (압출: KG 투입 → KG 산출(실측) → M 환산 재고) ──
  const extBoms = [
    { code: 'BOM-EXT-SK-5190', name: '압출 차열시트 5T×190(소켓용)', outCode: 'SA-EXT-5190',
      desc: '배합물 300kg 투입 → 5T×190mm 시트 압출. 실측무게(kg) 기록 후 M 환산하여 재고 보관.',
      spec: '1배치=300kg. 밀도 약 1.2g/cm³ 기준 시트 산출. 산출 후 실측무게(kg) → M 환산 재고등록' },
    { code: 'BOM-EXT-FL-5125', name: '압출 플래싱시트 5T×125(I형)', outCode: 'SA-EXT-5125',
      desc: '배합물 300kg 투입 → 5T×125mm 플래싱시트 압출(I형). 실측무게(kg) → M 환산 재고.',
      spec: '1배치=300kg → 5T×125mm I형 시트 압출. 산출 실측무게(kg) → M 환산' },
    { code: 'BOM-EXT-FL-4125', name: '압출 플래싱시트 4T×125(Z형)', outCode: 'SA-EXT-4125',
      desc: '배합물 300kg 투입 → 4T×125mm 플래싱시트 압출(Z형). 실측무게(kg) → M 환산 재고.',
      spec: '1배치=300kg → 4T×125mm Z형 시트 압출. 산출 실측무게(kg) → M 환산' },
  ];
  for (const eb of extBoms) {
    await pool.query(`
      INSERT INTO process_bom (process_code, bom_name, bom_code, output_item_id, output_qty, output_unit, loss_rate, description)
      VALUES ('EXT', $1, $2, $3, 300, 'kg', 3, $4)
      ON CONFLICT (bom_code) DO NOTHING
    `, [eb.name, eb.code, await itemId(eb.outCode), eb.desc]);

    const bom = await pool.query(`SELECT bom_id FROM process_bom WHERE bom_code = $1`, [eb.code]);
    if (bom.rows.length > 0) {
      const bomId = bom.rows[0].bom_id;
      const existing = await pool.query(`SELECT bom_item_id FROM process_bom_item WHERE bom_id = $1`, [bomId]);
      if (existing.rows.length === 0) {
        await pool.query(
          `INSERT INTO process_bom_item (bom_id, item_id, component_name, qty, unit, spec_detail, is_key_material, sort_order)
           VALUES ($1, $2, '인정배합원료(배합물)', 300, 'kg', $3, true, 1)`,
          [bomId, await itemId('SA-MIX-MB'), eb.spec]
        );
      }
    }
  }

  // ── CUT BOMs (재단: 소켓용, 플래싱 I형, 플래싱 Z형) ──
  // 소켓용: 압출시트 5T×190 투입 → 구조별 규격 재단
  await pool.query(`
    INSERT INTO process_bom (process_code, bom_name, bom_code, output_item_id, output_qty, output_unit, loss_rate, description)
    VALUES ('CUT', '재단 소켓용 차열시트', 'BOM-CUT-SK', $1, 1, 'ea', 15,
      '소켓용 차열시트 재단. 압출시트(5T×190) 투입 → 구조별 규격에 맞게 재단. 받침대/상하/좌우/외부시트 등.')
    ON CONFLICT (bom_code) DO NOTHING
  `, [await itemId('SA-CUT-SK')]);

  const cutSkBom = await pool.query(`SELECT bom_id FROM process_bom WHERE bom_code = 'BOM-CUT-SK'`);
  if (cutSkBom.rows.length > 0) {
    const bomId = cutSkBom.rows[0].bom_id;
    const existing = await pool.query(`SELECT bom_item_id FROM process_bom_item WHERE bom_id = $1`, [bomId]);
    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO process_bom_item (bom_id, item_id, component_name, qty, unit, spec_detail, sort_order)
         VALUES ($1, $2, '압출 차열시트 5T×190(소켓용)', 1, 'roll',
           't5.0×W190mm 롤 → 규격별 재단(받침대L1280, 상하L1280, 좌우L305, 외부상하L2660, 외부좌우L650 등)', 1)`,
        [bomId, await itemId('SA-EXT-5190')]
      );
    }
  }

  // 플래싱 Z형: 압출시트 4T×125 투입 → 개구부 둘레 기준 재단
  await pool.query(`
    INSERT INTO process_bom (process_code, bom_name, bom_code, output_item_id, output_qty, output_unit, loss_rate, description)
    VALUES ('CUT', '재단 플래싱용 차열시트 Z형', 'BOM-CUT-FL-Z', $1, 1, '세트', 15,
      'Z형 방화플래싱용 차열시트 재단. 압출시트(4T×125) 투입 → 개구부 둘레 기준 재단. 로스율 15%(표준재단).')
    ON CONFLICT (bom_code) DO NOTHING
  `, [await itemId('SA-CUT-FL')]);

  const cutFlZBom = await pool.query(`SELECT bom_id FROM process_bom WHERE bom_code = 'BOM-CUT-FL-Z'`);
  if (cutFlZBom.rows.length > 0) {
    const bomId = cutFlZBom.rows[0].bom_id;
    const existing = await pool.query(`SELECT bom_item_id FROM process_bom_item WHERE bom_id = $1`, [bomId]);
    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO process_bom_item (bom_id, item_id, component_name, qty, unit, spec_detail, sort_order)
         VALUES ($1, $2, '압출 플래싱차열시트 4T×125(Z형)', 1, 'roll',
           't4.0×W125mm 롤 → Z형 개구부 둘레 기준 재단. 1세트=1,000mm', 1)`,
        [bomId, await itemId('SA-EXT-4125')]
      );
    }
  }

  // 플래싱 I형: 압출시트 5T×125 투입 → I형 규격 재단
  await pool.query(`
    INSERT INTO process_bom (process_code, bom_name, bom_code, output_item_id, output_qty, output_unit, loss_rate, description)
    VALUES ('CUT', '재단 플래싱용 차열시트 I형', 'BOM-CUT-FL-I', $1, 1, '세트', 15,
      'I형 방화플래싱용 차열시트 재단. 압출시트(5T×125) 투입 → I형 규격 재단. 로스율 15%(표준재단).')
    ON CONFLICT (bom_code) DO NOTHING
  `, [await itemId('SA-CUT-FL')]);

  const cutFlIBom = await pool.query(`SELECT bom_id FROM process_bom WHERE bom_code = 'BOM-CUT-FL-I'`);
  if (cutFlIBom.rows.length > 0) {
    const bomId = cutFlIBom.rows[0].bom_id;
    const existing = await pool.query(`SELECT bom_item_id FROM process_bom_item WHERE bom_id = $1`, [bomId]);
    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO process_bom_item (bom_id, item_id, component_name, qty, unit, spec_detail, sort_order)
         VALUES ($1, $2, '압출 플래싱차열시트 5T×125(I형)', 1, 'roll',
           't5.0×W125mm 롤 → I형 규격 재단. 1세트=1,000mm', 1)`,
        [bomId, await itemId('SA-EXT-5125')]
      );
    }
  }

  // ── ASM BOM (조립 - 방화소켓 VT-01) ──
  await pool.query(`
    INSERT INTO process_bom (process_code, bom_name, bom_code, cert_id, output_item_id, output_qty, output_unit, loss_rate, description)
    VALUES ('ASM', '방화소켓 VT200 조립', 'BOM-ASM-VT01', 1, $1, 1, 'ea', 0, 'VT-01 방화소켓 조립 BOM')
    ON CONFLICT (bom_code) DO NOTHING
  `, [await itemId('FP-VT01')]);

  const asmBom = await pool.query(`SELECT bom_id FROM process_bom WHERE bom_code = 'BOM-ASM-VT01'`);
  if (asmBom.rows.length > 0) {
    const bomId = asmBom.rows[0].bom_id;
    const existing = await pool.query(`SELECT bom_item_id FROM process_bom_item WHERE bom_id = $1`, [bomId]);
    if (existing.rows.length === 0) {
      const asmItems = [
        { code: 'SM-GI-I', name: '금속소켓 본체 (아연도금강판)', qty: 2, unit: 'ea', spec: 't1.6 2600×650 h200', sort: 1 },
        { code: 'SA-CUT-SK', name: '내부시트(받침대)', qty: 4, unit: 'ea', spec: 't5.0 L1280 W190', sort: 2 },
        { code: 'SA-CUT-SK', name: '내부시트(상/하)', qty: 4, unit: 'ea', spec: 't5.0 L1280 W190', sort: 3 },
        { code: 'SA-CUT-SK', name: '내부시트(좌/우)', qty: 8, unit: 'ea', spec: 't5.0 L305 W190', sort: 4 },
        { code: 'SA-CUT-SK', name: '외부시트(상/하)', qty: 2, unit: 'ea', spec: 't5.0 L2660 W190 + CW', sort: 5 },
        { code: 'SA-CUT-SK', name: '외부시트(좌/우)', qty: 2, unit: 'ea', spec: 't5.0 L650 W190 + CW', sort: 6 },
        { code: 'FP-FL-I', name: '방화플래싱(I형)', qty: 16, unit: 'ea', spec: null, sort: 7 },
        { code: 'SM-CW96', name: '세라믹울 96K', qty: 2, unit: 'ea', spec: 't50 W600', sort: 8 },
        { code: 'SM-GW24', name: '글라스울 24K', qty: 2, unit: 'ea', spec: 't25 W1400', sort: 9 },
        { code: 'SM-SIL', name: '실란트', qty: 1, unit: 'ea', spec: null, sort: 10 },
        { code: 'SM-SP', name: '보호철판', qty: 1, unit: 'ea', spec: null, sort: 11 },
      ];
      for (const ai of asmItems) {
        await pool.query(
          `INSERT INTO process_bom_item (bom_id, item_id, component_name, qty, unit, spec_detail, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [bomId, await itemId(ai.code), ai.name, ai.qty, ai.unit, ai.spec, ai.sort]
        );
      }
    }
  }

  // ── SHP BOM (출하 - 방화플래싱 세트) ──
  await pool.query(`
    INSERT INTO process_bom (process_code, bom_name, bom_code, cert_id, output_qty, output_unit, loss_rate, description)
    VALUES ('SHP', '방화플래싱 세트(HTG-1.69용)', 'BOM-SHP-FL-HTG169', 8, 1, 'set', 0, 'HTG-1.69 방화플래싱 출하 세트')
    ON CONFLICT (bom_code) DO NOTHING
  `);

  const shpBom = await pool.query(`SELECT bom_id FROM process_bom WHERE bom_code = 'BOM-SHP-FL-HTG169'`);
  if (shpBom.rows.length > 0) {
    const bomId = shpBom.rows[0].bom_id;
    const existing = await pool.query(`SELECT bom_item_id FROM process_bom_item WHERE bom_id = $1`, [bomId]);
    if (existing.rows.length === 0) {
      const shpItems = [
        { code: 'SM-CW128', name: '세라믹울보드 200H용', qty: 1, unit: 'ea', spec: null, sort: 1 },
        { code: 'SM-CW128', name: '세라믹울보드 Z형용', qty: 1, unit: 'ea', spec: null, sort: 2 },
        { code: 'SM-CW96', name: '세라믹울블랭킷', qty: 1, unit: 'ea', spec: null, sort: 3 },
        { code: 'SM-GI-I', name: '아연도금강판 200H용', qty: 1, unit: 'ea', spec: null, sort: 4 },
        { code: 'SM-GI-Z', name: '아연도금강판 Z형용', qty: 1, unit: 'ea', spec: null, sort: 5 },
        { code: null, name: '타카핀', qty: 1, unit: 'ea', spec: null, sort: 6 },
      ];
      for (const si of shpItems) {
        await pool.query(
          `INSERT INTO process_bom_item (bom_id, item_id, component_name, qty, unit, spec_detail, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [bomId, si.code ? await itemId(si.code) : null, si.name, si.qty, si.unit, si.spec, si.sort]
        );
      }
    }
  }
}

export async function processBomRoutes(app: FastifyInstance) {
  // 서버 시작 시 마이그레이션 실행
  await migrateProcessBom();

  // ──────────────────────────────────────────────
  // GET /api/process-bom — List all process BOMs
  // ──────────────────────────────────────────────
  app.get('/api/process-bom', async (request) => {
    const { process_code } = request.query as { process_code?: string };

    let whereClause = 'WHERE b.is_active = true';
    const params: unknown[] = [];
    if (process_code) {
      params.push(process_code);
      whereClause += ` AND b.process_code = $${params.length}`;
    }

    const result = await pool.query(`
      SELECT b.*,
        cm.structure_name AS cert_name,
        im.item_code AS output_item_code,
        im.item_name AS output_item_name,
        (SELECT json_agg(
          json_build_object(
            'bom_item_id', bi.bom_item_id,
            'item_id', bi.item_id,
            'item_code', i2.item_code,
            'item_name', i2.item_name,
            'component_name', bi.component_name,
            'qty', bi.qty,
            'unit', bi.unit,
            'spec_detail', bi.spec_detail,
            'is_key_material', bi.is_key_material,
            'sort_order', bi.sort_order
          ) ORDER BY bi.sort_order
        ) FROM process_bom_item bi
        LEFT JOIN item_master i2 ON i2.item_id = bi.item_id
        WHERE bi.bom_id = b.bom_id
        ) AS items
      FROM process_bom b
      LEFT JOIN certification_master cm ON cm.cert_id = b.cert_id
      LEFT JOIN item_master im ON im.item_id = b.output_item_id
      ${whereClause}
      ORDER BY b.process_code, b.bom_id
    `, params);

    return { data: result.rows, total: result.rows.length };
  });

  // ──────────────────────────────────────────────
  // GET /api/process-bom/:id — BOM detail with items
  // ──────────────────────────────────────────────
  app.get('/api/process-bom/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const bomId = parseInt(id, 10);

    const bomResult = await pool.query(`
      SELECT b.*, cm.structure_name AS cert_name,
        im.item_code AS output_item_code, im.item_name AS output_item_name
      FROM process_bom b
      LEFT JOIN certification_master cm ON cm.cert_id = b.cert_id
      LEFT JOIN item_master im ON im.item_id = b.output_item_id
      WHERE b.bom_id = $1
    `, [bomId]);

    if (bomResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '공정 BOM을 찾을 수 없습니다.' });
    }

    const itemsResult = await pool.query(`
      SELECT bi.*, i.item_code, i.item_name
      FROM process_bom_item bi
      LEFT JOIN item_master i ON i.item_id = bi.item_id
      WHERE bi.bom_id = $1
      ORDER BY bi.sort_order
    `, [bomId]);

    return { data: { ...bomResult.rows[0], items: itemsResult.rows } };
  });

  // ──────────────────────────────────────────────
  // POST /api/process-bom — Create BOM with items
  // ──────────────────────────────────────────────
  app.post('/api/process-bom', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const {
      process_code, bom_name, bom_code, cert_id, output_item_id,
      output_qty, output_unit, loss_rate, description, items,
    } = body as {
      process_code: string;
      bom_name: string;
      bom_code: string;
      cert_id?: number;
      output_item_id?: number;
      output_qty?: number;
      output_unit?: string;
      loss_rate?: number;
      description?: string;
      items?: Array<{
        item_id?: number;
        component_name: string;
        qty: number;
        unit?: string;
        spec_detail?: string;
        is_key_material?: boolean;
        sort_order?: number;
      }>;
    };

    if (!process_code || !bom_name || !bom_code) {
      return reply.status(400).send({ error: 'Bad Request', message: 'process_code, bom_name, bom_code는 필수입니다.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const bomResult = await client.query(
        `INSERT INTO process_bom (process_code, bom_name, bom_code, cert_id, output_item_id, output_qty, output_unit, loss_rate, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [process_code, bom_name, bom_code, cert_id || null, output_item_id || null,
         output_qty ?? 1, output_unit ?? 'ea', loss_rate ?? 0, description || null]
      );
      const bom = bomResult.rows[0];

      if (items && Array.isArray(items)) {
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          await client.query(
            `INSERT INTO process_bom_item (bom_id, item_id, component_name, qty, unit, spec_detail, is_key_material, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [bom.bom_id, item.item_id || null, item.component_name, item.qty,
             item.unit ?? 'ea', item.spec_detail || null, item.is_key_material ?? true, item.sort_order ?? idx + 1]
          );
        }
      }

      await client.query('COMMIT');

      // Fetch complete BOM with items
      const fullItems = await pool.query(
        `SELECT bi.*, i.item_code, i.item_name
         FROM process_bom_item bi
         LEFT JOIN item_master i ON i.item_id = bi.item_id
         WHERE bi.bom_id = $1
         ORDER BY bi.sort_order`,
        [bom.bom_id]
      );

      return { data: { ...bom, items: fullItems.rows } };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ──────────────────────────────────────────────
  // PATCH /api/process-bom/:id — Update BOM
  // ──────────────────────────────────────────────
  app.patch('/api/process-bom/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const bomId = parseInt(id, 10);
    const body = request.body as Record<string, unknown>;

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    const allowedFields = [
      'process_code', 'bom_name', 'bom_code', 'cert_id', 'output_item_id',
      'output_qty', 'output_unit', 'loss_rate', 'description', 'is_active',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        fields.push(`${field} = $${paramIdx}`);
        values.push(body[field]);
        paramIdx++;
      }
    }

    if (fields.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: '업데이트할 필드가 없습니다.' });
    }

    values.push(bomId);
    const result = await pool.query(
      `UPDATE process_bom SET ${fields.join(', ')} WHERE bom_id = $${paramIdx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '공정 BOM을 찾을 수 없습니다.' });
    }

    return { data: result.rows[0] };
  });

  // ──────────────────────────────────────────────
  // DELETE /api/process-bom/:id — Soft delete
  // ──────────────────────────────────────────────
  app.delete('/api/process-bom/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const bomId = parseInt(id, 10);

    const result = await pool.query(
      `UPDATE process_bom SET is_active = false WHERE bom_id = $1 RETURNING bom_id`,
      [bomId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '공정 BOM을 찾을 수 없습니다.' });
    }

    return { message: '삭제되었습니다.', bom_id: bomId };
  });

  // ──────────────────────────────────────────────
  // POST /api/process-bom/:id/items — Add item to BOM
  // ──────────────────────────────────────────────
  app.post('/api/process-bom/:id/items', async (request, reply) => {
    const { id } = request.params as { id: string };
    const bomId = parseInt(id, 10);
    const body = request.body as {
      item_id?: number;
      component_name: string;
      qty: number;
      unit?: string;
      spec_detail?: string;
      is_key_material?: boolean;
      sort_order?: number;
    };

    if (!body.component_name || body.qty === undefined) {
      return reply.status(400).send({ error: 'Bad Request', message: 'component_name, qty는 필수입니다.' });
    }

    // Verify BOM exists
    const bomCheck = await pool.query(`SELECT bom_id FROM process_bom WHERE bom_id = $1`, [bomId]);
    if (bomCheck.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '공정 BOM을 찾을 수 없습니다.' });
    }

    const result = await pool.query(
      `INSERT INTO process_bom_item (bom_id, item_id, component_name, qty, unit, spec_detail, is_key_material, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [bomId, body.item_id || null, body.component_name, body.qty,
       body.unit ?? 'ea', body.spec_detail || null, body.is_key_material ?? true, body.sort_order ?? 0]
    );

    return { data: result.rows[0] };
  });

  // ──────────────────────────────────────────────
  // PATCH /api/process-bom/items/:itemId — Update BOM item
  // ──────────────────────────────────────────────
  app.patch('/api/process-bom/items/:itemId', async (request, reply) => {
    const { itemId } = request.params as { itemId: string };
    const bomItemId = parseInt(itemId, 10);
    const body = request.body as Record<string, unknown>;

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    const allowedFields = ['item_id', 'component_name', 'qty', 'unit', 'spec_detail', 'is_key_material', 'sort_order'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        fields.push(`${field} = $${paramIdx}`);
        values.push(body[field]);
        paramIdx++;
      }
    }

    if (fields.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: '업데이트할 필드가 없습니다.' });
    }

    values.push(bomItemId);
    const result = await pool.query(
      `UPDATE process_bom_item SET ${fields.join(', ')} WHERE bom_item_id = $${paramIdx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'BOM 항목을 찾을 수 없습니다.' });
    }

    return { data: result.rows[0] };
  });

  // ──────────────────────────────────────────────
  // DELETE /api/process-bom/items/:itemId — Remove BOM item
  // ──────────────────────────────────────────────
  app.delete('/api/process-bom/items/:itemId', async (request, reply) => {
    const { itemId } = request.params as { itemId: string };
    const bomItemId = parseInt(itemId, 10);

    const result = await pool.query(
      `DELETE FROM process_bom_item WHERE bom_item_id = $1 RETURNING bom_item_id`,
      [bomItemId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'BOM 항목을 찾을 수 없습니다.' });
    }

    return { message: '삭제되었습니다.', bom_item_id: bomItemId };
  });

  // ──────────────────────────────────────────────
  // GET /api/process-bom/calculate/:bomId — Calculate material requirements
  // ──────────────────────────────────────────────
  app.get('/api/process-bom/calculate/:bomId', async (request, reply) => {
    const { bomId } = request.params as { bomId: string };
    const { qty } = request.query as { qty?: string };
    const parsedBomId = parseInt(bomId, 10);
    const outputQty = parseInt(qty || '1', 10);

    if (isNaN(parsedBomId) || isNaN(outputQty) || outputQty < 1) {
      return reply.status(400).send({ error: 'Bad Request', message: '유효한 bomId와 qty(1 이상)를 입력하세요.' });
    }

    // 1. Get BOM info
    const bomResult = await pool.query(`
      SELECT b.*, im.item_code AS output_item_code, im.item_name AS output_item_name
      FROM process_bom b
      LEFT JOIN item_master im ON im.item_id = b.output_item_id
      WHERE b.bom_id = $1
    `, [parsedBomId]);

    if (bomResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '공정 BOM을 찾을 수 없습니다.' });
    }
    const bom = bomResult.rows[0];
    const lossRate = parseFloat(bom.loss_rate) || 0;

    // 2. Get BOM items
    const itemsResult = await pool.query(`
      SELECT bi.*, i.item_code, i.item_name
      FROM process_bom_item bi
      LEFT JOIN item_master i ON i.item_id = bi.item_id
      WHERE bi.bom_id = $1
      ORDER BY bi.sort_order
    `, [parsedBomId]);

    // 3. Calculate requirements per material and allocate LOTs (FIFO)
    const materials: Array<Record<string, unknown>> = [];

    for (const item of itemsResult.rows) {
      const baseQty = parseFloat(item.qty) * outputQty;
      const requiredQty = baseQty * (1 + lossRate / 100);

      let lotAllocations: Array<Record<string, unknown>> = [];

      if (item.item_id) {
        // Query available LOTs for this material (FIFO by created_at)
        const lotsResult = await pool.query(
          `SELECT lt.lot_id, lt.lot_number, lt.qty, lt.remaining_qty, lt.status, lt.created_at
           FROM lot_transaction lt
           WHERE lt.item_id = $1
             AND lt.status = 'ACTIVE'
             AND COALESCE(lt.remaining_qty, lt.qty) > 0
           ORDER BY lt.created_at ASC`,
          [item.item_id]
        );

        let remainingNeed = requiredQty;
        for (const lot of lotsResult.rows) {
          if (remainingNeed <= 0) break;
          const available = parseFloat(lot.remaining_qty ?? lot.qty);
          const allocate = Math.min(available, remainingNeed);
          lotAllocations.push({
            lot_id: lot.lot_id,
            lot_number: lot.lot_number,
            available_qty: available,
            allocated_qty: allocate,
          });
          remainingNeed -= allocate;
        }

        materials.push({
          bom_item_id: item.bom_item_id,
          item_id: item.item_id,
          item_code: item.item_code,
          item_name: item.item_name,
          component_name: item.component_name,
          spec_detail: item.spec_detail,
          qty_per_unit: parseFloat(item.qty),
          required_qty: Math.round(requiredQty * 100) / 100,
          allocated_qty: Math.round((requiredQty - Math.max(0, remainingNeed)) * 100) / 100,
          shortage: Math.round(Math.max(0, remainingNeed) * 100) / 100,
          lot_allocations: lotAllocations,
        });
      } else {
        // No item_id linked (e.g. 타카핀)
        materials.push({
          bom_item_id: item.bom_item_id,
          item_id: null,
          item_code: null,
          item_name: null,
          component_name: item.component_name,
          spec_detail: item.spec_detail,
          qty_per_unit: parseFloat(item.qty),
          required_qty: Math.round(requiredQty * 100) / 100,
          allocated_qty: 0,
          shortage: Math.round(requiredQty * 100) / 100,
          lot_allocations: [],
        });
      }
    }

    const hasShortage = materials.some((m) => (m.shortage as number) > 0);

    return {
      data: {
        bom: {
          bom_id: bom.bom_id,
          process_code: bom.process_code,
          bom_name: bom.bom_name,
          bom_code: bom.bom_code,
          output_item_code: bom.output_item_code,
          output_item_name: bom.output_item_name,
          output_qty: parseFloat(bom.output_qty),
          output_unit: bom.output_unit,
          loss_rate: lossRate,
        },
        requested_output_qty: outputQty,
        has_shortage: hasShortage,
        materials,
      },
    };
  });

  // ──────────────────────────────────────────────
  // POST /api/loss-records — Create loss record
  // ──────────────────────────────────────────────
  app.post('/api/loss-records', async (request, reply) => {
    const body = request.body as {
      wo_id?: number;
      log_id?: number;
      process_code: string;
      lot_number?: string;
      planned_input?: number;
      actual_input?: number;
      actual_output?: number;
      loss_qty?: number;
      loss_rate?: number;
      weighed_qty?: number;
      remarks?: string;
      recorded_by?: number;
    };

    if (!body.process_code) {
      return reply.status(400).send({ error: 'Bad Request', message: 'process_code는 필수입니다.' });
    }

    // Auto-calculate loss_qty and loss_rate if not provided
    let lossQty = body.loss_qty;
    let lossRateVal = body.loss_rate;
    if (body.actual_input != null && body.actual_output != null) {
      if (lossQty == null) {
        lossQty = body.actual_input - body.actual_output;
      }
      if (lossRateVal == null && body.actual_input > 0) {
        lossRateVal = Math.round(((body.actual_input - body.actual_output) / body.actual_input) * 10000) / 100;
      }
    }

    const result = await pool.query(
      `INSERT INTO loss_record (wo_id, log_id, process_code, lot_number, planned_input, actual_input, actual_output, loss_qty, loss_rate, weighed_qty, remarks, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [body.wo_id || null, body.log_id || null, body.process_code, body.lot_number || null,
       body.planned_input || null, body.actual_input || null, body.actual_output || null,
       lossQty || null, lossRateVal || null, body.weighed_qty || null,
       body.remarks || null, body.recorded_by || null]
    );

    return { data: result.rows[0] };
  });

  // ──────────────────────────────────────────────
  // GET /api/loss-records — List loss records
  // ──────────────────────────────────────────────
  app.get('/api/loss-records', async (request) => {
    const { wo_id, process_code, lot_number } = request.query as {
      wo_id?: string;
      process_code?: string;
      lot_number?: string;
    };

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (wo_id) {
      params.push(parseInt(wo_id, 10));
      whereClause += ` AND lr.wo_id = $${params.length}`;
    }
    if (process_code) {
      params.push(process_code);
      whereClause += ` AND lr.process_code = $${params.length}`;
    }
    if (lot_number) {
      params.push(lot_number);
      whereClause += ` AND lr.lot_number = $${params.length}`;
    }

    const result = await pool.query(`
      SELECT lr.*,
        w.worker_name AS recorded_by_name,
        wo.wo_number
      FROM loss_record lr
      LEFT JOIN worker w ON w.worker_id = lr.recorded_by
      LEFT JOIN work_order wo ON wo.wo_id = lr.wo_id
      ${whereClause}
      ORDER BY lr.created_at DESC
    `, params);

    return { data: result.rows, total: result.rows.length };
  });
}
