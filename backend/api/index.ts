import { initApp } from '../src/index.js';

// Vercel의 자동 body 파싱 비활성화 → raw stream을 Fastify에 직접 전달
export const config = {
  api: {
    bodyParser: false,
    // 큰 JSON 요청(base64 파일) 허용
    responseLimit: false,
  },
};

// 허용 도메인 목록
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://ezone-mes-frontend-v2pa.vercel.app',
  // 프로덕션 커스텀 도메인 (.com만 허용)
  'https://xn--sp5btl20d.com',
  'https://www.xn--sp5btl20d.com',
];

function setCorsHeaders(req: any, res: any) {
  const origin = req.headers?.origin || '';
  // 허용 도메인이면 그대로, vercel.app 서브도메인도 허용, 그 외엔 기본값
  const allowed =
    ALLOWED_ORIGINS.includes(origin)
      ? origin
      : origin.endsWith('.vercel.app')
        ? origin
        : ALLOWED_ORIGINS[2];
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req: any, res: any) {
  // OPTIONS preflight는 즉시 204 응답 (Fastify 초기화 불필요)
  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res);
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const app = await initApp();
    await app.ready();

    // raw body 읽기
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const rawBody = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

    // Fastify inject에 넘길 헤더 정제
    // transfer-encoding, host, connection 등은 inject에서 충돌 발생
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers as Record<string, string>)) {
      const lower = k.toLowerCase();
      if (['transfer-encoding', 'host', 'connection'].includes(lower)) continue;
      headers[lower] = v;
    }
    // content-length를 실제 body 크기로 맞춤
    if (rawBody) {
      headers['content-length'] = String(rawBody.length);
    } else {
      delete headers['content-length'];
      delete headers['content-type'];
    }

    const response = await app.inject({
      method: req.method,
      url: req.url,
      headers,
      payload: rawBody,
    });

    // CORS 헤더 추가 (Fastify 응답에 없을 수 있으므로)
    setCorsHeaders(req, res);
    res.statusCode = response.statusCode;
    for (const [key, value] of Object.entries(response.headers)) {
      if (value !== undefined && key.toLowerCase() !== 'access-control-allow-origin') {
        res.setHeader(key, value as string);
      }
    }
    res.end(response.rawPayload);

  } catch (err: any) {
    setCorsHeaders(req, res);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message }));
  }
}
