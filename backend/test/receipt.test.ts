import {test} from 'node:test';
import assert from 'node:assert';
import {db} from '../src/db/store.js';
import {ReceiptService} from '../src/services/receipt.service.js';

test('ReceiptService: mengeksekusi alokasi kas yang valid dan memperbarui sisa pokok', () => {
  db.reset();

  // Invoice i1: principal 300 Jt, paid 220 Jt, sisa 80 Jt
  const result = ReceiptService.processReceipt({
    projectId: 'p1',
    amount: 50000000,
    receivedDate: '2026-09-08',
    bankReference: 'BCA-TEST-001',
    allocations: [
      {invoiceId: 'i1', amount: 50000000}
    ]
  });

  assert.strictEqual(result.success, true, 'Alokasi harus berhasil');
  assert.strictEqual(result.totalAllocated, 50000000);
  assert.strictEqual(result.unallocated, 0);

  const updatedInvoice = db.invoices.find(i => i.id === 'i1')!;
  assert.strictEqual(updatedInvoice.paid, 270000000, 'Paid invoice harus bertambah 50 Jt menjadi 270 Jt');

  const updatedProject = db.projects.find(p => p.id === 'p1')!;
  assert.strictEqual(updatedProject.values[5], 500000000, 'Stage Collected proyek harus bertambah 50 Jt menjadi 500 Jt');
});

test('ReceiptService: menolak alokasi yang melebihi sisa pokok invoice', () => {
  db.reset();

  // Invoice i1: sisa 80 Jt, mencoba alokasi 100 Jt
  const result = ReceiptService.processReceipt({
    projectId: 'p1',
    amount: 100000000,
    receivedDate: '2026-09-08',
    bankReference: 'BCA-TEST-002',
    allocations: [
      {invoiceId: 'i1', amount: 100000000}
    ]
  });

  assert.strictEqual(result.success, false, 'Alokasi harus ditolak');
  assert.match(result.error || '', /melebihi sisa pokok/);
});

test('ReceiptService: menolak alokasi yang melebihi total kas yang diterima', () => {
  db.reset();

  // Menerima 40 Jt tapi alokasi 70 Jt
  const result = ReceiptService.processReceipt({
    projectId: 'p1',
    amount: 40000000,
    receivedDate: '2026-09-08',
    bankReference: 'BCA-TEST-003',
    allocations: [
      {invoiceId: 'i1', amount: 70000000}
    ]
  });

  assert.strictEqual(result.success, false, 'Alokasi harus ditolak jika melebihi kas masuk');
  assert.match(result.error || '', /melebihi total kas/);
});
