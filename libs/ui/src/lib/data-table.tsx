'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Skeleton } from './atoms';
import { cn } from './utils';

export type SortDir = 'asc' | 'desc' | null;

export interface DataTableColumn<T> {
  id: string;
  header: React.ReactNode;
  cell: (row: T, idx: number) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: string;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  refreshing?: boolean;
  empty?: React.ReactNode;
  onRowClick?: (row: T) => void;

  // sort
  sort?: { id: string; dir: SortDir };
  onSortChange?: (next: { id: string; dir: SortDir }) => void;

  // selection
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  bulkActions?: (selectedIds: string[]) => React.ReactNode;

  // sticky header
  stickyHeader?: boolean;
  className?: string;
  /** Tailwind height class for the scroll viewport. Default: max-h-[70vh] */
  maxHeightClassName?: string;
}

function nextSortDir(current: SortDir): SortDir {
  if (current === null) return 'asc';
  if (current === 'asc') return 'desc';
  return null;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  refreshing,
  empty,
  onRowClick,
  sort,
  onSortChange,
  selectable,
  selectedIds = [],
  onSelectionChange,
  bulkActions,
  stickyHeader = true,
  className,
  maxHeightClassName = 'max-h-[70vh]',
}: DataTableProps<T>) {
  const allIds = React.useMemo(() => rows.map(rowKey), [rows, rowKey]);
  const allSelected = selectable && allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));
  const someSelected = selectable && selectedIds.length > 0 && !allSelected;

  const headerRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (headerRef.current) headerRef.current.indeterminate = !!someSelected;
  }, [someSelected]);

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) onSelectionChange(selectedIds.filter((id) => !allIds.includes(id)));
    else onSelectionChange(Array.from(new Set([...selectedIds, ...allIds])));
  };

  const toggleOne = (id: string) => {
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) onSelectionChange(selectedIds.filter((x) => x !== id));
    else onSelectionChange([...selectedIds, id]);
  };

  const handleSort = (col: DataTableColumn<T>) => {
    if (!col.sortable || !onSortChange) return;
    const currentDir = sort?.id === col.id ? sort.dir : null;
    onSortChange({ id: col.id, dir: nextSortDir(currentDir) });
  };

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm', className)}>
      {selectable && selectedIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-primary/5 px-4 py-2 text-sm">
          <span className="font-medium text-primary">
            {selectedIds.length} selected
          </span>
          <div className="flex items-center gap-2">
            {bulkActions?.(selectedIds)}
            <button
              type="button"
              onClick={() => onSelectionChange?.([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {refreshing && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-primary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> Refreshing
        </div>
      )}

      <div className={cn('overflow-auto', maxHeightClassName)}>
        <table className="w-full text-sm">
          <thead
            className={cn(
              'bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground',
              stickyHeader && 'sticky top-0 z-[5] backdrop-blur'
            )}
          >
            <tr>
              {selectable && (
                <th className="w-10 px-3 py-2.5 text-left">
                  <input
                    ref={headerRef}
                    type="checkbox"
                    checked={!!allSelected}
                    onChange={toggleAll}
                    aria-label="Select all rows"
                    className="h-4 w-4 cursor-pointer rounded border-border/70 text-primary focus:ring-primary/30"
                  />
                </th>
              )}
              {columns.map((col) => {
                const isSorted = sort?.id === col.id && sort?.dir;
                return (
                  <th
                    key={col.id}
                    className={cn(
                      'px-3 py-2.5 text-left font-medium',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.headerClassName
                    )}
                    style={col.width ? { width: col.width } : undefined}
                    aria-sort={
                      isSorted ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : col.sortable ? 'none' : undefined
                    }
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col)}
                        className="inline-flex items-center gap-1.5 uppercase tracking-wide hover:text-foreground"
                      >
                        {col.header}
                        {sort?.id === col.id && sort.dir === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : sort?.id === col.id && sort.dir === 'desc' ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skel-${i}`}>
                    {selectable && (
                      <td className="px-3 py-3">
                        <Skeleton className="h-4 w-4" />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.id} className="px-3 py-3">
                        <Skeleton className="h-4 w-full max-w-[180px]" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.length === 0
              ? (
                <tr>
                  <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-12 text-center text-muted-foreground">
                    {empty ?? 'No results'}
                  </td>
                </tr>
              )
              : rows.map((row, idx) => {
                  const id = rowKey(row);
                  const selected = selectedIds.includes(id);
                  return (
                    <tr
                      key={id}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn(
                        'transition-colors hover:bg-muted/30',
                        onRowClick && 'cursor-pointer',
                        selected && 'bg-primary/5'
                      )}
                    >
                      {selectable && (
                        <td className="w-10 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleOne(id)}
                            aria-label={`Select row ${idx + 1}`}
                            className="h-4 w-4 cursor-pointer rounded border-border/70 text-primary focus:ring-primary/30"
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={col.id}
                          className={cn(
                            'px-3 py-2.5',
                            col.align === 'right' && 'text-right',
                            col.align === 'center' && 'text-center',
                            col.className
                          )}
                        >
                          {col.cell(row, idx)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
