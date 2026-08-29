"use client";

import React, { useState } from "react";
import { DEFAULT_EVIDENCE_REQUIREMENTS } from "@/lib/constants";
import { calculateEvidenceReadiness, EvidenceItem } from "@/domains/evidence/service";
import { CheckCircle2, Clock, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function EvidenceChecklist() {
  const { language } = useLanguage();
  const [items, setItems] = useState<EvidenceItem[]>(
    DEFAULT_EVIDENCE_REQUIREMENTS.map((r, idx) => ({
      id: r.id,
      name: r.name,
      required: true,
      status: idx < 4 ? "verified" : idx < 7 ? "in_progress" : "missing",
    }))
  );

  const readiness = calculateEvidenceReadiness(items);

  const toggleStatus = (id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextStatus: Record<string, EvidenceItem["status"]> = {
          missing: "in_progress",
          in_progress: "uploaded",
          uploaded: "verified",
          verified: "not_applicable",
          not_applicable: "missing",
        };
        return { ...item, status: nextStatus[item.status] };
      })
    );
  };

  const statusBadge = {
    missing: "bg-red-50 text-red-700 border-red-200",
    in_progress: "bg-amber-50 text-amber-800 border-amber-200",
    uploaded: "bg-blue-50 text-blue-800 border-blue-200",
    verified: "bg-emerald-50 text-emerald-800 border-emerald-200 font-bold",
    not_applicable: "bg-slate-100 text-slate-500 border-slate-200",
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Readiness Header */}
      <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
        <div>
          <span className="font-bold text-slate-900 block text-sm">{language === "id" ? "Skor Kesiapan Dokumen Bukti (Evidence Readiness)" : "Evidence Readiness Score"}</span>
          <span className="text-[11px] text-slate-500">
            {readiness.totalVerified} {language === "id" ? "dari" : "of"} {readiness.totalApplicable} {language === "id" ? "dokumen terverifikasi" : "documents verified"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-32 bg-slate-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${readiness.percent}%` }}
            />
          </div>
          <span className={`px-2.5 py-1 rounded-md border text-xs font-bold ${readiness.bgColor} ${readiness.color}`}>
            {readiness.label}
          </span>
        </div>
      </div>

      {/* Checklist Items */}
      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
        {items.map((item) => (
          <div
            key={item.id}
            className="p-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleStatus(item.id)}
                className="text-slate-400 hover:text-slate-700"
                title={language === "id" ? "Klik untuk mengubah status" : "Click to toggle status"}
              >
                {item.status === "verified" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : item.status === "in_progress" ? (
                  <Clock className="h-4 w-4 text-amber-600" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-slate-300" />
                )}
              </button>
              <div>
                <span className="font-semibold text-slate-900">{item.name}</span>
                <span className="text-[10px] text-slate-400 block">{language === "id" ? "Wajib untuk pengajuan BAP" : "Required for submission"}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                onClick={() => toggleStatus(item.id)}
                className={`cursor-pointer px-2 py-0.5 rounded text-[11px] font-medium border uppercase tracking-wider ${
                  statusBadge[item.status]
                }`}
              >
                {item.status.replace("_", " ")}
              </span>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500">
                <Upload className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
