# COVE — Subscription State Machine Specification

**Document Version:** 1.0.0  
**Audit Date:** 4 September 2026  
**Reference Document:** `COVE_SUBSCRIPTION_BILLING_BLUEPRINT_v1.0.md` (Bagian 6, 7, 10, 11, 12)  

---

## 1. Definisi 11 Status Siklus Langganan (Subscription Lifecycle States)

Sistem langganan COVE menggunakan state machine deterministik dengan 11 status resmi. Setiap transisi status hanya boleh dipicu oleh:
1. **Verified Provider Event** (Webhook payment gateway terverifikasi).
2. **Scheduled Lifecycle Job** (Pemeriksa berkala cron/worker).
3. **Authorized Admin Action** (Tindakan manajemen terotorisasi dengan alasan bisnis & audit).
4. **Approved Migration** (Proses migrasi data yang disetujui).

```
                      ┌────────────────┐
                      │     DRAFT      │
                      └───────┬────────┘
                              │ Inisiasi Checkout
                              ▼
                      ┌────────────────┐
                      │PENDING_PAYMENT │◄──────────────────────┐
                      └───────┬────────┘                       │
         Pembayaran Berhasil  │   │ Gagal Bayar                │ Pembayaran
           (Paket Pilot)      │   │ / Batal                    │ Tagihan Baru
      ┌───────────────────────┘   └──────────────┐             │
      ▼                                          ▼             │
┌────────────┐   Pembayaran Berhasil   ┌────────────────┐      │
│PILOT_ACTIVE│────────────────────────►│     ACTIVE     │──────┤
└─────┬──────┘      (Paket Core/Scale) └───────┬────────┘      │
      │                                        │               │
      │ 45 Hari Habis                          │ Request Batal │
      │                                        ▼               │
      │                              ┌──────────────────┐      │
      │                              │CANCEL_AT_PERIOD_ │      │
      │                              │       END        │      │
      │                              └─────────┬────────┘      │
      │                                        │ Period End    │
      │                                        ▼               │
      │                              ┌──────────────────┐      │
      │         Gagal Bayar          │    CANCELLED     │      │
      │     (Hari H Billing Cycle)   └──────────────────┘      │
      │         ┌──────────────────────────────┘               │
      │         ▼                                              │
      │  ┌────────────┐                                        │
      │  │  PAST_DUE  │ (Grace Period: Hari H s/d H+7)         │
      │  └──────┬─────┘                                        │
      │         │ H+7 Grace Berakhir                           │
      │         ▼                                              │
      │  ┌────────────┐                                        │
      │  │ READ_ONLY  │ (H+7 s/d H+21: Lihat & Ekspor Data)    │
      │  └──────┬─────┘                                        │
      │         │ H+21 Lewat                                   │
      │         ▼                                              │
      │  ┌────────────┐                                        │
      │  │ SUSPENDED  │ (Penangguhan Layanan Penuh)            │
      │  └────────────┘                                        │
      │         ▲                                              │
      │         │                                              │
      ▼         │                                              │
┌────────────┐  │                                              │
│  EXPIRED   │──┘                                              │
└────────────┘                                                 │
                                                               │
┌────────────┐                                                 │
│MANUAL_GRANT│─────────────────────────────────────────────────┘
└────────────┘ (Akses Sementara Terotorisasi dengan Expiry)
```

---

## 2. Matriks Rinci 11 Status

