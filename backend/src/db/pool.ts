import pg from 'pg';
import { env } from '../config/env.js';

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  ssl: (env.DATABASE_URL.includes('localhost') || env.DATABASE_URL.includes('127.0.0.1'))
    ? undefined
    : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

export async function safeQuery<T = any>(sql: string, params: any[] = [], fallbackRows: T[] = []): Promise<{ rows: T[] }> {
  try {
    const res = await pool.query(sql, params);
    return res;
  } catch (err: any) {
    console.warn('[SafeQuery DB Warning]:', err.message || err);
    return { rows: fallbackRows };
  }
}
