"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatIDR } from "@/lib/utils";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import { Plus, Search, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { coveStore } from "@/domains/store/persistent-store";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function ProjectsPage() {
  const { t, language } = useLanguage();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");

  const projectsAttention = coveStore.getProjectsAttentionList();

  const filteredProjects = projectsAttention.filter((item) => {
    const matchesSearch =
      item.project.projectName.toLowerCase().includes(search.toLowerCase()) ||
      item.project.projectCode.toLowerCase().includes(search.toLowerCase()) ||
      item.project.city.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || item.project.status === statusFilter;
    const matchesRisk = riskFilter === "all" || item.riskLevel === riskFilter;

    return matchesSearch && matchesStatus && matchesRisk;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {language === "id" ? "Master Proyek Konstruksi" : "Projects Master"}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === "id" 
              ? "Monitoring portofolio kontrak, risiko Cash-at-Risk, dan performa penagihan per proyek" 
              : "Monitoring contract portfolio, cash-at-risk, and progress billing performance per project"}
          </p>
        </div>

        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs gap-1.5"
        >
          <Plus className="h-4 w-4" />
          <span>{language === "id" ? "Tambah Proyek Baru" : "New Project"}</span>
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={language === "id" ? "Cari nama proyek, kode, kota..." : "Search by project name, code, city..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-900"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 focus:bg-white focus:outline-none font-medium"
          >
            <option value="all">{language === "id" ? "Semua Status" : "All Statuses"}</option>
            <option value="active">{language === "id" ? "Aktif (Active)" : "Active"}</option>
            <option value="completed">{language === "id" ? "Selesai (Completed)" : "Completed"}</option>
            <option value="on_hold">{language === "id" ? "Ditangguhkan (On Hold)" : "On Hold"}</option>
          </select>

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 focus:bg-white focus:outline-none font-medium"
          >
            <option value="all">{language === "id" ? "Semua Tingkat Risiko" : "All Risk Levels"}</option>
            <option value="CRITICAL">{language === "id" ? "Kritis (Critical)" : "Critical"}</option>
            <option value="AT_RISK">{language === "id" ? "Berisiko (At Risk)" : "At Risk"}</option>
            <option value="WATCH">{language === "id" ? "Perhatian (Watch)" : "Watch"}</option>
            <option value="HEALTHY">{language === "id" ? "Sehat (Healthy)" : "Healthy"}</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-semibold">
          {language === "id" ? (
            <>Menampilkan <strong className="text-slate-900">{filteredProjects.length}</strong> proyek</>
          ) : (
            <>Showing <strong className="text-slate-900">{filteredProjects.length}</strong> projects</>
          )}
        </div>
      </div>

      {/* Projects Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">{language === "id" ? "Kode & Nama Proyek" : "Project Code & Name"}</th>
                <th className="py-3 px-4">{language === "id" ? "Klien / Pemberi Tugas" : "Client"}</th>
                <th className="py-3 px-4">{t("dash.attention.contract_value", "Nilai Kontrak")}</th>
                <th className="py-3 px-4">{t("dash.kpi.cash_at_risk", "Cash at Risk")}</th>
                <th className="py-3 px-4">{t("dash.attention.open_actions", "Tindakan Terbuka")}</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">{t("dash.attention.status", "Tingkat Risiko")}</th>
                <th className="py-3 px-4 text-right">{language === "id" ? "Aksi" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProjects.map((item) => {
                const client = coveStore.clients.find((c) => c.id === item.project.clientId);

                return (
                  <tr key={item.project.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/projects/${item.project.id}`}
                        className="font-bold text-slate-900 hover:underline block text-sm"
                      >
                        {item.project.projectName}
                      </Link>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {item.project.projectCode} • {item.project.projectType} • {item.project.city}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {client?.name || "-"}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {formatIDR(item.contractValue)}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-red-700">
                      {item.cashAtRisk > 0 ? formatIDR(item.cashAtRisk) : "Rp 0"}
                    </td>

                    <td className="py-3.5 px-4">
                      {item.openActionsCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {item.openActionsCount} {language === "id" ? "tindakan" : "actions"}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="capitalize text-slate-700 font-semibold px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {item.project.status === "active" ? (language === "id" ? "Aktif" : "Active") : item.project.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <RiskBadge level={item.riskLevel} size="sm" />
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link href={`/projects/${item.project.id}`}>
                        <Button variant="outline" size="sm" className="h-8 text-xs font-semibold gap-1">
                          <span>{language === "id" ? "Rincian" : "Detail"}</span>
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CreateProjectModal open={showCreateModal} onOpenChange={setShowCreateModal} />
    </div>
  );
}
