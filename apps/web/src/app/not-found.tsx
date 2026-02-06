'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button, Card, Input } from '@platform/ui';
import { Search, Home, Package, ArrowRight } from 'lucide-react';
import { ProductCard } from './storefront/_components/product-card';

// Placeholder - in a real app, fetch from API
const categories = [
  { name: 'Industrial Equipment', slug: 'industrial-equipment', icon: '🏭' },
  { name: 'Storage Solutions', slug: 'storage-solutions', icon: '📦' },
  { name: 'Safety Gear', slug: 'safety-gear', icon: '🦺' },
  { name: 'Tools & Hardware', slug: 'tools-hardware', icon: '🔧' },
];

export default function NotFound() {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentProducts, setRecentProducts] = useState<any[]>([]);

  useEffect(() => {
    // In a real app, fetch recent/popular products from API
    // For now, we'll just use placeholder data
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/storefront/products?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="mx-auto w-full max-w-7xl px-6 py-16 sm:py-24">
        {/* 404 Hero */}
        <div className="text-center">
          <div className="mb-8 inline-flex items-center justify-center">
            <div className="relative">
              <div className="text-9xl font-bold text-slate-200">404</div>
              <Package className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <h1 className="mb-4 text-4xl font-bold text-slate-900 sm:text-5xl">
            Page Not Found
          </h1>
          <p className="mb-8 text-lg text-slate-600">
            Sorry, we couldn't find the page you're looking for. It might have been moved or
            deleted.
          </p>

          {/* Search Bar */}
          <Card className="mx-auto mb-12 max-w-2xl border-slate-200/70 bg-white p-6 shadow-md">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="search"
                    placeholder="Search for products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white"
                >
                  Search
                </Button>
              </div>
              <p className="text-sm text-slate-500">
                Try searching for what you need, or explore our categories below
              </p>
            </form>
          </Card>

          {/* Quick Actions */}
          <div className="mb-16 flex flex-wrap justify-center gap-3">
            <Link href="/">
              <Button variant="outline" size="sm">
                <Home className="mr-2 h-4 w-4" />
                Homepage
              </Button>
            </Link>
            <Link href="/storefront">
              <Button variant="outline" size="sm">
                <Package className="mr-2 h-4 w-4" />
                Storefront
              </Button>
            </Link>
            <Link href="/storefront/products">
              <Button variant="outline" size="sm">
                Browse Products
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Popular Categories */}
        <div className="mb-16">
          <h2 className="mb-6 text-center text-2xl font-semibold text-slate-900">
            Popular Categories
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/storefront/products?category=${category.slug}`}
              >
                <Card className="group h-full border-slate-200/70 bg-white p-6 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                  <div className="mb-3 text-4xl">{category.icon}</div>
                  <h3 className="font-semibold text-slate-900 group-hover:text-blue-600">
                    {category.name}
                  </h3>
                  <div className="mt-2 inline-flex items-center text-sm text-blue-600 opacity-0 transition-opacity group-hover:opacity-100">
                    Browse
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Products */}
        {recentProducts.length > 0 && (
          <div>
            <h2 className="mb-6 text-center text-2xl font-semibold text-slate-900">
              Recently Added Products
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {recentProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}

        {/* Help Card */}
        <Card className="mt-16 border-blue-200/70 bg-blue-50 p-8 text-center shadow-sm">
          <h3 className="mb-2 text-lg font-semibold text-blue-900">Still can't find it?</h3>
          <p className="mb-4 text-blue-700">
            Our support team is here to help you find what you're looking for.
          </p>
          <Link href="/contact">
            <Button variant="outline" className="border-blue-300 bg-white text-blue-700 hover:bg-blue-100">
              Contact Support
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
