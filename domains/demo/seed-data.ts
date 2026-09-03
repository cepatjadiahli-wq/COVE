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
  status?: "ACTIVE" | "DEACTIVATED";
  mfaEnabled?: boolean;
  assignedProjectIds?: string[];
  lastSessionRevokedAt?: string;
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

export interface DemoContractRuleVersion {
  id: string;
  orgId: string;
  projectId: string;
  contractId: string;
  versionNumber: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "SUPERSEDED";
  cutOffDay: number;
  internalLeadTimeDays: number;
  reviewSlaDays: number;
  paymentTermDays: number;
  calendarBasis: "CALENDAR_DAYS" | "WORKING_DAYS";
  retentionPercent: number;
  advanceRecoveryRule: "PROPORTIONAL" | "FIXED_PERCENT" | "NONE";
  advanceRecoveryPercent: number;
  taxTreatment: string;
  sourceClauseRef: string;
  effectiveDate: string;
  notes?: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface DemoSourceImport {
  id: string;
  orgId: string;
  projectId?: string;
  fileName: string;
  fileSizeBytes: number;
  fileChecksum: string;
  sheetName?: string;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  totalSourceValue: number;
  acceptedValue: number;
  rejectedValue: number;
  reconciliationVariance: number;
  status: "VALIDATING" | "COMPLETED" | "ROLLED_BACK";
  mappingTemplateId?: string;
  uploadedBy: string;
  uploadedAt: string;
  notes?: string;
}

export interface DemoImportMappingTemplate {
  id: string;
  orgId: string;
  templateName: string;
  entityType: "claims" | "projects" | "invoices";
  columnMapping: Record<string, string>;
  createdByName: string;
  createdAt: string;
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
  controllability?: "INTERNAL" | "JOINT" | "EXTERNAL" | "UNKNOWN";
  isDisputed?: boolean;
  disputeReason?: string;
  disputedAt?: string;
  isWrittenOff?: boolean;
  writeOffReason?: string;
  writtenOffAt?: string;
  writeOffAmount?: number;
  readinessStatus?: "NOT_STARTED" | "INCOMPLETE" | "READY" | "SUBMITTED";
  readinessTemplateVersion?: string;
  overrideReady?: boolean;
  overrideApprovedBy?: string;
  overrideReason?: string;
  overrideAt?: string;
  resubmissionCount?: number;
  lastRejectionReason?: string;
  cutOffDate?: string;
  internalTargetDate?: string;
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
  nextStep: string;
  ownerId: string;
  ownerName?: string;
  priority: ActionPriority;
  status: ActionStatus;
  dueDate: string;
  followUpDate?: string;
  externalCounterpartName?: string;
  externalCounterpartOrg?: string;
  externalCounterpartPhone?: string;
  closureEvidenceUrl?: string;
  closureEvidenceNote?: string;
  closureHistory?: any[];
  comments?: any[];
  escalationLevel?: string;
  escalatedToRole?: string;
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
    status: "ACTIVE",
    mfaEnabled: true,
    assignedProjectIds: ["prj-01", "prj-02", "prj-03"],
  },
  {
    id: "usr-dimas",
    fullName: "Dimas Sucipto",
    email: "dimas@nusantarabuildindo.co.id",
    phone: "+62 811 1234 502",
    role: "COMMERCIAL_MANAGER",
    jobTitle: "Commercial Manager",
    status: "ACTIVE",
    mfaEnabled: true,
    assignedProjectIds: ["prj-01", "prj-02"],
  },
  {
    id: "usr-andi",
    fullName: "Andi Wijaya",
    email: "andi@nusantarabuildindo.co.id",
    phone: "+62 811 1234 503",
    role: "QS",
    jobTitle: "Senior Project QS",
    status: "ACTIVE",
    mfaEnabled: false,
    assignedProjectIds: ["prj-01"],
  },
  {
    id: "usr-rani",
    fullName: "Rani Prameswari",
    email: "rani@nusantarabuildindo.co.id",
    phone: "+62 811 1234 504",
    role: "FINANCE_MANAGER",
    jobTitle: "Finance & Billing Manager",
    status: "ACTIVE",
    mfaEnabled: false,
    assignedProjectIds: ["prj-01", "prj-02", "prj-03"],
  },
  {
    id: "usr-fajar",
    fullName: "Fajar Nugroho",
    email: "fajar@nusantarabuildindo.co.id",
    phone: "+62 811 1234 505",
    role: "PROJECT_MANAGER",
    jobTitle: "Senior Project Manager",
    status: "ACTIVE",
    mfaEnabled: false,
    assignedProjectIds: ["prj-01"],
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

export const INITIAL_CONTRACT_RULE_VERSIONS: DemoContractRuleVersion[] = [
  {
    id: "rule-mrd-v10",
    orgId: "org-nusantara-01",
    projectId: "prj-meridian",
    contractId: "ctr-meridian",
    versionNumber: "v1.0",
    status: "SUPERSEDED",
    cutOffDay: 25,
    internalLeadTimeDays: 5,
    reviewSlaDays: 14,
    paymentTermDays: 30,
    calendarBasis: "CALENDAR_DAYS",
    retentionPercent: 5.0,
    advanceRecoveryRule: "PROPORTIONAL",
    advanceRecoveryPercent: 10.0,
    taxTreatment: "PPN 11% & PPh 4(2) Final 1.75% (Pasal 12 SPK)",
    sourceClauseRef: "Pasal 8 Ayat 1 & 2 SPK Utama",
    effectiveDate: "2025-06-01",
    notes: "Aturan awal pelaksanaan kontrak SPK No. 048/DIR-SPK/MP/2025.",
    createdBy: "Dimas Sucipto (Commercial Manager)",
    approvedBy: "Raka Pratama (Owner)",
    approvedAt: "2025-06-01T08:00:00Z",
    createdAt: "2025-05-28T10:00:00Z",
  },
  {
    id: "rule-mrd-v11",
    orgId: "org-nusantara-01",
    projectId: "prj-meridian",
    contractId: "ctr-meridian",
    versionNumber: "v1.1",
    status: "APPROVED",
    cutOffDay: 25,
    internalLeadTimeDays: 4,
    reviewSlaDays: 12,
    paymentTermDays: 30,
    calendarBasis: "CALENDAR_DAYS",
    retentionPercent: 5.0,
    advanceRecoveryRule: "PROPORTIONAL",
    advanceRecoveryPercent: 10.0,
    taxTreatment: "PPN 11% & PPh 4(2) Final 1.75% (Pasal 12 SPK)",
    sourceClauseRef: "Addendum I SPK No. 012/ADD-I/MP/2026 Pasal 3.1",
    effectiveDate: "2026-01-01",
    notes: "Percepatan SLA review MK dari 14 hari menjadi 12 hari kalender dan lead time internal 4 hari.",
    createdBy: "Dimas Sucipto (Commercial Manager)",
    approvedBy: "Raka Pratama (Owner)",
    approvedAt: "2026-01-02T09:30:00Z",
    createdAt: "2025-12-28T14:00:00Z",
  },
  {
    id: "rule-log-v10",
    orgId: "org-nusantara-01",
    projectId: "prj-logistic",
    contractId: "ctr-logistic",
    versionNumber: "v1.0",
    status: "APPROVED",
    cutOffDay: 28,
    internalLeadTimeDays: 5,
    reviewSlaDays: 10,
    paymentTermDays: 30,
    calendarBasis: "CALENDAR_DAYS",
    retentionPercent: 5.0,
    advanceRecoveryRule: "NONE",
    advanceRecoveryPercent: 0,
    taxTreatment: "PPN 11% & PPh 4(2) Final 2.65% (Kualifikasi M2)",
    sourceClauseRef: "Pasal 6 SPK Logistic Hub",
    effectiveDate: "2025-09-01",
    notes: "Aturan penagihan berbasis milestone dan opname bersama bulanan.",
    createdBy: "Dimas Sucipto (Commercial Manager)",
    approvedBy: "Raka Pratama (Owner)",
    approvedAt: "2025-09-01T10:00:00Z",
    createdAt: "2025-08-25T11:00:00Z",
  },
  {
    id: "rule-snt-v10",
    orgId: "org-nusantara-01",
    projectId: "prj-graha",
    contractId: "ctr-graha",
    versionNumber: "v1.0",
    status: "APPROVED",
    cutOffDay: 20,
    internalLeadTimeDays: 7,
    reviewSlaDays: 14,
    paymentTermDays: 45,
    calendarBasis: "WORKING_DAYS",
    retentionPercent: 5.0,
    advanceRecoveryRule: "PROPORTIONAL",
    advanceRecoveryPercent: 15.0,
    taxTreatment: "PPN 11% & PPh 4(2) Final 1.75% (Pasal 10 SPK)",
    sourceClauseRef: "Pasal 9 Ayat 3 SPK Graha Sentosa",
    effectiveDate: "2025-11-01",
    notes: "Perhitungan jatuh tempo menggunakan basis hari kerja (Working Days) sesuai klausul yayasan.",
    createdBy: "Dimas Sucipto (Commercial Manager)",
    approvedBy: "Raka Pratama (Owner)",
    approvedAt: "2025-11-01T11:00:00Z",
    createdAt: "2025-10-28T09:00:00Z",
  },
  {
    id: "rule-pmt-v10",
    orgId: "org-nusantara-01",
    projectId: "prj-permata",
    contractId: "ctr-permata",
    versionNumber: "v1.0",
    status: "APPROVED",
    cutOffDay: 30,
    internalLeadTimeDays: 3,
    reviewSlaDays: 7,
    paymentTermDays: 14,
    calendarBasis: "CALENDAR_DAYS",
    retentionPercent: 5.0,
    advanceRecoveryRule: "NONE",
    advanceRecoveryPercent: 0,
    taxTreatment: "PPN 11% & PPh 4(2) Final 1.75%",
    sourceClauseRef: "Pasal 5 SPK Permata Hills",
    effectiveDate: "2025-03-01",
    notes: "Proyek perumahan dengan termin cepat 14 hari.",
    createdBy: "Dimas Sucipto (Commercial Manager)",
    approvedBy: "Raka Pratama (Owner)",
    approvedAt: "2025-03-01T08:00:00Z",
    createdAt: "2025-02-20T10:00:00Z",
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
    sourceReference: "MC-006_Opname_Bersama.xlsx",
    sourceUpdatedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    controllability: "JOINT",
    isDisputed: false,
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
    sourceReference: "Progress_Billing_Hub_Aug26.csv",
    sourceUpdatedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    controllability: "INTERNAL",
    isDisputed: false,
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
    sourceReference: "Tracker_MC002_Graha.xlsx",
    sourceUpdatedAt: new Date(Date.now() - 72 * 3600000).toISOString(),
    controllability: "INTERNAL",
    isDisputed: false,
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
    expectedCashDate: new Date(Date.now() - 60 * 86400000).toISOString().split("T")[0],
    currentStageEnteredAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    responsibleOwnerId: "usr-rani",
    sourceType: "manual",
    sourceReference: "Permata_MC005_Final.xlsx",
    sourceUpdatedAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    controllability: "INTERNAL",
    isDisputed: false,
    notes: "Lunas 100%. Retensi diserahkan.",
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
    nextStep: "Gelar rapat teknis pembuktian kubikasi fasade bersama MK",
    ownerId: "usr-dimas",
    ownerName: "Dimas Sucipto (Commercial Manager)",
    priority: "critical",
    status: "open",
    dueDate: new Date(Date.now() + 1 * 86400000).toISOString().split("T")[0],
    externalCounterpartName: "Ir. Hendro Wijaya",
    externalCounterpartOrg: "PT IndoKarya Manajemen Konstruksi",
    externalCounterpartPhone: "081234567890",
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
    nextStep: "Kirim surat peringatan komersial tahap 1 ke Finance Director Klien",
    ownerId: "usr-rani",
    ownerName: "Rani Suryani (Finance Manager)",
    priority: "critical",
    status: "in_progress",
    dueDate: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
    externalCounterpartName: "Bpk. Tanoto (Finance Director)",
    externalCounterpartOrg: "PT Mega Logistik Nusantara",
    externalCounterpartPhone: "081987654321",
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
    nextStep: "Cetak album foto geotag 100% titik tiang pancang zone utara",
    ownerId: "usr-andi",
    ownerName: "Andi Wijaya (Senior QS)",
    priority: "medium",
    status: "open",
    dueDate: new Date(Date.now() + 4 * 86400000).toISOString().split("T")[0],
    externalCounterpartName: "Bpk. Suryo (Konsultan Pengawas)",
    externalCounterpartOrg: "PT Sentosa Enjiniring",
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "act-004",
    projectId: "prj-cisumdawu",
    entityType: "claim",
    entityId: "clm-cis-002",
    riskType: "UNCERTIFIED_AT_RISK",
    financialExposure: 450_000_000,
    title: "Klarifikasi Pengujian Kepadatan Tanah Timbunan (Overdue)",
    description: "Hasil tes kepadatan tanah timbunan zona 4 pending persetujuan Balai Jalan nasional.",
    nextStep: "Audiensi teknis ke laboratorium PU bersama konsultan pengawas",
    ownerId: "usr-fajar",
    ownerName: "Fajar Pratama (Project Manager)",
    priority: "high",
    status: "open",
    dueDate: new Date(Date.now() - 4 * 86400000).toISOString().split("T")[0], // Overdue 4 days (ACT-007)
    externalCounterpartName: "Bpk. Ir. Danang",
    externalCounterpartOrg: "Balai Besar Pelaksanaan Jalan Nasional",
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
];

export const INITIAL_AUDIT_LOGS: any[] = [];

export const INITIAL_SOURCE_IMPORTS: DemoSourceImport[] = [
  {
    id: "imp-001",
    orgId: "org-nusantara-01",
    projectId: "prj-meridian",
    fileName: "Tracker_MC006_Grand_Meridian.xlsx",
    fileSizeBytes: 2458000,
    fileChecksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    sheetName: "Rekapitulasi Klaim",
    totalRows: 85,
    acceptedRows: 85,
    rejectedRows: 0,
    totalSourceValue: 2750000000,
    acceptedValue: 2750000000,
    rejectedValue: 0,
    reconciliationVariance: 0,
    status: "COMPLETED",
    uploadedBy: "Andi Saputra (QS)",
    uploadedAt: "2026-08-01T09:15:00Z",
    notes: "Import awal rekap progres MC-006 Grand Meridian.",
  },
  {
    id: "imp-002",
    orgId: "org-nusantara-01",
    projectId: "prj-logistic",
    fileName: "Progress_Billing_Hub_Aug26.csv",
    fileSizeBytes: 980000,
    fileChecksum: "c79a953e5e40ee428eb3109a1ff0df0ec67d0cf0c466907ba04ee0bc211603ba",
    sheetName: "CSV Default",
    totalRows: 42,
    acceptedRows: 40,
    rejectedRows: 2,
    totalSourceValue: 1850000000,
    acceptedValue: 1710000000,
    rejectedValue: 140000000,
    reconciliationVariance: 140000000,
    status: "COMPLETED",
    uploadedBy: "Andi Saputra (QS)",
    uploadedAt: "2026-08-05T14:30:00Z",
    notes: "Import termin Agustus Nusantara Logistic Hub dengan 2 baris tanggal tidak valid.",
  },
];

export const INITIAL_IMPORT_TEMPLATES: DemoImportMappingTemplate[] = [
  {
    id: "tmpl-001",
    orgId: "org-nusantara-01",
    templateName: "Format Standar Excel QS Kontraktor",
    entityType: "claims",
    columnMapping: {
      project_code: "Kode Proyek",
      claim_number: "No. Sertifikat / MC",
      period_start: "Tanggal Mulai",
      period_end: "Tanggal Selesai",
      work_performed_value: "Nilai Fisik Bruto",
      measured_value: "Nilai Opname Bersama",
      claimed_value: "Nilai Klaim Diajukan",
      certified_value: "Nilai Disahkan MK",
      expected_cash_date: "Target Cair",
      adjustment_reason: "Catatan Penyesuaian",
    },
    createdByName: "Dimas Sucipto (Commercial Manager)",
    createdAt: "2026-07-01T10:00:00Z",
  },
  {
    id: "tmpl-002",
    orgId: "org-nusantara-01",
    templateName: "Format Tracker Subkon Baja",
    entityType: "claims",
    columnMapping: {
      project_code: "ProjectCode",
      claim_number: "ClaimNumber",
      period_start: "PeriodStart",
      period_end: "PeriodEnd",
      work_performed_value: "WorkPerformed",
      measured_value: "MeasuredValue",
      claimed_value: "ClaimedValue",
      certified_value: "CertifiedValue",
      expected_cash_date: "ExpectedCashDate",
    },
    createdByName: "Dimas Sucipto (Commercial Manager)",
    createdAt: "2026-07-15T11:30:00Z",
  },
];

// ==========================================
// PHASE 6: CLAIM READINESS GATE (RDY-001..013)
// ==========================================

export interface DemoContractEvidenceChecklist {
  id: string;
  orgId: string;
  projectId: string;
  contractId?: string;
  version: string;
  effectiveDate: string;
  status: "ACTIVE" | "SUPERSEDED" | "DRAFT";
  internalLeadTimeDays: number;
  createdByName: string;
  createdAt: string;
}

export interface DemoContractEvidenceChecklistItem {
  id: string;
  checklistId: string;
  name: string;
  description?: string;
  requirementLevel: "REQUIRED" | "CONDITIONAL" | "OPTIONAL";
  conditionRule?: string;
  sourceClauseReference: string;
  sortOrder: number;
}

export interface DemoClaimReadinessItem {
  id: string;
  orgId: string;
  claimId: string;
  templateItemId?: string;
  name: string;
  requirementLevel: "REQUIRED" | "CONDITIONAL" | "OPTIONAL";
  sourceClauseReference?: string;
  status: "MISSING" | "PRESENT" | "VERIFIED" | "REJECTED" | "NOT_APPLICABLE";
  documentUrl?: string;
  documentTitle?: string;
  notes?: string;
  actionOwnerId?: string;
  actionOwnerName?: string;
  dueDate?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export const INITIAL_CONTRACT_EVIDENCE_CHECKLISTS: DemoContractEvidenceChecklist[] = [
  {
    id: "chk-meridian-01",
    orgId: "org-nusantara-01",
    projectId: "prj-meridian",
    contractId: "ctr-meridian-001",
    version: "1.0",
    effectiveDate: "2026-01-01",
    status: "ACTIVE",
    internalLeadTimeDays: 5, // Cut-off tgl 25 -> internal target tgl 20 (RDY-008)
    createdByName: "Dimas Sucipto (Commercial Manager)",
    createdAt: "2026-01-05T09:00:00Z",
  },
  {
    id: "chk-cisumdawu-01",
    orgId: "org-nusantara-01",
    projectId: "prj-cisumdawu",
    contractId: "ctr-cisumdawu-002",
    version: "1.0",
    effectiveDate: "2026-02-01",
    status: "ACTIVE",
    internalLeadTimeDays: 7,
    createdByName: "Dimas Sucipto (Commercial Manager)",
    createdAt: "2026-02-05T09:00:00Z",
  },
];

export const INITIAL_CONTRACT_EVIDENCE_CHECKLIST_ITEMS: DemoContractEvidenceChecklistItem[] = [
  {
    id: "chk-item-01",
    checklistId: "chk-meridian-01",
    name: "Berita Acara Opname Bersama (Joint Measurement)",
    description: "Ditandatangani oleh Kontraktor, Konsultan MK (IndoKarya), dan Owner",
    requirementLevel: "REQUIRED",
    sourceClauseReference: "Pasal 12 Ayat 1: Tata Cara Pengukuran Volume Bersama",
    sortOrder: 1,
  },
  {
    id: "chk-item-02",
    checklistId: "chk-meridian-01",
    name: "Gambar Kerja Terlaksana (As-Built / Redline Drawing)",
    description: "Lembar gambar redline bertanda tangan Site Engineer & Pengawas",
    requirementLevel: "REQUIRED",
    sourceClauseReference: "Pasal 12 Ayat 4: Lampiran Gambar Opname",
    sortOrder: 2,
  },
  {
    id: "chk-item-03",
    checklistId: "chk-meridian-01",
    name: "Sertifikat Uji Laboratorium Mutu Beton & Baja",
    description: "Hasil tes kuat tekan silinder beton 28 hari dari lab independen",
    requirementLevel: "REQUIRED",
    sourceClauseReference: "Pasal 9 Ayat 2: Jaminan Standar Mutu Material",
    sortOrder: 3,
  },
  {
    id: "chk-item-04",
    checklistId: "chk-meridian-01",
    name: "Persetujuan Perubahan Pekerjaan (Variation Order / VO)",
    description: "Wajib dilampirkan jika terdapat pekerjaan di luar BOQ kontrak awal",
    requirementLevel: "CONDITIONAL",
    conditionRule: "has_variation_order",
    sourceClauseReference: "Pasal 18 Ayat 2: Prosedur Pengajuan Pekerjaan Tambah",
    sortOrder: 4,
  },
  {
    id: "chk-item-05",
    checklistId: "chk-meridian-01",
    name: "Surat Pernyataan Bebas Tuntutan Upah Subkon",
    description: "Pernyataan mandiri bahwa subkon telah menerima pembayaran",
    requirementLevel: "OPTIONAL",
    sourceClauseReference: "Pasal 24 Ayat 1: Kepatuhan Ketenagakerjaan",
    sortOrder: 5,
  },
  {
    id: "chk-item-06",
    checklistId: "chk-meridian-01",
    name: "Risalah Rapat Evaluasi Progres Bulanan",
    description: "Notulensi rapat koordinasi mingguan/bulanan resmi",
    requirementLevel: "REQUIRED",
    sourceClauseReference: "Pasal 14 Ayat 3: Kelengkapan Dokumen Administrasi Klaim",
    sortOrder: 6,
  },
];

export const INITIAL_CLAIM_READINESS_ITEMS: DemoClaimReadinessItem[] = [
  {
    id: "rdy-clm006-01",
    orgId: "org-nusantara-01",
    claimId: "clm-meridian-006",
    templateItemId: "chk-item-01",
    name: "Berita Acara Opname Bersama (Joint Measurement)",
    requirementLevel: "REQUIRED",
    sourceClauseReference: "Pasal 12 Ayat 1: Tata Cara Pengukuran Volume Bersama",
    status: "VERIFIED",
    documentUrl: "https://storage.cove.internal/docs/BA_Opname_MC006_Signed.pdf",
    documentTitle: "BA_Opname_MC006_Signed.pdf",
    verifiedByName: "Dimas Sucipto (Commercial Manager)",
    verifiedAt: "2026-08-15T14:20:00Z",
    createdAt: "2026-08-01T08:00:00Z",
  },
  {
    id: "rdy-clm006-02",
    orgId: "org-nusantara-01",
    claimId: "clm-meridian-006",
    templateItemId: "chk-item-02",
    name: "Gambar Kerja Terlaksana (As-Built / Redline Drawing)",
    requirementLevel: "REQUIRED",
    sourceClauseReference: "Pasal 12 Ayat 4: Lampiran Gambar Opname",
    status: "VERIFIED",
    documentUrl: "https://storage.cove.internal/docs/Redline_Lt14-16_Approved.dwg",
    documentTitle: "Redline_Lt14-16_Approved.dwg",
    verifiedByName: "Dimas Sucipto (Commercial Manager)",
    verifiedAt: "2026-08-16T10:15:00Z",
    createdAt: "2026-08-01T08:00:00Z",
  },
  {
    id: "rdy-clm006-03",
    orgId: "org-nusantara-01",
    claimId: "clm-meridian-006",
    templateItemId: "chk-item-03",
    name: "Sertifikat Uji Laboratorium Mutu Beton & Baja",
    requirementLevel: "REQUIRED",
    sourceClauseReference: "Pasal 9 Ayat 2: Jaminan Standar Mutu Material",
    status: "VERIFIED",
    documentUrl: "https://storage.cove.internal/docs/Lab_Test_Beton_K400_Lt15.pdf",
    documentTitle: "Lab_Test_Beton_K400_Lt15.pdf",
    verifiedByName: "Budi Santoso (Project QS)",
    verifiedAt: "2026-08-16T16:45:00Z",
    createdAt: "2026-08-01T08:00:00Z",
  },
  {
    id: "rdy-clm006-04",
    orgId: "org-nusantara-01",
    claimId: "clm-meridian-006",
    templateItemId: "chk-item-04",
    name: "Persetujuan Perubahan Pekerjaan (Variation Order / VO)",
    requirementLevel: "CONDITIONAL",
    sourceClauseReference: "Pasal 18 Ayat 2: Prosedur Pengajuan Pekerjaan Tambah",
    status: "PRESENT",
    documentUrl: "https://drive.google.com/open?id=draft_vo_fasade_02",
    documentTitle: "Draft VO Fasade Tambahan Lt 15.pdf",
    notes: "Menunggu tanda tangan final dari konsultan MK",
    actionOwnerId: "usr-dimas",
    actionOwnerName: "Dimas Sucipto (Commercial Manager)",
    dueDate: "2026-08-20",
    createdAt: "2026-08-01T08:00:00Z",
  },
  {
    id: "rdy-clm006-05",
    orgId: "org-nusantara-01",
    claimId: "clm-meridian-006",
    templateItemId: "chk-item-05",
    name: "Surat Pernyataan Bebas Tuntutan Upah Subkon",
    requirementLevel: "OPTIONAL",
    sourceClauseReference: "Pasal 24 Ayat 1: Kepatuhan Ketenagakerjaan",
    status: "MISSING",
    notes: "Opsional - tidak memblokir kesiapan pengajuan termin",
    createdAt: "2026-08-01T08:00:00Z",
  },
  {
    id: "rdy-clm006-06",
    orgId: "org-nusantara-01",
    claimId: "clm-meridian-006",
    templateItemId: "chk-item-06",
    name: "Risalah Rapat Evaluasi Progres Bulanan",
    requirementLevel: "REQUIRED",
    sourceClauseReference: "Pasal 14 Ayat 3: Kelengkapan Dokumen Administrasi Klaim",
    status: "MISSING",
    actionOwnerId: "usr-budi",
    actionOwnerName: "Budi Santoso (Project QS)", // Mandatory for missing required (RDY-007)
    dueDate: "2026-08-20",
    notes: "Risalah rapat minggu ke-4 sedang disusun notulis lapangan",
    createdAt: "2026-08-01T08:00:00Z",
  },
];

// ==========================================
// PHASE 7: WEEKLY REVIEW SNAPSHOTS (ACT-015)
// ==========================================

export interface DemoWeeklyReviewSnapshot {
  id: string;
  orgId: string;
  projectId?: string;
  snapshotDate: string;
  totalExposure: number;
  controllableExposure: number;
  openActionsCount: number;
  overdueActionsCount: number;
  overdueExposure: number;
  freshnessStatus: string;
  lockedByUserId: string;
  lockedByName: string;
  notes?: string;
  createdAt: string;
}

export const INITIAL_WEEKLY_SNAPSHOTS: DemoWeeklyReviewSnapshot[] = [
  {
    id: "snap-w32-2026",
    orgId: "org-nusantara-01",
    projectId: "prj-meridian",
    snapshotDate: "2026-08-08",
    totalExposure: 2750000000,
    controllableExposure: 1100000000,
    openActionsCount: 4,
    overdueActionsCount: 1,
    overdueExposure: 450000000,
    freshnessStatus: "CURRENT",
    lockedByUserId: "usr-dimas",
    lockedByName: "Dimas Sucipto (Commercial Manager)",
    notes: "Review mingguan terkunci W32: Fokus pembuktian volume fasade Grand Meridian.",
    createdAt: "2026-08-08T17:00:00Z",
  },
];

// ==========================================
// PHASE 8: PROJECT BASELINES (PRT-009, PRT-013)
// ==========================================

export interface DemoProjectBaseline {
  id: string;
  orgId: string;
  projectId: string;
  baselineDate: string;
  baselineExposure: number;
  baselineCycleDays: number;
  lockedByName: string;
  lockReason: string;
  createdAt: string;
}

export const INITIAL_PROJECT_BASELINES: DemoProjectBaseline[] = [
  {
    id: "base-meridian-01",
    orgId: "org-nusantara-01",
    projectId: "prj-meridian",
    baselineDate: "2026-06-01",
    baselineExposure: 3200000000,
    baselineCycleDays: 48,
    lockedByName: "Dimas Sucipto (Commercial Manager)",
    lockReason: "Baseline awal sebelum implementasi COVE pilot: rata-rata siklus penagihan 48 hari dan eksposur tertahan Rp3,2M.",
    createdAt: "2026-06-01T09:00:00Z",
  },
  {
    id: "base-cisumdawu-01",
    orgId: "org-nusantara-01",
    projectId: "prj-cisumdawu",
    baselineDate: "2026-06-15",
    baselineExposure: 1850000000,
    baselineCycleDays: 42,
    lockedByName: "Fajar Pratama (Project Manager)",
    lockReason: "Baseline intake proyek Cisumdawu Seksi 4.",
    createdAt: "2026-06-15T10:00:00Z",
  },
];

// ==========================================
// PHASE 9: SAVED FILTER VIEWS (PLT-014)
// ==========================================

export interface DemoSavedFilterView {
  id: string;
  orgId: string;
  userId?: string;
  viewName: string;
  pageContext: string;
  filterCriteria: Record<string, any>;
  isDefault?: boolean;
  createdAt: string;
}

export const INITIAL_SAVED_FILTER_VIEWS: DemoSavedFilterView[] = [
  {
    id: "view-review-direksi",
    orgId: "org-nusantara-01",
    userId: "usr-bambang",
    viewName: "Rapat Direksi: Eksposur Terkendali",
    pageContext: "progress-to-cash",
    filterCriteria: { controllability: "INTERNAL", minExposure: 100000000 },
    isDefault: true,
    createdAt: "2026-08-01T08:00:00Z",
  },
  {
    id: "view-actions-overdue",
    orgId: "org-nusantara-01",
    userId: "usr-dimas",
    viewName: "Tindakan Overdue SLA",
    pageContext: "actions",
    filterCriteria: { status: "open", overdueOnly: true },
    isDefault: false,
    createdAt: "2026-08-05T09:00:00Z",
  },
];

// ==========================================
// PHASE 10: ONBOARDING & PILOT SCORECARDS (PRD 23, 28)
// ==========================================

export interface DemoDataAcceptanceItem {
  id: string;
  orgId: string;
  projectId: string;
  itemKey: string;
  itemLabel: string;
  description: string;
  status: "PENDING" | "VERIFIED" | "WAIVED";
  verifiedByName?: string;
  verifiedAt?: string;
  notes?: string;
}

export interface DemoPilotScorecard {
  id: string;
  orgId: string;
  projectId: string;
  projectName: string;
  pilotTier: string;
  pilotDay: number;
  baselineExposure: number;
  closingExposure: number;
  resolvedExposureLevelA: number;
  baselineCycleDays: number;
  closingCycleDays: number;
  roiMultiplier: number;
  recommendedTier: string;
  renewalRecommendationRationale: string;
  timeBudgetCompliance: {
    implementationEffortHours: number;
    isImplementationUnderBudget: boolean;
    weeklyReviewMinutesPerProject: number;
    isWeeklyReviewUnderBudget: boolean;
  };
  createdAt: string;
}

export const INITIAL_DATA_ACCEPTANCE_SEEDS: DemoDataAcceptanceItem[] = [
  {
    id: "da-01",
    orgId: "org-nusantara-01",
    projectId: "prj-meridian",
    itemKey: "DATA_OWNER_IDENTIFIED",
    itemLabel: "Data Owner & Authorized Uploader Teridentifikasi",
    description: "PIC utama kontraktor dan staf yang berhak mengunggah data opname telah ditetapkan.",
    status: "VERIFIED",
    verifiedByName: "Dimas Sucipto (Commercial Manager)",
    verifiedAt: "2026-08-01T10:00:00Z",
    notes: "PIC Lapangan: Fajar Pratama, Finance: Hendra Gunawan.",
  },
  {
    id: "da-02",
    orgId: "org-nusantara-01",
    projectId: "prj-meridian",
    itemKey: "PII_REDACTED",
    itemLabel: "Redaksi PII (Data Pribadi) yang Tidak Diperlukan",
    description: "Data rekening pribadi staf lapangan, NIK, dan data sensitif non-proyek telah dihapus/disamarkan.",
    status: "VERIFIED",
    verifiedByName: "Bambang Wijaya (Director)",
    verifiedAt: "2026-08-01T11:00:00Z",
    notes: "Hanya nomor kontrak komersial dan rekening escrow proyek.",
  },
  {
    id: "da-03",
    orgId: "org-nusantara-01",
    projectId: "prj-meridian",
    itemKey: "PERIOD_BASIS_KNOWN",
    itemLabel: "Basis Periode & Akumulatif / Periodik Diketahui",
    description: "Format angka progres (bobot % kumulatif vs nilai bruto klaim bulanan) telah dikonfirmasi.",
    status: "VERIFIED",
    verifiedByName: "Dimas Sucipto",
    verifiedAt: "2026-08-02T09:00:00Z",
    notes: "Format MC-006 berbasis kumulatif s/d MC berjalan.",
  },
  {
    id: "da-04",
    orgId: "org-nusantara-01",
    projectId: "prj-meridian",
    itemKey: "SOURCE_VALUES_RECONCILED",
    itemLabel: "Nilai Sumber Dapat Direkonsiliasi 100%",
    description: "Total nilai kontrak dan rekap opname pada Excel sumber cocok sempurna dengan angka intake.",
    status: "VERIFIED",
    verifiedByName: "Hendra Gunawan (Finance)",
    verifiedAt: "2026-08-02T14:00:00Z",
    notes: "Total kontrak Rp 45 Miliar cocok tanpa selisih pembulatan.",
  },
  {
    id: "da-05",
    orgId: "org-nusantara-01",
    projectId: "prj-meridian",
    itemKey: "CONTRACT_RULE_REFERENCED",
    itemLabel: "Aturan Kontrak Memiliki Rujukan Klausul Resmi",
    description: "Jadwal cut-off, SLA BAP 14 hari, dan ketentuan kalender kerja merujuk pasal kontrak fisik.",
    status: "VERIFIED",
    verifiedByName: "Dimas Sucipto",
    verifiedAt: "2026-08-03T10:00:00Z",
    notes: "Pasal 8 Ayat 2 Kontrak Utama Grand Meridian.",
  },
  {
    id: "da-06",
    orgId: "org-nusantara-01",
    projectId: "prj-meridian",
    itemKey: "KNOWN_GAPS_RECORDED",
    itemLabel: "Kesenjangan (Gaps) Diketahui Dicatat Transparan",
    description: "Keterlambatan sertifikasi eksisting tidak disamarkan sebagai nol, melainkan dicatat di G3.",
    status: "VERIFIED",
    verifiedByName: "Fajar Pratama",
    verifiedAt: "2026-08-03T15:00:00Z",
    notes: "Potongan BAP Rp20 Juta pada MC-006 tercatat aktif di gap uncertified.",
  },
  {
    id: "da-07",
    orgId: "org-nusantara-01",
    projectId: "prj-meridian",
    itemKey: "PROJECT_ACCESS_APPROVED",
    itemLabel: "Hak Akses Proyek Berbasis Peran Disetujui",
    description: "Penugasan anggota tim proyek (PM, CM, Finance, Viewer) telah divalidasi.",
    status: "VERIFIED",
    verifiedByName: "Bambang Wijaya",
    verifiedAt: "2026-08-04T08:00:00Z",
    notes: "9 role matrix RBAC diterapkan.",
  },
  {
    id: "da-08",
    orgId: "org-nusantara-01",
    projectId: "prj-meridian",
    itemKey: "DATA_RETENTION_AGREED",
    label: "Ketentuan Retensi & Ekspor Pasca Pilot Disepakati",
    description: "Hak unduh seluruh data (Grace period) saat pilot selesai telah disepakati bersama.",
    status: "VERIFIED",
    verifiedByName: "Bambang Wijaya",
    verifiedAt: "2026-08-04T09:00:00Z",
    notes: "Kontraktor berhak ekspor JSON/CSV penuh setiap saat.",
  },
];

export const INITIAL_PILOT_SCORECARDS: DemoPilotScorecard[] = [
  {
    id: "sc-meridian-45",
    orgId: "org-nusantara-01",
    projectId: "prj-meridian",
    projectName: "Grand Meridian Mixed-Use Development",
    pilotTier: "b2b_pilot",
    pilotDay: 45,
    baselineExposure: 3200000000,
    closingExposure: 1800000000,
    resolvedExposureLevelA: 850000000,
    baselineCycleDays: 48,
    closingCycleDays: 32,
    roiMultiplier: 8.5,
    recommendedTier: "b2b_core",
    renewalRecommendationRationale: "Nilai ROI pilot mencapai 8.5x biaya pilot Rp10 Juta dengan pemotongan siklus penagihan sebesar 16 hari kalender kerja. Disarankan beralih ke langganan tahunan Core B2B.",
    timeBudgetCompliance: {
      implementationEffortHours: 12,
      isImplementationUnderBudget: true,
      weeklyReviewMinutesPerProject: 8,
      isWeeklyReviewUnderBudget: true,
    },
    createdAt: "2026-08-30T10:00:00Z",
  },
];

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
export const SEED_CONTRACT_RULE_VERSIONS = INITIAL_CONTRACT_RULE_VERSIONS;
export const SEED_SOURCE_IMPORTS = INITIAL_SOURCE_IMPORTS;
export const SEED_IMPORT_TEMPLATES = INITIAL_IMPORT_TEMPLATES;
export const SEED_CONTRACT_EVIDENCE_CHECKLISTS = INITIAL_CONTRACT_EVIDENCE_CHECKLISTS;
export const SEED_CONTRACT_EVIDENCE_CHECKLIST_ITEMS = INITIAL_CONTRACT_EVIDENCE_CHECKLIST_ITEMS;
export const SEED_CLAIM_READINESS_ITEMS = INITIAL_CLAIM_READINESS_ITEMS;
export const SEED_WEEKLY_SNAPSHOTS = INITIAL_WEEKLY_SNAPSHOTS;
export const SEED_PROJECT_BASELINES = INITIAL_PROJECT_BASELINES;
export const SEED_SAVED_FILTER_VIEWS = INITIAL_SAVED_FILTER_VIEWS;
export const SEED_DATA_ACCEPTANCE_ITEMS = INITIAL_DATA_ACCEPTANCE_SEEDS;
export const SEED_PILOT_SCORECARDS = INITIAL_PILOT_SCORECARDS;

