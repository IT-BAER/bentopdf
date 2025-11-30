export interface AccentColor {
  name: string;
  value: string;
  hover: string;
  ring: string;
  text: string;
  bgLight: string;
}

// Declare global config type
declare global {
  interface Window {
    PDFTOOLS_CONFIG?: {
      defaultAccentColor?: string;
    };
  }
}

export const accentColors: AccentColor[] = [
  { name: 'Indigo', value: '#6366f1', hover: '#4f46e5', ring: '#4338ca', text: '#a5b4fc', bgLight: 'rgba(99, 102, 241, 0.1)' },
  { name: 'Blue', value: '#3b82f6', hover: '#2563eb', ring: '#1d4ed8', text: '#93c5fd', bgLight: 'rgba(59, 130, 246, 0.1)' },
  { name: 'Cyan', value: '#06b6d4', hover: '#0891b2', ring: '#0e7490', text: '#67e8f9', bgLight: 'rgba(6, 182, 212, 0.1)' },
  { name: 'Teal', value: '#14b8a6', hover: '#0d9488', ring: '#0f766e', text: '#5eead4', bgLight: 'rgba(20, 184, 166, 0.1)' },
  { name: 'Green', value: '#22c55e', hover: '#16a34a', ring: '#15803d', text: '#86efac', bgLight: 'rgba(34, 197, 94, 0.1)' },
  { name: 'Lime', value: '#84cc16', hover: '#65a30d', ring: '#4d7c0f', text: '#bef264', bgLight: 'rgba(132, 204, 22, 0.1)' },
  { name: 'Yellow', value: '#eab308', hover: '#ca8a04', ring: '#a16207', text: '#fde047', bgLight: 'rgba(234, 179, 8, 0.1)' },
  { name: 'Orange', value: '#f97316', hover: '#ea580c', ring: '#c2410c', text: '#fdba74', bgLight: 'rgba(249, 115, 22, 0.1)' },
  { name: 'Red', value: '#ef4444', hover: '#dc2626', ring: '#b91c1c', text: '#fca5a5', bgLight: 'rgba(239, 68, 68, 0.1)' },
  { name: 'Pink', value: '#ec4899', hover: '#db2777', ring: '#be185d', text: '#f9a8d4', bgLight: 'rgba(236, 72, 153, 0.1)' },
  { name: 'Purple', value: '#a855f7', hover: '#9333ea', ring: '#7e22ce', text: '#d8b4fe', bgLight: 'rgba(168, 85, 247, 0.1)' },
  { name: 'Violet', value: '#8b5cf6', hover: '#7c3aed', ring: '#6d28d9', text: '#c4b5fd', bgLight: 'rgba(139, 92, 246, 0.1)' },
];

const ACCENT_STORAGE_KEY = 'pdftools-accent-color';

let currentAccent: AccentColor = accentColors[0];

/**
 * Get the default accent color from config or fallback
 */
function getDefaultAccent(): AccentColor {
  const configColor = window.PDFTOOLS_CONFIG?.defaultAccentColor;
  if (configColor) {
    // Check if it matches a preset
    const preset = accentColors.find(c => c.value.toLowerCase() === configColor.toLowerCase());
    if (preset) return preset;
    // Otherwise create from hex
    return createAccentFromHex(configColor);
  }
  return accentColors[0]; // Indigo
}

/**
 * Convert hex to HSL
 */
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to hex
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Lighten a hex color (preserves hue)
 */
function lightenColor(hex: string, percent: number): string {
  const { h, s, l } = hexToHSL(hex);
  const newL = Math.min(100, l + percent);
  return hslToHex(h, s, newL);
}

/**
 * Darken a hex color (preserves hue)
 */
function darkenColor(hex: string, percent: number): string {
  const { h, s, l } = hexToHSL(hex);
  const newL = Math.max(0, l - percent);
  return hslToHex(h, s, newL);
}

/**
 * Create accent color from a hex value
 */
export function createAccentFromHex(hex: string): AccentColor {
  const { h, s, l } = hexToHSL(hex);
  
  // For text color: use a lighter, slightly desaturated version
  const textL = Math.min(90, l + 25);
  const textS = Math.max(40, s - 10);
  
  return {
    name: 'Custom',
    value: hex,
    hover: darkenColor(hex, 8),
    ring: darkenColor(hex, 15),
    text: hslToHex(h, textS, textL),
    bgLight: `${hex}1a`,
  };
}

/**
 * Initialize the theme system
 */
export function initTheme(): void {
  // Initialize theme mode (dark/light) first
  initThemeMode();
  
  const defaultAccent = getDefaultAccent();
  const savedAccent = localStorage.getItem(ACCENT_STORAGE_KEY);
  
  if (savedAccent) {
    try {
      const parsed = JSON.parse(savedAccent);
      if (parsed.value) {
        currentAccent = parsed;
      } else {
        currentAccent = defaultAccent;
      }
    } catch {
      // Try as color name for backwards compatibility
      const found = accentColors.find(c => c.name === savedAccent);
      currentAccent = found || defaultAccent;
    }
  } else {
    currentAccent = defaultAccent;
  }
  
  applyAccentColor(currentAccent);
  updateColorPicker();
}

