'use client';

import { Shield, Lock, CreditCard, Package, Award } from 'lucide-react';
import { Card } from '@platform/ui';

export function TrustBadges() {
  return (
    <Card className="border-emerald-200/70 bg-emerald-50/50 p-4 shadow-sm">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Lock className="h-4 w-4 flex-shrink-0 text-emerald-700" />
          <span className="font-medium text-emerald-900">Secure SSL Encrypted Checkout</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4 flex-shrink-0 text-emerald-700" />
          <span className="font-medium text-emerald-900">256-bit Encryption</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Award className="h-4 w-4 flex-shrink-0 text-emerald-700" />
          <span className="font-medium text-emerald-900">30-Day Money Back Guarantee</span>
        </div>
        <div className="mt-4 border-t border-emerald-200 pt-3">
          <div className="flex items-center gap-2 text-xs text-emerald-800">
            <CreditCard className="h-4 w-4 flex-shrink-0" />
            <span>We accept:</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="rounded border border-emerald-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
              VISA
            </div>
            <div className="rounded border border-emerald-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
              Mastercard
            </div>
            <div className="rounded border border-emerald-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
              AMEX
            </div>
            <div className="rounded border border-emerald-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
              PayPal
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
