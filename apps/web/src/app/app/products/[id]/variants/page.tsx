'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Card, Input, Label, Badge, Spinner } from '@platform/ui';
import { Plus, Edit2, Trash2, Package, DollarSign, Image as ImageIcon } from 'lucide-react';
import {
  variantsApi,
  attributeTypesApi,
  attributeValuesApi,
  ProductVariant,
  AttributeType,
  CreateVariantDto,
  UpdateVariantDto,
} from '@/lib/variants-api';
import { formatCurrency } from '@/app/storefront/_lib/format';

export default function ProductVariantsPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [attributeTypes, setAttributeTypes] = useState<AttributeType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);

  useEffect(() => {
    loadData();
  }, [productId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [variantsData, attributesData] = await Promise.all([
        variantsApi.list(productId),
        attributeTypesApi.list(),
      ]);
      setVariants(variantsData);
      setAttributeTypes(attributesData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (variantId: string) => {
    if (!confirm('Are you sure you want to delete this variant?')) return;

    try {
      await variantsApi.delete(variantId);
      await loadData();
    } catch (error) {
      console.error('Failed to delete variant:', error);
    }
  };

  const handleStockUpdate = async (variantId: string, newStock: number) => {
    try {
      await variantsApi.updateStock(variantId, newStock);
      await loadData();
    } catch (error) {
      console.error('Failed to update stock:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Product Variants</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage size, color, and other variations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Back to Product
          </Button>
          <Button
            onClick={() => setShowCreateForm(true)}
            className="bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Variant
          </Button>
        </div>
      </div>

      {/* Variants List */}
      {variants.length === 0 ? (
        <Card className="border-slate-200/70 bg-white p-12 text-center shadow-sm">
          <Package className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900">No variants yet</h3>
          <p className="mt-2 text-sm text-slate-500">
            Create variants to offer different options like size and color
          </p>
          <Button
            onClick={() => setShowCreateForm(true)}
            className="mt-4 bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white"
          >
            Create First Variant
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {variants.map((variant) => (
            <VariantCard
              key={variant.id}
              variant={variant}
              onEdit={setEditingVariant}
              onDelete={handleDelete}
              onStockUpdate={handleStockUpdate}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {(showCreateForm || editingVariant) && (
        <VariantFormModal
          productId={productId}
          variant={editingVariant}
          attributeTypes={attributeTypes}
          onClose={() => {
            setShowCreateForm(false);
            setEditingVariant(null);
          }}
          onSaved={() => {
            setShowCreateForm(false);
            setEditingVariant(null);
            loadData();
          }}
        />
      )}

      {/* Bulk Generation Helper */}
      {attributeTypes.length > 0 && (
        <Card className="border-blue-200/70 bg-blue-50 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-blue-900">Bulk Variant Generation</h3>
          <p className="mt-1 text-sm text-blue-700">
            Need to create multiple variants? Use the bulk generation tool to automatically
            create all combinations of your attribute values.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3 border-blue-300 bg-white text-blue-700 hover:bg-blue-100"
            onClick={() => {
              /* TODO: Implement bulk generation */
              alert('Bulk generation feature coming soon!');
            }}
          >
            Generate All Combinations
          </Button>
        </Card>
      )}
    </div>
  );
}

interface VariantCardProps {
  variant: ProductVariant;
  onEdit: (variant: ProductVariant) => void;
  onDelete: (id: string) => void;
  onStockUpdate: (id: string, stock: number) => void;
}

function VariantCard({ variant, onEdit, onDelete, onStockUpdate }: VariantCardProps) {
  const [isEditingStock, setIsEditingStock] = useState(false);
  const [stockValue, setStockValue] = useState(variant.stockQty.toString());

  const handleStockSave = () => {
    const newStock = parseInt(stockValue);
    if (!isNaN(newStock) && newStock >= 0) {
      onStockUpdate(variant.id, newStock);
      setIsEditingStock(false);
    }
  };

  const variantName = variant.attributes
    .map((attr) => attr.attributeValue.displayValue)
    .join(' / ');

  return (
    <Card className="border-slate-200/70 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-6">
        {/* Variant Image */}
        {variant.imageUrl ? (
          <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200">
            <img
              src={variant.imageUrl}
              alt={variantName}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
            <ImageIcon className="h-8 w-8 text-slate-300" />
          </div>
        )}

        {/* Variant Info */}
        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{variantName}</h3>
              <div className="mt-1 flex items-center gap-2">
                {variant.sku && (
                  <Badge variant="outline" className="bg-white">
                    SKU: {variant.sku}
                  </Badge>
                )}
                {variant.barcode && (
                  <Badge variant="outline" className="bg-white">
                    Barcode: {variant.barcode}
                  </Badge>
                )}
                {!variant.isActive && <Badge variant="destructive">Inactive</Badge>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onEdit(variant)}>
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(variant.id)}
                className="text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Price and Stock */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Price */}
            <div className="space-y-1">
              <div className="text-xs text-slate-500">Price</div>
              <div className="text-lg font-semibold text-slate-900">
                {variant.price !== null ? formatCurrency(variant.price) : '-'}
              </div>
              {variant.compareAtPrice && (
                <div className="text-xs text-slate-400 line-through">
                  {formatCurrency(variant.compareAtPrice)}
                </div>
              )}
            </div>

            {/* Stock */}
            <div className="space-y-1">
              <div className="text-xs text-slate-500">Stock</div>
              {isEditingStock ? (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={stockValue}
                    onChange={(e) => setStockValue(e.target.value)}
                    className="h-8 w-24"
                    min="0"
                  />
                  <Button size="sm" onClick={handleStockSave} className="h-8">
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsEditingStock(false);
                      setStockValue(variant.stockQty.toString());
                    }}
                    className="h-8"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold text-slate-900">
                    {variant.stockQty}
                  </div>
                  <button
                    onClick={() => setIsEditingStock(true)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                </div>
              )}
              {variant.allowBackorder && (
                <div className="text-xs text-blue-600">Backorder enabled</div>
              )}
            </div>

            {/* Status */}
            <div className="space-y-1">
              <div className="text-xs text-slate-500">Availability</div>
              <div className="flex items-center gap-2">
                {variant.stockQty > 0 ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-sm font-medium text-emerald-700">In Stock</span>
                  </>
                ) : variant.allowBackorder ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-sm font-medium text-blue-700">Backorder</span>
                  </>
                ) : (
                  <>
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="text-sm font-medium text-red-700">Out of Stock</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

interface VariantFormModalProps {
  productId: string;
  variant: ProductVariant | null;
  attributeTypes: AttributeType[];
  onClose: () => void;
  onSaved: () => void;
}

function VariantFormModal({
  productId,
  variant,
  attributeTypes,
  onClose,
  onSaved,
}: VariantFormModalProps) {
  const [formData, setFormData] = useState({
    sku: variant?.sku || '',
    barcode: variant?.barcode || '',
    price: variant?.price?.toString() || '',
    compareAtPrice: variant?.compareAtPrice?.toString() || '',
    imageUrl: variant?.imageUrl || '',
    stockQty: variant?.stockQty.toString() || '0',
    trackInventory: variant?.trackInventory ?? true,
    allowBackorder: variant?.allowBackorder ?? false,
    attributes: variant?.attributes.reduce((acc, attr) => {
      acc[attr.attributeType.id] = attr.attributeValue.id;
      return acc;
    }, {} as Record<string, string>) || {},
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (Object.keys(formData.attributes).length === 0) {
      setError('Please select at least one attribute');
      return;
    }

    setIsSaving(true);

    try {
      if (variant) {
        // Update existing variant
        const updateData: UpdateVariantDto = {
          sku: formData.sku || undefined,
          barcode: formData.barcode || undefined,
          price: formData.price ? parseFloat(formData.price) : undefined,
          compareAtPrice: formData.compareAtPrice
            ? parseFloat(formData.compareAtPrice)
            : undefined,
          imageUrl: formData.imageUrl || undefined,
          stockQty: parseInt(formData.stockQty),
          trackInventory: formData.trackInventory,
          allowBackorder: formData.allowBackorder,
        };
        await variantsApi.update(variant.id, updateData);
      } else {
        // Create new variant
        const createData: CreateVariantDto = {
          productListingId: productId,
          sku: formData.sku || undefined,
          barcode: formData.barcode || undefined,
          price: formData.price ? parseFloat(formData.price) : undefined,
          compareAtPrice: formData.compareAtPrice
            ? parseFloat(formData.compareAtPrice)
            : undefined,
          imageUrl: formData.imageUrl || undefined,
          stockQty: parseInt(formData.stockQty),
          trackInventory: formData.trackInventory,
          allowBackorder: formData.allowBackorder,
          attributes: Object.entries(formData.attributes).map(([typeId, valueId]) => ({
            attributeTypeId: typeId,
            attributeValueId: valueId,
          })),
        };
        await variantsApi.create(createData);
      }

      onSaved();
    } catch (err) {
      console.error('Failed to save variant:', err);
      setError(err instanceof Error ? err.message : 'Failed to save variant');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border-slate-200/70 bg-white p-6 shadow-xl">
        <h2 className="text-2xl font-semibold text-slate-900">
          {variant ? 'Edit Variant' : 'Create Variant'}
        </h2>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Attribute Selection */}
          {attributeTypes.map((attrType) => (
            <div key={attrType.id} className="space-y-2">
              <Label>{attrType.displayName} *</Label>
              <select
                value={formData.attributes[attrType.id] || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    attributes: {
                      ...formData.attributes,
                      [attrType.id]: e.target.value,
                    },
                  })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                required
                disabled={!!variant} // Can't change attributes on existing variants
              >
                <option value="">Select {attrType.displayName}</option>
                {attrType.values.map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.displayValue}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {/* SKU and Barcode */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="SKU-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="123456789"
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compareAtPrice">Compare at Price</Label>
              <Input
                id="compareAtPrice"
                type="number"
                step="0.01"
                min="0"
                value={formData.compareAtPrice}
                onChange={(e) =>
                  setFormData({ ...formData, compareAtPrice: e.target.value })
                }
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Image URL */}
          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input
              id="imageUrl"
              value={formData.imageUrl}
              onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          {/* Inventory */}
          <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Inventory</h3>
            <div className="space-y-2">
              <Label htmlFor="stockQty">Stock Quantity</Label>
              <Input
                id="stockQty"
                type="number"
                min="0"
                value={formData.stockQty}
                onChange={(e) => setFormData({ ...formData, stockQty: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.trackInventory}
                  onChange={(e) =>
                    setFormData({ ...formData, trackInventory: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">Track inventory</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.allowBackorder}
                  onChange={(e) =>
                    setFormData({ ...formData, allowBackorder: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">Allow backorders</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 border-t border-slate-200 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white"
            >
              {isSaving ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Saving...
                </>
              ) : variant ? (
                'Update Variant'
              ) : (
                'Create Variant'
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
