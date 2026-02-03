'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from './utils';
import { 
    LayoutDashboard, 
    ShoppingCart, 
    Package, 
    Users, 
    FileText, 
    CreditCard, 
    TrendingUp,
    Settings,
    ChevronLeft,
    ChevronRight,
    Menu,
    Building2,
    Warehouse,
    ClipboardList,
    DollarSign,
    BarChart3,
    UserCircle,
    LogOut,
    Search,
    Bell,
    Plus
} from 'lucide-react';
import { Button } from './atoms';

interface NavItem {
    label: string;
    icon: any;
    href: string;
    badge?: string;
    children?: NavItem[];
}

const navigation: NavItem[] = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/desk' },
    { 
        label: 'Sales', 
        icon: TrendingUp, 
        href: '/desk/sales',
        children: [
            { label: 'Sales Order', icon: FileText, href: '/desk/Sales Order' },
            { label: 'Invoice', icon: FileText, href: '/desk/Invoice' },
            { label: 'Customer', icon: Users, href: '/desk/Customer' },
        ]
    },
    { 
        label: 'Stock', 
        icon: Package, 
        href: '/desk/stock',
        children: [
            { label: 'Items', icon: Package, href: '/desk/Item' },
            { label: 'Warehouse', icon: Warehouse, href: '/desk/Warehouse' },
            { label: 'Purchase Receipt', icon: ClipboardList, href: '/desk/Purchase Receipt' },
            { label: 'Delivery Note', icon: ClipboardList, href: '/desk/Delivery Note' },
            { label: 'Stock Ledger', icon: BarChart3, href: '/desk/Stock Ledger Entry' },
        ]
    },
    { 
        label: 'Accounting', 
        icon: DollarSign, 
        href: '/desk/accounting',
        children: [
            { label: 'Chart of Accounts', icon: FileText, href: '/desk/Account' },
            { label: 'Journal Entry', icon: FileText, href: '/desk/Journal Entry' },
            { label: 'Payment Entry', icon: CreditCard, href: '/desk/Payment Entry' },
            { label: 'GL Entry', icon: BarChart3, href: '/desk/GL Entry' },
        ]
    },
    { 
        label: 'Reports', 
        icon: BarChart3, 
        href: '/desk/reports',
        children: [
            { label: 'Balance Sheet', icon: FileText, href: '/desk/reports/balance-sheet' },
            { label: 'P&L Statement', icon: FileText, href: '/desk/reports/profit-loss' },
            { label: 'Cash Flow', icon: FileText, href: '/desk/reports/cash-flow' },
            { label: 'Trial Balance', icon: FileText, href: '/desk/reports/trial-balance' },
        ]
    },
    { label: 'Settings', icon: Settings, href: '/desk/settings' },
];

interface SidebarProps {
    className?: string;
}

export const Sidebar = ({ className }: SidebarProps) => {
    const [collapsed, setCollapsed] = useState(false);
    const [expandedSections, setExpandedSections] = useState<string[]>(['Sales', 'Accounting']);
    const pathname = usePathname();

    const toggleSection = (label: string) => {
        setExpandedSections(prev => 
            prev.includes(label) 
                ? prev.filter(s => s !== label)
                : [...prev, label]
        );
    };

    return (
        <aside className={cn(
            "flex flex-col border-r bg-white dark:bg-slate-950 transition-all duration-300",
            collapsed ? "w-16" : "w-64",
            className
        )}>
            {/* Brand Header */}
            <div className="flex items-center justify-between h-16 px-4 border-b">
                {!collapsed && (
                    <Link href="/desk" className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-violet-600 rounded-lg flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-semibold text-lg">Noslag ERP</span>
                    </Link>
                )}
                <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setCollapsed(!collapsed)}
                    className="h-8 w-8"
                >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-2">
                <ul className="space-y-1">
                    {navigation.map((item) => (
                        <NavItemComponent 
                            key={item.href} 
                            item={item} 
                            collapsed={collapsed}
                            expanded={expandedSections.includes(item.label)}
                            onToggle={() => toggleSection(item.label)}
                            pathname={pathname}
                        />
                    ))}
                </ul>
            </nav>

            {/* User Section */}
            <div className="border-t p-3">
                {!collapsed ? (
                    <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
                            <UserCircle className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">Admin User</p>
                            <p className="text-xs text-slate-500 truncate">admin@noslag.com</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <Button variant="ghost" size="icon" className="w-full">
                        <UserCircle className="h-5 w-5" />
                    </Button>
                )}
            </div>
        </aside>
    );
};

interface NavItemComponentProps {
    item: NavItem;
    collapsed: boolean;
    expanded: boolean;
    onToggle: () => void;
    pathname: string;
}

const NavItemComponent = ({ item, collapsed, expanded, onToggle, pathname }: NavItemComponentProps) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
    const hasChildren = item.children && item.children.length > 0;

    return (
        <li>
            <Link 
                href={hasChildren ? '#' : item.href}
                onClick={(e) => {
                    if (hasChildren) {
                        e.preventDefault();
                        onToggle();
                    }
                }}
                className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive 
                        ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300" 
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900",
                    collapsed && "justify-center"
                )}
            >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && (
                    <>
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded-full">
                                {item.badge}
                            </span>
                        )}
                        {hasChildren && (
                            <ChevronRight className={cn(
                                "h-4 w-4 transition-transform",
                                expanded && "transform rotate-90"
                            )} />
                        )}
                    </>
                )}
            </Link>
            
            {/* Children */}
            {hasChildren && !collapsed && expanded && (
                <ul className="mt-1 ml-4 space-y-1 border-l pl-4">
                    {item.children!.map((child) => (
                        <li key={child.href}>
                            <Link 
                                href={child.href}
                                className={cn(
                                    "flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                                    pathname === child.href || pathname.startsWith(child.href + '/')
                                        ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
                                )}
                            >
                                <child.icon className="h-4 w-4" />
                                <span>{child.label}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
};

export default Sidebar;
