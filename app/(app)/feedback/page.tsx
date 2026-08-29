"use client";

import React, { useState } from "react";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Send, Lightbulb } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function FeedbackPage() {
  const { currentOrg, currentUser, refreshState } = useTenant();
  const { t, language } = useLanguage();
  const [feedbackType, setFeedbackType] = useState("WORKFLOW_GAP");
  const [description, setDescription] = useState("");
  const [workaround, setWorkaround] = useState("");
  const [frequency, setFrequency] = useState("Setiap periode pengajuan klaim (bulanan)");
  const [economicImpact, setEconomicImpact] = useState("Keterlambatan sertifikasi BAP / tertundanya kas");
  const [suggestedImprovement, setSuggestedImprovement] = useState("");
  const [projectId, setProjectId] = useState("prj-meridian");
  const [submitted, setSubmitted] = useState(false);

  const feedbackList = coveStore.feedbackSubmissions;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      alert(language === "id" ? "Deskripsi kendala wajib diisi." : "Description is required.");
      return;
    }

    coveStore.submitDetailedFeedback({
      orgId: currentOrg.id,
      userId: currentUser.id,
      userFullName: currentUser.fullName,
      role: currentUser.role,
      projectId: projectId === "none" ? undefined : projectId,
      route: "/feedback",
      type: feedbackType,
      description,
      workaround,
      frequency,
      economicImpact,
      suggestedImprovement,
    });

    setSubmitted(true);
    setDescription("");
    setWorkaround("");
    setSuggestedImprovement("");
    refreshState();
  };

  return (
    <div className="space-y-6 max-w-5xl animate-in fade-in-0">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {language === "id" ? "Umpan Balik & Masukan Pilot COVE" : "Customer Pilot Feedback & Learning Loop"}
          </h1>
          <span className="text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded">
            Pilot Voice
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {language === "id" 
            ? "Bantu tim product COVE menyempurnakan alur kerja klaim kontraktor Indonesia dengan menyampaikan kendala nyata dan kebutuhan Anda" 
            : "Help COVE improve contractor economic workflows by submitting real feedback"}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Feedback Input Form */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {submitted ? (
            <div className="py-12 text-center space-y-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mx-auto">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">{language === "id" ? "Terima Kasih atas Masukan Anda!" : "Thank You for Your Feedback!"}</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                {language === "id" 
                  ? "Umpan balik Anda telah dicatat ke dalam backlog evaluasi pilot internal. Tim product COVE akan mengkaji solusi pada rilis berikutnya." 
                  : "Your feedback is logged into our product backlog for upcoming releases."}
              </p>
              <Button size="sm" onClick={() => setSubmitted(false)} className="bg-slate-900 text-xs font-semibold">
                {language === "id" ? "Kirim Masukan Lain" : "Send Another Feedback"}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fbtype">{language === "id" ? "Jenis Masukan *" : "Feedback Type *"}</Label>
                  <Select id="fbtype" value={feedbackType} onChange={(e) => setFeedbackType(e.target.value)} className="mt-1">
                    <option value="WORKFLOW_GAP">{language === "id" ? "Workflow Gap (Alur Kerja Kurang Pas)" : "Workflow Gap"}</option>
                    <option value="UX_FRICTION">{language === "id" ? "UX Friction (Tampilan Sulit Dipahami)" : "UX Friction"}</option>
                    <option value="TERMINOLOGY">{language === "id" ? "Terminology (Istilah Kurang Sesuai Praktik)" : "Terminology Discrepancy"}</option>
                    <option value="MISSING_INFORMATION">{language === "id" ? "Missing Information (Data Kurang Lengkap)" : "Missing Information"}</option>
                    <option value="FEATURE_REQUEST">{language === "id" ? "Feature Request (Kebutuhan Fitur Baru)" : "Feature Request"}</option>
                    <option value="REPORT_REQUEST">{language === "id" ? "Report Request (Format Laporan Khusus)" : "Report Request"}</option>
                    <option value="INTEGRATION_REQUEST">{language === "id" ? "Integration Request (Integrasi ERP / Excel)" : "Integration Request"}</option>
                    <option value="BUG">{language === "id" ? "Bug / Kendala Teknis" : "Bug / Error"}</option>
                    <option value="OTHER">{language === "id" ? "Lainnya" : "Other"}</option>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="proj">{language === "id" ? "Proyek Terkait" : "Related Project"}</Label>
                  <Select id="proj" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1">
                    <option value="none">{language === "id" ? "Tidak spesifik satu proyek" : "Not project specific"}</option>
                    {coveStore.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectName}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="desc">{language === "id" ? "Deskripsi Masalah / Kebutuhan *" : "Description of Issue / Need *"}</Label>
                <Textarea
                  id="desc"
                  required
                  placeholder={language === "id" ? "Jelaskan secara detail masalah operasional yang Anda hadapi pada alur klaim/sertifikasi/penagihan..." : "Describe the operational issue in detail..."}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 min-h-[90px]"
                />
              </div>

              <div>
                <Label htmlFor="workaround">{language === "id" ? "Cara Anda Mengatasi Masalah Saat Ini (Workaround)" : "Current Workaround"}</Label>
                <Input
                  id="workaround"
                  placeholder={language === "id" ? "Contoh: Saat ini kami membuat rekap sheet Excel terpisah dan di-email manual ke MK..." : "e.g. Manual spreadsheet export..."}
                  value={workaround}
                  onChange={(e) => setWorkaround(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="freq">{language === "id" ? "Frekuensi Terjadinya Masalah" : "Frequency"}</Label>
                  <Select id="freq" value={frequency} onChange={(e) => setFrequency(e.target.value)} className="mt-1">
                    <option value="Setiap hari (Daily)">{language === "id" ? "Setiap hari (Daily)" : "Daily"}</option>
                    <option value="Setiap periode pengajuan klaim (bulanan)">{language === "id" ? "Setiap periode klaim (Bulanan)" : "Monthly claim cycle"}</option>
                    <option value="Saat inisiasi proyek baru">{language === "id" ? "Saat inisiasi proyek baru" : "During project setup"}</option>
                    <option value="Hanya pada proyek tertentu">{language === "id" ? "Hanya pada proyek tertentu" : "Specific projects only"}</option>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="impact">{language === "id" ? "Dampak Finansial / Waktu" : "Financial / Time Impact"}</Label>
                  <Input
                    id="impact"
                    placeholder={language === "id" ? "Contoh: Menunda BAP 2 minggu / tertundanya kas Rp500M" : "e.g. 2-week delay in certification..."}
                    value={economicImpact}
                    onChange={(e) => setEconomicImpact(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="sugg">{language === "id" ? "Saran Perbaikan / Solusi yang Diharapkan" : "Suggested Improvement"}</Label>
                <Input
                  id="sugg"
                  placeholder={language === "id" ? "Contoh: Tambahkan tombol cetak lampiran rincian volume per zona..." : "e.g. Add print button for zone breakdowns..."}
                  value={suggestedImprovement}
                  onChange={(e) => setSuggestedImprovement(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 flex items-center justify-between">
                <span>{language === "id" ? "Pengirim:" : "User:"} <strong>{currentUser.fullName}</strong> ({currentUser.jobTitle})</span>
                <span>Tenant: <strong>{currentOrg.name}</strong></span>
              </div>

              <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-10 gap-2">
                <Send className="h-4 w-4" />
                <span>{language === "id" ? "Kirim Masukan ke Tim Product COVE" : "Send Feedback to Product Team"}</span>
              </Button>
            </form>
          )}
        </div>

        {/* Learning Backlog Info */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 text-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900">{language === "id" ? "Umpan Balik yang Dicatat" : "Logged Feedback"}</h3>
          </div>
          <p className="text-slate-500 leading-relaxed text-[11px]">
            {language === "id" 
              ? "Daftar masukan terbaru dari tim Anda yang telah diterima dan sedang dipelajari tim COVE:" 
              : "Recent feedback from your team under review:"}
          </p>

          <div className="space-y-3 max-h-[380px] overflow-y-auto">
            {feedbackList.map((fb) => (
              <div key={fb.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 truncate max-w-[150px]">{fb.userFullName}</span>
                  <span className="text-[10px] bg-blue-100 text-blue-900 font-bold px-1.5 py-0.2 rounded">{fb.type}</span>
                </div>
                <p className="text-slate-700 leading-snug">{fb.description}</p>
                <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 border-t border-slate-200/60">
                  <span>Status: <strong className="uppercase text-emerald-700">{fb.status}</strong></span>
                  <span>{new Date(fb.timestamp).toLocaleDateString("id-ID")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
