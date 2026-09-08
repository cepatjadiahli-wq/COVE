import {Hono} from 'hono';
import {cors} from 'hono/cors';
import {serve} from '@hono/node-server';
import {config} from './config.js';

// Import Routes
import {healthRoute} from './routes/health.js';
import {authRoute} from './routes/auth.js';
import {projectsRoute} from './routes/projects.js';
import {ledgerRoute} from './routes/ledger.js';
import {actionsRoute} from './routes/actions.js';
import {invoicesRoute} from './routes/invoices.js';
import {reportsRoute} from './routes/reports.js';
import {billingRoute} from './routes/billing.js';
import {webhooksRoute} from './routes/webhooks.js';
import {supportRoute} from './routes/support.js';
import {adminRoute} from './routes/admin.js';

const app = new Hono();

// CORS Middleware
app.use('*', cors({
  origin: [config.frontendOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-organization-id', 'x-callback-token']
}));

// Global Error Handler
app.onError((err, c) => {
  console.error('API Error:', err);
  return c.json({
    success: false,
    error: err.message || 'Internal Server Error'
  }, 500);
});

// Root Welcome
app.get('/', (c) => {
  return c.json({
    name: 'COVE REST API Server',
    version: '2.1.0',
    documentation: '/api/health',
    endpoints: [
      '/api/health',
      '/api/auth/me',
      '/api/projects',
      '/api/actions',
      '/api/invoices',
      '/api/reports/portfolio',
      '/api/billing',
      '/api/webhooks/mayar',
      '/api/support/tickets',
      '/api/admin/metrics'
    ]
  });
});

// Register Sub-routes under /api
app.route('/api', healthRoute);
app.route('/api', authRoute);
app.route('/api', projectsRoute);
app.route('/api', ledgerRoute);
app.route('/api', actionsRoute);
app.route('/api', invoicesRoute);
app.route('/api', reportsRoute);
app.route('/api', billingRoute);
app.route('/api', webhooksRoute);
app.route('/api', supportRoute);
app.route('/api', adminRoute);

// Start HTTP Server (skip when running unit/integration test runner)
const isRunningTests = process.env.NODE_ENV === 'test' || process.argv.some(a => a.includes('test'));

if (!isRunningTests) {
  serve({
    fetch: app.fetch,
    port: config.port
  }, (info) => {
    console.log(`🚀 COVE Backend API Server running on http://localhost:${info.port}`);
  });
}

export default app;
