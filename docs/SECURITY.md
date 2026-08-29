# COVE Security & Authorization Architecture

## 1. Multi-Tenant Isolation (Release Blocker)

COVE stores financially sensitive information including contractor contract values, claims, dispute notes, and payment dates.

### Security Principles:
1. **Database-Enforced RLS**: Row Level Security is active on every single tenant-owned table.
2. **Server-Side Identity Derivation**: Organization ID is never trusted from client-submitted JSON bodies; it is derived server-side from the authenticated JWT session.
3. **No Service-Role Leak**: `SUPABASE_SERVICE_ROLE_KEY` is strictly reserved for server-only background processes and is never exposed in browser bundles (`NEXT_PUBLIC_`).

---

## 2. 9 Defined Roles & RBAC Matrix

| Role | Scope | Claims | Invoices | Cash Receipts | Actions | Settings / Admin |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **OWNER** | Portfolio Wide | Read | Read | Read | Manage | Full Access |
| **ADMIN** | Portfolio Wide | Read | Read | Read | Manage | Full Access |
| **COMMERCIAL_MANAGER** | Assigned Projects | Full CRUD | Read | Read | Full CRUD | Restricted |
| **QS** | Assigned Projects | Full CRUD | Read | - | Full CRUD | Restricted |
| **FINANCE_MANAGER** | Portfolio Wide | Read | Full CRUD | Full CRUD | Full CRUD | Restricted |
| **PROJECT_MANAGER** | Assigned Projects | Read | Read | Read | Manage | Restricted |
| **PROJECT_CONTROL** | Portfolio Wide | Read | Read | Read | Read | Restricted |
| **PROCUREMENT** | Assigned Projects | Read | - | - | Read | Restricted |
| **VIEWER** | Assigned Projects | Read-only | Read-only | Read-only | Read-only | No Access |

---

## 3. Storage Boundary

Document storage follows the folder structure:
```text
organizations/{organization_id}/projects/{project_id}/{entity_type}/{entity_id}/{filename}
```
Storage RLS policies verify that the requesting user belongs to `organization_id`.
