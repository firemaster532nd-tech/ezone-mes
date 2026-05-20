import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface JwtPayload {
  worker_id: number;
  employee_no: string;
  role: 'admin' | 'manager' | 'worker';
  dept_id: number | null;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET as any, { expiresIn: env.JWT_EXPIRES_IN as any });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
