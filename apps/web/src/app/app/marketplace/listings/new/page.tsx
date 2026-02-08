'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Upload } from 'lucide-react';
import Link from 'next/link';

interface Connection {
  id: string;
  name: string;
  platform: string;
  marketplaceId: string;
  isConnected: boolean;
}

interface ProductListing {
  id: string;
  sku: string;
  name: string;
  description: string;
  basePrice: string;
  images: Array<{ url: string }>;
}

interface Warehouse {
  id: string;
  name: string;
  location: string;
}

export default function CreateListingPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [products, setProducts] = useState<ProductListing[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    connectionId: '',
    productListingId: '',
    warehouseId: '',
    title: '',
    description: '',
    price: '',
    quantity: '',
    condition: 'NEW',
    categoryId: '',
    autoPublish: false,
  });

  const authHeaders = () => {
    const token = localStorage.getItem('access_token') || '';
    const tenantId = localStorage.getItem('tenantId') || '';
    return {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': tenantId,
      'Content-Type': 'application/json',
    };
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Auto-fill form when product is selected
    if (formData.productListingId) {
      const product = products.find((p) => p.id === formData.productListingId);
      if (product) {
        setFormData((prev) => ({
          ...prev,
          title: product.name,
          description: product.description || '',
          price: product.basePrice || '',
        }));
      }
    }
  }, [formData.productListingId, products]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load connections
      const connectionsRes = await fetch('/api/v1/marketplace/connections', {
        headers: authHeaders(),
      });
      if (connectionsRes.ok) {
        const connectionsData = await connectionsRes.json();
        setConnections(connectionsData.filter((c: Connection) => c.isConnected));
      }

      // Load products
      const productsRes = await fetch('/api/v1/store/admin/products', {
        headers: authHeaders(),
      });
      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(Array.isArray(productsData) ? productsData : productsData.products || []);
      }

      // Load warehouses
      const warehousesRes = await fetch('/api/v1/inventory/warehouses', {
        headers: authHeaders(),
      });
      if (warehousesRes.ok) {
        const warehousesData = await warehousesRes.json();
        setWarehouses(warehousesData);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.connectionId) {
      alert('Please select an eBay store');
      return;
    }

    if (!formData.productListingId) {
      alert('Please select a product');
      return;
    }

    if (!formData.title.trim()) {
      alert('Title is required');
      return;
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      alert('Valid price is required');
      return;
    }

    if (!formData.quantity || parseInt(formData.quantity) < 0) {
      alert('Valid quantity is required');
      return;
    }

    if (!formData.categoryId) {
      alert('Category is required');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/v1/marketplace/listings', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          connectionId: formData.connectionId,
          productListingId: formData.productListingId,
          warehouseId: formData.warehouseId || undefined,
          title: formData.title,
          description: formData.description,
          price: parseFloat(formData.price),
          quantity: parseInt(formData.quantity),
          condition: formData.condition,
          categoryId: formData.categoryId,
        }),
      });

      if (res.ok) {
        const listing = await res.json();

        // Auto-publish if requested
        if (formData.autoPublish) {
          const publishRes = await fetch(
            `/api/v1/marketplace/listings/${listing.id}/publish`,
            {
              method: 'POST',
              headers: authHeaders(),
            }
          );

          if (publishRes.ok) {
            alert('Listing created and published successfully!');
          } else {
            alert('Listing created but publishing failed. You can publish it manually.');
          }
        } else {
          alert('Listing created successfully!');
        }

        router.push('/app/marketplace/listings');
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create listing');
      }
    } catch (error) {
      console.error('Failed to create listing:', error);
      alert('Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-yellow-900 mb-2">
            No Connected eBay Stores
          </h3>
          <p className="text-yellow-700 mb-4">
            You need to connect at least one eBay store before creating listings.
          </p>
          <Link
            href="/app/marketplace/connections"
            className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
          >
            Go to Connections
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/app/marketplace/listings"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Listings
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Create eBay Listing</h1>
        <p className="text-gray-600 mt-2">
          Create a new listing from your product catalog
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Connection Selection */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">eBay Store</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Store *
            </label>
            <select
              value={formData.connectionId}
              onChange={(e) => setFormData({ ...formData, connectionId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Choose an eBay store...</option>
              {connections.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name} ({conn.marketplaceId})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Product Selection */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Product</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Product *
              </label>
              <select
                value={formData.productListingId}
                onChange={(e) =>
                  setFormData({ ...formData, productListingId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Choose a product...</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku})
                  </option>
                ))}
              </select>
            </div>

            {warehouses.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Warehouse (optional)
                </label>
                <select
                  value={formData.warehouseId}
                  onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Default warehouse</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} - {warehouse.location}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Listing Details */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Listing Details</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title * <span className="text-xs text-gray-500">(max 80 characters)</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                maxLength={80}
                placeholder="Clear, descriptive title for your listing"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.title.length}/80 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={6}
                placeholder="Detailed description of your item..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price * ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Condition *
              </label>
              <select
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="NEW">New</option>
                <option value="LIKE_NEW">Like New</option>
                <option value="NEW_OTHER">New (Other)</option>
                <option value="NEW_WITH_DEFECTS">New with Defects</option>
                <option value="MANUFACTURER_REFURBISHED">Manufacturer Refurbished</option>
                <option value="CERTIFIED_REFURBISHED">Certified Refurbished</option>
                <option value="EXCELLENT_REFURBISHED">Excellent Refurbished</option>
                <option value="VERY_GOOD_REFURBISHED">Very Good Refurbished</option>
                <option value="GOOD_REFURBISHED">Good Refurbished</option>
                <option value="SELLER_REFURBISHED">Seller Refurbished</option>
                <option value="USED_EXCELLENT">Used - Excellent</option>
                <option value="USED_VERY_GOOD">Used - Very Good</option>
                <option value="USED_GOOD">Used - Good</option>
                <option value="USED_ACCEPTABLE">Used - Acceptable</option>
                <option value="FOR_PARTS_OR_NOT_WORKING">For Parts or Not Working</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category ID *
              </label>
              <input
                type="text"
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                placeholder="e.g., 9355 for Cell Phones & Smartphones"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Find eBay category IDs at{' '}
                <a
                  href="https://www.ebay.com/sellerinformation/findcategory"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  eBay Category Finder
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Publishing Options */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Publishing Options</h2>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="autoPublish"
              checked={formData.autoPublish}
              onChange={(e) => setFormData({ ...formData, autoPublish: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="autoPublish" className="ml-2 text-sm text-gray-700">
              Publish to eBay immediately after creating
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-2 ml-6">
            If unchecked, the listing will be saved as "Approved" and you can publish it
            manually later
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {formData.autoPublish ? 'Creating & Publishing...' : 'Creating...'}
              </>
            ) : (
              <>
                {formData.autoPublish ? (
                  <>
                    <Upload className="w-5 h-5" />
                    Create & Publish
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Create Listing
                  </>
                )}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
