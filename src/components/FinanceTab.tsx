import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  FileSpreadsheet,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import {
  FinanceOverviewResponse,
  ModulePermission,
  PembayaranEnriched,
  TagihanIuranEnriched,
  TransaksiEnriched,
} from '../types';
import { SearchableSelect } from './SearchableSelect';
import {
  exportFinanceWorkbookExcel,
  exportIuranToExcel,
  exportTransactionsToExcel,
} from '../utils/exportExcel';

interface FinanceTabProps {
  token: string;
  permission: ModulePermission;
  onDataChanged: () => void;
  onNotify: (msg: string, kind?: 'success' | 'error') => void;
}

type FinanceSubTab = 'iuran' | 'transaksi' | 'anggaran' | 'laporan';
type TrxFilterKind = 'SEMUA' | 'PEMASUKAN' | 'PENGELUARAN' | 'MUTASI_KOREKSI';
type PrintScope = 'iuran' | 'transaksi' | 'laporan' | 'receipt' | null;

function formatRp(val: number): string {
  return 'Rp ' + (Number(val) || 0).toLocaleString('id-ID');
}

export function FinanceTab({ token, permission, onDataChanged, onNotify }: FinanceTabProps) {
  const [subTab, setSubTab] = useState<FinanceSubTab>('iuran');
  const [tahun, setTahun] = useState<number>(2026);
  const [data, setData] = useState<FinanceOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Filter Iuran
  const [billSearch, setBillSearch] = useState('');
  const [billStatusFilter, setBillStatusFilter] = useState('ALL');

  // Filter Transaksi
  const [trxKindFilter, setTrxKindFilter] = useState<TrxFilterKind>('SEMUA');
  const [trxSearch, setTrxSearch] = useState('');

  // Print scope
  const [printScope, setPrintScope] = useState<PrintScope>(null);

  // Modals
  const [payingBill, setPayingBill] = useState<TagihanIuranEnriched | null>(null);
  const [payNominal, setPayNominal] = useState('');
  const [payMetode, setPayMetode] = useState<'TUNAI' | 'TRANSFER_BANK' | 'QRIS'>('TRANSFER_BANK');
  const [payAkunKas, setPayAkunKas] = useState('1103');
  const [payTanggal, setPayTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [payKet, setPayKet] = useState('Pembayaran target iuran tahunan');

  const [editingBill, setEditingBill] = useState<TagihanIuranEnriched | null>(null);
  const [editNominal, setEditNominal] = useState('');
  const [editDiskon, setEditDiskon] = useState('');
  const [editAlasan, setEditAlasan] = useState('');

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genNominal, setGenNominal] = useState('100000');
  const [genJatuhTempo, setGenJatuhTempo] = useState('2026-12-31');

  const [receiptPreview, setReceiptPreview] = useState<PembayaranEnriched | null>(null);

  // Transaksi baru
  const [showTrxModal, setShowTrxModal] = useState(false);
  const [trxJenis, setTrxJenis] = useState<'PEMASUKAN' | 'PENGELUARAN' | 'MUTASI'>('PEMASUKAN');
  const [trxTgl, setTrxTgl] = useState(() => new Date().toISOString().slice(0, 10));
  const [trxAkunKas, setTrxAkunKas] = useState('1101');
  const [trxAkunLawan, setTrxAkunLawan] = useState('4102');
  const [trxNominal, setTrxNominal] = useState('');
  const [trxKet, setTrxKet] = useState('');
  const [trxBuktiUrl, setTrxBuktiUrl] = useState('');
  const [trxPublished, setTrxPublished] = useState(true);

  // Koreksi modal
  const [reversingTrx, setReversingTrx] = useState<TransaksiEnriched | null>(null);
  const [reverseReason, setReverseReason] = useState('');

  // Anggaran & COA forms
  const [angAkun, setAngAkun] = useState('5101');
  const [angNominal, setAngNominal] = useState('');
  const [angKet, setAngKet] = useState('');

  const [coaKode, setCoaKode] = useState('');
  const [coaNama, setCoaNama] = useState('');
  const [coaKategori, setCoaKategori] = useState<'ASET' | 'KEWAJIBAN' | 'SALDO_DANA' | 'PENDAPATAN' | 'BEBAN'>('BEBAN');
  const [coaKasBank, setCoaKasBank] = useState(false);

  const canCreate = Boolean(permission.can_create);
  const canEdit = Boolean(permission.can_edit);

  async function loadFinance(selectedYear = tahun) {
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/overview?tahun=${selectedYear}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setData(json);
      } else {
        onNotify(json.message || 'Gagal memuat data keuangan.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFinance(tahun);
  }, [tahun]);

  function triggerPrint(scope: Exclude<PrintScope, null>) {
    setPrintScope(scope);
    const cleanup = () => {
      setPrintScope(null);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.setTimeout(() => {
      window.print();
    }, 150);
  }

  async function handleSubmitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payingBill) return;
    const res = await fetch('/api/iuran/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        tagihan_id: payingBill.tagihan_id,
        nominal_bayar: Number(payNominal),
        metode_bayar: payMetode,
        akun_kas: payAkunKas,
        tanggal_bayar: payTanggal,
        keterangan: payKet,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      onNotify(json.message || 'Gagal mencatat pembayaran iuran.', 'error');
      return;
    }
    onNotify(`Pembayaran dicatat (${json.no_kuitansi}) dan otomatis diakui sebagai Transaksi Pemasukan.`);
    setPayingBill(null);
    setReceiptPreview({
      ...json.pembayaran,
      nama_pembayar: payingBill.nama_anggota || payingBill.nama_rumah_tangga || payingBill.id_kk,
    });
    await loadFinance(tahun);
    onDataChanged();
  }

  async function handleSubmitEditBill(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBill) return;
    const res = await fetch(`/api/iuran/bills/${editingBill.tagihan_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        nominal_tagihan: Number(editNominal),
        diskon_pembebasan: Number(editDiskon),
        alasan_pembebasan: editAlasan,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      onNotify(json.message || 'Gagal memperbarui target iuran.', 'error');
      return;
    }
    onNotify('Target & keringanan iuran berhasil diperbarui.');
    setEditingBill(null);
    await loadFinance(tahun);
    onDataChanged();
  }

  async function handleGenerateBills(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/iuran/bills/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        tahun_iuran: tahun,
        nominal_standar: Number(genNominal),
        jatuh_tempo: genJatuhTempo,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      onNotify(json.message || 'Gagal membuat tagihan tahunan.', 'error');
      return;
    }
    onNotify(`Berhasil membuat ${json.createdCount} tagihan target iuran baru untuk tahun ${tahun}.`);
    setShowGenerateModal(false);
    await loadFinance(tahun);
    onDataChanged();
  }

  async function handleSubmitTrx(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/finance/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        jenis_transaksi: trxJenis,
        tanggal_transaksi: trxTgl,
        sumber_dana_akun: trxAkunKas,
        akun_lawan: trxAkunLawan,
        total_nominal: Number(trxNominal),
        keterangan: trxKet,
        bukti_url: trxBuktiUrl,
        is_published: trxPublished,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      onNotify(json.message || 'Gagal menyimpan transaksi.', 'error');
      return;
    }
    onNotify(`Transaksi ${json.transaksi.no_transaksi} tersimpan dengan jurnal seimbang.`);
    setShowTrxModal(false);
    setTrxNominal('');
    setTrxKet('');
    setTrxBuktiUrl('');
    await loadFinance(tahun);
    onDataChanged();
  }

  async function handleVerifyTrx(
    trxId: string,
    statusVerifikasi: 'MENUNGGU_VERIFIKASI' | 'TERVERIFIKASI' | 'DITOLAK',
    isPublished: boolean
  ) {
    const res = await fetch(`/api/finance/transactions/${trxId}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status_verifikasi: statusVerifikasi, is_published: isPublished }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      onNotify(json.message || 'Gagal memperbarui status verifikasi.', 'error');
      return;
    }
    onNotify(`Status transaksi diperbarui (${statusVerifikasi}).`);
    await loadFinance(tahun);
  }

  async function handleReverseTrx(e: React.FormEvent) {
    e.preventDefault();
    if (!reversingTrx) return;
    const res = await fetch(`/api/finance/transactions/${reversingTrx.transaksi_id}/reverse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ alasan: reverseReason }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      onNotify(json.message || 'Gagal membuat jurnal koreksi.', 'error');
      return;
    }
    onNotify(`Jurnal koreksi pembalik ${json.transaksi.no_transaksi} berhasil dicatat.`);
    setReversingTrx(null);
    setReverseReason('');
    await loadFinance(tahun);
  }

  async function handleSaveAnggaran(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/finance/anggaran', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        tahun_anggaran: tahun,
        kode_akun: angAkun,
        nominal_anggaran: Number(angNominal),
        keterangan: angKet,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      onNotify(json.message || 'Gagal menyimpan anggaran.', 'error');
      return;
    }
    onNotify('Rencana anggaran tersimpan.');
    setAngNominal('');
    setAngKet('');
    await loadFinance(tahun);
  }

  async function handleSaveCoa(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/finance/coa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        kode_akun: coaKode,
        nama_akun: coaNama,
        kategori: coaKategori,
        is_kas_bank: coaKasBank,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      onNotify(json.message || 'Gagal menyimpan akun COA.', 'error');
      return;
    }
    onNotify(`Akun ${coaKode} berhasil disimpan.`);
    setCoaKode('');
    setCoaNama('');
    setCoaKasBank(false);
    await loadFinance(tahun);
  }

  const coaNameMap = useMemo(
    () => new Map((data?.coa || []).map((c) => [c.kode_akun, c.nama_akun])),
    [data]
  );

  const filteredBills = useMemo(() => {
    if (!data) return [];
    return data.tagihanIuran.filter((b) => {
      if (billStatusFilter !== 'ALL' && b.status_bayar !== billStatusFilter) return false;
      if (billSearch.trim()) {
        const q = billSearch.toLowerCase();
        return `${b.nama_anggota || ''} ${b.nama_rumah_tangga || ''} ${b.kode_silsilah || ''} ${b.id_kk}`
          .toLowerCase()
          .includes(q);
      }
      return true;
    });
  }, [data, billStatusFilter, billSearch]);

  const filteredTrx = useMemo(() => {
    if (!data) return [];
    return data.transaksi.filter((t) => {
      if (trxKindFilter === 'PEMASUKAN' && t.jenis_transaksi !== 'PEMASUKAN') return false;
      if (trxKindFilter === 'PENGELUARAN' && t.jenis_transaksi !== 'PENGELUARAN') return false;
      if (trxKindFilter === 'MUTASI_KOREKSI' && t.jenis_transaksi !== 'MUTASI' && t.jenis_transaksi !== 'KOREKSI') {
        return false;
      }
      if (trxSearch.trim()) {
        const q = trxSearch.toLowerCase();
        return `${t.no_transaksi} ${t.keterangan} ${t.sumber_dana_akun} ${t.tanggal_transaksi}`
          .toLowerCase()
          .includes(q);
      }
      return true;
    });
  }, [data, trxKindFilter, trxSearch]);

  if (loading && !data) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-6 text-sm text-neutral-600">
        Memuat modul keuangan &amp; target iuran...
      </div>
    );
  }

  if (!data) return null;

  const kasAccounts = data.coa.filter((c) => c.is_kas_bank && c.status_aktif);
  const lawanAccounts =
    trxJenis === 'PEMASUKAN'
      ? data.coa.filter((c) => (c.kategori === 'PENDAPATAN' || c.kategori === 'SALDO_DANA' || c.kategori === 'KEWAJIBAN') && c.status_aktif)
      : trxJenis === 'PENGELUARAN'
      ? data.coa.filter((c) => (c.kategori === 'BEBAN' || c.kategori === 'KEWAJIBAN') && c.status_aktif)
      : kasAccounts;

  const totalDebitJurnal = data.jurnal.reduce((s, j) => s + (Number(j.debit) || 0), 0);
  const totalKreditJurnal = data.jurnal.reduce((s, j) => s + (Number(j.kredit) || 0), 0);

  const pemasukanCount = data.transaksi.filter((t) => t.jenis_transaksi === 'PEMASUKAN').length;
  const pengeluaranCount = data.transaksi.filter((t) => t.jenis_transaksi === 'PENGELUARAN').length;
  const mutasiKoreksiCount = data.transaksi.filter(
    (t) => t.jenis_transaksi === 'MUTASI' || t.jenis_transaksi === 'KOREKSI'
  ).length;

  const trxFilterLabel =
    trxKindFilter === 'PEMASUKAN'
      ? 'Pemasukan'
      : trxKindFilter === 'PENGELUARAN'
      ? 'Pengeluaran'
      : trxKindFilter === 'MUTASI_KOREKSI'
      ? 'Mutasi & Koreksi'
      : 'Semua';

  const activePrintScope: Exclude<PrintScope, null> =
    printScope || (receiptPreview ? 'receipt' : subTab === 'laporan' ? 'laporan' : subTab === 'transaksi' ? 'transaksi' : 'iuran');

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">Keuangan, Akuntansi &amp; Target Iuran</h2>
          <p className="text-xs text-neutral-600 mt-1">
            Target Iuran {tahun} terpisah dari Realisasi Pembayaran. Setiap realisasi pembayaran iuran otomatis diakui menjadi Transaksi Pemasukan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-44">
            <SearchableSelect
              compact
              value={String(tahun)}
              onChange={(v) => setTahun(Number(v) || 2026)}
              options={[
                { value: '2026', label: 'Tahun Buku 2026' },
                { value: '2027', label: 'Tahun Buku 2027' },
                { value: '2025', label: 'Tahun Buku 2025' },
              ]}
            />
          </div>
          <button
            type="button"
            onClick={() => loadFinance(tahun)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Segarkan</span>
          </button>
          <button
            type="button"
            onClick={() => triggerPrint(subTab === 'laporan' ? 'laporan' : subTab === 'transaksi' ? 'transaksi' : 'iuran')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / PDF</span>
          </button>
          {permission.can_export && (
            <button
              type="button"
              onClick={() => {
                exportFinanceWorkbookExcel(data);
                onNotify('Workbook Excel (.xlsx) Laporan Keuangan Lengkap berhasil diunduh.');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-green-800 bg-green-50 border border-green-300 hover:bg-green-100 rounded-lg cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel Lengkap</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Ringkasan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="text-xs font-medium text-neutral-500">Saldo Kas &amp; Bank Paguyuban</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-green-800">
            {formatRp(data.summary.totalKasBank)}
          </div>
          <div className="mt-1.5 text-xs text-neutral-600 font-mono tabular-nums">
            Surplus/Defisit: {formatRp(data.summary.surplusDefisit)}
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="text-xs font-medium text-neutral-500">Target Iuran {tahun}</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-neutral-900">
            {formatRp(data.summary.totalTargetIuran)}
          </div>
          <div className="mt-1.5 text-xs text-neutral-600 tabular-nums">
            {data.summary.jumlahTagihan} wajib iuran · {data.summary.jumlahLunas} lunas/bebas
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="text-xs font-medium text-neutral-500">Realisasi Iuran (Otomatis Pemasukan)</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-green-700">
            {formatRp(data.summary.totalTerbayarIuran)}
          </div>
          <div className="mt-1.5 text-xs text-amber-700 font-mono tabular-nums">
            Sisa belum masuk: {formatRp(data.summary.totalSisaIuran)}
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="text-xs font-medium text-neutral-500">Total Pemasukan vs Pengeluaran</div>
          <div className="mt-2 text-lg font-bold font-mono tabular-nums text-neutral-900">
            +{formatRp(data.summary.totalPendapatan)}
          </div>
          <div className="mt-1 text-xs font-mono tabular-nums text-neutral-600">
            Pengeluaran / Beban: {formatRp(data.summary.totalBeban)}
          </div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-neutral-200 pb-3 print:hidden">
        {(
          [
            { id: 'iuran', label: 'Daftar Iuran (Target & Realisasi)', icon: <Wallet className="w-3.5 h-3.5" /> },
            { id: 'transaksi', label: 'Daftar Transaksi (Pemasukan & Pengeluaran)', icon: <BookOpen className="w-3.5 h-3.5" /> },
            { id: 'anggaran', label: 'Anggaran & Bagan Akun (COA)', icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
            { id: 'laporan', label: 'Laporan Keuangan Resmi', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
          ] as { id: FinanceSubTab; label: string; icon: React.ReactNode }[]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg cursor-pointer ${
              subTab === t.id
                ? 'bg-green-700 text-white'
                : 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* SUBTAB 1: DAFTAR IURAN (TARGET & REALISASI) */}
      {subTab === 'iuran' && (
        <div className="space-y-5 print:hidden">
          {!data.canDetail ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-6 text-sm text-neutral-700">
              <div className="font-bold text-neutral-900">Ringkasan Transparansi Iuran {tahun}</div>
              <p className="mt-1 text-xs text-neutral-600">
                Untuk menjaga privasi keluarga, rincian tagihan per kepala keluarga hanya dapat diakses oleh Bendahara dan Super Admin.
                Total target iuran tahun {tahun} sebesar <strong className="font-mono">{formatRp(data.summary.totalTargetIuran)}</strong>,
                sudah terealisasi <strong className="font-mono text-green-700">{formatRp(data.summary.totalTerbayarIuran)}</strong>.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Cari nama wajib iuran / kode..."
                        value={billSearch}
                        onChange={(e) => setBillSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 rounded-lg"
                      />
                    </div>
                    <div className="w-48">
                      <SearchableSelect
                        compact
                        value={billStatusFilter}
                        onChange={setBillStatusFilter}
                        options={[
                          { value: 'ALL', label: `Semua Status (${data.tagihanIuran.length})` },
                          { value: 'BELUM_LUNAS', label: 'Belum Lunas' },
                          { value: 'SEBAGIAN', label: 'Terbayar Sebagian' },
                          { value: 'LUNAS', label: 'Lunas' },
                          { value: 'DIBEBASKAN', label: 'Dibebaskan' },
                        ]}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => triggerPrint('iuran')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Cetak Daftar Iuran</span>
                    </button>
                    {permission.can_export && (
                      <button
                        type="button"
                        onClick={() => {
                          exportIuranToExcel(filteredBills, data);
                          onNotify(`Daftar iuran (${filteredBills.length} baris) berhasil diekspor ke Excel.`);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-green-800 bg-green-50 border border-green-300 hover:bg-green-100 rounded-lg cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Excel Iuran</span>
                      </button>
                    )}
                    {canCreate && (
                      <button
                        type="button"
                        onClick={() => setShowGenerateModal(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Generate Target KK Lainnya</span>
                      </button>
                    )}
                  </div>
                </div>

                {filteredBills.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-500">
                    Belum ada daftar target iuran yang cocok. Pastikan data migrasi anggota sudah di-commit atau klik Generate Target.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-200 text-neutral-500">
                          <th className="py-2.5 pr-3 font-semibold">Nama Wajib Iuran</th>
                          <th className="py-2.5 px-3 font-semibold">Rumah Tangga</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Target Iuran</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Keringanan</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Realisasi</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Sisa</th>
                          <th className="py-2.5 px-3 font-semibold">Tgl Iuran Terakhir</th>
                          <th className="py-2.5 px-3 font-semibold">Status</th>
                          {(canCreate || canEdit) && <th className="py-2.5 pl-3 font-semibold text-right">Aksi</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {filteredBills.map((b) => (
                          <tr key={b.tagihan_id} className="hover:bg-neutral-50">
                            <td className="py-2.5 pr-3">
                              <div className="font-semibold text-neutral-900">{b.nama_anggota || b.id_kk}</div>
                              <div className="text-[11px] text-neutral-500 font-mono">
                                {b.kode_silsilah || b.id_kk} {b.is_kk ? '· KK' : ''}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-neutral-700">{b.nama_rumah_tangga}</td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-neutral-900">
                              {formatRp(b.nominal_tagihan)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-neutral-500">
                              {formatRp(b.diskon_pembebasan)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-green-700 font-semibold">
                              {formatRp(b.total_terbayar)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-700 font-semibold">
                              {formatRp(b.sisa_tagihan)}
                            </td>
                            <td className="py-2.5 px-3 font-mono tabular-nums text-neutral-700">
                              {b.tanggal_bayar_terakhir || '-'}
                              {b.metode_bayar_terakhir && (
                                <div className="text-[10px] text-neutral-500">{b.metode_bayar_terakhir}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-semibold">
                              <span
                                className={
                                  b.status_bayar === 'LUNAS' || b.status_bayar === 'DIBEBASKAN'
                                    ? 'text-green-700'
                                    : b.status_bayar === 'SEBAGIAN'
                                    ? 'text-amber-700'
                                    : 'text-neutral-600'
                                }
                              >
                                {b.status_bayar.replace('_', ' ')}
                              </span>
                            </td>
                            {(canCreate || canEdit) && (
                              <td className="py-2.5 pl-3 text-right space-x-2 whitespace-nowrap">
                                {canCreate && b.sisa_tagihan > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPayingBill(b);
                                      setPayNominal(String(b.sisa_tagihan));
                                      setPayKet(`Pembayaran iuran ${tahun} - ${b.nama_anggota || b.id_kk}`);
                                    }}
                                    className="text-xs font-semibold text-green-700 hover:underline cursor-pointer"
                                  >
                                    Bayar
                                  </button>
                                )}
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingBill(b);
                                      setEditNominal(String(b.nominal_tagihan));
                                      setEditDiskon(String(b.diskon_pembebasan));
                                      setEditAlasan(b.alasan_pembebasan || '');
                                    }}
                                    className="text-xs font-semibold text-neutral-600 hover:underline cursor-pointer"
                                  >
                                    Ubah Target
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Riwayat Pembayaran & Kuitansi */}
              <div className="bg-white border border-neutral-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-neutral-900 mb-3">
                  Riwayat Pembayaran Iuran &amp; Kuitansi (Otomatis Diakui Sebagai Pemasukan)
                </h3>
                {data.pembayaran.length === 0 ? (
                  <p className="text-xs text-neutral-500">Belum ada pembayaran iuran yang dicatat.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-200 text-neutral-500">
                          <th className="py-2 pr-3 font-semibold">No. Kuitansi</th>
                          <th className="py-2 px-3 font-semibold">Tgl Iuran</th>
                          <th className="py-2 px-3 font-semibold">Pembayar</th>
                          <th className="py-2 px-3 font-semibold">Metode</th>
                          <th className="py-2 px-3 font-semibold text-right">Realisasi</th>
                          <th className="py-2 pl-3 font-semibold text-right">Kuitansi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {data.pembayaran.map((p) => (
                          <tr key={p.pembayaran_id}>
                            <td className="py-2 pr-3 font-mono font-semibold text-neutral-900">{p.no_kuitansi}</td>
                            <td className="py-2 px-3 font-mono text-neutral-600">{p.tanggal_bayar}</td>
                            <td className="py-2 px-3 text-neutral-800">{p.nama_pembayar}</td>
                            <td className="py-2 px-3 text-neutral-600">{p.metode_bayar}</td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-green-700">
                              {formatRp(p.nominal_bayar)}
                            </td>
                            <td className="py-2 pl-3 text-right">
                              <button
                                type="button"
                                onClick={() => setReceiptPreview(p)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Lihat / Cetak</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* SUBTAB 2: DAFTAR TRANSAKSI (PEMASUKAN, PENGELUARAN & JURNAL) */}
      {subTab === 'transaksi' && (
        <div className="space-y-5 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-neutral-200 rounded-xl p-4">
              <div className="text-xs text-neutral-500">Pemasukan Realisasi Iuran (Otomatis)</div>
              <div className="mt-1 text-lg font-bold font-mono tabular-nums text-green-700">
                {formatRp(data.summary.totalPemasukanIuran ?? data.summary.totalTerbayarIuran)}
              </div>
            </div>
            <div className="bg-white border border-neutral-200 rounded-xl p-4">
              <div className="text-xs text-neutral-500">Pemasukan Non-Iuran (Infak/Donasi/Lain)</div>
              <div className="mt-1 text-lg font-bold font-mono tabular-nums text-neutral-900">
                {formatRp(data.summary.totalPemasukanLainnya ?? 0)}
              </div>
            </div>
            <div className="bg-white border border-neutral-200 rounded-xl p-4">
              <div className="text-xs text-neutral-500">Total Transaksi Pengeluaran</div>
              <div className="mt-1 text-lg font-bold font-mono tabular-nums text-amber-700">
                {formatRp(data.summary.totalPengeluaranKas ?? data.summary.totalBeban)}
              </div>
            </div>
          </div>

          <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Daftar Transaksi Keuangan ({trxFilterLabel})</h3>
                <p className="text-xs text-neutral-600">
                  Realisasi Iuran yang dibayarkan otomatis masuk ke Daftar Transaksi Pemasukan (4101). Setiap transaksi membentuk jurnal berpasangan.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerPrint('transaksi')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak PDF</span>
                </button>
                {permission.can_export && (
                  <button
                    type="button"
                    onClick={() => {
                      exportTransactionsToExcel(filteredTrx, coaNameMap, trxFilterLabel, tahun);
                      onNotify(`Daftar transaksi ${trxFilterLabel} (${filteredTrx.length} baris) berhasil diekspor ke Excel.`);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-green-800 bg-green-50 border border-green-300 hover:bg-green-100 rounded-lg cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Export Excel</span>
                  </button>
                )}
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => {
                      if (trxKindFilter === 'PENGELUARAN') {
                        setTrxJenis('PENGELUARAN');
                        setTrxAkunLawan('5101');
                      } else if (trxKindFilter === 'PEMASUKAN') {
                        setTrxJenis('PEMASUKAN');
                        setTrxAkunLawan('4102');
                      }
                      setShowTrxModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Catat Transaksi Baru</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex flex-wrap border border-neutral-300 rounded-lg overflow-hidden text-xs font-semibold">
                {(
                  [
                    ['SEMUA', `Semua (${data.transaksi.length})`],
                    ['PEMASUKAN', `Transaksi Pemasukan (${pemasukanCount})`],
                    ['PENGELUARAN', `Transaksi Pengeluaran (${pengeluaranCount})`],
                    ['MUTASI_KOREKSI', `Mutasi & Koreksi (${mutasiKoreksiCount})`],
                  ] as [TrxFilterKind, string][]
                ).map(([kind, label]) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setTrxKindFilter(kind)}
                    className={`px-3 py-1.5 cursor-pointer ${
                      trxKindFilter === kind
                        ? 'bg-green-700 text-white'
                        : 'bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={trxSearch}
                  onChange={(e) => setTrxSearch(e.target.value)}
                  placeholder="Cari no bukti / keterangan..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-neutral-300 rounded-lg"
                />
              </div>
            </div>

            {filteredTrx.length === 0 ? (
              <p className="text-xs text-neutral-500 py-6 text-center">
                Belum ada transaksi {trxFilterLabel.toLowerCase()} yang cocok.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 text-neutral-500">
                      <th className="py-2.5 pr-3 font-semibold">No. Bukti</th>
                      <th className="py-2.5 px-3 font-semibold">Tanggal</th>
                      <th className="py-2.5 px-3 font-semibold">Jenis &amp; Sumber</th>
                      <th className="py-2.5 px-3 font-semibold">Keterangan</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Nominal</th>
                      <th className="py-2.5 px-3 font-semibold">Status &amp; Publikasi</th>
                      {canEdit && <th className="py-2.5 pl-3 font-semibold text-right">Kontrol</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredTrx.map((t) => (
                      <tr key={t.transaksi_id}>
                        <td className="py-2.5 pr-3 font-mono font-semibold text-neutral-900">{t.no_transaksi}</td>
                        <td className="py-2.5 px-3 font-mono text-neutral-600">{t.tanggal_transaksi}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`font-semibold ${
                              t.jenis_transaksi === 'PEMASUKAN'
                                ? 'text-green-700'
                                : t.jenis_transaksi === 'PENGELUARAN'
                                ? 'text-amber-700'
                                : 'text-neutral-700'
                            }`}
                          >
                            {t.jenis_transaksi}
                          </span>
                          {t.no_transaksi.startsWith('IUR-') && (
                            <div className="text-[11px] text-green-800">Otomatis dari Realisasi Iuran</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-800">
                          <div>{t.keterangan}</div>
                          {t.bukti?.drive_url && /^https?:\/\//i.test(t.bukti.drive_url) && (
                            <a
                              href={t.bukti.drive_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-green-700 hover:underline"
                            >
                              Lihat lampiran bukti
                            </a>
                          )}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono tabular-nums font-semibold ${
                            t.jenis_transaksi === 'PEMASUKAN' ? 'text-green-700' : 'text-neutral-900'
                          }`}
                        >
                          {formatRp(t.total_nominal)}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-[11px]">
                            <span
                              className={
                                t.status_verifikasi === 'TERVERIFIKASI'
                                  ? 'text-green-700 font-semibold'
                                  : 'text-amber-700 font-semibold'
                              }
                            >
                              {t.status_verifikasi}
                            </span>
                            {' · '}
                            <span className="text-neutral-500">{t.is_published ? 'Publik' : 'Internal'}</span>
                          </div>
                        </td>
                        {canEdit && (
                          <td className="py-2.5 pl-3 text-right space-x-2 whitespace-nowrap">
                            {t.status_verifikasi !== 'TERVERIFIKASI' && (
                              <button
                                type="button"
                                onClick={() => handleVerifyTrx(t.transaksi_id, 'TERVERIFIKASI', t.is_published)}
                                className="text-xs font-semibold text-green-700 hover:underline cursor-pointer"
                              >
                                Verifikasi
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleVerifyTrx(t.transaksi_id, t.status_verifikasi, !t.is_published)}
                              className="text-xs font-semibold text-neutral-600 hover:underline cursor-pointer"
                            >
                              {t.is_published ? 'Sembunyikan' : 'Publikasikan'}
                            </button>
                            {t.jenis_transaksi !== 'KOREKSI' && (
                              <button
                                type="button"
                                onClick={() => setReversingTrx(t)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Koreksi</span>
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {data.canDetail && (
            <div className="bg-white border border-neutral-200 rounded-xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-bold text-neutral-900">Jurnal Umum Double-Entry</h3>
                <div className="text-xs font-mono tabular-nums text-neutral-700">
                  Total Debit: <strong>{formatRp(totalDebitJurnal)}</strong> · Total Kredit:{' '}
                  <strong>{formatRp(totalKreditJurnal)}</strong> ·{' '}
                  <span className={totalDebitJurnal === totalKreditJurnal ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>
                    {totalDebitJurnal === totalKreditJurnal ? 'SEIMBANG' : 'TIDAK SEIMBANG'}
                  </span>
                </div>
              </div>
              {data.jurnal.length === 0 ? (
                <p className="text-xs text-neutral-500">Belum ada baris jurnal akuntansi.</p>
              ) : (
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200 text-neutral-500">
                        <th className="py-2 pr-3 font-semibold">Tanggal</th>
                        <th className="py-2 px-3 font-semibold">Akun COA</th>
                        <th className="py-2 px-3 font-semibold">Uraian</th>
                        <th className="py-2 px-3 font-semibold text-right">Debit</th>
                        <th className="py-2 pl-3 font-semibold text-right">Kredit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {data.jurnal.map((j) => (
                        <tr key={j.jurnal_id}>
                          <td className="py-2 pr-3 font-mono text-neutral-600">{j.tanggal}</td>
                          <td className="py-2 px-3 font-mono text-neutral-900">
                            {j.kode_akun} · {coaNameMap.get(j.kode_akun) || ''}
                          </td>
                          <td className="py-2 px-3 text-neutral-700">{j.keterangan_baris}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            {j.debit > 0 ? formatRp(j.debit) : '-'}
                          </td>
                          <td className="py-2 pl-3 text-right font-mono tabular-nums">
                            {j.kredit > 0 ? formatRp(j.kredit) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: ANGGARAN & COA */}
      {subTab === 'anggaran' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
          <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-neutral-900">Anggaran Belanja &amp; Program {tahun}</h3>
            {canEdit && (
              <form onSubmit={handleSaveAnggaran} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <SearchableSelect
                  value={angAkun}
                  onChange={setAngAkun}
                  options={data.coa
                    .filter((c) => c.kategori === 'BEBAN')
                    .map((c) => ({ value: c.kode_akun, label: `${c.kode_akun} · ${c.nama_akun}` }))}
                />
                <input
                  type="number"
                  min={0}
                  required
                  placeholder="Nominal anggaran"
                  value={angNominal}
                  onChange={(e) => setAngNominal(e.target.value)}
                  className="px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Keterangan"
                    value={angKet}
                    onChange={(e) => setAngKet(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500">
                    <th className="py-2 pr-3 font-semibold">Akun</th>
                    <th className="py-2 px-3 font-semibold">Keterangan</th>
                    <th className="py-2 pl-3 font-semibold text-right">Anggaran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {data.anggaran.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-neutral-500 text-center">
                        Belum ada pos anggaran tahun {tahun}.
                      </td>
                    </tr>
                  ) : (
                    data.anggaran.map((a) => (
                      <tr key={a.anggaran_id}>
                        <td className="py-2 pr-3 font-mono text-neutral-900">
                          {a.kode_akun} · {coaNameMap.get(a.kode_akun) || ''}
                        </td>
                        <td className="py-2 px-3 text-neutral-600">{a.keterangan || '-'}</td>
                        <td className="py-2 pl-3 text-right font-mono tabular-nums font-semibold">
                          {formatRp(a.nominal_anggaran)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-neutral-900">Bagan Akun Standar (COA)</h3>
            {canEdit && (
              <form onSubmit={handleSaveCoa} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Kode Akun (mis. 5110)"
                  value={coaKode}
                  onChange={(e) => setCoaKode(e.target.value)}
                  className="px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
                <input
                  type="text"
                  required
                  placeholder="Nama Akun"
                  value={coaNama}
                  onChange={(e) => setCoaNama(e.target.value)}
                  className="px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
                <SearchableSelect
                  value={coaKategori}
                  onChange={(v) => setCoaKategori(v as typeof coaKategori)}
                  options={[
                    { value: 'ASET', label: 'ASET' },
                    { value: 'KEWAJIBAN', label: 'KEWAJIBAN' },
                    { value: 'SALDO_DANA', label: 'SALDO DANA' },
                    { value: 'PENDAPATAN', label: 'PENDAPATAN' },
                    { value: 'BEBAN', label: 'BEBAN' },
                  ]}
                />
                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs text-neutral-700">
                    <input
                      type="checkbox"
                      checked={coaKasBank}
                      onChange={(e) => setCoaKasBank(e.target.checked)}
                    />
                    <span>Akun Kas/Bank</span>
                  </label>
                  <button
                    type="submit"
                    className="px-3 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
                  >
                    Tambah COA
                  </button>
                </div>
              </form>
            )}
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500">
                    <th className="py-2 pr-3 font-semibold">Kode</th>
                    <th className="py-2 px-3 font-semibold">Nama Akun</th>
                    <th className="py-2 pl-3 font-semibold">Kategori</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {data.coa.map((c) => (
                    <tr key={c.kode_akun}>
                      <td className="py-2 pr-3 font-mono font-semibold text-neutral-900">{c.kode_akun}</td>
                      <td className="py-2 px-3 text-neutral-700">{c.nama_akun}</td>
                      <td className="py-2 pl-3 text-neutral-500">{c.kategori}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: LAPORAN KEUANGAN RESMI */}
      {subTab === 'laporan' && (
        <div className="space-y-4 print:hidden">
          <div className="bg-white border border-neutral-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">
                Laporan Keuangan Resmi Paguyuban Tahun Buku {tahun}
              </h3>
              <p className="text-xs text-neutral-600 mt-0.5">
                Mencakup Laporan Aktivitas (Pendapatan &amp; Beban) serta Neraca Posisi Keuangan.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => triggerPrint('laporan')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Laporan PDF</span>
              </button>
              {permission.can_export && (
                <button
                  type="button"
                  onClick={() => {
                    exportFinanceWorkbookExcel(data);
                    onNotify('Laporan Keuangan Resmi berhasil diekspor ke Excel (.xlsx).');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-green-800 bg-green-50 border border-green-300 hover:bg-green-100 rounded-lg cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export Excel (.xlsx)</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-neutral-900">Laporan Aktivitas (Pendapatan &amp; Beban)</h3>
              <div className="divide-y divide-neutral-100 text-xs">
                {data.coaBalances
                  .filter((c) => c.kategori === 'PENDAPATAN' || c.kategori === 'BEBAN')
                  .map((c) => (
                    <div key={c.kode_akun} className="py-2 flex items-center justify-between">
                      <span className="text-neutral-700">
                        <span className="font-mono text-neutral-500">{c.kode_akun}</span> · {c.nama_akun}
                      </span>
                      <span
                        className={`font-mono tabular-nums font-semibold ${
                          c.kategori === 'PENDAPATAN' ? 'text-green-700' : 'text-neutral-900'
                        }`}
                      >
                        {c.kategori === 'BEBAN' ? `(${formatRp(c.saldo)})` : formatRp(c.saldo)}
                      </span>
                    </div>
                  ))}
                <div className="pt-3 flex items-center justify-between font-bold text-sm text-neutral-900">
                  <span>Surplus / (Defisit) Bersih</span>
                  <span className="font-mono tabular-nums text-green-800">
                    {formatRp(data.summary.surplusDefisit)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-neutral-900">Neraca / Posisi Keuangan Paguyuban</h3>
              <div className="divide-y divide-neutral-100 text-xs">
                {data.coaBalances
                  .filter((c) => c.kategori === 'ASET' || c.kategori === 'KEWAJIBAN' || c.kategori === 'SALDO_DANA')
                  .map((c) => (
                    <div key={c.kode_akun} className="py-2 flex items-center justify-between">
                      <span className="text-neutral-700">
                        <span className="font-mono text-neutral-500">{c.kode_akun}</span> · {c.nama_akun}
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-neutral-900">
                        {formatRp(c.saldo)}
                      </span>
                    </div>
                  ))}
                <div className="pt-3 flex items-center justify-between font-bold text-xs text-neutral-800">
                  <span>Total Aset</span>
                  <span className="font-mono tabular-nums">{formatRp(data.summary.totalAset)}</span>
                </div>
                <div className="pt-2 flex items-center justify-between font-bold text-xs text-neutral-800">
                  <span>Total Kewajiban + Saldo Dana + Surplus Berjalan</span>
                  <span className="font-mono tabular-nums">
                    {formatRp(data.summary.totalKewajiban + data.summary.totalSaldoDana + data.summary.surplusDefisit)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED PRINT VIEWS (only shown when window.print() is active, unless receipt modal is open) */}
      {!receiptPreview && (
        <div className="hidden print:block bg-white p-4 text-xs space-y-5">
          <div className="border-b-2 border-green-900 pb-3 flex items-start justify-between">
            <div>
              <div className="text-base font-bold text-green-900 uppercase">
                Paguyuban Keluarga Besar Bani Haji Mohammad Tohir
              </div>
              <div className="text-xs text-neutral-600 mt-0.5">
                Guyub, Akur, Semedulur ·{' '}
                {activePrintScope === 'laporan'
                  ? `Laporan Keuangan Resmi Tahun Buku ${tahun}`
                  : activePrintScope === 'transaksi'
                  ? `Daftar Transaksi ${trxFilterLabel} Tahun Buku ${tahun}`
                  : `Daftar Target & Realisasi Iuran Tahun ${tahun}`}
              </div>
            </div>
            <div className="text-right text-[11px] font-mono text-neutral-600">
              Dicetak: {new Date().toLocaleDateString('id-ID')}
            </div>
          </div>

          {activePrintScope === 'iuran' && data.canDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 border border-neutral-300 rounded p-3">
                <div>
                  <div className="text-[11px] text-neutral-500">Total Target Iuran</div>
                  <div className="font-mono font-bold">{formatRp(data.summary.totalTargetIuran)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500">Total Realisasi Terbayar</div>
                  <div className="font-mono font-bold text-green-800">{formatRp(data.summary.totalTerbayarIuran)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500">Sisa Target</div>
                  <div className="font-mono font-bold">{formatRp(data.summary.totalSisaIuran)}</div>
                </div>
              </div>
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-neutral-400 text-neutral-700 font-bold">
                    <th className="py-1.5 pr-2">No</th>
                    <th className="py-1.5 px-2">Kode</th>
                    <th className="py-1.5 px-2">Nama Wajib Iuran</th>
                    <th className="py-1.5 px-2 text-right">Target</th>
                    <th className="py-1.5 px-2 text-right">Realisasi</th>
                    <th className="py-1.5 px-2 text-right">Sisa</th>
                    <th className="py-1.5 px-2">Tgl Iuran</th>
                    <th className="py-1.5 pl-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredBills.map((b, i) => (
                    <tr key={b.tagihan_id}>
                      <td className="py-1 pr-2 font-mono">{i + 1}</td>
                      <td className="py-1 px-2 font-mono">{b.kode_silsilah || b.id_kk}</td>
                      <td className="py-1 px-2 font-medium">{b.nama_anggota || b.id_kk}</td>
                      <td className="py-1 px-2 text-right font-mono">{formatRp(b.nominal_tagihan)}</td>
                      <td className="py-1 px-2 text-right font-mono">{formatRp(b.total_terbayar)}</td>
                      <td className="py-1 px-2 text-right font-mono">{formatRp(b.sisa_tagihan)}</td>
                      <td className="py-1 px-2 font-mono">{b.tanggal_bayar_terakhir || '-'}</td>
                      <td className="py-1 pl-2">{b.status_bayar.replace('_', ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activePrintScope === 'transaksi' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 border border-neutral-300 rounded p-3">
                <div>
                  <div className="text-[11px] text-neutral-500">Pemasukan Iuran (Otomatis)</div>
                  <div className="font-mono font-bold text-green-800">
                    {formatRp(data.summary.totalPemasukanIuran ?? data.summary.totalTerbayarIuran)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500">Pemasukan Lainnya</div>
                  <div className="font-mono font-bold">{formatRp(data.summary.totalPemasukanLainnya ?? 0)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500">Total Pengeluaran</div>
                  <div className="font-mono font-bold">{formatRp(data.summary.totalPengeluaranKas ?? data.summary.totalBeban)}</div>
                </div>
              </div>
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-neutral-400 text-neutral-700 font-bold">
                    <th className="py-1.5 pr-2">No. Bukti</th>
                    <th className="py-1.5 px-2">Tanggal</th>
                    <th className="py-1.5 px-2">Jenis</th>
                    <th className="py-1.5 px-2">Keterangan</th>
                    <th className="py-1.5 px-2 text-right">Nominal</th>
                    <th className="py-1.5 pl-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredTrx.map((t) => (
                    <tr key={t.transaksi_id}>
                      <td className="py-1 pr-2 font-mono">{t.no_transaksi}</td>
                      <td className="py-1 px-2 font-mono">{t.tanggal_transaksi}</td>
                      <td className="py-1 px-2">{t.jenis_transaksi}</td>
                      <td className="py-1 px-2">{t.keterangan}</td>
                      <td className="py-1 px-2 text-right font-mono">{formatRp(t.total_nominal)}</td>
                      <td className="py-1 pl-2">{t.status_verifikasi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activePrintScope === 'laporan' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="border border-neutral-300 rounded p-4 space-y-2">
                  <div className="font-bold text-sm border-b border-neutral-300 pb-1">
                    Laporan Aktivitas (Pendapatan &amp; Beban)
                  </div>
                  {data.coaBalances
                    .filter((c) => c.kategori === 'PENDAPATAN' || c.kategori === 'BEBAN')
                    .map((c) => (
                      <div key={c.kode_akun} className="flex justify-between py-1 border-b border-neutral-100">
                        <span>
                          {c.kode_akun} · {c.nama_akun}
                        </span>
                        <span className="font-mono">
                          {c.kategori === 'BEBAN' ? `(${formatRp(c.saldo)})` : formatRp(c.saldo)}
                        </span>
                      </div>
                    ))}
                  <div className="flex justify-between pt-2 font-bold">
                    <span>Surplus / (Defisit) Bersih</span>
                    <span className="font-mono">{formatRp(data.summary.surplusDefisit)}</span>
                  </div>
                </div>

                <div className="border border-neutral-300 rounded p-4 space-y-2">
                  <div className="font-bold text-sm border-b border-neutral-300 pb-1">
                    Neraca Posisi Keuangan
                  </div>
                  {data.coaBalances
                    .filter((c) => c.kategori === 'ASET' || c.kategori === 'KEWAJIBAN' || c.kategori === 'SALDO_DANA')
                    .map((c) => (
                      <div key={c.kode_akun} className="flex justify-between py-1 border-b border-neutral-100">
                        <span>
                          {c.kode_akun} · {c.nama_akun}
                        </span>
                        <span className="font-mono">{formatRp(c.saldo)}</span>
                      </div>
                    ))}
                  <div className="flex justify-between pt-2 font-bold">
                    <span>Total Aset</span>
                    <span className="font-mono">{formatRp(data.summary.totalAset)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Total Kewajiban + Saldo Dana + Surplus</span>
                    <span className="font-mono">
                      {formatRp(data.summary.totalKewajiban + data.summary.totalSaldoDana + data.summary.surplusDefisit)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-8 text-center">
                <div>
                  <div>Mengetahui, Ketua Paguyuban</div>
                  <div className="mt-14 font-bold">_________________________</div>
                </div>
                <div>
                  <div>Bendahara Paguyuban</div>
                  <div className="mt-14 font-bold">_________________________</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL BAYAR IURAN */}
      {payingBill && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">Catat Pembayaran Target Iuran</h3>
              <button type="button" onClick={() => setPayingBill(null)} className="text-neutral-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-neutral-600">
              Wajib iuran: <strong className="text-neutral-900">{payingBill.nama_anggota || payingBill.id_kk}</strong> · Sisa:{' '}
              <strong className="font-mono text-amber-700">{formatRp(payingBill.sisa_tagihan)}</strong>
            </div>
            <form onSubmit={handleSubmitPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Nominal Pembayaran (Rp)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={payNominal}
                  onChange={(e) => setPayNominal(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Metode</label>
                  <SearchableSelect
                    value={payMetode}
                    onChange={(v) => setPayMetode(v as typeof payMetode)}
                    options={[
                      { value: 'TRANSFER_BANK', label: 'Transfer Bank' },
                      { value: 'TUNAI', label: 'Tunai' },
                      { value: 'QRIS', label: 'QRIS' },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Masuk ke Akun</label>
                  <SearchableSelect
                    value={payAkunKas}
                    onChange={setPayAkunKas}
                    options={kasAccounts.map((c) => ({
                      value: c.kode_akun,
                      label: `${c.kode_akun} · ${c.nama_akun}`,
                    }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Tanggal Pembayaran</label>
                <input
                  type="date"
                  required
                  value={payTanggal}
                  onChange={(e) => setPayTanggal(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Keterangan</label>
                <input
                  type="text"
                  value={payKet}
                  onChange={(e) => setPayKet(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingBill(null)}
                  className="px-3.5 py-2 text-xs font-semibold border border-neutral-300 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
                >
                  Simpan &amp; Terbitkan Kuitansi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL UBAH TARGET / KERINGANAN */}
      {editingBill && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">Ubah Target &amp; Keringanan Iuran</h3>
              <button type="button" onClick={() => setEditingBill(null)} className="text-neutral-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitEditBill} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Nominal Target Iuran (Rp)</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={editNominal}
                  onChange={(e) => setEditNominal(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Diskon / Pembebasan (Rp)</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={editDiskon}
                  onChange={(e) => setEditDiskon(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Alasan Penyesuaian</label>
                <input
                  type="text"
                  value={editAlasan}
                  onChange={(e) => setEditAlasan(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBill(null)}
                  className="px-3.5 py-2 text-xs font-semibold border border-neutral-300 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL GENERATE TAGIHAN */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">Generate Target Iuran KK ({tahun})</h3>
              <button type="button" onClick={() => setShowGenerateModal(false)} className="text-neutral-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-600">
              Menambahkan target iuran untuk Rumah Tangga/KK aktif yang belum memiliki tagihan pada tahun {tahun}.
            </p>
            <form onSubmit={handleGenerateBills} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Nominal Standar (Rp)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={genNominal}
                  onChange={(e) => setGenNominal(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Jatuh Tempo</label>
                <input
                  type="date"
                  required
                  value={genJatuhTempo}
                  onChange={(e) => setGenJatuhTempo(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold border border-neutral-300 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
                >
                  Generate Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TRANSAKSI BARU */}
      {showTrxModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">Catat Transaksi Keuangan</h3>
              <button type="button" onClick={() => setShowTrxModal(false)} className="text-neutral-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitTrx} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Jenis Transaksi</label>
                  <SearchableSelect
                    value={trxJenis}
                    onChange={(v) => {
                      const val = v as typeof trxJenis;
                      setTrxJenis(val);
                      if (val === 'PEMASUKAN') setTrxAkunLawan('4102');
                      else if (val === 'PENGELUARAN') setTrxAkunLawan('5101');
                      else setTrxAkunLawan('1201');
                    }}
                    options={[
                      { value: 'PEMASUKAN', label: 'Pemasukan' },
                      { value: 'PENGELUARAN', label: 'Pengeluaran' },
                      { value: 'MUTASI', label: 'Mutasi Antar Kas/Bank' },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={trxTgl}
                    onChange={(e) => setTrxTgl(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  {trxJenis === 'MUTASI' ? 'Dari Akun Kas/Bank (Kredit)' : 'Akun Kas / Bank'}
                </label>
                <SearchableSelect
                  value={trxAkunKas}
                  onChange={setTrxAkunKas}
                  options={kasAccounts.map((c) => ({
                    value: c.kode_akun,
                    label: `${c.kode_akun} · ${c.nama_akun}`,
                  }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  {trxJenis === 'MUTASI' ? 'Ke Akun Kas/Bank Tujuan (Debit)' : 'Akun Lawan (Pendapatan / Beban)'}
                </label>
                <SearchableSelect
                  value={trxAkunLawan}
                  onChange={setTrxAkunLawan}
                  options={lawanAccounts.map((c) => ({
                    value: c.kode_akun,
                    label: `${c.kode_akun} · ${c.nama_akun}`,
                  }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Nominal (Rp)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={trxNominal}
                  onChange={(e) => setTrxNominal(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Keterangan</label>
                <input
                  type="text"
                  required
                  value={trxKet}
                  onChange={(e) => setTrxKet(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Tautan Bukti Drive/Foto (opsional)</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={trxBuktiUrl}
                  onChange={(e) => setTrxBuktiUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-neutral-700">
                <input
                  type="checkbox"
                  checked={trxPublished}
                  onChange={(e) => setTrxPublished(e.target.checked)}
                />
                <span>Publikasikan ringkasan transaksi ini ke anggota</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTrxModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold border border-neutral-300 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
                >
                  Simpan &amp; Posting Jurnal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KOREKSI TRANSAKSI */}
      {reversingTrx && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">Jurnal Pembalik (Koreksi)</h3>
              <button type="button" onClick={() => setReversingTrx(null)} className="text-neutral-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-neutral-600">
              Transaksi <strong>{reversingTrx.no_transaksi}</strong> ({formatRp(reversingTrx.total_nominal)}) tidak dihapus,
              melainkan dibuatkan transaksi pembalik agar jejak audit tetap utuh.
            </p>
            <form onSubmit={handleReverseTrx} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Alasan Koreksi</label>
                <input
                  type="text"
                  required
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReversingTrx(null)}
                  className="px-3.5 py-2 text-xs font-semibold border border-neutral-300 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
                >
                  Terbitkan Jurnal Pembalik
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KUITANSI CETAK */}
      {receiptPreview && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 flex items-center justify-center p-4 print:static print:bg-white print:p-0">
          <div className="bg-white border border-neutral-300 rounded-xl w-full max-w-lg p-6 space-y-4 print:border-0 print:max-w-none">
            <div className="flex items-start justify-between border-b-2 border-green-800 pb-3">
              <div>
                <div className="text-sm font-bold text-green-900">PAGUYUBAN KELUARGA BESAR BANI HAJI MOHAMMAD TOHIR</div>
                <div className="text-xs text-neutral-600">Guyub, Akur, Semedulur · Kuitansi Pembayaran Resmi</div>
              </div>
              <button
                type="button"
                onClick={() => setReceiptPreview(null)}
                className="text-neutral-500 cursor-pointer print:hidden"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-neutral-500">Nomor Kuitansi</div>
              <div className="font-mono font-bold text-neutral-900">{receiptPreview.no_kuitansi}</div>
              <div className="text-neutral-500">Tanggal Bayar</div>
              <div className="font-mono text-neutral-900">{receiptPreview.tanggal_bayar}</div>
              <div className="text-neutral-500">Telah Diterima Dari</div>
              <div className="font-semibold text-neutral-900">{receiptPreview.nama_pembayar}</div>
              <div className="text-neutral-500">Metode Pembayaran</div>
              <div className="text-neutral-900">{receiptPreview.metode_bayar}</div>
              <div className="text-neutral-500">Untuk Pembayaran</div>
              <div className="text-neutral-900">{receiptPreview.keterangan}</div>
            </div>
            <div className="border-t border-b border-neutral-200 py-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-700">Jumlah Diterima</span>
              <span className="text-xl font-bold font-mono tabular-nums text-green-800">
                {formatRp(receiptPreview.nominal_bayar)}
              </span>
            </div>
            <div className="flex items-center justify-end gap-2 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak / Simpan PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
