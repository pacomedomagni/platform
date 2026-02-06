'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@platform/ui';
import { Button, Input, Label, Textarea, NativeSelect } from '@platform/ui';

interface RefundModalProps {
  open: boolean;
  onClose: () => void;
  orderTotal: number;
  onRefund: (amount: number, reason: string, type: 'full' | 'partial') => Promise<void>;
}

export function RefundModal({ open, onClose, orderTotal, onRefund }: RefundModalProps) {
  const [type, setType] = useState<'full' | 'partial'>('full');
  const [amount, setAmount] = useState(orderTotal.toString());
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    const refundAmount = parseFloat(amount);

    if (isNaN(refundAmount) || refundAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (refundAmount > orderTotal) {
      setError('Refund amount cannot exceed order total');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for the refund');
      return;
    }

    setLoading(true);
    try {
      await onRefund(refundAmount, reason, type);
      onClose();
      setType('full');
      setAmount(orderTotal.toString());
      setReason('');
    } catch (err: any) {
      setError(err.message || 'Failed to process refund');
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (newType: 'full' | 'partial') => {
    setType(newType);
    if (newType === 'full') {
      setAmount(orderTotal.toString());
    } else {
      setAmount('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Process Refund</DialogTitle>
          <DialogDescription>
            Issue a full or partial refund for this order. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Refund Type</Label>
            <NativeSelect
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as 'full' | 'partial')}
            >
              <option value="full">Full Refund</option>
              <option value="partial">Partial Refund</option>
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (USD)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              max={orderTotal}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={type === 'full'}
            />
            <p className="text-xs text-muted-foreground">
              Order total: ${orderTotal.toFixed(2)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              placeholder="Enter the reason for this refund..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Processing...' : `Refund $${parseFloat(amount || '0').toFixed(2)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
