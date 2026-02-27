'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button } from '@platform/ui';

const navLinks = [
  { label: 'Home', href: '/storefront' },
  { label: 'Shop', href: '/storefront/products' },
  { label: 'Collections', href: '/storefront#collections' },
  { label: 'Why NoSlag', href: '/storefront#features' },
  { label: 'Support', href: '/storefront#support' },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  // Close the menu when the Escape key is pressed
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    },
    [open]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {open && (
        <div className="fixed inset-0 top-16 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <nav
            className="relative border-b border-border bg-card shadow-lg"
            aria-label="Mobile navigation"
          >
            <div className="mx-auto max-w-7xl space-y-1 px-6 py-4">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {link.label}
                </Link>
              ))}
              <div className="border-t border-border pt-3 mt-2">
                <Link
                  href="/storefront/account"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  My Account
                </Link>
              </div>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
