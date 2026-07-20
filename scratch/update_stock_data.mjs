import pkg from 'pg';
const { Pool } = pkg;
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : undefined
});

const excelPath = 'c:\\Users\\edwar\\OneDrive\\ezone-mes\\upload\\이지원재고수불표.xlsx';
const today = '2026-07-16'; // 오늘 날짜 기준

const explicitMappings = {
  // 차열재
  '128/25/200/7400': 'SM-CW-252007400',
  '96/50/600/3600': 'SM-CW-96-50',
  '100/50/600/3600': 'SM-CW-506003600',
  
  // 일반 자재 (품목명 + 규격 조합 매핑)
  '그라스울_25*1400': 'SM-GW-24-14',
  '그라스울_25*1000': 'SM-GW-24-10',
  '그라스울_50*1000': 'SM-CW-5010003600',
  '뉴트얼엑스 실란트_카트리지 270ML': 'SM-SIL',
  '방화플래싱철판Z_Z': 'SM-GI-Z',
  '방화플래싱철판I_0.6TX145X1000': 'SM-GI-I',
  '틈새강판_틈새강판': 'SM-GP',
  '보호철판 100_보호철판 100': 'SM-SP',
  '보호철판 75_보호철판 75': 'SM-SP',
  '보호철판 50_보호철판 50': 'SM-SP',
  '볼트 너트 와샤_볼트 너트 와샤': 'SM-SCREW',
  'FN-100_100H': 'SM-FN',
  'FN-100_210H': 'SM-FN',
};

const pendingNewItems = [
  { item_code: 'SM-COUPLING-100', item_name: '카프링 D-100', spec: 'D100', item_category: 'SM', unit: 'EA' },
  { item_code: 'SM-COUPLING-125', item_name: '카프링 D-125', spec: 'D125', item_category: 'SM', unit: 'EA' },
  { item_code: 'SM-CAP-100-UD', item_name: '상하부 CAP100', spec: 'C100', item_category: 'SM', unit: 'EA' },
  { item_code: 'SM-CAP-125-UD', item_name: '상하부 CAP125', spec: 'C125', item_category: 'SM', unit: 'EA' },
];

