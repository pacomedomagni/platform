import React, { useState } from 'react';
import { cn } from './utils';
import { 
    LayoutDashboard, 
    Settings, 
    Menu, 
    Search,
    Bell,
    User as UserIcon,
    ChevronLeft,
    Box,
    FileText,
    Users
} from 'lucide-react';
import { Button } from './atoms';
import { GlobalCommandBar } from './global-command-bar';

interface NavItem {
    label: string;
    icon: React.ElementType;
    href: string;
    isActive?: boolean;
}

interface AppShellProps {
    children: React.ReactNode;
    navItems?: NavItem[];
    user?: { name: string; email: string; avatar?: string };
    title?: string;
    description?: string;
}

const defaultNavItems: NavItem[] = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/app', isActive: true },
    { label: 'Modules', icon: Box, href: '/app/modules' },
    { label: 'Documents', icon: FileText, href: '/app/documents' },
    { label: 'Users', icon: Users, href: '/app/users' },
    { label: 'Settings', icon: Settings, href: '/app/settings' },
];

export const AppShell = ({ 
    children, 
    navItems = defaultNavItems,
    user = { name: 'Demo User', email: 'demo@noslag.com' },
    title = 'NoSlag',
    description = 'Enterprise Platform'
}: AppShellProps) => {
    const [collapsed, setCollapsed] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    return (
        <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <GlobalCommandBar open={searchOpen} onOpenChange={setSearchOpen} />
            {/* Sidebar */}
            <aside 
                className={cn(
                    "flex flex-col border-r bg-white dark:bg-slate-900 transition-all duration-300 ease-in-out z-20",
                    collapsed ? "w-16" : "w-64"
                )}
            >
                {/* Sidebar Header */}
                <div className="h-14 flex items-center px-4 border-b shrink-0">
                    <div className={cn("flex items-center gap-2 font-bold text-xl text-primary transition-opacity overflow-hidden", collapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
                        <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
                            N
                        </div>
                        <span className="truncate">{title}</span>
                    </div>
                    {collapsed && (
                         <div className="mx-auto h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
                            N
                        </div>
                    )}
                </div>

                {/* Sidebar Nav */}
                <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
                    {navItems.map((item) => (
                        <a 
                            key={item.label}
                            href={item.href} 
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors relative group",
                                item.isActive 
                                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300" 
                                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                            )}
                        >
                            <item.icon className={cn("h-5 w-5 shrink-0 transition-colors", item.isActive ? "text-indigo-600" : "text-slate-500")} />
                            <span 
                                className={cn(
                                    "transition-all duration-300 whitespace-nowrap overflow-hidden",
                                    collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                                )}
                            >
                                {item.label}
                            </span>
                            
                            {/* Tooltip for collapsed state */}
                            {collapsed && (
                                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                    {item.label}
                                </div>
                            )}
                        </a>
                    ))}
                </div>

                {/* Sidebar Footer */}
                <div className="p-4 border-t flex flex-col gap-4">
                     {/* User Profile Simplified */}
                     <div className={cn("flex items-center gap-3 transition-opacity overflow-hidden", collapsed && "justify-center")}>
                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 border">
                            <UserIcon className="h-4 w-4 text-slate-500" />
                        </div>
                        <div className={cn("flex flex-col overflow-hidden", collapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100")}>
                            <span className="text-sm font-medium text-slate-900 truncate">{user.name}</span>
                            <span className="text-xs text-slate-500 truncate">{user.email}</span>
                        </div>
                     </div>

                    <Button 
                        variant="ghost" 
                        size={collapsed ? "icon" : "sm"}
                        onClick={() => setCollapsed(!collapsed)}
                        className={cn("w-full", collapsed ? "" : "flex justify-center")}
                    >
                        {collapsed ? <ChevronLeft className="h-4 w-4 rotate-180" /> : <ChevronLeft className="h-4 w-4 mr-2" />}
                        {!collapsed && "Collapse Sidebar"}
                    </Button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 h-full relative">
                {/* Topbar */}
                <header className="h-14 border-b bg-white dark:bg-slate-900 flex items-center justify-between px-6 shrink-0 z-10 sticky top-0">
                    {/* Search / Global Command */}
                    <div className="flex items-center w-full max-w-md">
                        <div className="relative w-full" onClick={() => setSearchOpen(true)}>
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <div 
                                className="w-full pl-9 pr-4 py-1.5 h-9 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-500 cursor-text flex items-center dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                            >
                                Search everything (Ctrl+K)...
                            </div>
                        </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" className="relative text-slate-500 hover:text-slate-700">
                             <Bell className="h-5 w-5" />
                             <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full border border-white dark:border-slate-900"></span>
                        </Button>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth">
                    {children}
                </div>
            </main>
        </div>
    );
};
