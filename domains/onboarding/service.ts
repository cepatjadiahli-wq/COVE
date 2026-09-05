/**
 * Phase 10 Domain Engine: Onboarding, Concierge Pilot, Entitlement, and B2B Packaging
 * PRD Reference: Section 23 (Onboarding & Concierge Pilot), Section 28 (Packaging & Entitlement), Section 35 (Commercial Clean-up)
 */

export type OnboardingStage =
  | "DISCOVERY"
  | "DATA_INTAKE"
  | "CONTRACT_SETUP"
  | "MAPPING"
  | "BASELINE"
  | "ACTIVATION"
  | "WEEKLY_REVIEW"
  | "CLOSING";

export interface DataAcceptanceChecklistItem {
  key?: string;
  label?: string;
  itemKey?: string;
  itemLabel?: string;
  id?: string;
  orgId?: string;
  projectId?: string;
  description: string;
  status: "PENDING" | "VERIFIED" | "WAIVED";
  verifiedByName?: string;
  verifiedAt?: string;
  notes?: string;
}

export interface B2bPackageConfig {
  id: "b2b_pilot" | "b2b_core" | "b2b_scale" | "b2b_enterprise";
  name: string;
  billingPeriod: string;
  priceAmount: number;
  annualMinimum?: number;
  maxActiveProjects: number; // -1 for unlimited
  maxUsers: number;
  expansionPricePerProject?: number;
  description: string;
  includedModules: string[];
}

export interface PilotScorecard {
  projectId: string;
  projectName: string;
  pilotDurationDays: number;
  baselineExposure: number;
  closingExposure: number;
  exposureReduction: number;
  baselineCycleDays: number;
  closingCycleDays: number;
  cycleDaysSaved: number;
  resolvedExposureLevelA: number;
  pilotFee: number;
  roiMultiplier: number;
  timeBudgetCompliance: {
    implementationEffortHours: number;
    isImplementationUnderBudget: boolean; // Target < 16h for first pilots
    weeklyReviewMinutesPerProject: number;
    isWeeklyReviewUnderBudget: boolean; // Target <= 10 mins
  };
  recommendedTier: "b2b_core" | "b2b_scale" | "b2b_enterprise" | "managed_reconciliation_addon";
  renewalRecommendationRationale: string;
}

/**
 * PRD Section 23.1: Scope Pilot 45 Hari
 */
export const PILOT_SCOPE_CONFIG = {
  durationDays: 45,
  maxActiveProjects: 1,
  maxUsers: 10,
  minWeeklyReviews: 4,
  priceMin: 7_500_000,
  priceMax: 12_500_000,
  priceDefault: 10_000_000,
  currency: "IDR",
  implementationEffortTargetHours: 16,
  weeklyReviewMinutesTarget: 10,
};

/**
 * PRD Section 23.3: Data Acceptance Checklist
 */
export const INITIAL_DATA_ACCEPTANCE_ITEMS: DataAcceptanceChecklistItem[] = [
  {
    key: "DATA_OWNER_IDENTIFIED",
    label: "Data Owner & Authorized Uploader Teridentifikasi",
    description: "PIC utama kontraktor dan staf yang berhak mengunggah data opname telah ditetapkan secara tertulis.",
    status: "VERIFIED",
    verifiedByName: "Dimas Sucipto (Commercial Manager)",
    verifiedAt: "2026-08-01T10:00:00Z",
    notes: "PIC Lapangan: Fajar Pratama, Finance: Hendra Gunawan.",
  },
  {
    key: "PII_REDACTED",
    label: "Redaksi PII (Data Pribadi) yang Tidak Diperlukan",
    description: "Data rekening pribadi staf lapangan, NIK, dan data sensitif non-proyek telah dihapus/disamarkan.",
    status: "VERIFIED",
    verifiedByName: "Bambang Wijaya (Director)",
    verifiedAt: "2026-08-01T11:00:00Z",
    notes: "Hanya nomor kontrak komersial dan rekening escrow proyek yang disertakan.",
  },
  {
    key: "PERIOD_BASIS_KNOWN",
    label: "Basis Periode & Akumulatif / Periodik Diketahui",
    description: "Format angka progres (bobot % kumulatif vs nilai bruto klaim bulanan) telah dikonfirmasi.",
    status: "VERIFIED",
    verifiedByName: "Dimas Sucipto",
    verifiedAt: "2026-08-02T09:00:00Z",
    notes: "Format MC-006 berbasis kumulatif s/d MC berjalan.",
  },
  {
    key: "SOURCE_VALUES_RECONCILED",
    label: "Nilai Sumber Dapat Direkonsiliasi 100%",
    description: "Total nilai kontrak dan rekap opname pada Excel sumber cocok sempurna dengan angka intake.",
    status: "VERIFIED",
    verifiedByName: "Hendra Gunawan (Finance)",
    verifiedAt: "2026-08-02T14:00:00Z",
    notes: "Total kontrak Rp 45 Miliar cocok tanpa selisih pembulatan.",
  },
  {
    key: "CONTRACT_RULE_REFERENCED",
    label: "Aturan Kontrak Memiliki Rujukan Klausul Resmi",
    description: "Jadwal cut-off, SLA BAP 14 hari, dan ketentuan kalender kerja merujuk pasal kontrak fisik.",
    status: "VERIFIED",
    verifiedByName: "Dimas Sucipto",
    verifiedAt: "2026-08-03T10:00:00Z",
    notes: "Pasal 8 Ayat 2 Kontrak Utama Grand Meridian.",
  },
  {
    key: "KNOWN_GAPS_RECORDED",
    label: "Kesenjangan (Gaps) Diketahui Dicatat Transparan",
    description: "Keterlambatan sertifikasi eksisting tidak disamarkan sebagai nol, melainkan dicatat di G3.",
    status: "VERIFIED",
    verifiedByName: "Fajar Pratama",
    verifiedAt: "2026-08-03T15:00:00Z",
    notes: "Potongan BAP Rp20 Juta pada MC-006 tercatat aktif di gap uncertified.",
  },
  {
    key: "PROJECT_ACCESS_APPROVED",
    label: "Hak Akses Proyek Berbasis Peran Disetujui",
    description: "Penugasan anggota tim proyek (PM, CM, Finance, Viewer) telah divalidasi.",
    status: "VERIFIED",
    verifiedByName: "Bambang Wijaya",
    verifiedAt: "2026-08-04T08:00:00Z",
    notes: "9 role matrix RBAC diterapkan.",
  },
  {
    key: "DATA_RETENTION_AGREED",
    label: "Ketentuan Retensi & Ekspor Pasca Pilot Disepakati",
    description: "Hak unduh seluruh data (Grace period) saat pilot selesai telah disepakati bersama.",
    status: "VERIFIED",
    verifiedByName: "Bambang Wijaya",
    verifiedAt: "2026-08-04T09:00:00Z",
    notes: "Kontraktor berhak ekspor JSON/CSV penuh setiap saat.",
  },
];

