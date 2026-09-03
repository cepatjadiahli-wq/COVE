# PRODUCT REQUIREMENTS DOCUMENT

# COVE v1.0 — Validation-Gated MVP

**Nama produk:** COVE — Construction Operations Value Engine  
**Kategori:** Progress-to-Invoice Control System  
**Versi dokumen:** 1.0  
**Tanggal:** 3 September 2026  
**Status:** Draft siap validasi dan acuan pembangunan setelah gate terpenuhi  
**Target rilis:** MVP terbatas, bukan general availability  
**Pemilik keputusan produk:** Founder/Product Lead  

---

## 0. Kendali Dokumen

| Elemen | Ketentuan |
|---|---|
| Sumber keputusan | COVE Strategic Product Audit 2026 |
| Keputusan utama | NARROW lalu VALIDATE BEFORE BUILD |
| Wedge | Measured → Claim-ready → Submitted → Certified → Invoiced |
| ICP | Kontraktor spesialis MEP menengah pada proyek swasta |
| Validasi wajib | Minimal 2 paid pilots sebelum backend produk dibangun |
| North-star metric | Rupiah Pre-Invoice Exposure Resolved per Month |
| Batas MVP | 1 ICP, 1 workflow, 3 outcomes, maksimal 5 modul inti |
| Interpretasi PRD | Requirement bisnis dan produk; bukan desain database atau pilihan stack final |

### Riwayat versi

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 3 September 2026 | PRD pertama setelah penyempitan strategi |

---

## 1. Keputusan Produk

### 1.1 Putusan

COVE tidak dibangun sebagai super-app konstruksi. COVE v1.0 adalah sistem kendali internal yang membantu kontraktor menemukan, memprioritaskan, dan menyelesaikan hambatan yang membuat pekerjaan terukur belum berubah menjadi invoice.

Produk pertama yang dibangun:

> **Excel Import & Reconciliation → Value Gap Ledger → Claim Readiness → Action Queue → Portfolio & ROI Review**

### 1.2 Hal yang tidak dijanjikan

COVE tidak:

- menjamin owner membayar;
- menentukan hak hukum atau wanprestasi;
- menggantikan ERP, accounting, project management, atau document management;
- melakukan tax filing atau menerbitkan faktur pajak;
- membuktikan progres hanya berdasarkan geotag;
- mengunci pembayaran subkontraktor;
- menilai kesehatan perusahaan dengan skor yang belum tervalidasi;
- mengharuskan owner, MK, atau general contractor memiliki akun.

### 1.3 Syarat sebelum engineering penuh

Backend MVP hanya boleh mulai dibangun bila:

1. minimal dua kontraktor ICP membayar pilot sedikitnya Rp7,5 juta;
2. minimal lima calon pelanggan memberikan dataset proyek yang disamarkan;
3. minimal tiga proyek memiliki controllable blocked exposure ≥Rp250 juta atau ≥1% nilai kontrak;
4. satu tracker dapat dipetakan dalam <2 jam;
5. pengguna menerima workflow update mingguan;
6. minimal 80% data inti dapat diimpor tanpa input ulang massal.

Jika syarat tersebut tidak terpenuhi, tim menjalankan keputusan Iterate, Pivot, atau Stop sesuai Bagian 25.

---

## 2. Ringkasan Eksekutif

Kontraktor sering memiliki pekerjaan yang secara fisik telah dilaksanakan atau diukur, tetapi belum dapat ditagihkan karena data tidak sinkron, bukti dan dokumen belum lengkap, komentar pemeriksa tersebar, approval tidak memiliki pemilik tindakan, atau handoff commercial-to-finance terlambat.

Masalah tersebut sekarang dikelola melalui kombinasi Excel, WhatsApp, email, folder cloud, dokumen fisik, dan software accounting/ERP. Setiap alat berguna, tetapi tidak menyediakan satu ledger yang menghubungkan:

> Nilai Rupiah → Stage → Blocker → Controllability → Owner → Tenggat → Evidence → Outcome

COVE mengisi celah itu. Sistem mengimpor tracker yang sudah dipakai, merekonsiliasi nilai, mengelompokkan exposure, membentuk daftar tindakan, dan mengukur nilai yang benar-benar bergerak menuju invoice.

### 2.1 Outcome produk

MVP harus menghasilkan maksimal tiga outcome:

1. **Exposure terlihat:** seluruh nilai pre-invoice yang dapat dibuktikan memiliki bucket, usia, sumber, dan status keterkendalian.
2. **Klaim lebih siap:** pengguna mengetahui item dan dokumen yang belum memenuhi claim-readiness sebelum cut-off.
3. **Siklus lebih singkat:** median waktu measured-to-invoice menurun dan nilai yang berpindah dapat diaudit.

### 2.2 Hipotesis nilai

Jika klaim Rp3 miliar dapat dipercepat 10 hari dan biaya modal pelanggan 15% per tahun, manfaat pembiayaan sekitar Rp12,3 juta per siklus. Ini hanya ilustrasi. COVE wajib memakai parameter pelanggan dan tidak boleh menyajikannya sebagai hasil yang dijamin.

---

## 3. Visi, Positioning, dan Prinsip

### 3.1 Visi jangka panjang

Menjadi sistem kendali komersial dan finansial proyek konstruksi Indonesia yang menghubungkan pekerjaan, klaim, perubahan, invoice, piutang, dan keputusan manajemen melalui data yang dapat ditelusuri.

### 3.2 Positioning v1.0

> Untuk kontraktor spesialis MEP menengah Indonesia yang pekerjaan selesainya tertahan sebelum invoice, COVE adalah Progress-to-Invoice Control System yang menunjukkan nilai Rupiah yang macet, penyebab, pemilik, tenggat, dan tindakan berikutnya—lalu membuktikan nilai yang berhasil bergerak menjadi invoice. Berbeda dari spreadsheet, WhatsApp, atau ERP luas, COVE merekonsiliasi file yang sudah dipakai menjadi action ledger per kontrak tanpa memaksa tim mengganti sistem utama.

### 3.3 Janji produk

> Dalam sesi onboarding pertama, COVE menampilkan nilai pekerjaan yang tertahan sebelum invoice beserta penyebab dan pemilik tindakannya. Dalam pilot 30–45 hari, COVE mengukur perubahan waktu measured-to-invoice dan Rupiah exposure yang diselesaikan.

Target sesi onboarding <2 jam adalah design constraint, bukan SLA publik sampai terbukti pada lima pelanggan.

### 3.4 Prinsip produk

| Prinsip | Implikasi requirement |
|---|---|
| Import first | Tidak ada rekey BOQ/progress massal |
| Action before dashboard | Insight tanpa owner dan next action tidak dianggap selesai |
| Contract-configurable | Stage, checklist, cut-off, retention, dan advance mengikuti kontrak |
| Source-visible | Setiap nilai menampilkan sumber, versi, waktu, dan updater |
| Conservative claims | Exposure, invoice, dan cash tidak dicampur |
| Internal-first | Produk tetap bernilai tanpa login pihak eksternal |
| Human authority | Legal, pajak, correspondence, dan approval akhir tetap pada manusia |
| Exception-driven | Pengguna diarahkan ke data bermasalah, bukan memeriksa seluruh baris |

---

## 4. Masalah Produk dan Batas Bukti

### 4.1 Problem statement

Commercial manager tidak memiliki cara cepat dan dapat diaudit untuk menjawab:

- Berapa Rupiah pekerjaan yang sudah terukur tetapi belum siap diklaim?
- Klaim mana yang akan melewati cut-off?
- Apa penyebab setiap hambatan?
- Hambatan mana yang dapat dikendalikan tim internal?
- Siapa yang harus bertindak dan kapan?
- Berapa nilai yang benar-benar bergerak setelah tindakan?

### 4.2 Hipotesis penyebab utama

1. Versi progress/quantity berbeda antara lapangan, QS, dan counterpart.
2. Bukti atau lampiran wajib belum lengkap.
3. Komentar reviewer tersebar dan tidak mempunyai owner.
4. Cut-off klaim tidak diterjemahkan menjadi tenggat internal.
5. Handoff certificate ke invoice terlambat.
6. Perubahan lingkup tercampur dengan base contract.

### 4.3 Batas bukti

- Penyebab di atas adalah hipotesis yang harus divalidasi per pelanggan.
- Exposure tidak sama dengan kerugian.
- Exposure resolved tidak otomatis berarti kas telah diterima.
- Klaim tidak dianggap berhasil karena dibuat di COVE; harus ada event stage yang bersumber.
- Penghematan hari hanya dihitung bila baseline dan tanggal pembanding tersedia.
- Outcome tidak boleh diatribusikan seluruhnya kepada COVE tanpa evidence tindakan.

---

## 5. ICP dan Pemangku Kepentingan

### 5.1 ICP utama

| Dimensi | Definisi |
|---|---|
| Jenis perusahaan | Kontraktor spesialis MEP Indonesia |
| Proyek | Proyek swasta komersial/industri |
| Skala operasional | 3–20 proyek aktif |
| Skala indikatif | Pendapatan Rp25–250 miliar/tahun; paket Rp2–50 miliar |
| Organisasi | QS/commercial minimal 2 orang; PM/site; finance terpisah; owner/direktur aktif |
| Sistem saat ini | Excel/Sheets + WhatsApp/email + Drive/SharePoint + accounting/ERP |
| Gejala | Rekap berbeda, claim pack bolak-balik, cut-off terlewat, aging tanpa owner, VO tidak tertib |
| Trigger | Cash gap, backlog klaim, proyek baru, pergantian QS, pertumbuhan proyek, audit/lender |

