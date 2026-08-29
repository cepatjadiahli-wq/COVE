import { ClaimStage, Role, RiskLevel, ActionPriority, ActionStatus, OutcomeType } from "@/lib/constants";

export interface DemoOrg {
  id: string;
  name: string;
  legalName: string;
  businessType: string;
  city: string;
  province: string;
  defaultCurrency: string;
  timezone: string;
}

export interface DemoProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  jobTitle: string;
  avatarUrl?: string;
}

export interface DemoClient {
  id: string;
  clientCode: string;
  name: string;
  legalName: string;
  clientType: string;
  email: string;
  phone: string;
}

export interface DemoProject {
  id: string;
  clientId: string;
  projectCode: string;
  projectName: string;
  projectType: string;
  location: string;
  city: string;
  contractStartDate: string;
  contractFinishDate: string;
  currencyCode: string;
  status: "draft" | "active" | "on_hold" | "completed" | "closed" | "cancelled";
  projectManagerId: string;
  commercialManagerId: string;
  financeOwnerId: string;
}

export interface DemoContract {
  id: string;
  projectId: string;
  contractNumber: string;
  contractTitle: string;
  originalContractValue: number;
  currentContractValue: number;
  paymentMethod: string;
  paymentTermDays: number;
  retentionPercent: number;
}

export interface DemoClaim {
  id: string;
  projectId: string;
  contractId: string;
  claimNumber: string;
  periodStart: string;
  periodEnd: string;
  description: string;
  currentStage: ClaimStage;
  riskLevel: RiskLevel;
  workPerformedValue: number;
  measuredValue: number;
  claimedValue: number;
  certifiedValue: number;
  expectedNetCollectible: number;
  cashReceivedValue: number;
  expectedCashDate: string;
  currentStageEnteredAt: string;
  responsibleOwnerId: string;
  sourceType: "manual" | "csv_import" | "xlsx_import" | "api" | "integration" | "system";
  sourceReference?: string;
  sourceUpdatedAt: string;
  notes?: string;
}

export interface DemoBlocker {
  id: string;
  projectId: string;
  entityType: string;
  entityId: string;
  category: string;
  title: string;
  description: string;
  financialExposure: number;
  severity: "low" | "medium" | "high" | "critical";
  controllability: "internal" | "joint" | "external" | "not_software_addressable";
  ownerId: string;
  raisedDate: string;
  targetResolveDate: string;
  resolvedDate?: string;
  status: "open" | "in_progress" | "waiting_external" | "resolved" | "cancelled";
  resolution?: string;
}

export interface DemoAction {
  id: string;
  projectId: string;
  entityType: string;
  entityId: string;
  riskType: string;
  financialExposure: number;
  title: string;
  description: string;
  ownerId: string;
  priority: ActionPriority;
  status: ActionStatus;
  dueDate: string;
  resolvedAt?: string;
  resolution?: string;
  outcomeType?: OutcomeType;
  outcomeValue?: number;
  createdAt: string;
}

export interface DemoInvoice {
  id: string;
  projectId: string;
  claimId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  grossAmount: number;
  retentionAmount: number;
  advanceRecoveryAmount: number;
  taxAmount: number;
  otherDeductionAmount: number;
  netReceivableAmount: number;
  cashReceivedAmount: number;
  outstandingAmount: number;
  expectedPaymentDate: string;
  status: "draft" | "issued" | "accepted" | "due" | "overdue" | "partially_paid" | "paid" | "disputed" | "cancelled";
  financeOwnerId: string;
}

export interface DemoCashReceipt {
  id: string;
  projectId: string;
  invoiceId: string;
  receiptNumber: string;
  paymentDate: string;
  amount: number;
  bankReference: string;
  notes: string;
  recordedBy: string;
}

// -------------------------------------------------------------
// SEED INSTANCES
// -------------------------------------------------------------

export const INITIAL_ORG: DemoOrg = {
  id: "org-nusantara-01",
  name: "PT Nusantara Buildindo",
  legalName: "PT Nusantara Buildindo Perkasa",
  businessType: "General Contractor",
  city: "Jakarta Selatan",
  province: "DKI Jakarta",
  defaultCurrency: "IDR",
  timezone: "Asia/Jakarta",
};

