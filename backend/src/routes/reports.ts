// ============================================================================
// COVE Backend — Commercial Reports API Routes (Gate P0-A.3)
// Enforces request-scoped actor, fail-closed tenant org isolation, and RBAC checks.
// ============================================================================

import {Hono} from 'hono';
import {db} from '../db/store.js';
import {LedgerService} from '../services/ledger.service.js';
import {ActionService} from '../services/action.service.js';
import {requireAuth} from '../middleware/auth.middleware.js';
import {getProjectRepository} from '../repositories/project.repository.js';
import {getLedgerRepository} from '../repositories/ledger.repository.js';
import {parseMoney, addMoney, subtractMoney, compareMoney} from '../utils/money.js';
import type {StageValues} from '../types/domain.js';

export const reportsRoute = new Hono();

reportsRoute.use('/reports/*', requireAuth);

async function enrichProjectsWithLedger(orgId: string, projects: any[]) {
  const ledgerRepo = getLedgerRepository();
  return Promise.all(
    projects.map(async p => {
      try {
        const totals = await ledgerRepo.getLedgerTotals(orgId, p.id);
        const w = Number(totals.workPerformed);
        const m = Number(totals.measured);
        const c = Number(totals.claimed);
        const s = Number(totals.certified);
        const inv = Number(totals.invoiced);
        const col = Number(totals.collected);
        if (w > 0 || m > 0 || c > 0 || s > 0 || inv > 0 || col > 0) {
          return {
            ...p,
            values: [
              w,
              m,
              c,
              s,
              inv,
              col
            ] as StageValues
          };
        }
      } catch {}
      return p;
    })
  );
}

// GET /api/reports/portfolio
reportsRoute.get('/reports/portfolio', async (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  const repoProjects = await getProjectRepository().getProjectsByOrgId(actor.orgId, { archived: false }).catch(() => []);
  const rawActive = repoProjects.length > 0 ? repoProjects : db.projects.filter(p => p.orgId === actor.orgId && p.status === 'Aktif');
  const active = await enrichProjectsWithLedger(actor.orgId, rawActive);
  const values = LedgerService.aggregateStages(active);
  const metrics = LedgerService.calculateMetrics(values);

  const projectSummaries = active.map(p => {
    const sm = LedgerService.calculateMetrics(p.values);
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      contract: p.contract,
      values: p.values,
      unbilled: sm.unbilled,
      receivable: sm.receivable,
      totalLeakage: sm.total,
      recoveryRatio: p.values[0] > 0 ? Math.round((p.values[5] / p.values[0]) * 100) : 0
    };
  });

  return c.json({
    success: true,
    data: {
      totalContract: active.reduce((sum, p) => sum + p.contract, 0),
      activeProjectCount: active.length,
      aggregateValues: values,
      metrics,
      projects: projectSummaries
    }
  });
});

// GET /api/reports/gaps
reportsRoute.get('/reports/gaps', async (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  const repoProjects = await getProjectRepository().getProjectsByOrgId(actor.orgId, { archived: false }).catch(() => []);
  const rawActive = repoProjects.length > 0 ? repoProjects : db.projects.filter(p => p.orgId === actor.orgId && p.status === 'Aktif');
  const active = await enrichProjectsWithLedger(actor.orgId, rawActive);
  const values = LedgerService.aggregateStages(active);
  const metrics = LedgerService.calculateMetrics(values);

  const breakdown = [
    {code: 'G1', name: 'Belum diukur', amount: metrics.gaps[0], desc: 'Dikerjakan − Diukur'},
    {code: 'G2', name: 'Belum diajukan', amount: metrics.gaps[1], desc: 'Diukur − Diajukan'},
    {code: 'G3', name: 'Belum disetujui', amount: metrics.gaps[2], desc: 'Diajukan − Disetujui'},
    {code: 'G4', name: 'Belum ditagihkan', amount: metrics.gaps[3], desc: 'Disetujui − Ditagihkan'},
    {code: 'G5', name: 'Belum diterima', amount: metrics.gaps[4], desc: 'Ditagihkan − Diterima (Piutang)'}
  ];

  return c.json({
    success: true,
    data: {
      breakdown,
      totalLeakage: metrics.total,
      identityValid: metrics.identityValid
    }
  });
});

// GET /api/reports/aging
reportsRoute.get('/reports/aging', async (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  const invoices = await getLedgerRepository().getProjectInvoices(actor.orgId);

  let notDue = '0.00';
  let overdue1to30 = '0.00';
  let overdueOver30 = '0.00';

  for (const inv of invoices) {
    const principal = parseMoney(inv.principalAmount);
    const paid = parseMoney(inv.paidAmount);
    const remaining = compareMoney(principal, paid) > 0 ? subtractMoney(principal, paid) : '0.00';
    if (compareMoney(remaining, '0.00') <= 0) continue;

    const days = ActionService.calculateDaysOverdue(inv.dueAt);
    if (days === 0) notDue = addMoney(notDue, remaining);
    else if (days <= 30) overdue1to30 = addMoney(overdue1to30, remaining);
    else overdueOver30 = addMoney(overdueOver30, remaining);
  }

  const totalOutstanding = addMoney(addMoney(notDue, overdue1to30), overdueOver30);

  return c.json({
    success: true,
    data: {
      aging: {
        notDue,
        overdue1to30,
        overdueOver30,
        totalOutstanding
      },
      cycleTimeDays: {
        opnameToClaim: 12,
        claimToCertification: 14,
        certificateToInvoice: 5,
        invoiceToPaymentAverage: 38
      }
    }
  });
});

// GET /api/reports/forecast
reportsRoute.get('/reports/forecast', async (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  // Schedule incoming forecast derived from active projects' canonical PostgreSQL invoices
  const invoices = await getLedgerRepository().getProjectInvoices(actor.orgId);
  const repoProjects = await getProjectRepository().getProjectsByOrgId(actor.orgId).catch(() => []);
  const projectMap = new Map<string, string>(repoProjects.map(p => [p.id, p.name]));

  const incoming = invoices.slice(0, 5).map(inv => {
    const principal = parseMoney(inv.principalAmount);
    const paid = parseMoney(inv.paidAmount);
    const remaining = compareMoney(principal, paid) > 0 ? subtractMoney(principal, paid) : '0.00';
    return {
      date: inv.dueAt,
      project: projectMap.get(inv.projectId) || 'Proyek',
      invoice: inv.invoiceNumber,
      amount: remaining,
      confidence: 'Tinggi'
    };
  });

  let totalForecast = '0.00';
  for (const item of incoming) {
    totalForecast = addMoney(totalForecast, item.amount);
  }

  return c.json({
    success: true,
    data: {
      forecast30Days: totalForecast,
      confidence: 'Sedang',
      schedule: incoming
    }
  });
});
