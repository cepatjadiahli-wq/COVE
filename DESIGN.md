# COVE — UI/UX Design System & Experience Specification

**File:** `DESIGN.md`  
**Versi:** 1.0  
**Tanggal:** 7 September 2026  
**Status:** rancangan untuk implementasi bertahap; belum merupakan UI yang telah dibangun atau lulus UAT  
**Produk:** COVE — Construction Operations Value Engine  
**Acuan produk:** `COVE_PRD_v2.0_Product_End_State.md`, **revisi isi v2.2**  
**Acuan data:** `COVE_ERD_v2.0_Logical_Data_Model.md`, **revisi isi v2.1**  
**Referensi visual:** screenshot IFTTT yang diberikan pengguna, file `29c1ecd7-c78a-4337-b883-2b1c362426bb.png`  
**Pemakai dokumen:** product owner, designer, Antigravity, frontend engineer dan reviewer UAT.

> Arah utama: halaman publik dengan hitam pekat, teks putih besar, ruang kosong luas, CTA membulat dan orbit berwarna. Di dalam aplikasi, bahasa visual yang sama berubah menjadi workspace grafit yang terstruktur, dengan tabel finansial terbaca dan tindakan yang jelas.

---

## 1. Mandat Desain dan Urutan Keputusan

Bangun pengalaman yang mudah dipahami sejak kunjungan pertama. Pengunjung harus mengetahui manfaat sebelum diminta mendaftar; pengguna aktif harus dapat segera menemukan pekerjaan berikutnya. Tampilan mengikuti referensi visual, sementara alur mengikuti kebutuhan kontraktor dan kondisi akun yang sebenarnya.

Dokumen ini mengatur presentasi dan interaksi. PRD tetap menentukan fitur, harga, perhitungan, consent dan hak akses; ERD menentukan hubungan data. Tidak menghapus fitur lama, mengubah nominal paket, melemahkan autentikasi, menonaktifkan RLS, atau menganggap tampilan sukses sebagai bukti pembayaran.

Urutan prioritas ketika ada konflik: **kebenaran data dan akses → keberhasilan tugas → keterbacaan → konsistensi → dekorasi**. Keputusan layout di sini adalah spesifikasi desain yang perlu diuji, bukan klaim conversion rate atau usability yang sudah terbukti.

## 2. Terjemahan Referensi Visual

### 2.1. Apa yang terlihat pada gambar

| Elemen referensi | Karakter yang dipertahankan | Penerapan pada COVE |
|---|---|---|
| Hero hitam penuh | kontras tegas dan fokus pada pesan | canvas marketing `#000000`, heading putih |
| Heading sangat besar dan tebal | pesan utama langsung terbaca | headline COVE 2–3 baris desktop, bukan paragraf fitur |
| Navigasi horizontal sederhana | pilihan tingkat atas sedikit | Cara kerja, Harga, Bantuan, Masuk |
| CTA rounded dengan warna solid | bentuk mudah dikenali | primary putih di hero, cyan dengan teks gelap untuk aksi tertentu |
| Lingkaran ikon berwarna | ritme visual dan koneksi | ikon tahapan pekerjaan COVE, bukan logo integrasi yang belum ada |
| Garis lengkung tipis | menggambarkan hubungan | orbit dekoratif pada hero; tidak di belakang tabel aplikasi |
| Ruang kosong di pusat | teks dan CTA sebagai fokus | safe area yang tidak boleh dilewati ikon |
| Transisi ke section putih | kontras antarbab | bagian contoh, cara mulai dan penjelasan di bawah hero |

Font dan kode warna persis pada screenshot tidak diverifikasi; token berikut adalah **pilihan desain COVE**. Screenshot adalah referensi komposisi, bukan permintaan menyalin merek, slogan, katalog integrasi, atau tombol login IFTTT.

### 2.2. Keputusan yang membedakan area

- **Publik:** ekspresif; heading besar, orbit dan blok hitam/putih.
- **Workspace pelanggan:** default gelap grafit; sidebar tenang, tabel/list dominan, dekorasi minimal.
- **Admin internal:** sistem komponen sama, kepadatan tabel lebih tinggi, penanda “COVE Admin • Internal” permanen.
- **Dokumen cetak/PDF:** background putih dan teks gelap, mengikuti template dokumen; jangan mencetak dashboard hitam menjadi laporan hitam penuh.
- Switch tema workspace terang belum menjadi fitur wajib. Section publik putih memakai token light yang eksplisit, bukan dark mode yang berganti acak.

## 3. Model Mental dan Navigasi

### 3.1. Empat pekerjaan pengunjung

| Pertanyaan | Halaman | Aksi utama |
|---|---|---|
| Apa manfaatnya untuk perusahaan saya? | Beranda | Lihat cara kerja |
| Bagaimana saya menggunakannya? | Cara kerja | Lihat paket |
| Paket dan komitmennya bagaimana? | Harga | Pilih paket |
| Bagaimana saya mulai? | Akun, perusahaan, pesanan, pembayaran | lanjutkan satu tahap yang relevan |

Tidak ada signup wall untuk membaca produk. Halaman cara kerja menggunakan ilustrasi berlabel, bukan free trial. Pengunjung tidak langsung dihadapkan pada daftar seluruh modul atau checkout modal. Istilah database, webhook, entitlement, CAPI, dan role platform tidak muncul dalam hero atau alur pelanggan.

### 3.2. Menu utama pelanggan

| Label | Target route | Kedalaman berikutnya |
|---|---|---|
| Ringkasan | `/dashboard` | exposure → sumber → tindakan |
| Proyek | `/projects` | Ringkasan proyek / Progres & Klaim / Tagihan & Penerimaan / Dokumen / Kontrak |
| Tindakan | `/actions` | Saya / Tim / filter proyek → detail tindakan |
| Tagihan Proyek | `/invoices` | invoice konstruksi → jatuh tempo/penerimaan/alokasi |
| Laporan | `/reports` | portfolio / cycle time / ROI / ekspor |

Area pendukung: **Bantuan & Feedback** di bagian bawah sidebar; **Langganan COVE**, **Tim & Peran**, dan **Pengaturan perusahaan** di menu perusahaan/profil. Jangan menamai dua domain sebagai “Billing” tanpa penjelasan.

Route di dokumen adalah target; audit URL aktual sebelum perubahan. Pertahankan deep link, bookmark, filter, history dan permission. Tidak memindahkan API hanya agar sama dengan nama menu.

### 3.3. Menu internal

Konsol `/admin` memiliki enam kelompok: Ringkasan SaaS; Langganan & Pembayaran; Prospek & Recovery; Dukungan Pelanggan; Usulan Fitur; Pengaturan Platform. Subhalaman teknis muncul hanya di kelompok relevan dan sesuai grant. Sidebar pelanggan tidak menampilkan menu platform yang dinonaktifkan atau ajakan menjadi admin.

## 4. Sistem Warna

### 4.1. Token dasar

| Token | Nilai | Penggunaan |
|---|---|---|
| `--marketing-black` | `#000000` | hero, header publik, footer gelap |
| `--app-bg` | `#0B0B0B` | canvas workspace |
| `--surface-1` | `#111111` | sidebar, toolbar, panel utama |
| `--surface-2` | `#171717` | dialog, drawer, field dan row terpilih |
| `--surface-3` | `#242424` | hover/selection netral |
| `--text-primary` | `#FAFAFA` | judul dan nilai utama pada dark |
| `--text-secondary` | `#D4D4D4` | body dan label pendukung |
| `--text-muted` | `#A3A3A3` | metadata, helper, placeholder |
| `--line-subtle` | `#343434` | pemisah dekoratif/panel, bukan satu-satunya batas input |
| `--control-border` | `#737373` | batas kontrol aktif pada surface gelap |
| `--brand-cyan` | `#00A6FF` | aksi accent dan motif |
| `--brand-cyan-hover` | `#38BDF8` | hover accent/link pada dark |
| `--on-cyan` | `#050505` | teks/ikon di atas cyan |
| `--focus-dark` | `#38BDF8` | ring focus pada dark |
| `--light-bg` | `#FFFFFF` | section marketing terang/cetak |
| `--light-subtle` | `#F5F5F5` | panel marketing terang |
| `--light-text` | `#111111` | teks utama pada light |
| `--light-muted` | `#525252` | body/helper pada light |
| `--light-link` | `#075985` | link dan focus pada light |

