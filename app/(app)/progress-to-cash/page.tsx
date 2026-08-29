"use client";

import React, { useState } from "react";
import { formatIDR, getDaysDiff } from "@/lib/utils";
import { StageBadge } from "@/components/shared/StageBadge";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { ClaimDetailDrawer } from "@/components/claims/ClaimDetailDrawer";
import { CreateClaimModal } from "@/components/claims/CreateClaimModal";
import { Button } from "@/components/ui/button";
import { Plus, Search, AlertTriangle, ArrowUpRight } from "lucide-react";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function ProgressToCashPage() {
  const { refreshTrigger } = useTenant();
  const { t, language } = useLanguage();
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");

  const claims = coveStore.claims;

  const filteredClaims = claims.filter((clm) => {
    const project = coveStore.projects.find((p) => p.id === clm.projectId);
    const owner = coveStore.profiles.find((p) => p.id === clm.responsibleOwnerId);

    const matchesSearch =
      clm.claimNumber.toLowerCase().includes(search.toLowerCase()) ||
      (project?.projectName || "").toLowerCase().includes(search.toLowerCase()) ||
      (owner?.fullName || "").toLowerCase().includes(search.toLowerCase());

    const matchesProject = projectFilter === "all" || clm.projectId === projectFilter;
    const matchesStage = stageFilter === "all" || clm.currentStage === stageFilter;
    const matchesRisk = riskFilter === "all" || clm.riskLevel === riskFilter;

    return matchesSearch && matchesProject && matchesStage && matchesRisk;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {t("p2c.title", "Portofolio Progress-to-Cash")}
            </h1>
            <span className="text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded">
              {language === "id" ? "Kontrol Ekonomi Utama" : "Core Economic Control"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {t("p2c.subtitle", "Pantau pergerakan nilai setiap progres klaim, deteksi gap tertahan, dan kendalikan Cash-at-Risk")}
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

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={language === "id" ? "Cari nomor klaim (MC-006), nama proyek, PIC..." : "Search claim (MC-006), project, owner..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-900"
            />
          </div>

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 focus:bg-white focus:outline-none font-medium"
          >
            <option value="all">{t("p2c.all_projects", "Semua Proyek")}</option>
            {coveStore.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectName}
              </option>
            ))}
          </select>

          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 focus:bg-white focus:outline-none font-medium"
          >
            <option value="all">{language === "id" ? "Semua Tahap" : "All Stages"}</option>
            <option value="WORK_RECORDED">{language === "id" ? "1. Pekerjaan Tercatat" : "1. Work Recorded"}</option>
            <option value="MEASUREMENT">{language === "id" ? "2. Pengukuran / Opname" : "2. Measurement"}</option>
            <option value="CLAIM_PREPARATION">{language === "id" ? "3. Penyusunan Klaim" : "3. Claim Preparation"}</option>
            <option value="SUBMITTED">{language === "id" ? "5. Diajukan ke MK" : "5. Submitted"}</option>
            <option value="UNDER_REVIEW">{language === "id" ? "6. Peninjauan MK" : "6. Under Review"}</option>
            <option value="CERTIFIED">{language === "id" ? "7. Disertifikasi BAP" : "7. Certified"}</option>
            <option value="INVOICE_ISSUED">{language === "id" ? "9. Faktur Diterbitkan" : "9. Invoice Issued"}</option>
            <option value="DUE">{language === "id" ? "11. Jatuh Tempo Bayar" : "11. Due for Payment"}</option>
            <option value="PAID">{language === "id" ? "13. Lunas / Kas Cair" : "13. Paid / Collected"}</option>
          </select>

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 focus:bg-white focus:outline-none font-medium"
          >
            <option value="all">{language === "id" ? "Semua Tingkat Risiko" : "All Risk Levels"}</option>
            <option value="CRITICAL">{language === "id" ? "Kritis (Critical)" : "Critical"}</option>
            <option value="AT_RISK">{language === "id" ? "Berisiko (At Risk)" : "At Risk"}</option>
            <option value="WATCH">{language === "id" ? "Perhatian (Watch)" : "Watch"}</option>
            <option value="HEALTHY">{language === "id" ? "Sehat (Healthy)" : "Healthy"}</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-semibold">
          {language === "id" ? (
            <>Menampilkan <strong className="text-slate-900">{filteredClaims.length}</strong> klaim</>
          ) : (
            <>Showing <strong className="text-slate-900">{filteredClaims.length}</strong> claims</>
          )}
        </div>
      </div>

      {/* Progress-to-Cash Portfolio Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">{language === "id" ? "Nomor Klaim & Proyek" : "Claim # & Project"}</th>
                <th className="py-3 px-4">{language === "id" ? "Periode" : "Period"}</th>
                <th className="py-3 px-4">{language === "id" ? "Tahap" : "Stage"}</th>
                <th className="py-3 px-4">{language === "id" ? "Umur / Durasi" : "Aging"}</th>
                <th className="py-3 px-4">{t("p2c.summary.work_performed", "Work Value")}</th>
                <th className="py-3 px-4">{language === "id" ? "Pengajuan Klaim" : "Claimed"}</th>
                <th className="py-3 px-4">{t("p2c.summary.certified", "Certified")}</th>
                <th className="py-3 px-4">{t("p2c.summary.collected", "Collected")}</th>
                <th className="py-3 px-4">{t("inv.outstanding", "Outstanding")}</th>
                <th className="py-3 px-4">{language === "id" ? "Kendala (Blocker)" : "Blocker"}</th>
                <th className="py-3 px-4">{language === "id" ? "Penanggung Jawab" : "Owner"}</th>
                <th className="py-3 px-4">{language === "id" ? "Tingkat Risiko" : "Risk"}</th>
                <th className="py-3 px-4 text-right">{t("p2c.inspect", "Inspect")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClaims.map((clm) => {
                const project = coveStore.projects.find((p) => p.id === clm.projectId);
                const owner = coveStore.profiles.find((p) => p.id === clm.responsibleOwnerId);
                const blockers = coveStore.blockers.filter((b) => b.entityId === clm.id && b.status !== "resolved");
                const aging = getDaysDiff(clm.currentStageEnteredAt);
                const outstanding = Math.max(0, clm.claimedValue - clm.cashReceivedValue);

                return (
                  <tr
                    key={clm.id}
                    onClick={() => setSelectedClaimId(clm.id)}
                    className="hover:bg-slate-50/90 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 font-mono text-sm">{clm.claimNumber}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[180px] mt-0.5">
                        {project?.projectName || "-"}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 font-mono">
                      {clm.periodStart.substring(5)} s/d {clm.periodEnd.substring(5)}
                    </td>

                    <td className="py-3.5 px-4">
                      <StageBadge stage={clm.currentStage} size="sm" showOrder />
                    </td>

                    <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                      {aging} {language === "id" ? "hari" : "d"}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                      {formatIDR(clm.workPerformedValue)}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                      {formatIDR(clm.claimedValue)}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                      {formatIDR(clm.certifiedValue)}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {formatIDR(clm.cashReceivedValue)}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-amber-700">
                      {formatIDR(outstanding)}
                    </td>

                    <td className="py-3.5 px-4 max-w-[150px]">
                      {blockers.length > 0 ? (
                        <div className="flex items-center gap-1 text-red-700 font-semibold truncate" title={blockers[0].title}>
                          <AlertTriangle className="h-3 w-3 shrink-0 text-red-600" />
                          <span className="truncate">{blockers[0].title}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      <span className="truncate block max-w-[100px]">{owner?.fullName || "Dimas"}</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <RiskBadge level={clm.riskLevel} size="sm" />
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Button variant="outline" size="sm" className="h-7 text-xs px-2.5 font-semibold gap-1">
                        <span>{language === "id" ? "Periksa" : "Inspect"}</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CreateClaimModal open={showCreateModal} onOpenChange={setShowCreateModal} />

      <ClaimDetailDrawer
        claimId={selectedClaimId}
        onClose={() => setSelectedClaimId(null)}
      />
    </div>
  );
}
