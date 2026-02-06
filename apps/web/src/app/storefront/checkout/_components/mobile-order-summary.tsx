'use client';

import { useState } from 'react';
import { Card } from '@platform/ui';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '../../_lib/format';

interface MobileOrderSummaryProps {
  itemCount: number;
  total: number;
  items: Array<{
    id: string;
    name: string;
    variant?: string;
    quantity: number;
    price: number;
  }>;
}

export function MobileOrderSummary({ itemCount, total, items }: MobileOrderSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="lg:hidden">
      {/* Sticky Summary Bar */}
      <Card className="sticky top-0 z-10 border-slate-200/70 bg-white shadow-md">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">
              {isExpanded ? 'Hide' : 'Show'} order summary
            </span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-slate-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-600" />
            )}
          </div>
          <div className="text-lg font-semibold text-slate-900">
            {formatCurrency(total)}
          </div>
        </button>

        {/* Expanded Items */}
        {isExpanded && (
          <div className="border-t border-slate-200 p-4">
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-start justify-between text-sm">
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{item.name}</p>
                        {item.variant && (
                          <p className="text-xs text-slate-500">{item.variant}</p>
                        )}
                      </div>
                      <p className="ml-4 font-semibold text-slate-900">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Qty: {item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