Teks putih pada cyan `#00A6FF` hanya mempunyai rasio sekitar **2,66:1**. Karena itu tombol cyan memakai teks `#050505`, bukan meniru teks putih kecil di atas biru pada referensi. White primary button menggunakan teks hitam.

### 4.2. Status operasional

| Status | Text/icon | Background | Contoh label |
|---|---|---|---|
| Sukses | `#6EE7B7` | `#102B22` | Terverifikasi, Lunas, Selesai |
| Perlu perhatian | `#FCD34D` | `#322611` | Menunggu dokumen, Segera jatuh tempo |
| Error/terlambat | `#FDA4AF` | `#35181B` | Gagal, Lewat jatuh tempo |
| Informasi/proses | `#7DD3FC` | `#102D3B` | Sedang diperiksa, Diproses |
| Netral | `#D4D4D4` | `#242424` | Draf, Diarsipkan |

Status selalu berisi teks dan bila membantu ikon; warna saja tidak cukup. Jangan menggunakan merah untuk semua nilai besar atau hijau untuk semua peningkatan. Kenaikan piutang overdue adalah risiko, bukan keberhasilan.

### 4.3. Warna tahapan

| Stage internal | Label tampilan | Warna ikon/motif |
|---|---|---|
| Work Performed | Dikerjakan | `#FBBF24` |
| Measured | Diukur | `#38BDF8` |
| Claimed | Diajukan | `#A78BFA` |
| Certified | Disetujui | `#2DD4BF` |
| Invoiced | Ditagihkan | `#60A5FA` |
| Collected | Diterima | `#34D399` |

Label pelanggan boleh disertai istilah asli pada tooltip/penjelasan. Warna stage mengidentifikasi tahapan, bukan severity. Color stage terutama untuk ikon, small marker dan chart legend; nilai Rupiah tetap teks netral terbaca. Ikon pada lingkaran pastel/cerah menggunakan ink gelap.

### 4.4. Rasio kontras token yang dihitung

| Pasangan foreground/background | Rasio perkiraan |
|---|---:|
| Putih `#FFFFFF` / hitam `#000000` | 21,00:1 |
| Ink `#050505` / cyan `#00A6FF` | 7,67:1 |
| Muted `#A3A3A3` / surface `#111111` | 7,49:1 |
| Muted `#A3A3A3` / field `#171717` | 7,11:1 |
| Control border `#737373` / field `#171717` | 3,78:1 |
| Success text/background di atas | 9,91:1 |
| Warning text/background di atas | 10,25:1 |
| Danger text/background di atas | 8,56:1 |
| Info text/background di atas | 8,62:1 |
| Light muted `#525252` / putih | 7,81:1 |

Rasio dihitung dari luminansi sRGB pasangan warna solid, bukan hasil audit seluruh aplikasi. Alpha, gradient, hover dan background aktual perlu diuji lagi. Jangan menurunkan opacity teks untuk membuatnya “premium”.

## 5. Tipografi

Gunakan **Inter Variable** sebagai satu keluarga utama, fallback `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Ini pilihan untuk konsistensi heading dan data, bukan klaim font asli screenshot. Gunakan asset font yang sah, preload seperlunya dan hindari beberapa keluarga tanpa kebutuhan.

| Peran | Desktop | Mobile | Weight / line-height |
|---|---|---|---|
| Wordmark COVE | 32–36 px | 26–28 px | 850 / 1 |
| Hero display | 64–88 px, fluid | 36–44 px | 850–900 / 1,04–1,10 |
| Section heading publik | 40–52 px | 28–34 px | 750–800 / 1,15 |
| Judul halaman aplikasi | 28–32 px | 24–28 px | 750 / 1,2 |
| Judul panel/dialog | 20–24 px | 20–22 px | 650–750 / 1,3 |
| Nilai KPI | 30–40 px | 26–32 px | 700–750 / 1,1 |
| Body marketing | 18–22 px | 16–18 px | 400–500 / 1,55 |
| Body/form aplikasi | 15–16 px | 16 px | 400–500 / 1,5 |
| Tabel desktop | 14–15 px | detail 15–16 px | 400–500 / 1,45 |
| Label/help | 13–14 px | 14 px | 500–600 / 1,4 |
| Badge | 12–13 px | 12–13 px | 600 / 1,35 |

Letter spacing display `-0.035em`; judul aplikasi `-0.02em`; body normal. Hindari negative tracking agresif pada kalimat kecil. Nominal memakai `font-variant-numeric: tabular-nums lining-nums`. Kolom uang rata kanan, label/deskripsi rata kiri. Jangan mengecilkan nilai Rp besar sampai sulit dibaca; gunakan label ringkas dan detail lengkap yang dapat diakses.

## 6. Grid, Spacing, Radius dan Elevation

### 6.1. Ukuran dan breakpoint desain

| Lebar | Layout |
|---|---|
| 320–639 px | satu kolom; mobile navigation; form full width |
| 640–1023 px | tablet; dua kolom jika konten layak; sidebar menjadi drawer |
| 1024–1279 px | desktop kompak; sidebar 216–232 px, ruang konten tidak dipaksa lebar tetap |
| ≥1280 px | sidebar 240 px; content grid lebar; gutter 32 px |

Marketing max-width konten 1200 px, hero visual maksimal 1600 px. Gutter desktop 32–48 px, tablet 24 px, mobile 20 px (16 px pada 320 px). Workspace isi lebar tersedia; form panjang max-width 720 px, checkout max-width 1040 px. Jangan center tabel dalam kolom sempit hanya demi estetika.

Spacing scale: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128` px. Desktop section gap 96–128 px, mobile 56–72 px; panel padding 20–24 px, mobile 16 px; row height default 52–56 px, dense admin 44–48 px dengan target aksi tetap cukup.

| Elemen | Radius |
|---|---:|
| Pill marketing / circle icon | 999 px |
| Card marketing | 20–24 px |
| Panel aplikasi | 12–16 px |
| Input / button aplikasi | 10–12 px |
| Badge | 6–8 px atau pill kecil |

Panel dipisahkan lewat surface dan border halus. Shadow hanya untuk overlay/dialog: misalnya `0 16px 48px rgb(0 0 0 / 0.32)`. Tidak memakai neon glow di setiap kartu, glass blur di seluruh workspace, atau gradient sebagai background tabel.

### 6.2. Layer

Background orbit → konten → sticky header/sidebar → dropdown → dialog overlay → dialog → toast. Gunakan token z-index terpusat; dekorasi selalu `pointer-events: none` dan tidak menerima fokus. Focus ring tidak boleh terpotong karena container overflow.

## 7. Hero Orbit: Komposisi yang Wajib Diikuti

### 7.1. Konten

Eyebrow: **Untuk kontraktor dengan beberapa proyek aktif**.

Heading: **Pekerjaan sudah berjalan. Tagihannya sampai mana?**

Body: **COVE membantu tim proyek dan keuangan melihat pekerjaan yang belum ditagihkan, hambatannya, serta siapa yang perlu bertindak—hingga pembayaran tercatat.**

Primary CTA: **Lihat cara kerja** → `/cara-kerja`. Secondary link: **Lihat paket** → `/pricing`. Tanpa form email di hero; pendaftaran dimulai setelah pengguna memahami produk/memilih paket. CTA bukan klaim free trial.

### 7.2. Susunan desktop

