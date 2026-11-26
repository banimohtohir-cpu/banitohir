import React, { useRef, useState } from 'react';
import { Download, Printer, X } from 'lucide-react';
import { PdfSummaryItem } from '../utils/exportPdf';

interface PrintPreviewModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  orientation?: 'portrait' | 'landscape';
  summary?: PdfSummaryItem[];
  leftSignerTitle?: string;
  rightSignerTitle?: string;
  onDownloadPdf: () => void;
  onNotify?: (msg: string, kind?: 'success' | 'error') => void;
  children: React.ReactNode;
}

export function printElementViaIframe(
  el: HTMLElement | null,
  docTitle: string,
  orientation: 'portrait' | 'landscape' = 'portrait',
  onNotify?: (msg: string, kind?: 'success' | 'error') => void
) {
  if (!el) return;

  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      window.print();
      return;
    }

    const styleTags = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((node) => node.outerHTML)
      .join('\n');

    doc.open();
    doc.write(`<!doctype html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>${docTitle}</title>
  ${styleTags}
  <style>
    @page { size: A4 ${orientation}; margin: 12mm; }
    body { background: #ffffff !important; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>
  <div class="p-2 bg-white text-neutral-900">${el.innerHTML}</div>
</body>
</html>`);
    doc.close();

    window.setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        onNotify?.('Dialog cetak dibuka. Jika diblokir oleh browser/iframe, gunakan tombol Unduh PDF.');
      } catch {
        onNotify?.('Browser memblokir dialog cetak langsung. Gunakan tombol Unduh PDF untuk menyimpan file.', 'error');
      } finally {
        window.setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 1500);
      }
    }, 250);
  } catch {
    onNotify?.('Gunakan tombol Unduh PDF untuk menyimpan dokumen cetak resmi.', 'error');
  }
}

export function PrintPreviewModal({
  open,
  onClose,
  title,
  subtitle,
  orientation = 'portrait',
  summary,
  leftSignerTitle = 'Mengetahui, Ketua Paguyuban',
  rightSignerTitle = 'Sekretariat Paguyuban',
  onDownloadPdf,
  onNotify,
  children,
}: PrintPreviewModalProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  if (!open) return null;

  const todayDisplay = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  function handlePrintIframe() {
    printElementViaIframe(sheetRef.current, title, orientation, onNotify);
  }

  function handleDownload() {
    setDownloading(true);
    try {
      onDownloadPdf();
      onNotify?.(`PDF "${title}" berhasil dibuat dan diunduh.`);
    } catch (err) {
      onNotify?.(err instanceof Error ? err.message : 'Gagal membuat file PDF.', 'error');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/65 flex flex-col print:static print:bg-white">
      {/* Toolbar */}
      <div className="bg-white border-b border-neutral-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
        <div className="min-w-0">
          <div className="text-sm font-bold text-neutral-900 truncate">
            Konsep Format Cetak · {title}
          </div>
          <div className="text-[11px] text-neutral-500">
            Format Kertas A4 ({orientation === 'landscape' ? 'Lanskap / Mendatar' : 'Potret / Tegak'}) · Kop Resmi Paguyuban
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={downloading}
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading ? 'Menyusun PDF...' : 'Unduh PDF (.pdf)'}</span>
          </button>
          <button
            type="button"
            onClick={handlePrintIframe}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak ke Printer</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pratinjau cetak"
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Tutup</span>
          </button>
        </div>
      </div>

      {/* Sheet Preview Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-neutral-200/80 print:p-0 print:bg-white">
        <div
          ref={sheetRef}
          className={`mx-auto bg-white border border-neutral-300 shadow-sm p-6 sm:p-10 space-y-5 text-xs text-neutral-900 print:border-0 print:shadow-none print:p-0 ${
            orientation === 'landscape' ? 'max-w-[1060px]' : 'max-w-[800px]'
          }`}
        >
          {/* Formal Kop Surat Paguyuban */}
          <div className="border-b-4 border-double border-green-900 pb-4 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-lg bg-green-800 text-white font-bold text-sm flex items-center justify-center shrink-0">
                BMT
              </div>
              <div>
                <div className="text-sm sm:text-base font-bold text-green-900 uppercase tracking-tight">
                  Paguyuban Keluarga Besar Bani Haji Mohammad Tohir
                </div>
                <div className="text-[11px] text-neutral-600 mt-0.5">
                  Guyub, Akur, Semedulur · Sekretariat Pusat: Pangebatan, Karanglewas, Banyumas
                </div>
              </div>
            </div>
            <div className="text-right text-[11px] font-mono tabular-nums text-neutral-500">
              Dicetak: {todayDisplay}
            </div>
          </div>

          {/* Document Header */}
          <div>
            <h1 className="text-base font-bold text-neutral-900">{title}</h1>
            {subtitle && <p className="text-xs text-neutral-600 mt-0.5">{subtitle}</p>}
          </div>

          {/* Optional Summary Strip */}
          {summary && summary.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-neutral-50 border border-neutral-200 rounded-lg p-3">
              {summary.map((s) => (
                <div key={s.label}>
                  <div className="text-[11px] text-neutral-500">{s.label}</div>
                  <div className="font-mono font-bold text-green-900 tabular-nums mt-0.5">{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Document Body */}
          <div>{children}</div>

          {/* Signature Footer */}
          <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs break-inside-avoid">
            <div className="space-y-14">
              <div className="text-neutral-700">{leftSignerTitle}</div>
              <div className="font-bold text-neutral-900">( _________________________ )</div>
            </div>
            <div className="space-y-14">
              <div>
                <div className="text-neutral-600">Banyumas, {todayDisplay}</div>
                <div className="text-neutral-700 mt-0.5">{rightSignerTitle}</div>
              </div>
              <div className="font-bold text-neutral-900">( _________________________ )</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
