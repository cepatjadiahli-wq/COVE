/**
 * Indonesian Construction Tax Engine & Commercial Billing Calculator
 * Compliant with:
 * - PP No. 9 Tahun 2022 (Tarif PPh Final Jasa Konstruksi)
 * - UU Harmonisasi Peraturan Perpajakan / HPP (Tarif PPN 11% / 12%)
 * - Standard FIDIC / LPJK Commercial Terms (Retensi 5% & Amortisasi Uang Muka)
 */

export type LpjkQualification =
  | "KECIL" // 1.75% PPh Final
  | "MENENGAH_BESAR" // 2.65% PPh Final
  | "SPESIALIS_KONSULTANSI" // 3.50% PPh Final
  | "NON_KUALIFIKASI"; // 4.00% PPh Final

export interface TaxCalculationParams {
  contractValue: number;
  cumulativeCertifiedBefore: number;
  currentCertifiedGross: number;
  retentionPercent?: number; // default 5%
  advancePaymentPercent?: number; // e.g. 20%
  advanceRecoveryPercent?: number; // e.g. 20% of certified gross until fully recovered
  customAdvanceDeduction?: number;
  lpjkQualification?: LpjkQualification;
  ppnPercent?: number; // 11% or 12%
  otherDeductions?: number;
}

export interface BillingBreakdownResult {
  // Base Figures
  contractValue: number;
  cumulativeCertifiedBefore: number;
  currentCertifiedGross: number;
  cumulativeCertifiedTotal: number;

  // Progressive Percentages
  previousProgressPercent: number;
  currentProgressPercent: number;
  cumulativeProgressPercent: number;

  // Commercial Deductions
  retentionPercent: number;
  retentionAmount: number;
  advanceRecoveryAmount: number;
  otherDeductionsAmount: number;
  totalDeductions: number;

  // Net Pre-Tax
  netCertifiedPreTax: number;

  // Taxes
  ppnPercent: number;
  ppnAmount: number;
  pphFinalPercent: number;
  pphFinalAmount: number;
  lpjkLabel: string;

  // Final Net Payable to Contractor
  totalBillingGrossWithPpn: number;
  netPayableToContractor: number;
  netPayableTerbilang: string;
}

/**
 * Converts any numeric IDR amount into formal Indonesian words ("Terbilang")
 * Example: 1500000000 -> "Satu Miliar Lima Ratus Juta Rupiah"
 */
export function terbilangIDR(nominal: number): string {
  const bilangan = Math.floor(Math.abs(nominal));
  if (bilangan === 0) return "Nol Rupiah";

  const satuan = [
    "",
    "Satu",
    "Dua",
    "Tiga",
    "Empat",
    "Lima",
    "Enam",
    "Tujuh",
    "Delapan",
    "Sembilan",
    "Sepuluh",
    "Sebelas",
  ];

  function convertNumber(n: number): string {
    if (n < 12) {
      return satuan[n];
    } else if (n < 20) {
      return convertNumber(n - 10) + " Belas";
    } else if (n < 100) {
      return convertNumber(Math.floor(n / 10)) + " Puluh " + convertNumber(n % 10);
    } else if (n < 200) {
      return "Seratus " + convertNumber(n - 100);
    } else if (n < 1000) {
      return convertNumber(Math.floor(n / 100)) + " Ratus " + convertNumber(n % 100);
    } else if (n < 2000) {
      return "Seribu " + convertNumber(n - 1000);
    } else if (n < 1000000) {
      return convertNumber(Math.floor(n / 1000)) + " Ribu " + convertNumber(n % 1000);
    } else if (n < 1000000000) {
      return convertNumber(Math.floor(n / 1000000)) + " Juta " + convertNumber(n % 1000000);
    } else if (n < 1000000000000) {
      return convertNumber(Math.floor(n / 1000000000)) + " Miliar " + convertNumber(n % 1000000000);
    } else {
      return convertNumber(Math.floor(n / 1000000000000)) + " Triliun " + convertNumber(n % 1000000000000);
    }
  }

  const result = convertNumber(bilangan).replace(/\s+/g, " ").trim();
  return `${result} Rupiah`;
}

