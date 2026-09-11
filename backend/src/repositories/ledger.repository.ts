// ============================================================================
// COVE Backend — Canonical Progress-to-Cash Ledger Repository (Gate P0-B.2)
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §3, §5, §7
// Replaces DataStore/JSON authority with canonical PostgreSQL persistence.
// Enforces stage lineage: Work Progress -> Measurement -> Claim -> Certificate
// ============================================================================

import pg from 'pg';
import {pgPool} from '../db/store.js';
import {getProjectRepository} from './project.repository.js';

export interface WorkProgressLineRecord {
  id: string;
  orgId: string;
  projectId: string;
  periodId: string;
  description: string;
  quantity: number;
  unit: string;
  principalAmount: number;
  allocatedToMeasurement: number;
  availableAmount: number;
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
  allocatedAmount: number;
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
  totalAllocatedAmount: number;
  allocatedToClaim: number;
  availableAmount: number;
  createdAt: string;
  updatedAt: string;
  allocations?: MeasurementAllocationRecord[];
}

export interface ClaimAllocationRecord {
  id: string;
  claimId: string;
  measurementId: string;
  allocatedAmount: number;
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
  totalAllocatedAmount: number;
  allocatedToCertification: number;
  availableAmount: number;
  createdAt: string;
  updatedAt: string;
  allocations?: ClaimAllocationRecord[];
}

export interface CertificationAllocationRecord {
  id: string;
  certificateId: string;
  claimId: string;
  allocatedAmount: number;
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
  totalAllocatedAmount: number;
  createdAt: string;
  updatedAt: string;
  allocations?: CertificationAllocationRecord[];
}

export interface LedgerTotals {
  workPerformed: number;
  measured: number;
  claimed: number;
  certified: number;
  g1: number;
  g2: number;
  g3: number;
}

export interface LineageEntry {
  certificateId: string;
  certificateNumber: string;
  certifiedAmount: number;
  claimId: string;
  claimNumber: string;
  claimedAmount: number;
  measurementId: string;
  measurementNumber: string;
  measuredAmount: number;
  workProgressLineId: string;
  progressDescription: string;
  progressAmount: number;
}

