'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Command, 
    Search, 
    FileText, 
    Users, 
    Package, 
    DollarSign,
    Settings,
    TrendingUp,
    Calculator,
    ArrowRight
} from 'lucide-react';
import { cn } from './utils';

interface CommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface CommandItem {
    id: string;
    label: string;
    description?: string;
    icon: any;
    action: () => void;
    keywords?: string[];
}

export const CommandPalette = ({ open, onOpenChange }: CommandPaletteProps) => {
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const router = useRouter();

    const commands: CommandItem[] = [
        // Quick Actions
        { id: 'new-so', label: 'New Sales Order', description: 'Create a new sales order', icon: FileText, action: () => router.push('/desk/Sales Order/new'), keywords: ['create', 'order'] },
        { id: 'new-invoice', label: 'New Invoice', description: 'Create a new invoice', icon: FileText, action: () => router.push('/desk/Invoice/new'), keywords: ['create', 'bill'] },
        { id: 'new-customer', label: 'New Customer', description: 'Add a new customer', icon: Users, action: () => router.push('/desk/Customer/new'), keywords: ['create', 'client'] },
        { id: 'new-item', label: 'New Item', description: 'Add a new product/item', icon: Package, action: () => router.push('/desk/Item/new'), keywords: ['create', 'product'] },
        
        // Navigation
        { id: 'nav-dashboard', label: 'Go to Dashboard', icon: TrendingUp, action: () => router.push('/desk'), keywords: ['home'] },
        { id: 'nav-sales', label: 'Sales Orders', icon: FileText, action: () => router.push('/desk/Sales Order'), keywords: ['orders'] },
        { id: 'nav-invoices', label: 'Invoices', icon: FileText, action: () => router.push('/desk/Invoice'), keywords: ['bills'] },
        { id: 'nav-customers', label: 'Customers', icon: Users, action: () => router.push('/desk/Customer'), keywords: ['clients'] },
        { id: 'nav-items', label: 'Items', icon: Package, action: () => router.push('/desk/Item'), keywords: ['products', 'inventory'] },
        { id: 'nav-accounting', label: 'Chart of Accounts', icon: DollarSign, action: () => router.push('/desk/Account'), keywords: ['accounts', 'gl'] },
        
        // Reports
        { id: 'report-bs', label: 'Balance Sheet', icon: Calculator, action: () => router.push('/desk/reports/balance-sheet'), keywords: ['financial', 'report'] },
        { id: 'report-pl', label: 'P&L Statement', icon: Calculator, action: () => router.push('/desk/reports/profit-loss'), keywords: ['financial', 'report', 'income'] },
        { id: 'report-cf', label: 'Cash Flow', icon: Calculator, action: () => router.push('/desk/reports/cash-flow'), keywords: ['financial', 'report'] },
        
        // Settings
        { id: 'settings', label: 'Settings', icon: Settings, action: () => router.push('/desk/settings'), keywords: ['config', 'preferences'] },
    ];

    const filteredCommands = search
        ? commands.filter(cmd => 
            cmd.label.toLowerCase().includes(search.toLowerCase()) ||
            cmd.description?.toLowerCase().includes(search.toLowerCase()) ||
            cmd.keywords?.some(k => k.includes(search.toLowerCase()))
        )
        : commands;

    // Keyboard navigation
    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(i => (i + 1) % filteredCommands.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                filteredCommands[selectedIndex]?.action();
                onOpenChange(false);
                setSearch('');
            } else if (e.key === 'Escape') {
                onOpenChange(false);
                setSearch('');
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, selectedIndex, filteredCommands, onOpenChange]);

    // Reset when opened
    useEffect(() => {
        if (open) {
            setSearch('');
            setSelectedIndex(0);
        }
    }, [open]);

    if (!open) return null;

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                onClick={() => onOpenChange(false)}
            />

            {/* Command Palette */}
            <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 px-4">
                <div className="bg-white dark:bg-slate-950 rounded-xl shadow-2xl border overflow-hidden">
                    {/* Search Input */}
                    <div className="flex items-center border-b px-4 py-3">
                        <Search className="h-5 w-5 text-slate-400 mr-3" />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Type a command or search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 bg-transparent outline-none text-sm"
                        />
                        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-slate-100 dark:bg-slate-800 px-1.5 font-mono text-[10px] font-medium text-slate-600 dark:text-slate-400">
                            ESC
                        </kbd>
                    </div>

                    {/* Commands List */}
                    <div className="max-h-[400px] overflow-y-auto p-2">
                        {filteredCommands.length === 0 ? (
                            <div className="py-12 text-center text-sm text-slate-500">
                                No commands found
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {filteredCommands.map((cmd, index) => (
                                    <button
                                        key={cmd.id}
                                        onClick={() => {
                                            cmd.action();
                                            onOpenChange(false);
                                            setSearch('');
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                                            index === selectedIndex
                                                ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                                                : "hover:bg-slate-100 dark:hover:bg-slate-900"
                                        )}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                    >
                                        <div className={cn(
                                            "w-9 h-9 rounded-lg flex items-center justify-center",
                                            index === selectedIndex
                                                ? "bg-blue-100 dark:bg-blue-900"
                                                : "bg-slate-100 dark:bg-slate-800"
                                        )}>
                                            <cmd.icon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium">{cmd.label}</div>
                                            {cmd.description && (
                                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                    {cmd.description}
                                                </div>
                                            )}
                                        </div>
                                        {index === selectedIndex && (
                                            <ArrowRight className="h-4 w-4 text-slate-400" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t px-4 py-2 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border rounded text-[10px]">↑↓</kbd>
                                Navigate
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border rounded text-[10px]">↵</kbd>
                                Select
                            </span>
                        </div>
                        <span>Powered by Noslag</span>
                    </div>
                </div>
            </div>
        </>
    );
};

export default CommandPalette;
