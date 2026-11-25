/**
 * Config.gs
 * Konfigurasi global, daftar lengkap skema 30 sheet database, dan data master awal.
 * Aplikasi: Sistem Informasi Keluarga Besar Bani Haji Mohammad Tohir
 * Tagline : Guyub, Akur, Semedulur
 * Zona Waktu: Asia/Jakarta
 */

var APP_CONFIG = {
  APP_NAME: 'Sistem Informasi Keluarga Besar Bani Haji Mohammad Tohir',
  SHORT_NAME: 'Bani H. M. Tohir',
  TAGLINE: 'Guyub, Akur, Semedulur',
  TIMEZONE: 'Asia/Jakarta',
  VERSION: '4.0.0-Tahap4',
  SESSION_TTL_SECONDS: 14400, // 4 jam
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_MINUTES: 15,
  ROOT_MEMBER_ID: 'BMT-0000',
  ROOT_MEMBER_NAME: 'Haji Mohammad Tohir',
  BACKUP_FOLDER_NAME: 'Backup_DB_Bani_Tohir',
  DEFAULT_SOURCE_SHEET: 'Sheet1'
};

var SHEET_NAMES = {
  CONFIG: 'CONFIG',
  USERS: 'USERS',
  ROLES_PERMISSIONS: 'ROLES_PERMISSIONS',
  ANGGOTA: 'ANGGOTA',
  HUBUNGAN_ORANGTUA: 'HUBUNGAN_ORANGTUA',
  PASANGAN: 'PASANGAN',
  RUMAH_TANGGA: 'RUMAH_TANGGA',
  ANGGOTA_RUMAH: 'ANGGOTA_RUMAH',
  RIWAYAT_KK: 'RIWAYAT_KK',
  MASTER_WILAYAH: 'MASTER_WILAYAH',
  MASTER_PENDIDIKAN: 'MASTER_PENDIDIKAN',
  MASTER_PEKERJAAN: 'MASTER_PEKERJAAN',
  MASTER_GENERASI: 'MASTER_GENERASI',
  JABATAN: 'JABATAN',
  PENGURUS: 'PENGURUS',
  KEGIATAN: 'KEGIATAN',
  PENGUMUMAN: 'PENGUMUMAN',
  UNDANGAN: 'UNDANGAN',
  SURAT: 'SURAT',
  COA: 'COA',
  ANGGARAN: 'ANGGARAN',
  MASTER_TARIF_IURAN: 'MASTER_TARIF_IURAN',
  TAGIHAN_IURAN: 'TAGIHAN_IURAN',
  PEMBAYARAN: 'PEMBAYARAN',
  TRANSAKSI: 'TRANSAKSI',
  JURNAL: 'JURNAL',
  BUKTI_TRANSAKSI: 'BUKTI_TRANSAKSI',
  AUDIT_LOG: 'AUDIT_LOG',
  PENGAJUAN_PERUBAHAN: 'PENGAJUAN_PERUBAHAN',
  NOTIFIKASI: 'NOTIFIKASI',
  ARSIP: 'ARSIP',
  RAW_LEGACY_2026: 'RAW_LEGACY_2026',
  MIGRASI_STAGING: 'MIGRASI_STAGING'
};

