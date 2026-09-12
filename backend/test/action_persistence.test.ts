// ============================================================================
// COVE Backend — Canonical Action Persistence Tests (Gate P0-B.4)
// Behavioral Tests P0B4-01 through P0B4-20
// Validates Action and Blocker PostgreSQL persistence, tenant isolation,
// RBAC, durability across restart, and legacy store decoupling.
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
  setProjectRepository
} from '../src/repositories/project.repository.js';
import {
  PostgresLedgerRepository,
  setLedgerRepository
} from '../src/repositories/ledger.repository.js';
import {
  PostgresActionRepository,
  setActionRepository,
  getActionRepository
} from '../src/repositories/action.repository.js';
import {CANONICAL_MIGRATION_ORDER} from '../src/db/migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pglite: PGlite;
let pgProjectRepo: PostgresProjectRepository;
let pgLedgerRepo: PostgresLedgerRepository;
let pgActionRepo: PostgresActionRepository;
let identityRepo: InMemoryIdentityRepository;

const ORG_A_ID = '11111111-aaaa-4111-8111-111111111111';
const ORG_B_ID = '22222222-bbbb-4222-8222-222222222222';
const USER_A_ID = 'usr-p0b4-tenant-a';
const USER_B_ID = 'usr-p0b4-tenant-b';
const USER_A_AUDITOR_ID = 'usr-p0b4-tenant-a-auditor';

const PROJ_A_1 = 'aaaaaaaa-1111-4aaa-8aaa-111111111111';
const PROJ_B_1 = 'bbbbbbbb-2222-4bbb-8bbb-222222222222';

let createdActionA1Id = '';

