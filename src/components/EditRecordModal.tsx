import React, { useState } from 'react';
import { X } from 'lucide-react';

interface EditRecordModalProps {
  mode: 'STAGING' | 'MEMBER';
  recordId: string;
  memberName: string;
  initialKode?: string;
  initialTempat: string;
  initialTanggal: string;
  onClose: () => void;
  onSave: (payload: { generated_kode?: string; tempat_lahir: string; tanggal_lahir: string }) => Promise<void>;
}

export function EditRecordModal({
  mode,
  memberName,
  initialKode = '',
  initialTempat,
  initialTanggal,
  onClose,
  onSave,
}: EditRecordModalProps) {
  const [kode, setKode] = useState(initialKode);
  const [tempat, setTempat] = useState(initialTempat);
  const [tanggal, setTanggal] = useState(initialTanggal);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        generated_kode: mode === 'STAGING' ? kode : undefined,
        tempat_lahir: tempat,
        tanggal_lahir: tanggal,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-md p-6">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-200">
          <div>
            <h3 className="text-base font-bold text-neutral-900">Perbarui Data Anggota</h3>
            <p className="text-xs text-neutral-600 mt-0.5">{memberName || 'Anggota Tanpa Nama'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {mode === 'STAGING' && (
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Kode Silsilah (Hasil Generate / Manual)
              </label>
              <input
                type="text"
                value={kode}
                onChange={(e) => setKode(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Tempat Lahir
            </label>
            <input
              type="text"
              value={tempat}
              onChange={(e) => setTempat(e.target.value)}
              placeholder="Contoh: Banyumas"
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Tanggal Lahir (Date Picker)
            </label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
            />
            <p className="text-xs text-neutral-500 mt-1">
              Kosongkan jika tanggal lahir belum diketahui. Dapat diperbarui kapan saja dari menu Edit.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg cursor-pointer whitespace-nowrap"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 disabled:opacity-60 rounded-lg cursor-pointer whitespace-nowrap"
            >
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
