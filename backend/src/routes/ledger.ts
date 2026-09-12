// ============================================================================
// COVE Backend — Commercial Ledger API Routes (Gate P0-B.2)
// Acuan: COVE_PRD_v2.0 §7, COVE_ERD_v2.0 §3, §5, §7
// Enforces request-scoped actor, fail-closed tenant org isolation, RBAC checks,
// and canonical PostgreSQL progress-to-cash ledger persistence.
// ============================================================================

import {Hono} from 'hono';
import {LedgerService} from '../services/ledger.service.js';
import {AuthService} from '../services/auth.service.js';
import {requireAuth} from '../middleware/auth.middleware.js';
import {getProjectRepository, type ProjectRecord} from '../repositories/project.repository.js';
import {getLedgerRepository} from '../repositories/ledger.repository.js';
import type {StageValues} from '../types/domain.js';

export const ledgerRoute = new Hono();

ledgerRoute.use('/projects/*', requireAuth);

type ResolvedProject =
  | { ok: false; errorResponse: any }
  | { ok: true; actor: any; project: ProjectRecord };

// Helper: validate project access for current tenant actor
async function resolveTenantProject(c: any, projectId: string): Promise<ResolvedProject> {
  const actor = c.get('actor');
  if (!actor || !actor.orgId) {
    return {
      ok: false,
      errorResponse: c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400)
    };
  }
  const project = await getProjectRepository().getProjectById(actor.orgId, projectId);
  if (!project) {
    return {
      ok: false,
      errorResponse: c.json({success: false, error: 'Proyek tidak ditemukan'}, 404)
    };
  }
  return {ok: true, actor, project};
}

// GET /api/projects/:id/ledger
ledgerRoute.get('/projects/:id/ledger', async (c) => {
  const id = c.req.param('id');
  const resolved = await resolveTenantProject(c, id);
  if (!resolved.ok) return resolved.errorResponse;
  const {actor, project} = resolved;

  const totals = await getLedgerRepository().getLedgerTotals(actor.orgId, id);
  const canonicalValues: StageValues = [
    Number(totals.workPerformed),
    Number(totals.measured),
    Number(totals.claimed),
    Number(totals.certified),
    Number(totals.invoiced),
    Number(totals.collected)
  ];

  const metrics = LedgerService.calculateMetrics(canonicalValues);

  return c.json({
    success: true,
    data: {
      projectId: id,
      projectName: project.name,
      contract: project.contract,
      values: canonicalValues,
      totals,
      metrics
    }
  });
});

