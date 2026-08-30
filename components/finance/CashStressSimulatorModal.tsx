"use client";

import React, { useState } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatIDR } from "@/lib/utils";
import {
  runCashStressSimulation,
  StressTestParams,
} from "@/lib/finance/cash-stress-test";
import { AlertTriangle, ShieldCheck, TrendingDown, TrendingUp, Landmark, Sliders, Calendar } from "lucide-react";
import { coveStore } from "@/domains/store/persistent-store";

interface CashStressSimulatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CashStressSimulatorModal({
  open,
  onOpenChange,
}: CashStressSimulatorModalProps) {
  // Simulator State
  const [startingCash, setStartingCash] = useState<number>(3500000000);
  const [monthlyBurn, setMonthlyBurn] = useState<number>(800000000);
  const [weeklySubcon, setWeeklySubcon] = useState<number>(250000000);
  const [delayDays, setDelayDays] = useState<number>(30);
  const [enablePwpHold, setEnablePwpHold] = useState<boolean>(true);
  const [enableScf, setEnableScf] = useState<boolean>(false);

  // Scheduled Real Project Inflows from Store
  const scheduledInflows = [
    { projectName: "Menara Meridian", claimNumber: "MC-006", expectedWeek: 2, amount: 2150000000 },
    { projectName: "RS Husada Medika", claimNumber: "MC-004", expectedWeek: 4, amount: 1800000000 },
    { projectName: "Tol Semarang-Demak", claimNumber: "MC-010", expectedWeek: 7, amount: 3200000000 },
    { projectName: "Gudang Logistik Cikarang", claimNumber: "MC-003", expectedWeek: 9, amount: 1450000000 },
  ];

  // Run Real-time Simulation
  const result = runCashStressSimulation({
    startingCash,
    monthlyFixedBurn: monthlyBurn,
    weeklySubconBurn: weeklySubcon,
    ownerDelayDays: delayDays,
    enablePwpHold,
    enableScfFacility: enableScf,
    scfFacilityLimit: 2500000000,
    scheduledInflows,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="max-w-5xl w-full mx-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-900 text-white">
              <TrendingUp className="h-4 w-4 text-blue-300" />
            </div>
            <DialogTitle className="text-base font-black text-slate-900">
              Simulator Ketahanan Arus Kas Proyek (Cash Flow Stress-Testing)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 mt-0.5">
            Uji skenario ketahanan likuiditas jika Owner/Klien terlambat membayar 15 s/d 90 hari
          </DialogDescription>
        </DialogHeader>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* 1. Control Sliders & Scenario Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            {/* Delay Slider */}
            <div>
              <div className="flex justify-between mb-1.5 font-bold">
                <Label htmlFor="delay">Keterlambatan Bayar Owner:</Label>
                <span className="text-blue-700 font-mono text-sm">{delayDays} Hari</span>
              </div>
              <input
                id="delay"
                type="range"
                min="0"
                max="90"
                step="15"
                value={delayDays}
                onChange={(e) => setDelayDays(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                <span>Tepat Waktu (0h)</span>
                <span>30h</span>
                <span>60h</span>
                <span>90h</span>
              </div>
            </div>

            {/* Monthly Fixed Burn Slider */}
            <div>
              <div className="flex justify-between mb-1.5 font-bold">
                <Label htmlFor="fixedBurn">Beban Tetap Kantor & Gaji:</Label>
                <span className="text-slate-900 font-mono text-xs">{formatIDR(monthlyBurn)}/bln</span>
              </div>
              <input
                id="fixedBurn"
                type="range"
                min="300000000"
                max="2000000000"
                step="50000000"
                value={monthlyBurn}
                onChange={(e) => setMonthlyBurn(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-700"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                <span>Rp 300M</span>
                <span>Rp 1M</span>
                <span>Rp 2M</span>
              </div>
            </div>

            {/* Mitigation Toggles */}
            <div className="space-y-2 pt-1 border-t sm:border-t-0 sm:border-l sm:pl-4 border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enablePwpHold}
                  onChange={(e) => setEnablePwpHold(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <div>
                  <span className="font-bold text-slate-900 block text-xs">Proteksi Pay-When-Paid</span>
                  <span className="text-[10px] text-slate-500">Tahan termin mandor jika kas Owner belum cair</span>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableScf}
                  onChange={(e) => setEnableScf(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <div>
                  <span className="font-bold text-slate-900 block text-xs">Fasilitas SCF Bank (Rp 2,5 M)</span>
                  <span className="text-[10px] text-slate-500">Bantalan pinjaman likuiditas proyek</span>
                </div>
              </label>
            </div>
          </div>

          {/* 2. Simulation Outcome Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`p-4 rounded-xl border ${result.hasDeficit ? "bg-red-50 border-red-200 text-red-950" : "bg-emerald-50 border-emerald-200 text-emerald-950"}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider block">Status Ketahanan Kas</span>
              <div className="flex items-center gap-2 mt-1">
                {result.hasDeficit ? (
                  <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                )}
                <span className="text-base font-black">
                  {result.hasDeficit ? "DEFISIT TERJADI" : "KAS AMAN & TAHAN"}
                </span>
              </div>
              <span className="text-[11px] mt-1 block opacity-80 font-mono">
                {result.hasDeficit ? `Defisit mulai Minggu ke-${result.deficitStartWeek}` : `Runway penuh: 12 Minggu`}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 text-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Titik Kas Terendah (Lowest Point)</span>
              <span className={`text-lg font-black font-mono mt-1 block ${result.lowestCashBalance < 0 ? "text-red-400" : "text-emerald-400"}`}>
                {formatIDR(result.lowestCashBalance)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                Terjadi pada Minggu ke-{result.lowestCashWeek}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Rekomendasi Utama</span>
              <p className="text-xs font-semibold text-slate-800 mt-1 leading-snug">
                {result.recommendations[0]}
              </p>
            </div>
          </div>

          {/* 3. Weekly Cash Flow Timeline Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="p-3 bg-slate-100 border-b border-slate-200 font-bold text-slate-800 flex justify-between items-center">
              <span>Proyeksi Arus Kas Mingguan (12 Minggu Ke Depan)</span>
              <span className="text-[11px] font-normal text-slate-500">Saldo Awal: {formatIDR(startingCash)}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                    <th className="py-2.5 px-3">Minggu</th>
                    <th className="py-2.5 px-3 text-right">Kas Masuk (Inflow)</th>
                    <th className="py-2.5 px-3 text-right">Beban Tetap</th>
                    <th className="py-2.5 px-3 text-right">Beban Mandor/Subkon</th>
                    <th className="py-2.5 px-3 text-right">Net Cashflow</th>
                    <th className="py-2.5 px-3 text-right">Saldo Kas Akhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {result.weeklyProjections.map((rec) => (
                    <tr
                      key={rec.weekNumber}
                      className={rec.isDeficit ? "bg-red-50/70 font-semibold" : "hover:bg-slate-50"}
                    >
                      <td className="py-2 px-3 font-sans font-bold text-slate-900">
                        {rec.weekLabel}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-700 font-bold">
                        {rec.inflow > 0 ? `+ ${formatIDR(rec.inflow)}` : "-"}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600">
                        - {formatIDR(rec.outflowFixed)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600">
                        - {formatIDR(rec.outflowSubcon)}
                      </td>
                      <td className={`py-2 px-3 text-right font-bold ${rec.netCashFlow >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {rec.netCashFlow >= 0 ? "+" : ""}{formatIDR(rec.netCashFlow)}
                      </td>
                      <td className={`py-2 px-3 text-right font-black ${rec.isDeficit ? "text-red-700" : "text-slate-950"}`}>
                        {formatIDR(rec.endingBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 border-t border-slate-200 bg-white flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Tutup Simulator
          </Button>
          <span className="text-[11px] text-slate-400 font-mono">
            COVE Stress-Testing Module v1.0 • Algoritma Finansial Kontraktor
          </span>
        </DialogFooter>
      </div>
    </Dialog>
  );
}