Angka skala merupakan hipotesis segmentasi, bukan klasifikasi resmi.

### 5.2 ICP sekunder

Kontraktor struktur/baja menengah pada proyek swasta. Segmen ini baru diaktifkan setelah minimal lima pelanggan MEP menunjukkan pola data dan workflow berulang.

### 5.3 Buying committee

| Peran | Tanggung jawab | Nilai langsung | Risiko penolakan |
|---|---|---|---|
| QS/commercial admin | Input dan pemutakhiran klaim | Mengurangi rekonsiliasi; mengetahui missing item | Double entry |
| Commercial manager | Prioritas blockage lintas proyek | Satu action ledger bernilai Rupiah | Angka tidak dipercaya |
| Project manager | Progres dan bukti | Tahu progres mana belum dapat diklaim | Menganggap ini tugas finance |
| Finance manager | Invoice dan piutang | Handoff invoice-ready; due-date visibility | Tidak terintegrasi accounting |
| Owner/CFO | Alokasi intervensi dan anggaran | Exposure serta outcome portofolio | Dashboard tanpa tindakan |
| IT/security | Kontrol akses dan risiko data | Governance dan audit | Cloud/data/security concerns |
| Legal/contract | Contract rules dan korespondensi | Sumber klausul dapat ditelusuri | Produk dianggap legal advice |

### 5.4 RACI ringkas

| Aktivitas | QS | Commercial Mgr | PM | Finance | Owner/CFO |
|---|---|---|---|---|---|
| Import progress/measurement | R | A | C | I | I |
| Tetapkan contract rule | C | A/R | C | C | I |
| Klasifikasi blocker | R | A | C | C | I |
| Jalankan action | R | A | R | R | I |
| Konfirmasi certificate | C | A | I | C | I |
| Konfirmasi invoice/receipt | I | C | I | A/R | I |
| Review portofolio | C | R | C | R | A |

R = Responsible, A = Accountable, C = Consulted, I = Informed.

---

## 6. Jobs to be Done dan Use Cases

### 6.1 Jobs

| Jenis | Job |
|---|---|
| Functional | Menyatukan progress, BOQ, evidence, approval, dan status klaim agar setiap nilai punya langkah berikutnya |
| Financial | Memperpendek measured-to-invoice dan mengurangi missed billing |
| Emotional | Yakin tidak ada Rupiah tersembunyi di spreadsheet, chat, atau meja approver |
| Social | Dapat mempertanggungjawabkan angka dan tindakan kepada direksi |

### 6.2 Use case prioritas

| ID | Use case | Aktor utama | Frekuensi | Outcome |
|---|---|---|---|---|
| UC-01 | Mengimpor tracker progress/claim | QS | Mingguan/bulanan | Dataset tervalidasi tanpa rekey |
| UC-02 | Menemukan measured-not-claimed | QS/commercial | Mingguan | Exposure dan penyebab terlihat |
| UC-03 | Memeriksa claim readiness | QS/admin | Menjelang cut-off | Missing document ditutup |
| UC-04 | Menetapkan blocker owner | Commercial manager | Mingguan | Setiap exposure punya action |
| UC-05 | Menindaklanjuti komentar reviewer | QS/PM | Harian-mingguan | Resubmission terkontrol |
| UC-06 | Handoff certified value ke finance | Commercial/finance | Per termin | Invoice terbit lebih cepat |
| UC-07 | Review portofolio | Owner/CFO | Mingguan | Fokus pada exposure terbesar |
| UC-08 | Membuktikan ROI pilot | Founder/CS + customer | Mingguan/akhir pilot | Found, resolved, invoiced, collected terpisah |

### 6.3 Aha moment

Setelah satu tracker diimpor, COVE menunjukkan lima item bernilai terbesar yang tertahan, lengkap dengan nominal, stage, penyebab, owner, dan next action. Pengguna memvalidasi minimal satu action sebagai benar.

---

## 7. Sasaran, Non-Sasaran, dan Scope

### 7.1 Sasaran MVP

| ID | Sasaran | Target pilot |
|---|---|---|
| G-01 | Menampilkan controllable pre-invoice exposure | ≥95% nilai dapat ditelusuri ke source |
| G-02 | Mengubah exposure menjadi tindakan | ≥80% item prioritas punya owner, due date, next action |
| G-03 | Meningkatkan readiness | ≥80% claim package memiliki status checklist |
| G-04 | Mengurangi beban update | ≤10 menit/proyek/minggu setelah initial mapping |
| G-05 | Membuktikan outcome | Nilai resolved tidak double-count dan punya event evidence |

Target-target tersebut adalah acceptance threshold, bukan klaim pasar.

### 7.2 Non-sasaran MVP

- Mengelola seluruh aktivitas proyek.
- Menjadi general ledger atau sumber pembukuan.
- Menjalankan pembayaran.
- Menentukan perhitungan pajak final.
- Menghasilkan dokumen hukum siap kirim tanpa review.
- Menyimpan semua foto dan dokumen.
- Menggantikan approval pihak eksternal.
- Menghasilkan forecast probabilistik tanpa data historis.

### 7.3 Scope empat tingkat

| Must have | Should have | Later | Not planned |
|---|---|---|---|
| Excel/CSV import | Email digest | ERP/accounting API | Full ERP |
| Mapping/reconciliation | Recurring import | VO/addendum | Tax filing/e-Faktur |
| Core stage ledger | External-view export | Retention release | Automatic legal advice |
| Blocker/owner/due | Response log | Forecast 12 minggu | Somasi otonom |
| Contract checklist | Approval ringan | Official WhatsApp API | Payment lock |
| Role access | Bulk actions | OCR/extraction | Full DMS/viewer |
| Audit log | Mobile responsive | Geotag add-on | General PM/BIM |
| Export/backup | SSO readiness | Benchmark intelligence | C-Score awal |
| Drive/SharePoint link | Redacted report | Subcontract exposure | Lifetime plan |

---

## 8. Metrik Produk

### 8.1 North-star metric

**Rupiah Pre-Invoice Exposure Resolved per Month**

Nilai yang berpindah dari blocked pre-invoice stage ke issued invoice dalam SLA kontrak, memiliki source dan timestamp, serta tidak dihitung dua kali.

### 8.2 Metrik leading, lagging, dan guardrail

| Kelompok | Metrik | Definisi |
|---|---|---|
| Leading | Action coverage | % exposure prioritas dengan owner + due + next action |
| Leading | Weekly update rate | % action aktif yang diperbarui dalam 7 hari |
| Leading | Readiness coverage | % claim dengan checklist lengkap/terverifikasi |
| Leading | Import success | % baris bernilai yang valid setelah import |
| Leading | Time-to-first-value | Waktu file diterima sampai top blockers terlihat |
| Core | Exposure resolved | Nilai blocked yang bergerak ke invoice |
| Lagging | Median measured-to-invoice | Median hari dari event measured ke event invoice |
| Lagging | First-pass completeness | % claim yang tidak dikembalikan karena dokumen internal kurang |
| Lagging | Days accelerated | Selisih baseline dan observed stage duration |
| Lagging | Project expansion | % akun mengaktifkan proyek kedua dalam 90 hari |
| Guardrail | Reconciliation error | Selisih nilai COVE dengan source setelah validation |
| Guardrail | Duplicate value | Nilai yang masuk lebih dari satu bucket pada timestamp sama |
| Guardrail | Update burden | Menit update per proyek per minggu |
| Guardrail | Data incident | Insiden akses, kehilangan, atau paparan data |

### 8.3 Event analytics minimum

- import_started, import_validated, import_failed;
- mapping_saved, reconciliation_accepted;
- exposure_created, exposure_reclassified, exposure_resolved;
- blocker_assigned, action_due, action_updated, action_closed;
- checklist_item_completed, claim_marked_ready;
- stage_changed, invoice_confirmed, receipt_confirmed;
- weekly_review_exported;
- user_invited, user_deactivated.

Tidak boleh merekam isi dokumen sensitif ke analytics pihak ketiga.

---

## 9. Model Stage dan Leakage

### 9.1 Core stages

| Kode | Stage | Entry condition | Exit evidence |
|---|---|---|---|
| S0 | Imported | Baris lolos validation | Mapping dan source snapshot diterima |
| S1 | Measured | Nilai/volume terukur dengan source | Dipilih masuk claim package |
| S2 | Claim-ready | Checklist wajib lengkap | Submitted timestamp/reference |
| S3 | Submitted | Klaim dikirim ke counterpart | Certificate/approval atau revision |
| S4 | Certified | Nilai disahkan | Invoice number/date |
| S5 | Invoiced | Invoice diterbitkan | Receipt atau closing adjustment |
| S6 | Collected | Penerimaan direkonsiliasi | Final/partial receipt record |

MVP mengoptimalkan S1 sampai S5. S6 dicatat untuk outcome, bukan dijanjikan sebagai hasil sistem.

### 9.2 Leakage buckets

