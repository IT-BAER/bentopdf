/**
 * Configuration utility module for BentoPDF
 *
 * Handles loading and applying server-side configuration options.
 */

// Extend the global Window interface with full config options
declare global {
  interface Window {
    PDFTOOLS_CONFIG?: {
      // App branding
      appName?: string;
      logoUrl?: string | null;
      faviconUrl?: string | null;

      // Accent color
      defaultAccentColor?: string;
      forceAccentColor?: boolean;

      // Feature toggles
      showHeader?: boolean;
      showHero?: boolean;
      showColorPicker?: boolean;
      showThemeToggle?: boolean;
      showLanguageSelector?: boolean;

      // Language
      defaultLanguage?: string | null;
    };
  }
}

export interface PDFToolsConfig {
  appName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  defaultAccentColor: string;
  forceAccentColor: boolean;
  showHeader: boolean;
  showHero: boolean;
  showColorPicker: boolean;
  showThemeToggle: boolean;
  showLanguageSelector: boolean;
  defaultLanguage: string | null;
}

const DEFAULT_CONFIG: PDFToolsConfig = {
  appName: 'BentoPDF',
  logoUrl: null,
  faviconUrl: null,
  defaultAccentColor: '#6366f1',
  forceAccentColor: false,
  showHeader: true,
  showHero: true,
  showColorPicker: true,
  showThemeToggle: true,
  showLanguageSelector: true,
  defaultLanguage: null,
};

/**
 * Get the merged configuration with defaults
 */
export function getConfig(): PDFToolsConfig {
  const windowConfig = window.PDFTOOLS_CONFIG || {};

  return {
    appName: windowConfig.appName ?? DEFAULT_CONFIG.appName,
    logoUrl: windowConfig.logoUrl ?? DEFAULT_CONFIG.logoUrl,
    faviconUrl: windowConfig.faviconUrl ?? DEFAULT_CONFIG.faviconUrl,
    defaultAccentColor: windowConfig.defaultAccentColor ?? DEFAULT_CONFIG.defaultAccentColor,
    forceAccentColor: windowConfig.forceAccentColor ?? DEFAULT_CONFIG.forceAccentColor,
    showHeader: windowConfig.showHeader ?? DEFAULT_CONFIG.showHeader,
    showHero: windowConfig.showHero ?? DEFAULT_CONFIG.showHero,
    showColorPicker: windowConfig.showColorPicker ?? DEFAULT_CONFIG.showColorPicker,
    showThemeToggle: windowConfig.showThemeToggle ?? DEFAULT_CONFIG.showThemeToggle,
    showLanguageSelector: windowConfig.showLanguageSelector ?? DEFAULT_CONFIG.showLanguageSelector,
    defaultLanguage: windowConfig.defaultLanguage ?? DEFAULT_CONFIG.defaultLanguage,
  };
}

/**
 * Apply branding configuration to the page
 * Should be called after DOM is ready
 */
export function applyBrandingConfig(): void {
  const config = getConfig();

  // Hide header completely if configured
  if (!config.showHeader) {
    hideHeader();
  }

  // Hide hero section if configured
  if (!config.showHero) {
    hideHeroSection();
  }

  // Apply app name to header and footer
  applyAppName(config.appName);

  // Apply custom logo if provided
  if (config.logoUrl) {
    applyLogo(config.logoUrl);
  }

  // Apply custom favicon if provided
  if (config.faviconUrl) {
    applyFavicon(config.faviconUrl);
  }

  // Hide/show color picker
  if (!config.showColorPicker || config.forceAccentColor) {
    hideElement('accent-color-picker');
  }

  // Hide/show theme toggle
  if (!config.showThemeToggle) {
    hideElement('theme-toggle-btn');
  }

  // Hide/show language selector
  if (!config.showLanguageSelector) {
    hideElement('language-selector');
  }
}

/**
 * Apply app name to all relevant elements
 */
