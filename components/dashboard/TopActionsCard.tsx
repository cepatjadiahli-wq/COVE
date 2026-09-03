"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatIDR } from "@/lib/utils";
import { CheckCircle2, ArrowRight, Clock, AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getTopBlockers } from "@/domains/portfolio/service";

export function TopActionsCard() {
  const { refreshState } = useTenant();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<"actions" | "blockers">("actions");
  const [resolvingActionId, setResolvingActionId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");
  const [outcomeType, setOutcomeType] = useState("cash_released");
  const [outcomeValue, setOutcomeValue] = useState<number>(0);

  const actions = coveStore.actions
    .filter((a) => a.status !== "resolved")
    .sort((a, b) => {
      const pOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0);
    })
    .slice(0, 5);

  // PRT-004: Top Blockers by value and age
  const topBlockers = getTopBlockers(coveStore.blockers, coveStore.actions, new Date().toISOString().substring(0, 10), 5);

  const handleResolve = (actionId: string) => {
    try {
      coveStore.resolveAction(
        actionId,
        resolutionText || "Action completed by user",
        outcomeType as any,
        outcomeValue,
        "https://drive.google.com/cove-evidence/resolution.pdf"
      );
      setResolvingActionId(null);
      setResolutionText("");
      refreshState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-slate-900">
              {activeTab === "actions"
                ? t("dash.attention.open_actions", "Tindakan Teratas Membutuhkan Perhatian")
                : "Top Kendala Menurut Nilai & Umur (PRT-004)"}
            </h3>
            <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
              PRT-004
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeTab === "actions"
              ? "Tindakan berprioritas tinggi untuk membuka nilai proyek yang tertahan hari ini"
              : "Hambatan kritis diurutkan berdasarkan eksposur finansial terbesar dan durasi terbuka (dapat membuka tindakan terkait)"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Switcher */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setActiveTab("actions")}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                activeTab === "actions"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tindakan ({actions.length})
            </button>
            <button
              onClick={() => setActiveTab("blockers")}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                activeTab === "blockers"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Top Blocker ({topBlockers.length})
            </button>
          </div>

          <Link href="/actions">
            <Button variant="ghost" size="sm" className="text-xs text-slate-700 hover:text-slate-900 gap-1">
              <span>Semua</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Tab Content: Actions */}
      {activeTab === "actions" && (
        <>
          {actions.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Tidak ada tindakan terbuka yang membutuhkan eskalasi saat ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="pb-3">Prioritas</th>
                    <th className="pb-3">Tindakan & Isu</th>
                    <th className="pb-3">Proyek</th>
                    <th className="pb-3">{t("act.exposure", "Eksposur Finansial")}</th>
                    <th className="pb-3">{t("act.assignee", "PIC")}</th>
                    <th className="pb-3">{t("act.due_date", "Jatuh Tempo")}</th>
                    <th className="pb-3 text-right">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {actions.map((act) => {
                    const project = coveStore.projects.find((p) => p.id === act.projectId);
                    const owner = coveStore.profiles.find((p) => p.id === act.ownerId);

                    const priorityBadge = {
                      critical: "bg-red-50 text-red-700 border-red-200",
                      high: "bg-orange-50 text-orange-700 border-orange-200",
                      medium: "bg-amber-50 text-amber-700 border-amber-200",
                      low: "bg-slate-50 text-slate-600 border-slate-200",
                    }[act.priority];

                    return (
                      <tr key={act.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 pr-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${priorityBadge}`}>
                            {act.priority}
                          </span>
                        </td>
                        <td className="py-3.5 pr-3 max-w-[280px]">
                          <div className="font-bold text-slate-900 leading-snug">{act.title}</div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">{act.description}</div>
                        </td>
                        <td className="py-3.5 pr-3 text-slate-700 font-medium">
                          {project?.projectName || "-"}
                        </td>
                        <td className="py-3.5 pr-3 font-mono font-bold text-slate-900">
                          {formatIDR(act.financialExposure)}
                        </td>
                        <td className="py-3.5 pr-3 text-slate-700">
                          <span className="font-semibold">{act.ownerName || owner?.fullName || "Unassigned"}</span>
                        </td>
                        <td className="py-3.5 pr-3">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span>{act.dueDate}</span>
                          </span>
                        </td>
                        <td className="py-3.5 text-right">
                          <Link href="/actions">
                            <Button variant="outline" size="sm" className="h-7 text-xs px-2.5">
                              Kelola
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Tab Content: Top Blockers (PRT-004) */}
      {activeTab === "blockers" && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="pb-3">Kendala / Blocker</th>
                <th className="pb-3">Proyek</th>
                <th className="pb-3">Eksposur Finansial</th>
                <th className="pb-3">Umur Blocker</th>
                <th className="pb-3">Tingkat Keparahan</th>
                <th className="pb-3 text-right">Tindakan Terkait (PRT-004)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topBlockers.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 pr-3 max-w-[280px]">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span>{b.title}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 capitalize block mt-0.5">
                      Kendali: {b.controllability}
                    </span>
                  </td>
                  <td className="py-3.5 pr-3 text-slate-700 font-medium">
                    {b.projectName}
                  </td>
                  <td className="py-3.5 pr-3 font-mono font-bold text-rose-700">
                    {formatIDR(b.financialExposure)}
                  </td>
                  <td className="py-3.5 pr-3 font-mono text-slate-700 font-semibold">
                    {b.daysOpen} hari
                  </td>
                  <td className="py-3.5 pr-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        b.severity === "critical"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : b.severity === "high"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {b.severity}
                    </span>
                  </td>
                  <td className="py-3.5 text-right">
                    <Link href="/actions">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2.5 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                      >
                        <span>Buka Action</span>
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
