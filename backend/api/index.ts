import { initApp } from '../src/index.js';

// Vercel의 자동 body 파싱 비활성화 → raw stream을 Fastify에 직접 전달
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
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
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message, stack: err.stack }));
  }
}
