/**
 * FamilyTree.gs
 * Modul Silsilah Keluarga Multi-Pasangan dengan validasi anti-siklus (DFS),
 * kalkulasi generasi otomatis (BFS dari Leluhur Utama), dan pelacak hubungan kekerabatan.
 */

function getFamilyTreeGraph(sessionToken) {
  var actor = requireAuth(sessionToken, 'SILSILAH', 'view');
  var perms = getPermissionsForRole_(actor.role_id);
  var canSensitive = perms.ANGGOTA && perms.ANGGOTA.view_sensitive_contact;

  var members = readSheetObjects(SHEET_NAMES.ANGGOTA, true).filter(function (m) {
    return !(m.is_archived === true || String(m.is_archived).toUpperCase() === 'TRUE');
  }).map(function (m) {
    return projectMemberForRole_(m, canSensitive);
  });

  var pasangan = readSheetObjects(SHEET_NAMES.PASANGAN, true).filter(function (p) {
    return p.status_aktif !== false && String(p.status_aktif).toUpperCase() !== 'FALSE';
  });
  var hubunganOrtu = readSheetObjects(SHEET_NAMES.HUBUNGAN_ORANGTUA, true).filter(function (h) {
    return h.status_aktif !== false && String(h.status_aktif).toUpperCase() !== 'FALSE';
  });

  return {
    ok: true,
    rootId: APP_CONFIG.ROOT_MEMBER_ID,
    members: members,
    pasangan: pasangan,
    hubunganOrtu: hubunganOrtu
  };
}

/**
 * Menambah atau mengubah relasi pasangan (mendukung 1 anggota memiliki 2+ pasangan).
 */
function saveSpouseRelation(sessionToken, payload) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'SILSILAH', 'edit');
    var id1 = sanitizeString(payload.id_anggota_1);
    var id2 = sanitizeString(payload.id_anggota_2);
    if (!id1 || !id2 || id1 === id2) {
      throw new Error('Pilih dua anggota yang berbeda untuk relasi pasangan.');
    }

    var now = nowJakartaIso();
    var psgId = sanitizeString(payload.relasi_pasangan_id);
    var existing = readSheetObjects(SHEET_NAMES.PASANGAN, false);

    if (!psgId) {
      var seqCount = existing.filter(function (p) {
        return p.id_anggota_1 === id1 || p.id_anggota_2 === id1;
      }).length;
      psgId = generateUuid('PSG');
      var row = {
        relasi_pasangan_id: psgId,
        id_anggota_1: id1,
        id_anggota_2: id2,
        urutan_pasangan: parseInt(payload.urutan_pasangan, 10) || (seqCount + 1),
        tanggal_menikah: sanitizeString(payload.tanggal_menikah),
        tanggal_berakhir: sanitizeString(payload.tanggal_berakhir),
        status_hubungan: sanitizeString(payload.status_hubungan) || 'MENIKAH',
        keterangan: sanitizeString(payload.keterangan),
        status_aktif: true,
        created_at: now,
        created_by: actor.username_login
      };
      appendObjectRows(SHEET_NAMES.PASANGAN, [row]);
      writeAuditLog(actor, 'TAMBAH_PASANGAN', SHEET_NAMES.PASANGAN, psgId, null, row, 'BERHASIL', 'Tambah relasi pasangan');
    } else {
      var patch = {
        urutan_pasangan: parseInt(payload.urutan_pasangan, 10) || 1,
        tanggal_menikah: sanitizeString(payload.tanggal_menikah),
        tanggal_berakhir: sanitizeString(payload.tanggal_berakhir),
        status_hubungan: sanitizeString(payload.status_hubungan) || 'MENIKAH',
        keterangan: sanitizeString(payload.keterangan)
      };
      updateRowByPrimaryKey(SHEET_NAMES.PASANGAN, 'relasi_pasangan_id', psgId, patch);
      writeAuditLog(actor, 'EDIT_PASANGAN', SHEET_NAMES.PASANGAN, psgId, null, patch, 'BERHASIL', 'Edit relasi pasangan');
    }

    recalculateGenerationsInternal_();
    return { ok: true, relasi_pasangan_id: psgId };
  });
}

/**
 * Menambah relasi orang tua - anak dengan validasi anti-siklus (DFS).
 */
