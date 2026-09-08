// ============================================================================
// COVE Backend — Cash Receipt & Allocation Service v2.1
// Acuan: COVE_ERD_v2.0_Logical_Data_Model.md §6
// ============================================================================

import {db} from '../db/store.js';
import type {ReceiptAllocationInput} from '../types/domain.js';

export interface RecordReceiptInput {
  projectId: string;
  amount: number;
  receivedDate: string;
  bankReference: string;
  allocations: ReceiptAllocationInput[];
}

export class ReceiptService {
  /**
   * Memvalidasi dan mengeksekusi alokasi penerimaan kas bank terhadap pokok tagihan proyek
   */
  public static processReceipt(input: RecordReceiptInput): {
    success: boolean;
    error?: string;
    totalAllocated?: number;
    unallocated?: number;
  } {
    const {projectId, amount, bankReference, allocations} = input;

    if (!Number.isFinite(amount) || amount <= 0) {
      return {success: false, error: 'Masukkan nominal penerimaan lebih dari nol.'};
    }
    if (!bankReference.trim()) {
      return {success: false, error: 'Referensi bank wajib diisi.'};
    }

    const project = db.projects.find(p => p.id === projectId);
    if (!project) {
      return {success: false, error: 'Proyek tidak ditemukan.'};
    }

    const outstandingInvoices = db.invoices.filter(
      i => i.projectId === projectId && i.paid < i.principal
    );

    let totalAllocated = 0;

    // Validasi setiap alokasi
    for (const alloc of allocations) {
      if (!alloc.amount || alloc.amount <= 0) continue;

      const invoice = outstandingInvoices.find(i => i.id === alloc.invoiceId);
      if (!invoice) {
        return {success: false, error: `Invoice ID ${alloc.invoiceId} tidak ditemukan pada proyek ini.`};
      }

      const remaining = invoice.principal - invoice.paid;
      if (alloc.amount > remaining) {
        return {
          success: false,
          error: `Alokasi untuk ${invoice.number} (${alloc.amount}) melebihi sisa pokok (${remaining}).`
        };
      }

      totalAllocated += alloc.amount;
    }

    if (totalAllocated === 0) {
      return {success: false, error: 'Pilih sedikitnya satu alokasi invoice dengan nilai lebih dari nol.'};
    }

    if (totalAllocated > amount) {
      return {success: false, error: 'Total alokasi melebihi total kas yang diterima.'};
    }

    // Eksekusi mutasi
    for (const alloc of allocations) {
      if (!alloc.amount || alloc.amount <= 0) continue;
      const invoice = db.invoices.find(i => i.id === alloc.invoiceId)!;
      invoice.paid += alloc.amount;
    }

    // Perbarui nilai Diterima (Stage 6) pada proyek
    project.values[5] += totalAllocated;
    project.updated = '8 Sep 2026, 09.50';

    db.save();

    const unallocated = amount - totalAllocated;

    return {
      success: true,
      totalAllocated,
      unallocated
    };
  }
}
