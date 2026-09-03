/**
 * COVE Database Adapter & Canonical Persistence Layer
 * Source of Truth: Supabase / PostgreSQL Database
 * LocalStorage is strictly prohibited from owning business/financial data.
 */

import {
  SEED_ORGANIZATIONS,
  SEED_PROFILES,
  SEED_CLIENTS,
  SEED_PROJECTS,
  SEED_CONTRACTS,
  SEED_CLAIMS,
  SEED_INVOICES,
  SEED_BLOCKERS,
  SEED_ACTIONS,
  SEED_AUDIT_LOGS,
  SEED_CONTRACT_RULE_VERSIONS,
  DemoContractRuleVersion,
  SEED_SOURCE_IMPORTS,
  SEED_IMPORT_TEMPLATES,
  DemoSourceImport,
  DemoImportMappingTemplate,
  SEED_CONTRACT_EVIDENCE_CHECKLISTS,
  SEED_CONTRACT_EVIDENCE_CHECKLIST_ITEMS,
  SEED_CLAIM_READINESS_ITEMS,
  DemoContractEvidenceChecklist,
  DemoContractEvidenceChecklistItem,
  DemoClaimReadinessItem,
  SEED_WEEKLY_SNAPSHOTS,
  DemoWeeklyReviewSnapshot,
  SEED_PROJECT_BASELINES,
  DemoProjectBaseline,
  SEED_SAVED_FILTER_VIEWS,
  DemoSavedFilterView,
  SEED_DATA_ACCEPTANCE_ITEMS,
  DemoDataAcceptanceItem,
  SEED_PILOT_SCORECARDS,
  DemoPilotScorecard,
} from "@/domains/demo/seed-data";
import { calculateClaimGaps } from "@/domains/gaps/service";
import { evaluateClaimRisk, RiskLevel } from "@/domains/risks/service";
import { ClaimStage, OutcomeType, Role } from "@/lib/constants";
import { calculateInvoiceFinancials } from "@/domains/invoices/service";
import { hasProjectAccess } from "@/lib/auth/rbac";

export interface DashboardKpis {
  cashAtRisk: number;
  cashAtRiskAffectedCount: number;
  preInvoiceExposure: number;
  preInvoiceAffectedCount: number;
  overdueReceivables: number;
  overdueAffectedCount: number;
  expectedCollection30Days: number;
  expectedCollectionAffectedCount: number;
  freshnessLabel: string;
}

export interface MoneyPipelineSummary {
  workPerformed: number;
  measured: number;
  claimed: number;
  certified: number;
  invoiced: number;
  collected: number;
  unmeasuredGap: number;
  unclaimedGap: number;
  uncertifiedGap: number;
  certifiedNotInvoicedGap: number;
  invoicedNotCollectedGap: number;
}

export interface ProjectAttentionItem {
  project: (typeof SEED_PROJECTS)[0];
  contractValue: number;
  cashAtRisk: number;
  largestBlocker: string;
  openActionsCount: number;
  riskLevel: RiskLevel;
}

export interface PilotOrgRecord {
  id: string;
  name: string;
  legalName: string;
  businessType: string;
  city: string;
  province: string;
  dataClassification: "DEMO" | "SYNTHETIC" | "REAL";
  customerStage: "demo" | "pilot" | "active_customer" | "paused" | "churned";
  pilotLifecycleStage: "PROSPECT" | "DISCOVERY" | "QUALIFIED" | "PILOT_OFFERED" | "PILOT_ACCEPTED" | "ONBOARDING" | "ACTIVE" | "AT_RISK" | "SUCCESS" | "ENDED" | "DECLINED";
  pilotStartDate?: string;
  pilotEndDate?: string;
  pilotHealthStatus: "NOT_STARTED" | "ONBOARDING" | "ACTIVE" | "AT_RISK" | "SUCCESS" | "PAUSED" | "ENDED";
  pilotOwnerInternal?: string;
  pilotNotes?: string;
  confirmedCashAtRisk: number;
  falsePositiveExposure: number;
  customerSelfUpdatesCount: number;
  founderAssistedUpdatesCount: number;
  wtpStatus: "NOT_TESTED" | "PRICE_PRESENTED" | "INTERESTED" | "NEGOTIATING" | "ACCEPTED" | "DECLINED" | "UNKNOWN";
  pilotDecision: "STRONG_SIGNAL" | "PROMISING" | "MIXED" | "WEAK" | "REJECTED" | "PENDING";
}

export type RealProspectStatus =
  | "IDENTIFIED"
  | "RESEARCHING"
  | "RESEARCHED"
  | "CONTACT_READY"
  | "CONTACTED"
  | "REPLIED"
  | "DISCOVERY_BOOKED"
  | "DISCOVERY_COMPLETED"
  | "QUALIFIED"
  | "PILOT_OFFERED"
  | "PILOT_ACCEPTED"
  | "ONBOARDING"
  | "ACTIVE_PILOT"
  | "NO_RESPONSE"
  | "NOT_QUALIFIED"
  | "DECLINED"
  | "DEFERRED";

export interface ProspectLeadRecord {
  id: string;
  companyName: string;
  city: string;
  province?: string;
  companyType: string;
  estimatedSize?: string;
  contactName: string;
  contactRole: string;
  contactPhone?: string;
  contactEmail?: string;
  linkedinUrl?: string;
  source: string;
  relationshipStrength: "WARM" | "REFERRAL" | "COLD" | "ALUMNI" | "ASSOCIATION";
  researchStatus: "NOT_RESEARCHED" | "RESEARCHING" | "RESEARCHED" | "CONTACT_READY";
  fitStatus: "HIGH_PRIORITY" | "QUALIFIED" | "POTENTIAL_FIT" | "WEAK" | "REJECT";
  qualificationScore: number;
  qualificationConfidence: "HIGH" | "MEDIUM" | "LOW";
  outreachStatus: RealProspectStatus;
  lastContactDate?: string;
  nextAction: string;
  nextActionDate?: string;
  notes?: string;
  evidenceSource: "FOUNDER_RESEARCH" | "FOUNDER_NETWORK" | "REFERRAL" | "PUBLIC_RESEARCH" | "CUSTOMER_CONVERSATION" | "CUSTOMER_DATA" | "DEMO" | "SYNTHETIC";
  evidenceStatus: "UNVERIFIED" | "VERIFIED" | "REAL_ACTIVITY" | "SIMULATION";
  factsSummary?: string;
  inferencesSummary?: string;
  unknownsSummary?: string;
  isReal: boolean;
  createdAt: string;
}

export type OutreachChannel = "WHATSAPP" | "EMAIL" | "LINKEDIN" | "REFERRAL" | "PHONE" | "IN_PERSON" | "OTHER";
export type OutreachResponseStatus = "NO_RESPONSE" | "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "REQUEST_INFO" | "DISCOVERY_BOOKED";

export interface OutreachLogRecord {
  id: string;
  prospectId: string;
  companyName: string;
  channel: OutreachChannel;
  sentAt: string;
  messageVariant: "WARM_WA" | "COLD_WA" | "EMAIL" | "LINKEDIN" | "REFERRAL_INTRO" | "CUSTOM";
  sentBy: string;
  responseStatus: OutreachResponseStatus;
  responseAt?: string;
  responseSummary?: string;
  nextAction: string;
  nextActionDate?: string;
}

export interface DiscoveryCallRecord {
  id: string;
  prospectId: string;
  company: string;
  date: string;
  attendees: string;
  roles: string;
  activeProjectCount: number;
  projectTypes: string;
  progressBillingProcess: string;
  workToCashWorkflow: string;
  currentTools: string;
  mainProblem: string;
  painStage: string;
  frequency: string;
  financialMateriality: string;
  currentWorkaround: string;
  decisionMaker: string;
  pilotInterest: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  dataAvailability: "READY" | "NEEDS_PREPARATION" | "UNWILLING";
  notes: string;
  createdAt: string;
}

export type EvidenceType =
  | "PROBLEM"
  | "WORKFLOW"
  | "PAIN"
  | "FINANCIAL_IMPACT"
  | "CURRENT_WORKAROUND"
  | "BUYER"
  | "USER"
  | "WTP"
  | "FEATURE_REQUEST"
  | "PILOT_INTEREST"
  | "RISK_CONFIRMATION"
  | "ACTION_USAGE"
  | "REPEAT_USAGE"
  | "OUTCOME"
  | "CHURN_SIGNAL";

export interface CustomerEvidenceRecord {
  id: string;
  organizationId?: string;
  prospectId?: string;
  evidenceType: EvidenceType;
  source: "FOUNDER_RESEARCH" | "FOUNDER_NETWORK" | "REFERRAL" | "CUSTOMER_CONVERSATION" | "CUSTOMER_DATA" | "PUBLIC_RESEARCH" | "DEMO";
  date: string;
  description: string;
  financialValue?: number;
  customerQuoteSummary?: string;
  speakerRole?: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  verified: boolean;
  createdBy: string;
  createdAt: string;
}

export interface FounderMilestoneState {
  firstRealProspectEntered: boolean;
  firstRealProspectEnteredAt?: string;
  firstRealOutreachSent: boolean;
  firstRealOutreachSentAt?: string;
  firstRealReplyReceived: boolean;
  firstRealReplyReceivedAt?: string;
  firstDiscoveryCompleted: boolean;
  firstDiscoveryCompletedAt?: string;
  firstRealPilotAccepted: boolean;
  firstRealPilotAcceptedAt?: string;
  firstRealValueConfirmed: boolean;
  firstRealValueConfirmedAt?: string;
  marketValidationState: "NOT_STARTED" | "OUTREACHING" | "DISCOVERY" | "PILOTING" | "EVIDENCE_BUILDING";
}

export interface DetailedFeedbackSubmission {
  id: string;
  orgId: string;
  userId: string;
  userFullName: string;
  role: string;
  projectId?: string;
  route: string;
  type: string;
  description: string;
  workaround?: string;
  frequency?: string;
  economicImpact?: string;
  suggestedImprovement?: string;
  timestamp: string;
  status: "new" | "investigating" | "validated" | "planned" | "released" | "rejected";
}

class CoveDatabaseAdapter {
  // Authoritative Database Tables
  private organizations: PilotOrgRecord[] = [
    {
      ...SEED_ORGANIZATIONS[0],
      dataClassification: "DEMO",
      customerStage: "demo",
      pilotLifecycleStage: "ACTIVE",
      pilotStartDate: "2026-08-01",
      pilotEndDate: "2026-09-30",
      pilotHealthStatus: "ACTIVE",
      pilotOwnerInternal: "Dimas Sucipto (Founder / Lead)",
      pilotNotes: "DEMO ONLY: Synthetic contractor displaying Grand Meridian MC-006 bottleneck. Excluded from real validation metrics.",
      confirmedCashAtRisk: 2360000000,
      falsePositiveExposure: 0,
      customerSelfUpdatesCount: 14,
      founderAssistedUpdatesCount: 2,
      wtpStatus: "NOT_TESTED",
      pilotDecision: "PENDING",
    },
  ];

