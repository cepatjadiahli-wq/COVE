import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import pg from 'pg';
import {config} from '../config.js';
import type {
  ProjectEntity,
  ActionEntity,
  InvoiceEntity,
  DocumentRecord,
  SupportTicketEntity,
  FeatureRequestEntity,
  SubscriptionEntity,
  WebhookEventRecord,
  RecoveryLeadEntity,
  OrganizationEntity,
  ProfileEntity,
  OrganizationMembershipEntity,
  PlatformAdminRecord,
  PlatformRoleGrantRecord,
  AdminAuditLogRecord
} from '../types/domain.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.resolve(__dirname, '../../data/cove_db.json');

// Seed Initial Data
export const initialProjects: ProjectEntity[] = [
  {
    id: 'p1',
    orgId: 'org-001',
    code: 'COV-001',
    name: 'Gedung Meridian',
    customer: 'PT Meridian Properti',
    location: 'Jakarta Selatan',
    owner: 'Andi Pratama',
    status: 'Aktif',
    contract: 15000000000,
    values: [1200000000, 1050000000, 900000000, 750000000, 600000000, 450000000],
    updated: '8 Sep 2026, 09.15'
  },
  {
    id: 'p2',
    orgId: 'org-001',
    code: 'COV-002',
    name: 'Logistik Cakrawala',
    customer: 'PT Cakrawala Logistik',
    location: 'Bekasi, Jawa Barat',
    owner: 'Sari Wulandari',
    status: 'Aktif',
    contract: 24000000000,
    values: [3200000000, 2900000000, 2700000000, 2400000000, 2100000000, 1600000000],
    updated: '8 Sep 2026, 08.40'
  },
  {
    id: 'p3',
    orgId: 'org-001',
    code: 'COV-003',
    name: 'MEP Rumah Sakit Aruna',
    customer: 'Yayasan Aruna Sehat',
    location: 'Bandung, Jawa Barat',
    owner: 'Budi Santoso',
    status: 'Aktif',
    contract: 8000000000,
    values: [1800000000, 1650000000, 1450000000, 1250000000, 1050000000, 800000000],
    updated: '7 Sep 2026, 16.20'
  },
  {
    id: 'p4',
    orgId: 'org-001',
    code: 'COV-004',
    name: 'Pabrik Nusa Industri',
    customer: 'PT Nusa Industri',
    location: 'Karawang, Jawa Barat',
    owner: 'Andi Pratama',
    status: 'Diarsipkan',
    contract: 5000000000,
    values: [5000000000, 5000000000, 5000000000, 5000000000, 5000000000, 5000000000],
    updated: '31 Agu 2026, 10.00'
  },
  {
    id: 'p-org2-01',
    orgId: 'org-002',
    code: 'EXT-001',
    name: 'Proyek Rahasia Tenant Sebelah',
    customer: 'PT Mitra Sebelah',
    location: 'Surabaya, Jawa Timur',
    owner: 'Joko Rahasia',
    status: 'Aktif',
    contract: 6000000000,
    values: [1000000000, 800000000, 700000000, 600000000, 500000000, 400000000],
    updated: '8 Sep 2026, 11.00'
  }
];

const initialActions: ActionEntity[] = [
  {
    id: 'a1',
    projectId: 'p1',
    title: 'Lengkapi dokumen opname',
    blocker: 'Berita acara belum ditandatangani',
    owner: 'Andi Pratama',
    due: '2026-09-07',
    severity: 'Tinggi',
    value: 150000000,
    status: 'Terbuka',
    notes: ['7 Sep · QS mengunggah hasil pengukuran. Menunggu tanda tangan PM.']
  },
  {
    id: 'a2',
    projectId: 'p2',
    title: 'Tindak lanjuti persetujuan klaim Agustus',
    blocker: 'Review quantity oleh MK',
    owner: 'Sari Wulandari',
    due: '2026-09-08',
    severity: 'Tinggi',
    value: 300000000,
    status: 'Menunggu',
    notes: ['6 Sep · Klaim diterima tim MK.']
  },
  {
    id: 'a3',
    projectId: 'p3',
    title: 'Terbitkan invoice sertifikat termin 04',
    blocker: 'Invoice belum dibuat',
    owner: 'Dewi Lestari',
    due: '2026-09-09',
    severity: 'Sedang',
    value: 200000000,
    status: 'Terbuka',
    notes: []
  },
  {
    id: 'a4',
    projectId: 'p2',
    title: 'Konfirmasi jadwal pembayaran termin 06',
    blocker: 'Pembayaran melewati jatuh tempo',
    owner: 'Dewi Lestari',
    due: '2026-09-06',
    severity: 'Tinggi',
    value: 300000000,
    status: 'Terbuka',
    notes: ['5 Sep · Janji bayar belum dikonfirmasi ulang.']
  },
  {
    id: 'a5',
    projectId: 'p1',
    title: 'Periksa kelengkapan sertifikat termin 03',
    blocker: 'Lampiran sertifikat',
    owner: 'Budi Santoso',
    due: '2026-09-10',
    severity: 'Rendah',
    value: 150000000,
    status: 'Selesai',
    notes: ['8 Sep · Sertifikat dan lampiran cocok dengan nilai disetujui.']
  }
];

