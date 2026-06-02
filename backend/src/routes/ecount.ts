import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../lib/auth-plugin.js';

// ─────────────────────────────────────────────────────────────────────────────
// 이카운트 오픈 API V2 연동 라우트
// ─────────────────────────────────────────────────────────────────────────────

const ECOUNT_BASE = 'http://sboapi';
const ECOUNT_SUFFIX = '.ecount.com/OAPI/V2';
const ZONE_POST_URL = 'http://sboapi.ecount.com/OAPI/V2/ZONE';

// ── 세션 캐시 (메모리, 8시간) ────────────────────────────────────────────────
let cachedSession: { session_id: string; zone: string; expires: number } | null = null;

async function getSession(cfg: EcountConfig): Promise<{ session_id: string; zone: string }> {
  const now = Date.now();
  if (cachedSession && cachedSession.expires > now) {
    return { session_id: cachedSession.session_id, zone: cachedSession.zone };
  }

  // 1) Zone 조회 (POST 방식)
  const zoneRes = await fetch(ZONE_POST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ COM_CODE: cfg.com_code }),
  });
  if (!zoneRes.ok) throw new Error('이카운트 Zone 조회 실패: ' + zoneRes.status);
  const zoneData = await zoneRes.json() as any;
  const zone = zoneData?.Data?.ZONE || zoneData?.ZONE;
  if (!zone) throw new Error('Zone 정보를 가져올 수 없습니다: ' + JSON.stringify(zoneData).slice(0, 200));

  // 2) 로그인 → SESSION_ID
  const loginUrl = `${ECOUNT_BASE}${zone}${ECOUNT_SUFFIX}/OAPILogin`;
  const loginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      COM_CODE: cfg.com_code,
      USER_ID: cfg.user_id,
      API_CERT_KEY: cfg.api_cert_key,
      LAN_TYPE: cfg.lan_type || 'ko-KR',
      ZONE: zone,
    }),
  });
  if (!loginRes.ok) {
    const txt = await loginRes.text();
    throw new Error(`이카운트 로그인 실패: ${loginRes.status} ${txt.slice(0, 200)}`);
  }
  const loginData = await loginRes.json() as any;
  // 이카운트 V2: 성공 시 Code='00', SESSION_ID는 Data.Datas.SESSION_ID
  const code = loginData?.Data?.Code;
  if (code !== '00') {
    const msg = loginData?.Data?.Message || JSON.stringify(loginData).slice(0, 300);
    throw new Error(`이카운트 로그인 실패 (Code ${code}): ${msg}`);
  }
  const session_id = loginData?.Data?.Datas?.SESSION_ID;
  if (!session_id) throw new Error('SESSION_ID 수신 실패: ' + JSON.stringify(loginData).slice(0, 300));

  // 8시간 캐시
  cachedSession = { session_id, zone, expires: now + 8 * 60 * 60 * 1000 };

  // DB에 zone + session 업데이트
  await pool.query(
    `UPDATE ecount_config SET zone=$1, session_id=$2, session_at=NOW(), updated_at=NOW() WHERE id=(SELECT id FROM ecount_config WHERE is_active=TRUE ORDER BY id DESC LIMIT 1)`,
    [zone, session_id],
  ).catch(() => {});

  return { session_id, zone };
}

interface EcountConfig {
  id: number;
  com_code: string;
  user_id: string;
  api_cert_key: string;
  lan_type: string;
  zone: string | null;
  session_id: string | null;
  session_at: string | null;
}

async function getActiveConfig(): Promise<EcountConfig> {
  const { rows } = await pool.query(
    `SELECT * FROM ecount_config WHERE is_active=TRUE ORDER BY id DESC LIMIT 1`,
  );
  if (!rows[0]) throw new Error('이카운트 연동 설정이 없습니다. 설정 페이지에서 먼저 API 키를 입력하세요.');
  return rows[0];
}

