// 반제품 가스켓 3종 비인정 재고 이동 및 등록 스크립트
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

async function moveToNonCertified() {
  console.log('=== [1] 관리자 로그인 ===');
  const loginRes = await apiRequest('/api/auth/login', 'POST', {
    employee_no: 'admin',
    password: 'dlwldnjs77@'
  });
  const token = loginRes.body.token;

  // 1. 비인정재고(non_certified_stock) 테이블에 가스켓 3종 등록
  const nonCertGaskets = [
    {
      rack_code: 'P1',
      pallet_no: 1,
      item_name: '(I형) 가스켓 [W125, L:1000, T:0.5]',
      spec: 'W125 x L1000 x T0.5',
      lot_number: '260212-GI-I01',
      qty: 314,
      unit: '개',
      reason: '비인정제품(자체재고)',
      notes: '수불표 2026-02-12 기준 314개 (비인정 전환)'
    },
    {
      rack_code: 'P1',
      pallet_no: 2,
      item_name: '(L형) 가스켓 [W185, L:1000, T:0.5]',
      spec: 'W185 x L1000 x T0.5',
      lot_number: '260212-GI-L01',
      qty: 908,
      unit: '개',
      reason: '비인정제품(자체재고)',
      notes: '수불표 2026-02-12 기준 908개 (비인정 전환)'
    },
    {
      rack_code: 'P2',
      pallet_no: 1,
      item_name: '(Z형) 가스켓 [W215, L:1000, T:0.5]',
      spec: 'W215 x L1000 x T0.5',
      lot_number: '260212-GI-Z01',
      qty: 2610,
      unit: '개',
      reason: '비인정제품(자체재고)',
      notes: '수불표 2026-02-12 기준 2610개 (비인정 전환)'
    }
  ];

  console.log('\n=== [2] non_certified_stock 테이블에 가스켓 3종 등록 ===');
  for (const item of nonCertGaskets) {
    const res = await apiRequest('/api/non-certified-stock', 'POST', item, token);
    console.log(`[비인정 등록] ${item.item_name} -> Status: ${res.status}`);
  }

  // 2. material_lots 테이블의 가스켓 LOT category를 '비인정재고'로 업데이트
  const listRes = await apiRequest('/api/material-lots', 'GET', null, token);
  const currentLots = listRes.body ? listRes.body.data : [];
  
  const gasketLots = currentLots.filter(l => l.item_name && l.item_name.includes('가스켓'));
  console.log(`\n=== [3] material_lots 테이블 가스켓 ${gasketLots.length}개 LOT 카테고리 '비인정재고' 전환 ===`);
  
  for (const lot of gasketLots) {
    await apiRequest(`/api/material-lots/${lot.lot_id}`, 'PUT', {
      ...lot,
      category: '비인정재고',
      stock_type: 'NON_CERTIFIED',
      notes: '비인정제품으로 이관 완료'
    }, token);
    console.log(`[LOT 카테고리 변경] ${lot.item_name} (${lot.lot_number}) -> 카테고리: 비인정재고`);
  }

  console.log('\n=== ✅ 반제품 가스켓 비인정 재고 이관 완료 ===');
}

moveToNonCertified().catch(console.error);
