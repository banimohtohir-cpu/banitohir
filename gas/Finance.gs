/**
 * Finance.gs
 * Tahap 4: Akuntansi Double-Entry Paguyuban (COA, Transaksi, Jurnal, Verifikasi, Koreksi),
 * Target Iuran & Tagihan (TAGIHAN_IURAN), Pembayaran + Kuitansi Otomatis, Anggaran, dan Laporan Keuangan.
 */

function getFinanceOverview(sessionToken, tahunFilter) {
  var actor = requireAuth(sessionToken, 'KEUANGAN', 'view');
  var perms = getPermissionsForRole_(actor.role_id);
  var canDetail = !!(perms.KEUANGAN && perms.KEUANGAN.view_finance_detail);
  var tahun = parseInt(tahunFilter, 10) || 2026;

  var coa = readSheetObjects(SHEET_NAMES.COA, true).filter(function (c) { return c.status_aktif !== false && String(c.status_aktif).toUpperCase() !== 'FALSE'; });
  var allTrx = readSheetObjects(SHEET_NAMES.TRANSAKSI, true);
  var allJurnal = readSheetObjects(SHEET_NAMES.JURNAL, true);
  var tarif = readSheetObjects(SHEET_NAMES.MASTER_TARIF_IURAN, true);
  var tagihan = readSheetObjects(SHEET_NAMES.TAGIHAN_IURAN, true);
  var pembayaran = readSheetObjects(SHEET_NAMES.PEMBAYARAN, true);
  var anggaran = readSheetObjects(SHEET_NAMES.ANGGARAN, true);
  var anggota = readSheetObjects(SHEET_NAMES.ANGGOTA, true);
  var rumahTangga = readSheetObjects(SHEET_NAMES.RUMAH_TANGGA, true);

  var visibleTrx = canDetail ? allTrx : allTrx.filter(function (t) {
    return (t.is_published === true || String(t.is_published).toUpperCase() === 'TRUE') && t.status_verifikasi === 'TERVERIFIKASI';
  });

  // Hitung saldo COA dari jurnal terverifikasi
  var verifiedTrxSet = {};
  allTrx.forEach(function (t) {
    if (t.status_verifikasi === 'TERVERIFIKASI') verifiedTrxSet[t.transaksi_id] = true;
  });

  var coaBalances = {};
  coa.forEach(function (c) {
    coaBalances[c.kode_akun] = { kode_akun: c.kode_akun, nama_akun: c.nama_akun, kategori: c.kategori, saldo_normal: c.saldo_normal, is_kas_bank: c.is_kas_bank === true || String(c.is_kas_bank).toUpperCase() === 'TRUE', debit: 0, kredit: 0, saldo: 0 };
  });

  allJurnal.forEach(function (j) {
    if (!verifiedTrxSet[j.transaksi_id]) return;
    var acc = coaBalances[j.kode_akun];
    if (!acc) return;
    var d = Number(j.debit) || 0;
    var k = Number(j.kredit) || 0;
    acc.debit += d;
    acc.kredit += k;
    acc.saldo = acc.saldo_normal === 'KREDIT' ? (acc.kredit - acc.debit) : (acc.debit - acc.kredit);
  });

  var totalKasBank = 0;
  var totalPendapatan = 0;
  var totalBeban = 0;
  var totalAset = 0;
  var totalKewajiban = 0;
  var totalSaldoDana = 0;

  Object.keys(coaBalances).forEach(function (k) {
    var acc = coaBalances[k];
    if (acc.is_kas_bank) totalKasBank += acc.saldo;
    if (acc.kategori === 'ASET') totalAset += acc.saldo;
    if (acc.kategori === 'KEWAJIBAN') totalKewajiban += acc.saldo;
    if (acc.kategori === 'SALDO_DANA') totalSaldoDana += acc.saldo;
    if (acc.kategori === 'PENDAPATAN') totalPendapatan += acc.saldo;
    if (acc.kategori === 'BEBAN') totalBeban += acc.saldo;
  });

  var tagihanTahun = tagihan.filter(function (t) { return Number(t.tahun_iuran) === tahun; });
  var totalTargetIuran = 0;
  var totalDiskonIuran = 0;
  var totalTerbayarIuran = 0;
  var totalSisaIuran = 0;

  var memberNameMap = {};
  anggota.forEach(function (m) { memberNameMap[m.id_anggota] = m.nama_lengkap; });
  var rtNameMap = {};
  rumahTangga.forEach(function (rt) { rtNameMap[rt.id_rumah_tangga] = rt.nama_rumah_tangga; });

  tagihanTahun.forEach(function (t) {
    totalTargetIuran += Number(t.nominal_tagihan) || 0;
    totalDiskonIuran += Number(t.diskon_pembebasan) || 0;
    totalTerbayarIuran += Number(t.total_terbayar) || 0;
    totalSisaIuran += Number(t.sisa_tagihan) || 0;
  });

  var payByBill = {};
  pembayaran.forEach(function (p) {
    if (!payByBill[p.tagihan_id]) payByBill[p.tagihan_id] = [];
    payByBill[p.tagihan_id].push(p);
  });

  var enrichedTagihan = canDetail ? tagihanTahun.map(function (t) {
    var pays = (payByBill[t.tagihan_id] || []).slice().sort(function (a, b) {
      return String(b.tanggal_bayar || b.created_at).localeCompare(String(a.tanggal_bayar || a.created_at));
    });
    var latest = pays[0];
    return Object.assign({}, t, {
      nama_anggota: memberNameMap[t.id_kk] || t.id_kk,
      nama_rumah_tangga: rtNameMap[t.id_rumah_tangga] || '-',
      tanggal_bayar_terakhir: latest ? latest.tanggal_bayar : '',
      metode_bayar_terakhir: latest ? latest.metode_bayar : '',
      jumlah_pembayaran: pays.length
    });
  }) : [];

  var totalPemasukanIuran = 0;
  var totalPemasukanLainnya = 0;
  var totalPengeluaranKas = 0;
  allTrx.forEach(function (t) {
    if (t.status_verifikasi !== 'TERVERIFIKASI') return;
    var nom = Number(t.total_nominal) || 0;
    if (t.jenis_transaksi === 'PEMASUKAN') {
      if (String(t.no_transaksi || '').indexOf('IUR-') === 0) totalPemasukanIuran += nom;
      else totalPemasukanLainnya += nom;
    } else if (t.jenis_transaksi === 'PENGELUARAN') {
      totalPengeluaranKas += nom;
    }
  });

  return {
    ok: true,
    canDetail: canDetail,
    tahun: tahun,
    summary: {
      totalKasBank: totalKasBank,
      totalPendapatan: totalPendapatan,
      totalBeban: totalBeban,
      surplusDefisit: totalPendapatan - totalBeban,
      totalAset: totalAset,
      totalKewajiban: totalKewajiban,
      totalSaldoDana: totalSaldoDana,
      totalTargetIuran: totalTargetIuran,
      totalDiskonIuran: totalDiskonIuran,
      totalTerbayarIuran: totalTerbayarIuran,
      totalSisaIuran: totalSisaIuran,
      jumlahTagihan: tagihanTahun.length,
      jumlahLunas: tagihanTahun.filter(function (t) { return t.status_bayar === 'LUNAS'; }).length,
      totalPemasukanIuran: totalPemasukanIuran,
      totalPemasukanLainnya: totalPemasukanLainnya,
      totalPengeluaranKas: totalPengeluaranKas
    },
    coa: coa,
    coaBalances: Object.keys(coaBalances).map(function (k) { return coaBalances[k]; }),
    transaksi: visibleTrx,
    jurnal: canDetail ? allJurnal : [],
    tarifIuran: tarif,
    tagihanIuran: enrichedTagihan,
    pembayaran: canDetail ? pembayaran : [],
    anggaran: anggaran
  };
}