export const INITIAL_PROFILES: DemoProfile[] = [
  {
    id: "usr-raka",
    fullName: "Raka Pratama",
    email: "raka@nusantarabuildindo.co.id",
    phone: "+62 811 1234 501",
    role: "OWNER",
    jobTitle: "Managing Director",
  },
  {
    id: "usr-dimas",
    fullName: "Dimas Sucipto",
    email: "dimas@nusantarabuildindo.co.id",
    phone: "+62 811 1234 502",
    role: "COMMERCIAL_MANAGER",
    jobTitle: "Commercial Manager",
  },
  {
    id: "usr-andi",
    fullName: "Andi Wijaya",
    email: "andi@nusantarabuildindo.co.id",
    phone: "+62 811 1234 503",
    role: "QS",
    jobTitle: "Senior Project QS",
  },
  {
    id: "usr-rani",
    fullName: "Rani Prameswari",
    email: "rani@nusantarabuildindo.co.id",
    phone: "+62 811 1234 504",
    role: "FINANCE_MANAGER",
    jobTitle: "Finance & Billing Manager",
  },
  {
    id: "usr-fajar",
    fullName: "Fajar Nugroho",
    email: "fajar@nusantarabuildindo.co.id",
    phone: "+62 811 1234 505",
    role: "PROJECT_MANAGER",
    jobTitle: "Senior Project Manager",
  },
];

export const INITIAL_CLIENTS: DemoClient[] = [
  {
    id: "cl-meridian",
    clientCode: "CL-MERIDIAN",
    name: "PT Meridian Properti Indonesia",
    legalName: "PT Meridian Properti Indonesia Tbk",
    clientType: "Commercial Developer",
    email: "commercial@meridian.co.id",
    phone: "+62 21 2995 8888",
  },
  {
    id: "cl-logistic",
    clientCode: "CL-LOGISTIC",
    name: "PT Indo Logistik Nusantara",
    legalName: "PT Indo Logistik Nusantara",
    clientType: "Industrial Developer",
    email: "finance@indologistik.com",
    phone: "+62 21 8934 7711",
  },
  {
    id: "cl-graha",
    clientCode: "CL-SENTOSA",
    name: "PT Sentosa Medika Utama",
    legalName: "PT Sentosa Medika Utama",
    clientType: "Healthcare Operator",
    email: "projects@sentosamedika.com",
    phone: "+62 21 7812 4433",
  },
  {
    id: "cl-permata",
    clientCode: "CL-PERMATA",
    name: "PT Permata Land Development",
    legalName: "PT Permata Land Development",
    clientType: "Residential Developer",
    email: "billing@permataland.co.id",
    phone: "+62 21 5566 9900",
  },
];

export const INITIAL_PROJECTS: DemoProject[] = [
  {
    id: "prj-meridian",
    clientId: "cl-meridian",
    projectCode: "PRJ-MERIDIAN-01",
    projectName: "Grand Meridian Office Tower",
    projectType: "Commercial Highrise",
    location: "Jl. Jend. Sudirman Kav. 45",
    city: "Jakarta Pusat",
    contractStartDate: "2025-06-01",
    contractFinishDate: "2026-12-31",
    currencyCode: "IDR",
    status: "active",
    projectManagerId: "usr-fajar",
    commercialManagerId: "usr-dimas",
    financeOwnerId: "usr-rani",
  },
  {
    id: "prj-logistic",
    clientId: "cl-logistic",
    projectCode: "PRJ-LOGISTIC-02",
    projectName: "Nusantara Logistic Hub",
    projectType: "Industrial Warehouse",
    location: "Kawasan Industri MM2100",
    city: "Bekasi",
    contractStartDate: "2025-09-01",
    contractFinishDate: "2026-08-31",
    currencyCode: "IDR",
    status: "active",
    projectManagerId: "usr-fajar",
    commercialManagerId: "usr-dimas",
    financeOwnerId: "usr-rani",
  },
  {
    id: "prj-graha",
    clientId: "cl-graha",
    projectCode: "PRJ-SENTOSA-03",
    projectName: "Graha Sentosa Medical Center",
    projectType: "Healthcare Facility",
    location: "Jl. Margonda Raya No. 120",
    city: "Depok",
    contractStartDate: "2025-11-01",
    contractFinishDate: "2026-10-31",
    currencyCode: "IDR",
    status: "active",
    projectManagerId: "usr-fajar",
    commercialManagerId: "usr-dimas",
    financeOwnerId: "usr-rani",
  },
  {
    id: "prj-permata",
    clientId: "cl-permata",
    projectCode: "PRJ-PERMATA-04",
    projectName: "Permata Hills Housing Phase 2",
    projectType: "Residential Township",
    location: "Sentul City",
    city: "Bogor",
    contractStartDate: "2025-03-01",
    contractFinishDate: "2026-05-31",
    currencyCode: "IDR",
    status: "completed",
    projectManagerId: "usr-fajar",
    commercialManagerId: "usr-dimas",
    financeOwnerId: "usr-rani",
  },
];

