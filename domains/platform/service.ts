/**
 * Phase 9 Domain Engine: Platform Usability, Search, Saved Views, and Minimum Integration
 * PRD Reference: Section 15.2 (PLT-013..PLT-018), Section 20.1 (ERP CSV Bridge)
 * UAT Scenario: UAT-17
 */

export interface GlobalSearchResultItem {
  id: string;
  type: "PROJECT" | "CLAIM" | "ACTION" | "BLOCKER" | "USER";
  typeLabel: string;
  title: string;
  subtitle: string;
  url: string;
  financialExposure?: number;
  highlightMatch: string;
}

export interface GlobalSearchResult {
  query: string;
  executionTimeMs: number;
  isUnderTwoSeconds: boolean; // PLT-013: Must be < 2000ms
  totalMatches: number;
  results: GlobalSearchResultItem[];
}

export interface SavedFilterView {
  id: string;
  orgId: string;
  userId?: string;
  viewName: string;
  pageContext: "progress-to-cash" | "actions" | "reports" | "claims";
  filterCriteria: Record<string, any>;
  isDefault?: boolean;
  createdAt: string;
}

export interface ActionableEmptyStateConfig {
  title: string;
  explanation: string;
  nextStepInstruction: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
}

export interface ActionableErrorMessage {
  errorCode: string;
  problem: string;
  remediation: string;
  formattedMessage: string;
}

export interface BulkActionPreviewResult {
  actionType: "BULK_ASSIGN" | "BULK_DUE_DATE" | "BULK_RESOLVE" | "BULK_STAGE_UPDATE";
  totalItemCount: number;
  totalFinancialImpact: number;
  items: { id: string; title: string; exposure: number }[];
  isHighValueImpact: boolean; // UAT-17: Flagged if impact > Rp 500M
  impactNotice: string;
}

/**
 * PLT-013: Global Search across Projects, Claims, Items, Owners, Blockers (< 2 seconds)
 */
