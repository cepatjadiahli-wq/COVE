// ============================================================================
// COVE Backend — Canonical Webhook Event Repository (Gate P0-C.1, P0-C.1.1)
// Acuan: COVE_PRD_v2.0_Product_End_State.md, COVE_ERD_v2.0_Logical_Data_Model.md §2, §9
// Replaces in-memory webhook authority with canonical PostgreSQL persistence.
// Enforces durable idempotency, raw-body SHA-256 integrity hashing, conflict tracking,
// and race recovery.
// ============================================================================

import crypto from 'node:crypto';
import pg from 'pg';
import {pgPool} from '../db/store.js';

export interface WebhookEventEntity {
  id: string;
  eventId: string;
  provider: string;
  eventType: string;
  payload: Record<string, unknown>;
  payloadHash: string;
  processedAt: string;
  conflictCount: number;
  lastConflictHash?: string | null;
  lastConflictAt?: string | null;
  // P0-C3 processing lifecycle fields
  processingStatus: 'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'RETRYABLE' | 'REVIEW_REQUIRED' | 'FAILED_FINAL';
  attemptCount: number;
  processingStartedAt?: string | null;
  lastAttemptAt?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
}

export interface RecordWebhookInput {
  id?: string;
  eventId: string;
  provider?: string;
  eventType: string;
  payload: Record<string, unknown>;
  payloadHash?: string;
  processedAt?: string;
  processingStatus?: 'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'RETRYABLE' | 'REVIEW_REQUIRED' | 'FAILED_FINAL';
}

export interface RecordWebhookResult {
  event: WebhookEventEntity;
  status: 'STORED' | 'DUPLICATE' | 'CONFLICT';
  isDuplicate: boolean;
}

export interface QueryableWebhookClient {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
  release: () => void;
}

export interface QueryableWebhookPool {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
  connect?: () => Promise<QueryableWebhookClient>;
}

export interface IWebhookRepository {
  recordWebhookEvent(input: RecordWebhookInput): Promise<RecordWebhookResult>;
  findWebhookEvent(provider: string, eventId: string): Promise<WebhookEventEntity | null>;
  findWebhookEventById(id: string): Promise<WebhookEventEntity | null>;
  getRecentWebhookEvents(limit?: number): Promise<WebhookEventEntity[]>;
  // P0-C3: processing lifecycle management
  markReceived(id: string): Promise<void>;
  claimProcessingLease(id: string): Promise<boolean>;
  markProcessed(id: string): Promise<void>;
  markRetryable(id: string, errorCode: string, errorMessage: string): Promise<void>;
  markReviewRequired(id: string, errorCode: string, errorMessage: string): Promise<void>;
  markFailed(id: string, errorCode: string, errorMessage: string): Promise<void>;
  recoverStaleLeases(leaseTimeoutMs?: number): Promise<string[]>;
  listByStatus(status: string, limit?: number): Promise<WebhookEventEntity[]>;
  listUnresolved(limit?: number): Promise<WebhookEventEntity[]>;
  deleteWebhookEvent(id: string): Promise<void>;
}

/**
 * Deterministically serializes JSON with recursively sorted keys.
 * Used as a secondary utility; authoritative fingerprint is raw request body bytes.
 */
export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJsonStringify((obj as any)[k])).join(',') + '}';
}

/**
 * Calculates a SHA-256 fingerprint for webhook payloads.
 * If payload is already raw string/Buffer, hashes bytes directly.
 */
