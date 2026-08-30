"use client";

import React, { useState } from "react";
import { formatIDR, getDaysDiff } from "@/lib/utils";
import { StageBadge } from "@/components/shared/StageBadge";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { calculateClaimGaps } from "@/domains/gaps/service";
import { evaluateClaimRisk } from "@/domains/risks/service";
import { EvidenceChecklist } from "@/components/claims/EvidenceChecklist";
import { StageTransitionModal } from "@/components/claims/StageTransitionModal";
import { BlockerModal } from "@/components/blockers/BlockerModal";
import { InvoiceModal } from "@/components/invoices/InvoiceModal";
import { CashReceiptModal } from "@/components/invoices/CashReceiptModal";
import { DocumentPreviewModal } from "@/components/documents/DocumentPreviewModal";
import { WhatsAppDispatchModal } from "@/components/notifications/WhatsAppDispatchModal";
import { GeotagPhotoUploader } from "@/components/evidence/GeotagPhotoUploader";
import { SmartDocumentViewer, DocumentItem } from "@/components/evidence/SmartDocumentViewer";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X,
  AlertTriangle,
  Receipt,
  Plus,
  ShieldAlert,
  Edit3,
  FileText,
  MessageSquare,
  Camera,
} from "lucide-react";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface ClaimDetailDrawerProps {
  claimId: string | null;
  onClose: () => void;
}

