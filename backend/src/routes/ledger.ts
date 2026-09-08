// ============================================================================
// COVE Backend — Commercial Ledger API Routes (Gate P0-A)
// Enforces request-scoped actor, tenant org isolation, and pure RBAC checks.
// ============================================================================

import {Hono} from 'hono';
import {db} from '../db/store.js';
import {LedgerService} from '../services/ledger.service.js';
import {AuthService} from '../services/auth.service.js';
import {requireAuth} from '../middleware/auth.middleware.js';

export const ledgerRoute = new Hono();

ledgerRoute.use('/projects/*', requireAuth);

// GET /api/projects/:id/ledger
ledgerRoute.get('/projects/:id/ledger', (c) => {
  const actor = c.get('actor');
  const id = c.req.param('id');
  const project = db.projects.find(p => p.id === id && (!p.orgId || p.orgId === actor.orgId));
  if (!project) {
    return c.json({success: false, error: 'Proyek tidak ditemukan'}, 404);
  }

  const metrics = LedgerService.calculateMetrics(project.values);

  return c.json({
    success: true,
    data: {
      projectId: id,
      projectName: project.name,
      contract: project.contract,
      values: project.values,
      metrics
    }
  });
});

// POST /api/projects/:id/ledger/entry
ledgerRoute.post('/projects/:id/ledger/entry', async (c) => {
  const actor = c.get('actor');
  if (!AuthService.canManageCommercial(actor.role)) {
    return c.json({success: false, error: 'Hanya QS / PM / Owner yang berwenang mencatat progres.'}, 403);
  }

  const id = c.req.param('id');
  const project = db.projects.find(p => p.id === id && (!p.orgId || p.orgId === actor.orgId));
  if (!project) {
    return c.json({success: false, error: 'Proyek tidak ditemukan'}, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const stageIndex = Number(body.stageIndex);
  const amount = Number(body.amount);
  const reference = body.reference || 'REF-AUTO';
  const reason = body.reason || 'Pencatatan ledger baru';

  const result = LedgerService.recordStageEntry(id, stageIndex, amount, reference, reason);
  if (!result.success) {
    return c.json({success: false, error: result.error}, 400);
  }

  return c.json({success: true, data: result.project});
});
