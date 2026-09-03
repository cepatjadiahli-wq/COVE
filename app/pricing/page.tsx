"use client";

import React, { useState } from "react";
import Link from "next/link";
import { SUBSCRIPTION_TIERS, SubscriptionTier, SubscriptionTierId } from "@/lib/subscription/tiers";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Check,
  X,
  ShieldCheck,
  Sparkles,
  Zap,
  Crown,
  CreditCard,
  Building2,
  ArrowRight,
  HelpCircle,
  QrCode,
} from "lucide-react";

export default function PricingPage() {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [pricingCategory, setPricingCategory] = useState<"b2b" | "legacy">("b2b");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const b2bTiers: SubscriptionTier[] = [
    SUBSCRIPTION_TIERS.b2b_pilot,
    SUBSCRIPTION_TIERS.b2b_core,
    SUBSCRIPTION_TIERS.b2b_scale,
    SUBSCRIPTION_TIERS.b2b_enterprise,
  ];

  const legacyTiers: SubscriptionTier[] = [
    SUBSCRIPTION_TIERS.monthly_129k,
    SUBSCRIPTION_TIERS.annual_499k,
    SUBSCRIPTION_TIERS.lifetime_799k,
  ];

  const displayTiers = pricingCategory === "b2b" ? b2bTiers : legacyTiers;

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTier) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/payment/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierId: selectedTier.id,
          customerName,
          customerEmail,
          customerPhone,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal membuat link pembayaran.");
      }

      // Redirect to Mayar checkout URL
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat memproses pembayaran.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-emerald-500 selection:text-slate-950">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Brand & Hero Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-xs font-semibold text-emerald-400 shadow-inner">
            <ShieldCheck className="h-4 w-4" />
            <span>Sistem Lisensi Resmi COVE B2B Construction SaaS (PRD Bagian 28)</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white max-w-3xl mx-auto leading-tight">
            Investasi Cerdas untuk Mengamankan <span className="text-emerald-400 underline decoration-emerald-500/50">Miliaran Rupiah Kas Proyek</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Metrik penagihan resmi: <strong className="text-slate-200">Company Base + Active Project</strong> (bukan per-seat). Didukung program Concierge Paid Pilot 45 Hari dan hak ekspor penuh data historis (PRD 28.1).
          </p>

          {/* Pricing Category Switcher */}
          <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800 mt-4">
            <button
              onClick={() => setPricingCategory("b2b")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                pricingCategory === "b2b"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Penawaran B2B Resmi (PRD Bagian 28)
            </button>
            <button
              onClick={() => setPricingCategory("legacy")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                pricingCategory === "legacy"
                  ? "bg-slate-800 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Paket Mandiri / Legacy
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className={`grid gap-6 items-stretch ${pricingCategory === "b2b" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-3"}`}>
          {displayTiers.map((tier) => {
            const isAnnual = tier.id === "annual_499k";
            const isLifetime = tier.id === "lifetime_799k";

            return (
              <div
                key={tier.id}
                className={`relative flex flex-col justify-between rounded-2xl p-6 sm:p-8 transition-all duration-200 ${
                  isLifetime
                    ? "bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/70 shadow-2xl shadow-amber-500/10 scale-102"
                    : isAnnual
                    ? "bg-slate-900/90 border-2 border-emerald-500/80 shadow-xl shadow-emerald-500/10"
                    : "bg-slate-900/60 border border-slate-800"
                }`}
              >
                {/* Highlight Badge */}
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span
                      className={`text-[11px] font-extrabold uppercase px-3 py-1 rounded-full shadow-md ${
                        isLifetime
                          ? "bg-amber-500 text-slate-950"
                          : isAnnual
                          ? "bg-emerald-500 text-slate-950"
                          : "bg-slate-800 text-slate-300 border border-slate-700"
                      }`}
                    >
                      {tier.badge}
                    </span>
                  </div>
                )}

                <div>
                  {/* Card Header */}
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2">
                      {isLifetime ? (
                        <Crown className="h-5 w-5 text-amber-400" />
                      ) : isAnnual ? (
                        <Sparkles className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <Zap className="h-5 w-5 text-slate-400" />
                      )}
                      <h3 className="text-lg font-black text-white">{tier.name}</h3>
                    </div>

                    <p className="text-xs text-slate-400 min-h-[36px]">{tier.description}</p>
                  </div>

                  {/* Price Block */}
                  <div className="mb-6 pb-6 border-b border-slate-800/80">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white">
                        {tier.priceFormatted}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">{tier.billingPeriod}</span>
                  </div>

                  {/* Feature Checklist */}
                  <div className="space-y-3 mb-8">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Fitur yang Didapatkan:
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>
                        {tier.maxProjects === -1 ? "Unlimited Proyek Aktif" : `${tier.maxProjects} Proyek Aktif`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>
                        {tier.maxMembers === -1 ? "Unlimited Anggota Tim (Seats)" : `${tier.maxMembers} Akun Anggota Tim`}
                      </span>
                    </div>

                    {tier.features.map((feat) => (
                      <div
                        key={feat.key}
                        className={`flex items-center gap-2 text-xs ${
                          feat.included ? "text-slate-200" : "text-slate-600 line-through"
                        }`}
                      >
                        {feat.included ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                        )}
                        <span>{feat.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Select CTA Button */}
                <div>
                  <Button
                    onClick={() => {
                      setSelectedTier(tier);
                      setErrorMsg(null);
                    }}
                    className={`w-full font-black text-xs sm:text-sm py-5 rounded-xl transition-all shadow-lg ${
                      isLifetime
                        ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                        : isAnnual
                        ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                        : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                    }`}
                  >
                    <span>Pilih {tier.name}</span>
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Payment Gateways Supported */}
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-center space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Metode Pembayaran Resmi via Mayar.id Gateway Indonesia:
          </span>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-slate-300">
            <span className="bg-slate-800 px-3 py-1 rounded border border-slate-700">QRIS (Semua Bank & E-Wallet)</span>
            <span className="bg-slate-800 px-3 py-1 rounded border border-slate-700">BCA Virtual Account</span>
            <span className="bg-slate-800 px-3 py-1 rounded border border-slate-700">Mandiri Virtual Account</span>
            <span className="bg-slate-800 px-3 py-1 rounded border border-slate-700">BNI & BRI VA</span>
            <span className="bg-slate-800 px-3 py-1 rounded border border-slate-700">GoPay / OVO / ShopeePay</span>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="space-y-6 pt-6 border-t border-slate-800 max-w-3xl mx-auto text-xs sm:text-sm">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-white">Pertanyaan yang Sering Diajukan (FAQ)</h2>
            <p className="text-slate-400">Semua yang perlu Anda ketahui tentang sistem berlangganan COVE</p>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
              <span className="font-bold text-white block">Apakah ada masa uji coba (trial) gratis?</span>
              <p className="text-slate-400 text-xs leading-relaxed">
                Tidak. COVE dirancang khusus sebagai sistem enterprise berbayar untuk kontraktor profesional. Anda dapat memilih Paket Bulanan (Rp 129.000) untuk memulai dengan biaya yang sangat terjangkau.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
              <span className="font-bold text-white block">Bagaimana proses aktivasinya setelah bayar?</span>
              <p className="text-slate-400 text-xs leading-relaxed">
                Aktivasi berlangsung otomatis secara *real-time* via Webhook Mayar. Begitu Anda selesai scan QRIS atau transfer VA, akun perusahaan Anda langsung aktif seketika tanpa perlu konfirmasi manual.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
              <span className="font-bold text-white block">Bagaimana skema program Paid Pilot 45 Hari (PRD 23.1)?</span>
              <p className="text-slate-400 text-xs leading-relaxed">
                Program Paid Pilot (Rp 10 Juta sekali bayar) mendampingi kontraktor selama 45 hari pada 1 proyek aktif, mencakup pendampingan intake data opname Excel, validasi profil aturan kontrak, minimal 4 weekly review bersama manajemen/direksi, dan penyerahan Pilot ROI Scorecard pada hari ke-45.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
              <span className="font-bold text-white block">Apakah ada paket Lifetime (Seumur Hidup)?</span>
              <p className="text-slate-400 text-xs leading-relaxed">
                Sesuai keputusan produk resmi PRD Bagian 28.1 dan 35, COVE <strong>tidak menawarkan paket seumur hidup (Lifetime Plan ditolak)</strong>. COVE beroperasi dengan model B2B langganan proyek aktif untuk menjamin keberlanjutan dukungan teknis rekayasa kontrak dan SLA keamanan enterprise.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
              <span className="font-bold text-white block">Bagaimana jaminan akses data jika langganan berakhir (PRD 28.1)?</span>
              <p className="text-slate-400 text-xs leading-relaxed">
                Sesuai aturan penagihan PRD 28.1, pembatasan lisensi <strong>tidak boleh menghapus akses export</strong> saat subscription berakhir. Pengguna selalu memiliki hak *read & export grace period* untuk mengunduh seluruh data historis kapan pun tanpa biaya tambahan.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Input Modal */}
      {selectedTier && (
        <Dialog open={Boolean(selectedTier)} onOpenChange={(op) => !op && setSelectedTier(null)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-950">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              <span>Checkout Langganan: {selectedTier.name}</span>
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              Masukkan data penagihan perusahaan Anda untuk melanjutkan ke pembayaran aman Mayar.id
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCheckoutSubmit} className="space-y-4 text-xs">
            {/* Price Summary Box */}
            <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Paket Dipilih</span>
                <span className="font-black text-sm">{selectedTier.name}</span>
                <span className="text-[11px] text-slate-300 block">{selectedTier.billingPeriod}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Tagihan</span>
                <span className="font-black font-mono text-xl text-emerald-400">{selectedTier.priceFormatted}</span>
              </div>
            </div>

            <div>
              <Label htmlFor="cname" className="text-slate-900 font-bold">Nama Lengkap / Nama Perusahaan *</Label>
              <Input
                id="cname"
                required
                placeholder="Contoh: Dimas Sucipto (PT Wijaya Konstruksi)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="cemail" className="text-slate-900 font-bold">Alamat Email Tagihan *</Label>
              <Input
                id="cemail"
                type="email"
                required
                placeholder="finance@kontraktor.co.id"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="cphone" className="text-slate-900 font-bold">Nomor WhatsApp PIC *</Label>
              <Input
                id="cphone"
                type="tel"
                required
                placeholder="081234567890"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="mt-1 font-mono font-bold"
              />
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setSelectedTier(null)}>
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-1.5 shadow-md"
              >
                <QrCode className="h-4 w-4" />
                <span>{isLoading ? "Menghubungkan Mayar..." : `Bayar ${selectedTier.priceFormatted} via Mayar`}</span>
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}
    </div>
  );
}
