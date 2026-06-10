import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { env } from './config/env.js';
import { certificationRoutes } from './routes/certifications.js';
import { itemRoutes } from './routes/items.js';
import { workOrderRoutes } from './routes/work-orders.js';
import { lotRoutes } from './routes/lots.js';
import { inventoryRoutes } from './routes/inventory.js';
import { inspectionRoutes } from './routes/inspections.js';
import { selfInspectionRoutes } from './routes/self-inspections.js';
import { processInspectionRoutes } from './routes/process-inspections.js';
import { certCheckRoutes } from './routes/cert-check.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { shipmentRoutes } from './routes/shipments.js';
import { qualityReportRoutes } from './routes/quality-reports.js';
import { attachmentRoutes } from './routes/attachments.js';
import { backupRoutes } from './routes/backup.js';
import { lotValidationRoutes } from './routes/lot-validation.js';
import { structureLotRoutes } from './routes/structure-lots.js';
import { tbmRoutes } from './routes/tbm.js';
import { workerRoutes } from './routes/workers.js';
import { processExecutionRoutes } from './routes/process-execution.js';
import { productionStatsRoutes } from './routes/production-stats.js';
import { approvalRoutes } from './routes/approvals.js';
import { reportRoutes } from './routes/reports.js';
import { compoundingRoutes } from './routes/compounding.js';
import { processBomRoutes } from './routes/process-bom.js';
import { defectRoutes } from './routes/defects.js';
import { lossAnalyticsRoutes } from './routes/loss-analytics.js';
import { lotPropertiesRoutes } from './routes/lot-properties.js';
import { inventoryClosingRoutes } from './routes/inventory-closing.js';
import { complianceRoutes } from './routes/compliance.js';
import { orderRoutes } from './routes/orders.js';
import { certDocumentRoutes } from './routes/cert-documents.js';
import { structureBomRoutes } from './routes/structure-bom.js';
import { authRoutes } from './routes/auth.js';
import { departmentRoutes } from './routes/departments.js';
import { permissionRoutes } from './routes/permissions.js';
import { companyRoutes } from './routes/companies.js';
import { statementRoutes } from './routes/statements.js';
import { quotationRoutes } from './routes/quotations.js';
import { projectRoutes } from './routes/projects.js';
import { purchaseOrderRoutes } from './routes/purchase-orders.js';
import { socketWorkOrderRoutes } from './routes/socket-work-orders.js';
import { ecountRoutes } from './routes/ecount.js';
import { socketOrderRoutes } from './routes/socket-orders.js';
import { socketStockRoutes } from './routes/socket-stock.js';
import { bendingWorkOrderRoutes } from './routes/bending-work-orders.js';
import { materialStockRoutes } from './routes/material-stock.js';
import { structWorkOrderRoutes } from './routes/struct-work-orders.js';
import { subWorkOrderRoutes } from './routes/sub-work-orders.js';
import { fnWorkOrderRoutes } from './routes/fn-work-orders.js';
import { fnStockRoutes } from './routes/fn-stock.js';
import { shipmentOrderRoutes } from './routes/shipment-orders.js';
import { returnReceiptRoutes } from './routes/return-receipts.js';

let appInstance: any = null;

