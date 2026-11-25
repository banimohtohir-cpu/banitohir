/**
 * Database.gs
 * Pengelola akses Google Spreadsheet, inisialisasi non-destruktif 30+ sheet,
 * operasi batch read/write, dan backup Spreadsheet ke Google Drive.
 */

function getDb() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var savedId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (savedId) {
      ss = SpreadsheetApp.openById(savedId);
    }
  }
  if (!ss) {
    throw new Error('Spreadsheet database tidak ditemukan. Jalankan dari Google Spreadsheet terikat atau atur SPREADSHEET_ID.');
  }
  return ss;
}

/**
 * Menginisialisasi seluruh sheet dalam SHEET_SCHEMAS secara aman dan non-destruktif.
 * Tidak pernah menghapus atau menimpa data pada sheet yang sudah berisi data.
 */
function initializeDatabase(actorUser) {
  return withScriptLock(function () {
    var ss = getDb();
    var createdSheets = [];
    var existingSheets = [];
    var now = nowJakartaIso();
    var actorName = actorUser ? actorUser.username_login : 'SYSTEM_INIT';

    Object.keys(SHEET_SCHEMAS).forEach(function (sheetName) {
      var headers = SHEET_SCHEMAS[sheetName];
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.setFrozenRows(1);
        sheet.getRange(1, 1, 1, headers.length)
          .setBackground('#166534')
          .setFontColor('#FFFFFF')
          .setFontWeight('bold');
        createdSheets.push(sheetName);
      } else {
        existingSheets.push(sheetName);
        // Jika sheet benar-benar kosong (lastRow === 0), tulis header
        if (sheet.getLastRow() === 0) {
          sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
          sheet.setFrozenRows(1);
        }
      }
    });

    // Isi data master awal HANYA jika sheet terkait masih hanya memiliki baris header
    seedIfEmpty_(ss, SHEET_NAMES.CONFIG, SEED_CONFIG.map(function (c) {
      return Object.assign({}, c, { updated_at: now, updated_by: actorName });
    }));
    seedIfEmpty_(ss, SHEET_NAMES.ROLES_PERMISSIONS, SEED_ROLES_PERMISSIONS);
    seedIfEmpty_(ss, SHEET_NAMES.MASTER_GENERASI, SEED_GENERASI);
    seedIfEmpty_(ss, SHEET_NAMES.MASTER_PENDIDIKAN, SEED_PENDIDIKAN);
    seedIfEmpty_(ss, SHEET_NAMES.MASTER_PEKERJAAN, SEED_PEKERJAAN);
    seedIfEmpty_(ss, SHEET_NAMES.JABATAN, SEED_JABATAN);
    seedIfEmpty_(ss, SHEET_NAMES.COA, SEED_COA);

    invalidateCacheKey('SHEET_' + SHEET_NAMES.CONFIG);
    invalidateCacheKey('SHEET_' + SHEET_NAMES.ROLES_PERMISSIONS);

    writeAuditLog(
      actorUser,
      'INIT_DATABASE',
      'SYSTEM',
      'ALL_SHEETS',
      null,
      { createdSheets: createdSheets, existingCount: existingSheets.length },
      'BERHASIL',
      'Inisialisasi skema database non-destruktif selesai'
    );

    return {
      ok: true,
      createdSheets: createdSheets,
      existingCount: existingSheets.length,
      totalSchemas: Object.keys(SHEET_SCHEMAS).length
    };
  });
}

function seedIfEmpty_(ss, sheetName, objects) {
  if (!objects || objects.length === 0) return;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() > 1) return;
  var headers = SHEET_SCHEMAS[sheetName];
  var matrix = objects.map(function (obj) {
    return headers.map(function (h) {
      return obj[h] !== undefined ? obj[h] : '';
    });
  });
  sheet.getRange(2, 1, matrix.length, headers.length).setValues(matrix);
}

