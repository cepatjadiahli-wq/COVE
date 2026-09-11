// ============================================================================
// COVE Backend — Canonical Project Repository (Gate P0-B.1)
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §1
// Replaces in-memory / JSON store authority with canonical PostgreSQL persistence.
// ============================================================================

import {pgPool, initialProjects} from '../db/store.js';
import type {ProjectEntity, StageValues} from '../types/domain.js';

export interface CreateProjectInput {
  orgId: string;
  code: string;
  name: string;
  customer?: string;
  location?: string;
  owner?: string;
  status?: 'Aktif' | 'Diarsipkan';
  contract?: number;
  values?: number[];
}

export interface ProjectRecord extends ProjectEntity {
  createdAt?: string;
  archivedAt?: string | null;
}

export interface ProjectFilter {
  status?: string;
  archived?: boolean;
}

export interface IProjectRepository {
  createProject(input: CreateProjectInput): Promise<ProjectRecord>;
  getProjectsByOrgId(orgId: string, filter?: ProjectFilter): Promise<ProjectRecord[]>;
  getProjectById(orgId: string, projectId: string): Promise<ProjectRecord | null>;
  updateProjectStatus(orgId: string, projectId: string, status: 'Aktif' | 'Diarsipkan'): Promise<ProjectRecord | null>;
  isProjectCodeTaken(orgId: string, code: string): Promise<boolean>;
}

export function parseStageValues(raw: any): StageValues {
  const arr = Array.isArray(raw) ? raw.map(Number) : [];
  return [
    arr[0] || 0,
    arr[1] || 0,
    arr[2] || 0,
    arr[3] || 0,
    arr[4] || 0,
    arr[5] || 0
  ];
}

export function mapRowToProject(row: any): ProjectRecord {
  const statusFormatted: 'Aktif' | 'Diarsipkan' =
    row.status === 'ARCHIVED' || row.status === 'Diarsipkan' ? 'Diarsipkan' : 'Aktif';

  const values = parseStageValues(row.stage_values ?? row.values);

  const updatedDate = row.updated_at ? new Date(row.updated_at) : new Date();
  const updatedFormatted = `${updatedDate.getDate()} Sep ${updatedDate.getFullYear()}, ${String(updatedDate.getHours()).padStart(2, '0')}.${String(updatedDate.getMinutes()).padStart(2, '0')}`;

  return {
    id: row.id,
    orgId: row.org_id,
    code: row.project_code || row.code,
    name: row.project_name || row.name,
    customer: row.customer_name || row.customer || '',
    location: row.location || '',
    owner: row.owner || '',
    status: statusFormatted,
    contract: Number(row.contract_value ?? row.contract ?? 0),
    values,
    updated: updatedFormatted,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : null
  };
}

export interface QueryableClient {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
}

export class PostgresProjectRepository implements IProjectRepository {
  private client: QueryableClient;

  constructor(client: QueryableClient = pgPool) {
    this.client = client;
  }

  public async createProject(input: CreateProjectInput): Promise<ProjectRecord> {
    const dbStatus = input.status === 'Diarsipkan' ? 'ARCHIVED' : 'ACTIVE';
    const values = Array.isArray(input.values) && input.values.length === 6 ? input.values : [0, 0, 0, 0, 0, 0];
    const query = `
      INSERT INTO public.projects (
        org_id,
        project_code,
        project_name,
        customer_name,
        location,
        owner,
        status,
        contract_value,
        stage_values,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
      )
      RETURNING *
    `;
    const params = [
      input.orgId,
      input.code.trim(),
      input.name.trim(),
      (input.customer || 'Pemberi Kerja').trim(),
      (input.location || 'Indonesia').trim(),
      input.owner || '',
      dbStatus,
      input.contract || 0,
      values
    ];
    const res = await this.client.query(query, params);
    return mapRowToProject(res.rows[0]);
  }

  public async getProjectsByOrgId(orgId: string, filter?: ProjectFilter): Promise<ProjectRecord[]> {
    let query = `
      SELECT *
      FROM public.projects
      WHERE org_id = $1
    `;
    const params: any[] = [orgId];

    if (filter?.archived === true) {
      query += ` AND status = 'ARCHIVED'`;
    } else if (filter?.archived === false) {
      query += ` AND status = 'ACTIVE'`;
    } else if (filter?.status && filter.status !== 'Semua status') {
      const s = filter.status.toLowerCase();
      if (s === 'aktif' || s === 'active') {
        query += ` AND status = 'ACTIVE'`;
      } else if (s === 'diarsipkan' || s === 'archived') {
        query += ` AND status = 'ARCHIVED'`;
      } else {
        params.push(filter.status);
        query += ` AND LOWER(status) = LOWER($${params.length})`;
      }
    }

    query += ` ORDER BY created_at DESC`;
    const res = await this.client.query(query, params);
    return res.rows.map(mapRowToProject);
  }

  public async getProjectById(orgId: string, projectId: string): Promise<ProjectRecord | null> {
    const query = `
      SELECT *
      FROM public.projects
      WHERE org_id = $1 AND id = $2
      LIMIT 1
    `;
    const res = await this.client.query(query, [orgId, projectId]);
    return res.rows[0] ? mapRowToProject(res.rows[0]) : null;
  }

