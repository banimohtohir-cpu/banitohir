/**
 * Household.gs
 * Modul Kepala Keluarga & Rumah Tangga terpisah dari relasi biologis silsilah.
 * Menjamin 1 anggota hanya menjadi kepala pada 1 rumah tangga aktif (kecuali diizinkan admin).
 */

function listHouseholdsWithSummary(sessionToken, searchQuery) {
  var actor = requireAuth(sessionToken, 'RUMAH_TANGGA', 'view');
  var perms = getPermissionsForRole_(actor.role_id);
  var canSensitive = perms.ANGGOTA && perms.ANGGOTA.view_sensitive_contact;

  var rts = readSheetObjects(SHEET_NAMES.RUMAH_TANGGA, true);
  var anggotaRt = readSheetObjects(SHEET_NAMES.ANGGOTA_RUMAH, true);
  var members = readSheetObjects(SHEET_NAMES.ANGGOTA, true);
  var memberMap = {};
  members.forEach(function (m) { memberMap[m.id_anggota] = projectMemberForRole_(m, canSensitive); });

  var countMap = {};
  var membersByRt = {};
  anggotaRt.forEach(function (ar) {
    var active = ar.status_aktif === true || String(ar.status_aktif).toUpperCase() === 'TRUE';
    if (!active) return;
    countMap[ar.id_rumah_tangga] = (countMap[ar.id_rumah_tangga] || 0) + 1;
    membersByRt[ar.id_rumah_tangga] = membersByRt[ar.id_rumah_tangga] || [];
    membersByRt[ar.id_rumah_tangga].push({
      id_anggota_rumah: ar.id_anggota_rumah,
      id_anggota: ar.id_anggota,
      peran_dalam_rt: ar.peran_dalam_rt,
      anggota: memberMap[ar.id_anggota] || null
    });
  });

  var q = sanitizeString(searchQuery).toLowerCase();
  var list = rts.map(function (rt) {
    var kk = memberMap[rt.id_kepala_keluarga] || null;
    return Object.assign({}, rt, {
      kepala_keluarga: kk,
      jumlah_anggota: countMap[rt.id_rumah_tangga] || 0,
      anggota_list: membersByRt[rt.id_rumah_tangga] || [],
      no_kontak_rt: canSensitive ? rt.no_kontak_rt : (rt.no_kontak_rt ? '•••• (Terbatas)' : ''),
      alamat_ringkas: canSensitive ? rt.alamat_ringkas : 'Alamat dilindungi'
    });
  }).filter(function (rt) {
    if (!q) return true;
    var kkName = rt.kepala_keluarga ? rt.kepala_keluarga.nama_lengkap : '';
    return String(rt.nama_rumah_tangga + ' ' + kkName + ' ' + rt.id_rumah_tangga).toLowerCase().indexOf(q) > -1;
  });

  return { ok: true, households: list, riwayatKk: readSheetObjects(SHEET_NAMES.RIWAYAT_KK, false).reverse().slice(0, 50) };
}

function createHousehold(sessionToken, payload) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'RUMAH_TANGGA', 'create');
    var idKk = sanitizeString(payload.id_kepala_keluarga);
    var namaRt = sanitizeString(payload.nama_rumah_tangga);
    var izinkanGanda = payload.izinkan_kk_ganda === true;

    if (!idKk || !namaRt) throw new Error('Nama rumah tangga dan Kepala Keluarga wajib diisi.');

    var rts = readSheetObjects(SHEET_NAMES.RUMAH_TANGGA, false);
    var alreadyHead = rts.some(function (r) {
      var active = r.status_aktif === true || String(r.status_aktif).toUpperCase() === 'TRUE';
      return active && r.id_kepala_keluarga === idKk;
    });
    if (alreadyHead && !izinkanGanda) {
      throw new Error('Anggota ini sudah menjadi Kepala Keluarga pada rumah tangga aktif lain.');
    }

    var now = nowJakartaIso();
    var rtId = generateUuid('RTG');
    var row = {
      id_rumah_tangga: rtId,
      nama_rumah_tangga: namaRt,
      id_kepala_keluarga: idKk,
      provinsi_id: sanitizeString(payload.provinsi_id),
      kabkota_id: sanitizeString(payload.kabkota_id),
      kecamatan_id: sanitizeString(payload.kecamatan_id),
      kelurahan_id: sanitizeString(payload.kelurahan_id),
      alamat_ringkas: sanitizeString(payload.alamat_ringkas),
      no_kontak_rt: sanitizeString(payload.no_kontak_rt),
      status_aktif: true,
      izinkan_kk_ganda: izinkanGanda,
      tanggal_bentuk: now.substring(0, 10),
      keterangan: sanitizeString(payload.keterangan),
      created_at: now,
      updated_at: now
    };
    appendObjectRows(SHEET_NAMES.RUMAH_TANGGA, [row]);
    appendObjectRows(SHEET_NAMES.ANGGOTA_RUMAH, [{
      id_anggota_rumah: generateUuid('ART'),
      id_rumah_tangga: rtId,
      id_anggota: idKk,
      peran_dalam_rt: 'KEPALA',
      tanggal_masuk: now.substring(0, 10),
      tanggal_keluar: '',
      status_aktif: true,
      created_at: now
    }]);
    updateRowByPrimaryKey(SHEET_NAMES.ANGGOTA, 'id_anggota', idKk, { is_kk: true, updated_at: now });

    writeAuditLog(actor, 'TAMBAH_RUMAH_TANGGA', SHEET_NAMES.RUMAH_TANGGA, rtId, null, row, 'BERHASIL', 'Membuat rumah tangga baru');
    return { ok: true, id_rumah_tangga: rtId };
  });
}

