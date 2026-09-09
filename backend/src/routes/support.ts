// ============================================================================
// COVE Backend — Support & Feedback API Routes (Gate P0-A.3)
// Enforces request-scoped actor, fail-closed tenant org isolation, and RBAC checks.
// ============================================================================

import {Hono} from 'hono';
import {db} from '../db/store.js';
import {requireAuth} from '../middleware/auth.middleware.js';
import type {SupportTicketEntity, FeatureRequestEntity} from '../types/domain.js';

export const supportRoute = new Hono();

supportRoute.use('/support', requireAuth);
supportRoute.use('/support/*', requireAuth);

// GET /api/support/tickets
supportRoute.get('/support/tickets', (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  const tickets = db.tickets.filter(t => t.orgId === actor.orgId);
  return c.json({success: true, data: tickets});
});

// POST /api/support/tickets
supportRoute.post('/support/tickets', async (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  const body = await c.req.json().catch(() => ({}));
  if (!body.title || !body.body) {
    return c.json({success: false, error: 'Judul dan uraian masalah wajib diisi.'}, 400);
  }

  const now = new Date();
  const dateFormatted = `${now.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][now.getMonth()]}, ${String(now.getHours()).padStart(2, '0')}.${String(now.getMinutes()).padStart(2, '0')}`;

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
        at: dateFormatted
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
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  const id = c.req.param('id');
  const ticket = db.tickets.find(t => t.id === id && t.orgId === actor.orgId);
  if (!ticket) {
    return c.json({success: false, error: 'Tiket tidak ditemukan.'}, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const messageText = body.body || body.message;
  if (!messageText || typeof messageText !== 'string' || !messageText.trim()) {
    return c.json({success: false, error: 'Isi pesan tidak boleh kosong.'}, 400);
  }

  // Security enforcement:
  // 1. Author must be strictly derived from verified actor, client-supplied author is ignored
  // 2. Internal flag can ONLY be set to true if actor is platform admin
  const isInternal = Boolean(body.internal) && Boolean(actor.isPlatformAdmin);

  const now = new Date();
  const dateFormatted = `${now.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][now.getMonth()]}, ${String(now.getHours()).padStart(2, '0')}.${String(now.getMinutes()).padStart(2, '0')}`;

  ticket.messages.push({
    body: messageText.trim(),
    author: actor.fullName,
    internal: isInternal,
    at: dateFormatted
  });
  db.save();

  return c.json({success: true, data: ticket});
});

// GET /api/support/features
supportRoute.get('/support/features', (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  const features = db.features.filter(f => f.orgId === actor.orgId);
  return c.json({success: true, data: features});
});

// POST /api/support/features
supportRoute.post('/support/features', async (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  const body = await c.req.json().catch(() => ({}));
  if (!body.title || !body.problem) {
    return c.json({success: false, error: 'Judul dan uraian masalah fitur wajib diisi.'}, 400);
  }

  const newFeature: FeatureRequestEntity = {
    id: 'USL-' + (db.features.length + 1).toString().padStart(3, '0'),
    orgId: actor.orgId,
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