export function computePayloadHash(payload: Record<string, unknown> | string | unknown): string {
  const content = typeof payload === 'string' ? payload : canonicalJsonStringify(payload);
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Constant-time payload hash verification.
 */
export function verifyPayloadHash(payload: Record<string, unknown> | string | unknown, expectedHash: string): boolean {
  const actualHash = computePayloadHash(payload);
  const actualBuf = Buffer.from(actualHash, 'utf-8');
  const expectedBuf = Buffer.from(expectedHash, 'utf-8');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

function isValidUuid(id?: string): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export class PostgresWebhookRepository implements IWebhookRepository {
  private pool: QueryableWebhookPool;

  constructor(pool: QueryableWebhookPool = pgPool) {
    this.pool = pool;
  }

  private async getClient(): Promise<QueryableWebhookClient> {
    if (this.pool && typeof this.pool.connect === 'function') {
      return await this.pool.connect();
    }
    return {
      query: (sql: string, params?: any[]) => this.pool.query(sql, params),
      release: () => {}
    };
  }

  async recordWebhookEvent(input: RecordWebhookInput): Promise<RecordWebhookResult> {
    const client = await this.getClient();
    const provider = input.provider || 'MAYAR';
    const payloadHash = input.payloadHash || computePayloadHash(input.payload);
    const processedAt = input.processedAt || new Date().toISOString();
    const validUuid = isValidUuid(input.id) ? input.id : null;

    const initialStatus = input.processingStatus || 'PROCESSED';

    try {
      // 1. Initial existence check for idempotency and conflict detection
      const existingRes = await client.query(
        `SELECT ${this.fullSelectCols}
         FROM public.webhook_events
         WHERE provider = $1 AND event_id = $2`,
        [provider, input.eventId]
      );

      if (existingRes.rows.length > 0) {
        const existing = existingRes.rows[0];
        // Compare payload hashes: identical -> DUPLICATE, different -> CONFLICT
        if (existing.payload_hash && existing.payload_hash !== payloadHash) {
          const updateRes = await client.query(
            `UPDATE public.webhook_events
             SET conflict_count = conflict_count + 1,
                 last_conflict_hash = $1,
                 last_conflict_at = NOW()
             WHERE id = $2
             RETURNING ${this.fullSelectCols}`,
            [payloadHash, existing.id]
          );
          return {
            event: this.mapRow(updateRes.rows[0]),
            status: 'CONFLICT',
            isDuplicate: false
          };
        }

        return {
          event: this.mapRow(existing),
          status: 'DUPLICATE',
          isDuplicate: true
        };
      }

      // 2. Insert with ON CONFLICT (provider, event_id) DO NOTHING for atomic race safety
      const insertRes = await client.query(
        `INSERT INTO public.webhook_events (
           id, event_id, provider, event_type, payload, payload_hash, processed_at,
           conflict_count, last_conflict_hash, last_conflict_at, processing_status, attempt_count
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5::jsonb, $6, $7::timestamptz,
           0, NULL, NULL, $8, 0
         )
         ON CONFLICT (provider, event_id) DO NOTHING
         RETURNING ${this.fullSelectCols}`,
        [
          validUuid,
          input.eventId,
          provider,
          input.eventType,
          JSON.stringify(input.payload),
          payloadHash,
          processedAt,
          initialStatus
        ]
      );

      if (insertRes.rows.length === 0) {
        // Race condition: concurrent transaction committed between check and insert
        const raceRes = await client.query(
          `SELECT ${this.fullSelectCols}
           FROM public.webhook_events
           WHERE provider = $1 AND event_id = $2`,
          [provider, input.eventId]
        );
        if (raceRes.rows.length > 0) {
          const raced = raceRes.rows[0];
          if (raced.payload_hash && raced.payload_hash !== payloadHash) {
            const updateRes = await client.query(
              `UPDATE public.webhook_events
               SET conflict_count = conflict_count + 1,
                   last_conflict_hash = $1,
                   last_conflict_at = NOW()
               WHERE id = $2
               RETURNING ${this.fullSelectCols}`,
              [payloadHash, raced.id]
            );
            return {
              event: this.mapRow(updateRes.rows[0]),
              status: 'CONFLICT',
              isDuplicate: false
            };
          }
          return {
            event: this.mapRow(raced),
            status: 'DUPLICATE',
            isDuplicate: true
          };
        }
      }

      return {
        event: this.mapRow(insertRes.rows[0]),
        status: 'STORED',
        isDuplicate: false
      };
    } catch (err: any) {
      // Standalone event_id unique constraint race fallback
      if (err.code === '23505') {
        const raceRes = await client.query(
          `SELECT ${this.fullSelectCols}
           FROM public.webhook_events
           WHERE provider = $1 AND event_id = $2`,
          [provider, input.eventId]
        );
        if (raceRes.rows.length > 0) {
          const raced = raceRes.rows[0];
          if (raced.payload_hash && raced.payload_hash !== payloadHash) {
            const updateRes = await client.query(
              `UPDATE public.webhook_events
               SET conflict_count = conflict_count + 1,
                   last_conflict_hash = $1,
                   last_conflict_at = NOW()
               WHERE id = $2
               RETURNING ${this.fullSelectCols}`,
              [payloadHash, raced.id]
            );
            return {
              event: this.mapRow(updateRes.rows[0]),
              status: 'CONFLICT',
              isDuplicate: false
            };
          }
          return {
            event: this.mapRow(raced),
            status: 'DUPLICATE',
            isDuplicate: true
          };
        }
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async findWebhookEvent(provider: string, eventId: string): Promise<WebhookEventEntity | null> {
    const client = await this.getClient();
    try {
      const res = await client.query(
        `SELECT ${this.fullSelectCols}
         FROM public.webhook_events
         WHERE provider = $1 AND event_id = $2`,
        [provider, eventId]
      );
      if (res.rows.length === 0) return null;
      return this.mapRow(res.rows[0]);
    } finally {
      client.release();
    }
  }

  async getRecentWebhookEvents(limit: number = 50): Promise<WebhookEventEntity[]> {
    const client = await this.getClient();
    try {
      const res = await client.query(
        `SELECT ${this.fullSelectCols}
         FROM public.webhook_events
         ORDER BY processed_at DESC
         LIMIT $1`,
        [limit]
      );
      return res.rows.map(row => this.mapRow(row));
    } finally {
      client.release();
    }
  }

  private mapRow(row: any): WebhookEventEntity {
    return {
      id: row.id,
      eventId: row.event_id,
      provider: row.provider,
      eventType: row.event_type,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      payloadHash: row.payload_hash || '',
      processedAt: row.processed_at instanceof Date ? row.processed_at.toISOString() : String(row.processed_at),
      conflictCount: Number(row.conflict_count) || 0,
      lastConflictHash: row.last_conflict_hash || null,
      lastConflictAt: row.last_conflict_at instanceof Date ? row.last_conflict_at.toISOString() : (row.last_conflict_at ? String(row.last_conflict_at) : null),
      // P0-C3 lifecycle fields (default to 'PROCESSED' for pre-018 rows that lack the column)
      processingStatus: row.processing_status || 'PROCESSED',
      attemptCount: Number(row.attempt_count) || 0,
      processingStartedAt: row.processing_started_at instanceof Date ? row.processing_started_at.toISOString() : (row.processing_started_at ? String(row.processing_started_at) : null),
      lastAttemptAt: row.last_attempt_at instanceof Date ? row.last_attempt_at.toISOString() : (row.last_attempt_at ? String(row.last_attempt_at) : null),
      lastErrorCode: row.last_error_code || null,
      lastErrorMessage: row.last_error_message || null
    };
  }

  // ---------- P0-C3 Lifecycle Methods ----------

  private get fullSelectCols(): string {
    return `id, event_id, provider, event_type, payload, payload_hash, processed_at,
            conflict_count, last_conflict_hash, last_conflict_at,
            processing_status, attempt_count, processing_started_at,
            last_attempt_at, last_error_code, last_error_message`;
  }

  async findWebhookEventById(id: string): Promise<WebhookEventEntity | null> {
    const client = await this.getClient();
    try {
      const res = await client.query(
        `SELECT ${this.fullSelectCols} FROM public.webhook_events WHERE id = $1`,
        [id]
      );
      if (res.rows.length === 0) return null;
      return this.mapRow(res.rows[0]);
    } finally {
      client.release();
    }
  }

  async markReceived(id: string): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query(
        `UPDATE public.webhook_events
         SET processing_status = 'RECEIVED',
             last_attempt_at = NOW()
         WHERE id = $1 AND processing_status = 'RECEIVED'`,
        [id]
      );
    } finally {
      client.release();
    }
  }

  async claimProcessingLease(id: string): Promise<boolean> {
    const client = await this.getClient();
    try {
      // Atomically move RECEIVED → PROCESSING; also recover stale PROCESSING leases
      const res = await client.query(
        `UPDATE public.webhook_events
         SET processing_status = 'PROCESSING',
             processing_started_at = NOW(),
             last_attempt_at = NOW(),
             attempt_count = attempt_count + 1
         WHERE id = $1
           AND (
             processing_status = 'RECEIVED'
             OR processing_status = 'RETRYABLE'
             OR processing_status = 'REVIEW_REQUIRED'
             OR (processing_status = 'PROCESSING'
                 AND processing_started_at < NOW() - INTERVAL '5 minutes')
           )
         RETURNING id`,
        [id]
      );
      return res.rows.length > 0;
    } finally {
      client.release();
    }
  }

  async markProcessed(id: string): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query(
        `UPDATE public.webhook_events
         SET processing_status = 'PROCESSED',
             last_attempt_at = NOW(),
             last_error_code = NULL,
             last_error_message = NULL
         WHERE id = $1`,
        [id]
      );
    } finally {
      client.release();
    }
  }

  async markRetryable(id: string, errorCode: string, errorMessage: string): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query(
        `UPDATE public.webhook_events
         SET processing_status = 'RETRYABLE',
             last_attempt_at = NOW(),
             last_error_code = $2,
             last_error_message = $3
         WHERE id = $1`,
        [id, errorCode, errorMessage.slice(0, 1000)]
      );
    } finally {
      client.release();
    }
  }

  async markReviewRequired(id: string, errorCode: string, errorMessage: string): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query(
        `UPDATE public.webhook_events
         SET processing_status = 'REVIEW_REQUIRED',
             last_attempt_at = NOW(),
             last_error_code = $2,
             last_error_message = $3
         WHERE id = $1`,
        [id, errorCode, errorMessage.slice(0, 1000)]
      );
    } finally {
      client.release();
    }
  }

  async markFailed(id: string, errorCode: string, errorMessage: string): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query(
        `UPDATE public.webhook_events
         SET processing_status = 'FAILED_FINAL',
             last_attempt_at = NOW(),
             last_error_code = $2,
             last_error_message = $3
         WHERE id = $1`,
        [id, errorCode, errorMessage.slice(0, 1000)]
      );
    } finally {
      client.release();
    }
  }

  async recoverStaleLeases(leaseTimeoutMs: number = 5 * 60 * 1000): Promise<string[]> {
    const client = await this.getClient();
    try {
      const intervalSeconds = Math.floor(leaseTimeoutMs / 1000);
      const res = await client.query(
        `UPDATE public.webhook_events
         SET processing_status = 'RETRYABLE',
             last_error_code = 'STALE_LEASE',
             last_error_message = 'Processing lease expired without completion. Recovered to RETRYABLE.'
         WHERE processing_status = 'PROCESSING'
           AND processing_started_at < NOW() - ($1 || ' seconds')::INTERVAL
         RETURNING id`,
        [intervalSeconds]
      );
      return res.rows.map((r: any) => r.id);
    } finally {
      client.release();
    }
  }

  async listByStatus(status: string, limit: number = 50): Promise<WebhookEventEntity[]> {
    const client = await this.getClient();
    try {
      const res = await client.query(
        `SELECT ${this.fullSelectCols}
         FROM public.webhook_events
         WHERE processing_status = $1
         ORDER BY last_attempt_at DESC NULLS LAST
         LIMIT $2`,
        [status, limit]
      );
      return res.rows.map((row: any) => this.mapRow(row));
    } finally {
      client.release();
    }
  }

  async listUnresolved(limit: number = 50): Promise<WebhookEventEntity[]> {
    const client = await this.getClient();
    try {
      const res = await client.query(
        `SELECT ${this.fullSelectCols}
         FROM public.webhook_events
         WHERE processing_status IN ('RETRYABLE', 'REVIEW_REQUIRED')
         ORDER BY last_attempt_at DESC NULLS LAST
         LIMIT $1`,
        [limit]
      );
      return res.rows.map((row: any) => this.mapRow(row));
    } finally {
      client.release();
    }
  }

  async deleteWebhookEvent(id: string): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query(`DELETE FROM public.webhook_events WHERE id = $1`, [id]);
    } finally {
      client.release();
    }
  }
}


