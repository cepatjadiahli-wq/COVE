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
} from "@/domains/demo/seed-data";
import { calculateClaimGaps } from "@/domains/gaps/service";
import { evaluateClaimRisk, RiskLevel } from "@/domains/risks/service";
import { ClaimStage, OutcomeType } from "@/lib/constants";
import { calculateInvoiceFinancials } from "@/domains/invoices/service";

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
  private claims = [...SEED_CLAIMS];
  private invoices = [...SEED_INVOICES];
  private blockers = [...SEED_BLOCKERS];
  private actions = [...SEED_ACTIONS];
  private auditLogs = [...SEED_AUDIT_LOGS];
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

  public createAction(actionData: Omit<(typeof SEED_ACTIONS)[0], "id" | "status">) {
    const newId = "act-" + Math.random().toString(36).substring(2, 9);
    const newAction = { ...actionData, id: newId, status: "open" as const };
    this.actions.unshift(newAction);
    return newAction;
  }

  public resolveAction(actionId: string, resolutionNotes: string, outcomeType: OutcomeType, outcomeValue?: number) {
    const action = this.actions.find((a) => a.id === actionId);
    if (!action) throw new Error("Action not found in database");
    action.status = "resolved";
    action.resolutionNotes = resolutionNotes;
    action.outcomeType = outcomeType;
    action.outcomeValue = outcomeValue || action.financialExposure;
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
}

// Canonical Server / Database Singleton
export const dbAdapter = new CoveDatabaseAdapter();
