'use client';

import { Input, NativeSelect, Button } from '@platform/ui';
import { Search, X } from 'lucide-react';

interface OrderFiltersProps {
  search: string;
  status: string;
  paymentStatus: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onPaymentStatusChange: (value: string) => void;
  onClear: () => void;
}

export function OrderFilters({
  search,
  status,
  paymentStatus,
  onSearchChange,
  onStatusChange,
  onPaymentStatusChange,
  onClear,
}: OrderFiltersProps) {
  const hasFilters = search || status || paymentStatus;

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by order number, customer email..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <NativeSelect value={status} onChange={(e) => onStatusChange(e.target.value)}>
        <option value="">All Statuses</option>
        <option value="PENDING">Pending</option>
        <option value="CONFIRMED">Confirmed</option>
        <option value="PROCESSING">Processing</option>
        <option value="SHIPPED">Shipped</option>
        <option value="DELIVERED">Delivered</option>
        <option value="CANCELLED">Cancelled</option>
      </NativeSelect>

      <NativeSelect value={paymentStatus} onChange={(e) => onPaymentStatusChange(e.target.value)}>
        <option value="">All Payments</option>
        <option value="PENDING">Payment Pending</option>
        <option value="PAID">Paid</option>
        <option value="FAILED">Failed</option>
        <option value="REFUNDED">Refunded</option>
      </NativeSelect>

      {hasFilters && (
        <Button variant="ghost" size="icon" onClick={onClear} title="Clear filters">
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
