import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "../../../../../lib/auth/server-guard";
import { adminBillingService } from "../../../../../domains/billing/admin-service";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { processWebhookEvent } from "../../../../../domains/billing/webhook-service";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// CSRF Trust Anchor: APP_CANONICAL_URL from environment (not from request Host)
// ---------------------------------------------------------------------------
function validateCsrfOrigin(req: NextRequest): { valid: boolean; reason: string } {
  const canonical = process.env.APP_CANONICAL_URL || "http://localhost:3000";
  const allowedOrigins = new Set<string>();

  try {
    allowedOrigins.add(new URL(canonical).origin);
  } catch {
    // Malformed canonical URL — fail closed
    return { valid: false, reason: "APP_CANONICAL_URL is invalid" };
  }

  // Local development / test origins allowed outside production
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.add("http://localhost:3000");
    allowedOrigins.add("http://127.0.0.1:3000");
    allowedOrigins.add("http://localhost:3001");
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const secFetchSite = req.headers.get("sec-fetch-site");

  // Reject explicit cross-site calls
  if (secFetchSite === "cross-site") {
    return { valid: false, reason: "Sec-Fetch-Site indicates cross-site request" };
  }

  // 1. Primary: Validate Origin header against exact scheme + hostname + port
  if (origin) {
    try {
      const parsedOrigin = new URL(origin).origin;
      if (!allowedOrigins.has(parsedOrigin)) {
        return { valid: false, reason: `Origin '${origin}' tidak terdaftar dalam allowlist.` };
      }
      return { valid: true, reason: "Origin verified against canonical allowlist" };
    } catch {
      return { valid: false, reason: "Origin header is malformed" };
    }
  }

  // 2. Fallback: Referer (only allowed if policy permits)
  const allowRefererFallback = process.env.CSRF_ALLOW_REFERER_FALLBACK === "true" || process.env.NODE_ENV !== "production";
  if (referer && allowRefererFallback) {
    try {
      const parsedReferer = new URL(referer).origin;
      if (!allowedOrigins.has(parsedReferer)) {
        return { valid: false, reason: `Referer '${referer}' tidak terdaftar dalam allowlist.` };
      }
      return { valid: true, reason: "Referer fallback verified against canonical allowlist" };
    } catch {
      return { valid: false, reason: "Referer header is malformed" };
    }
  }

  // 3. Missing Origin: Fail closed on admin mutation unless running inside internal test runner without explicit enforcement
  const isEnforceMissing = req.headers.get("x-enforce-csrf-missing-origin") === "true";
  if (process.env.NODE_ENV === "test" && !isEnforceMissing && req.nextUrl && allowedOrigins.has(req.nextUrl.origin)) {
    return { valid: true, reason: "Internal test execution allowed" };
  }

  return { valid: false, reason: "CSRF_ORIGIN_MISSING: Header Origin wajib disertakan untuk seluruh mutasi admin." };
}

