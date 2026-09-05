/**
 * COVE Phase 14: Billing & Entitlement Seed Data
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 4, 8, 9)
 */

import {
  Plan,
  Price,
  PlanEntitlement,
  Subscription,
  SubscriptionItem,
  Discount,
} from "./types";

export const INITIAL_PLANS: Plan[] = [
  {
    id: "b2b_pilot",
    name: "Paid Concierge Pilot (45 Hari)",
    description: "Evaluasi terpandu 1 proyek aktif, maks 10 pengguna, 4 weekly reviews, dan pembuktian Pilot ROI Scorecard 8.5x.",
    tierLevel: 1,
    isActive: true,
    isPublic: true,
    createdAt: "2026-09-04T00:00:00Z",
  },
  {
    id: "b2b_core",
    name: "Core B2B Subscription",
    description: "Fondasi operasional 1 proyek aktif (dapat ekspansi add-on), 10 pengguna, 5 modul inti COVE lengkap.",
    tierLevel: 2,
    isActive: true,
    isPublic: true,
    createdAt: "2026-09-04T00:00:00Z",
  },
  {
    id: "b2b_scale",
    name: "Scale B2B Subscription",
    description: "Solusi multi-proyek hingga 5 proyek aktif, 25 pengguna, ranking komparatif portofolio, dan prioritas support.",
    tierLevel: 3,
    isActive: true,
    isPublic: true,
    createdAt: "2026-09-04T00:00:00Z",
  },
  {
    id: "b2b_enterprise",
    name: "Enterprise B2B",
    description: "15+ proyek aktif, pengguna tidak terbatas, integrasi SSO/API kustom, dedicated onboarding engineer.",
    tierLevel: 4,
    isActive: true,
    isPublic: true,
    createdAt: "2026-09-04T00:00:00Z",
  },
  {
    id: "b2b_addon_project",
    name: "Project Add-on (+1 Proyek Aktif)",
    description: "Lisensi tambahan untuk menambah kuota 1 proyek aktif pada paket Core atau Scale.",
    tierLevel: 2,
    isActive: true,
    isPublic: true,
    createdAt: "2026-09-04T00:00:00Z",
  },
  {
    id: "lifetime_799k",
    name: "Legacy Lifetime Plan (799k)",
    description: "Paket legacy tertutup untuk kompatibilitas mundur pelanggan awal.",
    tierLevel: 1,
    isActive: true,
    isPublic: false, // Tidak ditampilkan ke pelanggan baru (PRD 35)
    createdAt: "2026-08-01T00:00:00Z",
  },
];

export const INITIAL_PRICES: Price[] = [
  // 1. Paid Pilot
  {
    id: "price_pilot_45d_v1",
    planId: "b2b_pilot",
    currency: "IDR",
    amount: 10_000_000,
    billingInterval: "ONEOFF_45_DAYS",
    effectiveFrom: "2026-09-01T00:00:00Z",
    effectiveUntil: null,
    isCurrent: true,
    createdAt: "2026-09-04T00:00:00Z",
  },
  // 2. Core B2B
  {
    id: "price_core_monthly_v1",
    planId: "b2b_core",
    currency: "IDR",
    amount: 2_500_000,
    billingInterval: "MONTHLY",
    effectiveFrom: "2026-09-01T00:00:00Z",
    effectiveUntil: null,
    isCurrent: true,
    createdAt: "2026-09-04T00:00:00Z",
  },
  {
    id: "price_core_annual_v1",
    planId: "b2b_core",
    currency: "IDR",
    amount: 30_000_000, // Rp 2.5M x 12
    billingInterval: "ANNUAL",
    effectiveFrom: "2026-09-01T00:00:00Z",
    effectiveUntil: null,
    isCurrent: true,
    createdAt: "2026-09-04T00:00:00Z",
  },
  // 3. Scale B2B
  {
    id: "price_scale_monthly_v1",
    planId: "b2b_scale",
    currency: "IDR",
    amount: 5_000_000,
    billingInterval: "MONTHLY",
    effectiveFrom: "2026-09-01T00:00:00Z",
    effectiveUntil: null,
    isCurrent: true,
    createdAt: "2026-09-04T00:00:00Z",
  },
  {
    id: "price_scale_annual_v1",
    planId: "b2b_scale",
    currency: "IDR",
    amount: 60_000_000, // Rp 5.0M x 12
    billingInterval: "ANNUAL",
    effectiveFrom: "2026-09-01T00:00:00Z",
    effectiveUntil: null,
    isCurrent: true,
    createdAt: "2026-09-04T00:00:00Z",
  },
  // 4. Enterprise B2B
  {
    id: "price_enterprise_annual_v1",
    planId: "b2b_enterprise",
    currency: "IDR",
    amount: 180_000_000, // Rp 15M/bln x 12
    billingInterval: "ANNUAL",
    effectiveFrom: "2026-09-01T00:00:00Z",
    effectiveUntil: null,
    isCurrent: true,
    createdAt: "2026-09-04T00:00:00Z",
  },
  // 5. Project Add-on
  {
    id: "price_addon_project_monthly_v1",
    planId: "b2b_addon_project",
    currency: "IDR",
    amount: 750_000,
    billingInterval: "MONTHLY",
    effectiveFrom: "2026-09-01T00:00:00Z",
    effectiveUntil: null,
    isCurrent: true,
    createdAt: "2026-09-04T00:00:00Z",
  },
  // 6. Legacy Lifetime
  {
    id: "price_legacy_lifetime_v1",
    planId: "lifetime_799k",
    currency: "IDR",
    amount: 799_000,
    billingInterval: "ANNUAL",
    effectiveFrom: "2026-08-01T00:00:00Z",
    effectiveUntil: null,
    isCurrent: false,
    createdAt: "2026-08-01T00:00:00Z",
  },
];