export const initApp = async () => {
  if (appInstance) return appInstance;
  
  const app = Fastify({ logger: true });
  
  await app.register(cors, { origin: env.CORS_ORIGIN });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

  await app.register(certificationRoutes);
  await app.register(itemRoutes);
  await app.register(workOrderRoutes);
  await app.register(lotRoutes);
  await app.register(inventoryRoutes);
  await app.register(inspectionRoutes);
  await app.register(selfInspectionRoutes);
  await app.register(processInspectionRoutes);
  await app.register(certCheckRoutes);
  await app.register(dashboardRoutes);
  await app.register(shipmentRoutes);
  await app.register(qualityReportRoutes);
  await app.register(attachmentRoutes);
  await app.register(backupRoutes);
  await app.register(lotValidationRoutes);
  await app.register(structureLotRoutes);
  await app.register(tbmRoutes);
  await app.register(workerRoutes);
  await app.register(processExecutionRoutes);
  await app.register(productionStatsRoutes);
  await app.register(approvalRoutes);
  await app.register(reportRoutes);
  await app.register(compoundingRoutes);
  await app.register(processBomRoutes);
  await app.register(defectRoutes);
  await app.register(lossAnalyticsRoutes);
  await app.register(lotPropertiesRoutes);
  await app.register(inventoryClosingRoutes);
  await app.register(complianceRoutes);
  await app.register(orderRoutes);
  await app.register(certDocumentRoutes);
  await app.register(structureBomRoutes);
  await app.register(authRoutes);
  await app.register(departmentRoutes);
  await app.register(permissionRoutes);
  await app.register(companyRoutes);
  await app.register(statementRoutes);
  await app.register(quotationRoutes);
  await app.register(projectRoutes);
  await app.register(purchaseOrderRoutes);
  await app.register(socketWorkOrderRoutes);
  await app.register(ecountRoutes);
  await app.register(socketOrderRoutes);
  await app.register(socketStockRoutes);
  await app.register(bendingWorkOrderRoutes);
  await app.register(materialStockRoutes);
  await app.register(structWorkOrderRoutes);
  await app.register(subWorkOrderRoutes);
  await app.register(fnWorkOrderRoutes);
  await app.register(fnStockRoutes);
  await app.register(shipmentOrderRoutes);
  await app.register(returnReceiptRoutes);

  // Health check
  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

    // ── 신규 메뉴 자동 등록 마이그레이션 ──────────────────────────
    // menu 테이블에 없는 신규 페이지를 서버 시작 시 자동으로 추가
    // ON CONFLICT DO NOTHING → 이미 있으면 무시
    try {
      const { pool } = await import('./db/pool.js');
      // 1. INVENTORY 부모 메뉴 가져오기
      const parentRes = await pool.query(
        `SELECT menu_id FROM menu WHERE menu_code = 'INVENTORY' LIMIT 1`
      );
      const inventoryParentId = parentRes.rows[0]?.menu_id ?? null;

      // 기존 메뉴 한글명 동기화/변경
      await pool.query(`UPDATE menu SET menu_name = '출하조회' WHERE menu_code = 'SHIPMENT_ORDERS'`);
      await pool.query(`UPDATE menu SET menu_name = '출하현황' WHERE menu_code = 'SHIPMENT_PENDING'`);

      const newMenus = [
        // ── 재고 신규 메뉴 ──
        { menu_code: 'INVENTORY_LABEL_REPRINT', menu_name: 'LOT 라벨 재출력',    path: '/inventory/label-reprint', parent_menu_id: inventoryParentId, sort_order: 69 },
        { menu_code: 'INVENTORY_LOCATION',      menu_name: '로케이션 관리',        path: '/inventory/location',      parent_menu_id: inventoryParentId, sort_order: 68 },
        // ── 출하 신규 메뉴 ──
        { menu_code: 'SHIPMENT_ORDERS',   menu_name: '출하조회',       path: '/shipment/orders',     parent_menu_id: null, sort_order: 80 },
        { menu_code: 'SHIPMENT_INPUT',    menu_name: '출하입력',       path: '/shipment/input',      parent_menu_id: null, sort_order: 80.5 },
        { menu_code: 'SHIPMENT_STAGING',  menu_name: '포장·출하 스캔',   path: '/shipment/staging',    parent_menu_id: null, sort_order: 81 },
        { menu_code: 'SHIPMENT_PENDING',  menu_name: '출하현황',        path: '/shipment/pending',    parent_menu_id: null, sort_order: 82 },
        { menu_code: 'SHIPMENT_RETURNS',  menu_name: '반품입고',          path: '/shipment/returns',    parent_menu_id: null, sort_order: 83 },
        // ── 거래명세서 ──
        { menu_code: 'STATEMENT_LIST',    menu_name: '거래명세서 관리',   path: '/shipment/statements', parent_menu_id: null, sort_order: 84 },
      ];

      for (const m of newMenus) {
        await pool.query(
          `INSERT INTO menu (menu_code, menu_name, path, parent_menu_id, sort_order, is_active)
           VALUES ($1, $2, $3, $4, $5, TRUE)
           ON CONFLICT (menu_code) DO NOTHING`,
          [m.menu_code, m.menu_name, m.path, m.parent_menu_id, m.sort_order]
        );
      }

      // 신규 메뉴를 모든 부서에 can_read=TRUE로 자동 부여
      const newCodes = newMenus.map(m => m.menu_code);
      await pool.query(`
        INSERT INTO department_permission (dept_id, menu_id, can_read, can_write, can_update, can_delete)
        SELECT d.dept_id, m.menu_id, TRUE, TRUE, TRUE, FALSE
        FROM department d
        CROSS JOIN menu m
        WHERE m.menu_code = ANY($1::text[])
          AND d.is_active = TRUE
        ON CONFLICT (dept_id, menu_id) DO NOTHING
      `, [newCodes]);

      console.log('✅ Menu migration done: inventory + shipment + statement menus granted to all departments');
    } catch (e) {
      console.warn('⚠ Menu migration skipped:', e);
    }

  appInstance = app;
  return app;
};


