'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@platform/ui';

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3001';

export default function DeskFormRedirect() {
  const params = useParams();
  const doctype = (params.doctype as string) || '';
  const name = (params.name as string) || '';

  useEffect(() => {
    if (typeof window !== 'undefined' && doctype) {
      const href = `${WEB_URL}/app/${encodeURIComponent(doctype)}/${encodeURIComponent(name || 'new')}`;
      window.location.replace(href);
    }
  }, [doctype, name]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <Card className="max-w-md p-8 text-center">
        <h1 className="text-base font-semibold">Redirecting…</h1>
        <p className="mt-2 text-sm text-slate-500">
          This document now opens in the unified workspace at{' '}
          <a
            className="underline"
            href={`${WEB_URL}/app/${encodeURIComponent(doctype)}/${encodeURIComponent(name || 'new')}`}
          >
            /app/{doctype}/{name || 'new'}
          </a>
          .
        </p>
      </Card>
    </div>
  );
}
