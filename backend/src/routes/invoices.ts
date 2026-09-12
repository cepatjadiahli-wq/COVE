// ============================================================================
// COVE Backend — Invoices & Cash Receipts API Routes (Gate P0-B.3)
// Enforces request-scoped actor, fail-closed tenant org isolation, RBAC checks,
// and canonical PostgreSQL project invoice & cash receipt persistence.
// ============================================================================

import {Hono} from 'hono';
import {db} from '../db/store.js';
import {ActionService} from '../services/action.service.js';
import {AuthService} from '../services/auth.service.js';
import {requireAuth} from '../middleware/auth.middleware.js';
import {getProjectRepository} from '../repositories/project.repository.js';
import {getLedgerRepository, type ProjectInvoiceRecord} from '../repositories/ledger.repository.js';
import {parseMoney, isPositiveMoney, compareMoney, subtractMoney} from '../utils/money.js';

export const invoicesRoute = new Hono();

invoicesRoute.use('/invoices', requireAuth);
invoicesRoute.use('/invoices/*', requireAuth);

// GET /api/invoices
invoicesRoute.get('/invoices', async (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  const projectId = c.req.query('projectId');
  const ledgerRepo = getLedgerRepository();

  let invoices: ProjectInvoiceRecord[] = [];

  if (projectId && projectId !== 'all') {
    invoices = await ledgerRepo.getProjectInvoices(actor.orgId, projectId);
  } else {
    const projects = await getProjectRepository().getProjectsByOrgId(actor.orgId, { archived: false }).catch(() => []);
    for (const p of projects) {
      const pinvs = await ledgerRepo.getProjectInvoices(actor.orgId, p.id);
      invoices.push(...pinvs);
    }
  }

  const mapped = invoices.map(i => {
    const overdue = ActionService.calculateDaysOverdue(i.dueAt);
    let statusText = 'Terbit';
    if (i.status === 'PAID') {
      statusText = 'Lunas';
    } else if (overdue > 0) {
      statusText = 'Lewat jatuh tempo';
    } else if (i.status === 'PARTIALLY_PAID') {
      statusText = 'Sebagian dibayar';
    } else {
      statusText = 'Belum dibayar';
    }

    return {
      id: i.id,
      orgId: i.orgId,
      projectId: i.projectId,
      number: i.invoiceNumber,
      invoiceNumber: i.invoiceNumber,
      principal: Number(i.principalAmount),
      principalAmount: i.principalAmount,
      paid: Number(i.paidAmount),
      paidAmount: i.paidAmount,
      remaining: Number(i.remainingAmount),
      remainingAmount: i.remainingAmount,
      issued: i.issuedAt,
      issuedAt: i.issuedAt,
      due: i.dueAt,
      dueAt: i.dueAt,
      certificate: i.certificateReference || '',
      certificateReference: i.certificateReference || '',
      status: i.status === 'PAID' ? 'Terbit' : (i.status === 'PARTIALLY_PAID' ? 'Terbit' : i.status),
      rawStatus: i.status,
      computedStatus: statusText,
      daysOverdue: overdue
    };
  });

  return c.json({success: true, data: mapped});
});

