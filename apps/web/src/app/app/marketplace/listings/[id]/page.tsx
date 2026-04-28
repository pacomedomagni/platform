'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ConfirmDialog, toast } from '@platform/ui';
import Link from 'next/link';
import {
  ArrowLeft,
  Edit,
  Save,
  Upload,
  Power,
  Trash2,
  RefreshCw,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  Package,
  DollarSign,
  Image as ImageIcon,
  Tag,
  Hash,
  FileText,
  Gavel,
  Settings,
  AlertCircle,
  X,
  MapPin,
  Eye,
  EyeOff,
  Layers,
  BookOpen,
} from 'lucide-react';
import { unwrapJson } from '@/lib/admin-fetch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ListingDetail {
  id: string;
  connectionId: string;
  productListingId: string;
  warehouseId?: string;
  externalOfferId?: string;
  externalListingId?: string;
  externalItemId?: string;
  sku: string;
  title: string;
  subtitle?: string;
  description: string;
  price: string;
  quantity: number;
  condition: string;
  conditionDescription?: string;
  categoryId: string;
  secondaryCategoryId?: string;
  format: string;
  startPrice?: string;
  reservePrice?: string;
  buyItNowPrice?: string;
  listingDuration?: string;
  bestOfferEnabled: boolean;
  autoAcceptPrice?: string;
  autoDeclinePrice?: string;
  privateListing: boolean;
  lotSize?: number;
  epid?: string;
  itemLocationCity?: string;
  itemLocationState?: string;
  itemLocationPostalCode?: string;
  itemLocationCountry?: string;
  isVariation: boolean;
  parentListingId?: string;
  inventoryGroupKey?: string;
  variantAspects?: string[];
  platformData?: Record<string, any>;
  photos: string[];
  itemSpecifics?: Record<string, string[]>;
  packageType?: string;
  weightValue?: string;
  weightUnit?: string;
  dimensionLength?: string;
  dimensionWidth?: string;
  dimensionHeight?: string;
  dimensionUnit?: string;
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
  status: string;
  syncStatus: string;
  errorMessage?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  publishedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
  connection?: {
    name: string;
    marketplaceId: string;
  };
}

interface EditFormData {
  title: string;
  subtitle: string;
  description: string;
  price: string;
  quantity: string;
  condition: string;
  conditionDescription: string;
  categoryId: string;
  secondaryCategoryId: string;
  format: string;
  bestOfferEnabled: boolean;
  autoAcceptPrice: string;
  autoDeclinePrice: string;
  privateListing: boolean;
  lotSize: string;
  epid: string;
  itemLocationCity: string;
  itemLocationState: string;
  itemLocationPostalCode: string;
  itemLocationCountry: string;
  itemSpecifics: Record<string, string[]>;
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
  packageType: string;
  weightValue: string;
  weightUnit: string;
  dimensionLength: string;
  dimensionWidth: string;
  dimensionHeight: string;
  dimensionUnit: string;
}

interface OfferUpdateData {
  price: string;
  currency: string;
  quantity: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function getStatusConfig(status: string) {
  switch (status) {
    case 'draft':
      return { icon: Clock, color: 'gray', label: 'Draft' };
    case 'pending_approval':
      return { icon: Clock, color: 'orange', label: 'Pending Approval' };
    case 'approved':
      return { icon: CheckCircle2, color: 'green', label: 'Approved' };
    case 'publishing':
      return { icon: RefreshCw, color: 'blue', label: 'Publishing', animate: true };
    case 'published':
      return { icon: CheckCircle2, color: 'green', label: 'Published' };
    case 'ended':
      return { icon: XCircle, color: 'gray', label: 'Ended' };
    case 'error':
      return { icon: AlertCircle, color: 'red', label: 'Error' };
    default:
      return { icon: Clock, color: 'gray', label: status };
  }
}

function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'lg' }) {
  const config = getStatusConfig(status);
  const Icon = config.icon;

  const colorClasses: Record<string, string> = {
    green: 'bg-green-100 text-green-800',
    blue: 'bg-blue-100 text-blue-800',
    red: 'bg-red-100 text-red-800',
    orange: 'bg-orange-100 text-orange-800',
    gray: 'bg-gray-100 text-gray-800',
  };

  const sizeClasses = size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses} ${colorClasses[config.color] || colorClasses.gray}`}
    >
      <Icon className={`${size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} ${config.animate ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  );
}

function getCurrencyForMarketplace(marketplaceId?: string): string {
  if (!marketplaceId) return 'USD';
  if (marketplaceId === 'EBAY_UK' || marketplaceId === 'EBAY_GB') return 'GBP';
  if (['EBAY_DE', 'EBAY_FR', 'EBAY_IT', 'EBAY_ES'].includes(marketplaceId)) return 'EUR';
  if (marketplaceId === 'EBAY_CA') return 'CAD';
  if (marketplaceId === 'EBAY_AU') return 'AUD';
  return 'USD';
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return `${d.toLocaleDateString()} at ${d.toLocaleTimeString()}`;
}

function conditionLabel(condition: string): string {
  const map: Record<string, string> = {
    NEW: 'New',
    LIKE_NEW: 'Like New',
    NEW_OTHER: 'New (Other)',
    NEW_WITH_DEFECTS: 'New with Defects',
    MANUFACTURER_REFURBISHED: 'Manufacturer Refurbished',
    CERTIFIED_REFURBISHED: 'Certified Refurbished',
    EXCELLENT_REFURBISHED: 'Excellent Refurbished',
    VERY_GOOD_REFURBISHED: 'Very Good Refurbished',
    GOOD_REFURBISHED: 'Good Refurbished',
    SELLER_REFURBISHED: 'Seller Refurbished',
    USED_EXCELLENT: 'Used - Excellent',
    USED_VERY_GOOD: 'Used - Very Good',
    USED_GOOD: 'Used - Good',
    USED_ACCEPTABLE: 'Used - Acceptable',
    FOR_PARTS_OR_NOT_WORKING: 'For Parts or Not Working',
  };
  return map[condition] || condition;
}

