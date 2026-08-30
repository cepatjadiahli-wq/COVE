"use client";

import React from "react";
import { CScoreResult } from "@/lib/finance/c-score";
import { Button } from "@/components/ui/button";
import { ShieldCheck, TrendingUp, AlertCircle, ArrowUpRight, Activity } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface CScoreCardProps {
  cScore: CScoreResult;
  onOpenSimulator: () => void;
}

export function CScoreCard({ cScore, onOpenSimulator }: CScoreCardProps) {
  const { language } = useLanguage();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Activity className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {language === "id" ? "Indeks Kesehatan Finansial (C-Score)" : "Contractor Health C-Score"}
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">
              {language === "id" ? "Evaluasi Likuiditas & Kepatuhan Siklus Kas" : "Liquidity & Cash Cycle Compliance"}
            </span>
          </div>
        </div>

        <Button
          onClick={onOpenSimulator}
          variant="outline"
          size="sm"
          className="text-xs font-semibold h-7 text-blue-800 border-blue-200 bg-blue-50 hover:bg-blue-100 gap-1"
        >
          <TrendingUp className="h-3.5 w-3.5" />
          <span>{language === "id" ? "Simulasi Kas 30-90 Hari" : "Stress-Test Simulator"}</span>
        </Button>
      </div>

      {/* Main Metric Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* Big Score Gauge */}
        <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="relative flex items-center justify-center h-16 w-16 rounded-full bg-slate-900 text-white font-black text-2xl shadow-inner font-mono">
            {cScore.overallScore}
            <span className="absolute -top-1 -right-1 text-[10px] font-bold bg-emerald-500 text-slate-950 px-1 rounded-full">
              {cScore.grade}
            </span>
          </div>

          <div>
            <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded border uppercase ${cScore.gradeColor}`}>
              {cScore.gradeLabel}
            </span>
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
              {language === "id" ? "Kondisi arus kas portofolio terkendali prima." : "Portfolio cash flow resilience is healthy."}
            </p>
          </div>
        </div>

        {/* 4 Pillar Progress Bars */}
        <div className="md:col-span-2 space-y-2 text-xs">
          <div>
            <div className="flex justify-between text-[11px] mb-0.5">
              <span className="text-slate-600 font-medium">1. Speed-to-Cash (Kecepatan Konversi Kas):</span>
              <span className="font-mono font-bold text-slate-900">{cScore.speedToCashScore}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${cScore.speedToCashScore}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-0.5">
              <span className="text-slate-600 font-medium">2. Kepatuhan Batas Waktu SLA MK:</span>
              <span className="font-mono font-bold text-slate-900">{cScore.slaComplianceScore}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${cScore.slaComplianceScore}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-0.5">
              <span className="text-slate-600 font-medium">3. Akurasi Opname & Minim Sengketa BAP:</span>
              <span className="font-mono font-bold text-slate-900">{cScore.uncertifiedGapScore}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-purple-600 rounded-full" style={{ width: `${cScore.uncertifiedGapScore}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-0.5">
              <span className="text-slate-600 font-medium">4. Proteksi Kas Mandor (Pay-When-Paid):</span>
              <span className="font-mono font-bold text-slate-900">{cScore.liquidityProtectionScore}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-teal-600 rounded-full" style={{ width: `${cScore.liquidityProtectionScore}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Strategic Insight Callout */}
      <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-start gap-2 text-xs">
        <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
        <div className="text-emerald-950">
          <strong className="font-bold">Rekomendasi Strategis Direksi: </strong>
          <span>{cScore.strategicAction}</span>
        </div>
      </div>
    </div>
  );
}
