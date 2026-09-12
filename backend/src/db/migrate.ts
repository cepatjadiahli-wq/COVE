// ============================================================================
// COVE Backend — Deterministic PostgreSQL Migration Runner (Gate P0-A.1)
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md
// Enforces verified migration execution order (003b strictly before 004).
// ============================================================================

import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import pg from 'pg';
import {config} from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

export const CANONICAL_MIGRATION_ORDER = [
  '001_initial_schema.sql',
  '002_rls_policies.sql',
  '003b_platform_admin_foundation.sql',
  '004_extended_growth_feedback_schema.sql',
  '005_identity_access_hardening.sql',
  '006_tenant_entitlement_and_profile_bootstrap.sql',
  '007_project_canonical_schema.sql',
  '008_ledger_canonical_persistence.sql',
  '009_project_invoice_receipt_persistence.sql',
  '010_p0b3_financial_integrity_hardening.sql',
  '011_p0b3_full_financial_history_and_idempotency_closure.sql',
  '012_p0b4_action_persistence.sql',
  '013_p0c1_mayar_webhook_security.sql',
  '014_p0c1_webhook_conflict_hardening.sql'
] as const;

export function getDiscoveredMigrations(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  // 003_seed_data.sql is strictly a development fixture and excluded from production migration runner
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql') && f !== '003_seed_data.sql');
  
  // Verify that all canonical migrations are present
  for (const required of CANONICAL_MIGRATION_ORDER) {
    if (!files.includes(required)) {
      throw new Error(`CRITICAL MIGRATION ERROR: Required migration file ${required} not found in ${MIGRATIONS_DIR}`);
    }
  }

  // Sort strictly according to canonical order, followed by any additional files
  return files.sort((a, b) => {
    const idxA = CANONICAL_MIGRATION_ORDER.indexOf(a as any);
    const idxB = CANONICAL_MIGRATION_ORDER.indexOf(b as any);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });
}

export async function runMigrations(customPool?: pg.Pool): Promise<{ executed: string[]; skipped: string[] }> {
  const pool = customPool || new pg.Pool({ connectionString: config.databaseUrl });
  const client = await pool.connect();
  const executed: string[] = [];
  const skipped: string[] = [];

  try {
    // 1. Create migrations tracking table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Fetch applied migrations
    const res = await client.query(`SELECT name FROM _migrations`);
    const applied = new Set(res.rows.map(r => r.name));

    // 3. Resolve migrations in strict canonical order
    const orderedFiles = getDiscoveredMigrations();

    for (const filename of orderedFiles) {
      if (applied.has(filename)) {
        skipped.push(filename);
        continue;
      }

      console.log(`Applying migration: ${filename}...`);
      const filePath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [filename]);
        await client.query('COMMIT');
        executed.push(filename);
        console.log(`✓ Successfully applied: ${filename}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`✗ FAILED to apply migration ${filename}:`, err);
        throw err;
      }
    }

    return { executed, skipped };
  } finally {
    client.release();
    if (!customPool) {
      await pool.end();
    }
  }
}

// Auto-run when executed directly via CLI
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  console.log('--- Starting COVE Database Migration ---');
  runMigrations()
    .then(({ executed, skipped }) => {
      console.log(`Migration complete. Executed: ${executed.length}, Skipped: ${skipped.length}`);
      process.exit(0);
    })
    .catch(err => {
      console.error('Migration halted due to error:', err);
      process.exit(1);
    });
}
