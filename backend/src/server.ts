import { env } from './config/env.js';
import { initApp } from './index.js';

initApp().then(async (app) => {
  try {
    await app.listen({ port: env.PORT || 3000, host: '0.0.0.0' });
    console.log(`EZONE MES Backend running on port ${env.PORT || 3000}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
});