const initialInvoices: InvoiceEntity[] = [
  {id:'i1',projectId:'p1',number:'INV/MRD/2026/003',principal:300000000,paid:220000000,issued:'2026-07-20',due:'2026-08-19',status:'Terbit',certificate:'BAP-MRD-003'},
  {id:'i2',projectId:'p1',number:'INV/MRD/2026/004',principal:300000000,paid:230000000,issued:'2026-08-25',due:'2026-09-24',status:'Terbit',certificate:'BAP-MRD-004'},
  {id:'i3',projectId:'p2',number:'INV/CKR/2026/006',principal:1200000000,paid:900000000,issued:'2026-07-18',due:'2026-08-17',status:'Terbit',certificate:'BAP-CKR-006'},
  {id:'i4',projectId:'p2',number:'INV/CKR/2026/007',principal:900000000,paid:700000000,issued:'2026-08-20',due:'2026-09-19',status:'Terbit',certificate:'BAP-CKR-007'},
  {id:'i5',projectId:'p3',number:'INV/ARN/2026/003',principal:600000000,paid:450000000,issued:'2026-07-25',due:'2026-08-24',status:'Terbit',certificate:'BAP-ARN-003'},
  {id:'i6',projectId:'p3',number:'INV/ARN/2026/004',principal:450000000,paid:350000000,issued:'2026-08-20',due:'2026-09-19',status:'Terbit',certificate:'BAP-ARN-004'}
];

const initialDocuments: DocumentRecord[] = [
  {id:'d1',projectId:'p1',name:'Berita Acara Opname — Agustus 2026',kind:'Opname',version:2,date:'2026-09-07',owner:'Andi Pratama',status:'Menunggu tanda tangan'},
  {id:'d2',projectId:'p1',name:'Sertifikat Pembayaran Termin 03',kind:'Sertifikat',version:1,date:'2026-08-18',owner:'Sari Wulandari',status:'Lengkap'},
  {id:'d3',projectId:'p1',name:'Kontrak Induk — Gedung Meridian',kind:'Kontrak',version:1,date:'2026-01-05',owner:'Budi Santoso',status:'Lengkap'},
  {id:'d4',projectId:'p2',name:'Rekap Volume Klaim Agustus',kind:'Klaim',version:3,date:'2026-09-06',owner:'Sari Wulandari',status:'Lengkap'}
];

const initialTickets: SupportTicketEntity[] = [
  {
    id: 'TKT-001',
    title: 'Bagaimana mengoreksi pemetaan kolom impor?',
    category: 'Data proyek',
    status: 'Menunggu Anda',
    priority: 'P3',
    messages: [
      {body: 'Kolom nilai kontrak terbaca sebagai teks. Bagaimana cara memperbaikinya?', author: 'Anda', internal: false, at: '7 Sep, 10.20'},
      {body: 'Pada langkah pemetaan, pilih kolom yang berisi angka tanpa simbol Rp. Preview akan menandai baris yang perlu diperiksa sebelum disimpan.', author: 'Nadia · Tim COVE', internal: false, at: '7 Sep, 11.05'}
    ]
  }
];

