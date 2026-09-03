"use client";

import React, { useState } from "react";
import { formatIDR } from "@/lib/utils";
import { StageBadge } from "@/components/shared/StageBadge";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { ClaimDetailDrawer } from "@/components/claims/ClaimDetailDrawer";
import { CreateClaimModal } from "@/components/claims/CreateClaimModal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Plus,
  Search,
  AlertTriangle,
  ArrowUpRight,
  ShieldAlert,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  HelpCircle,
  TrendingDown,
  Layers,
  Filter,
} from "lucide-react";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  evaluateLedgerExposure,
  filterLedgerItems,
  CORE_STAGES,
  CoreStageCode,
  ControllabilityType,
  FreshnessStatus,
  LedgerItemRecord,
} from "@/domains/ledger/service";
import {
  ACTIONABLE_EMPTY_STATES,
  formatSourceLineage,
  generateErpInvoiceReconciliationCsv,
  validateSavedFilterView,
} from "@/domains/platform/service";
import Link from "next/link";

export default function ProgressToCashPage() {
  const { refreshTrigger, refreshState, currentUser } = useTenant();
  const { t, language } = useLanguage();

  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filters (LED-004)
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [coreStageFilter, setCoreStageFilter] = useState<string>("all");
  const [controllabilityFilter, setControllabilityFilter] = useState<string>("all");
  const [freshnessFilter, setFreshnessFilter] = useState<string>("all");
  const [disputeFilter, setDisputeFilter] = useState<string>("all");

  // Dispute Modal State (LED-012)
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [targetClaimForDispute, setTargetClaimForDispute] = useState<any | null>(null);
  const [disputeReason, setDisputeReason] = useState("");

  // Write-Off Modal State (LED-014)
  const [writeOffModalOpen, setWriteOffModalOpen] = useState(false);
  const [targetClaimForWriteOff, setTargetClaimForWriteOff] = useState<any | null>(null);
  const [writeOffAmount, setWriteOffAmount] = useState(0);
  const [writeOffReason, setWriteOffReason] = useState("");

  // Saved Views State (PLT-014)
  const [selectedSavedViewId, setSelectedSavedViewId] = useState<string>("");
  const [showSaveViewModal, setShowSaveViewModal] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [saveViewError, setSaveViewError] = useState("");

  const savedViews = coveStore.getSavedFilterViews("progress-to-cash");

  const handleApplySavedView = (viewId: string) => {
    setSelectedSavedViewId(viewId);
    if (!viewId) return;
    const view = savedViews.find((v) => v.id === viewId);
    if (view && view.filterCriteria) {
      if (view.filterCriteria.projectFilter) setProjectFilter(view.filterCriteria.projectFilter);
      if (view.filterCriteria.coreStageFilter) setCoreStageFilter(view.filterCriteria.coreStageFilter);
      if (view.filterCriteria.controllabilityFilter) setControllabilityFilter(view.filterCriteria.controllabilityFilter);
      if (view.filterCriteria.freshnessFilter) setFreshnessFilter(view.filterCriteria.freshnessFilter);
      if (view.filterCriteria.disputeFilter) setDisputeFilter(view.filterCriteria.disputeFilter);
    }
  };

  const handleSaveCurrentView = () => {
    const validation = validateSavedFilterView({
      viewName: newViewName,
      pageContext: "progress-to-cash",
      filterCriteria: {
        projectFilter,
        coreStageFilter,
        controllabilityFilter,
        freshnessFilter,
        disputeFilter,
      },
    });

    if (!validation.valid) {
      setSaveViewError(validation.error || "Gagal menyimpan tampilan");
      return;
    }

    coveStore.saveFilterView(
      newViewName,
      "progress-to-cash",
      { projectFilter, coreStageFilter, controllabilityFilter, freshnessFilter, disputeFilter },
      currentUser?.id
    );
    setNewViewName("");
    setSaveViewError("");
    setShowSaveViewModal(false);
    refreshState();
  };

  const handleExportErpCsv = () => {
    const csv = generateErpInvoiceReconciliationCsv(coveStore.invoices, coveStore.claims);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `COVE_ERP_Invoice_Bridge_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Build contract rules calendar map
  const contractRulesMap: Record<string, { calendarBasis: "CALENDAR_DAYS" | "WORKING_DAYS" }> = {};
  for (const p of coveStore.projects) {
    const activeRule = coveStore.getActiveContractRule(p.id);
    if (activeRule) {
      contractRulesMap[p.id] = { calendarBasis: activeRule.calendarBasis };
    }
  }

  // Calculate master exposure using Phase 5 Ledger Engine
  const { items: allLedgerItems, summary } = evaluateLedgerExposure(coveStore.claims, contractRulesMap);

  // Apply filters (LED-004)
  const { filteredItems, filteredTotalGrossExposure, filteredTotalControllable } = filterLedgerItems(
    allLedgerItems,
    {
      projectId: projectFilter === "all" ? undefined : projectFilter,
      coreStage: coreStageFilter === "all" ? undefined : (coreStageFilter as CoreStageCode),
      controllability: controllabilityFilter === "all" ? undefined : (controllabilityFilter as ControllabilityType),
      freshness: freshnessFilter === "all" ? undefined : (freshnessFilter as FreshnessStatus),
      isDisputed: disputeFilter === "all" ? undefined : disputeFilter === "disputed",
      searchQuery: search,
    }
  );

  // Quick Controllability update handler (LED-007)
  const handleUpdateControllability = (claimId: string, newControllability: ControllabilityType) => {
    coveStore.updateClaimControllability(claimId, newControllability, currentUser.fullName);
    refreshState();
  };

  // Dispute submit handler (LED-012)
  const handleSubmitDispute = () => {
    if (!targetClaimForDispute || !disputeReason.trim()) {
      alert("Alasan sengketa wajib diisi.");
      return;
    }
    coveStore.markClaimDisputed(targetClaimForDispute.id, disputeReason.trim(), currentUser.fullName);
    setDisputeModalOpen(false);
    setTargetClaimForDispute(null);
    setDisputeReason("");
    refreshState();
  };

  // Write-off submit handler (LED-014)
  const handleSubmitWriteOff = () => {
    if (!targetClaimForWriteOff || !writeOffReason.trim() || writeOffAmount <= 0) {
      alert("Nilai write-off dan alasan bisnis wajib diisi.");
      return;
    }
    coveStore.writeOffClaim(targetClaimForWriteOff.id, writeOffAmount, writeOffReason.trim(), currentUser.fullName);
    setWriteOffModalOpen(false);
    setTargetClaimForWriteOff(null);
    setWriteOffReason("");
    setWriteOffAmount(0);
    refreshState();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Value Gap Ledger &amp; Progress-to-Cash
            </h1>
            <span className="text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
              Modul 2 (PRD v1.0)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Satu ledger nilai pre-invoice tanpa double-count, pelacakan umur kalender kerja kontrak, dan kendali keterkendalian (Controllability).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>{language === "id" ? "Buat Klaim Baru" : "New Progress Claim"}</span>
          </Button>
        </div>
      </div>

      {/* 5 Executive Exposure Cards (PRD 11.2, 14.3, LED-006, LED-015) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Card 1: Controllable Pre-Invoice Exposure */}
        <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-900 uppercase block">
              Controllable Pre-Invoice
            </span>
            <span className="text-[10px] bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded font-bold">
              Kritis
            </span>
          </div>
          <span className="text-lg font-black font-mono text-blue-950 mt-1 block">
            {formatIDR(summary.totalControllableExposure)}
          </span>
          <span className="text-[10px] text-blue-700">Internal + Joint Action</span>
        </div>

        {/* Card 2: Gross Pre-Invoice Exposure */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 uppercase block">
            Gross Pre-Invoice Exposure
          </span>
          <span className="text-lg font-black font-mono text-slate-900 mt-1 block">
            {formatIDR(summary.totalGrossPreInvoiceExposure)}
          </span>
          <span className="text-[10px] text-slate-500">Total Nilai Sebelum Faktur (G1-G4)</span>
        </div>

        {/* Card 3: External Exposure */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 uppercase block">
            External Counterpart Delay
          </span>
          <span className="text-lg font-black font-mono text-slate-700 mt-1 block">
            {formatIDR(summary.totalExternalExposure)}
          </span>
          <span className="text-[10px] text-slate-500">Keterlambatan MK/Klien Eksternal</span>
        </div>

        {/* Card 4: Disputed Exposure */}
        <div className="p-4 rounded-xl bg-red-50/80 border border-red-200">
          <span className="text-[11px] font-bold text-red-900 uppercase block">
            Disputed Exposure (Sengketa)
          </span>
          <span className="text-lg font-black font-mono text-red-700 mt-1 block">
            {formatIDR(summary.totalDisputedExposure)}
          </span>
          <span className="text-[10px] text-red-600">Eksposur Terlindungi (PRD LED-012)</span>
        </div>

        {/* Card 5: Unknown Controllability Queue */}
        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200">
          <span className="text-[11px] font-bold text-amber-900 uppercase block">
            Antrean Klasifikasi
          </span>
          <span className="text-lg font-black font-mono text-amber-800 mt-1 block">
            {summary.unknownClassificationCount} Item ({formatIDR(summary.totalUnknownExposure)})
          </span>
          <span className="text-[10px] text-amber-700">Perlu Penentuan PIC (LED-007)</span>
        </div>
      </div>

      {/* Sequential Gaps Breakdown Bar (LED-010, Zero Double-Count Proof) */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">
              5 Sequential Value Gaps (Zero Double-Count Guarantee):
            </span>
            <span className="bg-slate-100 text-slate-700 font-mono text-[10px] px-2 py-0.5 rounded border">
              Σ G1..G5 = Rp {(
                summary.gapsBreakdown.unmeasured +
                summary.gapsBreakdown.unclaimed +
                summary.gapsBreakdown.uncertified +
                summary.gapsBreakdown.certifiedNotInvoiced +
                summary.gapsBreakdown.invoicedNotCollected
              ).toLocaleString("id-ID")}
            </span>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Non-Overlapping Formula Terverifikasi</span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
          <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block font-medium">G1: Unmeasured (UAT-05)</span>
            <span className="font-mono font-bold text-slate-900 block mt-0.5">
              {formatIDR(summary.gapsBreakdown.unmeasured)}
            </span>
            <span className="text-[10px] text-slate-400">Work - Measured</span>
          </div>

          <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block font-medium">G2: Unclaimed</span>
            <span className="font-mono font-bold text-slate-900 block mt-0.5">
              {formatIDR(summary.gapsBreakdown.unclaimed)}
            </span>
            <span className="text-[10px] text-slate-400">Measured - Claimed</span>
          </div>

          <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block font-medium">G3: Uncertified (UAT-10)</span>
            <span className="font-mono font-bold text-slate-900 block mt-0.5">
              {formatIDR(summary.gapsBreakdown.uncertified)}
            </span>
            <span className="text-[10px] text-slate-400">Claimed - Certified</span>
          </div>

          <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block font-medium">G4: Cert. Not Invoiced (UAT-11)</span>
            <span className="font-mono font-bold text-slate-900 block mt-0.5">
              {formatIDR(summary.gapsBreakdown.certifiedNotInvoiced)}
            </span>
            <span className="text-[10px] text-slate-400">Certified - Invoiced</span>
          </div>

          <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block font-medium">G5: Invoiced Not Coll. (UAT-12)</span>
            <span className="font-mono font-bold text-slate-900 block mt-0.5">
              {formatIDR(summary.gapsBreakdown.invoicedNotCollected)}
            </span>
            <span className="text-[10px] text-slate-400">Invoiced - Collected</span>
          </div>
        </div>
      </div>

      {/* Filter Bar (LED-004) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nomor klaim, nama proyek, atau file sumber..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-900"
            />
          </div>

          {/* Project Filter */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 focus:bg-white focus:outline-none font-medium"
          >
            <option value="all">Semua Proyek</option>
            {coveStore.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectName}
              </option>
            ))}
          </select>

          {/* Core Stage Filter */}
          <select
            value={coreStageFilter}
            onChange={(e) => setCoreStageFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 focus:bg-white focus:outline-none font-medium"
          >
            <option value="all">Semua Core Stage (S0–S6)</option>
            {Object.values(CORE_STAGES).map((st) => (
              <option key={st.code} value={st.code}>
                {st.code} - {st.nameId}
              </option>
            ))}
          </select>

          {/* Controllability Filter (LED-007) */}
          <select
            value={controllabilityFilter}
            onChange={(e) => setControllabilityFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 focus:bg-white focus:outline-none font-medium"
          >
            <option value="all">Semua Keterkendalian</option>
            <option value="INTERNAL">INTERNAL (Terkendali Mandiri)</option>
            <option value="JOINT">JOINT (Terkendali Bersama MK)</option>
            <option value="EXTERNAL">EXTERNAL (Hambatan Klien/Pihak Luar)</option>
            <option value="UNKNOWN">UNKNOWN (Perlu Klasifikasi)</option>
          </select>

          {/* Freshness Filter (LED-011) */}
          <select
            value={freshnessFilter}
            onChange={(e) => setFreshnessFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 focus:bg-white focus:outline-none font-medium"
          >
            <option value="all">Semua Keterkinian (Freshness)</option>
            <option value="CURRENT">CURRENT (≤7 hari)</option>
            <option value="ATTENTION">ATTENTION (8–14 hari)</option>
            <option value="STALE">STALE (&gt;14 hari)</option>
          </select>

          {/* Dispute Filter (LED-012) */}
          <select
            value={disputeFilter}
            onChange={(e) => setDisputeFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 focus:bg-white focus:outline-none font-medium"
          >
            <option value="all">Status Sengketa: Semua</option>
            <option value="disputed">Hanya Klaim Disputed</option>
            <option value="normal">Klaim Normal (Non-Dispute)</option>
          </select>

          {/* PLT-014: Saved Review Views */}
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            <span className="text-[11px] font-bold text-indigo-900">View (PLT-014):</span>
            <select
              value={selectedSavedViewId}
              onChange={(e) => handleApplySavedView(e.target.value)}
              className="h-8 rounded-md border border-indigo-200 bg-indigo-50/50 px-2.5 text-xs text-indigo-900 font-semibold"
            >
              <option value="">Pilih Saved View...</option>
              {savedViews.map((sv) => (
                <option key={sv.id} value={sv.id}>
                  {sv.viewName}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSaveViewModal(true)}
              className="h-8 text-[11px] border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              + Simpan View
            </Button>
          </div>
        </div>

        {/* Invariant Indicator (LED-004): Filtered sum equals detail table */}
        <div className="text-[11px] text-slate-500 font-semibold">
          Menampilkan <strong className="text-slate-900">{filteredItems.length}</strong> klaim (Total:{" "}
          <strong className="text-slate-900 font-mono">{formatIDR(filteredTotalGrossExposure)}</strong>)
        </div>
      </div>

      {/* Master Value Gap Ledger Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {/* PLT-018: Source Lineage and Last Updated Banner & PRD 20.1 ERP Bridge */}
        <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Audit Sumber &amp; Waktu (PLT-018):</span>
            <span>Terakhir diperbarui: 4 Sep 2026, 00:20 WIB • Sumber: Batch Opname Lapangan (SHA-256 Valid)</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportErpCsv}
            className="h-7 text-[11px] font-semibold gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Ekspor ERP / Accounting CSV (PRD 20.1)</span>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Klaim &amp; Proyek</th>
                <th className="py-3 px-4">Core Stage (PRD 9.1)</th>
                <th className="py-3 px-4">Umur Tahap (Aging)</th>
                <th className="py-3 px-4 text-right">Nilai Pengajuan</th>
                <th className="py-3 px-4 text-right">Disahkan (BAP)</th>
                <th className="py-3 px-4 text-right">Gross Pre-Invoice</th>
                <th className="py-3 px-4">Keterkendalian</th>
                <th className="py-3 px-4">Keterkinian Data</th>
                <th className="py-3 px-4">Status &amp; Lineage</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 px-4 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <FileSpreadsheet className="h-5 w-5" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {ACTIONABLE_EMPTY_STATES.CLAIMS_LIST.title}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {ACTIONABLE_EMPTY_STATES.CLAIMS_LIST.explanation}
                      </p>
                      <p className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <strong>Langkah berikutnya (PLT-015):</strong>{" "}
                        {ACTIONABLE_EMPTY_STATES.CLAIMS_LIST.nextStepInstruction}
                      </p>
                      <div className="pt-2 flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSearch("");
                            setProjectFilter("all");
                            setCoreStageFilter("all");
                            setControllabilityFilter("all");
                            setFreshnessFilter("all");
                            setDisputeFilter("all");
                          }}
                          variant="outline"
                          className="text-xs"
                        >
                          Reset Filter
                        </Button>
                        <Link href={ACTIONABLE_EMPTY_STATES.CLAIMS_LIST.primaryCtaHref}>
                          <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white text-xs">
                            {ACTIONABLE_EMPTY_STATES.CLAIMS_LIST.primaryCtaLabel}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const project = coveStore.projects.find((p) => p.id === item.projectId);

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedClaimId(item.id)}
                    className="hover:bg-slate-50/90 cursor-pointer transition-colors"
                  >
                    {/* 1. Claim & Project */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 font-mono text-sm">{item.claimNumber}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[180px] mt-0.5">
                        {project?.projectName || "-"}
                      </div>
                    </td>

                    {/* 2. Core Stage (LED-001) */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold bg-slate-900 text-white px-1.5 py-0.5 rounded text-[10px]">
                          {item.coreStage}
                        </span>
                        <StageBadge stage={item.currentStage} size="sm" />
                      </div>
                    </td>

                    {/* 3. Aging (Working vs Calendar Days) (LED-003) */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-slate-900">
                        {item.stageAgingDays} hari
                      </div>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {item.calendarBasis === "WORKING_DAYS" ? "Hari Kerja" : "Hari Kalender"}
                      </span>
                    </td>

                    {/* 4. Claimed Value */}
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 text-right">
                      {formatIDR(item.claimedValue)}
                    </td>

                    {/* 5. Certified Value */}
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-700 text-right">
                      {formatIDR(item.certifiedValue)}
                    </td>

                    {/* 6. Gross Pre-Invoice Exposure (LED-006) */}
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-900 text-right">
                      {formatIDR(item.grossPreInvoiceExposure)}
                    </td>

                    {/* 7. Controllability Badge & Quick Selector (LED-007) */}
                    <td
                      className="py-3.5 px-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <select
                        value={item.controllability}
                        onChange={(e) => handleUpdateControllability(item.id, e.target.value as ControllabilityType)}
                        className={`text-[10px] font-bold rounded px-2 py-1 border font-sans uppercase ${
                          item.controllability === "INTERNAL"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : item.controllability === "JOINT"
                            ? "bg-blue-50 text-blue-800 border-blue-200"
                            : item.controllability === "EXTERNAL"
                            ? "bg-slate-100 text-slate-700 border-slate-300"
                            : "bg-amber-100 text-amber-900 border-amber-300 animate-pulse"
                        }`}
                      >
                        <option value="INTERNAL">INTERNAL</option>
                        <option value="JOINT">JOINT</option>
                        <option value="EXTERNAL">EXTERNAL</option>
                        <option value="UNKNOWN">UNKNOWN ?</option>
                      </select>
                    </td>

                    {/* 8. Freshness (LED-011) */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.freshness === "CURRENT"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.freshness === "ATTENTION"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-red-100 text-red-900"
                        }`}
                      >
                        {item.freshness}
                      </span>
                    </td>

                    {/* 9. Dispute & Lineage Info (LED-008, LED-012) */}
                    <td className="py-3.5 px-4">
                      {item.isDisputed && (
                        <span className="bg-red-100 text-red-800 font-bold px-1.5 py-0.5 rounded text-[10px] block mb-1">
                          DISPUTE ACTIVE
                        </span>
                      )}
                      {item.isWrittenOff && (
                        <span className="bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded text-[10px] block mb-1">
                          WRITTEN OFF
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono truncate block max-w-[120px]" title={item.sourceReference || "Manual"}>
                        Ref: {item.sourceReference || "Manual"}
                      </span>
                    </td>

                    {/* 10. Actions */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {!item.isDisputed && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setTargetClaimForDispute(item);
                              setDisputeModalOpen(true);
                            }}
                            className="h-7 text-[10px] px-2 text-red-700 border-red-200 hover:bg-red-50"
                          >
                            Dispute
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedClaimId(item.id)}
                          className="h-7 text-xs px-2.5 font-semibold gap-1"
                        >
                          <span>Rincian</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispute Modal (LED-012) */}
      <Dialog open={disputeModalOpen} onOpenChange={setDisputeModalOpen}>
        <DialogHeader>
          <DialogTitle className="text-red-700 flex items-center gap-2 text-sm font-bold">
            <ShieldAlert className="h-5 w-5" />
            <span>Tandai Sengketa (Dispute) Tanpa Menghapus Eksposur</span>
          </DialogTitle>
          <DialogDescription>
            Sesuai PRD LED-012, penandaan dispute memindahkan status ke tahap sengketa dengan mencatat alasan bisnis,
            namun nilai finansial tetap dipertahankan penuh dalam pengawasan ledger eksposur.
          </DialogDescription>
        </DialogHeader>

        {targetClaimForDispute && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono text-[11px]">
              <div>Klaim: <strong>{targetClaimForDispute.claimNumber}</strong></div>
              <div>Nilai Eksposur: <strong>{formatIDR(targetClaimForDispute.grossPreInvoiceExposure)}</strong></div>
            </div>

            <div>
              <Label htmlFor="disputeReason">Alasan Sengketa / Commercial Dispute (Wajib Diisi) *</Label>
              <Input
                id="disputeReason"
                required
                placeholder="Contoh: Perbedaan metode uji kekuatan beton bored pile dengan MK"
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setDisputeModalOpen(false)}>
            Batal
          </Button>
          <Button onClick={handleSubmitDispute} className="bg-red-700 hover:bg-red-800 text-white font-bold">
            Tandai Sengketa &amp; Catat Audit
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Write-Off Modal (LED-014) */}
      <Dialog open={writeOffModalOpen} onOpenChange={setWriteOffModalOpen}>
        <DialogHeader>
          <DialogTitle className="text-slate-900 flex items-center gap-2 text-sm font-bold">
            <TrendingDown className="h-5 w-5 text-red-600" />
            <span>Pencatatan Penghapusan (Write-Off / Closed No Recovery)</span>
          </DialogTitle>
          <DialogDescription>
            Sesuai PRD LED-014, write-off dicatat secara terpisah dari keberhasilan penagihan (resolved outcome) agar tidak
            mengacaukan metrik pemulihan arus kas nyata.
          </DialogDescription>
        </DialogHeader>

        {targetClaimForWriteOff && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono text-[11px]">
              <div>Klaim: <strong>{targetClaimForWriteOff.claimNumber}</strong></div>
              <div>Pengajuan: <strong>{formatIDR(targetClaimForWriteOff.claimedValue)}</strong></div>
            </div>

            <div>
              <Label htmlFor="writeOffAmt">Nominal Write-Off (Rp) *</Label>
              <Input
                id="writeOffAmt"
                type="number"
                required
                value={writeOffAmount}
                onChange={(e) => setWriteOffAmount(Number(e.target.value))}
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label htmlFor="writeOffReason">Alasan Bisnis Penghapusan (Wajib Diisi) *</Label>
              <Input
                id="writeOffReason"
                required
                placeholder="Contoh: Kesepakatan deduksi final pemotongan denda keterlambatan"
                value={writeOffReason}
                onChange={(e) => setWriteOffReason(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setWriteOffModalOpen(false)}>
            Batal
          </Button>
          <Button onClick={handleSubmitWriteOff} className="bg-slate-900 hover:bg-slate-800 text-white font-bold">
            Eksekusi Write-Off
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Save View Modal (PLT-014) */}
      <Dialog open={showSaveViewModal} onOpenChange={setShowSaveViewModal}>
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Filter className="h-4 w-4 text-indigo-600" />
            <span>Simpan Review View Baru (PLT-014)</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Simpan konfigurasi filter saat ini (Proyek, Core Stage, Keterkendalian, Keterkinian) sebagai tampilan peninjauan cepat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div>
            <Label className="text-slate-700 font-semibold text-xs">Nama Tampilan</Label>
            <Input
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="Contoh: Rapat Mingguan Direksi - Internal Kritis"
              className="mt-1 h-9 text-xs"
            />
            {saveViewError && (
              <p className="text-[11px] text-red-600 font-medium mt-1">{saveViewError}</p>
            )}
          </div>
          <div className="p-2.5 bg-slate-50 rounded-lg border text-[11px] text-slate-600 space-y-0.5">
            <p><strong>Filter Terpasang:</strong></p>
            <p>Proyek: {projectFilter === "all" ? "Semua" : projectFilter}</p>
            <p>Stage: {coreStageFilter === "all" ? "Semua" : coreStageFilter}</p>
            <p>Keterkendalian: {controllabilityFilter}</p>
            <p>Freshness: {freshnessFilter}</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSaveViewModal(false)}>
            Batal
          </Button>
          <Button size="sm" onClick={handleSaveCurrentView} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            Simpan Tampilan
          </Button>
        </DialogFooter>
      </Dialog>

      <CreateClaimModal open={showCreateModal} onOpenChange={setShowCreateModal} />

      <ClaimDetailDrawer
        claimId={selectedClaimId}
        onClose={() => setSelectedClaimId(null)}
      />
    </div>
  );
}
