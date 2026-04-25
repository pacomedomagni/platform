'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@platform/ui';

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3001';

export default function DeskDoctypeRedirect() {
  const params = useParams();
  const doctype = (params.doctype as string) || '';

  useEffect(() => {
    if (typeof window !== 'undefined' && doctype) {
      window.location.replace(`${WEB_URL}/app/${encodeURIComponent(doctype)}`);
    }
  }, [doctype]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <Card className="max-w-md p-8 text-center">
        <h1 className="text-base font-semibold">Redirecting to the unified workspace…</h1>
        <p className="mt-2 text-sm text-slate-500">
          The {doctype} list now lives at{' '}
          <a className="underline" href={`${WEB_URL}/app/${encodeURIComponent(doctype)}`}>
            /app/{doctype}
          </a>
          .
        </p>
      </Card>
    </div>
  );
}