function createFinanceTransaction(sessionToken, payload) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'KEUANGAN', 'create');
    var jenis = sanitizeString(payload.jenis_transaksi).toUpperCase();
    var nominal = Number(payload.total_nominal) || 0;
    var akunKas = sanitizeString(payload.sumber_dana_akun);
    var akunLawan = sanitizeString(payload.akun_lawan);
    var tgl = sanitizeString(payload.tanggal_transaksi) || nowJakartaIso().substring(0, 10);
    var ket = sanitizeString(payload.keterangan);

    if (['PEMASUKAN', 'PENGELUARAN', 'MUTASI'].indexOf(jenis) === -1) {
      throw new Error('Jenis transaksi harus PEMASUKAN, PENGELUARAN, atau MUTASI.');
    }
    if (nominal <= 0) throw new Error('Nominal transaksi harus lebih besar dari 0.');
    if (!akunKas || !akunLawan || akunKas === akunLawan) {
      throw new Error('Akun kas/bank dan akun lawan wajib dipilih serta tidak boleh sama.');
    }
    if (!ket) throw new Error('Keterangan transaksi wajib diisi.');

    var now = nowJakartaIso();
    var trxId = generateUuid('TRX');
    var noTrx = 'TRX-' + tgl.replace(/-/g, '') + '-' + trxId.slice(-4);
    var autoVerify = actor.role_id === 'SUPER_ADMIN' || actor.role_id === 'BENDAHARA';

    var trxRow = {
      transaksi_id: trxId,
      no_transaksi: noTrx,
      tanggal_transaksi: tgl,
      jenis_transaksi: jenis,
      sumber_dana_akun: akunKas,
      kegiatan_id: sanitizeString(payload.kegiatan_id),
      keterangan: ket,
      total_nominal: nominal,
      status_verifikasi: autoVerify ? 'TERVERIFIKASI' : 'MENUNGGU_VERIFIKASI',
      is_published: payload.is_published === true,
      ref_koreksi_id: '',
      pencatat_user_id: actor.user_id,
      verifikator_user_id: autoVerify ? actor.user_id : '',
      verified_at: autoVerify ? now : '',
      created_at: now
    };

    var debitAkun = jenis === 'PENGELUARAN' ? akunLawan : akunKas;
    var kreditAkun = jenis === 'PENGELUARAN' ? akunKas : akunLawan;
    if (jenis === 'MUTASI') {
      // Untuk MUTASI: sumber_dana_akun = asal (kredit), akun_lawan = tujuan (debit)
      debitAkun = akunLawan;
      kreditAkun = akunKas;
    }

    var jurnalRows = [
      { jurnal_id: generateUuid('JRN'), transaksi_id: trxId, tanggal: tgl, kode_akun: debitAkun, debit: nominal, kredit: 0, keterangan_baris: ket, urutan: 1 },
      { jurnal_id: generateUuid('JRN'), transaksi_id: trxId, tanggal: tgl, kode_akun: kreditAkun, debit: 0, kredit: nominal, keterangan_baris: ket, urutan: 2 }
    ];

    appendObjectRows(SHEET_NAMES.TRANSAKSI, [trxRow]);
    appendObjectRows(SHEET_NAMES.JURNAL, jurnalRows);

    if (payload.bukti_url) {
      appendObjectRows(SHEET_NAMES.BUKTI_TRANSAKSI, [{
        bukti_id: generateUuid('BKT'),
        transaksi_id: trxId,
        nama_file: sanitizeString(payload.bukti_nama) || 'Lampiran Bukti',
        drive_file_id: sanitizeString(payload.bukti_drive_id),
        drive_url: sanitizeString(payload.bukti_url),
        mime_type: 'link',
        uploaded_by: actor.username_login,
        uploaded_at: now
      }]);
    }

    writeAuditLog(actor, 'CATAT_TRANSAKSI', SHEET_NAMES.TRANSAKSI, trxId, null, trxRow, 'BERHASIL', jenis + ' ' + formatRupiah(nominal));
    return { ok: true, transaksi: trxRow, jurnal: jurnalRows };
  });
}