export function ClaimDetailDrawer({ claimId, onClose }: ClaimDetailDrawerProps) {
  const { refreshState } = useTenant();
  const { t, language } = useLanguage();
  const [showStageModal, setShowStageModal] = useState(false);
  const [showBlockerModal, setShowBlockerModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showRecertifyModal, setShowRecertifyModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showGeotagModal, setShowGeotagModal] = useState(false);
  const [selectedDocForView, setSelectedDocForView] = useState<DocumentItem | null>(null);
  const [newCertifiedValue, setNewCertifiedValue] = useState(0);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");

  if (!claimId) return null;

  const claim = coveStore.claims.find((c) => c.id === claimId);
  if (!claim) return null;

  const project = coveStore.projects.find((p) => p.id === claim.projectId);
  const owner = coveStore.profiles.find((p) => p.id === claim.responsibleOwnerId);
  const claimInvoices = coveStore.invoices.filter((i) => i.claimId === claim.id);
  const claimBlockers = coveStore.blockers.filter((b) => b.entityId === claim.id);

  const invoicedGross = claimInvoices.reduce((acc, i) => acc + i.grossAmount, 0);
  const invoiceOutstanding = claimInvoices.reduce((acc, i) => acc + i.outstandingAmount, 0);

  const gaps = calculateClaimGaps({
    workPerformedValue: claim.workPerformedValue,
    measuredValue: claim.measuredValue,
    claimedValue: claim.claimedValue,
    certifiedValue: claim.certifiedValue,
    allocatedInvoiceGross: invoicedGross,
    invoiceOutstandingTotal: invoiceOutstanding,
  });

  const agingDays = getDaysDiff(claim.currentStageEnteredAt);

  const risk = evaluateClaimRisk({
    claimId: claim.id,
    stage: claim.currentStage,
    stageAgingDays: agingDays,
    workPerformedValue: claim.workPerformedValue,
    measuredValue: claim.measuredValue,
    claimedValue: claim.claimedValue,
    certifiedValue: claim.certifiedValue,
    invoicedGrossValue: invoicedGross,
    invoiceOutstandingTotal: invoiceOutstanding,
    hasActiveBlockers: claimBlockers.some((b) => b.status !== "resolved"),
    expectedCashDate: claim.expectedCashDate,
  });

  const handleRecertifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      coveStore.updateClaimCertifiedValue(claim.id, newCertifiedValue);
      setShowRecertifyModal(false);
      refreshState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs animate-in fade-in-0">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-y-auto">
          {/* Header */}
          <div className="p-6 border-b border-slate-200 bg-slate-50/70 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl font-extrabold text-slate-900 font-mono">
                  {claim.claimNumber}
                </span>
                <StageBadge stage={claim.currentStage} size="sm" showOrder />
                <RiskBadge level={risk.riskLevel} size="sm" />
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-1 text-xs text-slate-500 font-medium">
              {language === "id" ? "Proyek:" : "Project:"} <strong className="text-slate-800">{project?.projectName}</strong> • {language === "id" ? "Periode:" : "Period:"} {claim.periodStart} s/d {claim.periodEnd}
            </div>

            {/* Top CTA Row */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Button
                onClick={() => setShowStageModal(true)}
                size="sm"
                className="bg-slate-900 hover:bg-slate-800 text-xs font-semibold h-8"
              >
                {language === "id" ? "Ubah Stage" : "Change Stage"}
              </Button>
              <Button
                onClick={() => {
                  setNewCertifiedValue(claim.claimedValue);
                  setShowRecertifyModal(true);
                }}
                variant="outline"
                size="sm"
                className="text-xs font-semibold h-8 text-emerald-800 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 gap-1"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>{language === "id" ? "Update BAP Sertifikasi" : "Recertify (Update BAP)"}</span>
              </Button>
              <Button
                onClick={() => setShowBlockerModal(true)}
                variant="outline"
                size="sm"
                className="text-xs font-semibold h-8 text-amber-800 border-amber-300 bg-amber-50 hover:bg-amber-100 gap-1"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{language === "id" ? "Tambah Blocker" : "Add Blocker"}</span>
              </Button>
              <Button
                onClick={() => setShowInvoiceModal(true)}
                variant="outline"
                size="sm"
                className="text-xs font-semibold h-8 text-blue-800 border-blue-300 bg-blue-50 hover:bg-blue-100 gap-1"
              >
                <Receipt className="h-3.5 w-3.5" />
                <span>{language === "id" ? "Terbitkan Faktur" : "Issue Invoice"}</span>
              </Button>
              <Button
                onClick={() => setShowDocModal(true)}
                variant="outline"
                size="sm"
                className="text-xs font-semibold h-8 text-purple-900 border-purple-300 bg-purple-50 hover:bg-purple-100 gap-1"
              >
                <FileText className="h-3.5 w-3.5 text-purple-700" />
                <span>{language === "id" ? "Cetak BAP & Kuitansi" : "Print BAP & Receipt"}</span>
              </Button>
              <Button
                onClick={() => setShowWhatsAppModal(true)}
                variant="outline"
                size="sm"
                className="text-xs font-semibold h-8 text-emerald-900 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 gap-1"
              >
                <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                <span>{language === "id" ? "Kirim WA" : "Dispatch WA"}</span>
              </Button>
              <Button
                onClick={() => setShowGeotagModal(true)}
                variant="outline"
                size="sm"
                className="text-xs font-semibold h-8 text-teal-900 border-teal-300 bg-teal-50 hover:bg-teal-100 gap-1"
              >
                <Camera className="h-3.5 w-3.5 text-teal-600" />
                <span>{language === "id" ? "Foto Geotag" : "Geotag Photo"}</span>
              </Button>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-8 flex-1">
            {/* 1. Summary Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[11px] text-slate-400 font-semibold uppercase block">Stage Aging</span>
                <span className="font-bold text-slate-900 font-mono mt-0.5 block">{agingDays} {language === "id" ? "hari di stage" : "days in stage"}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 font-semibold uppercase block">{t("act.assignee", "Owner")}</span>
                <span className="font-bold text-slate-900 mt-0.5 block truncate">{owner?.fullName || "Dimas Sucipto"}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 font-semibold uppercase block">{language === "id" ? "Target Kas Cair" : "Expected Cash"}</span>
                <span className="font-bold text-slate-900 font-mono mt-0.5 block">{claim.expectedCashDate || "-"}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 font-semibold uppercase block">{t("dash.kpi.cash_at_risk", "Cash at Risk")}</span>
                <span className="font-bold font-mono text-red-700 mt-0.5 block">
                  {risk.totalCashAtRisk > 0 ? formatIDR(risk.totalCashAtRisk) : "Rp 0"}
                </span>
              </div>
            </div>

            {/* Risk Reasons Callout */}
            {risk.riskLevel !== "HEALTHY" && (
              <div className="p-4 rounded-xl border border-red-200 bg-red-50/70 text-xs">
                <div className="flex items-center gap-2 text-red-800 font-bold mb-1.5">
                  <ShieldAlert className="h-4 w-4" />
                  <span>{language === "id" ? "Diagnosis Risiko & Sinyal Pemicu" : "Risk Diagnosis & Triggered Signals"}</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-red-900 font-medium">
                  {risk.riskReasons.map((r, idx) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 2. Economic Progression Values */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {language === "id" ? "Perjalanan Nilai Ekonomi (Progression Values)" : "Economic Progression & Values"}
                </h4>
                <button
                  onClick={() => {
                    setNewCertifiedValue(claim.claimedValue);
                    setShowRecertifyModal(true);
                  }}
                  className="text-xs text-blue-700 font-semibold hover:underline flex items-center gap-1"
                >
                  <Edit3 className="h-3 w-3" />
                  <span>{language === "id" ? "Update BAP" : "Update Certified BAP"}</span>
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">{t("p2c.summary.work_performed", "Work Performed")}</span>
                  <span className="text-sm font-black font-mono text-slate-900 block mt-1">
                    {formatIDR(claim.workPerformedValue)}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">{t("p2c.summary.measured", "Measured / Opname")}</span>
                  <span className="text-sm font-black font-mono text-slate-900 block mt-1">
                    {formatIDR(claim.measuredValue)}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">{t("p2c.summary.claimed", "Claimed")}</span>
                  <span className="text-sm font-black font-mono text-slate-900 block mt-1">
                    {formatIDR(claim.claimedValue)}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">{t("p2c.summary.certified", "Certified (BAP)")}</span>
                  <span className="text-sm font-black font-mono text-emerald-700 block mt-1">
                    {formatIDR(claim.certifiedValue)}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">{t("p2c.summary.invoiced", "Invoiced Gross")}</span>
                  <span className="text-sm font-black font-mono text-blue-700 block mt-1">
                    {formatIDR(invoicedGross)}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">{t("p2c.summary.collected", "Cash Collected")}</span>
                  <span className="text-sm font-black font-mono text-emerald-700 block mt-1">
                    {formatIDR(claim.cashReceivedValue)}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Gap Analysis Cards */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                {language === "id" ? "Rincian Gap Nilai (Tertahan di Tahap)" : "Value Gap Breakdown"}
              </h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden text-xs">
                <div className="p-3.5 flex justify-between items-center">
                  <span className="text-slate-700 font-medium">{t("p2c.gap.unmeasured", "Unmeasured Gap (Work - Measured)")}</span>
                  <span className="font-mono font-bold text-slate-900">{formatIDR(gaps.unmeasuredValue)}</span>
                </div>
                <div className="p-3.5 flex justify-between items-center">
                  <span className="text-slate-700 font-medium">{t("p2c.gap.unclaimed", "Unclaimed Gap (Measured - Claimed)")}</span>
                  <span className="font-mono font-bold text-slate-900">{formatIDR(gaps.unclaimedValue)}</span>
                </div>
                <div className={`p-3.5 flex justify-between items-center ${gaps.uncertifiedValue > 0 ? "bg-amber-50/50" : ""}`}>
                  <span className={gaps.uncertifiedValue > 0 ? "text-amber-900 font-semibold" : "text-slate-700 font-medium"}>
                    {t("p2c.gap.uncertified", "Uncertified Gap (Claimed - Certified)")}
                  </span>
                  <span className={`font-mono ${gaps.uncertifiedValue > 0 ? "font-extrabold text-amber-900" : "font-bold text-slate-900"}`}>
                    {formatIDR(gaps.uncertifiedValue)}
                  </span>
                </div>
                <div className="p-3.5 flex justify-between items-center">
                  <span className="text-slate-700 font-medium">{t("p2c.gap.certified_not_invoiced", "Certified Not Invoiced")}</span>
                  <span className="font-mono font-bold text-slate-900">{formatIDR(gaps.certifiedNotInvoicedValue)}</span>
                </div>
                <div className="p-3.5 flex justify-between items-center">
                  <span className="text-slate-700 font-medium">{t("p2c.gap.invoiced_not_collected", "Invoice Outstanding / Piutang")}</span>
                  <span className="font-mono font-bold text-slate-900">{formatIDR(gaps.invoicedNotCollectedValue)}</span>
                </div>
              </div>
            </div>

            {/* 4. Active Blockers Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {language === "id" ? `Kendala / Blocker Aktif (${claimBlockers.length})` : `Active Blockers (${claimBlockers.length})`}
                </h4>
                <button
                  onClick={() => setShowBlockerModal(true)}
                  className="text-xs text-blue-700 font-semibold hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  <span>{language === "id" ? "Tambah" : "Add"}</span>
                </button>
              </div>

              {claimBlockers.length === 0 ? (
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                  {language === "id" ? "Tidak ada blocker aktif pada klaim ini." : "No active blockers on this claim."}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {claimBlockers.map((blk) => (
                    <div key={blk.id} className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/50 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900">{blk.title}</span>
                        <span className="font-mono font-bold text-red-700">{formatIDR(blk.financialExposure)}</span>
                      </div>
                      <p className="text-slate-600 text-[11px] mb-2">{blk.description}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-amber-200 pt-1.5">
                        <span>Controllability: <strong className="uppercase">{blk.controllability}</strong></span>
                        <span>Target: {blk.targetResolveDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 5. Evidence Checklist */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                {language === "id" ? "Daftar Kelengkapan Bukti (Evidence Checklist)" : "Evidence Requirements Checklist"}
              </h4>
              <EvidenceChecklist />
            </div>

            {/* 6. Invoices & Payments Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {language === "id" ? `Faktur & Penerimaan Kas (${claimInvoices.length})` : `Invoices & Payments (${claimInvoices.length})`}
                </h4>
                <button
                  onClick={() => setShowInvoiceModal(true)}
                  className="text-xs text-blue-700 font-semibold hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  <span>{language === "id" ? "Faktur Baru" : "New Invoice"}</span>
                </button>
              </div>

              {claimInvoices.length === 0 ? (
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                  {language === "id" ? "Belum ada faktur yang diterbitkan untuk klaim ini." : "No invoices issued for this claim yet."}
                </div>
              ) : (
                <div className="space-y-3">
                  {claimInvoices.map((inv) => (
                    <div key={inv.id} className="p-4 rounded-lg border border-slate-200 bg-white shadow-2xs text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 font-mono">{inv.invoiceNumber}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                          {inv.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 py-1 text-[11px]">
                        <div>
                          <span className="text-slate-400 block">{t("inv.gross", "Gross")}</span>
                          <span className="font-bold text-slate-900 font-mono">{formatIDR(inv.grossAmount)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{t("inv.received", "Diterima")}</span>
                          <span className="font-bold text-emerald-700 font-mono">{formatIDR(inv.cashReceivedAmount)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{t("inv.outstanding", "Sisa Piutang")}</span>
                          <span className="font-bold text-amber-700 font-mono">{formatIDR(inv.outstandingAmount)}</span>
                        </div>
                      </div>

                      {inv.outstandingAmount > 0 && (
                        <div className="pt-2 border-t border-slate-100 flex justify-end">
                          <Button
                            onClick={() => {
                              setSelectedInvoiceId(inv.id);
                              setShowReceiptModal(true);
                            }}
                            size="sm"
                            className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs h-7 gap-1"
                          >
                            <Receipt className="h-3 w-3" />
                            <span>{t("inv.record_receipt", "Catat Kas Masuk")}</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <StageTransitionModal
        open={showStageModal}
        onOpenChange={setShowStageModal}
        claimId={claim.id}
        currentStage={claim.currentStage}
      />

      <BlockerModal
        open={showBlockerModal}
        onOpenChange={setShowBlockerModal}
        claimId={claim.id}
        projectId={claim.projectId}
      />

      <InvoiceModal
        open={showInvoiceModal}
        onOpenChange={setShowInvoiceModal}
        claimId={claim.id}
        projectId={claim.projectId}
        defaultGross={claim.certifiedValue || 2100000000}
      />

      <CashReceiptModal
        open={showReceiptModal}
        onOpenChange={setShowReceiptModal}
        invoiceId={selectedInvoiceId || claimInvoices[0]?.id || ""}
        maxOutstanding={claimInvoices[0]?.outstandingAmount || 595000000}
      />

      {/* Recertification Modal */}
      <Dialog open={showRecertifyModal} onOpenChange={setShowRecertifyModal}>
        <DialogHeader>
          <DialogTitle>{language === "id" ? "Update Nilai Sertifikasi (BAP / MC Disetujui)" : "Update Certified Value (BAP / MC Approved)"}</DialogTitle>
          <DialogDescription>
            {language === "id" ? "Perbarui nilai sertifikasi setelah berita acara atau selisih volume dengan MK disepakati" : "Update certification value once quantity discrepancy is agreed with consultant"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleRecertifySubmit} className="space-y-4 text-xs">
          <div>
            <Label htmlFor="recert">{language === "id" ? "Nilai Sertifikasi Baru (IDR)" : "New Certified Value (IDR)"}</Label>
            <Input
              id="recert"
              type="number"
              required
              value={newCertifiedValue}
              onChange={(e) => setNewCertifiedValue(Number(e.target.value))}
              className="mt-1 font-mono text-base font-bold text-emerald-700"
            />
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900">
            <span className="font-bold block mb-1">{language === "id" ? "Dampak Finansial:" : "Financial Impact:"}</span>
            {language === "id"
              ? `Menaikkan nilai sertifikasi ke Rp ${newCertifiedValue.toLocaleString("id-ID")} akan langsung menghapus gap sertifikasi (Uncertified Gap) dan menurunkan Cash-at-Risk.`
              : `Increasing certified value to Rp ${newCertifiedValue.toLocaleString("id-ID")} immediately clears uncertified gap and reduces Cash-at-Risk.`}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowRecertifyModal(false)}>
              {t("common.cancel", "Batal")}
            </Button>
            <Button type="submit" className="bg-emerald-700 text-white font-bold">
              {t("common.save", "Simpan Sertifikasi")}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Official BAP & Receipt Printable Document Modal */}
      <DocumentPreviewModal
        open={showDocModal}
        onOpenChange={setShowDocModal}
        claimId={claim.id}
        projectId={claim.projectId}
      />

      {/* WhatsApp Dispatcher Modal */}
      <WhatsAppDispatchModal
        open={showWhatsAppModal}
        onOpenChange={setShowWhatsAppModal}
        defaultPayload={{
          projectName: project?.projectName,
          claimNumber: claim.claimNumber,
          amount: risk.totalCashAtRisk > 0 ? risk.totalCashAtRisk : claim.claimedValue,
          agingDays,
          blockerTitle: claimBlockers[0]?.title || "Persetujuan volume fisik belum disahkan MK",
          messageType: claim.currentStage.includes("CERTIFIED") || claim.certifiedValue > 0 ? "BAP_APPROVED" : "SLA_ALERT",
        }}
      />

      {/* Geotagged Field Photo Uploader Modal */}
      <GeotagPhotoUploader
        open={showGeotagModal}
        onOpenChange={setShowGeotagModal}
        claimId={claim.id}
        projectId={claim.projectId}
      />

      {/* In-App Smart Document & Photo Viewer */}
      <SmartDocumentViewer
        open={Boolean(selectedDocForView)}
        onOpenChange={(op) => !op && setSelectedDocForView(null)}
        document={selectedDocForView}
      />
    </div>
  );
}
