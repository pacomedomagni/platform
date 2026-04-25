'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Link2,
  Tag,
  ShoppingCart,
  RotateCcw,
  MessageSquare,
  Megaphone,
  BarChart3,
  DollarSign,
  Mail,
  Percent,
  ShieldAlert,
  Star,
  Settings,
} from 'lucide-react';
import { unwrapJson } from '@/lib/admin-fetch';

const MARKETPLACE_NAV = [
  { label: 'Connections', href: '/app/marketplace/connections', icon: Link2 },
  { label: 'Listings', href: '/app/marketplace/listings', icon: Tag },
  { label: 'Orders', href: '/app/marketplace/orders', icon: ShoppingCart },
  { label: 'Returns', href: '/app/marketplace/returns', icon: RotateCcw },
  { label: 'Messages', href: '/app/marketplace/messages', icon: MessageSquare },
  { label: 'Campaigns', href: '/app/marketplace/campaigns', icon: Megaphone },
  { label: 'Promotions', href: '/app/marketplace/promotions', icon: Percent },
  { label: 'Analytics', href: '/app/marketplace/analytics', icon: BarChart3 },
  { label: 'Finances', href: '/app/marketplace/finances', icon: DollarSign },
  { label: 'Compliance', href: '/app/marketplace/compliance', icon: ShieldAlert },
  { label: 'Feedback', href: '/app/marketplace/feedback', icon: Star },
  { label: 'Email', href: '/app/marketplace/email-campaigns', icon: Mail },
  { label: 'Settings', href: '/app/marketplace/settings', icon: Settings },
];

function authHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('access_token') || '';
  const tenantId = localStorage.getItem('tenantId') || '';
  return { Authorization: `Bearer ${token}`, 'x-tenant-id': tenantId };
}

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/v1/marketplace/listings?status=ERROR&limit=1', { headers: authHeaders() });
        if (!res.ok || !alive) return;
        const data = unwrapJson(await res.json());
        const total: number = data?.total ?? data?.count ?? (Array.isArray(data?.data) ? data.data.length : Array.isArray(data) ? data.length : 0);
        if (alive) setErrorCount(total);
      } catch {
        // Silent — badge stays at 0
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [pathname]);

  return (
    <div>
      {/* Sub-navigation */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-8">
          <nav className="flex gap-1 overflow-x-auto -mb-px">
            {MARKETPLACE_NAV.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/app/marketplace/connections' &&
                  pathname.startsWith(item.href));
              const Icon = item.icon;
              const showBadge = item.label === 'Listings' && errorCount > 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                  {showBadge && (
                    <span
                      title={`${errorCount} listing${errorCount === 1 ? '' : 's'} in error`}
                      className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white"
                    >
                      {errorCount > 99 ? '99+' : errorCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
