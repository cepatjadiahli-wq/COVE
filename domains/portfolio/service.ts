/**
 * Phase 8 Domain Engine: Portfolio Cash Review & ROI Ledger
 * PRD Modul 5 (PRT-001 through PRT-013)
 * UAT Scenarios: UAT-14, UAT-15, UAT-16
 */

export interface PortfolioStageSummary {
  totalWorkPerformed: number;
  totalMeasured: number;
  totalClaimed: number;
  totalCertified: number;
  totalInvoiced: number;
  totalCollected: number;
  // 5 Sequential Non-Overlapping Gaps (G1..G5)
  g1Unmeasured: number;
  g2Unclaimed: number;
  g3Uncertified: number;
  g4CertifiedNotInvoiced: number;
  g5InvoicedNotCollected: number;
  totalPreInvoiceExposure: number; // G1 + G2 + G3 + G4
  controllablePreInvoiceExposure: number; // Internal + Joint gaps
  externalExposure: number; // External delays
  claimsCount: number;
}

export interface ProjectRankingItem {
  projectId: string;
  projectName: string;
  projectCode: string;
  contractValue: number;
  controllableExposure: number;
  overdueExposure: number;
  blockerSeverityScore: number;
  rankingScore: number;
  rank: number;
  rankingFormula: string;
}

export interface TopBlockerItem {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  financialExposure: number;
  severity: "low" | "medium" | "high" | "critical";
  controllability: "internal" | "joint" | "external" | "not_software_addressable";
  daysOpen: number;
  relatedActionId?: string;
  relatedActionTitle?: string;
}

export interface HandoffQueueItem {
  claimId: string;
  claimNumber: string;
  projectId: string;
  projectName: string;
  clientName: string;
  certifiedValue: number;
  certifiedDate: string;
  daysPendingInvoice: number;
  status: "READY_TO_INVOICE" | "OVERDUE_INVOICE";
}

export interface ProjectFreshnessItem {
  projectId: string;
  projectName: string;
  projectCode: string;
  lastUpdatedDate: string;
  daysSinceUpdate: number;
  freshnessStatus: "CURRENT" | "NEEDS_ATTENTION" | "STALE"; // PRD 11.3, PRT-006, UAT-14
  sourceReference: string;
}

export interface RoiLedgerEntry {
  category: "FOUND" | "CONTROLLABLE" | "RESOLVED_LEVEL_A" | "RESOLVED_LEVEL_B" | "INVOICED" | "COLLECTED";
  title: string;
  amount: number;
  definition: string;
  attributionLevel: "Level A (Action-linked)" | "Level B (Observed)" | "Financial Execution";
  sourceReference: string;
}

export interface StageMedianDuration {
  stage: string;
  stageName: string;
  sampleSize: number;
  medianDurationDays: number | null;
  hasSufficientData: boolean; // PRT-008: True if sampleSize >= 3
}

export interface ProjectBaseline {
  id: string;
  projectId: string;
  baselineDate: string;
  baselineExposure: number;
  baselineCycleDays: number;
  lockedByName: string;
  lockReason: string;
  createdAt: string;
}

export interface FinancingBenefitResult {
  acceleratedValue: number;
  customerCostOfCapitalAnnualRate: number; // default 11% (0.11)
  daysAccelerated: number;
  financingInterestSaved: number;
  formula: string;
  assumptionDisclaimer: string; // PRT-010
}

export interface PilotComparisonItem {
  metricName: string;
  baselineValue: string | number;
  currentPilotValue: string | number;
  deltaDisplay: string;
  isImprovement: boolean;
  attributionNote: string; // PRT-013
}

/**
 * PRT-001: Portfolio Stage Summary with Sequential Gaps (G1..G5)
 */
