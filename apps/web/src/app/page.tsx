import Link from 'next/link';
import { Badge, Card } from '@platform/ui';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { ButtonLink } from './storefront/_components/button-link';

export default function Index() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <Badge variant="outline" className="bg-white text-slate-600">
              Premium ERP + Storefront
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
              NoSlag Platform
            </h1>
            <p className="text-lg text-slate-500">
              Build modern operations with an inventory-first ERP and a premium storefront experience.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink
                href="/signup"
                className="bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white shadow-md hover:shadow-lg"
              >
                Create Your Store
              </ButtonLink>
              <ButtonLink
                href="/storefront"
                variant="outline"
              >
                Explore Storefront
              </ButtonLink>
              <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
                Sign in to ERP <ArrowRight className="inline h-4 w-4" />
              </Link>
            </div>
          </div>
          <Card className="border-slate-200/70 bg-white p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-500 to-amber-400 text-white shadow-sm">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Operational readiness</h2>
            <p className="mt-2 text-sm text-slate-500">
              Multi-location inventory, FIFO + batch tracking, and accounting-aware stock flows—ready for production.
            </p>
            <div className="mt-6 space-y-3 text-sm text-slate-600">
              {['Inventory intelligence', 'Sales & Purchase flows', 'Accounting-ready ledgers'].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  {item}
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: 'ERP Suite', body: 'Core modules for inventory, sales, purchasing, and accounting.' },
            { title: 'Storefront', body: 'Premium customer-facing UI synced to live inventory.' },
            { title: 'Setup & Studio', body: 'Configure workflows, permissions, and custom docs.' },
          ].map((item) => (
            <Card key={item.title} className="border-slate-200/70 bg-white p-5 shadow-sm">
              <p className="text-base font-semibold text-slate-900">{item.title}</p>
              <p className="mt-2 text-sm text-slate-500">{item.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
