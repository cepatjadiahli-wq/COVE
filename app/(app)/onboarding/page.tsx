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
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function PilotOnboardingPage() {
  const router = useRouter();
  const { refreshState } = useTenant();
  const { t, language } = useLanguage();
  const [currentStep, setCurrentStep] = useState(1);

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
    </div>
  );
}
