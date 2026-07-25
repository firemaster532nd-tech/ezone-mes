/**
 * Vercel Serverless Function — Fastify 앱을 @vercel/node 방식으로 래핑
 * - backend/src/index.ts가 ESModule ("type":"module")이므로 dynamic import() 사용
 * - /api/* 모든 요청을 Fastify로 프록시
 */
import type { IncomingMessage, ServerResponse } from 'http';

let appPromise: Promise<any> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      // ESM 모듈은 require()가 아닌 dynamic import() 사용
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

export const config = {
  maxDuration: 60,
};