const initialFeatures: FeatureRequestEntity[] = [
  {
    id: 'USL-001',
    title: 'Ekspor laporan mingguan per PIC',
    problem: 'Membagikan daftar tindakan tiap QS masih dilakukan manual.',
    module: 'Laporan',
    commercialImpact: 'Menghemat 2 jam rekap mingguan tiap QS.',
    priority: 'P2',
    status: 'Ditinjau',
    update: 'Tim produk sedang mempelajari format laporan yang dibutuhkan.'
  },
  {
    id: 'USL-002',
    title: 'Integrasi perbandingan opname bertingkat',
    problem: 'Selisih opname subkon sering terlewat jika volume tidak disandingkan otomatis.',
    module: 'Progres & Klaim',
    commercialImpact: 'Mencegah potensi klaim berlebih subkon hingga puluhan juta.',
    priority: 'P1',
    status: 'Direncanakan',
    update: 'Masuk dalam backlog kuartal 4.'
  }
];

const initialRecoveryLeads: RecoveryLeadEntity[] = [
  {
    id: 'lead-01',
    name: 'Ir. Hendra Wijaya',
    company: 'PT Pilar Utama Konstruksi',
    plan: 'Core',
    phone: '+62 812-9988-1122',
    phoneClean: '6281299881122',
    abandonAt: '7 Sep 2026, 14.20',
    reason: 'Checkout belum dibayar',
    consentStatus: 'GRANTED',
    contacted: false
  },
  {
    id: 'lead-02',
    name: 'Bambang Sudibyo',
    company: 'PT Megatama Sarana',
    plan: 'Paid Pilot',
    phone: '+62 811-2233-4455',
    phoneClean: '6281122334455',
    abandonAt: '6 Sep 2026, 11.05',
    reason: 'Gagal bayar QRIS',
    consentStatus: 'GRANTED',
    contacted: false
  },
  {
    id: 'lead-03',
    name: 'Hendra Gunawan',
    company: 'PT Nusantara Beton',
    plan: 'Scale',
    phone: '+62 813-4455-6677',
    phoneClean: '6281344556677',
    abandonAt: '5 Sep 2026, 16.45',
    reason: 'Batal di halaman Mayar',
    consentStatus: 'SUPPRESSED',
    contacted: false
  }
];

const initialOrganizations: OrganizationEntity[] = [
  {
    id: 'org-001',
    legalName: 'PT Ruang Karya Konstruksi',
    displayName: 'Ruang Karya',
    timezone: 'Asia/Jakarta',
    defaultCurrency: 'IDR',
    status: 'ACTIVE'
  },
  {
    id: 'org-002',
    legalName: 'PT Kontraktor Sebelah',
    displayName: 'Kontraktor Sebelah',
    timezone: 'Asia/Jakarta',
    defaultCurrency: 'IDR',
    status: 'ACTIVE'
  }
];

const initialProfiles: ProfileEntity[] = [
  {
    id: 'prof-001',
    authUserId: 'usr-auth-001',
    fullName: 'Andi Pratama',
    phone: '+6281299881100',
    status: 'ACTIVE',
    createdAt: '2026-09-08T08:00:00.000Z'
  },
  {
    id: 'prof-002',
    authUserId: 'usr-auth-002',
    fullName: 'Sari Wulandari',
    phone: '+6281299881101',
    status: 'ACTIVE',
    createdAt: '2026-09-08T08:00:00.000Z'
  },
  {
    id: 'prof-003',
    authUserId: 'usr-auth-003',
    fullName: 'Dewi Lestari',
    phone: '+6281299881102',
    status: 'ACTIVE',
    createdAt: '2026-09-08T08:00:00.000Z'
  },
  {
    id: 'prof-004',
    authUserId: 'usr-auth-admin',
    fullName: 'Cove Platform Admin',
    phone: '+6281299881199',
    status: 'ACTIVE',
    createdAt: '2026-09-08T08:00:00.000Z'
  },
  {
    id: 'prof-005',
    authUserId: 'usr-auth-004',
    fullName: 'Bambang Auditor',
    phone: '+6281299881103',
    status: 'ACTIVE',
    createdAt: '2026-09-08T08:00:00.000Z'
  },
  {
    id: 'prof-006',
    authUserId: 'usr-auth-org2',
    fullName: 'Joko Rahasia',
    phone: '+6281299881104',
    status: 'ACTIVE',
    createdAt: '2026-09-08T08:00:00.000Z'
  }
];

