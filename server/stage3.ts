import crypto from 'node:crypto';
import type { MemberRecord } from './store.ts';

export interface SpouseRelation {
  relasi_pasangan_id: string;
  id_anggota_1: string;
  id_anggota_2: string;
  urutan_pasangan: number;
  tanggal_menikah: string;
  tanggal_berakhir: string;
  status_hubungan: 'MENIKAH' | 'CERAI_HIDUP' | 'CERAI_MATI';
  keterangan: string;
  status_aktif: boolean;
}

export interface ParentChildRelation {
  relasi_ortu_id: string;
  id_anak: string;
  id_ayah: string;
  id_ibu: string;
  id_pasangan_ortu: string;
  jenis_hubungan: 'KANDUNG' | 'ANGKAT' | 'TIRI';
  urutan_anak: number;
  keterangan: string;
  status_aktif: boolean;
}

export interface HouseholdRecord {
  id_rumah_tangga: string;
  nama_rumah_tangga: string;
  id_kepala_keluarga: string;
  provinsi_id: string;
  kabkota_id: string;
  kecamatan_id: string;
  kelurahan_id: string;
  alamat_ringkas: string;
  no_kontak_rt: string;
  status_aktif: boolean;
  izinkan_kk_ganda: boolean;
  tanggal_bentuk: string;
  keterangan: string;
}

export interface HouseholdMemberRecord {
  id_anggota_rumah: string;
  id_rumah_tangga: string;
  id_anggota: string;
  peran_dalam_rt: string;
  tanggal_masuk: string;
  tanggal_keluar: string;
  status_aktif: boolean;
}

export interface KkHistoryRecord {
  id_riwayat_kk: string;
  id_rumah_tangga: string;
  id_kk_lama: string;
  id_kk_baru: string;
  tanggal_pergantian: string;
  alasan: string;
  pencatat_user_id: string;
}

export interface WilayahItem {
  kode_wilayah: string;
  tingkat: 'PROV' | 'KAB' | 'KEC' | 'DESA';
  kode_induk: string;
  nama_wilayah: string;
  kode_pos_default: string;
}

export interface SimpleMasterItem {
  id: string;
  nama: string;
  urutan: number;
  level_angka?: number;
  deskripsi?: string;
  status_aktif: boolean;
}

export const SEED_GENERASI: SimpleMasterItem[] = [
  { id: 'GEN-0', level_angka: 0, nama: 'Leluhur Utama', deskripsi: 'Haji Mohammad Tohir & Pasangan', urutan: 0, status_aktif: true },
  { id: 'GEN-1', level_angka: 1, nama: 'Anak', deskripsi: 'Generasi ke-1', urutan: 1, status_aktif: true },
  { id: 'GEN-2', level_angka: 2, nama: 'Cucu', deskripsi: 'Generasi ke-2', urutan: 2, status_aktif: true },
  { id: 'GEN-3', level_angka: 3, nama: 'Buyut', deskripsi: 'Generasi ke-3', urutan: 3, status_aktif: true },
  { id: 'GEN-4', level_angka: 4, nama: 'Canggah', deskripsi: 'Generasi ke-4', urutan: 4, status_aktif: true },
  { id: 'GEN-5', level_angka: 5, nama: 'Wareng', deskripsi: 'Generasi ke-5', urutan: 5, status_aktif: true },
  { id: 'GEN-6', level_angka: 6, nama: 'Udeg-udeg', deskripsi: 'Generasi ke-6', urutan: 6, status_aktif: true },
  { id: 'GEN-7', level_angka: 7, nama: 'Gantung Siwur', deskripsi: 'Generasi ke-7', urutan: 7, status_aktif: true },
];

export const SEED_PENDIDIKAN: SimpleMasterItem[] = [
  'Tidak diketahui', 'Tidak sekolah', 'SD/Sederajat', 'SMP/Sederajat',
  'SMA/SMK/Sederajat', 'D1', 'D2', 'D3', 'D4', 'S1/Sederajat', 'S2', 'S3', 'Lainnya',
].map((nama, idx) => ({
  id: 'PDD-' + String(idx + 1).padStart(2, '0'),
  nama,
  urutan: idx + 1,
  status_aktif: true,
}));

