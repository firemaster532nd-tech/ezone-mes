import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

/**
 * 출하 준비(대기) 시스템 API
 * EZC-C-302 LOT 추적성과 연계된 출하 흐름 관리
 *
 * 흐름:
 *   발주서/프로젝트 → 출하대기 등록 → LOT 예약 → 출하지시서 → 거래명세서+품질관리번호 → 출하완료
 */
export async function shipmentReadyRoutes(app: FastifyInstance) {

  // ══════════════════════════════════════════════════════════
  // 출하대기현황 목록 (매트릭스 형태)
  // ══════════════════════════════════════════════════════════
  app.get('/api/shipment-ready', async (request) => {
    const { status, from, to, project_id } = request.query as {
      status?: string; from?: string; to?: string; project_id?: string;
    };

    const conditions: string[] = [];
    const params: any[] = [];
    let pi = 1;

    if (status) { conditions.push(`sr.status = $${pi++}`); params.push(status); }
    if (from)   { conditions.push(`sr.delivery_date >= $${pi++}`); params.push(from); }
    if (to)     { conditions.push(`sr.delivery_date <= $${pi++}`); params.push(to); }
    if (project_id) { conditions.push(`sr.project_id = $${pi++}`); params.push(parseInt(project_id)); }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // 헤더 조회
    const headers = await pool.query(`
      SELECT
        sr.*,
        pm.project_code, pm.project_name,
        po.file_name AS po_file_name,
        COUNT(sri.sri_id)                                      AS total_items,
        COUNT(sri.sri_id) FILTER (WHERE sri.is_deferred=TRUE)  AS deferred_items,
        COUNT(sri.sri_id) FILTER (WHERE sri.lot_id IS NOT NULL) AS matched_items
      FROM shipment_ready sr
      LEFT JOIN project_master pm ON sr.project_id = pm.project_id
      LEFT JOIN purchase_order po ON sr.po_id = po.po_id
      LEFT JOIN shipment_ready_item sri ON sr.sr_id = sri.sr_id
      ${where}
      GROUP BY sr.sr_id, pm.project_code, pm.project_name, po.file_name
      ORDER BY sr.delivery_date ASC, sr.sr_id ASC
    `, params);

    // 각 헤더의 품목 상세 조회
    const srIds = headers.rows.map((r: any) => r.sr_id);
    let items: any[] = [];
    if (srIds.length > 0) {
      const itemRes = await pool.query(`
        SELECT
          sri.*,
          im.item_name, im.item_code, im.unit,
          lt.remaining_qty AS lot_remaining,
          lt.reserved_qty  AS lot_reserved
        FROM shipment_ready_item sri
        LEFT JOIN item_master im ON sri.item_id = im.item_id
        LEFT JOIN lot_transaction lt ON sri.lot_id = lt.lot_id
        WHERE sri.sr_id = ANY($1)
        ORDER BY sri.sr_id, sri.item_category, sri.sri_id
      `, [srIds]);
      items = itemRes.rows;
    }

    // 합계 계산 (품목 카테고리별)
    const summaryRes = await pool.query(`
      SELECT
        sri.item_id, sri.item_category, sri.item_spec,
        im.item_name,
        SUM(sri.planned_qty)  AS total_planned,
        SUM(sri.shipped_qty)  AS total_shipped,
        SUM(CASE WHEN sri.is_deferred THEN sri.planned_qty ELSE 0 END) AS deferred_qty,
        COUNT(DISTINCT sri.sr_id) AS site_count
      FROM shipment_ready_item sri
      JOIN shipment_ready sr ON sri.sr_id = sr.sr_id
      LEFT JOIN item_master im ON sri.item_id = im.item_id
      ${where}
      GROUP BY sri.item_id, sri.item_category, sri.item_spec, im.item_name
      ORDER BY sri.item_category, sri.item_spec
    `, params);

    return {
      rows: headers.rows.map((h: any) => ({
        ...h,
        items: items.filter((i: any) => i.sr_id === h.sr_id),
      })),
      summary: summaryRes.rows,
      generated_at: new Date().toISOString(),
    };
  });

  // ══════════════════════════════════════════════════════════
  // 출하대기 단건 조회
  // ══════════════════════════════════════════════════════════
  app.get('/api/shipment-ready/:sr_id', async (request) => {
    const { sr_id } = request.params as { sr_id: string };

    const [header, items, certs] = await Promise.all([
      pool.query(`
        SELECT sr.*, pm.project_code, pm.project_name,
               po.file_name AS po_file_name, po.order_date AS po_order_date
        FROM shipment_ready sr
        LEFT JOIN project_master pm ON sr.project_id = pm.project_id
        LEFT JOIN purchase_order po ON sr.po_id = po.po_id
        WHERE sr.sr_id = $1
      `, [sr_id]),
      pool.query(`
        SELECT sri.*, im.item_name, im.item_code, im.unit,
               lt.remaining_qty, lt.reserved_qty, lt.qty AS lot_total_qty,
               lt.spec_thickness_mm, lt.spec_width_mm, lt.spec_length_mm
        FROM shipment_ready_item sri
        LEFT JOIN item_master im ON sri.item_id = im.item_id
        LEFT JOIN lot_transaction lt ON sri.lot_id = lt.lot_id
        WHERE sri.sr_id = $1
        ORDER BY sri.item_category, sri.sri_id
      `, [sr_id]),
      pool.query(`
        SELECT * FROM shipment_quality_cert WHERE sr_id = $1 ORDER BY issued_at
      `, [sr_id]),
    ]);

    if (header.rows.length === 0) {
      return { error: '출하대기 항목을 찾을 수 없습니다.' };
    }

    return {
      ...header.rows[0],
      items: items.rows,
      quality_certs: certs.rows,
    };
  });

  // ══════════════════════════════════════════════════════════
  // 출하대기 등록 (발주서/프로젝트에서 불러오기 + LOT 선택)
  // ══════════════════════════════════════════════════════════
  app.post('/api/shipment-ready', async (request) => {
    const body = request.body as {
      project_id?: number;
      po_id?: number;
      delivery_date: string;    // YYYY-MM-DD
      distributor?: string;
      contractor?: string;
      main_contractor?: string;
      site_name: string;
      is_new?: boolean;
      notes?: string;
      items: Array<{
        item_id: number;
        item_spec?: string;
        item_category: string;
        planned_qty: number;
        lot_id?: number;          // 재고에서 선택한 LOT (없으면 차후재고)
        lot_number?: string;
        wo_id?: number;           // 생산계획 연결
        notes?: string;
      }>;
      created_by?: number;
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 헤더 삽입
      const srRes = await client.query(`
        INSERT INTO shipment_ready
          (project_id, po_id, delivery_date, distributor, contractor,
           main_contractor, site_name, is_new, notes, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING sr_id
      `, [
        body.project_id || null, body.po_id || null,
        body.delivery_date, body.distributor || null,
        body.contractor || null, body.main_contractor || null,
        body.site_name, body.is_new || false,
        body.notes || null, body.created_by || null,
      ]);
      const sr_id = srRes.rows[0].sr_id;

      // 품목 삽입
      for (const item of body.items) {
        const isDeferred = !item.lot_id;
        const stockStatus = item.lot_id ? 'RESERVED' : 'DEFERRED';
        const autoStatus = item.lot_id ? 'MANUAL' : (item.wo_id ? 'PENDING' : 'NONE');

        await client.query(`
          INSERT INTO shipment_ready_item
            (sr_id, item_id, item_spec, item_category, planned_qty,
             lot_id, lot_number, is_deferred, auto_match_status,
             wo_id, stock_status, notes)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        `, [
          sr_id, item.item_id, item.item_spec || null,
          item.item_category, item.planned_qty,
          item.lot_id || null, item.lot_number || null,
          isDeferred, autoStatus,
          item.wo_id || null, stockStatus, item.notes || null,
        ]);

        // LOT 예약 처리
        if (item.lot_id) {
          await client.query(`
            UPDATE lot_transaction
            SET reserved_qty = COALESCE(reserved_qty, 0) + $1,
                reservation_detail = COALESCE(reservation_detail, '[]'::jsonb)
                  || $2::jsonb
            WHERE lot_id = $3
          `, [
            item.planned_qty,
            JSON.stringify([{ sr_id, qty: item.planned_qty, site: body.site_name }]),
            item.lot_id,
          ]);
        }
      }

      await client.query('COMMIT');

      return { success: true, sr_id, message: '출하대기가 등록되었습니다.' };
    } catch (err: any) {
      await client.query('ROLLBACK');
      return { error: err.message };
    } finally {
      client.release();
    }
  });

  // ══════════════════════════════════════════════════════════
  // 출하대기 수정
  // ══════════════════════════════════════════════════════════
  app.put('/api/shipment-ready/:sr_id', async (request) => {
    const { sr_id } = request.params as { sr_id: string };
    const body = request.body as {
      delivery_date?: string;
      distributor?: string;
      contractor?: string;
      main_contractor?: string;
      site_name?: string;
      is_new?: boolean;
      notes?: string;
      status?: string;
    };

    const sets: string[] = [];
    const params: any[] = [];
    let pi = 1;

    if (body.delivery_date)   { sets.push(`delivery_date=$${pi++}`);   params.push(body.delivery_date); }
    if (body.distributor)     { sets.push(`distributor=$${pi++}`);     params.push(body.distributor); }
    if (body.contractor)      { sets.push(`contractor=$${pi++}`);      params.push(body.contractor); }
    if (body.main_contractor) { sets.push(`main_contractor=$${pi++}`); params.push(body.main_contractor); }
    if (body.site_name)       { sets.push(`site_name=$${pi++}`);       params.push(body.site_name); }
    if (body.is_new !== undefined) { sets.push(`is_new=$${pi++}`);     params.push(body.is_new); }
    if (body.notes !== undefined)  { sets.push(`notes=$${pi++}`);      params.push(body.notes); }
    if (body.status)          { sets.push(`status=$${pi++}`);          params.push(body.status); }

    if (sets.length === 0) return { error: '수정할 내용이 없습니다.' };

    params.push(parseInt(sr_id));
    await pool.query(
      `UPDATE shipment_ready SET ${sets.join(',')} WHERE sr_id = $${pi}`,
      params
    );
    return { success: true };
  });

  // ══════════════════════════════════════════════════════════
  // 품목의 LOT 수동 매핑 (재고에서 선택)
  // ══════════════════════════════════════════════════════════
  app.post('/api/shipment-ready-item/:sri_id/assign-lot', async (request) => {
    const { sri_id } = request.params as { sri_id: string };
    const { lot_id, lot_number, qty } = request.body as {
      lot_id: number; lot_number: string; qty: number;
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 기존 LOT 예약 해제
      const existing = await client.query(
        'SELECT lot_id, planned_qty, sr_id FROM shipment_ready_item WHERE sri_id=$1',
        [sri_id]
      );
      if (existing.rows.length === 0) return { error: '품목을 찾을 수 없습니다.' };
      const old = existing.rows[0];

      if (old.lot_id) {
        await client.query(`
          UPDATE lot_transaction
          SET reserved_qty = GREATEST(0, COALESCE(reserved_qty,0) - $1)
          WHERE lot_id = $2
        `, [old.planned_qty, old.lot_id]);
      }

      // 새 LOT 매핑
      await client.query(`
        UPDATE shipment_ready_item
        SET lot_id=$1, lot_number=$2, is_deferred=FALSE,
            auto_match_status='MANUAL', stock_status='RESERVED'
        WHERE sri_id=$3
      `, [lot_id, lot_number, sri_id]);

      await client.query(`
        UPDATE lot_transaction
        SET reserved_qty = COALESCE(reserved_qty,0) + $1
        WHERE lot_id = $2
      `, [qty || old.planned_qty, lot_id]);

      await client.query('COMMIT');
      return { success: true };
    } catch (err: any) {
      await client.query('ROLLBACK');
      return { error: err.message };
    } finally {
      client.release();
    }
  });

  // ══════════════════════════════════════════════════════════
  // 출하 처리 (출하지시서 → 거래명세서 → 재고차감)
  // ══════════════════════════════════════════════════════════
  app.post('/api/shipment-ready/:sr_id/ship', async (request) => {
    const { sr_id } = request.params as { sr_id: string };
    const body = request.body as {
      so_id?: number;   // 출하지시서 ID
      ship_items: Array<{
        sri_id: number;
        shipped_qty: number;
      }>;
      quality_certs?: Array<{
        structure_type: string;
        cert_number: string;   // EZ1-YY-MMDD-NNN
        cert_qty: number;
        lot_numbers: string[];
      }>;
      shipped_by?: number;
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const si of body.ship_items) {
        // 품목 정보 조회
        const sriRes = await client.query(
          'SELECT * FROM shipment_ready_item WHERE sri_id=$1',
          [si.sri_id]
        );
        if (sriRes.rows.length === 0) continue;
        const sri = sriRes.rows[0];

        // 출하수량 업데이트
        await client.query(`
          UPDATE shipment_ready_item
          SET shipped_qty = COALESCE(shipped_qty,0) + $1,
              stock_status = CASE
                WHEN COALESCE(shipped_qty,0) + $1 >= planned_qty THEN 'AVAILABLE'
                ELSE 'RESERVED'
              END
          WHERE sri_id = $2
        `, [si.shipped_qty, si.sri_id]);

        // 재고 차감
        if (sri.lot_id) {
          await client.query(`
            UPDATE lot_transaction
            SET remaining_qty = GREATEST(0, COALESCE(remaining_qty,0) - $1),
                reserved_qty  = GREATEST(0, COALESCE(reserved_qty,0)  - $1),
                staging_status = CASE
                  WHEN COALESCE(remaining_qty,0) - $1 <= 0 THEN 'SHIPPED'
                  ELSE staging_status
                END
            WHERE lot_id = $2
          `, [si.shipped_qty, sri.lot_id]);
        }
      }

      // 품질관리번호 저장 (거래명세서 생성 시점)
      if (body.quality_certs && body.quality_certs.length > 0) {
        for (const cert of body.quality_certs) {
          await client.query(`
            INSERT INTO shipment_quality_cert
              (sr_id, so_id, structure_type, cert_number, cert_qty, lot_numbers, issued_by)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
          `, [
            parseInt(sr_id), body.so_id || null,
            cert.structure_type, cert.cert_number,
            cert.cert_qty, cert.lot_numbers,
            body.shipped_by || null,
          ]);
        }
      }

      // 출하대기 상태 업데이트
      const remaining = await client.query(`
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE shipped_qty >= planned_qty) AS done
        FROM shipment_ready_item WHERE sr_id = $1
      `, [sr_id]);
      const { total, done } = remaining.rows[0];
      const newStatus = parseInt(done) >= parseInt(total) ? 'SHIPPED' : 'PARTIAL';

      await client.query(`
        UPDATE shipment_ready
        SET status=$1, so_id=$2,
            shipped_at = CASE WHEN $1='SHIPPED' THEN NOW() ELSE shipped_at END
        WHERE sr_id=$3
      `, [newStatus, body.so_id || null, parseInt(sr_id)]);

      await client.query('COMMIT');
      return { success: true, status: newStatus };
    } catch (err: any) {
      await client.query('ROLLBACK');
      return { error: err.message };
    } finally {
      client.release();
    }
  });

  // ══════════════════════════════════════════════════════════
  // 재고 조회 (출하대기 등록 시 LOT 선택용, 예약재고 포함)
  // ══════════════════════════════════════════════════════════
  app.get('/api/inventory/with-reservations', async (request) => {
    const { item_id, item_category } = request.query as {
      item_id?: string; item_category?: string;
    };

    const conditions: string[] = ["lt.status = 'ACTIVE'", "lt.remaining_qty > 0"];
    const params: any[] = [];
    let pi = 1;

    if (item_id) {
      conditions.push(`lt.item_id = $${pi++}`);
      params.push(parseInt(item_id));
    }
    if (item_category) {
      conditions.push(`im.item_category = $${pi++}`);
      params.push(item_category);
    }

    const result = await pool.query(`
      SELECT
        lt.lot_id, lt.lot_number, lt.lot_type,
        lt.item_id, im.item_name, im.item_code, im.item_category, im.unit,
        lt.qty              AS total_qty,
        lt.remaining_qty    AS available_qty,
        COALESCE(lt.reserved_qty, 0) AS reserved_qty,
        lt.remaining_qty - COALESCE(lt.reserved_qty, 0) AS net_available,
        lt.spec_thickness_mm, lt.spec_width_mm, lt.spec_length_mm,
        lt.staging_status,
        CASE
          WHEN lt.reserved_qty > 0 THEN 'RESERVED'
          ELSE 'AVAILABLE'
        END AS stock_color_status
      FROM lot_transaction lt
      LEFT JOIN item_master im ON lt.item_id = im.item_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY im.item_category, lt.lot_number
    `, params);

    return {
      lots: result.rows,
      total_items: result.rows.length,
    };
  });

  // ══════════════════════════════════════════════════════════
  // 프로젝트별 출하 이력
  // ══════════════════════════════════════════════════════════
  app.get('/api/projects/:project_id/shipment-history', async (request) => {
    const { project_id } = request.params as { project_id: string };

    const [ready, shipped, certs] = await Promise.all([
      pool.query(`
        SELECT sr.*, COUNT(sri.sri_id) AS item_count,
               SUM(sri.planned_qty) AS total_planned_qty
        FROM shipment_ready sr
        LEFT JOIN shipment_ready_item sri ON sr.sr_id = sri.sr_id
        WHERE sr.project_id = $1
        GROUP BY sr.sr_id
        ORDER BY sr.delivery_date ASC
      `, [project_id]),
      pool.query(`
        SELECT sri.*, im.item_name, im.item_code, sr.delivery_date,
               sr.site_name, sr.shipped_at
        FROM shipment_ready_item sri
        JOIN shipment_ready sr ON sri.sr_id = sr.sr_id
        LEFT JOIN item_master im ON sri.item_id = im.item_id
        WHERE sr.project_id = $1 AND sri.shipped_qty > 0
        ORDER BY sr.shipped_at DESC, sri.item_category
      `, [project_id]),
      pool.query(`
        SELECT sqc.*, sr.delivery_date, sr.site_name
        FROM shipment_quality_cert sqc
        JOIN shipment_ready sr ON sqc.sr_id = sr.sr_id
        WHERE sr.project_id = $1
        ORDER BY sqc.issued_at DESC
      `, [project_id]),
    ]);

    return {
      project_id: parseInt(project_id),
      shipment_plans: ready.rows,
      shipment_history: shipped.rows,
      quality_certs: certs.rows,
    };
  });

  // ════════════════════════════════════════════════════════
  // 발주서 → 구조체별 개별 항목 (출하대기 등록용)
  // qty>1인 항목은 qty만큼 개별 행으로 분리 (각각 별도 LOT 대상)
  // item_spec = "VT-049 (관W×H / 개구W×H)" 형식
  // ══════════════════════════════════════════════════════════
  app.get('/api/shipment-ready/po/:po_id/items', async (request) => {
    const { po_id } = request.params as { po_id: string };

    // 발주서 헤더
    const poRes = await pool.query(`
      SELECT po_id, project_name, delivery_date, construction_site,
             contractor, supervisor, status
      FROM purchase_order WHERE po_id = $1
    `, [po_id]);
    if (poRes.rows.length === 0) return { error: '발주서를 찾을 수 없습니다.' };
    const po = poRes.rows[0];

    // product_type → item_master 매핑 테이블
    const productTypeToCode: Record<string, string> = {
      'VT-01':      'FP-VT01',
      'VT-049':     'FP-VT049',
      'VT-064':     'FP-VT064',
      'VA-064':     'FP-VA064',
      'VAG-1.69':   'FP-VAG169',
      'HTG-064':    'FP-HTG064',
      'HTG-1.69':   'FP-HTG169',
      'HTG(DC)-064':'FP-HTGDC064',
    };

    // item_master 캐시 (동일 code 중복 쿼리 방지)
    const itemCache: Record<string, { item_id: number | null; item_name: string }> = {};
    const getItem = async (code: string | null) => {
      if (!code) return { item_id: null, item_name: code ?? '' };
      if (itemCache[code]) return itemCache[code];
      const r = await pool.query(
        `SELECT item_id, item_name FROM item_master WHERE item_code = $1 LIMIT 1`,
        [code]
      );
      const result = r.rows.length > 0
        ? { item_id: r.rows[0].item_id as number, item_name: r.rows[0].item_name as string }
        : { item_id: null, item_name: code };
      itemCache[code] = result;
      return result;
    };

    // ── 소켓류: generate_series로 qty만큼 개별 행 분리 ──
    const socketRows = await pool.query(`
      SELECT
        poi.po_item_id,
        poi.po_item_id  AS po_item_seq,
        poi.sheet_name,
        poi.seq_no,
        poi.product_type,
        poi.item_type,
        poi.qty,
        poi.pipe_width_mm,
        poi.pipe_height_mm,
        poi.opening_width_mm,
        poi.opening_height_mm,
        poi.structure,
        poi.material,
        poi.lot_number   AS assigned_lot_number,
        ROW_NUMBER() OVER (
          PARTITION BY poi.product_type
          ORDER BY COALESCE(poi.sheet_name,'') ASC,
                   COALESCE(poi.pipe_width_mm,0) ASC,
                   COALESCE(poi.pipe_height_mm,0) ASC,
                   poi.po_item_id ASC
        ) AS po_item_seq_calc
      FROM purchase_order_item poi
      WHERE poi.po_id = $1
        AND poi.item_type = 'socket'
        AND poi.product_type IS NOT NULL
      ORDER BY
        -- ① 차수(sheet_name) 오름차순 (최우선)
        COALESCE(poi.sheet_name, '') ASC,
        -- ② 구조체 종류 그룹
        CASE poi.product_type
          WHEN 'VT-049'    THEN 1  WHEN 'VT-064'    THEN 2
          WHEN 'VT-01'     THEN 3  WHEN 'VA-064'    THEN 4
          WHEN 'VAG-1.69'  THEN 5  WHEN 'HTG-064'   THEN 6
          WHEN 'HTG-064DC' THEN 7  WHEN 'HTG-1.69'  THEN 8
          ELSE 9
        END,
        -- ③ 관통재 가로 오름차순
        COALESCE(poi.pipe_width_mm, 0) ASC,
        -- ④ 관통재 세로 오름차순
        COALESCE(poi.pipe_height_mm, 0) ASC,
        poi.po_item_id ASC
    `, [po_id]);

    const items: any[] = [];

    for (const row of socketRows.rows) {
      const code = productTypeToCode[row.product_type] ?? null;
      const { item_id, item_name } = await getItem(code);

      // 치수 spec: "VT-049 (300×300)" — 관통재 기준
      let dimSpec = row.product_type;
      if (row.pipe_width_mm && row.pipe_height_mm) {
        dimSpec += ` (${row.pipe_width_mm}×${row.pipe_height_mm})`;
      }

      items.push({
        po_item_id:        row.po_item_id,
        po_item_seq:       row.po_item_seq_calc,
        sheet_name:        row.sheet_name,
        seq_no:            row.seq_no,
        item_type:         row.item_type,
        product_type:      row.product_type,
        item_id,
        item_name,
        item_code:         code,
        item_category:     'SOCKET',
        item_spec:         dimSpec,
        pipe_width_mm:     row.pipe_width_mm,
        pipe_height_mm:    row.pipe_height_mm,
        opening_width_mm:  row.opening_width_mm,
        opening_height_mm: row.opening_height_mm,
        structure:         row.structure,
        total_qty:         1,
        lot_id:            null,
        lot_number:        row.assigned_lot_number || null,   // 발주 시 자동 부여된 LOT
        is_deferred:       !row.assigned_lot_number,
      });
    }


    // ── 기타 품목 (플래싱, 틈새시트 등) — qty 합계 ──
    const otherTypeMap: Record<string, { code: string; category: string; spec: string }> = {
      'flashing_i': { code: 'FP-FL-I',   category: 'FL_I', spec: 'FL-I' },
      'flashing_z': { code: 'FP-FL-Z',   category: 'FL_Z', spec: 'FL-Z' },
      'flashing':   { code: 'FP-FL-I',   category: 'FL_I', spec: 'FL-I' },
      'gap_sheet':  { code: 'FP-GAP-SH', category: 'TS',   spec: '틈새복합시트' },
    };
    const otherAgg = await pool.query(`
      SELECT item_type, SUM(qty) AS total_qty
      FROM purchase_order_item
      WHERE po_id = $1 AND item_type != 'socket'
      GROUP BY item_type
    `, [po_id]);

    for (const row of otherAgg.rows) {
      const mapped = otherTypeMap[row.item_type];
      if (!mapped) continue;
      const { item_id, item_name } = await getItem(mapped.code);
      items.push({
        po_item_id:        null,
        po_item_seq:       null,
        sheet_name:        null,
        seq_no:            null,
        item_type:         row.item_type,
        product_type:      null,
        item_id,
        item_name,
        item_code:         mapped.code,
        item_category:     mapped.category,
        item_spec:         mapped.spec,
        pipe_width_mm:     null,
        pipe_height_mm:    null,
        opening_width_mm:  null,
        opening_height_mm: null,
        structure:         null,
        total_qty:         parseInt(row.total_qty),
        lot_id:            null,
        lot_number:        null,
        is_deferred:       true,
      });
    }

    return { po, items, total_items: items.length };
  });

  // ══════════════════════════════════════════════════════════
  // 인수검사 LOT 목록 (출하대기 LOT 매핑용)
  // lot_type IN('IN','ASM','CUT') + item_category 필터
  // ══════════════════════════════════════════════════════════
  app.get('/api/lots/inspected', async (request) => {
    const { item_id, item_category, q, include_empty } = request.query as {
      item_id?: string;
      item_category?: string;
      q?: string;
      include_empty?: string;
    };

    const conditions: string[] = ["lt.status = 'ACTIVE'"];
    const params: any[] = [];
    let pi = 1;

    // 재고 있는 것만 (include_empty=true면 소진된 것도 포함)
    if (include_empty !== 'true') {
      conditions.push(`lt.remaining_qty > 0`);
    }

    if (item_id) {
      conditions.push(`lt.item_id = $${pi++}`);
      params.push(parseInt(item_id));
    }
    if (item_category) {
      conditions.push(`im.item_category = $${pi++}`);
      params.push(item_category);
    }
    if (q) {
      conditions.push(`(lt.lot_number ILIKE $${pi} OR im.item_name ILIKE $${pi} OR im.item_code ILIKE $${pi})`);
      params.push(`%${q}%`);
      pi++;
    }

    const result = await pool.query(`
      SELECT
        lt.lot_id,
        lt.lot_number,
        lt.lot_type,
        lt.item_id,
        im.item_name,
        im.item_code,
        im.item_category,
        im.unit,
        lt.qty              AS total_qty,
        lt.remaining_qty,
        COALESCE(lt.reserved_qty, 0)                            AS reserved_qty,
        lt.remaining_qty - COALESCE(lt.reserved_qty, 0)        AS net_available,
        lt.created_at,
        -- 입고일 추출 (lot_number 앞 6자리: YYMMDD)
        CASE
          WHEN LENGTH(lt.lot_number) >= 6
          THEN SUBSTRING(lt.lot_number FROM 1 FOR 6)
          ELSE NULL
        END AS lot_date_str
      FROM lot_transaction lt
      JOIN item_master im ON lt.item_id = im.item_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY lt.lot_number DESC
      LIMIT 200
    `, params);

    return {
      lots: result.rows,
      total: result.rows.length,
    };
  });

  // ══════════════════════════════════════════════════════════
  // 출하 완료 목록 (출하대기에서 완료된 건들)
  // ══════════════════════════════════════════════════════════
  app.get('/api/shipment-completed', async (request) => {
    const { from, to } = request.query as { from?: string; to?: string };

    const conditions = ["sr.status = 'SHIPPED'"];
    const params: any[] = [];
    let pi = 1;

    if (from) { conditions.push(`sr.shipped_at >= $${pi++}`); params.push(from); }
    if (to)   { conditions.push(`sr.shipped_at <= $${pi++}`); params.push(to); }

    const result = await pool.query(`
      SELECT
        sr.sr_id, sr.delivery_date, sr.shipped_at,
        sr.distributor, sr.contractor, sr.main_contractor, sr.site_name,
        sr.so_id, so.so_number,
        pm.project_code, pm.project_name,
        COUNT(sri.sri_id)         AS item_count,
        SUM(sri.shipped_qty)      AS total_shipped,
        COUNT(sqc.sqc_id)         AS cert_count,
        ARRAY_AGG(DISTINCT sqc.cert_number) FILTER (WHERE sqc.cert_number IS NOT NULL) AS cert_numbers
      FROM shipment_ready sr
      LEFT JOIN project_master pm ON sr.project_id = pm.project_id
      LEFT JOIN shipment_order so ON sr.so_id = so.so_id
      LEFT JOIN shipment_ready_item sri ON sr.sr_id = sri.sr_id
      LEFT JOIN shipment_quality_cert sqc ON sr.sr_id = sqc.sr_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY sr.sr_id, pm.project_code, pm.project_name, so.so_number
      ORDER BY sr.shipped_at DESC
    `, params);

    return { rows: result.rows };
  });
}
