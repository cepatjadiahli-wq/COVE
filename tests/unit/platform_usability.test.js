/**
 * Test Suite 19: Phase 9 Platform Usability, Search, Saved Views, and Minimum Integration
 * PRD Reference: Section 15.2 (PLT-013..PLT-018), Section 20.1 (ERP CSV Bridge)
 * UAT Scenario: UAT-17
 */

const {
  performGlobalSearch,
  validateSavedFilterView,
  ACTIONABLE_EMPTY_STATES,
  formatActionableError,
  previewBulkAction,
  formatSourceLineage,
  generateErpInvoiceReconciliationCsv,
} = require("../../domains/platform/service");

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[Phase 9 Platform Usability Assertion FAILED] ${message}`);
  }
}

async function runPlatformUsabilityTestSuite() {
  console.log("  >>> Starting Phase 9 Platform Usability & Integration Test Suite...");

  // Mock datasets
  const mockDataset = {
    projects: [
      { id: "prj-meridian", projectName: "Grand Meridian Mixed-Use", projectCode: "PRJ-MERIDIAN", clientName: "PT Pakuwon", contractValue: 45000000000 },
      { id: "prj-cisumdawu", projectName: "Tol Cisumdawu Seksi 4", projectCode: "PRJ-CISUMDAWU", clientName: "PT CKJT", contractValue: 125000000000 },
    ],
    claims: [
      { id: "clm-006", claimNumber: "MC-006", currentStage: "UNDER_REVIEW", claimedValue: 1800000000, notes: "Opname Mei 2026" },
      { id: "clm-007", claimNumber: "MC-007", currentStage: "SUBMITTED", claimedValue: 2400000000, notes: "Opname Juni 2026" },
    ],
    actions: [
      { id: "act-01", title: "Follow-up BAP MC-006 Konsultan MK", nextStep: "Kirim surat resmi", ownerName: "Dimas Sucipto", dueDate: "2026-09-10", financialExposure: 650000000 },
      { id: "act-02", title: "Klarifikasi Joint Survey Fasade", nextStep: "Rapat koordinasi lapangan", ownerName: "Fajar Pratama", dueDate: "2026-09-08", financialExposure: 200000000 },
    ],
    blockers: [
      { id: "blk-01", title: "Persetujuan Shop Drawing Fasade Tertunda", severity: "HIGH", controllability: "JOINT", financialExposure: 650000000 },
    ],
    profiles: [
      { id: "usr-dimas", fullName: "Dimas Sucipto", email: "dimas@cove.id", role: "Commercial Manager" },
      { id: "usr-bambang", fullName: "Bambang Wijaya", email: "bambang@cove.id", role: "Owner" },
    ],
  };

  // 1. PLT-013: Global Search across multiple entities in < 2 seconds
  console.log("  [1] Verifying PLT-013: Global Search (<2s latency and cross-entity matching)...");
  const searchResult = performGlobalSearch("Meridian", mockDataset);
  assert(searchResult.isUnderTwoSeconds, "Search latency must be under 2 seconds (PLT-013)");
  assert(searchResult.totalMatches > 0, "Must find match for query 'Meridian'");
  assert(searchResult.results[0].type === "PROJECT", "First match should be project type");

  const claimSearch = performGlobalSearch("MC-006", mockDataset);
  assert(claimSearch.totalMatches >= 2, "Search for 'MC-006' must find claim and action mentioning MC-006");
  const foundClaim = claimSearch.results.some(r => r.type === "CLAIM" && r.title.includes("MC-006"));
  assert(foundClaim, "Must find claim item for MC-006");

  // 2. PLT-014: Saved Filter Views Validation
  console.log("  [2] Verifying PLT-014: Saved Filter Views validation and structure...");
  const invalidNameView = validateSavedFilterView({ viewName: "ab", pageContext: "actions", filterCriteria: { status: "open" } });
  assert(!invalidNameView.valid, "Must reject view name shorter than 3 characters (PLT-014)");

  const emptyCriteriaView = validateSavedFilterView({ viewName: "Valid View", pageContext: "actions", filterCriteria: {} });
  assert(!emptyCriteriaView.valid, "Must reject empty filter criteria (PLT-014)");

  const validView = validateSavedFilterView({
    viewName: "Rapat Direksi Mingguan",
    pageContext: "progress-to-cash",
    filterCriteria: { projectFilter: "prj-meridian", controllabilityFilter: "INTERNAL" },
  });
  assert(validView.valid, "Valid view configuration must be accepted (PLT-014)");

  // 3. PLT-015: Actionable Empty States
  console.log("  [3] Verifying PLT-015: Actionable empty states configuration with operational CTA...");
  assert(Boolean(ACTIONABLE_EMPTY_STATES.ACTIONS_QUEUE), "Actions queue empty state must be defined");
  assert(Boolean(ACTIONABLE_EMPTY_STATES.ACTIONS_QUEUE.primaryCtaLabel), "Empty state must have primary CTA label");
  assert(Boolean(ACTIONABLE_EMPTY_STATES.ACTIONS_QUEUE.nextStepInstruction), "Empty state must explain next step");
  assert(Boolean(ACTIONABLE_EMPTY_STATES.CLAIMS_LIST.primaryCtaHref), "Claims list empty state must have operational link");

  // 4. PLT-016: Actionable Business Error Messages (Problem + Remediation)
  console.log("  [4] Verifying PLT-016: Error messages state problem and clear remediation...");
  const errOwner = formatActionableError("ERR_OWNER_REQUIRED");
  assert(errOwner.problem.length > 10, "Problem description must be descriptive");
  assert(errOwner.remediation.length > 10, "Remediation step must be concrete");
  assert(errOwner.formattedMessage.includes("Solusi:"), "Formatted message must clearly state solution");

  const errEvidence = formatActionableError("ERR_CLOSURE_EVIDENCE_MISSING");
  assert(errEvidence.remediation.includes("URL") || errEvidence.remediation.includes("bukti"), "Evidence error remediation must mention evidence URL or note");

  // 5. PLT-017 & UAT-17: Bulk Action Preview and High-Value Confirmation
  console.log("  [5] Verifying PLT-017 & UAT-17: Bulk action preview and material value confirmation...");
  // Test low value impact (< Rp 500M)
  const lowValueItems = [
    { id: "act-02", title: "Klarifikasi Joint Survey", financialExposure: 200000000 },
  ];
  const lowPreview = previewBulkAction("BULK_ASSIGN", lowValueItems);
  assert(lowPreview.totalItemCount === 1, "Low preview total items must be 1");
  assert(lowPreview.totalFinancialImpact === 200000000, "Low preview impact must be 200M");
  assert(!lowPreview.isHighValueImpact, "200M should not trigger high value warning");

  // Test high value impact (>= Rp 500M) -> UAT-17
  const highValueItems = [
    { id: "act-01", title: "Follow-up BAP MC-006", financialExposure: 650000000 },
    { id: "act-02", title: "Klarifikasi Joint Survey", financialExposure: 200000000 },
  ];
  const highPreview = previewBulkAction("BULK_ASSIGN", highValueItems);
  assert(highPreview.totalItemCount === 2, "High preview total items must be 2");
  assert(highPreview.totalFinancialImpact === 850000000, "High preview impact must be 850M");
  assert(highPreview.isHighValueImpact === true, "850M (>= 500M) must trigger isHighValueImpact (UAT-17)");
  assert(highPreview.impactNotice.includes("UAT-17"), "Impact notice must mention UAT-17 confirmation requirement");

  // 6. PLT-018: Source Lineage and Last Updated Formatting
  console.log("  [6] Verifying PLT-018: Source lineage and last updated formatting...");
  const lineage = formatSourceLineage({
    updatedAt: "2026-08-30T10:00:00Z",
    sourceFile: "Opname_Agustus_GrandMeridian.xlsx",
    sourceSheet: "Rekap_BAP",
    uploaderName: "Dimas Sucipto",
  });
  assert(lineage.lastUpdatedDisplay.includes("WIB"), "Last updated display must specify WIB timezone (PLT-010)");
  assert(lineage.sourceDisplay.includes("Opname_Agustus_GrandMeridian.xlsx"), "Source display must show source file");
  assert(lineage.sourceDisplay.includes("Rekap_BAP"), "Source display must show sheet name");
  assert(lineage.sourceDisplay.includes("Dimas Sucipto"), "Source display must show uploader name");

  // 7. PRD Section 20.1: ERP / Accounting CSV Bridge
  console.log("  [7] Verifying PRD Section 20.1: Accounting / ERP CSV Bridge generation...");
  const mockInvoices = [
    {
      id: "inv-001",
      claimId: "clm-006",
      invoiceNumber: "INV-GM-2026-001",
      taxInvoiceSeries: "010.000-26.00000001",
      projectCode: "PRJ-MERIDIAN",
      invoiceDate: "2026-08-10",
      dueDate: "2026-09-09",
      grossAmount: 1800000000,
      retentionDeduction: 90000000,
      downPaymentDeduction: 180000000,
      vatAmount: 198000000,
      netReceivableAmount: 1728000000,
      cashReceivedAmount: 1000000000,
      outstandingAmount: 728000000,
      status: "unpaid",
    },
  ];
  const erpCsv = generateErpInvoiceReconciliationCsv(mockInvoices, mockDataset.claims);
  assert(erpCsv.includes("COVE_INVOICE_ID,INVOICE_NUMBER"), "ERP CSV must contain standard header");
  assert(erpCsv.includes("INV-GM-2026-001"), "ERP CSV must contain invoice number");
  assert(erpCsv.includes("MC-006"), "ERP CSV must reconcile with claim number MC-006");
  assert(erpCsv.includes("1728000000"), "ERP CSV must contain net receivable amount");

  console.log("  >>> All Phase 9 Platform Usability assertions PASSED successfully! [Suite 19 OK]\n");
  return true;
}

module.exports = { runPlatformUsabilityTestSuite };
