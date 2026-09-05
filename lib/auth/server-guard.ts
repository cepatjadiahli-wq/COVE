/**
 * COVE Phase 16R.2: Centralized Server-Side Billing Authentication & Database-Enforced Authorization
 * Source-of-Truth: COVE_PRD_v1.0_Validation_Gated_MVP.md & Blueprint v1.0
 * 
 * Rules:
 * 1. User identity originates STRICTLY from supabase.auth.getUser().
 * 2. User-organization relationship is resolved using user.id (auth.uid()) foreign key.
 * 3. orgId, role, and membership status originate from database table organization_members.
 * 4. Membership must have active status ('active' / 'ACTIVE').
 * 5. ZERO fallback to user_metadata, email matching, query, body, crafted cookie, or header.
 * 6. If membership is not found, returns HTTP 403 Forbidden.
 * 7. If targetOrgId does not match an active membership of the user, returns HTTP 403 Forbidden.
 * 8. coveStore is NEVER used as a fallback in production runtime.
 * 9. Dependency injection is strictly permitted ONLY when NODE_ENV === 'test'; rejected in development and production.
 */

import { createClient } from "../supabase/server";
import { Role } from "../constants";

export interface AuthenticatedBillingUser {
  id: string;
  orgId: string;
  role: Role | string;
  email: string;
}

export interface BillingAuthResult {
  authorized: boolean;
  statusCode: number;
  user?: AuthenticatedBillingUser;
  targetOrgId?: string;
  error?: string;
}

export interface BillingAuthOptions {
  requiredRole?: "OWNER_OR_ADMIN" | "BILLING_READ";
  targetOrgId?: string;
}

export type BillingSessionResolver = (req: Request) => Promise<AuthenticatedBillingUser | null>;

// Private module-level session resolver used exclusively for dependency injection in automated testing
let _injectedSessionResolver: BillingSessionResolver | null = null;

/**
 * Test utility: Injects a mocked server session resolver during automated tests.
 * STRICT REQUIREMENT: Only allowed when NODE_ENV === 'test'.
 * Strictly forbidden and throws an error if called in 'production' or 'development'.
 */
export function setBillingSessionResolverForTest(resolver: BillingSessionResolver | null): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      `CRITICAL_SECURITY_VIOLATION: Session resolver injection is strictly forbidden in environment '${process.env.NODE_ENV}'. It is only permitted when NODE_ENV === 'test'.`
    );
  }
  _injectedSessionResolver = resolver;
}

/**
 * Pure Canonical Option B Identity & Authorization Resolver
 * Flow:
 *   auth.users.id (user.id from supabase.auth.getUser())
 *   → profiles.id (via profiles.auth_user_id = user.id)
 *   → organization_members (via organization_members.user_id = profiles.id)
 */
export async function resolveUserFromCanonicalAuth(
  supabase: any,
  targetOrgId?: string
): Promise<BillingAuthResult> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user || authError) {
    return {
      authorized: false,
      statusCode: 401,
      error: "Unauthorized: Sesi pengguna tidak ditemukan atau telah berakhir. Silakan login kembali.",
    };
  }

  // 1. Resolve internal profile via auth_user_id (Canonical Option B)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (profileError || !profile || !profile.id) {
    return {
      authorized: false,
      statusCode: 409,
      error: "Conflict: Profil pengguna tidak ditemukan. Silakan lengkapi onboarding terlebih dahulu.",
    };
  }

  // 2. Query active memberships using verified profile.id (NOT user.id / auth.users.id)
  const { data: memberships, error: memberError } = await supabase
    .from("organization_members")
    .select("organization_id, role, status")
    .eq("user_id", profile.id)
    .eq("status", "active");

  if (memberError || !memberships || memberships.length === 0) {
    return {
      authorized: false,
      statusCode: 409,
      error: "Conflict: Pengguna belum memiliki organisasi. Silakan buat organisasi terlebih dahulu.",
    };
  }

  // 3. Verify target organization against verified active memberships
  const matched = targetOrgId
    ? memberships.find((m: any) => m.organization_id === targetOrgId)
    : memberships[0];

  if (!matched) {
    return {
      authorized: false,
      statusCode: 403,
      error: "Forbidden: Akses ditolak. Pengguna bukan anggota aktif dari organisasi target.",
    };
  }

  // 4. Role extracted exclusively from verified database membership
  return {
    authorized: true,
    statusCode: 200,
    user: {
      id: user.id,
      orgId: matched.organization_id,
      role: matched.role as Role,
      email: user.email || "",
    },
    targetOrgId: matched.organization_id,
  };
}

/**
 * Validates authenticated user session, resolves authorized tenant membership from database,
 * enforces multi-tenant boundaries, and verifies role permissions on the server-side.
 */
