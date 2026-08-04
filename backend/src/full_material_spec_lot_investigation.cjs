const pg = require('pg');

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
  ssl: { rejectUnauthorized: false }
});

async function fullInvestigation() {
  console.log('================================================================');
  console.log('🔍 [EZONE MES] 원부자재 규격 및 LOT 부여 전수조사 보고서');
  console.log('================================================================\n');

  // 1. material_lots 전수조사
  const { rows: lots } = await pool.query(`
    SELECT lot_id, lot_number, category, item_name, density, thickness, width_mm, length_mm, unit, qty_current, location, stock_type, created_at
    FROM material_lots
    ORDER BY category, lot_number
  `);

  console.log(`📌 1. material_lots 테이블 전체 ${lots.length}개 LOT 검수 결과:\n`);

  const issues = [];
  const specMismatch = [];
  const invalidLotFormat = [];

  for (const l of lots) {
    const logInfo = `ID:${l.lot_id} | LOT:${l.lot_number} | 카테고리:${l.category} | 품목명:${l.item_name} | 규격(K/T/W/L): ${l.density || '-'}K ${l.thickness || '-'}T ${l.width_mm || '-'}W ${l.length_mm || '-'}L | 재고:${l.qty_current}${l.unit} | 구분:${l.stock_type}`;

    // A. 품목명에서 추출된 숫자 규격과 DB 컬럼 수치 비교
    const densityMatch = (l.item_name || '').match(/(\d+)K/i);
    const thicknessMatch = (l.item_name || '').match(/(\d+)T/i);
    const widthMatch = (l.item_name || '').match(/(\d+)W/i);
    const lengthMatch = (l.item_name || '').match(/(\d+)L/i);

    let hasConflict = false;
    let conflictDetail = [];

    if (densityMatch && l.density && Number(densityMatch[1]) !== Number(l.density)) {
      hasConflict = true;
      conflictDetail.push(`밀도불일치(품목명:${densityMatch[1]}K vs DB:${l.density}K)`);
    }
    if (thicknessMatch && l.thickness && Number(thicknessMatch[1]) !== Number(l.thickness)) {
      hasConflict = true;
      conflictDetail.push(`두께불일치(품목명:${thicknessMatch[1]}T vs DB:${l.thickness}T)`);
    }
    if (widthMatch && l.width_mm && Number(widthMatch[1]) !== Number(l.width_mm)) {
      hasConflict = true;
      conflictDetail.push(`폭불일치(품목명:${widthMatch[1]}W vs DB:${l.width_mm}W)`);
    }
    if (lengthMatch && l.length_mm && Number(lengthMatch[1]) !== Number(l.length_mm)) {
      hasConflict = true;
      conflictDetail.push(`길이불일치(품목명:${lengthMatch[1]}L vs DB:${l.length_mm}L)`);
    }

    if (hasConflict) {
      specMismatch.push({ ...l, conflictDetail });
    }

    // B. 사규 C302 LOT 채번 규칙 검증 (YYMMDD + 약호 + 순번)
    // CW(세라믹울), GW(그라스울), GWB(그라스울보드), MB(컴파운드), EP(EP100), GR(흑연), EA(EA33045)
    const validPattern = /^(R|RR)?\d{6}(CW|GW|GWB|MB|EP|GR|EA|GI|S|EXT|D|FI|FZ|FL)\d{3}/i;
    if (!validPattern.test(l.lot_number)) {
      invalidLotFormat.push(l);
    }
  }

  console.log(`----------------------------------------------------------------`);
  console.log(`⚠️ A. 품목명 ↔ DB 컬럼 규격 불일치건: ${specMismatch.length}건`);
  console.log(`----------------------------------------------------------------`);
  if (specMismatch.length === 0) {
    console.log(`  ✅ 규격 수치 불일치 0건 (모든 LOT의 품목명 규격과 DB 컬럼 수치가 100% 일치합니다)\n`);
  } else {
    for (const s of specMismatch) {
      console.log(`  ❌ [LOT: ${s.lot_number}] 품목:${s.item_name} | 사유: ${s.conflictDetail.join(', ')}`);
    }
    console.log('\n');
  }

  console.log(`----------------------------------------------------------------`);
  console.log(`⚠️ B. 사규 C302 표준 규격 이탈/특수 LOT 번호: ${invalidLotFormat.length}건`);
  console.log(`----------------------------------------------------------------`);
  if (invalidLotFormat.length === 0) {
    console.log(`  ✅ LOT 채번 형식 오류 0건\n`);
  } else {
    for (const f of invalidLotFormat) {
      console.log(`  ⚠️ [ID:${f.lot_id}] LOT:${f.lot_number} | 품목:${f.item_name} | 카테고리:${f.category} | 위치:${f.location}`);
    }
    console.log('\n');
  }

  // 2. 카테고리별 요약 통계
  const catSummary = {};
  for (const l of lots) {
    const c = l.category || '미분류';
    if (!catSummary[c]) catSummary[c] = { count: 0, totalQty: 0, unit: l.unit, certified: 0, audit: 0, nonCert: 0 };
    catSummary[c].count++;
    catSummary[c].totalQty += Number(l.qty_current || 0);
    if (l.stock_type === 'CERTIFIED_AUDIT') catSummary[c].audit++;
    else if (l.stock_type === 'NON_CERTIFIED') catSummary[c].nonCert++;
    else catSummary[c].certified++;
  }

  console.log(`================================================================`);
  console.log(`📊 2. DB 카테고리별 재고 전수 집계 현황`);
  console.log(`================================================================`);
  console.table(catSummary);

  process.exit(0);
}

fullInvestigation().catch(err => { console.error(err); process.exit(1); });
