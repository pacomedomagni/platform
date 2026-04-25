'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@platform/ui';
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';

const SWIPE_THRESHOLD = 40; // px

/**
 * Image gallery with thumbnail navigation, full-screen lightbox, hover-to-zoom
 * (pointer:fine), touch swipe (pointer:coarse) and keyboard arrow controls.
 */
export function ImageGallery({ images, alt }: { images: string[]; alt: string }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState<{ active: boolean; x: number; y: number }>({
    active: false,
    x: 50,
    y: 50,
  });
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);

  const next = useCallback(() => {
    setSelectedIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const prev = useCallback(() => {
    setSelectedIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  // Keyboard arrow support — wired globally while gallery has focus or
  // the lightbox is open. Focus stays in the gallery container.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key === 'Escape' && lightboxOpen) {
        setLightboxOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev, lightboxOpen]);

  if (images.length === 0) return null;

  // Touch swipe — only kicks in on coarse pointers (we don't override
  // mouse drag selection on desktop).
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const handleTouchEnd = () => {
    if (Math.abs(touchDeltaX.current) > SWIPE_THRESHOLD) {
      if (touchDeltaX.current < 0) next();
      else prev();
    }
    touchStartX.current = null;
    touchDeltaX.current = 0;
  };

  // Pointer:fine zoom — translate cursor coords into transform-origin %.
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return; // skip touch / pen
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoom({ active: true, x, y });
  };
  const handlePointerLeave = () => setZoom({ active: false, x: 50, y: 50 });

  return (
    <div className="space-y-3">
      {/* Main image — clickable to open lightbox, zoom on hover, swipeable on touch */}
      <div
        className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="absolute inset-0 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label={`Open ${alt} image ${selectedIndex + 1} in lightbox`}
        >
          <img
            src={images[selectedIndex]}
            alt={`${alt} - image ${selectedIndex + 1}`}
            className="h-full w-full object-contain transition-transform duration-200 ease-out [@media(pointer:coarse)]:!scale-100"
            style={
              zoom.active
                ? {
                    transform: 'scale(1.5)',
                    transformOrigin: `${zoom.x}% ${zoom.y}%`,
                  }
                : undefined
            }
            draggable={false}
          />
        </button>

        {/* Lightbox affordance */}
        <span
          className="pointer-events-none absolute right-3 top-3 hidden rounded-md bg-background/80 p-1.5 text-muted-foreground shadow-sm group-hover:block"
          aria-hidden="true"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </span>

        {/* Touch-only inline arrows for the gallery (kept on coarse pointers) */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground shadow-sm hover:bg-background [@media(pointer:coarse)]:block"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground shadow-sm hover:bg-background [@media(pointer:coarse)]:block"
              aria-label="Next image"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={`flex-shrink-0 h-16 w-16 rounded-lg overflow-hidden border-2 transition-colors ${
                index === selectedIndex
                  ? 'border-primary ring-1 ring-primary/30'
                  : 'border-border hover:border-muted-foreground'
              }`}
              aria-label={`View image ${index + 1}`}
              aria-current={index === selectedIndex ? 'true' : undefined}
            >
              <img
                src={image}
                alt={`${alt} thumbnail ${index + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Sheet open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <SheetContent
          side="bottom"
          className="h-screen w-screen max-w-none rounded-none border-0 bg-black/95 p-0"
        >
          <SheetTitle className="sr-only">
            {alt} — image {selectedIndex + 1} of {images.length}
          </SheetTitle>
          <div
            className="relative flex h-full w-full items-center justify-center"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={images[selectedIndex]}
              alt={`${alt} - image ${selectedIndex + 1}`}
              className="max-h-full max-w-full object-contain"
            />
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
                <div
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white"
                  aria-hidden="true"
                >
                  {selectedIndex + 1} / {images.length}
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
