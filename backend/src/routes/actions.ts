// ============================================================================
// COVE Backend — Actions & Blockers API Routes (Gate P0-B.4)
// Enforces request-scoped actor, fail-closed tenant org isolation, and RBAC checks.
// Canonical PostgreSQL persistence via ActionRepository.
// ============================================================================

import {Hono} from 'hono';
import {AuthService} from '../services/auth.service.js';
import {requireAuth} from '../middleware/auth.middleware.js';
import {getProjectRepository} from '../repositories/project.repository.js';
import {getActionRepository} from '../repositories/action.repository.js';
import {getIdentityRepository} from '../repositories/identity.repository.js';

export const actionsRoute = new Hono();

actionsRoute.use('/actions', requireAuth);
actionsRoute.use('/actions/*', requireAuth);

// GET /api/actions
actionsRoute.get('/actions', async (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  const projectId = c.req.query('projectId');
  const status = c.req.query('status');

  const repo = getActionRepository();
  const list = await repo.getActions(actor.orgId, { projectId, status });

  return c.json({success: true, data: list});
});

// GET /api/actions/:id
actionsRoute.get('/actions/:id', async (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  const id = c.req.param('id');
  const repo = getActionRepository();
  const item = await repo.getActionById(actor.orgId, id);
  if (!item) {
    return c.json({success: false, error: 'Tindakan tidak ditemukan.'}, 404);
  }
  return c.json({success: true, data: item});
});

// POST /api/actions
actionsRoute.post('/actions', async (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  if (!AuthService.canWrite(actor.role)) {
    return c.json({success: false, error: 'Hak akses tidak mencukupi untuk membuat tindakan.'}, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  if (!body.title || !body.blocker || !body.projectId) {
    return c.json({success: false, error: 'Judul, hambatan, dan ID proyek wajib diisi.'}, 400);
  }

  // Ensure project exists and belongs strictly to actor's organization
  const project = await getProjectRepository().getProjectById(actor.orgId, body.projectId);
  if (!project) {
    return c.json({success: false, error: 'Proyek tidak ditemukan pada organisasi ini.'}, 404);
  }

  // Validate assignee/owner does not belong to another tenant
  const assigneeId = body.assigneeId || body.ownerId;
  if (assigneeId) {
    const identityRepo = getIdentityRepository();
    const memberships = await identityRepo.getActiveMembershipsByProfileId(assigneeId);
    if (!memberships.some(m => m.orgId === actor.orgId)) {
      return c.json({success: false, error: 'PIC/Assignee bukan anggota organisasi ini.'}, 400);
    }
  }

  try {
    const repo = getActionRepository();
    const newAction = await repo.createAction({
      orgId: actor.orgId,
      projectId: body.projectId,
      title: body.title,
      blocker: body.blocker,
      owner: body.owner || actor.fullName,
      due: body.due || '2026-09-09',
      severity: body.severity || 'Sedang',
      value: Number(body.value) || 0
    });

    return c.json({success: true, data: newAction}, 201);
  } catch (err: any) {
    return c.json({success: false, error: err.message}, err.statusCode || 500);
  }
});

// POST /api/actions/:id/notes
actionsRoute.post('/actions/:id/notes', async (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  if (!AuthService.canWrite(actor.role)) {
    return c.json({success: false, error: 'Hak akses tidak mencukupi untuk menambah catatan.'}, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const note = body.note || '';
  const resolve = Boolean(body.resolve);

  const repo = getActionRepository();
  const updated = await repo.addNoteOrResolve(actor.orgId, id, note, actor.fullName, resolve);
  if (!updated) {
    return c.json({success: false, error: 'Tindakan tidak ditemukan.'}, 404);
  }

  return c.json({success: true, data: updated});
});

// PATCH /api/actions/:id
actionsRoute.patch('/actions/:id', async (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  if (!AuthService.canWrite(actor.role)) {
    return c.json({success: false, error: 'Hak akses tidak mencukupi untuk mengubah tindakan.'}, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  // Validate assignee/owner does not belong to another tenant
  const assigneeId = body.assigneeId || body.ownerId;
  if (assigneeId) {
    const identityRepo = getIdentityRepository();
    const memberships = await identityRepo.getActiveMembershipsByProfileId(assigneeId);
    if (!memberships.some(m => m.orgId === actor.orgId)) {
      return c.json({success: false, error: 'PIC/Assignee bukan anggota organisasi ini.'}, 400);
    }
  }

  const repo = getActionRepository();
  const updated = await repo.updateAction(actor.orgId, id, body);
  if (!updated) {
    return c.json({success: false, error: 'Tindakan tidak ditemukan.'}, 404);
  }

  return c.json({success: true, data: updated});
});

// DELETE /api/actions/:id
actionsRoute.delete('/actions/:id', async (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  if (!AuthService.canWrite(actor.role)) {
    return c.json({success: false, error: 'Hak akses tidak mencukupi untuk menghapus tindakan.'}, 403);
  }

  const id = c.req.param('id');
  const repo = getActionRepository();
  const deleted = await repo.deleteAction(actor.orgId, id);
  if (!deleted) {
    return c.json({success: false, error: 'Tindakan tidak ditemukan.'}, 404);
  }

  return c.json({success: true, message: 'Tindakan berhasil dihapus.'});
});