export async function validateBillingAuth(
  req: Request,
  options: BillingAuthOptions = { requiredRole: "OWNER_OR_ADMIN" }
): Promise<BillingAuthResult> {
  let resolvedUser: AuthenticatedBillingUser | null = null;

  // 1. Dependency injection strictly restricted to NODE_ENV === 'test'
  if (process.env.NODE_ENV === "test" && _injectedSessionResolver) {
    resolvedUser = await _injectedSessionResolver(req);
  } else {
    // 2. Unified runtime session resolution: Identical on production and development (Zero memory fallback)
    try {
      const supabase = await createClient();
      const canonicalResult = await resolveUserFromCanonicalAuth(supabase, options.targetOrgId);
      if (!canonicalResult.authorized) {
        return canonicalResult;
      }
      resolvedUser = canonicalResult.user || null;
    } catch {
      resolvedUser = null;
    }
  }

  // 3. Reject unauthenticated requests with HTTP 401
  if (!resolvedUser) {
    return {
      authorized: false,
      statusCode: 401,
      error: "Unauthorized: Sesi pengguna tidak ditemukan atau telah berakhir. Silakan login kembali.",
    };
  }

  // 4. Validate organization membership exists and is non-empty
  if (!resolvedUser.orgId) {
    return {
      authorized: false,
      statusCode: 409,
      error: "Conflict: Pengguna belum memiliki organisasi. Silakan selesaikan onboarding terlebih dahulu.",
    };
  }

  // 5. Cross-Tenant Boundary Enforcement
  // If targetOrgId is specified (query/body), it MUST strictly match the server-verified active membership
  if (options.targetOrgId && options.targetOrgId !== resolvedUser.orgId) {
    return {
      authorized: false,
      statusCode: 403,
      error: "Forbidden: Akses ditolak. Anda tidak memiliki izin untuk melihat atau mengubah penagihan organisasi lain.",
    };
  }

  // 6. Role-Based Access Control Verification
  const userRole = resolvedUser.role;

  if (options.requiredRole === "OWNER_OR_ADMIN") {
    const isOwnerOrAdmin = userRole === "OWNER" || userRole === "ADMIN";
    if (!isOwnerOrAdmin) {
      return {
        authorized: false,
        statusCode: 403,
        error: "Forbidden: Operasi penagihan dan pergantian paket hanya dapat dilakukan oleh Owner atau Admin organisasi.",
      };
    }
  } else if (options.requiredRole === "BILLING_READ") {
    const isBillingReadAllowed = [
      "OWNER",
      "ADMIN",
      "COMMERCIAL_MANAGER",
      "FINANCE_MANAGER",
      "FINANCE",
    ].includes(userRole);

    if (!isBillingReadAllowed) {
      return {
        authorized: false,
        statusCode: 403,
        error: "Forbidden: Peran Anda tidak memiliki izin untuk melihat informasi faktur dan langganan organisasi.",
      };
    }
  }

  return {
    authorized: true,
    statusCode: 200,
    user: resolvedUser,
    targetOrgId: resolvedUser.orgId,
  };
}

export interface PlatformAdminUser {
  id: string; // platform_admins.id
  authUserId: string; // auth.users.id
  email: string;
  notes?: string;
}

export interface PlatformAdminAuthResult {
  authorized: boolean;
  statusCode: number;
  admin?: PlatformAdminUser;
  error?: string;
}

export type PlatformAdminSessionResolver = (req: Request) => Promise<PlatformAdminUser | null>;

let _injectedPlatformAdminResolver: PlatformAdminSessionResolver | null = null;

export function setPlatformAdminResolverForTest(resolver: PlatformAdminSessionResolver | null): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      `CRITICAL_SECURITY_VIOLATION: Platform admin resolver injection is strictly forbidden in environment '${process.env.NODE_ENV}'. It is only permitted when NODE_ENV === 'test'.`
    );
  }
  _injectedPlatformAdminResolver = resolver;
}

/**
 * COVE Phase 18: Security Gate Platform Administrator
 * Identity originates strictly from:
 *   Supabase Auth -> auth.users.id -> platform_admins.auth_user_id
 * 
 * Rules:
 * 1. Zero user_metadata usage.
 * 2. Zero role acceptance from header, body, query, or forged cookie.
 * 3. Tenant OWNER is strictly rejected with HTTP 403.
 * 4. Service role key is NEVER exposed to the browser.
 */
export async function requirePlatformAdmin(req?: Request): Promise<PlatformAdminAuthResult> {
  // Test injection strictly restricted to NODE_ENV === 'test'
  if (process.env.NODE_ENV === "test" && _injectedPlatformAdminResolver && req) {
    const injected = await _injectedPlatformAdminResolver(req);
    if (!injected) {
      return {
        authorized: false,
        statusCode: 403,
        error: "Forbidden: Akses ditolak. Pengguna bukan Platform Administrator resmi.",
      };
    }
    return {
      authorized: true,
      statusCode: 200,
      admin: injected,
    };
  }

  let supabase: any;
  try {
    supabase = await createClient();
  } catch {
    return {
      authorized: false,
      statusCode: 401,
      error: "Unauthorized: Sesi pengguna tidak ditemukan atau telah berakhir. Silakan login kembali.",
    };
  }

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return {
        authorized: false,
        statusCode: 401,
        error: "Unauthorized: Sesi pengguna tidak ditemukan atau telah berakhir. Silakan login kembali.",
      };
    }

    // Direct database verification against platform_admins table
    // auth.users.id -> platform_admins.auth_user_id
    const { data: adminRecord, error: adminError } = await supabase
      .from("platform_admins")
      .select("id, auth_user_id, notes")
      .eq("auth_user_id", user.id)
      .single();

    if (adminError || !adminRecord) {
      return {
        authorized: false,
        statusCode: 403,
        error: "Forbidden: Akses ditolak. Pengguna bukan merupakan Platform Administrator COVE resmi.",
      };
    }

    return {
      authorized: true,
      statusCode: 200,
      admin: {
        id: adminRecord.id,
        authUserId: user.id,
        email: user.email || "",
        notes: adminRecord.notes || undefined,
      },
    };
  } catch {
    return {
      authorized: false,
      statusCode: 500,
      error: "Internal Server Error: Gagal memvalidasi otorisasi platform administrator.",
    };
  }
}

