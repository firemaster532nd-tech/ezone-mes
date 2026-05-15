import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { CertificationsPage } from '@/pages/master/CertificationsPage';
import { CertificationDetail } from '@/pages/master/CertificationDetail';
import { ItemsPage } from '@/pages/master/ItemsPage';
import { BomPage } from '@/pages/master/BomPage';
import { WorkOrdersPage } from '@/pages/production/WorkOrdersPage';
import { DailyLogPage } from '@/pages/production/DailyLogPage';
import { TbmPage } from '@/pages/production/TbmPage';
import { TbmPrintPage } from '@/pages/production/TbmPrintPage';
import { InventoryDashboardPage } from '@/pages/inventory/InventoryDashboardPage';
import { LotTracePage } from '@/pages/quality/LotTracePage';
import { IncomingInspectionPage } from '@/pages/quality/IncomingInspectionPage';
import { ProcessInspectionPage } from '@/pages/quality/ProcessInspectionPage';
import { SelfInspectionPage } from '@/pages/quality/SelfInspectionPage';
import { CertCheckPage } from '@/pages/quality/CertCheckPage';
import { DefectsPage } from '@/pages/quality/DefectsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ShipmentPage } from '@/pages/shipment/ShipmentPage';
import { QualityReportPage } from '@/pages/shipment/QualityReportPage';
import { InspectionPrintPage } from '@/pages/quality/InspectionPrintPage';
import { BackupPage } from '@/pages/settings/BackupPage';
import { UsersPage } from '@/pages/settings/UsersPage';
import { DepartmentsPage } from '@/pages/settings/DepartmentsPage';
import { PermissionsPage } from '@/pages/settings/PermissionsPage';
import { ProcessExecutionPage } from '@/pages/production/ProcessExecutionPage';
import { ProductionDashboardPage } from '@/pages/production/ProductionDashboardPage';
import { LoginPage } from '@/pages/LoginPage';
import { ApprovalInboxPage } from '@/pages/approval/ApprovalInboxPage';
import { ApprovalLinePage } from '@/pages/approval/ApprovalLinePage';
import { ReportsPage } from '@/pages/reports/ReportsPage';
import { LossReportPage } from '@/pages/reports/LossReportPage';
import { InventoryClosingPage } from '@/pages/inventory/InventoryClosingPage';
import { ComplianceChecklistPage } from '@/pages/quality/ComplianceChecklistPage';
import InitialInventoryPage from '@/pages/inventory/InitialInventoryPage';
import OrderBomPage from '@/pages/orders/OrderBomPage';
import PurchaseRequestPage from '@/pages/orders/PurchaseRequestPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AuthGuard><AppLayout /></AuthGuard>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      // 대시보드
      { path: 'dashboard', element: <DashboardPage /> },
      // 생산관리
      { path: 'production/work-orders', element: <WorkOrdersPage /> },
      { path: 'production/daily-log', element: <DailyLogPage /> },
      { path: 'production/process-execution', element: <ProcessExecutionPage /> },
      { path: 'production/production-dashboard', element: <ProductionDashboardPage /> },
      { path: 'production/tbm', element: <TbmPage /> },
      { path: 'production/tbm-print/:id', element: <TbmPrintPage /> },
      // 재고관리
      { path: 'inventory/dashboard', element: <InventoryDashboardPage /> },
      { path: 'inventory/initialize', element: <InitialInventoryPage /> },
      { path: 'inventory/closing', element: <InventoryClosingPage /> },
      // 품질관리
      { path: 'quality/incoming', element: <IncomingInspectionPage /> },
      { path: 'quality/process-inspection', element: <ProcessInspectionPage /> },
      { path: 'quality/self-inspection', element: <SelfInspectionPage /> },
      { path: 'quality/lot-trace', element: <LotTracePage /> },
      { path: 'quality/cert-check', element: <CertCheckPage /> },
      { path: 'quality/inspection-print/:id', element: <InspectionPrintPage /> },
      { path: 'quality/defects', element: <DefectsPage /> },
      { path: 'quality/compliance', element: <ComplianceChecklistPage /> },
      // 수주/발주
      { path: 'orders', element: <OrderBomPage /> },
      { path: 'orders/purchase-requests', element: <PurchaseRequestPage /> },
      // 출하관리
      { path: 'shipment/list', element: <ShipmentPage /> },
      { path: 'shipment/quality-report/:id', element: <QualityReportPage /> },
      // 마스터관리
      { path: 'master/certifications', element: <CertificationsPage /> },
      { path: 'master/certifications/:id', element: <CertificationDetail /> },
      { path: 'master/items', element: <ItemsPage /> },
      { path: 'master/bom', element: <BomPage /> },
      // 결재
      { path: 'approval/inbox', element: <ApprovalInboxPage /> },
      { path: 'approval/lines', element: <ApprovalLinePage /> },
      // 보고서
      { path: 'reports', element: <ReportsPage /> },
      { path: 'reports/loss', element: <LossReportPage /> },
      // 설정
      { path: 'settings/backup', element: <BackupPage /> },
      { path: 'settings/users', element: <UsersPage /> },
      { path: 'settings/departments', element: <DepartmentsPage /> },
      { path: 'settings/permissions', element: <PermissionsPage /> },
    ],
  },
]);
