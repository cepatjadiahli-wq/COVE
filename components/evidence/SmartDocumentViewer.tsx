"use client";

import React, { useState } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Printer,
  FileText,
  ShieldCheck,
  Calendar,
  User,
  CheckCircle,
} from "lucide-react";

export interface DocumentItem {
  id: string;
  title: string;
  documentType: string;
  fileName?: string;
  fileUrl?: string;
  fileSizeBytes?: number;
  uploadedAt?: string;
  verifiedBy?: string;
}

interface SmartDocumentViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentItem | null;
}

export function SmartDocumentViewer({
  open,
  onOpenChange,
  document,
}: SmartDocumentViewerProps) {
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);

  if (!document) return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="max-w-4xl w-full mx-auto max-h-[90vh] flex flex-col">
        {/* Header with metadata and viewer controls */}
        <DialogHeader className="border-b border-slate-200 pb-3 flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-bold text-slate-900">
                {document.title}
              </DialogTitle>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-2 py-0.5 rounded flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                <span>Dokumen Sah</span>
              </span>
            </div>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              Jenis: <strong className="text-slate-800">{document.documentType}</strong> • Diperiksa: {document.verifiedBy || "Dimas Sucipto (Lead QS)"}
            </DialogDescription>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              className="h-8 px-2"
              title="Perkecil (Zoom Out)"
            >
              <ZoomOut className="h-4 w-4 text-slate-700" />
            </Button>
            <span className="text-xs font-mono font-semibold px-1 text-slate-600 min-w-[45px] text-center">
              {zoom}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              className="h-8 px-2"
              title="Perbesar (Zoom In)"
            >
              <ZoomIn className="h-4 w-4 text-slate-700" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRotate}
              className="h-8 px-2"
              title="Putar Dokumen (Rotate)"
            >
              <RotateCw className="h-4 w-4 text-slate-700" />
            </Button>
          </div>
        </DialogHeader>

        {/* Document Viewing Canvas */}
        <div className="flex-1 overflow-auto bg-slate-900/95 p-6 flex items-center justify-center min-h-[420px] max-h-[560px]">
          <div
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              transition: "transform 0.2s ease-in-out",
            }}
            className="origin-center"
          >
            {document.fileUrl ? (
              <img
                src={document.fileUrl}
                alt={document.title}
                className="max-h-[500px] w-auto rounded shadow-2xl border border-slate-700"
              />
            ) : (
              // Realistic Document Sheet Mockup
              <div className="w-[520px] min-h-[460px] bg-white text-slate-900 p-8 rounded shadow-2xl border border-slate-300 font-sans text-xs space-y-4">
                <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-sm uppercase text-slate-950">
                      BERITA ACARA OPNAME PRESTASI FISIK
                    </h3>
                    <p className="text-[10px] text-slate-500 font-mono">
                      Ref: BA-OPN/2026/MRD/{document.documentType}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold bg-slate-100 border px-2 py-0.5 rounded">
                    TERVERIFIKASI
                  </span>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-slate-500">Nama Dokumen:</span>
                    <span className="font-bold text-slate-900">{document.title}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-slate-500">Kategori Checklist:</span>
                    <span className="font-semibold text-slate-800">{document.documentType}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-slate-500">Pemeriksa Lapangan:</span>
                    <span className="font-semibold text-slate-800">{document.verifiedBy || "Dimas Sucipto, S.T. (Commercial Lead)"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-slate-500">Tanggal Pengesahan:</span>
                    <span className="font-semibold text-slate-800">
                      {document.uploadedAt || new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border rounded-lg text-[10px] text-slate-600 space-y-1">
                  <div className="flex items-center gap-1 font-bold text-slate-900">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Hasil Pemeriksaan Fisik: Lulus Uji & Sesuai Spesifikasi</span>
                  </div>
                  <p>
                    Seluruh volume pekerjaan pada zona ini telah diukur bersama Konsultan Pengawas MK dan dinyatakan memenuhi standar mutu dan toleransi teknis yang disyaratkan.
                  </p>
                </div>

                <div className="pt-4 border-t flex justify-between items-center text-[10px] text-slate-400 font-mono">
                  <span>COVE Digital Archive v1.0</span>
                  <span>ID: {document.id}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 border-t border-slate-200 bg-white flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          <Button
            size="sm"
            onClick={() => window.print()}
            className="bg-slate-900 text-white font-bold text-xs gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Cetak Dokumen</span>
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  );
}