export function calculatePortfolioStageSummary(claims: any[], invoices: any[]): PortfolioStageSummary {
  let totalWorkPerformed = 0;
  let totalMeasured = 0;
  let totalClaimed = 0;
  let totalCertified = 0;
  let totalInvoiced = 0;
  let totalCollected = 0;

  let g1Unmeasured = 0;
  let g2Unclaimed = 0;
  let g3Uncertified = 0;
  let g4CertifiedNotInvoiced = 0;
  let controllablePreInvoice = 0;
  let externalExposure = 0;

  for (const c of claims) {
    const work = c.workPerformedValue || 0;
    const measured = c.measuredValue !== undefined ? c.measuredValue : work;
    const claimed = c.claimedValue || 0;
    const certified = c.certifiedValue !== undefined ? c.certifiedValue : claimed;

    totalWorkPerformed += work;
    totalMeasured += measured;
    totalClaimed += claimed;
    totalCertified += certified;

    const g1 = Math.max(0, work - measured);
    const g2 = Math.max(0, measured - claimed);
    const g3 = Math.max(0, claimed - certified);

    g1Unmeasured += g1;
    g2Unclaimed += g2;
    g3Uncertified += g3;

    // PRT-002: Controllable vs External classification
    const preInv = g1 + g2 + g3;
    if (c.controllability === "EXTERNAL") {
      externalExposure += preInv;
    } else {
      controllablePreInvoice += preInv;
    }
  }

  // Invoice calculations
  for (const inv of invoices) {
    const gross = inv.grossAmount || 0;
    const cash = inv.cashReceivedAmount || 0;
    totalInvoiced += gross;
    totalCollected += cash;
  }

  g4CertifiedNotInvoiced = Math.max(0, totalCertified - totalInvoiced);
  const g5InvoicedNotCollected = Math.max(0, totalInvoiced - totalCollected);

  // Add certified-not-invoiced to controllable
  controllablePreInvoice += g4CertifiedNotInvoiced;

  const totalPreInvoiceExposure = g1Unmeasured + g2Unclaimed + g3Uncertified + g4CertifiedNotInvoiced;

  return {
    totalWorkPerformed,
    totalMeasured,
    totalClaimed,
    totalCertified,
    totalInvoiced,
    totalCollected,
    g1Unmeasured,
    g2Unclaimed,
    g3Uncertified,
    g4CertifiedNotInvoiced,
    g5InvoicedNotCollected,
    totalPreInvoiceExposure,
    controllablePreInvoiceExposure: controllablePreInvoice,
    externalExposure,
    claimsCount: claims.length,
  };
}

/**
 * PRT-003: Ranking Proyek Berdasarkan Exposure Material
 * Formula: (Controllable Exposure * 0.5) + (Overdue Exposure * 0.3) + (Blocker Severity * 0.2)
 */
export function calculateProjectRankings(
  projects: any[],
  claims: any[],
  actions: any[],
  blockers: any[],
  referenceDateStr: string = new Date().toISOString().substring(0, 10)
): ProjectRankingItem[] {
  const rankings: ProjectRankingItem[] = projects.map((prj) => {
    const prjClaims = claims.filter((c) => c.projectId === prj.id);
    const prjActions = actions.filter((a) => a.projectId === prj.id);
    const prjBlockers = blockers.filter((b) => b.projectId === prj.id);

    // Controllable exposure
    const controllableExp = prjClaims.reduce((sum, c) => {
      const g1 = Math.max(0, (c.workPerformedValue || 0) - (c.measuredValue || c.workPerformedValue || 0));
      const g2 = Math.max(0, (c.measuredValue || 0) - (c.claimedValue || 0));
      const g3 = Math.max(0, (c.claimedValue || 0) - (c.certifiedValue || c.claimedValue || 0));
      return sum + (c.controllability !== "EXTERNAL" ? g1 + g2 + g3 : 0);
    }, 0);

    // Overdue exposure
    const overdueExp = prjActions
      .filter((a) => a.status !== "resolved" && a.dueDate < referenceDateStr)
      .reduce((sum, a) => sum + (a.financialExposure || 0), 0);

    // Blocker severity score
    const severityMap: Record<string, number> = { critical: 100, high: 60, medium: 30, low: 10 };
    const blockerScore = prjBlockers.reduce((sum, b) => sum + (severityMap[b.severity] || 0), 0);

    // Score: normalized in Millions for score readability
    const rankingScore = Math.round(
      (controllableExp / 1_000_000) * 0.5 +
      (overdueExp / 1_000_000) * 0.3 +
      blockerScore * 0.2
    );

    return {
      projectId: prj.id,
      projectName: prj.projectName || prj.name,
      projectCode: prj.projectCode || prj.code,
      contractValue: prj.contractValue || 0,
      controllableExposure: controllableExp,
      overdueExposure: overdueExp,
      blockerSeverityScore: blockerScore,
      rankingScore,
      rank: 0,
      rankingFormula: "Score = (Controllable Exposure * 0.5) + (Overdue Exposure * 0.3) + (Blocker Severity * 0.2)",
    };
  });

  // Sort descending by score
  rankings.sort((a, b) => b.rankingScore - a.rankingScore);

  // Assign ranks
  rankings.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  return rankings;
}

