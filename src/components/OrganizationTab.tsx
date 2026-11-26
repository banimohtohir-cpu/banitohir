import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Edit3, Megaphone, Plus, Printer, RefreshCw, Trash2, Upload, Users, X } from 'lucide-react';
import { MemberRecord, OrganizationBundleResponse, PengurusEnriched } from '../types';
import { compressImageFileToDataUrl } from '../utils/memberPhoto';
import { MemberAvatar } from './MemberAvatar';
import { SearchableOption, SearchableSelect } from './SearchableSelect';
import { PrintPreviewModal } from './PrintPreviewModal';
import { generateTablePdf } from '../utils/exportPdf';

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
  const [editingPengurusId, setEditingPengurusId] = useState<string | null>(null);
  const [boardJabId, setBoardJabId] = useState('JBT-02');
  const [boardMemberId, setBoardMemberId] = useState('');
  const [boardPeriode, setBoardPeriode] = useState('2026-2029');
  const [boardNoSk, setBoardNoSk] = useState('');
  const [boardFoto, setBoardFoto] = useState('');
  const [boardNoHp, setBoardNoHp] = useState('');
  const [boardEmail, setBoardEmail] = useState('');
  const [boardAlamat, setBoardAlamat] = useState('');
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [printBoardOpen, setPrintBoardOpen] = useState(false);

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

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id_anggota, m])), [members]);

  const memberOptions: SearchableOption[] = useMemo(
    () =>
      members.map((m) => ({
        value: m.id_anggota,
        label: `${m.kode_silsilah ? `[${m.kode_silsilah}] ` : ''}${[m.gelar_depan, m.nama_lengkap, m.gelar_belakang].filter(Boolean).join(' ')}`,
        sublabel: `${m.generasi_label} (${m.status_keturunan}) · ${m.id_anggota}`,
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

  function openCreateBoardModal() {
    setEditingPengurusId(null);
    setBoardJabId(bundle?.jabatan?.[0]?.jabatan_id || 'JBT-02');
    setBoardMemberId('');
    setBoardPeriode('2026-2029');
    setBoardNoSk('');
    setBoardFoto('');
    setBoardNoHp('');
    setBoardEmail('');
    setBoardAlamat('');
    setShowBoardModal(true);
  }

  function openEditBoardModal(p: PengurusEnriched) {
    const m = memberMap.get(p.id_anggota);
    setEditingPengurusId(p.pengurus_id);
    setBoardJabId(p.jabatan_id);
    setBoardMemberId(p.id_anggota);
    setBoardPeriode(p.periode_nama || '2026-2029');
    setBoardNoSk(p.no_sk || '');
    setBoardFoto(p.foto_drive_id || m?.foto_drive_id || '');
    setBoardNoHp(p.no_hp || (m?.no_hp && !m.no_hp.includes('Terbatas') ? m.no_hp : '') || '');
    setBoardEmail(p.email || m?.email || '');
    setBoardAlamat(m?.keterangan_alamat || p.alamat_lengkap || '');
    setShowBoardModal(true);
  }

  function handleSelectBoardMember(memberId: string) {
    setBoardMemberId(memberId);
    const m = memberMap.get(memberId);
    if (m) {
      setBoardFoto(m.foto_drive_id || '');
      setBoardNoHp(m.no_hp && !m.no_hp.includes('Terbatas') ? m.no_hp : '');
      setBoardEmail(m.email || '');
      setBoardAlamat(m.keterangan_alamat || '');
    } else {
      setBoardFoto('');
      setBoardNoHp('');
      setBoardEmail('');
      setBoardAlamat('');
    }
  }

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
        pengurus_id: editingPengurusId || undefined,
        jabatan_id: boardJabId,
        id_anggota: boardMemberId,
        periode_nama: boardPeriode,
        no_sk: boardNoSk,
        member_updates: {
          foto_drive_id: boardFoto,
          no_hp: boardNoHp,
          email: boardEmail,
          keterangan_alamat: boardAlamat,
        },
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      onNotify(json.message || 'Gagal menyimpan pengurus.', 'error');
      return;
    }
    onNotify(editingPengurusId ? 'Profil pengurus paguyuban berhasil diperbarui.' : 'Data pengurus paguyuban berhasil ditambahkan.');
    setShowBoardModal(false);
    setEditingPengurusId(null);
    setBoardMemberId('');
    await loadAll();
  }

  async function handleDeleteBoard(pengurusId: string) {
    const res = await fetch(`/api/organization/board/${pengurusId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      onNotify(json.message || 'Gagal menghapus pengurus.', 'error');
      return;
    }
    setConfirmRemoveId(null);
    onNotify('Data pengurus dihapus dari struktur periode ini.');
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
  const sortedPengurus = [...bundle.pengurus].sort((a, b) => (a.level_hierarki || 99) - (b.level_hierarki || 99));
  const selectedPreviewMember = boardMemberId ? memberMap.get(boardMemberId) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">Pengumuman, Pengurus &amp; Agenda Kegiatan</h2>
          <p className="text-xs text-neutral-600 mt-1">
            Pusat komunikasi, direktori lengkap pengurus paguyuban, dan jadwal silaturahmi Bani Haji Mohammad Tohir.
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

      {/* Struktur Pengurus Paguyuban - Direktori Lengkap */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4 print:border-0 print:p-0">
        <div className="hidden print:block border-b-2 border-green-900 pb-3 mb-4">
          <div className="text-base font-bold text-green-900 uppercase">
            Paguyuban Keluarga Besar Bani Haji Mohammad Tohir
          </div>
          <div className="text-xs text-neutral-700">
            Guyub, Akur, Semedulur · Struktur &amp; Direktori Pengurus Paguyuban
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-green-700 print:hidden" />
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Struktur &amp; Direktori Pengurus Paguyuban</h3>
              <p className="text-[11px] text-neutral-500 print:hidden">
                Menampilkan foto profil, jabatan, kedudukan generasi (Anak, Cucu, Buyut, Canggah, Wareng, dst.), alamat, telepon, dan email.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            {sortedPengurus.length > 0 && (
              <button
                type="button"
                onClick={() => setPrintBoardOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Struktur</span>
              </button>
            )}
            {bundle.canManageOrg && (
              <button
                type="button"
                onClick={openCreateBoardModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Pengurus</span>
              </button>
            )}
          </div>
        </div>

        {sortedPengurus.length === 0 ? (
          <div className="space-y-2.5 text-xs text-neutral-600">
            <p>Belum ada pengurus ditetapkan. Daftar jabatan yang tersedia:</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-neutral-700">
              {bundle.jabatan.map((j) => (
                <li key={j.jabatan_id} className="border border-neutral-200 rounded-lg p-3 bg-neutral-50/70">
                  <div className="font-bold text-neutral-900">{j.nama_jabatan}</div>
                  <div className="text-[11px] text-neutral-600 mt-0.5">{j.deskripsi_tugas}</div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
            {sortedPengurus.map((p) => {
              const lineageParts = [
                p.generasi_label || '',
                p.status_keturunan || '',
                p.kode_silsilah ? `Kode ${p.kode_silsilah}` : '',
              ].filter(Boolean);

              return (
                <div
                  key={p.pengurus_id}
                  className="border border-neutral-200 rounded-xl p-4 bg-white flex flex-col justify-between gap-3"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3.5">
                      <MemberAvatar
                        name={p.nama_anggota}
                        photoValue={p.foto_drive_id}
                        size="lg"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-green-800">
                          {p.nama_jabatan}
                        </div>
                        <div className="text-sm font-bold text-neutral-900 mt-0.5 leading-snug">
                          {p.nama_anggota}
                        </div>
                        <div className="text-xs text-neutral-600 mt-0.5 font-mono tabular-nums">
                          {lineageParts.length > 0 ? lineageParts.join(' · ') : p.id_anggota}
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-1 font-mono tabular-nums">
                          Periode {p.periode_nama}
                          {p.no_sk ? ` · SK: ${p.no_sk}` : ''}
                        </div>
                      </div>
                    </div>

                    <dl className="border-t border-neutral-100 pt-2.5 space-y-1.5 text-xs">
                      <div className="grid grid-cols-[72px_1fr] gap-2">
                        <dt className="text-neutral-500">Alamat</dt>
                        <dd className="text-neutral-800 leading-relaxed">
                          {p.alamat_lengkap || <span className="text-neutral-400">Belum diisi</span>}
                        </dd>
                      </div>
                      <div className="grid grid-cols-[72px_1fr] gap-2">
                        <dt className="text-neutral-500">No. Telp</dt>
                        <dd className="font-mono tabular-nums text-neutral-800">
                          {p.no_hp ? (
                            <a href={`tel:${p.no_hp.replace(/\s+/g, '')}`} className="text-green-800 hover:underline">
                              {p.no_hp}
                            </a>
                          ) : (
                            <span className="font-sans text-neutral-400">Belum diisi</span>
                          )}
                        </dd>
                      </div>
                      <div className="grid grid-cols-[72px_1fr] gap-2">
                        <dt className="text-neutral-500">Email</dt>
                        <dd className="text-neutral-800 break-all">
                          {p.email ? (
                            <a href={`mailto:${p.email}`} className="text-green-800 hover:underline">
                              {p.email}
                            </a>
                          ) : (
                            <span className="text-neutral-400">Belum diisi</span>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {bundle.canManageOrg && (
                    <div className="border-t border-neutral-100 pt-2.5 flex items-center justify-between gap-2 print:hidden">
                      <button
                        type="button"
                        onClick={() => openEditBoardModal(p)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-green-800 hover:underline cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Info &amp; Foto</span>
                      </button>

                      {confirmRemoveId === p.pengurus_id ? (
                        <div className="inline-flex items-center gap-1.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleDeleteBoard(p.pengurus_id)}
                            className="px-2 py-1 font-semibold text-white bg-red-600 hover:bg-red-700 rounded cursor-pointer"
                          >
                            Ya, Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId(null)}
                            className="px-2 py-1 font-semibold text-neutral-600 border border-neutral-300 rounded cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(p.pengurus_id)}
                          aria-label={`Hapus ${p.nama_anggota} dari pengurus`}
                          className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Papan Pengumuman & Agenda Kegiatan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
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
                className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Terbitkan</span>
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
                    <span className="font-mono tabular-nums">Rp {(k.anggaran_rencana || 0).toLocaleString('id-ID')}</span>
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
        <div className="fixed inset-0 z-50 bg-neutral-900/50 flex items-center justify-center p-4 print:hidden">
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

      {/* Modal Tambah / Edit Pengurus + Kontak & Foto */}
      {showBoardModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="text-sm font-bold text-neutral-900">
                {editingPengurusId ? 'Edit Profil & Jabatan Pengurus' : 'Tetapkan Pengurus Paguyuban'}
              </h3>
              <button type="button" onClick={() => setShowBoardModal(false)} className="text-neutral-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveBoard} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Jabatan</label>
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
                <label className="block font-semibold text-neutral-700 mb-1">Anggota Keluarga</label>
                <SearchableSelect
                  required
                  options={memberOptions}
                  value={boardMemberId}
                  onChange={handleSelectBoardMember}
                  placeholder="-- Pilih Anggota --"
                  searchPlaceholder="Ketik nama / kode silsilah..."
                />
                {selectedPreviewMember && (
                  <div className="mt-1.5 text-[11px] text-green-800 font-medium">
                    Keturunan: {selectedPreviewMember.generasi_label} ({selectedPreviewMember.status_keturunan}) · Kode{' '}
                    <span className="font-mono">{selectedPreviewMember.kode_silsilah || '-'}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Periode</label>
                  <input
                    type="text"
                    value={boardPeriode}
                    onChange={(e) => setBoardPeriode(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Nomor SK (opsional)</label>
                  <input
                    type="text"
                    value={boardNoSk}
                    onChange={(e) => setBoardNoSk(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Foto Profil Pengurus */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 space-y-2">
                <div className="font-semibold text-neutral-800">Foto Profil Pengurus</div>
                <div className="flex items-center gap-3">
                  <MemberAvatar
                    name={selectedPreviewMember?.nama_lengkap}
                    photoValue={boardFoto}
                    size="lg"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-green-800 bg-white border border-green-300 hover:bg-green-50 rounded-lg cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Foto</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file) return;
                            try {
                              const dataUrl = await compressImageFileToDataUrl(file, 320);
                              setBoardFoto(dataUrl);
                            } catch (err) {
                              onNotify(err instanceof Error ? err.message : 'Gagal memproses foto.', 'error');
                            }
                          }}
                        />
                      </label>
                      {boardFoto && (
                        <button
                          type="button"
                          onClick={() => setBoardFoto('')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 font-semibold text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus Foto</span>
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={boardFoto.startsWith('data:image/') ? '' : boardFoto}
                      onChange={(e) => setBoardFoto(e.target.value)}
                      placeholder="Atau tempel URL foto / link Google Drive..."
                      className="w-full px-3 py-1.5 border border-neutral-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Kontak & Alamat (tersinkron dengan Data Anggota) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">No. Telp / WhatsApp</label>
                  <input
                    type="text"
                    value={boardNoHp}
                    onChange={(e) => setBoardNoHp(e.target.value)}
                    placeholder="0812..."
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={boardEmail}
                    onChange={(e) => setBoardEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Alamat Domisili</label>
                <textarea
                  rows={2}
                  value={boardAlamat}
                  onChange={(e) => setBoardAlamat(e.target.value)}
                  placeholder="Alamat lengkap pengurus..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setShowBoardModal(false)}
                  className="px-3.5 py-2 font-semibold border border-neutral-300 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
                >
                  {editingPengurusId ? 'Simpan Perubahan' : 'Simpan Pengurus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Agenda Kegiatan */}
      {showActModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 flex items-center justify-center p-4 print:hidden">
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

      {/* Konsep Format Cetak & PDF Struktur Pengurus */}
      <PrintPreviewModal
        open={printBoardOpen}
        onClose={() => setPrintBoardOpen(false)}
        title="Struktur & Direktori Lengkap Pengurus Paguyuban"
        subtitle="Susunan Pengurus Aktif beserta Kedudukan Keturunan, Alamat, Telepon & Email"
        orientation="landscape"
        summary={[
          { label: 'Total Pengurus Aktif', value: `${sortedPengurus.length} orang` },
          { label: 'Periode Jabatan', value: sortedPengurus[0]?.periode_nama || '2026-2029' },
          { label: 'Kontak Telepon Terisi', value: String(sortedPengurus.filter((p) => Boolean(p.no_hp)).length) },
          { label: 'Email Terisi', value: String(sortedPengurus.filter((p) => Boolean(p.email)).length) },
        ]}
        leftSignerTitle="Mengetahui, Ketua Paguyuban"
        rightSignerTitle="Sekretaris Paguyuban"
        onNotify={onNotify}
        onDownloadPdf={() =>
          generateTablePdf({
            filename: 'struktur_pengurus_bani_tohir.pdf',
            title: 'Struktur & Direktori Lengkap Pengurus Paguyuban',
            subtitle: 'Susunan Pengurus Aktif beserta Kedudukan Keturunan, Alamat, Telepon & Email',
            orientation: 'landscape',
            summary: [
              { label: 'Total Pengurus', value: `${sortedPengurus.length} orang` },
              { label: 'Periode', value: sortedPengurus[0]?.periode_nama || '2026-2029' },
              { label: 'No. Telp Terisi', value: String(sortedPengurus.filter((p) => Boolean(p.no_hp)).length) },
              { label: 'Email Terisi', value: String(sortedPengurus.filter((p) => Boolean(p.email)).length) },
            ],
            headers: ['No', 'Jabatan', 'Nama Lengkap', 'Generasi / Keturunan', 'Kode', 'Alamat', 'No. Telp', 'Email', 'Periode / SK'],
            rows: sortedPengurus.map((p, idx) => [
              idx + 1,
              p.nama_jabatan || '-',
              p.nama_anggota || p.id_anggota || '-',
              `${p.generasi_label || '-'} (${p.status_keturunan || '-'})`,
              p.kode_silsilah || p.id_anggota || '-',
              p.alamat_lengkap || '-',
              p.no_hp || '-',
              p.email || '-',
              `${p.periode_nama || '-'}${p.no_sk ? ` / ${p.no_sk}` : ''}`,
            ]),
            columnAlignments: { 0: 'center' },
            leftSignerTitle: 'Mengetahui, Ketua Paguyuban',
            rightSignerTitle: 'Sekretaris Paguyuban',
          })
        }
      >
        <table className="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr className="bg-green-800 text-white font-semibold">
              <th className="py-2 px-2 border border-green-900 text-center w-9">No</th>
              <th className="py-2 px-2 border border-green-900">Jabatan</th>
              <th className="py-2 px-2 border border-green-900">Nama Lengkap</th>
              <th className="py-2 px-2 border border-green-900">Keturunan &amp; Kode</th>
              <th className="py-2 px-2 border border-green-900">Alamat</th>
              <th className="py-2 px-2 border border-green-900">No. Telp</th>
              <th className="py-2 px-2 border border-green-900">Email</th>
              <th className="py-2 px-2 border border-green-900">Periode / SK</th>
            </tr>
          </thead>
          <tbody>
            {sortedPengurus.map((p, idx) => (
              <tr key={p.pengurus_id} className={idx % 2 === 1 ? 'bg-neutral-50' : 'bg-white'}>
                <td className="py-1.5 px-2 border border-neutral-200 font-mono text-center">{idx + 1}</td>
                <td className="py-1.5 px-2 border border-neutral-200 font-semibold text-green-900">{p.nama_jabatan}</td>
                <td className="py-1.5 px-2 border border-neutral-200 font-semibold text-neutral-900">{p.nama_anggota}</td>
                <td className="py-1.5 px-2 border border-neutral-200">
                  <div>{p.generasi_label || '-'} ({p.status_keturunan || '-'})</div>
                  <div className="font-mono text-[10px] text-neutral-500">{p.kode_silsilah || p.id_anggota}</div>
                </td>
                <td className="py-1.5 px-2 border border-neutral-200">{p.alamat_lengkap || '-'}</td>
                <td className="py-1.5 px-2 border border-neutral-200 font-mono tabular-nums">{p.no_hp || '-'}</td>
                <td className="py-1.5 px-2 border border-neutral-200 break-all">{p.email || '-'}</td>
                <td className="py-1.5 px-2 border border-neutral-200 font-mono tabular-nums">
                  {p.periode_nama}{p.no_sk ? ` · ${p.no_sk}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PrintPreviewModal>
    </div>
  );
}
