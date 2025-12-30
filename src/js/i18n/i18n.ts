import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

// Supported languages
export const supportedLanguages = ['en', 'de', 'zh', 'vi'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const languageNames: Record<SupportedLanguage, string> = {
    en: 'English',
    de: 'Deutsch',
    zh: '中文',
    vi: 'Tiếng Việt',
};

export const getLanguageFromUrl = (): SupportedLanguage => {
    const path = window.location.pathname;
    const langMatch = path.match(/^\/(en|de|zh|vi)(?:\/|$)/);
    if (langMatch && supportedLanguages.includes(langMatch[1] as SupportedLanguage)) {
        return langMatch[1] as SupportedLanguage;
    }
    const storedLang = localStorage.getItem('i18nextLng');
    if (storedLang && supportedLanguages.includes(storedLang as SupportedLanguage)) {
        return storedLang as SupportedLanguage;
    }

    // Detect browser language on first visit
    const browserLang = navigator.language.split('-')[0] as SupportedLanguage;
    if (supportedLanguages.includes(browserLang)) {
        return browserLang;
    }

    return 'en';
};

/**
 * Redirect to browser language on first visit if not already on a language path
 */
export const redirectToBrowserLanguage = (): boolean => {
    const path = window.location.pathname;
    const hasLangInPath = path.match(/^\/(en|de|zh|vi)(?:\/|$)/);
    const hasStoredLang = localStorage.getItem('i18nextLng');
    
    // Only redirect if no language in URL and no stored preference (first visit)
    if (!hasLangInPath && !hasStoredLang) {
        const browserLang = navigator.language.split('-')[0] as SupportedLanguage;
        if (supportedLanguages.includes(browserLang) && browserLang !== 'en') {
            // Redirect to browser language
            const newPath = `/${browserLang}${path === '/' ? '' : path}`;
            localStorage.setItem('i18nextLng', browserLang);
            window.location.href = newPath + window.location.search + window.location.hash;
            return true;
        }
    }
    return false;
};

let initialized = false;

export const initI18n = async (): Promise<typeof i18next> => {
    if (initialized) return i18next;

    const currentLang = getLanguageFromUrl();

    await i18next
        .use(HttpBackend)
        .use(LanguageDetector)
        .init({
            lng: currentLang,
            fallbackLng: 'en',
            supportedLngs: supportedLanguages as unknown as string[],
            ns: ['common', 'tools'],
            defaultNS: 'common',
            backend: {
                loadPath: `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}locales/{{lng}}/{{ns}}.json`,
            },
            detection: {
                order: ['path', 'localStorage', 'navigator'],
                lookupFromPathIndex: 0,
                caches: ['localStorage'],
            },
            interpolation: {
                escapeValue: false,
            },
        });

    initialized = true;
    return i18next;
};

export const t = (key: string, options?: Record<string, unknown>): string => {
    return i18next.t(key, options);
};

export const changeLanguage = (lang: SupportedLanguage): void => {
    if (!supportedLanguages.includes(lang)) return;

    const currentPath = window.location.pathname;
    const currentLang = getLanguageFromUrl();

    let newPath: string;
    if (currentPath.match(/^\/(en|de|zh|vi)\//)) {
        newPath = currentPath.replace(/^\/(en|de|zh|vi)\//, `/${lang}/`);
    } else if (currentPath.match(/^\/(en|de|zh|vi)$/)) {
        newPath = `/${lang}`;
    } else {
        newPath = `/${lang}${currentPath}`;
    }

    const newUrl = newPath + window.location.search + window.location.hash;
    window.location.href = newUrl;
};

// Apply translations to all elements with data-i18n attribute
export const applyTranslations = (): void => {
    document.querySelectorAll('[data-i18n]').forEach((element) => {
        const key = element.getAttribute('data-i18n');
        if (key) {
            const translation = t(key);
            if (translation && translation !== key) {
                element.textContent = translation;
            }
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (key && element instanceof HTMLInputElement) {
            const translation = t(key);
            if (translation && translation !== key) {
                element.placeholder = translation;
            }
        }
    });

    document.querySelectorAll('[data-i18n-title]').forEach((element) => {
        const key = element.getAttribute('data-i18n-title');
        if (key) {
            const translation = t(key);
            if (translation && translation !== key) {
                (element as HTMLElement).title = translation;
            }
        }
    });

    document.documentElement.lang = i18next.language;
};

export const rewriteLinks = (): void => {
    const currentLang = getLanguageFromUrl();
    if (currentLang === 'en') return;

    const links = document.querySelectorAll('a[href]');
    links.forEach((link) => {
        const href = link.getAttribute('href');
        if (!href) return;

        if (href.startsWith('http') ||
            href.startsWith('mailto:') ||
            href.startsWith('tel:') ||
            href.startsWith('#') ||
            href.startsWith('javascript:')) {
            return;
        }

        if (href.match(/^\/(en|de|zh|vi)\//)) {
            return;
        }
        let newHref: string;
        if (href.startsWith('/')) {
            newHref = `/${currentLang}${href}`;
        } else if (href.startsWith('./')) {
            newHref = href.replace('./', `/${currentLang}/`);
        } else if (href === '/' || href === '') {
            newHref = `/${currentLang}/`;
        } else {
            newHref = `/${currentLang}/${href}`;
        }

        link.setAttribute('href', newHref);
    });
};

export default i18next;