/**
 * PRT-004: Top Blockers by Value & Age
 */
export function getTopBlockers(
  blockers: any[],
  actions: any[],
  referenceDateStr: string = new Date().toISOString().substring(0, 10),
  limit: number = 5
): TopBlockerItem[] {
  const refTime = new Date(referenceDateStr).getTime();

  const formatted: TopBlockerItem[] = blockers
    .filter((b) => b.status !== "resolved")
    .map((b) => {
      const raisedTime = new Date(b.raisedDate || b.createdAt || referenceDateStr).getTime();
      const daysOpen = Math.max(0, Math.ceil((refTime - raisedTime) / 86400000));
      const relatedAction = actions.find((a) => a.entityId === b.entityId || a.id === b.actionId);

      return {
        id: b.id,
        projectId: b.projectId,
        projectName: b.projectName || "Proyek",
        title: b.title,
        financialExposure: b.financialExposure || 0,
        severity: b.severity || "medium",
        controllability: b.controllability || "joint",
        daysOpen,
        relatedActionId: relatedAction?.id,
        relatedActionTitle: relatedAction?.title,
      };
    });

  // Sort by exposure (descending), then daysOpen (descending)
  formatted.sort((a, b) => {
    if (b.financialExposure !== a.financialExposure) {
      return b.financialExposure - a.financialExposure;
    }
    return b.daysOpen - a.daysOpen;
  });

  return formatted.slice(0, limit);
}

/**
 * PRT-005: Certified-Not-Invoiced Handoff Queue (Finance Queue)
 */
export function getCertifiedNotInvoicedQueue(claims: any[], projects: any[]): HandoffQueueItem[] {
  const queue: HandoffQueueItem[] = [];
  const today = new Date();

  for (const c of claims) {
    // Certified claims that haven't been invoiced
    if (c.currentStage === "CERTIFIED" || (c.certifiedValue > 0 && !c.invoiceId)) {
      const prj = projects.find((p) => p.id === c.projectId);
      const certDate = c.certifiedAt || c.periodEnd || "2026-08-15";
      const diffDays = Math.max(0, Math.ceil((today.getTime() - new Date(certDate).getTime()) / 86400000));

      queue.push({
        claimId: c.id,
        claimNumber: c.claimNumber || "MC-006",
        projectId: c.projectId,
        projectName: prj?.projectName || prj?.name || "Menara Meridian",
        clientName: prj?.clientName || "PT Pakuwon Sentosa",
        certifiedValue: c.certifiedValue || c.claimedValue || 0,
        certifiedDate: certDate.substring(0, 10),
        daysPendingInvoice: diffDays,
        status: diffDays > 7 ? "OVERDUE_INVOICE" : "READY_TO_INVOICE",
      });
    }
  }

  // Sort descending by days pending
  queue.sort((a, b) => b.daysPendingInvoice - a.daysPendingInvoice);

  return queue;
}

