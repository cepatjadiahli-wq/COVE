"use client";

import React from "react";
import { formatIDR } from "@/lib/utils";
import { MoneyPipelineSummary } from "@/domains/store/persistent-store";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface MoneyPipelineProps {
  pipeline: MoneyPipelineSummary;
  projectName?: string;
}

export function MoneyPipeline({ pipeline, projectName }: MoneyPipelineProps) {
  const { t, language } = useLanguage();

  const stages = [
    { key: "work", label: language === "id" ? "Pekerjaan Fisik" : "Work Performed", value: pipeline.workPerformed, color: "border-slate-800 bg-slate-900 text-white" },
    { key: "measured", label: language === "id" ? "Opname Terukur" : "Measured (Opname)", value: pipeline.measured, color: "border-blue-700 bg-blue-50 text-blue-900" },
    { key: "claimed", label: language === "id" ? "Pengajuan Klaim" : "Claimed (MC)", value: pipeline.claimed, color: "border-indigo-700 bg-indigo-50 text-indigo-900" },
    { key: "certified", label: language === "id" ? "Disertifikasi BAP" : "Certified (BAP)", value: pipeline.certified, color: "border-emerald-700 bg-emerald-50 text-emerald-900" },
    { key: "invoiced", label: language === "id" ? "Faktur Diterbitkan" : "Invoiced Gross", value: pipeline.invoiced, color: "border-teal-700 bg-teal-50 text-teal-900" },
    { key: "collected", label: language === "id" ? "Kas Diterima Bank" : "Cash Collected", value: pipeline.collected, color: "border-green-700 bg-green-50 text-green-950 font-bold" },
  ];

  const gaps = [
    { label: language === "id" ? "Belum Opname" : "Unmeasured", value: pipeline.unmeasuredGap, desc: language === "id" ? "Pekerjaan belum di-opname" : "Work not yet measured" },
    { label: language === "id" ? "Belum Diajukan" : "Unclaimed", value: pipeline.unclaimedGap, desc: language === "id" ? "Opname belum diajukan klaim" : "Measured not yet claimed" },
    { label: language === "id" ? "Belum BAP" : "Uncertified", value: pipeline.uncertifiedGap, desc: language === "id" ? "Klaim belum disahkan MK" : "Claim pending consultant approval" },
    { label: language === "id" ? "Belum Difakturkan" : "Not Invoiced", value: pipeline.certifiedNotInvoicedGap, desc: language === "id" ? "BAP belum diterbitkan faktur" : "BAP ready not invoiced" },
    { label: language === "id" ? "Sisa Piutang" : "Outstanding", value: pipeline.invoicedNotCollectedGap, desc: language === "id" ? "Faktur belum cair ke bank" : "Invoiced not collected" },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-6 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">{language === "id" ? "Alur Money Pipeline Proyek" : "Money Pipeline Flow"}</h3>
            {projectName && (
              <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded border border-slate-200">
                {projectName}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {language === "id" 
              ? "Perjalanan nilai ekonomi dari pekerjaan fisik hingga kas cair di rekening bank" 
              : "17-stage economic value journey from site work to cash received in bank"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
          <span>{language === "id" ? "Total Eksposur Tertahan:" : "Total Open Exposure:"}</span>
          <span className="font-bold text-slate-900 font-mono">
            {formatIDR(pipeline.workPerformed - pipeline.collected)}
          </span>
        </div>
      </div>

      {/* Pipeline Flow Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-3 relative">
        {stages.map((stage, idx) => (
          <div key={stage.key} className="flex flex-col">
            <div
              className={`p-3.5 rounded-lg border-2 flex flex-col justify-between min-h-[96px] shadow-2xs transition-all ${
                stage.key === "work"
                  ? "bg-slate-900 text-white border-slate-900"
                  : stage.key === "collected"
                  ? "bg-emerald-50 border-emerald-600 text-slate-900"
                  : "bg-slate-50/90 border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    stage.key === "work" ? "text-slate-300" : "text-slate-500"
                  }`}
                >
                  {stage.label}
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    stage.key === "work" ? "bg-slate-800 text-slate-200" : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  0{idx + 1}
                </span>
              </div>
              <div className="mt-2">
                <div
                  className={`text-sm sm:text-base font-extrabold font-mono tracking-tight ${
                    stage.key === "work"
                      ? "text-white"
                      : stage.key === "collected"
                      ? "text-emerald-700"
                      : "text-slate-900"
                  }`}
                >
                  {formatIDR(stage.value)}
                </div>
              </div>
            </div>

            {/* Gap Arrow to Next Stage */}
            {idx < 5 && (
              <div className="mt-2 p-2 rounded-md bg-amber-50/70 border border-amber-200/80 flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[10px] font-bold text-amber-900">
                  <span>{gaps[idx].label} Gap</span>
                  <span className="font-mono">{formatIDR(gaps[idx].value, { showZero: true })}</span>
                </div>
                <span className="text-[9px] text-amber-700 truncate" title={gaps[idx].desc}>
                  {gaps[idx].desc}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
