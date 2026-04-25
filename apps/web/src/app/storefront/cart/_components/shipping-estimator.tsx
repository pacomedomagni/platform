'use client';

/**
 * Cart-page shipping & tax estimator. Hits the same /v1/store/shipping/calculate
 * endpoint used by checkout; persists the user's choice in the cart store so
 * checkout pre-fills with the same address and rate.
 */
import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, NativeSelect, Spinner } from '@platform/ui';
import { ChevronDown, ChevronUp, Truck } from 'lucide-react';
import { shippingApi, type ShippingRate } from '@/lib/store-api';
import { useCartStore } from '@/lib/cart-store';
import { formatCurrency } from '../../_lib/format';

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'NG', name: 'Nigeria' },
];

// Conservative US-style estimate when no tax preview endpoint exists.
// Clearly labelled "Estimated tax" downstream.
const ESTIMATED_TAX_RATE = 0.08;

function defaultCountry(): string {
  if (typeof navigator === 'undefined') return 'US';
  const lang = navigator.language || 'en-US';
  const parts = lang.split('-');
  const region = (parts[1] || '').toUpperCase();
  if (COUNTRIES.some((c) => c.code === region)) return region;
  return 'US';
}

export function ShippingEstimator() {
  const { subtotal, shippingEstimate, setShippingEstimate } = useCartStore();
  const [open, setOpen] = useState(Boolean(shippingEstimate));
  const [country, setCountry] = useState(shippingEstimate?.country || defaultCountry());
  const [state, setState] = useState(shippingEstimate?.state || '');
  const [postalCode, setPostalCode] = useState(shippingEstimate?.postalCode || '');
  const [addressLine, setAddressLine] = useState('');
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(
    shippingEstimate?.rateId ?? null
  );
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRate = useMemo(
    () => rates.find((r) => r.id === selectedRateId) ?? null,
    [rates, selectedRateId]
  );

  // When the user clicks "Calculate" we fire one request and pick the
  // cheapest rate by default. Subsequent clicks on a rate radio update
  // both local selection and the persisted estimate.
  const calculate = async () => {
    if (!country) return;
    setIsCalculating(true);
    setError(null);
    try {
      const result = await shippingApi.getRates({
        country,
        state: state || undefined,
        zipCode: postalCode || undefined,
        cartTotal: subtotal,
      });
      const rs = result.rates || [];
      setRates(rs);
      if (rs.length === 0) {
        setError('No rates available for this destination. Default shipping will apply at checkout.');
        setShippingEstimate(null);
        return;
      }
      // Pick the cheapest by default
      const cheapest = [...rs].sort((a, b) => a.price - b.price)[0];
      setSelectedRateId(cheapest.id);
      persistChoice(cheapest);
    } catch {
      setError('Could not load shipping rates. A default rate will apply at checkout.');
      setRates([]);
      setShippingEstimate(null);
    } finally {
      setIsCalculating(false);
    }
  };

  const persistChoice = (rate: ShippingRate) => {
    const tax = Math.round((subtotal * ESTIMATED_TAX_RATE) * 100) / 100;
    setShippingEstimate({
      country,
      state: state || undefined,
      postalCode: postalCode || undefined,
      rateId: rate.id,
      rateName: rate.name,
      ratePrice: rate.isFree ? 0 : rate.price,
      estimatedDays: rate.estimatedDays,
      estimatedTax: tax,
      taxLabel: 'Estimated tax',
    });
  };

  // Re-persist when the user changes selection without re-calculating.
  useEffect(() => {
    if (selectedRate) persistChoice(selectedRate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRateId]);

  return (
    <Card className="border-border bg-card p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
        aria-expanded={open}
        aria-controls="shipping-estimator-body"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Truck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Estimate shipping & tax
          {shippingEstimate && (
            <span className="text-xs font-medium text-muted-foreground">
              · {shippingEstimate.rateName} {formatCurrency(shippingEstimate.ratePrice)}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div id="shipping-estimator-body" className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="estimator-country" className="text-xs font-medium text-muted-foreground">
                Country
              </label>
              <NativeSelect
                id="estimator-country"
                className="h-9"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <label htmlFor="estimator-state" className="text-xs font-medium text-muted-foreground">
                State / Province
              </label>
              <Input
                id="estimator-state"
                className="h-9"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State"
                autoComplete="address-level1"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="estimator-zip" className="text-xs font-medium text-muted-foreground">
                Postal code
              </label>
              <Input
                id="estimator-zip"
                className="h-9"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="00000"
                autoComplete="postal-code"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label htmlFor="estimator-address" className="text-xs font-medium text-muted-foreground">
                Address (optional)
              </label>
              <Input
                id="estimator-address"
                className="h-9"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                placeholder="Street, city"
                autoComplete="street-address"
                maxLength={4 * 80}
              />
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={calculate}
            disabled={isCalculating || !country}
            aria-busy={isCalculating}
            className="w-full sm:w-auto"
          >
            {isCalculating ? (
              <>
                <Spinner className="mr-2 h-4 w-4" aria-hidden="true" /> Calculating...
              </>
            ) : (
              'Calculate'
            )}
          </Button>

          {error && (
            <p className="text-xs text-amber-600" role="status">
              {error}
            </p>
          )}

          {rates.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Available rates
              </p>
              <div className="space-y-2">
                {rates.map((rate) => (
                  <label
                    key={rate.id}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm transition-colors ${
                      selectedRateId === rate.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="cart-shipping-rate"
                        value={rate.id}
                        checked={selectedRateId === rate.id}
                        onChange={() => setSelectedRateId(rate.id)}
                        className="h-4 w-4 text-primary"
                      />
                      <div>
                        <p className="font-medium text-foreground">{rate.name}</p>
                        {rate.estimatedDays && (
                          <p className="text-xs text-muted-foreground">{rate.estimatedDays}</p>
                        )}
                      </div>
                    </div>
                    <span className="font-semibold text-foreground">
                      {rate.isFree ? 'Free' : formatCurrency(rate.price)}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Tax shown is an estimate. Final tax is calculated at checkout.
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