- Header 80–88 px tinggi pada canvas hitam, logo kiri dan navigasi kanan; tidak menampilkan menu dropdown produk yang belum ada.
- Hero content center, max-width heading 920–960 px, body 720 px. Heading 2–3 baris sesuai lebar; jangan memaksa satu baris atau memotong teks Indonesia.
- Content padding top 88–112 px dan bottom 128–160 px dari area hero; tinggi mengikuti konten. Pada layar rendah CTA boleh di bawah fold, tetapi tetap tidak terpotong oleh fixed height.
- Garis orbit berupa 2–3 busur/ellipse tipis `#1C1C1C`, stroke 1–2 px. Tidak ada partikel, bintang, ilustrasi luar angkasa atau 3D sphere.
- Enam circle icon stage COVE berukuran 64–88 px berada di area pinggir/atas/bawah, tidak di belakang heading, paragraph atau CTA.
- Safe zone mencakup **bounding box seluruh konten + margin 32 px**. Posisi dekorasi harus menyesuaikan teks/font; jangan mengandalkan koordinat screenshot mentah.
- Ikon: helm, penggaris, clipboard, tanda persetujuan, invoice, dompet/penerimaan. Gunakan satu icon family konsisten. Ikon dekoratif diberi `aria-hidden`; arti stage dijelaskan sebagai teks pada section berikutnya.
- Circle solid tanpa shadow neon. Hover hero tidak menggerakkan semua ikon mengikuti cursor.
- Transisi bawah hero ke section putih melalui batas lurus seperti referensi, bukan wave divider atau tumpukan kartu mengambang.

### 7.3. Tablet dan mobile

Pada tablet tampilkan maksimal empat circle di pinggir. Pada mobile tampilkan maksimal dua circle + satu busur sangat ringan atau hilangkan dekorasi jika berpotensi bertabrakan. Semua isi dan CTA tetap sama; bukan versi desktop yang diperkecil. Body memiliki lebar penuh dengan gutter. Primary button full-width maksimum 360 px, tinggi 52–56 px, secondary link di bawah dengan jarak 16 px.

Orbit static adalah default. Animasi bukan syarat untuk meniru screenshot. Jika ditambah, gunakan entrance opacity/translate singkat sekali saja, tanpa rotasi terus-menerus; `prefers-reduced-motion` menonaktifkan gerakan. Dekorasi tidak boleh menentukan tinggi/scroll horizontal halaman.

## 8. Halaman Utama: Susunan dan Ritme Visual

| Section | Tampilan | Isi dan tindakan |
|---|---|---|
| Hero | hitam; headline center; orbit | manfaat, target, CTA Cara kerja |
| Masalah yang dikenali | putih; heading kiri; tiga pernyataan sejajar desktop | “Sudah dikerjakan, belum ditagihkan”; “Klaim tertahan”; “Tindak lanjut tidak jelas” |
| Satu proyek, satu alur | putih/off-white; ilustrasi workspace lebar | enam tahap dan satu blocker/PIC; label data fiktif |
| Cara mulai | hitam atau grafit; langkah bernomor sederhana | paket → akun/perusahaan → bayar → proyek pertama |
| Untuk tim siapa | putih; empat peran dengan outcome singkat | QS/Commercial, Finance, PM, Direktur; tidak jadi katalog 40 fitur |
| Bukti tersedia | putih; screenshot/studi kasus yang sah | hilangkan blok jika bukti belum tersedia; jangan isi testimoni palsu |
| Paket dan FAQ | grafit/putih sesuai ritme, CTA jelas | harga actual dari server; billing, onboarding, bantuan |
| Footer | hitam | logo, link bantuan/privasi/ketentuan, kontak resmi |

Gunakan pergantian bidang yang luas; hindari setiap paragraf berada dalam card. Foto konstruksi stok tidak diperlukan di hero karena identitas referensi berasal dari tipografi dan orbit. Cuplikan produk harus dapat dibaca di desktop; mobile memakai potongan/tampilan alternatif dengan keterangan, bukan gambar desktop 1200 px dikecilkan menjadi 300 px.

## 9. Halaman Cara Kerja

Tujuan: pengunjung memahami input, proses dan hasil tanpa login. Header publik tetap sama, judul **Dari progres proyek sampai pembayaran tercatat**. Satu proyek ilustrasi dipakai konsisten, bukan berganti angka setiap section.

Tiga blok konten: (1) masukkan baseline/progres dari data proyek atau Excel; (2) lihat nilai tertahan dan penyebab/PIC/tenggat; (3) perbarui klaim, invoice dan penerimaan berdasarkan bukti. Enam stage ditampilkan di blok tengah dengan penjelasan singkat. Primary CTA bawah **Lihat paket**; tidak ada tombol “Coba gratis” atau user demo yang meniru sesi produksi.

Ilustrasi interaktif boleh menggunakan tab “Progres”, “Tindakan”, “Tagihan” hanya untuk menjelaskan contoh. Semua tab bekerja atau dihapus dari preview; jangan membuat kontrol palsu. Preferensi tracking tidak menghalangi membaca konten.

## 10. Harga, Akun dan Onboarding

### 10.1. Harga

Judul **Pilih paket sesuai jumlah proyek aktif**. Tampilkan paket yang benar-benar dijual: Paid Pilot, Core, Scale, Enterprise sesuai server/catalog terkini. Tidak menyalin harga hipotesis PRD menjadi angka hardcoded pada desain.

Setiap paket: nama, untuk siapa, harga + periode, proyek aktif, batas anggota bila ada, onboarding/support, primary action. Hindari tanda centang panjang tanpa arti atau label “Paling populer” tanpa data. Paid Pilot 45 hari jelas sekali bayar dan cakupannya; paket berulang menampilkan cara renewal yang benar. Enterprise memakai permintaan diskusi hanya jika kanal/process tersedia.

Desktop maksimum empat kolom saat lebar memadai; tablet dua; mobile vertikal. Paket tidak disembunyikan dalam carousel swipe. Perbandingan rinci berada setelah ringkasan. Pilihan paket tetap terlihat selama daftar/masuk/checkout; klik tidak membuka modal pembayaran pada sesi kosong.

### 10.2. Login/signup/konfirmasi

Canvas hitam, form single-column maksimal 440–480 px, logo COVE, heading satu tujuan. Ornament orbit kecil opsional di luar form desktop; hilangkan pada mobile. Field email/password berlabel, tombol tampilkan password accessible, error field spesifik. Tidak menampilkan Google/Apple/Facebook sign-in hanya karena ada pada referensi; tampilkan hanya jika benar-benar diimplementasikan dan diuji.

Login: **Masuk ke COVE**, primary **Masuk**, link **Lupa password?**, dan **Belum punya akun? Daftar**. Signup: **Buat akun COVE**, ringkasan paket jika ada, primary **Buat akun**, link masuk membawa intent yang sama. Konfirmasi email memiliki status dan kirim ulang dengan cooldown, bukan blank dashboard.

Kasus network error tidak otomatis menghapus sesi. Akses billing yang tidak diizinkan tidak ditampilkan sebagai “login gagal”. Jangan menaruh identifier seperti “SSR Auth Sync v19.5” di hero; versi teknis ditempatkan pada area tentang/bantuan diagnostik jika diperlukan.

### 10.3. Onboarding dua tahap

**Sebelum bayar:** “Siapkan identitas perusahaan” — data minimum, perusahaan aktif dan role yang ditetapkan server. Stepper lokal: Akun → Perusahaan → Pesanan. Tidak meminta BOQ, foto, NPWP tambahan yang belum dibutuhkan atau kontrak penuh pada form ini.

**Sesudah bayar:** “Siapkan proyek pertama” — proyek → baseline/import → periksa → buka ringkasan. Tampilkan progress tersimpan, primary **Lanjutkan**, tombol **Kembali**, dan bantuan. Bila belum siap menyediakan data, boleh membuka workspace kosong yang menjelaskan next step; tidak boleh menghasilkan proyek/angka palsu. Staf undangan memakai join flow, bukan wizard pembelian pribadi.

