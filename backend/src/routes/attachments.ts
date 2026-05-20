import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { randomUUID } from 'crypto';

// @fastify/multipart augments FastifyRequest with .file()
// We use (request as any).file() for compatibility

let UPLOADS_DIR = process.env.UPLOAD_DIR || '/tmp/uploads';

// Ensure uploads directory exists
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('Could not create UPLOADS_DIR:', UPLOADS_DIR, 'falling back to /tmp');
  UPLOADS_DIR = '/tmp/uploads';
  try {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create fallback /tmp/uploads', e);
  }
}

export async function attachmentRoutes(app: FastifyInstance) {
  // GET /api/attachments - list attachments
  app.get('/api/attachments', async (request) => {
    const { ref_type, ref_id } = request.query as {
      ref_type?: string;
      ref_id?: string;
    };

    let query = 'SELECT * FROM attachment';
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (ref_type) {
      params.push(ref_type);
      conditions.push(`ref_type = $${params.length}`);
    }
    if (ref_id) {
      params.push(parseInt(ref_id, 10));
      conditions.push(`ref_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    return { data: result.rows, total: result.rows.length };
  });

  // POST /api/attachments - upload file
  app.post('/api/attachments', async (request, reply) => {
    const data = await (request as any).file();
    if (!data) {
      return reply.status(400).send({ error: 'Bad Request', message: '파일이 첨부되지 않았습니다.' });
    }

    // Extract fields from multipart
    const fields = data.fields as Record<string, any>;
    const refType = fields.ref_type?.value as string;
    const refId = fields.ref_id?.value as string;
    const uploadedBy = fields.uploaded_by?.value as string | undefined;

    if (!refType || !refId) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'ref_type, ref_id는 필수입니다.',
      });
    }

    // Generate unique filename to prevent collisions
    const ext = path.extname(data.filename);
    const uniqueName = `${Date.now()}_${randomUUID().slice(0, 8)}${ext}`;
    const filePath = path.join(UPLOADS_DIR, uniqueName);

    // Save file to disk
    await pipeline(data.file, fs.createWriteStream(filePath));

    // Get file size
    const stats = fs.statSync(filePath);

    // Insert into database
    const result = await pool.query(
      `INSERT INTO attachment (ref_type, ref_id, file_name, file_path, file_size, mime_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        refType,
        parseInt(refId, 10),
        data.filename,
        uniqueName, // Store relative path within uploads dir
        stats.size,
        data.mimetype,
        uploadedBy || null,
      ]
    );

    return { data: result.rows[0] };
  });

  // DELETE /api/attachments/:id - delete attachment
  app.delete('/api/attachments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const attId = parseInt(id, 10);

    // Get file path before deleting
    const existing = await pool.query('SELECT * FROM attachment WHERE att_id = $1', [attId]);
    if (existing.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '첨부파일을 찾을 수 없습니다.' });
    }

    const filePath = path.join(UPLOADS_DIR, existing.rows[0].file_path);

    // Delete from database
    await pool.query('DELETE FROM attachment WHERE att_id = $1', [attId]);

    // Delete file from disk (non-blocking, ignore errors)
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // File might already be deleted, ignore
    }

    return { data: { success: true, deleted_att_id: attId } };
  });

  // GET /api/attachments/:id/download - download file
  app.get('/api/attachments/:id/download', async (request, reply) => {
    const { id } = request.params as { id: string };
    const attId = parseInt(id, 10);

    const result = await pool.query('SELECT * FROM attachment WHERE att_id = $1', [attId]);
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: '첨부파일을 찾을 수 없습니다.' });
    }

    const att = result.rows[0];
    const filePath = path.join(UPLOADS_DIR, att.file_path);

    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ error: 'Not Found', message: '파일이 서버에 존재하지 않습니다.' });
    }

    const stream = fs.createReadStream(filePath);
    const encodedFilename = encodeURIComponent(att.file_name);
    return reply
      .header('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`)
      .header('Content-Type', att.mime_type || 'application/octet-stream')
      .send(stream);
  });
}