function applyAppName(appName: string): void {
  // Update header logo text
  const headerLogoLinks = document.querySelectorAll('#home-logo a, .navbar-glass a[href="index.html"]');
  headerLogoLinks.forEach(link => {
    if (link.textContent?.trim() === 'BentoPDF' || link.textContent?.trim() === 'PDF-Tools') {
      link.textContent = appName;
    }
  });

  // Update header span (for pages without links)
  const headerSpans = document.querySelectorAll('#home-logo span');
  headerSpans.forEach(span => {
    const link = span.querySelector('a');
    if (link && (link.textContent?.trim() === 'BentoPDF' || link.textContent?.trim() === 'PDF-Tools')) {
      link.textContent = appName;
    } else if (!link && (span.textContent?.trim() === 'BentoPDF' || span.textContent?.trim() === 'PDF-Tools')) {
      span.textContent = appName;
    }
  });

  // Update footer brand name
  const footerBrand = document.querySelector('footer .text-white.font-bold');
  if (footerBrand && (footerBrand.textContent?.trim() === 'BentoPDF' || footerBrand.textContent?.trim() === 'PDF-Tools')) {
    footerBrand.textContent = appName;
  }

  // Update document title if it contains BentoPDF or PDF-Tools
  if (document.title.includes('BentoPDF')) {
    document.title = document.title.replace('BentoPDF', appName);
  } else if (document.title.includes('PDF-Tools')) {
    document.title = document.title.replace('PDF-Tools', appName);
  }
}

/**
 * Apply custom logo to header and footer
 */
function applyLogo(logoUrl: string): void {
  // Update header logo
  const headerLogo = document.querySelector('#home-logo img, .navbar-glass img[alt*="Logo"]') as HTMLImageElement | null;
  if (headerLogo) {
    headerLogo.src = logoUrl;
  }

  // Update footer logo
  const footerLogo = document.querySelector('footer img[alt*="Logo"]') as HTMLImageElement | null;
  if (footerLogo) {
    footerLogo.src = logoUrl;
  }
}

/**
 * Apply custom favicon
 */
function applyFavicon(faviconUrl: string): void {
  const existingFavicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;

  if (existingFavicon) {
    existingFavicon.href = faviconUrl;
  } else {
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.href = faviconUrl;
    document.head.appendChild(favicon);
  }
}

/**
 * Hide an element by ID
 */
function hideElement(id: string): void {
  const element = document.getElementById(id);
  if (element) {
    element.style.display = 'none';
  }
}

/**
 * Hide the navigation header completely
 */
function hideHeader(): void {
  // Hide all nav elements
  const allNavs = document.querySelectorAll('nav');
  allNavs.forEach(nav => {
    (nav as HTMLElement).style.display = 'none';
  });
  
  // Also hide donation ribbon if present
  const donationRibbon = document.getElementById('donation-ribbon');
  if (donationRibbon) {
    donationRibbon.style.display = 'none';
  }
}

/**
 * Hide the hero section on the main page
 */
function hideHeroSection(): void {
  // Hide hero section
  const heroSection = document.getElementById('hero-section');
  if (heroSection) {
    heroSection.style.display = 'none';
  }
  
  // Hide features section
  const featuresSection = document.getElementById('features-section');
  if (featuresSection) {
    featuresSection.style.display = 'none';
  }
  
  // Hide security compliance section
  const securitySection = document.getElementById('security-compliance-section');
  if (securitySection) {
    securitySection.style.display = 'none';
  }
  
  // Hide FAQ section
  const faqSection = document.getElementById('faq-accordion');
  if (faqSection) {
    faqSection.style.display = 'none';
  }
  
  // Hide testimonials section
  const testimonialsSection = document.getElementById('testimonials-section');
  if (testimonialsSection) {
    testimonialsSection.style.display = 'none';
  }
  
  // Hide support section
  const supportSection = document.getElementById('support-section');
  if (supportSection) {
    supportSection.style.display = 'none';
  }
  
  // Reduce top padding on app container
  const appContainer = document.getElementById('app');
  if (appContainer) {
    appContainer.style.paddingTop = '1rem';
  }
}

/**
 * Check if accent color should be forced (user cannot change it)
 */
export function isAccentColorForced(): boolean {
  return getConfig().forceAccentColor;
}

/**
 * Get the default accent color from config
 */
export function getDefaultAccentColor(): string {
  return getConfig().defaultAccentColor;
}

/**
 * Get the default language from config
 */
export function getDefaultLanguage(): string | null {
  return getConfig().defaultLanguage;
}
