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
  showColorPicker: true,           // Show/hide the accent color picker in navbar
  showThemeToggle: true,           // Show/hide the dark/light theme toggle
  showLanguageSelector: true,      // Show/hide the language selector

  // Default language (en, de)
  defaultLanguage: null,           // null = use browser preference
                                   // or set 'en' or 'de' to force a language
};
