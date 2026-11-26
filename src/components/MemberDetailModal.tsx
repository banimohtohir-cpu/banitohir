import React, { useEffect, useState } from 'react';
import { Edit3, GitBranch, Printer, X } from 'lucide-react';
import { MasterBundles, MemberDetailResponse, MemberRecord } from '../types';
import { MemberAvatar } from './MemberAvatar';
import { PrintPreviewModal } from './PrintPreviewModal';
import { generateMemberProfilePdf } from '../utils/exportPdf';

interface MemberDetailModalProps {
  token: string;
  memberId: string;
  masters: MasterBundles;
  canEdit: boolean;
  onClose: () => void;
  onSelectMember: (memberId: string) => void;
  onEditFull: (member: MemberRecord) => void;
  onOpenTreeFocus: (memberId: string) => void;
  onNotify?: (msg: string, kind?: 'success' | 'error') => void;
}

export function MemberDetailModal({
  token,
  memberId,
  masters,
  canEdit,
  onClose,
  onSelectMember,
  onEditFull,
  onOpenTreeFocus,
  onNotify,
}: MemberDetailModalProps) {
  const [detail, setDetail] = useState<MemberDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [printOpen, setPrintOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/members/${memberId}/detail`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (active && data.ok) setDetail(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [memberId, token]);

  const m = detail?.member;
  const fullName = m ? [m.gelar_depan, m.nama_lengkap, m.gelar_belakang].filter(Boolean).join(' ') : '';
  const wilayahMap = new Map(masters.wilayah.map((w) => [`${w.tingkat}:${w.kode_wilayah}`, w.nama_wilayah]));
  const pendidikanNama = masters.pendidikan.find((p) => p.id === m?.pendidikan_id)?.nama || '';
  const pekerjaanNama = masters.pekerjaan.find((p) => p.id === m?.pekerjaan_id)?.nama || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/55 p-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-3xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {m && <MemberAvatar name={fullName} photoValue={m.foto_drive_id} size="md" />}
            <div className="min-w-0">
              <h3 className="text-base font-bold text-neutral-900 truncate">
                {loading ? 'Memuat profil anggota...' : fullName || 'Profil Anggota'}
              </h3>
              {m && (
                <div className="text-xs text-neutral-500 mt-0.5 font-mono tabular-nums">
                  {m.id_anggota} · Kode {m.kode_silsilah || '-'} · {m.generasi_label} ({m.status_keturunan})
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {m && detail && (
              <button
                type="button"
                onClick={() => setPrintOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak / PDF</span>
              </button>
            )}
            {m && (
              <button
                type="button"
                onClick={() => onOpenTreeFocus(m.id_anggota)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-800 bg-green-50 border border-green-200 hover:bg-green-100 rounded-lg cursor-pointer"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Silsilah Inti</span>
              </button>
            )}
            {m && canEdit && (
              <button
                type="button"
                onClick={() => onEditFull(m)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Lengkap</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup profil"
              className="p-1.5 text-neutral-500 hover:text-neutral-800 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-6 space-y-5 text-xs">
          {loading || !detail || !m ? (
            <div className="py-10 text-center text-neutral-500">Memuat detail anggota...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-neutral-50 rounded-lg p-4">
                <div className="space-y-1.5">
                  <div>
                    <span className="text-neutral-500">Tempat, Tanggal Lahir: </span>
                    <span className="font-medium text-neutral-900 font-mono tabular-nums">
                      {m.tempat_lahir || '-'}, {m.tanggal_lahir || 'Belum diisi'}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Status Kehidupan: </span>
                    <span className="font-semibold text-neutral-900">
                      {m.status_hidup}
                      {m.status_hidup === 'WAFAT' && m.tanggal_wafat ? ` (${m.tanggal_wafat})` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Pendidikan / Pekerjaan: </span>
                    <span className="font-medium text-neutral-900">
                      {[pendidikanNama, pekerjaanNama, m.pekerjaan_lainnya].filter(Boolean).join(' · ') || '-'}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div>
                    <span className="text-neutral-500">Kontak HP / Email: </span>
                    <span className="font-mono text-neutral-900">
                      {[m.no_hp, m.email].filter(Boolean).join(' · ') || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Wilayah: </span>
                    <span className="font-medium text-neutral-900">
                      {[
                        wilayahMap.get(`DESA:${m.kelurahan_id}`),
                        wilayahMap.get(`KEC:${m.kecamatan_id}`),
                        wilayahMap.get(`KAB:${m.kabkota_id}`),
                        wilayahMap.get(`PROV:${m.provinsi_id}`),
                      ]
                        .filter(Boolean)
                        .join(', ') || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Alamat: </span>
                    <span className="text-neutral-900">{m.keterangan_alamat || m.nama_jalan || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-neutral-200 rounded-lg p-4 space-y-2">
                  <div className="font-bold text-neutral-900">Orang Tua</div>
                  {detail.parents.length === 0 ? (
                    <div className="text-neutral-500">Belum ada tautan orang tua.</div>
                  ) : (
                    detail.parents.map((p) => (
                      <div key={p.relation.relasi_ortu_id} className="space-y-1">
                        {p.ayah && (
                          <div>
                            Ayah:{' '}
                            <button
                              type="button"
                              onClick={() => onSelectMember(p.ayah!.id_anggota)}
                              className="font-semibold text-green-800 hover:underline cursor-pointer"
                            >
                              {p.ayah.nama_lengkap}
                            </button>{' '}
                            <span className="text-neutral-500">({p.relation.jenis_hubungan})</span>
                          </div>
                        )}
                        {p.ibu && (
                          <div>
                            Ibu:{' '}
                            <button
                              type="button"
                              onClick={() => onSelectMember(p.ibu!.id_anggota)}
                              className="font-semibold text-green-800 hover:underline cursor-pointer"
                            >
                              {p.ibu.nama_lengkap}
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="border border-neutral-200 rounded-lg p-4 space-y-2">
                  <div className="font-bold text-neutral-900">
                    Pasangan ({detail.spouses.length})
                  </div>
                  {detail.spouses.length === 0 ? (
                    <div className="text-neutral-500">Belum tercatat pasangan.</div>
                  ) : (
                    <ul className="space-y-1.5">
                      {detail.spouses.map((sp) => (
                        <li key={sp.relation.relasi_pasangan_id}>
                          <span className="font-mono text-neutral-500">Ke-{sp.relation.urutan_pasangan}: </span>
                          {sp.partner ? (
                            <button
                              type="button"
                              onClick={() => onSelectMember(sp.partner!.id_anggota)}
                              className="font-semibold text-green-800 hover:underline cursor-pointer"
                            >
                              {sp.partner.nama_lengkap}
                            </button>
                          ) : (
                            '-'
                          )}
                          <span className="text-neutral-500"> · {sp.relation.status_hubungan}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-neutral-200 rounded-lg p-4 space-y-2">
                  <div className="font-bold text-neutral-900">Anak ({detail.children.length})</div>
                  {detail.children.length === 0 ? (
                    <div className="text-neutral-500">Belum ada anak tercatat.</div>
                  ) : (
                    <ul className="space-y-1">
                      {detail.children.map((ch) => (
                        <li key={ch.relation.relasi_ortu_id} className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => onSelectMember(ch.child.id_anggota)}
                            className="font-semibold text-green-800 hover:underline cursor-pointer text-left"
                          >
                            {ch.child.nama_lengkap}
                          </button>
                          <span className="font-mono text-neutral-500">{ch.child.kode_silsilah || ch.child.id_anggota}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="border border-neutral-200 rounded-lg p-4 space-y-2">
                  <div className="font-bold text-neutral-900">
                    Saudara ({detail.siblings.length}) &amp; Rumah Tangga ({detail.households.length})
                  </div>
                  {detail.siblings.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {detail.siblings.map((sib) => (
                        <button
                          key={sib.id_anggota}
                          type="button"
                          onClick={() => onSelectMember(sib.id_anggota)}
                          className="text-green-800 hover:underline font-medium cursor-pointer"
                        >
                          {sib.nama_lengkap}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="pt-2 border-t border-neutral-100 space-y-1">
                    {detail.households.length === 0 ? (
                      <div className="text-neutral-500">Belum tergabung dalam rumah tangga aktif.</div>
                    ) : (
                      detail.households.map((hm) => (
                        <div key={hm.id_anggota_rumah} className="text-neutral-700">
                          <span className="font-semibold">{hm.household?.nama_rumah_tangga}</span> · Peran: {hm.peran_dalam_rt}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {detail && m && (
        <PrintPreviewModal
          open={printOpen}
          onClose={() => setPrintOpen(false)}
          title={`Biodata & Silsilah Lengkap: ${fullName}`}
          subtitle={`ID ${m.id_anggota} · Kode Silsilah ${m.kode_silsilah || '-'} · ${m.generasi_label} (${m.status_keturunan})`}
          orientation="portrait"
          summary={[
            { label: 'ID / Kode Silsilah', value: `${m.id_anggota} · ${m.kode_silsilah || '-'}` },
            { label: 'Kedudukan Keturunan', value: `${m.generasi_label} (${m.status_keturunan})` },
            { label: 'Status Kehidupan', value: `${m.status_hidup}${m.is_kk ? ' · KK' : ''}` },
            { label: 'Anak / Saudara', value: `${detail.children.length} anak · ${detail.siblings.length} sdr` },
          ]}
          leftSignerTitle="Mengetahui, Ketua Paguyuban"
          rightSignerTitle="Sekretariat / Pencatat Silsilah"
          onNotify={onNotify}
          onDownloadPdf={() => generateMemberProfilePdf({ detail, masters })}
        >
          <div className="space-y-4 text-[11px]">
            {/* Foto & Ringkasan Identitas */}
            <div className="flex items-start gap-4 border border-neutral-200 rounded-lg p-3.5 bg-neutral-50/70">
              <MemberAvatar name={fullName} photoValue={m.foto_drive_id} size="lg" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 flex-1">
                <div>
                  <span className="text-neutral-500">Nama Lengkap: </span>
                  <strong className="text-neutral-900">{fullName}</strong>
                </div>
                <div>
                  <span className="text-neutral-500">Nama Panggilan: </span>
                  <span className="text-neutral-900">{m.nama_panggilan || '-'}</span>
                </div>
                <div>
                  <span className="text-neutral-500">Tempat, Tgl Lahir: </span>
                  <span className="font-mono tabular-nums text-neutral-900">
                    {m.tempat_lahir || '-'}, {m.tanggal_lahir || 'Belum diisi'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500">Status Kehidupan: </span>
                  <span className="font-semibold text-neutral-900">
                    {m.status_hidup}
                    {m.status_hidup === 'WAFAT' && m.tanggal_wafat ? ` (${m.tanggal_wafat})` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500">No. HP / Telepon: </span>
                  <span className="font-mono tabular-nums font-semibold text-neutral-900">
                    {[m.no_hp, m.no_hp_alt].filter(Boolean).join(' / ') || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500">Email: </span>
                  <span className="font-mono text-neutral-900 break-all">{m.email || '-'}</span>
                </div>
                <div>
                  <span className="text-neutral-500">Pendidikan / Pekerjaan: </span>
                  <span className="text-neutral-900">
                    {[pendidikanNama, pekerjaanNama, m.pekerjaan_lainnya].filter(Boolean).join(' · ') || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500">Wilayah: </span>
                  <span className="text-neutral-900">
                    {[
                      wilayahMap.get(`DESA:${m.kelurahan_id}`),
                      wilayahMap.get(`KEC:${m.kecamatan_id}`),
                      wilayahMap.get(`KAB:${m.kabkota_id}`),
                      wilayahMap.get(`PROV:${m.provinsi_id}`),
                    ]
                      .filter(Boolean)
                      .join(', ') || '-'}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-neutral-500">Alamat Lengkap: </span>
                  <span className="text-neutral-900">
                    {[
                      m.keterangan_alamat,
                      m.nama_jalan,
                      m.rt || m.rw ? `RT ${m.rt || '-'} / RW ${m.rw || '-'}` : '',
                      m.no_rumah ? `No. ${m.no_rumah}` : '',
                      m.kode_pos ? `Kode Pos ${m.kode_pos}` : '',
                    ]
                      .filter(Boolean)
                      .join(', ') || '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Orang Tua & Pasangan */}
            <div>
              <div className="font-bold text-xs text-neutral-900 mb-1.5">
                I. Garis Keturunan (Orang Tua) &amp; Pasangan Hidup
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-green-800 text-white font-semibold">
                    <th className="py-1.5 px-2 border border-green-900 w-36">Hubungan</th>
                    <th className="py-1.5 px-2 border border-green-900 w-28">Kode / ID</th>
                    <th className="py-1.5 px-2 border border-green-900">Nama Lengkap &amp; Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.parents.length === 0 ? (
                    <tr>
                      <td className="py-1.5 px-2 border border-neutral-200 font-semibold">Orang Tua</td>
                      <td className="py-1.5 px-2 border border-neutral-200 font-mono">-</td>
                      <td className="py-1.5 px-2 border border-neutral-200 text-neutral-500">
                        Belum ada tautan orang tua di database silsilah
                      </td>
                    </tr>
                  ) : (
                    detail.parents.map((p) => (
                      <React.Fragment key={p.relation.relasi_ortu_id}>
                        {p.ayah && (
                          <tr>
                            <td className="py-1.5 px-2 border border-neutral-200 font-semibold">
                              Ayah ({p.relation.jenis_hubungan})
                            </td>
                            <td className="py-1.5 px-2 border border-neutral-200 font-mono text-green-900">
                              {p.ayah.kode_silsilah || p.ayah.id_anggota}
                            </td>
                            <td className="py-1.5 px-2 border border-neutral-200">
                              {[p.ayah.gelar_depan, p.ayah.nama_lengkap, p.ayah.gelar_belakang].filter(Boolean).join(' ')}{' '}
                              <span className="text-neutral-500">
                                ({p.ayah.generasi_label} · {p.ayah.status_hidup})
                              </span>
                            </td>
                          </tr>
                        )}
                        {p.ibu && (
                          <tr>
                            <td className="py-1.5 px-2 border border-neutral-200 font-semibold">Ibu</td>
                            <td className="py-1.5 px-2 border border-neutral-200 font-mono text-green-900">
                              {p.ibu.kode_silsilah || p.ibu.id_anggota}
                            </td>
                            <td className="py-1.5 px-2 border border-neutral-200">
                              {[p.ibu.gelar_depan, p.ibu.nama_lengkap, p.ibu.gelar_belakang].filter(Boolean).join(' ')}{' '}
                              <span className="text-neutral-500">
                                ({p.ibu.generasi_label} · {p.ibu.status_hidup})
                              </span>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                  {detail.spouses.length === 0 ? (
                    <tr className="bg-neutral-50">
                      <td className="py-1.5 px-2 border border-neutral-200 font-semibold">Pasangan</td>
                      <td className="py-1.5 px-2 border border-neutral-200 font-mono">-</td>
                      <td className="py-1.5 px-2 border border-neutral-200 text-neutral-500">
                        Belum tercatat pasangan
                      </td>
                    </tr>
                  ) : (
                    detail.spouses.map((sp) => (
                      <tr key={sp.relation.relasi_pasangan_id} className="bg-neutral-50">
                        <td className="py-1.5 px-2 border border-neutral-200 font-semibold">
                          Pasangan Ke-{sp.relation.urutan_pasangan}
                        </td>
                        <td className="py-1.5 px-2 border border-neutral-200 font-mono text-green-900">
                          {sp.partner?.kode_silsilah || sp.partner?.id_anggota || '-'}
                        </td>
                        <td className="py-1.5 px-2 border border-neutral-200">
                          {sp.partner
                            ? [sp.partner.gelar_depan, sp.partner.nama_lengkap, sp.partner.gelar_belakang]
                                .filter(Boolean)
                                .join(' ')
                            : '-'}{' '}
                          <span className="text-neutral-500">
                            ({sp.relation.status_hubungan}
                            {sp.relation.tanggal_menikah ? `, Menikah: ${sp.relation.tanggal_menikah}` : ''})
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Daftar Anak */}
            <div>
              <div className="font-bold text-xs text-neutral-900 mb-1.5">
                II. Daftar Anak-Anak ({detail.children.length})
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-green-800 text-white font-semibold">
                    <th className="py-1.5 px-2 border border-green-900 text-center w-16">Anak Ke</th>
                    <th className="py-1.5 px-2 border border-green-900 w-28">Kode Silsilah</th>
                    <th className="py-1.5 px-2 border border-green-900">Nama Lengkap</th>
                    <th className="py-1.5 px-2 border border-green-900">Tempat, Tgl Lahir</th>
                    <th className="py-1.5 px-2 border border-green-900">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.children.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-2 px-2 border border-neutral-200 text-center text-neutral-500">
                        Belum ada anak tercatat.
                      </td>
                    </tr>
                  ) : (
                    detail.children.map((ch, idx) => (
                      <tr key={ch.relation.relasi_ortu_id} className={idx % 2 === 1 ? 'bg-neutral-50' : 'bg-white'}>
                        <td className="py-1.5 px-2 border border-neutral-200 font-mono text-center">
                          {ch.relation.urutan_anak || idx + 1}
                        </td>
                        <td className="py-1.5 px-2 border border-neutral-200 font-mono text-green-900">
                          {ch.child.kode_silsilah || ch.child.id_anggota}
                        </td>
                        <td className="py-1.5 px-2 border border-neutral-200 font-semibold">
                          {[ch.child.gelar_depan, ch.child.nama_lengkap, ch.child.gelar_belakang]
                            .filter(Boolean)
                            .join(' ')}
                        </td>
                        <td className="py-1.5 px-2 border border-neutral-200 font-mono tabular-nums">
                          {ch.child.tempat_lahir || '-'}, {ch.child.tanggal_lahir || '-'}
                        </td>
                        <td className="py-1.5 px-2 border border-neutral-200">
                          {ch.child.status_keturunan} · {ch.child.status_hidup}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Saudara & Rumah Tangga */}
            <div>
              <div className="font-bold text-xs text-neutral-900 mb-1.5">
                III. Saudara ({detail.siblings.length}) &amp; Keanggotaan Rumah Tangga ({detail.households.length})
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-green-800 text-white font-semibold">
                    <th className="py-1.5 px-2 border border-green-900 w-36">Kelompok</th>
                    <th className="py-1.5 px-2 border border-green-900 w-28">Kode / ID</th>
                    <th className="py-1.5 px-2 border border-green-900">Nama &amp; Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.siblings.length === 0 ? (
                    <tr>
                      <td className="py-1.5 px-2 border border-neutral-200 font-semibold">Saudara</td>
                      <td className="py-1.5 px-2 border border-neutral-200 font-mono">-</td>
                      <td className="py-1.5 px-2 border border-neutral-200 text-neutral-500">
                        Tidak ada data saudara tercatat
                      </td>
                    </tr>
                  ) : (
                    detail.siblings.map((sib, idx) => (
                      <tr key={sib.id_anggota} className={idx % 2 === 1 ? 'bg-neutral-50' : 'bg-white'}>
                        <td className="py-1.5 px-2 border border-neutral-200 font-semibold">Saudara #{idx + 1}</td>
                        <td className="py-1.5 px-2 border border-neutral-200 font-mono text-green-900">
                          {sib.kode_silsilah || sib.id_anggota}
                        </td>
                        <td className="py-1.5 px-2 border border-neutral-200">
                          {[sib.gelar_depan, sib.nama_lengkap, sib.gelar_belakang].filter(Boolean).join(' ')}{' '}
                          <span className="text-neutral-500">
                            ({sib.generasi_label} · {sib.status_hidup})
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                  {detail.households.length === 0 ? (
                    <tr>
                      <td className="py-1.5 px-2 border border-neutral-200 font-semibold">Rumah Tangga</td>
                      <td className="py-1.5 px-2 border border-neutral-200 font-mono">-</td>
                      <td className="py-1.5 px-2 border border-neutral-200 text-neutral-500">
                        Belum tergabung dalam rumah tangga aktif
                      </td>
                    </tr>
                  ) : (
                    detail.households.map((hm) => (
                      <tr key={hm.id_anggota_rumah} className="bg-neutral-50">
                        <td className="py-1.5 px-2 border border-neutral-200 font-semibold">Rumah Tangga</td>
                        <td className="py-1.5 px-2 border border-neutral-200 font-mono">{hm.id_rumah_tangga}</td>
                        <td className="py-1.5 px-2 border border-neutral-200">
                          <strong>{hm.household?.nama_rumah_tangga || hm.id_rumah_tangga}</strong> · Peran: {hm.peran_dalam_rt}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </PrintPreviewModal>
      )}
    </div>
  );
}
