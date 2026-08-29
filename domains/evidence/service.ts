/**
 * COVE Evidence Readiness Engine
 * Blueprint §27 & PRD §22
 */

export interface EvidenceItem {
  id: string;
  name: string;
  required: boolean;
  status: "missing" | "in_progress" | "uploaded" | "verified" | "not_applicable";
}

export type ReadinessBand = "INCOMPLETE" | "NEEDS_ATTENTION" | "NEARLY_READY" | "READY";

export interface EvidenceReadinessResult {
  percent: number;
  totalRequired: number;
  totalApplicable: number;
  totalVerified: number;
  band: ReadinessBand;
  label: string;
  color: string;
  bgColor: string;
}

export function calculateEvidenceReadiness(items: EvidenceItem[]): EvidenceReadinessResult {
  if (!items || items.length === 0) {
    return {
      percent: 0,
      totalRequired: 0,
      totalApplicable: 0,
      totalVerified: 0,
      band: "INCOMPLETE",
      label: "Incomplete (0%)",
      color: "text-rose-700",
      bgColor: "bg-rose-50",
    };
  }

  // Filter required items excluding not_applicable
  const applicableRequired = items.filter(
    (item) => item.required && item.status !== "not_applicable"
  );

  const verified = applicableRequired.filter((item) => item.status === "verified");

  if (applicableRequired.length === 0) {
    return {
      percent: 100,
      totalRequired: items.filter((i) => i.required).length,
      totalApplicable: 0,
      totalVerified: 0,
      band: "READY",
      label: "Ready (N/A)",
      color: "text-emerald-700",
      bgColor: "bg-emerald-50",
    };
  }

  const percent = Math.round((verified.length / applicableRequired.length) * 100);

  let band: ReadinessBand = "INCOMPLETE";
  let label = `Incomplete (${percent}%)`;
  let color = "text-rose-700";
  let bgColor = "bg-rose-50";

  if (percent >= 100) {
    band = "READY";
    label = "Ready (100%)";
    color = "text-emerald-700";
    bgColor = "bg-emerald-50";
  } else if (percent >= 80) {
    band = "NEARLY_READY";
    label = `Nearly Ready (${percent}%)`;
    color = "text-teal-700";
    bgColor = "bg-teal-50";
  } else if (percent >= 50) {
    band = "NEEDS_ATTENTION";
    label = `Needs Attention (${percent}%)`;
    color = "text-amber-700";
    bgColor = "bg-amber-50";
  }

  return {
    percent,
    totalRequired: items.filter((i) => i.required).length,
    totalApplicable: applicableRequired.length,
    totalVerified: verified.length,
    band,
    label,
    color,
    bgColor,
  };
}
