"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, ShieldAlert, Download, CreditCard, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SubscriptionAlertBannerProps {
  status: "ACTIVE" | "PAST_DUE" | "READ_ONLY" | "SUSPENDED" | "CANCEL_AT_PERIOD_END" | string;
  daysRemainingInGrace?: number;
  dueDateWib?: string;
  onExportData?: () => void;
  billingUrl?: string;
}

export function SubscriptionAlertBanner({
  status,
  daysRemainingInGrace = 7,
  dueDateWib,
  onExportData,
  billingUrl = "/billing",
}: SubscriptionAlertBannerProps) {
  if (status === "ACTIVE") {
    return null;
  }

  if (status === "CANCEL_AT_PERIOD_END") {
    return (
      <div className="bg-slate-100 border-b border-slate-300 px-4 py-2.5 text-xs text-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-slate-600 flex-shrink-0" />
          <span>
            Langganan dijadwalkan berakhir pada akhir periode berjalan ({dueDateWib || "segera"}). Seluruh fitur tetap aktif normal.
          </span>
        </div>
        <Link href={billingUrl}>
          <Button size="sm" variant="outline" className="h-7 text-xs border-slate-400">
            Batalkan Penghentian
          </Button>
        </Link>
      </div>
    );
  }

  if (status === "PAST_DUE") {
    return (
      <div className="bg-amber-50 border-b border-amber-300 px-4 py-2.5 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <span>
            <strong>Tagihan Jatuh Tempo (Masa Tenggang):</strong> Tagihan Anda belum terbayar. Anda memiliki masa tenggang{" "}
            <strong>{daysRemainingInGrace} hari</strong> sebelum akun dialihkan ke mode baca saja (READ_ONLY).
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onExportData && (
            <Button size="sm" variant="outline" onClick={onExportData} className="h-7 text-xs border-amber-400">
              <Download className="h-3 w-3 mr-1" /> Ekspor Data
            </Button>
          )}
          <Link href={billingUrl}>
            <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white">
              <CreditCard className="h-3 w-3 mr-1" /> Bayar Sekarang
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (status === "READ_ONLY") {
    return (
      <div className="bg-orange-50 border-b border-orange-300 px-4 py-2.5 text-xs text-orange-950 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-orange-600 flex-shrink-0" />
          <span>
            <strong>Mode READ_ONLY Aktif:</strong> Masa tenggang telah berakhir. Pembuatan dan perubahan data dibekukan sementara. Seluruh data aman dan dapat dilihat/diekspor kapan saja.
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onExportData && (
            <Button size="sm" variant="outline" onClick={onExportData} className="h-7 text-xs border-orange-400 text-orange-900">
              <Download className="h-3 w-3 mr-1" /> Unduh Cadangan Data
            </Button>
          )}
          <Link href={billingUrl}>
            <Button size="sm" className="h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white">
              <CreditCard className="h-3 w-3 mr-1" /> Pulihkan Akun Aktif
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (status === "SUSPENDED") {
    return (
      <div className="bg-red-50 border-b border-red-300 px-4 py-3 text-xs text-red-950 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-red-600 flex-shrink-0" />
          <span>
            <strong>Operasional Dibatasi (SUSPENDED):</strong> Tagihan tertunggak lebih dari 21 hari. Sesuai <em>Open Data Guarantee (PRD 28.1)</em>, data Anda tidak dihapus. Anda dapat mengekspor data lengkap atau melakukan pelunasan untuk mengaktifkan kembali akun seketika.
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onExportData && (
            <Button size="sm" variant="outline" onClick={onExportData} className="h-7 text-xs border-red-400 text-red-900">
              <Download className="h-3 w-3 mr-1" /> Ekspor Lengkap
            </Button>
          )}
          <Link href={billingUrl}>
            <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white">
              <CreditCard className="h-3 w-3 mr-1" /> Bayar Tagihan & Pulihkan
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
