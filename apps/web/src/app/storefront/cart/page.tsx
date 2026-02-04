import Link from 'next/link';
import { Button, Card, Input, Badge } from '@noslag/ui';
import { products } from '../_data/products';
import { formatCurrency } from '../_lib/format';
import { ButtonLink } from '../_components/button-link';

const cartItems = [
  { ...products[0], quantity: 1 },
  { ...products[2], quantity: 2 },
];

export default function CartPage() {
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = 120;
  const tax = subtotal * 0.05;
  const total = subtotal + shipping + tax;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Your cart</h1>
          <p className="text-sm text-slate-500">Review your items and proceed to checkout.</p>
        </div>
        <Badge variant="outline" className="bg-white text-slate-600">
          {cartItems.length} items
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4">
          {cartItems.map((item) => (
            <Card key={item.id} className="flex flex-col gap-4 border-slate-200/70 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
              <div className={`h-24 w-32 rounded-xl bg-gradient-to-br ${item.tone} flex items-center justify-center`}>
                <div className="h-12 w-12 rounded-2xl bg-white/80 shadow-sm flex items-center justify-center text-xs font-semibold text-slate-500">
                  {item.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-base font-semibold text-slate-900">{item.name}</p>
                  <p className="text-base font-semibold text-slate-900">{formatCurrency(item.price)}</p>
                </div>
                <p className="text-sm text-slate-500">{item.description}</p>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>Qty</span>
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                    <button className="text-slate-400">-</button>
                    <span className="text-slate-700">{item.quantity}</span>
                    <button className="text-slate-400">+</button>
                  </div>
                  <span>Lead time: {item.leadTime}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="h-fit space-y-5 border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Order summary</h2>
            <p className="text-sm text-slate-500">Shipping calculated by fulfillment region.</p>
          </div>
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Shipping</span>
              <span className="font-semibold text-slate-900">{formatCurrency(shipping)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Tax (5%)</span>
              <span className="font-semibold text-slate-900">{formatCurrency(tax)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
          <div className="space-y-3">
            <ButtonLink
              href="/storefront/checkout"
              className="w-full bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white shadow-md hover:shadow-lg"
            >
              Proceed to checkout
            </ButtonLink>
            <Link href="/storefront/products" className="block text-center text-sm font-medium text-slate-500 hover:text-slate-700">
              Continue shopping
            </Link>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.2em]">Have a code?</p>
            <div className="flex items-center gap-2">
              <Input className="h-9" placeholder="Promo code" />
              <Button variant="outline" size="sm">Apply</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
