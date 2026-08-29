"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Bell, Search, MessageSquarePlus, CheckCircle2, ChevronDown, Globe } from "lucide-react";
import { useTenant } from "./TenantProvider";
import { ROLE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { coveStore } from "@/domains/store/persistent-store";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function TopBar() {
  const { currentOrg, currentUser, allProfiles, setCurrentUserById } = useTenant();
  const { language, setLanguage, t } = useLanguage();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const notifications = coveStore.notifications;
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur-xs">
      {/* Search Input */}
      <div className="flex items-center gap-3 w-72 lg:w-96">
        <div className="relative w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={t("topbar.search_placeholder", "Cari proyek, klaim (MC-006), faktur, tindakan...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-4 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all text-slate-900"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Language Switcher */}
        <div className="relative">
          <button
            onClick={() => {
              setShowLangMenu(!showLangMenu);
              setShowUserMenu(false);
              setShowNotifMenu(false);
            }}
            className="flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            title={t("topbar.language", "Bahasa")}
          >
            <Globe className="h-3.5 w-3.5 text-slate-500" />
            <span className="uppercase">{language}</span>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>

          {showLangMenu && (
            <div className="absolute right-0 mt-2 w-36 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl z-50 animate-in fade-in-0 zoom-in-95">
              <button
                onClick={() => {
                  setLanguage("id");
                  setShowLangMenu(false);
                }}
                className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                  language === "id"
                    ? "bg-slate-900 text-white font-bold"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span>🇮🇩</span>
                  <span>Indonesia</span>
                </span>
                {language === "id" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
              </button>

              <button
                onClick={() => {
                  setLanguage("en");
                  setShowLangMenu(false);
                }}
                className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors mt-0.5 ${
                  language === "en"
                    ? "bg-slate-900 text-white font-bold"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span>🇬🇧</span>
                  <span>English</span>
                </span>
                {language === "en" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
              </button>
            </div>
          )}
        </div>

        {/* Quick Send Feedback Button */}
        <Link href="/feedback">
          <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-1.5 text-xs text-slate-700">
            <MessageSquarePlus className="h-3.5 w-3.5 text-slate-500" />
            <span>{t("topbar.feedback", "Beri Masukan")}</span>
          </Button>
        </Link>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifMenu(!showNotifMenu);
              setShowUserMenu(false);
              setShowLangMenu(false);
            }}
            className="relative flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            title={t("topbar.notifications", "Notifikasi")}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 rounded-lg border border-slate-200 bg-white p-3 shadow-xl z-50 animate-in fade-in-0 zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                <span className="text-xs font-bold text-slate-900">{t("topbar.notifications", "Notifikasi")} ({unreadCount})</span>
                <span className="text-[10px] text-slate-500 font-medium">{t("topbar.auto_trigger", "Auto-trigger SLA & Overdue")}</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-2 rounded bg-slate-50 border border-slate-100 text-xs hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-900">{n.title}</span>
                      <span className="text-[10px] text-red-600 font-bold uppercase">{n.priority}</span>
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Persona Switcher / User Menu */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifMenu(false);
              setShowLangMenu(false);
            }}
            className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50/80 py-1.5 px-3 hover:bg-slate-100 text-left"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              {currentUser.fullName.charAt(0)}
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-xs font-bold text-slate-900 leading-none">{currentUser.fullName}</span>
              <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                {ROLE_LABELS[currentUser.role]}
              </span>
            </div>
            <ChevronDown className="h-3 w-3 text-slate-400 ml-1" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-xl z-50 animate-in fade-in-0 zoom-in-95">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  {t("topbar.switch_role", "Switch Persona / Role")}
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t("topbar.switch_role_desc", "Test COVE with different organizational permissions:")}
                </p>
              </div>
              <div className="space-y-1">
                {allProfiles.map((p) => {
                  const isSelected = p.id === currentUser.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setCurrentUserById(p.id);
                        setShowUserMenu(false);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2 rounded text-xs transition-colors ${
                        isSelected
                          ? "bg-slate-900 text-white font-semibold"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex flex-col text-left">
                        <span>{p.fullName}</span>
                        <span className={`text-[10px] ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                          {ROLE_LABELS[p.role]} ({p.jobTitle})
                        </span>
                      </div>
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
