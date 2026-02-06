'use client';

import Link from 'next/link';
import { Card } from '@platform/ui';
import {
  ArrowUpDown,
  Package,
  Hash,
  BarChart3,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

const inventoryLinks = [
  {
    href: '/app/inventory/movements',
    icon: ArrowUpDown,
    title: 'Stock Movements',
    description: 'Track receipts, issues, transfers, and adjustments',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    href: '/app/inventory/batches',
    icon: Package,
    title: 'Batch Tracking',
    description: 'Manage product batches with expiry dates',
    color: 'text-green-600 bg-green-50',
  },
  {
    href: '/app/inventory/serials',
    icon: Hash,
    title: 'Serial Numbers',
    description: 'Track individual items with unique serials',
    color: 'text-purple-600 bg-purple-50',
  },
  {
    href: '/app/reports/stock-balance',
    icon: BarChart3,
    title: 'Stock Balance',
    description: 'View current stock levels across warehouses',
    color: 'text-amber-600 bg-amber-50',
  },
  {
    href: '/app/reports/stock-valuation',
    icon: TrendingUp,
    title: 'Stock Valuation',
    description: 'Analyze inventory value and COGS',
    color: 'text-indigo-600 bg-indigo-50',
  },
  {
    href: '/app/reports/reorder-suggestions',
    icon: AlertTriangle,
    title: 'Reorder Suggestions',
    description: 'Items needing replenishment',
    color: 'text-red-600 bg-red-50',
  },
];

export default function InventoryPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Inventory Management
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Track stock movements, batches, serial numbers, and inventory analytics
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {inventoryLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}>
              <Card className="p-5 h-full hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${link.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                      {link.title}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {link.description}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
