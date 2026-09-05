/**
 * COVE Phase 18: Payment Reconciliation Engine
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md & PRD v1.0
 * 
 * Rules:
 * 1. Payment received !== invoice fully settled !== subscription reactivated.
 * 2. Partial payments are captured in reconciliation_queue without activating subscriptions.
 * 3. Multiple partial payments settle the invoice ONLY when cumulative settled amount >= amount_due.
 * 4. Overpayments are recorded for reconciliation without artificially extending subscription period.
 * 5. Unmatched / cross-tenant / duplicate suspected transactions are quarantined for investigation.
 * 6. Admin reconciliation actions require mandatory reason, before/after snapshot, and are idempotent.
 */

import { createAdminClient } from "../../lib/supabase/admin";

export type ReconciliationStatus =
  | "UNAPPLIED"
  | "PARTIALLY_APPLIED"
  | "OVERPAYMENT"
  | "DUPLICATE_SUSPECTED"
  | "TENANT_MISMATCH"
  | "INVOICE_MISMATCH"
  | "MANUAL_REVIEW"
  | "REFUNDED"
  | "CHARGEBACK"
  | "REVERSED"
  | "RESOLVED";

export interface ReconciliationItem {
  id: string;
  paymentId?: string | null;
  billingInvoiceId?: string | null;
  orgId?: string | null;
  status: ReconciliationStatus;
  amount: number;
  unappliedAmount: number;
  appliedAmount: number;
  reason?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReconcilePaymentParams {
  reconciliationId: string;
  targetBillingInvoiceId: string;
  adminId: string;
  reason: string;
  applyAmount?: number;
  notes?: string;
}

export interface ReconcilePaymentResult {
  success: boolean;
  reconciliationId: string;
  status: ReconciliationStatus;
  appliedAmount: number;
  remainingUnappliedAmount: number;
  invoiceSettled: boolean;
  subscriptionReactivated: boolean;
  auditLogId?: string;
  error?: string;
}

/**
 * Evaluates whether cumulative payments for an invoice now meet or exceed amount_total.
 * If yes, marks invoice as PAID and restores subscription to ACTIVE.
 */
export async function evaluateInvoicePaymentSettlement(
  billingInvoiceId: string
): Promise<{
  invoiceSettled: boolean;
  totalPaid: number;
  amountDue: number;
  subscriptionReactivated: boolean;
}> {
  const supabase = createAdminClient();

  const { data: invoice, error: invErr } = await supabase
    .from("billing_invoices")
    .select("id, org_id, subscription_id, invoice_number, amount_total, status")
    .eq("id", billingInvoiceId)
    .single();

  if (invErr || !invoice) {
    throw new Error(`Billing invoice ${billingInvoiceId} not found`);
  }

  // Sum all settled payments linked to this invoice
  const { data: payments, error: payErr } = await supabase
    .from("payments")
    .select("id, amount, status")
    .eq("billing_invoice_id", billingInvoiceId)
    .in("status", ["SUCCEEDED", "SETTLED"]);

  if (payErr) {
    throw new Error(`Failed to query payments for invoice ${billingInvoiceId}: ${payErr.message}`);
  }

  const totalPaid = (payments || []).reduce((acc: number, p: { amount?: number | string | null }) => acc + Number(p.amount || 0), 0);
  const amountDue = Number(invoice.amount_total || 0);

  if (totalPaid >= amountDue && invoice.status !== "PAID") {
    // Settle invoice
    await supabase
      .from("billing_invoices")
      .update({
        status: "PAID",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", billingInvoiceId);

    let subscriptionReactivated = false;
    if (invoice.subscription_id) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, status, org_id")
        .eq("id", invoice.subscription_id)
        .single();

      if (sub && ["PAST_DUE", "READ_ONLY", "SUSPENDED"].includes(sub.status)) {
        await supabase
          .from("subscriptions")
          .update({
            status: "ACTIVE",
            grace_period_end: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.id);

        await supabase
          .from("organizations")
          .update({
            subscription_status: "ACTIVE",
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.org_id);

        await supabase.from("subscription_status_events").insert({
          subscription_id: sub.id,
          previous_status: sub.status,
          new_status: "ACTIVE",
          trigger: "PAYMENT_RECOVERY_ACCUMULATED",
          reason: `Faktur ${invoice.invoice_number} lunas melalui akumulasi pembayaran Rp ${totalPaid}.`,
          metadata: {
            billing_invoice_id: billingInvoiceId,
            cumulative_paid: totalPaid,
            invoice_amount: amountDue,
          },
        });

        subscriptionReactivated = true;
      }
    }

    return {
      invoiceSettled: true,
      totalPaid,
      amountDue,
      subscriptionReactivated,
    };
  }

  return {
    invoiceSettled: invoice.status === "PAID",
    totalPaid,
    amountDue,
    subscriptionReactivated: false,
  };
}

/**
 * Controlled Admin Action: Manually reconcile an unapplied or partial payment to a billing invoice.
 * Executes atomically via PostgreSQL procedure with row-level locking (FOR UPDATE).
 */
export async function reconcilePaymentManually(
  params: ReconcilePaymentParams
): Promise<ReconcilePaymentResult> {
  if (!params.reason || params.reason.trim().length < 5) {
    throw new Error("RECONCILIATION_REASON_REQUIRED: Alasan rekonsiliasi manual wajib diisi secara jelas (minimal 5 karakter).");
  }

  const supabase = createAdminClient();

  // Execute atomic procedure with row locks
  const { data: rpcResult, error: rpcErr } = await supabase.rpc("reconcile_payment_atomic", {
    p_reconciliation_id: params.reconciliationId,
    p_target_invoice_id: params.targetBillingInvoiceId,
    p_admin_id: params.adminId,
    p_reason: params.reason,
    p_apply_amount: params.applyAmount || null,
    p_notes: params.notes || null,
  });

  if (rpcErr) {
    const msg = rpcErr.message || "";
    if (msg.includes("ITEM_ALREADY_RESOLVED")) {
      const err: any = new Error(`ITEM_ALREADY_RESOLVED: Item ${params.reconciliationId} sudah diselesaikan oleh transaksi lain.`);
      err.statusCode = 409;
      throw err;
    }
    if (msg.includes("RECONCILIATION_ITEM_NOT_FOUND")) {
      const err: any = new Error(`RECONCILIATION_ITEM_NOT_FOUND: Item ${params.reconciliationId} tidak ditemukan.`);
      err.statusCode = 404;
      throw err;
    }
    if (msg.includes("INVOICE_NOT_FOUND")) {
      const err: any = new Error(`INVOICE_NOT_FOUND: Faktur tujuan ${params.targetBillingInvoiceId} tidak ditemukan.`);
      err.statusCode = 404;
      throw err;
    }
    if (msg.includes("INVALID_APPLY_AMOUNT")) {
      const err: any = new Error(`INVALID_APPLY_AMOUNT: Nominal alokasi tidak valid atau melebihi saldo.`);
      err.statusCode = 400;
      throw err;
    }
    throw new Error(`Gagal merekonsiliasi pembayaran: ${msg}`);
  }

  return {
    success: true,
    reconciliationId: rpcResult.reconciliation_id,
    status: rpcResult.status,
    appliedAmount: Number(rpcResult.applied_amount),
    remainingUnappliedAmount: Number(rpcResult.remaining_unapplied_amount),
    invoiceSettled: Boolean(rpcResult.invoice_settled),
    subscriptionReactivated: Boolean(rpcResult.subscription_reactivated),
    auditLogId: rpcResult.audit_log_id,
  };
}

/**
 * Controlled Admin Action: Unapply a previously reconciled payment item atomically.
 */
export async function unapplyPaymentManually(params: {
  reconciliationId: string;
  adminId: string;
  reason: string;
}): Promise<{
  success: boolean;
  reconciliationId: string;
  status: ReconciliationStatus;
  unappliedAmount: number;
  invoiceReverted: boolean;
  auditLogId?: string;
}> {
  if (!params.reason || params.reason.trim().length < 5) {
    throw new Error("RECONCILIATION_REASON_REQUIRED: Alasan pembatalan rekonsiliasi wajib diisi (minimal 5 karakter).");
  }

  const supabase = createAdminClient();

  const { data: rpcResult, error: rpcErr } = await supabase.rpc("unapply_payment_atomic", {
    p_reconciliation_id: params.reconciliationId,
    p_admin_id: params.adminId,
    p_reason: params.reason,
  });

  if (rpcErr) {
    const msg = rpcErr.message || "";
    if (msg.includes("ITEM_NOT_APPLIED")) {
      const err: any = new Error("ITEM_NOT_APPLIED: Item belum pernah dialokasikan ke faktur manapun.");
      err.statusCode = 409;
      throw err;
    }
    if (msg.includes("RECONCILIATION_ITEM_NOT_FOUND")) {
      const err: any = new Error(`RECONCILIATION_ITEM_NOT_FOUND: Item ${params.reconciliationId} tidak ditemukan.`);
      err.statusCode = 404;
      throw err;
    }
    throw new Error(`Gagal membatalkan rekonsiliasi: ${msg}`);
  }

  return {
    success: true,
    reconciliationId: rpcResult.reconciliation_id,
    status: "UNAPPLIED",
    unappliedAmount: Number(rpcResult.unapplied_amount),
    invoiceReverted: Boolean(rpcResult.invoice_reverted),
    auditLogId: rpcResult.audit_log_id,
  };
}

/**
 * Processes a partial or concurrent payment atomically with row-level locking (FOR UPDATE).
 */
export async function processPartialPayment(params: {
  invoiceId: string;
  paymentAmount: number;
  provider: string;
  providerPaymentId: string;
  paymentMethod?: string;
  paymentDetails?: Record<string, unknown>;
}): Promise<{
  success: boolean;
  paymentId: string;
  totalPaid: number;
  amountTotal: number;
  invoiceSettled: boolean;
  subscriptionReactivated: boolean;
  overpaymentAmount: number;
  reconciliationId?: string;
}> {
  const supabase = createAdminClient();

  const { data: rpcResult, error: rpcErr } = await supabase.rpc("process_partial_payment_atomic", {
    p_invoice_id: params.invoiceId,
    p_payment_amount: params.paymentAmount,
    p_provider: params.provider,
    p_provider_payment_id: params.providerPaymentId,
    p_payment_method: params.paymentMethod || "BANK_TRANSFER",
    p_payment_details: params.paymentDetails || {},
  });

  if (rpcErr) {
    throw new Error(`Gagal memproses pembayaran parsial atomik: ${rpcErr.message}`);
  }

  return {
    success: true,
    paymentId: rpcResult.payment_id,
    totalPaid: Number(rpcResult.total_paid),
    amountTotal: Number(rpcResult.amount_total),
    invoiceSettled: Boolean(rpcResult.invoice_settled),
    subscriptionReactivated: Boolean(rpcResult.subscription_reactivated),
    overpaymentAmount: Number(rpcResult.overpayment_amount || 0),
    reconciliationId: rpcResult.reconciliation_id,
  };
}
