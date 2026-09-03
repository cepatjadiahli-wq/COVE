"use client";

import React, { useState } from "react";
import { formatIDR } from "@/lib/utils";
import {
  evaluateReadiness,
  calculateInternalTargetDate,
  calculateValueAtRiskOfMissingCutOff,
  READINESS_LEGAL_DISCLAIMER,
  ClaimReadinessItem,
  RequirementLevel,
  ReadinessItemStatus,
} from "@/domains/readiness/service";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Link as LinkIcon,
  ShieldAlert,
  HelpCircle,
  FileCheck,
  UserCheck,
  Calendar,
  XCircle,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface EvidenceChecklistProps {
  claimId?: string;
}

export function EvidenceChecklist({ claimId: propClaimId }: EvidenceChecklistProps) {
  const { refreshState, currentUser } = useTenant();
  const { language } = useLanguage();

  // Pick claim
  const claimId = propClaimId || "clm-meridian-006";
  const claim = coveStore.claims.find((c) => c.id === claimId);

  // Get claim readiness items
  let items = coveStore.getClaimReadinessItems(claimId);

  // If no items yet, copy from template automatically (RDY-003)
  if (items.length === 0 && claim) {
    items = coveStore.copyChecklistToClaim(claim.id, claim.projectId, currentUser.fullName);
  }

  // Get active template for metadata
  const activeChecklist = claim ? coveStore.getActiveContractChecklist(claim.projectId) : undefined;
  const templateVersion = claim?.readinessTemplateVersion || activeChecklist?.version || "1.0";
  const internalLeadTime = activeChecklist?.internalLeadTimeDays || 5;

  // Cut-off and internal target date (RDY-008)
  const cutOffDate = claim?.cutOffDate || "2026-08-25";
  const internalTargetDate = claim?.internalTargetDate || calculateInternalTargetDate(cutOffDate, internalLeadTime);

  // Modal States
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [selectedItemForDoc, setSelectedItemForDoc] = useState<ClaimReadinessItem | null>(null);
  const [docUrl, setDocUrl] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [docNotes, setDocNotes] = useState("");

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedItemForAssign, setSelectedItemForAssign] = useState<ClaimReadinessItem | null>(null);
  const [assignedOwnerName, setAssignedOwnerName] = useState("");
  const [assignedDueDate, setAssignedDueDate] = useState("");

  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideApprover, setOverrideApprover] = useState(currentUser.fullName || "Dimas Sucipto (Commercial Manager)");
  const [overrideReason, setOverrideReason] = useState("");

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedItemForReject, setSelectedItemForReject] = useState<ClaimReadinessItem | null>(null);
  const [itemRejectionReason, setItemRejectionReason] = useState("");

  const [externalRejectModalOpen, setExternalRejectModalOpen] = useState(false);
  const [externalRejectionReason, setExternalRejectionReason] = useState("");

  // Evaluate readiness
  const evaluation = evaluateReadiness(
    items as ClaimReadinessItem[],
    claim?.overrideReady,
    claim?.currentStage === "SUBMITTED"
  );

  // Value at risk of missing cut-off (RDY-011)
  const varResult = calculateValueAtRiskOfMissingCutOff(
    {
      claimedValue: claim?.claimedValue,
      workPerformedValue: claim?.workPerformedValue,
      readinessStatus: evaluation.readinessStatus,
      cutOffDate,
      internalTargetDate,
      overrideReady: claim?.overrideReady,
    },
    evaluation
  );

  // Handlers
  const handleOpenDocModal = (item: ClaimReadinessItem) => {
    setSelectedItemForDoc(item);
    setDocUrl(item.documentUrl || "");
    setDocTitle(item.documentTitle || "");
    setDocNotes(item.notes || "");
    setDocumentModalOpen(true);
  };

  const handleSaveDocument = () => {
    if (!selectedItemForDoc) return;
    coveStore.updateClaimReadinessItem(
      claimId,
      selectedItemForDoc.id,
      {
        documentUrl: docUrl.trim() || undefined,
        documentTitle: docTitle.trim() || selectedItemForDoc.name,
        notes: docNotes.trim() || undefined,
        status: docUrl.trim() ? "PRESENT" : selectedItemForDoc.status,
      },
      currentUser.fullName
    );
    setDocumentModalOpen(false);
    refreshState();
  };

  const handleVerifyItem = (item: ClaimReadinessItem) => {
    coveStore.updateClaimReadinessItem(
      claimId,
      item.id,
      { status: "VERIFIED" },
      currentUser.fullName
    );
    refreshState();
  };

  const handleOpenRejectModal = (item: ClaimReadinessItem) => {
    setSelectedItemForReject(item);
    setItemRejectionReason("");
    setRejectModalOpen(true);
  };

  const handleConfirmRejectItem = () => {
    if (!selectedItemForReject) return;
    coveStore.updateClaimReadinessItem(
      claimId,
      selectedItemForReject.id,
      {
        status: "REJECTED",
        rejectionReason: itemRejectionReason.trim() || "Dokumen belum memenuhi spesifikasi teknis",
      },
      currentUser.fullName
    );
    setRejectModalOpen(false);
    refreshState();
  };

  const handleOpenAssignModal = (item: ClaimReadinessItem) => {
    setSelectedItemForAssign(item);
    setAssignedOwnerName(item.actionOwnerName || currentUser.fullName);
    setAssignedDueDate(item.dueDate || internalTargetDate);
    setAssignModalOpen(true);
  };

  const handleSaveAssignAction = () => {
    if (!selectedItemForAssign || !assignedOwnerName.trim() || !assignedDueDate) {
      alert("Nama penanggung jawab dan batas waktu wajib diisi (RDY-007).");
      return;
    }
    coveStore.assignMissingItemAction(
      claimId,
      selectedItemForAssign.id,
      assignedOwnerName.trim(),
      assignedDueDate,
      currentUser.fullName
    );
    setAssignModalOpen(false);
    refreshState();
  };

  const handleConfirmOverride = () => {
    if (!overrideApprover.trim() || !overrideReason.trim()) {
      alert("Nama pejabat pemberi persetujuan dan alasan bisnis wajib diisi (RDY-009).");
      return;
    }
    coveStore.overrideClaimReadiness(claimId, overrideApprover.trim(), overrideReason.trim());
    setOverrideModalOpen(false);
    refreshState();
  };

  const handleConfirmExternalRejection = () => {
    if (!externalRejectionReason.trim()) {
      alert("Alasan penolakan dari konsultan MK/Owner wajib diisi (RDY-012).");
      return;
    }
    coveStore.reopenClaimAfterRejection(claimId, externalRejectionReason.trim(), currentUser.fullName);
    setExternalRejectModalOpen(false);
    setExternalRejectionReason("");
    refreshState();
  };

  return (
    <div className="space-y-4 text-xs">
      {/* 1. Legal Disclaimer Notice (RDY-013) */}
      <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg flex items-start gap-2 text-amber-900 text-[11px]">
        <HelpCircle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
        <div>
          <span className="font-bold block">Prinsip Batasan Produk (PRD RDY-013):</span>
          <span>{READINESS_LEGAL_DISCLAIMER}</span>
        </div>
      </div>

      {/* 2. Cut-Off, Lead Time & Value-at-Risk Banner (RDY-008, RDY-011) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50">
        <div>
          <span className="text-[10px] text-slate-500 font-bold uppercase block">
            Jadwal Cut-Off &amp; Target Internal (RDY-008)
          </span>
          <div className="flex items-center gap-2 mt-1">
            <Calendar className="h-4 w-4 text-blue-700" />
            <span className="font-bold text-slate-900 font-mono text-xs">
              Target: {internalTargetDate} (H-{internalLeadTime})
            </span>
          </div>
          <span className="text-[10px] text-slate-500">Cut-Off Resmi MK: {cutOffDate}</span>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 font-bold uppercase block">
            Status Kesiapan Klaim (RDY-006)
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`px-2.5 py-0.5 rounded font-bold font-mono text-xs ${
                evaluation.readinessStatus === "READY"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : evaluation.readinessStatus === "SUBMITTED"
                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                  : "bg-rose-100 text-rose-800 border border-rose-300 animate-pulse"
              }`}
            >
              {evaluation.readinessStatus} ({evaluation.readinessScore}%)
            </span>
            {claim?.overrideReady && (
              <span className="text-[10px] bg-purple-100 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded font-bold">
                OVERRIDDEN
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500">
            Template Checklist v{templateVersion} ({evaluation.verifiedCount}/{evaluation.requiredCount + evaluation.conditionalCount} syarat lolos)
          </span>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 font-bold uppercase block">
            Value at Risk of Missing Cut-Off (RDY-011)
          </span>
          <span className="font-bold font-mono text-sm text-red-700 block mt-1">
            {formatIDR(varResult.valueAtRisk)}
          </span>
          <span className="text-[10px] text-slate-500">
            {varResult.isAtRisk ? "⚠️ Terancam bergeser 1 siklus penagihan" : "Klaim siap / tidak terancam"}
          </span>
        </div>
      </div>

      {/* 3. Rejection / Resubmission Notification (RDY-012) */}
      {claim?.resubmissionCount && claim.resubmissionCount > 0 ? (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-red-700 shrink-0" />
            <div>
              <span className="font-bold text-red-900 block">
                Pengajuan Ulang #{claim.resubmissionCount} (Checklist Dibuka Kembali)
              </span>
              <span className="text-[11px] text-red-700">
                Alasan Penolakan MK: {claim.lastRejectionReason || "-"}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* 4. Readiness Progress Bar & Actions */}
      <div className="flex items-center justify-between gap-4 pt-1">
        <div className="flex-1">
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                evaluation.readinessScore === 100 ? "bg-emerald-600" : "bg-blue-600"
              }`}
              style={{ width: `${evaluation.readinessScore}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {evaluation.readinessStatus !== "READY" && !claim?.overrideReady && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOverrideModalOpen(true)}
              className="h-7 text-[11px] text-purple-700 border-purple-200 hover:bg-purple-50 font-semibold gap-1"
            >
              <ShieldCheck className="h-3 w-3" />
              <span>Override Gate (RDY-009)</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setExternalRejectModalOpen(true)}
            className="h-7 text-[11px] text-red-700 border-red-200 hover:bg-red-50 font-semibold gap-1"
          >
            <XCircle className="h-3 w-3" />
            <span>Catat Penolakan MK (RDY-012)</span>
          </Button>
        </div>
      </div>

      {/* 5. Checklist Items Table */}
      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
        {items.map((item) => {
          const isMissingRequired =
            item.requirementLevel === "REQUIRED" && item.status === "MISSING";
          const needsOwner = isMissingRequired && (!item.actionOwnerName || !item.dueDate);

          return (
            <div
              key={item.id}
              className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
            >
              {/* Left Column: Item Name, Level Badge, and Contract Source Clause (RDY-010) */}
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                      item.requirementLevel === "REQUIRED"
                        ? "bg-red-50 text-red-800 border-red-200"
                        : item.requirementLevel === "CONDITIONAL"
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {item.requirementLevel}
                  </span>

                  <span className="font-bold text-slate-900 text-xs">{item.name}</span>

                  {/* Status Badge */}
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                      item.status === "VERIFIED"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : item.status === "PRESENT"
                        ? "bg-blue-50 text-blue-800 border-blue-200"
                        : item.status === "REJECTED"
                        ? "bg-red-50 text-red-800 border-red-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                {/* Contract Reference Clause (RDY-010) */}
                <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-3">
                  <span className="text-slate-600 font-medium">
                    Klausul: <strong>{item.sourceClauseReference || "Spesifikasi Umum"}</strong>
                  </span>

                  {/* Document Link / Metadata (RDY-004) */}
                  {item.documentUrl ? (
                    <a
                      href={item.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-700 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <LinkIcon className="h-3 w-3" />
                      <span>{item.documentTitle || "Lihat Tautan Berkas"}</span>
                    </a>
                  ) : (
                    <span className="text-slate-400 italic">Belum ada tautan berkas</span>
                  )}
                </div>

                {/* Assigned Action Owner for Missing Item (RDY-007) */}
                {item.status === "MISSING" && (
                  <div className="text-[10px] text-slate-600 flex items-center gap-2 pt-0.5">
                    {item.actionOwnerName ? (
                      <span className="bg-amber-50 border border-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                        PIC: <strong>{item.actionOwnerName}</strong> • Target: {item.dueDate || "-"}
                      </span>
                    ) : (
                      <span className="text-red-700 font-bold flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Belum ada PIC tindakan penuntasan (Wajib RDY-007)</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Verification audit stamp (RDY-005) */}
                {item.status === "VERIFIED" && item.verifiedByName && (
                  <div className="text-[10px] text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Diverifikasi oleh: {item.verifiedByName} ({item.verifiedAt?.substring(0, 10)})</span>
                  </div>
                )}
              </div>

              {/* Right Column: Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* 1. Input Link / Metadata Modal Button (RDY-004) */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenDocModal(item)}
                  className="h-7 text-[10px] px-2 font-medium"
                >
                  <LinkIcon className="h-3 w-3 mr-1" />
                  <span>{item.documentUrl ? "Edit Link" : "Input Link"}</span>
                </Button>

                {/* 2. Assign Action Owner (RDY-007) */}
                {item.status === "MISSING" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenAssignModal(item)}
                    className="h-7 text-[10px] px-2 font-medium text-amber-800 border-amber-200 hover:bg-amber-50"
                  >
                    <UserCheck className="h-3 w-3 mr-1" />
                    <span>{item.actionOwnerName ? "Ubah PIC" : "Tugaskan PIC"}</span>
                  </Button>
                )}

                {/* 3. Verify Button (RDY-005, UAT-06) */}
                {item.status !== "VERIFIED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleVerifyItem(item)}
                    className="h-7 text-[10px] px-2 font-bold text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    <span>Verifikasi</span>
                  </Button>
                )}

                {/* 4. Reject Button (RDY-005) */}
                {item.status !== "REJECTED" && item.status !== "MISSING" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenRejectModal(item)}
                    className="h-7 text-[10px] px-2 text-red-700 border-red-200 hover:bg-red-50"
                  >
                    Tolak
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Document Link Modal (RDY-004) */}
      <Dialog open={documentModalOpen} onOpenChange={setDocumentModalOpen}>
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-blue-700" />
            <span>Tautkan Metadata Dokumen Bukti (PRD RDY-004)</span>
          </DialogTitle>
          <DialogDescription>
            Sesuai PRD MVP, bukti dokumen disimpan sebagai URL tautan (Google Drive, Cloud Storage, ERP)
            beserta metadata tanpa kewajiban upload file binary.
          </DialogDescription>
        </DialogHeader>

        {selectedItemForDoc && (
          <div className="space-y-3 text-xs">
            <div className="p-2.5 bg-slate-50 rounded border text-[11px]">
              Item: <strong>{selectedItemForDoc.name}</strong>
              <div className="text-slate-500">Dasar: {selectedItemForDoc.sourceClauseReference}</div>
            </div>

            <div>
              <Label htmlFor="docUrl">URL Berkas Eksternal / Tautan Penyimpanan *</Label>
              <Input
                id="docUrl"
                placeholder="https://drive.google.com/... atau https://storage.cove.internal/..."
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label htmlFor="docTitle">Judul / Nama Dokumen Bukti</Label>
              <Input
                id="docTitle"
                placeholder="Contoh: Berita Acara Opname MC-006 Signed IndoKarya.pdf"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="docNotes">Catatan / Keterangan Tambahan</Label>
              <Input
                id="docNotes"
                placeholder="Contoh: Lembar persetujuan volume halaman 3 sudah diteken MK"
                value={docNotes}
                onChange={(e) => setDocNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setDocumentModalOpen(false)}>
            Batal
          </Button>
          <Button onClick={handleSaveDocument} className="bg-slate-900 hover:bg-slate-800 text-white font-bold">
            Simpan Tautan &amp; Tandai Present
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Assign Missing Item Action Modal (RDY-007) */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-amber-700" />
            <span>Penugasan PIC Penuntasan Dokumen (PRD RDY-007)</span>
          </DialogTitle>
          <DialogDescription>
            Tidak ada dokumen wajib yang kurang tanpa penanggung jawab tindakan (action owner) dan batas waktu (due date).
          </DialogDescription>
        </DialogHeader>

        {selectedItemForAssign && (
          <div className="space-y-3 text-xs">
            <div className="p-2.5 bg-amber-50 rounded border border-amber-200 text-amber-900 text-[11px]">
              Dokumen Kurang: <strong>{selectedItemForAssign.name}</strong>
            </div>

            <div>
              <Label htmlFor="picName">Nama Penanggung Jawab Tindakan (Owner) *</Label>
              <Input
                id="picName"
                required
                value={assignedOwnerName}
                onChange={(e) => setAssignedOwnerName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="picDueDate">Batas Waktu Penuntasan (Due Date) *</Label>
              <Input
                id="picDueDate"
                type="date"
                required
                value={assignedDueDate}
                onChange={(e) => setAssignedDueDate(e.target.value)}
                className="mt-1 font-mono"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                Disarankan: Sebelum internal target date ({internalTargetDate})
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setAssignModalOpen(false)}>
            Batal
          </Button>
          <Button onClick={handleSaveAssignAction} className="bg-amber-700 hover:bg-amber-800 text-white font-bold">
            Tetapkan PIC &amp; Buat Tindakan
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Commercial Manager Readiness Override Modal (RDY-009, UAT-07) */}
      <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen}>
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-purple-900 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-purple-700" />
            <span>Persetujuan Override Kesiapan Klaim (PRD RDY-009)</span>
          </DialogTitle>
          <DialogDescription>
            Meloloskan klaim ke tahap READY meskipun terdapat item wajib yang belum terverifikasi membutuhkan
            otorisasi pejabat berwenang (Commercial Manager) dan pencatatan alasan bisnis wajib.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          <div className="p-2.5 bg-purple-50 rounded border border-purple-200 text-purple-950 text-[11px]">
            <div>Klaim: <strong>{claim?.claimNumber}</strong></div>
            <div>Item Belum Terverifikasi: <strong>{evaluation.blockingCount} dokumen</strong></div>
          </div>

          <div>
            <Label htmlFor="overrideApprover">Pejabat Pemberi Otorisasi (Approver) *</Label>
            <Input
              id="overrideApprover"
              required
              value={overrideApprover}
              onChange={(e) => setOverrideApprover(e.target.value)}
              className="mt-1 font-medium"
            />
          </div>

          <div>
            <Label htmlFor="overrideReason">Alasan Bisnis &amp; Mitigasi Risiko Override *</Label>
            <Input
              id="overrideReason"
              required
              placeholder="Contoh: Dokumen asli VO diserahkan langsung saat rapat BAP dengan MK"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOverrideModalOpen(false)}>
            Batal
          </Button>
          <Button onClick={handleConfirmOverride} className="bg-purple-800 hover:bg-purple-900 text-white font-bold">
            Setujui Override &amp; Catat Audit
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Reject Item Modal (RDY-005) */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-red-900">
            Tolak Dokumen Bukti
          </DialogTitle>
          <DialogDescription>
            Catat alasan penolakan dokumen agar PIC dapat memperbaiki atau mengunggah revisi.
          </DialogDescription>
        </DialogHeader>

        {selectedItemForReject && (
          <div className="space-y-3 text-xs">
            <div className="p-2 bg-slate-50 rounded border font-medium">
              Item: {selectedItemForReject.name}
            </div>
            <div>
              <Label htmlFor="rejReason">Alasan Penolakan Dokumen</Label>
              <Input
                id="rejReason"
                required
                placeholder="Contoh: Tanda tangan Site Engineer belum lengkap"
                value={itemRejectionReason}
                onChange={(e) => setItemRejectionReason(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
            Batal
          </Button>
          <Button onClick={handleConfirmRejectItem} className="bg-red-700 hover:bg-red-800 text-white font-bold">
            Konfirmasi Tolak
          </Button>
        </DialogFooter>
      </Dialog>

      {/* External Rejection by MK Modal (RDY-012) */}
      <Dialog open={externalRejectModalOpen} onOpenChange={setExternalRejectModalOpen}>
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-red-900 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-700" />
            <span>Pencatatan Penolakan Eksternal Konsultan MK (RDY-012)</span>
          </DialogTitle>
          <DialogDescription>
            Sesuai PRD RDY-012, jika pengajuan klaim ditolak oleh Konsultan MK atau Klien,
            sistem mencatat alasan penolakan, menambah resubmission counter, dan membuka kembali checklist kesiapan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          <div>
            <Label htmlFor="extRejReason">Alasan Penolakan Konsultan MK / Pemberi Tugas *</Label>
            <Input
              id="extRejReason"
              required
              placeholder="Contoh: Perbedaan metode perhitungan kubikasi beton pada zona barat"
              value={externalRejectionReason}
              onChange={(e) => setExternalRejectionReason(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setExternalRejectModalOpen(false)}>
            Batal
          </Button>
          <Button onClick={handleConfirmExternalRejection} className="bg-red-800 hover:bg-red-900 text-white font-bold">
            Catat Penolakan &amp; Buka Kembali Checklist
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
