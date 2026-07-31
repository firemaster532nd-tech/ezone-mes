import type { FastifyInstance } from 'fastify';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { pool } from '../db/pool.js';

const GMAIL_USER = process.env.GMAIL_USER || 'firemaster532nd@gmail.com';
const GMAIL_PASS = process.env.GMAIL_APP_PASS || 'ugyzfvyiealkgiav';

export async function ensureWebmailTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS webmail_message (
      mail_id SERIAL PRIMARY KEY,
      sender_name VARCHAR(150) NOT NULL,
      sender_email VARCHAR(200) NOT NULL,
      recipient_name VARCHAR(150) NOT NULL,
      recipient_email VARCHAR(200) NOT NULL,
      subject VARCHAR(500) NOT NULL,
      body TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

// Helper to fetch real Gmail inbox via IMAP and cache into DB
export async function fetchRealGmailInbox() {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    const messages: any[] = [];
    try {
      const status = await client.status('INBOX', { messages: true, unread: true });
      const total = status.messages || 0;
      const startSeq = Math.max(1, total - 9); // fetch last 10 emails

      for await (const msg of client.fetch(`${startSeq}:*`, { envelope: true, bodyStructure: true })) {
        const env = msg.envelope;
        const senderObj = env.from?.[0] || { name: '알 수 없음', address: '' };
        const senderName = senderObj.name || senderObj.address || '구글 메일';
        const senderEmail = senderObj.address || GMAIL_USER;
        const subject = env.subject || '(제목 없음)';
        const bodyText = `[구글 메일 실시간 연동] ${subject}\n수신일시: ${env.date?.toLocaleString('ko-KR')}`;
        const receivedAt = env.date ? new Date(env.date).toISOString() : new Date().toISOString();

        messages.push({
          mail_id: msg.uid,
          sender_name: senderName,
          sender_email: senderEmail,
          recipient_name: '이지원 MES',
          recipient_email: GMAIL_USER,
          subject,
          body: bodyText,
          is_read: false,
          received_at: receivedAt,
        });

        // Cache into DB if not exists
        await pool.query(`
          INSERT INTO webmail_message (sender_name, sender_email, recipient_name, recipient_email, subject, body, is_read, received_at)
          SELECT $1, $2, '이지원 MES', $3, $4, $5, FALSE, $6
          WHERE NOT EXISTS (
            SELECT 1 FROM webmail_message WHERE subject = $4 AND sender_email = $2
          )
        `, [senderName, senderEmail, GMAIL_USER, subject, bodyText, receivedAt]).catch(() => {});
      }
    } finally {
      lock.release();
    }
    await client.logout();
    return messages.reverse(); // newest first
  } catch (err) {
    console.error('Failed to sync live Gmail via IMAP:', err);
    return null;
  }
}

export async function webmailRoutes(app: FastifyInstance) {
  await ensureWebmailTables();

  // Initial sync on server start
  fetchRealGmailInbox().catch(() => {});

  // GET /api/webmail - 메인 구글 메일 목록 (실시간 Gmail IMAP 동기화 + DB 캐시)
  app.get('/api/webmail', async () => {
    const liveMails = await fetchRealGmailInbox();
    if (liveMails && liveMails.length > 0) {
      return {
        data: liveMails,
        unread_count: liveMails.length,
        source: 'GMAIL_LIVE',
        account: GMAIL_USER,
      };
    }

    // DB Fallback if IMAP temporary offline
    const { rows } = await pool.query('SELECT * FROM webmail_message ORDER BY received_at DESC LIMIT 20');
    return {
      data: rows,
      unread_count: rows.filter(r => !r.is_read).length,
      source: 'DB_CACHE',
      account: GMAIL_USER,
    };
  });

  // POST /api/webmail/send - 구글 메일 SMTP 실체 메일 발송
  app.post('/api/webmail/send', async (request, reply) => {
    const body = request.body as any;
    const { recipient_email, subject, body_text } = body;

    const targetEmail = recipient_email || GMAIL_USER;
    const mailSubject = subject || '[이지원 MES] 업무 메일 안내';
    const mailContent = body_text || '안녕하세요, 이지원 MES 시스템에서 발송된 업무 안내입니다.';

    // 1. Send via real Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    });

    try {
      const info = await transporter.sendMail({
        from: `"이지원 MES" <${GMAIL_USER}>`,
        to: targetEmail,
        subject: mailSubject,
        text: mailContent,
      });

      // 2. Save in DB audit log
      const { rows } = await pool.query(`
        INSERT INTO webmail_message (sender_name, sender_email, recipient_name, recipient_email, subject, body, is_read, received_at)
        VALUES ('이지원 MES', $1, '수신자', $2, $3, $4, TRUE, NOW())
        RETURNING *
      `, [GMAIL_USER, targetEmail, mailSubject, mailContent]);

      return reply.status(201).send({
        success: true,
        message: `구글 메일이 성공적으로 실시간 발송되었습니다. (MessageID: ${info.messageId})`,
        data: rows[0],
      });
    } catch (err: any) {
      console.error('Failed to send email via Gmail SMTP:', err);
      return reply.status(500).send({
        success: false,
        message: `구글 메일 발송 중 오류가 발생했습니다: ${err.message}`,
      });
    }
  });

  // PATCH /api/webmail/:id/read - 읽음 처리
  app.patch('/api/webmail/:id/read', async (request) => {
    const { id } = request.params as { id: string };
    await pool.query('UPDATE webmail_message SET is_read = TRUE WHERE mail_id = $1', [parseInt(id)]);
    return { success: true };
  });
}
