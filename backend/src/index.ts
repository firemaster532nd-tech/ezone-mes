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

  // Health check
  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
  
  appInstance = app;
  return app;
};


