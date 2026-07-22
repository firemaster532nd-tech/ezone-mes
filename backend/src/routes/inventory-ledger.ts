import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';
import XLSX from 'xlsx';


export async function inventoryLedgerRoutes(app: FastifyInstance) {
  
  // GET /api/inventory/ledger ─ 월별/날짜별 입출고 수불대장 조회
  app.get('/api/inventory/ledger', { preHandler: requireAuth }, async (req, reply) => {
    const query = req.query as {
      from?: string;
      to?: string;
      item_id?: string;
      lot_number?: string;
      search?: string;
    };

    // 오늘 날짜 및 금월 1일 기본값 설정
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const firstDayOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const fromDate = query.from || firstDayOfMonth;
    const toDate = query.to || today;
    const itemId = query.item_id ? parseInt(query.item_id, 10) : null;
    const lotNumber = query.lot_number ? `%${query.lot_number.trim()}%` : null;
    const search = query.search ? `%${query.search.trim()}%` : null;

    try {
      // 1. 기간 이전 이월(기초) 재고 집계
      // (조회 조건인 품목 필터링이 있다면 해당 품목에 대해서만 계산)
      let openingBalanceQuery = `
        SELECT it.item_id, 
               COALESCE(SUM(CASE WHEN it.txn_type = 'IN' THEN it.qty 
                                 WHEN it.txn_type IN ('OUT', 'LOSS') THEN -it.qty 
                                 ELSE it.qty END), 0) AS opening_qty
        FROM inventory_transaction it
        LEFT JOIN lot_transaction lt ON lt.lot_id = it.lot_id
        LEFT JOIN item_master im ON im.item_id = it.item_id
        WHERE it.txn_date < $1
      `;
      const openingParams: any[] = [fromDate];
      let opIdx = 2;

      if (itemId) {
        openingBalanceQuery += ` AND it.item_id = $${opIdx++}`;
        openingParams.push(itemId);
      }
      if (lotNumber) {
        openingBalanceQuery += ` AND lt.lot_number LIKE $${opIdx++}`;
        openingParams.push(lotNumber);
      }
      if (search) {
        openingBalanceQuery += ` AND (im.item_name LIKE $${opIdx} OR im.item_code LIKE $${opIdx})`;
        openingParams.push(search);
      }
      openingBalanceQuery += ` GROUP BY it.item_id`;

      const { rows: openingRows } = await pool.query(openingBalanceQuery, openingParams);
      const openingMap = new Map<number, number>();
      openingRows.forEach(r => openingMap.set(r.item_id, parseFloat(r.opening_qty)));

      // 2. 기간 내 입출고 거래 상세 리스트
      let detailsQuery = `
        SELECT it.inv_id AS txn_id, it.txn_date, it.txn_type, it.qty, it.purpose, it.worker, it.created_at,
               im.item_id, im.item_code, im.item_name, im.spec, im.unit, im.item_category,
               lt.lot_id, lt.lot_number
        FROM inventory_transaction it
        JOIN item_master im ON im.item_id = it.item_id
        LEFT JOIN lot_transaction lt ON lt.lot_id = it.lot_id
        WHERE it.txn_date BETWEEN $1 AND $2
      `;
      const detailsParams: any[] = [fromDate, toDate];
      let detIdx = 3;

      if (itemId) {
        detailsQuery += ` AND it.item_id = $${detIdx++}`;
        detailsParams.push(itemId);
      }
      if (lotNumber) {
        detailsQuery += ` AND lt.lot_number LIKE $${detIdx++}`;
        detailsParams.push(lotNumber);
      }
      if (search) {
        detailsQuery += ` AND (im.item_name LIKE $${detIdx} OR im.item_code LIKE $${detIdx})`;
        detailsParams.push(search);
      }
      detailsQuery += ` ORDER BY it.txn_date ASC, it.created_at ASC`;

      const { rows: detailRows } = await pool.query(detailsQuery, detailsParams);

      // 3. 거래 내역에 따른 누적 재고(Balance) 계산 및 결과 반환
      // 품목별로 루프를 돌면서 이월재고(opening)에 입출고 수량을 가감하여 매 거래 시점의 잔량을 계산
      const runningBalance = new Map<number, number>();
      openingMap.forEach((qty, id) => runningBalance.set(id, qty));

      const itemsLedger = detailRows.map(row => {
        const id = row.item_id;
        const currentOp = runningBalance.get(id) || 0;
        let newBalance = currentOp;

        if (row.txn_type === 'IN') {
          newBalance += parseFloat(row.qty);
        } else if (row.txn_type === 'OUT' || row.txn_type === 'LOSS') {
          newBalance -= parseFloat(row.qty);
        }

        runningBalance.set(id, newBalance);

        return {
          ...row,
          qty: parseFloat(row.qty),
          opening_qty: currentOp,
          balance: newBalance
        };
      });

      // 전체 품목 목록 조회 (필터링 및 요약용)
      const { rows: itemsList } = await pool.query(
        `SELECT item_id, item_code, item_name, spec, item_category, unit FROM item_master WHERE is_active = true ORDER BY item_name`
      );

      // ─── A. 자재수불합계 스타일 품목별 요약 목록 생성 ───
      const summaryLedger = itemsList.map(item => {
        const id = item.item_id;
        const opening = openingMap.get(id) || 0;
        
        // 기간 내 입/출고 합산
        const itemTxns = itemsLedger.filter(l => l.item_id === id);
        const incoming = itemTxns.filter(t => t.txn_type === 'IN').reduce((sum, t) => sum + t.qty, 0);
        const outgoing = itemTxns.filter(t => t.txn_type === 'OUT' || t.txn_type === 'LOSS').reduce((sum, t) => sum + t.qty, 0);
        const balance = opening + incoming - outgoing;

        return {
          item_id: id,
          item_code: item.item_code,
          item_name: item.item_name,
          spec: item.spec,
          unit: item.unit,
          item_category: item.item_category,
          opening_qty: opening,
          incoming_qty: incoming,
          outgoing_qty: outgoing,
          balance: balance
        };
      }).filter(item => item.opening_qty !== 0 || item.incoming_qty !== 0 || item.outgoing_qty !== 0 || item.balance !== 0); // 거래가 있거나 재고가 있는 건만 포함

      // ─── B. 일자별 수불 흐름 매트릭스 생성 ───
      // 조회 기간 내의 일자별 날짜 리스트 생성
      const dateList: string[] = [];
      let curr = new Date(fromDate);
      const stopDate = new Date(toDate);
      while (curr <= stopDate) {
        dateList.push(curr.toISOString().slice(0, 10));
        curr.setDate(curr.getDate() + 1);
      }

      // 특정 품목이 선택되었을 때만 일별 입출고 추이 매트릭스 계산
      let matrix = null;
      if (itemId && dateList.length > 0) {
        const itemSummary = summaryLedger.find(s => s.item_id === itemId);
        let currentBalance = itemSummary ? itemSummary.opening_qty : 0;
        
        const inRow: number[] = [];
        const outRow: number[] = [];
        const balRow: number[] = [];

        for (const d of dateList) {
          const dayTxns = itemsLedger.filter(l => l.item_id === itemId && l.txn_date === d);
          const dayIn = dayTxns.filter(t => t.txn_type === 'IN').reduce((sum, t) => sum + t.qty, 0);
          const dayOut = dayTxns.filter(t => t.txn_type === 'OUT' || t.txn_type === 'LOSS').reduce((sum, t) => sum + t.qty, 0);
          
          currentBalance = currentBalance + dayIn - dayOut;

          inRow.push(dayIn);
          outRow.push(dayOut);
          balRow.push(currentBalance);
        }

        matrix = {
          dates: dateList,
          rows: [
            { type: '입고', data: inRow },
            { type: '출고', data: outRow },
            { type: '재고', data: balRow }
          ]
        };
      }

      return {
        ok: true,
        ledger: itemsLedger,
        summaryLedger,
        matrix,
        itemsList,
        summary: {
          fromDate,
          toDate,
          total_transactions: itemsLedger.length,
          total_in: itemsLedger.filter(l => l.txn_type === 'IN').reduce((acc, curr) => acc + curr.qty, 0),
          total_out: itemsLedger.filter(l => l.txn_type === 'OUT').reduce((acc, curr) => acc + curr.qty, 0),
          total_loss: itemsLedger.filter(l => l.txn_type === 'LOSS').reduce((acc, curr) => acc + curr.qty, 0),
        }
      };


    } catch (err) {
      console.error('수불대장 조회 에러:', err);
      return reply.code(500).send({ error: 'database_error', message: String(err) });
    }
  });

  // GET /api/inventory/sync-sheets ─ 구글 스프레드시트 최신 재고 동기화 (Vercel Cron 연동)
  app.get('/api/inventory/sync-sheets', async (req, reply) => {
    console.log('[크론] 구글 스프레드시트 재고 동기화 시작...');
    const sheetUrl = 'https://docs.google.com/spreadsheets/d/1dUrjgHuUFRr0I6yi5EGYYdHH2AWCz2PRfEVPPX_51vg/export?format=xlsx';
    
    const explicitMappings: Record<string, string> = {
      '128/25/200/7400': 'SM-CW-252007400',
      '96/50/600/3600': 'SM-CW-96-50',
      '100/50/600/3600': 'SM-CW-506003600',
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

    const todayStr = new Date().toISOString().slice(0, 10);
    const client = await pool.connect();

    try {
      // 1. 구글 스프레드시트 버퍼 다운로드
      const response = await fetch(sheetUrl);
      if (!response.ok) {
        throw new Error(`Google Sheets fetch failed: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 2. XLSX 로딩
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      await client.query('BEGIN');

      // 3. 미등록 품목 자동 생성
      for (const newItem of pendingNewItems) {
        await client.query(
          `INSERT INTO item_master (item_code, item_name, spec, item_category, unit, is_active)
           VALUES ($1, $2, $3, $4, $5, true)
           ON CONFLICT (item_code) DO UPDATE 
           SET item_name = EXCLUDED.item_name, spec = EXCLUDED.spec`,
          [newItem.item_code, newItem.item_name, newItem.spec, newItem.item_category, newItem.unit]
        );
      }

      // 4. DB 활성 품목 로드
      const { rows: dbItems } = await client.query(
        `SELECT item_id, item_code, item_name, spec, item_category, unit FROM item_master WHERE is_active = true`
      );

      // 5. 기존 재고 테이블 백업 및 초기화
      await client.query(`CREATE TABLE IF NOT EXISTS inventory_transaction_backup AS SELECT * FROM inventory_transaction`);
      await client.query(`CREATE TABLE IF NOT EXISTS lot_transaction_backup AS SELECT * FROM lot_transaction`);
      await client.query('TRUNCATE TABLE inventory_transaction CASCADE');
      await client.query('TRUNCATE TABLE lot_transaction CASCADE');

      const insertLots: any[] = [];

      // ─── A-1. 차열재 (세라믹울) LOT별 재고 파싱 ───
      const lotSheet = workbook.Sheets['차열재재고LOT'];
      if (lotSheet) {
        const lotRange = XLSX.utils.decode_range(lotSheet['!ref'] || 'A1:A1');
        const colSpecs: Record<number, string> = {};
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

          for (let r = 3; r <= 15; r++) {
            const lotCell = lotSheet[XLSX.utils.encode_cell({ r, c })];
            const qtyCell = lotSheet[XLSX.utils.encode_cell({ r, c: c + 1 })];
            if (lotCell && lotCell.v && qtyCell && qtyCell.v !== '') {
              const lotNum = String(lotCell.v).trim();
              if (lotNum.includes('합계') || lotNum.includes('소계') || lotNum.includes('총계') || lotNum.includes('계') || lotNum === '합산' || lotNum === '') {
                continue;
              }
              const qty = parseFloat(qtyCell.v);
              if (qty > 0) {
                insertLots.push({ lot_number: lotNum, lot_type: 'IN', item_id: matchedItem.item_id, qty, remaining_qty: qty, unit: matchedItem.unit, status: 'ACTIVE' });
              }
            }
          }
        }

        // ─── A-2. 국산 그라스울 LOT별 재고 파싱 ───
        const gwColSpecs: Record<number, string> = {};
        for (let c = 1; c <= lotRange.e.c; c++) {
          const specCell = lotSheet[XLSX.utils.encode_cell({ r: 18, c })];
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

          for (let r = 19; r <= 23; r++) {
            const lotCell = lotSheet[XLSX.utils.encode_cell({ r, c })];
            const qtyCell = lotSheet[XLSX.utils.encode_cell({ r, c: c + 1 })];
            if (lotCell && lotCell.v && qtyCell && qtyCell.v !== '') {
              const lotNum = String(lotCell.v).trim();
              if (lotNum.includes('합계') || lotNum.includes('소계') || lotNum.includes('총계') || lotNum.includes('계') || lotNum === '합산' || lotNum === '') {
                continue;
              }
              const qty = parseFloat(qtyCell.v);
              if (qty > 0) {
                insertLots.push({ lot_number: lotNum, lot_type: 'IN', item_id: matchedItem.item_id, qty, remaining_qty: qty, unit: matchedItem.unit, status: 'ACTIVE' });
              }
            }
          }
        }
      }

      // ─── B. 자재수불합계 시트 파싱 ───
      const summarySheet = workbook.Sheets['자재수불합계'];
      if (summarySheet) {
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
            if (itemName.includes('합계') || itemName.includes('소계') || itemName.includes('총계') || itemName.includes('계') || spec.includes('합계') || spec.includes('소계') || spec.includes('총계') || spec.includes('계') || itemName === '') {
              continue;
            }
            if (itemName.includes('차열재') || itemName.includes('세라믹울') || itemName.includes('그라스울') || itemName.includes('글라스울')) {
              continue;
            }

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
              const lotNum = `INIT-${todayStr.replace(/-/g, '')}-${matchedItem.item_code}`;
              const existing = insertLots.find(l => l.lot_number === lotNum && l.item_id === matchedItem.item_id);
              if (existing) {
                existing.qty += currentQty;
                existing.remaining_qty += currentQty;
              } else {
                insertLots.push({ lot_number: lotNum, lot_type: 'IN', item_id: matchedItem.item_id, qty: currentQty, remaining_qty: currentQty, unit: matchedItem.unit, status: 'ACTIVE' });
              }
            }
          }
        }
      }

      // ─── C. 소켓 재고 수불표 파싱 ───
      const socketSheet = workbook.Sheets['소켓 재고 수불표'];
      if (socketSheet) {
        const skRange = XLSX.utils.decode_range(socketSheet['!ref'] || 'A1:A1');
        for (let r = 7; r <= skRange.e.r; r += 3) {
          const specCell = socketSheet[XLSX.utils.encode_cell({ r, c: 0 })];
          const typeCell = socketSheet[XLSX.utils.encode_cell({ r: r + 2, c: 3 })];
          if (specCell && specCell.v && typeCell && typeCell.v === '재고') {
            const specText = String(specCell.v).trim();
            if (specText.includes('합계') || specText.includes('소계') || specText.includes('총계') || specText.includes('계') || specText === '') {
              continue;
            }

            let finalQty = 0;
            for (let c = skRange.e.c; c >= 4; c--) {
              const qtyCell = socketSheet[XLSX.utils.encode_cell({ r: r + 2, c })];
              if (qtyCell && qtyCell.v !== '' && !isNaN(parseFloat(qtyCell.v))) {
                finalQty = parseFloat(qtyCell.v);
                break;
              }
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
                const lotNum = `INIT-${todayStr.replace(/-/g, '')}-${matchedItem.item_code}`;
                const existing = insertLots.find(l => l.lot_number === lotNum && l.item_id === matchedItem.item_id);
                if (existing) {
                  existing.qty += finalQty;
                  existing.remaining_qty += finalQty;
                } else {
                  insertLots.push({ lot_number: lotNum, lot_type: 'IN', item_id: matchedItem.item_id, qty: finalQty, remaining_qty: finalQty, unit: matchedItem.unit, status: 'ACTIVE' });
                }
              }
            }
          }
        }
      }

      // ─── D. 에프엔테크 재고 수불표 파싱 ───
      const fnSheet = workbook.Sheets['FN 테크 재고 수불표'];
      if (fnSheet) {
        const fnRange = XLSX.utils.decode_range(fnSheet['!ref'] || 'A1:A1');
        for (let r = 7; r <= fnRange.e.r; r += 3) {
          const itemCell = fnSheet[XLSX.utils.encode_cell({ r, c: 0 })];
          const typeCell = fnSheet[XLSX.utils.encode_cell({ r: r + 2, c: 1 })];
          if (itemCell && itemCell.v && typeCell && typeCell.v === '재고') {
            const itemName = String(itemCell.v).trim();
            if (itemName.includes('합계') || itemName.includes('소계') || itemName.includes('총계') || itemName.includes('계') || itemName === '') {
              continue;
            }

            let finalQty = 0;
            for (let c = fnRange.e.c; c >= 2; c--) {
              const qtyCell = fnSheet[XLSX.utils.encode_cell({ r: r + 2, c })];
              if (qtyCell && qtyCell.v !== '' && !isNaN(parseFloat(qtyCell.v))) {
                finalQty = parseFloat(qtyCell.v);
                break;
              }
            }

            if (finalQty > 0) {
              const matchedItem = dbItems.find(it => {
                if (itemName.includes('100A') || itemName.includes('100')) return it.item_code === 'FP-FN-100A' || it.item_code === 'SM-FN';
                if (itemName.includes('75A') || itemName.includes('75')) return it.item_code === 'FP-FN-75A';
                return it.item_code === 'SM-FN';
              });

              if (matchedItem) {
                const lotNum = `INIT-${todayStr.replace(/-/g, '')}-${matchedItem.item_code}`;
                const existing = insertLots.find(l => l.lot_number === lotNum && l.item_id === matchedItem.item_id);
                if (existing) {
                  existing.qty += finalQty;
                  existing.remaining_qty += finalQty;
                } else {
                  insertLots.push({ lot_number: lotNum, lot_type: 'IN', item_id: matchedItem.item_id, qty: finalQty, remaining_qty: finalQty, unit: matchedItem.unit, status: 'ACTIVE' });
                }
              }
            }
          }
        }
      }

      // ─── E. 플래싱 재고 수불표 파싱 ───
      const flashSheet = workbook.Sheets['플래싱재고수불표'];
      if (flashSheet) {
        const flRange = XLSX.utils.decode_range(flashSheet['!ref'] || 'A1:A1');
        for (let r = 7; r <= flRange.e.r; r += 3) {
          const specCell = flashSheet[XLSX.utils.encode_cell({ r, c: 0 })];
          const typeCell = flashSheet[XLSX.utils.encode_cell({ r: r + 2, c: 3 })];
          if (specCell && specCell.v && typeCell && typeCell.v === '재고') {
            const specText = String(specCell.v).trim().replace(/\s+/g, '');
            if (specText.includes('합계') || specText.includes('소계') || specText.includes('총계') || specText.includes('계') || specText === '') {
              continue;
            }

            let finalQty = 0;
            for (let c = flRange.e.c; c >= 4; c--) {
              const qtyCell = flashSheet[XLSX.utils.encode_cell({ r: r + 2, c })];
              if (qtyCell && qtyCell.v !== '' && !isNaN(parseFloat(qtyCell.v))) {
                finalQty = parseFloat(qtyCell.v);
                break;
              }
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
                const lotNum = `INIT-${todayStr.replace(/-/g, '')}-${matchedItem.item_code}`;
                const existing = insertLots.find(l => l.lot_number === lotNum && l.item_id === matchedItem.item_id);
                if (existing) {
                  existing.qty += finalQty;
                  existing.remaining_qty += finalQty;
                } else {
                  insertLots.push({ lot_number: lotNum, lot_type: 'IN', item_id: matchedItem.item_id, qty: finalQty, remaining_qty: finalQty, unit: matchedItem.unit, status: 'ACTIVE' });
                }
              }
            }
          }
        }
      }

      // ─── F. 배합원자료 수불표 파싱 ───
      const mixMatSheet = workbook.Sheets['배합원자료 수불표'];
      if (mixMatSheet) {
        const mixRange = XLSX.utils.decode_range(mixMatSheet['!ref'] || 'A1:A1');
        for (let r = 7; r <= mixRange.e.r; r += 3) {
          const itemCell = mixMatSheet[XLSX.utils.encode_cell({ r, c: 0 })];
          const typeCell = mixMatSheet[XLSX.utils.encode_cell({ r: r + 2, c: 3 })];
          if (itemCell && itemCell.v && typeCell && typeCell.v === '재고') {
            const itemName = String(itemCell.v).trim().replace(/\s+/g, '');
            if (itemName.includes('합계') || itemName.includes('소계') || itemName.includes('총계') || itemName.includes('계') || itemName === '') {
              continue;
            }

            let finalQty = 0;
            for (let c = mixRange.e.c; c >= 4; c--) {
              const qtyCell = mixMatSheet[XLSX.utils.encode_cell({ r: r + 2, c })];
              if (qtyCell && qtyCell.v !== '' && !isNaN(parseFloat(qtyCell.v))) {
                finalQty = parseFloat(qtyCell.v);
                break;
              }
            }

            if (finalQty > 0) {
              let matchedItem = null;
              if (itemName.includes('PE3005MB') || itemName.includes('MB')) matchedItem = dbItems.find(it => it.item_code === 'RM-MB');
              else if (itemName.includes('팽창흑연') || itemName.includes('흑연')) matchedItem = dbItems.find(it => it.item_code === 'RM-EG50');
              else if (itemName.includes('EP100') || itemName.includes('EP')) matchedItem = dbItems.find(it => it.item_code === 'RM-EP');
              else if (itemName.includes('EA33045') || itemName.includes('EA')) matchedItem = dbItems.find(it => it.item_code === 'RM-EA');

              if (matchedItem) {
                const lotNum = `INIT-${todayStr.replace(/-/g, '')}-${matchedItem.item_code}`;
                const existing = insertLots.find(l => l.lot_number === lotNum && l.item_id === matchedItem.item_id);
                if (existing) {
                  existing.qty += finalQty;
                  existing.remaining_qty += finalQty;
                } else {
                  insertLots.push({ lot_number: lotNum, lot_type: 'IN', item_id: matchedItem.item_id, qty: finalQty, remaining_qty: finalQty, unit: matchedItem.unit, status: 'ACTIVE' });
                }
              }
            }
          }
        }
      }

      // ─── H. 데이터베이스 적재 (LOT 및 수불 거래) ───
      const mergedLots: any[] = [];
      for (const lot of insertLots) {
        const existing = mergedLots.find(l => l.lot_number === lot.lot_number && l.item_id === lot.item_id);
        if (existing) {
          existing.qty += lot.qty;
          existing.remaining_qty += lot.remaining_qty;
        } else {
          mergedLots.push(lot);
        }
      }

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
           VALUES ($1, $2, 'IN', $3, $4, '구글시트 자동 동기화', 'SYSTEM', 'SYSTEM', NOW())`,
          [lot.item_id, lotId, todayStr, lot.qty]
        );
        insertedCount++;
      }

      await client.query('COMMIT');
      client.release();
      console.log(`[크론] 동기화 성공: ${insertedCount}개 로트 최신화 완료.`);
      return reply.send({ ok: true, message: `Successfully synchronized ${insertedCount} stock lots from Google Sheets.` });

    } catch (err) {
      await client.query('ROLLBACK');
      client.release();
      console.error('[크론] 동기화 에러:', err);
      return reply.code(500).send({ error: 'sync_error', message: String(err) });
    }
  });
}

