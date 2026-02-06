'use client';

import Link from 'next/link';
import { Card } from '@platform/ui';
import {
  Webhook,
  FileText,
  Clock,
  Bell,
  Upload,
  Download,
} from 'lucide-react';

const operationsLinks = [
  {
    href: '/app/operations/webhooks',
    icon: Webhook,
    title: 'Webhooks',
    description: 'Configure webhook integrations for real-time events',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    href: '/app/operations/audit-logs',
    icon: FileText,
    title: 'Audit Logs',
    description: 'View system activity and change history',
    color: 'text-green-600 bg-green-50',
  },
  {
    href: '/app/operations/jobs',
    icon: Clock,
    title: 'Background Jobs',
    description: 'Monitor scheduled and running tasks',
    color: 'text-purple-600 bg-purple-50',
  },
  {
    href: '/app/operations/notifications',
    icon: Bell,
    title: 'Notifications',
    description: 'Manage notification templates and alerts',
    color: 'text-amber-600 bg-amber-50',
  },
  {
    href: '/app/operations/import',
    icon: Upload,
    title: 'Import Data',
    description: 'Bulk import products, customers, and more',
    color: 'text-indigo-600 bg-indigo-50',
  },
  {
    href: '/app/operations/export',
    icon: Download,
    title: 'Export Data',
    description: 'Export data in CSV, JSON, or Excel format',
    color: 'text-red-600 bg-red-50',
  },
];

export default function OperationsPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Operations
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          System integrations, automations, and data management
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {operationsLinks.map((link) => {
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
