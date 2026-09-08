// ============================================================================
// COVE Backend — Role-Based Authorization Service v2.2 (Gate P0-A.1)
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, COVE_ERD_v2.0_Logical_Data_Model.md §3
// Eliminates shortcut role !== AUDITOR. Uses strict explicit capability whitelists.
// ============================================================================

import type {TenantRole, RequestActor} from '../types/domain.js';

function extractRole(target: TenantRole | RequestActor | null | undefined): TenantRole | null {
  if (!target) return null;
  return typeof target === 'string' ? target : target.role;
}

export class AuthService {
  /**
   * Evaluasi izin penulisan umum dalam domain kontraktor.
   * Whitelist eksplisit peran tenant yang berwenang melakukan mutasi.
   * Null role (e.g. platform admin murni tanpa membership) strictly FALSE.
   */
  public static canWrite(target: TenantRole | RequestActor | null | undefined): boolean {
    const role = extractRole(target);
    if (!role) return false;
    const writableRoles: TenantRole[] = [
      'OWNER',
      'ADMIN',
      'COMMERCIAL_MANAGER',
      'QS',
      'PROJECT_MANAGER',
      'FINANCE_MANAGER',
      'COVE_IMPLEMENTATION'
    ];
    return writableRoles.includes(role);
  }

  /**
   * Evaluasi wewenang manajemen finansial (Invoice, Pencatatan Kas Masuk).
   * Dibatasi untuk OWNER, ADMIN, FINANCE_MANAGER, COVE_IMPLEMENTATION.
   */
  public static canManageFinance(target: TenantRole | RequestActor | null | undefined): boolean {
    const role = extractRole(target);
    if (!role || !this.canWrite(role)) return false;
    const allowed: TenantRole[] = ['OWNER', 'ADMIN', 'FINANCE_MANAGER', 'COVE_IMPLEMENTATION'];
    return allowed.includes(role);
  }

  /**
   * Evaluasi wewenang manajemen komersial (Progres Fisik, Opname, Klaim, Tindakan).
   * Dibatasi untuk OWNER, ADMIN, COMMERCIAL_MANAGER, QS, PROJECT_MANAGER, COVE_IMPLEMENTATION.
   */
  public static canManageCommercial(target: TenantRole | RequestActor | null | undefined): boolean {
    const role = extractRole(target);
    if (!role || !this.canWrite(role)) return false;
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
  public static canManageBilling(target: TenantRole | RequestActor | null | undefined): boolean {
    const role = extractRole(target);
    if (!role) return false;
    const allowed: TenantRole[] = ['OWNER', 'ADMIN'];
    return allowed.includes(role);
  }

  /**
   * Evaluasi wewenang manajemen pengguna dan role internal tenant.
   * Dibatasi untuk OWNER dan ADMIN.
   */
  public static canManageUsers(target: TenantRole | RequestActor | null | undefined): boolean {
    const role = extractRole(target);
    if (!role) return false;
    const allowed: TenantRole[] = ['OWNER', 'ADMIN'];
    return allowed.includes(role);
  }
}

