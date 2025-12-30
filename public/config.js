/**
 * BentoPDF Configuration
 * 
 * This file allows server-side customization of the PDF-Tools application.
 * 
 * For instant changes (no rebuild): Edit /opt/pdf-tools/dist/config.js
 * For persistent changes: Edit /opt/pdf-tools/public/config.js
 *     then copy to dist: cp /opt/pdf-tools/public/config.js /opt/pdf-tools/dist/config.js
 * 
 * IMPORTANT: After editing, clear your browser cache or use Ctrl+Shift+R
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

  // ===== SIMPLE MODE / MINIMAL VIEW =====
  // Set simpleMode to true for a minimal interface showing only
  // the search bar and tool grid (hides header, footer, hero, etc.)
  simpleMode: false,               // *** SIMPLE MODE TOGGLE ***
                                   // Set to true to hide: navigation header, footer,
                                   // hero section, tools header, features, security,
                                   // FAQ, testimonials, support sections
                                   // Creates a minimal view showing only the tool grid

  // UI feature toggles
  showColorPicker: true,           // Show/hide the accent color picker in navbar
  showThemeToggle: true,           // Show/hide the dark/light theme toggle
  showLanguageSelector: true,      // Show/hide the language selector

  // Default language (en, de, zh, vi)
  defaultLanguage: null,           // null = use browser preference
                                   // or set 'en', 'de', 'zh', 'vi' to force a language
};
