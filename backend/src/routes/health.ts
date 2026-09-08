import {Hono} from 'hono';

export const healthRoute = new Hono();

healthRoute.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'cove-backend',
    version: '2.1.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