function saveParentChildRelation(sessionToken, payload) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'SILSILAH', 'edit');
    var idAnak = sanitizeString(payload.id_anak);
    var idAyah = sanitizeString(payload.id_ayah);
    var idIbu = sanitizeString(payload.id_ibu);

    if (!idAnak) throw new Error('ID Anak wajib dipilih.');
    if (!idAyah && !idIbu) throw new Error('Pilih minimal Ayah atau Ibu.');
    if (idAnak === idAyah || idAnak === idIbu) {
      throw new Error('Relasi tidak valid: seseorang tidak bisa menjadi orang tua bagi dirinya sendiri.');
    }

    var allOrtu = readSheetObjects(SHEET_NAMES.HUBUNGAN_ORANGTUA, false);
    if (idAyah && isAncestor_(allOrtu, idAnak, idAyah)) {
      throw new Error('Validasi anti-siklus: calon Ayah merupakan keturunan dari Anak ini.');
    }
    if (idIbu && isAncestor_(allOrtu, idAnak, idIbu)) {
      throw new Error('Validasi anti-siklus: calon Ibu merupakan keturunan dari Anak ini.');
    }

    var relId = sanitizeString(payload.relasi_ortu_id);
    var now = nowJakartaIso();
    if (!relId) {
      relId = generateUuid('ORT');
      var row = {
        relasi_ortu_id: relId,
        id_anak: idAnak,
        id_ayah: idAyah,
        id_ibu: idIbu,
        id_pasangan_ortu: sanitizeString(payload.id_pasangan_ortu),
        jenis_hubungan: sanitizeString(payload.jenis_hubungan) || 'KANDUNG',
        urutan_anak: parseInt(payload.urutan_anak, 10) || 1,
        keterangan: sanitizeString(payload.keterangan),
        status_aktif: true,
        created_at: now,
        created_by: actor.username_login
      };
      appendObjectRows(SHEET_NAMES.HUBUNGAN_ORANGTUA, [row]);
      writeAuditLog(actor, 'TAMBAH_RELASI_ORTU', SHEET_NAMES.HUBUNGAN_ORANGTUA, relId, null, row, 'BERHASIL', 'Tambah relasi orang tua-anak');
    } else {
      var patch = {
        id_ayah: idAyah,
        id_ibu: idIbu,
        id_pasangan_ortu: sanitizeString(payload.id_pasangan_ortu),
        jenis_hubungan: sanitizeString(payload.jenis_hubungan) || 'KANDUNG',
        urutan_anak: parseInt(payload.urutan_anak, 10) || 1,
        keterangan: sanitizeString(payload.keterangan)
      };
      updateRowByPrimaryKey(SHEET_NAMES.HUBUNGAN_ORANGTUA, 'relasi_ortu_id', relId, patch);
      writeAuditLog(actor, 'EDIT_RELASI_ORTU', SHEET_NAMES.HUBUNGAN_ORANGTUA, relId, null, patch, 'BERHASIL', 'Edit relasi orang tua-anak');
    }

    recalculateGenerationsInternal_();
    return { ok: true, relasi_ortu_id: relId };
  });
}

function isAncestor_(ortuRows, candidateAncestorId, targetNodeId) {
  var visited = {};
  var stack = [targetNodeId];
  while (stack.length > 0) {
    var curr = stack.pop();
    if (curr === candidateAncestorId) return true;
    if (visited[curr]) continue;
    visited[curr] = true;
    ortuRows.forEach(function (r) {
      if (r.id_anak === curr && r.status_aktif !== false) {
        if (r.id_ayah) stack.push(r.id_ayah);
        if (r.id_ibu) stack.push(r.id_ibu);
      }
    });
  }
  return false;
}

/**
 * Menghitung ulang level generasi secara otomatis dari Leluhur Utama menggunakan BFS.
 */
