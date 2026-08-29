"use client";

import React, { useState } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ClaimStage } from "@/lib/constants";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface CreateClaimModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateClaimModal({ open, onOpenChange }: CreateClaimModalProps) {
  const { refreshState } = useTenant();
  const { t, language } = useLanguage();
  const [step, setStep] = useState(1);

  // Form State
  const [projectId, setProjectId] = useState(coveStore.projects[0]?.id || "");
  const [claimNumber, setClaimNumber] = useState("MC-007");
  const [periodStart, setPeriodStart] = useState("2026-08-01");
  const [periodEnd, setPeriodEnd] = useState("2026-08-31");
  const [description, setDescription] = useState("Progress Claim Periode Agustus 2026");
  const [workPerformed, setWorkPerformed] = useState(3500000000);
  const [measured, setMeasured] = useState(3200000000);
  const [claimed, setClaimed] = useState(3000000000);
  const [certified, setCertified] = useState(0);
  const [currentStage, setCurrentStage] = useState<ClaimStage>("CLAIM_PREPARATION");
  const [expectedCashDate, setExpectedCashDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]
  );
  const [ownerId, setOwnerId] = useState("usr-dimas");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedContract = coveStore.contracts.find((c) => c.projectId === projectId);

    coveStore.createClaim({
      projectId,
      contractId: selectedContract?.id || "",
      claimNumber,
      periodStart,
      periodEnd,
      description,
      currentStage,
      riskLevel: "HEALTHY",
      workPerformedValue: workPerformed,
      measuredValue: measured,
      claimedValue: claimed,
      certifiedValue: certified,
      expectedNetCollectible: claimed * 0.95,
      cashReceivedValue: 0,
      expectedCashDate,
      responsibleOwnerId: ownerId,
      sourceType: "manual",
    });

    refreshState();
    onOpenChange(false);
    setStep(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{language === "id" ? `Buat Progress Claim Baru (Langkah ${step} dari 3)` : `Create Progress Claim (Step ${step} of 3)`}</DialogTitle>
        <DialogDescription>
          {language === "id" ? "Catat nilai progress pekerjaan lapangan dari pengukuran opname sampai pengajuan resmi" : "Record site progress value from measurement to official submission"}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {step === 1 && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="proj">{language === "id" ? "Proyek Konstruksi" : "Construction Project"}</Label>
              <Select id="proj" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1">
                {coveStore.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectName} ({p.projectCode})
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cnum">{language === "id" ? "Nomor Klaim" : "Claim Number"}</Label>
                <Input id="cnum" required value={claimNumber} onChange={(e) => setClaimNumber(e.target.value)} className="mt-1 font-mono" />
              </div>
              <div>
                <Label htmlFor="stage">{language === "id" ? "Tahap Awal" : "Initial Stage"}</Label>
                <Select id="stage" value={currentStage} onChange={(e) => setCurrentStage(e.target.value as any)} className="mt-1">
                  <option value="WORK_RECORDED">1. Work Recorded</option>
                  <option value="MEASUREMENT">2. Measurement</option>
                  <option value="CLAIM_PREPARATION">3. Claim Preparation</option>
                  <option value="CLAIM_READY">4. Claim Ready</option>
                  <option value="SUBMITTED">5. Submitted</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pstart">{language === "id" ? "Periode Awal" : "Period Start"}</Label>
                <Input id="pstart" type="date" required value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="pend">{language === "id" ? "Periode Akhir" : "Period End"}</Label>
                <Input id="pend" type="date" required value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="mt-1" />
              </div>
            </div>

            <div>
              <Label htmlFor="cdesc">{language === "id" ? "Deskripsi Pekerjaan" : "Work Description"}</Label>
              <Textarea id="cdesc" value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="wp">{language === "id" ? "Work Performed (Nilai Fisik Terpasang)" : "Work Performed Value"}</Label>
              <Input
                id="wp"
                type="number"
                required
                value={workPerformed}
                onChange={(e) => setWorkPerformed(Number(e.target.value))}
                className="mt-1 font-mono text-sm font-bold"
              />
            </div>

            <div>
              <Label htmlFor="meas">{language === "id" ? "Measured / Opname Value" : "Measured / Opname Value"}</Label>
              <Input
                id="meas"
                type="number"
                required
                value={measured}
                onChange={(e) => setMeasured(Number(e.target.value))}
                className="mt-1 font-mono text-sm font-bold"
              />
            </div>

            <div>
              <Label htmlFor="clm">{language === "id" ? "Claimed Value (Nilai Pengajuan)" : "Claimed Value"}</Label>
              <Input
                id="clm"
                type="number"
                required
                value={claimed}
                onChange={(e) => setClaimed(Number(e.target.value))}
                className="mt-1 font-mono text-sm font-bold"
              />
            </div>

            <div>
              <Label htmlFor="cert">{language === "id" ? "Certified Value (BAP jika sudah ada)" : "Certified Value (if approved)"}</Label>
              <Input
                id="cert"
                type="number"
                value={certified}
                onChange={(e) => setCertified(Number(e.target.value))}
                className="mt-1 font-mono"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="cashdate">{language === "id" ? "Target Kas Masuk (Expected Cash Date)" : "Expected Cash Date"}</Label>
              <Input id="cashdate" type="date" required value={expectedCashDate} onChange={(e) => setExpectedCashDate(e.target.value)} className="mt-1" />
            </div>

            <div>
              <Label htmlFor="owner">{language === "id" ? "Penanggung Jawab (PIC)" : "Responsible Owner"}</Label>
              <Select id="owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="mt-1">
                {coveStore.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} ({p.jobTitle})
                  </option>
                ))}
              </Select>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
              <span className="font-bold text-slate-900 block mb-1">{language === "id" ? "Checklist Dokumen Otomatis:" : "Automated Evidence Checklist:"}</span>
              {language === "id"
                ? "COVE akan otomatis menginisialisasi 11 template evidence standar (Laporan progress, BA Opname, Foto, QC, dll)."
                : "COVE will automatically initialize 11 standard evidence templates (Progress Report, Measurement Report, Photos, QC, etc)."}
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between">
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
              {t("common.back", "Kembali")}
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel", "Batal")}
            </Button>
          )}

          {step < 3 ? (
            <Button type="button" onClick={() => setStep(step + 1)} className="bg-slate-900 text-white font-bold">
              {t("common.next", "Lanjut")}
            </Button>
          ) : (
            <Button type="submit" className="bg-slate-900 text-white font-bold">
              {t("common.save", "Simpan Claim")}
            </Button>
          )}
        </DialogFooter>
      </form>
    </Dialog>
  );
}
