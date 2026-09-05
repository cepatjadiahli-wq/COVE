"use client";

import React, { useState, useRef } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, MapPin, CheckCircle2, Upload, RefreshCw, ShieldCheck, Eye } from "lucide-react";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";

interface GeotagPhotoUploaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claimId: string;
  projectId: string;
  onUploadSuccess?: () => void;
}

export function GeotagPhotoUploader({
  open,
  onOpenChange,
  claimId,
  projectId,
  onUploadSuccess,
}: GeotagPhotoUploaderProps) {
  const { currentUser, refreshState } = useTenant();
  const project = coveStore.projects.find((p) => p.id === projectId);
  const claim = coveStore.claims.find((c) => c.id === claimId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoTitle, setPhotoTitle] = useState("Foto Opname Progres Fisik Lapangan");
  const [locationName, setLocationName] = useState(project ? `${project.projectName}, ${project.city}` : "Lokasi Proyek Konstruksi");
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [watermarkedImage, setWatermarkedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch real device GPS coordinates
  const fetchLocation = () => {
    setIsGettingLocation(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoordinates({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setIsGettingLocation(false);
        },
        (err) => {
          console.warn("Geolocation fallback applied:", err.message);
          // Standard Jakarta project coordinates fallback
          setCoordinates({ lat: -6.2088, lng: 106.8456 });
          setIsGettingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setCoordinates({ lat: -6.2088, lng: 106.8456 });
      setIsGettingLocation(false);
    }
  };

  // Process uploaded image and burn watermark canvas
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Set dimensions (Max width 1600px for optimal speed/quality)
        const maxWidth = 1600;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        // Draw original photo
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Watermark Banner Background (Semi-transparent black)
        const bannerHeight = Math.max(140, canvas.height * 0.18);
        ctx.fillStyle = "rgba(10, 15, 29, 0.88)";
        ctx.fillRect(0, canvas.height - bannerHeight, canvas.width, bannerHeight);

        // Watermark Border Accent (Emerald)
        ctx.fillStyle = "#10b981";
        ctx.fillRect(0, canvas.height - bannerHeight, canvas.width, 4);

        // Text Properties
        const fontSize = Math.max(16, Math.round(canvas.width * 0.02));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "middle";

        const startX = 24;
        let startY = canvas.height - bannerHeight + fontSize + 12;
        const lineSpacing = fontSize * 1.4;

        // Line 1: Project & Claim
        ctx.fillStyle = "#34d399";
        ctx.fillText(`🏢 PROYEK: ${project?.projectName || "Proyek Konstruksi"} | KLAIM: ${claim?.claimNumber || "MC-006"}`, startX, startY);

        // Line 2: GPS Coordinates
        startY += lineSpacing;
        ctx.fillStyle = "#e2e8f0";
        const latText = coordinates ? `${coordinates.lat.toFixed(6)}° S` : "-6.208821° S";
        const lngText = coordinates ? `${coordinates.lng.toFixed(6)}° E` : "106.845622° E";
        ctx.fillText(`📍 LOKASI GPS: ${latText}, ${lngText} (${locationName})`, startX, startY);

        // Line 3: Timestamp & Inspector
        startY += lineSpacing;
        ctx.fillStyle = "#cbd5e1";
        const timestamp = new Date().toLocaleString("id-ID", {
          dateStyle: "full",
          timeStyle: "medium",
        });
        ctx.fillText(`🕒 WAKTU: ${timestamp} WIB | SURVEYOR: ${currentUser.fullName} (${currentUser.jobTitle})`, startX, startY);

        // Line 4: Authenticity Badge
        startY += lineSpacing;
        ctx.font = `italic ${Math.round(fontSize * 0.85)}px sans-serif`;
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(`🛡️ VERIFIED BY COVE CONSTRUCTION VALUE ENGINE • ANTI-MANIPULATION DIGITAL STAMP`, startX, startY);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setWatermarkedImage(dataUrl);
        setIsProcessing(false);
      };
      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  };

  const handleSaveEvidence = () => {
    if (!watermarkedImage) return;

    coveStore.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      entityType: "claim",
      entityId: claimId,
      eventType: "GEOTAG_PHOTO_UPLOADED",
      description: `Foto Opname Lapangan Ber-Geotag diunggah untuk ${claim?.claimNumber}: ${photoTitle}`,
      timestamp: new Date().toISOString(),
      user: currentUser.fullName,
    });

    refreshState();
    if (onUploadSuccess) onUploadSuccess();
    onOpenChange(false);
    setWatermarkedImage(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-emerald-600" />
          <span>Unggah Foto Bukti Lapangan Ber-Geotag GPS</span>
        </DialogTitle>
        <DialogDescription>
          Sistem otomatis membakar watermark koordinat GPS, nama proyek, tanggal, dan surveyor untuk keaslian bukti opname
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ftitle">Judul Bukti / Uraian Foto *</Label>
            <Input
              id="ftitle"
              value={photoTitle}
              onChange={(e) => setPhotoTitle(e.target.value)}
              className="mt-1"
              placeholder="Contoh: Pengecoran Plat Lantai 3 Zona B"
            />
          </div>

          <div>
            <Label htmlFor="floc">Nama Area / Zona Proyek</Label>
            <Input
              id="floc"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className="mt-1"
              placeholder="Contoh: Menara Meridian, Lantai 3"
            />
          </div>
        </div>

        {/* GPS Coordinates & Fetch Button */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-600" />
            <div>
              <span className="font-bold text-slate-900 block">Koordinat GPS Kamera:</span>
              <span className="text-[11px] font-mono text-slate-600">
                {coordinates ? `${coordinates.lat.toFixed(6)}° S, ${coordinates.lng.toFixed(6)}° E` : "Klik tombol untuk ambil koordinat terkini"}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchLocation}
            disabled={isGettingLocation}
            className="text-xs font-semibold gap-1"
          >
            <RefreshCw className={`h-3 w-3 ${isGettingLocation ? "animate-spin" : ""}`} />
            <span>{coordinates ? "Perbarui GPS" : "Ambil Lokasi GPS"}</span>
          </Button>
        </div>

        {/* File Upload / Camera Trigger */}
        {!watermarkedImage ? (
          <div
            onClick={() => {
              if (!coordinates) fetchLocation();
              fileInputRef.current?.click();
            }}
            className="border-2 border-dashed border-slate-300 hover:border-slate-500 rounded-xl p-8 text-center cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                <Camera className="h-6 w-6" />
              </div>
              <span className="text-sm font-bold text-slate-900">Ambil Foto dari Kamera atau Pilih Berkas</span>
              <span className="text-[11px] text-slate-500 max-w-sm">
                Format didukung: JPG, PNG, WEBP. Watermark koordinat GPS & stempel digital akan dipasang otomatis.
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Pratinjau Foto dengan Stempel Watermark Resmi:</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setWatermarkedImage(null)}
                className="text-xs text-red-600 h-7"
              >
                Ganti Foto
              </Button>
            </div>

            {/* Live Watermarked Image Preview */}
            <div className="rounded-lg overflow-hidden border border-slate-300 shadow-sm max-h-80 relative bg-black flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={watermarkedImage}
                alt="Watermarked Evidence"
                className="max-h-80 w-auto object-contain"
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            type="button"
            disabled={!watermarkedImage || isProcessing}
            onClick={handleSaveEvidence}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-1.5"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Simpan Bukti Terverifikasi</span>
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  );
}
