/**
 * Theme API Client
 * API functions for theme management
 */

import type { Theme, CreateThemeDto, UpdateThemeDto, ThemePreset } from '../theme/types';

const BASE_URL = '/api/v1/store';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Build headers for API requests
 */
function buildHeaders(tenantId: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-tenant-id': tenantId,
  };
}

/**
 * Handle API response
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `API error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get active theme for tenant
 */
async function getActiveTheme(tenantId: string): Promise<Theme> {
  const response = await fetch(`${BASE_URL}/themes/active`, {
    headers: buildHeaders(tenantId),
  });

  return handleResponse<Theme>(response);
}

/**
 * Get all themes for tenant
 */
async function getThemes(tenantId: string): Promise<Theme[]> {
  const response = await fetch(`${BASE_URL}/themes`, {
    headers: buildHeaders(tenantId),
  });

  return handleResponse<Theme[]>(response);
}

/**
 * Get theme by ID
 */
async function getTheme(id: string, tenantId: string): Promise<Theme> {
  const response = await fetch(`${BASE_URL}/themes/${id}`, {
    headers: buildHeaders(tenantId),
  });

  return handleResponse<Theme>(response);
}

/**
 * Get available theme presets
 */
async function getPresets(): Promise<ThemePreset[]> {
  const response = await fetch(`${BASE_URL}/themes/presets`);

  return handleResponse<ThemePreset[]>(response);
}

/**
 * Get a specific preset by type
 */
async function getPreset(type: string): Promise<ThemePreset> {
  const response = await fetch(`${BASE_URL}/themes/presets/${type}`);

  return handleResponse<ThemePreset>(response);
}

/**
 * Create a new theme
 */
async function createTheme(tenantId: string, data: CreateThemeDto): Promise<Theme> {
  const response = await fetch(`${BASE_URL}/themes`, {
    method: 'POST',
    headers: buildHeaders(tenantId),
    body: JSON.stringify(data),
  });

  return handleResponse<Theme>(response);
}

/**
 * Create theme from preset
 */
async function createFromPreset(
  tenantId: string,
  presetType: string,
  name?: string
): Promise<Theme> {
  const response = await fetch(`${BASE_URL}/themes/from-preset/${presetType}`, {
    method: 'POST',
    headers: buildHeaders(tenantId),
    body: JSON.stringify({ name }),
  });

  return handleResponse<Theme>(response);
}

/**
 * Update theme
 */
async function updateTheme(
  id: string,
  tenantId: string,
  data: UpdateThemeDto
): Promise<Theme> {
  const response = await fetch(`${BASE_URL}/themes/${id}`, {
    method: 'PATCH',
    headers: buildHeaders(tenantId),
    body: JSON.stringify(data),
  });

  return handleResponse<Theme>(response);
}

/**
 * Delete theme
 */
async function deleteTheme(id: string, tenantId: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/themes/${id}`, {
    method: 'DELETE',
    headers: buildHeaders(tenantId),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Failed to delete theme');
  }
}

/**
 * Activate theme
 */
async function activateTheme(id: string, tenantId: string): Promise<Theme> {
  const response = await fetch(`${BASE_URL}/themes/${id}/activate`, {
    method: 'POST',
    headers: buildHeaders(tenantId),
  });

  return handleResponse<Theme>(response);
}

/**
 * Duplicate theme
 */
async function duplicateTheme(
  id: string,
  tenantId: string,
  newName: string
): Promise<Theme> {
  const response = await fetch(`${BASE_URL}/themes/${id}/duplicate`, {
    method: 'POST',
    headers: buildHeaders(tenantId),
    body: JSON.stringify({ name: newName }),
  });

  return handleResponse<Theme>(response);
}

/**
 * Reset theme to preset defaults
 */
async function resetToPreset(id: string, tenantId: string): Promise<Theme> {
  const response = await fetch(`${BASE_URL}/themes/${id}/reset`, {
    method: 'POST',
    headers: buildHeaders(tenantId),
  });

  return handleResponse<Theme>(response);
}

/**
 * Validate theme data
 */
async function validateTheme(tenantId: string, data: CreateThemeDto): Promise<{ valid: boolean; errors?: string[] }> {
  const response = await fetch(`${BASE_URL}/themes/validate`, {
    method: 'POST',
    headers: buildHeaders(tenantId),
    body: JSON.stringify(data),
  });

  return handleResponse<{ valid: boolean; errors?: string[] }>(response);
}

/**
 * Export theme as JSON
 */
async function exportTheme(id: string, tenantId: string): Promise<string> {
  const theme = await getTheme(id, tenantId);
  return JSON.stringify(theme, null, 2);
}

/**
 * Import theme from JSON
 */
async function importTheme(tenantId: string, themeJson: string): Promise<Theme> {
  try {
    const themeData = JSON.parse(themeJson);

    // Remove fields that shouldn't be imported
    const { id, tenantId: _, createdAt, updatedAt, isActive, ...importData } = themeData;

    return createTheme(tenantId, importData);
  } catch (error) {
    throw new Error('Invalid theme JSON');
  }
}

/**
 * Theme API client
 */
export const themesApi = {
  getActiveTheme,
  getThemes,
  getTheme,
  getPresets,
  getPreset,
  createTheme,
  createFromPreset,
  updateTheme,
  deleteTheme,
  activateTheme,
  duplicateTheme,
  resetToPreset,
  validateTheme,
  exportTheme,
  importTheme,
};

/**
 * Theme API hooks-ready functions (with error handling)
 */
export const themesApiSafe = {
  async getActiveTheme(tenantId: string): Promise<ApiResponse<Theme>> {
    try {
      const data = await themesApi.getActiveTheme(tenantId);
      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async getThemes(tenantId: string): Promise<ApiResponse<Theme[]>> {
    try {
      const data = await themesApi.getThemes(tenantId);
      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async createTheme(tenantId: string, data: CreateThemeDto): Promise<ApiResponse<Theme>> {
    try {
      const theme = await themesApi.createTheme(tenantId, data);
      return { data: theme };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async updateTheme(
    id: string,
    tenantId: string,
    data: UpdateThemeDto
  ): Promise<ApiResponse<Theme>> {
    try {
      const theme = await themesApi.updateTheme(id, tenantId, data);
      return { data: theme };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async deleteTheme(id: string, tenantId: string): Promise<ApiResponse<void>> {
    try {
      await themesApi.deleteTheme(id, tenantId);
      return { message: 'Theme deleted successfully' };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async activateTheme(id: string, tenantId: string): Promise<ApiResponse<Theme>> {
    try {
      const theme = await themesApi.activateTheme(id, tenantId);
      return { data: theme };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },
};

export default themesApi;
