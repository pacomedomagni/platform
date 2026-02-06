'use client';

import { useState, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  showAlpha?: boolean;
  className?: string;
}

const PRESET_COLORS = [
  '#000000', '#FFFFFF', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899',
  '#1F2937', '#F3F4F6', '#DC2626', '#D97706', '#059669', '#2563EB', '#7C3AED', '#DB2777',
];

export function ColorPicker({ label, value, onChange, showAlpha = false, className }: ColorPickerProps) {
  const [localValue, setLocalValue] = useState(value);
  const [recentColors, setRecentColors] = useState<string[]>([]);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleColorChange = (newColor: string) => {
    setLocalValue(newColor);
    onChange(newColor);

    // Add to recent colors
    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c !== newColor);
      return [newColor, ...filtered].slice(0, 8);
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // Validate hex color
    if (/^#[0-9A-F]{6}$/i.test(newValue)) {
      onChange(newValue);
    }
  };

  const getContrastColor = (hexColor: string) => {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#000000' : '#FFFFFF';
  };

  const contrastColor = getContrastColor(localValue);
  const contrastRatio = contrastColor === '#FFFFFF' ? 'Dark text' : 'Light text';

  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="w-12 h-12 rounded-md border-2 border-border shadow-sm transition-all hover:scale-105"
              style={{ backgroundColor: localValue }}
              aria-label={`Pick ${label}`}
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="start">
            <div className="space-y-4">
              <HexColorPicker color={localValue} onChange={handleColorChange} />

              {/* Preset Colors */}
              <div>
                <p className="text-xs font-medium mb-2">Presets</p>
                <div className="grid grid-cols-8 gap-1">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      onClick={() => handleColorChange(color)}
                      aria-label={color}
                    />
                  ))}
                </div>
              </div>

              {/* Recent Colors */}
              {recentColors.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2">Recent</p>
                  <div className="grid grid-cols-8 gap-1">
                    {recentColors.map((color) => (
                      <button
                        key={color}
                        className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                        onClick={() => handleColorChange(color)}
                        aria-label={color}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex-1">
          <Input
            value={localValue}
            onChange={handleInputChange}
            placeholder="#000000"
            className="font-mono text-sm"
          />
        </div>
      </div>

      {/* Contrast Checker */}
      <div className="text-xs text-muted-foreground">
        Recommended for: {contrastRatio}
      </div>
    </div>
  );
}
