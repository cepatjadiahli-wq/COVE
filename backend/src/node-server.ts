import {serve} from '@hono/node-server';
import app from './app.js';
import {config} from './config.js';

serve({
  fetch: app.fetch,
  port: config.port
}, (info) => {
  console.log(`🚀 COVE Backend API Server running on http://localhost:${info.port}`);
});
