"use client";

import React, { useState } from "react";
import { formatIDR } from "@/lib/utils";
import { ActionPriority, OutcomeType, OUTCOME_TYPE_LABELS } from "@/lib/constants";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, CheckCircle2, MessageSquare } from "lucide-react";
import { WhatsAppDispatchModal } from "@/components/notifications/WhatsAppDispatchModal";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function ActionsPage() {
  const { currentUser, refreshState } = useTenant();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");

  // Resolve Modal State
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [selectedActionForWa, setSelectedActionForWa] = useState<any>(null);
  const [resolution, setResolution] = useState("");
  const [outcomeType, setOutcomeType] = useState<OutcomeType>("cash_released");
  const [outcomeValue, setOutcomeValue] = useState(650000000);
  const [showResolveModal, setShowResolveModal] = useState(false);

  // New Action Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newProjectId, setNewProjectId] = useState(coveStore.projects[0]?.id || "");
  const [newExposure, setNewExposure] = useState(500000000);
  const [newPriority, setNewPriority] = useState<ActionPriority>("high");
  const [newOwnerId, setNewOwnerId] = useState(currentUser.id);
  const [newDueDate, setNewDueDate] = useState(
    new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0]
  );

  const allActions = coveStore.actions;

  const handleResolveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActionId) return;

    try {
      coveStore.resolveAction(selectedActionId, resolution, outcomeType, outcomeValue);
      setShowResolveModal(false);
      setSelectedActionId(null);
      setResolution("");
      refreshState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateAction = (e: React.FormEvent) => {
    e.preventDefault();
    coveStore.createAction({
      projectId: newProjectId,
      entityType: "claim",
      riskType: "UNCERTIFIED_AT_RISK",
      financialExposure: newExposure,
      title: newTitle,
      description: newDesc,
      ownerId: newOwnerId,
      priority: newPriority,
      dueDate: newDueDate,
    });

    setShowCreateModal(false);
    setNewTitle("");
    setNewDesc("");
    refreshState();
  };

  const filterByTab = (actionsList: typeof allActions) => {
    const today = new Date().toISOString().split("T")[0];
    switch (activeTab) {
      case "my":
        return actionsList.filter((a) => a.ownerId === currentUser.id);
      case "overdue":
        return actionsList.filter((a) => a.status !== "resolved" && a.dueDate < today);
      case "critical":
        return actionsList.filter((a) => a.priority === "critical" && a.status !== "resolved");
      case "resolved":
        return actionsList.filter((a) => a.status === "resolved");
      default:
        return actionsList.filter((a) => a.status !== "resolved");
    }
  };

  const displayedActions = filterByTab(allActions).filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {t("act.title", "Mesin Tindakan Ekonomi (Economic Action Engine)")}
            </h1>
            <span className="text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
              {language === "id" ? "Tindakan Finansial Terhubung" : "Money-Linked Actions"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {t("act.subtitle", "Tugaskan dan pantau tindakan nyata penanganan risiko finansial hingga verifikasi kas terlepas (Cash Released)")}
          </p>
        </div>

        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs gap-1.5"
        >
          <Plus className="h-4 w-4" />
          <span>{language === "id" ? "Buat Tindakan Baru" : "New Economic Action"}</span>
        </Button>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">{language === "id" ? "Tindakan Terbuka" : "Open Actions"} ({allActions.filter((a) => a.status !== "resolved").length})</TabsTrigger>
            <TabsTrigger value="my">{language === "id" ? "Tindakan Saya" : "My Actions"} ({allActions.filter((a) => a.ownerId === currentUser.id && a.status !== "resolved").length})</TabsTrigger>
            <TabsTrigger value="critical">{language === "id" ? "Kritis" : "Critical"} ({allActions.filter((a) => a.priority === "critical" && a.status !== "resolved").length})</TabsTrigger>
            <TabsTrigger value="overdue">{language === "id" ? "Jatuh Tempo" : "Overdue"}</TabsTrigger>
            <TabsTrigger value="resolved">{language === "id" ? "Selesai" : "Resolved"} ({allActions.filter((a) => a.status === "resolved").length})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-64">
          <Input
            type="text"
            placeholder={language === "id" ? "Cari tindakan..." : "Filter actions..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs h-9"
          />
        </div>
      </div>

      {/* Actions Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">{language === "id" ? "Prioritas" : "Priority"}</th>
                <th className="py-3 px-4">{language === "id" ? "Tindakan & Konteks" : "Action & Context"}</th>
                <th className="py-3 px-4">{language === "id" ? "Proyek" : "Project"}</th>
                <th className="py-3 px-4">{t("act.exposure", "Financial Exposure")}</th>
                <th className="py-3 px-4">{t("act.assignee", "Owner")}</th>
                <th className="py-3 px-4">{t("act.due_date", "Due Date")}</th>
                <th className="py-3 px-4">{language === "id" ? "Status / Hasil" : "Status / Outcome"}</th>
                <th className="py-3 px-4 text-right">{language === "id" ? "Aksi" : "Action"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedActions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-500">
                    {language === "id" ? "Tidak ada tindakan pada filter ini." : "No actions under this filter."}
                  </td>
                </tr>
              ) : (
                displayedActions.map((act) => {
                  const project = coveStore.projects.find((p) => p.id === act.projectId);
                  const owner = coveStore.profiles.find((p) => p.id === act.ownerId);

                  const priorityStyle = {
                    critical: "bg-red-50 text-red-700 border-red-200",
                    high: "bg-orange-50 text-orange-700 border-orange-200",
                    medium: "bg-amber-50 text-amber-700 border-amber-200",
                    low: "bg-slate-50 text-slate-600 border-slate-200",
                  }[act.priority];

                  const priorityLabel = {
                    critical: language === "id" ? "KRITIS" : "CRITICAL",
                    high: language === "id" ? "TINGGI" : "HIGH",
                    medium: language === "id" ? "SEDANG" : "MEDIUM",
                    low: language === "id" ? "RENDAH" : "LOW",
                  }[act.priority];

                  return (
                    <tr key={act.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${priorityStyle}`}>
                          {priorityLabel}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 max-w-[320px]">
                        <div className="font-bold text-slate-900 text-sm leading-snug">{act.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{act.description}</div>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-700">
                        {project?.projectName || "-"}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {formatIDR(act.financialExposure)}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700">
                        <span className="font-semibold">{owner?.fullName || "Unassigned"}</span>
                        <div className="text-[10px] text-slate-400">{owner?.jobTitle}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-700 font-medium">
                        {act.dueDate}
                      </td>

                      <td className="py-3.5 px-4">
                        {act.status === "resolved" ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px] uppercase w-fit">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>{OUTCOME_TYPE_LABELS[act.outcomeType || "cash_released"]}</span>
                            </span>
                            {act.outcomeValue && act.outcomeValue > 0 ? (
                              <span className="text-[10px] text-emerald-800 font-mono font-bold">
                                Value: {formatIDR(act.outcomeValue)}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                            {act.status === "in_progress" ? (language === "id" ? "Sedang Berjalan" : "In Progress") : act.status.replace("_", " ")}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            onClick={() => setSelectedActionForWa(act)}
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-semibold text-emerald-800 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 px-2"
                            title="Kirim WA Penugasan ke PIC"
                          >
                            <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                          </Button>
                          {act.status !== "resolved" ? (
                            <Button
                              onClick={() => {
                                setSelectedActionId(act.id);
                                setOutcomeValue(act.financialExposure);
                                setShowResolveModal(true);
                              }}
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs font-semibold text-emerald-800 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 gap-1"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>{language === "id" ? "Selesaikan" : "Resolve Action"}</span>
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">{language === "id" ? "Selesai" : "Resolved"}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Resolution Modal */}
      <Dialog open={showResolveModal} onOpenChange={setShowResolveModal}>
        <DialogHeader>
          <DialogTitle>{language === "id" ? "Selesaikan Tindakan & Catat Hasil Ekonomi" : "Resolve Action & Record Economic Outcome"}</DialogTitle>
          <DialogDescription>
            {language === "id" ? "Selesaikan tindakan dan catat hasil finansial nyata (misal: kas cair, risiko berkurang)" : "Complete action and record tangible economic outcomes"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleResolveSubmit} className="space-y-4 text-xs">
          <div>
            <Label htmlFor="resnote">{language === "id" ? "Catatan Resolusi / Tindakan yang Dilakukan *" : "Resolution Notes *"}</Label>
            <Textarea
              id="resnote"
              required
              placeholder={language === "id" ? "Contoh: Rapat koordinasi dengan MK telah selesai, BA selisih volume Rp650M telah ditandatangani dan disetujui." : "e.g. Discrepancy resolved with consultant..."}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="outtype">{language === "id" ? "Jenis Hasil Finansial (Outcome Type) *" : "Outcome Type *"}</Label>
            <Select
              id="outtype"
              value={outcomeType}
              onChange={(e) => setOutcomeType(e.target.value as any)}
              className="mt-1"
            >
              {Object.entries(OUTCOME_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="outval">{language === "id" ? "Nilai Ekonomi yang Terlepas / Terlindungi (IDR)" : "Financial Value Released (IDR)"}</Label>
            <Input
              id="outval"
              type="number"
              value={outcomeValue}
              onChange={(e) => setOutcomeValue(Number(e.target.value))}
              className="mt-1 font-mono text-sm font-bold text-emerald-700"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowResolveModal(false)}>
              {t("common.cancel", "Batal")}
            </Button>
            <Button type="submit" className="bg-emerald-700 text-white font-bold">
              {language === "id" ? "Konfirmasi Selesai" : "Confirm Resolved"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* New Action Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogHeader>
          <DialogTitle>{language === "id" ? "Buat Tindakan Ekonomi Baru" : "Create New Economic Action"}</DialogTitle>
          <DialogDescription>
            {language === "id" ? "Tugaskan tindakan penanganan risiko kepada penanggung jawab tim komersial/lapangan" : "Assign risk resolution tasks to team leads"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateAction} className="space-y-4 text-xs">
          <div>
            <Label htmlFor="acttitle">{language === "id" ? "Judul Tindakan *" : "Action Title *"}</Label>
            <Input
              id="acttitle"
              required
              placeholder={language === "id" ? "Contoh: Koordinasi Berita Acara Selisih Volume Fasade" : "e.g. Quantity discrepancy coordination"}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="actdesc">{language === "id" ? "Deskripsi & Langkah Penyelesaian *" : "Description & Next Steps *"}</Label>
            <Textarea
              id="actdesc"
              required
              placeholder={language === "id" ? "Jelaskan langkah konkret yang harus diselesaikan penanggung jawab..." : "Describe actionable steps..."}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="actproj">{language === "id" ? "Proyek" : "Project"}</Label>
              <Select id="actproj" value={newProjectId} onChange={(e) => setNewProjectId(e.target.value)} className="mt-1">
                {coveStore.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectName}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="actexp">{language === "id" ? "Eksposur Finansial (IDR)" : "Financial Exposure (IDR)"}</Label>
              <Input
                id="actexp"
                type="number"
                required
                value={newExposure}
                onChange={(e) => setNewExposure(Number(e.target.value))}
                className="mt-1 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="actprio">{language === "id" ? "Prioritas" : "Priority"}</Label>
              <Select id="actprio" value={newPriority} onChange={(e) => setNewPriority(e.target.value as any)} className="mt-1">
                <option value="low">{language === "id" ? "Rendah" : "Low"}</option>
                <option value="medium">{language === "id" ? "Sedang" : "Medium"}</option>
                <option value="high">{language === "id" ? "Tinggi" : "High"}</option>
                <option value="critical">{language === "id" ? "Kritis" : "Critical"}</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="actowner">{language === "id" ? "Penanggung Jawab" : "Owner"}</Label>
              <Select id="actowner" value={newOwnerId} onChange={(e) => setNewOwnerId(e.target.value)} className="mt-1">
                {coveStore.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="actdue">{language === "id" ? "Batas Waktu" : "Due Date"}</Label>
              <Input id="actdue" type="date" required value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="mt-1 font-mono" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
              {t("common.cancel", "Batal")}
            </Button>
            <Button type="submit" className="bg-slate-900 text-white font-bold">
              {language === "id" ? "Simpan Tindakan" : "Save Action"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Direct WhatsApp Action Dispatcher Modal */}
      {selectedActionForWa && (
        <WhatsAppDispatchModal
          open={Boolean(selectedActionForWa)}
          onOpenChange={(op) => !op && setSelectedActionForWa(null)}
          defaultPayload={{
            projectName: coveStore.projects.find((p) => p.id === selectedActionForWa.projectId)?.projectName || "Proyek Konstruksi",
            recipientName: coveStore.profiles.find((p) => p.id === selectedActionForWa.ownerId)?.fullName || "Tim Lapangan",
            recipientRole: coveStore.profiles.find((p) => p.id === selectedActionForWa.ownerId)?.jobTitle || "PIC",
            recipientPhone: coveStore.profiles.find((p) => p.id === selectedActionForWa.ownerId)?.phone || "081288991122",
            actionTitle: selectedActionForWa.title,
            amount: selectedActionForWa.financialExposure,
            dueDate: selectedActionForWa.dueDate,
            messageType: "ACTION_ASSIGNED",
          }}
        />
      )}
    </div>
  );
}
