import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

/** DB 마이그레이션: 배합비 테이블 생성 */
async function migrateCompoundingRecipe() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS compounding_recipe (
      recipe_id SERIAL PRIMARY KEY,
      recipe_name VARCHAR(100) NOT NULL,
      recipe_code VARCHAR(30) UNIQUE NOT NULL,
      batch_size NUMERIC(10,2) NOT NULL DEFAULT 300,
      batch_unit VARCHAR(10) NOT NULL DEFAULT 'kg',
      is_certified BOOLEAN DEFAULT true,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS compounding_recipe_item (
      recipe_item_id SERIAL PRIMARY KEY,
      recipe_id INTEGER REFERENCES compounding_recipe(recipe_id),
      item_id INTEGER REFERENCES item_master(item_id),
      qty NUMERIC(10,2) NOT NULL,
      ratio NUMERIC(5,2) NOT NULL,
      sort_order INTEGER DEFAULT 0
    );
  `);

  // Seed default recipe if not exists
  const existing = await pool.query(
    `SELECT recipe_id FROM compounding_recipe WHERE recipe_code = 'MIX-CERT-300'`
  );
  if (existing.rows.length === 0) {
    const recipeResult = await pool.query(
      `INSERT INTO compounding_recipe (recipe_name, recipe_code, batch_size)
       VALUES ('인정배합원료 300', 'MIX-CERT-300', 300)
       RETURNING recipe_id`
    );
    const recipeId = recipeResult.rows[0].recipe_id;

    // Insert recipe items - lookup item_id by item_code
    const items = [
      { code: 'RM-MB', qty: 150, ratio: 50, sort: 1 },
      { code: 'RM-EG50', qty: 60, ratio: 20, sort: 2 },
      { code: 'RM-EA', qty: 45, ratio: 15, sort: 3 },
      { code: 'RM-EP', qty: 45, ratio: 15, sort: 4 },
    ];

    for (const item of items) {
      const itemResult = await pool.query(
        `SELECT item_id FROM item_master WHERE item_code = $1`,
        [item.code]
      );
      const itemId = itemResult.rows.length > 0 ? itemResult.rows[0].item_id : null;
      await pool.query(
        `INSERT INTO compounding_recipe_item (recipe_id, item_id, qty, ratio, sort_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [recipeId, itemId, item.qty, item.ratio, item.sort]
      );
    }
  }
}

