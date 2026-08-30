"use client";

import React, { useState } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatIDR } from "@/lib/utils";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";

interface VariationOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function VariationOrderModal({
  open,
  onOpenChange,
  projectId,
}: VariationOrderModalProps) {
  const { refreshState } = useTenant();
  const project = coveStore.projects.find((p) => p.id === projectId);
  const contract = coveStore.contracts.find((c) => c.projectId === projectId);

  const [voNumber, setVoNumber] = useState(`ADD-01-${project?.projectCode || "PRJ"}`);
  const [changeType, setChangeType] = useState<"PEKERJAAN_TAMBAH" | "PEKERJAAN_KURANG" | "TIME_EXTENSION" | "SPESIFIKASI">("PEKERJAAN_TAMBAH");
  const [title, setTitle] = useState("Pekerjaan Tambah Struktur Ramp Basement & Dinding Penahan");
  const [description, setDescription] = useState("Penambahan volume pembesian dan cor beton akibat perubahan elevasi muka air tanah sesuai instruksi lapangan Konsultan MK No. SI-042.");
  const [amountChange, setAmountChange] = useState<number>(850000000);
  const [timeExtensionDays, setTimeExtensionDays] = useState<number>(14);
  const [approvalStatus, setApprovalStatus] = useState<"APPROVED" | "UNDER_REVIEW" | "PROPOSED">("APPROVED");
  const [approvalDate, setApprovalDate] = useState(new Date().toISOString().split("T")[0]);

  const currentContractVal = contract?.currentContractValue || 32000000000;
  const newContractVal = changeType === "PEKERJAAN_KURANG" 
    ? currentContractVal - amountChange 
    : currentContractVal + amountChange;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (contract) {
      // Update contract value if approved
      if (approvalStatus === "APPROVED") {
        contract.currentContractValue = newContractVal;
      }

      // Record in audit log
      coveStore.auditLogs.unshift({
        id: "aud-" + Math.random().toString(36).substring(2, 9),
        entityType: "project",
        entityId: projectId,
        eventType: "VARIATION_ORDER_RECORDED",
        description: `Addendum / VO ${voNumber} dicatat: ${title} (${formatIDR(amountChange)}) - Status: ${approvalStatus}`,
        timestamp: new Date().toISOString(),
        user: "Dimas Sucipto (Commercial)",
      });
    }

    refreshState();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Catat Addendum / Variation Order (VO / CCO)</DialogTitle>
        <DialogDescription>
          Catat pekerjaan tambah/kurang dan amandemen kontrak resmi agar terlacak dalam penagihan klaim
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="vonum">Nomor Addendum / VO *</Label>
            <Input
              id="vonum"
              required
              value={voNumber}
              onChange={(e) => setVoNumber(e.target.value)}
              className="mt-1 font-mono"
            />
          </div>

          <div>
            <Label htmlFor="votype">Jenis Perubahan *</Label>
            <Select
              id="votype"
              value={changeType}
              onChange={(e) => setChangeType(e.target.value as any)}
              className="mt-1"
            >
              <option value="PEKERJAAN_TAMBAH">Pekerjaan Tambah (Add Cost)</option>
              <option value="PEKERJAAN_KURANG">Pekerjaan Kurang (Deduct Cost)</option>
              <option value="TIME_EXTENSION">Perpanjangan Waktu Saja (EOT)</option>
              <option value="SPESIFIKASI">Perubahan Spesifikasi Material</option>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="votitle">Judul / Ruang Lingkup Perubahan *</Label>
          <Input
            id="votitle"
            required
            placeholder="Contoh: Pekerjaan Tambah Struktur Ramp Basement & Dinding Penahan"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 font-semibold"
          />
        </div>

        <div>
          <Label htmlFor="vodesc">Deskripsi & Justifikasi Teknis / Site Instruction</Label>
          <Textarea
            id="vodesc"
            placeholder="Jelaskan dasar instruksi konsultan MK, Berita Acara Lapangan, dan volume pekerjaan..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="voamt">Nilai Finansial Perubahan (IDR) *</Label>
            <Input
              id="voamt"
              type="number"
              required
              value={amountChange}
              onChange={(e) => setAmountChange(Number(e.target.value))}
              className="mt-1 font-mono text-sm font-bold text-slate-900"
            />
          </div>

          <div>
            <Label htmlFor="votime">Kompensasi Waktu (Hari Kalender)</Label>
            <Input
              id="votime"
              type="number"
              value={timeExtensionDays}
              onChange={(e) => setTimeExtensionDays(Number(e.target.value))}
              className="mt-1 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="vostatus">Status Persetujuan MK & Owner</Label>
            <Select
              id="vostatus"
              value={approvalStatus}
              onChange={(e) => setApprovalStatus(e.target.value as any)}
              className="mt-1"
            >
              <option value="APPROVED">Disetujui (Approved by Owner/MK)</option>
              <option value="UNDER_REVIEW">Dalam Evaluasi Konsultan MK</option>
              <option value="PROPOSED">Diajukan Kontraktor (Proposed)</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="vodate">Tanggal Pengesahan</Label>
            <Input
              id="vodate"
              type="date"
              value={approvalDate}
              onChange={(e) => setApprovalDate(e.target.value)}
              className="mt-1 font-mono"
            />
          </div>
        </div>

        {/* Impact Summary Box */}
        <div className="p-3.5 bg-slate-900 text-white rounded-lg space-y-1.5">
          <div className="flex justify-between text-[11px] text-slate-300">
            <span>Nilai Kontrak Sebelumnya:</span>
            <span className="font-mono">{formatIDR(currentContractVal)}</span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-300">
            <span>Penyesuaian Addendum:</span>
            <span className="font-mono text-emerald-400">
              {changeType === "PEKERJAAN_KURANG" ? "-" : "+"} {formatIDR(amountChange)}
            </span>
          </div>
          <div className="border-t border-slate-700 pt-1.5 flex justify-between font-bold text-sm text-emerald-400">
            <span>Nilai Kontrak Baru (Amandemen):</span>
            <span className="font-mono">{formatIDR(newContractVal)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button type="submit" className="bg-slate-900 text-white font-bold">
            Simpan Addendum / VO
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
