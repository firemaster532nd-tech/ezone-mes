import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';

// 초기화 대상 테이블 (업무 데이터 — 순서 중요: FK 의존성 고려)
const RESET_TABLES = [
  'audit_log',
  'approval_request',
  'login_attempt',
  'process_execution',
  'daily_log',
  'tbm_record',
  'socket_order_item',
  'socket_order',
  'struct_work_order',
  'sub_work_order',
  'fn_work_order',
  'work_order',
  'po_item',
  'purchase_order',
  'project',
  'raw_material_receipt',
  'inspection_record',
  'inventory_ledger',
  'shipment_order',
  'shipment_item',
  'announcement',
  'worker',          // admin 계정도 포함 (superadmin은 환경변수라 삭제 안됨)
  'department',
];

// 백업 대상 테이블 (순서 무관)
const BACKUP_TABLES = [
  'worker', 'department', 'project', 'purchase_order', 'po_item',
  'socket_order', 'socket_order_item', 'struct_work_order',
  'work_order', 'sub_work_order', 'fn_work_order',
  'process_execution', 'daily_log', 'tbm_record',
  'raw_material_receipt', 'inspection_record',
  'inventory_ledger', 'shipment_order', 'shipment_item',
  'item_master', 'announcement', 'approval_request',
  'login_attempt', 'audit_log',
];

export async function superadminRoutes(app: FastifyInstance) {
  // 슈퍼관리자 권한 검증 미들웨어
  const requireSuperAdmin = { preHandler: [requireAuth, async (req: any, reply: any) => {
    if (req.auth?.role !== 'superadmin') {
      return reply.code(403).send({ error: 'superadmin_only' });
    }
  }] };

  // GET /api/superadmin/backup — 전체 DB 데이터 JSON 백업
  app.get('/api/superadmin/backup', requireSuperAdmin, async (_req, reply) => {
    try {
      const backup: Record<string, any[]> = {};
      for (const table of BACKUP_TABLES) {
        try {
          const res = await pool.query(`SELECT * FROM ${table}`);
          backup[table] = res.rows;
        } catch {
          backup[table] = []; // 테이블 없으면 빈 배열
        }
      }
      return reply.send({ data: backup, generated_at: new Date().toISOString() });
    } catch (err) {
      return reply.code(500).send({ error: 'backup_failed' });
    }
  });

  // POST /api/superadmin/reset — 전체 업무 데이터 초기화
  app.post('/api/superadmin/reset', requireSuperAdmin, async (_req, reply) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // FK constraint 일시 비활성화
      await client.query('SET session_replication_role = replica');

      for (const table of RESET_TABLES) {
        try {
          await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
        } catch {
          // 테이블 없으면 건너뜀
        }
      }

      // FK constraint 재활성화
      await client.query('SET session_replication_role = DEFAULT');
      await client.query('COMMIT');

      return reply.send({ ok: true, message: '전체 초기화 완료' });
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      await client.query('SET session_replication_role = DEFAULT').catch(() => {});
      return reply.code(500).send({ error: 'reset_failed', detail: err?.message });
    } finally {
      client.release();
    }
  });
}
