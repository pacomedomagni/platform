import Link from 'next/link';
import { Button, Card, Input, Label, NativeSelect, Textarea } from '@noslag/ui';
import { products } from '../_data/products';
import { formatCurrency } from '../_lib/format';

const cartItems = [
  { ...products[0], quantity: 1 },
  { ...products[2], quantity: 2 },
];

export default function CheckoutPage() {
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = 120;
  const tax = subtotal * 0.05;
  const total = subtotal + shipping + tax;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Checkout</h1>
          <p className="text-sm text-slate-500">Confirm delivery and payment details.</p>
        </div>
        <Link href="/storefront/cart" className="text-sm font-semibold text-blue-600 hover:text-blue-500">
          Back to cart
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="space-y-8 border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>First name</Label>
                <Input className="h-10" placeholder="Amina" />
              </div>
              <div className="space-y-2">
                <Label>Last name</Label>
                <Input className="h-10" placeholder="Rahman" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Email</Label>
                <Input className="h-10" placeholder="amina@company.com" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Shipping</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Company</Label>
                <Input className="h-10" placeholder="NoSlag Logistics" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Input className="h-10" placeholder="Street address" />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input className="h-10" placeholder="Dubai" />
              </div>
              <div className="space-y-2">
                <Label>Postal code</Label>
                <Input className="h-10" placeholder="00000" />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <NativeSelect className="h-10">
                  <option>United Arab Emirates</option>
                  <option>United Kingdom</option>
                  <option>Nigeria</option>
                  <option>United States</option>
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label>Fulfillment region</Label>
                <NativeSelect className="h-10">
                  <option>Middle East</option>
                  <option>Europe</option>
                  <option>Africa</option>
                  <option>North America</option>
                </NativeSelect>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Delivery notes</Label>
                <Textarea placeholder="Preferred delivery window, dock instructions, etc." />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Payment</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Card number</Label>
                <Input className="h-10" placeholder="1234 5678 9012 3456" />
              </div>
              <div className="space-y-2">
                <Label>Expiry</Label>
                <Input className="h-10" placeholder="MM/YY" />
              </div>
              <div className="space-y-2">
                <Label>CVC</Label>
                <Input className="h-10" placeholder="123" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="h-fit space-y-6 border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Order summary</h2>
            <p className="text-sm text-slate-500">Live inventory reserved for 30 minutes.</p>
          </div>
          <div className="space-y-4">
            {cartItems.map((item) => (
              <div key={item.id} className="flex items-start justify-between text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">Qty {item.quantity}</p>
                </div>
                <p className="font-semibold text-slate-900">{formatCurrency(item.price * item.quantity)}</p>
              </div>
            ))}
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
              <span>Tax</span>
              <span className="font-semibold text-slate-900">{formatCurrency(tax)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
          <Button className="w-full bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white shadow-md hover:shadow-lg">
            Place order
          </Button>
          <p className="text-xs text-slate-500">
            By placing your order, you agree to the NoSlag storefront terms and ERP-managed fulfillment policies.
          </p>
        </Card>
      </div>
    </div>
  );
}
