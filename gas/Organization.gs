/**
 * Organization.gs
 * Tahap 4: Pengumuman Paguyuban, Kepengurusan, Kegiatan, Surat Resmi, Undangan & RSVP, serta Arsip Dokumen.
 */

function getOrganizationBundle(sessionToken) {
  var actor = requireAuth(sessionToken, 'ORGANISASI', 'view');
  var perms = getPermissionsForRole_(actor.role_id);
  var isPengurusPlus = ['SUPER_ADMIN', 'ADMIN_KELUARGA', 'PENGURUS', 'SEKRETARIS', 'BENDAHARA'].indexOf(actor.role_id) > -1;

  var anggota = readSheetObjects(SHEET_NAMES.ANGGOTA, true);
  var memberNameMap = {};
  var memberObjMap = {};
  anggota.forEach(function (m) {
    memberNameMap[m.id_anggota] = m.nama_lengkap;
    memberObjMap[m.id_anggota] = m;
  });

  var jabatan = readSheetObjects(SHEET_NAMES.JABATAN, true);
  var jabMap = {};
  jabatan.forEach(function (j) { jabMap[j.jabatan_id] = j; });

  var pengurus = readSheetObjects(SHEET_NAMES.PENGURUS, true).map(function (p) {
    var m = memberObjMap[p.id_anggota] || {};
    var j = jabMap[p.jabatan_id] || {};
    var fullName = [m.gelar_depan, m.nama_lengkap, m.gelar_belakang].filter(Boolean).join(' ') || p.id_anggota;
    var alamatParts = [m.nama_jalan, m.keterangan_alamat].filter(Boolean);
    return Object.assign({}, p, {
      nama_anggota: fullName,
      kode_silsilah: m.kode_silsilah || '',
      generasi_level: m.generasi_level,
      generasi_label: m.generasi_label || '',
      status_keturunan: m.status_keturunan || '',
      alamat_lengkap: alamatParts.join(' · '),
      no_hp: m.no_hp || '',
      email: m.email || '',
      foto_drive_id: m.foto_drive_id || '',
      nama_jabatan: j.nama_jabatan || p.jabatan_id,
      deskripsi_tugas: j.deskripsi_tugas || '',
      level_hierarki: j.level_hierarki || 99
    });
  });

  var kegiatan = readSheetObjects(SHEET_NAMES.KEGIATAN, true).map(function (k) {
    return Object.assign({}, k, {
      nama_pj: memberNameMap[k.id_penanggung_jawab] || k.id_penanggung_jawab
    });
  });

  var pengumuman = readSheetObjects(SHEET_NAMES.PENGUMUMAN, true).filter(function (a) {
    if (a.status_aktif === false || String(a.status_aktif).toUpperCase() === 'FALSE') return false;
    if (!isPengurusPlus && a.target_audiens === 'PENGURUS') return false;
    return true;
  });

  var surat = readSheetObjects(SHEET_NAMES.SURAT, true);
  var undangan = readSheetObjects(SHEET_NAMES.UNDANGAN, true);
  var arsip = readSheetObjects(SHEET_NAMES.ARSIP, true).filter(function (doc) {
    return isPengurusPlus || doc.visibilitas !== 'KHUSUS_PENGURUS';
  });

  return {
    ok: true,
    canManageOrg: !!(perms.ORGANISASI && perms.ORGANISASI.edit),
    canManageSurat: !!(perms.SURAT && perms.SURAT.edit),
    jabatan: jabatan,
    pengurus: pengurus,
    kegiatan: kegiatan,
    pengumuman: pengumuman,
    surat: surat,
    undangan: undangan,
    arsip: arsip
  };
}

function saveAnnouncement(sessionToken, payload) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'ORGANISASI', 'create');
    var judul = sanitizeString(payload.judul);
    var isi = sanitizeString(payload.isi);
    if (!judul || !isi) throw new Error('Judul dan isi pengumuman wajib diisi.');

    var now = nowJakartaIso();
    var row = {
      pengumuman_id: sanitizeString(payload.pengumuman_id) || generateUuid('PNG'),
      judul: judul,
      kategori: sanitizeString(payload.kategori) || 'UMUM',
      isi: isi,
      target_audiens: sanitizeString(payload.target_audiens) || 'SEMUA',
      is_pinned: payload.is_pinned === true,
      tanggal_publikasi: sanitizeString(payload.tanggal_publikasi) || now.substring(0, 10),
      status_aktif: payload.status_aktif !== false,
      penulis_user_id: actor.user_id,
      created_at: now
    };
    appendObjectRows(SHEET_NAMES.PENGUMUMAN, [row]);
    writeAuditLog(actor, 'TERBIT_PENGUMUMAN', SHEET_NAMES.PENGUMUMAN, row.pengumuman_id, null, row, 'BERHASIL', judul);
    return { ok: true, pengumuman: row };
  });
}