## 11. Checkout dan Status Pembayaran

`/checkout` adalah halaman pesanan dedicated setelah sesi dan organisasi valid. Desktop: identitas/detail kiri, ringkasan pesanan kanan; mobile: satu kolom dengan total dan CTA mudah dijangkau. Jangan mengembalikan pola modal publik yang berulang kali menampilkan Unauthorized.

Ringkasan wajib: perusahaan yang membayar; paket; jumlah/periode; diskon/pajak/biaya bila relevan dan benar-benar dihitung server; total; mekanisme perpanjangan; tautan ketentuan. Tombol **Lanjutkan ke Mayar** menampilkan state pembuatan checkout yang terkontrol, bukan mengganti label menjadi “Lunas” saat ditekan. Return URL selalu menuju status yang membaca sumber server.

| Status server | Tampilan pelanggan | Aksi |
|---|---|---|
| Memeriksa | ikon proses tenang; “Kami sedang memeriksa status pembayaran” | tunggu singkat; detail order tetap tampil |
| Pending | “Pembayaran belum terkonfirmasi” | Lanjutkan pembayaran bila session masih valid; Periksa status; Bantuan |
| Settled terverifikasi | “Pembayaran terverifikasi” + paket dan periode | Siapkan proyek pertama atau Buka workspace |
| Gagal terverifikasi | alasan aman yang relevan | Coba metode/pembayaran lagi lewat service, tanpa mutasi harga |
| Kedaluwarsa | “Tautan pembayaran sudah kedaluwarsa” | Buat tautan baru secara aman, bukan reuse link lama |
| Status belum dapat diperiksa | “Status belum dapat diperiksa. Kami belum mengonfirmasi pembayaran” | Coba lagi / Hubungi bantuan; jangan menyebut gagal bayar |

Polling harus punya jeda, backoff dan batas durasi aktif. Default desain: setelah 30 detik tanpa hasil, tetap tampilkan status terakhir dan tombol **Periksa lagi**; hentikan spinner penuh layar. Jangan spinner tanpa batas atau menyuruh user membayar lagi ketika settlement mungkin sedang diproses. Tampilkan waktu pemeriksaan terakhir dan referensi aman yang bisa diberikan ke support.

Kondisi sukses hanya dari server, tidak dari toast/URL/localStorage. Navigasi berulang, double click atau tab dibuka kembali harus menggunakan referensi/idempotency yang sama sesuai PRD. Pembayaran online sungguhan tidak dijalankan sebagai bagian implementasi visual.

## 12. Shell Workspace dan Dashboard

### 12.1. Shell

Desktop: sidebar kiri, topbar 64 px, konten dengan gutter 24–32 px. Topbar: breadcrumb/context kiri; notifikasi dan avatar kanan. Perusahaan aktif selalu terlihat. Project switcher ada pada konteks proyek; jangan menampilkan selector yang kosong/tidak relevan pada login/checkout.

Sidebar: logo 28 px, company label, lima menu utama dengan ikon 20 px + label 14–15 px. Active item memakai surface terpilih, teks jelas dan marker sederhana; bukan seluruh background neon. Jangan mengubah urutan menu per role; visibilitas mengikuti izin, primary action menyesuaikan tugas. Bantuan tetap mudah dijangkau.

Mobile: topbar 56–64 px, bottom navigation maksimal empat item **Ringkasan, Proyek, Tindakan, Lainnya**. Lainnya membuka daftar Tagihan Proyek, Laporan, Bantuan dan pengaturan sesuai izin. Semua jalur maksimum dua tap dari navigasi; jangan membuang fitur laporan hanya untuk mengurangi menu. Safe-area bottom harus dihitung; keyboard tidak menutupi form/action.

### 12.2. Dashboard aktif

Urutan konten:

1. Judul **Ringkasan**, perusahaan/periode, waktu data terakhir dan status kelengkapan.
2. Empat KPI ringkas: belum ditagihkan, piutang proyek, lewat jatuh tempo, tindakan perlu perhatian. Setiap kartu mempunyai definisi/drill-down.
3. Panel **Perlu ditindaklanjuti** sebagai fokus terbesar: nama proyek, hambatan, nilai terkait, PIC, tenggat dan satu action.
4. Ringkasan tahapan lintas proyek dan daftar proyek berisiko.
5. Forecast/penerimaan yang diharapkan dengan confidence dan sumber, bila datanya tersedia.

Desktop empat KPI satu baris dan konten 8/4 atau 9/3 kolom jika lebar cukup. Tablet KPI 2×2, mobile 2×2 hanya jika nominal tetap terbaca; pada 320 px atau zoom gunakan satu kolom. Action list ditampilkan sebelum chart panjang. Jangan menaruh semua isi dalam KPI card besar yang berulang.

### 12.3. Dashboard awal/no data

Heading **Mulai dari proyek pertama Anda**; penjelasan data yang diperlukan dan primary **Siapkan proyek pertama**. Opsi **Impor Excel** tersedia bila user siap. Akun belum berizin melihat next step yang sesuai, misalnya hubungi pengelola. Tidak menampilkan “Rp0 risiko” sebelum ada data valid; gunakan “Belum ada data” dan checklist setup.

## 13. Proyek dan Progress-to-Cash

### Daftar proyek

Search, status aktif/arsip, filter PIC dan sort relevan dalam toolbar. Desktop default table: proyek, nilai kontrak jika tersedia, tahap terakhir/data freshness, belum ditagihkan, overdue, owner, aksi. Mobile menggunakan daftar proyek: nama, status, satu–dua nilai penting dan next action, dengan detail saat dibuka. Arsip tidak tampak sebagai proyek hilang.

### Detail proyek

Header berisi proyek, customer/pihak terkait bila berizin, status, updated-at, aksi kontekstual dan breadcrumb. Tab mengikuti PRD: Ringkasan proyek; Progres & Klaim; Tagihan & Penerimaan; Dokumen; Kontrak. Desktop satu baris jika muat; mobile tabs scroll lokal dengan selected tab terlihat, akses keyboard tetap baik. Bukan horizontal scroll seluruh halaman.

### Tahapan dan gap

Enam tahap adalah **nilai kumulatif**, bukan enam kantong uang yang boleh dijumlah. Tampilkan stage strip dengan nama dan nominal; row terpisah menjelaskan lima gap beserta blocker. Klik stage/gap membuka record yang relevan. Pada mobile gunakan urutan vertikal atau ringkasan + expandable stage list; jangan mengecilkan enam kolom ke layar 360 px.

Tidak menggunakan pie chart untuk menjumlah seluruh cumulative stage. Garis/bar untuk cycle time/aging selalu memiliki label/unit/periode serta alternatif angka. Tidak menyamarkan exception melalui garis turun yang seolah normal; tampilkan **Perlu rekonsiliasi** ketika downstream melebihi upstream.

### Fixture ilustrasi yang konsisten

Semua angka berikut hanya untuk mockup dengan label **Ilustrasi • Data fiktif**, bukan klaim hasil customer.

| Stage | Nilai |
|---|---:|
| Dikerjakan | Rp1.200.000.000 |
| Diukur | Rp1.050.000.000 |
| Diajukan | Rp900.000.000 |
| Disetujui | Rp750.000.000 |
| Ditagihkan | Rp600.000.000 |
| Diterima | Rp450.000.000 |

G1–G5 masing-masing Rp150.000.000; total gap Rp750.000.000 = Work Performed − Collected. Belum ditagihkan = Rp600.000.000; piutang = Rp150.000.000. Jika overdue contoh Rp80.000.000, itu **bagian dari** piutang Rp150.000.000, bukan tambahan gap. Aksi contoh: “Lengkapi dokumen opname”, terkait klaim, PIC QS, tenggat eksplisit. Retensi/VO/PPN tidak diakumulasikan lagi ke angka yang sama.

