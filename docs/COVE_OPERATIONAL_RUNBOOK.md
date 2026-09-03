# COVE V1 — OPERATIONAL RUNBOOK (SOP OPERASIONAL SISTEM)
**Panduan Pemeliharaan, Pencadangan, Pemantauan, dan Tanggap Darurat**  
*Untuk: Tim DevOps, System Administrator, dan Lead Engineer*  
*Versi:* 1.0 (Release-Ready) • *Tanggal Efektif:* 4 September 2026

---

## 1. Arsitektur Komponen & Titik Layanan

```
+-------------------------------------------------------------------------+
|                          KLIEN BROWSER PENGGUNA                         |
|      (Desktop / Tablet di Kantor Proyek & Lapangan - HTTPS TLS 1.3)     |
+------------------------------------+------------------------------------+
                                     |
                                     v
+------------------------------------+------------------------------------+
|                         NEXT.JS 16 LTS APP                              |
|   (App Router, Server Components, API Handlers, State Persistence Store)|
+------------------------------------+------------------------------------+
                                     |
                                     v
+------------------------------------+------------------------------------+
|                      POSTGRESQL 15+ (SUPABASE)                          |
|  - 30 Tabel Data dengan Multi-Tenant Row-Level Security (RLS)           |
|  - Trigger Immutability Audit Trail (Anti-Tampering)                   |
|  - Session Token Blacklist Storage                                      |
+-------------------------------------------------------------------------+
```

---

## 2. Prosedur Pencadangan & Pemulihan (Backup & Disaster Recovery)

### 2.1 Jadwal & Mekanisme Pencadangan
1. **Pencadangan Basis Data Harian (Automated Daily Snapshot):**
   - Dikelola melalui Supabase Automated Backup dengan retensi point-in-time recovery (PITR) 7 hari.
   - Dilakukan setiap hari pukul 02:00 WIB di luar jam operasional kontraktor.
2. **Pencadangan Mandiri Tingkat Tenant (On-Demand Tenant JSON Export):**
   - Setiap tenant administrator memiliki hak mengunduh salinan penuh seluruh data organisasinya kapan saja via endpoint / method `exportFullTenantData(orgId)`.
   - Format: File JSON terbuka terstruktur yang mencakup proyek, klaim, gap ledger, tindakan, invoice, checklist, dan scorecard.

### 2.2 Prosedur Pemulihan Bencana (Disaster Recovery RTO & RPO)
* **Target RTO (Recovery Time Objective):** &lt; 2 jam.
* **Target RPO (Recovery Point Objective):** &lt; 24 jam (maksimal 1 hari kerja).
* **Langkah Pemulihan Database:**
  1. Akses Supabase Management Console &gt; Settings &gt; Database &gt; Backups.
  2. Pilih snapshot cadangan terverifikasi sebelum insiden terjadi.
  3. Konfirmasi restorasi ke staging instance untuk pengujian konsistensi data sebelum diarahkan ke production.
  4. Jalankan script verifikasi konsistensi saldo:
     ```powershell
     node tests/runner.js
     ```

---

## 3. Pemantauan Kesehatan Sistem & Kinerja (Health Checks & Monitoring)

### 3.1 Endpoint Pemeriksaan Kesehatan
* **Route:** `GET /api/health`
* **Kriteria Respons:**
  - Status Code: `200 OK`
  - Response Time: &lt; 200 ms
  - Payload format:
    ```json
    {
      "status": "healthy",
      "version": "1.0.0",
      "database": "connected",
      "timestamp": "2026-09-04T01:00:00Z"
    }
    ```

### 3.2 Metrik Kinerja Kunci (SLO / SLA)
* **Waktu Muat Global Search:** &lt; 2 detik untuk pencarian multi-entitas (PRD 21.1 / PLT-013).
* **Waktu Eksekusi Rekonsiliasi Impor:** &lt; 60 detik untuk file 5.000 baris (PRD 21.1 / IMP-016).
* **Ketersediaan Layanan (Uptime):** 99.5% pada jam kerja aktif kontraktor (07:00 – 19:00 WIB).

---

## 4. Prosedur Tanggap Darurat & Keamanan (Incident Response SOP)

### 4.1 Penonaktifan Pengguna & Pencabutan Sesi Seketika (UAT-18)
Bila terjadi insiden keamanan (misal: perangkat staf hilang, pemutusan hubungan kerja, atau indikasi penyusupan akun):
1. Admin Organisasi membuka menu **Pengaturan &gt; Manajemen Pengguna**.
2. Klik tombol **Nonaktifkan Akun (Deactivate)** pada profil pengguna terkait.
3. Sistem secara instan:
   - Mengubah status `is_active = false`.
   - Memasukkan token sesi aktif ke tabel `public.revoked_sessions`.
   - Permintaan HTTP berikutnya dari browser target langsung ditolak (`401 Unauthorized`) dan dialihkan ke layar login.

### 4.2 Insiden Anomali Rekonsiliasi Data
Jika terjadi selisih nilai antara klaim lapangan dan data ledger:
1. Periksa histori import pada menu **Riwayat Impor & Versi**.
2. Telusuri nomor versi file, checksum SHA-256, dan catatan rollback.
3. Bila diperlukan pembatalan batch impor terakhir, lakukan rollback via fungsi rollback import dengan menyertakan alasan bisnis tertulis.
4. Setiap aksi rollback akan dicatat permanen pada `audit_trail`.

---

## 5. Pemeliharaan Jejak Audit (Audit Trail Immutability Maintenance)
* **Karakteristik:** Tabel `public.audit_trail` bersifat *append-only* (hanya bisa diisi INSERT).
* **Perlindungan Database:** Trigger PostgreSQL `prevent_audit_tampering` secara otomatis membatalkan setiap perintah `UPDATE` atau `DELETE` pada tabel audit, termasuk jika dijalankan oleh superadmin.
* **Retensi Data:** Jejak audit disimpan minimal selama 5 tahun sesuai regulasi PP 71/2019 tentang Penyelenggaraan Sistem Transaksi Elektronik.
