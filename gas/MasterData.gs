/**
 * MasterData.gs
 * Pengelolaan Master Data dinamis: MASTER_WILAYAH (dengan cache lokal & sync opsional),
 * MASTER_PENDIDIKAN, MASTER_PEKERJAAN, dan MASTER_GENERASI.
 */

var SEED_WILAYAH_INDONESIA = [
  // Provinsi inti & sebaran keluarga Bani H. M. Tohir
  { kode_wilayah: '33', tingkat: 'PROV', kode_induk: '', nama_wilayah: 'Jawa Tengah', kode_pos_default: '', sumber: 'SEED_RESMI' },
  { kode_wilayah: '31', tingkat: 'PROV', kode_induk: '', nama_wilayah: 'DKI Jakarta', kode_pos_default: '', sumber: 'SEED_RESMI' },
  { kode_wilayah: '32', tingkat: 'PROV', kode_induk: '', nama_wilayah: 'Jawa Barat', kode_pos_default: '', sumber: 'SEED_RESMI' },
  { kode_wilayah: '35', tingkat: 'PROV', kode_induk: '', nama_wilayah: 'Jawa Timur', kode_pos_default: '', sumber: 'SEED_RESMI' },
  { kode_wilayah: '36', tingkat: 'PROV', kode_induk: '', nama_wilayah: 'Banten', kode_pos_default: '', sumber: 'SEED_RESMI' },
  { kode_wilayah: '34', tingkat: 'PROV', kode_induk: '', nama_wilayah: 'DI Yogyakarta', kode_pos_default: '', sumber: 'SEED_RESMI' },
  { kode_wilayah: '18', tingkat: 'PROV', kode_induk: '', nama_wilayah: 'Lampung', kode_pos_default: '', sumber: 'SEED_RESMI' },
  // Kab/Kota
  { kode_wilayah: '3302', tingkat: 'KAB', kode_induk: '33', nama_wilayah: 'Kabupaten Banyumas', kode_pos_default: '53100', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3301', tingkat: 'KAB', kode_induk: '33', nama_wilayah: 'Kabupaten Cilacap', kode_pos_default: '53200', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3303', tingkat: 'KAB', kode_induk: '33', nama_wilayah: 'Kabupaten Purbalingga', kode_pos_default: '53300', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3374', tingkat: 'KAB', kode_induk: '33', nama_wilayah: 'Kota Semarang', kode_pos_default: '50100', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3376', tingkat: 'KAB', kode_induk: '33', nama_wilayah: 'Kota Tegal', kode_pos_default: '52100', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3175', tingkat: 'KAB', kode_induk: '31', nama_wilayah: 'Kota Jakarta Timur', kode_pos_default: '13410', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3273', tingkat: 'KAB', kode_induk: '32', nama_wilayah: 'Kota Bandung', kode_pos_default: '40100', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3275', tingkat: 'KAB', kode_induk: '32', nama_wilayah: 'Kota Bekasi', kode_pos_default: '17100', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3201', tingkat: 'KAB', kode_induk: '32', nama_wilayah: 'Kabupaten Bogor', kode_pos_default: '16910', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3515', tingkat: 'KAB', kode_induk: '35', nama_wilayah: 'Kabupaten Sidoarjo', kode_pos_default: '61200', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3603', tingkat: 'KAB', kode_induk: '36', nama_wilayah: 'Kabupaten Tangerang', kode_pos_default: '15340', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3674', tingkat: 'KAB', kode_induk: '36', nama_wilayah: 'Kota Tangerang Selatan', kode_pos_default: '15410', sumber: 'SEED_RESMI' },
  // Kecamatan di Banyumas & sekitarnya
  { kode_wilayah: '330221', tingkat: 'KEC', kode_induk: '3302', nama_wilayah: 'Karanglewas', kode_pos_default: '53161', sumber: 'SEED_RESMI' },
  { kode_wilayah: '330224', tingkat: 'KEC', kode_induk: '3302', nama_wilayah: 'Purwokerto Barat', kode_pos_default: '53131', sumber: 'SEED_RESMI' },
  { kode_wilayah: '330225', tingkat: 'KEC', kode_induk: '3302', nama_wilayah: 'Purwokerto Timur', kode_pos_default: '53111', sumber: 'SEED_RESMI' },
  { kode_wilayah: '330222', tingkat: 'KEC', kode_induk: '3302', nama_wilayah: 'Purwokerto Selatan', kode_pos_default: '53141', sumber: 'SEED_RESMI' },
  { kode_wilayah: '330218', tingkat: 'KEC', kode_induk: '3302', nama_wilayah: 'Sokaraja', kode_pos_default: '53181', sumber: 'SEED_RESMI' },
  { kode_wilayah: '330220', tingkat: 'KEC', kode_induk: '3302', nama_wilayah: 'Kedungbanteng', kode_pos_default: '53152', sumber: 'SEED_RESMI' },
  { kode_wilayah: '330114', tingkat: 'KEC', kode_induk: '3301', nama_wilayah: 'Maos', kode_pos_default: '53272', sumber: 'SEED_RESMI' },
  { kode_wilayah: '360322', tingkat: 'KEC', kode_induk: '3603', nama_wilayah: 'Cisauk', kode_pos_default: '15341', sumber: 'SEED_RESMI' },
  { kode_wilayah: '367406', tingkat: 'KEC', kode_induk: '3674', nama_wilayah: 'Pamulang', kode_pos_default: '15416', sumber: 'SEED_RESMI' },
  { kode_wilayah: '351517', tingkat: 'KEC', kode_induk: '3515', nama_wilayah: 'Waru', kode_pos_default: '61256', sumber: 'SEED_RESMI' },
  // Desa/Kelurahan kunci
  { kode_wilayah: '3302212001', tingkat: 'DESA', kode_induk: '330221', nama_wilayah: 'Pangebatan', kode_pos_default: '53161', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3302212002', tingkat: 'DESA', kode_induk: '330221', nama_wilayah: 'Kediri', kode_pos_default: '53161', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3302212003', tingkat: 'DESA', kode_induk: '330221', nama_wilayah: 'Karanglewas Kidul', kode_pos_default: '53161', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3302241001', tingkat: 'DESA', kode_induk: '330224', nama_wilayah: 'Kedungwuluh', kode_pos_default: '53131', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3302241002', tingkat: 'DESA', kode_induk: '330224', nama_wilayah: 'Bantarsoka', kode_pos_default: '53133', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3302241003', tingkat: 'DESA', kode_induk: '330224', nama_wilayah: 'Kober', kode_pos_default: '53132', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3302251001', tingkat: 'DESA', kode_induk: '330225', nama_wilayah: 'Berkoh', kode_pos_default: '53146', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3302221001', tingkat: 'DESA', kode_induk: '330222', nama_wilayah: 'Karangpucung', kode_pos_default: '53142', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3302182001', tingkat: 'DESA', kode_induk: '330218', nama_wilayah: 'Kalikidang', kode_pos_default: '53181', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3302202001', tingkat: 'DESA', kode_induk: '330220', nama_wilayah: 'Dawuhan Kulon', kode_pos_default: '53152', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3301142001', tingkat: 'DESA', kode_induk: '330114', nama_wilayah: 'Maos Lor', kode_pos_default: '53272', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3603222001', tingkat: 'DESA', kode_induk: '360322', nama_wilayah: 'Suradita', kode_pos_default: '15343', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3674061001', tingkat: 'DESA', kode_induk: '367406', nama_wilayah: 'Benda Baru', kode_pos_default: '15416', sumber: 'SEED_RESMI' },
  { kode_wilayah: '3515172001', tingkat: 'DESA', kode_induk: '351517', nama_wilayah: 'Wedoro', kode_pos_default: '61256', sumber: 'SEED_RESMI' }
];

function ensureWilayahSeeded_() {
  var rows = readSheetObjects(SHEET_NAMES.MASTER_WILAYAH, true);
  if (rows.length > 0) return rows;
  var now = nowJakartaIso();
  var seeded = SEED_WILAYAH_INDONESIA.map(function (w) {
    return Object.assign({}, w, { last_synced: now });
  });
  appendObjectRows(SHEET_NAMES.MASTER_WILAYAH, seeded);
  return readSheetObjects(SHEET_NAMES.MASTER_WILAYAH, false);
}

function getAllMasterBundles(sessionToken) {
  requireAuth(sessionToken, 'ANGGOTA', 'view');
  ensureWilayahSeeded_();
  return {
    ok: true,
    generasi: readSheetObjects(SHEET_NAMES.MASTER_GENERASI, true),
    pendidikan: readSheetObjects(SHEET_NAMES.MASTER_PENDIDIKAN, true),
    pekerjaan: readSheetObjects(SHEET_NAMES.MASTER_PEKERJAAN, true),
    wilayah: readSheetObjects(SHEET_NAMES.MASTER_WILAYAH, true)
  };
}

function getWilayahChildren(sessionToken, tingkat, kodeInduk) {
  requireAuth(sessionToken, 'ANGGOTA', 'view');
  var all = ensureWilayahSeeded_();
  var filtered = all.filter(function (w) {
    return w.tingkat === tingkat && (!kodeInduk || String(w.kode_induk) === String(kodeInduk));
  });

  // Jika cache lokal kosong untuk tingkat tertentu & kodeInduk valid, coba fetch dari API publik wilayah Indonesia lalu cache ke spreadsheet
  if (filtered.length === 0 && kodeInduk) {
    try {
      var endpoint = '';
      if (tingkat === 'KAB') endpoint = 'https://emsifa.github.io/api-wilayah-indonesia/api/regencies/' + encodeURIComponent(kodeInduk) + '.json';
      if (tingkat === 'KEC') endpoint = 'https://emsifa.github.io/api-wilayah-indonesia/api/districts/' + encodeURIComponent(kodeInduk) + '.json';
      if (tingkat === 'DESA') endpoint = 'https://emsifa.github.io/api-wilayah-indonesia/api/villages/' + encodeURIComponent(kodeInduk) + '.json';
      if (endpoint) {
        var resp = UrlFetchApp.fetch(endpoint, { muteHttpExceptions: true });
        if (resp.getResponseCode() === 200) {
          var list = JSON.parse(resp.getContentText());
          var now = nowJakartaIso();
          var toInsert = list.map(function (item) {
            return {
              kode_wilayah: String(item.id),
              tingkat: tingkat,
              kode_induk: String(kodeInduk),
              nama_wilayah: String(item.name),
              kode_pos_default: '',
              sumber: 'API_EMSIFA_CACHED',
              last_synced: now
            };
          });
          if (toInsert.length > 0) {
            appendObjectRows(SHEET_NAMES.MASTER_WILAYAH, toInsert);
            filtered = toInsert;
          }
        }
      }
    } catch (e) {
      // Tetap kembalikan cache lokal jika offline
    }
  }

  return { ok: true, items: filtered };
}

function saveMasterItem(sessionToken, masterType, item) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'PENGATURAN', 'edit');
    var sheetMap = {
      PENDIDIKAN: { sheet: SHEET_NAMES.MASTER_PENDIDIKAN, pk: 'pendidikan_id', prefix: 'PDD' },
      PEKERJAAN: { sheet: SHEET_NAMES.MASTER_PEKERJAAN, pk: 'pekerjaan_id', prefix: 'PKJ' },
      GENERASI: { sheet: SHEET_NAMES.MASTER_GENERASI, pk: 'generasi_id', prefix: 'GEN' },
      WILAYAH: { sheet: SHEET_NAMES.MASTER_WILAYAH, pk: 'kode_wilayah', prefix: 'WIL' }
    };
    var cfg = sheetMap[masterType];
    if (!cfg) throw new Error('Jenis master data tidak valid.');

    var pkVal = sanitizeString(item[cfg.pk]);
    if (!pkVal) {
      pkVal = generateUuid(cfg.prefix);
      item[cfg.pk] = pkVal;
      if (masterType === 'WILAYAH') item.last_synced = nowJakartaIso();
      appendObjectRows(cfg.sheet, [item]);
      writeAuditLog(actor, 'TAMBAH_MASTER', cfg.sheet, pkVal, null, item, 'BERHASIL', 'Menambah item master ' + masterType);
    } else {
      var updated = updateRowByPrimaryKey(cfg.sheet, cfg.pk, pkVal, item);
      if (!updated) {
        if (masterType === 'WILAYAH') item.last_synced = nowJakartaIso();
        appendObjectRows(cfg.sheet, [item]);
      }
      writeAuditLog(actor, 'EDIT_MASTER', cfg.sheet, pkVal, null, item, 'BERHASIL', 'Memperbarui item master ' + masterType);
    }
    return { ok: true, id: pkVal };
  });
}