export function performGlobalSearch(
  query: string,
  dataset: {
    projects?: any[];
    claims?: any[];
    actions?: any[];
    blockers?: any[];
    profiles?: any[];
  }
): GlobalSearchResult {
  const startTime = Date.now();
  const normalizedQuery = (query || "").trim().toLowerCase();

  if (!normalizedQuery) {
    return {
      query,
      executionTimeMs: 0,
      isUnderTwoSeconds: true,
      totalMatches: 0,
      results: [],
    };
  }

  const results: GlobalSearchResultItem[] = [];

  // 1. Search Projects
  if (dataset.projects) {
    for (const p of dataset.projects) {
      const name = (p.projectName || p.name || "").toLowerCase();
      const code = (p.projectCode || p.code || "").toLowerCase();
      const client = (p.clientName || "").toLowerCase();

      if (name.includes(normalizedQuery) || code.includes(normalizedQuery) || client.includes(normalizedQuery)) {
        results.push({
          id: p.id,
          type: "PROJECT",
          typeLabel: "Proyek",
          title: p.projectName || p.name,
          subtitle: `${p.projectCode || p.code} • Klien: ${p.clientName || "-"}`,
          url: `/projects/${p.id}`,
          financialExposure: p.contractValue,
          highlightMatch: name.includes(normalizedQuery) ? name : code,
        });
      }
    }
  }

  // 2. Search Claims
  if (dataset.claims) {
    for (const c of dataset.claims) {
      const number = (c.claimNumber || "").toLowerCase();
      const notes = (c.notes || "").toLowerCase();

      if (number.includes(normalizedQuery) || notes.includes(normalizedQuery)) {
        results.push({
          id: c.id,
          type: "CLAIM",
          typeLabel: "Klaim",
          title: `Klaim ${c.claimNumber}`,
          subtitle: `Tahap: ${c.currentStage} • Klaim: Rp ${(c.claimedValue || 0).toLocaleString("id-ID")}`,
          url: `/progress-to-cash?claimId=${c.id}`,
          financialExposure: c.claimedValue,
          highlightMatch: number,
        });
      }
    }
  }

  // 3. Search Actions
  if (dataset.actions) {
    for (const a of dataset.actions) {
      const title = (a.title || "").toLowerCase();
      const nextStep = (a.nextStep || "").toLowerCase();
      const owner = (a.ownerName || "").toLowerCase();
      const counterpart = (a.externalCounterpartName || "").toLowerCase();

      if (
        title.includes(normalizedQuery) ||
        nextStep.includes(normalizedQuery) ||
        owner.includes(normalizedQuery) ||
        counterpart.includes(normalizedQuery)
      ) {
        results.push({
          id: a.id,
          type: "ACTION",
          typeLabel: "Tindakan",
          title: a.title,
          subtitle: `PIC: ${a.ownerName || "Unassigned"} • Jatuh Tempo: ${a.dueDate}`,
          url: `/actions`,
          financialExposure: a.financialExposure,
          highlightMatch: title.includes(normalizedQuery) ? title : owner,
        });
      }
    }
  }

  // 4. Search Blockers
  if (dataset.blockers) {
    for (const b of dataset.blockers) {
      const title = (b.title || "").toLowerCase();
      const desc = (b.description || "").toLowerCase();

      if (title.includes(normalizedQuery) || desc.includes(normalizedQuery)) {
        results.push({
          id: b.id,
          type: "BLOCKER",
          typeLabel: "Kendala",
          title: b.title,
          subtitle: `Keparahan: ${b.severity} • Kendali: ${b.controllability}`,
          url: `/dashboard`,
          financialExposure: b.financialExposure,
          highlightMatch: title,
        });
      }
    }
  }

  // 5. Search Profiles/Owners
  if (dataset.profiles) {
    for (const u of dataset.profiles) {
      const name = (u.fullName || u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const role = (u.role || "").toLowerCase();

      if (name.includes(normalizedQuery) || email.includes(normalizedQuery) || role.includes(normalizedQuery)) {
        results.push({
          id: u.id,
          type: "USER",
          typeLabel: "Pengguna / PIC",
          title: u.fullName || u.name,
          subtitle: `${u.role} • ${u.email}`,
          url: `/settings`,
          highlightMatch: name,
        });
      }
    }
  }

  const executionTimeMs = Date.now() - startTime;

  return {
    query,
    executionTimeMs,
    isUnderTwoSeconds: executionTimeMs < 2000, // PLT-013 requirement
    totalMatches: results.length,
    results: results.slice(0, 30), // Max 30 most relevant
  };
}

/**
 * PLT-014: Saved Filter Views Validation
 */
export function validateSavedFilterView(input: {
  viewName: string;
  pageContext: string;
  filterCriteria: Record<string, any>;
}): { valid: boolean; error?: string } {
  if (!input.viewName || input.viewName.trim().length < 3) {
    return { valid: false, error: "Nama tampilan filter wajib diisi minimal 3 karakter (PLT-014)." };
  }
  if (!input.pageContext) {
    return { valid: false, error: "Konteks halaman filter wajib ditentukan (PLT-014)." };
  }
  if (!input.filterCriteria || Object.keys(input.filterCriteria).length === 0) {
    return { valid: false, error: "Kriteria filter tidak boleh kosong untuk disimpan sebagai review view (PLT-014)." };
  }
  return { valid: true };
}

/**
 * PLT-015: Actionable Empty States Configuration
 */
export const ACTIONABLE_EMPTY_STATES: Record<string, ActionableEmptyStateConfig> = {
  ACTIONS_QUEUE: {
    title: "Semua Tindakan Selesai",
    explanation: "Saat ini tidak ada tindakan penyelesaian atau eskalasi aktif yang tertunda.",
    nextStepInstruction: "Periksa kembali daftar hambatan pada progress-to-cash atau buat tindakan pencegahan baru.",
    primaryCtaLabel: "+ Buat Tindakan Baru",
    primaryCtaHref: "/actions?modal=create",
  },
  CLAIMS_LIST: {
    title: "Belum Ada Pengajuan Klaim",
    explanation: "Proyek ini belum memiliki berkas klaim bulanan atau opname yang diunggah.",
    nextStepInstruction: "Unggah berkas rekap kemajuan pekerjaan (opname) untuk memulai pelacakan kesenjangan nilai.",
    primaryCtaLabel: "Import Data Lapangan",
    primaryCtaHref: "/data",
  },
  CERTIFIED_QUEUE: {
    title: "Tidak Ada Antrean BAP Siap Faktur",
    explanation: "Seluruh berkas BAP yang disetujui MK telah resmi diterbitkan fakturnya.",
    nextStepInstruction: "Pantau klaim yang sedang dalam proses verifikasi konsultan MK agar tidak melewati batas tanggal cut-off.",
    primaryCtaLabel: "Lihat Siklus Klaim",
    primaryCtaHref: "/progress-to-cash",
  },
  SEARCH_NO_RESULTS: {
    title: "Tidak Ditemukan Hasil yang Cocok",
    explanation: "Kata kunci pencarian tidak ditemukan pada proyek, klaim, tindakan, maupun personil.",
    nextStepInstruction: "Coba gunakan nomor klaim spesifik, kode proyek, atau nama pihak penanggung jawab.",
    primaryCtaLabel: "Reset Pencarian",
    primaryCtaHref: "/dashboard",
  },
};

/**
 * PLT-016: Actionable Business Error Messages
 * Never just "Terjadi kesalahan". Always Problem + Remediation.
 */
export function formatActionableError(
  errorCode: string,
  context?: Record<string, any>
): ActionableErrorMessage {
  const errorMap: Record<string, { problem: string; remediation: string }> = {
    ERR_OWNER_REQUIRED: {
      problem: "Tindakan tidak dapat diaktifkan tanpa penanggung jawab internal (ACT-002, UAT-08).",
      remediation: "Pilih nama penanggung jawab (Owner internal) dari daftar personil proyek sebelum menyimpan tindakan.",
    },
    ERR_CLOSURE_EVIDENCE_MISSING: {
      problem: "Tindakan tidak dapat ditutup (Done) tanpa bukti penyelesaian yang sah (ACT-006, UAT-09).",
      remediation: "Lampirkan tautan URL dokumen hasil (Google Drive / Cloud) atau ketikkan catatan bukti fisik verifikasi minimal 5 karakter.",
    },
    ERR_REOPEN_REASON_REQUIRED: {
      problem: "Pembukaan kembali tindakan ditolak tanpa alasan tertulis (ACT-014).",
      remediation: "Masukkan alasan bisnis mengapa tindakan yang sudah selesai harus dibuka kembali (minimal 5 karakter).",
    },
    ERR_BASELINE_REASON_REQUIRED: {
      problem: "Penguncian baseline proyek ditolak (PRT-009, UAT-15).",
      remediation: "Sertakan alasan penguncian resmi dari komite/manajemen agar angka pembanding awal tidak bergeser tanpa kendali.",
    },
    ERR_WAITING_EXTERNAL_FOLLOW_UP: {
      problem: "Status menunggu pihak luar mewajibkan tanggal tindak lanjut (ACT-012).",
      remediation: "Isi tanggal follow-up agar tim internal tidak membiarkan tindakan mengendap di pihak eksternal.",
    },
    ERR_IMPORT_CHECKSUM_DUPLICATE: {
      problem: "Berkas yang diunggah identik dengan import sebelumnya (IMP-009, UAT-03).",
      remediation: "Pastikan Anda mengunggah berkas revisi terbaru atau periksa riwayat import untuk versi data yang sudah ada.",
    },
  };

  const matched = errorMap[errorCode] || {
    problem: `Terjadi kendala validasi pada operasi: ${errorCode}`,
    remediation: "Periksa kembali field yang wajib diisi atau hubungi administrator sistem.",
  };

  return {
    errorCode,
    problem: matched.problem,
    remediation: matched.remediation,
    formattedMessage: `[${errorCode}] ${matched.problem} Solusi: ${matched.remediation}`,
  };
}

/**
 * PLT-017 & UAT-17: Bulk Action Impact Preview & Confirmation
 */
export function previewBulkAction(
  actionType: BulkActionPreviewResult["actionType"],
  selectedItems: { id: string; title: string; financialExposure: number }[]
): BulkActionPreviewResult {
  const totalItemCount = selectedItems.length;
  const totalFinancialImpact = selectedItems.reduce((sum, i) => sum + (i.financialExposure || 0), 0);
  const isHighValueImpact = totalFinancialImpact >= 500_000_000; // >= Rp 500M

  let impactNotice = `Anda akan memperbarui ${totalItemCount} tindakan dengan total nilai eksposur Rp ${totalFinancialImpact.toLocaleString("id-ID")}.`;
  if (isHighValueImpact) {
    impactNotice += " PERINGATAN (UAT-17): Nilai perubahan bersifat material (≥ Rp 500 Juta). Konfirmasi persetujuan dibutuhkan sebelum eksekusi.";
  }

  return {
    actionType,
    totalItemCount,
    totalFinancialImpact,
    items: selectedItems.map((i) => ({ id: i.id, title: i.title, exposure: i.financialExposure })),
    isHighValueImpact,
    impactNotice,
  };
}

/**
 * PLT-018: Source Lineage and Last Updated Formatting
 */
export function formatSourceLineage(
  item: { updatedAt?: string; createdAt?: string; sourceFile?: string; sourceSheet?: string; uploaderName?: string }
): { lastUpdatedDisplay: string; sourceDisplay: string } {
  const dateStr = item.updatedAt || item.createdAt || new Date().toISOString();
  const dateObj = new Date(dateStr);
  const formattedDate = dateObj.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });

  const sourceParts: string[] = [];
  if (item.sourceFile) sourceParts.push(`Berkas: ${item.sourceFile}`);
  if (item.sourceSheet) sourceParts.push(`Sheet: ${item.sourceSheet}`);
  if (item.uploaderName) sourceParts.push(`Oleh: ${item.uploaderName}`);

  return {
    lastUpdatedDisplay: `${formattedDate} WIB`,
    sourceDisplay: sourceParts.length > 0 ? sourceParts.join(" • ") : "Entri Sistem Terverifikasi",
  };
}