| Bucket | Perhitungan konseptual |
|---|---|
| Earned not measured | Earned value − measured value |
| Measured not claim-ready | Measured value yang belum memenuhi readiness |
| Claim-ready not submitted | Ready value tanpa submitted event |
| Submitted not certified | Submitted value − certified value |
| Certified not invoiced | Certified value − invoiced value |
| Invoiced not due | Invoiced outstanding sebelum due date |
| Invoiced overdue | Invoiced outstanding setelah due date |
| Approved VO not billed | Approved change yang belum masuk invoice |
| Unapproved VO exposure | Change performed tanpa formal approval/value |
| Retention receivable | Retention withheld yang belum memenuhi release event |

Earned-not-measured dan VO tidak wajib masuk MVP bila source pelanggan tidak tersedia. Sistem harus dapat menonaktifkan bucket yang tidak dapat dibuktikan.

### 9.3 Blocker taxonomy v1

- Data/quantity mismatch.
- Missing internal document.
- Missing external document.
- Internal approval pending.
- Counterpart review pending.
- Comment/revision pending.
- Commercial dispute.
- VO/addendum unresolved.
- Tax/invoice administration.
- Cut-off missed.
- Handoff delay.
- Unknown—requires classification.

Setiap blocker memiliki internal/external owner, controllability, opened date, severity, next action, due date, evidence, dan closure reason.

---

## 10. Modul 1 — Project Intake & Excel Reconciliation

### 10.1 Tujuan

Mengubah file yang sudah digunakan pelanggan menjadi dataset COVE yang tervalidasi tanpa meminta QS mengetik ulang BOQ, progress, atau claim value.

### 10.2 Requirement fungsional

Prioritas P0 wajib untuk pilot produk; P1 boleh menyusul sebelum limited release.

| ID | Requirement | Prioritas | Acceptance criteria |
|---|---|---:|---|
| IMP-001 | Sistem menerima XLSX dan CSV | P0 | File valid dapat dibaca; sheet dapat dipilih |
| IMP-002 | Pengguna melihat preview sebelum commit | P0 | Minimal 20 baris dan header hasil mapping terlihat |
| IMP-003 | Kolom sumber dapat dipetakan ke field COVE | P0 | Required fields diberi status mapped/unmapped |
| IMP-004 | Mapping dapat disimpan sebagai template perusahaan/proyek | P0 | Import berikutnya dapat memakai ulang mapping |
| IMP-005 | Sistem memvalidasi tipe, tanggal, nilai, dan required field | P0 | Baris gagal tidak masuk ledger dan alasan terlihat |
| IMP-006 | Sistem menampilkan total source versus total accepted | P0 | Selisih nilai ditampilkan sebelum commit |
| IMP-007 | Pengguna dapat mengekspor daftar error | P1 | File error memuat row reference dan correction reason |
| IMP-008 | Import memiliki source file, sheet, waktu, uploader, dan checksum/version | P0 | Semua item ledger dapat ditelusuri ke import |
| IMP-009 | Import yang sama tidak membuat duplikasi | P0 | Re-upload identik ditolak atau ditandai duplicate |
| IMP-010 | Import versi baru menampilkan added/changed/removed | P0 | Delta dapat ditinjau sebelum apply |
| IMP-011 | Perubahan manual setelah import membutuhkan alasan | P0 | Old value, new value, reason, actor, timestamp tercatat |
| IMP-012 | Pengguna dapat membatalkan import sebelum commit | P0 | Tidak ada data produksi dibuat |
| IMP-013 | Rollback dilakukan melalui versi baru, bukan menghapus audit | P1 | Histori versi tetap tersedia |
| IMP-014 | Sistem mendukung nilai negatif untuk adjustment | P0 | Adjustment tidak dianggap error dan diberi reason |
| IMP-015 | Default currency adalah IDR dengan nilai presisi | P0 | Tidak ada pembulatan tersembunyi pada ledger |
| IMP-016 | Sistem dapat menangani minimal 5.000 baris/file dan 20 MB | P1 | Import selesai ≤60 detik pada test environment target |

### 10.3 Required fields minimum

- project reference;
- line/item reference;
- description;
- measured atau current-stage value;
- stage/status;
- source date atau reporting period.

Claim reference, owner, due date, certificate, dan invoice dapat kosong saat import, tetapi masuk exception queue.

### 10.4 Mapping assisted

Pada lima pelanggan pertama, mapping merupakan layanan onboarding. Produk tidak perlu menyediakan no-code transformation builder yang kompleks. Tim implementasi boleh menyiapkan mapping template yang kemudian dijalankan pengguna.

---

## 11. Modul 2 — Value Gap Ledger & Aging

### 11.1 Tujuan

Menyediakan satu ledger nilai pre-invoice yang tidak double-count, dapat ditelusuri, dan siap diprioritaskan.

### 11.2 Requirement fungsional

| ID | Requirement | Prioritas | Acceptance criteria |
|---|---|---:|---|
| LED-001 | Setiap value item memiliki satu current stage | P0 | Satu item tidak aktif di dua core stage pada waktu sama |
| LED-002 | Sistem menyimpan stage event history | P0 | Old/new stage, date, actor, source tercatat |
| LED-003 | Sistem menghitung age sejak entry ke current stage | P0 | Age memperhitungkan configured calendar rule |
| LED-004 | Nilai dapat dilihat per project, claim, stage, blocker, dan owner | P0 | Filter total sama dengan detail |
| LED-005 | Exposure bucket dihitung dari stage dan value version | P0 | Rekonsiliasi total lolos automated checks |
| LED-006 | Gross exposure dipisahkan dari controllable exposure | P0 | Tampilan dan export memakai label berbeda |
| LED-007 | Controllability memiliki Internal, Joint, External, Unknown | P0 | Unknown masuk classification queue |
| LED-008 | Pengguna dapat membuka source lineage | P0 | Import/file reference dan perubahan terlihat |
| LED-009 | Nilai revised/certified dapat lebih rendah dari claimed | P0 | Variance tercatat; histori tidak ditimpa |
| LED-010 | Sistem mencegah double-count lintas bucket | P0 | Satu rupiah hanya masuk satu sequential gap per snapshot |
| LED-011 | Ledger menampilkan freshness | P0 | Last source update dan stale indicator terlihat |
| LED-012 | Pengguna dapat menandai dispute tanpa menghapus exposure | P0 | Nilai berpindah ke dispute flag dengan reason |
| LED-013 | Sistem mendukung partial certification/invoice/receipt | P0 | Sisa nilai tetap pada bucket yang tepat |
| LED-014 | Sistem mendukung write-off/closed-no-recovery | P1 | Outcome terpisah dari resolved-to-invoice |
| LED-015 | Cash-at-risk score belum dihitung otomatis | P0 | Produk memakai exposure + age + controllability, bukan pseudo-score |

### 11.3 Aturan freshness

| Status | Default | Dampak |
|---|---:|---|
| Current | ≤7 hari | Dipakai untuk review |
| Attention | 8–14 hari | Peringatan freshness |
| Stale | >14 hari | Forecast/outcome diberi disclaimer |

Default dapat diubah per cadence proyek. Perubahan harus tercatat.

---

## 12. Modul 3 — Claim Readiness Gate

### 12.1 Tujuan

Mencegah klaim bergeser satu siklus karena persyaratan internal atau dokumen pendukung belum lengkap.

### 12.2 Requirement fungsional

| ID | Requirement | Prioritas | Acceptance criteria |
|---|---|---:|---|
| RDY-001 | Commercial manager membuat checklist per contract | P0 | Checklist memiliki version dan effective date |
| RDY-002 | Item checklist memiliki Required, Conditional, Optional | P0 | Readiness hanya diblokir oleh required/active conditional |
| RDY-003 | Checklist dapat disalin ke claim period baru | P0 | Salinan mempertahankan source template version |
| RDY-004 | Evidence disimpan sebagai link dan metadata | P0 | COVE tidak perlu menyimpan file binary pada MVP |
| RDY-005 | User menandai evidence present, verified, rejected | P0 | Actor dan timestamp tersimpan |
| RDY-006 | Claim memiliki Not Started, Incomplete, Ready, Submitted | P0 | Transisi mengikuti checklist dan event |
| RDY-007 | Missing item menampilkan owner dan due date | P0 | Tidak ada required missing item tanpa action owner |
| RDY-008 | Cut-off menghasilkan internal target date | P0 | Lead time dapat dikonfigurasi per contract |
| RDY-009 | Override readiness membutuhkan approver dan reason | P0 | Override muncul di audit/export |
| RDY-010 | Checklist dapat memuat source clause/reference | P1 | User dapat melihat alasan requirement |
| RDY-011 | Sistem menghitung value at risk of missing cut-off | P0 | Hanya nilai claim period terkait yang dihitung |
| RDY-012 | External rejection membuka kembali checklist/action | P0 | Reason dan resubmission count tercatat |
| RDY-013 | Sistem tidak menyebut checklist sebagai legal completeness | P0 | Label: operational readiness, subject to authorized review |

### 12.3 Contract rule minimum

- claim frequency dan cut-off;
- required stages;
- required evidence/checklist;
- internal lead time;
- payment term setelah invoice;
- retention rule bila dipakai hanya untuk tracking;
- advance recovery rule bila dipakai hanya untuk reconciliation;
- calendar basis;
- authorized approver;
- source clause/page reference.

COVE tidak memberikan default yang dianggap benar untuk semua kontrak.

---

## 13. Modul 4 — Action & Escalation Queue

### 13.1 Tujuan

Mengubah setiap exposure material menjadi tindakan yang dimiliki seseorang, memiliki tenggat, dan dapat ditutup dengan evidence.

