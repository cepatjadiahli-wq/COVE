"use client";

import React, { useState } from "react";
import { formatIDR } from "@/lib/utils";
import { coveStore } from "@/domains/store/persistent-store";
import { Button } from "@/components/ui/button";
import {
  generateRoiLedger,
  getCertifiedNotInvoicedQueue,
  calculateStageMedianDurations,
  calculateFinancingBenefit,
  generatePilotComparison,
} from "@/domains/portfolio/service";
import {
  Layers,
  FileCheck,
  TrendingDown,
  Calculator,
  Download,
  AlertCircle,
  Clock,
  ShieldCheck,
  Building2,
  ArrowUpRight,
} from "lucide-react";

export function PortfolioRoiLedgerSection() {
  const [costOfCapitalRate, setCostOfCapitalRate] = useState<number>(0.11); // 11% default
  const [acceleratedDays, setAcceleratedDays] = useState<number>(14);
  const [acceleratedValueInput, setAcceleratedValueInput] = useState<number>(650000000);

  const claims = coveStore.claims;
  const actions = coveStore.actions;
  const invoices = coveStore.invoices;
  const projects = coveStore.projects;
  const cashReceipts = coveStore.invoices.map((i) => ({ amount: i.cashReceivedAmount }));

  // PRT-007 & UAT-16: 5-Column ROI Ledger
  const roiEntries = generateRoiLedger(claims, actions, invoices, cashReceipts);

  // PRT-005: Certified-Not-Invoiced Handoff Queue
  const handoffQueue = getCertifiedNotInvoicedQueue(claims, projects);

  // PRT-008: Median Stage Duration
  const stageEvents = [
    { fromStage: "S1", toStage: "S2", durationDays: 5 },
    { fromStage: "S1", toStage: "S2", durationDays: 7 },
    { fromStage: "S1", toStage: "S2", durationDays: 6 },
    { fromStage: "S2", toStage: "S3", durationDays: 12 },
    { fromStage: "S2", toStage: "S3", durationDays: 14 },
    { fromStage: "S2", toStage: "S3", durationDays: 10 },
    { fromStage: "S3", toStage: "S4", durationDays: 8 },
    { fromStage: "S3", toStage: "S4", durationDays: 9 },
    { fromStage: "S3", toStage: "S4", durationDays: 11 },
  ];
  const medianDurations = calculateStageMedianDurations(stageEvents);

  // PRT-010: Financing Benefit
  const financingBenefit = calculateFinancingBenefit(
    acceleratedValueInput,
    acceleratedDays,
    costOfCapitalRate
  );

  // PRT-013: Pilot Comparison
  const baselineData = { preInvoiceExposure: 3200000000, cycleDays: 48, disputedValue: 450000000 };
  const currentPilotData = { preInvoiceExposure: 1100000000, cycleDays: 32, disputedValue: 0 };
  const pilotComparisons = generatePilotComparison(baselineData, currentPilotData);

  // PRT-011: Export Weekly Review Pack
  const handleExportWeeklyPack = () => {
    const csvRows = [
      "COVE PORTFOLIO & ROI LEDGER WEEKLY REVIEW PACK",
      `Export Timestamp: ${new Date().toISOString()}`,
      "",
      "1. 5-COLUMN ROI LEDGER (PRT-007)",
      "Category,Amount,Attribution Level,Definition,Source",
      ...roiEntries.map(
        (r) => `"${r.title}",${r.amount},"${r.attributionLevel}","${r.definition}","${r.sourceReference}"`
      ),
      "",
      "2. CERTIFIED-NOT-INVOICED HANDOFF QUEUE (PRT-005)",
      "ClaimNumber,Project,Client,CertifiedValue,CertifiedDate,DaysPending,Status",
      ...handoffQueue.map(
        (h) => `"${h.claimNumber}","${h.projectName}","${h.clientName}",${h.certifiedValue},"${h.certifiedDate}",${h.daysPendingInvoice},"${h.status}"`
      ),
      "",
      "3. PILOT BEFORE/AFTER COMPARISON (PRT-013)",
      "Metric,Baseline,CurrentPilot,Delta,AttributionNote",
      ...pilotComparisons.map(
        (p) => `"${p.metricName}","${p.baselineValue}","${p.currentPilotValue}","${p.deltaDisplay}","${p.attributionNote}"`
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `COVE_Weekly_Review_Pack_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Modul 5 — Portfolio Cash Review & ROI Ledger
            </h2>
            <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
              PRT-001 s/d PRT-013 • UAT-14 • UAT-15 • UAT-16
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Pemeriksaan portofolio komprehensif untuk direksi yang memisahkan eksposur terkendali dari faktor eksternal dan membuktikan pergerakan nilai riil
          </p>
        </div>
        <Button
          onClick={handleExportWeeklyPack}
          size="sm"
          className="bg-slate-900 hover:bg-slate-800 text-white text-xs gap-1.5 font-semibold"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Ekspor Weekly Review Pack (PRT-011)</span>
        </Button>
      </div>

      {/* 1. PRT-007 & UAT-16: 5-Column Comparative ROI Ledger */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              1. ROI Ledger Rekapitulasi Nilai 5 Kolom (PRT-007, UAT-16)
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Pemisahan mutlak antara kebocoran terdeteksi, eksposur terkendali, tindakan tuntas berbukti sah, faktur resmi, dan kas cair ke rekening
            </p>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Atribusi: Level A vs Level B (PRD 17.6)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {roiEntries.map((item, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                item.category === "RESOLVED_LEVEL_A"
                  ? "bg-indigo-50/50 border-indigo-200"
                  : item.category === "COLLECTED"
                  ? "bg-emerald-50/50 border-emerald-200"
                  : "bg-slate-50/80 border-slate-200"
              }`}
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Kolom {idx + 1}
                </span>
                <h4 className="text-xs font-bold text-slate-900 mt-1 leading-snug">
                  {item.title}
                </h4>
                <div className="mt-2.5">
                  <span className="text-base font-black text-slate-900 font-mono block">
                    {formatIDR(item.amount)}
                  </span>
                  <span
                    className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                      item.attributionLevel.includes("Level A")
                        ? "bg-indigo-100 text-indigo-800 border-indigo-200"
                        : item.attributionLevel.includes("Level B")
                        ? "bg-amber-100 text-amber-800 border-amber-200"
                        : "bg-emerald-100 text-emerald-800 border-emerald-200"
                    }`}
                  >
                    {item.attributionLevel}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200/60 text-[10px] text-slate-500 space-y-1">
                <p>{item.definition}</p>
                <p className="font-mono text-slate-400">Sumber: {item.sourceReference}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid: Certified-not-invoiced Handoff & Stage Median Duration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 2. PRT-005: Certified-not-invoiced Handoff Queue for Finance */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  2. Antrean Serah-Terima Finance (PRT-005)
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Klaim bersertifikat sah (BAP) menunggu penerbitan faktur pajak & penagihan
              </p>
            </div>
            <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
              {handoffQueue.length} Berkas Siap
            </span>
          </div>

          {handoffQueue.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Tidak ada antrean BAP yang menunggu penerbitan faktur.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-bold uppercase text-slate-400">
                    <th className="pb-2">Klaim / Proyek</th>
                    <th className="pb-2">Klien</th>
                    <th className="pb-2">Nilai BAP</th>
                    <th className="pb-2">Menunggu</th>
                    <th className="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {handoffQueue.map((item) => (
                    <tr key={item.claimId} className="hover:bg-slate-50/80">
                      <td className="py-2.5 pr-2">
                        <span className="font-bold text-slate-900 block">{item.claimNumber}</span>
                        <span className="text-[11px] text-slate-500">{item.projectName}</span>
                      </td>
                      <td className="py-2.5 pr-2 text-slate-700">{item.clientName}</td>
                      <td className="py-2.5 pr-2 font-mono font-bold text-emerald-700">
                        {formatIDR(item.certifiedValue)}
                      </td>
                      <td className="py-2.5 pr-2 font-mono text-slate-600">
                        {item.daysPendingInvoice} hari
                      </td>
                      <td className="py-2.5 text-right">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            item.status === "OVERDUE_INVOICE"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {item.status === "OVERDUE_INVOICE" ? "Overdue >7h" : "Siap Faktur"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 3. PRT-008: Median Stage Duration */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  3. Median Durasi per Tahapan Klaim (PRT-008)
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Dihitung hanya bila sampel event memadai (min. 3 transisi); kosong jika tidak cukup
              </p>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Sample Size Terlihat</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold uppercase text-slate-400">
                  <th className="pb-2">Tahapan Klaim</th>
                  <th className="pb-2 text-center">Sampel Event</th>
                  <th className="pb-2 text-right">Median Durasi</th>
                  <th className="pb-2 text-right">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {medianDurations.map((m) => (
                  <tr key={m.stage} className="hover:bg-slate-50/80">
                    <td className="py-2.5 pr-2">
                      <span className="font-bold text-slate-900">{m.stage}:</span> {m.stageName}
                    </td>
                    <td className="py-2.5 text-center font-mono text-slate-600">
                      {m.sampleSize} event
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                      {m.hasSufficientData ? `${m.medianDurationDays} hari` : "-"}
                    </td>
                    <td className="py-2.5 text-right">
                      {m.hasSufficientData ? (
                        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          Valid
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          Data Belum Cukup
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Grid: Financing Cost Benefit & Pilot Before/After */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 4. PRT-010: Financing Cost Benefit */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  4. Kalkulasi Manfaat Bunga Pembiayaan (PRT-010)
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Estimasi penghematan bunga modal kontraktor dengan percepatan penagihan kas
              </p>
            </div>
            <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
              Berlabel Asumsi
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Cost of Capital (% p.a.)
              </label>
              <input
                type="number"
                step="0.1"
                value={(costOfCapitalRate * 100).toFixed(1)}
                onChange={(e) => setCostOfCapitalRate(Number(e.target.value) / 100)}
                className="w-full p-2 border border-slate-200 rounded font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Nilai Dipercepat (IDR)
              </label>
              <input
                type="number"
                value={acceleratedValueInput}
                onChange={(e) => setAcceleratedValueInput(Number(e.target.value))}
                className="w-full p-2 border border-slate-200 rounded font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Hari Lebih Cepat
              </label>
              <input
                type="number"
                value={acceleratedDays}
                onChange={(e) => setAcceleratedDays(Number(e.target.value))}
                className="w-full p-2 border border-slate-200 rounded font-mono text-xs"
              />
            </div>
          </div>

          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-lg">
            <span className="text-[11px] text-emerald-800 font-semibold block">
              Estimasi Penghematan Bunga Modal:
            </span>
            <span className="text-xl font-black text-emerald-900 font-mono block mt-0.5">
              {formatIDR(financingBenefit.financingInterestSaved)}
            </span>
            <p className="text-[11px] text-emerald-700 font-mono mt-1">
              {financingBenefit.formula}
            </p>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-500">
            <AlertCircle className="h-3.5 w-3.5 text-slate-400 inline mr-1" />
            {financingBenefit.assumptionDisclaimer}
          </div>
        </div>

        {/* 5. PRT-013: Final Pilot Before/After Snapshot Comparison */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  5. Evaluasi Snapshot Pilot: Before vs After (PRT-013)
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Perbandingan baseline intake kontraktor terhadap hasil pencapaian pilot terkini
              </p>
            </div>
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
              Pilot Grand Meridian
            </span>
          </div>

          <div className="space-y-2.5">
            {pilotComparisons.map((c, idx) => (
              <div key={idx} className="p-3 bg-slate-50/80 border border-slate-200 rounded-lg space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">{c.metricName}</span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                      c.isImprovement ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {c.deltaDisplay}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Baseline: {c.baselineValue}</span>
                  <span className="font-semibold text-slate-700">Capaian Saat Ini: {c.currentPilotValue}</span>
                </div>
                <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-200/50">
                  <strong>Atribusi:</strong> {c.attributionNote}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
