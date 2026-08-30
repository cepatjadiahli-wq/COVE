/**
 * COVE Cash Flow Stress-Testing & Scenario Simulator
 * Simulates portfolio liquidity resilience under client payment delays (0 to 90 days).
 */

export interface StressTestParams {
  startingCash: number; // e.g. Rp 3.500.000.000
  monthlyFixedBurn: number; // e.g. Rp 800.000.000 (Gaji, Overhead, Sewa Alat)
  weeklySubconBurn: number; // e.g. Rp 300.000.000 (Mandor mingguan & material)
  ownerDelayDays: number; // 0, 15, 30, 45, 60, 90 days
  enableScfFacility: boolean; // Bank Supply Chain Financing Facility (e.g. Rp 2.500.000.000)
  scfFacilityLimit?: number;
  enablePwpHold: boolean; // Pay-When-Paid protection: freeze subcon payables during delay
  scheduledInflows: {
    projectName: string;
    claimNumber: string;
    expectedWeek: number; // 1 to 12
    amount: number;
  }[];
}

export interface WeeklyCashRecord {
  weekNumber: number;
  weekLabel: string;
  inflow: number;
  outflowFixed: number;
  outflowSubcon: number;
  totalOutflow: number;
  netCashFlow: number;
  endingBalance: number;
  isDeficit: boolean;
  scfDrawn: number;
}

export interface StressTestResult {
  weeklyProjections: WeeklyCashRecord[];
  lowestCashBalance: number;
  lowestCashWeek: number;
  runwayWeeks: number;
  hasDeficit: boolean;
  deficitStartWeek: number | null;
  totalInflowsProjected: number;
  totalOutflowsProjected: number;
  riskVerdict: "SAFE_HEALTHY" | "TIGHT_WATCH" | "CRITICAL_DEFICIT";
  executiveSummary: string;
  recommendations: string[];
}

export function runCashStressSimulation(params: StressTestParams): StressTestResult {
  const weeksToSimulate = 12;
  const weeklyFixedBurn = Math.round(params.monthlyFixedBurn / 4);
  const delayWeeks = Math.floor(params.ownerDelayDays / 7);
  const scfLimit = params.scfFacilityLimit || 2500000000;

  let currentBalance = params.startingCash;
  let scfUsed = 0;
  let hasDeficit = false;
  let deficitStartWeek: number | null = null;
  let lowestCashBalance = currentBalance;
  let lowestCashWeek = 1;
  let totalInflowsProjected = 0;
  let totalOutflowsProjected = 0;

  const weeklyProjections: WeeklyCashRecord[] = [];

  for (let w = 1; w <= weeksToSimulate; w++) {
    // 1. Calculate Inflows (Shifted by delayWeeks)
    let weeklyInflow = 0;
    params.scheduledInflows.forEach((inflow) => {
      const actualArrivalWeek = inflow.expectedWeek + delayWeeks;
      if (actualArrivalWeek === w) {
        weeklyInflow += inflow.amount;
      }
    });

    totalInflowsProjected += weeklyInflow;

    // 2. Calculate Outflows
    const outflowFixed = weeklyFixedBurn;
    let outflowSubcon = params.weeklySubconBurn;

    // If PWP Hold is active and we are in delay without cash inflow, reduce subcon payout to protect cash
    if (params.enablePwpHold && weeklyInflow === 0 && delayWeeks > 2) {
      outflowSubcon = Math.round(params.weeklySubconBurn * 0.4); // Freeze 60% of discretionary subcon payments
    }

    const totalOutflow = outflowFixed + outflowSubcon;
    totalOutflowsProjected += totalOutflow;

    const netCashFlow = weeklyInflow - totalOutflow;
    currentBalance += netCashFlow;

    // Check SCF Cushion
    let currentWeekScf = 0;
    if (currentBalance < 0 && params.enableScfFacility) {
      const shortfall = Math.abs(currentBalance);
      const availableScf = scfLimit - scfUsed;
      const drawAmount = Math.min(shortfall, availableScf);
      currentBalance += drawAmount;
      scfUsed += drawAmount;
      currentWeekScf = drawAmount;
    }

    const isDeficit = currentBalance < 0;
    if (isDeficit && !hasDeficit) {
      hasDeficit = true;
      deficitStartWeek = w;
    }

    if (currentBalance < lowestCashBalance) {
      lowestCashBalance = currentBalance;
      lowestCashWeek = w;
    }

    weeklyProjections.push({
      weekNumber: w,
      weekLabel: `Minggu ${w}`,
      inflow: weeklyInflow,
      outflowFixed,
      outflowSubcon,
      totalOutflow,
      netCashFlow,
      endingBalance: currentBalance,
      isDeficit,
      scfDrawn: currentWeekScf,
    });
  }

  // Determine Runway & Risk Verdict
  const runwayWeeks = hasDeficit && deficitStartWeek ? deficitStartWeek - 1 : weeksToSimulate;

  let riskVerdict: StressTestResult["riskVerdict"] = "SAFE_HEALTHY";
  if (hasDeficit) {
    riskVerdict = "CRITICAL_DEFICIT";
  } else if (lowestCashBalance < 500000000) {
    riskVerdict = "TIGHT_WATCH";
  }

  // Recommendations
  const recommendations: string[] = [];
  if (params.ownerDelayDays >= 30 && !params.enablePwpHold) {
    recommendations.push("Aktifkan Pay-When-Paid Hold untuk menahan termin mandor hingga BAP Owner cair.");
  }
  if (hasDeficit && !params.enableScfFacility) {
    recommendations.push("Buka fasilitas perbankan SCF (Supply Chain Financing) senilai Rp 2,5 Miliar sebagai bantalan likuiditas.");
  }
  if (params.ownerDelayDays >= 60) {
    recommendations.push("Eskalasi surat resmi penagihan ke Direktur Owner dan mintakan pembayaran termin parsial (50%).");
  } else {
    recommendations.push("Jadwal kas saat ini masih dalam batas aman; pertahankan kontrol mingguan di Command Center.");
  }

  const executiveSummary = hasDeficit
    ? `⚠️ PERINGATAN: Dengan penundaan pembayaran Owner ${params.ownerDelayDays} hari, kas perusahaan akan mengalami defisit (minus) pada Minggu ke-${deficitStartWeek}. Saldo terendah: -Rp ${Math.abs(lowestCashBalance).toLocaleString("id-ID")}.`
    : `✅ AMAN: Kas perusahaan mampu bertahan melewati penundaan pembayaran Owner ${params.ownerDelayDays} hari tanpa defisit. Titik kas terendah: Rp ${lowestCashBalance.toLocaleString("id-ID")} pada Minggu ke-${lowestCashWeek}.`;

  return {
    weeklyProjections,
    lowestCashBalance,
    lowestCashWeek,
    runwayWeeks,
    hasDeficit,
    deficitStartWeek,
    totalInflowsProjected,
    totalOutflowsProjected,
    riskVerdict,
    executiveSummary,
    recommendations,
  };
}
