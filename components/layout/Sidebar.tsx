"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  TrendingUp,
  CheckSquare,
  BarChart3,
  Database,
  MessageSquarePlus,
  Settings,
  ShieldCheck,
  Rocket,
  Compass,
  Users,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTenant } from "./TenantProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function Sidebar() {
  const pathname = usePathname();
  const { currentOrg, currentUser } = useTenant();
  const { t } = useLanguage();
  const isInternalAdmin = currentUser.role === "OWNER" || currentUser.role === "ADMIN";

  const mainNavItems = [
    { label: t("nav.command_center", "Pusat Kendali"), href: "/dashboard", icon: LayoutDashboard },
    { label: t("nav.projects", "Proyek"), href: "/projects", icon: Building2 },
    { label: t("nav.progress_to_cash", "Progres ke Kas"), href: "/progress-to-cash", icon: TrendingUp },
    { label: t("nav.subcontractors", "Kontrol Mandor & Subkon"), href: "/subcontractors", icon: Users },
    { label: t("nav.actions", "Daftar Tindakan"), href: "/actions", icon: CheckSquare },
    { label: t("nav.reports", "Laporan"), href: "/reports", icon: BarChart3 },
    { label: t("nav.data_imports", "Data & Impor"), href: "/data", icon: Database },
    { label: t("nav.feedback", "Umpan Balik"), href: "/feedback", icon: MessageSquarePlus },
  ];

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-slate-200 bg-white min-h-screen select-none">
      {/* Brand Header */}
      <div className="flex h-16 items-center px-6 border-b border-slate-200 gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-base shadow-sm">
          C
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-lg text-slate-950 tracking-tight">COVE</span>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200">
              v1.0
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-medium truncate max-w-[130px]" title={currentOrg.name}>
            {currentOrg.name}
          </span>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {t("nav.economic_engine", "Mesin Ekonomi")}
        </div>
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-slate-900 text-white font-semibold shadow-xs"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-slate-500")} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="pt-5 px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {t("nav.pilot_operations", "Operasional Pilot")}
        </div>
        <Link
          href="/onboarding"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/onboarding"
              ? "bg-slate-900 text-white font-semibold shadow-xs"
              : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          )}
        >
          <Rocket className={cn("h-4 w-4 shrink-0", pathname === "/onboarding" ? "text-white" : "text-emerald-600")} />
          <span>{t("nav.pilot_onboarding", "Panduan Onboarding")}</span>
        </Link>

        {isInternalAdmin && (
          <Link
            href="/internal/pilots"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/internal/pilots"
                ? "bg-slate-900 text-white font-semibold shadow-xs"
                : "text-amber-900 hover:bg-amber-50 hover:text-amber-950 font-semibold"
            )}
          >
            <Compass className={cn("h-4 w-4 shrink-0", pathname === "/internal/pilots" ? "text-white" : "text-amber-600")} />
            <span>{t("nav.pilot_admin_portal", "Portal Admin Pilot")}</span>
          </Link>
        )}

        <div className="pt-5 px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {t("nav.system", "Sistem")}
        </div>
        <Link
          href="/billing"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/billing"
              ? "bg-slate-900 text-white font-semibold shadow-xs"
              : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          )}
        >
          <CreditCard className={cn("h-4 w-4 shrink-0", pathname === "/billing" ? "text-white" : "text-slate-500")} />
          <span>{t("nav.billing", "Langganan & Billing")}</span>
        </Link>
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname === "/settings"
              ? "bg-slate-900 text-white font-semibold shadow-xs"
              : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          )}
        >
          <Settings className={cn("h-4 w-4 shrink-0", pathname === "/settings" ? "text-white" : "text-slate-500")} />
          <span>{t("nav.settings", "Pengaturan")}</span>
        </Link>
      </div>

      {/* RLS & Multi-tenant status footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/70">
        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <div className="flex flex-col text-[11px] leading-tight">
            <span className="font-semibold text-slate-900">{t("nav.tenant_isolated", "Tenant Terisolasi")}</span>
            <span className="text-slate-500">{t("nav.rls_active", "PostgreSQL RLS Aktif")}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
