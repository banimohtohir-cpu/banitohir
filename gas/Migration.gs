/**
 * Migration.gs
 * Mekanisme migrasi data aman (non-destruktif) dari spreadsheet lama Bani H. M. Tohir:
 *   1. Arsip sumber lama ke RAW_LEGACY_2026 (tanpa mengubah sheet asli)
 *   2. Dry-Run ke MIGRASI_STAGING dengan opsi Generate Kode Otomatis & Deteksi Anomali
 *   3. Edit staging / tanggal lahir melalui menu Edit
 *   4. Commit aman ke ANGGOTA, PASANGAN, HUBUNGAN_ORANGTUA, RUMAH_TANGGA, ANGGOTA_RUMAH
 */

function archiveSourceSheetToRaw(sessionToken, sourceSheetName) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'MIGRASI', 'create');
    initializeDatabase(actor);

    var ss = getDb();
    var srcName = sanitizeString(sourceSheetName) || APP_CONFIG.DEFAULT_SOURCE_SHEET;
    var srcSheet = ss.getSheetByName(srcName);
    if (!srcSheet) {
      throw new Error('Sheet sumber "' + srcName + '" tidak ditemukan.');
    }

    var values = srcSheet.getDataRange().getValues();
    if (values.length < 2) {
      throw new Error('Sheet sumber tidak memiliki data.');
    }

    // Cari baris header (mengandung "NO" dan "KODE" dan "NAMA")
    var headerIdx = -1;
    for (var r = 0; r < Math.min(values.length, 10); r++) {
      var joined = values[r].map(function (c) { return String(c).trim().toUpperCase(); }).join('|');
      if (joined.indexOf('NO|KODE|NAMA') > -1) {
        headerIdx = r;
        break;
      }
    }
    if (headerIdx === -1) {
      throw new Error('Baris header (NO, KODE, NAMA) tidak ditemukan pada sheet "' + srcName + '".');
    }

    var now = nowJakartaIso();
    var rawRows = [];
    for (var i = headerIdx + 1; i < values.length; i++) {
      var row = values[i];
      var colNo = sanitizeString(row[0]);
      var colKode = sanitizeString(row[1]);
      var colNama = sanitizeString(row[2]);
      // Hentikan bila masuk ke tabel REKAP di bagian bawah
      if (/REKAP ANGGOTA/i.test(colKode) || /REKAP ANGGOTA/i.test(colNo)) break;
      if (!/^\d+$/.test(colNo) && !colKode && !colNama) continue;
      if (!/^\d+$/.test(colNo)) continue;

      rawRows.push({
        raw_row_no: i + 1,
        NO: colNo,
        KODE: colKode,
        NAMA: colNama,
        IURAN: sanitizeString(row[3]),
        TEMPAT_TGL_LAHIR: sanitizeString(row[4]),
        KETERANGAN: sanitizeString(row[5]),
        STATUS: sanitizeString(row[6]),
        KK: sanitizeString(row[7]),
        PEKERJAAN: sanitizeString(row[8]),
        ALAMAT: sanitizeString(row[9]),
        EMAIL: sanitizeString(row[10]),
        NO_HP: sanitizeString(row[11]),
        WAFAT: sanitizeString(row[12]),
        TGL_WAFAT: sanitizeString(row[13]),
        LEN: sanitizeString(row[14]),
        archived_at: now
      });
    }

    overwriteSheetObjects(SHEET_NAMES.RAW_LEGACY_2026, rawRows);
    writeAuditLog(actor, 'ARSIP_RAW_MIGRASI', SHEET_NAMES.RAW_LEGACY_2026, srcName, null, { totalRows: rawRows.length }, 'BERHASIL', 'Menyalin data sumber ke RAW_LEGACY_2026 tanpa mengubah sheet asli');

    return { ok: true, totalArchived: rawRows.length, sourceSheet: srcName };
  });
}

