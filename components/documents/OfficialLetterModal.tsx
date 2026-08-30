"use client";

import React, { useState } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { OfficialLetterDocument } from "./OfficialLetterDocument";
import {
  LegalLetterType,
  LegalLetterContext,
  generateAutomatedLetterNumber,
} from "@/lib/documents/legal-letter-templates";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import {
  Printer,
  FileText,
  MessageSquare,
  Sparkles,
  AlertTriangle,
  Calendar,
  Send,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { formatIDR } from "@/lib/utils";

interface OfficialLetterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claimId?: string;
  projectId?: string;
}

export function OfficialLetterModal({
  open,
  onOpenChange,
  claimId,
  projectId,
}: OfficialLetterModalProps) {
  const { currentOrg, currentUser } = useTenant();

  // Find Project & Claim Context
  const targetProject = projectId
    ? coveStore.projects.find((p) => p.id === projectId)
    : claimId
    ? coveStore.projects.find((p) => {
        const clm = coveStore.claims.find((c) => c.id === claimId);
        return clm && p.id === clm.projectId;
      })
    : coveStore.projects[0];

  const project = targetProject || coveStore.projects[0];
  const contract = coveStore.contracts.find((c) => c.projectId === project.id) || coveStore.contracts[0];
  const client = coveStore.clients.find((c) => c.id === project.clientId);

  const targetClaim = claimId
    ? coveStore.claims.find((c) => c.id === claimId)
    : coveStore.claims.find((c) => c.projectId === project.id) || coveStore.claims[0];

  const claim = targetClaim || coveStore.claims[0];

  // Letter State
  const [letterType, setLetterType] = useState<LegalLetterType>("PAYMENT_INVOICE");
  const [letterDate, setLetterDate] = useState(new Date().toISOString().split("T")[0]);
  const [urgencyLevel, setUrgencyLevel] = useState<"Biasa" | "Penting" | "Sangat Segera">("Penting");
  const [signatoryName, setSignatoryName] = useState(currentUser.fullName || "Dimas Sucipto, S.T.");
  const [signatoryJobTitle, setSignatoryJobTitle] = useState(currentUser.jobTitle || "Commercial Manager");
  const [customNotes, setCustomNotes] = useState("");

  const letterNumber = generateAutomatedLetterNumber(
    42,
    project.projectCode || "MRD",
    letterType,
    new Date(letterDate)
  );

  const grossClaim = claim.certifiedValue || claim.claimedValue || 2100000000;
  const netPayable = Math.round(grossClaim * 0.95); // After 5% retention

  // Build Context
  const letterContext: LegalLetterContext = {
    letterType,
    letterNumber,
    letterDate,
    attachmentCount: "1 (Satu) Berkas",
    urgencyLevel,
    subject: "",
    companyName: currentOrg.name,
    companyLegalName: currentOrg.legalName,
    companyAddress: "Jl. Raya Utama No. 88, Kav. 12",
    companyCity: `${currentOrg.city}, ${currentOrg.province}`,
    companyPhone: "+62 21 5599 8812",
    companyEmail: "commercial@kontraktor.co.id",
    signatoryName,
    signatoryJobTitle,
    bankName: "Bank Central Asia (BCA) KCU Thamrin",
    bankAccountNumber: "888-0912-3344",
    bankAccountHolder: currentOrg.legalName,
    recipientName: "Bpk. Ir. Hendra Gunawan",
    recipientTitle: "Direktur Utama / Project Director",
    recipientCompany: client?.name || client?.legalName || "PT Meridian Properti Indonesia",
    recipientAddress: "Jl. Jend. Sudirman Kav. 21",
    recipientCity: "Jakarta Pusat",
    projectName: project.projectName,
    projectCode: project.projectCode,
    contractNumber: contract.contractNumber,
    contractDate: project.contractStartDate || "15 Februari 2026",
    claimNumber: claim.claimNumber,
    claimPeriod: `${claim.periodStart} s/d ${claim.periodEnd}`,
    grossClaimAmount: grossClaim,
    netPayableAmount: netPayable,
    overdueDays: 18,
    variationAmount: 850000000,
    timeExtensionDays: 14,
    customNotes: customNotes || undefined,
    carbonCopyList: [
      `Direktur Utama ${client?.name || "PT Meridian Properti Indonesia"} (Pemberi Tugas)`,
      "Team Leader PT Bina Karya Konsultan (Manajemen Konstruksi)",
      "Project Manager & Arsip Proyek (Site Office)",
    ],
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const waText = encodeURIComponent(
      `*SURAT RESMI KONTRAKTOR*\n` +
      `No: ${letterNumber}\n` +
      `Proyek: ${project.projectName}\n` +
      `Hal: Surat ${letterType.replace("_", " ")} (${claim.claimNumber})\n` +
      `Nilai: ${formatIDR(netPayable)}\n\n` +
      `Yth. ${letterContext.recipientTitle} - ${letterContext.recipientCompany},\n` +
      `Dokumen fisik dan surat resmi telah kami terbitkan secara resmi melalui sistem COVE. Mohon dapat ditindaklanjuti.\n\n` +
      `Hormat kami,\n${signatoryName} (${currentOrg.legalName})`
    );
    window.open(`https://wa.me/?text=${waText}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="max-w-5xl w-full mx-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="border-b border-slate-200 pb-3 flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">
                <FileText className="h-4 w-4 text-emerald-400" />
              </div>
              <DialogTitle className="text-base font-black text-slate-900">
                Generator Surat Korespondensi & Penagihan Resmi Kontraktor
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              Standar format surat hukum konstruksi Indonesia dengan nomor surat otomatis, kop surat PT, dan klausul kontrak
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleShareWhatsApp}
              size="sm"
              variant="outline"
              className="text-xs font-bold text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 gap-1.5 h-8"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Bagikan WA</span>
            </Button>
            <Button
              onClick={handlePrint}
              size="sm"
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1.5 h-8 shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Cetak / PDF</span>
            </Button>
          </div>
        </DialogHeader>

        {/* 4 Template Selector Tabs */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setLetterType("OPNAME_REQUEST")}
              className={`p-3 rounded-xl border text-left text-xs transition-all ${
                letterType === "OPNAME_REQUEST"
                  ? "bg-white border-blue-600 shadow-sm ring-1 ring-blue-600 font-bold text-slate-950"
                  : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-white"
              }`}
            >
              <div className="text-[10px] font-bold text-blue-600 uppercase mb-0.5">1. Pra-Klaim</div>
              <div className="font-bold truncate">Permohonan Opname</div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Jadwal verifikasi MK</span>
            </button>

            <button
              type="button"
              onClick={() => setLetterType("PAYMENT_INVOICE")}
              className={`p-3 rounded-xl border text-left text-xs transition-all ${
                letterType === "PAYMENT_INVOICE"
                  ? "bg-white border-emerald-600 shadow-sm ring-1 ring-emerald-600 font-bold text-slate-950"
                  : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-white"
              }`}
            >
              <div className="text-[10px] font-bold text-emerald-600 uppercase mb-0.5">2. Penagihan Resmi</div>
              <div className="font-bold truncate">Surat Tagihan Termin</div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Sesuai BAP & Rekening</span>
            </button>

            <button
              type="button"
              onClick={() => setLetterType("PAYMENT_OVERDUE_WARNING")}
              className={`p-3 rounded-xl border text-left text-xs transition-all ${
                letterType === "PAYMENT_OVERDUE_WARNING"
                  ? "bg-white border-red-600 shadow-sm ring-1 ring-red-600 font-bold text-slate-950"
                  : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-white"
              }`}
            >
              <div className="text-[10px] font-bold text-red-600 uppercase mb-0.5">3. Eskalasi Tagihan</div>
              <div className="font-bold truncate">Surat Teguran / Somasi</div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Jatuh tempo terlewati</span>
            </button>

            <button
              type="button"
              onClick={() => setLetterType("ADDENDUM_REQUEST")}
              className={`p-3 rounded-xl border text-left text-xs transition-all ${
                letterType === "ADDENDUM_REQUEST"
                  ? "bg-white border-purple-600 shadow-sm ring-1 ring-purple-600 font-bold text-slate-950"
                  : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-white"
              }`}
            >
              <div className="text-[10px] font-bold text-purple-600 uppercase mb-0.5">4. Amandemen</div>
              <div className="font-bold truncate">Pengajuan Addendum</div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Pekerjaan Tambah VO</span>
            </button>
          </div>

          {/* Quick Customization Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <Label htmlFor="sdate">Tanggal Surat</Label>
              <Input
                id="sdate"
                type="date"
                value={letterDate}
                onChange={(e) => setLetterDate(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label htmlFor="urgency">Sifat Surat</Label>
              <select
                id="urgency"
                value={urgencyLevel}
                onChange={(e) => setUrgencyLevel(e.target.value as any)}
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800"
              >
                <option value="Biasa">Biasa</option>
                <option value="Penting">Penting</option>
                <option value="Sangat Segera">Sangat Segera (Urgent)</option>
              </select>
            </div>

            <div>
              <Label htmlFor="signName">Nama Penandatangan</Label>
              <Input
                id="signName"
                value={signatoryName}
                onChange={(e) => setSignatoryName(e.target.value)}
                className="mt-1 font-semibold"
              />
            </div>

            <div>
              <Label htmlFor="signTitle">Jabatan Penandatangan</Label>
              <Input
                id="signTitle"
                value={signatoryJobTitle}
                onChange={(e) => setSignatoryJobTitle(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Scrollable Letter Preview Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200 print:bg-white print:p-0 print:overflow-visible">
          <OfficialLetterDocument context={letterContext} />
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 border-t border-slate-200 bg-white flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          <span className="text-[11px] text-slate-400 font-mono">
            COVE Legal Correspondence Engine v1.0 • Standar Surat Kontrak Indonesia
          </span>
        </DialogFooter>
      </div>
    </Dialog>
  );
}
