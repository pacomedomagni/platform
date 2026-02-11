'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, X, Loader2, Save } from 'lucide-react';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';

interface Product {
  id: string;
  slug: string;
  displayName: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  isFeatured: boolean;
  isPublished: boolean;
  category?: string;
}

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  const [isDirty, setIsDirty] = useState(false);

  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useUnsavedChanges(isDirty);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('access_token');
    const tenantId = localStorage.getItem('tenantId');
    return {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': tenantId || '',
    };
  }, []);

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = getHeaders();
      const res = await fetch(`/api/v1/store/admin/products/${productId}`, {
        headers,
      });

      if (!res.ok) {
        throw new Error('Failed to load product');
      }

      const product: Product = await res.json();

      setDisplayName(product.displayName || '');
      setSlug(product.slug || '');
      setPrice(product.price?.toString() || '');
      setCompareAtPrice(product.compareAtPrice?.toString() || '');
      setDescription(product.shortDescription || '');
      setCategory(product.category || '');
      setIsFeatured(product.isFeatured || false);
      setIsPublished(product.isPublished || false);
      setImages(product.images || []);
    } catch (err: any) {
      console.error('Failed to fetch product:', err);
      setError(err.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [productId, getHeaders]);

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId, fetchProduct]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    for (let i = 0; i < files.length; i++) {
      try {
        const formData = new FormData();
        formData.append('file', files[i]);

        const headers = getHeaders();
        const res = await fetch('/api/v1/store/admin/uploads', {
          method: 'POST',
          headers: {
            Authorization: headers.Authorization,
            'x-tenant-id': headers['x-tenant-id'],
          },
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`Failed to upload ${files[i].name}`);
        }

        const data = await res.json();
        setImages((prev) => [...prev, data.url]);
        setIsDirty(true);
      } catch (err: any) {
        console.error('Upload failed:', err);
        setError(err.message || 'Image upload failed');
      }
    }

    setUploading(false);
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  const handleSubmit = async () => {
    if (!displayName.trim()) {
      setError('Product name is required');
      return;
    }

    if (!price || parseFloat(price) < 0) {
      setError('A valid price is required');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const headers = getHeaders();
      const body: Record<string, any> = {
        displayName: displayName.trim(),
        price: parseFloat(price),
        isPublished,
        isFeatured,
        images,
      };

      if (slug.trim()) {
        body.slug = slug.trim();
      }
      if (description.trim()) {
        body.shortDescription = description.trim();
      }
      if (compareAtPrice) {
        body.compareAtPrice = parseFloat(compareAtPrice);
      } else {
        body.compareAtPrice = null;
      }
      if (category.trim()) {
        body.category = category.trim();
      }

      const res = await fetch(`/api/v1/store/admin/products/${productId}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || 'Failed to update product');
      }

      setIsDirty(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to update product:', err);
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm text-slate-500">Loading product...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div>
          <Link
            href="/app/products"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Products
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Edit Product
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Update your product details below.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
            Product updated successfully.
          </div>
        )}

        {/* Form */}
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Basic Information
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="displayName"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => { setDisplayName(e.target.value); setIsDirty(true); }}
                  placeholder="e.g. Organic Cotton T-Shirt"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="slug"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Slug
                </label>
                <input
                  id="slug"
                  type="text"
                  value={slug}
                  onChange={(e) => { setSlug(e.target.value); setIsDirty(true); }}
                  placeholder="organic-cotton-t-shirt"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
                <p className="mt-1 text-xs text-slate-400">
                  URL-friendly identifier. Leave empty to auto-generate.
                </p>
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); setIsDirty(true); }}
                  placeholder="Brief description of this product..."
                  rows={4}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="category"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Category
                </label>
                <input
                  id="category"
                  type="text"
                  value={category}
                  onChange={(e) => { setCategory(e.target.value); setIsDirty(true); }}
                  placeholder="e.g. Apparel, Electronics"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Pricing
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="price"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Price <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    $
                  </span>
                  <input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => { setPrice(e.target.value); setIsDirty(true); }}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-8 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="compareAtPrice"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Compare-at Price
                </label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    $
                  </span>
                  <input
                    id="compareAtPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={compareAtPrice}
                    onChange={(e) => { setCompareAtPrice(e.target.value); setIsDirty(true); }}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-8 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Set a higher price to show a discount on your storefront.
                </p>
              </div>
            </div>
          </div>

          {/* Images */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Images
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Upload product images. The first image will be used as the main thumbnail.
            </p>

            {/* Uploaded Image Thumbnails */}
            {images.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {images.map((url, idx) => (
                  <div
                    key={idx}
                    className="group relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600"
                  >
                    <img
                      src={url}
                      alt={`Product image ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    {idx === 0 && (
                      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        Main
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Upload Area */}
            <div className="mt-4">
              <label
                htmlFor="image-upload"
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-8 transition-colors hover:border-blue-400 hover:bg-blue-50/30 dark:border-slate-600 dark:bg-slate-700/30 dark:hover:border-blue-500"
              >
                {uploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                ) : (
                  <Upload className="h-8 w-8 text-slate-400" />
                )}
                <span className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                  {uploading ? 'Uploading...' : 'Click to upload images'}
                </span>
                <span className="mt-1 text-xs text-slate-400">
                  PNG, JPG, WEBP up to 10MB
                </span>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Options */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Options
            </h2>
            <div className="mt-4 space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => { setIsPublished(e.target.checked); setIsDirty(true); }}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Published
                  </span>
                  <p className="text-xs text-slate-500">
                    Published products are visible in your storefront.
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => { setIsFeatured(e.target.checked); setIsDirty(true); }}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Featured Product
                  </span>
                  <p className="text-xs text-slate-500">
                    Featured products are highlighted on your storefront.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end dark:border-slate-700">
            <Link
              href="/app/products"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
