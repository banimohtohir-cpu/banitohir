import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  FinanceOverviewResponse,
  MasterBundles,
  MemberDetailResponse,
  PembayaranEnriched,
  SuratRecord,
} from '../types';

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

export interface PdfSummaryItem {
  label: string;
  value: string;
}

export interface PdfTableOptions {
  filename: string;
  title: string;
  subtitle?: string;
  orientation?: 'portrait' | 'landscape';
  summary?: PdfSummaryItem[];
  headers: string[];
  rows: (string | number)[][];
  columnAlignments?: Record<number, 'left' | 'center' | 'right'>;
  leftSignerTitle?: string;
  rightSignerTitle?: string;
}

function safePdfText(input: unknown): string {
  return String(input ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2192/g, '->')
    .replace(/\u00B7/g, ' | ')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ')
    .trim();
}

function formatRp(val: number): string {
  return 'Rp ' + (Number(val) || 0).toLocaleString('id-ID');
}

function todayFormatted(): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

function drawKopPaguyuban(doc: jsPDF, title: string, subtitle?: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Monogram badge box
  doc.setFillColor(22, 101, 52);
  doc.roundedRect(margin, 11, 14, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('BMT', margin + 7, 19.5, { align: 'center' });

  // Main Header Text
  doc.setTextColor(20, 83, 45);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PAGUYUBAN KELUARGA BESAR BANI HAJI MOHAMMAD TOHIR', margin + 18, 16);

  doc.setTextColor(82, 82, 91);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    'Guyub, Akur, Semedulur  |  Sekretariat Pusat: Pangebatan, Karanglewas, Banyumas',
    margin + 18,
    21.5
  );

  // Double rule
  doc.setDrawColor(20, 83, 45);
  doc.setLineWidth(0.7);
  doc.line(margin, 28, pageWidth - margin, 28);
  doc.setLineWidth(0.25);
  doc.line(margin, 29.5, pageWidth - margin, 29.5);

  // Document Title & Print Date
  doc.setTextColor(24, 24, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(safePdfText(title), margin, 36.5);

  doc.setTextColor(100, 100, 110);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Dicetak: ${todayFormatted()}`, pageWidth - margin, 36.5, { align: 'right' });

  if (subtitle) {
    doc.text(safePdfText(subtitle), margin, 41.5);
    return 46;
  }
  return 42;
}

function drawSignatureBlock(
  doc: jsPDF,
  startY: number,
  leftTitle = 'Mengetahui, Ketua Paguyuban',
  rightTitle = 'Sekretariat / Pengurus'
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = startY + 10;

  if (y + 34 > pageHeight - 14) {
    doc.addPage();
    y = 22;
  }

  const leftX = margin + 35;
  const rightX = pageWidth - margin - 35;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(63, 63, 70);
  doc.text(`Banyumas, ${todayFormatted()}`, rightX, y, { align: 'center' });

  y += 6;
  doc.text(safePdfText(leftTitle), leftX, y, { align: 'center' });
  doc.text(safePdfText(rightTitle), rightX, y, { align: 'center' });

  y += 20;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(24, 24, 27);
  doc.text('( _________________________ )', leftX, y, { align: 'center' });
  doc.text('( _________________________ )', rightX, y, { align: 'center' });
}

function stampPageFooters(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 128);
    doc.text(
      'Dokumen Resmi Sistem Informasi Keluarga Besar Bani Haji Mohammad Tohir',
      14,
      pageHeight - 8
    );
    doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
  }
}

export function generateTablePdf(opts: PdfTableOptions) {
  const doc = new jsPDF({
    orientation: opts.orientation || 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as JsPdfWithAutoTable;

  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  let cursorY = drawKopPaguyuban(doc, opts.title, opts.subtitle);

  if (opts.summary && opts.summary.length > 0) {
    const gap = 3;
    const colW = (pageWidth - margin * 2 - gap * (opts.summary.length - 1)) / opts.summary.length;
    opts.summary.forEach((item, idx) => {
      const x = margin + idx * (colW + gap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(212, 212, 216);
      doc.roundedRect(x, cursorY, colW, 13, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(safePdfText(item.label), x + 3, cursorY + 4.8);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(20, 83, 45);
      doc.text(safePdfText(item.value), x + 3, cursorY + 10.3);
    });
    cursorY += 17;
  }

  const columnStyles: Record<number, { halign?: 'left' | 'center' | 'right' }> = {};
  if (opts.columnAlignments) {
    Object.entries(opts.columnAlignments).forEach(([k, v]) => {
      columnStyles[Number(k)] = { halign: v };
    });
  }

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin, bottom: 16 },
    head: [opts.headers.map(safePdfText)],
    body: opts.rows.map((r) => r.map(safePdfText)),
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [39, 39, 42],
      lineColor: [228, 228, 231],
      lineWidth: 0.2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [21, 128, 61],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    columnStyles,
  });

  const finalY = doc.lastAutoTable?.finalY ?? cursorY + 20;
  drawSignatureBlock(
    doc,
    finalY,
    opts.leftSignerTitle || 'Mengetahui, Ketua Paguyuban',
    opts.rightSignerTitle || 'Sekretariat Paguyuban'
  );
  stampPageFooters(doc);
  doc.save(opts.filename.endsWith('.pdf') ? opts.filename : `${opts.filename}.pdf`);
}

export function generateFinanceReportPdf(data: FinanceOverviewResponse, tahun: number) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as JsPdfWithAutoTable;
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = drawKopPaguyuban(
    doc,
    `Laporan Keuangan Resmi Tahun Buku ${tahun}`,
    'Laporan Aktivitas (Pendapatan & Beban) dan Neraca Posisi Keuangan Paguyuban'
  );

  const kpis: PdfSummaryItem[] = [
    { label: 'Total Kas & Bank', value: formatRp(data.summary.totalKasBank) },
    { label: 'Pendapatan Diakui', value: formatRp(data.summary.totalPendapatan) },
    { label: 'Total Beban', value: formatRp(data.summary.totalBeban) },
    { label: 'Surplus / (Defisit)', value: formatRp(data.summary.surplusDefisit) },
  ];
  const gap = 3;
  const colW = (pageWidth - margin * 2 - gap * 3) / 4;
  kpis.forEach((item, idx) => {
    const x = margin + idx * (colW + gap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(212, 212, 216);
    doc.roundedRect(x, y, colW, 13, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, x + 2.5, y + 4.8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(20, 83, 45);
    doc.text(item.value, x + 2.5, y + 10.3);
  });
  y += 18;

  // Section 1: Laporan Aktivitas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(24, 24, 27);
  doc.text('I. Laporan Aktivitas (Pendapatan & Beban)', margin, y);
  y += 3;

  const aktivitasRows = data.coaBalances
    .filter((c) => c.kategori === 'PENDAPATAN' || c.kategori === 'BEBAN')
    .map((c) => [
      c.kode_akun,
      c.nama_akun,
      c.kategori,
      c.kategori === 'BEBAN' ? `(${formatRp(c.saldo)})` : formatRp(c.saldo),
    ]);
  aktivitasRows.push(['', 'SURPLUS / (DEFISIT) BERSIH', '', formatRp(data.summary.surplusDefisit)]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Kode', 'Nama Akun', 'Kategori', 'Jumlah']],
    body: aktivitasRows.map((r) => r.map(safePdfText)),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.3 },
    headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 3: { halign: 'right' } },
  });

  y = (doc.lastAutoTable?.finalY ?? y + 30) + 8;

  // Section 2: Neraca Posisi Keuangan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(24, 24, 27);
  doc.text('II. Neraca Posisi Keuangan', margin, y);
  y += 3;

  const neracaRows = data.coaBalances
    .filter((c) => c.kategori === 'ASET' || c.kategori === 'KEWAJIBAN' || c.kategori === 'SALDO_DANA')
    .map((c) => [c.kode_akun, c.nama_akun, c.kategori.replace('_', ' '), formatRp(c.saldo)]);
  neracaRows.push(['', 'TOTAL ASET', '', formatRp(data.summary.totalAset)]);
  neracaRows.push([
    '',
    'TOTAL KEWAJIBAN + SALDO DANA + SURPLUS',
    '',
    formatRp(data.summary.totalKewajiban + data.summary.totalSaldoDana + data.summary.surplusDefisit),
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, bottom: 16 },
    head: [['Kode', 'Nama Akun', 'Kelompok', 'Saldo']],
    body: neracaRows.map((r) => r.map(safePdfText)),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.3 },
    headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 3: { halign: 'right' } },
  });

  const finalY = doc.lastAutoTable?.finalY ?? y + 30;
  drawSignatureBlock(doc, finalY, 'Mengetahui, Ketua Paguyuban', 'Bendahara Paguyuban');
  stampPageFooters(doc);
  doc.save(`laporan_keuangan_resmi_${tahun}.pdf`);
}

export function generateLetterPdf(surat: SuratRecord) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  const margin = 18;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = drawKopPaguyuban(doc, 'SURAT RESMI PAGUYUBAN', `${surat.jenis_surat.replace('_', ' ')}`);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(24, 24, 27);

  const metaLines: [string, string][] = [
    ['Nomor', surat.nomor_surat],
    ['Tanggal', surat.tanggal_surat],
    ['Perihal', surat.perihal],
    ['Kepada Yth.', `${surat.penerima_tipe.replace('_', ' ')} Bani Haji Mohammad Tohir`],
  ];

  metaLines.forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.text(label, margin, y);
    doc.text(':', margin + 26, y);
    doc.setFont('helvetica', label === 'Perihal' || label === 'Nomor' ? 'bold' : 'normal');
    doc.text(safePdfText(val), margin + 30, y);
    y += 6;
  });

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  const bodyText = safePdfText(surat.isi_surat || 'Assalamualaikum warahmatullahi wabarakatuh.');
  const lines = doc.splitTextToSize(bodyText, pageWidth - margin * 2);
  doc.text(lines, margin, y);
  y += lines.length * 5.2 + 8;

  drawSignatureBlock(doc, y, 'Mengetahui, Ketua Paguyuban', 'Sekretariat Paguyuban');
  stampPageFooters(doc);
  doc.save(`surat_${surat.nomor_surat.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`);
}

export function generateReceiptPdf(receipt: PembayaranEnriched) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5',
  });
  const margin = 12;
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setTextColor(20, 83, 45);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PAGUYUBAN KELUARGA BESAR BANI HAJI MOHAMMAD TOHIR', pageWidth / 2, 14, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(82, 82, 91);
  doc.text('Guyub, Akur, Semedulur  |  Kuitansi Pembayaran Resmi Iuran Paguyuban', pageWidth / 2, 19, {
    align: 'center',
  });
  doc.setDrawColor(20, 83, 45);
  doc.setLineWidth(0.6);
  doc.line(margin, 23, pageWidth - margin, 23);

  let y = 32;
  const rows: [string, string][] = [
    ['Nomor Kuitansi', receipt.no_kuitansi],
    ['Tanggal Bayar', receipt.tanggal_bayar],
    ['Telah Diterima Dari', receipt.nama_pembayar || receipt.tagihan_id],
    ['Metode Pembayaran', receipt.metode_bayar],
    ['Untuk Pembayaran', receipt.keterangan],
  ];

  doc.setFontSize(9.5);
  rows.forEach(([k, v]) => {
    doc.setTextColor(100, 100, 110);
    doc.setFont('helvetica', 'normal');
    doc.text(k, margin, y);
    doc.text(':', margin + 36, y);
    doc.setTextColor(24, 24, 27);
    doc.setFont('helvetica', k === 'Nomor Kuitansi' || k === 'Telah Diterima Dari' ? 'bold' : 'normal');
    const wrapped = doc.splitTextToSize(safePdfText(v), pageWidth - margin * 2 - 40);
    doc.text(wrapped, margin + 40, y);
    y += Math.max(6.5, wrapped.length * 5);
  });

  y += 4;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(22, 101, 52);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 16, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(63, 63, 70);
  doc.text('Jumlah Diterima:', margin + 5, y + 9.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 83, 45);
  doc.text(formatRp(receipt.nominal_bayar), pageWidth - margin - 5, y + 10, { align: 'right' });

  y += 28;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(63, 63, 70);
  doc.text(`Banyumas, ${todayFormatted()}`, pageWidth - margin - 24, y, { align: 'center' });
  doc.text('Bendahara Paguyuban', pageWidth - margin - 24, y + 5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text('( _____________________ )', pageWidth - margin - 24, y + 20, { align: 'center' });

  doc.save(`kuitansi_${receipt.no_kuitansi}.pdf`);
}

export interface MemberProfilePdfOptions {
  detail: MemberDetailResponse;
  masters: MasterBundles;
}

export function generateMemberProfilePdf({ detail, masters }: MemberProfilePdfOptions) {
  const m = detail.member;
  const fullName = [m.gelar_depan, m.nama_lengkap, m.gelar_belakang].filter(Boolean).join(' ') || m.nama_lengkap;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as JsPdfWithAutoTable;

  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = drawKopPaguyuban(
    doc,
    `Biodata & Silsilah Lengkap: ${fullName}`,
    `ID: ${m.id_anggota} | Kode Silsilah: ${m.kode_silsilah || '-'} | ${m.generasi_label} (${m.status_keturunan})`
  );

  const wilayahMap = new Map(masters.wilayah.map((w) => [`${w.tingkat}:${w.kode_wilayah}`, w.nama_wilayah]));
  const pendidikanNama = masters.pendidikan.find((p) => p.id === m.pendidikan_id)?.nama || '';
  const pekerjaanNama = masters.pekerjaan.find((p) => p.id === m.pekerjaan_id)?.nama || '';
  const alamatFull = [
    m.keterangan_alamat,
    m.nama_jalan,
    m.rt || m.rw ? `RT ${m.rt || '-'} / RW ${m.rw || '-'}` : '',
    m.no_rumah ? `No. ${m.no_rumah}` : '',
    m.kode_pos ? `Kode Pos ${m.kode_pos}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  const wilayahFull = [
    wilayahMap.get(`DESA:${m.kelurahan_id}`),
    wilayahMap.get(`KEC:${m.kecamatan_id}`),
    wilayahMap.get(`KAB:${m.kabkota_id}`),
    wilayahMap.get(`PROV:${m.provinsi_id}`),
  ]
    .filter(Boolean)
    .join(', ');

  const summaryItems: PdfSummaryItem[] = [
    { label: 'ID / Kode Silsilah', value: `${m.id_anggota} / ${m.kode_silsilah || '-'}` },
    { label: 'Kedudukan Keturunan', value: `${m.generasi_label} (${m.status_keturunan})` },
    { label: 'Status Kehidupan', value: m.status_hidup + (m.is_kk ? ' (KK)' : '') },
    { label: 'Anak / Saudara', value: `${detail.children.length} anak / ${detail.siblings.length} sdr` },
  ];

  const gap = 3;
  const colW = (pageWidth - margin * 2 - gap * 3) / 4;
  summaryItems.forEach((item, idx) => {
    const x = margin + idx * (colW + gap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(212, 212, 216);
    doc.roundedRect(x, y, colW, 13, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text(safePdfText(item.label), x + 2.5, y + 4.8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(20, 83, 45);
    doc.text(safePdfText(item.value), x + 2.5, y + 10.3);
  });
  y += 18;

  // Section I: Identitas, Kontak & Alamat
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(24, 24, 27);
  doc.text('I. Identitas Pribadi, Kontak & Alamat Domisili', margin, y);
  y += 2.5;

  const identityRows = [
    ['Nama Lengkap & Gelar', fullName, 'Nama Panggilan', m.nama_panggilan || '-'],
    [
      'Tempat, Tanggal Lahir',
      `${m.tempat_lahir || '-'}, ${m.tanggal_lahir || 'Belum diisi'}`,
      'Jenis Kelamin',
      m.jenis_kelamin === 'L' ? 'Laki-laki' : m.jenis_kelamin === 'P' ? 'Perempuan' : m.jenis_kelamin || '-',
    ],
    [
      'Status Kehidupan',
      `${m.status_hidup}${m.status_hidup === 'WAFAT' && m.tanggal_wafat ? ` (Wafat: ${m.tanggal_wafat})` : ''}`,
      'Pendidikan / Pekerjaan',
      [pendidikanNama, pekerjaanNama, m.pekerjaan_lainnya].filter(Boolean).join(' | ') || '-',
    ],
    [
      'Nomor HP / Telepon',
      [m.no_hp, m.no_hp_alt].filter(Boolean).join(' / ') || '-',
      'Alamat Email',
      m.email || '-',
    ],
    ['Wilayah Administratif', wilayahFull || '-', 'Alamat Lengkap', alamatFull || '-'],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: identityRows.map((r) => r.map(safePdfText)),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, textColor: [39, 39, 42] },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [244, 244, 245], cellWidth: 34 },
      1: { cellWidth: 57 },
      2: { fontStyle: 'bold', fillColor: [244, 244, 245], cellWidth: 34 },
      3: { cellWidth: 57 },
    },
  });
  y = (doc.lastAutoTable?.finalY ?? y + 30) + 6;

  // Section II: Keturunan / Orang Tua & Pasangan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(24, 24, 27);
  doc.text('II. Garis Keturunan (Orang Tua) & Pasangan Hidup', margin, y);
  y += 2.5;

  const parentLines =
    detail.parents.length === 0
      ? [['Orang Tua', '-', 'Belum ada tautan orang tua di database silsilah']]
      : detail.parents.flatMap((p) => {
          const rowsOut: string[][] = [];
          if (p.ayah) {
            rowsOut.push([
              `Ayah (${p.relation.jenis_hubungan})`,
              p.ayah.kode_silsilah || p.ayah.id_anggota,
              `${[p.ayah.gelar_depan, p.ayah.nama_lengkap, p.ayah.gelar_belakang].filter(Boolean).join(' ')} (${p.ayah.generasi_label} | ${p.ayah.status_hidup})`,
            ]);
          }
          if (p.ibu) {
            rowsOut.push([
              'Ibu',
              p.ibu.kode_silsilah || p.ibu.id_anggota,
              `${[p.ibu.gelar_depan, p.ibu.nama_lengkap, p.ibu.gelar_belakang].filter(Boolean).join(' ')} (${p.ibu.generasi_label} | ${p.ibu.status_hidup})`,
            ]);
          }
          return rowsOut;
        });

  const spouseLines =
    detail.spouses.length === 0
      ? [['Pasangan', '-', 'Belum tercatat pasangan']]
      : detail.spouses.map((sp) => [
          `Pasangan Ke-${sp.relation.urutan_pasangan}`,
          sp.partner?.kode_silsilah || sp.partner?.id_anggota || '-',
          `${sp.partner ? [sp.partner.gelar_depan, sp.partner.nama_lengkap, sp.partner.gelar_belakang].filter(Boolean).join(' ') : '-'} (${sp.relation.status_hubungan}${sp.relation.tanggal_menikah ? `, Menikah: ${sp.relation.tanggal_menikah}` : ''})`,
        ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Hubungan', 'Kode / ID', 'Nama Lengkap & Keterangan']],
    body: [...parentLines, ...spouseLines].map((r) => r.map(safePdfText)),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.1 },
    headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' }, 1: { cellWidth: 32 } },
  });
  y = (doc.lastAutoTable?.finalY ?? y + 25) + 6;

  // Section III: Anak-Anak
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(24, 24, 27);
  doc.text(`III. Daftar Anak-Anak (${detail.children.length})`, margin, y);
  y += 2.5;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Anak Ke', 'Kode Silsilah', 'Nama Lengkap', 'Tempat, Tgl Lahir', 'Status']],
    body:
      detail.children.length === 0
        ? [['-', '-', 'Belum ada anak tercatat', '-', '-']]
        : detail.children.map((ch, idx) => [
            ch.relation.urutan_anak || idx + 1,
            ch.child.kode_silsilah || ch.child.id_anggota,
            [ch.child.gelar_depan, ch.child.nama_lengkap, ch.child.gelar_belakang].filter(Boolean).join(' '),
            `${ch.child.tempat_lahir || '-'}, ${ch.child.tanggal_lahir || '-'}`,
            `${ch.child.status_keturunan} | ${ch.child.status_hidup}`,
          ]).map((r) => r.map(safePdfText)),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.1 },
    headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 18, halign: 'center' }, 1: { cellWidth: 28 } },
  });
  y = (doc.lastAutoTable?.finalY ?? y + 25) + 6;

  // Section IV: Saudara & Rumah Tangga
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(24, 24, 27);
  doc.text(`IV. Saudara Sekandung/Se-Orang Tua (${detail.siblings.length}) & Rumah Tangga (${detail.households.length})`, margin, y);
  y += 2.5;

  const siblingRows =
    detail.siblings.length === 0
      ? [['Saudara', '-', 'Tidak ada data saudara tercatat']]
      : detail.siblings.map((s, idx) => [
          `Saudara #${idx + 1}`,
          s.kode_silsilah || s.id_anggota,
          `${[s.gelar_depan, s.nama_lengkap, s.gelar_belakang].filter(Boolean).join(' ')} (${s.generasi_label} | ${s.status_hidup})`,
        ]);

  const hhRows =
    detail.households.length === 0
      ? [['Rumah Tangga', '-', 'Belum tergabung dalam rumah tangga aktif']]
      : detail.households.map((hm) => [
          'Rumah Tangga',
          hm.id_rumah_tangga,
          `${hm.household?.nama_rumah_tangga || hm.id_rumah_tangga} (Peran: ${hm.peran_dalam_rt})`,
        ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, bottom: 16 },
    head: [['Kelompok', 'Kode / ID', 'Nama & Keterangan']],
    body: [...siblingRows, ...hhRows].map((r) => r.map(safePdfText)),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.1 },
    headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 34, fontStyle: 'bold' }, 1: { cellWidth: 32 } },
  });

  const finalY = doc.lastAutoTable?.finalY ?? y + 25;
  drawSignatureBlock(doc, finalY, 'Mengetahui, Ketua Paguyuban', 'Sekretariat / Pencatat Silsilah');
  stampPageFooters(doc);

  const safeSlug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  doc.save(`biodata_silsilah_${m.id_anggota}_${safeSlug || 'anggota'}.pdf`);
}
