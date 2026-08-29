/**
 * COVE V1 Master Constants & Enums
 * Source-of-Truth: COVE_PRD_v1.0.md & COVE_Implementation_Blueprint_v1.0.md
 */

// ==========================================
// 1. CLAIM STAGES (17 Stages)
// ==========================================
export const CLAIM_STAGES = {
  WORK_RECORDED: "WORK_RECORDED",
  MEASUREMENT: "MEASUREMENT",
  CLAIM_PREPARATION: "CLAIM_PREPARATION",
  CLAIM_READY: "CLAIM_READY",
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  CERTIFIED: "CERTIFIED",
  INVOICE_READY: "INVOICE_READY",
  INVOICE_ISSUED: "INVOICE_ISSUED",
  INVOICE_ACCEPTED: "INVOICE_ACCEPTED",
  DUE: "DUE",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
  // Exception States
  ON_HOLD: "ON_HOLD",
  DISPUTED: "DISPUTED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

export type ClaimStage = (typeof CLAIM_STAGES)[keyof typeof CLAIM_STAGES];

export interface StageConfig {
  key: ClaimStage;
  label: string;
  labelId: string;
  order: number;
  isException?: boolean;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  descriptionId: string;
}

export const CLAIM_STAGE_CONFIGS: Record<ClaimStage, StageConfig> = {
  WORK_RECORDED: {
    key: "WORK_RECORDED",
    label: "Work Recorded",
    labelId: "Pekerjaan Tercatat",
    order: 1,
    color: "text-slate-700",
    bgColor: "bg-slate-100",
    borderColor: "border-slate-300",
    description: "Physical work recorded on site.",
    descriptionId: "Pekerjaan fisik lapangan telah dicatat.",
  },
  MEASUREMENT: {
    key: "MEASUREMENT",
    label: "Measurement / Opname",
    labelId: "Pengukuran / Opname",
    order: 2,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    description: "Joint quantity measurement in progress.",
    descriptionId: "Pengukuran volume / opname bersama sedang berlangsung.",
  },
  CLAIM_PREPARATION: {
    key: "CLAIM_PREPARATION",
    label: "Claim Preparation",
    labelId: "Penyusunan Klaim",
    order: 3,
    color: "text-indigo-700",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
    description: "Claim compilation and backup calculations.",
    descriptionId: "Penyusunan berkas progress claim dan kalkulasi pendukung.",
  },
  CLAIM_READY: {
    key: "CLAIM_READY",
    label: "Claim Ready",
    labelId: "Klaim Siap Kirim",
    order: 4,
    color: "text-cyan-700",
    bgColor: "bg-cyan-50",
    borderColor: "border-cyan-200",
    description: "Claim ready for formal submission.",
    descriptionId: "Berkas claim lengkap dan siap dikirim ke MK / Pengawas.",
  },
  SUBMITTED: {
    key: "SUBMITTED",
    label: "Submitted",
    labelId: "Diajukan ke MK",
    order: 5,
    color: "text-sky-700",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-200",
    description: "Claim formally submitted.",
    descriptionId: "Klaim telah diajukan ke MK / Pemberi Tugas.",
  },
  UNDER_REVIEW: {
    key: "UNDER_REVIEW",
    label: "Under Review",
    labelId: "Peninjauan MK",
    order: 6,
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    description: "Technical & commercial verification by consultant.",
    descriptionId: "Proses verifikasi teknis/komersial oleh konsultan MK.",
  },
  CERTIFIED: {
    key: "CERTIFIED",
    label: "Certified",
    labelId: "Disertifikasi BAP",
    order: 7,
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    description: "Payment certificate (BAP/MC) approved.",
    descriptionId: "Sertifikat pembayaran (BAP / MC) telah disetujui.",
  },
  INVOICE_READY: {
    key: "INVOICE_READY",
    label: "Invoice Ready",
    labelId: "Siap Faktur",
    order: 8,
    color: "text-teal-700",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-200",
    description: "Ready for formal tax billing.",
    descriptionId: "Sertifikasi selesai, siap penerbitan faktur tagihan.",
  },
  INVOICE_ISSUED: {
    key: "INVOICE_ISSUED",
    label: "Invoice Issued",
    labelId: "Faktur Diterbitkan",
    order: 9,
    color: "text-blue-800",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-300",
    description: "Official invoice and tax document issued.",
    descriptionId: "Invoice resmi dan faktur pajak telah diterbitkan.",
  },
  INVOICE_ACCEPTED: {
    key: "INVOICE_ACCEPTED",
    label: "Invoice Accepted",
    labelId: "Faktur Diterima",
    order: 10,
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    description: "Invoice accepted by client finance.",
    descriptionId: "Invoice telah diterima tim keuangan klien.",
  },
  DUE: {
    key: "DUE",
    label: "Due for Payment",
    labelId: "Jatuh Tempo Bayar",
    order: 11,
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    description: "Invoice is due for payment.",
    descriptionId: "Invoice telah memasuki tanggal jatuh tempo pembayaran.",
  },
  PARTIALLY_PAID: {
    key: "PARTIALLY_PAID",
    label: "Partially Paid",
    labelId: "Dibayar Sebagian",
    order: 12,
    color: "text-lime-700",
    bgColor: "bg-lime-50",
    borderColor: "border-lime-200",
    description: "Partial cash payment received in bank.",
    descriptionId: "Pembayaran sebagian telah diterima di rekening.",
  },
  PAID: {
    key: "PAID",
    label: "Paid / Collected",
    labelId: "Lunas / Kas Cair",
    order: 13,
    color: "text-green-800",
    bgColor: "bg-green-100",
    borderColor: "border-green-300",
    description: "Full payment received in bank account.",
    descriptionId: "Tagihan telah lunas diterima penuh di rekening kas.",
  },
  // Exceptions
  ON_HOLD: {
    key: "ON_HOLD",
    label: "On Hold",
    labelId: "Ditangguhkan",
    order: 99,
    isException: true,
    color: "text-slate-700",
    bgColor: "bg-slate-200",
    borderColor: "border-slate-400",
    description: "Claim process temporarily paused.",
    descriptionId: "Proses klaim ditangguhkan sementara.",
  },
  DISPUTED: {
    key: "DISPUTED",
    label: "Disputed",
    labelId: "Sengketa",
    order: 99,
    isException: true,
    color: "text-rose-700",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
    description: "Dispute requires commercial resolution.",
    descriptionId: "Terdapat sengketa komersial atau volume.",
  },
  REJECTED: {
    key: "REJECTED",
    label: "Rejected",
    labelId: "Ditolak",
    order: 99,
    isException: true,
    color: "text-red-800",
    bgColor: "bg-red-100",
    borderColor: "border-red-300",
    description: "Claim rejected by consultant/owner.",
    descriptionId: "Pengajuan klaim ditolak oleh pengawas/klien.",
  },
  CANCELLED: {
    key: "CANCELLED",
    label: "Cancelled",
    labelId: "Dibatalkan",
    order: 99,
    isException: true,
    color: "text-zinc-600",
    bgColor: "bg-zinc-100",
    borderColor: "border-zinc-300",
    description: "Claim cancelled permanently.",
    descriptionId: "Klaim dibatalkan secara permanen.",
  },
};

// ==========================================
// 2. USER ROLES (9 Roles)
// ==========================================
export const ROLES = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  COMMERCIAL_MANAGER: "COMMERCIAL_MANAGER",
  QS: "QS",
  FINANCE_MANAGER: "FINANCE_MANAGER",
  PROJECT_MANAGER: "PROJECT_MANAGER",
  PROJECT_CONTROL: "PROJECT_CONTROL",
  PROCUREMENT: "PROCUREMENT",
  VIEWER: "VIEWER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Director / Owner",
  ADMIN: "System Administrator",
  COMMERCIAL_MANAGER: "Commercial Manager",
  QS: "Project QS",
  FINANCE_MANAGER: "Finance Manager",
  PROJECT_MANAGER: "Project Manager",
  PROJECT_CONTROL: "Project Control",
  PROCUREMENT: "Procurement",
  VIEWER: "Viewer / Stakeholder",
};

