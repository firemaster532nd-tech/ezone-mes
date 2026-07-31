import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

export async function ensureWebmailTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS webmail_message (
      mail_id SERIAL PRIMARY KEY,
      sender_name VARCHAR(100) NOT NULL,
      sender_email VARCHAR(150) NOT NULL,
      recipient_name VARCHAR(100) NOT NULL,
      recipient_email VARCHAR(150) NOT NULL,
      subject VARCHAR(300) NOT NULL,
      body TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Initial seed data if empty
  const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM webmail_message');
  if (rows[0].cnt === 0) {
    await pool.query(`
      INSERT INTO webmail_message (sender_name, sender_email, recipient_name, recipient_email, subject, body, is_read, received_at)
      VALUES 
      ('국세청 홈택스', 'tax@hometax.go.kr', '이지원 MES 관리자', 'ezone@ezone.kr', '[국세청] 전자세금계산서 정기 이관 완료 안내', '안녕하세요 이지원 MES 담당자님, 2026년 7월분 전자세금계산서 국세청 정기 데이터 이관이 정상 처리되었습니다.', FALSE, NOW() - INTERVAL '2 hours'),
      ('포스코이앤씨 구매팀', 'po_buy@poscoenc.com', '이동민 파트장', 'ezone@ezone.kr', '[발주문의] 고양 캐피탈랜드 데이터센터 내화채움 자재 납기 확인 건', '안녕하세요 이동민 파트장님, 8월 10일 자재 입고 건 관련하여 시공 출하 스케줄 최종 조율 요청드립니다.', FALSE, NOW() - INTERVAL '5 hours'),
      ('신영부동산신탁', 'order@shinyoung.co.kr', '김정용 책임', 'ezone@ezone.kr', '[입고확인] 신대1지구 B1블럭 덕트 내화채움구조체 납품 확인서', '품질관리서 및 밀시트 LOT 매칭 서류 첨부하여 전달해 드립니다. 확인 부탁드립니다.', TRUE, NOW() - INTERVAL '1 day')
    `);
  }
}

export async function webmailRoutes(app: FastifyInstance) {
  await ensureWebmailTables();

  // GET /api/webmail - 메인 이메일 목록
  app.get('/api/webmail', async (request) => {
    const { rows } = await pool.query(`
      SELECT * FROM webmail_message 
      ORDER BY received_at DESC 
      LIMIT 20
    `);
    const unreadCountResult = await pool.query('SELECT COUNT(*)::int AS cnt FROM webmail_message WHERE is_read = FALSE');
    return {
      data: rows,
      unread_count: unreadCountResult.rows[0]?.cnt || 0,
    };
  });

  // POST /api/webmail/send - 이메일 작성 및 발송
  app.post('/api/webmail/send', async (request, reply) => {
    const body = request.body as any;
    const { recipient_name, recipient_email, subject, body_text } = body;

    const { rows } = await pool.query(`
      INSERT INTO webmail_message (sender_name, sender_email, recipient_name, recipient_email, subject, body, is_read, received_at)
      VALUES ('이지원 MES', 'admin@ezone.kr', $1, $2, $3, $4, TRUE, NOW())
      RETURNING *
    `, [recipient_name || '수신자', recipient_email || 'client@ezone.kr', subject, body_text]);

    return reply.status(201).send({ success: true, message: '이메일이 정상 발송되었습니다.', data: rows[0] });
  });

  // PATCH /api/webmail/:id/read - 읽음 처리
  app.patch('/api/webmail/:id/read', async (request) => {
    const { id } = request.params as { id: string };
    await pool.query('UPDATE webmail_message SET is_read = TRUE WHERE mail_id = $1', [parseInt(id)]);
    return { success: true };
  });
}
