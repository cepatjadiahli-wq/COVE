import { NextResponse } from "next/server";
import { subscriptionWorkflowService } from "../../../../domains/subscription/workflow-service";
import { validateBillingAuth } from "../../../../lib/auth/server-guard";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { orgId, targetPlanId, targetInterval } = body;

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

    // TASK 16R.8: Reject legacy lifetime plan from preview
    if (targetPlanId === "lifetime_799k" || targetPlanId.toLowerCase().includes("lifetime")) {
      return NextResponse.json(
        { success: false, error: "Paket Lifetime tidak tersedia untuk pergantian paket baru." },
        { status: 400 }
      );
    }

    const preview = subscriptionWorkflowService.previewPlanChange({
      orgId: auth.targetOrgId,
      targetPlanId,
      targetInterval,
    });

    return NextResponse.json({ success: true, preview });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menghitung simulasi pergantian paket." },
      { status: 400 }
    );
  }
}