async function main() {
  console.log('--- EZONE MES 재고 동기화 고도화 스크립트 (모든 자재 시트 정밀 파싱 + 헤더기준 최신열 추출) ---');
  
  if (!fs.existsSync(excelPath)) {
    console.error('엑셀 파일을 찾을 수 없습니다:', excelPath);
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 0. 미등록 품목 자동 인서트
    console.log('미등록 필수 품목 데이터 확인 및 인서트 중...');
    for (const newItem of pendingNewItems) {
      await client.query(
        `INSERT INTO item_master (item_code, item_name, spec, item_category, unit, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (item_code) DO UPDATE 
         SET item_name = EXCLUDED.item_name, spec = EXCLUDED.spec`,
        [newItem.item_code, newItem.item_name, newItem.spec, newItem.item_category, newItem.unit]
      );
    }

    // 1. 품목 마스터(item_master) 정보 재조회
    const { rows: dbItems } = await client.query(
      `SELECT item_id, item_code, item_name, spec, item_category, unit 
       FROM item_master 
       WHERE is_active = true`
    );
    console.log(`DB 활성 품목 수: ${dbItems.length}개 로드 완료.`);

    // 2. 엑셀 워크북 로드
    console.log('엑셀 파일 로딩 중...');
    const workbook = XLSX.readFile(excelPath);

    // 3. 백업 테이블 생성 및 데이터 복사
    console.log('기존 데이터 백업 중...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_transaction_backup AS 
      SELECT * FROM inventory_transaction;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS lot_transaction_backup AS 
      SELECT * FROM lot_transaction;
    `);

    // 기존 데이터 비우기 (TRUNCATE)
    await client.query('TRUNCATE TABLE inventory_transaction CASCADE');
    await client.query('TRUNCATE TABLE lot_transaction CASCADE');
    console.log('기존 재고 트랜잭션 및 LOT 정보 초기화 완료.');

    const insertLots = [];

    // ─── A-1. 차열재 (세라믹울) LOT별 재고 파싱 ('차열재재고LOT' 시트 - 상단부 r:3~15) ───
    const lotSheet = workbook.Sheets['차열재재고LOT'];
    if (lotSheet) {
      console.log('차열재 LOT 시트 파싱 중 (차열재 영역)...');
      const lotRange = XLSX.utils.decode_range(lotSheet['!ref'] || 'A1:A1');
      
      const colSpecs = {};
      for (let c = 1; c <= lotRange.e.c; c++) {
        const specCell = lotSheet[XLSX.utils.encode_cell({ r: 2, c })];
        if (specCell && specCell.v) {
          colSpecs[c] = String(specCell.v).replace(/\s+/g, '');
        }
      }

      for (let c = 1; c <= lotRange.e.c; c += 2) {
        const specText = colSpecs[c] || colSpecs[c - 1];
        if (!specText) continue;

        let matchedItem = null;
        for (const [key, code] of Object.entries(explicitMappings)) {
          if (specText.includes(key)) {
            matchedItem = dbItems.find(it => it.item_code === code);
            break;
          }
        }

        if (!matchedItem) {
          matchedItem = dbItems.find(it => {
            if (it.item_category !== 'SM') return false;
            const cleanName = it.item_name.replace(/\s+/g, '');
            const cleanSpec = (it.spec || '').replace(/\s+/g, '');
            
            if (specText.includes('100/25/300/7400')) return it.item_code.includes('253007400') || cleanName.includes('100K') && cleanSpec.includes('t25') && cleanSpec.includes('W300');
            if (specText.includes('100/25/150/7400')) return it.item_code.includes('251507400') || cleanName.includes('100K') && cleanSpec.includes('t25') && cleanSpec.includes('W150');
            if (specText.includes('100/25/200/7400')) return it.item_code.includes('252007400') || cleanName.includes('100K') && cleanSpec.includes('t25') && cleanSpec.includes('W200');
            if (specText.includes('100/38/600/4800')) return it.item_code.includes('386004800') || cleanName.includes('100K') && cleanSpec.includes('t38') && cleanSpec.includes('W600');
            if (specText.includes('96/25/150/7400')) return it.item_code.includes('251507400') || cleanName.includes('96K') && cleanSpec.includes('t25') && cleanSpec.includes('W150');
            if (specText.includes('96/38/150/4800')) return it.item_code.includes('381504800') || cleanName.includes('96K') && cleanSpec.includes('t38') && cleanSpec.includes('W150');
            if (specText.includes('96/50/1000/3600')) return it.item_code.includes('5010003600') || cleanName.includes('96K') && cleanSpec.includes('t50') && cleanSpec.includes('W1000');
            if (specText.includes('96/50/150/3600')) return it.item_code.includes('501503600') || cleanName.includes('96K') && cleanSpec.includes('t50') && cleanSpec.includes('W150');
            if (specText.includes('96/50/400/3600')) return it.item_code.includes('504003600') || cleanName.includes('96K') && cleanSpec.includes('t50') && cleanSpec.includes('W400');
            
            return false;
          });
        }

        if (!matchedItem) continue;

        for (let r = 3; r <= 15; r++) { // 차열재 영역 r:3 ~ r:15
          const lotCell = lotSheet[XLSX.utils.encode_cell({ r, c })];
          const qtyCell = lotSheet[XLSX.utils.encode_cell({ r, c: c + 1 })];

          if (lotCell && lotCell.v && qtyCell && qtyCell.v !== '') {
            const lotNum = String(lotCell.v).trim();
            if (lotNum.includes('합계') || lotNum.includes('소계') || lotNum.includes('총계') || lotNum.includes('계') || lotNum === '합산' || lotNum === '') {
              continue;
            }
            const qty = parseFloat(qtyCell.v);
            if (qty > 0) {
              insertLots.push({
                lot_number: lotNum,
                lot_type: 'IN',
                item_id: matchedItem.item_id,
                qty: qty,
                remaining_qty: qty,
                unit: matchedItem.unit,
                status: 'ACTIVE'
              });
            }
          }
        }
      }

      // ─── A-2. 국산 그라스울 LOT별 재고 파싱 ('차열재재고LOT' 시트 - 하단부 r:19~23) ───
      console.log('차열재 LOT 시트 파싱 중 (그라스울 영역)...');
      const gwColSpecs = {};
      for (let c = 1; c <= lotRange.e.c; c++) {
        const specCell = lotSheet[XLSX.utils.encode_cell({ r: 18, c })]; // Row 18 그라스울 규격
        if (specCell && specCell.v) {
          gwColSpecs[c] = String(specCell.v).replace(/\s+/g, '');
        }
      }

      for (let c = 1; c <= lotRange.e.c; c += 2) {
        const specText = gwColSpecs[c] || gwColSpecs[c - 1];
        if (!specText) continue;

        let matchedItem = null;
        if (specText.includes('24/25/1000/20') || specText.includes('W:1000')) {
          matchedItem = dbItems.find(it => it.item_code === 'SM-GW-24-10');
        } else if (specText.includes('24/25/1400/20') || specText.includes('W:1400')) {
          matchedItem = dbItems.find(it => it.item_code === 'SM-GW-24-14');
        } else if (specText.includes('24/50/1000/10')) {
          matchedItem = dbItems.find(it => it.item_code === 'SM-CW-5010003600');
        }

        if (!matchedItem) continue;

        for (let r = 19; r <= 23; r++) { // 그라스울 영역 r:19 ~ r:23
          const lotCell = lotSheet[XLSX.utils.encode_cell({ r, c })];
          const qtyCell = lotSheet[XLSX.utils.encode_cell({ r, c: c + 1 })];

          if (lotCell && lotCell.v && qtyCell && qtyCell.v !== '') {
            const lotNum = String(lotCell.v).trim();
            if (lotNum.includes('합계') || lotNum.includes('소계') || lotNum.includes('총계') || lotNum.includes('계') || lotNum === '합산' || lotNum === '') {
              continue;
            }
            const qty = parseFloat(qtyCell.v);
            if (qty > 0) {
              insertLots.push({
                lot_number: lotNum,
                lot_type: 'IN',
                item_id: matchedItem.item_id,
                qty: qty,
                remaining_qty: qty,
                unit: matchedItem.unit,
                status: 'ACTIVE'
              });
            }
          }
        }
      }
    }

    // ─── B. 자재수불합계 시트 파싱 ───
    const summarySheet = workbook.Sheets['자재수불합계'];
    if (summarySheet) {
      console.log('자재수불합계 시트 파싱 중...');
      const sumRange = XLSX.utils.decode_range(summarySheet['!ref'] || 'A1:A1');
      
      for (let r = 2; r <= sumRange.e.r; r++) {
        const itemCell = summarySheet[XLSX.utils.encode_cell({ r, c: 0 })];
        const specCell = summarySheet[XLSX.utils.encode_cell({ r, c: 1 })];
        const qtyCell = summarySheet[XLSX.utils.encode_cell({ r, c: 5 })];

        if (itemCell && itemCell.v && specCell && specCell.v && qtyCell && qtyCell.v !== '') {
          const itemName = String(itemCell.v).trim();
          const spec = String(specCell.v).trim();
          const currentQty = parseFloat(qtyCell.v);

          if (currentQty <= 0) continue;

          // 합계, 소계, 총계 행 건너뛰기
          if (itemName.includes('합계') || itemName.includes('소계') || itemName.includes('총계') || itemName.includes('계') ||
              spec.includes('합계') || spec.includes('소계') || spec.includes('총계') || spec.includes('계') || itemName === '') {
            continue;
          }

          // 차열재 및 그라스울은 상세 LOT 파싱으로 처리되므로 합계 시트 파싱에서 완전 제외
          if (itemName.includes('차열재') || itemName.includes('세라믹울') || itemName.includes('그라스울') || itemName.includes('글라스울')) {
            continue;
          }

          // 명시적 매핑 조합 찾기
          const keyCombo = `${itemName}_${spec}`;
          let matchedItem = null;
          if (explicitMappings[keyCombo]) {
            matchedItem = dbItems.find(it => it.item_code === explicitMappings[keyCombo]);
          }

          if (!matchedItem) {
            if (itemName.includes('카프링 D-100')) matchedItem = dbItems.find(it => it.item_code === 'SM-COUPLING-100');
            else if (itemName.includes('카프링 D-125')) matchedItem = dbItems.find(it => it.item_code === 'SM-COUPLING-125');
            else if (itemName.includes('상하부 CAP100')) matchedItem = dbItems.find(it => it.item_code === 'SM-CAP-100-UD');
            else if (itemName.includes('상하부 CAP125')) matchedItem = dbItems.find(it => it.item_code === 'SM-CAP-125-UD');
          }

          if (!matchedItem) {
            matchedItem = dbItems.find(it => {
              const cleanDbName = it.item_name.replace(/\s+/g, '');
              const cleanDbSpec = (it.spec || '').replace(/\s+/g, '');
              const cleanName = itemName.replace(/\s+/g, '');
              const cleanSpec = spec.replace(/\s+/g, '');

              if (cleanName.includes('소켓') && !cleanName.includes('발포')) return it.item_category === 'SM' && cleanDbName.includes('금속소켓') || cleanDbSpec.includes(cleanSpec);
              if (cleanName.includes('강재') || cleanName.includes('아연도금')) return it.item_category === 'SM' && cleanDbName.includes(cleanSpec);
              
              return cleanDbName.includes(cleanName) && cleanDbSpec.includes(cleanSpec);
            });
          }

          if (matchedItem) {
            const lotNum = `INIT-${today.replace(/-/g, '')}-${matchedItem.item_code}`;
            const existing = insertLots.find(l => l.lot_number === lotNum && l.item_id === matchedItem.item_id);
            if (existing) {
              existing.qty += currentQty;
              existing.remaining_qty += currentQty;
            } else {
              insertLots.push({
                lot_number: lotNum,
                lot_type: 'IN',
                item_id: matchedItem.item_id,
                qty: currentQty,
                remaining_qty: currentQty,
                unit: matchedItem.unit,
                status: 'ACTIVE'
              });
            }
          }
        }
      }
    }

    // ─── C. 소켓 재고 수불표 파싱 ───
    const socketSheet = workbook.Sheets['소켓 재고 수불표'];
    if (socketSheet) {
      console.log('소켓 재고 수불표 파싱 중...');
      const skRange = XLSX.utils.decode_range(socketSheet['!ref'] || 'A1:A1');
      
      // 날짜 헤더(Row 6)가 존재하는 실시간 최종 거래 열 구하기
      let maxCol = 4;
      for (let c = skRange.e.c; c >= 4; c--) {
        const headerCell = socketSheet[XLSX.utils.encode_cell({ r: 6, c })];
        if (headerCell && headerCell.v !== undefined && headerCell.v !== '') {
          maxCol = c;
          break;
        }
      }

      for (let r = 7; r <= skRange.e.r; r += 3) {
        const specCell = socketSheet[XLSX.utils.encode_cell({ r, c: 0 })];
        const typeCell = socketSheet[XLSX.utils.encode_cell({ r: r + 2, c: 3 })];
        
        if (specCell && specCell.v && typeCell && typeCell.v === '재고') {
          const specText = String(specCell.v).trim();
          if (specText.includes('합계') || specText.includes('소계') || specText.includes('총계') || specText.includes('계') || specText === '') {
            continue;
          }
          
          let finalQty = 0;
          const qtyCell = socketSheet[XLSX.utils.encode_cell({ r: r + 2, c: maxCol })];
          if (qtyCell && qtyCell.v !== '' && !isNaN(parseFloat(qtyCell.v))) {
            finalQty = parseFloat(qtyCell.v);
          }

          if (finalQty > 0) {
            const matchedItem = dbItems.find(it => {
              if (it.item_category !== 'FP') return false;
              if (specText.includes('800*550')) return it.item_code === 'FP-VT01';
              if (specText.includes('950*550')) return it.item_code === 'FP-VT064' || it.item_code === 'FP-VT049';
              if (specText.includes('850*550')) return it.item_code === 'FP-VA064';
              if (specText.includes('300*300')) return it.item_code === 'FP-FL-L' || it.item_code === 'FP-FL-I';
              return false;
            });

            if (matchedItem) {
              const lotNum = `INIT-${today.replace(/-/g, '')}-${matchedItem.item_code}`;
              const existing = insertLots.find(l => l.lot_number === lotNum && l.item_id === matchedItem.item_id);
              if (existing) {
                existing.qty += finalQty;
                existing.remaining_qty += finalQty;
              } else {
                insertLots.push({
                  lot_number: lotNum,
                  lot_type: 'IN',
                  item_id: matchedItem.item_id,
                  qty: finalQty,
                  remaining_qty: finalQty,
                  unit: matchedItem.unit,
                  status: 'ACTIVE'
                });
              }
            }
          }
        }
      }
    }

    // ─── D. 에프엔테크 재고 수불표 파싱 ───
    const fnSheet = workbook.Sheets['FN 테크 재고 수불표'];
    if (fnSheet) {
      console.log('FN 테크 재고 수불표 파싱 중...');
      const fnRange = XLSX.utils.decode_range(fnSheet['!ref'] || 'A1:A1');

      // 날짜 헤더(Row 6)가 존재하는 최종 거래 열 구하기 (B열부터 전개되므로 c>=2)
      let maxCol = 2;
      for (let c = fnRange.e.c; c >= 2; c--) {
        const headerCell = fnSheet[XLSX.utils.encode_cell({ r: 6, c })];
        if (headerCell && headerCell.v !== undefined && headerCell.v !== '') {
          maxCol = c;
          break;
        }
      }

      for (let r = 7; r <= fnRange.e.r; r += 3) {
        const itemCell = fnSheet[XLSX.utils.encode_cell({ r, c: 0 })];
        const typeCell = fnSheet[XLSX.utils.encode_cell({ r: r + 2, c: 1 })];

        if (itemCell && itemCell.v && typeCell && typeCell.v === '재고') {
          const itemName = String(itemCell.v).trim();
          if (itemName.includes('합계') || itemName.includes('소계') || itemName.includes('총계') || itemName.includes('계') || itemName === '') {
            continue;
          }

          let finalQty = 0;
          const qtyCell = fnSheet[XLSX.utils.encode_cell({ r: r + 2, c: maxCol })];
          if (qtyCell && qtyCell.v !== '' && !isNaN(parseFloat(qtyCell.v))) {
            finalQty = parseFloat(qtyCell.v);
          }

          if (finalQty > 0) {
            const matchedItem = dbItems.find(it => {
              if (itemName.includes('100A') || itemName.includes('100')) {
                return it.item_code === 'FP-FN-100A' || it.item_code === 'SM-FN';
              }
              if (itemName.includes('75A') || itemName.includes('75')) {
                return it.item_code === 'FP-FN-75A';
              }
              return it.item_code === 'SM-FN';
            });

            if (matchedItem) {
              const lotNum = `INIT-${today.replace(/-/g, '')}-${matchedItem.item_code}`;
              const existing = insertLots.find(l => l.lot_number === lotNum && l.item_id === matchedItem.item_id);
              if (existing) {
                existing.qty += finalQty;
                existing.remaining_qty += finalQty;
              } else {
                insertLots.push({
                  lot_number: lotNum,
                  lot_type: 'IN',
                  item_id: matchedItem.item_id,
                  qty: finalQty,
                  remaining_qty: finalQty,
                  unit: matchedItem.unit,
                  status: 'ACTIVE'
                });
              }
            }
          }
        }
      }
    }

    // ─── E. 플래싱 재고 수불표 파싱 ───
    const flashSheet = workbook.Sheets['플래싱재고수불표'];
    if (flashSheet) {
      console.log('플래싱 재고 수불표 파싱 중...');
      const flRange = XLSX.utils.decode_range(flashSheet['!ref'] || 'A1:A1');

      // 날짜 헤더(Row 6)가 존재하는 최종 거래 열 구하기
      let maxCol = 4;
      for (let c = flRange.e.c; c >= 4; c--) {
        const headerCell = flashSheet[XLSX.utils.encode_cell({ r: 6, c })];
        if (headerCell && headerCell.v !== undefined && headerCell.v !== '') {
          maxCol = c;
          break;
        }
      }

      for (let r = 7; r <= flRange.e.r; r += 3) {
        const specCell = flashSheet[XLSX.utils.encode_cell({ r, c: 0 })];
        const typeCell = flashSheet[XLSX.utils.encode_cell({ r: r + 2, c: 3 })];

        if (specCell && specCell.v && typeCell && typeCell.v === '재고') {
          const specText = String(specCell.v).trim().replace(/\s+/g, '');
          if (specText.includes('합계') || specText.includes('소계') || specText.includes('총계') || specText.includes('계') || specText === '') {
            continue;
          }

          let finalQty = 0;
          const qtyCell = flashSheet[XLSX.utils.encode_cell({ r: r + 2, c: maxCol })];
          if (qtyCell && qtyCell.v !== '' && !isNaN(parseFloat(qtyCell.v))) {
            finalQty = parseFloat(qtyCell.v);
          }

          if (finalQty > 0) {
            let matchedItem = null;
            if (specText.includes('I형') || specText.includes('W125') || specText.includes('5/1000/125')) {
              matchedItem = dbItems.find(it => it.item_code === 'SM-GI-I');
            } else if (specText.includes('Z형') || specText.includes('W170') || specText.includes('Z')) {
              matchedItem = dbItems.find(it => it.item_code === 'SM-GI-Z');
            } else if (specText.includes('차열시트')) {
              matchedItem = dbItems.find(it => it.item_code === 'SA-EXT-5125I' || it.item_code === 'SA-EXT-5125');
            } else if (specText.includes('틈새강판')) {
              matchedItem = dbItems.find(it => it.item_code === 'SM-GP');
            } else if (specText.includes('보호철판')) {
              matchedItem = dbItems.find(it => it.item_code === 'SM-SP');
            }

            if (matchedItem) {
              const lotNum = `INIT-${today.replace(/-/g, '')}-${matchedItem.item_code}`;
              const existing = insertLots.find(l => l.lot_number === lotNum && l.item_id === matchedItem.item_id);
              if (existing) {
                existing.qty += finalQty;
                existing.remaining_qty += finalQty;
              } else {
                insertLots.push({
                  lot_number: lotNum,
                  lot_type: 'IN',
                  item_id: matchedItem.item_id,
                  qty: finalQty,
                  remaining_qty: finalQty,
                  unit: matchedItem.unit,
                  status: 'ACTIVE'
                });
              }
            }
          }
        }
      }
    }

    // ─── F. 배합원자료 수불표 파싱 ───
    const mixMatSheet = workbook.Sheets['배합원자료 수불표'];
    if (mixMatSheet) {
      console.log('배합원자료 수불표 파싱 중...');
      const mixRange = XLSX.utils.decode_range(mixMatSheet['!ref'] || 'A1:A1');

      // 날짜 헤더(Row 6)가 존재하는 최종 거래 열 구하기
      let maxCol = 4;
      for (let c = mixRange.e.c; c >= 4; c--) {
        const headerCell = mixMatSheet[XLSX.utils.encode_cell({ r: 6, c })];
        if (headerCell && headerCell.v !== undefined && headerCell.v !== '') {
          maxCol = c;
          break;
        }
      }

      for (let r = 7; r <= mixRange.e.r; r += 3) {
        const itemCell = mixMatSheet[XLSX.utils.encode_cell({ r, c: 0 })];
        const typeCell = mixMatSheet[XLSX.utils.encode_cell({ r: r + 2, c: 3 })];

        if (itemCell && itemCell.v && typeCell && typeCell.v === '재고') {
          const itemName = String(itemCell.v).trim().replace(/\s+/g, '');
          if (itemName.includes('합계') || itemName.includes('소계') || itemName.includes('총계') || itemName.includes('계') || itemName === '') {
            continue;
          }

          let finalQty = 0;
          const qtyCell = mixMatSheet[XLSX.utils.encode_cell({ r: r + 2, c: maxCol })];
          if (qtyCell && qtyCell.v !== '' && !isNaN(parseFloat(qtyCell.v))) {
            finalQty = parseFloat(qtyCell.v);
          }

          if (finalQty > 0) {
            let matchedItem = null;
            if (itemName.includes('PE3005MB') || itemName.includes('MB')) {
              matchedItem = dbItems.find(it => it.item_code === 'RM-MB');
            } else if (itemName.includes('팽창흑연') || itemName.includes('흑연')) {
              matchedItem = dbItems.find(it => it.item_code === 'RM-EG50');
            } else if (itemName.includes('EP100') || itemName.includes('EP')) {
              matchedItem = dbItems.find(it => it.item_code === 'RM-EP');
            } else if (itemName.includes('EA33045') || itemName.includes('EA')) {
              matchedItem = dbItems.find(it => it.item_code === 'RM-EA');
            }

            if (matchedItem) {
              const lotNum = `INIT-${today.replace(/-/g, '')}-${matchedItem.item_code}`;
              const existing = insertLots.find(l => l.lot_number === lotNum && l.item_id === matchedItem.item_id);
              if (existing) {
                existing.qty += finalQty;
                existing.remaining_qty += finalQty;
              } else {
                insertLots.push({
                  lot_number: lotNum,
                  lot_type: 'IN',
                  item_id: matchedItem.item_id,
                  qty: finalQty,
                  remaining_qty: finalQty,
                  unit: matchedItem.unit,
                  status: 'ACTIVE'
                });
              }
            }
          }
        }
      }
    }

    // ─── G. 데이터베이스 적재 (LOT 및 수불 거래) ───
    const mergedLots = [];
    for (const lot of insertLots) {
      const existing = mergedLots.find(l => l.lot_number === lot.lot_number && l.item_id === lot.item_id);
      if (existing) {
        existing.qty += lot.qty;
        existing.remaining_qty += lot.remaining_qty;
      } else {
        mergedLots.push(lot);
      }
    }

    console.log(`\n데이터 적재 시작 (총 유일 LOT 건수: ${mergedLots.length}개)...`);
    
    let insertedCount = 0;
    for (const lot of mergedLots) {
      const lotRes = await client.query(
        `INSERT INTO lot_transaction (lot_number, lot_type, item_id, qty, remaining_qty, unit, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (lot_number) 
         DO UPDATE SET qty = lot_transaction.qty + EXCLUDED.qty, 
                       remaining_qty = lot_transaction.remaining_qty + EXCLUDED.remaining_qty
         RETURNING lot_id`,
        [lot.lot_number, lot.lot_type, lot.item_id, lot.qty, lot.remaining_qty, lot.unit, lot.status]
      );
      
      const lotId = lotRes.rows[0].lot_id;

      await client.query(
        `INSERT INTO inventory_transaction (item_id, lot_id, txn_type, txn_date, qty, purpose, worker, confirmed_by, created_at)
         VALUES ($1, $2, 'IN', $3, $4, '수불표 기초재고 동기화', 'SYSTEM', 'SYSTEM', NOW())`,
        [lot.item_id, lotId, today, lot.qty]
      );
      insertedCount++;
    }

    await client.query('COMMIT');
    console.log(`\n🎉 성공적으로 ${insertedCount}개의 품목/LOT 재고 정보가 금일(${today}) 기준으로 최신화되었습니다!`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ 재고 동기화 중 오류 발생 및 롤백됨:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
