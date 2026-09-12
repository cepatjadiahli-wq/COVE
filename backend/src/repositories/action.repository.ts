// ============================================================================
// COVE Backend — Canonical Action & Blocker Repository (Gate P0-B.4)
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §8
// Replaces DataStore/JSON authority with canonical PostgreSQL persistence.
// Enforces tenant isolation, RBAC compatibility, and atomic completion.
// ============================================================================

import pg from 'pg';
import {pgPool} from '../db/store.js';
import {config} from '../config.js';
import {getProjectRepository} from './project.repository.js';

export interface ActionNoteRecord {
  id: string;
  actionItemId: string;
  authorName: string;
  note: string;
  createdAt: string;
}

export interface ActionRecord {
  id: string;
  orgId: string;
  projectId: string;
  title: string;
  blocker: string;
  owner: string;
  due: string;
  severity: 'Tinggi' | 'Sedang' | 'Rendah';
  value: number;
  status: 'Terbuka' | 'Menunggu' | 'Selesai';
  notes: string[];
  daysOverdue: number;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateActionInput {
  orgId: string;
  projectId: string;
  title: string;
  blocker: string;
  owner?: string;
  due?: string;
  severity?: 'Tinggi' | 'Sedang' | 'Rendah';
  value?: number;
}

export interface UpdateActionInput {
  title?: string;
  blocker?: string;
  owner?: string;
  due?: string;
  severity?: 'Tinggi' | 'Sedang' | 'Rendah';
  value?: number;
  status?: 'Terbuka' | 'Menunggu' | 'Selesai';
}

export interface IActionRepository {
  createAction(input: CreateActionInput): Promise<ActionRecord>;
  getActions(orgId: string, filter?: { projectId?: string; status?: string }): Promise<ActionRecord[]>;
  getActionById(orgId: string, id: string): Promise<ActionRecord | null>;
  updateAction(orgId: string, id: string, input: UpdateActionInput): Promise<ActionRecord | null>;
  addNoteOrResolve(orgId: string, id: string, note: string, author: string, resolve?: boolean): Promise<ActionRecord | null>;
  deleteAction(orgId: string, id: string): Promise<boolean>;
}

function calculateDaysOverdue(dueDate: string, asOf = config.asOfDate): number {
  const diff = Date.parse(asOf) - Date.parse(dueDate);
  return Math.max(0, Math.floor(diff / 86400000));
}

function formatNoteString(createdAt: string | Date, author: string, note: string): string {
  const d = new Date(createdAt);
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const monthStr = months[d.getMonth()] || 'Sep';
  return `${day} ${monthStr} · ${author}: ${note}`;
}

export interface ActionNoteRow {
  id: string;
  action_item_id: string;
  author_name: string;
  note: string;
  created_at: string | Date;
}

export interface ActionItemRow {
  id: string;
  org_id: string;
  project_id: string;
  owner_name: string;
  title: string;
  blocker: string;
  value_at_risk: string | number;
  due_at: string | Date;
  severity: 'Rendah' | 'Sedang' | 'Tinggi';
  status: 'Terbuka' | 'Menunggu' | 'Selesai';
  created_at: string | Date;
  updated_at: string | Date;
  completed_at: string | Date | null;
  notes_json?: Array<{
    id: string;
    author: string;
    note: string;
    createdAt: string;
  }>;
}

export interface QueryableActionClient {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
  release: () => void;
}

export interface QueryableActionPool {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
  connect?: () => Promise<QueryableActionClient>;
}

export class PostgresActionRepository implements IActionRepository {
  private pool: QueryableActionPool;

  constructor(pool: QueryableActionPool = pgPool) {
    this.pool = pool;
  }

  private async getClient(): Promise<QueryableActionClient> {
    if (this.pool && typeof this.pool.connect === 'function') {
      return await this.pool.connect();
    }
    return {
      query: (sql: string, params?: any[]) => this.pool.query(sql, params),
      release: () => {}
    };
  }

