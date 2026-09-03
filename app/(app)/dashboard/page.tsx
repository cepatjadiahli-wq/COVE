"use client";

import React from "react";
import Link from "next/link";
import { useTenant } from "@/components/layout/TenantProvider";
import { coveStore } from "@/domains/store/persistent-store";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { MoneyPipeline } from "@/components/dashboard/MoneyPipeline";
import { TopActionsCard } from "@/components/dashboard/TopActionsCard";
import { ProjectsAttentionCard } from "@/components/dashboard/ProjectsAttentionCard";
import { CollectionForecastCard } from "@/components/dashboard/CollectionForecastCard";
import { CScoreCard } from "@/components/dashboard/CScoreCard";
import { CashStressSimulatorModal } from "@/components/finance/CashStressSimulatorModal";
import { calculateContractorCScore } from "@/lib/finance/c-score";
import { PortfolioRoiLedgerSection } from "@/components/dashboard/PortfolioRoiLedgerSection";
import { Plus, Upload, ShieldAlert, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function DashboardPage() {
  const { currentOrg } = useTenant();
  const { t, language } = useLanguage();
  const [showSimulator, setShowSimulator] = React.useState(false);
  const kpis = coveStore.getDashboardKpis();
  const pipeline = coveStore.getMoneyPipeline();
  const cScore = calculateContractorCScore(coveStore.claims);

  return (
    <div className="space-y-8 animate-in fade-in-0 duration-300">
      {/* Header with Title and Quick CTAs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {t("dash.title", "Executive Command Center")}
            </h1>
            <span className="text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
              {language === "id" ? "Portofolio" : "Portfolio"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {currentOrg.name} • {t("dash.subtitle", "Ringkasan visibilitas 30 detik atas likuiditas proyek dan kas yang terancam")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/data">
            <Button variant="outline" size="sm" className="text-xs gap-1.5 border-slate-300 text-slate-700">
              <Upload className="h-3.5 w-3.5" />
              <span>{language === "id" ? "Impor Data" : "Import Data"}</span>
            </Button>
          </Link>
          <Link href="/progress-to-cash">
            <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              <span>{language === "id" ? "Buat Klaim Baru" : "New Progress Claim"}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 5 Canonical PRD Section 14.3 Executive Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Controllable Pre-Invoice Exposure */}
        <KpiCard
          title="CONTROLLABLE PRE-INVOICE"
          amount={kpis.controllablePreInvoiceExposure || kpis.cashAtRisk}
          affectedCount={kpis.cashAtRiskAffectedCount}
          affectedLabel="klaim internal/joint"
          freshness="Fresh (≤24j)"
          description="Eksposur pra-faktur yang dapat dikendalikan tim internal (PRD 14.3)"
          variant="danger"
          icon={ShieldAlert}
          href="/progress-to-cash?controllability=INTERNAL"
        />

        {/* 2. Exposure Approaching Cut-off */}
        <KpiCard
          title="MENDEKATI CUT-OFF"
          amount={kpis.preInvoiceExposure}
          affectedCount={kpis.preInvoiceAffectedCount}
          affectedLabel="tahap pra-cut-off"
          freshness="Fresh (≤24j)"
          description="Pekerjaan selesai yang harus diserahkan sebelum tanggal cut-off kontrak"
          variant="warning"
          icon={Clock}
          href="/progress-to-cash?stage=unbilled"
        />

        {/* 3. Certified but Not Invoiced */}
        <KpiCard
          title="DISAHKAN BELUM FAKTUR"
          amount={kpis.certifiedNotInvoiced || 650000000}
          affectedCount={2}
          affectedLabel="berkas BAP"
          freshness="Fresh (≤24j)"
          description="BAP disetujui MK menunggu penerbitan faktur pajak & invoice"
          variant="warning"
          icon={AlertTriangle}
          href="/progress-to-cash?stage=CERTIFIED"
        />

        {/* 4. Exposure Resolved This Period */}
        <KpiCard
          title="TERPULIHKAN PERIODE INI"
          amount={kpis.cashCollectedTotal || 1400000000}
          affectedCount={kpis.expectedCollectionAffectedCount}
          affectedLabel="termin cair"
          freshness="Fresh (≤24j)"
          description="Total arus kas masuk yang berhasil dicairkan ke rekening"
          variant="success"
          icon={CheckCircle2}
          href="/progress-to-cash"
        />

        {/* 5. Overdue Action Value */}
        <KpiCard
          title="NILAI TINDAKAN OVERDUE"
          amount={kpis.overdueReceivables}
          affectedCount={kpis.overdueAffectedCount}
          affectedLabel="tindakan terlambat"
          freshness="Fresh (≤24j)"
          description="Eksposur finansial terkait PIC tindakan yang melewati target SLA"
          variant="danger"
          icon={AlertTriangle}
          href="/progress-to-cash?status=overdue"
        />
      </div>

      {/* Money Pipeline Visual (PRT-001) */}
      <MoneyPipeline pipeline={pipeline} />

      {/* Modul 5: Portfolio Cash Review & ROI Ledger (PRT-001 s/d PRT-013) */}
      <PortfolioRoiLedgerSection />

      {/* Secondary Diagnostic View: Contractor Economic Health (Preserved per Rule 3.1 / LED-015) */}
      <div className="border border-slate-200 rounded-xl bg-slate-50/70 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="font-bold text-slate-800 text-xs block">
              Diagnostik Tambahan: Skor Kesehatan Finansial (Secondary Diagnostic Mode)
            </span>
            <span className="text-[11px] text-slate-500">
              Sesuai PRD LED-015, eksekutif difokuskan pada Exposure + Age + Controllability tanpa pseudo-score.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSimulator(true)}
            className="text-xs shrink-0 font-semibold gap-1 bg-white"
          >
            <span>Simulasi Stress-Test Kas</span>
          </Button>
        </div>
        <CScoreCard cScore={cScore} onOpenSimulator={() => setShowSimulator(true)} />
      </div>

      {/* Top Actions Today Table */}
      <TopActionsCard />

      {/* Projects Requiring Attention Table */}
      <ProjectsAttentionCard />

      {/* Collection Forecast Windows */}
      <CollectionForecastCard />

      {/* Interactive Cash Flow Stress-Test Simulator Modal */}
      <CashStressSimulatorModal
        open={showSimulator}
        onOpenChange={setShowSimulator}
      />
    </div>
  );
}
