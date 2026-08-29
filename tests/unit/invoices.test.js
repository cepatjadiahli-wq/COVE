const assert = require("assert");

function calculateInvoiceFinancials(input) {
  const gross = Math.max(0, input.grossAmount || 0);
  const retention = Math.max(0, input.retentionAmount || 0);
  const advanceRecovery = Math.max(0, input.advanceRecoveryAmount || 0);
  const tax = Math.max(0, input.taxAmount || 0);
  const otherDeduction = Math.max(0, input.otherDeductionAmount || 0);
  const cashReceived = Math.max(0, input.cashReceivedAmount || 0);

  const netReceivableAmount = Math.max(
    0,
    gross - retention - advanceRecovery - tax - otherDeduction
  );
  const outstandingAmount = Math.max(0, netReceivableAmount - cashReceived);

  const dueDate = new Date(input.dueDate);
  const today = new Date();
  const isPastDue = today.getTime() > dueDate.getTime();

  let computedStatus = input.status || "issued";

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

  const isOverdue = computedStatus === "overdue" || (isPastDue && outstandingAmount > 0);

  return {
    netReceivableAmount,
    cashReceivedAmount: cashReceived,
    outstandingAmount,
    computedStatus,
    isOverdue,
  };
}

function runInvoiceTests() {
  console.log("▶ Running tests/unit/invoices.test.js...");

  // Test Case 1: Net receivable with 5% retention
  const inv1 = calculateInvoiceFinancials({
    grossAmount: 2000000000,
    retentionAmount: 100000000, // 5%
    advanceRecoveryAmount: 50000000,
    taxAmount: 20000000,
    cashReceivedAmount: 0,
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
  });
  assert.strictEqual(inv1.netReceivableAmount, 1830000000, "Net receivable should be 1.83B");
  assert.strictEqual(inv1.outstandingAmount, 1830000000);
  assert.strictEqual(inv1.computedStatus, "issued");

  // Test Case 2: Partial payment
  const inv2 = calculateInvoiceFinancials({
    grossAmount: 1000000000,
    retentionAmount: 50000000,
    cashReceivedAmount: 400000000,
    dueDate: new Date(Date.now() + 10 * 86400000).toISOString(),
  });
  assert.strictEqual(inv2.netReceivableAmount, 950000000);
  assert.strictEqual(inv2.outstandingAmount, 550000000);
  assert.strictEqual(inv2.computedStatus, "partially_paid");

  // Test Case 3: Full payment (Paid status)
  const inv3 = calculateInvoiceFinancials({
    grossAmount: 1000000000,
    retentionAmount: 50000000,
    cashReceivedAmount: 950000000,
    dueDate: new Date(Date.now() + 10 * 86400000).toISOString(),
  });
  assert.strictEqual(inv3.outstandingAmount, 0);
  assert.strictEqual(inv3.computedStatus, "paid");

  // Test Case 4: Overdue invoice detection
  const inv4 = calculateInvoiceFinancials({
    grossAmount: 1000000000,
    cashReceivedAmount: 0,
    dueDate: new Date(Date.now() - 10 * 86400000).toISOString(), // 10 days ago
  });
  assert.strictEqual(inv4.isOverdue, true, "Should be flagged as overdue");
  assert.strictEqual(inv4.computedStatus, "overdue");

  console.log("✔ Invoice & Cash Receipt Engine unit tests passed!");
}

module.exports = { runInvoiceTests };
if (require.main === module) runInvoiceTests();