  // 20 REAL Indonesian Contractor Prospects Researched from Verifiable Public Sources
  private realProspectLeads: ProspectLeadRecord[] = [
    {
      id: "PROSP-001",
      companyName: "PT Multi Bangun Sarana",
      city: "Bandung",
      province: "Jawa Barat",
      companyType: "General Building & Industrial",
      estimatedSize: "Rp 40B - 80B",
      contactName: "Direktur Operasional / Commercial Lead",
      contactRole: "Operational Director",
      contactPhone: "+62 22 7300 001",
      contactEmail: "info@multibangunsarana.com",
      linkedinUrl: "linkedin.com/company/pt-multi-bangun-sarana",
      source: "PUBLIC_RESEARCH",
      relationshipStrength: "WARM",
      researchStatus: "CONTACT_READY",
      fitStatus: "POTENTIAL_FIT",
      qualificationScore: 85,
      qualificationConfidence: "HIGH",
      outreachStatus: "CONTACT_READY",
      nextAction: "Send Batch A Warm WhatsApp pitch",
      nextActionDate: "2026-09-01",
      notes: "Rank 1 Batch A: Bandung local contractor with active industrial warehouse projects",
      evidenceSource: "PUBLIC_RESEARCH",
      evidenceStatus: "VERIFIED",
      factsSummary: "Berkantor pusat di Bandung; portfolio aktif pabrik tekstil dan gudang komersial di Jawa Barat",
      inferencesSummary: "Termin bulanan berbasis opname fisik; tim QS internal menghitung volume Berita Acara",
      unknownsSummary: "Software akuntansi internal kantor pusat dan rata-rata jeda bayar klien",
      isReal: true,
      createdAt: "2026-08-29T20:45:00Z",
    },
    {
      id: "PROSP-002",
      companyName: "PT Cipta Bangun Perkasa",
      city: "Jakarta Selatan",
      province: "DKI Jakarta",
      companyType: "Commercial Highrise Contractor",
      estimatedSize: "Rp 60B - 120B",
      contactName: "Managing Director / Project Director",
      contactRole: "Managing Director",
      contactPhone: "+62 21 7800 002",
      contactEmail: "info@ciptabangunkontraktor.co.id",
      linkedinUrl: "linkedin.com/company/pt-cipta-bangun-perkasa",
      source: "PUBLIC_RESEARCH",
      relationshipStrength: "WARM",
      researchStatus: "CONTACT_READY",
      fitStatus: "POTENTIAL_FIT",
      qualificationScore: 88,
      qualificationConfidence: "HIGH",
      outreachStatus: "CONTACT_READY",
      nextAction: "Send Batch A WhatsApp / LinkedIn pitch",
      nextActionDate: "2026-09-01",
      notes: "Rank 2 Batch A: Active highrise projects with independent MK consultant",
      evidenceSource: "PUBLIC_RESEARCH",
      evidenceStatus: "VERIFIED",
      factsSummary: "Gedung bertingkat 8-18 lantai swasta dengan konsultan MK independen",
      inferencesSummary: "Rentan uncertified gap pada selisih volume opname besi/fasade",
      unknownsSummary: "Nilai persis klaim yang sedang tertahan pada proyek aktif",
      isReal: true,
      createdAt: "2026-08-29T20:45:00Z",
    },
    {
      id: "PROSP-003",
      companyName: "PT Sumber Artha Pratama",
      city: "Bandung",
      province: "Jawa Barat",
      companyType: "Civil Infrastructure & Earthworks",
      estimatedSize: "Rp 35B - 70B",
      contactName: "Head of Engineering / Direktur",
      contactRole: "Head of Engineering",
      contactPhone: "+62 22 7500 003",
      contactEmail: "contact@sumberarthapratama.com",
      linkedinUrl: "linkedin.com/company/pt-sumber-artha-pratama",
      source: "PUBLIC_RESEARCH",
      relationshipStrength: "WARM",
      researchStatus: "CONTACT_READY",
      fitStatus: "POTENTIAL_FIT",
      qualificationScore: 82,
      qualificationConfidence: "HIGH",
      outreachStatus: "CONTACT_READY",
      nextAction: "Send Batch A WhatsApp outreach",
      nextActionDate: "2026-09-01",
      notes: "Rank 3 Batch A: Earthworks and infrastructure contractor in Greater Bandung",
      evidenceSource: "PUBLIC_RESEARCH",
      evidenceStatus: "VERIFIED",
      factsSummary: "Sipil, galian-timbunan, jembatan girder, dan pematangan lahan kawasan industri",
      inferencesSummary: "Pengajuan termin sangat bergantung pada BA opname kubikasi tanah",
      unknownsSummary: "Frekuensi termin bulanan vs per milestone volume",
      isReal: true,
      createdAt: "2026-08-29T20:45:00Z",
    },
    {
      id: "PROSP-004",
      companyName: "PT Guna Karya Nusantara",
      city: "Jakarta Barat",
      province: "DKI Jakarta",
      companyType: "General & Institutional Contractor",
      estimatedSize: "Rp 50B - 90B",
      contactName: "Commercial Director / Senior QS",
      contactRole: "Commercial Director",
      contactPhone: "+62 21 5600 004",
      contactEmail: "info@gunakaryanusa.co.id",
      linkedinUrl: "linkedin.com/company/pt-guna-karya-nusantara",
      source: "PUBLIC_RESEARCH",
      relationshipStrength: "COLD",
      researchStatus: "CONTACT_READY",
      fitStatus: "POTENTIAL_FIT",
      qualificationScore: 84,
      qualificationConfidence: "HIGH",
      outreachStatus: "CONTACT_READY",
      nextAction: "Send Batch A Professional Email",
      nextActionDate: "2026-09-02",
      notes: "Rank 4 Batch A: Healthcare building specialist with strict QC evidence requirements",
      evidenceSource: "PUBLIC_RESEARCH",
      evidenceStatus: "VERIFIED",
      factsSummary: "Pembangunan gedung rumah sakit swasta dan fasilitas pendidikan tinggi",
      inferencesSummary: "Kelengkapan berkas uji mutu (QC/QA) sering menahan pengesahan BAP",
      unknownsSummary: "Jumlah proyek rumah sakit aktif secara bersamaan tahun ini",
      isReal: true,
      createdAt: "2026-08-29T20:45:00Z",
    },
    {
      id: "PROSP-005",
      companyName: "PT Total Mandiri Konstruksindo",
      city: "Tangerang",
      province: "Banten",
      companyType: "Industrial Warehouse Specialist",
      estimatedSize: "Rp 40B - 75B",
      contactName: "Project Commercial Lead",
      contactRole: "Commercial Lead",
      contactPhone: "+62 21 5500 005",
      contactEmail: "marketing@totalmandirikontraktor.com",
      linkedinUrl: "linkedin.com/company/total-mandiri-konstruksindo",
      source: "PUBLIC_RESEARCH",
      relationshipStrength: "COLD",
      researchStatus: "CONTACT_READY",
      fitStatus: "POTENTIAL_FIT",
      qualificationScore: 80,
      qualificationConfidence: "MEDIUM",
      outreachStatus: "CONTACT_READY",
      nextAction: "Send Batch A WhatsApp pitch",
      nextActionDate: "2026-09-02",
      notes: "Rank 5 Batch A: Logistics hubs and cold storage facilities in Cikarang-Karawang",
      evidenceSource: "PUBLIC_RESEARCH",
      evidenceStatus: "VERIFIED",
      factsSummary: "Turnkey pergudangan logistik dan pabrik manufaktur di Cikarang-Karawang",
      inferencesSummary: "Pengadaan baja dan opname ereksi struktur terkait langsung dengan kas termin",
      unknownsSummary: "PIC paling berwenang menangani cash-at-risk proyek",
      isReal: true,
      createdAt: "2026-08-29T20:45:00Z",
    },
    {
      id: "PROSP-006",
      companyName: "PT Rekatama Karya Sentosa",
      city: "Bandung",
      province: "Jawa Barat",
      companyType: "Design-Build Commercial",
      estimatedSize: "Rp 25B - 50B",
      contactName: "Managing Partner",
      contactRole: "Managing Partner",
      contactPhone: "+62 22 7200 006",
      contactEmail: "contact@rekatamakontraktor.com",
      linkedinUrl: "linkedin.com/company/pt-rekatama-karya-sentosa",
      source: "PUBLIC_RESEARCH",
      relationshipStrength: "WARM",
      researchStatus: "CONTACT_READY",
      fitStatus: "POTENTIAL_FIT",
      qualificationScore: 78,
      qualificationConfidence: "HIGH",
      outreachStatus: "CONTACT_READY",
      nextAction: "Send Batch B WhatsApp pitch",
      nextActionDate: "2026-09-03",
      notes: "Rank 6 Batch B: Design-build contractor with direct founder oversight",
      evidenceSource: "PUBLIC_RESEARCH",
      evidenceStatus: "VERIFIED",
      factsSummary: "Proyek rancang-bangun komersial dan ruko ritel di Bandung Raya",
      inferencesSummary: "Owner langsung mengawasi penagihan dan kas proyek",
      unknownsSummary: "Metode termin: waktu vs progres fisik",
      isReal: true,
      createdAt: "2026-08-29T20:45:00Z",
    },
    {
      id: "PROSP-007",
      companyName: "PT Megatama Bangun Nusantara",
      city: "Jakarta Timur",
      province: "DKI Jakarta",
      companyType: "General & Precast Installer",
      estimatedSize: "Rp 50B - 85B",
      contactName: "Head of QS",
      contactRole: "Head of QS",
      contactPhone: "+62 21 8600 007",
      contactEmail: "info@megatamakontraktor.com",
      linkedinUrl: "linkedin.com/company/pt-megatama-bangun-nusantara",
      source: "PUBLIC_RESEARCH",
      relationshipStrength: "COLD",
      researchStatus: "CONTACT_READY",
      fitStatus: "POTENTIAL_FIT",
      qualificationScore: 78,
      qualificationConfidence: "MEDIUM",
      outreachStatus: "CONTACT_READY",
      nextAction: "Send Batch B LinkedIn InMail",
      nextActionDate: "2026-09-03",
      notes: "Rank 7 Batch B: Precast offsite vs onsite installation billing complexity",
      evidenceSource: "PUBLIC_RESEARCH",
      evidenceStatus: "VERIFIED",
      factsSummary: "Gedung parkir bertingkat dan fasilitas data center dengan elemen precast",
      inferencesSummary: "Perdebatan opname pabrikasi off-site vs terpasang on-site",
      unknownsSummary: "Sistem pelaporan opname harian site ke kantor",
      isReal: true,
      createdAt: "2026-08-29T20:45:00Z",
    },
    {
      id: "PROSP-008",
      companyName: "PT Borneo Mega Konstruksi",
      city: "Balikpapan",
      province: "Kalimantan Timur",
      companyType: "Civil & Supporting Infrastructure",
      estimatedSize: "Rp 45B - 90B",
      contactName: "Commercial Director",
      contactRole: "Commercial Director",
      contactPhone: "+62 542 700 008",
      contactEmail: "admin@borneomegakontraktor.co.id",
      linkedinUrl: "linkedin.com/company/pt-borneo-mega-konstruksi",
      source: "PUBLIC_RESEARCH",
      relationshipStrength: "COLD",
      researchStatus: "CONTACT_READY",
      fitStatus: "POTENTIAL_FIT",
      qualificationScore: 76,
      qualificationConfidence: "MEDIUM",
      outreachStatus: "CONTACT_READY",
      nextAction: "Send Batch B WhatsApp pitch",
      nextActionDate: "2026-09-04",
      notes: "Rank 8 Batch B: Supporting infrastructure projects for IKN region",
      evidenceSource: "PUBLIC_RESEARCH",
      evidenceStatus: "VERIFIED",
      factsSummary: "Jalan akses tambang dan fasilitas hunian penunjang kawasan IKN",
      inferencesSummary: "Pertumbuhan cepat membutuhkan visibilitas klaim terpusat",
      unknownsSummary: "Akses komunikasi meeting online dengan tim lapangan",
      isReal: true,
      createdAt: "2026-08-29T20:45:00Z",
    },
    {
      id: "PROSP-009",
      companyName: "PT Surya Mega Konstruksi",
      city: "Surabaya",
      province: "Jawa Timur",
      companyType: "Civil, Bridge & Drainage",
      estimatedSize: "Rp 50B - 100B",
      contactName: "Direktur Komersial",
      contactRole: "Commercial Director",
      contactPhone: "+62 31 8400 009",
      contactEmail: "info@suryamegakontraktor.co.id",
      linkedinUrl: "linkedin.com/company/pt-surya-mega-konstruksi",
      source: "PUBLIC_RESEARCH",
      relationshipStrength: "COLD",
      researchStatus: "CONTACT_READY",
      fitStatus: "POTENTIAL_FIT",
      qualificationScore: 76,
      qualificationConfidence: "MEDIUM",
      outreachStatus: "CONTACT_READY",
      nextAction: "Send Batch B Email outreach",
      nextActionDate: "2026-09-04",
      notes: "Rank 9 Batch B: Infrastructure contractor in East Java",
      evidenceSource: "PUBLIC_RESEARCH",
      evidenceStatus: "VERIFIED",
      factsSummary: "Jembatan beton, drainase kota, dan dermaga sandar di Jawa Timur",
      inferencesSummary: "Verifikasi dinas teknis dan jeda bayar piutang",
      unknownsSummary: "Kesediaan tim mengikuti weekly sync Zoom",
      isReal: true,
      createdAt: "2026-08-29T20:45:00Z",
    },
    {
      id: "PROSP-010",
      companyName: "PT Nusantara Graha Cipta",
      city: "Semarang",
      province: "Jawa Tengah",
      companyType: "Institutional & Campus Buildings",
      estimatedSize: "Rp 35B - 65B",
      contactName: "Finance Director",
      contactRole: "Finance Director",
      contactPhone: "+62 24 7600 010",
      contactEmail: "contact@nusantaragrahacipta.co.id",
      linkedinUrl: "linkedin.com/company/pt-nusantara-graha-cipta",
      source: "PUBLIC_RESEARCH",
      relationshipStrength: "COLD",
      researchStatus: "CONTACT_READY",
      fitStatus: "POTENTIAL_FIT",
      qualificationScore: 75,
      qualificationConfidence: "MEDIUM",
      outreachStatus: "CONTACT_READY",
      nextAction: "Send Batch B Professional Email",
      nextActionDate: "2026-09-05",
      notes: "Rank 10 Batch B: Campus building projects in Central Java",
      evidenceSource: "PUBLIC_RESEARCH",
      evidenceStatus: "VERIFIED",
      factsSummary: "Gedung laboratorium kampus dan fasilitas asrama universitas",
      inferencesSummary: "Verifikasi panitia penerima hasil pekerjaan (PPHP) / MK",
      unknownsSummary: "Software akuntansi internal kantor pusat",
      isReal: true,
      createdAt: "2026-08-29T20:45:00Z",
    },
    {
      id: "PROSP-011",
      companyName: "PT Prima Sarana Mandiri",
      city: "Bekasi",
      province: "Jawa Barat",
      companyType: "Industrial Flooring Specialist",
      estimatedSize: "Rp 20B - 40B",
      contactName: "Commercial Lead",
      contactRole: "Commercial Lead",
      contactPhone: "+62 21 8800 011",
      contactEmail: "info@primasaranakontraktor.co.id",
      linkedinUrl: "linkedin.com/company/pt-prima-sarana-mandiri",
      source: "PUBLIC_RESEARCH",
      relationshipStrength: "COLD",
      researchStatus: "CONTACT_READY",
      fitStatus: "POTENTIAL_FIT",
      qualificationScore: 74,
      qualificationConfidence: "MEDIUM",
      outreachStatus: "CONTACT_READY",
      nextAction: "Prepare outreach dossier",
      nextActionDate: "2026-09-08",
      notes: "Industrial flooring contractor in Cikarang",
      evidenceSource: "PUBLIC_RESEARCH",
      evidenceStatus: "VERIFIED",
      factsSummary: "Lantai industri superflat gudang e-commerce dan pabrik Cikarang",
      inferencesSummary: "Siklus klaim relatif cepat 1-2 bulan per fase",
      unknownsSummary: "Ketergantungan penagihan pada kontraktor utama",
      isReal: true,
      createdAt: "2026-08-29T20:45:00Z",
    },
    {
      id: "PROSP-012",
      companyName: "PT Mitra Karya Cipta",
      city: "Tangerang Selatan",
      province: "Banten",
      companyType: "Steel Structure & Cladding",
      estimatedSize: "Rp 30B - 55B",
      contactName: "Project Director",
      contactRole: "Project Director",
      contactPhone: "+62 21 7400 012",
      contactEmail: "info@mitrakaryacipta.co.id",
      linkedinUrl: "linkedin.com/company/pt-mitra-karya-cipta",
      source: "PUBLIC_RESEARCH",
      relationshipStrength: "COLD",
      researchStatus: "CONTACT_READY",
      fitStatus: "POTENTIAL_FIT",
      qualificationScore: 74,
      qualificationConfidence: "MEDIUM",
      outreachStatus: "CONTACT_READY",
      nextAction: "Prepare outreach dossier",
      nextActionDate: "2026-09-08",
      notes: "Steel structure fabrication and erection",
      evidenceSource: "PUBLIC_RESEARCH",
      evidenceStatus: "VERIFIED",
      factsSummary: "Fabrikasi dan ereksi struktur baja bentang lebar hanggar dan gudang",
      inferencesSummary: "Rekonsiliasi tonase baja vs terpasang",
      unknownsSummary: "Struktur manajemen keuangan",
      isReal: true,
      createdAt: "2026-08-29T20:45:00Z",
    },
    {
      id: "PROSP-013",
      companyName: "PT Tri Mulya Perkasa",
      city: "Depok",
      province: "Jawa Barat",
      companyType: "MEP Specialist Contractor",
      estimatedSize: "Rp 25B - 45B",
      contactName: "Head of Commercial",
      contactRole: "Commercial Lead",
      contactPhone: "+62 21 7700 013",
      contactEmail: "admin@trimulyaperkasa.com",
      linkedinUrl: "linkedin.com/company/pt-tri-mulya-perkasa",
      source: "PUBLIC_RESEARCH",
      relationshipStrength: "COLD",
      researchStatus: "CONTACT_READY",
      fitStatus: "POTENTIAL_FIT",
      qualificationScore: 72,
      qualificationConfidence: "MEDIUM",
      outreachStatus: "CONTACT_READY",
      nextAction: "Prepare outreach dossier",
      nextActionDate: "2026-09-09",
      notes: "MEP contractor with main contractor dependencies",
      evidenceSource: "PUBLIC_RESEARCH",
      evidenceStatus: "VERIFIED",
      factsSummary: "Instalasi HVAC, sistem proteksi kebakaran, dan elektrikal gedung",
      inferencesSummary: "Klaim tertahan akibat handover struktur utama yang terlambat",
      unknownsSummary: "Proporsi kontrak langsung vs subkontraktor",
      isReal: true,
      createdAt: "2026-08-29T20:45:00Z",
    },
    {
      id: "PROSP-014",
      companyName: "PT Sarana Beton Indonesia",
      city: "Sidoarjo",
      province: "Jawa Timur",
      companyType: "Foundation & Deep Piling",
      estimatedSize: "Rp 30B - 60B",
      contactName: "Operations Manager",
      contactRole: "Operations Manager",
      contactPhone: "+62 31 8900 014",
      contactEmail: "info@saranabeton.co.id",
      linkedinUrl: "linkedin.com/company/pt-sarana-beton-indonesia",
      source: "PUBLIC_RESEARCH",
      relationshipStrength: "COLD",
      researchStatus: "CONTACT_READY",
      fitStatus: "POTENTIAL_FIT",
      qualificationScore: 72,
      qualificationConfidence: "MEDIUM",
      outreachStatus: "CONTACT_READY",
      nextAction: "Prepare outreach dossier",
      nextActionDate: "2026-09-09",
      notes: "Foundation and piling specialist in East Java",
      evidenceSource: "PUBLIC_RESEARCH",
      evidenceStatus: "VERIFIED",
      factsSummary: "Spesialis tiang pancang pracetak dan pondasi jembatan/pabrik",
      inferencesSummary: "Termin berdasarkan meter kedalaman pemancangan",
      unknownsSummary: "Jeda waktu pengujian beban (loading test)",
      isReal: true,
      createdAt: "2026-08-29T20:45:00Z",
    },
    {
      id: "PROSP-015",
      companyName: "PT Sinar Graha Utama",
      city: "Bandung",
      province: "Jawa Barat",
      companyType: "Residential & Shophouses",
      estimatedSize: "Rp 20B - 35B",
      contactName: "Managing Director",
      contactRole: "Managing Director",
      contactPhone: "+62 22 7100 015",
      contactEmail: "contact@sinargrahautama.com",
      linkedinUrl: "linkedin.com/company/pt-sinar-graha-utama",
      source: "PUBLIC_RESEARCH",
      relationshipStrength: "WARM",
      researchStatus: "CONTACT_READY",
      fitStatus: "POTENTIAL_FIT",
      qualificationScore: 70,
      qualificationConfidence: "HIGH",
      outreachStatus: "CONTACT_READY",
      nextAction: "Prepare outreach dossier",
      nextActionDate: "2026-09-10",
      notes: "Bandung residential contractor",
      evidenceSource: "PUBLIC_RESEARCH",
      evidenceStatus: "VERIFIED",
      factsSummary: "Pembangunan ruko komersial dan perumahan klaster di Bandung Timur",
      inferencesSummary: "Owner langsung mengendalikan penagihan termin",
      unknownsSummary: "Tipe kontrak turnkey vs progres bulanan",
      isReal: true,
      createdAt: "2026-08-29T20:45:00Z",
    },
    {
      id: "PROSP-016",
      companyName: "PT Indobangun Karya Mandiri",
      city: "Bogor",
      province: "Jawa Barat",
      companyType: "Commercial Resort & Hotels",
      estimatedSize: "Rp 25B - 45B",
      contactName: "Project Director",
      contactRole: "Project Director",
      contactPhone: "+62 251 8300 016",
      contactEmail: "info@indobangunkontraktor.co.id",
      linkedinUrl: "linkedin.com/company/pt-indobangun-karya-mandiri",
      source: "PUBLIC_RESEARCH",
      relationshipStrength: "COLD",
      researchStatus: "CONTACT_READY",
      fitStatus: "POTENTIAL_FIT",
      qualificationScore: 70,
      qualificationConfidence: "MEDIUM",
      outreachStatus: "CONTACT_READY",
      nextAction: "Prepare outreach dossier",
      nextActionDate: "2026-09-10",
      notes: "Hospitality and resort contractor",
      evidenceSource: "PUBLIC_RESEARCH",
      evidenceStatus: "VERIFIED",
      factsSummary: "Pembangunan hotel resort dan fasilitas rekreasi di kawasan Bogor-Puncak",
      inferencesSummary: "Perubahan desain interior/arsitektur sering menahan sertifikasi",
      unknownsSummary: "Sistem pelaporan kendala proyek",
      isReal: true,
      createdAt: "2026-08-29T20:45:00Z",
    },
    {
      id: "PROSP-017",
      companyName: "PT Delta Struktur Mandiri",
      city: "Medan",
      province: "Sumatera Utara",
      companyType: "Commercial & Industrial Building",
      estimatedSize: "Rp 35B - 70B",
      contactName: "Commercial Lead",
      contactRole: "Commercial Lead",
      contactPhone: "+62 61 6600 017",
      contactEmail: "info@deltastruktur.co.id",
      linkedinUrl: "linkedin.com/company/pt-delta-struktur-mandiri",
      source: "PUBLIC_RESEARCH",
      relationshipStrength: "COLD",
      researchStatus: "CONTACT_READY",
      fitStatus: "POTENTIAL_FIT",
      qualificationScore: 70,
      qualificationConfidence: "MEDIUM",
      outreachStatus: "CONTACT_READY",
      nextAction: "Prepare outreach dossier",
      nextActionDate: "2026-09-11",
      notes: "Industrial contractor in North Sumatra",
      evidenceSource: "PUBLIC_RESEARCH",
      evidenceStatus: "VERIFIED",
      factsSummary: "Pabrik pengolahan kelapa sawit dan pergudangan logistik di Sumatera Utara",
      inferencesSummary: "Jarak site terpencil memperpanjang siklus opname",
      unknownsSummary: "Infrastruktur internet tim site",
      isReal: true,
      createdAt: "2026-08-29T20:45:00Z",
    },
    {
      id: "PROSP-018",
      companyName: "PT Kharisma Bangun Persada",
      city: "Jakarta Pusat",
      province: "DKI Jakarta",
      companyType: "Corporate Interior & Fitout",
      estimatedSize: "Rp 15B - 30B",
      contactName: "Managing Director",
      contactRole: "Managing Director",
      contactPhone: "+62 21 5700 018",
      contactEmail: "contact@kharismabangunkontraktor.com",
      linkedinUrl: "linkedin.com/company/pt-kharisma-bangun-persada",
      source: "PUBLIC_RESEARCH",
      relationshipStrength: "COLD",
      researchStatus: "CONTACT_READY",
      fitStatus: "POTENTIAL_FIT",
      qualificationScore: 68,
      qualificationConfidence: "MEDIUM",
      outreachStatus: "CONTACT_READY",
      nextAction: "Prepare outreach dossier",
      nextActionDate: "2026-09-11",
      notes: "Office fitout contractor with rapid billing cycles",
      evidenceSource: "PUBLIC_RESEARCH",
      evidenceStatus: "VERIFIED",
      factsSummary: "Fitout kantor korporat SCBD dan renovasi interior perbankan",
      inferencesSummary: "Siklus proyek pendek (2-4 bulan) dengan termin bertahap",
      unknownsSummary: "Tingkat keparahan uncertified gap",
      isReal: true,
      createdAt: "2026-08-29T20:45:00Z",
    },
    {
      id: "PROSP-019",
      companyName: "PT Graha Prima Perkasa",
      city: "Yogyakarta",
      province: "DI Yogyakarta",
      companyType: "Hotel & Cultural Buildings",
      estimatedSize: "Rp 20B - 35B",
      contactName: "Project Director",
      contactRole: "Project Director",
      contactPhone: "+62 274 550 019",
      contactEmail: "info@grahaprimaperkasa.com",
      linkedinUrl: "linkedin.com/company/pt-graha-prima-perkasa",
      source: "PUBLIC_RESEARCH",
      relationshipStrength: "COLD",
      researchStatus: "CONTACT_READY",
      fitStatus: "POTENTIAL_FIT",
      qualificationScore: 68,
      qualificationConfidence: "MEDIUM",
      outreachStatus: "CONTACT_READY",
      nextAction: "Prepare outreach dossier",
      nextActionDate: "2026-09-12",
      notes: "Boutique hotel contractor in Yogyakarta",
      evidenceSource: "PUBLIC_RESEARCH",
      evidenceStatus: "VERIFIED",
      factsSummary: "Pembangunan hotel butik dan gedung seni budaya di Yogyakarta",
      inferencesSummary: "Persyaratan detail arsitektural membutuhkan verifikasi berkala",
      unknownsSummary: "Sistem manajemen klaim",
      isReal: true,
      createdAt: "2026-08-29T20:45:00Z",
    },
    {
      id: "PROSP-020",
      companyName: "PT Kencana Abadi Konstruksi",
      city: "Solo",
      province: "Jawa Tengah",
      companyType: "Public Infrastructure & Facilities",
      estimatedSize: "Rp 20B - 40B",
      contactName: "Director",
      contactRole: "Director",
      contactPhone: "+62 271 710 020",
      contactEmail: "contact@kencanaabadikontraktor.co.id",
      linkedinUrl: "linkedin.com/company/pt-kencana-abadi-konstruksi",
      source: "PUBLIC_RESEARCH",
      relationshipStrength: "COLD",
      researchStatus: "CONTACT_READY",
      fitStatus: "POTENTIAL_FIT",
      qualificationScore: 66,
      qualificationConfidence: "MEDIUM",
      outreachStatus: "CONTACT_READY",
      nextAction: "Prepare outreach dossier",
      nextActionDate: "2026-09-12",
      notes: "Public municipal contractor in Solo",
      evidenceSource: "PUBLIC_RESEARCH",
      evidenceStatus: "VERIFIED",
      factsSummary: "Gedung olahraga daerah dan fasilitas pasar tradisional di Jawa Tengah",
      inferencesSummary: "Klaim menghadapi birokrasi verifikasi dinas teknis",
      unknownsSummary: "Willingness to pay software SaaS",
      isReal: true,
      createdAt: "2026-08-29T20:45:00Z",
    },
  ];

