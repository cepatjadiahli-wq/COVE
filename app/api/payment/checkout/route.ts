import { NextRequest, NextResponse } from "next/server";
import { getPaymentAdapter } from "../../../../domains/billing/adapters";
import { INITIAL_PLANS, INITIAL_PRICES } from "../../../../domains/billing/seed-data";
import { PlanId, BillingInterval } from "../../../../domains/billing/types";
import { validateBillingAuth } from "../../../../lib/auth/server-guard";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      planId,
      tierId, // Legacy parameter compatibility
      interval,
      provider = "MOCK",
      orgId,
      customerName,
      customerEmail,
      customerPhone,
      idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    } = body;

    // 1. Enforce Server-Side Authentication & Tenant Authorization (TASK 16R.1)
    const auth = await validateBillingAuth(req, {
      requiredRole: "OWNER_OR_ADMIN",
      targetOrgId: orgId,
    });

    if (!auth.authorized || !auth.targetOrgId) {
      return NextResponse.json(
        { success: false, error: auth.error || "Akses checkout tidak diizinkan." },
        { status: auth.statusCode }
      );
    }

    const verifiedOrgId = auth.targetOrgId;

    // 2. Resolve plan ID (supports both B2B IDs and legacy tier IDs)
    const requested = (planId || tierId || "").toLowerCase().trim();

    // TASK 16R.8: Reject legacy lifetime plan for new checkouts
    if (requested === "lifetime" || requested === "lifetime_799k") {
      return NextResponse.json(
        { success: false, error: "Paket Lifetime tidak tersedia untuk pembelian baru. Silakan pilih paket komersial resmi B2B (PRD 35)." },
        { status: 400 }
      );
    }

    const planMapping: Record<string, PlanId> = {
      b2b_pilot: "b2b_pilot",
      pilot: "b2b_pilot",
      b2b_core: "b2b_core",
      core: "b2b_core",
      monthly: "b2b_core",
      monthly_129k: "b2b_core",
      annual: "b2b_core",
      annual_499k: "b2b_core",
      b2b_scale: "b2b_scale",
      scale: "b2b_scale",
      b2b_enterprise: "b2b_enterprise",
      enterprise: "b2b_enterprise",
    };

    const resolvedPlanId: PlanId | undefined = planMapping[requested];
    if (!resolvedPlanId) {
      return NextResponse.json(
        { success: false, error: "Paket langganan tidak valid, tidak aktif, atau tidak dapat dibeli." },
        { status: 400 }
      );
    }

    const plan = INITIAL_PLANS.find((p) => p.id === resolvedPlanId && p.isActive);
    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Paket langganan tidak ditemukan atau tidak aktif." },
        { status: 400 }
      );
    }

    // 3. Resolve billing interval & price strictly on server (client cannot alter amount)
    const resolvedInterval: BillingInterval =
      resolvedPlanId === "b2b_pilot"
        ? "ONEOFF_45_DAYS"
        : interval === "ANNUAL" || requested === "annual" || requested === "annual_499k"
        ? "ANNUAL"
        : "MONTHLY";

    const price =
      INITIAL_PRICES.find((p) => p.planId === resolvedPlanId && p.billingInterval === resolvedInterval) ||
      INITIAL_PRICES.find((p) => p.planId === resolvedPlanId) ||
      INITIAL_PRICES[1];

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Secure Success URL: Points to processing/verification status page.
    // ZERO payment_success=true bypass parameter! Access is activated solely via verified webhook.
    const successUrl = `${appUrl}/billing/status`;
    const cancelUrl = `${appUrl}/pricing`;

    const adapter = getPaymentAdapter(provider);

    const session = await adapter.createCheckoutSession({
      orgId: verifiedOrgId,
      planId: resolvedPlanId,
      priceId: price.id,
      amount: price.amount,
      interval: resolvedInterval,
      successUrl,
      cancelUrl,
      idempotencyKey,
      customerName: customerName || auth.user?.email || "Kontraktor Indonesia",
      customerEmail: customerEmail || auth.user?.email || "billing@cove.id",
      customerPhone: customerPhone || "08123456789",
      metadata: {
        org_id: verifiedOrgId,
        plan_id: resolvedPlanId,
        price_id: price.id,
        interval: resolvedInterval,
        customer_email: customerEmail || auth.user?.email || "billing@cove.id",
      },
    });

    return NextResponse.json({
      success: true,
      provider: session.provider,
      sessionId: session.sessionId,
      checkoutUrl: session.checkoutUrl,
      amount: session.amount,
      planId: resolvedPlanId,
      planName: plan.name,
      interval: resolvedInterval,
      simulation: session.simulation || false,
      message: "Checkout session created successfully. Access will be activated upon webhook verification.",
    });
  } catch (error: any) {
    console.error("❌ [Checkout API] Error creating checkout session:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Terjadi kesalahan pada server saat membuat tagihan." },
      { status: 500 }
    );
  }
}
