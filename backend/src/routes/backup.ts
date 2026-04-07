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
      { key: 'certification_master', label: '인정구조', category: 'master' },
      { key: 'item_master', label: '품목 마스터', category: 'master' },
      { key: 'bom_master', label: 'BOM', category: 'master' },
      { key: 'certification_rule', label: '인정규칙', category: 'master' },
      { key: 'sales_order', label: '수주', category: 'transaction' },
      { key: 'sales_order_item', label: '수주 품목', category: 'transaction' },
      { key: 'order_bom_result', label: 'BOM 전개결과', category: 'transaction' },
      { key: 'purchase_request', label: '발주서', category: 'transaction' },
      { key: 'purchase_request_item', label: '발주 품목', category: 'transaction' },
      { key: 'work_order', label: '작업지시', category: 'transaction' },
      { key: 'lot_transaction', label: 'LOT', category: 'transaction' },
      { key: 'inventory_transaction', label: '재고이력', category: 'transaction' },
      { key: 'inspection', label: '인수검사', category: 'transaction' },
      { key: 'inspection_detail', label: '검사항목', category: 'transaction' },
      { key: 'self_inspection', label: '자주검사', category: 'transaction' },
    ];

    const stats: Array<{ key: string; label: string; category: string; count: number }> = [];

    for (const t of tables) {
      try {
        const res = await pool.query(`SELECT COUNT(*) as cnt FROM ${t.key}`);
        stats.push({ ...t, count: parseInt(res.rows[0].cnt, 10) });
      } catch {
        stats.push({ ...t, count: 0 });
      }
    }

    return { data: stats };
  });
}
