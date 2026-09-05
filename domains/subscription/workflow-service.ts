/**
 * COVE Phase 16: Subscription Workflow Service
 * Source of Truth: COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md (Bagian 3.11, 8.2, 12, 13)
 */

import { dbAdapter } from "../../lib/db/database-adapter";
import { calculateProration, ProrationCalculationResult } from "./proration";
import {
  evaluateDowngradeImpact,
  validateDowngradeProjectSelection,
  ProjectSummary,
  DowngradeImpactResult,
} from "./downgrade";

export interface PlanChangePreviewResult {
  currentPlan: any;
  targetPlan: any;
  isUpgrade: boolean;
  proration: ProrationCalculationResult | null;
  downgradeImpact: DowngradeImpactResult | null;
  targetPrice: any;
}

export class SubscriptionWorkflowService {
  /**
   * Retrieves complete customer billing details for the Billing Portal.
   */
  public getCustomerBillingDetails(orgId: string = "org-nusantara-01") {
    const subscription = dbAdapter.getActiveSubscription(orgId);
    const plans = dbAdapter.getPlans();
    const prices = dbAdapter.getPrices();
    const entitlement = dbAdapter.getTenantEntitlement(orgId);

    const currentPlan = plans.find((p) => p.id === subscription?.planId) || plans[1];
    const currentPrice = prices.find(
      (p) => p.planId === subscription?.planId && p.billingInterval === subscription?.billingInterval
    ) || prices.find((p) => p.planId === subscription?.planId);

    const allProjects = dbAdapter.getProjects();
    const activeProjects = allProjects.filter((p) => p.status === "active");
    const profiles = dbAdapter.getProfiles().filter((p) => !(p as any).orgId || (p as any).orgId === orgId);
    const invoices = dbAdapter.getBillingInvoices(orgId);
    const payments = dbAdapter.getPayments(orgId);
    const statusEvents = subscription ? dbAdapter.getSubscriptionStatusEvents(subscription.id) : [];

    return {
      subscription,
      currentPlan,
      currentPrice,
      availablePlans: plans.filter((p) => p.isPublic && p.id !== "b2b_addon_project"),
      prices,
      entitlement,
      projects: {
        total: allProjects.length,
        active: activeProjects.length,
        activeList: activeProjects.map((p) => ({
          id: p.id,
          name: p.projectName,
          code: p.projectCode,
          contractValue: (p as any).contractValue || 0,
          status: p.status,
        })),
        allList: allProjects.map((p) => ({
          id: p.id,
          name: p.projectName,
          code: p.projectCode,
          contractValue: (p as any).contractValue || 0,
          status: p.status,
        })),
      },
      users: {
        total: profiles.length,
        active: profiles.length,
        maxAllowed: entitlement.maxUsers,
      },
      invoices,
      payments,
      statusEvents,
    };
  }

  /**
   * Previews the financial and operational impact of switching plans.
   */
  public previewPlanChange(params: {
    orgId?: string;
    targetPlanId: string;
    targetInterval?: "MONTHLY" | "ANNUAL" | "ONEOFF_45_DAYS";
  }): PlanChangePreviewResult {
    const orgId = params.orgId || "org-nusantara-01";
    const sub = dbAdapter.getActiveSubscription(orgId);
    if (!sub) throw new Error(`No active subscription found for org ${orgId}`);

    const plans = dbAdapter.getPlans();
    const prices = dbAdapter.getPrices();
    const planEntitlements = dbAdapter.getPlanEntitlements();

    const currentPlan = plans.find((p) => p.id === sub.planId) || plans[1];
    const targetPlan = plans.find((p) => p.id === params.targetPlanId);
    if (!targetPlan) throw new Error(`Target plan ${params.targetPlanId} not found`);

    const interval = params.targetInterval || sub.billingInterval;

    const currentPriceObj =
      prices.find((p) => p.planId === sub.planId && p.billingInterval === sub.billingInterval) ||
      prices.find((p) => p.planId === sub.planId) || { amount: 0 };

    const targetPriceObj =
      prices.find((p) => p.planId === targetPlan.id && p.billingInterval === interval) ||
      prices.find((p) => p.planId === targetPlan.id) || { amount: 0 };

    // An upgrade is when target tier is higher, or if same tier and higher price
    const isUpgrade =
      targetPlan.tierLevel > currentPlan.tierLevel ||
      (targetPlan.tierLevel === currentPlan.tierLevel && targetPriceObj.amount > currentPriceObj.amount);

    let proration: ProrationCalculationResult | null = null;
    let downgradeImpact: DowngradeImpactResult | null = null;

    if (isUpgrade) {
      proration = calculateProration({
        currentPrice: currentPriceObj.amount,
        targetPrice: targetPriceObj.amount,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
      });
    } else {
      const targetEntitlement = planEntitlements.find((e) => e.planId === targetPlan.id) || {
        maxActiveProjects: 1,
      };
      const activeProjects: ProjectSummary[] = dbAdapter
        .getProjects()
        .filter((p) => p.status === "active")
        .map((p) => ({
          id: p.id,
          name: p.projectName,
          code: p.projectCode,
          contractValue: (p as any).contractValue || 0,
          status: p.status,
        }));

      downgradeImpact = evaluateDowngradeImpact({
        activeProjects,
        targetMaxProjects: targetEntitlement.maxActiveProjects,
      });
    }

    return {
      currentPlan,
      targetPlan,
      isUpgrade,
      proration,
      downgradeImpact,
      targetPrice: targetPriceObj,
    };
  }

