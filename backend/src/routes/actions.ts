// ============================================================================
// COVE Backend — Actions & Blockers API Routes (Gate P0-A)
// Enforces request-scoped actor, tenant org isolation, and pure RBAC checks.
// ============================================================================

import {Hono} from 'hono';
import {db} from '../db/store.js';
import {ActionService} from '../services/action.service.js';
import {AuthService} from '../services/auth.service.js';
import {requireAuth} from '../middleware/auth.middleware.js';

export const actionsRoute = new Hono();

actionsRoute.use('/actions', requireAuth);
actionsRoute.use('/actions/*', requireAuth);

// GET /api/actions
actionsRoute.get('/actions', (c) => {
  const actor = c.get('actor');
  const projectId = c.req.query('projectId');
  const status = c.req.query('status');

  // Tenant Isolation: only return actions belonging to actor's organization
  let list = db.actions.filter(a => !a.orgId || a.orgId === actor.orgId);
  if (projectId) list = list.filter(a => a.projectId === projectId);
  if (status) list = list.filter(a => a.status === status);

  const mapped = list.map(a => ({
    ...a,
    daysOverdue: ActionService.calculateDaysOverdue(a.due)
  }));

  return c.json({success: true, data: mapped});
});

// POST /api/actions
actionsRoute.post('/actions', async (c) => {
  const actor = c.get('actor');
  if (!AuthService.canWrite(actor.role)) {
    return c.json({success: false, error: 'Hak akses tidak mencukupi untuk membuat tindakan.'}, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  if (!body.title || !body.blocker || !body.projectId) {
    return c.json({success: false, error: 'Judul, hambatan, dan ID proyek wajib diisi.'}, 400);
  }

  // Ensure project exists and belongs to actor's organization
  const project = db.projects.find(p => p.id === body.projectId && (!p.orgId || p.orgId === actor.orgId));
  if (!project) {
    return c.json({success: false, error: 'Proyek tidak ditemukan pada organisasi ini.'}, 404);
  }

  const newAction = ActionService.createAction({
    projectId: body.projectId,
    title: body.title,
    blocker: body.blocker,
    owner: body.owner || actor.fullName,
    due: body.due || '2026-09-09',
    severity: body.severity || 'Sedang',
    value: Number(body.value) || 0
  });

  // Stamp orgId
  newAction.orgId = actor.orgId;
  db.save();

  return c.json({success: true, data: newAction}, 201);
});

// POST /api/actions/:id/notes
actionsRoute.post('/actions/:id/notes', async (c) => {
  const actor = c.get('actor');
  if (!AuthService.canWrite(actor.role)) {
    return c.json({success: false, error: 'Hak akses tidak mencukupi untuk menambah catatan.'}, 403);
  }

  const id = c.req.param('id');
  const action = db.actions.find(a => a.id === id && (!a.orgId || a.orgId === actor.orgId));
  if (!action) {
    return c.json({success: false, error: 'Tindakan tidak ditemukan.'}, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const note = body.note || '';
  const resolve = Boolean(body.resolve);

  const result = ActionService.addNoteOrResolve(id, note, actor.fullName, resolve);
  if (!result.success) {
    return c.json({success: false, error: result.error}, 400);
  }

  return c.json({success: true, data: result.action});
});
