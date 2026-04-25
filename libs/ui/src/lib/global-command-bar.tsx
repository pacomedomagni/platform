'use client';

import * as React from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from './command';

export interface CommandRoute {
  label: string;
  href: string;
  group?: string;
  keywords?: string[];
  shortcut?: string;
  icon?: React.ReactNode;
}

const RECENT_KEY = 'noslag.commandbar.recent';
const MAX_RECENT = 5;

function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function pushRecent(href: string) {
  if (typeof window === 'undefined') return;
  const current = readRecent().filter((h) => h !== href);
  current.unshift(href);
  localStorage.setItem(RECENT_KEY, JSON.stringify(current.slice(0, MAX_RECENT)));
}

export interface GlobalCommandBarProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  routes?: CommandRoute[];
  /** Called when a route is chosen. Receives the route's href. Defaults to window.location.assign. */
  onSelectRoute?: (href: string) => void;
}

export function GlobalCommandBar({
  open: externalOpen,
  onOpenChange,
  routes = [],
  onSelectRoute,
}: GlobalCommandBarProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [recent, setRecent] = React.useState<string[]>([]);

  const open = externalOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  React.useEffect(() => {
    if (open) setRecent(readRecent());
  }, [open]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (onOpenChange) onOpenChange(!open);
        else setInternalOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const handleSelect = (href: string) => {
    pushRecent(href);
    setOpen(false);
    if (onSelectRoute) onSelectRoute(href);
    else if (typeof window !== 'undefined') window.location.assign(href);
  };

  const grouped = React.useMemo(() => {
    const groups = new Map<string, CommandRoute[]>();
    for (const r of routes) {
      const g = r.group || 'Navigate';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(r);
    }
    return Array.from(groups.entries());
  }, [routes]);

  const recentRoutes = React.useMemo(
    () => recent.map((href) => routes.find((r) => r.href === href)).filter((r): r is CommandRoute => !!r),
    [recent, routes]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, modules, settings…" />
      <CommandList>
        <CommandEmpty>No matches. Try a different keyword.</CommandEmpty>

        {recentRoutes.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recentRoutes.map((r) => (
                <CommandItem
                  key={`recent-${r.href}`}
                  value={`recent ${r.label} ${(r.keywords || []).join(' ')}`}
                  onSelect={() => handleSelect(r.href)}
                >
                  {r.icon}
                  <span>{r.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {grouped.map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((r) => (
              <CommandItem
                key={r.href}
                value={`${r.label} ${r.group ?? ''} ${(r.keywords || []).join(' ')}`}
                onSelect={() => handleSelect(r.href)}
              >
                {r.icon}
                <span>{r.label}</span>
                {r.shortcut && <span className="ml-auto text-[10px] text-muted-foreground">{r.shortcut}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
