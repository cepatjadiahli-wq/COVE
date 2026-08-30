"use client";

import React, { useState } from "react";
import { formatIDR } from "@/lib/utils";
import {
  INITIAL_SUBCON_CLAIMS,
  SubcontractorClaim,
  calculatePwpPortfolioSummary,
  PwpStatus,
} from "@/lib/finance/pay-when-paid";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Users,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Plus,
  ArrowUpRight,
  Landmark,
} from "lucide-react";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function SubcontractorsPage() {
  const { refreshState, currentUser } = useTenant();
  const { language } = useLanguage();

  const [subconClaims, setSubconClaims] = useState<SubcontractorClaim[]>(INITIAL_SUBCON_CLAIMS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSubconForDisburse, setSelectedSubconForDisburse] = useState<SubcontractorClaim | null>(null);
  const [disburseAmount, setDisburseAmount] = useState<number>(0);
  const [disburseNotes, setDisburseNotes] = useState("");

  const summary = calculatePwpPortfolioSummary(subconClaims);

  const filteredList = subconClaims.filter((s) => {
    const matchesSearch =
      s.subconName.toLowerCase().includes(search.toLowerCase()) ||
      s.tradeScope.toLowerCase().includes(search.toLowerCase()) ||
      s.spkNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.pwpStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAuthorizePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubconForDisburse) return;

    setSubconClaims((prev) =>
      prev.map((item) =>
        item.id === selectedSubconForDisburse.id
          ? {
              ...item,
              pwpStatus: "PAID",
              paidAmount: disburseAmount,
              authorizedDate: new Date().toISOString().split("T")[0],
            }
          : item
      )
    );

    coveStore.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      entityType: "project",
      entityId: selectedSubconForDisburse.projectId,
      eventType: "SUBCON_PAYMENT_DISBURSED",
      description: `Pencairan tagihan ${selectedSubconForDisburse.subconName} (${formatIDR(disburseAmount)}) berhasil diotorisasi.`,
      timestamp: new Date().toISOString(),
      user: currentUser.fullName,
    });

    refreshState();
    setSelectedSubconForDisburse(null);
  };

  const getPwpStatusBadge = (status: PwpStatus) => {
    switch (status) {
      case "LOCKED_WAITING_OWNER_BAP":
        return (
          <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
            <Lock className="h-3 w-3 text-red-600" />
            <span>Terkunci (Menunggu BAP Owner)</span>
          </span>
        );
      case "READY_FOR_VERIFICATION":
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
            <AlertTriangle className="h-3 w-3 text-amber-600" />
            <span>Siap Verifikasi QC</span>
          </span>
        );
      case "RELEASE_AUTHORIZED":
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            <span>Otorisasi Cair (Kas Masuk)</span>
          </span>
        );
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
            <span>Lunas / Disbursed</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {language === "id" ? "Kontrol Mandor & Subkontraktor (Pay-When-Paid)" : "Subcontractor & Pay-When-Paid Control"}
            </h1>
            <span className="text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Zero-Deficit Protection</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {language === "id"
              ? "Sinkronkan pencairan tagihan mandor dan subkon dengan realisasi kas masuk dari Owner untuk menjaga likuiditas perusahaan tidak boncos"
              : "Back-to-back cash disbursement matching to safeguard company working capital"}
          </p>
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[11px] text-slate-500 font-semibold uppercase block">Total Kewajiban Subkon</span>
          <span className="text-base sm:text-lg font-black font-mono text-slate-900 mt-1 block truncate">
            {formatIDR(summary.totalSubconPayables)}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-red-50/70 border border-red-200 text-red-950 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-red-700 font-semibold uppercase block">Terkunci (BAP Belum Cair)</span>
            <Lock className="h-3.5 w-3.5 text-red-600" />
          </div>
          <span className="text-base sm:text-lg font-black font-mono text-red-800 mt-1 block truncate">
            {formatIDR(summary.lockedByOwnerBap)}
          </span>
          <span className="text-[10px] text-red-600 block mt-0.5">Kas terlindungi dari penarikan dini</span>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-emerald-700 font-semibold uppercase block">Otorisasi Siap Cair</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <span className="text-base sm:text-lg font-black font-mono text-emerald-700 mt-1 block truncate">
            {formatIDR(summary.releaseAuthorized)}
          </span>
          <span className="text-[10px] text-emerald-600 block mt-0.5">Kas Owner sudah masuk ke bank</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 text-white shadow-2xs">
          <span className="text-[11px] text-slate-400 font-semibold uppercase block">Telah Dicairkan (Lunas)</span>
          <span className="text-base sm:text-lg font-black font-mono text-emerald-400 mt-1 block truncate">
            {formatIDR(summary.totalDisbursed)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Selesai rekonsiliasi</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama mandor, subkon, SPK, lingkup pekerjaan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs focus:bg-white focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 font-medium"
          >
            <option value="all">Semua Status Pay-When-Paid</option>
            <option value="LOCKED_WAITING_OWNER_BAP">🔴 Terkunci (Menunggu BAP Owner)</option>
            <option value="READY_FOR_VERIFICATION">🟡 Siap Verifikasi</option>
            <option value="RELEASE_AUTHORIZED">🟢 Otorisasi Cair (Kas Masuk)</option>
            <option value="PAID">⚪ Lunas</option>
          </select>
        </div>
      </div>

      {/* Table of Subcon Claims */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                <th className="py-3 px-4">Nama Mandor / Subkon</th>
                <th className="py-3 px-4">Lingkup Pekerjaan & SPK</th>
                <th className="py-3 px-4">Klaim Owner Terkait</th>
                <th className="py-3 px-4 text-right">Nilai Tagihan (IDR)</th>
                <th className="py-3 px-4">Status Pay-When-Paid</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.map((s) => {
                const isLocked = s.pwpStatus === "LOCKED_WAITING_OWNER_BAP";
                const isAuthorized = s.pwpStatus === "RELEASE_AUTHORIZED";

                return (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{s.subconName}</div>
                      <div className="text-[10px] text-slate-400">{s.subconType.replace("_", " ")}</div>
                    </td>

                    <td className="py-3.5 px-4 max-w-[240px]">
                      <div className="font-semibold text-slate-800 truncate">{s.tradeScope}</div>
                      <div className="text-[10px] font-mono text-slate-500">{s.spkNumber}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="bg-blue-50 text-blue-900 border border-blue-200 font-mono font-bold px-2 py-0.5 rounded text-[11px]">
                        {s.linkedClaimNumber}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-right">
                      {formatIDR(s.claimAmount)}
                    </td>

                    <td className="py-3.5 px-4">
                      {getPwpStatusBadge(s.pwpStatus)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {isAuthorized ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedSubconForDisburse(s);
                            setDisburseAmount(s.approvedAmount);
                          }}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-7 gap-1"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Cairkan Kas</span>
                        </Button>
                      ) : isLocked ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                          className="text-xs text-slate-400 h-7 gap-1 cursor-not-allowed"
                        >
                          <Lock className="h-3 w-3" />
                          <span>Terkunci</span>
                        </Button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">Selesai</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disburse Modal */}
      {selectedSubconForDisburse && (
        <Dialog open={Boolean(selectedSubconForDisburse)} onOpenChange={(op) => !op && setSelectedSubconForDisburse(null)}>
          <DialogHeader>
            <DialogTitle>Otorisasi Pencairan Kas Mandor / Subkon</DialogTitle>
            <DialogDescription>
              Kas termin dari Owner telah terverifikasi masuk ke rekening bank perusahaan
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAuthorizePayment} className="space-y-4 text-xs">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 space-y-1">
              <span className="font-bold block">Penerima Dana: {selectedSubconForDisburse.subconName}</span>
              <p className="text-[11px]">
                Rekening: <strong>{selectedSubconForDisburse.bankName} - {selectedSubconForDisburse.bankAccount}</strong>
              </p>
              <p className="text-[11px]">
                Lingkup: {selectedSubconForDisburse.tradeScope} ({selectedSubconForDisburse.linkedClaimNumber})
              </p>
            </div>

            <div>
              <Label htmlFor="amt">Jumlah Pencairan Disetujui (IDR) *</Label>
              <Input
                id="amt"
                type="number"
                required
                value={disburseAmount}
                onChange={(e) => setDisburseAmount(Number(e.target.value))}
                className="mt-1 font-mono text-base font-bold text-slate-900"
              />
            </div>

            <div>
              <Label htmlFor="notes">Nomor Referensi Bank / Catatan Transfer</Label>
              <Input
                id="notes"
                value={disburseNotes}
                onChange={(e) => setDisburseNotes(e.target.value)}
                placeholder="Contoh: TRF-BCA-88910293 (Transfer Kliring)"
                className="mt-1"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelectedSubconForDisburse(null)}>
                Batal
              </Button>
              <Button type="submit" className="bg-emerald-700 text-white font-bold">
                Konfirmasi Pencairan Kas
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}
    </div>
  );
}
