/**
 * COVE Invoice & Cash Receipt Calculation Engine
 * Blueprint §32, §34, §35 & PRD §24, §25
 */

export interface InvoiceCalculationInput {
  grossAmount: number;
  retentionAmount?: number;
  advanceRecoveryAmount?: number;
  taxAmount?: number;
  otherDeductionAmount?: number;
  cashReceivedAmount?: number;
  dueDate: string | Date;
  status?: string;
}

export interface InvoiceCalculationResult {
  netReceivableAmount: number;
  cashReceivedAmount: number;
  outstandingAmount: number;
  computedStatus: "draft" | "issued" | "accepted" | "due" | "overdue" | "partially_paid" | "paid" | "disputed" | "cancelled";
  isOverdue: boolean;
  overdueDays: number;
}

export function calculateInvoiceFinancials(input: InvoiceCalculationInput): InvoiceCalculationResult {
  const gross = Math.max(0, input.grossAmount || 0);
  const retention = Math.max(0, input.retentionAmount || 0);
  const advanceRecovery = Math.max(0, input.advanceRecoveryAmount || 0);
  const tax = Math.max(0, input.taxAmount || 0);
  const otherDeduction = Math.max(0, input.otherDeductionAmount || 0);
  const cashReceived = Math.max(0, input.cashReceivedAmount || 0);

  // Net Receivable = Gross - Retention - Advance Recovery - Tax - Other Deductions
  const netReceivableAmount = Math.max(
    0,
    gross - retention - advanceRecovery - tax - otherDeduction
  );

  // Outstanding = MAX(Net Receivable - Cash Received, 0)
  const outstandingAmount = Math.max(0, netReceivableAmount - cashReceived);

  // Overdue check
  const dueDate = new Date(input.dueDate);
  const today = new Date();
  const isPastDue = today.getTime() > dueDate.getTime();
  const overdueDays = isPastDue
    ? Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  let computedStatus = (input.status as any) || "issued";

  if (computedStatus !== "cancelled" && computedStatus !== "disputed" && computedStatus !== "draft") {
    if (outstandingAmount === 0 && netReceivableAmount > 0) {
      computedStatus = "paid";
    } else if (cashReceived > 0 && outstandingAmount > 0) {
      computedStatus = "partially_paid";
    } else if (isPastDue && outstandingAmount > 0) {
      computedStatus = "overdue";
    } else {
      computedStatus = "issued";
    }
  }

  const isOverdue = computedStatus === "overdue" || (isPastDue && outstandingAmount > 0 && computedStatus !== "cancelled" && computedStatus !== "disputed");

  return {
    netReceivableAmount,
    cashReceivedAmount: cashReceived,
    outstandingAmount,
    computedStatus,
    isOverdue,
    overdueDays,
  };
}
