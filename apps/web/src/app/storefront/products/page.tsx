'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, Input, NativeSelect, Spinner } from '@platform/ui';
import { Filter, SlidersHorizontal, AlertCircle } from 'lucide-react';
import { SectionHeader } from '../_components/section-header';
import { ProductCard } from '../_components/product-card';
import { productsApi, type StoreProduct } from '@/lib/store-api';

const filters = [
  { label: 'All', value: 'all' },
  { label: 'Warehouse', value: 'warehouse' },
  { label: 'Front of House', value: 'front' },
  { label: 'Fulfillment Tech', value: 'tech' },
  { label: 'Workspace', value: 'workspace' },
];

type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'newest';

export default function ProductsPage() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('featured');

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await productsApi.list({
          search: searchQuery || undefined,
          categorySlug: selectedCategory !== 'all' ? selectedCategory : undefined,
          limit: 50,
        });

        // Sort products locally
        const sortedProducts = [...data.items];
        switch (sortBy) {
          case 'price-asc':
            sortedProducts.sort((a, b) => a.price - b.price);
            break;
          case 'price-desc':
            sortedProducts.sort((a, b) => b.price - a.price);
            break;
          case 'newest':
            sortedProducts.sort((a, b) =>
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            );
            break;
          case 'featured':
          default:
            // Keep original order (featured first from API)
            break;
        }

        setProducts(sortedProducts);
      } catch (err) {
        console.error('Failed to fetch products:', err);
        setError('Failed to load products. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce search
    const timeout = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, selectedCategory, sortBy]);

  // Map API product to ProductCard expected format
  const mapProductForCard = (product: StoreProduct) => ({
    id: product.id,
    name: product.name || product.displayName,
    slug: product.slug,
    category: typeof product.category === 'string'
      ? product.category
      : product.category?.name || 'Uncategorized',
    price: product.price,
    compareAt: product.compareAtPrice || undefined,
    rating: 4.5, // Default rating - would come from reviews in a full implementation
    reviews: 0,
    badge: product.tags?.includes('bestseller')
      ? 'Best Seller' as const
      : product.tags?.includes('new')
        ? 'New Arrival' as const
        : undefined,
    description: product.shortDescription || product.description?.substring(0, 100) || '',
    stockStatus: (product.trackInventory && (product.quantity ?? product.stockQuantity) === 0)
      ? 'Low Stock' as const
      : 'In Stock' as const,
    leadTime: '2-4 days',
    tone: 'from-blue-50 via-slate-50 to-amber-50',
    images: product.images,
  });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-6 py-12">
      <SectionHeader
        eyebrow="Storefront"
        title="Inventory-ready products with premium presentation"
        description="Every product is synced to live inventory rules so you never oversell, even with multi-location stock."
        actions={
          <Link
            href="/storefront/cart"
            className="text-sm font-semibold text-primary hover:opacity-80 hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
          >
            View cart
          </Link>
        }
      />

      <Card
        className="flex flex-col gap-4 border-border bg-card p-5 shadow-sm md:flex-row md:items-center md:justify-between"
        role="search"
        aria-label="Product filters and search"
      >
        <nav aria-label="Product category filters">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-muted-foreground">
              <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span>Filters</span>
            </div>
            {filters.map((filter) => (
              <Badge
                key={filter.value}
                variant="outline"
                className={`cursor-pointer ${
                  selectedCategory === filter.value
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-card text-muted-foreground hover:bg-muted'
                }`}
                onClick={() => setSelectedCategory(filter.value)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedCategory(filter.value);
                  }
                }}
                aria-pressed={selectedCategory === filter.value}
                aria-label={`Filter by ${filter.label}`}
              >
                {filter.label}
              </Badge>
            ))}
          </div>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-60">
            <label htmlFor="product-search" className="sr-only">
              Search products
            </label>
            <Input
              id="product-search"
              placeholder="Search products"
              className="h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="search"
              aria-label="Search products"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            <label htmlFor="sort-by" className="sr-only">
              Sort products by
            </label>
            <NativeSelect
              id="sort-by"
              className="h-9"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Sort products"
            >
              <option value="featured">Sort by: Featured</option>
              <option value="price-asc">Sort by: Price low to high</option>
              <option value="price-desc">Sort by: Price high to low</option>
              <option value="newest">Sort by: Newest</option>
            </NativeSelect>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div
          className="flex items-center justify-center py-20"
          role="status"
          aria-live="polite"
        >
          <Spinner className="h-8 w-8" aria-hidden="true" />
          <span className="ml-3 text-muted-foreground">Loading products...</span>
        </div>
      ) : error ? (
        <Card
          className="flex flex-col items-center justify-center p-10 text-center"
          role="alert"
        >
          <AlertCircle className="h-12 w-12 text-destructive mb-4" aria-hidden="true" />
          <p className="text-foreground font-medium">{error}</p>
          <Button
            variant="outline"
            className="mt-4 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </Card>
      ) : products.length === 0 ? (
        <Card
          className="flex flex-col items-center justify-center p-10 text-center"
          role="status"
        >
          <p className="text-muted-foreground">No products found.</p>
          {(searchQuery || selectedCategory !== 'all') && (
            <Button
              variant="outline"
              className="mt-4 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
            >
              Clear Filters
            </Button>
          )}
        </Card>
      ) : (
        <main>
          <h2 className="sr-only">Products</h2>
          <div
            className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
            role="list"
            aria-label={`${products.length} products available`}
          >
            {products.map((product) => (
              <div key={product.id} role="listitem">
                <ProductCard product={mapProductForCard(product)} />
              </div>
            ))}
          </div>
        </main>
      )}

      <Card
        className="flex flex-col items-start justify-between gap-4 border-border bg-gradient-to-r from-primary via-secondary to-accent p-6 text-primary-foreground shadow-lg md:flex-row md:items-center"
        role="region"
        aria-labelledby="cta-heading"
      >
        <div>
          <h2 id="cta-heading" className="text-xl font-semibold">
            Need a full-storefront rollout?
          </h2>
          <p className="text-sm text-primary-foreground/80">We build the merchandising, inventory, and fulfillment flows for you.</p>
        </div>
        <Button
          className="bg-background text-foreground hover:bg-background/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Talk to sales
        </Button>
      </Card>
    </div>
  );
}