  public async updateProjectStatus(
    orgId: string,
    projectId: string,
    status: 'Aktif' | 'Diarsipkan'
  ): Promise<ProjectRecord | null> {
    const dbStatus = status === 'Diarsipkan' ? 'ARCHIVED' : 'ACTIVE';
    const query = `
      UPDATE public.projects
      SET status = $3,
          archived_at = CASE WHEN $3 = 'ARCHIVED' THEN NOW() ELSE NULL END,
          updated_at = NOW()
      WHERE org_id = $1 AND id = $2
      RETURNING *
    `;
    const res = await this.client.query(query, [orgId, projectId, dbStatus]);
    return res.rows[0] ? mapRowToProject(res.rows[0]) : null;
  }

  public async isProjectCodeTaken(orgId: string, code: string): Promise<boolean> {
    const query = `
      SELECT 1
      FROM public.projects
      WHERE org_id = $1 AND LOWER(project_code) = LOWER($2)
      LIMIT 1
    `;
    const res = await this.client.query(query, [orgId, code.trim()]);
    return res.rows.length > 0;
  }
}

export class InMemoryProjectRepository implements IProjectRepository {
  public projects: ProjectRecord[] = [];
  public validOrgIds: Set<string> = new Set(['org-001', 'org-002']);

  constructor(initialProjects: ProjectRecord[] = []) {
    this.projects = [...initialProjects];
  }

  public async createProject(input: CreateProjectInput): Promise<ProjectRecord> {
    if (!this.validOrgIds.has(input.orgId)) {
      const err: any = new Error('Foreign key violation: organization does not exist');
      err.code = '23503';
      throw err;
    }

    if (this.projects.some(p => p.orgId === input.orgId && p.code.toLowerCase() === input.code.trim().toLowerCase())) {
      const err: any = new Error('Unique constraint violation: project_code taken');
      err.code = '23505';
      throw err;
    }

    const now = new Date();
    const newRecord: ProjectRecord = {
      id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      orgId: input.orgId,
      code: input.code.trim(),
      name: input.name.trim(),
      customer: (input.customer || 'Pemberi Kerja').trim(),
      location: (input.location || 'Indonesia').trim(),
      owner: input.owner || '',
      status: input.status || 'Aktif',
      contract: input.contract || 0,
      values: parseStageValues(input.values),
      updated: `${now.getDate()} Sep ${now.getFullYear()}, ${String(now.getHours()).padStart(2, '0')}.${String(now.getMinutes()).padStart(2, '0')}`,
      createdAt: now.toISOString(),
      archivedAt: input.status === 'Diarsipkan' ? now.toISOString() : null
    };

    this.projects.unshift(newRecord);
    return newRecord;
  }

  public async getProjectsByOrgId(orgId: string, filter?: ProjectFilter): Promise<ProjectRecord[]> {
    return this.projects.filter(p => {
      if (p.orgId !== orgId) return false;
      if (filter?.archived === true) return p.status === 'Diarsipkan';
      if (filter?.archived === false) return p.status === 'Aktif';
      if (filter?.status && filter.status !== 'Semua status') {
        return p.status.toLowerCase() === filter.status.toLowerCase();
      }
      return true;
    });
  }

  public async getProjectById(orgId: string, projectId: string): Promise<ProjectRecord | null> {
    const found = this.projects.find(p => p.orgId === orgId && p.id === projectId);
    return found ? { ...found } : null;
  }

  public async updateProjectStatus(
    orgId: string,
    projectId: string,
    status: 'Aktif' | 'Diarsipkan'
  ): Promise<ProjectRecord | null> {
    const found = this.projects.find(p => p.orgId === orgId && p.id === projectId);
    if (!found) return null;
    found.status = status;
    found.archivedAt = status === 'Diarsipkan' ? new Date().toISOString() : null;
    return { ...found };
  }

  public async isProjectCodeTaken(orgId: string, code: string): Promise<boolean> {
    return this.projects.some(p => p.orgId === orgId && p.code.toLowerCase() === code.trim().toLowerCase());
  }
}

// Global active project repository
let customRepositorySet = false;
let currentProjectRepository: IProjectRepository =
  process.env.NODE_ENV === 'test'
    ? new InMemoryProjectRepository(structuredClone(initialProjects) as ProjectRecord[])
    : new PostgresProjectRepository();

export function getProjectRepository(): IProjectRepository {
  if (!customRepositorySet && process.env.NODE_ENV === 'test' && currentProjectRepository instanceof PostgresProjectRepository) {
    currentProjectRepository = new InMemoryProjectRepository(structuredClone(initialProjects) as ProjectRecord[]);
  }
  return currentProjectRepository;
}

export function setProjectRepository(repo: IProjectRepository): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('CRITICAL SECURITY VIOLATION: Custom project repository can only be configured in test environment (NODE_ENV=test).');
  }
  currentProjectRepository = repo;
  customRepositorySet = true;
}
