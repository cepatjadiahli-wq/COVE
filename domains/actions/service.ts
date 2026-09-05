/**
 * Phase 7 Domain Engine: Action & Escalation Queue
 * PRD Modul 4 (ACT-001 through ACT-015)
 * UAT Scenarios: UAT-08, UAT-09
 */

import { ActionPriority, OutcomeType, ACTION_PRIORITIES, ACTION_STATUSES, ActionStatus } from "@/lib/constants";

export interface ActionComment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  mentions?: string[]; // ACT-013
}

export interface ActionClosureRecord {
  resolvedAt: string;
  resolvedByUserId: string;
  resolvedByName: string;
  resolutionText: string;
  closureEvidenceUrl?: string;
  closureEvidenceNote?: string;
  outcomeType: OutcomeType;
  outcomeValue: number;
}

export interface ActionItem {
  id: string;
  orgId: string;
  projectId: string;
  entityType: string;
  entityId?: string; // ACT-001: Minimum 1 exposure/item/claim
  riskType: string;
  financialExposure: number; // ACT-001
  title: string;
  description: string;
  nextStep: string; // ACT-004
  ownerId: string; // ACT-002, UAT-08: Mandatory before active
  ownerName: string;
  priority: ActionPriority;
  status: ActionStatus; // ACT-005
  dueDate: string; // ACT-004
  followUpDate?: string; // ACT-012: Mandatory when waiting_external
  externalCounterpartName?: string; // ACT-003: Without account
  externalCounterpartOrg?: string; // ACT-003
  externalCounterpartPhone?: string; // ACT-010: WhatsApp
  outcomeType?: OutcomeType;
  outcomeValue?: number;
  resolutionNotes?: string;
  closureEvidenceUrl?: string; // ACT-006, UAT-09
  closureEvidenceNote?: string; // ACT-006, UAT-09
  resolvedAt?: string;
  closureHistory?: ActionClosureRecord[]; // ACT-014
  comments?: ActionComment[]; // ACT-013
  escalationLevel?: "STANDARD" | "WARNING_H3" | "DUE_TODAY" | "OVERDUE_H3" | "CRITICAL_ESCALATED"; // ACT-011
  escalatedToRole?: string; // ACT-011
  createdAt: string;
  updatedAt: string;
}

export interface CreateActionInput {
  projectId: string;
  entityType?: string;
  entityId?: string;
  riskType?: string;
  financialExposure: number;
  title: string;
  description?: string;
  nextStep: string;
  ownerId: string;
  ownerName?: string;
  priority?: ActionPriority;
  dueDate: string;
  externalCounterpartName?: string;
  externalCounterpartOrg?: string;
  externalCounterpartPhone?: string;
}

export interface ResolveActionInput {
  actionId: string;
  resolutionText: string;
  closureEvidenceUrl?: string;
  closureEvidenceNote?: string;
  outcomeType: OutcomeType;
  outcomeValue?: number;
  resolvedByUserId: string;
  resolvedByName?: string;
}

export interface ResolveActionResult {
  success: boolean;
  resolvedAt: string;
  outcomeType: OutcomeType;
  outcomeValue: number;
  error?: string;
}

export interface OverdueActionsSummary {
  totalOverdueCount: number;
  totalOverdueValue: number; // ACT-007: Aggregated by Rupiah value
  criticalOverdueValue: number;
  actions: ActionItem[];
}

/**
 * ACT-001, ACT-002, ACT-004, UAT-08:
 * Validates action creation. Rejects activation if ownerId or dueDate is missing.
 */