/**
 * Dry-run & pembangunan MIGRASI_STAGING dengan opsi penyesuaian kode otomatis.
 * options: { codeMode: 'AUTO_GENERATE' | 'KEEP_RAW', skipEmptyNames: boolean }
 */
function runMigrationDryRun(sessionToken, options) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'MIGRASI', 'edit');
    initializeDatabase(actor);

    var opts = options || {};
    var codeMode = opts.codeMode === 'KEEP_RAW' ? 'KEEP_RAW' : 'AUTO_GENERATE';
    var skipEmptyNames = opts.skipEmptyNames !== false;

    var rawRows = readSheetObjects(SHEET_NAMES.RAW_LEGACY_2026, false);
    if (!rawRows || rawRows.length === 0) {
      throw new Error('Sheet RAW_LEGACY_2026 masih kosong. Jalankan Arsip Data Sumber terlebih dahulu.');
    }

    // Hitung frekuensi kode untuk mendeteksi multi-pasangan & anomali anak pakai kode ibu
    var normalizedCounts = {};
    rawRows.forEach(function (r) {
      var k = normalizeLegacyCode(r.KODE);
      if (k) normalizedCounts[k] = (normalizedCounts[k] || 0) + 1;
    });

    var stagingRows = [];
    var memberSeq = 1;
    var lastValidParentCode = '';
    var childCounterByParent = {};
    var now = nowJakartaIso();

    for (var i = 0; i < rawRows.length; i++) {
      var r = rawRows[i];
      var namaRaw = sanitizeString(r.NAMA);
      var rawKode = sanitizeString(r.KODE);
      var normKode = normalizeLegacyCode(rawKode);
      var flags = [];

      // Lewati baris instruksi non-anggota ("Yang belum terdaftar tulis di sini")
      if (/belum terdaftar/i.test(namaRaw)) continue;

      if (!namaRaw) {
        flags.push('NAMA_KOSONG');
      }

      var ket = sanitizeString(r.KETERANGAN);
      var st = sanitizeString(r.STATUS);
      var isMenantu = /menantu/i.test(ket) || /^menantu$/i.test(st);
      if (/menantu/i.test(ket) && st && !/^menantu$/i.test(st)) {
        flags.push('KONFLIK_STATUS_KETERANGAN');
        st = 'Menantu';
      } else if (!/menantu/i.test(ket) && /^menantu$/i.test(st)) {
        flags.push('KONFLIK_STATUS_KETERANGAN');
      }

      // Deteksi kasus anak tanpa sub-kode (contoh baris 391: 5.4.4 BAAYASYINA dengan ket/status kosong)
      var isChildUsingParentCode = !isMenantu && !ket && !st && normKode && normalizedCounts[normKode] >= 3;
      if (isChildUsingParentCode) {
        flags.push('ANAK_PAKAI_KODE_ORTU');
      }

      // Hitung kode hasil generate otomatis jika dipilih
      var genKode = normKode;
      if (codeMode === 'AUTO_GENERATE' && normKode) {
        if (rawKode !== normKode) {
          flags.push('TITIK_AKHIR_DIRAPIKAN');
        }
        if (isChildUsingParentCode) {
          childCounterByParent[normKode] = (childCounterByParent[normKode] || 0) + 1;
          genKode = normKode + '.' + childCounterByParent[normKode];
          flags.push('KODE_DIGENERATE_ULANG');
        } else if (!isMenantu && lastValidParentCode) {
          // Deteksi salah induk seperti 1.1.2.2.2 & 1.1.2.3.3 di bawah 1.1.3.1
          var parts = normKode.split('.');
          var parentSegs = lastValidParentCode.split('.');
          if (parts.length === parentSegs.length + 1 && parts.slice(0, parentSegs.length).join('.') !== lastValidParentCode) {
            // Cek apakah baris sebelumnya langsung adalah orang tua (4 segmen -> 5 segmen)
            if (lastValidParentCode.split('.').length === 4 && parts.length === 5 && parts[0] === parentSegs[0] && parts[1] === parentSegs[1]) {
              childCounterByParent[lastValidParentCode] = (childCounterByParent[lastValidParentCode] || 1) + 1;
              genKode = lastValidParentCode + '.' + childCounterByParent[lastValidParentCode];
              flags.push('KODE_INDUK_DISESUAIKAN');
            }
          }
        }
      }

      // Lacak parent terakhir untuk penomoran anak
      if (!isMenantu && genKode) {
        var segs = genKode.split('.');
        if (segs.length === 4) {
          lastValidParentCode = genKode;
          if (!childCounterByParent[genKode]) childCounterByParent[genKode] = 0;
        } else if (segs.length === 5 && segs.slice(0, 4).join('.') === lastValidParentCode) {
          var childNum = parseInt(segs[4], 10);
          if (!isNaN(childNum)) {
            childCounterByParent[lastValidParentCode] = Math.max(childCounterByParent[lastValidParentCode] || 0, childNum);
          }
        }
      }

      var splitName = splitNameAndTitles(namaRaw);
      var parsedTtl = parseIndonesianBirthdate(r.TEMPAT_TGL_LAHIR);
      if (parsedTtl.flag) flags.push(parsedTtl.flag);

      // Normalisasi status wafat (cek kolom WAFAT maupun TGL_WAFAT)
      var wafatCol = sanitizeString(r.WAFAT).toUpperCase();
      var tglWafatRaw = sanitizeString(r.TGL_WAFAT);
      var statusHidup = 'HIDUP';
      if (wafatCol === 'WAFAT' || /wafat/i.test(tglWafatRaw)) {
        statusHidup = 'WAFAT';
        if (wafatCol !== 'WAFAT') flags.push('STATUS_WAFAT_DINORMALISASI');
      } else if (!wafatCol) {
        statusHidup = 'TIDAK_DIKETAHUI';
      }

      var finalStatusKeturunan = isChildUsingParentCode ? 'Kandung' : (isMenantu ? 'Menantu' : (st || 'Kandung'));
      var genLevel = genKode ? genKode.split('.').length : 1;
      var genLabelMap = { 0: 'Leluhur Utama', 1: 'Anak', 2: 'Cucu', 3: 'Buyut', 4: 'Canggah', 5: 'Wareng', 6: 'Udeg-udeg', 7: 'Gantung Siwur' };
      var genLabel = genLabelMap[genLevel] || ('Generasi-' + genLevel);

      var isMultiSpouse = normKode && normalizedCounts[normKode] >= 3 && !isChildUsingParentCode;
      if (isMultiSpouse) flags.push('MULTI_PASANGAN');

      var actionStatus = (!namaRaw && skipEmptyNames) ? 'SKIP' : 'SIAP';

      stagingRows.push({
        staging_id: 'STG-' + ('0000' + (i + 1)).slice(-4),
        raw_row_no: r.raw_row_no,
        raw_no: r.NO,
        raw_kode: rawKode,
        generated_kode: genKode,
        code_resolution_mode: codeMode,
        id_anggota_calon: actionStatus === 'SKIP' ? '' : generateMemberCodeId(memberSeq++),
        gelar_depan: splitName.gelar_depan,
        nama_lengkap: splitName.nama_lengkap,
        gelar_belakang: splitName.gelar_belakang,
        status_keturunan: finalStatusKeturunan,
        generasi_level: genLevel,
        generasi_label: genLabel,
        tempat_lahir: parsedTtl.tempat_lahir,
        tanggal_lahir_iso: parsedTtl.tanggal_lahir_iso,
        presisi_tgl_lahir: parsedTtl.presisi,
        raw_ttl: r.TEMPAT_TGL_LAHIR,
        status_hidup: statusHidup,
        tanggal_wafat_raw: tglWafatRaw,
        is_kk: sanitizeString(r.KK).toUpperCase() === 'KK',
        pekerjaan_raw: sanitizeString(r.PEKERJAAN),
        alamat_raw: sanitizeString(r.ALAMAT),
        email: sanitizeString(r.EMAIL),
        no_hp: sanitizeString(r.NO_HP),
        iuran_nominal: parseRupiah(r.IURAN),
        is_multi_spouse_group: isMultiSpouse,
        anomaly_flags: flags.join(','),
        action_status: actionStatus,
        updated_at: now
      });
    }

    overwriteSheetObjects(SHEET_NAMES.MIGRASI_STAGING, stagingRows);
    writeAuditLog(actor, 'DRY_RUN_MIGRASI', SHEET_NAMES.MIGRASI_STAGING, codeMode, null, { totalStaging: stagingRows.length }, 'BERHASIL', 'Dry-run staging selesai');

    return { ok: true, totalStaging: stagingRows.length };
  });
}

