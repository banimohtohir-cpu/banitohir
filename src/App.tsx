/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  Database,
  FileCode2,
  FileText,
  GitBranch,
  Home,
  KeyRound,
  Layers,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Shield,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { DashboardStats, MasterBundles, ModulePermission, SafeUser } from './types';
import { LoginView } from './components/LoginView';
import { DashboardTab } from './components/DashboardTab';
import { MigrationTab } from './components/MigrationTab';
import { MembersTab } from './components/MembersTab';
import { FamilyTreeTab } from './components/FamilyTreeTab';
import { HouseholdsTab } from './components/HouseholdsTab';
import { MasterDataTab } from './components/MasterDataTab';
import { FinanceTab } from './components/FinanceTab';
import { OrganizationTab } from './components/OrganizationTab';
import { DocumentsTab } from './components/DocumentsTab';
import { UsersAndAuditTab } from './components/UsersAndAuditTab';
import { GasCodeTab } from './components/GasCodeTab';

type TabId =
  | 'dashboard'
  | 'migrasi'
  | 'anggota'
  | 'silsilah'
  | 'rumah_tangga'
  | 'keuangan'
  | 'organisasi'
  | 'dokumen'
  | 'master'
  | 'users'
  | 'audit'
  | 'gas'
  | 'password';

const EMPTY_MASTERS: MasterBundles = {
  generasi: [],
  pendidikan: [],
  pekerjaan: [],
  wilayah: [],
};

