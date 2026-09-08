import {test} from 'node:test';
import assert from 'node:assert';
import {db} from '../src/db/store.js';
import {MayarService} from '../src/services/mayar.service.js';

test('MayarService: memproses pembayaran SaaS dan mengaktifkan langganan', () => {
  db.reset();

  const payload = {
    event: 'payment.settled',
    id: 'evt_test_unique_001',
    data: {
      id: 'pay_001',
      amount: 4900000,
      customer_name: 'PT Ruang Karya Konstruksi',
      status: 'settled',
      plan_id: 'core'
    }
  };

  const result = MayarService.handleWebhook(payload);
  assert.strictEqual(result.status, 'PROCESSED');
  assert.strictEqual(db.subscription.status, 'ACTIVE');

  // Assert pemisahan domain: tidak memutasi cash_receipts atau stage Collected proyek
  const p1 = db.projects.find(p => p.id === 'p1')!;
  assert.strictEqual(p1.values[5], 450000000, 'Stage proyek tidak boleh berubah karena webhook SaaS');
});

test('MayarService: idempotensi menolak mutasi berulang untuk event ID yang sama', () => {
  const payload = {
    event: 'payment.settled',
    id: 'evt_test_unique_001', // ID sama dengan test sebelumnya
    data: {
      id: 'pay_001',
      amount: 4900000,
      status: 'settled'
    }
  };

  const result = MayarService.handleWebhook(payload);
  assert.strictEqual(result.status, 'DUPLICATE', 'Event ID duplikat harus dikenali sebagai DUPLICATE');
});
