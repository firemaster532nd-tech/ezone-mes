import { app, initApp } from '../src/index';

export default async function (req: any, res: any) {
  try {
    await initApp();
    await app.ready();
    app.server.emit('request', req, res);
  } catch (err: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message, stack: err.stack }));
  }
}