export const SEED_PEKERJAAN: SimpleMasterItem[] = [
  'PNS/ASN', 'TNI', 'POLRI', 'Pegawai BUMN', 'Pegawai Swasta', 'Guru', 'Dosen',
  'Wiraswasta', 'Pengusaha', 'Petani', 'Nelayan', 'Pedagang', 'Profesional',
  'Ibu/Bapak Rumah Tangga', 'Pelajar/Mahasiswa', 'Pensiunan', 'Belum Bekerja', 'Lainnya',
].map((nama, idx) => ({
  id: 'PKJ-' + String(idx + 1).padStart(2, '0'),
  nama,
  urutan: idx + 1,
  status_aktif: true,
}));

export const SEED_WILAYAH: WilayahItem[] = [
  { kode_wilayah: '33', tingkat: 'PROV', kode_induk: '', nama_wilayah: 'Jawa Tengah', kode_pos_default: '' },
  { kode_wilayah: '31', tingkat: 'PROV', kode_induk: '', nama_wilayah: 'DKI Jakarta', kode_pos_default: '' },
  { kode_wilayah: '32', tingkat: 'PROV', kode_induk: '', nama_wilayah: 'Jawa Barat', kode_pos_default: '' },
  { kode_wilayah: '35', tingkat: 'PROV', kode_induk: '', nama_wilayah: 'Jawa Timur', kode_pos_default: '' },
  { kode_wilayah: '36', tingkat: 'PROV', kode_induk: '', nama_wilayah: 'Banten', kode_pos_default: '' },
  { kode_wilayah: '34', tingkat: 'PROV', kode_induk: '', nama_wilayah: 'DI Yogyakarta', kode_pos_default: '' },
  { kode_wilayah: '18', tingkat: 'PROV', kode_induk: '', nama_wilayah: 'Lampung', kode_pos_default: '' },

  { kode_wilayah: '3302', tingkat: 'KAB', kode_induk: '33', nama_wilayah: 'Kabupaten Banyumas', kode_pos_default: '53100' },
  { kode_wilayah: '3301', tingkat: 'KAB', kode_induk: '33', nama_wilayah: 'Kabupaten Cilacap', kode_pos_default: '53200' },
  { kode_wilayah: '3303', tingkat: 'KAB', kode_induk: '33', nama_wilayah: 'Kabupaten Purbalingga', kode_pos_default: '53300' },
  { kode_wilayah: '3374', tingkat: 'KAB', kode_induk: '33', nama_wilayah: 'Kota Semarang', kode_pos_default: '50100' },
  { kode_wilayah: '3376', tingkat: 'KAB', kode_induk: '33', nama_wilayah: 'Kota Tegal', kode_pos_default: '52100' },
  { kode_wilayah: '3175', tingkat: 'KAB', kode_induk: '31', nama_wilayah: 'Kota Jakarta Timur', kode_pos_default: '13410' },
  { kode_wilayah: '3273', tingkat: 'KAB', kode_induk: '32', nama_wilayah: 'Kota Bandung', kode_pos_default: '40100' },
  { kode_wilayah: '3275', tingkat: 'KAB', kode_induk: '32', nama_wilayah: 'Kota Bekasi', kode_pos_default: '17100' },
  { kode_wilayah: '3201', tingkat: 'KAB', kode_induk: '32', nama_wilayah: 'Kabupaten Bogor', kode_pos_default: '16910' },
  { kode_wilayah: '3515', tingkat: 'KAB', kode_induk: '35', nama_wilayah: 'Kabupaten Sidoarjo', kode_pos_default: '61200' },
  { kode_wilayah: '3603', tingkat: 'KAB', kode_induk: '36', nama_wilayah: 'Kabupaten Tangerang', kode_pos_default: '15340' },
  { kode_wilayah: '3674', tingkat: 'KAB', kode_induk: '36', nama_wilayah: 'Kota Tangerang Selatan', kode_pos_default: '15410' },

  { kode_wilayah: '330221', tingkat: 'KEC', kode_induk: '3302', nama_wilayah: 'Karanglewas', kode_pos_default: '53161' },
  { kode_wilayah: '330224', tingkat: 'KEC', kode_induk: '3302', nama_wilayah: 'Purwokerto Barat', kode_pos_default: '53131' },
  { kode_wilayah: '330225', tingkat: 'KEC', kode_induk: '3302', nama_wilayah: 'Purwokerto Timur', kode_pos_default: '53111' },
  { kode_wilayah: '330222', tingkat: 'KEC', kode_induk: '3302', nama_wilayah: 'Purwokerto Selatan', kode_pos_default: '53141' },
  { kode_wilayah: '330218', tingkat: 'KEC', kode_induk: '3302', nama_wilayah: 'Sokaraja', kode_pos_default: '53181' },
  { kode_wilayah: '330220', tingkat: 'KEC', kode_induk: '3302', nama_wilayah: 'Kedungbanteng', kode_pos_default: '53152' },
  { kode_wilayah: '330114', tingkat: 'KEC', kode_induk: '3301', nama_wilayah: 'Maos', kode_pos_default: '53272' },
  { kode_wilayah: '360322', tingkat: 'KEC', kode_induk: '3603', nama_wilayah: 'Cisauk', kode_pos_default: '15341' },
  { kode_wilayah: '367406', tingkat: 'KEC', kode_induk: '3674', nama_wilayah: 'Pamulang', kode_pos_default: '15416' },
  { kode_wilayah: '351517', tingkat: 'KEC', kode_induk: '3515', nama_wilayah: 'Waru', kode_pos_default: '61256' },

  { kode_wilayah: '3302212001', tingkat: 'DESA', kode_induk: '330221', nama_wilayah: 'Pangebatan', kode_pos_default: '53161' },
  { kode_wilayah: '3302212002', tingkat: 'DESA', kode_induk: '330221', nama_wilayah: 'Kediri', kode_pos_default: '53161' },
  { kode_wilayah: '3302212003', tingkat: 'DESA', kode_induk: '330221', nama_wilayah: 'Karanglewas Kidul', kode_pos_default: '53161' },
  { kode_wilayah: '3302241001', tingkat: 'DESA', kode_induk: '330224', nama_wilayah: 'Kedungwuluh', kode_pos_default: '53131' },
  { kode_wilayah: '3302241002', tingkat: 'DESA', kode_induk: '330224', nama_wilayah: 'Bantarsoka', kode_pos_default: '53133' },
  { kode_wilayah: '3302241003', tingkat: 'DESA', kode_induk: '330224', nama_wilayah: 'Kober', kode_pos_default: '53132' },
  { kode_wilayah: '3302251001', tingkat: 'DESA', kode_induk: '330225', nama_wilayah: 'Berkoh', kode_pos_default: '53146' },
  { kode_wilayah: '3302221001', tingkat: 'DESA', kode_induk: '330222', nama_wilayah: 'Karangpucung', kode_pos_default: '53142' },
  { kode_wilayah: '3302182001', tingkat: 'DESA', kode_induk: '330218', nama_wilayah: 'Kalikidang', kode_pos_default: '53181' },
  { kode_wilayah: '3302202001', tingkat: 'DESA', kode_induk: '330220', nama_wilayah: 'Dawuhan Kulon', kode_pos_default: '53152' },
  { kode_wilayah: '3301142001', tingkat: 'DESA', kode_induk: '330114', nama_wilayah: 'Maos Lor', kode_pos_default: '53272' },
  { kode_wilayah: '3603222001', tingkat: 'DESA', kode_induk: '360322', nama_wilayah: 'Suradita', kode_pos_default: '15343' },
  { kode_wilayah: '3674061001', tingkat: 'DESA', kode_induk: '367406', nama_wilayah: 'Benda Baru', kode_pos_default: '15416' },
  { kode_wilayah: '3515172001', tingkat: 'DESA', kode_induk: '351517', nama_wilayah: 'Wedoro', kode_pos_default: '61256' },
];

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export function buildRelationalGraphFromMembers(members: MemberRecord[], todayDate: string) {
  const byKode: Record<string, MemberRecord[]> = {};
  members.forEach((m) => {
    if (m.kode_silsilah && m.kode_silsilah !== '0') {
      byKode[m.kode_silsilah] = byKode[m.kode_silsilah] || [];
      byKode[m.kode_silsilah].push(m);
    }
  });

  const couples: SpouseRelation[] = [];
  const parentRelations: ParentChildRelation[] = [];
  const households: HouseholdRecord[] = [];
  const householdMembers: HouseholdMemberRecord[] = [];
  const primaryPairByKode: Record<string, string> = {};

  Object.keys(byKode).forEach((kode) => {
    const list = byKode[kode];
    const kandung = list.find((x) => x.status_keturunan !== 'Menantu') || list[0];
    const menantuList = list.filter((x) => x.id_anggota !== kandung.id_anggota);

    menantuList.forEach((m, idx) => {
      const pairId = uid('PSG');
      couples.push({
        relasi_pasangan_id: pairId,
        id_anggota_1: kandung.id_anggota,
        id_anggota_2: m.id_anggota,
        urutan_pasangan: idx + 1,
        tanggal_menikah: '',
        tanggal_berakhir: '',
        status_hubungan: kandung.status_hidup === 'WAFAT' || m.status_hidup === 'WAFAT' ? 'CERAI_MATI' : 'MENIKAH',
        keterangan: `Pasangan ke-${idx + 1} (${kode})`,
        status_aktif: true,
      });
      if (idx === 0) primaryPairByKode[kode] = pairId;
    });
  });

  Object.keys(byKode).forEach((kode) => {
    const list = byKode[kode];
    const rawKandung = list.filter((x) => x.status_keturunan !== 'Menantu');
    const kandungList = rawKandung.length > 0 ? rawKandung : list.slice(0, 1);
    const parts = kode.split('.');
    const parentKode = parts.length > 1 ? parts.slice(0, parts.length - 1).join('.') : '0';

    kandungList.forEach((child) => {
      if (parentKode === '0') {
        parentRelations.push({
          relasi_ortu_id: uid('ORT'),
          id_anak: child.id_anggota,
          id_ayah: 'BMT-0000',
          id_ibu: '',
          id_pasangan_ortu: '',
          jenis_hubungan: 'KANDUNG',
          urutan_anak: parseInt(parts[0], 10) || 1,
          keterangan: 'Anak langsung Leluhur Utama',
          status_aktif: true,
        });
      } else if (byKode[parentKode]) {
        const pGroup = byKode[parentKode];
        const pKandung = pGroup.find((x) => x.status_keturunan !== 'Menantu') || pGroup[0];
        const pSpouse = pGroup.find((x) => x.id_anggota !== pKandung.id_anggota);
        parentRelations.push({
          relasi_ortu_id: uid('ORT'),
          id_anak: child.id_anggota,
          id_ayah: pKandung.id_anggota,
          id_ibu: pSpouse ? pSpouse.id_anggota : '',
          id_pasangan_ortu: primaryPairByKode[parentKode] || '',
          jenis_hubungan: 'KANDUNG',
          urutan_anak: parseInt(parts[parts.length - 1], 10) || 1,
          keterangan: `Relasi kode ${kode}`,
          status_aktif: true,
        });
      }
    });

    const kkMember = list.find((x) => x.is_kk);
    if (kkMember) {
      const rtId = uid('RTG');
      households.push({
        id_rumah_tangga: rtId,
        nama_rumah_tangga: `Keluarga ${kkMember.nama_lengkap}`,
        id_kepala_keluarga: kkMember.id_anggota,
        provinsi_id: kkMember.provinsi_id || '',
        kabkota_id: kkMember.kabkota_id || '',
        kecamatan_id: kkMember.kecamatan_id || '',
        kelurahan_id: kkMember.kelurahan_id || '',
        alamat_ringkas: kkMember.keterangan_alamat || '',
        no_kontak_rt: kkMember.no_hp || '',
        status_aktif: true,
        izinkan_kk_ganda: false,
        tanggal_bentuk: todayDate,
        keterangan: `Migrasi KK dari kode ${kode}`,
      });
      list.forEach((m) => {
        householdMembers.push({
          id_anggota_rumah: uid('ART'),
          id_rumah_tangga: rtId,
          id_anggota: m.id_anggota,
          peran_dalam_rt: m.id_anggota === kkMember.id_anggota ? 'KEPALA' : 'PASANGAN',
          tanggal_masuk: todayDate,
          tanggal_keluar: '',
          status_aktif: true,
        });
      });
    }
  });

  return { couples, parentRelations, households, householdMembers };
}

