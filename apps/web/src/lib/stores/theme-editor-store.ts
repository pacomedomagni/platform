import { create } from 'zustand';
import type { Theme, ThemeColors, ThemeTypography, ThemeLayout, ThemeComponents } from '@/lib/theme/types';

interface ThemeEditorState {
  currentTheme: Theme | null;
  originalTheme: Theme | null;
  isDirty: boolean;
  isSaving: boolean;
  previewMode: 'desktop' | 'tablet' | 'mobile';

  // Actions
  setTheme: (theme: Theme) => void;
  updateColors: (colors: Partial<ThemeColors>) => void;
  updateTypography: (typography: Partial<ThemeTypography>) => void;
  updateLayout: (layout: Partial<ThemeLayout>) => void;
  updateComponents: (components: Partial<ThemeComponents>) => void;
  updateCustomCSS: (css: string) => void;
  setPreviewMode: (mode: 'desktop' | 'tablet' | 'mobile') => void;
  setSaving: (saving: boolean) => void;
  reset: () => void;
  hasChanges: () => boolean;
  discardChanges: () => void;
}

export const useThemeEditorStore = create<ThemeEditorState>((set, get) => ({
  currentTheme: null,
  originalTheme: null,
  isDirty: false,
  isSaving: false,
  previewMode: 'desktop',

  setTheme: (theme) => {
    set({
      currentTheme: theme,
      originalTheme: JSON.parse(JSON.stringify(theme)), // Deep clone
      isDirty: false,
    });
  },

  updateColors: (colors) => {
    set((state) => {
      if (!state.currentTheme) return state;

      return {
        currentTheme: {
          ...state.currentTheme,
          colors: {
            ...state.currentTheme.colors,
            ...colors,
          },
        },
        isDirty: true,
      };
    });
  },

  updateTypography: (typography) => {
    set((state) => {
      if (!state.currentTheme) return state;

      return {
        currentTheme: {
          ...state.currentTheme,
          typography: {
            ...state.currentTheme.typography,
            ...typography,
          },
        },
        isDirty: true,
      };
    });
  },

  updateLayout: (layout) => {
    set((state) => {
      if (!state.currentTheme) return state;

      return {
        currentTheme: {
          ...state.currentTheme,
          layout: {
            ...state.currentTheme.layout,
            ...layout,
          },
        },
        isDirty: true,
      };
    });
  },

  updateComponents: (components) => {
    set((state) => {
      if (!state.currentTheme) return state;

      return {
        currentTheme: {
          ...state.currentTheme,
          components: {
            ...state.currentTheme.components,
            ...components,
          },
        },
        isDirty: true,
      };
    });
  },

  updateCustomCSS: (css) => {
    set((state) => {
      if (!state.currentTheme) return state;

      return {
        currentTheme: {
          ...state.currentTheme,
          customCSS: css,
        },
        isDirty: true,
      };
    });
  },

  setPreviewMode: (mode) => {
    set({ previewMode: mode });
  },

  setSaving: (saving) => {
    set({ isSaving: saving });
  },

  reset: () => {
    set({
      currentTheme: null,
      originalTheme: null,
      isDirty: false,
      isSaving: false,
    });
  },

  hasChanges: () => {
    const { currentTheme, originalTheme } = get();
    if (!currentTheme || !originalTheme) return false;

    return JSON.stringify(currentTheme) !== JSON.stringify(originalTheme);
  },

  discardChanges: () => {
    const { originalTheme } = get();
    if (originalTheme) {
      set({
        currentTheme: JSON.parse(JSON.stringify(originalTheme)),
        isDirty: false,
      });
    }
  },
}));