function verifyFinanceTransaction(sessionToken, transaksiId, statusVerifikasi, isPublished) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'KEUANGAN', 'edit');
    var patch = {
      status_verifikasi: sanitizeString(statusVerifikasi) || 'TERVERIFIKASI',
      is_published: isPublished === true,
      verifikator_user_id: actor.user_id,
      verified_at: nowJakartaIso()
    };
    var ok = updateRowByPrimaryKey(SHEET_NAMES.TRANSAKSI, 'transaksi_id', transaksiId, patch);
    if (!ok) throw new Error('Transaksi tidak ditemukan.');
    writeAuditLog(actor, 'VERIFIKASI_TRANSAKSI', SHEET_NAMES.TRANSAKSI, transaksiId, null, patch, 'BERHASIL', 'Status: ' + patch.status_verifikasi);
    return { ok: true };
  });
}

function reverseFinanceTransaction(sessionToken, refTransaksiId, alasan) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'KEUANGAN', 'edit');
    var allTrx = readSheetObjects(SHEET_NAMES.TRANSAKSI, false);
    var target = allTrx.filter(function (t) { return t.transaksi_id === refTransaksiId; })[0];
    if (!target) throw new Error('Transaksi referensi tidak ditemukan.');

    var allJurnal = readSheetObjects(SHEET_NAMES.JURNAL, false).filter(function (j) { return j.transaksi_id === refTransaksiId; });
    var now = nowJakartaIso();
    var korId = generateUuid('TRX');
    var tgl = now.substring(0, 10);
    var ket = 'Koreksi atas ' + target.no_transaksi + ': ' + (sanitizeString(alasan) || 'Penyesuaian pembukuan');

    var korTrx = {
      transaksi_id: korId,
      no_transaksi: 'KOR-' + tgl.replace(/-/g, '') + '-' + korId.slice(-4),
      tanggal_transaksi: tgl,
      jenis_transaksi: 'KOREKSI',
      sumber_dana_akun: target.sumber_dana_akun,
      kegiatan_id: target.kegiatan_id,
      keterangan: ket,
      total_nominal: target.total_nominal,
      status_verifikasi: 'TERVERIFIKASI',
      is_published: target.is_published,
      ref_koreksi_id: refTransaksiId,
      pencatat_user_id: actor.user_id,
      verifikator_user_id: actor.user_id,
      verified_at: now,
      created_at: now
    };

    var revJurnal = allJurnal.map(function (j, idx) {
      return {
        jurnal_id: generateUuid('JRN'),
        transaksi_id: korId,
        tanggal: tgl,
        kode_akun: j.kode_akun,
        debit: Number(j.kredit) || 0,
        kredit: Number(j.debit) || 0,
        keterangan_baris: ket,
        urutan: idx + 1
      };
    });

    appendObjectRows(SHEET_NAMES.TRANSAKSI, [korTrx]);
    appendObjectRows(SHEET_NAMES.JURNAL, revJurnal);
    writeAuditLog(actor, 'KOREKSI_TRANSAKSI', SHEET_NAMES.TRANSAKSI, korId, null, korTrx, 'BERHASIL', ket);
    return { ok: true, transaksi: korTrx };
  });
}

