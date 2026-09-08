// ============================================================================
// COVE Backend — Supabase Auth Client & Token Verifier (Gate P0-A)
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, SR-017
// ============================================================================

import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {config} from '../config.js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  if (config.supabaseUrl && (config.supabaseServiceRoleKey || config.supabasePublishableKey)) {
    supabaseClient = createClient(
      config.supabaseUrl,
      config.supabaseServiceRoleKey || config.supabasePublishableKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );
    return supabaseClient;
  }

  return null;
}

export type TokenVerificationResult = {
  user: {
    id: string;
    email: string;
  } | null;
  error: string | null;
};

// Custom test verifier hook for isolated unit test suites (AUTH-01..10)
type TestTokenVerifier = (token: string) => Promise<TokenVerificationResult>;
let customTestVerifier: TestTokenVerifier | null = null;

export function setTestTokenVerifier(verifier: TestTokenVerifier | null): void {
  customTestVerifier = verifier;
}

/**
 * Authoritative Server-side JWT Token Verification
 * Never decodes unsigned JWTs or trusts client claims without cryptographic verification.
 */
export async function verifyToken(token: string): Promise<TokenVerificationResult> {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    return {user: null, error: 'Empty token'};
  }

  // If custom test verifier is registered (in test environment)
  if (customTestVerifier) {
    return await customTestVerifier(token);
  }

  const client = getSupabaseServerClient();
  if (!client) {
    // If Supabase credentials are not configured
    if (config.isProduction) {
      throw new Error('CRITICAL: Supabase Auth is not configured in production.');
    }
    return {user: null, error: 'Supabase credentials not configured'};
  }

  try {
    const {data, error} = await client.auth.getUser(token);
    if (error || !data.user) {
      return {user: null, error: error?.message || 'Invalid or expired token'};
    }
    return {
      user: {
        id: data.user.id,
        email: data.user.email || ''
      },
      error: null
    };
  } catch (err: any) {
    return {user: null, error: err.message || 'Token verification failed'};
  }
}
