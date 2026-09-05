import { NextResponse } from "next/server";
import { subscriptionWorkflowService } from "../../../../domains/subscription/workflow-service";
import { validateBillingAuth } from "../../../../lib/auth/server-guard";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { orgId, targetPlanId, targetInterval, selectedProjectIds } = body;

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

    if (!targetPlanId) {
      return NextResponse.json(
        { success: false, error: "targetPlanId wajib disertakan." },
        { status: 400 }
      );
    }

    // TASK 16R.8: Reject legacy lifetime plan purchase / upgrade
    if (targetPlanId === "lifetime_799k" || targetPlanId.toLowerCase().includes("lifetime")) {
      return NextResponse.json(
        { success: false, error: "Paket Lifetime tidak tersedia untuk pergantian paket baru." },
        { status: 400 }
      );
    }

    const result = subscriptionWorkflowService.executePlanChange({
      orgId: auth.targetOrgId,
      targetPlanId,
      targetInterval,
      selectedProjectIds,
      actorId: auth.user?.id || "CUSTOMER_PORTAL",
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal melakukan pergantian paket." },
      { status: 400 }
    );
  }
}