  private mapRowToActionRecord(row: ActionItemRow, rawNotes?: ActionNoteRow[]): ActionRecord {
    const dueStr = row.due_at instanceof Date ? row.due_at.toISOString().split('T')[0] : String(row.due_at).split('T')[0];
    
    let formattedNotes: string[] = [];
    if (Array.isArray(rawNotes)) {
      formattedNotes = rawNotes.map(n => formatNoteString(n.created_at, n.author_name, n.note));
    } else if (Array.isArray(row.notes_json)) {
      formattedNotes = row.notes_json.map((n) => formatNoteString(n.createdAt, n.author, n.note));
    }

    return {
      id: row.id,
      orgId: row.org_id,
      projectId: row.project_id,
      title: row.title,
      blocker: row.blocker,
      owner: row.owner_name,
      due: dueStr,
      severity: row.severity,
      value: Number(row.value_at_risk) || 0,
      status: row.status,
      notes: formattedNotes,
      daysOverdue: calculateDaysOverdue(dueStr),
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    };
  }

  public async createAction(input: CreateActionInput): Promise<ActionRecord> {
    if (!input.title || !input.title.trim() || !input.blocker || !input.blocker.trim() || !input.projectId) {
      const err: any = new Error('Judul, hambatan, dan ID proyek wajib diisi.');
      err.statusCode = 400;
      throw err;
    }

    // Verify project exists and strictly belongs to orgId
    const project = await getProjectRepository().getProjectById(input.orgId, input.projectId);
    if (!project) {
      const err: any = new Error('Proyek tidak ditemukan pada organisasi ini.');
      err.statusCode = 404;
      throw err;
    }

    const owner = (input.owner || '').trim() || 'Tim COVE';
    const due = (input.due || '').trim() || '2026-09-09';
    const severity = input.severity || 'Sedang';
    const value = typeof input.value === 'number' && Number.isFinite(input.value) ? input.value : 0;

    const res = await this.pool.query(
      `INSERT INTO public.action_items (
        org_id,
        project_id,
        owner_name,
        title,
        blocker,
        value_at_risk,
        due_at,
        severity,
        status,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Terbuka', NOW(), NOW())
      RETURNING *`,
      [input.orgId, input.projectId, owner, input.title.trim(), input.blocker.trim(), value, due, severity]
    );

    const rows = res.rows as ActionItemRow[];
    return this.mapRowToActionRecord(rows[0], []);
  }

  public async getActions(orgId: string, filter?: { projectId?: string; status?: string }): Promise<ActionRecord[]> {
    let sql = `
      SELECT ai.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', an.id,
              'author', an.author_name,
              'note', an.note,
              'createdAt', an.created_at
            ) ORDER BY an.created_at ASC
          ) FILTER (WHERE an.id IS NOT NULL),
          '[]'
        ) AS notes_json
      FROM public.action_items ai
      LEFT JOIN public.action_notes an ON an.action_item_id = ai.id
      WHERE ai.org_id = $1
    `;
    const params: any[] = [orgId];

    if (filter?.projectId) {
      params.push(filter.projectId);
      sql += ` AND ai.project_id = $${params.length}`;
    }
    if (filter?.status) {
      params.push(filter.status);
      sql += ` AND ai.status = $${params.length}`;
    }

    sql += ` GROUP BY ai.id ORDER BY ai.created_at DESC`;

    const res = await this.pool.query(sql, params);
    const rows = res.rows as ActionItemRow[];
    return rows.map((r: ActionItemRow) => this.mapRowToActionRecord(r));
  }

  public async getActionById(orgId: string, id: string): Promise<ActionRecord | null> {
    const res = await this.pool.query(
      `SELECT ai.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', an.id,
              'author', an.author_name,
              'note', an.note,
              'createdAt', an.created_at
            ) ORDER BY an.created_at ASC
          ) FILTER (WHERE an.id IS NOT NULL),
          '[]'
        ) AS notes_json
      FROM public.action_items ai
      LEFT JOIN public.action_notes an ON an.action_item_id = ai.id
      WHERE ai.id = $1 AND ai.org_id = $2
      GROUP BY ai.id`,
      [id, orgId]
    );

    const rows = res.rows as ActionItemRow[];
    if (rows.length === 0) return null;
    return this.mapRowToActionRecord(rows[0]);
  }

