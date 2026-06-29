import 'dotenv/config';

// CORS 원본 파싱: 콤마 구분 여러 개 허용 가능
const parseCorsOrigin = (raw: string): string | string[] | RegExp => {
  if (raw === '*') return '*';
  const list = raw.split(',').map(s => s.trim()).filter(Boolean);
  return list.length === 1 ? list[0] : list;
};

export const env = {
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://ezone:ezone1234@localhost:5432/ezone_mes',
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: parseCorsOrigin(
    process.env.CORS_ORIGIN || '*'
  ),
  JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production-ezone-mes-dev-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
};