function saveBoardMember(sessionToken, payload) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'ORGANISASI', 'edit');
    var jabId = sanitizeString(payload.jabatan_id);
    var idAnggota = sanitizeString(payload.id_anggota);
    if (!jabId || !idAnggota) throw new Error('Jabatan dan anggota wajib dipilih.');

    var row = {
      pengurus_id: generateUuid('PGR'),
      jabatan_id: jabId,
      id_anggota: idAnggota,
      periode_nama: sanitizeString(payload.periode_nama) || '2026-2029',
      tanggal_mulai: sanitizeString(payload.tanggal_mulai) || nowJakartaIso().substring(0, 10),
      tanggal_berakhir: sanitizeString(payload.tanggal_berakhir),
      no_sk: sanitizeString(payload.no_sk),
      dokumen_sk_drive_id: sanitizeString(payload.dokumen_sk_drive_id),
      status_aktif: true,
      keterangan: sanitizeString(payload.keterangan),
      created_at: nowJakartaIso()
    };
    appendObjectRows(SHEET_NAMES.PENGURUS, [row]);
    writeAuditLog(actor, 'TAMBAH_PENGURUS', SHEET_NAMES.PENGURUS, row.pengurus_id, null, row, 'BERHASIL', jabId + ' -> ' + idAnggota);
    return { ok: true, pengurus: row };
  });
}

function saveActivity(sessionToken, payload) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'ORGANISASI', 'create');
    var nama = sanitizeString(payload.nama_kegiatan);
    if (!nama) throw new Error('Nama kegiatan wajib diisi.');

    var row = {
      kegiatan_id: generateUuid('KGT'),
      nama_kegiatan: nama,
      kategori_kegiatan: sanitizeString(payload.kategori_kegiatan) || 'SILATURAHMI',
      tanggal_mulai: sanitizeString(payload.tanggal_mulai) || nowJakartaIso().substring(0, 10),
      tanggal_selesai: sanitizeString(payload.tanggal_selesai),
      lokasi: sanitizeString(payload.lokasi),
      id_penanggung_jawab: sanitizeString(payload.id_penanggung_jawab),
      coa_terkait: sanitizeString(payload.coa_terkait) || '5101',
      anggaran_rencana: Number(payload.anggaran_rencana) || 0,
      status_kegiatan: sanitizeString(payload.status_kegiatan) || 'TERJADWAL',
      deskripsi: sanitizeString(payload.deskripsi),
      created_at: nowJakartaIso(),
      created_by: actor.username_login
    };
    appendObjectRows(SHEET_NAMES.KEGIATAN, [row]);
    writeAuditLog(actor, 'SIMPAN_KEGIATAN', SHEET_NAMES.KEGIATAN, row.kegiatan_id, null, row, 'BERHASIL', nama);
    return { ok: true, kegiatan: row };
  });
}

function saveOfficialLetter(sessionToken, payload) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'SURAT', 'create');
    var perihal = sanitizeString(payload.perihal);
    if (!perihal) throw new Error('Perihal surat wajib diisi.');

    var existing = readSheetObjects(SHEET_NAMES.SURAT, false);
    var seq = ('000' + (existing.length + 1)).slice(-3);
    var now = nowJakartaIso();
    var nomor = sanitizeString(payload.nomor_surat) || (seq + '/BMT/' + now.substring(5, 7) + '/' + now.substring(0, 4));

    var row = {
      surat_id: generateUuid('SRT'),
      nomor_surat: nomor,
      jenis_surat: sanitizeString(payload.jenis_surat) || 'UNDANGAN_ACARA',
      template_doc_id: '',
      perihal: perihal,
      isi_surat: sanitizeString(payload.isi_surat),
      tanggal_surat: sanitizeString(payload.tanggal_surat) || now.substring(0, 10),
      penerima_tipe: sanitizeString(payload.penerima_tipe) || 'SEMUA_KELUARGA',
      penerima_id: sanitizeString(payload.penerima_id),
      pejabat_ttd_id: sanitizeString(payload.pejabat_ttd_id),
      doc_drive_id: '',
      pdf_drive_id: '',
      status_surat: sanitizeString(payload.status_surat) || 'TERBIT',
      created_at: now,
      created_by: actor.username_login
    };
    appendObjectRows(SHEET_NAMES.SURAT, [row]);
    writeAuditLog(actor, 'BUAT_SURAT', SHEET_NAMES.SURAT, row.surat_id, null, row, 'BERHASIL', nomor + ' - ' + perihal);
    return { ok: true, surat: row };
  });
}

