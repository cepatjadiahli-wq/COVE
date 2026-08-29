"use client";

import React, { useState } from "react";
import { HelpCircle, Info, X } from "lucide-react";

interface HelpTooltipProps {
  topic: "cash_at_risk" | "evidence_readiness" | "controllability" | "money_pipeline" | "gap_analysis";
  children?: React.ReactNode;
}

const HELP_CONTENT = {
  cash_at_risk: {
    title: "Apa itu Cash-at-Risk?",
    description:
      "Nilai klaim atau piutang proyek yang belum berubah menjadi kas cair dan memiliki indikator risiko aktif, seperti keterlambatan batas waktu tahap (SLA breach), kendala opname/sertifikasi (blocker aktif), dokumen pendukung belum lengkap, atau faktur melewati tanggal jatuh tempo.",
  },
  evidence_readiness: {
    title: "Apa itu Evidence Readiness?",
    description:
      "Persentase kelengkapan dokumen operasional dan teknis (seperti Laporan Harian/Mingguan, BA Opname, Foto Progres, Uji Mutu Lab) yang disyaratkan kontrak untuk dapat mengajukan klaim secara resmi kepada konsultan MK / Klien.",
  },
  controllability: {
    title: "Tingkat Kontrolabilitas Kendala (Controllability)",
    description:
      "Klasifikasi apakah kendala berada dalam kendali internal kontraktor (misal: keterlambatan dokumen), kendali bersama (joint, misal: rekonsiliasi perhitungan volume dengan MK), atau faktor eksternal (misal: likuiditas perbankan klien).",
  },
  money_pipeline: {
    title: "Alur Money Pipeline COVE",
    description:
      "Perjalanan linier nilai ekonomi proyek: dari Pekerjaan Fisik di Lapangan → Pengukuran (Opname) → Pengajuan Klaim (MC) → Sertifikasi BAP Konsultan → Penerbitan Faktur (Invoice) → Kas Cair Masuk Rekening Bank.",
  },
  gap_analysis: {
    title: "Analisis Value Gap (Nilai Tertahan)",
    description:
      "Perhitungan selisih nilai rupiah yang tertahan di antara tahapan pipeline, membantu kontraktor mengidentifikasi di tahap mana uang mereka berhenti mengalir.",
  },
};

export function HelpTooltip({ topic, children }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const info = HELP_CONTENT[topic];

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-slate-400 hover:text-slate-700 transition-colors p-0.5"
        title="Bantuan & Penjelasan Konsep"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-72 p-3 bg-slate-900 text-white rounded-lg shadow-xl z-50 text-xs animate-in fade-in-0 zoom-in-95">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="font-bold text-emerald-400">{info.title}</span>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">{info.description}</p>
        </div>
      )}
    </div>
  );
}
