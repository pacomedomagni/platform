'use client';

import { useState } from 'react';
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
  Receipt,
  CreditCard,
  RotateCcw,
  Tag,
  ShoppingBag,
  UserCircle,
  Activity,
  Bell,
  Search,
  Heart,
  AlertTriangle,
  Globe,
  Palette,
  ExternalLink,
  TrendingUp,
  Truck,
} from 'lucide-react';

const NAV_ITEMS = [
  // ─── Core ───
  { label: 'Dashboard', icon: LayoutDashboard, href: '/app', section: 'Core' },
  { label: 'Getting Started', icon: Rocket, href: '/app/getting-started', section: 'Core' },

  // ─── Sales ───
  { label: 'Orders', icon: ShoppingCart, href: '/app/orders', section: 'Sales' },
  { label: 'Draft Orders', icon: FileText, href: '/app/draft-orders', section: 'Sales' },
  { label: 'Abandoned Carts', icon: ShoppingBag, href: '/app/abandoned-carts', section: 'Sales' },
  { label: 'Invoices', icon: Receipt, href: '/app/invoices', section: 'Sales' },

  // ─── Products ───
  { label: 'Products', icon: Package, href: '/app/products', section: 'Catalog' },
  { label: 'Reviews', icon: Heart, href: '/app/reviews', section: 'Catalog' },
  { label: 'Discount Rules', icon: Tag, href: '/app/discount-rules', section: 'Catalog' },

  // ─── Customers ───
  { label: 'Customers', icon: Users, href: '/app/customers', section: 'Customers' },
  { label: 'CRM', icon: UserCircle, href: '/app/crm', section: 'Customers' },

  // ─── Operations ───
  { label: 'Purchase Orders', icon: ClipboardList, href: '/app/purchase-orders', section: 'Operations' },
  { label: 'Expenses', icon: CreditCard, href: '/app/expenses', section: 'Operations' },
  { label: 'Returns', icon: RotateCcw, href: '/app/returns', section: 'Operations' },
  { label: 'Tax Rules', icon: Receipt, href: '/app/tax-rules', section: 'Operations' },
  { label: 'Reorder Alerts', icon: AlertTriangle, href: '/app/reorder-alerts', section: 'Operations' },

  // ─── Marketing ───
  { label: 'SEO Tools', icon: Search, href: '/app/seo', section: 'Marketing' },
  { label: 'Notifications', icon: Bell, href: '/app/notifications', section: 'Marketing' },
  { label: 'Themes', icon: Palette, href: '/app/themes', section: 'Marketing' },

  // ─── Analytics ───
  { label: 'Business Health', icon: TrendingUp, href: '/app/business-health', section: 'Analytics' },
  { label: 'Activity Log', icon: Activity, href: '/app/activity', section: 'Analytics' },

  // ─── Settings ───
  { label: 'Settings', icon: Settings, href: '/app/settings', section: 'Settings' },
];

const ADVANCED_NAV = [
  { label: 'Items', icon: Package, href: '/app/Item', section: 'ERP' },
  { label: 'Warehouses', icon: Warehouse, href: '/app/Warehouse', section: 'ERP' },
  { label: 'Locations', icon: Warehouse, href: '/app/Location', section: 'ERP' },
  { label: 'Stock Transfer', icon: ClipboardList, href: '/app/Stock%20Transfer', section: 'ERP' },
  { label: 'Stock Balance', icon: BarChart3, href: '/app/reports/stock-balance', section: 'Reports' },
  { label: 'Stock Ledger', icon: BarChart3, href: '/app/reports/stock-ledger', section: 'Reports' },
  { label: 'Trial Balance', icon: BarChart3, href: '/app/reports/trial-balance', section: 'Reports' },
  { label: 'Profit & Loss', icon: BarChart3, href: '/app/reports/profit-loss', section: 'Reports' },
  { label: 'Balance Sheet', icon: BarChart3, href: '/app/reports/balance-sheet', section: 'Reports' },
  { label: 'General Ledger', icon: BarChart3, href: '/app/reports/general-ledger', section: 'Reports' },
  { label: 'Cash Flow', icon: BarChart3, href: '/app/reports/cash-flow', section: 'Reports' },
  { label: 'Studio Builder', icon: Hammer, href: '/app/studio', section: 'Tools' },
  { label: 'Users', icon: Users, href: '/app/User', section: 'Tools' },
  { label: 'Setup', icon: Settings, href: '/app/setup', section: 'Tools' },
];

export function AppLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const navItems = [
    // View Store link at the very top
    { label: 'View My Store', icon: ExternalLink, href: '/storefront', section: 'Core', external: true },
    ...NAV_ITEMS,
    ...(showAdvanced ? ADVANCED_NAV : []),
  ];

  return (
    <AppShell
      navItems={navItems}
      title="NoSlag"
      description="Store Admin"
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
