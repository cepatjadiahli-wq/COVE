// ============================================================================
// COVE Frontend — Authoritative Supabase Auth Client (Gate P0-A)
// Acuan: COVE_PRD_v2.0_Product_End_State.md §7, SR-017
// ============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || 'placeholder-anon-key';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

let cachedToken: string | null = null;

// Initialize token listener
supabase.auth.onAuthStateChange((_event, session) => {
  cachedToken = session?.access_token || null;
});

export function setAuthToken(token: string | null) {
  cachedToken = token;
}

export async function getAuthToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      cachedToken = data.session.access_token;
      return cachedToken;
    }
  } catch {
    // Ignore error in local offline mode
  }
  return null;
}