export const INITIAL_PLAN_ENTITLEMENTS: PlanEntitlement[] = [
  {
    id: "ent_pilot",
    planId: "b2b_pilot",
    maxActiveProjects: 1,
    maxUsers: 10,
    importEnabled: true,
    valueGapLedgerEnabled: true,
    claimReadinessEnabled: true,
    actionQueueEnabled: true,
    portfolioReviewLevel: "SINGLE",
    roiLedgerEnabled: true,
    auditLevel: "STANDARD",
    emailDigestEnabled: true,
    exportEnabled: true,
    apiEnabled: false,
    ssoEnabled: false,
    storageLimitMb: 5120, // 5 GB
    supportTier: "PRIORITY",
    createdAt: "2026-09-04T00:00:00Z",
  },
  {
    id: "ent_core",
    planId: "b2b_core",
    maxActiveProjects: 1,
    maxUsers: 10,
    importEnabled: true,
    valueGapLedgerEnabled: true,
    claimReadinessEnabled: true,
    actionQueueEnabled: true,
    portfolioReviewLevel: "SINGLE",
    roiLedgerEnabled: true,
    auditLevel: "STANDARD",
    emailDigestEnabled: true,
    exportEnabled: true,
    apiEnabled: false,
    ssoEnabled: false,
    storageLimitMb: 15360, // 15 GB
    supportTier: "STANDARD",
    createdAt: "2026-09-04T00:00:00Z",
  },
  {
    id: "ent_scale",
    planId: "b2b_scale",
    maxActiveProjects: 5,
    maxUsers: 25,
    importEnabled: true,
    valueGapLedgerEnabled: true,
    claimReadinessEnabled: true,
    actionQueueEnabled: true,
    portfolioReviewLevel: "MULTI_RANKING",
    roiLedgerEnabled: true,
    auditLevel: "EXTENDED",
    emailDigestEnabled: true,
    exportEnabled: true,
    apiEnabled: true,
    ssoEnabled: false,
    storageLimitMb: 51200, // 50 GB
    supportTier: "PRIORITY",
    createdAt: "2026-09-04T00:00:00Z",
  },
  {
    id: "ent_enterprise",
    planId: "b2b_enterprise",
    maxActiveProjects: -1, // Unlimited contractual
    maxUsers: -1, // Unlimited contractual
    importEnabled: true,
    valueGapLedgerEnabled: true,
    claimReadinessEnabled: true,
    actionQueueEnabled: true,
    portfolioReviewLevel: "ENTERPRISE",
    roiLedgerEnabled: true,
    auditLevel: "FORENSIC",
    emailDigestEnabled: true,
    exportEnabled: true,
    apiEnabled: true,
    ssoEnabled: true,
    storageLimitMb: 256000, // 250 GB
    supportTier: "DEDICATED",
    createdAt: "2026-09-04T00:00:00Z",
  },
  {
    id: "ent_legacy",
    planId: "lifetime_799k",
    maxActiveProjects: 10,
    maxUsers: 10,
    importEnabled: true,
    valueGapLedgerEnabled: true,
    claimReadinessEnabled: true,
    actionQueueEnabled: true,
    portfolioReviewLevel: "MULTI_RANKING",
    roiLedgerEnabled: true,
    auditLevel: "STANDARD",
    emailDigestEnabled: true,
    exportEnabled: true,
    apiEnabled: false,
    ssoEnabled: false,
    storageLimitMb: 20480,
    supportTier: "COMMUNITY",
    createdAt: "2026-08-01T00:00:00Z",
  },
];

export const INITIAL_SUBSCRIPTIONS: Subscription[] = [
  {
    id: "sub-nusantara-01",
    orgId: "org-nusantara-01",
    planId: "b2b_scale",
    priceId: "price_scale_monthly_v1",
    provider: "XENDIT",
    providerSubscriptionId: "sub_xen_nusantara_001",
    billingInterval: "MONTHLY",
    status: "ACTIVE",
    currentPeriodStart: "2026-09-01T00:00:00Z",
    currentPeriodEnd: "2026-09-30T23:59:59Z",
    cancelAtPeriodEnd: false,
    nextBillingDate: "2026-10-01T00:00:00Z",
    currency: "IDR",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-04T00:00:00Z",
  },
];

export const INITIAL_SUBSCRIPTION_ITEMS: SubscriptionItem[] = [
  {
    id: "item-sub-01",
    subscriptionId: "sub-nusantara-01",
    itemType: "BASE_PLAN",
    unitPrice: 5_000_000,
    quantity: 1,
    subtotal: 5_000_000,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  },
];

export const INITIAL_DISCOUNTS: Discount[] = [
  {
    id: "EARLY_PILOT_2026",
    name: "Early MEP Contractor Pilot Subsidy",
    discountType: "FIXED_AMOUNT",
    discountValue: 2_500_000,
    applicablePlanId: "b2b_pilot",
    maxRedemptions: 10,
    currentRedemptions: 1,
    validFrom: "2026-08-01T00:00:00Z",
    validUntil: "2026-12-31T23:59:59Z",
    isActive: true,
    createdAt: "2026-08-01T00:00:00Z",
  },
];
