"use client";

import React from "react";
import Link from "next/link";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, Crown, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";

interface SubscriptionGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureTitle: string;
  featureDescription?: string;
  requiredTier?: "annual" | "lifetime";
}

export function SubscriptionGateModal({
  open,
  onOpenChange,
  featureTitle,
  featureDescription = "Tingkatkan paket berlangganan perusahaan Anda untuk membuka modul finansial canggih ini.",
  requiredTier = "lifetime",
}: SubscriptionGateModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-2">
          <Crown className="h-6 w-6" />
        </div>
        <DialogTitle className="text-lg font-black text-slate-900">
          Modul Eksklusif: {featureTitle}
        </DialogTitle>
        <DialogDescription className="text-xs text-slate-600 max-w-sm mx-auto">
          {featureDescription}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 my-2 text-xs">
        <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-amber-400">Rekomendasi Paket</span>
            <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded">
              LIFETIME DEAL
            </span>
          </div>

          <div className="flex justify-between items-baseline">
            <span className="font-extrabold text-sm">Paket Seumur Hidup (Lifetime)</span>
            <span className="font-mono font-black text-emerald-400 text-base">Rp 799.000</span>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800 pt-2">
            Akses seumur hidup ke seluruh fitur eksklusif: Kontrol Pay-When-Paid Mandor, Simulator Arus Kas 12 Minggu, dan C-Score tanpa biaya bulanan lagi.
          </p>
        </div>
      </div>

      <DialogFooter className="flex items-center justify-between sm:justify-between">
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Tutup
        </Button>
        <Link href="/pricing">
          <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs gap-1.5 shadow-md">
            <span>Lihat Semua Paket Langganan</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </DialogFooter>
    </Dialog>
  );
}
