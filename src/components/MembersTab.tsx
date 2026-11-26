import React, { useEffect, useState } from 'react';
import { Archive, Edit3, Eye, FileSpreadsheet, Plus, Printer, RotateCcw, Search } from 'lucide-react';
import { MasterBundles, MemberRecord, ModulePermission } from '../types';
import { MemberFormModal } from './MemberFormModal';
import { MemberDetailModal } from './MemberDetailModal';
import { SearchableSelect } from './SearchableSelect';
import { PrintPreviewModal } from './PrintPreviewModal';
import { exportMembersToExcel } from '../utils/exportExcel';
import { generateTablePdf } from '../utils/exportPdf';

interface MembersTabProps {
  token: string;
  permission: ModulePermission;
  masters: MasterBundles;
  onGoToMigration: () => void;
  onOpenTreeFocus: (memberId: string) => void;
  onNotify: (msg: string, kind?: 'success' | 'error') => void;
}

export function MembersTab({
  token,
  permission,
  masters,
  onGoToMigration,
  onOpenTreeFocus,
  onNotify,
}: MembersTabProps) {
  const [rows, setRows] = useState<MemberRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [generasi, setGenerasi] = useState('');
  const [statusKeturunan, setStatusKeturunan] = useState('');
  const [statusHidup, setStatusHidup] = useState('');
  const [cabang, setCabang] = useState('');
  const [needEditOnly, setNeedEditOnly] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printRows, setPrintRows] = useState<MemberRecord[] | null>(null);

  const [formModalMember, setFormModalMember] = useState<MemberRecord | null | undefined>(undefined);
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);

  function buildFilterParams(targetPage: number, pageSize: number) {
    return new URLSearchParams({
      q: search,
      generasi,
      statusKeturunan,
      statusHidup,
      cabang,
      needEdit: String(needEditOnly),
      includeArchived: String(includeArchived),
      page: String(targetPage),
      pageSize: String(pageSize),
    });
  }

  async function fetchMembers(targetPage = page) {
    setLoading(true);
    try {
      const params = buildFilterParams(targetPage, 25);
      const res = await fetch(`/api/members?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        onNotify(data.message || 'Gagal memuat anggota.', 'error');
        return;
      }
      setRows(data.rows);
      setTotal(data.total);
      setPage(data.page);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMembers(1);
  }, [generasi, statusKeturunan, statusHidup, cabang, needEditOnly, includeArchived]);

  async function fetchAllFilteredForExport(): Promise<MemberRecord[]> {
    const params = buildFilterParams(1, 2000);
    const res = await fetch(`/api/members?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.message || 'Gagal mengunduh daftar anggota.');
    }
    return data.rows || [];
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      const all = await fetchAllFilteredForExport();
      exportMembersToExcel(all, masters);
      onNotify(`Berhasil mengekspor ${all.length} data anggota ke Excel (.xlsx).`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal mengekspor Excel.', 'error');
    } finally {
      setExporting(false);
    }
  }

  async function handlePrintPdf() {
    setExporting(true);
    try {
      const all = await fetchAllFilteredForExport();
      setPrintRows(all);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal menyiapkan konsep cetak PDF.', 'error');
    } finally {
      setExporting(false);
    }
  }

  async function handleToggleArchive(m: MemberRecord) {
    const archiveNext = !m.is_archived;
    const res = await fetch(`/api/members/${m.id_anggota}/archive`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ archive: archiveNext }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      onNotify(data.message || 'Gagal mengubah status arsip.', 'error');
      return;
    }
    onNotify(archiveNext ? `${m.nama_lengkap} dipindahkan ke arsip.` : `${m.nama_lengkap} dipulihkan dari arsip.`);
    fetchMembers(page);
  }

  const totalPages = Math.max(Math.ceil(total / 25), 1);

  return (
    <>
      <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4 print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Data Anggota Keluarga Besar</h2>
            <p className="text-xs text-neutral-600 mt-0.5">
              Kelola biodata lengkap, gelar, keturunan, tanggal lahir, status kehidupan, wilayah domisili, cetak PDF, dan ekspor Excel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={exporting || total === 0}
              onClick={handlePrintPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / PDF</span>
            </button>
            {permission.can_export && (
              <button
                type="button"
                disabled={exporting || total === 0}
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-green-800 bg-green-50 border border-green-300 hover:bg-green-100 rounded-lg cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </button>
            )}
            {permission.can_create && (
              <button
                type="button"
                onClick={() => setFormModalMember(null)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Anggota</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-1">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchMembers(1);
            }}
            className="sm:col-span-2 flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama, ID, kode, tempat lahir..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg cursor-pointer"
            >
              Cari
            </button>
          </form>

          <SearchableSelect
            compact
            value={cabang}
            onChange={setCabang}
            options={[
              { value: '', label: 'Semua Cabang (1–9)' },
              ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((c) => ({
                value: String(c),
                label: `Cabang Anak ke-${c}`,
              })),
            ]}
            allowClear
          />

          <SearchableSelect
            compact
            value={generasi}
            onChange={setGenerasi}
            options={[
              { value: '', label: 'Semua Generasi' },
              ...masters.generasi.map((g) => ({
                value: String(g.level_angka ?? g.urutan),
                label: `Gen ${g.level_angka ?? g.urutan} · ${g.nama}`,
              })),
            ]}
            allowClear
          />

          <SearchableSelect
            compact
            value={statusKeturunan}
            onChange={setStatusKeturunan}
            options={[
              { value: '', label: 'Semua Keturunan' },
              { value: 'Kandung', label: 'Kandung' },
              { value: 'Menantu', label: 'Menantu' },
              { value: 'Anak Angkat', label: 'Anak Angkat' },
            ]}
            allowClear
          />

          <SearchableSelect
            compact
            value={statusHidup}
            onChange={setStatusHidup}
            options={[
              { value: '', label: 'Semua Status Hidup' },
              { value: 'HIDUP', label: 'HIDUP' },
              { value: 'WAFAT', label: 'WAFAT' },
              { value: 'TIDAK_DIKETAHUI', label: 'TIDAK DIKETAHUI' },
            ]}
            allowClear
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-700">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={needEditOnly}
              onChange={(e) => setNeedEditOnly(e.target.checked)}
              className="rounded border-neutral-300 text-green-700 focus:ring-green-700"
            />
            <span>Hanya yang perlu lengkapi tanggal lahir</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="rounded border-neutral-300 text-amber-700 focus:ring-amber-700"
            />
            <span>Tampilkan anggota arsip</span>
          </label>
        </div>

        {total === 0 && !loading && !search && !cabang && !generasi && !statusKeturunan && !statusHidup ? (
          <div className="py-12 text-center border border-dashed border-neutral-300 rounded-lg space-y-3">
            <p className="text-sm font-medium text-neutral-700">Tabel anggota produksi belum diisi.</p>
            <p className="text-xs text-neutral-500">
              Silakan lakukan Commit di menu Migrasi &amp; Staging untuk memindahkan data dari spreadsheet lama.
            </p>
            <button
              type="button"
              onClick={onGoToMigration}
              className="px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
            >
              Buka Menu Migrasi &amp; Staging
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto border border-neutral-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                    <th className="py-2.5 px-3">ID Anggota</th>
                    <th className="py-2.5 px-3">Kode Silsilah</th>
                    <th className="py-2.5 px-3">Nama Lengkap</th>
                    <th className="py-2.5 px-3">Generasi &amp; Keturunan</th>
                    <th className="py-2.5 px-3">Tempat &amp; Tanggal Lahir</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-neutral-500">
                        Tidak ada anggota yang cocok dengan filter saat ini.
                      </td>
                    </tr>
                  ) : (
                    rows.map((m) => (
                      <tr key={m.id_anggota} className={`hover:bg-neutral-50 ${m.is_archived ? 'opacity-60' : ''}`}>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-neutral-700">{m.id_anggota}</td>
                        <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-green-800">
                          {m.kode_silsilah || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-neutral-900">
                          <button
                            type="button"
                            onClick={() => setDetailMemberId(m.id_anggota)}
                            className="text-left hover:text-green-800 hover:underline cursor-pointer font-semibold"
                          >
                            {[m.gelar_depan, m.nama_lengkap, m.gelar_belakang].filter(Boolean).join(' ')}
                          </button>
                          {m.is_kk && <span className="text-green-800 font-semibold"> · KK</span>}
                          {m.is_archived && <span className="text-amber-700 font-semibold"> · Arsip</span>}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-700">
                          {m.generasi_label} · {m.status_keturunan}
                        </td>
                        <td className="py-2.5 px-3">
                          <span>{m.tempat_lahir || '-'}</span>
                          <span aria-hidden="true"> · </span>
                          <span
                            className={`font-mono tabular-nums ${
                              !m.tanggal_lahir ? 'text-amber-700 font-semibold' : ''
                            }`}
                          >
                            {m.tanggal_lahir || 'Belum diisi'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-700">{m.status_hidup}</td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDetailMemberId(m.id_anggota)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-md cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Detail</span>
                            </button>
                            {permission.can_edit && (
                              <button
                                type="button"
                                onClick={() => setFormModalMember(m)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-green-800 bg-green-50 border border-green-200 hover:bg-green-100 rounded-md cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit Lengkap</span>
                              </button>
                            )}
                            {permission.can_delete && m.id_anggota !== 'BMT-0000' && (
                              <button
                                type="button"
                                onClick={() => handleToggleArchive(m)}
                                title={m.is_archived ? 'Pulihkan dari Arsip' : 'Arsipkan Anggota'}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-neutral-600 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-md cursor-pointer"
                              >
                                {m.is_archived ? <RotateCcw className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-xs text-neutral-600">
              <span className="tabular-nums">
                Halaman {page} dari {totalPages} · {total} anggota
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => fetchMembers(page - 1)}
                  className="px-3 py-1.5 border border-neutral-300 rounded-md bg-white disabled:opacity-40 cursor-pointer"
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => fetchMembers(page + 1)}
                  className="px-3 py-1.5 border border-neutral-300 rounded-md bg-white disabled:opacity-40 cursor-pointer"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </>
        )}

        {formModalMember !== undefined && (
          <MemberFormModal
            token={token}
            member={formModalMember}
            masters={masters}
            onClose={() => setFormModalMember(undefined)}
            onSaved={() => {
              setFormModalMember(undefined);
              fetchMembers(page);
            }}
            onNotify={onNotify}
          />
        )}

        {detailMemberId && (
          <MemberDetailModal
            token={token}
            memberId={detailMemberId}
            masters={masters}
            canEdit={permission.can_edit}
            onClose={() => setDetailMemberId(null)}
            onSelectMember={(nextId) => setDetailMemberId(nextId)}
            onEditFull={(mem) => {
              setDetailMemberId(null);
              setFormModalMember(mem);
            }}
            onOpenTreeFocus={(id) => {
              setDetailMemberId(null);
              onOpenTreeFocus(id);
            }}
            onNotify={onNotify}
          />
        )}
      </div>

      {/* Konsep Format Cetak & Generate PDF Daftar Anggota */}
      <PrintPreviewModal
        open={printRows !== null}
        onClose={() => setPrintRows(null)}
        title="Daftar Resmi Anggota Keluarga Besar"
        subtitle={`Menampilkan ${(printRows || []).length} anggota sesuai filter aktif${cabang ? ` · Cabang Anak ke-${cabang}` : ''}${generasi ? ` · Generasi ${generasi}` : ''}`}
        orientation="landscape"
        summary={[
          { label: 'Jumlah Anggota Tercetak', value: `${(printRows || []).length} jiwa` },
          { label: 'Status Hidup', value: String((printRows || []).filter((r) => r.status_hidup === 'HIDUP').length) },
          { label: 'Kepala Keluarga (KK)', value: String((printRows || []).filter((r) => r.is_kk).length) },
          { label: 'Keturunan Kandung', value: String((printRows || []).filter((r) => r.status_keturunan === 'Kandung').length) },
        ]}
        leftSignerTitle="Mengetahui, Ketua Paguyuban"
        rightSignerTitle="Sekretaris Paguyuban"
        onNotify={onNotify}
        onDownloadPdf={() => {
          const list = printRows || [];
          generateTablePdf({
            filename: 'daftar_anggota_bani_tohir.pdf',
            title: 'Daftar Resmi Anggota Keluarga Besar',
            subtitle: `Total ${list.length} anggota sesuai filter aktif`,
            orientation: 'landscape',
            summary: [
              { label: 'Total Anggota', value: `${list.length} jiwa` },
              { label: 'Status Hidup', value: String(list.filter((r) => r.status_hidup === 'HIDUP').length) },
              { label: 'Kepala Keluarga (KK)', value: String(list.filter((r) => r.is_kk).length) },
              { label: 'Keturunan Kandung', value: String(list.filter((r) => r.status_keturunan === 'Kandung').length) },
            ],
            headers: ['No', 'ID', 'Kode', 'Nama Lengkap', 'Generasi / Keturunan', 'Tempat, Tgl Lahir', 'Status'],
            rows: list.map((m, idx) => [
              idx + 1,
              m.id_anggota,
              m.kode_silsilah || '-',
              `${[m.gelar_depan, m.nama_lengkap, m.gelar_belakang].filter(Boolean).join(' ')}${m.is_kk ? ' (KK)' : ''}`,
              `${m.generasi_label} | ${m.status_keturunan}`,
              `${m.tempat_lahir || '-'}, ${m.tanggal_lahir || '-'}`,
              m.status_hidup,
            ]),
            columnAlignments: { 0: 'center' },
            leftSignerTitle: 'Mengetahui, Ketua Paguyuban',
            rightSignerTitle: 'Sekretaris Paguyuban',
          });
        }}
      >
        <table className="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr className="bg-green-800 text-white font-semibold">
              <th className="py-2 px-2 border border-green-900 text-center w-10">No</th>
              <th className="py-2 px-2 border border-green-900">ID</th>
              <th className="py-2 px-2 border border-green-900">Kode</th>
              <th className="py-2 px-2 border border-green-900">Nama Lengkap</th>
              <th className="py-2 px-2 border border-green-900">Generasi / Keturunan</th>
              <th className="py-2 px-2 border border-green-900">Tempat, Tgl Lahir</th>
              <th className="py-2 px-2 border border-green-900">Status</th>
            </tr>
          </thead>
          <tbody>
            {(printRows || []).map((m, idx) => (
              <tr key={m.id_anggota} className={idx % 2 === 1 ? 'bg-neutral-50' : 'bg-white'}>
                <td className="py-1.5 px-2 border border-neutral-200 font-mono tabular-nums text-center">{idx + 1}</td>
                <td className="py-1.5 px-2 border border-neutral-200 font-mono tabular-nums">{m.id_anggota}</td>
                <td className="py-1.5 px-2 border border-neutral-200 font-mono tabular-nums font-semibold text-green-900">
                  {m.kode_silsilah || '-'}
                </td>
                <td className="py-1.5 px-2 border border-neutral-200 font-medium">
                  {[m.gelar_depan, m.nama_lengkap, m.gelar_belakang].filter(Boolean).join(' ')}
                  {m.is_kk ? ' (KK)' : ''}
                </td>
                <td className="py-1.5 px-2 border border-neutral-200">
                  {m.generasi_label} · {m.status_keturunan}
                </td>
                <td className="py-1.5 px-2 border border-neutral-200 font-mono tabular-nums">
                  {m.tempat_lahir || '-'}, {m.tanggal_lahir || '-'}
                </td>
                <td className="py-1.5 px-2 border border-neutral-200">{m.status_hidup}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PrintPreviewModal>
    </>
  );
}
