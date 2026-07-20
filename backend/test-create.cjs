require('dotenv').config();
const http = require('http');

// 로컬 백엔드 서버에 직접 테스트
async function testAPI(path, method, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path: '/api' + path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  console.log('=== Step 1: 관리자 로그인 ===');
  const loginRes = await testAPI('/auth/login', 'POST', {
    employee_no: 'admin',
    password: 'admin1234'
  });
  console.log('로그인 결과:', loginRes.status, JSON.stringify(loginRes.body).substring(0, 200));
  
  const token = loginRes.body?.token;
  if (!token) { console.error('토큰 없음. 종료'); return; }
  
  console.log('\n=== Step 2: 다음 사번 조회 ===');
  const nextNoRes = await testAPI('/auth/next-employee-no', 'GET', null, token);
  console.log('결과:', nextNoRes.status, nextNoRes.body);

  console.log('\n=== Step 3: 신규 직원 등록 테스트 ===');
  const createRes = await testAPI('/auth/users', 'POST', {
    employee_no: nextNoRes.body?.employee_no || '',
    worker_name: '테스트직원',
    phone: '010-9999-8888',
    dept_id: 1,
    role: 'worker',
    password: '010-9999-8888',
    email: '',
    position: ''
  }, token);
  console.log('결과:', createRes.status, JSON.stringify(createRes.body, null, 2));

  // 정리
  if (createRes.body?.user?.worker_id) {
    console.log('\n=== 테스트 직원 삭제 ===');
    const del = await testAPI('/auth/users/' + createRes.body.user.worker_id, 'DELETE', null, token);
    console.log('삭제:', del.status);
  }
}
main().catch(console.error);
