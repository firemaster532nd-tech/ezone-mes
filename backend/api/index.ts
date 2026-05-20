

export default async function (req: any, res: any) {
  try {
    const { initApp } = await import('../src/index.js');
    const app = await initApp();
    await app.ready();
    
    const response = await app.inject({
      method: req.method,
      url: req.url,
      headers: req.headers,
      payload: req.body
    });
    
    res.status(response.statusCode);
    Object.entries(response.headers).forEach(([key, value]) => {
      if (value !== undefined) {
        res.setHeader(key, value as string);
      }
    });
    
    res.send(response.rawPayload);
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
