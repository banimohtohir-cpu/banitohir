import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import {
  AppStore,
  hashPassword,
  MemberRecord,
  nowJakartaDisplay,
  nowJakartaIso,
  projectSafeUser,
  ROLE_MATRIX,
  RoleId,
  SafeUser,
  UserRecord,
  verifyPassword,
} from './server/store.ts';
import {
  findRelationshipBetween,
  HouseholdMemberRecord,
  HouseholdRecord,
  isAncestor,
  KkHistoryRecord,
  ParentChildRelation,
  recalculateGenerations,
  SimpleMasterItem,
  SpouseRelation,
  WilayahItem,
} from './server/stage3.ts';
import {
  AnggaranRecord,
  ArsipRecord,
  CoaAccount,
  JurnalEntry,
  KegiatanRecord,
  PembayaranRecord,
  PengumumanRecord,
  PengurusRecord,
  SuratRecord,
  TagihanIuranRecord,
  TarifIuranRecord,
  TransaksiRecord,
  UndanganRecord,
} from './server/stage4.ts';

const store = new AppStore();
const SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface AuthedRequest extends Request {
  authUser?: SafeUser;
}

function getTokenFromHeader(req: Request): string {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return '';
}

function genId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function isSafeHttpUrl(url: string): boolean {
  if (!url) return true;
  return /^https?:\/\//i.test(url.trim());
}

function sanitizePhotoInput(raw: unknown): string {
  const val = String(raw ?? '').trim();
  if (!val) return '';
  if (/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(val) && val.length <= 450000) {
    return val;
  }
  if (/^https?:\/\/.+/i.test(val) && val.length <= 1500) {
    return val;
  }
  if (/^[A-Za-z0-9_-]{10,80}$/.test(val)) {
    return val;
  }
  return '';
}

function formatMemberAddress(m: MemberRecord): string {
  const wilayahMap = new Map(store.masterWilayah.map((w) => [`${w.tingkat}:${w.kode_wilayah}`, w.nama_wilayah]));
  const streetParts = [
    m.nama_jalan,
    m.no_rumah ? `No. ${m.no_rumah}` : '',
    m.rt || m.rw ? `RT ${m.rt || '-'}/RW ${m.rw || '-'}` : '',
  ].filter(Boolean);
  const regionParts = [
    m.kelurahan_id ? wilayahMap.get(`DESA:${m.kelurahan_id}`) : '',
    m.kecamatan_id ? wilayahMap.get(`KEC:${m.kecamatan_id}`) : '',
    m.kabkota_id ? wilayahMap.get(`KAB:${m.kabkota_id}`) : '',
    m.provinsi_id ? wilayahMap.get(`PROV:${m.provinsi_id}`) : '',
  ].filter(Boolean);
  const structured = [...streetParts, ...regionParts, m.kode_pos].filter(Boolean).join(', ');
  if (m.keterangan_alamat && structured) {
    return m.keterangan_alamat.toLowerCase() === structured.toLowerCase()
      ? m.keterangan_alamat
      : `${m.keterangan_alamat} (${structured})`;
  }
  return m.keterangan_alamat || structured || '';
}

function projectMemberForRole(m: MemberRecord, canSensitive: boolean): MemberRecord {
  if (canSensitive) return m;
  return {
    ...m,
    no_hp: m.no_hp ? '•••• (Terbatas)' : '',
    no_hp_alt: '',
    email: '',
    nama_jalan: '',
    rt: '',
    rw: '',
    no_rumah: '',
    keterangan_alamat: '',
  };
}