| Status | Makna Bisnis | Hak Akses Operasional | Hak Ekspor Data | Hak Penagihan |
| :--- | :--- | :--- | :---: | :---: |
| **`DRAFT`** | Registrasi tenant atau inisiasi checkout belum selesai. | Tidak ada akses ke proyek atau modul COVE. Hanya dapat melihat halaman pricing dan profil organisasi. | Tidak | Belum aktif |
| **`PENDING_PAYMENT`** | Sesi checkout telah dibuat dan menunggu pembayaran dari gateway (QRIS/VA/Card). | Belum ada akses modul atau proyek. Tampilan layar menunggu verifikasi transaksi. | Tidak | Pending invoice |
| **`PILOT_ACTIVE`** | Program pendampingan berbayar (Paid Concierge Pilot 45 Hari) sedang berjalan. | Akses penuh modul P0 (5 Gap Ledger, Gatekeeper, Action Queue, Portfolio ROI) untuk 1 proyek aktif dan maks 10 user. | Penuh | Sekali bayar lunas |
| **`ACTIVE`** | Langganan B2B reguler aktif dan periode berjalan telah lunas terbayar. | Akses operasional penuh sesuai kuota paket (Core: 1 proyek; Scale: 5 proyek; Enterprise: custom) dan add-on aktif. | Penuh | Terjadwal auto-renew |
| **`CANCEL_AT_PERIOD_END`** | Pelanggan mengajukan pembatalan langganan berulang; pembatalan efektif pada akhir periode berjalan. | Tetap memiliki akses penuh hingga `current_period_end` tercapai. Sistem tidak memutus akses lebih awal. | Penuh | Tidak diperpanjang |
| **`PAST_DUE`** | Pembayaran auto-recurring gagal pada hari jatuh tempo; memasuki masa tenggang (*Grace Period* H+1 s/d H+7). | Akses operasional tetap PENUH selama masa tenggang 7 hari kalender untuk mencegah disrupsi proyek konstruksi. | Penuh | Dunning aktif |
| **`READ_ONLY`** | Masa tenggang 7 hari berakhir tanpa pembayaran; sistem mengunci fitur mutasi. | Pengguna hanya dapat MELIHAT data dan portofolio. Seluruh aksi create/update/delete/import diblokir server-side. | Penuh (Open Data Guarantee) | Tagihan outstanding |
| **`SUSPENDED`** | Akun menunggak lebih dari 21 hari (H+21). Layanan operasional ditangguhkan total. | Pengguna diarahkan ke layar Suspended Account dengan kontak Customer Success. Tidak dapat mengakses dashboard. | Terbatas via request admin | Suspended |
| **`CANCELLED`** | Langganan telah resmi dihentikan setelah akhir periode `CANCEL_AT_PERIOD_END` atau konfirmasi final. | Akses workflow operasional nonaktif. Data tetap disimpan aman (tidak dihapus sepihak). | Penuh via portal arsip | Nonaktif |
| **`EXPIRED`** | Periode masa berlaku program pilot 45 hari atau kontrak jangka waktu tetap telah berakhir tanpa perpanjangan. | Akses dialihkan ke mode review akhir (Pilot Scorecard Hari ke-45) dan penawaran konversi paket Core/Scale. | Penuh | Menunggu konversi |
| **`MANUAL_GRANT`** | Akses khusus yang diberikan langsung oleh Tim Legal/Direksi COVE (misal: sengketa, audit khusus, partner BUMN). | Akses sesuai parameter override eksplisit yang tercatat di database dengan tanggal kedaluwarsa (*expiry*). | Penuh | Non-billing / Invoice manual |

---

## 3. Spesifikasi Transisi State Machine

### Transisi T-01: Inisiasi Checkout (`DRAFT` $\rightarrow$ `PENDING_PAYMENT`)
* **Trigger:** Pelanggan memilih paket B2B di halaman `/pricing` atau portal billing dan menekan tombol "Lanjut ke Pembayaran".
* **Source:** Frontend Customer Billing Session via `POST /api/billing/checkout`.
* **Requirement:** Organisasi valid terdaftar, PIC dan email terverifikasi, paket dan interval penagihan dipilih.
* **Entitlement State:** Belum ada akses modul proyek (`entitlement_active = false`).
* **Audit Event:** `BILLING.CHECKOUT_INITIALIZED` (Mencatat `org_id`, `plan_id`, `amount`, `payment_method`).
* **Failure Handling:** Jika API gateway error, kembalikan HTTP 500/502 dengan pesan ramah dan tombol "Coba Lagi". Jangan ubah status organisasi.
* **Recovery:** Pelanggan dapat membuat ulang sesi checkout baru tanpa merusak data organisasi.
* **Notification:** Tampilan instruksi pembayaran (nomor Virtual Account / QRIS) di layar pengguna.

### Transisi T-02: Pembayaran Terverifikasi (`PENDING_PAYMENT` $\rightarrow$ `ACTIVE` atau `PILOT_ACTIVE`)
* **Trigger:** Gateway pembayaran berhasil menarik dana / konfirmasi settlement diterima via webhook.
* **Source:** `POST /api/webhooks/billing` (Event: `payment.succeeded` atau `subscription.activated`).
* **Requirement:** Signature HMAC SHA-256 webhook valid, payload berisi ID transaksi gateway yang cocok dengan invoice pending, nominal pembayaran tepat 100% sama dengan tagihan.
* **Entitlement State:** 
  - Jika paket `b2b_pilot` $\rightarrow$ Status `PILOT_ACTIVE` (1 Proyek aktif, 10 user, 45 hari masa berlaku).
  - Jika paket `b2b_core`/`scale`/`enterprise` $\rightarrow$ Status `ACTIVE` (Kuota proyek & fitur diaktifkan penuh sesuai paket).