var SHEET_SCHEMAS = {
  CONFIG: ['config_key', 'config_value', 'kategori', 'deskripsi', 'updated_at', 'updated_by'],
  USERS: ['user_id', 'id_anggota', 'username_login', 'nama_tampilan', 'password_hash', 'salt', 'role_id', 'status_akun', 'failed_attempts', 'locked_until', 'last_login', 'must_change_pwd', 'created_at', 'updated_at'],
  ROLES_PERMISSIONS: ['permission_id', 'role_id', 'nama_role', 'modul', 'can_view', 'can_create', 'can_edit', 'can_delete', 'can_export', 'view_sensitive_contact', 'view_finance_detail'],
  ANGGOTA: [
    'id_anggota', 'kode_silsilah', 'kode_legacy', 'gelar_depan', 'nama_lengkap', 'gelar_belakang',
    'nama_panggilan', 'jenis_kelamin', 'foto_drive_id', 'tempat_lahir', 'tanggal_lahir',
    'presisi_tgl_lahir', 'status_keturunan', 'generasi_level', 'generasi_label', 'status_hidup',
    'tanggal_wafat', 'tempat_wafat', 'catatan_wafat', 'provinsi_id', 'kabkota_id',
    'kecamatan_id', 'kelurahan_id', 'nama_jalan', 'rt', 'rw', 'no_rumah', 'kode_pos',
    'keterangan_alamat', 'no_hp', 'no_hp_alt', 'email', 'pendidikan_id', 'pekerjaan_id',
    'pekerjaan_lainnya', 'is_kk', 'status_keanggotaan', 'tanggal_gabung', 'catatan',
    'is_archived', 'needs_verification', 'created_at', 'created_by', 'updated_at', 'updated_by'
  ],
  HUBUNGAN_ORANGTUA: ['relasi_ortu_id', 'id_anak', 'id_ayah', 'id_ibu', 'id_pasangan_ortu', 'jenis_hubungan', 'urutan_anak', 'keterangan', 'status_aktif', 'created_at', 'created_by'],
  PASANGAN: ['relasi_pasangan_id', 'id_anggota_1', 'id_anggota_2', 'urutan_pasangan', 'tanggal_menikah', 'tanggal_berakhir', 'status_hubungan', 'keterangan', 'status_aktif', 'created_at', 'created_by'],
  RUMAH_TANGGA: ['id_rumah_tangga', 'nama_rumah_tangga', 'id_kepala_keluarga', 'provinsi_id', 'kabkota_id', 'kecamatan_id', 'kelurahan_id', 'alamat_ringkas', 'no_kontak_rt', 'status_aktif', 'izinkan_kk_ganda', 'tanggal_bentuk', 'keterangan', 'created_at', 'updated_at'],
  ANGGOTA_RUMAH: ['id_anggota_rumah', 'id_rumah_tangga', 'id_anggota', 'peran_dalam_rt', 'tanggal_masuk', 'tanggal_keluar', 'status_aktif', 'created_at'],
  RIWAYAT_KK: ['id_riwayat_kk', 'id_rumah_tangga', 'id_kk_lama', 'id_kk_baru', 'tanggal_pergantian', 'alasan', 'pencatat_user_id', 'created_at'],
  MASTER_WILAYAH: ['kode_wilayah', 'tingkat', 'kode_induk', 'nama_wilayah', 'kode_pos_default', 'sumber', 'last_synced'],
  MASTER_PENDIDIKAN: ['pendidikan_id', 'nama_pendidikan', 'urutan', 'status_aktif'],
  MASTER_PEKERJAAN: ['pekerjaan_id', 'nama_pekerjaan', 'kategori', 'urutan', 'status_aktif'],
  MASTER_GENERASI: ['generasi_id', 'level_angka', 'nama_generasi', 'deskripsi', 'status_aktif'],
  JABATAN: ['jabatan_id', 'nama_jabatan', 'level_hierarki', 'induk_jabatan_id', 'deskripsi_tugas', 'status_aktif'],
  PENGURUS: ['pengurus_id', 'jabatan_id', 'id_anggota', 'periode_nama', 'tanggal_mulai', 'tanggal_berakhir', 'no_sk', 'dokumen_sk_drive_id', 'status_aktif', 'keterangan', 'created_at'],
  KEGIATAN: ['kegiatan_id', 'nama_kegiatan', 'kategori_kegiatan', 'tanggal_mulai', 'tanggal_selesai', 'lokasi', 'id_penanggung_jawab', 'coa_terkait', 'anggaran_rencana', 'status_kegiatan', 'deskripsi', 'created_at', 'created_by'],
  PENGUMUMAN: ['pengumuman_id', 'judul', 'kategori', 'isi', 'target_audiens', 'is_pinned', 'tanggal_publikasi', 'status_aktif', 'penulis_user_id', 'created_at'],
  UNDANGAN: ['undangan_id', 'kegiatan_id', 'surat_id', 'target_tipe', 'target_id', 'status_kirim', 'tanggal_kirim', 'status_hadir', 'file_pdf_drive_id', 'created_at'],
  SURAT: ['surat_id', 'nomor_surat', 'jenis_surat', 'template_doc_id', 'perihal', 'isi_surat', 'tanggal_surat', 'penerima_tipe', 'penerima_id', 'pejabat_ttd_id', 'doc_drive_id', 'pdf_drive_id', 'status_surat', 'created_at', 'created_by'],
  COA: ['kode_akun', 'nama_akun', 'kategori', 'sub_kategori', 'saldo_normal', 'is_kas_bank', 'status_aktif', 'keterangan'],
  ANGGARAN: ['anggaran_id', 'tahun_anggaran', 'kegiatan_id', 'kode_akun', 'nominal_anggaran', 'keterangan', 'status_aktif', 'created_at'],
  MASTER_TARIF_IURAN: ['tarif_id', 'tahun_iuran', 'nominal_standar', 'target_total_tahun', 'periode_tipe', 'jatuh_tempo', 'keterangan', 'status_aktif'],
  TAGIHAN_IURAN: ['tagihan_id', 'tahun_iuran', 'id_rumah_tangga', 'id_kk', 'nominal_tagihan', 'diskon_pembebasan', 'alasan_pembebasan', 'total_terbayar', 'sisa_tagihan', 'status_bayar', 'jatuh_tempo', 'updated_at'],
  PEMBAYARAN: ['pembayaran_id', 'tagihan_id', 'id_rumah_tangga', 'tahun_iuran', 'tanggal_bayar', 'nominal_bayar', 'metode_bayar', 'transaksi_id', 'petugas_user_id', 'no_kuitansi', 'kuitansi_drive_id', 'bukti_id', 'keterangan', 'created_at'],
  TRANSAKSI: ['transaksi_id', 'no_transaksi', 'tanggal_transaksi', 'jenis_transaksi', 'sumber_dana_akun', 'kegiatan_id', 'keterangan', 'total_nominal', 'status_verifikasi', 'is_published', 'ref_koreksi_id', 'pencatat_user_id', 'verifikator_user_id', 'verified_at', 'created_at'],
  JURNAL: ['jurnal_id', 'transaksi_id', 'tanggal', 'kode_akun', 'debit', 'kredit', 'keterangan_baris', 'urutan'],
  BUKTI_TRANSAKSI: ['bukti_id', 'transaksi_id', 'nama_file', 'drive_file_id', 'drive_url', 'mime_type', 'uploaded_by', 'uploaded_at'],
  AUDIT_LOG: ['log_id', 'timestamp', 'user_id', 'username', 'role', 'aksi', 'entitas', 'record_id', 'nilai_lama_json', 'nilai_baru_json', 'status_hasil', 'catatan'],
  PENGAJUAN_PERUBAHAN: ['pengajuan_id', 'id_anggota_target', 'pengaju_user_id', 'tipe_pengajuan', 'payload_json', 'status_review', 'reviewer_user_id', 'catatan_review', 'created_at', 'reviewed_at'],
  NOTIFIKASI: ['notif_id', 'target_user_id', 'judul', 'pesan', 'kategori', 'link_modul', 'is_read', 'created_at'],
  ARSIP: ['arsip_id', 'kategori_arsip', 'judul', 'tanggal_dokumen', 'kegiatan_id', 'drive_file_id', 'drive_url', 'deskripsi', 'visibilitas', 'uploaded_by', 'uploaded_at'],
  RAW_LEGACY_2026: ['raw_row_no', 'NO', 'KODE', 'NAMA', 'IURAN', 'TEMPAT_TGL_LAHIR', 'KETERANGAN', 'STATUS', 'KK', 'PEKERJAAN', 'ALAMAT', 'EMAIL', 'NO_HP', 'WAFAT', 'TGL_WAFAT', 'LEN', 'archived_at'],
  MIGRASI_STAGING: [
    'staging_id', 'raw_row_no', 'raw_no', 'raw_kode', 'generated_kode', 'code_resolution_mode',
    'id_anggota_calon', 'gelar_depan', 'nama_lengkap', 'gelar_belakang', 'status_keturunan',
    'generasi_level', 'generasi_label', 'tempat_lahir', 'tanggal_lahir_iso', 'presisi_tgl_lahir',
    'raw_ttl', 'status_hidup', 'tanggal_wafat_raw', 'is_kk', 'pekerjaan_raw', 'alamat_raw',
    'email', 'no_hp', 'iuran_nominal', 'is_multi_spouse_group', 'anomaly_flags', 'action_status', 'updated_at'
  ]
};