const initialMemberships: OrganizationMembershipEntity[] = [
  {
    id: 'mem-001',
    orgId: 'org-001',
    profileId: 'prof-001',
    role: 'OWNER',
    status: 'ACTIVE'
  },
  {
    id: 'mem-002',
    orgId: 'org-001',
    profileId: 'prof-002',
    role: 'QS',
    status: 'ACTIVE'
  },
  {
    id: 'mem-003',
    orgId: 'org-001',
    profileId: 'prof-003',
    role: 'FINANCE_MANAGER',
    status: 'ACTIVE'
  },
  {
    id: 'mem-004',
    orgId: 'org-001',
    profileId: 'prof-005',
    role: 'AUDITOR',
    status: 'ACTIVE'
  },
  {
    id: 'mem-005',
    orgId: 'org-002',
    profileId: 'prof-006',
    role: 'OWNER',
    status: 'ACTIVE'
  }
];

const initialPlatformAdmins: PlatformAdminRecord[] = [
  {
    id: 'adm-001',
    authUserId: 'usr-auth-admin',
    status: 'ACTIVE',
    createdAt: '2026-09-08T00:00:00.000Z',
    updatedAt: '2026-09-08T00:00:00.000Z'
  }
];

const initialPlatformRoleGrants: PlatformRoleGrantRecord[] = [
  {
    id: 'grant-001',
    adminId: 'adm-001',
    roleScope: 'SUPER_ADMIN',
    grantedAt: '2026-09-08T00:00:00.000Z'
  }
];

const initialAdminAuditLogs: AdminAuditLogRecord[] = [];

export class DataStore {
  private filePath = DB_FILE;

  public organizations: OrganizationEntity[] = process.env.NODE_ENV === 'production' ? [] : structuredClone(initialOrganizations);
  public profiles: ProfileEntity[] = process.env.NODE_ENV === 'production' ? [] : structuredClone(initialProfiles);
  public organizationMemberships: OrganizationMembershipEntity[] = process.env.NODE_ENV === 'production' ? [] : structuredClone(initialMemberships);
  public platformAdmins: PlatformAdminRecord[] = process.env.NODE_ENV === 'production' ? [] : structuredClone(initialPlatformAdmins);
  public platformRoleGrants: PlatformRoleGrantRecord[] = process.env.NODE_ENV === 'production' ? [] : structuredClone(initialPlatformRoleGrants);
  public adminAuditLogs: AdminAuditLogRecord[] = [];

  public projects: ProjectEntity[] = process.env.NODE_ENV === 'production' ? [] : structuredClone(initialProjects);
  public actions: ActionEntity[] = process.env.NODE_ENV === 'production' ? [] : structuredClone(initialActions);
  public invoices: InvoiceEntity[] = process.env.NODE_ENV === 'production' ? [] : structuredClone(initialInvoices);
  public documents: DocumentRecord[] = process.env.NODE_ENV === 'production' ? [] : structuredClone(initialDocuments);
  public tickets: SupportTicketEntity[] = process.env.NODE_ENV === 'production' ? [] : structuredClone(initialTickets);
  public features: FeatureRequestEntity[] = process.env.NODE_ENV === 'production' ? [] : structuredClone(initialFeatures);
  public get featureRequests(): FeatureRequestEntity[] { return this.features; }
  public recoveryLeads: RecoveryLeadEntity[] = process.env.NODE_ENV === 'production' ? [] : structuredClone(initialRecoveryLeads);
  public webhooks: WebhookEventRecord[] = [];
  public subscription: SubscriptionEntity = process.env.NODE_ENV === 'production' ? {
    id: '',
    planId: 'free',
    planName: 'None',
    status: 'INACTIVE',
    quotaUsed: 0,
    quotaTotal: 0,
    periodStart: '',
    periodEnd: '',
    amount: 0
  } : {
    id: 'sub-001',
    planId: 'core',
    planName: 'Core',
    status: 'ACTIVE',
    quotaUsed: 3,
    quotaTotal: 3,
    periodStart: '2026-09-08',
    periodEnd: '2026-10-08',
    amount: 4900000
  };

  constructor(customPath?: string) {
    if (customPath) {
      this.filePath = customPath;
    }
    this.load();
  }

