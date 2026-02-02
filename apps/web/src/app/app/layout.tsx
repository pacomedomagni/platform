'use client';
import { AppShell } from '@noslag/ui';
import { LayoutDashboard, Box, FileText, Users, Settings, Hammer } from 'lucide-react';

const NAV_ITEMS = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/app', isActive: true },
    { label: 'Documents', icon: FileText, href: '/app/documents' },
    { label: 'StudioBuilder', icon: Hammer, href: '/app/studio' },
    { label: 'Users', icon: Users, href: '/app/User' },
    { label: 'Settings', icon: Settings, href: '/app/settings' },
];

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell navItems={NAV_ITEMS}>
      {children}
    </AppShell>
  );
}