function updateIuranBillTarget(sessionToken, tagihanId, nominalTagihan, diskonPembebasan, alasanPembebasan) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'KEUANGAN', 'edit');
    var bills = readSheetObjects(SHEET_NAMES.TAGIHAN_IURAN, false);
    var bill = bills.filter(function (b) { return b.tagihan_id === tagihanId; })[0];
    if (!bill) throw new Error('Data target iuran tidak ditemukan.');

    var nom = Math.max(Number(nominalTagihan) || 0, 0);
    var disc = Math.max(Number(diskonPembebasan) || 0, 0);
    var paid = Number(bill.total_terbayar) || 0;
    var netTarget = Math.max(nom - disc, 0);
    var sisa = Math.max(netTarget - paid, 0);
    var status = sisa === 0 ? (disc >= nom && paid === 0 ? 'DIBEBASKAN' : 'LUNAS') : (paid > 0 ? 'SEBAGIAN' : 'BELUM_LUNAS');

    var patch = {
      nominal_tagihan: nom,
      diskon_pembebasan: disc,
      alasan_pembebasan: sanitizeString(alasanPembebasan),
      sisa_tagihan: sisa,
      status_bayar: status,
      updated_at: nowJakartaIso()
    };
    updateRowByPrimaryKey(SHEET_NAMES.TAGIHAN_IURAN, 'tagihan_id', tagihanId, patch);
    writeAuditLog(actor, 'EDIT_TARGET_IURAN', SHEET_NAMES.TAGIHAN_IURAN, tagihanId, bill, patch, 'BERHASIL', 'Ubah target/keringanan iuran');
    return { ok: true };
  });
}