export const INITIAL_CONTRACTS: DemoContract[] = [
  {
    id: "ctr-meridian",
    projectId: "prj-meridian",
    contractNumber: "CTR-NB-MRD-2025-01",
    contractTitle: "Kontrak Utama Pekerjaan Struktur & Arsitektur Grand Meridian",
    originalContractValue: 48_500_000_000,
    currentContractValue: 48_500_000_000,
    paymentMethod: "Monthly Progress",
    paymentTermDays: 30,
    retentionPercent: 5.0,
  },
  {
    id: "ctr-logistic",
    projectId: "prj-logistic",
    contractNumber: "CTR-NB-LOG-2025-02",
    contractTitle: "Kontrak Pekerjaan Konstruksi Sipil & Baja Nusantara Logistic Hub",
    originalContractValue: 24_800_000_000,
    currentContractValue: 24_800_000_000,
    paymentMethod: "Milestone Progress",
    paymentTermDays: 30,
    retentionPercent: 5.0,
  },
  {
    id: "ctr-graha",
    projectId: "prj-graha",
    contractNumber: "CTR-NB-SNT-2025-03",
    contractTitle: "Kontrak Pembangunan Gedung Utama Graha Sentosa",
    originalContractValue: 36_200_000_000,
    currentContractValue: 36_200_000_000,
    paymentMethod: "Monthly Progress",
    paymentTermDays: 45,
    retentionPercent: 5.0,
  },
  {
    id: "ctr-permata",
    projectId: "prj-permata",
    contractNumber: "CTR-NB-PMT-2025-04",
    contractTitle: "Kontrak Pekerjaan Konstruksi Permata Hills Phase 2",
    originalContractValue: 18_500_000_000,
    currentContractValue: 18_500_000_000,
    paymentMethod: "Termin Progress",
    paymentTermDays: 14,
    retentionPercent: 5.0,
  },
];

export const INITIAL_CLAIMS: DemoClaim[] = [
  {
    id: "clm-mc006",
    projectId: "prj-meridian",
    contractId: "ctr-meridian",
    claimNumber: "MC-006",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    description: "Progress Claim Periode Juli 2026 (Pekerjaan Struktur Lt 14-16 & Fasade)",
    currentStage: "UNDER_REVIEW",
    riskLevel: "CRITICAL",
    workPerformedValue: 3_200_000_000,
    measuredValue: 3_000_000_000,
    claimedValue: 2_750_000_000,
    certifiedValue: 2_100_000_000,
    expectedNetCollectible: 1_995_000_000,
    cashReceivedValue: 1_400_000_000,
    expectedCashDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
    currentStageEnteredAt: new Date(Date.now() - 16 * 86400000).toISOString(),
    responsibleOwnerId: "usr-dimas",
    sourceType: "manual",
    sourceUpdatedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    notes: "Selisih volume Rp650M sedang diverifikasi bersama konsultan MK.",
  },
  {
    id: "clm-log03",
    projectId: "prj-logistic",
    contractId: "ctr-logistic",
    claimNumber: "MC-003",
    periodStart: "2026-06-01",
    periodEnd: "2026-06-30",
    description: "Progress Claim Pekerjaan Rangka Baja dan Atap Cold Storage",
    currentStage: "DUE",
    riskLevel: "AT_RISK",
    workPerformedValue: 1_800_000_000,
    measuredValue: 1_800_000_000,
    claimedValue: 1_800_000_000,
    certifiedValue: 1_800_000_000,
    expectedNetCollectible: 1_710_000_000,
    cashReceivedValue: 0,
    expectedCashDate: new Date(Date.now() - 10 * 86400000).toISOString().split("T")[0],
    currentStageEnteredAt: new Date(Date.now() - 35 * 86400000).toISOString(),
    responsibleOwnerId: "usr-rani",
    sourceType: "manual",
    sourceUpdatedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    notes: "Invoice telah overdue 15 hari dari tanggal jatuh tempo.",
  },
  {
    id: "clm-med02",
    projectId: "prj-graha",
    contractId: "ctr-graha",
    claimNumber: "MC-002",
    periodStart: "2026-07-15",
    periodEnd: "2026-08-15",
    description: "Progress Claim Pekerjaan Pondasi Bored Pile & Pile Cap",
    currentStage: "CLAIM_PREPARATION",
    riskLevel: "WATCH",
    workPerformedValue: 1_500_000_000,
    measuredValue: 1_400_000_000,
    claimedValue: 1_200_000_000,
    certifiedValue: 0,
    expectedNetCollectible: 1_140_000_000,
    cashReceivedValue: 0,
    expectedCashDate: new Date(Date.now() + 25 * 86400000).toISOString().split("T")[0],
    currentStageEnteredAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    responsibleOwnerId: "usr-andi",
    sourceType: "xlsx_import",
    sourceUpdatedAt: new Date(Date.now() - 72 * 3600000).toISOString(),
    notes: "Evidence kelengkapan foto dan BA opname baru 55%.",
  },
  {
    id: "clm-per05",
    projectId: "prj-permata",
    contractId: "ctr-permata",
    claimNumber: "MC-005",
    periodStart: "2026-05-01",
    periodEnd: "2026-05-31",
    description: "Final Progress Claim Serah Terima Tahap 1",
    currentStage: "PAID",
    riskLevel: "HEALTHY",
    workPerformedValue: 2_500_000_000,
    measuredValue: 2_500_000_000,
    claimedValue: 2_500_000_000,
    certifiedValue: 2_500_000_000,
    expectedNetCollectible: 2_375_000_000,
    cashReceivedValue: 2_375_000_000,
    expectedCashDate: new Date(Date.now() - 40 * 86400000).toISOString().split("T")[0],
    currentStageEnteredAt: new Date(Date.now() - 45 * 86400000).toISOString(),
    responsibleOwnerId: "usr-dimas",
    sourceType: "system",
    sourceUpdatedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    notes: "Lunas diterima penuh.",
  },
];