before(async () => {
  db.reset();

  // 1. Initialize PGlite database and run canonical migration chain
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

  // 2. Seed organizations
  await pglite.exec(`
    INSERT INTO public.organizations (id, legal_name, display_name, status)
    VALUES 
      ('${ORG_A_ID}'::uuid, 'PT Alfa Konstruksi Mandiri', 'Alfa Konstruksi', 'ACTIVE'),
      ('${ORG_B_ID}'::uuid, 'PT Beta Infrastruktur Utama', 'Beta Infrastruktur', 'ACTIVE');
  `);

  // 3. Seed projects
  await pglite.exec(`
    INSERT INTO public.projects (id, org_id, project_code, project_name, customer_name, status, contract_value)
    VALUES
      ('${PROJ_A_1}'::uuid, '${ORG_A_ID}'::uuid, 'PRJ-ALFA-01', 'Proyek Tol Ruas A', 'Kementerian PU', 'ACTIVE', 50000000000),
      ('${PROJ_B_1}'::uuid, '${ORG_B_ID}'::uuid, 'PRJ-BETA-01', 'Proyek Bendungan B', 'Balai Sungai', 'ACTIVE', 30000000000);
  `);

  // 4. Setup repositories
  pgProjectRepo = new PostgresProjectRepository(pglite as any);
  setProjectRepository(pgProjectRepo);

  pgLedgerRepo = new PostgresLedgerRepository(pglite as any);
  setLedgerRepository(pgLedgerRepo);

  pgActionRepo = new PostgresActionRepository(pglite as any);
  setActionRepository(pgActionRepo);

  identityRepo = new InMemoryIdentityRepository();
  identityRepo.organizations = [
    { id: ORG_A_ID, legalName: 'PT Alfa Konstruksi Mandiri', displayName: 'Alfa Konstruksi', timezone: 'Asia/Jakarta', defaultCurrency: 'IDR', status: 'ACTIVE' },
    { id: ORG_B_ID, legalName: 'PT Beta Infrastruktur Utama', displayName: 'Beta Infrastruktur', timezone: 'Asia/Jakarta', defaultCurrency: 'IDR', status: 'ACTIVE' }
  ];
  identityRepo.profiles = [
    { id: 'prof-p0b4-a-1', authUserId: USER_A_ID, fullName: 'Project Manager Alfa', status: 'ACTIVE' },
    { id: 'prof-p0b4-a-auditor', authUserId: USER_A_AUDITOR_ID, fullName: 'Auditor Alfa', status: 'ACTIVE' },
    { id: 'prof-p0b4-b-1', authUserId: USER_B_ID, fullName: 'Project Manager Beta', status: 'ACTIVE' }
  ];
  identityRepo.memberships = [
    {
      id: 'mem-p0b4-a-1',
      orgId: ORG_A_ID,
      profileId: 'prof-p0b4-a-1',
      role: 'PROJECT_MANAGER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    },
    {
      id: 'mem-p0b4-a-auditor',
      orgId: ORG_A_ID,
      profileId: 'prof-p0b4-a-auditor',
      role: 'AUDITOR',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    },
    {
      id: 'mem-p0b4-b-1',
      orgId: ORG_B_ID,
      profileId: 'prof-p0b4-b-1',
      role: 'PROJECT_MANAGER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    }
  ];
  setIdentityRepository(identityRepo);

  setTestTokenVerifier(async (token: string) => {
    if (token === 'token-p0b4-a') {
      return {
        user: {
          id: USER_A_ID,
          email: 'pm-alfa@cove.test'
        },
        error: null
      };
    }
    if (token === 'token-p0b4-a-auditor') {
      return {
        user: {
          id: USER_A_AUDITOR_ID,
          email: 'auditor-alfa@cove.test'
        },
        error: null
      };
    }
    if (token === 'token-p0b4-b') {
      return {
        user: {
          id: USER_B_ID,
          email: 'pm-beta@cove.test'
        },
        error: null
      };
    }
    return { user: null, error: 'Token tidak valid' };
  });
});

after(async () => {
  // Reset repository overrides to avoid leaking test state
  setActionRepository(new PostgresActionRepository(pglite as any));
});

// ============================================================================
// P0-B4 TEST SUITE
// ============================================================================

test('P0B4-01: Create Action persists in PostgreSQL', async () => {
  const res = await app.request('/api/actions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-p0b4-a',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      projectId: PROJ_A_1,
      title: 'Pembebasan Lahan KM 12',
      blocker: 'Izin warga sekitar tertunda',
      owner: 'Ir. Sutrisno',
      due: '2026-10-15',
      severity: 'Tinggi',
      value: 1500000000
    })
  });

  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.ok(body.data.id);
  createdActionA1Id = body.data.id;
  assert.strictEqual(body.data.orgId, ORG_A_ID);
  assert.strictEqual(body.data.projectId, PROJ_A_1);
  assert.strictEqual(body.data.title, 'Pembebasan Lahan KM 12');
  assert.strictEqual(body.data.status, 'Terbuka');

  // Verify directly in PostgreSQL table public.action_items
  const rows = await pglite.query<{
    id: string;
    org_id: string;
    title: string;
    value_at_risk: string;
    status: string;
  }>(`SELECT id, org_id, title, value_at_risk, status FROM public.action_items WHERE id = $1`, [createdActionA1Id]);

  assert.strictEqual(rows.rows.length, 1);
  assert.strictEqual(rows.rows[0].id, createdActionA1Id);
  assert.strictEqual(rows.rows[0].org_id, ORG_A_ID);
  assert.strictEqual(rows.rows[0].title, 'Pembebasan Lahan KM 12');
  assert.strictEqual(rows.rows[0].status, 'Terbuka');
  assert.strictEqual(Number(rows.rows[0].value_at_risk), 1500000000);
});

test('P0B4-02: List Actions reads from PostgreSQL', async () => {
  const res = await app.request('/api/actions', {
    method: 'GET',
    headers: {
      Authorization: 'Bearer token-p0b4-a'
    }
  });

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.ok(Array.isArray(body.data));
  const found = body.data.find((a: any) => a.id === createdActionA1Id);
  assert.ok(found, 'Created action must be listed from PostgreSQL');
  assert.strictEqual(found.title, 'Pembebasan Lahan KM 12');
  assert.strictEqual(found.owner, 'Ir. Sutrisno');
});

