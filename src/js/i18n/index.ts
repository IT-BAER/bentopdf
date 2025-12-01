import { en } from './en';
import { de } from './de';
import { getDefaultLanguage } from '../utils/config';

export type Language = 'en' | 'de';
export type TranslationKey = keyof typeof en;
export type Translations = typeof en;

const translations: Record<Language, Translations> = {
  en,
  de,
};

const LANGUAGE_STORAGE_KEY = 'pdftools-language';
const DEFAULT_LANGUAGE: Language = 'en';

let currentLanguage: Language = DEFAULT_LANGUAGE;

/**
 * Initialize the i18n system
 */
export function initI18n(): void {
  const configLanguage = getDefaultLanguage();
  const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
  
  // Priority: 1. Config forced language, 2. Saved preference, 3. Browser detection
  if (configLanguage && translations[configLanguage]) {
    currentLanguage = configLanguage;
  } else if (savedLanguage && translations[savedLanguage]) {
    currentLanguage = savedLanguage;
  } else {
    // Try to detect browser language
    const browserLang = navigator.language.split('-')[0] as Language;
    if (translations[browserLang]) {
      currentLanguage = browserLang;
    }
  }
  updateLanguageSelector();
  updatePageTranslations();
}

/**
 * Get the current language
 */
export function getLanguage(): Language {
  return currentLanguage;
}

/**
 * Set the current language
 */
export function setLanguage(lang: Language): void {
  if (translations[lang]) {
    currentLanguage = lang;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    updateLanguageSelector();
    updatePageTranslations();
    // Dispatch event for components that need to react to language changes
    window.dispatchEvent(new CustomEvent('languagechange', { detail: { language: lang } }));
  }
}

/**
 * Get a translation by key
 */
export function t(key: keyof Translations): string {
  return (translations[currentLanguage][key] as string) || (translations[DEFAULT_LANGUAGE][key] as string) || key;
}

/**
 * Get all translations for the current language
 */
export function getTranslations(): Translations {
  return translations[currentLanguage];
}

/**
 * Get category name translation
 */
export function getCategoryName(categoryName: string): string {
  const trans = translations[currentLanguage];
  return trans.categories[categoryName as keyof typeof trans.categories] || categoryName;
}

/**
 * Get tool translation
 */
export function getToolTranslation(toolName: string): { name: string; subtitle: string } {
  const trans = translations[currentLanguage];
  const tool = trans.tools[toolName as keyof typeof trans.tools];
  if (tool) {
    return tool;
  }
  return { name: toolName, subtitle: '' };
}

/**
 * Update the language selector UI
 */
function updateLanguageSelector(): void {
  const selector = document.getElementById('language-selector') as HTMLSelectElement | null;
  if (selector) {
    selector.value = currentLanguage;
  }
}

/**
 * Resolve a nested translation key like "addStamps.title" to its value
 */
function resolveNestedKey(obj: any, key: string): string | undefined {
  const parts = key.split('.');
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * Update all page translations - exported for use after dynamic content is rendered
 */
export function updatePageTranslations(): void {
  const trans = translations[currentLanguage];
  
  // Update page title
  document.title = trans.pageTitle;
  
  // Update data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      // Support nested keys like "addStamps.title"
      const value = resolveNestedKey(trans, key);
      if (value) {
        el.textContent = value;
      }
    }
  });
  
  // Update data-i18n-placeholder elements
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      const value = resolveNestedKey(trans, key);
      if (value) {
        (el as HTMLInputElement).placeholder = value;
      }
    }
  });
}

/**
 * Get available languages
 */
export function getAvailableLanguages(): { code: Language; name: string }[] {
  return [
    { code: 'en', name: 'English' },
    { code: 'de', name: 'Deutsch' },
  ];
}
