import React, { useEffect, useState } from 'react';
import { Download, KeyRound, UserPlus } from 'lucide-react';
import { AuditLogEntry, RoleId, SafeUser } from '../types';
import { SearchableSelect } from './SearchableSelect';

interface UsersAndAuditTabProps {
  token: string;
  mode: 'users' | 'audit';
  onNotify: (msg: string, kind?: 'success' | 'error') => void;
}

export function UsersAndAuditTab({ token, mode, onNotify }: UsersAndAuditTabProps) {
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<RoleId>('ADMIN_KELUARGA');
  const [password, setPassword] = useState('');
  const [resetTarget, setResetTarget] = useState<SafeUser | null>(null);
  const [tempPwd, setTempPwd] = useState('');

  async function loadUsers() {
    const res = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (res.ok && data.ok) setUsers(data.users);
    else onNotify(data.message || 'Gagal memuat pengguna.', 'error');
  }

  async function loadLogs() {
    const res = await fetch('/api/audit-logs', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (res.ok && data.ok) setLogs(data.logs);
    else onNotify(data.message || 'Gagal memuat audit log.', 'error');
  }

  useEffect(() => {
    if (mode === 'users') loadUsers();
    else loadLogs();
  }, [mode]);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        username_login: username,
        nama_tampilan: displayName,
        role_id: role,
        password,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      onNotify(data.message || 'Gagal menambah akun.', 'error');
      return;
    }
    setUsername('');
    setDisplayName('');
    setPassword('');
    onNotify('Akun baru berhasil dibuat.');
    await loadUsers();
  }

  async function toggleStatus(u: SafeUser) {
    const nextStatus = u.status_akun === 'AKTIF' ? 'NONAKTIF' : 'AKTIF';
    const res = await fetch(`/api/users/${u.user_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role_id: u.role_id, status_akun: nextStatus }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      onNotify(data.message || 'Gagal memperbarui status.', 'error');
      return;
    }
    onNotify(`Status akun ${u.username_login} diubah ke ${nextStatus}.`);
    await loadUsers();
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    const res = await fetch(`/api/users/${resetTarget.user_id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tempPassword: tempPwd }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      onNotify(data.message || 'Gagal reset password.', 'error');
      return;
    }
    setResetTarget(null);
    setTempPwd('');
    onNotify('Password akun berhasil direset.');
  }

  async function handleBackupDownload() {
    const res = await fetch('/api/backup', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      onNotify(data.message || 'Gagal membuat backup.', 'error');
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_bani_tohir_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('Backup JSON berhasil diunduh.');
    await loadLogs();
  }

  if (mode === 'audit') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-neutral-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-neutral-900">Backup &amp; Pemulihan Data</h2>
            <p className="text-xs text-neutral-600 mt-0.5">
              Unduh salinan lengkap data anggota, staging migrasi, pengguna, dan log audit dalam format JSON.
            </p>
          </div>
          <button
            type="button"
            onClick={handleBackupDownload}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Unduh Backup JSON</span>
          </button>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
          <h3 className="text-base font-bold text-neutral-900">Jejak Audit Sistem (AUDIT_LOG)</h3>
          <div className="overflow-x-auto border border-neutral-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                  <th className="py-2.5 px-3">Waktu (WIB)</th>
                  <th className="py-2.5 px-3">Pengguna</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Aksi</th>
                  <th className="py-2.5 px-3">Entitas</th>
                  <th className="py-2.5 px-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {logs.map((l) => (
                  <tr key={l.log_id} className="hover:bg-neutral-50">
                    <td className="py-2.5 px-3 font-mono tabular-nums text-neutral-600">{l.timestamp}</td>
                    <td className="py-2.5 px-3 font-medium text-neutral-900">{l.username}</td>
                    <td className="py-2.5 px-3 text-neutral-600">{l.role}</td>
                    <td className="py-2.5 px-3 font-mono text-green-800">{l.aksi}</td>
                    <td className="py-2.5 px-3">{l.entitas}</td>
                    <td className="py-2.5 px-3 text-neutral-700">{l.catatan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-neutral-200 rounded-xl p-5">
        <h2 className="text-base font-bold text-neutral-900 mb-4">Tambah Akun Pengurus / Anggota</h2>
        <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">ID Login</label>
            <input
              type="text"
              required
              minLength={4}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="min. 4 karakter"
              className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Nama Tampilan</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nama lengkap"
              className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Role</label>
            <SearchableSelect
              options={[
                { value: 'ADMIN_KELUARGA', label: 'ADMIN KELUARGA' },
                { value: 'PENGURUS', label: 'PENGURUS' },
                { value: 'BENDAHARA', label: 'BENDAHARA' },
                { value: 'SEKRETARIS', label: 'SEKRETARIS' },
                { value: 'ANGGOTA', label: 'ANGGOTA' },
                { value: 'SUPER_ADMIN', label: 'SUPER ADMIN' },
              ]}
              value={role}
              onChange={(val) => setRole((val || 'ADMIN_KELUARGA') as RoleId)}
              searchPlaceholder="Ketik nama role..."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Password Awal</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="min. 8 karakter"
              className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Buat Akun</span>
          </button>
        </form>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
        <h3 className="text-base font-bold text-neutral-900">Daftar Akun Terdaftar</h3>
        <div className="overflow-x-auto border border-neutral-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                <th className="py-2.5 px-3">ID User</th>
                <th className="py-2.5 px-3">ID Login</th>
                <th className="py-2.5 px-3">Nama</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Login Terakhir</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {users.map((u) => (
                <tr key={u.user_id} className="hover:bg-neutral-50">
                  <td className="py-2.5 px-3 font-mono tabular-nums">{u.user_id}</td>
                  <td className="py-2.5 px-3 font-mono">{u.username_login}</td>
                  <td className="py-2.5 px-3 font-medium">{u.nama_tampilan}</td>
                  <td className="py-2.5 px-3">{u.role_id.replace('_', ' ')}</td>
                  <td className="py-2.5 px-3 font-semibold text-neutral-800">{u.status_akun}</td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-neutral-600">{u.last_login || '-'}</td>
                  <td className="py-2.5 px-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => setResetTarget(u)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-neutral-300 rounded-md hover:bg-neutral-50 cursor-pointer"
                    >
                      <KeyRound className="w-3 h-3" />
                      <span>Reset Password</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleStatus(u)}
                      className="px-2.5 py-1 text-xs border border-neutral-300 rounded-md hover:bg-neutral-50 cursor-pointer"
                    >
                      {u.status_akun === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleResetPassword}
            className="bg-white border border-neutral-200 rounded-xl w-full max-w-sm p-6 space-y-4"
          >
            <h3 className="text-base font-bold text-neutral-900">
              Reset Password: {resetTarget.username_login}
            </h3>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Password Sementara (min. 8 karakter)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={tempPwd}
                onChange={(e) => setTempPwd(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="px-3.5 py-2 text-xs font-semibold border border-neutral-300 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-3.5 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
              >
                Simpan Reset
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
