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
import {
  ArrowLeft,
  AlertTriangle,
  FileText,
  Clock,
  Plus,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function ProjectDetailPage() {
  const params = useParams();
  const { t, language } = useLanguage();
  const projectId = params.id as string;

  const project = coveStore.projects.find((p) => p.id === projectId) || coveStore.projects[0];
  const contract = coveStore.contracts.find((c) => c.projectId === project.id);
  const client = coveStore.clients.find((c) => c.id === project.clientId);
  const claims = coveStore.claims.filter((c) => c.projectId === project.id);
  const projectBlockers = coveStore.blockers.filter((b) => b.projectId === project.id);
  const projectActions = coveStore.actions.filter((a) => a.projectId === project.id);
  const projectAudit = coveStore.auditLogs.filter((l) => l.entityId === project.id || claims.some((c) => c.id === l.entityId));

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
      </Tabs>
    </div>
  );
}
