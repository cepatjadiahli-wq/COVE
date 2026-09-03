"use client";

import React, { useState } from "react";
import { useTenant } from "@/components/layout/TenantProvider";
import { ROLE_LABELS, Role, ROLES } from "@/lib/constants";
import { coveStore } from "@/domains/store/persistent-store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import {
  CheckCircle2,
  Plus,
  MessageSquare,
  Download,
  UserX,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Clock,
  Building2,
  AlertTriangle,
  FolderLock,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function SettingsPage() {
  const { currentOrg, allProfiles, refreshState } = useTenant();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState("org");
  const [saved, setSaved] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Invite Modal State (PLT-002, PLT-003)
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("QS");
  const [inviteJobTitle, setInviteJobTitle] = useState("");
  const [inviteSelectedProjects, setInviteSelectedProjects] = useState<string[]>([]);

  // Deactivate User Modal State (PLT-005, UAT-18)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [targetUser, setTargetUser] = useState<any>(null);
  const [deactivationReason, setDeactivationReason] = useState("");

  // Assisted Access State (PRD Section 18.3)
  const [showAssistedModal, setShowAssistedModal] = useState(false);
  const [assistedSupportEmail, setAssistedSupportEmail] = useState("support@cove.id");
  const [assistedReason, setAssistedReason] = useState("Pemeriksaan mapping data & verifikasi formula BAP Grand Meridian");
  const [assistedDuration, setAssistedDuration] = useState(24); // 24 hours
  const [assistedProjects, setAssistedProjects] = useState<string[]>(["prj-01"]);

  // SLA Rules State
  const [slaRules] = useState([
    { stage: "Pengukuran / Opname", warning: 5, risk: 10, critical: 15 },
    { stage: "Penyusunan Klaim", warning: 5, risk: 7, critical: 14 },
    { stage: "Peninjauan MK (Under Review)", warning: 7, risk: 14, critical: 21 },
    { stage: "Faktur Diterbitkan", warning: 3, risk: 7, critical: 10 },
    { stage: "Jatuh Tempo Pembayaran", warning: 3, risk: 7, critical: 14 },
  ]);

  // WhatsApp Gateway State
  const [waConfig, setWaConfig] = useState({
    provider: "fonnte",
    senderPhone: "081299881122",
    apiToken: "fonnte_live_tok_991283",
    slaAlerts: true,
    bapApproved: true,
    cashReceipt: true,
    dailyBrief: true,
  });

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

  // 1. Export Tenant Data Handler (PLT-009)
  const handleExportTenantData = () => {
    const data = coveStore.exportFullTenantData(currentOrg.id);
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `COVE_Export_${currentOrg.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3500);
  };

  // 2. Invite Member Submit Handler (PLT-002, PLT-003)
  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteFullName || !inviteEmail) return;

    coveStore.inviteUser(
      {
        fullName: inviteFullName,
        email: inviteEmail,
        phone: invitePhone,
        role: inviteRole,
        jobTitle: inviteJobTitle || ROLE_LABELS[inviteRole],
        assignedProjectIds: inviteSelectedProjects,
      },
      "Raka Pratama (Owner)"
    );

    setInviteFullName("");
    setInviteEmail("");
    setInvitePhone("");
    setInviteJobTitle("");
    setInviteSelectedProjects([]);
    setShowInviteModal(false);
    refreshState();
  };

  // 3. Deactivate User Submit Handler (PLT-005, UAT-18)
  const handleDeactivateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser || !deactivationReason) return;

    coveStore.deactivateUser(targetUser.id, deactivationReason, "Raka Pratama (Owner)");
    setShowDeactivateModal(false);
    setTargetUser(null);
    setDeactivationReason("");
    refreshState();
  };

  // 4. Activate User Handler
  const handleActivateUser = (user: any) => {
    coveStore.activateUser(user.id, "Raka Pratama (Owner)");
    refreshState();
  };

  // 5. Grant Assisted Access Submit Handler (Section 18.3)
  const handleGrantAssistedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    coveStore.grantAssistedAccess(
      {
        orgId: currentOrg.id,
        grantedByUserId: "usr-raka",
        supportEngineerEmail: assistedSupportEmail,
        reason: assistedReason,
        durationHours: assistedDuration,
        assignedProjectIds: assistedProjects,
      },
      "Raka Pratama (Owner)"
    );

    setShowAssistedModal(false);
    refreshState();
  };

  // 6. Revoke Assisted Access Handler
  const handleRevokeAssistedAccess = (grantId: string) => {
    coveStore.revokeAssistedAccess(grantId, "Raka Pratama (Owner)");
    refreshState();
  };

  const activeGrants = coveStore.getAssistedAccessGrants(currentOrg.id);

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
        <div className="flex items-center gap-2">
          {saved && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-200 font-bold animate-in fade-in-0">
              <CheckCircle2 className="h-4 w-4" />
              <span>{language === "id" ? "Pengaturan Berhasil Disimpan" : "Settings Saved Successfully"}</span>
            </div>
          )}
          {exportSuccess && (
            <div className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-200 font-bold animate-in fade-in-0">
              <Download className="h-4 w-4" />
              <span>{language === "id" ? "Data Tenant Berhasil Diekspor (JSON)" : "Tenant Data Exported"}</span>
            </div>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 p-1 border border-slate-200 rounded-lg">
          <TabsTrigger value="org">{language === "id" ? "Profil Organisasi" : "Organization Profile"}</TabsTrigger>
          <TabsTrigger value="members">{language === "id" ? `Anggota & Peran (${allProfiles.length})` : `Members & Roles (${allProfiles.length})`}</TabsTrigger>
          <TabsTrigger value="assisted">{language === "id" ? `Akses Concierge (${activeGrants.filter(g => g.status === 'ACTIVE').length})` : `Assisted Access`}</TabsTrigger>
          <TabsTrigger value="sla">{language === "id" ? "Aturan Batas SLA" : "Stage SLA Rules"}</TabsTrigger>
          <TabsTrigger value="whatsapp">{language === "id" ? "WhatsApp Gateway" : "WhatsApp Gateway"}</TabsTrigger>
          <TabsTrigger value="flags">{language === "id" ? "Fitur Tambahan" : "Feature Flags"}</TabsTrigger>
        </TabsList>

        {/* 1. ORGANIZATION PROFILE TAB & TENANT EXPORT (PLT-009) */}
        <TabsContent value="org" className="mt-4 space-y-6">
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

          {/* Tenant Data Export Section (PLT-009) */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-blue-700" />
                  <h3 className="text-sm font-bold text-slate-900">
                    {language === "id" ? "Ekspor Data Tenant Lengkap (PLT-009)" : "Full Tenant Data Export"}
                  </h3>
                </div>
                <p className="text-xs text-slate-600 mt-1 max-w-xl">
                  {language === "id"
                    ? "Unduh seluruh data operasional perusahaan (proyek, kontrak, klaim, faktur, tindakan, dan audit logs) dalam format terbuka (JSON) tanpa kunci proprietary (Vendor Lock-in Protection)."
                    : "Download complete organization operational dataset in an open JSON format."}
                </p>
              </div>
              <Button
                onClick={handleExportTenantData}
                className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs gap-1.5"
              >
                <Download className="h-4 w-4" />
                <span>{language === "id" ? "Unduh Seluruh Data (.JSON)" : "Export All Data"}</span>
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* 2. MEMBERS & ROLES TAB (RBAC, MFA, DEACTIVATION) */}
        <TabsContent value="members" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {language === "id" ? "Anggota Organisasi & Hak Akses (RBAC)" : "Organization Members & Access Control"}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === "id"
                    ? "Kelola otorisasi 9 role PRD COVE v1.0, status akun individual, pembatasan akses proyek, dan status MFA"
                    : "Manage individual user accounts, project-level access, and MFA enforcement"}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setShowInviteModal(true)}
                className="bg-slate-900 text-xs font-semibold gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{language === "id" ? "Undang Anggota Baru" : "Invite Member"}</span>
              </Button>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden text-xs">
              {allProfiles.map((p) => {
                const isDeactivated = p.status === "DEACTIVATED";
                return (
                  <div
                    key={p.id}
                    className={`p-4 flex items-center justify-between transition-colors ${
                      isDeactivated ? "bg-rose-50/40 opacity-75" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-white font-bold text-xs ${
                          isDeactivated ? "bg-slate-400" : "bg-slate-900"
                        }`}
                      >
                        {p.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold block ${isDeactivated ? "text-slate-500 line-through" : "text-slate-900"}`}>
                            {p.fullName}
                          </span>
                          {p.mfaEnabled && (
                            <span className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              <ShieldCheck className="h-3 w-3 text-blue-600" />
                              MFA Aktif
                            </span>
                          )}
                          {isDeactivated && (
                            <span className="inline-flex items-center gap-0.5 bg-rose-100 text-rose-800 border border-rose-300 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              <UserX className="h-3 w-3 text-rose-600" />
                              Sesi Dicabut
                            </span>
                          )}
                        </div>
                        <span className="text-slate-500 font-medium">
                          {p.email} • {p.phone}
                        </span>
                        {p.assignedProjectIds && p.assignedProjectIds.length > 0 && (
                          <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-500">
                            <Building2 className="h-3 w-3" />
                            <span>Proyek Ditugaskan: {p.assignedProjectIds.join(", ")}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="font-bold text-slate-800 block">{ROLE_LABELS[p.role] || p.role}</span>
                        <span className="text-[11px] text-slate-400">{p.jobTitle}</span>
                      </div>

                      {/* Deactivation / Activation Action Button (PLT-005, UAT-18) */}
                      {p.role !== "OWNER" && (
                        <div>
                          {isDeactivated ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleActivateUser(p)}
                              className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1 font-bold"
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              <span>Aktifkan</span>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setTargetUser(p);
                                setShowDeactivateModal(true);
                              }}
                              className="text-xs text-rose-700 border-rose-300 hover:bg-rose-50 gap-1 font-bold"
                            >
                              <UserX className="h-3.5 w-3.5" />
                              <span>Nonaktifkan</span>
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* 3. ASSISTED ACCESS / CONCIERGE SUPPORT TAB (Section 18.3) */}
        <TabsContent value="assisted" className="mt-4 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    {language === "id" ? "Akses Asistensi COVE (Assisted-Access Control - PRD 18.3)" : "COVE Assisted Access"}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                  {language === "id"
                    ? "Berikan akses waktu-terbatas (time-bound) untuk Tim Implementasi / Support COVE guna membantu pemetaan format tracker dan setup aturan kontrak. Akses dimatikan secara default dan dapat dicabut seketika."
                    : "Time-bound assisted access grants for COVE onboarding and support engineers."}
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => setShowAssistedModal(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold gap-1.5"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>{language === "id" ? "Beri Izin Akses Dukungan" : "Grant Assisted Access"}</span>
              </Button>
            </div>

            {activeGrants.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 rounded-lg text-slate-500">
                <ShieldCheck className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <span className="font-bold block text-sm">Tidak Ada Akses Asistensi Eksternal yang Aktif</span>
                <span className="text-xs text-slate-400 block mt-1">Data Anda terisolasi 100% dari pihak luar.</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden text-xs">
                {activeGrants.map((grant) => {
                  const isRevoked = grant.status === "REVOKED";
                  return (
                    <div key={grant.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{grant.supportEngineerEmail}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isRevoked
                                ? "bg-slate-100 text-slate-500"
                                : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}
                          >
                            {grant.status}
                          </span>
                        </div>
                        <span className="text-slate-600 block mt-1">Alasan: {grant.reason}</span>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Berlaku Hingga: {new Date(grant.expiresAt).toLocaleString("id-ID")}
                          </span>
                          <span>Proyek: {grant.assignedProjectIds.join(", ")}</span>
                        </div>
                      </div>

                      {grant.status === "ACTIVE" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRevokeAssistedAccess(grant.id)}
                          className="text-xs text-rose-700 border-rose-300 hover:bg-rose-50 font-bold"
                        >
                          Cabut Akses Segera
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* 4. STAGE SLA RULES TAB */}
        <TabsContent value="sla" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {language === "id" ? "Konfigurasi Batas SLA per Tahapan (Hari Kalender)" : "Stage SLA Configuration"}
              </h3>
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

        {/* 5. WHATSAPP GATEWAY TAB */}
        <TabsContent value="whatsapp" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {language === "id" ? "Konfigurasi WhatsApp Gateway & Notifikasi Otomatis" : "WhatsApp Gateway & Automated Alerts"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === "id"
                      ? "Kirim notifikasi peringatan blocker, BAP disahkan, dan penerimaan kas otomatis ke nomor HP manajemen"
                      : "Configure automated WhatsApp messaging for SLA alerts and cash confirmations"}
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-2.5 py-1 rounded text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Gateway Aktif (Direct wa.me)</span>
              </span>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="waProvider">Penyedia Layanan (Provider)</Label>
                  <Input id="waProvider" defaultValue={waConfig.provider} disabled className="mt-1 bg-slate-50" />
                </div>
                <div>
                  <Label htmlFor="waPhone">Nomor WhatsApp Pengirim</Label>
                  <Input
                    id="waPhone"
                    defaultValue={waConfig.senderPhone}
                    onChange={(e) => setWaConfig({ ...waConfig, senderPhone: e.target.value })}
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" className="bg-slate-900 text-white font-bold">
                  {language === "id" ? "Simpan Konfigurasi WhatsApp" : "Save WhatsApp Settings"}
                </Button>
              </div>
            </form>
          </div>
        </TabsContent>

        {/* 6. FEATURE FLAGS TAB */}
        <TabsContent value="flags" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{language === "id" ? "Fitur Tambahan (Feature Flags P1/P2)" : "Feature Flags (P1/P2 Modules)"}</h3>
              <p className="text-xs text-slate-500">
                {language === "id"
                  ? "Fitur ekspansi masa depan dinonaktifkan secara default untuk menjaga fokus pada wedge Progress-to-Invoice"
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

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: UNDANG ANGGOTA BARU (PLT-002, PLT-003) */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogHeader>
          <DialogTitle>Undang Anggota Organisasi Baru</DialogTitle>
          <DialogDescription>
            Masukkan identitas individual, wewenang peran (RBAC), dan penugasan proyek spesifik. Akun bersama (shared account) dilarang (PLT-002).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleInviteSubmit} className="space-y-4 text-xs">
          <div>
            <Label htmlFor="invName">Nama Lengkap Anggota *</Label>
            <Input
              id="invName"
              required
              placeholder="Contoh: Budi Santoso"
              value={inviteFullName}
              onChange={(e) => setInviteFullName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="invEmail">Email Individual *</Label>
              <Input
                id="invEmail"
                type="email"
                required
                placeholder="budi@perusahaan.co.id"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="invPhone">Nomor WhatsApp / Telepon</Label>
              <Input
                id="invPhone"
                placeholder="+62 812..."
                value={invitePhone}
                onChange={(e) => setInvitePhone(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="invRole">Peran (Role RBAC) *</Label>
              <Select
                id="invRole"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="mt-1"
              >
                {Object.entries(ROLE_LABELS).map(([rKey, rLabel]) => (
                  <option key={rKey} value={rKey}>
                    {rLabel}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="invJob">Jabatan Struktural</Label>
              <Input
                id="invJob"
                placeholder="Contoh: Site Commercial Lead"
                value={inviteJobTitle}
                onChange={(e) => setInviteJobTitle(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>Penugasan Proyek (Project-Level Access - PLT-003)</Label>
            <div className="grid grid-cols-2 gap-2 mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg">
              {coveStore.projects.map((p) => {
                const checked = inviteSelectedProjects.includes(p.id);
                return (
                  <label key={p.id} className="flex items-center gap-2 text-slate-700 cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setInviteSelectedProjects([...inviteSelectedProjects, p.id]);
                        } else {
                          setInviteSelectedProjects(inviteSelectedProjects.filter((id) => id !== p.id));
                        }
                      }}
                      className="rounded text-slate-900 focus:ring-slate-500"
                    />
                    <span className="font-semibold">{p.projectName}</span>
                  </label>
                );
              })}
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">
              Owner dan Admin secara otomatis memiliki akses ke seluruh proyek tenant.
            </span>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowInviteModal(false)}>
              Batal
            </Button>
            <Button type="submit" className="bg-slate-900 text-white font-bold">
              Kirim Undangan & Daftarkan
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: DEAKTIVASI ANGGOTA (PLT-005, UAT-18) */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={showDeactivateModal} onOpenChange={setShowDeactivateModal}>
        <DialogHeader>
          <DialogTitle className="text-rose-700 flex items-center gap-1.5">
            <AlertTriangle className="h-5 w-5" />
            Konfirmasi Deaktivasi Pengguna (UAT-18)
          </DialogTitle>
          <DialogDescription>
            Menonaktifkan akun <strong>{targetUser?.fullName}</strong> ({targetUser?.email}). Seluruh sesi login aktif akan segera dicabut dan seluruh upaya mutasi data akan ditolak server.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleDeactivateSubmit} className="space-y-4 text-xs">
          <div>
            <Label htmlFor="deactReason">Alasan Penonaktifan (Wajib Audit) *</Label>
            <Input
              id="deactReason"
              required
              placeholder="Contoh: Karyawan telah resign per 1 September 2026"
              value={deactivationReason}
              onChange={(e) => setDeactivationReason(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-xs">
            <span className="font-bold block mb-1">Dampak Keamanan:</span>
            <span>
              Pengguna tidak akan dapat mengakses data proyek apa pun. Histori tindakan dan jejak audit masa lalu tetap dipertahankan secara permanen.
            </span>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowDeactivateModal(false)}>
              Batal
            </Button>
            <Button type="submit" className="bg-rose-700 hover:bg-rose-800 text-white font-bold">
              Nonaktifkan Pengguna & Cabut Sesi
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: GRANT ASSISTED ACCESS (PRD Section 18.3) */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={showAssistedModal} onOpenChange={setShowAssistedModal}>
        <DialogHeader>
          <DialogTitle className="text-amber-700 flex items-center gap-1.5">
            <KeyRound className="h-5 w-5" />
            Otorisasi Akses Concierge COVE (Section 18.3)
          </DialogTitle>
          <DialogDescription>
            Berikan izin akses waktu-terbatas kepada engineer resmi COVE untuk pendampingan teknis. Akses dicatat secara ketat di audit log.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleGrantAssistedSubmit} className="space-y-4 text-xs">
          <div>
            <Label htmlFor="suppEmail">Email Engineer COVE yang Diberi Izin *</Label>
            <Input
              id="suppEmail"
              required
              value={assistedSupportEmail}
              onChange={(e) => setAssistedSupportEmail(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="suppReason">Alasan / Ruang Lingkup Pendampingan *</Label>
            <Input
              id="suppReason"
              required
              value={assistedReason}
              onChange={(e) => setAssistedReason(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="suppDuration">Durasi Waktu Akses (Jam) *</Label>
            <Select
              id="suppDuration"
              value={String(assistedDuration)}
              onChange={(e) => setAssistedDuration(Number(e.target.value))}
              className="mt-1"
            >
              <option value="12">12 Jam</option>
              <option value="24">24 Jam (Rekomendasi Onboarding)</option>
              <option value="48">48 Jam (Maksimal)</option>
            </Select>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
            <span className="font-bold block mb-1">Ketentuan Keamanan Section 18.3:</span>
            <span>
              Akses tidak menggunakan shared credentials. Anda dapat mencabut akses sewaktu-waktu dengan menekan tombol &quot;Cabut Akses Segera&quot;.
            </span>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowAssistedModal(false)}>
              Batal
            </Button>
            <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
              Beri Izin Akses Dukungan
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