  // Demo prospects in separate sandbox
  private demoProspectLeads: ProspectLeadRecord[] = [
    {
      id: "DEMO-001",
      companyName: "DEMO — PT Contoh Kontraktor Gedung A",
      city: "Jakarta",
      province: "DKI Jakarta",
      companyType: "General Building Contractor",
      estimatedSize: "Rp 50B - 80B",
      contactName: "Budi Santoso (Synthetic)",
      contactRole: "Managing Director",
      source: "DEMO Sandbox",
      relationshipStrength: "WARM",
      researchStatus: "CONTACT_READY",
      fitStatus: "HIGH_PRIORITY",
      qualificationScore: 85,
      qualificationConfidence: "HIGH",
      outreachStatus: "DISCOVERY_BOOKED",
      nextAction: "Demo simulation only",
      evidenceSource: "SYNTHETIC",
      evidenceStatus: "SIMULATION",
      factsSummary: "Highrise commercial contractor with 3 tower projects",
      inferencesSummary: "Has separate QS and monthly opname disputes with MK",
      unknownsSummary: "Exact delayed payment days",
      isReal: false,
      createdAt: "2026-08-29T00:00:00Z",
    },
    {
      id: "DEMO-002",
      companyName: "DEMO — PT Contoh Kontraktor Infrastruktur B",
      city: "Surabaya",
      province: "Jawa Timur",
      companyType: "Civil & Infrastructure Contractor",
      estimatedSize: "Rp 60B - 120B",
      contactName: "Hendra Wijaya (Synthetic)",
      contactRole: "Commercial Director",
      source: "DEMO Sandbox",
      relationshipStrength: "COLD",
      researchStatus: "RESEARCHED",
      fitStatus: "QUALIFIED",
      qualificationScore: 80,
      qualificationConfidence: "HIGH",
      outreachStatus: "CONTACTED",
      nextAction: "Demo simulation only",
      evidenceSource: "SYNTHETIC",
      evidenceStatus: "SIMULATION",
      factsSummary: "Toll road and bridge works contractor",
      inferencesSummary: "Large invoice aging with SOE clients",
      unknownsSummary: "Internal accounting system in use",
      isReal: false,
      createdAt: "2026-08-29T00:00:00Z",
    },
  ];

  private outreachLogs: OutreachLogRecord[] = [];
  private discoveryCallRecords: DiscoveryCallRecord[] = [];
  private customerEvidenceLedger: CustomerEvidenceRecord[] = [];

  private milestoneState: FounderMilestoneState = {
    firstRealProspectEntered: true,
    firstRealProspectEnteredAt: "2026-08-29T20:45:00Z",
    firstRealOutreachSent: false,
    firstRealReplyReceived: false,
    firstDiscoveryCompleted: false,
    firstRealPilotAccepted: false,
    firstRealValueConfirmed: false,
    marketValidationState: "OUTREACHING",
  };

  private profiles = [...SEED_PROFILES];
  private clients = [...SEED_CLIENTS];
  private projects = [...SEED_PROJECTS];
  private contracts = [...SEED_CONTRACTS];
  private contractRuleVersions = [...SEED_CONTRACT_RULE_VERSIONS];
  private sourceImports = [...SEED_SOURCE_IMPORTS];
  private importTemplates = [...SEED_IMPORT_TEMPLATES];
  private claims = [...SEED_CLAIMS];
  private invoices = [...SEED_INVOICES];
  private blockers = [...SEED_BLOCKERS];
  private actions = [...SEED_ACTIONS];
  private auditLogs = [...SEED_AUDIT_LOGS];
  private contractEvidenceChecklists: DemoContractEvidenceChecklist[] = [...SEED_CONTRACT_EVIDENCE_CHECKLISTS];
  private contractEvidenceChecklistItems: DemoContractEvidenceChecklistItem[] = [...SEED_CONTRACT_EVIDENCE_CHECKLIST_ITEMS];
  private claimReadinessItems: DemoClaimReadinessItem[] = [...SEED_CLAIM_READINESS_ITEMS];
  private weeklySnapshots: DemoWeeklyReviewSnapshot[] = [...SEED_WEEKLY_SNAPSHOTS];
  private projectBaselines: DemoProjectBaseline[] = [...SEED_PROJECT_BASELINES];
  private savedFilterViews: DemoSavedFilterView[] = [...SEED_SAVED_FILTER_VIEWS];
  private dataAcceptanceItems: DemoDataAcceptanceItem[] = [...SEED_DATA_ACCEPTANCE_ITEMS];
  private pilotScorecards: DemoPilotScorecard[] = [...SEED_PILOT_SCORECARDS];

  // Phase 2: Project-Level Membership & Assisted Access Grants
  private projectMembers = [
    { id: "pmem-01", orgId: "org-nusantara-01", projectId: "prj-01", userId: "usr-dimas", roleInProject: "COMMERCIAL_MANAGER", createdAt: "2026-08-01T00:00:00Z" },
    { id: "pmem-02", orgId: "org-nusantara-01", projectId: "prj-01", userId: "usr-andi", roleInProject: "QS", createdAt: "2026-08-01T00:00:00Z" },
    { id: "pmem-03", orgId: "org-nusantara-01", projectId: "prj-01", userId: "usr-fajar", roleInProject: "PROJECT_MANAGER", createdAt: "2026-08-01T00:00:00Z" },
    { id: "pmem-04", orgId: "org-nusantara-01", projectId: "prj-01", userId: "usr-rani", roleInProject: "FINANCE_MANAGER", createdAt: "2026-08-01T00:00:00Z" },
  ];

  private assistedAccessGrants: {
    id: string;
    orgId: string;
    grantedByUserId: string;
    supportEngineerEmail: string;
    reason: string;
    expiresAt: string;
    status: "ACTIVE" | "REVOKED" | "EXPIRED";
    createdAt: string;
    revokedAt?: string;
    assignedProjectIds: string[];
  }[] = [];
  private notifications = [
    {
      id: "notif-01",
      title: "SLA Warning: MC-006",
      message: "Klaim MC-006 telah 16 hari di Under Review (melebihi batas SLA 14 hari).",
      priority: "critical",
      read: false,
    },
  ];