export const INITIAL_INVOICES: DemoInvoice[] = [
  {
    id: "inv-meridian-006",
    projectId: "prj-meridian",
    claimId: "clm-mc006",
    invoiceNumber: "INV-2026-MRD-006",
    issueDate: new Date(Date.now() - 20 * 86400000).toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0],
    grossAmount: 2_100_000_000,
    retentionAmount: 105_000_000,
    advanceRecoveryAmount: 0,
    taxAmount: 0,
    otherDeductionAmount: 0,
    netReceivableAmount: 1_995_000_000,
    cashReceivedAmount: 1_400_000_000,
    outstandingAmount: 595_000_000,
    expectedPaymentDate: new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0],
    status: "partially_paid",
    financeOwnerId: "usr-rani",
  },
  {
    id: "inv-logistic-003",
    projectId: "prj-logistic",
    claimId: "clm-log03",
    invoiceNumber: "INV-2026-LOG-003",
    issueDate: new Date(Date.now() - 45 * 86400000).toISOString().split("T")[0],
    dueDate: new Date(Date.now() - 15 * 86400000).toISOString().split("T")[0],
    grossAmount: 1_800_000_000,
    retentionAmount: 90_000_000,
    advanceRecoveryAmount: 0,
    taxAmount: 0,
    otherDeductionAmount: 0,
    netReceivableAmount: 1_710_000_000,
    cashReceivedAmount: 0,
    outstandingAmount: 1_710_000_000,
    expectedPaymentDate: new Date(Date.now() - 15 * 86400000).toISOString().split("T")[0],
    status: "overdue",
    financeOwnerId: "usr-rani",
  },
  {
    id: "inv-permata-005",
    projectId: "prj-permata",
    claimId: "clm-per05",
    invoiceNumber: "INV-2026-PMT-005",
    issueDate: new Date(Date.now() - 60 * 86400000).toISOString().split("T")[0],
    dueDate: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
    grossAmount: 2_500_000_000,
    retentionAmount: 125_000_000,
    advanceRecoveryAmount: 0,
    taxAmount: 0,
    otherDeductionAmount: 0,
    netReceivableAmount: 2_375_000_000,
    cashReceivedAmount: 2_375_000_000,
    outstandingAmount: 0,
    expectedPaymentDate: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
    status: "paid",
    financeOwnerId: "usr-rani",
  },
];

export const INITIAL_CASH_RECEIPTS: DemoCashReceipt[] = [
  {
    id: "cr-001",
    projectId: "prj-meridian",
    invoiceId: "inv-meridian-006",
    receiptNumber: "CR-2026-0089",
    paymentDate: new Date(Date.now() - 5 * 86400000).toISOString().split("T")[0],
    amount: 800_000_000,
    bankReference: "BCA-TRF-99281",
    notes: "Pembayaran termin 1 MC-006",
    recordedBy: "usr-rani",
  },
  {
    id: "cr-002",
    projectId: "prj-meridian",
    invoiceId: "inv-meridian-006",
    receiptNumber: "CR-2026-0094",
    paymentDate: new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0],
    amount: 600_000_000,
    bankReference: "BCA-TRF-99402",
    notes: "Pembayaran termin 2 MC-006",
    recordedBy: "usr-rani",
  },
  {
    id: "cr-003",
    projectId: "prj-permata",
    invoiceId: "inv-permata-005",
    receiptNumber: "CR-2026-0071",
    paymentDate: new Date(Date.now() - 32 * 86400000).toISOString().split("T")[0],
    amount: 2_375_000_000,
    bankReference: "MANDIRI-TRF-44120",
    notes: "Pelunasan invoice MC-005",
    recordedBy: "usr-rani",
  },
];

