'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@platform/ui';

export function StorefrontSearchInput() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      router.push(`/storefront/products?q=${encodeURIComponent(trimmed)}`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input
        id="header-search"
        className="h-6 w-40 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
        placeholder="Search products"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </form>
  );
}
