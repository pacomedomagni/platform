'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, GlobalCommandBar, type CommandRoute } from '@platform/ui';
import api from '@/lib/api';
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
  { label: 'Marketplace', icon: Globe, href: '/app/marketplace', section: 'Marketing' },
  { label: 'Reviews', icon: Star, href: '/app/reviews', section: 'Marketing' },
  { label: 'Operations', icon: Wrench, href: '/app/operations', section: 'Management' },
  { label: 'Reports', icon: BarChart3, href: '/app/reports/analytics', section: 'Management' },
  { label: 'Themes', icon: Palette, href: '/app/themes', section: 'Management' },
  { label: 'Settings', icon: Settings, href: '/app/settings', section: 'Management' },
];

const ADVANCED_NAV = [
  // Masters
  { label: 'Items', icon: Package, href: '/app/Item', section: 'Masters' },
  { label: 'Warehouses', icon: Warehouse, href: '/app/Warehouse', section: 'Masters' },
  { label: 'Locations', icon: Globe, href: '/app/Location', section: 'Masters' },
  { label: 'UOM', icon: Wrench, href: '/app/UOM', section: 'Masters' },
  // Transactions
  { label: 'Purchase Orders', icon: ClipboardList, href: '/app/Purchase%20Order', section: 'Transactions' },
  { label: 'Purchase Receipts', icon: ClipboardList, href: '/app/Purchase%20Receipt', section: 'Transactions' },
  { label: 'Sales Orders', icon: ClipboardList, href: '/app/Sales%20Order', section: 'Transactions' },
  { label: 'Invoices', icon: FileText, href: '/app/Invoice', section: 'Transactions' },
  { label: 'Delivery Notes', icon: ClipboardList, href: '/app/Delivery%20Note', section: 'Transactions' },
  { label: 'Stock Transfer', icon: ClipboardList, href: '/app/Stock%20Transfer', section: 'Transactions' },
  // Reporting
  { label: 'Stock Balance', icon: BarChart3, href: '/app/reports/stock-balance', section: 'Reporting' },
  { label: 'Stock Ledger', icon: BarChart3, href: '/app/reports/stock-ledger', section: 'Reporting' },
  { label: 'Trial Balance', icon: BarChart3, href: '/app/reports/trial-balance', section: 'Reporting' },
  { label: 'Profit & Loss', icon: BarChart3, href: '/app/reports/profit-loss', section: 'Reporting' },
  { label: 'Balance Sheet', icon: BarChart3, href: '/app/reports/balance-sheet', section: 'Reporting' },
  { label: 'General Ledger', icon: BarChart3, href: '/app/reports/general-ledger', section: 'Reporting' },
  { label: 'Cash Flow', icon: BarChart3, href: '/app/reports/cash-flow', section: 'Reporting' },
  // Admin
  { label: 'Studio Builder', icon: Hammer, href: '/app/studio', section: 'Admin' },
  { label: 'Users', icon: Users, href: '/app/users', section: 'Admin' },
  { label: 'Setup', icon: Settings, href: '/app/setup', section: 'Admin' },
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

  // Server-derived setup state. We default to "show Getting Started" while loading
  // (better to over-show during the ~200ms fetch than hide-then-pop-in).
  const [setupSummary, setSetupSummary] = useState<{
    hideGettingStarted: boolean;
    needsAttention: boolean;
  }>({ hideGettingStarted: false, needsAttention: false });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) return;
        // 6.1: route through axios singleton — auth + tenant headers
        // attach automatically and the response envelope is unwrapped.
        const res = await api.get<{
          totalRevenue?: number;
          totalOrders?: number;
          checklist?: {
            emailVerified?: boolean;
            paymentsConnected?: boolean;
            hasProducts?: boolean;
            hasCustomizedSettings?: boolean;
            hasLegalPages?: boolean;
            storePublished?: boolean;
          };
        }>('/v1/store/admin/dashboard');
        const data = res.data;
        if (cancelled) return;
        const checklist = data.checklist ?? {};
        const allDone =
          !!checklist.emailVerified &&
          !!checklist.paymentsConnected &&
          !!checklist.hasProducts &&
          !!checklist.hasCustomizedSettings &&
          !!checklist.hasLegalPages &&
          !!checklist.storePublished;
        const hasActivity = (data.totalRevenue ?? 0) > 0 || (data.totalOrders ?? 0) > 0;
        const hideGettingStarted = allDone || hasActivity || !!checklist.storePublished;
        const needsAttention = !checklist.emailVerified || !checklist.paymentsConnected;
        setSetupSummary({ hideGettingStarted, needsAttention });
      } catch {
        // Network/parse error — leave defaults (Getting Started visible, no badge).
      }
    })();
    return () => {
      cancelled = true;
    };
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
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('tenantId');
    router.push('/login');
  }, [router]);

  const navItems = [
    ...PRIMARY_NAV
      .filter((item) => !(item.label === 'Getting Started' && setupSummary.hideGettingStarted))
      .map((item) =>
        item.label === 'Settings' && setupSummary.needsAttention
          ? { ...item, badge: true }
          : item
      ),
    ...(showAdvanced ? ADVANCED_NAV : []),
  ];

  // Build a unified search index for the command palette (Cmd/Ctrl+K).
  const commandRoutes: CommandRoute[] = useMemo(
    () => [
      ...PRIMARY_NAV.map((item) => ({
        label: item.label,
        href: item.href,
        group: item.section || 'Navigate',
        keywords: [item.label.toLowerCase(), 'go to', 'navigate'],
      })),
      ...ADVANCED_NAV.map((item) => ({
        label: item.label,
        href: item.href,
        group: `ERP · ${item.section || 'Other'}`,
        keywords: [item.label.toLowerCase(), 'erp', 'advanced'],
      })),
      // Common settings deeplinks
      { label: 'Settings · Payments', href: '/app/settings/payments', group: 'Settings', keywords: ['stripe', 'square', 'payouts'] },
      { label: 'Settings · Shipping & Tax', href: '/app/settings/shipping', group: 'Settings', keywords: ['shipping', 'tax', 'zones'] },
      { label: 'Settings · Legal Pages', href: '/app/settings/legal', group: 'Settings', keywords: ['terms', 'privacy', 'refund'] },
      { label: 'New Product', href: '/app/products/new', group: 'Quick Actions', keywords: ['create', 'add'] },
    ],
    []
  );

  return (
    <>
      <GlobalCommandBar routes={commandRoutes} onSelectRoute={(href) => router.push(href)} />
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
    </>
  );
}
