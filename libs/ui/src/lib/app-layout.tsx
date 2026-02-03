'use client';

import React, { useState } from 'react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { CommandPalette } from './command-palette';

interface AppLayoutProps {
    children: React.ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
    const [commandOpen, setCommandOpen] = useState(false);

    // Keyboard shortcut listener
    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setCommandOpen(true);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900">
            <Sidebar />
            
            <div className="flex-1 flex flex-col overflow-hidden">
                <Topbar onCommandOpen={() => setCommandOpen(true)} />
                
                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>

            <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
        </div>
    );
};

export default AppLayout;