function recordIuranPayment(sessionToken, payload) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'KEUANGAN', 'create');
    var tagihanId = sanitizeString(payload.tagihan_id);
    var nominalBayar = Number(payload.nominal_bayar) || 0;
    var metode = sanitizeString(payload.metode_bayar).toUpperCase() || 'TRANSFER_BANK';
    var akunKas = sanitizeString(payload.akun_kas) || '1103';
    var tglBayar = sanitizeString(payload.tanggal_bayar) || nowJakartaIso().substring(0, 10);
    var ket = sanitizeString(payload.keterangan) || 'Pembayaran iuran keluarga besar';

    if (nominalBayar <= 0) throw new Error('Nominal pembayaran harus lebih dari 0.');
    var bills = readSheetObjects(SHEET_NAMES.TAGIHAN_IURAN, false);
    var bill = bills.filter(function (b) { return b.tagihan_id === tagihanId; })[0];
    if (!bill) throw new Error('Tagihan target iuran tidak ditemukan.');

    var netTarget = Math.max((Number(bill.nominal_tagihan) || 0) - (Number(bill.diskon_pembebasan) || 0), 0);
    var nextPaid = (Number(bill.total_terbayar) || 0) + nominalBayar;
    var nextSisa = Math.max(netTarget - nextPaid, 0);
    var nextStatus = nextSisa === 0 ? 'LUNAS' : 'SEBAGIAN';
    var now = nowJakartaIso();

    var trxId = generateUuid('TRX');
    var payId = generateUuid('PAY');
    var noKuitansi = 'KUI-' + bill.tahun_iuran + '-' + payId.slice(-4);

    var trxRow = {
      transaksi_id: trxId,
      no_transaksi: 'IUR-' + tglBayar.replace(/-/g, '') + '-' + trxId.slice(-4),
      tanggal_transaksi: tglBayar,
      jenis_transaksi: 'PEMASUKAN',
      sumber_dana_akun: akunKas,
      kegiatan_id: '',
      keterangan: 'Pembayaran Iuran ' + bill.tahun_iuran + ' (' + noKuitansi + ') - ' + ket,
      total_nominal: nominalBayar,
      status_verifikasi: 'TERVERIFIKASI',
      is_published: true,
      ref_koreksi_id: '',
      pencatat_user_id: actor.user_id,
      verifikator_user_id: actor.user_id,
      verified_at: now,
      created_at: now
    };

    var jurnalRows = [
      { jurnal_id: generateUuid('JRN'), transaksi_id: trxId, tanggal: tglBayar, kode_akun: akunKas, debit: nominalBayar, kredit: 0, keterangan_baris: noKuitansi, urutan: 1 },
      { jurnal_id: generateUuid('JRN'), transaksi_id: trxId, tanggal: tglBayar, kode_akun: '4101', debit: 0, kredit: nominalBayar, keterangan_baris: noKuitansi, urutan: 2 }
    ];

    var payRow = {
      pembayaran_id: payId,
      tagihan_id: tagihanId,
      id_rumah_tangga: bill.id_rumah_tangga || '',
      tahun_iuran: bill.tahun_iuran,
      tanggal_bayar: tglBayar,
      nominal_bayar: nominalBayar,
      metode_bayar: metode,
      transaksi_id: trxId,
      petugas_user_id: actor.user_id,
      no_kuitansi: noKuitansi,
      kuitansi_drive_id: '',
      bukti_id: '',
      keterangan: ket,
      created_at: now
    };

    updateRowByPrimaryKey(SHEET_NAMES.TAGIHAN_IURAN, 'tagihan_id', tagihanId, {
      total_terbayar: nextPaid,
      sisa_tagihan: nextSisa,
      status_bayar: nextStatus,
      updated_at: now
    });
    appendObjectRows(SHEET_NAMES.PEMBAYARAN, [payRow]);
    appendObjectRows(SHEET_NAMES.TRANSAKSI, [trxRow]);
    appendObjectRows(SHEET_NAMES.JURNAL, jurnalRows);

    writeAuditLog(actor, 'BAYAR_IURAN', SHEET_NAMES.PEMBAYARAN, payId, null, payRow, 'BERHASIL', noKuitansi + ' ' + formatRupiah(nominalBayar));
    return { ok: true, pembayaran: payRow, no_kuitansi: noKuitansi };
  });
}

