import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildRelationalGraphFromMembers,
  HouseholdMemberRecord,
  HouseholdRecord,
  KkHistoryRecord,
  ParentChildRelation,
  SEED_GENERASI,
  SEED_PEKERJAAN,
  SEED_PENDIDIKAN,
  SEED_WILAYAH,
  SimpleMasterItem,
  SpouseRelation,
  WilayahItem,
} from './stage3.ts';
import {
  AnggaranRecord,
  ArsipRecord,
  buildTargetIuranFromMembers,
  BuktiTransaksiRecord,
  CoaAccount,
  JabatanRecord,
  JurnalEntry,
  KegiatanRecord,
  PembayaranRecord,
  PengumumanRecord,
  PengurusRecord,
  SEED_COA,
  SEED_JABATAN,
  SEED_PENGUMUMAN,
  SEED_TARIF_IURAN,
  SuratRecord,
  TagihanIuranRecord,
  TarifIuranRecord,
  TransaksiRecord,
  UndanganRecord,
} from './stage4.ts';

export type RoleId =
  | 'SUPER_ADMIN'
  | 'ADMIN_KELUARGA'
  | 'PENGURUS'
  | 'BENDAHARA'
  | 'SEKRETARIS'
  | 'ANGGOTA';

export interface UserRecord {
  user_id: string;
  id_anggota: string;
  username_login: string;
  nama_tampilan: string;
  password_hash: string;
  salt: string;
  role_id: RoleId;
  status_akun: 'AKTIF' | 'NONAKTIF';
  failed_attempts: number;
  locked_until: string;
  last_login: string;
  must_change_pwd: boolean;
  created_at: string;
  updated_at: string;
}

export interface SafeUser {
  user_id: string;
  id_anggota: string;
  username_login: string;
  nama_tampilan: string;
  role_id: RoleId;
  status_akun: 'AKTIF' | 'NONAKTIF';
  last_login: string;
  must_change_pwd: boolean;
}

export interface StagingRow {
  staging_id: string;
  raw_row_no: number;
  raw_no: string;
  raw_kode: string;
  generated_kode: string;
  code_resolution_mode: 'AUTO_GENERATE' | 'KEEP_RAW';
  id_anggota_calon: string;
  gelar_depan: string;
  nama_lengkap: string;
  gelar_belakang: string;
  status_keturunan: string;
  generasi_level: number;
  generasi_label: string;
  tempat_lahir: string;
  tanggal_lahir_iso: string;
  presisi_tgl_lahir: string;
  raw_ttl: string;
  status_hidup: 'HIDUP' | 'WAFAT' | 'TIDAK_DIKETAHUI';
  tanggal_wafat_raw: string;
  is_kk: boolean;
  pekerjaan_raw: string;
  alamat_raw: string;
  email: string;
  no_hp: string;
  iuran_nominal: number;
  is_multi_spouse_group: boolean;
  anomaly_flags: string[];
  action_status: 'SIAP' | 'SKIP';
  updated_at: string;
}

export interface MemberRecord {
  id_anggota: string;
  kode_silsilah: string;
  kode_legacy: string;
  gelar_depan: string;
  nama_lengkap: string;
  gelar_belakang: string;
  nama_panggilan?: string;
  jenis_kelamin?: string;
  foto_drive_id?: string;
  status_keturunan: string;
  generasi_level: number;
  generasi_label: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  presisi_tgl_lahir: string;
  status_hidup: 'HIDUP' | 'WAFAT' | 'TIDAK_DIKETAHUI';
  tanggal_wafat: string;
  tempat_wafat?: string;
  catatan_wafat?: string;
  provinsi_id?: string;
  kabkota_id?: string;
  kecamatan_id?: string;
  kelurahan_id?: string;
  nama_jalan?: string;
  rt?: string;
  rw?: string;
  no_rumah?: string;
  kode_pos?: string;
  keterangan_alamat: string;
  email: string;
  no_hp: string;
  no_hp_alt?: string;
  pendidikan_id?: string;
  pekerjaan_id?: string;
  pekerjaan_lainnya: string;
  is_kk: boolean;
  status_keanggotaan?: string;
  tanggal_gabung?: string;
  catatan?: string;
  is_archived?: boolean;
  iuran_nominal: number;
  needs_verification: boolean;
  updated_at: string;
}

export interface AuditLogEntry {
  log_id: string;
  timestamp: string;
  user_id: string;
  username: string;
  role: string;
  aksi: string;
  entitas: string;
  record_id: string;
  catatan: string;
}