/**
 * PRD Section 28: B2B Commercial Packaging
 */
export const B2B_PACKAGES: Record<string, B2bPackageConfig> = {
  b2b_pilot: {
    id: "b2b_pilot",
    name: "Paid Pilot (Concierge 45 Hari)",
    billingPeriod: "45 hari sekali bayar",
    priceAmount: 10_000_000,
    maxActiveProjects: 1,
    maxUsers: 10,
    description: "1 Proyek aktif, maksimal 10 users, assisted mapping, 4 weekly reviews, dan Pilot ROI Scorecard.",
    includedModules: [
      "Value Gap Ledger",
      "Cash-at-Risk Engine",
      "Claim Readiness Gate",
      "Action & Escalation Queue",
      "Portfolio Review & ROI Ledger",
    ],
  },
  b2b_core: {
    id: "b2b_core",
    name: "Core B2B Subscription",
    billingPeriod: "per bulan",
    priceAmount: 2_500_000,
    annualMinimum: 30_000_000,
    maxActiveProjects: 1,
    maxUsers: 10,
    expansionPricePerProject: 750_000,
    description: "1 Proyek aktif (ekspansi Rp750rb/proyek/bulan), 10 users, lima modul inti COVE lengkap.",
    includedModules: [
      "Value Gap Ledger",
      "Cash-at-Risk Engine",
      "Claim Readiness Gate",
      "Action & Escalation Queue",
      "Portfolio Review & ROI Ledger",
      "ERP CSV Reconciliation Bridge",
    ],
  },
  b2b_scale: {
    id: "b2b_scale",
    name: "Scale B2B Subscription",
    billingPeriod: "per bulan",
    priceAmount: 5_000_000,
    annualMinimum: 60_000_000,
    maxActiveProjects: 5,
    maxUsers: 25,
    expansionPricePerProject: 600_000,
    description: "Hingga 5 Proyek aktif, 25 users, Portfolio Multi-Proyek, dan prioritas implementasi.",
    includedModules: [
      "Semua Modul Core",
      "Multi-Project Portfolio Rankings",
      "Finance Handoff Queue",
      "Multi-Project Cash Stress Simulator",
    ],
  },
  b2b_enterprise: {
    id: "b2b_enterprise",
    name: "Enterprise B2B",
    billingPeriod: "proposal tahunan",
    priceAmount: 15_000_000,
    maxActiveProjects: -1, // Unlimited
    maxUsers: -1, // Unlimited
    description: "15+ Proyek aktif, Unlimited users, SSO & Custom API Integration SLA, Dedicated Concierge.",
    includedModules: [
      "Semua Modul Scale",
      "SSO SAML / Okta Integration",
      "Custom ERP Bridge SLA",
      "Dedicated Onboarding Engineer",
    ],
  },
};

/**
 * PRD Section 28.1: Entitlement Enforcement
 * Primary metric: Company Base + Active Projects (not per-seat).
 * Inactive/Archived projects do NOT count towards active limit.
 */
