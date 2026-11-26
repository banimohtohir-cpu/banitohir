export type RoleId =
  | 'SUPER_ADMIN'
  | 'ADMIN_KELUARGA'
  | 'PENGURUS'
  | 'BENDAHARA'
  | 'SEKRETARIS'
  | 'ANGGOTA';

export interface SafeUser {
  user_id: string;
  id_anggota: string;
  username_login: string;
  nama_tampilan: string;
  role_id: RoleId;
  status_akun: 'AKTIF' | 'NONAKTIF';
  last_login: string;
  must_change_pwd: boolean;
}

export interface ModulePermission {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
  view_sensitive_contact: boolean;
  view_finance_detail: boolean;
}

export interface DashboardStats {
  totalAnggota: number;
  kandung: number;
  menantu: number;
  hidup: number;
  wafat: number;
  belumJelasHidup: number;
  kepalaKeluarga: number;
  perluEditDob: number;
  totalIuran: number;
  targetIuran?: number;
  totalIuranTerbayar?: number;
  perGenerasi: Record<string, number>;
  perCabang: Record<string, number>;
  isFromStaging: boolean;
  dbInitialized: boolean;
  serverTime: string;
}

export interface StagingRow {
  staging_id: string;
  raw_row_no: number;
  raw_no: string;
  raw_kode: string;
  generated_kode: string;
  code_resolution_mode: 'AUTO_GENERATE' | 'KEEP_RAW';
  id_anggota_calon: string;
  gelar_depan: string;
  nama_lengkap: string;
  gelar_belakang: string;
  status_keturunan: string;
  generasi_level: number;
  generasi_label: string;
  tempat_lahir: string;
  tanggal_lahir_iso: string;
  presisi_tgl_lahir: string;
  raw_ttl: string;
  status_hidup: 'HIDUP' | 'WAFAT' | 'TIDAK_DIKETAHUI';
  tanggal_wafat_raw: string;
  is_kk: boolean;
  pekerjaan_raw: string;
  alamat_raw: string;
  email: string;
  no_hp: string;
  iuran_nominal: number;
  is_multi_spouse_group: boolean;
  anomaly_flags: string[];
  action_status: 'SIAP' | 'SKIP';
  updated_at: string;
}

export interface MemberRecord {
  id_anggota: string;
  kode_silsilah: string;
  kode_legacy: string;
  gelar_depan: string;
  nama_lengkap: string;
  gelar_belakang: string;
  nama_panggilan?: string;
  jenis_kelamin?: string;
  foto_drive_id?: string;
  status_keturunan: string;
  generasi_level: number;
  generasi_label: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  presisi_tgl_lahir: string;
  status_hidup: 'HIDUP' | 'WAFAT' | 'TIDAK_DIKETAHUI';
  tanggal_wafat: string;
  tempat_wafat?: string;
  catatan_wafat?: string;
  provinsi_id?: string;
  kabkota_id?: string;
  kecamatan_id?: string;
  kelurahan_id?: string;
  nama_jalan?: string;
  rt?: string;
  rw?: string;
  no_rumah?: string;
  kode_pos?: string;
  keterangan_alamat: string;
  email: string;
  no_hp: string;
  no_hp_alt?: string;
  pendidikan_id?: string;
  pekerjaan_id?: string;
  pekerjaan_lainnya: string;
  is_kk: boolean;
  status_keanggotaan?: string;
  tanggal_gabung?: string;
  catatan?: string;
  is_archived?: boolean;
  iuran_nominal: number;
  needs_verification: boolean;
  updated_at: string;
}

export interface SpouseRelation {
  relasi_pasangan_id: string;
  id_anggota_1: string;
  id_anggota_2: string;
  urutan_pasangan: number;
  tanggal_menikah: string;
  tanggal_berakhir: string;
  status_hubungan: 'MENIKAH' | 'CERAI_HIDUP' | 'CERAI_MATI';
  keterangan: string;
  status_aktif: boolean;
}