* **Audit Event:** `SUBSCRIPTION.ACTIVATED` & `PAYMENT.SETTLED` (Mencatat `subscription_id`, `payment_id`, `amount`, `period_start`, `period_end`, `correlation_id`).
* **Failure Handling:** Jika pemrosesan basis data gagal di tengah jalan, transaksi di-rollback dan webhook event dicatat sebagai `FAILED_RETRYABLE` untuk diproses ulang oleh worker.
* **Recovery:** Idempotent replay melalui admin console atau auto-retry webhook dari gateway.
* **Notification:** Email konfirmasi aktivasi resmi & kuitansi PPN diterbitkan ke email Owner dan Billing Admin.

### Transisi T-03: Permintaan Pembatalan Mandiri (`ACTIVE` $\rightarrow$ `CANCEL_AT_PERIOD_END`)
* **Trigger:** Owner atau Billing Admin menekan tombol "Batalkan Langganan" di portal billing.
* **Source:** Customer Billing Portal via `POST /api/billing/subscription/cancel`.
* **Requirement:** Alasan pembatalan (*churn reason*) wajib diisi minimum 10 karakter; konfirmasi modal disetujui.
* **Entitlement State:** Akses operasional TETAP AKTIF 100% hingga tanggal `current_period_end`.
* **Audit Event:** `SUBSCRIPTION.CANCELLATION_SCHEDULED` (Mencatat `churn_reason`, `effective_cancellation_date`, `actor_id`).
* **Failure Handling:** Kembalikan error jika user bukan Owner/Billing Admin (`403 Forbidden`).
* **Recovery:** Pelanggan dapat membatalkan jadwal penghentian langganan (*Reactivate Subscription*) kapan saja sebelum `current_period_end`.
* **Notification:** Email notifikasi bahwa langganan tidak akan diperpanjang otomatis dan informasi tanggal akhir akses.

### Transisi T-04: Pembatalan Berlaku di Akhir Periode (`CANCEL_AT_PERIOD_END` $\rightarrow$ `CANCELLED`)
* **Trigger:** Waktu sistem melewati `current_period_end` pada langganan yang berstatus `CANCEL_AT_PERIOD_END`.
* **Source:** Scheduled Lifecycle Cron Job (`runSubscriptionLifecycleJob()`).
* **Requirement:** `NOW() >= current_period_end` dan tidak ada instruksi pembatalan pencabutan.
* **Entitlement State:** Seluruh modul operasional terkunci (*disabled*). Seluruh proyek aktif dialihkan ke status `read_only_archived`.
* **Audit Event:** `SUBSCRIPTION.CANCELLED` (Mencatat waktu efektif penghentian).
* **Failure Handling:** Jika worker gagal, job berikutnya akan mendeteksi record yang terlewat (*reconciliation sweep*).
* **Recovery:** Pelanggan dapat mengaktifkan kembali langganan kapan saja melalui tombol "Reactivate Account" di portal.
* **Notification:** Banner di aplikasi menginformasikan bahwa langganan telah berakhir dan menyediakan tombol ekspor data terbuka.

### Transisi T-05: Pembayaran Perpanjangan Gagal (`ACTIVE` $\rightarrow$ `PAST_DUE`)
* **Trigger:** Percobaan penarikan recurring payment pada tanggal jatuh tempo ditolak oleh bank / gagal didebit.
* **Source:** Gateway Webhook (`payment.failed`) atau Scheduled Auto-Debit Attempt.
* **Requirement:** Invoice siklus baru belum lunas pada `current_period_end`.
* **Entitlement State:** **Tetap PENUH selama masa tenggang 7 hari (*Grace Period*)**. `grace_period_end` dihitung `NOW() + 7 DAYS`.
* **Audit Event:** `SUBSCRIPTION.ENTERED_PAST_DUE` (Mencatat `failure_reason`, `grace_period_end`, `attempt_count`).
* **Failure Handling:** Catat detail kegagalan gateway (`error_code`, `decline_reason`) pada tabel `payment_attempts`.
* **Recovery:** Pembayaran manual via Virtual Account / ganti kartu kredit berhasil $\rightarrow$ Kembali ke `ACTIVE`.
* **Notification:** Email Peringatan Dunning (Hari H & H+3) ke Direktur/Finance: "Pembayaran perpanjangan gagal. Akses tetap aktif selama 7 hari masa tenggang."

