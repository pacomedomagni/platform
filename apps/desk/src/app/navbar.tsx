'use client';

import { GlobalCommandBar } from "@platform/ui";

export function Navbar() {
    return (
        <header className="flex h-[60px] lg:h-[60px] items-center gap-4 border-b bg-gray-50/40 px-6 dark:bg-gray-800/40 sticky top-0 z-30 justify-between">
            <div className="w-full flex-1">
                 <GlobalCommandBar />
            </div>
            <div className="flex items-center gap-4">
                 {/* User Menu Placeholder */}
                 <div className="h-8 w-8 rounded-full bg-gray-200"></div>
            </div>
        </header>
    );
}
