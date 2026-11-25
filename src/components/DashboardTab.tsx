import React from 'react';
import { RefreshCw, ArrowRight } from 'lucide-react';
import { DashboardStats } from '../types';

interface DashboardTabProps {
  stats: DashboardStats | null;
  loading: boolean;
  onRefresh: () => void;
  onNavigate: (tab: 'migrasi' | 'anggota' | 'gas') => void;
}

export function DashboardTab({ stats, loading, onRefresh, onNavigate }: DashboardTabProps) {
  if (loading && !stats) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-neutral-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const genEntries = Object.entries(stats.perGenerasi);
  const cabEntries = Object.entries(stats.perCabang).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">Ringkasan Keluarga Besar</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600 mt-1">
            <span>
              {stats.isFromStaging
                ? 'Sumber sementara: Staging Migrasi Bani H. M. Tohir'
                : 'Sumber produksi: Tabel Anggota & Rumah Tangga'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{stats.serverTime}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Muat Ulang</span>
          </button>
          {stats.isFromStaging && (
            <button
              type="button"
              onClick={() => onNavigate('migrasi')}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <span>Tinjau &amp; Commit Migrasi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="text-xs font-medium text-neutral-500">Total Anggota Terdata</div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-neutral-900">
            {stats.totalAnggota}
          </div>
          <div className="mt-2 text-xs text-neutral-600 tabular-nums">
            {stats.kandung} Kandung · {stats.menantu} Menantu
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="text-xs font-medium text-neutral-500">Status Kehidupan</div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-neutral-900">
            {stats.hidup} <span className="text-base font-normal text-neutral-500">/ {stats.wafat}</span>
          </div>
          <div className="mt-2 text-xs text-neutral-600 tabular-nums">
            Hidup / Wafat · {stats.belumJelasHidup} belum ditandai
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="text-xs font-medium text-neutral-500">Kepala Keluarga &amp; Target Iuran</div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-green-800">
            {stats.kepalaKeluarga}
          </div>
          <div className="mt-2 text-xs text-neutral-600 font-mono tabular-nums">
            Target iuran: Rp {(stats.targetIuran ?? stats.totalIuran).toLocaleString('id-ID')}
          </div>
          <div className="mt-0.5 text-xs text-green-700 font-mono tabular-nums">
            Terealisasi: Rp {(stats.totalIuranTerbayar ?? 0).toLocaleString('id-ID')}
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="text-xs font-medium text-neutral-500">Perlu Lengkapi Tanggal Lahir</div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-amber-600">
            {stats.perluEditDob}
          </div>
          <div className="mt-2">
            <button
              type="button"
              onClick={() => onNavigate(stats.isFromStaging ? 'migrasi' : 'anggota')}
              className="text-xs font-semibold text-green-700 hover:underline cursor-pointer"
            >
              Perbarui lewat menu Edit
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-neutral-900 mb-4">Sebaran Anggota per Generasi</h3>
          <div className="space-y-3">
            {genEntries.map(([label, count]) => {
              const pct = stats.totalAnggota > 0 ? Math.round((count / stats.totalAnggota) * 100) : 0;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-neutral-700">{label}</span>
                    <span className="font-mono tabular-nums text-neutral-600">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-neutral-100 rounded overflow-hidden">
                    <div className="h-full bg-green-700 rounded" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-neutral-900 mb-4">Sebaran per Cabang Anak (1–9)</h3>
          <div className="space-y-3">
            {cabEntries.map(([label, count]) => {
              const pct = stats.totalAnggota > 0 ? Math.round((count / stats.totalAnggota) * 100) : 0;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-neutral-700">{label}</span>
                    <span className="font-mono tabular-nums text-neutral-600">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-neutral-100 rounded overflow-hidden">
                    <div className="h-full bg-amber-500 rounded" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