export async function compoundingRoutes(app: FastifyInstance) {
  // 서버 시작 시 마이그레이션 실행
  await migrateCompoundingRecipe();

  // GET /api/compounding/recipes - 배합비 목록
  app.get('/api/compounding/recipes', async () => {
    const result = await pool.query(`
      SELECT r.*,
        (SELECT json_agg(
          json_build_object(
            'recipe_item_id', ri.recipe_item_id,
            'item_id', ri.item_id,
            'item_code', i.item_code,
            'item_name', i.item_name,
            'qty', ri.qty,
            'ratio', ri.ratio,
            'sort_order', ri.sort_order
          ) ORDER BY ri.sort_order
        ) FROM compounding_recipe_item ri
        LEFT JOIN item_master i ON i.item_id = ri.item_id
        WHERE ri.recipe_id = r.recipe_id
        ) AS items
      FROM compounding_recipe r
      WHERE r.is_active = true
      ORDER BY r.recipe_id
    `);
    return { data: result.rows, total: result.rows.length };
  });

  // GET /api/compounding/recipes/:id - 배합비 상세
  app.get('/api/compounding/recipes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const recipeId = parseInt(id, 10);

    const recipeResult = await pool.query(
      `SELECT * FROM compounding_recipe WHERE recipe_id = $1`,
      [recipeId]
    );
    if (recipeResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '배합비를 찾을 수 없습니다.' });
    }

    const itemsResult = await pool.query(
      `SELECT ri.*, i.item_code, i.item_name
       FROM compounding_recipe_item ri
       LEFT JOIN item_master i ON i.item_id = ri.item_id
       WHERE ri.recipe_id = $1
       ORDER BY ri.sort_order`,
      [recipeId]
    );

    return {
      data: {
        ...recipeResult.rows[0],
        items: itemsResult.rows,
      },
    };
  });

  // POST /api/compounding/recipes - 배합비 생성
  app.post('/api/compounding/recipes', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const { recipe_name, recipe_code, batch_size, batch_unit, is_certified, items } = body as {
      recipe_name: string;
      recipe_code: string;
      batch_size?: number;
      batch_unit?: string;
      is_certified?: boolean;
      items?: Array<{ item_id: number; qty: number; ratio: number; sort_order?: number }>;
    };

    if (!recipe_name || !recipe_code) {
      return reply.status(400).send({ error: 'Bad Request', message: 'recipe_name, recipe_code는 필수입니다.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const recipeResult = await client.query(
        `INSERT INTO compounding_recipe (recipe_name, recipe_code, batch_size, batch_unit, is_certified)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          recipe_name,
          recipe_code,
          batch_size || 300,
          batch_unit || 'kg',
          is_certified !== undefined ? is_certified : true,
        ]
      );
      const recipe = recipeResult.rows[0];

      if (items && Array.isArray(items)) {
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          await client.query(
            `INSERT INTO compounding_recipe_item (recipe_id, item_id, qty, ratio, sort_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [recipe.recipe_id, item.item_id, item.qty, item.ratio, item.sort_order ?? idx + 1]
          );
        }
      }

      await client.query('COMMIT');

      // Fetch complete recipe with items
      const fullResult = await pool.query(
        `SELECT ri.*, i.item_code, i.item_name
         FROM compounding_recipe_item ri
         LEFT JOIN item_master i ON i.item_id = ri.item_id
         WHERE ri.recipe_id = $1
         ORDER BY ri.sort_order`,
        [recipe.recipe_id]
      );

      return { data: { ...recipe, items: fullResult.rows } };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // GET /api/compounding/calculate - 배합 소요량 계산 + FIFO LOT 배정
  app.get('/api/compounding/calculate', async (request, reply) => {
    const { recipe_id, batch_count } = request.query as {
      recipe_id?: string;
      batch_count?: string;
    };

    if (!recipe_id || !batch_count) {
      return reply.status(400).send({ error: 'Bad Request', message: 'recipe_id, batch_count는 필수입니다.' });
    }

    const recipeId = parseInt(recipe_id, 10);
    const batchCount = parseInt(batch_count, 10);

    if (isNaN(recipeId) || isNaN(batchCount) || batchCount < 1) {
      return reply.status(400).send({ error: 'Bad Request', message: '유효한 recipe_id와 batch_count(1 이상)를 입력하세요.' });
    }

    // 1. Get recipe info
    const recipeResult = await pool.query(
      `SELECT * FROM compounding_recipe WHERE recipe_id = $1`,
      [recipeId]
    );
    if (recipeResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '배합비를 찾을 수 없습니다.' });
    }
    const recipe = recipeResult.rows[0];

    // 2. Get recipe items
    const itemsResult = await pool.query(
      `SELECT ri.*, i.item_code, i.item_name
       FROM compounding_recipe_item ri
       LEFT JOIN item_master i ON i.item_id = ri.item_id
       WHERE ri.recipe_id = $1
       ORDER BY ri.sort_order`,
      [recipeId]
    );

    // 3. Calculate requirements per material and allocate LOTs (FIFO)
    const totalBatchSize = parseFloat(recipe.batch_size) * batchCount;
    const materials: Array<Record<string, unknown>> = [];

    for (const item of itemsResult.rows) {
      const requiredQty = parseFloat(item.qty) * batchCount;

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

      // Allocate from available LOTs (FIFO)
      let remainingNeed = requiredQty;
      const allocations: Array<Record<string, unknown>> = [];

      for (const lot of lotsResult.rows) {
        if (remainingNeed <= 0) break;

        const available = parseFloat(lot.remaining_qty ?? lot.qty);
        const allocate = Math.min(available, remainingNeed);

        allocations.push({
          lot_id: lot.lot_id,
          lot_number: lot.lot_number,
          available_qty: available,
          allocated_qty: allocate,
        });

        remainingNeed -= allocate;
      }

      materials.push({
        item_id: item.item_id,
        item_code: item.item_code,
        item_name: item.item_name,
        qty_per_batch: parseFloat(item.qty),
        ratio: parseFloat(item.ratio),
        required_qty: requiredQty,
        allocated_qty: requiredQty - Math.max(0, remainingNeed),
        shortage: Math.max(0, remainingNeed),
        lot_allocations: allocations,
      });
    }

    const hasShortage = materials.some((m) => (m.shortage as number) > 0);

    return {
      data: {
        recipe: {
          recipe_id: recipe.recipe_id,
          recipe_name: recipe.recipe_name,
          recipe_code: recipe.recipe_code,
          batch_size: parseFloat(recipe.batch_size),
          batch_unit: recipe.batch_unit,
        },
        batch_count: batchCount,
        total_output: totalBatchSize,
        total_output_unit: recipe.batch_unit,
        has_shortage: hasShortage,
        materials,
      },
    };
  });
}