var SEED_CONFIG = [
  { config_key: 'NAMA_PAGUYUBAN', config_value: 'Keluarga Besar Bani Haji Mohammad Tohir', kategori: 'IDENTITAS', deskripsi: 'Nama resmi paguyuban keluarga' },
  { config_key: 'TAGLINE', config_value: 'Guyub, Akur, Semedulur', kategori: 'IDENTITAS', deskripsi: 'Semboyan resmi aplikasi' },
  { config_key: 'ID_LELUHUR_UTAMA', config_value: 'BMT-0000', kategori: 'SILSILAH', deskripsi: 'ID Anggota Leluhur Utama (Level 0)' },
  { config_key: 'NAMA_LELUHUR_UTAMA', config_value: 'Haji Mohammad Tohir', kategori: 'SILSILAH', deskripsi: 'Nama Leluhur Utama' },
  { config_key: 'TAHUN_ANGGARAN_AKTIF', config_value: '2026', kategori: 'KEUANGAN', deskripsi: 'Tahun buku aktif paguyuban' },
  { config_key: 'TRANSPARANSI_PUBLIK_ANGGOTA', config_value: 'TRUE', kategori: 'KEUANGAN', deskripsi: 'Anggota dapat melihat ringkasan keuangan yang dipublikasikan' },
  { config_key: 'SCHEMA_VERSION', config_value: '2.0.0', kategori: 'SISTEM', deskripsi: 'Versi skema database spreadsheet' }
];