  /**
   * Executes plan change (Upgrade or Downgrade) with quota enforcement and proration invoice generation.
   */
  public executePlanChange(params: {
    orgId?: string;
    targetPlanId: string;
    targetInterval?: "MONTHLY" | "ANNUAL" | "ONEOFF_45_DAYS";
    selectedProjectIds?: string[];
    actorId?: string;
  }) {
    const orgId = params.orgId || "org-nusantara-01";
    const actorId = params.actorId || "USER";
    const sub = dbAdapter.getActiveSubscription(orgId);
    if (!sub) throw new Error(`No active subscription found for org ${orgId}`);

    const preview = this.previewPlanChange({
      orgId,
      targetPlanId: params.targetPlanId,
      targetInterval: params.targetInterval,
    });

    // Downgrade validation & project archiving
    if (!preview.isUpgrade) {
      const targetEntitlement = dbAdapter
        .getPlanEntitlements()
        .find((e) => e.planId === params.targetPlanId) || { maxActiveProjects: 1 };

      const activeProjects: ProjectSummary[] = dbAdapter
        .getProjects()
        .filter((p) => p.status === "active")
        .map((p) => ({
          id: p.id,
          name: p.projectName,
          code: p.projectCode,
          contractValue: (p as any).contractValue || 0,
          status: p.status,
        }));

      if (activeProjects.length > targetEntitlement.maxActiveProjects) {
        if (!params.selectedProjectIds || params.selectedProjectIds.length === 0) {
          throw new Error(
            `Downgrade memerlukan pemilihan maksimal ${targetEntitlement.maxActiveProjects} proyek aktif untuk dipertahankan.`
          );
        }

        const validation = validateDowngradeProjectSelection({
          activeProjects,
          targetMaxProjects: targetEntitlement.maxActiveProjects,
          selectedProjectIds: params.selectedProjectIds,
        });

        if (!validation.isValid) {
          throw new Error(validation.error || "Pilihan proyek untuk downgrade tidak valid.");
        }

        // Archive non-selected active projects (Preserving data intact, status='archived')
        dbAdapter.archiveProjectsExcept(orgId, params.selectedProjectIds);
      }
    }

    // Upgrade with proration invoice
    if (preview.isUpgrade && preview.proration && preview.proration.netPayable > 0) {
      const now = new Date().toISOString();
      const invoiceNumber = `INV-PRORATE-${Date.now().toString().slice(-6)}`;
      const prorationInvoice: any = {
        id: `inv-proration-${Date.now()}`,
        orgId,
        subscriptionId: sub.id,
        invoiceNumber,
        number: invoiceNumber,
        status: "PAID",
        amountSubtotal: preview.proration.netPayable,
        subtotal: preview.proration.netPayable,
        discountAmount: 0,
        discountTotal: 0,
        taxAmount: Math.round(preview.proration.netPayable * 0.11),
        taxTotal: Math.round(preview.proration.netPayable * 0.11),
        amountTotal: Math.round(preview.proration.netPayable * 1.11),
        total: Math.round(preview.proration.netPayable * 1.11),
        currency: "IDR",
        dueDate: sub.currentPeriodEnd,
        periodStart: now,
        periodEnd: sub.currentPeriodEnd,
        paidAt: now,
        pdfUrl: `/api/billing/invoice/inv-proration-${Date.now()}/pdf`,
        createdAt: now,
        updatedAt: now,
      };

      dbAdapter.createBillingInvoice(prorationInvoice);
    }

    // Update subscription plan & entitlements
    const updatedSub = dbAdapter.updateSubscriptionPlan(
      sub.id,
      params.targetPlanId,
      params.targetInterval || sub.billingInterval,
      actorId
    );

    const updatedEntitlement = dbAdapter.getTenantEntitlement(orgId);

    return {
      success: true,
      subscription: updatedSub,
      entitlement: updatedEntitlement,
      preview,
    };
  }

  /**
   * Schedules subscription cancellation at period end (No sudden lockout).
   */
  public executeCancellationAtPeriodEnd(params: {
    orgId?: string;
    reason: string;
    actorId?: string;
  }) {
    const orgId = params.orgId || "org-nusantara-01";
    const sub = dbAdapter.getActiveSubscription(orgId);
    if (!sub) throw new Error(`No active subscription found for org ${orgId}`);

    const updatedSub = dbAdapter.cancelSubscriptionAtPeriodEnd(
      sub.id,
      params.reason,
      params.actorId || "USER"
    );

    return {
      success: true,
      subscription: updatedSub,
      message: `Langganan dijadwalkan berakhir pada ${new Date(sub.currentPeriodEnd).toLocaleDateString("id-ID")}. Layanan tetap aktif hingga akhir periode.`,
    };
  }

  /**
   * Reactivates a canceled subscription before the period end date.
   */
  public executeReactivation(params: { orgId?: string; actorId?: string }) {
    const orgId = params.orgId || "org-nusantara-01";
    const sub = dbAdapter.getActiveSubscription(orgId);
    if (!sub) throw new Error(`No active subscription found for org ${orgId}`);

    if (sub.status !== "CANCEL_AT_PERIOD_END" && !sub.cancelAtPeriodEnd) {
      throw new Error("Hanya langganan dengan status CANCEL_AT_PERIOD_END yang dapat direaktivasi langsung.");
    }

    const updatedSub = dbAdapter.reactivateSubscription(sub.id, params.actorId || "USER");

    return {
      success: true,
      subscription: updatedSub,
      message: "Langganan berhasil direaktivasi. Perpanjangan otomatis kembali berjalan normal.",
    };
  }
}

export const subscriptionWorkflowService = new SubscriptionWorkflowService();