/**
 * PRT-006 & UAT-14: Project Data Freshness Evaluation
 * Boundaries:
 * - <= 7 days: CURRENT
 * - 8 - 14 days: NEEDS_ATTENTION
 * - > 14 days: STALE (UAT-14: Stale projects cannot masquerade as current)
 */
export function evaluateProjectsFreshness(
  projects: any[],
  claims: any[],
  referenceDateStr: string = new Date().toISOString().substring(0, 10)
): ProjectFreshnessItem[] {
  const refTime = new Date(referenceDateStr).getTime();

  return projects.map((prj) => {
    const prjClaims = claims.filter((c) => c.projectId === prj.id);
    // Find latest claim updated date or project updated date
    let latestDate = prj.updatedAt || prj.createdAt || "2026-07-01";
    for (const c of prjClaims) {
      const claimDate = c.updatedAt || c.periodEnd || c.createdAt;
      if (claimDate && new Date(claimDate).getTime() > new Date(latestDate).getTime()) {
        latestDate = claimDate;
      }
    }

    const diffDays = Math.max(0, Math.ceil((refTime - new Date(latestDate).getTime()) / 86400000));

    let freshnessStatus: ProjectFreshnessItem["freshnessStatus"] = "CURRENT";
    if (diffDays > 14) {
      freshnessStatus = "STALE"; // UAT-14
    } else if (diffDays >= 8) {
      freshnessStatus = "NEEDS_ATTENTION";
    }

    return {
      projectId: prj.id,
      projectName: prj.projectName || prj.name,
      projectCode: prj.projectCode || prj.code,
      lastUpdatedDate: latestDate.substring(0, 10),
      daysSinceUpdate: diffDays,
      freshnessStatus,
      sourceReference: `Audit batch import / claim event (${latestDate.substring(0, 10)})`,
    };
  });
}

/**
 * PRT-007 & UAT-16: 5-Column Comparative ROI Ledger
 * Strictly separates:
 * 1. Found: Identified gaps
 * 2. Controllable: Gaps within contractor execution
 * 3. Resolved Level A: Action-linked verified closures
 * 4. Invoiced: Commercial invoices issued
 * 5. Collected: Real bank cash receipts
 */