function requireAuth(moduleName?: string, action?: keyof (typeof ROLE_MATRIX)['SUPER_ADMIN'][string]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const token = getTokenFromHeader(req);
    if (!token) {
      res.status(401).json({ ok: false, message: 'Sesi tidak ditemukan. Silakan login.' });
      return;
    }
    const sess = store.sessions.get(token);
    if (!sess || Date.now() - sess.created_ms > SESSION_TTL_MS) {
      store.sessions.delete(token);
      res.status(401).json({ ok: false, message: 'Sesi berakhir. Silakan login kembali.' });
      return;
    }
    const dbUser = store.users.find((u) => u.user_id === sess.user_id);
    if (!dbUser || dbUser.status_akun !== 'AKTIF') {
      res.status(403).json({ ok: false, message: 'Akun pengguna tidak aktif.' });
      return;
    }
    sess.created_ms = Date.now();
    if (moduleName && action) {
      const mod = ROLE_MATRIX[dbUser.role_id]?.[moduleName];
      if (!mod || !mod[action]) {
        store.addAudit(dbUser, 'AKSES_DITOLAK', moduleName, '', `Mencoba akses ${action}`);
        res.status(403).json({ ok: false, message: `Anda tidak memiliki izin pada modul ${moduleName}.` });
        return;
      }
    }
    req.authUser = projectSafeUser(dbUser);
    next();
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/bootstrap', (_req, res) => {
    const hasSuperAdmin = store.users.some((u) => u.role_id === 'SUPER_ADMIN' && u.status_akun === 'AKTIF');
    res.json({
      ok: true,
      needsSetup: !hasSuperAdmin,
      appName: 'Sistem Informasi Keluarga Besar Bani Haji Mohammad Tohir',
      tagline: 'Guyub, Akur, Semedulur',
      nowDisplay: nowJakartaDisplay(),
    });
  });

  app.post('/api/auth/setup-admin', (req, res) => {
    const hasSuperAdmin = store.users.some((u) => u.role_id === 'SUPER_ADMIN' && u.status_akun === 'AKTIF');
    if (hasSuperAdmin) {
      res.status(409).json({ ok: false, message: 'Akun Super Admin sudah terdaftar. Gunakan login biasa.' });
      return;
    }
    const username = String(req.body?.username || '').trim().toLowerCase();
    const nama = String(req.body?.nama_tampilan || '').trim() || 'Super Admin Bani Tohir';
    const password = String(req.body?.password || '');

    if (username.length < 4) {
      res.status(400).json({ ok: false, message: 'ID Login minimal 4 karakter.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ ok: false, message: 'Password minimal 8 karakter.' });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const now = nowJakartaIso();
    const newUser: UserRecord = {
      user_id: 'USR-0001',
      id_anggota: '',
      username_login: username,
      nama_tampilan: nama,
      password_hash: hashPassword(password, salt),
      salt,
      role_id: 'SUPER_ADMIN',
      status_akun: 'AKTIF',
      failed_attempts: 0,
      locked_until: '',
      last_login: now,
      must_change_pwd: false,
      created_at: now,
      updated_at: now,
    };

    store.users.push(newUser);
    const token = crypto.randomBytes(32).toString('hex');
    store.sessions.set(token, { user_id: newUser.user_id, created_ms: Date.now() });
    store.addAudit(newUser, 'BOOTSTRAP_ADMIN', 'USERS', newUser.user_id, 'Klaim akun Super Admin pertama');

    res.json({
      ok: true,
      sessionToken: token,
      user: projectSafeUser(newUser),
      permissions: ROLE_MATRIX[newUser.role_id],
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!username || !password) {
      res.status(400).json({ ok: false, message: 'ID Login dan password wajib diisi.' });
      return;
    }

    const user = store.users.find((u) => u.username_login === username);
    if (!user) {
      store.addAudit({ user_id: 'GUEST', username_login: username, role_id: 'GUEST' }, 'LOGIN_GAGAL', 'AUTH', username, 'ID Login tidak ditemukan');
      res.status(401).json({ ok: false, message: 'ID Login atau password tidak sesuai.' });
      return;
    }
    if (user.status_akun !== 'AKTIF') {
      res.status(403).json({ ok: false, message: 'Akun sedang dinonaktifkan oleh Admin.' });
      return;
    }
    if (user.locked_until) {
      const unlockMs = new Date(user.locked_until).getTime();
      if (!isNaN(unlockMs) && Date.now() < unlockMs) {
        const mins = Math.ceil((unlockMs - Date.now()) / 60000);
        res.status(429).json({ ok: false, message: `Akun terkunci sementara. Coba lagi dalam ${mins} menit.` });
        return;
      }
    }

    if (!verifyPassword(password, user.salt, user.password_hash)) {
      user.failed_attempts = (user.failed_attempts || 0) + 1;
      user.updated_at = nowJakartaIso();
      if (user.failed_attempts >= MAX_LOGIN_ATTEMPTS) {
        user.locked_until = new Date(Date.now() + LOCKOUT_MS).toISOString();
      }
      store.addAudit(user, 'LOGIN_GAGAL', 'AUTH', user.user_id, `Password salah (${user.failed_attempts}x)`);
      res.status(401).json({ ok: false, message: 'ID Login atau password tidak sesuai.' });
      return;
    }

    user.failed_attempts = 0;
    user.locked_until = '';
    user.last_login = nowJakartaIso();
    user.updated_at = user.last_login;
    const token = crypto.randomBytes(32).toString('hex');
    store.sessions.set(token, { user_id: user.user_id, created_ms: Date.now() });
    store.addAudit(user, 'LOGIN', 'AUTH', user.user_id, 'Login berhasil');

    res.json({
      ok: true,
      sessionToken: token,
      user: projectSafeUser(user),
      permissions: ROLE_MATRIX[user.role_id],
    });
  });

  app.post('/api/auth/logout', (req: AuthedRequest, res) => {
    const token = getTokenFromHeader(req);
    if (token) {
      const sess = store.sessions.get(token);
      if (sess) {
        const u = store.users.find((x) => x.user_id === sess.user_id);
        if (u) store.addAudit(u, 'LOGOUT', 'AUTH', u.user_id, 'Logout pengguna');
      }
      store.sessions.delete(token);
    }
    res.json({ ok: true });
  });

  app.post('/api/auth/change-password', requireAuth(), (req: AuthedRequest, res) => {
    const oldPwd = String(req.body?.oldPassword || '');
    const newPwd = String(req.body?.newPassword || '');
    if (newPwd.length < 8) {
      res.status(400).json({ ok: false, message: 'Password baru minimal 8 karakter.' });
      return;
    }
    const dbUser = store.users.find((u) => u.user_id === req.authUser?.user_id);
    if (!dbUser || !verifyPassword(oldPwd, dbUser.salt, dbUser.password_hash)) {
      res.status(400).json({ ok: false, message: 'Password lama tidak sesuai.' });
      return;
    }
    const newSalt = crypto.randomBytes(16).toString('hex');
    dbUser.salt = newSalt;
    dbUser.password_hash = hashPassword(newPwd, newSalt);
    dbUser.must_change_pwd = false;
    dbUser.updated_at = nowJakartaIso();
    store.addAudit(dbUser, 'GANTI_PASSWORD', 'USERS', dbUser.user_id, 'Pengguna mengubah password sendiri');
    res.json({ ok: true, message: 'Password berhasil diperbarui.' });
  });

  app.get('/api/dashboard', requireAuth('DASHBOARD', 'can_view'), (_req, res) => {
    const hasCommitted = store.members.length > 0;
    const rows = hasCommitted
      ? store.members.filter((m) => m.id_anggota !== 'BMT-0000' && !m.is_archived)
      : store.staging.filter((s) => s.action_status === 'SIAP' && s.nama_lengkap);

    let kandung = 0;
    let menantu = 0;
    let hidup = 0;
    let wafat = 0;
    let belumJelasHidup = 0;
    let kk = 0;
    let needEditDob = 0;
    let totalIuran = 0;
    const perGenerasi: Record<string, number> = {};
    const perCabang: Record<string, number> = {};

    rows.forEach((r) => {
      if (r.status_keturunan === 'Menantu') menantu++;
      else kandung++;

      if (r.status_hidup === 'WAFAT') wafat++;
      else if (r.status_hidup === 'HIDUP') hidup++;
      else belumJelasHidup++;

      if (r.is_kk) kk++;
      totalIuran += r.iuran_nominal || 0;

      const tgl = 'tanggal_lahir' in r ? r.tanggal_lahir : r.tanggal_lahir_iso;
      if (r.presisi_tgl_lahir === 'PERLU_EDIT' || !tgl) needEditDob++;

      const gen = r.generasi_label || 'Lainnya';
      perGenerasi[gen] = (perGenerasi[gen] || 0) + 1;

      const kode = 'kode_silsilah' in r ? r.kode_silsilah : r.generated_kode;
      if (kode) {
        const cab = `Cabang ${kode.split('.')[0]}`;
        perCabang[cab] = (perCabang[cab] || 0) + 1;
      }
    });

    const tagihanAktif = store.tagihanIuran;
    const targetIuran = tagihanAktif.length > 0
      ? tagihanAktif.reduce((sum, t) => sum + (Number(t.nominal_tagihan) || 0), 0)
      : totalIuran;
    const totalIuranTerbayar = tagihanAktif.reduce((sum, t) => sum + (Number(t.total_terbayar) || 0), 0);

    res.json({
      ok: true,
      stats: {
        totalAnggota: rows.length,
        kandung,
        menantu,
        hidup,
        wafat,
        belumJelasHidup,
        kepalaKeluarga: kk,
        perluEditDob: needEditDob,
        totalIuran: targetIuran,
        targetIuran,
        totalIuranTerbayar,
        perGenerasi,
        perCabang,
        isFromStaging: !hasCommitted,
        dbInitialized: store.dbInitialized,
        serverTime: nowJakartaDisplay(),
      },
    });
  });

  app.post('/api/migration/dry-run', requireAuth('MIGRASI', 'can_edit'), (req: AuthedRequest, res) => {
    const codeMode = req.body?.codeMode === 'KEEP_RAW' ? 'KEEP_RAW' : 'AUTO_GENERATE';
    const skipEmptyNames = req.body?.skipEmptyNames !== false;
    const rows = store.runDryRun(codeMode, skipEmptyNames, req.authUser!.username_login);
    store.addAudit(req.authUser!, 'DRY_RUN_MIGRASI', 'MIGRASI_STAGING', codeMode, `Dry-run ${rows.length} baris (${codeMode})`);
    res.json({ ok: true, totalStaging: rows.length });
  });

  app.get('/api/migration/staging', requireAuth('MIGRASI', 'can_view'), (req, res) => {
    const filter = String(req.query.filter || 'ALL');
    const q = String(req.query.q || '').trim().toLowerCase();
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || '25'), 10) || 25, 5), 100);

    const summary = {
      total: store.staging.length,
      siap: store.staging.filter((r) => r.action_status === 'SIAP').length,
      skip: store.staging.filter((r) => r.action_status === 'SKIP').length,
      perluEditTgl: store.staging.filter((r) => r.presisi_tgl_lahir === 'PERLU_EDIT' || r.anomaly_flags.some((f) => f.includes('TGL_LAHIR'))).length,
      anomaliKode: store.staging.filter((r) => r.anomaly_flags.some((f) => f.includes('KODE') || f.includes('TITIK'))).length,
      multiPasangan: store.staging.filter((r) => r.is_multi_spouse_group).length,
      namaKosong: store.staging.filter((r) => r.anomaly_flags.includes('NAMA_KOSONG')).length,
    };

    let filtered = store.staging;
    if (filter === 'TGL_LAHIR') {
      filtered = filtered.filter((r) => r.presisi_tgl_lahir === 'PERLU_EDIT' || r.anomaly_flags.some((f) => f.includes('TGL_LAHIR')));
    } else if (filter === 'KODE') {
      filtered = filtered.filter((r) => r.anomaly_flags.some((f) => f.includes('KODE') || f.includes('TITIK')));
    } else if (filter === 'MULTI_PASANGAN') {
      filtered = filtered.filter((r) => r.is_multi_spouse_group);
    } else if (filter === 'NAMA_KOSONG') {
      filtered = filtered.filter((r) => r.anomaly_flags.includes('NAMA_KOSONG'));
    }

    if (q) {
      filtered = filtered.filter((r) =>
        `${r.nama_lengkap} ${r.raw_kode} ${r.generated_kode} ${r.raw_ttl}`.toLowerCase().includes(q)
      );
    }

    const start = (page - 1) * pageSize;
    res.json({
      ok: true,
      summary,
      totalFiltered: filtered.length,
      page,
      pageSize,
      rows: filtered.slice(start, start + pageSize),
    });
  });

  app.patch('/api/migration/staging/:stagingId', requireAuth('MIGRASI', 'can_edit'), (req: AuthedRequest, res) => {
    const row = store.staging.find((r) => r.staging_id === req.params.stagingId);
    if (!row) {
      res.status(404).json({ ok: false, message: 'Baris staging tidak ditemukan.' });
      return;
    }
    if (req.body?.generated_kode !== undefined) row.generated_kode = String(req.body.generated_kode).trim();
    if (req.body?.tempat_lahir !== undefined) row.tempat_lahir = String(req.body.tempat_lahir).trim();
    if (req.body?.tanggal_lahir_iso !== undefined) {
      const tgl = String(req.body.tanggal_lahir_iso).trim();
      row.tanggal_lahir_iso = tgl;
      row.presisi_tgl_lahir = tgl ? 'LENGKAP' : 'KOSONG';
      row.anomaly_flags = row.anomaly_flags.filter((f) => !f.includes('TGL_LAHIR'));
    }
    if (req.body?.action_status === 'SIAP' || req.body?.action_status === 'SKIP') {
      row.action_status = req.body.action_status;
    }
    row.updated_at = nowJakartaIso();
    store.addAudit(req.authUser!, 'EDIT_STAGING_MIGRASI', 'MIGRASI_STAGING', row.staging_id, `Update staging ${row.nama_lengkap || row.raw_kode}`);
    res.json({ ok: true, row });
  });

  app.post('/api/migration/commit', requireAuth('MIGRASI', 'can_create'), (req: AuthedRequest, res) => {
    const result = store.commitMigration(req.authUser!);
    res.json({ ok: true, ...result });
  });

  // =========================================================
  // MASTER DATA (WILAYAH, PENDIDIKAN, PEKERJAAN, GENERASI)
  // =========================================================
  app.get('/api/master/bundles', requireAuth('ANGGOTA', 'can_view'), (_req, res) => {
    res.json({
      ok: true,
      generasi: [...store.masterGenerasi].sort((a, b) => a.urutan - b.urutan),
      pendidikan: [...store.masterPendidikan].sort((a, b) => a.urutan - b.urutan),
      pekerjaan: [...store.masterPekerjaan].sort((a, b) => a.urutan - b.urutan),
      wilayah: store.masterWilayah,
    });
  });

  app.get('/api/master/wilayah', requireAuth('ANGGOTA', 'can_view'), async (req, res) => {
    const tingkat = String(req.query.tingkat || 'PROV').toUpperCase() as WilayahItem['tingkat'];
    const kodeInduk = String(req.query.kodeInduk || '').trim();

    let items = store.masterWilayah.filter((w) => {
      if (w.tingkat !== tingkat) return false;
      if (tingkat === 'PROV') return true;
      return w.kode_induk === kodeInduk;
    });

    if (items.length === 0 && /^\d+$/.test(kodeInduk) && (tingkat === 'KAB' || tingkat === 'KEC' || tingkat === 'DESA')) {
      const endpointMap: Record<'KAB' | 'KEC' | 'DESA', string> = {
        KAB: `regencies/${kodeInduk}.json`,
        KEC: `districts/${kodeInduk}.json`,
        DESA: `villages/${kodeInduk}.json`,
      };
      try {
        const resp = await fetch(`https://emsifa.github.io/api-wilayah-indonesia/api/${endpointMap[tingkat]}`, {
          signal: AbortSignal.timeout(3500),
        });
        if (resp.ok) {
          const json = (await resp.json()) as { id?: string; name?: string }[];
          if (Array.isArray(json) && json.length > 0) {
            const newItems: WilayahItem[] = json
              .filter((r) => r.id && r.name)
              .map((r) => ({
                kode_wilayah: String(r.id),
                tingkat,
                kode_induk: kodeInduk,
                nama_wilayah: String(r.name),
                kode_pos_default: '',
              }));
            const existingCodes = new Set(store.masterWilayah.map((x) => `${x.tingkat}:${x.kode_wilayah}`));
            newItems.forEach((ni) => {
              if (!existingCodes.has(`${ni.tingkat}:${ni.kode_wilayah}`)) {
                store.masterWilayah.push(ni);
              }
            });
            store.saveToDisk();
            items = newItems;
          }
        }
      } catch {
        // Fallback ke cache lokal yang tersedia
      }
    }

    res.json({
      ok: true,
      items: items.sort((a, b) => a.nama_wilayah.localeCompare(b.nama_wilayah)),
    });
  });

  app.post('/api/master/:type', requireAuth('PENGATURAN', 'can_edit'), (req: AuthedRequest, res) => {
    const masterType = String(req.params.type || '').toUpperCase();
    const nowId = genId('MST');

    if (masterType === 'WILAYAH') {
      const kode = String(req.body?.kode_wilayah || '').trim();
      const tingkat = String(req.body?.tingkat || '').toUpperCase() as WilayahItem['tingkat'];
      const nama = String(req.body?.nama_wilayah || '').trim();
      if (!kode || !nama || !['PROV', 'KAB', 'KEC', 'DESA'].includes(tingkat)) {
        res.status(400).json({ ok: false, message: 'Kode, tingkat (PROV/KAB/KEC/DESA), dan nama wilayah wajib diisi.' });
        return;
      }
      const existing = store.masterWilayah.find((w) => w.kode_wilayah === kode && w.tingkat === tingkat);
      if (existing) {
        existing.nama_wilayah = nama;
        existing.kode_induk = String(req.body?.kode_induk ?? existing.kode_induk).trim();
        existing.kode_pos_default = String(req.body?.kode_pos_default ?? existing.kode_pos_default).trim();
      } else {
        store.masterWilayah.push({
          kode_wilayah: kode,
          tingkat,
          kode_induk: String(req.body?.kode_induk || '').trim(),
          nama_wilayah: nama,
          kode_pos_default: String(req.body?.kode_pos_default || '').trim(),
        });
      }
      store.addAudit(req.authUser!, 'SIMPAN_MASTER_WILAYAH', 'MASTER_WILAYAH', kode, `${tingkat}: ${nama}`);
      res.json({ ok: true, wilayah: store.masterWilayah });
      return;
    }

    const listMap: Record<string, SimpleMasterItem[]> = {
      PENDIDIKAN: store.masterPendidikan,
      PEKERJAAN: store.masterPekerjaan,
      GENERASI: store.masterGenerasi,
    };
    const targetList = listMap[masterType];
    if (!targetList) {
      res.status(400).json({ ok: false, message: 'Jenis master data tidak dikenal.' });
      return;
    }

    const nama = String(req.body?.nama || '').trim();
    if (!nama) {
      res.status(400).json({ ok: false, message: 'Nama item master wajib diisi.' });
      return;
    }
    const id = String(req.body?.id || '').trim() || nowId;
    const urutan = Number(req.body?.urutan ?? targetList.length + 1);
    const levelAngka = req.body?.level_angka !== undefined ? Number(req.body.level_angka) : undefined;
    const deskripsi = String(req.body?.deskripsi || '').trim();
    const statusAktif = req.body?.status_aktif !== false;

    const existing = targetList.find((x) => x.id === id);
    if (existing) {
      existing.nama = nama;
      existing.urutan = isNaN(urutan) ? existing.urutan : urutan;
      if (levelAngka !== undefined && !isNaN(levelAngka)) existing.level_angka = levelAngka;
      if (req.body?.deskripsi !== undefined) existing.deskripsi = deskripsi;
      existing.status_aktif = statusAktif;
    } else {
      targetList.push({
        id,
        nama,
        urutan: isNaN(urutan) ? targetList.length + 1 : urutan,
        ...(masterType === 'GENERASI' ? { level_angka: levelAngka ?? targetList.length, deskripsi } : {}),
        status_aktif: statusAktif,
      });
    }

    store.addAudit(req.authUser!, 'SIMPAN_MASTER', `MASTER_${masterType}`, id, `Simpan item ${nama}`);
    res.json({ ok: true, items: [...targetList].sort((a, b) => a.urutan - b.urutan) });
  });

  // =========================================================
  // ANGGOTA KELUARGA (FILTER, DETAIL, CREATE, FULL EDIT, ARCHIVE)
  // =========================================================
  app.get('/api/members', requireAuth('ANGGOTA', 'can_view'), (req: AuthedRequest, res) => {
    const canSensitive = Boolean(ROLE_MATRIX[req.authUser!.role_id]?.ANGGOTA?.view_sensitive_contact);
    const q = String(req.query.q || '').trim().toLowerCase();
    const generasi = String(req.query.generasi || '').trim();
    const statusKeturunan = String(req.query.statusKeturunan || '').trim();
    const statusHidup = String(req.query.statusHidup || '').trim();
    const cabang = String(req.query.cabang || '').trim();
    const needEdit = req.query.needEdit === 'true';
    const includeArchived = req.query.includeArchived === 'true';
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || '25'), 10) || 25, 5), 2000);

    let list = store.members.filter((m) => (includeArchived ? true : !m.is_archived));
    if (q) {
      list = list.filter((m) =>
        `${m.id_anggota} ${m.nama_lengkap} ${m.nama_panggilan || ''} ${m.kode_silsilah} ${m.tempat_lahir} ${m.pekerjaan_lainnya}`.toLowerCase().includes(q)
      );
    }
    if (generasi) {
      list = list.filter((m) => String(m.generasi_level) === generasi || m.generasi_label === generasi);
    }
    if (statusKeturunan) {
      list = list.filter((m) => m.status_keturunan.toLowerCase() === statusKeturunan.toLowerCase());
    }
    if (statusHidup) {
      list = list.filter((m) => m.status_hidup === statusHidup);
    }
    if (cabang) {
      list = list.filter((m) => m.kode_silsilah.split('.')[0] === cabang);
    }
    if (needEdit) {
      list = list.filter((m) => m.presisi_tgl_lahir === 'PERLU_EDIT' || !m.tanggal_lahir);
    }

    const start = (page - 1) * pageSize;
    const rows = list.slice(start, start + pageSize).map((m) => projectMemberForRole(m, canSensitive));

    res.json({ ok: true, total: list.length, page, pageSize, rows });
  });

  function computeNextMemberId(): string {
    let maxNum = 0;
    store.members.forEach((m) => {
      const match = m.id_anggota.match(/^BMT-(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    return 'BMT-' + String(maxNum + 1).padStart(4, '0');
  }

  function computeRelationDerivedFields(params: {
    relation_type?: string;
    relation_ayah_id?: string;
    relation_ibu_id?: string;
    relation_pasangan_id?: string;
    relation_jenis_hubungan?: string;
  }) {
    const relType = String(params.relation_type || '').trim().toUpperCase();
    const ayahId = String(params.relation_ayah_id || '').trim();
    const ibuId = String(params.relation_ibu_id || '').trim();
    const pasanganId = String(params.relation_pasangan_id || '').trim();
    const jenisHub = String(params.relation_jenis_hubungan || 'KANDUNG').trim().toUpperCase();
    const nextId = computeNextMemberId();

    if (relType === 'ANAK_DARI' && (ayahId || ibuId)) {
      const ayah = ayahId ? store.members.find((m) => m.id_anggota === ayahId) : undefined;
      const ibu = ibuId ? store.members.find((m) => m.id_anggota === ibuId) : undefined;
      const primaryParent =
        (ayah && ayah.status_keturunan !== 'Menantu' ? ayah : undefined) ||
        (ibu && ibu.status_keturunan !== 'Menantu' ? ibu : undefined) ||
        ayah ||
        ibu;

      if (primaryParent) {
        const parentKode = String(primaryParent.kode_silsilah || '').trim();
        const isRoot = primaryParent.id_anggota === 'BMT-0000' || parentKode === '0';
        let maxChildNum = 0;

        store.parentRelations.forEach((r) => {
          if (!r.status_aktif) return;
          if (r.id_ayah === primaryParent.id_anggota || r.id_ibu === primaryParent.id_anggota) {
            if ((Number(r.urutan_anak) || 0) > maxChildNum) {
              maxChildNum = Number(r.urutan_anak) || 0;
            }
          }
        });

        const escaped = parentKode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const directChildRe = isRoot ? /^(\d+)$/ : new RegExp(`^${escaped}\\.(\\d+)$`);
        store.members.forEach((m) => {
          if (m.id_anggota === 'BMT-0000' || m.status_keturunan === 'Menantu') return;
          const match = String(m.kode_silsilah || '').trim().match(directChildRe);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxChildNum) maxChildNum = num;
          }
        });

        const nextOrder = maxChildNum + 1;
        const generatedKode = isRoot ? String(nextOrder) : parentKode ? `${parentKode}.${nextOrder}` : String(nextOrder);
        const genLevel = (Number(primaryParent.generasi_level) || 0) + 1;
        const genMaster = store.masterGenerasi.find((g) => g.level_angka === genLevel);

        return {
          ok: true,
          nextId,
          kode_silsilah: generatedKode,
          generasi_level: genLevel,
          generasi_label: genMaster?.nama || `Generasi-${genLevel}`,
          status_keturunan: jenisHub === 'ANGKAT' ? 'Anak Angkat' : 'Kandung',
          urutan_anak: nextOrder,
          primaryParentName: primaryParent.nama_lengkap,
        };
      }
    }

    if (relType === 'PASANGAN_DARI' && pasanganId) {
      const spouse = store.members.find((m) => m.id_anggota === pasanganId);
      if (spouse) {
        const existingSpouses = store.couples.filter(
          (c) => c.status_aktif && (c.id_anggota_1 === spouse.id_anggota || c.id_anggota_2 === spouse.id_anggota)
        );
        const nextSpouseOrder = existingSpouses.length + 1;
        const genLevel = Number(spouse.generasi_level) || 1;
        const genMaster = store.masterGenerasi.find((g) => g.level_angka === genLevel);
        return {
          ok: true,
          nextId,
          kode_silsilah: spouse.kode_silsilah || '',
          generasi_level: genLevel,
          generasi_label: spouse.generasi_label || genMaster?.nama || `Generasi-${genLevel}`,
          status_keturunan: 'Menantu',
          urutan_pasangan: nextSpouseOrder,
          suggestedGender: spouse.jenis_kelamin === 'L' ? 'P' : spouse.jenis_kelamin === 'P' ? 'L' : '',
          spouseName: spouse.nama_lengkap,
        };
      }
    }

    return {
      ok: true,
      nextId,
      kode_silsilah: '',
      generasi_level: 1,
      generasi_label: store.masterGenerasi.find((g) => g.level_angka === 1)?.nama || 'Anak',
      status_keturunan: 'Kandung',
    };
  }

  app.get('/api/members/relation-options', requireAuth('ANGGOTA', 'can_view'), (req: AuthedRequest, res) => {
    const canSensitive = Boolean(ROLE_MATRIX[req.authUser!.role_id]?.ANGGOTA?.view_sensitive_contact);
    const activeMembers = store.members
      .filter((m) => !m.is_archived)
      .map((m) => projectMemberForRole(m, canSensitive));
    res.json({
      ok: true,
      nextIdPreview: computeNextMemberId(),
      members: activeMembers,
      couples: store.couples.filter((c) => c.status_aktif),
      parentRelations: store.parentRelations.filter((r) => r.status_aktif),
    });
  });

  app.post('/api/members/preview-relation', requireAuth('ANGGOTA', 'can_view'), (req, res) => {
    const derived = computeRelationDerivedFields({
      relation_type: req.body?.relation_type,
      relation_ayah_id: req.body?.relation_ayah_id,
      relation_ibu_id: req.body?.relation_ibu_id,
      relation_pasangan_id: req.body?.relation_pasangan_id,
      relation_jenis_hubungan: req.body?.relation_jenis_hubungan,
    });
    res.json(derived);
  });

  app.get('/api/members/:id/detail', requireAuth('ANGGOTA', 'can_view'), (req: AuthedRequest, res) => {
    const canSensitive = Boolean(ROLE_MATRIX[req.authUser!.role_id]?.ANGGOTA?.view_sensitive_contact);
    const member = store.members.find((m) => m.id_anggota === req.params.id);
    if (!member) {
      res.status(404).json({ ok: false, message: 'Anggota tidak ditemukan.' });
      return;
    }

    const memberMap = new Map(store.members.map((m) => [m.id_anggota, m]));

    const parentRel = store.parentRelations.filter((r) => r.status_aktif && r.id_anak === member.id_anggota);
    const parents = parentRel.map((r) => ({
      relation: r,
      ayah: r.id_ayah && memberMap.get(r.id_ayah) ? projectMemberForRole(memberMap.get(r.id_ayah)!, canSensitive) : null,
      ibu: r.id_ibu && memberMap.get(r.id_ibu) ? projectMemberForRole(memberMap.get(r.id_ibu)!, canSensitive) : null,
    }));

    const spouseRels = store.couples
      .filter((c) => c.status_aktif && (c.id_anggota_1 === member.id_anggota || c.id_anggota_2 === member.id_anggota))
      .sort((a, b) => a.urutan_pasangan - b.urutan_pasangan);

    const spouses = spouseRels.map((rel) => {
      const partnerId = rel.id_anggota_1 === member.id_anggota ? rel.id_anggota_2 : rel.id_anggota_1;
      const partner = memberMap.get(partnerId);
      return {
        relation: rel,
        partner: partner ? projectMemberForRole(partner, canSensitive) : null,
      };
    });

    const childRels = store.parentRelations
      .filter((r) => r.status_aktif && (r.id_ayah === member.id_anggota || r.id_ibu === member.id_anggota))
      .sort((a, b) => a.urutan_anak - b.urutan_anak);

    const children = childRels
      .map((r) => {
        const child = memberMap.get(r.id_anak);
        if (!child) return null;
        return {
          relation: r,
          child: projectMemberForRole(child, canSensitive),
        };
      })
      .filter(Boolean);

    const parentIds = new Set<string>();
    parentRel.forEach((p) => {
      if (p.id_ayah) parentIds.add(p.id_ayah);
      if (p.id_ibu) parentIds.add(p.id_ibu);
    });
    const siblingIds = new Set<string>();
    store.parentRelations.forEach((r) => {
      if (!r.status_aktif || r.id_anak === member.id_anggota) return;
      if ((r.id_ayah && parentIds.has(r.id_ayah)) || (r.id_ibu && parentIds.has(r.id_ibu))) {
        siblingIds.add(r.id_anak);
      }
    });
    const siblings = Array.from(siblingIds)
      .map((sid) => memberMap.get(sid))
      .filter((x): x is MemberRecord => Boolean(x))
      .map((x) => projectMemberForRole(x, canSensitive));

    const households = store.householdMembers
      .filter((hm) => hm.status_aktif && hm.id_anggota === member.id_anggota)
      .map((hm) => {
        const h = store.households.find((hh) => hh.id_rumah_tangga === hm.id_rumah_tangga);
        return h
          ? {
              ...hm,
              household: canSensitive
                ? h
                : { ...h, alamat_ringkas: '', no_kontak_rt: '' },
            }
          : null;
      })
      .filter(Boolean);

    res.json({
      ok: true,
      member: projectMemberForRole(member, canSensitive),
      parents,
      spouses,
      children,
      siblings,
      households,
    });
  });

  app.post('/api/members', requireAuth('ANGGOTA', 'can_create'), (req: AuthedRequest, res) => {
    const nama = String(req.body?.nama_lengkap || '').trim();
    if (!nama) {
      res.status(400).json({ ok: false, message: 'Nama lengkap wajib diisi.' });
      return;
    }

    const tempatLahir = String(req.body?.tempat_lahir || '').trim();
    const forceDuplicate = Boolean(req.body?.forceDuplicate);
    if (!forceDuplicate) {
      const dup = store.members.find(
        (m) =>
          !m.is_archived &&
          m.nama_lengkap.toLowerCase() === nama.toLowerCase() &&
          (!tempatLahir || m.tempat_lahir.toLowerCase() === tempatLahir.toLowerCase())
      );
      if (dup) {
        res.status(409).json({
          ok: false,
          code: 'DUPLICATE_WARNING',
          message: `Ditemukan anggota bernama serupa (${dup.id_anggota} - ${dup.nama_lengkap}). Konfirmasi jika memang orang berbeda.`,
          existing: dup,
        });
        return;
      }
    }

    const newId = computeNextMemberId();
    const now = nowJakartaIso();
    const tglLahir = String(req.body?.tanggal_lahir || '').trim();
    if (tglLahir && !/^\d{4}-\d{2}-\d{2}$/.test(tglLahir)) {
      res.status(400).json({ ok: false, message: 'Format tanggal lahir harus YYYY-MM-DD.' });
      return;
    }

    const relType = String(req.body?.relation_type || '').trim().toUpperCase();
    const relAyahId = String(req.body?.relation_ayah_id || '').trim();
    const relIbuId = String(req.body?.relation_ibu_id || '').trim();
    const relPasanganId = String(req.body?.relation_pasangan_id || '').trim();
    const relJenisHub = (String(req.body?.relation_jenis_hubungan || 'KANDUNG').trim().toUpperCase() ||
      'KANDUNG') as ParentChildRelation['jenis_hubungan'];
    const hasAutoRelation =
      (relType === 'ANAK_DARI' && Boolean(relAyahId || relIbuId)) ||
      (relType === 'PASANGAN_DARI' && Boolean(relPasanganId));

    const derived = hasAutoRelation
      ? computeRelationDerivedFields({
          relation_type: relType,
          relation_ayah_id: relAyahId,
          relation_ibu_id: relIbuId,
          relation_pasangan_id: relPasanganId,
          relation_jenis_hubungan: relJenisHub,
        })
      : null;

    const genLevel = derived ? derived.generasi_level : Number(req.body?.generasi_level ?? 1);
    const genMaster = store.masterGenerasi.find((g) => g.level_angka === genLevel);
    const resolvedKode = derived
      ? derived.kode_silsilah
      : String(req.body?.kode_silsilah || '').trim();
    const resolvedStatusKeturunan = derived
      ? derived.status_keturunan
      : String(req.body?.status_keturunan || 'Kandung').trim();
    const resolvedGenLabel = derived
      ? derived.generasi_label
      : String(req.body?.generasi_label || genMaster?.nama || `Generasi-${genLevel}`).trim();

    const newMember: MemberRecord = {
      id_anggota: newId,
      kode_silsilah: resolvedKode,
      kode_legacy: String(req.body?.kode_legacy || '').trim(),
      gelar_depan: String(req.body?.gelar_depan || '').trim(),
      nama_lengkap: nama,
      gelar_belakang: String(req.body?.gelar_belakang || '').trim(),
      nama_panggilan: String(req.body?.nama_panggilan || '').trim(),
      jenis_kelamin: String(req.body?.jenis_kelamin || '').trim(),
      foto_drive_id: sanitizePhotoInput(req.body?.foto_drive_id),
      status_keturunan: resolvedStatusKeturunan,
      generasi_level: isNaN(genLevel) ? 1 : genLevel,
      generasi_label: resolvedGenLabel,
      tempat_lahir: tempatLahir,
      tanggal_lahir: tglLahir,
      presisi_tgl_lahir: tglLahir ? 'LENGKAP' : tempatLahir ? 'TEMPAT_SAJA' : 'KOSONG',
      status_hidup: (req.body?.status_hidup || 'HIDUP') as MemberRecord['status_hidup'],
      tanggal_wafat: String(req.body?.tanggal_wafat || '').trim(),
      tempat_wafat: String(req.body?.tempat_wafat || '').trim(),
      catatan_wafat: String(req.body?.catatan_wafat || '').trim(),
      provinsi_id: String(req.body?.provinsi_id || '').trim(),
      kabkota_id: String(req.body?.kabkota_id || '').trim(),
      kecamatan_id: String(req.body?.kecamatan_id || '').trim(),
      kelurahan_id: String(req.body?.kelurahan_id || '').trim(),
      nama_jalan: String(req.body?.nama_jalan || '').trim(),
      rt: String(req.body?.rt || '').trim(),
      rw: String(req.body?.rw || '').trim(),
      no_rumah: String(req.body?.no_rumah || '').trim(),
      kode_pos: String(req.body?.kode_pos || '').trim(),
      keterangan_alamat: String(req.body?.keterangan_alamat || '').trim(),
      email: String(req.body?.email || '').trim(),
      no_hp: String(req.body?.no_hp || '').trim(),
      no_hp_alt: String(req.body?.no_hp_alt || '').trim(),
      pendidikan_id: String(req.body?.pendidikan_id || '').trim(),
      pekerjaan_id: String(req.body?.pekerjaan_id || '').trim(),
      pekerjaan_lainnya: String(req.body?.pekerjaan_lainnya || '').trim(),
      is_kk: Boolean(req.body?.is_kk),
      status_keanggotaan: String(req.body?.status_keanggotaan || 'AKTIF').trim(),
      tanggal_gabung: String(req.body?.tanggal_gabung || now.slice(0, 10)).trim(),
      catatan: String(req.body?.catatan || '').trim(),
      is_archived: false,
      iuran_nominal: Number(req.body?.iuran_nominal || 0) || 0,
      needs_verification: !tglLahir,
      updated_at: now,
    };

    store.members.push(newMember);

    let createdRelation: ParentChildRelation | SpouseRelation | null = null;
    if (relType === 'ANAK_DARI' && (relAyahId || relIbuId)) {
      const parentRel: ParentChildRelation = {
        relasi_ortu_id: genId('ORT'),
        id_anak: newId,
        id_ayah: relAyahId,
        id_ibu: relIbuId,
        id_pasangan_ortu: '',
        jenis_hubungan: relJenisHub,
        urutan_anak: derived?.urutan_anak || 1,
        keterangan: 'Relasi dibuat otomatis saat tambah anggota',
        status_aktif: true,
      };
      store.parentRelations.push(parentRel);
      createdRelation = parentRel;
      recalculateGenerations(store.members, store.parentRelations, store.couples, store.masterGenerasi);
    } else if (relType === 'PASANGAN_DARI' && relPasanganId) {
      const spouseRel: SpouseRelation = {
        relasi_pasangan_id: genId('PSG'),
        id_anggota_1: relPasanganId,
        id_anggota_2: newId,
        urutan_pasangan: derived?.urutan_pasangan || 1,
        tanggal_menikah: String(req.body?.relation_tanggal_menikah || '').trim(),
        tanggal_berakhir: '',
        status_hubungan: (String(req.body?.relation_status_hubungan || 'MENIKAH').trim().toUpperCase() ||
          'MENIKAH') as SpouseRelation['status_hubungan'],
        keterangan: 'Relasi pasangan dibuat otomatis saat tambah anggota',
        status_aktif: true,
      };
      store.couples.push(spouseRel);
      createdRelation = spouseRel;
      recalculateGenerations(store.members, store.parentRelations, store.couples, store.masterGenerasi);
    }

    store.addAudit(
      req.authUser!,
      'TAMBAH_ANGGOTA',
      'ANGGOTA',
      newId,
      `Menambah anggota ${nama} (${newMember.kode_silsilah || '-'})`
    );
    res.json({ ok: true, member: newMember, relation: createdRelation });
  });

  app.put('/api/members/:id', requireAuth('ANGGOTA', 'can_edit'), (req: AuthedRequest, res) => {
    const member = store.members.find((m) => m.id_anggota === req.params.id);
    if (!member) {
      res.status(404).json({ ok: false, message: 'Anggota tidak ditemukan.' });
      return;
    }

    const body = req.body || {};
    const nama = body.nama_lengkap !== undefined ? String(body.nama_lengkap).trim() : member.nama_lengkap;
    if (!nama) {
      res.status(400).json({ ok: false, message: 'Nama lengkap tidak boleh kosong.' });
      return;
    }
    const tglLahir = body.tanggal_lahir !== undefined ? String(body.tanggal_lahir).trim() : member.tanggal_lahir;
    if (tglLahir && !/^\d{4}-\d{2}-\d{2}$/.test(tglLahir)) {
      res.status(400).json({ ok: false, message: 'Format tanggal lahir harus YYYY-MM-DD.' });
      return;
    }

    const beforeNama = member.nama_lengkap;
    const beforeKode = member.kode_silsilah;

    if (body.kode_silsilah !== undefined) member.kode_silsilah = String(body.kode_silsilah).trim();
    if (body.kode_legacy !== undefined) member.kode_legacy = String(body.kode_legacy).trim();
    if (body.gelar_depan !== undefined) member.gelar_depan = String(body.gelar_depan).trim();
    member.nama_lengkap = nama;
    if (body.gelar_belakang !== undefined) member.gelar_belakang = String(body.gelar_belakang).trim();
    if (body.nama_panggilan !== undefined) member.nama_panggilan = String(body.nama_panggilan).trim();
    if (body.jenis_kelamin !== undefined) member.jenis_kelamin = String(body.jenis_kelamin).trim();
    if (body.foto_drive_id !== undefined) member.foto_drive_id = sanitizePhotoInput(body.foto_drive_id);
    if (body.status_keturunan !== undefined) member.status_keturunan = String(body.status_keturunan).trim();

    if (body.generasi_level !== undefined) {
      const lv = Number(body.generasi_level);
      if (!isNaN(lv) && lv >= 0) {
        member.generasi_level = lv;
        const gm = store.masterGenerasi.find((g) => g.level_angka === lv);
        member.generasi_label = body.generasi_label ? String(body.generasi_label).trim() : gm?.nama || `Generasi-${lv}`;
      }
    } else if (body.generasi_label !== undefined) {
      member.generasi_label = String(body.generasi_label).trim();
    }

    if (body.tempat_lahir !== undefined) member.tempat_lahir = String(body.tempat_lahir).trim();
    if (body.tanggal_lahir !== undefined) {
      member.tanggal_lahir = tglLahir;
      member.presisi_tgl_lahir = tglLahir ? 'LENGKAP' : member.tempat_lahir ? 'TEMPAT_SAJA' : 'KOSONG';
      member.needs_verification = !tglLahir;
    }

    if (body.status_hidup !== undefined) member.status_hidup = body.status_hidup;
    if (body.tanggal_wafat !== undefined) member.tanggal_wafat = String(body.tanggal_wafat).trim();
    if (body.tempat_wafat !== undefined) member.tempat_wafat = String(body.tempat_wafat).trim();
    if (body.catatan_wafat !== undefined) member.catatan_wafat = String(body.catatan_wafat).trim();

    if (body.provinsi_id !== undefined) member.provinsi_id = String(body.provinsi_id).trim();
    if (body.kabkota_id !== undefined) member.kabkota_id = String(body.kabkota_id).trim();
    if (body.kecamatan_id !== undefined) member.kecamatan_id = String(body.kecamatan_id).trim();
    if (body.kelurahan_id !== undefined) member.kelurahan_id = String(body.kelurahan_id).trim();
    if (body.nama_jalan !== undefined) member.nama_jalan = String(body.nama_jalan).trim();
    if (body.rt !== undefined) member.rt = String(body.rt).trim();
    if (body.rw !== undefined) member.rw = String(body.rw).trim();
    if (body.no_rumah !== undefined) member.no_rumah = String(body.no_rumah).trim();
    if (body.kode_pos !== undefined) member.kode_pos = String(body.kode_pos).trim();
    if (body.keterangan_alamat !== undefined) member.keterangan_alamat = String(body.keterangan_alamat).trim();

    if (body.no_hp !== undefined) member.no_hp = String(body.no_hp).trim();
    if (body.no_hp_alt !== undefined) member.no_hp_alt = String(body.no_hp_alt).trim();
    if (body.email !== undefined) member.email = String(body.email).trim();

    if (body.pendidikan_id !== undefined) member.pendidikan_id = String(body.pendidikan_id).trim();
    if (body.pekerjaan_id !== undefined) member.pekerjaan_id = String(body.pekerjaan_id).trim();
    if (body.pekerjaan_lainnya !== undefined) member.pekerjaan_lainnya = String(body.pekerjaan_lainnya).trim();

    if (body.is_kk !== undefined) member.is_kk = Boolean(body.is_kk);
    if (body.status_keanggotaan !== undefined) member.status_keanggotaan = String(body.status_keanggotaan).trim();
    if (body.tanggal_gabung !== undefined) member.tanggal_gabung = String(body.tanggal_gabung).trim();
    if (body.catatan !== undefined) member.catatan = String(body.catatan).trim();
    if (body.is_archived !== undefined) member.is_archived = Boolean(body.is_archived);

    member.updated_at = nowJakartaIso();
    store.addAudit(
      req.authUser!,
      'EDIT_LENGKAP_ANGGOTA',
      'ANGGOTA',
      member.id_anggota,
      `Edit data lengkap: ${beforeNama} (${beforeKode}) -> ${member.nama_lengkap} (${member.kode_silsilah})`
    );
    res.json({ ok: true, member });
  });

  app.patch('/api/members/:id/archive', requireAuth('ANGGOTA', 'can_delete'), (req: AuthedRequest, res) => {
    const member = store.members.find((m) => m.id_anggota === req.params.id);
    if (!member) {
      res.status(404).json({ ok: false, message: 'Anggota tidak ditemukan.' });
      return;
    }
    if (member.id_anggota === 'BMT-0000') {
      res.status(400).json({ ok: false, message: 'Leluhur Utama tidak dapat diarsipkan.' });
      return;
    }
    const nextArchived = req.body?.archive !== undefined ? Boolean(req.body.archive) : !member.is_archived;
    member.is_archived = nextArchived;
    member.status_keanggotaan = nextArchived ? 'ARSIP' : 'AKTIF';
    member.updated_at = nowJakartaIso();
    store.addAudit(
      req.authUser!,
      nextArchived ? 'ARSIPKAN_ANGGOTA' : 'PULIHKAN_ANGGOTA',
      'ANGGOTA',
      member.id_anggota,
      `${nextArchived ? 'Arsipkan' : 'Pulihkan'} anggota ${member.nama_lengkap}`
    );
    res.json({ ok: true, member });
  });

  app.patch('/api/members/:id/birthdate', requireAuth('ANGGOTA', 'can_edit'), (req: AuthedRequest, res) => {
    const member = store.members.find((m) => m.id_anggota === req.params.id);
    if (!member) {
      res.status(404).json({ ok: false, message: 'Anggota tidak ditemukan.' });
      return;
    }
    const tgl = String(req.body?.tanggal_lahir || '').trim();
    if (tgl && !/^\d{4}-\d{2}-\d{2}$/.test(tgl)) {
      res.status(400).json({ ok: false, message: 'Format tanggal harus YYYY-MM-DD.' });
      return;
    }
    member.tempat_lahir = String(req.body?.tempat_lahir ?? member.tempat_lahir).trim();
    member.tanggal_lahir = tgl;
    member.presisi_tgl_lahir = tgl ? 'LENGKAP' : 'KOSONG';
    member.needs_verification = !tgl;
    member.updated_at = nowJakartaIso();
    store.addAudit(req.authUser!, 'EDIT_TGL_LAHIR', 'ANGGOTA', member.id_anggota, `Pembaruan TTL ${member.nama_lengkap}`);
    res.json({ ok: true, member });
  });

  // =========================================================
  // SILSILAH MULTI-PASANGAN & ANTI-CYCLE
  // =========================================================
  app.get('/api/family-tree', requireAuth('SILSILAH', 'can_view'), (req: AuthedRequest, res) => {
    const canSensitive = Boolean(ROLE_MATRIX[req.authUser!.role_id]?.SILSILAH?.view_sensitive_contact);
    const activeMembers = store.members
      .filter((m) => !m.is_archived)
      .map((m) => projectMemberForRole(m, canSensitive));
    res.json({
      ok: true,
      rootId: 'BMT-0000',
      members: activeMembers,
      couples: store.couples.filter((c) => c.status_aktif),
      parentRelations: store.parentRelations.filter((r) => r.status_aktif),
    });
  });

  app.post('/api/family-tree/spouses', requireAuth('SILSILAH', 'can_edit'), (req: AuthedRequest, res) => {
    const id1 = String(req.body?.id_anggota_1 || '').trim();
    const id2 = String(req.body?.id_anggota_2 || '').trim();
    if (!id1 || !id2 || id1 === id2) {
      res.status(400).json({ ok: false, message: 'Dua anggota pasangan harus berbeda dan valid.' });
      return;
    }
    if (!store.members.some((m) => m.id_anggota === id1) || !store.members.some((m) => m.id_anggota === id2)) {
      res.status(404).json({ ok: false, message: 'Salah satu ID anggota tidak ditemukan.' });
      return;
    }

    const relId = String(req.body?.relasi_pasangan_id || '').trim();
    const existing = relId ? store.couples.find((c) => c.relasi_pasangan_id === relId) : undefined;
    const statusAktif = req.body?.status_aktif !== false;
    const payload: SpouseRelation = {
      relasi_pasangan_id: existing ? existing.relasi_pasangan_id : genId('PSG'),
      id_anggota_1: id1,
      id_anggota_2: id2,
      urutan_pasangan: Math.max(parseInt(String(req.body?.urutan_pasangan || '1'), 10) || 1, 1),
      tanggal_menikah: String(req.body?.tanggal_menikah || '').trim(),
      tanggal_berakhir: String(req.body?.tanggal_berakhir || '').trim(),
      status_hubungan: (req.body?.status_hubungan || 'MENIKAH') as SpouseRelation['status_hubungan'],
      keterangan: String(req.body?.keterangan || '').trim(),
      status_aktif: statusAktif,
    };

    if (existing) {
      Object.assign(existing, payload);
    } else {
      store.couples.push(payload);
    }

    recalculateGenerations(store.members, store.parentRelations, store.couples, store.masterGenerasi);
    store.addAudit(req.authUser!, 'SIMPAN_PASANGAN', 'PASANGAN', payload.relasi_pasangan_id, `${id1} <-> ${id2} (ke-${payload.urutan_pasangan})`);
    res.json({ ok: true, relation: payload });
  });

  app.post('/api/family-tree/parents', requireAuth('SILSILAH', 'can_edit'), (req: AuthedRequest, res) => {
    const idAnak = String(req.body?.id_anak || '').trim();
    const idAyah = String(req.body?.id_ayah || '').trim();
    const idIbu = String(req.body?.id_ibu || '').trim();
    const statusAktif = req.body?.status_aktif !== false;

    if (!idAnak || (!idAyah && !idIbu)) {
      res.status(400).json({ ok: false, message: 'ID anak dan minimal satu orang tua wajib diisi.' });
      return;
    }
    if (idAnak === idAyah || idAnak === idIbu) {
      res.status(400).json({ ok: false, message: 'Anggota tidak boleh menjadi orang tua bagi dirinya sendiri.' });
      return;
    }

    const relId = String(req.body?.relasi_ortu_id || '').trim();
    const otherRelations = store.parentRelations.filter((r) => r.relasi_ortu_id !== relId);
    if (statusAktif) {
      if (idAyah && isAncestor(otherRelations, idAnak, idAyah)) {
        res.status(400).json({ ok: false, message: 'Terdeteksi siklus silsilah (loop): calon anak adalah leluhur dari calon ayah.' });
        return;
      }
      if (idIbu && isAncestor(otherRelations, idAnak, idIbu)) {
        res.status(400).json({ ok: false, message: 'Terdeteksi siklus silsilah (loop): calon anak adalah leluhur dari calon ibu.' });
        return;
      }
    }

    const existing = relId ? store.parentRelations.find((r) => r.relasi_ortu_id === relId) : undefined;
    const payload: ParentChildRelation = {
      relasi_ortu_id: existing ? existing.relasi_ortu_id : genId('ORT'),
      id_anak: idAnak,
      id_ayah: idAyah,
      id_ibu: idIbu,
      id_pasangan_ortu: String(req.body?.id_pasangan_ortu || '').trim(),
      jenis_hubungan: (req.body?.jenis_hubungan || 'KANDUNG') as ParentChildRelation['jenis_hubungan'],
      urutan_anak: Math.max(parseInt(String(req.body?.urutan_anak || '1'), 10) || 1, 1),
      keterangan: String(req.body?.keterangan || '').trim(),
      status_aktif: statusAktif,
    };

    if (existing) {
      Object.assign(existing, payload);
    } else {
      store.parentRelations.push(payload);
    }

    recalculateGenerations(store.members, store.parentRelations, store.couples, store.masterGenerasi);
    store.addAudit(req.authUser!, 'SIMPAN_RELASI_ORTU', 'HUBUNGAN_ORANGTUA', payload.relasi_ortu_id, `Anak ${idAnak} <- Ayah:${idAyah || '-'} Ibu:${idIbu || '-'}`);
    res.json({ ok: true, relation: payload });
  });

  app.get('/api/family-tree/relationship', requireAuth('SILSILAH', 'can_view'), (req, res) => {
    const idA = String(req.query.idA || '').trim();
    const idB = String(req.query.idB || '').trim();
    if (!idA || !idB) {
      res.status(400).json({ ok: false, message: 'Pilih dua anggota untuk melacak hubungan.' });
      return;
    }
    const result = findRelationshipBetween(store.members, store.parentRelations, store.couples, idA, idB);
    res.json({ ok: true, ...result });
  });

  // =========================================================
  // RUMAH TANGGA & KEPALA KELUARGA (KK)
  // =========================================================
  app.get('/api/households', requireAuth('RUMAH_TANGGA', 'can_view'), (req: AuthedRequest, res) => {
    const canSensitive = Boolean(ROLE_MATRIX[req.authUser!.role_id]?.RUMAH_TANGGA?.view_sensitive_contact);
    const memberMap = new Map(store.members.map((m) => [m.id_anggota, m]));

    const enriched = store.households
      .filter((h) => h.status_aktif)
      .map((h) => {
        const head = memberMap.get(h.id_kepala_keluarga);
        const membersInHouse = store.householdMembers
          .filter((hm) => hm.status_aktif && hm.id_rumah_tangga === h.id_rumah_tangga)
          .map((hm) => {
            const mem = memberMap.get(hm.id_anggota);
            return {
              ...hm,
              anggota: mem ? projectMemberForRole(mem, canSensitive) : null,
            };
          });
        return {
          ...h,
          alamat_ringkas: canSensitive ? h.alamat_ringkas : h.alamat_ringkas ? 'Alamat dibatasi sesuai peran' : '',
          no_kontak_rt: canSensitive ? h.no_kontak_rt : '',
          kepala_keluarga: head ? projectMemberForRole(head, canSensitive) : null,
          jumlah_anggota: membersInHouse.length,
          anggota_list: membersInHouse,
        };
      });

    res.json({
      ok: true,
      households: enriched,
      kkHistory: store.kkHistory.slice(0, 100),
    });
  });

  app.post('/api/households', requireAuth('RUMAH_TANGGA', 'can_create'), (req: AuthedRequest, res) => {
    const nama = String(req.body?.nama_rumah_tangga || '').trim();
    const headId = String(req.body?.id_kepala_keluarga || '').trim();
    const allowMulti = Boolean(req.body?.izinkan_kk_ganda);
    if (!nama || !headId) {
      res.status(400).json({ ok: false, message: 'Nama rumah tangga dan Kepala Keluarga wajib diisi.' });
      return;
    }
    const headMember = store.members.find((m) => m.id_anggota === headId);
    if (!headMember) {
      res.status(404).json({ ok: false, message: 'Anggota calon Kepala Keluarga tidak ditemukan.' });
      return;
    }

    const existingHeadInActive = store.households.find((h) => h.status_aktif && h.id_kepala_keluarga === headId);
    if (existingHeadInActive && !allowMulti) {
      res.status(409).json({
        ok: false,
        message: `${headMember.nama_lengkap} sudah tercatat sebagai KK aktif pada "${existingHeadInActive.nama_rumah_tangga}". Centang opsi izinkan KK ganda jika disengaja.`,
      });
      return;
    }

    const existingMemberInActive = store.householdMembers.find((hm) => hm.status_aktif && hm.id_anggota === headId);
    if (existingMemberInActive && !allowMulti) {
      existingMemberInActive.status_aktif = false;
      existingMemberInActive.tanggal_keluar = nowJakartaIso().slice(0, 10);
    }

    const today = nowJakartaIso().slice(0, 10);
    const rtId = genId('RTG');
    const newHousehold: HouseholdRecord = {
      id_rumah_tangga: rtId,
      nama_rumah_tangga: nama,
      id_kepala_keluarga: headId,
      provinsi_id: String(req.body?.provinsi_id || headMember.provinsi_id || '').trim(),
      kabkota_id: String(req.body?.kabkota_id || headMember.kabkota_id || '').trim(),
      kecamatan_id: String(req.body?.kecamatan_id || headMember.kecamatan_id || '').trim(),
      kelurahan_id: String(req.body?.kelurahan_id || headMember.kelurahan_id || '').trim(),
      alamat_ringkas: String(req.body?.alamat_ringkas || headMember.keterangan_alamat || '').trim(),
      no_kontak_rt: String(req.body?.no_kontak_rt || headMember.no_hp || '').trim(),
      status_aktif: true,
      izinkan_kk_ganda: allowMulti,
      tanggal_bentuk: today,
      keterangan: String(req.body?.keterangan || '').trim(),
    };
    const hmRow: HouseholdMemberRecord = {
      id_anggota_rumah: genId('ART'),
      id_rumah_tangga: rtId,
      id_anggota: headId,
      peran_dalam_rt: 'KEPALA',
      tanggal_masuk: today,
      tanggal_keluar: '',
      status_aktif: true,
    };

    store.households.push(newHousehold);
    store.householdMembers.push(hmRow);
    headMember.is_kk = true;
    headMember.updated_at = nowJakartaIso();

    store.addAudit(req.authUser!, 'BUAT_RUMAH_TANGGA', 'RUMAH_TANGGA', rtId, `Buat rumah tangga ${nama} (KK: ${headMember.nama_lengkap})`);
    res.json({ ok: true, household: newHousehold });
  });

  app.post('/api/households/:id/change-head', requireAuth('RUMAH_TANGGA', 'can_edit'), (req: AuthedRequest, res) => {
    const rt = store.households.find((h) => h.id_rumah_tangga === req.params.id && h.status_aktif);
    if (!rt) {
      res.status(404).json({ ok: false, message: 'Rumah tangga tidak ditemukan.' });
      return;
    }
    const newHeadId = String(req.body?.id_kk_baru || '').trim();
    const alasan = String(req.body?.alasan || '').trim() || 'Pembaruan administratif Kepala Keluarga';
    const newHead = store.members.find((m) => m.id_anggota === newHeadId);
    if (!newHead) {
      res.status(404).json({ ok: false, message: 'Calon Kepala Keluarga baru tidak ditemukan.' });
      return;
    }

    const oldHeadId = rt.id_kepala_keluarga;
    if (oldHeadId === newHeadId) {
      res.status(400).json({ ok: false, message: 'Anggota tersebut sudah menjadi Kepala Keluarga pada rumah tangga ini.' });
      return;
    }

    const today = nowJakartaIso().slice(0, 10);
    store.householdMembers.forEach((hm) => {
      if (hm.status_aktif && hm.id_rumah_tangga === rt.id_rumah_tangga && hm.id_anggota === oldHeadId) {
        hm.peran_dalam_rt = 'ANGGOTA';
      }
      if (hm.status_aktif && hm.id_anggota === newHeadId && hm.id_rumah_tangga !== rt.id_rumah_tangga && !rt.izinkan_kk_ganda) {
        hm.status_aktif = false;
        hm.tanggal_keluar = today;
      }
    });

    const existingNewInRt = store.householdMembers.find(
      (hm) => hm.status_aktif && hm.id_rumah_tangga === rt.id_rumah_tangga && hm.id_anggota === newHeadId
    );
    if (existingNewInRt) {
      existingNewInRt.peran_dalam_rt = 'KEPALA';
    } else {
      store.householdMembers.push({
        id_anggota_rumah: genId('ART'),
        id_rumah_tangga: rt.id_rumah_tangga,
        id_anggota: newHeadId,
        peran_dalam_rt: 'KEPALA',
        tanggal_masuk: today,
        tanggal_keluar: '',
        status_aktif: true,
      });
    }

    rt.id_kepala_keluarga = newHeadId;
    const oldHeadMember = store.members.find((m) => m.id_anggota === oldHeadId);
    if (oldHeadMember) {
      const stillHeadElsewhere = store.households.some((h) => h.status_aktif && h.id_kepala_keluarga === oldHeadId);
      oldHeadMember.is_kk = stillHeadElsewhere;
      oldHeadMember.updated_at = nowJakartaIso();
    }
    newHead.is_kk = true;
    newHead.updated_at = nowJakartaIso();

    const hist: KkHistoryRecord = {
      id_riwayat_kk: genId('RKK'),
      id_rumah_tangga: rt.id_rumah_tangga,
      id_kk_lama: oldHeadId,
      id_kk_baru: newHeadId,
      tanggal_pergantian: nowJakartaIso(),
      alasan,
      pencatat_user_id: req.authUser!.user_id,
    };
    store.kkHistory.unshift(hist);

    store.addAudit(req.authUser!, 'GANTI_KEPALA_KELUARGA', 'RUMAH_TANGGA', rt.id_rumah_tangga, `${oldHeadId} -> ${newHeadId} (${alasan})`);
    res.json({ ok: true, household: rt, history: hist });
  });

  app.post('/api/households/:id/assign-member', requireAuth('RUMAH_TANGGA', 'can_edit'), (req: AuthedRequest, res) => {
    const rt = store.households.find((h) => h.id_rumah_tangga === req.params.id && h.status_aktif);
    if (!rt) {
      res.status(404).json({ ok: false, message: 'Rumah tangga tidak ditemukan.' });
      return;
    }
    const idAnggota = String(req.body?.id_anggota || '').trim();
    const peran = String(req.body?.peran_dalam_rt || 'ANGGOTA').trim().toUpperCase();
    const member = store.members.find((m) => m.id_anggota === idAnggota);
    if (!member) {
      res.status(404).json({ ok: false, message: 'Anggota tidak ditemukan.' });
      return;
    }

    const today = nowJakartaIso().slice(0, 10);
    store.householdMembers.forEach((hm) => {
      if (hm.status_aktif && hm.id_anggota === idAnggota) {
        hm.status_aktif = false;
        hm.tanggal_keluar = today;
      }
    });

    const newRow: HouseholdMemberRecord = {
      id_anggota_rumah: genId('ART'),
      id_rumah_tangga: rt.id_rumah_tangga,
      id_anggota: idAnggota,
      peran_dalam_rt: peran,
      tanggal_masuk: today,
      tanggal_keluar: '',
      status_aktif: true,
    };
    store.householdMembers.push(newRow);

    if (peran === 'KEPALA') {
      const oldHeadId = rt.id_kepala_keluarga;
      rt.id_kepala_keluarga = idAnggota;
      member.is_kk = true;
      if (oldHeadId && oldHeadId !== idAnggota) {
        store.kkHistory.unshift({
          id_riwayat_kk: genId('RKK'),
          id_rumah_tangga: rt.id_rumah_tangga,
          id_kk_lama: oldHeadId,
          id_kk_baru: idAnggota,
          tanggal_pergantian: nowJakartaIso(),
          alasan: 'Penetapan anggota sebagai Kepala Keluarga',
          pencatat_user_id: req.authUser!.user_id,
        });
      }
    }

    store.addAudit(req.authUser!, 'PINDAH_ANGGOTA_RT', 'ANGGOTA_RUMAH', rt.id_rumah_tangga, `Anggota ${member.nama_lengkap} -> ${rt.nama_rumah_tangga} (${peran})`);
    res.json({ ok: true, assignment: newRow });
  });

  // =========================================================
  // TAHAP 4: KEUANGAN, DOUBLE-ENTRY JURNAL, TARGET IURAN & PEMBAYARAN
  // =========================================================
  app.get('/api/finance/overview', requireAuth('KEUANGAN', 'can_view'), (req: AuthedRequest, res) => {
    const canDetail = Boolean(ROLE_MATRIX[req.authUser!.role_id]?.KEUANGAN?.view_finance_detail);
    const tahun = parseInt(String(req.query.tahun || '2026'), 10) || 2026;

    const verifiedTrxSet = new Set(
      store.transaksi.filter((t) => t.status_verifikasi === 'TERVERIFIKASI').map((t) => t.transaksi_id)
    );

    const coaBalancesMap = new Map<
      string,
      {
        kode_akun: string;
        nama_akun: string;
        kategori: CoaAccount['kategori'];
        saldo_normal: 'DEBIT' | 'KREDIT';
        is_kas_bank: boolean;
        debit: number;
        kredit: number;
        saldo: number;
      }
    >();

    store.coa
      .filter((c) => c.status_aktif)
      .forEach((c) => {
        coaBalancesMap.set(c.kode_akun, {
          kode_akun: c.kode_akun,
          nama_akun: c.nama_akun,
          kategori: c.kategori,
          saldo_normal: c.saldo_normal,
          is_kas_bank: c.is_kas_bank,
          debit: 0,
          kredit: 0,
          saldo: 0,
        });
      });

    store.jurnal.forEach((j) => {
      if (!verifiedTrxSet.has(j.transaksi_id)) return;
      const acc = coaBalancesMap.get(j.kode_akun);
      if (!acc) return;
      acc.debit += Number(j.debit) || 0;
      acc.kredit += Number(j.kredit) || 0;
      acc.saldo = acc.saldo_normal === 'KREDIT' ? acc.kredit - acc.debit : acc.debit - acc.kredit;
    });

    const coaBalances = Array.from(coaBalancesMap.values());
    let totalKasBank = 0;
    let totalPendapatan = 0;
    let totalBeban = 0;
    let totalAset = 0;
    let totalKewajiban = 0;
    let totalSaldoDana = 0;

    coaBalances.forEach((acc) => {
      if (acc.is_kas_bank) totalKasBank += acc.saldo;
      if (acc.kategori === 'ASET') totalAset += acc.saldo;
      if (acc.kategori === 'KEWAJIBAN') totalKewajiban += acc.saldo;
      if (acc.kategori === 'SALDO_DANA') totalSaldoDana += acc.saldo;
      if (acc.kategori === 'PENDAPATAN') totalPendapatan += acc.saldo;
      if (acc.kategori === 'BEBAN') totalBeban += acc.saldo;
    });

    const tagihanTahun = store.tagihanIuran.filter((t) => Number(t.tahun_iuran) === tahun);
    const totalTargetIuran = tagihanTahun.reduce((s, t) => s + (Number(t.nominal_tagihan) || 0), 0);
    const totalDiskonIuran = tagihanTahun.reduce((s, t) => s + (Number(t.diskon_pembebasan) || 0), 0);
    const totalTerbayarIuran = tagihanTahun.reduce((s, t) => s + (Number(t.total_terbayar) || 0), 0);
    const totalSisaIuran = tagihanTahun.reduce((s, t) => s + (Number(t.sisa_tagihan) || 0), 0);

    const memberMap = new Map(store.members.map((m) => [m.id_anggota, m]));
    const rtMap = new Map(store.households.map((rt) => [rt.id_rumah_tangga, rt]));

    const paymentsByBill = new Map<string, PembayaranRecord[]>();
    store.pembayaran.forEach((p) => {
      const arr = paymentsByBill.get(p.tagihan_id) || [];
      arr.push(p);
      paymentsByBill.set(p.tagihan_id, arr);
    });

    const enrichedTagihan = canDetail
      ? tagihanTahun.map((t) => {
          const m = memberMap.get(t.id_kk);
          const rt = rtMap.get(t.id_rumah_tangga);
          const pays = [...(paymentsByBill.get(t.tagihan_id) || [])].sort((a, b) =>
            String(b.tanggal_bayar || b.created_at).localeCompare(String(a.tanggal_bayar || a.created_at))
          );
          const latestPay = pays[0];
          return {
            ...t,
            nama_anggota: m ? `${m.gelar_depan ? m.gelar_depan + ' ' : ''}${m.nama_lengkap}` : t.id_kk,
            kode_silsilah: m?.kode_silsilah || '',
            is_kk: Boolean(m?.is_kk),
            nama_rumah_tangga: rt?.nama_rumah_tangga || '-',
            tanggal_bayar_terakhir: latestPay?.tanggal_bayar || '',
            metode_bayar_terakhir: latestPay?.metode_bayar || '',
            jumlah_pembayaran: pays.length,
          };
        })
      : [];

    const visibleTrx = canDetail
      ? store.transaksi
      : store.transaksi.filter((t) => t.is_published && t.status_verifikasi === 'TERVERIFIKASI');

    const buktiByTrx = new Map(store.buktiTransaksi.map((b) => [b.transaksi_id, b]));
    const enrichedTrx = visibleTrx.map((t) => ({
      ...t,
      bukti: buktiByTrx.get(t.transaksi_id) || null,
    }));

    let totalPemasukanIuran = 0;
    let totalPemasukanLainnya = 0;
    let totalPengeluaranKas = 0;
    store.transaksi.forEach((t) => {
      if (t.status_verifikasi !== 'TERVERIFIKASI') return;
      const nom = Number(t.total_nominal) || 0;
      if (t.jenis_transaksi === 'PEMASUKAN') {
        if (String(t.no_transaksi || '').startsWith('IUR-')) totalPemasukanIuran += nom;
        else totalPemasukanLainnya += nom;
      } else if (t.jenis_transaksi === 'PENGELUARAN') {
        totalPengeluaranKas += nom;
      }
    });

    const enrichedPembayaran = canDetail
      ? store.pembayaran.map((p) => {
          const bill = store.tagihanIuran.find((b) => b.tagihan_id === p.tagihan_id);
          const m = bill ? memberMap.get(bill.id_kk) : undefined;
          const rt = p.id_rumah_tangga ? rtMap.get(p.id_rumah_tangga) : undefined;
          return {
            ...p,
            nama_pembayar: m?.nama_lengkap || rt?.nama_rumah_tangga || p.tagihan_id,
          };
        })
      : [];

    res.json({
      ok: true,
      canDetail,
      tahun,
      summary: {
        totalKasBank,
        totalPendapatan,
        totalBeban,
        surplusDefisit: totalPendapatan - totalBeban,
        totalAset,
        totalKewajiban,
        totalSaldoDana,
        totalTargetIuran,
        totalDiskonIuran,
        totalTerbayarIuran,
        totalSisaIuran,
        jumlahTagihan: tagihanTahun.length,
        jumlahLunas: tagihanTahun.filter((t) => t.status_bayar === 'LUNAS' || t.status_bayar === 'DIBEBASKAN').length,
        totalPemasukanIuran,
        totalPemasukanLainnya,
        totalPengeluaranKas,
      },
      coa: store.coa,
      coaBalances,
      transaksi: enrichedTrx,
      jurnal: canDetail ? store.jurnal : [],
      tarifIuran: store.tarifIuran,
      tagihanIuran: enrichedTagihan,
      pembayaran: enrichedPembayaran,
      anggaran: store.anggaran.filter((a) => Number(a.tahun_anggaran) === tahun),
    });
  });

  app.post('/api/finance/coa', requireAuth('KEUANGAN', 'can_edit'), (req: AuthedRequest, res) => {
    const kode = String(req.body?.kode_akun || '').trim();
    const nama = String(req.body?.nama_akun || '').trim();
    const kategori = String(req.body?.kategori || '').trim().toUpperCase() as CoaAccount['kategori'];
    if (!kode || !nama || !['ASET', 'KEWAJIBAN', 'SALDO_DANA', 'PENDAPATAN', 'BEBAN'].includes(kategori)) {
      res.status(400).json({ ok: false, message: 'Kode akun, nama akun, dan kategori valid wajib diisi.' });
      return;
    }
    const existing = store.coa.find((c) => c.kode_akun === kode);
    const payload: CoaAccount = {
      kode_akun: kode,
      nama_akun: nama,
      kategori,
      sub_kategori: String(req.body?.sub_kategori || kategori).trim().toUpperCase(),
      saldo_normal:
        req.body?.saldo_normal === 'DEBIT' || req.body?.saldo_normal === 'KREDIT'
          ? req.body.saldo_normal
          : kategori === 'ASET' || kategori === 'BEBAN'
          ? 'DEBIT'
          : 'KREDIT',
      is_kas_bank: Boolean(req.body?.is_kas_bank),
      status_aktif: req.body?.status_aktif !== false,
      keterangan: String(req.body?.keterangan || '').trim(),
    };
    if (existing) {
      Object.assign(existing, payload);
    } else {
      store.coa.push(payload);
    }
    store.addAudit(req.authUser!, 'SIMPAN_COA', 'COA', kode, `${kode} - ${nama}`);
    res.json({ ok: true, account: payload });
  });

  app.post('/api/finance/transactions', requireAuth('KEUANGAN', 'can_create'), (req: AuthedRequest, res) => {
    const jenis = String(req.body?.jenis_transaksi || '').trim().toUpperCase() as TransaksiRecord['jenis_transaksi'];
    const nominal = Number(req.body?.total_nominal);
    const akunKas = String(req.body?.sumber_dana_akun || '').trim();
    const akunLawan = String(req.body?.akun_lawan || '').trim();
    const tgl = String(req.body?.tanggal_transaksi || nowJakartaIso().slice(0, 10)).trim();
    const ket = String(req.body?.keterangan || '').trim();
    const buktiUrl = String(req.body?.bukti_url || '').trim();

    if (!['PEMASUKAN', 'PENGELUARAN', 'MUTASI'].includes(jenis)) {
      res.status(400).json({ ok: false, message: 'Jenis transaksi harus PEMASUKAN, PENGELUARAN, atau MUTASI.' });
      return;
    }
    if (!Number.isFinite(nominal) || nominal <= 0) {
      res.status(400).json({ ok: false, message: 'Nominal transaksi harus angka lebih besar dari 0.' });
      return;
    }
    if (!akunKas || !akunLawan || akunKas === akunLawan) {
      res.status(400).json({ ok: false, message: 'Akun kas/bank dan akun lawan wajib dipilih serta tidak boleh sama.' });
      return;
    }
    if (!store.coa.some((c) => c.kode_akun === akunKas) || !store.coa.some((c) => c.kode_akun === akunLawan)) {
      res.status(400).json({ ok: false, message: 'Kode akun COA tidak ditemukan.' });
      return;
    }
    if (!ket) {
      res.status(400).json({ ok: false, message: 'Keterangan transaksi wajib diisi.' });
      return;
    }
    if (!isSafeHttpUrl(buktiUrl)) {
      res.status(400).json({ ok: false, message: 'URL bukti transaksi harus diawali http:// atau https://.' });
      return;
    }

    const now = nowJakartaIso();
    const trxId = genId('TRX');
    const noTrx = `TRX-${tgl.replace(/-/g, '')}-${trxId.slice(-4)}`;
    const autoVerify = req.authUser!.role_id === 'SUPER_ADMIN' || req.authUser!.role_id === 'BENDAHARA';

    const trxRow: TransaksiRecord = {
      transaksi_id: trxId,
      no_transaksi: noTrx,
      tanggal_transaksi: tgl,
      jenis_transaksi: jenis,
      sumber_dana_akun: akunKas,
      kegiatan_id: String(req.body?.kegiatan_id || '').trim(),
      keterangan: ket,
      total_nominal: nominal,
      status_verifikasi: autoVerify ? 'TERVERIFIKASI' : 'MENUNGGU_VERIFIKASI',
      is_published: Boolean(req.body?.is_published),
      ref_koreksi_id: '',
      pencatat_user_id: req.authUser!.user_id,
      verifikator_user_id: autoVerify ? req.authUser!.user_id : '',
      verified_at: autoVerify ? now : '',
      created_at: now,
    };

    const debitAkun = jenis === 'PENGELUARAN' || jenis === 'MUTASI' ? akunLawan : akunKas;
    const kreditAkun = jenis === 'PENGELUARAN' || jenis === 'MUTASI' ? akunKas : akunLawan;

    const jurnalRows: JurnalEntry[] = [
      {
        jurnal_id: genId('JRN'),
        transaksi_id: trxId,
        tanggal: tgl,
        kode_akun: debitAkun,
        debit: nominal,
        kredit: 0,
        keterangan_baris: ket,
        urutan: 1,
      },
      {
        jurnal_id: genId('JRN'),
        transaksi_id: trxId,
        tanggal: tgl,
        kode_akun: kreditAkun,
        debit: 0,
        kredit: nominal,
        keterangan_baris: ket,
        urutan: 2,
      },
    ];

    const sumDebit = jurnalRows.reduce((s, j) => s + j.debit, 0);
    const sumKredit = jurnalRows.reduce((s, j) => s + j.kredit, 0);
    if (sumDebit !== sumKredit) {
      res.status(400).json({ ok: false, message: 'Jurnal akuntansi tidak seimbang (Debit != Kredit).' });
      return;
    }

    store.transaksi.unshift(trxRow);
    store.jurnal.push(...jurnalRows);

    if (buktiUrl) {
      store.buktiTransaksi.push({
        bukti_id: genId('BKT'),
        transaksi_id: trxId,
        nama_file: String(req.body?.bukti_nama || 'Lampiran Bukti Transaksi').trim(),
        drive_file_id: '',
        drive_url: buktiUrl,
        mime_type: 'link',
        uploaded_by: req.authUser!.username_login,
        uploaded_at: now,
      });
    }

    store.addAudit(req.authUser!, 'CATAT_TRANSAKSI', 'TRANSAKSI', trxId, `${jenis} Rp ${nominal.toLocaleString('id-ID')} - ${ket}`);
    res.json({ ok: true, transaksi: trxRow, jurnal: jurnalRows });
  });

  app.patch('/api/finance/transactions/:id/verify', requireAuth('KEUANGAN', 'can_edit'), (req: AuthedRequest, res) => {
    const trx = store.transaksi.find((t) => t.transaksi_id === req.params.id);
    if (!trx) {
      res.status(404).json({ ok: false, message: 'Transaksi tidak ditemukan.' });
      return;
    }
    const status = String(req.body?.status_verifikasi || 'TERVERIFIKASI').trim().toUpperCase();
    if (!['MENUNGGU_VERIFIKASI', 'TERVERIFIKASI', 'DITOLAK'].includes(status)) {
      res.status(400).json({ ok: false, message: 'Status verifikasi tidak valid.' });
      return;
    }
    trx.status_verifikasi = status as TransaksiRecord['status_verifikasi'];
    if (req.body?.is_published !== undefined) trx.is_published = Boolean(req.body.is_published);
    trx.verifikator_user_id = req.authUser!.user_id;
    trx.verified_at = nowJakartaIso();

    store.addAudit(req.authUser!, 'VERIFIKASI_TRANSAKSI', 'TRANSAKSI', trx.transaksi_id, `Status: ${trx.status_verifikasi}, Publish: ${trx.is_published}`);
    res.json({ ok: true, transaksi: trx });
  });

  app.post('/api/finance/transactions/:id/reverse', requireAuth('KEUANGAN', 'can_edit'), (req: AuthedRequest, res) => {
    const target = store.transaksi.find((t) => t.transaksi_id === req.params.id);
    if (!target) {
      res.status(404).json({ ok: false, message: 'Transaksi referensi tidak ditemukan.' });
      return;
    }
    if (store.transaksi.some((t) => t.ref_koreksi_id === target.transaksi_id)) {
      res.status(409).json({ ok: false, message: 'Transaksi ini sudah pernah dikoreksi sebelumnya.' });
      return;
    }

    const refJurnals = store.jurnal.filter((j) => j.transaksi_id === target.transaksi_id);
    const now = nowJakartaIso();
    const korId = genId('TRX');
    const tgl = now.slice(0, 10);
    const alasan = String(req.body?.alasan || '').trim() || 'Penyesuaian pembukuan';
    const ket = `Koreksi atas ${target.no_transaksi}: ${alasan}`;

    const korTrx: TransaksiRecord = {
      transaksi_id: korId,
      no_transaksi: `KOR-${tgl.replace(/-/g, '')}-${korId.slice(-4)}`,
      tanggal_transaksi: tgl,
      jenis_transaksi: 'KOREKSI',
      sumber_dana_akun: target.sumber_dana_akun,
      kegiatan_id: target.kegiatan_id,
      keterangan: ket,
      total_nominal: target.total_nominal,
      status_verifikasi: 'TERVERIFIKASI',
      is_published: target.is_published,
      ref_koreksi_id: target.transaksi_id,
      pencatat_user_id: req.authUser!.user_id,
      verifikator_user_id: req.authUser!.user_id,
      verified_at: now,
      created_at: now,
    };

    const revJurnals: JurnalEntry[] = refJurnals.map((j, idx) => ({
      jurnal_id: genId('JRN'),
      transaksi_id: korId,
      tanggal: tgl,
      kode_akun: j.kode_akun,
      debit: Number(j.kredit) || 0,
      kredit: Number(j.debit) || 0,
      keterangan_baris: ket,
      urutan: idx + 1,
    }));

    store.transaksi.unshift(korTrx);
    store.jurnal.push(...revJurnals);
    store.addAudit(req.authUser!, 'KOREKSI_TRANSAKSI', 'TRANSAKSI', korId, ket);
    res.json({ ok: true, transaksi: korTrx, jurnal: revJurnals });
  });

  app.post('/api/finance/anggaran', requireAuth('KEUANGAN', 'can_edit'), (req: AuthedRequest, res) => {
    const tahun = parseInt(String(req.body?.tahun_anggaran || '2026'), 10) || 2026;
    const kodeAkun = String(req.body?.kode_akun || '').trim();
    const nominal = Number(req.body?.nominal_anggaran);
    if (!kodeAkun || !Number.isFinite(nominal) || nominal < 0) {
      res.status(400).json({ ok: false, message: 'Kode akun COA dan nominal anggaran valid wajib diisi.' });
      return;
    }
    const id = String(req.body?.anggaran_id || '').trim() || genId('ANG');
    const existing = store.anggaran.find((a) => a.anggaran_id === id);
    const payload: AnggaranRecord = {
      anggaran_id: id,
      tahun_anggaran: tahun,
      kegiatan_id: String(req.body?.kegiatan_id || '').trim(),
      kode_akun: kodeAkun,
      nominal_anggaran: nominal,
      keterangan: String(req.body?.keterangan || '').trim(),
      status_aktif: req.body?.status_aktif !== false,
      created_at: existing ? existing.created_at : nowJakartaIso(),
    };
    if (existing) Object.assign(existing, payload);
    else store.anggaran.push(payload);

    store.addAudit(req.authUser!, 'SIMPAN_ANGGARAN', 'ANGGARAN', id, `${tahun} · ${kodeAkun}: Rp ${nominal.toLocaleString('id-ID')}`);
    res.json({ ok: true, anggaran: payload });
  });

  app.post('/api/iuran/tarif', requireAuth('KEUANGAN', 'can_edit'), (req: AuthedRequest, res) => {
    const tahun = parseInt(String(req.body?.tahun_iuran || '2026'), 10) || 2026;
    const nom = Number(req.body?.nominal_standar);
    if (!Number.isFinite(nom) || nom < 0) {
      res.status(400).json({ ok: false, message: 'Nominal standar tarif tidak valid.' });
      return;
    }
    const id = String(req.body?.tarif_id || '').trim() || `TRF-${tahun}`;
    const existing = store.tarifIuran.find((t) => t.tarif_id === id);
    const payload: TarifIuranRecord = {
      tarif_id: id,
      tahun_iuran: tahun,
      nominal_standar: nom,
      target_total_tahun: Number(req.body?.target_total_tahun) || nom,
      periode_tipe: String(req.body?.periode_tipe || 'TAHUNAN').trim(),
      jatuh_tempo: String(req.body?.jatuh_tempo || `${tahun}-12-31`).trim(),
      keterangan: String(req.body?.keterangan || '').trim(),
      status_aktif: req.body?.status_aktif !== false,
    };
    if (existing) Object.assign(existing, payload);
    else store.tarifIuran.push(payload);

    store.addAudit(req.authUser!, 'SIMPAN_TARIF_IURAN', 'MASTER_TARIF_IURAN', id, `Tarif iuran tahun ${tahun}`);
    res.json({ ok: true, tarif: payload });
  });

  app.post('/api/iuran/bills/generate', requireAuth('KEUANGAN', 'can_create'), (req: AuthedRequest, res) => {
    const tahun = parseInt(String(req.body?.tahun_iuran || '2026'), 10) || 2026;
    const nominal = Number(req.body?.nominal_standar);
    const jatuhTempo = String(req.body?.jatuh_tempo || `${tahun}-12-31`).trim();
    if (!Number.isFinite(nominal) || nominal <= 0) {
      res.status(400).json({ ok: false, message: 'Nominal standar target iuran harus lebih dari 0.' });
      return;
    }

    const existingTahun = store.tagihanIuran.filter((b) => Number(b.tahun_iuran) === tahun);
    const coveredIds = new Set<string>();
    existingTahun.forEach((b) => {
      if (b.id_rumah_tangga) coveredIds.add(b.id_rumah_tangga);
      if (b.id_kk) coveredIds.add(b.id_kk);
    });

    const now = nowJakartaIso();
    let createdCount = 0;
    let seq = existingTahun.length + 1;
    store.households
      .filter((h) => h.status_aktif)
      .forEach((h) => {
        if (coveredIds.has(h.id_rumah_tangga) || coveredIds.has(h.id_kepala_keluarga)) return;
        const bill: TagihanIuranRecord = {
          tagihan_id: `TGH-${tahun}-${String(seq++).padStart(4, '0')}`,
          tahun_iuran: tahun,
          id_rumah_tangga: h.id_rumah_tangga,
          id_kk: h.id_kepala_keluarga,
          nominal_tagihan: nominal,
          diskon_pembebasan: 0,
          alasan_pembebasan: '',
          total_terbayar: 0,
          sisa_tagihan: nominal,
          status_bayar: 'BELUM_LUNAS',
          jatuh_tempo: jatuhTempo,
          updated_at: now,
        };
        store.tagihanIuran.push(bill);
        createdCount++;
      });

    store.addAudit(req.authUser!, 'GENERATE_TARGET_IURAN', 'TAGIHAN_IURAN', String(tahun), `Buat ${createdCount} target iuran tahun ${tahun}`);
    res.json({ ok: true, createdCount });
  });

  app.patch('/api/iuran/bills/:id', requireAuth('KEUANGAN', 'can_edit'), (req: AuthedRequest, res) => {
    const bill = store.tagihanIuran.find((b) => b.tagihan_id === req.params.id);
    if (!bill) {
      res.status(404).json({ ok: false, message: 'Data target iuran tidak ditemukan.' });
      return;
    }
    const nom = req.body?.nominal_tagihan !== undefined ? Number(req.body.nominal_tagihan) : bill.nominal_tagihan;
    const disc = req.body?.diskon_pembebasan !== undefined ? Number(req.body.diskon_pembebasan) : bill.diskon_pembebasan;
    if (!Number.isFinite(nom) || nom < 0 || !Number.isFinite(disc) || disc < 0) {
      res.status(400).json({ ok: false, message: 'Nominal target dan diskon tidak boleh negatif.' });
      return;
    }
    const netTarget = Math.max(nom - disc, 0);
    const paid = Number(bill.total_terbayar) || 0;
    const sisa = Math.max(netTarget - paid, 0);
    const status: TagihanIuranRecord['status_bayar'] =
      sisa === 0 ? (disc >= nom && paid === 0 ? 'DIBEBASKAN' : 'LUNAS') : paid > 0 ? 'SEBAGIAN' : 'BELUM_LUNAS';

    bill.nominal_tagihan = nom;
    bill.diskon_pembebasan = disc;
    bill.alasan_pembebasan = String(req.body?.alasan_pembebasan ?? bill.alasan_pembebasan).trim();
    bill.sisa_tagihan = sisa;
    bill.status_bayar = status;
    bill.updated_at = nowJakartaIso();

    store.addAudit(req.authUser!, 'EDIT_TARGET_IURAN', 'TAGIHAN_IURAN', bill.tagihan_id, `Target Rp ${nom.toLocaleString('id-ID')}, Keringanan Rp ${disc.toLocaleString('id-ID')}`);
    res.json({ ok: true, bill });
  });

  app.post('/api/iuran/payments', requireAuth('KEUANGAN', 'can_create'), (req: AuthedRequest, res) => {
    const tagihanId = String(req.body?.tagihan_id || '').trim();
    const nominalBayar = Number(req.body?.nominal_bayar);
    const metode = String(req.body?.metode_bayar || 'TRANSFER_BANK').trim().toUpperCase() as PembayaranRecord['metode_bayar'];
    const akunKas = String(req.body?.akun_kas || '1103').trim();
    const tglBayar = String(req.body?.tanggal_bayar || nowJakartaIso().slice(0, 10)).trim();
    const ket = String(req.body?.keterangan || 'Pembayaran iuran keluarga besar').trim();

    if (!Number.isFinite(nominalBayar) || nominalBayar <= 0) {
      res.status(400).json({ ok: false, message: 'Nominal pembayaran harus lebih dari 0.' });
      return;
    }
    if (!['TUNAI', 'TRANSFER_BANK', 'QRIS'].includes(metode)) {
      res.status(400).json({ ok: false, message: 'Metode pembayaran harus TUNAI, TRANSFER_BANK, atau QRIS.' });
      return;
    }
    const bill = store.tagihanIuran.find((b) => b.tagihan_id === tagihanId);
    if (!bill) {
      res.status(404).json({ ok: false, message: 'Target iuran tidak ditemukan.' });
      return;
    }
    if (!store.coa.some((c) => c.kode_akun === akunKas && c.is_kas_bank)) {
      res.status(400).json({ ok: false, message: 'Akun penerimaan harus merupakan akun Kas/Bank yang aktif.' });
      return;
    }

    const netTarget = Math.max((Number(bill.nominal_tagihan) || 0) - (Number(bill.diskon_pembebasan) || 0), 0);
    const nextPaid = (Number(bill.total_terbayar) || 0) + nominalBayar;
    const nextSisa = Math.max(netTarget - nextPaid, 0);
    const nextStatus: TagihanIuranRecord['status_bayar'] = nextSisa === 0 ? 'LUNAS' : 'SEBAGIAN';
    const now = nowJakartaIso();

    const trxId = genId('TRX');
    const payId = genId('PAY');
    const noKuitansi = `KUI-${bill.tahun_iuran}-${payId.slice(-4)}`;

    const trxRow: TransaksiRecord = {
      transaksi_id: trxId,
      no_transaksi: `IUR-${tglBayar.replace(/-/g, '')}-${trxId.slice(-4)}`,
      tanggal_transaksi: tglBayar,
      jenis_transaksi: 'PEMASUKAN',
      sumber_dana_akun: akunKas,
      kegiatan_id: '',
      keterangan: `Pembayaran Iuran ${bill.tahun_iuran} (${noKuitansi}) - ${ket}`,
      total_nominal: nominalBayar,
      status_verifikasi: 'TERVERIFIKASI',
      is_published: true,
      ref_koreksi_id: '',
      pencatat_user_id: req.authUser!.user_id,
      verifikator_user_id: req.authUser!.user_id,
      verified_at: now,
      created_at: now,
    };

    const jurnalRows: JurnalEntry[] = [
      {
        jurnal_id: genId('JRN'),
        transaksi_id: trxId,
        tanggal: tglBayar,
        kode_akun: akunKas,
        debit: nominalBayar,
        kredit: 0,
        keterangan_baris: noKuitansi,
        urutan: 1,
      },
      {
        jurnal_id: genId('JRN'),
        transaksi_id: trxId,
        tanggal: tglBayar,
        kode_akun: '4101',
        debit: 0,
        kredit: nominalBayar,
        keterangan_baris: noKuitansi,
        urutan: 2,
      },
    ];

    const payRow: PembayaranRecord = {
      pembayaran_id: payId,
      tagihan_id: tagihanId,
      id_rumah_tangga: bill.id_rumah_tangga || '',
      tahun_iuran: bill.tahun_iuran,
      tanggal_bayar: tglBayar,
      nominal_bayar: nominalBayar,
      metode_bayar: metode,
      transaksi_id: trxId,
      petugas_user_id: req.authUser!.user_id,
      no_kuitansi: noKuitansi,
      kuitansi_drive_id: '',
      bukti_id: '',
      keterangan: ket,
      created_at: now,
    };

    bill.total_terbayar = nextPaid;
    bill.sisa_tagihan = nextSisa;
    bill.status_bayar = nextStatus;
    bill.updated_at = now;

    store.pembayaran.unshift(payRow);
    store.transaksi.unshift(trxRow);
    store.jurnal.push(...jurnalRows);

    store.addAudit(req.authUser!, 'BAYAR_IURAN', 'PEMBAYARAN', payId, `${noKuitansi} Rp ${nominalBayar.toLocaleString('id-ID')}`);
    res.json({ ok: true, pembayaran: payRow, bill, no_kuitansi: noKuitansi });
  });

  // =========================================================
  // TAHAP 4: ORGANISASI, PENGURUS, KEGIATAN, PENGUMUMAN, SURAT & ARSIP
  // =========================================================
  app.get('/api/organization/bundle', requireAuth('ORGANISASI', 'can_view'), (req: AuthedRequest, res) => {
    const role = req.authUser!.role_id;
    const isPengurusPlus = ['SUPER_ADMIN', 'ADMIN_KELUARGA', 'PENGURUS', 'SEKRETARIS', 'BENDAHARA'].includes(role);
    const memberMap = new Map(store.members.map((m) => [m.id_anggota, m]));
    const jabMap = new Map(store.jabatan.map((j) => [j.jabatan_id, j]));

    const pengurus = store.pengurus.map((p) => {
      const m = memberMap.get(p.id_anggota);
      const j = jabMap.get(p.jabatan_id);
      return {
        ...p,
        nama_anggota: m ? [m.gelar_depan, m.nama_lengkap, m.gelar_belakang].filter(Boolean).join(' ') : p.id_anggota,
        kode_silsilah: m?.kode_silsilah || '',
        generasi_level: m?.generasi_level ?? null,
        generasi_label: m?.generasi_label || '',
        status_keturunan: m?.status_keturunan || '',
        alamat_lengkap: m ? formatMemberAddress(m) : '',
        no_hp: m?.no_hp || '',
        email: m?.email || '',
        foto_drive_id: m?.foto_drive_id || '',
        nama_jabatan: j?.nama_jabatan || p.jabatan_id,
        deskripsi_tugas: j?.deskripsi_tugas || '',
        level_hierarki: j?.level_hierarki || 99,
      };
    });

    const kegiatan = store.kegiatan.map((k) => {
      const pj = memberMap.get(k.id_penanggung_jawab);
      return {
        ...k,
        nama_pj: pj?.nama_lengkap || k.id_penanggung_jawab || '-',
      };
    });

    const pengumuman = store.pengumuman.filter((a) => {
      if (!a.status_aktif) return false;
      if (!isPengurusPlus && a.target_audiens === 'PENGURUS') return false;
      return true;
    });

    const surat = isPengurusPlus ? store.surat : store.surat.filter((s) => s.status_surat === 'TERBIT');
    const arsip = store.arsip.filter((doc) => isPengurusPlus || doc.visibilitas !== 'KHUSUS_PENGURUS');

    res.json({
      ok: true,
      canManageOrg: Boolean(ROLE_MATRIX[role]?.ORGANISASI?.can_edit),
      canManageSurat: Boolean(ROLE_MATRIX[role]?.SURAT?.can_edit),
      jabatan: store.jabatan,
      pengurus,
      kegiatan,
      pengumuman,
      surat,
      undangan: store.undangan,
      arsip,
    });
  });

  app.post('/api/organization/announcements', requireAuth('ORGANISASI', 'can_create'), (req: AuthedRequest, res) => {
    const judul = String(req.body?.judul || '').trim();
    const isi = String(req.body?.isi || '').trim();
    if (!judul || !isi) {
      res.status(400).json({ ok: false, message: 'Judul dan isi pengumuman wajib diisi.' });
      return;
    }
    const id = String(req.body?.pengumuman_id || '').trim() || genId('PNG');
    const existing = store.pengumuman.find((a) => a.pengumuman_id === id);
    const now = nowJakartaIso();
    const payload: PengumumanRecord = {
      pengumuman_id: id,
      judul,
      kategori: (req.body?.kategori || 'UMUM') as PengumumanRecord['kategori'],
      isi,
      target_audiens: (req.body?.target_audiens || 'SEMUA') as PengumumanRecord['target_audiens'],
      is_pinned: Boolean(req.body?.is_pinned),
      tanggal_publikasi: String(req.body?.tanggal_publikasi || now.slice(0, 10)).trim(),
      status_aktif: req.body?.status_aktif !== false,
      penulis_user_id: req.authUser!.user_id,
      created_at: existing ? existing.created_at : now,
    };
    if (existing) Object.assign(existing, payload);
    else store.pengumuman.unshift(payload);

    store.addAudit(req.authUser!, 'TERBIT_PENGUMUMAN', 'PENGUMUMAN', id, judul);
    res.json({ ok: true, pengumuman: payload });
  });

  app.post('/api/organization/board', requireAuth('ORGANISASI', 'can_edit'), (req: AuthedRequest, res) => {
    const jabId = String(req.body?.jabatan_id || '').trim();
    const idAnggota = String(req.body?.id_anggota || '').trim();
    if (!jabId || !idAnggota) {
      res.status(400).json({ ok: false, message: 'Jabatan dan anggota wajib dipilih.' });
      return;
    }
    const targetMember = store.members.find((m) => m.id_anggota === idAnggota);
    if (!targetMember) {
      res.status(404).json({ ok: false, message: 'Anggota tidak ditemukan.' });
      return;
    }
    const id = String(req.body?.pengurus_id || '').trim() || genId('PGR');
    const existing = store.pengurus.find((p) => p.pengurus_id === id);
    const payload: PengurusRecord = {
      pengurus_id: id,
      jabatan_id: jabId,
      id_anggota: idAnggota,
      periode_nama: String(req.body?.periode_nama || '2026-2029').trim(),
      tanggal_mulai: String(req.body?.tanggal_mulai || nowJakartaIso().slice(0, 10)).trim(),
      tanggal_berakhir: String(req.body?.tanggal_berakhir || '').trim(),
      no_sk: String(req.body?.no_sk || '').trim(),
      dokumen_sk_drive_id: String(req.body?.dokumen_sk_drive_id || '').trim(),
      status_aktif: req.body?.status_aktif !== false,
      keterangan: String(req.body?.keterangan || '').trim(),
      created_at: existing ? existing.created_at : nowJakartaIso(),
    };
    if (existing) Object.assign(existing, payload);
    else store.pengurus.push(payload);

    const mu = req.body?.member_updates;
    if (mu && typeof mu === 'object') {
      if (mu.foto_drive_id !== undefined) targetMember.foto_drive_id = sanitizePhotoInput(mu.foto_drive_id);
      if (mu.no_hp !== undefined) targetMember.no_hp = String(mu.no_hp).trim();
      if (mu.email !== undefined) targetMember.email = String(mu.email).trim();
      if (mu.keterangan_alamat !== undefined) targetMember.keterangan_alamat = String(mu.keterangan_alamat).trim();
      targetMember.updated_at = nowJakartaIso();
    }

    store.saveToDisk();
    store.addAudit(req.authUser!, 'SIMPAN_PENGURUS', 'PENGURUS', id, `${jabId} -> ${idAnggota}`);
    res.json({ ok: true, pengurus: payload });
  });

  app.delete('/api/organization/board/:id', requireAuth('ORGANISASI', 'can_edit'), (req: AuthedRequest, res) => {
    const idx = store.pengurus.findIndex((p) => p.pengurus_id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ ok: false, message: 'Data pengurus tidak ditemukan.' });
      return;
    }
    const [removed] = store.pengurus.splice(idx, 1);
    store.saveToDisk();
    store.addAudit(req.authUser!, 'HAPUS_PENGURUS', 'PENGURUS', removed.pengurus_id, `${removed.jabatan_id} -> ${removed.id_anggota}`);
    res.json({ ok: true });
  });

  app.post('/api/organization/activities', requireAuth('ORGANISASI', 'can_create'), (req: AuthedRequest, res) => {
    const nama = String(req.body?.nama_kegiatan || '').trim();
    if (!nama) {
      res.status(400).json({ ok: false, message: 'Nama kegiatan wajib diisi.' });
      return;
    }
    const anggaran = Number(req.body?.anggaran_rencana || 0);
    if (!Number.isFinite(anggaran) || anggaran < 0) {
      res.status(400).json({ ok: false, message: 'Rencana anggaran tidak valid.' });
      return;
    }
    const id = String(req.body?.kegiatan_id || '').trim() || genId('KGT');
    const existing = store.kegiatan.find((k) => k.kegiatan_id === id);
    const payload: KegiatanRecord = {
      kegiatan_id: id,
      nama_kegiatan: nama,
      kategori_kegiatan: String(req.body?.kategori_kegiatan || 'SILATURAHMI').trim(),
      tanggal_mulai: String(req.body?.tanggal_mulai || nowJakartaIso().slice(0, 10)).trim(),
      tanggal_selesai: String(req.body?.tanggal_selesai || '').trim(),
      lokasi: String(req.body?.lokasi || '').trim(),
      id_penanggung_jawab: String(req.body?.id_penanggung_jawab || '').trim(),
      coa_terkait: String(req.body?.coa_terkait || '5101').trim(),
      anggaran_rencana: anggaran,
      status_kegiatan: (req.body?.status_kegiatan || 'TERJADWAL') as KegiatanRecord['status_kegiatan'],
      deskripsi: String(req.body?.deskripsi || '').trim(),
      created_at: existing ? existing.created_at : nowJakartaIso(),
      created_by: existing ? existing.created_by : req.authUser!.username_login,
    };
    if (existing) Object.assign(existing, payload);
    else store.kegiatan.unshift(payload);

    store.addAudit(req.authUser!, 'SIMPAN_KEGIATAN', 'KEGIATAN', id, nama);
    res.json({ ok: true, kegiatan: payload });
  });

  app.get('/api/letters', requireAuth('SURAT', 'can_view'), (req: AuthedRequest, res) => {
    const role = req.authUser!.role_id;
    const isPengurusPlus = ['SUPER_ADMIN', 'ADMIN_KELUARGA', 'PENGURUS', 'SEKRETARIS', 'BENDAHARA'].includes(role);
    const surat = isPengurusPlus ? store.surat : store.surat.filter((s) => s.status_surat === 'TERBIT');
    res.json({ ok: true, surat });
  });

  app.post('/api/letters', requireAuth('SURAT', 'can_create'), (req: AuthedRequest, res) => {
    const perihal = String(req.body?.perihal || '').trim();
    if (!perihal) {
      res.status(400).json({ ok: false, message: 'Perihal surat wajib diisi.' });
      return;
    }
    const now = nowJakartaIso();
    const seq = String(store.surat.length + 1).padStart(3, '0');
    const id = String(req.body?.surat_id || '').trim() || genId('SRT');
    const existing = store.surat.find((s) => s.surat_id === id);
    const nomor = String(req.body?.nomor_surat || '').trim() || (existing ? existing.nomor_surat : `${seq}/BMT/${now.slice(5, 7)}/${now.slice(0, 4)}`);

    const payload: SuratRecord = {
      surat_id: id,
      nomor_surat: nomor,
      jenis_surat: (req.body?.jenis_surat || 'UNDANGAN_ACARA') as SuratRecord['jenis_surat'],
      template_doc_id: '',
      perihal,
      isi_surat: String(req.body?.isi_surat || '').trim(),
      tanggal_surat: String(req.body?.tanggal_surat || now.slice(0, 10)).trim(),
      penerima_tipe: (req.body?.penerima_tipe || 'SEMUA_KELUARGA') as SuratRecord['penerima_tipe'],
      penerima_id: String(req.body?.penerima_id || '').trim(),
      pejabat_ttd_id: String(req.body?.pejabat_ttd_id || '').trim(),
      doc_drive_id: '',
      pdf_drive_id: '',
      status_surat: (req.body?.status_surat || 'TERBIT') as SuratRecord['status_surat'],
      created_at: existing ? existing.created_at : now,
      created_by: existing ? existing.created_by : req.authUser!.username_login,
    };
    if (existing) Object.assign(existing, payload);
    else store.surat.unshift(payload);

    store.addAudit(req.authUser!, 'BUAT_SURAT', 'SURAT', id, `${nomor} - ${perihal}`);
    res.json({ ok: true, surat: payload });
  });

  app.post('/api/invitations', requireAuth('SURAT', 'can_create'), (req: AuthedRequest, res) => {
    const id = String(req.body?.undangan_id || '').trim() || genId('UND');
    const payload: UndanganRecord = {
      undangan_id: id,
      kegiatan_id: String(req.body?.kegiatan_id || '').trim(),
      surat_id: String(req.body?.surat_id || '').trim(),
      target_tipe: (req.body?.target_tipe || 'SEMUA_KELUARGA') as UndanganRecord['target_tipe'],
      target_id: String(req.body?.target_id || '').trim(),
      status_kirim: 'TERKIRIM',
      tanggal_kirim: nowJakartaIso().slice(0, 10),
      status_hadir: 'BELUM_KONFIRMASI',
      file_pdf_drive_id: '',
      created_at: nowJakartaIso(),
    };
    store.undangan.unshift(payload);
    store.addAudit(req.authUser!, 'KIRIM_UNDANGAN', 'UNDANGAN', id, `${payload.target_tipe} (${payload.kegiatan_id || '-'})`);
    res.json({ ok: true, undangan: payload });
  });

  app.patch('/api/invitations/:id/rsvp', requireAuth('SURAT', 'can_view'), (req: AuthedRequest, res) => {
    const inv = store.undangan.find((u) => u.undangan_id === req.params.id);
    if (!inv) {
      res.status(404).json({ ok: false, message: 'Undangan tidak ditemukan.' });
      return;
    }
    const status = String(req.body?.status_hadir || '').trim().toUpperCase();
    if (!['BELUM_KONFIRMASI', 'HADIR', 'TIDAK_HADIR', 'RAGU'].includes(status)) {
      res.status(400).json({ ok: false, message: 'Status RSVP tidak valid.' });
      return;
    }
    inv.status_hadir = status as UndanganRecord['status_hadir'];
    store.addAudit(req.authUser!, 'RSVP_UNDANGAN', 'UNDANGAN', inv.undangan_id, `RSVP: ${status}`);
    res.json({ ok: true, undangan: inv });
  });

  app.post('/api/archives', requireAuth('SURAT', 'can_create'), (req: AuthedRequest, res) => {
    const judul = String(req.body?.judul || '').trim();
    const url = String(req.body?.drive_url || '').trim();
    if (!judul) {
      res.status(400).json({ ok: false, message: 'Judul dokumen arsip wajib diisi.' });
      return;
    }
    if (!isSafeHttpUrl(url)) {
      res.status(400).json({ ok: false, message: 'URL tautan arsip harus diawali http:// atau https://.' });
      return;
    }
    const id = String(req.body?.arsip_id || '').trim() || genId('ARS');
    const existing = store.arsip.find((a) => a.arsip_id === id);
    const payload: ArsipRecord = {
      arsip_id: id,
      kategori_arsip: (req.body?.kategori_arsip || 'NOTULEN') as ArsipRecord['kategori_arsip'],
      judul,
      tanggal_dokumen: String(req.body?.tanggal_dokumen || nowJakartaIso().slice(0, 10)).trim(),
      kegiatan_id: String(req.body?.kegiatan_id || '').trim(),
      drive_file_id: String(req.body?.drive_file_id || '').trim(),
      drive_url: url,
      deskripsi: String(req.body?.deskripsi || '').trim(),
      visibilitas: (req.body?.visibilitas || 'PUBLIK_KELUARGA') as ArsipRecord['visibilitas'],
      uploaded_by: req.authUser!.username_login,
      uploaded_at: existing ? existing.uploaded_at : nowJakartaIso(),
    };
    if (existing) Object.assign(existing, payload);
    else store.arsip.unshift(payload);

    store.addAudit(req.authUser!, 'TAMBAH_ARSIP', 'ARSIP', id, judul);
    res.json({ ok: true, arsip: payload });
  });

  app.get('/api/users', requireAuth('USERS', 'can_view'), (_req, res) => {
    res.json({ ok: true, users: store.users.map(projectSafeUser), roleMatrix: ROLE_MATRIX });
  });

  app.post('/api/users', requireAuth('USERS', 'can_create'), (req: AuthedRequest, res) => {
    const uname = String(req.body?.username_login || '').trim().toLowerCase();
    const nama = String(req.body?.nama_tampilan || '').trim();
    const role = String(req.body?.role_id || 'ANGGOTA') as RoleId;
    const pwd = String(req.body?.password || '');

    if (uname.length < 4 || !nama || pwd.length < 8) {
      res.status(400).json({ ok: false, message: 'ID Login (min 4), nama, dan password (min 8) wajib valid.' });
      return;
    }
    if (!ROLE_MATRIX[role]) {
      res.status(400).json({ ok: false, message: 'Role tidak dikenal.' });
      return;
    }
    if (store.users.some((u) => u.username_login === uname)) {
      res.status(409).json({ ok: false, message: `ID Login "${uname}" sudah terdaftar.` });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const now = nowJakartaIso();
    const user: UserRecord = {
      user_id: 'USR-' + String(store.users.length + 1).padStart(4, '0'),
      id_anggota: '',
      username_login: uname,
      nama_tampilan: nama,
      password_hash: hashPassword(pwd, salt),
      salt,
      role_id: role,
      status_akun: 'AKTIF',
      failed_attempts: 0,
      locked_until: '',
      last_login: '',
      must_change_pwd: true,
      created_at: now,
      updated_at: now,
    };
    store.users.push(user);
    store.addAudit(req.authUser!, 'TAMBAH_USER', 'USERS', user.user_id, `Menambah akun ${uname} (${role})`);
    res.json({ ok: true, user: projectSafeUser(user) });
  });

  app.patch('/api/users/:id', requireAuth('USERS', 'can_edit'), (req: AuthedRequest, res) => {
    const target = store.users.find((u) => u.user_id === req.params.id);
    if (!target) {
      res.status(404).json({ ok: false, message: 'Akun tidak ditemukan.' });
      return;
    }
    const nextRole = (req.body?.role_id || target.role_id) as RoleId;
    const nextStatus = (req.body?.status_akun || target.status_akun) as 'AKTIF' | 'NONAKTIF';
    const activeAdmins = store.users.filter((u) => u.role_id === 'SUPER_ADMIN' && u.status_akun === 'AKTIF').length;

    if (target.role_id === 'SUPER_ADMIN' && target.status_akun === 'AKTIF' && (nextRole !== 'SUPER_ADMIN' || nextStatus !== 'AKTIF') && activeAdmins <= 1) {
      res.status(400).json({ ok: false, message: 'Minimal harus ada 1 akun SUPER ADMIN aktif.' });
      return;
    }
    target.role_id = nextRole;
    target.status_akun = nextStatus;
    target.updated_at = nowJakartaIso();
    store.addAudit(req.authUser!, 'UBAH_USER', 'USERS', target.user_id, `Role: ${nextRole}, Status: ${nextStatus}`);
    res.json({ ok: true, user: projectSafeUser(target) });
  });

  app.post('/api/users/:id/reset-password', requireAuth('USERS', 'can_edit'), (req: AuthedRequest, res) => {
    const target = store.users.find((u) => u.user_id === req.params.id);
    const tempPwd = String(req.body?.tempPassword || '');
    if (!target) {
      res.status(404).json({ ok: false, message: 'Akun tidak ditemukan.' });
      return;
    }
    if (tempPwd.length < 8) {
      res.status(400).json({ ok: false, message: 'Password sementara minimal 8 karakter.' });
      return;
    }
    const salt = crypto.randomBytes(16).toString('hex');
    target.salt = salt;
    target.password_hash = hashPassword(tempPwd, salt);
    target.failed_attempts = 0;
    target.locked_until = '';
    target.must_change_pwd = true;
    target.updated_at = nowJakartaIso();
    store.addAudit(req.authUser!, 'RESET_PASSWORD_ADMIN', 'USERS', target.user_id, `Reset password untuk ${target.username_login}`);
    res.json({ ok: true, message: 'Password berhasil direset.' });
  });

  app.get('/api/audit-logs', requireAuth('AUDIT_LOG', 'can_view'), (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const list = q
      ? store.auditLogs.filter((l) => `${l.username} ${l.aksi} ${l.entitas} ${l.catatan}`.toLowerCase().includes(q))
      : store.auditLogs;
    res.json({ ok: true, logs: list.slice(0, 150) });
  });

  app.get('/api/backup', requireAuth('PENGATURAN', 'can_export'), (req: AuthedRequest, res) => {
    store.addAudit(req.authUser!, 'BACKUP_EXPORT', 'SYSTEM', 'JSON', 'Ekspor backup lengkap database Tahap 4');
    res.json({
      ok: true,
      exportedAt: nowJakartaIso(),
      members: store.members,
      couples: store.couples,
      parentRelations: store.parentRelations,
      households: store.households,
      householdMembers: store.householdMembers,
      kkHistory: store.kkHistory,
      masterGenerasi: store.masterGenerasi,
      masterPendidikan: store.masterPendidikan,
      masterPekerjaan: store.masterPekerjaan,
      masterWilayah: store.masterWilayah,
      coa: store.coa,
      anggaran: store.anggaran,
      tarifIuran: store.tarifIuran,
      tagihanIuran: store.tagihanIuran,
      pembayaran: store.pembayaran,
      transaksi: store.transaksi,
      jurnal: store.jurnal,
      buktiTransaksi: store.buktiTransaksi,
      jabatan: store.jabatan,
      pengurus: store.pengurus,
      kegiatan: store.kegiatan,
      pengumuman: store.pengumuman,
      surat: store.surat,
      undangan: store.undangan,
      arsip: store.arsip,
      staging: store.staging,
      users: store.users.map(projectSafeUser),
      auditLogs: store.auditLogs,
    });
  });

  app.get('/api/gas-files', requireAuth(), (_req, res) => {
    const gasDir = path.resolve(process.cwd(), 'gas');
    if (!fs.existsSync(gasDir)) {
      res.json({ ok: true, files: [] });
      return;
    }
    const entries = fs.readdirSync(gasDir).sort();
    const files = entries
      .map((name) => {
        const resolved = path.resolve(gasDir, name);
        if (!resolved.startsWith(gasDir + path.sep)) return null;
        if (!fs.statSync(resolved).isFile()) return null;
        return { name, content: fs.readFileSync(resolved, 'utf8') };
      })
      .filter(Boolean);
    res.json({ ok: true, files });
  });

  app.all('/api/*', (_req, res) => {
    res.status(404).json({ ok: false, message: 'Endpoint API tidak ditemukan.' });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Bani H. M. Tohir Stage 4 server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
