import React, { useEffect, useRef, useState } from 'react';
import { Archive, Download, FileText, Mail, Plus, Printer, RefreshCw, X } from 'lucide-react';
import { OrganizationBundleResponse, SuratRecord } from '../types';
import { SearchableSelect } from './SearchableSelect';
import { printElementViaIframe } from './PrintPreviewModal';
import { generateLetterPdf } from '../utils/exportPdf';

interface DocumentsTabProps {
  token: string;
  onNotify: (msg: string, kind?: 'success' | 'error') => void;
}

export function DocumentsTab({ token, onNotify }: DocumentsTabProps) {
  const [bundle, setBundle] = useState<OrganizationBundleResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const [showLetterModal, setShowLetterModal] = useState(false);
  const [letterPerihal, setLetterPerihal] = useState('');
  const [letterJenis, setLetterJenis] = useState<SuratRecord['jenis_surat']>('UNDANGAN_ACARA');
  const [letterTanggal, setLetterTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [letterPenerima, setLetterPenerima] = useState<SuratRecord['penerima_tipe']>('SEMUA_KELUARGA');
  const [letterIsi, setLetterIsi] = useState('');
  const [previewLetter, setPreviewLetter] = useState<SuratRecord | null>(null);
  const letterSheetRef = useRef<HTMLDivElement>(null);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [invKegiatanId, setInvKegiatanId] = useState('');
  const [invSuratId, setInvSuratId] = useState('');
  const [invTargetTipe, setInvTargetTipe] = useState<'SEMUA_KELUARGA' | 'PENGURUS' | 'RUMAH_TANGGA'>('SEMUA_KELUARGA');

  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [arsJudul, setArsJudul] = useState('');
  const [arsKategori, setArsKategori] = useState<'NOTULEN' | 'SK_PENGURUS' | 'LPJ_KEUANGAN' | 'DOKUMENTASI' | 'AD_ART' | 'LAINNYA'>('NOTULEN');
  const [arsUrl, setArsUrl] = useState('');
  const [arsVisibilitas, setArsVisibilitas] = useState<'PUBLIK_KELUARGA' | 'KHUSUS_PENGURUS'>('PUBLIK_KELUARGA');
  const [arsDeskripsi, setArsDeskripsi] = useState('');

  async function loadBundle() {
    setLoading(true);
    try {
      const res = await fetch('/api/organization/bundle', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.ok) setBundle(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBundle();
  }, []);

  async function handleSaveLetter(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/letters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        perihal: letterPerihal,
        jenis_surat: letterJenis,
        tanggal_surat: letterTanggal,
        penerima_tipe: letterPenerima,
        isi_surat: letterIsi,
        status_surat: 'TERBIT',
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      onNotify(json.message || 'Gagal menerbitkan surat.', 'error');
      return;
    }
    onNotify(`Surat resmi ${json.surat.nomor_surat} berhasil diterbitkan.`);
    setShowLetterModal(false);
    setLetterPerihal('');
    setLetterIsi('');
    await loadBundle();
  }

  async function handleSaveInvitation(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        kegiatan_id: invKegiatanId,
        surat_id: invSuratId,
        target_tipe: invTargetTipe,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      onNotify(json.message || 'Gagal mencatat undangan.', 'error');
      return;
    }
    onNotify('Undangan kegiatan tercatat.');
    setShowInviteModal(false);
    await loadBundle();
  }

  async function handleRsvp(undanganId: string, statusHadir: 'HADIR' | 'TIDAK_HADIR' | 'RAGU') {
    const res = await fetch(`/api/invitations/${undanganId}/rsvp`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status_hadir: statusHadir }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      onNotify(json.message || 'Gagal menyimpan RSVP.', 'error');
      return;
    }
    onNotify(`Konfirmasi kehadiran diperbarui: ${statusHadir.replace('_', ' ')}.`);
    await loadBundle();
  }

  async function handleSaveArchive(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/archives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        judul: arsJudul,
        kategori_arsip: arsKategori,
        drive_url: arsUrl,
        visibilitas: arsVisibilitas,
        deskripsi: arsDeskripsi,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      onNotify(json.message || 'Gagal menyimpan arsip dokumen.', 'error');
      return;
    }
    onNotify('Dokumen arsip digital tersimpan.');
    setShowArchiveModal(false);
    setArsJudul('');
    setArsUrl('');
    setArsDeskripsi('');
    await loadBundle();
  }

  if (loading && !bundle) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-6 text-sm text-neutral-600">
        Memuat modul surat menyurat &amp; arsip...
      </div>
    );
  }

  if (!bundle) return null;

  const kegiatanMap = new Map(bundle.kegiatan.map((k) => [k.kegiatan_id, k.nama_kegiatan]));
  const suratMap = new Map(bundle.surat.map((s) => [s.surat_id, s.perihal]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">Surat Resmi, Undangan &amp; Arsip Digital</h2>
          <p className="text-xs text-neutral-600 mt-1">
            Penomoran surat otomatis ber-kop resmi paguyuban, pelacakan undangan &amp; RSVP, serta repositori dokumen keluarga.
          </p>
        </div>
        <button
          type="button"
          onClick={loadBundle}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Muat Ulang</span>
        </button>
      </div>

      {/* Surat Resmi */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4 print:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-green-700" />
            <h3 className="text-sm font-bold text-neutral-900">Daftar Surat Resmi Paguyuban</h3>
          </div>
          {bundle.canManageSurat && (
            <button
              type="button"
              onClick={() => setShowLetterModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buat Surat Baru</span>
            </button>
          )}
        </div>

        {bundle.surat.length === 0 ? (
          <p className="text-xs text-neutral-500">Belum ada surat resmi diterbitkan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500">
                  <th className="py-2 pr-3 font-semibold">Nomor Surat</th>
                  <th className="py-2 px-3 font-semibold">Tanggal</th>
                  <th className="py-2 px-3 font-semibold">Jenis</th>
                  <th className="py-2 px-3 font-semibold">Perihal</th>
                  <th className="py-2 pl-3 font-semibold text-right">Cetak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {bundle.surat.map((s) => (
                  <tr key={s.surat_id}>
                    <td className="py-2.5 pr-3 font-mono font-semibold text-neutral-900">{s.nomor_surat}</td>
                    <td className="py-2.5 px-3 font-mono text-neutral-600">{s.tanggal_surat}</td>
                    <td className="py-2.5 px-3 text-neutral-600">{s.jenis_surat.replace('_', ' ')}</td>
                    <td className="py-2.5 px-3 font-medium text-neutral-900">{s.perihal}</td>
                    <td className="py-2.5 pl-3 text-right">
                      <button
                        type="button"
                        onClick={() => setPreviewLetter(s)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Pratinjau / Cetak</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
        {/* Undangan & RSVP */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-neutral-900">Undangan &amp; Konfirmasi Hadir (RSVP)</h3>
            </div>
            {bundle.canManageSurat && (
              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Kirim Undangan</span>
              </button>
            )}
          </div>

          {bundle.undangan.length === 0 ? (
            <p className="text-xs text-neutral-500">Belum ada undangan acara yang dikirim.</p>
          ) : (
            <div className="divide-y divide-neutral-100 text-xs">
              {bundle.undangan.map((u) => (
                <div key={u.undangan_id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-neutral-900">
                      {kegiatanMap.get(u.kegiatan_id) || suratMap.get(u.surat_id) || 'Undangan Keluarga Besar'}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      Target: {u.target_tipe.replace('_', ' ')} · Dikirim: {u.tanggal_kirim} · Status: <strong>{u.status_hadir.replace('_', ' ')}</strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRsvp(u.undangan_id, 'HADIR')}
                      className="px-2.5 py-1 text-[11px] font-semibold border border-green-700 text-green-700 hover:bg-green-50 rounded cursor-pointer"
                    >
                      Hadir
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRsvp(u.undangan_id, 'TIDAK_HADIR')}
                      className="px-2.5 py-1 text-[11px] font-semibold border border-neutral-300 text-neutral-700 hover:bg-neutral-50 rounded cursor-pointer"
                    >
                      Berhalangan
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Arsip Dokumen */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-green-700" />
              <h3 className="text-sm font-bold text-neutral-900">Arsip Dokumen Digital</h3>
            </div>
            {bundle.canManageSurat && (
              <button
                type="button"
                onClick={() => setShowArchiveModal(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Arsip</span>
              </button>
            )}
          </div>

          {bundle.arsip.length === 0 ? (
            <p className="text-xs text-neutral-500">Belum ada dokumen arsip tersimpan.</p>
          ) : (
            <div className="divide-y divide-neutral-100 text-xs">
              {bundle.arsip.map((doc) => (
                <div key={doc.arsip_id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-neutral-900">{doc.judul}</span>
                    <span className="text-[11px] text-neutral-500">
                      {doc.kategori_arsip} · {doc.tanggal_dokumen}
                    </span>
                  </div>
                  {doc.deskripsi && <p className="text-neutral-600">{doc.deskripsi}</p>}
                  {doc.drive_url && /^https?:\/\//i.test(doc.drive_url) && (
                    <a
                      href={doc.drive_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs font-semibold text-green-700 hover:underline"
                    >
                      Buka Dokumen Tautan
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Buat Surat */}
      {showLetterModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">Terbitkan Surat Resmi</h3>
              <button type="button" onClick={() => setShowLetterModal(false)} className="text-neutral-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveLetter} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Perihal Surat</label>
                <input
                  type="text"
                  required
                  value={letterPerihal}
                  onChange={(e) => setLetterPerihal(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Jenis</label>
                  <SearchableSelect
                    options={[
                      { value: 'UNDANGAN_ACARA', label: 'Undangan Acara' },
                      { value: 'EDARAN', label: 'Surat Edaran' },
                      { value: 'SURAT_TUGAS', label: 'Surat Tugas' },
                      { value: 'REKOMENDASI', label: 'Rekomendasi' },
                      { value: 'LAINNYA', label: 'Lainnya' },
                    ]}
                    value={letterJenis}
                    onChange={(val) => setLetterJenis((val || 'UNDANGAN_ACARA') as SuratRecord['jenis_surat'])}
                    searchPlaceholder="Cari jenis..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={letterTanggal}
                    onChange={(e) => setLetterTanggal(e.target.value)}
                    className="w-full px-2 py-2 text-xs border border-neutral-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Penerima</label>
                  <SearchableSelect
                    options={[
                      { value: 'SEMUA_KELUARGA', label: 'Semua Keluarga' },
                      { value: 'PENGURUS', label: 'Pengurus' },
                      { value: 'PERORANGAN', label: 'Perorangan' },
                      { value: 'EKSTERNAL', label: 'Eksternal' },
                    ]}
                    value={letterPenerima}
                    onChange={(val) => setLetterPenerima((val || 'SEMUA_KELUARGA') as SuratRecord['penerima_tipe'])}
                    searchPlaceholder="Cari penerima..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Isi Surat</label>
                <textarea
                  rows={5}
                  required
                  value={letterIsi}
                  onChange={(e) => setLetterIsi(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLetterModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold border border-neutral-300 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
                >
                  Terbitkan Surat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pratinjau Cetak Surat Ber-Kop Resmi */}
      {previewLetter && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 flex items-center justify-center p-4 overflow-y-auto print:static print:bg-white print:p-0">
          <div className="bg-white border border-neutral-300 rounded-xl w-full max-w-2xl p-6 sm:p-8 space-y-5 my-auto print:border-0 print:max-w-none">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3 print:hidden">
              <div className="text-xs font-bold text-neutral-700">Konsep Format Cetak · Surat Resmi Paguyuban</div>
              <button type="button" onClick={() => setPreviewLetter(null)} className="text-neutral-500 hover:text-neutral-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div ref={letterSheetRef} className="space-y-5 bg-white">
              <div className="flex items-start justify-between border-b-4 border-double border-green-900 pb-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    BMT
                  </div>
                  <div>
                    <div className="text-sm sm:text-base font-bold text-green-900 uppercase">
                      Paguyuban Keluarga Besar Bani Haji Mohammad Tohir
                    </div>
                    <div className="text-xs text-neutral-600 mt-0.5">
                      Guyub, Akur, Semedulur · Sekretariat Pusat: Pangebatan, Karanglewas, Banyumas
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-xs space-y-1">
                <div>
                  Nomor: <strong className="font-mono">{previewLetter.nomor_surat}</strong>
                </div>
                <div>
                  Tanggal: <span className="font-mono">{previewLetter.tanggal_surat}</span>
                </div>
                <div>
                  Perihal: <strong>{previewLetter.perihal}</strong>
                </div>
                <div>Kepada Yth. {previewLetter.penerima_tipe.replace('_', ' ')} Bani Haji Mohammad Tohir</div>
              </div>

              <div className="text-xs text-neutral-800 leading-relaxed whitespace-pre-line min-h-[140px]">
                {previewLetter.isi_surat || 'Assalamualaikum warahmatullahi wabarakatuh.'}
              </div>

              <div className="pt-6 flex items-end justify-between text-xs">
                <div className="text-neutral-500">Dicatat oleh: {previewLetter.created_by}</div>
                <div className="text-center">
                  <div>Pengurus Paguyuban Bani H. M. Tohir</div>
                  <div className="mt-12 font-bold text-neutral-900">Sekretariat Paguyuban</div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-neutral-200 print:hidden">
              <button
                type="button"
                onClick={() => {
                  generateLetterPdf(previewLetter);
                  onNotify(`PDF surat ${previewLetter.nomor_surat} berhasil diunduh.`);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh PDF Surat (.pdf)</span>
              </button>
              <button
                type="button"
                onClick={() => printElementViaIframe(letterSheetRef.current, `Surat ${previewLetter.nomor_surat}`, 'portrait', onNotify)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak ke Printer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Undangan */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">Kirim Undangan Kegiatan</h3>
              <button type="button" onClick={() => setShowInviteModal(false)} className="text-neutral-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveInvitation} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Kegiatan Terkait</label>
                <SearchableSelect
                  allowClear
                  options={bundle.kegiatan.map((k) => ({
                    value: k.kegiatan_id,
                    label: k.nama_kegiatan,
                    sublabel: k.tanggal_mulai,
                  }))}
                  value={invKegiatanId}
                  onChange={setInvKegiatanId}
                  placeholder="-- Pilih Agenda (opsional) --"
                  searchPlaceholder="Ketik nama kegiatan..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Surat Terkait</label>
                <SearchableSelect
                  allowClear
                  options={bundle.surat.map((s) => ({
                    value: s.surat_id,
                    label: `${s.nomor_surat} · ${s.perihal}`,
                    sublabel: s.tanggal_surat,
                  }))}
                  value={invSuratId}
                  onChange={setInvSuratId}
                  placeholder="-- Pilih Surat (opsional) --"
                  searchPlaceholder="Ketik nomor / perihal surat..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Sasaran Undangan</label>
                <SearchableSelect
                  options={[
                    { value: 'SEMUA_KELUARGA', label: 'Semua Keluarga' },
                    { value: 'PENGURUS', label: 'Pengurus' },
                    { value: 'RUMAH_TANGGA', label: 'Kepala Rumah Tangga' },
                  ]}
                  value={invTargetTipe}
                  onChange={(val) => setInvTargetTipe((val || 'SEMUA_KELUARGA') as typeof invTargetTipe)}
                  searchPlaceholder="Cari sasaran..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold border border-neutral-300 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
                >
                  Catat Undangan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Arsip */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">Simpan Dokumen Arsip Digital</h3>
              <button type="button" onClick={() => setShowArchiveModal(false)} className="text-neutral-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveArchive} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Judul Dokumen</label>
                <input
                  type="text"
                  required
                  value={arsJudul}
                  onChange={(e) => setArsJudul(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Kategori</label>
                  <SearchableSelect
                    options={[
                      { value: 'NOTULEN', label: 'Notulen Rapat' },
                      { value: 'SK_PENGURUS', label: 'SK Pengurus' },
                      { value: 'LPJ_KEUANGAN', label: 'LPJ Keuangan' },
                      { value: 'DOKUMENTASI', label: 'Dokumentasi Acara' },
                      { value: 'AD_ART', label: 'AD / ART' },
                      { value: 'LAINNYA', label: 'Lainnya' },
                    ]}
                    value={arsKategori}
                    onChange={(val) => setArsKategori((val || 'NOTULEN') as typeof arsKategori)}
                    searchPlaceholder="Cari kategori..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Visibilitas</label>
                  <SearchableSelect
                    options={[
                      { value: 'PUBLIK_KELUARGA', label: 'Semua Anggota' },
                      { value: 'KHUSUS_PENGURUS', label: 'Khusus Pengurus' },
                    ]}
                    value={arsVisibilitas}
                    onChange={(val) => setArsVisibilitas((val || 'PUBLIK_KELUARGA') as typeof arsVisibilitas)}
                    searchPlaceholder="Cari visibilitas..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Tautan Google Drive / URL Dokumen</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={arsUrl}
                  onChange={(e) => setArsUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Deskripsi</label>
                <textarea
                  rows={2}
                  value={arsDeskripsi}
                  onChange={(e) => setArsDeskripsi(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowArchiveModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold border border-neutral-300 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
                >
                  Simpan Arsip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
