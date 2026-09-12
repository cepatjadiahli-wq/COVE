// ============================================================================
// COVE Backend — Canonical Webhook Event Repository (Gate P0-C.1)
// Acuan: COVE_PRD_v2.0_Product_End_State.md, COVE_ERD_v2.0_Logical_Data_Model.md §2, §9
// Replaces in-memory webhook authority with canonical PostgreSQL persistence.
// Enforces durable idempotency, deterministic payload hashing, and race recovery.
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
}

export interface RecordWebhookInput {
  id?: string;
  eventId: string;
  provider?: string;
  eventType: string;
  payload: Record<string, unknown>;
  payloadHash?: string;
  processedAt?: string;
}

export interface RecordWebhookResult {
  event: WebhookEventEntity;
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
  getRecentWebhookEvents(limit?: number): Promise<WebhookEventEntity[]>;
}

/**
 * Deterministically serializes JSON with recursively sorted keys.
 * Guarantees that identical data produces identical SHA-256 digests.
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
 * Calculates a deterministic SHA-256 fingerprint for webhook payloads.
 */
export function computePayloadHash(payload: Record<string, unknown> | unknown): string {
  const serialized = canonicalJsonStringify(payload);
  return crypto.createHash('sha256').update(serialized, 'utf-8').digest('hex');
}

/**
 * Constant-time payload hash verification.
 */
export function verifyPayloadHash(payload: Record<string, unknown> | unknown, expectedHash: string): boolean {
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

    try {
      // 1. Initial existence check
      const existingRes = await client.query(
        `SELECT id, event_id, provider, event_type, payload, payload_hash, processed_at
         FROM public.webhook_events
         WHERE provider = $1 AND event_id = $2`,
        [provider, input.eventId]
      );

      if (existingRes.rows.length > 0) {
        return {
          event: this.mapRow(existingRes.rows[0]),
          isDuplicate: true
        };
      }

      // 2. Insert with ON CONFLICT DO NOTHING for atomic race safety
      const insertRes = await client.query(
        `INSERT INTO public.webhook_events (
           id, event_id, provider, event_type, payload, payload_hash, processed_at
         ) VALUES (
           COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5::jsonb, $6, $7::timestamptz
         )
         ON CONFLICT (provider, event_id) DO NOTHING
         RETURNING id, event_id, provider, event_type, payload, payload_hash, processed_at`,
        [
          validUuid,
          input.eventId,
          provider,
          input.eventType,
          JSON.stringify(input.payload),
          payloadHash,
          processedAt
        ]
      );

      if (insertRes.rows.length === 0) {
        // Race condition: another concurrent transaction committed between check and insert
        const raceRes = await client.query(
          `SELECT id, event_id, provider, event_type, payload, payload_hash, processed_at
           FROM public.webhook_events
           WHERE provider = $1 AND event_id = $2`,
          [provider, input.eventId]
        );
        if (raceRes.rows.length > 0) {
          return {
            event: this.mapRow(raceRes.rows[0]),
            isDuplicate: true
          };
        }
      }

      return {
        event: this.mapRow(insertRes.rows[0]),
        isDuplicate: false
      };
    } catch (err: any) {
      // Unique violation code 23505 race recovery
      if (err.code === '23505') {
        const raceRes = await client.query(
          `SELECT id, event_id, provider, event_type, payload, payload_hash, processed_at
           FROM public.webhook_events
           WHERE provider = $1 AND event_id = $2`,
          [provider, input.eventId]
        );
        if (raceRes.rows.length > 0) {
          return {
            event: this.mapRow(raceRes.rows[0]),
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
        `SELECT id, event_id, provider, event_type, payload, payload_hash, processed_at
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
        `SELECT id, event_id, provider, event_type, payload, payload_hash, processed_at
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
      processedAt: row.processed_at instanceof Date ? row.processed_at.toISOString() : String(row.processed_at)
    };
  }
}

export class InMemoryWebhookRepository implements IWebhookRepository {
  public events: WebhookEventEntity[] = [];

  async recordWebhookEvent(input: RecordWebhookInput): Promise<RecordWebhookResult> {
    const provider = input.provider || 'MAYAR';
    const existing = this.events.find(e => e.provider === provider && e.eventId === input.eventId);
    if (existing) {
      return { event: existing, isDuplicate: true };
    }

    const payloadHash = input.payloadHash || computePayloadHash(input.payload);
    const event: WebhookEventEntity = {
      id: input.id || `wh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      eventId: input.eventId,
      provider,
      eventType: input.eventType,
      payload: input.payload,
      payloadHash,
      processedAt: input.processedAt || new Date().toISOString()
    };

    this.events.unshift(event);
    return { event, isDuplicate: false };
  }

  async findWebhookEvent(provider: string, eventId: string): Promise<WebhookEventEntity | null> {
    const found = this.events.find(e => e.provider === provider && e.eventId === eventId);
    return found ? { ...found } : null;
  }

  async getRecentWebhookEvents(limit: number = 50): Promise<WebhookEventEntity[]> {
    return this.events.slice(0, limit).map(e => ({ ...e }));
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
