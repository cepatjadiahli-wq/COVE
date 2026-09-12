// ============================================================================
// COVE Backend — Canonical Progress-to-Cash Ledger Repository (Gate P0-B.2)
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §3, §5, §7
// Replaces DataStore/JSON authority with canonical PostgreSQL persistence.
// Enforces stage lineage: Work Progress -> Measurement -> Claim -> Certificate
// ============================================================================

import pg from 'pg';
import {pgPool, db} from '../db/store.js';
import {getProjectRepository} from './project.repository.js';
import {
  type MoneyString,
  type MoneyInput,
  parseMoney,
  addMoney,
  subtractMoney,
  compareMoney,
  isPositiveMoney
} from '../utils/money.js';

export interface WorkProgressLineRecord {
  id: string;
  orgId: string;
  projectId: string;
  periodId: string;
  description: string;
  quantity: number;
  unit: string;
  principalAmount: MoneyString;
  allocatedToMeasurement: MoneyString;
  availableAmount: MoneyString;
  progressDate: string;
  evidenceStatus: string;
  status: 'ACTIVE' | 'CANCELLED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface MeasurementAllocationRecord {
  id: string;
  measurementId: string;
  workProgressLineId: string;
  allocatedAmount: MoneyString;
  createdAt: string;
}

export interface MeasurementRecord {
  id: string;
  orgId: string;
  projectId: string;
  measurementNumber: string;
  measurementDate: string;
  description: string;
  status: 'DRAFT' | 'SUBMITTED' | 'VERIFIED';
  totalAllocatedAmount: MoneyString;
  allocatedToClaim: MoneyString;
  availableAmount: MoneyString;
  createdAt: string;
  updatedAt: string;
  allocations?: MeasurementAllocationRecord[];
}

export interface ClaimAllocationRecord {
  id: string;
  claimId: string;
  measurementId: string;
  allocatedAmount: MoneyString;
  createdAt: string;
}

export interface ClaimRecord {
  id: string;
  orgId: string;
  projectId: string;
  claimNumber: string;
  submittedAt: string;
  readinessStatus: 'INCOMPLETE' | 'COMPLETE';
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED';
  description: string;
  totalAllocatedAmount: MoneyString;
  allocatedToCertification: MoneyString;
  availableAmount: MoneyString;
  createdAt: string;
  updatedAt: string;
  allocations?: ClaimAllocationRecord[];
}

export interface CertificationAllocationRecord {
  id: string;
  certificateId: string;
  claimId: string;
  allocatedAmount: MoneyString;
  createdAt: string;
}

export interface CertificateRecord {
  id: string;
  orgId: string;
  projectId: string;
  certificateNumber: string;
  certifiedAt: string;
  status: 'DRAFT' | 'CERTIFIED' | 'DISPUTED';
  description: string;
  totalAllocatedAmount: MoneyString;
  createdAt: string;
  updatedAt: string;
  allocations?: CertificationAllocationRecord[];
}

export interface ProjectInvoiceAllocationRecord {
  id: string;
  projectInvoiceId: string;
  certificateId: string;
  allocatedAmount: MoneyString;
  createdAt: string;
}

export interface ProjectInvoiceRecord {
  id: string;
  orgId: string;
  projectId: string;
  invoiceNumber: string;
  certificateReference?: string;
  issuedAt: string;
  dueAt: string;
  currency: string;
  principalAmount: MoneyString;
  totalPayable: MoneyString;
  paidAmount: MoneyString;
  remainingAmount: MoneyString;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'DISPUTED' | 'CANCELLED';
  description: string;
  createdAt: string;
  updatedAt: string;
  allocations?: ProjectInvoiceAllocationRecord[];
}

export interface ReceiptAllocationRecord {
  id: string;
  cashReceiptId: string;
  projectInvoiceId: string;
  allocatedAmount: MoneyString;
  createdAt: string;
}

export interface CashReceiptRecord {
  id: string;
  orgId: string;
  projectId: string;
  idempotencyKey: string;
  receiptNumber?: string;
  receivedAt: string;
  bankReference: string;
  currency: string;
  receivedAmount: MoneyString;
  allocatedAmount: MoneyString;
  unallocatedAmount: MoneyString;
  settlementStatus: 'PENDING' | 'SETTLED' | 'REVERSED';
  paymentMethod: string;
  description: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  allocations?: ReceiptAllocationRecord[];
}

export interface LedgerTotals {
  workPerformed: MoneyString;
  measured: MoneyString;
  claimed: MoneyString;
  certified: MoneyString;
  invoiced: MoneyString;
  collected: MoneyString;
  g1: MoneyString;
  g2: MoneyString;
  g3: MoneyString;
  g4: MoneyString;
  g5: MoneyString;
}

export interface LineageEntry {
  certificateId: string;
  certificateNumber: string;
  certifiedAmount: MoneyString;
  claimId: string;
  claimNumber: string;
  claimedAmount: MoneyString;
  measurementId: string;
  measurementNumber: string;
  measuredAmount: MoneyString;
  workProgressLineId: string;
  progressDescription: string;
  progressAmount: MoneyString;
  invoiceId?: string;
  invoiceNumber?: string;
  invoicedAmount?: MoneyString;
  receiptId?: string;
  receiptNumber?: string;
  collectedAmount?: MoneyString;
}

export interface CreateWorkProgressInput {
  orgId: string;
  projectId: string;
  description: string;
  principalAmount: MoneyInput;
  quantity?: number;
  unit?: string;
  progressDate?: string;
  evidenceStatus?: 'PENDING' | 'ATTACHED' | 'VERIFIED';
  periodId?: string;
}

export interface CreateMeasurementInput {
  orgId: string;
  projectId: string;
  measurementNumber: string;
  measurementDate?: string;
  description?: string;
  allocations: Array<{
    workProgressLineId: string;
    amount: MoneyInput;
  }>;
}

export interface CreateClaimInput {
  orgId: string;
  projectId: string;
  claimNumber: string;
  submittedAt?: string;
  description?: string;
  allocations: Array<{
    measurementId: string;
    amount: MoneyInput;
  }>;
}

export interface CreateCertificateInput {
  orgId: string;
  projectId: string;
  certificateNumber: string;
  certifiedAt?: string;
  description?: string;
  allocations: Array<{
    claimId: string;
    amount: MoneyInput;
  }>;
}

export interface CreateProjectInvoiceInput {
  orgId: string;
  projectId: string;
  invoiceNumber: string;
  issuedAt?: string;
  dueAt?: string;
  description?: string;
  certificateReference?: string;
  allocations: Array<{
    certificateId: string;
    amount: MoneyInput;
  }>;
}

export interface CreateCashReceiptInput {
  orgId: string;
  projectId: string;
  idempotencyKey: string;
  receiptNumber?: string;
  receivedAt?: string;
  bankReference?: string;
  paymentMethod?: string;
  receivedAmount: MoneyInput;
  description?: string;
  notes?: string;
  allocations: Array<{
    invoiceId: string;
    amount: MoneyInput;
  }>;
}

export interface ILedgerRepository {
  createWorkProgressLine(input: CreateWorkProgressInput): Promise<WorkProgressLineRecord>;
  getWorkProgressLines(orgId: string, projectId: string): Promise<WorkProgressLineRecord[]>;
  getWorkProgressLineById(orgId: string, projectId: string, id: string): Promise<WorkProgressLineRecord | null>;

  createMeasurement(input: CreateMeasurementInput): Promise<MeasurementRecord>;
  getMeasurements(orgId: string, projectId: string): Promise<MeasurementRecord[]>;
  getMeasurementById(orgId: string, projectId: string, id: string): Promise<MeasurementRecord | null>;

  createClaim(input: CreateClaimInput): Promise<ClaimRecord>;
  getClaims(orgId: string, projectId: string): Promise<ClaimRecord[]>;
  getClaimById(orgId: string, projectId: string, id: string): Promise<ClaimRecord | null>;

  createCertificate(input: CreateCertificateInput): Promise<CertificateRecord>;
  getCertificates(orgId: string, projectId: string): Promise<CertificateRecord[]>;
  getCertificateById(orgId: string, projectId: string, id: string): Promise<CertificateRecord | null>;

  createProjectInvoice(input: CreateProjectInvoiceInput): Promise<ProjectInvoiceRecord>;
  getProjectInvoices(orgId: string, projectId?: string): Promise<ProjectInvoiceRecord[]>;
  getProjectInvoiceById(orgId: string, projectId: string, id: string): Promise<ProjectInvoiceRecord | null>;

  createCashReceipt(input: CreateCashReceiptInput): Promise<CashReceiptRecord>;
  getCashReceipts(orgId: string, projectId: string): Promise<CashReceiptRecord[]>;
  getCashReceiptById(orgId: string, projectId: string, id: string): Promise<CashReceiptRecord | null>;

  getLedgerTotals(orgId: string, projectId: string): Promise<LedgerTotals>;
  getLineage(orgId: string, projectId: string): Promise<LineageEntry[]>;
}

export interface QueryableLedgerClient {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
  release: () => void;
}

export interface QueryableLedgerPool {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
  connect?: () => Promise<QueryableLedgerClient>;
}

export class PostgresLedgerRepository implements ILedgerRepository {
  private pool: QueryableLedgerPool;

  constructor(pool: QueryableLedgerPool = pgPool) {
    this.pool = pool;
  }

  private async getClient(): Promise<QueryableLedgerClient> {
    if (this.pool && typeof this.pool.connect === 'function') {
      return await this.pool.connect();
    }
    return {
      query: (sql: string, params?: any[]) => this.pool.query(sql, params),
      release: () => {}
    };
  }

  private locks: Map<string, Promise<void>> = new Map();

  private async acquireLock(key: string): Promise<() => void> {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    let resolver: () => void = () => {};
    const promise = new Promise<void>(resolve => {
      resolver = resolve;
    });
    this.locks.set(key, promise);
    return () => {
      this.locks.delete(key);
      resolver();
    };
  }

  private async getOrCreatePeriodId(client: QueryableLedgerClient, orgId: string, projectId: string): Promise<string> {
    const existing = await client.query(
      `SELECT id FROM public.progress_periods WHERE org_id = $1 AND project_id = $2 AND status = 'OPEN' LIMIT 1`,
      [orgId, projectId]
    );
    if (existing.rows.length > 0) {
      return existing.rows[0].id;
    }
    const created = await client.query(
      `INSERT INTO public.progress_periods (org_id, project_id, period_start, period_end, status)
       VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'OPEN')
       RETURNING id`,
      [orgId, projectId]
    );
    return created.rows[0].id;
  }

