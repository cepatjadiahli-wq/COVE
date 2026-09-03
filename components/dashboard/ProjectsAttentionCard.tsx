"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatIDR } from "@/lib/utils";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { FreshnessBadge } from "@/components/shared/FreshnessBadge";
import { ArrowRight, AlertTriangle, ShieldCheck, Lock, Info, CheckCircle2 } from "lucide-react";
import { coveStore } from "@/domains/store/persistent-store";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useTenant } from "@/components/layout/TenantProvider";
import { calculateProjectRankings, evaluateProjectsFreshness } from "@/domains/portfolio/service";

export function ProjectsAttentionCard() {
  const { refreshState } = useTenant();
  const { t, language } = useLanguage();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [lockReason, setLockReason] = useState("");
  const [baselineExposure, setBaselineExposure] = useState<number>(2500000000);
  const [baselineDays, setBaselineDays] = useState<number>(45);
  const [showBaselineModal, setShowBaselineModal] = useState(false);
  const [successToast, setSuccessToast] = useState("");

  const projects = coveStore.projects;
  const claims = coveStore.claims;
  const actions = coveStore.actions;
  const blockers = coveStore.blockers;

  // PRT-003: Project Rankings based on material exposure formula
  const rankings = calculateProjectRankings(projects, claims, actions, blockers);
  // PRT-006 & UAT-14: Project Data Freshness
  const freshnessList = evaluateProjectsFreshness(projects, claims);

  const handleLockBaseline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    try {
      coveStore.lockProjectBaseline(
        selectedProjectId,
        baselineExposure,
        baselineDays,
        lockReason,
        "Dimas Sucipto (Commercial Manager)"
      );
      setShowBaselineModal(false);
      setLockReason("");
      setSelectedProjectId(null);
      refreshState();
      setSuccessToast("Baseline proyek berhasil dikunci secara permanen (PRT-009, UAT-15).");
      setTimeout(() => setSuccessToast(""), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">
              {t("dash.attention.title", "Peringkat Proyek Menurut Eksposur Material & Kendala")}
            </h3>
            <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
              PRT-002 • PRT-003 • PRT-006
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {t(
              "dash.attention.subtitle",
              "Daftar proyek aktif diurutkan berdasarkan skor eksposur terkendali, overdue, dan bobot kendala (PRD Modul 5)"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="text-xs text-slate-700 hover:text-slate-900 gap-1">
              <span>{language === "id" ? `Semua Proyek (${projects.length})` : `All Projects (${projects.length})`}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Success Banner */}
      {successToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800 font-medium">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Transparent Formula Banner (PRT-003) */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2.5 text-xs text-slate-600">
        <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-900 block">
            Formula Pemeringkatan Transparan (PRT-003):
          </span>
          <p className="text-[11px] text-slate-600 mt-0.5 font-mono">
            Skor = (Controllable Exposure × 0.5) + (Overdue Exposure × 0.3) + (Bobot Severity Blocker × 0.2)
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Eksposur terkendali dipisahkan dari faktor eksternal (PRT-002). Proyek usang (&gt;14 hari) ditandai indikator STALE (PRT-006, UAT-14).
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <th className="pb-3 w-12 text-center">Rank</th>
              <th className="pb-3">{language === "id" ? "Proyek" : "Project"}</th>
              <th className="pb-3">{t("dash.attention.contract_value", "Nilai Kontrak")}</th>
              <th className="pb-3">Controllable Exposure (PRT-002)</th>
              <th className="pb-3">Overdue Exposure</th>
              <th className="pb-3">Data Freshness (PRT-006)</th>
              <th className="pb-3 text-right">Aksi & Baseline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rankings.map((item) => {
              const freshness = freshnessList.find((f) => f.projectId === item.projectId);
              const baselines = coveStore.getProjectBaselines(item.projectId);
              const hasBaseline = baselines.length > 0;

              return (
                <tr key={item.projectId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 pr-2 text-center font-bold">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black ${
                        item.rank === 1
                          ? "bg-rose-100 text-rose-800 border border-rose-200"
                          : item.rank === 2
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      #{item.rank}
                    </span>
                  </td>
                  <td className="py-3.5 pr-3">
                    <Link href={`/projects/${item.projectId}`} className="hover:underline font-bold text-slate-900 block">
                      {item.projectName}
                    </Link>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {item.projectCode} • Skor: {item.rankingScore} pts
                    </span>
                  </td>
                  <td className="py-3.5 pr-3 font-mono font-semibold text-slate-700">
                    {formatIDR(item.contractValue)}
                  </td>
                  <td className="py-3.5 pr-3 font-mono font-bold text-amber-700">
                    {item.controllableExposure > 0 ? formatIDR(item.controllableExposure) : "Rp 0"}
                  </td>
                  <td className="py-3.5 pr-3 font-mono font-bold text-rose-700">
                    {item.overdueExposure > 0 ? formatIDR(item.overdueExposure) : "Rp 0"}
                  </td>
                  <td className="py-3.5 pr-3">
                    <FreshnessBadge
                      freshness={freshness?.freshnessStatus || "CURRENT"}
                      sourceLabel={`${freshness?.daysSinceUpdate ?? 0}h lalu`}
                    />
                  </td>
                  <td className="py-3.5 text-right space-x-1.5 whitespace-nowrap">
                    {hasBaseline ? (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded"
                        title={`Terkunci oleh ${baselines[0].lockedByName}: ${baselines[0].lockReason}`}
                      >
                        <Lock className="h-3 w-3" />
                        <span>Terkunci</span>
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProjectId(item.projectId);
                          setBaselineExposure(item.controllableExposure || 2500000000);
                          setShowBaselineModal(true);
                        }}
                        className="h-7 text-xs px-2 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                      >
                        <Lock className="h-3 w-3 mr-1" />
                        <span>Kunci Baseline</span>
                      </Button>
                    )}
                    <Link href={`/projects/${item.projectId}`}>
                      <Button variant="outline" size="sm" className="h-7 text-xs px-2.5">
                        {language === "id" ? "Detail" : "Detail"}
                      </Button>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Lock Baseline Modal (PRT-009, UAT-15) */}
      {showBaselineModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-indigo-600" />
                <h4 className="font-bold text-slate-900 text-sm">
                  Penguncian Baseline Proyek (PRT-009)
                </h4>
              </div>
              <button
                onClick={() => setShowBaselineModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLockBaseline} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Proyek Terpilih
                </label>
                <input
                  type="text"
                  disabled
                  value={projects.find((p) => p.id === selectedProjectId)?.projectName || ""}
                  className="w-full text-xs p-2 bg-slate-100 border border-slate-200 rounded font-semibold text-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nilai Baseline Eksposur Awal (IDR)
                </label>
                <input
                  type="number"
                  required
                  value={baselineExposure}
                  onChange={(e) => setBaselineExposure(Number(e.target.value))}
                  className="w-full text-xs p-2 border border-slate-200 rounded font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Baseline Siklus Hari Progress-to-Invoice
                </label>
                <input
                  type="number"
                  required
                  value={baselineDays}
                  onChange={(e) => setBaselineDays(Number(e.target.value))}
                  className="w-full text-xs p-2 border border-slate-200 rounded font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alasan Penguncian Baseline (Wajib Min 5 Karakter)
                </label>
                <textarea
                  required
                  minLength={5}
                  value={lockReason}
                  onChange={(e) => setLockReason(e.target.value)}
                  placeholder="Misal: Kesepakatan awal komite proyek sebelum kick-off sprint implementasi COVE..."
                  className="w-full text-xs p-2 border border-slate-200 rounded h-20"
                />
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">
                <strong>Ketentuan PRT-009 & UAT-15:</strong> Baseline yang dikunci bersifat permanen dan tidak akan tertimpa oleh batch import data baru berikutnya.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBaselineModal(false)}
                  className="text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                >
                  Kunci Baseline Permanen
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
