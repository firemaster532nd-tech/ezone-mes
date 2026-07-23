import { initApp } from '../backend/src/index.js';

let appPromise: any = null;

export default async function handler(req: any, res: any) {
  if (!appPromise) {
    appPromise = initApp().then(async (app) => {
      await app.ready();
      return app;
    });
  }
  const app = await appPromise;
  app.server.emit('request', req, res);
}
