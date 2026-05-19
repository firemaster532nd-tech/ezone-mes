import { app, initApp } from '../src/index.js';

export default async function (req: any, res: any) {
  await initApp();
  await app.ready();
  app.server.emit('request', req, res);
}
