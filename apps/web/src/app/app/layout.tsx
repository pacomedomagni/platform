'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@platform/ui';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  ChevronDown,
  ChevronRight,
  Warehouse,
  ClipboardList,
  BarChart3,
  Hammer,
  FileText,
  Rocket,
  Store,
  Star,
  Palette,
  Globe,
  Wrench,
  Banknote,
} from 'lucide-react';

const PRIMARY_NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/app', isActive: true },
  { label: 'Earnings', icon: Banknote, href: '/app/earnings' },
  { label: 'Getting Started', icon: Rocket, href: '/app/getting-started' },
  { label: 'Products', icon: Package, href: '/app/products', section: 'Store' },
  { label: 'Orders', icon: ShoppingCart, href: '/app/orders', section: 'Store' },
  { label: 'Customers', icon: Users, href: '/app/customers', section: 'Store' },
  { label: 'Inventory', icon: Warehouse, href: '/app/inventory', section: 'Store' },
  { label: 'Marketplace', icon: Globe, href: '/app/marketplace/connections', section: 'Marketing' },
  { label: 'Reviews', icon: Star, href: '/app/reviews', section: 'Marketing' },
  { label: 'Operations', icon: Wrench, href: '/app/operations', section: 'Management' },
  { label: 'Reports', icon: BarChart3, href: '/app/reports/analytics', section: 'Management' },
  { label: 'Themes', icon: Palette, href: '/app/themes', section: 'Management' },
  { label: 'Settings', icon: Settings, href: '/app/settings', section: 'Management' },
];

const ADVANCED_NAV = [
  { label: 'Items', icon: Package, href: '/app/Item' },
  { label: 'Warehouses', icon: Warehouse, href: '/app/Warehouse' },
  { label: 'UOM', icon: Package, href: '/app/UOM' },
  { label: 'Locations', icon: Warehouse, href: '/app/Location' },
  { label: 'Purchase Orders', icon: ClipboardList, href: '/app/Purchase%20Order' },
  { label: 'Purchase Receipts', icon: ClipboardList, href: '/app/Purchase%20Receipt' },
  { label: 'Sales Orders', icon: ClipboardList, href: '/app/Sales%20Order' },
  { label: 'Invoices', icon: FileText, href: '/app/Invoice' },
  { label: 'Delivery Notes', icon: ClipboardList, href: '/app/Delivery%20Note' },
  { label: 'Stock Transfer', icon: ClipboardList, href: '/app/Stock%20Transfer' },
  { label: 'Stock Balance', icon: BarChart3, href: '/app/reports/stock-balance' },
  { label: 'Stock Ledger', icon: BarChart3, href: '/app/reports/stock-ledger' },
  { label: 'Trial Balance', icon: BarChart3, href: '/app/reports/trial-balance' },
  { label: 'Profit & Loss', icon: BarChart3, href: '/app/reports/profit-loss' },
  { label: 'Balance Sheet', icon: BarChart3, href: '/app/reports/balance-sheet' },
  { label: 'General Ledger', icon: BarChart3, href: '/app/reports/general-ledger' },
  { label: 'Cash Flow', icon: BarChart3, href: '/app/reports/cash-flow' },
  { label: 'Studio Builder', icon: Hammer, href: '/app/studio' },
  { label: 'Users', icon: Users, href: '/app/User' },
  { label: 'Setup', icon: Settings, href: '/app/setup' },
];

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const [showAdvanced, setShowAdvanced] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar_advanced') === 'true';
    }
    return false;
  });

  const [gettingStartedComplete, setGettingStartedComplete] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setGettingStartedComplete(localStorage.getItem('getting_started_step') === '6');
    }
  }, []);

  const user = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        return { name: parsed.name || parsed.email || 'User', email: parsed.email || '' };
      }
    } catch { /* ignore */ }
    return undefined;
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar_advanced', String(showAdvanced));
  }, [showAdvanced]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('tenantId');
    router.push('/login');
  }, [router]);

  const navItems = [
    ...PRIMARY_NAV.filter(
      (item) => !(item.label === 'Getting Started' && gettingStartedComplete)
    ),
    ...(showAdvanced ? ADVANCED_NAV : []),
  ];

  return (
    <AppShell
      navItems={navItems}
      title="NoSlag"
      description="Store Admin"
      user={user}
      onLogout={handleLogout}
      navFooter={
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          {showAdvanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {showAdvanced ? 'Hide Advanced' : 'Advanced (ERP)'}
        </button>
      }
    >
      {children}
    </AppShell>
  );
}
