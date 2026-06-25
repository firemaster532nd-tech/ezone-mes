const { Pool } = require('pg');
const p = new Pool({
  connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

async function verify() {
  // 인수검사와 lot_transaction JOIN 확인 (실제 API와 동일한 쿼리)
  const r = await p.query(`
    SELECT ins.insp_id, ins.insp_type, ins.result, ins.inspected_at,
           lt.lot_number, lt.lot_type, lt.supplier_lot,
           im.item_name, im.item_code
    FROM inspection ins
    LEFT JOIN lot_transaction lt ON ins.lot_id = lt.lot_id
    LEFT JOIN item_master im ON lt.item_id = im.item_id
    ORDER BY ins.insp_id
    LIMIT 20
  `);
  console.log('=== 인수검사 + LOT 번호 확인 ===');
  r.rows.forEach(row => {
    console.log(`  insp_id=${row.insp_id} | lot=${row.lot_number} | 품목=${row.item_name} | 결과=${row.result}`);
  });

  // lot_transaction 전체 C302 형식 확인
  const lots = await p.query(`
    SELECT lot_number,
      CASE
        WHEN lot_number ~ '^[0-9]{6}[A-Z]{2,6}[0-9]{3}$' THEN '✅ C302 원/부자재'
        WHEN lot_number ~ '^[0-9]{6}-S[0-9]{2}$'          THEN '✅ C302 배합'
        WHEN lot_number ~ '^J[0-9]{6}[A-Z]{1,6}[0-9]{2}$' THEN '✅ C302 조립'
        WHEN lot_number ~ '^[0-9]{6}-[A-Z].*-[0-9]+$'     THEN '✅ C302 구조체/배관'
        ELSE '⚠️  비표준'
      END AS format_check
    FROM lot_transaction
    ORDER BY lot_id
  `);
  console.log('\n=== LOT 번호 C302 형식 검증 ===');
  lots.rows.forEach(r => console.log(`  ${r.lot_number.padEnd(25)} ${r.format_check}`));

  const ok = lots.rows.filter(r => r.format_check.startsWith('✅')).length;
  const bad = lots.rows.filter(r => r.format_check.startsWith('⚠️')).length;
  console.log(`\n  합계: ${lots.rows.length}개 (정상: ${ok}개, 비표준: ${bad}개)`);

  p.end();
}
verify().catch(e => { console.error(e.message); p.end(); });
