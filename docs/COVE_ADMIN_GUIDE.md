# COVE V1 — ADMINISTRATOR GUIDE (PANDUAN ADMIN SISTEM)
**Tata Kelola Organisasi, Multi-Tenant, Pengelolaan Pengguna (RBAC), dan Keamanan**  
*Untuk: Customer Organization Administrator & IT Commercial Manager*  
*Versi:* 1.0 (Release-Ready) • *Tanggal:* 4 September 2026

---

## 1. Tata Kelola Multi-Tenant & Organisasi Kontraktor
COVE V1 beroperasi dengan arsitektur multi-tenant terisolasi. Setiap kontraktor memiliki `org_id` unik yang memisahkan seluruh data proyek, nilai keuangan, dan konfigurasi kontrak dari perusahaan lain.

### 1.1 Struktur Hirarki Data
```
+-------------------------------------------------------------+
|                     ORGANISASI (TENANT)                     |
|            Contoh: PT Wijaya Mega Konstruksi                |
+------------------------------+------------------------------+
                               |
            +------------------+------------------+
            |                                     |
            v                                     v
+-----------------------+             +-----------------------+
|  PROYEK PILOT 1       |             |  PROYEK 2             |
|  Grand Meridian Mall  |             |  Tol Cisumdawu MEP    |
+-----------+-----------+             +-----------+-----------+
            |                                     |
            v                                     v
    [Kontrak & Aturan]                    [Kontrak & Aturan]
    [Klaim & Value Gaps]                  [Klaim & Value Gaps]
    [Readiness Checklist]                 [Readiness Checklist]
    [Action Queue]                        [Action Queue]
```

---

## 2. Matriks 9 Peran RBAC (Role-Based Access Control)
Sesuai PRD Bagian 18.2 dan PLT-003, terdapat 9 peran resmi dengan wewenang yang dipetakan secara ketat:

| Peran | Kode Role | Wewenang Utama & Cakupan Akses |
| :--- | :--- | :--- |
| **Owner / Direktur** | `DIRECTOR_OWNER` | Akses penuh seluruh proyek; persetujuan override checklist; persetujuan aturan kontrak v1.0; peninjauan scorecard dan ROI. |
| **Commercial Manager** | `COMMERCIAL_MANAGER` | Pemilik alur klaim; pengajuan aturan kontrak baru; penugasan action queue; manajemen kuota proyek; ekspor audit. |
| **Project Manager** | `PROJECT_MANAGER` | Pemantauan proyek tertugaskan; verifikasi berkas kesiapan di lapangan; resolusi blocker; pembaruan status progress. |
| **Site Engineer** | `SITE_ENGINEER` | Pelaporan progres fisik lapangan; unggah metadata opname; pencatatan hambatan teknis. |
| **Quantity Surveyor** | `QS` | Impor tracker Excel/CSV; pemetaan kolom klaim; validasi nilai opname dan verifikasi dokumen pendukung. |
| **Finance / Invoicing** | `FINANCE_BILLING` | Pengelolaan antrean Certified-Not-Invoiced; penerbitan invoice; pencatatan bukti potong pajak; alokasi kas masuk. |
| **Auditor Eksternal** | `EXTERNAL_AUDITOR` | Akses baca (*read-only*) dengan watermark kepatuhan; pelacakan jejak riwayat audit dan silsilah data (*source lineage*). |
| **Customer Admin** | `CUSTOMER_ADMIN` | Manajemen pengguna; pemberian hak akses proyek; penonaktifan sesi; ekspor cadangan data penuh organisasi. |
| **Viewer** | `VIEWER` | Akses lihat terbatas tanpa hak mutasi data apa pun. |

---

## 3. Manajemen Akun Pengguna & Hak Akses Proyek

### 3.1 Penambahan Pengguna Baru
1. Masuk sebagai **Customer Admin** atau **Commercial Manager**.
2. Buka menu **Pengaturan &gt; Tim &amp; Pengguna**.
3. Klik tombol **Tambah Pengguna**.
4. Masukkan Nama Lengkap, Alamat Email Resmi Perusahaan, dan pilih Peran (Role).
5. Tentukan proyek-proyek spesifik yang boleh diakses pengguna tersebut (Project Assignment).
6. Pengguna non-Direktur hanya dapat melihat data pada proyek yang secara eksplisit ditugaskan kepada mereka (UAT-13).

### 3.2 Penonaktifan Akun & Pemutusan Sesi Seketika (UAT-18)
* Bila seorang karyawan mutasi atau berhenti bekerja, klik tombol toggle **Nonaktifkan Akun**.
* Sistem secara otomatis memutus sesi aktif pengguna pada browser dan menolak otentikasi berikutnya tanpa menunggu masa kedaluwarsa token JWT.

---

## 4. Akses Bantuan Terkendali (Time-Bound Assisted Access)
Sesuai PRD Bagian 18.3, tim teknis COVE hanya dapat mengakses data organisasi kontraktor atas izin tertulis:
1. Admin Kontraktor mengaktifkan opsi **Izinkan Dukungan Concierge COVE**.
2. Tentukan durasi izin bantuan (pilihan: 1 jam, 4 jam, atau maksimal 24 jam).
3. Setelah batas waktu berakhir, izin bantuan otomatis dicabut oleh sistem (*auto-expiry*).
4. Seluruh aktivitas teknisi COVE selama sesi pendampingan dicatat secara permanen di audit trail dengan label identitas khusus.

---

## 5. Ekspor Cadangan Lengkap Data Perusahaan (Open Data Guarantee)
Sesuai klausul PRD Bagian 28.1 (Jaminan Open Data Grace Period):
1. Buka menu **Onboarding &gt; Paket &amp; Entitlement B2B**.
2. Klik tombol **Unduh Cadangan Lengkap Data Perusahaan (JSON)**.
3. Berkas JSON terenkripsi TLS akan diunduh ke komputer Anda, berisi seluruh rekonsiliasi proyek, riwayat klaim, jejak audit, dan tiket tindakan.
4. Akses ekspor ini **dijamin selalu aktif** bahkan setelah masa langganan berakhir.
