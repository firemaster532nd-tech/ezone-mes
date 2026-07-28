import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import * as XLSX from 'xlsx';

const PROCESS_LABELS: Record<string, string> = {
  MIX: '배합', EXT_1: '압출1호기', EXT_2: '압출2호기',
  CUT: '재단', ASM: '조립', FN_ASM: 'FN조립',
  INSP: '검사', SHIP: '출하',
};

// ── 인건비 집계 헬퍼 ─────────────────────────────────────────────
async function calcLaborCost(yearMonth: string): Promise<number> {
  try {
    const { rows } = await pool.query(`
      SELECT
        dw.process_code,
        dw.worker_count,
        dw.actual_hours,
        dw.work_date,
        dw.field_worker_count,
        COALESCE(
          (SELECT lc.hourly_rate FROM labor_cost_master lc
           WHERE lc.process_code = dw.process_code
             AND lc.effective_from <= dw.work_date
             AND (lc.effective_to IS NULL OR lc.effective_to >= dw.work_date)
             AND lc.worker_type = 'REGULAR'
           ORDER BY lc.effective_from DESC LIMIT 1), 0
        ) AS hourly_rate,
        COALESCE(
          (SELECT lc.daily_rate FROM labor_cost_master lc
           WHERE lc.process_code = dw.process_code
             AND lc.effective_from <= dw.work_date
             AND (lc.effective_to IS NULL OR lc.effective_to >= dw.work_date)
             AND lc.worker_type = 'FIELD'
           ORDER BY lc.effective_from DESC LIMIT 1), 0
        ) AS field_daily_rate
      FROM daily_workforce_input dw
      WHERE TO_CHAR(dw.work_date, 'YYYY-MM') = $1
    `, [yearMonth]);
    let total = 0;
    for (const r of rows) {
      total += (r.worker_count || 0) * (r.actual_hours || 0) * (r.hourly_rate || 0);
      total += (r.field_worker_count || 0) * (r.field_daily_rate || 0);
    }
    return total;
  } catch { return 0; }
}

