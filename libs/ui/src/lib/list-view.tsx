'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DocFieldDefinition, DocTypeDefinition } from './types';
import { Button, Input, Skeleton } from './atoms';
import { StatusBadge } from './status-badge';
import {
    Plus,
    Search,
    ChevronRight,
    Filter,
    Download,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Columns3,
    Trash2,
    X,
    Check,
} from 'lucide-react';
import { cn } from './utils';

interface ListViewProps {
    docType: DocTypeDefinition;
    data?: any[];
    loading?: boolean;
    onRowClick?: (row: any) => void;
    onCreateClick?: () => void;
    onRefresh?: () => void;
    onBulkDelete?: (rows: any[]) => Promise<void> | void;
    onExport?: (rows: any[]) => Promise<void> | void;
}

type SortDir = 'asc' | 'desc' | null;
type FilterCondition = { fieldName: string; op: 'equals' | 'contains' | 'gt' | 'lt' | 'not'; value: string };

function defaultColumnNames(docType: DocTypeDefinition): string[] {
    const fields = docType.fields.filter((f) => !f.hidden && !f.type.startsWith('Text') && f.type !== 'Table' && f.type !== 'Code');
    return ['name', ...fields.slice(0, 4).map((f) => f.name)];
}

export const ListView = ({
    docType,
    data = [],
    loading = false,
    onRowClick,
    onCreateClick,
    onRefresh,
    onBulkDelete,
    onExport,
}: ListViewProps) => {
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<{ id: string; dir: SortDir }>({ id: 'name', dir: null });
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [filterOpen, setFilterOpen] = useState(false);
    const [columnsOpen, setColumnsOpen] = useState(false);
    const [conditions, setConditions] = useState<FilterCondition[]>([]);
    const [visibleColumns, setVisibleColumns] = useState<string[]>(() => defaultColumnNames(docType));

    const filterAnchor = useRef<HTMLButtonElement>(null);
    const columnsAnchor = useRef<HTMLButtonElement>(null);

    // Close popovers on outside click
    useEffect(() => {
        if (!filterOpen && !columnsOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (filterOpen && filterAnchor.current && !filterAnchor.current.contains(target)) {
                const popover = document.getElementById('listview-filter-popover');
                if (popover && !popover.contains(target)) setFilterOpen(false);
            }
            if (columnsOpen && columnsAnchor.current && !columnsAnchor.current.contains(target)) {
                const popover = document.getElementById('listview-columns-popover');
                if (popover && !popover.contains(target)) setColumnsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [filterOpen, columnsOpen]);

    const allSelectableFields = useMemo(
        () => docType.fields.filter((f) => !f.hidden && f.type !== 'Table' && f.type !== 'Code'),
        [docType]
    );

    const columns = useMemo(() => {
        const base: Array<{ name: string; label: string; type: string }> = [{ name: 'name', label: 'ID', type: 'Data' }];
        const byName = new Map(allSelectableFields.map((f) => [f.name, f]));
        for (const colName of visibleColumns) {
            if (colName === 'name') continue;
            const f = byName.get(colName);
            if (f) base.push({ name: f.name, label: f.label, type: f.type });
        }
        return base;
    }, [allSelectableFields, visibleColumns]);

    const filteredData = useMemo(() => {
        let result = data;
        if (search) {
            const q = search.toLowerCase();
            result = result.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
        }
        if (conditions.length > 0) {
            result = result.filter((row) => conditions.every((c) => evalCondition(row, c)));
        }
        if (sort.dir) {
            const sorted = [...result];
            sorted.sort((a, b) => {
                const av = a?.[sort.id];
                const bv = b?.[sort.id];
                if (av == null && bv == null) return 0;
                if (av == null) return 1;
                if (bv == null) return -1;
                if (typeof av === 'number' && typeof bv === 'number') return sort.dir === 'asc' ? av - bv : bv - av;
                const as = String(av).toLowerCase();
                const bs = String(bv).toLowerCase();
                return sort.dir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
            });
            return sorted;
        }
        return result;
    }, [data, search, conditions, sort]);

    const allRowIds = useMemo(() => filteredData.map((r) => r.name).filter(Boolean) as string[], [filteredData]);
    const allSelected = allRowIds.length > 0 && allRowIds.every((id) => selected.has(id));
    const someSelected = !allSelected && allRowIds.some((id) => selected.has(id));

    const headerCheckboxRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = someSelected;
    }, [someSelected]);

    const toggleAll = () => {
        if (allSelected) {
            const next = new Set(selected);
            allRowIds.forEach((id) => next.delete(id));
            setSelected(next);
        } else {
            const next = new Set(selected);
            allRowIds.forEach((id) => next.add(id));
            setSelected(next);
        }
    };

    const toggleOne = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelected(next);
    };

    const onHeaderClick = (col: { name: string }) => {
        if (sort.id === col.name) {
            setSort({ id: col.name, dir: sort.dir === 'asc' ? 'desc' : sort.dir === 'desc' ? null : 'asc' });
        } else {
            setSort({ id: col.name, dir: 'asc' });
        }
    };

    const handleBulkDelete = async () => {
        const rows = filteredData.filter((r) => selected.has(r.name));
        if (!rows.length) return;
        if (onBulkDelete) await onBulkDelete(rows);
        setSelected(new Set());
    };

    const handleExport = async () => {
        const rows = selected.size > 0 ? filteredData.filter((r) => selected.has(r.name)) : filteredData;
        if (onExport) await onExport(rows);
        else exportToCSV(rows, columns, docType.name);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/30 dark:bg-slate-900/20 py-6 px-6 lg:px-8 min-h-screen">
            {/* Header Section */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{docType.name}</h1>
                    <p className="text-sm text-slate-500 mt-1">{docType.description || `Manage and view ${docType.name} records`}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="hidden sm:flex" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" /> Export
                    </Button>
                    <Button onClick={() => onCreateClick?.()} size="sm">
                        <Plus className="mr-2 h-4 w-4" /> Create {docType.name}
                    </Button>
                </div>
            </header>

            {/* Filter Toolbar */}
            <div className="relative flex items-center space-x-2 bg-white/90 dark:bg-slate-950/70 p-2 rounded-xl border border-border/70 shadow-sm mb-4 backdrop-blur">
                <Search className="h-4 w-4 text-slate-400 ml-2" />
                <Input
                    className="border-none shadow-none focus-visible:ring-0 h-8 bg-transparent"
                    placeholder={`Search ${docType.name}...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <div className="h-4 w-px bg-slate-200 mx-2" />
                <Button
                    ref={filterAnchor}
                    variant={conditions.length > 0 ? 'default' : 'ghost'}
                    size="sm"
                    className={conditions.length > 0 ? '' : 'text-slate-500'}
                    onClick={() => {
                        setFilterOpen((v) => !v);
                        setColumnsOpen(false);
                    }}
                    aria-haspopup="menu"
                    aria-expanded={filterOpen}
                >
                    <Filter className="h-4 w-4 mr-2" /> Filter
                    {conditions.length > 0 && (
                        <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-white/30 px-1 text-[10px]">
                            {conditions.length}
                        </span>
                    )}
                </Button>
                <Button
                    variant={sort.dir ? 'default' : 'ghost'}
                    size="sm"
                    className={sort.dir ? '' : 'text-slate-500'}
                    onClick={() => {
                        // Cycle sort direction on the currently sorted column, or reset to first sortable column
                        if (sort.dir === 'asc') setSort({ id: sort.id, dir: 'desc' });
                        else if (sort.dir === 'desc') setSort({ id: sort.id, dir: null });
                        else setSort({ id: 'name', dir: 'asc' });
                    }}
                    title={sort.dir ? `Sorted by ${sort.id} (${sort.dir})` : 'Sort by ID asc'}
                >
                    {sort.dir === 'asc' ? (
                        <ArrowUp className="h-4 w-4 mr-2" />
                    ) : sort.dir === 'desc' ? (
                        <ArrowDown className="h-4 w-4 mr-2" />
                    ) : (
                        <ArrowUpDown className="h-4 w-4 mr-2" />
                    )}
                    Sort
                </Button>
                <Button
                    ref={columnsAnchor}
                    variant="ghost"
                    size="sm"
                    className="text-slate-500"
                    onClick={() => {
                        setColumnsOpen((v) => !v);
                        setFilterOpen(false);
                    }}
                    aria-haspopup="menu"
                    aria-expanded={columnsOpen}
                >
                    <Columns3 className="h-4 w-4 mr-2" /> Columns
                </Button>

                {filterOpen && (
                    <div
                        id="listview-filter-popover"
                        className="absolute right-2 top-full z-30 mt-2 w-[400px] rounded-xl border border-border/80 bg-popover p-3 shadow-lg"
                    >
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filters</span>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setConditions([])}
                                disabled={conditions.length === 0}
                                className="h-7 text-xs"
                            >
                                Reset
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {conditions.map((c, idx) => (
                                <ConditionRow
                                    key={idx}
                                    condition={c}
                                    fields={allSelectableFields}
                                    onChange={(next) =>
                                        setConditions((prev) => prev.map((p, i) => (i === idx ? next : p)))
                                    }
                                    onRemove={() => setConditions((prev) => prev.filter((_, i) => i !== idx))}
                                />
                            ))}
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full"
                                onClick={() =>
                                    setConditions((prev) => [
                                        ...prev,
                                        { fieldName: allSelectableFields[0]?.name ?? 'name', op: 'contains', value: '' },
                                    ])
                                }
                            >
                                <Plus className="mr-1 h-3.5 w-3.5" /> Add condition
                            </Button>
                        </div>
                    </div>
                )}

                {columnsOpen && (
                    <div
                        id="listview-columns-popover"
                        className="absolute right-2 top-full z-30 mt-2 w-[280px] rounded-xl border border-border/80 bg-popover p-3 shadow-lg"
                    >
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Visible columns</div>
                        <div className="max-h-[280px] space-y-1 overflow-auto">
                            {allSelectableFields.map((f) => {
                                const checked = visibleColumns.includes(f.name);
                                return (
                                    <label
                                        key={f.name}
                                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() =>
                                                setVisibleColumns((prev) =>
                                                    checked ? prev.filter((n) => n !== f.name) : [...prev, f.name]
                                                )
                                            }
                                            className="h-4 w-4 rounded"
                                        />
                                        <span className="flex-1">{f.label}</span>
                                        <span className="text-[10px] uppercase text-muted-foreground">{f.type}</span>
                                    </label>
                                );
                            })}
                        </div>
                        <div className="mt-2 flex justify-end gap-1.5">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => setVisibleColumns(defaultColumnNames(docType))}
                            >
                                Reset
                            </Button>
                            <Button size="sm" className="h-7 text-xs" onClick={() => setColumnsOpen(false)}>
                                Done
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Bulk action bar */}
            {selected.size > 0 && (
                <div className="mb-3 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
                    <span className="font-medium text-primary">{selected.size} selected</span>
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={handleExport}>
                            <Download className="mr-1.5 h-3.5 w-3.5" /> Export
                        </Button>
                        {onBulkDelete && (
                            <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                            </Button>
                        )}
                        <button
                            onClick={() => setSelected(new Set())}
                            className="text-xs text-muted-foreground hover:text-foreground"
                            title="Clear selection"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Data Grid */}
            <div className="rounded-2xl border border-border/70 bg-white dark:bg-slate-950 shadow-sm overflow-hidden flex-1">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="sticky top-0 z-[2] bg-slate-50/95 backdrop-blur dark:bg-slate-900/90">
                            <tr className="border-b">
                                <th className="w-10 px-3">
                                    <input
                                        ref={headerCheckboxRef}
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={toggleAll}
                                        aria-label="Select all rows"
                                        className="h-4 w-4 cursor-pointer rounded"
                                    />
                                </th>
                                {columns.map((c) => (
                                    <th
                                        key={c.name}
                                        className="h-10 px-4 font-medium text-slate-500 dark:text-slate-400 align-middle whitespace-nowrap"
                                        aria-sort={sort.id === c.name && sort.dir ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => onHeaderClick(c)}
                                            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
                                        >
                                            {c.label}
                                            {sort.id === c.name && sort.dir === 'asc' ? (
                                                <ArrowUp className="h-3 w-3" />
                                            ) : sort.id === c.name && sort.dir === 'desc' ? (
                                                <ArrowDown className="h-3 w-3" />
                                            ) : (
                                                <ArrowUpDown className="h-3 w-3 opacity-30" />
                                            )}
                                        </button>
                                    </th>
                                ))}
                                <th className="h-10 px-4 font-medium text-slate-500">Status</th>
                                <th className="w-[50px]"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading &&
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}>
                                        <td className="p-4">
                                            <Skeleton className="h-4 w-4" />
                                        </td>
                                        {columns.map((c) => (
                                            <td key={c.name} className="p-4">
                                                <Skeleton className="h-4 w-[100px]" />
                                            </td>
                                        ))}
                                        <td className="p-4">
                                            <Skeleton className="h-4 w-[60px]" />
                                        </td>
                                        <td className="p-4"></td>
                                    </tr>
                                ))}

                            {!loading && filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={columns.length + 3} className="h-32 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <Search className="h-8 w-8 opacity-20" />
                                            <p>{search || conditions.length > 0 ? 'No records match your filters.' : 'No records found.'}</p>
                                            {search || conditions.length > 0 ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setSearch('');
                                                        setConditions([]);
                                                    }}
                                                >
                                                    Clear filters
                                                </Button>
                                            ) : (
                                                <Button size="sm" variant="outline" onClick={() => onCreateClick?.()}>
                                                    <Plus className="mr-2 h-4 w-4" /> New {docType.name}
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {filteredData.map((row, i) => {
                                const id = row.name as string;
                                const isSelected = selected.has(id);
                                return (
                                    <tr
                                        key={id || i}
                                        className={cn(
                                            'group transition-colors cursor-pointer border-b last:border-0',
                                            isSelected ? 'bg-primary/5' : 'hover:bg-slate-50 dark:hover:bg-slate-900'
                                        )}
                                        onClick={() => onRowClick?.(row)}
                                    >
                                        <td className="px-3" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => id && toggleOne(id)}
                                                aria-label={`Select ${id || 'row'}`}
                                                className="h-4 w-4 cursor-pointer rounded"
                                            />
                                        </td>
                                        {columns.map((c) => (
                                            <td key={c.name} className="p-4 align-middle text-slate-700 dark:text-slate-300">
                                                {renderCell(c, row[c.name])}
                                            </td>
                                        ))}
                                        <td className="p-4 align-middle">
                                            <DocStatusBadge value={row.docstatus} />
                                        </td>
                                        <td className="p-4 text-right">
                                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-8 w-8">
                                                <ChevronRight className="h-4 w-4 text-slate-400" />
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <div>
                    Showing {filteredData.length} record{filteredData.length === 1 ? '' : 's'}
                    {data.length !== filteredData.length && <> of {data.length}</>}
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled>
                        Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled>
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
};

interface ConditionRowProps {
    condition: FilterCondition;
    fields: DocFieldDefinition[];
    onChange: (next: FilterCondition) => void;
    onRemove: () => void;
}

function ConditionRow({ condition, fields, onChange, onRemove }: ConditionRowProps) {
    return (
        <div className="flex items-center gap-1.5">
            <select
                value={condition.fieldName}
                onChange={(e) => onChange({ ...condition, fieldName: e.target.value })}
                className="h-8 flex-1 rounded border border-input bg-background px-2 text-xs"
            >
                {fields.map((f) => (
                    <option key={f.name} value={f.name}>
                        {f.label}
                    </option>
                ))}
            </select>
            <select
                value={condition.op}
                onChange={(e) => onChange({ ...condition, op: e.target.value as FilterCondition['op'] })}
                className="h-8 w-24 rounded border border-input bg-background px-2 text-xs"
            >
                <option value="contains">contains</option>
                <option value="equals">equals</option>
                <option value="not">not equals</option>
                <option value="gt">{'>'}</option>
                <option value="lt">{'<'}</option>
            </select>
            <Input
                value={condition.value}
                onChange={(e) => onChange({ ...condition, value: e.target.value })}
                className="h-8 flex-1 text-xs"
                placeholder="Value"
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
                <X className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}

function evalCondition(row: any, c: FilterCondition): boolean {
    const v = row?.[c.fieldName];
    if (v == null) return c.op === 'not' ? c.value !== '' : false;
    const s = String(v).toLowerCase();
    const t = c.value.toLowerCase();
    switch (c.op) {
        case 'contains':
            return s.includes(t);
        case 'equals':
            return s === t;
        case 'not':
            return s !== t;
        case 'gt':
            return Number(v) > Number(c.value);
        case 'lt':
            return Number(v) < Number(c.value);
    }
}

function exportToCSV(rows: any[], columns: { name: string; label: string }[], docType: string) {
    if (typeof window === 'undefined' || !rows.length) return;
    const headers = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',');
    const body = rows
        .map((row) =>
            columns
                .map((c) => {
                    const v = row?.[c.name];
                    if (v == null) return '';
                    const str = String(v).replace(/"/g, '""');
                    return `"${str}"`;
                })
                .join(',')
        )
        .join('\n');
    const csv = `${headers}\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${docType.toLowerCase().replace(/\s+/g, '_')}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

const renderCell = (field: any, value: any) => {
    if (value === null || value === undefined) return <span className="text-slate-400">-</span>;
    if (field.type === 'Check') return value ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-slate-300" />;
    if (field.type === 'Date') return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    if (field.type === 'Currency')
        return (
            <span className="font-mono text-slate-600">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}
            </span>
        );
    if (field.name === 'name') return <span className="font-medium text-primary">{value}</span>;
    return <span className="truncate max-w-[200px] block">{String(value)}</span>;
};

const DocStatusBadge = ({ value }: { value: number }) => {
    const status = value === 0 ? 'DRAFT' : value === 1 ? 'SUBMITTED' : value === 2 ? 'CANCELLED' : 'UNKNOWN';
    return <StatusBadge kind="doctype" status={status} />;
};