## 14. Tindakan, Klaim, Dokumen dan Tagihan Proyek

| Area | Pola layout | Interaksi wajib |
|---|---|---|
| Tindakan | list/table utama + detail drawer desktop; detail page mobile | lihat blocker/PIC/due, ambil tindakan, tambah bukti, catat hasil |
| Readiness klaim | summary kiri, checklist per kategori kanan atau vertikal | item kurang ditandai jelas; submit hanya sesuai aturan; override beralasan bila berizin |
| Sertifikasi | perbandingan submitted/certified dan dokumen | parsial/revisi terlihat; jangan dropdown yang memajukan nilai tanpa bukti |
| Invoice proyek | daftar dan detail dengan header proyek/customer, nilai, due dan settlement | buat tagihan dari data sah; catat receipt/allocation; overdue sebagai status tambahan |
| Dokumen | daftar dengan jenis, versi, relasi, uploader/waktu dan actions | preview/unduh berizin; upload progress dan error; no public URL |
| Kontrak/VO/retensi | summary terms + subbagian/ledger | histori baseline dan approval terlihat, tidak overwrite data lama diam-diam |
| Impor | wizard pilih file→mapping→preview error→konfirmasi→hasil | tampilkan row error dan dampak; tanpa silent partial success |
| Laporan | pemilih jenis/periode + hasil dan definisi | filter, drill-down, ekspor; tanggal snapshot/versi perhitungan jelas |

Drawer untuk melihat/memperbarui item ringan; bukan tempat memaksa form 40 field. Perubahan finansial material menampilkan nilai sebelum/sesudah, alasan dan konfirmasi sesuai permission. Dialog tidak menggantikan server-side approval. Undo hanya ditawarkan bila operasi betul-betul reversibel dan mempunyai implikasi audit yang jelas.

## 15. Langganan COVE dan Restricted States

Halaman `/billing` diberi judul **Langganan COVE**, subjudul **Paket dan pembayaran layanan COVE untuk perusahaan ini**. Isi: current plan, periode, status, penggunaan/kuota, invoice SaaS, histori pembayaran, action upgrade/cancel sesuai izin. Jangan menampilkan invoice milik owner proyek di halaman ini.

Status: Aktif; Pembayaran perlu diselesaikan; Masa tenggang; Hanya baca; Berakhir; Pembatalan terjadwal. Badge menggambarkan status server, bukan warna hardcoded dari plan name. Cancel-at-period-end menampilkan tanggal layanan berakhir dan opsi membatalkan jadwal bila tersedia.

Banner restricted menjelaskan apa yang masih dapat dilakukan: baca, ekspor, bantuan sesuai izin. Owner/Admin mendapat **Kelola langganan**; staf mendapat **Hubungi pengelola perusahaan**. Jangan pakai overlay hitam yang memblokir seluruh data customer atau menutup akses komplain. Tidak ada dark pattern yang menyembunyikan pembatalan atau memaksa marketing opt-in.

## 16. Growth, Recovery dan Tracking — Internal

### 16.1. Prospek & recovery

Default view berupa antrean tindakan, bukan grid avatar pengunjung anonim. Kolom: kontak yang diketahui, perusahaan bila ada, minat paket, status checkout, izin kontak, owner, aktivitas terakhir, next action. Kontak sensitif dimasking sesuai peran; gunakan detail untuk melihat seperlunya.

Detail case menampilkan tiga blok berbeda: **Status pembayaran**, **Izin komunikasi**, **Riwayat follow-up**. Panel kanan desktop memuat template preview dan tombol **Buka WhatsApp**. Label mode **Manual** selalu terlihat. Seusai klik, status **Tautan dibuka**; tombol **Catat hasil follow-up** memungkinkan operator mencatat pengiriman/responsnya, tidak menghasilkan receipt provider palsu.

Opt-out, paid, ketidakpastian status atau frekuensi maksimum memberi alasan spesifik dan menonaktifkan tindakan promosi yang terkait. Warning tidak berbentuk toast yang hilang sebelum dibaca. Status **Chatbot otomatis** tidak ditampilkan aktif pada fase manual; 20F adalah Later.

### 16.2. Tracking & attribution

Form konfigurasi Meta menerima ID dan environment; token berstatus tersimpan/tidak tersedia tanpa mengungkap nilai. Tampilkan Enabled/Disabled, consent gate, last test, last delivery dan kill switch. Jangan kotak “paste script” bebas.

Funnel membedakan visitor terukur, lead diketahui, checkout, invoice settled, dan observed recovery. Label denominators/window/currency terlihat. Angka tidak diketahui = “Belum dapat dihitung”, bukan 100% atau 0 secara default. Data proyek pelanggan dan isi komplain tidak ikut telemetry Meta; tidak memuat Pixel dalam konsol admin atau workspace finansial.

## 17. Bantuan, Komplain dan Usulan Fitur

### 17.1. Customer Support Center

Halaman **Bantuan & Feedback** membuka dua tugas sederhana: **Laporkan masalah** dan **Usulkan fitur**. Tab **Tiket saya** menampilkan status dan respons terakhir. Jangan memaksa pengguna memilih istilah P1/P2, SLA atau queue internal sebelum mengirim.

Form laporan: kategori, ringkasan, cerita masalah, lampiran opsional; context proyek/billing diambil hanya jika aman dan user berhak. Ringkasan limit file terlihat sebelum upload. Sesudah submit: nomor tiket aman, jam/target respons yang benar, tautan ke tiket. Thread menempatkan pesan customer dan staff secara jelas; timestamp dan attachment readable. Rating setelah selesai opsional, tidak menghalangi membuka kembali tiket.

### 17.2. “Fitur apa yang Anda harapkan untuk aplikasi ini?”

Heading menggunakan kalimat tersebut. Subheading: **Ceritakan pekerjaan yang masih sulit dilakukan. Masukan Anda membantu kami menentukan perbaikan berikutnya.**

Form berurutan: judul → masalah yang ingin diselesaikan → modul → frekuensi → dampak → cara mengatasi saat ini (opsional) → lampiran → izin dihubungi untuk klarifikasi (opsional). Jangan mengawali dengan pertanyaan skor bisnis atau willingness-to-pay yang mengintimidasi pengguna operasional.

Tampilan status pelanggan: **Diterima → Ditinjau → Direncanakan → Dikerjakan → Dirilis**, atau **Belum direncanakan**, dengan penjelasan publik. Ini bukan progress bar persentase yang menjanjikan semua usulan akan mencapai Released. Tanggal target hanya jika memang disetujui; Planned bukan janji rilis.

### 17.3. Inbox internal

Desktop split view: daftar tiket/usulan, detail thread, metadata/assignment yang dapat diciutkan. Mobile satu detail per layar. Internal note memakai label **Catatan internal — tidak terlihat pelanggan** dan permukaan berbeda; default mode jawaban publik vs internal harus sangat jelas sebelum kirim. Server tetap menyaring field, bukan hanya warna UI.

Product backlog menampilkan canonical request, distinct organisasi pendukung, severity/frequency/effort/confidence, status dan reason. Merge menampilkan preview sumber/tujuan dan konfirmasi; submission asli tetap ada. Customer tidak memperoleh public board lintas tenant atau tautan ke internal notes.

## 18. Komponen Inti

