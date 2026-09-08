// ============================================================================
// COVE Backend — Projects API Routes (Gate P0-A)
// Enforces request-scoped actor, tenant org isolation, and pure RBAC checks.
// ============================================================================

import {Hono} from 'hono';
import {db} from '../db/store.js';
import {AuthService} from '../services/auth.service.js';
import {requireAuth} from '../middleware/auth.middleware.js';
import type {ProjectEntity} from '../types/domain.js';

export const projectsRoute = new Hono();

// Enforce authentication for all project operations
projectsRoute.use('/projects', requireAuth);
projectsRoute.use('/projects/*', requireAuth);

// GET /api/projects
projectsRoute.get('/projects', (c) => {
  const actor = c.get('actor');
  const status = c.req.query('status');
  const archived = c.req.query('archived');

  // Tenant Isolation: only return projects belonging to actor's organization
  let list = db.projects.filter(p => !p.orgId || p.orgId === actor.orgId);

  if (archived === 'true') {
    list = list.filter(p => p.status === 'Diarsipkan');
  } else if (archived === 'false') {
    list = list.filter(p => p.status === 'Aktif');
  } else if (status && status !== 'Semua status') {
    list = list.filter(p => p.status.toLowerCase() === status.toLowerCase());
  }

  return c.json({success: true, data: list});
});

// GET /api/projects/:id
projectsRoute.get('/projects/:id', (c) => {
  const actor = c.get('actor');
  const id = c.req.param('id');
  const project = db.projects.find(p => p.id === id && (!p.orgId || p.orgId === actor.orgId));
  if (!project) {
    return c.json({success: false, error: 'Proyek tidak ditemukan'}, 404);
  }

  const actions = db.actions.filter(a => a.projectId === id && (!a.orgId || a.orgId === actor.orgId));
  const invoices = db.invoices.filter(i => i.projectId === id && (!i.orgId || i.orgId === actor.orgId));
  const documents = db.documents.filter(d => d.projectId === id && (!d.orgId || d.orgId === actor.orgId));

  return c.json({
    success: true,
    data: {
      project,
      actions,
      invoices,
      documents
    }
  });
});

// POST /api/projects
projectsRoute.post('/projects', async (c) => {
  const actor = c.get('actor');
  if (!AuthService.canWrite(actor.role)) {
    return c.json({success: false, error: 'Hak akses tidak mencukupi untuk membuat proyek.'}, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const name = body.name || 'Proyek Baru';
  const code = body.code || `COV-00${db.projects.length + 1}`;
  const contract = Number(body.contract) || 10000000000;
  const customer = body.customer || 'Pemberi Kerja';
  const location = body.location || 'Indonesia';
  const owner = body.owner || actor.fullName;

  // Cek duplikasi kode proyek pada organisasi ini
  if (db.projects.some(p => (!p.orgId || p.orgId === actor.orgId) && p.code.toLowerCase() === code.trim().toLowerCase())) {
    return c.json({success: false, error: 'Kode proyek sudah digunakan pada organisasi ini.'}, 409);
  }

  const newProject: ProjectEntity = {
    id: 'p' + (db.projects.length + 1),
    orgId: actor.orgId,
    code: code.trim(),
    name: name.trim(),
    customer: customer.trim(),
    location: location.trim(),
    owner,
    status: 'Aktif',
    contract,
    values: Array.isArray(body.values) && body.values.length === 6 ? body.values : [0, 0, 0, 0, 0, 0],
    updated: '8 Sep 2026, 09.55'
  };

  db.projects.push(newProject);
  db.save();

  return c.json({success: true, data: newProject}, 201);
});

// PATCH /api/projects/:id/status
projectsRoute.patch('/projects/:id/status', async (c) => {
  const actor = c.get('actor');
  if (!AuthService.canManageCommercial(actor.role)) {
    return c.json({success: false, error: 'Hanya Commercial / Owner yang dapat mengubah status proyek.'}, 403);
  }

  const id = c.req.param('id');
  const project = db.projects.find(p => p.id === id && (!p.orgId || p.orgId === actor.orgId));
  if (!project) {
    return c.json({success: false, error: 'Proyek tidak ditemukan'}, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  if (body.status && (body.status === 'Aktif' || body.status === 'Diarsipkan')) {
    project.status = body.status;
  } else {
    project.status = project.status === 'Aktif' ? 'Diarsipkan' : 'Aktif';
  }
  project.updated = '8 Sep 2026, 10.00';
  db.save();

  return c.json({success: true, data: project});
});
