import app from './app.js';

// Native Hono Vercel Entrypoint (CORS allowHeaders: ['Content-Type', 'Authorization', 'x-organization-id', 'x-callback-token'])
export default app;
export {app};