| Komponen konseptual | Spesifikasi | State minimum |
|---|---|---|
| `PublicHeader` | logo, tiga link utama, Masuk/Buka workspace; collapse mobile | default, scrolled, mobile open, authenticated |
| `OrbitHero` | komposisi §7; no interaction pada dekorasi | desktop, mobile, reduced motion |
| `PrimaryAction` | marketing pill 52–56 px; aplikasi 44–48 px; 600–700 weight | default, hover, focus, pressed, loading, disabled |
| `TextField` / `SelectField` | label di atas, helper di bawah, input min 44–48 px | empty, filled, focus, invalid, disabled, readonly |
| `StatusBadge` | text+warna+opsional ikon; ukuran konsisten | neutral, info, warning, danger, success |
| `WorkspaceShell` | sidebar/topbar/context; tidak memuat header marketing | role-based, mobile, restricted, no-org |
| `MetricSummary` | label, value, timestamp/definition dan drill-down | loading, valid, no data, stale, exception |
| `DataTable` | header sticky lokal, numeric alignment, filters, pagination | loading, empty, selected, sort, error, partial data |
| `StageLedger` | stage cumulative + gap terpisah | consistent, partial, revised, exception |
| `ActionList` / `ActionDetail` | PIC/due/blocker/evidence/next action | active, overdue, waiting, resolved |
| `FormStepper` | langkah sekarang, back dan resume | valid, invalid, loading, interrupted |
| `OrderSummary` / `PaymentStatus` | server price dan status; detail pesanan stabil | checking, pending, verified, failed, expired, unknown |
| `EmptyState` | alasan + satu CTA berizin + bantuan | no records, no permission, setup needed |
| `InlineAlert` / `Toast` | informasi material inline; toast untuk konfirmasi ringan | success, warning, error, busy |
| `Dialog` / `Drawer` | focus trap, judul, close/cancel dan return focus | view, confirm, submitting, error |
| `ConsentControls` | tujuan terpisah, pilihan tidak prechecked, revoke mudah | unset, granted, denied, withdrawn |
| `SupportThread` / `FeatureStatus` | customer vs internal visibility, histori | open, waiting, resolved, planned/released |

Nama komponen merupakan tanggung jawab UI, bukan kewajiban membuat komponen duplikat. Audit existing component library lalu reuse/refactor; hindari implementasi Button/Dialog berbeda pada setiap modul.

## 19. Loading, Error, dan Pemulihan

Status sesi, keanggotaan perusahaan, permission billing, dan entitlement proyek adalah pemeriksaan berbeda. Pengguna staf yang valid tetap dapat masuk ke pekerjaan berizin. Billing guard tidak dipakai untuk mengunci seluruh workspace atau bantuan akun. Pelanggan aktif yang memilih paket lain mengikuti review upgrade/downgrade pada Langganan COVE; tidak dibuatkan subscription awal kedua.

| Kondisi | Yang dilihat pengguna | Perilaku dan jalan keluar |
|---|---|---|
| Memuat daftar awal | skeleton mengikuti struktur tabel/list, label singkat | filter dan konteks halaman tetap terlihat; jangan tampilkan nol palsu |
| Memperbarui filter | indikator di area hasil | pertahankan filter; cegah respons lama menimpa pilihan terbaru |
| Memuat data lambat | “Data belum berhasil dimuat.” | tombol Coba lagi dan Bantuan; hentikan spinner penuh yang tidak berujung |
| Koneksi putus | banner persisten dengan status koneksi | pertahankan draft yang aman; jangan menyatakan perubahan tersimpan |
| Simpan berhasil | konfirmasi ringan dan data server terbaru | tutup form hanya setelah keberhasilan diketahui; fokus kembali ke item |
| Simpan gagal | error inline dekat form/field | input pengguna tetap ada; tampilkan tindakan koreksi, bukan seluruh stack trace |
| Hasil pembayaran belum diketahui | “Kami masih memeriksa pembayaran Anda.” | tampilkan referensi pesanan aman, waktu cek terakhir dan Periksa status; jangan langsung membuat pesanan kedua |
| Sesi berakhir | “Sesi Anda berakhir. Masuk kembali untuk melanjutkan.” | simpan tujuan internal yang aman; kembali ke tugas sesudah login; jangan menghapus semua localStorage |
| Tidak punya izin | “Anda belum memiliki akses untuk tindakan ini.” | beri Hubungi pengelola atau Kembali; jangan mengirim ke login berulang |
| Data berubah oleh pengguna lain | “Data ini diperbarui oleh anggota tim lain.” | tawarkan Muat versi terbaru; tampilkan konflik sebelum menimpa |
| Record tidak tersedia | “Data tidak ditemukan atau tidak dapat diakses.” | jalur kembali ke daftar berizin; tidak membocorkan tenant pemilik |
| Kuota habis | jumlah terpakai/batas dan penjelasan | pemilik billing mendapat Kelola langganan; staf mendapat Hubungi pengelola |
| Hanya baca | banner dengan alasan dan tindakan berizin | tetap dapat navigasi, membaca, mengekspor dan meminta bantuan sesuai permission |

Standar interaksi:

- Skeleton tidak boleh menyebabkan layout melompat besar setelah data muncul. Sediakan ruang untuk judul, angka dan action.
- Disable submit saat permintaan berjalan; perubahan finansial tetap membutuhkan idempotency server. Tombol disabled bukan jaminan anti-duplikasi.
- Tidak ada optimistic update untuk status pembayaran, izin akses, nilai sertifikasi, receipt atau ledger finansial. Tampilan “Tersimpan” berasal dari keberhasilan server.
- Untuk operasi panjang seperti impor/ekspor, tampilkan job status yang dapat dibuka kembali. Progress persen hanya jika jumlah pekerjaan diketahui; selain itu gunakan tahap proses.
- Retry transaksi yang hasilnya belum diketahui harus memeriksa operasi yang sama lebih dahulu. Timeout browser tidak otomatis berarti transaksi gagal.
- Animasi transisi standar 120–180 ms; perubahan layout besar dihindari. Reduced motion menonaktifkan gerak dekoratif dan transisi yang tidak diperlukan.
- Error detail untuk support memakai reference ID aman; token, cookie, email pelanggan lain, SQL dan konfigurasi server tidak tampil di UI.

## 20. Responsive dan Aksesibilitas

### 20.1. Perilaku per ukuran

| Lebar uji | Landing/public | Workspace/operasional |
|---|---|---|
| 320 px | judul wrap alami; CTA vertikal; satu arc dekoratif; tanpa horizontal page scroll | satu kolom; nama menu singkat; action penting tetap terlihat |
| 375–390 px | input dan tombol lebar tersedia; menu mobile tidak menutupi judul saat tertutup | bottom navigation + Lainnya; drawer menjadi layar detail |
| 768 px | hero diperkecil, paket dua kolom bila muat | sidebar collapsible; KPI dua kolom; detail bertumpuk |
| 1024 px | container dan heading mengikuti lebar, bukan ukuran desktop tetap | sidebar ringkas; table mendapat ruang utama |
| 1280–1440 px | komposisi orbit penuh; konten dalam max-width | sidebar penuh; action list dan detail dapat berdampingan |
| 1920 px | teks/form tidak melebar tanpa batas | ruang tambahan untuk kolom/table atau panel, bukan pembesaran semua font |

Pada tabel keuangan, pertahankan hubungan antar-kolom. Gunakan scroll horizontal **di dalam tabel**, label bahwa kolom dapat digeser, dan kolom identitas yang tetap terbaca bila memungkinkan. Jangan mengecilkan font menjadi 10 px atau mengubah setiap baris menjadi kartu yang kehilangan perbandingan angka. Form, filter dan pagination di luar tabel tetap reflow.

### 20.2. Target aksesibilitas

Target desain adalah WCAG 2.2 AA pada cakupan yang relevan. Status pemenuhan hanya boleh dinyatakan setelah implementasi diuji; dokumen ini belum merupakan audit kesesuaian.

