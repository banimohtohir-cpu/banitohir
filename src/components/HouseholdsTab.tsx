import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Home, Plus, Printer, RefreshCw, Search, UserPlus } from 'lucide-react';
import { HouseholdRecord, KkHistoryRecord, MemberRecord, ModulePermission } from '../types';
import { SearchableOption, SearchableSelect } from './SearchableSelect';
import { PrintPreviewModal } from './PrintPreviewModal';
import { generateTablePdf } from '../utils/exportPdf';

interface HouseholdsTabProps {
  token: string;
  permission: ModulePermission;
  onNotify: (msg: string, kind?: 'success' | 'error') => void;
}

export function HouseholdsTab({ token, permission, onNotify }: HouseholdsTabProps) {
  const [households, setHouseholds] = useState<HouseholdRecord[]>([]);
  const [kkHistory, setKkHistory] = useState<KkHistoryRecord[]>([]);
  const [allMembers, setAllMembers] = useState<MemberRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    nama_rumah_tangga: '',
    id_kepala_keluarga: '',
    alamat_ringkas: '',
    no_kontak_rt: '',
    izinkan_kk_ganda: false,
    keterangan: '',
  });

  const [changeHeadRt, setChangeHeadRt] = useState<HouseholdRecord | null>(null);
  const [changeHeadForm, setChangeHeadForm] = useState({ id_kk_baru: '', alasan: '' });

  const [assignRt, setAssignRt] = useState<HouseholdRecord | null>(null);
  const [assignForm, setAssignForm] = useState({ id_anggota: '', peran_dalam_rt: 'ANGGOTA' });

  async function fetchData() {
    setLoading(true);
    try {
      const [hRes, mRes] = await Promise.all([
        fetch('/api/households', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/members?pageSize=2000', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const hData = await hRes.json();
      const mData = await mRes.json();
      if (hRes.ok && hData.ok) {
        setHouseholds(hData.households);
        setKkHistory(hData.kkHistory || []);
      } else {
        onNotify(hData.message || 'Gagal memuat data rumah tangga.', 'error');
      }
      if (mRes.ok && mData.ok) {
        setAllMembers(mData.rows);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const memberNameMap = useMemo(() => {
    const map = new Map<string, string>();
    allMembers.forEach((m) => map.set(m.id_anggota, m.nama_lengkap));
    households.forEach((h) => {
      if (h.kepala_keluarga) map.set(h.kepala_keluarga.id_anggota, h.kepala_keluarga.nama_lengkap);
      h.anggota_list?.forEach((a) => {
        if (a.anggota) map.set(a.anggota.id_anggota, a.anggota.nama_lengkap);
      });
    });
    return map;
  }, [allMembers, households]);

  const memberOptions: SearchableOption[] = useMemo(
    () =>
      allMembers.map((m) => ({
        value: m.id_anggota,
        label: `${m.kode_silsilah ? `[${m.kode_silsilah}] ` : ''}${m.nama_lengkap}`,
        sublabel: `${m.generasi_label} · ${m.status_keturunan} · ${m.id_anggota}`,
        keywords: `${m.nama_panggilan || ''} ${m.tempat_lahir || ''}`,
      })),
    [allMembers]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return households;
    return households.filter((h) =>
      `${h.nama_rumah_tangga} ${h.kepala_keluarga?.nama_lengkap || ''} ${h.alamat_ringkas}`.toLowerCase().includes(q)
    );
  }, [households, search]);

  async function handleCreateHousehold(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/households', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(createForm),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      onNotify(data.message || 'Gagal membuat rumah tangga.', 'error');
      return;
    }
    onNotify('Rumah tangga baru berhasil dibuat.');
    setCreateOpen(false);
    setCreateForm({
      nama_rumah_tangga: '',
      id_kepala_keluarga: '',
      alamat_ringkas: '',
      no_kontak_rt: '',
      izinkan_kk_ganda: false,
      keterangan: '',
    });
    fetchData();
  }

  async function handleChangeHead(e: React.FormEvent) {
    e.preventDefault();
    if (!changeHeadRt) return;
    const res = await fetch(`/api/households/${changeHeadRt.id_rumah_tangga}/change-head`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(changeHeadForm),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      onNotify(data.message || 'Gagal mengganti Kepala Keluarga.', 'error');
      return;
    }
    onNotify('Kepala Keluarga berhasil diperbarui dan dicatat pada Riwayat KK.');
    setChangeHeadRt(null);
    setChangeHeadForm({ id_kk_baru: '', alasan: '' });
    fetchData();
  }

  async function handleAssignMember(e: React.FormEvent) {
    e.preventDefault();
    if (!assignRt) return;
    const res = await fetch(`/api/households/${assignRt.id_rumah_tangga}/assign-member`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(assignForm),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      onNotify(data.message || 'Gagal memindahkan anggota ke rumah tangga.', 'error');
      return;
    }
    onNotify('Anggota berhasil ditempatkan di rumah tangga tanpa mengubah silsilah biologis.');
    setAssignRt(null);
    setAssignForm({ id_anggota: '', peran_dalam_rt: 'ANGGOTA' });
    fetchData();
  }

  const totalMembersAssigned = households.reduce((acc, h) => acc + (h.jumlah_anggota || 0), 0);

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="text-xs font-medium text-neutral-500">Rumah Tangga Aktif</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-green-800">
            {households.length}
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="text-xs font-medium text-neutral-500">Anggota Terpetakan dalam KK</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-neutral-900">
            {totalMembersAssigned}
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="text-xs font-medium text-neutral-500">Riwayat Pergantian KK</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-amber-600">
            {kkHistory.length}
          </div>
        </div>
      </div>

      {/* Directory */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Daftar Rumah Tangga &amp; Kepala Keluarga</h2>
            <p className="text-xs text-neutral-600 mt-0.5">
              Satu anggota aktif terdata di satu rumah tangga (kecuali izin KK ganda). Pemindahan KK tidak mengubah silsilah biologis.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari rumah tangga / KK..."
                className="pl-8 pr-3 py-1.5 text-xs border border-neutral-300 rounded-lg w-52"
              />
            </div>
            <button
              type="button"
              disabled={filtered.length === 0}
              onClick={() => setPrintOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / PDF</span>
            </button>
            {permission.can_create && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Rumah Tangga</span>
              </button>
            )}
          </div>
        </div>

        {loading && households.length === 0 ? (
          <div className="py-10 text-center text-xs text-neutral-500">Memuat data rumah tangga...</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-xs text-neutral-500 border border-dashed border-neutral-300 rounded-lg">
            Belum ada data rumah tangga yang sesuai.
          </div>
        ) : (
          <div className="overflow-x-auto border border-neutral-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                  <th className="py-2.5 px-3">Rumah Tangga</th>
                  <th className="py-2.5 px-3">Kepala Keluarga</th>
                  <th className="py-2.5 px-3">Anggota</th>
                  <th className="py-2.5 px-3">Alamat &amp; Kontak</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filtered.map((h) => {
                  const isOpen = expandedId === h.id_rumah_tangga;
                  return (
                    <React.Fragment key={h.id_rumah_tangga}>
                      <tr className="hover:bg-neutral-50">
                        <td className="py-2.5 px-3 font-semibold text-neutral-900">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isOpen ? null : h.id_rumah_tangga)}
                            className="inline-flex items-center gap-1.5 text-left cursor-pointer hover:text-green-800"
                          >
                            {isOpen ? (
                              <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
                            )}
                            <span>{h.nama_rumah_tangga}</span>
                          </button>
                          <div className="font-mono text-[11px] text-neutral-400 pl-5">{h.id_rumah_tangga}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-neutral-900">
                            {h.kepala_keluarga?.nama_lengkap || h.id_kepala_keluarga}
                          </div>
                          <div className="font-mono text-[11px] text-green-800">
                            {h.kepala_keluarga?.kode_silsilah || h.id_kepala_keluarga}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-neutral-700">
                          {h.jumlah_anggota || 0} orang
                        </td>
                        <td className="py-2.5 px-3 text-neutral-600 max-w-xs truncate">
                          {[h.alamat_ringkas, h.no_kontak_rt].filter(Boolean).join(' · ') || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {permission.can_edit && (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setAssignRt(h);
                                  setAssignForm({ id_anggota: '', peran_dalam_rt: 'ANGGOTA' });
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 border border-neutral-300 rounded-md bg-white hover:bg-neutral-50 font-semibold cursor-pointer"
                              >
                                <UserPlus className="w-3 h-3" />
                                <span>Anggota</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setChangeHeadRt(h);
                                  setChangeHeadForm({ id_kk_baru: '', alasan: '' });
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 border border-green-200 text-green-800 bg-green-50 hover:bg-green-100 rounded-md font-semibold cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Ganti KK</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-neutral-50">
                          <td colSpan={5} className="px-6 py-3">
                            <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-2">
                              Daftar Penghuni Rumah Tangga ({h.anggota_list?.length || 0})
                            </div>
                            {!h.anggota_list || h.anggota_list.length === 0 ? (
                              <div className="text-neutral-500">Belum ada anggota terdaftar.</div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {h.anggota_list.map((hm) => (
                                  <div
                                    key={hm.id_anggota_rumah}
                                    className="bg-white border border-neutral-200 rounded-lg px-3 py-2 flex items-center justify-between"
                                  >
                                    <div>
                                      <div className="font-semibold text-neutral-900">
                                        {hm.anggota?.nama_lengkap || hm.id_anggota}
                                      </div>
                                      <div className="font-mono text-[11px] text-neutral-500">
                                        {hm.anggota?.kode_silsilah || hm.id_anggota} · {hm.peran_dalam_rt}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Riwayat Pergantian KK */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-green-700" />
          <h3 className="text-sm font-bold text-neutral-900">Riwayat Pergantian Kepala Keluarga</h3>
        </div>
        {kkHistory.length === 0 ? (
          <div className="text-xs text-neutral-500">Belum ada catatan pergantian Kepala Keluarga.</div>
        ) : (
          <div className="overflow-x-auto border border-neutral-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                  <th className="py-2 px-3">Waktu</th>
                  <th className="py-2 px-3">ID Rumah Tangga</th>
                  <th className="py-2 px-3">KK Lama → KK Baru</th>
                  <th className="py-2 px-3">Alasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {kkHistory.map((k) => (
                  <tr key={k.id_riwayat_kk}>
                    <td className="py-2 px-3 font-mono tabular-nums text-neutral-600">
                      {k.tanggal_pergantian.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="py-2 px-3 font-mono text-neutral-800">{k.id_rumah_tangga}</td>
                    <td className="py-2 px-3">
                      <span className="text-neutral-600">{memberNameMap.get(k.id_kk_lama) || k.id_kk_lama}</span>
                      {' → '}
                      <span className="font-semibold text-green-800">
                        {memberNameMap.get(k.id_kk_baru) || k.id_kk_baru}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-neutral-700">{k.alasan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah Rumah Tangga */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/55 p-4">
          <form
            onSubmit={handleCreateHousehold}
            className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-6 space-y-4 text-xs"
          >
            <h3 className="text-sm font-bold text-neutral-900">Buat Rumah Tangga Baru</h3>
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Nama Rumah Tangga</label>
              <input
                type="text"
                required
                value={createForm.nama_rumah_tangga}
                onChange={(e) => setCreateForm({ ...createForm, nama_rumah_tangga: e.target.value })}
                placeholder="Contoh: Keluarga Bpk. Ahmad Fauzi"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Kepala Keluarga (KK)</label>
              <SearchableSelect
                required
                options={memberOptions}
                value={createForm.id_kepala_keluarga}
                onChange={(val) => setCreateForm({ ...createForm, id_kepala_keluarga: val })}
                placeholder="Pilih anggota..."
                searchPlaceholder="Ketik nama / kode silsilah..."
              />
            </div>
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Alamat Ringkas</label>
              <input
                type="text"
                value={createForm.alamat_ringkas}
                onChange={(e) => setCreateForm({ ...createForm, alamat_ringkas: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Kontak Rumah Tangga</label>
              <input
                type="text"
                value={createForm.no_kontak_rt}
                onChange={(e) => setCreateForm({ ...createForm, no_kontak_rt: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg font-mono"
              />
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer text-neutral-700">
              <input
                type="checkbox"
                checked={createForm.izinkan_kk_ganda}
                onChange={(e) => setCreateForm({ ...createForm, izinkan_kk_ganda: e.target.checked })}
                className="rounded border-neutral-300 text-green-700"
              />
              <span>Izinkan KK ganda (khusus persetujuan Admin)</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-3.5 py-2 border border-neutral-300 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
              >
                Simpan Rumah Tangga
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Ganti KK */}
      {changeHeadRt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/55 p-4">
          <form
            onSubmit={handleChangeHead}
            className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-6 space-y-4 text-xs"
          >
            <h3 className="text-sm font-bold text-neutral-900">
              Ganti Kepala Keluarga · {changeHeadRt.nama_rumah_tangga}
            </h3>
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Kepala Keluarga Baru</label>
              <SearchableSelect
                required
                options={memberOptions}
                value={changeHeadForm.id_kk_baru}
                onChange={(val) => setChangeHeadForm({ ...changeHeadForm, id_kk_baru: val })}
                placeholder="Pilih anggota..."
                searchPlaceholder="Ketik nama / kode silsilah..."
              />
            </div>
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Alasan Pergantian</label>
              <input
                type="text"
                required
                value={changeHeadForm.alasan}
                onChange={(e) => setChangeHeadForm({ ...changeHeadForm, alasan: e.target.value })}
                placeholder="Misal: Wafat / Pindah domisili / Penyesuaian KK"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setChangeHeadRt(null)}
                className="px-3.5 py-2 border border-neutral-300 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
              >
                Tetapkan KK Baru
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Tambah / Pindah Anggota */}
      {assignRt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/55 p-4">
          <form
            onSubmit={handleAssignMember}
            className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-6 space-y-4 text-xs"
          >
            <h3 className="text-sm font-bold text-neutral-900">
              Tempatkan Anggota ke {assignRt.nama_rumah_tangga}
            </h3>
            <p className="text-neutral-600">
              Jika anggota masih aktif di rumah tangga lain, status lama otomatis dinonaktifkan tanpa memutus hubungan biologis silsilah.
            </p>
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Pilih Anggota</label>
              <SearchableSelect
                required
                options={memberOptions}
                value={assignForm.id_anggota}
                onChange={(val) => setAssignForm({ ...assignForm, id_anggota: val })}
                placeholder="Pilih anggota..."
                searchPlaceholder="Ketik nama / kode silsilah..."
              />
            </div>
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Peran dalam Rumah Tangga</label>
              <SearchableSelect
                options={[
                  { value: 'PASANGAN', label: 'PASANGAN' },
                  { value: 'ANAK', label: 'ANAK' },
                  { value: 'ANGGOTA', label: 'ANGGOTA' },
                  { value: 'KEPALA', label: 'KEPALA' },
                ]}
                value={assignForm.peran_dalam_rt}
                onChange={(val) => setAssignForm({ ...assignForm, peran_dalam_rt: val || 'ANGGOTA' })}
                searchPlaceholder="Cari peran..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssignRt(null)}
                className="px-3.5 py-2 border border-neutral-300 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
              >
                Simpan Penempatan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Konsep Format Cetak & PDF Daftar Rumah Tangga */}
      <PrintPreviewModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title="Daftar Rumah Tangga & Kepala Keluarga"
        subtitle={`Menampilkan ${filtered.length} rumah tangga aktif Bani Haji Mohammad Tohir`}
        orientation="landscape"
        summary={[
          { label: 'Rumah Tangga Tercetak', value: `${filtered.length} KK` },
          { label: 'Total Anggota Terpetakan', value: `${filtered.reduce((s, h) => s + (h.jumlah_anggota || 0), 0)} jiwa` },
          { label: 'Riwayat Pergantian KK', value: `${kkHistory.length} catatan` },
          { label: 'Filter Pencarian', value: search.trim() || 'Semua' },
        ]}
        leftSignerTitle="Mengetahui, Ketua Paguyuban"
        rightSignerTitle="Sekretariat Paguyuban"
        onNotify={onNotify}
        onDownloadPdf={() =>
          generateTablePdf({
            filename: 'daftar_rumah_tangga_bani_tohir.pdf',
            title: 'Daftar Rumah Tangga & Kepala Keluarga',
            subtitle: `Total ${filtered.length} rumah tangga aktif`,
            orientation: 'landscape',
            summary: [
              { label: 'Rumah Tangga', value: `${filtered.length} KK` },
              { label: 'Total Penghuni', value: `${filtered.reduce((s, h) => s + (h.jumlah_anggota || 0), 0)} jiwa` },
              { label: 'Riwayat Ganti KK', value: `${kkHistory.length}` },
              { label: 'Filter', value: search.trim() || 'Semua' },
            ],
            headers: ['No', 'ID RT', 'Nama Rumah Tangga', 'Kepala Keluarga', 'Kode', 'Jml Anggota', 'Alamat & Kontak'],
            rows: filtered.map((h, idx) => [
              idx + 1,
              h.id_rumah_tangga,
              h.nama_rumah_tangga,
              h.kepala_keluarga?.nama_lengkap || h.id_kepala_keluarga,
              h.kepala_keluarga?.kode_silsilah || '-',
              `${h.jumlah_anggota || 0} orang`,
              [h.alamat_ringkas, h.no_kontak_rt].filter(Boolean).join(' | ') || '-',
            ]),
            columnAlignments: { 0: 'center', 5: 'center' },
            leftSignerTitle: 'Mengetahui, Ketua Paguyuban',
            rightSignerTitle: 'Sekretariat Paguyuban',
          })
        }
      >
        <table className="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr className="bg-green-800 text-white font-semibold">
              <th className="py-2 px-2 border border-green-900 text-center w-9">No</th>
              <th className="py-2 px-2 border border-green-900">ID RT</th>
              <th className="py-2 px-2 border border-green-900">Nama Rumah Tangga</th>
              <th className="py-2 px-2 border border-green-900">Kepala Keluarga</th>
              <th className="py-2 px-2 border border-green-900">Kode</th>
              <th className="py-2 px-2 border border-green-900 text-center">Penghuni</th>
              <th className="py-2 px-2 border border-green-900">Alamat &amp; Kontak</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((h, idx) => (
              <tr key={h.id_rumah_tangga} className={idx % 2 === 1 ? 'bg-neutral-50' : 'bg-white'}>
                <td className="py-1.5 px-2 border border-neutral-200 font-mono text-center">{idx + 1}</td>
                <td className="py-1.5 px-2 border border-neutral-200 font-mono">{h.id_rumah_tangga}</td>
                <td className="py-1.5 px-2 border border-neutral-200 font-semibold text-neutral-900">{h.nama_rumah_tangga}</td>
                <td className="py-1.5 px-2 border border-neutral-200">{h.kepala_keluarga?.nama_lengkap || h.id_kepala_keluarga}</td>
                <td className="py-1.5 px-2 border border-neutral-200 font-mono text-green-900">{h.kepala_keluarga?.kode_silsilah || '-'}</td>
                <td className="py-1.5 px-2 border border-neutral-200 font-mono text-center">{h.jumlah_anggota || 0}</td>
                <td className="py-1.5 px-2 border border-neutral-200">{[h.alamat_ringkas, h.no_kontak_rt].filter(Boolean).join(' · ') || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PrintPreviewModal>
    </div>
  );
}