function formatCurrency(value: string | number | undefined, currencyCode: string): string {
  if (value === undefined || value === null || value === '') return '--';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(Number(value));
}

// ---------------------------------------------------------------------------
// Country list for location dropdown
// ---------------------------------------------------------------------------

const US_STATES = [
  { value: '', label: '— Select state —' },
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'District of Columbia' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'AS', label: 'American Samoa' },
  { value: 'GU', label: 'Guam' },
  { value: 'MP', label: 'Northern Mariana Islands' },
  { value: 'PR', label: 'Puerto Rico' },
  { value: 'VI', label: 'U.S. Virgin Islands' },
];

const COUNTRY_OPTIONS = [
  { value: '', label: '-- Select --' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'IT', label: 'Italy' },
  { value: 'ES', label: 'Spain' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'BE', label: 'Belgium' },
  { value: 'AT', label: 'Austria' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'IE', label: 'Ireland' },
  { value: 'JP', label: 'Japan' },
  { value: 'CN', label: 'China' },
  { value: 'KR', label: 'South Korea' },
  { value: 'IN', label: 'India' },
  { value: 'MX', label: 'Mexico' },
  { value: 'BR', label: 'Brazil' },
  { value: 'PL', label: 'Poland' },
  { value: 'SE', label: 'Sweden' },
  { value: 'NO', label: 'Norway' },
  { value: 'DK', label: 'Denmark' },
  { value: 'FI', label: 'Finland' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'SG', label: 'Singapore' },
  { value: 'HK', label: 'Hong Kong' },
  { value: 'TW', label: 'Taiwan' },
  { value: 'IL', label: 'Israel' },
  { value: 'ZA', label: 'South Africa' },
];

// ---------------------------------------------------------------------------
// Package type options
// ---------------------------------------------------------------------------

