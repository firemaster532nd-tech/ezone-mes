import { pool } from './db/pool.js';

async function testDashboardSql() {
  const pOrders = await pool.query(`
    SELECT 
      po.po_id,
      COALESCE(NULLIF(po.project_name, ''), NULLIF(pm.project_name, ''), '일반 현장 수주') AS project_name,
      COALESCE(NULLIF(po.submitter, ''), NULLIF(po.contractor, ''), NULLIF(pm.customer_name, ''), '이지원 MES 발주처') AS customer_name,
      COALESCE(po.order_date::text, po.created_at::date::text) AS order_date,
      COALESCE(po.delivery_date::text, '상시출하') AS delivery_date,
      COALESCE((SELECT COUNT(*) FROM purchase_order_item WHERE po_id = po.po_id)::int, 0) AS total_items,
      COALESCE((SELECT SUM(qty) FROM purchase_order_item WHERE po_id = po.po_id)::numeric, 0) AS total_qty,
      COALESCE(po.status, 'ACTIVE') AS status
    FROM purchase_order po
    LEFT JOIN project_master pm ON po.project_id = pm.project_id
    WHERE po.status != 'DELETED'
    ORDER BY po.po_id DESC LIMIT 10
  `);

  console.log('=== REAL SITE PURCHASE ORDERS (SELECT FROM purchase_order): ===');
  console.table(pOrders.rows);
  await pool.end();
}

testDashboardSql().catch(console.error);
