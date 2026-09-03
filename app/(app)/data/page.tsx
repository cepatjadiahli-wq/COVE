"use client";

import React, { useState, useRef } from "react";
import { formatIDR } from "@/lib/utils";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  CANONICAL_CLAIM_FIELDS,
  extractSheetsFromWorkbook,
  parseSheetData,
  parseCsvText,
  autoDetectColumnMapping,
  validateImportRows,
  computeDeltaVersioning,
  generateErrorRowsCsv,
  calculateSimpleChecksum,
  ImportValidationResult,
  DeltaResult,
} from "@/domains/imports/service";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Download,
  RotateCcw,
  History,
  Layers,
  FileText,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Bookmark,
  Check,
} from "lucide-react";

export default function DataCenterPage() {
  const { refreshState, currentUser } = useTenant();
  const { t, language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState("imports");

  // Selected project for this import
  const [selectedProjectId, setSelectedProjectId] = useState(coveStore.projects[0]?.id || "");
  const selectedProject = coveStore.projects.find((p) => p.id === selectedProjectId) || coveStore.projects[0];

  // Wizard Step (1: Upload & Sheet, 2: Mapping, 3: Validation & Reconciliation, 4: Summary)
  const [step, setStep] = useState(1);

  // File & Raw Data State
  const [fileObject, setFileObject] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileSizeBytes, setFileSizeBytes] = useState(0);
  const [fileChecksum, setFileChecksum] = useState("");
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");

  // Duplicate File Detection Alert (IMP-009, UAT-03)
  const [duplicateFound, setDuplicateFound] = useState<any | null>(null);

  // Raw Matrix & Headers (IMP-002)
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[][]>([]);

  // Column Mapping (IMP-003, IMP-004)
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [newTemplateName, setNewTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // Validation & Reconciliation Results (IMP-005, IMP-006, IMP-010)
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [deltaResult, setDeltaResult] = useState<DeltaResult | null>(null);
  const [previewTab, setPreviewTab] = useState<"valid" | "rejected" | "delta">("valid");

  // Commit Summary
  const [committedBatch, setCommittedBatch] = useState<any | null>(null);

  // Rollback Modal State (IMP-013)
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [batchToRollback, setBatchToRollback] = useState<any | null>(null);
  const [rollbackReason, setRollbackReason] = useState("");

  // ---------------------------------------------------------------------------
  // Step 1: File Upload & Sheet Detection (IMP-001, IMP-008, IMP-009)
  // ---------------------------------------------------------------------------
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileObject(file);
    setFileName(file.name);
    setFileSizeBytes(file.size);

    const reader = new FileReader();

    if (file.name.endsWith(".csv")) {
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const checksum = calculateSimpleChecksum(text);
        setFileChecksum(checksum);

        // Duplicate Check
        const existingDuplicate = coveStore.checkDuplicateFile(checksum, selectedProjectId);
        setDuplicateFound(existingDuplicate || null);

        const { headers, rows } = parseCsvText(text);
        setRawHeaders(headers);
        setRawRows(rows);
        setAvailableSheets(["CSV Default"]);
        setSelectedSheet("CSV Default");

        // Auto map columns
        const autoMap = autoDetectColumnMapping(headers);
        setColumnMapping(autoMap);
      };
      reader.readAsText(file);
    } else {
      // XLSX / XLS
      reader.onload = (event) => {
        const buffer = event.target?.result as ArrayBuffer;
        setFileBuffer(buffer);

        const checksum = calculateSimpleChecksum(buffer);
        setFileChecksum(checksum);

        // Duplicate Check (UAT-03)
        const existingDuplicate = coveStore.checkDuplicateFile(checksum, selectedProjectId);
        setDuplicateFound(existingDuplicate || null);

        const { sheetNames, defaultSheet } = extractSheetsFromWorkbook(buffer);
        setAvailableSheets(sheetNames);
        setSelectedSheet(defaultSheet);

        const { headers, rows } = parseSheetData(buffer, defaultSheet);
        setRawHeaders(headers);
        setRawRows(rows);

        // Auto map columns
        const autoMap = autoDetectColumnMapping(headers);
        setColumnMapping(autoMap);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleSheetChange = (sheet: string) => {
    setSelectedSheet(sheet);
    if (!fileBuffer) return;

    const { headers, rows } = parseSheetData(fileBuffer, sheet);
    setRawHeaders(headers);
    setRawRows(rows);
    const autoMap = autoDetectColumnMapping(headers);
    setColumnMapping(autoMap);
  };

  // ---------------------------------------------------------------------------
  // Step 2: Mapping & Template Handling (IMP-003, IMP-004)
  // ---------------------------------------------------------------------------
  const handleMapField = (canonicalKey: string, sourceHeader: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [canonicalKey]: sourceHeader,
    }));
  };

  const handleApplyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = coveStore.importTemplates.find((t) => t.id === templateId);
    if (template) {
      setColumnMapping({ ...template.columnMapping });
    }
  };

  const handleSaveAsTemplate = () => {
    if (!newTemplateName.trim()) {
      alert("Nama template wajib diisi.");
      return;
    }

    coveStore.saveImportTemplate(
      {
        templateName: newTemplateName.trim(),
        entityType: "claims",
        columnMapping,
      },
      currentUser.fullName
    );
    alert(`Template "${newTemplateName}" berhasil disimpan.`);
    setNewTemplateName("");
    refreshState();
  };

  // ---------------------------------------------------------------------------
  // Step 3: Run Validation & Delta Reconciliation (IMP-005, IMP-006, IMP-010)
  // ---------------------------------------------------------------------------
  const handleProceedToValidation = () => {
    if (rawRows.length === 0) {
      alert("Tidak ada baris data yang terdeteksi dari berkas.");
      return;
    }

    // Run row-by-row validator
    const valResult = validateImportRows(rawRows, rawHeaders, columnMapping);
    setValidationResult(valResult);

    // Run delta comparison against existing project claims
    const existingClaims = coveStore.claims.filter((c) => c.projectId === selectedProjectId);
    const delta = computeDeltaVersioning(valResult.validRows, existingClaims);
    setDeltaResult(delta);

    setStep(3);
  };

  // ---------------------------------------------------------------------------
  // Step 4: Commit Import Batch (IMP-012)
  // ---------------------------------------------------------------------------
  const handleCommitImport = () => {
    if (!validationResult || validationResult.validRows.length === 0) {
      alert("Tidak ada baris valid untuk diimpor.");
      return;
    }

    const { importBatch } = coveStore.commitImportBatch(
      {
        projectId: selectedProjectId,
        fileName,
        fileSizeBytes,
        fileChecksum,
        sheetName: selectedSheet,
        mappingTemplateId: selectedTemplateId || undefined,
        validatedRows: validationResult.validRows,
        rejectedRowsCount: validationResult.rejectedRows.length,
        rejectedValue: validationResult.reconciliation.rejectedValue,
        notes: `Import berkas ${fileName} untuk proyek ${selectedProject.projectName}`,
      },
      `${currentUser.fullName} (${currentUser.role})`
    );

    setCommittedBatch(importBatch);
    setStep(4);
    refreshState();
  };

  // Atomic cancellation (IMP-012)
  const handleCancelImport = () => {
    setFileObject(null);
    setFileBuffer(null);
    setFileName("");
    setRawHeaders([]);
    setRawRows([]);
    setColumnMapping({});
    setValidationResult(null);
    setDeltaResult(null);
    setDuplicateFound(null);
    setStep(1);
  };

  // Download error rows as CSV (IMP-007)
  const handleDownloadErrors = () => {
    if (!validationResult || validationResult.rejectedRows.length === 0) return;

    const csvContent = generateErrorRowsCsv(validationResult.rejectedRows);
    const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Baris_Gagal_Import_${fileName.replace(/\.[^/.]+$/, "")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Rollback batch handler (IMP-013)
  const handleRollbackBatch = () => {
    if (!batchToRollback) return;
    if (!rollbackReason.trim()) {
      alert("Alasan pembatalan (rollback) wajib diisi untuk integritas jejak audit.");
      return;
    }

    coveStore.rollbackImportBatch(batchToRollback.id, rollbackReason.trim(), `${currentUser.fullName} (${currentUser.role})`);
    setRollbackModalOpen(false);
    setBatchToRollback(null);
    setRollbackReason("");
    refreshState();
  };

  // Download CSV Templates
  const handleDownloadSampleTemplate = (type: "claims" | "projects" | "invoices") => {
    let headers = "";
    let sampleData = "";
    let downloadName = "";

    if (type === "claims") {
      downloadName = "COVE_Template_Claims.csv";
      headers = "Kode_Proyek,Nomor_MC,Tanggal_Mulai,Tanggal_Selesai,Nilai_Fisik_IDR,Volume_Opname_IDR,Nilai_Klaim_Diajukan,Nilai_Disahkan_BAP,Target_Cair,Alasan_Penyesuaian\n";
      sampleData =
        "PRJ-MERIDIAN-01,MC-007,2026-08-01,2026-08-31,2500000000,2400000000,2200000000,2000000000,2026-09-30,\n" +
        "PRJ-MERIDIAN-01,MC-008,2026-09-01,2026-09-30,1800000000,1800000000,1750000000,0,2026-10-31,\n";
    } else if (type === "projects") {
      downloadName = "COVE_Template_Projects.csv";
      headers = "ProjectCode,ProjectName,ClientName,ContractValue,RetentionPercent,StartDate,FinishDate\n";
      sampleData = "PRJ-SBY-01,Pembangunan Jembatan Tol,PT Marga Nusantara,45000000000,5,2026-01-01,2026-12-31\n";
    } else {
      downloadName = "COVE_Template_Invoices.csv";
      headers = "InvoiceNumber,ProjectCode,ClaimNumber,IssueDate,DueDate,GrossAmount,RetentionAmount,NetReceivable\n";
      sampleData = "INV-2026-001,PRJ-MERIDIAN-01,MC-006,2026-08-20,2026-09-20,2750000000,137500000,2612500000\n";
    }

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + sampleData);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", downloadName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {language === "id" ? "Pusat Data & Import Engine" : "Data Center & Import Engine"}
            </h1>
            <span className="text-xs font-bold bg-blue-900 text-white px-2 py-0.5 rounded">
              Modul 1 (PRD v1.0)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pintu masuk data Progress-to-Cash berbasis Excel/CSV tanpa re-keying manual, dilengkapi deteksi sheet dinamis,
            pencegahan duplikasi, rekonsiliasi total, dan pelacakan delta.
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 p-1 border border-slate-200 rounded-lg">
          <TabsTrigger value="imports" className="flex items-center gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            <span>Wizard Impor Berkas</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" />
            <span>Riwayat Batch ({coveStore.sourceImports.length})</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            <span>Template Pemetaan ({coveStore.importTemplates.length})</span>
          </TabsTrigger>
          <TabsTrigger value="downloads" className="flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" />
            <span>Unduh Format Kosong</span>
          </TabsTrigger>
        </TabsList>

        {/* 1. IMPORT WIZARD TAB */}
        <TabsContent value="imports" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
            {/* Step Indicators */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 text-xs font-semibold">
              <span className={step >= 1 ? "text-slate-900 font-bold" : "text-slate-400"}>
                1. Pilih Proyek &amp; Berkas XLSX/CSV
              </span>
              <span className="text-slate-300">&rarr;</span>
              <span className={step >= 2 ? "text-slate-900 font-bold" : "text-slate-400"}>
                2. Pemetaan Kolom (Mapping)
              </span>
              <span className="text-slate-300">&rarr;</span>
              <span className={step >= 3 ? "text-slate-900 font-bold" : "text-slate-400"}>
                3. Validasi, Rekonsiliasi &amp; Delta
              </span>
              <span className="text-slate-300">&rarr;</span>
              <span className={step >= 4 ? "text-emerald-700 font-bold" : "text-slate-400"}>
                4. Hasil Komit &amp; Lineage
              </span>
            </div>

            {/* STEP 1: UPLOAD & SHEET DETECTION */}
            {step === 1 && (
              <div className="space-y-6 max-w-2xl text-xs">
                <div>
                  <Label htmlFor="targetProject">Proyek Konstruksi Target *</Label>
                  <Select
                    id="targetProject"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="mt-1"
                  >
                    {coveStore.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectName} ({p.projectCode})
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Upload Box */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-xl p-8 text-center bg-slate-50 cursor-pointer transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileSelected}
                  />
                  <FileSpreadsheet className="h-10 w-10 text-blue-600 mx-auto mb-2" />
                  {fileName ? (
                    <div>
                      <span className="text-sm font-bold text-slate-900 block">{fileName}</span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        {(fileSizeBytes / 1024).toFixed(1)} KB • Checksum: {fileChecksum.substring(0, 16)}...
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-sm font-bold text-slate-900 block">
                        Klik untuk Memilih Berkas Tracker Excel (.xlsx) atau CSV
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-1">
                        Format didukung: XLSX, XLS, CSV (Maksimal 20 MB / 5.000 baris per batch)
                      </span>
                    </div>
                  )}
                </div>

                {/* Duplicate Prevention Alert (UAT-03) */}
                {duplicateFound && (
                  <div className="p-4 bg-red-50 border border-red-300 rounded-lg text-red-900 space-y-1">
                    <div className="flex items-center gap-2 font-bold">
                      <ShieldAlert className="h-4 w-4 text-red-700" />
                      <span>Peringatan Duplikasi Berkas (UAT-03)!</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Berkas dengan isi identik (SHA-256: <code className="font-mono">{fileChecksum.substring(0, 12)}...</code>) telah diimpor pada{" "}
                      <strong>{new Date(duplicateFound.uploadedAt).toLocaleString("id-ID")}</strong> oleh {duplicateFound.uploadedBy}.
                      Sistem mencegah duplikasi data klaim agar tidak menggelembungkan metrik Cash-at-Risk.
                    </p>
                  </div>
                )}

                {/* Dynamic Sheet Selector (IMP-001) */}
                {availableSheets.length > 1 && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <Label htmlFor="sheetSelect">Pilih Lembar Kerja (Worksheet) yang Akan Diimpor *</Label>
                    <Select
                      id="sheetSelect"
                      value={selectedSheet}
                      onChange={(e) => handleSheetChange(e.target.value)}
                      className="bg-white"
                    >
                      {availableSheets.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}

                {/* Preview First Rows */}
                {rawRows.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        Pratinjau Data Mentah (Terdeteksi {rawRows.length} baris, {rawHeaders.length} kolom)
                      </span>
                      <span className="text-[11px] text-slate-500">Menampilkan 5 baris pertama</span>
                    </div>
                    <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-48 text-[11px]">
                      <table className="w-full text-left">
                        <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase">
                          <tr>
                            {rawHeaders.map((h, i) => (
                              <th key={i} className="py-2 px-3 whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {rawRows.slice(0, 5).map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50">
                              {row.map((c, cIdx) => (
                                <td key={cIdx} className="py-1.5 px-3 whitespace-nowrap font-mono text-slate-700">
                                  {String(c || "")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    disabled={rawRows.length === 0}
                    onClick={() => setStep(2)}
                    className="bg-slate-900 text-white font-bold gap-1.5"
                  >
                    <span>Lanjut ke Pemetaan Kolom</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: COLUMN MAPPING & TEMPLATES (IMP-003, IMP-004) */}
            {step === 2 && (
              <div className="space-y-6 max-w-3xl text-xs">
                {/* Template Selection */}
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-slate-900 block">Pilih Template Pemetaan Kontraktor (Opsional)</span>
                    <span className="text-[11px] text-slate-600">Gunakan aturan mapping yang telah disimpan sebelumnya</span>
                  </div>
                  <Select
                    value={selectedTemplateId}
                    onChange={(e) => handleApplyTemplate(e.target.value)}
                    className="bg-white max-w-xs"
                  >
                    <option value="">-- Pilih Template Tersimpan --</option>
                    {coveStore.importTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.templateName}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Mapping Grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-bold text-slate-900">Kolom Standar COVE (Canonical)</span>
                    <span className="font-bold text-slate-900">Kolom Sumber di Berkas Anda</span>
                  </div>

                  {CANONICAL_CLAIM_FIELDS.map((field) => (
                    <div
                      key={field.key}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center p-2.5 rounded-lg bg-slate-50 border border-slate-200"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">{field.label}</span>
                          {field.required && <span className="text-red-600 font-bold">*</span>}
                        </div>
                        <span className="text-[10px] text-slate-500 block">{field.description}</span>
                      </div>

                      <div>
                        <Select
                          value={columnMapping[field.key] || ""}
                          onChange={(e) => handleMapField(field.key, e.target.value)}
                          className="bg-white"
                        >
                          <option value="">-- Lewati Kolom Ini --</option>
                          {rawHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Save Current Mapping as Template */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3">
                  <Input
                    placeholder="Beri nama template ini (contoh: Format Tracker Wika 2026)"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    className="bg-white text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveAsTemplate}
                    className="shrink-0 text-xs font-semibold gap-1"
                  >
                    <Bookmark className="h-3.5 w-3.5 text-blue-600" />
                    <span>Simpan Template</span>
                  </Button>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <Button variant="outline" onClick={() => setStep(1)} className="gap-1">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Kembali</span>
                  </Button>
                  <Button onClick={handleProceedToValidation} className="bg-slate-900 text-white font-bold gap-1.5">
                    <span>Validasi &amp; Rekonsiliasi</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: VALIDATION, RECONCILIATION & DELTA (IMP-005, IMP-006, IMP-010) */}
            {step === 3 && validationResult && (
              <div className="space-y-6 text-xs">
                {/* Reconciliation KPI Banner (IMP-006) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase block">Total Nilai Sumber (Source)</span>
                    <span className="text-base font-black font-mono text-slate-900 mt-1 block">
                      {formatIDR(validationResult.reconciliation.totalSourceValue)}
                    </span>
                    <span className="text-[10px] text-slate-500">{validationResult.reconciliation.totalSourceRows} baris terdeteksi</span>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[11px] font-semibold text-emerald-800 uppercase block">Nilai Diterima (Accepted)</span>
                    <span className="text-base font-black font-mono text-emerald-700 mt-1 block">
                      {formatIDR(validationResult.reconciliation.acceptedValue)}
                    </span>
                    <span className="text-[10px] text-emerald-600">{validationResult.validRows.length} baris lolos validasi</span>
                  </div>

                  <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                    <span className="text-[11px] font-semibold text-red-800 uppercase block">Nilai Ditolak (Rejected)</span>
                    <span className="text-base font-black font-mono text-red-700 mt-1 block">
                      {formatIDR(validationResult.reconciliation.rejectedValue)}
                    </span>
                    <span className="text-[10px] text-red-600">{validationResult.rejectedRows.length} baris gagal format</span>
                  </div>

                  <div
                    className={`p-4 rounded-xl border ${
                      validationResult.reconciliation.reconciliationVariance === 0
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-amber-50 text-amber-900 border-amber-300"
                    }`}
                  >
                    <span className="text-[11px] font-semibold uppercase block opacity-80">Selisih Rekonsiliasi (Variance)</span>
                    <span className="text-base font-black font-mono mt-1 block">
                      {formatIDR(validationResult.reconciliation.reconciliationVariance)}
                    </span>
                    <span className="text-[10px] opacity-80">
                      {validationResult.reconciliation.reconciliationVariance === 0
                        ? "Rekonsiliasi Seimbang (100% Cocok)"
                        : "Selisih terdeteksi akibat baris gagal"}
                    </span>
                  </div>
                </div>

                {/* Sub-tabs for Rows & Delta */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={previewTab === "valid" ? "default" : "outline"}
                        onClick={() => setPreviewTab("valid")}
                        className="text-xs font-semibold"
                      >
                        Baris Valid ({validationResult.validRows.length})
                      </Button>
                      <Button
                        size="sm"
                        variant={previewTab === "rejected" ? "default" : "outline"}
                        onClick={() => setPreviewTab("rejected")}
                        className="text-xs font-semibold text-red-700 border-red-200"
                      >
                        Baris Gagal ({validationResult.rejectedRows.length})
                      </Button>
                      <Button
                        size="sm"
                        variant={previewTab === "delta" ? "default" : "outline"}
                        onClick={() => setPreviewTab("delta")}
                        className="text-xs font-semibold"
                      >
                        Pelacakan Delta ({deltaResult ? deltaResult.added.length + deltaResult.changed.length : 0})
                      </Button>
                    </div>

                    {validationResult.rejectedRows.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDownloadErrors}
                        className="text-xs font-semibold text-red-700 border-red-200 bg-red-50 hover:bg-red-100 gap-1.5"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Unduh Baris Gagal (CSV)</span>
                      </Button>
                    )}
                  </div>

                  {/* 1. VALID ROWS TABLE */}
                  {previewTab === "valid" && (
                    <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-72">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px]">
                          <tr>
                            <th className="py-2.5 px-3">Baris</th>
                            <th className="py-2.5 px-3">Claim #</th>
                            <th className="py-2.5 px-3">Periode</th>
                            <th className="py-2.5 px-3 text-right">Nilai Progres Fisik</th>
                            <th className="py-2.5 px-3 text-right">Nilai Diajukan</th>
                            <th className="py-2.5 px-3 text-right">Nilai Disahkan</th>
                            <th className="py-2.5 px-3">Target Cair</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {validationResult.validRows.map((r) => (
                            <tr key={r.rowNumber} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono text-slate-500">#{r.rowNumber}</td>
                              <td className="py-2 px-3 font-mono font-bold text-slate-900">{r.claimNumber}</td>
                              <td className="py-2 px-3 text-slate-600">
                                {r.periodStart} s/d {r.periodEnd}
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-900 text-right">
                                {formatIDR(r.workPerformedValue)}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-blue-700 text-right">
                                {formatIDR(r.claimedValue)}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-emerald-700 text-right">
                                {formatIDR(r.certifiedValue)}
                              </td>
                              <td className="py-2 px-3 text-slate-600">{r.expectedCashDate}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* 2. REJECTED ROWS TABLE (UAT-02) */}
                  {previewTab === "rejected" && (
                    <div className="border border-red-200 rounded-lg overflow-x-auto max-h-72 bg-red-50/20">
                      {validationResult.rejectedRows.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                          Nol baris error! Seluruh baris data pada berkas Anda valid 100%.
                        </div>
                      ) : (
                        <table className="w-full text-left">
                          <thead className="bg-red-100/60 border-b border-red-200 text-red-900 font-bold uppercase text-[11px]">
                            <tr>
                              <th className="py-2.5 px-3">Baris #</th>
                              <th className="py-2.5 px-3">Diagnosa Masalah / Penyebab Ditolak</th>
                              <th className="py-2.5 px-3">Data Mentah Baris</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-red-100">
                            {validationResult.rejectedRows.map((r) => (
                              <tr key={r.rowNumber} className="hover:bg-red-50/40">
                                <td className="py-2.5 px-3 font-mono font-bold text-red-700">Baris {r.rowNumber}</td>
                                <td className="py-2.5 px-3 text-red-800 font-semibold max-w-sm">
                                  {r.errors.map((err, i) => (
                                    <div key={i}>&bull; {err}</div>
                                  ))}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[10px] text-slate-600 max-w-md truncate">
                                  {JSON.stringify(r.raw)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* 3. DELTA VERSIONING TABLE (UAT-04) */}
                  {previewTab === "delta" && deltaResult && (
                    <div className="border border-slate-200 rounded-lg p-4 space-y-4 bg-slate-50/60">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900">Perbandingan Delta Versi terhadap Data Eksisting:</span>
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded text-[10px]">
                            +{deltaResult.summary.addedCount} Added
                          </span>
                          <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded text-[10px]">
                            {deltaResult.summary.changedCount} Changed
                          </span>
                          <span className="bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded text-[10px]">
                            {deltaResult.summary.removedCount} Removed
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {deltaResult.added.map((add) => (
                          <div
                            key={add.claimNumber}
                            className="p-2.5 bg-white border border-blue-200 rounded flex justify-between items-center"
                          >
                            <div>
                              <span className="font-bold font-mono text-slate-900">{add.claimNumber}</span>
                              <span className="ml-2 text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">
                                BARU (ADDED)
                              </span>
                            </div>
                            <span className="font-mono font-bold text-emerald-700">+{formatIDR(add.variance)}</span>
                          </div>
                        ))}

                        {deltaResult.changed.map((chg) => (
                          <div
                            key={chg.claimNumber}
                            className="p-2.5 bg-white border border-amber-200 rounded flex justify-between items-center"
                          >
                            <div>
                              <span className="font-bold font-mono text-slate-900">{chg.claimNumber}</span>
                              <span className="ml-2 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                                PERUBAHAN NILAI (CHANGED)
                              </span>
                              <span className="text-[10px] text-slate-500 block mt-0.5">
                                {chg.fieldChanges?.map((f) => `${f.field}: ${formatIDR(f.oldValue)} -> ${formatIDR(f.newValue)}`).join(", ")}
                              </span>
                            </div>
                            <span className="font-mono font-bold text-amber-700">{formatIDR(chg.variance)}</span>
                          </div>
                        ))}

                        {deltaResult.added.length === 0 && deltaResult.changed.length === 0 && (
                          <div className="text-center py-4 text-slate-500">
                            Nol delta detected. Seluruh nilai identik dengan data tersimpan saat ini.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Wizard Footer Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <Button variant="outline" onClick={handleCancelImport} className="text-red-700 border-red-200">
                    Batalkan Impor (Atomic Cancel)
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setStep(2)}>
                      &larr; Kembali ke Pemetaan
                    </Button>
                    <Button
                      onClick={handleCommitImport}
                      disabled={validationResult.validRows.length === 0}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1.5"
                    >
                      <Check className="h-4 w-4" />
                      <span>Komit &amp; Simpan {validationResult.validRows.length} Baris Valid</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: SUMMARY & PROVENANCE (IMP-008) */}
            {step === 4 && committedBatch && (
              <div className="space-y-6 text-center py-6 text-xs max-w-xl mx-auto">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mx-auto">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Batch Impor Berhasil Diterapkan ke Ledger</h3>
                  <p className="text-slate-500 mt-1">
                    {committedBatch.acceptedRows} baris klaim berhasil masuk ke siklus Progress-to-Cash. Saldo pipeline
                    dan jejak audit otomatis terhubung.
                  </p>
                </div>

                {/* Lineage Details */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Batch ID:</span>
                    <span className="font-bold text-slate-900">{committedBatch.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">File Name:</span>
                    <span className="text-slate-900">{committedBatch.fileName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">SHA-256 Checksum:</span>
                    <span className="text-slate-900">{committedBatch.fileChecksum.substring(0, 24)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nilai Diterima:</span>
                    <span className="font-bold text-emerald-700">{formatIDR(committedBatch.acceptedValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Uploader:</span>
                    <span className="text-slate-900">{committedBatch.uploadedBy}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  {validationResult && validationResult.rejectedRows.length > 0 && (
                    <Button variant="outline" onClick={handleDownloadErrors} className="gap-1 text-red-700 border-red-200">
                      <Download className="h-4 w-4" />
                      <span>Unduh {validationResult.rejectedRows.length} Baris Gagal</span>
                    </Button>
                  )}
                  <Button onClick={handleCancelImport} className="bg-slate-900 text-white font-bold">
                    Impor Berkas Lainnya
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* 2. BATCH HISTORY & ROLLBACK TAB (IMP-008, IMP-013) */}
        <TabsContent value="history" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4 text-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Riwayat Batch Impor &amp; Jejak Provenance</h3>
              <p className="text-slate-500">
                Audit trail seluruh file yang pernah diimpor ke sistem beserta status rekonsiliasi dan SHA-256 checksum
              </p>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Batch ID</th>
                    <th className="py-3 px-4">Nama Berkas</th>
                    <th className="py-3 px-4">Waktu Impor</th>
                    <th className="py-3 px-4">Uploader</th>
                    <th className="py-3 px-4 text-right">Baris (Valid / Total)</th>
                    <th className="py-3 px-4 text-right">Nilai Diterima</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {coveStore.sourceImports.map((batch) => (
                    <tr key={batch.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{batch.id}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{batch.fileName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          SHA: {batch.fileChecksum ? batch.fileChecksum.substring(0, 16) : "-"}...
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{new Date(batch.uploadedAt).toLocaleString("id-ID")}</td>
                      <td className="py-3 px-4 text-slate-700 font-medium">{batch.uploadedBy}</td>
                      <td className="py-3 px-4 text-right font-mono">
                        <span className="text-emerald-700 font-bold">{batch.acceptedRows}</span> / {batch.totalRows}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatIDR(batch.acceptedValue)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            batch.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-red-50 text-red-800 border border-red-200"
                          }`}
                        >
                          {batch.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {batch.status === "COMPLETED" && (currentUser.role === "OWNER" || currentUser.role === "COMMERCIAL_MANAGER" || currentUser.role === "ADMIN") ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setBatchToRollback(batch);
                              setRollbackModalOpen(true);
                            }}
                            className="text-xs font-semibold text-red-700 border-red-200 hover:bg-red-50 gap-1"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Rollback</span>
                          </Button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* 3. MAPPING TEMPLATES TAB (IMP-004) */}
        <TabsContent value="templates" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4 text-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Template Pemetaan Kolom Kontraktor</h3>
              <p className="text-slate-500">
                Simpan dan kelola kamus pemetaan header Excel agar proses upload berkala berjalan otomatis tanpa mapping ulang
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {coveStore.importTemplates.map((t) => (
                <div key={t.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{t.templateName}</span>
                    <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                      {t.entityType}
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-600">
                    <div>
                      Dibuat oleh: <strong>{t.createdByName}</strong>
                    </div>
                    <div>Daftar Kolom Terpetakan: {Object.keys(t.columnMapping).length} field</div>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200 font-mono text-[10px] text-slate-700 max-h-24 overflow-y-auto">
                    {Object.entries(t.columnMapping).map(([k, v]) => (
                      <div key={k}>
                        {k} &rarr; <strong>{v}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* 4. DOWNLOAD BLANK TEMPLATES TAB */}
        <TabsContent value="downloads" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4 text-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Format Spreadsheet Kosong Siap Pakai</h3>
              <p className="text-slate-500">
                Unduh template CSV/Excel dengan struktur kolom resmi COVE untuk diisi oleh tim lapangan
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
                <div>
                  <span className="font-bold text-slate-900 text-sm block">Template Klaim Progres (Claims)</span>
                  <p className="text-slate-500 text-[11px] mt-1">
                    Format resmi untuk opname fisik bulanan, nilai pengajuan, dan sertifikat BAP
                  </p>
                </div>
                <Button
                  onClick={() => handleDownloadSampleTemplate("claims")}
                  variant="outline"
                  size="sm"
                  className="mt-4 font-semibold gap-1.5 bg-white text-emerald-700 border-emerald-300"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Template Claims (CSV)</span>
                </Button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
                <div>
                  <span className="font-bold text-slate-900 text-sm block">Template Master Proyek</span>
                  <p className="text-slate-500 text-[11px] mt-1">
                    Format intake massal untuk banyak proyek sekaligus
                  </p>
                </div>
                <Button
                  onClick={() => handleDownloadSampleTemplate("projects")}
                  variant="outline"
                  size="sm"
                  className="mt-4 font-semibold gap-1.5 bg-white text-blue-700 border-blue-300"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Template Projects (CSV)</span>
                </Button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
                <div>
                  <span className="font-bold text-slate-900 text-sm block">Template Faktur (Invoices)</span>
                  <p className="text-slate-500 text-[11px] mt-1">
                    Format penagihan komersial dengan potongan retensi dan jatuh tempo
                  </p>
                </div>
                <Button
                  onClick={() => handleDownloadSampleTemplate("invoices")}
                  variant="outline"
                  size="sm"
                  className="mt-4 font-semibold gap-1.5 bg-white text-indigo-700 border-indigo-300"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Template Invoices (CSV)</span>
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Rollback Confirmation Modal (IMP-013) */}
      <Dialog open={rollbackModalOpen} onOpenChange={setRollbackModalOpen}>
        <DialogHeader>
          <DialogTitle className="text-red-700 flex items-center gap-2 text-sm font-bold">
            <AlertTriangle className="h-5 w-5" />
            <span>Konfirmasi Pembatalan Batch (Rollback Import)</span>
          </DialogTitle>
          <DialogDescription>
            Sesuai PRD IMP-013, rollback dilakukan dengan merekam event pembatalan berpenjelasan pada jejak audit tanpa
            menghapus riwayat masa lalu secara sepihak.
          </DialogDescription>
        </DialogHeader>

        {batchToRollback && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono text-[11px]">
              <div>Batch ID: <strong>{batchToRollback.id}</strong></div>
              <div>Berkas: <strong>{batchToRollback.fileName}</strong></div>
              <div>Nilai Diterima: <strong>{formatIDR(batchToRollback.acceptedValue)}</strong></div>
            </div>

            <div>
              <Label htmlFor="rollbackReason">Alasan Bisnis Pembatalan (Wajib Diisi) *</Label>
              <Input
                id="rollbackReason"
                required
                placeholder="Contoh: Kesalahan upload draft revisi opname yang belum disetujui MK"
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setRollbackModalOpen(false)}>
            Batal
          </Button>
          <Button onClick={handleRollbackBatch} className="bg-red-700 hover:bg-red-800 text-white font-bold">
            Konfirmasi Rollback &amp; Catat Audit
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
