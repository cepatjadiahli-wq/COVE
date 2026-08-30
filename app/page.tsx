"use client";

import React, { useState } from "react";
import Link from "next/link";
import { SUBSCRIPTION_TIERS, SubscriptionTier } from "@/lib/subscription/tiers";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  Lock,
  MessageSquare,
  Camera,
  FileText,
  Activity,
  Crown,
  Sparkles,
  Zap,
  CreditCard,
  QrCode,
  Check,
  X,
  Users,
} from "lucide-react";

export default function HomePage() {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const displayTiers: SubscriptionTier[] = [
    SUBSCRIPTION_TIERS.monthly_129k,
    SUBSCRIPTION_TIERS.annual_499k,
    SUBSCRIPTION_TIERS.lifetime_799k,
  ];

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

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat memproses pembayaran.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* 1. Header Navigation */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
        <div className="flex h-20 items-center justify-between px-6 sm:px-8 max-w-7xl w-full mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 font-black text-xl text-slate-950 shadow-lg shadow-emerald-500/20">
              C
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-2xl tracking-tight text-white flex items-center gap-2">
                COVE
                <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.2 rounded-full">
                  SaaS V1.0
                </span>
              </span>
              <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
                Construction Operations Value Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="#pricing">
              <Button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2">
                <span>Pilih Paket Langganan</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 sm:px-6 py-16 sm:py-24 max-w-5xl mx-auto space-y-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold text-emerald-400 shadow-inner">
          <ShieldCheck className="h-4 w-4" />
          <span>Sistem Berlangganan Resmi • Solusi Arus Kas Kontraktor #1 di Indonesia</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight text-white max-w-4xl">
          Kendalikan Miliaran Rupiah Kas Proyek dari <span className="text-emerald-400 underline decoration-emerald-500/40">Progress</span> Menjadi{" "}
          <span className="text-teal-400 underline decoration-teal-500/40">Cash</span>
        </h1>

        <p className="text-base sm:text-xl text-slate-300 max-w-3xl leading-relaxed font-normal">
          Tidak ada mode coba-coba gratis. Pilih paket berlangganan berbayar sekarang untuk mendapatkan proteksi kas, cetak BAP Tripartite 1-klik, kalkulator pajak PP 9/2022, notifikasi WhatsApp, dan kontrol mandor Pay-When-Paid.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link href="#pricing">
            <Button size="lg" className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black h-14 px-8 text-base sm:text-lg rounded-xl shadow-2xl shadow-emerald-500/25 flex items-center gap-2">
              <span>Mulai Berlangganan Sekarang</span>
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="#features">
            <Button size="lg" variant="outline" className="border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-bold h-14 px-6 text-base rounded-xl">
              Lihat 3 Pilar Keunggulan
            </Button>
          </Link>
        </div>

        {/* 3. 3 Pillars of Excellence */}
        <div id="features" className="pt-20 pb-10 w-full text-left space-y-6">
          <div className="text-center space-y-2 max-w-2xl mx-auto mb-10">
            <span className="text-xs font-extrabold uppercase text-emerald-400 tracking-wider">
              Standar Tertinggi Industri Konstruksi
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white">
              3 Pilar Senjata Strategis Direktur & Tim Komersial
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pilar 1 */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3 hover:border-slate-700 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 font-bold">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-white">Pilar 1: Dokumen Legal & Pajak Resmi</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Generator Berita Acara Pembayaran (BAP) Tripartite resmi A4, Kuitansi bermaterai, dan kalkulator pajak PPh Final Jasa Konstruksi (PP 9/2022) & PPN 11%/12% + Addendum VO.
              </p>
            </div>

            {/* Pilar 2 */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3 hover:border-slate-700 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 font-bold">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-white">Pilar 2: WhatsApp & Bukti Geotag GPS</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Peringatan SLA otomatis & koordinasi WhatsApp 1-klik ke Konsultan MK, serta foto opname lapangan ber-watermark koordinat GPS nyata anti-manipulasi.
              </p>
            </div>

            {/* Pilar 3 */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3 hover:border-slate-700 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-white">Pilar 3: Pay-When-Paid & Simulasi Kas</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Kontrol pencairan mandor hanya saat kas Owner masuk (Zero-Deficit Protection), Simulator ketahanan kas 12 minggu, dan skor kesehatan ekonomi C-Score.
              </p>
            </div>
          </div>
        </div>

        {/* 4. Pricing & Subscription Plans */}
        <div id="pricing" className="pt-16 pb-12 w-full text-left space-y-8">
          <div className="text-center space-y-2 max-w-2xl mx-auto mb-10">
            <span className="text-xs font-extrabold uppercase text-amber-400 tracking-wider">
              Paket Berlangganan Resmi
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white">
              Pilih Paket Langganan Perusahaan Anda
            </h2>
            <p className="text-sm text-slate-400">
              Pilih paket yang sesuai dengan kebutuhan skala proyek dan tim Anda. Pembayaran langsung terverifikasi otomatis via Mayar.id.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {displayTiers.map((tier) => {
              const isAnnual = tier.id === "annual_499k";
              const isLifetime = tier.id === "lifetime_799k";

              return (
                <div
                  key={tier.id}
                  className={`relative flex flex-col justify-between rounded-2xl p-6 sm:p-8 transition-all duration-200 ${
                    isLifetime
                      ? "bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/80 shadow-2xl shadow-amber-500/10 scale-102"
                      : isAnnual
                      ? "bg-slate-900/95 border-2 border-emerald-500/80 shadow-xl shadow-emerald-500/10"
                      : "bg-slate-900/60 border border-slate-800"
                  }`}
                >
                  {/* Badge */}
                  {tier.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span
                        className={`text-[11px] font-black uppercase px-3.5 py-1 rounded-full shadow-md ${
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
                    {/* Header */}
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

                    {/* Price */}
                    <div className="mb-6 pb-6 border-b border-slate-800">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white">
                          {tier.priceFormatted}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">{tier.billingPeriod}</span>
                    </div>

                    {/* Feature List */}
                    <div className="space-y-3 mb-8">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                        <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>
                          {tier.maxProjects === -1 ? "Unlimited Proyek Aktif" : `${tier.maxProjects} Proyek Aktif`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                        <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>
                          {tier.maxMembers === -1 ? "Unlimited Anggota Tim" : `${tier.maxMembers} Akun Anggota Tim`}
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

                  {/* Button */}
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
        </div>

        {/* 5. Payment Methods Badge */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3 w-full">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Metode Pembayaran Resmi Otomatis via Mayar.id Gateway Indonesia:
          </span>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono text-slate-300">
            <span className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">QRIS (Semua Bank & E-Wallet)</span>
            <span className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">BCA Virtual Account</span>
            <span className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">Mandiri Virtual Account</span>
            <span className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">BNI & BRI VA</span>
            <span className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">GoPay / OVO / ShopeePay</span>
          </div>
        </div>
      </main>

      {/* 6. Footer */}
      <footer className="border-t border-slate-800 py-8 text-center text-xs text-slate-500 space-y-2">
        <p>© 2026 COVE Construction SaaS. Hak Cipta Dilindungi Undang-Undang.</p>
        <p className="text-[11px] text-slate-600">
          Powered by Supabase Cloud Database & Mayar.id Payment Gateway.
        </p>
      </footer>

      {/* 7. Direct Checkout Modal */}
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
              <Label htmlFor="hname" className="text-slate-900 font-bold">Nama Lengkap / Nama Perusahaan *</Label>
              <Input
                id="hname"
                required
                placeholder="Contoh: Dimas Sucipto (PT Wijaya Konstruksi)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="hemail" className="text-slate-900 font-bold">Alamat Email Tagihan *</Label>
              <Input
                id="hemail"
                type="email"
                required
                placeholder="finance@kontraktor.co.id"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="hphone" className="text-slate-900 font-bold">Nomor WhatsApp PIC *</Label>
              <Input
                id="hphone"
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