/** 이카운트 API POST 공통 호출 */
async function ecountPost(zone: string, path: string, session_id: string, body: Record<string, any> = {}) {
  const url = `${ECOUNT_BASE}${zone}${ECOUNT_SUFFIX}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ SESSION_ID: session_id, ...body }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`이카운트 API 호출 실패 [${path}]: ${res.status} ${txt.slice(0, 300)}`);
  }
  return res.json() as Promise<any>;
}

/** 동기화 로그 기록 */
async function logSync(type: string, status: 'success' | 'error', total: number, synced: number, errMsg?: string, startedAt?: Date) {
  await pool.query(
    `INSERT INTO ecount_sync_log (sync_type, status, total_count, synced_count, error_msg, started_at, finished_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
    [type, status, total, synced, errMsg || null, startedAt || new Date()],
  ).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
export async function ecountRoutes(app: FastifyInstance) {

  // ── DB 마이그레이션 ──────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ecount_config (
      id            SERIAL PRIMARY KEY,
      com_code      VARCHAR(20) NOT NULL,
      user_id       VARCHAR(50) NOT NULL,
      api_cert_key  VARCHAR(500) NOT NULL,
      lan_type      VARCHAR(20) DEFAULT 'ko-KR',
      zone          VARCHAR(10),
      session_id    VARCHAR(1000),
      session_at    TIMESTAMPTZ,
      is_active     BOOLEAN DEFAULT TRUE,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ecount_sync_log (
      log_id       SERIAL PRIMARY KEY,
      sync_type    VARCHAR(30) NOT NULL,
      status       VARCHAR(20),
      total_count  INT DEFAULT 0,
      synced_count INT DEFAULT 0,
      error_msg    TEXT,
      started_at   TIMESTAMPTZ DEFAULT NOW(),
      finished_at  TIMESTAMPTZ
    )
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ecount_stock (
      id          SERIAL PRIMARY KEY,
      prod_cd     VARCHAR(50),
      prod_nm     VARCHAR(500),
      wh_cd       VARCHAR(50),
      wh_nm       VARCHAR(200),
      qty         DECIMAL(18,4) DEFAULT 0,
      unit        VARCHAR(30),
      synced_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ecount_purchase (
      id          SERIAL PRIMARY KEY,
      slip_date   DATE,
      cust_cd     VARCHAR(50),
      cust_nm     VARCHAR(500),
      prod_cd     VARCHAR(50),
      prod_nm     VARCHAR(500),
      qty         DECIMAL(18,4),
      price       DECIMAL(18,2),
      supply_amt  DECIMAL(18,2),
      vat_amt     DECIMAL(18,2),
      total_amt   DECIMAL(18,2),
      io_type_nm  VARCHAR(100),
      memo        TEXT,
      synced_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ecount_sale (
      id          SERIAL PRIMARY KEY,
      slip_date   DATE,
      cust_cd     VARCHAR(50),
      cust_nm     VARCHAR(500),
      prod_cd     VARCHAR(50),
      prod_nm     VARCHAR(500),
      qty         DECIMAL(18,4),
      price       DECIMAL(18,2),
      supply_amt  DECIMAL(18,2),
      vat_amt     DECIMAL(18,2),
      total_amt   DECIMAL(18,2),
      io_type_nm  VARCHAR(100),
      memo        TEXT,
      synced_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  // item_master에 이카운트 품목코드 컬럼 추가
  await pool.query(`ALTER TABLE item_master ADD COLUMN IF NOT EXISTS ecount_prod_cd VARCHAR(50)`).catch(() => {});
  // company_master에 이카운트 거래처코드 컬럼 추가
  await pool.query(`ALTER TABLE company_master ADD COLUMN IF NOT EXISTS ecount_cust_cd VARCHAR(50)`).catch(() => {});

  // ── GET /api/ecount/config ─ 설정 조회 ───────────────────────────────────
  app.get('/api/ecount/config', { preHandler: requireRole('admin') }, async (_req, reply) => {
    const { rows } = await pool.query(
      `SELECT id, com_code, user_id, lan_type, zone, session_at, is_active, updated_at
       FROM ecount_config WHERE is_active=TRUE ORDER BY id DESC LIMIT 1`,
    );
    // api_cert_key는 마스킹해서 반환
    return { data: rows[0] ? { ...rows[0], api_cert_key_masked: true } : null };
  });

  // ── POST /api/ecount/config ─ 설정 저장 ──────────────────────────────────
  app.post('/api/ecount/config', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { com_code, user_id, api_cert_key, lan_type } = req.body as any;
    if (!com_code || !user_id || !api_cert_key) {
      return reply.code(400).send({ error: '회사코드, 사용자ID, API인증키는 필수입니다.' });
    }
    // 기존 설정 비활성화
    await pool.query(`UPDATE ecount_config SET is_active=FALSE`);
    // 신규 저장
    const { rows } = await pool.query(
      `INSERT INTO ecount_config (com_code, user_id, api_cert_key, lan_type)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [com_code.trim(), user_id.trim(), api_cert_key.trim(), lan_type || 'ko-KR'],
    );
    cachedSession = null; // 세션 캐시 초기화
    return { ok: true, id: rows[0].id };
  });

  // ── POST /api/ecount/test-connect ─ 연결 테스트 ──────────────────────────
  app.post('/api/ecount/test-connect', { preHandler: requireRole('admin') }, async (_req, reply) => {
    try {
      const cfg = await getActiveConfig();
      cachedSession = null;
      const { session_id, zone } = await getSession(cfg);
      return { ok: true, zone, message: `Zone ${zone} 연결 성공 ✅` };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ── 동기화 엔드포인트들 ─────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  // ── POST /api/ecount/sync/items ─ 품목 동기화 ────────────────────────────
  app.post('/api/ecount/sync/items', { preHandler: requireRole('admin') }, async (_req, reply) => {
    const startedAt = new Date();
    try {
      const cfg = await getActiveConfig();
      const { session_id, zone } = await getSession(cfg);

      // 이카운트 품목 목록 조회
      const data = await ecountPost(zone, '/InventoryBasic/GetProductBasicList', session_id, {
        PROD_CD: '', PROD_DV: '', IN_DATE_FR: '', IN_DATE_TO: '',
      });

      const items: any[] = data?.Data?.Result ?? data?.Result ?? [];
      let synced = 0;

      for (const item of items) {
        const prodCd = item.PROD_CD || item.prod_cd;
        const prodNm = item.PROD_DV_NM || item.PROD_NM || item.prod_nm || '';
        const unit   = item.UNIT || item.unit || 'ea';
        if (!prodCd) continue;

        // item_master에서 ecount_prod_cd로 매칭, 없으면 item_code로 매칭
        const { rows: existing } = await pool.query(
          `SELECT item_id FROM item_master WHERE ecount_prod_cd=$1 OR item_code=$1 LIMIT 1`,
          [prodCd],
        );

        if (existing.length > 0) {
          await pool.query(
            `UPDATE item_master SET item_name=$1, unit=$2, ecount_prod_cd=$3, updated_at=NOW()
             WHERE item_id=$4`,
            [prodNm, unit, prodCd, existing[0].item_id],
          );
        } else {
          // 신규 품목 등록 (카테고리 없이 기본값으로)
          await pool.query(
            `INSERT INTO item_master (item_code, item_name, unit, ecount_prod_cd, is_active)
             VALUES ($1,$2,$3,$4,TRUE)
             ON CONFLICT (item_code) DO UPDATE SET item_name=$2, ecount_prod_cd=$4, updated_at=NOW()`,
            [prodCd, prodNm, unit, prodCd],
          ).catch(() => {});
        }
        synced++;
      }

      await logSync('item', 'success', items.length, synced, undefined, startedAt);
      return { ok: true, total: items.length, synced };
    } catch (err: any) {
      await logSync('item', 'error', 0, 0, err.message, startedAt);
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── POST /api/ecount/sync/customers ─ 거래처 동기화 ──────────────────────
  app.post('/api/ecount/sync/customers', { preHandler: requireRole('admin') }, async (_req, reply) => {
    const startedAt = new Date();
    try {
      const cfg = await getActiveConfig();
      const { session_id, zone } = await getSession(cfg);

      const data = await ecountPost(zone, '/BaseInfo/GetCustomerBasicList', session_id, {
        CUST_CD: '', CUST_TYPE: '',
      });

      const customers: any[] = data?.Data?.Result ?? data?.Result ?? [];
      let synced = 0;

      for (const cust of customers) {
        const custCd = cust.CUST_CD || cust.cust_cd;
        const custNm = cust.CUST_NM || cust.cust_nm || '';
        const bizNo  = cust.BIZ_NO  || cust.biz_no  || null;
        const ceo    = cust.CEO_NM  || cust.ceo_nm  || null;
        const addr   = cust.ADDR    || cust.addr    || null;
        const tel    = cust.TEL_NO  || cust.tel_no  || null;
        if (!custCd) continue;

        const { rows: existing } = await pool.query(
          `SELECT company_id FROM company_master WHERE ecount_cust_cd=$1 OR company_code=$1 LIMIT 1`,
          [custCd],
        );

        if (existing.length > 0) {
          await pool.query(
            `UPDATE company_master SET company_name=$1, biz_no=$2, ceo_name=$3, address=$4, phone=$5, ecount_cust_cd=$6, updated_at=NOW()
             WHERE company_id=$7`,
            [custNm, bizNo, ceo, addr, tel, custCd, existing[0].company_id],
          ).catch(() => {});
        } else {
          await pool.query(
            `INSERT INTO company_master (company_code, company_name, biz_no, ceo_name, address, phone, ecount_cust_cd, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)
             ON CONFLICT (company_code) DO UPDATE SET company_name=$2, ecount_cust_cd=$7, updated_at=NOW()`,
            [custCd, custNm, bizNo, ceo, addr, tel, custCd],
          ).catch(() => {});
        }
        synced++;
      }

      await logSync('customer', 'success', customers.length, synced, undefined, startedAt);
      return { ok: true, total: customers.length, synced };
    } catch (err: any) {
      await logSync('customer', 'error', 0, 0, err.message, startedAt);
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── POST /api/ecount/sync/stock ─ 재고 동기화 ────────────────────────────
  app.post('/api/ecount/sync/stock', { preHandler: requireRole('admin') }, async (_req, reply) => {
    const startedAt = new Date();
    try {
      const cfg = await getActiveConfig();
      const { session_id, zone } = await getSession(cfg);

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const data = await ecountPost(zone, '/InventoryInquiryBalances/GetInventoryBalanceStatusList', session_id, {
        BASE_DATE: today, WH_CD: '', PROD_CD: '',
      });

      const stocks: any[] = data?.Data?.Result ?? data?.Result ?? [];

      // 전량 교체
      await pool.query(`TRUNCATE TABLE ecount_stock`);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const s of stocks) {
          await client.query(
            `INSERT INTO ecount_stock (prod_cd, prod_nm, wh_cd, wh_nm, qty, unit)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [
              s.PROD_CD || s.prod_cd || '',
              s.PROD_DV_NM || s.PROD_NM || s.prod_nm || '',
              s.WH_CD  || s.wh_cd  || '',
              s.WH_NM  || s.wh_nm  || '',
              parseFloat(s.QTY || s.qty || '0') || 0,
              s.UNIT   || s.unit   || 'ea',
            ],
          );
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }

      await logSync('stock', 'success', stocks.length, stocks.length, undefined, startedAt);
      return { ok: true, total: stocks.length, synced: stocks.length };
    } catch (err: any) {
      await logSync('stock', 'error', 0, 0, err.message, startedAt);
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── POST /api/ecount/sync/purchases ─ 구매내역 동기화 ────────────────────
  app.post('/api/ecount/sync/purchases', { preHandler: requireRole('admin') }, async (req, reply) => {
    const startedAt = new Date();
    try {
      const cfg = await getActiveConfig();
      const { session_id, zone } = await getSession(cfg);
      const { months = 3 } = (req.body as any) || {};

      const toDate  = new Date();
      const frDate  = new Date();
      frDate.setMonth(frDate.getMonth() - months);
      const fr = frDate.toISOString().slice(0, 10).replace(/-/g, '');
      const to = toDate.toISOString().slice(0, 10).replace(/-/g, '');

      const data = await ecountPost(zone, '/BuyAccounting/GetBuyList', session_id, {
        DATE_FR: fr, DATE_TO: to, PROD_CD: '', CUST_CD: '',
      });

      const purchases: any[] = data?.Data?.Result ?? data?.Result ?? [];

      await pool.query(`TRUNCATE TABLE ecount_purchase`);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const p of purchases) {
          const slipDate = p.SLIP_DATE || p.slip_date || p.IO_DATE;
          await client.query(
            `INSERT INTO ecount_purchase (slip_date, cust_cd, cust_nm, prod_cd, prod_nm, qty, price, supply_amt, vat_amt, total_amt, io_type_nm, memo)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [
              slipDate ? slipDate.slice(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : null,
              p.CUST_CD || p.cust_cd || '',
              p.CUST_NM || p.cust_nm || '',
              p.PROD_CD || p.prod_cd || '',
              p.PROD_DV_NM || p.PROD_NM || p.prod_nm || '',
              parseFloat(p.QTY || p.qty || '0') || 0,
              parseFloat(p.PRICE || p.price || '0') || 0,
              parseFloat(p.SUPPLY_AMT || p.supply_amt || '0') || 0,
              parseFloat(p.VAT_AMT || p.vat_amt || '0') || 0,
              parseFloat(p.TOTAL_AMT || p.total_amt || '0') || 0,
              p.IO_TYPE_NM || p.io_type_nm || '',
              p.MEMO || p.memo || null,
            ],
          );
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }

      await logSync('purchase', 'success', purchases.length, purchases.length, undefined, startedAt);
      return { ok: true, total: purchases.length, synced: purchases.length };
    } catch (err: any) {
      await logSync('purchase', 'error', 0, 0, err.message, startedAt);
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── POST /api/ecount/sync/sales ─ 판매내역 동기화 ────────────────────────
  app.post('/api/ecount/sync/sales', { preHandler: requireRole('admin') }, async (req, reply) => {
    const startedAt = new Date();
    try {
      const cfg = await getActiveConfig();
      const { session_id, zone } = await getSession(cfg);
      const { months = 3 } = (req.body as any) || {};

      const toDate = new Date();
      const frDate = new Date();
      frDate.setMonth(frDate.getMonth() - months);
      const fr = frDate.toISOString().slice(0, 10).replace(/-/g, '');
      const to = toDate.toISOString().slice(0, 10).replace(/-/g, '');

      const data = await ecountPost(zone, '/SaleAccounting/GetSaleList', session_id, {
        DATE_FR: fr, DATE_TO: to, PROD_CD: '', CUST_CD: '',
      });

      const sales: any[] = data?.Data?.Result ?? data?.Result ?? [];

      await pool.query(`TRUNCATE TABLE ecount_sale`);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const s of sales) {
          const slipDate = s.SLIP_DATE || s.slip_date || s.IO_DATE;
          await client.query(
            `INSERT INTO ecount_sale (slip_date, cust_cd, cust_nm, prod_cd, prod_nm, qty, price, supply_amt, vat_amt, total_amt, io_type_nm, memo)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [
              slipDate ? slipDate.slice(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : null,
              s.CUST_CD || s.cust_cd || '',
              s.CUST_NM || s.cust_nm || '',
              s.PROD_CD || s.prod_cd || '',
              s.PROD_DV_NM || s.PROD_NM || s.prod_nm || '',
              parseFloat(s.QTY || s.qty || '0') || 0,
              parseFloat(s.PRICE || s.price || '0') || 0,
              parseFloat(s.SUPPLY_AMT || s.supply_amt || '0') || 0,
              parseFloat(s.VAT_AMT || s.vat_amt || '0') || 0,
              parseFloat(s.TOTAL_AMT || s.total_amt || '0') || 0,
              s.IO_TYPE_NM || s.io_type_nm || '',
              s.MEMO || s.memo || null,
            ],
          );
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }

      await logSync('sale', 'success', sales.length, sales.length, undefined, startedAt);
      return { ok: true, total: sales.length, synced: sales.length };
    } catch (err: any) {
      await logSync('sale', 'error', 0, 0, err.message, startedAt);
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── POST /api/ecount/sync/all ─ 전체 일괄 동기화 ─────────────────────────
  app.post('/api/ecount/sync/all', { preHandler: requireRole('admin') }, async (req, reply) => {
    const results: Record<string, any> = {};
    const types = ['items', 'customers', 'stock', 'purchases', 'sales'];

    for (const type of types) {
      try {
        const r = await app.inject({
          method: 'POST',
          url: `/api/ecount/sync/${type}`,
          headers: req.headers,
          payload: req.body as any,
        });
        results[type] = r.statusCode === 200 ? JSON.parse(r.body) : { error: r.body };
      } catch (e: any) {
        results[type] = { error: e.message };
      }
    }

    return { ok: true, results };
  });

  // ── GET /api/ecount/sync/logs ─ 동기화 이력 ──────────────────────────────
  app.get('/api/ecount/sync/logs', { preHandler: requireRole('admin') }, async (req) => {
    const { limit = 30 } = req.query as any;
    const { rows } = await pool.query(
      `SELECT * FROM ecount_sync_log ORDER BY log_id DESC LIMIT $1`,
      [limit],
    );
    return { data: rows };
  });

  // ── GET /api/ecount/sync/summary ─ 동기화 현황 요약 ──────────────────────
  app.get('/api/ecount/sync/summary', { preHandler: requireRole('admin') }, async () => {
    const types = ['item', 'customer', 'stock', 'purchase', 'sale'];
    const summary: Record<string, any> = {};

    for (const t of types) {
      const { rows } = await pool.query(
        `SELECT status, total_count, synced_count, finished_at
         FROM ecount_sync_log WHERE sync_type=$1 AND status='success'
         ORDER BY log_id DESC LIMIT 1`,
        [t],
      );
      summary[t] = rows[0] || null;
    }

    // 현재 저장된 건수
    const counts: Record<string, number> = {};
    for (const [t, tbl] of [['item', 'item_master'], ['customer', 'company_master'], ['stock', 'ecount_stock'], ['purchase', 'ecount_purchase'], ['sale', 'ecount_sale']] as [string, string][]) {
      const { rows } = await pool.query(`SELECT COUNT(*)::int AS cnt FROM ${tbl} ${t === 'item' ? "WHERE ecount_prod_cd IS NOT NULL" : t === 'customer' ? "WHERE ecount_cust_cd IS NOT NULL" : ''}`);
      counts[t] = rows[0]?.cnt ?? 0;
    }

    return { data: { summary, counts } };
  });

  // ── GET /api/ecount/stock ─ 이카운트 재고 목록 조회 ──────────────────────
  app.get('/api/ecount/stock', { preHandler: requireAuth }, async (req) => {
    const { search } = req.query as any;
    const where = search ? `WHERE prod_nm ILIKE $1 OR prod_cd ILIKE $1` : '';
    const params = search ? [`%${search}%`] : [];
    const { rows } = await pool.query(
      `SELECT * FROM ecount_stock ${where} ORDER BY prod_nm, wh_nm LIMIT 500`,
      params,
    );
    return { data: rows };
  });

  // ── GET /api/ecount/purchases ─ 이카운트 구매내역 조회 ───────────────────
  app.get('/api/ecount/purchases', { preHandler: requireAuth }, async (req) => {
    const { search, fr, to } = req.query as any;
    const where: string[] = [];
    const params: any[] = [];
    if (search) { params.push(`%${search}%`); where.push(`(prod_nm ILIKE $${params.length} OR cust_nm ILIKE $${params.length})`); }
    if (fr)     { params.push(fr); where.push(`slip_date >= $${params.length}`); }
    if (to)     { params.push(to); where.push(`slip_date <= $${params.length}`); }
    const { rows } = await pool.query(
      `SELECT * FROM ecount_purchase ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY slip_date DESC LIMIT 500`,
      params,
    );
    return { data: rows };
  });

  // ── GET /api/ecount/sales ─ 이카운트 판매내역 조회 ───────────────────────
  app.get('/api/ecount/sales', { preHandler: requireAuth }, async (req) => {
    const { search, fr, to } = req.query as any;
    const where: string[] = [];
    const params: any[] = [];
    if (search) { params.push(`%${search}%`); where.push(`(prod_nm ILIKE $${params.length} OR cust_nm ILIKE $${params.length})`); }
    if (fr)     { params.push(fr); where.push(`slip_date >= $${params.length}`); }
    if (to)     { params.push(to); where.push(`slip_date <= $${params.length}`); }
    const { rows } = await pool.query(
      `SELECT * FROM ecount_sale ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY slip_date DESC LIMIT 500`,
      params,
    );
    return { data: rows };
  });
}