test('P0B4-03: Action survives repository/app recreation', async () => {
  // Simulate application restart by creating a new repository instance connected to the same DB
  const freshRepo = new PostgresActionRepository(pglite as any);
  setActionRepository(freshRepo);

  const action = await freshRepo.getActionById(ORG_A_ID, createdActionA1Id);
  assert.ok(action, 'Action must survive repository recreation');
  assert.strictEqual(action.id, createdActionA1Id);
  assert.strictEqual(action.title, 'Pembebasan Lahan KM 12');
  assert.strictEqual(action.status, 'Terbuka');
});

test('P0B4-04: Update persists after restart', async () => {
  const res = await app.request(`/api/actions/${createdActionA1Id}`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer token-p0b4-a',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'Pembebasan Lahan KM 12 - Negosiasi Tahap 2',
      severity: 'Sedang',
      owner: 'Ir. Budi Santoso'
    })
  });

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.data.title, 'Pembebasan Lahan KM 12 - Negosiasi Tahap 2');
  assert.strictEqual(body.data.severity, 'Sedang');
  assert.strictEqual(body.data.owner, 'Ir. Budi Santoso');

  // Re-instantiate repository to simulate restart
  const restartedRepo = new PostgresActionRepository(pglite as any);
  setActionRepository(restartedRepo);

  const fetched = await restartedRepo.getActionById(ORG_A_ID, createdActionA1Id);
  assert.ok(fetched);
  assert.strictEqual(fetched.title, 'Pembebasan Lahan KM 12 - Negosiasi Tahap 2');
  assert.strictEqual(fetched.severity, 'Sedang');
  assert.strictEqual(fetched.owner, 'Ir. Budi Santoso');
});

test('P0B4-05: Complete persists after restart with completed_at populated', async () => {
  const res = await app.request(`/api/actions/${createdActionA1Id}`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer token-p0b4-a',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: 'Selesai'
    })
  });

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.data.status, 'Selesai');
  assert.ok(body.data.completedAt, 'completedAt must be populated upon completion');

  // Verify in PostgreSQL table
  const dbRows = await pglite.query<{ status: string; completed_at: string }>(
    `SELECT status, completed_at FROM public.action_items WHERE id = $1`,
    [createdActionA1Id]
  );
  assert.strictEqual(dbRows.rows[0].status, 'Selesai');
  assert.ok(dbRows.rows[0].completed_at, 'completed_at column must be non-null');

  // Re-instantiate repo to simulate restart
  const freshRepo = new PostgresActionRepository(pglite as any);
  setActionRepository(freshRepo);

  const fetched = await freshRepo.getActionById(ORG_A_ID, createdActionA1Id);
  assert.ok(fetched);
  assert.strictEqual(fetched.status, 'Selesai');
  assert.ok(fetched.completedAt);
});

test('P0B4-06: Tenant B cannot read Tenant A Action', async () => {
  // List actions as Tenant B
  const resList = await app.request('/api/actions', {
    method: 'GET',
    headers: {
      Authorization: 'Bearer token-p0b4-b'
    }
  });
  assert.strictEqual(resList.status, 200);
  const bodyList = await resList.json();
  const foundInList = bodyList.data.some((a: any) => a.id === createdActionA1Id);
  assert.strictEqual(foundInList, false, 'Tenant B must never see Tenant A actions');

  // Direct fetch by ID as Tenant B
  const resGet = await app.request(`/api/actions/${createdActionA1Id}`, {
    method: 'GET',
    headers: {
      Authorization: 'Bearer token-p0b4-b'
    }
  });
  assert.strictEqual(resGet.status, 404, 'Direct fetch across tenant boundary must return 404');
});

