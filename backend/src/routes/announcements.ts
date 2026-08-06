import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../lib/auth-plugin.js';

// ── 서버 시작 시 테이블 자동 생성/마이그레이션 ─────────────────────────────
export async function ensureAnnouncementTables() {
  // 1. announcement 테이블
  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcement (
      announcement_id  SERIAL PRIMARY KEY,
      msg_type         VARCHAR(10) NOT NULL DEFAULT 'NOTICE',  -- NOTICE / MESSAGE
      title            VARCHAR(200) NOT NULL,
      body             TEXT NOT NULL,
      target_type      VARCHAR(10) NOT NULL DEFAULT 'ALL',     -- ALL / DEPT / INDIVIDUAL
      target_ids       INT[] DEFAULT '{}',
      created_by       INT REFERENCES worker(worker_id) ON DELETE SET NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // 기존 테이블에 msg_type 컬럼이 없으면 추가
  await pool.query(`
    ALTER TABLE announcement
    ADD COLUMN IF NOT EXISTS msg_type VARCHAR(10) NOT NULL DEFAULT 'NOTICE'
  `);

  // 2. 수신함 테이블
  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcement_receipt (
      receipt_id       SERIAL PRIMARY KEY,
      announcement_id  INT NOT NULL REFERENCES announcement(announcement_id) ON DELETE CASCADE,
      worker_id        INT NOT NULL REFERENCES worker(worker_id) ON DELETE CASCADE,
      is_read          BOOLEAN NOT NULL DEFAULT FALSE,
      read_at          TIMESTAMPTZ,
      UNIQUE(announcement_id, worker_id)
    )
  `);

  // 3. 권한 요청 테이블
  await pool.query(`
    CREATE TABLE IF NOT EXISTS permission_request (
      request_id   SERIAL PRIMARY KEY,
      worker_id    INT NOT NULL REFERENCES worker(worker_id) ON DELETE CASCADE,
      menu_id      INT REFERENCES menu(menu_id) ON DELETE SET NULL,
      menu_name    VARCHAR(100),
      reason       TEXT,
      status       VARCHAR(10) NOT NULL DEFAULT 'PENDING',
      reviewed_by  INT REFERENCES worker(worker_id) ON DELETE SET NULL,
      reviewed_at  TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // 4. 공지작성/쪽지작성 메뉴 항목 자동 삽입 (권한 관리에 표시용)
  await pool.query(`
    INSERT INTO menu (menu_code, menu_name, parent_menu_id, sort_order)
    SELECT 'NOTICE_WRITE', '공지 작성', NULL, 900
    WHERE NOT EXISTS (SELECT 1 FROM menu WHERE menu_code = 'NOTICE_WRITE')
  `);
  await pool.query(`
    INSERT INTO menu (menu_code, menu_name, parent_menu_id, sort_order)
    SELECT 'MESSAGE_WRITE', '쪽지 작성', NULL, 901
    WHERE NOT EXISTS (SELECT 1 FROM menu WHERE menu_code = 'MESSAGE_WRITE')
  `);

  console.log('✅ announcement / message / permission_request 테이블 준비 완료');
}

// ── Zod 스키마 ───────────────────────────────────────────────────────────────
const createAnnouncementSchema = z.object({
  title:       z.string().min(1).max(200),
  body:        z.string().min(1),
  target_type: z.enum(['ALL', 'DEPT', 'INDIVIDUAL']).default('ALL'),
  target_ids:  z.array(z.number().int().positive()).default([]),
});

const createMessageSchema = z.object({
  title:       z.string().min(1).max(200),
  body:        z.string().min(1),
  target_type: z.enum(['DEPT', 'INDIVIDUAL']),   // 쪽지는 ALL 없음
  target_ids:  z.array(z.number().int().positive()).min(1, '수신 대상을 1명 이상 선택하세요'),
});

const createPermReqSchema = z.object({
  menu_id:   z.number().int().positive().optional(),
  menu_name: z.string().max(100).optional(),
  reason:    z.string().max(500).optional(),
});

const reviewPermReqSchema = z.object({
  status:     z.enum(['APPROVED', 'REJECTED']),
  can_read:   z.boolean().default(true),
  can_write:  z.boolean().default(false),
  can_update: z.boolean().default(false),
  can_delete: z.boolean().default(false),
});

// ── 공통: 수신자 삽입 헬퍼 ────────────────────────────────────────────────────
async function insertReceipts(ann_id: number, recipientIds: number[]) {
  if (recipientIds.length === 0) return;
  const values = recipientIds.map((_, i) => `($1, $${i + 2})`).join(', ');
  await pool.query(
    `INSERT INTO announcement_receipt (announcement_id, worker_id) VALUES ${values} ON CONFLICT DO NOTHING`,
    [ann_id, ...recipientIds],
  );
}

// ── 라우트 ───────────────────────────────────────────────────────────────────
export async function announcementRoutes(app: FastifyInstance) {

  // ════════════════════════════════════════════════════════════════════════════
  // 공지 (NOTICE) — manager/admin 작성, 전체/부서/개인 발송
  // ════════════════════════════════════════════════════════════════════════════

  // GET /api/announcements/public  ─ 로그인 전 공개 공지 목록 (인증 불필요)
  app.get('/api/announcements/public', async () => {
    try {
      const { rows } = await pool.query(`
        SELECT
          a.announcement_id,
          a.title,
          a.body,
          a.created_at,
          a.target_type,
          w.worker_name AS author_name
        FROM announcement a
        LEFT JOIN worker w ON w.worker_id = a.created_by
        WHERE a.msg_type = 'NOTICE'
          AND a.target_type = 'ALL'
        ORDER BY a.created_at DESC
        LIMIT 5
      `);
      return { announcements: rows };
    } catch {
      return { announcements: [] };
    }
  });

  // GET /api/announcements  ─ 공지 목록
  app.get('/api/announcements', { preHandler: requireAuth }, async (req) => {
    const me = req.auth!;
    const canManage = me.role === 'admin' || me.role === 'manager';

    if (canManage) {
      const { rows } = await pool.query(`
        SELECT
          a.*,
          w.worker_name AS author_name,
          COUNT(r.receipt_id)::int                              AS total_recipients,
          COUNT(r.receipt_id) FILTER (WHERE r.is_read)::int    AS read_count
        FROM announcement a
        LEFT JOIN worker w ON w.worker_id = a.created_by
        LEFT JOIN announcement_receipt r ON r.announcement_id = a.announcement_id
        WHERE a.msg_type = 'NOTICE'
        GROUP BY a.announcement_id, w.worker_name
        ORDER BY a.created_at DESC
        LIMIT 100
      `);
      return { announcements: rows };
    }

    const { rows } = await pool.query(`
      SELECT
        a.announcement_id, a.title, a.body, a.created_at, a.msg_type,
        w.worker_name AS author_name,
        r.is_read, r.read_at
      FROM announcement_receipt r
      JOIN announcement a ON a.announcement_id = r.announcement_id
      LEFT JOIN worker w ON w.worker_id = a.created_by
      WHERE r.worker_id = $1 AND a.msg_type = 'NOTICE'
      ORDER BY a.created_at DESC
      LIMIT 100
    `, [me.worker_id]);
    return { announcements: rows };
  });

  // GET /api/announcements/unread-count  ─ 공지 + 쪽지 합산 미읽음
  app.get('/api/announcements/unread-count', async (req) => {
    try {
      const me = (req as any).auth;
      if (!me?.worker_id) return { count: 0 };
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM announcement_receipt r
         JOIN announcement a ON a.announcement_id = r.announcement_id
         WHERE r.worker_id = $1 AND r.is_read = FALSE`,
        [me.worker_id],
      );
      return { count: rows[0]?.count || 0 };
    } catch {
      return { count: 0 };
    }
  });


  // GET /api/announcements/:id  ─ 공지 상세 + 읽음 처리
  app.get<{ Params: { id: string } }>(
    '/api/announcements/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const me = req.auth!;
      const id = parseInt(req.params.id, 10);

      const { rows } = await pool.query(`
        SELECT a.*, w.worker_name AS author_name
        FROM announcement a
        LEFT JOIN worker w ON w.worker_id = a.created_by
        WHERE a.announcement_id = $1
      `, [id]);
      if (!rows[0]) return reply.code(404).send({ error: 'not_found' });

      await pool.query(`
        UPDATE announcement_receipt
        SET is_read = TRUE, read_at = NOW()
        WHERE announcement_id = $1 AND worker_id = $2 AND is_read = FALSE
      `, [id, me.worker_id]);

      let recipients: any[] = [];
      if (me.role === 'admin' || me.role === 'manager') {
        const r = await pool.query(`
          SELECT r.is_read, r.read_at, w.worker_name, w.employee_no
          FROM announcement_receipt r
          JOIN worker w ON w.worker_id = r.worker_id
          WHERE r.announcement_id = $1
          ORDER BY r.is_read DESC, w.worker_name
        `, [id]);
        recipients = r.rows;
      }
      return { announcement: rows[0], recipients };
    },
  );

  // POST /api/announcements  ─ 공지 작성 (admin/manager)
  app.post('/api/announcements', { preHandler: requireRole('admin', 'manager') }, async (req, reply) => {
    const me = req.auth!;
    const parsed = createAnnouncementSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });

    const { title, body, target_type, target_ids } = parsed.data;

    const { rows: [ann] } = await pool.query(`
      INSERT INTO announcement (msg_type, title, body, target_type, target_ids, created_by)
      VALUES ('NOTICE', $1, $2, $3, $4, $5)
      RETURNING *
    `, [title, body, target_type, target_ids, me.worker_id]);

    let recipientIds: number[] = [];
    if (target_type === 'ALL') {
      const { rows } = await pool.query(
        `SELECT worker_id FROM worker WHERE is_active = TRUE AND worker_id != $1`,
        [me.worker_id],
      );
      recipientIds = rows.map((r: any) => r.worker_id);
    } else if (target_type === 'DEPT' && target_ids.length > 0) {
      const { rows } = await pool.query(
        `SELECT worker_id FROM worker WHERE is_active = TRUE AND dept_id = ANY($1) AND worker_id != $2`,
        [target_ids, me.worker_id],
      );
      recipientIds = rows.map((r: any) => r.worker_id);
    } else if (target_type === 'INDIVIDUAL' && target_ids.length > 0) {
      recipientIds = target_ids.filter((id: number) => id !== me.worker_id);
    }

    await insertReceipts(ann.announcement_id, recipientIds);
    return { ok: true, announcement: ann, recipient_count: recipientIds.length };
  });

  // DELETE /api/announcements/:id  ─ 공지 삭제 (admin)
  app.delete<{ Params: { id: string } }>(
    '/api/announcements/:id',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10);
      const { rowCount } = await pool.query(
        `DELETE FROM announcement WHERE announcement_id = $1 AND msg_type = 'NOTICE'`, [id],
      );
      if (!rowCount) return reply.code(404).send({ error: 'not_found' });
      return { ok: true };
    },
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 쪽지 (MESSAGE) — 누구나 작성, 부서/개인 대상
  // ════════════════════════════════════════════════════════════════════════════

  // GET /api/messages  ─ 내가 받은 쪽지 목록
  app.get('/api/messages', { preHandler: requireAuth }, async (req) => {
    const me = req.auth!;
    const { rows } = await pool.query(`
      SELECT
        a.announcement_id AS message_id,
        a.title, a.body, a.created_at, a.msg_type,
        w.worker_name AS author_name,
        r.is_read, r.read_at
      FROM announcement_receipt r
      JOIN announcement a ON a.announcement_id = r.announcement_id
      LEFT JOIN worker w ON w.worker_id = a.created_by
      WHERE r.worker_id = $1 AND a.msg_type = 'MESSAGE'
      ORDER BY a.created_at DESC
      LIMIT 100
    `, [me.worker_id]);
    return { messages: rows };
  });

  // GET /api/messages/sent  ─ 내가 보낸 쪽지 목록
  app.get('/api/messages/sent', { preHandler: requireAuth }, async (req) => {
    const me = req.auth!;
    const { rows } = await pool.query(`
      SELECT
        a.*,
        COUNT(r.receipt_id)::int                              AS total_recipients,
        COUNT(r.receipt_id) FILTER (WHERE r.is_read)::int    AS read_count
      FROM announcement a
      LEFT JOIN announcement_receipt r ON r.announcement_id = a.announcement_id
      WHERE a.created_by = $1 AND a.msg_type = 'MESSAGE'
      GROUP BY a.announcement_id
      ORDER BY a.created_at DESC
      LIMIT 100
    `, [me.worker_id]);
    return { messages: rows };
  });

  // GET /api/messages/:id  ─ 쪽지 상세 + 읽음 처리
  app.get<{ Params: { id: string } }>(
    '/api/messages/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const me = req.auth!;
      const id = parseInt(req.params.id, 10);

      const { rows } = await pool.query(`
        SELECT a.*, w.worker_name AS author_name
        FROM announcement a
        LEFT JOIN worker w ON w.worker_id = a.created_by
        WHERE a.announcement_id = $1 AND a.msg_type = 'MESSAGE'
      `, [id]);
      if (!rows[0]) return reply.code(404).send({ error: 'not_found' });

      await pool.query(`
        UPDATE announcement_receipt
        SET is_read = TRUE, read_at = NOW()
        WHERE announcement_id = $1 AND worker_id = $2 AND is_read = FALSE
      `, [id, me.worker_id]);

      // 수신 현황 (작성자 본인만)
      let recipients: any[] = [];
      if (rows[0].created_by === me.worker_id || me.role === 'admin') {
        const r = await pool.query(`
          SELECT r.is_read, r.read_at, w.worker_name, w.employee_no
          FROM announcement_receipt r
          JOIN worker w ON w.worker_id = r.worker_id
          WHERE r.announcement_id = $1
          ORDER BY r.is_read DESC, w.worker_name
        `, [id]);
        recipients = r.rows;
      }
      return { message: rows[0], recipients };
    },
  );

  // POST /api/messages  ─ 쪽지 보내기 (누구나)
  app.post('/api/messages', { preHandler: requireAuth }, async (req, reply) => {
    const me = req.auth!;
    const parsed = createMessageSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });

    const { title, body, target_type, target_ids } = parsed.data;

    const { rows: [msg] } = await pool.query(`
      INSERT INTO announcement (msg_type, title, body, target_type, target_ids, created_by)
      VALUES ('MESSAGE', $1, $2, $3, $4, $5)
      RETURNING *
    `, [title, body, target_type, target_ids, me.worker_id]);

    let recipientIds: number[] = [];
    if (target_type === 'DEPT') {
      const { rows } = await pool.query(
        `SELECT worker_id FROM worker WHERE is_active = TRUE AND dept_id = ANY($1) AND worker_id != $2`,
        [target_ids, me.worker_id],
      );
      recipientIds = rows.map((r: any) => r.worker_id);
    } else if (target_type === 'INDIVIDUAL') {
      recipientIds = target_ids.filter((id: number) => id !== me.worker_id);
    }

    await insertReceipts(msg.announcement_id, recipientIds);
    return { ok: true, message: msg, recipient_count: recipientIds.length };
  });

  // DELETE /api/messages/:id  ─ 쪽지 삭제 (작성자 본인 or admin)
  app.delete<{ Params: { id: string } }>(
    '/api/messages/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const me = req.auth!;
      const id = parseInt(req.params.id, 10);
      const cond = me.role === 'admin'
        ? `announcement_id = $1 AND msg_type = 'MESSAGE'`
        : `announcement_id = $1 AND msg_type = 'MESSAGE' AND created_by = $2`;
      const params = me.role === 'admin' ? [id] : [id, me.worker_id];
      const { rowCount } = await pool.query(`DELETE FROM announcement WHERE ${cond}`, params);
      if (!rowCount) return reply.code(404).send({ error: 'not_found' });
      return { ok: true };
    },
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 권한 요청 (Permission Request)
  // ════════════════════════════════════════════════════════════════════════════

  // POST /api/permission-requests
  app.post('/api/permission-requests', { preHandler: requireAuth }, async (req, reply) => {
    const me = req.auth!;
    const parsed = createPermReqSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const { menu_id, menu_name, reason } = parsed.data;
    const { rows: [req_] } = await pool.query(`
      INSERT INTO permission_request (worker_id, menu_id, menu_name, reason)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [me.worker_id, menu_id || null, menu_name || null, reason || null]);
    return { ok: true, request: req_ };
  });

  // GET /api/permission-requests  ─ 목록 (admin)
  app.get('/api/permission-requests', { preHandler: requireRole('admin') }, async () => {
    const { rows } = await pool.query(`
      SELECT pr.*, w.worker_name, w.employee_no,
             rv.worker_name AS reviewer_name
      FROM permission_request pr
      JOIN worker w ON w.worker_id = pr.worker_id
      LEFT JOIN worker rv ON rv.worker_id = pr.reviewed_by
      ORDER BY
        CASE pr.status WHEN 'PENDING' THEN 0 ELSE 1 END,
        pr.created_at DESC
    `);
    return { data: rows, requests: rows };
  });


  // GET /api/permission-requests/pending-count  ─ 미처리 건수 (admin)
  app.get('/api/permission-requests/pending-count', { preHandler: requireRole('admin') }, async () => {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM permission_request WHERE status = 'PENDING'`,
    );
    return { count: rows[0].count };
  });

  // PATCH /api/permission-requests/:id  ─ 승인/거절 (admin)
  app.patch<{ Params: { id: string } }>(
    '/api/permission-requests/:id',
    { preHandler: requireRole('admin') },
    async (req, reply) => {
      const me = req.auth!;
      const id = parseInt(req.params.id, 10);
      const parsed = reviewPermReqSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
      const { status, can_read, can_write, can_update, can_delete } = parsed.data;

      const { rows: [pr] } = await pool.query(
        `SELECT * FROM permission_request WHERE request_id = $1`, [id],
      );
      if (!pr) return reply.code(404).send({ error: 'not_found' });
      if (pr.status !== 'PENDING') return reply.code(409).send({ error: 'already_reviewed' });

      await pool.query(`
        UPDATE permission_request
        SET status = $1, reviewed_by = $2, reviewed_at = NOW()
        WHERE request_id = $3
      `, [status, me.worker_id, id]);

      if (status === 'APPROVED' && pr.menu_id) {
        await pool.query(`
          INSERT INTO user_permission_override
            (worker_id, menu_id, override_mode, can_read, can_write, can_update, can_delete, updated_at, updated_by, reason)
          VALUES ($1, $2, 'ADD', $3, $4, $5, $6, NOW(), $7, '권한 요청 승인에 의한 자동 발급')
          ON CONFLICT (worker_id, menu_id) DO UPDATE
          SET can_read=$3, can_write=$4, can_update=$5, can_delete=$6, override_mode='ADD', updated_at=NOW(), updated_by=$7
        `, [pr.worker_id, pr.menu_id, can_read, can_write, can_update, can_delete, me.worker_id]);
      }

      return { ok: true };
    },
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 비로그인 문의 전송 (로그인 페이지 → 관리자 쪽지함)
  // POST /api/announcements/public-inquiry  (인증 불필요)
  // ════════════════════════════════════════════════════════════════════════════
  app.post('/api/announcements/public-inquiry', async (req, reply) => {
    try {
      const { sender_name, sender_contact, message } = req.body as any;
      if (!sender_name?.trim() || !message?.trim()) {
        return reply.status(400).send({ error: '이름과 문의내용은 필수입니다.' });
      }

      // public_inquiries 테이블 자동 생성
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public_inquiries (
          id            SERIAL PRIMARY KEY,
          sender_name   VARCHAR(100) NOT NULL,
          sender_contact VARCHAR(100),
          message       TEXT NOT NULL,
          is_read       BOOLEAN DEFAULT FALSE,
          created_at    TIMESTAMPTZ DEFAULT NOW()
        )
      `).catch(() => {});

      // 문의 저장
      const { rows: [inq] } = await pool.query(`
        INSERT INTO public_inquiries (sender_name, sender_contact, message)
        VALUES ($1, $2, $3) RETURNING id
      `, [sender_name.trim(), sender_contact?.trim() || null, message.trim()]);

      // admin 계정 조회 (employee_no = 'admin' 또는 role = 'admin' 첫 번째)
      const { rows: adminRows } = await pool.query(`
        SELECT worker_id FROM worker
        WHERE employee_no = 'admin' OR role = 'admin'
        ORDER BY worker_id LIMIT 1
      `);

      if (adminRows.length > 0) {
        const adminId = adminRows[0].worker_id;
        const title = `[외부문의] ${sender_name.trim()}님의 문의`;
        const body = `${message.trim()}\n\n---\n연락처: ${sender_contact?.trim() || '미입력'}`;

        // announcement에 쪽지로 저장
        const { rows: [ann] } = await pool.query(`
          INSERT INTO announcement
            (msg_type, title, body, target_type, target_ids, created_by)
          VALUES ('MESSAGE', $1, $2, 'INDIVIDUAL', ARRAY[$3]::int[], NULL)
          RETURNING announcement_id
        `, [title, body, adminId]);

        // 수신함에 등록
        await pool.query(`
          INSERT INTO announcement_receipt (announcement_id, worker_id)
          VALUES ($1, $2) ON CONFLICT DO NOTHING
        `, [ann.announcement_id, adminId]);
      }

      return { ok: true, inquiry_id: inq.id, message: '문의가 전송되었습니다.' };
    } catch (e: any) {
      return reply.status(500).send({ error: e.message });
    }
  });

  // GET /api/announcements/public-inquiries  (admin 전용 — 외부 문의 목록)
  app.get('/api/announcements/public-inquiries', { preHandler: requireRole('admin') }, async () => {
    const { rows } = await pool.query(`
      SELECT * FROM public_inquiries ORDER BY created_at DESC LIMIT 100
    `).catch(() => ({ rows: [] }));
    return { data: rows };
  });

  // PATCH /api/announcements/public-inquiries/:id/read  (읽음 처리)
  app.patch('/api/announcements/public-inquiries/:id/read', { preHandler: requireRole('admin') }, async (req) => {
    await pool.query(
      `UPDATE public_inquiries SET is_read = TRUE WHERE id = $1`,
      [(req.params as any).id]
    ).catch(() => {});
    return { ok: true };
  });
}

