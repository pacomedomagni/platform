'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@platform/ui";

const navItems = [
    { name: 'Home', href: '/' },
    { name: 'Sales Order', href: '/desk/Sales Order' },
    { name: 'Customer', href: '/desk/Customer' },
    { name: 'DocType', href: '/desk/DocType' }, // System Builder
    // Add more dynamically later
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="hidden border-r bg-gray-50/40 lg:block dark:bg-gray-800/40 w-[240px] flex-shrink-0">
            <div className="flex h-full max-h-screen flex-col gap-2">
                <div className="flex h-[60px] items-center border-b px-6">
                    <Link className="flex items-center gap-2 font-semibold" href="/">
                        <span>Noslag ERP</span>
                    </Link>
                </div>
                <div className="flex-1 overflow-auto py-2">
                    <nav className="grid items-start px-4 text-sm font-medium">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                                    (pathname === item.href || pathname.startsWith(item.href + '/')) 
                                        ? "bg-gray-100 text-primary dark:bg-gray-800"
                                        : "text-muted-foreground"
                                )}
                            >
                                {item.name}
                            </Link>
                        ))}
                    </nav>
                </div>
            </div>
        </div>
    );
}