var SEED_ROLES_PERMISSIONS = (function () {
  var roles = [
    { role_id: 'SUPER_ADMIN', nama: 'Super Admin', moduls: { DASHBOARD: [1,1,1,1,1,1,1], ANGGOTA: [1,1,1,1,1,1,0], SILSILAH: [1,1,1,1,1,1,0], RUMAH_TANGGA: [1,1,1,1,1,1,0], ORGANISASI: [1,1,1,1,1,0,0], KEUANGAN: [1,1,1,1,1,1,1], SURAT: [1,1,1,1,1,1,0], LAPORAN: [1,0,0,0,1,1,1], PENGATURAN: [1,1,1,1,1,1,1], USERS: [1,1,1,1,1,1,0], MIGRASI: [1,1,1,1,1,1,0], AUDIT_LOG: [1,0,0,0,1,1,1] } },
    { role_id: 'ADMIN_KELUARGA', nama: 'Admin Keluarga', moduls: { DASHBOARD: [1,0,0,0,1,1,0], ANGGOTA: [1,1,1,1,1,1,0], SILSILAH: [1,1,1,1,1,1,0], RUMAH_TANGGA: [1,1,1,1,1,1,0], ORGANISASI: [1,0,0,0,1,0,0], KEUANGAN: [1,0,0,0,0,0,0], SURAT: [1,0,0,0,1,0,0], LAPORAN: [1,0,0,0,1,0,0], PENGATURAN: [1,1,1,0,0,0,0], USERS: [0,0,0,0,0,0,0], MIGRASI: [1,1,1,0,0,1,0], AUDIT_LOG: [0,0,0,0,0,0,0] } },
    { role_id: 'PENGURUS', nama: 'Pengurus', moduls: { DASHBOARD: [1,0,0,0,1,0,0], ANGGOTA: [1,0,0,0,1,0,0], SILSILAH: [1,0,0,0,1,0,0], RUMAH_TANGGA: [1,0,0,0,0,0,0], ORGANISASI: [1,1,1,0,1,0,0], KEUANGAN: [1,0,0,0,0,0,0], SURAT: [1,1,1,0,1,0,0], LAPORAN: [1,0,0,0,1,0,0], PENGATURAN: [0,0,0,0,0,0,0], USERS: [0,0,0,0,0,0,0], MIGRASI: [0,0,0,0,0,0,0], AUDIT_LOG: [0,0,0,0,0,0,0] } },
    { role_id: 'BENDAHARA', nama: 'Bendahara', moduls: { DASHBOARD: [1,0,0,0,1,0,1], ANGGOTA: [1,0,0,0,0,0,0], SILSILAH: [1,0,0,0,1,0,0], RUMAH_TANGGA: [1,0,0,0,1,0,0], ORGANISASI: [1,0,0,0,0,0,0], KEUANGAN: [1,1,1,0,1,0,1], SURAT: [1,0,0,0,0,0,0], LAPORAN: [1,0,0,0,1,0,1], PENGATURAN: [1,1,1,0,0,0,1], USERS: [0,0,0,0,0,0,0], MIGRASI: [0,0,0,0,0,0,0], AUDIT_LOG: [1,0,0,0,0,0,1] } },
    { role_id: 'SEKRETARIS', nama: 'Sekretaris', moduls: { DASHBOARD: [1,0,0,0,1,1,0], ANGGOTA: [1,1,1,0,1,1,0], SILSILAH: [1,0,0,0,1,0,0], RUMAH_TANGGA: [1,1,1,0,1,1,0], ORGANISASI: [1,1,1,0,1,1,0], KEUANGAN: [1,0,0,0,0,0,0], SURAT: [1,1,1,1,1,1,0], LAPORAN: [1,0,0,0,1,1,0], PENGATURAN: [1,1,1,0,0,0,0], USERS: [0,0,0,0,0,0,0], MIGRASI: [0,0,0,0,0,0,0], AUDIT_LOG: [0,0,0,0,0,0,0] } },
    { role_id: 'ANGGOTA', nama: 'Anggota', moduls: { DASHBOARD: [1,0,0,0,0,0,0], ANGGOTA: [1,0,0,0,0,0,0], SILSILAH: [1,0,0,0,1,0,0], RUMAH_TANGGA: [1,0,0,0,0,0,0], ORGANISASI: [1,0,0,0,0,0,0], KEUANGAN: [1,0,0,0,0,0,0], SURAT: [1,0,0,0,0,0,0], LAPORAN: [1,0,0,0,0,0,0], PENGATURAN: [0,0,0,0,0,0,0], USERS: [0,0,0,0,0,0,0], MIGRASI: [0,0,0,0,0,0,0], AUDIT_LOG: [0,0,0,0,0,0,0] } }
  ];
  var rows = [];
  var seq = 1;
  roles.forEach(function (r) {
    Object.keys(r.moduls).forEach(function (mod) {
      var flags = r.moduls[mod];
      rows.push({
        permission_id: 'PERM-' + ('000' + seq++).slice(-3),
        role_id: r.role_id,
        nama_role: r.nama,
        modul: mod,
        can_view: flags[0] === 1,
        can_create: flags[1] === 1,
        can_edit: flags[2] === 1,
        can_delete: flags[3] === 1,
        can_export: flags[4] === 1,
        view_sensitive_contact: flags[5] === 1,
        view_finance_detail: flags[6] === 1
      });
    });
  });
  return rows;
})();