// ---------------------------------------------------------------------------
// Deterministic request fingerprint for idempotency conflict detection
// ---------------------------------------------------------------------------
function computeRequestFingerprint(body: Record<string, unknown>): string {
  // Sort keys for deterministic JSON serialization
  const sorted: Record<string, unknown> = {};
  Object.keys(body)
    .sort()
    .forEach((k) => {
      // Exclude the idempotency key itself from payload fingerprint
      if (k !== "idempotencyKey" && k !== "idempotency_key") {
        sorted[k] = body[k];
      }
    });
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

export async function POST(req: NextRequest) {
  // 1. CSRF Guard using APP_CANONICAL_URL (fail-closed)
  const csrfCheck = validateCsrfOrigin(req);
  if (!csrfCheck.valid) {
    return NextResponse.json(
      { success: false, error: `CSRF_ORIGIN_REJECTED: Permintaan mutasi lintas domain ditolak. (${csrfCheck.reason})` },
      { status: 403 }
    );
  }

  // 2. Platform Admin Authentication Guard
  const auth = await requirePlatformAdmin(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.statusCode });
  }

  const admin = (auth.admin as any)?.admin || auth.admin!;
  const adminId = admin?.id || null;
  const supabase = createAdminClient();

  let idempotencyKeyId: string | null = null;

  try {
    const body = await req.json();
    const action = body.action;
    const reason = body.reason;

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: "REASON_REQUIRED: Tindakan sensitif wajib menyertakan alasan yang jelas (minimal 5 karakter)." },
        { status: 400 }
      );
    }

    const ALLOWED_ACTIONS = [
      "RESEND_PAYMENT_LINK",
      "RETRY_NOTIFICATION",
      "REPROCESS_WEBHOOK",
      "PROCESS_REFUND",
      "CORRECT_BILLING_CONTACT",
      "RECONCILE_PAYMENT",
      "UNAPPLY_PAYMENT",
    ];

    if (!ALLOWED_ACTIONS.includes(action)) {
      return NextResponse.json(
        { success: false, error: `ACTION_NOT_ALLOWED: Aksi '${action}' tidak dikenal atau tidak diizinkan.` },
        { status: 400 }
      );
    }

    // 3. Persistent PostgreSQL Idempotency Check
    const idempotencyKey = req.headers.get("x-idempotency-key") || body.idempotencyKey;
    const targetResourceId =
      body.invoiceId ||
      body.notificationId ||
      body.eventId ||
      body.webhookEventId ||
      body.paymentId ||
      body.reconciliationId ||
      body.orgId ||
      "global";

    if (idempotencyKey) {
      const fingerprint = computeRequestFingerprint(body);

      const { data: claimResult, error: claimErr } = await supabase.rpc(
        "claim_admin_idempotency_key",
        {
          p_action_type: action,
          p_idempotency_key: idempotencyKey,
          p_target_resource_id: String(targetResourceId),
          p_request_fingerprint: fingerprint,
          p_actor_admin_id: adminId,
        }
      );

      if (claimErr) {
        if (
          claimErr.message?.includes("IDEMPOTENCY_PAYLOAD_CONFLICT") ||
          claimErr.code === "P0010"
        ) {
          return NextResponse.json(
            {
              success: false,
              error: "IDEMPOTENCY_PAYLOAD_CONFLICT: Kunci idempotensi telah digunakan dengan payload yang berbeda.",
            },
            { status: 409 }
          );
        }
        throw claimErr;
      }

      if (claimResult && !claimResult.claimed) {
        // Key already processed with identical payload -> return cached response
        const cached = claimResult.result_payload;
        if (cached && claimResult.status === "SUCCEEDED") {
          return NextResponse.json({ ...cached, isIdempotent: true }, { status: 200 });
        }
        if (claimResult.status === "PROCESSING") {
          return NextResponse.json(
            { success: false, error: "IDEMPOTENCY_IN_FLIGHT: Permintaan sedang diproses." },
            { status: 202 }
          );
        }
      }

      idempotencyKeyId = claimResult?.key_id || null;
    }

    let responsePayload: Record<string, unknown>;

    switch (action) {
      case "RESEND_PAYMENT_LINK": {
        const { invoiceId } = body;
        if (!invoiceId) {
          return NextResponse.json(
            { success: false, error: "INVOICE_ID_REQUIRED: invoiceId wajib disertakan." },
            { status: 400 }
          );
        }

        const { data: inv, error: invErr } = await supabase
          .from("billing_invoices")
          .select("*, organizations(id, name)")
          .eq("id", invoiceId)
          .single();

        if (invErr || !inv) {
          return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
        }

        const paymentLink = `https://checkout.xendit.co/web/inv_${inv.id.replace(/-/g, "").slice(0, 16)}`;

        const { data: auditLog } = await supabase
          .from("admin_audit_logs")
          .insert({
            admin_id: admin.id,
            action: "RESEND_PAYMENT_LINK",
            target_entity: "BILLING_INVOICE",
            target_id: inv.id,
            org_id: inv.org_id,
            reason,
            before_state: { invoice_number: inv.invoice_number, status: inv.status },
            after_state: { payment_link_generated: true, url: paymentLink },
          })
          .select("id")
          .single();

        responsePayload = {
          success: true,
          message: `Tautan pembayaran berhasil dibuat ulang untuk ${inv.invoice_number}`,
          paymentLink,
          auditId: auditLog?.id,
        };
        break;
      }

      case "RETRY_NOTIFICATION": {
        const { notificationId } = body;
        if (!notificationId) {
          return NextResponse.json(
            { success: false, error: "NOTIFICATION_ID_REQUIRED: notificationId wajib disertakan." },
            { status: 400 }
          );
        }

        const { data: notif, error: notifErr } = await supabase
          .from("billing_notifications")
          .select("*")
          .eq("id", notificationId)
          .single();

        if (notifErr || !notif) {
          return NextResponse.json({ success: false, error: "Notification not found" }, { status: 404 });
        }

        const { data: updated } = await supabase
          .from("billing_notifications")
          .update({
            status: "QUEUED",
            updated_at: new Date().toISOString(),
          })
          .eq("id", notif.id)
          .select()
          .single();

        const { data: auditLog } = await supabase
          .from("admin_audit_logs")
          .insert({
            admin_id: admin.id,
            action: "RETRY_NOTIFICATION",
            target_entity: "BILLING_NOTIFICATION",
            target_id: notif.id,
            org_id: notif.org_id,
            reason,
            before_state: { status: notif.status },
            after_state: { status: "QUEUED" },
          })
          .select("id")
          .single();

        responsePayload = {
          success: true,
          message: "Notifikasi telah dimasukkan kembali ke antrean pengiriman (QUEUED).",
          data: updated,
          auditId: auditLog?.id,
        };
        break;
      }

      case "REPROCESS_WEBHOOK": {
        const eventId = body.eventId || body.webhookEventId;
        if (!eventId) {
          return NextResponse.json(
            { success: false, error: "EVENT_ID_REQUIRED: eventId wajib disertakan." },
            { status: 400 }
          );
        }

        const { data: event, error: evtErr } = await supabase
          .from("webhook_events")
          .select("*")
          .eq("event_id", eventId)
          .single();

        if (evtErr || !event) {
          return NextResponse.json({ success: false, error: "Webhook event not found" }, { status: 404 });
        }

        // Safety Guard: Block reprocessing of already PROCESSED events
        if (event.processing_status === "PROCESSED") {
          return NextResponse.json(
            { success: false, error: "WEBHOOK_ALREADY_PROCESSED: Webhook yang telah berstatus PROCESSED tidak boleh diproses ulang." },
            { status: 400 }
          );
        }

        const result = await processWebhookEvent({
          provider: event.provider,
          headers: { "x-callback-token": process.env.XENDIT_CALLBACK_TOKEN || "mock_token" },
          rawPayload: event.raw_payload,
        });

        const { data: auditLog } = await supabase
          .from("admin_audit_logs")
          .insert({
            admin_id: admin.id,
            action: "REPROCESS_WEBHOOK",
            target_entity: "WEBHOOK_EVENT",
            target_id: event.id,
            reason,
            before_state: { processing_status: event.processing_status },
            after_state: { result_success: result.success, status_code: result.statusCode },
          })
          .select("id")
          .single();

        responsePayload = {
          success: true,
          message: `Webhook ${eventId} berhasil diproses ulang.`,
          result,
          auditId: auditLog?.id,
        };
        break;
      }

      case "PROCESS_REFUND": {
        const result = await adminBillingService.processRefund({
          ...body,
          requestedBy: admin.id,
          idempotencyKey,
        });
        responsePayload = { success: true, data: result, auditId: result.auditLogId };
        break;
      }

      case "CORRECT_BILLING_CONTACT": {
        const { orgId, newContactEmail, newContactPhone, billingEmail, billingName, billingPhone } = body;
        const targetEmail = newContactEmail || billingEmail;
        const targetPhone = newContactPhone || billingPhone;

        if (!orgId || !targetEmail) {
          return NextResponse.json(
            { success: false, error: "VALIDATION_FAILED: orgId dan newContactEmail wajib diisi." },
            { status: 400 }
          );
        }

        const { data: org, error: orgErr } = await supabase
          .from("organizations")
          .select("id, name, billing_email")
          .eq("id", orgId)
          .single();

        if (orgErr || !org) {
          return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
        }

        const beforeState = { billing_email: org.billing_email };
        const afterState = { billing_email: targetEmail, billing_name: billingName, billing_phone: targetPhone };

        await supabase
          .from("organizations")
          .update({
            billing_email: targetEmail,
            billing_name: billingName,
            billing_phone: targetPhone,
            updated_at: new Date().toISOString(),
          })
          .eq("id", org.id);

        const { data: auditLog } = await supabase
          .from("admin_audit_logs")
          .insert({
            admin_id: admin.id,
            action: "CORRECT_BILLING_CONTACT",
            target_entity: "ORGANIZATION",
            target_id: org.id,
            org_id: org.id,
            reason,
            before_state: beforeState,
            after_state: afterState,
          })
          .select("id")
          .single();

        responsePayload = {
          success: true,
          message: "Kontak penagihan organisasi berhasil diperbarui tanpa mengubah ledger finansial.",
          data: afterState,
          auditId: auditLog?.id,
        };
        break;
      }

      case "RECONCILE_PAYMENT": {
        const result = await adminBillingService.reconcilePayment({
          ...body,
          adminId: admin.id,
        });
        responsePayload = { success: true, data: result, auditId: result.auditLogId };
        break;
      }

      case "UNAPPLY_PAYMENT": {
        const result = await adminBillingService.unapplyPayment({
          ...body,
          adminId: admin.id,
        });
        responsePayload = { success: true, data: result, auditId: result.auditLogId };
        break;
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }

    // 4. Record successful result into persistent idempotency ledger
    if (idempotencyKeyId) {
      await supabase.rpc("complete_admin_idempotency_key", {
        p_key_id: idempotencyKeyId,
        p_status: "SUCCEEDED",
        p_result_payload: responsePayload,
      });
    }

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string };
    const status = error?.statusCode || 500;

    // If idempotency key was claimed and failed, record failure status
    if (idempotencyKeyId) {
      try {
        await supabase.rpc("complete_admin_idempotency_key", {
          p_key_id: idempotencyKeyId,
          p_status: "FAILED",
          p_result_payload: { error: error.message || "Execution failed" },
        });
      } catch {
        // ignore idempotency update error on outer catch
      }
    }

    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status });
  }
}
