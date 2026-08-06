/**
 * Vercel Serverless Function — Fastify 앱을 @vercel/node 방식으로 래핑
 * POST/PUT/PATCH/DELETE 포함 모든 메서드 100% 허용
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
  // Vercel이 POST/PUT/DELETE 등을 405로 막는 현상 원천 차단:
  // OPTIONS preflight 즉시 처리
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  try {
    const app = await getApp();
    // Fastify 내부 서버로 요청 위임 (POST/PUT/DELETE 포함 전 메서드 통과)
    app.server.emit('request', req, res);
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error('[api/index] 오류:', msg);
    if (!res.headersSent) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ error: 'Internal Server Error', detail: msg }));
    }
  }
}

export const config = {
  maxDuration: 60,
};
