export { modernPreset, modernColorPalette } from './modern.preset';
export { minimalPreset, minimalColorPalette } from './minimal.preset';
export { boldPreset, boldColorPalette } from './bold.preset';
export { classicPreset, classicColorPalette } from './classic.preset';

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
 * All available color palettes (light + dark)
 */
export const COLOR_PALETTES = {
  modern: require('./modern.preset').modernColorPalette,
  minimal: require('./minimal.preset').minimalColorPalette,
  bold: require('./bold.preset').boldColorPalette,
  classic: require('./classic.preset').classicColorPalette,
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

/**
 * Get color palette (light + dark) by preset slug
 */
export function getColorPaletteBySlug(slug: string) {
  return COLOR_PALETTES[slug as keyof typeof COLOR_PALETTES];
}