function getStagingSummaryAndRows(sessionToken, filterMode, searchQuery, page, pageSize) {
  requireAuth(sessionToken, 'MIGRASI', 'view');
  var rows = readSheetObjects(SHEET_NAMES.MIGRASI_STAGING, false);
  var summary = {
    total: rows.length,
    siap: 0,
    skip: 0,
    perluEditTgl: 0,
    anomaliKode: 0,
    multiPasangan: 0,
    namaKosong: 0
  };

  rows.forEach(function (r) {
    if (r.action_status === 'SIAP') summary.siap++;
    if (r.action_status === 'SKIP') summary.skip++;
    var fl = String(r.anomaly_flags || '');
    if (r.presisi_tgl_lahir === 'PERLU_EDIT' || fl.indexOf('TGL_LAHIR_ANOMALI') > -1) summary.perluEditTgl++;
    if (fl.indexOf('KODE_') > -1 || fl.indexOf('ANAK_PAKAI_KODE_ORTU') > -1 || fl.indexOf('TITIK_AKHIR') > -1) summary.anomaliKode++;
    if (r.is_multi_spouse_group === true || String(r.is_multi_spouse_group).toUpperCase() === 'TRUE') summary.multiPasangan++;
    if (fl.indexOf('NAMA_KOSONG') > -1) summary.namaKosong++;
  });

  var filtered = rows;
  if (filterMode === 'TGL_LAHIR') {
    filtered = filtered.filter(function (r) {
      return r.presisi_tgl_lahir === 'PERLU_EDIT' || String(r.anomaly_flags || '').indexOf('TGL_LAHIR') > -1;
    });
  } else if (filterMode === 'KODE') {
    filtered = filtered.filter(function (r) {
      var fl = String(r.anomaly_flags || '');
      return fl.indexOf('KODE_') > -1 || fl.indexOf('ANAK_PAKAI_KODE_ORTU') > -1 || fl.indexOf('TITIK_AKHIR') > -1;
    });
  } else if (filterMode === 'MULTI_PASANGAN') {
    filtered = filtered.filter(function (r) {
      return r.is_multi_spouse_group === true || String(r.is_multi_spouse_group).toUpperCase() === 'TRUE';
    });
  } else if (filterMode === 'NAMA_KOSONG') {
    filtered = filtered.filter(function (r) {
      return String(r.anomaly_flags || '').indexOf('NAMA_KOSONG') > -1;
    });
  }

  var q = sanitizeString(searchQuery).toLowerCase();
  if (q) {
    filtered = filtered.filter(function (r) {
      return String(r.nama_lengkap + ' ' + r.raw_kode + ' ' + r.generated_kode + ' ' + r.raw_ttl).toLowerCase().indexOf(q) > -1;
    });
  }

  var pg = Math.max(parseInt(page, 10) || 1, 1);
  var sz = Math.min(Math.max(parseInt(pageSize, 10) || 25, 5), 100);
  var start = (pg - 1) * sz;

  return {
    ok: true,
    summary: summary,
    totalFiltered: filtered.length,
    page: pg,
    pageSize: sz,
    rows: filtered.slice(start, start + sz)
  };
}

