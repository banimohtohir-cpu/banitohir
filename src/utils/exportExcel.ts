import * as XLSX from 'xlsx';
import { FinanceOverviewResponse, MasterBundles, MemberRecord, TagihanIuranEnriched, TransaksiEnriched } from '../types';

function fitColumnWidths(rows: Record<string, unknown>[]): XLSX.ColInfo[] {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((k) => {
    let maxLen = k.length;
    rows.forEach((r) => {
      const len = String(r[k] ?? '').length;
      if (len > maxLen) maxLen = len;
    });
    return { wch: Math.min(Math.max(maxLen + 3, 12), 48) };
  });
}

function appendSheet(wb: XLSX.WorkBook, sheetName: string, rows: Record<string, unknown>[]) {
  const safeRows = rows.length > 0 ? rows : [{ Keterangan: 'Belum ada data' }];
  const ws = XLSX.utils.json_to_sheet(safeRows);
  ws['!cols'] = fitColumnWidths(safeRows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
}

export function exportMembersToExcel(
  members: MemberRecord[],
  masters: MasterBundles,
  filename = `data_anggota_bani_tohir_${new Date().toISOString().slice(0, 10)}.xlsx`
) {
  const pendMap = new Map(masters.pendidikan.map((p) => [p.id, p.nama]));
  const pekMap = new Map(masters.pekerjaan.map((p) => [p.id, p.nama]));
  const wilMap = new Map(masters.wilayah.map((w) => [`${w.tingkat}:${w.kode_wilayah}`, w.nama_wilayah]));

  const rows = members.map((m, idx) => ({
    No: idx + 1,
    'ID Anggota': m.id_anggota,
    'Kode Silsilah': m.kode_silsilah || '-',
    'Gelar Depan': m.gelar_depan || '',
    'Nama Lengkap': m.nama_lengkap,
    'Gelar Belakang': m.gelar_belakang || '',
    'Nama Panggilan': m.nama_panggilan || '',
    'Jenis Kelamin': m.jenis_kelamin === 'L' ? 'Laki-laki' : m.jenis_kelamin === 'P' ? 'Perempuan' : '-',
    'Status Keturunan': m.status_keturunan,
    'Tingkatan Generasi': `${m.generasi_level} - ${m.generasi_label}`,
    'Tempat Lahir': m.tempat_lahir || '-',
    'Tanggal Lahir': m.tanggal_lahir || 'Belum diisi',
    'Status Hidup': m.status_hidup,
    'Tanggal Wafat': m.tanggal_wafat || '',
    'Kepala Keluarga (KK)': m.is_kk ? 'YA' : 'TIDAK',
    Pendidikan: pendMap.get(m.pendidikan_id || '') || '',
    Pekerjaan: [pekMap.get(m.pekerjaan_id || ''), m.pekerjaan_lainnya].filter(Boolean).join(' / '),
    'Provinsi': wilMap.get(`PROV:${m.provinsi_id}`) || '',
    'Kab/Kota': wilMap.get(`KAB:${m.kabkota_id}`) || '',
    'Alamat Lengkap': m.keterangan_alamat || m.nama_jalan || '-',
    'No HP': m.no_hp || '-',
    Email: m.email || '-',
    'Status Keanggotaan': m.is_archived ? 'ARSIP' : m.status_keanggotaan || 'AKTIF',
  }));

  const wb = XLSX.utils.book_new();
  appendSheet(wb, 'Data Anggota', rows);
  XLSX.writeFile(wb, filename);
}

export function exportIuranToExcel(
  bills: TagihanIuranEnriched[],
  data: FinanceOverviewResponse,
  filename?: string
) {
  const wb = XLSX.utils.book_new();
  const billRows = bills.map((b, idx) => ({
    No: idx + 1,
    'ID Tagihan': b.tagihan_id,
    'Kode Silsilah': b.kode_silsilah || b.id_kk,
    'Nama Wajib Iuran': b.nama_anggota || b.id_kk,
    'Rumah Tangga': b.nama_rumah_tangga || '-',
    'Target Iuran (Rp)': b.nominal_tagihan,
    'Keringanan (Rp)': b.diskon_pembebasan,
    'Realisasi Terbayar (Rp)': b.total_terbayar,
    'Sisa Target (Rp)': b.sisa_tagihan,
    'Tanggal Bayar Terakhir': b.tanggal_bayar_terakhir || '-',
    'Metode Terakhir': b.metode_bayar_terakhir || '-',
    Status: b.status_bayar,
    'Jatuh Tempo': b.jatuh_tempo,
  }));
  appendSheet(wb, `Daftar Iuran ${data.tahun}`, billRows);

  const payRows = data.pembayaran.map((p, idx) => ({
    No: idx + 1,
    'No. Kuitansi': p.no_kuitansi,
    'Tanggal Bayar': p.tanggal_bayar,
    Pembayar: p.nama_pembayar || p.tagihan_id,
    Metode: p.metode_bayar,
    'Nominal (Rp)': p.nominal_bayar,
    Keterangan: p.keterangan,
  }));
  appendSheet(wb, 'Riwayat Pembayaran', payRows);

  XLSX.writeFile(wb, filename || `daftar_iuran_bani_tohir_${data.tahun}.xlsx`);
}

export function exportTransactionsToExcel(
  transaksi: TransaksiEnriched[],
  coaNameMap: Map<string, string>,
  label: string,
  tahun: number,
  filename?: string
) {
  const wb = XLSX.utils.book_new();
  const rows = transaksi.map((t, idx) => ({
    No: idx + 1,
    'No. Transaksi': t.no_transaksi,
    Tanggal: t.tanggal_transaksi,
    Jenis: t.jenis_transaksi,
    Sumber: t.no_transaksi.startsWith('IUR-') ? 'Realisasi Iuran (Otomatis)' : 'Transaksi Umum',
    'Akun Kas/Bank': `${t.sumber_dana_akun} - ${coaNameMap.get(t.sumber_dana_akun) || ''}`,
    Keterangan: t.keterangan,
    'Nominal (Rp)': t.total_nominal,
    'Status Verifikasi': t.status_verifikasi,
    Publikasi: t.is_published ? 'Publik' : 'Internal',
  }));
  appendSheet(wb, `Transaksi ${label}`, rows);
  XLSX.writeFile(wb, filename || `transaksi_${label.toLowerCase().replace(/\s+/g, '_')}_${tahun}.xlsx`);
}

export function exportFinanceWorkbookExcel(
  data: FinanceOverviewResponse,
  filename?: string
) {
  const wb = XLSX.utils.book_new();
  const coaNameMap = new Map(data.coa.map((c) => [c.kode_akun, c.nama_akun]));

  // Sheet 1: Ringkasan & Laporan Aktivitas
  const aktivitasRows = [
    ...data.coaBalances
      .filter((c) => c.kategori === 'PENDAPATAN' || c.kategori === 'BEBAN')
      .map((c) => ({
        Kategori: c.kategori,
        'Kode Akun': c.kode_akun,
        'Nama Akun': c.nama_akun,
        'Saldo (Rp)': c.kategori === 'BEBAN' ? -c.saldo : c.saldo,
      })),
    {
      Kategori: 'RINGKASAN',
      'Kode Akun': '-',
      'Nama Akun': 'Total Pendapatan',
      'Saldo (Rp)': data.summary.totalPendapatan,
    },
    {
      Kategori: 'RINGKASAN',
      'Kode Akun': '-',
      'Nama Akun': 'Total Beban / Pengeluaran',
      'Saldo (Rp)': data.summary.totalBeban,
    },
    {
      Kategori: 'RINGKASAN',
      'Kode Akun': '-',
      'Nama Akun': 'Surplus / (Defisit) Bersih',
      'Saldo (Rp)': data.summary.surplusDefisit,
    },
  ];
  appendSheet(wb, 'Laporan Aktivitas', aktivitasRows);

  // Sheet 2: Neraca Posisi Keuangan
  const neracaRows = [
    ...data.coaBalances
      .filter((c) => c.kategori === 'ASET' || c.kategori === 'KEWAJIBAN' || c.kategori === 'SALDO_DANA')
      .map((c) => ({
        Kategori: c.kategori,
        'Kode Akun': c.kode_akun,
        'Nama Akun': c.nama_akun,
        'Saldo (Rp)': c.saldo,
      })),
    {
      Kategori: 'TOTAL',
      'Kode Akun': '-',
      'Nama Akun': 'Total Aset',
      'Saldo (Rp)': data.summary.totalAset,
    },
    {
      Kategori: 'TOTAL',
      'Kode Akun': '-',
      'Nama Akun': 'Total Kewajiban + Saldo Dana + Surplus Berjalan',
      'Saldo (Rp)': data.summary.totalKewajiban + data.summary.totalSaldoDana + data.summary.surplusDefisit,
    },
  ];
  appendSheet(wb, 'Neraca Keuangan', neracaRows);

  // Sheet 3: Transaksi Pemasukan
  const pemasukanRows = data.transaksi
    .filter((t) => t.jenis_transaksi === 'PEMASUKAN')
    .map((t, idx) => ({
      No: idx + 1,
      'No. Transaksi': t.no_transaksi,
      Tanggal: t.tanggal_transaksi,
      Sumber: t.no_transaksi.startsWith('IUR-') ? 'Realisasi Iuran' : 'Pemasukan Lainnya',
      'Akun Kas': `${t.sumber_dana_akun} - ${coaNameMap.get(t.sumber_dana_akun) || ''}`,
      Keterangan: t.keterangan,
      'Nominal (Rp)': t.total_nominal,
      Status: t.status_verifikasi,
    }));
  appendSheet(wb, 'Transaksi Pemasukan', pemasukanRows);

  // Sheet 4: Transaksi Pengeluaran
  const pengeluaranRows = data.transaksi
    .filter((t) => t.jenis_transaksi === 'PENGELUARAN')
    .map((t, idx) => ({
      No: idx + 1,
      'No. Transaksi': t.no_transaksi,
      Tanggal: t.tanggal_transaksi,
      'Akun Kas': `${t.sumber_dana_akun} - ${coaNameMap.get(t.sumber_dana_akun) || ''}`,
      Keterangan: t.keterangan,
      'Nominal (Rp)': t.total_nominal,
      Status: t.status_verifikasi,
    }));
  appendSheet(wb, 'Transaksi Pengeluaran', pengeluaranRows);

  // Sheet 5: Daftar Iuran
  if (data.canDetail) {
    const iuranRows = data.tagihanIuran.map((b, idx) => ({
      No: idx + 1,
      'Kode Silsilah': b.kode_silsilah || b.id_kk,
      'Nama Wajib Iuran': b.nama_anggota || b.id_kk,
      'Target Iuran (Rp)': b.nominal_tagihan,
      'Keringanan (Rp)': b.diskon_pembebasan,
      'Realisasi (Rp)': b.total_terbayar,
      'Sisa (Rp)': b.sisa_tagihan,
      'Tgl Bayar Terakhir': b.tanggal_bayar_terakhir || '-',
      Status: b.status_bayar,
    }));
    appendSheet(wb, 'Daftar Iuran', iuranRows);
  }

  XLSX.writeFile(wb, filename || `laporan_keuangan_lengkap_bani_tohir_${data.tahun}.xlsx`);
}
