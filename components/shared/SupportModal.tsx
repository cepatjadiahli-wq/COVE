"use client";

import React, { useState } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { HelpCircle, Send, CheckCircle2 } from "lucide-react";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function SupportModal() {
  const { currentOrg, currentUser } = useTenant();
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("Panduan Cara Input Klaim");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    coveStore.submitDetailedFeedback({
      orgId: currentOrg.id,
      userId: currentUser.id,
      userFullName: currentUser.fullName,
      role: currentUser.role,
      route: typeof window !== "undefined" ? window.location.pathname : "/support",
      type: "SUPPORT_REQUEST",
      description: `[${topic}] ${message}`,
      status: "new",
    });
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setOpen(false);
      setMessage("");
    }, 2000);
  };

  return (
    <>
      {/* Floating Support Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-full shadow-lg text-xs font-bold border border-slate-700 transition-all hover:scale-105"
      >
        <HelpCircle className="h-4 w-4 text-emerald-400" />
        <span>{language === "id" ? "Butuh Bantuan?" : "Need Help?"}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>{language === "id" ? "Pusat Bantuan & Dukungan Pilot COVE" : "COVE Help & Support Center"}</DialogTitle>
          <DialogDescription>
            {language === "id" 
              ? "Tim product & engineering kami siap membantu tim Anda menyelesaikan kendala operasional klaim" 
              : "Our product & engineering team is ready to support your operational claim workflows"}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center space-y-2 text-xs">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
            <h4 className="font-bold text-slate-900 text-sm">{language === "id" ? "Pesan Berhasil Terkirim!" : "Message Sent Successfully!"}</h4>
            <p className="text-slate-500">{language === "id" ? "Tim lead pilot COVE akan segera menghubungi Anda melalui email / WhatsApp." : "Our pilot support lead will contact you via email or WhatsApp."}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <Label htmlFor="top">{language === "id" ? "Topik Bantuan" : "Support Topic"}</Label>
              <Select id="top" value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-1">
                <option value="Panduan Cara Input Klaim">{language === "id" ? "Panduan Cara Input Progress Claim" : "Guide on Entering Progress Claims"}</option>
                <option value="Format Template Excel">{language === "id" ? "Pertanyaan Terkait Format Import Excel" : "Questions on Excel Import Format"}</option>
                <option value="Perhitungan Nilai Gap">{language === "id" ? "Klarifikasi Perhitungan Cash-at-Risk & Gap" : "Clarification on Cash-at-Risk & Gaps"}</option>
                <option value="Kendala Teknis">{language === "id" ? "Kendala Teknis / Error di Halaman" : "Technical Issue / Page Bug"}</option>
                <option value="Konsultasi Alur QS">{language === "id" ? "Konsultasi Alur Kerja Bersama MK" : "Workflow Consultation with Consultant"}</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="msg">{language === "id" ? "Deskripsi Pertanyaan atau Kendala *" : "Description of Question or Issue *"}</Label>
              <Textarea
                id="msg"
                required
                placeholder={language === "id" ? "Tuliskan kendala yang Anda alami secara detail..." : "Describe the issue or question in detail..."}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1 min-h-[100px]"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-600 text-[11px]">
              <div>{language === "id" ? "Email Pengirim:" : "Sender Email:"} <strong>{currentUser.email}</strong></div>
              <div>{language === "id" ? "Perusahaan:" : "Organization:"} <strong>{currentOrg.name}</strong></div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel", "Batal")}
              </Button>
              <Button type="submit" className="bg-slate-900 text-white font-bold gap-1.5">
                <Send className="h-3.5 w-3.5" />
                <span>{language === "id" ? "Kirim Permintaan Bantuan" : "Send Support Request"}</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </Dialog>
    </>
  );
}
