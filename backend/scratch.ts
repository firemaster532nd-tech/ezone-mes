import 'dotenv/config';
import handler from './api/index.js';

async function run() {
  try {
    const req = { url: '/api/health', method: 'GET', headers: {} };
    const res = { 
      end: (data) => console.log('Response:', data),
      setHeader: () => {},
      writeHead: () => {}
    };
    await handler(req, res);
    console.log("Handler finished!");
  } catch (err) {
    console.error("HANDLER FAILED:");
    console.error(err);
  }
}
run();