/**
 * Get the current accent color
 */
export function getAccentColor(): AccentColor {
  return currentAccent;
}

/**
 * Set the accent color (CSS only, no save)
 * Use this for live preview during color picker drag
 */
export function applyAccentColorOnly(color: AccentColor): void {
  currentAccent = color;
  applyAccentColor(color);
}

/**
 * Set and save the accent color
 * Use this when color selection is finalized
 */
export function setAccentColor(color: AccentColor): void {
  currentAccent = color;
  localStorage.setItem(ACCENT_STORAGE_KEY, JSON.stringify(color));
  applyAccentColor(color);
  updateColorPicker();
  window.dispatchEvent(new CustomEvent('accentchange', { detail: { color } }));
}

/**
 * Calculate relative luminance of a color (for contrast checking)
 */
function getLuminance(hex: string): number {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return 0;
  
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Determine if text should be dark or light based on background color
 */
function getContrastTextColor(bgHex: string): string {
  const luminance = getLuminance(bgHex);
  // Use dark text for bright backgrounds (luminance > 0.5)
  return luminance > 0.45 ? '#1f2937' : '#ffffff';
}

/**
 * Apply accent color to CSS custom properties (fast, no DOM queries)
 */
function applyAccentColor(color: AccentColor): void {
  const root = document.documentElement;
  root.style.setProperty('--accent-color', color.value);
  root.style.setProperty('--accent-hover', color.hover);
  root.style.setProperty('--accent-ring', color.ring);
  root.style.setProperty('--accent-text', color.text);
  root.style.setProperty('--accent-bg-light', color.bgLight);
  
  // Additional accent variations for UI components
  root.style.setProperty('--accent-bg-medium', `${color.value}26`); // 15% opacity
  root.style.setProperty('--accent-color-muted', `${color.value}4d`); // 30% opacity
  root.style.setProperty('--accent-color-soft', `${color.value}80`); // 50% opacity
  
  // Set button text color based on accent brightness
  const btnTextColor = getContrastTextColor(color.value);
  root.style.setProperty('--accent-btn-text', btnTextColor);
}

/**
 * Update the color picker UI to reflect current selection
 */
function updateColorPicker(): void {
  const picker = document.getElementById('accent-color-picker') as HTMLInputElement | null;
  if (picker) {
    picker.value = currentAccent.value;
  }
}

/**
 * Find closest accent color to a hex value
 */
export function findClosestAccent(hex: string): AccentColor {
  const normalized = hex.toLowerCase();
  const exact = accentColors.find(c => c.value.toLowerCase() === normalized);
  if (exact) return exact;
  return accentColors[0];
}

// Theme mode (dark/light)
export type ThemeMode = 'dark' | 'light' | 'system';
const THEME_MODE_KEY = 'pdftools-theme-mode';
let currentMode: ThemeMode = 'system';

/**
 * Get the effective theme (resolves 'system' to actual preference)
 */
function getEffectiveTheme(): 'dark' | 'light' {
  if (currentMode === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return currentMode;
}

/**
 * Apply the theme mode to the document
 */
function applyThemeMode(): void {
  const effective = getEffectiveTheme();
  document.documentElement.setAttribute('data-theme', effective);
  
  // Update theme toggle icon if present
  const icon = document.querySelector('#theme-toggle-btn i');
  if (icon) {
    icon.setAttribute('data-lucide', effective === 'light' ? 'sun' : 'moon');
    // Re-render lucide icons
    import('lucide').then(({ createIcons, icons }) => {
      createIcons({ icons });
    });
  }
}

/**
 * Initialize theme mode from localStorage or system preference
 */
export function initThemeMode(): void {
  const saved = localStorage.getItem(THEME_MODE_KEY) as ThemeMode | null;
  currentMode = saved || 'system';
  applyThemeMode();
  
  // Listen for system preference changes
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (currentMode === 'system') {
      applyThemeMode();
    }
  });
}

/**
 * Get the current theme mode
 */
export function getThemeMode(): ThemeMode {
  return currentMode;
}

/**
 * Set the theme mode
 */
export function setThemeMode(mode: ThemeMode): void {
  currentMode = mode;
  localStorage.setItem(THEME_MODE_KEY, mode);
  applyThemeMode();
  window.dispatchEvent(new CustomEvent('thememodechange', { detail: { mode } }));
}

/**
 * Toggle between dark and light mode (skips system)
 */
export function toggleThemeMode(): void {
  const effective = getEffectiveTheme();
  setThemeMode(effective === 'dark' ? 'light' : 'dark');
}