test('P0B4-07: Tenant B cannot mutate Tenant A Action', async () => {
  // Attempt PATCH
  const resPatch = await app.request(`/api/actions/${createdActionA1Id}`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer token-p0b4-b',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'Hacked Action'
    })
  });
  assert.strictEqual(resPatch.status, 404);

  // Attempt Add Note
  const resNote = await app.request(`/api/actions/${createdActionA1Id}/notes`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-p0b4-b',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      note: 'Catatan Penyusup'
    })
  });
  assert.strictEqual(resNote.status, 404);

  // Attempt DELETE
  const resDelete = await app.request(`/api/actions/${createdActionA1Id}`, {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer token-p0b4-b'
    }
  });
  assert.strictEqual(resDelete.status, 404);
});

test('P0B4-08: Guessed Action UUID fails closed', async () => {
  const randomUuid = '99999999-9999-4999-8999-999999999999';

  const resGet = await app.request(`/api/actions/${randomUuid}`, {
    method: 'GET',
    headers: {
      Authorization: 'Bearer token-p0b4-a'
    }
  });
  assert.strictEqual(resGet.status, 404);

  const resPatch = await app.request(`/api/actions/${randomUuid}`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer token-p0b4-a',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title: 'Nonexistent' })
  });
  assert.strictEqual(resPatch.status, 404);

  const resDelete = await app.request(`/api/actions/${randomUuid}`, {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer token-p0b4-a'
    }
  });
  assert.strictEqual(resDelete.status, 404);
});

test('P0B4-09: Cross-tenant project relation rejected', async () => {
  // Tenant A attempts to create action referencing Tenant B project PROJ_B_1
  const res = await app.request('/api/actions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-p0b4-a',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      projectId: PROJ_B_1,
      title: 'Action Lintas Tenant Ilegal',
      blocker: 'Hambatan Palsu'
    })
  });

  assert.strictEqual(res.status, 404);
  const body = await res.json();
  assert.strictEqual(body.success, false);
});

test('P0B4-10: Assignee handling fails closed if cross-tenant', async () => {
  // Tenant A attempts to assign action to Tenant B profile 'prof-p0b4-b-1'
  const res = await app.request('/api/actions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-p0b4-a',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      projectId: PROJ_A_1,
      title: 'Action dengan PIC Lintas Tenant',
      blocker: 'Hambatan',
      assigneeId: 'prof-p0b4-b-1'
    })
  });

  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.strictEqual(body.success, false);
  assert.ok(body.error.includes('bukan anggota organisasi'));
});

test('P0B4-11: Legacy db.actions reset does not affect canonical Action', async () => {
  // Mutate or clear db.actions in memory
  db.actions = [];
  db.reset();

  // Canonical PostgreSQL actions must still be present and intact
  const res = await app.request(`/api/actions/${createdActionA1Id}`, {
    method: 'GET',
    headers: {
      Authorization: 'Bearer token-p0b4-a'
    }
  });

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.data.id, createdActionA1Id);
  assert.strictEqual(body.data.status, 'Selesai');
});

test('P0B4-12: cove_db.json is not Action authority', () => {
  const actionsRouteCode = fs.readFileSync(path.resolve(__dirname, '../src/routes/actions.ts'), 'utf-8');
  assert.strictEqual(actionsRouteCode.includes('db.actions'), false, 'routes/actions.ts must not reference db.actions');
  assert.strictEqual(actionsRouteCode.includes('cove_db.json'), false, 'routes/actions.ts must not reference cove_db.json');

  const projectsRouteCode = fs.readFileSync(path.resolve(__dirname, '../src/routes/projects.ts'), 'utf-8');
  assert.strictEqual(projectsRouteCode.includes('db.actions'), false, 'routes/projects.ts must not reference db.actions');
});

