'use client';

import { Badge } from '@platform/ui';

interface OrderStatusBadgeProps {
  status: string;
  className?: string;
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const statusMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'; label: string }> = {
    PENDING: { variant: 'warning', label: 'Pending' },
    CONFIRMED: { variant: 'default', label: 'Confirmed' },
    PROCESSING: { variant: 'default', label: 'Processing' },
    SHIPPED: { variant: 'default', label: 'Shipped' },
    DELIVERED: { variant: 'success', label: 'Delivered' },
    CANCELLED: { variant: 'destructive', label: 'Cancelled' },
    REFUNDED: { variant: 'secondary', label: 'Refunded' },
  };

  const config = statusMap[status] || { variant: 'outline', label: status };

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}

interface PaymentStatusBadgeProps {
  status: string;
  className?: string;
}

export function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  const statusMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'; label: string }> = {
    PENDING: { variant: 'warning', label: 'Payment Pending' },
    PAID: { variant: 'success', label: 'Paid' },
    FAILED: { variant: 'destructive', label: 'Failed' },
    REFUNDED: { variant: 'secondary', label: 'Refunded' },
    PARTIALLY_REFUNDED: { variant: 'secondary', label: 'Partially Refunded' },
  };

  const config = statusMap[status] || { variant: 'outline', label: status };

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
