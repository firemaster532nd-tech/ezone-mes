import pg from 'pg';
import { env } from '../config/env.js';

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 3,  // embedded postgres max_connections=15 제한 대응
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  ssl: env.DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});
