/**
 * COVE Phase 18: Refund, Chargeback & Dispute Lifecycle Service
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 12)
 * 
 * Rules:
 * 1. Supports full refund, partial refund, chargeback, reversal, dispute opened, dispute won, dispute lost.
 * 2. Every action determines impact on invoice, recognized revenue, entitlement, and dunning.
 * 3. Webhook refund/chargeback must be signature-verified, idempotent, and correlated with the original payment.
 * 4. Generates immutable audit trail before/after in admin_audit_logs.
 */

import { createAdminClient } from "../../lib/supabase/admin";

export type RefundType =
  | "FULL_REFUND"
  | "PARTIAL_REFUND"
  | "CHARGEBACK"
  | "REVERSAL"
  | "DISPUTE_OPENED"
  | "DISPUTE_WON"
  | "DISPUTE_LOST";

export interface ProcessRefundParams {
  paymentId: string;
  type: RefundType;
  amount: number;
  reason: string;
  requestedBy?: string; // admin_id or 'GATEWAY_WEBHOOK'
  providerRefundId?: string;
  idempotencyKey?: string;
  rawPayload?: Record<string, unknown>;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  type: RefundType;
  amount: number;
  invoiceStatus: string;
  subscriptionStatus: string;
  impactOnRevenue: number;
  cumulativeRefunded?: number;
  auditLogId?: string;
  error?: string;
}

/**
 * Executes a refund, chargeback, reversal, or dispute update.
 */
