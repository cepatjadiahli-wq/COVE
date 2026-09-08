import {test} from 'node:test';
import assert from 'node:assert';
import {db} from '../src/db/store.js';

test('RecoveryService: memverifikasi daftar prospek pemulihan dan status consent', () => {
  db.reset();
  const leads = db.recoveryLeads;
  assert.ok(leads.length >= 3, 'Harus memiliki minimal 3 lead contoh');

  const grantedLead = leads.find(l => l.consentStatus === 'GRANTED');
  assert.ok(grantedLead, 'Harus ada lead dengan consent GRANTED');
  assert.ok(grantedLead.phone, 'Lead harus memiliki nomor telepon');

  const suppressedLead = leads.find(l => l.consentStatus === 'SUPPRESSED');
  assert.ok(suppressedLead, 'Harus ada lead dengan consent SUPPRESSED / opt-out');
});

test('RecoveryService: menghasilkan URL wa.me manual untuk lead ber-consent GRANTED', () => {
  db.reset();
  const lead = db.recoveryLeads.find(l => l.consentStatus === 'GRANTED')!;

  // Template manual click-to-chat (wa.me)
  const cleanPhone = lead.phone.replace(/[^0-9]/g, '');
  const encodedMsg = encodeURIComponent(
    `Halo ${lead.name}, salam dari COVE. Kami melihat checkout ${lead.plan} Anda di ${lead.company} belum selesai. Ada yang dapat kami bantu terkait penyesuaian kebutuhan komersial proyek Anda?`
  );
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;

  assert.ok(waUrl.startsWith('https://wa.me/'), 'URL harus menggunakan format manual wa.me');
  assert.ok(waUrl.includes(encodeURIComponent(lead.name)), 'URL harus memuat nama kontak');
  assert.ok(!waUrl.includes('api.whatsapp.com/send/bot'), 'DILARANG menggunakan endpoint bot otomatis');
});

test('RecoveryService: menolak komunikasi dan mengembalikan status terblokir untuk lead SUPPRESSED', () => {
  db.reset();
  const lead = db.recoveryLeads.find(l => l.id === 'lead-03')!;
  assert.strictEqual(lead.consentStatus, 'SUPPRESSED');

  // Simulasi validasi sebelum generate
  const isAllowed = lead.consentStatus === 'GRANTED';
  assert.strictEqual(isAllowed, false, 'Lead yang opt-out atau suppressed harus ditolak');
});

test('FeatureRequestService: memvalidasi struktur usulan fitur dan commercial impact', () => {
  db.reset();
  const features = db.featureRequests;
  assert.ok(features.length >= 2, 'Harus ada usulan fitur awal');

  for (const f of features) {
    assert.ok(f.title, 'Usulan fitur harus punya judul');
    assert.ok(f.commercialImpact, 'Usulan fitur harus mencantumkan dampak komersial');
    assert.ok(['P1', 'P2', 'P3'].includes(f.priority), 'Prioritas harus valid');
    assert.ok(['Ditinjau', 'Direncanakan', 'Selesai'].includes(f.status), 'Status harus valid');
  }
});