  public async updateAction(orgId: string, id: string, input: UpdateActionInput): Promise<ActionRecord | null> {
    const existing = await this.getActionById(orgId, id);
    if (!existing) return null;

    const updates: string[] = [];
    const params: any[] = [id, orgId];

    if (input.title !== undefined) {
      params.push(input.title.trim());
      updates.push(`title = $${params.length}`);
    }
    if (input.blocker !== undefined) {
      params.push(input.blocker.trim());
      updates.push(`blocker = $${params.length}`);
    }
    if (input.owner !== undefined) {
      params.push(input.owner.trim());
      updates.push(`owner_name = $${params.length}`);
    }
    if (input.due !== undefined) {
      params.push(input.due.trim());
      updates.push(`due_at = $${params.length}`);
    }
    if (input.severity !== undefined) {
      params.push(input.severity);
      updates.push(`severity = $${params.length}`);
    }
    if (input.value !== undefined) {
      params.push(input.value);
      updates.push(`value_at_risk = $${params.length}`);
    }
    if (input.status !== undefined) {
      params.push(input.status);
      updates.push(`status = $${params.length}`);
      if (input.status === 'Selesai') {
        updates.push(`completed_at = COALESCE(completed_at, NOW())`);
      } else {
        updates.push(`completed_at = NULL`);
      }
    }

    updates.push(`updated_at = NOW()`);

    const sql = `UPDATE public.action_items SET ${updates.join(', ')} WHERE id = $1 AND org_id = $2 RETURNING *`;
    await this.pool.query(sql, params);

    return this.getActionById(orgId, id);
  }

