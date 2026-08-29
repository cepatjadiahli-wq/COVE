"use client";

import React, { useState } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectModal({ open, onOpenChange }: CreateProjectModalProps) {
  const { refreshState } = useTenant();
  const { t, language } = useLanguage();
  const [projectCode, setProjectCode] = useState("PRJ-NEW-05");
  const [projectName, setProjectName] = useState("");
  const [clientId, setClientId] = useState(coveStore.clients[0]?.id || "");
  const [projectType, setProjectType] = useState("Commercial Building");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("Jakarta");
  const [contractValue, setContractValue] = useState(25000000000);
  const [startDate, setStartDate] = useState("2026-09-01");
  const [finishDate, setFinishDate] = useState("2027-08-31");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      alert(language === "id" ? "Nama proyek wajib diisi." : "Project name is required.");
      return;
    }

    const newProjId = "prj-" + Math.random().toString(36).substring(2, 9);
    coveStore.projects.push({
      id: newProjId,
      clientId,
      projectCode,
      projectName,
      projectType,
      location,
      city,
      contractStartDate: startDate,
      contractFinishDate: finishDate,
      currencyCode: "IDR",
      status: "active",
      projectManagerId: "usr-fajar",
      commercialManagerId: "usr-dimas",
      financeOwnerId: "usr-rani",
    });

    coveStore.contracts.push({
      id: "ctr-" + Math.random().toString(36).substring(2, 9),
      projectId: newProjId,
      contractNumber: "CTR-NB-" + projectCode,
      contractTitle: "Kontrak Utama " + projectName,
      originalContractValue: contractValue,
      currentContractValue: contractValue,
      paymentMethod: "Monthly Progress",
      paymentTermDays: 30,
      retentionPercent: 5.0,
    });

    coveStore.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      entityType: "project",
      entityId: newProjId,
      eventType: "PROJECT_CREATED",
      description: `Project ${projectName} (${projectCode}) created with contract value Rp ${contractValue.toLocaleString("id-ID")}`,
      timestamp: new Date().toISOString(),
      user: "Raka Pratama",
    });

    refreshState();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{language === "id" ? "Tambah Master Proyek Baru" : "Create New Project"}</DialogTitle>
        <DialogDescription>
          {language === "id" ? "Tambahkan master proyek baru beserta kontrak utama dan alokasi tim" : "Add a new project with its primary contract and team allocation"}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="code">{language === "id" ? "Kode Proyek" : "Project Code"}</Label>
            <Input id="code" required value={projectCode} onChange={(e) => setProjectCode(e.target.value)} className="mt-1 font-mono" />
          </div>
          <div>
            <Label htmlFor="client">{language === "id" ? "Klien / Pengembang" : "Client / Developer"}</Label>
            <Select id="client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="mt-1">
              {coveStore.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="pname">{language === "id" ? "Nama Proyek" : "Project Name"}</Label>
          <Input id="pname" required placeholder={language === "id" ? "Contoh: Menara Mandiri Tower 2" : "e.g. Mandiri Tower 2"} value={projectName} onChange={(e) => setProjectName(e.target.value)} className="mt-1" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="type">{language === "id" ? "Tipe Proyek" : "Project Type"}</Label>
            <Select id="type" value={projectType} onChange={(e) => setProjectType(e.target.value)} className="mt-1">
              <option value="Commercial Highrise">Commercial Highrise</option>
              <option value="Industrial Warehouse">Industrial Warehouse</option>
              <option value="Healthcare Facility">Healthcare Facility</option>
              <option value="Residential Township">Residential Township</option>
              <option value="Infrastructure">Infrastructure</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="city">{language === "id" ? "Kota / Lokasi" : "City / Location"}</Label>
            <Input id="city" required value={city} onChange={(e) => setCity(e.target.value)} className="mt-1" />
          </div>
        </div>

        <div>
          <Label htmlFor="cval">{language === "id" ? "Nilai Kontrak (IDR)" : "Contract Value (IDR)"}</Label>
          <Input
            id="cval"
            type="number"
            required
            value={contractValue}
            onChange={(e) => setContractValue(Number(e.target.value))}
            className="mt-1 font-mono"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="sdate">{language === "id" ? "Tanggal Mulai Kontrak" : "Contract Start Date"}</Label>
            <Input id="sdate" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="fdate">{language === "id" ? "Tanggal Selesai Kontrak" : "Contract Finish Date"}</Label>
            <Input id="fdate" type="date" required value={finishDate} onChange={(e) => setFinishDate(e.target.value)} className="mt-1" />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Batal")}
          </Button>
          <Button type="submit" className="bg-slate-900 font-bold">
            {t("common.save", "Simpan Proyek")}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
