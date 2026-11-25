/**
 * Utilities.gs
 * Utilitas zona waktu Asia/Jakarta, ID generator, LockService, CacheService,
 * parser nama/tanggal lahir Indonesia, audit logging, dan penanganan error aman.
 */

function nowJakartaIso() {
  return Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss'+07:00'");
}

function nowJakartaDisplay() {
  return Utilities.formatDate(new Date(), APP_CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss') + ' WIB';
}

function formatDateJakarta(dateVal, pattern) {
  if (!dateVal) return '';
  var d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return Utilities.formatDate(d, APP_CONFIG.TIMEZONE, pattern || 'yyyy-MM-dd');
}

function generateUuid(prefix) {
  var raw = Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase();
  return (prefix ? prefix + '-' : '') + raw;
}

function generateMemberCodeId(seqNum) {
  var padded = String(seqNum);
  while (padded.length < 4) padded = '0' + padded;
  return 'BMT-' + padded;
}

function withScriptLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function getCacheChunked(key) {
  try {
    var cache = CacheService.getScriptCache();
    var metaRaw = cache.get(key + '_META');
    if (!metaRaw) {
      var single = cache.get(key);
      return single ? JSON.parse(single) : null;
    }
    var meta = JSON.parse(metaRaw);
    var parts = [];
    for (var i = 0; i < meta.chunks; i++) {
      var part = cache.get(key + '_P' + i);
      if (!part) return null;
      parts.push(part);
    }
    return JSON.parse(parts.join(''));
  } catch (e) {
    return null;
  }
}

function putCacheChunked(key, valueObj, ttlSeconds) {
  try {
    var cache = CacheService.getScriptCache();
    var json = JSON.stringify(valueObj);
    var ttl = ttlSeconds || 300;
    if (json.length <= 90000) {
      cache.put(key, json, ttl);
      return;
    }
    var chunkSize = 85000;
    var chunks = Math.ceil(json.length / chunkSize);
    var batch = {};
    batch[key + '_META'] = JSON.stringify({ chunks: chunks });
    for (var i = 0; i < chunks; i++) {
      batch[key + '_P' + i] = json.substring(i * chunkSize, (i + 1) * chunkSize);
    }
    cache.putAll(batch, ttl);
  } catch (e) {
    // Abaikan kegagalan cache agar tidak mengganggu alur utama
  }
}

function invalidateCacheKey(key) {
  try {
    var cache = CacheService.getScriptCache();
    var metaRaw = cache.get(key + '_META');
    cache.remove(key);
    if (metaRaw) {
      var meta = JSON.parse(metaRaw);
      var keys = [key + '_META'];
      for (var i = 0; i < meta.chunks; i++) keys.push(key + '_P' + i);
      cache.removeAll(keys);
    }
  } catch (e) {}
}

function sanitizeString(val) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/[\u0000-\u001F\u007F]/g, '').trim();
}

