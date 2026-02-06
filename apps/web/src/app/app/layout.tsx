'use client';
import { AppShell } from '@platform/ui';
import { LayoutDashboard, Box, FileText, Users, Settings, Hammer, Package, ClipboardList, BarChart3 } from 'lucide-react';

const NAV_ITEMS = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/app', isActive: true },
    { label: 'Items', icon: Package, href: '/app/Item' },
    { label: 'UOM', icon: Package, href: '/app/UOM' },
    { label: 'Warehouses', icon: Package, href: '/app/Warehouse' },
    { label: 'Locations', icon: Package, href: '/app/Location' },
    { label: 'Locations Tree', icon: BarChart3, href: '/app/reports/locations' },
    { label: 'Purchase Receipt', icon: ClipboardList, href: '/app/Purchase%20Receipt' },
    { label: 'Purchase Order', icon: ClipboardList, href: '/app/Purchase%20Order' },
    { label: 'Purchase Invoice', icon: ClipboardList, href: '/app/Purchase%20Invoice' },
    { label: 'Delivery Note', icon: ClipboardList, href: '/app/Delivery%20Note' },
    { label: 'Sales Order', icon: ClipboardList, href: '/app/Sales%20Order' },
    { label: 'Invoice', icon: ClipboardList, href: '/app/Invoice' },
    { label: 'Stock Transfer', icon: ClipboardList, href: '/app/Stock%20Transfer' },
    { label: 'Stock Reconciliation', icon: ClipboardList, href: '/app/Stock%20Reconciliation' },
    { label: 'Stock Reservation', icon: ClipboardList, href: '/app/Stock%20Reservation' },
    { label: 'Stock Balance', icon: BarChart3, href: '/app/reports/stock-balance' },
    { label: 'Stock Ledger', icon: BarChart3, href: '/app/reports/stock-ledger' },
    { label: 'Stock Movement', icon: BarChart3, href: '/app/reports/stock-movement' },
    { label: 'Serials', icon: BarChart3, href: '/app/reports/serials' },
    { label: 'Stock Valuation', icon: BarChart3, href: '/app/reports/stock-valuation' },
    { label: 'Stock Aging', icon: BarChart3, href: '/app/reports/stock-aging' },
    { label: 'Reorder Suggestions', icon: BarChart3, href: '/app/reports/reorder-suggestions' },
    { label: 'Trial Balance', icon: BarChart3, href: '/app/reports/trial-balance' },
    { label: 'Balance Sheet', icon: BarChart3, href: '/app/reports/balance-sheet' },
    { label: 'Profit & Loss', icon: BarChart3, href: '/app/reports/profit-loss' },
    { label: 'General Ledger', icon: BarChart3, href: '/app/reports/general-ledger' },
    { label: 'Cash Flow', icon: BarChart3, href: '/app/reports/cash-flow' },
    { label: 'Receivable Aging', icon: BarChart3, href: '/app/reports/receivable-aging' },
    { label: 'Payable Aging', icon: BarChart3, href: '/app/reports/payable-aging' },
    { label: 'StudioBuilder', icon: Hammer, href: '/app/studio' },
    { label: 'Users', icon: Users, href: '/app/User' },
    { label: 'Settings', icon: Settings, href: '/app/settings' },
    { label: 'Setup', icon: Settings, href: '/app/setup' },
];

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell navItems={NAV_ITEMS} title="NoSlag ERP" description="Modern Enterprise Platform">
      {children}
    </AppShell>
  );
}
