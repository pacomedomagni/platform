'use client';

import * as React from 'react';
import { Badge } from './atoms';
import { cn } from './utils';

export type StatusKind =
  | 'order'
  | 'payment'
  | 'product'
  | 'customer'
  | 'review'
  | 'listing'
  | 'payout'
  | 'doctype'
  | 'job'
  | 'webhook'
  | 'connection';

type Variant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';

const TABLE: Record<StatusKind, Record<string, { variant: Variant; label: string }>> = {
  order: {
    PENDING: { variant: 'warning', label: 'Pending' },
    CONFIRMED: { variant: 'default', label: 'Confirmed' },
    PROCESSING: { variant: 'default', label: 'Processing' },
    SHIPPED: { variant: 'default', label: 'Shipped' },
    DELIVERED: { variant: 'success', label: 'Delivered' },
    CANCELLED: { variant: 'destructive', label: 'Cancelled' },
    REFUNDED: { variant: 'secondary', label: 'Refunded' },
  },
  payment: {
    PENDING: { variant: 'warning', label: 'Payment Pending' },
    PAID: { variant: 'success', label: 'Paid' },
    CAPTURED: { variant: 'success', label: 'Paid' },
    FAILED: { variant: 'destructive', label: 'Failed' },
    REFUNDED: { variant: 'secondary', label: 'Refunded' },
    PARTIALLY_REFUNDED: { variant: 'secondary', label: 'Partially Refunded' },
  },
  product: {
    PUBLISHED: { variant: 'success', label: 'Published' },
    DRAFT: { variant: 'secondary', label: 'Draft' },
    ARCHIVED: { variant: 'outline', label: 'Archived' },
    FEATURED: { variant: 'warning', label: 'Featured' },
    OUT_OF_STOCK: { variant: 'destructive', label: 'Out of stock' },
    LOW_STOCK: { variant: 'warning', label: 'Low stock' },
    IN_STOCK: { variant: 'success', label: 'In stock' },
  },
  customer: {
    ACTIVE: { variant: 'success', label: 'Active' },
    INACTIVE: { variant: 'destructive', label: 'Inactive' },
    NEW: { variant: 'default', label: 'New' },
    HIGH_VALUE: { variant: 'success', label: 'High Value' },
    VIP: { variant: 'warning', label: 'VIP' },
    AT_RISK: { variant: 'destructive', label: 'At Risk' },
    VERIFIED: { variant: 'success', label: 'Verified' },
    UNVERIFIED: { variant: 'warning', label: 'Unverified' },
  },
  review: {
    PENDING: { variant: 'warning', label: 'Pending' },
    APPROVED: { variant: 'success', label: 'Approved' },
    REJECTED: { variant: 'destructive', label: 'Rejected' },
  },
  listing: {
    DRAFT: { variant: 'secondary', label: 'Draft' },
    APPROVED: { variant: 'default', label: 'Approved' },
    PUBLISHING: { variant: 'warning', label: 'Publishing' },
    PUBLISHED: { variant: 'success', label: 'Published' },
    ENDED: { variant: 'outline', label: 'Ended' },
    ERROR: { variant: 'destructive', label: 'Error' },
  },
  payout: {
    PAID: { variant: 'success', label: 'Paid' },
    PENDING: { variant: 'warning', label: 'Pending' },
    IN_TRANSIT: { variant: 'default', label: 'In Transit' },
    CANCELED: { variant: 'secondary', label: 'Canceled' },
    FAILED: { variant: 'destructive', label: 'Failed' },
  },
  doctype: {
    DRAFT: { variant: 'secondary', label: 'Draft' },
    SUBMITTED: { variant: 'success', label: 'Submitted' },
    CANCELLED: { variant: 'destructive', label: 'Cancelled' },
  },
  job: {
    QUEUED: { variant: 'secondary', label: 'Queued' },
    RUNNING: { variant: 'default', label: 'Running' },
    SUCCESS: { variant: 'success', label: 'Success' },
    FAILED: { variant: 'destructive', label: 'Failed' },
    RETRYING: { variant: 'warning', label: 'Retrying' },
  },
  webhook: {
    ACTIVE: { variant: 'success', label: 'Active' },
    DISABLED: { variant: 'secondary', label: 'Disabled' },
    FAILING: { variant: 'destructive', label: 'Failing' },
  },
  connection: {
    CONNECTED: { variant: 'success', label: 'Connected' },
    DISCONNECTED: { variant: 'secondary', label: 'Disconnected' },
    ONBOARDING: { variant: 'warning', label: 'Onboarding' },
    DISABLED: { variant: 'destructive', label: 'Disabled' },
    ACTIVE: { variant: 'success', label: 'Active' },
  },
};

export interface StatusBadgeProps {
  kind: StatusKind;
  status: string | null | undefined;
  className?: string;
  label?: string;
}

export function StatusBadge({ kind, status, className, label }: StatusBadgeProps) {
  const key = (status ?? '').toUpperCase();
  const config = TABLE[kind][key] ?? { variant: 'outline' as Variant, label: label ?? status ?? '—' };
  return (
    <Badge variant={config.variant} className={cn('font-medium', className)}>
      {label ?? config.label}
    </Badge>
  );
}
