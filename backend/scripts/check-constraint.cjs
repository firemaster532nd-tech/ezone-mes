const { Pool } = require('pg');
const p = new Pool({
  connectionString: 'postgresql://postgres.ajncesrkhlusqginyscw:Ezone0300%40%40%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

p.query(`
  SELECT check_clause
  FROM information_schema.check_constraints
  WHERE constraint_name = 'lot_transaction_lot_type_check'
`).then(r => {
  console.log('lot_type CHECK 제약:');
  r.rows.forEach(x => console.log(x.check_clause));
  p.end();
}).catch(e => { console.error(e.message); p.end(); });
