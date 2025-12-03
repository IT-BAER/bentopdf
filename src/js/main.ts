import { categories } from './config/tools.js';
import { dom, switchView, hideAlert, showLoader, hideLoader, showAlert } from './ui.js';
import { setupToolInterface } from './handlers/toolSelectionHandler.js';
import { state, resetState } from './state.js';
import { ShortcutsManager } from './logic/shortcuts.js';
import { createIcons, icons } from 'lucide';
import * as pdfjsLib from 'pdfjs-dist';
import '../css/styles.css';
import { formatShortcutDisplay } from './utils/helpers.js';
import { APP_VERSION, injectVersion } from '../version.js';
import { initI18n, setLanguage, getCategoryName, getToolTranslation, getTranslations, type Language } from './i18n/index.js';
import { initTheme, accentColors, setAccentColor, getAccentColor, findClosestAccent, createAccentFromHex, applyAccentColorOnly, toggleThemeMode } from './theme/index.js';
import { applyBrandingConfig, getConfig } from './utils/config.js';

/**
 * Render the tool grid with translated category names and tool names
 */
const renderToolGrid = () => {
  dom.toolGrid.textContent = '';
  const currentAccent = getAccentColor();

  categories.forEach((category) => {
    const categoryGroup = document.createElement('div');
    categoryGroup.className = 'category-group col-span-full';

    const title = document.createElement('h2');
    title.className = 'text-xl font-bold mb-4 mt-8 first:mt-0 text-white';
    title.style.color = currentAccent.value;
    title.textContent = getCategoryName(category.name);

    const toolsContainer = document.createElement('div');
    toolsContainer.className =
      'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6';

    category.tools.forEach((tool) => {
      let toolCard: HTMLDivElement | HTMLAnchorElement;

      if (tool.href) {
        toolCard = document.createElement('a');
        toolCard.href = tool.href;
        toolCard.className =
          'tool-card block bg-gray-800 rounded-xl p-4 cursor-pointer flex flex-col items-center justify-center text-center no-underline hover:shadow-lg transition duration-200';
      } else {
        toolCard = document.createElement('div');
        toolCard.className =
          'tool-card bg-gray-800 rounded-xl p-4 cursor-pointer flex flex-col items-center justify-center text-center hover:shadow-lg transition duration-200';
        toolCard.dataset.toolId = tool.id;
      }

      const icon = document.createElement('i');
      icon.className = 'w-10 h-10 mb-3';
      icon.style.color = currentAccent.value;
      icon.setAttribute('data-lucide', tool.icon);

      // Get translated tool name and subtitle
      const translation = getToolTranslation(tool.name);

      const toolName = document.createElement('h3');
      toolName.className = 'font-semibold text-white';
      toolName.textContent = translation.name;

      toolCard.append(icon, toolName);

      if (tool.subtitle) {
        const toolSubtitle = document.createElement('p');
        toolSubtitle.className = 'text-xs text-gray-400 mt-1 px-2';
        toolSubtitle.textContent = translation.subtitle || tool.subtitle;
        toolCard.appendChild(toolSubtitle);
      }

      toolsContainer.appendChild(toolCard);
    });

    categoryGroup.append(title, toolsContainer);
    dom.toolGrid.appendChild(categoryGroup);
  });

  // Re-initialize Lucide icons for newly created elements
  createIcons({ icons });
};

