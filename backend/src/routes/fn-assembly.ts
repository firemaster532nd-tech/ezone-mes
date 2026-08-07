import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';

/**
 * 에프엔테크 (EZ-FN-P100) 완제품 구조체 조립 및 자재 계보 (Lineage) API
 */
export async function fnAssemblyRoutes(app: FastifyInstance) {
  // DB 마이그레이션
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fn_finished_stock (
      finished_id   SERIAL PRIMARY KEY,
      finished_lot  VARCHAR(80) NOT NULL UNIQUE, -- 사규 C302: 260807-FN-100-0001
      site_name     VARCHAR(200),                -- 현장명
      product_name  VARCHAR(200) NOT NULL,       -- EZ-FN-P100 (100A, 75A, 50A)
      diameter_mm   INTEGER NOT NULL DEFAULT 100,
      spec          VARCHAR(200),
      sleeve_lot    VARCHAR(80) NOT NULL,        -- 슬리브 LOT (260807U001)
      sheet_lot     VARCHAR(80),                 -- 차열시트 LOT (260807-S01)
      plate_lot     VARCHAR(80),                 -- 보호철판 LOT (260807GI001)
      sealant_lot   VARCHAR(80),                 -- 방화실란트 LOT (260807SS001)
      qty           NUMERIC(12,3) NOT NULL DEFAULT 0,
      qty_current   NUMERIC(12,3) NOT NULL DEFAULT 0,
      unit          VARCHAR(20) DEFAULT 'EA',
      location      VARCHAR(50) DEFAULT '1공장 완제품창고',
      status        VARCHAR(20) DEFAULT 'AVAILABLE', -- AVAILABLE, SHIPPED, RESERVED
      assembled_by  VARCHAR(100),
      assembled_at  TIMESTAMPTZ DEFAULT NOW(),
      notes         TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_fn_finished_lot ON fn_finished_stock(finished_lot);
    CREATE INDEX IF NOT EXISTS idx_fn_finished_site ON fn_finished_stock(site_name);

    CREATE TABLE IF NOT EXISTS lot_lineage (
      lineage_id    SERIAL PRIMARY KEY,
      parent_lot    VARCHAR(80) NOT NULL,  -- 완제품 LOT
      child_lot     VARCHAR(80) NOT NULL,  -- 부자재 LOT (U, S, GI, SS)
      child_cat     VARCHAR(50),           -- 자재 분류
      qty_used      NUMERIC(12,3) DEFAULT 1,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_lot_lineage_parent ON lot_lineage(parent_lot);
    CREATE INDEX IF NOT EXISTS idx_lot_lineage_child ON lot_lineage(child_lot);
  `).catch(e => console.warn('[fn-assembly] DB 마이그레이션 스킵:', e?.message));

  // ── GET /api/fn-assembly/next-finished-lot ──────────────────────────────
  app.get('/api/fn-assembly/next-finished-lot', { preHandler: requireAuth }, async (req) => {
    const { diam = '100', date } = req.query as any;
    const yymmdd = date || new Date().toISOString().replace(/-/g, '').slice(2, 8);
    const prefix = `${yymmdd}-FN-${diam}-`;
    const { rows } = await pool.query(
      `SELECT finished_lot FROM fn_finished_stock WHERE finished_lot LIKE $1 ORDER BY finished_lot DESC LIMIT 1`,
      [`${prefix}%`]
    );
    let nextSeq = 1;
    if (rows.length > 0) {
      const m = rows[0].finished_lot.match(/(\d+)$/);
      if (m) nextSeq = parseInt(m[1]) + 1;
    }
    const finishedLot = `${prefix}${String(nextSeq).padStart(4, '0')}`;
    return { finished_lot: finishedLot };
  });

  // ── GET /api/fn-assembly/finished-stock (완제품 재고 목록 및 계보) ──────
  app.get('/api/fn-assembly/finished-stock', { preHandler: requireAuth }, async (req) => {
    const { search, site_name, status } = req.query as any;
    let sql = `SELECT * FROM fn_finished_stock WHERE 1=1`;
    const params: any[] = [];
    if (status) { params.push(status); sql += ` AND status=$${params.length}`; }
    if (site_name) { params.push(`%${site_name}%`); sql += ` AND site_name ILIKE $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (finished_lot ILIKE $${params.length} OR product_name ILIKE $${params.length} OR sleeve_lot ILIKE $${params.length} OR plate_lot ILIKE $${params.length})`;
    }
    sql += ` ORDER BY assembled_at DESC, finished_id DESC LIMIT 200`;
    const { rows } = await pool.query(sql, params);

    // 계보 정보 포함
    for (const r of rows) {
      const { rows: lineage } = await pool.query(
        `SELECT * FROM lot_lineage WHERE parent_lot=$1 ORDER BY lineage_id`,
        [r.finished_lot]
      );
      r.lineage = lineage;
    }

    return { data: rows };
  });

  // ── POST /api/fn-assembly (완제품 조립 등록 및 자재 차감) ─────────────
  app.post('/api/fn-assembly', { preHandler: requireAuth }, async (req, reply) => {
    const b = req.body as any;
    const user = (req as any).user;

    if (!b.finished_lot || !b.sleeve_lot || !b.qty || Number(b.qty) <= 0) {
      return reply.code(400).send({ error: '완제품 LOT, 슬리브 LOT, 조립 수량은 필수입니다.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const qtyNum = Number(b.qty);

      // 1. 완제품 재고 등록
      const { rows: [finished] } = await client.query(
        `INSERT INTO fn_finished_stock
          (finished_lot, site_name, product_name, diameter_mm, spec,
           sleeve_lot, sheet_lot, plate_lot, sealant_lot,
           qty, qty_current, unit, location, status, assembled_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, $12, 'AVAILABLE', $13, $14)
         RETURNING *`,
        [
          b.finished_lot.trim(),
          b.site_name || '현장 미지정',
          b.product_name || `EZ-FN-P100 (${b.diameter_mm || 100}A)`,
          b.diameter_mm || 100,
          b.spec || `${b.diameter_mm || 100}A 조립완제품`,
          b.sleeve_lot.trim(),
          b.sheet_lot?.trim() || null,
          b.plate_lot?.trim() || null,
          b.sealant_lot?.trim() || null,
          qtyNum,
          b.unit || 'EA',
          b.location || '1공장 완제품창고',
          b.assembled_by || user?.worker_id || '공정작업자',
          b.notes || '에프엔테크 완제품 구조체 조립'
        ]
      );

      // 2. 계보(Lineage) 기록
      const children = [
        { lot: b.sleeve_lot, cat: '슬리브' },
        { lot: b.sheet_lot, cat: '차열시트' },
        { lot: b.plate_lot, cat: '보호철판/소켓' },
        { lot: b.sealant_lot, cat: '방화실란트' }
      ].filter(c => c.lot && c.lot.trim() !== '');

      for (const child of children) {
        const cleanChild = child.lot.trim();
        await client.query(
          `INSERT INTO lot_lineage (parent_lot, child_lot, child_cat, qty_used) VALUES ($1, $2, $3, $4)`,
          [b.finished_lot.trim(), cleanChild, child.cat, qtyNum]
        );

        // 3. 자재 차감
        await client.query(
          `UPDATE material_lots SET qty_current = GREATEST(0, qty_current - $1), updated_at = NOW() WHERE lot_number = $2 AND is_active = TRUE`,
          [qtyNum, cleanChild]
        );
      }

      await client.query('COMMIT');
      return { success: true, data: finished };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.code(500).send({ error: e.message || '완제품 조립 등록 중 오류 발생' });
    } finally {
      client.release();
    }
  });
}
