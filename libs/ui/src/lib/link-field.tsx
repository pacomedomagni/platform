'use client';

import React, { useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "./utils";
import { Button, Label } from "./atoms";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { DocFieldDefinition } from "./types";

// --- Simple Popover Wrapper (styled) ---
const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = "PopoverContent"


interface LinkFieldProps {
  field: DocFieldDefinition;
  value: string;
  onChange: (val: string) => void;
  /** Optional custom fetcher for testing or different API structures */
  fetchOptions?: (doctype: string) => Promise<any[]>;
}

// Cache expiry time in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

export const LinkField = ({ field, value, onChange, fetchOptions }: LinkFieldProps) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  
  // Use options as the standard source for DocType, fallback to target
  const docType = field.options || field.target;

  // Fetch logic with cache expiry
  useEffect(() => {
    if (!open) return; // Only fetch when opened
    if (!docType) return;
    
    // Check if cache is still valid
    const now = Date.now();
    const cacheExpired = now - lastFetchTime > CACHE_TTL;
    if (items.length > 0 && !cacheExpired) return; // Use cached data if still valid

    const load = async () => {
        setLoading(true);
        try {
            let data: any[] = [];
            if (fetchOptions) {
                data = await fetchOptions(docType);
            } else {
                // Default to standard Universal Controller endpoint
                const res = await fetch(`/api/v1/${docType}`);
                if (res.ok) {
                    data = await res.json();
                }
            }
            
            if (Array.isArray(data)) {
                setItems(data);
                setLastFetchTime(Date.now());
            }
        } catch (e) {
            console.error(`Link fetch failed for ${docType}`, e);
        } finally {
            setLoading(false);
        }
    };
    load();
  }, [open, docType, items.length, lastFetchTime, fetchOptions]);
  
  // Force refresh when dropdown opens after being closed for a while
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    // If opening and cache is expired, clear items to trigger refetch
    if (isOpen && Date.now() - lastFetchTime > CACHE_TTL) {
      setItems([]);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{field.label}</Label>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button" // prevent form submit
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-transparent border border-input/80 h-10 px-3 font-normal"
          >
            {value ? value : "Select..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command>
            <CommandInput placeholder={`Search ${docType}...`} />
            <CommandList>
                {loading && <div className="py-2 px-2 text-sm text-muted-foreground">Loading...</div>}
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup>
                {items.map((item) => (
                    <CommandItem
                    key={item.id}
                    value={item.name}
                    onSelect={(currentValue) => {
                        onChange(currentValue === value ? "" : currentValue)
                        setOpen(false)
                    }}
                    >
                    <Check
                        className={cn(
                        "mr-2 h-4 w-4",
                        value === item.name ? "opacity-100" : "opacity-0"
                        )}
                    />
                    {item.name}
                    </CommandItem>
                ))}
                </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
