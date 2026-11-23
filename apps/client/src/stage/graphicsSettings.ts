export type UnitOutlineLevel = 'off' | 'subtle' | 'standard' | 'strong';
export type GraphicsQualityPreset = 'performance' | 'balanced' | 'cinema';

export interface GraphicsSettings {
  readonly outlineLevel: UnitOutlineLevel;
  readonly qualityPreset: GraphicsQualityPreset;
  readonly bloomEnabled: boolean;
}

export const GRAPHICS_PREFS_STORAGE_KEY = 'sparkfield_graphics_prefs_v1';

export const DEFAULT_GRAPHICS_SETTINGS: GraphicsSettings = {
  outlineLevel: 'subtle',
  qualityPreset: 'cinema',
  bloomEnabled: true,
};

export const OUTLINE_LEVEL_STRENGTH: Readonly<Record<UnitOutlineLevel, number>> = {
  off: 0,
  subtle: 0.34,
  standard: 0.58,
  strong: 0.84,
};

export const QUALITY_MAX_PIXEL_RATIO: Readonly<Record<GraphicsQualityPreset, number>> = {
  performance: 1.0,
  balanced: 1.5,
  cinema: 2.0,
};

const VALID_OUTLINES = new Set<UnitOutlineLevel>(['off', 'subtle', 'standard', 'strong']);
const VALID_QUALITIES = new Set<GraphicsQualityPreset>(['performance', 'balanced', 'cinema']);

export function readStoredGraphicsSettings(): GraphicsSettings {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return DEFAULT_GRAPHICS_SETTINGS;
    }
    const raw = window.localStorage.getItem(GRAPHICS_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_GRAPHICS_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GraphicsSettings> | null;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_GRAPHICS_SETTINGS;
    const outlineLevel =
      typeof parsed.outlineLevel === 'string' && VALID_OUTLINES.has(parsed.outlineLevel as UnitOutlineLevel)
        ? (parsed.outlineLevel as UnitOutlineLevel)
        : DEFAULT_GRAPHICS_SETTINGS.outlineLevel;
    const qualityPreset =
      typeof parsed.qualityPreset === 'string' && VALID_QUALITIES.has(parsed.qualityPreset as GraphicsQualityPreset)
        ? (parsed.qualityPreset as GraphicsQualityPreset)
        : DEFAULT_GRAPHICS_SETTINGS.qualityPreset;
    const bloomEnabled =
      typeof parsed.bloomEnabled === 'boolean'
        ? parsed.bloomEnabled
        : DEFAULT_GRAPHICS_SETTINGS.bloomEnabled;
    return { outlineLevel, qualityPreset, bloomEnabled };
  } catch {
    return DEFAULT_GRAPHICS_SETTINGS;
  }
}

export function writeStoredGraphicsSettings(settings: GraphicsSettings): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(GRAPHICS_PREFS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
  }
}