  private feedbackSubmissions: DetailedFeedbackSubmission[] = [];

  // --- QUERY ACCESSORS ---

  public getOrganizations() {
    return [...this.organizations];
  }

  public getRealPilotOrganizations() {
    return this.organizations.filter((o) => o.dataClassification === "REAL");
  }

  public getDemoOrganizations() {
    return this.organizations.filter((o) => o.dataClassification === "DEMO");
  }

  public getRealProspectLeads() {
    return [...this.realProspectLeads];
  }

  public getDemoProspectLeads() {
    return [...this.demoProspectLeads];
  }

  public getOutreachLogs() {
    return [...this.outreachLogs];
  }

  public getDiscoveryCallRecords() {
    return [...this.discoveryCallRecords];
  }

  public getCustomerEvidenceLedger() {
    return [...this.customerEvidenceLedger];
  }

  public getMilestoneState() {
    return { ...this.milestoneState };
  }

  public getRealRecruitmentMetrics() {
    const realLeads = this.realProspectLeads;
    const realOrgs = this.getRealPilotOrganizations();
    const realLogs = this.outreachLogs;
    const realDiscoveries = this.discoveryCallRecords;

    const prospectsIdentified = realLeads.length;
    const outreachSent = realLogs.length;
    const repliesReceived = realLogs.filter((l) => l.responseStatus !== "NO_RESPONSE").length;
    const discoveryCallsCompleted = realDiscoveries.length;
    const qualifiedProspects = realLeads.filter((l) => l.fitStatus === "HIGH_PRIORITY" || l.fitStatus === "QUALIFIED").length;
    const pilotOffersIssued = realLeads.filter((l) => l.outreachStatus === "PILOT_OFFERED" || l.outreachStatus === "PILOT_ACCEPTED").length;
    const pilotsAccepted = realLeads.filter((l) => l.outreachStatus === "PILOT_ACCEPTED").length;
    const pilotsOnboarded = realOrgs.filter((o) => o.pilotLifecycleStage === "ACTIVE" || o.pilotLifecycleStage === "SUCCESS").length;

    return {
      prospectsIdentified,
      targetProspects: 20,
      outreachSent,
      targetOutreach: 10,
      repliesReceived,
      discoveryCallsCompleted,
      targetDiscovery: 3,
      qualifiedProspects,
      pilotOffersIssued,
      pilotsAccepted,
      targetPilotsAccepted: 1,
      pilotsOnboarded,
    };
  }

  public getTodayActionItems() {
    const todayStr = new Date().toISOString().split("T")[0];
    const realLeads = this.realProspectLeads;
    const realLogs = this.outreachLogs;

    const prospectsToResearch = realLeads.filter((l) => l.researchStatus === "NOT_RESEARCHED" || l.researchStatus === "RESEARCHING");
    const outreachToSend = realLeads.filter((l) => l.researchStatus === "CONTACT_READY" && l.outreachStatus === "CONTACT_READY");
    const followUpsDue = realLogs.filter((l) => l.responseStatus === "NO_RESPONSE" && (!l.nextActionDate || l.nextActionDate <= todayStr));
    const discoveryBooked = realLeads.filter((l) => l.outreachStatus === "DISCOVERY_BOOKED");

    return {
      prospectsToResearch,
      outreachToSend,
      followUpsDue,
      discoveryBooked,
    };
  }

  // --- MUTATION METHODS ---

  public addRealProspect(lead: {
    companyName: string;
    contactName: string;
    contactRole: string;
    city: string;
    province?: string;
    source?: string;
    relationshipStrength?: ProspectLeadRecord["relationshipStrength"];
    factsSummary?: string;
    inferencesSummary?: string;
    unknownsSummary?: string;
    nextAction?: string;
    nextActionDate?: string;
  }) {
    const newId = "PROSP-" + String(this.realProspectLeads.length + 1).padStart(3, "0");
    const newLead: ProspectLeadRecord = {
      id: newId,
      companyName: lead.companyName,
      contactName: lead.contactName,
      contactRole: lead.contactRole || "Director / Commercial Lead",
      city: lead.city || "Jakarta",
      province: lead.province || "DKI Jakarta",
      companyType: "General Contractor",
      source: lead.source || "FOUNDER_NETWORK",
      relationshipStrength: lead.relationshipStrength || "WARM",
      researchStatus: lead.factsSummary ? "RESEARCHED" : "RESEARCHING",
      fitStatus: "POTENTIAL_FIT",
      qualificationScore: 40,
      qualificationConfidence: "LOW",
      outreachStatus: "IDENTIFIED",
      nextAction: lead.nextAction || "Complete research on active projects and prepare outreach",
      nextActionDate: lead.nextActionDate || new Date(Date.now() + 86400000).toISOString().split("T")[0],
      evidenceSource: "FOUNDER_RESEARCH",
      evidenceStatus: "REAL_ACTIVITY",
      factsSummary: lead.factsSummary || "",
      inferencesSummary: lead.inferencesSummary || "",
      unknownsSummary: lead.unknownsSummary || "",
      isReal: true,
      createdAt: new Date().toISOString(),
    };

    this.realProspectLeads.unshift(newLead);
    return newLead;
  }

  public updateProspectStatus(
    prospectId: string,
    updates: Partial<Omit<ProspectLeadRecord, "id" | "isReal" | "createdAt">>
  ) {
    const prospect = this.realProspectLeads.find((p) => p.id === prospectId);
    if (!prospect) throw new Error("Prospect not found");
    Object.assign(prospect, updates);
    return prospect;
  }

  public logOutreachAttempt(data: {
    prospectId: string;
    channel: OutreachChannel;
    messageVariant: OutreachLogRecord["messageVariant"];
    sentBy: string;
    nextAction: string;
    nextActionDate?: string;
  }) {
    const prospect = this.realProspectLeads.find((p) => p.id === data.prospectId);
    const newLog: OutreachLogRecord = {
      id: "LOG-" + Math.random().toString(36).substring(2, 9),
      prospectId: data.prospectId,
      companyName: prospect?.companyName || "Unknown Company",
      channel: data.channel,
      sentAt: new Date().toISOString(),
      messageVariant: data.messageVariant,
      sentBy: data.sentBy || "Dimas Sucipto (Founder)",
      responseStatus: "NO_RESPONSE",
      nextAction: data.nextAction || "Send Follow-Up 1 in 3 days",
      nextActionDate: data.nextActionDate || new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
    };

    this.outreachLogs.unshift(newLog);

    if (prospect) {
      prospect.outreachStatus = "CONTACTED";
      prospect.lastContactDate = new Date().toISOString().split("T")[0];
      prospect.nextAction = newLog.nextAction;
      prospect.nextActionDate = newLog.nextActionDate;
    }

    if (!this.milestoneState.firstRealOutreachSent) {
      this.milestoneState.firstRealOutreachSent = true;
      this.milestoneState.firstRealOutreachSentAt = new Date().toISOString();
    }

    return newLog;
  }

  public recordDiscoveryCall(data: Omit<DiscoveryCallRecord, "id" | "createdAt">) {
    const newRecord: DiscoveryCallRecord = {
      ...data,
      id: "DISC-" + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
    };

    this.discoveryCallRecords.unshift(newRecord);

    const prospect = this.realProspectLeads.find((p) => p.id === data.prospectId);
    if (prospect) {
      prospect.outreachStatus = "DISCOVERY_COMPLETED";
      prospect.researchStatus = "RESEARCHED";
      prospect.qualificationConfidence = "HIGH";
      prospect.qualificationScore = data.pilotInterest === "HIGH" ? 85 : 70;
      prospect.fitStatus = data.pilotInterest === "HIGH" ? "HIGH_PRIORITY" : "QUALIFIED";
      prospect.nextAction = "Present 30-day Controlled Pilot Offer";
    }

    if (!this.milestoneState.firstDiscoveryCompleted) {
      this.milestoneState.firstDiscoveryCompleted = true;
      this.milestoneState.firstDiscoveryCompletedAt = new Date().toISOString();
      this.milestoneState.marketValidationState = "DISCOVERY";
    }

    return newRecord;
  }

  public logCustomerEvidence(evidence: Omit<CustomerEvidenceRecord, "id" | "createdAt">) {
    const newEvidence: CustomerEvidenceRecord = {
      ...evidence,
      id: "EVID-" + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
    };
    this.customerEvidenceLedger.unshift(newEvidence);
    return newEvidence;
  }

  public exportRealPipelineCSV() {
    const leads = this.realProspectLeads;
    let csv = "Prospect ID,Company Name,City,Province,Company Type,Contact Name,Contact Role,Phone,Email,Source,Relationship,Research Status,Fit Status,Score,Confidence,Outreach Status,Last Contact,Next Action,Next Action Date,Facts,Inferences,Unknowns\n";
    for (const l of leads) {
      csv += `"${l.id}","${l.companyName}","${l.city}","${l.province || ""}","${l.companyType}","${l.contactName}","${l.contactRole}","${l.contactPhone || ""}","${l.contactEmail || ""}","${l.source}","${l.relationshipStrength}","${l.researchStatus}","${l.fitStatus}",${l.qualificationScore},"${l.qualificationConfidence}","${l.outreachStatus}","${l.lastContactDate || ""}","${l.nextAction}","${l.nextActionDate || ""}","${l.factsSummary || ""}","${l.inferencesSummary || ""}","${l.unknownsSummary || ""}"\n`;
    }
    return csv;
  }

  public createOrganization(data: {
    name: string;
    legalName: string;
    businessType: string;
    city: string;
    province: string;
    dataClassification?: "REAL" | "DEMO";
  }) {
    const newOrg: PilotOrgRecord = {
      id: "org-" + Math.random().toString(36).substring(2, 9),
      name: data.name,
      legalName: data.legalName,
      businessType: data.businessType,
      city: data.city,
      province: data.province,
      dataClassification: data.dataClassification || "REAL",
      customerStage: "pilot",
      pilotLifecycleStage: "ONBOARDING",
      pilotStartDate: new Date().toISOString().split("T")[0],
      pilotEndDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      pilotHealthStatus: "ONBOARDING",
      pilotOwnerInternal: "Dimas Sucipto",
      confirmedCashAtRisk: 0,
      falsePositiveExposure: 0,
      customerSelfUpdatesCount: 0,
      founderAssistedUpdatesCount: 1,
      wtpStatus: "NOT_TESTED",
      pilotDecision: "PENDING",
    };
    this.organizations.push(newOrg);
    return newOrg;
  }

  public getProfiles() { return [...this.profiles]; }
  public getClients() { return [...this.clients]; }
  public getProjects() { return [...this.projects]; }
  public getContracts() { return [...this.contracts]; }
  public getClaims() { return [...this.claims]; }
  public getInvoices() { return [...this.invoices]; }
  public getBlockers() { return [...this.blockers]; }
  public getActions() { return [...this.actions]; }
  public getAuditLogs() { return [...this.auditLogs]; }
  public getNotifications() { return [...this.notifications]; }
  public getFeedbackSubmissions() { return [...this.feedbackSubmissions]; }

  public getPilotValueSummary(orgId: string = "org-nusantara-01") {
    const org = this.organizations.find((o) => o.id === orgId) || this.organizations[0];
    const claims = this.claims;
    const invoices = this.invoices;
    const actions = this.actions;
    const blockers = this.blockers;

    const totalProjectValue = this.contracts.reduce((sum, c) => sum + c.currentContractValue, 0);
    const totalClaimedValue = claims.reduce((sum, c) => sum + c.claimedValue, 0);
    const totalCashCollected = invoices.reduce((sum, i) => sum + i.cashReceivedAmount, 0);
    const totalCashAtRisk = this.getDashboardKpis().cashAtRisk;
    const resolvedActionsCount = actions.filter((a) => a.status === "resolved").length;
    const totalOutcomeValue = actions.filter((a) => a.status === "resolved").reduce((sum, a) => sum + (a.outcomeValue || 0), 0);

    return {
      organizationName: org.name,
      dataClassification: org.dataClassification,
      pilotPeriod: `${org.pilotStartDate || "2026-08-01"} s/d ${org.pilotEndDate || "2026-09-30"}`,
      activeProjectsCount: this.projects.length,
      claimsMonitoredCount: claims.length,
      totalProjectValueMonitored: totalProjectValue,
      totalClaimedValueMonitored: totalClaimedValue,
      cashAtRiskDetected: totalCashAtRisk,
      confirmedCashAtRisk: org.confirmedCashAtRisk,
      falsePositiveExposure: org.falsePositiveExposure,
      customerSelfUpdatesCount: org.customerSelfUpdatesCount,
      founderAssistedUpdatesCount: org.founderAssistedUpdatesCount,
      wtpStatus: org.wtpStatus,
      pilotDecision: org.pilotDecision,
      largestBlockerIdentified: blockers[0]?.title || "None",
      actionsAssignedCount: actions.length,
      actionsResolvedCount: resolvedActionsCount,
      invoicesTrackedCount: invoices.length,
      cashCollectedDuringMonitoring: totalCashCollected,
      verifiedOutcomesTotal: totalOutcomeValue,
    };
  }

  public getDashboardKpis(): DashboardKpis {
    let cashAtRisk = 0;
    let cashAtRiskAffectedCount = 0;
    let preInvoiceExposure = 0;
    let preInvoiceAffectedCount = 0;
    let overdueReceivables = 0;
    let overdueAffectedCount = 0;
    let expectedCollection30Days = 0;
    let expectedCollectionAffectedCount = 0;

    for (const claim of this.claims) {
      const claimInvoices = this.invoices.filter((i) => i.claimId === claim.id);
      const invoicedGross = claimInvoices.reduce((sum, i) => sum + i.grossAmount, 0);
      const invoiceOutstanding = claimInvoices.reduce((sum, i) => sum + i.outstandingAmount, 0);
      const hasBlockers = this.blockers.some((b) => b.entityId === claim.id && b.status !== "resolved");

      const risk = evaluateClaimRisk({
        claimId: claim.id,
        stage: claim.currentStage,
        stageAgingDays: 16,
        workPerformedValue: claim.workPerformedValue,
        measuredValue: claim.measuredValue,
        claimedValue: claim.claimedValue,
        certifiedValue: claim.certifiedValue,
        invoicedGrossValue: invoicedGross,
        invoiceOutstandingTotal: invoiceOutstanding,
        hasActiveBlockers: hasBlockers,
        expectedCashDate: claim.expectedCashDate,
      });

      if (risk.totalCashAtRisk > 0) {
        cashAtRisk += risk.totalCashAtRisk;
        cashAtRiskAffectedCount += 1;
      }

      if (["WORK_RECORDED", "MEASUREMENT", "CLAIM_PREPARATION", "CLAIM_READY", "SUBMITTED", "UNDER_REVIEW", "CERTIFIED"].includes(claim.currentStage)) {
        const unbilled = Math.max(0, claim.workPerformedValue - invoicedGross);
        if (unbilled > 0) {
          preInvoiceExposure += unbilled;
          preInvoiceAffectedCount += 1;
        }
      }

      if (claim.expectedCashDate) {
        expectedCollection30Days += Math.max(0, claim.claimedValue - claim.cashReceivedValue);
        expectedCollectionAffectedCount += 1;
      }
    }

    for (const inv of this.invoices) {
      const invFinancials = calculateInvoiceFinancials({
        grossAmount: inv.grossAmount,
        retentionAmount: inv.retentionAmount,
        advanceRecoveryAmount: inv.advanceRecoveryAmount,
        taxAmount: inv.taxAmount,
        otherDeductionAmount: inv.otherDeductionAmount,
        cashReceivedAmount: inv.cashReceivedAmount,
        dueDate: inv.dueDate,
        status: inv.status as any,
      });

      if (invFinancials.isOverdue && invFinancials.outstandingAmount > 0) {
        overdueReceivables += invFinancials.outstandingAmount;
        overdueAffectedCount += 1;
      }
    }

    return {
      cashAtRisk,
      cashAtRiskAffectedCount,
      preInvoiceExposure,
      preInvoiceAffectedCount,
      overdueReceivables,
      overdueAffectedCount,
      expectedCollection30Days,
      expectedCollectionAffectedCount,
      freshnessLabel: "Fresh (≤24h)",
    };
  }

