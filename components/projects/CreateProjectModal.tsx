"use client";

import React, { useState } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Building2, FileText, Calendar, Plus, CheckCircle2 } from "lucide-react";

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectModal({ open, onOpenChange }: CreateProjectModalProps) {
  const { refreshState, currentUser } = useTenant();
  const { t, language } = useLanguage();
  const [activeStep, setActiveStep] = useState("project");

  // Project Profile State
  const [projectCode, setProjectCode] = useState("PRJ-NEW-05");
  const [projectName, setProjectName] = useState("");
  const [clientId, setClientId] = useState(coveStore.clients[0]?.id || "");
  const [projectType, setProjectType] = useState("Commercial Highrise");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("Jakarta Selatan");
  const [startDate, setStartDate] = useState("2026-09-01");
  const [finishDate, setFinishDate] = useState("2027-08-31");

  // Client Quick Add State
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientLegalName, setNewClientLegalName] = useState("");

  // Primary Contract Profile State
  const [contractNumber, setContractNumber] = useState("CTR-NB-NEW-2026-05");
  const [contractTitle, setContractTitle] = useState("");
  const [contractValue, setContractValue] = useState(28500000000);

  // Contract Rule Foundation (v1.0) State
  const [cutOffDay, setCutOffDay] = useState(25);
  const [internalLeadTimeDays, setInternalLeadTimeDays] = useState(5);
  const [reviewSlaDays, setReviewSlaDays] = useState(14);
  const [paymentTermDays, setPaymentTermDays] = useState(30);
  const [calendarBasis, setCalendarBasis] = useState<"CALENDAR_DAYS" | "WORKING_DAYS">("CALENDAR_DAYS");
  const [retentionPercent, setRetentionPercent] = useState(5.0);
  const [advanceRecoveryRule, setAdvanceRecoveryRule] = useState<"PROPORTIONAL" | "FIXED_PERCENT" | "NONE">("PROPORTIONAL");
  const [advanceRecoveryPercent, setAdvanceRecoveryPercent] = useState(10.0);
  const [taxTreatment, setTaxTreatment] = useState("PPN 11% & PPh 4(2) Final Jasa Konstruksi 1.75% (Pasal 12 SPK)");
  const [sourceClauseRef, setSourceClauseRef] = useState("Pasal 8 Ayat 1 & 2 SPK Utama");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      alert(language === "id" ? "Nama proyek wajib diisi." : "Project name is required.");
      return;
    }

    let selectedClientId = clientId;

    // Create client if user typed a new one
    if (showNewClientForm && newClientName.trim()) {
      const createdClient = coveStore.createClient(
        {
          name: newClientName,
          legalName: newClientLegalName || newClientName,
          clientType: "Private Developer",
        },
        currentUser.fullName
      );
      selectedClientId = createdClient.id;
    }

    // Call unified intake method
    coveStore.createProjectWithContract(
      {
        project: {
          projectCode,
          projectName,
          clientId: selectedClientId,
          projectType,
          location: location || city,
          city,
          contractStartDate: startDate,
          contractFinishDate: finishDate,
          projectManagerId: "usr-fajar",
          commercialManagerId: "usr-dimas",
          financeOwnerId: "usr-rani",
        },
        contract: {
          contractNumber: contractNumber || `CTR-NB-${projectCode}`,
          contractTitle: contractTitle || `Kontrak Pekerjaan ${projectName}`,
          originalContractValue: Number(contractValue),
          paymentMethod: "Monthly Progress",
        },
        rule: {
          cutOffDay: Number(cutOffDay),
          internalLeadTimeDays: Number(internalLeadTimeDays),
          reviewSlaDays: Number(reviewSlaDays),
          paymentTermDays: Number(paymentTermDays),
          calendarBasis,
          retentionPercent: Number(retentionPercent),
          advanceRecoveryRule,
          advanceRecoveryPercent: Number(advanceRecoveryPercent),
          taxTreatment,
          sourceClauseRef,
          effectiveDate: startDate,
          notes: "Aturan dasar kontrak disahkan secara resmi saat project intake.",
        },
      },
      `${currentUser.fullName} (${currentUser.role})`
    );

    refreshState();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-slate-800" />
          <span>{language === "id" ? "Project Intake & Fondasi Aturan Kontrak" : "Project Intake & Contract Rules"}</span>
        </DialogTitle>
        <DialogDescription>
          Daftarkan master proyek, profil kontrak utama, dan konfigurasi aturan klaim (cut-off, SLA, retensi, uang muka)
          versi 1.0 (PRD Section 16).
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <Tabs value={activeStep} onValueChange={setActiveStep}>
          <TabsList className="bg-slate-100 p-1 border border-slate-200 rounded-lg w-full grid grid-cols-2">
            <TabsTrigger value="project" className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              <span>1. Profil Proyek &amp; Klien</span>
            </TabsTrigger>
            <TabsTrigger value="contract" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span>2. Kontrak &amp; Aturan Klaim (v1.0)</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: PROJECT & CLIENT PROFILE */}
          <TabsContent value="project" className="space-y-4 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="code">{language === "id" ? "Kode Proyek *" : "Project Code *"}</Label>
                <Input
                  id="code"
                  required
                  value={projectCode}
                  onChange={(e) => setProjectCode(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="type">{language === "id" ? "Tipe Proyek *" : "Project Type *"}</Label>
                <Select id="type" value={projectType} onChange={(e) => setProjectType(e.target.value)} className="mt-1">
                  <option value="Commercial Highrise">Commercial Highrise</option>
                  <option value="Industrial Warehouse">Industrial Warehouse</option>
                  <option value="Healthcare Facility">Healthcare Facility</option>
                  <option value="Residential Township">Residential Township</option>
                  <option value="Infrastructure">Infrastructure</option>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="pname">{language === "id" ? "Nama Proyek *" : "Project Name *"}</Label>
              <Input
                id="pname"
                required
                placeholder="Contoh: Menara Mandiri Sudirman Tower B"
                value={projectName}
                onChange={(e) => {
                  setProjectName(e.target.value);
                  if (!contractTitle) setContractTitle(`Kontrak Utama Pekerjaan ${e.target.value}`);
                }}
                className="mt-1"
              />
            </div>

            {/* Client Mapping */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="client">{language === "id" ? "Klien / Pemberi Tugas *" : "Client / Developer *"}</Label>
                <button
                  type="button"
                  onClick={() => setShowNewClientForm(!showNewClientForm)}
                  className="text-[11px] text-blue-600 font-bold hover:underline"
                >
                  {showNewClientForm ? "Pilih dari Klien Tersedia" : "+ Daftarkan Klien Baru"}
                </button>
              </div>

              {!showNewClientForm ? (
                <Select id="client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="mt-1">
                  {coveStore.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.clientCode})
                    </option>
                  ))}
                </Select>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Input
                    placeholder="Nama Klien (e.g. PT Jaya Properti)"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                  />
                  <Input
                    placeholder="Nama Legal (PT / CV)"
                    value={newClientLegalName}
                    onChange={(e) => setNewClientLegalName(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="city">{language === "id" ? "Kota *" : "City *"}</Label>
                <Input id="city" required value={city} onChange={(e) => setCity(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="loc">{language === "id" ? "Alamat / Lokasi Lapangan" : "Location"}</Label>
                <Input
                  id="loc"
                  placeholder="Jl. Gatot Subroto Kav. 12"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sdate">{language === "id" ? "Tanggal Mulai Kontrak *" : "Start Date *"}</Label>
                <Input
                  id="sdate"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="fdate">{language === "id" ? "Tanggal Selesai Kontrak *" : "Finish Date *"}</Label>
                <Input
                  id="fdate"
                  type="date"
                  required
                  value={finishDate}
                  onChange={(e) => setFinishDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="button" onClick={() => setActiveStep("contract")} className="bg-slate-900 font-bold">
                Lanjut ke Aturan Kontrak &rarr;
              </Button>
            </div>
          </TabsContent>

          {/* TAB 2: CONTRACT & RULE FOUNDATION (v1.0) */}
          <TabsContent value="contract" className="space-y-4 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cnum">Nomor SPK / Kontrak Utama *</Label>
                <Input
                  id="cnum"
                  required
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="cval">Nilai Kontrak Awal (IDR) *</Label>
                <Input
                  id="cval"
                  type="number"
                  required
                  value={contractValue}
                  onChange={(e) => setContractValue(Number(e.target.value))}
                  className="mt-1 font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="ctitle">Judul Resmi Kontrak</Label>
              <Input
                id="ctitle"
                value={contractTitle}
                onChange={(e) => setContractTitle(e.target.value)}
                placeholder="Kontrak Utama Pekerjaan Struktur &amp; Arsitektur..."
                className="mt-1"
              />
            </div>

            {/* Contract Rules Foundation */}
            <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-700" />
                <span className="font-bold text-slate-900">Fondasi Parameter Klaim (Versi Aturan v1.0)</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="cutoff">Tanggal Cut-off Bulanan *</Label>
                  <Input
                    id="cutoff"
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={cutOffDay}
                    onChange={(e) => setCutOffDay(Number(e.target.value))}
                    className="mt-1 font-mono bg-white"
                  />
                  <span className="text-[10px] text-slate-500">Tgl opname bulanan</span>
                </div>
                <div>
                  <Label htmlFor="lead">Lead Time Internal (Hari) *</Label>
                  <Input
                    id="lead"
                    type="number"
                    min="1"
                    max="30"
                    required
                    value={internalLeadTimeDays}
                    onChange={(e) => setInternalLeadTimeDays(Number(e.target.value))}
                    className="mt-1 font-mono bg-white"
                  />
                  <span className="text-[10px] text-slate-500">Penyusunan berkas QS</span>
                </div>
                <div>
                  <Label htmlFor="sla">SLA Review MK (Hari) *</Label>
                  <Input
                    id="sla"
                    type="number"
                    min="1"
                    max="60"
                    required
                    value={reviewSlaDays}
                    onChange={(e) => setReviewSlaDays(Number(e.target.value))}
                    className="mt-1 font-mono bg-white"
                  />
                  <span className="text-[10px] text-slate-500">Batas verifikasi BAP</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="term">Payment Term / Jatuh Tempo (Hari) *</Label>
                  <Input
                    id="term"
                    type="number"
                    min="1"
                    max="180"
                    required
                    value={paymentTermDays}
                    onChange={(e) => setPaymentTermDays(Number(e.target.value))}
                    className="mt-1 font-mono bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="basis">Basis Hari Penghitungan *</Label>
                  <Select
                    id="basis"
                    value={calendarBasis}
                    onChange={(e) => setCalendarBasis(e.target.value as any)}
                    className="mt-1 bg-white"
                  >
                    <option value="CALENDAR_DAYS">Hari Kalender (Calendar Days)</option>
                    <option value="WORKING_DAYS">Hari Kerja (Working Days)</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="ret">Potongan Retensi (%) *</Label>
                  <Input
                    id="ret"
                    type="number"
                    step="0.1"
                    min="0"
                    max="20"
                    required
                    value={retentionPercent}
                    onChange={(e) => setRetentionPercent(Number(e.target.value))}
                    className="mt-1 font-mono bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="advR">Skema Uang Muka</Label>
                  <Select
                    id="advR"
                    value={advanceRecoveryRule}
                    onChange={(e) => setAdvanceRecoveryRule(e.target.value as any)}
                    className="mt-1 bg-white"
                  >
                    <option value="PROPORTIONAL">Proporsional</option>
                    <option value="FIXED_PERCENT">Persentase Tetap</option>
                    <option value="NONE">Tanpa DP (0%)</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="advP">Potongan DP (%)</Label>
                  <Input
                    id="advP"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={advanceRecoveryPercent}
                    onChange={(e) => setAdvanceRecoveryPercent(Number(e.target.value))}
                    className="mt-1 font-mono bg-white"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="tax">Klausul Pajak Kontrak (Bukan Universal)</Label>
                <Input
                  id="tax"
                  value={taxTreatment}
                  onChange={(e) => setTaxTreatment(e.target.value)}
                  className="mt-1 bg-white"
                />
              </div>

              <div>
                <Label htmlFor="clause">Klausul Acuan Kontrak (Source Clause Ref) *</Label>
                <Input
                  id="clause"
                  required
                  value={sourceClauseRef}
                  onChange={(e) => setSourceClauseRef(e.target.value)}
                  className="mt-1 bg-white"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setActiveStep("project")}>
                &larr; Kembali
              </Button>
              <Button type="submit" className="bg-slate-900 text-white font-bold gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>Simpan Master Proyek &amp; Sahkan Aturan</span>
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </form>
    </Dialog>
  );
}
