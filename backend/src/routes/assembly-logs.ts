import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import { requireAuth } from '../lib/auth-plugin.js';

export default async function assemblyLogRoutes(app: FastifyInstance) {
  // ── GET /api/production/assembly-logs (조립생산일지 이력 조회) ──
  app.get('/api/production/assembly-logs', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const { type, limit = 50 } = req.query as any;
      let query = `
        SELECT a.*, r.rack_name
        FROM assembly_logs a
        LEFT JOIN rack_locations r ON a.rack_location = r.rack_code
      `;
      const params: any[] = [];
      if (type) {
        query += ' WHERE a.assembly_type = $1';
        params.push(type);
      }
      query += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1}`;
      params.push(parseInt(limit));

      const res = await pool.query(query, params);
      return { data: res.rows };
    } catch (e: any) {
      // 테이블이 없을 경우 폴백 예외 처리
      return { data: [] };
    }
  });

  // ── POST /api/production/assembly-logs (조립생산일지 작성 및 J-LOT 반제품 자동 입고) ──
  app.post('/api/production/assembly-logs', { preHandler: requireAuth }, async (req, reply) => {
    const {
      assembly_type, // 'FLASHING'(F) | 'GAP_SHEET'(TS) | 'SOCKET'(D) | 'BUS_DUCT'(BD) | 'SLEEVE'(FN)
      assembly_date,
      spec,
      input_qty,
      produced_qty,
      rack_location, // 적재 랙 (예: A1, U1 등)
      input_lots,    // [{ lot_number, qty }] 투입 LOT 목록
      worker_name,
      remarks,
    } = req.body as any;

    if (!assembly_type || !produced_qty) {
      return reply.code(400).send({ error: 'assembly_type 및 produced_qty는 필수입니다.' });
    }

    const typeCodeMap: Record<string, string> = {
      FLASHING: 'F',
      GAP_SHEET: 'TS',
      SOCKET: 'D',
      BUS_DUCT: 'BD',
      SLEEVE: 'FN',
    };

    const code = typeCodeMap[assembly_type] || 'ASM';
    
    // J-LOT 자동 채번 (예: J260723F01)
    const today = new Date();
    const yy = String(today.getFullYear()).slice(2);
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const datePrefix = `J${yy}${mm}${dd}${code}`;

    const seqRes = await pool.query(
      "SELECT COUNT(*) + 1 as seq FROM material_lots WHERE lot_number LIKE $1",
      [`${datePrefix}%`]
    );
    const seqNum = String(seqRes.rows[0].seq).padStart(2, '0');
    const assemblyLotNumber = `${datePrefix}${seqNum}`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. 조립 일지 저장
      const logRes = await client.query(`
        INSERT INTO assembly_logs
          (assembly_lot, assembly_type, assembly_date, spec, input_qty, produced_qty, rack_location, worker_name, remarks, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        assemblyLotNumber, assembly_type, assembly_date || new Date().toISOString().slice(0, 10),
        spec || '', input_qty || produced_qty, produced_qty, rack_location || null,
        worker_name || '조립작업자', remarks || null, (req as any).user?.user_id || null
      ]);

      // 2. 반제품 재고(SEMI_FINISHED) 자동 입고 및 랙 적재
      const itemNames: Record<string, string> = {
        FLASHING: '방화플래싱 반제품',
        GAP_SHEET: '틈새복합시트 반제품',
        SOCKET: '방화소켓 조립 반제품',
        BUS_DUCT: '버스덕트 반제품',
        SLEEVE: '일체형슬리브 반제품',
      };

      const itemName = `${itemNames[assembly_type] || '반제품'} (${spec || ''})`;

      await client.query(`
        INSERT INTO material_lots
          (lot_number, item_name, category, item_spec, init_qty, current_qty, location, rack_code, remark, created_at)
        VALUES ($1, $2, '반제품', $3, $4, $4, '본재고', $5, '조립공정 완료 자동 입고', NOW())
        ON CONFLICT (lot_number) DO UPDATE SET
          current_qty = material_lots.current_qty + EXCLUDED.current_qty,
          updated_at = NOW()
      `, [assemblyLotNumber, itemName, spec || '', produced_qty, rack_location || null]);

      // 3. 투입 원부자재 차감
      if (Array.isArray(input_lots)) {
        for (const inLot of input_lots) {
          if (inLot.lot_number && inLot.qty) {
            await client.query(`
              UPDATE material_lots
              SET current_qty = GREATEST(0, current_qty - $1), updated_at = NOW()
              WHERE lot_number = $2
            `, [inLot.qty, inLot.lot_number]);
          }
        }
      }

      await client.query('COMMIT');

      return {
        success: true,
        assembly_lot: assemblyLotNumber,
        message: `조립 반제품 LOT [${assemblyLotNumber}] 생성 완료 (적재위치: ${rack_location || '미지정'}).`,
        data: logRes.rows[0]
      };
    } catch (e: any) {
      await client.query('ROLLBACK');
      return reply.code(500).send({ error: 'assembly_log_failed', message: e.message });
    } finally {
      client.release();
    }
  });
}
