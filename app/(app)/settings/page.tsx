"use client";

import React, { useState } from "react";
import { useTenant } from "@/components/layout/TenantProvider";
import { ROLE_LABELS } from "@/lib/constants";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Plus } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function SettingsPage() {
  const { currentOrg, allProfiles } = useTenant();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState("org");
  const [saved, setSaved] = useState(false);

  // SLA Rules State
  const [slaRules] = useState([
    { stage: "Pengukuran / Opname", warning: 5, risk: 10, critical: 15 },
    { stage: "Penyusunan Klaim", warning: 5, risk: 7, critical: 14 },
    { stage: "Peninjauan MK (Under Review)", warning: 7, risk: 14, critical: 21 },
    { stage: "Faktur Diterbitkan", warning: 3, risk: 7, critical: 10 },
    { stage: "Jatuh Tempo Pembayaran", warning: 3, risk: 7, critical: 14 },
  ]);

  // Feature Flags State
  const [flags] = useState({
    project_cash_enabled: false,
    commitments_enabled: false,
    changes_enabled: false,
    margin_enabled: false,
    whatsapp_enabled: false,
    ai_enabled: false,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t("set.title", "Pengaturan Sistem")}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {t("set.subtitle", "Konfigurasi organisasi, hak akses anggota, batas SLA tahapan, dan master template bukti")}
          </p>
        </div>
        {saved && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-200 font-bold animate-in fade-in-0">
            <CheckCircle2 className="h-4 w-4" />
            <span>{language === "id" ? "Pengaturan Berhasil Disimpan" : "Settings Saved Successfully"}</span>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 p-1 border border-slate-200 rounded-lg">
          <TabsTrigger value="org">{language === "id" ? "Profil Organisasi" : "Organization Profile"}</TabsTrigger>
          <TabsTrigger value="members">{language === "id" ? `Anggota & Peran (${allProfiles.length})` : `Members & Roles (${allProfiles.length})`}</TabsTrigger>
          <TabsTrigger value="sla">{language === "id" ? "Aturan Batas SLA" : "Stage SLA Rules"}</TabsTrigger>
          <TabsTrigger value="flags">{language === "id" ? "Fitur Tambahan" : "Feature Flags"}</TabsTrigger>
        </TabsList>

        {/* 1. ORGANIZATION PROFILE TAB */}
        <TabsContent value="org" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <form onSubmit={handleSave} className="space-y-4 text-xs max-w-2xl">
              <div>
                <Label htmlFor="orgName">{language === "id" ? "Nama Tampilan Organisasi" : "Organization Display Name"}</Label>
                <Input id="orgName" defaultValue={currentOrg.name} className="mt-1" />
              </div>

              <div>
                <Label htmlFor="legalName">{language === "id" ? "Nama Legal Perusahaan (PT / CV)" : "Legal Company Name (PT / CV)"}</Label>
                <Input id="legalName" defaultValue={currentOrg.legalName} className="mt-1" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="btype">{language === "id" ? "Klasifikasi Bisnis" : "Business Classification"}</Label>
                  <Input id="btype" defaultValue={currentOrg.businessType} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="city">{language === "id" ? "Kota / Provinsi" : "City / Province"}</Label>
                  <Input id="city" defaultValue={`${currentOrg.city}, ${currentOrg.province}`} className="mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="curr">{language === "id" ? "Mata Uang Standar" : "Default Currency"}</Label>
                  <Input id="curr" disabled defaultValue="IDR (Indonesian Rupiah)" className="mt-1 bg-slate-50 font-mono" />
                </div>
                <div>
                  <Label htmlFor="tz">{language === "id" ? "Zona Waktu Standar" : "Default Timezone"}</Label>
                  <Input id="tz" disabled defaultValue="Asia/Jakarta (WIB)" className="mt-1 bg-slate-50" />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <Button type="submit" className="bg-slate-900 font-bold">
                  {language === "id" ? "Simpan Perubahan Organisasi" : "Save Organization Changes"}
                </Button>
              </div>
            </form>
          </div>
        </TabsContent>

        {/* 2. MEMBERS & ROLES TAB */}
        <TabsContent value="members" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{language === "id" ? "Anggota Organisasi & Hak Akses (RBAC)" : "Organization Members & Access Control"}</h3>
                <p className="text-xs text-slate-500">{language === "id" ? "Kelola otorisasi 9 role spesifik di COVE" : "Manage permissions across 9 role profiles"}</p>
              </div>
              <Button size="sm" className="bg-slate-900 text-xs font-semibold gap-1">
                <Plus className="h-3.5 w-3.5" />
                <span>{language === "id" ? "Undang Anggota" : "Invite Member"}</span>
              </Button>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden text-xs">
              {allProfiles.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white font-bold text-xs">
                      {p.fullName.charAt(0)}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">{p.fullName}</span>
                      <span className="text-slate-500 font-medium">{p.email} • {p.phone}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="font-bold text-slate-800 block">{ROLE_LABELS[p.role]}</span>
                      <span className="text-[11px] text-slate-400">{p.jobTitle}</span>
                    </div>
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                      {language === "id" ? "Aktif" : "Active"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* 3. STAGE SLA RULES TAB */}
        <TabsContent value="sla" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{language === "id" ? "Konfigurasi Batas SLA per Tahapan (Hari Kalender)" : "Stage SLA Configuration (Calendar Days)"}</h3>
              <p className="text-xs text-slate-500">
                {language === "id" 
                  ? "Atur ambang batas warning, risk, dan critical untuk deteksi Cash-at-Risk otomatis" 
                  : "Configure warning, risk, and critical thresholds for automated Cash-at-Risk detection"}
              </p>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                    <th className="py-3 px-4">{language === "id" ? "Tahapan (Stage)" : "Stage"}</th>
                    <th className="py-3 px-4">{language === "id" ? "Peringatan (Hari)" : "Warning (Days)"}</th>
                    <th className="py-3 px-4">{language === "id" ? "Batas Risiko (Hari)" : "Risk Threshold (Days)"}</th>
                    <th className="py-3 px-4">{language === "id" ? "Batas Kritis (Hari)" : "Critical Threshold (Days)"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {slaRules.map((rule) => (
                    <tr key={rule.stage} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{rule.stage}</td>
                      <td className="py-3 px-4 font-mono font-semibold">{rule.warning} {language === "id" ? "hari" : "days"}</td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-700">{rule.risk} {language === "id" ? "hari" : "days"}</td>
                      <td className="py-3 px-4 font-mono font-bold text-red-700">{rule.critical} {language === "id" ? "hari" : "days"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2">
              <Button size="sm" className="bg-slate-900 font-bold text-xs" onClick={handleSave}>
                {language === "id" ? "Simpan Perubahan SLA" : "Save SLA Configuration"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* 4. FEATURE FLAGS TAB */}
        <TabsContent value="flags" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{language === "id" ? "Fitur Tambahan (Feature Flags P1/P2)" : "Feature Flags (P1/P2 Modules)"}</h3>
              <p className="text-xs text-slate-500">
                {language === "id" 
                  ? "Fitur ekspansi masa depan dinonaktifkan secara default untuk menjaga fokus pada wedge Progress-to-Cash" 
                  : "Future expansion modules are disabled by default in V1 to maintain core wedge focus"}
              </p>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden text-xs">
              {Object.entries(flags).map(([key]) => (
                <div key={key} className="p-4 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 font-mono block">{key}</span>
                    <span className="text-slate-500">{language === "id" ? "Modul ekspansi masa depan" : "Reserved future expansion module"}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200">
                    {language === "id" ? "Dinonaktifkan di V1" : "Disabled in V1"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
