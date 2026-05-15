import 'dotenv/config';

export const env = {
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://ezone:ezone1234@localhost:5432/ezone_mes',
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production-ezone-mes-dev-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
};