export function isAncestor(
  ortuRows: ParentChildRelation[],
  candidateAncestorId: string,
  targetNodeId: string
): boolean {
  const visited = new Set<string>();
  const stack = [targetNodeId];
  while (stack.length > 0) {
    const curr = stack.pop()!;
    if (curr === candidateAncestorId) return true;
    if (visited.has(curr)) continue;
    visited.add(curr);
    ortuRows.forEach((r) => {
      if (r.status_aktif && r.id_anak === curr) {
        if (r.id_ayah) stack.push(r.id_ayah);
        if (r.id_ibu) stack.push(r.id_ibu);
      }
    });
  }
  return false;
}

export function recalculateGenerations(
  members: MemberRecord[],
  ortuRows: ParentChildRelation[],
  couples: SpouseRelation[],
  generasiMaster: SimpleMasterItem[]
) {
  const genLabelMap = new Map<number, string>();
  generasiMaster.forEach((g) => {
    if (g.level_angka !== undefined) genLabelMap.set(g.level_angka, g.nama);
  });

  const childrenOf = new Map<string, string[]>();
  ortuRows.forEach((r) => {
    if (!r.status_aktif) return;
    if (r.id_ayah) {
      const arr = childrenOf.get(r.id_ayah) || [];
      arr.push(r.id_anak);
      childrenOf.set(r.id_ayah, arr);
    }
    if (r.id_ibu) {
      const arr = childrenOf.get(r.id_ibu) || [];
      arr.push(r.id_anak);
      childrenOf.set(r.id_ibu, arr);
    }
  });

  const levels = new Map<string, number>();
  levels.set('BMT-0000', 0);
  const queue = ['BMT-0000'];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const lv = levels.get(curr)!;
    for (const childId of childrenOf.get(curr) || []) {
      if (!levels.has(childId)) {
        levels.set(childId, lv + 1);
        queue.push(childId);
      }
    }
  }

  couples.forEach((c) => {
    if (!c.status_aktif) return;
    if (levels.has(c.id_anggota_1) && !levels.has(c.id_anggota_2)) {
      levels.set(c.id_anggota_2, levels.get(c.id_anggota_1)!);
    } else if (levels.has(c.id_anggota_2) && !levels.has(c.id_anggota_1)) {
      levels.set(c.id_anggota_1, levels.get(c.id_anggota_2)!);
    }
  });

  members.forEach((m) => {
    const lv = levels.get(m.id_anggota);
    if (lv !== undefined) {
      m.generasi_level = lv;
      m.generasi_label = genLabelMap.get(lv) || `Generasi-${lv}`;
    }
  });
}