function recalculateGenerationsInternal_() {
  var members = readSheetObjects(SHEET_NAMES.ANGGOTA, false);
  var ortu = readSheetObjects(SHEET_NAMES.HUBUNGAN_ORANGTUA, false);
  var pasangan = readSheetObjects(SHEET_NAMES.PASANGAN, false);
  var genList = readSheetObjects(SHEET_NAMES.MASTER_GENERASI, true);

  var genLabelByLevel = {};
  genList.forEach(function (g) { genLabelByLevel[parseInt(g.level_angka, 10)] = g.nama_generasi; });

  var childrenOf = {};
  ortu.forEach(function (r) {
    if (r.status_aktif === false) return;
    if (r.id_ayah) {
      childrenOf[r.id_ayah] = childrenOf[r.id_ayah] || [];
      childrenOf[r.id_ayah].push(r.id_anak);
    }
    if (r.id_ibu) {
      childrenOf[r.id_ibu] = childrenOf[r.id_ibu] || [];
      childrenOf[r.id_ibu].push(r.id_anak);
    }
  });

  var levels = {};
  levels[APP_CONFIG.ROOT_MEMBER_ID] = 0;
  var queue = [APP_CONFIG.ROOT_MEMBER_ID];
  while (queue.length > 0) {
    var curr = queue.shift();
    var lvl = levels[curr];
    (childrenOf[curr] || []).forEach(function (childId) {
      if (levels[childId] === undefined) {
        levels[childId] = lvl + 1;
        queue.push(childId);
      }
    });
  }

  // Pasangan/menantu mewarisi level pasangannya
  pasangan.forEach(function (p) {
    if (levels[p.id_anggota_1] !== undefined && levels[p.id_anggota_2] === undefined) {
      levels[p.id_anggota_2] = levels[p.id_anggota_1];
    } else if (levels[p.id_anggota_2] !== undefined && levels[p.id_anggota_1] === undefined) {
      levels[p.id_anggota_1] = levels[p.id_anggota_2];
    }
  });

  members.forEach(function (m) {
    if (levels[m.id_anggota] !== undefined && parseInt(m.generasi_level, 10) !== levels[m.id_anggota]) {
      var lv = levels[m.id_anggota];
      updateRowByPrimaryKey(SHEET_NAMES.ANGGOTA, 'id_anggota', m.id_anggota, {
        generasi_level: lv,
        generasi_label: genLabelByLevel[lv] || ('Generasi-' + lv)
      });
    }
  });
}

function findRelationshipBetween(sessionToken, idA, idB) {
  requireAuth(sessionToken, 'SILSILAH', 'view');
  if (!idA || !idB) throw new Error('Pilih dua anggota untuk dilacak.');
  if (idA === idB) return { ok: true, summary: 'Kedua pilihan merujuk pada anggota yang sama.' };

  var ortu = readSheetObjects(SHEET_NAMES.HUBUNGAN_ORANGTUA, true);
  var members = readSheetObjects(SHEET_NAMES.ANGGOTA, true);
  var nameMap = {};
  members.forEach(function (m) { nameMap[m.id_anggota] = m.nama_lengkap; });

  function getAncestorsDist(startId) {
    var dist = {};
    dist[startId] = 0;
    var q = [startId];
    while (q.length > 0) {
      var cur = q.shift();
      ortu.forEach(function (r) {
        if (r.id_anak === cur) {
          [r.id_ayah, r.id_ibu].forEach(function (p) {
            if (p && dist[p] === undefined) {
              dist[p] = dist[cur] + 1;
              q.push(p);
            }
          });
        }
      });
    }
    return dist;
  }

  var ancA = getAncestorsDist(idA);
  var ancB = getAncestorsDist(idB);
  var bestLca = null;
  var bestSum = 9999;

  Object.keys(ancA).forEach(function (id) {
    if (ancB[id] !== undefined && ancA[id] + ancB[id] < bestSum) {
      bestSum = ancA[id] + ancB[id];
      bestLca = id;
    }
  });

  if (!bestLca) {
    return { ok: true, summary: 'Tidak ditemukan jalur leluhur kandung langsung (kemungkinan terhubung melalui pernikahan/menantu).' };
  }

  var dA = ancA[bestLca];
  var dB = ancB[bestLca];
  var relDesc = 'Terhubung melalui leluhur ' + (nameMap[bestLca] || bestLca) + ' (' + dA + ' generasi dari ' + (nameMap[idA] || idA) + ', ' + dB + ' generasi dari ' + (nameMap[idB] || idB) + ').';
  if (dA === 0) relDesc = (nameMap[idA] || idA) + ' adalah leluhur (' + dB + ' tingkat di atas) ' + (nameMap[idB] || idB) + '.';
  else if (dB === 0) relDesc = (nameMap[idB] || idB) + ' adalah leluhur (' + dA + ' tingkat di atas) ' + (nameMap[idA] || idA) + '.';
  else if (dA === 1 && dB === 1) relDesc = 'Saudara sekandung / seayah-seibu melalui ' + (nameMap[bestLca] || bestLca) + '.';
  else if (dA === 2 && dB === 2) relDesc = 'Sepupu (Misan) melalui kakek/nenek ' + (nameMap[bestLca] || bestLca) + '.';
  else if (dA === 3 && dB === 3) relDesc = 'Sepupu dua kali (Mindhoan) melalui buyut ' + (nameMap[bestLca] || bestLca) + '.';

  return { ok: true, lcaId: bestLca, dA: dA, dB: dB, summary: relDesc };
}
