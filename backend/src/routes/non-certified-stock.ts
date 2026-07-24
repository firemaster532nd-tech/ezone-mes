import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

// ─────────────────────────────────────────────────────────────────────────────
// 비인정재고(non_certified_stock) 테이블 마이그레이션
// ─────────────────────────────────────────────────────────────────────────────
async function migrateNonCertifiedStock() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS non_certified_stock (
        id            SERIAL PRIMARY KEY,
        rack_code     VARCHAR(10) NOT NULL,
        pallet_no     INTEGER NOT NULL DEFAULT 1,
        item_name     VARCHAR(200) NOT NULL,
        spec          VARCHAR(300),
        lot_number    VARCHAR(100),
        qty           NUMERIC(12,3) DEFAULT 0,
        unit          VARCHAR(20) DEFAULT 'EA',
        reason        VARCHAR(200) DEFAULT '로트미확인',
        status        VARCHAR(20) DEFAULT 'ACTIVE',
        notes         TEXT,
        registered_at DATE DEFAULT CURRENT_DATE,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ncs_rack ON non_certified_stock(rack_code, pallet_no)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ncs_status ON non_certified_stock(status)`).catch(() => {});
    console.log('[non_certified_stock] 테이블 마이그레이션 완료');
  } catch (e: any) {
    console.warn('[non_certified_stock] 마이그레이션 스킵:', e?.message?.slice(0, 100));
  }
}

export async function nonCertifiedStockRoutes(app: FastifyInstance) {
  await migrateNonCertifiedStock();

  // ── GET /api/non-certified-stock ─────────────────────────────────────────
  // GET /api/non-certified-stock is handled in material-lots.ts (removed duplicate)

  // ── POST /api/non-certified-stock ─────────────────────────────────────────
  app.post('/api/non-certified-stock', async (req, reply) => {
    const b = req.body as any;
    if (!b.rack_code || !b.item_name) {
      return reply.status(400).send({ error: 'rack_code, item_name은 필수입니다.' });
    }
    const { rows: [row] } = await pool.query(
      `INSERT INTO non_certified_stock
        (rack_code, pallet_no, item_name, spec, lot_number, qty, unit, reason, notes, registered_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_DATE) RETURNING *`,
      [b.rack_code, b.pallet_no || 1, b.item_name, b.spec || null,
       b.lot_number || null, b.qty || 0, b.unit || 'EA',
       b.reason || '로트미확인', b.notes || null]
    );
    return { data: row };
  });

  // ── PATCH /api/non-certified-stock/:id ───────────────────────────────────
  app.patch('/api/non-certified-stock/:id', async (req) => {
    const { id } = req.params as any;
    const b = req.body as any;
    const { rows: [row] } = await pool.query(
      `UPDATE non_certified_stock SET
        item_name=COALESCE($1, item_name),
        spec=COALESCE($2, spec),
        lot_number=COALESCE($3, lot_number),
        qty=COALESCE($4, qty),
        reason=COALESCE($5, reason),
        status=COALESCE($6, status),
        notes=COALESCE($7, notes)
       WHERE id=$8 RETURNING *`,
      [b.item_name, b.spec, b.lot_number, b.qty, b.reason, b.status, b.notes, id]
    );
    return { data: row };
  });

  // ── DELETE /api/non-certified-stock/:id ───────────────────────────────────
  app.delete('/api/non-certified-stock/:id', async (req) => {
    const { id } = req.params as any;
    await pool.query(`UPDATE non_certified_stock SET status='DISPOSED' WHERE id=$1`, [id]);
    return { message: '비인정재고 항목이 폐기처리되었습니다.' };
  });

  // ── POST /api/non-certified-stock/google-sheet-import ─────────────────────
  // 구글시트 데이터 → material_lots (LOT 있음) + non_certified_stock (LOT 없음)
  app.post('/api/non-certified-stock/google-sheet-import', async (req, reply) => {
    interface SheetRow {
      rack_code: string;   // 예: A1
      pallet_no: number;   // 1 또는 2
      item_name: string;
      spec?: string;
      lot_number?: string;
      qty?: number;
      notes?: string;
    }
    const { rows: sheetRows } = req.body as { rows: SheetRow[] };

    if (!Array.isArray(sheetRows) || sheetRows.length === 0) {
      return reply.status(400).send({ error: '데이터가 없습니다.' });
    }

    const client = await pool.connect();
    const certResults: any[] = [];
    const nonCertResults: any[] = [];

    try {
      await client.query('BEGIN');

      for (const row of sheetRows) {
        const { rack_code, pallet_no, item_name, spec, lot_number, qty, notes } = row;
        // 로케이션: A1-P1, A1-P2 형식 (파레트 번호 포함)
        const location = `${rack_code}-P${pallet_no}`;
        const hasLot = lot_number && lot_number.trim() !== '';

        if (hasLot) {
          // ─── LOT 있는 재고 → material_lots ──────────────────────────────
          const cleanLot = lot_number!.trim();
          const { rows: exist } = await client.query(
            `SELECT lot_id FROM material_lots WHERE lot_number=$1 AND is_active=TRUE LIMIT 1`,
            [cleanLot]
          );
          if (exist.length > 0) {
            // 이미 있으면 위치 & 수량 업데이트
            await client.query(
              `UPDATE material_lots SET location=$1, qty_current=$2, updated_at=NOW() WHERE lot_id=$3`,
              [location, qty || 0, exist[0].lot_id]
            );
            certResults.push({ lot_number: cleanLot, location, status: 'updated' });
          } else {
            // 새로 삽입
            const category = item_name.includes('그라스울보드') ? '그라스울보드'
                           : item_name.includes('그라스울')    ? '그라스울'
                           : item_name.includes('세라믹울')    ? '세라믹울' : '기타';
            const { rows: [lot] } = await client.query(
              `INSERT INTO material_lots
                (lot_number, category, item_name, unit, qty_current, location, received_date, notes)
               VALUES ($1,$2,$3,'롤',$4,$5,CURRENT_DATE,$6)
               ON CONFLICT DO NOTHING
               RETURNING lot_id`,
              [cleanLot, category, item_name, qty || 0, location,
               notes || '구글시트 초기등록 (2026-07-24)']
            );
            if (lot && lot.lot_id && (qty || 0) > 0) {
              await client.query(
                `INSERT INTO material_transactions
                  (txn_date,lot_id,lot_number,category,txn_type,qty,qty_before,qty_after,source_type,notes)
                 VALUES (CURRENT_DATE,$1,$2,$3,'IN',$4,0,$4,'GOOGLE_SHEET_IMPORT','구글시트 기초재고 등록')`,
                [lot.lot_id, cleanLot, category, qty || 0]
              );
            }
            certResults.push({ lot_number: cleanLot, location, status: lot?.lot_id ? 'created' : 'skipped' });
          }
        } else {
          // ─── LOT 없는 재고 → non_certified_stock ────────────────────────
          const { rows: existNC } = await client.query(
            `SELECT id FROM non_certified_stock
             WHERE rack_code=$1 AND pallet_no=$2 AND status='ACTIVE' LIMIT 1`,
            [rack_code, pallet_no]
          );
          if (existNC.length > 0) {
            // 품목명 업데이트
            await client.query(
              `UPDATE non_certified_stock SET item_name=$1, spec=$2, notes=$3 WHERE id=$4`,
              [item_name, spec || null, notes || null, existNC[0].id]
            );
            nonCertResults.push({ rack_code, pallet_no, item_name, status: 'updated' });
          } else {
            await client.query(
              `INSERT INTO non_certified_stock
                (rack_code, pallet_no, item_name, spec, lot_number, qty, reason, notes, registered_at)
               VALUES ($1,$2,$3,$4,$5,$6,'로트미확인',$7,CURRENT_DATE)`,
              [rack_code, pallet_no, item_name, spec || null,
               lot_number && lot_number.trim() !== '' ? lot_number.trim() : null,
               qty || 0, notes || '구글시트 초기등록 (비인정재고)']
            );
            nonCertResults.push({ rack_code, pallet_no, item_name, status: 'created' });
          }
        }
      }

      await client.query('COMMIT');
      return {
        data: {
          certified: {
            total: certResults.length,
            created: certResults.filter(r => r.status === 'created').length,
            updated: certResults.filter(r => r.status === 'updated').length
          },
          non_certified: {
            total: nonCertResults.length,
            created: nonCertResults.filter(r => r.status === 'created').length,
            updated: nonCertResults.filter(r => r.status === 'updated').length
          }
        },
        message: `구글시트 데이터 업로드 완료: 인정재고 ${certResults.length}건, 비인정재고 ${nonCertResults.length}건`
      };
    } catch (e: any) {
      await client.query('ROLLBACK');
      console.error('[google-sheet-import]', e);
      return reply.status(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });
}
