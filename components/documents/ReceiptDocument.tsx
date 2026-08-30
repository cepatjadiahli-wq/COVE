"use client";

import React from "react";
import { formatIDR } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";

export interface ReceiptDocumentProps {
  company: {
    name: string;
    legalName: string;
    address: string;
    city: string;
    phone: string;
    email: string;
    bankName?: string;
    bankAccountNumber?: string;
    bankAccountHolder?: string;
  };
  client: {
    clientName: string;
    address?: string;
  };
  receiptNumber: string;
  receiptDate?: string;
  amount: number;
  amountTerbilang: string;
  description: string;
  signatory?: {
    name: string;
    title: string;
  };
}

export function ReceiptDocument({
  company,
  client,
  receiptNumber,
  receiptDate = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
  amount,
  amountTerbilang,
  description,
  signatory = {
    name: "Rani Prameswari, S.E., Ak.",
    title: "Finance & Treasury Manager",
  },
}: ReceiptDocumentProps) {
  const bankName = company.bankName || "Bank Central Asia (BCA)";
  const bankAccount = company.bankAccountNumber || "888-0912-3344";
  const bankHolder = company.bankAccountHolder || company.legalName || company.name;

  return (
    <div className="bg-white text-slate-900 font-sans p-8 sm:p-12 max-w-4xl mx-auto border-2 border-slate-300 shadow-sm print:p-0 print:border-none print:shadow-none">
      {/* 1. KOP KUITANSI RESMI */}
      <div className="border-b-2 border-slate-900 pb-4 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-950 uppercase tracking-tight">
              {company.legalName || company.name}
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              {company.address}, {company.city} • Telp: {company.phone} • Email: {company.email}
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded border border-slate-200 block">
              No: {receiptNumber}
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Tanggal: {receiptDate}
            </span>
          </div>
        </div>
      </div>

      {/* 2. JUDUL KUITANSI */}
      <div className="text-center my-4">
        <h2 className="text-xl font-black uppercase tracking-widest text-slate-950 underline">
          K U I T A N S I
        </h2>
        <span className="text-[10px] text-slate-400 font-mono">OFFICIAL PAYMENT RECEIPT</span>
      </div>

      {/* 3. ISI KUITANSI RESMI */}
      <div className="space-y-4 my-6 text-xs sm:text-sm">
        <div className="flex flex-col sm:flex-row sm:items-start border-b border-slate-200 pb-3">
          <span className="w-48 font-bold text-slate-600 shrink-0 uppercase tracking-wider text-xs">
            Telah Diterima Dari :
          </span>
          <span className="font-extrabold text-slate-950 text-sm">
            {client.clientName}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start border-b border-slate-200 pb-3">
          <span className="w-48 font-bold text-slate-600 shrink-0 uppercase tracking-wider text-xs">
            Uang Sejumlah :
          </span>
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200 w-full">
            <span className="font-serif italic font-bold text-slate-950 text-sm sm:text-base leading-relaxed">
              &quot;{amountTerbilang}&quot;
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start border-b border-slate-200 pb-3">
          <span className="w-48 font-bold text-slate-600 shrink-0 uppercase tracking-wider text-xs">
            Untuk Pembayaran :
          </span>
          <span className="text-slate-900 leading-relaxed font-medium">
            {description}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start border-b border-slate-200 pb-3">
          <span className="w-48 font-bold text-slate-600 shrink-0 uppercase tracking-wider text-xs">
            Instruksi Transfer :
          </span>
          <div className="font-mono text-xs text-slate-800 space-y-0.5">
            <div>Bank : <strong>{bankName}</strong></div>
            <div>No. Rekening : <strong>{bankAccount}</strong></div>
            <div>Atas Nama : <strong>{bankHolder}</strong></div>
          </div>
        </div>
      </div>

      {/* 4. NOMINAL IDR BESAR & MATERAI TANDA TANGAN */}
      <div className="mt-8 pt-4 flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Kotak Nominal Jumlah */}
        <div className="border-2 border-slate-950 bg-slate-900 text-emerald-400 p-4 rounded-xl shadow-inner min-w-[280px]">
          <span className="text-[10px] uppercase font-bold text-slate-300 block mb-0.5">
            Jumlah Pembayaran (IDR)
          </span>
          <span className="font-mono text-2xl font-black tracking-tight text-emerald-400">
            {formatIDR(amount)}
          </span>
        </div>

        {/* Kolom Tanda Tangan & Materai */}
        <div className="flex flex-col items-center text-center">
          <span className="text-xs text-slate-600 mb-2">{company.city}, {receiptDate}</span>

          {/* Kotak Materai Tempel Rp 10.000 */}
          <div className="w-28 h-16 border border-dashed border-slate-400 rounded flex flex-col items-center justify-center text-slate-400 text-[9px] mb-2 bg-slate-50">
            <span>MATERAI</span>
            <span>Rp 10.000</span>
          </div>

          <div className="pt-1">
            <span className="font-bold text-slate-950 underline block text-xs">
              {signatory.name}
            </span>
            <span className="text-[10px] text-slate-500 block">
              {signatory.title}
            </span>
          </div>
        </div>
      </div>

      {/* 5. FOOTER */}
      <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
        <div className="flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>Kuitansi Sah Pembayaran Proyek COVE</span>
        </div>
        <span>Validitas Terverifikasi • Stempel Keuangan Digital</span>
      </div>
    </div>
  );
}