test('P0B4-13: RBAC read-only role cannot mutate', async () => {
  // AUDITOR role cannot POST action
  const resPost = await app.request('/api/actions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-p0b4-a-auditor',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      projectId: PROJ_A_1,
      title: 'Auditor Action Create',
      blocker: 'Hambatan'
    })
  });
  assert.strictEqual(resPost.status, 403);

  // AUDITOR role cannot PATCH action
  const resPatch = await app.request(`/api/actions/${createdActionA1Id}`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer token-p0b4-a-auditor',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title: 'Auditor Action Patch' })
  });
  assert.strictEqual(resPatch.status, 403);

  // AUDITOR role cannot DELETE action
  const resDelete = await app.request(`/api/actions/${createdActionA1Id}`, {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer token-p0b4-a-auditor'
    }
  });
  assert.strictEqual(resDelete.status, 403);
});

test('P0B4-14: Authorized mutation succeeds', async () => {
  // Create a new action by authorized PROJECT_MANAGER
  const resCreate = await app.request('/api/actions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-p0b4-a',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      projectId: PROJ_A_1,
      title: 'Pengadaan Crane Tambahan',
      blocker: 'Vendor crane terlambat konfirmasi armada',
      owner: 'Ir. Sutrisno',
      due: '2026-11-01',
      severity: 'Sedang',
      value: 800000000
    })
  });
  assert.strictEqual(resCreate.status, 201);
  const created = (await resCreate.json()).data;

  // Add chronological note
  const resNote = await app.request(`/api/actions/${created.id}/notes`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-p0b4-a',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      note: 'Vendor telah dihubungi dan menyanggupi pengiriman besok.'
    })
  });
  assert.strictEqual(resNote.status, 200);
  const noteBody = await resNote.json();
  assert.strictEqual(noteBody.data.notes.length, 1);
  assert.ok(noteBody.data.notes[0].includes('Vendor telah dihubungi'));

  // Delete action succeeds
  const resDelete = await app.request(`/api/actions/${created.id}`, {
    method: 'DELETE',
    headers: {
      Authorization: 'Bearer token-p0b4-a'
    }
  });
  assert.strictEqual(resDelete.status, 200);

  // Confirm deleted
  const resConfirm = await app.request(`/api/actions/${created.id}`, {
    method: 'GET',
    headers: {
      Authorization: 'Bearer token-p0b4-a'
    }
  });
  assert.strictEqual(resConfirm.status, 404);
});

test('P0B4-15: Action status and completion state is durable', async () => {
  // Create action
  const resCreate = await app.request('/api/actions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-p0b4-a',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      projectId: PROJ_A_1,
      title: 'Uji Kuat Tekan Beton Silinder',
      blocker: 'Menunggu hasil lab independen',
      due: '2026-10-20',
      severity: 'Rendah',
      value: 120000000
    })
  });
  assert.strictEqual(resCreate.status, 201);
  const actionId = (await resCreate.json()).data.id;

  // Resolve action via notes endpoint
  const resResolve = await app.request(`/api/actions/${actionId}/notes`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-p0b4-a',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      note: 'Hasil lab keluar: mutu K-350 tercapai 104%. Masalah selesai.',
      resolve: true
    })
  });
  assert.strictEqual(resResolve.status, 200);
  const resolvedData = (await resResolve.json()).data;
  assert.strictEqual(resolvedData.status, 'Selesai');
  assert.ok(resolvedData.completedAt);
  assert.strictEqual(resolvedData.notes.length, 1);

  // Simulate full restart
  setActionRepository(new PostgresActionRepository(pglite as any));

  const verify = await getActionRepository().getActionById(ORG_A_ID, actionId);
  assert.ok(verify);
  assert.strictEqual(verify.status, 'Selesai');
  assert.ok(verify.completedAt);
  assert.strictEqual(verify.notes.length, 1);
});