export const INITIAL_BLOCKERS: DemoBlocker[] = [
  {
    id: "blk-001",
    projectId: "prj-meridian",
    entityType: "claim",
    entityId: "clm-mc006",
    category: "consultant_review",
    title: "Verifikasi Volume Pembesian & Fasade Pending MK",
    description: "Final quantity verification pending consultant approval. Perbedaan metode opname volume fasade antara QS kontraktor dan tim MK.",
    financialExposure: 650_000_000,
    severity: "high",
    controllability: "joint",
    ownerId: "usr-dimas",
    raisedDate: new Date(Date.now() - 9 * 86400000).toISOString().split("T")[0],
    targetResolveDate: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
    status: "open",
  },
  {
    id: "blk-002",
    projectId: "prj-logistic",
    entityType: "invoice",
    entityId: "inv-logistic-003",
    category: "owner_cash_constraint",
    title: "Kendala Jadwal Pembayaran Finansial Klien",
    description: "Klien menunggu pencairan fasilitas kredit konstruksi perbankan untuk pembayaran termin MC-003.",
    financialExposure: 1_710_000_000,
    severity: "critical",
    controllability: "external",
    ownerId: "usr-rani",
    raisedDate: new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0],
    targetResolveDate: new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0],
    status: "open",
  },
];

export const INITIAL_ACTIONS: DemoAction[] = [
  {
    id: "act-001",
    projectId: "prj-meridian",
    entityType: "claim",
    entityId: "clm-mc006",
    riskType: "UNCERTIFIED_AT_RISK",
    financialExposure: 650_000_000,
    title: "Escalate final quantity approval",
    description: "Koordinasi rapat teknis bersama Lead QS MK dan Project Director Klien untuk pengesahan berita acara selisih volume fasade Rp650M.",
    ownerId: "usr-dimas",
    priority: "critical",
    status: "open",
    dueDate: new Date(Date.now() + 1 * 86400000).toISOString().split("T")[0],
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "act-002",
    projectId: "prj-logistic",
    entityType: "invoice",
    entityId: "inv-logistic-003",
    riskType: "RECEIVABLE_AT_RISK",
    financialExposure: 1_710_000_000,
    title: "Kirim Surat Peringatan & Jadwalkan Negosiasi Pembayaran",
    description: "Terbitkan surat teguran resmi terkait invoice overdue Rp1,71M dan jadwalkan pertemuan komersial tingkat direksi.",
    ownerId: "usr-rani",
    priority: "critical",
    status: "in_progress",
    dueDate: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: "act-003",
    projectId: "prj-graha",
    entityType: "claim",
    entityId: "clm-med02",
    riskType: "UNCLAIMED_AT_RISK",
    financialExposure: 200_000_000,
    title: "Lengkapi Berkas BA Opname & Foto Progres Pondasi",
    description: "Kumpulkan foto dokumentasi 100% bored pile dan tanda tangan BA opname konsultan untuk merilis sisa klaim Rp200M.",
    ownerId: "usr-andi",
    priority: "medium",
    status: "open",
    dueDate: new Date(Date.now() + 4 * 86400000).toISOString().split("T")[0],
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

export const INITIAL_AUDIT_LOGS: any[] = [];

// Aliases for legacy seed exports
export const SEED_ORGANIZATIONS = [INITIAL_ORG];
export const SEED_PROFILES = INITIAL_PROFILES;
export const SEED_CLIENTS = INITIAL_CLIENTS;
export const SEED_PROJECTS = INITIAL_PROJECTS;
export const SEED_CONTRACTS = INITIAL_CONTRACTS;
export const SEED_CLAIMS = INITIAL_CLAIMS;
export const SEED_INVOICES = INITIAL_INVOICES;
export const SEED_BLOCKERS = INITIAL_BLOCKERS;
export const SEED_ACTIONS = INITIAL_ACTIONS;
export const SEED_AUDIT_LOGS = INITIAL_AUDIT_LOGS;
