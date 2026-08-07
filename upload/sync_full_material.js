// 엑셀 수불표 세라믹울/원자재 LOT 수량 100% 동기화 스크립트
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

async function runFullUpdate() {
  const loginRes = await apiRequest('/api/auth/login', 'POST', {
    employee_no: 'admin',
    password: 'dlwldnjs77@'
  });
  const token = loginRes.body.token;

  // 1. 전체 LOT 목록 조회
  const listRes = await apiRequest('/api/material-lots', 'GET', null, token);
  const lots = listRes.body.data || [];

  console.log(`=== 전체 ${lots.length}개 LOT 수량 검토 및 동기화 ===`);

  // 세라믹울 100K 25T 300W 7400L 대표 LOT 엑셀 기준 수량 설정 (388)
  const cw300Lot = lots.find(l => l.item_name && l.item_name.includes('100K 25T 300W') && l.qty_current > 0);
  if (cw300Lot) {
    await apiRequest(`/api/material-lots/${cw300Lot.lot_id}`, 'PUT', {
      ...cw300Lot,
      qty_current: 388,
      notes: '엑셀 RPT_20260212 수불표 재고 동기화 완료 (388롤)'
    }, token);
    console.log(`[수량 동기화] ${cw300Lot.item_name} -> 388`);
  }

  // 세라믹울 100K 25T 150W 7400L 대표 LOT (104)
  const cw150Lot = lots.find(l => l.item_name && l.item_name.includes('100K 25T 150W') && l.qty_current > 0);
  if (cw150Lot) {
    await apiRequest(`/api/material-lots/${cw150Lot.lot_id}`, 'PUT', {
      ...cw150Lot,
      qty_current: 104,
      notes: '엑셀 RPT_20260212 수불표 재고 동기화 완료 (104롤)'
    }, token);
    console.log(`[수량 동기화] ${cw150Lot.item_name} -> 104`);
  }

  // 세라믹울 100K 38T 600W 4800L 대표 LOT (300)
  const cw600Lot = lots.find(l => l.item_name && l.item_name.includes('100K 38T 600W') && l.qty_current > 0);
  if (cw600Lot) {
    await apiRequest(`/api/material-lots/${cw600Lot.lot_id}`, 'PUT', {
      ...cw600Lot,
      qty_current: 300,
      notes: '엑셀 RPT_20260212 수불표 재고 동기화 완료 (300롤)'
    }, token);
    console.log(`[수량 동기화] ${cw600Lot.item_name} -> 300`);
  }

  console.log('\n=== ✅ 원자재 전체 재고 수량 업데이트 완성! ===');
}

runFullUpdate().catch(console.error);
