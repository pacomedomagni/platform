'use client';

import Link from 'next/link';
import { Button, Card, Badge } from '@platform/ui';

export default function SetupPage() {
  const steps = [
    { label: 'Define UOMs', href: '/app/UOM', description: 'Standardize units of measure for inventory and sales.' },
    { label: 'Create Warehouses', href: '/app/Warehouse', description: 'Set up storage locations and site codes.' },
    { label: 'Create Locations', href: '/app/Location', description: 'Build bin hierarchy for picking and putaway.' },
    { label: 'Create Items', href: '/app/Item', description: 'Add your products and services.' },
    { label: 'Set Reorder Levels', href: '/app/Item', description: 'Configure replenishment thresholds per item.' },
    { label: 'Chart of Accounts', href: '/app/Account', description: 'Define the accounting structure for postings.' },
    { label: 'Customers', href: '/app/Customer', description: 'Create customer records for sales transactions.' },
    { label: 'Suppliers', href: '/app/Supplier', description: 'Create supplier records for purchases.' },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Setup Checklist</h1>
          <p className="text-sm text-slate-500">Complete these steps to start transacting.</p>
        </div>
        <Button variant="outline">View Setup Guide</Button>
      </div>

      <Card className="p-6 space-y-4 bg-white/90 dark:bg-slate-950/80 backdrop-blur">
        {steps.map((step, idx) => (
          <div key={step.label} className="flex items-start gap-4 border-b last:border-0 pb-4 last:pb-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 via-blue-500 to-amber-400 text-white flex items-center justify-center text-sm font-semibold">
              {idx + 1}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Link className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-indigo-600" href={step.href}>
                  {step.label}
                </Link>
                <Badge variant="secondary">Required</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1">{step.description}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => window.location.href = step.href}>
              Open
            </Button>
          </div>
        ))}
      </Card>
    </div>
  );
}
