import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

/**
 * KG → M 환산 함수
 * weight in grams / (density * thickness_cm * width_cm) = length in cm, then /100 = meters
 */
export function kgToMeters(weightKg: number, densityGCm3: number, thicknessMm: number, widthMm: number): number {
  if (!weightKg || !densityGCm3 || !thicknessMm || !widthMm) return 0;
  const weightG = weightKg * 1000;
  const thicknessCm = thicknessMm / 10;
  const widthCm = widthMm / 10;
  const lengthCm = weightG / (densityGCm3 * thicknessCm * widthCm);
  return Math.round(lengthCm) / 100; // round to 2 decimal meters
}

/** DB 마이그레이션: lot_properties 테이블 */
async function migrateLotProperties() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lot_properties (
      prop_id SERIAL PRIMARY KEY,
      lot_number VARCHAR(50) NOT NULL,
      process_code VARCHAR(10),
      log_id INTEGER REFERENCES process_log(log_id),
      inspection_id INTEGER REFERENCES inspection(insp_id),

      -- Physical properties from inspection
      density NUMERIC(8,4),
      density_unit VARCHAR(10) DEFAULT 'g/cm³',
      thickness NUMERIC(8,2),
      width NUMERIC(8,2),
      length_calculated NUMERIC(12,2),

      -- Weight data
      input_weight_kg NUMERIC(12,2),
      output_weight_kg NUMERIC(12,2),
      loss_weight_kg NUMERIC(12,2),

      -- Calculated conversions
      output_length_m NUMERIC(12,2),
      loss_length_m NUMERIC(12,2),

      -- For comparison in reports
      theoretical_loss_kg NUMERIC(12,2),
      actual_vs_theoretical_diff NUMERIC(12,2),

      recorded_by INTEGER REFERENCES worker(worker_id),
      remarks TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // Create indexes if not exist
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_lot_props_lot ON lot_properties(lot_number);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_lot_props_process ON lot_properties(process_code);`);
}

export async function lotPropertiesRoutes(app: FastifyInstance) {
  await migrateLotProperties();

  /**
   * POST /api/lot-properties
   * 밀도·환산 정보 생성
   */
  app.post('/api/lot-properties', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const {
      lot_number, process_code, log_id, inspection_id,
      density, thickness, width,
      input_weight_kg, output_weight_kg, loss_weight_kg,
      recorded_by, remarks,
    } = body;

    if (!lot_number) {
      return reply.status(400).send({ error: 'Bad Request', message: 'lot_number는 필수입니다.' });
    }

    const d = Number(density) || 0;
    const t = Number(thickness) || 0;
    const w = Number(width) || 0;
    const outputKg = Number(output_weight_kg) || 0;
    const lossKg = Number(loss_weight_kg) || 0;
    const inputKg = Number(input_weight_kg) || 0;

    // Auto-calculate conversions
    let outputLengthM: number | null = null;
    let lossLengthM: number | null = null;
    let lengthCalculated: number | null = null;
    let theoreticalLossKg: number | null = null;
    let actualVsTheoreticalDiff: number | null = null;

    if (d > 0 && t > 0 && w > 0) {
      if (outputKg > 0) {
        outputLengthM = kgToMeters(outputKg, d, t, w);
        lengthCalculated = outputLengthM;
      }
      if (lossKg > 0) {
        lossLengthM = kgToMeters(lossKg, d, t, w);
      }
      // theoretical loss: input - output based on density conversion
      if (inputKg > 0 && outputKg > 0) {
        const inputLengthM = kgToMeters(inputKg, d, t, w);
        const outputLengthCalc = kgToMeters(outputKg, d, t, w);
        // Theoretical loss in kg based on density-calculated difference
        theoreticalLossKg = inputKg - outputKg; // same as actual loss in kg
        if (lossKg > 0) {
          actualVsTheoreticalDiff = lossKg - theoreticalLossKg;
        }
      }
    }

    const result = await pool.query(`
      INSERT INTO lot_properties
        (lot_number, process_code, log_id, inspection_id,
         density, thickness, width, length_calculated,
         input_weight_kg, output_weight_kg, loss_weight_kg,
         output_length_m, loss_length_m,
         theoretical_loss_kg, actual_vs_theoretical_diff,
         recorded_by, remarks)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
      lot_number, process_code || null, log_id || null, inspection_id || null,
      d || null, t || null, w || null, lengthCalculated,
      inputKg || null, outputKg || null, lossKg || null,
      outputLengthM, lossLengthM,
      theoreticalLossKg, actualVsTheoreticalDiff,
      recorded_by || null, remarks || null,
    ]);

    return { data: result.rows[0] };
  });

  /**
   * GET /api/lot-properties?lot_number=XXX
   * LOT별 밀도·환산 정보 조회
   */
  app.get('/api/lot-properties', async (request) => {
    const { lot_number } = request.query as { lot_number?: string };

    let query = `
      SELECT lp.*, w.worker_name as recorded_by_name
      FROM lot_properties lp
      LEFT JOIN worker w ON w.worker_id = lp.recorded_by
    `;
    const params: unknown[] = [];

    if (lot_number) {
      params.push(lot_number);
      query += ` WHERE lp.lot_number = $${params.length}`;
    }
    query += ' ORDER BY lp.created_at DESC';

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });

  /**
   * GET /api/lot-properties/by-process?process_code=EXT&date_from=&date_to=
   * 공정별 밀도·환산 정보 조회
   */
  app.get('/api/lot-properties/by-process', async (request) => {
    const { process_code, date_from, date_to } = request.query as {
      process_code?: string; date_from?: string; date_to?: string;
    };

    let query = `
      SELECT lp.*, w.worker_name as recorded_by_name
      FROM lot_properties lp
      LEFT JOIN worker w ON w.worker_id = lp.recorded_by
    `;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (process_code) {
      params.push(process_code);
      conditions.push(`lp.process_code = $${params.length}`);
    }
    if (date_from) {
      params.push(date_from);
      conditions.push(`lp.created_at::date >= $${params.length}::date`);
    }
    if (date_to) {
      params.push(date_to);
      conditions.push(`lp.created_at::date <= $${params.length}::date`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY lp.created_at DESC';

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });

  /**
   * GET /api/lot-properties/density-history?lot_number=XXX
   * LOT의 밀도 측정 이력
   */
  app.get('/api/lot-properties/density-history', async (request) => {
    const { lot_number } = request.query as { lot_number?: string };

    if (!lot_number) {
      return { data: [] };
    }

    const result = await pool.query(`
      SELECT prop_id, lot_number, process_code, density, density_unit,
             thickness, width, output_length_m, loss_length_m, created_at
      FROM lot_properties
      WHERE lot_number = $1 AND density IS NOT NULL
      ORDER BY created_at ASC
    `, [lot_number]);

    return { data: result.rows };
  });

  /**
   * PATCH /api/lot-properties/:id
   * 밀도·환산 정보 수정 (재계산 포함)
   */
  app.patch('/api/lot-properties/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const propId = parseInt(id, 10);
    const body = request.body as Record<string, unknown>;

    // First fetch existing record
    const existing = await pool.query('SELECT * FROM lot_properties WHERE prop_id = $1', [propId]);
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '밀도 정보를 찾을 수 없습니다.' });
    }

    const row = existing.rows[0];
    const updates: string[] = [];
    const values: unknown[] = [];

    const allowedFields = [
      'lot_number', 'process_code', 'log_id', 'inspection_id',
      'density', 'thickness', 'width',
      'input_weight_kg', 'output_weight_kg', 'loss_weight_kg',
      'recorded_by', 'remarks',
    ];

    for (const field of allowedFields) {
      if (field in body) {
        values.push(body[field]);
        updates.push(`${field} = $${values.length}`);
      }
    }

    // Merge existing + updated values for recalculation
    const d = Number(body.density ?? row.density) || 0;
    const t = Number(body.thickness ?? row.thickness) || 0;
    const w = Number(body.width ?? row.width) || 0;
    const outputKg = Number(body.output_weight_kg ?? row.output_weight_kg) || 0;
    const lossKg = Number(body.loss_weight_kg ?? row.loss_weight_kg) || 0;
    const inputKg = Number(body.input_weight_kg ?? row.input_weight_kg) || 0;

    // Recalculate conversions
    if (d > 0 && t > 0 && w > 0) {
      if (outputKg > 0) {
        const outputLengthM = kgToMeters(outputKg, d, t, w);
        values.push(outputLengthM);
        updates.push(`output_length_m = $${values.length}`);
        values.push(outputLengthM);
        updates.push(`length_calculated = $${values.length}`);
      }
      if (lossKg > 0) {
        const lossLengthM = kgToMeters(lossKg, d, t, w);
        values.push(lossLengthM);
        updates.push(`loss_length_m = $${values.length}`);
      }
      if (inputKg > 0 && outputKg > 0) {
        const theoreticalLossKg = inputKg - outputKg;
        values.push(theoreticalLossKg);
        updates.push(`theoretical_loss_kg = $${values.length}`);
        if (lossKg > 0) {
          const diff = lossKg - theoreticalLossKg;
          values.push(diff);
          updates.push(`actual_vs_theoretical_diff = $${values.length}`);
        }
      }
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: '수정할 항목이 없습니다.' });
    }

    values.push(propId);
    const result = await pool.query(
      `UPDATE lot_properties SET ${updates.join(', ')} WHERE prop_id = $${values.length} RETURNING *`,
      values
    );

    return { data: result.rows[0] };
  });
}
