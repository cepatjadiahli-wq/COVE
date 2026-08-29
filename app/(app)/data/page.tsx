"use client";

import React, { useState } from "react";
import { formatIDR } from "@/lib/utils";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Download,
  FileSpreadsheet,
  CheckCircle2,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function DataCenterPage() {
  const { refreshState } = useTenant();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState("imports");

  // Import Wizard State
  const [selectedEntity, setSelectedEntity] = useState("claims");
  const [step, setStep] = useState(1);
  const [fileName] = useState("Klaim_Progres_Agustus_2026.xlsx");
  const [duplicateStrategy, setDuplicateStrategy] = useState("update");

  // Sample parsed rows
  const [parsedRows] = useState([
    { row: 1, claimNumber: "MC-008", workPerformed: 2400000000, measured: 2200000000, claimed: 2000000000, status: "valid", error: null },
    { row: 2, claimNumber: "MC-009", workPerformed: 1800000000, measured: 1800000000, claimed: 1800000000, status: "valid", error: null },
    { row: 3, claimNumber: "MC-INVALID", workPerformed: -500000, measured: 0, claimed: 0, status: "error", error: language === "id" ? "Nilai finansial tidak boleh negatif." : "Financial value cannot be negative." },
  ]);

  const [importSummary, setImportSummary] = useState<{ total: number; valid: number; failed: number } | null>(null);

  const handleDownloadTemplate = (type: "claims" | "projects" | "invoices" | "contracts") => {
    let headers = "";
    let sampleData = "";
    let downloadName = "";

    if (type === "claims") {
      downloadName = "COVE_Template_Claims.csv";
      headers = "ProjectCode,ClaimNumber,PeriodStart,PeriodEnd,WorkPerformed,MeasuredValue,ClaimedValue,CertifiedValue,ExpectedCashDate\n";
      sampleData =
        "PRJ-MERIDIAN-01,MC-007,2026-08-01,2026-08-31,2500000000,2400000000,2200000000,2000000000,2026-09-30\n" +
        "PRJ-LOGISTIC-02,MC-004,2026-08-01,2026-08-31,1600000000,1600000000,1500000000,1500000000,2026-09-25\n";
    } else if (type === "projects") {
      downloadName = "COVE_Template_Projects.csv";
      headers = "ProjectCode,ProjectName,ClientName,ContractValue,RetentionPercent,StartDate,FinishDate\n";
      sampleData = "PRJ-SBY-01,Pembangunan Jembatan Tol,PT Marga Nusantara,45000000000,5,2026-01-01,2026-12-31\n";
    } else if (type === "invoices") {
      downloadName = "COVE_Template_Invoices.csv";
      headers = "InvoiceNumber,ProjectCode,ClaimNumber,IssueDate,DueDate,GrossAmount,RetentionAmount,NetReceivable\n";
      sampleData = "INV-2026-001,PRJ-MERIDIAN-01,MC-006,2026-08-20,2026-09-20,2750000000,137500000,2612500000\n";
    } else {
      downloadName = "COVE_Template_Contracts.csv";
      headers = "ContractNumber,ProjectCode,ContractTitle,ContractValue,PaymentMethod,PaymentTermsDays\n";
      sampleData = "CTR-2026-001,PRJ-MERIDIAN-01,Kontrak Pekerjaan Struktur,48500000000,Monthly Progress,30\n";
    }

    const csvContent = "data:text/csv;charset=utf-8," + headers + sampleData;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", downloadName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExecuteImport = () => {
    const validCount = parsedRows.filter((r) => r.status === "valid").length;
    const failedCount = parsedRows.filter((r) => r.status === "error").length;

    // Add valid claim into store
    for (const r of parsedRows.filter((r) => r.status === "valid")) {
      coveStore.createClaim({
        projectId: coveStore.projects[0].id,
        contractId: coveStore.contracts[0].id,
        claimNumber: r.claimNumber,
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        description: `Imported claim ${r.claimNumber}`,
        currentStage: "CLAIM_PREPARATION",
        riskLevel: "HEALTHY",
        workPerformedValue: r.workPerformed,
        measuredValue: r.measured,
        claimedValue: r.claimed,
        certifiedValue: 0,
        expectedNetCollectible: r.claimed * 0.95,
        cashReceivedValue: 0,
        expectedCashDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        responsibleOwnerId: "usr-andi",
        sourceType: "xlsx_import",
        sourceReference: `EXT-IMPORT-${r.claimNumber}`,
      });
    }

    setImportSummary({ total: parsedRows.length, valid: validCount, failed: failedCount });
    setStep(4);
    refreshState();
  };

  const handleDownloadErrors = () => {
    const errorRows = parsedRows.filter((r) => r.status === "error");
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Row,ClaimNumber,ErrorReason"]
        .concat(errorRows.map((e) => `${e.row},${e.claimNumber},"${e.error}"`))
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Import_Errors_${new Date().toISOString().split("T")[0]}.csv`);
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
              {t("data.title", "Pusat Data & Impor")}
            </h1>
            <span className="text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
              {t("data.tag", "Mesin Adopsi")}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {t("data.subtitle", "Import massal berkas XLSX/CSV (Klaim, Proyek, Faktur, Pembayaran) dengan validasi aman")}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="imports">{t("data.tab.imports", "Pusat Impor (Wizard)")}</TabsTrigger>
          <TabsTrigger value="templates">{t("data.tab.templates", "Unduh Template")}</TabsTrigger>
          <TabsTrigger value="exports">{t("data.tab.exports", "Ekspor Massal")}</TabsTrigger>
          <TabsTrigger value="sources">{t("data.tab.sources", "Sumber Data & Keterkinian")}</TabsTrigger>
        </TabsList>

        {/* 1. IMPORTS WIZARD TAB */}
        <TabsContent value="imports" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {/* Step Indicators */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6 text-xs font-semibold">
              <span className={step >= 1 ? "text-slate-900 font-bold" : "text-slate-400"}>{t("data.step1", "1. Pilih Entitas & Berkas")}</span>
              <span className="text-slate-300">→</span>
              <span className={step >= 2 ? "text-slate-900 font-bold" : "text-slate-400"}>{t("data.step2", "2. Pemetaan Kolom")}</span>
              <span className="text-slate-300">→</span>
              <span className={step >= 3 ? "text-slate-900 font-bold" : "text-slate-400"}>{t("data.step3", "3. Pratinjau Validasi")}</span>
              <span className="text-slate-300">→</span>
              <span className={step >= 4 ? "text-emerald-700 font-bold" : "text-slate-400"}>{t("data.step4", "4. Ringkasan")}</span>
            </div>

            {/* STEP 1: ENTITY & FILE SELECTION */}
            {step === 1 && (
              <div className="space-y-6 max-w-xl">
                <div>
                  <Label htmlFor="entity">{t("data.entity_select", "Pilih Jenis Entitas yang Diimpor")}</Label>
                  <Select id="entity" value={selectedEntity} onChange={(e) => setSelectedEntity(e.target.value)} className="mt-1">
                    <option value="claims">{t("data.entity.claims", "Klaim Progres (Fisik, Opname, Pengajuan, BAP)")}</option>
                    <option value="projects">{t("data.entity.projects", "Master Proyek")}</option>
                    <option value="contracts">{t("data.entity.contracts", "Kontrak Proyek")}</option>
                    <option value="invoices">{t("data.entity.invoices", "Faktur Tagihan / Invoice")}</option>
                    <option value="receipts">{t("data.entity.receipts", "Penerimaan Kas / Pembayaran Masuk")}</option>
                  </Select>
                </div>

                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50">
                  <FileSpreadsheet className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                  <span className="text-sm font-bold text-slate-900 block">{fileName}</span>
                  <span className="text-xs text-slate-500 block mt-1">{t("data.supported_formats", "Format didukung: XLSX, XLS, CSV (Maks 10MB)")}</span>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" className="text-xs">
                      {t("data.choose_another_file", "Pilih Berkas Lain")}
                    </Button>
                    <Button size="sm" className="bg-slate-900 text-xs font-semibold" onClick={() => setStep(2)}>
                      {t("data.proceed_to_mapping", "Lanjut ke Pemetaan")}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: COLUMN MAPPING */}
            {step === 2 && (
              <div className="space-y-6 max-w-2xl text-xs">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 font-medium">
                  {language === "id" ? "Kolom spreadsheet Anda terdeteksi otomatis. Silakan periksa kesesuaian mapping:" : "Your spreadsheet columns were automatically detected. Please verify mapping:"}
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 items-center p-2 rounded bg-slate-50">
                    <span className="font-semibold text-slate-700">Claim Number (Kode Klaim)</span>
                    <span className="font-mono text-slate-900 bg-white p-1.5 rounded border">Column A: &quot;Nomor_MC&quot;</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 items-center p-2 rounded bg-slate-50">
                    <span className="font-semibold text-slate-700">Work Performed (Nilai Fisik)</span>
                    <span className="font-mono text-slate-900 bg-white p-1.5 rounded border">Column B: &quot;Nilai_Fisik_IDR&quot;</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 items-center p-2 rounded bg-slate-50">
                    <span className="font-semibold text-slate-700">Measured Value (Nilai Opname)</span>
                    <span className="font-mono text-slate-900 bg-white p-1.5 rounded border">Column C: &quot;Volume_Opname_IDR&quot;</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 items-center p-2 rounded bg-slate-50">
                    <span className="font-semibold text-slate-700">Claimed Value (Pengajuan)</span>
                    <span className="font-mono text-slate-900 bg-white p-1.5 rounded border">Column D: &quot;Nilai_Klaim_Diajukan&quot;</span>
                  </div>
                </div>

                <div>
                  <Label>{language === "id" ? "Idempotency: Penanganan Duplikasi Source Reference" : "Idempotency: Handling Duplicate Source References"}</Label>
                  <Select value={duplicateStrategy} onChange={(e) => setDuplicateStrategy(e.target.value)} className="mt-1">
                    <option value="update">{language === "id" ? "Update Existing (Perbarui data jika referensi sama)" : "Update Existing (Overwrite if reference matches)"}</option>
                    <option value="skip">{language === "id" ? "Skip (Abaikan baris jika sudah ada)" : "Skip (Ignore if row already exists)"}</option>
                    <option value="create_new">{language === "id" ? "Create New (Buat baris baru)" : "Create New (Insert new record)"}</option>
                  </Select>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <Button variant="outline" onClick={() => setStep(1)}>{t("data.back", "Kembali")}</Button>
                  <Button className="bg-slate-900 font-bold" onClick={() => setStep(3)}>{t("data.validate_and_preview", "Validasi & Pratinjau")}</Button>
                </div>
              </div>
            )}

            {/* STEP 3: VALIDATION PREVIEW */}
            {step === 3 && (
              <div className="space-y-6 text-xs">
                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <div>
                    <span className="font-bold text-slate-900 block text-sm">{language === "id" ? "Hasil Validasi Pra-Impor" : "Pre-Import Validation Results"}</span>
                    <span className="text-slate-500">{language === "id" ? "2 baris valid siap diimpor, 1 baris mengandung error data." : "2 valid rows ready to import, 1 row contains errors."}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">2 Valid</span>
                    <span className="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded">1 Error</span>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                        <th className="py-2.5 px-3">Row #</th>
                        <th className="py-2.5 px-3">Claim #</th>
                        <th className="py-2.5 px-3">{t("p2c.summary.work_performed", "Work Performed")}</th>
                        <th className="py-2.5 px-3">{t("p2c.summary.measured", "Measured")}</th>
                        <th className="py-2.5 px-3">{t("p2c.summary.claimed", "Claimed")}</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Error Diagnosis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRows.map((r) => (
                        <tr key={r.row} className={r.status === "error" ? "bg-red-50/50" : ""}>
                          <td className="py-2.5 px-3 font-mono">{r.row}</td>
                          <td className="py-2.5 px-3 font-bold font-mono">{r.claimNumber}</td>
                          <td className="py-2.5 px-3 font-mono">{formatIDR(r.workPerformed)}</td>
                          <td className="py-2.5 px-3 font-mono">{formatIDR(r.measured)}</td>
                          <td className="py-2.5 px-3 font-mono">{formatIDR(r.claimed)}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${r.status === "valid" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-red-700 font-medium">{r.error || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <Button variant="outline" onClick={() => setStep(2)}>{t("data.back", "Kembali")}</Button>
                  <Button className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold" onClick={handleExecuteImport}>
                    {language === "id" ? "Konfirmasi Impor Baris Valid (2 Baris)" : "Confirm Import Valid Rows (2 Rows)"}
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 4: SUMMARY */}
            {step === 4 && importSummary && (
              <div className="space-y-6 text-center py-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mx-auto">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{language === "id" ? "Impor Berhasil Diselesaikan" : "Import Successfully Completed"}</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    {language === "id" 
                      ? `${importSummary.valid} data berhasil disimpan ke dalam database. Data finansial telah terupdate di Command Center.` 
                      : `${importSummary.valid} records successfully saved to database. Financial metrics updated in Command Center.`}
                  </p>
                </div>

                <div className="flex items-center justify-center gap-4">
                  {importSummary.failed > 0 && (
                    <Button variant="outline" size="sm" onClick={handleDownloadErrors} className="text-xs text-red-700 border-red-200 bg-red-50 hover:bg-red-100 gap-1.5">
                      <Download className="h-3.5 w-3.5" />
                      <span>{language === "id" ? `Download ${importSummary.failed} Baris Gagal (CSV)` : `Download ${importSummary.failed} Failed Rows (CSV)`}</span>
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setStep(1)} className="bg-slate-900 text-xs font-semibold">
                    {t("data.import_another", "Impor Berkas Lain")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* 2. DOWNLOAD TEMPLATES TAB */}
        <TabsContent value="templates" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {language === "id" ? "Template Standar Impor COVE (Kontraktor Indonesia)" : "Standard COVE Import Templates (Indonesian Contractors)"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === "id" ? "Download file format CSV/Excel siap pakai dengan contoh data riil untuk memudahkan tim QS dan Keuangan memasukkan data" : "Download ready-to-use CSV/Excel template files with real sample data for QS and Finance teams"}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
                <div>
                  <span className="font-bold text-slate-900 text-xs block">
                    {language === "id" ? "Template 1: Klaim Progres (Claims)" : "Template 1: Progress Claims"}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Kolom: ProjectCode, ClaimNumber, Period, WorkPerformed, Measured, Claimed, Certified, ExpectedCashDate
                  </span>
                </div>
                <Button onClick={() => handleDownloadTemplate("claims")} variant="outline" size="sm" className="mt-4 text-xs font-semibold gap-1.5 bg-white">
                  <Download className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Download Template Claims (CSV)</span>
                </Button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
                <div>
                  <span className="font-bold text-slate-900 text-xs block">
                    {language === "id" ? "Template 2: Master Proyek (Projects)" : "Template 2: Projects Master"}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Kolom: ProjectCode, ProjectName, ClientName, ContractValue, RetentionPercent, StartDate, FinishDate
                  </span>
                </div>
                <Button onClick={() => handleDownloadTemplate("projects")} variant="outline" size="sm" className="mt-4 text-xs font-semibold gap-1.5 bg-white">
                  <Download className="h-3.5 w-3.5 text-blue-600" />
                  <span>Download Template Projects (CSV)</span>
                </Button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
                <div>
                  <span className="font-bold text-slate-900 text-xs block">
                    {language === "id" ? "Template 3: Faktur Tagihan (Invoices)" : "Template 3: Invoices & Billing"}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Kolom: InvoiceNumber, ProjectCode, ClaimNumber, IssueDate, DueDate, GrossAmount, Retention, NetReceivable
                  </span>
                </div>
                <Button onClick={() => handleDownloadTemplate("invoices")} variant="outline" size="sm" className="mt-4 text-xs font-semibold gap-1.5 bg-white">
                  <Download className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Download Template Invoices (CSV)</span>
                </Button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
                <div>
                  <span className="font-bold text-slate-900 text-xs block">
                    {language === "id" ? "Template 4: Master Kontrak (Contracts)" : "Template 4: Contracts Master"}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Kolom: ContractNumber, ProjectCode, ContractTitle, ContractValue, PaymentMethod, PaymentTermsDays
                  </span>
                </div>
                <Button onClick={() => handleDownloadTemplate("contracts")} variant="outline" size="sm" className="mt-4 text-xs font-semibold gap-1.5 bg-white">
                  <Download className="h-3.5 w-3.5 text-amber-600" />
                  <span>Download Template Contracts (CSV)</span>
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 3. BULK EXPORTS TAB */}
        <TabsContent value="exports" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900">{language === "id" ? "Download Data Portofolio" : "Export Portfolio Data"}</h3>
            <p className="text-xs text-slate-500">
              {language === "id" ? "Ekspor seluruh master data dan riwayat keuangan proyek ke format CSV/XLSX untuk integrasi lokal" : "Export all master data and financial history to CSV/XLSX format for local records"}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-col justify-between">
                <div>
                  <span className="font-bold text-slate-900 block text-xs">{language === "id" ? "Master Semua Klaim" : "All Claims Master"}</span>
                  <span className="text-[11px] text-slate-500">{language === "id" ? "Termasuk rincian progress, gaps, dan stage" : "Includes progress details, gaps, and stages"}</span>
                </div>
                <Button onClick={() => handleDownloadTemplate("claims")} variant="outline" size="sm" className="mt-4 text-xs font-semibold gap-1">
                  <Download className="h-3 w-3" />
                  <span>Download CSV</span>
                </Button>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-col justify-between">
                <div>
                  <span className="font-bold text-slate-900 block text-xs">{language === "id" ? "Faktur & Kas Masuk" : "Invoices & Receipts"}</span>
                  <span className="text-[11px] text-slate-500">{language === "id" ? "Rekonsiliasi faktur dan kas masuk" : "Reconciliation of billings and inflows"}</span>
                </div>
                <Button onClick={() => handleDownloadTemplate("invoices")} variant="outline" size="sm" className="mt-4 text-xs font-semibold gap-1">
                  <Download className="h-3 w-3" />
                  <span>Download CSV</span>
                </Button>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-col justify-between">
                <div>
                  <span className="font-bold text-slate-900 block text-xs">{language === "id" ? "Log Jejak Audit Lengkap" : "Full Audit Trail Log"}</span>
                  <span className="text-[11px] text-slate-500">{language === "id" ? "Semua perubahan status keuangan" : "All financial status changes"}</span>
                </div>
                <Button onClick={() => handleDownloadTemplate("projects")} variant="outline" size="sm" className="mt-4 text-xs font-semibold gap-1">
                  <Download className="h-3 w-3" />
                  <span>Download CSV</span>
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 4. DATA SOURCES TAB */}
        <TabsContent value="sources" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900">{language === "id" ? "Keterkinian & Pelacakan Sumber Data" : "Data Freshness & Source Tracking"}</h3>
            <p className="text-xs text-slate-500">
              {language === "id" ? "Audit sumber data dan status keterkinian data ekonomi portofolio" : "Audit data origins and freshness status for portfolio economic metrics"}
            </p>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden text-xs">
              <div className="p-3.5 flex justify-between items-center bg-slate-50">
                <span className="font-bold text-slate-700">{language === "id" ? "Tipe Sumber" : "Source Type"}</span>
                <span className="font-bold text-slate-700">{language === "id" ? "Pembaruan Terakhir" : "Last Update"}</span>
                <span className="font-bold text-slate-700">{language === "id" ? "Status Keterkinian" : "Freshness Status"}</span>
              </div>
              <div className="p-3.5 flex justify-between items-center">
                <span>Grand Meridian MC-006 ({language === "id" ? "Manual" : "Manual"})</span>
                <span className="font-mono text-slate-500">{language === "id" ? "2 jam lalu" : "2 hours ago"}</span>
                <span className="bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">Fresh (≤24h)</span>
              </div>
              <div className="p-3.5 flex justify-between items-center">
                <span>Graha Sentosa MC-002 (XLSX Import)</span>
                <span className="font-mono text-slate-500">{language === "id" ? "3 hari lalu" : "3 days ago"}</span>
                <span className="bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-200">{language === "id" ? "Perlu Pembaruan" : "Needs Update"}</span>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