export interface ParentChildRelation {
  relasi_ortu_id: string;
  id_anak: string;
  id_ayah: string;
  id_ibu: string;
  id_pasangan_ortu: string;
  jenis_hubungan: 'KANDUNG' | 'ANGKAT' | 'TIRI';
  urutan_anak: number;
  keterangan: string;
  status_aktif: boolean;
}

export interface HouseholdMemberEnriched {
  id_anggota_rumah: string;
  id_rumah_tangga: string;
  id_anggota: string;
  peran_dalam_rt: string;
  tanggal_masuk: string;
  tanggal_keluar: string;
  status_aktif: boolean;
  anggota?: MemberRecord | null;
  household?: HouseholdRecord | null;
}

export interface HouseholdRecord {
  id_rumah_tangga: string;
  nama_rumah_tangga: string;
  id_kepala_keluarga: string;
  provinsi_id: string;
  kabkota_id: string;
  kecamatan_id: string;
  kelurahan_id: string;
  alamat_ringkas: string;
  no_kontak_rt: string;
  status_aktif: boolean;
  izinkan_kk_ganda: boolean;
  tanggal_bentuk: string;
  keterangan: string;
  kepala_keluarga?: MemberRecord | null;
  jumlah_anggota?: number;
  anggota_list?: HouseholdMemberEnriched[];
}

export interface KkHistoryRecord {
  id_riwayat_kk: string;
  id_rumah_tangga: string;
  id_kk_lama: string;
  id_kk_baru: string;
  tanggal_pergantian: string;
  alasan: string;
  pencatat_user_id: string;
}

export interface WilayahItem {
  kode_wilayah: string;
  tingkat: 'PROV' | 'KAB' | 'KEC' | 'DESA';
  kode_induk: string;
  nama_wilayah: string;
  kode_pos_default: string;
}

export interface SimpleMasterItem {
  id: string;
  nama: string;
  urutan: number;
  level_angka?: number;
  deskripsi?: string;
  status_aktif: boolean;
}

export interface MasterBundles {
  generasi: SimpleMasterItem[];
  pendidikan: SimpleMasterItem[];
  pekerjaan: SimpleMasterItem[];
  wilayah: WilayahItem[];
}

export interface MemberDetailResponse {
  member: MemberRecord;
  parents: { relation: ParentChildRelation; ayah: MemberRecord | null; ibu: MemberRecord | null }[];
  spouses: { relation: SpouseRelation; partner: MemberRecord | null }[];
  children: { relation: ParentChildRelation; child: MemberRecord }[];
  siblings: MemberRecord[];
  households: HouseholdMemberEnriched[];
}

export interface AuditLogEntry {
  log_id: string;
  timestamp: string;
  user_id: string;
  username: string;
  role: string;
  aksi: string;
  entitas: string;
  record_id: string;
  catatan: string;
}

export interface GasFileItem {
  name: string;
  content: string;
}

export interface CoaAccount {
  kode_akun: string;
  nama_akun: string;
  kategori: 'ASET' | 'KEWAJIBAN' | 'SALDO_DANA' | 'PENDAPATAN' | 'BEBAN';
  sub_kategori: string;
  saldo_normal: 'DEBIT' | 'KREDIT';
  is_kas_bank: boolean;
  status_aktif: boolean;
  keterangan: string;
}

export interface CoaBalanceItem {
  kode_akun: string;
  nama_akun: string;
  kategori: CoaAccount['kategori'];
  saldo_normal: 'DEBIT' | 'KREDIT';
  is_kas_bank: boolean;
  debit: number;
  kredit: number;
  saldo: number;
}

export interface AnggaranRecord {
  anggaran_id: string;
  tahun_anggaran: number;
  kegiatan_id: string;
  kode_akun: string;
  nominal_anggaran: number;
  keterangan: string;
  status_aktif: boolean;
  created_at: string;
}

