import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
  keywords?: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  required?: boolean;
  allowClear?: boolean;
  className?: string;
  compact?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Pilih opsi...',
  searchPlaceholder = 'Ketik untuk mencari...',
  emptyMessage = 'Tidak ada pilihan yang cocok.',
  disabled = false,
  required = false,
  allowClear = false,
  className = '',
  compact = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    const tokens = q.split(/\s+/).filter(Boolean);
    return options.filter((opt) => {
      const hay = `${opt.label} ${opt.sublabel || ''} ${opt.keywords || ''} ${opt.value}`.toLowerCase();
      return tokens.every((tok) => hay.includes(tok));
    });
  }, [options, query]);

  const visibleList = useMemo(() => filtered.slice(0, 120), [filtered]);

  useEffect(() => {
    setHighlightIdx(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  function selectValue(opt: SearchableOption) {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setQuery(e.key);
      setOpen(true);
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, Math.max(visibleList.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = visibleList[highlightIdx];
      if (target) selectValue(target);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  const pyClass = compact ? 'py-1.5' : 'py-2';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {required && (
        <input
          type="text"
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value}
          onChange={() => {}}
          className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
        />
      )}
      <div className="relative flex items-center">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen((prev) => !prev)}
          onKeyDown={handleTriggerKeyDown}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={`w-full flex items-center justify-between gap-2 px-3 ${pyClass} text-left text-xs border border-neutral-300 rounded-lg bg-white hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-700 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed cursor-pointer`}
        >
          <span className={`truncate ${selectedOption ? 'text-neutral-900 font-medium' : 'text-neutral-400'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {allowClear && value && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Hapus pilihan"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange('');
                }}
                className="p-0.5 text-neutral-400 hover:text-neutral-700 rounded cursor-pointer"
              >
                <X className="w-3 h-3" />
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
        </button>
      </div>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 mt-1 min-w-[230px] bg-white border border-neutral-300 rounded-lg shadow-lg z-50 overflow-hidden"
        >
          <div className="p-2 border-b border-neutral-200 bg-neutral-50">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-700"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  aria-label="Kosongkan pencarian"
                  className="absolute right-2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-neutral-100">
            {visibleList.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-neutral-500">{emptyMessage}</div>
            ) : (
              visibleList.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightIdx;
                return (
                  <button
                    key={`${opt.value}-${idx}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    onClick={() => selectValue(opt)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                      isSelected
                        ? 'bg-green-50 text-green-900 font-semibold'
                        : isHighlighted
                        ? 'bg-neutral-100 text-neutral-900'
                        : 'text-neutral-800 hover:bg-neutral-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{opt.label}</div>
                      {opt.sublabel && (
                        <div className="text-[11px] text-neutral-500 truncate font-mono">{opt.sublabel}</div>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-green-700 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {filtered.length > visibleList.length && (
            <div className="px-3 py-1.5 bg-neutral-50 border-t border-neutral-200 text-[11px] text-neutral-500 text-center">
              Menampilkan {visibleList.length} dari {filtered.length} hasil — ketik nama/kode untuk mempersempit
            </div>
          )}
        </div>
      )}
    </div>
  );
}
