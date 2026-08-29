"use client";

import React, { useState } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIDR } from "@/lib/utils";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface InvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claimId: string;
  projectId: string;
  defaultGross?: number;
}

export function InvoiceModal({ open, onOpenChange, claimId, projectId, defaultGross = 2100000000 }: InvoiceModalProps) {
  const { refreshState } = useTenant();
  const { t, language } = useLanguage();
  const [invoiceNumber, setInvoiceNumber] = useState("INV-2026-MRD-007");
  const [grossAmount, setGrossAmount] = useState(defaultGross);
  const [retentionPercent, setRetentionPercent] = useState(5);
  const [advanceRecovery, setAdvanceRecovery] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [otherDeduction, setOtherDeduction] = useState(0);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]);

  const retentionAmount = Math.round((grossAmount * retentionPercent) / 100);
  const netReceivable = Math.max(0, grossAmount - retentionAmount - advanceRecovery - taxAmount - otherDeduction);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const invId = "inv-" + Math.random().toString(36).substring(2, 9);
    coveStore.invoices.push({
      id: invId,
      projectId,
      claimId,
      invoiceNumber,
      issueDate: new Date().toISOString().split("T")[0],
      dueDate,
      grossAmount,
      retentionAmount,
      advanceRecoveryAmount: advanceRecovery,
      taxAmount,
      otherDeductionAmount: otherDeduction,
      netReceivableAmount: netReceivable,
      cashReceivedAmount: 0,
      outstandingAmount: netReceivable,
      expectedPaymentDate: dueDate,
      status: "issued",
      financeOwnerId: "usr-rani",
    });

    coveStore.auditLogs.unshift({
      id: "aud-" + Math.random().toString(36).substring(2, 9),
      entityType: "invoice",
      entityId: invId,
      eventType: "INVOICE_CREATED",
      description: `Invoice ${invoiceNumber} issued for Net Receivable Rp ${netReceivable.toLocaleString("id-ID")}`,
      timestamp: new Date().toISOString(),
      user: "Rani Prameswari",
    });

    refreshState();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{language === "id" ? "Terbitkan Faktur / Invoice Tagihan" : "Issue Progress Invoice"}</DialogTitle>
        <DialogDescription>
          {language === "id" 
            ? "Konversikan nilai klaim yang telah disertifikasi menjadi faktur resmi dengan potongan retensi" 
            : "Convert certified progress values into formal billing with contractual retention deductions"}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="invnum">{t("inv.number", "Nomor Invoice")}</Label>
            <Input id="invnum" required value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="mt-1 font-mono" />
          </div>
          <div>
            <Label htmlFor="invdue">{t("inv.due_date", "Jatuh Tempo (Due Date)")}</Label>
            <Input id="invdue" type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1" />
          </div>
        </div>

        <div>
          <Label htmlFor="gross">{t("inv.gross", "Gross Amount (Nilai Sertifikasi BAP)")}</Label>
          <Input
            id="gross"
            type="number"
            required
            value={grossAmount}
            onChange={(e) => setGrossAmount(Number(e.target.value))}
            className="mt-1 font-mono font-bold"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="retpct">{language === "id" ? "Potongan Retensi (%)" : "Retention Rate (%)"}</Label>
            <Input
              id="retpct"
              type="number"
              value={retentionPercent}
              onChange={(e) => setRetentionPercent(Number(e.target.value))}
              className="mt-1 font-mono"
            />
          </div>
          <div>
            <Label htmlFor="advrec">{language === "id" ? "Pengembalian Uang Muka (IDR)" : "Advance Recovery (IDR)"}</Label>
            <Input
              id="advrec"
              type="number"
              value={advanceRecovery}
              onChange={(e) => setAdvanceRecovery(Number(e.target.value))}
              className="mt-1 font-mono"
            />
          </div>
        </div>

        {/* Calculated Net Receivable summary */}
        <div className="p-3.5 rounded-lg bg-slate-900 text-white space-y-1.5">
          <div className="flex justify-between text-[11px] text-slate-300">
            <span>{t("inv.gross", "Gross Amount")}:</span>
            <span className="font-mono">{formatIDR(grossAmount)}</span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-300">
            <span>{language === "id" ? `Retensi (${retentionPercent}%):` : `Retention (${retentionPercent}%):`}</span>
            <span className="font-mono">- {formatIDR(retentionAmount)}</span>
          </div>
          <div className="border-t border-slate-700 pt-1.5 flex justify-between font-bold text-sm text-emerald-400">
            <span>{t("inv.net", "Net Piutang (Net Receivable)")}:</span>
            <span className="font-mono">{formatIDR(netReceivable)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Batal")}
          </Button>
          <Button type="submit" className="bg-slate-900 text-white font-bold">
            {t("inv.create_invoice", "Terbitkan Invoice")}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
