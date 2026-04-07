import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

export async function tbmRoutes(app: FastifyInstance) {

  // GET /api/tbm/workers - 최근 TBM에서 사용된 작업자 목록
  app.get('/api/tbm/workers', async () => {
    const result = await pool.query(`
      SELECT DISTINCT worker_name, department
      FROM tbm_attendee
      WHERE tbm_id IN (
        SELECT tbm_id FROM tbm_meeting ORDER BY meeting_date DESC LIMIT 20
      )
      ORDER BY worker_name
    `);
    return { data: result.rows };
  });

  // GET /api/tbm - TBM 목록
  app.get('/api/tbm', async (request) => {
    const { date, month, status } = request.query as {
      date?: string; month?: string; status?: string;
    };

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (date) {
      conditions.push(`m.meeting_date = $${idx++}`);
      params.push(date);
    }
    if (month) {
      conditions.push(`TO_CHAR(m.meeting_date, 'YYYY-MM') = $${idx++}`);
      params.push(month);
    }
    if (status) {
      conditions.push(`m.status = $${idx++}`);
      params.push(status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT m.*,
        COALESCE(a.total, 0) as attendee_total,
        COALESCE(a.present, 0) as attendee_present
      FROM tbm_meeting m
      LEFT JOIN (
        SELECT tbm_id,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_present = true) as present
        FROM tbm_attendee
        GROUP BY tbm_id
      ) a ON a.tbm_id = m.tbm_id
      ${where}
      ORDER BY m.meeting_date DESC, m.session
    `, params);

    return { data: result.rows };
  });

  // GET /api/tbm/:id - TBM 상세 (참석자 포함)
  app.get('/api/tbm/:id', async (request) => {
    const { id } = request.params as { id: string };

    const meetingResult = await pool.query(
      'SELECT * FROM tbm_meeting WHERE tbm_id = $1', [id]
    );
    if (meetingResult.rows.length === 0) {
      return { error: 'TBM not found' };
    }

    const attendeeResult = await pool.query(
      'SELECT * FROM tbm_attendee WHERE tbm_id = $1 ORDER BY attendee_id', [id]
    );

    return {
      data: {
        ...meetingResult.rows[0],
        attendees: attendeeResult.rows,
      },
    };
  });

  // POST /api/tbm - TBM 생성
  app.post('/api/tbm', async (request, reply) => {
    const body = request.body as {
      meeting_date: string;
      session: string;
      conductor: string;
      safety_topics?: string;
      work_topics?: string;
      issue_topics?: string;
      weather?: string;
      temperature?: string;
      remarks?: string;
      workers?: { worker_name: string; department?: string }[];
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const meetingResult = await client.query(`
        INSERT INTO tbm_meeting (meeting_date, session, conductor, safety_topics, work_topics, issue_topics, weather, temperature, remarks)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        body.meeting_date, body.session, body.conductor,
        body.safety_topics || null, body.work_topics || null, body.issue_topics || null,
        body.weather || null, body.temperature || null, body.remarks || null,
      ]);

      const tbmId = meetingResult.rows[0].tbm_id;

      if (body.workers && body.workers.length > 0) {
        for (const w of body.workers) {
          await client.query(`
            INSERT INTO tbm_attendee (tbm_id, worker_name, department, is_present)
            VALUES ($1, $2, $3, false)
          `, [tbmId, w.worker_name, w.department || null]);
        }
      }

      await client.query('COMMIT');

      // Return full data with open issues count
      const attendees = await pool.query(
        'SELECT * FROM tbm_attendee WHERE tbm_id = $1 ORDER BY attendee_id', [tbmId]
      );

      const openIssues = await pool.query(
        `SELECT COUNT(*) as count FROM tbm_issue WHERE status IN ('미해결', '진행중', '지연')`
      );

      return reply.code(201).send({
        data: {
          ...meetingResult.rows[0],
          attendees: attendees.rows,
          open_issues_count: parseInt(openIssues.rows[0].count, 10),
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // PATCH /api/tbm/:id - TBM 수정
  app.patch('/api/tbm/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      conductor?: string;
      safety_topics?: string;
      work_topics?: string;
      issue_topics?: string;
      weather?: string;
      temperature?: string;
      remarks?: string;
      status?: string;
    };

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(body)) {
      if (key === 'status' && value === 'COMPLETED') {
        sets.push(`status = $${idx++}`);
        params.push('COMPLETED');
        sets.push(`completed_at = now()`);
      } else if (value !== undefined) {
        sets.push(`${key} = $${idx++}`);
        params.push(value);
      }
    }

    if (sets.length === 0) {
      return { error: 'No fields to update' };
    }

    params.push(id);
    const result = await pool.query(
      `UPDATE tbm_meeting SET ${sets.join(', ')} WHERE tbm_id = $${idx} RETURNING *`,
      params
    );

    return { data: result.rows[0] };
  });

  // POST /api/tbm/:id/attendance - 출석 일괄 업데이트
  app.post('/api/tbm/:id/attendance', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      attendees: { attendee_id: number; is_present: boolean; remarks?: string }[];
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const att of body.attendees) {
        if (att.is_present) {
          await client.query(`
            UPDATE tbm_attendee
            SET is_present = true,
                sign_time = COALESCE(sign_time, now()),
                remarks = $1
            WHERE attendee_id = $2 AND tbm_id = $3
          `, [att.remarks || null, att.attendee_id, id]);
        } else {
          await client.query(`
            UPDATE tbm_attendee
            SET is_present = false,
                sign_time = NULL,
                remarks = $1
            WHERE attendee_id = $2 AND tbm_id = $3
          `, [att.remarks || null, att.attendee_id, id]);
        }
      }

      await client.query('COMMIT');

      const result = await pool.query(
        'SELECT * FROM tbm_attendee WHERE tbm_id = $1 ORDER BY attendee_id', [id]
      );
      return { data: result.rows };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // POST /api/tbm/:id/add-worker - 작업자 추가
  app.post('/api/tbm/:id/add-worker', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { worker_name: string; department?: string };

    const result = await pool.query(`
      INSERT INTO tbm_attendee (tbm_id, worker_name, department, is_present)
      VALUES ($1, $2, $3, false)
      RETURNING *
    `, [id, body.worker_name, body.department || null]);

    return reply.code(201).send({ data: result.rows[0] });
  });

  // DELETE /api/tbm/:id - TBM 삭제 (DRAFT만)
  app.delete('/api/tbm/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const check = await pool.query(
      'SELECT status FROM tbm_meeting WHERE tbm_id = $1', [id]
    );
    if (check.rows.length === 0) {
      return reply.code(404).send({ error: 'TBM not found' });
    }
    if (check.rows[0].status !== 'DRAFT') {
      return reply.code(400).send({ error: '완료된 TBM은 삭제할 수 없습니다.' });
    }

    await pool.query('DELETE FROM tbm_meeting WHERE tbm_id = $1', [id]);
    return { success: true };
  });

  // ──────────────────────────────────────────
  // TBM 이슈 관리 API
  // ──────────────────────────────────────────

  // GET /api/tbm/issues - 이슈 목록 (status 필터, tbm_id 필터)
  app.get('/api/tbm/issues', async (request) => {
    const { status, tbm_id } = request.query as { status?: string; tbm_id?: string };

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (status) {
      const statuses = status.split(',').map((s) => s.trim());
      conditions.push(`i.status = ANY($${idx++}::text[])`);
      params.push(statuses);
    } else {
      // Default: show all non-resolved
      conditions.push(`i.status != '해결'`);
    }

    if (tbm_id) {
      conditions.push(`i.tbm_id = $${idx++}`);
      params.push(parseInt(tbm_id, 10));
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT i.*, m.meeting_date, m.session
      FROM tbm_issue i
      LEFT JOIN tbm_meeting m ON m.tbm_id = i.tbm_id
      ${where}
      ORDER BY
        CASE i.priority WHEN '높음' THEN 1 WHEN '보통' THEN 2 WHEN '낮음' THEN 3 END,
        i.created_at DESC
    `, params);

    return { data: result.rows };
  });

  // GET /api/tbm/issues/open - 미해결+진행중+지연 이슈 (이월용)
  app.get('/api/tbm/issues/open', async () => {
    const result = await pool.query(`
      SELECT i.*, m.meeting_date, m.session
      FROM tbm_issue i
      LEFT JOIN tbm_meeting m ON m.tbm_id = i.tbm_id
      WHERE i.status IN ('미해결', '진행중', '지연')
      ORDER BY
        CASE i.priority WHEN '높음' THEN 1 WHEN '보통' THEN 2 WHEN '낮음' THEN 3 END,
        i.created_at ASC
    `);
    return { data: result.rows };
  });

  // POST /api/tbm/issues - 이슈 생성
  app.post('/api/tbm/issues', async (request, reply) => {
    const body = request.body as {
      tbm_id: number;
      title: string;
      description?: string;
      priority?: string;
      assigned_to?: string;
      due_date?: string;
    };

    const result = await pool.query(`
      INSERT INTO tbm_issue (tbm_id, title, description, priority, assigned_to, due_date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      body.tbm_id,
      body.title,
      body.description || null,
      body.priority || '보통',
      body.assigned_to || null,
      body.due_date || null,
    ]);

    return reply.code(201).send({ data: result.rows[0] });
  });

  // PATCH /api/tbm/issues/:id - 이슈 수정
  app.patch('/api/tbm/issues/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      title?: string;
      description?: string;
      priority?: string;
      status?: string;
      assigned_to?: string;
      resolution?: string;
      due_date?: string;
    };

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) {
        sets.push(`${key} = $${idx++}`);
        params.push(value);
      }
    }

    // Auto-set resolved_at when status changes to 해결
    if (body.status === '해결') {
      sets.push(`resolved_at = now()`);
    } else if (body.status && body.status !== '해결') {
      sets.push(`resolved_at = NULL`);
    }

    if (sets.length === 0) {
      return reply.code(400).send({ error: 'No fields to update' });
    }

    params.push(parseInt(id, 10));
    const result = await pool.query(
      `UPDATE tbm_issue SET ${sets.join(', ')} WHERE issue_id = $${idx} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Issue not found' });
    }

    return { data: result.rows[0] };
  });

  // DELETE /api/tbm/issues/:id - 이슈 삭제
  app.delete('/api/tbm/issues/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await pool.query(
      'DELETE FROM tbm_issue WHERE issue_id = $1 RETURNING issue_id', [parseInt(id, 10)]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Issue not found' });
    }

    return { success: true };
  });
}
