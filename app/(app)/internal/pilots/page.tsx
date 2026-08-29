"use client";

import React, { useState } from "react";
import {
  coveStore,
  PilotOrgRecord,
  ProspectLeadRecord,
  CustomerEvidenceRecord,
  OutreachLogRecord,
  DiscoveryCallRecord,
  EvidenceType,
  OutreachChannel,
} from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { formatIDR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ShieldAlert,
  Building2,
  Users,
  TrendingUp,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Briefcase,
  Sparkles,
  Lock,
  UserCheck,
  HelpCircle,
  Filter,
  UserPlus,
  Send,
  MessageSquare,
  FileText,
  PlusCircle,
  Copy,
  Calendar,
  Check,
} from "lucide-react";

export default function InternalPilotsAdminPage() {
  const { currentUser } = useTenant();
  const [activeTab, setActiveTab] = useState("today");
  const [copiedScriptIndex, setCopiedScriptIndex] = useState<number | null>(null);

  // Modal States
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showLogOutreachModal, setShowLogOutreachModal] = useState(false);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [showAddEvidenceModal, setShowAddEvidenceModal] = useState(false);
  const [selectedProspectId, setSelectedProspectId] = useState<string>("");

  // Add Lead Form State
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [newContactRole, setNewContactRole] = useState("");
  const [newCity, setNewCity] = useState("Jakarta");
  const [newSource, setNewSource] = useState("FOUNDER_NETWORK");
  const [newRelStrength, setNewRelStrength] = useState<any>("WARM");
  const [newFacts, setNewFacts] = useState("");
  const [newInferences, setNewInferences] = useState("");
  const [newUnknowns, setNewUnknowns] = useState("");
  const [newNextAction, setNewNextAction] = useState("");

  // Log Outreach Form State
  const [outreachChannel, setOutreachChannel] = useState<OutreachChannel>("WHATSAPP");
  const [outreachVariant, setOutreachVariant] = useState<any>("WARM_WA");
  const [outreachNextAction, setOutreachNextAction] = useState("Send Follow-Up 1 in 3 days");

  // Discovery Form State
  const [discActiveProjects, setDiscActiveProjects] = useState(3);
  const [discMainProblem, setDiscMainProblem] = useState("");
  const [discPainStage, setDiscPainStage] = useState("UNDER_REVIEW");
  const [discFinancialImpact, setDiscFinancialImpact] = useState("");
  const [discTools, setDiscTools] = useState("Excel + WhatsApp");
  const [discPilotInterest, setDiscPilotInterest] = useState<any>("HIGH");

  // Evidence Form State
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("PROBLEM");
  const [evidenceDesc, setEvidenceDesc] = useState("");
  const [evidenceQuote, setEvidenceQuote] = useState("");
  const [evidenceValue, setEvidenceValue] = useState("");
  const [evidenceConfidence, setEvidenceConfidence] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");

  // Authorization Check: Only OWNER or Platform Admin can access internal view
  const isAuthorized = currentUser.role === "OWNER" || currentUser.role === "ADMIN";

  if (!isAuthorized) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">403 — Access Denied</h2>
        <p className="text-xs text-slate-500 max-w-md">
          Portal Internal Pilot Administration hanya dapat diakses oleh Platform Owner dan Internal Admin COVE.
        </p>
      </div>
    );
  }

  const realLeads = coveStore.realProspectLeads;
  const demoLeads = coveStore.demoProspectLeads;
  const outreachLogs = coveStore.outreachLogs;
  const discoveryRecords = coveStore.discoveryCallRecords;
  const realMetrics = coveStore.getRealRecruitmentMetrics();
  const todayItems = coveStore.getTodayActionItems();
  const evidenceRecords = coveStore.customerEvidenceLedger;
  const realPilotOrgs = coveStore.realPilotOrganizations;
  const milestones = coveStore.milestoneState;

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim() || !newContactName.trim()) return;

    coveStore.addRealProspect({
      companyName: newCompanyName,
      contactName: newContactName,
      contactRole: newContactRole || "Managing Director",
      city: newCity,
      source: newSource,
      relationshipStrength: newRelStrength,
      factsSummary: newFacts,
      inferencesSummary: newInferences,
      unknownsSummary: newUnknowns,
      nextAction: newNextAction || "Complete research on active projects and prepare outreach",
    });

    setNewCompanyName("");
    setNewContactName("");
    setNewContactRole("");
    setNewFacts("");
    setNewInferences("");
    setNewUnknowns("");
    setNewNextAction("");
    setShowAddLeadModal(false);
  };

  const handleLogOutreach = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProspectId) return;

    coveStore.logOutreachAttempt({
      prospectId: selectedProspectId,
      channel: outreachChannel,
      messageVariant: outreachVariant,
      sentBy: currentUser.fullName,
      nextAction: outreachNextAction,
    });

    setShowLogOutreachModal(false);
  };

  const handleRecordDiscovery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProspectId) return;
    const prospect = realLeads.find((l) => l.id === selectedProspectId);

    coveStore.recordDiscoveryCall({
      prospectId: selectedProspectId,
      company: prospect?.companyName || "Unknown",
      date: new Date().toISOString().split("T")[0],
      attendees: `${prospect?.contactName} & ${currentUser.fullName}`,
      roles: `${prospect?.contactRole} / Founder`,
      activeProjectCount: Number(discActiveProjects),
      projectTypes: "Commercial & Civil Works",
      progressBillingProcess: "Monthly interim opname with MK consultant sign-off",
      workToCashWorkflow: "Work -> Opname -> Claim -> MK Review -> BAP -> Invoice -> Collection",
      currentTools: discTools,
      mainProblem: discMainProblem,
      painStage: discPainStage,
      frequency: "Monthly claim cycle",
      financialMateriality: discFinancialImpact ? `Rp ${Number(discFinancialImpact).toLocaleString("id-ID")}` : "Rp 500M+",
      currentWorkaround: "Manual spreadsheet reconciliation during Monday board review",
      decisionMaker: prospect?.contactName || "Director",
      pilotInterest: discPilotInterest,
      dataAvailability: "READY",
      notes: "Discovery completed. Moving to Pilot Offer phase.",
    });

    if (discMainProblem) {
      coveStore.logCustomerEvidence({
        prospectId: selectedProspectId,
        evidenceType: "PROBLEM",
        source: "CUSTOMER_CONVERSATION",
        date: new Date().toISOString().split("T")[0],
        description: discMainProblem,
        financialValue: discFinancialImpact ? Number(discFinancialImpact) : undefined,
        confidence: "HIGH",
        verified: true,
        createdBy: currentUser.fullName,
      });
    }

    setShowDiscoveryModal(false);
  };

  const handleCreateEvidence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceDesc.trim()) return;

    coveStore.logCustomerEvidence({
      evidenceType,
      source: "CUSTOMER_CONVERSATION",
      date: new Date().toISOString().split("T")[0],
      description: evidenceDesc,
      customerQuoteSummary: evidenceQuote || undefined,
      financialValue: evidenceValue ? Number(evidenceValue) : undefined,
      confidence: evidenceConfidence,
      verified: true,
      createdBy: currentUser.fullName,
    });

    setEvidenceDesc("");
    setEvidenceQuote("");
    setEvidenceValue("");
    setShowAddEvidenceModal(false);
  };

  const handleExportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," + encodeURI(coveStore.exportRealPipelineCSV());
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `COVE_Real_Prospect_Pipeline_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyScripts = [
    {
      title: "Warm WhatsApp (Problem-First)",
      channel: "WhatsApp",
      body: `Selamat pagi/siang Pak [Nama], semoga proyek lancar. Saya mau cerita singkat: saat ini saya mengembangkan COVE, sistem kontrol ekonomi proyek khusus kontraktor konstruksi.\n\nFokus kami spesifik: membantu Direksi dan tim komersial memetakan perjalanan nilai dari pekerjaan fisik di lapangan, opname, pengajuan klaim (MC), sertifikasi BAP di MK, sampai invoice dan uang benar-benar cair ke rekening bank.\n\nKami sedang membuka program pilot 30 hari untuk 1 proyek aktif tanpa perlu migrasi software kantor. Kalau Bapak ada waktu 15 menit minggu ini, saya ingin mendemokan simulasi alur uangnya via Zoom. Apakah hari Kamis jam 14:00 WIB memungkinkan, Pak?`,
    },
    {
      title: "Cold WhatsApp (Short & Permission-Based)",
      channel: "WhatsApp",
      body: `Selamat pagi Pak [Nama], perkenalkan saya [Nama Founder], founder COVE. Kami membangun sistem kontrol nilai proyek yang membantu kontraktor mendeteksi nilai pekerjaan yang sudah selesai dikerjakan namun tertahan sebelum menjadi kas—mulai dari selisih opname, BAP yang menggantung di MK, hingga faktur jatuh tempo.\n\nKami sedang membuka pilot 30 hari untuk 1 proyek aktif tanpa mengubah software pembukuan yang sudah ada. Apakah Bapak terbuka untuk melihat demo singkat 15 menit alur Money Pipeline ini via Zoom minggu ini?`,
    },
    {
      title: "Professional Email (CEO / CFO)",
      channel: "Email",
      body: `Yth. Bapak [Nama Direktur],\nDirektur Utama [Nama Perusahaan]\n\nDalam pengelolaan proyek konstruksi, salah satu tantangan terbesar manajemen adalah jeda waktu antara progres fisik di lapangan dengan penerimaan kas nyata di rekening bank—mulai dari volume opname yang belum diakui konsultan MK, berkas QC terlambat, hingga faktur termin melewati jatuh tempo.\n\nKami di COVE mengundang [Nama Perusahaan] untuk mencoba program Controlled Early Access Pilot (30 Hari) pada 1 proyek aktif pilihan Anda.\n\nApakah kami dapat menjadwalkan online meeting 15 menit pada hari Rabu atau Kamis ini untuk menunjukkan cara kerjanya secara singkat?\n\nHormat kami,\n[Nama Founder] — COVE (cove.id)`,
    },
    {
      title: "Referral Introduction (Mutual Peer)",
      channel: "Referral",
      body: `Halo Pak [Nama], perkenalkan ini rekan saya [Nama Founder], founder COVE. Mereka sedang membangun software kontrol termin dan cash-at-risk proyek khusus kontraktor gedung/infrastruktur. Saat ini sedang ada pilot 30 hari untuk 1 proyek aktif. Saya sarankan Bapak ngobrol santai 15 menit dengan beliau untuk lihat alur Money Pipeline-nya.`,
    },
  ];

  const handleCopyScript = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedScriptIndex(index);
    setTimeout(() => setCopiedScriptIndex(null), 2500);
  };

  return (
    <div className="space-y-6 max-w-6xl animate-in fade-in-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Real Market Outreach Operating System</h1>
            <span className="text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-0.5 rounded">
              Phase: {milestones.marketValidationState}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Sistem operasi perekrutan Customer Pilot #1: Riset prospek riil, pencatatan interaksi, dan verifikasi bukti pasar.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleExportCSV} variant="outline" size="sm" className="text-xs font-semibold gap-1.5">
            <Download className="h-3.5 w-3.5" />
            <span>Export Real Pipeline CSV</span>
          </Button>
          <Button
            onClick={() => setShowAddLeadModal(true)}
            size="sm"
            className="bg-slate-900 text-white font-semibold text-xs gap-1.5"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add Real Prospect</span>
          </Button>
        </div>
      </div>

      {/* Target Progress Bar (20 Target View) */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Real Customer Pilot #1 Operating Funnel Targets
          </span>
          <span className="text-[11px] text-slate-500">Zero-Synthetic Baseline (Real Activity Only)</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">1. Prospects Identified</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-slate-900 font-mono">{realMetrics.prospectsIdentified}</span>
              <span className="text-xs font-bold text-slate-400 font-mono">/ {realMetrics.targetProspects}</span>
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">2. Real Outreach Sent</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-slate-900 font-mono">{realMetrics.outreachSent}</span>
              <span className="text-xs font-bold text-slate-400 font-mono">/ {realMetrics.targetOutreach}</span>
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">3. Discovery Completed</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-indigo-700 font-mono">{realMetrics.discoveryCallsCompleted}</span>
              <span className="text-xs font-bold text-slate-400 font-mono">/ {realMetrics.targetDiscovery}</span>
            </div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <span className="text-[10px] uppercase font-bold text-emerald-800 block">4. Pilot Accepted ★</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-emerald-900 font-mono">{realMetrics.pilotsAccepted}</span>
              <span className="text-xs font-bold text-emerald-600 font-mono">/ {realMetrics.targetPilotsAccepted}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 p-1 border border-slate-200 rounded-lg">
          <TabsTrigger value="today">Today Dashboard</TabsTrigger>
          <TabsTrigger value="pipeline">Real Pipeline ({realLeads.length})</TabsTrigger>
          <TabsTrigger value="copy_library">Outreach Copy Library</TabsTrigger>
          <TabsTrigger value="evidence_ledger">Evidence Ledger ({evidenceRecords.length})</TabsTrigger>
          <TabsTrigger value="demo_sandbox">Demo Sandbox (2)</TabsTrigger>
        </TabsList>

        {/* 0. TODAY ACTION DASHBOARD */}
        <TabsContent value="today" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Prospects to Research */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase">1. Prospects to Research</span>
                <span className="px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-xs">
                  {todayItems.prospectsToResearch.length}
                </span>
              </div>
              {todayItems.prospectsToResearch.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4 text-center">Tidak ada prospek yang sedang diriset.</p>
              ) : (
                <div className="space-y-2">
                  {todayItems.prospectsToResearch.map((p) => (
                    <div key={p.id} className="p-3 bg-slate-50 rounded border text-xs">
                      <strong>{p.companyName}</strong> ({p.city})
                      <div className="text-[11px] text-slate-500 mt-1">{p.nextAction}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outreach to Send */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase">2. Outreach to Send</span>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-mono font-bold text-xs">
                  {todayItems.outreachToSend.length}
                </span>
              </div>
              {todayItems.outreachToSend.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4 text-center">Semua prospek yang siap kontak telah dikirimi pesan.</p>
              ) : (
                <div className="space-y-2">
                  {todayItems.outreachToSend.map((p) => (
                    <div key={p.id} className="p-3 bg-blue-50/60 rounded border border-blue-200 text-xs flex justify-between items-center">
                      <div>
                        <strong>{p.companyName}</strong>
                        <div className="text-[11px] text-slate-500">{p.contactName} ({p.contactRole})</div>
                      </div>
                      <Button
                        size="xs"
                        onClick={() => {
                          setSelectedProspectId(p.id);
                          setShowLogOutreachModal(true);
                        }}
                        className="bg-slate-900 text-white text-[10px]"
                      >
                        Log Outreach
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Follow-Ups Due */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase">3. Follow-Ups Due</span>
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono font-bold text-xs">
                  {todayItems.followUpsDue.length}
                </span>
              </div>
              {todayItems.followUpsDue.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4 text-center">Belum ada jadwal follow-up jatuh tempo.</p>
              ) : (
                <div className="space-y-2">
                  {todayItems.followUpsDue.map((l) => (
                    <div key={l.id} className="p-3 bg-amber-50/60 rounded border border-amber-200 text-xs">
                      <strong>{l.companyName}</strong>
                      <div className="text-[11px] text-amber-900 font-medium mt-1">{l.nextAction}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* 1. REAL PROSPECT PIPELINE */}
        <TabsContent value="pipeline" className="space-y-6 mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Real Contractor Prospect Pipeline</h3>
                <p className="text-xs text-slate-500 mt-0.5">Kontak prospek riil yang diverifikasi langsung oleh founder</p>
              </div>
              <Button
                onClick={() => setShowAddLeadModal(true)}
                size="sm"
                className="bg-slate-900 text-white text-xs font-semibold gap-1.5"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Tambah Prospek Riil</span>
              </Button>
            </div>

            {realLeads.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-3">
                <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-slate-200 text-slate-600">
                  <Briefcase className="h-5 w-5" />
                </div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Belum Ada Prospek Riil yang Dimasukkan
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Daftarkan kontak kontraktor nyata dari jaringan atau riset founder menggunakan form di atas untuk memulai siklus perekrutan Customer Pilot #1.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                      <th className="py-3 px-4">Prospect ID</th>
                      <th className="py-3 px-4">Company</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Research</th>
                      <th className="py-3 px-4">Score & Confidence</th>
                      <th className="py-3 px-4">Outreach Status</th>
                      <th className="py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {realLeads.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700">{p.id}</td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 block">{p.companyName}</span>
                          <span className="text-[10px] text-slate-500">{p.city}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-900 block">{p.contactName}</span>
                          <span className="text-[10px] text-slate-500">{p.contactRole}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-700 uppercase">
                            {p.researchStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold">{p.qualificationScore}/100</div>
                          <div className="text-[10px] text-slate-400">{p.qualificationConfidence} CONFIDENCE</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-900 border border-blue-200">
                            {p.outreachStatus.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => {
                                setSelectedProspectId(p.id);
                                setShowLogOutreachModal(true);
                              }}
                              className="text-[10px]"
                            >
                              Log Outreach
                            </Button>
                            <Button
                              size="xs"
                              onClick={() => {
                                setSelectedProspectId(p.id);
                                setShowDiscoveryModal(true);
                              }}
                              className="bg-indigo-900 text-white text-[10px]"
                            >
                              Log Discovery
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* 2. OUTREACH COPY LIBRARY */}
        <TabsContent value="copy_library" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {copyScripts.map((script, idx) => (
              <div key={idx} className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{script.title}</h4>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-semibold">
                      Channel: {script.channel}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyScript(script.body, idx)}
                    className="text-xs gap-1"
                  >
                    {copiedScriptIndex === idx ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Salin Pesan</span>
                      </>
                    )}
                  </Button>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                  {script.body}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* 3. CUSTOMER EVIDENCE LEDGER */}
        <TabsContent value="evidence_ledger" className="space-y-6 mt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Customer Evidence Ledger</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Catatan temuan masalah nyata, kutipan langsung prospek, dan dampak finansial yang terverifikasi
                </p>
              </div>
              <Button
                onClick={() => setShowAddEvidenceModal(true)}
                size="sm"
                className="bg-slate-900 text-white text-xs font-semibold gap-1.5"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Catat Bukti Lapangan</span>
              </Button>
            </div>

            {evidenceRecords.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-3">
                <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-slate-200 text-slate-600">
                  <FileText className="h-5 w-5" />
                </div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Belum Ada Bukti Lapangan Tercatat
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Catat pernyataan masalah, kutipan langsung dari panggilan discovery, konfirmasi Cash-at-Risk, atau umpan balik WTP saat founder berinteraksi dengan kontraktor.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {evidenceRecords.map((ev) => (
                  <div key={ev.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-700">{ev.id}</span>
                        <span className="px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-900 text-[10px]">
                          {ev.evidenceType}
                        </span>
                        <span className="px-2 py-0.5 rounded font-bold bg-slate-200 text-slate-700 text-[10px]">
                          Confidence: {ev.confidence}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{ev.date}</span>
                    </div>
                    <p className="text-slate-900 font-medium">{ev.description}</p>
                    {ev.customerQuoteSummary && (
                      <div className="p-2.5 bg-white border border-slate-200 rounded italic text-slate-700">
                        &quot;{ev.customerQuoteSummary}&quot;
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>Sumber: <strong>{ev.source.replace("_", " ")}</strong></span>
                      {ev.financialValue && (
                        <span>Dampak: <strong className="text-red-700 font-mono">{formatIDR(ev.financialValue)}</strong></span>
                      )}
                      <span>Dicatat oleh: <strong>{ev.createdBy}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* 4. DEMO SANDBOX SHOWCASE */}
        <TabsContent value="demo_sandbox" className="space-y-6 mt-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-amber-200 text-amber-900 font-black rounded text-[10px] uppercase">
                Demo & Test Sandbox Only
              </span>
              <span className="text-xs text-amber-800 font-medium">
                Data berikut digunakan khusus untuk demonstrasi dan tidak dihitung dalam metrik konversi riil.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {demoLeads.map((dl) => (
                <div key={dl.id} className="p-4 rounded-xl border border-amber-200 bg-white space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{dl.companyName}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                      {dl.evidenceSource}
                    </span>
                  </div>
                  <p className="text-slate-600">{dl.factsSummary}</p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span>Contact: {dl.contactName}</span>
                    <span>Status: <strong className="uppercase">{dl.outreachStatus}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL: ADD REAL PROSPECT */}
      {showAddLeadModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in-0">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Tambah Prospek Kontraktor Riil</h3>
              <button onClick={() => setShowAddLeadModal(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-3 text-xs">
              <div>
                <Label className="text-[11px] font-bold text-slate-700">Nama Perusahaan Kontraktor *</Label>
                <Input
                  required
                  placeholder="e.g. PT Cipta Bangun Perkasa"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] font-bold text-slate-700">Nama Kontak PIC *</Label>
                  <Input
                    required
                    placeholder="e.g. Budi Santoso"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold text-slate-700">Jabatan / Peran</Label>
                  <Input
                    placeholder="e.g. Managing Director"
                    value={newContactRole}
                    onChange={(e) => setNewContactRole(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] font-bold text-slate-700">Kota Domisili</Label>
                  <Input
                    placeholder="e.g. Jakarta Selatan"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold text-slate-700">Hubungan Kontak</Label>
                  <select
                    value={newRelStrength}
                    onChange={(e) => setNewRelStrength(e.target.value as any)}
                    className="h-8 w-full border rounded-md px-2 text-xs bg-white mt-1 border-slate-200"
                  >
                    <option value="WARM">WARM (Jaringan Pribadi)</option>
                    <option value="REFERRAL">REFERRAL (Rekomendasi Rekan)</option>
                    <option value="COLD">COLD (Riset Direktori)</option>
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-bold text-slate-700">Fakta Diketahui (FACTS)</Label>
                <Input
                  placeholder="e.g. Kontraktor gedung komersial 18 lantai, 4 proyek aktif di Jakarta"
                  value={newFacts}
                  onChange={(e) => setNewFacts(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-[11px] font-bold text-slate-700">Dugaan Alur / Masalah (INFERENCES)</Label>
                <Input
                  placeholder="e.g. Kemungkinan menghadapi selisih volume opname dengan konsultan MK"
                  value={newInferences}
                  onChange={(e) => setNewInferences(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-[11px] font-bold text-slate-700">Hal Belum Diketahui (UNKNOWNS)</Label>
                <Input
                  placeholder="e.g. Belum tahu software invoice yang dipakai dan rata-rata payment delay"
                  value={newUnknowns}
                  onChange={(e) => setNewUnknowns(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddLeadModal(false)} className="text-xs">
                  Batal
                </Button>
                <Button type="submit" size="sm" className="bg-slate-900 text-white text-xs font-semibold">
                  Simpan Prospek Riil
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LOG OUTREACH */}
      {showLogOutreachModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in-0">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Catat Upaya Outreach Riil</h3>
              <button onClick={() => setShowLogOutreachModal(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleLogOutreach} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] font-bold text-slate-700">Channel Outreach *</Label>
                  <select
                    value={outreachChannel}
                    onChange={(e) => setOutreachChannel(e.target.value as any)}
                    className="h-8 w-full border rounded-md px-2 text-xs bg-white mt-1 border-slate-200"
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                    <option value="LINKEDIN">LinkedIn DM</option>
                    <option value="REFERRAL">Referral Intro</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[11px] font-bold text-slate-700">Varian Pesan *</Label>
                  <select
                    value={outreachVariant}
                    onChange={(e) => setOutreachVariant(e.target.value as any)}
                    className="h-8 w-full border rounded-md px-2 text-xs bg-white mt-1 border-slate-200"
                  >
                    <option value="WARM_WA">Warm WA (Problem-First)</option>
                    <option value="COLD_WA">Cold WA</option>
                    <option value="EMAIL">Formal Email</option>
                    <option value="LINKEDIN">LinkedIn DM</option>
                    <option value="REFERRAL_INTRO">Referral</option>
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-bold text-slate-700">Tindakan Selanjutnya (Follow-up Date)</Label>
                <Input
                  value={outreachNextAction}
                  onChange={(e) => setOutreachNextAction(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowLogOutreachModal(false)} className="text-xs">
                  Batal
                </Button>
                <Button type="submit" size="sm" className="bg-slate-900 text-white text-xs font-semibold">
                  Konfirmasi Pengiriman Pesan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD DISCOVERY */}
      {showDiscoveryModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in-0">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Catat Hasil Panggilan Discovery (30–45 Mins)</h3>
              <button onClick={() => setShowDiscoveryModal(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordDiscovery} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] font-bold text-slate-700">Jumlah Proyek Aktif</Label>
                  <Input
                    type="number"
                    value={discActiveProjects}
                    onChange={(e) => setDiscActiveProjects(Number(e.target.value))}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold text-slate-700">Minat Pilot 30 Hari</Label>
                  <select
                    value={discPilotInterest}
                    onChange={(e) => setDiscPilotInterest(e.target.value as any)}
                    className="h-8 w-full border rounded-md px-2 text-xs bg-white mt-1 border-slate-200"
                  >
                    <option value="HIGH">HIGH (Setuju mencoba 1 proyek)</option>
                    <option value="MEDIUM">MEDIUM (Tertarik, perlu follow up)</option>
                    <option value="LOW">LOW (Ragu)</option>
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-bold text-slate-700">Masalah Termin Terbesar yang Diungkapkan *</Label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Selisih volume opname fasade dengan konsultan MK menunda BAP selama 3 minggu"
                  value={discMainProblem}
                  onChange={(e) => setDiscMainProblem(e.target.value)}
                  className="w-full border rounded-md p-2 text-xs mt-1 border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] font-bold text-slate-700">Tahap Terjadinya Delay</Label>
                  <select
                    value={discPainStage}
                    onChange={(e) => setDiscPainStage(e.target.value)}
                    className="h-8 w-full border rounded-md px-2 text-xs bg-white mt-1 border-slate-200"
                  >
                    <option value="MEASUREMENT">Opname Bersama</option>
                    <option value="UNDER_REVIEW">Evaluasi MK / Sertifikasi BAP</option>
                    <option value="CERTIFIED">Penerbitan Invoice</option>
                    <option value="INVOICED">Pencairan Kas / Jatuh Tempo</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[11px] font-bold text-slate-700">Estimasi Nilai Tertahan (IDR)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 650000000"
                    value={discFinancialImpact}
                    onChange={(e) => setDiscFinancialImpact(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-bold text-slate-700">Tools / Software Saat Ini</Label>
                <Input
                  value={discTools}
                  onChange={(e) => setDiscTools(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowDiscoveryModal(false)} className="text-xs">
                  Batal
                </Button>
                <Button type="submit" size="sm" className="bg-indigo-900 text-white text-xs font-semibold">
                  Simpan Catatan Discovery & Evidence
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD CUSTOMER EVIDENCE */}
      {showAddEvidenceModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in-0">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Catat Bukti Validasi Lapangan</h3>
              <button onClick={() => setShowAddEvidenceModal(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEvidence} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] font-bold text-slate-700">Tipe Bukti *</Label>
                  <select
                    value={evidenceType}
                    onChange={(e) => setEvidenceType(e.target.value as any)}
                    className="h-8 w-full border rounded-md px-2 text-xs bg-white mt-1 border-slate-200"
                  >
                    <option value="PROBLEM">PROBLEM (Masalah Termin)</option>
                    <option value="WORKFLOW">WORKFLOW (Alur Opname/BAP)</option>
                    <option value="PAIN">PAIN (Rasa Sakit Finansial)</option>
                    <option value="FINANCIAL_IMPACT">FINANCIAL_IMPACT (Nilai Tertahan)</option>
                    <option value="RISK_CONFIRMATION">RISK_CONFIRMATION (Validasi Risiko)</option>
                    <option value="WTP">WTP (Kesiapan Membayar)</option>
                    <option value="OUTCOME">OUTCOME (Kas Cair/Tindakan)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[11px] font-bold text-slate-700">Tingkat Confidence</Label>
                  <select
                    value={evidenceConfidence}
                    onChange={(e) => setEvidenceConfidence(e.target.value as any)}
                    className="h-8 w-full border rounded-md px-2 text-xs bg-white mt-1 border-slate-200"
                  >
                    <option value="HIGH">HIGH (Data / Dokumen Riil)</option>
                    <option value="MEDIUM">MEDIUM (Pernyataan Lisan)</option>
                    <option value="LOW">LOW (Inferensi Founder)</option>
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-bold text-slate-700">Deskripsi Fakta Lapangan *</Label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Kontraktor mengonfirmasi bahwa selisih opname fasade menunda pengajuan BAP selama 3 minggu"
                  value={evidenceDesc}
                  onChange={(e) => setEvidenceDesc(e.target.value)}
                  className="w-full border rounded-md p-2 text-xs mt-1 border-slate-200"
                />
              </div>

              <div>
                <Label className="text-[11px] font-bold text-slate-700">Kutipan Langsung Prospek (Opsional)</Label>
                <Input
                  placeholder="e.g. Kami selalu kesulitan tahu posisi BAP kalau belum ditanya saat rapat direksi"
                  value={evidenceQuote}
                  onChange={(e) => setEvidenceQuote(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-[11px] font-bold text-slate-700">Estimasi Nilai Finansial Terkait (IDR, Opsional)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 500000000"
                  value={evidenceValue}
                  onChange={(e) => setEvidenceValue(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddEvidenceModal(false)} className="text-xs">
                  Batal
                </Button>
                <Button type="submit" size="sm" className="bg-slate-900 text-white text-xs font-semibold">
                  Simpan Bukti
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