### 13.2 Requirement fungsional

| ID | Requirement | Prioritas | Acceptance criteria |
|---|---|---:|---|
| ACT-001 | Action terkait minimal satu exposure/item/claim | P0 | Nilai terdampak terlihat pada action |
| ACT-002 | Action memiliki owner internal | P0 | Tidak dapat berstatus Active tanpa owner |
| ACT-003 | Counterpart eksternal dapat dicatat tanpa akun | P0 | Nama/organisasi cukup; data kontak opsional |
| ACT-004 | Action memiliki next step dan due date | P0 | Required sebelum publish |
| ACT-005 | Status: Open, In Progress, Waiting External, Blocked, Done, Cancelled | P0 | Semua perubahan tersimpan |
| ACT-006 | Done membutuhkan closure reason dan evidence/note | P0 | Closure dapat diaudit |
| ACT-007 | Action overdue terlihat menurut nilai, bukan jumlah saja | P0 | Total overdue value sesuai detail |
| ACT-008 | Pengguna dapat bulk assign dan bulk due-date | P1 | Aksi massal dicatat per item |
| ACT-009 | Reminder in-app dan email digest | P0 | User dapat mengatur digest; due/overdue tercantum |
| ACT-010 | WhatsApp hanya deep link pada MVP | P1 | Pesan dapat disunting; tidak dikirim otomatis |
| ACT-011 | Escalation rule dapat dikonfigurasi | P1 | Misalnya H-3, due, H+3 kepada role tertentu |
| ACT-012 | External waiting tidak menghentikan internal next action | P0 | Follow-up date tetap wajib |
| ACT-013 | Comment dan mention tersedia | P1 | Mention menghasilkan notification |
| ACT-014 | Reopen mempertahankan closure history | P0 | Alasan reopen wajib |
| ACT-015 | Weekly review dapat dikunci sebagai snapshot | P1 | Snapshot menampilkan angka dan freshness saat review |

### 13.3 Aturan prioritas

Default urutan:

1. controllable exposure yang akan melewati cut-off;
2. certified-not-invoiced;
3. nilai terbesar dengan blocker internal;
4. action overdue;
5. waiting external yang melewati follow-up date;
6. unknown classification.

Pengguna boleh mengubah urutan, tetapi formula dan filter harus terlihat.

---

## 14. Modul 5 — Portfolio Cash Review & ROI Ledger

### 14.1 Tujuan

Memberi direksi dan commercial/finance manager gambaran lintas proyek yang langsung terhubung ke tindakan dan outcome.

### 14.2 Requirement fungsional

| ID | Requirement | Prioritas | Acceptance criteria |
|---|---|---:|---|
| PRT-001 | Portfolio menampilkan total per stage/bucket | P0 | Total dapat drill-down ke item |
| PRT-002 | Tampilkan controllable terpisah dari external | P0 | Tidak digabung menjadi satu cash-at-risk |
| PRT-003 | Ranking proyek berdasarkan exposure material | P0 | Formula ranking terlihat |
| PRT-004 | Tampilkan top blockers by value dan age | P0 | Dapat membuka action terkait |
| PRT-005 | Tampilkan certified-not-invoiced handoff queue | P0 | Finance dapat filter dan export |
| PRT-006 | Tampilkan data freshness per project | P0 | Stale project tidak menyamar sebagai current |
| PRT-007 | ROI ledger memisahkan Found, Controllable, Resolved, Invoiced, Collected | P0 | Tiap angka punya definisi dan source |
| PRT-008 | Hitung median stage duration bila event cukup | P1 | Sample size terlihat; kosong bila tidak cukup |
| PRT-009 | Baseline dapat ditetapkan dan dikunci | P0 | Perubahan baseline membutuhkan reason |
| PRT-010 | Financing benefit memakai input cost of capital customer | P1 | Formula dan asumsi terlihat |
| PRT-011 | Export weekly review ke PDF/CSV | P1 | Angka export sama dengan aplikasi |
| PRT-012 | Tidak ada forecast tanggal pasti tanpa confidence | P0 | MVP memakai expected date + assumption label |
| PRT-013 | Snapshot akhir pilot membandingkan before/after | P0 | Periode dan attribution note tercantum |

### 14.3 Ringkasan eksekutif wajib

Hanya lima kartu:

1. Controllable Pre-Invoice Exposure.
2. Exposure Approaching Cut-off.
3. Certified but Not Invoiced.
4. Exposure Resolved This Period.
5. Overdue Action Value.

Tidak ada C-Score atau vanity metric pada MVP.

---

## 15. Requirement Platform Bersama

### 15.1 Tenant, pengguna, dan audit

| ID | Requirement | Prioritas | Acceptance criteria |
|---|---|---:|---|
| PLT-001 | Data perusahaan terisolasi antar-tenant | P0 | Uji akses lintas tenant selalu ditolak |
| PLT-002 | User hanya masuk melalui akun individual | P0 | Shared account tidak didukung |
| PLT-003 | Role dan project access dapat diatur | P0 | User tidak melihat proyek di luar assignment |
| PLT-004 | MFA tersedia untuk admin/owner | P0 | Enrollment dan recovery diaudit |
| PLT-005 | Admin dapat mengundang, menonaktifkan, dan mencabut sesi | P0 | Deactivation efektif segera |
| PLT-006 | Audit log mencatat create/update/delete/export/login penting | P0 | User biasa tidak dapat mengubah audit |
| PLT-007 | Soft delete untuk data operasional | P0 | Restore oleh admin dalam retention window |
| PLT-008 | Permanent deletion memakai controlled workflow | P1 | Approval dan completion record tersedia |
| PLT-009 | Export tenant tersedia | P0 | Data inti dapat diekspor dalam format terbuka |
| PLT-010 | Timezone default Asia/Jakarta | P0 | Timestamp disimpan konsisten dan ditampilkan WIB |
| PLT-011 | Bahasa antarmuka utama Indonesia | P0 | Istilah stage boleh bilingual pada tooltip |
| PLT-012 | Semua perubahan definisi metric/version terdokumentasi | P0 | Report menyertakan metric version |

### 15.2 Search, filter, dan kualitas penggunaan

| ID | Requirement | Prioritas | Acceptance criteria |
|---|---|---:|---|
| PLT-013 | Search berdasarkan project, claim, item, owner, blocker | P1 | Hasil relevan <2 detik pada dataset target |
| PLT-014 | Filter dapat disimpan | P1 | User dapat membuka kembali review view |
| PLT-015 | Empty state menjelaskan tindakan berikutnya | P0 | Tidak ada halaman kosong tanpa CTA operasional |
| PLT-016 | Error message menyebut masalah dan perbaikan | P0 | Tidak hanya menampilkan “terjadi kesalahan” |
| PLT-017 | Bulk action memiliki preview dan confirmation | P0 | Dampak jumlah item/nilai terlihat |
| PLT-018 | User dapat melihat last updated dan source | P0 | Tersedia pada detail dan export |

---

## 16. Model Data Konseptual

Bagian ini mendefinisikan objek bisnis, bukan skema database.

| Entitas | Fungsi | Field minimum |
|---|---|---|
| Company | Tenant pelanggan | name, timezone, currency, status |
| User | Identitas individual | name, email, role, status, MFA state |
| Project | Unit operasional | code, name, client/counterpart, start/end, status |
| Contract Profile | Aturan komersial | contract ref, value, cut-off, payment term, calendar |
| Contract Rule Version | Aturan bertanggal | type, formula/text, source clause, effective date, approver |
| Source Import | Jejak file masuk | filename, sheet, checksum, mapping, uploader, timestamp |
| Value Item | Unit nilai terlacak | source key, description, current values, current stage |
| Claim Period | Kelompok pengajuan | period, cut-off, target submit, status |
| Stage Event | Pergerakan nilai | from, to, value, date, actor, source |
| Checklist Template | Requirement klaim | version, item, condition, source reference |
| Checklist Instance | Status per claim | state, owner, evidence, verified by/date |
| Blocker | Penyebab exposure | category, controllability, value, opened/closed |
| Action | Tindak lanjut | owner, next step, due, status, closure |
| Evidence Link | Referensi bukti | URL/reference, type, title, access note |
| Certificate | Nilai disahkan | reference, date, certified value, source |
| Invoice | Nilai ditagih | number, issue date, due date, gross/outstanding |
| Receipt | Penerimaan | date, amount, invoice allocation, source |
| Snapshot | Kondisi review | period, totals, freshness, metric version |
| ROI Record | Outcome terukur | category, amount, days, attribution, evidence |
| Audit Event | Jejak perubahan | actor, event, object, before/after, timestamp |

### 16.1 Relasi konseptual

- Company memiliki users dan projects.
- Project memiliki contract profile dan contract rule versions.
- Project/claim period memiliki value items.
- Value item memiliki stage events, blockers, actions, dan evidence links.
- Claim period memiliki checklist instance.
- Certificate, invoice, dan receipt dialokasikan ke value item/claim melalui reference.
- Snapshot membekukan hasil agregasi pada waktu review.
- ROI record merujuk outcome event dan baseline.

### 16.2 Identitas dan deduplikasi

Setiap value item wajib memiliki composite source key yang stabil. Jika tidak tersedia dari file pelanggan, mapping onboarding membentuk key dari project + reporting period + BOQ/item reference + claim reference. Perubahan description tidak boleh otomatis membentuk item baru.

