import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback handler.
 * Exchanges the Supabase auth code for a session (writes SSR cookie)
 * then redirects to the intended destination.
 *
 * Used by:
 * - Email confirmation links
 * - Password reset links
 * - Magic link sign-ins
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const returnTo = searchParams.get("returnTo") || "/dashboard";

  // Validate returnTo is a safe relative path
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//")
    ? returnTo
    : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Redirect to the intended destination with the session cookie now set
      return NextResponse.redirect(`${origin}${safeReturnTo}`);
    }

    // If code exchange fails, redirect to login with error
    return NextResponse.redirect(
      `${origin}/login?error=callback_failed&returnTo=${encodeURIComponent(safeReturnTo)}`
    );
  }

  // No code — redirect to login
  return NextResponse.redirect(`${origin}/login`);
}
