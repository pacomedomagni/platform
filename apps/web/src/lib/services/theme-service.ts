/**
 * Theme Service
 * High-level service wrapper for theme management
 */

import { themesApi } from '../api/themes';
import type { Theme, CreateThemeDto, UpdateThemeDto } from '../theme/types';

// Mock tenant ID for now - in production, this would come from auth context
const getCurrentTenantId = (): string => {
  // TODO: Get from auth context
  return 'tenant-1';
};

class ThemeService {
  /**
   * Get all themes for current tenant
   */
  async getAllThemes(): Promise<Theme[]> {
    const tenantId = getCurrentTenantId();
    return themesApi.getThemes(tenantId);
  }

  /**
   * Get active theme
   */
  async getActiveTheme(): Promise<Theme | null> {
    try {
      const tenantId = getCurrentTenantId();
      return await themesApi.getActiveTheme(tenantId);
    } catch (error) {
      console.error('No active theme found:', error);
      return null;
    }
  }

  /**
   * Get theme by ID
   */
  async getTheme(id: string): Promise<Theme> {
    const tenantId = getCurrentTenantId();
    return themesApi.getTheme(id, tenantId);
  }

  /**
   * Create new theme
   */
  async createTheme(data: Partial<CreateThemeDto>): Promise<Theme> {
    const tenantId = getCurrentTenantId();
    const createData: CreateThemeDto = {
      name: data.name || 'New Theme',
      description: data.description,
      colors: data.colors,
      typography: data.typography,
      layout: data.layout,
      components: data.components,
      productDisplay: data.productDisplay,
      customCSS: data.customCSS,
    };
    return themesApi.createTheme(tenantId, createData);
  }

  /**
   * Update theme
   */
  async updateTheme(id: string, data: Partial<Theme>): Promise<Theme> {
    const tenantId = getCurrentTenantId();
    return themesApi.updateTheme(id, tenantId, data);
  }

  /**
   * Delete theme
   */
  async deleteTheme(id: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    return themesApi.deleteTheme(id, tenantId);
  }

  /**
   * Activate theme
   */
  async activateTheme(id: string): Promise<Theme> {
    const tenantId = getCurrentTenantId();
    return themesApi.activateTheme(id, tenantId);
  }

  /**
   * Duplicate theme
   */
  async duplicateTheme(
    id: string,
    options?: { name?: string; description?: string }
  ): Promise<Theme> {
    const tenantId = getCurrentTenantId();
    const originalTheme = await this.getTheme(id);
    const newName = options?.name || `${originalTheme.name} (Copy)`;

    return themesApi.duplicateTheme(id, tenantId, newName);
  }

  /**
   * Get preset themes
   */
  async getPresets(): Promise<Theme[]> {
    const presets = await themesApi.getPresets();
    return presets as unknown as Theme[];
  }
}

export const themeService = new ThemeService();

/**
 * Generate CSS from theme object
 */
export function generateThemeCSS(theme: Theme): string {
  const { colors, typography, layout, components } = theme;

  const cssVariables = `
    :root {
      /* Colors */
      --primary: ${colors.primary};
      --secondary: ${colors.secondary};
      --accent: ${colors.accent};
      --background: ${colors.background};
      --foreground: ${colors.foreground};
      --muted: ${colors.muted};
      --card: ${colors.card};
      --border: ${colors.border};
      --destructive: ${colors.destructive};

      /* Typography */
      --font-body: ${typography.bodyFont}, sans-serif;
      --font-heading: ${typography.headingFont}, sans-serif;
      --font-size-base: ${typography.baseFontSize === 'sm' ? '14px' : typography.baseFontSize === 'lg' ? '18px' : '16px'};
      --font-weight-body: ${typography.bodyWeight};
      --font-weight-heading: ${typography.headingWeight};

      /* Layout */
      --container-max-width: ${layout.containerMaxWidth}px;
      --spacing: ${layout.spacing === 'compact' ? '0.5rem' : (layout.spacing as string) === 'spacious' ? '1.5rem' : '1rem'};

      /* Components */
      --button-radius: ${(components.buttonStyle as string) === 'pill' ? '9999px' : (components.buttonStyle as string) === 'square' ? '0px' : '0.375rem'};
      --card-radius: ${components.cardRadius}px;
    }
  `;

  const baseStyles = `
    body {
      font-family: var(--font-body);
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-body);
      background-color: var(--background);
      color: var(--foreground);
    }

    h1, h2, h3, h4, h5, h6 {
      font-family: var(--font-heading);
      font-weight: var(--font-weight-heading);
    }

    .container {
      max-width: var(--container-max-width);
      margin: 0 auto;
    }

    button {
      border-radius: var(--button-radius);
    }

    .card {
      border-radius: var(--card-radius);
      ${(components.cardStyle as string) === 'shadow' ? 'box-shadow: 0 1px 3px rgba(0,0,0,0.1);' : ''}
      ${(components.cardStyle as string) === 'border' ? 'border: 1px solid var(--border);' : ''}
    }
  `;

  return cssVariables + baseStyles + (theme.customCSS || '');
}
