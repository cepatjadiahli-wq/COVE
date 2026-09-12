// ============================================================================
// COVE Backend — TypeScript Domain Types v2.1
// Acuan: COVE_ERD_v2.0_Logical_Data_Model.md
// ============================================================================

export type TenantRole =
  | 'OWNER'
  | 'ADMIN'
  | 'COMMERCIAL_MANAGER'
  | 'QS'
  | 'PROJECT_MANAGER'
  | 'FINANCE_MANAGER'
  | 'EXECUTIVE_VIEWER'
  | 'AUDITOR'
  | 'COVE_IMPLEMENTATION';

export type UserRole = TenantRole;

export type PlatformRoleScope =
  | 'SUPER_ADMIN'
  | 'FINANCE_OPERATOR'
  | 'GROWTH_OPERATOR'
  | 'SUPPORT_AGENT';

export interface RequestActor {
  authUserId: string;
  profileId: string;
  orgId: string | null;
  membershipId: string | null;
  role: TenantRole | null;
  fullName: string;
  email: string;
  isPlatformAdmin: boolean;
  platformGrants: PlatformRoleScope[];
}

export const STAGES = [
  'Dikerjakan',
  'Diukur',
  'Diajukan',
  'Disetujui',
  'Ditagihkan',
  'Diterima'
] as const;

export type StageName = typeof STAGES[number];

export type StageValues = [number, number, number, number, number, number];

export interface ProjectEntity {
  id: string;
  orgId?: string | null;
  code: string;
  name: string;
  customer: string;
  location: string;
  owner: string;
  status: 'Aktif' | 'Diarsipkan';
  contract: number;
  values: StageValues;
  updated: string;
}

export interface ActionEntity {
  id: string;
  orgId?: string | null;
  projectId: string;
  title: string;
  blocker: string;
  owner: string;
  due: string;
  severity: 'Tinggi' | 'Sedang' | 'Rendah';
  value: number;
  status: 'Terbuka' | 'Menunggu' | 'Selesai';
  notes: string[];
}

export interface InvoiceEntity {
  id: string;
  orgId?: string | null;
  projectId: string;
  number: string;
  principal: number;
  paid: number;
  issued: string;
  due: string;
  status: 'Terbit' | 'Draf' | 'Disengketakan';
  certificate: string;
}

export interface DocumentRecord {
  id: string;
  orgId?: string | null;
  projectId: string;
  name: string;
  kind: 'Opname' | 'Sertifikat' | 'Kontrak' | 'Klaim' | 'Lampiran';
  version: number;
  date: string;
  owner: string;
  status: string;
}

export interface SupportTicketEntity {
  id: string;
  orgId?: string | null;
  title: string;
  category: string;
  status: string;
  priority: 'P1' | 'P2' | 'P3';
  messages: {
    body: string;
    author: string;
    internal: boolean;
    at: string;
  }[];
}

export interface FeatureRequestEntity {
  id: string;
  orgId?: string | null;
  title: string;
  problem: string;
  module: string;
  commercialImpact?: string;
  priority?: 'P1' | 'P2' | 'P3' | 'LATER';
  status: 'Ditinjau' | 'Direncanakan' | 'Dikerjakan' | 'Dirilis' | 'Ditolak';
  update?: string;
}

export interface RecoveryLeadEntity {
  id: string;
  name: string;
  company: string;
  plan: string;
  phone: string;
  phoneClean: string;
  abandonAt: string;
  reason: string;
  consentStatus: 'GRANTED' | 'MISSING' | 'SUPPRESSED';
  contacted: boolean;
}

export interface ConsentRecordEntity {
  id: string;
  contactId?: string;
  profileId?: string;
  consentType: 'ANALYTICS' | 'META_CAPI_ADS' | 'WHATSAPP_COMMUNICATION' | 'PRODUCT_RESEARCH';
  granted: boolean;
  recordedAt: string;
}

export interface ConversionOutboxEntity {
  id: string;
  eventName: 'PageView' | 'ViewContent' | 'InitiateCheckout' | 'Purchase';
  eventSourceUrl: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SUPPRESSED';
  retryCount: number;
  createdAt: string;
}

export interface PlanEntity {
  id: string;
  name: string;
  price: number;
  period: string;
  maxProjects: number;
  maxUsers: number;
}

export type SubscriptionStatus =
  | 'INACTIVE'
  | 'PENDING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'CANCELED'
  | 'EXPIRED';

export interface TenantSubscriptionEntity {
  id: string;
  organizationId: string;
  planId: string;
  plan?: string;
  planName?: string;
  status: SubscriptionStatus;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  quotaUsed?: number;
  quotaTotal?: number;
  amount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CheckoutSessionEntity {
  id: string;
  organizationId: string;
  provider: string;
  providerReference: string;
  providerCheckoutId?: string | null;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  plan: string;
  amount: number;
  currency: string;
  paymentUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubscriptionEntity {
  id: string;
  planId: string;
  planName: string;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'CANCELED' | 'EXPIRED' | 'INACTIVE' | 'PENDING' | 'NONE';
  quotaUsed: number;
  quotaTotal: number;
  periodStart: string;
  periodEnd: string;
  amount: number;
}

export interface WebhookEventRecord {
  id: string;
  eventId: string;
  eventType: string;
  provider: string;
  payload: Record<string, unknown>;
  payloadHash?: string;
  processedAt: string;
}

export interface StageMetricsResult {
  gaps: [number, number, number, number, number];
  unbilled: number;
  receivable: number;
  total: number;
  identityValid: boolean;
  invalid: boolean;
}

export interface ReceiptAllocationInput {
  invoiceId: string;
  amount: number;
}

export interface ProfileEntity {
  id: string;
  authUserId: string;
  fullName: string;
  phone?: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
}

export interface OrganizationEntity {
  id: string;
  legalName: string;
  displayName: string;
  timezone: string;
  defaultCurrency: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
}

export interface OrganizationMembershipEntity {
  id: string;
  orgId: string;
  profileId: string;
  role: TenantRole;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
}

export interface PlatformAdminRecord {
  id: string;
  authUserId: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
}

export interface PlatformRoleGrantRecord {
  id: string;
  adminId: string;
  roleScope: PlatformRoleScope;
  grantedAt: string;
  revokedAt?: string;
}

export interface AdminAuditLogRecord {
  id: string;
  actorAdminId?: string;
  action: string;
  resource: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  reason?: string;
  correlationId?: string;
  requestSource?: string;
  createdAt: string;
}
