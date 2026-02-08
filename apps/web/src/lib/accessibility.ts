/**
 * Accessibility Utilities
 * WCAG 2.1 AA/AAA Compliance Helpers
 * 
 * Provides utilities for:
 * - Color contrast validation
 * - Focus management
 * - Screen reader announcements
 * - Reduced motion detection
 */

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Calculate relative luminance of a color
 * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 * @see https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 * @returns Contrast ratio between 1:1 and 21:1
 */
export function getContrastRatio(color1: string, color2: string): number {
  const l1 = getRelativeLuminance(color1);
  const l2 = getRelativeLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * WCAG 2.1 contrast requirements
 */
export const WCAG_REQUIREMENTS = {
  AA: {
    normalText: 4.5,
    largeText: 3,
    uiComponents: 3,
  },
  AAA: {
    normalText: 7,
    largeText: 4.5,
    uiComponents: 4.5,
  },
} as const;

/**
 * Check if contrast meets WCAG AA requirements
 * @param contrast - Contrast ratio
 * @param largeText - Whether text is large (18pt+ or 14pt+ bold)
 */
export function meetsWCAGAA(contrast: number, largeText = false): boolean {
  return largeText ? contrast >= WCAG_REQUIREMENTS.AA.largeText : contrast >= WCAG_REQUIREMENTS.AA.normalText;
}

/**
 * Check if contrast meets WCAG AAA requirements
 */
export function meetsWCAGAAA(contrast: number, largeText = false): boolean {
  return largeText ? contrast >= WCAG_REQUIREMENTS.AAA.largeText : contrast >= WCAG_REQUIREMENTS.AAA.normalText;
}

/**
 * Get WCAG compliance level for a contrast ratio
 */
export function getWCAGLevel(contrast: number, largeText = false): 'AAA' | 'AA' | 'Fail' {
  if (meetsWCAGAAA(contrast, largeText)) return 'AAA';
  if (meetsWCAGAA(contrast, largeText)) return 'AA';
  return 'Fail';
}

/**
 * Find a color that meets contrast requirements against a background
 * Adjusts lightness to achieve target contrast
 */
export function ensureContrast(
  foreground: string,
  background: string,
  targetRatio: number = WCAG_REQUIREMENTS.AA.normalText
): string {
  const currentRatio = getContrastRatio(foreground, background);
  if (currentRatio >= targetRatio) return foreground;

  // Determine if we should lighten or darken
  const bgLuminance = getRelativeLuminance(background);
  const shouldLighten = bgLuminance < 0.5;

  // Adjust color until we meet the contrast requirement
  const rgb = hexToRgb(foreground);
  if (!rgb) return foreground;

  let { r, g, b } = rgb;
  const step = shouldLighten ? 5 : -5;
  let iterations = 0;
  const maxIterations = 51; // Max 255/5 iterations

  while (iterations < maxIterations) {
    r = Math.max(0, Math.min(255, r + step));
    g = Math.max(0, Math.min(255, g + step));
    b = Math.max(0, Math.min(255, b + step));

    const newHex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    if (getContrastRatio(newHex, background) >= targetRatio) {
      return newHex;
    }
    iterations++;
  }

  // Fallback to black or white
  return shouldLighten ? '#FFFFFF' : '#000000';
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if user prefers high contrast
 */
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(prefers-contrast: more)').matches ||
    window.matchMedia('(-ms-high-contrast: active)').matches
  );
}

/**
 * Announce message to screen readers
 * Creates a live region that announces the message
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  if (typeof document === 'undefined') return;

  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement is read
  setTimeout(() => {
    announcement.remove();
  }, 1000);
}

/**
 * Trap focus within an element (for modals, dialogs)
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableElements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);
  firstFocusable?.focus();

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Generate accessible color pair (foreground/background)
 * that meets WCAG AA requirements
 */
export function generateAccessibleColorPair(
  baseColor: string,
  level: 'AA' | 'AAA' = 'AA'
): { foreground: string; background: string } {
  const baseLuminance = getRelativeLuminance(baseColor);
  const targetRatio = level === 'AAA' ? WCAG_REQUIREMENTS.AAA.normalText : WCAG_REQUIREMENTS.AA.normalText;

  // Determine if base is light or dark
  if (baseLuminance > 0.5) {
    // Light background, dark foreground
    return {
      background: baseColor,
      foreground: ensureContrast('#000000', baseColor, targetRatio),
    };
  } else {
    // Dark background, light foreground
    return {
      background: baseColor,
      foreground: ensureContrast('#FFFFFF', baseColor, targetRatio),
    };
  }
}

/**
 * CSS for visually hidden content (screen reader only)
 */
export const srOnlyStyles = {
  position: 'absolute' as const,
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap' as const,
  border: '0',
};

/**
 * Check if an element is visible to assistive technology
 */
export function isAccessible(element: HTMLElement): boolean {
  if (element.getAttribute('aria-hidden') === 'true') return false;
  if (element.hasAttribute('hidden')) return false;
  
  const style = window.getComputedStyle(element);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (style.opacity === '0') return false;

  return true;
}
