# Panduan Pemasangan & Pengujian Tahap 3 (Google Apps Script)

## 1. Berkas Baru Tahap 3
Tambahkan berkas `.gs` berikut ke Google Apps Script Editor Anda (seluruh berkas Tahap 2 tetap dipertahankan):
- `MasterData.gs` — Master Wilayah Indonesia (cache lokal + sinkronisasi API otomatis), Pendidikan, Pekerjaan, dan Generasi.
- `Member.gs` — CRUD lengkap Anggota (Super Admin / Admin Keluarga dapat mengedit seluruh field: nama, gelar, kode silsilah, keturunan, generasi, tanggal lahir, status wafat, alamat bertingkat, kontak, pekerjaan, pendidikan, dan arsip).
- `FamilyTree.gs` — Graf Silsilah Multi-Pasangan, validasi anti-siklus (DFS), perhitungan generasi otomatis (BFS), dan pelacak hubungan kekerabatan.
- `Household.gs` — Pengelolaan Kepala Keluarga & Rumah Tangga, pindah rumah tangga, pergantian kepala keluarga, dan riwayat KK.
- Perbarui `Code.gs` dengan versi terbaru yang menyertakan seluruh endpoint `apiGetMasterBundles` s.d. `apiAssignMemberToHousehold`.

## 2. Pengujian Tahap 3
1. **Menu Edit Penuh Super Admin:** Buka Data Anggota, pilih salah satu anggota, klik **Edit Lengkap**, ubah nama, gelar, keturunan, generasi, tanggal lahir, status wafat, alamat wilayah bertingkat, lalu simpan dan cek perubahan tercatat di `AUDIT_LOG`.
2. **Multi-Pasangan & Anti-Siklus:** Buka Silsilah Keluarga, cek jalur `1.2 Masngudi` (memiliki 2 pasangan: Nailem & Sainah) serta `5.4.2`, coba tambahkan relasi orang tua–anak yang membentuk siklus (sistem harus menolak).
3. **Rumah Tangga (KK):** Buat/lihat rumah tangga, coba tugaskan kepala keluarga yang sama ke 2 rumah tangga aktif (sistem menolak kecuali izin ganda dicentang), uji pindah rumah tangga & ganti KK.