export interface CreateWorkProgressInput {
  orgId: string;
  projectId: string;
  description: string;
  principalAmount: number;
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
    amount: number;
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
    amount: number;
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
    amount: number;
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
    if (input.principalAmount <= 0) {
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
        input.principalAmount,
        input.progressDate || new Date().toISOString().split('T')[0],
        input.evidenceStatus || 'VERIFIED'
      ]);

      await client.query('COMMIT');
      const r = res.rows[0];
      return {
        id: r.id,
        orgId: r.org_id,
        projectId: r.project_id,
        periodId: r.period_id,
        description: r.description,
        quantity: Number(r.quantity),
        unit: r.unit,
        principalAmount: Number(r.principal_amount),
        allocatedToMeasurement: 0,
        availableAmount: Number(r.principal_amount),
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
      const principal = Number(r.principal_amount);
      const allocated = Number(r.allocated_to_measurement);
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
        availableAmount: Math.max(0, principal - allocated),
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
    const principal = Number(r.principal_amount);
    const allocated = Number(r.allocated_to_measurement);
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
      availableAmount: Math.max(0, principal - allocated),
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
        if (alloc.amount <= 0) {
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

        const principal = Number(lineRes.rows[0].principal_amount);
        const existingAllocRes = await client.query(
          `SELECT COALESCE(SUM(allocated_amount), 0) AS total_allocated
           FROM public.measurement_allocations
           WHERE work_progress_line_id = $1`,
          [alloc.workProgressLineId]
        );
        const existingAlloc = Number(existingAllocRes.rows[0].total_allocated);
        const available = principal - existingAlloc;

        if (alloc.amount > available) {
          const err: any = new Error(
            `Alokasi pengukuran (${alloc.amount}) melebihi sisa progres yang tersedia (${available}).`
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
      for (const alloc of input.allocations) {
        const allocRes = await client.query(
          `INSERT INTO public.measurement_allocations (
            work_progress_line_id,
            measurement_id,
            allocated_amount,
            created_at
          ) VALUES ($1, $2, $3, NOW())
          RETURNING *`,
          [alloc.workProgressLineId, measurement.id, alloc.amount]
        );
        const a = allocRes.rows[0];
        allocationRecords.push({
          id: a.id,
          measurementId: a.measurement_id,
          workProgressLineId: a.work_progress_line_id,
          allocatedAmount: Number(a.allocated_amount),
          createdAt: new Date(a.created_at).toISOString()
        });
      }

      await client.query('COMMIT');

      const totalAllocated = allocationRecords.reduce((sum, a) => sum + a.allocatedAmount, 0);
      return {
        id: measurement.id,
        orgId: measurement.org_id,
        projectId: measurement.project_id,
        measurementNumber: measurement.measurement_number,
        measurementDate: measurement.measurement_date,
        description: measurement.description,
        status: measurement.status,
        totalAllocatedAmount: totalAllocated,
        allocatedToClaim: 0,
        availableAmount: totalAllocated,
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
      const total = Number(r.total_allocated);
      const claimed = Number(r.allocated_to_claim);
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
        availableAmount: Math.max(0, total - claimed),
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
    const total = Number(r.total_allocated);
    const claimed = Number(r.allocated_to_claim);

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
      availableAmount: Math.max(0, total - claimed),
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
      allocations: allocRes.rows.map(a => ({
        id: a.id,
        measurementId: a.measurement_id,
        workProgressLineId: a.work_progress_line_id,
        allocatedAmount: Number(a.allocated_amount),
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
        if (alloc.amount <= 0) {
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
        const measuredTotal = Number(measTotalRes.rows[0].total_measured);

        const existingClaimRes = await client.query(
          `SELECT COALESCE(SUM(allocated_amount), 0) AS total_claimed
           FROM public.claim_allocations
           WHERE measurement_id = $1`,
          [alloc.measurementId]
        );
        const existingClaimed = Number(existingClaimRes.rows[0].total_claimed);
        const available = measuredTotal - existingClaimed;

        if (alloc.amount > available) {
          const err: any = new Error(
            `Alokasi klaim (${alloc.amount}) melebihi sisa pengukuran yang tersedia (${available}).`
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
      for (const alloc of input.allocations) {
        const allocRes = await client.query(
          `INSERT INTO public.claim_allocations (
            measurement_id,
            claim_id,
            allocated_amount,
            created_at
          ) VALUES ($1, $2, $3, NOW())
          RETURNING *`,
          [alloc.measurementId, claim.id, alloc.amount]
        );
        const a = allocRes.rows[0];
        allocationRecords.push({
          id: a.id,
          claimId: a.claim_id,
          measurementId: a.measurement_id,
          allocatedAmount: Number(a.allocated_amount),
          createdAt: new Date(a.created_at).toISOString()
        });
      }

      await client.query('COMMIT');

      const totalAllocated = allocationRecords.reduce((sum, a) => sum + a.allocatedAmount, 0);
      return {
        id: claim.id,
        orgId: claim.org_id,
        projectId: claim.project_id,
        claimNumber: claim.claim_number,
        submittedAt: claim.submitted_at,
        readinessStatus: claim.readiness_status,
        status: claim.status,
        description: claim.description,
        totalAllocatedAmount: totalAllocated,
        allocatedToCertification: 0,
        availableAmount: totalAllocated,
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
      const total = Number(r.total_allocated);
      const certified = Number(r.allocated_to_cert);
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
        availableAmount: Math.max(0, total - certified),
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
    const total = Number(r.total_allocated);
    const certified = Number(r.allocated_to_cert);

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
      availableAmount: Math.max(0, total - certified),
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
      allocations: allocRes.rows.map(a => ({
        id: a.id,
        claimId: a.claim_id,
        measurementId: a.measurement_id,
        allocatedAmount: Number(a.allocated_amount),
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
        if (alloc.amount <= 0) {
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
        const claimedTotal = Number(claimTotalRes.rows[0].total_claimed);

        const existingCertRes = await client.query(
          `SELECT COALESCE(SUM(allocated_amount), 0) AS total_certified
           FROM public.certification_allocations
           WHERE claim_id = $1`,
          [alloc.claimId]
        );
        const existingCertified = Number(existingCertRes.rows[0].total_certified);
        const available = claimedTotal - existingCertified;

        if (alloc.amount > available) {
          const err: any = new Error(
            `Alokasi sertifikasi (${alloc.amount}) melebihi sisa klaim yang tersedia (${available}).`
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
      for (const alloc of input.allocations) {
        const allocRes = await client.query(
          `INSERT INTO public.certification_allocations (
            claim_id,
            certificate_id,
            allocated_amount,
            created_at
          ) VALUES ($1, $2, $3, NOW())
          RETURNING *`,
          [alloc.claimId, cert.id, alloc.amount]
        );
        const a = allocRes.rows[0];
        allocationRecords.push({
          id: a.id,
          certificateId: a.certificate_id,
          claimId: a.claim_id,
          allocatedAmount: Number(a.allocated_amount),
          createdAt: new Date(a.created_at).toISOString()
        });
      }

      await client.query('COMMIT');

      const totalAllocated = allocationRecords.reduce((sum, a) => sum + a.allocatedAmount, 0);
      return {
        id: cert.id,
        orgId: cert.org_id,
        projectId: cert.project_id,
        certificateNumber: cert.certificate_number,
        certifiedAt: cert.certified_at,
        status: cert.status,
        description: cert.description,
        totalAllocatedAmount: totalAllocated,
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
      totalAllocatedAmount: Number(r.total_allocated),
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
      totalAllocatedAmount: Number(r.total_allocated),
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
      allocations: allocRes.rows.map(a => ({
        id: a.id,
        certificateId: a.certificate_id,
        claimId: a.claim_id,
        allocatedAmount: Number(a.allocated_amount),
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
        ), 0) AS certified
    `;
    const res = await this.pool.query(query, [orgId, projectId]);
    const row = res.rows[0];
    const w = Number(row.work_performed);
    const m = Number(row.measured);
    const c = Number(row.claimed);
    const s = Number(row.certified);

    return {
      workPerformed: w,
      measured: m,
      claimed: c,
      certified: s,
      g1: Math.max(0, w - m),
      g2: Math.max(0, m - c),
      g3: Math.max(0, c - s)
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
        wpl.principal_amount AS progress_amount
      FROM public.certificates k
      JOIN public.certification_allocations ka ON ka.certificate_id = k.id
      JOIN public.claims c ON c.id = ka.claim_id
      JOIN public.claim_allocations ca ON ca.claim_id = c.id
      JOIN public.measurements m ON m.id = ca.measurement_id
      JOIN public.measurement_allocations ma ON ma.measurement_id = m.id
      JOIN public.work_progress_lines wpl ON wpl.id = ma.work_progress_line_id
      WHERE k.org_id = $1 AND k.project_id = $2
      ORDER BY k.created_at ASC, c.created_at ASC, m.created_at ASC
    `;
    const res = await this.pool.query(query, [orgId, projectId]);
    return res.rows.map(r => ({
      certificateId: r.cert_id,
      certificateNumber: r.certificate_number,
      certifiedAmount: Number(r.certified_amount),
      claimId: r.claim_id,
      claimNumber: r.claim_number,
      claimedAmount: Number(r.claimed_amount),
      measurementId: r.meas_id,
      measurementNumber: r.measurement_number,
      measuredAmount: Number(r.measured_amount),
      workProgressLineId: r.wpl_id,
      progressDescription: r.progress_desc,
      progressAmount: Number(r.progress_amount)
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

  constructor() {
    this.seedDefaults();
  }

  public seedDefaults(): void {
    const seedProjects = [
      { id: 'p1', orgId: 'org-001', code: 'COV-001', values: [1200000000, 1050000000, 900000000, 750000000] },
      { id: 'p2', orgId: 'org-001', code: 'COV-002', values: [3200000000, 2900000000, 2700000000, 2400000000] },
      { id: 'p3', orgId: 'org-001', code: 'COV-003', values: [1800000000, 1650000000, 1450000000, 1250000000] },
      { id: 'p-org2-01', orgId: 'org-002', code: 'EXT-001', values: [1000000000, 800000000, 700000000, 600000000] }
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
        availableAmount: sp.values[0] - sp.values[1],
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
        availableAmount: sp.values[1] - sp.values[2],
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
        availableAmount: sp.values[2] - sp.values[3],
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
    if (input.principalAmount <= 0) {
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
      principalAmount: input.principalAmount,
      allocatedToMeasurement: 0,
      availableAmount: input.principalAmount,
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
        const allocated = this.measurementAllocations
          .filter(a => a.workProgressLineId === l.id)
          .reduce((sum, a) => sum + a.allocatedAmount, 0);
        return {
          ...l,
          allocatedToMeasurement: allocated,
          availableAmount: Math.max(0, l.principalAmount - allocated)
        };
      });
  }

  public async getWorkProgressLineById(orgId: string, projectId: string, id: string): Promise<WorkProgressLineRecord | null> {
    const found = this.workProgressLines.find(l => l.orgId === orgId && l.projectId === projectId && l.id === id);
    if (!found) return null;
    const allocated = this.measurementAllocations
      .filter(a => a.workProgressLineId === found.id)
      .reduce((sum, a) => sum + a.allocatedAmount, 0);
    return {
      ...found,
      allocatedToMeasurement: allocated,
      availableAmount: Math.max(0, found.principalAmount - allocated)
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
        if (alloc.amount <= 0) {
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
        const alreadyAllocated = this.measurementAllocations
          .filter(a => a.workProgressLineId === line.id)
          .reduce((sum, a) => sum + a.allocatedAmount, 0);
        const available = line.principalAmount - alreadyAllocated;
        if (alloc.amount > available) {
          const err: any = new Error(`Alokasi pengukuran (${alloc.amount}) melebihi sisa progres yang tersedia (${available}).`);
          err.statusCode = 400;
          throw err;
        }
      }

      const now = new Date().toISOString();
      const measId = `meas-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newMeas: MeasurementRecord = {
        id: measId,
        orgId: input.orgId,
        projectId: input.projectId,
        measurementNumber: input.measurementNumber.trim(),
        measurementDate: input.measurementDate || now.split('T')[0],
        description: input.description || '',
        status: 'VERIFIED',
        totalAllocatedAmount: input.allocations.reduce((s, a) => s + a.amount, 0),
        allocatedToClaim: 0,
        availableAmount: input.allocations.reduce((s, a) => s + a.amount, 0),
        createdAt: now,
        updatedAt: now
      };

      const createdAllocations: MeasurementAllocationRecord[] = [];
      for (const alloc of input.allocations) {
        const allocRecord: MeasurementAllocationRecord = {
          id: `ma-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          measurementId: measId,
          workProgressLineId: alloc.workProgressLineId,
          allocatedAmount: alloc.amount,
          createdAt: now
        };
        this.measurementAllocations.push(allocRecord);
        createdAllocations.push(allocRecord);
      }

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
        const total = this.measurementAllocations
          .filter(a => a.measurementId === m.id)
          .reduce((s, a) => s + a.allocatedAmount, 0);
        const claimed = this.claimAllocations
          .filter(ca => ca.measurementId === m.id)
          .reduce((s, ca) => s + ca.allocatedAmount, 0);
        return {
          ...m,
          totalAllocatedAmount: total,
          allocatedToClaim: claimed,
          availableAmount: Math.max(0, total - claimed)
        };
      });
  }

  public async getMeasurementById(orgId: string, projectId: string, id: string): Promise<MeasurementRecord | null> {
    const found = this.measurements.find(m => m.orgId === orgId && m.projectId === projectId && m.id === id);
    if (!found) return null;
    const total = this.measurementAllocations
      .filter(a => a.measurementId === found.id)
      .reduce((s, a) => s + a.allocatedAmount, 0);
    const claimed = this.claimAllocations
      .filter(ca => ca.measurementId === found.id)
      .reduce((s, ca) => s + ca.allocatedAmount, 0);
    const allocs = this.measurementAllocations.filter(a => a.measurementId === found.id);
    return {
      ...found,
      totalAllocatedAmount: total,
      allocatedToClaim: claimed,
      availableAmount: Math.max(0, total - claimed),
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
        if (alloc.amount <= 0) {
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
        const measuredTotal = this.measurementAllocations
          .filter(a => a.measurementId === meas.id)
          .reduce((s, a) => s + a.allocatedAmount, 0);
        const existingClaimed = this.claimAllocations
          .filter(ca => ca.measurementId === meas.id)
          .reduce((s, ca) => s + ca.allocatedAmount, 0);
        const available = measuredTotal - existingClaimed;
        if (alloc.amount > available) {
          const err: any = new Error(`Alokasi klaim (${alloc.amount}) melebihi sisa pengukuran yang tersedia (${available}).`);
          err.statusCode = 400;
          throw err;
        }
      }

      const now = new Date().toISOString();
      const claimId = `claim-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const totalAmount = input.allocations.reduce((s, a) => s + a.amount, 0);
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
        allocatedToCertification: 0,
        availableAmount: totalAmount,
        createdAt: now,
        updatedAt: now
      };

      const createdAllocations: ClaimAllocationRecord[] = [];
      for (const alloc of input.allocations) {
        const allocRecord: ClaimAllocationRecord = {
          id: `ca-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          claimId: claimId,
          measurementId: alloc.measurementId,
          allocatedAmount: alloc.amount,
          createdAt: now
        };
        this.claimAllocations.push(allocRecord);
        createdAllocations.push(allocRecord);
      }

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
        const total = this.claimAllocations
          .filter(ca => ca.claimId === c.id)
          .reduce((s, ca) => s + ca.allocatedAmount, 0);
        const certified = this.certificationAllocations
          .filter(ka => ka.claimId === c.id)
          .reduce((s, ka) => s + ka.allocatedAmount, 0);
        return {
          ...c,
          totalAllocatedAmount: total,
          allocatedToCertification: certified,
          availableAmount: Math.max(0, total - certified)
        };
      });
  }

  public async getClaimById(orgId: string, projectId: string, id: string): Promise<ClaimRecord | null> {
    const found = this.claims.find(c => c.orgId === orgId && c.projectId === projectId && c.id === id);
    if (!found) return null;
    const total = this.claimAllocations
      .filter(ca => ca.claimId === found.id)
      .reduce((s, ca) => s + ca.allocatedAmount, 0);
    const certified = this.certificationAllocations
      .filter(ka => ka.claimId === found.id)
      .reduce((s, ka) => s + ka.allocatedAmount, 0);
    const allocs = this.claimAllocations.filter(ca => ca.claimId === found.id);
    return {
      ...found,
      totalAllocatedAmount: total,
      allocatedToCertification: certified,
      availableAmount: Math.max(0, total - certified),
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
        if (alloc.amount <= 0) {
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
        const claimedTotal = this.claimAllocations
          .filter(ca => ca.claimId === claim.id)
          .reduce((s, ca) => s + ca.allocatedAmount, 0);
        const existingCertified = this.certificationAllocations
          .filter(ka => ka.claimId === claim.id)
          .reduce((s, ka) => s + ka.allocatedAmount, 0);
        const available = claimedTotal - existingCertified;
        if (alloc.amount > available) {
          const err: any = new Error(`Alokasi sertifikasi (${alloc.amount}) melebihi sisa klaim yang tersedia (${available}).`);
          err.statusCode = 400;
          throw err;
        }
      }

      const now = new Date().toISOString();
      const certId = `cert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const totalAmount = input.allocations.reduce((s, a) => s + a.amount, 0);
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

      const createdAllocations: CertificationAllocationRecord[] = [];
      for (const alloc of input.allocations) {
        const allocRecord: CertificationAllocationRecord = {
          id: `ka-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          certificateId: certId,
          claimId: alloc.claimId,
          allocatedAmount: alloc.amount,
          createdAt: now
        };
        this.certificationAllocations.push(allocRecord);
        createdAllocations.push(allocRecord);
      }

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
        const total = this.certificationAllocations
          .filter(ka => ka.certificateId === k.id)
          .reduce((s, ka) => s + ka.allocatedAmount, 0);
        return {
          ...k,
          totalAllocatedAmount: total
        };
      });
  }

  public async getCertificateById(orgId: string, projectId: string, id: string): Promise<CertificateRecord | null> {
    const found = this.certificates.find(k => k.orgId === orgId && k.projectId === projectId && k.id === id);
    if (!found) return null;
    const total = this.certificationAllocations
      .filter(ka => ka.certificateId === found.id)
      .reduce((s, ka) => s + ka.allocatedAmount, 0);
    const allocs = this.certificationAllocations.filter(ka => ka.certificateId === found.id);
    return {
      ...found,
      totalAllocatedAmount: total,
      allocations: [...allocs]
    };
  }

  public async getLedgerTotals(orgId: string, projectId: string): Promise<LedgerTotals> {
    const w = this.workProgressLines
      .filter(l => l.orgId === orgId && l.projectId === projectId && l.status === 'ACTIVE')
      .reduce((s, l) => s + l.principalAmount, 0);

    const projectMeasIds = new Set(this.measurements.filter(m => m.orgId === orgId && m.projectId === projectId).map(m => m.id));
    const m = this.measurementAllocations
      .filter(ma => projectMeasIds.has(ma.measurementId))
      .reduce((s, ma) => s + ma.allocatedAmount, 0);

    const projectClaimIds = new Set(this.claims.filter(c => c.orgId === orgId && c.projectId === projectId).map(c => c.id));
    const c = this.claimAllocations
      .filter(ca => projectClaimIds.has(ca.claimId))
      .reduce((s, ca) => s + ca.allocatedAmount, 0);

    const projectCertIds = new Set(this.certificates.filter(k => k.orgId === orgId && k.projectId === projectId).map(k => k.id));
    const s = this.certificationAllocations
      .filter(ka => projectCertIds.has(ka.certificateId))
      .reduce((acc, ka) => acc + ka.allocatedAmount, 0);

    return {
      workPerformed: w,
      measured: m,
      claimed: c,
      certified: s,
      g1: Math.max(0, w - m),
      g2: Math.max(0, m - c),
      g3: Math.max(0, c - s)
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
              progressAmount: wpl.principalAmount
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

