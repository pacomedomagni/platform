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
PopoverContent.displayName = PopoverPrimitive.Content.displayName


interface LinkFieldProps {
  field: DocFieldDefinition;
  value: string;
  onChange: (val: string) => void;
}

// We need a way to fetch data. passing a fetcher prop or using a global fetcher context is best.
// For now, let's assume a global fetcher function exists or we mock it.
// To keep libs/ui pure, we should probably pass `fetchOptions`.
// But for simplicity in this monolith, I'll allow passing a fetch callback 
// OR assume a default API location if we want to be opinionated.
// Better: Add a prop `fetchList: (doctype) => Promise<any[]>`

export const LinkField = ({ field, value, onChange }: LinkFieldProps) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch logic
  useEffect(() => {
    if (!open) return; // Only fetch when opened
    if (items.length > 0) return; // Cache locally

    const load = async () => {
        setLoading(true);
        try {
            // Hardcoded fetch for now, matching the desk api structure
            // In a real lib we would inject this dependency
            const res = await fetch(`http://localhost:3000/api/v1/${field.target}`);
            if (res.ok) {
                const json = await res.json();
                setItems(json);
            }
        } catch (e) {
            console.error("Link fetch failed", e);
        } finally {
            setLoading(false);
        }
    };
    load();
  }, [open, field.target, items.length]);

  return (
    <div className="space-y-2">
      <Label>{field.label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button" // prevent form submit
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-transparent border border-input h-9 px-3 font-normal"
          >
            {value ? value : "Select..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder={`Search ${field.target}...`} />
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