export default function App() {
  const [bootLoading, setBootLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [serverTime, setServerTime] = useState('');

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [user, setUser] = useState<SafeUser | null>(null);
  const [permissions, setPermissions] = useState<Record<string, ModulePermission>>({});

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [masters, setMasters] = useState<MasterBundles>(EMPTY_MASTERS);
  const [treeFocusMemberId, setTreeFocusMemberId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: 'success' | 'error' } | null>(null);

  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');

  useEffect(() => {
    async function loadBootstrap() {
      try {
        const res = await fetch('/api/bootstrap');
        const data = await res.json();
        if (res.ok && data.ok) {
          setNeedsSetup(Boolean(data.needsSetup));
          setServerTime(data.nowDisplay || '');
        }
      } finally {
        setBootLoading(false);
      }
    }
    loadBootstrap();
  }, []);

  function notify(msg: string, kind: 'success' | 'error' = 'success') {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 5000);
  }

  async function fetchDashboard(tokenStr: string) {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/dashboard', {
        headers: { Authorization: `Bearer ${tokenStr}` },
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStats(data.stats);
      }
    } finally {
      setStatsLoading(false);
    }
  }

  async function fetchMasters(tokenStr: string) {
    const res = await fetch('/api/master/bundles', {
      headers: { Authorization: `Bearer ${tokenStr}` },
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      setMasters({
        generasi: data.generasi || [],
        pendidikan: data.pendidikan || [],
        pekerjaan: data.pekerjaan || [],
        wilayah: data.wilayah || [],
      });
    }
  }

  function handleAuthenticated(
    token: string,
    authUser: SafeUser,
    perms: Record<string, ModulePermission>
  ) {
    setSessionToken(token);
    setUser(authUser);
    setPermissions(perms || {});
    setNeedsSetup(false);
    setActiveTab('dashboard');
    fetchDashboard(token);
    fetchMasters(token);
  }

  async function handleLogout() {
    if (sessionToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
    }
    setSessionToken(null);
    setUser(null);
    setPermissions({});
    setStats(null);
    setMasters(EMPTY_MASTERS);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionToken) return;
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      notify(data.message || 'Gagal mengganti password.', 'error');
      return;
    }
    setOldPwd('');
    setNewPwd('');
    notify('Password berhasil diperbarui.');
  }

  if (bootLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100 text-sm text-neutral-600">
        Memuat Sistem Informasi Bani Haji Mohammad Tohir...
      </div>
    );
  }

  if (!sessionToken || !user) {
    return (
      <LoginView
        needsSetup={needsSetup}
        serverTime={serverTime}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  const navItems: { id: TabId; label: string; icon: React.ReactNode; visible: boolean }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      visible: true,
    },
    {
      id: 'anggota',
      label: 'Data Anggota',
      icon: <Users className="w-4 h-4" />,
      visible: Boolean(permissions.ANGGOTA?.can_view),
    },
    {
      id: 'silsilah',
      label: 'Silsilah Keluarga',
      icon: <GitBranch className="w-4 h-4" />,
      visible: Boolean(permissions.SILSILAH?.can_view),
    },
    {
      id: 'rumah_tangga',
      label: 'Rumah Tangga (KK)',
      icon: <Home className="w-4 h-4" />,
      visible: Boolean(permissions.RUMAH_TANGGA?.can_view),
    },
    {
      id: 'keuangan',
      label: 'Keuangan & Iuran',
      icon: <Wallet className="w-4 h-4" />,
      visible: Boolean(permissions.KEUANGAN?.can_view),
    },
    {
      id: 'organisasi',
      label: 'Kegiatan & Info',
      icon: <Megaphone className="w-4 h-4" />,
      visible: Boolean(permissions.ORGANISASI?.can_view),
    },
    {
      id: 'dokumen',
      label: 'Surat & Arsip',
      icon: <FileText className="w-4 h-4" />,
      visible: Boolean(permissions.SURAT?.can_view),
    },
    {
      id: 'master',
      label: 'Master Data',
      icon: <Layers className="w-4 h-4" />,
      visible: Boolean(permissions.PENGATURAN?.can_view),
    },
    {
      id: 'migrasi',
      label: 'Migrasi & Staging',
      icon: <Database className="w-4 h-4" />,
      visible: Boolean(permissions.MIGRASI?.can_view),
    },
    {
      id: 'users',
      label: 'Akun & Hak Akses',
      icon: <Shield className="w-4 h-4" />,
      visible: Boolean(permissions.USERS?.can_view),
    },
    {
      id: 'audit',
      label: 'Audit Log & Backup',
      icon: <ClipboardList className="w-4 h-4" />,
      visible: Boolean(permissions.AUDIT_LOG?.can_view),
    },
    {
      id: 'gas',
      label: 'Kode GAS (Tahap 2–4)',
      icon: <FileCode2 className="w-4 h-4" />,
      visible: true,
    },
    {
      id: 'password',
      label: 'Ganti Password',
      icon: <KeyRound className="w-4 h-4" />,
      visible: true,
    },
  ];

  const breadcrumbLabels: Record<TabId, string> = {
    dashboard: 'Beranda / Dashboard',
    anggota: 'Keluarga / Data Anggota & Edit Lengkap',
    silsilah: 'Keluarga / Silsilah Multi-Pasangan',
    rumah_tangga: 'Keluarga / Rumah Tangga & Kepala Keluarga',
    keuangan: 'Keuangan / Akuntansi Double-Entry & Target Iuran',
    organisasi: 'Paguyuban / Pengumuman, Pengurus & Kegiatan',
    dokumen: 'Sekretariat / Surat Resmi, Undangan & Arsip',
    master: 'Pengaturan / Master Data Dinamis',
    migrasi: 'Database / Migrasi & Staging',
    users: 'Keamanan / Akun Pengguna & Hak Akses',
    audit: 'Sistem / Audit Log & Backup',
    gas: 'Google Apps Script / Berkas Tahap 2–4',
    password: 'Akun / Ganti Password',
  };

  return (
    <div className="min-h-screen flex bg-neutral-100">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-green-800 text-white flex-col shrink-0 print:hidden">
        <div className="p-5 border-b border-green-700">
          <div className="text-sm font-bold tracking-tight">Bani H. M. Tohir</div>
          <div className="text-xs text-yellow-300 mt-0.5">Guyub, Akur, Semedulur</div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems
            .filter((n) => n.visible)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === item.id
                    ? 'bg-white text-green-900'
                    : 'text-green-100 hover:bg-green-700/70 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
        </nav>

        <div className="p-4 border-t border-green-700 text-xs">
          <div className="font-semibold text-white truncate">{user.nama_tampilan}</div>
          <div className="text-yellow-300 mt-0.5">{user.role_id.replace('_', ' ')}</div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 md:hidden print:hidden">
          <div className="w-64 h-full bg-green-800 text-white p-4 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-green-700">
              <div>
                <div className="text-sm font-bold">Bani H. M. Tohir</div>
                <div className="text-xs text-yellow-300">Guyub, Akur, Semedulur</div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Tutup menu"
                className="p-1.5 rounded-lg hover:bg-green-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="mt-4 space-y-1 flex-1 overflow-y-auto">
              {navItems
                .filter((n) => n.visible)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-lg cursor-pointer ${
                      activeTab === item.id ? 'bg-white text-green-900' : 'text-green-100 hover:bg-green-700'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
            </nav>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-neutral-200 px-4 lg:px-8 py-3.5 flex items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka navigasi"
              className="md:hidden p-2 rounded-lg border border-neutral-200 text-neutral-700 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-xs sm:text-sm font-semibold text-neutral-700 truncate">
              {breadcrumbLabels[activeTab]}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs text-neutral-500">
              {user.nama_tampilan} · {user.role_id.replace('_', ' ')}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-[1360px] w-full mx-auto space-y-5">
          {toast && (
            <div
              role="status"
              className={`p-3.5 rounded-lg border text-xs font-medium print:hidden ${
                toast.kind === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-green-50 border-green-200 text-green-800'
              }`}
            >
              {toast.msg}
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardTab
              stats={stats}
              loading={statsLoading}
              onRefresh={() => fetchDashboard(sessionToken)}
              onNavigate={(t) => setActiveTab(t)}
            />
          )}

          {activeTab === 'migrasi' && (
            <MigrationTab
              token={sessionToken}
              onCommitted={() => {
                fetchDashboard(sessionToken);
                setActiveTab('anggota');
              }}
              onNotify={notify}
            />
          )}

          {activeTab === 'anggota' && permissions.ANGGOTA && (
            <MembersTab
              token={sessionToken}
              permission={permissions.ANGGOTA}
              masters={masters}
              onGoToMigration={() => setActiveTab('migrasi')}
              onOpenTreeFocus={(memberId) => {
                setTreeFocusMemberId(memberId);
                setActiveTab('silsilah');
              }}
              onNotify={notify}
            />
          )}

          {activeTab === 'silsilah' && permissions.SILSILAH && (
            <FamilyTreeTab
              token={sessionToken}
              permission={permissions.SILSILAH}
              memberEditAllowed={Boolean(permissions.ANGGOTA?.can_edit)}
              masters={masters}
              initialFocusMemberId={treeFocusMemberId}
              onNotify={notify}
            />
          )}

          {activeTab === 'rumah_tangga' && permissions.RUMAH_TANGGA && (
            <HouseholdsTab
              token={sessionToken}
              permission={permissions.RUMAH_TANGGA}
              onNotify={notify}
            />
          )}

          {activeTab === 'keuangan' && permissions.KEUANGAN && (
            <FinanceTab
              token={sessionToken}
              permission={permissions.KEUANGAN}
              onDataChanged={() => fetchDashboard(sessionToken)}
              onNotify={notify}
            />
          )}

          {activeTab === 'organisasi' && permissions.ORGANISASI && (
            <OrganizationTab token={sessionToken} onNotify={notify} />
          )}

          {activeTab === 'dokumen' && permissions.SURAT && (
            <DocumentsTab token={sessionToken} onNotify={notify} />
          )}

          {activeTab === 'master' && (
            <MasterDataTab
              token={sessionToken}
              masters={masters}
              canEdit={Boolean(permissions.PENGATURAN?.can_edit)}
              onRefreshMasters={() => fetchMasters(sessionToken)}
              onNotify={notify}
            />
          )}

          {(activeTab === 'users' || activeTab === 'audit') && (
            <UsersAndAuditTab token={sessionToken} mode={activeTab} onNotify={notify} />
          )}

          {activeTab === 'gas' && <GasCodeTab token={sessionToken} onNotify={notify} />}

          {activeTab === 'password' && (
            <div className="bg-white border border-neutral-200 rounded-xl p-6 max-w-md">
              <h2 className="text-base font-bold text-neutral-900">Ganti Password Akun</h2>
              <p className="text-xs text-neutral-600 mt-1">
                Minimal 8 karakter. Perubahan akan tercatat pada audit log sistem.
              </p>
              <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Password Lama
                  </label>
                  <input
                    type="password"
                    required
                    value={oldPwd}
                    onChange={(e) => setOldPwd(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Password Baru
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
                >
                  Simpan Password Baru
                </button>
              </form>
            </div>
          )}
        </main>

        <footer className="bg-white border-t border-neutral-200 px-4 lg:px-8 py-3.5 text-xs text-neutral-500 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <span>Sistem Informasi Keluarga Besar Bani Haji Mohammad Tohir · Guyub, Akur, Semedulur</span>
          <span>Tahap 4: Keuangan Double-Entry, Target Iuran, Kegiatan, Surat &amp; Arsip</span>
        </footer>
      </div>
    </div>
  );
}