const PACKAGE_TYPE_OPTIONS = [
  { value: '', label: '-- Select --' },
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listingId = params.id as string;

  // Data
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit mode for draft/approved
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>({
    title: '',
    subtitle: '',
    description: '',
    price: '',
    quantity: '',
    condition: 'NEW',
    conditionDescription: '',
    categoryId: '',
    secondaryCategoryId: '',
    format: 'FIXED_PRICE',
    bestOfferEnabled: false,
    autoAcceptPrice: '',
    autoDeclinePrice: '',
    privateListing: false,
    lotSize: '',
    epid: '',
    itemLocationCity: '',
    itemLocationState: '',
    itemLocationPostalCode: '',
    itemLocationCountry: '',
    itemSpecifics: {},
    fulfillmentPolicyId: '',
    paymentPolicyId: '',
    returnPolicyId: '',
    packageType: '',
    weightValue: '',
    weightUnit: '',
    dimensionLength: '',
    dimensionWidth: '',
    dimensionHeight: '',
    dimensionUnit: '',
  });
  const [saving, setSaving] = useState(false);

  // Item specifics editing helpers
  const [newSpecKey, setNewSpecKey] = useState('');
  const [newSpecValue, setNewSpecValue] = useState('');

  // Update offer for published listings
  const [showOfferUpdate, setShowOfferUpdate] = useState(false);
  const [offerData, setOfferData] = useState<OfferUpdateData>({
    price: '',
    currency: 'USD',
    quantity: '',
    description: '',
  });
  const [updatingOffer, setUpdatingOffer] = useState(false);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [endConfirm, setEndConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Schedule
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');

  // Approve / Reject
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // =========================================================================
  // Data loading
  // =========================================================================

  useEffect(() => {
    loadListing();
  }, [listingId]);

  const loadListing = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/marketplace/listings/${listingId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = unwrapJson<ListingDetail>(await res.json());
        setListing(data);
        populateEditForm(data);
        populateOfferData(data);
      } else {
        toast({ title: 'Error', description: 'Failed to load listing details', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to load listing:', error);
      toast({ title: 'Error', description: 'Failed to load listing details', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const populateEditForm = (data: ListingDetail) => {
    setEditForm({
      title: data.title || '',
      subtitle: data.subtitle || '',
      description: data.description || '',
      price: data.price || '',
      quantity: String(data.quantity ?? ''),
      condition: data.condition || 'NEW',
      conditionDescription: data.conditionDescription || '',
      categoryId: data.categoryId || '',
      secondaryCategoryId: data.secondaryCategoryId || '',
      format: data.format || 'FIXED_PRICE',
      bestOfferEnabled: data.bestOfferEnabled ?? false,
      autoAcceptPrice: data.autoAcceptPrice || '',
      autoDeclinePrice: data.autoDeclinePrice || '',
      privateListing: data.privateListing ?? false,
      lotSize: data.lotSize != null ? String(data.lotSize) : '',
      epid: data.epid || '',
      itemLocationCity: data.itemLocationCity || '',
      itemLocationState: data.itemLocationState || '',
      itemLocationPostalCode: data.itemLocationPostalCode || '',
      itemLocationCountry: data.itemLocationCountry || '',
      itemSpecifics: data.itemSpecifics ? { ...data.itemSpecifics } : {},
      fulfillmentPolicyId: data.fulfillmentPolicyId || '',
      paymentPolicyId: data.paymentPolicyId || '',
      returnPolicyId: data.returnPolicyId || '',
      packageType: data.packageType || '',
      weightValue: data.weightValue || '',
      weightUnit: data.weightUnit || '',
      dimensionLength: data.dimensionLength || '',
      dimensionWidth: data.dimensionWidth || '',
      dimensionHeight: data.dimensionHeight || '',
      dimensionUnit: data.dimensionUnit || '',
    });
  };

  const populateOfferData = (data: ListingDetail) => {
    const currency = getCurrencyForMarketplace(data.connection?.marketplaceId);
    setOfferData({
      price: data.price || '',
      currency,
      quantity: String(data.quantity ?? ''),
      description: data.description || '',
    });
  };

  // =========================================================================
  // Edit (draft/approved) handlers
  // =========================================================================

  const handleSaveEdit = async () => {
    if (!editForm.title.trim()) {
      toast({ title: 'Validation Error', description: 'Title is required', variant: 'destructive' });
      return;
    }
    if (!editForm.price || parseFloat(editForm.price) <= 0) {
      toast({ title: 'Validation Error', description: 'Valid price is required', variant: 'destructive' });
      return;
    }
    if (!editForm.quantity || parseInt(editForm.quantity) < 0) {
      toast({ title: 'Validation Error', description: 'Valid quantity is required', variant: 'destructive' });
      return;
    }
    if (!editForm.categoryId.trim()) {
      toast({ title: 'Validation Error', description: 'Category is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, any> = {
        title: editForm.title,
        description: editForm.description,
        price: parseFloat(editForm.price),
        quantity: parseInt(editForm.quantity),
        condition: editForm.condition,
        categoryId: editForm.categoryId,
      };

      // New top-level fields
      body.subtitle = editForm.subtitle || null;
      body.conditionDescription = editForm.conditionDescription || null;
      body.secondaryCategoryId = editForm.secondaryCategoryId || null;
      body.privateListing = editForm.privateListing;
      body.lotSize = editForm.lotSize ? parseInt(editForm.lotSize) : null;
      body.epid = editForm.epid || null;
      body.itemLocationCity = editForm.itemLocationCity || null;
      body.itemLocationState = editForm.itemLocationState || null;
      body.itemLocationPostalCode = editForm.itemLocationPostalCode || null;
      body.itemLocationCountry = editForm.itemLocationCountry || null;
      body.packageType = editForm.packageType || null;
      body.bestOfferEnabled = editForm.bestOfferEnabled;
      if (editForm.bestOfferEnabled) {
        body.autoAcceptPrice = editForm.autoAcceptPrice ? parseFloat(editForm.autoAcceptPrice) : null;
        body.autoDeclinePrice = editForm.autoDeclinePrice ? parseFloat(editForm.autoDeclinePrice) : null;
      } else {
        body.autoAcceptPrice = null;
        body.autoDeclinePrice = null;
      }

      // Include item specifics if present
      if (Object.keys(editForm.itemSpecifics).length > 0) {
        body.itemSpecifics = editForm.itemSpecifics;
      }

      // Include platform data overrides
      const platformData: Record<string, any> = {};
      if (editForm.format) platformData.format = editForm.format;
      if (editForm.fulfillmentPolicyId) platformData.fulfillmentPolicyId = editForm.fulfillmentPolicyId;
      if (editForm.paymentPolicyId) platformData.paymentPolicyId = editForm.paymentPolicyId;
      if (editForm.returnPolicyId) platformData.returnPolicyId = editForm.returnPolicyId;
      if (Object.keys(platformData).length > 0) {
        body.platformData = platformData;
      }

      const res = await fetch(`/api/v1/marketplace/listings/${listingId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Listing updated successfully' });
        setEditing(false);
        loadListing();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to update listing', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to save listing:', error);
      toast({ title: 'Error', description: 'Failed to update listing', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // =========================================================================
  // Update offer (published listing)
  // =========================================================================

  const handleUpdateOffer = async () => {
    if (!offerData.price || parseFloat(offerData.price) <= 0) {
      toast({ title: 'Validation Error', description: 'Valid price is required', variant: 'destructive' });
      return;
    }
    if (!offerData.quantity || parseInt(offerData.quantity) < 0) {
      toast({ title: 'Validation Error', description: 'Valid quantity is required', variant: 'destructive' });
      return;
    }

    setUpdatingOffer(true);
    try {
      const res = await fetch(`/api/v1/marketplace/listings/${listingId}/offer`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: {
            value: parseFloat(offerData.price),
            currency: offerData.currency,
          },
          quantity: parseInt(offerData.quantity),
          description: offerData.description,
        }),
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Offer updated successfully on eBay' });
        setShowOfferUpdate(false);
        loadListing();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to update offer', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to update offer:', error);
      toast({ title: 'Error', description: 'Failed to update offer', variant: 'destructive' });
    } finally {
      setUpdatingOffer(false);
    }
  };

  // =========================================================================
  // Action handlers
  // =========================================================================

  const handlePublish = async () => {
    setPublishConfirm(false);
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/marketplace/listings/${listingId}/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Listing published successfully!' });
        loadListing();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to publish listing', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to publish:', error);
      toast({ title: 'Error', description: 'Failed to publish listing', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleDate) {
      toast({ title: 'Validation Error', description: 'Please select a date and time', variant: 'destructive' });
      return;
    }
    setShowSchedule(false);
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/marketplace/listings/${listingId}/schedule`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: new Date(scheduleDate).toISOString() }),
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Listing scheduled for publishing' });
        loadListing();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to schedule listing', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to schedule:', error);
      toast({ title: 'Error', description: 'Failed to schedule listing', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncInventory = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/marketplace/listings/${listingId}/sync-inventory`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Inventory synced successfully' });
        loadListing();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to sync inventory', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to sync inventory:', error);
      toast({ title: 'Error', description: 'Failed to sync inventory', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndListing = async () => {
    setEndConfirm(false);
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/marketplace/listings/${listingId}/end`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Listing ended successfully' });
        loadListing();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to end listing', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to end listing:', error);
      toast({ title: 'Error', description: 'Failed to end listing', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteConfirm(false);
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/marketplace/listings/${listingId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Listing deleted' });
        router.push('/app/marketplace/listings');
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to delete listing', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      toast({ title: 'Error', description: 'Failed to delete listing', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/marketplace/listings/${listingId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Listing approved' });
        loadListing();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to approve listing', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to approve:', error);
      toast({ title: 'Error', description: 'Failed to approve listing', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast({ title: 'Validation Error', description: 'Please provide a reason for rejection', variant: 'destructive' });
      return;
    }
    setShowReject(false);
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/marketplace/listings/${listingId}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Listing rejected' });
        setRejectReason('');
        loadListing();
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to reject listing', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to reject:', error);
      toast({ title: 'Error', description: 'Failed to reject listing', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  // =========================================================================
  // Item specifics helpers
  // =========================================================================

  const addItemSpecific = () => {
    if (!newSpecKey.trim() || !newSpecValue.trim()) return;
    setEditForm((prev) => {
      const updated = { ...prev.itemSpecifics };
      if (updated[newSpecKey.trim()]) {
        updated[newSpecKey.trim()] = [...updated[newSpecKey.trim()], newSpecValue.trim()];
      } else {
        updated[newSpecKey.trim()] = [newSpecValue.trim()];
      }
      return { ...prev, itemSpecifics: updated };
    });
    setNewSpecValue('');
  };

  const removeItemSpecific = (key: string, valueIndex: number) => {
    setEditForm((prev) => {
      const updated = { ...prev.itemSpecifics };
      updated[key] = updated[key].filter((_, i) => i !== valueIndex);
      if (updated[key].length === 0) {
        delete updated[key];
      }
      return { ...prev, itemSpecifics: updated };
    });
  };

  // =========================================================================
  // Computed helpers
  // =========================================================================

  const canEdit = listing?.status === 'draft' || listing?.status === 'approved';
  const canPublish = (listing?.status === 'draft' || listing?.status === 'approved') && !listing?.externalListingId;
  const canSchedule = listing?.status === 'draft' || listing?.status === 'approved';
  const canSyncInventory = listing?.status === 'published';
  const canEndListing = listing?.status === 'published';
  const canDelete = listing?.status === 'draft';
  const canApproveReject = listing?.status === 'pending_approval';
  const canUpdateOffer = listing?.status === 'published';
  const currency = getCurrencyForMarketplace(listing?.connection?.marketplaceId);

  const hasLocationInfo =
    listing?.itemLocationCity ||
    listing?.itemLocationState ||
    listing?.itemLocationPostalCode ||
    listing?.itemLocationCountry;

  // =========================================================================
  // Render: Loading
  // =========================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // =========================================================================
  // Render: Not found
  // =========================================================================

  if (!listing) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Link
          href="/app/marketplace/listings"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Listings
        </Link>
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Listing not found</h3>
          <p className="text-gray-600">The requested listing could not be found.</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Render: Main page
  // =========================================================================

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Back link */}
      <Link
        href="/app/marketplace/listings"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Listings
      </Link>

      {/* ================================================================= */}
      {/* Header */}
      {/* ================================================================= */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 truncate">{listing.title}</h1>
              <StatusBadge status={listing.status} size="lg" />
              {listing.syncStatus !== 'synced' && listing.status === 'published' && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  Sync: {listing.syncStatus}
                </span>
              )}
              {/* Format badge */}
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  listing.format === 'AUCTION'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                <Gavel className="w-3 h-3" />
                {listing.format === 'FIXED_PRICE' ? 'Fixed Price' : listing.format === 'AUCTION' ? 'Auction' : listing.format}
              </span>
              {/* Private listing badge */}
              {listing.privateListing && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  <EyeOff className="w-3 h-3" />
                  Private
                </span>
              )}
            </div>
            {/* Subtitle */}
            {listing.subtitle && (
              <p className="text-sm text-gray-600 mb-2 italic">{listing.subtitle}</p>
            )}
            <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
              <span>SKU: {listing.sku}</span>
              {listing.connection && (
                <span>Store: {listing.connection.name} ({listing.connection.marketplaceId})</span>
              )}
              {listing.externalListingId && (
                <a
                  href={`https://www.ebay.com/itm/${listing.externalListingId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                >
                  <ExternalLink className="w-3 h-3" />
                  eBay #{listing.externalListingId}
                </a>
              )}
            </div>
            {listing.errorMessage && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {listing.errorMessage}
                </p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 ml-4 flex-shrink-0 flex-wrap">
            {canEdit && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            )}

            {editing && (
              <>
                <button
                  onClick={() => {
                    setEditing(false);
                    if (listing) populateEditForm(listing);
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
              </>
            )}

            {canPublish && !editing && (
              <button
                onClick={() => setPublishConfirm(true)}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                Publish
              </button>
            )}

            {canSchedule && !editing && (
              <button
                onClick={() => setShowSchedule(true)}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50"
              >
                <Calendar className="w-4 h-4" />
                Schedule
              </button>
            )}

            {canUpdateOffer && (
              <button
                onClick={() => {
                  if (listing) populateOfferData(listing);
                  setShowOfferUpdate(!showOfferUpdate);
                }}
                className="flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50"
              >
                <DollarSign className="w-4 h-4" />
                Update Offer
              </button>
            )}

            {canSyncInventory && (
              <button
                onClick={handleSyncInventory}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
                Sync Inventory
              </button>
            )}

            {canEndListing && (
              <button
                onClick={() => setEndConfirm(true)}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 disabled:opacity-50"
              >
                <Power className="w-4 h-4" />
                End Listing
              </button>
            )}

            {canApproveReject && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => {
                    setRejectReason('');
                    setShowReject(true);
                  }}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
              </>
            )}

            {canDelete && !editing && (
              <button
                onClick={() => setDeleteConfirm(true)}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* Schedule Modal */}
      {/* ================================================================= */}
      {showSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Schedule Listing</h2>
            <p className="text-sm text-gray-600 mb-4">
              Choose a date and time to automatically publish this listing.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Publish Date & Time *
              </label>
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowSchedule(false);
                  setScheduleDate('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSchedule}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Reject Modal */}
      {/* ================================================================= */}
      {showReject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Reject Listing</h2>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting this listing.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason *
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Enter reason for rejection..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowReject(false);
                  setRejectReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Reject Listing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Update Offer Panel (Published Listings) */}
      {/* ================================================================= */}
      {showOfferUpdate && canUpdateOffer && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              Update Live Offer
            </h2>
            <button
              onClick={() => setShowOfferUpdate(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Update the price, quantity, and description on the live eBay listing.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price ({offerData.currency}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={offerData.price}
                onChange={(e) => setOfferData({ ...offerData, price: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity *
              </label>
              <input
                type="number"
                min="0"
                value={offerData.quantity}
                onChange={(e) => setOfferData({ ...offerData, quantity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                value={offerData.currency}
                onChange={(e) => setOfferData({ ...offerData, currency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="CAD">CAD</option>
                <option value="AUD">AUD</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={offerData.description}
              onChange={(e) => setOfferData({ ...offerData, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleUpdateOffer}
              disabled={updatingOffer}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {updatingOffer ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Update Offer on eBay
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Main content grid */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* ============================================================= */}
          {/* Listing Details */}
          {/* ============================================================= */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Listing Details
            </h2>

            {editing ? (
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title * <span className="text-xs text-gray-500">(max 80 characters)</span>
                  </label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    maxLength={80}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">{editForm.title.length}/80 characters</p>
                </div>

                {/* Subtitle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subtitle <span className="text-xs text-gray-500">(max 55 characters, paid upgrade)</span>
                  </label>
                  <input
                    type="text"
                    value={editForm.subtitle}
                    onChange={(e) => setEditForm({ ...editForm, subtitle: e.target.value })}
                    maxLength={55}
                    placeholder="Optional subtitle for extra visibility"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">{editForm.subtitle.length}/55 characters</p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description *
                  </label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Price / Quantity */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.price}
                      onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.quantity}
                      onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Condition */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition *</label>
                  <select
                    value={editForm.condition}
                    onChange={(e) => setEditForm({ ...editForm, condition: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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

                {/* Condition Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Condition Description <span className="text-xs text-gray-500">(for used/refurbished items)</span>
                  </label>
                  <textarea
                    value={editForm.conditionDescription}
                    onChange={(e) => setEditForm({ ...editForm, conditionDescription: e.target.value })}
                    rows={3}
                    placeholder="Describe the condition of the item in detail..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Category / Second Category */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category ID *</label>
                    <input
                      type="text"
                      value={editForm.categoryId}
                      onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                      placeholder="e.g., 9355 for Cell Phones & Smartphones"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Secondary Category ID <span className="text-xs text-gray-500">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={editForm.secondaryCategoryId}
                      onChange={(e) => setEditForm({ ...editForm, secondaryCategoryId: e.target.value })}
                      placeholder="Optional second category"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Format (display only in edit) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                    {editForm.format === 'FIXED_PRICE' ? 'Fixed Price' : editForm.format === 'AUCTION' ? 'Auction' : editForm.format}
                    <span className="text-xs text-gray-400 ml-2">(cannot be changed after creation)</span>
                  </div>
                </div>

                {/* Private Listing / Lot Size / ePID */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="privateListing"
                      checked={editForm.privateListing}
                      onChange={(e) => setEditForm({ ...editForm, privateListing: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="privateListing" className="ml-2 text-sm font-medium text-gray-700">
                      Private Listing
                    </label>
                    <span className="ml-1 text-xs text-gray-400">(hides buyer identity)</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lot Size</label>
                    <input
                      type="number"
                      min="1"
                      value={editForm.lotSize}
                      onChange={(e) => setEditForm({ ...editForm, lotSize: e.target.value })}
                      placeholder="Items in lot"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ePID</label>
                    <input
                      type="text"
                      value={editForm.epid}
                      onChange={(e) => setEditForm({ ...editForm, epid: e.target.value })}
                      placeholder="eBay catalog product ID"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Best Offer */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <input
                      type="checkbox"
                      id="bestOfferEnabled"
                      checked={editForm.bestOfferEnabled}
                      onChange={(e) => setEditForm({ ...editForm, bestOfferEnabled: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="bestOfferEnabled" className="ml-2 text-sm font-medium text-gray-700">
                      Enable Best Offer
                    </label>
                  </div>
                  {editForm.bestOfferEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Auto Accept Price</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editForm.autoAcceptPrice}
                          onChange={(e) => setEditForm({ ...editForm, autoAcceptPrice: e.target.value })}
                          placeholder="0.00"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Auto Decline Price</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editForm.autoDeclinePrice}
                          onChange={(e) => setEditForm({ ...editForm, autoDeclinePrice: e.target.value })}
                          placeholder="0.00"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Item Location */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Item Location
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
                      <input
                        type="text"
                        value={editForm.itemLocationCity}
                        onChange={(e) => setEditForm({ ...editForm, itemLocationCity: e.target.value })}
                        placeholder="e.g., New York"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">State / Province</label>
                      {(editForm.itemLocationCountry === 'US' || !editForm.itemLocationCountry) ? (
                        <select
                          value={editForm.itemLocationState}
                          onChange={(e) => setEditForm({ ...editForm, itemLocationState: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          {US_STATES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={editForm.itemLocationState}
                          onChange={(e) => setEditForm({ ...editForm, itemLocationState: e.target.value })}
                          placeholder="State / Province / Region"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Postal Code</label>
                      <input
                        type="text"
                        value={editForm.itemLocationPostalCode}
                        onChange={(e) => setEditForm({ ...editForm, itemLocationPostalCode: e.target.value })}
                        placeholder="e.g., 10001"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Country</label>
                      <select
                        value={editForm.itemLocationCountry}
                        onChange={(e) => setEditForm({ ...editForm, itemLocationCountry: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        {COUNTRY_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Item Specifics (editable) */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Item Specifics</label>
                  {Object.entries(editForm.itemSpecifics).length > 0 && (
                    <div className="space-y-2 mb-3">
                      {Object.entries(editForm.itemSpecifics).map(([key, values]) =>
                        values.map((value, idx) => (
                          <div key={`${key}-${idx}`} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded">
                            <span className="text-sm font-medium text-gray-700">{key}:</span>
                            <span className="text-sm text-gray-600">{value}</span>
                            <button
                              type="button"
                              onClick={() => removeItemSpecific(key, idx)}
                              className="ml-auto text-red-500 hover:text-red-700"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSpecKey}
                      onChange={(e) => setNewSpecKey(e.target.value)}
                      placeholder="Name (e.g., Brand)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <input
                      type="text"
                      value={newSpecValue}
                      onChange={(e) => setNewSpecValue(e.target.value)}
                      placeholder="Value (e.g., Apple)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <button
                      type="button"
                      onClick={addItemSpecific}
                      disabled={!newSpecKey.trim() || !newSpecValue.trim()}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Business Policies */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Business Policies</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Fulfillment Policy ID</label>
                      <input
                        type="text"
                        value={editForm.fulfillmentPolicyId}
                        onChange={(e) => setEditForm({ ...editForm, fulfillmentPolicyId: e.target.value })}
                        placeholder="Optional"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Payment Policy ID</label>
                      <input
                        type="text"
                        value={editForm.paymentPolicyId}
                        onChange={(e) => setEditForm({ ...editForm, paymentPolicyId: e.target.value })}
                        placeholder="Optional"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Return Policy ID</label>
                      <input
                        type="text"
                        value={editForm.returnPolicyId}
                        onChange={(e) => setEditForm({ ...editForm, returnPolicyId: e.target.value })}
                        placeholder="Optional"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Package Details */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Package Details</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Weight</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.weightValue}
                        onChange={(e) => setEditForm({ ...editForm, weightValue: e.target.value })}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Weight Unit</label>
                      <select
                        value={editForm.weightUnit}
                        onChange={(e) => setEditForm({ ...editForm, weightUnit: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="">--</option>
                        <option value="POUND">lb</option>
                        <option value="OUNCE">oz</option>
                        <option value="KILOGRAM">kg</option>
                        <option value="GRAM">g</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Package Type</label>
                      <select
                        value={editForm.packageType}
                        onChange={(e) => setEditForm({ ...editForm, packageType: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        {PACKAGE_TYPE_OPTIONS.map((pt) => (
                          <option key={pt.value} value={pt.value}>
                            {pt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Dimension Unit</label>
                      <select
                        value={editForm.dimensionUnit}
                        onChange={(e) => setEditForm({ ...editForm, dimensionUnit: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="">--</option>
                        <option value="INCH">in</option>
                        <option value="FEET">ft</option>
                        <option value="CENTIMETER">cm</option>
                        <option value="METER">m</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Length</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.dimensionLength}
                        onChange={(e) => setEditForm({ ...editForm, dimensionLength: e.target.value })}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Width</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.dimensionWidth}
                        onChange={(e) => setEditForm({ ...editForm, dimensionWidth: e.target.value })}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Height</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.dimensionHeight}
                        onChange={(e) => setEditForm({ ...editForm, dimensionHeight: e.target.value })}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Read-only view */
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Title</label>
                  <p className="mt-1 text-sm text-gray-900">{listing.title}</p>
                </div>

                {/* Subtitle (read-only) */}
                {listing.subtitle && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Subtitle</label>
                    <p className="mt-1 text-sm text-gray-600 italic">{listing.subtitle}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-500">Description</label>
                  <div className="mt-1 text-sm text-gray-900 whitespace-pre-wrap max-h-48 overflow-y-auto bg-gray-50 rounded p-3">
                    {listing.description || '--'}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Price</label>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {formatCurrency(listing.price, currency)}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Quantity</label>
                    <p className="mt-1 text-sm text-gray-900">{listing.quantity}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Condition</label>
                    <p className="mt-1 text-sm text-gray-900">{conditionLabel(listing.condition)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Category ID</label>
                    <p className="mt-1 text-sm text-gray-900">{listing.categoryId}</p>
                  </div>
                </div>

                {/* Condition Description (read-only) */}
                {listing.conditionDescription && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Condition Description</label>
                    <p className="mt-1 text-sm text-gray-600">{listing.conditionDescription}</p>
                  </div>
                )}

                {/* Second Category (read-only) */}
                {listing.secondaryCategoryId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Secondary Category ID</label>
                    <p className="mt-1 text-sm text-gray-900">{listing.secondaryCategoryId}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Format</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {listing.format === 'FIXED_PRICE' ? 'Fixed Price' : listing.format === 'AUCTION' ? 'Auction' : listing.format}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">SKU</label>
                    <p className="mt-1 text-sm text-gray-900">{listing.sku}</p>
                  </div>
                  {listing.listingDuration && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Duration</label>
                      <p className="mt-1 text-sm text-gray-900">{listing.listingDuration}</p>
                    </div>
                  )}
                </div>

                {/* Auction-specific fields (read-only) */}
                {listing.format === 'AUCTION' && (
                  <div className="border border-purple-200 bg-purple-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
                      <Gavel className="w-4 h-4" />
                      Auction Details
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {listing.startPrice && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Starting Bid</label>
                          <p className="mt-1 text-sm font-medium text-gray-900">
                            {formatCurrency(listing.startPrice, currency)}
                          </p>
                        </div>
                      )}
                      {listing.reservePrice && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Reserve Price</label>
                          <p className="mt-1 text-sm font-medium text-gray-900">
                            {formatCurrency(listing.reservePrice, currency)}
                          </p>
                        </div>
                      )}
                      {listing.buyItNowPrice && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Buy It Now Price</label>
                          <p className="mt-1 text-sm font-medium text-gray-900">
                            {formatCurrency(listing.buyItNowPrice, currency)}
                          </p>
                        </div>
                      )}
                      {listing.listingDuration && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Duration</label>
                          <p className="mt-1 text-sm text-gray-900">{listing.listingDuration}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Lot Size (read-only) */}
                {listing.lotSize != null && listing.lotSize > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      Lot Size
                    </label>
                    <p className="mt-1 text-sm text-gray-900">{listing.lotSize} items per lot</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ============================================================= */}
          {/* Best Offer (read-only) */}
          {/* ============================================================= */}
          {!editing && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Gavel className="w-5 h-5" />
                Best Offer Settings
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Best Offer</label>
                  {listing.bestOfferEnabled ? (
                    <p className="mt-1 text-sm text-green-700 font-medium">Enabled</p>
                  ) : (
                    <p className="mt-1 text-sm text-gray-500">Disabled</p>
                  )}
                </div>
                {listing.bestOfferEnabled && listing.autoAcceptPrice && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Auto Accept Above</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {formatCurrency(listing.autoAcceptPrice, currency)}
                    </p>
                  </div>
                )}
                {listing.bestOfferEnabled && listing.autoDeclinePrice && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Auto Decline Below</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {formatCurrency(listing.autoDeclinePrice, currency)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* Item Specifics (read-only) */}
          {/* ============================================================= */}
          {!editing && listing.itemSpecifics && Object.keys(listing.itemSpecifics).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Item Specifics
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(listing.itemSpecifics).map(([key, values]) => (
                  <div key={key} className="flex items-start gap-2 bg-gray-50 px-3 py-2 rounded">
                    <span className="text-sm font-medium text-gray-700 flex-shrink-0">{key}:</span>
                    <span className="text-sm text-gray-600">{(values as string[]).join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* Images */}
          {/* ============================================================= */}
          {listing.photos && listing.photos.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Images ({listing.photos.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {listing.photos.map((photo, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={typeof photo === 'string' ? photo : (photo as any).url || ''}
                      alt={`Listing image ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '';
                        (e.target as HTMLImageElement).alt = 'Image unavailable';
                        (e.target as HTMLImageElement).className =
                          'w-full h-32 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center';
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column (1/3 width) */}
        <div className="space-y-6">
          {/* ============================================================= */}
          {/* Platform Identifiers */}
          {/* ============================================================= */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Hash className="w-5 h-5" />
              Identifiers
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Listing ID</label>
                <p className="mt-1 text-sm text-gray-900 font-mono break-all">{listing.id}</p>
              </div>
              {listing.externalOfferId && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">eBay Offer ID</label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">{listing.externalOfferId}</p>
                </div>
              )}
              {listing.externalListingId && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">eBay Listing ID</label>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-sm text-gray-900 font-mono">{listing.externalListingId}</p>
                    <a
                      href={`https://www.ebay.com/itm/${listing.externalListingId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
              {listing.externalItemId && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">eBay Item ID</label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">{listing.externalItemId}</p>
                </div>
              )}
              {listing.epid && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">ePID (Catalog Product ID)</label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">{listing.epid}</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</label>
                <p className="mt-1 text-sm text-gray-900 font-mono">{listing.sku}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Connection ID</label>
                <p className="mt-1 text-sm text-gray-900 font-mono break-all">{listing.connectionId}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Product Listing ID</label>
                <p className="mt-1 text-sm text-gray-900 font-mono break-all">{listing.productListingId}</p>
              </div>
            </div>
          </div>

          {/* ============================================================= */}
          {/* Item Location (read-only) */}
          {/* ============================================================= */}
          {!editing && hasLocationInfo && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Item Location
              </h2>
              <div className="space-y-3">
                {listing.itemLocationCity && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">City</label>
                    <p className="mt-1 text-sm text-gray-900">{listing.itemLocationCity}</p>
                  </div>
                )}
                {listing.itemLocationState && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">State / Province</label>
                    <p className="mt-1 text-sm text-gray-900">{listing.itemLocationState}</p>
                  </div>
                )}
                {listing.itemLocationPostalCode && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Postal Code</label>
                    <p className="mt-1 text-sm text-gray-900">{listing.itemLocationPostalCode}</p>
                  </div>
                )}
                {listing.itemLocationCountry && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Country</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {COUNTRY_OPTIONS.find((c) => c.value === listing.itemLocationCountry)?.label || listing.itemLocationCountry}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* Package Details (read-only) */}
          {/* ============================================================= */}
          {!editing && (listing.weightValue || listing.dimensionLength || listing.packageType) && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Package Details
              </h2>
              <div className="space-y-3">
                {listing.packageType && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Package Type</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {PACKAGE_TYPE_OPTIONS.find((pt) => pt.value === listing.packageType)?.label || listing.packageType}
                    </p>
                  </div>
                )}
                {listing.weightValue && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {listing.weightValue} {listing.weightUnit || ''}
                    </p>
                  </div>
                )}
                {listing.dimensionLength && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Dimensions (L x W x H)</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {listing.dimensionLength} x {listing.dimensionWidth || '--'} x {listing.dimensionHeight || '--'}{' '}
                      {listing.dimensionUnit || ''}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* Business Policies (read-only) */}
          {/* ============================================================= */}
          {!editing && (listing.fulfillmentPolicyId || listing.paymentPolicyId || listing.returnPolicyId) && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Business Policies
              </h2>
              <div className="space-y-3">
                {listing.fulfillmentPolicyId && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Fulfillment Policy</label>
                    <p className="mt-1 text-sm text-gray-900 font-mono break-all">{listing.fulfillmentPolicyId}</p>
                  </div>
                )}
                {listing.paymentPolicyId && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Policy</label>
                    <p className="mt-1 text-sm text-gray-900 font-mono break-all">{listing.paymentPolicyId}</p>
                  </div>
                )}
                {listing.returnPolicyId && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Return Policy</label>
                    <p className="mt-1 text-sm text-gray-900 font-mono break-all">{listing.returnPolicyId}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* Timeline / Activity */}
          {/* ============================================================= */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Activity Timeline
            </h2>
            <div className="space-y-0">
              {/* Created */}
              <TimelineItem
                label="Created"
                timestamp={listing.createdAt}
                icon={Clock}
                iconColorClass="bg-gray-100 text-gray-600"
                isLast={!listing.approvedAt && !listing.rejectedAt && !listing.publishedAt && !listing.endedAt}
              />

              {/* Approved */}
              {listing.approvedAt && (
                <TimelineItem
                  label="Approved"
                  timestamp={listing.approvedAt}
                  icon={CheckCircle2}
                  iconColorClass="bg-green-100 text-green-600"
                  isLast={!listing.publishedAt && !listing.endedAt}
                />
              )}

              {/* Rejected */}
              {listing.rejectedAt && (
                <TimelineItem
                  label={`Rejected${listing.rejectionReason ? `: ${listing.rejectionReason}` : ''}`}
                  timestamp={listing.rejectedAt}
                  icon={XCircle}
                  iconColorClass="bg-red-100 text-red-600"
                  isLast={!listing.publishedAt && !listing.endedAt}
                />
              )}

              {/* Published */}
              {listing.publishedAt && (
                <TimelineItem
                  label="Published to eBay"
                  timestamp={listing.publishedAt}
                  icon={Upload}
                  iconColorClass="bg-blue-100 text-blue-600"
                  isLast={!listing.endedAt}
                />
              )}

              {/* Ended */}
              {listing.endedAt && (
                <TimelineItem
                  label="Listing Ended"
                  timestamp={listing.endedAt}
                  icon={Power}
                  iconColorClass="bg-gray-100 text-gray-600"
                  isLast={true}
                />
              )}
            </div>

            {/* Sync status */}
            {listing.status === 'published' && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Sync Status</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      listing.syncStatus === 'synced'
                        ? 'bg-green-100 text-green-800'
                        : listing.syncStatus === 'error'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {listing.syncStatus === 'synced' && <CheckCircle2 className="w-3 h-3" />}
                    {listing.syncStatus === 'error' && <AlertCircle className="w-3 h-3" />}
                    {listing.syncStatus === 'pending' && <Clock className="w-3 h-3" />}
                    {listing.syncStatus}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Last updated: {formatDate(listing.updatedAt)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* Confirm Dialogs */}
      {/* ================================================================= */}
      <ConfirmDialog
        open={publishConfirm}
        onOpenChange={(open) => { if (!open) setPublishConfirm(false); }}
        title="Publish Listing"
        description="Publish this listing to eBay? Once published, certain fields can only be updated through the Update Offer action."
        confirmLabel="Publish"
        onConfirm={handlePublish}
      />

      <ConfirmDialog
        open={endConfirm}
        onOpenChange={(open) => { if (!open) setEndConfirm(false); }}
        title="End Listing"
        description="End this eBay listing? This will remove it from eBay. You can relist it later."
        confirmLabel="End Listing"
        variant="destructive"
        onConfirm={handleEndListing}
      />

      <ConfirmDialog
        open={deleteConfirm}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(false); }}
        title="Delete Listing"
        description="Delete this listing? This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline item component
// ---------------------------------------------------------------------------

function TimelineItem({
  label,
  timestamp,
  icon: Icon,
  iconColorClass,
  isLast,
}: {
  label: string;
  timestamp: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColorClass: string;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconColorClass}`}>
          <Icon className="w-4 h-4" />
        </div>
        {!isLast && <div className="w-px h-8 bg-gray-200" />}
      </div>
      <div className="pb-6">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{formatDate(timestamp)}</p>
      </div>
    </div>
  );
}
