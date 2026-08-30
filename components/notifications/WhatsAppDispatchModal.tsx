"use client";

import React, { useState } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, CheckCircle2, Phone, ExternalLink, Sparkles } from "lucide-react";
import {
  buildWhatsAppMessageText,
  generateWhatsAppUrl,
  WhatsAppMessagePayload,
} from "@/lib/notifications/whatsapp-service";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";

interface WhatsAppDispatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPayload: Partial<WhatsAppMessagePayload>;
}

export function WhatsAppDispatchModal({
  open,
  onOpenChange,
  defaultPayload,
}: WhatsAppDispatchModalProps) {
  const { currentUser, refreshState } = useTenant();

  const [recipientName, setRecipientName] = useState(defaultPayload.recipientName || "Ir. Bambang Trihatmodjo (Konsultan MK)");
  const [recipientPhone, setRecipientPhone] = useState(defaultPayload.recipientPhone || "081288991122");
  const [recipientRole, setRecipientRole] = useState(defaultPayload.recipientRole || "Lead QS Konsultan MK");
  const [messageType, setMessageType] = useState<WhatsAppMessagePayload["messageType"]>(defaultPayload.messageType || "SLA_ALERT");
  const [customNotes, setCustomNotes] = useState("");
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);

  const payload: WhatsAppMessagePayload = {
    recipientPhone,
    recipientName,
    recipientRole,
    messageType,
    projectName: defaultPayload.projectName || "Menara Meridian",
    claimNumber: defaultPayload.claimNumber || "MC-006",
    amount: defaultPayload.amount || 2150000000,
    agingDays: defaultPayload.agingDays || 16,
    blockerTitle: defaultPayload.blockerTitle || "Selisih volume fasade lantai 12-15",
    actionTitle: defaultPayload.actionTitle || "Klarifikasi Volume Bersama Konsultan MK",
    dueDate: defaultPayload.dueDate || "31 Agustus 2026",
    customNotes,
  };

  const messageText = buildWhatsAppMessageText(payload);
  const waUrl = generateWhatsAppUrl(payload);

  const handleOpenWhatsApp = () => {
    // Open wa.me link
    window.open(waUrl, "_blank");

    // Record audit log
    coveStore.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      entityType: "claim",
      entityId: defaultPayload.claimNumber || "claim",
      eventType: "WHATSAPP_DISPATCHED",
      description: `Notifikasi WhatsApp (${messageType}) dikirim ke ${recipientName} (${recipientPhone})`,
      timestamp: new Date().toISOString(),
      user: currentUser.fullName,
    });

    refreshState();
    setDispatchStatus("Tautan WhatsApp berhasil dibuka.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white">
            <MessageSquare className="h-4 w-4" />
          </div>
          <span>Kirim Notifikasi & Koordinasi WhatsApp</span>
        </DialogTitle>
        <DialogDescription>
          Kirim pesan koordinasi terstandarisasi langsung ke nomor WhatsApp Konsultan MK, Direktur, atau PM
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 text-xs">
        {/* Recipient & Template Config */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="waptpl">Pilih Template Pesan *</Label>
            <Select
              id="waptpl"
              value={messageType}
              onChange={(e) => setMessageType(e.target.value as any)}
              className="mt-1 font-semibold"
            >
              <option value="SLA_ALERT">⚠️ Peringatan Kritis SLA Blocker (Klaim Tertunda)</option>
              <option value="BAP_APPROVED">✅ Notifikasi BAP Telah Disahkan MK</option>
              <option value="CASH_COLLECTED">💰 Notifikasi Kas Masuk / Pelunasan</option>
              <option value="ACTION_ASSIGNED">☑️ Penugasan Tindakan Prioritas PIC</option>
              <option value="DAILY_BRIEF">☀️ Executive Daily Morning Brief</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="wapcontact">Pilih Kontak Penerima Cepat</Label>
            <Select
              id="wapcontact"
              onChange={(e) => {
                const val = e.target.value;
                if (val === "mk") {
                  setRecipientName("Ir. Bambang Trihatmodjo");
                  setRecipientPhone("081288991122");
                  setRecipientRole("Lead QS Konsultan MK");
                } else if (val === "owner") {
                  setRecipientName("Ir. Hendra Gunawan");
                  setRecipientPhone("081122334455");
                  setRecipientRole("Direktur Pemberi Tugas");
                } else if (val === "pm") {
                  setRecipientName("Budi Prasetyo, S.T.");
                  setRecipientPhone("081399887766");
                  setRecipientRole("Project Manager Lapangan");
                } else if (val === "finance") {
                  setRecipientName("Rani Prameswari, S.E.");
                  setRecipientPhone("081544332211");
                  setRecipientRole("Finance & Treasury Lead");
                }
              }}
              className="mt-1"
            >
              <option value="mk">Ir. Bambang (Lead QS Konsultan MK)</option>
              <option value="owner">Ir. Hendra Gunawan (Direktur Owner)</option>
              <option value="pm">Budi Prasetyo (Project Manager)</option>
              <option value="finance">Rani Prameswari (Finance Lead)</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="wapname">Nama Penerima</Label>
            <Input
              id="wapname"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="wapphone">Nomor WhatsApp (Format: 08xxx atau 62xxx) *</Label>
            <Input
              id="wapphone"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              className="mt-1 font-mono font-bold text-slate-900"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="wapnotes">Catatan Tambahan (Opsional)</Label>
          <Input
            id="wapnotes"
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
            placeholder="Contoh: Lampiran softcopy opname sudah dikirim via email barusan."
            className="mt-1"
          />
        </div>

        {/* WhatsApp Chat Bubble Mockup Preview */}
        <div className="space-y-1.5">
          <Label className="text-slate-600 flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            <span>Pratinjau Pesan WhatsApp yang Akan Dikirim:</span>
          </Label>

          <div className="bg-[#0b141a] p-4 rounded-xl border border-slate-700 shadow-inner">
            <div className="bg-[#005c4b] text-[#e9edef] p-3 rounded-lg max-w-lg ml-auto font-sans text-xs whitespace-pre-wrap leading-relaxed shadow relative">
              {messageText}
              <div className="text-right text-[10px] text-[#8696a0] mt-1.5 flex items-center justify-end gap-1 font-mono">
                <span>{new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="text-blue-400 font-bold">✓✓</span>
              </div>
            </div>
          </div>
        </div>

        {dispatchStatus && (
          <div className="p-2.5 bg-emerald-50 text-emerald-900 rounded-lg flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{dispatchStatus}</span>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>

          <Button
            type="button"
            onClick={handleOpenWhatsApp}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-md"
          >
            <Send className="h-4 w-4" />
            <span>Buka & Kirim via WhatsApp Sekarang</span>
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  );
}