### Transisi T-06: Masa Tenggang Berakhir (`PAST_DUE` $\rightarrow$ `READ_ONLY`)
* **Trigger:** Waktu sistem melewati `grace_period_end` (H+7 sejak kegagalan pertama) dan tagihan tetap belum lunas.
* **Source:** Scheduled Lifecycle Cron Job.
* **Requirement:** `NOW() > grace_period_end` dan `status = 'PAST_DUE'`.
* **Entitlement State:** **READ-ONLY GUARD AKTIF**. Seluruh mutasi data diblokir:
  - Dilarang membuat/mengedit proyek.
  - Dilarang mengimpor data Excel/CSV opname.
  - Dilarang memindahkan stage klaim atau override checklist.
  - Dilarang membuat tiket tindakan baru.
  - **HAK MELIHAT & EKSPOR DATA TETAP TERBUKA PENUH (Open Data Guarantee).**
* **Audit Event:** `SUBSCRIPTION.ENTERED_READ_ONLY` (Mencatat tanggal penguncian mutasi).
* **Failure Handling:** Jika ada request mutasi yang masuk, server-side guard mengembalikan HTTP `402 Payment Required` dengan payload rincian tagihan outstanding.
* **Recovery:** Pelunasan invoice outstanding $\rightarrow$ Langsung kembali ke status `ACTIVE` seketika.
* **Notification:** Alert bar merah di seluruh layar dashboard: "Akun berada dalam mode Baca-Saja karena keterlambatan pembayaran. Lunasi tagihan untuk membuka kembali akses operasional."

### Transisi T-07: Tunggakan Melewati 21 Hari (`READ_ONLY` $\rightarrow$ `SUSPENDED`)
* **Trigger:** Waktu sistem mencapai H+21 sejak kegagalan awal tanpa ada penyelesaian penagihan.
* **Source:** Scheduled Lifecycle Cron Job atau Manual Finance Enforcement.
* **Requirement:** Tunggakan $\ge 21$ hari kalender.
* **Entitlement State:** Akses dashboard dinonaktifkan. Pengguna yang login diarahkan ke rute `/suspended` dengan nomor kontak Customer Success & Tim Finance COVE.
* **Audit Event:** `SUBSCRIPTION.SUSPENDED` (Mencatat penangguhan total).
* **Failure Handling:** Pengalihan rute di level middleware/server guard.
* **Recovery:** Pembayaran manual atau negosiasi addendum pembayaran $\rightarrow$ Admin merestorasi akun.
* **Notification:** Email surat penangguhan layanan resmi (PDF) dikirimkan ke alamat korespondensi legal kontraktor.

### Transisi T-08: Akhir Masa Pilot 45 Hari (`PILOT_ACTIVE` $\rightarrow$ `EXPIRED`)
* **Trigger:** Waktu sistem mencapai hari ke-46 sejak aktivasi pilot berbayar.
* **Source:** Scheduled Lifecycle Cron Job.
* **Requirement:** `NOW() >= pilot_start_date + 45 DAYS`.
* **Entitlement State:** Akses operasional proyek dihentikan sementara; halaman dialihkan ke presentasi *Pilot Scorecard Hari ke-45* dan tombol pemilihan paket Core/Scale.
* **Audit Event:** `PILOT.COMPLETED` (Mencatat metrik akhir ROI, rasio keberhasilan, dan rekomendasi paket).
* **Failure Handling:** Jika ada negosiasi addendum pilot yang disetujui direksi, admin dapat menerbitkan `MANUAL_GRANT`.
* **Recovery:** Kontraktor memilih paket Core / Scale dan melakukan pembayaran $\rightarrow$ Menjadi `ACTIVE`.
* **Notification:** Notifikasi eksekutif penutupan pilot dan link unduh Laporan Audit ROI Tripartite.

### Transisi T-09: Pemberian Akses Khusus Terotorisasi (`ANY` $\rightarrow$ `MANUAL_GRANT`)
* **Trigger:** Otorisasi manual oleh Direktur COVE untuk perpanjangan sementara, audit sengketa perdata, atau integrasi khusus BUMN.
* **Source:** COVE Internal Admin Console via `POST /api/admin/billing/override`.
* **Requirement:** Dokumen otorisasi tertulis, PIC pemohon, alasan bisnis mutlak, batas waktu kedaluwarsa (*override expiry*) maks 30 hari.
* **Entitlement State:** Sesuai kuota dan fitur yang ditetapkan secara eksplisit pada tabel `subscription_overrides`.
* **Audit Event:** `SUBSCRIPTION.MANUAL_OVERRIDE_GRANTED` (Mencatat `approved_by`, `reason`, `expiry_date`, `granted_entitlements`).
* **Failure Handling:** Sistem menolak jika tidak ada tanggal kedaluwarsa atau alasan bisnis.
* **Recovery:** Expiry habis $\rightarrow$ Otomatis kembali ke status riil sebelumnya.
* **Notification:** Log audit dikirimkan otomatis ke tim compliance dan email Owner organisasi terkait.
