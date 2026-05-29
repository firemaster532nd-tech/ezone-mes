import { initApp } from '../src/index.js';

// Vercel의 자동 body 파싱 비활성화 → raw stream을 Fastify에 직접 전달
export const config = {
  api: {
    bodyParser: false,
  },
};

// 허용 도메인 목록
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://ezone-mes-frontend-v2pa.vercel.app',
];

function setCorsHeaders(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[2];
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req: any, res: any) {
  // OPTIONS preflight는 즉시 200으로 응답 (Fastify 초기화 불필요)
  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res);
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const app = await initApp();
    await app.ready();

    // raw body를 Buffer로 읽기
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const rawBody = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

    const response = await app.inject({
      method: req.method,
      url: req.url,
      headers: req.headers,
      payload: rawBody,
    });

    res.statusCode = response.statusCode;
    Object.entries(response.headers).forEach(([key, value]) => {
      if (value !== undefined) {
        res.setHeader(key, value as string);
      }
    });

    res.end(response.rawPayload);
  } catch (err: any) {
    // 서버 에러 시에도 CORS 헤더 포함 → 브라우저에서 에러 내용 확인 가능
    setCorsHeaders(req, res);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message, stack: err.stack }));
  }
}
