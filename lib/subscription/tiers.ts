/**
 * COVE Commercial Subscription Tiers & Feature Access Entitlements
 */

export type SubscriptionTierId =
  | "pilot_free"
  | "monthly_129k"
  | "annual_499k"
  | "lifetime_799k"
  | "b2b_pilot"
  | "b2b_core"
  | "b2b_scale"
  | "b2b_enterprise";

export interface SubscriptionTier {
  id: SubscriptionTierId;
  name: string;
  badge: string;
  price: number; // IDR
  priceFormatted: string;
  billingPeriod: string;
  durationDays: number | null; // null for lifetime
  description: string;
  isPopular?: boolean;
  isLifetime?: boolean;
  maxProjects: number; // -1 for unlimited
  maxMembers: number; // -1 for unlimited
  features: {
    key: string;
    label: string;
    included: boolean;
  }[];
}

export const SUBSCRIPTION_TIERS: Record<SubscriptionTierId, SubscriptionTier> = {
  pilot_free: {
    id: "pilot_free",
    name: "Akun Belum Berlangganan",
    badge: "Harus Langganan",
    price: 0,
    priceFormatted: "Rp 0",
    billingPeriod: "Belum Aktif",
    durationDays: 0,
    description: "Silakan pilih paket berlangganan untuk mulai menggunakan sistem COVE.",
    maxProjects: 0,
    maxMembers: 1,
    features: [
      { key: "p2c", label: "Progress-to-Cash Workflow (17 Stage)", included: false },
      { key: "bap_pdf", label: "Generator BAP & Kuitansi PDF Resmi", included: false },
      { key: "tax_calculator", label: "Kalkulator Pajak Konstruksi (PPh & PPN)", included: false },
      { key: "variation_orders", label: "Buku Addendum & Variation Order (VO)", included: false },
      { key: "whatsapp_dispatch", label: "Notifikasi WhatsApp 1-Klik", included: false },
      { key: "geotag_photo", label: "Foto Bukti Geotag & Watermark GPS", included: false },
      { key: "smart_viewer", label: "Smart In-App Document Viewer", included: false },
      { key: "pay_when_paid", label: "Kontrol Mandor (Pay-When-Paid)", included: false },
      { key: "cash_stress_test", label: "Simulator Ketahanan Arus Kas (Stress Test)", included: false },
      { key: "c_score", label: "Contractor Health C-Scorecard", included: false },
    ],
  },

  monthly_129k: {
    id: "monthly_129k",
    name: "Paket Bulanan (Starter)",
    badge: "Fleksibel",
    price: 129000,
    priceFormatted: "Rp 129.000",
    billingPeriod: "per bulan",
    durationDays: 30,
    description: "Cocok untuk kontraktor individual atau proyek skala tunggal.",
    maxProjects: 1,
    maxMembers: 2,
    features: [
      { key: "p2c", label: "Progress-to-Cash Workflow (17 Stage)", included: true },
      { key: "bap_pdf", label: "Generator BAP & Kuitansi PDF Standar", included: true },
      { key: "tax_calculator", label: "Kalkulator Pajak Konstruksi (PPh & PPN)", included: false },
      { key: "variation_orders", label: "Buku Addendum & Variation Order (VO)", included: false },
      { key: "whatsapp_dispatch", label: "Notifikasi WhatsApp 1-Klik", included: false },
      { key: "geotag_photo", label: "Foto Bukti Geotag & Watermark GPS", included: false },
      { key: "smart_viewer", label: "Smart In-App Document Viewer", included: false },
      { key: "pay_when_paid", label: "Kontrol Mandor (Pay-When-Paid)", included: false },
      { key: "cash_stress_test", label: "Simulator Ketahanan Arus Kas (Stress Test)", included: false },
      { key: "c_score", label: "Contractor Health C-Scorecard", included: false },
    ],
  },

  annual_499k: {
    id: "annual_499k",
    name: "Paket Tahunan (Professional)",
    badge: "Paling Populer ⭐",
    price: 499000,
    priceFormatted: "Rp 499.000",
    billingPeriod: "per tahun (Hemat 68%)",
    durationDays: 365,
    description: "Solusi lengkap dan terfavorit bagi kontraktor menengah dengan banyak proyek aktif.",
    isPopular: true,
    maxProjects: 10,
    maxMembers: 10,
    features: [
      { key: "p2c", label: "Progress-to-Cash Workflow (17 Stage)", included: true },
      { key: "bap_pdf", label: "Generator BAP & Kuitansi PDF Resmi Tripartite", included: true },
      { key: "tax_calculator", label: "Kalkulator Pajak Konstruksi Lengkap (PP 9/2022)", included: true },
      { key: "variation_orders", label: "Buku Addendum & Variation Order (VO / CCO)", included: true },
      { key: "whatsapp_dispatch", label: "Notifikasi WhatsApp 1-Klik (wa.me)", included: true },
      { key: "geotag_photo", label: "Foto Bukti Geotag & Watermark GPS Otomatis", included: true },
      { key: "smart_viewer", label: "Smart In-App Document & PDF Viewer", included: true },
      { key: "pay_when_paid", label: "Kontrol Mandor (Pay-When-Paid)", included: false },
      { key: "cash_stress_test", label: "Simulator Ketahanan Arus Kas (Stress Test)", included: false },
      { key: "c_score", label: "Contractor Health C-Scorecard", included: false },
    ],
  },

  lifetime_799k: {
    id: "lifetime_799k",
    name: "Paket Seumur Hidup (Lifetime Enterprise)",
    badge: "Best Value (Sekali Bayar) 💎",
    price: 799000,
    priceFormatted: "Rp 799.000",
    billingPeriod: "sekali bayar (Selamanya)",
    durationDays: null, // Unlimited lifetime
    description: "Akses seumur hidup ke SELURUH fitur tanpa batas proyek dan tanpa biaya perpanjangan!",
    isLifetime: true,
    maxProjects: -1, // Unlimited
    maxMembers: -1, // Unlimited
    features: [
      { key: "p2c", label: "Progress-to-Cash Workflow (17 Stage)", included: true },
      { key: "bap_pdf", label: "Generator BAP Tripartite + Custom Kop PT", included: true },
      { key: "tax_calculator", label: "Kalkulator Pajak Konstruksi Lengkap (PP 9/2022)", included: true },
      { key: "variation_orders", label: "Buku Addendum & Variation Order (VO / CCO)", included: true },
      { key: "whatsapp_dispatch", label: "Notifikasi WhatsApp 1-Klik + Auto Gateway", included: true },
      { key: "geotag_photo", label: "Foto Bukti Geotag & Watermark GPS Otomatis", included: true },
      { key: "smart_viewer", label: "Smart In-App Document & PDF Viewer", included: true },
      { key: "pay_when_paid", label: "Kontrol Mandor & Subkon (Pay-When-Paid Zero-Deficit)", included: true },
      { key: "cash_stress_test", label: "Simulator Ketahanan Arus Kas (Stress Test 12 Minggu)", included: true },
      { key: "c_score", label: "Contractor Health C-Scorecard (0-100)", included: true },
      { key: "future_updates", label: "Seluruh Fitur Baru di Masa Depan (Gratis Selamanya)", included: true },
      { key: "vip_support", label: "Prioritas Konsultasi & VIP Support 24/7", included: true },
    ],
  },

  b2b_pilot: {
    id: "b2b_pilot",
    name: "Paid Pilot (Concierge 45 Hari)",
    badge: "Validasi Pilot ⭐",
    price: 10000000,
    priceFormatted: "Rp 10.000.000",
    billingPeriod: "sekali bayar / 45 hari",
    durationDays: 45,
    description: "1 proyek aktif, maks 10 pengguna, pendampingan intake data, 4 weekly reviews, dan Pilot ROI Scorecard.",
    maxProjects: 1,
    maxMembers: 10,
    features: [
      { key: "p2c", label: "Progress-to-Cash Workflow (5 Gap Ledger)", included: true },
      { key: "bap_pdf", label: "Generator BAP Tripartite & Kuitansi Resmi", included: true },
      { key: "readiness_gate", label: "Claim Readiness Gatekeeper", included: true },
      { key: "action_queue", label: "Action & Escalation Queue (SLA Breach)", included: true },
      { key: "portfolio_review", label: "Portfolio Review & ROI Ledger", included: true },
      { key: "erp_bridge", label: "Jembatan CSV Rekonsiliasi ERP", included: true },
    ],
  },

  b2b_core: {
    id: "b2b_core",
    name: "Core B2B Subscription",
    badge: "Paket Rekomendasi 🏆",
    price: 2500000,
    priceFormatted: "Rp 2.500.000",
    billingPeriod: "per bulan (Min. Tahunan Rp 30 Juta)",
    durationDays: 365,
    description: "1 proyek aktif (ekspansi Rp750rb/proyek/bln), 10 pengguna, lima modul inti COVE lengkap.",
    isPopular: true,
    maxProjects: 1,
    maxMembers: 10,
    features: [
      { key: "p2c", label: "Progress-to-Cash Workflow (5 Gap Ledger)", included: true },
      { key: "bap_pdf", label: "Generator BAP Tripartite & Kuitansi Resmi", included: true },
      { key: "readiness_gate", label: "Claim Readiness Gatekeeper", included: true },
      { key: "action_queue", label: "Action & Escalation Queue (SLA Breach)", included: true },
      { key: "portfolio_review", label: "Portfolio Review & ROI Ledger", included: true },
      { key: "erp_bridge", label: "Jembatan CSV Rekonsiliasi ERP", included: true },
    ],
  },

  b2b_scale: {
    id: "b2b_scale",
    name: "Scale B2B Subscription",
    badge: "Multi-Proyek",
    price: 5000000,
    priceFormatted: "Rp 5.000.000",
    billingPeriod: "per bulan (Min. Tahunan Rp 60 Juta)",
    durationDays: 365,
    description: "Hingga 5 proyek aktif, 25 pengguna, evaluasi portofolio komparatif dan prioritas implementasi.",
    maxProjects: 5,
    maxMembers: 25,
    features: [
      { key: "p2c", label: "Progress-to-Cash Workflow (5 Gap Ledger)", included: true },
      { key: "bap_pdf", label: "Generator BAP Tripartite & Kuitansi Resmi", included: true },
      { key: "readiness_gate", label: "Claim Readiness Gatekeeper", included: true },
      { key: "action_queue", label: "Action & Escalation Queue (SLA Breach)", included: true },
      { key: "portfolio_review", label: "Portfolio Review & ROI Ledger", included: true },
      { key: "erp_bridge", label: "Jembatan CSV Rekonsiliasi ERP", included: true },
      { key: "multi_project_ranking", label: "Multi-Project Portfolio Rankings", included: true },
    ],
  },

  b2b_enterprise: {
    id: "b2b_enterprise",
    name: "Enterprise B2B",
    badge: "Custom Proposal",
    price: 15000000,
    priceFormatted: "Rp 15.000.000",
    billingPeriod: "proposal tahunan",
    durationDays: 365,
    description: "15+ proyek aktif, pengguna tanpa batas, integrasi SSO/API kustom, dedicated onboarding engineer.",
    maxProjects: -1,
    maxMembers: -1,
    features: [
      { key: "p2c", label: "Progress-to-Cash Workflow (5 Gap Ledger)", included: true },
      { key: "bap_pdf", label: "Generator BAP Tripartite & Kuitansi Resmi", included: true },
      { key: "readiness_gate", label: "Claim Readiness Gatekeeper", included: true },
      { key: "action_queue", label: "Action & Escalation Queue (SLA Breach)", included: true },
      { key: "portfolio_review", label: "Portfolio Review & ROI Ledger", included: true },
      { key: "erp_bridge", label: "Jembatan CSV Rekonsiliasi ERP", included: true },
      { key: "sso_api", label: "SSO SAML / Okta & Custom ERP API SLA", included: true },
      { key: "dedicated_concierge", label: "Dedicated Onboarding Engineer", included: true },
    ],
  },
};

/**
 * Checks if current tenant has access to a specific feature key
 */
export function hasFeatureAccess(tierId: string | undefined, featureKey: string): boolean {
  if (tierId === "b2b_enterprise") return true;

  const normalizedTier: SubscriptionTierId =
    tierId === "b2b_pilot"
      ? "b2b_pilot"
      : tierId === "b2b_core"
      ? "b2b_core"
      : tierId === "b2b_scale"
      ? "b2b_scale"
      : tierId === "b2b_enterprise"
      ? "b2b_enterprise"
      : tierId === "lifetime_799k" || tierId === "lifetime" || tierId === "enterprise"
      ? "lifetime_799k"
      : tierId === "annual_499k" || tierId === "annual" || tierId === "portfolio_pro"
      ? "annual_499k"
      : tierId === "monthly_129k" || tierId === "monthly" || tierId === "project_starter"
      ? "monthly_129k"
      : "monthly_129k"; // Default active tier during session

  const tier = SUBSCRIPTION_TIERS[normalizedTier];
  if (!tier) return false;

  const feature = tier.features.find((f) => f.key === featureKey);
  return feature ? feature.included : false;
}
