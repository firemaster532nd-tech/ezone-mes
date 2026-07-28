import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

// ─────────────────────────────────────────────────────────────────────────────
// 생산 인력 투입 및 수율 관리 라우트
// - daily_workforce_input: 공장/공정별 일일 투입인원 기록
// - monthly_kpi_target: 월별 목표치
// ─────────────────────────────────────────────────────────────────────────────

// 공정 코드 → 공장 매핑 (서버사이드 검증용)
const PROCESS_FACTORY_MAP: Record<string, string> = {
  MIX:    '1F',
  EXT_1:  '1F',
  EXT_2:  '1F',
  CUT:    '2F',
  ASM:    '2F',
  FN_ASM: '2F',
  INSP:   'ALL',
  SHIP:   '2F',
  FIELD:  'FIELD',
};

const VALID_PROCESSES = Object.keys(PROCESS_FACTORY_MAP);
const VALID_DOWNTIME_CODES = ['NONE','BREAKDOWN','SHORTAGE','QUALITY','MEETING','OTHER'];

async function migrateTables() {
  // daily_workforce_input 테이블
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_workforce_input (
      input_id       SERIAL PRIMARY KEY,
      input_date     DATE NOT NULL,
      factory        VARCHAR(10) NOT NULL,
      process_code   VARCHAR(20) NOT NULL,
      worker_count   INTEGER NOT NULL DEFAULT 0,
      plan_hours     DECIMAL(5,2) DEFAULT 8.0,
      actual_hours   DECIMAL(5,2),
      downtime_min   INTEGER DEFAULT 0,
      downtime_code  VARCHAR(30) DEFAULT 'NONE',
      downtime_memo  TEXT,
      site_name      VARCHAR(100),
      labor_cost     DECIMAL(12,2),
      unit_wage      DECIMAL(10,2),
      notes          TEXT,
      created_by     INTEGER,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(input_date, factory, process_code)
    )
  `);

  // monthly_kpi_target 테이블
  await pool.query(`
    CREATE TABLE IF NOT EXISTS monthly_kpi_target (
      target_id      SERIAL PRIMARY KEY,
      year_month     CHAR(7) NOT NULL UNIQUE,
      target_qty     INTEGER,
      target_yield   DECIMAL(5,2),
      target_util    DECIMAL(5,2),
      target_workers INTEGER,
      unit_price_avg DECIMAL(12,2),
      memo           TEXT,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // process_log에 수율 관련 컬럼 보완 (없으면 추가)
  await pool.query(`ALTER TABLE process_log ADD COLUMN IF NOT EXISTS defect_memo TEXT`);
  await pool.query(`ALTER TABLE process_log ADD COLUMN IF NOT EXISTS defect_code VARCHAR(30)`);
}

export async function productionWorkforceRoutes(app: FastifyInstance) {
  // 마이그레이션 (콜드스타트 시 1회)
  setImmediate(async () => { try { await migrateTables(); } catch (e) { console.error('[ProductionWorkforce] migration error', e); } });

  // ─── GET /api/production/workforce ───────────────────────────────────────
  // 특정 날짜의 공장/공정별 투입 인원 조회
  app.get('/api/production/workforce', async (req) => {
    const { date } = req.query as { date?: string };
    const targetDate = date || new Date().toISOString().slice(0, 10);

    const { rows } = await pool.query(`
      SELECT
        input_id, input_date, factory, process_code,
        worker_count, plan_hours, actual_hours,
        downtime_min, downtime_code, downtime_memo,
        site_name, notes,
        ROUND(
          CASE WHEN plan_hours > 0
            THEN (COALESCE(actual_hours, plan_hours) / plan_hours) * 100
            ELSE 100
          END, 1
        ) AS utilization_pct
      FROM daily_workforce_input
      WHERE input_date = $1
      ORDER BY factory, process_code
    `, [targetDate]);

    // 응답을 공장별로 그룹화
    const grouped: Record<string, any[]> = { '1F': [], '2F': [], 'FIELD': [] };
    for (const r of rows) {
      const g = grouped[r.factory] ?? [];
      g.push(r);
      grouped[r.factory] = g;
    }

    return { data: rows, grouped, date: targetDate };
  });

  // ─── POST /api/production/workforce/bulk ─────────────────────────────────
  // 하루치 전체 투입 데이터 일괄 저장 (UPSERT)
  app.post('/api/production/workforce/bulk', async (req, reply) => {
    const body = req.body as {
      date: string;
      rows: Array<{
        factory: string;
        process_code: string;
        worker_count: number;
        plan_hours?: number;
        actual_hours?: number;
        downtime_min?: number;
        downtime_code?: string;
        downtime_memo?: string;
        site_name?: string;
        notes?: string;
      }>;
    };

    if (!body.date) return reply.status(400).send({ error: '날짜(date)를 입력하세요.' });
    if (!Array.isArray(body.rows) || body.rows.length === 0)
      return reply.status(400).send({ error: '투입 데이터(rows)가 없습니다.' });

    // 검증
    for (const r of body.rows) {
      if (!VALID_PROCESSES.includes(r.process_code))
        return reply.status(400).send({ error: `유효하지 않은 공정 코드: ${r.process_code}` });
      if (r.downtime_min && r.downtime_min > 0 && (!r.downtime_code || r.downtime_code === 'NONE'))
        return reply.status(400).send({ error: `비가동 시간이 있으면 사유를 선택하세요 (공정: ${r.process_code})` });
      if (r.downtime_code && !VALID_DOWNTIME_CODES.includes(r.downtime_code))
        return reply.status(400).send({ error: `유효하지 않은 비가동 사유: ${r.downtime_code}` });
    }

    const saved: any[] = [];
    for (const r of body.rows) {
      const factory = r.factory || PROCESS_FACTORY_MAP[r.process_code] || '2F';
      const { rows: [row] } = await pool.query(`
        INSERT INTO daily_workforce_input
          (input_date, factory, process_code, worker_count, plan_hours, actual_hours,
           downtime_min, downtime_code, downtime_memo, site_name, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (input_date, factory, process_code)
        DO UPDATE SET
          worker_count  = EXCLUDED.worker_count,
          plan_hours    = EXCLUDED.plan_hours,
          actual_hours  = EXCLUDED.actual_hours,
          downtime_min  = EXCLUDED.downtime_min,
          downtime_code = EXCLUDED.downtime_code,
          downtime_memo = EXCLUDED.downtime_memo,
          site_name     = EXCLUDED.site_name,
          notes         = EXCLUDED.notes,
          updated_at    = NOW()
        RETURNING *
      `, [
        body.date, factory, r.process_code,
        r.worker_count ?? 0,
        r.plan_hours ?? 8.0,
        r.actual_hours ?? null,
        r.downtime_min ?? 0,
        r.downtime_code || 'NONE',
        r.downtime_memo || null,
        r.site_name || null,
        r.notes || null,
      ]);
      saved.push(row);
    }

    return { data: saved, message: `${saved.length}개 공정 투입 데이터 저장 완료` };
  });

  // ─── GET /api/production/yield ───────────────────────────────────────────
  // 수율 현황 조회 (기간별, 공정별)
  app.get('/api/production/yield', async (req) => {
    const {
      from,
      to,
      factory,
      process_code,
    } = req.query as { from?: string; to?: string; factory?: string; process_code?: string };

    const today = new Date().toISOString().slice(0, 10);
    const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const toDate   = to   || today;

    const conditions: string[] = [`pl.created_at::date BETWEEN $1 AND $2`];
    const params: any[] = [fromDate, toDate];

    if (process_code) { params.push(process_code); conditions.push(`pl.process_code = $${params.length}`); }

    const where = conditions.join(' AND ');

    // 공정별 수율
    const { rows: byProcess } = await pool.query(`
      SELECT
        pl.process_code,
        COUNT(*)                                                          AS log_count,
        COALESCE(SUM(pl.planned_qty), 0)::NUMERIC                        AS total_planned,
        COALESCE(SUM(pl.produced_qty), 0)::NUMERIC                       AS total_produced,
        COALESCE(SUM(pl.defect_qty), 0)::NUMERIC                         AS total_defect,
        ROUND(
          CASE WHEN COALESCE(SUM(pl.produced_qty), 0) > 0
            THEN ((SUM(pl.produced_qty) - COALESCE(SUM(pl.defect_qty),0))
                  / SUM(pl.produced_qty)) * 100
            ELSE NULL
          END, 2
        )                                                                  AS yield_pct,
        ROUND(
          CASE WHEN COALESCE(SUM(pl.produced_qty), 0) > 0
            THEN (COALESCE(SUM(pl.defect_qty),0) / SUM(pl.produced_qty)) * 100
            ELSE NULL
          END, 2
        )                                                                  AS defect_pct
      FROM process_log pl
      WHERE ${where}
      GROUP BY pl.process_code
      ORDER BY pl.process_code
    `, params);

    // 일별 수율 추이 (최근 30일)
    const { rows: daily } = await pool.query(`
      SELECT
        pl.created_at::date                                                AS log_date,
        pl.process_code,
        COALESCE(SUM(pl.produced_qty), 0)::NUMERIC                        AS produced,
        COALESCE(SUM(pl.defect_qty), 0)::NUMERIC                          AS defect,
        ROUND(
          CASE WHEN COALESCE(SUM(pl.produced_qty), 0) > 0
            THEN ((SUM(pl.produced_qty) - COALESCE(SUM(pl.defect_qty),0))
                  / SUM(pl.produced_qty)) * 100
            ELSE NULL
          END, 2
        )                                                                  AS yield_pct
      FROM process_log pl
      WHERE ${where}
      GROUP BY pl.created_at::date, pl.process_code
      ORDER BY pl.created_at::date DESC, pl.process_code
    `, params);

    // 전체 요약
    const { rows: [summary] } = await pool.query(`
      SELECT
        COALESCE(SUM(pl.planned_qty),  0)::NUMERIC AS total_planned,
        COALESCE(SUM(pl.produced_qty), 0)::NUMERIC AS total_produced,
        COALESCE(SUM(pl.defect_qty),   0)::NUMERIC AS total_defect,
        ROUND(
          CASE WHEN COALESCE(SUM(pl.produced_qty), 0) > 0
            THEN ((SUM(pl.produced_qty) - COALESCE(SUM(pl.defect_qty),0))
                  / SUM(pl.produced_qty)) * 100
            ELSE NULL
          END, 2
        ) AS overall_yield_pct
      FROM process_log pl
      WHERE ${where}
    `, params);

    return {
      data: { by_process: byProcess, daily, summary, from: fromDate, to: toDate }
    };
  });

  // ─── GET /api/production/yield/monthly ───────────────────────────────────
  // 12개월 월별 수율 추이
  app.get('/api/production/yield/monthly', async (req) => {
    const { months = '12' } = req.query as { months?: string };
    const monthCount = Math.min(parseInt(months) || 12, 24);

    const { rows } = await pool.query(`
      SELECT
        TO_CHAR(pl.created_at, 'YYYY-MM')                          AS year_month,
        pl.process_code,
        COALESCE(SUM(pl.produced_qty), 0)::NUMERIC                 AS total_produced,
        COALESCE(SUM(pl.defect_qty),   0)::NUMERIC                 AS total_defect,
        ROUND(
          CASE WHEN COALESCE(SUM(pl.produced_qty), 0) > 0
            THEN ((SUM(pl.produced_qty) - COALESCE(SUM(pl.defect_qty),0))
                  / SUM(pl.produced_qty)) * 100
            ELSE NULL
          END, 2
        )                                                            AS yield_pct
      FROM process_log pl
      WHERE pl.created_at >= NOW() - INTERVAL '${monthCount} months'
      GROUP BY TO_CHAR(pl.created_at, 'YYYY-MM'), pl.process_code
      ORDER BY year_month, process_code
    `);

    // 목표치 JOIN
    const { rows: targets } = await pool.query(`
      SELECT year_month, target_yield FROM monthly_kpi_target
      WHERE year_month >= TO_CHAR(NOW() - INTERVAL '${monthCount} months', 'YYYY-MM')
      ORDER BY year_month
    `);

    return { data: { monthly: rows, targets } };
  });

  // ─── GET/POST /api/production/kpi-target ────────────────────────────────
  // 월별 KPI 목표 조회/저장
  app.get('/api/production/kpi-target', async (req) => {
    const { year_month } = req.query as { year_month?: string };
    const ym = year_month || new Date().toISOString().slice(0, 7);
    const { rows: [target] } = await pool.query(
      `SELECT * FROM monthly_kpi_target WHERE year_month = $1`, [ym]
    );
    return { data: target || null };
  });

  app.post('/api/production/kpi-target', async (req) => {
    const b = req.body as any;
    if (!b.year_month) throw { statusCode: 400, message: 'year_month 필요' };
    const { rows: [row] } = await pool.query(`
      INSERT INTO monthly_kpi_target (year_month, target_qty, target_yield, target_util, target_workers, unit_price_avg, memo)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (year_month) DO UPDATE SET
        target_qty     = EXCLUDED.target_qty,
        target_yield   = EXCLUDED.target_yield,
        target_util    = EXCLUDED.target_util,
        target_workers = EXCLUDED.target_workers,
        unit_price_avg = EXCLUDED.unit_price_avg,
        memo           = EXCLUDED.memo
      RETURNING *
    `, [b.year_month, b.target_qty||null, b.target_yield||null, b.target_util||null,
        b.target_workers||null, b.unit_price_avg||null, b.memo||null]);
    return { data: row };
  });

  // ─── GET /api/production/workforce/summary ────────────────────────────────
  // 기간별 투입인원 요약 (생산성 계산용)
  app.get('/api/production/workforce/summary', async (req) => {
    const { from, to, year_month } = req.query as { from?: string; to?: string; year_month?: string };

    let fromDate: string, toDate: string;
    if (year_month) {
      const [y, m] = year_month.split('-').map(Number);
      fromDate = `${year_month}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      toDate = `${year_month}-${String(lastDay).padStart(2, '0')}`;
    } else {
      fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      toDate   = to   || new Date().toISOString().slice(0, 10);
    }

    const { rows } = await pool.query(`
      SELECT
        factory,
        process_code,
        SUM(worker_count)::INTEGER              AS total_workers,
        ROUND(AVG(worker_count), 1)             AS avg_daily_workers,
        SUM(COALESCE(actual_hours, plan_hours)) AS total_actual_hours,
        SUM(plan_hours)                         AS total_plan_hours,
        ROUND(
          CASE WHEN SUM(plan_hours) > 0
            THEN (SUM(COALESCE(actual_hours, plan_hours)) / SUM(plan_hours)) * 100
            ELSE 100
          END, 1
        )                                        AS avg_utilization_pct,
        COUNT(*)::INTEGER                        AS working_days
      FROM daily_workforce_input
      WHERE input_date BETWEEN $1 AND $2
      GROUP BY factory, process_code
      ORDER BY factory, process_code
    `, [fromDate, toDate]);

    const { rows: [totals] } = await pool.query(`
      SELECT
        SUM(worker_count)::INTEGER              AS grand_total_workers,
        COUNT(DISTINCT input_date)::INTEGER      AS working_days
      FROM daily_workforce_input
      WHERE input_date BETWEEN $1 AND $2
        AND factory != 'FIELD'
    `, [fromDate, toDate]);

    return { data: { by_process: rows, totals, from: fromDate, to: toDate } };
  });
}