export function validateActionCreation(input: CreateActionInput): { valid: boolean; error?: string } {
  // ACT-001: Must be linked to at least 1 exposure/item/claim
  if (!input.financialExposure || input.financialExposure < 0) {
    return { valid: false, error: "Action harus memiliki nilai financial exposure yang terikat (ACT-001)." };
  }
  if (!input.projectId) {
    return { valid: false, error: "Action harus terikat minimal pada satu proyek/klaim (ACT-001)." };
  }

  // ACT-002 & UAT-08: Mandatory internal owner before active
  if (!input.ownerId || input.ownerId.trim() === "") {
    return { valid: false, error: "Action wajib memiliki penanggung jawab internal (Owner) sebelum aktif (ACT-002, UAT-08)." };
  }

  // ACT-004: Mandatory next step and due date before publish
  if (!input.nextStep || input.nextStep.trim() === "") {
    return { valid: false, error: "Action wajib memiliki langkah penuntasan berikutnya (Next Step) (ACT-004)." };
  }
  if (!input.dueDate || input.dueDate.trim() === "") {
    return { valid: false, error: "Action wajib memiliki batas waktu penyelesaian (Due Date) (ACT-004, UAT-08)." };
  }

  return { valid: true };
}

/**
 * ACT-006 & UAT-09:
 * Resolving an action requires closure reason AND closure evidence/note.
 * Rejects resolution if evidence/note is missing.
 */
export function validateActionResolution(input: any): ResolveActionResult {
  const resolutionText = input.resolutionText || input.resolution || "";
  if (!resolutionText || resolutionText.trim().length < 5) {
    return {
      success: false,
      resolvedAt: new Date().toISOString(),
      outcomeType: input.outcomeType || "unknown",
      outcomeValue: 0,
      error: "Alasan penutupan (Closure Reason) wajib diisi minimal 5 karakter untuk menyelesaikan tindakan (ACT-006).",
    };
  }

  const outcomeType = input.outcomeType || "cash_released";

  // UAT-09: Must have closure evidence URL or non-empty closure note
  const hasEvidenceUrl = Boolean(input.closureEvidenceUrl && input.closureEvidenceUrl.trim().length > 0);
  const hasEvidenceNote = Boolean(input.closureEvidenceNote && input.closureEvidenceNote.trim().length >= 5);

  if (!hasEvidenceUrl && !hasEvidenceNote) {
    return {
      success: false,
      resolvedAt: new Date().toISOString(),
      outcomeType: input.outcomeType,
      outcomeValue: 0,
      error: "Penutupan tindakan ditolak: Bukti penutupan (tautan berkas atau catatan bukti minimal 5 karakter) wajib dilampirkan (ACT-006, UAT-09).",
    };
  }

  return {
    success: true,
    resolvedAt: new Date().toISOString(),
    outcomeType: input.outcomeType,
    outcomeValue: Math.max(0, input.outcomeValue || 0),
  };
}

/**
 * ACT-007: Overdue Actions by Rupiah Value
 * Aggregates overdue actions based on material financial value, not just quantity.
 */
export function aggregateOverdueActions(
  actions: ActionItem[],
  referenceDateStr: string = new Date().toISOString().substring(0, 10)
): OverdueActionsSummary {
  const overdueActions = actions.filter((a) => {
    if (a.status === "resolved" || a.status === "cancelled") return false;
    return a.dueDate < referenceDateStr;
  });

  // Sort descending by financial exposure (ACT-007)
  overdueActions.sort((a, b) => (b.financialExposure || 0) - (a.financialExposure || 0));

  const totalOverdueCount = overdueActions.length;
  const totalOverdueValue = overdueActions.reduce((acc, a) => acc + (a.financialExposure || 0), 0);
  const criticalOverdueValue = overdueActions
    .filter((a) => a.priority === "critical")
    .reduce((acc, a) => acc + (a.financialExposure || 0), 0);

  return {
    totalOverdueCount,
    totalOverdueValue,
    criticalOverdueValue,
    actions: overdueActions,
  };
}

/**
 * ACT-010: WhatsApp Deep Link Generation
 * Creates an editable wa.me URL. Never sends automated bot messages.
 */