export function validateProjectEntitlement(
  tierId: string,
  currentActiveProjectCount: number
): { allowed: boolean; maxAllowed: number; error?: string } {
  const pkg = B2B_PACKAGES[tierId] || B2B_PACKAGES.b2b_pilot;
  if (pkg.maxActiveProjects === -1) {
    return { allowed: true, maxAllowed: 999 };
  }

  if (currentActiveProjectCount >= pkg.maxActiveProjects) {
    return {
      allowed: false,
      maxAllowed: pkg.maxActiveProjects,
      error: `Batas proyek aktif untuk paket ${pkg.name} (${pkg.maxActiveProjects} proyek) telah tercapai (PRD 28.1). Arsipkan proyek selesai atau lakukan ekspansi lisensi (Rp750rb/proyek/bln).`,
    };
  }

  return { allowed: true, maxAllowed: pkg.maxActiveProjects };
}

/**
 * PRD Section 28.1: Read/Export Grace Period Guarantee
 * Entitlement must NEVER block data export, even if subscription has ended.
 */
export function validateExportEntitlement(subscriptionStatus: "active" | "expired" | "grace_period"): {
  canExport: boolean;
  notice: string;
} {
  return {
    canExport: true, // Always true per PRD 28.1
    notice:
      subscriptionStatus === "active"
        ? "Langganan aktif. Seluruh fitur operasional dan ekspor data tersedia penuh."
        : "Langganan telah berakhir. Sesuai PRD 28.1, Anda tetap memiliki hak akses ekspor penuh (Open Data Grace Period) untuk mengunduh seluruh data historis.",
  };
}

/**
 * PRD Section 23.3: Evaluate Data Acceptance Checklist
 */
export function evaluateDataAcceptance(items: DataAcceptanceChecklistItem[]): {
  isFullyAccepted: boolean;
  totalItems: number;
  verifiedCount: number;
  pendingCount: number;
} {
  const totalItems = items.length;
  const verifiedCount = items.filter((i) => i.status === "VERIFIED" || i.status === "WAIVED").length;
  const pendingCount = items.filter((i) => i.status === "PENDING").length;

  return {
    isFullyAccepted: pendingCount === 0 && totalItems > 0,
    totalItems,
    verifiedCount,
    pendingCount,
  };
}

/**
 * PRD Section 23.2 & 24.5: Generate Day 45 Pilot Scorecard
 */
export function generatePilotScorecard(params: {
  projectId: string;
  projectName: string;
  baselineExposure: number;
  closingExposure: number;
  resolvedExposureLevelA: number;
  baselineCycleDays: number;
  closingCycleDays: number;
  pilotFee?: number;
  implementationEffortHours?: number;
  weeklyReviewMinutesPerProject?: number;
  totalActiveProjectsInOrg?: number;
}): PilotScorecard {
  const fee = params.pilotFee || PILOT_SCOPE_CONFIG.priceDefault;
  const exposureReduction = Math.max(0, params.baselineExposure - params.closingExposure);
  const cycleDaysSaved = Math.max(0, params.baselineCycleDays - params.closingCycleDays);
  const roiMultiplier = fee > 0 ? Number((params.resolvedExposureLevelA / fee).toFixed(1)) : 0;

  const implHours = params.implementationEffortHours || 14;
  const reviewMins = params.weeklyReviewMinutesPerProject || 8;

  const isImplUnderBudget = implHours <= PILOT_SCOPE_CONFIG.implementationEffortTargetHours;
  const isReviewUnderBudget = reviewMins <= PILOT_SCOPE_CONFIG.weeklyReviewMinutesTarget;

  // Recommendation logic based on org projects and performance
  let recommendedTier: PilotScorecard["recommendedTier"] = "b2b_core";
  let rationale = "Paket Core direkomendasikan untuk melanjutkan operasional proyek aktif dengan kontrol penuh atas 5 gap pre-invoice.";

  const activeProjects = params.totalActiveProjectsInOrg || 1;
  if (activeProjects >= 3) {
    recommendedTier = "b2b_scale";
    rationale = `Organisasi memiliki ${activeProjects} proyek aktif. Paket Scale memberikan keuntungan diskon volume dan fitur portfolio review komparatif.`;
  } else if (!isImplUnderBudget) {
    recommendedTier = "managed_reconciliation_addon";
    rationale = "Effort implementasi melebihi target standar. Direkomendasikan menambah Managed Reconciliation Service Add-on agar tim kontraktor didampingi penuh.";
  }

  return {
    projectId: params.projectId,
    projectName: params.projectName,
    pilotDurationDays: 45,
    baselineExposure: params.baselineExposure,
    closingExposure: params.closingExposure,
    exposureReduction,
    baselineCycleDays: params.baselineCycleDays,
    closingCycleDays: params.closingCycleDays,
    cycleDaysSaved,
    resolvedExposureLevelA: params.resolvedExposureLevelA,
    pilotFee: fee,
    roiMultiplier,
    timeBudgetCompliance: {
      implementationEffortHours: implHours,
      isImplementationUnderBudget: isImplUnderBudget,
      weeklyReviewMinutesPerProject: reviewMins,
      isWeeklyReviewUnderBudget: isReviewUnderBudget,
    },
    recommendedTier,
    renewalRecommendationRationale: rationale,
  };
}
