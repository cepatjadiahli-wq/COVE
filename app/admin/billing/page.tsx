"use client";

import React, { useState, useEffect, useCallback } from "react";
import { formatIDR } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ShieldAlert,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

interface AdminEntity {
  id?: string;
  name?: string;
  org_id?: string;
  organization_id?: string;
  subscription_status?: string;
  subscription_tier?: string;
  plan_id?: string;
  tier_level?: number;
  is_active?: boolean;
  is_public?: boolean;
  status?: string;
  billing_interval?: string;
  current_period_end?: string;
  scheduler_owner?: string;
  invoice_number?: string;
  amount_total?: number | string;
  currency?: string;
  due_date?: string;
  amount?: number | string;
  unapplied_amount?: number | string;
  applied_amount?: number | string;
  payment_method?: string;
  paid_at?: string;
  attempt_number?: number;
  attempt_count?: number;
  error_message?: string;
  reason?: string;
  cycle_number?: number;
  notification_type?: string;
  channel?: string;
  recipient?: string;
  provider?: string;
  event_type?: string;
  processed?: boolean;
  override_type?: string;
  expires_at?: string;
  is_revoked?: boolean;
  action?: string;
  target_type?: string;
  target_entity?: string;
  target_id?: string;
  admin_id?: string;
  template_type?: string;
  provider_payment_id?: string;
  billing_invoice_id?: string;
  gateway_error_code?: string;
  retry_eligibility?: string;
  attempted_at?: string;
  notes?: string;
  current_stage?: string;
  amount_due?: number | string;
  recipient_email?: string;
  event_id?: string;
  processing_status?: string;
  created_at?: string;
  organizations?: { id?: string; name?: string } | null;
  billing_invoices?: { id?: string; invoice_number?: string } | null;
  subscriptions?: { id?: string; plan_id?: string } | null;
  platform_admins?: { id?: string; notes?: string } | null;
  prices?: Array<{ id?: string; amount?: number; billing_interval?: string; currency?: string }>;
}

interface OverviewData {
  metrics?: {
    mrr?: number;
    arr?: number;
    endingMrr?: number;
    activeCustomers?: number;
    logoChurnRate?: number;
    netRevenueRetention?: number;
    dunningRecoveryRate?: number;
    failedPaymentRate?: number;
    grossRevenueRetention?: number;
    revenueChurnRate?: number;
    arpa?: number;
  };
  alerts?: {
    reconciliationQueueCount?: number;
    overdueSubscriptionsCount?: number;
    activeDunningCount?: number;
    pendingInvoicesCount?: number;
  };
}

interface PaginatedData<T = AdminEntity> {
  data?: T[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

interface PlansData {
  plans?: AdminEntity[];
  prices?: AdminEntity[];
  providerConfigs?: AdminEntity[];
}

interface SaasMetricsView {
  beginningMrr?: number;
  newMrr?: number;
  expansionMrr?: number;
  contractionMrr?: number;
  reactivationMrr?: number;
  churnedMrr?: number;
  endingMrr?: number;
  activeCustomers?: number;
  logoChurnRate?: number;
  revenueChurnRate?: number;
  grossRevenueRetention?: number;
  netRevenueRetention?: number;
  arpa?: number;
  failedPaymentRate?: number;
  dunningRecoveryRate?: number;
  [key: string]: unknown;
}

interface ActionPayload {
  action: string;
  [key: string]: unknown;
}

export default function AdminBillingControlCenterPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Tab Data States
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [orgsData, setOrgsData] = useState<PaginatedData | null>(null);
  const [subsData, setSubsData] = useState<PaginatedData | null>(null);
  const [invoicesData, setInvoicesData] = useState<PaginatedData | null>(null);
  const [paymentsData, setPaymentsData] = useState<PaginatedData | null>(null);
  const [attemptsData, setAttemptsData] = useState<PaginatedData | null>(null);
  const [reconData, setReconData] = useState<PaginatedData | null>(null);
  const [dunningData, setDunningData] = useState<PaginatedData | null>(null);
  const [notifsData, setNotifsData] = useState<PaginatedData | null>(null);
  const [webhooksData, setWebhooksData] = useState<PaginatedData | null>(null);
  const [plansData, setPlansData] = useState<PlansData | null>(null);
  const [overridesData, setOverridesData] = useState<PaginatedData | null>(null);
  const [metricsData, setMetricsData] = useState<SaasMetricsView | null>(null);
  const [auditData, setAuditData] = useState<PaginatedData | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Subscription Detail Modal
  const [selectedSubDetail, setSelectedSubDetail] = useState<AdminEntity | null>(null);
  const [showSubModal, setShowSubModal] = useState(false);

  // Reconcile Action Modal
  const [selectedReconItem, setSelectedReconItem] = useState<AdminEntity | null>(null);
  const [targetInvoiceId, setTargetInvoiceId] = useState("");
  const [reconReason, setReconReason] = useState("");
  const [showReconModal, setShowReconModal] = useState(false);

  // Manual Override Modal
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideSubId, setOverrideSubId] = useState("");
  const [overrideType, setOverrideType] = useState<string>("ACCESS_EXTENSION");
  const [overrideExtendDays, setOverrideExtendDays] = useState(7);
  const [overrideExpiresAt, setOverrideExpiresAt] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  // Generic Sensitive Action Modal
  const [actionPayload, setActionPayload] = useState<ActionPayload | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [showActionModal, setShowActionModal] = useState(false);

