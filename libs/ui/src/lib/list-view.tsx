'use client';
import React, { useState } from 'react';
import { DocFieldDefinition, DocTypeDefinition } from './types';
import { Button, Input, Badge, Skeleton } from './atoms';
import { Plus, Search, ChevronRight, Filter, Download, MoreHorizontal, ArrowUpDown } from 'lucide-react';
import { cn } from './utils';

interface ListViewProps {
    docType: DocTypeDefinition;
    data?: any[];
    loading?: boolean;
    onRowClick?: (row: any) => void;
    onCreateClick?: () => void;
    onRefresh?: () => void;
}

export const ListView = ({ docType, data = [], loading = false, onRowClick, onCreateClick, onRefresh }: ListViewProps) => {
    const [search, setSearch] = useState('');

    // Internal fallback fetch removed. Data is controlled by parent.

    // Columns config
    const availableFields = docType.fields.filter(f => !f.hidden && !f.type.startsWith('Text') && f.type !== 'Table' && f.type !== 'Code');
    
    // Smart column selection: always show ID, then pick first 4 prominent fields
    const columns = [
        { name: 'name', label: 'ID', type: 'Data', width: 'w-[150px]' }, 
        ...availableFields.slice(0, 4)
    ];

    // Add status if available (convention: docstatus field or 'status' field)
    const hasDocStatus = true; // Our system has docstatus by default now

    const filteredData = data.filter(row => 
        JSON.stringify(row).toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-slate-50/30 dark:bg-slate-900/20 py-6 px-6 lg:px-8 min-h-screen">
            {/* Header Section */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{docType.name}</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {docType.description || `Manage and view ${docType.name} records`}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="hidden sm:flex">
                        <Download className="mr-2 h-4 w-4" /> Export
                    </Button>
                    <Button onClick={() => onCreateClick?.()} size="sm">
                        <Plus className="mr-2 h-4 w-4" /> Create {docType.name}
                    </Button>
                </div>
            </header>

            {/* Filter Toolbar */}
            <div className="flex items-center space-x-2 bg-white/90 dark:bg-slate-950/70 p-2 rounded-xl border border-border/70 shadow-sm mb-4 backdrop-blur">
                <Search className="h-4 w-4 text-slate-400 ml-2" />
                <Input 
                    className="border-none shadow-none focus-visible:ring-0 h-8 bg-transparent" 
                    placeholder={`Search ${docType.name}...`} 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <div className="h-4 w-px bg-slate-200 mx-2" />
                <Button variant="ghost" size="sm" className="text-slate-500">
                    <Filter className="h-4 w-4 mr-2" /> Filter
                </Button>
                <Button variant="ghost" size="sm" className="text-slate-500">
                    <ArrowUpDown className="h-4 w-4 mr-2" /> Sort
                </Button>
            </div>

            {/* Data Grid */}
            <div className="rounded-2xl border border-border/70 bg-white dark:bg-slate-950 shadow-sm overflow-hidden flex-1">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b transition-colors">
                                {columns.map(c => (
                                    <th key={c.name} className="h-10 px-4 font-medium text-slate-500 dark:text-slate-400 align-middle whitespace-nowrap">
                                        {c.label}
                                    </th>
                                ))}
                                {hasDocStatus && <th className="h-10 px-4 font-medium text-slate-500">Status</th>}
                                <th className="w-[50px]"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading && Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i}>
                                    {columns.map(c => (
                                        <td key={c.name} className="p-4"><Skeleton className="h-4 w-[100px]" /></td>
                                    ))}
                                    <td className="p-4"><Skeleton className="h-4 w-[60px]" /></td>
                                    <td className="p-4"></td>
                                </tr>
                            ))}
                            
                            {!loading && filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={columns.length + 2} className="h-32 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <Search className="h-8 w-8 opacity-20" />
                                            <p>No records found.</p>
                                            <Button size="sm" variant="outline" onClick={() => onCreateClick?.()}>
                                                <Plus className="mr-2 h-4 w-4" /> New {docType.name}
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            
                            {filteredData.map((row, i) => (
                                <tr 
                                    key={row.name || i} 
                                    className="group hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer border-b last:border-0"
                                    onClick={() => onRowClick?.(row)}
                                >
                                    {columns.map(c => (
                                        <td key={c.name} className="p-4 align-middle text-slate-700 dark:text-slate-300">
                                            {renderCell(c, row[c.name])}
                                        </td>
                                    ))}
                                    {hasDocStatus && (
                                        <td className="p-4 align-middle">
                                            <StatusBadge status={row.docstatus} />
                                        </td>
                                    )}
                                    <td className="p-4 text-right">
                                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-8 w-8">
                                            <ChevronRight className="h-4 w-4 text-slate-400" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* simple footer */}
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                 <div>Showing {filteredData.length} records</div>
                 <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled>Previous</Button>
                    <Button variant="outline" size="sm" disabled>Next</Button>
                 </div>
            </div>
        </div>
    );
};

const renderCell = (field: any, value: any) => {
    if (value === null || value === undefined) return <span className="text-slate-400">-</span>;
    if (field.type === 'Check') return value ? 'Yes' : 'No';
    if (field.type === 'Date') return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    if (field.type === 'Currency') return <span className="font-mono text-slate-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}</span>;
    if (field.name === 'name') return <span className="font-medium text-primary">{value}</span>;
    return <span className="truncate max-w-[200px] block">{String(value)}</span>;
}

const StatusBadge = ({ status }: { status: number }) => {
    switch (status) {
        case 0: return <Badge variant="secondary">Draft</Badge>;
        case 1: return <Badge variant="success">Submitted</Badge>;
        case 2: return <Badge variant="destructive">Cancelled</Badge>;
        default: return <Badge variant="outline">Unknown</Badge>;
    }
}
