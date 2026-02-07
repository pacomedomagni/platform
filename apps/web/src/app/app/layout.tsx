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
} from 'lucide-react';

const PRIMARY_NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/app', isActive: true },
  { label: 'Getting Started', icon: Rocket, href: '/app/getting-started' },
  { label: 'Products', icon: Package, href: '/app/products' },
  { label: 'Orders', icon: ShoppingCart, href: '/app/orders' },
  { label: 'Customers', icon: Users, href: '/app/customers' },
  { label: 'Settings', icon: Settings, href: '/app/settings' },
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
  const [showAdvanced, setShowAdvanced] = useState(false);

  const navItems = [
    ...PRIMARY_NAV,
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