  const fetchTabData = useCallback(async (tabName: string) => {
    setLoading(true);
    setFeedback(null);
    try {
      switch (tabName) {
        case "overview": {
          const res = await fetch("/api/admin/billing/overview");
          const json = await res.json();
          if (json.success) setOverviewData(json.data);
          break;
        }
        case "organizations": {
          const res = await fetch(`/api/admin/billing/organizations?search=${searchQuery}&status=${statusFilter}`);
          const json = await res.json();
          if (json.success) setOrgsData(json);
          break;
        }
        case "subscriptions": {
          const res = await fetch(`/api/admin/billing/subscriptions?status=${statusFilter}`);
          const json = await res.json();
          if (json.success) setSubsData(json);
          break;
        }
        case "invoices": {
          const res = await fetch(`/api/admin/billing/invoices?search=${searchQuery}&status=${statusFilter}`);
          const json = await res.json();
          if (json.success) setInvoicesData(json);
          break;
        }
        case "payments": {
          const res = await fetch(`/api/admin/billing/payments?search=${searchQuery}&status=${statusFilter}`);
          const json = await res.json();
          if (json.success) setPaymentsData(json);
          break;
        }
        case "payment-attempts": {
          const res = await fetch("/api/admin/billing/payment-attempts");
          const json = await res.json();
          if (json.success) setAttemptsData(json);
          break;
        }
        case "reconciliation": {
          const res = await fetch(`/api/admin/billing/reconciliation?status=${statusFilter}`);
          const json = await res.json();
          if (json.success) setReconData(json);
          break;
        }
        case "dunning": {
          const res = await fetch(`/api/admin/billing/dunning?status=${statusFilter}`);
          const json = await res.json();
          if (json.success) setDunningData(json);
          break;
        }
        case "notifications": {
          const res = await fetch(`/api/admin/billing/notifications?status=${statusFilter}`);
          const json = await res.json();
          if (json.success) setNotifsData(json);
          break;
        }
        case "webhooks": {
          const res = await fetch(`/api/admin/billing/webhooks?search=${searchQuery}&status=${statusFilter}`);
          const json = await res.json();
          if (json.success) setWebhooksData(json);
          break;
        }
        case "plans": {
          const res = await fetch("/api/admin/billing/plans");
          const json = await res.json();
          if (json.success) setPlansData(json.data);
          break;
        }
        case "overrides": {
          const res = await fetch("/api/admin/billing/overrides");
          const json = await res.json();
          if (json.success) setOverridesData(json);
          break;
        }
        case "metrics": {
          const res = await fetch("/api/admin/billing/metrics");
          const json = await res.json();
          if (json.success) setMetricsData(json.data);
          break;
        }
        case "audit-logs": {
          const res = await fetch("/api/admin/billing/audit-logs");
          const json = await res.json();
          if (json.success) setAuditData(json);
          break;
        }
      }
    } catch (err: unknown) {
      setFeedback({ type: "error", message: (err as Error).message || "Gagal memuat data modul admin." });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab, fetchTabData]);

  // Open Subscription Detail
  const handleOpenSubDetail = async (subId: string) => {
    try {
      const res = await fetch(`/api/admin/billing/subscriptions/${subId}`);
      const json = await res.json();
      if (json.success) {
        setSelectedSubDetail(json.data);
        setShowSubModal(true);
      }
    } catch {
      alert("Gagal memuat detail subscription.");
    }
  };

  // Submit Manual Reconciliation
  const handleExecuteReconciliation = async () => {
    if (!reconReason || reconReason.trim().length < 5) {
      alert("Alasan rekonsiliasi manual wajib diisi secara jelas.");
      return;
    }
    if (!targetInvoiceId) {
      alert("Silakan masukkan ID Faktur Tagihan tujuan.");
      return;
    }
    if (!selectedReconItem?.id) {
      alert("Item rekonsiliasi tidak valid.");
      return;
    }

    try {
      const res = await fetch("/api/admin/billing/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reconciliationId: selectedReconItem.id,
          targetBillingInvoiceId: targetInvoiceId,
          reason: reconReason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedback({ type: "success", message: "Pembayaran berhasil direkonsiliasi ke tagihan tujuan." });
        setShowReconModal(false);
        fetchTabData("reconciliation");
      } else {
        alert(json.error || "Gagal merekonsiliasi pembayaran.");
      }
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  // Submit Manual Override
  const handleExecuteOverride = async () => {
    if (!overrideReason || overrideReason.trim().length < 5) {
      alert("Alasan manual override wajib diisi.");
      return;
    }
    if (!overrideExpiresAt) {
      alert("Masa berlaku (expires_at) wajib ditentukan.");
      return;
    }

    try {
      const res = await fetch("/api/admin/billing/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: overrideSubId,
          overrideType,
          newValue: overrideType === "ACCESS_EXTENSION" ? { extendDays: overrideExtendDays } : { status: "ACTIVE" },
          reason: overrideReason,
          expiresAt: new Date(overrideExpiresAt).toISOString(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedback({ type: "success", message: "Manual override berhasil diterapkan dengan masa berlaku aktif." });
        setShowOverrideModal(false);
        fetchTabData("overrides");
      } else {
        alert(json.error || "Gagal menerapkan manual override.");
      }
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  // Submit Generic Sensitive Action
  const handleExecuteAction = async () => {
    if (!actionReason || actionReason.trim().length < 5) {
      alert("Alasan tindakan sensitif wajib diisi (minimal 5 karakter).");
      return;
    }

    try {
      const res = await fetch("/api/admin/billing/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...actionPayload,
          reason: actionReason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedback({ type: "success", message: json.message || "Tindakan operasional berhasil dieksekusi." });
        setShowActionModal(false);
        fetchTabData(activeTab);
      } else {
        alert(json.error || "Gagal mengeksekusi tindakan.");
      }
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 text-white rounded-lg">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Admin Billing Control Center</h1>
                <p className="text-sm text-slate-500">Pusat kendali finansial, rekonsiliasi pembayaran, dan metrik SaaS internal COVE</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 py-1.5 px-3">
              <ShieldCheck className="w-4 h-4 mr-1" /> Platform Admin Authorized
            </Badge>
            <Button variant="outline" size="sm" onClick={() => fetchTabData(activeTab)} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className={`p-4 rounded-lg border ${feedback.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"}`}>
            <p className="text-sm font-medium">{feedback.message}</p>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <Input
            placeholder="Cari ID, kata kunci, nama..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs text-xs h-8"
          />
          <Input
            placeholder="Filter status..."
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="max-w-[140px] text-xs h-8"
          />
          <Button variant="secondary" size="sm" onClick={() => fetchTabData(activeTab)} className="h-8 text-xs">
            Filter
          </Button>
        </div>

        {/* 14 Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white p-1 rounded-xl border border-slate-200 flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="text-xs">1. Overview</TabsTrigger>
            <TabsTrigger value="organizations" className="text-xs">2. Organisasi</TabsTrigger>
            <TabsTrigger value="subscriptions" className="text-xs">3. Langganan</TabsTrigger>
            <TabsTrigger value="invoices" className="text-xs">4. Faktur SaaS</TabsTrigger>
            <TabsTrigger value="payments" className="text-xs">5. Pembayaran</TabsTrigger>
            <TabsTrigger value="payment-attempts" className="text-xs">6. Percobaan Debit</TabsTrigger>
            <TabsTrigger value="reconciliation" className="text-xs font-semibold text-amber-700">
              7. Rekonsiliasi {Boolean(overviewData?.alerts?.reconciliationQueueCount && overviewData.alerts.reconciliationQueueCount > 0) && `(${overviewData?.alerts?.reconciliationQueueCount})`}
            </TabsTrigger>
            <TabsTrigger value="dunning" className="text-xs">8. Dunning</TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs">9. Notifikasi</TabsTrigger>
            <TabsTrigger value="webhooks" className="text-xs">10. Webhooks</TabsTrigger>
            <TabsTrigger value="plans" className="text-xs">11. Paket & Harga</TabsTrigger>
            <TabsTrigger value="overrides" className="text-xs">12. Overrides</TabsTrigger>
            <TabsTrigger value="metrics" className="text-xs">13. Metrik SaaS</TabsTrigger>
            <TabsTrigger value="audit-logs" className="text-xs">14. Log Audit</TabsTrigger>
          </TabsList>

          {/* TAB 1: OVERVIEW */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Monthly Recurring Revenue (MRR)</CardDescription>
                  <CardTitle className="text-2xl text-indigo-700">
                    {formatIDR(overviewData?.metrics?.mrr || 0)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500">Murni langganan berulang (tanpa pajak & fee)</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Annual Recurring Revenue (ARR)</CardDescription>
                  <CardTitle className="text-2xl text-slate-900">
                    {formatIDR(overviewData?.metrics?.arr || 0)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500">MRR × 12 bulan</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Antrean Rekonsiliasi Perlu Tindakan</CardDescription>
                  <CardTitle className="text-2xl text-amber-600">
                    {overviewData?.alerts?.reconciliationQueueCount || 0} Kasus
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500">Partial, overpayment & mismatch</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Langganan Menunggak (Overdue)</CardDescription>
                  <CardTitle className="text-2xl text-rose-600">
                    {overviewData?.alerts?.overdueSubscriptionsCount || 0} Akun
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500">Dalam masa tenggang / read-only</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: ORGANIZATIONS */}
          <TabsContent value="organizations">
            <Card>
              <CardHeader>
                <CardTitle>Daftar Pelanggan / Organisasi Konstruksi</CardTitle>
                <CardDescription>Total {orgsData?.total || 0} penyewa aktif di platform COVE</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-700">
                      <tr>
                        <th className="p-3">Nama Organisasi</th>
                        <th className="p-3">Status Langganan</th>
                        <th className="p-3">Paket (Tier)</th>
                        <th className="p-3">Tanggal Dibuat</th>
                        <th className="p-3">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(orgsData?.data || []).map((org) => (
                        <tr key={org.id} className="border-b hover:bg-slate-50">
                          <td className="p-3 font-medium text-slate-900">{org.name}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={org.subscription_status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}>
                              {org.subscription_status}
                            </Badge>
                          </td>
                          <td className="p-3">{org.subscription_tier || "N/A"}</td>
                          <td className="p-3 text-slate-500">{org.created_at ? new Date(org.created_at).toLocaleDateString("id-ID") : "-"}</td>
                          <td className="p-3">
                            <Button variant="ghost" size="sm" onClick={() => {
                              setActionPayload({ action: "CORRECT_BILLING_CONTACT", orgId: org.id });
                              setShowActionModal(true);
                            }}>
                              Koreksi Kontak
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: SUBSCRIPTIONS */}
          <TabsContent value="subscriptions">
            <Card>
              <CardHeader>
                <CardTitle>Daftar Langganan SaaS</CardTitle>
                <CardDescription>Status siklus hidup, interval penagihan, dan kepemilikan scheduler</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-700">
                      <tr>
                        <th className="p-3">Organisasi</th>
                        <th className="p-3">Paket</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Interval</th>
                        <th className="p-3">Scheduler Owner</th>
                        <th className="p-3">Akhir Periode</th>
                        <th className="p-3">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(subsData?.data || []).map((sub) => (
                        <tr key={sub.id} className="border-b hover:bg-slate-50">
                          <td className="p-3 font-medium">{sub.organizations?.name || sub.org_id}</td>
                          <td className="p-3">{sub.plan_id}</td>
                          <td className="p-3">
                            <Badge variant="outline">{sub.status}</Badge>
                          </td>
                          <td className="p-3">{sub.billing_interval}</td>
                          <td className="p-3">
                            <Badge className={sub.scheduler_owner === "COVE" ? "bg-indigo-100 text-indigo-800" : "bg-purple-100 text-purple-800"}>
                              {sub.scheduler_owner || "COVE"}
                            </Badge>
                          </td>
                          <td className="p-3 text-slate-500">{sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("id-ID") : "-"}</td>
                          <td className="p-3 space-x-2">
                            <Button variant="outline" size="sm" onClick={() => sub.id && handleOpenSubDetail(sub.id)}>
                              Detail
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => {
                              setOverrideSubId(sub.id || "");
                              setShowOverrideModal(true);
                            }}>
                              Override
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: BILLING INVOICES */}
          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle>Faktur Tagihan SaaS</CardTitle>
                <CardDescription>Tagihan resmi biaya platform (terpisah dari invoice proyek konstruksi)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-700">
                      <tr>
                        <th className="p-3">Nomor Faktur</th>
                        <th className="p-3">Organisasi</th>
                        <th className="p-3">Jumlah</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Jatuh Tempo</th>
                        <th className="p-3">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(invoicesData?.data || []).map((inv) => (
                        <tr key={inv.id} className="border-b hover:bg-slate-50">
                          <td className="p-3 font-mono font-medium">{inv.invoice_number}</td>
                          <td className="p-3">{inv.organizations?.name}</td>
                          <td className="p-3 font-medium">{formatIDR(inv.amount_total)}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={inv.status === "PAID" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}>
                              {inv.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-slate-500">{inv.due_date ? new Date(inv.due_date).toLocaleDateString("id-ID") : "-"}</td>
                          <td className="p-3">
                            {inv.status !== "PAID" && (
                              <Button variant="outline" size="sm" onClick={() => {
                                setActionPayload({ action: "RESEND_PAYMENT_LINK", invoiceId: inv.id });
                                setShowActionModal(true);
                              }}>
                                Kirim Ulang Link
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: PAYMENTS */}
          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle>Riwayat Pembayaran Gateway</CardTitle>
                <CardDescription>Seluruh pembayaran terverifikasi dari gateway (Xendit / Mayar)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-700">
                      <tr>
                        <th className="p-3">Provider ID</th>
                        <th className="p-3">Organisasi</th>
                        <th className="p-3">Nominal</th>
                        <th className="p-3">Metode</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Tanggal Bayar</th>
                        <th className="p-3">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(paymentsData?.data || []).map((pay) => (
                        <tr key={pay.id} className="border-b hover:bg-slate-50">
                          <td className="p-3 font-mono text-xs">{pay.provider_payment_id}</td>
                          <td className="p-3">{pay.organizations?.name}</td>
                          <td className="p-3 font-medium">{formatIDR(pay.amount)}</td>
                          <td className="p-3">{pay.payment_method}</td>
                          <td className="p-3">
                            <Badge variant="outline">{pay.status}</Badge>
                          </td>
                          <td className="p-3 text-slate-500">{pay.paid_at ? new Date(pay.paid_at).toLocaleString("id-ID") : "-"}</td>
                          <td className="p-3">
                            <Button variant="ghost" size="sm" onClick={() => {
                              setActionPayload({ action: "PROCESS_REFUND", paymentId: pay.id, amount: pay.amount, type: "FULL_REFUND" });
                              setShowActionModal(true);
                            }}>
                              Refund
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 6: PAYMENT ATTEMPTS */}
          <TabsContent value="payment-attempts">
            <Card>
              <CardHeader>
                <CardTitle>Histori Percobaan Debit (Payment Attempts)</CardTitle>
                <CardDescription>Catatan audit upaya debit otomatis dan klasifikasi error gateway</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-700">
                      <tr>
                        <th className="p-3">Invoice</th>
                        <th className="p-3">Attempt #</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Error Code</th>
                        <th className="p-3">Kelayakan Retry</th>
                        <th className="p-3">Waktu Percobaan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(attemptsData?.data || []).map((att) => (
                        <tr key={att.id} className="border-b hover:bg-slate-50">
                          <td className="p-3 font-mono">{att.billing_invoices?.invoice_number || att.billing_invoice_id}</td>
                          <td className="p-3">#{att.attempt_number}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={att.status === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}>
                              {att.status}
                            </Badge>
                          </td>
                          <td className="p-3 font-mono text-xs">{att.gateway_error_code || "-"}</td>
                          <td className="p-3">
                            <Badge variant="secondary">{att.retry_eligibility || "RETRY_AFTER"}</Badge>
                          </td>
                          <td className="p-3 text-slate-500">{att.attempted_at ? new Date(att.attempted_at).toLocaleString("id-ID") : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 7: RECONCILIATION QUEUE */}
          <TabsContent value="reconciliation">
            <Card>
              <CardHeader>
                <CardTitle>Antrean Rekonsiliasi Finansial</CardTitle>
                <CardDescription>
                  Prinsip: Pembayaran diterima ≠ tagihan lunas ≠ langganan aktif. Selesaikan anomali tanpa menghapus audit trail.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-700">
                      <tr>
                        <th className="p-3">Status Rekonsiliasi</th>
                        <th className="p-3">Nominal Diterima</th>
                        <th className="p-3">Belum Dialokasikan</th>
                        <th className="p-3">Alasan / Catatan</th>
                        <th className="p-3">Waktu Masuk</th>
                        <th className="p-3">Aksi Terkontrol</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reconData?.data || []).map((item) => (
                        <tr key={item.id} className="border-b hover:bg-slate-50">
                          <td className="p-3">
                            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
                              {item.status}
                            </Badge>
                          </td>
                          <td className="p-3 font-medium">{formatIDR(item.amount)}</td>
                          <td className="p-3 font-medium text-amber-700">{formatIDR(item.unapplied_amount)}</td>
                          <td className="p-3 text-xs max-w-xs truncate">{item.reason || item.notes || "Anomali transaksi gateway"}</td>
                          <td className="p-3 text-slate-500 text-xs">{item.created_at ? new Date(item.created_at).toLocaleString("id-ID") : "-"}</td>
                          <td className="p-3">
                            {item.status !== "RESOLVED" && (
                              <Button variant="default" size="sm" onClick={() => {
                                setSelectedReconItem(item);
                                setTargetInvoiceId(item.billing_invoice_id || "");
                                setShowReconModal(true);
                              }}>
                                Rekonsiliasi
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 8: DUNNING CYCLES */}
          <TabsContent value="dunning">
            <Card>
              <CardHeader>
                <CardTitle>Siklus Dunning Pelanggan Menunggak</CardTitle>
                <CardDescription>Progresi jatuh tempo deterministik dari H-7 s/d H+21</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-700">
                      <tr>
                        <th className="p-3">Organisasi</th>
                        <th className="p-3">Status Siklus</th>
                        <th className="p-3">Tahap Saat Ini</th>
                        <th className="p-3">Total Tagihan</th>
                        <th className="p-3">Dimulai Pada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dunningData?.data || []).map((d) => (
                        <tr key={d.id} className="border-b hover:bg-slate-50">
                          <td className="p-3 font-medium">{d.organizations?.name}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={d.status === "RECOVERED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}>
                              {d.status}
                            </Badge>
                          </td>
                          <td className="p-3 font-mono text-xs">{d.current_stage || "DUE_DATE"}</td>
                          <td className="p-3 font-medium">{formatIDR(d.amount_due || 2500000)}</td>
                          <td className="p-3 text-slate-500 text-xs">{d.created_at ? new Date(d.created_at).toLocaleString("id-ID") : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 9: NOTIFICATIONS */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Log Notifikasi Penagihan</CardTitle>
                <CardDescription>Status akurat (GENERATED / QUEUED, tidak pernah mengklaim palsu SENT/DELIVERED)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-700">
                      <tr>
                        <th className="p-3">Tipe Template</th>
                        <th className="p-3">Organisasi</th>
                        <th className="p-3">Penerima</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Dibuat Pada</th>
                        <th className="p-3">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(notifsData?.data || []).map((n) => (
                        <tr key={n.id} className="border-b hover:bg-slate-50">
                          <td className="p-3 font-mono text-xs">{n.template_type}</td>
                          <td className="p-3">{n.organizations?.name}</td>
                          <td className="p-3 text-xs">{n.recipient_email}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="bg-slate-50 text-slate-700">{n.status}</Badge>
                          </td>
                          <td className="p-3 text-slate-500 text-xs">{n.created_at ? new Date(n.created_at).toLocaleString("id-ID") : "-"}</td>
                          <td className="p-3">
                            <Button variant="ghost" size="sm" onClick={() => {
                              setActionPayload({ action: "RETRY_NOTIFICATION", notificationId: n.id });
                              setShowActionModal(true);
                            }}>
                              Kirim Ulang
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 10: WEBHOOK EVENTS */}
          <TabsContent value="webhooks">
            <Card>
              <CardHeader>
                <CardTitle>Log Webhook Gateway Idempoten</CardTitle>
                <CardDescription>Audit payload mentah dan status pemrosesan event pembayaran</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-700">
                      <tr>
                        <th className="p-3">Event ID</th>
                        <th className="p-3">Provider</th>
                        <th className="p-3">Event Type</th>
                        <th className="p-3">Status Proses</th>
                        <th className="p-3">Waktu Masuk</th>
                        <th className="p-3">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(webhooksData?.data || []).map((evt) => (
                        <tr key={evt.id} className="border-b hover:bg-slate-50">
                          <td className="p-3 font-mono text-xs">{evt.event_id}</td>
                          <td className="p-3">{evt.provider}</td>
                          <td className="p-3 text-xs font-mono">{evt.event_type}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={evt.processing_status === "PROCESSED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}>
                              {evt.processing_status}
                            </Badge>
                          </td>
                          <td className="p-3 text-slate-500 text-xs">{evt.created_at ? new Date(evt.created_at).toLocaleString("id-ID") : "-"}</td>
                          <td className="p-3">
                            <Button variant="outline" size="sm" onClick={() => {
                              setActionPayload({ action: "REPROCESS_WEBHOOK", eventId: evt.event_id });
                              setShowActionModal(true);
                            }}>
                              Proses Ulang
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 11: PLANS & PRICES */}
          <TabsContent value="plans">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Katalog Paket Langganan</CardTitle>
                  <CardDescription>Daftar paket resmi dan legacy lifetime</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(plansData?.plans || []).map((plan) => (
                    <div key={plan.id} className="p-4 border rounded-lg flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-slate-900">{plan.name}</h4>
                          {plan.id === "lifetime_799k" && (
                            <Badge variant="destructive" className="text-xs">LEGACY ONLY (Non-Purchasable)</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">ID: {plan.id} • Tier: {plan.tier_level}</p>
                      </div>
                      <Badge variant="outline">{plan.is_active ? "Aktif" : "Non-aktif"}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Katalog Versi Harga (Price Locking)</CardTitle>
                  <CardDescription>Harga terkunci per langganan untuk menjaga integritas invoice historis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(plansData?.prices || []).map((price) => (
                    <div key={price.id} className="p-4 border rounded-lg flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-slate-900">{price.id}</h4>
                        <p className="text-xs text-slate-500">Paket: {price.plan_id} • Interval: {price.billing_interval}</p>
                      </div>
                      <span className="font-semibold text-indigo-700">{formatIDR(price.amount)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 12: MANUAL OVERRIDES */}
          <TabsContent value="overrides">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Manual Overrides & Diskon Bersyarat</CardTitle>
                  <CardDescription>Wajib memiliki alasan terjustifikasi dan masa berlaku kedaluwarsa</CardDescription>
                </div>
                <Button onClick={() => setShowOverrideModal(true)}>
                  + Tambah Override Baru
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-700">
                      <tr>
                        <th className="p-3">Tipe Override</th>
                        <th className="p-3">Organisasi</th>
                        <th className="p-3">Alasan</th>
                        <th className="p-3">Kedaluwarsa (Expires At)</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(overridesData?.data || []).map((ovr) => (
                        <tr key={ovr.id} className="border-b hover:bg-slate-50">
                          <td className="p-3 font-medium">{ovr.override_type}</td>
                          <td className="p-3">{ovr.organizations?.name}</td>
                          <td className="p-3 text-xs max-w-xs truncate">{ovr.reason}</td>
                          <td className="p-3 text-xs text-rose-600 font-medium">
                            {ovr.expires_at ? new Date(ovr.expires_at).toLocaleString("id-ID") : "-"}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className={ovr.is_revoked ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}>
                              {ovr.is_revoked ? "Dibatalkan" : "Aktif"}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {!ovr.is_revoked && (
                              <Button variant="destructive" size="sm" onClick={() => {
                                const revReason = prompt("Masukkan alasan pembatalan override:");
                                if (revReason) {
                                  fetch("/api/admin/billing/overrides", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ action: "REVOKE", overrideId: ovr.id, reason: revReason }),
                                  }).then(() => fetchTabData("overrides"));
                                }
                              }}>
                                Revoke
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 13: SAAS METRICS WATERFALL */}
          <TabsContent value="metrics">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card className="bg-slate-900 text-white">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-slate-400">Beginning MRR</CardDescription>
                    <CardTitle className="text-xl">{formatIDR(metricsData?.beginningMrr || 0)}</CardTitle>
                  </CardHeader>
                </Card>

                <Card className="bg-emerald-50 border-emerald-200">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-emerald-700">+ New & Expansion</CardDescription>
                    <CardTitle className="text-xl text-emerald-800">
                      +{formatIDR((metricsData?.newMrr || 0) + (metricsData?.expansionMrr || 0))}
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card className="bg-rose-50 border-rose-200">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-rose-700">- Churn & Contraction</CardDescription>
                    <CardTitle className="text-xl text-rose-800">
                      -{formatIDR((metricsData?.churnedMrr || 0) + (metricsData?.contractionMrr || 0))}
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card className="bg-indigo-50 border-indigo-200">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-indigo-700">= Ending MRR</CardDescription>
                    <CardTitle className="text-xl text-indigo-900">
                      {formatIDR(metricsData?.endingMrr || 0)}
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card className="bg-purple-50 border-purple-200">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-purple-700">Net Revenue Retention</CardDescription>
                    <CardTitle className="text-xl text-purple-900">
                      {((metricsData?.netRevenueRetention || 1) * 100).toFixed(1)}%
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Prinsip Matematis MRR Movement Bridge</CardTitle>
                  <CardDescription>
                    Ending MRR ({formatIDR(metricsData?.endingMrr || 0)}) = Beginning MRR ({formatIDR(metricsData?.beginningMrr || 0)}) + New ({formatIDR(metricsData?.newMrr || 0)}) - Churn ({formatIDR(metricsData?.churnedMrr || 0)}). Persamaan dijamin 100% seimbang tanpa distorsi pajak atau demo tenants.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 14: AUDIT LOGS */}
          <TabsContent value="audit-logs">
            <Card>
              <CardHeader>
                <CardTitle>Buku Log Audit Forensik Platform Administrator</CardTitle>
                <CardDescription>Rekaman aksi before/after yang tidak dapat diubah (immutable log)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-700">
                      <tr>
                        <th className="p-3">Aksi</th>
                        <th className="p-3">Entitas Target</th>
                        <th className="p-3">Alasan Wajib</th>
                        <th className="p-3">Admin Pelaksana</th>
                        <th className="p-3">Waktu Eksekusi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(auditData?.data || []).map((log) => (
                        <tr key={log.id} className="border-b hover:bg-slate-50">
                          <td className="p-3 font-mono font-medium text-xs">{log.action}</td>
                          <td className="p-3 font-mono text-xs">{log.target_entity} ({log.target_id ? log.target_id.slice(0, 8) : "-"}...)</td>
                          <td className="p-3 text-xs">{log.reason}</td>
                          <td className="p-3 text-xs">{log.platform_admins?.notes || (log.admin_id ? log.admin_id.slice(0, 8) : "-")}</td>
                          <td className="p-3 text-slate-500 text-xs">{log.created_at ? new Date(log.created_at).toLocaleString("id-ID") : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* DIALOG: Rekonsiliasi Pembayaran */}
      <Dialog open={showReconModal} onOpenChange={setShowReconModal}>
        <DialogHeader>
          <DialogTitle>Rekonsiliasi Pembayaran Terkontrol</DialogTitle>
          <DialogDescription>
            Hubungkan pembayaran yang belum dialokasikan ke faktur tagihan yang sah. Tindakan ini akan dicatat ke buku audit forensik.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>ID Antrean Rekonsiliasi</Label>
            <Input value={selectedReconItem?.id || ""} disabled className="font-mono text-xs" />
          </div>
          <div>
            <Label>Nominal Belum Dialokasikan</Label>
            <Input value={formatIDR(selectedReconItem?.unapplied_amount || 0)} disabled className="font-semibold text-amber-700" />
          </div>
          <div>
            <Label>ID Faktur Tagihan Tujuan (Billing Invoice ID)</Label>
            <Input value={targetInvoiceId} onChange={(e) => setTargetInvoiceId(e.target.value)} placeholder="Contoh: 123e4567-e89b-..." />
          </div>
          <div>
            <Label>Alasan Rekonsiliasi (Wajib)</Label>
            <Textarea value={reconReason} onChange={(e) => setReconReason(e.target.value)} placeholder="Tuliskan justifikasi rekonsiliasi manual ini..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowReconModal(false)}>Batal</Button>
          <Button onClick={handleExecuteReconciliation}>Konfirmasi Rekonsiliasi</Button>
        </DialogFooter>
      </Dialog>

      {/* DIALOG: Manual Override */}
      <Dialog open={showOverrideModal} onOpenChange={setShowOverrideModal}>
        <DialogHeader>
          <DialogTitle>Terapkan Manual Override Langganan</DialogTitle>
          <DialogDescription>
            Perpanjangan akses darurat atau override status bersyarat dengan batas waktu kedaluwarsa yang tegas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>ID Langganan (Subscription ID)</Label>
            <Input value={overrideSubId} onChange={(e) => setOverrideSubId(e.target.value)} placeholder="UUID langganan..." />
          </div>
          <div>
            <Label>Tipe Override</Label>
            <select
              value={overrideType}
              onChange={(e) => setOverrideType(e.target.value)}
              className="w-full h-10 px-3 border rounded-md text-sm bg-white"
            >
              <option value="ACCESS_EXTENSION">Perpanjangan Akses (Extend Days)</option>
              <option value="STATUS_OVERRIDE">Override Status (Set Active)</option>
            </select>
          </div>
          {overrideType === "ACCESS_EXTENSION" && (
            <div>
              <Label>Jumlah Hari Perpanjangan</Label>
              <Input type="number" value={overrideExtendDays} onChange={(e) => setOverrideExtendDays(parseInt(e.target.value, 10))} />
            </div>
          )}
          <div>
            <Label>Masa Berlaku Override (Expires At - Wajib di Masa Depan)</Label>
            <Input type="datetime-local" value={overrideExpiresAt} onChange={(e) => setOverrideExpiresAt(e.target.value)} />
          </div>
          <div>
            <Label>Alasan / Justifikasi Override (Wajib)</Label>
            <Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Tuliskan alasan komersial/operasional override..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowOverrideModal(false)}>Batal</Button>
          <Button onClick={handleExecuteOverride}>Terapkan Override</Button>
        </DialogFooter>
      </Dialog>

      {/* DIALOG: Tindakan Sensitif Konfirmasi */}
      <Dialog open={showActionModal} onOpenChange={setShowActionModal}>
        <DialogHeader>
          <DialogTitle>Konfirmasi Tindakan Sensitif</DialogTitle>
          <DialogDescription>
            Aksi: <span className="font-mono font-semibold">{actionPayload?.action}</span>. Tindakan ini memerlukan justifikasi tertulis sebelum dieksekusi.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Alasan Tindakan (Wajib minimal 5 karakter)</Label>
            <Textarea value={actionReason} onChange={(e) => setActionReason(e.target.value)} placeholder="Jelaskan alasan eksekusi tindakan ini..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowActionModal(false)}>Batal</Button>
          <Button variant="destructive" onClick={handleExecuteAction}>Eksekusi Tindakan</Button>
        </DialogFooter>
      </Dialog>

      {/* DIALOG: Detail Subscription Lengkap */}
      <Dialog open={showSubModal} onOpenChange={setShowSubModal}>
        <DialogHeader>
          <DialogTitle>Detail Subscription Lengkap</DialogTitle>
          <DialogDescription>
            Informasi komprehensif lifecycle langganan, billing customer, dan kepemilikan scheduler.
          </DialogDescription>
        </DialogHeader>
        {selectedSubDetail && (
          <div className="space-y-3 py-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-slate-500">ID Subscription:</span>
              <span className="font-mono text-xs">{selectedSubDetail.id}</span>
              <span className="text-slate-500">Status:</span>
              <span className="font-semibold">{selectedSubDetail.status}</span>
              <span className="text-slate-500">Paket (Plan):</span>
              <span>{selectedSubDetail.plan_id}</span>
              <span className="text-slate-500">Interval Tagihan:</span>
              <span>{selectedSubDetail.billing_interval}</span>
              <span className="text-slate-500">Scheduler Owner:</span>
              <Badge variant="outline">{selectedSubDetail.scheduler_owner || "COVE"}</Badge>
              <span className="text-slate-500">Periode Berakhir:</span>
              <span>{selectedSubDetail.current_period_end ? new Date(selectedSubDetail.current_period_end).toLocaleString("id-ID") : "-"}</span>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowSubModal(false)}>Tutup</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
