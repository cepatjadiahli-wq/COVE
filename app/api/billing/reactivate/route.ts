import { NextResponse } from "next/server";
import { subscriptionWorkflowService } from "../../../../domains/subscription/workflow-service";
import { validateBillingAuth } from "../../../../lib/auth/server-guard";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { orgId } = body;

    const auth = await validateBillingAuth(request, {
      requiredRole: "OWNER_OR_ADMIN",
      targetOrgId: orgId,
    });

    if (!auth.authorized || !auth.targetOrgId) {
      return NextResponse.json(
        { success: false, error: auth.error || "Akses tidak diizinkan." },
        { status: auth.statusCode }
      );
    }

    const result = subscriptionWorkflowService.executeReactivation({
      orgId: auth.targetOrgId,
      actorId: auth.user?.id || "CUSTOMER_PORTAL",
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengaktifkan kembali langganan." },
      { status: 400 }
    );
  }
}