function changeHouseholdHead(sessionToken, idRumahTangga, idKkBaru, alasan) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'RUMAH_TANGGA', 'edit');
    var rts = readSheetObjects(SHEET_NAMES.RUMAH_TANGGA, false);
    var target = rts.filter(function (r) { return r.id_rumah_tangga === idRumahTangga; })[0];
    if (!target) throw new Error('Rumah tangga tidak ditemukan.');

    var now = nowJakartaIso();
    var oldKk = target.id_kepala_keluarga;
    updateRowByPrimaryKey(SHEET_NAMES.RUMAH_TANGGA, 'id_rumah_tangga', idRumahTangga, {
      id_kepala_keluarga: idKkBaru,
      updated_at: now
    });

    appendObjectRows(SHEET_NAMES.RIWAYAT_KK, [{
      id_riwayat_kk: generateUuid('RKK'),
      id_rumah_tangga: idRumahTangga,
      id_kk_lama: oldKk,
      id_kk_baru: idKkBaru,
      tanggal_pergantian: now.substring(0, 10),
      alasan: sanitizeString(alasan) || 'Pergantian Kepala Keluarga',
      pencatat_user_id: actor.user_id,
      created_at: now
    }]);

    writeAuditLog(actor, 'GANTI_KEPALA_KELUARGA', SHEET_NAMES.RUMAH_TANGGA, idRumahTangga, { kk_lama: oldKk }, { kk_baru: idKkBaru }, 'BERHASIL', alasan || 'Ganti kepala keluarga');
    return { ok: true };
  });
}

function assignMemberToHousehold(sessionToken, idRumahTangga, idAnggota, peranDalamRt) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'RUMAH_TANGGA', 'edit');
    var now = nowJakartaIso();
    var existing = readSheetObjects(SHEET_NAMES.ANGGOTA_RUMAH, false);

    // Nonaktifkan keanggotaan rumah tangga aktif sebelumnya (pindah rumah tangga)
    existing.forEach(function (ar) {
      var active = ar.status_aktif === true || String(ar.status_aktif).toUpperCase() === 'TRUE';
      if (active && ar.id_anggota === idAnggota) {
        updateRowByPrimaryKey(SHEET_NAMES.ANGGOTA_RUMAH, 'id_anggota_rumah', ar.id_anggota_rumah, {
          status_aktif: false,
          tanggal_keluar: now.substring(0, 10)
        });
      }
    });

    var newId = generateUuid('ART');
    appendObjectRows(SHEET_NAMES.ANGGOTA_RUMAH, [{
      id_anggota_rumah: newId,
      id_rumah_tangga: idRumahTangga,
      id_anggota: idAnggota,
      peran_dalam_rt: sanitizeString(peranDalamRt) || 'ANGGOTA',
      tanggal_masuk: now.substring(0, 10),
      tanggal_keluar: '',
      status_aktif: true,
      created_at: now
    }]);

    writeAuditLog(actor, 'PINDAH_ANGGOTA_RT', SHEET_NAMES.ANGGOTA_RUMAH, newId, null, { id_rumah_tangga: idRumahTangga, id_anggota: idAnggota }, 'BERHASIL', 'Menempatkan/memindahkan anggota ke rumah tangga');
    return { ok: true };
  });
}