var SEED_GENERASI = [
  { generasi_id: 'GEN-0', level_angka: 0, nama_generasi: 'Leluhur Utama', deskripsi: 'Haji Mohammad Tohir & Pasangan', status_aktif: true },
  { generasi_id: 'GEN-1', level_angka: 1, nama_generasi: 'Anak', deskripsi: 'Generasi ke-1 (Putra/Putri Leluhur Utama)', status_aktif: true },
  { generasi_id: 'GEN-2', level_angka: 2, nama_generasi: 'Cucu', deskripsi: 'Generasi ke-2', status_aktif: true },
  { generasi_id: 'GEN-3', level_angka: 3, nama_generasi: 'Buyut', deskripsi: 'Generasi ke-3', status_aktif: true },
  { generasi_id: 'GEN-4', level_angka: 4, nama_generasi: 'Canggah', deskripsi: 'Generasi ke-4', status_aktif: true },
  { generasi_id: 'GEN-5', level_angka: 5, nama_generasi: 'Wareng', deskripsi: 'Generasi ke-5', status_aktif: true },
  { generasi_id: 'GEN-6', level_angka: 6, nama_generasi: 'Udeg-udeg', deskripsi: 'Generasi ke-6', status_aktif: true },
  { generasi_id: 'GEN-7', level_angka: 7, nama_generasi: 'Gantung Siwur', deskripsi: 'Generasi ke-7', status_aktif: true }
];

