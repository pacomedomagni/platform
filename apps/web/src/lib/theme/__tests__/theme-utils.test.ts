/**
 * Theme Utilities Tests
 */

import {
  hexToHSL,
  hexToRGB,
  hslToString,
  getLuminance,
  getContrastColor,
  validateTheme,
  mergeThemes,
  getDefaultColors,
  extractFontFamilies,
  formatGoogleFontUrl,
} from '../theme-utils';
import type { Theme } from '../types';

describe('Color Utilities', () => {
  describe('hexToHSL', () => {
    it('should convert hex to HSL correctly', () => {
      const hsl = hexToHSL('#0070f3');
      expect(hsl.h).toBeGreaterThanOrEqual(0);
      expect(hsl.h).toBeLessThanOrEqual(360);
      expect(hsl.s).toBeGreaterThanOrEqual(0);
      expect(hsl.s).toBeLessThanOrEqual(100);
      expect(hsl.l).toBeGreaterThanOrEqual(0);
      expect(hsl.l).toBeLessThanOrEqual(100);
    });

    it('should handle hex without # prefix', () => {
      const hsl1 = hexToHSL('#ff0000');
      const hsl2 = hexToHSL('ff0000');
      expect(hsl1).toEqual(hsl2);
    });

    it('should convert white correctly', () => {
      const hsl = hexToHSL('#ffffff');
      expect(hsl.l).toBe(100);
    });

    it('should convert black correctly', () => {
      const hsl = hexToHSL('#000000');
      expect(hsl.l).toBe(0);
    });
  });

  describe('hexToRGB', () => {
    it('should convert hex to RGB correctly', () => {
      const rgb = hexToRGB('#0070f3');
      expect(rgb.r).toBe(0);
      expect(rgb.g).toBe(112);
      expect(rgb.b).toBe(243);
    });

    it('should handle hex without # prefix', () => {
      const rgb = hexToRGB('ff0000');
      expect(rgb.r).toBe(255);
      expect(rgb.g).toBe(0);
      expect(rgb.b).toBe(0);
    });
  });

  describe('hslToString', () => {
    it('should format HSL as CSS string', () => {
      const hsl = { h: 220, s: 100, l: 50 };
      const str = hslToString(hsl);
      expect(str).toBe('220 100% 50%');
    });
  });

  describe('getLuminance', () => {
    it('should calculate luminance correctly', () => {
      const luminance = getLuminance('#ffffff');
      expect(luminance).toBeCloseTo(1, 1);
    });

    it('should return 0 for black', () => {
      const luminance = getLuminance('#000000');
      expect(luminance).toBe(0);
    });
  });

  describe('getContrastColor', () => {
    it('should return dark for light backgrounds', () => {
      expect(getContrastColor('#ffffff')).toBe('dark');
      expect(getContrastColor('#f0f0f0')).toBe('dark');
    });

    it('should return light for dark backgrounds', () => {
      expect(getContrastColor('#000000')).toBe('light');
      expect(getContrastColor('#1a1a1a')).toBe('light');
    });
  });
});