function updateStagingRowOptions(sessionToken, stagingId, patch) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'MIGRASI', 'edit');
    var cleanPatch = { updated_at: nowJakartaIso() };
    if (patch.generated_kode !== undefined) cleanPatch.generated_kode = normalizeLegacyCode(patch.generated_kode);
    if (patch.code_resolution_mode !== undefined) cleanPatch.code_resolution_mode = sanitizeString(patch.code_resolution_mode);
    if (patch.tanggal_lahir_iso !== undefined) {
      cleanPatch.tanggal_lahir_iso = sanitizeString(patch.tanggal_lahir_iso);
      cleanPatch.presisi_tgl_lahir = cleanPatch.tanggal_lahir_iso ? 'LENGKAP' : 'KOSONG';
    }
    if (patch.tempat_lahir !== undefined) cleanPatch.tempat_lahir = sanitizeString(patch.tempat_lahir);
    if (patch.nama_lengkap !== undefined) cleanPatch.nama_lengkap = sanitizeString(patch.nama_lengkap);
    if (patch.action_status !== undefined) cleanPatch.action_status = sanitizeString(patch.action_status);

    var ok = updateRowByPrimaryKey(SHEET_NAMES.MIGRASI_STAGING, 'staging_id', stagingId, cleanPatch);
    if (!ok) throw new Error('Baris staging tidak ditemukan.');
    writeAuditLog(actor, 'EDIT_STAGING_MIGRASI', SHEET_NAMES.MIGRASI_STAGING, stagingId, null, cleanPatch, 'BERHASIL', 'Penyesuaian data staging');
    return { ok: true };
  });
}