var SEED_PENDIDIKAN = [
  'Tidak diketahui', 'Tidak sekolah', 'SD/Sederajat', 'SMP/Sederajat',
  'SMA/SMK/Sederajat', 'D1', 'D2', 'D3', 'D4', 'S1/Sederajat', 'S2', 'S3', 'Lainnya'
].map(function (nama, idx) {
  return { pendidikan_id: 'PDD-' + ('00' + (idx + 1)).slice(-2), nama_pendidikan: nama, urutan: idx + 1, status_aktif: true };
});

var SEED_PEKERJAAN = [
  'PNS/ASN', 'TNI', 'POLRI', 'Pegawai BUMN', 'Pegawai Swasta', 'Guru', 'Dosen',
  'Wiraswasta', 'Pengusaha', 'Petani', 'Nelayan', 'Pedagang', 'Profesional',
  'Ibu/Bapak Rumah Tangga', 'Pelajar/Mahasiswa', 'Pensiunan', 'Belum Bekerja', 'Lainnya'
].map(function (nama, idx) {
  return { pekerjaan_id: 'PKJ-' + ('00' + (idx + 1)).slice(-2), nama_pekerjaan: nama, kategori: 'UMUM', urutan: idx + 1, status_aktif: true };
});

var SEED_JABATAN = [
  { jabatan_id: 'JBT-01', nama_jabatan: 'Pelindung / Sesepuh', level_hierarki: 1, induk_jabatan_id: '', deskripsi_tugas: 'Penasihat dan sesepuh keluarga besar', status_aktif: true },
  { jabatan_id: 'JBT-02', nama_jabatan: 'Ketua Paguyuban', level_hierarki: 2, induk_jabatan_id: 'JBT-01', deskripsi_tugas: 'Pimpinan umum paguyuban', status_aktif: true },
  { jabatan_id: 'JBT-03', nama_jabatan: 'Wakil Ketua', level_hierarki: 3, induk_jabatan_id: 'JBT-02', deskripsi_tugas: 'Pendamping dan wakil ketua', status_aktif: true },
  { jabatan_id: 'JBT-04', nama_jabatan: 'Sekretaris', level_hierarki: 3, induk_jabatan_id: 'JBT-02', deskripsi_tugas: 'Administrasi data, surat, dan arsip', status_aktif: true },
  { jabatan_id: 'JBT-05', nama_jabatan: 'Bendahara', level_hierarki: 3, induk_jabatan_id: 'JBT-02', deskripsi_tugas: 'Pengelolaan iuran dan keuangan', status_aktif: true },
  { jabatan_id: 'JBT-06', nama_jabatan: 'Humas & Dokumentasi', level_hierarki: 4, induk_jabatan_id: 'JBT-02', deskripsi_tugas: 'Informasi, publikasi, dan dokumentasi kegiatan', status_aktif: true },
  { jabatan_id: 'JBT-07', nama_jabatan: 'Koordinator Cabang Keturunan', level_hierarki: 4, induk_jabatan_id: 'JBT-02', deskripsi_tugas: 'Koordinasi per cabang anak leluhur utama', status_aktif: true }
];