- Kontras teks normal minimal **4,5:1**, teks besar minimal **3:1**, sesuai [W3C — Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Gunakan hasil token §4, lalu uji lagi seluruh state dan overlay aktual.
- Target sentuh utama ditetapkan **minimal 44 × 44 CSS px sebagai standar internal COVE**. WCAG 2.2 AA Target Size Minimum menggunakan 24 × 24 CSS px dengan pengecualian tertentu; jangan menyebut 44 px sebagai minimum AA. Referensi: [W3C — Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- Uji reflow pada **320 CSS px** dan pembesaran sampai 400% pada viewport yang sesuai. Tabel dua dimensi dapat memerlukan scroll lokal; pengecualian ini tidak berlaku pada seluruh halaman. Referensi: [W3C — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
- Uji pembesaran teks 200%: label, tombol, angka tagihan dan error tidak terpotong atau saling menimpa.
- Semua alur inti dapat selesai memakai keyboard: skip link, urutan tab logis, focus ring terlihat, dan focus tidak tertutup header/bottom navigation.
- Dialog mengelola fokus masuk, trap, Escape bila aman, serta mengembalikan fokus ke pemicu. Kesalahan pembayaran tidak hilang karena dialog tertutup tanpa sengaja.
- Input memakai label programatis; placeholder bukan satu-satunya label. Error field terhubung dengan input; ringkasan error mengarahkan ke field pertama yang bermasalah.
- Hasil submit/status dimuat dengan pengumuman pembaca layar yang proporsional. Countdown dan polling tidak membacakan ulang seluruh halaman.
- Table memiliki caption/heading, header kolom, sort state dan nama action yang menyebut record terkait. Ikon tanpa teks mempunyai accessible name.
- Warna tidak menjadi satu-satunya penanda status, stage, tren, atau error. Grafik memiliki alternatif tabel/ringkasan angka berizin.
- Elemen orbit dan ikon dekoratif dikeluarkan dari urutan fokus serta pembaca layar. Informasi produk tetap lengkap jika dekorasi disembunyikan.
- Dukung `prefers-reduced-motion`; jangan autoplay carousel, orbit berputar, flashing atau parallax wajib.

## 21. Bahasa UI dan Microcopy

Bahasa utama Bahasa Indonesia. Gunakan kata yang menjawab tugas pengguna; istilah teknis internal muncul pada bantuan/definisi seperlunya. Satu konsep memakai label yang sama di menu, heading, breadcrumb, tombol dan notifikasi.

| Istilah untuk pengguna | Dipakai untuk | Hindari ambiguitas |
|---|---|---|
| Ringkasan | halaman awal kerja lintas proyek | jangan mencampur dengan Ringkasan SaaS internal |
| Tagihan Proyek | invoice kontraktor kepada pelanggan proyek | jangan disingkat menjadi Billing pada menu pelanggan |
| Langganan COVE | paket dan pembayaran layanan COVE | bukan biaya kontrak, retensi atau invoice proyek |
| Tindakan | pekerjaan berikutnya beserta PIC dan tenggat | bukan hanya notifikasi atau daftar error |
| Disetujui | nilai sertifikasi sesuai bukti/kontrak | bukan janji owner akan membayar |
| Pembayaran terverifikasi | settlement SaaS yang dikonfirmasi server | bukan redirect sukses, klik Bayar, atau webhook testing |
| Tautan WhatsApp dibuka | operator membuka aplikasi/halaman pesan | bukan bukti pesan terkirim atau dibaca |
| Usulan fitur | masukan tentang pekerjaan yang perlu dibantu | bukan pemesanan fitur dengan tanggal pasti |

Contoh microcopy siap digunakan:

| Lokasi | Teks |
|---|---|
| Empty workspace setelah aktif | **Mulai dari satu proyek.** Masukkan kontrak dan data progres untuk melihat bagian yang perlu ditindaklanjuti. Tombol: **Siapkan proyek pertama**. |
| Sudah mendaftar, belum punya perusahaan | **Siapkan perusahaan Anda.** Identitas ini digunakan untuk langganan dan ruang kerja tim. Tombol: **Lanjutkan**. |
| Undangan anggota | **Anda diundang bergabung ke [perusahaan].** Masuk menggunakan email undangan untuk melanjutkan. |
| Login tidak berhasil | **Email atau kata sandi tidak cocok.** Periksa kembali atau gunakan Lupa kata sandi. |
| Sesi masih diperiksa | **Memeriksa akses Anda…** Bila tidak selesai, coba lagi atau hubungi bantuan. |
| Dilarang mengubah langganan | **Paket dikelola oleh pengelola perusahaan.** Anda tetap dapat menggunakan fitur yang diizinkan. |
| Menunggu pembayaran | **Pembayaran belum terverifikasi.** Jika sudah membayar, periksa status pesanan ini sebelum mencoba pembayaran lain. |
| Klaim belum lengkap | **Klaim belum siap diajukan.** Lengkapi [jumlah] dokumen yang ditandai di bawah. |
| Data stage tidak konsisten | **Nilai perlu diperiksa.** Ada tahap yang belum sesuai dengan data sebelumnya. Tombol: **Lihat perbedaan**. |
| Usulan diterima | **Masukan Anda sudah diterima.** Kami akan meninjaunya dan memperbarui status di halaman ini. |
| Opt-out promosi | **Preferensi Anda sudah disimpan.** Pesan promosi WhatsApp dihentikan; layanan akun tetap dapat digunakan. |

Larangan copy: “#1”, “pertama di Indonesia”, “kas pasti cair”, “aman 100%”, “otomatis terkirim”, “gratis selamanya”, logo pelanggan/testimoni tanpa bukti, dan countdown stok/diskon fiktif. Jangan menampilkan nama fase, commit hash, server guard, kode RPC atau identifier audit di alur beli; bukti versi tersedia pada sarana diagnostik yang berizin.

## 22. Batas Data dan Kepercayaan dalam UI

- Angka ilustrasi terpisah dari data pelanggan. Label **Ilustrasi • Data fiktif** selalu terlihat pada tur publik dan fixture pengujian visual.
- Nilai uang menampilkan mata uang, basis/periode, sumber atau waktu pembaruan yang relevan. Ringkasan tidak menjumlahkan mata uang berbeda tanpa konversi eksplisit.
- Total, persentase dan forecast mengikuti engine PRD. Desainer tidak menyederhanakan rumus agar grafik terlihat lebih baik.
- `0`, data tidak tersedia, belum dimuat, dan tidak punya izin memiliki tampilan berbeda. Field terlarang tidak dikirim lalu sekadar disembunyikan dengan CSS.
- Form kontak/promosi hanya mengumpulkan data yang disubmit pengguna. Tidak merekam ketikan email/telepon yang belum dikirim.
- Izin promosi WhatsApp dan pengukuran iklan dipisahkan dari persetujuan ketentuan akun. Pilihan tidak dicentang otomatis; menolak tidak menutup fitur inti.
- Status consent, invoice dan provider ditampilkan dari server. UI tidak memberikan hak akses atau menandai pembayaran sendiri.
- Detail financial/admin menampilkan audit yang dibutuhkan aktor berizin, bukan seluruh payload webhook mentah atau secret.
- Preview dokumen memakai akses terbatas. Berikan penjelasan jika tautan kadaluwarsa dan tombol meminta tautan baru melalui pemeriksaan izin.
- Provider Configuration merupakan area internal. Halaman pelanggan menampilkan informasi pembayaran yang membantu keputusan, bukan API URL, webhook token atau daftar konfigurasi gateway.

## 23. Urutan Implementasi untuk Antigravity

Ini adalah urutan pekerjaan desain/UX, **bukan penomoran ulang Phase 1–20 dan bukan izin deployment**. Terapkan satu paket kerja dalam satu waktu. Fitur growth/feedback tetap mengikuti gate 20A–20F pada PRD; menu tidak boleh menawarkan fungsi yang belum tersedia.

| Paket kerja | Fokus | Deliverable yang dapat ditinjau | Gerbang sebelum lanjut |
|---|---|---|---|
| UX-0 | audit rute, menu, komponen, auth, permission dan state yang ada | peta existing→target, daftar gap, risiko migrasi link, baseline screenshot | seluruh fitur lama memiliki tujuan baru; tidak ada anggapan implementasi hanya dari nama file |
| UX-1 | fondasi token + homepage + Cara kerja + Harga + Bantuan publik | desain responsif dan navigasi nyata; katalog read-only sesuai backend | calon pengguna memahami manfaat dan langkah berikutnya; tidak ada CTA palsu |
| UX-2 | signup/login, email confirmation, identitas perusahaan, checkout dan status | alur lengkap termasuk invited staff, no-org, pending dan restricted | bukti server session; zero redirect loop; tidak ada aktivasi dari redirect |
| UX-3 | shell workspace + Ringkasan + daftar/detail proyek | lima menu, lima tab proyek, state empty/loading/error | fitur lama tetap terjangkau; angka kumulatif dan gap terbaca tanpa double-count |
| UX-4 | tindakan, klaim, tagihan, dokumen, laporan dan Langganan COVE | task flow dengan data representatif dan permission | workflow inti dapat diselesaikan desktop/mobile; domain invoice tetap terpisah |
| UX-5 | Bantuan & Feedback; konsol internal growth/support bila gate fungsi siap | form, thread, request status, antrean operator, configuration state | tenant isolation, consent dan bukti pengiriman sesuai PRD; chatbot Later tidak dianggap tersedia |
| UX-6 | konsistensi, aksesibilitas, performa dan acceptance | hasil UAT-IA, daftar perbaikan, screenshot per viewport, catatan keterbatasan | bukti aktual untuk setiap gate; release mengikuti otorisasi dan proses proyek |

Pekerjaan pada paket berikutnya hanya dibuka sesuai arahan pengguna dan gate fungsional yang sudah disepakati. Proses desain tidak mewajibkan rewrite total, perubahan database, penggantian gateway, atau perubahan harga.

## 24. Definition of Done Desain dan UX

Status seluruh pemeriksaan implementasi pada dokumen ini adalah **BELUM DIUJI**. Tabel berikut merupakan kriteria penerimaan, bukan laporan lulus.

| ID | Kriteria | Bukti yang diminta |
|---|---|---|
| UX-A01 | Homepage menjawab untuk siapa, masalah apa, dan langkah berikutnya | sesi uji ≥5 calon pengguna; sasaran ≥4 memahami tanpa penjelasan |
| UX-A02 | Cara kerja dapat dilihat tanpa membuat akun | rekaman alur publik dan label ilustrasi |
| UX-A03 | Pengguna dapat menemukan paket, periode dan total yang relevan | screenshot desktop/mobile dan hasil tugas pencarian harga |
| UX-A04 | Plan/tujuan tidak hilang setelah signup/login/confirmation | uji perjalanan hingga checkout, tanpa membocorkan parameter sensitif |
| UX-A05 | Login pengguna nyata menghasilkan akses server yang konsisten | acceptance session endpoint + navigasi; React/mock state tidak cukup |
| UX-A06 | No-org, invited staff dan no-billing-role mempunyai tujuan tepat | ketiga skenario tanpa login loop atau pembayaran individual yang keliru |
| UX-A07 | Pesanan pending/unknown tidak mendorong pembayaran ganda | refresh, back, timeout, replay dan resume pada pesanan yang sama |
| UX-A08 | Status aktif hanya berdasarkan hasil billing sah | redirect/test event tidak mengaktifkan; pembayaran berizin terverifikasi bila gate mengizinkan |
| UX-A09 | Pelanggan baru dapat menyiapkan proyek; pelanggan lama kembali ke pekerjaannya | dua alur dengan konteks perusahaan/proyek yang benar |
| UX-A10 | Lima menu workspace dan tab proyek konsisten | sitemap, inventory rute, screenshot dan penelusuran fitur lama |
| UX-A11 | Invoice proyek dan Langganan COVE tidak tertukar | uji tugas “tagih owner proyek” versus “bayar layanan COVE” |
| UX-A12 | Summary/gap/tabel tidak menggandakan nilai | fixture §13 cocok dengan engine, drill-down dan ekspor |
| UX-A13 | Setiap daftar/form memiliki state loading, empty, error dan no permission | state gallery serta fault simulation pada data layer |
| UX-A14 | Tidak ada spinner penuh tanpa jalan keluar | uji jaringan lambat/putus dengan retry/resume/bantuan |
| UX-A15 | Mobile 320 px tetap dapat digunakan | screenshot dan tugas nyata; scroll dua dimensi hanya lokal bila perlu |
| UX-A16 | Keyboard, focus, reader labels, zoom dan contrast memenuhi target | pemeriksaan manual + alat aksesibilitas pada state aktual |
| UX-A17 | Bantuan/ekspor tetap terjangkau dalam restricted state sesuai izin | acceptance akun unpaid/read-only; tidak melemahkan write guard |
| UX-A18 | Feedback customer dan internal notes terpisah | UI + pemeriksaan respons API/export pada role berbeda |
| UX-A19 | WhatsApp/Meta menampilkan kemampuan dan consent yang benar | manual link bukan SENT; tidak ada tracker pada workspace/admin |
| UX-A20 | Handover tidak mengklaim hasil yang belum dijalankan | matriks PASS/FAIL/NOT RUN/BLOCKED dengan evidence dan commit bila implementasi |

Target performa desain: orbit ringan berbasis vektor/CSS, satu keluarga font, tanpa video autoplay, ukuran media eksplisit, dan data table bertahap sesuai kapasitas. Ukur hasil build aktual; jangan mengklaim angka performa atau Core Web Vitals dari spesifikasi saja.

## 25. Instruksi Handover

Saat memakai dokumen ini, Antigravity harus membaca PRD isi v2.2 dan ERD isi v2.1, kemudian menghasilkan peta halaman existing→target terlebih dahulu. `DESIGN.md` menentukan tampilan dan pengalaman; PRD menentukan aturan produk; ERD menentukan relasi data. Bila ada konflik keamanan/keuangan, jangan mengubah aturan agar cocok dengan mockup: catat konflik dan sesuaikan desain.

Output setiap paket kerja: ruang lingkup yang selesai, daftar halaman/komponen yang berubah, screenshot desktop dan mobile, state yang diuji, regresi yang dicek, serta item belum diuji. Tampilan yang dapat diklik belum cukup membuktikan auth, checkout, webhook atau entitlement berhasil.

Fokus hasil akhirnya: pengunjung tahu apa manfaat COVE dan bagaimana memulai; pelanggan tahu pekerjaan berikutnya; pengelola perusahaan tahu cara mengurus langganan; tim internal COVE memiliki konsol operasional yang terpisah dan berizin.

## 26. Referensi dan Status Bukti

| Sumber | Peran dalam dokumen | Status |
|---|---|---|
| Screenshot IFTTT yang dilampirkan pengguna (`29c1ecd7-c78a-4337-b883-2b1c362426bb.png`) | inspirasi hitam/putih, headline tebal, orbit dan pill CTA | diamati dari gambar; bukan bukti teknologi/font/integrasi IFTTT |
| `COVE_PRD_v2.0_Product_End_State.md`, isi v2.2 | arsitektur informasi, workflow, permission, requirement dan acceptance | dokumen spesifikasi; implementasi harus diaudit |
| `COVE_ERD_v2.0_Logical_Data_Model.md`, isi v2.1 | batas organisasi, billing, growth dan feedback | model logis; bukan pemeriksaan database production |
| [W3C — Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | target kontras teks | dibaca 7 September 2026 |
| [W3C — Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | target minimum AA dan standar sentuh internal | dibaca 7 September 2026 |
| [W3C — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | reflow halaman dan pengecualian tabel dua dimensi | dibaca 7 September 2026 |

Pilihan warna, ukuran, copy, susunan menu dan urutan halaman merupakan keputusan desain yang harus divalidasi dengan pengguna. Tidak ada klaim bahwa desain ini sudah diterapkan atau seluruh gate production telah lulus.
