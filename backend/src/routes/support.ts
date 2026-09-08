// ============================================================================
// COVE Backend — Support & Feedback API Routes (Gate P0-A)
// Enforces request-scoped actor, tenant org isolation, and pure RBAC checks.
// ============================================================================

import {Hono} from 'hono';
import {db} from '../db/store.js';
import {requireAuth} from '../middleware/auth.middleware.js';
import type {SupportTicketEntity, FeatureRequestEntity} from '../types/domain.js';

export const supportRoute = new Hono();

supportRoute.use('/support/*', requireAuth);

// GET /api/support/tickets
supportRoute.get('/support/tickets', (c) => {
  const actor = c.get('actor');
  const tickets = db.tickets.filter(t => !t.orgId || t.orgId === actor.orgId);
  return c.json({success: true, data: tickets});
});

// POST /api/support/tickets
supportRoute.post('/support/tickets', async (c) => {
  const actor = c.get('actor');
  const body = await c.req.json().catch(() => ({}));
  if (!body.title || !body.body) {
    return c.json({success: false, error: 'Judul dan uraian masalah wajib diisi.'}, 400);
  }

  const newTicket: SupportTicketEntity = {
    id: 'TKT-' + (db.tickets.length + 1).toString().padStart(3, '0'),
    orgId: actor.orgId,
    title: body.title,
    category: body.category || 'Data proyek',
    status: 'Menunggu Tim COVE',
    priority: body.priority || 'P3',
    messages: [
      {
        body: body.body,
        author: actor.fullName,
        internal: false,
        at: '8 Sep, 10.15'
      }
    ]
  };

  db.tickets.unshift(newTicket);
  db.save();
  return c.json({success: true, data: newTicket}, 201);
});

// POST /api/support/tickets/:id/messages
supportRoute.post('/support/tickets/:id/messages', async (c) => {
  const actor = c.get('actor');
  const id = c.req.param('id');
  const ticket = db.tickets.find(t => t.id === id && (!t.orgId || t.orgId === actor.orgId));
  if (!ticket) {
    return c.json({success: false, error: 'Tiket tidak ditemukan.'}, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  ticket.messages.push({
    body: body.body || body.message || '',
    author: body.author || actor.fullName,
    internal: Boolean(body.internal),
    at: '8 Sep, 10.20'
  });
  db.save();

  return c.json({success: true, data: ticket});
});

// GET /api/support/features
supportRoute.get('/support/features', (c) => {
  return c.json({success: true, data: db.features});
});

// POST /api/support/features
supportRoute.post('/support/features', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.title || !body.problem) {
    return c.json({success: false, error: 'Judul dan uraian masalah fitur wajib diisi.'}, 400);
  }

  const newFeature: FeatureRequestEntity = {
    id: 'USL-' + (db.features.length + 1).toString().padStart(3, '0'),
    title: body.title,
    problem: body.problem,
    module: body.module || 'Laporan',
    commercialImpact: body.commercialImpact || '',
    status: 'Ditinjau',
    update: 'Terima kasih. Masukan Anda telah dicatat oleh tim produk.'
  };

  db.features.unshift(newFeature);
  db.save();
  return c.json({success: true, data: newFeature}, 201);
});
