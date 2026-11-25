import React, { useEffect, useState } from 'react';
import { Check, Edit3, Play, Search } from 'lucide-react';
import { StagingRow } from '../types';
import { EditRecordModal } from './EditRecordModal';

interface MigrationTabProps {
  token: string;
  onCommitted: () => void;
  onNotify: (msg: string, kind?: 'success' | 'error') => void;
}

export function MigrationTab({ token, onCommitted, onNotify }: MigrationTabProps) {
  const [codeMode, setCodeMode] = useState<'AUTO_GENERATE' | 'KEEP_RAW'>('AUTO_GENERATE');
  const [filter, setFilter] = useState<'ALL' | 'KODE' | 'TGL_LAHIR' | 'MULTI_PASANGAN' | 'NAMA_KOSONG'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<StagingRow[]>([]);
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [summary, setSummary] = useState({
    total: 0,
    siap: 0,
    skip: 0,
    perluEditTgl: 0,
    anomaliKode: 0,
    multiPasangan: 0,
    namaKosong: 0,
  });
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<StagingRow | null>(null);

  async function fetchStaging(targetPage = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        filter,
        q: search,
        page: String(targetPage),
        pageSize: '25',
      });
      const res = await fetch(`/api/migration/staging?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        onNotify(data.message || 'Gagal memuat staging.', 'error');
        return;
      }
      setRows(data.rows);
      setSummary(data.summary);
      setTotalFiltered(data.totalFiltered);
      setPage(data.page);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStaging(1);
  }, [filter]);

  async function handleDryRun(mode: 'AUTO_GENERATE' | 'KEEP_RAW') {
    setCodeMode(mode);
    setLoading(true);
    try {
      const res = await fetch('/api/migration/dry-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ codeMode: mode, skipEmptyNames: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        onNotify(data.message || 'Dry-run gagal.', 'error');
        return;
      }
      onNotify(
        `Staging diperbarui (${data.totalStaging} baris) dengan opsi ${
          mode === 'AUTO_GENERATE' ? 'Generate Kode Otomatis' : 'Pertahankan Kode Asli'
        }.`
      );
      await fetchStaging(1);
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    setLoading(true);
    try {
      const res = await fetch('/api/migration/commit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        onNotify(data.message || 'Commit migrasi gagal.', 'error');
        return;
      }
      onNotify(`Commit berhasil! ${data.insertedMembers} anggota disimpan ke tabel produksi.`);
      onCommitted();
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveStagingEdit(payload: { generated_kode?: string; tempat_lahir: string; tanggal_lahir: string }) {
    if (!editingRow) return;
    const res = await fetch(`/api/migration/staging/${editingRow.staging_id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        generated_kode: payload.generated_kode,
        tempat_lahir: payload.tempat_lahir,
        tanggal_lahir_iso: payload.tanggal_lahir,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      onNotify(data.message || 'Gagal menyimpan perubahan staging.', 'error');
      return;
    }
    setEditingRow(null);
    onNotify('Baris staging berhasil diperbarui.');
    await fetchStaging(page);
  }

  const totalPages = Math.max(Math.ceil(totalFiltered / 25), 1);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Inisialisasi &amp; Migrasi Data Aman</h2>
            <p className="text-sm text-neutral-600 mt-1">
              Sumber asli (DATABASE_BANI_TOHIR_2026) diarsipkan tanpa dihapus. Pilih opsi penyesuaian kode dan perbarui tanggal lahir jika perlu sebelum commit.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={handleCommit}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 disabled:opacity-60 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Check className="w-4 h-4" />
            <span>Commit ke Tabel Produksi</span>
          </button>
        </div>

        <div className="pt-3 border-t border-neutral-200 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-lg">
            <button
              type="button"
              onClick={() => handleDryRun('AUTO_GENERATE')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                codeMode === 'AUTO_GENERATE' ? 'bg-white text-green-800 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Opsi: Generate &amp; Rapikan Kode Otomatis
            </button>
            <button
              type="button"
              onClick={() => handleDryRun('KEEP_RAW')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                codeMode === 'KEEP_RAW' ? 'bg-white text-green-800 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Opsi: Pertahankan Kode Asli
            </button>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleDryRun(codeMode)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-neutral-900 hover:text-white rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Jalankan Ulang Dry-Run</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 text-xs">
          <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
            <div className="text-neutral-500">Total Staging</div>
            <div className="mt-1 text-lg font-bold font-mono tabular-nums">{summary.total}</div>
          </div>
          <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
            <div className="text-neutral-500">Siap Commit</div>
            <div className="mt-1 text-lg font-bold font-mono tabular-nums text-green-700">{summary.siap}</div>
          </div>
          <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
            <div className="text-neutral-500">Kode Disesuaikan</div>
            <div className="mt-1 text-lg font-bold font-mono tabular-nums">{summary.anomaliKode}</div>
          </div>
          <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
            <div className="text-neutral-500">Perlu Edit Tgl Lahir</div>
            <div className="mt-1 text-lg font-bold font-mono tabular-nums text-amber-600">{summary.perluEditTgl}</div>
          </div>
          <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
            <div className="text-neutral-500">Multi-Pasangan</div>
            <div className="mt-1 text-lg font-bold font-mono tabular-nums">{summary.multiPasangan}</div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-neutral-100 rounded-lg">
            {[
              { id: 'ALL', label: 'Semua' },
              { id: 'KODE', label: 'Anomali Kode' },
              { id: 'TGL_LAHIR', label: 'Perlu Edit Tgl' },
              { id: 'MULTI_PASANGAN', label: 'Multi-Pasangan' },
              { id: 'NAMA_KOSONG', label: 'Nama Kosong' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as typeof filter)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  filter === tab.id ? 'bg-white text-neutral-900 shadow-sm font-semibold' : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchStaging(1);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama atau kode..."
                className="pl-8 pr-3 py-1.5 text-xs border border-neutral-300 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg cursor-pointer"
            >
              Cari
            </button>
          </form>
        </div>

        <div className="overflow-x-auto border border-neutral-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                <th className="py-2.5 px-3">ID Calon</th>
                <th className="py-2.5 px-3">Kode Lama → Hasil</th>
                <th className="py-2.5 px-3">Nama Lengkap</th>
                <th className="py-2.5 px-3">Keturunan &amp; Gen</th>
                <th className="py-2.5 px-3">Tempat &amp; Tanggal Lahir</th>
                <th className="py-2.5 px-3">Status &amp; Temuan</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-500">
                    {loading ? 'Memuat data staging...' : 'Tidak ada baris yang cocok dengan filter.'}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.staging_id} className="hover:bg-neutral-50">
                    <td className="py-2.5 px-3 font-mono tabular-nums text-neutral-700">
                      {r.id_anggota_calon || r.action_status}
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums">
                      {r.raw_kode === r.generated_kode ? (
                        <span>{r.generated_kode || '-'}</span>
                      ) : (
                        <span>
                          <span className="text-neutral-400">{r.raw_kode}</span> →{' '}
                          <span className="font-semibold text-green-800">{r.generated_kode}</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-neutral-900">
                      {[r.gelar_depan, r.nama_lengkap, r.gelar_belakang].filter(Boolean).join(' ') || (
                        <span className="text-neutral-400 italic">(Slot Kosong)</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-700">
                      {r.status_keturunan} · {r.generasi_label}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-neutral-900">
                        {r.tempat_lahir || '-'} ·{' '}
                        <span className="font-mono tabular-nums">
                          {r.tanggal_lahir_iso || 'Belum diisi'}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        Asli: {r.raw_ttl || '-'} ({r.presisi_tgl_lahir})
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-amber-800">
                      {r.anomaly_flags.length > 0 ? r.anomaly_flags.join(' · ') : 'Bersih'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingRow(r)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-md cursor-pointer whitespace-nowrap"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-xs text-neutral-600 pt-1">
          <span className="tabular-nums">
            Halaman {page} dari {totalPages} · {totalFiltered} baris ditemukan
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => fetchStaging(page - 1)}
              className="px-3 py-1.5 border border-neutral-300 rounded-md bg-white disabled:opacity-40 cursor-pointer"
            >
              Sebelumnya
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => fetchStaging(page + 1)}
              className="px-3 py-1.5 border border-neutral-300 rounded-md bg-white disabled:opacity-40 cursor-pointer"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>

      {editingRow && (
        <EditRecordModal
          mode="STAGING"
          recordId={editingRow.staging_id}
          memberName={editingRow.nama_lengkap}
          initialKode={editingRow.generated_kode}
          initialTempat={editingRow.tempat_lahir}
          initialTanggal={editingRow.tanggal_lahir_iso}
          onClose={() => setEditingRow(null)}
          onSave={handleSaveStagingEdit}
        />
      )}
    </div>
  );
}