var SEED_COA = [
  { kode_akun: '1101', nama_akun: 'Kas Umum', kategori: 'ASET', sub_kategori: 'KAS', saldo_normal: 'DEBIT', is_kas_bank: true, status_aktif: true, keterangan: 'Kas tunai operasional paguyuban' },
  { kode_akun: '1102', nama_akun: 'Kas Kegiatan', kategori: 'ASET', sub_kategori: 'KAS', saldo_normal: 'DEBIT', is_kas_bank: true, status_aktif: true, keterangan: 'Kas khusus panitia kegiatan' },
  { kode_akun: '1103', nama_akun: 'Kas Iuran', kategori: 'ASET', sub_kategori: 'KAS', saldo_normal: 'DEBIT', is_kas_bank: true, status_aktif: true, keterangan: 'Kas penerimaan iuran anggota' },
  { kode_akun: '1201', nama_akun: 'Bank Paguyuban', kategori: 'ASET', sub_kategori: 'BANK', saldo_normal: 'DEBIT', is_kas_bank: true, status_aktif: true, keterangan: 'Rekening bank resmi paguyuban' },
  { kode_akun: '1301', nama_akun: 'Piutang Iuran Anggota', kategori: 'ASET', sub_kategori: 'PIUTANG', saldo_normal: 'DEBIT', is_kas_bank: false, status_aktif: true, keterangan: 'Tagihan iuran akrual yang belum lunas' },
  { kode_akun: '2101', nama_akun: 'Utang Kegiatan', kategori: 'KEWAJIBAN', sub_kategori: 'UTANG', saldo_normal: 'KREDIT', is_kas_bank: false, status_aktif: true, keterangan: 'Kewajiban biaya kegiatan belum dibayar' },
  { kode_akun: '2102', nama_akun: 'Kewajiban Lainnya', kategori: 'KEWAJIBAN', sub_kategori: 'UTANG', saldo_normal: 'KREDIT', is_kas_bank: false, status_aktif: true, keterangan: 'Kewajiban jangka pendek lainnya' },
  { kode_akun: '3101', nama_akun: 'Saldo Dana Awal', kategori: 'SALDO_DANA', sub_kategori: 'MODAL_DANA', saldo_normal: 'KREDIT', is_kas_bank: false, status_aktif: true, keterangan: 'Saldo awal dana paguyuban' },
  { kode_akun: '3201', nama_akun: 'Surplus/Defisit Akumulatif', kategori: 'SALDO_DANA', sub_kategori: 'AKUMULASI', saldo_normal: 'KREDIT', is_kas_bank: false, status_aktif: true, keterangan: 'Akumulasi surplus/defisit tahunan' },
  { kode_akun: '3301', nama_akun: 'Dana Terikat Kegiatan', kategori: 'SALDO_DANA', sub_kategori: 'TERIKAT', saldo_normal: 'KREDIT', is_kas_bank: false, status_aktif: true, keterangan: 'Dana donasi khusus per kegiatan' },
  { kode_akun: '4101', nama_akun: 'Pendapatan Iuran Anggota', kategori: 'PENDAPATAN', sub_kategori: 'IURAN', saldo_normal: 'KREDIT', is_kas_bank: false, status_aktif: true, keterangan: 'Penerimaan iuran wajib kepala keluarga' },
  { kode_akun: '4102', nama_akun: 'Sumbangan Sukarela', kategori: 'PENDAPATAN', sub_kategori: 'SUMBANGAN', saldo_normal: 'KREDIT', is_kas_bank: false, status_aktif: true, keterangan: 'Sumbangan sukarela anggota keluarga' },
  { kode_akun: '4103', nama_akun: 'Donasi', kategori: 'PENDAPATAN', sub_kategori: 'DONASI', saldo_normal: 'KREDIT', is_kas_bank: false, status_aktif: true, keterangan: 'Donasi khusus dari donatur' },
  { kode_akun: '4104', nama_akun: 'Pendapatan Kegiatan', kategori: 'PENDAPATAN', sub_kategori: 'KEGIATAN', saldo_normal: 'KREDIT', is_kas_bank: false, status_aktif: true, keterangan: 'Penerimaan langsung pada acara/kegiatan' },
  { kode_akun: '4109', nama_akun: 'Pendapatan Lainnya', kategori: 'PENDAPATAN', sub_kategori: 'LAINNYA', saldo_normal: 'KREDIT', is_kas_bank: false, status_aktif: true, keterangan: 'Penerimaan lain di luar kategori utama' },
  { kode_akun: '5101', nama_akun: 'Beban Konsumsi', kategori: 'BEBAN', sub_kategori: 'OPERASIONAL', saldo_normal: 'DEBIT', is_kas_bank: false, status_aktif: true, keterangan: 'Biaya konsumsi rapat & silaturahmi' },
  { kode_akun: '5102', nama_akun: 'Beban Sewa Tempat', kategori: 'BEBAN', sub_kategori: 'OPERASIONAL', saldo_normal: 'DEBIT', is_kas_bank: false, status_aktif: true, keterangan: 'Sewa aula/tempat pertemuan' },
  { kode_akun: '5103', nama_akun: 'Beban Perlengkapan', kategori: 'BEBAN', sub_kategori: 'OPERASIONAL', saldo_normal: 'DEBIT', is_kas_bank: false, status_aktif: true, keterangan: 'Perlengkapan acara dan alat tulis' },
  { kode_akun: '5104', nama_akun: 'Beban Transportasi', kategori: 'BEBAN', sub_kategori: 'OPERASIONAL', saldo_normal: 'DEBIT', is_kas_bank: false, status_aktif: true, keterangan: 'Transportasi kepengurusan/panitia' },
  { kode_akun: '5105', nama_akun: 'Beban Dokumentasi', kategori: 'BEBAN', sub_kategori: 'MEDIA', saldo_normal: 'DEBIT', is_kas_bank: false, status_aktif: true, keterangan: 'Foto, video, dan pencetakan album' },
  { kode_akun: '5106', nama_akun: 'Beban Publikasi', kategori: 'BEBAN', sub_kategori: 'MEDIA', saldo_normal: 'DEBIT', is_kas_bank: false, status_aktif: true, keterangan: 'Spanduk, media informasi, dll.' },
  { kode_akun: '5107', nama_akun: 'Beban Undangan', kategori: 'BEBAN', sub_kategori: 'ADMINISTRASI', saldo_normal: 'DEBIT', is_kas_bank: false, status_aktif: true, keterangan: 'Cetak & pengiriman undangan' },
  { kode_akun: '5108', nama_akun: 'Beban Santunan Sosial', kategori: 'BEBAN', sub_kategori: 'SOSIAL', saldo_normal: 'DEBIT', is_kas_bank: false, status_aktif: true, keterangan: 'Santunan duka/sakit/sosial keluarga' },
  { kode_akun: '5109', nama_akun: 'Beban Administrasi', kategori: 'BEBAN', sub_kategori: 'ADMINISTRASI', saldo_normal: 'DEBIT', is_kas_bank: false, status_aktif: true, keterangan: 'Biaya administrasi bank/surat' },
  { kode_akun: '5199', nama_akun: 'Beban Lainnya', kategori: 'BEBAN', sub_kategori: 'LAINNYA', saldo_normal: 'DEBIT', is_kas_bank: false, status_aktif: true, keterangan: 'Pengeluaran lain yang sah' }
];
