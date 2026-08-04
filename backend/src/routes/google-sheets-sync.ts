import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';

const DEFAULT_SHEET_ID = '1dUrjgHuUFRr0I6yi5EGYYdHH2AWCz2PRfEVPPX_51vg';
const DEFAULT_GID = '1472597640';
const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${DEFAULT_SHEET_ID}/export?format=csv&gid=${DEFAULT_GID}`;

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
        sheet_url: `https://docs.google.com/spreadsheets/d/${DEFAULT_SHEET_ID}/edit?gid=${DEFAULT_GID}#gid=${DEFAULT_GID}`
      };
    } catch (e: any) {
      return { last_sync: null, error: e.message };
    }
  });

  // ── POST /api/inventory/sync-google-sheets (구글 시트 즉시 수신 및 재고 동기화) ──
  app.post('/api/inventory/sync-google-sheets', { preHandler: requireAuth }, async (req, reply) => {
    try {
      // 1. 구글 시트 CSV 데이터 수신 (URL 또는 gid 전달 시 자동 파싱)
      const bodyUrl = (req.body as any)?.url || (req.body as any)?.sheet_url;
      let targetFetchUrl = GOOGLE_SHEET_CSV_URL;

      if (bodyUrl) {
        const match = String(bodyUrl).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
          const id = match[1];
          const gidMatch = String(bodyUrl).match(/gid=([0-9]+)/);
          const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : `&gid=${DEFAULT_GID}`;
          targetFetchUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gidParam}`;
        }
      }

      const response = await fetch(targetFetchUrl);
      if (!response.ok) {
        throw new Error(`Google Sheets HTTP Error: ${response.status}`);
      }

      const csvText = await response.text();
      const lines = csvText.split(/\r?\n/);

      const parsedRows: SheetRow[] = [];
      let currentCategory = '기타부자재';

      // 1-1. 헤더 행 및 LOT 컬럼 인덱스 자동 감지
      let lotColIdx = -1;
      let nameColIdx = -1;
      let specColIdx = -1;
      let qtyColIdx = -1;
      let headerRowIdx = -1;

      for (let i = 0; i < Math.min(lines.length, 20); i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim().replace(/\s+/g, ''));
        
        cols.forEach((col, idx) => {
          if (col.includes('LOT') || col.includes('로트')) lotColIdx = idx;
          if (col.includes('품목') || col.includes('품명') || col.includes('자재명')) nameColIdx = idx;
          if (col.includes('규격') || col.includes('SPEC')) specColIdx = idx;
          if (col.includes('현재고') || col.includes('재고') || col.includes('수량')) qtyColIdx = idx;
        });

        if (nameColIdx !== -1 || lotColIdx !== -1) {
          headerRowIdx = i;
          break;
        }
      }

      for (let i = 0; i < lines.length; i++) {
        if (i === headerRowIdx) continue;
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

        // 헤더 행 무시
        if (col0.includes('재 고 수 불 표') || col0 === '품 목' || col0.includes('규 격') || col0 === 'No.' || col0 === 'No' || col0 === 'K') {
          continue;
        }

        // 7번 컬럼 또는 자동 감지된 컬럼에서 LOT NO 추출
        const actualLot = (lotColIdx !== -1 && cols[lotColIdx]) ? cols[lotColIdx] : (cols[7] || '');
        if (!actualLot || actualLot.length < 3 || actualLot === 'LOT NO') continue;

        const density = parseFloat(cols[0] || cols[1] || '0') || null;
        const thickness = parseFloat(cols[2] || '0') || null;
        const width_mm = parseFloat(cols[3] || '0') || null;
        const length_mm = parseFloat(cols[4] || '0') || null;
        const spec = cols[5] || (specColIdx !== -1 ? cols[specColIdx] : '');
        let name = cols[6] || (nameColIdx !== -1 ? cols[nameColIdx] : col0);

        if (!name || name === actualLot) {
          name = spec ? `세라믹울/그라스울 (${spec})` : `자재 LOT ${actualLot}`;
        }

        const init_qty = parseFloat((cols[8] || '0').replace(/,/g, '')) || 0;
        const in_qty = parseFloat((cols[9] || '0').replace(/,/g, '')) || 0;
        const out_qty = parseFloat((cols[10] || '0').replace(/,/g, '')) || 0;
        let current_qty = parseFloat((cols[11] || '0').replace(/,/g, '')) || 0;

        if (current_qty === 0 && (init_qty > 0 || in_qty > 0)) {
          current_qty = (init_qty + in_qty) - out_qty;
        }

        parsedRows.push({
          category: currentCategory,
          name,
          spec,
          density,
          thickness,
          width_mm,
          length_mm,
          in_qty,
          init_qty,
          out_qty,
          current_qty,
          lot_number: actualLot
        } as any);
      }

      // 2. DB 재고 수불 및 LOT 업데이트 (UPSERT)
      const client = await pool.connect();
      let updatedCount = 0;

      try {
        await client.query('BEGIN');

        for (const row of parsedRows as any[]) {
          const lotNumber = row.lot_number;
          
          // LOT 수불 등록 또는 업데이트
          await client.query(`
            INSERT INTO material_lots
              (lot_number, item_name, category, item_spec, density, thickness, width_mm, length_mm, init_qty, current_qty, location, notes, is_active, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '본재고', '구글스프레드시트 gid=2113952191 연동', TRUE, NOW())
            ON CONFLICT (lot_number) WHERE (is_active = TRUE) DO UPDATE SET
              item_name = EXCLUDED.item_name,
              category = EXCLUDED.category,
              item_spec = EXCLUDED.item_spec,
              density = EXCLUDED.density,
              thickness = EXCLUDED.thickness,
              width_mm = EXCLUDED.width_mm,
              length_mm = EXCLUDED.length_mm,
              init_qty = EXCLUDED.init_qty,
              current_qty = EXCLUDED.current_qty,
              updated_at = NOW()
          `, [
            lotNumber,
            row.name,
            row.category || '세라믹울',
            row.spec,
            row.density,
            row.thickness,
            row.width_mm,
            row.length_mm,
            row.init_qty + row.in_qty,
            row.current_qty
          ]);

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
