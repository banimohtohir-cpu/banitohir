import { HouseholdMemberRecord } from './stage3.ts';

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

export interface TagihanIuranRecord {
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
}

export interface PembayaranRecord {
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
}

export interface TransaksiRecord {
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

export interface JabatanRecord {
  jabatan_id: string;
  nama_jabatan: string;
  level_hierarki: number;
  induk_jabatan_id: string;
  deskripsi_tugas: string;
  status_aktif: boolean;
}

export interface PengurusRecord {
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
}

export interface KegiatanRecord {
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

export const SEED_COA: CoaAccount[] = [
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
  { kode_akun: '5199', nama_akun: 'Beban Lainnya', kategori: 'BEBAN', sub_kategori: 'LAINNYA', saldo_normal: 'DEBIT', is_kas_bank: false, status_aktif: true, keterangan: 'Pengeluaran lain yang sah' },
];

export const SEED_JABATAN: JabatanRecord[] = [
  { jabatan_id: 'JBT-01', nama_jabatan: 'Pelindung / Sesepuh', level_hierarki: 1, induk_jabatan_id: '', deskripsi_tugas: 'Penasihat dan sesepuh keluarga besar', status_aktif: true },
  { jabatan_id: 'JBT-02', nama_jabatan: 'Ketua Paguyuban', level_hierarki: 2, induk_jabatan_id: 'JBT-01', deskripsi_tugas: 'Pimpinan umum paguyuban', status_aktif: true },
  { jabatan_id: 'JBT-03', nama_jabatan: 'Wakil Ketua', level_hierarki: 3, induk_jabatan_id: 'JBT-02', deskripsi_tugas: 'Pendamping dan wakil ketua', status_aktif: true },
  { jabatan_id: 'JBT-04', nama_jabatan: 'Sekretaris', level_hierarki: 3, induk_jabatan_id: 'JBT-02', deskripsi_tugas: 'Administrasi data, surat, dan arsip', status_aktif: true },
  { jabatan_id: 'JBT-05', nama_jabatan: 'Bendahara', level_hierarki: 3, induk_jabatan_id: 'JBT-02', deskripsi_tugas: 'Pengelolaan iuran dan keuangan', status_aktif: true },
  { jabatan_id: 'JBT-06', nama_jabatan: 'Humas & Dokumentasi', level_hierarki: 4, induk_jabatan_id: 'JBT-02', deskripsi_tugas: 'Informasi, publikasi, dan dokumentasi kegiatan', status_aktif: true },
  { jabatan_id: 'JBT-07', nama_jabatan: 'Koordinator Cabang Keturunan', level_hierarki: 4, induk_jabatan_id: 'JBT-02', deskripsi_tugas: 'Koordinasi per cabang anak leluhur utama', status_aktif: true },
];

export const SEED_TARIF_IURAN: TarifIuranRecord[] = [
  {
    tarif_id: 'TRF-2026',
    tahun_iuran: 2026,
    nominal_standar: 100000,
    target_total_tahun: 12605000,
    periode_tipe: 'TAHUNAN',
    jatuh_tempo: '2026-12-31',
    keterangan: 'Target iuran awal hasil migrasi spreadsheet Keluarga Besar Bani Haji Mohammad Tohir tahun 2026',
    status_aktif: true,
  },
];

export const SEED_PENGUMUMAN: PengumumanRecord[] = [
  {
    pengumuman_id: 'PNG-2026-01',
    judul: 'Penetapan Target Iuran Keluarga Besar Tahun 2026',
    kategori: 'KEUANGAN',
    isi: 'Assalamualaikum warahmatullahi wabarakatuh. Seluruh catatan iuran dari data awal keluarga besar telah dimasukkan sebagai Target Iuran 2026 (status belum lunas hingga dilakukan pembayaran resmi kepada Bendahara). Mari jaga semangat Guyub, Akur, Semedulur.',
    target_audiens: 'SEMUA',
    is_pinned: true,
    tanggal_publikasi: '2026-01-15',
    status_aktif: true,
    penulis_user_id: 'SYSTEM',
    created_at: '2026-01-15T08:00:00+07:00',
  },
];

export interface MinimalMemberForIuran {
  id_anggota: string;
  iuran_nominal: number;
  is_archived?: boolean;
}

export function buildTargetIuranFromMembers(
  members: MinimalMemberForIuran[],
  householdMembers: HouseholdMemberRecord[],
  nowIso: string,
  tahun = 2026
): TagihanIuranRecord[] {
  const rtByMember = new Map<string, string>();
  householdMembers.forEach((hm) => {
    if (hm.status_aktif && !rtByMember.has(hm.id_anggota)) {
      rtByMember.set(hm.id_anggota, hm.id_rumah_tangga);
    }
  });

  const bills: TagihanIuranRecord[] = [];
  let seq = 1;
  members.forEach((m) => {
    if (m.id_anggota === 'BMT-0000' || m.is_archived) return;
    const nom = Number(m.iuran_nominal) || 0;
    if (nom <= 0) return;
    bills.push({
      tagihan_id: `TGH-${tahun}-${String(seq++).padStart(4, '0')}`,
      tahun_iuran: tahun,
      id_rumah_tangga: rtByMember.get(m.id_anggota) || '',
      id_kk: m.id_anggota,
      nominal_tagihan: nom,
      diskon_pembebasan: 0,
      alasan_pembebasan: '',
      total_terbayar: 0,
      sisa_tagihan: nom,
      status_bayar: 'BELUM_LUNAS',
      jatuh_tempo: `${tahun}-12-31`,
      updated_at: nowIso,
    });
  });

  return bills;
}
