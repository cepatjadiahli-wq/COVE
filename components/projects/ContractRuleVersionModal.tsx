"use client";

import React, { useState } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { DemoContractRuleVersion } from "@/domains/demo/seed-data";
import { FileText, ShieldCheck, AlertCircle } from "lucide-react";

interface ContractRuleVersionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  contractId: string;
  currentActiveRule?: DemoContractRuleVersion;
  onSuccess?: () => void;
}

export function ContractRuleVersionModal({
  open,
  onOpenChange,
  projectId,
  contractId,
  currentActiveRule,
  onSuccess,
}: ContractRuleVersionModalProps) {
  const { currentUser, refreshState, hasPermission } = useTenant();
  const { language } = useLanguage();

  const [cutOffDay, setCutOffDay] = useState(currentActiveRule?.cutOffDay || 25);
  const [internalLeadTimeDays, setInternalLeadTimeDays] = useState(currentActiveRule?.internalLeadTimeDays || 5);
  const [reviewSlaDays, setReviewSlaDays] = useState(currentActiveRule?.reviewSlaDays || 14);
  const [paymentTermDays, setPaymentTermDays] = useState(currentActiveRule?.paymentTermDays || 30);
  const [calendarBasis, setCalendarBasis] = useState<"CALENDAR_DAYS" | "WORKING_DAYS">(
    currentActiveRule?.calendarBasis || "CALENDAR_DAYS"
  );
  const [retentionPercent, setRetentionPercent] = useState(currentActiveRule?.retentionPercent || 5.0);
  const [advanceRecoveryRule, setAdvanceRecoveryRule] = useState<"PROPORTIONAL" | "FIXED_PERCENT" | "NONE">(
    currentActiveRule?.advanceRecoveryRule || "PROPORTIONAL"
  );
  const [advanceRecoveryPercent, setAdvanceRecoveryPercent] = useState(
    currentActiveRule?.advanceRecoveryPercent || 10.0
  );
  const [taxTreatment, setTaxTreatment] = useState(
    currentActiveRule?.taxTreatment || "PPN 11% & PPh Final 1.75% (Pasal 12 SPK)"
  );
  const [sourceClauseRef, setSourceClauseRef] = useState(
    currentActiveRule ? `Addendum Klausul Perubahan` : "Pasal 8 SPK Utama"
  );
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const canApproveDirectly = currentUser.role === "OWNER" || currentUser.role === "ADMIN";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!sourceClauseRef.trim()) {
      alert("Referensi pasal kontrak / addendum wajib diisi.");
      return;
    }

    const proposed = coveStore.proposeContractRuleVersion(
      {
        orgId: "org-nusantara-01",
        projectId,
        contractId,
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
        effectiveDate,
        notes: notes || "Perubahan aturan kontrak diajukan oleh Tim Komersial.",
      },
      `${currentUser.fullName} (${currentUser.role})`
    );

    // If current user has Owner/Admin authority, approve immediately!
    if (canApproveDirectly) {
      coveStore.approveContractRuleVersion(proposed.id, `${currentUser.fullName} (${currentUser.role})`);
    }

    refreshState();
    if (onSuccess) onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-slate-900">
          <FileText className="h-5 w-5 text-blue-600" />
          <span>
            {canApproveDirectly
              ? "Perbarui & Sahkan Aturan Kontrak (Contract Rule Version)"
              : "Usulkan Perubahan Aturan Kontrak (Propose Rule Version)"}
          </span>
        </DialogTitle>
        <DialogDescription>
          Konfigurasi aturan legal-komersial acuan seluruh siklus klaim. Setiap versi aturan terikat pada nomor pasal
          kontrak atau addendum resmi (PRD Section 16 &amp; 22.3).
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Anti-Overengineering Callout */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] leading-relaxed flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold">Prinsip Section 22.3 — Tanpa Kalkulator Pajak Universal:</strong>
            Aturan perpajakan dan retensi proyek ini tidak digeneralisasi, melainkan merujuk langsung pada pasal kontrak
            spesifik proyek Anda.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="clauseRef">Referensi Pasal Kontrak / Addendum *</Label>
            <Input
              id="clauseRef"
              required
              placeholder="Contoh: Pasal 8 Ayat 2 SPK / Addendum I"
              value={sourceClauseRef}
              onChange={(e) => setSourceClauseRef(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="effDate">Tanggal Efektif Berlaku *</Label>
            <Input
              id="effDate"
              type="date"
              required
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="cutoff">Tanggal Cut-off Bulanan (1-31) *</Label>
            <Input
              id="cutoff"
              type="number"
              min="1"
              max="31"
              required
              value={cutOffDay}
              onChange={(e) => setCutOffDay(Number(e.target.value))}
              className="mt-1 font-mono"
            />
          </div>
          <div>
            <Label htmlFor="leadtime">Lead Time Internal QS (Hari) *</Label>
            <Input
              id="leadtime"
              type="number"
              min="1"
              max="30"
              required
              value={internalLeadTimeDays}
              onChange={(e) => setInternalLeadTimeDays(Number(e.target.value))}
              className="mt-1 font-mono"
            />
          </div>
          <div>
            <Label htmlFor="reviewsla">SLA Review MK/Konsultan (Hari) *</Label>
            <Input
              id="reviewsla"
              type="number"
              min="1"
              max="60"
              required
              value={reviewSlaDays}
              onChange={(e) => setReviewSlaDays(Number(e.target.value))}
              className="mt-1 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="payterm">Payment Term / Jatuh Tempo (Hari) *</Label>
            <Input
              id="payterm"
              type="number"
              min="1"
              max="180"
              required
              value={paymentTermDays}
              onChange={(e) => setPaymentTermDays(Number(e.target.value))}
              className="mt-1 font-mono"
            />
          </div>
          <div>
            <Label htmlFor="calbasis">Basis Penghitungan Hari *</Label>
            <Select
              id="calbasis"
              value={calendarBasis}
              onChange={(e) => setCalendarBasis(e.target.value as any)}
              className="mt-1"
            >
              <option value="CALENDAR_DAYS">Hari Kalender (Calendar Days)</option>
              <option value="WORKING_DAYS">Hari Kerja (Working Days)</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="retention">Potongan Retensi (%) *</Label>
            <Input
              id="retention"
              type="number"
              step="0.1"
              min="0"
              max="20"
              required
              value={retentionPercent}
              onChange={(e) => setRetentionPercent(Number(e.target.value))}
              className="mt-1 font-mono"
            />
          </div>
          <div>
            <Label htmlFor="advRule">Skema Potong Uang Muka *</Label>
            <Select
              id="advRule"
              value={advanceRecoveryRule}
              onChange={(e) => setAdvanceRecoveryRule(e.target.value as any)}
              className="mt-1"
            >
              <option value="PROPORTIONAL">Proporsional per Termin</option>
              <option value="FIXED_PERCENT">Persentase Tetap</option>
              <option value="NONE">Tanpa Uang Muka (0%)</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="advPercent">Tarif Potong Uang Muka (%)</Label>
            <Input
              id="advPercent"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={advanceRecoveryPercent}
              onChange={(e) => setAdvanceRecoveryPercent(Number(e.target.value))}
              className="mt-1 font-mono"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="taxTreatment">Klausul Perlakuan Pajak Sesuai Kontrak *</Label>
          <Input
            id="taxTreatment"
            required
            placeholder="Contoh: PPN 11% & PPh Final Jasa Konstruksi 1.75% (Pasal 14 SPK)"
            value={taxTreatment}
            onChange={(e) => setTaxTreatment(e.target.value)}
            className="mt-1 font-medium"
          />
        </div>

        <div>
          <Label htmlFor="notes">Catatan &amp; Ketentuan Khusus Addendum</Label>
          <Input
            id="notes"
            placeholder="Contoh: Berita Acara opname fisik wajib diunggah H-1 sebelum pengajuan resmi."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button type="submit" className="bg-slate-900 text-white font-bold gap-1.5">
            <ShieldCheck className="h-4 w-4" />
            <span>{canApproveDirectly ? "Simpan & Sahkan Versi Aturan" : "Kirim Usulan Versi Aturan"}</span>
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