export function generateRoiLedger(
  claims: any[],
  actions: any[],
  invoices: any[],
  cashReceipts: any[]
): RoiLedgerEntry[] {
  // 1. Found Exposure (Total G1..G5 discovered)
  let foundAmount = 0;
  let controllableAmount = 0;

  for (const c of claims) {
    const work = c.workPerformedValue || 0;
    const measured = c.measuredValue !== undefined ? c.measuredValue : work;
    const claimed = c.claimedValue || 0;
    const certified = c.certifiedValue !== undefined ? c.certifiedValue : claimed;

    const g1 = Math.max(0, work - measured);
    const g2 = Math.max(0, measured - claimed);
    const g3 = Math.max(0, claimed - certified);

    const gapSum = g1 + g2 + g3;
    foundAmount += gapSum;
    if (c.controllability !== "EXTERNAL") {
      controllableAmount += gapSum;
    }
  }

  // 2. Resolved Level A (Action-linked verified closures) (UAT-16)
  const resolvedActions = actions.filter((a) => a.status === "resolved");
  const resolvedLevelAAmount = resolvedActions.reduce(
    (sum, a) => sum + (a.outcomeValue || a.financialExposure || 0),
    0
  );

  // Resolved Level B (Observed claim movements without explicit actions)
  const resolvedLevelBAmount = Math.max(0, controllableAmount - resolvedLevelAAmount);

  // 3. Invoiced
  const invoicedAmount = invoices.reduce((sum, inv) => sum + (inv.grossAmount || 0), 0);

  // 4. Collected Cash
  const collectedAmount = cashReceipts.reduce((sum, cr) => sum + (cr.amount || 0), 0);

  return [
    {
      category: "FOUND",
      title: "1. Found Exposure (Eksposur Teridentifikasi)",
      amount: foundAmount,
      definition: "Total akumulasi kebocoran nilai (G1 s/d G4) yang terdeteksi oleh COVE dari data lapangan.",
      attributionLevel: "Level B (Observed)",
      sourceReference: "Value Gap Ledger (claims)",
    },
    {
      category: "CONTROLLABLE",
      title: "2. Controllable Exposure (Dalam Kendali Internal)",
      amount: controllableAmount,
      definition: "Bagian dari eksposur yang berada dalam kendali operasional tim kontraktor (Internal & Joint).",
      attributionLevel: "Level B (Observed)",
      sourceReference: "Controllability Matrix (PRD Section 11)",
    },
    {
      category: "RESOLVED_LEVEL_A",
      title: "3. Resolved Level A (Tuntas Terkait Tindakan)",
      amount: resolvedLevelAAmount,
      definition: "Eksposur yang berhasil dipulihkan secara langsung melalui penuntasan tindakan dengan bukti sah.",
      attributionLevel: "Level A (Action-linked)",
      sourceReference: "Actions Queue (closureEvidence)",
    },
    {
      category: "INVOICED",
      title: "4. Invoiced (Faktur Resmi Diterbitkan)",
      amount: invoicedAmount,
      definition: "Nilai sertifikasi (BAP) yang telah resmi dikonversi menjadi dokumen penagihan faktur komersial.",
      attributionLevel: "Financial Execution",
      sourceReference: "Tax/Commercial Invoices",
    },
    {
      category: "COLLECTED",
      title: "5. Collected Cash (Kas Masuk Rekening Bank)",
      amount: collectedAmount,
      definition: "Pencairan kas nyata yang telah terverifikasi masuk ke rekening koran perusahaan kontraktor.",
      attributionLevel: "Financial Execution",
      sourceReference: "Bank Cash Receipts",
    },
  ];
}

/**
 * PRT-008: Median Stage Duration Calculation
 * Enforces minimum sample size >= 3. If sample size < 3, returns null with label 'Data Belum Cukup'.
 */
export function calculateStageMedianDurations(
  stageHistoryEvents: { fromStage: string; toStage: string; durationDays: number }[]
): StageMedianDuration[] {
  const stages = [
    { code: "S1", name: "Pengukuran Lapangan (Opname)" },
    { code: "S2", name: "Pengajuan Klaim Bulanan" },
    { code: "S3", name: "Verifikasi Konsultan MK" },
    { code: "S4", name: "Penerbitan BAP ke Invoice" },
    { code: "S5", name: "Pembayaran Klien" },
  ];

  return stages.map((stg) => {
    const matchingEvents = stageHistoryEvents.filter(
      (e) => e.fromStage === stg.code || e.toStage === stg.code
    );
    const sampleSize = matchingEvents.length;

    if (sampleSize < 3) {
      return {
        stage: stg.code,
        stageName: stg.name,
        sampleSize,
        medianDurationDays: null,
        hasSufficientData: false, // PRT-008: Empty/null when insufficient
      };
    }

    const durations = matchingEvents.map((e) => e.durationDays).sort((a, b) => a - b);
    const mid = Math.floor(durations.length / 2);
    const median = durations.length % 2 !== 0 ? durations[mid] : (durations[mid - 1] + durations[mid]) / 2;

    return {
      stage: stg.code,
      stageName: stg.name,
      sampleSize,
      medianDurationDays: Math.round(median),
      hasSufficientData: true,
    };
  });
}

/**
 * PRT-009 & UAT-15: Baseline Locking Validation
 * Capturing and locking a baseline requires mandatory reason.
 */
export function validateBaselineLock(input: {
  projectId: string;
  baselineExposure: number;
  baselineCycleDays: number;
  lockedByName: string;
  lockReason: string;
}): { valid: boolean; error?: string } {
  if (!input.projectId) {
    return { valid: false, error: "Baseline harus terikat pada proyek tertentu (PRT-009)." };
  }
  if (!input.lockedByName || input.lockedByName.trim() === "") {
    return { valid: false, error: "Nama pejabat pengunci baseline wajib diisi (PRT-009)." };
  }
  if (!input.lockReason || input.lockReason.trim().length < 5) {
    return { valid: false, error: "Alasan penguncian baseline wajib diisi minimal 5 karakter (PRT-009)." };
  }
  return { valid: true };
}

