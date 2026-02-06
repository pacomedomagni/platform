/**
 * Customer Account Page
 * Shows profile, orders, and addresses
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@noslag/ui';
import { User, Package, MapPin, LogOut, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../../lib/auth-store';

export default function AccountPage() {
  const router = useRouter();
  const { customer, isAuthenticated, isLoading, logout } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/storefront/account/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated || !customer) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-20">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.push('/storefront');
  };

  const menuItems = [
    {
      icon: User,
      label: 'Profile Settings',
      description: 'Update your personal information',
      href: '/storefront/account/profile',
    },
    {
      icon: Package,
      label: 'Order History',
      description: 'View and track your orders',
      href: '/storefront/account/orders',
    },
    {
      icon: MapPin,
      label: 'Addresses',
      description: 'Manage shipping addresses',
      href: '/storefront/account/addresses',
    },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">My Account</h1>
          <p className="text-sm text-slate-500">
            Welcome back, {customer.firstName || customer.email}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>

      {/* Profile Card */}
      <Card className="border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 text-xl font-semibold text-white">
            {customer.firstName?.[0] || customer.email[0].toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900">
              {customer.firstName && customer.lastName
                ? `${customer.firstName} ${customer.lastName}`
                : customer.email}
            </p>
            <p className="text-sm text-slate-500">{customer.email}</p>
            {customer.phone && (
              <p className="text-sm text-slate-500">{customer.phone}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Menu Items */}
      <div className="space-y-3">
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="flex items-center justify-between border-slate-200/70 bg-white p-5 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-slate-100 p-3">
                  <item.icon className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{item.label}</p>
                  <p className="text-sm text-slate-500">{item.description}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400" />
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4">
        <Link
          href="/storefront/products"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-6 py-4 text-center text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
        >
          Continue Shopping
        </Link>
        <Link
          href="/storefront/account/orders"
          className="flex-1 rounded-lg bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 px-6 py-4 text-center text-sm font-semibold text-white shadow-md hover:shadow-lg"
        >
          View Orders
        </Link>
      </div>
    </div>
  );
}