export async function processRefundOrDispute(
  params: ProcessRefundParams
): Promise<RefundResult> {
  if (!params.reason || params.reason.trim().length < 5) {
    throw new Error("REFUND_REASON_REQUIRED: Alasan refund/dispute wajib diisi secara jelas (minimal 5 karakter).");
  }

  const supabase = createAdminClient();

  // 1. Fetch original payment
  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .select("*, billing_invoices(*)")
    .eq("id", params.paymentId)
    .single();

  if (payErr || !payment) {
    throw new Error(`Payment ${params.paymentId} tidak ditemukan.`);
  }

  const invoice = payment.billing_invoices;
  if (!invoice) {
    throw new Error(`Faktur tagihan terkait pembayaran ${params.paymentId} tidak ditemukan.`);
  }

  // Check idempotency: if providerRefundId or idempotencyKey is provided
  const dedupKey = params.providerRefundId || params.idempotencyKey;
  if (dedupKey) {
    const { data: existingRefund } = await supabase
      .from("payment_refunds")
      .select("id, status, amount, impact_on_revenue, type")
      .eq("provider_refund_id", dedupKey)
      .maybeSingle();

    if (existingRefund) {
      return {
        success: true,
        refundId: existingRefund.id,
        type: existingRefund.type as RefundType,
        amount: Number(existingRefund.amount),
        invoiceStatus: invoice.status,
        subscriptionStatus: "UNCHANGED",
        impactOnRevenue: Number(existingRefund.impact_on_revenue),
      };
    }
  }

  // 2. Cumulative Refund Tracking and Limit Invariant
  const { data: existingRefunds } = await supabase
    .from("payment_refunds")
    .select("id, amount, status, type")
    .eq("payment_id", payment.id)
    .in("status", ["SUCCEEDED", "PENDING"])
    .in("type", ["FULL_REFUND", "PARTIAL_REFUND", "REVERSAL", "DISPUTE_LOST"]);

  const pastRefunded = (existingRefunds || []).reduce(
    (acc: number, r: { amount?: number | string | null }) => acc + Number(r.amount || 0),
    0
  );

  const paymentAmount = Number(payment.amount || 0);

  if (params.type === "FULL_REFUND" || params.type === "PARTIAL_REFUND") {
    if (pastRefunded + params.amount > paymentAmount) {
      const err: any = new Error(
        `CUMULATIVE_REFUND_EXCEEDS_SETTLED_AMOUNT: Akumulasi refund (Rp ${pastRefunded + params.amount}) melebihi jumlah pembayaran terselesaikan (Rp ${paymentAmount}).`
      );
      err.statusCode = 400;
      throw err;
    }
  }

  const newTotalRefunded = pastRefunded + params.amount;
  const isNowFullyRefunded = newTotalRefunded >= paymentAmount;

  const beforeInvoiceState = { ...invoice };
  let newInvoiceStatus = invoice.status;
  let impactOnRevenue = -params.amount;
  let impactOnEntitlement = "NONE";
  let subStatus = "ACTIVE";

  // 1. Insert refund record FIRST.
  // The PostgreSQL trigger trg_payment_refunds_limit_check locks the payments row
  // with FOR UPDATE and verifies cumulative refunds never exceed settled payment under concurrency.
  const { data: refundRecord, error: refundErr } = await supabase
    .from("payment_refunds")
    .insert({
      payment_id: payment.id,
      billing_invoice_id: invoice.id,
      org_id: invoice.org_id,
      type: params.type,
      amount: params.amount,
      currency: payment.currency || "IDR",
      status: "SUCCEEDED",
      provider: payment.provider,
      provider_refund_id: params.providerRefundId || `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      reason: params.reason,
      requested_by: params.requestedBy,
      impact_on_revenue: impactOnRevenue,
      impact_on_entitlement: impactOnEntitlement,
      raw_payload: params.rawPayload || {},
    })
    .select("id")
    .single();

  if (refundErr || !refundRecord) {
    const isExcess =
      refundErr?.message?.includes("CUMULATIVE_REFUND_EXCEEDS_SETTLED_AMOUNT") ||
      refundErr?.code === "P0008";
    const err: any = new Error(
      isExcess
        ? `CUMULATIVE_REFUND_EXCEEDS_SETTLED_AMOUNT: Akumulasi refund melebihi jumlah pembayaran terselesaikan.`
        : `Gagal mencatat pengembalian dana: ${refundErr?.message}`
    );
    err.statusCode = 400;
    throw err;
  }

  // 2. Now that the refund is recorded and serialized, apply invoice and subscription state changes
  switch (params.type) {
    case "FULL_REFUND": {
      newInvoiceStatus = "REFUNDED";

      if (invoice.subscription_id) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id, status, org_id, current_period_start, current_period_end")
          .eq("id", invoice.subscription_id)
          .single();

        if (sub) {
          const now = new Date();
          const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
          const periodStart = sub.current_period_start ? new Date(sub.current_period_start) : null;

          const invoicePeriodEnd = invoice.period_end ? new Date(invoice.period_end) : null;
          const invoicePeriodStart = invoice.period_start ? new Date(invoice.period_start) : null;

          const { data: otherPaidInvoices } = await supabase
            .from("billing_invoices")
            .select("id, status, created_at, due_date")
            .eq("subscription_id", sub.id)
            .eq("status", "PAID")
            .neq("id", invoice.id);

          const hasAlternateActiveCoverage = (otherPaidInvoices || []).some((oi) => {
            return (
              new Date(oi.created_at) > new Date(invoice.created_at) ||
              (oi.due_date && new Date(oi.due_date) > now)
            );
          });

          const fundingActivePeriod = periodEnd !== null && periodEnd > now;

          let newSubStatus: string;
          let entitlementDecision: string;
          let entitlementReason: string;

          if (!fundingActivePeriod || hasAlternateActiveCoverage) {
            newSubStatus = sub.status;
            entitlementDecision = "SUBSCRIPTION_PRESERVED";
            entitlementReason = fundingActivePeriod
              ? "Alternate paid invoice covers the active period — subscription preserved."
              : "Invoice is historical (not funding current active period) — subscription preserved.";
            impactOnEntitlement = "NONE";
          } else {
            newSubStatus = "CANCELLED";
            entitlementDecision = "SUBSCRIPTION_CANCELLED";
            entitlementReason = "Active period invoice refunded with no alternate coverage — subscription cancelled.";
            impactOnEntitlement = "CANCELLED";

            const { error: subErr } = await supabase
              .from("subscriptions")
              .update({
                status: "CANCELLED",
                canceled_at: new Date().toISOString(),
                churn_reason: `Full refund issued: ${params.reason}`,
                updated_at: new Date().toISOString(),
              })
              .eq("id", sub.id);
            if (subErr) throw subErr;

            await supabase
              .from("organizations")
              .update({
                subscription_status: "CANCELLED",
                updated_at: new Date().toISOString(),
              })
              .eq("id", sub.org_id);
          }

          subStatus = newSubStatus;

          await supabase.from("admin_audit_logs").insert({
            admin_id: params.requestedBy || null,
            action: "REFUND_ENTITLEMENT_DECISION",
            target_entity: "SUBSCRIPTION",
            target_id: sub.id,
            org_id: sub.org_id,
            reason: params.reason,
            before_state: {
              subscription_status: sub.status,
              current_period_start: sub.current_period_start,
              current_period_end: sub.current_period_end,
              invoice_id: invoice.id,
              invoice_period_start: invoice.period_start,
              invoice_period_end: invoice.period_end,
              payment_id: payment.id,
              cumulative_refunded: newTotalRefunded,
            },
            after_state: {
              subscription_status: newSubStatus,
              entitlement_decision: entitlementDecision,
              reason: entitlementReason,
              funding_active_period: fundingActivePeriod,
              has_alternate_coverage: hasAlternateActiveCoverage,
            },
          });
        }
      }
      break;
    }

    case "PARTIAL_REFUND": {
      if (isNowFullyRefunded) {
        newInvoiceStatus = "REFUNDED";

        if (invoice.subscription_id) {
          const { data: sub } = await supabase
            .from("subscriptions")
            .select("id, status, org_id, current_period_start, current_period_end")
            .eq("id", invoice.subscription_id)
            .single();

          if (sub) {
            const now = new Date();
            const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
            const fundingActivePeriod = periodEnd !== null && periodEnd > now;

            if (fundingActivePeriod) {
              const { error: subErr } = await supabase
                .from("subscriptions")
                .update({
                  status: "PAST_DUE",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", sub.id);
              if (subErr) throw subErr;

              subStatus = "PAST_DUE";
              impactOnEntitlement = "DOWNGRADE_TO_PAST_DUE";
            } else {
              subStatus = sub.status;
              impactOnEntitlement = "NONE";
            }
          }
        }
      } else {
        newInvoiceStatus = invoice.status;
        impactOnEntitlement = "PRESERVED_PARTIAL_REFUND";
      }
      break;
    }

    case "CHARGEBACK":
    case "DISPUTE_OPENED": {
      newInvoiceStatus = "DISPUTED";
      impactOnEntitlement = "RESTRICT_TO_READ_ONLY";

      if (invoice.subscription_id) {
        await supabase
          .from("subscriptions")
          .update({
            status: "READ_ONLY",
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoice.subscription_id);

        subStatus = "READ_ONLY";
      }

      await supabase.from("reconciliation_queue").insert({
        payment_id: payment.id,
        billing_invoice_id: invoice.id,
        org_id: invoice.org_id,
        status: "CHARGEBACK",
        amount: params.amount,
        unapplied_amount: params.amount,
        reason: `Chargeback / dispute opened: ${params.reason}`,
      });
      break;
    }

    case "DISPUTE_WON": {
      newInvoiceStatus = "PAID";
      impactOnRevenue = params.amount;
      impactOnEntitlement = "RESTORE_ACTIVE";

      if (invoice.subscription_id) {
        await supabase
          .from("subscriptions")
          .update({
            status: "ACTIVE",
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoice.subscription_id);

        subStatus = "ACTIVE";
      }
      break;
    }

    case "DISPUTE_LOST":
    case "REVERSAL": {
      newInvoiceStatus = "REFUNDED";
      impactOnEntitlement = "CANCELLED";

      if (invoice.subscription_id) {
        const { error: subErr } = await supabase
          .from("subscriptions")
          .update({
            status: "CANCELLED",
            canceled_at: new Date().toISOString(),
            churn_reason: `Dispute lost or reversal: ${params.reason}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoice.subscription_id);
        if (subErr) throw subErr;

        subStatus = "CANCELLED";
      }
      break;
    }
  }

  // Update invoice
  await supabase
    .from("billing_invoices")
    .update({
      status: newInvoiceStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoice.id);

  // Admin Audit Log
  let auditLogId: string | undefined;
  if (params.requestedBy && params.requestedBy !== "GATEWAY_WEBHOOK") {
    const { data: auditLog } = await supabase.from("admin_audit_logs").insert({
      admin_id: params.requestedBy,
      action: `PROCESS_${params.type}`,
      target_entity: "PAYMENT_REFUND",
      target_id: refundRecord.id,
      org_id: invoice.org_id,
      reason: params.reason,
      before_state: beforeInvoiceState,
      after_state: {
        invoice_status: newInvoiceStatus,
        refund_amount: params.amount,
        impact_on_revenue: impactOnRevenue,
      },
    }).select("id").single();

    auditLogId = auditLog?.id;
  }

  return {
    success: true,
    refundId: refundRecord.id,
    type: params.type,
    amount: params.amount,
    invoiceStatus: newInvoiceStatus,
    subscriptionStatus: subStatus,
    impactOnRevenue,
    auditLogId,
  };
}
