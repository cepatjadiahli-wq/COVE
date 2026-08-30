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

      {/* 4 Primary Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard
          title={t("dash.kpi.cash_at_risk", "CASH AT RISK")}
          amount={kpis.cashAtRisk}
          affectedCount={kpis.cashAtRiskAffectedCount}
          affectedLabel={language === "id" ? "klaim terdampak" : "claims affected"}
          freshness={language === "id" ? "Fresh (≤24j)" : kpis.freshnessLabel}
          description={t("dash.kpi.cash_at_risk_desc", "Nilai pekerjaan berisiko macet pada klaim atau faktur")}
          variant="danger"
          icon={ShieldAlert}
          href="/progress-to-cash?risk=critical"
        />

        <KpiCard
          title={t("dash.kpi.pre_invoice", "PRE-INVOICE EXPOSURE")}
          amount={kpis.preInvoiceExposure}
          affectedCount={kpis.preInvoiceAffectedCount}
          affectedLabel={language === "id" ? "tahap pra-faktur" : "unbilled claims"}
          freshness={language === "id" ? "Fresh (≤24j)" : kpis.freshnessLabel}
          description={t("dash.kpi.pre_invoice_desc", "Pekerjaan selesai/opname yang belum resmi difakturkan")}
          variant="warning"
          icon={Clock}
          href="/progress-to-cash?stage=unbilled"
        />

        <KpiCard
          title={t("dash.kpi.overdue", "PIUTANG JATUH TEMPO")}
          amount={kpis.overdueReceivables}
          affectedCount={kpis.overdueAffectedCount}
          affectedLabel={language === "id" ? "faktur overdue" : "overdue invoices"}
          freshness={language === "id" ? "Fresh (≤24j)" : kpis.freshnessLabel}
          description={t("dash.kpi.overdue_desc", "Invoice yang telah melewati tanggal jatuh tempo pembayaran")}
          variant="danger"
          icon={AlertTriangle}
          href="/progress-to-cash?status=overdue"
        />

        <KpiCard
          title={t("dash.kpi.expected_cash", "PROYEKSI KAS (30 HARI)")}
          amount={kpis.expectedCollection30Days}
          affectedCount={kpis.expectedCollectionAffectedCount}
          affectedLabel={language === "id" ? "termin cair" : "inflows"}
          freshness={language === "id" ? "Fresh (≤24j)" : kpis.freshnessLabel}
          description={t("dash.kpi.expected_cash_desc", "Estimasi kas masuk dalam 30 hari ke depan")}
          variant="success"
          icon={CheckCircle2}
          href="/progress-to-cash"
        />
      </div>

      {/* Money Pipeline Visual */}
      <MoneyPipeline pipeline={pipeline} />

      {/* Contractor Economic Health Scorecard (C-Score) & Stress-Test */}
      <CScoreCard cScore={cScore} onOpenSimulator={() => setShowSimulator(true)} />

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
