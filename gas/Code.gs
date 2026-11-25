/**
 * Code.gs
 * Entry point Web App Google Apps Script (doGet) dan seluruh endpoint RPC frontend-backend.
 * Semua endpoint terproteksi verifikasi sesi server-side.
 */

function doGet() {
  var template = HtmlService.createTemplateFromFile('Index');
  template.appName = APP_CONFIG.APP_NAME;
  template.tagline = APP_CONFIG.TAGLINE;
  template.version = APP_CONFIG.VERSION;
  return template.evaluate()
    .setTitle(APP_CONFIG.APP_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function apiGetBootstrapState() {
  try {
    return {
      ok: true,
      needsSetup: isBootstrapRequired(),
      appName: APP_CONFIG.APP_NAME,
      tagline: APP_CONFIG.TAGLINE,
      timezone: APP_CONFIG.TIMEZONE,
      nowDisplay: nowJakartaDisplay()
    };
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiSetupFirstAdmin(payload) {
  try {
    return setupInitialSuperAdmin(payload.username, payload.nama_tampilan, payload.password);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiLogin(payload) {
  try {
    return loginUser(payload.username, payload.password);
  } catch (err) {
    return buildErrorResponse(err, false);
  }
}

function apiLogout(sessionToken) {
  try {
    return logoutUser(sessionToken);
  } catch (err) {
    return buildErrorResponse(err, false);
  }
}

function apiInitializeDatabase(sessionToken) {
  try {
    var actor = requireAuth(sessionToken, 'PENGATURAN', 'create');
    return initializeDatabase(actor);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiGetDashboardStats(sessionToken) {
  try {
    var actor = requireAuth(sessionToken, 'DASHBOARD', 'view');
    var anggota = readSheetObjects(SHEET_NAMES.ANGGOTA, true);
    var rumahTangga = readSheetObjects(SHEET_NAMES.RUMAH_TANGGA, true);
    var staging = readSheetObjects(SHEET_NAMES.MIGRASI_STAGING, false);

    // Jika tabel ANGGOTA belum dicommit, tampilkan preview statistik dari staging
    var activeSource = anggota.filter(function (a) { return a.id_anggota !== APP_CONFIG.ROOT_MEMBER_ID; });
    var isFromStaging = false;
    if (activeSource.length === 0 && staging.length > 0) {
      activeSource = staging.filter(function (s) { return s.action_status === 'SIAP' && s.nama_lengkap; });
      isFromStaging = true;
    }

    var stats = {
      totalAnggota: activeSource.length,
      kandung: 0,
      menantu: 0,
      hidup: 0,
      wafat: 0,
      belumJelasHidup: 0,
      kepalaKeluarga: rumahTangga.length,
      perluLengkapiData: 0,
      perGenerasi: {},
      perCabang: {},
      isFromStaging: isFromStaging,
      serverTime: nowJakartaDisplay()
    };

    activeSource.forEach(function (a) {
      if (a.status_keturunan === 'Menantu') stats.menantu++;
      else stats.kandung++;

      if (a.status_hidup === 'WAFAT') stats.wafat++;
      else if (a.status_hidup === 'HIDUP') stats.hidup++;
      else stats.belumJelasHidup++;

      var needsEdit = isFromStaging
        ? (a.presisi_tgl_lahir === 'PERLU_EDIT' || !a.tanggal_lahir_iso)
        : (a.needs_verification === true || String(a.needs_verification).toUpperCase() === 'TRUE');
      if (needsEdit) stats.perluLengkapiData++;

      var gen = a.generasi_label || 'Lainnya';
      stats.perGenerasi[gen] = (stats.perGenerasi[gen] || 0) + 1;

      var kode = isFromStaging ? a.generated_kode : a.kode_silsilah;
      if (kode) {
        var cabang = 'Cabang ' + String(kode).split('.')[0];
        stats.perCabang[cabang] = (stats.perCabang[cabang] || 0) + 1;
      }

      if (isFromStaging && (a.is_kk === true || String(a.is_kk).toUpperCase() === 'TRUE')) {
        stats.kepalaKeluarga++;
      }
    });

    var tagihanRows = readSheetObjects(SHEET_NAMES.TAGIHAN_IURAN, true);
    var targetIuranSum = 0;
    var terbayarSum = 0;
    if (tagihanRows.length > 0) {
      tagihanRows.forEach(function (t) {
        targetIuranSum += Number(t.nominal_tagihan) || 0;
        terbayarSum += Number(t.total_terbayar) || 0;
      });
    } else {
      activeSource.forEach(function (a) {
        targetIuranSum += Number(a.iuran_nominal) || 0;
      });
    }
    stats.totalIuran = targetIuranSum;
    stats.targetIuran = targetIuranSum;
    stats.totalIuranTerbayar = terbayarSum;

    return { ok: true, stats: stats, actor: actor };
  } catch (err) {
    return buildErrorResponse(err, false);
  }
}

function apiArchiveSourceSheet(sessionToken, sourceSheetName) {
  try {
    return archiveSourceSheetToRaw(sessionToken, sourceSheetName);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiRunMigrationDryRun(sessionToken, options) {
  try {
    return runMigrationDryRun(sessionToken, options);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiGetStagingRows(sessionToken, filterMode, searchQuery, page, pageSize) {
  try {
    return getStagingSummaryAndRows(sessionToken, filterMode, searchQuery, page, pageSize);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiUpdateStagingRow(sessionToken, stagingId, patch) {
  try {
    return updateStagingRowOptions(sessionToken, stagingId, patch);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiCommitMigration(sessionToken) {
  try {
    return commitMigrationToProduction(sessionToken);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiListMembersPreview(sessionToken, searchQuery, filterNeedEdit, page, pageSize) {
  try {
    var actor = requireAuth(sessionToken, 'ANGGOTA', 'view');
    var perms = getPermissionsForRole_(actor.role_id);
    var canSeeSensitive = perms.ANGGOTA && perms.ANGGOTA.view_sensitive_contact;

    var rows = readSheetObjects(SHEET_NAMES.ANGGOTA, true);
    var q = sanitizeString(searchQuery).toLowerCase();
    if (q) {
      rows = rows.filter(function (r) {
        return String(r.nama_lengkap + ' ' + r.kode_silsilah + ' ' + r.tempat_lahir).toLowerCase().indexOf(q) > -1;
      });
    }
    if (filterNeedEdit) {
      rows = rows.filter(function (r) {
        return r.presisi_tgl_lahir === 'PERLU_EDIT' || !r.tanggal_lahir;
      });
    }

    var pg = Math.max(parseInt(page, 10) || 1, 1);
    var sz = Math.min(Math.max(parseInt(pageSize, 10) || 25, 5), 100);
    var slice = rows.slice((pg - 1) * sz, pg * sz).map(function (m) {
      return {
        id_anggota: m.id_anggota,
        kode_silsilah: m.kode_silsilah,
        gelar_depan: m.gelar_depan,
        nama_lengkap: m.nama_lengkap,
        gelar_belakang: m.gelar_belakang,
        status_keturunan: m.status_keturunan,
        generasi_label: m.generasi_label,
        tempat_lahir: m.tempat_lahir,
        tanggal_lahir: m.tanggal_lahir,
        presisi_tgl_lahir: m.presisi_tgl_lahir,
        status_hidup: m.status_hidup,
        is_kk: m.is_kk,
        no_hp: canSeeSensitive ? m.no_hp : (m.no_hp ? '•••• (Terbatas)' : ''),
        email: canSeeSensitive ? m.email : '',
        keterangan_alamat: canSeeSensitive ? m.keterangan_alamat : ''
      };
    });

    return { ok: true, total: rows.length, page: pg, pageSize: sz, rows: slice };
  } catch (err) {
    return buildErrorResponse(err, false);
  }
}

function apiUpdateMemberBirthdate(sessionToken, idAnggota, tempatLahir, tanggalLahirIso, presisi) {
  try {
    return updateMemberBirthdate(sessionToken, idAnggota, tempatLahir, tanggalLahirIso, presisi);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiListUsers(sessionToken) {
  try {
    return { ok: true, users: listUsersSafe(sessionToken), permissions: listRolePermissions(sessionToken) };
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiCreateUser(sessionToken, payload) {
  try {
    return createUserAccount(sessionToken, payload);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiUpdateUserRoleStatus(sessionToken, targetUserId, roleId, statusAkun) {
  try {
    return updateUserRoleOrStatus(sessionToken, targetUserId, roleId, statusAkun);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiResetUserPassword(sessionToken, targetUserId, tempPassword) {
  try {
    return resetPasswordByAdmin(sessionToken, targetUserId, tempPassword);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiChangeOwnPassword(sessionToken, oldPassword, newPassword) {
  try {
    return changeOwnPassword(sessionToken, oldPassword, newPassword);
  } catch (err) {
    return buildErrorResponse(err, false);
  }
}

function apiGetAuditLogs(sessionToken, limit, search) {
  try {
    return { ok: true, logs: getAuditLogs(sessionToken, limit, search) };
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiBackupDatabase(sessionToken) {
  try {
    var actor = requireAuth(sessionToken, 'PENGATURAN', 'export');
    return backupSpreadsheetToDrive(actor);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

/* ==================== TAHAP 3: MASTER DATA, ANGGOTA LENGKAP, SILSILAH & RUMAH TANGGA ==================== */

function apiGetMasterBundles(sessionToken) {
  try {
    return getAllMasterBundles(sessionToken);
  } catch (err) {
    return buildErrorResponse(err, false);
  }
}

function apiGetWilayahChildren(sessionToken, tingkat, kodeInduk) {
  try {
    return getWilayahChildren(sessionToken, tingkat, kodeInduk);
  } catch (err) {
    return buildErrorResponse(err, false);
  }
}

function apiSaveMasterItem(sessionToken, masterType, item) {
  try {
    return saveMasterItem(sessionToken, masterType, item);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiListMembersFull(sessionToken, filters) {
  try {
    return listMembersFull(sessionToken, filters);
  } catch (err) {
    return buildErrorResponse(err, false);
  }
}

function apiGetMemberDetail(sessionToken, idAnggota) {
  try {
    return getMemberDetail(sessionToken, idAnggota);
  } catch (err) {
    return buildErrorResponse(err, false);
  }
}

function apiSaveMemberFull(sessionToken, payload) {
  try {
    return saveMemberFull(sessionToken, payload);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiSetMemberArchiveStatus(sessionToken, idAnggota, isArchived) {
  try {
    return setMemberArchiveStatus(sessionToken, idAnggota, isArchived);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiGetFamilyTreeGraph(sessionToken) {
  try {
    return getFamilyTreeGraph(sessionToken);
  } catch (err) {
    return buildErrorResponse(err, false);
  }
}

function apiSaveSpouseRelation(sessionToken, payload) {
  try {
    return saveSpouseRelation(sessionToken, payload);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiSaveParentChildRelation(sessionToken, payload) {
  try {
    return saveParentChildRelation(sessionToken, payload);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiFindRelationshipBetween(sessionToken, idA, idB) {
  try {
    return findRelationshipBetween(sessionToken, idA, idB);
  } catch (err) {
    return buildErrorResponse(err, false);
  }
}

function apiListHouseholds(sessionToken, searchQuery) {
  try {
    return listHouseholdsWithSummary(sessionToken, searchQuery);
  } catch (err) {
    return buildErrorResponse(err, false);
  }
}

function apiCreateHousehold(sessionToken, payload) {
  try {
    return createHousehold(sessionToken, payload);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiChangeHouseholdHead(sessionToken, idRumahTangga, idKkBaru, alasan) {
  try {
    return changeHouseholdHead(sessionToken, idRumahTangga, idKkBaru, alasan);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiAssignMemberToHousehold(sessionToken, idRumahTangga, idAnggota, peranDalamRt) {
  try {
    return assignMemberToHousehold(sessionToken, idRumahTangga, idAnggota, peranDalamRt);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

/* ==================== TAHAP 4: KEUANGAN, IURAN, ORGANISASI & DOKUMEN ==================== */

function apiGetFinanceOverview(sessionToken, tahunFilter) {
  try {
    return getFinanceOverview(sessionToken, tahunFilter);
  } catch (err) {
    return buildErrorResponse(err, false);
  }
}

function apiSaveCoaAccount(sessionToken, payload) {
  try {
    return saveCoaAccount(sessionToken, payload);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiCreateTransaction(sessionToken, payload) {
  try {
    return createFinanceTransaction(sessionToken, payload);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiVerifyTransaction(sessionToken, transaksiId, statusVerifikasi, isPublished) {
  try {
    return verifyFinanceTransaction(sessionToken, transaksiId, statusVerifikasi, isPublished);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiReverseTransaction(sessionToken, refTransaksiId, alasan) {
  try {
    return reverseFinanceTransaction(sessionToken, refTransaksiId, alasan);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiSaveIuranTarif(sessionToken, payload) {
  try {
    return saveIuranTarif(sessionToken, payload);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiGenerateIuranBills(sessionToken, tahunIuran, nominalStandar, jatuhTempo) {
  try {
    return generateAnnualIuranBills(sessionToken, tahunIuran, nominalStandar, jatuhTempo);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiUpdateIuranBillTarget(sessionToken, tagihanId, nominalTagihan, diskonPembebasan, alasanPembebasan) {
  try {
    return updateIuranBillTarget(sessionToken, tagihanId, nominalTagihan, diskonPembebasan, alasanPembebasan);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiRecordIuranPayment(sessionToken, payload) {
  try {
    return recordIuranPayment(sessionToken, payload);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiSaveAnggaran(sessionToken, payload) {
  try {
    return saveAnggaran(sessionToken, payload);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiGetOrganizationBundle(sessionToken) {
  try {
    return getOrganizationBundle(sessionToken);
  } catch (err) {
    return buildErrorResponse(err, false);
  }
}

function apiSaveAnnouncement(sessionToken, payload) {
  try {
    return saveAnnouncement(sessionToken, payload);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiSaveBoardMember(sessionToken, payload) {
  try {
    return saveBoardMember(sessionToken, payload);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiSaveActivity(sessionToken, payload) {
  try {
    return saveActivity(sessionToken, payload);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiSaveOfficialLetter(sessionToken, payload) {
  try {
    return saveOfficialLetter(sessionToken, payload);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiSaveInvitation(sessionToken, payload) {
  try {
    return saveInvitation(sessionToken, payload);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiSaveInvitationRsvp(sessionToken, undanganId, statusHadir) {
  try {
    return saveInvitationRsvp(sessionToken, undanganId, statusHadir);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}

function apiSaveArchiveDocument(sessionToken, payload) {
  try {
    return saveArchiveDocument(sessionToken, payload);
  } catch (err) {
    return buildErrorResponse(err, true);
  }
}