function saveArchiveDocument(sessionToken, payload) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'SURAT', 'create');
    var judul = sanitizeString(payload.judul);
    if (!judul) throw new Error('Judul dokumen arsip wajib diisi.');

    var url = sanitizeString(payload.drive_url);
    if (url && !/^https?:\/\//i.test(url)) {
      throw new Error('URL dokumen harus diawali http:// atau https://.');
    }

    var row = {
      arsip_id: generateUuid('ARS'),
      kategori_arsip: sanitizeString(payload.kategori_arsip) || 'NOTULEN',
      judul: judul,
      tanggal_dokumen: sanitizeString(payload.tanggal_dokumen) || nowJakartaIso().substring(0, 10),
      kegiatan_id: sanitizeString(payload.kegiatan_id),
      drive_file_id: sanitizeString(payload.drive_file_id),
      drive_url: url,
      deskripsi: sanitizeString(payload.deskripsi),
      visibilitas: sanitizeString(payload.visibilitas) || 'PUBLIK_KELUARGA',
      uploaded_by: actor.username_login,
      uploaded_at: nowJakartaIso()
    };
    appendObjectRows(SHEET_NAMES.ARSIP, [row]);
    writeAuditLog(actor, 'TAMBAH_ARSIP', SHEET_NAMES.ARSIP, row.arsip_id, null, row, 'BERHASIL', judul);
    return { ok: true, arsip: row };
  });
}

function saveInvitation(sessionToken, payload) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'SURAT', 'create');
    var row = {
      undangan_id: sanitizeString(payload.undangan_id) || generateUuid('UND'),
      kegiatan_id: sanitizeString(payload.kegiatan_id),
      surat_id: sanitizeString(payload.surat_id),
      target_tipe: sanitizeString(payload.target_tipe) || 'SEMUA_KELUARGA',
      target_id: sanitizeString(payload.target_id),
      status_kirim: sanitizeString(payload.status_kirim) || 'TERKIRIM',
      tanggal_kirim: sanitizeString(payload.tanggal_kirim) || nowJakartaIso().substring(0, 10),
      status_hadir: sanitizeString(payload.status_hadir) || 'BELUM_KONFIRMASI',
      file_pdf_drive_id: '',
      created_at: nowJakartaIso()
    };
    appendObjectRows(SHEET_NAMES.UNDANGAN, [row]);
    writeAuditLog(actor, 'KIRIM_UNDANGAN', SHEET_NAMES.UNDANGAN, row.undangan_id, null, row, 'BERHASIL', row.target_tipe);
    return { ok: true, undangan: row };
  });
}

function saveInvitationRsvp(sessionToken, undanganId, statusHadir) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'SURAT', 'view');
    var status = sanitizeString(statusHadir).toUpperCase();
    if (['HADIR', 'TIDAK_HADIR', 'RAGU', 'BELUM_KONFIRMASI'].indexOf(status) === -1) {
      throw new Error('Status kehadiran RSVP tidak valid.');
    }
    var ok = updateRowByPrimaryKey(SHEET_NAMES.UNDANGAN, 'undangan_id', undanganId, { status_hadir: status });
    if (!ok) throw new Error('Undangan tidak ditemukan.');
    writeAuditLog(actor, 'RSVP_UNDANGAN', SHEET_NAMES.UNDANGAN, undanganId, null, { status_hadir: status }, 'BERHASIL', 'RSVP: ' + status);
    return { ok: true, status_hadir: status };
  });
}

