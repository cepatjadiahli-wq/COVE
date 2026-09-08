import {test} from 'node:test';
import assert from 'node:assert';
import {LedgerService} from '../src/services/ledger.service.js';
import type {StageValues} from '../src/types/domain.js';

test('LedgerService: menghitung G1 s.d. G5 dan memvalidasi invarian identitas komersial', () => {
  // Sample: Gedung Meridian
  const values: StageValues = [1200000000, 1050000000, 900000000, 750000000, 600000000, 450000000];
  const metrics = LedgerService.calculateMetrics(values);

  // Assert G1 s.d. G5
  assert.strictEqual(metrics.gaps[0], 150000000, 'G1 (Belum diukur) harus 150 Jt');
  assert.strictEqual(metrics.gaps[1], 150000000, 'G2 (Belum diajukan) harus 150 Jt');
  assert.strictEqual(metrics.gaps[2], 150000000, 'G3 (Belum disetujui) harus 150 Jt');
  assert.strictEqual(metrics.gaps[3], 150000000, 'G4 (Belum ditagihkan) harus 150 Jt');
  assert.strictEqual(metrics.gaps[4], 150000000, 'G5 (Belum diterima) harus 150 Jt');

  // Assert Invariant: G1+G2+G3+G4+G5 = Work - Collected
  const totalGaps = metrics.gaps.reduce((sum, g) => sum + g, 0);
  const expectedTotal = values[0] - values[5]; // 1.2M - 450jt = 750jt
  assert.strictEqual(totalGaps, expectedTotal, 'Total G1..G5 harus sama dengan Work - Collected');
  assert.strictEqual(metrics.identityValid, true, 'Identitas komersial harus valid');
  assert.strictEqual(metrics.invalid, false, 'Tidak boleh ada anomali nilai');
});

test('LedgerService: mendeteksi anomali jika stage melebihi stage upstream', () => {
  // Nilai Diukur (1.5M) melompat melebihi Dikerjakan (1.2M)
  const abnormalValues: StageValues = [1200000000, 1500000000, 900000000, 750000000, 600000000, 450000000];
  const metrics = LedgerService.calculateMetrics(abnormalValues);

  assert.strictEqual(metrics.invalid, true, 'Harus mendeteksi anomali saat stage melebihi upstream');
  assert.strictEqual(metrics.identityValid, false, 'Identitas tidak valid jika ada anomali');
});
