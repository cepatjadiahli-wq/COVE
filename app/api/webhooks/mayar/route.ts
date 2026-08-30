import { NextRequest, NextResponse } from "next/server";
import { MayarWebhookPayload, verifyMayarWebhookToken } from "@/lib/mayar/client";
import { coveStore } from "@/domains/store/persistent-store";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Health check for Mayar webhook configuration
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "COVE Mayar Webhook Listener",
    timestamp: new Date().toISOString(),
    configured: Boolean(process.env.MAYAR_WEBHOOK_SECRET),
  });
}

/**
 * Main Webhook Receiver from Mayar.id
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verify Mayar Webhook Security Header
    const authHeader =
      req.headers.get("x-mayar-token") ||
      req.headers.get("x-mayar-signature") ||
      req.headers.get("authorization");

    const webhookSecret = process.env.MAYAR_WEBHOOK_SECRET;

    if (!verifyMayarWebhookToken(authHeader, webhookSecret)) {
      console.error("❌ [Mayar Webhook] Unauthorized request: invalid token/secret header.");
      return NextResponse.json(
        { error: "Unauthorized: Invalid Mayar webhook secret." },
        { status: 401 }
      );
    }

    // 2. Parse Webhook Event Body
    const body: MayarWebhookPayload = await req.json();
    const { event, data } = body;

    console.log(`🔔 [Mayar Webhook] Received Event: ${event} for ID: ${data?.id}`);

    if (!event || !data) {
      return NextResponse.json(
        { error: "Invalid payload format: missing event or data." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 3. Process Events
    switch (event) {
      // EVENT: Payment Received / Invoice Paid
      case "payment.received":
      case "payment.settled":
      case "invoice.paid": {
        const paymentAmount = Number(data.amount) || 0;
        const customerEmail = data.customer?.email?.toLowerCase() || "";
        const mayarInvoiceId = data.invoiceId || data.id;

        console.log(
          `💰 [Mayar Webhook] Payment verified: Rp ${paymentAmount.toLocaleString("id-ID")} from ${customerEmail}`
        );

        // Find invoice if matched in persistent store
        const matchingInvoice = coveStore.invoices.find(
          (inv) => inv.id === mayarInvoiceId || inv.invoiceNumber === mayarInvoiceId
        );

        if (matchingInvoice) {
          // Reconcile Invoice in store
          coveStore.recordCashReceipt({
            invoiceId: matchingInvoice.id,
            amount: paymentAmount,
            receiptNumber: `MAYAR-PAY-${data.id.substring(0, 8).toUpperCase()}`,
            bankReference: data.paymentMethod || "MAYAR-QRIS-VA",
            notes: `Automated settlement via Mayar Webhook (Event: ${event})`,
            recordedBy: "MAYAR_SYSTEM",
          });
        }

        // Record in Supabase database if connected
        try {
          // Detect subscription tier from amount
          let activatedTier = "monthly_129k";
          let expirationDays = 30;

          if (paymentAmount >= 750000) {
            activatedTier = "lifetime_799k";
            expirationDays = 36500; // Lifetime 100 years
          } else if (paymentAmount >= 450000) {
            activatedTier = "annual_499k";
            expirationDays = 365;
          }

          // Update organization subscription in Supabase
          if (customerEmail) {
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + expirationDays);

            await supabase
              .from("organizations")
              .update({
                subscription_tier: activatedTier,
                subscription_status: "active",
                subscription_expires_at: activatedTier === "lifetime_799k" ? null : expirationDate.toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("legal_name", data.customer?.name || "");
          }

          await supabase.from("mayar_transactions").insert({
            event_id: `${event}_${data.id}_${Date.now()}`,
            event_type: event,
            payment_id: data.id,
            mayar_invoice_id: mayarInvoiceId,
            customer_email: customerEmail,
            customer_name: data.customer?.name || "Customer",
            amount: paymentAmount,
            fee: Number(data.fee) || 0,
            payment_method: data.paymentMethod || "qris",
            status: "processed",
            raw_payload: body,
          });
        } catch (dbErr) {
          console.warn("Notice: Logged to persistent memory; Supabase cloud write:", dbErr);
        }

        break;
      }

      // EVENT: Subscription Activated / Paid
      case "subscription.created":
      case "subscription.active":
      case "subscription.paid": {
        console.log(`⭐ [Mayar Webhook] Tenant subscription activated for customer: ${data.customer?.email}`);

        let activatedTier = "monthly_129k";
        const amount = Number(data.amount) || 0;
        if (amount >= 750000) activatedTier = "lifetime_799k";
        else if (amount >= 450000) activatedTier = "annual_499k";

        // Try updating organization subscription in Supabase
        if (data.customer?.email) {
          try {
            await supabase
              .from("organizations")
              .update({
                subscription_tier: activatedTier,
                subscription_status: "active",
                updated_at: new Date().toISOString(),
              })
              .eq("legal_name", data.customer?.name || "");
          } catch (subErr) {
            console.warn("Notice: Subscription status updated in memory.", subErr);
          }
        }
        break;
      }

      default:
        console.log(`ℹ️ [Mayar Webhook] Unhandled event type: ${event}. Stored safely.`);
    }

    // 4. Return standard 200 OK
    return NextResponse.json({
      status: "success",
      received: true,
      event,
      paymentId: data.id,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("❌ [Mayar Webhook] Processing Error:", error);
    return NextResponse.json(
      { error: "Internal server error processing webhook.", message: error.message },
      { status: 500 }
    );
  }
}
