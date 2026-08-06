/**
 * Vercel Serverless Function — Fastify 앱 래핑
 * POST/PUT/PATCH/DELETE 포함 모든 HTTP 메서드 100% 허용
 *
 * 핵심 설정:
 *   - bodyParser: false  → Fastify가 직접 body 파싱 (POST body 소멸 방지)
 *   - externalResolver: true → Fastify가 응답 처리함을 Vercel에 명시 (405 방지)
 */
import type { IncomingMessage, ServerResponse } from 'http';

let appPromise: Promise<any> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const mod = await import('../backend/src/index.js');
      const initApp = mod.initApp;
      const app = await initApp();
      await app.ready();
      return app;
    })();
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // CORS 헤더 — 모든 응답에 선처리
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');

  // OPTIONS preflight 즉시 완료
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const app = await getApp();
    app.server.emit('request', req, res);
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error('[api/index] 오류:', msg);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error', detail: msg }));
    }
  }
}

// 핵심: Vercel이 body를 미리 소비하지 않도록 bodyParser 비활성화
//       externalResolver로 Fastify가 응답을 처리함을 명시 → 405 원천 차단
export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};