export class InMemoryWebhookRepository implements IWebhookRepository {
  public events: WebhookEventEntity[] = [];

  async recordWebhookEvent(input: RecordWebhookInput): Promise<RecordWebhookResult> {
    const provider = input.provider || 'MAYAR';
    const payloadHash = input.payloadHash || computePayloadHash(input.payload);
    const existing = this.events.find(e => e.provider === provider && e.eventId === input.eventId);

    if (existing) {
      if (existing.payloadHash && existing.payloadHash !== payloadHash) {
        existing.conflictCount = (existing.conflictCount || 0) + 1;
        existing.lastConflictHash = payloadHash;
        existing.lastConflictAt = new Date().toISOString();
        return { event: { ...existing }, status: 'CONFLICT', isDuplicate: false };
      }
      return { event: { ...existing }, status: 'DUPLICATE', isDuplicate: true };
    }

    const event: WebhookEventEntity = {
      id: input.id || `wh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      eventId: input.eventId,
      provider,
      eventType: input.eventType,
      payload: input.payload,
      payloadHash,
      processedAt: input.processedAt || new Date().toISOString(),
      conflictCount: 0,
      lastConflictHash: null,
      lastConflictAt: null,
      // P0-C3 lifecycle defaults: new events start RECEIVED; direct inserts default PROCESSED
      processingStatus: (input as any).processingStatus || 'PROCESSED',
      attemptCount: 0,
      processingStartedAt: null,
      lastAttemptAt: null,
      lastErrorCode: null,
      lastErrorMessage: null
    };

    this.events.unshift(event);
    return { event: { ...event }, status: 'STORED', isDuplicate: false };
  }

  async findWebhookEvent(provider: string, eventId: string): Promise<WebhookEventEntity | null> {
    const found = this.events.find(e => e.provider === provider && e.eventId === eventId);
    return found ? { ...found } : null;
  }

  async findWebhookEventById(id: string): Promise<WebhookEventEntity | null> {
    const found = this.events.find(e => e.id === id);
    return found ? { ...found } : null;
  }

  async getRecentWebhookEvents(limit: number = 50): Promise<WebhookEventEntity[]> {
    return this.events.slice(0, limit).map(e => ({ ...e }));
  }

  // ---------- P0-C3 Lifecycle Methods ----------

  async markReceived(id: string): Promise<void> {
    const ev = this.events.find(e => e.id === id);
    if (ev) {
      ev.processingStatus = 'RECEIVED';
      ev.lastAttemptAt = new Date().toISOString();
    }
  }

  async claimProcessingLease(id: string): Promise<boolean> {
    const ev = this.events.find(e => e.id === id);
    if (!ev) return false;
    const now = Date.now();
    const isStale = ev.processingStatus === 'PROCESSING' &&
      ev.processingStartedAt &&
      (now - new Date(ev.processingStartedAt).getTime()) > 5 * 60 * 1000;
    if (ev.processingStatus === 'RECEIVED' || ev.processingStatus === 'RETRYABLE' || ev.processingStatus === 'REVIEW_REQUIRED' || isStale) {
      ev.processingStatus = 'PROCESSING';
      ev.processingStartedAt = new Date().toISOString();
      ev.lastAttemptAt = new Date().toISOString();
      ev.attemptCount = (ev.attemptCount || 0) + 1; // In-memory only: JS increment acceptable since no concurrent DB needed
      return true;
    }
    return false;
  }

  async markProcessed(id: string): Promise<void> {
    const ev = this.events.find(e => e.id === id);
    if (ev) {
      ev.processingStatus = 'PROCESSED';
      ev.lastAttemptAt = new Date().toISOString();
      ev.lastErrorCode = null;
      ev.lastErrorMessage = null;
    }
  }

  async markRetryable(id: string, errorCode: string, errorMessage: string): Promise<void> {
    const ev = this.events.find(e => e.id === id);
    if (ev) {
      ev.processingStatus = 'RETRYABLE';
      ev.lastAttemptAt = new Date().toISOString();
      ev.lastErrorCode = errorCode;
      ev.lastErrorMessage = errorMessage.slice(0, 1000);
    }
  }

  async markReviewRequired(id: string, errorCode: string, errorMessage: string): Promise<void> {
    const ev = this.events.find(e => e.id === id);
    if (ev) {
      ev.processingStatus = 'REVIEW_REQUIRED';
      ev.lastAttemptAt = new Date().toISOString();
      ev.lastErrorCode = errorCode;
      ev.lastErrorMessage = errorMessage.slice(0, 1000);
    }
  }

  async markFailed(id: string, errorCode: string, errorMessage: string): Promise<void> {
    const ev = this.events.find(e => e.id === id);
    if (ev) {
      ev.processingStatus = 'FAILED_FINAL';
      ev.lastAttemptAt = new Date().toISOString();
      ev.lastErrorCode = errorCode;
      ev.lastErrorMessage = errorMessage.slice(0, 1000);
    }
  }

  async recoverStaleLeases(leaseTimeoutMs: number = 5 * 60 * 1000): Promise<string[]> {
    const now = Date.now();
    const recovered: string[] = [];
    for (const ev of this.events) {
      if (
        ev.processingStatus === 'PROCESSING' &&
        ev.processingStartedAt &&
        (now - new Date(ev.processingStartedAt).getTime()) > leaseTimeoutMs
      ) {
        ev.processingStatus = 'RETRYABLE';
        ev.lastErrorCode = 'STALE_LEASE';
        ev.lastErrorMessage = 'Processing lease expired without completion. Recovered to RETRYABLE.';
        recovered.push(ev.id);
      }
    }
    return recovered;
  }

  async listByStatus(status: string, limit: number = 50): Promise<WebhookEventEntity[]> {
    return this.events
      .filter(e => e.processingStatus === status)
      .slice(0, limit)
      .map(e => ({ ...e }));
  }

  async listUnresolved(limit: number = 50): Promise<WebhookEventEntity[]> {
    return this.events
      .filter(e => e.processingStatus === 'RETRYABLE' || e.processingStatus === 'REVIEW_REQUIRED')
      .slice(0, limit)
      .map(e => ({ ...e }));
  }

  async deleteWebhookEvent(id: string): Promise<void> {
    this.events = this.events.filter(e => e.id !== id);
  }

  reset(): void {
    this.events = [];
  }
}


// Global active webhook repository
let customWebhookRepositorySet = false;
let currentWebhookRepository: IWebhookRepository =
  process.env.NODE_ENV === 'test'
    ? new InMemoryWebhookRepository()
    : new PostgresWebhookRepository(pgPool);

export function getWebhookRepository(): IWebhookRepository {
  if (!customWebhookRepositorySet && process.env.NODE_ENV === 'test' && currentWebhookRepository instanceof PostgresWebhookRepository) {
    currentWebhookRepository = new InMemoryWebhookRepository();
  }
  return currentWebhookRepository;
}

export function setWebhookRepository(repo: IWebhookRepository): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('CRITICAL SECURITY VIOLATION: Custom webhook repository can only be configured in test environment (NODE_ENV=test).');
  }
  currentWebhookRepository = repo;
  customWebhookRepositorySet = true;
}
