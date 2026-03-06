'use client';

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

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

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

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
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
