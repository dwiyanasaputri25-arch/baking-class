# Ruang Rasa — Kelas Baking

Aplikasi kursus baking dengan React/Tailwind, API Express.js, dan MySQL. Frontend serta backend berada di folder terpisah dan dijalankan di terminal terpisah.

## Fitur

- Katalog kelas dan jadwal yang tersedia; detail kelas menampilkan harga, instruktur, studio, dan syarat & ketentuan.
- Pendaftaran akun dengan nama, email, nomor telepon, dan password. Tidak ada batas usia peserta.
- Profil peserta untuk memperbarui nama/nomor kontak serta mengganti password dengan verifikasi password lama.
- Alur pemesanan: setujui syarat kelas, pilih jadwal, tinjau ringkasan, konfirmasi, lalu transfer manual dan unggah bukti pembayaran.
- Admin mengatur rekening dan petunjuk transfer yang tersimpan di MySQL; detailnya tetap tampil pada riwayat pesanan hingga pembayaran selesai.
- Slot ditahan 12 jam sejak konfirmasi. Jika bukti belum masuk, pesanan kedaluwarsa dan kuota dilepas. Bukti yang sudah diunggah menunggu verifikasi admin tanpa melepas slot.
- Admin mengelola kelas/syarat, instruktur, studio, jadwal/kuota, dan verifikasi transfer. Setelah pembayaran disetujui, peserta melihat status terkonfirmasi beserta tanggal dan jam mulai.
- Bukti pembayaran dibatasi ke gambar JPG, PNG, atau WebP maksimal 5 MB dan hanya dapat diakses melalui endpoint admin terautentikasi.

## Persyaratan

- Node.js 22 atau lebih baru.
- MySQL 8.4 (dump sumber memakai tipe spasial MySQL dengan SRID 4326).
- Database `baking_classdwys`.

## Persiapan database

1. Import file SQL yang diberikan ke MySQL bila database belum diisi. Jika database tersebut sudah ada dan berisi data, jangan import ulang karena file sumber membuat tabel dan memasukkan data awal.
2. Database Laragon yang digunakan untuk proyek ini **sudah menjalankan migrasi `001_app_extensions.sql` dan `002_payment_settings.sql`**. Untuk database baru yang baru saja diisi dengan SQL sumber, jalankan kedua migrasi tepat satu kali secara berurutan:

   ```powershell
   Get-Content -Raw .\database\migrations\001_app_extensions.sql | & 'C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe' -u root -p
   Get-Content -Raw .\database\migrations\002_payment_settings.sql | & 'C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe' -u root -p
   ```

   Jangan jalankan ulang migrasi pada database Laragon yang sudah memakainya. Jika MySQL tidak memakai akun `root`, sesuaikan opsi `-u`. Migrasi menambah kolom akun, syarat kelas, kuota, status pemesanan, bukti pembayaran, dan pengaturan rekening sambil mempertahankan data yang sudah ada. Migrasi tidak untuk dijalankan berulang.

   Untuk import baru di Laragon (jika diperlukan), jalankan dari Command Prompt:

   ```bat
   "C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe" -u root -p baking_classdwys < "C:\Users\LENOVO\Downloads\baking_classdwys.sql"
   ```

3. Isi syarat & ketentuan pada setiap kelas dari dashboard admin sebelum membuka jadwal untuk pemesanan. Kelas tanpa syarat tidak dapat dipesan.

## Menjalankan backend

Buka terminal pertama:

```powershell
Set-Location C:\laragon\www\baking-class\backend
Copy-Item .env.example .env
```

Edit `backend\.env`:

- Atur kredensial MySQL.
- Ganti `JWT_SECRET` dengan nilai acak sekurangnya 32 karakter.
- Atur `ADMIN_EMAIL`, `ADMIN_PHONE`, dan `ADMIN_PASSWORD` (sekurangnya 12 karakter). Akun admin akan dibuat saat API pertama kali hidup; admin SQL bawaan yang tidak memiliki password tetap dipertahankan.
- Informasi rekening transfer dapat diisi melalui tab **Rekening transfer** di dashboard admin setelah masuk.
- Buat syarat & ketentuan kelas dan jadwal dari dashboard admin sebelum peserta dapat memesan.

Lalu jalankan:

```powershell
npm install
npm run dev
```

API tersedia di `http://localhost:4000`; health check: `http://localhost:4000/api/health`.

## Menjalankan frontend

Buka terminal kedua:

```powershell
Set-Location C:\laragon\www\baking-class\frontend
npm install
npm run dev
```

Buka alamat Vite yang ditampilkan (default `http://localhost:5173`). Saat development, Vite meneruskan `/api` ke backend. Untuk endpoint API selain default atau deployment, buat `frontend\.env.local` dan isi `VITE_API_URL=https://alamat-api/api`.

## Verifikasi lokal

Dari folder `backend`, jalankan `npm test`. Dari folder `frontend`, jalankan `npm run build`.

PDF proposal yang dilampirkan belum dapat ditinjau karena pembaca file lokal menolaknya; fitur di atas mengikuti alur yang dijelaskan langsung oleh pemilik kebutuhan.
