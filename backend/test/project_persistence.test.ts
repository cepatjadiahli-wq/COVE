// ============================================================================
// COVE Backend — Organization + Project PostgreSQL Persistence & Tenant Isolation Tests (Gate P0-B.1)
// Behavioral Tests P0B1-01 through P0B1-15
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §1, §19–§22
// ============================================================================

process.env.NODE_ENV = 'test';

import {test, before, after} from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {PGlite} from '@electric-sql/pglite';
import app from '../src/index.js';
import {db} from '../src/db/store.js';
import {setTestTokenVerifier} from '../src/lib/supabase.js';
import {
  setIdentityRepository,
  InMemoryIdentityRepository
} from '../src/repositories/identity.repository.js';
import {
  PostgresProjectRepository,
  setProjectRepository,
  getProjectRepository
} from '../src/repositories/project.repository.js';
import {CANONICAL_MIGRATION_ORDER} from '../src/db/migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pglite: PGlite;
let pgProjectRepo: PostgresProjectRepository;
let identityRepo: InMemoryIdentityRepository;

const ORG_A_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const ORG_B_ID = 'bbbbbbbb-2222-4222-8222-222222222222';
const USER_A_ID = 'usr-auth-tenant-a';
const USER_B_ID = 'usr-auth-tenant-b';
const USER_MULTI_ID = 'usr-auth-multi';

