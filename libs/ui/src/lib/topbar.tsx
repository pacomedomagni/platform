'use client';

import React, { useState } from 'react';
import { Search, Bell, Plus, Command, Moon, Sun } from 'lucide-react';
import { Button, Input } from './atoms';
import { cn } from './utils';

interface TopbarProps {
    onCommandOpen?: () => void;
    className?: string;
}

export const Topbar = ({ onCommandOpen, className }: TopbarProps) => {
    const [darkMode, setDarkMode] = useState(false);

    const toggleTheme = () => {
        setDarkMode(!darkMode);
        document.documentElement.classList.toggle('dark');
    };

    return (
        <header className={cn(
            "sticky top-0 z-50 w-full border-b bg-white/95 dark:bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-white/60",
            className
        )}>
            <div className="flex h-16 items-center px-6 gap-4">
                {/* Global Search */}
                <button 
                    onClick={onCommandOpen}
                    className="flex-1 max-w-md flex items-center gap-2 px-3 py-2 text-sm text-slate-500 bg-slate-100 dark:bg-slate-900 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                    <Search className="h-4 w-4" />
                    <span>Search or jump to...</span>
                    <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-slate-100 dark:bg-slate-800 px-1.5 font-mono text-xs font-medium text-slate-600 dark:text-slate-400">
                        <Command className="h-3 w-3" />K
                    </kbd>
                </button>

                <div className="flex-1" />

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="relative">
                        <Bell className="h-5 w-5" />
                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                    </Button>

                    <Button variant="ghost" size="icon" onClick={toggleTheme}>
                        {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </Button>

                    <Button size="sm" className="ml-2">
                        <Plus className="h-4 w-4 mr-2" />
                        New
                    </Button>
                </div>
            </div>
        </header>
    );
};

export default Topbar;