export interface TarifIuranRecord {
  tarif_id: string;
  tahun_iuran: number;
  nominal_standar: number;
  target_total_tahun: number;
  periode_tipe: string;
  jatuh_tempo: string;
  keterangan: string;
  status_aktif: boolean;
}

export interface TagihanIuranEnriched {
  tagihan_id: string;
  tahun_iuran: number;
  id_rumah_tangga: string;
  id_kk: string;
  nominal_tagihan: number;
  diskon_pembebasan: number;
  alasan_pembebasan: string;
  total_terbayar: number;
  sisa_tagihan: number;
  status_bayar: 'BELUM_LUNAS' | 'SEBAGIAN' | 'LUNAS' | 'DIBEBASKAN';
  jatuh_tempo: string;
  updated_at: string;
  nama_anggota?: string;
  kode_silsilah?: string;
  is_kk?: boolean;
  nama_rumah_tangga?: string;
  tanggal_bayar_terakhir?: string;
  metode_bayar_terakhir?: string;
  jumlah_pembayaran?: number;
}

export interface PembayaranEnriched {
  pembayaran_id: string;
  tagihan_id: string;
  id_rumah_tangga: string;
  tahun_iuran: number;
  tanggal_bayar: string;
  nominal_bayar: number;
  metode_bayar: 'TUNAI' | 'TRANSFER_BANK' | 'QRIS';
  transaksi_id: string;
  petugas_user_id: string;
  no_kuitansi: string;
  kuitansi_drive_id: string;
  bukti_id: string;
  keterangan: string;
  created_at: string;
  nama_pembayar?: string;
}