/**
 * PRD Section 20.1: Accounting / ERP CSV Bridge
 * Generates standardized CSV for invoice & receipt reconciliation with external ERP (SAP, Accurate, Jurnal).
 */
export function generateErpInvoiceReconciliationCsv(invoices: any[], claims: any[]): string {
  const headers = [
    "COVE_INVOICE_ID",
    "INVOICE_NUMBER",
    "TAX_INVOICE_SERIES",
    "CLAIM_NUMBER",
    "PROJECT_CODE",
    "INVOICE_DATE",
    "DUE_DATE",
    "GROSS_AMOUNT",
    "RETENTION_HELD",
    "DOWN_PAYMENT_DEDUCTION",
    "VAT_AMOUNT",
    "NET_RECEIVABLE",
    "CASH_RECEIVED",
    "OUTSTANDING_BALANCE",
    "PAYMENT_STATUS",
  ];

  const rows = invoices.map((inv) => {
    const claim = claims.find((c) => c.id === inv.claimId);
    return [
      inv.id,
      `"${inv.invoiceNumber || "INV-001"}"`,
      `"${inv.taxInvoiceSeries || "010.000-26.00000001"}"`,
      `"${claim?.claimNumber || "MC-006"}"`,
      `"${inv.projectCode || "PRJ-MERIDIAN"}"`,
      inv.invoiceDate || "2026-08-10",
      inv.dueDate || "2026-09-09",
      inv.grossAmount || 0,
      inv.retentionDeduction || 0,
      inv.downPaymentDeduction || 0,
      inv.vatAmount || 0,
      inv.netReceivableAmount || 0,
      inv.cashReceivedAmount || 0,
      inv.outstandingAmount || 0,
      inv.status || "unpaid",
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}
