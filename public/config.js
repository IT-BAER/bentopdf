/**
 * BentoPDF Configuration
 * 
 * This file allows server-side customization of the PDF-Tools application.
 * 
 * For instant changes (no rebuild): Edit /opt/pdf-tools/dist/config.js
 * For persistent changes: Edit this file, then run `npm run build`
 */
window.PDFTOOLS_CONFIG = {
  // App branding
  appName: 'PDF-Tools',           // Application name shown in header and footer

  // Logo configuration
  logoUrl: null,                   // Custom logo URL (null = use default)
                                   // Example: '/images/company-logo.svg'
  faviconUrl: null,                // Custom favicon URL (null = use default)

  // Accent color configuration
  defaultAccentColor: '#6366f1',   // Default accent color (hex)
                                   // Used when user hasn't selected a color
  forceAccentColor: false,         // If true, locks accent color and hides the color picker

  // Feature toggles
  showHeader: true,                // Show/hide the entire navigation header
                                   // Set to false to completely hide the top navbar
  showHero: true,                  // Show/hide the hero section on main page
                                   // Set to false to hide hero, features, FAQ, testimonials
  showColorPicker: true,           // Show/hide the accent color picker in navbar
  showThemeToggle: true,           // Show/hide the dark/light theme toggle
  showLanguageSelector: true,      // Show/hide the language selector

  // Default language (en, de, zh, vi)
  defaultLanguage: null,           // null = use browser preference
                                   // or set 'en', 'de', 'zh', 'vi' to force a language
};
