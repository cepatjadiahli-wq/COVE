// ============================================================================
// COVE Backend — Role-Based Authorization Service v2.2 (Gate P0-A)
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §3
// Eliminates mutable global state; all checks are pure functions.
// ============================================================================

import type {TenantRole, RequestActor} from '../types/domain.js';

function extractRole(target: TenantRole | RequestActor): TenantRole {
  return typeof target === 'string' ? target : target.role;
}

export class AuthService {
  /**
   * Evaluasi izin penulisan umum dalam domain kontraktor.
   * AUDITOR dan EXECUTIVE_VIEWER strictly read-only.
   */
  public static canWrite(target: TenantRole | RequestActor): boolean {
    const role = extractRole(target);
    return role !== 'AUDITOR' && role !== 'EXECUTIVE_VIEWER';
  }

  /**
   * Evaluasi wewenang manajemen finansial (Invoice, Pencatatan Kas Masuk).
   * Dibatasi untuk OWNER, ADMIN, FINANCE_MANAGER, COVE_IMPLEMENTATION.
   */
  public static canManageFinance(target: TenantRole | RequestActor): boolean {
    const role = extractRole(target);
    if (!this.canWrite(role)) return false;
    const allowed: TenantRole[] = ['OWNER', 'ADMIN', 'FINANCE_MANAGER', 'COVE_IMPLEMENTATION'];
    return allowed.includes(role);
  }

  /**
   * Evaluasi wewenang manajemen komersial (Progres Fisik, Opname, Klaim, Tindakan).
   * Dibatasi untuk OWNER, ADMIN, COMMERCIAL_MANAGER, QS, PROJECT_MANAGER, COVE_IMPLEMENTATION.
   */
  public static canManageCommercial(target: TenantRole | RequestActor): boolean {
    const role = extractRole(target);
    if (!this.canWrite(role)) return false;
    const allowed: TenantRole[] = [
      'OWNER',
      'ADMIN',
      'COMMERCIAL_MANAGER',
      'QS',
      'PROJECT_MANAGER',
      'COVE_IMPLEMENTATION'
    ];
    return allowed.includes(role);
  }

  /**
   * Evaluasi wewenang langganan SaaS dan pembayaran Mayar.
   * Dibatasi untuk OWNER dan ADMIN.
   */
  public static canManageBilling(target: TenantRole | RequestActor): boolean {
    const role = extractRole(target);
    const allowed: TenantRole[] = ['OWNER', 'ADMIN'];
    return allowed.includes(role);
  }

  /**
   * Evaluasi wewenang manajemen pengguna dan role internal tenant.
   * Dibatasi untuk OWNER dan ADMIN.
   */
  public static canManageUsers(target: TenantRole | RequestActor): boolean {
    const role = extractRole(target);
    const allowed: TenantRole[] = ['OWNER', 'ADMIN'];
    return allowed.includes(role);
  }
}
