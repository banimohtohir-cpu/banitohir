/**
 * Member.gs
 * Modul CRUD Lengkap Data Anggota Keluarga dengan kontrol penuh Super Admin & Admin Keluarga.
 * Mendukung edit semua field (nama, gelar, kode, keturunan, generasi, tanggal lahir, status wafat, wilayah, kontak, pekerjaan, arsip).
 */

function listMembersFull(sessionToken, filters) {
  var actor = requireAuth(sessionToken, 'ANGGOTA', 'view');
  var perms = getPermissionsForRole_(actor.role_id);
  var canSensitive = perms.ANGGOTA && perms.ANGGOTA.view_sensitive_contact;

  var f = filters || {};
  var q = sanitizeString(f.q).toLowerCase();
  var genFilter = sanitizeString(f.generasi);
  var statusKetFilter = sanitizeString(f.status_keturunan);
  var statusHidupFilter = sanitizeString(f.status_hidup);
  var cabangFilter = sanitizeString(f.cabang);
  var includeArchived = f.includeArchived === true;
  var needEditOnly = f.needEditOnly === true;

  var rows = readSheetObjects(SHEET_NAMES.ANGGOTA, true);
  var filtered = rows.filter(function (m) {
    var archived = m.is_archived === true || String(m.is_archived).toUpperCase() === 'TRUE';
    if (!includeArchived && archived) return false;
    if (genFilter && String(m.generasi_label) !== genFilter) return false;
    if (statusKetFilter && String(m.status_keturunan) !== statusKetFilter) return false;
    if (statusHidupFilter && String(m.status_hidup) !== statusHidupFilter) return false;
    if (cabangFilter && String(m.kode_silsilah).split('.')[0] !== cabangFilter) return false;
    if (needEditOnly && m.presisi_tgl_lahir !== 'PERLU_EDIT' && m.tanggal_lahir) return false;
    if (q) {
      var hay = [m.id_anggota, m.kode_silsilah, m.gelar_depan, m.nama_lengkap, m.gelar_belakang, m.nama_panggilan, m.tempat_lahir, m.keterangan_alamat].join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });

  var pg = Math.max(parseInt(f.page, 10) || 1, 1);
  var sz = Math.min(Math.max(parseInt(f.pageSize, 10) || 25, 5), 100);
  var slice = filtered.slice((pg - 1) * sz, pg * sz).map(function (m) {
    return projectMemberForRole_(m, canSensitive);
  });

  return { ok: true, total: filtered.length, page: pg, pageSize: sz, rows: slice };
}

function getMemberDetail(sessionToken, idAnggota) {
  var actor = requireAuth(sessionToken, 'ANGGOTA', 'view');
  var perms = getPermissionsForRole_(actor.role_id);
  var canSensitive = perms.ANGGOTA && perms.ANGGOTA.view_sensitive_contact;

  var members = readSheetObjects(SHEET_NAMES.ANGGOTA, true);
  var map = {};
  members.forEach(function (m) { map[m.id_anggota] = projectMemberForRole_(m, canSensitive); });

  var target = map[idAnggota];
  if (!target) throw new Error('Data anggota tidak ditemukan.');

  var ortuRows = readSheetObjects(SHEET_NAMES.HUBUNGAN_ORANGTUA, true);
  var psgRows = readSheetObjects(SHEET_NAMES.PASANGAN, true);
  var rtRows = readSheetObjects(SHEET_NAMES.ANGGOTA_RUMAH, true);
  var rumahMap = {};
  readSheetObjects(SHEET_NAMES.RUMAH_TANGGA, true).forEach(function (r) { rumahMap[r.id_rumah_tangga] = r; });

  var myParentsRel = ortuRows.filter(function (o) { return o.id_anak === idAnggota && o.status_aktif !== false; });
  var myChildrenRel = ortuRows.filter(function (o) { return (o.id_ayah === idAnggota || o.id_ibu === idAnggota) && o.status_aktif !== false; });
  var mySpousesRel = psgRows.filter(function (p) { return (p.id_anggota_1 === idAnggota || p.id_anggota_2 === idAnggota) && p.status_aktif !== false; });

  var parents = [];
  myParentsRel.forEach(function (r) {
    if (r.id_ayah && map[r.id_ayah]) parents.push({ peran: 'Ayah', jenis: r.jenis_hubungan, anggota: map[r.id_ayah] });
    if (r.id_ibu && map[r.id_ibu]) parents.push({ peran: 'Ibu', jenis: r.jenis_hubungan, anggota: map[r.id_ibu] });
  });

  var spouses = mySpousesRel.map(function (p) {
    var otherId = p.id_anggota_1 === idAnggota ? p.id_anggota_2 : p.id_anggota_1;
    return {
      relasi_pasangan_id: p.relasi_pasangan_id,
      urutan_pasangan: p.urutan_pasangan,
      status_hubungan: p.status_hubungan,
      tanggal_menikah: p.tanggal_menikah,
      tanggal_berakhir: p.tanggal_berakhir,
      anggota: map[otherId] || null
    };
  });

  var children = myChildrenRel.map(function (c) {
    return {
      relasi_ortu_id: c.relasi_ortu_id,
      jenis_hubungan: c.jenis_hubungan,
      id_pasangan_ortu: c.id_pasangan_ortu,
      anggota: map[c.id_anak] || null
    };
  }).filter(function (x) { return x.anggota !== null; });

  var parentIds = parents.map(function (p) { return p.anggota.id_anggota; });
  var siblingIds = {};
  ortuRows.forEach(function (o) {
    if (o.id_anak !== idAnggota && ((o.id_ayah && parentIds.indexOf(o.id_ayah) > -1) || (o.id_ibu && parentIds.indexOf(o.id_ibu) > -1))) {
      siblingIds[o.id_anak] = true;
    }
  });
  var siblings = Object.keys(siblingIds).map(function (sid) { return map[sid]; }).filter(Boolean);

  var households = rtRows.filter(function (ar) { return ar.id_anggota === idAnggota && ar.status_aktif !== false; }).map(function (ar) {
    return {
      id_rumah_tangga: ar.id_rumah_tangga,
      peran_dalam_rt: ar.peran_dalam_rt,
      rumah_tangga: rumahMap[ar.id_rumah_tangga] || null
    };
  });

  return {
    ok: true,
    member: target,
    parents: parents,
    spouses: spouses,
    children: children,
    siblings: siblings,
    households: households
  };
}

/**
 * Tambah atau Edit Lengkap (Full Edit) data anggota oleh Super Admin / Admin Keluarga.
 */
function saveMemberFull(sessionToken, payload) {
  return withScriptLock(function () {
    var isCreate = !sanitizeString(payload.id_anggota);
    var actor = requireAuth(sessionToken, 'ANGGOTA', isCreate ? 'create' : 'edit');

    var namaLengkap = sanitizeString(payload.nama_lengkap);
    if (!namaLengkap) throw new Error('Nama lengkap wajib diisi.');

    var members = readSheetObjects(SHEET_NAMES.ANGGOTA, false);
    var now = nowJakartaIso();

    // Validasi anti-duplikasi sederhana saat tambah baru
    if (isCreate && !payload.forceDuplicate) {
      var tgl = sanitizeString(payload.tanggal_lahir);
      var dup = members.filter(function (m) {
        return String(m.nama_lengkap).toLowerCase() === namaLengkap.toLowerCase() &&
          (!tgl || String(m.tanggal_lahir) === tgl);
      })[0];
      if (dup) {
        return {
          ok: false,
          duplicateWarning: true,
          message: 'Ditemukan anggota bernama sama (' + dup.nama_lengkap + ' · ' + dup.id_anggota + '). Konfirmasi jika memang orang berbeda.'
        };
      }
    }

    var genLevel = parseInt(payload.generasi_level, 10);
    if (isNaN(genLevel)) genLevel = 1;
    var genMap = { 0: 'Leluhur Utama', 1: 'Anak', 2: 'Cucu', 3: 'Buyut', 4: 'Canggah', 5: 'Wareng', 6: 'Udeg-udeg', 7: 'Gantung Siwur' };
    var genLabel = sanitizeString(payload.generasi_label) || genMap[genLevel] || ('Generasi-' + genLevel);

    var statusHidup = sanitizeString(payload.status_hidup).toUpperCase() || 'HIDUP';
    var tglLahir = sanitizeString(payload.tanggal_lahir);

    var recordData = {
      kode_silsilah: normalizeLegacyCode(payload.kode_silsilah),
      kode_legacy: sanitizeString(payload.kode_legacy),
      gelar_depan: sanitizeString(payload.gelar_depan),
      nama_lengkap: namaLengkap,
      gelar_belakang: sanitizeString(payload.gelar_belakang),
      nama_panggilan: sanitizeString(payload.nama_panggilan),
      jenis_kelamin: sanitizeString(payload.jenis_kelamin).toUpperCase(),
      foto_drive_id: sanitizeString(payload.foto_drive_id),
      tempat_lahir: sanitizeString(payload.tempat_lahir),
      tanggal_lahir: tglLahir,
      presisi_tgl_lahir: sanitizeString(payload.presisi_tgl_lahir) || (tglLahir ? 'LENGKAP' : 'KOSONG'),
      status_keturunan: sanitizeString(payload.status_keturunan) || 'Kandung',
      generasi_level: genLevel,
      generasi_label: genLabel,
      status_hidup: statusHidup,
      tanggal_wafat: statusHidup === 'WAFAT' ? sanitizeString(payload.tanggal_wafat) : '',
      tempat_wafat: statusHidup === 'WAFAT' ? sanitizeString(payload.tempat_wafat) : '',
      catatan_wafat: statusHidup === 'WAFAT' ? sanitizeString(payload.catatan_wafat) : '',
      provinsi_id: sanitizeString(payload.provinsi_id),
      kabkota_id: sanitizeString(payload.kabkota_id),
      kecamatan_id: sanitizeString(payload.kecamatan_id),
      kelurahan_id: sanitizeString(payload.kelurahan_id),
      nama_jalan: sanitizeString(payload.nama_jalan),
      rt: sanitizeString(payload.rt),
      rw: sanitizeString(payload.rw),
      no_rumah: sanitizeString(payload.no_rumah),
      kode_pos: sanitizeString(payload.kode_pos),
      keterangan_alamat: sanitizeString(payload.keterangan_alamat),
      no_hp: sanitizeString(payload.no_hp),
      no_hp_alt: sanitizeString(payload.no_hp_alt),
      email: sanitizeString(payload.email),
      pendidikan_id: sanitizeString(payload.pendidikan_id),
      pekerjaan_id: sanitizeString(payload.pekerjaan_id),
      pekerjaan_lainnya: sanitizeString(payload.pekerjaan_lainnya),
      is_kk: payload.is_kk === true || String(payload.is_kk).toUpperCase() === 'TRUE',
      status_keanggotaan: sanitizeString(payload.status_keanggotaan) || 'AKTIF',
      tanggal_gabung: sanitizeString(payload.tanggal_gabung) || now.substring(0, 10),
      catatan: sanitizeString(payload.catatan),
      is_archived: payload.is_archived === true || String(payload.is_archived).toUpperCase() === 'TRUE',
      needs_verification: !tglLahir,
      updated_at: now,
      updated_by: actor.username_login
    };

    if (isCreate) {
      var relType = sanitizeString(payload.relation_type).toUpperCase();
      var relAyah = sanitizeString(payload.relation_ayah_id);
      var relIbu = sanitizeString(payload.relation_ibu_id);
      var relPasangan = sanitizeString(payload.relation_pasangan_id);
      var ortuRows = readSheetObjects(SHEET_NAMES.HUBUNGAN_ORANGTUA, true);
      var psgRows = readSheetObjects(SHEET_NAMES.PASANGAN, true);
      var urutanAnak = 1;
      var urutanPsg = 1;

      if (relType === 'ANAK_DARI' && (relAyah || relIbu)) {
        var ayahObj = members.filter(function (m) { return m.id_anggota === relAyah; })[0];
        var ibuObj = members.filter(function (m) { return m.id_anggota === relIbu; })[0];
        var primaryParent = (ayahObj && ayahObj.status_keturunan !== 'Menantu' ? ayahObj : null) ||
          (ibuObj && ibuObj.status_keturunan !== 'Menantu' ? ibuObj : null) || ayahObj || ibuObj;
        if (primaryParent) {
          var pKode = sanitizeString(primaryParent.kode_silsilah);
          var isRoot = primaryParent.id_anggota === 'BMT-0000' || pKode === '0';
          var maxChild = 0;
          ortuRows.forEach(function (r) {
            if (r.status_aktif !== false && (r.id_ayah === primaryParent.id_anggota || r.id_ibu === primaryParent.id_anggota)) {
              maxChild = Math.max(maxChild, parseInt(r.urutan_anak, 10) || 0);
            }
          });
          members.forEach(function (m) {
            if (m.status_keturunan === 'Menantu') return;
            var mk = sanitizeString(m.kode_silsilah);
            if (isRoot && /^\d+$/.test(mk)) {
              maxChild = Math.max(maxChild, parseInt(mk, 10));
            } else if (!isRoot && pKode && mk.indexOf(pKode + '.') === 0) {
              var tail = mk.substring(pKode.length + 1);
              if (/^\d+$/.test(tail)) maxChild = Math.max(maxChild, parseInt(tail, 10));
            }
          });
          urutanAnak = maxChild + 1;
          recordData.kode_silsilah = isRoot ? String(urutanAnak) : (pKode ? pKode + '.' + urutanAnak : String(urutanAnak));
          recordData.generasi_level = (parseInt(primaryParent.generasi_level, 10) || 0) + 1;
          recordData.generasi_label = genMap[recordData.generasi_level] || ('Generasi-' + recordData.generasi_level);
          recordData.status_keturunan = sanitizeString(payload.relation_jenis_hubungan).toUpperCase() === 'ANGKAT' ? 'Anak Angkat' : 'Kandung';
        }
      } else if (relType === 'PASANGAN_DARI' && relPasangan) {
        var spObj = members.filter(function (m) { return m.id_anggota === relPasangan; })[0];
        if (spObj) {
          urutanPsg = psgRows.filter(function (c) {
            return c.status_aktif !== false && (c.id_anggota_1 === spObj.id_anggota || c.id_anggota_2 === spObj.id_anggota);
          }).length + 1;
          recordData.kode_silsilah = spObj.kode_silsilah;
          recordData.generasi_level = spObj.generasi_level;
          recordData.generasi_label = spObj.generasi_label;
          recordData.status_keturunan = 'Menantu';
        }
      }

      var newId = generateMemberCodeId(members.length + 1);
      while (members.some(function (m) { return m.id_anggota === newId; })) {
        newId = generateUuid('BMT');
      }
      recordData.id_anggota = newId;
      recordData.created_at = now;
      recordData.created_by = actor.username_login;
      appendObjectRows(SHEET_NAMES.ANGGOTA, [recordData]);

      if (relType === 'ANAK_DARI' && (relAyah || relIbu)) {
        appendObjectRows(SHEET_NAMES.HUBUNGAN_ORANGTUA, [{
          relasi_ortu_id: generateUuid('ORT'),
          id_anak: newId,
          id_ayah: relAyah,
          id_ibu: relIbu,
          id_pasangan_ortu: '',
          jenis_hubungan: sanitizeString(payload.relation_jenis_hubungan).toUpperCase() || 'KANDUNG',
          urutan_anak: urutanAnak,
          keterangan: 'Otomatis dari Tambah Anggota',
          status_aktif: true
        }]);
      } else if (relType === 'PASANGAN_DARI' && relPasangan) {
        appendObjectRows(SHEET_NAMES.PASANGAN, [{
          relasi_pasangan_id: generateUuid('PSG'),
          id_anggota_1: relPasangan,
          id_anggota_2: newId,
          urutan_pasangan: urutanPsg,
          tanggal_menikah: sanitizeString(payload.relation_tanggal_menikah),
          tanggal_berakhir: '',
          status_hubungan: sanitizeString(payload.relation_status_hubungan).toUpperCase() || 'MENIKAH',
          keterangan: 'Otomatis dari Tambah Anggota',
          status_aktif: true
        }]);
      }

      writeAuditLog(actor, 'TAMBAH_ANGGOTA', SHEET_NAMES.ANGGOTA, newId, null, { nama: namaLengkap, kode: recordData.kode_silsilah }, 'BERHASIL', 'Tambah anggota baru');
      return { ok: true, id_anggota: newId, kode_silsilah: recordData.kode_silsilah };
    } else {
      var targetId = sanitizeString(payload.id_anggota);
      var existing = members.filter(function (m) { return m.id_anggota === targetId; })[0];
      if (!existing) throw new Error('Anggota tidak ditemukan.');
      updateRowByPrimaryKey(SHEET_NAMES.ANGGOTA, 'id_anggota', targetId, recordData);
      writeAuditLog(actor, 'EDIT_ANGGOTA_LENGKAP', SHEET_NAMES.ANGGOTA, targetId, { nama: existing.nama_lengkap, kode: existing.kode_silsilah }, { nama: namaLengkap, kode: recordData.kode_silsilah }, 'BERHASIL', 'Pembaruan lengkap data anggota oleh ' + actor.role_id);
      return { ok: true, id_anggota: targetId };
    }
  });
}

function setMemberArchiveStatus(sessionToken, idAnggota, isArchived) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'ANGGOTA', 'delete');
    var patch = {
      is_archived: Boolean(isArchived),
      status_keanggotaan: isArchived ? 'ARSIP' : 'AKTIF',
      updated_at: nowJakartaIso(),
      updated_by: actor.username_login
    };
    var ok = updateRowByPrimaryKey(SHEET_NAMES.ANGGOTA, 'id_anggota', idAnggota, patch);
    if (!ok) throw new Error('Anggota tidak ditemukan.');
    writeAuditLog(actor, isArchived ? 'ARSIP_ANGGOTA' : 'AKTIFKAN_ANGGOTA', SHEET_NAMES.ANGGOTA, idAnggota, null, patch, 'BERHASIL', 'Ubah status arsip anggota');
    return { ok: true };
  });
}

function projectMemberForRole_(m, canSensitive) {
  var copy = Object.assign({}, m);
  if (!canSensitive) {
    copy.no_hp = m.no_hp ? '•••• (Terbatas)' : '';
    copy.no_hp_alt = '';
    copy.email = '';
    copy.nama_jalan = '';
    copy.rt = '';
    copy.rw = '';
    copy.no_rumah = '';
    copy.keterangan_alamat = m.keterangan_alamat ? 'Alamat dilindungi' : '';
  }
  return copy;
}
