'use client';

import { useState, useMemo } from 'react';
import { Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

const GOOGLE_FONTS = [
  // Popular fonts
  { name: 'Inter', category: 'sans-serif', popular: true },
  { name: 'Roboto', category: 'sans-serif', popular: true },
  { name: 'Open Sans', category: 'sans-serif', popular: true },
  { name: 'Lato', category: 'sans-serif', popular: true },
  { name: 'Montserrat', category: 'sans-serif', popular: true },
  { name: 'Poppins', category: 'sans-serif', popular: true },
  { name: 'Source Sans Pro', category: 'sans-serif', popular: true },
  { name: 'Raleway', category: 'sans-serif', popular: true },

  // Serif fonts
  { name: 'Merriweather', category: 'serif', popular: true },
  { name: 'Playfair Display', category: 'serif', popular: true },
  { name: 'Lora', category: 'serif', popular: true },
  { name: 'PT Serif', category: 'serif', popular: false },
  { name: 'Crimson Text', category: 'serif', popular: false },
  { name: 'EB Garamond', category: 'serif', popular: false },

  // Display fonts
  { name: 'Bebas Neue', category: 'display', popular: true },
  { name: 'Righteous', category: 'display', popular: false },
  { name: 'Permanent Marker', category: 'display', popular: false },
  { name: 'Abril Fatface', category: 'display', popular: false },

  // Monospace fonts
  { name: 'JetBrains Mono', category: 'monospace', popular: true },
  { name: 'Fira Code', category: 'monospace', popular: true },
  { name: 'Source Code Pro', category: 'monospace', popular: false },
  { name: 'IBM Plex Mono', category: 'monospace', popular: false },

  // More Sans-serif
  { name: 'Nunito', category: 'sans-serif', popular: false },
  { name: 'Work Sans', category: 'sans-serif', popular: false },
  { name: 'Rubik', category: 'sans-serif', popular: false },
  { name: 'Outfit', category: 'sans-serif', popular: false },
  { name: 'DM Sans', category: 'sans-serif', popular: false },
  { name: 'Manrope', category: 'sans-serif', popular: false },
];

const FONT_WEIGHTS = [
  { value: '300', label: 'Light' },
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semi Bold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'Extra Bold' },
];

interface FontSelectorProps {
  label: string;
  value: string;
  weight?: string;
  onChange: (font: string) => void;
  onWeightChange?: (weight: string) => void;
  className?: string;
}

export function FontSelector({
  label,
  value,
  weight = '400',
  onChange,
  onWeightChange,
  className,
}: FontSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedFont = GOOGLE_FONTS.find((font) => font.name === value);

  const filteredFonts = useMemo(() => {
    const query = search.toLowerCase();
    return GOOGLE_FONTS.filter((font) =>
      font.name.toLowerCase().includes(query)
    );
  }, [search]);

  const popularFonts = filteredFonts.filter((font) => font.popular);
  const otherFonts = filteredFonts.filter((font) => !font.popular);

  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>

      <div className="space-y-2">
        {/* Font Family Selector */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              <span style={{ fontFamily: value }}>{value}</span>
              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search fonts..."
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                <CommandEmpty>No font found.</CommandEmpty>

                {popularFonts.length > 0 && (
                  <CommandGroup heading="Popular Fonts">
                    {popularFonts.map((font) => (
                      <CommandItem
                        key={font.name}
                        value={font.name}
                        onSelect={() => {
                          onChange(font.name);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            value === font.name ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <span style={{ fontFamily: font.name }}>
                          {font.name}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {font.category}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {otherFonts.length > 0 && (
                  <CommandGroup heading="All Fonts">
                    {otherFonts.map((font) => (
                      <CommandItem
                        key={font.name}
                        value={font.name}
                        onSelect={() => {
                          onChange(font.name);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            value === font.name ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <span style={{ fontFamily: font.name }}>
                          {font.name}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {font.category}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Font Weight Selector */}
        {onWeightChange && (
          <div className="flex gap-2">
            {FONT_WEIGHTS.map((w) => (
              <Button
                key={w.value}
                variant={weight === w.value ? 'default' : 'outline'}
                size="sm"
                className="flex-1 text-xs"
                onClick={() => onWeightChange(w.value)}
              >
                {w.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Preview */}
      <div
        className="p-4 border rounded-md bg-muted/50"
        style={{ fontFamily: value, fontWeight: weight }}
      >
        <p className="text-sm">The quick brown fox jumps over the lazy dog</p>
        <p className="text-lg mt-2">0123456789</p>
      </div>
    </div>
  );
}
