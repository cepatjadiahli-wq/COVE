// ============================================================================
// COVE Backend — Invoices & Cash Receipts API Routes (Gate P0-A)
// Enforces request-scoped actor, tenant org isolation, and pure RBAC checks.
// ============================================================================

import {Hono} from 'hono';
import {db} from '../db/store.js';
import {ReceiptService} from '../services/receipt.service.js';
import {ActionService} from '../services/action.service.js';
import {AuthService} from '../services/auth.service.js';
import {requireAuth} from '../middleware/auth.middleware.js';
import type {InvoiceEntity} from '../types/domain.js';

export const invoicesRoute = new Hono();

invoicesRoute.use('/invoices', requireAuth);
invoicesRoute.use('/invoices/*', requireAuth);

// GET /api/invoices
invoicesRoute.get('/invoices', (c) => {
  const actor = c.get('actor');
  const projectId = c.req.query('projectId');

  // Tenant Isolation: only return invoices belonging to actor's organization
  let list = db.invoices.filter(i => {
    if (i.orgId) return i.orgId === actor.orgId;
    const proj = db.projects.find(p => p.id === i.projectId);
    return !proj || !proj.orgId || proj.orgId === actor.orgId;
  });

  if (projectId && projectId !== 'all') {
    list = list.filter(i => i.projectId === projectId);
  }

  const mapped = list.map(i => {
    const overdue = ActionService.calculateDaysOverdue(i.due);
    let statusText: string = i.status;
    if (i.status === 'Terbit') {
      if (i.paid >= i.principal) statusText = 'Lunas';
      else if (overdue > 0) statusText = 'Lewat jatuh tempo';
      else if (i.paid > 0) statusText = 'Sebagian dibayar';
      else statusText = 'Belum dibayar';
    }

    return {
      ...i,
      remaining: i.principal - i.paid,
      daysOverdue: overdue,
      computedStatus: statusText
    };
  });

  return c.json({success: true, data: mapped});
});

// POST /api/invoices
invoicesRoute.post('/invoices', async (c) => {
  const actor = c.get('actor');
  if (!AuthService.canManageFinance(actor.role)) {
    return c.json({success: false, error: 'Hanya Finance / Owner yang berwenang menerbitkan tagihan proyek.'}, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const {projectId, number, principal, issued, due, certificate} = body;

  if (!projectId || !number || !principal || !certificate) {
    return c.json({success: false, error: 'Semua kolom pokok invoice wajib diisi.'}, 400);
  }

  const project = db.projects.find(p => p.id === projectId && (!p.orgId || p.orgId === actor.orgId));
  if (!project) {
    return c.json({success: false, error: 'Proyek tidak ditemukan.'}, 404);
  }

  // Cek nomor duplikat pada proyek ini
  if (db.invoices.some(i => i.projectId === projectId && i.number === number)) {
    return c.json({success: false, error: 'Nomor invoice sudah digunakan pada proyek ini.'}, 409);
  }

  // Cek sertifikasi tersedia (Stage 4 - Stage 5)
  const available = project.values[3] - project.values[4];
  if (Number(principal) > available) {
    return c.json({
      success: false,
      error: `Nilai principal (${principal}) melebihi sertifikasi yang belum ditagihkan (${available}).`
    }, 400);
  }

  const newInvoice: InvoiceEntity = {
    id: 'i' + (db.invoices.length + 1),
    orgId: actor.orgId,
    projectId,
    number,
    principal: Number(principal),
    paid: 0,
    issued: issued || '2026-09-08',
    due: due || '2026-10-08',
    certificate,
    status: 'Terbit'
  };

  db.invoices.push(newInvoice);

  // Perbarui nilai Ditagihkan (Stage 5) pada proyek
  project.values[4] += Number(principal);
  project.updated = '8 Sep 2026, 10.00';
  db.save();

  return c.json({success: true, data: newInvoice}, 201);
});

// POST /api/invoices/receipts (Catat Penerimaan Kas Proyek)
invoicesRoute.post('/invoices/receipts', async (c) => {
  const actor = c.get('actor');
  if (!AuthService.canManageFinance(actor.role)) {
    return c.json({success: false, error: 'Hanya Finance / Owner yang berwenang mencatat penerimaan kas.'}, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const amount = Number(body.amount ?? body.receivedAmount);

  // Verify project ownership
  const project = db.projects.find(p => p.id === body.projectId && (!p.orgId || p.orgId === actor.orgId));
  if (!project) {
    return c.json({success: false, error: 'Proyek tidak ditemukan pada organisasi ini.'}, 404);
  }

  const result = ReceiptService.processReceipt({
    projectId: body.projectId,
    amount,
    receivedDate: body.receivedDate || '2026-09-08',
    bankReference: body.bankReference || 'BANK-RCPT-AUTO',
    allocations: body.allocations || []
  });

  if (!result.success) {
    return c.json({success: false, error: result.error}, 400);
  }

  return c.json({success: true, data: result});
});
