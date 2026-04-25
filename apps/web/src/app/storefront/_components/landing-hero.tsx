'use client';

/**
 * Landing hero — applies the active theme's primary color to the radial
 * gradient overlay. Falls back to the previous hardcoded blue gradient when
 * the theme hasn't loaded yet.
 */
import Link from 'next/link';
import { Badge, Card } from '@platform/ui';
import { ArrowRight, Check } from 'lucide-react';
import { ButtonLink } from './button-link';
import { ProductCard } from './product-card';
import { useThemeColor } from '@/lib/theme';

const FALLBACK_GRADIENT =
  'radial-gradient(circle at top, rgba(59,130,246,0.12), transparent 55%)';

// Convert "#rrggbb" to "r, g, b" so we can build rgba() strings inline.
function hexToRgbTriplet(hex: string): string | null {
  const v = hex.replace('#', '').trim();
  if (v.length !== 6) return null;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return null;
  return `${r}, ${g}, ${b}`;
}

export interface LandingHeroProps {
  featuredProducts: Array<React.ComponentProps<typeof ProductCard>['product']>;
}

export function LandingHero({ featuredProducts }: LandingHeroProps) {
  const primary = useThemeColor('primary');
  const triplet = primary ? hexToRgbTriplet(primary) : null;
  const gradient = triplet
    ? `radial-gradient(circle at top, rgba(${triplet}, 0.12), transparent 55%)`
    : FALLBACK_GRADIENT;

  return (
    <section className="relative overflow-hidden border-b border-border bg-card">
      <div className="absolute inset-0" style={{ background: gradient }} aria-hidden="true" />
      <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Badge variant="outline" className="bg-card/80 text-muted-foreground">
            Premium storefront UI · Inventory-first
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            A storefront that feels premium, yet runs on ERP-grade control.
          </h1>
          <p className="text-lg text-muted-foreground">
            Built for operators who need accuracy, transparency, and a refined shopping
            experience. Every product here is synced to the NoSlag inventory engine.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink
              href="/storefront/products"
              className="bg-gradient-to-r from-primary via-secondary to-accent text-primary-foreground shadow-md hover:shadow-lg"
            >
              Explore the collection
            </ButtonLink>
            <Link
              href="/app"
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Enter ERP Suite <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            {['Live stock visibility', 'Multi-location ready', 'Batch + FIFO tracking'].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} compact />
          ))}
        </div>
      </div>
      {/* Card import kept for visual parity if used by callers */}
      <Card className="hidden" />
    </section>
  );
}