describe('Theme Utilities', () => {
  describe('validateTheme', () => {
    const validTheme: Theme = {
      id: '123',
      name: 'Test Theme',
      slug: 'test-theme',
      tenantId: 'tenant-1',
      isActive: true,
      colors: {
        primary: '#0070f3',
        secondary: '#7928ca',
        accent: '#ff0080',
        background: '#ffffff',
        foreground: '#000000',
        card: '#ffffff',
        cardForeground: '#000000',
        popover: '#ffffff',
        popoverForeground: '#000000',
        muted: '#f4f4f5',
        mutedForeground: '#71717a',
        border: '#e4e4e7',
        input: '#e4e4e7',
        ring: '#0070f3',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
        chart1: '#0070f3',
        chart2: '#7928ca',
        chart3: '#ff0080',
        chart4: '#22c55e',
        chart5: '#f59e0b',
      },
      fontFamily: 'Inter',
      fontSize: 'base',
      layoutStyle: 'standard',
      spacing: 'normal',
      borderRadius: 'md',
      isPreset: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should validate correct theme', () => {
      expect(validateTheme(validTheme)).toBe(true);
    });

    it('should reject theme without required fields', () => {
      const invalidTheme = { ...validTheme };
      delete (invalidTheme as any).name;
      expect(validateTheme(invalidTheme as Theme)).toBe(false);
    });

    it('should reject theme without colors', () => {
      const invalidTheme = { ...validTheme };
      delete (invalidTheme as any).colors;
      expect(validateTheme(invalidTheme as Theme)).toBe(false);
    });

    it('should reject null theme', () => {
      expect(validateTheme(null as any)).toBe(false);
    });
  });

  describe('mergeThemes', () => {
    const baseTheme: Theme = {
      id: '123',
      name: 'Base',
      slug: 'base',
      tenantId: 'tenant-1',
      isActive: true,
      colors: getDefaultColors(),
      fontFamily: 'Inter',
      fontSize: 'base',
      layoutStyle: 'standard',
      spacing: 'normal',
      borderRadius: 'md',
      isPreset: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should merge theme properties', () => {
      const merged = mergeThemes(baseTheme, {
        name: 'Merged',
        fontSize: 'lg',
      });

      expect(merged.name).toBe('Merged');
      expect(merged.fontSize).toBe('lg');
      expect(merged.fontFamily).toBe('Inter');
    });

    it('should merge colors separately', () => {
      const merged = mergeThemes(baseTheme, {
        colors: {
          primary: '#ff0000',
        } as any,
      });

      expect(merged.colors.primary).toBe('#ff0000');
      expect(merged.colors.secondary).toBe(baseTheme.colors.secondary);
    });
  });

  describe('getDefaultColors', () => {
    it('should return all required colors', () => {
      const colors = getDefaultColors();

      expect(colors.primary).toBeDefined();
      expect(colors.secondary).toBeDefined();
      expect(colors.accent).toBeDefined();
      expect(colors.background).toBeDefined();
      expect(colors.foreground).toBeDefined();
      expect(colors.success).toBeDefined();
      expect(colors.error).toBeDefined();
      expect(colors.warning).toBeDefined();
    });

    it('should return valid hex colors', () => {
      const colors = getDefaultColors();

      Object.values(colors).forEach((color) => {
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });
  });
});

describe('Font Utilities', () => {
  describe('extractFontFamilies', () => {
    it('should extract single font', () => {
      const fonts = extractFontFamilies('Inter');
      expect(fonts).toEqual(['Inter']);
    });

    it('should extract multiple fonts', () => {
      const fonts = extractFontFamilies('Inter, Roboto, Arial');
      expect(fonts).toEqual(['Inter', 'Roboto', 'Arial']);
    });

    it('should remove quotes', () => {
      const fonts = extractFontFamilies('"Roboto Mono", monospace');
      expect(fonts).toEqual(['Roboto Mono']);
    });

    it('should filter system fonts', () => {
      const fonts = extractFontFamilies('Inter, -apple-system, sans-serif');
      expect(fonts).toEqual(['Inter']);
    });
  });

  describe('formatGoogleFontUrl', () => {
    it('should format single font', () => {
      const url = formatGoogleFontUrl(['Inter']);
      expect(url).toContain('family=Inter');
      expect(url).toContain('wght@400;500;600;700');
    });

    it('should format multiple fonts', () => {
      const url = formatGoogleFontUrl(['Inter', 'Roboto']);
      expect(url).toContain('family=Inter');
      expect(url).toContain('family=Roboto');
    });

    it('should handle fonts with spaces', () => {
      const url = formatGoogleFontUrl(['Roboto Mono']);
      expect(url).toContain('family=Roboto+Mono');
    });
  });
});