export function generateWhatsAppDeepLink(
  phoneNumber: string,
  action: {
    title: string;
    financialExposure: number;
    dueDate: string;
    nextStep?: string;
    projectCode?: string;
  },
  senderName: string
): string {
  // Normalize phone number (Indonesian format 08xx -> 628xx)
  let cleanPhone = phoneNumber.replace(/[^0-9]/g, "");
  if (cleanPhone.startsWith("0")) {
    cleanPhone = "62" + cleanPhone.substring(1);
  }

  const text =
    `*PEMBERITAHUAN TINDAKAN PROYEK COVE*\n\n` +
    `Halo Rekan,\n` +
    `Terdapat tindakan yang memerlukan koordinasi bersama:\n\n` +
    `📌 *Tindakan:* ${action.title}\n` +
    `💰 *Eksposur Finansial:* Rp ${action.financialExposure.toLocaleString("id-ID")}\n` +
    `📅 *Target Batas Waktu:* ${action.dueDate}\n` +
    (action.nextStep ? `⚡ *Langkah Berikutnya:* ${action.nextStep}\n` : "") +
    `\nMohon konfirmasi status progres penyelesaian. Terima kasih.\n\n` +
    `_Pengirim: ${senderName} (COVE Construction Operations Value Engine)_`;

  const encoded = encodeURIComponent(text);
  return `https://wa.me/${cleanPhone}?text=${encoded}`;
}

/**
 * ACT-011: Escalation Matrix Evaluation
 * Evaluates actions against SLA due dates:
 * - H-3: WARNING_H3 -> PIC & Commercial Manager
 * - Due Today: DUE_TODAY -> Commercial Manager
 * - Overdue H+3: OVERDUE_H3 -> Project Director / Commercial Director
 * - Critical: CRITICAL_ESCALATED -> Director / Owner
 */
export function evaluateActionEscalation(
  action: ActionItem,
  referenceDateStr: string = new Date().toISOString().substring(0, 10)
): { escalationLevel: ActionItem["escalationLevel"]; escalatedToRole: string; isEscalated: boolean } {
  if (action.status === "resolved" || action.status === "cancelled") {
    return { escalationLevel: "STANDARD", escalatedToRole: "PIC", isEscalated: false };
  }

  const ref = new Date(referenceDateStr).getTime();
  const due = new Date(action.dueDate).getTime();
  const diffDays = Math.ceil((due - ref) / 86400000);

  if (diffDays < -3 || (diffDays < 0 && action.priority === "critical")) {
    return {
      escalationLevel: "CRITICAL_ESCALATED",
      escalatedToRole: "OWNER",
      isEscalated: true,
    };
  } else if (diffDays < 0) {
    return {
      escalationLevel: "OVERDUE_H3",
      escalatedToRole: "COMMERCIAL_MANAGER",
      isEscalated: true,
    };
  } else if (diffDays === 0) {
    return {
      escalationLevel: "DUE_TODAY",
      escalatedToRole: "COMMERCIAL_MANAGER",
      isEscalated: true,
    };
  } else if (diffDays <= 3) {
    return {
      escalationLevel: "WARNING_H3",
      escalatedToRole: "PROJECT_MANAGER",
      isEscalated: false,
    };
  }

  return {
    escalationLevel: "STANDARD",
    escalatedToRole: "PIC",
    isEscalated: false,
  };
}

/**
 * ACT-012: Waiting External Follow-Up Validation
 * When an action is placed in 'waiting_external', a follow-up date is strictly required.
 */
export function validateWaitingExternalState(
  status: ActionStatus,
  followUpDate?: string
): { valid: boolean; error?: string } {
  if (status === "waiting_external") {
    if (!followUpDate || followUpDate.trim() === "") {
      return {
        valid: false,
        error: "Status Menunggu Pihak Luar (Waiting External) wajib menyertakan tanggal follow-up agar tindakan tidak terlupakan (ACT-012).",
      };
    }
  }
  return { valid: true };
}

/**
 * ACT-014: Reopen Resolved Action
 * Reopening an action retains previous closure history and requires mandatory reopen reason.
 */
export function validateActionReopen(reopenReason: string): { valid: boolean; error?: string } {
  if (!reopenReason || reopenReason.trim().length < 5) {
    return {
      valid: false,
      error: "Membuka kembali tindakan yang telah selesai wajib menyertakan alasan buka kembali (Reopen Reason) minimal 5 karakter (ACT-014).",
    };
  }
  return { valid: true };
}
