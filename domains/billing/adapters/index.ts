/**
 * COVE Phase 15: Payment Provider Adapters Index & Factory
 */

import { PaymentProvider } from "../types";
import { PaymentProviderAdapter } from "../provider-adapter";
import { MockPaymentAdapter } from "./mock-adapter";
import { XenditAdapter } from "./xendit-adapter";
import { MayarAdapter } from "./mayar-adapter";

export * from "./mock-adapter";
export * from "./xendit-adapter";
export * from "./mayar-adapter";

const mockAdapterInstance = new MockPaymentAdapter();
const xenditAdapterInstance = new XenditAdapter();
const mayarAdapterInstance = new MayarAdapter();

/**
 * Returns the appropriate payment provider adapter.
 * Defaults to MockPaymentAdapter if provider is MOCK or unspecified.
 */
export function getPaymentAdapter(provider?: PaymentProvider | string): PaymentProviderAdapter {
  const normalized = (provider || "").toUpperCase();

  switch (normalized) {
    case "XENDIT":
      return xenditAdapterInstance;
    case "MAYAR":
      return mayarAdapterInstance;
    case "MOCK":
    default:
      return mockAdapterInstance;
  }
}