// POST /api/invoices
invoicesRoute.post('/invoices', async (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  if (!AuthService.canManageFinance(actor.role)) {
    return c.json({success: false, error: 'Hanya Finance / Owner yang berwenang menerbitkan tagihan proyek.'}, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const projectId = body.projectId;
  const invNumber = (body.invoiceNumber || body.number || '').trim();
  const rawPrincipal = body.principalAmount ?? body.principal;
  const certificateRef = (body.certificateReference || body.certificate || '').trim();

  if (!projectId || !invNumber) {
    return c.json({success: false, error: 'Semua kolom pokok invoice wajib diisi.'}, 400);
  }

  // Ensure project belongs to actor's organization (strictly fail-closed)
  const project = await getProjectRepository().getProjectById(actor.orgId, projectId);
  if (!project) {
    return c.json({success: false, error: 'Proyek tidak ditemukan pada organisasi ini.'}, 404);
  }

  if (project.status === 'Diarsipkan') {
    return c.json({success: false, error: 'Proyek telah diarsipkan dan tidak dapat menerima mutasi finansial baru.'}, 400);
  }

  const ledgerRepo = getLedgerRepository();

  let allocations = body.allocations;
  if (!allocations || allocations.length === 0) {
    if (!rawPrincipal || !certificateRef) {
      return c.json({success: false, error: 'Semua kolom pokok invoice wajib diisi.'}, 400);
    }

    // Resolve certificate in ledger
    const certs = await ledgerRepo.getCertificates(actor.orgId, projectId);
    const targetCert = certs.find(k => k.id === certificateRef || k.certificateNumber === certificateRef);
    if (!targetCert) {
      return c.json({success: false, error: `Sertifikat ${certificateRef} tidak ditemukan pada proyek ini.`}, 400);
    }

    allocations = [{ certificateId: targetCert.id, amount: rawPrincipal }];
  }

  try {
    const newInvoice = await ledgerRepo.createProjectInvoice({
      orgId: actor.orgId,
      projectId,
      invoiceNumber: invNumber,
      certificateReference: certificateRef,
      issuedAt: body.issuedAt || body.issued,
      dueAt: body.dueAt || body.due,
      description: body.description,
      allocations
    });

    // Mirror into db.invoices for backward compatibility with legacy read consumers
    db.invoices.push({
      id: newInvoice.id,
      orgId: actor.orgId,
      projectId: newInvoice.projectId,
      number: newInvoice.invoiceNumber,
      principal: Number(newInvoice.principalAmount),
      paid: Number(newInvoice.paidAmount),
      status: 'Terbit',
      certificate: newInvoice.certificateReference || '',
      issued: newInvoice.issuedAt,
      due: newInvoice.dueAt
    });

    return c.json({
      success: true,
      data: {
        ...newInvoice,
        number: newInvoice.invoiceNumber,
        principal: Number(newInvoice.principalAmount),
        paid: Number(newInvoice.paidAmount),
        remaining: Number(newInvoice.remainingAmount),
        certificate: newInvoice.certificateReference || ''
      }
    }, 201);
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('sudah digunakan') ? 409 : 400);
    return c.json({success: false, error: err.message || 'Gagal menerbitkan invoice.'}, statusCode);
  }
});

// POST /api/invoices/receipts (Catat Penerimaan Kas Proyek)
invoicesRoute.post('/invoices/receipts', async (c) => {
  const actor = c.get('actor');
  if (!actor.orgId) {
    return c.json({success: false, code: 'TENANT_SELECTION_REQUIRED', error: 'Organisasi aktif diperlukan.'}, 400);
  }
  if (!AuthService.canManageFinance(actor.role)) {
    return c.json({success: false, error: 'Hanya Finance / Owner yang berwenang mencatat penerimaan kas.'}, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const projectId = body.projectId;
  const rawAmount = body.amount ?? body.receivedAmount;

  if (!projectId) {
    return c.json({success: false, error: 'Proyek wajib diisi.'}, 400);
  }

  // Verify project ownership
  const project = await getProjectRepository().getProjectById(actor.orgId, projectId);
  if (!project) {
    return c.json({success: false, error: 'Proyek tidak ditemukan pada organisasi ini.'}, 404);
  }

  if (project.status === 'Diarsipkan') {
    return c.json({success: false, error: 'Proyek telah diarsipkan dan tidak dapat menerima mutasi finansial baru.'}, 400);
  }

  const rawAllocs = body.allocations || [];
  if (rawAllocs.length === 0) {
    return c.json({success: false, error: 'Pilih sedikitnya satu alokasi invoice dengan nilai lebih dari nol.'}, 400);
  }

  const allocations = rawAllocs.map((a: any) => ({
    invoiceId: a.invoiceId || a.projectInvoiceId,
    amount: a.amount
  }));

  const idempotencyKey = (
    c.req.header('idempotency-key') ||
    c.req.header('x-idempotency-key') ||
    body.idempotencyKey ||
    body.idempotency_key ||
    ''
  ).trim();

  if (!idempotencyKey) {
    return c.json({
      success: false,
      error: 'IDEMPOTENCY_KEY_REQUIRED'
    }, 400);
  }

  if (idempotencyKey.length > 120) {
    return c.json({
      success: false,
      error: 'IDEMPOTENCY_KEY_TOO_LONG'
    }, 400);
  }

  try {
    const ledgerRepo = getLedgerRepository();
    const result = await ledgerRepo.createCashReceipt({
      orgId: actor.orgId,
      projectId,
      idempotencyKey,
      receivedAmount: rawAmount,
      receiptNumber: body.receiptNumber,
      receivedAt: body.receivedDate || body.receivedAt,
      bankReference: body.bankReference,
      paymentMethod: body.paymentMethod,
      description: body.description,
      notes: body.notes,
      allocations
    });

    return c.json({
      success: true,
      data: {
        ...result,
        totalAllocated: Number(result.allocatedAmount),
        unallocated: Number(result.unallocatedAmount)
      }
    });
  } catch (err: any) {
    if (err.statusCode === 409 && (err.message?.includes('RECEIPT_IDEMPOTENCY_CONFLICT') || err.message?.includes('idempotensi'))) {
      return c.json({success: false, error: 'RECEIPT_IDEMPOTENCY_CONFLICT', message: err.message}, 409);
    }
    const statusCode = err.statusCode || (err.message?.includes('sudah digunakan') ? 409 : 400);
    return c.json({success: false, error: err.message || 'Gagal mencatat penerimaan kas.'}, statusCode);
  }
});
