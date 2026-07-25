/**
 * Vercel Serverless Function — Fastify 앱을 @vercel/node 방식으로 래핑
 * /api/* 모든 요청을 Fastify로 프록시
 * 첫 요청 시 지연 초기화 (cold start 최적화)
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { initApp } from '../backend/src/index.js';

let appPromise: Promise<any> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = initApp().then(async (app: any) => {
      await app.ready();
      return app;
    });
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp();
    app.server.emit('request', req, res);
  } catch (err: any) {
    console.error('[api/index] 초기화 오류:', err?.message || err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error', detail: err?.message }));
  }
}

export const config = {
  maxDuration: 60,
};
