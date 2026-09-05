# COVE — Subscription Risk and Conflict Register

**Document Version:** 1.0.0  
**Audit Date:** 4 September 2026  
**Reference Document:** `COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md` (Bagian 3, 16, 22)  

---

## 1. Ikhtisar Manajemen Risiko Subscription

Pengembangan sistem penagihan dan langganan pada B2B SaaS bernilai tinggi seperti COVE mengandung risiko ganda: risiko finansial (*financial leakage / revenue loss*) dan risiko operasional konstruksi (*construction business disruption*). 

Keterlambatan pembayaran atau kesalahan pemutusan akses tidak boleh menyebabkan kontraktor kehilangan akses data BAP atau terhambat dalam penagihan termin miliaran rupiah kepada pemilik proyek. Oleh karena itu, seluruh risiko dipetakan secara ketat dalam register berikut:

---

## 2. Register Risiko & Strategi Mitigasi

| Risk ID | Kategori | Deskripsi Risiko | Dampak Finansial / Operasional | Probabilitas | Severity | Strategi Mitigasi & Pengendalian | Phase Penanganan |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :---: |
| **RISK-SUB-01** | **Keamanan** | Bypass pembayaran melalui manipulasi query parameter URL (`payment_success=true`). | Pengguna memperoleh akses penuh secara gratis tanpa membayar (*revenue loss*). | **Tinggi** | **KRITIS** | Hapus ketergantungan pada client redirect; aktivasi HANYA dilakukan melalui webhook server terverifikasi kriptografis. | Phase 14 & 15 |
| **RISK-SUB-02** | **Integritas Data** | Webhook diproses berulang kali tanpa idempotency constraint sehingga memicu double activation atau double invoice. | Data faktur ganda, pelaporan keuangan korup, sengketa tagihan dengan kontraktor. | **Tinggi** | **TINGGI** | Terapkan constraint unik `(provider, event_id)` pada tabel `webhook_events` dan transaction rollback jika event telah ada. | Phase 15 |
| **RISK-SUB-03** | **Komersial** | Kontraktor paket Core (kuota 1 proyek) bebas membuat proyek tak terbatas karena ketiadaan server-side guard. | Kerugian potensi pendapatan (*lost expansion revenue*) hingga ratusan juta rupiah. | **Tinggi** | **TINGGI** | Pasang `EntitlementMutationGuard` pada level `database-adapter.ts` dan API routes; tolak request dengan HTTP 402 bila kuota penuh. | Phase 14 |
| **RISK-SUB-04** | **Operasional** | Auto-debit gagal langsung memutus akses operasional lapangan di hari H tanpa masa tenggang (*grace period*). | Kontraktor murka, proyek terhambat pengajuan termin, risiko churn pelanggan tinggi. | **Sedang** | **KRITIS** | Berikan masa tenggang 7 hari kalender (*Grace Period*) dengan akses PENUH sebelum transisi ke `READ_ONLY` di H+7. | Phase 14 & 17 |
| **RISK-SUB-05** | **Tata Kelola Data** | Penghapusan data proyek atau klaim secara sepihak saat langganan dibatalkan atau berakhir. | Tuntutan hukum perdata dari kontraktor dan pelanggaran jaminan keterbukaan data (PRD 28.1). | **Rendah** | **FATAL** | Terapkan aturan mutlak: Data TIDAK PERNAH dihapus otomatis; proyek diarsipkan menjadi `READ_ONLY_ARCHIVED` dan siap diekspor selamanya. | Phase 14 & 16 |
| **RISK-SUB-06** | **Arsitektur** | Keterikatan erat (*tight coupling*) pada SDK/API Mayar menghambat integrasi Xendit untuk true recurring. | Pengerjaan ulang arsitektur besar-besaran di masa depan (*technical debt*). | **Tinggi** | **SEDANG** | Bungkus seluruh interaksi pembayaran di balik interface generik `PaymentProviderAdapter` (Prinsip 3.9). | Phase 15 |
| **RISK-SUB-07** | **Kepatuhan Hukum** | Penyimpanan kredensial kartu kredit mentah (PAN, CVV, masa berlaku) di database COVE. | Pelanggaran berat PCI-DSS, denda regulasi Bank Indonesia, risiko kebocoran data kartu. | **Rendah** | **FATAL** | Larangan mutlak penyimpanan kartu di server COVE. Seluruh tokenisasi kartu ditangani 100% oleh PCI-DSS Level 1 gateway. | Phase 13–15 |
| **RISK-SUB-08** | **Keamanan Tenant** | Pengguna dari Tenant A dapat mengintip tagihan, kuitansi, atau histori pembayaran milik Tenant B. | Kebocoran rahasia komersial antar kontraktor pesaing. | **Sedang** | **KRITIS** | Pasang Row Level Security (RLS) pada seluruh 16 tabel billing baru dengan policy berbasis `org_id` pengguna login. | Phase 14 |
| **RISK-SUB-09** | **Regresi Kode** | Perubahan pada model organisasi dan middleware mengganggu alur kerja 5 Gap Ledger Phase 1–12. | Kerusakan fitur inti Progress-to-Invoice yang telah tervalidasi 100%. | **Sedang** | **KRITIS** | Migrasi bersifat aditif murni (*additive only*); jalankan seluruh 22 test suite eksisting di setiap tahap integrasi. | Phase 14–19 |
| **RISK-SUB-10** | **Komersial** | Perselisihan sisa hari aktif saat kontraktor melakukan upgrade di tengah periode penagihan. | Keluhan penagihan tidak adil (*billing dispute*) dan friksi onboarding. | **Sedang** | **SEDANG** | Bangun mesin proration transparan yang menghitung selisih hari pemakaian secara prorata hingga digit rupiah terdekat. | Phase 16 |

---

## 3. Matriks Eskalasi & Rencana Tindakan Darurat

Jika salah satu risiko berstatus **KRITIS** atau **FATAL** terdeteksi pada fase implementasi mendatang:
1. **Freeze Feature Development:** Hentikan sementara pengerjaan modul baru.
2. **Execute Rollback:** Jika terjadi kegagalan skema basis data, jalankan skrip rollback pembersihan 16 tabel baru tanpa menyentuh tabel operasional konstruksi.
3. **Manual Override Activation:** Jika kontraktor pilot sah mengalami kendala akses akibat bug state machine, gunakan fitur `MANUAL_GRANT` berbatas waktu untuk memulihkan akses seketika selagi investigasi berlangsung.