function updateMemberBirthdate(sessionToken, idAnggota, tempatLahir, tanggalLahirIso, presisi) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'ANGGOTA', 'edit');
    var tgl = sanitizeString(tanggalLahirIso);
    if (tgl && !/^\d{4}-\d{2}-\d{2}$/.test(tgl)) {
      throw new Error('Format tanggal lahir harus YYYY-MM-DD.');
    }
    var patch = {
      tempat_lahir: sanitizeString(tempatLahir),
      tanggal_lahir: tgl,
      presisi_tgl_lahir: sanitizeString(presisi) || (tgl ? 'LENGKAP' : 'KOSONG'),
      needs_verification: !tgl,
      updated_at: nowJakartaIso(),
      updated_by: actor.username_login
    };
    var ok = updateRowByPrimaryKey(SHEET_NAMES.ANGGOTA, 'id_anggota', idAnggota, patch);
    if (!ok) throw new Error('Anggota tidak ditemukan.');
    writeAuditLog(actor, 'EDIT_TGL_LAHIR', SHEET_NAMES.ANGGOTA, idAnggota, null, patch, 'BERHASIL', 'Pembaruan tanggal lahir melalui menu Edit');
    return { ok: true };
  });
}

/**
 * Commit staging bersih ke tabel produksi secara aman.
 */
