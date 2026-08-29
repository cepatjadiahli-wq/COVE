"use client";

import * as React from "react";
import { ClaimStage, CLAIM_STAGE_CONFIGS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface StageBadgeProps {
  stage: ClaimStage | string;
  className?: string;
  size?: "sm" | "md";
  showOrder?: boolean;
}

export function StageBadge({ stage, className, size = "md", showOrder = false }: StageBadgeProps) {
  const { language } = useLanguage();
  const config = CLAIM_STAGE_CONFIGS[stage as ClaimStage] || {
    key: stage as ClaimStage,
    label: stage,
    labelId: stage,
    order: 0,
    color: "text-slate-700",
    bgColor: "bg-slate-100",
    borderColor: "border-slate-300",
    description: "",
    descriptionId: "",
  };

  const displayLabel = language === "id" && config.labelId ? config.labelId : config.label;
  const displayDescription = language === "id" && config.descriptionId ? config.descriptionId : config.description;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-medium",
        config.bgColor,
        config.color,
        config.borderColor,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs font-semibold",
        className
      )}
      title={displayDescription}
    >
      {showOrder && !config.isException && (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/80 text-[10px] font-bold shadow-2xs">
          {config.order}
        </span>
      )}
      {displayLabel}
    </span>
  );
}