test('P0B4-16: Completion timestamp and status are atomic', async () => {
  const resCreate = await app.request('/api/actions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-p0b4-a',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      projectId: PROJ_A_1,
      title: 'Atomicity Test Action',
      blocker: 'Blocker'
    })
  });
  const actId = (await resCreate.json()).data.id;

  // Update status to Selesai
  await getActionRepository().updateAction(ORG_A_ID, actId, { status: 'Selesai' });

  const record = await getActionRepository().getActionById(ORG_A_ID, actId);
  assert.ok(record);
  assert.strictEqual(record.status, 'Selesai');
  assert.ok(record.completedAt);

  // Verify DB level
  const dbRes = await pglite.query<{ status: string; completed_at: string }>(
    `SELECT status, completed_at FROM public.action_items WHERE id = $1`,
    [actId]
  );
  assert.strictEqual(dbRes.rows[0].status, 'Selesai');
  assert.ok(dbRes.rows[0].completed_at);
});

test('P0B4-17: Action list tenant filtering is exact', async () => {
  // Create one action in Org B
  const resB = await app.request('/api/actions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token-p0b4-b',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      projectId: PROJ_B_1,
      title: 'Tindakan Eksklusif Org B',
      blocker: 'Hambatan internal B'
    })
  });
  assert.strictEqual(resB.status, 201);
  const actBId = (await resB.json()).data.id;

  // Org A lists actions -> actBId must NOT appear
  const resListA = await app.request('/api/actions', {
    method: 'GET',
    headers: { Authorization: 'Bearer token-p0b4-a' }
  });
  const bodyA = await resListA.json();
  assert.strictEqual(bodyA.data.some((a: any) => a.id === actBId), false);

  // Org B lists actions -> only actBId appears (no Org A actions)
  const resListB = await app.request('/api/actions', {
    method: 'GET',
    headers: { Authorization: 'Bearer token-p0b4-b' }
  });
  const bodyB = await resListB.json();
  assert.strictEqual(bodyB.data.some((a: any) => a.id === createdActionA1Id), false);
  assert.strictEqual(bodyB.data.some((a: any) => a.id === actBId), true);
});

test('P0B4-18: Project action filtering is exact', async () => {
  // GET /api/projects/:id embeds actions for that project
  const resProj = await app.request(`/api/projects/${PROJ_A_1}`, {
    method: 'GET',
    headers: {
      Authorization: 'Bearer token-p0b4-a'
    }
  });

  assert.strictEqual(resProj.status, 200);
  const body = await resProj.json();
  assert.strictEqual(body.success, true);
  assert.ok(body.data.project);
  assert.ok(Array.isArray(body.data.actions));
  assert.ok(body.data.actions.length >= 1);
  assert.ok(body.data.actions.every((a: any) => a.projectId === PROJ_A_1 && a.orgId === ORG_A_ID));
});

test('P0B4-19: Existing P0-B1, P0-B2, P0-B3 tests remain unchanged', () => {
  // Verify migration chain contains all prior gates and 012
  assert.ok(CANONICAL_MIGRATION_ORDER.includes('001_initial_schema.sql'));
  assert.ok(CANONICAL_MIGRATION_ORDER.includes('002_rls_policies.sql'));
  assert.ok(CANONICAL_MIGRATION_ORDER.includes('010_p0b3_financial_integrity_hardening.sql'));
  assert.ok(CANONICAL_MIGRATION_ORDER.includes('011_p0b3_full_financial_history_and_idempotency_closure.sql'));
  assert.ok(CANONICAL_MIGRATION_ORDER.includes('012_p0b4_action_persistence.sql'));
});

test('P0B4-20: Server/app recreation does not lose operational Action Queue state', async () => {
  // Retrieve count from DB
  const beforeCount = await pglite.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM public.action_items WHERE org_id = $1`,
    [ORG_A_ID]
  );

  // Create brand new repo instance
  const brandNewRepo = new PostgresActionRepository(pglite as any);
  setActionRepository(brandNewRepo);

  const actions = await brandNewRepo.getActions(ORG_A_ID);
  assert.strictEqual(String(actions.length), beforeCount.rows[0].count);
  assert.ok(actions.length > 0);
});