---

## 17. Aturan Bisnis dan Perhitungan

### 17.1 Invariant utama

1. Setiap value item memiliki tepat satu current stage.
2. Stage event bersifat append-only; koreksi menggunakan reversal/revision.
3. Nilai pada report selalu terikat pada snapshot time dan metric version.
4. Tidak ada exposure tanpa source.
5. Tidak ada active action tanpa internal owner dan due date.
6. Tidak ada claim-ready bila required checklist belum complete, kecuali override tercatat.
7. Nilai collected tidak dapat melebihi invoice allocation tanpa reconciliation exception.
8. Deletion tidak menghapus audit history yang wajib dipertahankan.

### 17.2 Rumus exposure

Untuk pasangan stage berurutan:

> Stage gap = upstream eligible value − downstream allocated value

Jika hasil negatif atau downstream tidak dapat dialokasikan ke upstream item, sistem tidak mengubahnya diam-diam menjadi nol. Sistem membuat **Reconciliation Exception** untuk diperiksa.

Total pre-invoice exposure pada snapshot adalah jumlah current value items di S1–S4 yang valid. Penyajian sequential gaps hanya digunakan bila lineage mendukung dan tidak menghasilkan overlap.

### 17.3 Keterkendalian

| Nilai | Definisi |
|---|---|
| Internal | Hambatan dapat ditutup oleh satu atau lebih peran pelanggan |
| Joint | Membutuhkan tindakan pelanggan dan counterpart |
| External | Saat ini hanya menunggu pihak luar setelah kewajiban internal lengkap |
| Unknown | Data belum cukup; wajib masuk classification queue |

MVP tidak memberikan probability weight otomatis. “Cash-at-risk” tidak menjadi satu angka tanpa metodologi tervalidasi.

### 17.4 Aging

- Current stage age = hari kalender/kerja sejak entry terakhir ke current stage, sesuai contract calendar.
- Cumulative blocked days = total durasi seluruh periode blocker terbuka.
- Reopened item mempertahankan current dan cumulative age.
- Paused age hanya diizinkan dengan reason dan approval.

### 17.5 Readiness

- Ready hanya bila seluruh Required dan Conditional-active items berstatus Verified.
- Present belum sama dengan Verified.
- Override memerlukan role berwenang, reason, risk note, dan timestamp.
- Checklist version yang berlaku dikunci pada claim period; perubahan template tidak mengubah histori.

### 17.6 Outcome dan ROI

| Outcome | Rule |
|---|---|
| Found | Pertama kali exposure valid tercatat dalam baseline |
| Classified | Blocker, controllability, owner, dan next action lengkap |
| Resolved | Item keluar dari blocked stage melalui event tervalidasi |
| Invoiced | Invoice reference, issue date, dan allocation tercatat |
| Collected | Receipt direkonsiliasi ke invoice |
| Closed no recovery | Exposure ditutup karena rejection/write-off/adjustment |

Attribution:

- **Level A — Action-linked:** action di COVE selesai sebelum stage event dan evidence tersedia.
- **Level B — Observed:** stage bergerak selama penggunaan, tetapi kontribusi tindakan tidak dapat dibuktikan.
- **Level C — Self-reported:** pengguna menyatakan dampak tanpa evidence cukup.

Hanya Level A boleh dipresentasikan sebagai “COVE-assisted resolved exposure”. Level B disebut “observed movement”; Level C tidak masuk headline ROI.

### 17.7 Financing benefit

> Financing benefit = verified value accelerated × verified days accelerated / 365 × customer annual cost of capital

Syarat:

- cost of capital berasal dari pelanggan dan berlabel asumsi;
- baseline berasal dari data historis atau baseline pilot yang disepakati;
- nilai negatif tetap ditampilkan;
- saved financing cost tidak disebut cash recovered.

---

## 18. Peran dan Hak Akses

### 18.1 Role

| Role | Deskripsi |
|---|---|
| Company Owner | Pemilik tenant, billing, policy, dan seluruh data |
| Company Admin | Kelola user, project access, template, konfigurasi |
| Commercial Manager | Contract rules, exposure, blocker, approval, review |
| QS/Contract Admin | Import, checklist, evidence, action, claim status |
| Project Manager | Progress reference, evidence, action proyek |
| Finance | Certificate, invoice, due date, receipt, finance export |
| Executive Viewer | Portfolio read-only dan export yang diizinkan |
| Auditor/Reviewer | Read-only, source lineage, audit access |
| COVE Implementation | Time-bound assisted access dengan customer approval |

### 18.2 Matriks permission

| Fungsi | Owner/Admin | Commercial | QS/Admin | PM | Finance | Executive | Auditor |
|---|---:|---:|---:|---:|---:|---:|---:|
| Kelola users | Ya | Tidak | Tidak | Tidak | Tidak | Tidak | Tidak |
| Project access | Ya | Terbatas | Tidak | Tidak | Tidak | Tidak | Tidak |
| Contract rule | Approve | Create/edit | View | View | Consult | View | View |
| Import tracker | Ya | Ya | Ya | Terbatas | Terbatas | Tidak | Tidak |
| Resolve exception | Ya | Ya | Ya | Terbatas | Terbatas | Tidak | Tidak |
| Checklist | Ya | Approve | Update | Update evidence | View | View | View |
| Blocker/action | Ya | Full | Full | Project only | Finance items | View | View |
| Certificate/invoice | View | Update certificate | View | View | Full | View | View |
| Receipt | View | View | Tidak | Tidak | Full | View | View |
| ROI baseline | Approve | Propose | View | View | Propose | View | View |
| Audit/export | Full | Scoped | Scoped | Project | Finance | Summary | Read-only |

Field-level restrictions untuk bank account, tax identifiers, atau personal data ditetapkan setelah discovery. MVP tidak perlu menyimpan bank account bila tidak diperlukan.

### 18.3 Assisted access

Akses tim COVE:

- off by default;
- disetujui customer admin;
- memiliki expiry;
- dibatasi pada project tertentu;
- tercatat di audit;
- tidak boleh menggunakan shared credential;
- dapat dicabut segera.

---

## 19. Notifikasi, Eskalasi, dan Pelaporan

### 19.1 Notification requirements

| Event | Penerima default | Kanal MVP | Waktu |
|---|---|---|---|
| Import exception | Uploader + commercial | In-app/email | Setelah validation |
| Required checklist missing | Item owner | In-app/digest | Sesuai internal target |
| Action due | Owner | In-app/email | H-3 dan hari H |
| Action overdue | Owner + commercial | In-app/email | H+1; escalation configurable |
| Waiting external follow-up | Internal owner | Digest | Pada follow-up date |
| Certified not invoiced | Finance + commercial | Digest | Saat event + weekly |
| Data stale | Project data owner | Digest | Berdasarkan cadence |
| Weekly portfolio review | Commercial/finance/executive | Email link/export | Jadwal perusahaan |

### 19.2 Guardrail

- Tidak ada pesan eksternal otomatis pada MVP.
- WhatsApp menggunakan deep link yang dapat diedit pengguna.
- Pesan tidak boleh menyatakan pihak lain wanprestasi secara otomatis.
- Reminder dapat dimute/snooze dengan alasan.
- Sensitive value pada email dapat disamarkan berdasarkan policy.
- Semua escalation rule memperlihatkan sumber due date.

### 19.3 Weekly review pack

Urutan:

1. perubahan sejak review terakhir;
2. exposure approaching cut-off;
3. certified not invoiced;
4. top controllable blockers;
5. overdue actions;
6. data-quality exceptions;
7. exposure resolved dan evidence;
8. keputusan, owner, dan due date baru.

---

## 20. Integrasi dan Interoperabilitas

### 20.1 MVP

| Sistem | Metode | Tujuan |
|---|---|---|
| Excel/CSV | Import/export | Progress, measurement, claim, certificate, invoice status |
| Google Drive/SharePoint | URL/reference | Evidence tanpa menyimpan binary |
| Email | Digest/link/export | Internal notification |
| WhatsApp | Editable deep link | Follow-up manual |
| Accounting/ERP | CSV bridge | Invoice dan receipt reconciliation |

### 20.2 Prinsip integrasi

- COVE tidak menjadi master untuk general ledger.
- Source ownership ditampilkan per field/object.
- Sync conflict masuk exception queue.
- Import tidak menimpa manual approved value tanpa preview.
- API dibangun hanya bila ≥3 pelanggan aktif menggunakan sistem sumber yang sama.
- Integration add-on memiliki scope, SLA, dan biaya tersendiri.

### 20.3 Tidak termasuk MVP

- bank feed;
- e-Faktur/DJP integration;
- electronic signature;
- BIM/schedule integration;
- official WhatsApp Business API;
- two-way ERP real-time sync;
- owner/GC network portal.

---

## 21. Non-Functional Requirements

### 21.1 Keamanan

| ID | Requirement | Target MVP |
|---|---|---|
| NFR-SEC-01 | Encryption in transit | TLS untuk seluruh traffic |
| NFR-SEC-02 | Encryption at rest | Database/storage provider encryption |
| NFR-SEC-03 | Tenant isolation | Automated negative tests lintas tenant |
| NFR-SEC-04 | Authentication | Individual accounts; secure reset; MFA admin |
| NFR-SEC-05 | Authorization | Server-side role/project enforcement |
| NFR-SEC-06 | Session management | Revocation, inactivity timeout, device/session visibility |
| NFR-SEC-07 | Audit | Append-only business/security events |
| NFR-SEC-08 | Secrets | Tidak disimpan di client/source repository |
| NFR-SEC-09 | Vulnerability baseline | Dependency scan dan OWASP review sebelum pilot produksi |
| NFR-SEC-10 | Incident readiness | Owner, severity, containment, notification workflow |

