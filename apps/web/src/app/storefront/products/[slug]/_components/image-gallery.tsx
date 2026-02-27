'use client';

import { useState } from 'react';

/**
 * Image gallery with thumbnail navigation for the product detail page.
 * Allows users to click thumbnails to change the main displayed image.
 */
export function ImageGallery({ images, alt }: { images: string[]; alt: string }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (images.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="aspect-[4/3] w-full rounded-2xl overflow-hidden flex items-center justify-center bg-white">
        <img
          src={images[selectedIndex]}
          alt={`${alt} - image ${selectedIndex + 1}`}
          className="h-full w-full object-contain"
        />
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={index}
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
    </div>
  );
}
