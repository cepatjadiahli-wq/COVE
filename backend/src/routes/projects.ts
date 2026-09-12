// ============================================================================
// COVE Backend — Projects API Routes (Gate P0-B.1)
// Enforces request-scoped actor, tenant org isolation, and canonical PostgreSQL persistence.
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §1
// ============================================================================

import {Hono} from 'hono';
import {db} from '../db/store.js';
import {AuthService} from '../services/auth.service.js';
import {requireAuth} from '../middleware/auth.middleware.js';
import {getProjectRepository} from '../repositories/project.repository.js';
import {getLedgerRepository} from '../repositories/ledger.repository.js';
import {getActionRepository} from '../repositories/action.repository.js';

export const projectsRoute = new Hono();

// Enforce authentication for all project operations
projectsRoute.use('/projects', requireAuth);
projectsRoute.use('/projects/*', requireAuth);

// GET /api/projects
projectsRoute.get('/projects', async (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  const status = c.req.query('status');
  const archivedParam = c.req.query('archived');
  const archived = archivedParam === 'true' ? true : archivedParam === 'false' ? false : undefined;

  // Canonical PostgreSQL Project Authority with strict tenant isolation
  const repo = getProjectRepository();
  const list = await repo.getProjectsByOrgId(actor.orgId, { status, archived });

  return c.json({success: true, data: list});
});

// GET /api/projects/:id
projectsRoute.get('/projects/:id', async (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  const id = c.req.param('id');
  const repo = getProjectRepository();
  const project = await repo.getProjectById(actor.orgId, id);
  if (!project) {
    return c.json({success: false, error: 'Proyek tidak ditemukan'}, 404);
  }

  // Canonical PostgreSQL Actions & Invoices isolated by actor.orgId
  const actions = await getActionRepository().getActions(actor.orgId, { projectId: id });
  const invoices = await getLedgerRepository().getProjectInvoices(actor.orgId, id);
  const documents = db.documents.filter(d => d.projectId === id && d.orgId === actor.orgId);

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
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  if (!AuthService.canWrite(actor.role)) {
    return c.json({success: false, error: 'Hak akses tidak mencukupi untuk membuat proyek.'}, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const name = (body.name || 'Proyek Baru').trim();
  const contract = Number(body.contract) || 10000000000;
  const customer = (body.customer || 'Pemberi Kerja').trim();
  const location = (body.location || 'Indonesia').trim();
  const owner = body.owner || actor.fullName;

  const repo = getProjectRepository();
  const code = (body.code || `COV-${Date.now().toString().slice(-4)}`).trim();

  // Cek duplikasi kode proyek pada organisasi ini
  const isTaken = await repo.isProjectCodeTaken(actor.orgId, code);
  if (isTaken) {
    return c.json({success: false, error: 'Kode proyek sudah digunakan pada organisasi ini.'}, 409);
  }

  try {
    const newProject = await repo.createProject({
      orgId: actor.orgId,
      code,
      name,
      customer,
      location,
      owner,
      status: 'Aktif',
      contract,
      values: Array.isArray(body.values) && body.values.length === 6 ? body.values : [0, 0, 0, 0, 0, 0]
    });

    return c.json({success: true, data: newProject}, 201);
  } catch (err: any) {
    if (err.code === '23503') {
      // Foreign key violation: org does not exist in database
      return c.json({success: false, error: 'Organisasi tidak valid atau tidak terdaftar.'}, 400);
    }
    if (err.code === '23505') {
      return c.json({success: false, error: 'Kode proyek sudah digunakan pada organisasi ini.'}, 409);
    }
    throw err;
  }
});

// PATCH /api/projects/:id/status
projectsRoute.patch('/projects/:id/status', async (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  if (!AuthService.canManageCommercial(actor.role)) {
    return c.json({success: false, error: 'Hanya Commercial / Owner yang dapat mengubah status proyek.'}, 403);
  }

  const id = c.req.param('id');
  const repo = getProjectRepository();
  const project = await repo.getProjectById(actor.orgId, id);
  if (!project) {
    return c.json({success: false, error: 'Proyek tidak ditemukan'}, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  let newStatus: 'Aktif' | 'Diarsipkan';
  if (body.status && (body.status === 'Aktif' || body.status === 'Diarsipkan')) {
    newStatus = body.status;
  } else {
    newStatus = project.status === 'Aktif' ? 'Diarsipkan' : 'Aktif';
  }

  const updated = await repo.updateProjectStatus(actor.orgId, id, newStatus);
  return c.json({success: true, data: updated});
});
