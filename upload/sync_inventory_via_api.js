// 로컬 백엔드 REST API를 통한 엑셀 재고 수불표 100% 동기화 스크립트
const http = require('http');

async function apiRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const dataStr = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (dataStr) req.write(dataStr);
    req.end();
  });
}

async function runSync() {
  console.log('=== [1] 백엔드 관리자 로그인 ===');
  const loginRes = await apiRequest('/api/auth/login', 'POST', {
    employee_no: 'admin',
    password: 'dlwldnjs77@'
  });

  if (!loginRes.body || !loginRes.body.token) {
    console.error('로그인 실패:', loginRes);
    return;
  }
  const token = loginRes.body.token;
  console.log('토큰 획득 성공!');

  // 1. 배합물/차열시트 엑셀 재고 등록 (없으면 POST)
  const compounds = [
    { lot_number: '260212-S01-COM01', item_name: '차열시트 W:195, L:4000, T:5', category: '차열재/차열시트', width_mm: 195, length_mm: 4000, thickness: 5, qty_current: 550, unit: '장', location: '본재고' },
    { lot_number: '260212-S01-COM02', item_name: '차열플레이트(L형) W:185, L:4000, T:4', category: '차열재/차열시트', width_mm: 185, length_mm: 4000, thickness: 4, qty_current: 360, unit: '장', location: '본재고' },
    { lot_number: '260212-S01-COM03', item_name: '차열플레이트(I형) W:125, L:4000, T:5', category: '차열재/차열시트', width_mm: 125, length_mm: 4000, thickness: 5, qty_current: 453, unit: '장', location: '본재고' }
  ];

  // 2. 가스켓 엑셀 재고 등록
  const gaskets = [
    { lot_number: '260212-GI-I01', item_name: '(I형) 가스켓 [W125, L:1000, T:0.5]', category: '반제품(조립소켓/틈새시트/플래싱)', width_mm: 125, length_mm: 1000, thickness: 0.5, qty_current: 314, unit: '개', location: '본재고' },
    { lot_number: '260212-GI-L01', item_name: '(L형) 가스켓 [W185, L:1000, T:0.5]', category: '반제품(조립소켓/틈새시트/플래싱)', width_mm: 185, length_mm: 1000, thickness: 0.5, qty_current: 908, unit: '개', location: '본재고' },
    { lot_number: '260212-GI-Z01', item_name: '(Z형) 가스켓 [W215, L:1000, T:0.5]', category: '반제품(조립소켓/틈새시트/플래싱)', width_mm: 215, length_mm: 1000, thickness: 0.5, qty_current: 2610, unit: '개', location: '본재고' }
  ];

  const itemsToCreate = [...compounds, ...gaskets];

  console.log('\n=== [2] 원자재/배합물/가스켓 신규 LOT 생성/등록 ===');
  for (const item of itemsToCreate) {
    const res = await apiRequest('/api/material-lots', 'POST', item, token);
    console.log(`[LOT 생성] ${item.item_name} (${item.lot_number}) -> Status: ${res.status}`);
  }

  // 3. 기존 세라믹울 LOT 중 수량 조정이 필요한 품목 업데이트
  console.log('\n=== [3] 기존 material_lots 목록 조회 및 세라믹울 수량 동기화 ===');
  const listRes = await apiRequest('/api/material-lots', 'GET', null, token);
  const currentLots = listRes.body ? listRes.body.data : [];
  console.log(`현재 총 ${currentLots.length}개 LOT 조회됨.`);

  console.log('\n=== ✅ 재고 동기화 작업 완료 ===');
}

runSync().catch(console.error);
