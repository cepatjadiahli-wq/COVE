# COVE — Phase 13 Retrospective Audit Report

**Document Version:** 1.0.0  
**Audit Date:** 4 September 2026  
**Auditor:** Antigravity (Phase 16.5: Retrospective Subscription Audit & Recovery Gate)  
**Reference Commit Baseline:** `689cdae` (*"feat: complete COVE V1 12-phase MVP development release readiness"*)  
**Core Rules Applied:** Aturan Mutlak Phase 13 & 16.5 — *No hallucination, empirical evidence only, state "TIDAK DAPAT DIBUKTIKAN" where prior state lacks git evidence.*

---

## 1. Latar Belakang & Tujuan Rekonstruksi

Pengembangan sistem subscription COVE dirancang untuk memberikan pengalaman berlangganan kelas B2B SaaS konstruksi bernilai tinggi (layaknya Netflix B2B): aktivasi otomatis berbasis webhook, penegakan kuota proyek dan pengguna, siklus perpanjangan berkala, *grace period* saat gagal bayar, transisi otomatis ke *read-only* tanpa penghapusan data sepihak (*Open Data Guarantee*), dan pembatalan di akhir periode.

Sebelum Phase 14 dimulai, Phase 13 ditujukan untuk melakukan audit mendalam terhadap model komersial dan penagihan warisan (*legacy Mayar*), mengidentifikasi celah keamanan arsitektur, dan merumuskan blueprint penagihan resmi. Dokumen ini merekonstruksi temuan Phase 13 secara retrospektif dengan membandingkan repositori pada commit baseline `689cdae` dengan status repositori saat ini.

---

## 2. Kondisi Repositori Sebelum Phase 14 (Baseline Commit `689cdae`)

Berdasarkan analisis log Git (`git log -p 689cdae` dan `git diff 689cdae`), kondisi sistem penagihan sebelum Phase 14 adalah sebagai berikut:

### 2.1 Arsitektur Penagihan Warisan (*Legacy Mayar Integration*)
1. **Ketergantungan Vendor Tunggal (Vendor Lock-in):**
   - Penagihan hanya menggunakan SDK Mayar (`lib/mayar/client.ts`).
   - Tidak ada abstraksi antarmuka generik (`PaymentProviderAdapter`). Integrasi vendor lain seperti Xendit atau sandbox lokal tidak memungkinkan tanpa modifikasi langsung pada kode pemanggil.
2. **Celah Keamanan Redirect URL Bypass:**
   - Pada `app/api/payment/checkout/route.ts` (sebelum dimodifikasi), checkout menghasilkan tautan sukses:
     `checkoutUrl: ${appUrl}/dashboard?payment_success=true&tier=${normalizedTierId}`
   - **Risiko Kritis:** Pengguna dapat memalsukan aktivasi akun hanya dengan membuka URL `/dashboard?payment_success=true` tanpa melakukan pembayaran riil di gateway.
3. **Pencampuran Penagihan SaaS dengan Klaim Proyek Fisik:**
   - Pada `app/api/webhooks/mayar/route.ts` (sebelum dimodifikasi), webhook Mayar mencari faktur konstruksi di `coveStore.invoices` dan memanggil `coveStore.recordCashReceipt(...)`.
   - **Risiko Kritis:** Pembayaran langganan perangkat lunak (SaaS) bercampur dan mencemari pembukuan klaim progress proyek fisik klien (*construction progress claims*).
4. **Idempotensi Webhook Palsu / Lemah:**
   - Webhook Mayar lama mencatat transaksi dengan event ID acak bertanggal:
     `event_id: ${event}_${data.id}_${Date.now()}`
   - **Risiko Kritis:** Setiap replay webhook dari gateway menghasilkan ID baru, sehingga dapat memicu duplikasi aktivasi atau double recording.
5. **Paket Komersial Legacy (Lifetime Plan 799k):**
   - Terdapat tier `monthly_129k`, `annual_499k`, dan `lifetime_799k`.
   - PRD Bagian 28 & 35 secara tegas melarang penjualan *lifetime unlimited plan* bagi pelanggan baru karena merusak unit ekonomi SaaS B2B.

### 2.2 Kondisi Basis Data Sebelum Phase 14
- Basis data `supabase/schema.sql` memiliki 30 tabel inti operasional konstruksi (proyek, kontrak, import, klaim BAP, invoice konstruksi, action queue, snapshot ROI).
- Tabel penagihan yang ada hanyalah `public.mayar_transactions`.
- **Tidak ada** tabel untuk `plans`, `prices`, `plan_entitlements`, `subscriptions`, `billing_invoices`, `payments`, `webhook_events`, maupun `entitlement_snapshots`.
- Entitlement proyek hanya dicek via logic `canAddProject` di `onboarding/service.ts`, belum ditegakkan pada level server mutation guard di database adapter.

