# Panduan Pemasangan & Pengujian Tahap 2 (Google Apps Script)

## 1. Pemasangan File ke Google Apps Script
1. Buka Google Spreadsheet yang berisi data lama Bani Haji Mohammad Tohir (pastikan nama tab sumber dicatat, default: `Sheet1`).
2. Klik menu **Ekstensi → Apps Script**.
3. Pastikan file `appsscript.json` menggunakan zona waktu `"timeZone": "Asia/Jakarta"`.
4. Buat file **Script (`.gs`)** berikut dan tempelkan kode lengkap dari masing-masing file:
   - `Config.gs`
   - `Utilities.gs`
   - `Database.gs`
   - `Auth.gs`
   - `User.gs`
   - `Migration.gs`
   - `Code.gs`
5. Buat file **HTML (`.html`)** berikut dan tempelkan kode lengkapnya:
   - `Index.html`
   - `Styles.html`
   - `Login.html`
   - `Dashboard.html`
   - `Scripts.html`

## 2. Deployment sebagai Web App
1. Klik **Terapkan (Deploy) → Deployment baru**.
2. Pilih jenis **Aplikasi web (Web app)**.
3. Atur:
   - **Jalankan sebagai (Execute as):** Saya (*Me*)
   - **Yang memiliki akses (Who has access):** Siapa saja (*Anyone*) — autentikasi dikelola penuh oleh sistem login internal aplikasi.
4. Klik **Terapkan** dan izinkan akses Google Spreadsheet & Google Drive.

## 3. Pengujian Tahap 2
1. **Aktivasi Admin Pertama:** Buka URL Web App. Karena sheet `USERS` belum memiliki Super Admin, form **Aktivasi Admin Pertama** akan muncul otomatis. Daftarkan ID Login dan password minimal 8 karakter.
2. **Inisialisasi & Migrasi Aman:**
   - Masuk menu **Migrasi & Staging**.
   - Klik **1. Inisialisasi 32 Sheet** (verifikasi sheet lama tidak terhapus).
   - Klik **2. Arsipkan ke RAW_LEGACY_2026**.
   - Pilih opsi **Sesuaikan & Generate Kode Otomatis**, lalu klik **3. Jalankan Dry-Run Staging**.
   - Gunakan filter *Anomali Kode* dan *Perlu Edit Tgl Lahir*, coba tombol **Edit** untuk memperbarui tanggal lahir.
   - Klik **4. Commit ke Database Produksi**.
3. **Verifikasi Dashboard & Keamanan:**
   - Cek **Dashboard** menampilkan angka nyata dari database.
   - Uji **Akun & Hak Akses** (tambah akun, nonaktifkan akun) dan **Ganti Password**.
   - Uji percobaan password salah 5 kali berturut-turut (akun otomatis terkunci 15 menit dan tercatat di **Audit Log**).
