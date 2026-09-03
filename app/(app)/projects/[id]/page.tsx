"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { formatIDR, getDaysDiff } from "@/lib/utils";
import { MoneyPipeline } from "@/components/dashboard/MoneyPipeline";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { StageBadge } from "@/components/shared/StageBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { VariationOrderModal } from "@/components/projects/VariationOrderModal";
import { OfficialLetterModal } from "@/components/documents/OfficialLetterModal";
import {
  ArrowLeft,
  AlertTriangle,
  FileText,
  Clock,
  FileSpreadsheet,
  Scale,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { ContractRuleVersionModal } from "@/components/projects/ContractRuleVersionModal";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function ProjectDetailPage() {
  const params = useParams();
  const { t, language } = useLanguage();
  const { currentUser, refreshState } = useTenant();
  const [showVoModal, setShowVoModal] = useState(false);
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const projectId = params.id as string;

  const project = coveStore.projects.find((p) => p.id === projectId) || coveStore.projects[0];
  const contract = coveStore.contracts.find((c) => c.projectId === project.id);
  const client = coveStore.clients.find((c) => c.id === project.clientId);
  const claims = coveStore.claims.filter((c) => c.projectId === project.id);
  const projectBlockers = coveStore.blockers.filter((b) => b.projectId === project.id);
  const projectActions = coveStore.actions.filter((a) => a.projectId === project.id);
  const projectAudit = coveStore.auditLogs.filter((l) => l.entityId === project.id || claims.some((c) => c.id === l.entityId));

  const ruleVersions = coveStore.getContractRuleVersions(project.id);
  const activeRule = coveStore.getActiveContractRule(project.id);
  const pendingRule = ruleVersions.find((r) => r.status === "PENDING_APPROVAL");

  const pipeline = coveStore.getMoneyPipeline(project.id);

  // Financial aggregates
  const contractValue = contract?.currentContractValue || 0;
  const certifiedValue = pipeline.certified;
  const invoicedValue = pipeline.invoiced;
  const collectedValue = pipeline.collected;
  const outstandingValue = Math.max(0, invoicedValue - collectedValue);
  const cashAtRisk = claims.reduce((acc, clm) => {
    if (clm.riskLevel === "CRITICAL" || clm.riskLevel === "AT_RISK") {
      return acc + (clm.claimedValue - clm.cashReceivedValue);
    }
    return acc;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Back Button & Header */}
      <div>
        <Link href="/projects" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 mb-2">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{language === "id" ? "Kembali ke Master Proyek" : "Back to Projects Master"}</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{project.projectName}</h1>
              <span className="text-xs bg-slate-100 text-slate-800 font-mono font-bold px-2 py-0.5 rounded border border-slate-200">
                {project.projectCode}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {language === "id" ? "Klien:" : "Client:"} <strong className="text-slate-800">{client?.name}</strong> • {language === "id" ? "Lokasi:" : "Location:"} {project.location}, {project.city}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowLetterModal(true)}
              variant="outline"
              size="sm"
              className="text-xs font-semibold gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <FileText className="h-4 w-4 text-blue-600" />
              <span>{language === "id" ? "Buat Surat Resmi" : "Official Letter"}</span>
            </Button>
            <Link href="/progress-to-cash">
              <Button size="sm" className="bg-slate-900 text-white font-semibold text-xs gap-1.5">
                <Plus className="h-4 w-4" />
                <span>{t("p2c.new_claim", "New Progress Claim")}</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Top Level Financial KPI Header */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">{t("dash.attention.contract_value", "Contract Value")}</span>
          <div className="text-base sm:text-lg font-black font-mono text-slate-900 mt-1 truncate">
            {formatIDR(contractValue)}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">{t("p2c.summary.certified", "Certified Value")}</span>
          <div className="text-base sm:text-lg font-black font-mono text-slate-900 mt-1 truncate">
            {formatIDR(certifiedValue)}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">{t("p2c.summary.invoiced", "Invoiced")}</span>
          <div className="text-base sm:text-lg font-black font-mono text-slate-900 mt-1 truncate">
            {formatIDR(invoicedValue)}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">{t("p2c.summary.collected", "Cash Collected")}</span>
          <div className="text-base sm:text-lg font-black font-mono text-emerald-700 mt-1 truncate">
            {formatIDR(collectedValue)}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">{t("inv.outstanding", "Outstanding")}</span>
          <div className="text-base sm:text-lg font-black font-mono text-amber-700 mt-1 truncate">
            {formatIDR(outstandingValue)}
          </div>
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50/50 p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-red-700 uppercase tracking-wider block">{t("dash.kpi.cash_at_risk", "Cash at Risk")}</span>
          <div className="text-base sm:text-lg font-black font-mono text-red-700 mt-1 truncate">
            {formatIDR(cashAtRisk)}
          </div>
        </div>
      </div>

      {/* 5 Main Project Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-slate-100 p-1 border border-slate-200 rounded-lg">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="claims">Progress-to-Cash ({claims.length})</TabsTrigger>
          <TabsTrigger value="addendum">{language === "id" ? "Addendum & VO" : "Addendums & VO"}</TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5" />
            <span>{language === "id" ? `Aturan Kontrak (${ruleVersions.length})` : `Contract Rules (${ruleVersions.length})`}</span>
          </TabsTrigger>
          <TabsTrigger value="blockers">Blockers ({projectBlockers.length})</TabsTrigger>
          <TabsTrigger value="actions">Actions ({projectActions.length})</TabsTrigger>
          <TabsTrigger value="activity">{language === "id" ? "Riwayat Aktivitas" : "Activity Log"}</TabsTrigger>
        </TabsList>

        {/* 1. OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <MoneyPipeline pipeline={pipeline} projectName={project.projectName} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Blockers in Project */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <h4 className="text-sm font-bold text-slate-900">{language === "id" ? "Kendala / Blocker Aktif Proyek" : "Active Economic Blockers"}</h4>
                </div>
                <span className="text-xs text-slate-500 font-semibold">{projectBlockers.length} issues</span>
              </div>

              {projectBlockers.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">{language === "id" ? "Tidak ada blocker aktif pada proyek ini." : "No active blockers on this project."}</div>
              ) : (
                <div className="space-y-3">
                  {projectBlockers.map((blk) => (
                    <div key={blk.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900">{blk.title}</span>
                        <span className="font-mono font-bold text-red-700">{formatIDR(blk.financialExposure)}</span>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed mb-2">{blk.description}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-200 pt-2">
                        <span>Controllability: <strong className="text-slate-800 uppercase">{blk.controllability}</strong></span>
                        <span>Target: {blk.targetResolveDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Contract & Schedule Summary */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <h4 className="text-sm font-bold text-slate-900">{language === "id" ? "Ringkasan Kontrak & Komersial" : "Contract & Commercial Terms"}</h4>
                </div>
                <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono text-slate-700">
                  {contract?.contractNumber}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">{language === "id" ? "Judul Kontrak" : "Contract Title"}</span>
                  <span className="font-medium text-slate-900 text-right max-w-[240px]">{contract?.contractTitle}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">{language === "id" ? "Metode Pembayaran" : "Payment Terms"}</span>
                  <span className="font-semibold text-slate-900">{contract?.paymentMethod} ({contract?.paymentTermDays} hari)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">{language === "id" ? "Potongan Retensi" : "Retention Rate"}</span>
                  <span className="font-semibold text-slate-900">{contract?.retentionPercent}% (FHO Release)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Timeline</span>
                  <span className="font-semibold text-slate-900">{project.contractStartDate} s/d {project.contractFinishDate}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Commercial Manager</span>
                  <span className="font-semibold text-slate-900">Dimas Sucipto</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 2. CLAIMS TAB */}
        <TabsContent value="claims" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                    <th className="py-3 px-4">Claim #</th>
                    <th className="py-3 px-4">{language === "id" ? "Periode" : "Period"}</th>
                    <th className="py-3 px-4">{language === "id" ? "Tahap" : "Stage"}</th>
                    <th className="py-3 px-4">Aging</th>
                    <th className="py-3 px-4">{t("p2c.summary.work_performed", "Work Value")}</th>
                    <th className="py-3 px-4">{t("p2c.summary.claimed", "Claimed")}</th>
                    <th className="py-3 px-4">{t("p2c.summary.certified", "Certified")}</th>
                    <th className="py-3 px-4">{t("p2c.summary.collected", "Cash Received")}</th>
                    <th className="py-3 px-4">{t("dash.attention.status", "Risk Level")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {claims.map((clm) => {
                    const aging = getDaysDiff(clm.currentStageEnteredAt);
                    return (
                      <tr key={clm.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">{clm.claimNumber}</td>
                        <td className="py-3.5 px-4 text-slate-600">{clm.periodStart} s/d {clm.periodEnd}</td>
                        <td className="py-3.5 px-4"><StageBadge stage={clm.currentStage} size="sm" /></td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium">{aging} {language === "id" ? "hari" : "days"}</td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">{formatIDR(clm.workPerformedValue)}</td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">{formatIDR(clm.claimedValue)}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">{formatIDR(clm.certifiedValue)}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{formatIDR(clm.cashReceivedValue)}</td>
                        <td className="py-3.5 px-4"><RiskBadge level={clm.riskLevel} size="sm" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* 3. BLOCKERS TAB */}
        <TabsContent value="blockers" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div className="space-y-3">
              {projectBlockers.map((blk) => (
                <div key={blk.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{blk.title}</span>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                        {blk.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{blk.description}</p>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Severity: <strong className="uppercase text-slate-700">{blk.severity}</strong></span>
                      <span>Controllability: <strong className="uppercase text-slate-700">{blk.controllability}</strong></span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-slate-500 block">{t("act.exposure", "Financial Exposure")}</span>
                    <span className="text-sm font-extrabold font-mono text-red-700">{formatIDR(blk.financialExposure)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* 4. ACTIONS TAB */}
        <TabsContent value="actions" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div className="space-y-3">
              {projectActions.map((act) => (
                <div key={act.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{act.title}</span>
                      <span className="text-[10px] font-bold uppercase bg-red-100 text-red-900 px-2 py-0.5 rounded border border-red-300">
                        {act.priority}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{act.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-slate-500 block">{t("act.exposure", "Exposure")}</span>
                    <span className="text-sm font-extrabold font-mono text-slate-900">{formatIDR(act.financialExposure)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* 5. ACTIVITY TAB */}
        <TabsContent value="activity" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
            <div className="space-y-4">
              {projectAudit.map((item) => (
                <div key={item.id} className="flex items-start gap-3 text-xs pb-3 border-b border-slate-100 last:border-0">
                  <Clock className="h-4 w-4 text-slate-400 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-semibold text-slate-900">{item.description}</span>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      By <strong>{item.user}</strong> • {new Date(item.timestamp).toLocaleString("id-ID")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* 6. ADDENDUM & VARIATION ORDERS TAB */}
        <TabsContent value="addendum" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-sm font-bold text-slate-900">
                    {language === "id" ? "Buku Amandemen Kontrak & Variation Orders (VO / CCO)" : "Contract Addendums & Variation Orders"}
                  </h4>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === "id" 
                    ? "Kelola pekerjaan tambah/kurang dan perpanjangan waktu resmi agar seluruh nilai lapangan teragregasi ke penagihan" 
                    : "Manage variation orders, change orders, and time extensions"}
                </p>
              </div>

              <Button
                onClick={() => setShowVoModal(true)}
                size="sm"
                className="bg-slate-900 text-white font-bold text-xs gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{language === "id" ? "Catat Addendum / VO Baru" : "New Variation Order"}</span>
              </Button>
            </div>

            {/* Contract Value Bridge */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500 font-semibold uppercase block">Nilai Kontrak Awal (Original SPK)</span>
                <span className="text-lg font-black font-mono text-slate-800 mt-1 block">
                  {formatIDR(contract?.originalContractValue || contractValue)}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[11px] text-emerald-800 font-semibold uppercase block">Total Penyesuaian Addendum</span>
                <span className="text-lg font-black font-mono text-emerald-700 mt-1 block">
                  + {formatIDR(Math.max(0, contractValue - (contract?.originalContractValue || contractValue)))}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 text-white">
                <span className="text-[11px] text-slate-300 font-semibold uppercase block">Nilai Kontrak Terkini (Current Total)</span>
                <span className="text-lg font-black font-mono text-emerald-400 mt-1 block">
                  {formatIDR(contractValue)}
                </span>
              </div>
            </div>

            {/* List of Addendums / Variation Orders */}
            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                    <th className="py-3 px-4">No. Addendum / VO</th>
                    <th className="py-3 px-4">Uraian Perubahan</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4 text-right">Nilai Perubahan (IDR)</th>
                    <th className="py-3 px-4 text-center">Waktu (EOT)</th>
                    <th className="py-3 px-4 text-center">Status MK</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">ADD-01-{project.projectCode}</td>
                    <td className="py-3 px-4 max-w-[280px]">
                      <div className="font-bold text-slate-900">Pekerjaan Tambah Struktur Ramp Basement & Dinding Penahan</div>
                      <div className="text-[11px] text-slate-500">Instruksi Lapangan MK No. SI-042</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-blue-50 text-blue-800 font-bold px-2 py-0.5 rounded text-[10px]">
                        Pekerjaan Tambah
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-700 text-right">
                      + Rp 850.000.000
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold">+14 hari</td>
                    <td className="py-3 px-4 text-center">
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                        Disetujui
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">SPK-UTAMA-{project.projectCode}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{contract?.contractTitle || "Kontrak Utama Konstruksi"}</div>
                      <div className="text-[11px] text-slate-500">Dokumen Kontrak Induk</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded text-[10px]">
                        Kontrak Utama
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 text-right">
                      {formatIDR(contract?.originalContractValue || 32000000000)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold">-</td>
                    <td className="py-3 px-4 text-center">
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                        Aktif
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* 7. CONTRACT RULES & VERSIONING TAB (PHASE 3) */}
        <TabsContent value="rules" className="mt-4 space-y-6">
          {/* Pending Approval Alert Banner */}
          {pendingRule && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-start sm:items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <span className="font-bold text-amber-900 block text-xs">
                    Usulan Versi Aturan Kontrak Baru ({pendingRule.versionNumber}) Menunggu Approval Direksi/Owner!
                  </span>
                  <span className="text-[11px] text-amber-800 block mt-0.5">
                    Diajukan oleh <strong>{pendingRule.createdBy}</strong> • Klausul: {pendingRule.sourceClauseRef} • Cut-off: Tgl {pendingRule.cutOffDay}, SLA Review: {pendingRule.reviewSlaDays} hari, Payment Term: {pendingRule.paymentTermDays} hari ({pendingRule.calendarBasis === "WORKING_DAYS" ? "Hari Kerja" : "Hari Kalender"}).
                  </span>
                </div>
              </div>
              {(currentUser.role === "OWNER" || currentUser.role === "ADMIN") && (
                <Button
                  size="sm"
                  onClick={() => {
                    coveStore.approveContractRuleVersion(pendingRule.id, `${currentUser.fullName} (${currentUser.role})`);
                    refreshState();
                  }}
                  className="bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs gap-1.5 shrink-0"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Sahkan Versi Ini</span>
                </Button>
              )}
            </div>
          )}

          {/* Active Contract Rule Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Scale className="h-5 w-5 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Fondasi Aturan Kontrak Terkini ({activeRule?.versionNumber || "v1.0"})
                  </h3>
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                    Aktif &amp; Terikat Hukum
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Sumber kebenaran legal acuan pemotongan retensi, recovery uang muka, batas SLA opname/review, dan jatuh tempo kas
                </p>
              </div>

              <Button
                onClick={() => setShowRuleModal(true)}
                size="sm"
                className="bg-slate-900 text-white font-bold text-xs gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Usulkan Perubahan Aturan</span>
              </Button>
            </div>

            {/* 4 Essential Operational Timings */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500 font-semibold uppercase block">Tanggal Cut-off Bulanan</span>
                <span className="text-base font-black font-mono text-slate-900 mt-1 block">
                  Setiap Tgl {activeRule?.cutOffDay || 25}
                </span>
                <span className="text-[10px] text-slate-400">Batas opname bersama</span>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500 font-semibold uppercase block">Lead Time Internal QS</span>
                <span className="text-base font-black font-mono text-slate-900 mt-1 block">
                  {activeRule?.internalLeadTimeDays || 5} Hari
                </span>
                <span className="text-[10px] text-slate-400">Penyusunan berkas klaim</span>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500 font-semibold uppercase block">SLA Review MK / Konsultan</span>
                <span className="text-base font-black font-mono text-amber-700 mt-1 block">
                  {activeRule?.reviewSlaDays || 14} Hari
                </span>
                <span className="text-[10px] text-slate-400">Batas pengesahan BAP</span>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500 font-semibold uppercase block">Payment Term / Jatuh Tempo</span>
                <span className="text-base font-black font-mono text-blue-700 mt-1 block">
                  {activeRule?.paymentTermDays || 30} Hari
                </span>
                <span className="text-[10px] text-slate-400">
                  Basis {activeRule?.calendarBasis === "WORKING_DAYS" ? "Hari Kerja (Working Days)" : "Hari Kalender"}
                </span>
              </div>
            </div>

            {/* Financial & Tax Clauses */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500 font-semibold uppercase block">Potongan Retensi Kontrak</span>
                <span className="text-base font-black font-mono text-slate-900 mt-1 block">
                  {activeRule?.retentionPercent || 5.0}%
                </span>
                <span className="text-[10px] text-slate-400">Dicairkan saat BAP FHO</span>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500 font-semibold uppercase block">Pemotongan Uang Muka</span>
                <span className="text-base font-black font-mono text-slate-900 mt-1 block">
                  {activeRule?.advanceRecoveryPercent || 0}% ({activeRule?.advanceRecoveryRule || "NONE"})
                </span>
                <span className="text-[10px] text-slate-400">Dipotong dari nilai bruto</span>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500 font-semibold uppercase block">Klausul Pajak Khusus Proyek</span>
                <span className="text-xs font-bold text-slate-800 mt-1 block leading-snug">
                  {activeRule?.taxTreatment || "PPN 11% & PPh Final 1.75%"}
                </span>
                <span className="text-[10px] text-slate-400">Bukan kalkulator universal</span>
              </div>
            </div>

            {/* Legal Footnote */}
            <div className="p-3.5 bg-slate-50/80 rounded-lg border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-slate-500 block text-[11px]">Klausul Dasar Acuan Kontrak:</span>
                <span className="font-bold text-slate-900 font-mono">{activeRule?.sourceClauseRef || "Pasal 8 SPK"}</span>
                {activeRule?.notes && (
                  <span className="text-slate-500 block text-[11px] mt-0.5">{activeRule.notes}</span>
                )}
              </div>
              <div className="text-left sm:text-right text-[11px] text-slate-500">
                <span>Disahkan oleh: <strong className="text-slate-800">{activeRule?.approvedBy || "Raka Pratama (Owner)"}</strong></span>
                <span className="block text-[10px]">Tanggal Efektif: {activeRule?.effectiveDate || project.contractStartDate}</span>
              </div>
            </div>
          </div>

          {/* Version History Table */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Riwayat Versi Aturan Kontrak (Version History)</h4>
              <p className="text-xs text-slate-500">Audit trail lengkap seluruh riwayat amandemen aturan komersial proyek</p>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                    <th className="py-3 px-4">Versi</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Tgl Efektif</th>
                    <th className="py-3 px-4">Cut-off</th>
                    <th className="py-3 px-4">SLA Review</th>
                    <th className="py-3 px-4">Payment Term</th>
                    <th className="py-3 px-4">Retensi</th>
                    <th className="py-3 px-4">Klausul Acuan</th>
                    <th className="py-3 px-4">Disahkan Oleh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ruleVersions.map((ver) => (
                    <tr key={ver.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{ver.versionNumber}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            ver.status === "APPROVED"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : ver.status === "PENDING_APPROVAL"
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {ver.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">{ver.effectiveDate}</td>
                      <td className="py-3.5 px-4 font-mono">Tgl {ver.cutOffDay}</td>
                      <td className="py-3.5 px-4 font-mono">{ver.reviewSlaDays} hari</td>
                      <td className="py-3.5 px-4 font-mono">{ver.paymentTermDays} hari ({ver.calendarBasis === "WORKING_DAYS" ? "HK" : "Kalender"})</td>
                      <td className="py-3.5 px-4 font-mono">{ver.retentionPercent}%</td>
                      <td className="py-3.5 px-4 text-slate-800 font-medium max-w-[200px] truncate">{ver.sourceClauseRef}</td>
                      <td className="py-3.5 px-4 text-slate-600">{ver.approvedBy || ver.createdBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Variation Order / Addendum Modal */}
      <VariationOrderModal
        open={showVoModal}
        onOpenChange={setShowVoModal}
        projectId={project.id}
      />

      {/* Contract Rule Versioning Modal (Phase 3) */}
      <ContractRuleVersionModal
        open={showRuleModal}
        onOpenChange={setShowRuleModal}
        projectId={project.id}
        contractId={contract?.id || "ctr-default"}
        currentActiveRule={activeRule}
      />

      {/* Official Legal Letter Generator Modal */}
      <OfficialLetterModal
        open={showLetterModal}
        onOpenChange={setShowLetterModal}
        projectId={project.id}
      />
    </div>
  );
}
