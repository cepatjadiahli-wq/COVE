# Login COVE yang lebih sederhana

## Perilaku yang diperbaiki
- Halaman masuk cukup meminta email dan kata sandi; daftar akun tetap jelas dan terpisah dari checkout.
- Pengguna dapat melihat kata sandi, mempertahankan email antarhalaman, dan memahami kesalahan dalam bahasa Indonesia.
- Signup dan kirim ulang verifikasi memakai layanan Supabase sungguhan dan callback pada origin aplikasi, dengan tujuan internal yang divalidasi.
- Login dan callback memakai status akun terbaru dari API untuk memilih workspace, onboarding, atau pemilih perusahaan.
- Pemulihan password menampilkan kegagalan pengiriman dan menunggu pemeriksaan sesi sebelum menampilkan formulir.

## Batas keamanan
Sesi Supabase dan otorisasi backend tetap menjadi sumber akses. Query URL atau klik tombol tidak memberikan akses. Kata sandi/token tidak disimpan dalam state perjalanan, URL, atau log; hanya email sementara disimpan per tab. Pesan kesalahan tidak membocorkan respons internal. Cooldown UI mendampingi batas kirim email penyedia. Tidak ada perubahan skema atau bypass autentikasi.

## Verifikasi
Tes interaksi memeriksa login dengan status baru, signup tanpa sesi, callback aman, pengiriman ulang berhasil/gagal, kegagalan pemulihan password, sesi reset belum siap, dan password visibility. Tes store memeriksa tenant, logout, kesalahan API, dan auth callback. Jalankan build frontend, tes regresi backend, lalu deploy preview dan periksa UI staging. Pengiriman email nyata memerlukan konfigurasi redirect/SMTP Supabase dan alamat email pengguna.
