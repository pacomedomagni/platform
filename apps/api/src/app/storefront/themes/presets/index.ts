export { modernPreset } from './modern.preset';
export { minimalPreset } from './minimal.preset';
export { boldPreset } from './bold.preset';
export { classicPreset } from './classic.preset';

/**
 * All available theme presets
 */
export const THEME_PRESETS = {
  modern: require('./modern.preset').modernPreset,
  minimal: require('./minimal.preset').minimalPreset,
  bold: require('./bold.preset').boldPreset,
  classic: require('./classic.preset').classicPreset,
};

/**
 * Get all preset themes as an array
 */
export function getAllPresets() {
  return Object.values(THEME_PRESETS);
}

/**
 * Get a preset by slug
 */
export function getPresetBySlug(slug: string) {
  return THEME_PRESETS[slug as keyof typeof THEME_PRESETS];
}
