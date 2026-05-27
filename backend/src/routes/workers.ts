import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

/** DB 마이그레이션: worker 테이블에 birth_date, role 컬럼 추가 */
async function migrateWorkerTable() {
  await pool.query(`
    ALTER TABLE worker ADD COLUMN IF NOT EXISTS birth_date VARCHAR(10);
    ALTER TABLE worker ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'worker';
  `);
  // Add check constraint if not exists
  try {
    await pool.query(`
      ALTER TABLE worker ADD CONSTRAINT worker_role_check CHECK (role IN ('admin', 'manager', 'worker'))
    `);
  } catch {
    // constraint already exists
  }
  // Insert default admin if no admin exists
  const adminCheck = await pool.query("SELECT 1 FROM worker WHERE role = 'admin' LIMIT 1");
  if (adminCheck.rows.length === 0) {
    await pool.query(`
      INSERT INTO worker (worker_name, birth_date, pin_code, department, position, role)
      VALUES ('관리자', '1990-01-01', '0300', '관리부', '파트장', 'admin')
    `);
  } else {
    // 기존 관리자 PIN이 기본값이면 0300으로 업데이트
    await pool.query(`
      UPDATE worker SET pin_code = '0300' WHERE role = 'admin' AND (pin_code = '0000' OR pin_code IS NULL)
    `);
  }
}

