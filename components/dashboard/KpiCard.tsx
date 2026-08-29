"use client";

import React from "react";
import { formatIDR } from "@/lib/utils";
import { LucideIcon, ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface KpiCardProps {
  title: string;
  amount: number;
  affectedCount: number;
  affectedLabel?: string;
  freshness: string;
  description: string;
  href?: string;
  variant?: "danger" | "warning" | "info" | "success";
  icon: LucideIcon;
}

export function KpiCard({
  title,
  amount,
  affectedCount,
  affectedLabel = "klaim/faktur",
  freshness,
  description,
  href,
  variant = "info",
  icon: Icon,
}: KpiCardProps) {
  const variantStyles = {
    danger: {
      border: "border-red-200 hover:border-red-300",
      badge: "bg-red-50 text-red-700 border-red-200",
      amountColor: "text-red-700",
      iconBg: "bg-red-50 text-red-600",
    },
    warning: {
      border: "border-amber-200 hover:border-amber-300",
      badge: "bg-amber-50 text-amber-800 border-amber-200",
      amountColor: "text-amber-700",
      iconBg: "bg-amber-50 text-amber-600",
    },
    info: {
      border: "border-blue-200 hover:border-blue-300",
      badge: "bg-blue-50 text-blue-800 border-blue-200",
      amountColor: "text-slate-900",
      iconBg: "bg-blue-50 text-blue-600",
    },
    success: {
      border: "border-emerald-200 hover:border-emerald-300",
      badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
      amountColor: "text-emerald-700",
      iconBg: "bg-emerald-50 text-emerald-600",
    },
  };

  const style = variantStyles[variant];

  const content = (
    <div
      className={`rounded-xl border bg-white p-5 shadow-2xs transition-all hover:shadow-md flex flex-col justify-between h-full ${style.border}`}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${style.iconBg}`}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold text-slate-700 tracking-tight">{title}</span>
          </div>
          {href && <ArrowUpRight className="h-4 w-4 text-slate-400" />}
        </div>

        <div className="mt-1">
          <div className={`text-2xl font-black font-mono-numbers tracking-tight ${style.amountColor}`}>
            {formatIDR(amount)}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-600 font-medium">
          <strong className="text-slate-900">{affectedCount}</strong> {affectedLabel}
        </span>
        <span className="text-[11px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
          {freshness}
        </span>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
