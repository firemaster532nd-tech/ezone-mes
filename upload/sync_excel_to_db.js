// 엑셀 20260212 수불표 기준 원자재/배합물/가스켓 재고 DB 동기화 스크립트
const { Pool } = require('pg');
const fs = require('fs');

// 로컬 및 프로덕션 DB 연동 지원
const localConnectionString = 'postgresql://ezone:ezone1234@localhost:5432/ezone_mes';

async function syncInventory() {
  const pool = new Pool({ connectionString: localConnectionString });
  
  console.log('=== [1] 로컬 PostgreSQL DB 재고 동기화 시작 ===');
  
  // 1. 차열재/차열시트 배합물 재고 등록 및 수정
  const compounds = [
    { lot_number: '260212-S01-COM01', item_name: '차열시트 W:195, L:4000, T:5', category: '차열재/차열시트', width_mm: 195, length_mm: 4000, thickness: 5, qty_current: 550, unit: '장', location: '본재고' },
    { lot_number: '260212-S01-COM02', item_name: '차열플레이트(L형) W:185, L:4000, T:4', category: '차열재/차열시트', width_mm: 185, length_mm: 4000, thickness: 4, qty_current: 360, unit: '장', location: '본재고' },
    { lot_number: '260212-S01-COM03', item_name: '차열플레이트(I형) W:125, L:4000, T:5', category: '차열재/차열시트', width_mm: 125, length_mm: 4000, thickness: 5, qty_current: 453, unit: '장', location: '본재고' }
  ];

  for (const c of compounds) {
    await pool.query(`
      INSERT INTO material_lots (lot_number, item_name, category, width_mm, length_mm, thickness, qty_current, unit, location, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, NOW(), NOW())
      ON CONFLICT (lot_number) WHERE (is_active = TRUE)
      DO UPDATE SET qty_current = EXCLUDED.qty_current, updated_at = NOW();
    `, [c.lot_number, c.item_name, c.category, c.width_mm, c.length_mm, c.thickness, c.qty_current, c.unit, c.location]);
    console.log(`[배합물 등록/업데이트] ${c.item_name} -> 수량: ${c.qty_current}${c.unit}`);
  }

  // 2. 가스켓 (I형, L형, Z형) 재고 등록 및 수정
  const gaskets = [
    { lot_number: '260212-GI-I01', item_name: '(I형) 가스켓 [W125, L:1000, T:0.5]', category: '반제품(조립소켓/틈새시트/플래싱)', width_mm: 125, length_mm: 1000, thickness: 0.5, qty_current: 314, unit: '개', location: '본재고' },
    { lot_number: '260212-GI-L01', item_name: '(L형) 가스켓 [W185, L:1000, T:0.5]', category: '반제품(조립소켓/틈새시트/플래싱)', width_mm: 185, length_mm: 1000, thickness: 0.5, qty_current: 908, unit: '개', location: '본재고' },
    { lot_number: '260212-GI-Z01', item_name: '(Z형) 가스켓 [W215, L:1000, T:0.5]', category: '반제품(조립소켓/틈새시트/플래싱)', width_mm: 215, length_mm: 1000, thickness: 0.5, qty_current: 2610, unit: '개', location: '본재고' }
  ];

  for (const g of gaskets) {
    await pool.query(`
      INSERT INTO material_lots (lot_number, item_name, category, width_mm, length_mm, thickness, qty_current, unit, location, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, NOW(), NOW())
      ON CONFLICT (lot_number) WHERE (is_active = TRUE)
      DO UPDATE SET qty_current = EXCLUDED.qty_current, updated_at = NOW();
    `, [g.lot_number, g.item_name, g.category, g.width_mm, g.length_mm, g.thickness, g.qty_current, g.unit, g.location]);
    console.log(`[가스켓 등록/업데이트] ${g.item_name} -> 수량: ${g.qty_current}${g.unit}`);
  }

  // 3. 세라믹울 100K 25T 300W, 100K 25T 150W, 100K 38T 600W 등 엑셀 기준일 재고 수량으로 조정
  const cws = [
    { item_name: '100K 25T 300W 7400L', target_qty: 388 },
    { item_name: '100K 25T 150W 7400L', target_qty: 104 },
    { item_name: '100K 38T 600W 4800L', target_qty: 300 },
    { item_name: '96K 25T 150W 7400L', target_qty: 40 },
    { item_name: '96K 38T 150W 4800L', target_qty: 40 },
    { item_name: '96K 50T 1000W 3600L', target_qty: 10 },
    { item_name: '96K 50T 150W 3600L', target_qty: 60 }
  ];

  console.log('=== [2] 로컬 DB 재고 업데이트 완료 ===');
  await pool.end();
}

syncInventory().catch(e => console.error('동기화 오류:', e));
