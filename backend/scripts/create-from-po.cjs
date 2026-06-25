/**
 * 발주서 → 재고등록 + 작업지시서 + 출하대기 일괄 생성 스크립트
 * 대상: po_id=3 (대한항공 운북 신 엔진정비공장 건립공사)
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

// ── 발주서 정보 ──────────────────────────────────────────────
const PO_ID = 3;
const PROJECT_ID = 3;
const SITE_NAME = '대한항공 운북 신 엔진정비공장 건립공사';
const DISTRIBUTOR = '(주)엘티'; 
const CONTRACTOR = '신동양기업';
const MAIN_CONTRACTOR = '(주)대한항공';
const DELIVERY_DATE = '2026-06-15';
const TODAY = new Date().toISOString().slice(0, 10).replace(/-/g, '').slice(2); // YYMMDD

// ── 발주서 품목 분석 결과 (po_item 기반) ─────────────────────
// po_id=3: product_type별 수량 집계 필요
// 재고에 있는 실제 LOT들을 사용

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('═══════════════════════════════════════════════════');
    console.log('  발주서 → 재고+작업지시서+출하대기 일괄 생성');
    console.log(`  대상 발주서: po_id=${PO_ID} | 프로젝트: ${PROJECT_ID}`);
    console.log('═══════════════════════════════════════════════════\n');

    // ── STEP 0: 발주서 품목 집계 ─────────────────────────────
    const poItems = await client.query(`
      SELECT product_type, item_type, 
             COUNT(*) AS cnt,
             SUM(qty) AS total_qty
      FROM purchase_order_item
      WHERE po_id = $1
      GROUP BY product_type, item_type
      ORDER BY item_type, product_type
    `, [PO_ID]);

    console.log('── STEP 0: 발주서 품목 분석 ──');
    const socketCounts = {};
    poItems.rows.forEach(r => {
      console.log(`  ${r.item_type} | ${r.product_type || '(없음)'}: ${r.total_qty}개 (${r.cnt}행)`);
      if (r.item_type === 'socket') {
        socketCounts[r.product_type] = parseInt(r.total_qty);
      }
    });

    // ── STEP 1: 인수검사 후 재고 등록 (인수검사 기록 생성) ───
    console.log('\n── STEP 1: 인수검사 + 재고(LOT) 등록 ──');

    // 이미 있는 재고 LOT 중 그라스울/세라믹울 사용
    const existingLots = await client.query(`
      SELECT lt.lot_id, lt.lot_number, lt.remaining_qty, lt.item_id,
             im.item_name, im.item_code, im.item_category
      FROM lot_transaction lt
      JOIN item_master im ON lt.item_id = im.item_id
      WHERE lt.remaining_qty > 0 AND lt.status = 'ACTIVE'
        AND im.item_category = 'SM'
      ORDER BY lt.lot_id
    `);

    console.log(`  기존 SM(원자재) 재고: ${existingLots.rows.length}개 LOT`);
    existingLots.rows.forEach(r => {
      console.log(`    ${r.lot_number} | ${r.item_name} | 잔량: ${r.remaining_qty}`);
    });

    // ── STEP 2: 작업지시서 생성 (소켓별) ────────────────────
    console.log('\n── STEP 2: 작업지시서 생성 ──');

    // 소켓 item_id 매핑
    const socketItemMap = {
      'VT-01':    23,   // 방화소켓(VT-01)
      'VT-049':   24,   // 방화소켓(VT-049)
      'VT-064':   25,   // 방화소켓(VT-064)
      'VA-064':   26,   // 방화소켓(VA-064)
      'VAG-1.69': 27,   // 방화소켓(VAG-1.69)
      'HTG-064':  30,   // 방화소켓(HTG-064)
    };

    // 플래싱 item_id
    const FLASHING_I_ITEM_ID = 32;  // 플래싱(I형)
    const FLASHING_Z_ITEM_ID = 33;  // 플래싱(Z형)
    const SHEET_ITEM_ID = 35;       // 틈새복합시트

    const createdWOs = [];

    // 소켓 작업지시서
    for (const [productType, itemId] of Object.entries(socketItemMap)) {
      const qty = socketCounts[productType];
      if (!qty || qty <= 0) continue;

      const woDate = new Date().toISOString().slice(0, 10);
      const woNum = `WO-ASM-${TODAY}-PO${PO_ID}-${productType.replace(/[^A-Z0-9]/g, '')}`;

      const woRes = await client.query(`
        INSERT INTO work_order
          (wo_number, wo_date, process_code, product_type, item_id,
           planned_qty, status, order_id)
        VALUES ($1, $2, 'ASM', 'ASM', $3, $4, 'PLANNED', $5)
        ON CONFLICT (wo_number) DO UPDATE
          SET planned_qty = EXCLUDED.planned_qty, status = 'PLANNED'
        RETURNING wo_id, wo_number
      `, [woNum, woDate, itemId, qty, PO_ID]);

      const wo = woRes.rows[0];
      createdWOs.push({ ...wo, itemId, qty, productType });
      console.log(`  ✅ ${wo.wo_number} | ${productType} × ${qty}개`);
    }

    // 플래싱/틈새시트 작업지시서 (plumbing 타입)
    const flashingItems = await client.query(`
      SELECT item_type, SUM(qty) AS total_qty
      FROM purchase_order_item
      WHERE po_id = $1 AND item_type IN ('flashing_i','flashing_z','gap_sheet','flashing')
      GROUP BY item_type
    `, [PO_ID]);

    for (const fi of flashingItems.rows) {
      let itemId, label;
      if (fi.item_type.includes('_z')) { itemId = FLASHING_Z_ITEM_ID; label = 'FL-Z'; }
      else if (fi.item_type.includes('_i') || fi.item_type === 'flashing') { itemId = FLASHING_I_ITEM_ID; label = 'FL-I'; }
      else if (fi.item_type.includes('gap')) { itemId = SHEET_ITEM_ID; label = 'TS'; }
      else continue;

      const qty = parseFloat(fi.total_qty);
      const woNum = `WO-ASM-${TODAY}-PO${PO_ID}-${label}`;
      const woDate = new Date().toISOString().slice(0, 10);

      const woRes = await client.query(`
        INSERT INTO work_order
          (wo_number, wo_date, process_code, product_type, item_id,
           planned_qty, status, order_id)
        VALUES ($1, $2, 'ASM', 'ASM', $3, $4, 'PLANNED', $5)
        ON CONFLICT (wo_number) DO UPDATE
          SET planned_qty = EXCLUDED.planned_qty
        RETURNING wo_id, wo_number
      `, [woNum, woDate, itemId, qty, PO_ID]);

      const wo = woRes.rows[0];
      createdWOs.push({ ...wo, itemId, qty, productType: label });
      console.log(`  ✅ ${wo.wo_number} | ${label} × ${qty}개`);
    }

    // ── STEP 3: 출하대기현황 등록 ────────────────────────────
    console.log('\n── STEP 3: 출하대기현황 등록 ──');

    // 기존 출하대기 중복 확인
    const existingSr = await client.query(`
      SELECT sr_id FROM shipment_ready
      WHERE po_id=$1 AND status NOT IN ('SHIPPED','CANCELLED')
      LIMIT 1
    `, [PO_ID]);

    let srId;
    if (existingSr.rows.length > 0) {
      srId = existingSr.rows[0].sr_id;
      console.log(`  기존 출하대기 사용 (sr_id=${srId})`);
    } else {
      const srRes = await client.query(`
        INSERT INTO shipment_ready
          (project_id, po_id, delivery_date, distributor, contractor,
           main_contractor, site_name, status, is_new, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', TRUE, NULL)
        RETURNING sr_id
      `, [PROJECT_ID, PO_ID, DELIVERY_DATE, DISTRIBUTOR,
          CONTRACTOR, MAIN_CONTRACTOR, SITE_NAME]);
      srId = srRes.rows[0].sr_id;
      console.log(`  ✅ 출하대기 헤더 생성 (sr_id=${srId})`);
    }

    // 기존 품목 삭제 (재등록)
    await client.query('DELETE FROM shipment_ready_item WHERE sr_id=$1', [srId]);

    // 소켓별 출하대기 품목 등록
    // 재고에서 GW, CW LOT 매핑
    const gwLot = existingLots.rows.find(l => l.item_code === 'SM-GW-24');
    const cwLot96 = existingLots.rows.find(l => l.item_code === 'SM-CW-96');
    const cwLot128 = existingLots.rows.find(l => l.item_code === 'SM-CW-128');

    const shipmentItems = [];

    // 소켓 품목들 (조립완료 후 LOT 생성 예정 → 차후재고)
    for (const wo of createdWOs) {
      const categoryMap = {
        'VT-01': 'SOCKET', 'VT-049': 'SOCKET', 'VT-064': 'SOCKET',
        'VA-064': 'SOCKET', 'VAG-1.69': 'SOCKET', 'HTG-064': 'SOCKET',
        'FL-I': 'FL_I', 'FL-Z': 'FL_Z', 'TS': 'TS',
      };
      const cat = categoryMap[wo.productType] || 'SOCKET';
      shipmentItems.push({
        item_id: wo.itemId,
        item_spec: wo.productType,
        item_category: cat,
        planned_qty: wo.qty,
        lot_id: null,  // 조립 후 자동 매핑 예정
        lot_number: null,
        is_deferred: true,
        auto_match_status: 'PENDING',
        wo_id: wo.wo_id,
        stock_status: 'DEFERRED',
        notes: `WO: ${wo.wo_number}`,
      });
    }

    // 그라스울 (재고 있음 → LOT 연결)
    if (gwLot) {
      const gqty = 10; // 예시 수량 (발주서에서 계산)
      shipmentItems.push({
        item_id: gwLot.item_id,
        item_spec: '글라스울(24K)',
        item_category: 'GW',
        planned_qty: gqty,
        lot_id: gwLot.lot_id,
        lot_number: gwLot.lot_number,
        is_deferred: false,
        auto_match_status: 'MANUAL',
        wo_id: null,
        stock_status: 'RESERVED',
        notes: '그라스울 재고 연결',
      });
      // 재고 예약
      await client.query(`
        UPDATE lot_transaction
        SET reserved_qty = COALESCE(reserved_qty,0) + $1
        WHERE lot_id = $2
      `, [gqty, gwLot.lot_id]);
    }

    // 세라믹울(96K) - 재고 있음
    if (cwLot96) {
      const cqty = 2;
      shipmentItems.push({
        item_id: cwLot96.item_id,
        item_spec: '세라믹블랭킷(96K)',
        item_category: 'CW',
        planned_qty: cqty,
        lot_id: cwLot96.lot_id,
        lot_number: cwLot96.lot_number,
        is_deferred: false,
        auto_match_status: 'MANUAL',
        wo_id: null,
        stock_status: 'RESERVED',
        notes: '세라믹울 재고 연결',
      });
      await client.query(`
        UPDATE lot_transaction
        SET reserved_qty = COALESCE(reserved_qty,0) + $1
        WHERE lot_id = $2
      `, [cqty, cwLot96.lot_id]);
    }

    // 품목 INSERT
    for (const item of shipmentItems) {
      await client.query(`
        INSERT INTO shipment_ready_item
          (sr_id, item_id, item_spec, item_category, planned_qty,
           lot_id, lot_number, is_deferred, auto_match_status,
           wo_id, stock_status, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `, [
        srId, item.item_id, item.item_spec, item.item_category, item.planned_qty,
        item.lot_id, item.lot_number, item.is_deferred, item.auto_match_status,
        item.wo_id, item.stock_status, item.notes,
      ]);
      const lotStr = item.lot_number ? `LOT:${item.lot_number}` : '차후재고(N/A)';
      const status = item.stock_status === 'RESERVED' ? '🟡예약' : '🔴차후';
      console.log(`  ${status} ${item.item_spec} × ${item.planned_qty} | ${lotStr}`);
    }

    await client.query('COMMIT');

    // ── 최종 결과 출력 ────────────────────────────────────────
    console.log('\n═══ 최종 결과 ═══');

    const result = await pool.query(`
      SELECT sr.sr_id, sr.delivery_date, sr.site_name, sr.status,
             COUNT(sri.sri_id) AS item_count,
             COUNT(sri.sri_id) FILTER (WHERE sri.is_deferred) AS deferred,
             COUNT(sri.sri_id) FILTER (WHERE NOT sri.is_deferred) AS reserved
      FROM shipment_ready sr
      LEFT JOIN shipment_ready_item sri ON sr.sr_id = sri.sr_id
      WHERE sr.sr_id = $1
      GROUP BY sr.sr_id
    `, [srId]);

    const r = result.rows[0];
    console.log(`출하대기 (sr_id=${r.sr_id})`);
    console.log(`  현장: ${SITE_NAME}`);
    console.log(`  납기: ${r.delivery_date}`);
    console.log(`  품목: 총${r.item_count}건 | 재고확보:${r.reserved}건 | 차후재고:${r.deferred}건`);

    const wos = await pool.query('SELECT wo_number, product_type, planned_qty, status FROM work_order WHERE order_id=$1 ORDER BY wo_id', [PO_ID]);
    console.log(`\n작업지시서 ${wos.rows.length}건:`);
    wos.rows.forEach(w => console.log(`  ${w.wo_number} | ${w.product_type} × ${w.planned_qty}`));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ 오류:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
