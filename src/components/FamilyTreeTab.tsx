import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, GitFork, Link2, Printer, Search, Users } from 'lucide-react';
import {
  MasterBundles,
  MemberRecord,
  ModulePermission,
  ParentChildRelation,
  SpouseRelation,
} from '../types';
import { MemberDetailModal } from './MemberDetailModal';
import { MemberFormModal } from './MemberFormModal';
import { SearchableOption, SearchableSelect } from './SearchableSelect';
import { PrintPreviewModal } from './PrintPreviewModal';
import { generateTablePdf } from '../utils/exportPdf';

interface FamilyTreeTabProps {
  token: string;
  permission: ModulePermission;
  memberEditAllowed: boolean;
  masters: MasterBundles;
  initialFocusMemberId?: string | null;
  onNotify: (msg: string, kind?: 'success' | 'error') => void;
}

type TreeViewMode = 'VERTIKAL' | 'HORIZONTAL' | 'CABANG' | 'KELUARGA_INTI';

export function FamilyTreeTab({
  token,
  permission,
  memberEditAllowed,
  masters,
  initialFocusMemberId,
  onNotify,
}: FamilyTreeTabProps) {
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [couples, setCouples] = useState<SpouseRelation[]>([]);
  const [parentRelations, setParentRelations] = useState<ParentChildRelation[]>([]);
  const [rootId, setRootId] = useState('BMT-0000');
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<TreeViewMode>(
    initialFocusMemberId ? 'KELUARGA_INTI' : 'VERTIKAL'
  );
  const [focusId, setFocusId] = useState(initialFocusMemberId || 'BMT-0000');
  const [selectedCabang, setSelectedCabang] = useState('1');
  const [treeSearch, setTreeSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(['BMT-0000']));

  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<MemberRecord | null>(null);
  const [printTreeOpen, setPrintTreeOpen] = useState(false);

  // Relation editor modal
  const [relationModalOpen, setRelationModalOpen] = useState(false);
  const [relTab, setRelTab] = useState<'PASANGAN' | 'ORTU'>('PASANGAN');
  const [spouseForm, setSpouseForm] = useState({
    id_anggota_1: '',
    id_anggota_2: '',
    urutan_pasangan: 1,
    status_hubungan: 'MENIKAH' as SpouseRelation['status_hubungan'],
    tanggal_menikah: '',
    keterangan: '',
  });
  const [parentForm, setParentForm] = useState({
    id_anak: '',
    id_ayah: '',
    id_ibu: '',
    jenis_hubungan: 'KANDUNG' as ParentChildRelation['jenis_hubungan'],
    urutan_anak: 1,
    keterangan: '',
  });

  // Kinship finder
  const [kinA, setKinA] = useState('');
  const [kinB, setKinB] = useState('');
  const [kinResult, setKinResult] = useState('');

  async function fetchTree() {
    setLoading(true);
    try {
      const res = await fetch('/api/family-tree', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        onNotify(data.message || 'Gagal memuat data silsilah.', 'error');
        return;
      }
      setMembers(data.members);
      setCouples(data.couples);
      setParentRelations(data.parentRelations);
      setRootId(data.rootId || 'BMT-0000');

      // Expand Generasi 0 and 1 by default for readable initial tree
      const defaultExp = new Set<string>([data.rootId || 'BMT-0000']);
      (data.members as MemberRecord[]).forEach((m) => {
        if (m.generasi_level <= 1) defaultExp.add(m.id_anggota);
      });
      setExpandedIds(defaultExp);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTree();
  }, []);

  useEffect(() => {
    if (initialFocusMemberId) {
      setFocusId(initialFocusMemberId);
      setViewMode('KELUARGA_INTI');
    }
  }, [initialFocusMemberId]);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id_anggota, m])), [members]);

  const memberOptions: SearchableOption[] = useMemo(
    () =>
      members.map((m) => ({
        value: m.id_anggota,
        label: `${m.kode_silsilah ? `[${m.kode_silsilah}] ` : ''}${m.nama_lengkap}`,
        sublabel: `${m.generasi_label} · ${m.status_keturunan} · ${m.id_anggota}`,
        keywords: `${m.nama_panggilan || ''} ${m.tempat_lahir || ''}`,
      })),
    [members]
  );

  const spousesByMember = useMemo(() => {
    const map = new Map<string, { rel: SpouseRelation; partner: MemberRecord }[]>();
    couples.forEach((c) => {
      if (!c.status_aktif) return;
      const m1 = memberMap.get(c.id_anggota_1);
      const m2 = memberMap.get(c.id_anggota_2);
      if (m1 && m2) {
        const arr1 = map.get(m1.id_anggota) || [];
        arr1.push({ rel: c, partner: m2 });
        map.set(m1.id_anggota, arr1);

        const arr2 = map.get(m2.id_anggota) || [];
        arr2.push({ rel: c, partner: m1 });
        map.set(m2.id_anggota, arr2);
      }
    });
    map.forEach((arr) => arr.sort((a, b) => a.rel.urutan_pasangan - b.rel.urutan_pasangan));
    return map;
  }, [couples, memberMap]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, { rel: ParentChildRelation; child: MemberRecord }[]>();
    const seenPerParent = new Map<string, Set<string>>();

    function addChild(parentId: string, rel: ParentChildRelation, child: MemberRecord) {
      if (!parentId) return;
      const seen = seenPerParent.get(parentId) || new Set<string>();
      if (seen.has(child.id_anggota)) return;
      seen.add(child.id_anggota);
      seenPerParent.set(parentId, seen);
      const arr = map.get(parentId) || [];
      arr.push({ rel, child });
      map.set(parentId, arr);
    }

    parentRelations.forEach((r) => {
      if (!r.status_aktif) return;
      const child = memberMap.get(r.id_anak);
      if (!child) return;
      if (r.id_ayah) addChild(r.id_ayah, r, child);
      if (r.id_ibu) addChild(r.id_ibu, r, child);
    });

    map.forEach((arr) => arr.sort((a, b) => a.rel.urutan_anak - b.rel.urutan_anak));
    return map;
  }, [parentRelations, memberMap]);

  const searchMatches = useMemo(() => {
    const q = treeSearch.trim().toLowerCase();
    if (!q) return [];
    return members
      .filter((m) =>
        `${m.nama_lengkap} ${m.kode_silsilah} ${m.id_anggota}`.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [members, treeSearch]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandToDepth(maxDepth: number) {
    const next = new Set<string>();
    members.forEach((m) => {
      if (m.generasi_level < maxDepth) next.add(m.id_anggota);
    });
    setExpandedIds(next);
  }

  async function handleSaveSpouse(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/family-tree/spouses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(spouseForm),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      onNotify(data.message || 'Gagal menyimpan relasi pasangan.', 'error');
      return;
    }
    onNotify('Relasi pasangan berhasil disimpan dan generasi dihitung ulang.');
    setRelationModalOpen(false);
    fetchTree();
  }

  async function handleSaveParent(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/family-tree/parents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(parentForm),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      onNotify(data.message || 'Gagal menyimpan relasi orang tua–anak.', 'error');
      return;
    }
    onNotify('Relasi orang tua–anak berhasil disimpan tanpa siklus.');
    setRelationModalOpen(false);
    fetchTree();
  }

  async function handleFindKinship() {
    if (!kinA || !kinB) return;
    const params = new URLSearchParams({ idA: kinA, idB: kinB });
    const res = await fetch(`/api/family-tree/relationship?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      setKinResult(data.summary);
    } else {
      onNotify(data.message || 'Gagal melacak hubungan.', 'error');
    }
  }

  function renderMemberCard(m: MemberRecord, roleTag?: string) {
    const spouses = spousesByMember.get(m.id_anggota) || [];
    const childCount = (childrenByParent.get(m.id_anggota) || []).length;
    const isExpanded = expandedIds.has(m.id_anggota);
    const fullName = [m.gelar_depan, m.nama_lengkap, m.gelar_belakang].filter(Boolean).join(' ');

    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-3 min-w-[230px] max-w-[300px] text-xs">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono tabular-nums text-[11px] text-green-800 font-semibold">
              {m.kode_silsilah || m.id_anggota}
              {roleTag ? ` · ${roleTag}` : ''}
            </div>
            <button
              type="button"
              onClick={() => setDetailMemberId(m.id_anggota)}
              className="font-bold text-neutral-900 hover:text-green-800 hover:underline text-left cursor-pointer mt-0.5 block"
            >
              {fullName}
            </button>
            <div className="text-[11px] text-neutral-500 mt-0.5">
              {m.generasi_label} · {m.status_keturunan} · {m.status_hidup}
            </div>
          </div>
          {childCount > 0 && (
            <button
              type="button"
              onClick={() => toggleExpand(m.id_anggota)}
              title={isExpanded ? 'Ciutkan cabang' : 'Buka cabang'}
              className="p-1 text-neutral-600 hover:bg-neutral-100 rounded cursor-pointer shrink-0 print:hidden"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {spouses.length > 0 && (
          <div className="mt-2 pt-2 border-t border-neutral-100 space-y-1">
            {spouses.map(({ rel, partner }) => (
              <div key={rel.relasi_pasangan_id} className="text-[11px] text-neutral-700">
                <span className="text-amber-700 font-semibold">Pasangan {rel.urutan_pasangan}: </span>
                <button
                  type="button"
                  onClick={() => setDetailMemberId(partner.id_anggota)}
                  className="font-medium text-neutral-900 hover:text-green-800 hover:underline cursor-pointer text-left"
                >
                  {[partner.gelar_depan, partner.nama_lengkap, partner.gelar_belakang].filter(Boolean).join(' ')}
                </button>
                <span className="text-neutral-400"> · {rel.status_hubungan}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderVerticalNode(memberId: string, visited: Set<string>, depth = 0): React.ReactNode {
    if (visited.has(memberId) || depth > 8) return null;
    const m = memberMap.get(memberId);
    if (!m) return null;

    const nextVisited = new Set(visited);
    nextVisited.add(memberId);
    const children = childrenByParent.get(memberId) || [];
    const isExpanded = expandedIds.has(memberId);

    return (
      <div key={memberId} className="space-y-2">
        <div className="flex items-center gap-2">
          {renderMemberCard(m)}
        </div>
        {children.length > 0 && isExpanded && (
          <div className="ml-6 pl-4 border-l border-neutral-300 space-y-3 pt-1">
            {children.map(({ child }) => renderVerticalNode(child.id_anggota, nextVisited, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  function renderHorizontalNode(memberId: string, visited: Set<string>, depth = 0): React.ReactNode {
    if (visited.has(memberId) || depth > 6) return null;
    const m = memberMap.get(memberId);
    if (!m) return null;

    const nextVisited = new Set(visited);
    nextVisited.add(memberId);
    const children = childrenByParent.get(memberId) || [];
    const isExpanded = expandedIds.has(memberId);

    return (
      <div key={memberId} className="flex items-start gap-6">
        <div className="shrink-0">{renderMemberCard(m)}</div>
        {children.length > 0 && isExpanded && (
          <div className="space-y-3 pl-4 border-l border-neutral-300">
            {children.map(({ child }) => renderHorizontalNode(child.id_anggota, nextVisited, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  const branchRoots = useMemo(() => {
    return (childrenByParent.get(rootId) || []).map((c) => c.child);
  }, [childrenByParent, rootId]);

  const activeBranchRoot = useMemo(() => {
    return (
      branchRoots.find((b) => b.kode_silsilah === selectedCabang) ||
      members.find((m) => m.kode_silsilah === selectedCabang && m.status_keturunan !== 'Menantu') ||
      members.find((m) => m.kode_silsilah === selectedCabang) ||
      branchRoots[0] ||
      null
    );
  }, [branchRoots, members, selectedCabang]);

  const focusMember = memberMap.get(focusId) || memberMap.get(rootId) || members[0];
  const focusParents = useMemo(
    () => parentRelations.filter((r) => r.status_aktif && r.id_anak === focusMember?.id_anggota),
    [parentRelations, focusMember]
  );
  const focusSpouses = focusMember ? spousesByMember.get(focusMember.id_anggota) || [] : [];
  const focusChildren = focusMember ? childrenByParent.get(focusMember.id_anggota) || [] : [];

  if (loading && members.length === 0) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-xs text-neutral-500">
        Memuat pohon silsilah keluarga besar...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Silsilah Keluarga Multi-Pasangan</h2>
            <p className="text-xs text-neutral-600 mt-0.5">
              Klik nama anggota untuk detail profil. Dukungan multi-pasangan, pelacakan hubungan, dan validasi anti-siklus.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {permission.can_edit && (
              <button
                type="button"
                onClick={() => setRelationModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Kelola Relasi</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setPrintTreeOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / PDF</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap border border-neutral-300 rounded-lg overflow-hidden text-xs font-semibold">
            {(
              [
                ['VERTIKAL', 'Pohon Vertikal'],
                ['HORIZONTAL', 'Pohon Horizontal'],
                ['CABANG', 'Per Cabang (1–9)'],
                ['KELUARGA_INTI', 'Keluarga Inti'],
              ] as [TreeViewMode, string][]
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 cursor-pointer ${
                  viewMode === mode
                    ? 'bg-green-700 text-white'
                    : 'bg-white text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(viewMode === 'VERTIKAL' || viewMode === 'HORIZONTAL') && (
              <>
                <button
                  type="button"
                  onClick={() => expandToDepth(2)}
                  className="px-2.5 py-1.5 text-xs border border-neutral-300 rounded-lg bg-white hover:bg-neutral-50 cursor-pointer"
                >
                  Ringkas (2 Gen)
                </button>
                <button
                  type="button"
                  onClick={() => expandToDepth(6)}
                  className="px-2.5 py-1.5 text-xs border border-neutral-300 rounded-lg bg-white hover:bg-neutral-50 cursor-pointer"
                >
                  Buka Semua
                </button>
              </>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={treeSearch}
                onChange={(e) => setTreeSearch(e.target.value)}
                placeholder="Loncat ke anggota..."
                className="pl-8 pr-3 py-1.5 text-xs border border-neutral-300 rounded-lg w-52"
              />
              {searchMatches.length > 0 && (
                <div className="absolute right-0 mt-1 w-72 bg-white border border-neutral-200 rounded-lg shadow-lg z-30 max-h-60 overflow-y-auto divide-y divide-neutral-100">
                  {searchMatches.map((m) => (
                    <button
                      key={m.id_anggota}
                      type="button"
                      onClick={() => {
                        setFocusId(m.id_anggota);
                        setViewMode('KELUARGA_INTI');
                        setTreeSearch('');
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-green-50 cursor-pointer"
                    >
                      <div className="font-semibold text-neutral-900">{m.nama_lengkap}</div>
                      <div className="font-mono text-[11px] text-neutral-500">
                        {m.kode_silsilah || m.id_anggota} · {m.generasi_label}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lacak Hubungan 2 Anggota */}
        <div className="bg-neutral-50 rounded-lg p-3.5 flex flex-wrap items-center gap-2.5 text-xs">
          <span className="font-semibold text-neutral-700 inline-flex items-center gap-1.5">
            <GitFork className="w-3.5 h-3.5 text-green-700" />
            <span>Lacak Hubungan:</span>
          </span>
          <SearchableSelect
            options={memberOptions}
            value={kinA}
            onChange={setKinA}
            placeholder="Pilih Anggota A..."
            searchPlaceholder="Ketik nama / kode silsilah..."
            allowClear
            compact
            className="w-[230px]"
          />
          <span className="text-neutral-500">dengan</span>
          <SearchableSelect
            options={memberOptions}
            value={kinB}
            onChange={setKinB}
            placeholder="Pilih Anggota B..."
            searchPlaceholder="Ketik nama / kode silsilah..."
            allowClear
            compact
            className="w-[230px]"
          />
          <button
            type="button"
            onClick={handleFindKinship}
            className="px-3 py-1.5 font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
          >
            Lacak
          </button>
          {kinResult && <span className="text-neutral-900 font-medium">{kinResult}</span>}
        </div>
      </div>

      {/* Canvas Area */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 overflow-x-auto print:border-0 print:p-0 print:overflow-visible">
        <div className="hidden print:block border-b-2 border-green-900 pb-3 mb-4">
          <div className="text-base font-bold text-green-900 uppercase">
            Paguyuban Keluarga Besar Bani Haji Mohammad Tohir
          </div>
          <div className="text-xs text-neutral-700">
            Guyub, Akur, Semedulur · Pohon Silsilah Keluarga ({viewMode.replace('_', ' ')})
          </div>
        </div>
        {members.length <= 1 ? (
          <div className="py-10 text-center text-xs text-neutral-500">
            Data silsilah belum tersedia. Silakan lakukan Commit Migrasi terlebih dahulu.
          </div>
        ) : (
          <>
            {viewMode === 'VERTIKAL' && renderVerticalNode(rootId, new Set())}

            {viewMode === 'HORIZONTAL' && (
              <div className="min-w-max py-2">{renderHorizontalNode(rootId, new Set())}</div>
            )}

            {viewMode === 'CABANG' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  <span className="text-xs font-semibold text-neutral-700">Pilih Cabang Anak ke-:</span>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setSelectedCabang(String(c));
                        const br = members.find(
                          (m) => m.kode_silsilah === String(c) && m.status_keturunan !== 'Menantu'
                        );
                        if (br) {
                          setExpandedIds((prev) => new Set(prev).add(br.id_anggota));
                        }
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg border cursor-pointer ${
                        selectedCabang === String(c)
                          ? 'bg-green-700 text-white border-green-700'
                          : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
                      }`}
                    >
                      Cabang {c}
                    </button>
                  ))}
                </div>
                {activeBranchRoot ? (
                  renderVerticalNode(activeBranchRoot.id_anggota, new Set())
                ) : (
                  <div className="text-xs text-neutral-500">Cabang {selectedCabang} belum memiliki data.</div>
                )}
              </div>
            )}

            {viewMode === 'KELUARGA_INTI' && focusMember && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
                  <div className="inline-flex items-center gap-2 text-sm font-bold text-neutral-900">
                    <Users className="w-4 h-4 text-green-700" />
                    <span>Fokus Keluarga Inti: {focusMember.nama_lengkap}</span>
                  </div>
                  <SearchableSelect
                    options={memberOptions}
                    value={focusMember.id_anggota}
                    onChange={(val) => {
                      if (val) setFocusId(val);
                    }}
                    placeholder="Pilih anggota fokus..."
                    searchPlaceholder="Ketik nama / kode silsilah..."
                    compact
                    className="w-[260px] print:hidden"
                  />
                </div>

                {/* Orang tua */}
                <div>
                  <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
                    Orang Tua
                  </div>
                  {focusParents.length === 0 ? (
                    <div className="text-xs text-neutral-500">Tidak ada data orang tua di atasnya.</div>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {focusParents.map((r) => (
                        <React.Fragment key={r.relasi_ortu_id}>
                          {r.id_ayah && memberMap.get(r.id_ayah) && (
                            <div
                              onClick={() => setFocusId(r.id_ayah)}
                              className="cursor-pointer"
                            >
                              {renderMemberCard(memberMap.get(r.id_ayah)!, 'Ayah')}
                            </div>
                          )}
                          {r.id_ibu && memberMap.get(r.id_ibu) && (
                            <div
                              onClick={() => setFocusId(r.id_ibu)}
                              className="cursor-pointer"
                            >
                              {renderMemberCard(memberMap.get(r.id_ibu)!, 'Ibu')}
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>

                {/* Diri & Multi-Pasangan */}
                <div>
                  <div className="text-xs font-bold text-green-800 uppercase tracking-wider mb-2">
                    Anggota Fokus &amp; Pasangan ({focusSpouses.length})
                  </div>
                  <div className="flex flex-wrap gap-3 items-start">
                    {renderMemberCard(focusMember, 'Fokus Utama')}
                    {focusSpouses.map(({ rel, partner }) => (
                      <div key={rel.relasi_pasangan_id}>
                        {renderMemberCard(partner, `Pasangan ke-${rel.urutan_pasangan}`)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Anak-anak */}
                <div>
                  <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
                    Anak-Anak ({focusChildren.length})
                  </div>
                  {focusChildren.length === 0 ? (
                    <div className="text-xs text-neutral-500">Belum ada anak tercatat.</div>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {focusChildren.map(({ rel, child }) => (
                        <div key={rel.relasi_ortu_id} className="space-y-1">
                          {renderMemberCard(child, `Anak ke-${rel.urutan_anak}`)}
                          <button
                            type="button"
                            onClick={() => setFocusId(child.id_anggota)}
                            className="text-[11px] font-semibold text-green-800 hover:underline cursor-pointer print:hidden"
                          >
                            Jadikan Fokus Keluarga Inti
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Kelola Relasi */}
      {relationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/55 p-4 print:hidden">
          <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-lg p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="text-sm font-bold text-neutral-900">Kelola Relasi Silsilah</h3>
              <div className="inline-flex border border-neutral-300 rounded-lg overflow-hidden font-semibold">
                <button
                  type="button"
                  onClick={() => setRelTab('PASANGAN')}
                  className={`px-3 py-1 cursor-pointer ${
                    relTab === 'PASANGAN' ? 'bg-green-700 text-white' : 'bg-white text-neutral-700'
                  }`}
                >
                  Pasangan
                </button>
                <button
                  type="button"
                  onClick={() => setRelTab('ORTU')}
                  className={`px-3 py-1 cursor-pointer ${
                    relTab === 'ORTU' ? 'bg-green-700 text-white' : 'bg-white text-neutral-700'
                  }`}
                >
                  Orang Tua – Anak
                </button>
              </div>
            </div>

            {relTab === 'PASANGAN' ? (
              <form onSubmit={handleSaveSpouse} className="space-y-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Anggota 1 (Keturunan / Utama)</label>
                  <SearchableSelect
                    required
                    options={memberOptions}
                    value={spouseForm.id_anggota_1}
                    onChange={(val) => setSpouseForm({ ...spouseForm, id_anggota_1: val })}
                    placeholder="Pilih anggota..."
                    searchPlaceholder="Ketik nama / kode silsilah..."
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Anggota 2 (Pasangan)</label>
                  <SearchableSelect
                    required
                    options={memberOptions}
                    value={spouseForm.id_anggota_2}
                    onChange={(val) => setSpouseForm({ ...spouseForm, id_anggota_2: val })}
                    placeholder="Pilih pasangan..."
                    searchPlaceholder="Ketik nama / kode silsilah..."
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Pasangan ke-</label>
                    <input
                      type="number"
                      min={1}
                      value={spouseForm.urutan_pasangan}
                      onChange={(e) =>
                        setSpouseForm({ ...spouseForm, urutan_pasangan: parseInt(e.target.value, 10) || 1 })
                      }
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Status</label>
                    <SearchableSelect
                      options={[
                        { value: 'MENIKAH', label: 'MENIKAH' },
                        { value: 'CERAI_HIDUP', label: 'CERAI HIDUP' },
                        { value: 'CERAI_MATI', label: 'CERAI MATI' },
                      ]}
                      value={spouseForm.status_hubungan}
                      onChange={(val) =>
                        setSpouseForm({
                          ...spouseForm,
                          status_hubungan: (val || 'MENIKAH') as SpouseRelation['status_hubungan'],
                        })
                      }
                      searchPlaceholder="Cari status..."
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Tgl Menikah</label>
                    <input
                      type="date"
                      value={spouseForm.tanggal_menikah}
                      onChange={(e) => setSpouseForm({ ...spouseForm, tanggal_menikah: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRelationModalOpen(false)}
                    className="px-3.5 py-2 border border-neutral-300 rounded-lg cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
                  >
                    Simpan Pasangan
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSaveParent} className="space-y-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Anak</label>
                  <SearchableSelect
                    required
                    options={memberOptions}
                    value={parentForm.id_anak}
                    onChange={(val) => setParentForm({ ...parentForm, id_anak: val })}
                    placeholder="Pilih anak..."
                    searchPlaceholder="Ketik nama / kode silsilah..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Ayah</label>
                    <SearchableSelect
                      allowClear
                      options={memberOptions}
                      value={parentForm.id_ayah}
                      onChange={(val) => setParentForm({ ...parentForm, id_ayah: val })}
                      placeholder="Pilih ayah..."
                      searchPlaceholder="Ketik nama / kode silsilah..."
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Ibu</label>
                    <SearchableSelect
                      allowClear
                      options={memberOptions}
                      value={parentForm.id_ibu}
                      onChange={(val) => setParentForm({ ...parentForm, id_ibu: val })}
                      placeholder="Pilih ibu..."
                      searchPlaceholder="Ketik nama / kode silsilah..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Jenis Hubungan</label>
                    <SearchableSelect
                      options={[
                        { value: 'KANDUNG', label: 'KANDUNG' },
                        { value: 'ANGKAT', label: 'ANGKAT' },
                        { value: 'TIRI', label: 'TIRI' },
                      ]}
                      value={parentForm.jenis_hubungan}
                      onChange={(val) =>
                        setParentForm({
                          ...parentForm,
                          jenis_hubungan: (val || 'KANDUNG') as ParentChildRelation['jenis_hubungan'],
                        })
                      }
                      searchPlaceholder="Cari jenis..."
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Anak ke-</label>
                    <input
                      type="number"
                      min={1}
                      value={parentForm.urutan_anak}
                      onChange={(e) =>
                        setParentForm({ ...parentForm, urutan_anak: parseInt(e.target.value, 10) || 1 })
                      }
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRelationModalOpen(false)}
                    className="px-3.5 py-2 border border-neutral-300 rounded-lg cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer"
                  >
                    Simpan Relasi
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {detailMemberId && (
        <MemberDetailModal
          token={token}
          memberId={detailMemberId}
          masters={masters}
          canEdit={memberEditAllowed}
          onClose={() => setDetailMemberId(null)}
          onSelectMember={(nextId) => setDetailMemberId(nextId)}
          onEditFull={(mem) => {
            setDetailMemberId(null);
            setEditingMember(mem);
          }}
          onOpenTreeFocus={(id) => {
            setDetailMemberId(null);
            setFocusId(id);
            setViewMode('KELUARGA_INTI');
          }}
          onNotify={onNotify}
        />
      )}

      {editingMember && (
        <MemberFormModal
          token={token}
          member={editingMember}
          masters={masters}
          onClose={() => setEditingMember(null)}
          onSaved={() => {
            setEditingMember(null);
            fetchTree();
          }}
          onNotify={onNotify}
        />
      )}

      {/* Konsep Format Cetak & PDF Silsilah */}
      {(() => {
        if (!printTreeOpen) return null;

        type TreePrintRow = {
          depth: number;
          kode: string;
          nama: string;
          generasi: string;
          keturunan: string;
          pasangan: string;
          status: string;
        };

        const rows: TreePrintRow[] = [];
        const visited = new Set<string>();

        const formatSpouses = (id: string) => {
          const list = spousesByMember.get(id) || [];
          if (list.length === 0) return '-';
          return list
            .map(({ rel, partner }) => {
              const name = [partner.gelar_depan, partner.nama_lengkap, partner.gelar_belakang].filter(Boolean).join(' ');
              return `${list.length > 1 ? `[${rel.urutan_pasangan}] ` : ''}${name}`;
            })
            .join('; ');
        };

        const walk = (memberId: string, depth: number) => {
          if (visited.has(memberId) || depth > 8) return;
          const m = memberMap.get(memberId);
          if (!m) return;
          visited.add(memberId);
          rows.push({
            depth,
            kode: m.kode_silsilah || m.id_anggota,
            nama: [m.gelar_depan, m.nama_lengkap, m.gelar_belakang].filter(Boolean).join(' '),
            generasi: m.generasi_label,
            keturunan: m.status_keturunan,
            pasangan: formatSpouses(m.id_anggota),
            status: m.status_hidup,
          });
          const kids = childrenByParent.get(memberId) || [];
          kids.forEach(({ child }) => walk(child.id_anggota, depth + 1));
        };

        if (viewMode === 'KELUARGA_INTI' && focusMember) {
          focusParents.forEach((p) => {
            if (p.id_ayah && memberMap.get(p.id_ayah)) {
              const ay = memberMap.get(p.id_ayah)!;
              rows.push({
                depth: 0,
                kode: ay.kode_silsilah || ay.id_anggota,
                nama: `[Ayah] ${ay.nama_lengkap}`,
                generasi: ay.generasi_label,
                keturunan: ay.status_keturunan,
                pasangan: formatSpouses(ay.id_anggota),
                status: ay.status_hidup,
              });
            }
            if (p.id_ibu && memberMap.get(p.id_ibu)) {
              const ib = memberMap.get(p.id_ibu)!;
              rows.push({
                depth: 0,
                kode: ib.kode_silsilah || ib.id_anggota,
                nama: `[Ibu] ${ib.nama_lengkap}`,
                generasi: ib.generasi_label,
                keturunan: ib.status_keturunan,
                pasangan: formatSpouses(ib.id_anggota),
                status: ib.status_hidup,
              });
            }
          });
          rows.push({
            depth: 1,
            kode: focusMember.kode_silsilah || focusMember.id_anggota,
            nama: `[Fokus] ${focusMember.nama_lengkap}`,
            generasi: focusMember.generasi_label,
            keturunan: focusMember.status_keturunan,
            pasangan: formatSpouses(focusMember.id_anggota),
            status: focusMember.status_hidup,
          });
          focusChildren.forEach(({ rel, child }) => {
            rows.push({
              depth: 2,
              kode: child.kode_silsilah || child.id_anggota,
              nama: `[Anak ke-${rel.urutan_anak}] ${child.nama_lengkap}`,
              generasi: child.generasi_label,
              keturunan: child.status_keturunan,
              pasangan: formatSpouses(child.id_anggota),
              status: child.status_hidup,
            });
          });
        } else if (viewMode === 'CABANG' && activeBranchRoot) {
          walk(activeBranchRoot.id_anggota, 0);
        } else {
          walk(rootId, 0);
        }

        const modeSubtitle =
          viewMode === 'CABANG'
            ? `Silsilah Cabang Anak ke-${selectedCabang}`
            : viewMode === 'KELUARGA_INTI' && focusMember
            ? `Silsilah Keluarga Inti: ${focusMember.nama_lengkap}`
            : 'Pohon Silsilah Lengkap Keluarga Besar (Semua Cabang)';

        return (
          <PrintPreviewModal
            open={printTreeOpen}
            onClose={() => setPrintTreeOpen(false)}
            title="Bagan & Daftar Silsilah Keluarga"
            subtitle={modeSubtitle}
            orientation="landscape"
            summary={[
              { label: 'Mode Tampilan', value: viewMode.replace('_', ' ') },
              { label: 'Simpul Tercetak', value: `${rows.length} anggota` },
              { label: 'Total Anggota Terdaftar', value: `${members.length} jiwa` },
              { label: 'Relasi Pasangan Aktif', value: `${couples.filter((c) => c.status_aktif).length}` },
            ]}
            leftSignerTitle="Mengetahui, Ketua Paguyuban"
            rightSignerTitle="Koordinator Silsilah"
            onNotify={onNotify}
            onDownloadPdf={() =>
              generateTablePdf({
                filename: `silsilah_bani_tohir_${viewMode.toLowerCase()}.pdf`,
                title: 'Bagan & Daftar Silsilah Keluarga',
                subtitle: modeSubtitle,
                orientation: 'landscape',
                summary: [
                  { label: 'Mode', value: viewMode.replace('_', ' ') },
                  { label: 'Simpul Tercetak', value: `${rows.length} anggota` },
                  { label: 'Total Anggota', value: `${members.length} jiwa` },
                  { label: 'Relasi Pasangan', value: `${couples.filter((c) => c.status_aktif).length}` },
                ],
                headers: ['No', 'Kode', 'Struktur / Nama Lengkap', 'Generasi', 'Keturunan', 'Pasangan', 'Status'],
                rows: rows.map((r, idx) => [
                  idx + 1,
                  r.kode,
                  `${'  '.repeat(r.depth)}${r.depth > 0 ? '|- ' : ''}${r.nama}`,
                  r.generasi,
                  r.keturunan,
                  r.pasangan,
                  r.status,
                ]),
                columnAlignments: { 0: 'center' },
                leftSignerTitle: 'Mengetahui, Ketua Paguyuban',
                rightSignerTitle: 'Koordinator Silsilah',
              })
            }
          >
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-green-800 text-white font-semibold">
                  <th className="py-2 px-2 border border-green-900 text-center w-9">No</th>
                  <th className="py-2 px-2 border border-green-900">Kode</th>
                  <th className="py-2 px-2 border border-green-900">Garis Keturunan &amp; Nama</th>
                  <th className="py-2 px-2 border border-green-900">Generasi</th>
                  <th className="py-2 px-2 border border-green-900">Keturunan</th>
                  <th className="py-2 px-2 border border-green-900">Pasangan</th>
                  <th className="py-2 px-2 border border-green-900">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={`${r.kode}-${idx}`} className={idx % 2 === 1 ? 'bg-neutral-50' : 'bg-white'}>
                    <td className="py-1.5 px-2 border border-neutral-200 font-mono text-center">{idx + 1}</td>
                    <td className="py-1.5 px-2 border border-neutral-200 font-mono font-semibold text-green-900">{r.kode}</td>
                    <td className="py-1.5 px-2 border border-neutral-200 font-medium">
                      <span style={{ paddingLeft: `${r.depth * 14}px` }} className="inline-block">
                        {r.depth > 0 ? '└─ ' : ''}
                        {r.nama}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 border border-neutral-200">{r.generasi}</td>
                    <td className="py-1.5 px-2 border border-neutral-200">{r.keturunan}</td>
                    <td className="py-1.5 px-2 border border-neutral-200 text-neutral-700">{r.pasangan}</td>
                    <td className="py-1.5 px-2 border border-neutral-200">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PrintPreviewModal>
        );
      })()}
    </div>
  );
}