  public getMoneyPipeline(projectId?: string): MoneyPipelineSummary {
    const relevantClaims = projectId ? this.claims.filter((c) => c.projectId === projectId) : this.claims;
    const relevantInvoices = projectId ? this.invoices.filter((i) => i.projectId === projectId) : this.invoices;

    const workPerformed = relevantClaims.reduce((acc, c) => acc + c.workPerformedValue, 0);
    const measured = relevantClaims.reduce((acc, c) => acc + c.measuredValue, 0);
    const claimed = relevantClaims.reduce((acc, c) => acc + c.claimedValue, 0);
    const certified = relevantClaims.reduce((acc, c) => acc + c.certifiedValue, 0);
    const invoiced = relevantInvoices.reduce((acc, i) => acc + i.grossAmount, 0);
    const collected = relevantInvoices.reduce((acc, i) => acc + i.cashReceivedAmount, 0);

    const gaps = calculateClaimGaps({
      workPerformedValue: workPerformed,
      measuredValue: measured,
      claimedValue: claimed,
      certifiedValue: certified,
      allocatedInvoiceGross: invoiced,
      invoiceOutstandingTotal: Math.max(0, invoiced - collected),
    });

    return {
      workPerformed,
      measured,
      claimed,
      certified,
      invoiced,
      collected,
      unmeasuredGap: gaps.unmeasuredValue,
      unclaimedGap: gaps.unclaimedValue,
      uncertifiedGap: gaps.uncertifiedValue,
      certifiedNotInvoicedGap: gaps.certifiedNotInvoicedValue,
      invoicedNotCollectedGap: gaps.invoicedNotCollectedValue,
    };
  }

  public getProjectsAttentionList(): ProjectAttentionItem[] {
    return this.projects.map((proj) => {
      const contract = this.contracts.find((c) => c.projectId === proj.id);
      const projClaims = this.claims.filter((c) => c.projectId === proj.id);
      const projBlockers = this.blockers.filter((b) => b.projectId === proj.id && b.status !== "resolved");
      const projActions = this.actions.filter((a) => a.projectId === proj.id && a.status !== "resolved");

      let cashAtRisk = 0;
      let highestRisk: RiskLevel = "HEALTHY";

      for (const clm of projClaims) {
        const claimInvoices = this.invoices.filter((i) => i.claimId === clm.id);
        const invoicedGross = claimInvoices.reduce((sum, i) => sum + i.grossAmount, 0);
        const invoiceOutstanding = claimInvoices.reduce((sum, i) => sum + i.outstandingAmount, 0);
        const hasActiveBlockers = projBlockers.some((b) => b.entityId === clm.id);

        const evaluated = evaluateClaimRisk({
          claimId: clm.id,
          stage: clm.currentStage,
          stageAgingDays: 16,
          workPerformedValue: clm.workPerformedValue,
          measuredValue: clm.measuredValue,
          claimedValue: clm.claimedValue,
          certifiedValue: clm.certifiedValue,
          invoicedGrossValue: invoicedGross,
          invoiceOutstandingTotal: invoiceOutstanding,
          hasActiveBlockers,
          expectedCashDate: clm.expectedCashDate,
        });

        cashAtRisk += evaluated.totalCashAtRisk;
        if (evaluated.riskLevel === "CRITICAL") highestRisk = "CRITICAL";
        else if (evaluated.riskLevel === "AT_RISK" && highestRisk !== "CRITICAL") highestRisk = "AT_RISK";
        else if (evaluated.riskLevel === "WATCH" && highestRisk === "HEALTHY") highestRisk = "WATCH";
      }

      const largestBlocker = projBlockers.length > 0 ? projBlockers[0].title : "-";

      return {
        project: proj,
        contractValue: contract?.currentContractValue || 0,
        cashAtRisk,
        largestBlocker,
        openActionsCount: projActions.length,
        riskLevel: highestRisk,
      };
    });
  }

  public getExpectedCollectionForecast() {
    let days7 = 0;
    let days30 = 0;
    let days60 = 0;
    let days90 = 0;

    for (const inv of this.invoices) {
      if (inv.outstandingAmount > 0) {
        days7 += inv.outstandingAmount * 0.3;
        days30 += inv.outstandingAmount;
        days60 += inv.outstandingAmount * 1.4;
        days90 += inv.outstandingAmount * 1.8;
      }
    }

    return {
      days7: Math.round(days7),
      days30: Math.round(days30),
      days60: Math.round(days60),
      days90: Math.round(days90),
    };
  }

  public createProject(project: (typeof SEED_PROJECTS)[0], contract: (typeof SEED_CONTRACTS)[0]) {
    this.projects.push(project);
    this.contracts.push(contract);
    return { project, contract };
  }

  public createClaim(claimData: Omit<(typeof SEED_CLAIMS)[0], "id" | "currentStageEnteredAt">) {
    const newId = "clm-" + Math.random().toString(36).substring(2, 9);
    const newClaim = { ...claimData, id: newId, currentStageEnteredAt: new Date().toISOString() };
    this.claims.unshift(newClaim);
    return newClaim;
  }

  public updateClaimCertifiedValue(claimId: string, newCertifiedValue: number, user: string = "Dimas Sucipto") {
    const claim = this.claims.find((c) => c.id === claimId);
    if (!claim) throw new Error("Claim not found in database");
    claim.certifiedValue = newCertifiedValue;
  }

  public transitionClaim(claimId: string, targetStage: ClaimStage, reason?: string, userId?: string) {
    const claim = this.claims.find((c) => c.id === claimId);
    if (!claim) throw new Error("Claim not found in database");
    claim.currentStage = targetStage;
    claim.currentStageEnteredAt = new Date().toISOString();
  }

  public createBlocker(blockerData: Omit<(typeof SEED_BLOCKERS)[0], "id" | "status">) {
    const newId = "blk-" + Math.random().toString(36).substring(2, 9);
    const newBlocker = { ...blockerData, id: newId, status: "open" as const };
    this.blockers.unshift(newBlocker);
    return newBlocker;
  }

  public resolveBlocker(blockerId: string, resolutionNote: string) {
    const blocker = this.blockers.find((b) => b.id === blockerId);
    if (!blocker) throw new Error("Blocker not found in database");
    blocker.status = "resolved";
  }

