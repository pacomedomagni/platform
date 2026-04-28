'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';

export interface VariationVariant {
  sku: string;
  price: string;
  quantity: string;
  imageUrl?: string;
  /** Map of aspect name to selected value, e.g. { Color: 'Red', Size: 'M' } */
  aspects: Record<string, string>;
}

export interface VariationMatrixValue {
  /** Aspect names that vary across SKUs, e.g. ["Color", "Size"]. Up to 2 supported. */
  variantAspectNames: string[];
  /** Concrete values per aspect, e.g. { Color: ['Red', 'Blue'], Size: ['S', 'M', 'L'] } */
  aspectValues: Record<string, string[]>;
  /** One variant per concrete combination of aspect values. */
  variants: VariationVariant[];
}

interface VariationMatrixProps {
  value: VariationMatrixValue;
  onChange: (next: VariationMatrixValue) => void;
  baseSku: string;
  basePrice: string;
  baseQuantity: string;
  baseCondition: string;
}

/**
 * Variation matrix builder.
 *
 * Step 1 — pick 1 or 2 aspect names that vary (e.g. "Color", "Size").
 * Step 2 — type comma-separated values for each aspect ("Red, Blue, Black").
 * Step 3 — auto-generate a row per combination, with editable SKU / price /
 *          quantity / image. Submitting the parent listing turns this into
 *          an inventory item group + N child offers via the existing
 *          `POST /marketplace/ebay/listings/variations` endpoint.
 */
export function VariationMatrix({
  value,
  onChange,
  baseSku,
  basePrice,
  baseQuantity,
}: VariationMatrixProps) {
  const [aspectNameInput, setAspectNameInput] = useState('');

  const addAspect = () => {
    const name = aspectNameInput.trim();
    if (!name || value.variantAspectNames.includes(name) || value.variantAspectNames.length >= 2) {
      return;
    }
    onChange({
      ...value,
      variantAspectNames: [...value.variantAspectNames, name],
      aspectValues: { ...value.aspectValues, [name]: [] },
    });
    setAspectNameInput('');
  };

  const removeAspect = (name: string) => {
    const nextNames = value.variantAspectNames.filter((n) => n !== name);
    const nextValues = { ...value.aspectValues };
    delete nextValues[name];
    onChange({
      ...value,
      variantAspectNames: nextNames,
      aspectValues: nextValues,
      variants: [],
    });
  };

  const setAspectValuesText = (name: string, text: string) => {
    const parsed = text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onChange({ ...value, aspectValues: { ...value.aspectValues, [name]: parsed } });
  };

  // Compute the full cartesian product of aspect values.
  const combinations = useMemo(() => {
    if (value.variantAspectNames.length === 0) return [];
    const lists = value.variantAspectNames.map((n) => value.aspectValues[n] || []);
    if (lists.some((l) => l.length === 0)) return [];
    const out: Record<string, string>[] = [];
    const walk = (idx: number, acc: Record<string, string>) => {
      if (idx === lists.length) {
        out.push({ ...acc });
        return;
      }
      const name = value.variantAspectNames[idx];
      for (const v of lists[idx]) {
        acc[name] = v;
        walk(idx + 1, acc);
      }
    };
    walk(0, {});
    return out;
  }, [value.variantAspectNames, value.aspectValues]);

  // Sync the variants list to match the computed combinations.
  useEffect(() => {
    if (combinations.length === 0 && value.variants.length === 0) return;
    const byKey = new Map(value.variants.map((v) => [variantKey(v.aspects, value.variantAspectNames), v]));
    const next: VariationVariant[] = combinations.map((aspects, idx) => {
      const key = variantKey(aspects, value.variantAspectNames);
      const existing = byKey.get(key);
      if (existing) return { ...existing, aspects };
      return {
        sku: `${baseSku || 'SKU'}-${idx + 1}`,
        price: basePrice,
        quantity: baseQuantity || '1',
        imageUrl: '',
        aspects,
      };
    });
    // Only emit when something changed to avoid render loops.
    if (
      next.length !== value.variants.length ||
      next.some((n, i) => variantKey(n.aspects, value.variantAspectNames) !== variantKey(value.variants[i]?.aspects || {}, value.variantAspectNames))
    ) {
      onChange({ ...value, variants: next });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combinations.length, value.variantAspectNames.join('|')]);

  const updateVariant = (index: number, patch: Partial<VariationVariant>) => {
    const next = value.variants.map((v, i) => (i === index ? { ...v, ...patch } : v));
    onChange({ ...value, variants: next });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">Aspects that vary</p>
        <p className="text-xs text-gray-500 mb-2">
          Pick the 1–2 attributes that differ across your variants — most often Color and Size.
          eBay only allows up to 2 varying aspects per inventory item group.
        </p>
        <div className="flex flex-wrap gap-2 mb-2">
          {value.variantAspectNames.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-sm"
            >
              {name}
              <button
                type="button"
                onClick={() => removeAspect(name)}
                className="hover:text-blue-900"
                title="Remove aspect"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        {value.variantAspectNames.length < 2 && (
          <div className="flex gap-2">
            <input
              type="text"
              value={aspectNameInput}
              onChange={(e) => setAspectNameInput(e.target.value)}
              placeholder="e.g. Color"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addAspect();
                }
              }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <button
              type="button"
              onClick={addAspect}
              disabled={!aspectNameInput.trim()}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm disabled:opacity-50 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Add aspect
            </button>
          </div>
        )}
      </div>

      {value.variantAspectNames.length > 0 && (
        <div className="space-y-3">
          {value.variantAspectNames.map((name) => (
            <div key={name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {name} values
              </label>
              <input
                type="text"
                value={(value.aspectValues[name] || []).join(', ')}
                onChange={(e) => setAspectValuesText(name, e.target.value)}
                placeholder="Comma-separated, e.g. Red, Blue, Black"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          ))}
        </div>
      )}

      {value.variants.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Variants ({value.variants.length})
          </p>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  {value.variantAspectNames.map((n) => (
                    <th key={n} className="text-left px-3 py-2 font-medium">{n}</th>
                  ))}
                  <th className="text-left px-3 py-2 font-medium">SKU</th>
                  <th className="text-left px-3 py-2 font-medium">Price</th>
                  <th className="text-left px-3 py-2 font-medium">Qty</th>
                  <th className="text-left px-3 py-2 font-medium">Image URL</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {value.variants.map((v, idx) => (
                  <tr key={variantKey(v.aspects, value.variantAspectNames)} className="border-t border-gray-200">
                    {value.variantAspectNames.map((n) => (
                      <td key={n} className="px-3 py-2 text-gray-700">{v.aspects[n]}</td>
                    ))}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={v.sku}
                        onChange={(e) => updateVariant(idx, { sku: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={v.price}
                        onChange={(e) => updateVariant(idx, { price: e.target.value })}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        value={v.quantity}
                        onChange={(e) => updateVariant(idx, { quantity: e.target.value })}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="url"
                        value={v.imageUrl || ''}
                        onChange={(e) => updateVariant(idx, { imageUrl: e.target.value })}
                        placeholder="https://…"
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() =>
                          onChange({ ...value, variants: value.variants.filter((_, i) => i !== idx) })
                        }
                        className="text-red-500 hover:text-red-700"
                        title="Remove this variant"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Need a different photo per variant? Drop the image URL into the row. The first photo
            on the parent listing is still used as the gallery image.
          </p>
        </div>
      )}
    </div>
  );
}

function variantKey(aspects: Record<string, string>, names: string[]): string {
  return names.map((n) => `${n}=${aspects[n] || ''}`).join('|');
}
