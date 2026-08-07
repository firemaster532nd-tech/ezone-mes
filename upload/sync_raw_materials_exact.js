// POST /api/material-transactions API를 활용한 원자재 4종(PE3005MB 3360kg, 팽창흑연 2736kg, EA33045 3020kg, EP100 1092kg) 정확 수량 100% 반영 스크립트
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

async function updateExactRawMaterials() {
  console.log('=== [1] 관리자 로그인 ===');
  const loginRes = await apiRequest('/api/auth/login', 'POST', {
    employee_no: 'admin',
    password: 'dlwldnjs77@'
  });
  const token = loginRes.body.token;

  // 엑셀 수불표 기준 목표 원자재 수량 4종
  const targets = [
    { name_keyword: 'MB', item_name: '난연컴파운드 (PE3005MB)', target_qty: 3360, lot_number: '260804MB001' },
    { name_keyword: '흑연', item_name: '팽창흑연 (흑연)', target_qty: 2736, lot_number: '260804GR001' },
    { name_keyword: 'EA33045', item_name: 'EA33045 (EA-33045)', target_qty: 3020, lot_number: '260804EA001' },
    { name_keyword: 'EP100', item_name: 'EP100 (방화실란트 EP-100)', target_qty: 1092, lot_number: '260804EP001' }
  ];

  // 1. 현재 material_lots 조회
  const listRes = await apiRequest('/api/material-lots', 'GET', null, token);
  const currentLots = listRes.body ? listRes.body.data : [];

  console.log('\n=== [2] 원자재 수량 100% 동기화 트랜잭션 실행 ===');

  for (const t of targets) {
    const lot = currentLots.find(l => 
      l.lot_number === t.lot_number || 
      (l.item_name && l.item_name.toLowerCase().includes(t.name_keyword.toLowerCase()))
    );

    if (lot) {
      const currentQty = Number(lot.qty_current);
      const diff = t.target_qty - currentQty;
      
      // 항목명/카테고리 정리
      await apiRequest(`/api/material-lots/${lot.lot_id}`, 'PATCH', {
        item_name: t.item_name,
        category: '원자재(배합원료)',
        unit: 'kg',
        notes: `엑셀 수불표 100% 동기화 (목표: ${t.target_qty}kg)`
      }, token);

      if (diff !== 0) {
        const txnRes = await apiRequest('/api/material-transactions', 'POST', {
          lot_id: lot.lot_id,
          txn_type: 'ADJ',
          qty: diff,
          notes: `엑셀 수불표 재고 동기화 (기존: ${currentQty}kg -> 변경: ${t.target_qty}kg)`
        }, token);
        console.log(`[수량 동기화 완료] ${t.item_name} -> 기존: ${currentQty}kg => 최종: ${t.target_qty}kg (Status: ${txnRes.status})`);
      } else {
        console.log(`[수량 일치] ${t.item_name} -> 이미 ${t.target_qty}kg로 일치합니다.`);
      }
    } else {
      // 신규 생성
      const createRes = await apiRequest('/api/material-lots', 'POST', {
        lot_number: t.lot_number,
        item_name: t.item_name,
        category: '원자재(배합원료)',
        qty_current: t.target_qty,
        unit: 'kg',
        location: '본재고',
        notes: `엑셀 수불표 신규 등록 (${t.target_qty}kg)`
      }, token);
      console.log(`[LOT 신규 생성] ${t.item_name} -> ${t.target_qty}kg (Status: ${createRes.status})`);
    }
  }

  console.log('\n=== ✅ 원자재 (PE3005MB, 팽창흑연, EA33045, EP100) 100% 동기화 완료! ===');
}

updateExactRawMaterials().catch(console.error);