const init = () => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

  // Initialize theme (accent colors)
  initTheme();

  // Initialize i18n
  initI18n();

  // Apply branding configuration (app name, logo, feature toggles)
  applyBrandingConfig();

  // Setup color picker with debounced re-render for performance
  const config = getConfig();
  const colorPicker = document.getElementById('accent-color-picker') as HTMLInputElement | null;
  if (colorPicker && !config.forceAccentColor) {
    colorPicker.value = getAccentColor().value;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    
    // Live preview on input (CSS only, fast)
    colorPicker.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const customAccent = createAccentFromHex(target.value);
      applyAccentColorOnly(customAccent);
    });
    
    // Save and re-render on change (when picker closes or stops)
    colorPicker.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const customAccent = createAccentFromHex(target.value);
      setAccentColor(customAccent);
      renderToolGrid();
    });
  }

  // Setup language selector
  const languageSelector = document.getElementById('language-selector') as HTMLSelectElement | null;
  if (languageSelector) {
    languageSelector.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      setLanguage(target.value as Language);
      renderToolGrid();
    });
  }

  // Setup theme toggle button
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      toggleThemeMode();
    });
  }

  // Hide shortcuts button on touch devices
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouchDevice) {
    const shortcutsBtn = document.getElementById('open-shortcuts-btn');
    if (shortcutsBtn) {
      shortcutsBtn.style.display = 'none';
    }
  }

  renderToolGrid();

  const searchBar = document.getElementById('search-bar');

  searchBar?.addEventListener('input', () => {
    const categoryGroups = dom.toolGrid.querySelectorAll('.category-group');
    // @ts-expect-error TS(2339) FIXME: Property 'value' does not exist on type 'HTMLEleme... Remove this comment to see the full error message
    const searchTerm = searchBar.value.toLowerCase().trim();

    categoryGroups.forEach((group) => {
      const toolCards = group.querySelectorAll('.tool-card');
      let visibleToolsInCategory = 0;

      toolCards.forEach((card) => {
        const toolName = card.querySelector('h3').textContent.toLowerCase();
        const toolSubtitle =
          card.querySelector('p')?.textContent.toLowerCase() || '';
        const isMatch =
          toolName.includes(searchTerm) || toolSubtitle.includes(searchTerm);

        card.classList.toggle('hidden', !isMatch);
        if (isMatch) {
          visibleToolsInCategory++;
        }
      });

      group.classList.toggle('hidden', visibleToolsInCategory === 0);
    });
  });

  window.addEventListener('keydown', function (e) {
    const key = e.key.toLowerCase();
    const isMac = navigator.userAgent.toUpperCase().includes('MAC');
    const isCtrlK = e.ctrlKey && key === 'k';
    const isCmdK = isMac && e.metaKey && key === 'k';

    if (isCtrlK || isCmdK) {
      e.preventDefault();
      searchBar?.focus();
    }
  });

  const shortcutK = document.getElementById('shortcut');
  const isIosOrAndroid = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isIosOrAndroid && shortcutK) {
    shortcutK.style.display = 'none';
  } else if (shortcutK) {
    shortcutK.textContent = navigator.userAgent.toUpperCase().includes('MAC')
      ? '⌘ + K'
      : 'Ctrl + K';
  }

  dom.toolGrid?.addEventListener('click', (e) => {
    // @ts-expect-error TS(2339) FIXME: Property 'closest' does not exist on type 'EventTa... Remove this comment to see the full error message
    const card = e.target.closest('.tool-card');
    if (card) {
      const toolId = card.dataset.toolId;
      setupToolInterface(toolId);
    }
  });
  dom.backToGridBtn?.addEventListener('click', () => switchView('grid'));
  dom.alertOkBtn?.addEventListener('click', hideAlert);

  if (window.location.hash.startsWith('#tool-')) {
    const toolId = window.location.hash.substring(6);
    setTimeout(() => {
      setupToolInterface(toolId);
      history.replaceState(null, '', window.location.pathname);
    }, 100);
  }

  createIcons({ icons });
  console.log('Please share our tool and share the love!');

  // Initialize Shortcuts System
  ShortcutsManager.init();

  // Tab switching for settings modal
  const shortcutsTabBtn = document.getElementById('shortcuts-tab-btn');
  const preferencesTabBtn = document.getElementById('preferences-tab-btn');
  const shortcutsTabContent = document.getElementById('shortcuts-tab-content');
  const preferencesTabContent = document.getElementById('preferences-tab-content');
  const shortcutsTabFooter = document.getElementById('shortcuts-tab-footer');
  const preferencesTabFooter = document.getElementById('preferences-tab-footer');
  const resetShortcutsBtn = document.getElementById('reset-shortcuts-btn');

  if (shortcutsTabBtn && preferencesTabBtn) {
    shortcutsTabBtn.addEventListener('click', () => {
      shortcutsTabBtn.classList.add('bg-orange-600', 'text-white');
      shortcutsTabBtn.classList.remove('text-gray-300');
      preferencesTabBtn.classList.remove('bg-orange-600', 'text-white');
      preferencesTabBtn.classList.add('text-gray-300');
      shortcutsTabContent?.classList.remove('hidden');
      preferencesTabContent?.classList.add('hidden');
      shortcutsTabFooter?.classList.remove('hidden');
      preferencesTabFooter?.classList.add('hidden');
      resetShortcutsBtn?.classList.remove('hidden');
    });

    preferencesTabBtn.addEventListener('click', () => {
      preferencesTabBtn.classList.add('bg-orange-600', 'text-white');
      preferencesTabBtn.classList.remove('text-gray-300');
      shortcutsTabBtn.classList.remove('bg-orange-600', 'text-white');
      shortcutsTabBtn.classList.add('text-gray-300');
      preferencesTabContent?.classList.remove('hidden');
      shortcutsTabContent?.classList.add('hidden');
      preferencesTabFooter?.classList.remove('hidden');
      shortcutsTabFooter?.classList.add('hidden');
      resetShortcutsBtn?.classList.add('hidden');
    });
  }

  // Full-width toggle functionality
  const fullWidthToggle = document.getElementById('full-width-toggle') as HTMLInputElement;
  const toolInterface = document.getElementById('tool-interface');

  // Load saved preference
  const savedFullWidth = localStorage.getItem('fullWidthMode') === 'true';
  if (fullWidthToggle) {
    fullWidthToggle.checked = savedFullWidth;
    applyFullWidthMode(savedFullWidth);
  }

  function applyFullWidthMode(enabled: boolean) {
    if (toolInterface) {
      if (enabled) {
        toolInterface.classList.remove('max-w-4xl');
      } else {
        toolInterface.classList.add('max-w-4xl');
      }
    }

    // Apply to all page uploaders
    const pageUploaders = document.querySelectorAll('#tool-uploader');
    pageUploaders.forEach((uploader) => {
      if (enabled) {
        uploader.classList.remove('max-w-2xl', 'max-w-5xl');
      } else {
        // Restore original max-width (most are max-w-2xl, add-stamps is max-w-5xl)
        if (!uploader.classList.contains('max-w-2xl') && !uploader.classList.contains('max-w-5xl')) {
          uploader.classList.add('max-w-2xl');
        }
      }
    });
  }

  if (fullWidthToggle) {
    fullWidthToggle.addEventListener('change', (e) => {
      const enabled = (e.target as HTMLInputElement).checked;
      localStorage.setItem('fullWidthMode', enabled.toString());
      applyFullWidthMode(enabled);
    });
  }

  // Shortcuts UI Handlers
  if (dom.openShortcutsBtn) {
    dom.openShortcutsBtn.addEventListener('click', () => {
      renderShortcutsList();
      dom.shortcutsModal?.classList.remove('hidden');
    });
  }

  if (dom.closeShortcutsModalBtn) {
    dom.closeShortcutsModalBtn.addEventListener('click', () => {
      dom.shortcutsModal?.classList.add('hidden');
    });
  }

  // Close modal on outside click
  if (dom.shortcutsModal) {
    dom.shortcutsModal.addEventListener('click', (e) => {
      if (e.target === dom.shortcutsModal) {
        dom.shortcutsModal.classList.add('hidden');
      }
    });
  }

  if (dom.resetShortcutsBtn) {
    dom.resetShortcutsBtn.addEventListener('click', async () => {
      const trans = getTranslations();
      const confirmed = await showWarningModal(
        trans.shortcutsModal.resetShortcuts,
        trans.shortcutsModal.resetConfirm,
        true
      );

      if (confirmed) {
        ShortcutsManager.reset();
        renderShortcutsList();
      }
    });
  }

  if (dom.exportShortcutsBtn) {
    dom.exportShortcutsBtn.addEventListener('click', () => {
      ShortcutsManager.exportSettings();
    });
  }

  if (dom.importShortcutsBtn) {
    dom.importShortcutsBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const trans = getTranslations();
            const content = e.target?.result as string;
            if (ShortcutsManager.importSettings(content)) {
              renderShortcutsList();
              await showWarningModal(
                trans.shortcutsModal.importSuccessful,
                trans.shortcutsModal.importSuccessfulMsg,
                false
              );
            } else {
              await showWarningModal(
                trans.shortcutsModal.importFailed,
                trans.shortcutsModal.importFailedMsg,
                false
              );
            }
          };
          reader.readAsText(file);
        }
      };
      input.click();
    });
  }

  if (dom.shortcutSearch) {
    dom.shortcutSearch.addEventListener('input', (e) => {
      const term = (e.target as HTMLInputElement).value.toLowerCase();
      const sections = dom.shortcutsList.querySelectorAll('.category-section');

      sections.forEach((section) => {
        const items = section.querySelectorAll('.shortcut-item');
        let visibleCount = 0;

        items.forEach((item) => {
          const text = item.textContent?.toLowerCase() || '';
          if (text.includes(term)) {
            item.classList.remove('hidden');
            visibleCount++;
          } else {
            item.classList.add('hidden');
          }
        });

        if (visibleCount === 0) {
          section.classList.add('hidden');
        } else {
          section.classList.remove('hidden');
        }
      });
    });
  }

  // Reserved shortcuts that commonly conflict with browser/OS functions
  const RESERVED_SHORTCUTS: Record<string, { mac?: string; windows?: string }> = {
    'mod+w': { mac: 'Closes tab', windows: 'Closes tab' },
    'mod+t': { mac: 'Opens new tab', windows: 'Opens new tab' },
    'mod+n': { mac: 'Opens new window', windows: 'Opens new window' },
    'mod+shift+n': { mac: 'Opens incognito window', windows: 'Opens incognito window' },
    'mod+q': { mac: 'Quits application (cannot be overridden)' },
    'mod+m': { mac: 'Minimizes window' },
    'mod+h': { mac: 'Hides window' },
    'mod+r': { mac: 'Reloads page', windows: 'Reloads page' },
    'mod+shift+r': { mac: 'Hard reloads page', windows: 'Hard reloads page' },
    'mod+l': { mac: 'Focuses address bar', windows: 'Focuses address bar' },
    'mod+d': { mac: 'Bookmarks page', windows: 'Bookmarks page' },
    'mod+shift+t': { mac: 'Reopens closed tab', windows: 'Reopens closed tab' },
    'mod+shift+w': { mac: 'Closes window', windows: 'Closes window' },
    'mod+tab': { mac: 'Switches tabs', windows: 'Switches apps' },
    'alt+f4': { windows: 'Closes window' },
    'ctrl+tab': { mac: 'Switches tabs', windows: 'Switches tabs' },
  };

  function getReservedShortcutWarning(combo: string, isMac: boolean): string | null {
    const reserved = RESERVED_SHORTCUTS[combo];
    if (!reserved) return null;

    const description = isMac ? reserved.mac : reserved.windows;
    if (!description) return null;

    return description;
  }

  function showWarningModal(title: string, message: string, confirmMode: boolean = true): Promise<boolean> {
    return new Promise((resolve) => {
      if (!dom.warningModal || !dom.warningTitle || !dom.warningMessage || !dom.warningCancelBtn || !dom.warningConfirmBtn) {
        resolve(confirmMode ? confirm(message) : (alert(message), true));
        return;
      }

      dom.warningTitle.textContent = title;
      dom.warningMessage.innerHTML = message;
      dom.warningModal.classList.remove('hidden');
      dom.warningModal.classList.add('flex');

      if (confirmMode) {
        dom.warningCancelBtn.style.display = '';
        dom.warningConfirmBtn.textContent = 'Proceed';
      } else {
        dom.warningCancelBtn.style.display = 'none';
        dom.warningConfirmBtn.textContent = 'OK';
      }

      const handleConfirm = () => {
        cleanup();
        resolve(true);
      };

      const handleCancel = () => {
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        dom.warningModal?.classList.add('hidden');
        dom.warningModal?.classList.remove('flex');
        dom.warningConfirmBtn?.removeEventListener('click', handleConfirm);
        dom.warningCancelBtn?.removeEventListener('click', handleCancel);
      };

      dom.warningConfirmBtn.addEventListener('click', handleConfirm);
      dom.warningCancelBtn.addEventListener('click', handleCancel);

      // Close on backdrop click
      dom.warningModal.addEventListener('click', (e) => {
        if (e.target === dom.warningModal) {
          if (confirmMode) {
            handleCancel();
          } else {
            handleConfirm();
          }
        }
      }, { once: true });
    });
  }

  function getToolId(tool: any): string {
    if (tool.id) return tool.id;
    if (tool.href) {
      const match = tool.href.match(/\/([^/]+)\.html$/);
      return match ? match[1] : tool.href;
    }
    return 'unknown';
  }

  function renderShortcutsList() {
    if (!dom.shortcutsList) return;
    dom.shortcutsList.innerHTML = '';

    const allShortcuts = ShortcutsManager.getAllShortcuts();
    const isMac = navigator.userAgent.toUpperCase().includes('MAC');
    const allTools = categories.flatMap(c => c.tools);

    categories.forEach(category => {
      const section = document.createElement('div');
      section.className = 'category-section mb-6 last:mb-0';

      const header = document.createElement('h3');
      header.className = 'text-gray-400 text-xs font-bold uppercase tracking-wider mb-3 pl-1';
      header.textContent = getCategoryName(category.name);
      section.appendChild(header);

      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'space-y-2';
      section.appendChild(itemsContainer);

      let hasTools = false;

      category.tools.forEach(tool => {
        hasTools = true;
        const toolId = getToolId(tool);
        const currentShortcut = allShortcuts.get(toolId) || '';

        const item = document.createElement('div');
        item.className = 'shortcut-item flex items-center justify-between p-3 bg-gray-900 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors';

        const left = document.createElement('div');
        left.className = 'flex items-center gap-3';

        const icon = document.createElement('i');
        icon.className = 'w-5 h-5 text-accent';
        icon.setAttribute('data-lucide', tool.icon);

        // Use translated tool name
        const toolTranslation = getToolTranslation(tool.name);
        const name = document.createElement('span');
        name.className = 'text-gray-200 font-medium';
        name.textContent = toolTranslation.name;

        left.append(icon, name);

        const right = document.createElement('div');
        right.className = 'relative';

        const trans = getTranslations();
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'shortcut-input w-32 bg-gray-800 border border-gray-600 text-white text-center text-sm rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all';
        input.placeholder = trans.shortcutsModal.clickToSet;
        input.value = formatShortcutDisplay(currentShortcut, isMac);
        input.readOnly = true;

        const clearBtn = document.createElement('button');
        clearBtn.className = 'absolute -right-2 -top-2 bg-gray-700 hover:bg-red-600 text-white rounded-full p-0.5 hidden group-hover:block shadow-sm';
        clearBtn.innerHTML = '<i data-lucide="x" class="w-3 h-3"></i>';
        if (currentShortcut) {
          right.classList.add('group');
        }

        clearBtn.onclick = (e) => {
          e.stopPropagation();
          ShortcutsManager.setShortcut(toolId, '');
          renderShortcutsList();
        };

        input.onkeydown = async (e) => {
          e.preventDefault();
          e.stopPropagation();

          if (e.key === 'Backspace' || e.key === 'Delete') {
            ShortcutsManager.setShortcut(toolId, '');
            renderShortcutsList();
            return;
          }

          const keys: string[] = [];
          // On Mac: metaKey = Command, ctrlKey = Control
          // On Windows/Linux: metaKey is rare, ctrlKey = Ctrl
          if (isMac) {
            if (e.metaKey) keys.push('mod'); // Command on Mac
            if (e.ctrlKey) keys.push('ctrl'); // Control on Mac (separate from Command)
          } else {
            if (e.ctrlKey || e.metaKey) keys.push('mod'); // Ctrl on Windows/Linux
          }
          if (e.altKey) keys.push('alt');
          if (e.shiftKey) keys.push('shift');

          let key = e.key.toLowerCase();

          if (e.altKey && e.code) {
            if (e.code.startsWith('Key')) {
              key = e.code.slice(3).toLowerCase();
            } else if (e.code.startsWith('Digit')) {
              key = e.code.slice(5);
            }
          }

          const isModifier = ['control', 'shift', 'alt', 'meta'].includes(key);
          const isDeadKey = key === 'dead' || key.startsWith('dead');

          // Ignore dead keys (used for accented characters on Mac with Option key)
          if (isDeadKey) {
            input.value = formatShortcutDisplay(ShortcutsManager.getShortcut(toolId) || '', isMac);
            return;
          }

          if (!isModifier) {
            keys.push(key);
          }

          const combo = keys.join('+');

          input.value = formatShortcutDisplay(combo, isMac);

          if (!isModifier) {
            const existingToolId = ShortcutsManager.findToolByShortcut(combo);
            const trans = getTranslations();

            if (existingToolId && existingToolId !== toolId) {
              const existingTool = allTools.find(t => getToolId(t) === existingToolId);
              // Use translated tool name
              const existingToolTranslation = existingTool ? getToolTranslation(existingTool.name) : null;
              const existingToolName = existingToolTranslation?.name || existingToolId;
              const displayCombo = formatShortcutDisplay(combo, isMac);

              await showWarningModal(
                trans.shortcutsModal.shortcutInUse,
                `<strong>${displayCombo}</strong> ${trans.shortcutsModal.shortcutInUseMsg}<br><br>` +
                `<em>"${existingToolName}"</em><br><br>` +
                `${trans.shortcutsModal.chooseDifferent}`,
                false
              );

              input.value = formatShortcutDisplay(ShortcutsManager.getShortcut(toolId) || '', isMac);
              input.classList.remove('border-accent', 'text-accent');
              input.blur();
              return;
            }

            // Check if this is a reserved shortcut
            const reservedWarning = getReservedShortcutWarning(combo, isMac);
            if (reservedWarning) {
              const displayCombo = formatShortcutDisplay(combo, isMac);
              const shouldProceed = await showWarningModal(
                trans.shortcutsModal.reservedWarning,
                `<strong>${displayCombo}</strong> ${trans.shortcutsModal.reservedWarningMsg}<br><br>` +
                `"<em>${reservedWarning}</em>"<br><br>` +
                `${trans.shortcutsModal.reservedWarningNote}<br><br>` +
                `${trans.shortcutsModal.useAnyway}`
              );

              if (!shouldProceed) {
                // Revert display
                input.value = formatShortcutDisplay(ShortcutsManager.getShortcut(toolId) || '', isMac);
                input.classList.remove('border-accent', 'text-accent');
                input.blur();
                return;
              }
            }

            ShortcutsManager.setShortcut(toolId, combo);
            // Re-render to update all inputs (show conflicts in real-time)
            renderShortcutsList();
          }
        };

        input.onkeyup = (e) => {
          // If the user releases a modifier without pressing a main key, revert to saved
          const key = e.key.toLowerCase();
          if (['control', 'shift', 'alt', 'meta'].includes(key)) {
            const currentSaved = ShortcutsManager.getShortcut(toolId);
          }
        };

        input.onfocus = () => {
          input.value = 'Press keys...';
          input.classList.add('border-accent', 'text-accent');
        };

        input.onblur = () => {
          input.value = formatShortcutDisplay(ShortcutsManager.getShortcut(toolId) || '', isMac);
          input.classList.remove('border-accent', 'text-accent');
        };

        right.append(input);
        if (currentShortcut) right.append(clearBtn);

        item.append(left, right);
        itemsContainer.appendChild(item);
      });

      if (hasTools) {
        dom.shortcutsList.appendChild(section);
      }
    });

    createIcons({ icons });
  }

  const scrollToTopBtn = document.getElementById('scroll-to-top-btn');

  if (scrollToTopBtn) {
    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < lastScrollY && currentScrollY > 300) {
        scrollToTopBtn.classList.add('visible');
      } else {
        scrollToTopBtn.classList.remove('visible');
      }

      lastScrollY = currentScrollY;
    });

    scrollToTopBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'instant'
      });
    });
  }
};

document.addEventListener('DOMContentLoaded', init);
