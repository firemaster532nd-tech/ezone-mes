const pg = require('pg');

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
  ssl: { rejectUnauthorized: false }
});

async function auditAllTables() {
  console.log('================================================================');
  console.log('🔍 [EZONE MES] WMS, 소켓, 조립LOT 전체 테이블 전수조사');
  console.log('================================================================\n');

  // A. non_certified_stock
  const { rows: ncs } = await pool.query(`SELECT id, rack_code, item_name, spec, lot_number, qty, unit, category, wms_status FROM non_certified_stock ORDER BY id`);
  console.log(`📌 A. non_certified_stock (${ncs.length}건):`);
  const ncsNoLot = ncs.filter(x => !x.lot_number);
  const ncsNoSpec = ncs.filter(x => !x.spec);
  console.log(`  - LOT번호 미부여: ${ncsNoLot.length}건`);
  console.log(`  - 규격(spec) 미부여: ${ncsNoSpec.length}건`);
  if (ncs.length > 0) {
    console.log(`  [샘플 5건]:`, ncs.slice(0, 5));
  }
  console.log('\n');

  // B. socket_stock
  const { rows: sock } = await pool.query(`SELECT * FROM socket_stock ORDER BY stock_id LIMIT 50`).catch(() => ({ rows: [] }));
  console.log(`📌 B. socket_stock (${sock.length}건):`);
  if (sock.length > 0) {
    console.log(`  [샘플 5건]:`, sock.slice(0, 5));
  }
  console.log('\n');

  // C. assembly_lot
  const { rows: asm } = await pool.query(`SELECT lot_id, lot_number, lot_type, item_name, qty, status, staging_location FROM assembly_lot ORDER BY lot_id LIMIT 50`).catch(() => ({ rows: [] }));
  console.log(`📌 C. assembly_lot (${asm.length}건):`);
  if (asm.length > 0) {
    console.log(`  [샘플 5건]:`, asm.slice(0, 5));
  }

  process.exit(0);
}

auditAllTables().catch(err => { console.error(err); process.exit(1); });
