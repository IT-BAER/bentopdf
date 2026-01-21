import {
  supportedLanguages,
  languageNames,
  getLanguageFromUrl,
  changeLanguage,
} from './i18n';
import { getConfig } from '../utils/config';
import { toggleThemeMode, getAccentColor, setAccentColor, createAccentFromHex, getThemeMode } from '../theme/index';
import { createIcons, icons } from 'lucide';

export const createLanguageSwitcher = (): HTMLElement => {
  const currentLang = getLanguageFromUrl();

  const container = document.createElement('div');
  container.className = 'relative';
  container.id = 'language-switcher';

  const button = document.createElement('button');
  button.className = `
    inline-flex items-center gap-1.5 text-sm font-medium
    bg-gray-800 text-gray-200 border border-gray-600
    px-3 py-1.5 rounded-full transition-colors duration-200
    shadow-sm hover:shadow-md hover:bg-gray-700
  `.trim();
  button.setAttribute('aria-haspopup', 'true');
  button.setAttribute('aria-expanded', 'false');

  const textSpan = document.createElement('span');
  textSpan.className = 'font-medium';
  textSpan.textContent = languageNames[currentLang];

  const chevron = document.createElement('svg');
  chevron.className = 'w-4 h-4';
  chevron.setAttribute('fill', 'none');
  chevron.setAttribute('stroke', 'currentColor');
  chevron.setAttribute('viewBox', '0 0 24 24');
  chevron.innerHTML =
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>';

  button.appendChild(textSpan);
  button.appendChild(chevron);

  const dropdown = document.createElement('div');
  dropdown.className = `
    hidden absolute right-0 mt-2 w-40 rounded-lg
    bg-gray-800 border border-gray-700 shadow-xl
    py-1 z-50
  `.trim();
  dropdown.setAttribute('role', 'menu');

  supportedLanguages.forEach((lang) => {
    const option = document.createElement('button');
    option.className = `
      w-full px-4 py-2 text-left text-sm text-gray-200
      hover:bg-gray-700 flex items-center gap-2
      ${lang === currentLang ? 'bg-gray-700' : ''}
    `.trim();
    option.setAttribute('role', 'menuitem');

    const name = document.createElement('span');
    name.textContent = languageNames[lang];

    option.appendChild(name);

    option.addEventListener('click', () => {
      if (lang !== currentLang) {
        changeLanguage(lang);
      }
    });

    dropdown.appendChild(option);
  });

  container.appendChild(button);
  container.appendChild(dropdown);

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', (!isExpanded).toString());
    dropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    button.setAttribute('aria-expanded', 'false');
    dropdown.classList.add('hidden');
  });

  return container;
};

export const injectLanguageSwitcher = (): void => {
  const simpleModeContainer = document.getElementById(
    'simple-mode-language-switcher'
  );
  if (simpleModeContainer) {
    const switcher = createLanguageSwitcher();
    simpleModeContainer.appendChild(switcher);
    return;
  }

  const footer = document.querySelector('footer');
  if (!footer) return;

  const headings = footer.querySelectorAll('h3');
  let followUsColumn: HTMLElement | null = null;

  headings.forEach((h3) => {
    if (
      h3.textContent?.trim() === 'Follow Us' ||
      h3.textContent?.trim() === 'Folgen Sie uns' ||
      h3.textContent?.trim() === 'Theo dõi chúng tôi'
    ) {
      followUsColumn = h3.parentElement;
    }
  });

  if (followUsColumn) {
    const socialIconsContainer = followUsColumn.querySelector('.space-x-4');

    if (socialIconsContainer) {
      const wrapper = document.createElement('div');
      wrapper.className = 'inline-flex flex-col gap-4'; // gap-4 adds space between icons and switcher

      socialIconsContainer.parentNode?.insertBefore(
        wrapper,
        socialIconsContainer
      );

      wrapper.appendChild(socialIconsContainer);
      const switcher = createLanguageSwitcher();

      switcher.className = 'relative w-full';

      const button = switcher.querySelector('button');
      if (button) {
        button.className = `
                    flex items-center justify-between w-full text-sm font-medium
                    bg-gray-800 text-gray-400 border border-gray-700
                    px-3 py-2 rounded-lg transition-colors duration-200
                    hover:text-white hover:border-gray-600
                `.trim();
      }

      const dropdown = switcher.querySelector('div[role="menu"]');
      if (dropdown) {
        dropdown.classList.remove('mt-2', 'w-40');
        dropdown.classList.add('bottom-full', 'mb-2', 'w-full');
      }

      wrapper.appendChild(switcher);
    } else {
      const switcherContainer = document.createElement('div');
      switcherContainer.className = 'mt-4 w-full';
      const switcher = createLanguageSwitcher();
      switcherContainer.appendChild(switcher);
      followUsColumn.appendChild(switcherContainer);
    }
  }
};

/**
 * Create a compact language selector dropdown for the navbar
 */
const createNavbarLanguageSelector = (): HTMLElement => {
    const currentLang = getLanguageFromUrl();
    
    const select = document.createElement('select');
    select.id = 'language-selector';
    select.className = 'bg-gray-700 text-white text-sm rounded-lg border border-gray-600 px-3 py-1.5 focus:ring-accent focus:border-accent cursor-pointer';
    
    supportedLanguages.forEach((lang) => {
        const option = document.createElement('option');
        option.value = lang;
        option.textContent = languageNames[lang];
        if (lang === currentLang) {
            option.selected = true;
        }
        select.appendChild(option);
    });
    
    select.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        changeLanguage(target.value as typeof supportedLanguages[number]);
    });
    
    return select;
};