// ==========================================
// 3. RISK LEVELS & CATEGORIES
// ==========================================
export const RISK_LEVELS = {
  HEALTHY: "HEALTHY",
  WATCH: "WATCH",
  AT_RISK: "AT_RISK",
  CRITICAL: "CRITICAL",
} as const;

export type RiskLevel = (typeof RISK_LEVELS)[keyof typeof RISK_LEVELS];

export const RISK_LEVEL_CONFIG: Record<
  RiskLevel,
  { label: string; labelId: string; color: string; bgColor: string; borderColor: string }
> = {
  HEALTHY: {
    label: "Healthy",
    labelId: "Sehat",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
  },
  WATCH: {
    label: "Watch",
    labelId: "Perhatian",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  AT_RISK: {
    label: "At Risk",
    labelId: "Berisiko",
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
  },
  CRITICAL: {
    label: "Critical",
    labelId: "Kritis",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
};

export const CASH_AT_RISK_CATEGORIES = {
  UNMEASURED_AT_RISK: "UNMEASURED_AT_RISK",
  UNCLAIMED_AT_RISK: "UNCLAIMED_AT_RISK",
  UNCERTIFIED_AT_RISK: "UNCERTIFIED_AT_RISK",
  CERTIFIED_NOT_INVOICED_AT_RISK: "CERTIFIED_NOT_INVOICED_AT_RISK",
  RECEIVABLE_AT_RISK: "RECEIVABLE_AT_RISK",
  RETENTION_AT_RISK: "RETENTION_AT_RISK",
} as const;

export type CashAtRiskCategory = (typeof CASH_AT_RISK_CATEGORIES)[keyof typeof CASH_AT_RISK_CATEGORIES];

export const CASH_AT_RISK_LABELS: Record<CashAtRiskCategory, string> = {
  UNMEASURED_AT_RISK: "Unmeasured at Risk",
  UNCLAIMED_AT_RISK: "Unclaimed at Risk",
  UNCERTIFIED_AT_RISK: "Uncertified at Risk",
  CERTIFIED_NOT_INVOICED_AT_RISK: "Certified Not Invoiced at Risk",
  RECEIVABLE_AT_RISK: "Receivable at Risk",
  RETENTION_AT_RISK: "Retention at Risk",
};

// ==========================================
// 4. BLOCKER CATEGORIES & CONTROLLABILITY
// ==========================================
export const BLOCKER_CATEGORIES = {
  MEASUREMENT_INCOMPLETE: "measurement_incomplete",
  SUPPORTING_DOCUMENT_INCOMPLETE: "supporting_document_incomplete",
  INTERNAL_PREPARATION: "internal_preparation",
  CONSULTANT_REVIEW: "consultant_review",
  CLIENT_REVIEW: "client_review",
  TECHNICAL_APPROVAL: "technical_approval",
  COMMERCIAL_DISPUTE: "commercial_dispute",
  QUANTITY_DISPUTE: "quantity_dispute",
  PRICE_DISPUTE: "price_dispute",
  INVOICE_ADMINISTRATION: "invoice_administration",
  TAX_ADMINISTRATION: "tax_administration",
  PAYMENT_SCHEDULING: "payment_scheduling",
  OWNER_CASH_CONSTRAINT: "owner_cash_constraint",
  EXTERNAL_APPROVAL: "external_approval",
  OTHER: "other",
} as const;

export type BlockerCategory = (typeof BLOCKER_CATEGORIES)[keyof typeof BLOCKER_CATEGORIES];

export const BLOCKER_CATEGORY_LABELS: Record<BlockerCategory, string> = {
  measurement_incomplete: "Measurement Incomplete",
  supporting_document_incomplete: "Supporting Documents Incomplete",
  internal_preparation: "Internal Claim Preparation",
  consultant_review: "Consultant Review / Verification",
  client_review: "Client / Owner Review",
  technical_approval: "Technical / Engineering Approval",
  commercial_dispute: "Commercial Terms Dispute",
  quantity_dispute: "Quantity / Volume Dispute",
  price_dispute: "Unit Price Dispute",
  invoice_administration: "Invoice Administration Delay",
  tax_administration: "Tax / Faktur Pajak Administration",
  payment_scheduling: "Payment Scheduling Delay",
  owner_cash_constraint: "Owner Cash Flow Constraint",
  external_approval: "External / Permitting Approval",
  other: "Other Blocker",
};

export const CONTROLLABILITY = {
  INTERNAL: "internal",
  JOINT: "joint",
  EXTERNAL: "external",
  NOT_SOFTWARE_ADDRESSABLE: "not_software_addressable",
} as const;

export type Controllability = (typeof CONTROLLABILITY)[keyof typeof CONTROLLABILITY];

export const CONTROLLABILITY_LABELS: Record<Controllability, string> = {
  internal: "Internal (Kontraktor)",
  joint: "Joint (Kontraktor & Klien)",
  external: "External (Klien/Konsultan/Pemerintah)",
  not_software_addressable: "Not Software Addressable",
};

// ==========================================
// 5. EVIDENCE REQUIREMENTS (11 Defaults)
// ==========================================
export const DEFAULT_EVIDENCE_REQUIREMENTS = [
  { id: "ev-01", name: "Progress Report", description: "Laporan kemajuan mingguan/bulanan resmi", stage: "CLAIM_PREPARATION", sort: 1 },
  { id: "ev-02", name: "Measurement Sheet", description: "Lembar perhitungan volume pekerjaan terpasang", stage: "MEASUREMENT", sort: 2 },
  { id: "ev-03", name: "Berita Acara Opname", description: "BA Opname bersama yang ditandatangani", stage: "MEASUREMENT", sort: 3 },
  { id: "ev-04", name: "Progress Photos", description: "Foto dokumentasi fisik 0%, 50%, 100%", stage: "CLAIM_PREPARATION", sort: 4 },
  { id: "ev-05", name: "Supporting Calculations", description: "Perhitungan detail / backup volume", stage: "CLAIM_PREPARATION", sort: 5 },
  { id: "ev-06", name: "QC / Inspection Document", description: "Laporan inspeksi mutu dan checklist QC", stage: "CLAIM_PREPARATION", sort: 6 },
  { id: "ev-07", name: "Minutes of Meeting / BA", description: "Risalah rapat pembahasan progress", stage: "UNDER_REVIEW", sort: 7 },
  { id: "ev-08", name: "Consultant Approval", description: "Persetujuan tertulis dari Konsultan Pengawas / MK", stage: "UNDER_REVIEW", sort: 8 },
  { id: "ev-09", name: "Client Approval / BAP", description: "Berita Acara Pembayaran dari Pemberi Tugas", stage: "CERTIFIED", sort: 9 },
  { id: "ev-10", name: "Invoice Supporting Docs", description: "Kuitansi bermeterai, surat permohonan bayar", stage: "INVOICE_ISSUED", sort: 10 },
  { id: "ev-11", name: "Tax Documents (Faktur Pajak)", description: "Faktur Pajak elektronik (e-Faktur)", stage: "INVOICE_ISSUED", sort: 11 },
];

// ==========================================
// 6. ACTION PRIORITIES & OUTCOMES
// ==========================================
export const ACTION_PRIORITIES = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

export type ActionPriority = (typeof ACTION_PRIORITIES)[keyof typeof ACTION_PRIORITIES];

export const ACTION_STATUSES = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  WAITING_EXTERNAL: "waiting_external",
  BLOCKED: "blocked",
  RESOLVED: "resolved",
  CANCELLED: "cancelled",
} as const;

export type ActionStatus = (typeof ACTION_STATUSES)[keyof typeof ACTION_STATUSES];

export const OUTCOME_TYPES = {
  CASH_RELEASED: "cash_released",
  EXPOSURE_REDUCED: "exposure_reduced",
  CLAIM_RECOVERED: "claim_recovered",
  MARGIN_PROTECTED: "margin_protected",
  COST_AVOIDED: "cost_avoided",
  RISK_ACCEPTED: "risk_accepted",
  NO_FINANCIAL_OUTCOME: "no_financial_outcome",
  UNKNOWN: "unknown",
} as const;

export type OutcomeType = (typeof OUTCOME_TYPES)[keyof typeof OUTCOME_TYPES];

export const OUTCOME_TYPE_LABELS: Record<OutcomeType, string> = {
  cash_released: "Cash Released / Cair",
  exposure_reduced: "Exposure Reduced",
  claim_recovered: "Claim Recovered",
  margin_protected: "Margin Protected",
  cost_avoided: "Cost Avoided",
  risk_accepted: "Risk Accepted",
  no_financial_outcome: "No Financial Outcome",
  unknown: "Unknown / Belum Terukur",
};

// ==========================================
// 7. DATA FRESHNESS
// ==========================================
export const DATA_FRESHNESS = {
  FRESH: "FRESH",
  NEEDS_UPDATE: "NEEDS_UPDATE",
  STALE: "STALE",
  UNKNOWN: "UNKNOWN",
} as const;

export type DataFreshness = (typeof DATA_FRESHNESS)[keyof typeof DATA_FRESHNESS];

export const FRESHNESS_CONFIG: Record<DataFreshness, { label: string; color: string; bgColor: string }> = {
  FRESH: { label: "Fresh (≤24h)", color: "text-emerald-700", bgColor: "bg-emerald-50" },
  NEEDS_UPDATE: { label: "Needs Update (>24h)", color: "text-amber-700", bgColor: "bg-amber-50" },
  STALE: { label: "Stale (>7d)", color: "text-rose-700", bgColor: "bg-rose-50" },
  UNKNOWN: { label: "Unknown Freshness", color: "text-slate-600", bgColor: "bg-slate-100" },
};
