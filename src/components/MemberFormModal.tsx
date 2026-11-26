import React, { useEffect, useMemo, useState } from 'react';
import { Home, Link2, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { MasterBundles, MemberDetailResponse, MemberRecord, SpouseRelation, WilayahItem } from '../types';
import { compressImageFileToDataUrl } from '../utils/memberPhoto';
import { MemberAvatar } from './MemberAvatar';
import { SearchableOption, SearchableSelect } from './SearchableSelect';

interface MemberFormModalProps {
  token: string;
  member: MemberRecord | null; // null = create mode
  masters: MasterBundles;
  onClose: () => void;
  onSaved: (saved: MemberRecord) => void;
  onNotify: (msg: string, kind?: 'success' | 'error') => void;
}

type RelationType = 'ANAK_DARI' | 'PASANGAN_DARI' | 'MANUAL';

export function MemberFormModal({
  token,
  member,
  masters,
  onClose,
  onSaved,
  onNotify,
}: MemberFormModalProps) {
  const isEdit = Boolean(member);
  const [saving, setSaving] = useState(false);
  const [dupWarning, setDupWarning] = useState<string | null>(null);

  // Relation options for create mode
  const [relationType, setRelationType] = useState<RelationType>('ANAK_DARI');
  const [relationAyahId, setRelationAyahId] = useState('');
  const [relationIbuId, setRelationIbuId] = useState('');
  const [relationPasanganId, setRelationPasanganId] = useState('');
  const [relationJenisHub, setRelationJenisHub] = useState<'KANDUNG' | 'ANGKAT' | 'TIRI'>('KANDUNG');
  const [relationStatusHub, setRelationStatusHub] = useState<'MENIKAH' | 'CERAI_HIDUP' | 'CERAI_MATI'>('MENIKAH');
  const [relationTglNikah, setRelationTglNikah] = useState('');

  const [allMembers, setAllMembers] = useState<MemberRecord[]>([]);
  const [allCouples, setAllCouples] = useState<SpouseRelation[]>([]);
  const [linkedParents, setLinkedParents] = useState<{ roleLabel: string; member: MemberRecord }[]>([]);
  const [sameAddressAsParent, setSameAddressAsParent] = useState(false);
  const [selectedParentSourceId, setSelectedParentSourceId] = useState('');
  const [nextIdPreview, setNextIdPreview] = useState('Otomatis');

  const [form, setForm] = useState({
    kode_silsilah: member?.kode_silsilah || '',
    kode_legacy: member?.kode_legacy || '',
    gelar_depan: member?.gelar_depan || '',
    nama_lengkap: member?.nama_lengkap || '',
    gelar_belakang: member?.gelar_belakang || '',
    nama_panggilan: member?.nama_panggilan || '',
    jenis_kelamin: member?.jenis_kelamin || '',
    foto_drive_id: member?.foto_drive_id || '',
    status_keturunan: member?.status_keturunan || 'Kandung',
    generasi_level: member?.generasi_level ?? 1,
    generasi_label: member?.generasi_label || 'Anak',
    tempat_lahir: member?.tempat_lahir || '',
    tanggal_lahir: member?.tanggal_lahir || '',
    status_hidup: (member?.status_hidup || 'HIDUP') as MemberRecord['status_hidup'],
    tanggal_wafat: member?.tanggal_wafat || '',
    tempat_wafat: member?.tempat_wafat || '',
    catatan_wafat: member?.catatan_wafat || '',
    provinsi_id: member?.provinsi_id || '',
    kabkota_id: member?.kabkota_id || '',
    kecamatan_id: member?.kecamatan_id || '',
    kelurahan_id: member?.kelurahan_id || '',
    nama_jalan: member?.nama_jalan || '',
    rt: member?.rt || '',
    rw: member?.rw || '',
    no_rumah: member?.no_rumah || '',
    kode_pos: member?.kode_pos || '',
    keterangan_alamat: member?.keterangan_alamat || '',
    no_hp: member?.no_hp || '',
    no_hp_alt: member?.no_hp_alt || '',
    email: member?.email || '',
    pendidikan_id: member?.pendidikan_id || '',
    pekerjaan_id: member?.pekerjaan_id || '',
    pekerjaan_lainnya: member?.pekerjaan_lainnya || '',
    is_kk: Boolean(member?.is_kk),
    status_keanggotaan: member?.status_keanggotaan || 'AKTIF',
    tanggal_gabung: member?.tanggal_gabung || '',
    catatan: member?.catatan || '',
    is_archived: Boolean(member?.is_archived),
  });

  const [provList, setProvList] = useState<WilayahItem[]>(() =>
    masters.wilayah.filter((w) => w.tingkat === 'PROV')
  );
  const [kabList, setKabList] = useState<WilayahItem[]>([]);
  const [kecList, setKecList] = useState<WilayahItem[]>([]);
  const [desaList, setDesaList] = useState<WilayahItem[]>([]);

  useEffect(() => {
    fetch('/api/members/relation-options', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setAllMembers(data.members || []);
          setAllCouples(data.couples || []);
          if (data.nextIdPreview) setNextIdPreview(data.nextIdPreview);
        }
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!isEdit || !member) {
      setLinkedParents([]);
      return;
    }
    fetch(`/api/members/${member.id_anggota}/detail`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: { ok?: boolean } & Partial<MemberDetailResponse>) => {
        if (!data.ok || !data.parents) return;
        const list: { roleLabel: string; member: MemberRecord }[] = [];
        const seen = new Set<string>();
        data.parents.forEach((p) => {
          if (p.ayah && !seen.has(p.ayah.id_anggota)) {
            seen.add(p.ayah.id_anggota);
            list.push({ roleLabel: `Ayah (${p.relation.jenis_hubungan})`, member: p.ayah });
          }
          if (p.ibu && !seen.has(p.ibu.id_anggota)) {
            seen.add(p.ibu.id_anggota);
            list.push({ roleLabel: 'Ibu', member: p.ibu });
          }
        });
        setLinkedParents(list);
      })
      .catch(() => {});
  }, [isEdit, member, token]);

  // Server-authoritative preview whenever relation changes in create mode
  useEffect(() => {
    if (isEdit) return;
    if (relationType === 'MANUAL') return;
    const hasSelection =
      (relationType === 'ANAK_DARI' && (relationAyahId || relationIbuId)) ||
      (relationType === 'PASANGAN_DARI' && relationPasanganId);
    if (!hasSelection) return;

    fetch('/api/members/preview-relation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        relation_type: relationType,
        relation_ayah_id: relationAyahId,
        relation_ibu_id: relationIbuId,
        relation_pasangan_id: relationPasanganId,
        relation_jenis_hubungan: relationJenisHub,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        if (d.nextId) setNextIdPreview(d.nextId);
        setForm((prev) => ({
          ...prev,
          kode_silsilah: d.kode_silsilah ?? prev.kode_silsilah,
          generasi_level: d.generasi_level ?? prev.generasi_level,
          generasi_label: d.generasi_label ?? prev.generasi_label,
          status_keturunan: d.status_keturunan ?? prev.status_keturunan,
          jenis_kelamin: !prev.jenis_kelamin && d.suggestedGender ? d.suggestedGender : prev.jenis_kelamin,
        }));
      })
      .catch(() => {});
  }, [isEdit, relationType, relationAyahId, relationIbuId, relationPasanganId, relationJenisHub, token]);

  function handleSelectAyah(id: string) {
    setRelationAyahId(id);
    if (id && !relationIbuId) {
      const spouseRel = allCouples.filter(
        (c) => c.status_aktif && (c.id_anggota_1 === id || c.id_anggota_2 === id)
      );
      if (spouseRel.length === 1) {
        const partnerId = spouseRel[0].id_anggota_1 === id ? spouseRel[0].id_anggota_2 : spouseRel[0].id_anggota_1;
        setRelationIbuId(partnerId);
      }
    }
  }

  function handleSelectIbu(id: string) {
    setRelationIbuId(id);
    if (id && !relationAyahId) {
      const spouseRel = allCouples.filter(
        (c) => c.status_aktif && (c.id_anggota_1 === id || c.id_anggota_2 === id)
      );
      if (spouseRel.length === 1) {
        const partnerId = spouseRel[0].id_anggota_1 === id ? spouseRel[0].id_anggota_2 : spouseRel[0].id_anggota_1;
        setRelationAyahId(partnerId);
      }
    }
  }

  const memberOptions = useMemo<SearchableOption[]>(() => {
    return allMembers
      .filter((m) => !member || m.id_anggota !== member.id_anggota)
      .map((m) => ({
        value: m.id_anggota,
        label: `${m.kode_silsilah ? `[${m.kode_silsilah}] ` : ''}${[m.gelar_depan, m.nama_lengkap, m.gelar_belakang].filter(Boolean).join(' ')}`,
        sublabel: `${m.id_anggota} · ${m.generasi_label} (${m.status_keturunan})`,
        keywords: `${m.nama_panggilan || ''} ${m.tempat_lahir || ''}`,
      }));
  }, [allMembers, member]);

  const availableParents = useMemo<{ roleLabel: string; member: MemberRecord }[]>(() => {
    if (isEdit) return linkedParents;
    if (relationType !== 'ANAK_DARI') return [];
    const list: { roleLabel: string; member: MemberRecord }[] = [];
    const ayah = allMembers.find((m) => m.id_anggota === relationAyahId);
    const ibu = allMembers.find((m) => m.id_anggota === relationIbuId);
    if (ayah) list.push({ roleLabel: 'Ayah', member: ayah });
    if (ibu && ibu.id_anggota !== ayah?.id_anggota) list.push({ roleLabel: 'Ibu', member: ibu });
    return list;
  }, [isEdit, linkedParents, relationType, allMembers, relationAyahId, relationIbuId]);

  const wilayahLookup = useMemo(
    () => new Map(masters.wilayah.map((w) => [`${w.tingkat}:${w.kode_wilayah}`, w.nama_wilayah])),
    [masters.wilayah]
  );

  function hasAnyAddress(src: MemberRecord): boolean {
    return Boolean(
      (src.keterangan_alamat && !src.keterangan_alamat.includes('Terbatas')) ||
        src.nama_jalan ||
        src.provinsi_id ||
        src.kabkota_id ||
        src.kecamatan_id ||
        src.kelurahan_id ||
        src.rt ||
        src.rw ||
        src.no_rumah ||
        src.kode_pos
    );
  }

  function formatMemberAddressSummary(src: MemberRecord): string {
    const cleanKet =
      src.keterangan_alamat && !src.keterangan_alamat.includes('Terbatas') ? src.keterangan_alamat : '';
    const rtRw = src.rt || src.rw ? `RT ${src.rt || '-'} / RW ${src.rw || '-'}` : '';
    const wilayahText = [
      wilayahLookup.get(`DESA:${src.kelurahan_id}`),
      wilayahLookup.get(`KEC:${src.kecamatan_id}`),
      wilayahLookup.get(`KAB:${src.kabkota_id}`),
      wilayahLookup.get(`PROV:${src.provinsi_id}`),
    ]
      .filter(Boolean)
      .join(', ');
    return (
      [cleanKet, src.nama_jalan, rtRw, src.no_rumah ? `No. ${src.no_rumah}` : '', wilayahText, src.kode_pos]
        .filter(Boolean)
        .join(', ') || 'Alamat orang tua ini belum diisi'
    );
  }

  function applyAddressFromParent(src: MemberRecord, silent = false) {
    const cleanKet =
      src.keterangan_alamat && !src.keterangan_alamat.includes('Terbatas') ? src.keterangan_alamat : '';
    setForm((prev) => ({
      ...prev,
      provinsi_id: src.provinsi_id || '',
      kabkota_id: src.kabkota_id || '',
      kecamatan_id: src.kecamatan_id || '',
      kelurahan_id: src.kelurahan_id || '',
      nama_jalan: src.nama_jalan || '',
      rt: src.rt || '',
      rw: src.rw || '',
      no_rumah: src.no_rumah || '',
      kode_pos: src.kode_pos || '',
      keterangan_alamat: cleanKet,
    }));
    if (!silent) {
      onNotify(`Alamat otomatis diisi mengikuti ${src.nama_lengkap}.`);
    }
  }

  const activeParentSource = useMemo<MemberRecord | null>(() => {
    if (selectedParentSourceId) {
      const fromLinked = availableParents.find((p) => p.member.id_anggota === selectedParentSourceId)?.member;
      if (fromLinked) return fromLinked;
      const fromAll = allMembers.find((m) => m.id_anggota === selectedParentSourceId);
      if (fromAll) return fromAll;
    }
    const preferred = availableParents.find((p) => hasAnyAddress(p.member)) || availableParents[0];
    return preferred?.member || null;
  }, [selectedParentSourceId, availableParents, allMembers]);

  function handleToggleSameAsParent(checked: boolean) {
    setSameAddressAsParent(checked);
    if (!checked) return;
    const preferred =
      availableParents.find((p) => p.member.id_anggota === selectedParentSourceId)?.member ||
      availableParents.find((p) => hasAnyAddress(p.member))?.member ||
      availableParents[0]?.member ||
      allMembers.find((m) => m.id_anggota === selectedParentSourceId) ||
      null;
    if (preferred) {
      setSelectedParentSourceId(preferred.id_anggota);
      applyAddressFromParent(preferred);
    }
  }

  // If creating a child with checkbox already active and user selects Ayah/Ibu afterwards, sync address automatically
  useEffect(() => {
    if (!isEdit && sameAddressAsParent && activeParentSource) {
      applyAddressFromParent(activeParentSource, true);
    }
  }, [isEdit, sameAddressAsParent, activeParentSource?.id_anggota]);

  async function loadWilayah(tingkat: 'PROV' | 'KAB' | 'KEC' | 'DESA', kodeInduk: string) {
    if (tingkat !== 'PROV' && !kodeInduk) return [];
    const params = new URLSearchParams({ tingkat, kodeInduk });
    const res = await fetch(`/api/master/wilayah?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return (res.ok && data.ok ? data.items : []) as WilayahItem[];
  }

  useEffect(() => {
    loadWilayah('PROV', '').then((items) => {
      if (items.length) setProvList(items);
    });
  }, []);

  useEffect(() => {
    if (!form.provinsi_id) {
      setKabList([]);
      return;
    }
    loadWilayah('KAB', form.provinsi_id).then(setKabList);
  }, [form.provinsi_id]);

  useEffect(() => {
    if (!form.kabkota_id) {
      setKecList([]);
      return;
    }
    loadWilayah('KEC', form.kabkota_id).then(setKecList);
  }, [form.kabkota_id]);

  useEffect(() => {
    if (!form.kecamatan_id) {
      setDesaList([]);
      return;
    }
    loadWilayah('DESA', form.kecamatan_id).then(setDesaList);
  }, [form.kecamatan_id]);

  async function submitForm(forceDuplicate = false) {
    if (!isEdit && relationType === 'ANAK_DARI' && !relationAyahId && !relationIbuId) {
      onNotify('Pilih minimal satu orang tua (Ayah atau Ibu), atau ubah mode ke Input Manual.', 'error');
      return;
    }
    if (!isEdit && relationType === 'PASANGAN_DARI' && !relationPasanganId) {
      onNotify('Pilih anggota pasangan terlebih dahulu, atau ubah mode ke Input Manual.', 'error');
      return;
    }

    setSaving(true);
    setDupWarning(null);
    try {
      const url = isEdit ? `/api/members/${member!.id_anggota}` : '/api/members';
      const method = isEdit ? 'PUT' : 'POST';
      const payload = isEdit
        ? { ...form, forceDuplicate }
        : {
            ...form,
            forceDuplicate,
            relation_type: relationType,
            relation_ayah_id: relationAyahId,
            relation_ibu_id: relationIbuId,
            relation_pasangan_id: relationPasanganId,
            relation_jenis_hubungan: relationJenisHub,
            relation_status_hubungan: relationStatusHub,
            relation_tanggal_menikah: relationTglNikah,
          };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 409 && data.code === 'DUPLICATE_WARNING') {
        setDupWarning(data.message);
        return;
      }
      if (!res.ok || !data.ok) {
        onNotify(data.message || 'Gagal menyimpan data anggota.', 'error');
        return;
      }
      onNotify(
        isEdit
          ? 'Data lengkap anggota berhasil diperbarui.'
          : `Anggota baru (${data.member?.id_anggota} · kode ${data.member?.kode_silsilah || '-'}) & relasi keluarga tersimpan.`
      );
      onSaved(data.member);
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitForm(false);
  }

  const isRelationAutoLocked = !isEdit && relationType !== 'MANUAL';

  const genderOptions: SearchableOption[] = [
    { value: '', label: 'Belum dipilih' },
    { value: 'L', label: 'Laki-laki' },
    { value: 'P', label: 'Perempuan' },
  ];

  const statusKeturunanOptions: SearchableOption[] = [
    { value: 'Kandung', label: 'Keturunan Kandung' },
    { value: 'Menantu', label: 'Menantu' },
    { value: 'Anak Angkat', label: 'Anak Angkat' },
    { value: 'Leluhur', label: 'Leluhur' },
    { value: 'Lainnya', label: 'Lainnya' },
  ];

  const generasiOptions: SearchableOption[] = masters.generasi.map((g) => ({
    value: String(g.level_angka ?? g.urutan),
    label: `Gen ${g.level_angka ?? g.urutan} — ${g.nama}`,
  }));

  const statusHidupOptions: SearchableOption[] = [
    { value: 'HIDUP', label: 'HIDUP' },
    { value: 'WAFAT', label: 'WAFAT' },
    { value: 'TIDAK_DIKETAHUI', label: 'TIDAK DIKETAHUI' },
  ];

  const pendidikanOptions: SearchableOption[] = [
    { value: '', label: 'Pilih pendidikan...' },
    ...masters.pendidikan.filter((p) => p.status_aktif).map((p) => ({ value: p.id, label: p.nama })),
  ];

  const pekerjaanOptions: SearchableOption[] = [
    { value: '', label: 'Pilih pekerjaan...' },
    ...masters.pekerjaan.filter((p) => p.status_aktif).map((p) => ({ value: p.id, label: p.nama })),
  ];

  const statusKeanggotaanOptions: SearchableOption[] = [
    { value: 'AKTIF', label: 'AKTIF' },
    { value: 'NONAKTIF', label: 'NONAKTIF' },
    { value: 'ARSIP', label: 'ARSIP' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/55 p-4 print:hidden">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 shrink-0">
          <div>
            <h3 className="text-base font-bold text-neutral-900">
              {isEdit ? `Edit Lengkap Anggota · ${member!.id_anggota}` : 'Tambah Anggota Keluarga Baru'}
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              {isEdit
                ? 'Seluruh perubahan identitas, keturunan, tanggal lahir, status kehidupan, dan domisili tercatat di Audit Log.'
                : 'Pilih relasi orang tua atau pasangan agar ID Anggota, Kode Silsilah, dan tingkat generasi di-generate otomatis tanpa salah input.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="p-1.5 text-neutral-500 hover:text-neutral-800 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 text-xs">
          {dupWarning && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-lg flex flex-wrap items-center justify-between gap-3">
              <span className="text-amber-900 font-medium">{dupWarning}</span>
              <button
                type="button"
                onClick={() => submitForm(true)}
                className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-md cursor-pointer"
              >
                Tetap Simpan Sebagai Anggota Baru
              </button>
            </div>
          )}

          {/* Bagian 0 (khusus Tambah Baru): Pilih Relasi & Auto-Generate Kode */}
          {!isEdit && (
            <section className="space-y-3 bg-neutral-50 border border-neutral-200 rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-2.5">
                <div className="flex items-center gap-2 font-bold text-green-800 uppercase tracking-wider text-xs">
                  <Link2 className="w-4 h-4" />
                  <span>0. Pilih Relasi Keluarga &amp; Generate Kode Otomatis</span>
                </div>
                <div className="inline-flex border border-neutral-300 rounded-lg overflow-hidden font-semibold">
                  {(
                    [
                      ['ANAK_DARI', 'Anak dari Orang Tua'],
                      ['PASANGAN_DARI', 'Pasangan / Menantu'],
                      ['MANUAL', 'Input Kode Manual'],
                    ] as [RelationType, string][]
                  ).map(([rt, label]) => (
                    <button
                      key={rt}
                      type="button"
                      onClick={() => setRelationType(rt)}
                      className={`px-3 py-1.5 cursor-pointer ${
                        relationType === rt ? 'bg-green-700 text-white' : 'bg-white text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {relationType === 'ANAK_DARI' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Pilih Ayah (Ketik untuk mencari)
                    </label>
                    <SearchableSelect
                      options={memberOptions}
                      value={relationAyahId}
                      onChange={handleSelectAyah}
                      placeholder="Ketik nama / kode Ayah..."
                      searchPlaceholder="Cari nama atau kode Ayah..."
                      allowClear
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Pilih Ibu (Ketik untuk mencari)
                    </label>
                    <SearchableSelect
                      options={memberOptions}
                      value={relationIbuId}
                      onChange={handleSelectIbu}
                      placeholder="Ketik nama / kode Ibu..."
                      searchPlaceholder="Cari nama atau kode Ibu..."
                      allowClear
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Jenis Hubungan Anak</label>
                    <SearchableSelect
                      options={[
                        { value: 'KANDUNG', label: 'Anak Kandung' },
                        { value: 'ANGKAT', label: 'Anak Angkat' },
                        { value: 'TIRI', label: 'Anak Tiri' },
                      ]}
                      value={relationJenisHub}
                      onChange={(v) => setRelationJenisHub((v || 'KANDUNG') as typeof relationJenisHub)}
                    />
                  </div>
                </div>
              )}

              {relationType === 'PASANGAN_DARI' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Pasangan dari Anggota <span className="text-red-600">*</span>
                    </label>
                    <SearchableSelect
                      options={memberOptions}
                      value={relationPasanganId}
                      onChange={setRelationPasanganId}
                      placeholder="Ketik nama / kode pasangan..."
                      searchPlaceholder="Cari nama atau kode anggota..."
                      allowClear
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Status Pernikahan</label>
                    <SearchableSelect
                      options={[
                        { value: 'MENIKAH', label: 'MENIKAH' },
                        { value: 'CERAI_HIDUP', label: 'CERAI HIDUP' },
                        { value: 'CERAI_MATI', label: 'CERAI MATI' },
                      ]}
                      value={relationStatusHub}
                      onChange={(v) => setRelationStatusHub((v || 'MENIKAH') as typeof relationStatusHub)}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Tanggal Menikah (opsional)</label>
                    <input
                      type="date"
                      value={relationTglNikah}
                      onChange={(e) => setRelationTglNikah(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="bg-white border border-neutral-200 rounded-lg px-3 py-2">
                  <div className="text-[11px] text-neutral-500">ID Anggota Permanen (Auto)</div>
                  <div className="font-mono font-bold text-green-800 text-sm mt-0.5 tabular-nums flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{nextIdPreview}</span>
                  </div>
                </div>
                <div className="bg-white border border-neutral-200 rounded-lg px-3 py-2">
                  <div className="text-[11px] text-neutral-500">Kode Silsilah Terbentuk</div>
                  <div className="font-mono font-bold text-neutral-900 text-sm mt-0.5 tabular-nums">
                    {form.kode_silsilah || (relationType === 'MANUAL' ? '(Manual di bawah)' : 'Pilih relasi di atas')}
                  </div>
                </div>
                <div className="bg-white border border-neutral-200 rounded-lg px-3 py-2">
                  <div className="text-[11px] text-neutral-500">Generasi &amp; Keturunan (Auto)</div>
                  <div className="font-semibold text-neutral-900 text-xs mt-1">
                    Gen {form.generasi_level} ({form.generasi_label}) · {form.status_keturunan}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Bagian 1: Identitas & Silsilah */}
          <section className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-green-800 border-b border-neutral-200 pb-1.5">
              1. Identitas &amp; Status Keturunan
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Kode Silsilah {isRelationAutoLocked && <span className="text-green-700">(Otomatis)</span>}
                </label>
                <input
                  type="text"
                  value={form.kode_silsilah}
                  readOnly={isRelationAutoLocked}
                  onChange={(e) => setForm({ ...form, kode_silsilah: e.target.value })}
                  placeholder="Misal: 1.2.3"
                  className={`w-full px-3 py-2 border border-neutral-300 rounded-lg font-mono ${
                    isRelationAutoLocked ? 'bg-neutral-100 text-neutral-700' : 'bg-white'
                  }`}
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Gelar Depan</label>
                <input
                  type="text"
                  value={form.gelar_depan}
                  onChange={(e) => setForm({ ...form, gelar_depan: e.target.value })}
                  placeholder="H. / Hj. / Dr."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-neutral-700 mb-1">
                  Nama Lengkap <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.nama_lengkap}
                  onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Gelar Belakang</label>
                <input
                  type="text"
                  value={form.gelar_belakang}
                  onChange={(e) => setForm({ ...form, gelar_belakang: e.target.value })}
                  placeholder="S.Kom., M.M."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Nama Panggilan</label>
                <input
                  type="text"
                  value={form.nama_panggilan}
                  onChange={(e) => setForm({ ...form, nama_panggilan: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Jenis Kelamin</label>
                <SearchableSelect
                  options={genderOptions}
                  value={form.jenis_kelamin}
                  onChange={(v) => setForm({ ...form, jenis_kelamin: v })}
                  placeholder="Pilih jenis kelamin..."
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Status Keturunan</label>
                <SearchableSelect
                  options={statusKeturunanOptions}
                  value={form.status_keturunan}
                  disabled={isRelationAutoLocked}
                  onChange={(v) => setForm({ ...form, status_keturunan: v })}
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Tingkatan Generasi</label>
                <SearchableSelect
                  options={generasiOptions}
                  value={String(form.generasi_level)}
                  disabled={isRelationAutoLocked}
                  onChange={(v) => {
                    const lv = parseInt(v, 10);
                    const g = masters.generasi.find((x) => (x.level_angka ?? x.urutan) === lv);
                    setForm({
                      ...form,
                      generasi_level: isNaN(lv) ? 1 : lv,
                      generasi_label: g?.nama || `Generasi-${lv}`,
                    });
                  }}
                />
              </div>
              {isEdit && (
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Kode Legacy CSV</label>
                  <input
                    type="text"
                    value={form.kode_legacy}
                    onChange={(e) => setForm({ ...form, kode_legacy: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg font-mono bg-neutral-50"
                  />
                </div>
              )}
              <div className="sm:col-span-4 bg-neutral-50 border border-neutral-200 rounded-lg p-3 flex flex-wrap items-center gap-4">
                <MemberAvatar
                  name={[form.gelar_depan, form.nama_lengkap, form.gelar_belakang].filter(Boolean).join(' ')}
                  photoValue={form.foto_drive_id}
                  size="lg"
                />
                <div className="flex-1 min-w-[220px] space-y-2">
                  <div className="font-semibold text-neutral-800">Foto Profil Anggota (Opsional)</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-800 bg-white border border-green-300 hover:bg-green-50 rounded-lg cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Pilih Foto dari Perangkat</span>
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
                            setForm((prev) => ({ ...prev, foto_drive_id: dataUrl }));
                          } catch (err) {
                            onNotify(err instanceof Error ? err.message : 'Gagal memproses foto.', 'error');
                          }
                        }}
                      />
                    </label>
                    <input
                      type="text"
                      value={form.foto_drive_id.startsWith('data:image/') ? '' : form.foto_drive_id}
                      onChange={(e) => setForm({ ...form, foto_drive_id: e.target.value })}
                      placeholder="Atau tempel URL foto / ID Google Drive..."
                      className="flex-1 min-w-[200px] px-3 py-1.5 border border-neutral-300 rounded-lg bg-white text-xs"
                    />
                    {form.foto_drive_id && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, foto_drive_id: '' })}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Bagian 2: Kelahiran & Status Kehidupan */}
          <section className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-green-800 border-b border-neutral-200 pb-1.5">
              2. Data Kelahiran &amp; Status Kehidupan
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Tempat Lahir</label>
                <input
                  type="text"
                  value={form.tempat_lahir}
                  onChange={(e) => setForm({ ...form, tempat_lahir: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Tanggal Lahir</label>
                <input
                  type="date"
                  value={form.tanggal_lahir}
                  onChange={(e) => setForm({ ...form, tanggal_lahir: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Status Kehidupan</label>
                <SearchableSelect
                  options={statusHidupOptions}
                  value={form.status_hidup}
                  onChange={(v) => setForm({ ...form, status_hidup: v as MemberRecord['status_hidup'] })}
                />
              </div>
            </div>

            {form.status_hidup === 'WAFAT' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-neutral-50 p-3.5 rounded-lg">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Tanggal Wafat</label>
                  <input
                    type="text"
                    value={form.tanggal_wafat}
                    onChange={(e) => setForm({ ...form, tanggal_wafat: e.target.value })}
                    placeholder="YYYY-MM-DD atau keterangan tgl"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Tempat Wafat / Makam</label>
                  <input
                    type="text"
                    value={form.tempat_wafat}
                    onChange={(e) => setForm({ ...form, tempat_wafat: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Keterangan Wafat</label>
                  <input
                    type="text"
                    value={form.catatan_wafat}
                    onChange={(e) => setForm({ ...form, catatan_wafat: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Bagian 3: Alamat Domisili Bertingkat */}
          <section className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-green-800 border-b border-neutral-200 pb-1.5">
              3. Alamat Domisili Wilayah Indonesia
            </h4>

            {/* Opsi Alamat Sama dengan Orang Tua */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-neutral-800">
                  <input
                    type="checkbox"
                    checked={sameAddressAsParent}
                    onChange={(e) => handleToggleSameAsParent(e.target.checked)}
                    className="rounded border-neutral-300 text-green-700 focus:ring-green-700"
                  />
                  <Home className="w-3.5 h-3.5 text-green-700" />
                  <span>Alamat sama dengan orang tua (isi otomatis)</span>
                </label>

                {availableParents.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {availableParents.map((p) => {
                      const isSelected = activeParentSource?.id_anggota === p.member.id_anggota;
                      return (
                        <button
                          key={p.member.id_anggota}
                          type="button"
                          onClick={() => {
                            setSameAddressAsParent(true);
                            setSelectedParentSourceId(p.member.id_anggota);
                            applyAddressFromParent(p.member);
                          }}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border cursor-pointer ${
                            sameAddressAsParent && isSelected
                              ? 'bg-green-700 text-white border-green-700'
                              : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                          }`}
                        >
                          {p.roleLabel}: {p.member.nama_lengkap}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {sameAddressAsParent && availableParents.length === 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center pt-1">
                  <div className="text-[11px] text-neutral-600">
                    Tautan orang tua belum tercatat. Pilih orang tua / keluarga sumber alamat:
                  </div>
                  <SearchableSelect
                    compact
                    options={memberOptions}
                    value={selectedParentSourceId}
                    onChange={(val) => {
                      setSelectedParentSourceId(val);
                      const chosen = allMembers.find((m) => m.id_anggota === val);
                      if (chosen) applyAddressFromParent(chosen);
                    }}
                    placeholder="Ketik nama orang tua / kepala keluarga..."
                    searchPlaceholder="Cari nama atau kode silsilah..."
                    allowClear
                  />
                </div>
              )}

              {activeParentSource && (
                <div className="text-[11px] text-neutral-600 bg-white border border-neutral-200 rounded-md px-3 py-1.5">
                  <span className="font-semibold text-neutral-800">Alamat {activeParentSource.nama_lengkap}: </span>
                  <span>{formatMemberAddressSummary(activeParentSource)}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Provinsi</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Pilih Provinsi...' },
                    ...provList.map((p) => ({ value: p.kode_wilayah, label: p.nama_wilayah })),
                  ]}
                  value={form.provinsi_id}
                  onChange={(val) =>
                    setForm({
                      ...form,
                      provinsi_id: val,
                      kabkota_id: '',
                      kecamatan_id: '',
                      kelurahan_id: '',
                    })
                  }
                  allowClear
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Kabupaten / Kota</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Pilih Kab/Kota...' },
                    ...kabList.map((k) => ({ value: k.kode_wilayah, label: k.nama_wilayah })),
                  ]}
                  value={form.kabkota_id}
                  disabled={!form.provinsi_id}
                  onChange={(val) => {
                    const sel = kabList.find((k) => k.kode_wilayah === val);
                    setForm({
                      ...form,
                      kabkota_id: val,
                      kecamatan_id: '',
                      kelurahan_id: '',
                      kode_pos: form.kode_pos || sel?.kode_pos_default || '',
                    });
                  }}
                  allowClear
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Kecamatan</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Pilih Kecamatan...' },
                    ...kecList.map((k) => ({ value: k.kode_wilayah, label: k.nama_wilayah })),
                  ]}
                  value={form.kecamatan_id}
                  disabled={!form.kabkota_id}
                  onChange={(val) => {
                    const sel = kecList.find((k) => k.kode_wilayah === val);
                    setForm({
                      ...form,
                      kecamatan_id: val,
                      kelurahan_id: '',
                      kode_pos: sel?.kode_pos_default || form.kode_pos,
                    });
                  }}
                  allowClear
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Desa / Kelurahan</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Pilih Desa/Kel...' },
                    ...desaList.map((k) => ({ value: k.kode_wilayah, label: k.nama_wilayah })),
                  ]}
                  value={form.kelurahan_id}
                  disabled={!form.kecamatan_id}
                  onChange={(val) => {
                    const sel = desaList.find((k) => k.kode_wilayah === val);
                    setForm({
                      ...form,
                      kelurahan_id: val,
                      kode_pos: sel?.kode_pos_default || form.kode_pos,
                    });
                  }}
                  allowClear
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <div className="col-span-2 sm:col-span-2">
                <label className="block font-semibold text-neutral-700 mb-1">Nama Jalan / Dusun</label>
                <input
                  type="text"
                  value={form.nama_jalan}
                  onChange={(e) => setForm({ ...form, nama_jalan: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">RT</label>
                <input
                  type="text"
                  value={form.rt}
                  onChange={(e) => setForm({ ...form, rt: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">RW</label>
                <input
                  type="text"
                  value={form.rw}
                  onChange={(e) => setForm({ ...form, rw: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">No. Rumah</label>
                <input
                  type="text"
                  value={form.no_rumah}
                  onChange={(e) => setForm({ ...form, no_rumah: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Kode Pos</label>
                <input
                  type="text"
                  value={form.kode_pos}
                  onChange={(e) => setForm({ ...form, kode_pos: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">
                Keterangan Alamat Lengkap / Patokan
              </label>
              <input
                type="text"
                value={form.keterangan_alamat}
                onChange={(e) => setForm({ ...form, keterangan_alamat: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
              />
            </div>
          </section>

          {/* Bagian 4: Kontak, Pendidikan, Pekerjaan & Administrasi */}
          <section className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-green-800 border-b border-neutral-200 pb-1.5">
              4. Kontak, Pendidikan, Pekerjaan &amp; Status Paguyuban
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Nomor HP / WhatsApp</label>
                <input
                  type="text"
                  value={form.no_hp}
                  onChange={(e) => setForm({ ...form, no_hp: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">HP Alternatif</label>
                <input
                  type="text"
                  value={form.no_hp_alt}
                  onChange={(e) => setForm({ ...form, no_hp_alt: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Pendidikan Terakhir</label>
                <SearchableSelect
                  options={pendidikanOptions}
                  value={form.pendidikan_id}
                  onChange={(v) => setForm({ ...form, pendidikan_id: v })}
                  allowClear
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Pekerjaan (Master)</label>
                <SearchableSelect
                  options={pekerjaanOptions}
                  value={form.pekerjaan_id}
                  onChange={(v) => setForm({ ...form, pekerjaan_id: v })}
                  allowClear
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Detail / Pekerjaan Lainnya</label>
                <input
                  type="text"
                  value={form.pekerjaan_lainnya}
                  onChange={(e) => setForm({ ...form, pekerjaan_lainnya: e.target.value })}
                  placeholder="Keterangan profesi atau instansi"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Status Keanggotaan</label>
                <SearchableSelect
                  options={statusKeanggotaanOptions}
                  value={form.status_keanggotaan}
                  onChange={(v) => setForm({ ...form, status_keanggotaan: v })}
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Tanggal Bergabung</label>
                <input
                  type="date"
                  value={form.tanggal_gabung}
                  onChange={(e) => setForm({ ...form, tanggal_gabung: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg font-mono"
                />
              </div>
              <div className="flex items-end gap-4 pb-2">
                <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-neutral-700">
                  <input
                    type="checkbox"
                    checked={form.is_kk}
                    onChange={(e) => setForm({ ...form, is_kk: e.target.checked })}
                    className="rounded border-neutral-300 text-green-700"
                  />
                  <span>Kepala Keluarga (KK)</span>
                </label>
                {isEdit && (
                  <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-neutral-700">
                    <input
                      type="checkbox"
                      checked={form.is_archived}
                      onChange={(e) => setForm({ ...form, is_archived: e.target.checked })}
                      className="rounded border-neutral-300 text-amber-700"
                    />
                    <span>Diarsipkan</span>
                  </label>
                )}
              </div>
            </div>
            <div>
              <label className="block font-semibold text-neutral-700 mb-1">Catatan Tambahan</label>
              <textarea
                rows={2}
                value={form.catatan}
                onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
              />
            </div>
          </section>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan Lengkap' : 'Tambah Anggota & Relasi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
