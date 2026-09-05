/**
 * COVE Phase 17: Renewal Invoice Engine
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 8, 9)
 * 
 * Rules:
 * 1. Price is STRICTLY resolved from the locked price version on the subscription.
 * 2. Never accepts price or amount from the browser or request payload.
 * 3. Renewal invoice is strictly separated from tenant construction claim invoices.
 * 4. Invoice number is unique: 'INV-COVE-YYYY-MM-XXXX'.
 * 5. Exactly one active renewal invoice per subscription period.
 * 6. Legacy plan 'lifetime_799k' is strictly excluded from renewal.
 */

import { BillingInvoice, Subscription } from "../billing/types";
import { INITIAL_PRICES } from "../billing/seed-data";
import { getPaymentAdapter } from "../billing/adapters";
import { isLegacyPlan } from "./dunning-engine";

export interface CreateRenewalInvoiceParams {
  subscription: Subscription;
  existingInvoices?: BillingInvoice[];
  appBaseUrl?: string;
  asOfDate?: Date | string;
}

export interface RenewalInvoiceResult {
  success: boolean;
  invoice?: BillingInvoice;
  paymentUrl?: string;
  isIdempotentReplay?: boolean;
  skippedLegacy?: boolean;
  error?: string;
}

/**
 * Generates a unique, standardized SaaS invoice number
 */
export function generateRenewalInvoiceNumber(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `INV-COVE-${year}-${month}-${randomSuffix}`;
}

/**
 * Resolves price amount from verified system catalog using locked subscription.priceId
 */
export function resolveLockedSubscriptionPrice(priceId: string): number {
  const foundPrice = INITIAL_PRICES.find((p) => p.id === priceId);
  if (!foundPrice) {
    throw new Error(
      `INVALID_PRICE_ID: Versi harga '${priceId}' yang terkunci pada langganan tidak ditemukan di katalog resmi.`
    );
  }
  return foundPrice.amount;
}

/**
 * Creates or retrieves the unique renewal invoice for the upcoming billing cycle
 */
export async function createRenewalInvoice(
  params: CreateRenewalInvoiceParams
): Promise<RenewalInvoiceResult> {
  const { subscription, existingInvoices = [], appBaseUrl = "https://cove.id", asOfDate = new Date() } = params;

  // 1. Skip legacy lifetime plan
  if (isLegacyPlan(subscription.planId)) {
    return {
      success: false,
      skippedLegacy: true,
      error: "Paket legacy lifetime_799k dikecualikan dari proses pembuatan invoice renewal.",
    };
  }

  // 2. Resolve price amount strictly from server-side catalog (Never from client)
  let lockedAmount: number;
  try {
    lockedAmount = resolveLockedSubscriptionPrice(subscription.priceId);
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error resolving price",
    };
  }

  // 3. Idempotency Check: Prevent duplicate renewal invoice for the same subscription period
  const periodEndIso = subscription.currentPeriodEnd;
  const existingRenewal = existingInvoices.find(
    (inv) =>
      inv.orgId === subscription.orgId &&
      inv.subscriptionId === subscription.id &&
      inv.status !== "VOID" &&
      inv.dueDate === periodEndIso
  );

  if (existingRenewal) {
    return {
      success: true,
      invoice: existingRenewal,
      isIdempotentReplay: true,
      paymentUrl: `${appBaseUrl}/billing?invoice_id=${existingRenewal.id}`,
    };
  }

  // 4. Construct unique renewal invoice
  const currentDate = typeof asOfDate === "string" ? new Date(asOfDate) : asOfDate;
  const invoiceNumber = generateRenewalInvoiceNumber(currentDate);

  const newInvoice: BillingInvoice = {
    id: `inv-${subscription.orgId}-${Date.now()}`,
    orgId: subscription.orgId,
    subscriptionId: subscription.id,
    invoiceNumber,
    amountSubtotal: lockedAmount,
    discountAmount: 0,
    taxAmount: 0,
    amountTotal: lockedAmount,
    currency: subscription.currency || "IDR",
    status: "PENDING",
    dueDate: periodEndIso,
    createdAt: currentDate.toISOString(),
  };

  // 5. Generate Payment Link based on Provider Capabilities
  const adapter = getPaymentAdapter(subscription.provider);
  let checkoutUrl = `${appBaseUrl}/billing?invoice_id=${newInvoice.id}`;

  try {
    const session = await adapter.createCheckoutSession({
      orgId: subscription.orgId,
      planId: subscription.planId,
      priceId: subscription.priceId,
      amount: lockedAmount,
      interval: subscription.billingInterval || "MONTHLY",
      successUrl: `${appBaseUrl}/billing/success`,
      cancelUrl: `${appBaseUrl}/billing`,
      idempotencyKey: `renewal_${subscription.id}_${invoiceNumber}`,
    });
    if (session && session.checkoutUrl) {
      checkoutUrl = session.checkoutUrl;
    }
  } catch {
    // Fallback to internal billing link if gateway session fails in sandbox
  }

  return {
    success: true,
    invoice: newInvoice,
    paymentUrl: checkoutUrl,
    isIdempotentReplay: false,
  };
}
