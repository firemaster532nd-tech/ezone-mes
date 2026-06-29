import { pool } from '../db/pool.js';
import { sendAlimtalk } from '../lib/notification.js';

/** DB 마이그레이션 */
async function migrateApprovalTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS approval_line (
      line_id SERIAL PRIMARY KEY,
      doc_type VARCHAR(30) NOT NULL,
      line_name VARCHAR(100),
      reviewer_id INTEGER REFERENCES worker(worker_id),
      approver_id INTEGER REFERENCES worker(worker_id),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS approval (
      approval_id SERIAL PRIMARY KEY,
      doc_type VARCHAR(30) NOT NULL,
      doc_id INTEGER NOT NULL,
      doc_title VARCHAR(200),
      doc_summary TEXT,
      status VARCHAR(20) DEFAULT 'DRAFT',
      writer_id INTEGER REFERENCES worker(worker_id),
      reviewer_id INTEGER REFERENCES worker(worker_id),
      approver_id INTEGER REFERENCES worker(worker_id),
      reviewed_at TIMESTAMPTZ,
      review_comment TEXT,
      approved_at TIMESTAMPTZ,
      approve_comment TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_approval_status ON approval(status);
    CREATE INDEX IF NOT EXISTS idx_approval_reviewer ON approval(reviewer_id, status);
    CREATE INDEX IF NOT EXISTS idx_approval_approver ON approval(approver_id, status);
    CREATE INDEX IF NOT EXISTS idx_approval_writer ON approval(writer_id);
    CREATE INDEX IF NOT EXISTS idx_approval_doc ON approval(doc_type, doc_id);
  `);
}

const DOC_TYPE_LABELS: Record<string, string> = {
  INCOMING_INSP: '인수검사',
  PROCESS_INSP: '중간검사',
  SELF_INSP: '자주검사',
  SHIPMENT: '출하',
  WORK_ORDER: '작업지시',
  DAILY_LOG: '공정일지',
  TBM: 'TBM',
  INVENTORY: '재고',
  PURCHASE_REQUEST: '자재발주서',
  SOCKET_ORDER: '소켓발주서',
};

export async function approvalRoutes(app: FastifyInstance) {
  // await migrateApprovalTables();

  // ═══════════════════════════════════════════
  // 결재 라인 관리
  // ═══════════════════════════════════════════

  /** GET /api/approval-lines - 결재 라인 목록 */
  app.get('/api/approval-lines', async () => {
    const result = await pool.query(`
      SELECT al.*,
             r.worker_name as reviewer_name, r.position as reviewer_position,
             a.worker_name as approver_name, a.position as approver_position
      FROM approval_line al
      LEFT JOIN worker r ON r.worker_id = al.reviewer_id
      LEFT JOIN worker a ON a.worker_id = al.approver_id
      ORDER BY al.doc_type, al.line_id
    `);
    return { data: result.rows, total: result.rows.length };
  });

  /** POST /api/approval-lines - 결재 라인 생성 */
  app.post('/api/approval-lines', async (request, reply) => {
    const { doc_type, line_name, reviewer_id, approver_id } = request.body as Record<string, any>;
    if (!doc_type || !reviewer_id || !approver_id) {
      return reply.status(400).send({ error: 'doc_type, reviewer_id, approver_id 필수' });
    }
    const result = await pool.query(
      `INSERT INTO approval_line (doc_type, line_name, reviewer_id, approver_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [doc_type, line_name || DOC_TYPE_LABELS[doc_type] || doc_type, reviewer_id, approver_id]
    );
    return { data: result.rows[0] };
  });

  /** PATCH /api/approval-lines/:id */
  app.patch('/api/approval-lines/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, any>;
    const fields = ['doc_type', 'line_name', 'reviewer_id', 'approver_id', 'is_active'];
    const updates: string[] = [];
    const values: any[] = [];
    for (const f of fields) {
      if (f in body) { values.push(body[f]); updates.push(`${f} = $${values.length}`); }
    }
    if (updates.length === 0) return reply.status(400).send({ error: '수정할 항목이 없습니다.' });
    values.push(parseInt(id));
    const result = await pool.query(
      `UPDATE approval_line SET ${updates.join(', ')} WHERE line_id = $${values.length} RETURNING *`, values
    );
    return { data: result.rows[0] };
  });

  /** DELETE /api/approval-lines/:id */
  app.delete('/api/approval-lines/:id', async (request) => {
    const { id } = request.params as { id: string };
    await pool.query('DELETE FROM approval_line WHERE line_id = $1', [parseInt(id)]);
    return { data: { deleted: true } };
  });

  // ═══════════════════════════════════════════
  // 결재 요청 (워크플로우)
  // ═══════════════════════════════════════════

  /** POST /api/approvals - 결재 요청 생성 (작성 → 검토 요청) */
  app.post('/api/approvals', async (request, reply) => {
    const { doc_type, doc_id, doc_title, doc_summary, writer_id } = request.body as Record<string, any>;
    if (!doc_type || !doc_id || !writer_id) {
      return reply.status(400).send({ error: 'doc_type, doc_id, writer_id 필수' });
    }

    // 결재 라인에서 검토/승인자 자동 매핑
    const lineResult = await pool.query(
      'SELECT * FROM approval_line WHERE doc_type = $1 AND is_active = true ORDER BY line_id LIMIT 1',
      [doc_type]
    );

    let reviewerId = null;
    let approverId = null;
    if (lineResult.rows.length > 0) {
      reviewerId = lineResult.rows[0].reviewer_id;
      approverId = lineResult.rows[0].approver_id;
    }

    const result = await pool.query(
      `INSERT INTO approval (doc_type, doc_id, doc_title, doc_summary, status, writer_id, reviewer_id, approver_id)
       VALUES ($1, $2, $3, $4, 'REVIEW', $5, $6, $7) RETURNING *`,
      [doc_type, doc_id, doc_title || '', doc_summary || '', writer_id, reviewerId, approverId]
    );
    const newApproval = result.rows[0];

    // 알림톡 발송 (검토 대기 상태 → 검토자에게 발송)
    if (reviewerId) {
      try {
        const [writerRes, reviewerRes] = await Promise.all([
          pool.query('SELECT worker_name FROM worker WHERE worker_id = $1', [writer_id]),
          pool.query('SELECT worker_name, phone FROM worker WHERE worker_id = $1', [reviewerId])
        ]);

        const writerName = writerRes.rows[0]?.worker_name || '담당자';
        const reviewer = reviewerRes.rows[0];

        if (reviewer && reviewer.phone) {
          const docTitle = doc_title || `${doc_type} 문서`;
          const msg = `[EZONE MES] 새로운 결재(검토) 요청이 있습니다.\n문서명: ${docTitle}\n기안자: ${writerName}`;
          sendAlimtalk(reviewer.worker_name, reviewer.phone, msg).catch(err => {
            console.error('Alimtalk failed to send to reviewer:', err);
          });
        }
      } catch (err) {
        console.error('Failed to prepare alimtalk for reviewer:', err);
      }
    }

    return { data: newApproval };
  });

  /** GET /api/approvals - 결재 목록 (필터: status, writer_id, reviewer_id, approver_id) */
  app.get('/api/approvals', async (request) => {
    const { status, writer_id, reviewer_id, approver_id, doc_type } = request.query as Record<string, string>;
    let query = `
      SELECT ap.*,
             w.worker_name as writer_name, w.position as writer_position,
             rv.worker_name as reviewer_name, rv.position as reviewer_position,
             av.worker_name as approver_name, av.position as approver_position
      FROM approval ap
      LEFT JOIN worker w ON w.worker_id = ap.writer_id
      LEFT JOIN worker rv ON rv.worker_id = ap.reviewer_id
      LEFT JOIN worker av ON av.worker_id = ap.approver_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) { params.push(status); query += ` AND ap.status = $${params.length}`; }
    if (writer_id) { params.push(parseInt(writer_id)); query += ` AND ap.writer_id = $${params.length}`; }
    if (reviewer_id) { params.push(parseInt(reviewer_id)); query += ` AND ap.reviewer_id = $${params.length}`; }
    if (approver_id) { params.push(parseInt(approver_id)); query += ` AND ap.approver_id = $${params.length}`; }
    if (doc_type) { params.push(doc_type); query += ` AND ap.doc_type = $${params.length}`; }

    query += ' ORDER BY ap.updated_at DESC';
    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });

  /** GET /api/approvals/pending - 대기 중인 결재 (role=admin/manager면 전체, 아니면 본인 담당만) */
  app.get('/api/approvals/pending', async (request) => {
    const { worker_id, role } = request.query as { worker_id: string; role?: string };
    if (!worker_id) return { data: { review: [], approve: [], counts: { review: 0, approve: 0 } } };

    const wid = parseInt(worker_id);
    const isAdmin = role === 'admin' || role === 'manager';

    // 검토 대기: admin이면 전체, 일반이면 본인 담당만
    const reviewResult = await pool.query(`
      SELECT ap.*,
             w.worker_name as writer_name, w.position as writer_position,
             rv.worker_name as reviewer_name, rv.position as reviewer_position,
             av.worker_name as approver_name, av.position as approver_position
      FROM approval ap
      LEFT JOIN worker w ON w.worker_id = ap.writer_id
      LEFT JOIN worker rv ON rv.worker_id = ap.reviewer_id
      LEFT JOIN worker av ON av.worker_id = ap.approver_id
      WHERE ap.status = 'REVIEW'
        ${isAdmin ? '' : 'AND ap.reviewer_id = $1'}
      ORDER BY ap.created_at DESC
    `, isAdmin ? [] : [wid]);

    // 승인 대기: admin이면 전체, 일반이면 본인 담당만
    const pendingApproveResult = await pool.query(`
      SELECT ap.*,
             w.worker_name as writer_name, w.position as writer_position,
             rv.worker_name as reviewer_name, rv.position as reviewer_position,
             av.worker_name as approver_name, av.position as approver_position
      FROM approval ap
      LEFT JOIN worker w ON w.worker_id = ap.writer_id
      LEFT JOIN worker rv ON rv.worker_id = ap.reviewer_id
      LEFT JOIN worker av ON av.worker_id = ap.approver_id
      WHERE ap.status = 'PENDING_APPROVE'
        ${isAdmin ? '' : 'AND ap.approver_id = $1'}
      ORDER BY ap.created_at DESC
    `, isAdmin ? [] : [wid]);

    return {
      data: {
        review: reviewResult.rows,
        approve: pendingApproveResult.rows,
        counts: {
          review: reviewResult.rows.length,
          approve: pendingApproveResult.rows.length,
        },
      },
    };
  });

  /** GET /api/approvals/counts - 결재 건수 요약 (배지용) */
  app.get('/api/approvals/counts', async (request) => {
    const { worker_id } = request.query as { worker_id: string };
    if (!worker_id) return { data: { review: 0, approve: 0, total: 0 } };
    const wid = parseInt(worker_id);

    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE reviewer_id = $1 AND status = 'REVIEW') as review_count,
        COUNT(*) FILTER (WHERE approver_id = $1 AND status = 'PENDING_APPROVE') as approve_count
      FROM approval
    `, [wid]);

    const r = parseInt(result.rows[0].review_count) || 0;
    const a = parseInt(result.rows[0].approve_count) || 0;
    return { data: { review: r, approve: a, total: r + a } };
  });

  /** POST /api/approvals/:id/review - 검토 (검토자 또는 admin이 처리) */
  app.post('/api/approvals/:id/review', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { action, comment, worker_id, role } = request.body as {
      action: 'approve' | 'reject' | 'return';
      comment?: string;
      worker_id: number;
      role?: string;
    };

    const apResult = await pool.query('SELECT * FROM approval WHERE approval_id = $1', [parseInt(id)]);
    if (apResult.rows.length === 0) return reply.status(404).send({ error: 'Not Found' });
    const ap = apResult.rows[0];

    if (ap.status !== 'REVIEW') {
      return reply.status(400).send({ error: '검토 대기 상태가 아닙니다.' });
    }
    const isAdmin = role === 'admin' || role === 'manager';
    if (ap.reviewer_id !== worker_id && !isAdmin) {
      return reply.status(403).send({ error: '검토 권한이 없습니다.' });
    }

    let newStatus: string;
    if (action === 'approve') {
      newStatus = 'PENDING_APPROVE'; // 승인자에게 넘김
    } else if (action === 'reject') {
      newStatus = 'REJECTED';
    } else {
      newStatus = 'RETURNED'; // 작성자에게 반려
    }

    const result = await pool.query(
      `UPDATE approval SET status = $1, reviewed_at = now(), review_comment = $2, updated_at = now()
       WHERE approval_id = $3 RETURNING *`,
      [newStatus, comment || null, parseInt(id)]
    );
    const updatedApproval = result.rows[0];

    // 알림톡 발송
    if (newStatus === 'PENDING_APPROVE' && ap.approver_id) {
      try {
        const [reviewerRes, approverRes] = await Promise.all([
          pool.query('SELECT worker_name FROM worker WHERE worker_id = $1', [worker_id]),
          pool.query('SELECT worker_name, phone FROM worker WHERE worker_id = $1', [ap.approver_id])
        ]);
        const reviewerName = reviewerRes.rows[0]?.worker_name || '검토자';
        const approver = approverRes.rows[0];
        if (approver && approver.phone) {
          const docTitle = ap.doc_title || `${ap.doc_type} 문서`;
          const msg = `[EZONE MES] 새로운 결재(승인) 요청이 있습니다.\n문서명: ${docTitle}\n검토자: ${reviewerName}`;
          sendAlimtalk(approver.worker_name, approver.phone, msg).catch(err => {
            console.error('Alimtalk failed to send to approver:', err);
          });
        }
      } catch (err) {
        console.error('Failed to prepare alimtalk for approver:', err);
      }
    } else if ((newStatus === 'REJECTED' || newStatus === 'RETURNED') && ap.writer_id) {
      try {
        const [reviewerRes, writerRes] = await Promise.all([
          pool.query('SELECT worker_name FROM worker WHERE worker_id = $1', [worker_id]),
          pool.query('SELECT worker_name, phone FROM worker WHERE worker_id = $1', [ap.writer_id])
        ]);
        const reviewerName = reviewerRes.rows[0]?.worker_name || '검토자';
        const writer = writerRes.rows[0];
        if (writer && writer.phone) {
          const docTitle = ap.doc_title || `${ap.doc_type} 문서`;
          const actionWord = newStatus === 'REJECTED' ? '반려' : '반송';
          const msg = `[EZONE MES] 기안하신 결재가 검토 단계에서 ${actionWord}되었습니다.\n문서명: ${docTitle}\n검토자: ${reviewerName}\n사유: ${comment || '없음'}`;
          sendAlimtalk(writer.worker_name, writer.phone, msg).catch(err => {
            console.error('Alimtalk failed to send to writer on review reject/return:', err);
          });
        }
      } catch (err) {
        console.error('Failed to prepare alimtalk for writer on review reject/return:', err);
      }
    }

    // ── 자재발주서 결재 연동: 검토 반려/반송 시 PR 상태 되돌리기 ──
    if (ap.doc_type === 'PURCHASE_REQUEST' && ap.doc_id) {
      if (newStatus === 'REJECTED' || newStatus === 'RETURNED') {
        await pool.query(
          `UPDATE purchase_request SET status = 'DRAFT' WHERE pr_id = $1 AND status = 'SUBMITTED'`,
          [ap.doc_id]
        );
      }
    }
    // ── 소켓발주서 결재 연동: 검토 반려/반송 시 socket_order 상태 되돌리기 ──
    if (ap.doc_type === 'SOCKET_ORDER' && ap.doc_id) {
      if (newStatus === 'REJECTED' || newStatus === 'RETURNED') {
        await pool.query(
          `UPDATE socket_order SET status = $1, updated_at = NOW() WHERE so_id = $2 AND status IN ('SUBMITTED','APPROVED')`,
          [newStatus, ap.doc_id]
        );
      }
    }

    return { data: result.rows[0] };
  });

  /** POST /api/approvals/:id/approve - 최종 승인 (승인자 또는 admin이 처리) */
  app.post('/api/approvals/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { action, comment, worker_id, role } = request.body as {
      action: 'approve' | 'reject' | 'return';
      comment?: string;
      worker_id: number;
      role?: string;
    };

    const apResult = await pool.query('SELECT * FROM approval WHERE approval_id = $1', [parseInt(id)]);
    if (apResult.rows.length === 0) return reply.status(404).send({ error: 'Not Found' });
    const ap = apResult.rows[0];

    if (ap.status !== 'PENDING_APPROVE') {
      return reply.status(400).send({ error: '승인 대기 상태가 아닙니다.' });
    }
    const isAdmin = role === 'admin' || role === 'manager';
    if (ap.approver_id !== worker_id && !isAdmin) {
      return reply.status(403).send({ error: '승인 권한이 없습니다.' });
    }

    let newStatus: string;
    if (action === 'approve') {
      newStatus = 'APPROVED';
    } else if (action === 'reject') {
      newStatus = 'REJECTED';
    } else {
      newStatus = 'RETURNED';
    }

    const result = await pool.query(
      `UPDATE approval SET status = $1, approved_at = now(), approve_comment = $2, updated_at = now()
       WHERE approval_id = $3 RETURNING *`,
      [newStatus, comment || null, parseInt(id)]
    );
    const updatedApproval = result.rows[0];

    // 알림톡 발송 (최종 승인 / 반려 / 반송에 따른 기안자 대상 발송)
    if (ap.writer_id) {
      try {
        const [approverRes, writerRes] = await Promise.all([
          pool.query('SELECT worker_name FROM worker WHERE worker_id = $1', [worker_id]),
          pool.query('SELECT worker_name, phone FROM worker WHERE worker_id = $1', [ap.writer_id])
        ]);
        const approverName = approverRes.rows[0]?.worker_name || '승인자';
        const writer = writerRes.rows[0];
        if (writer && writer.phone) {
          const docTitle = ap.doc_title || `${ap.doc_type} 문서`;
          let msg = '';
          if (newStatus === 'APPROVED') {
            msg = `[EZONE MES] 기안하신 결재가 최종 승인되었습니다.\n문서명: ${docTitle}\n승인자: ${approverName}`;
          } else {
            const actionWord = newStatus === 'REJECTED' ? '반려' : '반송';
            msg = `[EZONE MES] 기안하신 결재가 최종 단계에서 ${actionWord}되었습니다.\n문서명: ${docTitle}\n승인자: ${approverName}\n사유: ${comment || '없음'}`;
          }
          sendAlimtalk(writer.worker_name, writer.phone, msg).catch(err => {
            console.error('Alimtalk failed to send to writer on final decision:', err);
          });
        }
      } catch (err) {
        console.error('Failed to prepare alimtalk for writer on final decision:', err);
      }
    }

    // ── 자재발주서 결재 연동: 승인/반려 시 purchase_request 상태 자동 변경 ──
    if (ap.doc_type === 'PURCHASE_REQUEST' && ap.doc_id) {
      if (newStatus === 'APPROVED') {
        await pool.query(
          `UPDATE purchase_request SET status = 'APPROVED' WHERE pr_id = $1 AND status IN ('SUBMITTED', 'DRAFT')`,
          [ap.doc_id]
        );
      } else if (newStatus === 'REJECTED') {
        await pool.query(
          `UPDATE purchase_request SET status = 'DRAFT', remarks = COALESCE(remarks, '') || ' [반려: ' || COALESCE($2, '사유없음') || ']'
           WHERE pr_id = $1 AND status = 'SUBMITTED'`,
          [ap.doc_id, comment || '']
        );
      } else if (newStatus === 'RETURNED') {
        await pool.query(
          `UPDATE purchase_request SET status = 'DRAFT' WHERE pr_id = $1 AND status = 'SUBMITTED'`,
          [ap.doc_id]
        );
      }
    }
    // ── 소켓발주서 결재 연동: 최종 승인/반려/반송 시 socket_order 상태 자동 변경 ──
    if (ap.doc_type === 'SOCKET_ORDER' && ap.doc_id) {
      if (newStatus === 'APPROVED') {
        await pool.query(
          `UPDATE socket_order SET status = 'APPROVED', updated_at = NOW() WHERE so_id = $1 AND status IN ('SUBMITTED','DRAFT')`,
          [ap.doc_id]
        );
      } else if (newStatus === 'REJECTED') {
        await pool.query(
          `UPDATE socket_order SET status = 'REJECTED', updated_at = NOW() WHERE so_id = $1 AND status = 'SUBMITTED'`,
          [ap.doc_id]
        );
      } else if (newStatus === 'RETURNED') {
        await pool.query(
          `UPDATE socket_order SET status = 'RETURNED', updated_at = NOW() WHERE so_id = $1 AND status = 'SUBMITTED'`,
          [ap.doc_id]
        );
      }
    }

    return { data: result.rows[0] };
  });

  /** GET /api/approvals/:id - 결재 상세 */
  app.get('/api/approvals/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await pool.query(`
      SELECT ap.*,
             w.worker_name as writer_name, w.position as writer_position,
             rv.worker_name as reviewer_name, rv.position as reviewer_position,
             av.worker_name as approver_name, av.position as approver_position
      FROM approval ap
      LEFT JOIN worker w ON w.worker_id = ap.writer_id
      LEFT JOIN worker rv ON rv.worker_id = ap.reviewer_id
      LEFT JOIN worker av ON av.worker_id = ap.approver_id
      WHERE ap.approval_id = $1
    `, [parseInt(id)]);
    if (result.rows.length === 0) return reply.status(404).send({ error: 'Not Found' });
    return { data: result.rows[0] };
  });

  /** PATCH /api/approvals/:id - 결재 수정 (검토자/승인자/제목 등) */
  app.patch('/api/approvals/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, any>;

    const apResult = await pool.query('SELECT * FROM approval WHERE approval_id = $1', [parseInt(id)]);
    if (apResult.rows.length === 0) return reply.status(404).send({ error: 'Not Found' });

    const fields = ['doc_title', 'doc_summary', 'reviewer_id', 'approver_id', 'status'];
    const updates: string[] = [];
    const values: any[] = [];
    for (const f of fields) {
      if (f in body) {
        values.push(body[f]);
        updates.push(`${f} = $${values.length}`);
      }
    }
    if (updates.length === 0) return reply.status(400).send({ error: '수정할 항목이 없습니다.' });

    updates.push(`updated_at = now()`);
    values.push(parseInt(id));
    const result = await pool.query(
      `UPDATE approval SET ${updates.join(', ')} WHERE approval_id = $${values.length} RETURNING *`,
      values
    );
    return { data: result.rows[0] };
  });

  /** DELETE /api/approvals/:id - 결재 삭제 (연동된 PR 상태 복원) */
  app.delete('/api/approvals/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const apResult = await pool.query('SELECT * FROM approval WHERE approval_id = $1', [parseInt(id)]);
    if (apResult.rows.length === 0) return reply.status(404).send({ error: 'Not Found' });
    const ap = apResult.rows[0];

    // 자재발주서인 경우 PR 상태를 DRAFT로 복원
    if (ap.doc_type === 'PURCHASE_REQUEST' && ap.doc_id) {
      await pool.query(
        `UPDATE purchase_request SET status = 'DRAFT' WHERE pr_id = $1 AND status IN ('SUBMITTED', 'APPROVED')`,
        [ap.doc_id]
      );
    }
    // 소켓발주서인 경우 socket_order 상태를 DRAFT로 복원
    if (ap.doc_type === 'SOCKET_ORDER' && ap.doc_id) {
      await pool.query(
        `UPDATE socket_order SET status = 'DRAFT', updated_at = NOW() WHERE so_id = $1 AND status IN ('SUBMITTED','APPROVED')`,
        [ap.doc_id]
      );
    }

    await pool.query('DELETE FROM approval WHERE approval_id = $1', [parseInt(id)]);
    return { data: { deleted: true } };
  });
}
