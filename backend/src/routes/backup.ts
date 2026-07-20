import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

// ── 초기화 비밀번호 (환경변수 또는 기본값) ──
const RESET_PASSWORD = process.env.RESET_PASSWORD || 'ezone0300';

const EXPORT_TABLES = [
  'certification_master',
  'item_master',
  'bom_master',
  'certification_rule',
  'sales_order',
  'sales_order_item',
  'order_bom_result',
  'purchase_request',
  'purchase_request_item',
  'work_order',
  'lot_transaction',
  'lot_genealogy',
  'inventory_transaction',
  'inspection',
  'inspection_detail',
  'self_inspection',
  'attachment',
];

export async function backupRoutes(app: FastifyInstance) {
  // GET /api/backup/export - Export all tables as JSON
  app.get('/api/backup/export', async (_request, reply) => {
    const tables: Record<string, unknown[]> = {};

    for (const tableName of EXPORT_TABLES) {
      try {
        const result = await pool.query(`SELECT * FROM ${tableName} ORDER BY 1`);
        tables[tableName] = result.rows;
      } catch {
        // Table might not exist yet (e.g., attachment), return empty array
        tables[tableName] = [];
      }
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      tables,
    };

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

    return reply
      .header('Content-Disposition', `attachment; filename=ezone_mes_backup_${dateStr}.json`)
      .header('Content-Type', 'application/json')
      .send(exportData);
  });

  // POST /api/backup/import - Import from uploaded JSON
  app.post('/api/backup/import', async (request, reply) => {
    let importData: any;

    // Try to parse from multipart file upload or direct JSON body
    const contentType = request.headers['content-type'] || '';
    if (contentType.includes('multipart')) {
      const data = await (request as any).file();
      if (!data) {
        return reply.status(400).send({ error: 'Bad Request', message: '파일이 첨부되지 않았습니다.' });
      }
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const jsonStr = Buffer.concat(chunks).toString('utf-8');
      try {
        importData = JSON.parse(jsonStr);
      } catch {
        return reply.status(400).send({ error: 'Bad Request', message: 'JSON 파싱 실패' });
      }
    } else {
      importData = request.body;
    }

    if (!importData || !importData.tables) {
      return reply.status(400).send({ error: 'Bad Request', message: '유효한 백업 데이터가 아닙니다.' });
    }

    const client = await pool.connect();
    const importCounts: Record<string, number> = {};

    try {
      await client.query('BEGIN');

      // Import in correct order (respect foreign keys) - truncate in reverse
      const orderedTables = [
        'self_inspection',
        'attachment',
        'inspection_detail',
        'inspection',
        'inventory_transaction',
        'lot_genealogy',
        'lot_transaction',
        'work_order',
        'purchase_request_item',
        'purchase_request',
        'order_bom_result',
        'sales_order_item',
        'sales_order',
        'bom_master',
        'certification_rule',
        'item_master',
        'certification_master',
      ];

      // Truncate in reverse dependency order
      for (const tableName of orderedTables) {
        try {
          await client.query(`TRUNCATE TABLE ${tableName} CASCADE`);
        } catch {
          // Table might not exist
        }
      }

      // Insert in forward dependency order
      const insertOrder = [
        'certification_master',
        'item_master',
        'bom_master',
        'certification_rule',
        'sales_order',
        'sales_order_item',
        'order_bom_result',
        'purchase_request',
        'purchase_request_item',
        'work_order',
        'lot_transaction',
        'lot_genealogy',
        'inventory_transaction',
        'inspection',
        'inspection_detail',
        'self_inspection',
        'attachment',
      ];

      for (const tableName of insertOrder) {
        const rows = importData.tables[tableName];
        if (!rows || !Array.isArray(rows) || rows.length === 0) {
          importCounts[tableName] = 0;
          continue;
        }

        let inserted = 0;
        for (const row of rows) {
          const keys = Object.keys(row);
          if (keys.length === 0) continue;

          const values = keys.map((k) => row[k]);
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
          const columns = keys.map((k) => `"${k}"`).join(', ');

          try {
            await client.query(
              `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
              values
            );
            inserted++;
          } catch (err: any) {
            // Log but continue - some rows may conflict
            console.warn(`Import warning for ${tableName}: ${err.message}`);
          }
        }
        importCounts[tableName] = inserted;
      }

      // Reset sequences for serial columns
      const sequenceResets = [
        { table: 'certification_master', column: 'cert_id' },
        { table: 'item_master', column: 'item_id' },
        { table: 'bom_master', column: 'bom_id' },
        { table: 'certification_rule', column: 'rule_id' },
        { table: 'sales_order', column: 'order_id' },
        { table: 'sales_order_item', column: 'order_item_id' },
        { table: 'order_bom_result', column: 'result_id' },
        { table: 'purchase_request', column: 'pr_id' },
        { table: 'purchase_request_item', column: 'pri_id' },
        { table: 'work_order', column: 'wo_id' },
        { table: 'lot_transaction', column: 'lot_id' },
        { table: 'lot_genealogy', column: 'genealogy_id' },
        { table: 'inventory_transaction', column: 'inv_id' },
        { table: 'inspection', column: 'insp_id' },
        { table: 'inspection_detail', column: 'detail_id' },
        { table: 'self_inspection', column: 'self_insp_id' },
        { table: 'attachment', column: 'att_id' },
      ];

      for (const { table, column } of sequenceResets) {
        try {
          await client.query(
            `SELECT setval(pg_get_serial_sequence('${table}', '${column}'), COALESCE((SELECT MAX(${column}) FROM ${table}), 0) + 1, false)`
          );
        } catch {
          // Sequence might not exist for this table
        }
      }

      await client.query('COMMIT');

      return {
        data: {
          success: true,
          imported_at: new Date().toISOString(),
          counts: importCounts,
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ── POST /api/backup/reset - 데이터 초기화 (비밀번호 필수) ──
  // mode: 'all' = 전체 초기화 | 'transaction' = 운영 데이터만 초기화 (마스터 유지)
  app.post('/api/backup/reset', async (request, reply) => {
    const body = request.body as { password?: string; mode?: string };
    const password = body?.password || '';
    const mode = body?.mode || 'transaction';

    // 비밀번호 검증
    if (password !== RESET_PASSWORD) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: '초기화 비밀번호가 일치하지 않습니다.',
      });
    }

    // 운영 데이터 테이블 (마스터 제외)
    const transactionTables = [
      'self_inspection',
      'attachment',
      'inspection_detail',
      'inspection',
      'inventory_transaction',
      'lot_genealogy',
      'lot_transaction',
      'work_order',
      'purchase_request_item',
      'purchase_request',
      'order_bom_result',
      'sales_order_item',
      'sales_order',
    ];

    // 마스터 테이블 (전체 초기화 시에만)
    const masterTables = [
      'bom_master',
      'certification_rule',
      'item_master',
      'certification_master',
    ];

    const tablesToReset = mode === 'all'
      ? [...transactionTables, ...masterTables]
      : transactionTables;

    const client = await pool.connect();
    const resetCounts: Record<string, number> = {};

    try {
      await client.query('BEGIN');

      for (const tableName of tablesToReset) {
        try {
          const countRes = await client.query(`SELECT COUNT(*) as cnt FROM ${tableName}`);
          resetCounts[tableName] = parseInt(countRes.rows[0].cnt, 10);
          await client.query(`TRUNCATE TABLE ${tableName} CASCADE`);
        } catch {
          resetCounts[tableName] = 0;
        }
      }

      // 시퀀스 리셋
      const allSequences = [
        { table: 'sales_order', column: 'order_id' },
        { table: 'sales_order_item', column: 'order_item_id' },
        { table: 'order_bom_result', column: 'result_id' },
        { table: 'purchase_request', column: 'pr_id' },
        { table: 'purchase_request_item', column: 'pri_id' },
        { table: 'work_order', column: 'wo_id' },
        { table: 'lot_transaction', column: 'lot_id' },
        { table: 'lot_genealogy', column: 'genealogy_id' },
        { table: 'inventory_transaction', column: 'inv_id' },
        { table: 'inspection', column: 'insp_id' },
        { table: 'inspection_detail', column: 'detail_id' },
        { table: 'self_inspection', column: 'self_insp_id' },
        { table: 'attachment', column: 'att_id' },
        ...(mode === 'all' ? [
          { table: 'certification_master', column: 'cert_id' },
          { table: 'item_master', column: 'item_id' },
          { table: 'bom_master', column: 'bom_id' },
          { table: 'certification_rule', column: 'rule_id' },
        ] : []),
      ];

      for (const { table, column } of allSequences) {
        try {
          await client.query(
            `SELECT setval(pg_get_serial_sequence('${table}', '${column}'), 1, false)`
          );
        } catch { /* ignore */ }
      }

      await client.query('COMMIT');

      return {
        data: {
          success: true,
          mode,
          reset_at: new Date().toISOString(),
          deleted_counts: resetCounts,
          total_deleted: Object.values(resetCounts).reduce((a, b) => a + b, 0),
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ── GET /api/backup/stats - 현재 DB 통계 조회 ──
  app.get('/api/backup/stats', async () => {
    const tables = [
      // 마스터
      { key: 'certification_master', label: '인정구조',      category: 'master' },
      { key: 'item_master',          label: '품목 마스터',   category: 'master' },
      { key: 'bom_master',           label: 'BOM',          category: 'master' },
      { key: 'certification_rule',   label: '인정규칙',      category: 'master' },
      { key: 'worker',               label: '사용자 계정',   category: 'master' },
      { key: 'department',           label: '부서',          category: 'master' },
      // 운영 — 프로젝트/발주
      { key: 'project',                label: '프로젝트',       category: 'transaction', group: 'project' },
      { key: 'purchase_order',         label: '발주서',         category: 'transaction', group: 'order' },
      { key: 'purchase_order_item',    label: '발주 품목',      category: 'transaction', group: 'order' },
      { key: 'socket_order',           label: '소켓 발주서',    category: 'transaction', group: 'order' },
      { key: 'socket_order_item',      label: '소켓 발주 품목', category: 'transaction', group: 'order' },
      // 운영 — 작업지시/LOT
      { key: 'work_order',             label: '작업지시서',     category: 'transaction', group: 'work' },
      { key: 'lot_transaction',        label: 'LOT',            category: 'transaction', group: 'lot' },
      { key: 'lot_number_sequence',    label: 'LOT 시퀀스',     category: 'transaction', group: 'lot' },
      // 운영 — 검사
      { key: 'inspection_result',          label: '인수검사',     category: 'transaction', group: 'inspection' },
      { key: 'process_inspection_result',  label: '공정검사',     category: 'transaction', group: 'inspection' },
      { key: 'self_inspection_result',     label: '자주검사',     category: 'transaction', group: 'inspection' },
      { key: 'socket_incoming',            label: '소켓수입검사', category: 'transaction', group: 'inspection' },
      { key: 'socket_incoming_item',       label: '수입검사 항목',category: 'transaction', group: 'inspection' },
      // 운영 — 공정실행
      { key: 'process_execution',      label: '공정 실행',      category: 'transaction', group: 'process' },
      // 운영 — 출하
      { key: 'shipment_order',         label: '출하지시서',     category: 'transaction', group: 'shipment' },
      { key: 'shipment_order_item',    label: '출하 품목',      category: 'transaction', group: 'shipment' },
      // 운영 — 재고/기타
      { key: 'inventory_transaction',  label: '재고 이동',      category: 'transaction', group: 'inventory' },
      { key: 'approval',               label: '결재 기록',      category: 'transaction', group: 'log' },
      { key: 'audit_logs',             label: '감사 로그',      category: 'transaction', group: 'log' },
      { key: 'login_attempt',          label: '로그인 기록',    category: 'transaction', group: 'log' },
    ];

    const stats: Array<{ key: string; label: string; category: string; group?: string; count: number }> = [];

    for (const t of tables) {
      try {
        const res = await pool.query(`SELECT COUNT(*) as cnt FROM "${t.key}"`);
        stats.push({ ...t, count: parseInt(res.rows[0].cnt, 10) });
      } catch {
        stats.push({ ...t, count: 0 });
      }
    }

    return { data: stats };
  });

  // ── POST /api/backup/reset/selective - 선택적 초기화 ──
  // body: { password: string, tables: string[] }
  app.post('/api/backup/reset/selective', async (request, reply) => {
    const body = request.body as { password?: string; tables?: string[] };
    const password = body?.password || '';
    const selectedKeys = body?.tables ?? [];

    if (password !== RESET_PASSWORD) {
      return reply.status(403).send({ error: 'Forbidden', message: '초기화 비밀번호가 일치하지 않습니다.' });
    }
    if (!Array.isArray(selectedKeys) || selectedKeys.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: '초기화할 테이블을 선택해주세요.' });
    }

    // 허용된 테이블 목록 (안전망 — 마스터·시스템 테이블 직접 삭제 방지)
    const ALLOWED_TABLES = new Set([
      'project', 'purchase_order', 'purchase_order_item',
      'socket_order', 'socket_order_item',
      'work_order', 'lot_transaction', 'lot_number_sequence', 'lot_properties',
      'inspection_result', 'process_inspection_result', 'self_inspection_result',
      'socket_incoming', 'socket_incoming_item',
      'process_execution',
      'shipment_order', 'shipment_order_item',
      'inventory_transaction',
      'approval', 'audit_logs', 'login_attempt',
      'return_receipt', 'return_receipt_item',
      // 레거시 (하위 호환)
      'sales_order', 'sales_order_item', 'order_bom_result',
      'purchase_request', 'purchase_request_item',
      'inspection', 'inspection_detail', 'self_inspection',
    ]);

    const invalid = selectedKeys.filter(k => !ALLOWED_TABLES.has(k));
    if (invalid.length > 0) {
      return reply.status(400).send({ error: 'Bad Request', message: `허용되지 않은 테이블: ${invalid.join(', ')}` });
    }

    // FK 의존성 고려한 고정 삭제 순서
    const DELETE_ORDER = [
      'audit_logs', 'login_attempt', 'approval',
      'shipment_order_item', 'shipment_order',
      'return_receipt_item', 'return_receipt',
      'lot_properties', 'lot_number_sequence', 'lot_transaction',
      'inspection_result', 'process_inspection_result', 'self_inspection_result',
      'socket_incoming_item', 'socket_incoming',
      'process_execution',
      'socket_order_item', 'socket_order',
      'purchase_order_item', 'purchase_order',
      'inventory_transaction',
      'work_order',
      'project',
      // 레거시
      'self_inspection', 'inspection_detail', 'inspection',
      'purchase_request_item', 'purchase_request',
      'order_bom_result', 'sales_order_item', 'sales_order',
    ];

    const ordered = DELETE_ORDER.filter(t => selectedKeys.includes(t));
    const client = await pool.connect();
    const resetCounts: Record<string, number> = {};

    try {
      await client.query('BEGIN');

      for (const tableName of ordered) {
        try {
          const countRes = await client.query(`SELECT COUNT(*) as cnt FROM "${tableName}"`);
          resetCounts[tableName] = parseInt(countRes.rows[0].cnt, 10);
          await client.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
        } catch {
          resetCounts[tableName] = 0;
        }
      }

      await client.query('COMMIT');

      return {
        data: {
          success: true,
          mode: 'selective',
          reset_at: new Date().toISOString(),
          deleted_counts: resetCounts,
          total_deleted: Object.values(resetCounts).reduce((a, b) => a + b, 0),
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
}
