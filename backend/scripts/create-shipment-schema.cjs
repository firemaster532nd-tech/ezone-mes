const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

const SQL = `
-- ══════════════════════════════════════════════════════════════
-- (주)이지원 MES — 출하 시스템 DB 스키마
-- ══════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. lot_transaction 예약수량 컬럼 추가 ─────────────────────
ALTER TABLE lot_transaction
  ADD COLUMN IF NOT EXISTS reserved_qty NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reservation_detail JSONB DEFAULT '[]'::jsonb;

-- ── 2. project_master 보강 ────────────────────────────────────
ALTER TABLE project_master
  ADD COLUMN IF NOT EXISTS site_display_name TEXT,
  ADD COLUMN IF NOT EXISTS distributor_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS main_contractor_name VARCHAR(100);

-- ── 3. shipment_ready (출하대기현황 헤더) ────────────────────
CREATE TABLE IF NOT EXISTS shipment_ready (
  sr_id           SERIAL PRIMARY KEY,
  project_id      INTEGER REFERENCES project_master(project_id),
  po_id           INTEGER REFERENCES purchase_order(po_id),
  delivery_date   DATE NOT NULL,
  distributor     VARCHAR(100),
  contractor      VARCHAR(100),
  main_contractor VARCHAR(100),
  site_name       TEXT NOT NULL,
  status          VARCHAR(20) DEFAULT 'PENDING'
                  CHECK(status IN('PENDING','PARTIAL','SHIPPED','CANCELLED')),
  is_new          BOOLEAN DEFAULT FALSE,
  notes           TEXT,
  so_id           INTEGER REFERENCES shipment_order(so_id),
  created_by      INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  shipped_at      TIMESTAMPTZ
);

-- ── 4. shipment_ready_item (품목 상세) ────────────────────────
CREATE TABLE IF NOT EXISTS shipment_ready_item (
  sri_id          SERIAL PRIMARY KEY,
  sr_id           INTEGER REFERENCES shipment_ready(sr_id) ON DELETE CASCADE,
  item_id         INTEGER REFERENCES item_master(item_id),
  item_spec       VARCHAR(200),
  item_category   VARCHAR(50),
  planned_qty     NUMERIC(10,2) NOT NULL,
  lot_id          INTEGER REFERENCES lot_transaction(lot_id),
  lot_number      VARCHAR(60),
  is_deferred     BOOLEAN DEFAULT FALSE,
  auto_match_status VARCHAR(20) DEFAULT 'NONE'
                  CHECK(auto_match_status IN('NONE','PENDING','MATCHED','MANUAL')),
  wo_id           INTEGER REFERENCES work_order(wo_id),
  purchase_po_id  INTEGER,
  shipped_qty     NUMERIC(10,2) DEFAULT 0,
  stock_status    VARCHAR(20) DEFAULT 'UNKNOWN'
                  CHECK(stock_status IN('AVAILABLE','RESERVED','DEFERRED','NONE','UNKNOWN')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. shipment_quality_cert (품질관리번호) ───────────────────
CREATE TABLE IF NOT EXISTS shipment_quality_cert (
  sqc_id          SERIAL PRIMARY KEY,
  sr_id           INTEGER REFERENCES shipment_ready(sr_id),
  so_id           INTEGER REFERENCES shipment_order(so_id),
  statement_id    INTEGER,
  structure_type  VARCHAR(50),
  cert_number     VARCHAR(100),
  cert_qty        INTEGER,
  lot_numbers     TEXT[],
  issued_by       INTEGER,
  issued_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. 자동 LOT 매핑 트리거 함수 ─────────────────────────────
CREATE OR REPLACE FUNCTION fn_auto_match_lot_to_shipment()
RETURNS TRIGGER AS $$
DECLARE
  v_remaining NUMERIC;
  v_sri       RECORD;
  v_alloc     NUMERIC;
  v_lot_type  VARCHAR;
BEGIN
  IF TG_OP != 'INSERT' THEN RETURN NEW; END IF;

  -- 원자재 입고(IN) 또는 조립완료(ASM)만 처리
  IF NEW.lot_type NOT IN ('IN','GI','CW','SS','GW','ASM') THEN
    RETURN NEW;
  END IF;

  v_remaining := COALESCE(NEW.qty, 0);
  IF v_remaining <= 0 THEN RETURN NEW; END IF;

  -- 납기 가까운 순으로 미매핑 품목 조회
  FOR v_sri IN (
    SELECT sri.sri_id, sri.planned_qty, sri.shipped_qty,
           sr.delivery_date, sr.site_name
    FROM shipment_ready_item sri
    JOIN shipment_ready sr ON sri.sr_id = sr.sr_id
    WHERE (
      sri.item_id = NEW.item_id
      OR (
        -- 조립품: lot_type=ASM이고 item_category 매칭
        NEW.lot_type = 'ASM' AND sri.item_category IN ('FL_I','FL_Z','TS','TS_GI','FL_GI','SOCKET')
      )
    )
    AND sri.is_deferred = TRUE
    AND sri.auto_match_status = 'PENDING'
    AND sr.status NOT IN ('SHIPPED','CANCELLED')
    ORDER BY sr.delivery_date ASC
  ) LOOP
    EXIT WHEN v_remaining <= 0;

    v_alloc := LEAST(
      v_remaining,
      COALESCE(v_sri.planned_qty, 0) - COALESCE(v_sri.shipped_qty, 0)
    );
    IF v_alloc <= 0 THEN CONTINUE; END IF;

    UPDATE shipment_ready_item
    SET lot_id            = NEW.lot_id,
        lot_number        = NEW.lot_number,
        is_deferred       = FALSE,
        auto_match_status = 'MATCHED',
        stock_status      = 'RESERVED'
    WHERE sri_id = v_sri.sri_id;

    UPDATE lot_transaction
    SET reserved_qty = COALESCE(reserved_qty, 0) + v_alloc
    WHERE lot_id = NEW.lot_id;

    v_remaining := v_remaining - v_alloc;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 등록
DROP TRIGGER IF EXISTS trg_auto_match_lot ON lot_transaction;
CREATE TRIGGER trg_auto_match_lot
AFTER INSERT ON lot_transaction
FOR EACH ROW EXECUTE FUNCTION fn_auto_match_lot_to_shipment();

-- ── 7. 인덱스 ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shipment_ready_project    ON shipment_ready(project_id);
CREATE INDEX IF NOT EXISTS idx_shipment_ready_delivery   ON shipment_ready(delivery_date);
CREATE INDEX IF NOT EXISTS idx_shipment_ready_status     ON shipment_ready(status);
CREATE INDEX IF NOT EXISTS idx_sri_sr_id                 ON shipment_ready_item(sr_id);
CREATE INDEX IF NOT EXISTS idx_sri_item_id               ON shipment_ready_item(item_id);
CREATE INDEX IF NOT EXISTS idx_sri_lot_id                ON shipment_ready_item(lot_id);
CREATE INDEX IF NOT EXISTS idx_sri_deferred              ON shipment_ready_item(is_deferred) WHERE is_deferred = TRUE;
CREATE INDEX IF NOT EXISTS idx_sqc_sr_id                 ON shipment_quality_cert(sr_id);

COMMIT;
`;

async function run() {
  const client = await pool.connect();
  try {
    await client.query(SQL);
    console.log('✅ 출하 시스템 DB 스키마 생성 완료');

    // 생성 확인
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public'
        AND table_name IN ('shipment_ready','shipment_ready_item','shipment_quality_cert')
      ORDER BY table_name
    `);
    console.log('생성된 테이블:', tables.rows.map(r => r.table_name).join(', '));

    const cols = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='lot_transaction' AND column_name IN ('reserved_qty','reservation_detail')
    `);
    console.log('lot_transaction 추가 컬럼:', cols.rows.map(r => r.column_name).join(', '));

    const trg = await client.query(`
      SELECT trigger_name FROM information_schema.triggers
      WHERE trigger_name = 'trg_auto_match_lot'
    `);
    console.log('트리거:', trg.rows.length > 0 ? '✅ trg_auto_match_lot 등록됨' : '❌ 트리거 없음');

  } catch (e) {
    console.error('❌ 오류:', e.message);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
