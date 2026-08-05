import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

// ─────────────────────────────────────────────────────────────────────────────
// WMS (창고관리시스템) 라우트
// - storage_locations: 위치 마스터 (렉 108슬롯 + 비렉 6곳)
// - non_certified_stock 확장 컬럼 사용 (location_id, wms_status, category 등)
// - wms_transactions: 모든 입출고 이력
// ─────────────────────────────────────────────────────────────────────────────

async function migrateWms() {
  try {
    // 1. storage_locations 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS storage_locations (
        location_id   SERIAL PRIMARY KEY,
        location_code VARCHAR(30) UNIQUE NOT NULL,
        location_type VARCHAR(20) NOT NULL DEFAULT 'RACK',
        display_name  VARCHAR(100) NOT NULL,
        rack_col      VARCHAR(5),
        rack_tier     SMALLINT,
        rack_pallet   SMALLINT,
        sort_order    INTEGER DEFAULT 0,
        is_active     BOOLEAN DEFAULT TRUE
      )
    `);

    // 2. 렉 위치 초기 데이터 삽입 (A~R × 1~3층 × P1~P2 = 108슬롯)
    const cols = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R'];
    let sortOrder = 0;
    for (const col of cols) {
      for (let tier = 1; tier <= 3; tier++) {
        for (let pallet = 1; pallet <= 2; pallet++) {
          const code = `${col}${tier}-P${pallet}`;
          const palletLabel = pallet === 1 ? 'P1(오른쪽)' : 'P2(왼쪽)';
          const displayName = `${col}칸 ${tier}층 ${palletLabel}`;
          await pool.query(`
            INSERT INTO storage_locations (location_code, location_type, display_name, rack_col, rack_tier, rack_pallet, sort_order)
            VALUES ($1, 'RACK', $2, $3, $4, $5, $6)
            ON CONFLICT (location_code) DO NOTHING
          `, [code, displayName, col, tier, pallet, sortOrder++]);
        }
      }
    }

    // 3. 비렉 위치 초기 데이터 (8곳) — 야상 1·2공장 추가 (2026-07)
    const fieldLocations = [
      // 1공장
      { code: 'FIELD-1F-IN',      name: '1공장 안' },
      { code: 'FIELD-1F-MAT',     name: '1공장 원재료창고' },
      { code: 'FIELD-1F-TENT',    name: '1공장앞 천막' },
      { code: 'FIELD-1F-OUTDOOR', name: '야상 1공장 (야적)' },
      // 2공장
      { code: 'FIELD-2F-LEFT',    name: '2공장안 왼쪽' },
      { code: 'FIELD-2F-RIGHT',   name: '2공장안 오른쪽' },
      { code: 'FIELD-2F-TENT',    name: '2공장앞 천막' },
      { code: 'FIELD-2F-OUTDOOR', name: '야상 2공장 (야적)' },
    ];
    for (let i = 0; i < fieldLocations.length; i++) {
      const { code, name } = fieldLocations[i];
      await pool.query(`
        INSERT INTO storage_locations (location_code, location_type, display_name, sort_order)
        VALUES ($1, 'FIELD', $2, $3)
        ON CONFLICT (location_code) DO UPDATE SET display_name = EXCLUDED.display_name
      `, [code, name, 200 + i]);
    }

    // 4. non_certified_stock 컬럼 확장
    const ncsAlters = [
      `ALTER TABLE non_certified_stock ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES storage_locations(location_id)`,
      `ALTER TABLE non_certified_stock ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT '비인정'`,
      `ALTER TABLE non_certified_stock ADD COLUMN IF NOT EXISTS wms_status VARCHAR(30) DEFAULT 'ACTIVE'`,
      `ALTER TABLE non_certified_stock ADD COLUMN IF NOT EXISTS shipment_site_name VARCHAR(200)`,
      `ALTER TABLE non_certified_stock ADD COLUMN IF NOT EXISTS shipment_order_date DATE`,
      `ALTER TABLE non_certified_stock ADD COLUMN IF NOT EXISTS shipment_ready_id INTEGER`,
      `ALTER TABLE non_certified_stock ADD COLUMN IF NOT EXISTS return_receipt_id INTEGER`,
      `ALTER TABLE non_certified_stock ADD COLUMN IF NOT EXISTS is_pallet_unit BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE non_certified_stock ADD COLUMN IF NOT EXISTS pallet_count SMALLINT`,
      `ALTER TABLE non_certified_stock ADD COLUMN IF NOT EXISTS barcode VARCHAR(100)`,
    ];
    for (const sql of ncsAlters) {
      await pool.query(sql).catch(() => {});
    }

    // 기존 rack_code 기반 데이터를 location_id로 마이그레이션
    await pool.query(`
      UPDATE non_certified_stock ncs
      SET location_id = sl.location_id
      FROM storage_locations sl
      WHERE sl.location_code = ncs.rack_code || '-P' || ncs.pallet_no
        AND ncs.location_id IS NULL
        AND ncs.rack_code IS NOT NULL
    `).catch(() => {});

    // 5. assembly_lot 테이블에 location_id / staging_location 추가 (Supabase 호환)
    await pool.query(`ALTER TABLE assembly_lot ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES storage_locations(location_id)`).catch(() => {});
    await pool.query(`ALTER TABLE assembly_lot ADD COLUMN IF NOT EXISTS staging_location VARCHAR(50)`).catch(() => {});
    await pool.query(`ALTER TABLE assembly_lot ADD COLUMN IF NOT EXISTS remaining_qty INTEGER`).catch(() => {});
    await pool.query(`ALTER TABLE assembly_lot ADD COLUMN IF NOT EXISTS item_name VARCHAR(200)`).catch(() => {});
    // 기존 staging_location 문자열로 location_id 채우기
    await pool.query(`
      UPDATE assembly_lot al
      SET location_id = sl.location_id
      FROM storage_locations sl
      WHERE sl.location_code = al.staging_location
        AND al.location_id IS NULL
        AND al.staging_location IS NOT NULL
    `).catch(() => {});

    // 6. material_lots 테이블에 location_id 추가
    await pool.query(`ALTER TABLE material_lots ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES storage_locations(location_id)`).catch(() => {});
    await pool.query(`
      UPDATE material_lots ml
      SET location_id = sl.location_id
      FROM storage_locations sl
      WHERE sl.location_code = ml.location
        AND ml.location_id IS NULL
        AND ml.location IS NOT NULL
    `).catch(() => {});

    // 7. return_receipt_item 테이블에 location 추가
    await pool.query(`ALTER TABLE return_receipt_item ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES storage_locations(location_id)`).catch(() => {});
    await pool.query(`ALTER TABLE return_receipt_item ADD COLUMN IF NOT EXISTS location_memo TEXT`).catch(() => {});

    // 8. wms_transactions 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wms_transactions (
        txn_id        SERIAL PRIMARY KEY,
        item_table    VARCHAR(30),
        item_id       INTEGER,
        lot_number    VARCHAR(100),
        item_name     VARCHAR(200),
        txn_type      VARCHAR(30) NOT NULL,
        qty           NUMERIC(12,3),
        from_location_id INTEGER REFERENCES storage_locations(location_id),
        to_location_id   INTEGER REFERENCES storage_locations(location_id),
        is_pallet_in  BOOLEAN DEFAULT FALSE,
        pallet_count  SMALLINT,
        scanned_barcode VARCHAR(100),
        notes         TEXT,
        performed_by  INTEGER,
        performed_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_wms_txn_item ON wms_transactions(item_table, item_id)`).catch(() => {});
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_wms_txn_date ON wms_transactions(performed_at DESC)`).catch(() => {});

    console.log('[WMS] DB 마이그레이션 완료 — storage_locations, wms_transactions, 컬럼 추가 완료');
  } catch (e: any) {
    console.warn('[WMS] 마이그레이션 경고:', e?.message?.slice(0, 200));
  }
}

export async function wmsRoutes(app: FastifyInstance) {
  setImmediate(async () => {
    await migrateWms();
  });

  // ── GET /api/wms/locations ─────────────────────────────────────────────────
  // 위치 마스터 전체 목록 (렉 + 비렉)
  app.get('/api/wms/locations', async (req) => {
    const { type } = req.query as any;
    const { rows } = await pool.query(`
      SELECT location_id, location_code, location_type, display_name,
             rack_col, rack_tier, rack_pallet, sort_order, is_active
      FROM storage_locations
      WHERE is_active = TRUE
        ${type ? `AND location_type = $1` : ''}
      ORDER BY sort_order, location_code
    `, type ? [type.toUpperCase()] : []);
    return { data: rows };
  });

  // ── GET /api/wms/rack-map ──────────────────────────────────────────────────
  // 렉 맵 전체 현황 (비인정재고 + 인정재고 lots + 자재 material_lots 통합)
  // LocationManagementPage에서 단일 API로 사용
  app.get('/api/wms/rack-map', async (_req, reply) => {
    try {
      // 비인정재고 (non_certified_stock) — wms_status 포함
      const { rows: ncs } = await pool.query(`
        SELECT
          ncs.id, ncs.rack_code, ncs.pallet_no,
          ncs.item_name, ncs.spec, ncs.lot_number, ncs.qty, ncs.unit,
          ncs.status, ncs.notes,
          ncs.category, ncs.wms_status,
          ncs.shipment_site_name, ncs.shipment_order_date,
          ncs.location_id,
          sl.location_code, sl.display_name,
          sl.rack_col, sl.rack_tier, sl.rack_pallet
        FROM non_certified_stock ncs
        LEFT JOIN storage_locations sl ON sl.location_id = ncs.location_id
        WHERE ncs.status NOT IN ('DISPOSED')
        ORDER BY ncs.id
      `);

      // 인정재고 assembly_lot (생산 완제품 — Supabase 실제 테이블)
      const { rows: lots } = await pool.query(`
        SELECT
          al.lot_id, al.lot_number, al.qty,
          COALESCE(al.remaining_qty, al.qty) AS remaining_qty,
          al.staging_location, al.status,
          al.location_id,
          sl.location_code, sl.display_name,
          sl.rack_col, sl.rack_tier, sl.rack_pallet,
          COALESCE(al.item_name, al.lot_type, al.lot_number) AS item_name,
          al.lot_type AS item_code,
          NULL AS spec
        FROM assembly_lot al
        LEFT JOIN storage_locations sl ON sl.location_id = al.location_id
        WHERE al.status IN ('ACTIVE','STOCK','COMPLETE')
        ORDER BY al.lot_id
      `).catch(() => ({ rows: [] as any[] }));

      // 자재 material_lots
      const { rows: mats } = await pool.query(`
        SELECT
          ml.lot_id, ml.lot_number, ml.category, ml.item_name,
          ml.qty_current, ml.unit,
          ml.location, ml.is_active,
          ml.location_id,
          sl.location_code, sl.display_name,
          sl.rack_col, sl.rack_tier, sl.rack_pallet
        FROM material_lots ml
        LEFT JOIN storage_locations sl ON sl.location_id = ml.location_id
        WHERE ml.is_active = TRUE
        ORDER BY ml.lot_id
      `);

      return {
        data: {
          non_certified: ncs,
          lots: lots,
          material_lots: mats,
        }
      };
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // ── GET /api/wms/location-scan?loc=A1-P2 ──────────────────────────────────
  // QR 스캔 페이지용 — 특정 위치의 재고 현황 반환 (로그인 불필요)
  app.get('/api/wms/location-scan', async (req, reply) => {
    const { loc } = req.query as { loc?: string };
    if (!loc) return reply.status(400).send({ error: 'loc 파라미터가 필요합니다.' });

    try {
      const locParam = `%${loc}%`;

      // 비인정재고
      const { rows: ncs } = await pool.query(`
        SELECT ncs.id, ncs.rack_code, ncs.pallet_no,
               ncs.item_name, ncs.spec, ncs.lot_number, ncs.qty, ncs.unit,
               ncs.status, ncs.category,
               sl.location_code
        FROM non_certified_stock ncs
        LEFT JOIN storage_locations sl ON sl.location_id = ncs.location_id
        WHERE ncs.status NOT IN ('DISPOSED')
          AND (sl.location_code = $1 OR ncs.rack_code ILIKE $2)
        ORDER BY ncs.id
      `, [loc, locParam]);

      // 인정재고 (완제품 lot)
      const { rows: lots } = await pool.query(`
        SELECT al.lot_id, al.lot_number, al.qty,
               COALESCE(al.remaining_qty, al.qty) AS remaining_qty,
               COALESCE(al.item_name, al.lot_type, al.lot_number) AS item_name,
               al.staging_location, al.status,
               sl.location_code
        FROM assembly_lot al
        LEFT JOIN storage_locations sl ON sl.location_id = al.location_id
        WHERE al.status IN ('ACTIVE','STOCK','COMPLETE')
          AND (sl.location_code = $1 OR al.staging_location ILIKE $2)
        ORDER BY al.lot_id
      `, [loc, locParam]).catch(() => ({ rows: [] as any[] }));

      // 자재 lot
      const { rows: mats } = await pool.query(`
        SELECT ml.lot_id, ml.lot_number, ml.category, ml.item_name,
               ml.qty_current AS qty, ml.unit,
               ml.location,
               sl.location_code
        FROM material_lots ml
        LEFT JOIN storage_locations sl ON sl.location_id = ml.location_id
        WHERE ml.is_active = TRUE
          AND (sl.location_code = $1 OR ml.location ILIKE $2)
        ORDER BY ml.lot_id
      `, [loc, locParam]);

      return {
        loc,
        scannedAt: new Date().toISOString(),
        non_certified: ncs,
        lots,
        material_lots: mats,
        total: ncs.length + lots.length + mats.length,
      };
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // ── GET /api/wms/inventory ─────────────────────────────────────────────────
  // 통합 재고 목록 (필터: location_id, wms_status, category, search)
  app.get('/api/wms/inventory', async (req) => {
    const q = req.query as any;
    const conditions: string[] = [`ncs.status != 'DISPOSED'`];
    const params: any[] = [];
    let p = 1;

    if (q.wms_status) {
      conditions.push(`ncs.wms_status = $${p++}`);
      params.push(q.wms_status);
    }
    if (q.category) {
      conditions.push(`ncs.category = $${p++}`);
      params.push(q.category);
    }
    if (q.location_id) {
      conditions.push(`ncs.location_id = $${p++}`);
      params.push(q.location_id);
    }
    if (q.search) {
      conditions.push(`(ncs.item_name ILIKE $${p} OR ncs.lot_number ILIKE $${p})`);
      params.push(`%${q.search}%`);
      p++;
    }

    const { rows } = await pool.query(`
      SELECT
        ncs.id, ncs.rack_code, ncs.pallet_no,
        ncs.item_name, ncs.spec, ncs.lot_number,
        ncs.qty, ncs.unit, ncs.status, ncs.notes,
        ncs.category, ncs.wms_status,
        ncs.shipment_site_name, ncs.shipment_order_date,
        ncs.is_pallet_unit, ncs.pallet_count,
        ncs.registered_at, ncs.created_at,
        ncs.location_id,
        sl.location_code, sl.display_name, sl.location_type,
        sl.rack_col, sl.rack_tier, sl.rack_pallet
      FROM non_certified_stock ncs
      LEFT JOIN storage_locations sl ON sl.location_id = ncs.location_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ncs.wms_status, ncs.id DESC
    `, params);

    return { data: rows };
  });

  // ── POST /api/wms/inventory ────────────────────────────────────────────────
  // 신규 재고 등록 (파레트 단위 또는 개별)
  app.post('/api/wms/inventory', async (req, reply) => {
    const b = req.body as any;
    if (!b.item_name || !b.qty) {
      return reply.status(400).send({ error: 'item_name, qty는 필수입니다.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // location_id 결정: 문자열 코드 → ID 조회
      let locationId: number | null = b.location_id || null;
      if (!locationId && b.location_code) {
        const { rows: [loc] } = await client.query(
          `SELECT location_id FROM storage_locations WHERE location_code = $1`,
          [b.location_code]
        );
        locationId = loc?.location_id || null;
      }

      // rack_code, pallet_no 역산 (하위 호환)
      let rackCode = b.rack_code || null;
      let palletNo = b.pallet_no || 1;
      if (locationId && !rackCode) {
        const { rows: [loc] } = await client.query(
          `SELECT rack_col, rack_tier, rack_pallet FROM storage_locations WHERE location_id = $1`,
          [locationId]
        );
        if (loc?.rack_col) {
          rackCode = `${loc.rack_col}${loc.rack_tier}`;
          palletNo = loc.rack_pallet;
        }
      }

      const category = b.category || '비인정';
      const wmsStatus = b.wms_status || 'ACTIVE';
      const isPallet = b.is_pallet_unit || false;

      const { rows: [row] } = await client.query(`
        INSERT INTO non_certified_stock (
          rack_code, pallet_no, item_name, spec, lot_number, qty, unit,
          reason, notes, registered_at,
          location_id, category, wms_status,
          shipment_site_name, shipment_order_date, shipment_ready_id,
          return_receipt_id, is_pallet_unit, pallet_count, barcode
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, CURRENT_DATE,
          $10, $11, $12,
          $13, $14, $15,
          $16, $17, $18, $19
        ) RETURNING *
      `, [
        rackCode, palletNo, b.item_name, b.spec || null,
        b.lot_number || null, b.qty, b.unit || 'EA',
        b.reason || (category === '비인정' ? '로트미확인' : category),
        b.notes || null,
        locationId, category, wmsStatus,
        b.shipment_site_name || null, b.shipment_order_date || null, b.shipment_ready_id || null,
        b.return_receipt_id || null, isPallet, b.pallet_count || null, b.barcode || null,
      ]);

      // 이력 기록
      const txnType = wmsStatus === 'SHIPMENT_READY' ? 'IN_SR' :
                      category === '반품' ? 'RETURN_IN' : 'IN';
      await client.query(`
        INSERT INTO wms_transactions (
          item_table, item_id, lot_number, item_name, txn_type, qty,
          to_location_id, is_pallet_in, pallet_count, notes, performed_by
        ) VALUES ('non_certified_stock', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        row.id, row.lot_number, row.item_name, txnType, row.qty,
        locationId, isPallet, b.pallet_count || null,
        b.notes || `WMS 입고: ${b.item_name}`,
        b.performed_by || null,
      ]);

      await client.query('COMMIT');
      return { data: row };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.status(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ── PATCH /api/wms/inventory/:id ──────────────────────────────────────────
  // 재고 수정 (위치 이동, 상태 변경, 수량 조정)
  app.patch('/api/wms/inventory/:id', async (req, reply) => {
    const { id } = req.params as any;
    const b = req.body as any;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 현재 레코드 조회
      const { rows: [current] } = await client.query(
        `SELECT * FROM non_certified_stock WHERE id = $1`, [id]
      );
      if (!current) return reply.status(404).send({ error: '항목을 찾을 수 없습니다.' });

      // location_code → location_id 변환
      let newLocationId = b.location_id !== undefined ? b.location_id : null;
      if (b.location_code && !newLocationId) {
        const { rows: [loc] } = await client.query(
          `SELECT location_id, rack_col, rack_tier, rack_pallet FROM storage_locations WHERE location_code = $1`,
          [b.location_code]
        );
        newLocationId = loc?.location_id || null;
        if (loc?.rack_col) {
          b.rack_code = `${loc.rack_col}${loc.rack_tier}`;
          b.pallet_no = loc.rack_pallet;
        }
      }
      const effectiveLocationId = newLocationId !== null ? newLocationId : current.location_id;

      const { rows: [row] } = await client.query(`
        UPDATE non_certified_stock SET
          item_name    = COALESCE($1, item_name),
          spec         = COALESCE($2, spec),
          lot_number   = COALESCE($3, lot_number),
          qty          = COALESCE($4, qty),
          unit         = COALESCE($5, unit),
          reason       = COALESCE($6, reason),
          status       = COALESCE($7, status),
          notes        = COALESCE($8, notes),
          category     = COALESCE($9, category),
          wms_status   = COALESCE($10, wms_status),
          shipment_site_name  = COALESCE($11, shipment_site_name),
          shipment_order_date = COALESCE($12, shipment_order_date),
          location_id  = COALESCE($13, location_id),
          rack_code    = COALESCE($14, rack_code),
          pallet_no    = COALESCE($15, pallet_no),
          barcode      = COALESCE($16, barcode)
        WHERE id = $17 RETURNING *
      `, [
        b.item_name, b.spec, b.lot_number, b.qty, b.unit,
        b.reason, b.status, b.notes, b.category, b.wms_status,
        b.shipment_site_name, b.shipment_order_date,
        newLocationId, b.rack_code, b.pallet_no, b.barcode,
        id
      ]);

      // 위치 이동 이력
      if (newLocationId && newLocationId !== current.location_id) {
        await client.query(`
          INSERT INTO wms_transactions (
            item_table, item_id, lot_number, item_name, txn_type,
            from_location_id, to_location_id, notes, performed_by
          ) VALUES ('non_certified_stock', $1, $2, $3, 'MOVE', $4, $5, $6, $7)
        `, [id, row.lot_number, row.item_name, current.location_id, effectiveLocationId,
            b.notes || '위치 이동', b.performed_by || null]);
      }
      // 출하대기 상태 변경 이력
      if (b.wms_status && b.wms_status !== current.wms_status) {
        const txnType = b.wms_status === 'SHIPMENT_READY' ? 'STATUS_TO_SR' : 'STATUS_TO_ACT';
        await client.query(`
          INSERT INTO wms_transactions (
            item_table, item_id, lot_number, item_name, txn_type,
            notes, performed_by
          ) VALUES ('non_certified_stock', $1, $2, $3, $4, $5, $6)
        `, [id, row.lot_number, row.item_name, txnType,
            b.notes || `상태 변경: ${current.wms_status} → ${b.wms_status}`,
            b.performed_by || null]);
      }

      await client.query('COMMIT');
      return { data: row };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.status(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ── DELETE /api/wms/inventory/:id ─────────────────────────────────────────
  // 재고 삭제 (manager 이상만)
  app.delete('/api/wms/inventory/:id', async (req, reply) => {
    const { id } = req.params as any;
    // TODO: 권한 체크 (manager 이상)
    await pool.query(`UPDATE non_certified_stock SET status='DISPOSED' WHERE id=$1`, [id]);
    await pool.query(`
      INSERT INTO wms_transactions (item_table, item_id, txn_type, notes, performed_by)
      VALUES ('non_certified_stock', $1, 'DELETE', '관리자 삭제', $2)
    `, [id, (req.body as any)?.performed_by || null]).catch(() => {});
    return { message: '재고 항목이 삭제되었습니다.' };
  });

  // ── POST /api/wms/out ─────────────────────────────────────────────────────
  // 출고 처리 (바코드 스캔 or LOT 번호)
  app.post('/api/wms/out', async (req, reply) => {
    const b = req.body as any;
    if (!b.lot_number && !b.barcode && !b.id) {
      return reply.status(400).send({ error: 'lot_number, barcode, id 중 하나는 필수입니다.' });
    }
    if (!b.qty || b.qty <= 0) {
      return reply.status(400).send({ error: '출고 수량(qty)은 양수여야 합니다.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 품목 조회
      let item: any = null;
      if (b.id) {
        const { rows: [r] } = await client.query(
          `SELECT * FROM non_certified_stock WHERE id=$1 AND status='ACTIVE'`, [b.id]
        );
        item = r;
      } else if (b.lot_number) {
        const { rows: [r] } = await client.query(
          `SELECT * FROM non_certified_stock WHERE lot_number=$1 AND status='ACTIVE' ORDER BY id LIMIT 1`,
          [b.lot_number]
        );
        item = r;
        // assembly_lot 테이블도 확인
        if (!item) {
          const { rows: [l] } = await client.query(
            `SELECT lot_id AS id, lot_number, COALESCE(remaining_qty, qty) AS qty, location_id FROM assembly_lot WHERE lot_number=$1 AND status IN ('ACTIVE','STOCK','COMPLETE') LIMIT 1`,
            [b.lot_number]
          ).catch(() => ({ rows: [] as any[] }));
          if (l) {
            // assembly_lot 출고 처리
            await client.query(
              `UPDATE assembly_lot SET remaining_qty = COALESCE(remaining_qty, qty) - $1 WHERE lot_id = $2`,
              [b.qty, l.id]
            ).catch(() => {});
            await client.query(`
              INSERT INTO wms_transactions (item_table, item_id, lot_number, txn_type, qty, from_location_id, scanned_barcode, notes, performed_by)
              VALUES ('assembly_lot', $1, $2, 'OUT', $3, $4, $5, $6, $7)
            `, [l.id, l.lot_number, b.qty, l.location_id, b.barcode || null,
                b.notes || '바코드 스캔 출고', b.performed_by || null]);
            await client.query('COMMIT');
            return { data: { ...l, out_qty: b.qty }, message: '출고 처리 완료 (인정재고)' };
          }
        }
      } else if (b.barcode) {
        const { rows: [r] } = await client.query(
          `SELECT * FROM non_certified_stock WHERE barcode=$1 AND status='ACTIVE' LIMIT 1`,
          [b.barcode]
        );
        item = r;
      }

      if (!item) return reply.status(404).send({ error: '해당 품목을 찾을 수 없거나 이미 출고된 항목입니다.' });
      if (item.wms_status === 'SHIPMENT_READY') {
        return reply.status(409).send({ error: '출하대기 상태의 재고입니다. 출하처리 후 출고하세요.' });
      }
      if (parseFloat(item.qty) < b.qty) {
        return reply.status(409).send({ error: `재고 부족: 현재 ${item.qty}${item.unit}` });
      }

      const newQty = parseFloat(item.qty) - b.qty;
      await client.query(
        `UPDATE non_certified_stock SET qty=$1, status=CASE WHEN $1=0 THEN 'DISPOSED' ELSE status END WHERE id=$2`,
        [newQty, item.id]
      );
      await client.query(`
        INSERT INTO wms_transactions (
          item_table, item_id, lot_number, item_name, txn_type, qty,
          from_location_id, scanned_barcode, notes, performed_by
        ) VALUES ('non_certified_stock', $1, $2, $3, 'OUT', $4, $5, $6, $7, $8)
      `, [item.id, item.lot_number, item.item_name, b.qty,
          item.location_id, b.barcode || null,
          b.notes || '바코드 스캔 출고', b.performed_by || null]);

      await client.query('COMMIT');
      return {
        data: { ...item, new_qty: newQty, out_qty: b.qty },
        message: `출고 완료: ${item.item_name} ${b.qty}${item.unit}`
      };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.status(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ── POST /api/wms/move ────────────────────────────────────────────────────
  // 위치 이동
  app.post('/api/wms/move', async (req, reply) => {
    const b = req.body as any;
    if (!b.id || !b.to_location_code) {
      return reply.status(400).send({ error: 'id, to_location_code는 필수입니다.' });
    }

    const { rows: [loc] } = await pool.query(
      `SELECT location_id, rack_col, rack_tier, rack_pallet FROM storage_locations WHERE location_code=$1`,
      [b.to_location_code]
    );
    if (!loc) return reply.status(400).send({ error: '유효하지 않은 위치 코드입니다.' });

    const rackCode = loc.rack_col ? `${loc.rack_col}${loc.rack_tier}` : null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [current] } = await client.query(
        `SELECT * FROM non_certified_stock WHERE id=$1`, [b.id]
      );
      if (!current) return reply.status(404).send({ error: '항목을 찾을 수 없습니다.' });

      await client.query(`
        UPDATE non_certified_stock SET
          location_id=$1, rack_code=COALESCE($2,rack_code), pallet_no=COALESCE($3,pallet_no)
        WHERE id=$4
      `, [loc.location_id, rackCode, loc.rack_pallet || null, b.id]);

      await client.query(`
        INSERT INTO wms_transactions (
          item_table, item_id, lot_number, item_name, txn_type,
          from_location_id, to_location_id, notes, performed_by
        ) VALUES ('non_certified_stock', $1, $2, $3, 'MOVE', $4, $5, $6, $7)
      `, [b.id, current.lot_number, current.item_name, current.location_id, loc.location_id,
          b.notes || `이동: ${current.rack_code} → ${b.to_location_code}`,
          b.performed_by || null]);

      await client.query('COMMIT');
      return { message: `이동 완료: ${b.to_location_code}` };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.status(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ── POST /api/wms/shipment-ready/:id ─────────────────────────────────────
  // 출하대기 상태 전환 (ACTIVE → SHIPMENT_READY)
  app.post('/api/wms/shipment-ready/:id', async (req, reply) => {
    const { id } = req.params as any;
    const b = req.body as any;

    const { rows: [row] } = await pool.query(`
      UPDATE non_certified_stock SET
        wms_status='SHIPMENT_READY',
        shipment_site_name=$1,
        shipment_order_date=$2,
        shipment_ready_id=$3
      WHERE id=$4 RETURNING *
    `, [b.shipment_site_name || null, b.shipment_order_date || null, b.shipment_ready_id || null, id]);

    if (!row) return reply.status(404).send({ error: '항목을 찾을 수 없습니다.' });
    await pool.query(`
      INSERT INTO wms_transactions (item_table, item_id, lot_number, item_name, txn_type, notes, performed_by)
      VALUES ('non_certified_stock', $1, $2, $3, 'STATUS_TO_SR', $4, $5)
    `, [id, row.lot_number, row.item_name,
        `출하대기 전환: ${b.shipment_site_name || ''}`,
        b.performed_by || null]).catch(() => {});

    return { data: row, message: '출하대기로 전환되었습니다.' };
  });

  // ── DELETE /api/wms/shipment-ready/:id ───────────────────────────────────
  // 출하대기 취소 (SHIPMENT_READY → ACTIVE)
  app.delete('/api/wms/shipment-ready/:id', async (req, reply) => {
    const { id } = req.params as any;
    const b = req.body as any;

    const { rows: [row] } = await pool.query(`
      UPDATE non_certified_stock SET
        wms_status='ACTIVE',
        shipment_site_name=NULL,
        shipment_order_date=NULL,
        shipment_ready_id=NULL
      WHERE id=$1 RETURNING *
    `, [id]);
    if (!row) return reply.status(404).send({ error: '항목을 찾을 수 없습니다.' });
    await pool.query(`
      INSERT INTO wms_transactions (item_table, item_id, lot_number, item_name, txn_type, notes, performed_by)
      VALUES ('non_certified_stock', $1, $2, $3, 'STATUS_TO_ACT', '출하대기 취소', $4)
    `, [id, row.lot_number, row.item_name, b?.performed_by || null]).catch(() => {});

    return { data: row, message: '출하대기가 취소되었습니다.' };
  });

  // ── GET /api/wms/shipment-ready-items ─────────────────────────────────────
  // 출하대기 목록 (현장별 - NCS, assembly_lot, material_lots 통합 조회)
  app.get('/api/wms/shipment-ready-items', async (req) => {
    const { site_name } = req.query as any;
    const { rows } = await pool.query(`
      SELECT
        ncs.id, ncs.item_name, ncs.spec, ncs.lot_number, ncs.qty, ncs.unit,
        COALESCE(ncs.shipment_site_name, '기본 출하 현장') AS shipment_site_name,
        ncs.shipment_order_date,
        ncs.location_id,
        COALESCE(sl.location_code, ncs.rack_code) AS location_code,
        COALESCE(sl.display_name, ncs.rack_code) AS display_name,
        ncs.created_at
      FROM non_certified_stock ncs
      LEFT JOIN storage_locations sl ON sl.location_id = ncs.location_id
      WHERE (ncs.wms_status = 'SHIPMENT_READY' OR ncs.location_id IS NOT NULL OR ncs.rack_code IS NOT NULL)
        AND ncs.status != 'DISPOSED'
        ${site_name ? `AND ncs.shipment_site_name ILIKE $1` : ''}

      UNION ALL

      SELECT
        al.lot_id AS id,
        COALESCE(al.item_name, al.lot_type, '반제품 조립품') AS item_name,
        '표준규격' AS spec, al.lot_number, COALESCE(al.remaining_qty, al.qty) AS qty, 'EA' AS unit,
        COALESCE(al.staging_location, '조립 현장') AS shipment_site_name,
        al.created_at::date AS shipment_order_date,
        al.location_id,
        COALESCE(sl.location_code, al.staging_location) AS location_code,
        COALESCE(sl.display_name, al.staging_location) AS display_name,
        al.created_at
      FROM assembly_lot al
      LEFT JOIN storage_locations sl ON sl.location_id = al.location_id
      WHERE (al.staging_location IS NOT NULL OR al.location_id IS NOT NULL)
        AND al.status IN ('ACTIVE', 'STOCK', 'COMPLETE')

      ORDER BY shipment_site_name, shipment_order_date, id
    `, site_name ? [`%${site_name}%`] : []);
    return { data: rows };
  });

  // ── POST /api/wms/barcode/lookup ──────────────────────────────────────────
  // 바코드 또는 LOT번호로 품목 조회 (출고 처리 전 확인용)
  app.post('/api/wms/barcode/lookup', async (req, reply) => {
    const b = req.body as any;
    const identifier = b.barcode || b.lot_number;
    if (!identifier) return reply.status(400).send({ error: 'barcode 또는 lot_number 필수' });

    // non_certified_stock 조회
    const { rows: ncRows } = await pool.query(`
      SELECT ncs.*, sl.location_code, sl.display_name
      FROM non_certified_stock ncs
      LEFT JOIN storage_locations sl ON sl.location_id = ncs.location_id
      WHERE (ncs.barcode=$1 OR ncs.lot_number=$1) AND ncs.status='ACTIVE'
      ORDER BY ncs.id
    `, [identifier]);

    // assembly_lot 테이블도 조회
    const { rows: lotRows } = await pool.query(`
      SELECT al.lot_id AS id, al.lot_number,
             COALESCE(al.remaining_qty, al.qty) AS qty, al.status,
             sl.location_code, sl.display_name,
             COALESCE(al.item_name, al.lot_type) AS item_name, NULL AS spec
      FROM assembly_lot al
      LEFT JOIN storage_locations sl ON sl.location_id = al.location_id
      WHERE al.lot_number=$1 AND al.status IN ('ACTIVE','STOCK','COMPLETE')
    `, [identifier]).catch(() => ({ rows: [] as any[] }));

    if (ncRows.length === 0 && lotRows.length === 0) {
      return reply.status(404).send({ error: '해당 바코드/LOT를 찾을 수 없습니다.' });
    }

    return { data: { non_certified: ncRows, lots: lotRows } };
  });

  // ── POST /api/wms/batch-upload ────────────────────────────────────────────
  // 연속 바코드 스캔 일괄 등록 & WMS 트랜잭션 수불 처리
  app.post('/api/wms/batch-upload', async (req, reply) => {
    const { items } = req.body as {
      items: Array<{
        lot_number: string;
        mode: 'IN' | 'STAGING' | 'OUT' | 'MOVE';
        qty?: number;
        location_code?: string;
        project_name?: string;
        item_name?: string;
        spec?: string;
      }>;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({ error: '일괄 등록할 스캔 품목 목록(items)이 비어있습니다.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let successCount = 0;

      for (const item of items) {
        const { lot_number, mode, qty = 1, location_code, project_name, item_name, spec } = item;
        if (!lot_number) continue;

        // 위치 ID 조회
        let locId: number | null = null;
        if (location_code) {
          const locRes = await client.query('SELECT location_id FROM storage_locations WHERE location_code = $1', [location_code]);
          if (locRes.rows.length > 0) locId = locRes.rows[0].location_id;
        }

        if (mode === 'IN') {
          // 입고 처리: non_certified_stock 생성 또는 상태 ACTIVE
          await client.query(`
            INSERT INTO non_certified_stock (lot_number, item_name, spec, qty, status, wms_status, location_id, created_at)
            VALUES ($1, $2, $3, $4, 'ACTIVE', 'ACTIVE', $5, NOW())
            ON CONFLICT (lot_number) DO UPDATE
            SET qty = non_certified_stock.qty + $4, status = 'ACTIVE', wms_status = 'ACTIVE',
                location_id = COALESCE($5, non_certified_stock.location_id), updated_at = NOW()
          `, [lot_number, item_name || '원부자재', spec || '표준규격', qty, locId]);
          successCount++;
        } else if (mode === 'STAGING') {
          // 출하 대기 처리
          await client.query(`
            UPDATE non_certified_stock
            SET wms_status = 'SHIPMENT_READY', shipment_site_name = COALESCE($2, shipment_site_name),
                location_id = COALESCE($3, location_id), updated_at = NOW()
            WHERE lot_number = $1
          `, [lot_number, project_name, locId]);

          await client.query(`
            UPDATE assembly_lot
            SET staging_location = COALESCE($2, staging_location), location_id = COALESCE($3, location_id), updated_at = NOW()
            WHERE lot_number = $1
          `, [lot_number, project_name, locId]);
          successCount++;
        } else if (mode === 'OUT') {
          // 출고/소분 반출 확정 처리 (원자재 1,000kg 중 100kg/50kg 소분 차감)
          const lotRes = await client.query(`
            UPDATE material_lots
            SET qty_current = GREATEST(0, qty_current - $2), updated_at = NOW()
            WHERE lot_number = $1 RETURNING lot_id, category, qty_current
          `, [lot_number, qty]);

          if (lotRes.rows.length > 0) {
            const { lot_id, category, qty_current } = lotRes.rows[0];
            const qtyAfter = Number(qty_current);
            const qtyBefore = qtyAfter + Number(qty);
            await client.query(`
              INSERT INTO material_transactions (
                txn_date, lot_id, lot_number, category, txn_type, qty, qty_before, qty_after, notes
              ) VALUES (
                CURRENT_DATE, $1, $2, $3, 'OUT', -$4, $5, $6, $7
              )
            `, [lot_id, lot_number, category, 'OUT', qty, qtyBefore, qtyAfter, `원부자재 소분 반출 (${qty} 차감)`]);
          }

          await client.query(`
            UPDATE non_certified_stock
            SET qty = GREATEST(0, qty - $2),
                wms_status = CASE WHEN qty - $2 <= 0 THEN 'SHIPPED' ELSE wms_status END,
                status = CASE WHEN qty - $2 <= 0 THEN 'SHIPPED' ELSE status END,
                updated_at = NOW()
            WHERE lot_number = $1
          `, [lot_number, qty]);

          await client.query(`
            UPDATE assembly_lot
            SET status = 'SHIPPED', updated_at = NOW()
            WHERE lot_number = $1
          `, [lot_number]);
          successCount++;
        } else if (mode === 'MOVE') {
          // 위치 이동
          if (locId) {
            await client.query(`UPDATE non_certified_stock SET location_id = $2, updated_at = NOW() WHERE lot_number = $1`, [lot_number, locId]);
            await client.query(`UPDATE assembly_lot SET location_id = $2, updated_at = NOW() WHERE lot_number = $1`, [lot_number, locId]);
            successCount++;
          }
        }
      }

      await client.query('COMMIT');
      return reply.send({
        success: true,
        message: `총 ${successCount}건의 스캔 항목이 성공적으로 일괄 등록되었습니다.`,
        processed_count: successCount,
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[wms/batch-upload error]', err);
      return reply.status(500).send({ error: '일괄 등록 처리 중 오류가 발생했습니다: ' + err.message });
    } finally {
      client.release();
    }
  });

  // ── GET /api/wms/transactions ─────────────────────────────────────────────
  // 입출고 이력 조회
  app.get('/api/wms/transactions', async (req) => {
    const q = req.query as any;
    const conditions: string[] = [];
    const params: any[] = [];
    let p = 1;

    if (q.item_id) { conditions.push(`txn_id = ANY(SELECT txn_id FROM wms_transactions WHERE item_id=$${p++})`); params.push(q.item_id); }
    if (q.lot_number) { conditions.push(`lot_number ILIKE $${p}`); params.push(`%${q.lot_number}%`); p++; }
    if (q.txn_type) { conditions.push(`txn_type=$${p++}`); params.push(q.txn_type); }
    if (q.from_date) { conditions.push(`performed_at >= $${p++}::date`); params.push(q.from_date); }
    if (q.to_date) { conditions.push(`performed_at < ($${p++}::date + interval '1 day')`); params.push(q.to_date); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(`
      SELECT t.*,
        fl.location_code AS from_location_code, fl.display_name AS from_location_name,
        tl.location_code AS to_location_code,   tl.display_name AS to_location_name
      FROM wms_transactions t
      LEFT JOIN storage_locations fl ON fl.location_id = t.from_location_id
      LEFT JOIN storage_locations tl ON tl.location_id = t.to_location_id
      ${where}
      ORDER BY t.performed_at DESC
      LIMIT 200
    `, params);
    return { data: rows };
  });

  // ── GET /api/wms/search ───────────────────────────────────────────────────
  // 바코드 또는 LOT번호로 통합 검색 (출고 처리 전 품목 확인용)
  app.get('/api/wms/search', async (req, reply) => {
    const { q } = req.query as { q?: string };
    if (!q || !q.trim()) return reply.status(400).send({ error: '검색어(q)를 입력하세요.' });
    const query = q.trim();

    // 1. non_certified_stock 검색
    const { rows: ncRows } = await pool.query(`
      SELECT
        ncs.id, ncs.lot_number, ncs.item_name, ncs.spec, ncs.qty,
        ncs.unit, ncs.status, ncs.wms_status, ncs.category,
        ncs.shipment_site_name, ncs.barcode,
        sl.location_code, sl.display_name AS location_name
      FROM non_certified_stock ncs
      LEFT JOIN storage_locations sl ON sl.location_id = ncs.location_id
      WHERE ncs.status = 'ACTIVE'
        AND (ncs.lot_number ILIKE $1 OR ncs.barcode = $2 OR ncs.item_name ILIKE $1)
      ORDER BY ncs.id DESC
      LIMIT 10
    `, [`%${query}%`, query]);

    if (ncRows.length > 0) {
      const item = ncRows[0];
      return {
        data: {
          id: item.id,
          lot_number: item.lot_number,
          item_name: item.item_name,
          spec: item.spec,
          qty_current: parseFloat(item.qty) || 0,
          remaining_qty: parseFloat(item.qty) || 0,
          unit: item.unit,
          status: item.wms_status || item.status,
          category: item.category,
          location: item.location_code,
          location_name: item.location_name,
          source: 'non_certified_stock',
          all_results: ncRows,
        }
      };
    }

    // 2. assembly_lot 테이블 검색
    const { rows: lotRows } = await pool.query(`
      SELECT
        al.lot_id AS id, al.lot_number,
        COALESCE(al.remaining_qty, al.qty) AS remaining_qty, al.status,
        COALESCE(al.item_name, al.lot_type) AS item_name, NULL AS spec,
        sl.location_code, sl.display_name AS location_name
      FROM assembly_lot al
      LEFT JOIN storage_locations sl ON sl.location_id = al.location_id
      WHERE al.status IN ('ACTIVE','STOCK','COMPLETE')
        AND (al.lot_number ILIKE $1)
      LIMIT 5
    `, [`%${query}%`]).catch(() => ({ rows: [] as any[] }));

    if (lotRows.length > 0) {
      const item = lotRows[0];
      return {
        data: {
          id: item.id,
          lot_number: item.lot_number,
          item_name: item.item_name,
          spec: item.spec,
          qty_current: parseFloat(item.remaining_qty) || 0,
          remaining_qty: parseFloat(item.remaining_qty) || 0,
          status: item.status,
          location: item.location_code,
          location_name: item.location_name,
          source: 'assembly_lot',
          all_results: lotRows,
        }
      };
    }

    return reply.status(404).send({ error: `'${query}'에 해당하는 재고를 찾을 수 없습니다.` });
  });

  // ─── GET /api/wms/scan/:lot_number ────────────────────────────────────────
  // 스캐너 전용 정밀 조회: LOT번호 정확히 일치하는 재고 반환
  // 응답: 재고 전체 정보 (위치, 수량, 상태, 출하대기여부 포함)
  app.get('/api/wms/scan/:lot_number', async (req, reply) => {
    const { lot_number } = req.params as { lot_number: string };
    const lotNo = decodeURIComponent(lot_number).trim();

    // 1) material_lots (원/부자재) 정확 조회
    const { rows: [ml] } = await pool.query(`
      SELECT
        ml.lot_id AS id,
        ml.lot_number,
        ml.category,
        ml.item_name,
        ml.density,
        ml.thickness,
        ml.width_mm,
        ml.length_mm,
        ml.unit,
        ml.qty_current,
        ml.received_date,
        ml.location,
        ml.location_id,
        ml.supplier_name,
        ml.supplier_lot,
        sl.display_name   AS location_name,
        sl.location_code  AS location_code_from_sl,
        'material_lots'   AS source_table
      FROM material_lots ml
      LEFT JOIN storage_locations sl ON sl.location_id = ml.location_id
      WHERE ml.lot_number = $1 AND ml.is_active = TRUE
      LIMIT 1
    `, [lotNo]);

    if (ml) {
      return { data: {
        ...ml,
        source: 'material_lots',
        location: ml.location_code_from_sl || ml.location || null,
        location_name: ml.location_name || null,
        wms_status: 'NORMAL',
      }};
    }

    // 2) non_certified_stock (제품/반제품)
    const { rows: [ncs] } = await pool.query(`
      SELECT
        ncs.stock_id AS id,
        ncs.lot_number,
        ncs.category,
        ncs.item_name,
        ncs.spec,
        ncs.unit,
        ncs.qty           AS qty_current,
        ncs.received_date,
        ncs.wms_status,
        ncs.po_id,
        ncs.po_date,
        ncs.shipment_po_no,
        ncs.location_id,
        sl.location_code,
        sl.display_name   AS location_name,
        po.po_number,
        po.site_name      AS po_site_name,
        'non_certified_stock' AS source_table
      FROM non_certified_stock ncs
      LEFT JOIN storage_locations sl ON sl.location_id = ncs.location_id
      LEFT JOIN purchase_order po ON po.po_id = ncs.po_id
      WHERE ncs.lot_number = $1 AND ncs.is_active = TRUE
      LIMIT 1
    `, [lotNo]);

    if (ncs) {
      return { data: {
        ...ncs,
        source: 'non_certified_stock',
        location: ncs.location_code || null,
      }};
    }

    // 3) assembly_lot (완제품 LOT)
    const { rows: [lot] } = await pool.query(`
      SELECT
        al.lot_id AS id,
        al.lot_number,
        COALESCE(al.remaining_qty, al.qty) AS qty_current,
        al.status,
        al.location_id,
        COALESCE(al.item_name, al.lot_type) AS item_name,
        NULL AS spec,
        NULL AS unit,
        sl.location_code,
        sl.display_name   AS location_name,
        'assembly_lot'    AS source_table
      FROM assembly_lot al
      LEFT JOIN storage_locations sl ON sl.location_id = al.location_id
      WHERE al.lot_number = $1 AND al.status IN ('ACTIVE','STOCK','COMPLETE')
      LIMIT 1
    `, [lotNo]).catch(() => ({ rows: [] as any[] }));

    if (lot) {
      return { data: {
        ...lot,
        source: 'lots',
        location: lot.location_code || null,
        wms_status: 'NORMAL',
      }};
    }

    return reply.status(404).send({ error: `LOT '${lotNo}'를 찾을 수 없습니다.`, lot_number: lotNo });
  });

  // ─── POST /api/wms/location-move ──────────────────────────────────────────
  // 스캐너 위치이동: LOT의 위치를 새 위치로 이동하고 WMS 이력 기록
  app.post('/api/wms/location-move', async (req, reply) => {
    const b = req.body as {
      lot_number: string;
      source_table: string;      // 'material_lots' | 'non_certified_stock' | 'lots'
      source_id: number;
      from_location_id?: number;
      to_location_code: string;
      to_location_id: number;
      qty?: number;
      notes?: string;
    };

    if (!b.lot_number || !b.to_location_code || !b.to_location_id)
      return reply.status(400).send({ error: '필수 파라미터 누락 (lot_number, to_location_code, to_location_id)' });

    // 테이블 별 위치 업데이트
    if (b.source_table === 'material_lots') {
      await pool.query(
        `UPDATE material_lots SET location = $1, location_id = $2, updated_at = NOW()
         WHERE lot_id = $3`,
        [b.to_location_code, b.to_location_id, b.source_id]
      );
    } else if (b.source_table === 'non_certified_stock') {
      await pool.query(
        `UPDATE non_certified_stock SET location_id = $1, updated_at = NOW()
         WHERE stock_id = $2`,
        [b.to_location_id, b.source_id]
      );
    } else if (b.source_table === 'lots') {
      await pool.query(
        `UPDATE lots SET location_id = $1, updated_at = NOW()
         WHERE lot_id = $2`,
        [b.to_location_id, b.source_id]
      );
    }

    // WMS 이력 기록
    await pool.query(`
      INSERT INTO wms_transactions
        (lot_number, item_name, qty, category, txn_type,
         from_location_id, to_location_id, source_type, notes)
      SELECT
        $1, COALESCE(item_name, ''), COALESCE($2::numeric, 0),
        COALESCE(category, ''), 'MOVE',
        $3, $4, $5, $6
      FROM (
        SELECT item_name, category FROM material_lots WHERE lot_number = $1
        UNION ALL
        SELECT item_name, category FROM non_certified_stock WHERE lot_number = $1
        LIMIT 1
      ) t
      LIMIT 1
    `, [b.lot_number, b.qty || 0, b.from_location_id || null, b.to_location_id, b.source_table, b.notes || '위치이동']);

    return { ok: true, message: `${b.lot_number} → ${b.to_location_code} 이동 완료` };
  });

  // ─── POST /api/wms/shipment-ready-register ────────────────────────────────
  // 출하대기 등록: LOT + 발주서 연결
  app.post('/api/wms/shipment-ready-register', async (req, reply) => {
    const b = req.body as {
      lot_number: string;
      stock_id: number;
      po_id: number;
      po_date?: string;
      po_number?: string;
      site_name?: string;
      qty?: number;
      notes?: string;
    };

    if (!b.lot_number || !b.stock_id || !b.po_id)
      return reply.status(400).send({ error: '필수 파라미터 누락 (lot_number, stock_id, po_id)' });

    // non_certified_stock에 출하대기 상태 + 발주서 연결
    await pool.query(`
      UPDATE non_certified_stock
      SET wms_status      = 'SHIPMENT_READY',
          po_id           = $1,
          po_date         = $2,
          shipment_po_no  = $3,
          shipment_site_name = $4,
          updated_at      = NOW()
      WHERE stock_id = $5
    `, [b.po_id, b.po_date || null, b.po_number || null, b.site_name || null, b.stock_id]);

    // WMS 이력
    await pool.query(`
      INSERT INTO wms_transactions
        (lot_number, item_name, qty, category, txn_type, source_type, notes)
      SELECT lot_number, item_name, COALESCE($1::numeric, qty), category,
             'SHIPMENT_READY', 'non_certified_stock',
             $2
      FROM non_certified_stock WHERE stock_id = $3
    `, [b.qty || null, `출하대기 등록: PO ${b.po_number || b.po_id} / ${b.site_name}`, b.stock_id]);

    return { ok: true, message: `출하대기 등록 완료 (PO: ${b.po_number || b.po_id})` };
  });

  // ─── PUT /api/wms/change-location ──────────────────────────────────────────
  // 공통 위치 변경 API (item_table 별 location_id 업데이트)
  app.put('/api/wms/change-location', async (req, reply) => {
    const b = req.body as {
      item_table: 'material_lots' | 'non_certified_stock' | 'socket_stock';
      item_id: number;
      location_id: number;
      memo?: string;
    };

    if (!b.item_table || !b.item_id || !b.location_id) {
      return reply.status(400).send({ error: 'item_table, item_id, location_id는 필수입니다.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 목적지 위치 정보 조회
      const { rows: [loc] } = await client.query(
        `SELECT location_code FROM storage_locations WHERE location_id = $1`,
        [b.location_id]
      );
      if (!loc) throw new Error('유효하지 않은 위치입니다.');

      let lotNumber = '';
      let itemName = '';
      let fromLocationId = null;
      let qty = 0;

      // 테이블별 업데이트 처리
      if (b.item_table === 'material_lots') {
        const { rows: [ml] } = await client.query(`SELECT * FROM material_lots WHERE lot_id = $1`, [b.item_id]);
        if (!ml) throw new Error('재고 항목을 찾을 수 없습니다.');
        lotNumber = ml.lot_number; itemName = ml.item_name; fromLocationId = ml.location_id; qty = ml.qty_current;

        await client.query(
          `UPDATE material_lots SET location = $1, location_id = $2, updated_at = NOW() WHERE lot_id = $3`,
          [loc.location_code, b.location_id, b.item_id]
        );
      } else if (b.item_table === 'non_certified_stock') {
        const { rows: [ncs] } = await client.query(`SELECT * FROM non_certified_stock WHERE stock_id = $1`, [b.item_id]);
        if (!ncs) throw new Error('재고 항목을 찾을 수 없습니다.');
        lotNumber = ncs.lot_number; itemName = ncs.item_name; fromLocationId = ncs.location_id; qty = ncs.qty;

        await client.query(
          `UPDATE non_certified_stock SET location_id = $1, updated_at = NOW() WHERE stock_id = $2`,
          [b.location_id, b.item_id]
        );
      } else if (b.item_table === 'socket_stock') {
        // socket_stock 테이블도 처리 (있는 경우)
        const { rows: [sock] } = await client.query(`SELECT * FROM socket_stock WHERE id = $1`, [b.item_id]);
        if (!sock) throw new Error('재고 항목을 찾을 수 없습니다.');
        lotNumber = sock.lot_number || ''; itemName = sock.item_name || ''; fromLocationId = sock.location_id; qty = sock.qty;

        await client.query(
          `UPDATE socket_stock SET location_id = $1, updated_at = NOW() WHERE id = $2`,
          [b.location_id, b.item_id]
        );
      } else {
        throw new Error('지원하지 않는 테이블입니다.');
      }

      // WMS 이력 기록
      await client.query(`
        INSERT INTO wms_transactions
          (item_table, item_id, lot_number, item_name, txn_type, qty,
           from_location_id, to_location_id, notes)
        VALUES ($1, $2, $3, $4, 'MOVE', $5, $6, $7, $8)
      `, [b.item_table, b.item_id, lotNumber, itemName, qty, fromLocationId, b.location_id, b.memo || '스캐너 위치이동 API']);

      await client.query('COMMIT');
      return { ok: true, message: `위치 변경 완료 (${loc.location_code})` };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.status(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ─── POST /api/wms/transfer ────────────────────────────────────────────────
  // 렉 이동 전용 API (출발 렉/파레트 → 도착 렉/파레트, 전체/일부 수량 이동 & 수량 합침)
  app.post('/api/wms/transfer', async (req, reply) => {
    const {
      from_location_code,
      to_location_code,
      transfer_mode = 'FULL', // 'FULL' | 'PARTIAL'
      transfer_qty = 0,
      notes = '',
      performed_by = '',
    } = req.body as {
      from_location_code: string;
      to_location_code: string;
      transfer_mode?: 'FULL' | 'PARTIAL';
      transfer_qty?: number;
      notes?: string;
      performed_by?: string;
    };

    if (!from_location_code || !to_location_code) {
      return reply.status(400).send({ error: '출발 위치(from_location_code)와 도착 위치(to_location_code)는 필수입니다.' });
    }

    if (from_location_code === to_location_code) {
      return reply.status(400).send({ error: '출발 위치와 도착 위치가 같습니다.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. 출발 위치 재고 검색 (material_lots 또는 non_certified_stock)
      const { rows: matRows } = await client.query(
        `SELECT 'material_lots' AS tbl, lot_id AS id, lot_number, item_name, current_qty AS qty, location AS loc_code, location_id
         FROM material_lots WHERE location = $1 AND current_qty > 0
         UNION ALL
         SELECT 'non_certified_stock' AS tbl, stock_id AS id, lot_number, item_name, qty, rack_code AS loc_code, location_id
         FROM non_certified_stock WHERE (rack_code = $1 OR shipment_site_name = $1) AND qty > 0
         LIMIT 1`,
        [from_location_code]
      );

      const source = matRows[0];
      if (!source) {
        throw new Error(`출발 위치 [${from_location_code}]에 적재된 재고를 찾을 수 없습니다.`);
      }

      const availableQty = Number(source.qty || 0);
      const moveQty = transfer_mode === 'FULL' ? availableQty : Math.min(availableQty, Number(transfer_qty || 0));

      if (moveQty <= 0) {
        throw new Error('이동할 수량이 0 이하입니다.');
      }

      // 2. 도착 위치 정보 조회
      const { rows: locRows } = await client.query(
        `SELECT location_id, location_code FROM storage_locations WHERE location_code = $1`,
        [to_location_code]
      );
      const toLoc = locRows[0] || { location_id: null, location_code: to_location_code };

      // 3. 도착 위치의 기존 재고 검색 (동일 LOT 또는 다른 재고)
      const { rows: destRows } = await client.query(
        `SELECT 'material_lots' AS tbl, lot_id AS id, lot_number, item_name, current_qty AS qty
         FROM material_lots WHERE location = $1 AND current_qty > 0
         UNION ALL
         SELECT 'non_certified_stock' AS tbl, stock_id AS id, lot_number, item_name, qty
         FROM non_certified_stock WHERE (rack_code = $1 OR shipment_site_name = $1) AND qty > 0
         LIMIT 1`,
        [to_location_code]
      );
      const dest = destRows[0];

      // 4. 재고 이동 & 수량 합침 처리
      if (source.tbl === 'material_lots') {
        if (transfer_mode === 'FULL') {
          // 전체 수량 이동
          if (dest && dest.lot_number === source.lot_number && dest.tbl === 'material_lots') {
            // 동일 LOT 도착지 재고와 수량 합침!
            await client.query(`UPDATE material_lots SET current_qty = current_qty + $1 WHERE lot_id = $2`, [moveQty, dest.id]);
            await client.query(`UPDATE material_lots SET current_qty = 0 WHERE lot_id = $1`, [source.id]);
          } else {
            // 도착지가 빈 공간이거나 다른 재고: 위치 단순 이동
            await client.query(
              `UPDATE material_lots SET location = $1, location_id = $2, updated_at = NOW() WHERE lot_id = $3`,
              [to_location_code, toLoc.location_id, source.id]
            );
          }
        } else {
          // 일부 수량 이동
          await client.query(`UPDATE material_lots SET current_qty = current_qty - $1 WHERE lot_id = $2`, [moveQty, source.id]);

          if (dest && dest.lot_number === source.lot_number && dest.tbl === 'material_lots') {
            // 동일 LOT 수량 합침
            await client.query(`UPDATE material_lots SET current_qty = current_qty + $1 WHERE lot_id = $2`, [moveQty, dest.id]);
          } else {
            // 도착지에 분할 신규 LOT 생성
            const splitLotNumber = `${source.lot_number}-M`;
            await client.query(
              `INSERT INTO material_lots (lot_number, item_name, category, init_qty, current_qty, location, location_id, remark)
               VALUES ($1, $2, '반제품', $3, $3, $4, $5, $6)`,
              [splitLotNumber, source.item_name, moveQty, to_location_code, toLoc.location_id, `이동 분할 재고 (${from_location_code}에서 ${moveQty}ea 이동)`]
            );
          }
        }
      } else {
        // non_certified_stock 처리
        if (transfer_mode === 'FULL') {
          await client.query(
            `UPDATE non_certified_stock SET rack_code = $1, location_id = $2, updated_at = NOW() WHERE stock_id = $3`,
            [to_location_code, toLoc.location_id, source.id]
          );
        } else {
          await client.query(`UPDATE non_certified_stock SET qty = qty - $1 WHERE stock_id = $2`, [moveQty, source.id]);
          await client.query(
            `INSERT INTO non_certified_stock (lot_number, item_name, qty, rack_code, location_id, notes)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [source.lot_number, source.item_name, moveQty, to_location_code, toLoc.location_id, `이동 분할 재고 (${from_location_code}에서 이동)`]
          );
        }
      }

      // 5. WMS 이력 로그 기록
      await client.query(
        `INSERT INTO wms_transactions
           (lot_number, item_name, qty, category, txn_type,
            from_location_id, to_location_id, notes, performed_by)
         VALUES ($1, $2, $3, 'WMS', 'TRANSFER', $4, $5, $6, $7)`,
        [
          source.lot_number,
          source.item_name,
          moveQty,
          source.location_id || null,
          toLoc.location_id || null,
          `[렉이동] ${from_location_code} ➔ ${to_location_code} (${transfer_mode === 'FULL' ? '전체' : '일부'} ${moveQty}ea) ${notes}`,
          performed_by || '시스템작업자',
        ]
      );

      await client.query('COMMIT');
      return reply.send({
        ok: true,
        message: `✅ 렉 이동 완료: [${from_location_code}] ➔ [${to_location_code}] (${moveQty} EA 이동)`,
        data: {
          lot_number: source.lot_number,
          item_name: source.item_name,
          moved_qty: moveQty,
          from: from_location_code,
          to: to_location_code,
          merged: !!dest,
        },
      });
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.status(500).send({ error: e.message });
    } finally {
      client.release();
    }
  });
}
