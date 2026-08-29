import * as React from "react";
import { formatIDR, cn } from "@/lib/utils";

interface MoneyDisplayProps {
  amount: number | string | null | undefined;
  className?: string;
  currency?: string;
  compact?: boolean;
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl";
  trend?: "positive" | "negative" | "neutral";
  highlight?: boolean;
}

export function MoneyDisplay({
  amount,
  className,
  compact = false,
  size = "base",
  trend,
  highlight = false,
}: MoneyDisplayProps) {
  const formatted = formatIDR(amount, { showZero: true, compact });

  const sizeClasses = {
    xs: "text-xs font-medium",
    sm: "text-sm font-semibold",
    base: "text-base font-semibold",
    lg: "text-lg font-bold",
    xl: "text-xl font-bold tracking-tight",
    "2xl": "text-2xl font-extrabold tracking-tight",
  };

  const trendClasses = {
    positive: "text-emerald-600",
    negative: "text-red-600",
    neutral: "text-slate-900",
  };

  return (
    <span
      className={cn(
        "font-mono-numbers whitespace-nowrap",
        sizeClasses[size],
        trend ? trendClasses[trend] : "text-slate-900",
        highlight && "bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200",
        className
      )}
    >
      {formatted}
    </span>
  );
}
