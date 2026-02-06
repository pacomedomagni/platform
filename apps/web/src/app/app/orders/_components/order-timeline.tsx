'use client';

import { Check, Package, Truck, ShoppingBag, XCircle } from 'lucide-react';
import { cn } from '@platform/ui/lib/utils';

interface OrderTimelineProps {
  status: string;
  createdAt: string | Date;
  confirmedAt?: string | Date | null;
  shippedAt?: string | Date | null;
  deliveredAt?: string | Date | null;
  cancelledAt?: string | Date | null;
}

export function OrderTimeline({
  status,
  createdAt,
  confirmedAt,
  shippedAt,
  deliveredAt,
  cancelledAt,
}: OrderTimelineProps) {
  const formatDate = (date?: string | Date | null) => {
    if (!date) return null;
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const isCancelled = status === 'CANCELLED';

  const steps = [
    {
      label: 'Order Placed',
      icon: ShoppingBag,
      date: formatDate(createdAt),
      completed: true,
    },
    {
      label: 'Confirmed',
      icon: Check,
      date: formatDate(confirmedAt),
      completed: !!confirmedAt,
    },
    {
      label: 'Shipped',
      icon: Truck,
      date: formatDate(shippedAt),
      completed: !!shippedAt,
    },
    {
      label: 'Delivered',
      icon: Package,
      date: formatDate(deliveredAt),
      completed: !!deliveredAt,
    },
  ];

  if (isCancelled) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 text-red-600">
            <XCircle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-red-600">Order Cancelled</p>
            {cancelledAt && (
              <p className="text-sm text-muted-foreground">{formatDate(cancelledAt)}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.label} className="flex items-start gap-4">
            <div className="relative">
              <div
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-full',
                  step.completed
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'absolute left-5 top-10 w-0.5 h-8',
                    step.completed ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
            <div className="flex-1 pt-1">
              <p className={cn('font-medium', !step.completed && 'text-muted-foreground')}>
                {step.label}
              </p>
              {step.date && (
                <p className="text-sm text-muted-foreground">{step.date}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
