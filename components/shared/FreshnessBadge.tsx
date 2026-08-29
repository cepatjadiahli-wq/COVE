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
        "inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200",
        className
      )}
      title={sourceLabel ? `Sumber Data: ${sourceLabel}` : undefined}
    >
      <Clock className="h-3 w-3 text-slate-400" />
      <span>{displayText}</span>
      {sourceLabel && <span className="text-slate-400">• {sourceLabel}</span>}
    </span>
  );
}