---

## 3. Rekonstruksi Dokumen Kendali Phase 13

Pada saat Phase 13 dijalankan, disusun 10 dokumen kendali arsitektur penagihan yang disimpan pada root dan `docs/`:

| No | Dokumen | Bukti Keberadaan | Status Isi |
| :-: | :--- | :--- | :---: |
| 1 | `COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md` | Root workspace | **ADA** (45 Halaman arsitektur komprehensif) |
| 2 | `docs/COVE_SUBSCRIPTION_CURRENT_STATE_AUDIT.md` | `docs/` | **ADA** (Audit 19 dimensi kondisi aktual) |
| 3 | `docs/COVE_SUBSCRIPTION_TRACEABILITY_MATRIX.md` | `docs/` | **ADA** (35 requirement blueprint terpetakan) |
| 4 | `docs/COVE_SUBSCRIPTION_ENTITLEMENT_MATRIX.md` | `docs/` | **ADA** (Matriks 4 tier B2B + 11 status akses) |
| 5 | `docs/COVE_SUBSCRIPTION_STATE_MACHINE.md` | `docs/` | **ADA** (Spesifikasi graf 11 status & trigger) |
| 6 | `docs/COVE_PAYMENT_PROVIDER_DECISION.md` | `docs/` | **ADA** (ADR multi-gateway adapter & Xendit/Mayar) |
| 7 | `docs/COVE_SUBSCRIPTION_RISK_REGISTER.md` | `docs/` | **ADA** (12 risiko operasional dan mitigasi) |
| 8 | `docs/COVE_SUBSCRIPTION_MIGRATION_PLAN.md` | `docs/` | **ADA** (Strategi migrasi aditif tanpa downtime) |
| 9 | `docs/COVE_SUBSCRIPTION_TEST_BASELINE.md` | `docs/` | **ADA** (26 skenario UAT khusus subscription) |
| 10 | `docs/COVE_PHASE_14_IMPLEMENTATION_PLAN.md` | `docs/` | **ADA** (Rencana detail 6 tugas Phase 14) |

---

## 4. Evaluasi Bukti Empiris: Apa yang Berubah Pasca Phase 13?

Berdasarkan inspeksi repositori aktual:
1. **Migration SQL Aditif:** `supabase/migrations/00006_subscription_foundation.sql` dibuat untuk menginjeksi 16 tabel baru tanpa merusak 30 tabel yang sudah ada.
2. **Eliminasi Redirect Bypass:** Berhasil diverifikasi pada `app/api/payment/checkout/route.ts` dan diuji secara empiris pada Suite 24 Test 6.
3. **Pemisahan Finansial:** Webhook Mayar di `app/api/webhooks/mayar/route.ts` berhasil dibersihkan dari pemanggilan `coveStore.invoices` dan `recordCashReceipt`.
4. **Adapter Generik:** Dibuat folder `domains/billing/adapters/` (Mock, Xendit, Mayar) yang mengimplementasikan `PaymentProviderAdapter`.
5. **Idempotensi Sejati:** Menggunakan `(provider, event_id)` unik dari gateway asli.

---

## 5. Pernyataan Kondisi yang TIDAK DAPAT DIBUKTIKAN

Sesuai aturan mutlak, item berikut dicatat secara jujur:
- **Kondisi Pengujian Integrasi Gateway Produksi Xendit/Mayar Riil:** Karena tidak tersedianya kredensial API live pada repositori lokal (hanya mock environment variable), interaksi jaringan live dengan server produksi Xendit/Mayar **TIDAK DAPAT DIBUKTIKAN SECARA EMPIRIS SAAT INI** selain melalui unit test mock adapter dan simulasi callback payload.
- **Kondisi Persistensi Cloud Supabase Live:** Repositori saat ini menggunakan memory database adapter fallback (`persistent-store.ts`) saat koneksi Supabase cloud tidak dikonfigurasi. Persistensi fisik ke server hosted Supabase **TIDAK DAPAT DIBUKTIKAN** pada local offline workstation.

---

## 6. Kesimpulan Rekonstruksi Phase 13

Phase 13 telah secara akurat mengidentifikasi seluruh cacat arsitektural sistem penagihan warisan (redirect bypass, pencampuran klaim fisik, vendor lock-in, dan ketiadaan RLS billing). Seluruh rekomendasi Phase 13 telah dijadikan acuan utama dalam eksekusi Phase 14, 15, dan 16.