before(async () => {
  db.reset();

  // 1. Initialize PGlite database and run all canonical migrations
  pglite = new PGlite();

  await pglite.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE,
      encrypted_password TEXT,
      raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
      phone TEXT,
      email_confirmed_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
    BEGIN
      RETURN '00000000-0000-0000-0000-000000000001'::UUID;
    END;
    $$ LANGUAGE plpgsql STABLE;
  `);

  await pglite.exec(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
      END IF;
    END $$;
  `);

  const migrationsDir = path.resolve(__dirname, '../migrations');
  for (const filename of CANONICAL_MIGRATION_ORDER) {
    const filePath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(filePath, 'utf-8');
    await pglite.exec(sql);
  }

  // 2. Seed canonical organizations in PostgreSQL
  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name, status)
    VALUES 
      ('${ORG_A_ID}'::uuid, 'PT Tenant Alfa Konstruksi', 'Tenant Alfa', 'ACTIVE'),
      ('${ORG_B_ID}'::uuid, 'PT Tenant Beta Properti', 'Tenant Beta', 'ACTIVE');
  `);

  // 3. Connect real PostgresProjectRepository to PGlite
  pgProjectRepo = new PostgresProjectRepository(pglite as any);
  setProjectRepository(pgProjectRepo);

  // 4. Configure identity repository & auth verifier for HTTP tests
  identityRepo = new InMemoryIdentityRepository();
  identityRepo.organizations = [
    { id: ORG_A_ID, legalName: 'PT Tenant Alfa Konstruksi', displayName: 'Tenant Alfa', timezone: 'Asia/Jakarta', defaultCurrency: 'IDR', status: 'ACTIVE' },
    { id: ORG_B_ID, legalName: 'PT Tenant Beta Properti', displayName: 'Tenant Beta', timezone: 'Asia/Jakarta', defaultCurrency: 'IDR', status: 'ACTIVE' }
  ];
  identityRepo.profiles = [
    { id: 'prof-a', authUserId: USER_A_ID, fullName: 'Owner Alfa', status: 'ACTIVE' },
    { id: 'prof-b', authUserId: USER_B_ID, fullName: 'Owner Beta', status: 'ACTIVE' },
    { id: 'prof-multi', authUserId: USER_MULTI_ID, fullName: 'User Multi Org', status: 'ACTIVE' }
  ];
  identityRepo.memberships = [
    { id: 'mem-a', orgId: ORG_A_ID, profileId: 'prof-a', role: 'OWNER', status: 'ACTIVE' },
    { id: 'mem-b', orgId: ORG_B_ID, profileId: 'prof-b', role: 'OWNER', status: 'ACTIVE' },
    { id: 'mem-m1', orgId: ORG_A_ID, profileId: 'prof-multi', role: 'OWNER', status: 'ACTIVE' },
    { id: 'mem-m2', orgId: ORG_B_ID, profileId: 'prof-multi', role: 'QS', status: 'ACTIVE' }
  ];
  setIdentityRepository(identityRepo);

  setTestTokenVerifier(async (token: string) => {
    if (token === 'token-tenant-a') {
      return { user: { id: USER_A_ID, email: 'alfa@cove.id', user_metadata: { full_name: 'Owner Alfa' } }, error: null };
    }
    if (token === 'token-tenant-b') {
      return { user: { id: USER_B_ID, email: 'beta@cove.id', user_metadata: { full_name: 'Owner Beta' } }, error: null };
    }
    if (token === 'token-multi') {
      return { user: { id: USER_MULTI_ID, email: 'multi@cove.id', user_metadata: { full_name: 'User Multi Org' } }, error: null };
    }
    return { user: null, error: 'Token tidak valid' };
  });
});

after(async () => {
  setTestTokenVerifier(null);
  if (pglite) {
    await pglite.close();
  }
});

test('P0B1-01: Tenant A creates project → row stored in PostgreSQL', async () => {
  const res = await app.request('/api/projects', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-tenant-a',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      code: 'ALFA-001',
      name: 'Gedung Menara Alfa',
      customer: 'PT Alfa Properti',
      contract: 12000000000,
      location: 'Jakarta Pusat'
    })
  });

  assert.strictEqual(res.status, 201, 'POST /api/projects must return HTTP 201 Created');
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.code, 'ALFA-001');
  assert.strictEqual(body.data.orgId, ORG_A_ID);

  // Directly verify against PostgreSQL table in PGlite
  const dbRows = await pglite.query<{ project_code: string; org_id: string; status: string }>(
    `SELECT project_code, org_id, status FROM public.projects WHERE id = '${body.data.id}'::uuid`
  );
  assert.strictEqual(dbRows.rows.length, 1, 'Project row must exist in PostgreSQL table');
  assert.strictEqual(dbRows.rows[0].project_code, 'ALFA-001');
  assert.strictEqual(dbRows.rows[0].org_id, ORG_A_ID);
  assert.strictEqual(dbRows.rows[0].status, 'ACTIVE');
});

test('P0B1-02: Project survives repository/backend recreation', async () => {
  // 1. Create project with initial repository instance
  const created = await pgProjectRepo.createProject({
    orgId: ORG_A_ID,
    code: 'ALFA-SURVIVE',
    name: 'Proyek Bertahan',
    customer: 'Klien Abadi',
    contract: 5000000000
  });

  // 2. Re-create a completely brand new repository instance pointing to the same PostgreSQL DB
  const brandNewRepo = new PostgresProjectRepository(pglite as any);

  // 3. Fetch project using the brand new repository instance
  const fetched = await brandNewRepo.getProjectById(ORG_A_ID, created.id);
  assert.ok(fetched, 'Project must be retrievable from newly instantiated repository');
  assert.strictEqual(fetched?.code, 'ALFA-SURVIVE');
  assert.strictEqual(fetched?.name, 'Proyek Bertahan');
  assert.strictEqual(fetched?.contract, 5000000000);
});

test('P0B1-03: Tenant A lists only Tenant A projects', async () => {
  // Create project for Tenant B directly in PostgreSQL
  await pgProjectRepo.createProject({
    orgId: ORG_B_ID,
    code: 'BETA-001',
    name: 'Gedung Beta Tower',
    customer: 'PT Beta Sebelah'
  });

  // Tenant A lists projects via API
  const res = await app.request('/api/projects', {
    headers: { Authorization: 'Bearer token-tenant-a' }
  });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.ok(body.data.length >= 1);

  // Assert NO Tenant B projects exist in Tenant A list
  for (const proj of body.data) {
    assert.strictEqual(proj.orgId, ORG_A_ID, 'Every returned project must belong strictly to Tenant A');
    assert.notStrictEqual(proj.code, 'BETA-001');
  }
});

test('P0B1-04: Tenant B cannot fetch Tenant A project by ID', async () => {
  // 1. Create Tenant A project
  const projA = await pgProjectRepo.createProject({
    orgId: ORG_A_ID,
    code: 'ALFA-SECRET',
    name: 'Proyek Rahasia Alfa'
  });

  // 2. Tenant B attempts to fetch Tenant A project by ID via API
  const res = await app.request(`/api/projects/${projA.id}`, {
    headers: { Authorization: 'Bearer token-tenant-b' }
  });
  assert.strictEqual(res.status, 404, 'Must return 404 and not leak existence of Tenant A project');

  // 3. Directly check repository method
  const crossFetch = await pgProjectRepo.getProjectById(ORG_B_ID, projA.id);
  assert.strictEqual(crossFetch, null, 'Repository must return null when queried with mismatching orgId');
});

test('P0B1-05: Tenant B cannot update Tenant A project', async () => {
  const projA = await pgProjectRepo.createProject({
    orgId: ORG_A_ID,
    code: 'ALFA-IMMUTABLE',
    name: 'Proyek Tetap Alfa'
  });

  // Tenant B attempts to update Tenant A project status
  const res = await app.request(`/api/projects/${projA.id}/status`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer token-tenant-b',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'Diarsipkan' })
  });
  assert.strictEqual(res.status, 404, 'Cross-tenant status update must return 404');

  // Verify status in DB remains Aktif
  const projCheck = await pgProjectRepo.getProjectById(ORG_A_ID, projA.id);
  assert.strictEqual(projCheck?.status, 'Aktif', 'Project status must remain unchanged by cross-tenant attempt');
});

test('P0B1-06: Tenant B cannot archive Tenant A project', async () => {
  const projA = await pgProjectRepo.createProject({
    orgId: ORG_A_ID,
    code: 'ALFA-ARCHIVE-GUARD',
    name: 'Proyek Terlindungi'
  });

  const updateRes = await pgProjectRepo.updateProjectStatus(ORG_B_ID, projA.id, 'Diarsipkan');
  assert.strictEqual(updateRes, null, 'Repository must return null on cross-tenant archive attempt');

  const check = await pgProjectRepo.getProjectById(ORG_A_ID, projA.id);
  assert.strictEqual(check?.status, 'Aktif');
  assert.strictEqual(check?.archivedAt, null);
});

test('P0B1-07: Multi-org user selecting Org A sees only Org A projects', async () => {
  const res = await app.request('/api/projects', {
    headers: {
      Authorization: 'Bearer token-multi',
      'x-organization-id': ORG_A_ID
    }
  });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  for (const proj of body.data) {
    assert.strictEqual(proj.orgId, ORG_A_ID);
  }
});

test('P0B1-08: Switch to Org B → subsequent project requests use Org B', async () => {
  const res = await app.request('/api/projects', {
    headers: {
      Authorization: 'Bearer token-multi',
      'x-organization-id': ORG_B_ID
    }
  });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  for (const proj of body.data) {
    assert.strictEqual(proj.orgId, ORG_B_ID);
  }
});

test('P0B1-09: Missing active org on tenant route fails closed', async () => {
  // User with multiple memberships without x-organization-id header
  const res = await app.request('/api/projects', {
    headers: { Authorization: 'Bearer token-multi' }
  });
  assert.strictEqual(res.status, 400, 'Missing tenant selection must fail closed with 400');
  const body = await res.json();
  assert.strictEqual(body.code, 'TENANT_SELECTION_REQUIRED');
});

test('P0B1-10: Invalid x-organization-id membership → 403', async () => {
  const res = await app.request('/api/projects', {
    headers: {
      Authorization: 'Bearer token-tenant-a',
      'x-organization-id': '99999999-9999-4999-8999-999999999999'
    }
  });
  assert.strictEqual(res.status, 403, 'Unauthorized tenant access must return 403');
});

test('P0B1-11: Duplicate project_code allowed across different orgs', async () => {
  const sharedCode = 'COV-SHARED-001';

  // Org A creates project with sharedCode
  const projA = await pgProjectRepo.createProject({
    orgId: ORG_A_ID,
    code: sharedCode,
    name: 'Alfa Project Shared Code'
  });
  assert.ok(projA.id);

  // Org B creates project with same sharedCode
  const projB = await pgProjectRepo.createProject({
    orgId: ORG_B_ID,
    code: sharedCode,
    name: 'Beta Project Shared Code'
  });
  assert.ok(projB.id);

  assert.strictEqual(projA.code, projB.code);
  assert.notStrictEqual(projA.orgId, projB.orgId);
});

test('P0B1-12: Duplicate project_code rejected inside same org', async () => {
  const dupCode = 'COV-DUP-TEST';

  // 1. First creation inside Org A succeeds
  const resFirst = await app.request('/api/projects', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-tenant-a',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      code: dupCode,
      name: 'Proyek Pertama'
    })
  });
  assert.strictEqual(resFirst.status, 201);

  // 2. Second creation inside Org A with same code fails with 409
  const resSecond = await app.request('/api/projects', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-tenant-a',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      code: dupCode,
      name: 'Proyek Kedua Duplikat'
    })
  });
  assert.strictEqual(resSecond.status, 409, 'Duplicate project_code in same org must return HTTP 409');
});

test('P0B1-13: Project cannot be created with nonexistent organization', async () => {
  const invalidOrgId = '77777777-7777-4777-8777-777777777777';

  await assert.rejects(
    async () => {
      await pgProjectRepo.createProject({
        orgId: invalidOrgId,
        code: 'NONEXISTENT-ORG-PRJ',
        name: 'Proyek Tanpa Org Valid'
      });
    },
    (err: any) => {
      // Must throw foreign key constraint violation (23503)
      return err.code === '23503' || err.message.includes('foreign key');
    },
    'PostgreSQL foreign key constraint must reject nonexistent organization'
  );
});

test('P0B1-14: Production project route does not read cove_db.json', () => {
  const projectsRoutePath = path.resolve(__dirname, '../src/routes/projects.ts');
  const code = fs.readFileSync(projectsRoutePath, 'utf-8');

  // Verify projectsRoute does NOT read db.projects or write to cove_db.json
  assert.strictEqual(
    code.includes('db.projects.filter'),
    false,
    'routes/projects.ts must not read db.projects.filter'
  );
  assert.strictEqual(
    code.includes('db.projects.find'),
    false,
    'routes/projects.ts must not read db.projects.find'
  );
  assert.strictEqual(
    code.includes('db.projects.push'),
    false,
    'routes/projects.ts must not write to db.projects'
  );
  assert.ok(
    code.includes('getProjectRepository()'),
    'routes/projects.ts must use getProjectRepository()'
  );
});

test('P0B1-15: Archived project remains readable but excluded from active list according to product rules', async () => {
  // 1. Create active project in Org A
  const proj = await pgProjectRepo.createProject({
    orgId: ORG_A_ID,
    code: 'ALFA-LIFECYCLE-01',
    name: 'Proyek Siklus Hidup'
  });

  // 2. Archive project
  const archiveRes = await app.request(`/api/projects/${proj.id}/status`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer token-tenant-a',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'Diarsipkan' })
  });
  assert.strictEqual(archiveRes.status, 200);
  const archivedBody = await archiveRes.json();
  assert.strictEqual(archivedBody.data.status, 'Diarsipkan');

  // 3. Query active projects (archived=false): must NOT include archived project
  const resActive = await app.request('/api/projects?archived=false', {
    headers: { Authorization: 'Bearer token-tenant-a' }
  });
  assert.strictEqual(resActive.status, 200);
  const activeList = await resActive.json();
  const foundInActive = activeList.data.some((p: any) => p.id === proj.id);
  assert.strictEqual(foundInActive, false, 'Archived project must be excluded from active list');

  // 4. Query archived projects (archived=true): MUST include archived project
  const resArchived = await app.request('/api/projects?archived=true', {
    headers: { Authorization: 'Bearer token-tenant-a' }
  });
  assert.strictEqual(resArchived.status, 200);
  const archivedList = await resArchived.json();
  const foundInArchived = archivedList.data.some((p: any) => p.id === proj.id);
  assert.strictEqual(foundInArchived, true, 'Archived project must be present in archived list');

  // 5. Fetch project directly by ID: remains readable
  const resDirect = await app.request(`/api/projects/${proj.id}`, {
    headers: { Authorization: 'Bearer token-tenant-a' }
  });
  assert.strictEqual(resDirect.status, 200);
  const directBody = await resDirect.json();
  assert.strictEqual(directBody.data.project.id, proj.id);
  assert.strictEqual(directBody.data.project.status, 'Diarsipkan');
});
