import React, { useState } from 'react';
import { Lock, ShieldCheck, UserPlus } from 'lucide-react';
import { ModulePermission, SafeUser } from '../types';

interface LoginViewProps {
  needsSetup: boolean;
  serverTime: string;
  onAuthenticated: (token: string, user: SafeUser, permissions: Record<string, ModulePermission>) => void;
}

export function LoginView({ needsSetup, serverTime, onAuthenticated }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = needsSetup ? '/api/auth/setup-admin' : '/api/auth/login';
      const body = needsSetup
        ? { username, nama_tampilan: displayName, password }
        : { username, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || 'Proses autentikasi gagal.');
        return;
      }
      onAuthenticated(data.sessionToken, data.user, data.permissions);
    } catch {
      setError('Tidak dapat terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1fr_460px] bg-white">
      <section className="bg-green-800 text-white p-8 lg:p-14 flex flex-col justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wider text-yellow-300 uppercase">
            Paguyuban Keluarga Besar
          </p>
          <h1 className="mt-4 text-3xl lg:text-4xl font-bold leading-tight max-w-xl text-balance">
            Sistem Informasi Keluarga Besar Bani Haji Mohammad Tohir
          </h1>
          <p className="mt-4 text-green-100 text-base leading-relaxed max-w-xl">
            Guyub, Akur, Semedulur. Pusat data silsilah keluarga lintas generasi, pengelolaan rumah tangga, kepengurusan paguyuban, serta pencatatan keuangan yang aman dan transparan.
          </p>
        </div>

        <div className="mt-10 pt-6 border-t border-green-700 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-green-100">
          <span>Google Apps Script &amp; Spreadsheet</span>
          <span aria-hidden="true">·</span>
          <span>Zona Waktu Asia/Jakarta</span>
          {serverTime && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{serverTime}</span>
            </>
          )}
        </div>
      </section>

      <section className="p-8 lg:p-12 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-neutral-200 bg-white">
        <div className="max-w-sm w-full mx-auto">
          <div className="flex items-center gap-2.5 text-green-800 mb-3">
            {needsSetup ? <UserPlus className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            <span className="text-xs font-semibold tracking-wide text-neutral-600">
              {needsSetup ? 'Aktivasi Pertama Kali' : 'Akses Terlindungi'}
            </span>
          </div>

          <h2 className="text-2xl font-bold text-neutral-900">
            {needsSetup ? 'Buat Akun Super Admin' : 'Masuk ke Aplikasi'}
          </h2>
          <p className="mt-1.5 text-sm text-neutral-600">
            {needsSetup
              ? 'Belum ada akun administrator yang terdaftar. Daftarkan ID Login dan password pertama untuk mengelola sistem.'
              : 'Masukkan ID Login dan password yang telah terdaftar pada paguyuban.'}
          </p>

          {error && (
            <div role="alert" className="mt-5 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="login-username" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                ID Login
              </label>
              <input
                id="login-username"
                type="text"
                required
                minLength={4}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Contoh: admin.tohir"
                autoComplete="username"
                className="w-full px-3.5 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-green-700"
              />
            </div>

            {needsSetup && (
              <div>
                <label htmlFor="setup-display" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Nama Tampilan
                </label>
                <input
                  id="setup-display"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Contoh: Heri Setiawan"
                  className="w-full px-3.5 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-green-700"
                />
              </div>
            )}

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                minLength={needsSetup ? 8 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={needsSetup ? 'Minimal 8 karakter' : 'Masukkan password'}
                autoComplete={needsSetup ? 'new-password' : 'current-password'}
                className="w-full px-3.5 py-2.5 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-green-700"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Lock className="w-4 h-4" />
              <span>{loading ? 'Memproses...' : needsSetup ? 'Buat Akun Super Admin' : 'Masuk'}</span>
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