export interface ModulePermission {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
  view_sensitive_contact: boolean;
  view_finance_detail: boolean;
}

export const ROLE_MATRIX: Record<RoleId, Record<string, ModulePermission>> = {
  SUPER_ADMIN: {
    DASHBOARD: { can_view: true, can_create: true, can_edit: true, can_delete: true, can_export: true, view_sensitive_contact: true, view_finance_detail: true },
    ANGGOTA: { can_view: true, can_create: true, can_edit: true, can_delete: true, can_export: true, view_sensitive_contact: true, view_finance_detail: false },
    SILSILAH: { can_view: true, can_create: true, can_edit: true, can_delete: true, can_export: true, view_sensitive_contact: true, view_finance_detail: false },
    RUMAH_TANGGA: { can_view: true, can_create: true, can_edit: true, can_delete: true, can_export: true, view_sensitive_contact: true, view_finance_detail: false },
    ORGANISASI: { can_view: true, can_create: true, can_edit: true, can_delete: true, can_export: true, view_sensitive_contact: false, view_finance_detail: false },
    KEUANGAN: { can_view: true, can_create: true, can_edit: true, can_delete: true, can_export: true, view_sensitive_contact: true, view_finance_detail: true },
    SURAT: { can_view: true, can_create: true, can_edit: true, can_delete: true, can_export: true, view_sensitive_contact: true, view_finance_detail: false },
    LAPORAN: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: true, view_sensitive_contact: true, view_finance_detail: true },
    MIGRASI: { can_view: true, can_create: true, can_edit: true, can_delete: true, can_export: true, view_sensitive_contact: true, view_finance_detail: false },
    USERS: { can_view: true, can_create: true, can_edit: true, can_delete: true, can_export: true, view_sensitive_contact: true, view_finance_detail: false },
    AUDIT_LOG: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: true, view_sensitive_contact: true, view_finance_detail: true },
    PENGATURAN: { can_view: true, can_create: true, can_edit: true, can_delete: true, can_export: true, view_sensitive_contact: true, view_finance_detail: true },
  },
  ADMIN_KELUARGA: {
    DASHBOARD: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: true, view_sensitive_contact: true, view_finance_detail: false },
    ANGGOTA: { can_view: true, can_create: true, can_edit: true, can_delete: true, can_export: true, view_sensitive_contact: true, view_finance_detail: false },
    SILSILAH: { can_view: true, can_create: true, can_edit: true, can_delete: true, can_export: true, view_sensitive_contact: true, view_finance_detail: false },
    RUMAH_TANGGA: { can_view: true, can_create: true, can_edit: true, can_delete: true, can_export: true, view_sensitive_contact: true, view_finance_detail: false },
    ORGANISASI: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: true, view_sensitive_contact: false, view_finance_detail: false },
    KEUANGAN: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    SURAT: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: true, view_sensitive_contact: false, view_finance_detail: false },
    LAPORAN: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: true, view_sensitive_contact: false, view_finance_detail: false },
    MIGRASI: { can_view: true, can_create: true, can_edit: true, can_delete: false, can_export: false, view_sensitive_contact: true, view_finance_detail: false },
    USERS: { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    AUDIT_LOG: { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    PENGATURAN: { can_view: true, can_create: false, can_edit: true, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
  },
  PENGURUS: {
    DASHBOARD: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: true, view_sensitive_contact: false, view_finance_detail: false },
    ANGGOTA: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: true, view_sensitive_contact: false, view_finance_detail: false },
    SILSILAH: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: true, view_sensitive_contact: false, view_finance_detail: false },
    RUMAH_TANGGA: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    ORGANISASI: { can_view: true, can_create: true, can_edit: true, can_delete: false, can_export: true, view_sensitive_contact: false, view_finance_detail: false },
    KEUANGAN: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    SURAT: { can_view: true, can_create: true, can_edit: true, can_delete: false, can_export: true, view_sensitive_contact: false, view_finance_detail: false },
    LAPORAN: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: true, view_sensitive_contact: false, view_finance_detail: false },
    MIGRASI: { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    USERS: { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    AUDIT_LOG: { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    PENGATURAN: { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
  },
  BENDAHARA: {
    DASHBOARD: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: true, view_sensitive_contact: false, view_finance_detail: true },
    ANGGOTA: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: true },
    SILSILAH: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: true, view_sensitive_contact: false, view_finance_detail: false },
    RUMAH_TANGGA: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: true, view_sensitive_contact: false, view_finance_detail: true },
    ORGANISASI: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    KEUANGAN: { can_view: true, can_create: true, can_edit: true, can_delete: false, can_export: true, view_sensitive_contact: false, view_finance_detail: true },
    SURAT: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    LAPORAN: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: true, view_sensitive_contact: false, view_finance_detail: true },
    MIGRASI: { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    USERS: { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    AUDIT_LOG: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: true },
    PENGATURAN: { can_view: true, can_create: false, can_edit: true, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: true },
  },
  SEKRETARIS: {
    DASHBOARD: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: true, view_sensitive_contact: true, view_finance_detail: false },
    ANGGOTA: { can_view: true, can_create: true, can_edit: true, can_delete: false, can_export: true, view_sensitive_contact: true, view_finance_detail: false },
    SILSILAH: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: true, view_sensitive_contact: true, view_finance_detail: false },
    RUMAH_TANGGA: { can_view: true, can_create: true, can_edit: true, can_delete: false, can_export: true, view_sensitive_contact: true, view_finance_detail: false },
    ORGANISASI: { can_view: true, can_create: true, can_edit: true, can_delete: false, can_export: true, view_sensitive_contact: true, view_finance_detail: false },
    KEUANGAN: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    SURAT: { can_view: true, can_create: true, can_edit: true, can_delete: true, can_export: true, view_sensitive_contact: true, view_finance_detail: false },
    LAPORAN: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: true, view_sensitive_contact: true, view_finance_detail: false },
    MIGRASI: { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    USERS: { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    AUDIT_LOG: { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    PENGATURAN: { can_view: true, can_create: false, can_edit: true, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
  },
  ANGGOTA: {
    DASHBOARD: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    ANGGOTA: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    SILSILAH: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: true, view_sensitive_contact: false, view_finance_detail: false },
    RUMAH_TANGGA: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    ORGANISASI: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    KEUANGAN: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    SURAT: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    LAPORAN: { can_view: true, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    MIGRASI: { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    USERS: { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    AUDIT_LOG: { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
    PENGATURAN: { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, view_sensitive_contact: false, view_finance_detail: false },
  },
};

export function nowJakartaIso(): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const map: Record<string, string> = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}+07:00`;
}

export function nowJakartaDisplay(): string {
  return (
    new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date()) + ' WIB'
  );
}

export function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  const computed = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(storedHash, 'hex');
  if (computed.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(computed, storedBuf);
}

export function projectSafeUser(u: UserRecord): SafeUser {
  return {
    user_id: u.user_id,
    id_anggota: u.id_anggota,
    username_login: u.username_login,
    nama_tampilan: u.nama_tampilan,
    role_id: u.role_id,
    status_akun: u.status_akun,
    last_login: u.last_login,
    must_change_pwd: u.must_change_pwd,
  };
}

function parseCSVLine(line: string): string[] {
  const res: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === ',' && !inQ) {
      res.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  res.push(cur.trim());
  return res;
}

function normalizeLegacyCode(rawCode: string): string {
  return (rawCode || '').trim().replace(/\s+/g, '').replace(/\.+$/, '').replace(/^\.+/, '');
}

function splitNameAndTitles(fullNameRaw: string) {
  const raw = (fullNameRaw || '').trim();
  if (!raw) return { gelar_depan: '', nama_lengkap: '', gelar_belakang: '' };

  const gelarDepanList = ['DR.', 'DRS.', 'DRA.', 'DRH.', 'IR.', 'PROF.', 'H.', 'HJ.', 'DR', 'MARSMA (PURN.)'];
  const frontTitles: string[] = [];
  const backTitles: string[] = [];

  const commaIdx = raw.indexOf(',');
  let mainPart = raw;
  if (commaIdx > 0) {
    mainPart = raw.substring(0, commaIdx).trim();
    backTitles.push(raw.substring(commaIdx + 1).trim());
  }

  let changed = true;
  while (changed) {
    changed = false;
    const upper = mainPart.toUpperCase();
    for (const prefix of gelarDepanList) {
      if (upper.startsWith(prefix + ' ') || (prefix === 'DR.' && upper.startsWith('DR.'))) {
        frontTitles.push(mainPart.substring(0, prefix.length).trim());
        mainPart = mainPart.substring(prefix.length).trim();
        changed = true;
        break;
      }
    }
  }

  return {
    gelar_depan: frontTitles.join(' '),
    nama_lengkap: mainPart || raw,
    gelar_belakang: backTitles.join(', '),
  };
}

function parseIndonesianBirthdate(ttlRaw: string) {
  const raw = (ttlRaw || '').trim();
  if (!raw) return { tempat_lahir: '', tanggal_lahir_iso: '', presisi: 'KOSONG', flag: '' };

  let tempat = '';
  let datePart = raw;
  const commaIdx = raw.indexOf(',');
  if (commaIdx > -1) {
    tempat = raw.substring(0, commaIdx).trim();
    datePart = raw.substring(commaIdx + 1).trim();
  } else {
    const mSpace = raw.match(/^([A-Za-z.\s]+?)\s+(\d{1,2}\s+[A-Za-z]+\s+\d{2,4}|\d{4})$/);
    if (mSpace) {
      tempat = mSpace[1].trim();
      datePart = mSpace[2].trim();
    } else if (/^[A-Za-z.\s]+$/.test(raw)) {
      tempat = raw;
      datePart = '';
    }
  }

  if (/^banumas$/i.test(tempat)) tempat = 'Banyumas';
  if (/^k\s+ediri$/i.test(tempat)) tempat = 'Kediri';

  if (!datePart) {
    return { tempat_lahir: tempat, tanggal_lahir_iso: '', presisi: 'TEMPAT_SAJA', flag: 'TGL_LAHIR_KOSONG' };
  }

  const monthMap: Record<string, number> = {
    januari: 1, januariuari: 1, jan: 1,
    februari: 2, pebruari: 2, feb: 2,
    maret: 3, mar: 3,
    april: 4, aprili: 4, apr: 4,
    mei: 5,
    juni: 6, jun: 6,
    juli: 7, jul: 7,
    agustus: 8, agutus: 8, ags: 8, agu: 8,
    september: 9, septembert: 9, sept: 9, sep: 9,
    oktober: 10, oktobert: 10, okt: 10,
    november: 11, nopember: 11, nov: 11, nop: 11,
    desember: 12, des: 12,
  };

  const yearOnly = datePart.match(/^(?:th\.?|tahun)?\s*(\d{4})$/i);
  if (yearOnly) {
    const yrOnly = parseInt(yearOnly[1], 10);
    if (yrOnly >= 1880 && yrOnly <= 2030) {
      return { tempat_lahir: tempat, tanggal_lahir_iso: `${yrOnly}-01-01`, presisi: 'TAHUN_SAJA', flag: 'HANYA_TAHUN_LAHIR' };
    }
  }

  const numericMatch = datePart.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{3,4})$/);
  if (numericMatch) {
    const dNum = parseInt(numericMatch[1], 10);
    const mNum = parseInt(numericMatch[2], 10);
    const yNum = parseInt(numericMatch[3], 10);
    if (yNum < 1850 || yNum > 2030 || mNum < 1 || mNum > 12 || dNum < 1 || dNum > 31) {
      return { tempat_lahir: tempat, tanggal_lahir_iso: '', presisi: 'PERLU_EDIT', flag: 'TGL_LAHIR_ANOMALI' };
    }
    return {
      tempat_lahir: tempat,
      tanggal_lahir_iso: `${yNum}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`,
      presisi: 'LENGKAP',
      flag: '',
    };
  }

  const textMatch = datePart.match(/^(\d{1,2})\s*([A-Za-z]+)\s*(\d{2,4})$/);
  if (textMatch) {
    const day = parseInt(textMatch[1], 10);
    const mon = monthMap[textMatch[2].toLowerCase()];
    const yr = parseInt(textMatch[3], 10);
    if (!mon || yr < 1850 || yr > 2030 || day < 1 || day > 31) {
      return { tempat_lahir: tempat, tanggal_lahir_iso: '', presisi: 'PERLU_EDIT', flag: 'TGL_LAHIR_ANOMALI' };
    }
    return {
      tempat_lahir: tempat,
      tanggal_lahir_iso: `${yr}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      presisi: 'LENGKAP',
      flag: '',
    };
  }

  return { tempat_lahir: tempat, tanggal_lahir_iso: '', presisi: 'PERLU_EDIT', flag: 'TGL_LAHIR_ANOMALI' };
}

function parseRupiah(raw: string): number {
  if (!raw || raw === '-' || /Rp\s*-/i.test(raw)) return 0;
  const cleaned = raw.replace(/,\d{2}\s*$/, '').replace(/[^0-9]/g, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
}

export class AppStore {
  users: UserRecord[] = [];
  sessions = new Map<string, { user_id: string; created_ms: number }>();
  staging: StagingRow[] = [];
  members: MemberRecord[] = [];
  couples: SpouseRelation[] = [];
  parentRelations: ParentChildRelation[] = [];
  households: HouseholdRecord[] = [];
  householdMembers: HouseholdMemberRecord[] = [];
  kkHistory: KkHistoryRecord[] = [];
  masterGenerasi: SimpleMasterItem[] = [...SEED_GENERASI];
  masterPendidikan: SimpleMasterItem[] = [...SEED_PENDIDIKAN];
  masterPekerjaan: SimpleMasterItem[] = [...SEED_PEKERJAAN];
  masterWilayah: WilayahItem[] = [...SEED_WILAYAH];
  // Tahap 4: Keuangan, Iuran, Organisasi & Dokumen
  coa: CoaAccount[] = [...SEED_COA];
  anggaran: AnggaranRecord[] = [];
  tarifIuran: TarifIuranRecord[] = [...SEED_TARIF_IURAN];
  tagihanIuran: TagihanIuranRecord[] = [];
  pembayaran: PembayaranRecord[] = [];
  transaksi: TransaksiRecord[] = [];
  jurnal: JurnalEntry[] = [];
  buktiTransaksi: BuktiTransaksiRecord[] = [];
  jabatan: JabatanRecord[] = [...SEED_JABATAN];
  pengurus: PengurusRecord[] = [];
  kegiatan: KegiatanRecord[] = [];
  pengumuman: PengumumanRecord[] = [...SEED_PENGUMUMAN];
  surat: SuratRecord[] = [];
  undangan: UndanganRecord[] = [];
  arsip: ArsipRecord[] = [];
  auditLogs: AuditLogEntry[] = [];
  dbInitialized = false;
  rawArchived = false;
  private dataFile: string;

  constructor() {
    const dataDir = path.resolve(process.cwd(), '.data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    this.dataFile = path.join(dataDir, 'bani_tohir_stage2.json');
    this.loadFromDisk();
    if (this.staging.length === 0) {
      this.runDryRun('AUTO_GENERATE', true, 'SYSTEM');
    }
    let dirty = false;
    if (this.members.length > 0 && this.parentRelations.length === 0) {
      const graph = buildRelationalGraphFromMembers(this.members, nowJakartaIso().slice(0, 10));
      this.couples = graph.couples;
      this.parentRelations = graph.parentRelations;
      this.households = graph.households;
      this.householdMembers = graph.householdMembers;
      dirty = true;
    }
    if (this.members.length > 0 && this.tagihanIuran.length === 0) {
      this.tagihanIuran = buildTargetIuranFromMembers(this.members, this.householdMembers, nowJakartaIso(), 2026);
      this.members.forEach((m) => {
        if (m.iuran_nominal > 0 && !m.catatan) {
          m.catatan = `Target Iuran Awal (2026): Rp ${m.iuran_nominal.toLocaleString('id-ID')}`;
        }
      });
      dirty = true;
    }
    if (dirty) {
      this.saveToDisk();
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const parsed = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
        this.users = parsed.users || [];
        this.staging = parsed.staging || [];
        this.members = parsed.members || [];
        this.couples = parsed.couples || [];
        this.parentRelations = parsed.parentRelations || [];
        this.households = parsed.households || [];
        this.householdMembers = parsed.householdMembers || [];
        this.kkHistory = parsed.kkHistory || [];
        if (parsed.masterGenerasi?.length) this.masterGenerasi = parsed.masterGenerasi;
        if (parsed.masterPendidikan?.length) this.masterPendidikan = parsed.masterPendidikan;
        if (parsed.masterPekerjaan?.length) this.masterPekerjaan = parsed.masterPekerjaan;
        if (parsed.masterWilayah?.length) this.masterWilayah = parsed.masterWilayah;
        if (parsed.coa?.length) this.coa = parsed.coa;
        this.anggaran = parsed.anggaran || [];
        if (parsed.tarifIuran?.length) this.tarifIuran = parsed.tarifIuran;
        this.tagihanIuran = parsed.tagihanIuran || [];
        this.pembayaran = parsed.pembayaran || [];
        this.transaksi = parsed.transaksi || [];
        this.jurnal = parsed.jurnal || [];
        this.buktiTransaksi = parsed.buktiTransaksi || [];
        if (parsed.jabatan?.length) this.jabatan = parsed.jabatan;
        this.pengurus = parsed.pengurus || [];
        this.kegiatan = parsed.kegiatan || [];
        if (parsed.pengumuman?.length) this.pengumuman = parsed.pengumuman;
        this.surat = parsed.surat || [];
        this.undangan = parsed.undangan || [];
        this.arsip = parsed.arsip || [];
        this.auditLogs = parsed.auditLogs || [];
        this.dbInitialized = Boolean(parsed.dbInitialized);
        this.rawArchived = Boolean(parsed.rawArchived);
      }
    } catch {
      // mulai bersih bila file korup
    }
  }

  saveToDisk() {
    try {
      fs.writeFileSync(
        this.dataFile,
        JSON.stringify(
          {
            users: this.users,
            staging: this.staging,
            members: this.members,
            couples: this.couples,
            parentRelations: this.parentRelations,
            households: this.households,
            householdMembers: this.householdMembers,
            kkHistory: this.kkHistory,
            masterGenerasi: this.masterGenerasi,
            masterPendidikan: this.masterPendidikan,
            masterPekerjaan: this.masterPekerjaan,
            masterWilayah: this.masterWilayah,
            coa: this.coa,
            anggaran: this.anggaran,
            tarifIuran: this.tarifIuran,
            tagihanIuran: this.tagihanIuran,
            pembayaran: this.pembayaran,
            transaksi: this.transaksi,
            jurnal: this.jurnal,
            buktiTransaksi: this.buktiTransaksi,
            jabatan: this.jabatan,
            pengurus: this.pengurus,
            kegiatan: this.kegiatan,
            pengumuman: this.pengumuman,
            surat: this.surat,
            undangan: this.undangan,
            arsip: this.arsip,
            auditLogs: this.auditLogs,
            dbInitialized: this.dbInitialized,
            rawArchived: this.rawArchived,
          },
          null,
          2
        ),
        'utf8'
      );
    } catch {
      // abaikan jika filesystem read-only
    }
  }

  addAudit(user: { user_id: string; username_login: string; role_id: string }, aksi: string, entitas: string, recordId: string, catatan: string) {
    this.auditLogs.unshift({
      log_id: 'LOG-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      timestamp: nowJakartaIso(),
      user_id: user.user_id,
      username: user.username_login,
      role: user.role_id,
      aksi,
      entitas,
      record_id: recordId,
      catatan,
    });
    if (this.auditLogs.length > 500) this.auditLogs = this.auditLogs.slice(0, 500);
    this.saveToDisk();
  }

  runDryRun(codeMode: 'AUTO_GENERATE' | 'KEEP_RAW', skipEmptyNames: boolean, actorName = 'SYSTEM'): StagingRow[] {
    const csvPath = path.resolve(process.cwd(), 'public/assets/aistudio/DATABASE_BANI_TOHIR_2026_-_APP_1fb23871');
    if (!fs.existsSync(csvPath)) return [];

    const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/);
    const rawRows: { line: number; cols: string[] }[] = [];
    for (let i = 2; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (/REKAP ANGGOTA/i.test(cols[0] || '') || /REKAP ANGGOTA/i.test(cols[1] || '')) break;
      if (!cols[0] || !/^\d+$/.test(cols[0])) continue;
      if (!cols[1] && !cols[2]) continue;
      rawRows.push({ line: i + 1, cols });
    }

    const normalizedCounts: Record<string, number> = {};
    rawRows.forEach((r) => {
      const k = normalizeLegacyCode(r.cols[1] || '');
      if (k) normalizedCounts[k] = (normalizedCounts[k] || 0) + 1;
    });

    const staging: StagingRow[] = [];
    let memberSeq = 1;
    let lastValidParentCode = '';
    const childCounterByParent: Record<string, number> = {};
    const now = nowJakartaIso();

    rawRows.forEach((r, idx) => {
      const c = r.cols;
      const namaRaw = (c[2] || '').trim();
      if (/belum terdaftar/i.test(namaRaw)) return;

      const rawKode = (c[1] || '').trim();
      const normKode = normalizeLegacyCode(rawKode);
      const flags: string[] = [];

      if (!namaRaw) flags.push('NAMA_KOSONG');

      const ket = (c[5] || '').trim();
      let st = (c[6] || '').trim();
      const isMenantu = /menantu/i.test(ket) || /^menantu$/i.test(st);
      if (/menantu/i.test(ket) && st && !/^menantu$/i.test(st)) {
        flags.push('KONFLIK_STATUS_KETERANGAN');
        st = 'Menantu';
      } else if (!/menantu/i.test(ket) && /^menantu$/i.test(st)) {
        flags.push('KONFLIK_STATUS_KETERANGAN');
      }

      const isChildUsingParentCode = !isMenantu && !ket && !st && Boolean(normKode) && normalizedCounts[normKode] >= 3;
      if (isChildUsingParentCode) flags.push('ANAK_PAKAI_KODE_ORTU');

      let genKode = normKode;
      if (codeMode === 'AUTO_GENERATE' && normKode) {
        if (rawKode !== normKode) flags.push('TITIK_AKHIR_DIRAPIKAN');
        if (isChildUsingParentCode) {
          childCounterByParent[normKode] = (childCounterByParent[normKode] || 0) + 1;
          genKode = `${normKode}.${childCounterByParent[normKode]}`;
          flags.push('KODE_DIGENERATE_ULANG');
        } else if (!isMenantu && lastValidParentCode) {
          const parts = normKode.split('.');
          const parentSegs = lastValidParentCode.split('.');
          if (parts.length === parentSegs.length + 1 && parts.slice(0, parentSegs.length).join('.') !== lastValidParentCode) {
            if (parentSegs.length === 4 && parts.length === 5 && parts[0] === parentSegs[0] && parts[1] === parentSegs[1]) {
              childCounterByParent[lastValidParentCode] = (childCounterByParent[lastValidParentCode] || 1) + 1;
              genKode = `${lastValidParentCode}.${childCounterByParent[lastValidParentCode]}`;
              flags.push('KODE_INDUK_DISESUAIKAN');
            }
          }
        }
      }

      if (!isMenantu && genKode) {
        const segs = genKode.split('.');
        if (segs.length === 4) {
          lastValidParentCode = genKode;
          if (!childCounterByParent[genKode]) childCounterByParent[genKode] = 0;
        } else if (segs.length === 5 && segs.slice(0, 4).join('.') === lastValidParentCode) {
          const childNum = parseInt(segs[4], 10);
          if (!isNaN(childNum)) {
            childCounterByParent[lastValidParentCode] = Math.max(childCounterByParent[lastValidParentCode] || 0, childNum);
          }
        }
      }

      const splitName = splitNameAndTitles(namaRaw);
      const parsedTtl = parseIndonesianBirthdate(c[4] || '');
      if (parsedTtl.flag) flags.push(parsedTtl.flag);

      const wafatCol = (c[12] || '').trim().toUpperCase();
      const tglWafatRaw = (c[13] || '').trim();
      let statusHidup: 'HIDUP' | 'WAFAT' | 'TIDAK_DIKETAHUI' = 'TIDAK_DIKETAHUI';
      if (wafatCol === 'WAFAT' || /wafat/i.test(tglWafatRaw)) {
        statusHidup = 'WAFAT';
        if (wafatCol !== 'WAFAT') flags.push('STATUS_WAFAT_DINORMALISASI');
      } else if (wafatCol === 'HIDUP') {
        statusHidup = 'HIDUP';
      }

      const finalStatusKeturunan = isChildUsingParentCode ? 'Kandung' : isMenantu ? 'Menantu' : st || 'Kandung';
      const genLevel = genKode ? genKode.split('.').length : 1;
      const genLabels: Record<number, string> = {
        0: 'Leluhur Utama',
        1: 'Anak',
        2: 'Cucu',
        3: 'Buyut',
        4: 'Canggah',
        5: 'Wareng',
        6: 'Udeg-udeg',
        7: 'Gantung Siwur',
      };
      const isMultiSpouse = Boolean(normKode) && normalizedCounts[normKode] >= 3 && !isChildUsingParentCode;
      if (isMultiSpouse) flags.push('MULTI_PASANGAN');

      const actionStatus: 'SIAP' | 'SKIP' = !namaRaw && skipEmptyNames ? 'SKIP' : 'SIAP';

      staging.push({
        staging_id: 'STG-' + String(idx + 1).padStart(4, '0'),
        raw_row_no: r.line,
        raw_no: c[0] || '',
        raw_kode: rawKode,
        generated_kode: genKode,
        code_resolution_mode: codeMode,
        id_anggota_calon: actionStatus === 'SKIP' ? '' : 'BMT-' + String(memberSeq++).padStart(4, '0'),
        gelar_depan: splitName.gelar_depan,
        nama_lengkap: splitName.nama_lengkap,
        gelar_belakang: splitName.gelar_belakang,
        status_keturunan: finalStatusKeturunan,
        generasi_level: genLevel,
        generasi_label: genLabels[genLevel] || `Generasi-${genLevel}`,
        tempat_lahir: parsedTtl.tempat_lahir,
        tanggal_lahir_iso: parsedTtl.tanggal_lahir_iso,
        presisi_tgl_lahir: parsedTtl.presisi,
        raw_ttl: c[4] || '',
        status_hidup: statusHidup,
        tanggal_wafat_raw: tglWafatRaw,
        is_kk: (c[7] || '').trim().toUpperCase() === 'KK',
        pekerjaan_raw: (c[8] || '').trim(),
        alamat_raw: (c[9] || '').trim(),
        email: (c[10] || '').trim(),
        no_hp: (c[11] || '').trim(),
        iuran_nominal: parseRupiah(c[3] || ''),
        is_multi_spouse_group: isMultiSpouse,
        anomaly_flags: flags,
        action_status: actionStatus,
        updated_at: now,
      });
    });

    this.staging = staging;
    this.rawArchived = true;
    this.dbInitialized = true;
    if (actorName !== 'SYSTEM') {
      this.saveToDisk();
    }
    return staging;
  }

  commitMigration(actor: SafeUser): {
    insertedMembers: number;
    insertedCouples: number;
    insertedParents: number;
    insertedHouseholds: number;
    insertedTargetIuran: number;
  } {
    const ready = this.staging.filter((s) => s.action_status === 'SIAP' && s.nama_lengkap);
    const now = nowJakartaIso();

    const members: MemberRecord[] = [
      {
        id_anggota: 'BMT-0000',
        kode_silsilah: '0',
        kode_legacy: '0',
        gelar_depan: 'Haji',
        nama_lengkap: 'Mohammad Tohir',
        gelar_belakang: '',
        status_keturunan: 'Leluhur',
        generasi_level: 0,
        generasi_label: 'Leluhur Utama',
        tempat_lahir: 'Banyumas',
        tanggal_lahir: '',
        presisi_tgl_lahir: 'TEMPAT_SAJA',
        status_hidup: 'WAFAT',
        tanggal_wafat: '',
        is_kk: false,
        pekerjaan_lainnya: '',
        keterangan_alamat: 'Pangebatan, Karanglewas, Banyumas',
        email: '',
        no_hp: '',
        iuran_nominal: 0,
        needs_verification: false,
        updated_at: now,
      },
      ...ready.map((r) => ({
        id_anggota: r.id_anggota_calon,
        kode_silsilah: r.generated_kode,
        kode_legacy: r.raw_kode,
        gelar_depan: r.gelar_depan,
        nama_lengkap: r.nama_lengkap,
        gelar_belakang: r.gelar_belakang,
        status_keturunan: r.status_keturunan,
        generasi_level: r.generasi_level,
        generasi_label: r.generasi_label,
        tempat_lahir: r.tempat_lahir,
        tanggal_lahir: r.tanggal_lahir_iso,
        presisi_tgl_lahir: r.presisi_tgl_lahir,
        status_hidup: r.status_hidup,
        tanggal_wafat: r.tanggal_wafat_raw,
        is_kk: r.is_kk,
        pekerjaan_lainnya: r.pekerjaan_raw,
        keterangan_alamat: r.alamat_raw,
        email: r.email,
        no_hp: r.no_hp,
        catatan: r.iuran_nominal > 0 ? `Target Iuran Awal (2026): Rp ${r.iuran_nominal.toLocaleString('id-ID')}` : '',
        iuran_nominal: r.iuran_nominal,
        needs_verification: r.presisi_tgl_lahir === 'PERLU_EDIT' || !r.tanggal_lahir_iso,
        updated_at: now,
      })),
    ];

    this.members = members;
    const graph = buildRelationalGraphFromMembers(members, now.slice(0, 10));
    this.couples = graph.couples;
    this.parentRelations = graph.parentRelations;
    this.households = graph.households;
    this.householdMembers = graph.householdMembers;
    this.tagihanIuran = buildTargetIuranFromMembers(members, this.householdMembers, now, 2026);

    this.addAudit(
      actor,
      'COMMIT_MIGRASI',
      'ANGGOTA',
      'BATCH_2026',
      `Commit ${members.length} anggota, ${this.couples.length} pasangan, ${this.parentRelations.length} relasi ortu, ${this.households.length} rumah tangga, ${this.tagihanIuran.length} target iuran 2026`
    );
    this.saveToDisk();
    return {
      insertedMembers: members.length,
      insertedCouples: this.couples.length,
      insertedParents: this.parentRelations.length,
      insertedHouseholds: this.households.length,
      insertedTargetIuran: this.tagihanIuran.length,
    };
  }
}