  public async createWorkProgressLine(input: CreateWorkProgressInput): Promise<WorkProgressLineRecord> {
    const parsedPrincipal = parseMoney(input.principalAmount);
    if (!isPositiveMoney(parsedPrincipal)) {
      const err: any = new Error('Nilai progres harus lebih dari nol.');
      err.statusCode = 400;
      throw err;
    }

    const client = await this.getClient();
    try {
      await client.query('BEGIN');

      // Verify project exists and belongs to orgId
      const projCheck = await client.query(
        `SELECT id, status FROM public.projects WHERE org_id = $1 AND id = $2`,
        [input.orgId, input.projectId]
      );
      if (projCheck.rows.length === 0) {
        const err: any = new Error('Proyek tidak ditemukan.');
        err.statusCode = 404;
        throw err;
      }
      if (projCheck.rows[0].status === 'ARCHIVED') {
        const err: any = new Error('Proyek telah diarsipkan dan tidak dapat menerima mutasi finansial baru.');
        err.statusCode = 400;
        throw err;
      }

      const periodId = input.periodId || (await this.getOrCreatePeriodId(client, input.orgId, input.projectId));

      const query = `
        INSERT INTO public.work_progress_lines (
          org_id,
          project_id,
          period_id,
          description,
          quantity,
          unit,
          principal_amount,
          progress_date,
          evidence_status,
          status,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', NOW(), NOW())
        RETURNING *
      `;
      const res = await client.query(query, [
        input.orgId,
        input.projectId,
        periodId,
        input.description.trim(),
        input.quantity ?? 1,
        input.unit || 'LS',
        parsedPrincipal,
        input.progressDate || new Date().toISOString().split('T')[0],
        input.evidenceStatus || 'VERIFIED'
      ]);

      await client.query('COMMIT');
      const r = res.rows[0];
      const principal = parseMoney(r.principal_amount);
      return {
        id: r.id,
        orgId: r.org_id,
        projectId: r.project_id,
        periodId: r.period_id,
        description: r.description,
        quantity: Number(r.quantity),
        unit: r.unit,
        principalAmount: principal,
        allocatedToMeasurement: '0.00',
        availableAmount: principal,
        progressDate: r.progress_date,
        evidenceStatus: r.evidence_status,
        status: r.status,
        createdAt: new Date(r.created_at).toISOString(),
        updatedAt: new Date(r.updated_at).toISOString()
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async getWorkProgressLines(orgId: string, projectId: string): Promise<WorkProgressLineRecord[]> {
    const query = `
      SELECT 
        wpl.*,
        COALESCE(SUM(ma.allocated_amount), 0) AS allocated_to_measurement
      FROM public.work_progress_lines wpl
      LEFT JOIN public.measurement_allocations ma ON ma.work_progress_line_id = wpl.id
      WHERE wpl.org_id = $1 AND wpl.project_id = $2 AND wpl.status = 'ACTIVE'
      GROUP BY wpl.id
      ORDER BY wpl.created_at ASC
    `;
    const res = await this.pool.query(query, [orgId, projectId]);
    return res.rows.map(r => {
      const principal = parseMoney(r.principal_amount);
      const allocated = parseMoney(r.allocated_to_measurement);
      const available = compareMoney(principal, allocated) > 0 ? subtractMoney(principal, allocated) : '0.00';
      return {
        id: r.id,
        orgId: r.org_id,
        projectId: r.project_id,
        periodId: r.period_id,
        description: r.description,
        quantity: Number(r.quantity),
        unit: r.unit,
        principalAmount: principal,
        allocatedToMeasurement: allocated,
        availableAmount: available,
        progressDate: r.progress_date,
        evidenceStatus: r.evidence_status,
        status: r.status,
        createdAt: new Date(r.created_at).toISOString(),
        updatedAt: new Date(r.updated_at).toISOString()
      };
    });
  }

  public async getWorkProgressLineById(orgId: string, projectId: string, id: string): Promise<WorkProgressLineRecord | null> {
    const query = `
      SELECT 
        wpl.*,
        COALESCE(SUM(ma.allocated_amount), 0) AS allocated_to_measurement
      FROM public.work_progress_lines wpl
      LEFT JOIN public.measurement_allocations ma ON ma.work_progress_line_id = wpl.id
      WHERE wpl.org_id = $1 AND wpl.project_id = $2 AND wpl.id = $3
      GROUP BY wpl.id
    `;
    const res = await this.pool.query(query, [orgId, projectId, id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    const principal = parseMoney(r.principal_amount);
    const allocated = parseMoney(r.allocated_to_measurement);
    const available = compareMoney(principal, allocated) > 0 ? subtractMoney(principal, allocated) : '0.00';
    return {
      id: r.id,
      orgId: r.org_id,
      projectId: r.project_id,
      periodId: r.period_id,
      description: r.description,
      quantity: Number(r.quantity),
      unit: r.unit,
      principalAmount: principal,
      allocatedToMeasurement: allocated,
      availableAmount: available,
      progressDate: r.progress_date,
      evidenceStatus: r.evidence_status,
      status: r.status,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString()
    };
  }

  public async createMeasurement(input: CreateMeasurementInput): Promise<MeasurementRecord> {
    if (!input.allocations || input.allocations.length === 0) {
      const err: any = new Error('Alokasi pengukuran harus memiliki minimal satu item.');
      err.statusCode = 400;
      throw err;
    }

    const releaseFns: (() => void)[] = [];
    for (const alloc of input.allocations) {
      releaseFns.push(await this.acquireLock(`wpl-${alloc.workProgressLineId}`));
    }

    const client = await this.getClient();
    try {
      await client.query('BEGIN');

      // Verify project exists and belongs to orgId
      const projCheck = await client.query(
        `SELECT id, status FROM public.projects WHERE org_id = $1 AND id = $2`,
        [input.orgId, input.projectId]
      );
      if (projCheck.rows.length === 0) {
        const err: any = new Error('Proyek tidak ditemukan.');
        err.statusCode = 404;
        throw err;
      }
      if (projCheck.rows[0].status === 'ARCHIVED') {
        const err: any = new Error('Proyek telah diarsipkan dan tidak dapat menerima mutasi finansial baru.');
        err.statusCode = 400;
        throw err;
      }

      // Check duplicate measurement_number
      const dupCheck = await client.query(
        `SELECT id FROM public.measurements WHERE project_id = $1 AND LOWER(measurement_number) = LOWER($2)`,
        [input.projectId, input.measurementNumber.trim()]
      );
      if (dupCheck.rows.length > 0) {
        const err: any = new Error('Nomor pengukuran sudah digunakan pada proyek ini.');
        err.statusCode = 409;
        throw err;
      }

      // Concurrency protection: Lock each work_progress_line FOR UPDATE and validate capacity
      for (const alloc of input.allocations) {
        const parsedAllocAmount = parseMoney(alloc.amount);
        if (!isPositiveMoney(parsedAllocAmount)) {
          const err: any = new Error('Nilai alokasi harus lebih dari nol.');
          err.statusCode = 400;
          throw err;
        }

        const lineRes = await client.query(
          `SELECT id, org_id, project_id, principal_amount, status
           FROM public.work_progress_lines
           WHERE id = $1 AND org_id = $2 AND project_id = $3
           FOR UPDATE`,
          [alloc.workProgressLineId, input.orgId, input.projectId]
        );
        if (lineRes.rows.length === 0) {
          const err: any = new Error('Record pekerjaan progres tidak ditemukan pada tenant/proyek ini.');
          err.statusCode = 404;
          throw err;
        }
        if (lineRes.rows[0].status !== 'ACTIVE') {
          const err: any = new Error('Record pekerjaan progres tidak aktif.');
          err.statusCode = 400;
          throw err;
        }

        const principal = parseMoney(lineRes.rows[0].principal_amount);
        const existingAllocRes = await client.query(
          `SELECT COALESCE(SUM(allocated_amount), 0) AS total_allocated
           FROM public.measurement_allocations
           WHERE work_progress_line_id = $1`,
          [alloc.workProgressLineId]
        );
        const existingAlloc = parseMoney(existingAllocRes.rows[0].total_allocated);
        const available = compareMoney(principal, existingAlloc) > 0 ? subtractMoney(principal, existingAlloc) : '0.00';

        if (compareMoney(parsedAllocAmount, available) > 0) {
          const err: any = new Error(
            `Alokasi pengukuran (${parsedAllocAmount}) melebihi sisa progres yang tersedia (${available}).`
          );
          err.statusCode = 400;
          throw err;
        }
      }

      // Create measurement
      const measRes = await client.query(
        `INSERT INTO public.measurements (
          org_id,
          project_id,
          measurement_number,
          measurement_date,
          description,
          status,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'VERIFIED', NOW(), NOW())
        RETURNING *`,
        [
          input.orgId,
          input.projectId,
          input.measurementNumber.trim(),
          input.measurementDate || new Date().toISOString().split('T')[0],
          input.description || ''
        ]
      );
      const measurement = measRes.rows[0];

      // Insert allocations
      const allocationRecords: MeasurementAllocationRecord[] = [];
      let totalAllocatedMinor = '0.00';
      for (const alloc of input.allocations) {
        const parsedAmount = parseMoney(alloc.amount);
        const allocRes = await client.query(
          `INSERT INTO public.measurement_allocations (
            work_progress_line_id,
            measurement_id,
            allocated_amount,
            created_at
          ) VALUES ($1, $2, $3, NOW())
          RETURNING *`,
          [alloc.workProgressLineId, measurement.id, parsedAmount]
        );
        const a = allocRes.rows[0];
        const recordAllocated = parseMoney(a.allocated_amount);
        totalAllocatedMinor = addMoney(totalAllocatedMinor, recordAllocated);
        allocationRecords.push({
          id: a.id,
          measurementId: a.measurement_id,
          workProgressLineId: a.work_progress_line_id,
          allocatedAmount: recordAllocated,
          createdAt: new Date(a.created_at).toISOString()
        });
      }

      await client.query('COMMIT');

      return {
        id: measurement.id,
        orgId: measurement.org_id,
        projectId: measurement.project_id,
        measurementNumber: measurement.measurement_number,
        measurementDate: measurement.measurement_date,
        description: measurement.description,
        status: measurement.status,
        totalAllocatedAmount: totalAllocatedMinor,
        allocatedToClaim: '0.00',
        availableAmount: totalAllocatedMinor,
        createdAt: new Date(measurement.created_at).toISOString(),
        updatedAt: new Date(measurement.updated_at).toISOString(),
        allocations: allocationRecords
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
      releaseFns.forEach(fn => fn());
    }
  }

  public async getMeasurements(orgId: string, projectId: string): Promise<MeasurementRecord[]> {
    const query = `
      SELECT 
        m.*,
        COALESCE(SUM(ma.allocated_amount), 0) AS total_allocated,
        COALESCE(
          (SELECT SUM(ca.allocated_amount) FROM public.claim_allocations ca WHERE ca.measurement_id = m.id),
          0
        ) AS allocated_to_claim
      FROM public.measurements m
      LEFT JOIN public.measurement_allocations ma ON ma.measurement_id = m.id
      WHERE m.org_id = $1 AND m.project_id = $2
      GROUP BY m.id
      ORDER BY m.created_at ASC
    `;
    const res = await this.pool.query(query, [orgId, projectId]);
    return res.rows.map(r => {
      const total = parseMoney(r.total_allocated);
      const claimed = parseMoney(r.allocated_to_claim);
      const available = compareMoney(total, claimed) > 0 ? subtractMoney(total, claimed) : '0.00';
      return {
        id: r.id,
        orgId: r.org_id,
        projectId: r.project_id,
        measurementNumber: r.measurement_number,
        measurementDate: r.measurement_date,
        description: r.description || '',
        status: r.status,
        totalAllocatedAmount: total,
        allocatedToClaim: claimed,
        availableAmount: available,
        createdAt: new Date(r.created_at).toISOString(),
        updatedAt: new Date(r.updated_at).toISOString()
      };
    });
  }

  public async getMeasurementById(orgId: string, projectId: string, id: string): Promise<MeasurementRecord | null> {
    const query = `
      SELECT 
        m.*,
        COALESCE(SUM(ma.allocated_amount), 0) AS total_allocated,
        COALESCE(
          (SELECT SUM(ca.allocated_amount) FROM public.claim_allocations ca WHERE ca.measurement_id = m.id),
          0
        ) AS allocated_to_claim
      FROM public.measurements m
      LEFT JOIN public.measurement_allocations ma ON ma.measurement_id = m.id
      WHERE m.org_id = $1 AND m.project_id = $2 AND m.id = $3
      GROUP BY m.id
    `;
    const res = await this.pool.query(query, [orgId, projectId, id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    const total = parseMoney(r.total_allocated);
    const claimed = parseMoney(r.allocated_to_claim);
    const available = compareMoney(total, claimed) > 0 ? subtractMoney(total, claimed) : '0.00';

    const allocRes = await this.pool.query(
      `SELECT * FROM public.measurement_allocations WHERE measurement_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    return {
      id: r.id,
      orgId: r.org_id,
      projectId: r.project_id,
      measurementNumber: r.measurement_number,
      measurementDate: r.measurement_date,
      description: r.description || '',
      status: r.status,
      totalAllocatedAmount: total,
      allocatedToClaim: claimed,
      availableAmount: available,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
      allocations: allocRes.rows.map(a => ({
        id: a.id,
        measurementId: a.measurement_id,
        workProgressLineId: a.work_progress_line_id,
        allocatedAmount: parseMoney(a.allocated_amount),
        createdAt: new Date(a.created_at).toISOString()
      }))
    };
  }

  public async createClaim(input: CreateClaimInput): Promise<ClaimRecord> {
    if (!input.allocations || input.allocations.length === 0) {
      const err: any = new Error('Alokasi klaim harus memiliki minimal satu item.');
      err.statusCode = 400;
      throw err;
    }

    const releaseFns: (() => void)[] = [];
    for (const alloc of input.allocations) {
      releaseFns.push(await this.acquireLock(`meas-${alloc.measurementId}`));
    }

    const client = await this.getClient();
    try {
      await client.query('BEGIN');

      const projCheck = await client.query(
        `SELECT id, status FROM public.projects WHERE org_id = $1 AND id = $2`,
        [input.orgId, input.projectId]
      );
      if (projCheck.rows.length === 0) {
        const err: any = new Error('Proyek tidak ditemukan.');
        err.statusCode = 404;
        throw err;
      }
      if (projCheck.rows[0].status === 'ARCHIVED') {
        const err: any = new Error('Proyek telah diarsipkan dan tidak dapat menerima mutasi finansial baru.');
        err.statusCode = 400;
        throw err;
      }

      const dupCheck = await client.query(
        `SELECT id FROM public.claims WHERE project_id = $1 AND LOWER(claim_number) = LOWER($2)`,
        [input.projectId, input.claimNumber.trim()]
      );
      if (dupCheck.rows.length > 0) {
        const err: any = new Error('Nomor klaim sudah digunakan pada proyek ini.');
        err.statusCode = 409;
        throw err;
      }

      // Concurrency protection: Lock each measurement FOR UPDATE
      for (const alloc of input.allocations) {
        const parsedAllocAmount = parseMoney(alloc.amount);
        if (!isPositiveMoney(parsedAllocAmount)) {
          const err: any = new Error('Nilai alokasi harus lebih dari nol.');
          err.statusCode = 400;
          throw err;
        }

        const measRes = await client.query(
          `SELECT m.id, m.org_id, m.project_id
           FROM public.measurements m
           WHERE m.id = $1 AND m.org_id = $2 AND m.project_id = $3
           FOR UPDATE`,
          [alloc.measurementId, input.orgId, input.projectId]
        );
        if (measRes.rows.length === 0) {
          const err: any = new Error('Record pengukuran tidak ditemukan pada tenant/proyek ini.');
          err.statusCode = 404;
          throw err;
        }

        // Calculate measured capacity
        const measTotalRes = await client.query(
          `SELECT COALESCE(SUM(allocated_amount), 0) AS total_measured
           FROM public.measurement_allocations
           WHERE measurement_id = $1`,
          [alloc.measurementId]
        );
        const measuredTotal = parseMoney(measTotalRes.rows[0].total_measured);

        const existingClaimRes = await client.query(
          `SELECT COALESCE(SUM(allocated_amount), 0) AS total_claimed
           FROM public.claim_allocations
           WHERE measurement_id = $1`,
          [alloc.measurementId]
        );
        const existingClaimed = parseMoney(existingClaimRes.rows[0].total_claimed);
        const available = compareMoney(measuredTotal, existingClaimed) > 0 ? subtractMoney(measuredTotal, existingClaimed) : '0.00';

        if (compareMoney(parsedAllocAmount, available) > 0) {
          const err: any = new Error(
            `Alokasi klaim (${parsedAllocAmount}) melebihi sisa pengukuran yang tersedia (${available}).`
          );
          err.statusCode = 400;
          throw err;
        }
      }

      // Create claim
      const claimRes = await client.query(
        `INSERT INTO public.claims (
          org_id,
          project_id,
          claim_number,
          submitted_at,
          description,
          readiness_status,
          status,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'COMPLETE', 'SUBMITTED', NOW(), NOW())
        RETURNING *`,
        [
          input.orgId,
          input.projectId,
          input.claimNumber.trim(),
          input.submittedAt || new Date().toISOString().split('T')[0],
          input.description || ''
        ]
      );
      const claim = claimRes.rows[0];

      // Insert allocations
      const allocationRecords: ClaimAllocationRecord[] = [];
      let totalAllocatedMinor = '0.00';
      for (const alloc of input.allocations) {
        const parsedAmount = parseMoney(alloc.amount);
        const allocRes = await client.query(
          `INSERT INTO public.claim_allocations (
            measurement_id,
            claim_id,
            allocated_amount,
            created_at
          ) VALUES ($1, $2, $3, NOW())
          RETURNING *`,
          [alloc.measurementId, claim.id, parsedAmount]
        );
        const a = allocRes.rows[0];
        const recordAllocated = parseMoney(a.allocated_amount);
        totalAllocatedMinor = addMoney(totalAllocatedMinor, recordAllocated);
        allocationRecords.push({
          id: a.id,
          claimId: a.claim_id,
          measurementId: a.measurement_id,
          allocatedAmount: recordAllocated,
          createdAt: new Date(a.created_at).toISOString()
        });
      }

      await client.query('COMMIT');

      return {
        id: claim.id,
        orgId: claim.org_id,
        projectId: claim.project_id,
        claimNumber: claim.claim_number,
        submittedAt: claim.submitted_at,
        readinessStatus: claim.readiness_status,
        status: claim.status,
        description: claim.description,
        totalAllocatedAmount: totalAllocatedMinor,
        allocatedToCertification: '0.00',
        availableAmount: totalAllocatedMinor,
        createdAt: new Date(claim.created_at).toISOString(),
        updatedAt: new Date(claim.updated_at).toISOString(),
        allocations: allocationRecords
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
      releaseFns.forEach(fn => fn());
    }
  }

  public async getClaims(orgId: string, projectId: string): Promise<ClaimRecord[]> {
    const query = `
      SELECT 
        c.*,
        COALESCE(SUM(ca.allocated_amount), 0) AS total_allocated,
        COALESCE(
          (SELECT SUM(ka.allocated_amount) FROM public.certification_allocations ka WHERE ka.claim_id = c.id),
          0
        ) AS allocated_to_cert
      FROM public.claims c
      LEFT JOIN public.claim_allocations ca ON ca.claim_id = c.id
      WHERE c.org_id = $1 AND c.project_id = $2
      GROUP BY c.id
      ORDER BY c.created_at ASC
    `;
    const res = await this.pool.query(query, [orgId, projectId]);
    return res.rows.map(r => {
      const total = parseMoney(r.total_allocated);
      const certified = parseMoney(r.allocated_to_cert);
      const available = compareMoney(total, certified) > 0 ? subtractMoney(total, certified) : '0.00';
      return {
        id: r.id,
        orgId: r.org_id,
        projectId: r.project_id,
        claimNumber: r.claim_number,
        submittedAt: r.submitted_at,
        readinessStatus: r.readiness_status,
        status: r.status,
        description: r.description || '',
        totalAllocatedAmount: total,
        allocatedToCertification: certified,
        availableAmount: available,
        createdAt: new Date(r.created_at).toISOString(),
        updatedAt: new Date(r.updated_at).toISOString()
      };
    });
  }

  public async getClaimById(orgId: string, projectId: string, id: string): Promise<ClaimRecord | null> {
    const query = `
      SELECT 
        c.*,
        COALESCE(SUM(ca.allocated_amount), 0) AS total_allocated,
        COALESCE(
          (SELECT SUM(ka.allocated_amount) FROM public.certification_allocations ka WHERE ka.claim_id = c.id),
          0
        ) AS allocated_to_cert
      FROM public.claims c
      LEFT JOIN public.claim_allocations ca ON ca.claim_id = c.id
      WHERE c.org_id = $1 AND c.project_id = $2 AND c.id = $3
      GROUP BY c.id
    `;
    const res = await this.pool.query(query, [orgId, projectId, id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    const total = parseMoney(r.total_allocated);
    const certified = parseMoney(r.allocated_to_cert);
    const available = compareMoney(total, certified) > 0 ? subtractMoney(total, certified) : '0.00';

    const allocRes = await this.pool.query(
      `SELECT * FROM public.claim_allocations WHERE claim_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    return {
      id: r.id,
      orgId: r.org_id,
      projectId: r.project_id,
      claimNumber: r.claim_number,
      submittedAt: r.submitted_at,
      readinessStatus: r.readiness_status,
      status: r.status,
      description: r.description || '',
      totalAllocatedAmount: total,
      allocatedToCertification: certified,
      availableAmount: available,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
      allocations: allocRes.rows.map(a => ({
        id: a.id,
        claimId: a.claim_id,
        measurementId: a.measurement_id,
        allocatedAmount: parseMoney(a.allocated_amount),
        createdAt: new Date(a.created_at).toISOString()
      }))
    };
  }

  public async createCertificate(input: CreateCertificateInput): Promise<CertificateRecord> {
    if (!input.allocations || input.allocations.length === 0) {
      const err: any = new Error('Alokasi sertifikasi harus memiliki minimal satu item.');
      err.statusCode = 400;
      throw err;
    }

    const releaseFns: (() => void)[] = [];
    for (const alloc of input.allocations) {
      releaseFns.push(await this.acquireLock(`claim-${alloc.claimId}`));
    }

    const client = await this.getClient();
    try {
      await client.query('BEGIN');

      const projCheck = await client.query(
        `SELECT id, status FROM public.projects WHERE org_id = $1 AND id = $2`,
        [input.orgId, input.projectId]
      );
      if (projCheck.rows.length === 0) {
        const err: any = new Error('Proyek tidak ditemukan.');
        err.statusCode = 404;
        throw err;
      }
      if (projCheck.rows[0].status === 'ARCHIVED') {
        const err: any = new Error('Proyek telah diarsipkan dan tidak dapat menerima mutasi finansial baru.');
        err.statusCode = 400;
        throw err;
      }

      const dupCheck = await client.query(
        `SELECT id FROM public.certificates WHERE project_id = $1 AND LOWER(certificate_number) = LOWER($2)`,
        [input.projectId, input.certificateNumber.trim()]
      );
      if (dupCheck.rows.length > 0) {
        const err: any = new Error('Nomor sertifikat sudah digunakan pada proyek ini.');
        err.statusCode = 409;
        throw err;
      }

      // Concurrency protection: Lock each claim FOR UPDATE
      for (const alloc of input.allocations) {
        const parsedAllocAmount = parseMoney(alloc.amount);
        if (!isPositiveMoney(parsedAllocAmount)) {
          const err: any = new Error('Nilai alokasi harus lebih dari nol.');
          err.statusCode = 400;
          throw err;
        }

        const claimRes = await client.query(
          `SELECT c.id, c.org_id, c.project_id
           FROM public.claims c
           WHERE c.id = $1 AND c.org_id = $2 AND c.project_id = $3
           FOR UPDATE`,
          [alloc.claimId, input.orgId, input.projectId]
        );
        if (claimRes.rows.length === 0) {
          const err: any = new Error('Record klaim tidak ditemukan pada tenant/proyek ini.');
          err.statusCode = 404;
          throw err;
        }

        const claimTotalRes = await client.query(
          `SELECT COALESCE(SUM(allocated_amount), 0) AS total_claimed
           FROM public.claim_allocations
           WHERE claim_id = $1`,
          [alloc.claimId]
        );
        const claimedTotal = parseMoney(claimTotalRes.rows[0].total_claimed);

        const existingCertRes = await client.query(
          `SELECT COALESCE(SUM(allocated_amount), 0) AS total_certified
           FROM public.certification_allocations
           WHERE claim_id = $1`,
          [alloc.claimId]
        );
        const existingCertified = parseMoney(existingCertRes.rows[0].total_certified);
        const available = compareMoney(claimedTotal, existingCertified) > 0 ? subtractMoney(claimedTotal, existingCertified) : '0.00';

        if (compareMoney(parsedAllocAmount, available) > 0) {
          const err: any = new Error(
            `Alokasi sertifikasi (${parsedAllocAmount}) melebihi sisa klaim yang tersedia (${available}).`
          );
          err.statusCode = 400;
          throw err;
        }
      }

      // Create certificate
      const certRes = await client.query(
        `INSERT INTO public.certificates (
          org_id,
          project_id,
          certificate_number,
          certified_at,
          description,
          status,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'CERTIFIED', NOW(), NOW())
        RETURNING *`,
        [
          input.orgId,
          input.projectId,
          input.certificateNumber.trim(),
          input.certifiedAt || new Date().toISOString().split('T')[0],
          input.description || ''
        ]
      );
      const cert = certRes.rows[0];

      // Insert allocations
      const allocationRecords: CertificationAllocationRecord[] = [];
      let totalAllocatedMinor = '0.00';
      for (const alloc of input.allocations) {
        const parsedAmount = parseMoney(alloc.amount);
        const allocRes = await client.query(
          `INSERT INTO public.certification_allocations (
            claim_id,
            certificate_id,
            allocated_amount,
            created_at
          ) VALUES ($1, $2, $3, NOW())
          RETURNING *`,
          [alloc.claimId, cert.id, parsedAmount]
        );
        const a = allocRes.rows[0];
        const recordAllocated = parseMoney(a.allocated_amount);
        totalAllocatedMinor = addMoney(totalAllocatedMinor, recordAllocated);
        allocationRecords.push({
          id: a.id,
          certificateId: a.certificate_id,
          claimId: a.claim_id,
          allocatedAmount: recordAllocated,
          createdAt: new Date(a.created_at).toISOString()
        });
      }

      await client.query('COMMIT');

      return {
        id: cert.id,
        orgId: cert.org_id,
        projectId: cert.project_id,
        certificateNumber: cert.certificate_number,
        certifiedAt: cert.certified_at,
        status: cert.status,
        description: cert.description,
        totalAllocatedAmount: totalAllocatedMinor,
        createdAt: new Date(cert.created_at).toISOString(),
        updatedAt: new Date(cert.updated_at).toISOString(),
        allocations: allocationRecords
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
      releaseFns.forEach(fn => fn());
    }
  }

  public async getCertificates(orgId: string, projectId: string): Promise<CertificateRecord[]> {
    const query = `
      SELECT 
        k.*,
        COALESCE(SUM(ka.allocated_amount), 0) AS total_allocated
      FROM public.certificates k
      LEFT JOIN public.certification_allocations ka ON ka.certificate_id = k.id
      WHERE k.org_id = $1 AND k.project_id = $2
      GROUP BY k.id
      ORDER BY k.created_at ASC
    `;
    const res = await this.pool.query(query, [orgId, projectId]);
    return res.rows.map(r => ({
      id: r.id,
      orgId: r.org_id,
      projectId: r.project_id,
      certificateNumber: r.certificate_number,
      certifiedAt: r.certified_at,
      status: r.status,
      description: r.description || '',
      totalAllocatedAmount: parseMoney(r.total_allocated),
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString()
    }));
  }

  public async getCertificateById(orgId: string, projectId: string, id: string): Promise<CertificateRecord | null> {
    const query = `
      SELECT 
        k.*,
        COALESCE(SUM(ka.allocated_amount), 0) AS total_allocated
      FROM public.certificates k
      LEFT JOIN public.certification_allocations ka ON ka.certificate_id = k.id
      WHERE k.org_id = $1 AND k.project_id = $2 AND k.id = $3
      GROUP BY k.id
    `;
    const res = await this.pool.query(query, [orgId, projectId, id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    const allocRes = await this.pool.query(
      `SELECT * FROM public.certification_allocations WHERE certificate_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    return {
      id: r.id,
      orgId: r.org_id,
      projectId: r.project_id,
      certificateNumber: r.certificate_number,
      certifiedAt: r.certified_at,
      status: r.status,
      description: r.description || '',
      totalAllocatedAmount: parseMoney(r.total_allocated),
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
      allocations: allocRes.rows.map(a => ({
        id: a.id,
        certificateId: a.certificate_id,
        claimId: a.claim_id,
        allocatedAmount: parseMoney(a.allocated_amount),
        createdAt: new Date(a.created_at).toISOString()
      }))
    };
  }

  public async createProjectInvoice(input: CreateProjectInvoiceInput): Promise<ProjectInvoiceRecord> {
    const invNumber = (input.invoiceNumber || '').trim();
    if (!invNumber) {
      const err: any = new Error('Nomor invoice wajib diisi.');
      err.statusCode = 400;
      throw err;
    }

    if (!input.allocations || input.allocations.length === 0) {
      const err: any = new Error('Sedikitnya satu alokasi sertifikat diperlukan.');
      err.statusCode = 400;
      throw err;
    }

    const proj = await getProjectRepository().getProjectById(input.orgId, input.projectId);
    if (!proj) {
      const err: any = new Error('Proyek tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }
    if (proj.status === 'Diarsipkan') {
      const err: any = new Error('Proyek telah diarsipkan dan tidak dapat menerima mutasi finansial baru.');
      err.statusCode = 400;
      throw err;
    }

    const dupCheck = await this.pool.query(
      `SELECT id FROM public.project_invoices WHERE org_id = $1 AND project_id = $2 AND invoice_number = $3`,
      [input.orgId, input.projectId, invNumber]
    );
    if (dupCheck.rows.length > 0) {
      const err: any = new Error('Nomor invoice sudah digunakan pada proyek ini.');
      err.statusCode = 409;
      throw err;
    }

    const releaseFns: (() => void)[] = [];
    for (const alloc of input.allocations) {
      releaseFns.push(await this.acquireLock(`cert-${alloc.certificateId}`));
    }

    const client = await this.getClient();

    try {
      await client.query('BEGIN');

      let totalPrincipal = '0.00';
      const parsedAllocs: Array<{ certificateId: string; amount: MoneyString }> = [];

      for (const alloc of input.allocations) {
        const parsedAmount = parseMoney(alloc.amount);
        if (!isPositiveMoney(parsedAmount)) {
          const err: any = new Error('Nilai alokasi invoice harus lebih dari nol.');
          err.statusCode = 400;
          throw err;
        }

        const certRes = await client.query(
          `SELECT id, certificate_number FROM public.certificates WHERE id = $1 AND org_id = $2 AND project_id = $3 FOR UPDATE`,
          [alloc.certificateId, input.orgId, input.projectId]
        );
        if (certRes.rows.length === 0) {
          const err: any = new Error(`Sertifikat ${alloc.certificateId} tidak ditemukan.`);
          err.statusCode = 404;
          throw err;
        }

        const certAllocRes = await client.query(
          `SELECT COALESCE(SUM(allocated_amount), 0) AS total_certified FROM public.certification_allocations WHERE certificate_id = $1`,
          [alloc.certificateId]
        );
        const totalCertified = parseMoney(certAllocRes.rows[0]?.total_certified ?? '0');

        const alreadyInvoicedRes = await client.query(
          `SELECT COALESCE(SUM(allocated_amount), 0) AS total_invoiced FROM public.project_invoice_allocations WHERE certificate_id = $1`,
          [alloc.certificateId]
        );
        const alreadyInvoiced = parseMoney(alreadyInvoicedRes.rows[0]?.total_invoiced ?? '0');
        const availableToInvoice = compareMoney(totalCertified, alreadyInvoiced) > 0 ? subtractMoney(totalCertified, alreadyInvoiced) : '0.00';

        if (compareMoney(parsedAmount, availableToInvoice) > 0) {
          const err: any = new Error(`Nilai alokasi invoice (${parsedAmount}) melebihi sisa sertifikat yang belum ditagihkan (${availableToInvoice}).`);
          err.statusCode = 400;
          throw err;
        }

        totalPrincipal = addMoney(totalPrincipal, parsedAmount);
        parsedAllocs.push({ certificateId: alloc.certificateId, amount: parsedAmount });
      }

      const issuedAt = input.issuedAt || new Date().toISOString().split('T')[0];
      const dueAt = input.dueAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const invInsertRes = await client.query(
        `INSERT INTO public.project_invoices (
          org_id,
          project_id,
          invoice_number,
          certificate_reference,
          issued_at,
          due_at,
          currency,
          principal_amount,
          total_payable,
          status,
          description,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'IDR', $7, $7, 'ISSUED', $8, NOW(), NOW())
        RETURNING *`,
        [
          input.orgId,
          input.projectId,
          invNumber,
          input.certificateReference || '',
          issuedAt,
          dueAt,
          totalPrincipal,
          input.description || ''
        ]
      );
      const invRow = invInsertRes.rows[0];

      const createdAllocations: ProjectInvoiceAllocationRecord[] = [];
      for (const alloc of parsedAllocs) {
        const allocInsertRes = await client.query(
          `INSERT INTO public.project_invoice_allocations (
            org_id,
            project_id,
            certificate_id,
            project_invoice_id,
            allocated_principal,
            allocated_amount,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $5, NOW())
          RETURNING *`,
          [
            input.orgId,
            input.projectId,
            alloc.certificateId,
            invRow.id,
            alloc.amount
          ]
        );
        const aRow = allocInsertRes.rows[0];
        createdAllocations.push({
          id: aRow.id,
          projectInvoiceId: aRow.project_invoice_id,
          certificateId: aRow.certificate_id,
          allocatedAmount: parseMoney(aRow.allocated_amount),
          createdAt: new Date(aRow.created_at).toISOString()
        });
      }

      await client.query('COMMIT');

      return {
        id: invRow.id,
        orgId: invRow.org_id,
        projectId: invRow.project_id,
        invoiceNumber: invRow.invoice_number,
        certificateReference: invRow.certificate_reference,
        issuedAt: invRow.issued_at,
        dueAt: invRow.due_at,
        currency: invRow.currency,
        principalAmount: parseMoney(invRow.principal_amount),
        totalPayable: parseMoney(invRow.total_payable || invRow.principal_amount),
        paidAmount: '0.00',
        remainingAmount: parseMoney(invRow.principal_amount),
        status: invRow.status,
        description: invRow.description || '',
        createdAt: new Date(invRow.created_at).toISOString(),
        updatedAt: new Date(invRow.updated_at).toISOString(),
        allocations: createdAllocations
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      releaseFns.forEach(fn => fn());
      client.release();
    }
  }

  public async getProjectInvoices(orgId: string, projectId?: string): Promise<ProjectInvoiceRecord[]> {
    const query = projectId
      ? `
        SELECT 
          pi.*,
          COALESCE(
            (SELECT SUM(ra.allocated_amount)
             FROM public.receipt_allocations ra
             WHERE ra.project_invoice_id = pi.id),
            0
          ) AS total_paid
        FROM public.project_invoices pi
        WHERE pi.org_id = $1 AND pi.project_id = $2
        ORDER BY pi.created_at ASC
      `
      : `
        SELECT 
          pi.*,
          COALESCE(
            (SELECT SUM(ra.allocated_amount)
             FROM public.receipt_allocations ra
             WHERE ra.project_invoice_id = pi.id),
            0
          ) AS total_paid
        FROM public.project_invoices pi
        WHERE pi.org_id = $1
        ORDER BY pi.created_at ASC
      `;
    const params = projectId ? [orgId, projectId] : [orgId];
    const res = await this.pool.query(query, params);
    return res.rows.map(r => {
      const principal = parseMoney(r.principal_amount);
      const paid = parseMoney(r.total_paid);
      const remaining = compareMoney(principal, paid) > 0 ? subtractMoney(principal, paid) : '0.00';
      return {
        id: r.id,
        orgId: r.org_id,
        projectId: r.project_id,
        invoiceNumber: r.invoice_number,
        certificateReference: r.certificate_reference || '',
        issuedAt: r.issued_at,
        dueAt: r.due_at,
        currency: r.currency,
        principalAmount: principal,
        totalPayable: parseMoney(r.total_payable || r.principal_amount),
        paidAmount: paid,
        remainingAmount: remaining,
        status: r.status,
        description: r.description || '',
        createdAt: new Date(r.created_at).toISOString(),
        updatedAt: new Date(r.updated_at).toISOString()
      };
    });
  }

  public async getProjectInvoiceById(orgId: string, projectId: string, id: string): Promise<ProjectInvoiceRecord | null> {
    const query = `
      SELECT 
        pi.*,
        COALESCE(
          (SELECT SUM(ra.allocated_amount)
           FROM public.receipt_allocations ra
           WHERE ra.project_invoice_id = pi.id),
          0
        ) AS total_paid
      FROM public.project_invoices pi
      WHERE pi.org_id = $1 AND pi.project_id = $2 AND pi.id = $3
      GROUP BY pi.id
    `;
    const res = await this.pool.query(query, [orgId, projectId, id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    const allocRes = await this.pool.query(
      `SELECT * FROM public.project_invoice_allocations WHERE project_invoice_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    const principal = parseMoney(r.principal_amount);
    const paid = parseMoney(r.total_paid);
    const remaining = compareMoney(principal, paid) > 0 ? subtractMoney(principal, paid) : '0.00';

    return {
      id: r.id,
      orgId: r.org_id,
      projectId: r.project_id,
      invoiceNumber: r.invoice_number,
      certificateReference: r.certificate_reference || '',
      issuedAt: r.issued_at,
      dueAt: r.due_at,
      currency: r.currency,
      principalAmount: principal,
      totalPayable: parseMoney(r.total_payable || r.principal_amount),
      paidAmount: paid,
      remainingAmount: remaining,
      status: r.status,
      description: r.description || '',
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
      allocations: allocRes.rows.map(a => ({
        id: a.id,
        projectInvoiceId: a.project_invoice_id,
        certificateId: a.certificate_id,
        allocatedAmount: parseMoney(a.allocated_amount),
        createdAt: new Date(a.created_at).toISOString()
      }))
    };
  }

  public async createCashReceipt(input: CreateCashReceiptInput): Promise<CashReceiptRecord> {
    const parsedReceived = parseMoney(input.receivedAmount);
    if (!isPositiveMoney(parsedReceived)) {
      const err: any = new Error('Nilai penerimaan kas harus lebih dari nol.');
      err.statusCode = 400;
      throw err;
    }

    if (!input.allocations || input.allocations.length === 0) {
      const err: any = new Error('Pilih sedikitnya satu alokasi invoice dengan nilai lebih dari nol.');
      err.statusCode = 400;
      throw err;
    }

    const proj = await getProjectRepository().getProjectById(input.orgId, input.projectId);
    if (!proj) {
      const err: any = new Error('Proyek tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }
    if (proj.status === 'Diarsipkan') {
      const err: any = new Error('Proyek telah diarsipkan dan tidak dapat menerima mutasi finansial baru.');
      err.statusCode = 400;
      throw err;
    }

    const idemKey = (input.idempotencyKey || '').trim();
    if (!idemKey) {
      const err: any = new Error('IDEMPOTENCY_KEY_REQUIRED');
      err.statusCode = 400;
      throw err;
    }
    if (idemKey.length > 120) {
      const err: any = new Error('IDEMPOTENCY_KEY_TOO_LONG');
      err.statusCode = 400;
      throw err;
    }

    // Check if a receipt already exists for this (org_id, project_id, idempotency_key)
    const existingRes = await this.pool.query(
      `SELECT * FROM public.cash_receipts WHERE org_id = $1 AND project_id = $2 AND idempotency_key = $3`,
      [input.orgId, input.projectId, idemKey]
    );
    if (existingRes.rows.length > 0) {
      const existingRow = existingRes.rows[0];
      const existingAllocRes = await this.pool.query(
        `SELECT * FROM public.receipt_allocations WHERE cash_receipt_id = $1 ORDER BY created_at ASC`,
        [existingRow.id]
      );

      const existingReceived = parseMoney(existingRow.received_amount);
      const amountMatches = compareMoney(existingReceived, parsedReceived) === 0;

      let allocsMatch = existingAllocRes.rows.length === input.allocations.length;
      if (allocsMatch) {
        for (const alloc of input.allocations) {
          const parsedAllocA = parseMoney(alloc.amount);
          const match = existingAllocRes.rows.find(
            r => r.project_invoice_id === alloc.invoiceId && compareMoney(parseMoney(r.allocated_amount), parsedAllocA) === 0
          );
          if (!match) {
            allocsMatch = false;
            break;
          }
        }
      }

      if (!amountMatches || !allocsMatch) {
        const err: any = new Error('RECEIPT_IDEMPOTENCY_CONFLICT: Kunci idempotensi sudah digunakan dengan data berbeda.');
        err.statusCode = 409;
        throw err;
      }

      let existingAllocTotal = '0.00';
      for (const r of existingAllocRes.rows) {
        existingAllocTotal = addMoney(existingAllocTotal, parseMoney(r.allocated_amount));
      }
      const existingUnallocated = compareMoney(existingReceived, existingAllocTotal) > 0 ? subtractMoney(existingReceived, existingAllocTotal) : '0.00';

      return {
        id: existingRow.id,
        orgId: existingRow.org_id,
        projectId: existingRow.project_id,
        idempotencyKey: existingRow.idempotency_key,
        receiptNumber: existingRow.receipt_number || undefined,
        receivedAt: existingRow.received_at,
        bankReference: existingRow.bank_reference || '',
        currency: existingRow.currency,
        receivedAmount: existingReceived,
        allocatedAmount: existingAllocTotal,
        unallocatedAmount: existingUnallocated,
        settlementStatus: existingRow.settlement_status,
        paymentMethod: existingRow.payment_method,
        description: existingRow.description || '',
        notes: existingRow.notes || undefined,
        createdAt: new Date(existingRow.created_at).toISOString(),
        updatedAt: new Date(existingRow.updated_at).toISOString(),
        allocations: existingAllocRes.rows.map(a => ({
          id: a.id,
          cashReceiptId: a.cash_receipt_id,
          projectInvoiceId: a.project_invoice_id,
          allocatedAmount: parseMoney(a.allocated_amount),
          createdAt: new Date(a.created_at).toISOString()
        }))
      };
    }

    const receiptNumber = (input.receiptNumber || '').trim();
    if (receiptNumber) {
      const dup = await this.pool.query(
        `SELECT id FROM public.cash_receipts WHERE org_id = $1 AND project_id = $2 AND receipt_number = $3`,
        [input.orgId, input.projectId, receiptNumber]
      );
      if (dup.rows.length > 0) {
        const err: any = new Error('Nomor kuitansi sudah digunakan pada proyek ini.');
        err.statusCode = 409;
        throw err;
      }
    }

    const releaseFns: (() => void)[] = [];
    for (const alloc of input.allocations) {
      releaseFns.push(await this.acquireLock(`inv-${alloc.invoiceId}`));
    }

    const client = await this.getClient();

    try {
      await client.query('BEGIN');

      let totalAllocated = '0.00';
      const parsedAllocs: Array<{ invoiceId: string; amount: MoneyString }> = [];

      for (const alloc of input.allocations) {
        const parsedAmount = parseMoney(alloc.amount);
        if (!isPositiveMoney(parsedAmount)) {
          const err: any = new Error('Nilai alokasi kas harus lebih dari nol.');
          err.statusCode = 400;
          throw err;
        }

        const invRes = await client.query(
          `SELECT id, invoice_number, principal_amount, status FROM public.project_invoices WHERE id = $1 AND org_id = $2 AND project_id = $3 FOR UPDATE`,
          [alloc.invoiceId, input.orgId, input.projectId]
        );
        if (invRes.rows.length === 0) {
          const err: any = new Error(`Invoice ID ${alloc.invoiceId} tidak ditemukan pada proyek ini.`);
          err.statusCode = 404;
          throw err;
        }
        const invRow = invRes.rows[0];
        const principal = parseMoney(invRow.principal_amount);

        const paidRes = await client.query(
          `SELECT COALESCE(SUM(allocated_amount), 0) AS total_paid FROM public.receipt_allocations WHERE project_invoice_id = $1`,
          [alloc.invoiceId]
        );
        const alreadyPaid = parseMoney(paidRes.rows[0]?.total_paid ?? '0');
        const remaining = compareMoney(principal, alreadyPaid) > 0 ? subtractMoney(principal, alreadyPaid) : '0.00';

        if (compareMoney(parsedAmount, remaining) > 0) {
          const err: any = new Error(`Alokasi untuk ${invRow.invoice_number} (${parsedAmount}) melebihi sisa pokok (${remaining}).`);
          err.statusCode = 400;
          throw err;
        }

        totalAllocated = addMoney(totalAllocated, parsedAmount);
        parsedAllocs.push({ invoiceId: alloc.invoiceId, amount: parsedAmount });
      }

      if (compareMoney(totalAllocated, parsedReceived) > 0) {
        const err: any = new Error('Total alokasi melebihi total kas yang diterima.');
        err.statusCode = 400;
        throw err;
      }

      const receivedAt = input.receivedAt || new Date().toISOString().split('T')[0];
      const rcptInsertRes = await client.query(
        `INSERT INTO public.cash_receipts (
          org_id,
          project_id,
          idempotency_key,
          receipt_number,
          received_at,
          bank_reference,
          currency,
          received_amount,
          settlement_status,
          payment_method,
          description,
          notes,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'IDR', $7, 'SETTLED', $8, $9, $10, NOW(), NOW())
        RETURNING *`,
        [
          input.orgId,
          input.projectId,
          idemKey,
          receiptNumber || null,
          receivedAt,
          input.bankReference || 'BANK-RCPT-AUTO',
          parsedReceived,
          input.paymentMethod || 'BANK_TRANSFER',
          input.description || '',
          input.notes || ''
        ]
      );
      const rcptRow = rcptInsertRes.rows[0];

      const createdAllocations: ReceiptAllocationRecord[] = [];
      for (const alloc of parsedAllocs) {
        const allocInsertRes = await client.query(
          `INSERT INTO public.receipt_allocations (
            org_id,
            project_id,
            cash_receipt_id,
            project_invoice_id,
            principal_allocated,
            allocated_amount,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $5, NOW())
          RETURNING *`,
          [
            input.orgId,
            input.projectId,
            rcptRow.id,
            alloc.invoiceId,
            alloc.amount
          ]
        );
        const aRow = allocInsertRes.rows[0];
        createdAllocations.push({
          id: aRow.id,
          cashReceiptId: aRow.cash_receipt_id,
          projectInvoiceId: aRow.project_invoice_id,
          allocatedAmount: parseMoney(aRow.allocated_amount),
          createdAt: new Date(aRow.created_at).toISOString()
        });

        const newPaidRes = await client.query(
          `SELECT COALESCE(SUM(allocated_amount), 0) AS total_paid FROM public.receipt_allocations WHERE project_invoice_id = $1`,
          [alloc.invoiceId]
        );
        const newPaid = parseMoney(newPaidRes.rows[0]?.total_paid ?? '0');
        const invInfo = await client.query(
          `SELECT principal_amount FROM public.project_invoices WHERE id = $1`,
          [alloc.invoiceId]
        );
        const invPrincipal = parseMoney(invInfo.rows[0]?.principal_amount ?? '0');
        let newStatus = 'ISSUED';
        if (compareMoney(newPaid, invPrincipal) >= 0) {
          newStatus = 'PAID';
        } else if (compareMoney(newPaid, '0.00') > 0) {
          newStatus = 'PARTIALLY_PAID';
        }
        await client.query(
          `UPDATE public.project_invoices SET status = $1, updated_at = NOW() WHERE id = $2`,
          [newStatus, alloc.invoiceId]
        );
      }

      await client.query('COMMIT');

      const unallocated = subtractMoney(parsedReceived, totalAllocated);

      return {
        id: rcptRow.id,
        orgId: rcptRow.org_id,
        projectId: rcptRow.project_id,
        idempotencyKey: rcptRow.idempotency_key || idemKey,
        receiptNumber: rcptRow.receipt_number || undefined,
        receivedAt: rcptRow.received_at,
        bankReference: rcptRow.bank_reference,
        currency: rcptRow.currency,
        receivedAmount: parseMoney(rcptRow.received_amount),
        allocatedAmount: totalAllocated,
        unallocatedAmount: unallocated,
        settlementStatus: rcptRow.settlement_status,
        paymentMethod: rcptRow.payment_method,
        description: rcptRow.description || '',
        notes: rcptRow.notes || undefined,
        createdAt: new Date(rcptRow.created_at).toISOString(),
        updatedAt: new Date(rcptRow.updated_at).toISOString(),
        allocations: createdAllocations
      };
    } catch (err: any) {
      await client.query('ROLLBACK');

      // Concurrent unique-race handling on idempotency constraint (SQLSTATE 23505)
      if (err?.code === '23505' && (err?.constraint === 'uq_cash_receipts_idempotency' || err?.message?.includes('uq_cash_receipts_idempotency') || err?.message?.includes('idempotency_key'))) {
        const raceRes = await this.pool.query(
          `SELECT * FROM public.cash_receipts WHERE org_id = $1 AND project_id = $2 AND idempotency_key = $3`,
          [input.orgId, input.projectId, idemKey]
        );
        if (raceRes.rows.length > 0) {
          const raceRow = raceRes.rows[0];
          const raceAllocRes = await this.pool.query(
            `SELECT * FROM public.receipt_allocations WHERE cash_receipt_id = $1 ORDER BY created_at ASC`,
            [raceRow.id]
          );

          const raceReceived = parseMoney(raceRow.received_amount);
          const amountMatches = compareMoney(raceReceived, parsedReceived) === 0;

          let allocsMatch = raceAllocRes.rows.length === input.allocations.length;
          if (allocsMatch) {
            for (const alloc of input.allocations) {
              const parsedAllocA = parseMoney(alloc.amount);
              const match = raceAllocRes.rows.find(
                r => r.project_invoice_id === alloc.invoiceId && compareMoney(parseMoney(r.allocated_amount), parsedAllocA) === 0
              );
              if (!match) {
                allocsMatch = false;
                break;
              }
            }
          }

          if (!amountMatches || !allocsMatch) {
            const conflictErr: any = new Error('RECEIPT_IDEMPOTENCY_CONFLICT: Kunci idempotensi sudah digunakan dengan data berbeda.');
            conflictErr.statusCode = 409;
            throw conflictErr;
          }

          let raceAllocTotal = '0.00';
          for (const r of raceAllocRes.rows) {
            raceAllocTotal = addMoney(raceAllocTotal, parseMoney(r.allocated_amount));
          }
          const raceUnallocated = compareMoney(raceReceived, raceAllocTotal) > 0 ? subtractMoney(raceReceived, raceAllocTotal) : '0.00';

          return {
            id: raceRow.id,
            orgId: raceRow.org_id,
            projectId: raceRow.project_id,
            idempotencyKey: raceRow.idempotency_key,
            receiptNumber: raceRow.receipt_number || undefined,
            receivedAt: raceRow.received_at,
            bankReference: raceRow.bank_reference || '',
            currency: raceRow.currency,
            receivedAmount: raceReceived,
            allocatedAmount: raceAllocTotal,
            unallocatedAmount: raceUnallocated,
            settlementStatus: raceRow.settlement_status,
            paymentMethod: raceRow.payment_method,
            description: raceRow.description || '',
            notes: raceRow.notes || undefined,
            createdAt: new Date(raceRow.created_at).toISOString(),
            updatedAt: new Date(raceRow.updated_at).toISOString(),
            allocations: raceAllocRes.rows.map(a => ({
              id: a.id,
              cashReceiptId: a.cash_receipt_id,
              projectInvoiceId: a.project_invoice_id,
              allocatedAmount: parseMoney(a.allocated_amount),
              createdAt: new Date(a.created_at).toISOString()
            }))
          };
        }
      }

      throw err;
    } finally {
      releaseFns.forEach(fn => fn());
      client.release();
    }
  }

  public async getCashReceipts(orgId: string, projectId: string): Promise<CashReceiptRecord[]> {
    const query = `
      SELECT 
        cr.*,
        COALESCE(
          (SELECT SUM(ra.allocated_amount)
           FROM public.receipt_allocations ra
           WHERE ra.cash_receipt_id = cr.id),
          0
        ) AS total_allocated
      FROM public.cash_receipts cr
      WHERE cr.org_id = $1 AND cr.project_id = $2
      ORDER BY cr.created_at ASC
    `;
    const res = await this.pool.query(query, [orgId, projectId]);
    return res.rows.map(r => {
      const received = parseMoney(r.received_amount);
      const allocated = parseMoney(r.total_allocated);
      const unallocated = compareMoney(received, allocated) > 0 ? subtractMoney(received, allocated) : '0.00';
      return {
        id: r.id,
        orgId: r.org_id,
        projectId: r.project_id,
        idempotencyKey: r.idempotency_key || r.id,
        receiptNumber: r.receipt_number || undefined,
        receivedAt: r.received_at,
        bankReference: r.bank_reference || '',
        currency: r.currency,
        receivedAmount: received,
        allocatedAmount: allocated,
        unallocatedAmount: unallocated,
        settlementStatus: r.settlement_status,
        paymentMethod: r.payment_method,
        description: r.description || '',
        notes: r.notes || undefined,
        createdAt: new Date(r.created_at).toISOString(),
        updatedAt: new Date(r.updated_at).toISOString()
      };
    });
  }

  public async getCashReceiptById(orgId: string, projectId: string, id: string): Promise<CashReceiptRecord | null> {
    const query = `
      SELECT 
        cr.*,
        COALESCE(
          (SELECT SUM(ra.allocated_amount)
           FROM public.receipt_allocations ra
           WHERE ra.cash_receipt_id = cr.id),
          0
        ) AS total_allocated
      FROM public.cash_receipts cr
      WHERE cr.org_id = $1 AND cr.project_id = $2 AND cr.id = $3
      GROUP BY cr.id
    `;
    const res = await this.pool.query(query, [orgId, projectId, id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    const allocRes = await this.pool.query(
      `SELECT * FROM public.receipt_allocations WHERE cash_receipt_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    const received = parseMoney(r.received_amount);
    const allocated = parseMoney(r.total_allocated);
    const unallocated = compareMoney(received, allocated) > 0 ? subtractMoney(received, allocated) : '0.00';

    return {
      id: r.id,
      orgId: r.org_id,
      projectId: r.project_id,
      idempotencyKey: r.idempotency_key || r.id,
      receiptNumber: r.receipt_number || undefined,
      receivedAt: r.received_at,
      bankReference: r.bank_reference || '',
      currency: r.currency,
      receivedAmount: received,
      allocatedAmount: allocated,
      unallocatedAmount: unallocated,
      settlementStatus: r.settlement_status,
      paymentMethod: r.payment_method,
      description: r.description || '',
      notes: r.notes || undefined,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
      allocations: allocRes.rows.map(a => ({
        id: a.id,
        cashReceiptId: a.cash_receipt_id,
        projectInvoiceId: a.project_invoice_id,
        allocatedAmount: parseMoney(a.allocated_amount),
        createdAt: new Date(a.created_at).toISOString()
      }))
    };
  }

  public async getLedgerTotals(orgId: string, projectId: string): Promise<LedgerTotals> {
    const query = `
      SELECT
        COALESCE((
          SELECT SUM(principal_amount)
          FROM public.work_progress_lines
          WHERE org_id = $1 AND project_id = $2 AND status = 'ACTIVE'
        ), 0) AS work_performed,
        COALESCE((
          SELECT SUM(ma.allocated_amount)
          FROM public.measurement_allocations ma
          JOIN public.measurements m ON m.id = ma.measurement_id
          WHERE m.org_id = $1 AND m.project_id = $2
        ), 0) AS measured,
        COALESCE((
          SELECT SUM(ca.allocated_amount)
          FROM public.claim_allocations ca
          JOIN public.claims c ON c.id = ca.claim_id
          WHERE c.org_id = $1 AND c.project_id = $2
        ), 0) AS claimed,
        COALESCE((
          SELECT SUM(ka.allocated_amount)
          FROM public.certification_allocations ka
          JOIN public.certificates k ON k.id = ka.certificate_id
          WHERE k.org_id = $1 AND k.project_id = $2
        ), 0) AS certified,
        COALESCE((
          SELECT SUM(pia.allocated_amount)
          FROM public.project_invoice_allocations pia
          JOIN public.project_invoices pi ON pi.id = pia.project_invoice_id
          WHERE pi.org_id = $1 AND pi.project_id = $2
        ), 0) AS invoiced,
        COALESCE((
          SELECT SUM(ra.allocated_amount)
          FROM public.receipt_allocations ra
          JOIN public.cash_receipts cr ON cr.id = ra.cash_receipt_id
          WHERE cr.org_id = $1 AND cr.project_id = $2
        ), 0) AS collected
    `;
    const res = await this.pool.query(query, [orgId, projectId]);
    const row = res.rows[0];
    const w = parseMoney(row.work_performed);
    const m = parseMoney(row.measured);
    const c = parseMoney(row.claimed);
    const s = parseMoney(row.certified);
    const inv = parseMoney(row.invoiced);
    const col = parseMoney(row.collected);

    return {
      workPerformed: w,
      measured: m,
      claimed: c,
      certified: s,
      invoiced: inv,
      collected: col,
      g1: compareMoney(w, m) > 0 ? subtractMoney(w, m) : '0.00',
      g2: compareMoney(m, c) > 0 ? subtractMoney(m, c) : '0.00',
      g3: compareMoney(c, s) > 0 ? subtractMoney(c, s) : '0.00',
      g4: compareMoney(s, inv) > 0 ? subtractMoney(s, inv) : '0.00',
      g5: compareMoney(inv, col) > 0 ? subtractMoney(inv, col) : '0.00'
    };
  }

  public async getLineage(orgId: string, projectId: string): Promise<LineageEntry[]> {
    const query = `
      SELECT
        k.id AS cert_id,
        k.certificate_number,
        ka.allocated_amount AS certified_amount,
        c.id AS claim_id,
        c.claim_number,
        ca.allocated_amount AS claimed_amount,
        m.id AS meas_id,
        m.measurement_number,
        ma.allocated_amount AS measured_amount,
        wpl.id AS wpl_id,
        wpl.description AS progress_desc,
        wpl.principal_amount AS progress_amount,
        pi.id AS inv_id,
        pi.invoice_number,
        pia.allocated_amount AS invoiced_amount,
        cr.id AS rcpt_id,
        cr.receipt_number,
        ra.allocated_amount AS collected_amount
      FROM public.certificates k
      JOIN public.certification_allocations ka ON ka.certificate_id = k.id
      JOIN public.claims c ON c.id = ka.claim_id
      JOIN public.claim_allocations ca ON ca.claim_id = c.id
      JOIN public.measurements m ON m.id = ca.measurement_id
      JOIN public.measurement_allocations ma ON ma.measurement_id = m.id
      JOIN public.work_progress_lines wpl ON wpl.id = ma.work_progress_line_id
      LEFT JOIN public.project_invoice_allocations pia ON pia.certificate_id = k.id
      LEFT JOIN public.project_invoices pi ON pi.id = pia.project_invoice_id
      LEFT JOIN public.receipt_allocations ra ON ra.project_invoice_id = pi.id
      LEFT JOIN public.cash_receipts cr ON cr.id = ra.cash_receipt_id
      WHERE k.org_id = $1 AND k.project_id = $2
      ORDER BY k.created_at ASC, c.created_at ASC, m.created_at ASC
    `;
    const res = await this.pool.query(query, [orgId, projectId]);
    return res.rows.map(r => ({
      certificateId: r.cert_id,
      certificateNumber: r.certificate_number,
      certifiedAmount: parseMoney(r.certified_amount),
      claimId: r.claim_id,
      claimNumber: r.claim_number,
      claimedAmount: parseMoney(r.claimed_amount),
      measurementId: r.meas_id,
      measurementNumber: r.measurement_number,
      measuredAmount: parseMoney(r.measured_amount),
      workProgressLineId: r.wpl_id,
      progressDescription: r.progress_desc,
      progressAmount: parseMoney(r.progress_amount),
      invoiceId: r.inv_id || undefined,
      invoiceNumber: r.invoice_number || undefined,
      invoicedAmount: r.invoiced_amount ? parseMoney(r.invoiced_amount) : undefined,
      receiptId: r.rcpt_id || undefined,
      receiptNumber: r.receipt_number || undefined,
      collectedAmount: r.collected_amount ? parseMoney(r.collected_amount) : undefined
    }));
  }
}

export class InMemoryLedgerRepository implements ILedgerRepository {
  public workProgressLines: WorkProgressLineRecord[] = [];
  public measurements: MeasurementRecord[] = [];
  public measurementAllocations: MeasurementAllocationRecord[] = [];
  public claims: ClaimRecord[] = [];
  public claimAllocations: ClaimAllocationRecord[] = [];
  public certificates: CertificateRecord[] = [];
  public certificationAllocations: CertificationAllocationRecord[] = [];
  public projectInvoices: ProjectInvoiceRecord[] = [];
  public projectInvoiceAllocations: ProjectInvoiceAllocationRecord[] = [];
  public cashReceipts: CashReceiptRecord[] = [];
  public receiptAllocations: ReceiptAllocationRecord[] = [];

  constructor() {
    this.seedDefaults();
  }

  public seedDefaults(): void {
    this.workProgressLines = [];
    this.measurements = [];
    this.measurementAllocations = [];
    this.claims = [];
    this.claimAllocations = [];
    this.certificates = [];
    this.certificationAllocations = [];
    this.projectInvoices = [];
    this.projectInvoiceAllocations = [];
    this.cashReceipts = [];
    this.receiptAllocations = [];

    const seedProjects = [
      { id: 'p1', orgId: 'org-001', code: 'COV-001', values: ['1200000000.00', '1050000000.00', '900000000.00', '750000000.00', '600000000.00', '450000000.00'] },
      { id: 'p2', orgId: 'org-001', code: 'COV-002', values: ['3200000000.00', '2900000000.00', '2700000000.00', '2400000000.00', '2100000000.00', '1600000000.00'] },
      { id: 'p3', orgId: 'org-001', code: 'COV-003', values: ['1800000000.00', '1650000000.00', '1450000000.00', '1250000000.00', '1050000000.00', '800000000.00'] },
      { id: 'p-org2-01', orgId: 'org-002', code: 'EXT-001', values: ['1000000000.00', '800000000.00', '700000000.00', '600000000.00', '500000000.00', '400000000.00'] }
    ];

    for (const sp of seedProjects) {
      const now = new Date().toISOString();
      const wplId = `wpl-seed-${sp.id}`;
      this.workProgressLines.push({
        id: wplId,
        orgId: sp.orgId,
        projectId: sp.id,
        periodId: `period-seed-${sp.id}`,
        description: `Baseline initial work for ${sp.code}`,
        quantity: 1,
        unit: 'LS',
        principalAmount: sp.values[0],
        allocatedToMeasurement: sp.values[1],
        availableAmount: subtractMoney(sp.values[0], sp.values[1]),
        progressDate: '2026-08-01',
        evidenceStatus: 'VERIFIED',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now
      });

      const measId = `meas-seed-${sp.id}`;
      this.measurements.push({
        id: measId,
        orgId: sp.orgId,
        projectId: sp.id,
        measurementNumber: `OPN-${sp.code}-01`,
        measurementDate: '2026-08-10',
        description: `Measurement for ${sp.code}`,
        status: 'VERIFIED',
        totalAllocatedAmount: sp.values[1],
        allocatedToClaim: sp.values[2],
        availableAmount: subtractMoney(sp.values[1], sp.values[2]),
        createdAt: now,
        updatedAt: now
      });

      this.measurementAllocations.push({
        id: `ma-seed-${sp.id}`,
        measurementId: measId,
        workProgressLineId: wplId,
        allocatedAmount: sp.values[1],
        createdAt: now
      });

      const claimId = `claim-seed-${sp.id}`;
      this.claims.push({
        id: claimId,
        orgId: sp.orgId,
        projectId: sp.id,
        claimNumber: `CLM-${sp.code}-01`,
        submittedAt: '2026-08-20',
        readinessStatus: 'COMPLETE',
        status: 'SUBMITTED',
        description: `Claim for ${sp.code}`,
        totalAllocatedAmount: sp.values[2],
        allocatedToCertification: sp.values[3],
        availableAmount: subtractMoney(sp.values[2], sp.values[3]),
        createdAt: now,
        updatedAt: now
      });

      this.claimAllocations.push({
        id: `ca-seed-${sp.id}`,
        claimId: claimId,
        measurementId: measId,
        allocatedAmount: sp.values[2],
        createdAt: now
      });

      const certId = `cert-seed-${sp.id}`;
      this.certificates.push({
        id: certId,
        orgId: sp.orgId,
        projectId: sp.id,
        certificateNumber: `BAP-${sp.code}-01`,
        certifiedAt: '2026-08-30',
        status: 'CERTIFIED',
        description: `Certificate for ${sp.code}`,
        totalAllocatedAmount: sp.values[3],
        createdAt: now,
        updatedAt: now
      });

      this.certificationAllocations.push({
        id: `ka-seed-${sp.id}`,
        certificateId: certId,
        claimId: claimId,
        allocatedAmount: sp.values[3],
        createdAt: now
      });

      if (sp.id === 'p1') {
        const inv1Id = 'i1';
        this.projectInvoices.push({
          id: inv1Id,
          orgId: sp.orgId,
          projectId: sp.id,
          invoiceNumber: 'INV/MRD/2026/003',
          certificateReference: 'BAP-MRD-003',
          issuedAt: '2026-07-20',
          dueAt: '2026-08-19',
          currency: 'IDR',
          principalAmount: '300000000.00',
          totalPayable: '300000000.00',
          paidAmount: '220000000.00',
          remainingAmount: '80000000.00',
          status: 'PARTIALLY_PAID',
          description: 'Invoice 01 for MRD',
          createdAt: now,
          updatedAt: now
        });
        this.projectInvoiceAllocations.push({
          id: 'pia-seed-1',
          projectInvoiceId: inv1Id,
          certificateId: certId,
          allocatedAmount: '300000000.00',
          createdAt: now
        });

        const inv2Id = 'i2';
        this.projectInvoices.push({
          id: inv2Id,
          orgId: sp.orgId,
          projectId: sp.id,
          invoiceNumber: 'INV/MRD/2026/004',
          certificateReference: 'BAP-MRD-004',
          issuedAt: '2026-08-25',
          dueAt: '2026-09-24',
          currency: 'IDR',
          principalAmount: '300000000.00',
          totalPayable: '300000000.00',
          paidAmount: '230000000.00',
          remainingAmount: '70000000.00',
          status: 'PARTIALLY_PAID',
          description: 'Invoice 02 for MRD',
          createdAt: now,
          updatedAt: now
        });
        this.projectInvoiceAllocations.push({
          id: 'pia-seed-2',
          projectInvoiceId: inv2Id,
          certificateId: certId,
          allocatedAmount: '300000000.00',
          createdAt: now
        });

        const rcptId = `rcpt-seed-${sp.id}`;
        this.cashReceipts.push({
          id: rcptId,
          orgId: sp.orgId,
          projectId: sp.id,
          idempotencyKey: rcptId,
          receiptNumber: `RCPT-${sp.code}-01`,
          receivedAt: '2026-09-05',
          bankReference: `BCA-${sp.code}-01`,
          currency: 'IDR',
          receivedAmount: '450000000.00',
          allocatedAmount: '450000000.00',
          unallocatedAmount: '0.00',
          settlementStatus: 'SETTLED',
          paymentMethod: 'BANK_TRANSFER',
          description: `Receipt for ${sp.code}`,
          createdAt: now,
          updatedAt: now
        });
        this.receiptAllocations.push({
          id: 'ra-seed-1',
          cashReceiptId: rcptId,
          projectInvoiceId: inv1Id,
          allocatedAmount: '220000000.00',
          createdAt: now
        });
        this.receiptAllocations.push({
          id: 'ra-seed-2',
          cashReceiptId: rcptId,
          projectInvoiceId: inv2Id,
          allocatedAmount: '230000000.00',
          createdAt: now
        });
      } else if (sp.id === 'p2') {
        const inv3Id = 'i3';
        this.projectInvoices.push({
          id: inv3Id,
          orgId: sp.orgId,
          projectId: sp.id,
          invoiceNumber: 'INV/CKR/2026/006',
          certificateReference: 'BAP-CKR-006',
          issuedAt: '2026-07-18',
          dueAt: '2026-08-17',
          currency: 'IDR',
          principalAmount: '1200000000.00',
          totalPayable: '1200000000.00',
          paidAmount: '900000000.00',
          remainingAmount: '300000000.00',
          status: 'PARTIALLY_PAID',
          description: 'Invoice 01 for CKR',
          createdAt: now,
          updatedAt: now
        });
        this.projectInvoiceAllocations.push({
          id: 'pia-seed-3',
          projectInvoiceId: inv3Id,
          certificateId: certId,
          allocatedAmount: '1200000000.00',
          createdAt: now
        });

        const inv4Id = 'i4';
        this.projectInvoices.push({
          id: inv4Id,
          orgId: sp.orgId,
          projectId: sp.id,
          invoiceNumber: 'INV/CKR/2026/007',
          certificateReference: 'BAP-CKR-007',
          issuedAt: '2026-08-20',
          dueAt: '2026-09-19',
          currency: 'IDR',
          principalAmount: '900000000.00',
          totalPayable: '900000000.00',
          paidAmount: '700000000.00',
          remainingAmount: '200000000.00',
          status: 'PARTIALLY_PAID',
          description: 'Invoice 02 for CKR',
          createdAt: now,
          updatedAt: now
        });
        this.projectInvoiceAllocations.push({
          id: 'pia-seed-4',
          projectInvoiceId: inv4Id,
          certificateId: certId,
          allocatedAmount: '900000000.00',
          createdAt: now
        });

        const rcptId = `rcpt-seed-${sp.id}`;
        this.cashReceipts.push({
          id: rcptId,
          orgId: sp.orgId,
          projectId: sp.id,
          idempotencyKey: `idempotency-${rcptId}`,
          receiptNumber: `RCPT-${sp.code}-01`,
          receivedAt: '2026-09-05',
          bankReference: `BCA-${sp.code}-01`,
          currency: 'IDR',
          receivedAmount: '1600000000.00',
          allocatedAmount: '1600000000.00',
          unallocatedAmount: '0.00',
          settlementStatus: 'SETTLED',
          paymentMethod: 'BANK_TRANSFER',
          description: `Receipt for ${sp.code}`,
          createdAt: now,
          updatedAt: now
        });
        this.receiptAllocations.push({
          id: 'ra-seed-3',
          cashReceiptId: rcptId,
          projectInvoiceId: inv3Id,
          allocatedAmount: '900000000.00',
          createdAt: now
        });
        this.receiptAllocations.push({
          id: 'ra-seed-4',
          cashReceiptId: rcptId,
          projectInvoiceId: inv4Id,
          allocatedAmount: '700000000.00',
          createdAt: now
        });
      } else if (sp.id === 'p3') {
        const inv5Id = 'i5';
        this.projectInvoices.push({
          id: inv5Id,
          orgId: sp.orgId,
          projectId: sp.id,
          invoiceNumber: 'INV/ARN/2026/003',
          certificateReference: 'BAP-ARN-003',
          issuedAt: '2026-07-25',
          dueAt: '2026-08-24',
          currency: 'IDR',
          principalAmount: '600000000.00',
          totalPayable: '600000000.00',
          paidAmount: '450000000.00',
          remainingAmount: '150000000.00',
          status: 'PARTIALLY_PAID',
          description: 'Invoice 01 for ARN',
          createdAt: now,
          updatedAt: now
        });
        this.projectInvoiceAllocations.push({
          id: 'pia-seed-5',
          projectInvoiceId: inv5Id,
          certificateId: certId,
          allocatedAmount: '600000000.00',
          createdAt: now
        });

        const inv6Id = 'i6';
        this.projectInvoices.push({
          id: inv6Id,
          orgId: sp.orgId,
          projectId: sp.id,
          invoiceNumber: 'INV/ARN/2026/004',
          certificateReference: 'BAP-ARN-004',
          issuedAt: '2026-08-20',
          dueAt: '2026-09-19',
          currency: 'IDR',
          principalAmount: '450000000.00',
          totalPayable: '450000000.00',
          paidAmount: '350000000.00',
          remainingAmount: '100000000.00',
          status: 'PARTIALLY_PAID',
          description: 'Invoice 02 for ARN',
          createdAt: now,
          updatedAt: now
        });
        this.projectInvoiceAllocations.push({
          id: 'pia-seed-6',
          projectInvoiceId: inv6Id,
          certificateId: certId,
          allocatedAmount: '450000000.00',
          createdAt: now
        });

        const rcptId = `rcpt-seed-${sp.id}`;
        this.cashReceipts.push({
          id: rcptId,
          orgId: sp.orgId,
          projectId: sp.id,
          idempotencyKey: rcptId,
          receiptNumber: `RCPT-${sp.code}-01`,
          receivedAt: '2026-09-05',
          bankReference: `BCA-${sp.code}-01`,
          currency: 'IDR',
          receivedAmount: '800000000.00',
          allocatedAmount: '800000000.00',
          unallocatedAmount: '0.00',
          settlementStatus: 'SETTLED',
          paymentMethod: 'BANK_TRANSFER',
          description: `Receipt for ${sp.code}`,
          createdAt: now,
          updatedAt: now
        });
        this.receiptAllocations.push({
          id: 'ra-seed-5',
          cashReceiptId: rcptId,
          projectInvoiceId: inv5Id,
          allocatedAmount: '450000000.00',
          createdAt: now
        });
        this.receiptAllocations.push({
          id: 'ra-seed-6',
          cashReceiptId: rcptId,
          projectInvoiceId: inv6Id,
          allocatedAmount: '350000000.00',
          createdAt: now
        });
      } else {
        const invId = `inv-seed-${sp.id}`;
        this.projectInvoices.push({
          id: invId,
          orgId: sp.orgId,
          projectId: sp.id,
          invoiceNumber: `INV-${sp.code}-01`,
          certificateReference: `BAP-${sp.code}-01`,
          issuedAt: '2026-09-01',
          dueAt: '2026-10-01',
          currency: 'IDR',
          principalAmount: sp.values[4],
          totalPayable: sp.values[4],
          paidAmount: sp.values[5],
          remainingAmount: subtractMoney(sp.values[4], sp.values[5]),
          status: compareMoney(sp.values[5], sp.values[4]) >= 0 ? 'PAID' : (compareMoney(sp.values[5], '0.00') > 0 ? 'PARTIALLY_PAID' : 'ISSUED'),
          description: `Invoice for ${sp.code}`,
          createdAt: now,
          updatedAt: now
        });

        this.projectInvoiceAllocations.push({
          id: `pia-seed-${sp.id}`,
          projectInvoiceId: invId,
          certificateId: certId,
          allocatedAmount: sp.values[4],
          createdAt: now
        });

        const rcptId = `rcpt-seed-${sp.id}`;
        this.cashReceipts.push({
          id: rcptId,
          orgId: sp.orgId,
          projectId: sp.id,
          idempotencyKey: `idempotency-${rcptId}`,
          receiptNumber: `RCPT-${sp.code}-01`,
          receivedAt: '2026-09-05',
          bankReference: `BCA-${sp.code}-01`,
          currency: 'IDR',
          receivedAmount: sp.values[5],
          allocatedAmount: sp.values[5],
          unallocatedAmount: '0.00',
          settlementStatus: 'SETTLED',
          paymentMethod: 'BANK_TRANSFER',
          description: `Receipt for ${sp.code}`,
          createdAt: now,
          updatedAt: now
        });

        this.receiptAllocations.push({
          id: `ra-seed-${sp.id}`,
          cashReceiptId: rcptId,
          projectInvoiceId: invId,
          allocatedAmount: sp.values[5],
          createdAt: now
        });
      }
    }
  }

  private locks: Map<string, Promise<void>> = new Map();

  private async acquireLock(key: string): Promise<() => void> {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    let resolver: () => void = () => {};
    const promise = new Promise<void>(resolve => {
      resolver = resolve;
    });
    this.locks.set(key, promise);
    return () => {
      this.locks.delete(key);
      resolver();
    };
  }

  public async createWorkProgressLine(input: CreateWorkProgressInput): Promise<WorkProgressLineRecord> {
    const parsedPrincipal = parseMoney(input.principalAmount);
    if (!isPositiveMoney(parsedPrincipal)) {
      const err: any = new Error('Nilai progres harus lebih dari nol.');
      err.statusCode = 400;
      throw err;
    }
    const proj = await getProjectRepository().getProjectById(input.orgId, input.projectId);
    if (!proj) {
      const err: any = new Error('Proyek tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }
    if (proj.status === 'Diarsipkan') {
      const err: any = new Error('Proyek telah diarsipkan dan tidak dapat menerima mutasi finansial baru.');
      err.statusCode = 400;
      throw err;
    }

    const now = new Date().toISOString();
    const newRecord: WorkProgressLineRecord = {
      id: `wpl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      orgId: input.orgId,
      projectId: input.projectId,
      periodId: input.periodId || `period-${Date.now()}`,
      description: input.description.trim(),
      quantity: input.quantity ?? 1,
      unit: input.unit || 'LS',
      principalAmount: parsedPrincipal,
      allocatedToMeasurement: '0.00',
      availableAmount: parsedPrincipal,
      progressDate: input.progressDate || now.split('T')[0],
      evidenceStatus: input.evidenceStatus || 'VERIFIED',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };
    this.workProgressLines.push(newRecord);
    return { ...newRecord };
  }

  public async getWorkProgressLines(orgId: string, projectId: string): Promise<WorkProgressLineRecord[]> {
    return this.workProgressLines
      .filter(l => l.orgId === orgId && l.projectId === projectId && l.status === 'ACTIVE')
      .map(l => {
        let allocated = '0.00';
        for (const a of this.measurementAllocations) {
          if (a.workProgressLineId === l.id) {
            allocated = addMoney(allocated, a.allocatedAmount);
          }
        }
        const available = compareMoney(l.principalAmount, allocated) > 0 ? subtractMoney(l.principalAmount, allocated) : '0.00';
        return {
          ...l,
          allocatedToMeasurement: allocated,
          availableAmount: available
        };
      });
  }

  public async getWorkProgressLineById(orgId: string, projectId: string, id: string): Promise<WorkProgressLineRecord | null> {
    const found = this.workProgressLines.find(l => l.orgId === orgId && l.projectId === projectId && l.id === id);
    if (!found) return null;
    let allocated = '0.00';
    for (const a of this.measurementAllocations) {
      if (a.workProgressLineId === found.id) {
        allocated = addMoney(allocated, a.allocatedAmount);
      }
    }
    const available = compareMoney(found.principalAmount, allocated) > 0 ? subtractMoney(found.principalAmount, allocated) : '0.00';
    return {
      ...found,
      allocatedToMeasurement: allocated,
      availableAmount: available
    };
  }

  public async createMeasurement(input: CreateMeasurementInput): Promise<MeasurementRecord> {
    if (!input.allocations || input.allocations.length === 0) {
      const err: any = new Error('Alokasi pengukuran harus memiliki minimal satu item.');
      err.statusCode = 400;
      throw err;
    }
    const proj = await getProjectRepository().getProjectById(input.orgId, input.projectId);
    if (!proj) {
      const err: any = new Error('Proyek tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }
    if (proj.status === 'Diarsipkan') {
      const err: any = new Error('Proyek telah diarsipkan dan tidak dapat menerima mutasi finansial baru.');
      err.statusCode = 400;
      throw err;
    }

    if (this.measurements.some(m => m.projectId === input.projectId && m.measurementNumber.toLowerCase() === input.measurementNumber.trim().toLowerCase())) {
      const err: any = new Error('Nomor pengukuran sudah digunakan pada proyek ini.');
      err.statusCode = 409;
      throw err;
    }

    const releaseFns: (() => void)[] = [];
    try {
      for (const alloc of input.allocations) {
        releaseFns.push(await this.acquireLock(`wpl-${alloc.workProgressLineId}`));
        const parsedAllocAmount = parseMoney(alloc.amount);
        if (!isPositiveMoney(parsedAllocAmount)) {
          const err: any = new Error('Nilai alokasi harus lebih dari nol.');
          err.statusCode = 400;
          throw err;
        }
        const line = this.workProgressLines.find(l => l.id === alloc.workProgressLineId && l.orgId === input.orgId && l.projectId === input.projectId);
        if (!line) {
          const err: any = new Error('Record pekerjaan progres tidak ditemukan pada tenant/proyek ini.');
          err.statusCode = 404;
          throw err;
        }
        if (line.status !== 'ACTIVE') {
          const err: any = new Error('Record pekerjaan progres tidak aktif.');
          err.statusCode = 400;
          throw err;
        }
        let alreadyAllocated = '0.00';
        for (const a of this.measurementAllocations) {
          if (a.workProgressLineId === line.id) {
            alreadyAllocated = addMoney(alreadyAllocated, a.allocatedAmount);
          }
        }
        const available = compareMoney(line.principalAmount, alreadyAllocated) > 0 ? subtractMoney(line.principalAmount, alreadyAllocated) : '0.00';
        if (compareMoney(parsedAllocAmount, available) > 0) {
          const err: any = new Error(`Alokasi pengukuran (${parsedAllocAmount}) melebihi sisa progres yang tersedia (${available}).`);
          err.statusCode = 400;
          throw err;
        }
      }

      const now = new Date().toISOString();
      const measId = `meas-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      let totalAllocated = '0.00';
      const createdAllocations: MeasurementAllocationRecord[] = [];
      for (const alloc of input.allocations) {
        const parsedAmount = parseMoney(alloc.amount);
        totalAllocated = addMoney(totalAllocated, parsedAmount);
        const allocRecord: MeasurementAllocationRecord = {
          id: `ma-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          measurementId: measId,
          workProgressLineId: alloc.workProgressLineId,
          allocatedAmount: parsedAmount,
          createdAt: now
        };
        this.measurementAllocations.push(allocRecord);
        createdAllocations.push(allocRecord);
      }

      const newMeas: MeasurementRecord = {
        id: measId,
        orgId: input.orgId,
        projectId: input.projectId,
        measurementNumber: input.measurementNumber.trim(),
        measurementDate: input.measurementDate || now.split('T')[0],
        description: input.description || '',
        status: 'VERIFIED',
        totalAllocatedAmount: totalAllocated,
        allocatedToClaim: '0.00',
        availableAmount: totalAllocated,
        createdAt: now,
        updatedAt: now
      };

      this.measurements.push(newMeas);
      return { ...newMeas, allocations: createdAllocations };
    } finally {
      releaseFns.forEach(fn => fn());
    }
  }

  public async getMeasurements(orgId: string, projectId: string): Promise<MeasurementRecord[]> {
    return this.measurements
      .filter(m => m.orgId === orgId && m.projectId === projectId)
      .map(m => {
        let total = '0.00';
        for (const a of this.measurementAllocations) {
          if (a.measurementId === m.id) total = addMoney(total, a.allocatedAmount);
        }
        let claimed = '0.00';
        for (const ca of this.claimAllocations) {
          if (ca.measurementId === m.id) claimed = addMoney(claimed, ca.allocatedAmount);
        }
        const available = compareMoney(total, claimed) > 0 ? subtractMoney(total, claimed) : '0.00';
        return {
          ...m,
          totalAllocatedAmount: total,
          allocatedToClaim: claimed,
          availableAmount: available
        };
      });
  }

  public async getMeasurementById(orgId: string, projectId: string, id: string): Promise<MeasurementRecord | null> {
    const found = this.measurements.find(m => m.orgId === orgId && m.projectId === projectId && m.id === id);
    if (!found) return null;
    let total = '0.00';
    for (const a of this.measurementAllocations) {
      if (a.measurementId === found.id) total = addMoney(total, a.allocatedAmount);
    }
    let claimed = '0.00';
    for (const ca of this.claimAllocations) {
      if (ca.measurementId === found.id) claimed = addMoney(claimed, ca.allocatedAmount);
    }
    const available = compareMoney(total, claimed) > 0 ? subtractMoney(total, claimed) : '0.00';
    const allocs = this.measurementAllocations.filter(a => a.measurementId === found.id);
    return {
      ...found,
      totalAllocatedAmount: total,
      allocatedToClaim: claimed,
      availableAmount: available,
      allocations: [...allocs]
    };
  }

  public async createClaim(input: CreateClaimInput): Promise<ClaimRecord> {
    if (!input.allocations || input.allocations.length === 0) {
      const err: any = new Error('Alokasi klaim harus memiliki minimal satu item.');
      err.statusCode = 400;
      throw err;
    }
    const proj = await getProjectRepository().getProjectById(input.orgId, input.projectId);
    if (!proj) {
      const err: any = new Error('Proyek tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }
    if (proj.status === 'Diarsipkan') {
      const err: any = new Error('Proyek telah diarsipkan dan tidak dapat menerima mutasi finansial baru.');
      err.statusCode = 400;
      throw err;
    }

    if (this.claims.some(c => c.projectId === input.projectId && c.claimNumber.toLowerCase() === input.claimNumber.trim().toLowerCase())) {
      const err: any = new Error('Nomor klaim sudah digunakan pada proyek ini.');
      err.statusCode = 409;
      throw err;
    }

    const releaseFns: (() => void)[] = [];
    try {
      for (const alloc of input.allocations) {
        releaseFns.push(await this.acquireLock(`meas-${alloc.measurementId}`));
        const parsedAllocAmount = parseMoney(alloc.amount);
        if (!isPositiveMoney(parsedAllocAmount)) {
          const err: any = new Error('Nilai alokasi harus lebih dari nol.');
          err.statusCode = 400;
          throw err;
        }
        const meas = this.measurements.find(m => m.id === alloc.measurementId && m.orgId === input.orgId && m.projectId === input.projectId);
        if (!meas) {
          const err: any = new Error('Record pengukuran tidak ditemukan pada tenant/proyek ini.');
          err.statusCode = 404;
          throw err;
        }
        let measuredTotal = '0.00';
        for (const a of this.measurementAllocations) {
          if (a.measurementId === meas.id) measuredTotal = addMoney(measuredTotal, a.allocatedAmount);
        }
        let existingClaimed = '0.00';
        for (const ca of this.claimAllocations) {
          if (ca.measurementId === meas.id) existingClaimed = addMoney(existingClaimed, ca.allocatedAmount);
        }
        const available = compareMoney(measuredTotal, existingClaimed) > 0 ? subtractMoney(measuredTotal, existingClaimed) : '0.00';
        if (compareMoney(parsedAllocAmount, available) > 0) {
          const err: any = new Error(`Alokasi klaim (${parsedAllocAmount}) melebihi sisa pengukuran yang tersedia (${available}).`);
          err.statusCode = 400;
          throw err;
        }
      }

      const now = new Date().toISOString();
      const claimId = `claim-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      let totalAmount = '0.00';
      const createdAllocations: ClaimAllocationRecord[] = [];
      for (const alloc of input.allocations) {
        const parsedAmount = parseMoney(alloc.amount);
        totalAmount = addMoney(totalAmount, parsedAmount);
        const allocRecord: ClaimAllocationRecord = {
          id: `ca-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          claimId: claimId,
          measurementId: alloc.measurementId,
          allocatedAmount: parsedAmount,
          createdAt: now
        };
        this.claimAllocations.push(allocRecord);
        createdAllocations.push(allocRecord);
      }

      const newClaim: ClaimRecord = {
        id: claimId,
        orgId: input.orgId,
        projectId: input.projectId,
        claimNumber: input.claimNumber.trim(),
        submittedAt: input.submittedAt || now.split('T')[0],
        readinessStatus: 'COMPLETE',
        status: 'SUBMITTED',
        description: input.description || '',
        totalAllocatedAmount: totalAmount,
        allocatedToCertification: '0.00',
        availableAmount: totalAmount,
        createdAt: now,
        updatedAt: now
      };

      this.claims.push(newClaim);
      return { ...newClaim, allocations: createdAllocations };
    } finally {
      releaseFns.forEach(fn => fn());
    }
  }

  public async getClaims(orgId: string, projectId: string): Promise<ClaimRecord[]> {
    return this.claims
      .filter(c => c.orgId === orgId && c.projectId === projectId)
      .map(c => {
        let total = '0.00';
        for (const ca of this.claimAllocations) {
          if (ca.claimId === c.id) total = addMoney(total, ca.allocatedAmount);
        }
        let certified = '0.00';
        for (const ka of this.certificationAllocations) {
          if (ka.claimId === c.id) certified = addMoney(certified, ka.allocatedAmount);
        }
        const available = compareMoney(total, certified) > 0 ? subtractMoney(total, certified) : '0.00';
        return {
          ...c,
          totalAllocatedAmount: total,
          allocatedToCertification: certified,
          availableAmount: available
        };
      });
  }

  public async getClaimById(orgId: string, projectId: string, id: string): Promise<ClaimRecord | null> {
    const found = this.claims.find(c => c.orgId === orgId && c.projectId === projectId && c.id === id);
    if (!found) return null;
    let total = '0.00';
    for (const ca of this.claimAllocations) {
      if (ca.claimId === found.id) total = addMoney(total, ca.allocatedAmount);
    }
    let certified = '0.00';
    for (const ka of this.certificationAllocations) {
      if (ka.claimId === found.id) certified = addMoney(certified, ka.allocatedAmount);
    }
    const available = compareMoney(total, certified) > 0 ? subtractMoney(total, certified) : '0.00';
    const allocs = this.claimAllocations.filter(ca => ca.claimId === found.id);
    return {
      ...found,
      totalAllocatedAmount: total,
      allocatedToCertification: certified,
      availableAmount: available,
      allocations: [...allocs]
    };
  }

  public async createCertificate(input: CreateCertificateInput): Promise<CertificateRecord> {
    if (!input.allocations || input.allocations.length === 0) {
      const err: any = new Error('Alokasi sertifikasi harus memiliki minimal satu item.');
      err.statusCode = 400;
      throw err;
    }
    const proj = await getProjectRepository().getProjectById(input.orgId, input.projectId);
    if (!proj) {
      const err: any = new Error('Proyek tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }
    if (proj.status === 'Diarsipkan') {
      const err: any = new Error('Proyek telah diarsipkan dan tidak dapat menerima mutasi finansial baru.');
      err.statusCode = 400;
      throw err;
    }

    if (this.certificates.some(k => k.projectId === input.projectId && k.certificateNumber.toLowerCase() === input.certificateNumber.trim().toLowerCase())) {
      const err: any = new Error('Nomor sertifikat sudah digunakan pada proyek ini.');
      err.statusCode = 409;
      throw err;
    }

    const releaseFns: (() => void)[] = [];
    try {
      for (const alloc of input.allocations) {
        releaseFns.push(await this.acquireLock(`claim-${alloc.claimId}`));
        const parsedAllocAmount = parseMoney(alloc.amount);
        if (!isPositiveMoney(parsedAllocAmount)) {
          const err: any = new Error('Nilai alokasi harus lebih dari nol.');
          err.statusCode = 400;
          throw err;
        }
        const claim = this.claims.find(c => c.id === alloc.claimId && c.orgId === input.orgId && c.projectId === input.projectId);
        if (!claim) {
          const err: any = new Error('Record klaim tidak ditemukan pada tenant/proyek ini.');
          err.statusCode = 404;
          throw err;
        }
        let claimedTotal = '0.00';
        for (const ca of this.claimAllocations) {
          if (ca.claimId === claim.id) claimedTotal = addMoney(claimedTotal, ca.allocatedAmount);
        }
        let existingCertified = '0.00';
        for (const ka of this.certificationAllocations) {
          if (ka.claimId === claim.id) existingCertified = addMoney(existingCertified, ka.allocatedAmount);
        }
        const available = compareMoney(claimedTotal, existingCertified) > 0 ? subtractMoney(claimedTotal, existingCertified) : '0.00';
        if (compareMoney(parsedAllocAmount, available) > 0) {
          const err: any = new Error(`Alokasi sertifikasi (${parsedAllocAmount}) melebihi sisa klaim yang tersedia (${available}).`);
          err.statusCode = 400;
          throw err;
        }
      }

      const now = new Date().toISOString();
      const certId = `cert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      let totalAmount = '0.00';
      const createdAllocations: CertificationAllocationRecord[] = [];
      for (const alloc of input.allocations) {
        const parsedAmount = parseMoney(alloc.amount);
        totalAmount = addMoney(totalAmount, parsedAmount);
        const allocRecord: CertificationAllocationRecord = {
          id: `ka-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          certificateId: certId,
          claimId: alloc.claimId,
          allocatedAmount: parsedAmount,
          createdAt: now
        };
        this.certificationAllocations.push(allocRecord);
        createdAllocations.push(allocRecord);
      }

      const newCert: CertificateRecord = {
        id: certId,
        orgId: input.orgId,
        projectId: input.projectId,
        certificateNumber: input.certificateNumber.trim(),
        certifiedAt: input.certifiedAt || now.split('T')[0],
        status: 'CERTIFIED',
        description: input.description || '',
        totalAllocatedAmount: totalAmount,
        createdAt: now,
        updatedAt: now
      };

      this.certificates.push(newCert);
      return { ...newCert, allocations: createdAllocations };
    } finally {
      releaseFns.forEach(fn => fn());
    }
  }

  public async getCertificates(orgId: string, projectId: string): Promise<CertificateRecord[]> {
    return this.certificates
      .filter(k => k.orgId === orgId && k.projectId === projectId)
      .map(k => {
        let total = '0.00';
        for (const ka of this.certificationAllocations) {
          if (ka.certificateId === k.id) total = addMoney(total, ka.allocatedAmount);
        }
        return {
          ...k,
          totalAllocatedAmount: total
        };
      });
  }

  public async getCertificateById(orgId: string, projectId: string, id: string): Promise<CertificateRecord | null> {
    const found = this.certificates.find(k => k.orgId === orgId && k.projectId === projectId && k.id === id);
    if (!found) return null;
    let total = '0.00';
    for (const ka of this.certificationAllocations) {
      if (ka.certificateId === found.id) total = addMoney(total, ka.allocatedAmount);
    }
    const allocs = this.certificationAllocations.filter(ka => ka.certificateId === found.id);
    return {
      ...found,
      totalAllocatedAmount: total,
      allocations: [...allocs]
    };
  }

  public async createProjectInvoice(input: CreateProjectInvoiceInput): Promise<ProjectInvoiceRecord> {
    const invNumber = (input.invoiceNumber || '').trim();
    if (!invNumber) {
      const err: any = new Error('Nomor invoice wajib diisi.');
      err.statusCode = 400;
      throw err;
    }

    if (!input.allocations || input.allocations.length === 0) {
      const err: any = new Error('Sedikitnya satu alokasi sertifikat diperlukan.');
      err.statusCode = 400;
      throw err;
    }

    const proj = await getProjectRepository().getProjectById(input.orgId, input.projectId);
    if (!proj) {
      const err: any = new Error('Proyek tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }
    if (proj.status === 'Diarsipkan') {
      const err: any = new Error('Proyek telah diarsipkan dan tidak dapat menerima mutasi finansial baru.');
      err.statusCode = 400;
      throw err;
    }

    const dup = this.projectInvoices.find(i => i.orgId === input.orgId && i.projectId === input.projectId && i.invoiceNumber === invNumber);
    if (dup) {
      const err: any = new Error('Nomor invoice sudah digunakan pada proyek ini.');
      err.statusCode = 409;
      throw err;
    }

    const releaseFns: Array<() => void> = [];
    try {
      let totalPrincipal = '0.00';
      const parsedAllocs: Array<{ certificateId: string; amount: MoneyString }> = [];

      for (const alloc of input.allocations) {
        const parsedAmount = parseMoney(alloc.amount);
        if (!isPositiveMoney(parsedAmount)) {
          const err: any = new Error('Nilai alokasi invoice harus lebih dari nol.');
          err.statusCode = 400;
          throw err;
        }

        releaseFns.push(await this.acquireLock(`cert-${alloc.certificateId}`));

        const cert = this.certificates.find(c => c.orgId === input.orgId && c.projectId === input.projectId && c.id === alloc.certificateId);
        if (!cert) {
          const err: any = new Error(`Sertifikat ${alloc.certificateId} tidak ditemukan.`);
          err.statusCode = 404;
          throw err;
        }

        let certAllocated = '0.00';
        for (const ka of this.certificationAllocations) {
          if (ka.certificateId === alloc.certificateId) {
            certAllocated = addMoney(certAllocated, ka.allocatedAmount);
          }
        }

        let alreadyInvoiced = '0.00';
        for (const pia of this.projectInvoiceAllocations) {
          if (pia.certificateId === alloc.certificateId) {
            alreadyInvoiced = addMoney(alreadyInvoiced, pia.allocatedAmount);
          }
        }

        const available = compareMoney(certAllocated, alreadyInvoiced) > 0 ? subtractMoney(certAllocated, alreadyInvoiced) : '0.00';
        if (compareMoney(parsedAmount, available) > 0) {
          const err: any = new Error(`Nilai alokasi invoice (${parsedAmount}) melebihi sisa sertifikat yang belum ditagihkan (${available}).`);
          err.statusCode = 400;
          throw err;
        }

        totalPrincipal = addMoney(totalPrincipal, parsedAmount);
        parsedAllocs.push({ certificateId: alloc.certificateId, amount: parsedAmount });
      }

      const now = new Date().toISOString();
      const issuedAt = input.issuedAt || now.split('T')[0];
      const dueAt = input.dueAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const invId = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newInvoice: ProjectInvoiceRecord = {
        id: invId,
        orgId: input.orgId,
        projectId: input.projectId,
        invoiceNumber: invNumber,
        certificateReference: input.certificateReference || '',
        issuedAt,
        dueAt,
        currency: 'IDR',
        principalAmount: totalPrincipal,
        totalPayable: totalPrincipal,
        paidAmount: '0.00',
        remainingAmount: totalPrincipal,
        status: 'ISSUED',
        description: input.description || '',
        createdAt: now,
        updatedAt: now
      };

      const createdAllocations: ProjectInvoiceAllocationRecord[] = [];
      for (const alloc of parsedAllocs) {
        const allocId = `pia-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newAlloc: ProjectInvoiceAllocationRecord = {
          id: allocId,
          projectInvoiceId: invId,
          certificateId: alloc.certificateId,
          allocatedAmount: alloc.amount,
          createdAt: now
        };
        this.projectInvoiceAllocations.push(newAlloc);
        createdAllocations.push(newAlloc);
      }

      this.projectInvoices.push(newInvoice);

      const dbProj = db.projects.find(p => p.id === input.projectId);
      if (dbProj && dbProj.values) {
        dbProj.values[4] = (dbProj.values[4] || 0) + Number(totalPrincipal);
      }

      return { ...newInvoice, allocations: createdAllocations };
    } finally {
      releaseFns.forEach(fn => fn());
    }
  }

  public async getProjectInvoices(orgId: string, projectId?: string): Promise<ProjectInvoiceRecord[]> {
    return this.projectInvoices
      .filter(i => i.orgId === orgId && (!projectId || i.projectId === projectId))
      .map(i => {
        let paid = '0.00';
        for (const ra of this.receiptAllocations) {
          if (ra.projectInvoiceId === i.id) {
            paid = addMoney(paid, ra.allocatedAmount);
          }
        }
        const remaining = compareMoney(i.principalAmount, paid) > 0 ? subtractMoney(i.principalAmount, paid) : '0.00';
        let status = i.status;
        if (compareMoney(paid, i.principalAmount) >= 0) {
          status = 'PAID';
        } else if (compareMoney(paid, '0.00') > 0) {
          status = 'PARTIALLY_PAID';
        }
        return {
          ...i,
          paidAmount: paid,
          remainingAmount: remaining,
          status
        };
      });
  }

  public async getProjectInvoiceById(orgId: string, projectId: string, id: string): Promise<ProjectInvoiceRecord | null> {
    const found = this.projectInvoices.find(i => i.orgId === orgId && i.projectId === projectId && i.id === id);
    if (!found) return null;

    let paid = '0.00';
    for (const ra of this.receiptAllocations) {
      if (ra.projectInvoiceId === found.id) {
        paid = addMoney(paid, ra.allocatedAmount);
      }
    }
    const remaining = compareMoney(found.principalAmount, paid) > 0 ? subtractMoney(found.principalAmount, paid) : '0.00';
    let status = found.status;
    if (compareMoney(paid, found.principalAmount) >= 0) {
      status = 'PAID';
    } else if (compareMoney(paid, '0.00') > 0) {
      status = 'PARTIALLY_PAID';
    }

    const allocs = this.projectInvoiceAllocations.filter(pia => pia.projectInvoiceId === found.id);
    return {
      ...found,
      paidAmount: paid,
      remainingAmount: remaining,
      status,
      allocations: [...allocs]
    };
  }

  public async createCashReceipt(input: CreateCashReceiptInput): Promise<CashReceiptRecord> {
    const parsedReceived = parseMoney(input.receivedAmount);
    if (!isPositiveMoney(parsedReceived)) {
      const err: any = new Error('Nilai penerimaan kas harus lebih dari nol.');
      err.statusCode = 400;
      throw err;
    }

    if (!input.allocations || input.allocations.length === 0) {
      const err: any = new Error('Pilih sedikitnya satu alokasi invoice dengan nilai lebih dari nol.');
      err.statusCode = 400;
      throw err;
    }

    const proj = await getProjectRepository().getProjectById(input.orgId, input.projectId);
    if (!proj) {
      const err: any = new Error('Proyek tidak ditemukan.');
      err.statusCode = 404;
      throw err;
    }
    if (proj.status === 'Diarsipkan') {
      const err: any = new Error('Proyek telah diarsipkan dan tidak dapat menerima mutasi finansial baru.');
      err.statusCode = 400;
      throw err;
    }

    const idemKey = (input.idempotencyKey || '').trim();
    if (!idemKey) {
      const err: any = new Error('IDEMPOTENCY_KEY_REQUIRED');
      err.statusCode = 400;
      throw err;
    }
    if (idemKey.length > 120) {
      const err: any = new Error('IDEMPOTENCY_KEY_TOO_LONG');
      err.statusCode = 400;
      throw err;
    }

    const existing = this.cashReceipts.find(
      r => r.orgId === input.orgId && r.projectId === input.projectId && r.idempotencyKey === idemKey
    );
    if (existing) {
      const existingAllocs = this.receiptAllocations.filter(ra => ra.cashReceiptId === existing.id);
      const amountMatches = compareMoney(existing.receivedAmount, parsedReceived) === 0;

      let allocsMatch = existingAllocs.length === input.allocations.length;
      if (allocsMatch) {
        for (const alloc of input.allocations) {
          const parsedAllocA = parseMoney(alloc.amount);
          const match = existingAllocs.find(
            ra => (ra.projectInvoiceId === alloc.invoiceId || ra.projectInvoiceId === this.projectInvoices.find(i => i.invoiceNumber === alloc.invoiceId)?.id) && compareMoney(ra.allocatedAmount, parsedAllocA) === 0
          );
          if (!match) {
            allocsMatch = false;
            break;
          }
        }
      }

      if (!amountMatches || !allocsMatch) {
        const err: any = new Error('RECEIPT_IDEMPOTENCY_CONFLICT: Kunci idempotensi sudah digunakan dengan data berbeda.');
        err.statusCode = 409;
        throw err;
      }

      return {
        ...existing,
        allocations: existingAllocs.map(a => ({ ...a }))
      };
    }

    const rcptNumber = (input.receiptNumber || '').trim();
    if (rcptNumber) {
      const dup = this.cashReceipts.find(r => r.orgId === input.orgId && r.projectId === input.projectId && r.receiptNumber === rcptNumber);
      if (dup) {
        const err: any = new Error('Nomor kuitansi sudah digunakan pada proyek ini.');
        err.statusCode = 409;
        throw err;
      }
    }

    const releaseFns: Array<() => void> = [];
    try {
      let totalAllocated = '0.00';
      const parsedAllocs: Array<{ invoiceId: string; amount: MoneyString }> = [];

      for (const alloc of input.allocations) {
        const parsedAmount = parseMoney(alloc.amount);
        if (!isPositiveMoney(parsedAmount)) {
          const err: any = new Error('Nilai alokasi kas harus lebih dari nol.');
          err.statusCode = 400;
          throw err;
        }

        releaseFns.push(await this.acquireLock(`inv-${alloc.invoiceId}`));

        let inv = this.projectInvoices.find(i => i.orgId === input.orgId && i.projectId === input.projectId && (i.id === alloc.invoiceId || i.invoiceNumber === alloc.invoiceId));
        if (!inv) {
          const legacyInv = db.invoices.find(i => (i.orgId === input.orgId || !i.orgId) && i.projectId === input.projectId && (i.id === alloc.invoiceId || i.number === alloc.invoiceId));
          if (legacyInv) {
            const createdInv: ProjectInvoiceRecord = {
              id: legacyInv.id,
              orgId: input.orgId,
              projectId: input.projectId,
              invoiceNumber: legacyInv.number,
              certificateReference: legacyInv.certificate || '',
              issuedAt: legacyInv.issued || (legacyInv as any).date || new Date().toISOString().split('T')[0],
              dueAt: legacyInv.due || (legacyInv as any).dueDate || new Date().toISOString().split('T')[0],
              currency: 'IDR',
              principalAmount: parseMoney(legacyInv.principal),
              totalPayable: parseMoney(legacyInv.principal),
              paidAmount: parseMoney(legacyInv.paid),
              remainingAmount: parseMoney(legacyInv.principal - legacyInv.paid),
              status: (legacyInv.principal - legacyInv.paid) <= 0 ? 'PAID' : (legacyInv.paid > 0 ? 'PARTIALLY_PAID' : 'ISSUED'),
              description: '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            this.projectInvoices.push(createdInv);
            inv = createdInv;
          }
        }
        if (!inv) {
          const err: any = new Error(`Invoice ID ${alloc.invoiceId} tidak ditemukan pada proyek ini.`);
          err.statusCode = 404;
          throw err;
        }
        const resolvedInvoiceId = inv.id;

        let alreadyPaid = '0.00';
        for (const ra of this.receiptAllocations) {
          if (ra.projectInvoiceId === alloc.invoiceId) {
            alreadyPaid = addMoney(alreadyPaid, ra.allocatedAmount);
          }
        }

        const remaining = compareMoney(inv.principalAmount, alreadyPaid) > 0 ? subtractMoney(inv.principalAmount, alreadyPaid) : '0.00';
        if (compareMoney(parsedAmount, remaining) > 0) {
          const err: any = new Error(`Alokasi untuk ${inv.invoiceNumber} (${parsedAmount}) melebihi sisa pokok (${remaining}).`);
          err.statusCode = 400;
          throw err;
        }

        totalAllocated = addMoney(totalAllocated, parsedAmount);
        parsedAllocs.push({ invoiceId: resolvedInvoiceId, amount: parsedAmount });
      }

      if (compareMoney(totalAllocated, parsedReceived) > 0) {
        const err: any = new Error('Total alokasi melebihi total kas yang diterima.');
        err.statusCode = 400;
        throw err;
      }

      const now = new Date().toISOString();
      const receivedAt = input.receivedAt || now.split('T')[0];
      const rcptId = `rcpt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const unallocated = subtractMoney(parsedReceived, totalAllocated);
      const newReceipt: CashReceiptRecord = {
        id: rcptId,
        orgId: input.orgId,
        projectId: input.projectId,
        idempotencyKey: idemKey,
        receiptNumber: rcptNumber || undefined,
        receivedAt,
        bankReference: input.bankReference || 'BANK-RCPT-AUTO',
        currency: 'IDR',
        receivedAmount: parsedReceived,
        allocatedAmount: totalAllocated,
        unallocatedAmount: unallocated,
        settlementStatus: 'SETTLED',
        paymentMethod: input.paymentMethod || 'BANK_TRANSFER',
        description: input.description || '',
        notes: input.notes || undefined,
        createdAt: now,
        updatedAt: now
      };

      const createdAllocations: ReceiptAllocationRecord[] = [];
      for (const alloc of parsedAllocs) {
        const allocId = `ra-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newAlloc: ReceiptAllocationRecord = {
          id: allocId,
          cashReceiptId: rcptId,
          projectInvoiceId: alloc.invoiceId,
          allocatedAmount: alloc.amount,
          createdAt: now
        };
        this.receiptAllocations.push(newAlloc);
        createdAllocations.push(newAlloc);

        // Update invoice in memory
        const inv = this.projectInvoices.find(i => i.id === alloc.invoiceId || i.invoiceNumber === alloc.invoiceId);
        if (inv) {
          inv.paidAmount = addMoney(inv.paidAmount, alloc.amount);
          inv.remainingAmount = subtractMoney(inv.principalAmount, inv.paidAmount);
          if (compareMoney(inv.paidAmount, inv.principalAmount) >= 0) {
            inv.status = 'PAID';
          } else if (compareMoney(inv.paidAmount, '0.00') > 0) {
            inv.status = 'PARTIALLY_PAID';
          }
          inv.updatedAt = now;
        }

        // Also update db.invoices if present
        const dbInv = db.invoices.find(i => i.id === alloc.invoiceId || i.number === alloc.invoiceId);
        if (dbInv) {
          dbInv.paid = (dbInv.paid || 0) + Number(alloc.amount);
        }
      }

      const dbProj = db.projects.find(p => p.id === input.projectId);
      if (dbProj && dbProj.values) {
        dbProj.values[5] = (dbProj.values[5] || 0) + Number(totalAllocated);
      }

      this.cashReceipts.push(newReceipt);
      return { ...newReceipt, allocations: createdAllocations };
    } finally {
      releaseFns.forEach(fn => fn());
    }
  }

  public async getCashReceipts(orgId: string, projectId: string): Promise<CashReceiptRecord[]> {
    return this.cashReceipts
      .filter(r => r.orgId === orgId && r.projectId === projectId)
      .map(r => {
        let totalAllocated = '0.00';
        for (const ra of this.receiptAllocations) {
          if (ra.cashReceiptId === r.id) {
            totalAllocated = addMoney(totalAllocated, ra.allocatedAmount);
          }
        }
        const unallocated = compareMoney(r.receivedAmount, totalAllocated) > 0 ? subtractMoney(r.receivedAmount, totalAllocated) : '0.00';
        return {
          ...r,
          allocatedAmount: totalAllocated,
          unallocatedAmount: unallocated
        };
      });
  }

  public async getCashReceiptById(orgId: string, projectId: string, id: string): Promise<CashReceiptRecord | null> {
    const found = this.cashReceipts.find(r => r.orgId === orgId && r.projectId === projectId && r.id === id);
    if (!found) return null;

    let totalAllocated = '0.00';
    for (const ra of this.receiptAllocations) {
      if (ra.cashReceiptId === found.id) {
        totalAllocated = addMoney(totalAllocated, ra.allocatedAmount);
      }
    }
    const unallocated = compareMoney(found.receivedAmount, totalAllocated) > 0 ? subtractMoney(found.receivedAmount, totalAllocated) : '0.00';
    const allocs = this.receiptAllocations.filter(ra => ra.cashReceiptId === found.id);
    return {
      ...found,
      allocatedAmount: totalAllocated,
      unallocatedAmount: unallocated,
      allocations: [...allocs]
    };
  }

  public async getLedgerTotals(orgId: string, projectId: string): Promise<LedgerTotals> {
    let w = '0.00';
    for (const l of this.workProgressLines) {
      if (l.orgId === orgId && l.projectId === projectId && l.status === 'ACTIVE') {
        w = addMoney(w, l.principalAmount);
      }
    }

    const projectMeasIds = new Set(this.measurements.filter(m => m.orgId === orgId && m.projectId === projectId).map(m => m.id));
    let m = '0.00';
    for (const ma of this.measurementAllocations) {
      if (projectMeasIds.has(ma.measurementId)) {
        m = addMoney(m, ma.allocatedAmount);
      }
    }

    const projectClaimIds = new Set(this.claims.filter(c => c.orgId === orgId && c.projectId === projectId).map(c => c.id));
    let c = '0.00';
    for (const ca of this.claimAllocations) {
      if (projectClaimIds.has(ca.claimId)) {
        c = addMoney(c, ca.allocatedAmount);
      }
    }

    const projectCertIds = new Set(this.certificates.filter(k => k.orgId === orgId && k.projectId === projectId).map(k => k.id));
    let s = '0.00';
    for (const ka of this.certificationAllocations) {
      if (projectCertIds.has(ka.certificateId)) {
        s = addMoney(s, ka.allocatedAmount);
      }
    }

    const projectInvIds = new Set(this.projectInvoices.filter(i => i.orgId === orgId && i.projectId === projectId).map(i => i.id));
    let invoiced = '0.00';
    for (const pia of this.projectInvoiceAllocations) {
      if (projectInvIds.has(pia.projectInvoiceId)) {
        invoiced = addMoney(invoiced, pia.allocatedAmount);
      }
    }

    const projectRcptIds = new Set(this.cashReceipts.filter(r => r.orgId === orgId && r.projectId === projectId).map(r => r.id));
    let collected = '0.00';
    for (const ra of this.receiptAllocations) {
      if (projectRcptIds.has(ra.cashReceiptId)) {
        collected = addMoney(collected, ra.allocatedAmount);
      }
    }

    return {
      workPerformed: w,
      measured: m,
      claimed: c,
      certified: s,
      invoiced: invoiced,
      collected: collected,
      g1: compareMoney(w, m) > 0 ? subtractMoney(w, m) : '0.00',
      g2: compareMoney(m, c) > 0 ? subtractMoney(m, c) : '0.00',
      g3: compareMoney(c, s) > 0 ? subtractMoney(c, s) : '0.00',
      g4: compareMoney(s, invoiced) > 0 ? subtractMoney(s, invoiced) : '0.00',
      g5: compareMoney(invoiced, collected) > 0 ? subtractMoney(invoiced, collected) : '0.00'
    };
  }

  public async getLineage(orgId: string, projectId: string): Promise<LineageEntry[]> {
    const certs = this.certificates.filter(k => k.orgId === orgId && k.projectId === projectId);
    const entries: LineageEntry[] = [];

    for (const cert of certs) {
      const certAllocs = this.certificationAllocations.filter(ka => ka.certificateId === cert.id);
      for (const certAlloc of certAllocs) {
        const claim = this.claims.find(c => c.id === certAlloc.claimId);
        if (!claim) continue;
        const claimAllocs = this.claimAllocations.filter(ca => ca.claimId === claim.id);
        for (const claimAlloc of claimAllocs) {
          const meas = this.measurements.find(m => m.id === claimAlloc.measurementId);
          if (!meas) continue;
          const measAllocs = this.measurementAllocations.filter(ma => ma.measurementId === meas.id);
          for (const measAlloc of measAllocs) {
            const wpl = this.workProgressLines.find(l => l.id === measAlloc.workProgressLineId);
            if (!wpl) continue;

            const invAlloc = this.projectInvoiceAllocations.find(pia => pia.certificateId === cert.id);
            const inv = invAlloc ? this.projectInvoices.find(i => i.id === invAlloc.projectInvoiceId) : undefined;
            const rcptAlloc = inv ? this.receiptAllocations.find(ra => ra.projectInvoiceId === inv.id) : undefined;
            const rcpt = rcptAlloc ? this.cashReceipts.find(r => r.id === rcptAlloc.cashReceiptId) : undefined;

            entries.push({
              certificateId: cert.id,
              certificateNumber: cert.certificateNumber,
              certifiedAmount: certAlloc.allocatedAmount,
              claimId: claim.id,
              claimNumber: claim.claimNumber,
              claimedAmount: claimAlloc.allocatedAmount,
              measurementId: meas.id,
              measurementNumber: meas.measurementNumber,
              measuredAmount: measAlloc.allocatedAmount,
              workProgressLineId: wpl.id,
              progressDescription: wpl.description,
              progressAmount: wpl.principalAmount,
              invoiceId: inv?.id,
              invoiceNumber: inv?.invoiceNumber,
              invoicedAmount: invAlloc?.allocatedAmount,
              receiptId: rcpt?.id,
              receiptNumber: rcpt?.receiptNumber,
              collectedAmount: rcptAlloc?.allocatedAmount
            });
          }
        }
      }
    }
    return entries;
  }
}

// Global active ledger repository
let customLedgerRepositorySet = false;
let currentLedgerRepository: ILedgerRepository =
  process.env.NODE_ENV === 'test'
    ? new InMemoryLedgerRepository()
    : new PostgresLedgerRepository();

export function getLedgerRepository(): ILedgerRepository {
  if (!customLedgerRepositorySet && process.env.NODE_ENV === 'test' && currentLedgerRepository instanceof PostgresLedgerRepository) {
    currentLedgerRepository = new InMemoryLedgerRepository();
  }
  return currentLedgerRepository;
}

export function setLedgerRepository(repo: ILedgerRepository): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('CRITICAL SECURITY VIOLATION: Custom ledger repository can only be configured in test environment (NODE_ENV=test).');
  }
  currentLedgerRepository = repo;
  customLedgerRepositorySet = true;
}

