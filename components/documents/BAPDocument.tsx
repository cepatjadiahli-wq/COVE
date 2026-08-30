"use client";

import React from "react";
import { formatIDR } from "@/lib/utils";
import { BillingBreakdownResult } from "@/lib/finance/construction-tax";
import { ShieldCheck, Building2, Calendar, FileText } from "lucide-react";

export interface BAPDocumentProps {
  company: {
    name: string;
    legalName: string;
    address: string;
    city: string;
    phone: string;
    email: string;
    iujkNumber?: string;
  };
  project: {
    projectName: string;
    projectCode: string;
    location: string;
    clientName: string;
    consultantName?: string;
  };
  contract: {
    contractNumber: string;
    contractTitle: string;
    contractDate?: string;
    startDate: string;
    finishDate: string;
  };
  claim: {
    claimNumber: string; // e.g. 'MC-006'
    periodStart: string;
    periodEnd: string;
    bapNumber?: string;
    bapDate?: string;
  };
  breakdown: BillingBreakdownResult;
  signatories?: {
    contractorName: string;
    contractorTitle: string;
    consultantName: string;
    consultantTitle: string;
    clientName: string;
    clientTitle: string;
  };
}

export function BAPDocument({
  company,
  project,
  contract,
  claim,
  breakdown,
  signatories = {
    contractorName: "Dimas Sucipto, S.T.",
    contractorTitle: "Commercial & Project Lead",
    consultantName: "Ir. Bambang Trihatmodjo, IAI",
    consultantTitle: "Team Leader Konsultan MK",
    clientName: "Ir. Hendra Gunawan",
    clientTitle: "Direktur / Kuasa Pengguna Anggaran",
  },
}: BAPDocumentProps) {
  const bapNumber = claim.bapNumber || `BAP/${new Date().getFullYear()}/${project.projectCode}/${claim.claimNumber}`;
  const bapDate = claim.bapDate || new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="bg-white text-slate-900 font-sans p-8 sm:p-12 max-w-4xl mx-auto border border-slate-200 shadow-sm print:p-0 print:border-none print:shadow-none">
      {/* 1. KOP SURAT RESMI (LETTERHEAD) */}
      <div className="border-b-4 border-double border-slate-900 pb-4 mb-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white font-black text-lg">
                C
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-950 uppercase">
                  {company.legalName || company.name}
                </h1>
                <p className="text-[11px] font-semibold tracking-wider text-slate-600 uppercase">
                  General & Commercial Construction Contractor
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-2">
              {company.address}, {company.city} • Telp: {company.phone} • Email: {company.email}
            </p>
            {company.iujkNumber && (
              <p className="text-[10px] text-slate-500 font-mono">
                NIB / NIB-IUJK: {company.iujkNumber}
              </p>
            )}
          </div>

          <div className="text-right flex flex-col items-end">
            <div className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-300">
              <ShieldCheck className="h-3 w-3 text-emerald-700" />
              <span>DOKUMEN RESMI BAP</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono mt-1">Ref ID: {bapNumber}</span>
          </div>
        </div>
      </div>

      {/* 2. JUDUL DOKUMEN & IDENTITAS */}
      <div className="text-center my-6 space-y-1">
        <h2 className="text-base sm:text-lg font-black tracking-tight uppercase underline text-slate-950">
          BERITA ACARA PEMBAYARAN PRESTASI PEKERJAAN (BAP)
        </h2>
        <p className="text-xs font-mono font-bold text-slate-700">
          Nomor: {bapNumber}
        </p>
        <p className="text-[11px] text-slate-500">
          Lampiran: Sertifikat Bulanan / Monthly Certificate ({claim.claimNumber})
        </p>
      </div>

      {/* 3. INFORMASI KONTRAK & PEKERJAAN */}
      <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-4 mb-6 text-xs space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
          <div className="flex">
            <span className="w-36 text-slate-500 shrink-0">Nama Proyek</span>
            <span className="font-bold text-slate-900">: {project.projectName}</span>
          </div>
          <div className="flex">
            <span className="w-36 text-slate-500 shrink-0">No. Kontrak Utama</span>
            <span className="font-mono font-bold text-slate-900">: {contract.contractNumber}</span>
          </div>
          <div className="flex">
            <span className="w-36 text-slate-500 shrink-0">Pemberi Tugas (Owner)</span>
            <span className="font-semibold text-slate-800">: {project.clientName}</span>
          </div>
          <div className="flex">
            <span className="w-36 text-slate-500 shrink-0">Nilai Kontrak</span>
            <span className="font-mono font-bold text-slate-900">: {formatIDR(breakdown.contractValue)}</span>
          </div>
          <div className="flex">
            <span className="w-36 text-slate-500 shrink-0">Konsultan MK / Pengawas</span>
            <span className="font-semibold text-slate-800">: {project.consultantName || "PT Bina Karya Konsultan (MK)"}</span>
          </div>
          <div className="flex">
            <span className="w-36 text-slate-500 shrink-0">Periode Penilaian</span>
            <span className="font-mono font-semibold text-slate-800">: {claim.periodStart} s/d {claim.periodEnd}</span>
          </div>
          <div className="flex">
            <span className="w-36 text-slate-500 shrink-0">Kontraktor Pelaksana</span>
            <span className="font-bold text-slate-900">: {company.legalName || company.name}</span>
          </div>
          <div className="flex">
            <span className="w-36 text-slate-500 shrink-0">Tanggal BAP Diterbitkan</span>
            <span className="font-semibold text-slate-800">: {bapDate}</span>
          </div>
        </div>
      </div>

      {/* 4. TABEL RINCIAN PERHITUNGAN KEUANGAN PROGRESSIVE */}
      <div className="mb-6 overflow-x-auto">
        <table className="w-full text-xs border border-slate-300">
          <thead>
            <tr className="bg-slate-900 text-white font-bold uppercase text-[11px]">
              <th className="py-2.5 px-3 border border-slate-700 text-center w-10">No</th>
              <th className="py-2.5 px-3 border border-slate-700 text-left">Uraian Prestasi Pekerjaan & Pembayaran</th>
              <th className="py-2.5 px-3 border border-slate-700 text-center w-20">Bobot (%)</th>
              <th className="py-2.5 px-3 border border-slate-700 text-right w-44">Jumlah Nominal (IDR)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {/* 1. Nilai Kontrak */}
            <tr className="bg-slate-50/50">
              <td className="py-2 px-3 text-center font-bold">1</td>
              <td className="py-2 px-3 font-bold">Nilai Kontrak Utama (+ Addendum)</td>
              <td className="py-2 px-3 text-center font-mono font-semibold">100.00%</td>
              <td className="py-2 px-3 text-right font-mono font-bold">{formatIDR(breakdown.contractValue)}</td>
            </tr>

            {/* 2. Kumulatif Prestasi Fisik s/d Periode Ini */}
            <tr>
              <td className="py-2 px-3 text-center font-bold">2</td>
              <td className="py-2 px-3">
                <span className="font-semibold">Prestasi Fisik Kumulatif s/d Sertifikat Ini ({claim.claimNumber})</span>
              </td>
              <td className="py-2 px-3 text-center font-mono font-semibold">{breakdown.cumulativeProgressPercent}%</td>
              <td className="py-2 px-3 text-right font-mono font-semibold">{formatIDR(breakdown.cumulativeCertifiedTotal)}</td>
            </tr>

            {/* 3. Kumulatif Prestasi Fisik Periode Lalu */}
            <tr>
              <td className="py-2 px-3 text-center font-bold">3</td>
              <td className="py-2 px-3 text-slate-600">
                <span>Prestasi Fisik Kumulatif s/d Sertifikat Bulan Lalu</span>
              </td>
              <td className="py-2 px-3 text-center font-mono text-slate-600">{breakdown.previousProgressPercent}%</td>
              <td className="py-2 px-3 text-right font-mono text-slate-600">{formatIDR(breakdown.cumulativeCertifiedBefore)}</td>
            </tr>

            {/* 4. Prestasi Periode Berjalan */}
            <tr className="bg-blue-50/40 font-bold">
              <td className="py-2 px-3 text-center">4</td>
              <td className="py-2 px-3 text-blue-950">
                Nilai Prestasi Fisik Periode Berjalan (Item 2 dikurangi Item 3)
              </td>
              <td className="py-2 px-3 text-center font-mono text-blue-900">{breakdown.currentProgressPercent}%</td>
              <td className="py-2 px-3 text-right font-mono text-blue-900">{formatIDR(breakdown.currentCertifiedGross)}</td>
            </tr>

            {/* 5. Potongan Pengembalian Uang Muka */}
            <tr>
              <td className="py-2 px-3 text-center">5</td>
              <td className="py-2 px-3 text-slate-700">
                Potongan Pengembalian Uang Muka (Amortisasi Down Payment)
              </td>
              <td className="py-2 px-3 text-center font-mono text-slate-500">-</td>
              <td className="py-2 px-3 text-right font-mono text-red-700">
                - {formatIDR(breakdown.advanceRecoveryAmount, { showZero: true })}
              </td>
            </tr>

            {/* 6. Potongan Retensi Pemeliharaan */}
            <tr>
              <td className="py-2 px-3 text-center">6</td>
              <td className="py-2 px-3 text-slate-700">
                Potongan Jaminan Pemeliharaan / Retensi ({breakdown.retentionPercent}%)
              </td>
              <td className="py-2 px-3 text-center font-mono text-slate-500">{breakdown.retentionPercent}.00%</td>
              <td className="py-2 px-3 text-right font-mono text-red-700">
                - {formatIDR(breakdown.retentionAmount)}
              </td>
            </tr>

            {/* 7. Nilai Pembayaran Bruto Disetujui (Pre-Tax) */}
            <tr className="bg-slate-100/80 font-bold">
              <td className="py-2 px-3 text-center">7</td>
              <td className="py-2 px-3 text-slate-900">
                Nilai Sertifikasi Bersih Sebelum Pajak (Item 4 dikurangi Item 5 & 6)
              </td>
              <td className="py-2 px-3 text-center font-mono">-</td>
              <td className="py-2 px-3 text-right font-mono text-slate-950 font-bold">
                {formatIDR(breakdown.netCertifiedPreTax)}
              </td>
            </tr>

            {/* 8. PPN */}
            <tr>
              <td className="py-2 px-3 text-center">8</td>
              <td className="py-2 px-3 text-slate-700">
                Pajak Pertambahan Nilai (PPN {breakdown.ppnPercent}%)
              </td>
              <td className="py-2 px-3 text-center font-mono text-slate-500">{breakdown.ppnPercent}.00%</td>
              <td className="py-2 px-3 text-right font-mono text-emerald-700 font-semibold">
                + {formatIDR(breakdown.ppnAmount)}
              </td>
            </tr>

            {/* 9. PPh Final */}
            <tr>
              <td className="py-2 px-3 text-center">9</td>
              <td className="py-2 px-3 text-slate-700">
                PPh Final Jasa Konstruksi ({breakdown.lpjkLabel})
              </td>
              <td className="py-2 px-3 text-center font-mono text-slate-500">{breakdown.pphFinalPercent}%</td>
              <td className="py-2 px-3 text-right font-mono text-slate-600 font-semibold">
                - {formatIDR(breakdown.pphFinalAmount)}
              </td>
            </tr>

            {/* 10. TOTAL BERSIH YANG DIBAYARKAN (NET PAYABLE) */}
            <tr className="bg-slate-950 text-white font-black text-sm">
              <td className="py-3 px-3 text-center text-emerald-400">10</td>
              <td className="py-3 px-3 text-emerald-400 uppercase tracking-wide">
                JUMLAH BERSIH YANG HARUS DIBAYARKAN KEPADA KONTRAKTOR
              </td>
              <td className="py-3 px-3 text-center font-mono">-</td>
              <td className="py-3 px-3 text-right font-mono text-emerald-400 text-base">
                {formatIDR(breakdown.netPayableToContractor)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 5. TERBILANG RESMI */}
      <div className="bg-slate-50 border border-slate-300 rounded-lg p-3.5 mb-8 text-xs">
        <span className="font-bold text-slate-700 block mb-1">Terbilang (Amount in Words):</span>
        <p className="font-serif italic font-bold text-slate-950 text-sm leading-relaxed bg-white p-2 rounded border border-slate-200">
          &quot;{breakdown.netPayableTerbilang}&quot;
        </p>
      </div>

      {/* 6. BLOK TANDA TANGAN TRIPARTITE (3 PIHAK) */}
      <div className="mt-8 pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-600 mb-6 text-center italic">
          Demikian Berita Acara Pembayaran (BAP) ini dibuat dan ditandatangani oleh para pihak yang berwenang dalam 3 (tiga) rangkap asli bermaterai cukup untuk dipergunakan sebagaimana mestinya.
        </p>

        <div className="grid grid-cols-3 gap-4 text-center text-xs">
          {/* Pihak I: Kontraktor */}
          <div className="border border-slate-200 rounded-lg p-3 flex flex-col justify-between h-48 bg-slate-50/50">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Diajukan Oleh (Pihak I):</span>
              <span className="font-bold text-slate-900 block mt-0.5">{company.name}</span>
              <span className="text-[10px] text-slate-500">Kontraktor Pelaksana</span>
            </div>
            <div className="pt-2 border-t border-slate-200">
              <span className="font-bold text-slate-900 block underline">{signatories.contractorName}</span>
              <span className="text-[10px] text-slate-500">{signatories.contractorTitle}</span>
            </div>
          </div>

          {/* Pihak II: Konsultan MK */}
          <div className="border border-slate-200 rounded-lg p-3 flex flex-col justify-between h-48 bg-slate-50/50">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Diperiksa & Disetujui (Pihak II):</span>
              <span className="font-bold text-slate-900 block mt-0.5">{project.consultantName || "Konsultan MK"}</span>
              <span className="text-[10px] text-slate-500">Manajemen Konstruksi / Pengawas</span>
            </div>
            <div className="pt-2 border-t border-slate-200">
              <span className="font-bold text-slate-900 block underline">{signatories.consultantName}</span>
              <span className="text-[10px] text-slate-500">{signatories.consultantTitle}</span>
            </div>
          </div>

          {/* Pihak III: Pemberi Tugas */}
          <div className="border border-slate-200 rounded-lg p-3 flex flex-col justify-between h-48 bg-slate-50/50">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Disahkan Oleh (Pihak III):</span>
              <span className="font-bold text-slate-900 block mt-0.5">{project.clientName}</span>
              <span className="text-[10px] text-slate-500">Pemberi Tugas / Owner / PPK</span>
            </div>
            <div className="pt-2 border-t border-slate-200">
              <span className="font-bold text-slate-900 block underline">{signatories.clientName}</span>
              <span className="text-[10px] text-slate-500">{signatories.clientTitle}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 7. FOOTER INTEGRITY & ANTI-FRAUD VERIFICATION */}
      <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
        <span>Generated via COVE Engine v1.0 • Construction Operations Value Engine</span>
        <span>Dokumen Sah & Terverifikasi • Digital Timestamp: {new Date().toISOString()}</span>
      </div>
    </div>
  );
}