function commitMigrationToProduction(sessionToken) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'MIGRASI', 'create');
    var staging = readSheetObjects(SHEET_NAMES.MIGRASI_STAGING, false);
    var readyRows = staging.filter(function (r) { return r.action_status === 'SIAP' && r.nama_lengkap; });
    if (readyRows.length === 0) {
      throw new Error('Tidak ada baris staging berstatus SIAP untuk dimigrasi.');
    }

    var now = nowJakartaIso();
    var actorName = actor.username_login;
    var existingMembers = readSheetObjects(SHEET_NAMES.ANGGOTA, false);
    var existingKodeMap = {};
    existingMembers.forEach(function (m) {
      if (m.kode_silsilah) existingKodeMap[m.kode_silsilah + '|' + m.nama_lengkap] = m.id_anggota;
    });

    var anggotaToAdd = [];
    // Pastikan Leluhur Utama H. Mohammad Tohir ada
    var hasRoot = existingMembers.some(function (m) { return m.id_anggota === APP_CONFIG.ROOT_MEMBER_ID; });
    if (!hasRoot) {
      anggotaToAdd.push({
        id_anggota: APP_CONFIG.ROOT_MEMBER_ID,
        kode_silsilah: '0',
        kode_legacy: '0',
        gelar_depan: 'Haji',
        nama_lengkap: 'Mohammad Tohir',
        gelar_belakang: '',
        nama_panggilan: 'Mbah Tohir',
        jenis_kelamin: 'L',
        foto_drive_id: '',
        tempat_lahir: 'Banyumas',
        tanggal_lahir: '',
        presisi_tgl_lahir: 'TEMPAT_SAJA',
        status_keturunan: 'Leluhur',
        generasi_level: 0,
        generasi_label: 'Leluhur Utama',
        status_hidup: 'WAFAT',
        tanggal_wafat: '',
        tempat_wafat: '',
        catatan_wafat: '',
        provinsi_id: '', kabkota_id: '', kecamatan_id: '', kelurahan_id: '',
        nama_jalan: '', rt: '', rw: '', no_rumah: '', kode_pos: '',
        keterangan_alamat: 'Pangebatan, Karanglewas, Banyumas',
        no_hp: '', no_hp_alt: '', email: '',
        pendidikan_id: '', pekerjaan_id: '', pekerjaan_lainnya: '',
        is_kk: false,
        status_keanggotaan: 'AKTIF',
        tanggal_gabung: now.substring(0, 10),
        catatan: 'Leluhur Utama Bani Haji Mohammad Tohir',
        is_archived: false,
        needs_verification: false,
        created_at: now, created_by: actorName, updated_at: now, updated_by: actorName
      });
    }

    // Kelompokkan berdasarkan kode_silsilah untuk membangun PASANGAN & HUBUNGAN_ORANGTUA
    var byKode = {};
    readyRows.forEach(function (r) {
      var id = r.id_anggota_calon || generateUuid('BMT');
      if (existingKodeMap[r.generated_kode + '|' + r.nama_lengkap]) return;

      var obj = {
        id_anggota: id,
        kode_silsilah: r.generated_kode,
        kode_legacy: r.raw_kode,
        gelar_depan: r.gelar_depan,
        nama_lengkap: r.nama_lengkap,
        gelar_belakang: r.gelar_belakang,
        nama_panggilan: '',
        jenis_kelamin: '',
        foto_drive_id: '',
        tempat_lahir: r.tempat_lahir,
        tanggal_lahir: r.tanggal_lahir_iso,
        presisi_tgl_lahir: r.presisi_tgl_lahir,
        status_keturunan: r.status_keturunan,
        generasi_level: r.generasi_level,
        generasi_label: r.generasi_label,
        status_hidup: r.status_hidup,
        tanggal_wafat: r.tanggal_wafat_raw,
        tempat_wafat: '',
        catatan_wafat: '',
        provinsi_id: '', kabkota_id: '', kecamatan_id: '', kelurahan_id: '',
        nama_jalan: '', rt: '', rw: '', no_rumah: '', kode_pos: '',
        keterangan_alamat: r.alamat_raw,
        no_hp: r.no_hp,
        no_hp_alt: '',
        email: r.email,
        pendidikan_id: '',
        pekerjaan_id: '',
        pekerjaan_lainnya: r.pekerjaan_raw,
        is_kk: r.is_kk === true || String(r.is_kk).toUpperCase() === 'TRUE',
        status_keanggotaan: 'AKTIF',
        tanggal_gabung: now.substring(0, 10),
        catatan: r.iuran_nominal ? ('Target Iuran Awal (2026): ' + formatRupiah(r.iuran_nominal)) : '',
        is_archived: false,
        needs_verification: r.presisi_tgl_lahir === 'PERLU_EDIT' || !r.tanggal_lahir_iso,
        created_at: now, created_by: actorName, updated_at: now, updated_by: actorName
      };
      obj._target_iuran_awal = Number(r.iuran_nominal) || 0;
      anggotaToAdd.push(obj);
      byKode[r.generated_kode] = byKode[r.generated_kode] || [];
      byKode[r.generated_kode].push(obj);
    });

    var pasanganToAdd = [];
    var ortuToAdd = [];
    var rtToAdd = [];
    var anggotaRtToAdd = [];
    var tagihanToAdd = [];
    var primarySpousePairByKode = {};
    var rtIdByMemberId = {};

    Object.keys(byKode).forEach(function (kode) {
      var list = byKode[kode];
      var kandung = list.filter(function (x) { return x.status_keturunan !== 'Menantu'; })[0] || list[0];
      var menantuList = list.filter(function (x) { return x.id_anggota !== kandung.id_anggota; });

      menantuList.forEach(function (m, idx) {
        var pairId = generateUuid('PSG');
        pasanganToAdd.push({
          relasi_pasangan_id: pairId,
          id_anggota_1: kandung.id_anggota,
          id_anggota_2: m.id_anggota,
          urutan_pasangan: idx + 1,
          tanggal_menikah: '',
          tanggal_berakhir: '',
          status_hubungan: (kandung.status_hidup === 'WAFAT' || m.status_hidup === 'WAFAT') ? 'CERAI_MATI' : 'MENIKAH',
          keterangan: 'Migrasi otomatis dari kode ' + kode,
          status_aktif: true,
          created_at: now,
          created_by: actorName
        });
        if (idx === 0) primarySpousePairByKode[kode] = pairId;
      });
    });

    // Bangun relasi orang tua - anak berdasarkan kode induk (segmen minus 1)
    Object.keys(byKode).forEach(function (kode) {
      if (!kode) return;
      var list = byKode[kode];
      var rawKandung = list.filter(function (x) { return x.status_keturunan !== 'Menantu'; });
      var kandung = rawKandung.length > 0 ? rawKandung : list.slice(0, 1);
      var parts = kode.split('.');
      var parentKode = parts.length > 1 ? parts.slice(0, parts.length - 1).join('.') : '0';

      kandung.forEach(function (child) {
        if (parentKode === '0') {
          ortuToAdd.push({
            relasi_ortu_id: generateUuid('ORT'),
            id_anak: child.id_anggota,
            id_ayah: APP_CONFIG.ROOT_MEMBER_ID,
            id_ibu: '',
            id_pasangan_ortu: '',
            jenis_hubungan: 'KANDUNG',
            urutan_anak: parseInt(parts[0], 10) || 1,
            keterangan: 'Anak langsung Leluhur Utama',
            status_aktif: true,
            created_at: now,
            created_by: actorName
          });
        } else if (byKode[parentKode]) {
          var parentGroup = byKode[parentKode];
          var parentKandung = parentGroup.filter(function (x) { return x.status_keturunan !== 'Menantu'; })[0] || parentGroup[0];
          var parentSpouse = parentGroup.filter(function (x) { return x.id_anggota !== parentKandung.id_anggota; })[0];
          ortuToAdd.push({
            relasi_ortu_id: generateUuid('ORT'),
            id_anak: child.id_anggota,
            id_ayah: parentKandung.id_anggota,
            id_ibu: parentSpouse ? parentSpouse.id_anggota : '',
            id_pasangan_ortu: primarySpousePairByKode[parentKode] || '',
            jenis_hubungan: 'KANDUNG',
            urutan_anak: parseInt(parts[parts.length - 1], 10) || 1,
            keterangan: 'Relasi generasi dari kode ' + kode,
            status_aktif: true,
            created_at: now,
            created_by: actorName
          });
        }
      });

      // Rumah tangga dari anggota bertanda KK
      var kkMember = list.filter(function (x) { return x.is_kk; })[0];
      if (kkMember) {
        var rtId = generateUuid('RTG');
        rtToAdd.push({
          id_rumah_tangga: rtId,
          nama_rumah_tangga: 'Keluarga ' + kkMember.nama_lengkap,
          id_kepala_keluarga: kkMember.id_anggota,
          provinsi_id: '', kabkota_id: '', kecamatan_id: '', kelurahan_id: '',
          alamat_ringkas: kkMember.keterangan_alamat,
          no_kontak_rt: kkMember.no_hp,
          status_aktif: true,
          izinkan_kk_ganda: false,
          tanggal_bentuk: now.substring(0, 10),
          keterangan: 'Dibentuk saat migrasi awal dari tanda KK',
          created_at: now,
          updated_at: now
        });
        list.forEach(function (memberInHousehold) {
          rtIdByMemberId[memberInHousehold.id_anggota] = rtId;
          anggotaRtToAdd.push({
            id_anggota_rumah: generateUuid('ART'),
            id_rumah_tangga: rtId,
            id_anggota: memberInHousehold.id_anggota,
            peran_dalam_rt: memberInHousehold.id_anggota === kkMember.id_anggota ? 'KEPALA' : 'PASANGAN',
            tanggal_masuk: now.substring(0, 10),
            tanggal_keluar: '',
            status_aktif: true,
            created_at: now
          });
        });
      }
    });

    // Bangun TAGIHAN_IURAN dari kolom Target Iuran spreadsheet
    anggotaToAdd.forEach(function (m) {
      var targetNom = Number(m._target_iuran_awal) || 0;
      delete m._target_iuran_awal;
      if (targetNom > 0) {
        tagihanToAdd.push({
          tagihan_id: generateUuid('TGH'),
          tahun_iuran: 2026,
          id_rumah_tangga: rtIdByMemberId[m.id_anggota] || '',
          id_kk: m.id_anggota,
          nominal_tagihan: targetNom,
          diskon_pembebasan: 0,
          alasan_pembebasan: '',
          total_terbayar: 0,
          sisa_tagihan: targetNom,
          status_bayar: 'BELUM_LUNAS',
          jatuh_tempo: '2026-12-31',
          updated_at: now
        });
      }
    });

    appendObjectRows(SHEET_NAMES.ANGGOTA, anggotaToAdd);
    appendObjectRows(SHEET_NAMES.PASANGAN, pasanganToAdd);
    appendObjectRows(SHEET_NAMES.HUBUNGAN_ORANGTUA, ortuToAdd);
    appendObjectRows(SHEET_NAMES.RUMAH_TANGGA, rtToAdd);
    appendObjectRows(SHEET_NAMES.ANGGOTA_RUMAH, anggotaRtToAdd);
    appendObjectRows(SHEET_NAMES.TAGIHAN_IURAN, tagihanToAdd);

    writeAuditLog(
      actor,
      'COMMIT_MIGRASI',
      SHEET_NAMES.ANGGOTA,
      'BATCH_2026',
      null,
      { anggota: anggotaToAdd.length, pasangan: pasanganToAdd.length, ortu: ortuToAdd.length, rumahTangga: rtToAdd.length, targetIuran: tagihanToAdd.length },
      'BERHASIL',
      'Commit migrasi data Bani H. M. Tohir selesai'
    );

    return {
      ok: true,
      inserted: {
        anggota: anggotaToAdd.length,
        pasangan: pasanganToAdd.length,
        hubunganOrtu: ortuToAdd.length,
        rumahTangga: rtToAdd.length,
        targetIuran: tagihanToAdd.length
      }
    };
  });
}
