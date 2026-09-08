// ============================================================================
// COVE Backend — Development / Test Database Seed Script
// Hard-guarded: Only executable in non-production environments with ALLOW_DEV_SEED=true
// ============================================================================

import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import pg from 'pg';
import {config} from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runDevSeed() {
  if (config.isProduction || process.env.NODE_ENV === 'production') {
    throw new Error('SECURITY VIOLATION: Dev seed is strictly forbidden in production environments.');
  }

  if (process.env.ALLOW_DEV_SEED !== 'true') {
    throw new Error('GUARD: Explicit flag ALLOW_DEV_SEED=true is required to execute development seed.');
  }

  const seedFile = path.resolve(__dirname, '../../migrations/003_seed_data.sql');
  if (!fs.existsSync(seedFile)) {
    throw new Error(`Seed file not found at ${seedFile}`);
  }

  const sql = fs.readFileSync(seedFile, 'utf-8');
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const client = await pool.connect();
  try {
    console.log('Applying development seed data...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✓ Development seed data applied successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed_dev.ts')) {
  runDevSeed().catch(err => {
    console.error('Dev seed error:', err.message);
    process.exit(1);
  });
}