  public async addNoteOrResolve(
    orgId: string,
    id: string,
    note: string,
    author: string,
    resolve = false
  ): Promise<ActionRecord | null> {
    const existing = await this.getActionById(orgId, id);
    if (!existing) return null;

    const client = await this.getClient();
    try {
      await client.query('BEGIN');

      if (note && note.trim()) {
        await client.query(
          `INSERT INTO public.action_notes (action_item_id, author_name, note, created_at)
           VALUES ($1, $2, $3, NOW())`,
          [id, author || 'Tim COVE', note.trim()]
        );
      }

      if (resolve) {
        await client.query(
          `UPDATE public.action_items 
           SET status = 'Selesai', completed_at = COALESCE(completed_at, NOW()), updated_at = NOW() 
           WHERE id = $1 AND org_id = $2`,
          [id, orgId]
        );
      } else {
        await client.query(
          `UPDATE public.action_items SET updated_at = NOW() WHERE id = $1 AND org_id = $2`,
          [id, orgId]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return this.getActionById(orgId, id);
  }

  public async deleteAction(orgId: string, id: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM public.action_items WHERE id = $1 AND org_id = $2`,
      [id, orgId]
    );
    return (res.rowCount ?? 0) > 0;
  }
}

export class InMemoryActionRepository implements IActionRepository {
  public actionItems: any[] = [];
  public actionNotes: any[] = [];

  public async createAction(input: CreateActionInput): Promise<ActionRecord> {
    if (!input.title || !input.title.trim() || !input.blocker || !input.blocker.trim() || !input.projectId) {
      const err: any = new Error('Judul, hambatan, dan ID proyek wajib diisi.');
      err.statusCode = 400;
      throw err;
    }

    const project = await getProjectRepository().getProjectById(input.orgId, input.projectId);
    if (!project) {
      const err: any = new Error('Proyek tidak ditemukan pada organisasi ini.');
      err.statusCode = 404;
      throw err;
    }

    const id = 'act-' + (this.actionItems.length + 1) + '-' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();
    const item = {
      id,
      org_id: input.orgId,
      project_id: input.projectId,
      owner_name: (input.owner || '').trim() || 'Tim COVE',
      title: input.title.trim(),
      blocker: input.blocker.trim(),
      value_at_risk: input.value || 0,
      due_at: input.due || '2026-09-09',
      severity: input.severity || 'Sedang',
      status: 'Terbuka',
      completed_at: null,
      created_at: now,
      updated_at: now
    };

    this.actionItems.unshift(item);
    return this.mapItem(item);
  }

  public async getActions(orgId: string, filter?: { projectId?: string; status?: string }): Promise<ActionRecord[]> {
    let list = this.actionItems.filter(a => a.org_id === orgId);
    if (filter?.projectId) list = list.filter(a => a.project_id === filter.projectId);
    if (filter?.status) list = list.filter(a => a.status === filter.status);
    return list.map(item => this.mapItem(item));
  }

  public async getActionById(orgId: string, id: string): Promise<ActionRecord | null> {
    const item = this.actionItems.find(a => a.id === id && a.org_id === orgId);
    if (!item) return null;
    return this.mapItem(item);
  }

  public async updateAction(orgId: string, id: string, input: UpdateActionInput): Promise<ActionRecord | null> {
    const item = this.actionItems.find(a => a.id === id && a.org_id === orgId);
    if (!item) return null;

    if (input.title !== undefined) item.title = input.title.trim();
    if (input.blocker !== undefined) item.blocker = input.blocker.trim();
    if (input.owner !== undefined) item.owner_name = input.owner.trim();
    if (input.due !== undefined) item.due_at = input.due.trim();
    if (input.severity !== undefined) item.severity = input.severity;
    if (input.value !== undefined) item.value_at_risk = input.value;
    if (input.status !== undefined) {
      item.status = input.status;
      if (input.status === 'Selesai') {
        item.completed_at = item.completed_at || new Date().toISOString();
      } else {
        item.completed_at = null;
      }
    }
    item.updated_at = new Date().toISOString();
    return this.mapItem(item);
  }

  public async addNoteOrResolve(
    orgId: string,
    id: string,
    note: string,
    author: string,
    resolve = false
  ): Promise<ActionRecord | null> {
    const item = this.actionItems.find(a => a.id === id && a.org_id === orgId);
    if (!item) return null;

    if (note && note.trim()) {
      this.actionNotes.push({
        id: 'note-' + (this.actionNotes.length + 1),
        action_item_id: id,
        author_name: author || 'Tim COVE',
        note: note.trim(),
        created_at: new Date().toISOString()
      });
    }

    if (resolve) {
      item.status = 'Selesai';
      item.completed_at = item.completed_at || new Date().toISOString();
    }
    item.updated_at = new Date().toISOString();
    return this.mapItem(item);
  }

  public async deleteAction(orgId: string, id: string): Promise<boolean> {
    const idx = this.actionItems.findIndex(a => a.id === id && a.org_id === orgId);
    if (idx === -1) return false;
    this.actionItems.splice(idx, 1);
    this.actionNotes = this.actionNotes.filter(n => n.action_item_id !== id);
    return true;
  }

  private mapItem(item: any): ActionRecord {
    const notes = this.actionNotes
      .filter(n => n.action_item_id === item.id)
      .map(n => formatNoteString(n.created_at, n.author_name, n.note));

    const dueStr = String(item.due_at).split('T')[0];
    return {
      id: item.id,
      orgId: item.org_id,
      projectId: item.project_id,
      title: item.title,
      blocker: item.blocker,
      owner: item.owner_name,
      due: dueStr,
      severity: item.severity,
      value: Number(item.value_at_risk) || 0,
      status: item.status,
      notes,
      daysOverdue: calculateDaysOverdue(dueStr),
      completedAt: item.completed_at ? new Date(item.completed_at).toISOString() : null,
      createdAt: new Date(item.created_at).toISOString(),
      updatedAt: new Date(item.updated_at).toISOString()
    };
  }
}

// Global active action repository
let customActionRepositorySet = false;
let currentActionRepository: IActionRepository =
  process.env.NODE_ENV === 'test'
    ? new InMemoryActionRepository()
    : new PostgresActionRepository(pgPool);

export function getActionRepository(): IActionRepository {
  if (!customActionRepositorySet && process.env.NODE_ENV === 'test' && currentActionRepository instanceof PostgresActionRepository) {
    currentActionRepository = new InMemoryActionRepository();
  }
  return currentActionRepository;
}

export function setActionRepository(repo: IActionRepository): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('CRITICAL SECURITY VIOLATION: Custom action repository can only be configured in test environment (NODE_ENV=test).');
  }
  currentActionRepository = repo;
  customActionRepositorySet = true;
}
