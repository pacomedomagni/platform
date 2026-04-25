'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button, Card } from '@platform/ui';
import { ArrowRight, ExternalLink } from 'lucide-react';

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3001';

export default function DeskRedirect() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.location.replace(`${WEB_URL}/app`);
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <Card className="max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          The Desk has moved
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          NoSlag&apos;s ERP surface is now part of the main workspace. We&apos;re sending you there now.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <a
            href={`${WEB_URL}/app`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open workspace <ArrowRight className="h-4 w-4" />
          </a>
          <Link
            href={`${WEB_URL}/login`}
            className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
          >
            Sign in to the new workspace <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </Card>
    </div>
  );
}