### 21.2 Reliability dan recovery

| Requirement | Target |
|---|---|
| Availability limited release | 99,5% per bulan, excluding announced maintenance |
| Backup | Encrypted daily backup |
| RPO | ≤24 jam untuk pilot; target ≤4 jam sebelum enterprise |
| RTO | ≤8 jam untuk pilot; target ≤4 jam sebelum enterprise |
| Restore test | Sebelum pilot dan minimal bulanan |
| Export | Customer dapat mengambil data inti tanpa proprietary lock |

### 21.3 Performance

| Aksi | Target |
|---|---|
| Halaman ledger/filter | p95 <2 detik pada dataset target |
| Import 5.000 baris/20 MB | ≤60 detik setelah upload selesai |
| Portfolio aggregation | p95 <3 detik |
| Export weekly report | ≤30 detik |
| Action update | Perceived response <1 detik atau progress state |

Target diuji pada volume pelanggan pilot dan direvisi berdasar data nyata.

### 21.4 Usability

- Desktop-first; responsive untuk melihat dan memperbarui action di mobile.
- Browser: dua versi terbaru Chrome dan Edge.
- Bahasa utama Indonesia; istilah kontrak dapat mempertahankan istilah Inggris yang lazim.
- Format angka Indonesia dan timezone Asia/Jakarta.
- Key workflow mengikuti WCAG 2.1 AA sejauh layak pada MVP.
- Tidak ada color-only status; gunakan label/ikon.
- Undo/confirmation untuk perubahan massal.

### 21.5 Observability

- structured application logs tanpa isi dokumen;
- alert pada failed import, permission anomaly, backup failure, dan error rate;
- correlation ID untuk support;
- health/status log internal;
- product analytics dipisahkan dari confidential business data.

---

## 22. Privasi, Regulasi, dan Batas Hukum

### 22.1 Data pribadi dan sistem elektronik

Sebelum produksi, COVE wajib memiliki:

- data inventory dan classification;
- dasar pemrosesan dan DPA;
- privacy notice;
- access, correction, export, deletion process;
- retention schedule;
- breach-response procedure;
- daftar subprocessor;
- evaluasi kewajiban PSE;
- evaluasi lokasi data dan transfer lintas batas.