export interface BuktiTransaksiRecord {
  bukti_id: string;
  transaksi_id: string;
  nama_file: string;
  drive_file_id: string;
  drive_url: string;
  mime_type: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface TransaksiEnriched {
  transaksi_id: string;
  no_transaksi: string;
  tanggal_transaksi: string;
  jenis_transaksi: 'PEMASUKAN' | 'PENGELUARAN' | 'MUTASI' | 'KOREKSI';
  sumber_dana_akun: string;
  kegiatan_id: string;
  keterangan: string;
  total_nominal: number;
  status_verifikasi: 'MENUNGGU_VERIFIKASI' | 'TERVERIFIKASI' | 'DITOLAK';
  is_published: boolean;
  ref_koreksi_id: string;
  pencatat_user_id: string;
  verifikator_user_id: string;
  verified_at: string;
  created_at: string;
  bukti?: BuktiTransaksiRecord | null;
}

export interface JurnalEntry {
  jurnal_id: string;
  transaksi_id: string;
  tanggal: string;
  kode_akun: string;
  debit: number;
  kredit: number;
  keterangan_baris: string;
  urutan: number;
}

export interface FinanceOverviewResponse {
  ok: boolean;
  canDetail: boolean;
  tahun: number;
  summary: {
    totalKasBank: number;
    totalPendapatan: number;
    totalBeban: number;
    surplusDefisit: number;
    totalAset: number;
    totalKewajiban: number;
    totalSaldoDana: number;
    totalTargetIuran: number;
    totalDiskonIuran: number;
    totalTerbayarIuran: number;
    totalSisaIuran: number;
    jumlahTagihan: number;
    jumlahLunas: number;
    totalPemasukanIuran?: number;
    totalPemasukanLainnya?: number;
    totalPengeluaranKas?: number;
  };
  coa: CoaAccount[];
  coaBalances: CoaBalanceItem[];
  transaksi: TransaksiEnriched[];
  jurnal: JurnalEntry[];
  tarifIuran: TarifIuranRecord[];
  tagihanIuran: TagihanIuranEnriched[];
  pembayaran: PembayaranEnriched[];
  anggaran: AnggaranRecord[];
}

export interface JabatanRecord {
  jabatan_id: string;
  nama_jabatan: string;
  level_hierarki: number;
  induk_jabatan_id: string;
  deskripsi_tugas: string;
  status_aktif: boolean;
}

export interface PengurusEnriched {
  pengurus_id: string;
  jabatan_id: string;
  id_anggota: string;
  periode_nama: string;
  tanggal_mulai: string;
  tanggal_berakhir: string;
  no_sk: string;
  dokumen_sk_drive_id: string;
  status_aktif: boolean;
  keterangan: string;
  created_at: string;
  nama_anggota?: string;
  kode_silsilah?: string;
  generasi_level?: number | null;
  generasi_label?: string;
  status_keturunan?: string;
  alamat_lengkap?: string;
  no_hp?: string;
  email?: string;
  foto_drive_id?: string;
  nama_jabatan?: string;
  deskripsi_tugas?: string;
  level_hierarki?: number;
}

export interface KegiatanEnriched {
  kegiatan_id: string;
  nama_kegiatan: string;
  kategori_kegiatan: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  lokasi: string;
  id_penanggung_jawab: string;
  coa_terkait: string;
  anggaran_rencana: number;
  status_kegiatan: 'RENCANA' | 'TERJADWAL' | 'BERJALAN' | 'SELESAI' | 'DIBATALKAN';
  deskripsi: string;
  created_at: string;
  created_by: string;
  nama_pj?: string;
}

export interface PengumumanRecord {
  pengumuman_id: string;
  judul: string;
  kategori: 'UMUM' | 'ACARA' | 'KEUANGAN' | 'DUKA' | 'PENTING';
  isi: string;
  target_audiens: 'SEMUA' | 'PENGURUS' | 'KEPALA_KELUARGA';
  is_pinned: boolean;
  tanggal_publikasi: string;
  status_aktif: boolean;
  penulis_user_id: string;
  created_at: string;
}

export interface SuratRecord {
  surat_id: string;
  nomor_surat: string;
  jenis_surat: 'UNDANGAN_ACARA' | 'SURAT_TUGAS' | 'EDARAN' | 'REKOMENDASI' | 'LAINNYA';
  template_doc_id: string;
  perihal: string;
  isi_surat: string;
  tanggal_surat: string;
  penerima_tipe: 'SEMUA_KELUARGA' | 'PENGURUS' | 'PERORANGAN' | 'EKSTERNAL';
  penerima_id: string;
  pejabat_ttd_id: string;
  doc_drive_id: string;
  pdf_drive_id: string;
  status_surat: 'DRAFT' | 'TERBIT' | 'ARSIP';
  created_at: string;
  created_by: string;
}

export interface UndanganRecord {
  undangan_id: string;
  kegiatan_id: string;
  surat_id: string;
  target_tipe: 'SEMUA_KELUARGA' | 'PENGURUS' | 'RUMAH_TANGGA';
  target_id: string;
  status_kirim: 'BELUM_DIKIRIM' | 'TERKIRIM';
  tanggal_kirim: string;
  status_hadir: 'BELUM_KONFIRMASI' | 'HADIR' | 'TIDAK_HADIR' | 'RAGU';
  file_pdf_drive_id: string;
  created_at: string;
}

export interface ArsipRecord {
  arsip_id: string;
  kategori_arsip: 'NOTULEN' | 'SK_PENGURUS' | 'LPJ_KEUANGAN' | 'DOKUMENTASI' | 'AD_ART' | 'LAINNYA';
  judul: string;
  tanggal_dokumen: string;
  kegiatan_id: string;
  drive_file_id: string;
  drive_url: string;
  deskripsi: string;
  visibilitas: 'PUBLIK_KELUARGA' | 'KHUSUS_PENGURUS';
  uploaded_by: string;
  uploaded_at: string;
}

export interface OrganizationBundleResponse {
  ok: boolean;
  canManageOrg: boolean;
  canManageSurat: boolean;
  jabatan: JabatanRecord[];
  pengurus: PengurusEnriched[];
  kegiatan: KegiatanEnriched[];
  pengumuman: PengumumanRecord[];
  surat: SuratRecord[];
  undangan: UndanganRecord[];
  arsip: ArsipRecord[];
}

