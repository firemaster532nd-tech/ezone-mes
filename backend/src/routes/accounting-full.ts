import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

export async function ensureAccountingTables() {
  // 1. 계정과목 마스터
  await pool.query(`
    CREATE TABLE IF NOT EXISTS account_code (
      account_id SERIAL PRIMARY KEY,
      account_code VARCHAR(20) NOT NULL UNIQUE,
      account_name VARCHAR(100) NOT NULL,
      category VARCHAR(30) NOT NULL, -- 자산, 부채, 자본, 수익, 비용
      type VARCHAR(30) NOT NULL,     -- 유동자산, 비유동자산, 유동부채, 매출액, 매출원가 등
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);

  // 2. 회계 분개 전표
  await pool.query(`
    CREATE TABLE IF NOT EXISTS journal_voucher (
      voucher_id SERIAL PRIMARY KEY,
      voucher_no VARCHAR(50) NOT NULL UNIQUE,
      voucher_date DATE NOT NULL DEFAULT CURRENT_DATE,
      account_code VARCHAR(20) NOT NULL,
      account_name VARCHAR(100) NOT NULL,
      customer_name VARCHAR(100),
      debit_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,  -- 차변 (Dr)
      credit_amount NUMERIC(15, 2) NOT NULL DEFAULT 0, -- 대변 (Cr)
      summary TEXT,
      writer_name VARCHAR(50) NOT NULL DEFAULT '이지원 관리자',
      status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',  -- DRAFT, PENDING, APPROVED
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Seed default account codes if empty
  const { rows: accCount } = await pool.query('SELECT COUNT(*)::int as cnt FROM account_code');
  if (accCount[0].cnt === 0) {
    await pool.query(`
      INSERT INTO account_code (account_code, account_name, category, type) VALUES
      ('10100', '현금', '자산', '당좌자산'),
      ('10200', '보통예금(국민은행)', '자산', '당좌자산'),
      ('10800', '외상매출금', '자산', '당좌자산'),
      ('14600', '원재료(세라믹/그라스울)', '자산', '재고자산'),
      ('15000', '완제품(내화채움구조체)', '자산', '재고자산'),
      ('21000', '외상매입금', '자산', '유동부채'),
      ('30100', '자본금', '자본', '자본금'),
      ('40100', '제품매출(내화채움구조)', '수익', '매출액'),
      ('40200', '자재매출', '수익', '매출액'),
      ('50100', '원재료매입원가', '비용', '매출원가'),
      ('50200', '노무비(공정작업)', '비용', '제조경비'),
      ('50300', '제조경비(전력/운반비)', '비용', '제조경비'),
      ('80100', '급여 및 수당', '비용', '판매비와관리비'),
      ('80200', '복리후생비', '비용', '판매비와관리비'),
      ('80300', '임차료 및 관리비', '비용', '판매비와관리비')
    `);
  }

  // Seed sample vouchers if empty
  const { rows: vCount } = await pool.query('SELECT COUNT(*)::int as cnt FROM journal_voucher');
  if (vCount[0].cnt === 0) {
    await pool.query(`
      INSERT INTO journal_voucher (voucher_no, voucher_date, account_code, account_name, customer_name, debit_amount, credit_amount, summary) VALUES
      ('JV20260728-001', '2026-07-28', '10800', '외상매출금', '고양캐피탈랜드데이터센터', 12800000, 0, '내화채움구조체 28개 세트 출하 매출 건'),
      ('JV20260728-002', '2026-07-28', '40100', '제품매출(내화채움구조)', '고양캐피탈랜드데이터센터', 0, 12800000, '내화채움구조체 28개 세트 출하 매출 건'),
      ('JV20260727-001', '2026-07-27', '14600', '원재료(세라믹/그라스울)', '㈜KCC 세라믹울', 4500000, 0, '세라믹울 128K 200W 100롤 입고 매입'),
      ('JV20260727-002', '2026-07-27', '21000', '외상매입금', '㈜KCC 세라믹울', 0, 4500000, '세라믹울 128K 200W 100롤 입고 매입'),
      ('JV20260725-001', '2026-07-25', '10200', '보통예금(국민은행)', '주식회사 하나로엔지니어링', 5600000, 0, '아라월평초중학교 신축공사 기성 입금'),
      ('JV20260725-002', '2026-07-25', '10800', '외상매출금', '주식회사 하나로엔지니어링', 0, 5600000, '아라월평초중학교 신축공사 기성 입금 수금')
    `);
  }
}

export async function accountingFullRoutes(app: FastifyInstance) {
  await ensureAccountingTables();

  // GET /api/accounting/summary - 경영자료 요약
  app.get('/api/accounting/summary', async () => {
    const revenueResult = await pool.query("SELECT COALESCE(SUM(credit_amount), 0)::numeric as total FROM journal_voucher WHERE account_code LIKE '4%'");
    const costResult = await pool.query("SELECT COALESCE(SUM(debit_amount), 0)::numeric as total FROM journal_voucher WHERE account_code LIKE '5%' OR account_code LIKE '8%'");
    const assetResult = await pool.query("SELECT COALESCE(SUM(debit_amount - credit_amount), 0)::numeric as total FROM journal_voucher WHERE account_code LIKE '1%'");
    const liabilityResult = await pool.query("SELECT COALESCE(SUM(credit_amount - debit_amount), 0)::numeric as total FROM journal_voucher WHERE account_code LIKE '2%'");

    const revenue = parseFloat(revenueResult.rows[0]?.total || '0');
    const cost = parseFloat(costResult.rows[0]?.total || '0');
    const operatingProfit = revenue - cost;

    return {
      revenue,
      cost,
      operatingProfit,
      totalAssets: parseFloat(assetResult.rows[0]?.total || '500000000'),
      totalLiabilities: parseFloat(liabilityResult.rows[0]?.total || '120000000'),
      netEquity: parseFloat(assetResult.rows[0]?.total || '500000000') - parseFloat(liabilityResult.rows[0]?.total || '120000000'),
    };
  });

  // GET /api/accounting/vouchers - 분개장 및 전표 목록
  app.get('/api/accounting/vouchers', async (request) => {
    const { category, search } = request.query as { category?: string; search?: string };
    let query = 'SELECT * FROM journal_voucher WHERE 1=1';
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (voucher_no ILIKE $${params.length} OR account_name ILIKE $${params.length} OR customer_name ILIKE $${params.length} OR summary ILIKE $${params.length})`;
    }

    query += ' ORDER BY voucher_date DESC, voucher_id DESC LIMIT 50';
    const { rows } = await pool.query(query, params);
    return { data: rows };
  });

  // POST /api/accounting/vouchers - 전표 등록 (FastEntry / 빠른 전표)
  app.post('/api/accounting/vouchers', async (request, reply) => {
    const body = request.body as any;
    const { voucher_date, account_code, account_name, customer_name, debit_amount, credit_amount, summary } = body;

    const voucher_no = `JV${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    const { rows } = await pool.query(`
      INSERT INTO journal_voucher (voucher_no, voucher_date, account_code, account_name, customer_name, debit_amount, credit_amount, summary)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [voucher_no, voucher_date || new Date().toISOString().slice(0, 10), account_code, account_name, customer_name || '', debit_amount || 0, credit_amount || 0, summary || '전표 작성']);

    return reply.status(201).send({ success: true, message: '전표가 정상 등록되었습니다.', data: rows[0] });
  });

  // GET /api/accounting/financial-statements - 재무제표 (재무상태표, 손익계산서, 합계잔액시산표)
  app.get('/api/accounting/financial-statements', async () => {
    const pnlRows = await pool.query(`
      SELECT 
        account_code, account_name,
        SUM(debit_amount)::numeric as total_debit,
        SUM(credit_amount)::numeric as total_credit
      FROM journal_voucher
      GROUP BY account_code, account_name
      ORDER BY account_code ASC
    `);

    return {
      statements: pnlRows.rows,
      generated_at: new Date().toISOString(),
    };
  });
}
