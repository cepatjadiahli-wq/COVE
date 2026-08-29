"use client";

import React, { useState } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatIDR } from "@/lib/utils";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface CashReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  maxOutstanding?: number;
}

export function CashReceiptModal({ open, onOpenChange, invoiceId, maxOutstanding = 595000000 }: CashReceiptModalProps) {
  const { refreshState } = useTenant();
  const { t, language } = useLanguage();
  const [receiptNumber, setReceiptNumber] = useState("CR-2026-0099");
  const [amount, setAmount] = useState(maxOutstanding);
  const [bankReference, setBankReference] = useState("BCA-TRF-99882");
  const [notes, setNotes] = useState("Pelunasan sisa termin invoice");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      alert(language === "id" ? "Jumlah penerimaan kas harus lebih besar dari 0." : "Receipt amount must be greater than 0.");
      return;
    }

    try {
      coveStore.recordCashReceipt({
        invoiceId,
        amount,
        receiptNumber,
        bankReference,
        notes,
        recordedBy: "usr-rani",
      });

      refreshState();
      onOpenChange(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{language === "id" ? "Catat Penerimaan Kas (Cash Receipt)" : "Record Cash Receipt"}</DialogTitle>
        <DialogDescription>
          {language === "id" 
            ? "Catat pelunasan atau pembayaran sebagian (termin) ke rekening bank proyek" 
            : "Record settlement or partial installment inflows into project bank accounts"}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <Label htmlFor="rcptnum">{language === "id" ? "Nomor Kuitansi / Bukti Kas Masuk" : "Receipt / Voucher Number"}</Label>
          <Input id="rcptnum" required value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} className="mt-1 font-mono" />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="rcptamt">{language === "id" ? "Jumlah Kas Masuk (IDR)" : "Cash Inflow Amount (IDR)"}</Label>
            <span className="text-[11px] text-slate-500">
              {language === "id" ? "Maksimum Sisa Piutang:" : "Max Outstanding:"} <strong className="text-slate-900 font-mono">{formatIDR(maxOutstanding)}</strong>
            </span>
          </div>
          <Input
            id="rcptamt"
            type="number"
            required
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="mt-1 font-mono text-base font-bold text-emerald-700"
          />
        </div>

        <div>
          <Label htmlFor="rcptref">{language === "id" ? "Referensi Bank / No. Transaksi" : "Bank Reference / Txn No"}</Label>
          <Input id="rcptref" required placeholder={language === "id" ? "Contoh: BCA-TRF-88992" : "e.g. BCA-TRF-88992"} value={bankReference} onChange={(e) => setBankReference(e.target.value)} className="mt-1 font-mono" />
        </div>

        <div>
          <Label htmlFor="rcptnotes">{language === "id" ? "Catatan Pembayaran" : "Payment Notes"}</Label>
          <Textarea id="rcptnotes" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Batal")}
          </Button>
          <Button type="submit" className="bg-emerald-700 text-white hover:bg-emerald-800 font-bold">
            {language === "id" ? "Simpan Penerimaan Kas" : "Save Cash Receipt"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
