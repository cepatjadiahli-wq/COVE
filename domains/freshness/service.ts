import { DataFreshness, DATA_FRESHNESS } from "@/lib/constants";

export interface FreshnessMetadata {
  sourceType: "manual" | "csv_import" | "xlsx_import" | "api" | "integration" | "system";
  sourceReference?: string | null;
  sourceUpdatedAt?: string | Date | null;
}

export interface FreshnessEvaluationResult {
  freshness: DataFreshness;
  hoursAgo: number;
  daysAgo: number;
  label: string;
  sourceLabel: string;
}

export function evaluateFreshness(meta?: FreshnessMetadata | null): FreshnessEvaluationResult {
  if (!meta || !meta.sourceUpdatedAt) {
    return {
      freshness: DATA_FRESHNESS.UNKNOWN,
      hoursAgo: 0,
      daysAgo: 0,
      label: "Unknown Freshness",
      sourceLabel: "Manual",
    };
  }

  const updatedDate = new Date(meta.sourceUpdatedAt);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - updatedDate.getTime());
  const hoursAgo = Math.floor(diffMs / (1000 * 60 * 60));
  const daysAgo = Math.floor(hoursAgo / 24);

  let freshness: DataFreshness = DATA_FRESHNESS.FRESH;
  let label = `Fresh (${hoursAgo <= 1 ? "baru saja" : `${hoursAgo} jam lalu`})`;

  if (hoursAgo > 24 * 7) {
    freshness = DATA_FRESHNESS.STALE;
    label = `Stale (${daysAgo} hari lalu)`;
  } else if (hoursAgo > 24) {
    freshness = DATA_FRESHNESS.NEEDS_UPDATE;
    label = `Needs Update (${daysAgo} hari lalu)`;
  }

  const sourceLabels: Record<string, string> = {
    manual: "Manual Input",
    csv_import: "CSV Import",
    xlsx_import: "XLSX Import",
    api: "API Sync",
    integration: "ERP Integration",
    system: "System Generated",
  };

  return {
    freshness,
    hoursAgo,
    daysAgo,
    label,
    sourceLabel: sourceLabels[meta.sourceType] || "Manual",
  };
}