function generateAnnualIuranBills(sessionToken, tahunIuran, nominalStandar, jatuhTempo) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'KEUANGAN', 'create');
    var tahun = parseInt(tahunIuran, 10) || 2026;
    var nominal = Number(nominalStandar) || 0;
    if (nominal <= 0) throw new Error('Nominal standar target iuran harus lebih dari 0.');

    var existing = readSheetObjects(SHEET_NAMES.TAGIHAN_IURAN, false).filter(function (b) { return Number(b.tahun_iuran) === tahun; });
    var hasRtSet = {};
    existing.forEach(function (b) {
      if (b.id_rumah_tangga) hasRtSet[b.id_rumah_tangga] = true;
      if (b.id_kk) hasRtSet[b.id_kk] = true;
    });

    var households = readSheetObjects(SHEET_NAMES.RUMAH_TANGGA, true).filter(function (h) { return h.status_aktif !== false; });
    var now = nowJakartaIso();
    var toAdd = [];
    households.forEach(function (h) {
      if (hasRtSet[h.id_rumah_tangga] || hasRtSet[h.id_kepala_keluarga]) return;
      toAdd.push({
        tagihan_id: generateUuid('TGH'),
        tahun_iuran: tahun,
        id_rumah_tangga: h.id_rumah_tangga,
        id_kk: h.id_kepala_keluarga,
        nominal_tagihan: nominal,
        diskon_pembebasan: 0,
        alasan_pembebasan: '',
        total_terbayar: 0,
        sisa_tagihan: nominal,
        status_bayar: 'BELUM_LUNAS',
        jatuh_tempo: sanitizeString(jatuhTempo) || (tahun + '-12-31'),
        updated_at: now
      });
    });

    appendObjectRows(SHEET_NAMES.TAGIHAN_IURAN, toAdd);
    writeAuditLog(actor, 'GENERATE_TARGET_IURAN', SHEET_NAMES.TAGIHAN_IURAN, String(tahun), null, { count: toAdd.length, nominal: nominal }, 'BERHASIL', 'Generate target iuran tahun ' + tahun);
    return { ok: true, createdCount: toAdd.length };
  });
}

