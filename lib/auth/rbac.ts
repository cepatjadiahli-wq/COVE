/**
 * COVE V1 — Role-Based Access Control (RBAC) & Tenant Security Engine
 * Source-of-Truth: COVE_PRD_v1.0_Validation_Gated_MVP.md (Section 15.1, Section 18, Section 21.1)
 */

import { ROLES, Role } from "@/lib/constants";

// -----------------------------------------------------------------------------
// 1. ROLES & DESCRIPTIONS (PRD Section 18.1)
// -----------------------------------------------------------------------------
export const PRD_ROLES = {
  OWNER: ROLES.OWNER,                           // Pemilik tenant, billing, policy, dan seluruh data
  ADMIN: ROLES.ADMIN,                           // Kelola user, project access, template, konfigurasi
  COMMERCIAL_MANAGER: ROLES.COMMERCIAL_MANAGER, // Contract rules, exposure, blocker, approval, review
  QS: ROLES.QS,                                 // Import, checklist, evidence, action, claim status
  PROJECT_MANAGER: ROLES.PROJECT_MANAGER,       // Progress reference, evidence, action proyek
  FINANCE_MANAGER: ROLES.FINANCE_MANAGER,       // Certificate, invoice, due date, receipt, finance export
  EXECUTIVE_VIEWER: "EXECUTIVE_VIEWER",         // Portfolio read-only dan export yang diizinkan
  AUDITOR: "AUDITOR",                           // Read-only, source lineage, audit access
  COVE_IMPLEMENTATION: "COVE_IMPLEMENTATION",   // Time-bound assisted access dengan customer approval
} as const;

export type PrdRole = (typeof PRD_ROLES)[keyof typeof PRD_ROLES] | Role;