function parseRupiah(raw) {
  if (typeof raw === 'number') return raw;
  var s = sanitizeString(raw);
  if (!s || s === '-' || /Rp\s*-/i.test(s)) return 0;
  // Hapus ",00" di belakang sebelum strip karakter non-digit
  s = s.replace(/,\d{2}\s*$/, '').replace(/[^0-9]/g, '');
  var n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

function formatRupiah(num) {
  var n = Number(num) || 0;
  return 'Rp ' + n.toLocaleString('id-ID');
}

function normalizeLegacyCode(rawCode) {
  var clean = sanitizeString(rawCode)
    .replace(/\s+/g, '')
    .replace(/\.+$/, '')
    .replace(/^\.+/, '');
  return clean;
}

/**
 * Memisahkan gelar depan, nama inti, dan gelar belakang dari penulisan bebas.
 */
function splitNameAndTitles(fullNameRaw) {
  var raw = sanitizeString(fullNameRaw);
  if (!raw) {
    return { gelar_depan: '', nama_lengkap: '', gelar_belakang: '' };
  }

  var gelarDepanList = ['DR.', 'DRS.', 'DRA.', 'DRH.', 'IR.', 'PROF.', 'H.', 'HJ.', 'DR', 'MARSMA (PURN.)'];
  var frontTitles = [];
  var backTitles = [];

  // Pisahkan gelar belakang berdasarkan koma pertama yang diikuti pola gelar
  var commaIdx = raw.indexOf(',');
  var mainPart = raw;
  if (commaIdx > 0) {
    mainPart = raw.substring(0, commaIdx).trim();
    backTitles.push(raw.substring(commaIdx + 1).trim());
  }

  // Ekstrak gelar depan berturut-turut
  var changed = true;
  while (changed) {
    changed = false;
    var upper = mainPart.toUpperCase();
    for (var i = 0; i < gelarDepanList.length; i++) {
      var prefix = gelarDepanList[i];
      if (upper.indexOf(prefix + ' ') === 0 || (prefix === 'DR.' && upper.indexOf('DR.') === 0)) {
        var len = prefix.length;
        frontTitles.push(mainPart.substring(0, len).trim());
        mainPart = mainPart.substring(len).trim();
        changed = true;
        break;
      }
    }
  }

  return {
    gelar_depan: frontTitles.join(' '),
    nama_lengkap: mainPart || raw,
    gelar_belakang: backTitles.join(', ')
  };
}

/**
 * Parser tempat & tanggal lahir Indonesia yang toleran terhadap typo spreadsheet lama.
 * Tanggal yang cacat tidak memblokir migrasi, tetapi ditandai PERLU_EDIT agar bisa diperbarui via Menu Edit.
 */
function parseIndonesianBirthdate(ttlRaw) {
  var raw = sanitizeString(ttlRaw);
  if (!raw) {
    return { tempat_lahir: '', tanggal_lahir_iso: '', presisi: 'KOSONG', flag: '' };
  }

  var tempat = '';
  var datePart = raw;
  var commaIdx = raw.indexOf(',');
  if (commaIdx > -1) {
    tempat = raw.substring(0, commaIdx).trim();
    datePart = raw.substring(commaIdx + 1).trim();
  } else {
    var mSpace = raw.match(/^([A-Za-z.\s]+?)\s+(\d{1,2}\s+[A-Za-z]+\s+\d{2,4}|\d{4})$/);
    if (mSpace) {
      tempat = mSpace[1].trim();
      datePart = mSpace[2].trim();
    } else if (/^[A-Za-z.\s]+$/.test(raw)) {
      tempat = raw;
      datePart = '';
    }
  }

  // Perbaiki typo nama kota umum
  if (/^banumas$/i.test(tempat)) tempat = 'Banyumas';
  if (/^k\s+ediri$/i.test(tempat)) tempat = 'Kediri';

  if (!datePart) {
    return { tempat_lahir: tempat, tanggal_lahir_iso: '', presisi: 'TEMPAT_SAJA', flag: 'TGL_LAHIR_KOSONG' };
  }

  var monthMap = {
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
    desember: 12, des: 12
  };

  // Cek pola hanya tahun: "Th. 1953", "Tahun 1950", "1978"
  var yearOnly = datePart.match(/^(?:th\.?|tahun)?\s*(\d{4})$/i);
  if (yearOnly) {
    var yrOnly = parseInt(yearOnly[1], 10);
    if (yrOnly >= 1880 && yrOnly <= 2030) {
      return { tempat_lahir: tempat, tanggal_lahir_iso: yrOnly + '-01-01', presisi: 'TAHUN_SAJA', flag: 'HANYA_TAHUN_LAHIR' };
    }
  }

  // Cek pola dd-mm-yyyy atau dd/mm/yyyy
  var numericMatch = datePart.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{3,4})$/);
  if (numericMatch) {
    var dNum = parseInt(numericMatch[1], 10);
    var mNum = parseInt(numericMatch[2], 10);
    var yNum = parseInt(numericMatch[3], 10);
    if (yNum < 1850 || yNum > 2030 || mNum < 1 || mNum > 12 || dNum < 1 || dNum > 31) {
      return { tempat_lahir: tempat, tanggal_lahir_iso: '', presisi: 'PERLU_EDIT', flag: 'TGL_LAHIR_ANOMALI' };
    }
    return {
      tempat_lahir: tempat,
      tanggal_lahir_iso: yNum + '-' + ('0' + mNum).slice(-2) + '-' + ('0' + dNum).slice(-2),
      presisi: 'LENGKAP',
      flag: ''
    };
  }

  // Cek pola "12 Des 1934" atau "1 Maret1998"
  var textMatch = datePart.match(/^(\d{1,2})\s*([A-Za-z]+)\s*(\d{2,4})$/);
  if (textMatch) {
    var day = parseInt(textMatch[1], 10);
    var monWord = textMatch[2].toLowerCase();
    var yr = parseInt(textMatch[3], 10);
    var mon = monthMap[monWord];
    if (!mon || yr < 1850 || yr > 2030 || day < 1 || day > 31) {
      return { tempat_lahir: tempat, tanggal_lahir_iso: '', presisi: 'PERLU_EDIT', flag: 'TGL_LAHIR_ANOMALI' };
    }
    return {
      tempat_lahir: tempat,
      tanggal_lahir_iso: yr + '-' + ('0' + mon).slice(-2) + '-' + ('0' + day).slice(-2),
      presisi: 'LENGKAP',
      flag: ''
    };
  }

  return { tempat_lahir: tempat, tanggal_lahir_iso: '', presisi: 'PERLU_EDIT', flag: 'TGL_LAHIR_ANOMALI' };
}

function writeAuditLog(actor, aksi, entitas, recordId, oldVal, newVal, statusHasil, catatan) {
  try {
    var u = actor || { user_id: 'SYSTEM', username_login: 'SYSTEM', role_id: 'SYSTEM' };
    var row = {
      log_id: generateUuid('LOG'),
      timestamp: nowJakartaIso(),
      user_id: u.user_id || 'SYSTEM',
      username: u.username_login || 'SYSTEM',
      role: u.role_id || 'SYSTEM',
      aksi: aksi,
      entitas: entitas,
      record_id: recordId || '',
      nilai_lama_json: oldVal ? JSON.stringify(oldVal).substring(0, 4000) : '',
      nilai_baru_json: newVal ? JSON.stringify(newVal).substring(0, 4000) : '',
      status_hasil: statusHasil || 'BERHASIL',
      catatan: catatan || ''
    };
    appendObjectRows(SHEET_NAMES.AUDIT_LOG, [row]);
  } catch (e) {
    // Jangan menghentikan proses utama jika logging gagal
  }
}

function buildErrorResponse(err, isAdmin) {
  var msg = err && err.message ? String(err.message) : 'Terjadi kesalahan pada server.';
  if (!isAdmin && /Sheet|TypeError|ReferenceError|Range/i.test(msg)) {
    msg = 'Terjadi gangguan pemrosesan data. Silakan hubungi Admin Paguyuban.';
  }
  return { ok: false, message: msg };
}