// POST /api/projects/:id/ledger/entry
ledgerRoute.post('/projects/:id/ledger/entry', async (c) => {
  const id = c.req.param('id');
  const resolved = await resolveTenantProject(c, id);
  if (!resolved.ok) return resolved.errorResponse;
  const {actor, project} = resolved;

  if (!AuthService.canManageCommercial(actor.role)) {
    return c.json({success: false, error: 'Hanya QS / PM / Owner yang berwenang mencatat progres.'}, 403);
  }

  if (project.status === 'Diarsipkan') {
    return c.json({success: false, error: 'Proyek telah diarsipkan dan tidak dapat menerima mutasi finansial baru.'}, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const stageIndex = Number(body.stageIndex);
  const rawAmount = body.amount;
  const reference = (body.reference || `REF-${Date.now()}`).trim();
  const reason = (body.reason || 'Pencatatan ledger baru').trim();

  if (isNaN(stageIndex) || stageIndex < 0 || stageIndex > 5) {
    return c.json({success: false, error: 'Indeks tahapan tidak valid.'}, 400);
  }

  const result = await LedgerService.recordStageEntry(actor.orgId, id, stageIndex, rawAmount, reference, reason);
  if (!result.success) {
    return c.json({success: false, error: result.error}, 400);
  }

  return c.json({success: true, data: result.project});
});

// GET /api/projects/:id/progress
ledgerRoute.get('/projects/:id/progress', async (c) => {
  const id = c.req.param('id');
  const resolved = await resolveTenantProject(c, id);
  if (!resolved.ok) return resolved.errorResponse;
  const {actor} = resolved;

  const lines = await getLedgerRepository().getWorkProgressLines(actor.orgId, id);
  return c.json({success: true, data: lines});
});

// POST /api/projects/:id/progress
ledgerRoute.post('/projects/:id/progress', async (c) => {
  const id = c.req.param('id');
  const resolved = await resolveTenantProject(c, id);
  if (!resolved.ok) return resolved.errorResponse;
  const {actor, project} = resolved;

  if (!AuthService.canManageCommercial(actor.role)) {
    return c.json({success: false, error: 'Hanya QS / PM / Owner yang berwenang mencatat progres.'}, 403);
  }
  if (project.status === 'Diarsipkan') {
    return c.json({success: false, error: 'Proyek telah diarsipkan dan tidak dapat menerima mutasi finansial baru.'}, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const description = String(body.description || '').trim();
  const principalAmount = body.principalAmount;

  if (!description) {
    return c.json({success: false, error: 'Deskripsi progres diperlukan.'}, 400);
  }

  try {
    const line = await getLedgerRepository().createWorkProgressLine({
      orgId: actor.orgId,
      projectId: id,
      description,
      principalAmount,
      quantity: body.quantity ? Number(body.quantity) : 1,
      unit: body.unit ? String(body.unit).trim() : 'LS',
      progressDate: body.progressDate,
      evidenceStatus: body.evidenceStatus
    });
    return c.json({success: true, data: line}, 201);
  } catch (err: any) {
    return c.json({success: false, error: err.message || 'Gagal mencatat progres pekerjaan.'}, err.statusCode || 400);
  }
});

// GET /api/projects/:id/measurements
ledgerRoute.get('/projects/:id/measurements', async (c) => {
  const id = c.req.param('id');
  const resolved = await resolveTenantProject(c, id);
  if (!resolved.ok) return resolved.errorResponse;
  const {actor} = resolved;

  const measurements = await getLedgerRepository().getMeasurements(actor.orgId, id);
  return c.json({success: true, data: measurements});
});

// POST /api/projects/:id/measurements
ledgerRoute.post('/projects/:id/measurements', async (c) => {
  const id = c.req.param('id');
  const resolved = await resolveTenantProject(c, id);
  if (!resolved.ok) return resolved.errorResponse;
  const {actor, project} = resolved;

  if (!AuthService.canManageCommercial(actor.role)) {
    return c.json({success: false, error: 'Hanya QS / PM / Owner yang berwenang mencatat pengukuran.'}, 403);
  }
  if (project.status === 'Diarsipkan') {
    return c.json({success: false, error: 'Proyek telah diarsipkan dan tidak dapat menerima mutasi finansial baru.'}, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const measurementNumber = String(body.measurementNumber || '').trim();
  const allocations = Array.isArray(body.allocations) ? body.allocations : [];

  if (!measurementNumber) {
    return c.json({success: false, error: 'Nomor pengukuran diperlukan.'}, 400);
  }
  if (allocations.length === 0) {
    return c.json({success: false, error: 'Alokasi pengukuran harus memiliki minimal satu item.'}, 400);
  }

  try {
    const measurement = await getLedgerRepository().createMeasurement({
      orgId: actor.orgId,
      projectId: id,
      measurementNumber,
      measurementDate: body.measurementDate,
      description: body.description,
      allocations
    });
    return c.json({success: true, data: measurement}, 201);
  } catch (err: any) {
    return c.json({success: false, error: err.message || 'Gagal mencatat pengukuran.'}, err.statusCode || 400);
  }
});

// GET /api/projects/:id/claims
ledgerRoute.get('/projects/:id/claims', async (c) => {
  const id = c.req.param('id');
  const resolved = await resolveTenantProject(c, id);
  if (!resolved.ok) return resolved.errorResponse;
  const {actor} = resolved;

  const claims = await getLedgerRepository().getClaims(actor.orgId, id);
  return c.json({success: true, data: claims});
});

// POST /api/projects/:id/claims
ledgerRoute.post('/projects/:id/claims', async (c) => {
  const id = c.req.param('id');
  const resolved = await resolveTenantProject(c, id);
  if (!resolved.ok) return resolved.errorResponse;
  const {actor, project} = resolved;

  if (!AuthService.canManageCommercial(actor.role)) {
    return c.json({success: false, error: 'Hanya QS / PM / Owner yang berwenang mengajukan klaim.'}, 403);
  }
  if (project.status === 'Diarsipkan') {
    return c.json({success: false, error: 'Proyek telah diarsipkan dan tidak dapat menerima mutasi finansial baru.'}, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const claimNumber = String(body.claimNumber || '').trim();
  const allocations = Array.isArray(body.allocations) ? body.allocations : [];

  if (!claimNumber) {
    return c.json({success: false, error: 'Nomor klaim diperlukan.'}, 400);
  }
  if (allocations.length === 0) {
    return c.json({success: false, error: 'Alokasi klaim harus memiliki minimal satu item.'}, 400);
  }

  try {
    const claim = await getLedgerRepository().createClaim({
      orgId: actor.orgId,
      projectId: id,
      claimNumber,
      submittedAt: body.submittedAt,
      description: body.description,
      allocations
    });
    return c.json({success: true, data: claim}, 201);
  } catch (err: any) {
    return c.json({success: false, error: err.message || 'Gagal mencatat pengajuan klaim.'}, err.statusCode || 400);
  }
});

// GET /api/projects/:id/certificates
ledgerRoute.get('/projects/:id/certificates', async (c) => {
  const id = c.req.param('id');
  const resolved = await resolveTenantProject(c, id);
  if (!resolved.ok) return resolved.errorResponse;
  const {actor} = resolved;

  const certs = await getLedgerRepository().getCertificates(actor.orgId, id);
  return c.json({success: true, data: certs});
});

// POST /api/projects/:id/certificates
ledgerRoute.post('/projects/:id/certificates', async (c) => {
  const id = c.req.param('id');
  const resolved = await resolveTenantProject(c, id);
  if (!resolved.ok) return resolved.errorResponse;
  const {actor, project} = resolved;

  if (!AuthService.canManageCommercial(actor.role)) {
    return c.json({success: false, error: 'Hanya QS / PM / Owner yang berwenang menerbitkan sertifikat.'}, 403);
  }
  if (project.status === 'Diarsipkan') {
    return c.json({success: false, error: 'Proyek telah diarsipkan dan tidak dapat menerima mutasi finansial baru.'}, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const certificateNumber = String(body.certificateNumber || '').trim();
  const allocations = Array.isArray(body.allocations) ? body.allocations : [];

  if (!certificateNumber) {
    return c.json({success: false, error: 'Nomor sertifikat diperlukan.'}, 400);
  }
  if (allocations.length === 0) {
    return c.json({success: false, error: 'Alokasi sertifikasi harus memiliki minimal satu item.'}, 400);
  }

  try {
    const cert = await getLedgerRepository().createCertificate({
      orgId: actor.orgId,
      projectId: id,
      certificateNumber,
      certifiedAt: body.certifiedAt,
      description: body.description,
      allocations
    });
    return c.json({success: true, data: cert}, 201);
  } catch (err: any) {
    return c.json({success: false, error: err.message || 'Gagal menerbitkan sertifikat.'}, err.statusCode || 400);
  }
});

// GET /api/projects/:id/ledger/lineage
ledgerRoute.get('/projects/:id/ledger/lineage', async (c) => {
  const id = c.req.param('id');
  const resolved = await resolveTenantProject(c, id);
  if (!resolved.ok) return resolved.errorResponse;
  const {actor} = resolved;

  const lineage = await getLedgerRepository().getLineage(actor.orgId, id);
  return c.json({success: true, data: lineage});
});