function readSheetObjects(sheetName, useCache) {
  var cacheKey = 'SHEET_' + sheetName;
  if (useCache) {
    var cached = getCacheChunked(cacheKey);
    if (cached) return cached;
  }

  var ss = getDb();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = data[0].map(function (h) { return String(h).trim(); });

  var result = [];
  for (var r = 1; r < data.length; r++) {
    var rowArr = data[r];
    var hasValue = false;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      var val = rowArr[c];
      if (val instanceof Date) {
        val = formatDateJakarta(val, 'yyyy-MM-dd');
      }
      if (val !== '' && val !== null && val !== undefined) hasValue = true;
      obj[headers[c]] = val;
    }
    if (hasValue) {
      obj._rowIndex = r + 1;
      result.push(obj);
    }
  }

  if (useCache) {
    putCacheChunked(cacheKey, result, 180);
  }
  return result;
}

function appendObjectRows(sheetName, objects) {
  if (!objects || objects.length === 0) return 0;
  var ss = getDb();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet ' + sheetName + ' belum diinisialisasi.');

  var headers = SHEET_SCHEMAS[sheetName] || sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var matrix = objects.map(function (obj) {
    return headers.map(function (h) {
      return obj[h] !== undefined && obj[h] !== null ? obj[h] : '';
    });
  });

  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, matrix.length, headers.length).setValues(matrix);
  invalidateCacheKey('SHEET_' + sheetName);
  return matrix.length;
}

function overwriteSheetObjects(sheetName, objects) {
  var ss = getDb();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet ' + sheetName + ' belum diinisialisasi.');

  var headers = SHEET_SCHEMAS[sheetName];
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(sheet.getLastColumn(), headers.length)).clearContent();
  }
  if (objects && objects.length > 0) {
    var matrix = objects.map(function (obj) {
      return headers.map(function (h) {
        return obj[h] !== undefined && obj[h] !== null ? obj[h] : '';
      });
    });
    sheet.getRange(2, 1, matrix.length, headers.length).setValues(matrix);
  }
  invalidateCacheKey('SHEET_' + sheetName);
}

function updateRowByPrimaryKey(sheetName, pkName, pkVal, patch) {
  var ss = getDb();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return false;

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = data[0].map(function (h) { return String(h).trim(); });
  var pkIdx = headers.indexOf(pkName);
  if (pkIdx === -1) throw new Error('Kolom kunci ' + pkName + ' tidak ditemukan pada ' + sheetName);

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][pkIdx]) === String(pkVal)) {
      var updatedRow = data[r].slice();
      Object.keys(patch).forEach(function (k) {
        var cIdx = headers.indexOf(k);
        if (cIdx > -1) updatedRow[cIdx] = patch[k];
      });
      sheet.getRange(r + 1, 1, 1, headers.length).setValues([updatedRow]);
      invalidateCacheKey('SHEET_' + sheetName);
      return true;
    }
  }
  return false;
}

function backupSpreadsheetToDrive(actorUser) {
  var ss = getDb();
  var folders = DriveApp.getFoldersByName(APP_CONFIG.BACKUP_FOLDER_NAME);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(APP_CONFIG.BACKUP_FOLDER_NAME);
  var stamp = Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, 'yyyyMMdd_HHmmss');
  var copyName = 'BACKUP_BANI_TOHIR_' + stamp;
  var sourceFile = DriveApp.getFileById(ss.getId());
  var copied = sourceFile.makeCopy(copyName, folder);

  writeAuditLog(
    actorUser,
    'BACKUP_DATABASE',
    'SPREADSHEET',
    copied.getId(),
    null,
    { nama_file: copyName, url: copied.getUrl() },
    'BERHASIL',
    'Backup database Spreadsheet ke Google Drive berhasil'
  );

  return {
    ok: true,
    fileId: copied.getId(),
    fileName: copyName,
    url: copied.getUrl(),
    createdAt: nowJakartaDisplay()
  };
}