/**
 * Computes complete Indonesian construction billing breakdown
 */
export function calculateConstructionBillingBreakdown(
  params: TaxCalculationParams
): BillingBreakdownResult {
  const contractValue = Math.max(1, params.contractValue);
  const currentCertifiedGross = Math.max(0, params.currentCertifiedGross);
  const cumulativeCertifiedBefore = Math.max(0, params.cumulativeCertifiedBefore);
  const cumulativeCertifiedTotal = cumulativeCertifiedBefore + currentCertifiedGross;

  // Progressive percentages
  const previousProgressPercent = Number(((cumulativeCertifiedBefore / contractValue) * 100).toFixed(2));
  const currentProgressPercent = Number(((currentCertifiedGross / contractValue) * 100).toFixed(2));
  const cumulativeProgressPercent = Number(((cumulativeCertifiedTotal / contractValue) * 100).toFixed(2));

  // Retention (Default 5%)
  const retentionPercent = params.retentionPercent ?? 5.0;
  const retentionAmount = Math.round((currentCertifiedGross * retentionPercent) / 100);

  // Advance Payment Recovery (Amortisasi Uang Muka)
  let advanceRecoveryAmount = params.customAdvanceDeduction ?? 0;
  if (!params.customAdvanceDeduction && params.advanceRecoveryPercent) {
    advanceRecoveryAmount = Math.round((currentCertifiedGross * params.advanceRecoveryPercent) / 100);
  }

  const otherDeductionsAmount = params.otherDeductions ?? 0;
  const totalDeductions = retentionAmount + advanceRecoveryAmount + otherDeductionsAmount;

  // Net Certified Pre-Tax
  const netCertifiedPreTax = Math.max(0, currentCertifiedGross - totalDeductions);

  // PPN (Default 11%)
  const ppnPercent = params.ppnPercent ?? 11.0;
  const ppnAmount = Math.round((netCertifiedPreTax * ppnPercent) / 100);

  // PPh Final Jasa Konstruksi (PP 9/2022)
  const qualification = params.lpjkQualification ?? "MENENGAH_BESAR";
  const pphConfig: Record<LpjkQualification, { rate: number; label: string }> = {
    KECIL: { rate: 1.75, label: "Kualifikasi Kecil (1.75%)" },
    MENENGAH_BESAR: { rate: 2.65, label: "Kualifikasi Menengah / Besar (2.65%)" },
    SPESIALIS_KONSULTANSI: { rate: 3.50, label: "Konsultansi / Spesialis (3.50%)" },
    NON_KUALIFIKASI: { rate: 4.00, label: "Non-Kualifikasi SBU (4.00%)" },
  };

  const pphFinalPercent = pphConfig[qualification].rate;
  const lpjkLabel = pphConfig[qualification].label;
  const pphFinalAmount = Math.round((netCertifiedPreTax * pphFinalPercent) / 100);

  // Final Net Payable to Contractor (Net Pre-Tax + PPN - PPh Final)
  const totalBillingGrossWithPpn = netCertifiedPreTax + ppnAmount;
  const netPayableToContractor = Math.max(0, netCertifiedPreTax + ppnAmount - pphFinalAmount);
  const netPayableTerbilang = terbilangIDR(netPayableToContractor);

  return {
    contractValue,
    cumulativeCertifiedBefore,
    currentCertifiedGross,
    cumulativeCertifiedTotal,
    previousProgressPercent,
    currentProgressPercent,
    cumulativeProgressPercent,
    retentionPercent,
    retentionAmount,
    advanceRecoveryAmount,
    otherDeductionsAmount,
    totalDeductions,
    netCertifiedPreTax,
    ppnPercent,
    ppnAmount,
    pphFinalPercent,
    pphFinalAmount,
    lpjkLabel,
    totalBillingGrossWithPpn,
    netPayableToContractor,
    netPayableTerbilang,
  };
}
