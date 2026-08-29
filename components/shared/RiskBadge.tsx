"use client";

import * as React from "react";
import { RiskLevel, RISK_LEVEL_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface RiskBadgeProps {
  level: RiskLevel | string;
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md";
}

export function RiskBadge({ level, className, showIcon = true, size = "md" }: RiskBadgeProps) {
  const { language } = useLanguage();
  const config = RISK_LEVEL_CONFIG[level as RiskLevel] || RISK_LEVEL_CONFIG.HEALTHY;

  const icons = {
    HEALTHY: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />,
    WATCH: <AlertCircle className="h-3.5 w-3.5 text-amber-600" />,
    AT_RISK: <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />,
    CRITICAL: <ShieldAlert className="h-3.5 w-3.5 text-red-600" />,
  };

  const displayLabel = language === "id" && config.labelId ? config.labelId : config.label;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold",
        config.bgColor,
        config.color,
        config.borderColor,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      {showIcon && icons[level as RiskLevel]}
      {displayLabel}
    </span>
  );
}
