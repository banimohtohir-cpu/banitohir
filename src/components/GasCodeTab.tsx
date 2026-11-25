import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, FileCode2 } from 'lucide-react';
import { GasFileItem } from '../types';

interface GasCodeTabProps {
  token: string;
  onNotify: (msg: string, kind?: 'success' | 'error') => void;
}

export function GasCodeTab({ token, onNotify }: GasCodeTabProps) {
  const [files, setFiles] = useState<GasFileItem[]>([]);
  const [selectedName, setSelectedName] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/gas-files', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setFiles(data.files);
        if (data.files.length > 0) setSelectedName(data.files[0].name);
      } else {
        onNotify(data.message || 'Gagal memuat file GAS.', 'error');
      }
    }
    load();
  }, [token]);

  const activeFile = files.find((f) => f.name === selectedName) || files[0];

  async function handleCopy() {
    if (!activeFile) return;
    await navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    onNotify(`Kode ${activeFile.name} disalin ke clipboard.`);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload(file: GasFileItem) {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
      <div className="bg-white border border-neutral-200 rounded-xl p-4 space-y-2 h-fit">
        <h2 className="text-sm font-bold text-neutral-900 px-2 pb-2 border-b border-neutral-200">
          Berkas Google Apps Script (Tahap 2)
        </h2>
        <div className="space-y-1">
          {files.map((f) => (
            <button
              key={f.name}
              type="button"
              onClick={() => setSelectedName(f.name)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-mono rounded-lg text-left transition-colors cursor-pointer ${
                activeFile?.name === f.name
                  ? 'bg-green-800 text-white font-semibold'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{f.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden flex flex-col min-w-0">
        {activeFile ? (
          <>
            <div className="px-5 py-3.5 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3 bg-neutral-50">
              <div>
                <div className="text-sm font-bold font-mono text-neutral-900">{activeFile.name}</div>
                <div className="text-xs text-neutral-500 tabular-nums">
                  {activeFile.content.split('\n').length} baris · Siap dipasang di Apps Script Editor
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-700 hover:bg-green-800 text-white rounded-lg cursor-pointer whitespace-nowrap"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tersalin' : 'Salin Kode'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(activeFile)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh File</span>
                </button>
              </div>
            </div>
            <pre className="p-5 text-xs font-mono text-neutral-800 overflow-x-auto max-h-[680px] leading-relaxed bg-white">
              <code>{activeFile.content}</code>
            </pre>
          </>
        ) : (
          <div className="p-8 text-sm text-neutral-500">Memuat berkas Google Apps Script...</div>
        )}
      </div>
    </div>
  );
}
