import { NextResponse } from "next/server";
import { subscriptionWorkflowService } from "../../../../domains/subscription/workflow-service";
import { validateBillingAuth } from "../../../../lib/auth/server-guard";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get("orgId") || undefined;

    const auth = await validateBillingAuth(request, {
      requiredRole: "BILLING_READ",
      targetOrgId: requestedOrgId,
    });

    if (!auth.authorized || !auth.targetOrgId) {
      return NextResponse.json(
        { success: false, error: auth.error || "Akses tidak diizinkan." },
        { status: auth.statusCode }
      );
    }

    const data = subscriptionWorkflowService.getCustomerBillingDetails(auth.targetOrgId);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat informasi langganan." },
      { status: 500 }
    );
  }
}
