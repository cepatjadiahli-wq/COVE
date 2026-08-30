"use client";

import React from "react";
import { LegalLetterContext, getLegalLetterContent } from "@/lib/documents/legal-letter-templates";

interface OfficialLetterDocumentProps {
  context: LegalLetterContext;
}

export function OfficialLetterDocument({ context }: OfficialLetterDocumentProps) {
  const content = getLegalLetterContent(context);

  const formattedDate = new Date(context.letterDate).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="bg-white text-slate-900 font-serif p-8 sm:p-12 max-w-4xl mx-auto border border-slate-300 shadow-md print:border-none print:shadow-none print:p-0 print:m-0 text-xs sm:text-sm leading-relaxed select-text">
      {/* 1. Official Indonesian PT Letterhead (Kop Surat Resmi) */}
      <div className="text-center pb-3 border-b-2 border-slate-900">
        <div className="flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white font-sans font-black text-xl shadow-xs print:border print:border-black">
            C
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black font-sans uppercase tracking-wider text-slate-950">
              {context.companyLegalName}
            </h1>
            <p className="text-[11px] font-sans font-bold tracking-widest text-slate-600 uppercase">
              General Contractor & Construction Engineering
            </p>
          </div>
        </div>
        <p className="text-[11px] font-sans text-slate-600 mt-1">
          {context.companyAddress} • {context.companyCity} • Telp: {context.companyPhone} • Email: {context.companyEmail}
        </p>
      </div>
      {/* Secondary thin border for standard Indonesian dual-line kop surat */}
      <div className="border-b border-slate-900 mb-6 mt-0.5" />

      {/* 2. Metadata Block & Date */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 font-sans text-xs">
        <div className="space-y-1">
          <div className="flex gap-2">
            <span className="w-20 font-bold text-slate-700">Nomor</span>
            <span>: <strong className="font-mono font-bold text-slate-950">{context.letterNumber}</strong></span>
          </div>
          <div className="flex gap-2">
            <span className="w-20 font-bold text-slate-700">Lampiran</span>
            <span>: {context.attachmentCount}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-20 font-bold text-slate-700">Sifat</span>
            <span>: <strong className={context.urgencyLevel === "Sangat Segera" ? "text-red-700" : ""}>{context.urgencyLevel}</strong></span>
          </div>
          <div className="flex gap-2">
            <span className="w-20 font-bold text-slate-700">Perihal</span>
            <span>: <strong className="underline text-slate-950">{content.subject}</strong></span>
          </div>
        </div>

        <div className="sm:text-right font-sans font-semibold text-slate-800">
          <span>{context.companyCity}, {formattedDate}</span>
        </div>
      </div>

      {/* 3. Recipient Block (Kepada Yth.) */}
      <div className="mb-6 font-sans text-xs space-y-0.5">
        <p className="font-bold text-slate-700">Kepada Yth.</p>
        <p className="font-black text-slate-950 text-sm">{context.recipientTitle}</p>
        <p className="font-bold text-slate-900">{context.recipientCompany}</p>
        <p className="text-slate-600">{context.recipientAddress}</p>
        <p className="text-slate-600 font-semibold">{context.recipientCity}</p>
      </div>

      {/* 4. Body Content */}
      <div className="space-y-4 text-justify font-serif text-slate-900">
        <p className="font-sans font-bold text-xs text-slate-800">Dengan hormat,</p>

        <p>{content.openingParagraph}</p>

        {content.bodyParagraphs.map((para, idx) => (
          <p key={idx} className="whitespace-pre-line">{para}</p>
        ))}

        {/* Financial Details Table Box (if present) */}
        {content.financialTable && (
          <div className="my-4 border border-slate-300 rounded-lg overflow-hidden font-sans text-xs bg-slate-50/60">
            <table className="w-full text-left">
              <tbody className="divide-y divide-slate-200">
                {content.financialTable.map((item, idx) => (
                  <tr key={idx} className={idx === 1 ? "bg-slate-100 font-bold" : ""}>
                    <td className="py-2 px-4 w-1/3 text-slate-600">{item.label}</td>
                    <td className="py-2 px-4 font-mono text-slate-950 font-semibold">{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {context.customNotes && (
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded font-sans text-xs text-amber-950">
            <strong>Catatan Khusus Kontraktor:</strong> {context.customNotes}
          </div>
        )}

        <p>{content.closingParagraph}</p>
      </div>

      {/* 5. Signatory Block */}
      <div className="mt-10 flex justify-end font-sans">
        <div className="text-center w-64 space-y-1">
          <p className="font-bold text-xs text-slate-700">Hormat kami,</p>
          <p className="font-black text-xs text-slate-950 uppercase">{context.companyLegalName}</p>

          {/* Signature & Stamp Space */}
          <div className="relative h-20 flex items-center justify-center my-2">
            <div className="w-20 h-10 border border-dashed border-slate-300 rounded flex items-center justify-center text-[9px] text-slate-400 font-mono">
              [ MATERAI 10.000 ]
            </div>
          </div>

          <p className="font-bold text-slate-950 text-sm underline">{context.signatoryName}</p>
          <p className="text-xs text-slate-600 font-semibold">{context.signatoryJobTitle}</p>
        </div>
      </div>

      {/* 6. Carbon Copy Block (Tembusan) */}
      <div className="mt-8 pt-4 border-t border-slate-200 font-sans text-[11px] text-slate-600 space-y-1">
        <p className="font-bold text-slate-800 uppercase tracking-wider">Tembusan Kepada Yth:</p>
        <ol className="list-decimal list-inside space-y-0.5">
          {context.carbonCopyList.map((cc, idx) => (
            <li key={idx}>{cc}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
