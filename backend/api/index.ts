import { initApp } from '../src/index.js';

export default async function (req: any, res: any) {
  try {
    const app = await initApp();
    await app.ready();
    
    const response = await app.inject({
      method: req.method,
      url: req.url,
      headers: req.headers,
      payload: req.body
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
