"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatIDR } from "@/lib/utils";
import { CheckCircle2, ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function TopActionsCard() {
  const { refreshState } = useTenant();
  const { t, language } = useLanguage();
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

  const handleResolve = (actionId: string) => {
    try {
      coveStore.resolveAction(actionId, resolutionText || "Action completed by user", outcomeType as any, outcomeValue);
      setResolvingActionId(null);
      setResolutionText("");
      refreshState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">{t("dash.attention.open_actions", "Tindakan Teratas Membutuhkan Perhatian")}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {language === "id" 
              ? "Tindakan berprioritas tinggi untuk membuka nilai proyek yang tertahan hari ini" 
              : "High-priority economic actions to unblock project value today"}
          </p>
        </div>
        <Link href="/actions">
          <Button variant="ghost" size="sm" className="text-xs text-slate-700 hover:text-slate-900 gap-1">
            <span>{language === "id" ? `Lihat Semua (${coveStore.actions.length})` : `View All (${coveStore.actions.length})`}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {actions.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          {language === "id" ? "Tidak ada tindakan terbuka yang membutuhkan eskalasi saat ini." : "No open actions requiring escalation."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="pb-3">{language === "id" ? "Prioritas" : "Priority"}</th>
                <th className="pb-3">{language === "id" ? "Tindakan & Isu" : "Action & Issue"}</th>
                <th className="pb-3">{language === "id" ? "Proyek" : "Project"}</th>
                <th className="pb-3">{t("act.exposure", "Eksposur Finansial")}</th>
                <th className="pb-3">{t("act.assignee", "PIC")}</th>
                <th className="pb-3">{t("act.due_date", "Jatuh Tempo")}</th>
                <th className="pb-3 text-right">{language === "id" ? "Aksi Cepat" : "Quick Action"}</th>
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

                const priorityLabel = {
                  critical: language === "id" ? "KRITIS" : "CRITICAL",
                  high: language === "id" ? "TINGGI" : "HIGH",
                  medium: language === "id" ? "SEDANG" : "MEDIUM",
                  low: language === "id" ? "RENDAH" : "LOW",
                }[act.priority];

                return (
                  <tr key={act.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 pr-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${priorityBadge}`}>
                        {priorityLabel}
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
                      <span className="font-semibold">{owner?.fullName || "Unassigned"}</span>
                    </td>
                    <td className="py-3.5 pr-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span>{act.dueDate}</span>
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      {resolvingActionId === act.id ? (
                        <div className="flex flex-col gap-2 p-2 bg-slate-100 rounded border border-slate-200 text-left">
                          <input
                            type="text"
                            placeholder={language === "id" ? "Catatan resolusi..." : "Resolution notes..."}
                            value={resolutionText}
                            onChange={(e) => setResolutionText(e.target.value)}
                            className="p-1 text-xs border rounded bg-white text-slate-900"
                          />
                          <select
                            value={outcomeType}
                            onChange={(e) => setOutcomeType(e.target.value)}
                            className="p-1 text-xs border rounded bg-white text-slate-900"
                          >
                            <option value="cash_released">{language === "id" ? "Kas Cair (Cash Released)" : "Cash Released"}</option>
                            <option value="exposure_reduced">{language === "id" ? "Risiko Berkurang (Exposure Reduced)" : "Exposure Reduced"}</option>
                            <option value="claim_recovered">{language === "id" ? "Klaim Dipulihkan (Claim Recovered)" : "Claim Recovered"}</option>
                            <option value="margin_protected">{language === "id" ? "Margin Terlindungi (Margin Protected)" : "Margin Protected"}</option>
                          </select>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setResolvingActionId(null)}
                              className="px-2 py-0.5 text-[10px] text-slate-600"
                            >
                              {t("common.cancel", "Batal")}
                            </button>
                            <button
                              onClick={() => handleResolve(act.id)}
                              className="px-2 py-0.5 text-[10px] bg-emerald-700 text-white font-bold rounded"
                            >
                              {t("common.confirm", "Konfirmasi")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          onClick={() => {
                            setResolvingActionId(act.id);
                            setOutcomeValue(act.financialExposure);
                          }}
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs text-emerald-800 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 font-semibold gap-1"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>{t("act.resolve_button", "Selesaikan")}</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
