"use client";

import React, { useState } from "react";
import { formatIDR, getDaysDiff } from "@/lib/utils";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Download } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function ReportsPage() {
  const { currentOrg } = useTenant();
  const { t, language } = useLanguage();
  const [selectedReport, setSelectedReport] = useState("cash_at_risk");
  const [projectFilter, setProjectFilter] = useState("all");

  const reportsList = [
    { id: "cash_at_risk", name: language === "id" ? "1. Laporan Cash-at-Risk" : "1. Cash-at-Risk Report", desc: language === "id" ? "Daftar eksposur nilai proyek yang tertahan blocker dan SLA breach" : "Project value exposure stalled by blockers and SLA delays" },
    { id: "claim_aging", name: language === "id" ? "2. Laporan Umur Klaim" : "2. Claim Aging Report", desc: language === "id" ? "Analisis umur klaim dari pengajuan hingga sertifikasi" : "Claim aging analysis from submission to certification" },
    { id: "certification_aging", name: language === "id" ? "3. Laporan Umur Sertifikasi" : "3. Certification Aging Report", desc: language === "id" ? "Durasi persetujuan konsultan / MK per klaim" : "Consultant approval duration per claim" },
    { id: "invoice_aging", name: language === "id" ? "4. Laporan Umur Faktur" : "4. Invoice Aging Report", desc: language === "id" ? "Analisis penerbitan faktur dari sertifikat pembayaran" : "Invoice issuance analysis from payment certificates" },
    { id: "receivable_aging", name: language === "id" ? "5. Laporan Umur Piutang" : "5. Receivable Aging Report", desc: language === "id" ? "Aging piutang (Lancar, 1-30h, 31-60h, >60h)" : "Receivable aging (Current, 1-30d, 31-60d, >60d)" },
    { id: "expected_collection", name: language === "id" ? "6. Laporan Proyeksi Kas" : "6. Expected Collection Report", desc: language === "id" ? "Jadwal estimasi penerimaan kas 7h, 30h, 60h, 90h" : "Estimated cash collection windows 7d, 30d, 60d, 90d" },
    { id: "action_aging", name: language === "id" ? "7. Laporan Umur Tindakan" : "7. Action Aging Report", desc: language === "id" ? "Umur dan tingkat penyelesaian tindakan per PIC" : "Action aging and resolution rates by owner" },
    { id: "project_summary", name: language === "id" ? "8. Ringkasan Ekonomi Proyek" : "8. Project Economic Summary", desc: language === "id" ? "Ringkasan nilai kontrak, sertifikasi, penagihan, dan kas" : "Comprehensive contract, billing, and cash summary" },
  ];

  const handleExportCSV = () => {
    const data = coveStore.claims.map((c) => ({
      ClaimNumber: c.claimNumber,
      WorkPerformed: c.workPerformedValue,
      Measured: c.measuredValue,
      Claimed: c.claimedValue,
      Certified: c.certifiedValue,
      CashReceived: c.cashReceivedValue,
      Stage: c.currentStage,
      Risk: c.riskLevel,
    }));

    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["ClaimNumber,WorkPerformed,Measured,Claimed,Certified,CashReceived,Stage,Risk"]
        .concat(data.map((d) => Object.values(d).join(",")))
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `COVE_${selectedReport}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {language === "id" ? "Pusat Laporan Ekonomi" : "Economic Reports Center"}
            </h1>
            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
              {language === "id" ? "8 Laporan Utama" : "8 Standard Reports"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {language === "id" 
              ? "Ekspor laporan keuangan dan analisis umur proses untuk pelaporan manajemen dan direksi" 
              : "Export financial reports and aging analysis for management and board reporting"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleExportCSV}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs gap-1.5"
          >
            <Download className="h-4 w-4" />
            <span>{t("common.export", "Ekspor CSV / XLSX")}</span>
          </Button>
        </div>
      </div>

      {/* Report Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {reportsList.map((r) => {
          const isSelected = selectedReport === r.id;
          return (
            <button
              key={r.id}
              onClick={() => setSelectedReport(r.id)}
              className={`p-4 rounded-xl border text-left transition-all ${
                isSelected
                  ? "bg-slate-900 text-white border-slate-900 shadow-md"
                  : "bg-white text-slate-900 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className={`text-xs font-bold block ${isSelected ? "text-white" : "text-slate-900"}`}>
                {r.name}
              </span>
              <p className={`text-[11px] mt-1 line-clamp-2 ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                {r.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* Active Report Viewer Container */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                {reportsList.find((r) => r.id === selectedReport)?.name}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === "id" ? "Dibuat:" : "Generated:"} {new Date().toLocaleString("id-ID")} • {language === "id" ? "Keterkinian: Fresh (≤24j)" : "Freshness: Fresh (≤24h)"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-8 text-xs w-48 font-medium"
            >
              <option value="all">{language === "id" ? "Semua Proyek (Portofolio)" : "All Projects (Portfolio)"}</option>
              {coveStore.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectName}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Report Data Table */}
        <div className="overflow-x-auto">
          {selectedReport === "cash_at_risk" && (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-3 px-4">{language === "id" ? "Proyek" : "Project"}</th>
                  <th className="py-3 px-4">{language === "id" ? "Nomor Klaim" : "Claim Number"}</th>
                  <th className="py-3 px-4">{language === "id" ? "Tahap Saat Ini" : "Current Stage"}</th>
                  <th className="py-3 px-4">{language === "id" ? "Cash at Risk (IDR)" : "Cash at Risk (IDR)"}</th>
                  <th className="py-3 px-4">{language === "id" ? "Penyebab / Kendala" : "Blocker / Reason"}</th>
                  <th className="py-3 px-4">{language === "id" ? "Penanggung Jawab" : "Owner"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {coveStore.claims
                  .filter((c) => c.riskLevel === "CRITICAL" || c.riskLevel === "AT_RISK")
                  .map((clm) => {
                    const proj = coveStore.projects.find((p) => p.id === clm.projectId);
                    const owner = coveStore.profiles.find((p) => p.id === clm.responsibleOwnerId);
                    const blocker = coveStore.blockers.find((b) => b.entityId === clm.id);

                    return (
                      <tr key={clm.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{proj?.projectName}</td>
                        <td className="py-3 px-4 font-mono font-semibold">{clm.claimNumber}</td>
                        <td className="py-3 px-4">{clm.currentStage}</td>
                        <td className="py-3 px-4 font-mono font-bold text-red-700">
                          {formatIDR(clm.claimedValue - clm.cashReceivedValue)}
                        </td>
                        <td className="py-3 px-4 text-slate-700">{blocker?.title || "SLA Delay"}</td>
                        <td className="py-3 px-4">{owner?.fullName}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}

          {selectedReport === "project_summary" && (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-3 px-4">{language === "id" ? "Proyek" : "Project"}</th>
                  <th className="py-3 px-4">{language === "id" ? "Nilai Kontrak" : "Contract Value"}</th>
                  <th className="py-3 px-4">{language === "id" ? "Tersertifikasi (BAP)" : "Certified (BAP)"}</th>
                  <th className="py-3 px-4">{language === "id" ? "Terfaktur" : "Invoiced"}</th>
                  <th className="py-3 px-4">{language === "id" ? "Kas Diterima" : "Collected"}</th>
                  <th className="py-3 px-4">{language === "id" ? "Sisa Piutang" : "Outstanding"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {coveStore.projects.map((proj) => {
                  const pipe = coveStore.getMoneyPipeline(proj.id);
                  const contract = coveStore.contracts.find((c) => c.projectId === proj.id);

                  return (
                    <tr key={proj.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{proj.projectName}</td>
                      <td className="py-3 px-4 font-mono font-semibold">{formatIDR(contract?.currentContractValue || 0)}</td>
                      <td className="py-3 px-4 font-mono font-semibold">{formatIDR(pipe.certified)}</td>
                      <td className="py-3 px-4 font-mono font-semibold">{formatIDR(pipe.invoiced)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">{formatIDR(pipe.collected)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-700">{formatIDR(pipe.invoiced - pipe.collected)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {selectedReport !== "cash_at_risk" && selectedReport !== "project_summary" && (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-3 px-4">Claim #</th>
                  <th className="py-3 px-4">{language === "id" ? "Proyek" : "Project"}</th>
                  <th className="py-3 px-4">{language === "id" ? "Tahap" : "Stage"}</th>
                  <th className="py-3 px-4">{language === "id" ? "Durasi (Hari)" : "Aging (Days)"}</th>
                  <th className="py-3 px-4">{language === "id" ? "Nilai Terkait" : "Value"}</th>
                  <th className="py-3 px-4">{language === "id" ? "Status SLA" : "SLA Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {coveStore.claims.map((clm) => {
                  const proj = coveStore.projects.find((p) => p.id === clm.projectId);
                  const aging = getDaysDiff(clm.currentStageEnteredAt);

                  return (
                    <tr key={clm.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold">{clm.claimNumber}</td>
                      <td className="py-3 px-4 font-medium">{proj?.projectName}</td>
                      <td className="py-3 px-4">{clm.currentStage}</td>
                      <td className="py-3 px-4 font-mono font-semibold">{aging} {language === "id" ? "hari" : "days"}</td>
                      <td className="py-3 px-4 font-mono font-bold">{formatIDR(clm.claimedValue)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${aging > 14 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                          {aging > 14 ? (language === "id" ? "Terlambat SLA" : "SLA Breached") : (language === "id" ? "Normal" : "Normal")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
