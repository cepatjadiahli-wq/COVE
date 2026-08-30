/**
 * COVE Pay-When-Paid Subcontractor & Labor Control Engine
 * Ensures back-to-back liquidity protection for construction contractors.
 */

export type PwpStatus =
  | "LOCKED_WAITING_OWNER_BAP" // Owner BAP has not been certified yet
  | "READY_FOR_VERIFICATION" // Owner BAP certified, subcon invoice under review
  | "RELEASE_AUTHORIZED" // Owner cash received in bank, safe to disburse
  | "PAID"; // Disbursed to subcontractor

export interface SubcontractorClaim {
  id: string;
  projectId: string;
  subconName: string;
  subconType: "MANDOR_BORONGAN" | "SUBKON_SPESIALIS" | "SUPPLIER_MATERIAL" | "SEWA_ALAT_BERAT";
  tradeScope: string; // e.g. 'Pekerjaan Pembesian & Bekisting', 'Pekerjaan MEP', 'Pekerjaan ACP & Kaca'
  spkNumber: string;
  invoiceNumber: string;
  linkedClaimNumber: string; // e.g. 'MC-006'
  claimAmount: number;
  approvedAmount: number;
  paidAmount: number;
  pwpStatus: PwpStatus;
  submissionDate: string;
  authorizedDate?: string;
  bankAccount: string;
  bankName: string;
  notes?: string;
}

// Canonical Sample Data for Contractor Subcontracts
export const INITIAL_SUBCON_CLAIMS: SubcontractorClaim[] = [
  {
    id: "sub-01",
    projectId: "prj-meridian",
    subconName: "Mandor Pak Joko (PT Sumber Jaya Mandiri)",
    subconType: "MANDOR_BORONGAN",
    tradeScope: "Pekerjaan Pembesian & Pengecoran Plat Lantai 12-15",
    spkNumber: "SPK-MDR/2026/012",
    invoiceNumber: "INV-MDR-006",
    linkedClaimNumber: "MC-006",
    claimAmount: 480000000,
    approvedAmount: 460000000,
    paidAmount: 0,
    pwpStatus: "LOCKED_WAITING_OWNER_BAP",
    submissionDate: "2026-08-20",
    bankAccount: "541-0988-123",
    bankName: "BCA",
    notes: "Terkunci: Menunggu persetujuan selisih volume fasade MC-006 dari Konsultan MK.",
  },
  {
    id: "sub-02",
    projectId: "prj-meridian",
    subconName: "PT Graha Kaca Prima (Subkon Façade & ACP)",
    subconType: "SUBKON_SPESIALIS",
    tradeScope: "Pemasangan Curtain Wall & Kaca Tempered",
    spkNumber: "SPK-FAC/2026/004",
    invoiceNumber: "INV-GKP-003",
    linkedClaimNumber: "MC-006",
    claimAmount: 620000000,
    approvedAmount: 580000000,
    paidAmount: 0,
    pwpStatus: "LOCKED_WAITING_OWNER_BAP",
    submissionDate: "2026-08-22",
    bankAccount: "008-7711-229",
    bankName: "Mandiri",
    notes: "Terkunci: Menunggu BAP Tripartite disahkan Owner.",
  },
  {
    id: "sub-03",
    projectId: "prj-meridian",
    subconName: "PT Sinar Indah MEP (Instalasi Mekanikal)",
    subconType: "SUBKON_SPESIALIS",
    tradeScope: "Pekerjaan Ducting AC & Pemipaan Chiller",
    spkNumber: "SPK-MEP/2026/009",
    invoiceNumber: "INV-SIM-005",
    linkedClaimNumber: "MC-005",
    claimAmount: 510000000,
    approvedAmount: 510000000,
    paidAmount: 510000000,
    pwpStatus: "PAID",
    submissionDate: "2026-07-28",
    authorizedDate: "2026-08-15",
    bankAccount: "888-1299-445",
    bankName: "BCA",
    notes: "Lunas: Dana kas MC-005 telah cair dari Owner sebesar Rp 2,3M.",
  },
  {
    id: "sub-04",
    projectId: "prj-husada",
    subconName: "PT Cipta Beton Readymix",
    subconType: "SUPPLIER_MATERIAL",
    tradeScope: "Supply Beton Ready Mix K-350 & Slump 12±2",
    spkNumber: "PO-BETON/2026/088",
    invoiceNumber: "INV-CBR-004",
    linkedClaimNumber: "MC-004",
    claimAmount: 390000000,
    approvedAmount: 390000000,
    paidAmount: 0,
    pwpStatus: "RELEASE_AUTHORIZED",
    submissionDate: "2026-08-18",
    authorizedDate: "2026-08-28",
    bankAccount: "112-9900-334",
    bankName: "BNI",
    notes: "Siap Cair: Kas termin RS Husada telah masuk ke rekening BCA perusahaan.",
  },
  {
    id: "sub-05",
    projectId: "prj-nusantara",
    subconName: "Mandor Pak Ujang (Pekerjaan Finishing & Keramik)",
    subconType: "MANDOR_BORONGAN",
    tradeScope: "Pemasangan Granit Tile 60x60 & Plafon Gypsum",
    spkNumber: "SPK-MDR/2026/044",
    invoiceNumber: "INV-UJG-002",
    linkedClaimNumber: "MC-003",
    claimAmount: 210000000,
    approvedAmount: 210000000,
    paidAmount: 0,
    pwpStatus: "READY_FOR_VERIFICATION",
    submissionDate: "2026-08-25",
    bankAccount: "541-0022-881",
    bankName: "BCA",
    notes: "BAP MC-003 telah disahkan MK, menunggu verifikasi cek fisik QC.",
  },
];

export interface PwpPortfolioSummary {
  totalSubconPayables: number;
  lockedByOwnerBap: number;
  readyForVerification: number;
  releaseAuthorized: number;
  totalDisbursed: number;
  protectedLiquidityPercentage: number;
}

export function calculatePwpPortfolioSummary(
  subconClaims: SubcontractorClaim[]
): PwpPortfolioSummary {
  const totalSubconPayables = subconClaims.reduce((sum, s) => sum + s.claimAmount, 0);
  const lockedByOwnerBap = subconClaims
    .filter((s) => s.pwpStatus === "LOCKED_WAITING_OWNER_BAP")
    .reduce((sum, s) => sum + s.claimAmount, 0);
  const readyForVerification = subconClaims
    .filter((s) => s.pwpStatus === "READY_FOR_VERIFICATION")
    .reduce((sum, s) => sum + s.claimAmount, 0);
  const releaseAuthorized = subconClaims
    .filter((s) => s.pwpStatus === "RELEASE_AUTHORIZED")
    .reduce((sum, s) => sum + (s.approvedAmount - s.paidAmount), 0);
  const totalDisbursed = subconClaims
    .filter((s) => s.pwpStatus === "PAID")
    .reduce((sum, s) => sum + s.paidAmount, 0);

  const protectedLiquidityPercentage =
    totalSubconPayables > 0
      ? Math.round(((lockedByOwnerBap + readyForVerification) / totalSubconPayables) * 100)
      : 0;

  return {
    totalSubconPayables,
    lockedByOwnerBap,
    readyForVerification,
    releaseAuthorized,
    totalDisbursed,
    protectedLiquidityPercentage,
  };
}
