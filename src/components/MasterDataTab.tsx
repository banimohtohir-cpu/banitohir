import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { MasterBundles, WilayahItem } from '../types';
import { SearchableSelect } from './SearchableSelect';

interface MasterDataTabProps {
  token: string;
  masters: MasterBundles;
  canEdit: boolean;
  onRefreshMasters: () => void;
  onNotify: (msg: string, kind?: 'success' | 'error') => void;
}

type MasterKind = 'GENERASI' | 'PENDIDIKAN' | 'PEKERJAAN' | 'WILAYAH';

export function MasterDataTab({
  token,
  masters,
  canEdit,
  onRefreshMasters,
  onNotify,
}: MasterDataTabProps) {
  const [kind, setKind] = useState<MasterKind>('GENERASI');
  const [nama, setNama] = useState('');
  const [urutan, setUrutan] = useState(1);
  const [levelAngka, setLevelAngka] = useState(1);

  const [wilForm, setWilForm] = useState({
    kode_wilayah: '',
    tingkat: 'KAB' as WilayahItem['tingkat'],
    kode_induk: '',
    nama_wilayah: '',
    kode_pos_default: '',
  });

  async function handleAddSimple(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/master/${kind}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        nama,
        urutan,
        ...(kind === 'GENERASI' ? { level_angka: levelAngka } : {}),
        status_aktif: true,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      onNotify(data.message || 'Gagal menyimpan item master.', 'error');
      return;
    }
    setNama('');
    onNotify(`Master ${kind} berhasil diperbarui.`);
    onRefreshMasters();
  }

  async function handleAddWilayah(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/master/WILAYAH', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(wilForm),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      onNotify(data.message || 'Gagal menyimpan wilayah.', 'error');
      return;
    }
    setWilForm({
      kode_wilayah: '',
      tingkat: 'KAB',
      kode_induk: '',
      nama_wilayah: '',
      kode_pos_default: '',
    });
    onNotify('Data wilayah berhasil disimpan ke master cache.');
    onRefreshMasters();
  }

  const currentSimple =
    kind === 'GENERASI'
      ? masters.generasi
      : kind === 'PENDIDIKAN'
      ? masters.pendidikan
      : masters.pekerjaan;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Master Data Dinamis</h2>
          <p className="text-xs text-neutral-600 mt-0.5">
            Atur istilah generasi, jenjang pendidikan, pekerjaan, serta cache wilayah administratif Indonesia.
          </p>
        </div>

        <div className="inline-flex border border-neutral-300 rounded-lg overflow-hidden text-xs font-semibold">
          {(['GENERASI', 'PENDIDIKAN', 'PEKERJAAN', 'WILAYAH'] as MasterKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`px-3 py-1.5 cursor-pointer ${
                kind === k ? 'bg-green-700 text-white' : 'bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {kind === 'WILAYAH' ? (
        <div className="space-y-4">
          {canEdit && (
            <form onSubmit={handleAddWilayah} className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 bg-neutral-50 p-3.5 rounded-lg text-xs">
              <input
                type="text"
                required
                value={wilForm.kode_wilayah}
                onChange={(e) => setWilForm({ ...wilForm, kode_wilayah: e.target.value })}
                placeholder="Kode (cth 3302)"
                className="px-2.5 py-1.5 border border-neutral-300 rounded-lg bg-white font-mono"
              />
              <SearchableSelect
                options={[
                  { value: 'PROV', label: 'PROV' },
                  { value: 'KAB', label: 'KAB' },
                  { value: 'KEC', label: 'KEC' },
                  { value: 'DESA', label: 'DESA' },
                ]}
                value={wilForm.tingkat}
                onChange={(val) => setWilForm({ ...wilForm, tingkat: (val || 'KAB') as WilayahItem['tingkat'] })}
                searchPlaceholder="Cari tingkat..."
                compact
              />
              <input
                type="text"
                value={wilForm.kode_induk}
                onChange={(e) => setWilForm({ ...wilForm, kode_induk: e.target.value })}
                placeholder="Kode Induk"
                className="px-2.5 py-1.5 border border-neutral-300 rounded-lg bg-white font-mono"
              />
              <input
                type="text"
                required
                value={wilForm.nama_wilayah}
                onChange={(e) => setWilForm({ ...wilForm, nama_wilayah: e.target.value })}
                placeholder="Nama Wilayah"
                className="px-2.5 py-1.5 border border-neutral-300 rounded-lg bg-white"
              />
              <input
                type="text"
                value={wilForm.kode_pos_default}
                onChange={(e) => setWilForm({ ...wilForm, kode_pos_default: e.target.value })}
                placeholder="Kode Pos"
                className="px-2.5 py-1.5 border border-neutral-300 rounded-lg bg-white font-mono"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1 px-3 py-1.5 font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Simpan</span>
              </button>
            </form>
          )}

          <div className="overflow-x-auto border border-neutral-200 rounded-lg max-h-96 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                  <th className="py-2 px-3">Tingkat</th>
                  <th className="py-2 px-3">Kode</th>
                  <th className="py-2 px-3">Induk</th>
                  <th className="py-2 px-3">Nama Wilayah</th>
                  <th className="py-2 px-3">Kode Pos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {masters.wilayah.map((w) => (
                  <tr key={`${w.tingkat}-${w.kode_wilayah}`}>
                    <td className="py-2 px-3 font-mono text-green-800 font-semibold">{w.tingkat}</td>
                    <td className="py-2 px-3 font-mono tabular-nums">{w.kode_wilayah}</td>
                    <td className="py-2 px-3 font-mono text-neutral-500">{w.kode_induk || '-'}</td>
                    <td className="py-2 px-3 font-medium text-neutral-900">{w.nama_wilayah}</td>
                    <td className="py-2 px-3 font-mono text-neutral-600">{w.kode_pos_default || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {canEdit && (
            <form onSubmit={handleAddSimple} className="flex flex-wrap items-center gap-2.5 bg-neutral-50 p-3.5 rounded-lg text-xs">
              <input
                type="text"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder={`Nama item ${kind.toLowerCase()} baru...`}
                className="px-3 py-1.5 border border-neutral-300 rounded-lg bg-white flex-1 min-w-[220px]"
              />
              {kind === 'GENERASI' && (
                <input
                  type="number"
                  value={levelAngka}
                  onChange={(e) => setLevelAngka(parseInt(e.target.value, 10) || 0)}
                  placeholder="Level"
                  className="w-24 px-3 py-1.5 border border-neutral-300 rounded-lg bg-white font-mono"
                />
              )}
              <input
                type="number"
                value={urutan}
                onChange={(e) => setUrutan(parseInt(e.target.value, 10) || 1)}
                placeholder="Urutan"
                className="w-24 px-3 py-1.5 border border-neutral-300 rounded-lg bg-white font-mono"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Item</span>
              </button>
            </form>
          )}

          <div className="overflow-x-auto border border-neutral-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                  <th className="py-2 px-3">ID</th>
                  <th className="py-2 px-3">Urutan</th>
                  {kind === 'GENERASI' && <th className="py-2 px-3">Level</th>}
                  <th className="py-2 px-3">Nama</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {currentSimple.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 px-3 font-mono text-neutral-600">{item.id}</td>
                    <td className="py-2 px-3 font-mono tabular-nums">{item.urutan}</td>
                    {kind === 'GENERASI' && (
                      <td className="py-2 px-3 font-mono tabular-nums text-green-800 font-semibold">
                        {item.level_angka ?? item.urutan}
                      </td>
                    )}
                    <td className="py-2 px-3 font-medium text-neutral-900">{item.nama}</td>
                    <td className="py-2 px-3 text-neutral-600">{item.status_aktif ? 'Aktif' : 'Nonaktif'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
