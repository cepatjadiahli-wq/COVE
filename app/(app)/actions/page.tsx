"use client";

import React, { useState } from "react";
import { formatIDR } from "@/lib/utils";
import { ActionPriority, OutcomeType, OUTCOME_TYPE_LABELS, ActionStatus } from "@/lib/constants";
import {
  aggregateOverdueActions,
  evaluateActionEscalation,
  validateActionCreation,
  validateActionResolution,
  validateActionReopen,
  ActionItem,
} from "@/domains/actions/service";
import {
  ACTIONABLE_EMPTY_STATES,
  formatActionableError,
  previewBulkAction,
  formatSourceLineage,
} from "@/domains/platform/service";
import Link from "next/link";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  CheckCircle2,
  MessageSquare,
  AlertTriangle,
  Clock,
  Send,
  Camera,
  Link as LinkIcon,
  RotateCcw,
  Users,
  Calendar,
  Layers,
  FileCheck,
  ShieldAlert,
  Search,
  CheckSquare,
  Square,
  Building,
  UserCheck,
} from "lucide-react";
import { WhatsAppDispatchModal } from "@/components/notifications/WhatsAppDispatchModal";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function ActionsPage() {
  const { currentUser, refreshState } = useTenant();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");

  // Selection for Bulk Actions (ACT-008)
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>([]);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [bulkNewOwnerId, setBulkNewOwnerId] = useState(currentUser.id);
  const [showBulkDueDateModal, setShowBulkDueDateModal] = useState(false);
  const [bulkNewDueDate, setBulkNewDueDate] = useState(
    new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0]
  );
  const [bulkConfirmed, setBulkConfirmed] = useState(false);

  // Resolve Modal State (ACT-006, UAT-09)
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [selectedActionForWa, setSelectedActionForWa] = useState<any>(null);
  const [resolution, setResolution] = useState("");
  const [closureEvidenceUrl, setClosureEvidenceUrl] = useState("");
  const [closureEvidenceNote, setClosureEvidenceNote] = useState("");
  const [outcomeType, setOutcomeType] = useState<OutcomeType>("cash_released");
  const [outcomeValue, setOutcomeValue] = useState<number>(0);
  const [showResolveModal, setShowResolveModal] = useState(false);

  // Reopen Modal State (ACT-014)
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenActionId, setReopenActionId] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState("");

  // Comment Modal State (ACT-013)
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentActionId, setCommentActionId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState("");

  // Weekly Review Snapshot Modal State (ACT-015)
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [snapshotNotes, setSnapshotNotes] = useState("");

  // New Action Modal State (ACT-001, ACT-002, ACT-004, UAT-08)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newNextStep, setNewNextStep] = useState("");
  const [newProjectId, setNewProjectId] = useState(coveStore.projects[0]?.id || "prj-meridian");
  const [newExposure, setNewExposure] = useState(500000000);
  const [newPriority, setNewPriority] = useState<ActionPriority>("high");
  const [newOwnerId, setNewOwnerId] = useState(currentUser.id);
  const [newDueDate, setNewDueDate] = useState(
    new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0]
  );
  const [newExtName, setNewExtName] = useState("");
  const [newExtOrg, setNewExtOrg] = useState("");
  const [newExtPhone, setNewExtPhone] = useState("");

  const allActions = (coveStore.actions as any[]) || [];

  // Aggregation of Overdue Actions by Rupiah Value (ACT-007)
  const overdueSummary = aggregateOverdueActions(allActions as any);
  const totalOpenExposure = allActions
    .filter((a) => a.status !== "resolved" && a.status !== "cancelled")
    .reduce((sum, a) => sum + (a.financialExposure || 0), 0);

  // Handlers
  const handleOpenResolveModal = (action: any) => {
    setSelectedActionId(action.id);
    setOutcomeValue(action.financialExposure || 0);
    setResolution("");
    setClosureEvidenceUrl("");
    setClosureEvidenceNote("");
    setShowResolveModal(true);
  };

  const handleResolveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActionId) return;

    // Validate closure reason and evidence (ACT-006, UAT-09)
    const valResult = validateActionResolution({
      actionId: selectedActionId,
      resolutionText: resolution,
      closureEvidenceUrl,
      closureEvidenceNote,
      outcomeType,
      outcomeValue,
      resolvedByUserId: currentUser.id,
      resolvedByName: currentUser.fullName,
    });

    if (!valResult.success) {
      const actionableErr = formatActionableError("ERR_CLOSURE_EVIDENCE_MISSING");
      alert(`${valResult.error}\n\nSolusi (PLT-016): ${actionableErr.remediation}`);
      return;
    }

    try {
      coveStore.resolveAction(
        selectedActionId,
        resolution,
        outcomeType,
        outcomeValue,
        closureEvidenceUrl,
        closureEvidenceNote,
        currentUser.fullName
      );
      setShowResolveModal(false);
      setSelectedActionId(null);
      setResolution("");
      refreshState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOpenReopenModal = (actionId: string) => {
    setReopenActionId(actionId);
    setReopenReason("");
    setShowReopenModal(true);
  };

  const handleConfirmReopen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenActionId) return;

    const valResult = validateActionReopen(reopenReason);
    if (!valResult.valid) {
      const actionableErr = formatActionableError("ERR_REOPEN_REASON_REQUIRED");
      alert(`${valResult.error}\n\nSolusi (PLT-016): ${actionableErr.remediation}`);
      return;
    }

    try {
      coveStore.reopenAction(reopenActionId, reopenReason, currentUser.fullName);
      setShowReopenModal(false);
      setReopenActionId(null);
      setReopenReason("");
      refreshState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateAction = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedOwner = coveStore.profiles.find((p) => p.id === newOwnerId);
    const ownerName = selectedOwner ? `${selectedOwner.fullName} (${selectedOwner.role})` : currentUser.fullName;

    // Validate creation rules (ACT-001, ACT-002, ACT-004, UAT-08)
    const valResult = validateActionCreation({
      projectId: newProjectId,
      financialExposure: newExposure,
      title: newTitle,
      description: newDesc,
      nextStep: newNextStep,
      ownerId: newOwnerId,
      ownerName,
      priority: newPriority,
      dueDate: newDueDate,
      externalCounterpartName: newExtName,
      externalCounterpartOrg: newExtOrg,
      externalCounterpartPhone: newExtPhone,
    });

    if (!valResult.valid) {
      const actionableErr = formatActionableError("ERR_OWNER_REQUIRED");
      alert(`${valResult.error}\n\nSolusi (PLT-016): ${actionableErr.remediation}`);
      return;
    }

    try {
      coveStore.createAction(
        {
          projectId: newProjectId,
          entityType: "claim",
          riskType: "UNCERTIFIED_AT_RISK",
          financialExposure: newExposure,
          title: newTitle,
          description: newDesc,
          nextStep: newNextStep,
          ownerId: newOwnerId,
          ownerName,
          priority: newPriority,
          dueDate: newDueDate,
          externalCounterpartName: newExtName.trim() || undefined,
          externalCounterpartOrg: newExtOrg.trim() || undefined,
          externalCounterpartPhone: newExtPhone.trim() || undefined,
        },
        currentUser.fullName
      );

      setShowCreateModal(false);
      setNewTitle("");
      setNewDesc("");
      setNewNextStep("");
      refreshState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOpenCommentModal = (actionId: string) => {
    setCommentActionId(actionId);
    setNewCommentText("");
    setShowCommentModal(true);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentActionId || !newCommentText.trim()) return;

    coveStore.addActionComment(commentActionId, newCommentText.trim(), currentUser.fullName);
    setNewCommentText("");
    refreshState();
  };

  const handleToggleSelectAll = (filtered: any[]) => {
    if (selectedActionIds.length === filtered.length) {
      setSelectedActionIds([]);
    } else {
      setSelectedActionIds(filtered.map((a) => a.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    if (selectedActionIds.includes(id)) {
      setSelectedActionIds(selectedActionIds.filter((item) => item !== id));
    } else {
      setSelectedActionIds([...selectedActionIds, id]);
    }
  };

  const handleExecuteBulkAssign = () => {
    if (selectedActionIds.length === 0) return;
    const selectedOwner = coveStore.profiles.find((p) => p.id === bulkNewOwnerId);
    const ownerName = selectedOwner ? `${selectedOwner.fullName} (${selectedOwner.role})` : "Team Member";

    coveStore.bulkAssignActions(selectedActionIds, bulkNewOwnerId, ownerName, currentUser.fullName);
    setShowBulkAssignModal(false);
    setSelectedActionIds([]);
    refreshState();
  };

  const handleExecuteBulkDueDate = () => {
    if (selectedActionIds.length === 0) return;
    coveStore.bulkDueDateActions(selectedActionIds, bulkNewDueDate, currentUser.fullName);
    setShowBulkDueDateModal(false);
    setSelectedActionIds([]);
    refreshState();
  };

  const handleLockWeeklySnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    const today = new Date().toISOString().split("T")[0];

    coveStore.createWeeklySnapshot(
      {
        snapshotDate: today,
        totalExposure: totalOpenExposure,
        controllableExposure: totalOpenExposure * 0.6,
        openActionsCount: allActions.filter((a) => a.status !== "resolved").length,
        overdueActionsCount: overdueSummary.totalOverdueCount,
        overdueExposure: overdueSummary.totalOverdueValue,
        freshnessStatus: "CURRENT",
        notes: snapshotNotes.trim() || `Review mingguan dikunci oleh ${currentUser.fullName}`,
      },
      currentUser.fullName
    );

    setShowSnapshotModal(false);
    setSnapshotNotes("");
    alert("Snapshot Review Mingguan berhasil dikunci (ACT-015)!");
    refreshState();
  };

  const filterByTab = (actionsList: any[]) => {
    const today = new Date().toISOString().split("T")[0];
    switch (activeTab) {
      case "my":
        return actionsList.filter((a) => a.ownerId === currentUser.id);
      case "overdue":
        return actionsList.filter((a) => a.status !== "resolved" && a.status !== "cancelled" && a.dueDate < today);
      case "critical":
        return actionsList.filter((a) => a.priority === "critical" && a.status !== "resolved");
      case "waiting_external":
        return actionsList.filter((a) => a.status === "waiting_external");
      case "resolved":
        return actionsList.filter((a) => a.status === "resolved");
      default:
        return actionsList.filter((a) => a.status !== "resolved" && a.status !== "cancelled");
    }
  };

  const displayedActions = filterByTab(allActions).filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    (a.description && a.description.toLowerCase().includes(search.toLowerCase())) ||
    (a.ownerName && a.ownerName.toLowerCase().includes(search.toLowerCase())) ||
    (a.externalCounterpartName && a.externalCounterpartName.toLowerCase().includes(search.toLowerCase()))
  );

  const activeCommentAction = allActions.find((a) => a.id === commentActionId);

  return (
    <div className="space-y-6">
      {/* 1. Page Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Action &amp; Escalation Queue</span>
            <span className="text-xs bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
              PRD Modul 4
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Mengubah setiap eksposur finansial menjadi tindakan nyata dengan penanggung jawab, batas waktu, dan bukti penyelesaian.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Lock Weekly Snapshot Button (ACT-015) */}
          <Button
            variant="outline"
            onClick={() => setShowSnapshotModal(true)}
            className="text-xs font-semibold gap-1.5 border-slate-300 hover:bg-slate-50"
          >
            <Layers className="h-4 w-4 text-purple-700" />
            <span>Kunci Snapshot Mingguan (ACT-015)</span>
          </Button>

          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Buat Tindakan Baru</span>
          </Button>
        </div>
      </div>

      {/* 2. Executive Overdue & Exposure Summary Header (ACT-007) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Overdue Action Value in Rupiah (ACT-007) */}
        <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 shadow-2xs">
          <div className="flex items-center justify-between text-red-800 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Nilai Tindakan Overdue (ACT-007)</span>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
          <div className="text-xl font-bold font-mono text-red-900">
            {formatIDR(overdueSummary.totalOverdueValue)}
          </div>
          <div className="text-[11px] text-red-700 mt-1">
            {overdueSummary.totalOverdueCount} tindakan melewati batas waktu target
          </div>
        </div>

        {/* Card 2: Total Open Exposure Value */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Total Eksposur Terikat</span>
            <Clock className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">
            {formatIDR(totalOpenExposure)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {allActions.filter((a) => a.status !== "resolved").length} tindakan aktif dalam antrean
          </div>
        </div>

        {/* Card 3: Critical Priority Overdue */}
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 shadow-2xs">
          <div className="flex items-center justify-between text-amber-800 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Overdue Kritis Direksi</span>
            <ShieldAlert className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-900">
            {formatIDR(overdueSummary.criticalOverdueValue)}
          </div>
          <div className="text-[11px] text-amber-700 mt-1">
            Eskalasi prioritas tinggi yang membutuhkan intervensi
          </div>
        </div>

        {/* Card 4: Resolved Impact This Period */}
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-800 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Eksposur Tuntas (Resolved)</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-900">
            {formatIDR(
              allActions
                .filter((a) => a.status === "resolved")
                .reduce((sum, a) => sum + (a.outcomeValue || a.financialExposure || 0), 0)
            )}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1">
            {allActions.filter((a) => a.status === "resolved").length} tindakan selesai dengan bukti penutupan
          </div>
        </div>
      </div>

      {/* 3. Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="bg-slate-100 p-1">
            <TabsTrigger value="all" className="text-xs font-semibold">
              Semua Aktif ({allActions.filter((a) => a.status !== "resolved" && a.status !== "cancelled").length})
            </TabsTrigger>
            <TabsTrigger value="my" className="text-xs font-semibold">
              Tugasku ({allActions.filter((a) => a.ownerId === currentUser.id && a.status !== "resolved").length})
            </TabsTrigger>
            <TabsTrigger value="overdue" className="text-xs font-semibold text-red-700">
              Overdue ({overdueSummary.totalOverdueCount})
            </TabsTrigger>
            <TabsTrigger value="critical" className="text-xs font-semibold">
              Kritis
            </TabsTrigger>
            <TabsTrigger value="waiting_external" className="text-xs font-semibold">
              Menunggu Pihak Luar
            </TabsTrigger>
            <TabsTrigger value="resolved" className="text-xs font-semibold text-emerald-700">
              Selesai ({allActions.filter((a) => a.status === "resolved").length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Cari judul, PIC, counterpart..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs bg-white"
          />
        </div>
      </div>

      {/* 4. Bulk Operations Bar (ACT-008) */}
      {displayedActions.length > 0 && activeTab !== "resolved" && (
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleToggleSelectAll(displayedActions)}
              className="flex items-center gap-1.5 font-bold text-slate-700 hover:text-slate-900"
            >
              {selectedActionIds.length === displayedActions.length ? (
                <CheckSquare className="h-4 w-4 text-blue-700" />
              ) : (
                <Square className="h-4 w-4 text-slate-400" />
              )}
              <span>Pilih Semua ({selectedActionIds.length}/{displayedActions.length})</span>
            </button>
          </div>

          {selectedActionIds.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowBulkAssignModal(true)}
                className="h-7 text-xs text-blue-700 border-blue-200 hover:bg-blue-50 font-semibold gap-1"
              >
                <Users className="h-3.5 w-3.5" />
                <span>Tugaskan Massal ({selectedActionIds.length})</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowBulkDueDateModal(true)}
                className="h-7 text-xs text-amber-700 border-amber-200 hover:bg-amber-50 font-semibold gap-1"
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Ubah Tenggat Massal ({selectedActionIds.length})</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 5. Actions Items List */}
      <div className="space-y-3">
        {displayedActions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200 p-6 max-w-lg mx-auto space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">
              {ACTIONABLE_EMPTY_STATES.ACTIONS_QUEUE.title}
            </h4>
            <p className="text-xs text-slate-500">
              {ACTIONABLE_EMPTY_STATES.ACTIONS_QUEUE.explanation}
            </p>
            <p className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <strong>Langkah berikutnya (PLT-015):</strong>{" "}
              {ACTIONABLE_EMPTY_STATES.ACTIONS_QUEUE.nextStepInstruction}
            </p>
            <div className="pt-2">
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
              >
                {ACTIONABLE_EMPTY_STATES.ACTIONS_QUEUE.primaryCtaLabel}
              </Button>
            </div>
          </div>
        ) : (
          displayedActions.map((action) => {
            const isOverdue =
              action.status !== "resolved" &&
              action.status !== "cancelled" &&
              action.dueDate < new Date().toISOString().split("T")[0];

            const escalation = evaluateActionEscalation(action as ActionItem);
            const isSelected = selectedActionIds.includes(action.id);

            return (
              <div
                key={action.id}
                className={`p-4 rounded-xl border transition-all ${
                  isOverdue
                    ? "bg-red-50/30 border-red-200 hover:border-red-300"
                    : "bg-white border-slate-200 hover:border-slate-300"
                } shadow-2xs space-y-3`}
              >
                {/* Header: Title, Checkbox, Badges, and Exposure Value (ACT-001) */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {action.status !== "resolved" && (
                      <button
                        onClick={() => handleToggleSelectOne(action.id)}
                        className="mt-1 text-slate-400 hover:text-slate-600"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-blue-700" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    )}

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Priority Badge */}
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                            action.priority === "critical"
                              ? "bg-red-100 text-red-800 border-red-200"
                              : action.priority === "high"
                              ? "bg-amber-100 text-amber-800 border-amber-200"
                              : "bg-blue-100 text-blue-800 border-blue-200"
                          }`}
                        >
                          {action.priority}
                        </span>

                        {/* Status Badge (ACT-005) */}
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {action.status}
                        </span>

                        {/* Escalation Level Badge (ACT-011) */}
                        {escalation.isEscalated && (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1">
                            <ShieldAlert className="h-3 w-3" />
                            <span>Eskalasi: {escalation.escalatedToRole}</span>
                          </span>
                        )}

                        <span className="font-bold text-slate-900 text-sm">{action.title}</span>
                      </div>

                      {action.description && (
                        <p className="text-xs text-slate-600 mt-1">{action.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Prominent Exposure Value (ACT-001) */}
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Nilai Terdampak</span>
                    <span className="font-bold font-mono text-sm text-slate-900">
                      {formatIDR(action.financialExposure || 0)}
                    </span>
                  </div>
                </div>

                {/* Details Row: Next Step, Owner, Due Date, and External Counterpart */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50/80 rounded-lg text-xs border border-slate-100">
                  {/* Next Step (ACT-004) */}
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">
                      Langkah Berikutnya (Next Step)
                    </span>
                    <span className="font-medium text-slate-800 block mt-0.5">
                      {action.nextStep || "Belum ditentukan"}
                    </span>
                  </div>

                  {/* Internal Owner & Due Date (ACT-002, ACT-004, UAT-08) */}
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">
                      Penanggung Jawab &amp; Tenggat
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-bold text-slate-900">
                        {action.ownerName || action.ownerId}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span className={isOverdue ? "text-red-700 font-bold" : "text-slate-600"}>
                        {action.dueDate} {isOverdue ? "(Overdue)" : ""}
                      </span>
                    </div>
                  </div>

                  {/* External Counterpart (ACT-003) */}
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">
                      Pihak Eksternal (Counterpart)
                    </span>
                    {action.externalCounterpartName ? (
                      <div className="mt-0.5 space-y-0.5 text-[11px]">
                        <span className="font-bold text-slate-800 block">
                          {action.externalCounterpartName}
                        </span>
                        {action.externalCounterpartOrg && (
                          <span className="text-slate-500 block">{action.externalCounterpartOrg}</span>
                        )}
                        {action.externalCounterpartPhone && (
                          <span className="text-blue-700 font-mono block">
                            {action.externalCounterpartPhone}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-[11px] mt-0.5 block">
                        Internal saja (tanpa counterpart eksternal)
                      </span>
                    )}
                  </div>
                </div>

                {/* Closure Proof Display (for resolved actions) (ACT-006, UAT-09) */}
                {action.status === "resolved" && (
                  <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-emerald-950 text-xs flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                        <span>Diselesaikan ({action.resolvedAt?.substring(0, 10)})</span>
                      </div>
                      <p className="text-[11px] mt-1 text-emerald-900">
                        Catatan: {action.resolutionNotes || action.resolution}
                      </p>
                      {action.closureEvidenceUrl && (
                        <a
                          href={action.closureEvidenceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 hover:underline flex items-center gap-1 mt-1 font-semibold text-[11px]"
                        >
                          <LinkIcon className="h-3 w-3" />
                          <span>Tautan Bukti Penutupan</span>
                        </a>
                      )}
                      {action.closureEvidenceNote && (
                        <div className="text-[11px] text-emerald-800 italic mt-0.5">
                          Bukti: {action.closureEvidenceNote}
                        </div>
                      )}
                    </div>

                    {/* Reopen Action Button (ACT-014) */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenReopenModal(action.id)}
                      className="h-6 text-[10px] text-slate-700 hover:bg-slate-100 gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Buka Kembali (ACT-014)</span>
                    </Button>
                  </div>
                )}

                {/* Footer Action Buttons */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <div className="flex items-center gap-3">
                    {/* Discussion Comments Trigger (ACT-013) */}
                    <button
                      onClick={() => handleOpenCommentModal(action.id)}
                      className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-[11px] font-medium"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Komentar &amp; Diskusi ({(action.comments || []).length})</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* WhatsApp Deep Link Button (ACT-010) */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setSelectedActionForWa({
                          title: action.title,
                          claimNumber: action.entityId || "MC-006",
                          amount: action.financialExposure,
                          dueDate: action.dueDate,
                          blockerTitle: action.title,
                          recipientPhone: action.externalCounterpartPhone || "081234567890",
                          recipientName: action.externalCounterpartName || "Pihak Terkait",
                        })
                      }
                      className="h-7 text-[11px] text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-medium gap-1"
                    >
                      <Send className="h-3 w-3" />
                      <span>WhatsApp Link (ACT-010)</span>
                    </Button>

                    {/* Resolve Button (ACT-006, UAT-09) */}
                    {action.status !== "resolved" && (
                      <Button
                        size="sm"
                        onClick={() => handleOpenResolveModal(action)}
                        className="h-7 text-[11px] bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Selesaikan Tindakan</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: Create New Action (ACT-001, ACT-002, ACT-004, UAT-08) */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <Plus className="h-4 w-4 text-blue-700" />
            <span>Buat Tindakan Baru (PRD Modul 4)</span>
          </DialogTitle>
          <DialogDescription>
            Tindakan wajib terikat pada nilai eksposur finansial (ACT-001), memiliki penanggung jawab internal
            (ACT-002), langkah berikutnya (next step), dan tanggal batas waktu (ACT-004).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateAction} className="space-y-3 text-xs">
          <div>
            <Label htmlFor="actTitle">Judul Tindakan *</Label>
            <Input
              id="actTitle"
              required
              placeholder="Contoh: Rapat Teknis Pengesahan Volume Bersama MK"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="actProject">Proyek Terkait *</Label>
              <Select
                id="actProject"
                value={newProjectId}
                onChange={(e) => setNewProjectId(e.target.value)}
                className="mt-1"
              >
                {coveStore.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectName}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="actExposure">Nilai Eksposur Terdampak (Rp) *</Label>
              <Input
                id="actExposure"
                type="number"
                required
                min={0}
                value={newExposure}
                onChange={(e) => setNewExposure(Number(e.target.value))}
                className="mt-1 font-mono"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="actNextStep">Langkah Berikutnya (Next Step) *</Label>
            <Input
              id="actNextStep"
              required
              placeholder="Contoh: Kirim undangan rapat teknis dan rekap kubikasi versi kontraktor"
              value={newNextStep}
              onChange={(e) => setNewNextStep(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="actOwner">Penanggung Jawab Internal (Owner) *</Label>
              <Select
                id="actOwner"
                required
                value={newOwnerId}
                onChange={(e) => setNewOwnerId(e.target.value)}
                className="mt-1"
              >
                {coveStore.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} ({p.role})
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="actDueDate">Batas Waktu Target (Due Date) *</Label>
              <Input
                id="actDueDate"
                type="date"
                required
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <span className="font-bold text-slate-800 block text-[11px]">
              Pihak Eksternal Terkait (Opsional, Tanpa Keharusan Akun - ACT-003)
            </span>
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="Nama (e.g. Ir. Hendro)"
                value={newExtName}
                onChange={(e) => setNewExtName(e.target.value)}
                className="text-xs"
              />
              <Input
                placeholder="Organisasi (e.g. MK IndoKarya)"
                value={newExtOrg}
                onChange={(e) => setNewExtOrg(e.target.value)}
                className="text-xs"
              />
              <Input
                placeholder="No HP (e.g. 0812xxx)"
                value={newExtPhone}
                onChange={(e) => setNewExtPhone(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
              Batal
            </Button>
            <Button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white font-bold">
              Buat Tindakan
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* MODAL 2: Resolve Action with Mandatory Evidence (ACT-006, UAT-09) */}
      <Dialog open={showResolveModal} onOpenChange={setShowResolveModal}>
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-emerald-950 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            <span>Penyelesaian Tindakan (PRD ACT-006, UAT-09)</span>
          </DialogTitle>
          <DialogDescription>
            Penutupan tindakan mewajibkan alasan penutupan (closure reason) dan bukti penyelesaian (evidence URL atau catatan bukti minimal 5 karakter).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleResolveSubmit} className="space-y-3 text-xs">
          <div>
            <Label htmlFor="resReason">Alasan Penutupan / Hasil Resolusi *</Label>
            <Textarea
              id="resReason"
              required
              rows={2}
              placeholder="Contoh: Berita Acara kesepakatan volume fasade telah ditandatangani bersama Konsultan MK"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="resEvidenceUrl">Tautan Berkas Bukti (Google Drive / Cloud URL)</Label>
            <Input
              id="resEvidenceUrl"
              placeholder="https://drive.google.com/file/d/..."
              value={closureEvidenceUrl}
              onChange={(e) => setClosureEvidenceUrl(e.target.value)}
              className="mt-1 font-mono"
            />
          </div>

          <div>
            <Label htmlFor="resEvidenceNote">Catatan Bukti / Rujukan Berkas Fisik *</Label>
            <Input
              id="resEvidenceNote"
              placeholder="Contoh: Dokumen BA Nomor 042/BAP/MK/VIII/2026 lembar 3 asli tersimpan di kantor site"
              value={closureEvidenceNote}
              onChange={(e) => setClosureEvidenceNote(e.target.value)}
              className="mt-1"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              *Wajib mengisi tautan URL atau catatan bukti fisik (UAT-09).
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="resOutcomeType">Jenis Dampak Finansial *</Label>
              <Select
                id="resOutcomeType"
                value={outcomeType}
                onChange={(e) => setOutcomeType(e.target.value as OutcomeType)}
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
              <Label htmlFor="resOutcomeVal">Nilai Terealisasi (Rp) *</Label>
              <Input
                id="resOutcomeVal"
                type="number"
                value={outcomeValue}
                onChange={(e) => setOutcomeValue(Number(e.target.value))}
                className="mt-1 font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowResolveModal(false)}>
              Batal
            </Button>
            <Button type="submit" className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold">
              Konfirmasi Selesai &amp; Catat Audit
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* MODAL 3: Reopen Action with Mandatory Reason (ACT-014) */}
      <Dialog open={showReopenModal} onOpenChange={setShowReopenModal}>
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-amber-950 flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-amber-700" />
            <span>Buka Kembali Tindakan (PRD ACT-014)</span>
          </DialogTitle>
          <DialogDescription>
            Membuka kembali tindakan yang telah selesai mempertahankan riwayat penutupan sebelumnya dan mewajibkan alasan buka kembali.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleConfirmReopen} className="space-y-3 text-xs">
          <div>
            <Label htmlFor="reopenReason">Alasan Buka Kembali (Reopen Reason) *</Label>
            <Textarea
              id="reopenReason"
              required
              rows={3}
              placeholder="Contoh: Konsultan MK meminta revisi ulang pada perhitungan lembar 4 berita acara"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              className="mt-1"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowReopenModal(false)}>
              Batal
            </Button>
            <Button type="submit" className="bg-amber-700 hover:bg-amber-800 text-white font-bold">
              Buka Kembali Tindakan
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* MODAL 4: Bulk Assign Actions (ACT-008) */}
      <Dialog open={showBulkAssignModal} onOpenChange={setShowBulkAssignModal}>
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-700" />
            <span>Penugasan Massal (Bulk Assign - ACT-008, PLT-017)</span>
          </DialogTitle>
          <DialogDescription>
            Menugaskan ulang {selectedActionIds.length} tindakan ke penanggung jawab baru dengan rekam jejak audit per item.
          </DialogDescription>
        </DialogHeader>

        {(() => {
          const selectedItems = coveStore.actions
            .filter((a) => selectedActionIds.includes(a.id))
            .map((a) => ({ id: a.id, title: a.title, financialExposure: a.financialExposure || 0 }));
          const preview = previewBulkAction("BULK_ASSIGN", selectedItems);

          return (
            <div className="space-y-4 text-xs">
              {/* Impact Preview Card (PLT-017, UAT-17) */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between font-semibold text-slate-700">
                  <span>Pratinjau Dampak Nilai Tindakan (PLT-017):</span>
                  <span className="font-mono text-blue-900 font-bold">
                    {preview.totalItemCount} Item Terpilih
                  </span>
                </div>
                <div className="text-sm font-black font-mono text-slate-900">
                  Total Nilai Terdampak: Rp {preview.totalFinancialImpact.toLocaleString("id-ID")}
                </div>
              </div>

              {/* High-Value Material Warning (UAT-17) */}
              {preview.isHighValueImpact && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-[11px]">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>PERINGATAN PERUBAHAN BERNILAI BESAR (UAT-17)</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    {preview.impactNotice}
                  </p>
                  <label className="flex items-center gap-2 pt-1 cursor-pointer text-[11px] font-bold text-amber-950">
                    <input
                      type="checkbox"
                      checked={bulkConfirmed}
                      onChange={(e) => setBulkConfirmed(e.target.checked)}
                      className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    <span>Saya mengonfirmasi perubahan massal bernilai material ini (UAT-17)</span>
                  </label>
                </div>
              )}

              <div>
                <Label htmlFor="bulkOwner">Pilih Penanggung Jawab Baru *</Label>
                <Select
                  id="bulkOwner"
                  value={bulkNewOwnerId}
                  onChange={(e) => setBulkNewOwnerId(e.target.value)}
                  className="mt-1"
                >
                  {coveStore.profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.role})
                    </option>
                  ))}
                </Select>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBulkAssignModal(false)}>
                  Batal
                </Button>
                <Button
                  onClick={handleExecuteBulkAssign}
                  disabled={preview.isHighValueImpact && !bulkConfirmed}
                  className="bg-blue-700 hover:bg-blue-800 text-white font-bold disabled:opacity-50"
                >
                  Terapkan ke {preview.totalItemCount} Tindakan
                </Button>
              </DialogFooter>
            </div>
          );
        })()}
      </Dialog>

      {/* MODAL 5: Bulk Due Date Update (ACT-008, PLT-017, UAT-17) */}
      <Dialog open={showBulkDueDateModal} onOpenChange={(open) => { setShowBulkDueDateModal(open); setBulkConfirmed(false); }}>
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-700" />
            <span>Pembaruan Tenggat Massal (Bulk Due Date - ACT-008, PLT-017)</span>
          </DialogTitle>
          <DialogDescription>
            Mengubah tanggal batas waktu untuk {selectedActionIds.length} tindakan dengan rekam jejak audit per item.
          </DialogDescription>
        </DialogHeader>

        {(() => {
          const selectedItems = coveStore.actions
            .filter((a) => selectedActionIds.includes(a.id))
            .map((a) => ({ id: a.id, title: a.title, financialExposure: a.financialExposure || 0 }));
          const preview = previewBulkAction("BULK_DUE_DATE", selectedItems);

          return (
            <div className="space-y-4 text-xs">
              {/* Impact Preview Card (PLT-017, UAT-17) */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between font-semibold text-slate-700">
                  <span>Pratinjau Dampak Nilai Tindakan (PLT-017):</span>
                  <span className="font-mono text-amber-900 font-bold">
                    {preview.totalItemCount} Item Terpilih
                  </span>
                </div>
                <div className="text-sm font-black font-mono text-slate-900">
                  Total Nilai Terdampak: Rp {preview.totalFinancialImpact.toLocaleString("id-ID")}
                </div>
              </div>

              {/* High-Value Material Warning (UAT-17) */}
              {preview.isHighValueImpact && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-[11px]">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>PERINGATAN PERUBAHAN BERNILAI BESAR (UAT-17)</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    {preview.impactNotice}
                  </p>
                  <label className="flex items-center gap-2 pt-1 cursor-pointer text-[11px] font-bold text-amber-950">
                    <input
                      type="checkbox"
                      checked={bulkConfirmed}
                      onChange={(e) => setBulkConfirmed(e.target.checked)}
                      className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    <span>Saya mengonfirmasi perubahan massal bernilai material ini (UAT-17)</span>
                  </label>
                </div>
              )}

              <div>
                <Label htmlFor="bulkDue">Tanggal Jatuh Tempo Baru *</Label>
                <Input
                  id="bulkDue"
                  type="date"
                  value={bulkNewDueDate}
                  onChange={(e) => setBulkNewDueDate(e.target.value)}
                  className="mt-1 font-mono"
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBulkDueDateModal(false)}>
                  Batal
                </Button>
                <Button
                  onClick={handleExecuteBulkDueDate}
                  disabled={preview.isHighValueImpact && !bulkConfirmed}
                  className="bg-amber-700 hover:bg-amber-800 text-white font-bold disabled:opacity-50"
                >
                  Terapkan ke {preview.totalItemCount} Tindakan
                </Button>
              </DialogFooter>
            </div>
          );
        })()}
      </Dialog>

      {/* MODAL 6: Comments & Mentions Drawer (ACT-013) */}
      <Dialog open={showCommentModal} onOpenChange={setShowCommentModal}>
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-700" />
            <span>Diskusi &amp; Catatan Tim (ACT-013)</span>
          </DialogTitle>
          <DialogDescription>
            Tindakan: {activeCommentAction?.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          <div className="max-h-56 overflow-y-auto space-y-2 border p-3 rounded-lg bg-slate-50">
            {(!activeCommentAction?.comments || activeCommentAction.comments.length === 0) ? (
              <p className="text-slate-400 italic text-center py-4">Belum ada komentar pada tindakan ini.</p>
            ) : (
              activeCommentAction.comments.map((cmt: any) => (
                <div key={cmt.id} className="p-2 bg-white rounded border border-slate-200">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                    <span className="font-bold text-slate-800">{cmt.authorName}</span>
                    <span>{cmt.createdAt.substring(0, 16).replace("T", " ")}</span>
                  </div>
                  <p className="text-slate-700">{cmt.content}</p>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAddComment} className="space-y-2">
            <Label htmlFor="cmtInput">Tambah Catatan / Komentar</Label>
            <Input
              id="cmtInput"
              placeholder="Tulis update atau koordinasi..."
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
            />
            <Button type="submit" size="sm" className="bg-slate-900 text-white font-bold text-xs w-full">
              Kirim Komentar
            </Button>
          </form>
        </div>
      </Dialog>

      {/* MODAL 7: Lock Weekly Review Snapshot (ACT-015) */}
      <Dialog open={showSnapshotModal} onOpenChange={setShowSnapshotModal}>
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-purple-950 flex items-center gap-2">
            <Layers className="h-4 w-4 text-purple-700" />
            <span>Kunci Snapshot Review Mingguan (PRD ACT-015)</span>
          </DialogTitle>
          <DialogDescription>
            Mengunci metrik eksposur dan status tindakan saat review mingguan sebagai baseline yang tidak terdistorsi oleh perubahan di masa depan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleLockWeeklySnapshot} className="space-y-3 text-xs">
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 space-y-1 text-purple-900 text-[11px]">
            <div>Total Eksposur Terikat: <strong>{formatIDR(totalOpenExposure)}</strong></div>
            <div>Nilai Overdue: <strong>{formatIDR(overdueSummary.totalOverdueValue)}</strong></div>
            <div>Jumlah Tindakan: <strong>{allActions.filter((a) => a.status !== "resolved").length} terbuka</strong></div>
          </div>

          <div>
            <Label htmlFor="snapNotes">Catatan Ringkasan Review Mingguan</Label>
            <Textarea
              id="snapNotes"
              rows={3}
              placeholder="Contoh: Fokus minggu ini adalah percepatan opname fasade dan somasi klien termin 3"
              value={snapshotNotes}
              onChange={(e) => setSnapshotNotes(e.target.value)}
              className="mt-1"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowSnapshotModal(false)}>
              Batal
            </Button>
            <Button type="submit" className="bg-purple-800 hover:bg-purple-900 text-white font-bold">
              Kunci Snapshot Sekarang
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* MODAL 8: WhatsApp Deep Link Modal (ACT-010) */}
      {selectedActionForWa && (
        <WhatsAppDispatchModal
          open={Boolean(selectedActionForWa)}
          onOpenChange={(open) => !open && setSelectedActionForWa(null)}
          defaultPayload={selectedActionForWa}
        />
      )}
    </div>
  );
}
