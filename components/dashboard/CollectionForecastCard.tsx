"use client";

import React from "react";
import { formatIDR } from "@/lib/utils";
import { Calendar } from "lucide-react";
import { coveStore } from "@/domains/store/persistent-store";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function CollectionForecastCard() {
  const { t, language } = useLanguage();
  const forecast = coveStore.getExpectedCollectionForecast();

  const windows = [
    { label: language === "id" ? "7 Hari ke Depan" : "Next 7 Days", amount: forecast.days7, desc: language === "id" ? "Paling mendesak minggu ini" : "Most urgent collections", highlight: true },
    { label: language === "id" ? "30 Hari ke Depan" : "Next 30 Days", amount: forecast.days30, desc: language === "id" ? "Target likuiditas bulan berjalan" : "Current month liquidity target", highlight: false },
    { label: language === "id" ? "60 Hari ke Depan" : "Next 60 Days", amount: forecast.days60, desc: language === "id" ? "Penerimaan termin 2 bulan" : "60-day projected collections", highlight: false },
    { label: language === "id" ? "90 Hari ke Depan" : "Next 90 Days", amount: forecast.days90, desc: language === "id" ? "Prospek kas kuartal ini" : "Quarterly cash outlook", highlight: false },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">{t("dash.kpi.expected_cash", "Proyeksi Kas Masuk (Collection Windows)")}</h3>
            <span className="text-[10px] font-bold bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
              {language === "id" ? "Jadwal Pembayaran" : "Payment Dates"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {language === "id" 
              ? "Prospek arus kas masuk berdasarkan target expected payment date termin & invoice" 
              : "Forecasted collections based on claim & invoice expected payment dates"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {windows.map((w) => (
          <div
            key={w.label}
            className={`p-4 rounded-lg border flex flex-col justify-between ${
              w.highlight ? "bg-blue-50/70 border-blue-200" : "bg-slate-50/80 border-slate-200"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">{w.label}</span>
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <div className="text-xl font-extrabold text-slate-900 font-mono tracking-tight">
                {formatIDR(w.amount)}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-200/60">
              {w.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