// ── 매출 집계 헬퍼 ────────────────────────────────────────────────
async function calcRevenue(yearMonth: string): Promise<number> {
  try {
    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(soi.amount), 0) AS revenue
      FROM shipment_order_item soi
      JOIN shipment_orders so ON so.so_id = soi.so_id
      WHERE TO_CHAR(COALESCE(so.shipped_at::date, so.shipment_date::date), 'YYYY-MM') = $1
    `, [yearMonth]);
    return parseFloat(rows[0]?.revenue || '0');
  } catch { return 0; }
}

// ─────────────────────────────────────────────────────────────────
export default async function accountingRoutes(app: FastifyInstance) {

  // ════════════════════════════════════════════════════════════════
  // ① 인건비 단가 마스터
  // ════════════════════════════════════════════════════════════════
  app.get('/labor-cost', async () => {
    const { rows } = await pool.query(`
      SELECT * FROM labor_cost_master ORDER BY process_code, effective_from DESC
    `);
    return { data: rows };
  });

  app.post('/labor-cost', async (req, reply) => {
    const { process_code, worker_type, hourly_rate, daily_rate, effective_from, memo } = req.body as any;
    if (!process_code) return reply.status(400).send({ error: '공정코드 필수' });
    const { rows } = await pool.query(`
      INSERT INTO labor_cost_master
        (process_code, worker_type, hourly_rate, daily_rate, effective_from, memo)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [process_code, worker_type || 'REGULAR', hourly_rate || null, daily_rate || null,
        effective_from || new Date().toISOString().slice(0,10), memo || null]);
    return { data: rows[0] };
  });

  app.put('/labor-cost/:id', async (req) => {
    const { id } = req.params as any;
    const { process_code, worker_type, hourly_rate, daily_rate, effective_from, effective_to, memo } = req.body as any;
    const { rows } = await pool.query(`
      UPDATE labor_cost_master SET
        process_code=$1, worker_type=$2, hourly_rate=$3, daily_rate=$4,
        effective_from=$5, effective_to=$6, memo=$7, updated_at=NOW()
      WHERE id=$8 RETURNING *
    `, [process_code, worker_type, hourly_rate||null, daily_rate||null,
        effective_from, effective_to||null, memo||null, id]);
    return { data: rows[0] };
  });

  app.delete('/labor-cost/:id', async (req) => {
    await pool.query('DELETE FROM labor_cost_master WHERE id=$1', [(req.params as any).id]);
    return { success: true };
  });

  // ════════════════════════════════════════════════════════════════
  // ② 원자재 구매단가 마스터
  // ════════════════════════════════════════════════════════════════
  app.get('/material-cost', async (req) => {
    const { category } = req.query as any;
    const where = category ? 'WHERE category=$1' : '';
    const params = category ? [category] : [];
    const { rows } = await pool.query(
      `SELECT * FROM material_cost_master ${where} ORDER BY category, item_name, effective_from DESC`, params);
    return { data: rows };
  });

  app.post('/material-cost', async (req, reply) => {
    const { category, item_name, spec, unit, unit_price, supplier_name, effective_from } = req.body as any;
    if (!category || !item_name || !unit_price) return reply.status(400).send({ error: '필수 항목 누락' });
    const { rows } = await pool.query(`
      INSERT INTO material_cost_master
        (category, item_name, spec, unit, unit_price, supplier_name, effective_from, source)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'MANUAL') RETURNING *
    `, [category, item_name, spec||null, unit||'EA', unit_price,
        supplier_name||null, effective_from||new Date().toISOString().slice(0,10)]);
    return { data: rows[0] };
  });

  app.put('/material-cost/:id', async (req) => {
    const { category, item_name, spec, unit, unit_price, supplier_name, effective_from, effective_to } = req.body as any;
    const { rows } = await pool.query(`
      UPDATE material_cost_master SET
        category=$1, item_name=$2, spec=$3, unit=$4, unit_price=$5,
        supplier_name=$6, effective_from=$7, effective_to=$8
      WHERE id=$9 RETURNING *
    `, [category, item_name, spec||null, unit, unit_price,
        supplier_name||null, effective_from, effective_to||null, (req.params as any).id]);
    return { data: rows[0] };
  });

  app.delete('/material-cost/:id', async (req) => {
    await pool.query('DELETE FROM material_cost_master WHERE id=$1', [(req.params as any).id]);
    return { success: true };
  });

  // ── 엑셀 임포트 ────────────────────────────────────────────────
  app.post('/material-cost/import-excel', async (req, reply) => {
    try {
      const data = await req.file();
      if (!data) return reply.status(400).send({ error: '파일 없음' });
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk as Buffer);
      const buf = Buffer.concat(chunks);
      const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const dataRows = rows.slice(3).filter(r => r[0] && r[1] && r[4]);
      const inserted: any[] = [];
      const errors: string[] = [];
      for (const [ri, row] of dataRows.entries()) {
        const [category, item_name, spec, unit, unit_price_raw, supplier_name, effective_from_raw] = row;
        const unit_price = parseFloat(String(unit_price_raw).replace(/,/g, ''));
        if (isNaN(unit_price) || unit_price <= 0) { errors.push(`${ri+4}행: 단가 오류`); continue; }
        let effective_from = new Date().toISOString().slice(0,10);
        if (effective_from_raw) {
          const d = effective_from_raw instanceof Date
            ? effective_from_raw.toISOString().slice(0,10)
            : String(effective_from_raw).trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(d)) effective_from = d;
        }
        try {
          const { rows: r } = await pool.query(`
            INSERT INTO material_cost_master
              (category, item_name, spec, unit, unit_price, supplier_name, effective_from, source)
            VALUES ($1,$2,$3,$4,$5,$6,$7,'EXCEL') RETURNING id
          `, [String(category).trim(), String(item_name).trim(), spec?String(spec).trim():null,
              unit?String(unit).trim():'EA', unit_price,
              supplier_name?String(supplier_name).trim():null, effective_from]);
          inserted.push(r[0]);
        } catch (e: any) { errors.push(`${ri+4}행: ${e.message}`); }
      }
      return { success: true, inserted: inserted.length, errors };
    } catch (e: any) { return reply.status(500).send({ error: e.message }); }
  });

  // ════════════════════════════════════════════════════════════════
  // ③ 간접비율
  // ════════════════════════════════════════════════════════════════
  app.get('/overhead', async () => {
    const { rows } = await pool.query(`SELECT * FROM overhead_rate_master ORDER BY year_month DESC`);
    return { data: rows };
  });

  app.post('/overhead', async (req, reply) => {
    const { year_month, overhead_pct, fixed_monthly, memo } = req.body as any;
    if (!year_month || overhead_pct == null) return reply.status(400).send({ error: '필수 항목 누락' });
    const { rows } = await pool.query(`
      INSERT INTO overhead_rate_master (year_month, overhead_pct, fixed_monthly, memo)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (year_month) DO UPDATE SET
        overhead_pct=$2, fixed_monthly=$3, memo=$4
      RETURNING *
    `, [year_month, overhead_pct, fixed_monthly||0, memo||null]);
    return { data: rows[0] };
  });

  // ════════════════════════════════════════════════════════════════
  // ④ 운반비
  // ════════════════════════════════════════════════════════════════
  app.get('/transport', async (req) => {
    const { year_month } = req.query as any;
    const where = year_month ? `WHERE TO_CHAR(cost_date,'YYYY-MM')=$1` : '';
    const params = year_month ? [year_month] : [];
    const { rows } = await pool.query(
      `SELECT * FROM transport_cost ${where} ORDER BY cost_date DESC`, params);
    return { data: rows };
  });

  app.post('/transport', async (req, reply) => {
    const { cost_date, site_name, so_id, amount, carrier, invoice_no, memo } = req.body as any;
    if (!cost_date || !amount) return reply.status(400).send({ error: '날짜·금액 필수' });
    const { rows } = await pool.query(`
      INSERT INTO transport_cost
        (cost_date, site_name, so_id, amount, carrier, invoice_no, memo)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [cost_date, site_name||null, so_id||null, amount,
        carrier||null, invoice_no||null, memo||null]);
    return { data: rows[0] };
  });

  app.delete('/transport/:id', async (req) => {
    await pool.query('DELETE FROM transport_cost WHERE id=$1', [(req.params as any).id]);
    return { success: true };
  });

  // ════════════════════════════════════════════════════════════════
  // ⑤ 손익 계산 & 스냅샷
  // ════════════════════════════════════════════════════════════════

  // 실시간 계산
  app.get('/pl/calculate', async (req) => {
    const yearMonth = String((req.query as any).year_month || new Date().toISOString().slice(0,7));
    const revenue = await calcRevenue(yearMonth);
    const laborCost = await calcLaborCost(yearMonth);
    const ovrRes = await pool.query(
      `SELECT overhead_pct, fixed_monthly FROM overhead_rate_master
       WHERE year_month <= $1 ORDER BY year_month DESC LIMIT 1`, [yearMonth]);
    const overheadPct = parseFloat(ovrRes.rows[0]?.overhead_pct || '15');
    const fixedMonthly = parseFloat(ovrRes.rows[0]?.fixed_monthly || '0');
    const overheadCost = laborCost * overheadPct / 100 + fixedMonthly;
    const tcRes = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM transport_cost
       WHERE TO_CHAR(cost_date,'YYYY-MM')=$1`, [yearMonth]);
    const transportCost = parseFloat(tcRes.rows[0]?.total || '0');
    const pqRes = await pool.query(`
      SELECT COALESCE(SUM(produced_qty),0) AS qty FROM process_log
      WHERE TO_CHAR(started_at,'YYYY-MM')=$1 OR TO_CHAR(completed_at,'YYYY-MM')=$1
    `, [yearMonth]).catch(() => ({ rows: [{ qty: 0 }] }));
    const producedQty = parseInt(String(pqRes.rows[0]?.qty || '0'));
    const totalCost = laborCost + overheadCost + transportCost;
    const grossProfit = revenue - totalCost;
    const grossMargin = revenue > 0 ? Math.round((grossProfit / revenue) * 10000) / 100 : 0;
    return {
      data: {
        year_month: yearMonth, revenue, labor_cost: laborCost,
        overhead_cost: overheadCost, transport_cost: transportCost,
        material_cost: 0, total_cost: totalCost,
        gross_profit: grossProfit, gross_margin: grossMargin,
        produced_qty: producedQty,
        cost_per_unit: producedQty > 0 ? Math.round(totalCost / producedQty) : 0,
        overhead_pct: overheadPct,
      }
    };
  });

  // 확정 스냅샷 목록
  app.get('/pl/snapshots', async () => {
    const { rows } = await pool.query(`SELECT * FROM monthly_pl_snapshot ORDER BY year_month DESC`);
    return { data: rows };
  });

  // 손익 확정 저장
  app.post('/pl/confirm', async (req) => {
    const b = req.body as any;
    const { rows } = await pool.query(`
      INSERT INTO monthly_pl_snapshot
        (year_month, revenue, material_cost, labor_cost, overhead_cost, transport_cost,
         total_cost, gross_profit, gross_margin, produced_qty, cost_per_unit, memo, confirmed)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true)
      ON CONFLICT (year_month) DO UPDATE SET
        revenue=$2, material_cost=$3, labor_cost=$4, overhead_cost=$5, transport_cost=$6,
        total_cost=$7, gross_profit=$8, gross_margin=$9, produced_qty=$10,
        cost_per_unit=$11, memo=$12, confirmed=true, updated_at=NOW()
      RETURNING *
    `, [b.year_month, b.revenue||0, b.material_cost||0, b.labor_cost||0,
        b.overhead_cost||0, b.transport_cost||0, b.total_cost||0,
        b.gross_profit||0, b.gross_margin||0, b.produced_qty||0,
        b.cost_per_unit||0, b.memo||null]);
    return { data: rows[0] };
  });

  // 연간 손익 추이
  app.get('/pl/annual', async (req) => {
    const year = (req.query as any).year || new Date().getFullYear();
    const { rows } = await pool.query(
      `SELECT * FROM monthly_pl_snapshot WHERE year_month LIKE $1 ORDER BY year_month`,
      [`${year}-%`]);
    return { data: rows };
  });

  // ════════════════════════════════════════════════════════════════
  // ⑥ 매출 집계 (차트용)
  // ════════════════════════════════════════════════════════════════
  app.get('/revenue/summary', async (req) => {
    const year = (req.query as any).year || new Date().getFullYear();
    const { rows } = await pool.query(`
      SELECT
        TO_CHAR(COALESCE(so.shipped_at::date, so.shipment_date::date), 'YYYY-MM') AS year_month,
        COUNT(DISTINCT so.so_id) AS order_count,
        COALESCE(SUM(soi.amount), 0) AS revenue,
        COALESCE(SUM(soi.qty), 0) AS total_qty
      FROM shipment_orders so
      LEFT JOIN shipment_order_item soi ON soi.so_id = so.so_id
      WHERE EXTRACT(YEAR FROM COALESCE(so.shipped_at::date, so.shipment_date::date)) = $1
      GROUP BY 1
      ORDER BY 1
    `, [year]);
    return { data: rows };
  });

  app.get('/revenue/by-site', async (req) => {
    const { year_month } = req.query as any;
    const where = year_month
      ? `WHERE TO_CHAR(COALESCE(so.shipped_at::date,so.shipment_date::date),'YYYY-MM')=$1`
      : '';
    const params = year_month ? [year_month] : [];
    const { rows } = await pool.query(`
      SELECT
        COALESCE(p.project_name, so.site_name, '미지정') AS site_name,
        COUNT(DISTINCT so.so_id) AS order_count,
        COALESCE(SUM(soi.amount), 0) AS revenue,
        COALESCE(SUM(soi.qty), 0) AS total_qty
      FROM shipment_orders so
      LEFT JOIN shipment_order_item soi ON soi.so_id = so.so_id
      LEFT JOIN project p ON p.project_id = so.project_id
      ${where}
      GROUP BY 1
      ORDER BY revenue DESC
    `, params);
    return { data: rows };
  });

  // process labels 노출
  app.get('/process-labels', async () => {
    return { data: PROCESS_LABELS };
  });
}
