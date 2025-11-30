/**
 * Shared page initialization for all subpages
 * Handles theme initialization, i18n, color picker, and language selector
 */

import { initTheme, createAccentFromHex, setAccentColor, getAccentColor, toggleThemeMode } from '../theme/index.js';
import { initI18n, setLanguage, getLanguage } from '../i18n/index.js';

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
  return luminance > 0.45 ? '#1f2937' : '#ffffff';
}

export function initPage(): void {
    // Initialize theme first (loads from localStorage or default)
    initTheme();
    
    // Initialize i18n
    initI18n();
    
    // Setup color picker functionality
    const colorPicker = document.getElementById('accent-color-picker') as HTMLInputElement | null;
    if (colorPicker) {
        colorPicker.value = getAccentColor().value;
        
        // Live preview while dragging (CSS only - fast)
        colorPicker.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            const accentColor = createAccentFromHex(target.value);
            // Apply CSS directly for fast preview
            document.documentElement.style.setProperty('--accent-color', accentColor.value);
            document.documentElement.style.setProperty('--accent-hover', accentColor.hover);
            document.documentElement.style.setProperty('--accent-ring', accentColor.ring);
            document.documentElement.style.setProperty('--accent-text', accentColor.text);
            document.documentElement.style.setProperty('--accent-bg-light', accentColor.bgLight);
            // Set button text color based on accent brightness
            const btnTextColor = getContrastTextColor(accentColor.value);
            document.documentElement.style.setProperty('--accent-btn-text', btnTextColor);
        });
        
        // Save on change (when picker closes)
        colorPicker.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            const accentColor = createAccentFromHex(target.value);
            setAccentColor(accentColor);
            // Ensure button text color is persisted
            document.documentElement.style.setProperty('--accent-btn-text', getContrastTextColor(accentColor.value));
        });
    }
    
    // Setup language selector functionality
    const langSelector = document.getElementById('language-selector') as HTMLSelectElement | null;
    if (langSelector) {
        langSelector.value = getLanguage();
        langSelector.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            setLanguage(target.value as 'en' | 'de');
        });
    }
    
    // Setup theme toggle button
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            toggleThemeMode();
        });
    }
}

// Auto-initialize when imported
initPage();
