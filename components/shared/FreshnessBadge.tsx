import * as React from "react";
import { DataFreshness, FRESHNESS_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface FreshnessBadgeProps {
  freshness: DataFreshness | string;
  label?: string;
  sourceLabel?: string;
  className?: string;
}

export function FreshnessBadge({ freshness, label, sourceLabel, className }: FreshnessBadgeProps) {
  const config = FRESHNESS_CONFIG[freshness as DataFreshness] || FRESHNESS_CONFIG.UNKNOWN;
  const displayText = label || config.label;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded border shadow-2xs",
        config.bgColor,
        config.color,
        freshness === "CURRENT" || freshness === "FRESH" ? "border-emerald-200" :
        freshness === "NEEDS_ATTENTION" || freshness === "NEEDS_UPDATE" || freshness === "ATTENTION" ? "border-amber-200" :
        freshness === "STALE" ? "border-rose-200" : "border-slate-200",
        className
      )}
      title={sourceLabel ? `Sumber Data: ${sourceLabel}` : undefined}
    >
      <Clock className="h-3 w-3 shrink-0 opacity-70" />
      <span>{displayText}</span>
      {sourceLabel && <span className="opacity-60 font-normal">• {sourceLabel}</span>}
    </span>
  );
}