export function findRelationshipBetween(
  members: MemberRecord[],
  ortuRows: ParentChildRelation[],
  couples: SpouseRelation[],
  idA: string,
  idB: string
) {
  if (idA === idB) return { summary: 'Kedua pilihan merujuk pada anggota yang sama.' };
  const nameMap = new Map(members.map((m) => [m.id_anggota, m.nama_lengkap]));

  // Cek apakah pasangan langsung
  const isSpouse = couples.some(
    (c) => c.status_aktif && ((c.id_anggota_1 === idA && c.id_anggota_2 === idB) || (c.id_anggota_1 === idB && c.id_anggota_2 === idA))
  );
  if (isSpouse) {
    return { summary: `${nameMap.get(idA)} dan ${nameMap.get(idB)} adalah pasangan suami-istri.` };
  }

  function getAncestors(startId: string) {
    const dist = new Map<string, number>();
    dist.set(startId, 0);
    const q = [startId];
    while (q.length > 0) {
      const cur = q.shift()!;
      const d = dist.get(cur)!;
      ortuRows.forEach((r) => {
        if (!r.status_aktif || r.id_anak !== cur) return;
        [r.id_ayah, r.id_ibu].forEach((p) => {
          if (p && !dist.has(p)) {
            dist.set(p, d + 1);
            q.push(p);
          }
        });
      });
    }
    return dist;
  }

  const ancA = getAncestors(idA);
  const ancB = getAncestors(idB);
  let bestLca = '';
  let bestSum = 9999;

  ancA.forEach((dA, ancId) => {
    const dB = ancB.get(ancId);
    if (dB !== undefined && dA + dB < bestSum) {
      bestSum = dA + dB;
      bestLca = ancId;
    }
  });

  if (!bestLca) {
    return {
      summary:
        'Tidak ditemukan jalur leluhur kandung langsung (salah satu atau keduanya terhubung melalui pernikahan/menantu).',
    };
  }

  const dA = ancA.get(bestLca)!;
  const dB = ancB.get(bestLca)!;
  const lcaName = nameMap.get(bestLca) || bestLca;
  const nA = nameMap.get(idA) || idA;
  const nB = nameMap.get(idB) || idB;

  if (dA === 0) return { summary: `${nA} adalah leluhur (${dB} generasi di atas) dari ${nB}.` };
  if (dB === 0) return { summary: `${nB} adalah leluhur (${dA} generasi di atas) dari ${nA}.` };
  if (dA === 1 && dB === 1) return { summary: `${nA} dan ${nB} adalah saudara sekandung/seorang-tua melalui ${lcaName}.` };
  if (dA === 2 && dB === 2) return { summary: `${nA} dan ${nB} adalah sepupu pertama (misan) melalui ${lcaName}.` };
  if (dA === 3 && dB === 3) return { summary: `${nA} dan ${nB} adalah sepupu kedua (mindhoan) melalui ${lcaName}.` };

  return {
    summary: `Terhubung melalui leluhur ${lcaName} (${dA} generasi dari ${nA}, ${dB} generasi dari ${nB}).`,
  };
}
