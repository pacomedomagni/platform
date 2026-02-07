'use client';

import { useEffect, useState, useRef } from 'react';
import { Card } from '@platform/ui';
import { Store, Truck, Package, PartyPopper, Loader2, Upload, X, Check } from 'lucide-react';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface StoreSettings {
  businessName: string;
  taxRate: number;
  shippingRate: number;
  freeShippingThreshold: number;
  storeUrl?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token') || '';
  const tenantId = localStorage.getItem('tenantId') || '';
  return {
    Authorization: `Bearer ${token}`,
    'x-tenant-id': tenantId,
    'Content-Type': 'application/json',
  };
}

/* ------------------------------------------------------------------ */
/*  Step indicator                                                     */
/* ------------------------------------------------------------------ */

const STEPS = [
  { number: 1, label: 'Store Details', icon: Store },
  { number: 2, label: 'Shipping & Tax', icon: Truck },
  { number: 3, label: 'First Product', icon: Package },
  { number: 4, label: "You're Ready!", icon: PartyPopper },
] as const;

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0">
      {STEPS.map((step, idx) => {
        const isActive = step.number === currentStep;
        const isDone = step.number < currentStep;

        return (
          <div key={step.number} className="flex items-center">
            {/* Circle */}
            <div className="flex flex-col items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all ${
                  isDone
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : isActive
                    ? 'border-blue-600 bg-white text-blue-600'
                    : 'border-slate-300 bg-white text-slate-400'
                }`}
              >
                {isDone ? <Check className="h-4.5 w-4.5" /> : step.number}
              </div>
              <span
                className={`mt-2 text-xs font-medium ${
                  isActive ? 'text-blue-600' : isDone ? 'text-slate-700' : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {idx < STEPS.length - 1 && (
              <div
                className={`mx-2 mb-6 h-0.5 w-12 sm:w-20 ${
                  step.number < currentStep ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function GettingStartedPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 state
  const [businessName, setBusinessName] = useState('');

  // Step 2 state
  const [taxRatePercent, setTaxRatePercent] = useState('8.25');
  const [shippingRate, setShippingRate] = useState('5.99');
  const [freeShippingThreshold, setFreeShippingThreshold] = useState('75.00');

  // Step 3 state
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productImage, setProductImage] = useState<string | null>(null);
  const [productImageName, setProductImageName] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Store URL for final step
  const [storeUrl, setStoreUrl] = useState<string | null>(null);

  /* ---------- Fetch existing settings ---------- */

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/v1/store/admin/settings', {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error('Failed to load settings');
        const data: StoreSettings = await res.json();
        setBusinessName(data.businessName || '');
        if (data.taxRate != null) setTaxRatePercent(String(+(data.taxRate * 100).toFixed(4)));
        if (data.shippingRate != null) setShippingRate(String(data.shippingRate));
        if (data.freeShippingThreshold != null)
          setFreeShippingThreshold(String(data.freeShippingThreshold));
        if (data.storeUrl) setStoreUrl(data.storeUrl);
      } catch {
        // We'll just use defaults
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  /* ---------- Save helpers ---------- */

  const saveSettings = async (body: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/store/admin/settings', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save');
      }
      const updated = await res.json();
      if (updated.storeUrl) setStoreUrl(updated.storeUrl);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Step handlers ---------- */

  const handleStep1Next = async () => {
    if (!businessName.trim()) {
      setError('Please enter your business name.');
      return;
    }
    const ok = await saveSettings({ businessName: businessName.trim() });
    if (ok) {
      setError(null);
      setStep(2);
    }
  };

  const handleStep2Next = async () => {
    const taxDecimal = parseFloat(taxRatePercent) / 100;
    const shipping = parseFloat(shippingRate);
    const threshold = parseFloat(freeShippingThreshold);

    if (isNaN(taxDecimal) || isNaN(shipping) || isNaN(threshold)) {
      setError('Please enter valid numbers for all fields.');
      return;
    }

    const ok = await saveSettings({
      taxRate: taxDecimal,
      shippingRate: shipping,
      freeShippingThreshold: threshold,
    });
    if (ok) {
      setError(null);
      setStep(3);
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    setError(null);
    try {
      const token = localStorage.getItem('access_token') || '';
      const tenantId = localStorage.getItem('tenantId') || '';
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/v1/store/admin/uploads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-tenant-id': tenantId,
        },
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to upload image');
      const data = await res.json();
      setProductImage(data.url || data.imageUrl || data.path);
      setProductImageName(file.name);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleStep3Next = async () => {
    // Product creation is optional -- user can skip
    if (productName.trim() && productPrice.trim()) {
      setSaving(true);
      setError(null);
      try {
        const body: Record<string, unknown> = {
          name: productName.trim(),
          price: parseFloat(productPrice),
          description: productDescription.trim(),
          isPublished: true,
        };
        if (productImage) {
          body.image = productImage;
        }

        const res = await fetch('/api/v1/store/admin/products/simple', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to create product');
        }
      } catch (err: any) {
        setError(err.message);
        setSaving(false);
        return;
      } finally {
        setSaving(false);
      }
    }

    setError(null);
    setStep(4);
    localStorage.setItem('merchant_setup_done', 'true');
  };

  const handleSkipProduct = () => {
    setError(null);
    setStep(4);
    localStorage.setItem('merchant_setup_done', 'true');
  };

  /* ---------- Loading state ---------- */

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Loading setup wizard...</p>
        </div>
      </div>
    );
  }

  /* ---------- Render ---------- */

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Gradient header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 lg:px-8">
        <div className="mx-auto max-w-3xl text-center text-white">
          <h1 className="text-2xl font-bold sm:text-3xl">Set Up Your Store</h1>
          <p className="mt-1.5 text-blue-100">
            Just a few steps and you&apos;ll be ready to start selling.
          </p>
        </div>
      </div>

      <div className="mx-auto -mt-6 max-w-3xl px-4 pb-12 sm:px-6">
        {/* Step indicator */}
        <Card className="mb-6 px-6 py-6">
          <StepIndicator currentStep={step} />
        </Card>

        {/* Error banner */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* ========== STEP 1: Store Details ========== */}
        {step === 1 && (
          <Card className="p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Store Details</h2>
              <p className="mt-1 text-sm text-slate-500">
                Tell us about your business so we can personalize your store.
              </p>
            </div>

            <div>
              <label htmlFor="businessName" className="block text-sm font-medium text-slate-700">
                Business Name
              </label>
              <input
                id="businessName"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. My Awesome Store"
                className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={handleStep1Next}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save & Continue'
                )}
              </button>
            </div>
          </Card>
        )}

        {/* ========== STEP 2: Shipping & Tax ========== */}
        {step === 2 && (
          <Card className="p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Shipping & Tax</h2>
              <p className="mt-1 text-sm text-slate-500">
                Set your default tax and shipping rates. You can change these anytime in settings.
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label htmlFor="taxRate" className="block text-sm font-medium text-slate-700">
                  Tax Rate (%)
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="taxRate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={taxRatePercent}
                    onChange={(e) => setTaxRatePercent(e.target.value)}
                    className="block w-full rounded-xl border border-slate-300 px-4 py-3 pr-10 text-sm shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    %
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">e.g. 8.25 for 8.25% sales tax</p>
              </div>

              <div>
                <label htmlFor="shippingRate" className="block text-sm font-medium text-slate-700">
                  Flat Shipping Rate
                </label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    $
                  </span>
                  <input
                    id="shippingRate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={shippingRate}
                    onChange={(e) => setShippingRate(e.target.value)}
                    className="block w-full rounded-xl border border-slate-300 py-3 pl-8 pr-4 text-sm shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="freeShippingThreshold"
                  className="block text-sm font-medium text-slate-700"
                >
                  Free Shipping Threshold
                </label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    $
                  </span>
                  <input
                    id="freeShippingThreshold"
                    type="number"
                    step="0.01"
                    min="0"
                    value={freeShippingThreshold}
                    onChange={(e) => setFreeShippingThreshold(e.target.value)}
                    className="block w-full rounded-xl border border-slate-300 py-3 pl-8 pr-4 text-sm shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Orders above this amount get free shipping
                </p>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => {
                  setError(null);
                  setStep(1);
                }}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Back
              </button>
              <button
                onClick={handleStep2Next}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save & Continue'
                )}
              </button>
            </div>
          </Card>
        )}

        {/* ========== STEP 3: Add First Product ========== */}
        {step === 3 && (
          <Card className="p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Add Your First Product</h2>
              <p className="mt-1 text-sm text-slate-500">
                Create a product to get your catalog started. You can skip this step and add
                products later.
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label htmlFor="productName" className="block text-sm font-medium text-slate-700">
                  Product Name
                </label>
                <input
                  id="productName"
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Classic T-Shirt"
                  className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label htmlFor="productPrice" className="block text-sm font-medium text-slate-700">
                  Price
                </label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    $
                  </span>
                  <input
                    id="productPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    placeholder="29.99"
                    className="block w-full rounded-xl border border-slate-300 py-3 pl-8 pr-4 text-sm shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="productDescription"
                  className="block text-sm font-medium text-slate-700"
                >
                  Description
                </label>
                <textarea
                  id="productDescription"
                  rows={3}
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="Describe your product..."
                  className="mt-1.5 block w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Image upload */}
              <div>
                <label className="block text-sm font-medium text-slate-700">Product Image</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                />

                {!productImage ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-8 text-sm text-slate-500 transition hover:border-blue-400 hover:bg-blue-50/30 hover:text-blue-600 disabled:opacity-50"
                  >
                    {uploadingImage ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-5 w-5" />
                        Click to upload an image
                      </>
                    )}
                  </button>
                ) : (
                  <div className="mt-1.5 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <Check className="h-4 w-4 text-emerald-500" />
                      {productImageName || 'Image uploaded'}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProductImage(null);
                        setProductImageName(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => {
                  setError(null);
                  setStep(2);
                }}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Back
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSkipProduct}
                  className="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  Skip for now
                </button>
                <button
                  onClick={handleStep3Next}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : productName.trim() && productPrice.trim() ? (
                    'Create & Continue'
                  ) : (
                    'Continue'
                  )}
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* ========== STEP 4: You're Ready! ========== */}
        {step === 4 && (
          <Card className="p-6 sm:p-8">
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <PartyPopper className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">You&apos;re Ready!</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Your store is set up and ready to go. Share your store link with customers and start
                selling!
              </p>

              {storeUrl && (
                <div className="mx-auto mt-6 max-w-md">
                  <label className="block text-xs font-medium text-slate-500">Your Store URL</label>
                  <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <a
                      href={storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 truncate text-sm font-medium text-blue-600 hover:underline"
                    >
                      {storeUrl}
                    </a>
                    <button
                      onClick={() => navigator.clipboard.writeText(storeUrl)}
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3 sm:flex-row">
                <Link
                  href="/app"
                  className="flex-1 rounded-xl bg-blue-600 px-6 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  Go to Dashboard
                </Link>
                <Link
                  href="/app/products/new"
                  className="flex-1 rounded-xl border border-slate-300 px-6 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Add More Products
                </Link>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
