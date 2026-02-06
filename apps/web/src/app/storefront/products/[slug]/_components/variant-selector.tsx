'use client';

import { useState, useEffect } from 'react';
import { Badge, Card } from '@platform/ui';
import { Check, AlertCircle } from 'lucide-react';
import { publicVariantsApi, ProductVariant, AttributeType } from '@/lib/variants-api';
import { formatCurrency } from '../../../_lib/format';

interface VariantSelectorProps {
  productSlug: string;
  productId: string;
  basePrice: number;
  onVariantChange?: (variant: ProductVariant | null) => void;
}

interface GroupedVariants {
  [attributeTypeName: string]: {
    type: AttributeType;
    values: Map<string, { value: any; available: boolean }>;
  };
}

export function VariantSelector({
  productSlug,
  productId,
  basePrice,
  onVariantChange,
}: VariantSelectorProps) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadVariants();
  }, [productSlug]);

  const loadVariants = async () => {
    try {
      setIsLoading(true);
      const data = await publicVariantsApi.list(productSlug);
      setVariants(data.filter((v) => v.isActive));
    } catch (error) {
      console.error('Failed to load variants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Find matching variant based on selected options
    if (Object.keys(selectedOptions).length === 0) {
      setSelectedVariant(null);
      onVariantChange?.(null);
      return;
    }

    const matchingVariant = variants.find((variant) => {
      return variant.attributes.every((attr) => {
        const selectedValue = selectedOptions[attr.attributeType.name];
        return selectedValue === attr.attributeValue.id;
      });
    });

    setSelectedVariant(matchingVariant || null);
    onVariantChange?.(matchingVariant || null);
  }, [selectedOptions, variants]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-20 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-20 animate-pulse rounded-lg bg-slate-200" />
      </div>
    );
  }

  if (variants.length === 0) {
    return null;
  }

  // Group variants by attribute types
  const groupedOptions = variants.reduce<GroupedVariants>((acc, variant) => {
    variant.attributes.forEach((attr) => {
      const typeName = attr.attributeType.name;

      if (!acc[typeName]) {
        acc[typeName] = {
          type: attr.attributeType,
          values: new Map(),
        };
      }

      const existingValue = acc[typeName].values.get(attr.attributeValue.id);
      const isAvailable = variant.stockQty > 0 || variant.allowBackorder;

      acc[typeName].values.set(attr.attributeValue.id, {
        value: attr.attributeValue,
        available: existingValue ? existingValue.available || isAvailable : isAvailable,
      });
    });

    return acc;
  }, {});

  const handleOptionSelect = (attributeTypeName: string, valueId: string) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [attributeTypeName]: valueId,
    }));
  };

  const isOptionAvailable = (attributeTypeName: string, valueId: string): boolean => {
    // Check if selecting this option would result in a valid variant
    const testOptions = {
      ...selectedOptions,
      [attributeTypeName]: valueId,
    };

    return variants.some((variant) => {
      const matches = variant.attributes.every((attr) => {
        const testValue = testOptions[attr.attributeType.name];
        return !testValue || testValue === attr.attributeValue.id;
      });

      return matches && (variant.stockQty > 0 || variant.allowBackorder);
    });
  };

  const currentPrice = selectedVariant?.price ?? basePrice;
  const currentComparePrice = selectedVariant?.compareAtPrice;
  const currentStock = selectedVariant?.stockQty ?? 0;
  const isInStock = selectedVariant
    ? currentStock > 0 || selectedVariant.allowBackorder
    : true;

  return (
    <div className="space-y-6">
      {/* Variant Options */}
      {Object.entries(groupedOptions)
        .sort(([, a], [, b]) => a.type.sortOrder - b.type.sortOrder)
        .map(([typeName, { type, values }]) => {
          const isColorAttribute = type.name === 'color';

          return (
            <div key={typeName} className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-900">
                  {type.displayName}
                </label>
                {selectedOptions[typeName] && (
                  <span className="text-sm text-slate-600">
                    {
                      Array.from(values.values()).find(
                        (v) => v.value.id === selectedOptions[typeName]
                      )?.value.displayValue
                    }
                  </span>
                )}
              </div>

              <div className={`flex flex-wrap gap-2 ${isColorAttribute ? 'gap-3' : ''}`}>
                {Array.from(values.values())
                  .sort((a, b) => a.value.sortOrder - b.value.sortOrder)
                  .map(({ value, available }) => {
                    const isSelected = selectedOptions[typeName] === value.id;
                    const isAvailable = isOptionAvailable(typeName, value.id);

                    if (isColorAttribute && value.colorHex) {
                      // Color swatch
                      return (
                        <button
                          key={value.id}
                          onClick={() =>
                            isAvailable && handleOptionSelect(typeName, value.id)
                          }
                          disabled={!isAvailable}
                          className={`relative h-12 w-12 rounded-full border-2 transition-all ${
                            isSelected
                              ? 'border-blue-600 ring-2 ring-blue-600/30'
                              : 'border-slate-300 hover:border-slate-400'
                          } ${!isAvailable && 'cursor-not-allowed opacity-40'}`}
                          title={value.displayValue}
                        >
                          <div
                            className="h-full w-full rounded-full"
                            style={{ backgroundColor: value.colorHex }}
                          />
                          {isSelected && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Check className="h-5 w-5 text-white drop-shadow-md" />
                            </div>
                          )}
                          {!isAvailable && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="h-0.5 w-full rotate-45 bg-slate-400" />
                            </div>
                          )}
                        </button>
                      );
                    }

                    // Text button
                    return (
                      <button
                        key={value.id}
                        onClick={() => isAvailable && handleOptionSelect(typeName, value.id)}
                        disabled={!isAvailable}
                        className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                        } ${!isAvailable && 'cursor-not-allowed opacity-40 line-through'}`}
                      >
                        {value.displayValue}
                      </button>
                    );
                  })}
              </div>
            </div>
          );
        })}

      {/* Price and Stock Info */}
      <Card className="border-slate-200/70 bg-white p-4 shadow-sm">
        <div className="space-y-3">
          {/* Price */}
          <div className="flex items-center gap-3">
            <span className="text-2xl font-semibold text-slate-900">
              {formatCurrency(currentPrice)}
            </span>
            {currentComparePrice && currentComparePrice > currentPrice && (
              <>
                <span className="text-sm text-slate-400 line-through">
                  {formatCurrency(currentComparePrice)}
                </span>
                <Badge variant="success">
                  Save{' '}
                  {Math.round(
                    ((currentComparePrice - currentPrice) / currentComparePrice) * 100
                  )}
                  %
                </Badge>
              </>
            )}
          </div>

          {/* Stock Status */}
          {selectedVariant && (
            <div className="flex items-center gap-2 text-sm">
              {isInStock ? (
                <>
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="font-medium text-emerald-700">
                    {currentStock > 0
                      ? `${currentStock} in stock`
                      : 'Available (backorder)'}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="font-medium text-red-700">Out of stock</span>
                </>
              )}
            </div>
          )}

          {/* Variant SKU */}
          {selectedVariant?.sku && (
            <div className="text-xs text-slate-500">SKU: {selectedVariant.sku}</div>
          )}
        </div>
      </Card>

      {/* Selected Variant Image */}
      {selectedVariant?.imageUrl && (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <img
            src={selectedVariant.imageUrl}
            alt="Selected variant"
            className="h-48 w-full object-cover"
          />
        </div>
      )}
    </div>
  );
}
