'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@platform/ui';
import api from '../../../../lib/api';

/**
 * R-COMMON-1: typeahead for ID/code report filters. Reports historically
 * accepted free-text strings; typos returned an empty table with no
 * indication that the user got the code wrong.
 *
 * Strategy: lazily fetch the first N rows of the doctype on focus, then
 * filter client-side by prefix on the user's keystrokes. This is good
 * enough for typical inventory sizes (Items, Warehouses, Locations,
 * Accounts) — usually a few hundred records — and avoids a server-side
 * search endpoint we don't yet expose.
 *
 * If the user types something the suggestions don't include, the value is
 * still passed through unchanged (so they can still do exact lookups for
 * very large catalogs that exceed the prefetch limit).
 */
export interface CodeTypeaheadProps {
  /** DocType to fetch from `/v1/doc/<DocType>`. */
  docType: string;
  /** Field on each row that holds the code shown / used as the value. */
  codeField?: string;
  /** Optional label field shown next to the code in the suggestions. */
  labelField?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** How many records to prefetch from the doctype. Cap is 500 server-side. */
  prefetchLimit?: number;
}

interface DocRow extends Record<string, unknown> {
  name?: string;
}

export function CodeTypeahead({
  docType,
  codeField = 'name',
  labelField,
  value,
  onChange,
  placeholder,
  prefetchLimit = 200,
}: CodeTypeaheadProps) {
  const [rows, setRows] = useState<DocRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsId = useMemo(
    () => `code-typeahead-${docType.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`,
    [docType],
  );

  // Lazy fetch on first focus.
  const ensureLoaded = async () => {
    if (loaded) return;
    setLoaded(true);
    try {
      const res = await api.get(`/v1/doc/${encodeURIComponent(docType)}`, {
        params: { limit: prefetchLimit },
      });
      const data = Array.isArray(res.data) ? (res.data as DocRow[]) : [];
      setRows(data);
    } catch {
      // Silently fall back to a free-text input. The user can still type
      // a code; we just can't suggest one.
      setRows([]);
    }
  };

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const suggestions = useMemo(() => {
    if (!value) return rows.slice(0, 10);
    const needle = value.toLowerCase();
    return rows
      .filter((r) => {
        const code = String(r[codeField] ?? '').toLowerCase();
        const label = labelField ? String(r[labelField] ?? '').toLowerCase() : '';
        return code.includes(needle) || (label && label.includes(needle));
      })
      .slice(0, 10);
  }, [rows, value, codeField, labelField]);

  const choose = (row: DocRow) => {
    const code = String(row[codeField] ?? '');
    onChange(code);
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => {
          void ensureLoaded();
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter' && suggestions[highlight]) {
            e.preventDefault();
            choose(suggestions[highlight]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls={suggestionsId}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul
          id={suggestionsId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover shadow-md"
        >
          {suggestions.map((row, idx) => {
            const code = String(row[codeField] ?? '');
            const label = labelField ? String(row[labelField] ?? '') : '';
            return (
              <li
                key={`${code}-${idx}`}
                role="option"
                aria-selected={idx === highlight}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  idx === highlight ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(row);
                }}
                onMouseEnter={() => setHighlight(idx)}
              >
                <span className="font-medium">{code}</span>
                {label && <span className="ml-2 text-xs text-muted-foreground">{label}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
