import { FastifyInstance } from 'fastify';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1dUrjgHuUFRr0I6yi5EGYYdHH2AWCz2PRfEVPPX_51vg/export?format=csv';

interface SheetRow {
  category: string;
  name: string;
  spec: string;
  in_qty: number;
  init_qty: number;
  out_qty: number;
  current_qty: number;
}

export default async function googleSheetsSyncRoutes(app: FastifyInstance) {
  // ── GET /api/inventory/google-sheets-status (동기화 상태 및 마지막 시간) ──
  app.get('/api/inventory/google-sheets-status', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const res = await pool.query(
        "SELECT * FROM system_settings WHERE setting_key = 'google_sheets_last_sync'"
      );
      return {
        last_sync: res.rows[0]?.setting_value || null,
        sheet_url: 'https://docs.google.com/spreadsheets/d/1dUrjgHuUFRr0I6yi5EGYYdHH2AWCz2PRfEVPPX_51vg/edit?usp=sharing'
      };
    } catch (e: any) {
      return { last_sync: null, error: e.message };
    }
  });

  // ── POST /api/inventory/sync-google-sheets (구글 시트 즉시 수신 및 재고 동기화) ──
  app.post('/api/inventory/sync-google-sheets', { preHandler: requireAuth }, async (req, reply) => {
    try {
      // 1. 구글 시트 CSV 데이터 수신
      const response = await fetch(GOOGLE_SHEET_CSV_URL);
      if (!response.ok) {
        throw new Error(`Google Sheets HTTP Error: ${response.status}`);
      }

      const csvText = await response.text();
      const lines = csvText.split(/\r?\n/);

      const parsedRows: SheetRow[] = [];
      let currentCategory = '기타부자재';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // CSV 셀 분리 (쉼표 및 큰따옴표 처리)
        const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
        const col0 = cols[0] || '';

        // 카테고리 헤더 감지 (예: ■ 그 라 스 울 96K(R))
        if (col0.startsWith('■')) {
          currentCategory = col0.replace('■', '').trim();
          continue;
        }

        // 헤더 행 무시 (재 고 수 불 표, 품 목, 규 격 등)
        if (col0.includes('재 고 수 불 표') || col0 === '품 목' || col0.includes('규 격')) {
          continue;
        }

        const spec = cols[1] || '';
        const in_qty = parseFloat((cols[2] || '0').replace(/,/g, '')) || 0;
        const init_qty = parseFloat((cols[3] || '0').replace(/,/g, '')) || 0;
        const out_qty = parseFloat((cols[4] || '0').replace(/,/g, '')) || 0;
        const current_qty = parseFloat((cols[5] || '0').replace(/,/g, '')) || 0;

        if (col0 && (init_qty !== 0 || in_qty !== 0 || out_qty !== 0 || current_qty !== 0)) {
          parsedRows.append ? null : parsedRows.push({
            category: currentCategory,
            name: col0,
            spec,
            in_qty,
            init_qty,
            out_qty,
            current_qty
          });
        }
      }

      // 2. DB 재고 수불 및 LOT 업데이트 (UPSERT)
      const client = await pool.connect();
      let updatedCount = 0;

      try {
        await client.query('BEGIN');

        for (const row of parsedRows) {
          const lotNumber = `GS-LOT-${row.name.replace(/\s+/g, '')}-${row.spec.replace(/[^a-zA-Z0-9]/g, '')}`;
          
          // LOT 수불 등록 또는 업데이트
          await client.query(`
            INSERT INTO material_lots
              (lot_number, item_name, category, item_spec, init_qty, current_qty, location, remark, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, '본재고', '구글스프레드시트 동기화', NOW())
            ON CONFLICT (lot_number) DO UPDATE SET
              item_name = EXCLUDED.item_name,
              category = EXCLUDED.category,
              item_spec = EXCLUDED.item_spec,
              init_qty = EXCLUDED.init_qty,
              current_qty = EXCLUDED.current_qty,
              updated_at = NOW()
          `, [lotNumber, `${row.name} (${row.spec})`, row.category, row.spec, row.init_qty + row.in_qty, row.current_qty]);

          updatedCount++;
        }

        // 동기화 시각 업데이트
        const nowStr = new Date().toISOString();
        await client.query(`
          INSERT INTO system_settings (setting_key, setting_value, updated_at)
          VALUES ('google_sheets_last_sync', $1, NOW())
          ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1, updated_at = NOW()
        `, [nowStr]);

        await client.query('COMMIT');
      } catch (dbErr) {
        await client.query('ROLLBACK');
        throw dbErr;
      } finally {
        client.release();
      }

      return {
        success: true,
        message: `구글 스프레드시트에서 ${updatedCount}개 품목 재고가 성공적으로 동기화되었습니다.`,
        synced_count: updatedCount,
        synced_at: new Date().toISOString()
      };
    } catch (err: any) {
      return reply.code(500).send({
        error: 'google_sync_failed',
        message: err.message || '구글 스프레드시트 동기화 중 오류가 발생했습니다.'
      });
    }
  });
}
