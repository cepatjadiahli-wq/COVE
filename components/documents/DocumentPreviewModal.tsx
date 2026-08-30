"use client";

import React, { useState } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, Download, FileText, CheckCircle2, Calculator, Settings } from "lucide-react";
import { BAPDocument } from "./BAPDocument";
import { ReceiptDocument } from "./ReceiptDocument";
import {
  calculateConstructionBillingBreakdown,
  LpjkQualification,
  terbilangIDR,
} from "@/lib/finance/construction-tax";
import { coveStore } from "@/domains/store/persistent-store";
import { useTenant } from "@/components/layout/TenantProvider";

interface DocumentPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claimId: string;
  projectId: string;
}

export function DocumentPreviewModal({
  open,
  onOpenChange,
  claimId,
  projectId,
}: DocumentPreviewModalProps) {
  const { currentOrg } = useTenant();
  const [docType, setDocType] = useState<"BAP" | "KUITANSI">("BAP");

  // Tax and Commercial Options State
  const [showTaxOptions, setShowTaxOptions] = useState(false);
  const [lpjkQualification, setLpjkQualification] = useState<LpjkQualification>("MENENGAH_BESAR");
  const [ppnPercent, setPpnPercent] = useState<number>(11);
  const [retentionPercent, setRetentionPercent] = useState<number>(5);
  const [advanceRecovery, setAdvanceRecovery] = useState<number>(0);

  // Look up claim, project, contract
  const claim = coveStore.claims.find((c) => c.id === claimId);
  const project = coveStore.projects.find((p) => p.id === projectId);
  const contract = coveStore.contracts.find((c) => c.projectId === projectId);
  const client = coveStore.clients.find((cl) => cl.id === project?.clientId);

  if (!claim || !project || !contract) {
    return null;
  }

  // Calculate previous cumulative certified claims
  const previousClaims = coveStore.claims.filter(
    (c) => c.projectId === projectId && c.id !== claim.id && c.claimNumber < claim.claimNumber
  );
  const previousCumulativeCertified = previousClaims.reduce((sum, c) => sum + (c.certifiedValue || 0), 0);

  // Calculate live breakdown with Indonesian Tax Engine
  const breakdown = calculateConstructionBillingBreakdown({
    contractValue: contract.currentContractValue || 35000000000,
    cumulativeCertifiedBefore: previousCumulativeCertified,
    currentCertifiedGross: claim.certifiedValue > 0 ? claim.certifiedValue : claim.claimedValue,
    retentionPercent,
    advanceRecoveryPercent: 0,
    customAdvanceDeduction: advanceRecovery,
    lpjkQualification,
    ppnPercent,
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="max-w-5xl w-full mx-auto max-h-[92vh] flex flex-col">
        {/* Header Bar */}
        <DialogHeader className="border-b border-slate-200 pb-3 flex flex-row items-center justify-between print:hidden">
          <div>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg font-black text-slate-900">
                Pusat Cetak Dokumen Legal Konstruksi
              </DialogTitle>
              <span className="text-xs bg-slate-900 text-white font-bold px-2 py-0.5 rounded">
                Standar LPJK / BUMN
              </span>
            </div>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              Generate dokumen BAP Tripartite resmi dan Kuitansi Tagihan siap cetak/tanda tangan
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTaxOptions(!showTaxOptions)}
              className="text-xs font-semibold gap-1.5 border-slate-300"
            >
              <Calculator className="h-3.5 w-3.5 text-slate-600" />
              <span>Pengaturan Pajak & Retensi</span>
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1.5"
            >
              <Printer className="h-4 w-4" />
              <span>Cetak / Simpan PDF</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Tab Selector & Tax Parameter Drawer */}
        <div className="bg-slate-50 p-3 border-b border-slate-200 print:hidden space-y-3">
          <div className="flex items-center justify-between">
            <Tabs value={docType} onValueChange={(val) => setDocType(val as any)}>
              <TabsList>
                <TabsTrigger value="BAP" className="text-xs font-bold gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  <span>1. Berita Acara Pembayaran (BAP) Tripartite</span>
                </TabsTrigger>
                <TabsTrigger value="KUITANSI" className="text-xs font-bold gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>2. Kuitansi Penagihan Resmi</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <span className="text-xs text-slate-500 font-mono">
              Nilai Bersih: <strong className="text-slate-900 font-bold">{formatIDR(breakdown.netPayableToContractor)}</strong>
            </span>
          </div>

          {/* Collapsible Tax & Commercial Parameters */}
          {showTaxOptions && (
            <div className="p-3.5 bg-white rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs animate-in fade-in-0">
              <div>
                <Label htmlFor="lpjk">Kualifikasi LPJK (PPh Final)</Label>
                <Select
                  id="lpjk"
                  value={lpjkQualification}
                  onChange={(e) => setLpjkQualification(e.target.value as LpjkQualification)}
                  className="mt-1"
                >
                  <option value="KECIL">Kecil (1.75%)</option>
                  <option value="MENENGAH_BESAR">Menengah / Besar (2.65%)</option>
                  <option value="SPESIALIS_KONSULTANSI">Konsultansi (3.50%)</option>
                  <option value="NON_KUALIFIKASI">Tanpa SBU (4.00%)</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="ppn">Tarif PPN (UU HPP)</Label>
                <Select
                  id="ppn"
                  value={String(ppnPercent)}
                  onChange={(e) => setPpnPercent(Number(e.target.value))}
                  className="mt-1"
                >
                  <option value="11">PPN 11%</option>
                  <option value="12">PPN 12%</option>
                  <option value="0">Non-PPN (0%)</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="retensi">Potongan Retensi (%)</Label>
                <Input
                  id="retensi"
                  type="number"
                  value={retentionPercent}
                  onChange={(e) => setRetentionPercent(Number(e.target.value))}
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <Label htmlFor="advrec">Amortisasi Uang Muka (IDR)</Label>
                <Input
                  id="advrec"
                  type="number"
                  value={advanceRecovery}
                  onChange={(e) => setAdvanceRecovery(Number(e.target.value))}
                  className="mt-1 font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Document Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 print:bg-white print:p-0 print:overflow-visible">
          {docType === "BAP" ? (
            <BAPDocument
              company={{
                name: currentOrg.name,
                legalName: currentOrg.legalName,
                address: `Jl. Raya Utama No. 88, Kav. 12`,
                city: `${currentOrg.city}, ${currentOrg.province}`,
                phone: "+62 21 5599 8812",
                email: "commercial@kontraktor.co.id",
                iujkNumber: "0220109928192-IUJK",
              }}
              project={{
                projectName: project.projectName,
                projectCode: project.projectCode,
                location: project.location,
                clientName: client?.clientName || "PT Husada Medika Sejahtera",
                consultantName: "PT Bina Karya Konsultan (MK)",
              }}
              contract={{
                contractNumber: contract.contractNumber,
                contractTitle: contract.contractTitle,
                startDate: project.contractStartDate,
                finishDate: project.contractFinishDate,
              }}
              claim={{
                claimNumber: claim.claimNumber,
                periodStart: claim.periodStart,
                periodEnd: claim.periodEnd,
              }}
              breakdown={breakdown}
            />
          ) : (
            <ReceiptDocument
              company={{
                name: currentOrg.name,
                legalName: currentOrg.legalName,
                address: `Jl. Raya Utama No. 88, Kav. 12`,
                city: `${currentOrg.city}, ${currentOrg.province}`,
                phone: "+62 21 5599 8812",
                email: "finance@kontraktor.co.id",
                bankName: "Bank Central Asia (BCA) KCU Thamrin",
                bankAccountNumber: "888-0912-3344",
                bankAccountHolder: currentOrg.legalName,
              }}
              client={{
                clientName: client?.clientName || "PT Husada Medika Sejahtera",
              }}
              receiptNumber={`KUI/${new Date().getFullYear()}/${project.projectCode}/${claim.claimNumber}`}
              amount={breakdown.netPayableToContractor}
              amountTerbilang={breakdown.netPayableTerbilang}
              description={`Pembayaran Termin Progress Claim ${claim.claimNumber} Proyek ${project.projectName} sesuai BAP No. BAP/${new Date().getFullYear()}/${project.projectCode}/${claim.claimNumber}`}
            />
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-3 border-t border-slate-200 bg-white print:hidden flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          <Button size="sm" onClick={handlePrint} className="bg-slate-900 text-white font-bold text-xs gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            <span>Cetak Dokumen Sekarang</span>
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  );
}
