"use client";

import React from "react";
import Link from "next/link";
import { formatIDR } from "@/lib/utils";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { coveStore } from "@/domains/store/persistent-store";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function ProjectsAttentionCard() {
  const { t, language } = useLanguage();
  const projectsAttention = coveStore.getProjectsAttentionList();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">{t("dash.attention.title", "Proyek yang Membutuhkan Perhatian Manajemen")}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {t("dash.attention.subtitle", "Daftar proyek aktif yang memiliki risiko finansial dan kendala operasional")}
          </p>
        </div>
        <Link href="/projects">
          <Button variant="ghost" size="sm" className="text-xs text-slate-700 hover:text-slate-900 gap-1">
            <span>{language === "id" ? `Semua Proyek (${coveStore.projects.length})` : `All Projects (${coveStore.projects.length})`}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <th className="pb-3">{language === "id" ? "Proyek" : "Project"}</th>
              <th className="pb-3">{t("dash.attention.contract_value", "Nilai Kontrak")}</th>
              <th className="pb-3">{t("dash.kpi.cash_at_risk", "Cash-at-Risk")}</th>
              <th className="pb-3">{t("dash.attention.largest_blocker", "Kendala Terbesar")}</th>
              <th className="pb-3">{t("dash.attention.open_actions", "Tindakan Terbuka")}</th>
              <th className="pb-3">{t("dash.attention.status", "Tingkat Risiko")}</th>
              <th className="pb-3 text-right">{language === "id" ? "Rincian" : "View Detail"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projectsAttention.map((item) => (
              <tr key={item.project.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-3.5 pr-3">
                  <Link href={`/projects/${item.project.id}`} className="hover:underline font-bold text-slate-900 block">
                    {item.project.projectName}
                  </Link>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {item.project.projectCode} • {item.project.city}
                  </span>
                </td>
                <td className="py-3.5 pr-3 font-mono font-semibold text-slate-700">
                  {formatIDR(item.contractValue)}
                </td>
                <td className="py-3.5 pr-3 font-mono font-bold text-red-700">
                  {item.cashAtRisk > 0 ? formatIDR(item.cashAtRisk) : "Rp 0"}
                </td>
                <td className="py-3.5 pr-3 max-w-[200px]">
                  {item.largestBlocker !== "-" ? (
                    <div className="flex items-center gap-1.5 text-amber-900 font-medium text-[11px]">
                      <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                      <span className="truncate" title={item.largestBlocker}>
                        {item.largestBlocker}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="py-3.5 pr-3 font-semibold text-slate-900">
                  {item.openActionsCount > 0 ? (
                    <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                      {item.openActionsCount} {language === "id" ? "tindakan" : "action"}
                    </span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </td>
                <td className="py-3.5 pr-3">
                  <RiskBadge level={item.riskLevel} size="sm" />
                </td>
                <td className="py-3.5 text-right">
                  <Link href={`/projects/${item.project.id}`}>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2.5">
                      {language === "id" ? "Ringkasan" : "Overview"}
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