  public load(): void {
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      this.projects = [];
      this.actions = [];
      this.invoices = [];
      this.documents = [];
      this.tickets = [];
      this.features = [];
      this.recoveryLeads = [];
      this.organizations = [];
      this.profiles = [];
      this.organizationMemberships = [];
      this.platformAdmins = [];
      this.platformRoleGrants = [];
      this.adminAuditLogs = [];
      this.subscription = {
        id: '',
        planId: 'free',
        planName: 'None',
        status: 'INACTIVE',
        quotaUsed: 0,
        quotaTotal: 0,
        periodStart: '',
        periodEnd: '',
        amount: 0
      };
      return;
    }

    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.projects)) this.projects = data.projects;
        if (Array.isArray(data.actions)) this.actions = data.actions;
        if (Array.isArray(data.invoices)) this.invoices = data.invoices;
        if (Array.isArray(data.documents)) this.documents = data.documents;
        if (Array.isArray(data.tickets)) this.tickets = data.tickets;
        if (Array.isArray(data.features)) this.features = data.features;
        if (Array.isArray(data.recoveryLeads)) this.recoveryLeads = data.recoveryLeads;
        if (Array.isArray(data.webhooks)) this.webhooks = data.webhooks;
        if (Array.isArray(data.organizations)) this.organizations = data.organizations;
        if (Array.isArray(data.profiles)) this.profiles = data.profiles;
        if (Array.isArray(data.organizationMemberships)) this.organizationMemberships = data.organizationMemberships;
        if (Array.isArray(data.platformAdmins)) this.platformAdmins = data.platformAdmins;
        if (Array.isArray(data.platformRoleGrants)) this.platformRoleGrants = data.platformRoleGrants;
        if (Array.isArray(data.adminAuditLogs)) this.adminAuditLogs = data.adminAuditLogs;
        if (data.subscription) this.subscription = data.subscription;
      } else {
        this.save();
      }
    } catch (e) {
      if (isProd) {
        this.projects = [];
        this.actions = [];
        this.invoices = [];
        this.documents = [];
        this.tickets = [];
        this.features = [];
        this.recoveryLeads = [];
        this.subscription = {
          id: '',
          planId: 'free',
          planName: 'None',
          status: 'INACTIVE',
          quotaUsed: 0,
          quotaTotal: 0,
          periodStart: '',
          periodEnd: '',
          amount: 0
        };
      }
      console.warn('Could not read cove_db.json, using fallback store state:', e);
    }
  }

  public save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
      }
      const state = {
        projects: this.projects,
        actions: this.actions,
        invoices: this.invoices,
        documents: this.documents,
        tickets: this.tickets,
        features: this.features,
        recoveryLeads: this.recoveryLeads,
        webhooks: this.webhooks,
        organizations: this.organizations,
        profiles: this.profiles,
        organizationMemberships: this.organizationMemberships,
        platformAdmins: this.platformAdmins,
        platformRoleGrants: this.platformRoleGrants,
        adminAuditLogs: this.adminAuditLogs,
        subscription: this.subscription
      };
      fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to write cove_db.json:', e);
    }
  }

  public reset(): void {
    this.projects = structuredClone(initialProjects);
    this.actions = structuredClone(initialActions);
    this.invoices = structuredClone(initialInvoices);
    this.documents = structuredClone(initialDocuments);
    this.tickets = structuredClone(initialTickets);
    this.features = structuredClone(initialFeatures);
    this.recoveryLeads = structuredClone(initialRecoveryLeads);
    this.organizations = structuredClone(initialOrganizations);
    this.profiles = structuredClone(initialProfiles);
    this.organizationMemberships = structuredClone(initialMemberships);
    this.platformAdmins = structuredClone(initialPlatformAdmins);
    this.platformRoleGrants = structuredClone(initialPlatformRoleGrants);
    this.adminAuditLogs = structuredClone(initialAdminAuditLogs);
    this.webhooks = [];
    this.subscription = {
      id: 'sub-001',
      planId: 'core',
      planName: 'Core',
      status: 'ACTIVE',
      quotaUsed: 3,
      quotaTotal: 3,
      periodStart: '2026-09-08',
      periodEnd: '2026-10-08',
      amount: 4900000
    };
    this.save();
  }
}

export const db = new DataStore();

// PostgreSQL Pool (optional, graceful fallback if no live DB is running)
export const pgPool = new pg.Pool({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: 2000
});

pgPool.on('error', () => {
  // Silent fallback to in-memory store in dev
});