export async function workerRoutes(app: FastifyInstance) {
  // 서버 시작 시 마이그레이션 실행
  // await migrateWorkerTable();

  // GET /api/workers - 작업자 목록
  app.get('/api/workers', async (request) => {
    const { is_active, department, role } = request.query as {
      is_active?: string;
      department?: string;
      role?: string;
    };

    let query = 'SELECT worker_id, worker_name, birth_date, department, position, role, is_active, created_at FROM worker';
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (is_active !== undefined) {
      params.push(is_active === 'true');
      conditions.push(`is_active = $${params.length}`);
    }
    if (department) {
      params.push(department);
      conditions.push(`department = $${params.length}`);
    }
    if (role) {
      params.push(role);
      conditions.push(`role = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY worker_id';

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });

  // POST /api/workers - 작업자 생성
  app.post('/api/workers', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const { worker_name, birth_date, pin_code, department, position, role } = body;

    if (!worker_name) {
      return reply.status(400).send({ error: 'Bad Request', message: 'worker_name은 필수입니다.' });
    }

    // 중복 체크: 이름 + 생년월일
    if (birth_date) {
      const dup = await pool.query(
        'SELECT 1 FROM worker WHERE worker_name = $1 AND birth_date = $2',
        [worker_name, birth_date]
      );
      if (dup.rows.length > 0) {
        return reply.status(409).send({ error: 'Conflict', message: '동일한 이름/생년월일의 사용자가 이미 등록되어 있습니다.' });
      }
    }

    const result = await pool.query(
      `INSERT INTO worker (worker_name, birth_date, pin_code, department, position, role)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING worker_id, worker_name, birth_date, department, position, role, is_active, created_at`,
      [worker_name, birth_date || null, pin_code || null, department || null, position || null, role || 'worker']
    );
    return { data: result.rows[0] };
  });

  // POST /api/workers/bulk - 엑셀 일괄 등록
  app.post('/api/workers/bulk', async (request, reply) => {
    const body = request.body as { workers: Array<Record<string, unknown>> };

    if (!body.workers || !Array.isArray(body.workers) || body.workers.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'workers 배열이 필요합니다.' });
    }

    const results = { success: 0, skipped: 0, errors: [] as string[] };

    for (const w of body.workers) {
      try {
        const name = String(w.worker_name || w['이름'] || '').trim();
        const birth = String(w.birth_date || w['생년월일'] || '').trim();
        const dept = String(w.department || w['부서'] || '').trim();
        const pos = String(w.position || w['직무'] || '').trim();
        const pin = String(w.pin_code || w['PIN'] || '').trim();
        const role = String(w.role || w['권한'] || 'worker').trim();

        if (!name) {
          results.errors.push(`이름 미입력 행 스킵`);
          results.skipped++;
          continue;
        }

        // 중복 체크
        if (birth) {
          const dup = await pool.query(
            'SELECT 1 FROM worker WHERE worker_name = $1 AND birth_date = $2',
            [name, birth]
          );
          if (dup.rows.length > 0) {
            results.errors.push(`${name}(${birth}): 이미 등록됨 - 스킵`);
            results.skipped++;
            continue;
          }
        }

        const validRole = ['admin', 'manager', 'worker'].includes(role) ? role : 'worker';

        await pool.query(
          `INSERT INTO worker (worker_name, birth_date, pin_code, department, position, role)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [name, birth || null, pin || null, dept || null, pos || null, validRole]
        );
        results.success++;
      } catch (err: any) {
        results.errors.push(`${w.worker_name || '?'}: ${err.message}`);
        results.skipped++;
      }
    }

    return { data: results };
  });

  // PATCH /api/workers/:id - 작업자 수정
  app.patch('/api/workers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const allowedFields = ['worker_name', 'birth_date', 'pin_code', 'department', 'position', 'role', 'is_active'];
    const updates: string[] = [];
    const values: unknown[] = [];

    for (const field of allowedFields) {
      if (field in body) {
        values.push(body[field]);
        updates.push(`${field} = $${values.length}`);
      }
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: '수정할 항목이 없습니다.' });
    }

    values.push(parseInt(id, 10));
    const result = await pool.query(
      `UPDATE worker SET ${updates.join(', ')} WHERE worker_id = $${values.length}
       RETURNING worker_id, worker_name, birth_date, department, position, role, is_active, created_at`,
      values
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '작업자를 찾을 수 없습니다.' });
    }
    return { data: result.rows[0] };
  });

  // DELETE /api/workers/:id - 작업자 삭제
  app.delete('/api/workers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const workerId = parseInt(id, 10);

    // 연관 데이터 체크
    const linked = await pool.query(
      'SELECT COUNT(*) as cnt FROM process_log WHERE worker_id = $1',
      [workerId]
    );
    if (parseInt(linked.rows[0].cnt) > 0) {
      // 비활성화 처리
      await pool.query('UPDATE worker SET is_active = false WHERE worker_id = $1', [workerId]);
      return { data: { message: '연관 데이터가 있어 비활성화 처리되었습니다.', deactivated: true } };
    }

    const result = await pool.query('DELETE FROM worker WHERE worker_id = $1 RETURNING worker_id', [workerId]);
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '작업자를 찾을 수 없습니다.' });
    }
    return { data: { message: '삭제되었습니다.', deleted: true } };
  });

  // PATCH /api/workers/:id/allowed-modes — 모드 접근 권한 변경 (admin only)
  app.patch('/api/workers/:id/allowed-modes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { allowed_modes } = request.body as { allowed_modes?: string };
    if (!allowed_modes || !['shop', 'both'].includes(allowed_modes)) {
      return reply.status(400).send({ error: 'Bad Request', message: "allowed_modes는 'shop' 또는 'both' 이어야 합니다." });
    }
    const result = await pool.query(
      `UPDATE worker SET allowed_modes = $1 WHERE worker_id = $2
       RETURNING worker_id, worker_name, allowed_modes`,
      [allowed_modes, parseInt(id, 10)]
    );
    if (result.rows.length === 0) return reply.status(404).send({ error: 'Not Found' });
    return { data: result.rows[0] };
  });

  app.post('/api/workers/admin-login', async (request, reply) => {
    const { pin_code } = request.body as { pin_code?: string };
    if (!pin_code) {
      return reply.status(400).send({ error: 'Bad Request', message: '비밀번호를 입력해주세요.' });
    }

    const result = await pool.query(
      `SELECT worker_id, worker_name, birth_date, department, position, role, is_active
       FROM worker WHERE role = 'admin' AND pin_code = $1 AND is_active = true LIMIT 1`,
      [pin_code]
    );

    if (result.rows.length === 0) {
      return reply.status(401).send({ error: 'Unauthorized', message: '비밀번호가 올바르지 않습니다.' });
    }
    return { data: result.rows[0] };
  });

  // POST /api/workers/login - 로그인 (이름 + 생년월일)
  app.post('/api/workers/login', async (request, reply) => {
    const { worker_name, birth_date, pin_code } = request.body as {
      worker_name?: string;
      birth_date?: string;
      pin_code?: string;
    };

    if (!worker_name) {
      return reply.status(400).send({ error: 'Bad Request', message: '이름은 필수입니다.' });
    }

    // 이름 + 생년월일 로그인 (기본)
    if (birth_date) {
      const result = await pool.query(
        `SELECT worker_id, worker_name, birth_date, department, position, role, is_active
         FROM worker WHERE worker_name = $1 AND birth_date = $2 AND is_active = true`,
        [worker_name, birth_date]
      );
      if (result.rows.length === 0) {
        return reply.status(401).send({ error: 'Unauthorized', message: '이름 또는 생년월일이 올바르지 않습니다.' });
      }
      return { data: result.rows[0] };
    }

    // PIN 로그인 (공정 실행용)
    if (pin_code) {
      const result = await pool.query(
        `SELECT worker_id, worker_name, birth_date, department, position, role, is_active
         FROM worker WHERE worker_name = $1 AND pin_code = $2 AND is_active = true`,
        [worker_name, pin_code]
      );
      if (result.rows.length === 0) {
        return reply.status(401).send({ error: 'Unauthorized', message: '작업자 인증 실패' });
      }
      return { data: result.rows[0] };
    }

    return reply.status(400).send({ error: 'Bad Request', message: '생년월일 또는 PIN이 필요합니다.' });
  });

  // GET /api/workers/:id/stats - 작업자 통계
  app.get('/api/workers/:id/stats', async (request, reply) => {
    const { id } = request.params as { id: string };
    const workerId = parseInt(id, 10);

    const workerResult = await pool.query(
      'SELECT worker_id, worker_name, birth_date, department, position, role FROM worker WHERE worker_id = $1',
      [workerId]
    );
    if (workerResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '작업자를 찾을 수 없습니다.' });
    }

    const statsResult = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_count,
         COUNT(*) as total_count,
         COALESCE(SUM(produced_qty) FILTER (WHERE status = 'COMPLETED'), 0) as total_produced,
         COALESCE(SUM(defect_qty) FILTER (WHERE status = 'COMPLETED'), 0) as total_defect,
         COALESCE(
           SUM(EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600) FILTER (WHERE status = 'COMPLETED'),
           0
         ) as total_hours
       FROM process_log WHERE worker_id = $1`,
      [workerId]
    );

    const stats = statsResult.rows[0];
    const totalProduced = parseFloat(stats.total_produced) || 0;
    const totalDefect = parseFloat(stats.total_defect) || 0;
    const defectRate = totalProduced > 0 ? ((totalDefect / totalProduced) * 100).toFixed(2) : '0.00';

    return {
      data: {
        worker: workerResult.rows[0],
        completed_count: parseInt(stats.completed_count),
        total_count: parseInt(stats.total_count),
        total_produced: totalProduced,
        total_defect: totalDefect,
        total_hours: parseFloat(parseFloat(stats.total_hours).toFixed(1)),
        defect_rate: parseFloat(defectRate),
      },
    };
  });
}