function saveCoaAccount(sessionToken, payload) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'KEUANGAN', 'edit');
    var kode = sanitizeString(payload.kode_akun);
    var nama = sanitizeString(payload.nama_akun);
    var kategori = sanitizeString(payload.kategori).toUpperCase();
    if (!kode || !nama) throw new Error('Kode akun dan nama akun wajib diisi.');
    if (['ASET', 'KEWAJIBAN', 'SALDO_DANA', 'PENDAPATAN', 'BEBAN'].indexOf(kategori) === -1) {
      throw new Error('Kategori COA tidak valid.');
    }

    var row = {
      kode_akun: kode,
      nama_akun: nama,
      kategori: kategori,
      sub_kategori: sanitizeString(payload.sub_kategori).toUpperCase() || kategori,
      saldo_normal: sanitizeString(payload.saldo_normal).toUpperCase() || ((kategori === 'ASET' || kategori === 'BEBAN') ? 'DEBIT' : 'KREDIT'),
      is_kas_bank: payload.is_kas_bank === true,
      status_aktif: payload.status_aktif !== false,
      keterangan: sanitizeString(payload.keterangan)
    };

    var updated = updateRowByPrimaryKey(SHEET_NAMES.COA, 'kode_akun', kode, row);
    if (!updated) {
      appendObjectRows(SHEET_NAMES.COA, [row]);
    }
    writeAuditLog(actor, 'SIMPAN_COA', SHEET_NAMES.COA, kode, null, row, 'BERHASIL', kode + ' - ' + nama);
    return { ok: true, account: row };
  });
}

function saveIuranTarif(sessionToken, payload) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'KEUANGAN', 'edit');
    var tahun = parseInt(payload.tahun_iuran, 10) || 2026;
    var nom = Number(payload.nominal_standar) || 0;
    if (nom < 0) throw new Error('Nominal standar tidak boleh negatif.');

    var tarifId = sanitizeString(payload.tarif_id) || generateUuid('TRF');
    var row = {
      tarif_id: tarifId,
      tahun_iuran: tahun,
      nominal_standar: nom,
      target_total_tahun: Number(payload.target_total_tahun) || nom,
      periode_tipe: sanitizeString(payload.periode_tipe) || 'TAHUNAN',
      jatuh_tempo: sanitizeString(payload.jatuh_tempo) || (tahun + '-12-31'),
      keterangan: sanitizeString(payload.keterangan),
      status_aktif: payload.status_aktif !== false
    };
    var updated = updateRowByPrimaryKey(SHEET_NAMES.MASTER_TARIF_IURAN, 'tarif_id', tarifId, row);
    if (!updated) appendObjectRows(SHEET_NAMES.MASTER_TARIF_IURAN, [row]);
    writeAuditLog(actor, 'SIMPAN_TARIF_IURAN', SHEET_NAMES.MASTER_TARIF_IURAN, tarifId, null, row, 'BERHASIL', 'Tarif iuran ' + tahun);
    return { ok: true, tarif: row };
  });
}

function saveAnggaran(sessionToken, payload) {
  return withScriptLock(function () {
    var actor = requireAuth(sessionToken, 'KEUANGAN', 'edit');
    var tahun = parseInt(payload.tahun_anggaran, 10) || 2026;
    var kodeAkun = sanitizeString(payload.kode_akun);
    var nominal = Number(payload.nominal_anggaran) || 0;
    if (!kodeAkun || nominal < 0) throw new Error('Kode akun dan nominal anggaran valid wajib diisi.');

    var anggaranId = sanitizeString(payload.anggaran_id) || generateUuid('ANG');
    var row = {
      anggaran_id: anggaranId,
      tahun_anggaran: tahun,
      kegiatan_id: sanitizeString(payload.kegiatan_id),
      kode_akun: kodeAkun,
      nominal_anggaran: nominal,
      keterangan: sanitizeString(payload.keterangan),
      status_aktif: payload.status_aktif !== false,
      created_at: nowJakartaIso()
    };
    var updated = updateRowByPrimaryKey(SHEET_NAMES.ANGGARAN, 'anggaran_id', anggaranId, row);
    if (!updated) appendObjectRows(SHEET_NAMES.ANGGARAN, [row]);
    writeAuditLog(actor, 'SIMPAN_ANGGARAN', SHEET_NAMES.ANGGARAN, anggaranId, null, row, 'BERHASIL', kodeAkun + ': ' + formatRupiah(nominal));
    return { ok: true, anggaran: row };
  });
}

