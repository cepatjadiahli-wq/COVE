"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTenant } from "@/components/layout/TenantProvider";
import { formatIDR } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CreditCard,
  ShieldCheck,
  Calendar,
  Layers,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Download,
  Receipt,
  FileCheck,
  ExternalLink,
  ChevronRight,
  Database,
  Lock,
} from "lucide-react";

export default function BillingPortalPage() {
  const { currentOrg } = useTenant();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Change Plan Modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [targetPlanId, setTargetPlanId] = useState<string>("");
  const [targetInterval, setTargetInterval] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  // Cancel Modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReasonCategory, setCancelReasonCategory] = useState("Proyek telah selesai");
  const [cancelReasonDetails, setCancelReasonDetails] = useState("");

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchBillingData = useCallback(async () => {
    if (!currentOrg?.id) {
      setLoading(false);
      setError("Organisasi tidak ditemukan. Silakan pilih atau muat ulang organisasi.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/billing/subscription?orgId=${currentOrg.id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal mengambil data langganan.");
      setData(json.data);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat memuat data penagihan.");
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    if (currentOrg?.id) {
      fetchBillingData();
    }
  }, [currentOrg?.id, fetchBillingData]);

  // Handle plan selection in change plan modal
  const handleSelectPlan = useCallback(async (planId: string) => {
    setTargetPlanId(planId);
    setPreviewLoading(true);
    setPreview(null);
    try {
      const res = await fetch("/api/billing/proration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: currentOrg?.id,
          targetPlanId: planId,
          targetInterval,
        }),
      });
      const json = await res.json();
      if (json.success && json.preview) {
        setPreview(json.preview);
        // Pre-select active projects if downgrade needs selection
        if (!json.preview.isUpgrade && json.preview.downgradeImpact?.needsProjectSelection) {
          const activeList = data?.projects?.activeList || [];
          const maxQuota = json.preview.downgradeImpact.targetMaxProjects;
          setSelectedProjectIds(activeList.slice(0, maxQuota).map((p: any) => p.id));
        }
      }
    } catch (err) {
      console.error("Preview calculation failed", err);
    } finally {
      setPreviewLoading(false);
    }
  }, [currentOrg?.id, targetInterval, data]);

  // Re-fetch preview when interval changes
  useEffect(() => {
    if (targetPlanId && showPlanModal) {
      handleSelectPlan(targetPlanId);
    }
  }, [targetInterval, targetPlanId, showPlanModal, handleSelectPlan]);

  // Execute Plan Change
  const handleConfirmPlanChange = async () => {
    if (!targetPlanId) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: currentOrg.id,
          targetPlanId,
          targetInterval,
          selectedProjectIds: !preview?.isUpgrade ? selectedProjectIds : undefined,
          actorId: "CUSTOMER_PORTAL",
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal mengubah paket.");

      setFeedbackMessage({
        type: "success",
        text: preview?.isUpgrade
          ? `Paket berhasil ditingkatkan ke ${preview.targetPlan?.name}. Penyesuaian kuota langsung aktif.`
          : `Paket berhasil disesuaikan ke ${preview?.targetPlan?.name}. ${selectedProjectIds.length} proyek aktif dipertahankan.`,
      });
      setShowPlanModal(false);
      fetchBillingData();
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Gagal memperbarui paket." });
    } finally {
      setActionLoading(false);
    }
  };

  // Execute Cancel
  const handleConfirmCancel = async () => {
    const fullReason = cancelReasonDetails.trim()
      ? `${cancelReasonCategory}: ${cancelReasonDetails.trim()}`
      : cancelReasonCategory;

    setActionLoading(true);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: currentOrg.id,
          reason: fullReason,
          actorId: "CUSTOMER_PORTAL",
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menjadwalkan pembatalan.");

      setFeedbackMessage({
        type: "success",
        text: json.message || "Langganan berhasil dijadwalkan berakhir pada akhir periode.",
      });
      setShowCancelModal(false);
      fetchBillingData();
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Gagal membatalkan langganan." });
    } finally {
      setActionLoading(false);
    }
  };

  // Execute Reactivation
  const handleReactivate = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/billing/reactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: currentOrg.id,
          actorId: "CUSTOMER_PORTAL",
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal mereaktivasi langganan.");

      setFeedbackMessage({
        type: "success",
        text: "Langganan Anda telah berhasil diaktifkan kembali! Perpanjangan otomatis normal.",
      });
      fetchBillingData();
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Gagal mereaktivasi langganan." });
    } finally {
      setActionLoading(false);
    }
  };

  // Open Data Tenant Export
  const handleExportData = () => {
    const backupData = {
      organization: currentOrg,
      exportDate: new Date().toISOString(),
      billing: data,
      note: "COVE Open Data Guarantee (PRD 28.1): Tenant backup fully exportable regardless of subscription status.",
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cove-backup-${currentOrg.id}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-6 w-6 text-slate-400 animate-spin" />
          <span className="text-slate-600 font-medium">Memuat data langganan & penagihan...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-800 space-y-3">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span>Gagal Memuat Portal Penagihan</span>
          </div>
          <p className="text-sm">{error || "Data langganan tidak ditemukan."}</p>
          <Button variant="outline" size="sm" onClick={fetchBillingData}>
            Coba Lagi
          </Button>
        </div>
      </div>
    );
  }

  const { subscription, currentPlan, currentPrice, availablePlans, prices, entitlement, projects, users, invoices } = data;
  const isCanceledAtPeriodEnd = subscription?.status === "CANCEL_AT_PERIOD_END" || subscription?.cancelAtPeriodEnd;
  const maxProjects = entitlement?.maxActiveProjects ?? 1;
  const isUnlimitedProjects = maxProjects === -1;
  const projectUsagePercent = isUnlimitedProjects ? 10 : Math.min(100, Math.round((projects.active / maxProjects) * 100));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 select-none">
      {/* Feedback Toast / Notification */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between shadow-xs border ${
            feedbackMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            {feedbackMessage.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-xs font-semibold hover:underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Langganan & Penagihan</h1>
            <Badge variant="outline" className="bg-slate-100 text-slate-800 text-[11px] font-bold">
              B2B Customer Portal
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Kelola paket langganan B2B perusahaan, pantau kuota proyek aktif & pengguna, unduh invoice, dan kelola kelangsungan operasional.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportData}
            className="text-slate-700 hover:text-slate-950 font-semibold flex items-center gap-1.5 shadow-xs"
          >
            <Download className="h-4 w-4 text-slate-600" />
            <span>Ekspor Cadangan Data (PRD 28.1)</span>
          </Button>
        </div>
      </div>

      {/* Scheduled Cancellation Warning Banner */}
      {isCanceledAtPeriodEnd && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-900">
                Langganan Dijadwalkan Berakhir pada {new Date(subscription?.currentPeriodEnd).toLocaleDateString("id-ID", { dateStyle: "long" })}
              </h4>
              <p className="text-xs text-amber-800 leading-relaxed">
                Seluruh fitur dan data proyek Anda tetap aktif secara penuh hingga tanggal tersebut tanpa gangguan. Setelah periode berakhir, akun beralih ke mode Read-Only dengan jaminan data utuh.
              </p>
            </div>
          </div>
          <Button
            onClick={handleReactivate}
            disabled={actionLoading}
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs shrink-0"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            {actionLoading ? "Memproses..." : "Batalkan Penjadwalan & Reaktivasi"}
          </Button>
        </div>
      )}

      {/* Main Subscription Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Active Plan */}
        <Card className="border-slate-200 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-slate-100 to-transparent rounded-bl-full pointer-events-none" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Paket Operasional</span>
              <Badge
                className={
                  isCanceledAtPeriodEnd
                    ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                    : "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                }
              >
                {isCanceledAtPeriodEnd ? "Berakhir Akhir Siklus" : "Aktif"}
              </Badge>
            </div>
            <CardTitle className="text-xl font-extrabold text-slate-900 mt-1">
              {currentPlan?.name || "B2B Subscription"}
            </CardTitle>
            <CardDescription className="text-xs text-slate-600 leading-relaxed">
              {currentPlan?.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900">
                {formatIDR(currentPrice?.amount || 0)}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                /{subscription?.billingInterval === "ANNUAL" ? "tahun" : subscription?.billingInterval === "ONEOFF_45_DAYS" ? "45 hari" : "bulan"}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Siklus Berakhir:
              </span>
              <span className="font-semibold text-slate-800">
                {subscription?.currentPeriodEnd
                  ? new Date(subscription.currentPeriodEnd).toLocaleDateString("id-ID", { dateStyle: "medium" })
                  : "-"}
              </span>
            </div>

            <div className="pt-2 flex gap-2">
              <Button
                variant="default"
                size="sm"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                onClick={() => {
                  setShowPlanModal(true);
                  handleSelectPlan(availablePlans[0]?.id || "b2b_core");
                }}
              >
                Ubah Paket
              </Button>
              {!isCanceledAtPeriodEnd && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-slate-600 hover:text-red-700 hover:border-red-200"
                  onClick={() => setShowCancelModal(true)}
                >
                  Batalkan
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Quota - Proyek Aktif */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Kapasitas Proyek Aktif</span>
              <Layers className="h-4 w-4 text-slate-400" />
            </div>
            <CardTitle className="text-xl font-extrabold text-slate-900 mt-1">
              {projects.active}{" "}
              <span className="text-sm font-normal text-slate-500">
                / {isUnlimitedProjects ? "Unlimited" : `${maxProjects} proyek`}
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              {projects.total} proyek terdaftar ({projects.total - projects.active} diarsipkan)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    projectUsagePercent >= 100
                      ? "bg-amber-500"
                      : projectUsagePercent > 80
                      ? "bg-blue-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${projectUsagePercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                <span>Penggunaan: {projectUsagePercent}%</span>
                <span>
                  {isUnlimitedProjects
                    ? "Bebas batasan"
                    : `${Math.max(0, maxProjects - projects.active)} slot tersisa`}
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg text-[11px] text-slate-600 space-y-1 border border-slate-100">
              <span className="font-semibold text-slate-800 block">Status Hak Akses Mutasi:</span>
              <div className="flex items-center gap-1.5">
                {entitlement?.canMutate ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Bebas input & edit claim, opname, dan BAP</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span>Akses Read-Only (melebihi kuota paket aktif)</span>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Quota - Pengguna Perusahaan */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Pengguna Terdaftar</span>
              <Users className="h-4 w-4 text-slate-400" />
            </div>
            <CardTitle className="text-xl font-extrabold text-slate-900 mt-1">
              {users.active}{" "}
              <span className="text-sm font-normal text-slate-500">
                / {users.maxAllowed === -1 ? "Unlimited" : `${users.maxAllowed} user`}
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Anggota tim internal dengan hak akses RBAC granular
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-1.5">
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-900 rounded-full transition-all"
                  style={{
                    width: `${
                      users.maxAllowed === -1
                        ? 15
                        : Math.min(100, Math.round((users.active / users.maxAllowed) * 100))
                    }%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                <span>{users.active} aktif</span>
                <span>
                  {users.maxAllowed === -1
                    ? "Bebas batasan"
                    : `${Math.max(0, users.maxAllowed - users.active)} kursi tersedia`}
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg text-[11px] text-slate-600 space-y-1 border border-slate-100">
              <span className="font-semibold text-slate-800 block">Kolaborasi Tim:</span>
              <span>Komersial, QS, PM, dan Direksi memiliki peran terisolasi sesuai workflow.</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Entitlement Checklist */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <span>Matriks Fitur & Modul Terbuka (Entitlement Snapshot)</span>
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Hak akses fungsional yang terkunci secara otomatis berdasarkan paket langganan aktif.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-900">Value Gap Ledger</p>
                <p className="text-[11px] text-slate-500">Deteksi deviasi opname vs tagihan</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-900">Claim Readiness Gate</p>
                <p className="text-[11px] text-slate-500">Verifikasi dokumen checklist klaim</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-900">Commercial Action Queue</p>
                <p className="text-[11px] text-slate-500">Prioritas tindakan penyelamatan margin</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-900">Portfolio Comparative Ranking</p>
                <p className="text-[11px] text-slate-500">Tampilan komparasi performa proyek</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-900">Pilot ROI Ledger</p>
                <p className="text-[11px] text-slate-500">Scorecard pembuktian nilai 8.5x ROI</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-900">Open Data & Export Guarantee</p>
                <p className="text-[11px] text-slate-500">Kedaulatan penuh data proyek (PRD 28.1)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices History Table */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-slate-600" />
                <span>Riwayat Tagihan & Faktur Pajak</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Faktur resmi B2B beserta tanda terima pembayaran untuk keperluan rekonsiliasi keuangan.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-y border-slate-200 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">No. Faktur</th>
                  <th className="py-3 px-4">Tanggal Penerbitan</th>
                  <th className="py-3 px-4">Periode Layanan</th>
                  <th className="py-3 px-4">Total (Termasuk PPN 11%)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices && invoices.length > 0 ? (
                  invoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <FileCheck className="h-4 w-4 text-emerald-600" />
                        <span>{inv.number}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {new Date(inv.createdAt).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {new Date(inv.periodStart).toLocaleDateString("id-ID", { month: "short", year: "numeric" })} -{" "}
                        {new Date(inv.periodEnd).toLocaleDateString("id-ID", { month: "short", year: "numeric" })}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {formatIDR(inv.total)}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          className={
                            inv.status === "PAID"
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                              : "bg-amber-100 text-amber-800 hover:bg-amber-100"
                          }
                        >
                          {inv.status === "PAID" ? "LUNAS" : "MENUNGGU"}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-slate-600 hover:text-slate-950 flex items-center gap-1 ml-auto"
                          onClick={() => {
                            alert(`Mengunduh salinan resmi faktur pajak ${inv.number}`);
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Unduh PDF</span>
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Belum ada riwayat faktur tagihan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Open Data Guarantee Section */}
      <div className="bg-slate-900 text-white rounded-xl p-6 shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">COVE Open Data Guarantee (PRD 28.1)</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Data Anda adalah milik Anda seutuhnya. Apabila langganan Anda berakhir, diarsipkan, atau dibatalkan, COVE menjamin seluruh data klaim, opname fisik, log audit, dan dokumen pendukung tetap dapat diekspor lengkap tanpa ada kunci buatan (vendor lock-in).
          </p>
        </div>
        <Button
          onClick={handleExportData}
          className="bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs shrink-0 shadow-sm"
        >
          <Database className="h-4 w-4 mr-2 text-slate-700" />
          Unduh Salinan Data Lengkap
        </Button>
      </div>

      {/* MODAL 1: CHANGE PLAN MODAL (Upgrade / Downgrade) */}
      <Dialog open={showPlanModal} onOpenChange={setShowPlanModal}>
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900">Ubah Paket Langganan</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Pilih paket yang sesuai dengan skala proyek operasional perusahaan Anda. Perubahan prorata dihitung transparan.
              </DialogDescription>
            </DialogHeader>

            {/* Interval Toggle */}
            <div className="flex items-center justify-center gap-3 p-1 bg-slate-100 rounded-lg max-w-xs mx-auto text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTargetInterval("MONTHLY")}
                className={`flex-1 py-1.5 px-3 rounded-md transition-all cursor-pointer ${
                  targetInterval === "MONTHLY" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Tagihan Bulanan
              </button>
              <button
                type="button"
                onClick={() => setTargetInterval("ANNUAL")}
                className={`flex-1 py-1.5 px-3 rounded-md transition-all cursor-pointer ${
                  targetInterval === "ANNUAL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Tahunan (Hemat)
              </button>
            </div>

            {/* Plan Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {availablePlans?.map((plan: any) => {
                const planPrice = prices.find(
                  (p: any) => p.planId === plan.id && p.billingInterval === targetInterval
                ) || prices.find((p: any) => p.planId === plan.id);

                const isCurrent = plan.id === currentPlan?.id;
                const isSelected = plan.id === targetPlanId;

                return (
                  <div
                    key={plan.id}
                    onClick={() => handleSelectPlan(plan.id)}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "border-slate-900 bg-slate-50/50 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{plan.name}</span>
                        {isCurrent && (
                          <Badge variant="secondary" className="text-[10px]">
                            Paket Saat Ini
                          </Badge>
                        )}
                      </div>
                      <div className="mt-3">
                        <span className="text-lg font-black text-slate-900">
                          {formatIDR(planPrice?.amount || 0)}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          /{targetInterval === "ANNUAL" ? "tahun" : "bulan"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">{plan.description}</p>
                    </div>

                    <Button
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      className="mt-4 w-full text-xs font-semibold"
                      disabled={isCurrent && targetInterval === subscription?.billingInterval}
                    >
                      {isCurrent ? "Paket Aktif" : isSelected ? "Terpilih" : "Pilih Paket"}
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Preview Section */}
            {previewLoading && (
              <div className="p-4 bg-slate-50 rounded-lg flex items-center justify-center gap-2 text-xs text-slate-500">
                <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
                <span>Menghitung simulasi penyesuaian prorata...</span>
              </div>
            )}

            {preview && !previewLoading && (
              <div className="space-y-4">
                {/* Upgrade Flow: Proration details */}
                {preview.isUpgrade && preview.proration && (
                  <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Simulasi Peningkatan Paket (Prorated Upgrade)</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                        <span className="text-slate-500 block text-[10px]">Sisa Hari Siklus:</span>
                        <span className="font-bold text-slate-900">{preview.proration.remainingDays} hari</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                        <span className="text-slate-500 block text-[10px]">Kredit Belum Terpakai:</span>
                        <span className="font-bold text-emerald-700">{formatIDR(preview.proration.unusedCredit)}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                        <span className="text-slate-500 block text-[10px]">Biaya Prorata Baru:</span>
                        <span className="font-bold text-slate-900">{formatIDR(preview.proration.proratedCost)}</span>
                      </div>
                      <div className="bg-emerald-600 text-white p-2.5 rounded-lg">
                        <span className="text-emerald-100 block text-[10px]">Tagihan Hari Ini:</span>
                        <span className="font-extrabold text-sm">{formatIDR(preview.proration.netPayable)}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      * Penambahan kapasitas proyek dan fitur akan langsung aktif seketika setelah Anda mengonfirmasi perubahan.
                    </p>
                  </div>
                )}

                {/* Downgrade Flow: Quota Assessment & Project Selection */}
                {!preview.isUpgrade && preview.downgradeImpact && (
                  <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span>Evaluasi Penyesuaian Paket (Downgrade)</span>
                    </div>

                    <p className="text-xs text-amber-900 leading-relaxed">
                      {preview.downgradeImpact.message}
                    </p>

                    {preview.downgradeImpact.needsProjectSelection && (
                      <div className="space-y-2 pt-2">
                        <span className="text-xs font-bold text-slate-900 block">
                          Pilih {preview.downgradeImpact.targetMaxProjects} Proyek yang Tetap Aktif:
                        </span>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {preview.downgradeImpact.activeProjects?.map((proj: any) => {
                            const isChecked = selectedProjectIds.includes(proj.id);
                            return (
                              <label
                                key={proj.id}
                                className={`flex items-center justify-between p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                                  isChecked ? "bg-white border-slate-900 font-semibold" : "bg-slate-50 border-slate-200 text-slate-600"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        if (selectedProjectIds.length < preview.downgradeImpact.targetMaxProjects) {
                                          setSelectedProjectIds([...selectedProjectIds, proj.id]);
                                        }
                                      } else {
                                        setSelectedProjectIds(selectedProjectIds.filter((id) => id !== proj.id));
                                      }
                                    }}
                                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                  />
                                  <span>{proj.name} ({proj.code || "PRJ"})</span>
                                </div>
                                <span className="text-slate-500 font-medium">{formatIDR(proj.contractValue || 0)}</span>
                              </label>
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500">
                          <span>Terpilih: {selectedProjectIds.length} / {preview.downgradeImpact.targetMaxProjects} proyek</span>
                          <span>Proyek lain akan diarsipkan (data utuh & read-only)</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPlanModal(false)}
                disabled={actionLoading}
              >
                Batal
              </Button>
              <Button
                size="sm"
                className="bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                disabled={
                  actionLoading ||
                  previewLoading ||
                  !targetPlanId ||
                  (preview &&
                    !preview.isUpgrade &&
                    preview.downgradeImpact?.needsProjectSelection &&
                    selectedProjectIds.length === 0)
                }
                onClick={handleConfirmPlanChange}
              >
                {actionLoading ? "Memproses..." : "Konfirmasi Perubahan Paket"}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </Dialog>

      {/* MODAL 2: CANCEL SUBSCRIPTION MODAL */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span>Konfirmasi Pembatalan Langganan</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 leading-relaxed">
                Akses Anda tidak diputus mendadak. Anda tetap memiliki akses penuh hingga tanggal{" "}
                <strong className="text-slate-800">
                  {subscription?.currentPeriodEnd
                    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("id-ID", { dateStyle: "long" })
                    : "-"}
                </strong>
                . Data Anda tidak akan dihapus dan tetap terlindungi.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800">Alasan Utama Pembatalan (Exit Survey):</label>
                <select
                  value={cancelReasonCategory}
                  onChange={(e) => setCancelReasonCategory(e.target.value)}
                  className="w-full rounded-md border border-slate-300 p-2 text-xs focus:ring-slate-900 focus:border-slate-900"
                >
                  <option value="Proyek telah selesai / tidak ada proyek baru berjalan">
                    Proyek telah selesai / tidak ada proyek baru berjalan
                  </option>
                  <option value="Biaya melebihi alokasi anggaran operasional">
                    Biaya melebihi alokasi anggaran operasional
                  </option>
                  <option value="Fitur yang dibutuhkan belum lengkap">
                    Fitur yang dibutuhkan belum lengkap
                  </option>
                  <option value="Beralih kembali ke spreadsheet internal manual">
                    Beralih kembali ke spreadsheet internal manual
                  </option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-800">Masukan Tambahan untuk Tim Produk (Opsional):</label>
                <Textarea
                  value={cancelReasonDetails}
                  onChange={(e) => setCancelReasonDetails(e.target.value)}
                  placeholder="Apa yang bisa kami tingkatkan agar COVE lebih bermanfaat bagi kontraktor Anda?"
                  className="text-xs resize-none h-20"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelModal(false)}
                disabled={actionLoading}
              >
                Pertahankan Langganan
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmCancel}
                disabled={actionLoading}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {actionLoading ? "Memproses..." : "Jadwalkan Pembatalan"}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