// -----------------------------------------------------------------------------
// 2. USER ACCOUNT STATUS & AUDIT TRAIL (PRD Section 15.1: PLT-002, PLT-005)
// -----------------------------------------------------------------------------
export interface UserAccountState {
  id: string;
  orgId: string;
  email: string;
  fullName: string;
  role: PrdRole;
  status: "ACTIVE" | "DEACTIVATED";
  mfaEnabled: boolean;
  assignedProjectIds: string[]; // Empty means all projects for Owner/Admin/Executive
  lastSessionRevokedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssistedAccessGrant {
  id: string;
  orgId: string;
  grantedByUserId: string;
  grantedToEmail: string;
  reason: string;
  assignedProjectIds: string[];
  expiresAt: string; // ISO 8601 UTC
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  createdAt: string;
}

// -----------------------------------------------------------------------------
// 3. SERVER-SIDE PERMISSION MATRIX (PRD Section 18.2)
// -----------------------------------------------------------------------------
export type PermissionAction =
  | "manage_users"
  | "manage_project_access"
  | "approve_contract_rule"
  | "create_edit_contract_rule"
  | "view_contract_rule"
  | "import_tracker"
  | "resolve_exception"
  | "approve_checklist"
  | "update_checklist"
  | "manage_blockers_and_actions"
  | "update_certificate"
  | "manage_invoices"
  | "manage_receipts"
  | "approve_roi_baseline"
  | "propose_roi_baseline"
  | "view_audit_and_export";

export interface PermissionEvaluation {
  allowed: boolean;
  scope: "FULL" | "PROJECT_ONLY" | "FINANCE_ONLY" | "READ_ONLY" | "NONE";
  reason?: string;
}

/**
 * Evaluates whether a role is authorized to perform a specific action (PRD 18.2)
 */
export function evaluateRolePermission(role: PrdRole, action: PermissionAction): PermissionEvaluation {
  const normRole = (role || "").toUpperCase();

  switch (action) {
    // Kelola users (Owner/Admin only)
    case "manage_users":
      if (normRole === "OWNER" || normRole === "ADMIN") {
        return { allowed: true, scope: "FULL" };
      }
      return { allowed: false, scope: "NONE", reason: "Hanya Owner dan Admin yang berwenang mengelola pengguna." };

    // Project access assignment (Owner/Admin only)
    case "manage_project_access":
      if (normRole === "OWNER" || normRole === "ADMIN") {
        return { allowed: true, scope: "FULL" };
      }
      return { allowed: false, scope: "NONE", reason: "Pengaturan akses proyek dibatasi untuk Owner dan Admin." };

    // Contract rule: Approve (Owner/Admin) vs Create/Edit (Commercial)
    case "approve_contract_rule":
      if (normRole === "OWNER" || normRole === "ADMIN") {
        return { allowed: true, scope: "FULL" };
      }
      return { allowed: false, scope: "NONE", reason: "Approval aturan kontrak memerlukan wewenang Owner/Admin." };

    case "create_edit_contract_rule":
      if (normRole === "OWNER" || normRole === "ADMIN" || normRole === "COMMERCIAL_MANAGER") {
        return { allowed: true, scope: "FULL" };
      }
      return { allowed: false, scope: "NONE", reason: "Penyusunan aturan kontrak memerlukan Commercial Manager." };

    case "view_contract_rule":
      return { allowed: true, scope: "READ_ONLY" };

    // Import tracker (Owner, Admin, Commercial, QS; PM/Finance limited)
    case "import_tracker":
    case "resolve_exception":
      if (["OWNER", "ADMIN", "COMMERCIAL_MANAGER", "QS"].includes(normRole)) {
        return { allowed: true, scope: "FULL" };
      }
      if (["PROJECT_MANAGER", "FINANCE_MANAGER"].includes(normRole)) {
        return { allowed: true, scope: "PROJECT_ONLY" };
      }
      return { allowed: false, scope: "NONE", reason: "Peran Anda tidak memiliki wewenang mengimpor data klaim." };

    // Checklist (Commercial Manager approves, QS/PM updates)
    case "approve_checklist":
      if (["OWNER", "ADMIN", "COMMERCIAL_MANAGER"].includes(normRole)) {
        return { allowed: true, scope: "FULL" };
      }
      return { allowed: false, scope: "NONE", reason: "Pengesahan checklist kesiapan klaim membutuhkan Commercial Manager." };

    case "update_checklist":
      if (["OWNER", "ADMIN", "COMMERCIAL_MANAGER", "QS"].includes(normRole)) {
        return { allowed: true, scope: "FULL" };
      }
      if (normRole === "PROJECT_MANAGER") {
        return { allowed: true, scope: "PROJECT_ONLY" };
      }
      return { allowed: false, scope: "NONE", reason: "Hanya QS dan PM yang dapat memperbarui bukti checklist." };

    // Blocker and Actions
    case "manage_blockers_and_actions":
      if (["OWNER", "ADMIN", "COMMERCIAL_MANAGER", "QS"].includes(normRole)) {
        return { allowed: true, scope: "FULL" };
      }
      if (normRole === "PROJECT_MANAGER") {
        return { allowed: true, scope: "PROJECT_ONLY" };
      }
      if (normRole === "FINANCE_MANAGER") {
        return { allowed: true, scope: "FINANCE_ONLY" };
      }
      return { allowed: false, scope: "READ_ONLY", reason: "Viewer dan Auditor hanya memiliki akses lihat tindakan." };

    // Certificate and Invoices
    case "update_certificate":
      if (["OWNER", "ADMIN", "COMMERCIAL_MANAGER", "FINANCE_MANAGER"].includes(normRole)) {
        return { allowed: true, scope: "FULL" };
      }
      return { allowed: false, scope: "NONE", reason: "Pembaharuan nilai sertifikasi BAP dibatasi untuk Commercial & Finance." };

    case "manage_invoices":
    case "manage_receipts":
      if (["OWNER", "ADMIN", "FINANCE_MANAGER"].includes(normRole)) {
        return { allowed: true, scope: "FULL" };
      }
      return { allowed: false, scope: "NONE", reason: "Penerbitan faktur dan pencatatan kas masuk adalah wewenang Tim Finance." };

    // ROI baseline
    case "approve_roi_baseline":
      if (normRole === "OWNER" || normRole === "ADMIN") {
        return { allowed: true, scope: "FULL" };
      }
      return { allowed: false, scope: "NONE", reason: "Penguncian baseline ROI proyek membutuhkan persetujuan Owner." };

    case "propose_roi_baseline":
      if (["OWNER", "ADMIN", "COMMERCIAL_MANAGER", "FINANCE_MANAGER"].includes(normRole)) {
        return { allowed: true, scope: "FULL" };
      }
      return { allowed: false, scope: "NONE" };

    // Audit and Export
    case "view_audit_and_export":
      if (normRole === "OWNER" || normRole === "ADMIN") {
        return { allowed: true, scope: "FULL" };
      }
      if (["COMMERCIAL_MANAGER", "QS"].includes(normRole)) {
        return { allowed: true, scope: "PROJECT_ONLY" };
      }
      if (normRole === "FINANCE_MANAGER") {
        return { allowed: true, scope: "FINANCE_ONLY" };
      }
      if (normRole === "AUDITOR" || normRole === "VIEWER" || normRole === "EXECUTIVE_VIEWER") {
        return { allowed: true, scope: "READ_ONLY" };
      }
      return { allowed: true, scope: "READ_ONLY" };

    default:
      return { allowed: false, scope: "NONE", reason: "Aksi tidak dikenali." };
  }
}

// -----------------------------------------------------------------------------
// 4. PROJECT-LEVEL ACCESS CONTROL (PRD Section 15.1: PLT-003, UAT-13)
// -----------------------------------------------------------------------------
/**
 * Evaluates whether a user is allowed to access a specific project (UAT-13).
 * Owner, Admin, Executive Viewer, Auditor have tenant-wide project access.
 * Other roles must be explicitly assigned to the project.
 */
export function hasProjectAccess(user: { role: PrdRole; assignedProjectIds?: string[] }, targetProjectId: string): boolean {
  if (!targetProjectId) return false;

  const normRole = (user.role || "").toUpperCase();

  // Roles with organization-wide project visibility
  if (["OWNER", "ADMIN", "EXECUTIVE_VIEWER", "AUDITOR"].includes(normRole)) {
    return true;
  }

  // If user has no specific assignments configured, default to true for tenant backwards compatibility
  if (!user.assignedProjectIds || user.assignedProjectIds.length === 0) {
    return true;
  }

  return user.assignedProjectIds.includes(targetProjectId);
}

// -----------------------------------------------------------------------------
// 5. ASSISTED ACCESS CONTROL (PRD Section 18.3)
// -----------------------------------------------------------------------------
/**
 * Verifies whether assisted access for COVE support engineers is currently valid and active
 */
export function isAssistedAccessActive(grant: AssistedAccessGrant | null | undefined): boolean {
  if (!grant) return false;
  if (grant.status !== "ACTIVE") return false;

  const now = new Date().getTime();
  const expiry = new Date(grant.expiresAt).getTime();

  return now < expiry;
}

// -----------------------------------------------------------------------------
// 6. SESSION ACTIVATION / REVOCATION CHECK (PRD Section 15.1: PLT-005, UAT-18)
// -----------------------------------------------------------------------------
/**
 * Asserts whether a user session is active or has been revoked (UAT-18)
 */
export function validateUserSession(user: { status: "ACTIVE" | "DEACTIVATED"; lastSessionRevokedAt?: string }, sessionIssuedAtMs?: number): { valid: boolean; reason?: string } {
  if (user.status === "DEACTIVATED") {
    return { valid: false, reason: "Akun pengguna telah dinonaktifkan oleh Administrator. Akses ditolak." };
  }

  if (user.lastSessionRevokedAt && sessionIssuedAtMs) {
    const revokedAtMs = new Date(user.lastSessionRevokedAt).getTime();
    if (sessionIssuedAtMs < revokedAtMs) {
      return { valid: false, reason: "Sesi telah dicabut oleh Administrator. Silakan login kembali." };
    }
  }

  return { valid: true };
}
