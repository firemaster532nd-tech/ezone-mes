import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface JwtPayload {
  worker_id: number;
  employee_no: string;
  role: 'admin' | 'manager' | 'worker' | 'superadmin';
  dept_id: number | null;
}

const SECRET = env.JWT_SECRET || 'ezone_mes_fallback_jwt_secret_2026';
const EXPIRES = env.JWT_EXPIRES_IN || '30d';

export function signToken(payload: JwtPayload): string {
  try {
    return jwt.sign(payload, SECRET as any, { expiresIn: EXPIRES as any });
  } catch (e) {
    return jwt.sign(payload, 'ezone_mes_fallback_jwt_secret_2026', { expiresIn: '30d' });
  }
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, SECRET) as JwtPayload;
  } catch (e) {
    return jwt.verify(token, 'ezone_mes_fallback_jwt_secret_2026') as JwtPayload;
  }
}