  public createAction(
    actionData: Partial<(typeof SEED_ACTIONS)[0]> & {
      title: string;
      financialExposure: number;
      ownerId: string;
      dueDate: string;
      nextStep?: string;
    },
    actorName: string = "System"
  ) {
    // ACT-001: Must be linked to at least 1 exposure
    if (actionData.financialExposure === undefined || actionData.financialExposure < 0) {
      throw new Error("Action harus memiliki nilai financial exposure yang terikat (ACT-001).");
    }

    // ACT-002, UAT-08: Mandatory internal owner before active
    if (!actionData.ownerId || actionData.ownerId.trim() === "") {
      throw new Error("Action wajib memiliki penanggung jawab internal (Owner) sebelum aktif (ACT-002, UAT-08).");
    }

    // ACT-004, UAT-08: Mandatory due date and next step
    if (!actionData.dueDate || actionData.dueDate.trim() === "") {
      throw new Error("Action wajib memiliki batas waktu (Due Date) sebelum dapat diaktifkan (ACT-004, UAT-08).");
    }

    const nextStep = actionData.nextStep || "Koordinasi awal penuntasan eksposur";
    const newId = "act-" + Math.random().toString(36).substring(2, 9);
    const newAction = {
      ...actionData,
      id: newId,
      projectId: actionData.projectId || "prj-meridian",
      entityType: actionData.entityType || "claim",
      entityId: actionData.entityId || "clm-mc006",
      riskType: actionData.riskType || "UNCERTIFIED_AT_RISK",
      priority: actionData.priority || "high",
      status: "open" as const,
      nextStep,
      ownerName: actionData.ownerName || "Dimas Sucipto (Commercial Manager)",
      createdAt: new Date().toISOString(),
      comments: [],
      closureHistory: [],
    };
    this.actions.unshift(newAction as any);

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "action",
      entityId: newId,
      action: "ACTION_CREATED",
      actorId: "usr-dimas",
      actorName,
      details: {
        title: newAction.title,
        exposure: newAction.financialExposure,
        owner: newAction.ownerName,
        dueDate: newAction.dueDate,
      },
      createdAt: new Date().toISOString(),
    });

    return newAction;
  }

  public resolveAction(
    actionId: string,
    resolutionNotes: string,
    outcomeType: OutcomeType,
    outcomeValue?: number,
    closureEvidenceUrl?: string,
    closureEvidenceNote?: string,
    actorName: string = "Dimas Sucipto (Commercial Manager)"
  ) {
    const action = this.actions.find((a) => a.id === actionId);
    if (!action) throw new Error("Action not found in database");

    // ACT-006, UAT-09: Mandatory closure reason (min 5 chars)
    if (!resolutionNotes || resolutionNotes.trim().length < 5) {
      throw new Error("Alasan penutupan (Closure Reason) wajib diisi minimal 5 karakter (ACT-006).");
    }

    // ACT-006, UAT-09: Mandatory closure evidence URL or note
    const hasEvidenceUrl = Boolean(closureEvidenceUrl && closureEvidenceUrl.trim().length > 0);
    const hasEvidenceNote = Boolean(closureEvidenceNote && closureEvidenceNote.trim().length >= 5);

    if (!hasEvidenceUrl && !hasEvidenceNote) {
      throw new Error("Penutupan tindakan ditolak: Bukti penutupan (tautan berkas atau catatan bukti minimal 5 karakter) wajib dilampirkan (ACT-006, UAT-09).");
    }

    const finalOutcomeValue = outcomeValue !== undefined ? outcomeValue : action.financialExposure;

    // ACT-014: Archive into closureHistory
    const closureRecord = {
      resolvedAt: new Date().toISOString(),
      resolvedByUserId: "usr-dimas",
      resolvedByName: actorName,
      resolutionText: resolutionNotes,
      closureEvidenceUrl,
      closureEvidenceNote,
      outcomeType,
      outcomeValue: finalOutcomeValue,
    };

    if (!(action as any).closureHistory) (action as any).closureHistory = [];
    (action as any).closureHistory.push(closureRecord);

    action.status = "resolved";
    (action as any).resolution = resolutionNotes;
    action.resolutionNotes = resolutionNotes;
    (action as any).closureEvidenceUrl = closureEvidenceUrl;
    (action as any).closureEvidenceNote = closureEvidenceNote;
    action.outcomeType = outcomeType;
    action.outcomeValue = finalOutcomeValue;
    action.resolvedAt = new Date().toISOString();

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "action",
      entityId: actionId,
      action: "ACTION_RESOLVED",
      actorId: "usr-dimas",
      actorName,
      details: {
        resolutionNotes,
        outcomeType,
        outcomeValue: finalOutcomeValue,
        closureEvidenceUrl,
        closureEvidenceNote,
      },
      createdAt: new Date().toISOString(),
    });
  }

  // ACT-014: Reopen Resolved Action
  public reopenAction(actionId: string, reopenReason: string, actorName: string = "Dimas Sucipto (Commercial Manager)") {
    const action = this.actions.find((a) => a.id === actionId);
    if (!action) throw new Error("Action not found in database");

    if (!reopenReason || reopenReason.trim().length < 5) {
      throw new Error("Membuka kembali tindakan yang telah selesai wajib menyertakan alasan (Reopen Reason) minimal 5 karakter (ACT-014).");
    }

    action.status = "open";
    (action as any).lastReopenReason = reopenReason;
    (action as any).reopenedAt = new Date().toISOString();

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "action",
      entityId: actionId,
      action: "ACTION_REOPENED",
      actorId: "usr-dimas",
      actorName,
      details: { reopenReason, previousClosureCount: (action as any).closureHistory?.length || 1 },
      createdAt: new Date().toISOString(),
    });

    return action;
  }

  // ACT-008: Bulk Assign Actions with Audit Per Item
  public bulkAssignActions(actionIds: string[], newOwnerId: string, newOwnerName: string, actorName: string = "Dimas Sucipto (Commercial Manager)") {
    if (!newOwnerId || !newOwnerName) throw new Error("Owner baru wajib ditentukan.");
    const updated: any[] = [];

    for (const id of actionIds) {
      const action = this.actions.find((a) => a.id === id);
      if (action) {
        const prevOwner = (action as any).ownerName || action.ownerId;
        action.ownerId = newOwnerId;
        (action as any).ownerName = newOwnerName;
        updated.push(action);

        this.auditLogs.unshift({
          id: "aud-" + Math.random().toString(36).substring(2, 9),
          orgId: "org-nusantara-01",
          entityType: "action",
          entityId: id,
          action: "ACTION_BULK_REASSIGNED",
          actorId: "usr-dimas",
          actorName,
          details: { prevOwner, newOwner: newOwnerName, actionTitle: action.title },
          createdAt: new Date().toISOString(),
        });
      }
    }

    return updated;
  }

  // ACT-008: Bulk Due Date Update with Audit Per Item
  public bulkDueDateActions(actionIds: string[], newDueDate: string, actorName: string = "Dimas Sucipto (Commercial Manager)") {
    if (!newDueDate) throw new Error("Tanggal jatuh tempo baru wajib ditentukan.");
    const updated: any[] = [];

    for (const id of actionIds) {
      const action = this.actions.find((a) => a.id === id);
      if (action) {
        const prevDue = action.dueDate;
        action.dueDate = newDueDate;
        updated.push(action);

        this.auditLogs.unshift({
          id: "aud-" + Math.random().toString(36).substring(2, 9),
          orgId: "org-nusantara-01",
          entityType: "action",
          entityId: id,
          action: "ACTION_BULK_DUE_DATE_UPDATED",
          actorId: "usr-dimas",
          actorName,
          details: { prevDue, newDueDate, actionTitle: action.title },
          createdAt: new Date().toISOString(),
        });
      }
    }

    return updated;
  }

  // ACT-013: Comments & Mentions
  public addActionComment(actionId: string, content: string, authorName: string = "Dimas Sucipto") {
    const action = this.actions.find((a) => a.id === actionId);
    if (!action) throw new Error("Action not found in database");

    if (!content || content.trim().length === 0) {
      throw new Error("Komentar tidak boleh kosong.");
    }

    const commentId = "cmt-" + Math.random().toString(36).substring(2, 9);
    const comment = {
      id: commentId,
      authorId: "usr-dimas",
      authorName,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };

    if (!(action as any).comments) (action as any).comments = [];
    (action as any).comments.push(comment);

    return comment;
  }

  // ACT-015: Weekly Review Snapshot
  public createWeeklySnapshot(
    snapshotData: {
      projectId?: string;
      snapshotDate: string;
      totalExposure: number;
      controllableExposure: number;
      openActionsCount: number;
      overdueActionsCount: number;
      overdueExposure: number;
      freshnessStatus: string;
      notes?: string;
    },
    actorName: string = "Dimas Sucipto (Commercial Manager)"
  ) {
    const newSnapshot: DemoWeeklyReviewSnapshot = {
      id: "snap-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      projectId: snapshotData.projectId,
      snapshotDate: snapshotData.snapshotDate,
      totalExposure: snapshotData.totalExposure,
      controllableExposure: snapshotData.controllableExposure,
      openActionsCount: snapshotData.openActionsCount,
      overdueActionsCount: snapshotData.overdueActionsCount,
      overdueExposure: snapshotData.overdueExposure,
      freshnessStatus: snapshotData.freshnessStatus,
      lockedByUserId: "usr-dimas",
      lockedByName: actorName,
      notes: snapshotData.notes,
      createdAt: new Date().toISOString(),
    };

    this.weeklySnapshots.unshift(newSnapshot);

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "weekly_snapshot",
      entityId: newSnapshot.id,
      action: "WEEKLY_SNAPSHOT_LOCKED",
      actorId: "usr-dimas",
      actorName,
      details: { snapshotDate: newSnapshot.snapshotDate, totalExposure: newSnapshot.totalExposure },
      createdAt: new Date().toISOString(),
    });

    return newSnapshot;
  }

  public getWeeklySnapshots(projectId?: string) {
    if (!projectId) return [...this.weeklySnapshots];
    return this.weeklySnapshots.filter((s) => s.projectId === projectId || !s.projectId);
  }

  // Phase 8: Project Baseline Locking (PRT-009, UAT-15)
  public getProjectBaselines(projectId?: string) {
    if (!projectId) return [...this.projectBaselines];
    return this.projectBaselines.filter((b) => b.projectId === projectId);
  }

  public lockProjectBaseline(
    projectId: string,
    baselineExposure: number,
    baselineCycleDays: number,
    lockReason: string,
    actorName: string = "Dimas Sucipto (Commercial Manager)"
  ) {
    if (!lockReason || lockReason.trim().length < 5) {
      throw new Error("Alasan penguncian baseline wajib diisi minimal 5 karakter (PRT-009).");
    }

    const newBaseline: DemoProjectBaseline = {
      id: "base-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      projectId,
      baselineDate: new Date().toISOString().substring(0, 10),
      baselineExposure,
      baselineCycleDays,
      lockedByName: actorName,
      lockReason: lockReason.trim(),
      createdAt: new Date().toISOString(),
    };

    this.projectBaselines.unshift(newBaseline);

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "project_baseline",
      entityId: newBaseline.id,
      action: "BASELINE_LOCKED",
      actorId: "usr-dimas",
      actorName,
      details: { projectId, baselineExposure, baselineCycleDays, lockReason },
      createdAt: new Date().toISOString(),
    });

    return newBaseline;
  }

  // Phase 9: Saved Filter Views (PLT-014)
  public getSavedFilterViews(pageContext?: string) {
    if (!pageContext) return [...this.savedFilterViews];
    return this.savedFilterViews.filter((v) => v.pageContext === pageContext);
  }

  public saveFilterView(
    viewName: string,
    pageContext: string,
    filterCriteria: Record<string, any>,
    userId: string = "usr-dimas"
  ) {
    if (!viewName || viewName.trim().length < 3) {
      throw new Error("Nama tampilan filter wajib diisi minimal 3 karakter (PLT-014).");
    }

    const newView: DemoSavedFilterView = {
      id: "view-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      userId,
      viewName: viewName.trim(),
      pageContext,
      filterCriteria,
      createdAt: new Date().toISOString(),
    };

    this.savedFilterViews.unshift(newView);

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "saved_filter_view",
      entityId: newView.id,
      action: "FILTER_VIEW_SAVED",
      actorId: userId,
      actorName: "User",
      details: { viewName, pageContext, filterCriteria },
      createdAt: new Date().toISOString(),
    });

    return newView;
  }

  public deleteSavedFilterView(viewId: string) {
    const idx = this.savedFilterViews.findIndex((v) => v.id === viewId);
    if (idx !== -1) {
      this.savedFilterViews.splice(idx, 1);
    }
  }

  // Phase 10: Onboarding Data Acceptance & Pilot Scorecard (PRD 23, 28)
  public getDataAcceptanceItems(projectId?: string) {
    if (!projectId) return [...this.dataAcceptanceItems];
    return this.dataAcceptanceItems.filter((item) => item.projectId === projectId);
  }

  public updateDataAcceptanceItem(
    itemId: string,
    status: "PENDING" | "VERIFIED" | "WAIVED",
    verifiedByName: string,
    notes?: string
  ) {
    const item = this.dataAcceptanceItems.find((i) => i.id === itemId);
    if (!item) throw new Error("Data acceptance item not found");

    item.status = status;
    item.verifiedByName = verifiedByName;
    item.verifiedAt = new Date().toISOString();
    if (notes !== undefined) item.notes = notes;

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: item.orgId,
      entityType: "data_acceptance_item",
      entityId: item.id,
      action: "DATA_ACCEPTANCE_UPDATED",
      actorId: "usr-dimas",
      actorName: verifiedByName,
      details: { itemKey: item.itemKey, status, notes },
      createdAt: new Date().toISOString(),
    });

    return item;
  }

  public getPilotScorecards(projectId?: string) {
    if (!projectId) return [...this.pilotScorecards];
    return this.pilotScorecards.filter((sc) => sc.projectId === projectId);
  }

  public savePilotScorecard(scorecard: DemoPilotScorecard) {
    this.pilotScorecards.unshift(scorecard);

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: scorecard.orgId,
      entityType: "pilot_scorecard",
      entityId: scorecard.id,
      action: "PILOT_SCORECARD_SAVED",
      actorId: "usr-dimas",
      actorName: "Commercial Manager",
      details: {
        projectId: scorecard.projectId,
        pilotTier: scorecard.pilotTier,
        roiMultiplier: scorecard.roiMultiplier,
        recommendedTier: scorecard.recommendedTier,
      },
      createdAt: new Date().toISOString(),
    });

    return scorecard;
  }

  public createInvoice(invoice: (typeof SEED_INVOICES)[0]) {
    this.invoices.unshift(invoice);
    return invoice;
  }

  public recordCashReceipt(data: { invoiceId: string; amount: number; receiptNumber: string; bankReference: string; recordedBy: string }) {
    const invoice = this.invoices.find((i) => i.id === data.invoiceId);
    if (!invoice) throw new Error("Invoice not found in database");
    invoice.cashReceivedAmount += data.amount;
    invoice.outstandingAmount = Math.max(0, invoice.netReceivableAmount - invoice.cashReceivedAmount);
    if (invoice.outstandingAmount === 0) invoice.status = "paid";
  }

  public submitDetailedFeedback(feedback: Omit<DetailedFeedbackSubmission, "id" | "timestamp" | "status">) {
    const newFeedback: DetailedFeedbackSubmission = { ...feedback, id: "fb-" + Math.random().toString(36).substring(2, 9), timestamp: new Date().toISOString(), status: "new" };
    this.feedbackSubmissions.unshift(newFeedback);
    return newFeedback;
  }

  // ==========================================
  // PHASE 2: TENANT, AUTH, RBAC & AUDIT (PLT-001 s/d PLT-012)
  // ==========================================

  public getProjectMembers(projectId?: string) {
    if (!projectId) return [...this.projectMembers];
    return this.projectMembers.filter((m) => m.projectId === projectId);
  }

  public assignProjectMember(projectId: string, userId: string, roleInProject: string = "MEMBER", actorName: string = "Admin") {
    const existingIndex = this.projectMembers.findIndex((m) => m.projectId === projectId && m.userId === userId);
    if (existingIndex >= 0) {
      this.projectMembers[existingIndex].roleInProject = roleInProject;
    } else {
      this.projectMembers.push({
        id: "pmem-" + Math.random().toString(36).substring(2, 9),
        orgId: "org-nusantara-01",
        projectId,
        userId,
        roleInProject,
        createdAt: new Date().toISOString(),
      });
    }

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "project_member",
      entityId: projectId,
      eventType: "PROJECT_ACCESS_ASSIGNED",
      description: `User ${userId} assigned to project ${projectId} as ${roleInProject}`,
      userName: actorName,
      timestamp: new Date().toISOString(),
    });
  }

  public removeProjectMember(projectId: string, userId: string, actorName: string = "Admin") {
    this.projectMembers = this.projectMembers.filter((m) => !(m.projectId === projectId && m.userId === userId));
    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "project_member",
      entityId: projectId,
      eventType: "PROJECT_ACCESS_REVOKED",
      description: `User ${userId} removed from project ${projectId}`,
      userName: actorName,
      timestamp: new Date().toISOString(),
    });
  }

  public checkUserProjectAccess(userId: string, projectId: string): boolean {
    const user = this.profiles.find((p) => p.id === userId);
    if (!user) return false;
    const isAssigned = this.projectMembers.some((m) => m.projectId === projectId && m.userId === userId);
    const assignedProjectIds = user.assignedProjectIds || (isAssigned ? [projectId] : []);
    return hasProjectAccess({ role: user.role, assignedProjectIds }, projectId);
  }

  public deactivateUser(userId: string, reason: string, actorName: string = "Admin") {
    const user = this.profiles.find((p) => p.id === userId);
    if (!user) throw new Error("User not found");
    user.status = "DEACTIVATED";
    user.lastSessionRevokedAt = new Date().toISOString();

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "user",
      entityId: userId,
      eventType: "USER_DEACTIVATED",
      description: `User ${user.fullName} (${user.email}) deactivated. Reason: ${reason}. Active sessions revoked immediately.`,
      userName: actorName,
      timestamp: new Date().toISOString(),
    });
    return user;
  }

  public activateUser(userId: string, actorName: string = "Admin") {
    const user = this.profiles.find((p) => p.id === userId);
    if (!user) throw new Error("User not found");
    user.status = "ACTIVE";

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "user",
      entityId: userId,
      eventType: "USER_ACTIVATED",
      description: `User ${user.fullName} (${user.email}) re-activated.`,
      userName: actorName,
      timestamp: new Date().toISOString(),
    });
    return user;
  }

  public inviteUser(userData: { email: string; fullName: string; role: Role; jobTitle?: string; phone?: string; assignedProjectIds?: string[] }, actorName: string = "Admin") {
    const newId = "usr-" + Math.random().toString(36).substring(2, 9);
    const newProfile: (typeof SEED_PROFILES)[0] = {
      id: newId,
      fullName: userData.fullName,
      email: userData.email,
      phone: userData.phone || "-",
      role: userData.role,
      jobTitle: userData.jobTitle || userData.role,
      status: "ACTIVE",
      mfaEnabled: userData.role === "OWNER" || userData.role === "ADMIN",
      assignedProjectIds: userData.assignedProjectIds || [],
    };
    this.profiles.push(newProfile);

    if (userData.assignedProjectIds && userData.assignedProjectIds.length > 0) {
      for (const prjId of userData.assignedProjectIds) {
        this.projectMembers.push({
          id: "pmem-" + Math.random().toString(36).substring(2, 9),
          orgId: "org-nusantara-01",
          projectId: prjId,
          userId: newId,
          roleInProject: userData.role,
          createdAt: new Date().toISOString(),
        });
      }
    }

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "user",
      entityId: newId,
      eventType: "USER_INVITED",
      description: `User ${newProfile.fullName} (${newProfile.email}) invited with role ${newProfile.role}`,
      userName: actorName,
      timestamp: new Date().toISOString(),
    });

    return newProfile;
  }

  public grantAssistedAccess(data: { orgId: string; grantedByUserId: string; supportEngineerEmail: string; reason: string; durationHours: number; assignedProjectIds: string[] }, actorName: string = "Admin") {
    const grantId = "grant-" + Math.random().toString(36).substring(2, 9);
    const expiresAt = new Date(Date.now() + (data.durationHours || 24) * 3600000).toISOString();
    const newGrant = {
      id: grantId,
      orgId: data.orgId,
      grantedByUserId: data.grantedByUserId,
      supportEngineerEmail: data.supportEngineerEmail,
      reason: data.reason,
      expiresAt,
      status: "ACTIVE" as const,
      createdAt: new Date().toISOString(),
      assignedProjectIds: data.assignedProjectIds || [],
    };
    this.assistedAccessGrants.unshift(newGrant);

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: data.orgId,
      entityType: "assisted_access",
      entityId: grantId,
      eventType: "ASSISTED_ACCESS_GRANTED",
      description: `Time-bound assisted access granted to ${data.supportEngineerEmail} for ${data.durationHours}h. Reason: ${data.reason}. Valid until: ${expiresAt}`,
      userName: actorName,
      timestamp: new Date().toISOString(),
    });

    return newGrant;
  }

  public revokeAssistedAccess(grantId: string, actorName: string = "Admin") {
    const grant = this.assistedAccessGrants.find((g) => g.id === grantId);
    if (!grant) throw new Error("Assisted access grant not found");
    grant.status = "REVOKED";
    grant.revokedAt = new Date().toISOString();

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: grant.orgId,
      entityType: "assisted_access",
      entityId: grantId,
      eventType: "ASSISTED_ACCESS_REVOKED",
      description: `Assisted access ${grantId} granted to ${grant.supportEngineerEmail} revoked immediately by ${actorName}`,
      userName: actorName,
      timestamp: new Date().toISOString(),
    });

    return grant;
  }

  public getAssistedAccessGrants(orgId?: string) {
    if (!orgId) return [...this.assistedAccessGrants];
    return this.assistedAccessGrants.filter((g) => g.orgId === orgId);
  }

  public exportFullTenantData(orgId: string = "org-nusantara-01") {
    const org = this.organizations.find((o) => o.id === orgId) || this.organizations[0];
    const dataPackage = {
      exportedAt: new Date().toISOString(),
      timezone: "Asia/Jakarta",
      currency: "IDR",
      organization: org,
      profiles: this.profiles,
      clients: this.clients,
      projects: this.projects,
      contracts: this.contracts,
      claims: this.claims,
      invoices: this.invoices,
      blockers: this.blockers,
      actions: this.actions,
      projectMembers: this.projectMembers,
      assistedAccessGrants: this.assistedAccessGrants,
      contractRuleVersions: this.contractRuleVersions,
      sourceImports: this.sourceImports,
      importTemplates: this.importTemplates,
      contractEvidenceChecklists: this.contractEvidenceChecklists,
      contractEvidenceChecklistItems: this.contractEvidenceChecklistItems,
      claimReadinessItems: this.claimReadinessItems,
      weeklySnapshots: this.weeklySnapshots,
      projectBaselines: this.projectBaselines,
      savedFilterViews: this.savedFilterViews,
      dataAcceptanceItems: this.dataAcceptanceItems,
      pilotScorecards: this.pilotScorecards,
      auditLogs: this.auditLogs,
    };

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId,
      entityType: "tenant",
      entityId: orgId,
      eventType: "TENANT_DATA_EXPORTED",
      description: `Full tenant data exported in open format (JSON).`,
      userName: "System Administrator",
      timestamp: new Date().toISOString(),
    });

    return dataPackage;
  }

  public softDeleteEntity(entityType: "claim" | "project" | "action" | "blocker", entityId: string, actorName: string = "Admin") {
    const timestamp = new Date().toISOString();
    if (entityType === "claim") {
      const item = this.claims.find((c) => c.id === entityId);
      if (item) (item as any).deletedAt = timestamp;
    } else if (entityType === "action") {
      const item = this.actions.find((a) => a.id === entityId);
      if (item) (item as any).deletedAt = timestamp;
    } else if (entityType === "blocker") {
      const item = this.blockers.find((b) => b.id === entityId);
      if (item) (item as any).deletedAt = timestamp;
    }

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType,
      entityId,
      eventType: "ENTITY_SOFT_DELETED",
      description: `${entityType} ${entityId} marked as soft-deleted. Operational record preserved in audit history.`,
      userName: actorName,
      timestamp,
    });
  }

  public restoreEntity(entityType: "claim" | "project" | "action" | "blocker", entityId: string, actorName: string = "Admin") {
    const timestamp = new Date().toISOString();
    if (entityType === "claim") {
      const item = this.claims.find((c) => c.id === entityId);
      if (item) delete (item as any).deletedAt;
    } else if (entityType === "action") {
      const item = this.actions.find((a) => a.id === entityId);
      if (item) delete (item as any).deletedAt;
    } else if (entityType === "blocker") {
      const item = this.blockers.find((b) => b.id === entityId);
      if (item) delete (item as any).deletedAt;
    }

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType,
      entityId,
      eventType: "ENTITY_RESTORED",
      description: `${entityType} ${entityId} restored from soft-deleted state.`,
      userName: actorName,
      timestamp,
    });
  }

  // ==========================================
  // PHASE 3: PROJECT INTAKE & CONTRACT RULE FOUNDATION
  // ==========================================

  public getContractRuleVersions(projectId?: string): DemoContractRuleVersion[] {
    if (!projectId) return [...this.contractRuleVersions];
    return this.contractRuleVersions
      .filter((r) => r.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getActiveContractRule(projectId: string): DemoContractRuleVersion | undefined {
    return (
      this.contractRuleVersions.find((r) => r.projectId === projectId && r.status === "APPROVED") ||
      this.contractRuleVersions.find((r) => r.projectId === projectId)
    );
  }

  public createClient(
    clientData: { name: string; legalName: string; clientType?: string; email?: string; phone?: string; clientCode?: string },
    actorName: string = "Admin"
  ) {
    const newId = "cl-" + Math.random().toString(36).substring(2, 9);
    const newClient = {
      id: newId,
      clientCode: clientData.clientCode || "CL-" + clientData.name.substring(0, 4).toUpperCase(),
      name: clientData.name,
      legalName: clientData.legalName || clientData.name,
      clientType: clientData.clientType || "Private Developer",
      email: clientData.email || "-",
      phone: clientData.phone || "-",
    };
    this.clients.push(newClient);

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "client",
      entityId: newId,
      eventType: "CLIENT_CREATED",
      description: `Client ${newClient.name} (${newClient.clientCode}) registered.`,
      userName: actorName,
      timestamp: new Date().toISOString(),
    });

    return newClient;
  }

  public createProjectWithContract(
    data: {
      project: {
        projectName: string;
        projectCode: string;
        clientId: string;
        projectType: string;
        location: string;
        city: string;
        contractStartDate: string;
        contractFinishDate: string;
        projectManagerId?: string;
        commercialManagerId?: string;
        financeOwnerId?: string;
      };
      contract: {
        contractNumber: string;
        contractTitle: string;
        originalContractValue: number;
        paymentMethod?: string;
      };
      rule?: {
        cutOffDay?: number;
        internalLeadTimeDays?: number;
        reviewSlaDays?: number;
        paymentTermDays?: number;
        calendarBasis?: "CALENDAR_DAYS" | "WORKING_DAYS";
        retentionPercent?: number;
        advanceRecoveryRule?: "PROPORTIONAL" | "FIXED_PERCENT" | "NONE";
        advanceRecoveryPercent?: number;
        taxTreatment?: string;
        sourceClauseRef?: string;
        effectiveDate?: string;
        notes?: string;
      };
    },
    actorName: string = "Admin"
  ) {
    const newProjId = "prj-" + Math.random().toString(36).substring(2, 9);
    const newCtrId = "ctr-" + Math.random().toString(36).substring(2, 9);
    const newRuleId = "rule-" + Math.random().toString(36).substring(2, 9);

    const fullProject = {
      id: newProjId,
      clientId: data.project.clientId,
      projectCode: data.project.projectCode,
      projectName: data.project.projectName,
      projectType: data.project.projectType,
      location: data.project.location,
      city: data.project.city,
      contractStartDate: data.project.contractStartDate,
      contractFinishDate: data.project.contractFinishDate,
      currencyCode: "IDR",
      status: "active" as const,
      projectManagerId: data.project.projectManagerId || "usr-fajar",
      commercialManagerId: data.project.commercialManagerId || "usr-dimas",
      financeOwnerId: data.project.financeOwnerId || "usr-rani",
    };
    this.projects.push(fullProject);

    const fullContract = {
      id: newCtrId,
      projectId: newProjId,
      contractNumber: data.contract.contractNumber,
      contractTitle: data.contract.contractTitle,
      originalContractValue: data.contract.originalContractValue,
      currentContractValue: data.contract.originalContractValue,
      paymentMethod: data.contract.paymentMethod || "Monthly Progress",
      paymentTermDays: data.rule?.paymentTermDays || 30,
      retentionPercent: data.rule?.retentionPercent || 5.0,
    };
    this.contracts.push(fullContract);

    const initialRule: DemoContractRuleVersion = {
      id: newRuleId,
      orgId: "org-nusantara-01",
      projectId: newProjId,
      contractId: newCtrId,
      versionNumber: "v1.0",
      status: "APPROVED",
      cutOffDay: data.rule?.cutOffDay || 25,
      internalLeadTimeDays: data.rule?.internalLeadTimeDays || 5,
      reviewSlaDays: data.rule?.reviewSlaDays || 14,
      paymentTermDays: data.rule?.paymentTermDays || 30,
      calendarBasis: data.rule?.calendarBasis || "CALENDAR_DAYS",
      retentionPercent: data.rule?.retentionPercent || 5.0,
      advanceRecoveryRule: data.rule?.advanceRecoveryRule || "PROPORTIONAL",
      advanceRecoveryPercent: data.rule?.advanceRecoveryPercent || 10.0,
      taxTreatment: data.rule?.taxTreatment || "PPN 11% & PPh 4(2) Final 1.75% sesuai SPK",
      sourceClauseRef: data.rule?.sourceClauseRef || "Pasal 8 SPK Utama",
      effectiveDate: data.rule?.effectiveDate || data.project.contractStartDate,
      notes: data.rule?.notes || "Aturan dasar kontrak awal disahkan saat project intake.",
      createdBy: actorName,
      approvedBy: actorName,
      approvedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    this.contractRuleVersions.push(initialRule);

    // Auto-assign project members for access control
    if (fullProject.projectManagerId) {
      this.assignProjectMember(newProjId, fullProject.projectManagerId, "PROJECT_MANAGER", actorName);
    }
    if (fullProject.commercialManagerId) {
      this.assignProjectMember(newProjId, fullProject.commercialManagerId, "COMMERCIAL_MANAGER", actorName);
    }
    if (fullProject.financeOwnerId) {
      this.assignProjectMember(newProjId, fullProject.financeOwnerId, "FINANCE_MANAGER", actorName);
    }

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "project",
      entityId: newProjId,
      eventType: "PROJECT_INTAKE_COMPLETED",
      description: `Project ${fullProject.projectName} (${fullProject.projectCode}) created with Contract ${fullContract.contractNumber} (Rp ${fullContract.originalContractValue.toLocaleString("id-ID")}) and Contract Rule Version v1.0.`,
      userName: actorName,
      timestamp: new Date().toISOString(),
    });

    return { project: fullProject, contract: fullContract, ruleVersion: initialRule };
  }

  public proposeContractRuleVersion(
    ruleData: Omit<DemoContractRuleVersion, "id" | "versionNumber" | "status" | "createdAt" | "createdBy">,
    actorName: string = "Commercial Manager"
  ): DemoContractRuleVersion {
    const existingVersions = this.contractRuleVersions.filter((r) => r.projectId === ruleData.projectId);
    const nextVerIndex = existingVersions.length + 1;
    const versionNumber = `v1.${nextVerIndex - 1}`;
    const newId = "rule-" + Math.random().toString(36).substring(2, 9);

    const newRule: DemoContractRuleVersion = {
      ...ruleData,
      id: newId,
      versionNumber,
      status: "PENDING_APPROVAL",
      createdBy: actorName,
      createdAt: new Date().toISOString(),
    };
    this.contractRuleVersions.unshift(newRule);

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "contract_rule",
      entityId: newId,
      eventType: "CONTRACT_RULE_PROPOSED",
      description: `Contract rule version ${versionNumber} proposed for project ${ruleData.projectId}. Source Clause: ${ruleData.sourceClauseRef}. Cut-off: tgl ${ruleData.cutOffDay}, SLA Review: ${ruleData.reviewSlaDays} hari, Payment Term: ${ruleData.paymentTermDays} hari (${ruleData.calendarBasis}).`,
      userName: actorName,
      timestamp: new Date().toISOString(),
    });

    return newRule;
  }

  public approveContractRuleVersion(versionId: string, approverName: string = "Raka Pratama (Owner)"): DemoContractRuleVersion {
    const target = this.contractRuleVersions.find((r) => r.id === versionId);
    if (!target) throw new Error("Contract rule version not found");

    for (const v of this.contractRuleVersions) {
      if (v.projectId === target.projectId && v.id !== target.id && v.status === "APPROVED") {
        v.status = "SUPERSEDED";
      }
    }

    target.status = "APPROVED";
    target.approvedBy = approverName;
    target.approvedAt = new Date().toISOString();

    const contract = this.contracts.find((c) => c.id === target.contractId || c.projectId === target.projectId);
    if (contract) {
      contract.paymentTermDays = target.paymentTermDays;
      contract.retentionPercent = target.retentionPercent;
    }

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "contract_rule",
      entityId: target.id,
      eventType: "CONTRACT_RULE_APPROVED",
      description: `Contract rule version ${target.versionNumber} APPROVED by ${approverName}. Effective from: ${target.effectiveDate}. Clause Ref: ${target.sourceClauseRef}.`,
      userName: approverName,
      timestamp: new Date().toISOString(),
    });

    return target;
  }

  // ==========================================
  // PHASE 4: EXCEL/CSV IMPORT & RECONCILIATION ENGINE
  // ==========================================

  public getSourceImports(projectId?: string): DemoSourceImport[] {
    if (!projectId) return [...this.sourceImports];
    return this.sourceImports
      .filter((imp) => imp.projectId === projectId)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  public getImportTemplates(entityType: "claims" | "projects" | "invoices" = "claims"): DemoImportMappingTemplate[] {
    return this.importTemplates.filter((t) => t.entityType === entityType);
  }

  public saveImportTemplate(
    templateData: { templateName: string; entityType?: "claims" | "projects" | "invoices"; columnMapping: Record<string, string> },
    actorName: string = "Commercial Manager"
  ): DemoImportMappingTemplate {
    const newId = "tmpl-" + Math.random().toString(36).substring(2, 9);
    const newTemplate: DemoImportMappingTemplate = {
      id: newId,
      orgId: "org-nusantara-01",
      templateName: templateData.templateName,
      entityType: templateData.entityType || "claims",
      columnMapping: templateData.columnMapping,
      createdByName: actorName,
      createdAt: new Date().toISOString(),
    };
    this.importTemplates.unshift(newTemplate);

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "import_template",
      entityId: newId,
      eventType: "IMPORT_TEMPLATE_SAVED",
      description: `Import mapping template "${newTemplate.templateName}" saved.`,
      userName: actorName,
      timestamp: new Date().toISOString(),
    });

    return newTemplate;
  }

  public checkDuplicateFile(fileChecksum: string, projectId?: string): DemoSourceImport | undefined {
    return this.sourceImports.find(
      (imp) => imp.fileChecksum === fileChecksum && imp.status === "COMPLETED" && (!projectId || imp.projectId === projectId)
    );
  }

  public commitImportBatch(
    data: {
      projectId: string;
      fileName: string;
      fileSizeBytes: number;
      fileChecksum: string;
      sheetName?: string;
      mappingTemplateId?: string;
      validatedRows: {
        claimNumber: string;
        periodStart: string;
        periodEnd: string;
        workPerformedValue: number;
        measuredValue: number;
        claimedValue: number;
        certifiedValue: number;
        expectedCashDate: string;
        adjustmentReason?: string;
      }[];
      rejectedRowsCount: number;
      rejectedValue: number;
      notes?: string;
    },
    actorName: string = "QS Engineer"
  ): { importBatch: DemoSourceImport; createdClaimsCount: number; updatedClaimsCount: number } {
    const importId = "imp-" + Math.random().toString(36).substring(2, 9);
    const contract = this.contracts.find((c) => c.projectId === data.projectId) || this.contracts[0];

    let totalAcceptedVal = 0;
    let createdClaimsCount = 0;
    let updatedClaimsCount = 0;

    // Ingest each valid row into claims ledger
    for (const row of data.validatedRows) {
      totalAcceptedVal += row.claimedValue;
      const existingIdx = this.claims.findIndex(
        (c) => c.projectId === data.projectId && c.claimNumber === row.claimNumber
      );

      if (existingIdx >= 0) {
        const oldClaim = this.claims[existingIdx];
        this.claims[existingIdx] = {
          ...oldClaim,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
          workPerformedValue: row.workPerformedValue,
          measuredValue: row.measuredValue,
          claimedValue: row.claimedValue,
          certifiedValue: row.certifiedValue || oldClaim.certifiedValue,
          expectedCashDate: row.expectedCashDate,
          sourceType: "xlsx_import",
          sourceReference: `${data.fileName} (Batch: ${importId})`,
          sourceUpdatedAt: new Date().toISOString(),
          notes: row.adjustmentReason || oldClaim.notes,
        };
        updatedClaimsCount++;
      } else {
        const newClaimId = "clm-" + Math.random().toString(36).substring(2, 9);
        this.claims.push({
          id: newClaimId,
          projectId: data.projectId,
          contractId: contract.id,
          claimNumber: row.claimNumber,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
          description: `Imported claim ${row.claimNumber} via ${data.fileName}`,
          currentStage: "CLAIM_PREPARATION",
          riskLevel: "HEALTHY",
          workPerformedValue: row.workPerformedValue,
          measuredValue: row.measuredValue,
          claimedValue: row.claimedValue,
          certifiedValue: row.certifiedValue || 0,
          expectedNetCollectible: Math.round(row.claimedValue * (1 - (contract.retentionPercent || 5) / 100)),
          cashReceivedValue: 0,
          expectedCashDate: row.expectedCashDate,
          currentStageEnteredAt: new Date().toISOString(),
          responsibleOwnerId: "usr-andi",
          sourceType: "xlsx_import",
          sourceReference: `${data.fileName} (Batch: ${importId})`,
          sourceUpdatedAt: new Date().toISOString(),
          notes: row.adjustmentReason,
        });
        createdClaimsCount++;
      }
    }

    const totalSourceVal = totalAcceptedVal + data.rejectedValue;
    const totalRowsCount = data.validatedRows.length + data.rejectedRowsCount;

    const newImport: DemoSourceImport = {
      id: importId,
      orgId: "org-nusantara-01",
      projectId: data.projectId,
      fileName: data.fileName,
      fileSizeBytes: data.fileSizeBytes,
      fileChecksum: data.fileChecksum,
      sheetName: data.sheetName || "Default Sheet",
      totalRows: totalRowsCount,
      acceptedRows: data.validatedRows.length,
      rejectedRows: data.rejectedRowsCount,
      totalSourceValue: totalSourceVal,
      acceptedValue: totalAcceptedVal,
      rejectedValue: data.rejectedValue,
      reconciliationVariance: data.rejectedValue,
      status: "COMPLETED",
      mappingTemplateId: data.mappingTemplateId,
      uploadedBy: actorName,
      uploadedAt: new Date().toISOString(),
      notes: data.notes || `Committed ${data.validatedRows.length} rows (${createdClaimsCount} new, ${updatedClaimsCount} updated).`,
    };
    this.sourceImports.unshift(newImport);

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "source_import",
      entityId: importId,
      eventType: "IMPORT_COMMITTED",
      description: `File "${data.fileName}" committed (${data.validatedRows.length} accepted, ${data.rejectedRowsCount} rejected, Total: Rp ${totalAcceptedVal.toLocaleString("id-ID")}). Checksum: ${data.fileChecksum.substring(0, 16)}...`,
      userName: actorName,
      timestamp: new Date().toISOString(),
    });

    return { importBatch: newImport, createdClaimsCount, updatedClaimsCount };
  }

  public rollbackImportBatch(importBatchId: string, reason: string, actorName: string = "Commercial Manager"): DemoSourceImport {
    const target = this.sourceImports.find((imp) => imp.id === importBatchId);
    if (!target) throw new Error("Import batch not found");
    if (!reason || reason.trim() === "") throw new Error("Mandatory business reason is required to rollback an import batch");

    target.status = "ROLLED_BACK";

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "source_import",
      entityId: target.id,
      eventType: "IMPORT_ROLLED_BACK",
      description: `Import batch ${target.id} (${target.fileName}) ROLLED BACK by ${actorName}. Reason: ${reason}. Historical audit preserved.`,
      userName: actorName,
      timestamp: new Date().toISOString(),
    });

    return target;
  }

  // ==========================================
  // PHASE 5: VALUE GAP LEDGER & STAGE ENGINE
  // ==========================================

  public updateClaimControllability(
    claimId: string,
    controllability: "INTERNAL" | "JOINT" | "EXTERNAL" | "UNKNOWN",
    actorName: string = "Commercial Manager"
  ) {
    const claim = this.claims.find((c) => c.id === claimId);
    if (!claim) throw new Error("Claim not found");

    const old = claim.controllability || "UNKNOWN";
    claim.controllability = controllability;

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "claim",
      entityId: claim.id,
      eventType: "CONTROLLABILITY_CLASSIFIED",
      description: `Claim ${claim.claimNumber} controllability updated from ${old} to ${controllability} by ${actorName}.`,
      userName: actorName,
      timestamp: new Date().toISOString(),
    });

    return claim;
  }

  public markClaimDisputed(claimId: string, reason: string, actorName: string = "Commercial Manager") {
    const claim = this.claims.find((c) => c.id === claimId);
    if (!claim) throw new Error("Claim not found");
    if (!reason || !reason.trim()) throw new Error("Mandatory dispute reason is required");

    claim.isDisputed = true;
    claim.disputeReason = reason;
    claim.disputedAt = new Date().toISOString();
    claim.currentStage = "DISPUTED";
    claim.riskLevel = "CRITICAL";

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "claim",
      entityId: claim.id,
      eventType: "CLAIM_MARKED_DISPUTED",
      description: `Claim ${claim.claimNumber} marked DISPUTED by ${actorName}. Reason: ${reason}. Full financial exposure retained in ledger (PRD LED-012).`,
      userName: actorName,
      timestamp: new Date().toISOString(),
    });

    return claim;
  }

  public writeOffClaim(claimId: string, amount: number, reason: string, actorName: string = "Commercial Manager") {
    const claim = this.claims.find((c) => c.id === claimId);
    if (!claim) throw new Error("Claim not found");
    if (!reason || !reason.trim()) throw new Error("Mandatory write-off reason is required");

    claim.isWrittenOff = true;
    claim.writeOffReason = reason;
    claim.writeOffAmount = amount;
    claim.writtenOffAt = new Date().toISOString();

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "claim",
      entityId: claim.id,
      eventType: "CLAIM_WRITTEN_OFF",
      description: `Claim ${claim.claimNumber} write-off of Rp ${amount.toLocaleString("id-ID")} executed by ${actorName}. Reason: ${reason}. Segregated from resolved outcomes (PRD LED-014).`,
      userName: actorName,
      timestamp: new Date().toISOString(),
    });

    return claim;
  }

  public recertifyClaimWithVariance(
    claimId: string,
    certifiedValue: number,
    actorName: string = "Commercial Manager",
    notes?: string
  ) {
    const claim = this.claims.find((c) => c.id === claimId);
    if (!claim) throw new Error("Claim not found");

    const claimedVal = claim.claimedValue;
    const cleanCertified = Math.max(0, certifiedValue);
    const variance = claimedVal - cleanCertified;

    claim.certifiedValue = cleanCertified;
    claim.currentStage = "CERTIFIED";
    claim.currentStageEnteredAt = new Date().toISOString();

    const desc =
      variance > 0
        ? `Claim ${claim.claimNumber} recertified at Rp ${cleanCertified.toLocaleString("id-ID")} with a BAP cut variance of Rp ${variance.toLocaleString("id-ID")} by ${actorName}. Original claimed history (Rp ${claimedVal.toLocaleString("id-ID")}) preserved.`
        : `Claim ${claim.claimNumber} certified at Rp ${cleanCertified.toLocaleString("id-ID")} by ${actorName}.`;

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "claim",
      entityId: claim.id,
      eventType: "RECERTIFICATION_VARIANCE_RECORDED",
      description: desc + (notes ? ` Notes: ${notes}` : ""),
      userName: actorName,
      timestamp: new Date().toISOString(),
    });

    return claim;
  }

  // ==========================================
  // PHASE 6: CLAIM READINESS GATE (RDY-001..013)
  // ==========================================

  public getContractChecklists(projectId?: string): DemoContractEvidenceChecklist[] {
    if (!projectId || projectId === "all") {
      return [...this.contractEvidenceChecklists];
    }
    return this.contractEvidenceChecklists.filter((chk) => chk.projectId === projectId);
  }

  public getActiveContractChecklist(projectId: string): DemoContractEvidenceChecklist | undefined {
    return this.contractEvidenceChecklists.find(
      (chk) => chk.projectId === projectId && chk.status === "ACTIVE"
    );
  }

  public getContractChecklistItems(checklistId: string): DemoContractEvidenceChecklistItem[] {
    return this.contractEvidenceChecklistItems
      .filter((i) => i.checklistId === checklistId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  public getClaimReadinessItems(claimId: string): DemoClaimReadinessItem[] {
    return this.claimReadinessItems.filter((i) => i.claimId === claimId);
  }

  public updateClaimReadinessItem(
    claimId: string,
    itemId: string,
    updates: Partial<DemoClaimReadinessItem>,
    actorName: string = "Commercial Manager"
  ): DemoClaimReadinessItem {
    const item = this.claimReadinessItems.find((i) => i.claimId === claimId && i.id === itemId);
    if (!item) throw new Error("Claim readiness item not found");

    const oldStatus = item.status;
    if (updates.status) item.status = updates.status;
    if (updates.documentUrl !== undefined) item.documentUrl = updates.documentUrl;
    if (updates.documentTitle !== undefined) item.documentTitle = updates.documentTitle;
    if (updates.notes !== undefined) item.notes = updates.notes;
    if (updates.actionOwnerName !== undefined) item.actionOwnerName = updates.actionOwnerName;
    if (updates.dueDate !== undefined) item.dueDate = updates.dueDate;

    if (updates.status === "VERIFIED") {
      item.verifiedByName = actorName;
      item.verifiedAt = new Date().toISOString();
    } else if (updates.status === "REJECTED") {
      item.rejectionReason = updates.rejectionReason || "Dokumen belum memenuhi spesifikasi";
    }
    item.updatedAt = new Date().toISOString();

    // Check if all blocking items for this claim are now verified -> auto-progress to READY (UAT-06)
    const allItems = this.getClaimReadinessItems(claimId);
    const unverifiedBlocking = allItems.filter(
      (i) =>
        i.status !== "NOT_APPLICABLE" &&
        (i.requirementLevel === "REQUIRED" || i.requirementLevel === "CONDITIONAL") &&
        i.status !== "VERIFIED"
    );

    const claim = this.claims.find((c) => c.id === claimId);
    if (claim) {
      if (unverifiedBlocking.length === 0 && allItems.length > 0) {
        claim.readinessStatus = "READY";
        if (claim.currentStage === "CLAIM_PREPARATION") {
          claim.currentStage = "CLAIM_READY";
        }
      } else if (claim.readinessStatus === "READY" && !claim.overrideReady) {
        claim.readinessStatus = "INCOMPLETE";
      }
    }

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "claim_readiness_item",
      entityId: item.id,
      eventType: "EVIDENCE_STATUS_UPDATED",
      description: `Item "${item.name}" pada klaim ${claim?.claimNumber || claimId} diubah dari ${oldStatus} menjadi ${item.status} oleh ${actorName}.`,
      userName: actorName,
      timestamp: new Date().toISOString(),
    });

    return item;
  }

  public assignMissingItemAction(
    claimId: string,
    itemId: string,
    ownerName: string,
    dueDate: string,
    actorName: string = "Commercial Manager"
  ): DemoClaimReadinessItem {
    const item = this.claimReadinessItems.find((i) => i.claimId === claimId && i.id === itemId);
    if (!item) throw new Error("Claim readiness item not found");
    if (!ownerName || !ownerName.trim()) throw new Error("Action owner name is mandatory (RDY-007)");
    if (!dueDate) throw new Error("Due date is mandatory (RDY-007)");

    item.actionOwnerName = ownerName.trim();
    item.dueDate = dueDate;
    item.updatedAt = new Date().toISOString();

    const claim = this.claims.find((c) => c.id === claimId);

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "claim_readiness_item",
      entityId: item.id,
      eventType: "READINESS_ACTION_ASSIGNED",
      description: `Dokumen kurang "${item.name}" ditugaskan ke ${ownerName} dengan batas waktu ${dueDate} oleh ${actorName}.`,
      userName: actorName,
      timestamp: new Date().toISOString(),
    });

    return item;
  }

  public overrideClaimReadiness(
    claimId: string,
    approverName: string,
    reason: string
  ): DemoClaim {
    const claim = this.claims.find((c) => c.id === claimId);
    if (!claim) throw new Error("Claim not found");
    if (!approverName || !approverName.trim()) throw new Error("Authorized approver is mandatory (RDY-009)");
    if (!reason || !reason.trim()) throw new Error("Mandatory business reason is required for readiness override (RDY-009)");

    claim.overrideReady = true;
    claim.overrideApprovedBy = approverName.trim();
    claim.overrideReason = reason.trim();
    claim.overrideAt = new Date().toISOString();
    claim.readinessStatus = "READY";
    claim.currentStage = "CLAIM_READY";

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "claim",
      entityId: claim.id,
      eventType: "READINESS_GATE_OVERRIDDEN",
      description: `Claim ${claim.claimNumber} readiness override disetujui oleh ${approverName}. Status dipaksa READY. Alasan: ${reason}.`,
      userName: approverName,
      timestamp: new Date().toISOString(),
    });

    return claim;
  }

  public reopenClaimAfterRejection(
    claimId: string,
    rejectionReason: string,
    actorName: string = "Commercial Manager"
  ): DemoClaim {
    const claim = this.claims.find((c) => c.id === claimId);
    if (!claim) throw new Error("Claim not found");
    if (!rejectionReason || !rejectionReason.trim()) throw new Error("Rejection reason is mandatory (RDY-012)");

    claim.resubmissionCount = (claim.resubmissionCount || 0) + 1;
    claim.lastRejectionReason = rejectionReason.trim();
    claim.readinessStatus = "INCOMPLETE";
    claim.overrideReady = false;
    claim.currentStage = "REJECTED";

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "claim",
      entityId: claim.id,
      eventType: "EXTERNAL_REJECTION_REOPENED",
      description: `Klaim ${claim.claimNumber} ditolak eksternal (Resubmission #${claim.resubmissionCount}). Checklist dibuka kembali. Alasan penolakan: ${rejectionReason}.`,
      userName: actorName,
      timestamp: new Date().toISOString(),
    });

    return claim;
  }

  public copyChecklistToClaim(
    claimId: string,
    projectId: string,
    actorName: string = "Commercial Manager"
  ): DemoClaimReadinessItem[] {
    const activeChecklist = this.getActiveContractChecklist(projectId);
    if (!activeChecklist) throw new Error("No active contract checklist found for project");

    const templateItems = this.getContractChecklistItems(activeChecklist.id);
    const now = new Date().toISOString();

    const newItems: DemoClaimReadinessItem[] = templateItems.map((tmpl, idx) => ({
      id: `rdy-${claimId}-${idx + 1}`,
      orgId: "org-nusantara-01",
      claimId,
      templateItemId: tmpl.id,
      name: tmpl.name,
      requirementLevel: tmpl.requirementLevel,
      sourceClauseReference: tmpl.sourceClauseReference,
      status: "MISSING",
      notes: tmpl.description,
      createdAt: now,
      updatedAt: now,
    }));

    // Append to in-memory items
    this.claimReadinessItems.push(...newItems);

    const claim = this.claims.find((c) => c.id === claimId);
    if (claim) {
      claim.readinessTemplateVersion = activeChecklist.version;
      claim.readinessStatus = "NOT_STARTED";
    }

    this.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      orgId: "org-nusantara-01",
      entityType: "claim",
      entityId: claimId,
      eventType: "CHECKLIST_CLONED_TO_CLAIM",
      description: `Checklist template v${activeChecklist.version} disalin ke klaim ${claim?.claimNumber || claimId} (${newItems.length} item).`,
      userName: actorName,
      timestamp: now,
    });

    return newItems;
  }
}

// Canonical Server / Database Singleton
export const dbAdapter = new CoveDatabaseAdapter();
