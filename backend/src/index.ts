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

// Health check
app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`EZONE MES Backend running on port ${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
