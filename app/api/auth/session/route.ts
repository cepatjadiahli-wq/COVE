import { NextRequest, NextResponse } from "next/server";
import { validateBillingAuth } from "@/lib/auth/server-guard";

export async function GET(req: NextRequest) {
  try {
    // We only need to know if they are logged in and have an organization.
    const auth = await validateBillingAuth(req);

    return NextResponse.json(
      { 
        authenticated: auth.authorized, 
        hasOrg: !!auth.user?.orgId,
        user: auth.user,
        error: auth.error
      },
      { status: auth.statusCode }
    );
  } catch (err: any) {
    return NextResponse.json(
      { authenticated: false, error: err.message },
      { status: 500 }
    );
  }
}
