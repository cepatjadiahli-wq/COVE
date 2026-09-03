"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { formatIDR } from "@/lib/utils";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  CheckCircle2,
  Download,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  Check,
  Clock,
  TrendingUp,
  Award,
  ShieldCheck,
  FileCheck,
  Layers,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  B2B_PACKAGES,
  PILOT_SCOPE_CONFIG,
  evaluateDataAcceptance,
  validateProjectEntitlement,
  validateExportEntitlement,
} from "@/domains/onboarding/service";

export default function PilotOnboardingPage() {
  const router = useRouter();
  const { refreshState } = useTenant();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<"wizard" | "checklist" | "scorecard" | "entitlement">("wizard");
  const [acceptanceItems, setAcceptanceItems] = useState(coveStore.getDataAcceptanceItems());
  const [scorecards, setScorecards] = useState(coveStore.getPilotScorecards());
  const [currentStep, setCurrentStep] = useState(1);

  const acceptanceSummary = evaluateDataAcceptance(acceptanceItems);

  const handleToggleAcceptance = (itemId: string, newStatus: "VERIFIED" | "WAIVED" | "PENDING") => {
    coveStore.updateDataAcceptanceItem(itemId, newStatus, "Dimas Sucipto (Commercial Manager)");
    setAcceptanceItems([...coveStore.getDataAcceptanceItems()]);
  };

  // Step 1 State: Company
  const [companyName, setCompanyName] = useState("PT Wijaya Mega Konstruksi");
  const [legalName, setLegalName] = useState("PT Wijaya Mega Konstruksi Perkasa");
  const [businessType, setBusinessType] = useState("General & Commercial Contractor");
  const [city, setCity] = useState("Surabaya");
  const [province, setProvince] = useState("Jawa Timur");

  // Step 2 State: Pilot Team
  const [ownerEmail, setOwnerEmail] = useState("direktur@wijayamega.co.id");
  const [commercialEmail, setCommercialEmail] = useState("qs@wijayamega.co.id");
  const [financeEmail, setFinanceEmail] = useState("keuangan@wijayamega.co.id");

  // Step 3 State: First Project & Contract
  const [projectName, setProjectName] = useState("Pembangunan Gedung Rawat Inap RS Husada");
  const [projectCode, setProjectCode] = useState("PRJ-HSD-01");
  const [clientName, setClientName] = useState("PT Husada Medika Sejahtera");
  const [contractNumber, setContractNumber] = useState("CTR-WMK-2026-001");
  const [contractValue, setContractValue] = useState(32000000000);
  const [retentionPercent, setRetentionPercent] = useState(5);
  const [startDate, setStartDate] = useState("2026-01-15");
  const [finishDate, setFinishDate] = useState("2026-11-30");

  // Step 4 State: Initial Claim Data
  const [claimNumber, setClaimNumber] = useState("MC-003");
  const [workPerformed, setWorkPerformed] = useState(4500000000);
  const [measuredValue, setMeasuredValue] = useState(4200000000);
  const [claimedValue, setClaimedValue] = useState(3800000000);
  const [certifiedValue, setCertifiedValue] = useState(3000000000);

  // Step 6 & 7 State: First Blocker & Action
  const [blockerTitle, setBlockerTitle] = useState("Verifikasi Opname Pembesian Lt 3 Tertunda Konsultan MK");
  const [blockerExposure, setBlockerExposure] = useState(800000000);
  const [actionTitle, setActionTitle] = useState("Klarifikasi volume pembesian bersama Lead QS Konsultan");
  const [actionOwner, setActionOwner] = useState("usr-dimas");
  const [actionDueDate, setActionDueDate] = useState("2026-09-05");

  // Derived Gaps for Step 5
  const unmeasuredGap = Math.max(0, workPerformed - measuredValue);
  const unclaimedGap = Math.max(0, measuredValue - claimedValue);
  const uncertifiedGap = Math.max(0, claimedValue - certifiedValue);

  const handleDownloadTemplate = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "ProjectCode,ClaimNumber,PeriodStart,PeriodEnd,WorkPerformed,MeasuredValue,ClaimedValue,CertifiedValue,ExpectedCashDate\n" +
      "PRJ-HSD-01,MC-001,2026-06-01,2026-06-30,1500000000,1500000000,1500000000,1500000000,2026-07-30\n" +
      "PRJ-HSD-01,MC-002,2026-07-01,2026-07-31,2800000000,2800000000,2800000000,2800000000,2026-08-30\n" +
      "PRJ-HSD-01,MC-003,2026-08-01,2026-08-31,4500000000,4200000000,3800000000,3000000000,2026-09-30\n";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "COVE_Template_Import_Progress_Claim.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCompleteOnboarding = () => {
    // 1. Create Organization
    coveStore.createOrganization({
      name: companyName,
      legalName,
      businessType,
      city,
      province,
    });

    // 2. Create Pilot Project & Contract
    const newProjId = "prj-" + Math.random().toString(36).substring(2, 9);
    const newProject = {
      id: newProjId,
      clientId: "cl-pilot",
      projectCode,
      projectName,
      projectType: "Commercial Building",
      location: `Jl. Raya Utama No. 88, ${city}`,
      city,
      contractStartDate: startDate,
      contractFinishDate: finishDate,
      currencyCode: "IDR",
      status: "active" as const,
      projectManagerId: "usr-fajar",
      commercialManagerId: "usr-dimas",
      financeOwnerId: "usr-rani",
    };

    const newContract = {
      id: "ctr-" + Math.random().toString(36).substring(2, 9),
      projectId: newProjId,
      contractNumber,
      contractTitle: `Kontrak Utama Pekerjaan ${projectName}`,
      originalContractValue: contractValue,
      currentContractValue: contractValue,
      paymentMethod: "Monthly Progress",
      paymentTermDays: 30,
      retentionPercent,
    };

    coveStore.createProject(newProject, newContract);

    // 3. Create Claim
    const newClaim = coveStore.createClaim({
      projectId: newProjId,
      contractId: newContract.id,
      claimNumber,
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      description: `Progress Claim Periode Agustus 2026 - ${projectName}`,
      currentStage: "UNDER_REVIEW",
      riskLevel: "CRITICAL",
      workPerformedValue: workPerformed,
      measuredValue,
      claimedValue,
      certifiedValue,
      expectedNetCollectible: claimedValue * 0.95,
      cashReceivedValue: 0,
      expectedCashDate: "2026-09-30",
      responsibleOwnerId: "usr-dimas",
      sourceType: "manual",
      sourceUpdatedAt: new Date().toISOString(),
    });

    // 4. Create Blocker & Action
    coveStore.createBlocker({
      projectId: newProjId,
      entityType: "claim",
      entityId: newClaim.id,
      category: "consultant_review",
      title: blockerTitle,
      description: "Selisih perhitungan volume pembesian Lt 3 sebesar Rp 800M perlu klarifikasi opname lapangan.",
      financialExposure: blockerExposure,
      severity: "high",
      controllability: "joint",
      ownerId: actionOwner,
      raisedDate: new Date().toISOString().split("T")[0],
      targetResolveDate: actionDueDate,
    });

    coveStore.createAction({
      projectId: newProjId,
      entityType: "claim",
      entityId: newClaim.id,
      riskType: "UNCERTIFIED_AT_RISK",
      financialExposure: blockerExposure,
      title: actionTitle,
      description: "Jadwalkan rapat rekonsiliasi volume pembesian bersama tim MK untuk rilis BAP sertifikasi.",
      ownerId: actionOwner,
      priority: "critical",
      dueDate: actionDueDate,
    });

    refreshState();
    router.push("/dashboard");
  };

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-8 animate-in fade-in-0 duration-300">
      {/* Header Banner */}
      <div className="rounded-2xl bg-slate-900 text-white p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-800/80 inline-block mb-3">
            {language === "id" ? "Panduan Onboarding Pilot" : "Pilot Onboarding Wizard"}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            {language === "id" ? "Selamat Datang di COVE V1" : "Welcome to COVE V1"}
          </h1>
          <p className="text-sm text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
            {language === "id"
              ? "Inisiasi proyek pilot pertama Anda dalam 7 langkah cepat untuk langsung memetakan perjalanan nilai (Money Pipeline), mendeteksi Cash-at-Risk, dan menugaskan tindakan nyata."
              : "Initiate your first pilot project in 7 quick steps to map your Money Pipeline, detect Cash-at-Risk, and assign immediate economic actions."}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab("wizard")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "wizard"
              ? "bg-slate-900 text-white shadow"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          1. Panduan Setup Onboarding (7 Langkah)
        </button>
        <button
          onClick={() => setActiveTab("checklist")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "checklist"
              ? "bg-slate-900 text-white shadow"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <span>2. Data Acceptance Checklist (PRD 23.3)</span>
          <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-mono">
            {acceptanceSummary.verifiedCount}/{acceptanceSummary.totalItems}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("scorecard")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "scorecard"
              ? "bg-slate-900 text-white shadow"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Award className="h-3.5 w-3.5 text-amber-500" />
          <span>3. Pilot Scorecard Hari ke-45 (PRD 23.2 & 24.5)</span>
        </button>
        <button
          onClick={() => setActiveTab("entitlement")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "entitlement"
              ? "bg-slate-900 text-white shadow"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>4. Paket & Entitlement B2B (PRD 28)</span>
        </button>
      </div>

      {activeTab === "wizard" && (
        <>
          {/* Progress Steps Indicator */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold">
        {[
          t("onb.step1", "1. Profil Perusahaan"),
          t("onb.step2", "2. Tim Pilot"),
          t("onb.step3", "3. Setup Proyek & Kontrak"),
          t("onb.step4", "4. Impor Riwayat Klaim"),
          t("onb.step5", "5. Pratinjau Money Pipeline"),
          t("onb.step6", "6. Deteksi Cash-at-Risk"),
          t("onb.step7", "7. Tetapkan Tindakan Pertama"),
        ].map((stepLabel, idx) => {
          const stepNum = idx + 1;
          const isActive = currentStep === stepNum;
          const isDone = currentStep > stepNum;
          return (
            <div
              key={stepNum}
              className={`p-2 rounded-lg border transition-all ${
                isActive
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : isDone
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-white text-slate-400 border-slate-200"
              }`}
            >
              <div className="text-[10px] block truncate">{stepLabel}</div>
            </div>
          );
        })}
      </div>

      {/* Step Container Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {/* STEP 1: COMPANY */}
        {currentStep === 1 && (
          <div className="space-y-5 text-xs max-w-xl">
            <div>
              <h3 className="text-base font-bold text-slate-900">{language === "id" ? "Langkah 1: Profil Perusahaan Kontraktor" : "Step 1: Contractor Company Profile"}</h3>
              <p className="text-slate-500 mt-0.5">{language === "id" ? "Masukkan data legalitas dan domisili perusahaan" : "Enter legal corporate profile and headquarters"}</p>
            </div>

            <div>
              <Label htmlFor="cname">{language === "id" ? "Nama Perusahaan (Display Name) *" : "Company Name *"}</Label>
              <Input id="cname" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-1" />
            </div>

            <div>
              <Label htmlFor="lname">{language === "id" ? "Nama Legal Perusahaan (PT / CV) *" : "Legal Entity Name (PT / CV) *"}</Label>
              <Input id="lname" required value={legalName} onChange={(e) => setLegalName(e.target.value)} className="mt-1" />
            </div>

            <div>
              <Label htmlFor="btype">{language === "id" ? "Spesialisasi / Jenis Kontraktor" : "Contractor Classification"}</Label>
              <Input id="btype" required value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="mt-1" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">{language === "id" ? "Kota Domisili" : "City"}</Label>
                <Input id="city" required value={city} onChange={(e) => setCity(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="prov">{language === "id" ? "Provinsi" : "Province"}</Label>
                <Input id="prov" required value={province} onChange={(e) => setProvince(e.target.value)} className="mt-1" />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: TEAM */}
        {currentStep === 2 && (
          <div className="space-y-5 text-xs max-w-xl">
            <div>
              <h3 className="text-base font-bold text-slate-900">{language === "id" ? "Langkah 2: Anggota Tim Pilot" : "Step 2: Pilot Team Members"}</h3>
              <p className="text-slate-500 mt-0.5">{language === "id" ? "Tentukan PIC yang akan mengoperasikan COVE pada proyek pilot ini" : "Designate team members who will operate COVE during the pilot"}</p>
            </div>

            <div>
              <Label htmlFor="ownerEmail">{language === "id" ? "Direktur / Owner (Executive Sponsor)" : "Director / Owner (Executive Sponsor)"}</Label>
              <Input id="ownerEmail" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className="mt-1" />
            </div>

            <div>
              <Label htmlFor="commEmail">{language === "id" ? "Commercial Manager / Senior QS (Operasional Klaim)" : "Commercial Manager / Senior QS"}</Label>
              <Input id="commEmail" type="email" value={commercialEmail} onChange={(e) => setCommercialEmail(e.target.value)} className="mt-1" />
            </div>

            <div>
              <Label htmlFor="finEmail">{language === "id" ? "Finance & Billing Manager (Penagihan & Kas)" : "Finance & Billing Manager"}</Label>
              <Input id="finEmail" type="email" value={financeEmail} onChange={(e) => setFinanceEmail(e.target.value)} className="mt-1" />
            </div>
          </div>
        )}

        {/* STEP 3: PROJECT & CONTRACT */}
        {currentStep === 3 && (
          <div className="space-y-5 text-xs max-w-2xl">
            <div>
              <h3 className="text-base font-bold text-slate-900">{language === "id" ? "Langkah 3: Data Proyek & Kontrak Pilot" : "Step 3: Pilot Project & Primary Contract"}</h3>
              <p className="text-slate-500 mt-0.5">{language === "id" ? "Pilih 1 proyek aktif yang sedang berjalan untuk dijadikan pilot" : "Select 1 active live project to run the 30-day pilot"}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pcode">{language === "id" ? "Kode Proyek" : "Project Code"}</Label>
                <Input id="pcode" required value={projectCode} onChange={(e) => setProjectCode(e.target.value)} className="mt-1 font-mono" />
              </div>
              <div>
                <Label htmlFor="pname">{language === "id" ? "Nama Proyek Pilot *" : "Pilot Project Name *"}</Label>
                <Input id="pname" required value={projectName} onChange={(e) => setProjectName(e.target.value)} className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cclient">{language === "id" ? "Klien / Pemilik Proyek (Developer)" : "Client / Developer"}</Label>
                <Input id="cclient" required value={clientName} onChange={(e) => setClientName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="cnum">{language === "id" ? "Nomor Kontrak Utama" : "Contract Number"}</Label>
                <Input id="cnum" required value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} className="mt-1 font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cval">{language === "id" ? "Nilai Kontrak (IDR) *" : "Contract Value (IDR) *"}</Label>
                <Input
                  id="cval"
                  type="number"
                  required
                  value={contractValue}
                  onChange={(e) => setContractValue(Number(e.target.value))}
                  className="mt-1 font-mono text-sm font-bold"
                />
              </div>
              <div>
                <Label htmlFor="cret">{language === "id" ? "Potongan Retensi (%)" : "Retention Rate (%)"}</Label>
                <Input
                  id="cret"
                  type="number"
                  value={retentionPercent}
                  onChange={(e) => setRetentionPercent(Number(e.target.value))}
                  className="mt-1 font-mono text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: CLAIM DATA ENTRY / IMPORT */}
        {currentStep === 4 && (
          <div className="space-y-5 text-xs max-w-2xl">
            <div>
              <h3 className="text-base font-bold text-slate-900">{language === "id" ? "Langkah 4: Masukkan Data Progress Claim Terakhir" : "Step 4: Enter Active Progress Claim Data"}</h3>
              <p className="text-slate-500 mt-0.5">{language === "id" ? "Masukkan data opname dan pengajuan klaim berjalan atau download template Excel" : "Enter physical, measurement, and claim figures or use spreadsheet template"}</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="font-bold text-slate-900 block text-xs">{language === "id" ? "Punya Rekapitulasi Excel?" : "Have Existing Spreadsheets?"}</span>
                <span className="text-[11px] text-slate-500">{language === "id" ? "Download template format standard COVE untuk import data klaim historis" : "Download standard COVE template to batch import historical claims"}</span>
              </div>
              <Button onClick={handleDownloadTemplate} variant="outline" size="sm" className="text-xs font-semibold gap-1.5 bg-white">
                <Download className="h-3.5 w-3.5" />
                <span>{language === "id" ? "Unduh Template Excel" : "Download Excel Template"}</span>
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="clmnum">{language === "id" ? "Nomor Sertifikat Klaim (MC)" : "Claim Certificate # (MC)"}</Label>
                <Input id="clmnum" required value={claimNumber} onChange={(e) => setClaimNumber(e.target.value)} className="mt-1 font-mono" />
              </div>
              <div>
                <Label htmlFor="wpval">{t("p2c.summary.work_performed", "Work Performed (Nilai Fisik)")}</Label>
                <Input
                  id="wpval"
                  type="number"
                  required
                  value={workPerformed}
                  onChange={(e) => setWorkPerformed(Number(e.target.value))}
                  className="mt-1 font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="measval">{t("p2c.summary.measured", "Measured / Opname")}</Label>
                <Input
                  id="measval"
                  type="number"
                  required
                  value={measuredValue}
                  onChange={(e) => setMeasuredValue(Number(e.target.value))}
                  className="mt-1 font-mono font-bold"
                />
              </div>
              <div>
                <Label htmlFor="clmval">{t("p2c.summary.claimed", "Claimed (Diajukan)")}</Label>
                <Input
                  id="clmval"
                  type="number"
                  required
                  value={claimedValue}
                  onChange={(e) => setClaimedValue(Number(e.target.value))}
                  className="mt-1 font-mono font-bold"
                />
              </div>
              <div>
                <Label htmlFor="certval">{t("p2c.summary.certified", "Certified (BAP Disetujui)")}</Label>
                <Input
                  id="certval"
                  type="number"
                  required
                  value={certifiedValue}
                  onChange={(e) => setCertifiedValue(Number(e.target.value))}
                  className="mt-1 font-mono font-bold text-emerald-700"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: REVIEW MONEY PIPELINE */}
        {currentStep === 5 && (
          <div className="space-y-6 text-xs">
            <div>
              <h3 className="text-base font-bold text-slate-900">{language === "id" ? "Langkah 5: Visualisasi Money Pipeline Proyek Anda" : "Step 5: Money Pipeline Preview"}</h3>
              <p className="text-slate-500 mt-0.5">{language === "id" ? "COVE otomatis menghitung pergerakan nilai dan gap yang tertahan di setiap tahap" : "COVE automatically computes value progression and stage bottlenecks"}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-300">{language === "id" ? "Pekerjaan Fisik" : "Work Performed"}</span>
                <span className="text-lg font-black font-mono mt-2">{formatIDR(workPerformed)}</span>
              </div>
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-blue-800">{language === "id" ? "Opname Terukur" : "Measured Opname"}</span>
                <span className="text-lg font-black font-mono text-blue-900 mt-2">{formatIDR(measuredValue)}</span>
              </div>
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-indigo-800">{language === "id" ? "Pengajuan Klaim" : "Claimed Value"}</span>
                <span className="text-lg font-black font-mono text-indigo-900 mt-2">{formatIDR(claimedValue)}</span>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-emerald-800">{language === "id" ? "Disertifikasi BAP" : "Certified (BAP)"}</span>
                <span className="text-lg font-black font-mono text-emerald-900 mt-2">{formatIDR(certifiedValue)}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>{language === "id" ? "Value Gap yang Terdeteksi:" : "Detected Value Gaps:"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-slate-900">
                <div>{t("p2c.gap.unmeasured", "Belum Opname")}: <strong>{formatIDR(unmeasuredGap)}</strong></div>
                <div>{t("p2c.gap.unclaimed", "Belum Diajukan")}: <strong>{formatIDR(unclaimedGap)}</strong></div>
                <div>{t("p2c.gap.uncertified", "Belum Disahkan (BAP)")}: <strong className="text-red-700">{formatIDR(uncertifiedGap)}</strong></div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: IDENTIFY FIRST EXPOSURE */}
        {currentStep === 6 && (
          <div className="space-y-6 text-xs max-w-xl">
            <div>
              <h3 className="text-base font-bold text-slate-900">{language === "id" ? "Langkah 6: Verifikasi Paparan Finansial (Cash-at-Risk)" : "Step 6: Verify Cash-at-Risk Exposure"}</h3>
              <p className="text-slate-500 mt-0.5">{language === "id" ? "COVE mendeteksi nilai klaim yang tertahan di tahap evaluasi konsultan" : "COVE detects claim value stalled in consultant review"}</p>
            </div>

            <div className="p-5 rounded-xl border border-red-200 bg-red-50/70 space-y-3">
              <div className="flex items-center gap-2 font-bold text-red-900 text-sm">
                <ShieldAlert className="h-5 w-5 text-red-600" />
                <span>{language === "id" ? "Uncertified Cash-at-Risk Terdeteksi" : "Uncertified Cash-at-Risk Detected"}</span>
              </div>
              <div className="text-2xl font-black font-mono text-red-700">
                {formatIDR(uncertifiedGap)}
              </div>
              <p className="text-[11px] text-red-800 leading-relaxed">
                {language === "id" 
                  ? `Terdapat selisih Rp ${uncertifiedGap.toLocaleString("id-ID")} antara nilai klaim yang diajukan (${formatIDR(claimedValue)}) dengan BAP yang disetujui (${formatIDR(certifiedValue)}).`
                  : `Discrepancy of Rp ${uncertifiedGap.toLocaleString("id-ID")} detected between claimed (${formatIDR(claimedValue)}) and certified (${formatIDR(certifiedValue)}).`}
              </p>
            </div>

            <div>
              <Label htmlFor="btitle">{language === "id" ? "Penyebab / Judul Kendala (Blocker)" : "Blocker Title / Cause"}</Label>
              <Input id="btitle" required value={blockerTitle} onChange={(e) => setBlockerTitle(e.target.value)} className="mt-1" />
            </div>

            <div>
              <Label htmlFor="bexp">{language === "id" ? "Nilai Eksposur Finansial (IDR)" : "Financial Exposure (IDR)"}</Label>
              <Input
                id="bexp"
                type="number"
                required
                value={blockerExposure}
                onChange={(e) => setBlockerExposure(Number(e.target.value))}
                className="mt-1 font-mono font-bold"
              />
            </div>
          </div>
        )}

        {/* STEP 7: CREATE FIRST ACTION (FIRST-VALUE MOMENT) */}
        {currentStep === 7 && (
          <div className="space-y-6 text-xs max-w-xl">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900">{language === "id" ? "Langkah 7: Tugaskan Tindakan Pertama (First Action)" : "Step 7: Assign First Economic Action"}</h3>
              </div>
              <p className="text-slate-500 mt-0.5">{language === "id" ? "Ubah deteksi risiko menjadi tindakan nyata dengan batas waktu dan PIC yang jelas" : "Convert risk detection into accountable execution"}</p>
            </div>

            <div>
              <Label htmlFor="acttitle">{language === "id" ? "Judul Tindakan (Action Title) *" : "Action Title *"}</Label>
              <Input id="acttitle" required value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} className="mt-1 font-semibold" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="actowner">{language === "id" ? "Penanggung Jawab (PIC)" : "Responsible Owner"}</Label>
                <Select id="actowner" value={actionOwner} onChange={(e) => setActionOwner(e.target.value)} className="mt-1">
                  <option value="usr-dimas">Dimas Sucipto (Commercial Manager)</option>
                  <option value="usr-andi">Andi Wijaya (Senior Project QS)</option>
                  <option value="usr-rani">Rani Prameswari (Finance Manager)</option>
                  <option value="usr-fajar">Fajar Nugroho (Project Manager)</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="actdue">{language === "id" ? "Batas Waktu Target (Due Date)" : "Due Date"}</Label>
                <Input id="actdue" type="date" required value={actionDueDate} onChange={(e) => setActionDueDate(e.target.value)} className="mt-1 font-mono" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
              <span className="font-bold block">{language === "id" ? "First-Value Moment (Bukti Nilai Pertama):" : "First-Value Moment:"}</span>
              <p className="text-[11px] leading-relaxed">
                {language === "id" 
                  ? "Setelah mengklik tombol di bawah, proyek pilot Anda akan langsung aktif di Command Center dengan Money Pipeline terpetakan, Cash-at-Risk terukur, dan Action siap dikerjakan tim."
                  : "Upon completing setup, your pilot project goes live on Executive Command Center with full pipeline tracking."}
              </p>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-8">
          {currentStep > 1 ? (
            <Button variant="outline" size="sm" onClick={() => setCurrentStep(currentStep - 1)} className="text-xs font-semibold gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{t("onb.back", "Sebelumnya")}</span>
            </Button>
          ) : (
            <div />
          )}

          {currentStep < 7 ? (
            <Button size="sm" onClick={() => setCurrentStep(currentStep + 1)} className="bg-slate-900 text-white font-bold text-xs gap-1.5">
              <span>{language === "id" ? `Lanjut ke Langkah ${currentStep + 1}` : `Proceed to Step ${currentStep + 1}`}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleCompleteOnboarding} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-1.5 px-6">
              <CheckCircle2 className="h-4 w-4" />
              <span>{t("onb.finish", "Selesaikan Onboarding & Buka Command Center")}</span>
            </Button>
          )}
        </div>
      </div>
    </>
  )}

  {/* TAB 2: DATA ACCEPTANCE CHECKLIST (PRD 23.3) */}
  {activeTab === "checklist" && (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">
                Data Acceptance Checklist (PRD Bagian 23.3)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              8 kriteria verifikasi wajib sebelum baseline proyek dikunci dan tindakan diluncurkan ke lapangan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${
                acceptanceSummary.isFullyAccepted
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                  : "bg-amber-50 text-amber-800 border-amber-300"
              }`}
            >
              {acceptanceSummary.isFullyAccepted ? "DATA DITERIMA PENUH (ACCEPTED)" : "SEBAGIAN MENUNGGU VERIFIKASI"}
            </span>
            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded">
              {acceptanceSummary.verifiedCount} / {acceptanceSummary.totalItems} Terverifikasi
            </span>
          </div>
        </div>

        {/* Checklist Table */}
        <div className="divide-y divide-slate-100">
          {acceptanceItems.map((item, idx) => {
            const isVerified = item.status === "VERIFIED";
            const isWaived = item.status === "WAIVED";

            return (
              <div key={item.id} className="py-4 flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-400">0{idx + 1}.</span>
                    <h4 className="text-xs font-bold text-slate-900">{item.itemLabel}</h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isVerified
                          ? "bg-emerald-100 text-emerald-800"
                          : isWaived
                          ? "bg-slate-100 text-slate-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{item.description}</p>
                  {item.notes && (
                    <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 mt-1 font-mono">
                      Catatan: {item.notes}
                    </p>
                  )}
                  {item.verifiedByName && (
                    <p className="text-[10px] text-slate-400">
                      Diverifikasi oleh: <strong className="text-slate-600">{item.verifiedByName}</strong>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 self-start shrink-0">
                  <Button
                    size="sm"
                    variant={isVerified ? "default" : "outline"}
                    onClick={() => handleToggleAcceptance(item.id, "VERIFIED")}
                    className={`text-[11px] font-bold h-7 px-2.5 gap-1 ${
                      isVerified ? "bg-emerald-700 text-white hover:bg-emerald-800" : "text-emerald-700 border-emerald-300"
                    }`}
                  >
                    <Check className="h-3 w-3" />
                    <span>Verifikasi</span>
                  </Button>

                  <Button
                    size="sm"
                    variant={isWaived ? "default" : "outline"}
                    onClick={() => handleToggleAcceptance(item.id, "WAIVED")}
                    className={`text-[11px] font-bold h-7 px-2.5 ${
                      isWaived ? "bg-slate-800 text-white" : "text-slate-600 border-slate-300"
                    }`}
                  >
                    Waive
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  )}

  {/* TAB 3: PILOT SCORECARD DAY 45 (PRD 23.2 & 24.5) */}
  {activeTab === "scorecard" && (
    <div className="space-y-6">
      {scorecards.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                <h2 className="text-lg font-bold text-slate-900">
                  Pilot Scorecard Evaluasi Hari ke-45 (PRD 23.2 &amp; 24.5)
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Proyek Pilot: <strong className="text-slate-800">{scorecards[0].projectName}</strong> • Durasi 45 Hari Selesai
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                STATUS: PILOT SUKSES
              </span>
              <span className="text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 px-2.5 py-1 rounded">
                ROI Multiplier: {scorecards[0].roiMultiplier}x
              </span>
            </div>
          </div>

          {/* 4 Performance Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500">Penurunan Eksposur Kas</span>
              <div className="text-base font-black text-slate-900">
                {formatIDR(scorecards[0].baselineExposure - scorecards[0].closingExposure)}
              </div>
              <p className="text-[10px] text-slate-400">
                Baseline {formatIDR(scorecards[0].baselineExposure)} → Akhir {formatIDR(scorecards[0].closingExposure)}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500">Pemotongan Siklus Penagihan</span>
              <div className="text-base font-black text-emerald-700">
                {scorecards[0].baselineCycleDays - scorecards[0].closingCycleDays} Hari Kerja
              </div>
              <p className="text-[10px] text-slate-400">
                Dari {scorecards[0].baselineCycleDays} hari dipangkas menjadi {scorecards[0].closingCycleDays} hari
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500">Tindakan Level A Selesai</span>
              <div className="text-base font-black text-slate-900">
                {formatIDR(scorecards[0].resolvedExposureLevelA)}
              </div>
              <p className="text-[10px] text-slate-400">
                Eksposur terhambat yang berhasil dicairkan via tindakan
              </p>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-amber-800">ROI Multiplier Pilot</span>
              <div className="text-2xl font-black text-amber-900">
                {scorecards[0].roiMultiplier}x
              </div>
              <p className="text-[10px] text-amber-700">
                Biaya pilot Rp 10 Juta vs Rp {formatIDR(scorecards[0].resolvedExposureLevelA)} terselamatkan
              </p>
            </div>
          </div>

          {/* Time Budget Compliance (PRD 23.4) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Kepatuhan Anggaran Waktu Pengguna (PRD Bagian 23.4)
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                EFISIENSI WAKTU TERCAPAI
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200">
                <span className="text-slate-600">Total Waktu Implementasi Awal:</span>
                <strong className="text-slate-900 font-mono">
                  {scorecards[0].timeBudgetCompliance.implementationEffortHours} Jam (Target &lt;16 Jam)
                </strong>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200">
                <span className="text-slate-600">Durasi Weekly Review Manajemen:</span>
                <strong className="text-slate-900 font-mono">
                  {scorecards[0].timeBudgetCompliance.weeklyReviewMinutesPerProject} Menit / Proyek (Target &le;10 Menit)
                </strong>
              </div>
            </div>
          </div>

          {/* Renewal Recommendation */}
          <div className="p-5 rounded-xl bg-slate-900 text-white space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-emerald-400">
                Rekomendasi Pembaruan Komersial (Renewal Proposal)
              </span>
              <span className="text-xs font-black bg-emerald-500 text-slate-950 px-2.5 py-0.5 rounded">
                Rekomendasi: Core B2B Subscription
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {scorecards[0].renewalRecommendationRationale}
            </p>
            <div className="pt-2 flex items-center gap-3">
              <Button
                onClick={() => router.push("/pricing")}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
              >
                Lanjutkan ke Langganan Tahunan Core B2B (Rp 2,5 Juta/bln)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )}

  {/* TAB 4: PAKET & ENTITLEMENT B2B (PRD 28) */}
  {activeTab === "entitlement" && (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-slate-900" />
              <h2 className="text-lg font-bold text-slate-900">
                Packaging &amp; Entitlement Komersial B2B (PRD Bagian 28)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Metrik penagihan resmi: <strong>Company Base + Active Project</strong> (bukan per-seat). Proyek yang telah selesai/diarsipkan tidak dihitung dalam kuota aktif.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-3 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
              Proyek Aktif Organisasi Saat Ini: 2 Proyek
            </span>
          </div>
        </div>

        {/* 4 B2B Tier Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.values(B2B_PACKAGES).map((pkg) => (
            <div key={pkg.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  {pkg.billingPeriod}
                </span>
                <h3 className="text-sm font-bold text-slate-900">{pkg.name}</h3>
                <div className="text-lg font-black text-slate-900">
                  {formatIDR(pkg.priceAmount)}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{pkg.description}</p>
              </div>

              <div className="space-y-2 border-t border-slate-200 pt-3 text-[11px]">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Batas Proyek Aktif:</span>
                  <strong className="text-slate-900">{pkg.maxActiveProjects === -1 ? "Tak Terbatas" : `${pkg.maxActiveProjects} Proyek`}</strong>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Batas Pengguna:</span>
                  <strong className="text-slate-900">{pkg.maxUsers === -1 ? "Tak Terbatas" : `${pkg.maxUsers} Users`}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Open Data Grace Period Guarantee Banner */}
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            <h4 className="text-xs font-bold">Jaminan Open Data Grace Period (PRD Bagian 28.1):</h4>
          </div>
          <p className="text-[11px] leading-relaxed">
            Entitlement tidak boleh menghapus akses export saat subscription berakhir. Kontraktor selalu memiliki hak penuh untuk mengunduh seluruh data historis dalam format terbuka kapan pun tanpa hambatan.
          </p>
          <div className="pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const data = coveStore.exportFullTenantData("org-nusantara-01");
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `COVE_Full_Tenant_Data_Backup_${new Date().toISOString().split("T")[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="text-xs font-bold gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Unduh Cadangan Lengkap Data Perusahaan (JSON)</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )}
    </div>
  );
}
