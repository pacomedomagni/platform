'use client';

import React from 'react';
import { Card } from '@platform/ui';

export const ReportPage = ({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) => {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
          {description && (
            <p className="text-sm text-slate-500 mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
};

export const ReportFilters = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <Card className="p-4 bg-white/90 dark:bg-slate-950/70 backdrop-blur border-border/70">
    <div className={`grid grid-cols-1 md:grid-cols-4 gap-3 ${className ?? ''}`.trim()}>
      {children}
    </div>
  </Card>
);

export const ReportCard = ({ children }: { children: React.ReactNode }) => (
  <Card className="p-0 overflow-hidden border-border/70">
    <div className="overflow-x-auto">{children}</div>
  </Card>
);

export const ReportTable = ({ children }: { children: React.ReactNode }) => (
  <table className="w-full text-sm">{children}</table>
);

export const ReportAlert = ({ children }: { children: React.ReactNode }) => (
  <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
    {children}
  </div>
);

export const ReportEmpty = ({ colSpan, message }: { colSpan: number; message?: string }) => (
  <tr>
    <td colSpan={colSpan} className="p-6 text-center text-muted-foreground">
      {message ?? 'No data.'}
    </td>
  </tr>
);