Landasan yang perlu diverifikasi kembali pada implementasi: [UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi](https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/undangundang%2Bnomor%2B27%2Btahun%2B2022), [PP No. 71 Tahun 2019](https://peraturan.bpk.go.id/Details/122030/pp-no-71-tahun-2019), dan [PSE Privat](https://pse.komdigi.go.id/).

### 22.2 Pajak

COVE MVP tidak menghitung atau menentukan pajak. Jika modul pajak kelak dibangun:

- rules harus effective-dated;
- setiap rule memiliki sumber resmi;
- jenis jasa dan sertifikasi harus eksplisit;
- DPP dan perlakuan PPN tidak boleh menjadi toggle sederhana;
- hasil berlabel draft dan perlu verifikasi petugas berwenang;
- perubahan regulasi menghasilkan change log dan regression test.

Referensi awal: [DJP — Tarif PPh Final Jasa Konstruksi](https://pajak.go.id/id/siaran-pers/tarif-pph-final-jasa-konstruksi-turun) dan [DJP — Kebijakan PPN 2025](https://www.pajak.go.id/id/siaran-pers/kebijakan-baru-ppn-mendorong-kesejahteraan-dengan-prinsip-gotong-royong).

### 22.3 Kontrak, retensi, uang muka, dan dokumen

- Semua aturan berasal dari source clause per proyek.
- Template BAP/checklist tidak disebut “format resmi universal”.
- Retensi dan amortisasi uang muka tidak memiliki default universal.
- Payment term dan working-day calendar harus dapat dikonfigurasi.
- Perpres pengadaan menjadi referensi hanya untuk konteks yang tunduk padanya, bukan semua proyek. ([Perpres 46 Tahun 2025](https://jdih.lkpp.go.id/regulation/download/konsolidasi-nomor-46-tahun-2025/1))

### 22.4 Korespondensi

Jika correspondence template ditambahkan kemudian:

- hanya operational draft;
- user memilih source fact dan penerima;
- tidak menyimpulkan wanprestasi/hak/denda;
- tidak dikirim otomatis;
- wajib human approval;
- template memiliki version, counsel review status, dan disclaimer.

### 22.5 Pay-when-paid

MVP tidak memiliki payment lock. Contract-specific visibility dapat ditambahkan setelah legal review dan workflow discovery. Bukti pembayaran kepada subkontraktor dapat menjadi persyaratan dalam konteks tertentu; sistem tidak boleh menggeneralisasi satu klausul.

---

## 23. Onboarding dan Concierge Pilot

### 23.1 Scope pilot

| Elemen | Batas |
|---|---|
| Durasi | 45 hari |
| Proyek | 1 proyek aktif |
| Data | Current tracker + 2 siklus historis bila tersedia |
| Klaim | 3–10 claim periods/records atau seluruh current exposure |
| Users | Maksimal 10 |
| Review | Kickoff + minimal 4 weekly reviews + closing ROI review |
| Implementasi | Assisted mapping dan contract-rule setup |
| Harga | Rp7,5–12,5 juta sekali bayar |

### 23.2 Tahapan onboarding

| Tahap | Aktivitas | Output | Target |
|---|---|---|---|
| Discovery | Satu recent delay, roles, systems, source | Problem baseline | 60–90 menit |
| Data intake | Redaction, secure transfer, inventory | Data acceptance record | Hari 1–3 |
| Contract setup | Cut-off, stage, checklist, due-date rule | Approved contract profile | Hari 2–5 |
| Mapping | Source-to-COVE mapping dan validation | Accepted snapshot | <2 jam processing target |
| Baseline | Exposure, stage age, historical duration | Locked baseline | Minggu 1 |
| User activation | Role setup dan action training | Active owners | Minggu 1 |
| Weekly review | Update, action, evidence, decision | Review snapshots | Minggu 1–4 |
| Closing | Outcome, ROI, effort, renewal proposal | Pilot scorecard | Hari 45 |

### 23.3 Data acceptance checklist

- Data owner dan authorized uploader teridentifikasi.
- PII yang tidak diperlukan dihapus/disamarkan.
- Source period dan cumulative/periodic basis diketahui.
- Nilai source dapat direkonsiliasi.
- Contract rule memiliki source reference.
- Known gaps dicatat; tidak disamarkan sebagai nol.
- Hak akses project disetujui.
- Retention/deletion pilot disepakati.

### 23.4 Time budget

- Time-to-first-value setelah file accepted: target <2 jam.
- Total implementation effort: target <16 jam pada dua pilot pertama.
- Target setelah lima pelanggan: <8 jam per customer Core.
- Weekly customer update: target ≤10 menit/project untuk pengguna utama.

Jika effort tidak turun setelah tiga pilot, requirement belum standar atau packaging harus menjadi managed service.

---

## 24. User Stories dan Acceptance

### 24.1 User stories prioritas

| ID | Sebagai | Saya ingin | Agar |
|---|---|---|---|
| US-01 | QS | Mengimpor tracker yang sudah saya pakai | Tidak mengetik ulang progress |
| US-02 | QS | Melihat baris gagal dan selisih total | Tidak meneruskan angka yang salah |
| US-03 | Commercial manager | Melihat measured-not-ready by value | Fokus pada klaim terbesar sebelum cut-off |
| US-04 | QS/admin | Mengetahui dokumen required yang kurang | Claim pack lebih lengkap |
| US-05 | Commercial manager | Menetapkan owner dan due date | Hambatan tidak kehilangan penanggung jawab |
| US-06 | PM | Melampirkan evidence link | Progress dapat ditelusuri tanpa upload ulang |
| US-07 | Finance | Melihat certified-not-invoiced | Invoice tidak tertahan pada handoff |
| US-08 | Owner/CFO | Melihat controllable terpisah dari external | Tidak salah menilai risiko |
| US-09 | Auditor | Melihat perubahan dan sumber | Angka dapat dipertanggungjawabkan |
| US-10 | Customer admin | Menonaktifkan user | Mantan pengguna kehilangan akses |
| US-11 | Commercial manager | Membekukan weekly snapshot | Keputusan dan angka tidak berubah diam-diam |
| US-12 | Founder/CS | Membuat ROI report konservatif | Nilai pilot dapat dibuktikan |

### 24.2 UAT skenario inti

| ID | Given | When | Then |
|---|---|---|---|
| UAT-01 | File valid dengan 1.000 baris | QS memetakan dan preview | Total source dan accepted sama sebelum commit |
| UAT-02 | File memiliki tanggal/nilai salah | Validation dijalankan | Baris ditolak dengan alasan dan tidak masuk ledger |
| UAT-03 | File identik sudah pernah committed | Di-upload lagi | Sistem mencegah duplikasi |
| UAT-04 | Versi baru mengubah 10 baris | Preview delta | Added/changed/removed terlihat |
| UAT-05 | Item measured belum lengkap | Ledger dihitung | Item masuk measured-not-ready satu kali |
| UAT-06 | Required checklist verified | User menandai ready | Stage berubah dan event tercatat |
| UAT-07 | Required item belum verified | User mencoba ready | Sistem menolak atau meminta approved override |
| UAT-08 | Action dibuat | Owner/due kosong | Sistem tidak mengaktifkan action |
| UAT-09 | Action selesai | Closure evidence kosong | Sistem meminta reason dan evidence/note |
| UAT-10 | Claimed Rp100j, certified Rp80j | Certificate dicatat | Rp20j variance tetap terlihat |
| UAT-11 | Certified sebagian Rp50j | Invoice Rp30j dibuat | Rp20j tetap certified-not-invoiced |
| UAT-12 | Receipt parsial | Finance mengalokasikan | Outstanding invoice berkurang sesuai allocation |
| UAT-13 | User proyek A | Membuka URL proyek B | Akses ditolak dan event keamanan tercatat |
| UAT-14 | Data project stale | Portfolio dibuka | Stale indicator dan last update terlihat |
| UAT-15 | Weekly snapshot dikunci | Source baru diimpor | Snapshot lama tidak berubah |
| UAT-16 | Baseline dan action-linked outcome ada | ROI dihitung | Level A dipisahkan dari observed movement |
| UAT-17 | Bulk update menyentuh nilai besar | User submit | Preview jumlah item/nilai dan confirmation muncul |
| UAT-18 | Admin menonaktifkan user | Sesi aktif digunakan | Sesi dicabut |

### 24.3 Negative acceptance

MVP gagal diterima bila salah satu terjadi:

- exposure total tidak dapat ditelusuri ke source;
- nilai masuk lebih dari satu bucket;
- user lintas tenant dapat melihat metadata atau data;
- import menimpa data approved tanpa preview;
- claim dapat marked ready tanpa checklist atau override;
- action dapat aktif tanpa owner/due;
- ROI mencampur exposure dengan cash;
- stale data ditampilkan sebagai current;
- delete menghilangkan audit trail;
- external message terkirim otomatis tanpa user action.

---

## 25. Edge Cases dan Error Handling

| Kasus | Perilaku |
|---|---|
| Progress source cumulative | Mapping menyimpan basis cumulative; delta period tidak diasumsikan tanpa rule |
| Nilai periodik | Reporting period wajib dan aggregation terpisah |
| Negative adjustment | Diterima dengan reason; tidak disembunyikan |
| Downstream > upstream | Reconciliation exception; tidak di-clamp diam-diam |
| Partial certificate/invoice/receipt | Allocation dan outstanding dipertahankan |
| Satu certificate ke beberapa claim | Many-to-many allocation dengan total validation |
| Satu invoice ke beberapa certificate | Many-to-many allocation dengan reference |
| Claim dibatalkan | Closed/cancelled reason; histori tetap |
| Stage dilewati | Diizinkan hanya dengan source event dan reason |
| Item reopen | Current dan cumulative age dipisahkan |
| BOQ/addendum revisi | Contract/value version baru; histori lama tidak ditimpa |
| Unapproved VO | Bucket terpisah; tidak masuk guaranteed claim value |
| Link evidence putus | Mark unavailable; action untuk owner; tidak menghapus reference |
| Counterpart tanpa akun | Dicatat sebagai external party; internal follow-up owner tetap wajib |
| Project archived | Read-only; export tersedia; tidak masuk active-project billing setelah close rule |
| Multiple currencies | MVP hanya per-project single currency; selain IDR memerlukan explicit display dan tanpa consolidated conversion |
| File password-protected/corrupt | Import ditolak dengan langkah perbaikan |
| Network interruption | Tidak ada partial commit; user dapat retry |
| Concurrent updates | Conflict warning dan latest version; tidak silent overwrite |

---

## 26. Validasi dan Release Gates

### 26.1 Gate 0 — Problem dan WTP

| Kriteria | Ambang |
|---|---:|
| Perusahaan diwawancarai | ≥10 |
| Mengonfirmasi pain bulanan | ≥7 |
| Dataset disamarkan | ≥5 |
| Paid pilots | ≥2 pada harga ≥Rp7,5j |
| Proyek dengan exposure material | ≥3 |
| Exposure material | ≥Rp250j atau ≥1% nilai kontrak |

**Keputusan:** hanya GO bila semua critical criteria—paid pilots, data, dan exposure—terpenuhi.

### 26.2 Gate 1 — Concierge repeatability

| Kriteria | Ambang |
|---|---:|
| Accepted import coverage | ≥80% awal; target ≥95% setelah mapping |
| First value | <2 jam setelah accepted file |
| Action coverage | ≥80% prioritas |
| Weekly update | ≥70% actions aktif |
| Delivery effort | Menurun pada pilot kedua/ketiga |
| Verified stage movement | Minimal 1 per pilot bila siklus memungkinkan |

### 26.3 Gate 2 — MVP limited release

| Kriteria | Ambang |
|---|---:|
| Paying companies | ≥5 |
| Reconciliation error | <5% sebelum final acceptance; 0 unresolved pada published totals |
| Onboarding effort | <8 jam/customer Core |
| Weekly active champion | ≥70% |
| Severe security defects | 0 |
| Restore test | Lulus |
| Renewal intent | ≥80% pada qualified cohort |

### 26.4 Keputusan 30 hari

| Putusan | Kondisi |
|---|---|
| GO | Pain, data, WTP, exposure, dan update behavior melewati gate |
| ITERATE | Pain kuat tetapi satu paid pilot, import 50–79%, atau user reward belum jelas |
| PIVOT | Mayoritas masalah post-invoice/owner liquidity dan tidak dapat dipengaruhi pelanggan |
| STOP | <3/10 urgent, tidak ada data, dan nol paid commitment setelah 20 qualified demos |

---

## 27. Roadmap Produk

| Fase | Deliverable | Metrik | Tidak dibangun |
|---|---|---|---|
| Hari 0–30 | Leakage Audit Kit, interviews, prototype, paid offers | Gate 0 | Backend penuh, AI, pajak, legal |
| Hari 31–60 | 2–5 concierge pilots, taxonomy, weekly review, ROI | Gate 1 | ERP API, DMS, geotag |
| Hari 61–90 | Lima modul P0, security baseline, import/export | Gate 2 | Forecast, owner network, full VO |
| Bulan 4–6 | Repeatable onboarding, case studies, cohort metrics | 5–10 paying; support <25% revenue | Multi-vertical |
| Bulan 7–12 | Project expansion, connector paling umum, partner playbook | 20–35 customers; NRR >100%; GM >75% | Broad ERP/autonomous legal-tax |

### 27.1 Gate fitur expansion

- VO: ≥30% pelanggan menunjukkan VO sebagai top-three leakage.
- ERP connector: ≥3 pelanggan membayar dengan sistem sumber sama.
- Forecast: ≥6 bulan stage/payment history dan hasil backtest.
- WhatsApp API: deep link terbukti, tetapi delivery tracking menjadi bottleneck.
- Geotag: contract type menerima evidence dan pelanggan membayar storage.
- Benchmark: data cukup dianonimkan dan minimum cohort menjaga kerahasiaan.

---

## 28. Packaging dan Entitlement

Pricing tetap hipotesis sampai pilot.

| Penawaran | Entitlement | Harga indikatif |
|---|---|---:|
| Paid Pilot | 1 proyek, ≤10 users, assisted mapping, 4 reviews, ROI report | Rp7,5–12,5 juta/45 hari |
| Core | 1 proyek aktif, 10 users, lima modul inti | Rp2,5 juta/bulan; annual minimum Rp30 juta |
| Project Expansion | Proyek aktif tambahan | Rp750 ribu/proyek/bulan |
| Scale | 5 proyek, 25 users, portfolio review | Rp5 juta/bulan; annual minimum Rp60 juta |
| Enterprise | 15+ proyek, SSO/API/security requirement | Rp10–20 juta/bulan, annual proposal |
| Onboarding | Rule setup, mapping, training, baseline | Rp10–100 juta sesuai kompleksitas |

### 28.1 Billing rules

- Tidak ada lifetime plan.
- Metrik utama adalah company base + active project; bukan per-seat.
- Project menjadi inactive billing setelah close/archive rule disetujui.
- Storage/file processing memiliki fair-use limit.
- Custom integration dan managed reconciliation adalah add-on.
- Annual contract dimulai setelah pilot, kecuali pelanggan memilih langsung.
- Entitlement tidak boleh menghapus akses export saat subscription berakhir; berlaku read/export grace period sesuai kontrak.

---

## 29. Risiko Produk

| Risiko | Kemungkinan | Dampak | Tanda | Mitigasi | Owner |
|---|---|---|---|---|---|
| Scope melebar | Tinggi | Sangat tinggi | Backlog non-core | Gate NSM dan evidence ≥30% | Product |
| Harga rendah | Tinggi | Tinggi | Service >25% revenue | Onboarding fee/annual minimum | CEO |
| Input manual | Tinggi | Sangat tinggi | Update turun | Import-first/bulk/source sync | Product |
| User tidak mendapat reward | Tinggi | Tinggi | Direksi saja aktif | Personal action queue | Product/CS |
| Data tidak konsisten | Tinggi | Sangat tinggi | Error >5% | Mapping/version/exception | Implementation |
| Forecast palsu | Sedang | Tinggi | Miss >20% | Tunda; confidence/backtest | Finance/Product |
| Legal/tax liability | Sedang | Sangat tinggi | Draft dipakai final | Out-of-scope/human review | Legal |
| ERP datang terlalu awal | Tinggi | Tinggi | Double entry objection | CSV bridge; three-customer gate | CTO |
| Dashboard pasif | Tinggi | Sangat tinggi | Tidak ada stage movement | Owner/due/closure wajib | Product/CS |
| Data breach | Sedang | Sangat tinggi | Permission anomaly | MFA, isolation, DPA, incident plan | CTO/DPO |
| Sales cycle panjang | Tinggi | Sangat tinggi | >90 hari tanpa deposit | Mid-market/paid pilot | CEO/Sales |
| External party tidak mau adopsi | Tinggi | Sedang | Invite tidak diterima | Internal-first/export/deep link | Product |
| Outcome overclaim | Sedang | Tinggi | Found disebut recovered | Attribution levels dan audit | Product/Finance |
| Project completion churn | Tinggi | Tinggi | Tidak ada project kedua | Company plan/portfolio expansion | CS/Sales |

---

## 30. Dependencies, Assumptions, dan Open Questions

### 30.1 Dependencies

- Akses ke file tracker nyata yang boleh diproses.
- Domain expert QS/commercial untuk mapping dan taxonomy.
- Pelanggan menunjuk data owner serta commercial champion.
- Contract rule dapat diidentifikasi dari sumber.
- Security/legal review minimum selesai sebelum data produksi.
- Proses support dan incident memiliki owner.

### 30.2 Assumptions yang harus diuji

| ID | Asumsi | Cara uji | Batas keputusan |
|---|---|---|---|
| A-01 | Measured-to-invoice adalah pain paling controllable | 10 interviews + file walkthrough | ≥7 konfirmasi |
| A-02 | Exposure material ≥Rp250j/1% kontrak | Leakage audit | ≥3 proyek |
| A-03 | Excel import mengurangi friction | Prototype timing | <2 jam first value |
| A-04 | QS memperbarui action mingguan | Concierge pilot | ≥70% |
| A-05 | Commercial manager menjadi champion | Usage/interview | Champion aktif pada ≥80% pilots |
| A-06 | Owner/CFO membayar | Harga nyata | ≥2 paid pilots |
| A-07 | Owner/GC login tidak diperlukan | Internal-first pilot | Outcome tercapai tanpa external account |
| A-08 | Base + active project diterima | Proposal/objection log | ≥50% pilot convert/advance |
| A-09 | Workflow lintas MEP cukup seragam | Mapping comparison | Core model menangani ≥80% |
| A-10 | Proyek kedua mendorong retention | Cohort 90 hari | ≥40% expand |

### 30.3 Open questions untuk discovery

1. Unit nilai paling stabil: BOQ line, claim line, work package, atau claim period?
2. File mana yang benar-benar menjadi source of truth di setiap peran?
3. Seberapa sering progress tersedia sebagai cumulative versus period value?
4. Siapa yang berwenang mengubah contract rule dan baseline?
5. Apakah external reviewer comments tersedia dalam format terstruktur?
6. Sistem accounting/ERP apa yang paling sering muncul pada tiga pelanggan pertama?
7. Berapa durasi normal dan variasi tiap stage?
8. Apa definisi proyek aktif yang dapat diterima untuk billing?
9. Berapa lama audit/event history perlu disimpan menurut kontrak pelanggan?
10. Security questionnaire apa yang muncul sebelum procurement?

Pertanyaan tersebut harus dijawab melalui pilot, bukan dengan menambah fitur spekulatif.

---

## 31. Definition of Ready dan Definition of Done

### 31.1 Feature Definition of Ready

Feature dapat masuk development bila:

- terkait langsung dengan satu outcome MVP;
- user dan trigger jelas;
- source data tersedia;
- business rule tertulis;
- privacy/security impact dinilai;
- acceptance dan negative cases tersedia;
- dependency diketahui;
- tidak melanggar daftar Not Planned;
- estimasi support/implementation ada.

### 31.2 MVP Definition of Done

MVP dinyatakan selesai hanya bila:

1. lima modul P0 terhubung end-to-end;
2. tracker nyata dapat direkonsiliasi ≥95%;
3. top blockers muncul <10 menit setelah import tervalidasi;
4. setiap published value memiliki source lineage;
5. exposure tidak double-count;
6. claim-ready tidak dapat dilewati tanpa verified checklist/override;
7. action aktif selalu memiliki owner, due, dan next step;
8. stage movement menyimpan event history;
9. portfolio menampilkan freshness dan controllability;
10. ROI memisahkan found, resolved, invoiced, dan collected;
11. permission dan tenant-isolation tests lulus;
12. backup restore test lulus;
13. zero critical/high unresolved security defect;
14. minimal lima perusahaan membayar atau memenuhi limited-release gate;
15. weekly active champion ≥70% pada cohort pilot.

### 31.3 Release blockers

- Belum ada dua paid pilots.
- Data model gagal menangani dua tracker pelanggan.
- Reconciliation error tidak terselesaikan.
- Tidak ada internal action owner.
- Security isolation gagal.
- Outcome hanya berupa dashboard view.
- Scope legal/pajak masuk tanpa governance.
- Cost-to-serve tidak dicatat.

---

## 32. Traceability Outcome ke Requirement

| Outcome | Modul | Requirement kunci | Metrik |
|---|---|---|---|
| Exposure terlihat | Import + Ledger | IMP-003–010, LED-001–011 | Import success, reconciliation error |
| Klaim lebih siap | Readiness | RDY-001–013 | Readiness coverage, first-pass completeness |
| Tindakan terjadi | Action Queue | ACT-001–015 | Action coverage, weekly update, overdue value |
| Invoice lebih cepat | Ledger + Portfolio | LED-009–013, PRT-004–009 | Median measured-to-invoice |
| ROI terbukti | Portfolio | PRT-007–013 | Exposure resolved, days accelerated |
| Trust dan audit | Platform | PLT-001–012, NFR-SEC | Audit completeness, data incidents |
| Retention/expansion | Portfolio + onboarding | PRT-001–013, project template reuse | Project expansion, renewal, NRR |

---

## 33. Keputusan Implementasi Pertama

Sebelum aplikasi:

1. gunakan COVE Leakage Audit Kit pada dua paid pilots;
2. finalkan canonical import schema dari file nyata;
3. finalkan enam core stages dan blocker taxonomy;
4. ukur update burden dan time-to-first-value;
5. kunci baseline dan ROI definitions.

Vertical slice software pertama:

> **Import satu tracker → preview dan reconciliation → bentuk value items → klasifikasi exposure → assign action → catat stage event → tampilkan resolved exposure**

Tidak ada dashboard eksekutif terpisah sebelum vertical slice tersebut bekerja. Portfolio view pertama cukup berupa weekly review yang dapat drill-down ke setiap nilai dan action.

---

## 34. Referensi Keputusan

- COVE Strategic Product Audit 2026
- [DJBK — LAKIP 2025](https://binakonstruksi.pu.go.id/storage/LAKIP-DJBK-TA-2025-rev5-Signed.pdf)
- [PP 9 Tahun 2022 — JDIH BPKP](https://jdih.bpkp.go.id/produkhukum/1623/detail)
- [DJP — Tarif PPh Final Jasa Konstruksi](https://pajak.go.id/id/siaran-pers/tarif-pph-final-jasa-konstruksi-turun)
- [DJP — Kebijakan PPN 2025](https://www.pajak.go.id/id/siaran-pers/kebijakan-baru-ppn-mendorong-kesejahteraan-dengan-prinsip-gotong-royong)
- [Perpres 46 Tahun 2025 — BPK](https://peraturan.bpk.go.id/Details/318647/perpres-no-46-tahun-2025)
- [Naskah Konsolidasi Perpres Pengadaan — LKPP](https://jdih.lkpp.go.id/regulation/download/konsolidasi-nomor-46-tahun-2025/1)
- [DJPb — Dokumen Pembayaran Termin/Retensi](https://djpb.kemenkeu.go.id/kppn/tapaktuan/id/layanan/pengajuan-spm/spm-ls-non-bel-pegawai.html)
- [UU 27 Tahun 2022 — Pelindungan Data Pribadi](https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/undangundang%2Bnomor%2B27%2Btahun%2B2022)
- [PP 71 Tahun 2019 — Penyelenggaraan Sistem dan Transaksi Elektronik](https://peraturan.bpk.go.id/Details/122030/pp-no-71-tahun-2019)

---

## 35. Ringkasan Persetujuan Produk

| Keputusan | Status |
|---|---|
| ICP MEP menengah proyek swasta | Dikunci untuk validasi |
| Wedge Progress-to-Invoice | Dikunci |
| Lima modul MVP | Dikunci |
| External user tidak wajib | Dikunci |
| Excel-first | Dikunci |
| Paid validation sebelum backend | Dikunci |
| Lifetime plan | Ditolak |
| Pajak/legal/forecast/geotag/AI | Ditunda |
| Payment lock, somasi otonom, C-Score awal | Dihapus |
| Stack final | Belum diputuskan |

**Status akhir dokumen:** siap digunakan untuk problem validation, concierge pilot, prototype, estimasi engineering, dan penyusunan backlog P0—tetapi belum mengotorisasi pembangunan penuh sebelum Gate 0 terpenuhi.