/**
 * Inject navbar controls (theme toggle, accent color picker, language selector)
 * This recreates the controls that existed in the original fork
 */
export const injectNavbarControls = (): void => {
    const config = getConfig();
    
    // Find the navbar - try different selectors
    const nav = document.querySelector('nav.bg-gray-800') || document.querySelector('nav.navbar-glass') || document.querySelector('nav');
    if (!nav) return;
    
    // Find the desktop navigation area
    const desktopNav = nav.querySelector('.hidden.md\\:flex.items-center') || nav.querySelector('.md\\:flex.items-center');
    
    // Create controls container
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'flex items-center gap-3';
    controlsContainer.id = 'navbar-controls';
    
    // 1. Theme toggle button
    if (config.showThemeToggle) {
        const themeBtn = document.createElement('button');
        themeBtn.id = 'theme-toggle-btn';
        themeBtn.className = 'w-8 h-8 rounded-lg border border-gray-600 bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-300 hover:text-white transition-colors';
        themeBtn.title = 'Toggle Theme';
        
        const themeIcon = document.createElement('i');
        themeIcon.setAttribute('data-lucide', getThemeMode() === 'light' ? 'sun' : 'moon');
        themeIcon.className = 'w-4 h-4';
        themeBtn.appendChild(themeIcon);
        
        themeBtn.addEventListener('click', () => {
            toggleThemeMode();
            // Update icon
            const icon = themeBtn.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', getThemeMode() === 'light' ? 'sun' : 'moon');
                createIcons({ icons });
            }
        });
        
        controlsContainer.appendChild(themeBtn);
    }
    
    // 2. Accent color picker
    if (config.showColorPicker && !config.forceAccentColor) {
        const colorPicker = document.createElement('input');
        colorPicker.type = 'color';
        colorPicker.id = 'accent-color-picker';
        colorPicker.className = 'w-8 h-8 rounded-lg border border-gray-600 cursor-pointer bg-transparent';
        colorPicker.title = 'Accent Color';
        colorPicker.value = getAccentColor().value;
        
        colorPicker.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            const newColor = createAccentFromHex(target.value);
            setAccentColor(newColor);
        });
        
        controlsContainer.appendChild(colorPicker);
    }
    
    // 3. Language selector
    if (config.showLanguageSelector) {
        const langSelector = createNavbarLanguageSelector();
        controlsContainer.appendChild(langSelector);
    }
    
    // Insert controls into desktop nav
    if (desktopNav) {
        // Find github link and insert before it
        const githubLink = desktopNav.querySelector('a[href*="github.com"]');
        if (githubLink) {
            desktopNav.insertBefore(controlsContainer, githubLink);
        } else {
            desktopNav.appendChild(controlsContainer);
        }
    } else {
        // Fallback: find the container div and add at the end of the first row
        const container = nav.querySelector('.container.mx-auto .flex.justify-between');
        if (container) {
            // Create a wrapper that includes the existing content + our controls
            const existingRightSide = container.querySelector('.hidden.md\\:flex');
            if (existingRightSide) {
                existingRightSide.appendChild(controlsContainer);
            }
        }
    }
    
    // Also add controls to mobile menu
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu && (config.showThemeToggle || config.showColorPicker || config.showLanguageSelector)) {
        const mobileControls = document.createElement('div');
        mobileControls.className = 'flex items-center justify-center gap-3 py-3 border-t border-gray-700';
        
        if (config.showThemeToggle) {
            const mobileThemeBtn = document.createElement('button');
            mobileThemeBtn.className = 'w-10 h-10 rounded-lg border border-gray-600 bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-300 hover:text-white transition-colors';
            mobileThemeBtn.title = 'Toggle Theme';
            
            const mobileThemeIcon = document.createElement('i');
            mobileThemeIcon.setAttribute('data-lucide', getThemeMode() === 'light' ? 'sun' : 'moon');
            mobileThemeIcon.className = 'w-5 h-5';
            mobileThemeBtn.appendChild(mobileThemeIcon);
            
            mobileThemeBtn.addEventListener('click', () => {
                toggleThemeMode();
                const icon = mobileThemeBtn.querySelector('i');
                if (icon) {
                    icon.setAttribute('data-lucide', getThemeMode() === 'light' ? 'sun' : 'moon');
                    createIcons({ icons });
                }
            });
            
            mobileControls.appendChild(mobileThemeBtn);
        }
        
        if (config.showColorPicker && !config.forceAccentColor) {
            const mobileColorPicker = document.createElement('input');
            mobileColorPicker.type = 'color';
            mobileColorPicker.className = 'w-10 h-10 rounded-lg border border-gray-600 cursor-pointer bg-transparent';
            mobileColorPicker.title = 'Accent Color';
            mobileColorPicker.value = getAccentColor().value;
            
            mobileColorPicker.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement;
                const newColor = createAccentFromHex(target.value);
                setAccentColor(newColor);
                // Sync with desktop picker
                const desktopPicker = document.getElementById('accent-color-picker') as HTMLInputElement;
                if (desktopPicker) desktopPicker.value = target.value;
            });
            
            mobileControls.appendChild(mobileColorPicker);
        }
        
        if (config.showLanguageSelector) {
            const mobileLangSelector = createNavbarLanguageSelector();
            mobileLangSelector.className = 'bg-gray-700 text-white text-sm rounded-lg border border-gray-600 px-4 py-2 focus:ring-accent focus:border-accent cursor-pointer';
            mobileControls.appendChild(mobileLangSelector);
        }
        
        mobileMenu.appendChild(mobileControls);
    }
    
    // Re-render lucide icons
    createIcons({ icons });
};
