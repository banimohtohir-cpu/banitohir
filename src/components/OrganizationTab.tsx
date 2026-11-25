import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Megaphone, Plus, RefreshCw, Users, X } from 'lucide-react';
import { MemberRecord, OrganizationBundleResponse } from '../types';
import { SearchableOption, SearchableSelect } from './SearchableSelect';

interface OrganizationTabProps {
  token: string;
  onNotify: (msg: string, kind?: 'success' | 'error') => void;
}

export function OrganizationTab({ token, onNotify }: OrganizationTabProps) {
  const [bundle, setBundle] = useState<OrganizationBundleResponse | null>(null);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const [showAnnModal, setShowAnnModal] = useState(false);
  const [annJudul, setAnnJudul] = useState('');
  const [annKategori, setAnnKategori] = useState<'UMUM' | 'ACARA' | 'KEUANGAN' | 'DUKA' | 'PENTING'>('UMUM');
  const [annAudiens, setAnnAudiens] = useState<'SEMUA' | 'PENGURUS' | 'KEPALA_KELUARGA'>('SEMUA');
  const [annIsi, setAnnIsi] = useState('');
  const [annPinned, setAnnPinned] = useState(false);

  const [showBoardModal, setShowBoardModal] = useState(false);
  const [boardJabId, setBoardJabId] = useState('JBT-02');
  const [boardMemberId, setBoardMemberId] = useState('');
  const [boardPeriode, setBoardPeriode] = useState('2026-2029');
  const [boardNoSk, setBoardNoSk] = useState('');

  const [showActModal, setShowActModal] = useState(false);
  const [actNama, setActNama] = useState('');
  const [actKategori, setActKategori] = useState('SILATURAHMI');
  const [actTgl, setActTgl] = useState(() => new Date().toISOString().slice(0, 10));
  const [actLokasi, setActLokasi] = useState('');
  const [actPj, setActPj] = useState('');
  const [actAnggaran, setActAnggaran] = useState('0');
  const [actDesc, setActDesc] = useState('');

  async function loadAll() {
    setLoading(true);
    try {
      const [orgRes, memRes] = await Promise.all([
        fetch('/api/organization/bundle', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/members?pageSize=2000', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const orgJson = await orgRes.json();
      if (orgRes.ok && orgJson.ok) setBundle(orgJson);
      const memJson = await memRes.json();
      if (memRes.ok && memJson.ok) setMembers(memJson.rows || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const memberOptions: SearchableOption[] = useMemo(
    () =>
      members.map((m) => ({
        value: m.id_anggota,
        label: `${m.kode_silsilah ? `[${m.kode_silsilah}] ` : ''}${m.nama_lengkap}`,
        sublabel: `${m.generasi_label} · ${m.id_anggota}`,
        keywords: `${m.nama_panggilan || ''} ${m.tempat_lahir || ''}`,
      })),
    [members]
  );

  const jabatanOptions: SearchableOption[] = useMemo(
    () =>
      (bundle?.jabatan || []).map((j) => ({
        value: j.jabatan_id,
        label: j.nama_jabatan,
        sublabel: j.deskripsi_tugas,
      })),
    [bundle?.jabatan]
  );

  async function handleSaveAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/organization/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        judul: annJudul,
        kategori: annKategori,
        target_audiens: annAudiens,
        isi: annIsi,
        is_pinned: annPinned,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      onNotify(json.message || 'Gagal menerbitkan pengumuman.', 'error');
      return;
    }
    onNotify('Pengumuman keluarga besar berhasil diterbitkan.');
    setShowAnnModal(false);
    setAnnJudul('');
    setAnnIsi('');
    setAnnPinned(false);
    await loadAll();
  }

  async function handleSaveBoard(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/organization/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        jabatan_id: boardJabId,
        id_anggota: boardMemberId,
        periode_nama: boardPeriode,
        no_sk: boardNoSk,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      onNotify(json.message || 'Gagal menyimpan pengurus.', 'error');
      return;
    }
    onNotify('Data pengurus paguyuban berhasil ditambahkan.');
    setShowBoardModal(false);
    setBoardMemberId('');
    await loadAll();
  }

  async function handleSaveActivity(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/organization/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        nama_kegiatan: actNama,
        kategori_kegiatan: actKategori,
        tanggal_mulai: actTgl,
        lokasi: actLokasi,
        id_penanggung_jawab: actPj,
        anggaran_rencana: Number(actAnggaran) || 0,
        deskripsi: actDesc,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      onNotify(json.message || 'Gagal menyimpan agenda kegiatan.', 'error');
      return;
    }
    onNotify('Agenda kegiatan keluarga besar tersimpan.');
    setShowActModal(false);
    setActNama('');
    setActLokasi('');
    setActDesc('');
    await loadAll();
  }

  if (loading && !bundle) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-6 text-sm text-neutral-600">
        Memuat informasi paguyuban &amp; kegiatan...
      </div>
    );
  }

  if (!bundle) return null;

  const sortedAnnouncements = [...bundle.pengumuman].sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">Pengumuman, Pengurus &amp; Agenda Kegiatan</h2>
          <p className="text-xs text-neutral-600 mt-1">
            Pusat komunikasi, struktur kepengurusan paguyuban, dan jadwal silaturahmi Bani Haji Mohammad Tohir.
          </p>
        </div>
        <button
          type="button"
          onClick={loadAll}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Muat Ulang</span>
        </button>
      </div>

      {/* Papan Pengumuman */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-green-700" />
            <h3 className="text-sm font-bold text-neutral-900">Papan Pengumuman Keluarga Besar</h3>
          </div>
          {bundle.canManageOrg && (
            <button
              type="button"
              onClick={() => setShowAnnModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Terbitkan Pengumuman</span>
            </button>
          )}
        </div>

        <div className="divide-y divide-neutral-100">
          {sortedAnnouncements.length === 0 ? (
            <p className="py-4 text-xs text-neutral-500">Belum ada pengumuman aktif.</p>
          ) : (
            sortedAnnouncements.map((a) => (
              <div key={a.pengumuman_id} className="py-3.5 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-sm text-neutral-900">{a.judul}</div>
                  <div className="text-[11px] font-semibold text-neutral-500">
                    {a.is_pinned ? 'Disematkan · ' : ''}
                    {a.kategori} · {a.tanggal_publikasi}
                  </div>
                </div>
                <p className="text-xs text-neutral-700 leading-relaxed whitespace-pre-line">{a.isi}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Struktur Pengurus */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-green-700" />
              <h3 className="text-sm font-bold text-neutral-900">Struktur Pengurus Paguyuban</h3>
            </div>
            {bundle.canManageOrg && (
              <button
                type="button"
                onClick={() => setShowBoardModal(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Pengurus</span>
              </button>
            )}
          </div>

          {bundle.pengurus.length === 0 ? (
            <div className="space-y-2 text-xs text-neutral-600">
              <p>Belum ada pengurus ditetapkan. Daftar jabatan tersedia:</p>
              <ul className="list-disc pl-5 space-y-1 text-neutral-700">
                {bundle.jabatan.map((j) => (
                  <li key={j.jabatan_id}>
                    <strong>{j.nama_jabatan}</strong> — {j.deskripsi_tugas}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 text-xs">
              {[...bundle.pengurus]
                .sort((a, b) => (a.level_hierarki || 99) - (b.level_hierarki || 99))
                .map((p) => (
                  <div key={p.pengurus_id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-neutral-900">{p.nama_anggota}</div>
                      <div className="text-neutral-600">{p.nama_jabatan}</div>
                    </div>
                    <div className="text-right text-[11px] font-mono text-neutral-500">
                      <div>Periode {p.periode_nama}</div>
                      {p.no_sk && <div>SK: {p.no_sk}</div>}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Agenda Kegiatan */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-neutral-900">Agenda &amp; Kegiatan Paguyuban</h3>
            </div>
            {bundle.canManageOrg && (
              <button
                type="button"
                onClick={() => setShowActModal(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Agenda</span>
              </button>
            )}
          </div>

          {bundle.kegiatan.length === 0 ? (
            <p className="text-xs text-neutral-500">Belum ada agenda kegiatan keluarga terjadwal.</p>
          ) : (
            <div className="divide-y divide-neutral-100 text-xs">
              {bundle.kegiatan.map((k) => (
                <div key={k.kegiatan_id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-neutral-900">{k.nama_kegiatan}</span>
                    <span className="font-mono text-[11px] text-green-700 font-semibold">
                      {k.tanggal_mulai} · {k.status_kegiatan}
                    </span>
                  </div>
                  <div className="text-neutral-600">
                    Lokasi: {k.lokasi || '-'} · PJ: {k.nama_pj || '-'} · Anggaran:{' '}
                    <span className="font-mono">Rp {(k.anggaran_rencana || 0).toLocaleString('id-ID')}</span>
                  </div>
                  {k.deskripsi && <p className="text-neutral-700">{k.deskripsi}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Pengumuman */}
      {showAnnModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">Terbitkan Pengumuman Baru</h3>
              <button type="button" onClick={() => setShowAnnModal(false)} className="text-neutral-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveAnnouncement} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Judul Pengumuman</label>
                <input
                  type="text"
                  required
                  value={annJudul}
                  onChange={(e) => setAnnJudul(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Kategori</label>
                  <SearchableSelect
                    options={[
                      { value: 'UMUM', label: 'Umum' },
                      { value: 'ACARA', label: 'Acara / Halal Bihalal' },
                      { value: 'KEUANGAN', label: 'Keuangan / Iuran' },
                      { value: 'DUKA', label: 'Berita Duka' },
                      { value: 'PENTING', label: 'Penting' },
                    ]}
                    value={annKategori}
                    onChange={(val) => setAnnKategori((val || 'UMUM') as typeof annKategori)}
                    searchPlaceholder="Cari kategori..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Audiens</label>
                  <SearchableSelect
                    options={[
                      { value: 'SEMUA', label: 'Semua Anggota' },
                      { value: 'KEPALA_KELUARGA', label: 'Kepala Keluarga' },
                      { value: 'PENGURUS', label: 'Khusus Pengurus' },
                    ]}
                    value={annAudiens}
                    onChange={(val) => setAnnAudiens((val || 'SEMUA') as typeof annAudiens)}
                    searchPlaceholder="Cari audiens..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Isi Pengumuman</label>
                <textarea
                  rows={4}
                  required
                  value={annIsi}
                  onChange={(e) => setAnnIsi(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-neutral-700">
                <input type="checkbox" checked={annPinned} onChange={(e) => setAnnPinned(e.target.checked)} />
                <span>Sematkan di bagian atas papan pengumuman</span>
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAnnModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold border border-neutral-300 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
                >
                  Terbitkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Pengurus */}
      {showBoardModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">Tetapkan Pengurus Paguyuban</h3>
              <button type="button" onClick={() => setShowBoardModal(false)} className="text-neutral-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveBoard} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Jabatan</label>
                <SearchableSelect
                  required
                  options={jabatanOptions}
                  value={boardJabId}
                  onChange={setBoardJabId}
                  placeholder="Pilih jabatan..."
                  searchPlaceholder="Ketik nama jabatan..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Anggota Keluarga</label>
                <SearchableSelect
                  required
                  options={memberOptions}
                  value={boardMemberId}
                  onChange={setBoardMemberId}
                  placeholder="-- Pilih Anggota --"
                  searchPlaceholder="Ketik nama / kode silsilah..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Periode</label>
                  <input
                    type="text"
                    value={boardPeriode}
                    onChange={(e) => setBoardPeriode(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Nomor SK (opsional)</label>
                  <input
                    type="text"
                    value={boardNoSk}
                    onChange={(e) => setBoardNoSk(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBoardModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold border border-neutral-300 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
                >
                  Simpan Pengurus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Agenda Kegiatan */}
      {showActModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">Tambah Agenda Kegiatan</h3>
              <button type="button" onClick={() => setShowActModal(false)} className="text-neutral-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveActivity} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Nama Kegiatan</label>
                <input
                  type="text"
                  required
                  value={actNama}
                  onChange={(e) => setActNama(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Kategori</label>
                  <SearchableSelect
                    options={[
                      { value: 'SILATURAHMI', label: 'Silaturahmi / Halal Bihalal' },
                      { value: 'RAPAT', label: 'Rapat Pengurus' },
                      { value: 'SOSIAL', label: 'Kegiatan Sosial' },
                      { value: 'ZIARAH', label: 'Ziarah Leluhur' },
                    ]}
                    value={actKategori}
                    onChange={(val) => setActKategori(val || 'SILATURAHMI')}
                    searchPlaceholder="Cari kategori..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={actTgl}
                    onChange={(e) => setActTgl(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Lokasi</label>
                  <input
                    type="text"
                    value={actLokasi}
                    onChange={(e) => setActLokasi(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Rencana Anggaran (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={actAnggaran}
                    onChange={(e) => setActAnggaran(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Penanggung Jawab</label>
                <SearchableSelect
                  allowClear
                  options={memberOptions}
                  value={actPj}
                  onChange={setActPj}
                  placeholder="-- Opsional --"
                  searchPlaceholder="Ketik nama penanggung jawab..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Deskripsi</label>
                <textarea
                  rows={2}
                  value={actDesc}
                  onChange={(e) => setActDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowActModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold border border-neutral-300 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
                >
                  Simpan Agenda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
