'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@platform/ui';
import {
  ArrowLeft,
  Save,
  Upload,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ImageIcon,
  Package,
  Calendar,
  Info,
  Loader2,
  MapPin,
} from 'lucide-react';
import Link from 'next/link';
import { unwrapJson } from '@/lib/admin-fetch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface CategorySearchResult {
  categoryId: string;
  categoryName: string;
}

interface AspectValue {
  localizedValue: string;
}

interface Aspect {
  localizedAspectName: string;
  aspectConstraint: {
    aspectRequired?: boolean;
    aspectMode?: string;
  };
  aspectValues?: AspectValue[];
}

interface PolicyInfo {
  id: string;
  name: string;
}

interface ConnectionStatus {
  fulfillmentPolicies?: PolicyInfo[];
  paymentPolicies?: PolicyInfo[];
  returnPolicies?: PolicyInfo[];
}

interface InventoryLocation {
  merchantLocationKey: string;
  name: string;
  location?: {
    city?: string;
    stateOrProvince?: string;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONDITION_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'LIKE_NEW', label: 'Like New' },
  { value: 'NEW_OTHER', label: 'New (Other)' },
  { value: 'NEW_WITH_DEFECTS', label: 'New with Defects' },
  { value: 'MANUFACTURER_REFURBISHED', label: 'Manufacturer Refurbished' },
  { value: 'CERTIFIED_REFURBISHED', label: 'Certified Refurbished' },
  { value: 'EXCELLENT_REFURBISHED', label: 'Excellent Refurbished' },
  { value: 'VERY_GOOD_REFURBISHED', label: 'Very Good Refurbished' },
  { value: 'GOOD_REFURBISHED', label: 'Good Refurbished' },
  { value: 'SELLER_REFURBISHED', label: 'Seller Refurbished' },
  { value: 'USED_EXCELLENT', label: 'Used - Excellent' },
  { value: 'USED_VERY_GOOD', label: 'Used - Very Good' },
  { value: 'USED_GOOD', label: 'Used - Good' },
  { value: 'USED_ACCEPTABLE', label: 'Used - Acceptable' },
  { value: 'FOR_PARTS_OR_NOT_WORKING', label: 'For Parts or Not Working' },
  { value: 'PRE_OWNED_EXCELLENT', label: 'Pre-Owned - Excellent' },
  { value: 'PRE_OWNED_FAIR', label: 'Pre-Owned - Fair' },
];

const WEIGHT_UNITS = [
  { value: 'POUND', label: 'lb' },
  { value: 'KILOGRAM', label: 'kg' },
  { value: 'OUNCE', label: 'oz' },
  { value: 'GRAM', label: 'g' },
];

const DIMENSION_UNITS = [
  { value: 'INCH', label: 'in' },
  { value: 'CENTIMETER', label: 'cm' },
  { value: 'FEET', label: 'ft' },
];

const AUCTION_DURATIONS = [
  { value: 'DAYS_1', label: '1 day' },
  { value: 'DAYS_3', label: '3 days' },
  { value: 'DAYS_5', label: '5 days' },
  { value: 'DAYS_7', label: '7 days' },
  { value: 'DAYS_10', label: '10 days' },
  { value: 'DAYS_21', label: '21 days' },
  { value: 'DAYS_30', label: '30 days' },
];

const PACKAGE_TYPES = [
  { value: '', label: 'Not specified' },
  { value: 'LETTER', label: 'Letter' },
  { value: 'LARGE_ENVELOPE', label: 'Large Envelope' },
  { value: 'PACKAGE_THICK_ENVELOPE', label: 'Package / Thick Envelope' },
  { value: 'MAILING_BOX', label: 'Mailing Box' },
  { value: 'EXTRA_LARGE_PACK', label: 'Extra Large Pack' },
  { value: 'VERY_LARGE_PACK', label: 'Very Large Pack' },
  { value: 'BULKY_GOODS', label: 'Bulky Goods' },
  { value: 'PADDED_BAGS', label: 'Padded Bags' },
  { value: 'TOUGH_BAGS', label: 'Tough Bags' },
  { value: 'UPS_LETTER', label: 'UPS Letter' },
  { value: 'USPS_FLAT_RATE_ENVELOPE', label: 'USPS Flat Rate Envelope' },
  { value: 'USPS_LARGE_PACK', label: 'USPS Large Pack' },
];

const COUNTRY_CODES = [
  { value: '', label: 'Not specified' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'IT', label: 'Italy' },
  { value: 'ES', label: 'Spain' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function getMaxScheduleDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 21);
  return d.toISOString().slice(0, 16);
}

function getNowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateListingPage() {
  const router = useRouter();

  // ---- Data sources ----
  const [connections, setConnections] = useState<Connection[]>([]);
  const [products, setProducts] = useState<ProductListing[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // ---- Category search ----
  const [categoryQuery, setCategoryQuery] = useState('');
  const [categoryResults, setCategoryResults] = useState<CategorySearchResult[]>([]);
  const [categorySearching, setCategorySearching] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [selectedCategoryName, setSelectedCategoryName] = useState('');
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const debouncedCategoryQuery = useDebounce(categoryQuery, 300);

  // ---- Aspects ----
  const [aspects, setAspects] = useState<Aspect[]>([]);
  const [aspectsLoading, setAspectsLoading] = useState(false);
  const [itemSpecifics, setItemSpecifics] = useState<Record<string, string>>({});

  // ---- Policies ----
  const [fulfillmentPolicies, setFulfillmentPolicies] = useState<PolicyInfo[]>([]);
  const [paymentPolicies, setPaymentPolicies] = useState<PolicyInfo[]>([]);
  const [returnPolicies, setReturnPolicies] = useState<PolicyInfo[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);

  // ---- Inventory locations ----
  const [inventoryLocations, setInventoryLocations] = useState<InventoryLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);

  // ---- Images ----
  const [photos, setPhotos] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // ---- Collapsible sections ----
  const [showPackageDetails, setShowPackageDetails] = useState(false);
  const [showScheduling, setShowScheduling] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showListingOptions, setShowListingOptions] = useState(false);
  const [showItemLocation, setShowItemLocation] = useState(false);

  // ---- Form data ----
  const [formData, setFormData] = useState({
    connectionId: '',
    productListingId: '',
    warehouseId: '',
    title: '',
    subtitle: '',
    description: '',
    sku: '',
    categoryId: '',
    secondaryCategoryId: '',
    condition: 'NEW',
    conditionDescription: '',
    format: 'FIXED_PRICE' as 'FIXED_PRICE' | 'AUCTION',
    price: '',
    quantity: '',
    bestOfferEnabled: false,
    autoAcceptPrice: '',
    autoDeclinePrice: '',
    startPrice: '',
    reservePrice: '',
    buyItNowPrice: '',
    listingDuration: 'DAYS_7',
    brand: '',
    mpn: '',
    upc: '',
    ean: '',
    isbn: '',
    privateListing: false,
    lotSize: '',
    epid: '',
    packageType: '',
    packageWeightValue: '',
    packageWeightUnit: 'POUND',
    packageDimensionLength: '',
    packageDimensionWidth: '',
    packageDimensionHeight: '',
    packageDimensionUnit: 'INCH',
    itemLocationCity: '',
    itemLocationState: '',
    itemLocationPostalCode: '',
    itemLocationCountry: '',
    fulfillmentPolicyId: '',
    paymentPolicyId: '',
    returnPolicyId: '',
    merchantLocationKey: '',
    scheduledStartTime: '',
    autoPublish: false,
  });

  // ---- Convenience updater ----
  const updateField = useCallback(
    <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // ---- Initial data load ----
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [connectionsRes, productsRes, warehousesRes] = await Promise.all([
        fetch('/api/v1/marketplace/connections', { credentials: 'include' }),
        fetch('/api/v1/products/listings', { credentials: 'include' }),
        fetch('/api/v1/warehouses', { credentials: 'include' }),
      ]);

      if (connectionsRes.ok) {
        const data = unwrapJson<Connection[]>(await connectionsRes.json());
        setConnections(data.filter((c) => c.isConnected));
      }
      if (productsRes.ok) {
        const data = unwrapJson<ProductListing[]>(await productsRes.json());
        setProducts(data);
      }
      if (warehousesRes.ok) {
        const data = unwrapJson<Warehouse[]>(await warehousesRes.json());
        setWarehouses(data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ---- Auto-fill when product is selected ----
  useEffect(() => {
    if (formData.productListingId) {
      const product = products.find((p) => p.id === formData.productListingId);
      if (product) {
        setFormData((prev) => ({
          ...prev,
          title: product.name.slice(0, 80),
          description: product.description || '',
          price: product.basePrice || '',
          sku: product.sku || '',
        }));
        const productImages = (product.images || []).map((img) => img.url).filter(Boolean);
        setPhotos(productImages);
      }
    }
  }, [formData.productListingId, products]);

  // ---- Load policies + locations when connection changes ----
  useEffect(() => {
    if (!formData.connectionId) {
      setFulfillmentPolicies([]);
      setPaymentPolicies([]);
      setReturnPolicies([]);
      setInventoryLocations([]);
      return;
    }
    loadPolicies(formData.connectionId);
    loadInventoryLocations(formData.connectionId);
  }, [formData.connectionId]);

  const loadPolicies = async (connectionId: string) => {
    setPoliciesLoading(true);
    try {
      const res = await fetch(`/api/v1/marketplace/connections/${connectionId}/status`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = unwrapJson<ConnectionStatus>(await res.json());
        setFulfillmentPolicies(data.fulfillmentPolicies || []);
        setPaymentPolicies(data.paymentPolicies || []);
        setReturnPolicies(data.returnPolicies || []);
      }
    } catch (error) {
      console.error('Failed to load policies:', error);
    } finally {
      setPoliciesLoading(false);
    }
  };

  const loadInventoryLocations = async (connectionId: string) => {
    setLocationsLoading(true);
    try {
      const res = await fetch(
        `/api/v1/marketplace/inventory-locations?connectionId=${connectionId}`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const data = unwrapJson<InventoryLocation[]>(await res.json());
        setInventoryLocations(data);
      }
    } catch (error) {
      console.error('Failed to load inventory locations:', error);
    } finally {
      setLocationsLoading(false);
    }
  };

  // ---- Category search ----
  useEffect(() => {
    if (!debouncedCategoryQuery.trim() || !formData.connectionId) {
      setCategoryResults([]);
      return;
    }
    searchCategories(debouncedCategoryQuery.trim());
  }, [debouncedCategoryQuery, formData.connectionId]);

  const searchCategories = async (query: string) => {
    setCategorySearching(true);
    try {
      const res = await fetch(
        `/api/v1/marketplace/ebay/taxonomy/categories/search?connectionId=${formData.connectionId}&q=${encodeURIComponent(query)}`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const data = unwrapJson<CategorySearchResult[]>(await res.json());
        setCategoryResults(data);
        setShowCategoryDropdown(true);
      }
    } catch (error) {
      console.error('Failed to search categories:', error);
    } finally {
      setCategorySearching(false);
    }
  };

  const selectCategory = async (category: CategorySearchResult) => {
    updateField('categoryId', category.categoryId);
    setSelectedCategoryName(category.categoryName);
    setCategoryQuery('');
    setShowCategoryDropdown(false);
    setCategoryResults([]);

    // Fetch aspects for the selected category
    setAspectsLoading(true);
    try {
      const res = await fetch(
        `/api/v1/marketplace/ebay/taxonomy/categories/${category.categoryId}/aspects?connectionId=${formData.connectionId}`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const data = unwrapJson<Aspect[]>(await res.json());
        setAspects(data);
        // Pre-populate aspect fields with empty values
        const initial: Record<string, string> = {};
        data.forEach((a) => {
          initial[a.localizedAspectName] = '';
        });
        setItemSpecifics(initial);
      }
    } catch (error) {
      console.error('Failed to load aspects:', error);
    } finally {
      setAspectsLoading(false);
    }
  };

  const clearCategory = () => {
    updateField('categoryId', '');
    setSelectedCategoryName('');
    setAspects([]);
    setItemSpecifics({});
  };

  // Close category dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ---- Image management ----
  const handleAddImageUrl = async () => {
    if (!newImageUrl.trim()) return;
    setUploadingImage(true);
    try {
      const res = await fetch('/api/v1/marketplace/media/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: newImageUrl.trim() }),
      });
      if (res.ok) {
        const data = unwrapJson<{ url: string }>(await res.json());
        setPhotos((prev) => [...prev, data.url || newImageUrl.trim()]);
        setNewImageUrl('');
      } else {
        // Fallback: add the raw URL
        setPhotos((prev) => [...prev, newImageUrl.trim()]);
        setNewImageUrl('');
      }
    } catch {
      // Fallback: add the raw URL directly
      setPhotos((prev) => [...prev, newImageUrl.trim()]);
      setNewImageUrl('');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const newPhotos = [...photos];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newPhotos.length) return;
    [newPhotos[index], newPhotos[targetIndex]] = [newPhotos[targetIndex], newPhotos[index]];
    setPhotos(newPhotos);
  };

  // ---- Validation ----
  const validate = (): boolean => {
    if (!formData.connectionId) {
      toast({ title: 'Validation Error', description: 'Please select an eBay store', variant: 'destructive' });
      return false;
    }
    if (!formData.productListingId) {
      toast({ title: 'Validation Error', description: 'Please select a product', variant: 'destructive' });
      return false;
    }
    if (!formData.title.trim()) {
      toast({ title: 'Validation Error', description: 'Title is required', variant: 'destructive' });
      return false;
    }
    if (!formData.categoryId) {
      toast({ title: 'Validation Error', description: 'Category is required', variant: 'destructive' });
      return false;
    }
    if (formData.format === 'FIXED_PRICE') {
      if (!formData.price || parseFloat(formData.price) <= 0) {
        toast({ title: 'Validation Error', description: 'Valid price is required for Fixed Price listing', variant: 'destructive' });
        return false;
      }
      if (!formData.quantity || parseInt(formData.quantity) < 1) {
        toast({ title: 'Validation Error', description: 'Quantity must be at least 1', variant: 'destructive' });
        return false;
      }
    }
    if (formData.format === 'AUCTION') {
      if (!formData.startPrice || parseFloat(formData.startPrice) <= 0) {
        toast({ title: 'Validation Error', description: 'Starting bid is required for Auction listing', variant: 'destructive' });
        return false;
      }
    }
    // Check required aspects
    const requiredAspects = aspects.filter((a) => a.aspectConstraint?.aspectRequired);
    for (const aspect of requiredAspects) {
      const value = itemSpecifics[aspect.localizedAspectName];
      if (!value || !value.trim()) {
        toast({
          title: 'Validation Error',
          description: `"${aspect.localizedAspectName}" is a required item specific`,
          variant: 'destructive',
        });
        return false;
      }
    }
    return true;
  };

  // ---- Submit ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);

    // Build item specifics as { name: [values] }
    const cleanedSpecifics: Record<string, string[]> = {};
    for (const [key, val] of Object.entries(itemSpecifics)) {
      if (val && val.trim()) {
        cleanedSpecifics[key] = val.split(',').map((v) => v.trim()).filter(Boolean);
      }
    }

    try {
      const body: Record<string, unknown> = {
        connectionId: formData.connectionId,
        productListingId: formData.productListingId,
        warehouseId: formData.warehouseId || undefined,
        title: formData.title,
        subtitle: formData.subtitle || undefined,
        description: formData.description,
        price: formData.format === 'FIXED_PRICE'
          ? parseFloat(formData.price)
          : (formData.buyItNowPrice ? parseFloat(formData.buyItNowPrice) : parseFloat(formData.startPrice)),
        quantity: formData.format === 'FIXED_PRICE' ? parseInt(formData.quantity) : 1,
        condition: formData.condition,
        conditionDescription: formData.conditionDescription || undefined,
        categoryId: formData.categoryId,
        secondaryCategoryId: formData.secondaryCategoryId || undefined,
        format: formData.format,
        listingDuration: formData.format === 'AUCTION' ? formData.listingDuration : 'GTC',
        bestOfferEnabled: formData.format === 'FIXED_PRICE' ? formData.bestOfferEnabled : false,
        autoAcceptPrice: formData.bestOfferEnabled && formData.autoAcceptPrice ? parseFloat(formData.autoAcceptPrice) : undefined,
        autoDeclinePrice: formData.bestOfferEnabled && formData.autoDeclinePrice ? parseFloat(formData.autoDeclinePrice) : undefined,
        startPrice: formData.format === 'AUCTION' && formData.startPrice ? parseFloat(formData.startPrice) : undefined,
        reservePrice: formData.format === 'AUCTION' && formData.reservePrice ? parseFloat(formData.reservePrice) : undefined,
        buyItNowPrice: formData.format === 'AUCTION' && formData.buyItNowPrice ? parseFloat(formData.buyItNowPrice) : undefined,
        privateListing: formData.privateListing || undefined,
        lotSize: formData.lotSize && parseInt(formData.lotSize) > 0 ? parseInt(formData.lotSize) : undefined,
        epid: formData.epid || undefined,
        itemSpecifics: cleanedSpecifics,
        photos,
        packageType: formData.packageType || undefined,
        weightValue: formData.packageWeightValue ? parseFloat(formData.packageWeightValue) : undefined,
        weightUnit: formData.packageWeightValue ? formData.packageWeightUnit : undefined,
        dimensionLength: formData.packageDimensionLength ? parseFloat(formData.packageDimensionLength) : undefined,
        dimensionWidth: formData.packageDimensionWidth ? parseFloat(formData.packageDimensionWidth) : undefined,
        dimensionHeight: formData.packageDimensionHeight ? parseFloat(formData.packageDimensionHeight) : undefined,
        dimensionUnit: formData.packageDimensionLength ? formData.packageDimensionUnit : undefined,
        itemLocationCity: formData.itemLocationCity || undefined,
        itemLocationState: formData.itemLocationState || undefined,
        itemLocationPostalCode: formData.itemLocationPostalCode || undefined,
        itemLocationCountry: formData.itemLocationCountry || undefined,
        fulfillmentPolicyId: formData.fulfillmentPolicyId || undefined,
        paymentPolicyId: formData.paymentPolicyId || undefined,
        returnPolicyId: formData.returnPolicyId || undefined,
        merchantLocationKey: formData.merchantLocationKey || undefined,
        platformData: {
          brand: formData.brand || undefined,
          mpn: formData.mpn || undefined,
          upc: formData.upc || undefined,
          ean: formData.ean || undefined,
          isbn: formData.isbn || undefined,
        },
      };

      const res = await fetch('/api/v1/marketplace/ebay/listings/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const listing = unwrapJson<{ id: string }>(await res.json());

        // Handle scheduling
        if (formData.scheduledStartTime) {
          try {
            await fetch(`/api/v1/marketplace/listings/${listing.id}/schedule`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ scheduledDate: new Date(formData.scheduledStartTime).toISOString() }),
            });
            toast({ title: 'Success', description: 'Listing created and scheduled successfully!' });
          } catch {
            toast({ title: 'Warning', description: 'Listing created but scheduling failed. You can schedule it manually.', variant: 'destructive' });
          }
        } else if (formData.autoPublish) {
          // Auto-publish
          const publishRes = await fetch(`/api/v1/marketplace/listings/${listing.id}/publish`, {
            method: 'POST',
            credentials: 'include',
          });

          if (publishRes.ok) {
            toast({ title: 'Success', description: 'Listing created and published successfully!' });
          } else {
            toast({ title: 'Warning', description: 'Listing created but publishing failed. You can publish it manually.', variant: 'destructive' });
          }
        } else {
          toast({ title: 'Success', description: 'Listing created successfully!' });
        }

        router.push('/app/marketplace/listings');
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to create listing', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to create listing:', error);
      toast({ title: 'Error', description: 'Failed to create listing', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Derived data ----
  const requiredAspects = aspects.filter((a) => a.aspectConstraint?.aspectRequired);
  const recommendedAspects = aspects.filter((a) => !a.aspectConstraint?.aspectRequired);
  const selectedProduct = products.find((p) => p.id === formData.productListingId);

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ---- No connections state ----
  if (connections.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-yellow-900 mb-2">No Connected eBay Stores</h3>
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

  // ---- Main render ----
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
        <p className="text-gray-600 mt-2">Create a new listing from your product catalog</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ================================================================ */}
        {/* Section 1: Store & Product                                       */}
        {/* ================================================================ */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Store &amp; Product</h2>

          <div className="space-y-4">
            {/* Connection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                eBay Store *
              </label>
              <select
                value={formData.connectionId}
                onChange={(e) => updateField('connectionId', e.target.value)}
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

            {/* Product */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product *
              </label>
              <select
                value={formData.productListingId}
                onChange={(e) => updateField('productListingId', e.target.value)}
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

            {/* Warehouse */}
            {warehouses.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Warehouse (optional)
                </label>
                <select
                  value={formData.warehouseId}
                  onChange={(e) => updateField('warehouseId', e.target.value)}
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

        {/* ================================================================ */}
        {/* Section 2: Listing Details                                       */}
        {/* ================================================================ */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Listing Details</h2>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title * <span className="text-xs text-gray-500">(max 80 characters)</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value.slice(0, 80))}
                maxLength={80}
                placeholder="Clear, descriptive title for your listing"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className={`text-xs mt-1 ${formData.title.length >= 75 ? 'text-orange-600' : 'text-gray-500'}`}>
                {formData.title.length}/80 characters
              </p>
            </div>

            {/* Subtitle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subtitle (paid upgrade){' '}
                <span className="text-xs text-gray-500">(max 55 characters)</span>
              </label>
              <input
                type="text"
                value={formData.subtitle}
                onChange={(e) => updateField('subtitle', e.target.value.slice(0, 55))}
                maxLength={55}
                placeholder="Optional subtitle shown below title in search results"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-gray-500">
                  Appears below title in search results. eBay charges extra for this.
                </p>
                <span className={`text-xs ${formData.subtitle.length >= 50 ? 'text-orange-600' : 'text-gray-500'}`}>
                  {formData.subtitle.length}/55
                </span>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={10}
                placeholder="Detailed description of your item. HTML is supported for rich formatting (e.g. <b>bold</b>, <ul><li>list items</li></ul>)."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                HTML formatting is supported. Use tags like &lt;b&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;br&gt; for rich content.
              </p>
            </div>

            {/* SKU (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <input
                type="text"
                value={formData.sku}
                readOnly
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                placeholder="Auto-generated from product"
              />
              <p className="text-xs text-gray-500 mt-1">
                Automatically set from the selected product. Read-only.
              </p>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* Section 3: Category & Item Specifics                             */}
        {/* ================================================================ */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Category &amp; Item Specifics</h2>

          <div className="space-y-4">
            {/* Category search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>

              {formData.categoryId ? (
                <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-blue-50">
                  <span className="flex-1 text-sm text-gray-900">
                    {selectedCategoryName}{' '}
                    <span className="text-gray-500">(ID: {formData.categoryId})</span>
                  </span>
                  <button
                    type="button"
                    onClick={clearCategory}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative" ref={categoryDropdownRef}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={categoryQuery}
                      onChange={(e) => {
                        setCategoryQuery(e.target.value);
                        if (e.target.value.trim()) {
                          setShowCategoryDropdown(true);
                        }
                      }}
                      onFocus={() => {
                        if (categoryResults.length > 0) setShowCategoryDropdown(true);
                      }}
                      placeholder={
                        formData.connectionId
                          ? 'Search for a category (e.g. "Cell Phones", "Laptops")...'
                          : 'Select an eBay store first to search categories'
                      }
                      disabled={!formData.connectionId}
                      className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                    {categorySearching && (
                      <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                    )}
                  </div>

                  {showCategoryDropdown && categoryResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {categoryResults.map((cat) => (
                        <button
                          key={cat.categoryId}
                          type="button"
                          onClick={() => selectCategory(cat)}
                          className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                        >
                          <span className="text-sm font-medium text-gray-900">
                            {cat.categoryName}
                          </span>
                          <span className="text-xs text-gray-500 ml-2">
                            ID: {cat.categoryId}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {showCategoryDropdown && categoryQuery.trim() && !categorySearching && categoryResults.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-sm text-gray-500">
                      No categories found for &quot;{categoryQuery}&quot;
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Second Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Second Category ID (optional, paid)
              </label>
              <input
                type="text"
                value={formData.secondaryCategoryId}
                onChange={(e) => updateField('secondaryCategoryId', e.target.value)}
                placeholder="e.g. 15032"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                eBay charges a fee for listing in two categories
              </p>
            </div>

            {/* Aspects loading */}
            {aspectsLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading item specifics for this category...
              </div>
            )}

            {/* Required aspects */}
            {requiredAspects.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1">
                  Required Item Specifics
                  <span className="text-red-500">*</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {requiredAspects.map((aspect) => (
                    <div key={aspect.localizedAspectName}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {aspect.localizedAspectName} *
                      </label>
                      <input
                        type="text"
                        value={itemSpecifics[aspect.localizedAspectName] || ''}
                        onChange={(e) =>
                          setItemSpecifics((prev) => ({
                            ...prev,
                            [aspect.localizedAspectName]: e.target.value,
                          }))
                        }
                        placeholder={
                          aspect.aspectValues && aspect.aspectValues.length > 0
                            ? `e.g. ${aspect.aspectValues.slice(0, 3).map((v) => v.localizedValue).join(', ')}`
                            : 'Enter value (comma-separated for multiple)'
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        required
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended aspects */}
            {recommendedAspects.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3">
                  Recommended Item Specifics
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {recommendedAspects.map((aspect) => (
                    <div key={aspect.localizedAspectName}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {aspect.localizedAspectName}
                      </label>
                      <input
                        type="text"
                        value={itemSpecifics[aspect.localizedAspectName] || ''}
                        onChange={(e) =>
                          setItemSpecifics((prev) => ({
                            ...prev,
                            [aspect.localizedAspectName]: e.target.value,
                          }))
                        }
                        placeholder={
                          aspect.aspectValues && aspect.aspectValues.length > 0
                            ? `e.g. ${aspect.aspectValues.slice(0, 3).map((v) => v.localizedValue).join(', ')}`
                            : 'Enter value (comma-separated for multiple)'
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* Section 4: Product Identifiers                                   */}
        {/* ================================================================ */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Identifiers</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => updateField('brand', e.target.value)}
                placeholder="e.g. Apple, Samsung, Nike"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                MPN (Manufacturer Part Number)
              </label>
              <input
                type="text"
                value={formData.mpn}
                onChange={(e) => updateField('mpn', e.target.value)}
                placeholder="e.g. A2849, SM-S928U"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UPC</label>
              <input
                type="text"
                value={formData.upc}
                onChange={(e) => updateField('upc', e.target.value)}
                placeholder="Does not apply"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">EAN</label>
              <input
                type="text"
                value={formData.ean}
                onChange={(e) => updateField('ean', e.target.value)}
                placeholder="e.g. 5901234123457"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
              <input
                type="text"
                value={formData.isbn}
                onChange={(e) => updateField('isbn', e.target.value)}
                placeholder="e.g. 978-3-16-148410-0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* Section 5: Condition                                             */}
        {/* ================================================================ */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Condition</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Condition *
              </label>
              <select
                value={formData.condition}
                onChange={(e) => updateField('condition', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                {CONDITION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Condition Description
              </label>
              <textarea
                value={formData.conditionDescription}
                onChange={(e) => updateField('conditionDescription', e.target.value)}
                rows={3}
                placeholder="Describe the actual condition of the item (recommended for used or refurbished items). E.g. &quot;Minor scratches on the back, fully functional, battery health 92%&quot;"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Recommended for non-new items. Helps buyers understand the exact condition.
              </p>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* Section 6: Pricing & Format                                      */}
        {/* ================================================================ */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pricing &amp; Format</h2>

          <div className="space-y-4">
            {/* Format toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Listing Format *
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="format"
                    value="FIXED_PRICE"
                    checked={formData.format === 'FIXED_PRICE'}
                    onChange={() => updateField('format', 'FIXED_PRICE')}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">Fixed Price</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="format"
                    value="AUCTION"
                    checked={formData.format === 'AUCTION'}
                    onChange={() => updateField('format', 'AUCTION')}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900">Auction</span>
                </label>
              </div>
            </div>

            {/* Fixed Price fields */}
            {formData.format === 'FIXED_PRICE' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={formData.price}
                        onChange={(e) => updateField('price', e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => updateField('quantity', e.target.value)}
                      placeholder="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                {/* Best Offer */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="bestOfferEnabled"
                      checked={formData.bestOfferEnabled}
                      onChange={(e) => updateField('bestOfferEnabled', e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="bestOfferEnabled" className="ml-2 text-sm font-medium text-gray-700">
                      Allow Best Offer
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    Let buyers submit offers below your listed price.
                  </p>

                  {formData.bestOfferEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 ml-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Auto Accept Price
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.autoAcceptPrice}
                            onChange={(e) => updateField('autoAcceptPrice', e.target.value)}
                            placeholder="Optional"
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Automatically accept offers at or above this price.
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Auto Decline Price
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.autoDeclinePrice}
                            onChange={(e) => updateField('autoDeclinePrice', e.target.value)}
                            placeholder="Optional"
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Automatically decline offers below this price.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Auction fields */}
            {formData.format === 'AUCTION' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Starting Bid *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={formData.startPrice}
                        onChange={(e) => updateField('startPrice', e.target.value)}
                        placeholder="0.99"
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reserve Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.reservePrice}
                        onChange={(e) => updateField('reservePrice', e.target.value)}
                        placeholder="Optional"
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Minimum price you are willing to accept. Hidden from buyers.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Buy It Now Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.buyItNowPrice}
                        onChange={(e) => updateField('buyItNowPrice', e.target.value)}
                        placeholder="Optional"
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Allow buyers to purchase immediately at this price.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Listing Duration *
                    </label>
                    <select
                      value={formData.listingDuration}
                      onChange={(e) => updateField('listingDuration', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {AUCTION_DURATIONS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* Section 7: Images                                                */}
        {/* ================================================================ */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-gray-500" />
            Images
          </h2>

          <div className="space-y-4">
            {/* Image thumbnails */}
            {photos.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">
                  {photos.length} image{photos.length !== 1 ? 's' : ''}. The first image will be the gallery (main) image. Drag to reorder.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {photos.map((url, index) => (
                    <div
                      key={`${url}-${index}`}
                      className="relative group border border-gray-200 rounded-lg overflow-hidden bg-gray-50"
                    >
                      <div className="aspect-square relative">
                        <img
                          src={url}
                          alt={`Listing image ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '';
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        {index === 0 && (
                          <span className="absolute top-1 left-1 bg-blue-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                            MAIN
                          </span>
                        )}
                      </div>
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => moveImage(index, 'up')}
                          disabled={index === 0}
                          className="p-1 bg-white rounded shadow text-gray-700 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move left"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(index, 'down')}
                          disabled={index === photos.length - 1}
                          className="p-1 bg-white rounded shadow text-gray-700 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move right"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="p-1 bg-white rounded shadow text-gray-700 hover:text-red-600"
                          title="Remove"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  {selectedProduct
                    ? 'No images found on the selected product. Add image URLs below.'
                    : 'Select a product to inherit its images, or add image URLs below.'}
                </p>
              </div>
            )}

            {/* Add image by URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Add Image by URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddImageUrl();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  disabled={!newImageUrl.trim() || uploadingImage}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {uploadingImage ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Add
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                eBay supports up to 24 images. Use high-quality images (min 500x500px recommended).
              </p>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* Section 7b: Listing Options (collapsible)                       */}
        {/* ================================================================ */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <button
            type="button"
            onClick={() => setShowListingOptions(!showListingOptions)}
            className="w-full flex items-center justify-between p-6 text-left"
          >
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Info className="w-5 h-5 text-gray-500" />
              Listing Options
              <span className="text-sm font-normal text-gray-500">(optional)</span>
            </h2>
            {showListingOptions ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showListingOptions && (
            <div className="px-6 pb-6 space-y-4">
              {/* Private Listing */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="privateListing"
                  checked={formData.privateListing}
                  onChange={(e) => updateField('privateListing', e.target.checked)}
                  className="w-4 h-4 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <label htmlFor="privateListing" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Private listing
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Hides buyer identity in feedback and sales history
                  </p>
                </div>
              </div>

              {/* Lot Size - only for FIXED_PRICE */}
              {formData.format === 'FIXED_PRICE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lot Size
                  </label>
                  <input
                    type="number"
                    min="2"
                    value={formData.lotSize}
                    onChange={(e) => updateField('lotSize', e.target.value)}
                    placeholder="Leave empty for single items"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Number of items in a lot (leave empty for single items)
                  </p>
                </div>
              )}

              {/* ePID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  eBay Product ID (ePID)
                </label>
                <input
                  type="text"
                  value={formData.epid}
                  onChange={(e) => updateField('epid', e.target.value)}
                  placeholder="e.g. 2254000011"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Link to eBay catalog product for enhanced search placement
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ================================================================ */}
        {/* Section 8: Package Details (collapsible)                         */}
        {/* ================================================================ */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <button
            type="button"
            onClick={() => setShowPackageDetails(!showPackageDetails)}
            className="w-full flex items-center justify-between p-6 text-left"
          >
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-gray-500" />
              Package Details
              <span className="text-sm font-normal text-gray-500">(optional)</span>
            </h2>
            {showPackageDetails ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showPackageDetails && (
            <div className="px-6 pb-6 space-y-4">
              {/* Package Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Package Type</label>
                <select
                  value={formData.packageType}
                  onChange={(e) => updateField('packageType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {PACKAGE_TYPES.map((pt) => (
                    <option key={pt.value} value={pt.value}>
                      {pt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Weight */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.packageWeightValue}
                    onChange={(e) => updateField('packageWeightValue', e.target.value)}
                    placeholder="0.00"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={formData.packageWeightUnit}
                    onChange={(e) => updateField('packageWeightUnit', e.target.value)}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {WEIGHT_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dimensions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dimensions (L x W x H)
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.packageDimensionLength}
                    onChange={(e) => updateField('packageDimensionLength', e.target.value)}
                    placeholder="Length"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-400">x</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.packageDimensionWidth}
                    onChange={(e) => updateField('packageDimensionWidth', e.target.value)}
                    placeholder="Width"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-400">x</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.packageDimensionHeight}
                    onChange={(e) => updateField('packageDimensionHeight', e.target.value)}
                    placeholder="Height"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={formData.packageDimensionUnit}
                    onChange={(e) => updateField('packageDimensionUnit', e.target.value)}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {DIMENSION_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================================================================ */}
        {/* Section 8b: Item Location (collapsible)                          */}
        {/* ================================================================ */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <button
            type="button"
            onClick={() => setShowItemLocation(!showItemLocation)}
            className="w-full flex items-center justify-between p-6 text-left"
          >
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-gray-500" />
              Item Location
              <span className="text-sm font-normal text-gray-500">(optional)</span>
            </h2>
            {showItemLocation ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showItemLocation && (
            <div className="px-6 pb-6 space-y-4">
              <p className="text-xs text-gray-500">
                Location displayed to buyers. If not set, uses your eBay account location.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* City */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.itemLocationCity}
                    onChange={(e) => updateField('itemLocationCity', e.target.value)}
                    placeholder="e.g. Los Angeles"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* State/Province */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State/Province</label>
                  <input
                    type="text"
                    value={formData.itemLocationState}
                    onChange={(e) => updateField('itemLocationState', e.target.value)}
                    placeholder="e.g. CA"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Postal Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={formData.itemLocationPostalCode}
                    onChange={(e) => updateField('itemLocationPostalCode', e.target.value)}
                    placeholder="e.g. 90001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Country */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <select
                    value={formData.itemLocationCountry}
                    onChange={(e) => updateField('itemLocationCountry', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================================================================ */}
        {/* Section 9: Business Policies                                     */}
        {/* ================================================================ */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Policies</h2>

          {!formData.connectionId ? (
            <p className="text-sm text-gray-500">Select an eBay store above to load your business policies.</p>
          ) : policiesLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading policies...
            </div>
          ) : (
            <div className="space-y-4">
              {/* Fulfillment Policy */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fulfillment (Shipping) Policy
                </label>
                <select
                  value={formData.fulfillmentPolicyId}
                  onChange={(e) => updateField('fulfillmentPolicyId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Default</option>
                  {fulfillmentPolicies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Policy */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Policy
                </label>
                <select
                  value={formData.paymentPolicyId}
                  onChange={(e) => updateField('paymentPolicyId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Default</option>
                  {paymentPolicies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Return Policy */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Return Policy
                </label>
                <select
                  value={formData.returnPolicyId}
                  onChange={(e) => updateField('returnPolicyId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Default</option>
                  {returnPolicies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {fulfillmentPolicies.length === 0 && paymentPolicies.length === 0 && returnPolicies.length === 0 && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <Info className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-700">
                    No business policies found for this store. eBay will use your account defaults.
                    You can create policies in your eBay Seller Hub.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================================================================ */}
        {/* Section 10: Inventory Location                                   */}
        {/* ================================================================ */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Inventory Location</h2>

          {!formData.connectionId ? (
            <p className="text-sm text-gray-500">Select an eBay store above to load inventory locations.</p>
          ) : locationsLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading locations...
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Merchant Location Key <span className="text-xs text-gray-500">(optional)</span>
              </label>
              <select
                value={formData.merchantLocationKey}
                onChange={(e) => updateField('merchantLocationKey', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No specific location</option>
                {inventoryLocations.map((loc) => (
                  <option key={loc.merchantLocationKey} value={loc.merchantLocationKey}>
                    {loc.name}
                    {loc.location?.city ? ` - ${loc.location.city}` : ''}
                    {loc.location?.stateOrProvince ? `, ${loc.location.stateOrProvince}` : ''}
                  </option>
                ))}
              </select>
              {inventoryLocations.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  No inventory locations found. You can add locations via the eBay API or Seller Hub.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ================================================================ */}
        {/* Section 11: Scheduling (collapsible)                             */}
        {/* ================================================================ */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <button
            type="button"
            onClick={() => setShowScheduling(!showScheduling)}
            className="w-full flex items-center justify-between p-6 text-left"
          >
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              Scheduling
              <span className="text-sm font-normal text-gray-500">(optional)</span>
            </h2>
            {showScheduling ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showScheduling && (
            <div className="px-6 pb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Schedule Start Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduledStartTime}
                  onChange={(e) => updateField('scheduledStartTime', e.target.value)}
                  min={getNowLocal()}
                  max={getMaxScheduleDate()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Schedule this listing to go live at a future date/time. Maximum 3 weeks from now.
                </p>
                {formData.scheduledStartTime && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-blue-600 font-medium">
                      Scheduled for: {new Date(formData.scheduledStartTime).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateField('scheduledStartTime', '')}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {formData.scheduledStartTime && formData.autoPublish && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700">
                    Since a schedule time is set, the listing will be scheduled instead of immediately published, even though auto-publish is enabled.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================================================================ */}
        {/* Section 12: Publishing Options                                   */}
        {/* ================================================================ */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Publishing Options</h2>

          <div className="space-y-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoPublish"
                checked={formData.autoPublish}
                onChange={(e) => updateField('autoPublish', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="autoPublish" className="ml-2 text-sm text-gray-700">
                Publish to eBay immediately after creating
              </label>
            </div>
            <p className="text-xs text-gray-500 ml-6">
              If unchecked, the listing will be saved as &quot;Approved&quot; and you can publish it manually later.
            </p>

            <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg mt-3">
              <Info className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-600">
                <strong>Out-of-stock control:</strong> When inventory reaches zero, eBay will hide the listing instead of ending it. This preserves your listing history and SEO. The listing will automatically re-appear when inventory is restocked.
              </p>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* Actions                                                          */}
        {/* ================================================================ */}
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
                {formData.scheduledStartTime
                  ? 'Creating & Scheduling...'
                  : formData.autoPublish
                    ? 'Creating & Publishing...'
                    : 'Creating...'}
              </>
            ) : (
              <>
                {formData.scheduledStartTime ? (
                  <>
                    <Calendar className="w-5 h-5" />
                    Create &amp; Schedule
                  </>
                ) : formData.autoPublish ? (
                  <>
                    <Upload className="w-5 h-5" />
                    Create &amp; Publish
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
