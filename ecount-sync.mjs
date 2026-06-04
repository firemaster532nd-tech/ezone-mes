/**
 * 이카운트 → MES 로컬 동기화 스크립트
 * 실행: node ecount-sync.mjs
 * 
 * 사무실 PC(175.195.18.137)에서 직접 이카운트 API 호출 후
 * MES 백엔드에 데이터를 전송합니다.
 */

// ─── 설정 ──────────────────────────────────────────────────────────────────
const ECOUNT = {
  COM_CODE:     '626709',
  USER_ID:      '최진영',
  API_CERT_KEY: '11d19069cbe11414aa3fb2944e5b42c642',
  LAN_TYPE:     'ko-KR',
};

const MES = {
  BASE:     'https://ezone-mes-backend.vercel.app',
  ORIGIN:   'https://ezone-mes-frontend-v2pa.vercel.app',
  LOGIN_ID: 'admin',
  LOGIN_PW: 'admin1234',
};
// ───────────────────────────────────────────────────────────────────────────

const timeout = (ms) => AbortSignal.timeout(ms);

// ── 1. 이카운트 로그인 ──────────────────────────────────────────────────────
async function ecountLogin() {
  console.log('\n[이카운트] Zone 조회...');
  const zr = await fetch('http://sboapi.ecount.com/OAPI/V2/ZONE', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ COM_CODE: ECOUNT.COM_CODE }),
    signal: timeout(10000),
  });
  const zd = await zr.json();
  const zone = zd?.Data?.ZONE;
  if (!zone) throw new Error('Zone 조회 실패: ' + JSON.stringify(zd));
  console.log(`[이카운트] Zone: ${zone}`);

  console.log('[이카운트] 로그인...');
  const lr = await fetch(`http://sboapi${zone}.ecount.com/OAPI/V2/OAPILogin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...ECOUNT, ZONE: zone }),
    signal: timeout(12000),
  });
  const ld = await lr.json();
  if (ld?.Data?.Code !== '00') throw new Error('로그인 실패: ' + ld?.Data?.Message);
  const SESSION_ID = ld.Data.Datas.SESSION_ID;
  console.log(`[이카운트] 로그인 성공 ✅ Zone=${zone}`);
  return { SESSION_ID, zone };
}

// ── 2. 이카운트 데이터 조회 ─────────────────────────────────────────────────
async function ecountFetch(zone, SESSION_ID, path, body = {}) {
  const url = `http://sboapi${zone}.ecount.com/OAPI/V2${path}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ SESSION_ID, ...body }),
    signal: timeout(30000),
  });
  const d = await r.json();
  return d?.Data?.Result ?? d?.Result ?? [];
}

// ── 3. MES 로그인 ────────────────────────────────────────────────────────────
async function mesLogin() {
  console.log('\n[MES] 관리자 로그인...');
  const r = await fetch(`${MES.BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': MES.ORIGIN },
    body: JSON.stringify({ employee_no: MES.LOGIN_ID, password: MES.LOGIN_PW }),
    signal: timeout(10000),
  });
  const d = await r.json();
  if (!d.token) throw new Error('MES 로그인 실패: ' + JSON.stringify(d));
  console.log('[MES] 로그인 성공 ✅');
  return d.token;
}

// ── 4. MES에 데이터 전송 ─────────────────────────────────────────────────────
async function mesPush(token, endpoint, data) {
  const r = await fetch(`${MES.BASE}/api/ecount/push/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Origin': MES.ORIGIN,
    },
    body: JSON.stringify({ data }),
    signal: timeout(60000),
  });
  const d = await r.json();
  return d;
}

// ── 메인 실행 ────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  이카운트 → MES 로컬 동기화 시작');
  console.log('═══════════════════════════════════════');

  // 이카운트 로그인
  const { SESSION_ID, zone } = await ecountLogin();

  // MES 로그인
  const token = await mesLogin();

  const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const fr3m  = new Date(Date.now() - 90*24*3600*1000).toISOString().slice(0,10).replace(/-/g,'');

  const tasks = [
    {
      name: '품목',
      endpoint: 'items',
      fetch: () => ecountFetch(zone, SESSION_ID, '/InventoryBasic/GetProductBasicList', { PROD_CD:'', PROD_DV:'' }),
    },
    {
      name: '거래처',
      endpoint: 'customers',
      fetch: () => ecountFetch(zone, SESSION_ID, '/BaseInfo/GetCustomerBasicList', { CUST_CD:'', CUST_TYPE:'' }),
    },
    {
      name: '재고',
      endpoint: 'stock',
      fetch: () => ecountFetch(zone, SESSION_ID, '/InventoryInquiryBalances/GetInventoryBalanceStatusList', { BASE_DATE: today, WH_CD:'', PROD_CD:'' }),
    },
    {
      name: '구매내역',
      endpoint: 'purchases',
      fetch: () => ecountFetch(zone, SESSION_ID, '/BuyAccounting/GetBuyList', { DATE_FR: fr3m, DATE_TO: today, PROD_CD:'', CUST_CD:'' }),
    },
    {
      name: '판매내역',
      endpoint: 'sales',
      fetch: () => ecountFetch(zone, SESSION_ID, '/SaleAccounting/GetSaleList', { DATE_FR: fr3m, DATE_TO: today, PROD_CD:'', CUST_CD:'' }),
    },
  ];

  for (const task of tasks) {
    try {
      console.log(`\n[${task.name}] 이카운트에서 조회 중...`);
      const items = await task.fetch();
      console.log(`[${task.name}] ${items.length}건 조회됨`);

      if (items.length > 0) {
        console.log(`[${task.name}] MES에 전송 중...`);
        const result = await mesPush(token, task.endpoint, items);
        console.log(`[${task.name}] 완료: ${JSON.stringify(result)}`);
      } else {
        console.log(`[${task.name}] 데이터 없음 (테스트 계정)`);
      }
    } catch (e) {
      console.error(`[${task.name}] 오류:`, e.message);
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('  동기화 완료!');
  console.log('═══════════════════════════════════════');
}

main().catch(e => {
  console.error('\n❌ 오류:', e.message);
  process.exit(1);
});
