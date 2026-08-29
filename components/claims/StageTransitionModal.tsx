"use client";

import React, { useState } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ClaimStage, CLAIM_STAGE_CONFIGS } from "@/lib/constants";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface StageTransitionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claimId: string;
  currentStage: ClaimStage;
}

export function StageTransitionModal({
  open,
  onOpenChange,
  claimId,
  currentStage,
}: StageTransitionModalProps) {
  const { currentUser, refreshState } = useTenant();
  const { t, language } = useLanguage();
  const [targetStage, setTargetStage] = useState<ClaimStage>("CERTIFIED");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const currentConfig = CLAIM_STAGE_CONFIGS[currentStage];
  const targetConfig = CLAIM_STAGE_CONFIGS[targetStage];

  const isBackward = targetConfig && currentConfig && targetConfig.order < currentConfig.order && !targetConfig.isException;
  const isException = targetConfig?.isException;
  const requiresReason = isBackward || isException;

  const handleTransition = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      coveStore.transitionClaim(claimId, targetStage, reason, currentUser.id);
      refreshState();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{language === "id" ? "Ubah Tahap Klaim (Stage Transition)" : "Change Claim Stage (Stage Transition)"}</DialogTitle>
        <DialogDescription>
          {language === "id" 
            ? "Perpindahan tahap akan dicatat otomatis ke dalam riwayat audit dan menghitung durasi tahap." 
            : "Stage transition is automatically recorded in the audit trail and recalculates aging."}
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div className="p-3 mb-4 rounded bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleTransition} className="space-y-4">
        <div>
          <Label>{language === "id" ? "Tahap Saat Ini (Current Stage)" : "Current Stage"}</Label>
          <div className="mt-1 p-2 rounded bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800">
            {currentConfig?.label || currentStage} (Order #{currentConfig?.order})
          </div>
        </div>

        <div>
          <Label htmlFor="targetStage">{language === "id" ? "Tahap Target (Target Stage)" : "Target Stage"}</Label>
          <Select
            id="targetStage"
            value={targetStage}
            onChange={(e) => setTargetStage(e.target.value as ClaimStage)}
            className="mt-1"
          >
            <optgroup label={language === "id" ? "Alur Normal Progress-to-Cash" : "Normal Progress-to-Cash Pipeline"}>
              <option value="WORK_RECORDED">1. Work Recorded</option>
              <option value="MEASUREMENT">2. Measurement / Opname</option>
              <option value="CLAIM_PREPARATION">3. Claim Preparation</option>
              <option value="CLAIM_READY">4. Claim Ready</option>
              <option value="SUBMITTED">5. Submitted</option>
              <option value="UNDER_REVIEW">6. Under Review</option>
              <option value="CERTIFIED">7. Certified (BAP / MC Disetujui)</option>
              <option value="INVOICE_READY">8. Invoice Ready</option>
              <option value="INVOICE_ISSUED">9. Invoice Issued</option>
              <option value="INVOICE_ACCEPTED">10. Invoice Accepted</option>
              <option value="DUE">11. Due for Payment</option>
              <option value="PARTIALLY_PAID">12. Partially Paid</option>
              <option value="PAID">13. Paid / Collected</option>
            </optgroup>
            <optgroup label={language === "id" ? "Tahap Exception / Khusus" : "Exception / Special Stages"}>
              <option value="ON_HOLD">On Hold</option>
              <option value="DISPUTED">Disputed (Sengketa)</option>
              <option value="REJECTED">Rejected (Ditolak)</option>
              <option value="CANCELLED">Cancelled</option>
            </optgroup>
          </Select>
        </div>

        {requiresReason && (
          <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <span className="font-bold block mb-1">{language === "id" ? "Perhatian (Justifikasi Diperlukan):" : "Attention (Justification Required):"}</span>
            {language === "id" 
              ? "Perpindahan mundur atau ke status exception wajib menyertakan alasan komersial/teknis."
              : "Backward transitions or exception states require a clear commercial/technical justification."}
          </div>
        )}

        <div>
          <Label htmlFor="reason">
            {language === "id" ? "Alasan Perubahan" : "Reason for Change"} {requiresReason && <span className="text-red-600">*</span>}
          </Label>
          <Textarea
            id="reason"
            required={requiresReason}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={language === "id" ? "Tuliskan catatan atau justifikasi perpindahan tahap..." : "Enter stage transition notes or justification..."}
            className="mt-1"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Batal")}
          </Button>
          <Button type="submit" className="bg-slate-900 text-white font-bold">
            {language === "id" ? "Simpan Perubahan Stage" : "Save Stage Transition"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