/**
 * PRT-010: Financing Cost Benefit Calculation
 * Formula: Saved Cost = Accelerated Value * (Cost of Capital / 365) * Days Accelerated
 * With explicit "Asumsi Finansial" label.
 */
export function calculateFinancingBenefit(
  acceleratedValue: number,
  daysAccelerated: number,
  customerCostOfCapitalAnnualRate: number = 0.11 // Default 11% p.a.
): FinancingBenefitResult {
  const dailyRate = customerCostOfCapitalAnnualRate / 365;
  const financingInterestSaved = Math.round(acceleratedValue * dailyRate * daysAccelerated);

  return {
    acceleratedValue,
    customerCostOfCapitalAnnualRate,
    daysAccelerated,
    financingInterestSaved,
    formula: `Penghematan Bunga = Nilai Dipercepat (${acceleratedValue.toLocaleString("id-ID")}) × (${(customerCostOfCapitalAnnualRate * 100).toFixed(1)}% / 365) × ${daysAccelerated} hari`,
    assumptionDisclaimer: "Catatan: Angka penghematan bunga modal dihitung berdasarkan asumsi cost of capital pelanggan sebesar " + (customerCostOfCapitalAnnualRate * 100).toFixed(1) + "% per tahun.",
  };
}

/**
 * PRT-013: Final Pilot Before/After Snapshot Comparison
 */
export function generatePilotComparison(
  baseline: { preInvoiceExposure: number; cycleDays: number; disputedValue: number },
  current: { preInvoiceExposure: number; cycleDays: number; disputedValue: number }
): PilotComparisonItem[] {
  const expDelta = current.preInvoiceExposure - baseline.preInvoiceExposure;
  const daysDelta = current.cycleDays - baseline.cycleDays;
  const dispDelta = current.disputedValue - baseline.disputedValue;

  return [
    {
      metricName: "Pre-Invoice Exposure",
      baselineValue: `Rp ${baseline.preInvoiceExposure.toLocaleString("id-ID")}`,
      currentPilotValue: `Rp ${current.preInvoiceExposure.toLocaleString("id-ID")}`,
      deltaDisplay: expDelta < 0 ? `Turun Rp ${Math.abs(expDelta).toLocaleString("id-ID")}` : `Naik Rp ${expDelta.toLocaleString("id-ID")}`,
      isImprovement: expDelta <= 0,
      attributionNote: "Level A: Percepatan penutupan berita acara opname dan eliminasi selisih volume fasade.",
    },
    {
      metricName: "Siklus Hari Progress-to-Invoice",
      baselineValue: `${baseline.cycleDays} Hari`,
      currentPilotValue: `${current.cycleDays} Hari`,
      deltaDisplay: daysDelta < 0 ? `Lebih Cepat ${Math.abs(daysDelta)} Hari` : `Bertambah ${daysDelta} Hari`,
      isImprovement: daysDelta <= 0,
      attributionNote: "Level A: Penggunaan checklist kesiapan H-5 sebelum cut-off MK.",
    },
    {
      metricName: "Nilai Sengketa Komersial Terbuka",
      baselineValue: `Rp ${baseline.disputedValue.toLocaleString("id-ID")}`,
      currentPilotValue: `Rp ${current.disputedValue.toLocaleString("id-ID")}`,
      deltaDisplay: dispDelta < 0 ? `Berkurang Rp ${Math.abs(dispDelta).toLocaleString("id-ID")}` : `Tetap`,
      isImprovement: dispDelta <= 0,
      attributionNote: "Level B: Mediasi teknis opname bersama sebelum tagihan diterbitkan.",
    },
  ];
}
