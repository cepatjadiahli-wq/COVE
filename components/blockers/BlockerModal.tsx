"use client";

import React, { useState } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BLOCKER_CATEGORY_LABELS, CONTROLLABILITY_LABELS } from "@/lib/constants";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface BlockerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claimId: string;
  projectId: string;
}

export function BlockerModal({ open, onOpenChange, claimId, projectId }: BlockerModalProps) {
  const { refreshState } = useTenant();
  const { t, language } = useLanguage();
  const [category, setCategory] = useState("consultant_review");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [exposure, setExposure] = useState(650000000);
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("high");
  const [controllability, setControllability] = useState<"internal" | "joint" | "external" | "not_software_addressable">("joint");
  const [ownerId, setOwnerId] = useState("usr-dimas");
  const [targetDate, setTargetDate] = useState(new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert(language === "id" ? "Judul blocker wajib diisi." : "Blocker title is required.");
      return;
    }

    coveStore.createBlocker({
      projectId,
      entityType: "claim",
      entityId: claimId,
      category,
      title,
      description,
      financialExposure: exposure,
      severity,
      controllability,
      ownerId,
      targetResolveDate: targetDate,
    });

    refreshState();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{language === "id" ? "Catat Economic Blocker" : "Record Economic Blocker"}</DialogTitle>
        <DialogDescription>
          {language === "id" 
            ? "Identifikasi kendala teknis atau komersial yang menahan pencairan nilai klaim" 
            : "Identify technical or commercial blockers impeding claim certification & cash release"}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="bcat">{language === "id" ? "Kategori Blocker" : "Blocker Category"}</Label>
          <Select id="bcat" value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1">
            {Object.entries(BLOCKER_CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="btitle">{language === "id" ? "Judul Blocker" : "Blocker Title"}</Label>
          <Input
            id="btitle"
            required
            placeholder={language === "id" ? "Contoh: Perbedaan Perhitungan Volume Fasade Lt 14-16" : "e.g. Quantity discrepancy on 14-16th floor facade"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="bdesc">{language === "id" ? "Deskripsi Detail & Kasus" : "Detailed Description & Context"}</Label>
          <Textarea
            id="bdesc"
            required
            placeholder={language === "id" ? "Jelaskan akar penyebab, selisih perhitungan, dan dokumen yang tertunda..." : "Describe root cause, discrepancy, and pending documentation..."}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="bexp">{language === "id" ? "Eksposur Finansial (IDR)" : "Financial Exposure (IDR)"}</Label>
            <Input
              id="bexp"
              type="number"
              required
              value={exposure}
              onChange={(e) => setExposure(Number(e.target.value))}
              className="mt-1 font-mono"
            />
          </div>
          <div>
            <Label htmlFor="bsev">{language === "id" ? "Tingkat Keparahan" : "Severity"}</Label>
            <Select id="bsev" value={severity} onChange={(e) => setSeverity(e.target.value as any)} className="mt-1">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="bctrl">{language === "id" ? "Kontrolabilitas" : "Controllability"}</Label>
            <Select id="bctrl" value={controllability} onChange={(e) => setControllability(e.target.value as any)} className="mt-1">
              {Object.entries(CONTROLLABILITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="bowner">{language === "id" ? "Penanggung Jawab" : "Responsible Owner"}</Label>
            <Select id="bowner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="mt-1">
              {coveStore.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({p.jobTitle})
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="btarget">{language === "id" ? "Target Selesai" : "Target Resolution Date"}</Label>
          <Input id="btarget" type="date" required value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="mt-1" />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Batal")}
          </Button>
          <Button type="submit" className="bg-red-700 text-white hover:bg-red-800 font-bold">
            {t("common.save", "Simpan Blocker")}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
