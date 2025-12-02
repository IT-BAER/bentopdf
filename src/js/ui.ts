import { resetState } from './state.js';
import { formatBytes, getPDFDocument } from './utils/helpers.js';
import { tesseractLanguages } from './config/tesseract-languages.js';
import { renderPagesProgressively, cleanupLazyRendering } from './utils/render-utils.js';
import { icons, createIcons } from 'lucide';
import Sortable from 'sortablejs';
import { getRotationState, updateRotationState } from './handlers/fileHandler.js';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();


// Centralizing DOM element selection
export const dom = {
    gridView: document.getElementById('all-tools'),
    toolGrid: document.getElementById('tool-grid'),
    toolInterface: document.getElementById('tool-interface'),
    toolContent: document.getElementById('tool-content'),
    backToGridBtn: document.getElementById('back-to-grid'),
    loaderModal: document.getElementById('loader'),
    loaderText: document.getElementById('loader-text'),
    alertModal: document.getElementById('alert-modal'),
    alertTitle: document.getElementById('alert-title'),
    alertMessage: document.getElementById('alert-message'),
    alertOkBtn: document.getElementById('alert-ok-btn'),
    toolsHeader: document.getElementById('tools-header'),
    shortcutsModal: document.getElementById('shortcuts-modal'),
    closeShortcutsModalBtn: document.getElementById('close-shortcuts-modal'),
    shortcutsList: document.getElementById('shortcuts-list'),
    shortcutSearch: document.getElementById('shortcut-search'),
    resetShortcutsBtn: document.getElementById('reset-shortcuts-btn'),
    importShortcutsBtn: document.getElementById('import-shortcuts-btn'),
    exportShortcutsBtn: document.getElementById('export-shortcuts-btn'),
    openShortcutsBtn: document.getElementById('open-shortcuts-btn'),
    warningModal: document.getElementById('warning-modal'),
    warningTitle: document.getElementById('warning-title'),
    warningMessage: document.getElementById('warning-message'),
    warningCancelBtn: document.getElementById('warning-cancel-btn'),
    warningConfirmBtn: document.getElementById('warning-confirm-btn'),
};

export const showLoader = (text = 'Wird verarbeitet...') => {
    dom.loaderText.textContent = text;
    dom.loaderModal.classList.remove('hidden');
};

export const hideLoader = () => dom.loaderModal.classList.add('hidden');

export const showAlert = (title: any, message: any) => {
    dom.alertTitle.textContent = title;
    dom.alertMessage.textContent = message;
    dom.alertModal.classList.remove('hidden');
};

export const hideAlert = () => dom.alertModal.classList.add('hidden');

export const switchView = (view: any) => {
    if (view === 'grid') {
        dom.gridView.classList.remove('hidden');
        dom.toolInterface.classList.add('hidden');
        // show header
        if (dom.toolsHeader) {
            dom.toolsHeader.classList.remove('hidden');
        }
        resetState();
    } else {
        dom.gridView.classList.add('hidden');
        dom.toolInterface.classList.remove('hidden');
        if (dom.toolsHeader) {
            dom.toolsHeader.classList.add('hidden');
        }
    }
};

const thumbnailState = {
    sortableInstances: {},
};

function initializeOrganizeSortable(containerId: any) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (thumbnailState.sortableInstances[containerId]) {
        thumbnailState.sortableInstances[containerId].destroy();
    }

    thumbnailState.sortableInstances[containerId] = Sortable.create(container, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        filter: '.delete-page-btn',
        preventOnFilter: true,
        onStart: function (evt: any) {
            evt.item.style.opacity = '0.5';
        },
        onEnd: function (evt: any) {
            evt.item.style.opacity = '1';
        },
    });
}

/**
 * Renders page thumbnails for tools like 'Organize' and 'Rotate'.
 * @param {string} toolId The ID of the active tool.
 * @param {object} pdfDoc The loaded pdf-lib document instance.
 */
export const renderPageThumbnails = async (toolId: any, pdfDoc: any) => {
    const containerId = toolId === 'organize' ? 'page-organizer' : 'page-rotator';
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    // Cleanup any previous lazy loading observers
    cleanupLazyRendering();

    showLoader('Seitenvorschau wird erstellt...');

    const pdfData = await pdfDoc.save();
    const pdf = await getPDFDocument({ data: pdfData }).promise;

    // Function to create wrapper element for each page
    const createWrapper = (canvas: HTMLCanvasElement, pageNumber: number) => {
        const wrapper = document.createElement('div');
        // @ts-expect-error TS(2322) FIXME: Type 'number' is not assignable to type 'string'.
        wrapper.dataset.pageIndex = pageNumber - 1;

        const imgContainer = document.createElement('div');
        imgContainer.className =
            'w-full h-36 bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden border-2 border-gray-600';

        const img = document.createElement('img');
        img.src = canvas.toDataURL();
        img.className = 'max-w-full max-h-full object-contain';

        imgContainer.appendChild(img);

        if (toolId === 'organize') {
            wrapper.className = 'page-thumbnail relative group';
            wrapper.appendChild(imgContainer);

            const pageNumSpan = document.createElement('span');
            pageNumSpan.className =
                'absolute top-1 left-1 bg-gray-900 bg-opacity-75 text-white text-xs rounded-full px-2 py-1';
            pageNumSpan.textContent = pageNumber.toString();

            const deleteBtn = document.createElement('button');
            deleteBtn.className =
                'delete-page-btn absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.addEventListener('click', (e) => {
                (e.currentTarget as HTMLElement).parentElement.remove();

                // Renumber remaining pages
                const pages = container.querySelectorAll('.page-thumbnail');
                pages.forEach((page, index) => {
                    const numSpan = page.querySelector('span');
                    if (numSpan) {
                        numSpan.textContent = (index + 1).toString();
                    }
                });

                initializeOrganizeSortable(containerId);
            });

            wrapper.append(pageNumSpan, deleteBtn);
        } else if (toolId === 'rotate') {
            wrapper.className = 'page-rotator-item flex flex-col items-center gap-2';

            // Read rotation from state (handles "Rotate All" on lazy-loaded pages)
            const rotationStateArray = getRotationState();
            const pageIndex = pageNumber - 1;
            const initialRotation = rotationStateArray[pageIndex] || 0;

            wrapper.dataset.rotation = initialRotation.toString();
            img.classList.add('transition-transform', 'duration-300');

            // Apply initial rotation if any
            if (initialRotation !== 0) {
                img.style.transform = `rotate(${initialRotation}deg)`;
            }

            wrapper.appendChild(imgContainer);

            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'flex items-center justify-center gap-3 w-full';

            const pageNumSpan = document.createElement('span');
            pageNumSpan.className = 'font-medium text-sm text-white';
            pageNumSpan.textContent = pageNumber.toString();

            const rotateBtn = document.createElement('button');
            rotateBtn.className =
                'rotate-btn btn bg-gray-700 hover:bg-gray-600 p-2 rounded-full';
            rotateBtn.title = 'Um 90° drehen';
            rotateBtn.innerHTML = '<i data-lucide="rotate-cw" class="w-5 h-5"></i>';
            rotateBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = (e.currentTarget as HTMLElement).closest(
                    '.page-rotator-item'
                ) as HTMLElement;
                const imgEl = card.querySelector('img');
                const pageIndex = pageNumber - 1;
                let currentRotation = parseInt(card.dataset.rotation);
                currentRotation = (currentRotation + 90) % 360;
                card.dataset.rotation = currentRotation.toString();
                imgEl.style.transform = `rotate(${currentRotation}deg)`;

                updateRotationState(pageIndex, currentRotation);
            });

            controlsDiv.append(pageNumSpan, rotateBtn);
            wrapper.appendChild(controlsDiv);
        }

        return wrapper;
    };

    try {
        // Render pages progressively with lazy loading
        await renderPagesProgressively(
            pdf,
            container,
            createWrapper,
            {
                batchSize: 6,
                useLazyLoading: true,
                lazyLoadMargin: '300px',
                onProgress: (current, total) => {
                    showLoader(`Seitenvorschau wird erstellt: ${current}/${total}`);
                },
                onBatchComplete: () => {
                    createIcons({ icons });
                }
            }
        );

        if (toolId === 'organize') {
            initializeOrganizeSortable(containerId);
        }

        // Reinitialize lucide icons for dynamically added elements
        createIcons({ icons });
    } catch (error) {
        console.error('Error rendering page thumbnails:', error);
        showAlert('Fehler', 'Seitenvorschau konnte nicht erstellt werden');
    } finally {
        hideLoader();
    }
};

/**
 * Renders a list of uploaded files in the specified container.
 * @param {HTMLElement} container The DOM element to render the list into.
 * @param {File[]} files The array of file objects.
 */
export const renderFileDisplay = (container: any, files: any) => {
    container.textContent = '';
    if (files.length > 0) {
        files.forEach((file: any) => {
            const fileDiv = document.createElement('div');
            fileDiv.className =
                'flex items-center justify-between bg-gray-700 p-3 rounded-lg text-sm';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'truncate font-medium text-gray-200';
            nameSpan.textContent = file.name;

            const sizeSpan = document.createElement('span');
            sizeSpan.className = 'flex-shrink-0 ml-4 text-gray-400';
            sizeSpan.textContent = formatBytes(file.size);

            fileDiv.append(nameSpan, sizeSpan);
            container.appendChild(fileDiv);
        });
    }
};

const createFileInputHTML = (options = {}) => {
    // @ts-expect-error TS(2339) FIXME: Property 'multiple' does not exist on type '{}'.
    const multiple = options.multiple ? 'multiple' : '';
    // @ts-expect-error TS(2339) FIXME: Property 'accept' does not exist on type '{}'.
    const acceptedFiles = options.accept || 'application/pdf';
    // @ts-expect-error TS(2339) FIXME: Property 'showControls' does not exist on type '{}... Remove this comment to see the full error message
    const showControls = options.showControls || false; // NEW: Add this parameter

    return `
        <div id="drop-zone" class="relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer bg-gray-900 hover:bg-gray-700 transition-colors duration-300">
            <div class="flex flex-col items-center justify-center pt-5 pb-6">
                <i data-lucide="upload-cloud" class="w-10 h-10 mb-3 text-gray-400"></i>
<<<<<<< Updated upstream
                <p class="mb-2 text-sm text-gray-400"><span class="font-semibold" data-i18n="subpages.clickToSelect">Click to select a file</span> <span data-i18n="subpages.orDragDrop">or drag and drop</span></p>
                <p class="text-xs text-gray-500" data-i18n="subpages.${multiple ? 'pdfsOrImages' : 'singlePdfFile'}">${multiple ? 'PDFs or Images' : 'A single PDF file'}</p>
                <p class="text-xs text-gray-500" data-i18n="subpages.filesNeverLeave">Your files never leave your device.</p>
=======
                <p class="mb-2 text-sm text-gray-400"><span class="font-semibold">Klicken Sie, um eine Datei auszuwählen</span> oder per Drag & Drop</p>
                <p class="text-xs text-gray-500">${multiple ? 'PDFs oder Bilder' : 'Eine einzelne PDF-Datei'}</p>
                <p class="text-xs text-gray-500">Ihre Dateien verlassen niemals Ihr Gerät.</p>
>>>>>>> Stashed changes
            </div>
            <input id="file-input" type="file" class="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" ${multiple} accept="${acceptedFiles}">
        </div>
        
        ${showControls
            ? `
            <!-- NEW: Add control buttons for multi-file uploads -->
            <div id="file-controls" class="hidden mt-4 flex gap-3">
<<<<<<< Updated upstream
                <button id="add-more-btn" class="btn-secondary">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                    <span data-i18n="toolInterface.common.addMore">Add More</span>
                </button>
                <button id="clear-files-btn" class="btn-danger">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                    <span data-i18n="toolInterface.common.clearAll">Clear All</span>
=======
                <button id="add-more-btn" class="btn bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2">
                    <i data-lucide="plus"></i> Weitere Dateien hinzufügen
                </button>
                <button id="clear-files-btn" class="btn bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2">
                    <i data-lucide="x"></i> Alle löschen
>>>>>>> Stashed changes
                </button>
            </div>
        `
            : ''
        }
    `;
};

export const toolTemplates = {
    merge: () => `
<<<<<<< Updated upstream
    <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.merge.title">Merge PDFs</h2>
    <p class="mb-6 text-gray-400" data-i18n="toolInterface.merge.description">Combine whole files, or select specific pages to merge into a new document.</p>
    ${createFileInputHTML({ multiple: true, showControls: true })} 

    <div id="merge-options" class="hidden mt-6">
        <div class="flex gap-2 p-1 rounded-xl bg-gray-900/80 border border-gray-700/50 mb-4">
            <button id="file-mode-btn" class="flex-1 py-2.5 px-4 rounded-lg bg-accent text-white font-medium text-sm transition-all" data-i18n="toolInterface.merge.fileMode">
                <i data-lucide="files" class="w-4 h-4 inline mr-1.5 align-text-bottom"></i>File Mode
            </button>
            <button id="page-mode-btn" class="flex-1 py-2.5 px-4 rounded-lg bg-gray-700 text-gray-300 hover:text-white font-medium text-sm transition-all" data-i18n="toolInterface.merge.pageMode">
                <i data-lucide="layout-grid" class="w-4 h-4 inline mr-1.5 align-text-bottom"></i>Page Mode
            </button>
=======
    <h2 class="text-2xl font-bold text-white mb-4">PDFs zusammenführen</h2>
    <p class="mb-6 text-gray-400">Kombinieren Sie ganze Dateien oder wählen Sie bestimmte Seiten aus, um sie zu einem neuen Dokument zusammenzuführen.</p>
    ${createFileInputHTML({ multiple: true, showControls: true })} 

    <div id="merge-options" class="hidden mt-6">
        <div class="flex gap-2 p-1 rounded-lg bg-gray-900 border border-gray-700 mb-4">
            <button id="file-mode-btn" class="flex-1 btn bg-orange-600 text-white font-semibold py-2 rounded-md">Datei-Modus</button>
            <button id="page-mode-btn" class="flex-1 btn text-gray-300 font-semibold py-2 rounded-md">Seiten-Modus</button>
>>>>>>> Stashed changes
        </div>

        <div id="file-mode-panel">
            <div class="p-3 bg-gray-900 rounded-lg border border-gray-700 mb-3">
<<<<<<< Updated upstream
                <p class="text-sm text-gray-300"><strong class="text-white" data-i18n="toolInterface.common.howItWorks">How it works:</strong></p>
                <ul class="list-disc list-inside text-xs text-gray-400 mt-1 space-y-1">
                    <li data-i18n="toolInterface.merge.fileHint1">Click and drag the <i data-lucide="grip-vertical" class="inline-block w-3 h-3"></i> icon to change the order of the files.</li>
                    <li data-i18n="toolInterface.merge.fileHint2">In the "Pages" box for each file, you can specify ranges (e.g., "1-3, 5") to merge only those pages.</li>
                    <li data-i18n="toolInterface.merge.fileHint3">Leave the "Pages" box blank to include all pages from that file.</li>
=======
                <p class="text-sm text-gray-300"><strong class="text-white">So funktioniert es:</strong></p>
                <ul class="list-disc list-inside text-xs text-gray-400 mt-1 space-y-1">
                    <li>Klicken und ziehen Sie das <i data-lucide="grip-vertical" class="inline-block w-3 h-3"></i> Symbol, um die Reihenfolge der Dateien zu ändern.</li>
                    <li>Im "Seiten"-Feld für jede Datei können Sie Bereiche angeben (z.B. "1-3, 5"), um nur diese Seiten zusammenzuführen.</li>
                    <li>Lassen Sie das "Seiten"-Feld leer, um alle Seiten dieser Datei einzuschließen.</li>
>>>>>>> Stashed changes
                </ul>
            </div>
            <ul id="file-list" class="space-y-2"></ul>
        </div>

        <div id="page-mode-panel" class="hidden">
             <div class="p-3 bg-gray-900 rounded-lg border border-gray-700 mb-3">
<<<<<<< Updated upstream
                <p class="text-sm text-gray-300"><strong class="text-white" data-i18n="toolInterface.common.howItWorks">How it works:</strong></p>
                 <ul class="list-disc list-inside text-xs text-gray-400 mt-1 space-y-1">
                    <li data-i18n="toolInterface.merge.pageHint1">All pages from your uploaded PDFs are shown below.</li>
                    <li data-i18n="toolInterface.merge.pageHint2">Simply drag and drop the individual page thumbnails to create the exact order you want for your new file.</li>
=======
                <p class="text-sm text-gray-300"><strong class="text-white">So funktioniert es:</strong></p>
                 <ul class="list-disc list-inside text-xs text-gray-400 mt-1 space-y-1">
                    <li>Alle Seiten aus Ihren hochgeladenen PDFs werden unten angezeigt.</li>
                    <li>Ziehen Sie einfach die einzelnen Seitenvorschauen per Drag & Drop, um die gewünschte Reihenfolge für Ihre neue Datei zu erstellen.</li>
>>>>>>> Stashed changes
                </ul>
            </div>
             <div id="page-merge-preview" class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 p-4 bg-gray-900 rounded-lg border border-gray-700 min-h-[200px]"></div>
        </div>
        
<<<<<<< Updated upstream
        <button id="process-btn" class="btn-gradient mt-6" disabled data-i18n="toolInterface.merge.button">
            <i data-lucide="git-merge" class="w-5 h-5"></i>
            Merge PDFs
        </button>
=======
        <button id="process-btn" class="btn-gradient w-full mt-6" disabled>PDFs zusammenführen</button>
>>>>>>> Stashed changes
    </div>
`,

    split: () => `
<<<<<<< Updated upstream
    <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.split.title">Split PDF</h2>
    <p class="mb-6 text-gray-400" data-i18n="toolInterface.split.description">Extract pages from a PDF using various methods.</p>
=======
    <h2 class="text-2xl font-bold text-white mb-4">PDF aufteilen</h2>
    <p class="mb-6 text-gray-400">Seiten aus einer PDF mit verschiedenen Methoden extrahieren.</p>
>>>>>>> Stashed changes
    ${createFileInputHTML()}
    <div id="file-display-area" class="mt-4 space-y-2"></div>
    <div id="split-options" class="hidden mt-6">
        
<<<<<<< Updated upstream
        <label for="split-mode" class="block mb-2 text-sm font-medium text-gray-300" data-i18n="toolInterface.split.splitMode">Split Mode</label>
        <select id="split-mode" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 mb-4">
            <option value="range" data-i18n="toolInterface.split.extractByRange">Extract by Page Range (Default)</option>
            <option value="even-odd" data-i18n="toolInterface.split.splitEvenOdd">Split by Even/Odd Pages</option>
            <option value="all" data-i18n="toolInterface.split.splitAllPages">Split All Pages into Separate Files</option>
            <option value="visual" data-i18n="toolInterface.split.selectVisually">Select Pages Visually</option>
            <option value="bookmarks" data-i18n="toolInterface.split.splitByBookmarks">Split by Bookmarks</option>
            <option value="n-times" data-i18n="toolInterface.split.splitNTimes">Split N Times</option>
=======
        <label for="split-mode" class="block mb-2 text-sm font-medium text-gray-300">Aufteilungsmodus</label>
        <select id="split-mode" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 mb-4">
            <option value="range">Nach Seitenbereich extrahieren (Standard)</option>
            <option value="even-odd">Nach geraden/ungeraden Seiten aufteilen</option>
            <option value="all">Alle Seiten in separate Dateien aufteilen</option>
            <option value="visual">Seiten visuell auswählen</option>
            <option value="bookmarks">Nach Lesezeichen aufteilen</option>
            <option value="n-times">N-mal aufteilen</option>
>>>>>>> Stashed changes
        </select>

        <div id="range-panel">
            <div class="p-3 bg-gray-900 rounded-lg border border-gray-700 mb-3">
<<<<<<< Updated upstream
                <p class="text-sm text-gray-300"><strong class="text-white" data-i18n="toolInterface.common.howItWorks">How it works:</strong></p>
                <ul class="list-disc list-inside text-xs text-gray-400 mt-1 space-y-1">
                    <li data-i18n="toolInterface.split.rangeHint1">Enter page numbers separated by commas (e.g., 2, 8, 14).</li>
                    <li data-i18n="toolInterface.split.rangeHint2">Enter page ranges using a hyphen (e.g., 5-10).</li>
                    <li data-i18n="toolInterface.split.rangeHint3">Combine them for complex selections (e.g., 1-3, 7, 12-15).</li>
                </ul>
            </div>
            <p class="mb-2 font-medium text-white"><span data-i18n="toolInterface.split.totalPages">Total Pages:</span> <span id="total-pages"></span></p>
            <label for="page-range" class="block mb-2 text-sm font-medium text-gray-300" data-i18n="toolInterface.split.pageRange">Enter page range:</label>
            <input type="text" id="page-range" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder="e.g., 1-5, 8">
=======
                <p class="text-sm text-gray-300"><strong class="text-white">So funktioniert es:</strong></p>
                <ul class="list-disc list-inside text-xs text-gray-400 mt-1 space-y-1">
                    <li>Geben Sie Seitenzahlen getrennt durch Kommas ein (z.B. 2, 8, 14).</li>
                    <li>Geben Sie Seitenbereiche mit einem Bindestrich ein (z.B. 5-10).</li>
                    <li>Kombinieren Sie sie für komplexe Auswahlen (z.B. 1-3, 7, 12-15).</li>
                </ul>
            </div>
            <p class="mb-2 font-medium text-white">Gesamtseiten: <span id="total-pages"></span></p>
            <label for="page-range" class="block mb-2 text-sm font-medium text-gray-300">Seitenbereich eingeben:</label>
            <input type="text" id="page-range" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder="z.B. 1-5, 8">
>>>>>>> Stashed changes
        </div>

        <div id="even-odd-panel" class="hidden">
            <div class="p-3 bg-gray-900 rounded-lg border border-gray-700 mb-3">
<<<<<<< Updated upstream
                <p class="text-sm text-gray-300"><strong class="text-white" data-i18n="toolInterface.common.howItWorks">How it works:</strong></p>
                <p class="text-xs text-gray-400 mt-1" data-i18n="toolInterface.split.evenOddHint">This will create a new PDF containing only the even or only the odd pages from your original document.</p>
=======
                <p class="text-sm text-gray-300"><strong class="text-white">So funktioniert es:</strong></p>
                <p class="text-xs text-gray-400 mt-1">Dies erstellt eine neue PDF mit nur den geraden oder nur den ungeraden Seiten aus Ihrem Originaldokument.</p>
>>>>>>> Stashed changes
            </div>
            <div class="flex gap-4">
                <label class="flex-1 flex items-center justify-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer has-[:checked]:bg-orange-600">
                    <input type="radio" name="even-odd-choice" value="odd" checked class="hidden">
<<<<<<< Updated upstream
                    <span class="font-semibold text-white" data-i18n="toolInterface.split.oddPagesOnly">Odd Pages Only</span>
=======
                    <span class="font-semibold text-white">Nur ungerade Seiten</span>
>>>>>>> Stashed changes
                </label>
                <label class="flex-1 flex items-center justify-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer has-[:checked]:bg-orange-600">
                    <input type="radio" name="even-odd-choice" value="even" class="hidden">
<<<<<<< Updated upstream
                    <span class="font-semibold text-white" data-i18n="toolInterface.split.evenPagesOnly">Even Pages Only</span>
=======
                    <span class="font-semibold text-white">Nur gerade Seiten</span>
>>>>>>> Stashed changes
                </label>
            </div>
        </div>
        
        <div id="visual-select-panel" class="hidden">
             <div class="p-3 bg-gray-900 rounded-lg border border-gray-700 mb-3">
<<<<<<< Updated upstream
                <p class="text-sm text-gray-300"><strong class="text-white" data-i18n="toolInterface.common.howItWorks">How it works:</strong></p>
                <p class="text-xs text-gray-400 mt-1" data-i18n="toolInterface.split.visualHint">Click on the page thumbnails below to select them. Click again to deselect. All selected pages will be extracted.</p>
=======
                <p class="text-sm text-gray-300"><strong class="text-white">So funktioniert es:</strong></p>
                <p class="text-xs text-gray-400 mt-1">Klicken Sie auf die Seitenvorschauen unten, um sie auszuwählen. Klicken Sie erneut zum Abwählen. Alle ausgewählten Seiten werden extrahiert.</p>
>>>>>>> Stashed changes
            </div>
             <div id="page-selector-grid" class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 p-4 bg-gray-900 rounded-lg border border-gray-700 min-h-[150px]"></div>
        </div>

        <div id="all-pages-panel" class="hidden p-3 bg-gray-900 rounded-lg border border-gray-700">
<<<<<<< Updated upstream
            <p class="text-sm text-gray-300"><strong class="text-white" data-i18n="toolInterface.common.howItWorks">How it works:</strong></p>
            <p class="text-xs text-gray-400 mt-1" data-i18n="toolInterface.split.allPagesHint">This mode will create a separate PDF file for every single page in your document and download them together in one ZIP archive.</p>
=======
            <p class="text-sm text-gray-300"><strong class="text-white">So funktioniert es:</strong></p>
            <p class="text-xs text-gray-400 mt-1">Dieser Modus erstellt für jede einzelne Seite in Ihrem Dokument eine separate PDF-Datei und lädt sie zusammen in einem ZIP-Archiv herunter.</p>
>>>>>>> Stashed changes
        </div>

        <div id="bookmarks-panel" class="hidden">
            <div class="p-3 bg-gray-900 rounded-lg border border-gray-700 mb-3">
<<<<<<< Updated upstream
                <p class="text-sm text-gray-300"><strong class="text-white" data-i18n="toolInterface.common.howItWorks">How it works:</strong></p>
                <p class="text-xs text-gray-400 mt-1" data-i18n="toolInterface.split.bookmarksHint">Split the PDF at bookmark locations. Each bookmark will start a new PDF file.</p>
            </div>
            <div class="mb-4">
                <label for="bookmark-level" class="block mb-2 text-sm font-medium text-gray-300" data-i18n="toolInterface.split.bookmarkLevel">Bookmark Level</label>
                <select id="bookmark-level" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                    <option value="0" data-i18n="toolInterface.split.level0">Level 0 (Top level only)</option>
                    <option value="1">Level 1</option>
                    <option value="2">Level 2</option>
                    <option value="3">Level 3</option>
                    <option value="all" selected data-i18n="toolInterface.split.allLevels">All Levels</option>
                </select>
                <p class="mt-1 text-xs text-gray-400" data-i18n="toolInterface.split.bookmarkLevelHint">Select which bookmark nesting level to use for splitting</p>
=======
                <p class="text-sm text-gray-300"><strong class="text-white">So funktioniert es:</strong></p>
                <p class="text-xs text-gray-400 mt-1">Die PDF an Lesezeichen-Positionen aufteilen. Jedes Lesezeichen startet eine neue PDF-Datei.</p>
            </div>
            <div class="mb-4">
                <label for="bookmark-level" class="block mb-2 text-sm font-medium text-gray-300">Lesezeichen-Ebene</label>
                <select id="bookmark-level" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                    <option value="0">Ebene 0 (Nur oberste Ebene)</option>
                    <option value="1">Ebene 1</option>
                    <option value="2">Ebene 2</option>
                    <option value="3">Ebene 3</option>
                    <option value="all" selected>Alle Ebenen</option>
                </select>
                <p class="mt-1 text-xs text-gray-400">Wählen Sie, welche Lesezeichen-Verschachtelungsebene zum Aufteilen verwendet werden soll</p>
>>>>>>> Stashed changes
            </div>
        </div>

        <div id="n-times-panel" class="hidden">
            <div class="p-3 bg-gray-900 rounded-lg border border-gray-700 mb-3">
<<<<<<< Updated upstream
                <p class="text-sm text-gray-300"><strong class="text-white" data-i18n="toolInterface.common.howItWorks">How it works:</strong></p>
                <p class="text-xs text-gray-400 mt-1" data-i18n="toolInterface.split.nTimesHint">Split the PDF into N equal parts. For example, a 40-page PDF with N=5 will create 8 PDFs with 5 pages each.</p>
            </div>
            <div class="mb-4">
                <label for="split-n-value" class="block mb-2 text-sm font-medium text-gray-300" data-i18n="toolInterface.split.pagesPerSplit">Number of Pages per Split (N)</label>
                <input type="number" id="split-n-value" min="1" value="5" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                <p class="mt-1 text-xs text-gray-400" data-i18n="toolInterface.split.nTimesNote">Each resulting PDF will contain N pages (except possibly the last one)</p>
            </div>
            <div id="n-times-warning" class="hidden p-3 bg-yellow-900/30 border border-yellow-500/30 rounded-lg mb-3">
                <p class="text-sm text-yellow-200"><strong data-i18n="toolInterface.common.note">Note:</strong> <span id="n-times-warning-text"></span></p>
=======
                <p class="text-sm text-gray-300"><strong class="text-white">So funktioniert es:</strong></p>
                <p class="text-xs text-gray-400 mt-1">Die PDF in N gleiche Teile aufteilen. Zum Beispiel wird eine 40-seitige PDF mit N=5 8 PDFs mit je 5 Seiten erstellen.</p>
            </div>
            <div class="mb-4">
                <label for="split-n-value" class="block mb-2 text-sm font-medium text-gray-300">Anzahl der Seiten pro Aufteilung (N)</label>
                <input type="number" id="split-n-value" min="1" value="5" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                <p class="mt-1 text-xs text-gray-400">Jede resultierende PDF enthält N Seiten (außer möglicherweise die letzte)</p>
            </div>
            <div id="n-times-warning" class="hidden p-3 bg-yellow-900/30 border border-yellow-500/30 rounded-lg mb-3">
                <p class="text-sm text-yellow-200"><strong>Hinweis:</strong> <span id="n-times-warning-text"></span></p>
>>>>>>> Stashed changes
            </div>
        </div>
        
        <div id="zip-option-wrapper" class="hidden mt-4">
            <label class="flex items-center gap-2 text-sm font-medium text-gray-300">
<<<<<<< Updated upstream
                <input type="checkbox" id="download-as-zip" class="w-4 h-4 rounded text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500">
                <span data-i18n="toolInterface.split.downloadAsZip">Download pages as individual files in a ZIP</span>
            </label>
        </div>
        
        <button id="process-btn" class="btn-gradient mt-6" data-i18n="toolInterface.split.button">
            <i data-lucide="scissors" class="w-5 h-5"></i>
            Split PDF
        </button>
=======
                <input type="checkbox" id="download-as-zip" class="w-4 h-4 rounded text-orange-600 bg-gray-700 border-gray-600 focus:ring-orange-500">
                Seiten als einzelne Dateien in einem ZIP herunterladen
            </label>
        </div>
        
        <button id="process-btn" class="btn-gradient w-full mt-6">PDF aufteilen</button>
>>>>>>> Stashed changes

    </div>
`,
    encrypt: () => `
<<<<<<< Updated upstream
  <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.encrypt.title">Encrypt PDF</h2>
  <p class="mb-6 text-gray-400" data-i18n="toolInterface.encrypt.description">Add 256-bit AES password protection to your PDF.</p>
=======
  <h2 class="text-2xl font-bold text-white mb-4">PDF verschlüsseln</h2>
  <p class="mb-6 text-gray-400">256-Bit AES-Passwortschutz zu Ihrer PDF hinzufügen.</p>
>>>>>>> Stashed changes
  ${createFileInputHTML()}
  <div id="file-display-area" class="mt-4 space-y-2"></div>
  <div id="encrypt-options" class="hidden space-y-4 mt-6">
      <div>
          <label for="user-password-input" class="block mb-2 text-sm font-medium text-gray-300">Benutzer-Passwort</label>
          <input required type="password" id="user-password-input" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder="Passwort zum Öffnen der PDF">
          <p class="text-xs text-gray-500 mt-1">Erforderlich zum Öffnen und Anzeigen der PDF</p>
      </div>
      <div>
          <label for="owner-password-input" class="block mb-2 text-sm font-medium text-gray-300">Besitzer-Passwort (Optional)</label>
          <input type="password" id="owner-password-input" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder="Passwort für volle Berechtigungen (empfohlen)">
          <p class="text-xs text-gray-500 mt-1">Ermöglicht das Ändern von Berechtigungen und Entfernen der Verschlüsselung</p>
      </div>

      <!-- Restriction checkboxes (shown when owner password is entered) -->
      <div id="restriction-options" class="hidden p-4 bg-gray-800 border border-gray-700 rounded-lg">
        <h3 class="font-semibold text-base mb-2 text-white">🔒 PDF-Berechtigungen einschränken</h3>
        <p class="text-sm text-gray-400 mb-3">Wählen Sie, welche Aktionen deaktiviert werden sollen:</p>
        <div class="space-y-2">
          <label class="flex items-center space-x-2">
            <input type="checkbox" id="restrict-modify" checked>
            <span>Alle Änderungen deaktivieren (--modify=none)</span>
          </label>
          <label class="flex items-center space-x-2">
            <input type="checkbox" id="restrict-extract" checked>
            <span>Text- und Bildextraktion deaktivieren (--extract=n)</span>
          </label>
          <label class="flex items-center space-x-2">
            <input type="checkbox" id="restrict-print" checked>
            <span>Drucken deaktivieren (--print=none)</span>
          </label>
          <label class="flex items-center space-x-2">
            <input type="checkbox" id="restrict-accessibility">
            <span>Barrierefreiheits-Textkopie deaktivieren (--accessibility=n)</span>
          </label>
          <label class="flex items-center space-x-2">
            <input type="checkbox" id="restrict-annotate">
            <span>Anmerkungen deaktivieren (--annotate=n)</span>
          </label>
          <label class="flex items-center space-x-2">
            <input type="checkbox" id="restrict-assemble">
            <span>Seitenzusammenstellung deaktivieren (--assemble=n)</span>
          </label>
          <label class="flex items-center space-x-2">
            <input type="checkbox" id="restrict-form">
            <span>Formularausfüllung deaktivieren (--form=n)</span>
          </label>
          <label class="flex items-center space-x-2">
            <input type="checkbox" id="restrict-modify-other">
            <span>Andere Änderungen deaktivieren (--modify-other=n)</span>
          </label>
        </div>
      </div>

      <div class="p-4 bg-yellow-900/20 border border-yellow-500/30 text-yellow-200 rounded-lg">
          <h3 class="font-semibold text-base mb-2">⚠️ Sicherheitsempfehlung</h3>
          <p class="text-sm text-gray-300">Für starke Sicherheit setzen Sie beide Passwörter. Ohne Besitzer-Passwort können die Sicherheitseinschränkungen (Drucken, Kopieren usw.) leicht umgangen werden.</p>
      </div>
      <div class="p-4 bg-green-900/20 border border-green-500/30 text-green-200 rounded-lg">
          <h3 class="font-semibold text-base mb-2">✓ Hochwertige Verschlüsselung</h3>
          <p class="text-sm text-gray-300">256-Bit AES-Verschlüsselung ohne Qualitätsverlust. Text bleibt auswählbar und durchsuchbar.</p>
      </div>
<<<<<<< Updated upstream
      <button id="process-btn" class="btn-gradient mt-6">
          <i data-lucide="lock" class="w-5 h-5"></i>
          <span data-i18n="toolInterface.encrypt.button">Encrypt & Download</span>
      </button>
  </div>
`,
    decrypt: () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.decrypt.title">Decrypt PDF</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.decrypt.description">Upload an encrypted PDF and provide its password to create an unlocked version.</p>
=======
      <button id="process-btn" class="btn-gradient w-full mt-6">Verschlüsseln & Herunterladen</button>
  </div>
`,
    decrypt: () => `
        <h2 class="text-2xl font-bold text-white mb-4">PDF entschlüsseln</h2>
        <p class="mb-6 text-gray-400">Laden Sie eine verschlüsselte PDF hoch und geben Sie das Passwort ein, um eine entsperrte Version zu erstellen.</p>
>>>>>>> Stashed changes
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <div id="decrypt-options" class="hidden space-y-4 mt-6">
            <div>
<<<<<<< Updated upstream
                <label for="password-input" class="block mb-2 text-sm font-medium text-gray-300" data-i18n="toolInterface.decrypt.password">Enter PDF Password</label>
                <input type="password" id="password-input" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder="Enter the current password">
            </div>
            <button id="process-btn" class="btn-gradient mt-6" data-i18n="toolInterface.decrypt.button">
                <i data-lucide="unlock" class="w-5 h-5"></i>
                Decrypt & Download
            </button>
=======
                <label for="password-input" class="block mb-2 text-sm font-medium text-gray-300">PDF-Passwort eingeben</label>
                <input type="password" id="password-input" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder="Aktuelles Passwort eingeben">
            </div>
            <button id="process-btn" class="btn-gradient w-full mt-6">Entschlüsseln & Herunterladen</button>
>>>>>>> Stashed changes
        </div>
        <canvas id="pdf-canvas" class="hidden"></canvas>
    `,
    organize: () => `
<<<<<<< Updated upstream
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.organize.title">Organize PDF</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.organize.description">Reorder, rotate, or delete pages. Drag and drop pages to reorder them.</p>
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <div id="page-organizer" class="hidden grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 my-6"></div>
        <button id="process-btn" class="btn-gradient mt-6" data-i18n="toolInterface.organize.button">
            <i data-lucide="save" class="w-5 h-5"></i>
            Save Changes
        </button>
    `,

    rotate: () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.rotate.title">Rotate PDF</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.rotate.description">Rotate all or specific pages in a PDF document.</p>
=======
        <h2 class="text-2xl font-bold text-white mb-4">Seiten organisieren</h2>
        <p class="mb-6 text-gray-400">Seiten neu anordnen, drehen oder löschen. Ziehen Sie Seiten per Drag & Drop, um sie neu anzuordnen.</p>
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <div id="page-organizer" class="hidden grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 my-6"></div>
        <button id="process-btn" class="btn-gradient w-full mt-6">Änderungen speichern</button>
    `,

    rotate: () => `
        <h2 class="text-2xl font-bold text-white mb-4">PDF drehen</h2>
        <p class="mb-6 text-gray-400">Alle oder bestimmte Seiten in einem PDF-Dokument drehen.</p>
>>>>>>> Stashed changes
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        
        <div id="rotate-all-controls" class="hidden my-6">
            <div class="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
<<<<<<< Updated upstream
                <h3 class="text-sm font-semibold text-gray-400 mb-3 text-center" data-i18n="toolInterface.rotate.batchActions">BATCH ACTIONS</h3>
                <div class="flex justify-center gap-4">
                    <button id="rotate-all-left-btn" class="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-gray-200 bg-gray-800 border border-gray-600 rounded-lg shadow-sm hover:bg-gray-700 hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 transform transition-all duration-150 active:scale-95">
                        <i data-lucide="rotate-ccw" class="mr-2 h-4 w-4"></i>
                        <span data-i18n="toolInterface.rotate.rotateAllLeft">Rotate All Left</span>
                    </button>
                    <button id="rotate-all-right-btn" class="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-gray-200 bg-gray-800 border border-gray-600 rounded-lg shadow-sm hover:bg-gray-700 hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 transform transition-all duration-150 active:scale-95">
                        <i data-lucide="rotate-cw" class="mr-2 h-4 w-4"></i>
                        <span data-i18n="toolInterface.rotate.rotateAllRight">Rotate All Right</span>
=======
                <h3 class="text-sm font-semibold text-gray-400 mb-3 text-center">STAPELAKTIONEN</h3>
                <div class="flex justify-center gap-4">
                    <button id="rotate-all-left-btn" class="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-gray-200 bg-gray-800 border border-gray-600 rounded-lg shadow-sm hover:bg-gray-700 hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 transform transition-all duration-150 active:scale-95">
                        <i data-lucide="rotate-ccw" class="mr-2 h-4 w-4"></i>
                        Alle nach links drehen
                    </button>
                    <button id="rotate-all-right-btn" class="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-gray-200 bg-gray-800 border border-gray-600 rounded-lg shadow-sm hover:bg-gray-700 hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 transform transition-all duration-150 active:scale-95">
                        <i data-lucide="rotate-cw" class="mr-2 h-4 w-4"></i>
                        Alle nach rechts drehen
>>>>>>> Stashed changes
                    </button>
                </div>
            </div>
        </div>
        <div id="page-rotator" class="hidden grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 my-6"></div>
<<<<<<< Updated upstream
        <button id="process-btn" class="btn-gradient mt-6" data-i18n="toolInterface.rotate.button">
            <i data-lucide="rotate-cw" class="w-5 h-5"></i>
            Save Rotations
        </button>
    `,

    'add-page-numbers': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.pageNumbers.title">Add Page Numbers</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.pageNumbers.description">Add customizable page numbers to your PDF file.</p>
=======
        <button id="process-btn" class="btn-gradient w-full mt-6">Drehungen speichern</button>
    `,

    'add-page-numbers': () => `
        <h2 class="text-2xl font-bold text-white mb-4">Seitenzahlen hinzufügen</h2>
        <p class="mb-6 text-gray-400">Fügen Sie anpassbare Seitenzahlen zu Ihrer PDF-Datei hinzu.</p>
>>>>>>> Stashed changes
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <div id="pagenum-options" class="hidden grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div>
                <label for="position" class="block mb-2 text-sm font-medium text-gray-300">Position</label>
                <select id="position" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                    <option value="bottom-center">Unten Mitte</option>
                    <option value="bottom-left">Unten Links</option>
                    <option value="bottom-right">Unten Rechts</option>
                    <option value="top-center">Oben Mitte</option>
                    <option value="top-left">Oben Links</option>
                    <option value="top-right">Oben Rechts</option>
                </select>
            </div>
            <div>
                <label for="font-size" class="block mb-2 text-sm font-medium text-gray-300">Schriftgröße</label>
                <input type="number" id="font-size" value="12" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
            </div>
            <div>
                <label for="number-format" class="block mb-2 text-sm font-medium text-gray-300">Format</label>
                <select id="number-format" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                    <option value="default">1, 2, 3...</option>
                    <option value="page_x_of_y">Seite 1/N, 2/N...</option>
                </select>
            </div>
            <div>
                <label for="text-color" class="block mb-2 text-sm font-medium text-gray-300">Textfarbe</label>
                <input type="color" id="text-color" value="#000000" class="w-full h-[42px] bg-gray-700 border border-gray-600 rounded-lg p-1 cursor-pointer">
            </div>
        </div>
<<<<<<< Updated upstream
        <button id="process-btn" class="btn-gradient mt-6" data-i18n="toolInterface.pageNumbers.button">
            <i data-lucide="hash" class="w-5 h-5"></i>
            Add Page Numbers
        </button>
    `,
    'pdf-to-jpg': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.pdfToJpg.title">PDF to JPG</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.pdfToJpg.description">Convert each page of a PDF file into a high-quality JPG image.</p>
=======
        <button id="process-btn" class="btn-gradient w-full mt-6">Seitenzahlen hinzufügen</button>
    `,
    'pdf-to-jpg': () => `
        <h2 class="text-2xl font-bold text-white mb-4">PDF zu JPG</h2>
        <p class="mb-6 text-gray-400">Konvertieren Sie jede Seite einer PDF-Datei in ein hochwertiges JPG-Bild.</p>
>>>>>>> Stashed changes
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <div id="jpg-preview" class="hidden mt-6">
            <div class="mb-4">
                <label for="jpg-quality" class="block mb-2 text-sm font-medium text-gray-300">Bildqualität</label>
                <div class="flex items-center gap-4">
                    <input type="range" id="jpg-quality" min="0.1" max="1.0" step="0.01" value="1.0" class="flex-1">
                    <span id="jpg-quality-value" class="text-white font-medium w-16 text-right">100%</span>
                </div>
                <p class="mt-1 text-xs text-gray-400">Höhere Qualität = größere Dateigröße</p>
            </div>
<<<<<<< Updated upstream
            <p class="mb-4 text-white text-center">Click "Download All as ZIP" to get images for all pages.</p>
            <button id="process-btn" class="btn-gradient">Download All as ZIP</button>
        </div>
    `,
    'jpg-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.jpgToPdf.title">JPG to PDF</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.jpgToPdf.description">Convert one or more JPG images into a single PDF file.</p>
=======
            <p class="mb-4 text-white text-center">Klicken Sie auf "Alle als ZIP herunterladen", um Bilder für alle Seiten zu erhalten.</p>
            <button id="process-btn" class="btn-gradient w-full">Alle als ZIP herunterladen</button>
        </div>
    `,
    'jpg-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4">JPG zu PDF</h2>
        <p class="mb-6 text-gray-400">Konvertieren Sie ein oder mehrere JPG-Bilder in eine einzelne PDF-Datei.</p>
>>>>>>> Stashed changes
        ${createFileInputHTML({ multiple: true, accept: 'image/jpeg', showControls: true })}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <div id="jpg-to-pdf-options" class="hidden mt-6">
            <div class="mb-4">
                <label for="jpg-pdf-quality" class="block mb-2 text-sm font-medium text-gray-300">PDF-Qualität</label>
                <select id="jpg-pdf-quality" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                    <option value="high">Hohe Qualität (Größere Datei)</option>
                    <option value="medium" selected>Mittlere Qualität (Ausgewogen)</option>
                    <option value="low">Niedrige Qualität (Kleinere Datei)</option>
                </select>
                <p class="mt-1 text-xs text-gray-400">Steuert die Bildkomprimierung beim Einbetten in PDF</p>
            </div>
        </div>
<<<<<<< Updated upstream
        <button id="process-btn" class="btn-gradient mt-6" data-i18n="toolInterface.jpgToPdf.button">
            <i data-lucide="file-output" class="w-5 h-5"></i>
            Convert to PDF
        </button>
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.scan.title">Scan to PDF</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.scan.description">Use your device's camera to scan documents and save them as a PDF. On desktop, this will open a file picker.</p>
        ${createFileInputHTML({ accept: 'image/*' })}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="btn-gradient mt-6" data-i18n="toolInterface.scan.button">
            <i data-lucide="scan" class="w-5 h-5"></i>
            Create PDF from Scans
        </button>
    `,

    crop: () => `
    <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.crop.title">Crop PDF</h2>
    <p class="mb-6 text-gray-400" data-i18n="toolInterface.crop.description">Click and drag to select a crop area on any page. You can set different crop areas for each page.</p>
=======
        <button id="process-btn" class="btn-gradient w-full mt-6">In PDF konvertieren</button>
    `,
    'scan-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4">Scannen zu PDF</h2>
        <p class="mb-6 text-gray-400">Verwenden Sie die Kamera Ihres Geräts, um Dokumente zu scannen und als PDF zu speichern. Auf dem Desktop wird ein Dateiauswahldialog geöffnet.</p>
        ${createFileInputHTML({ accept: 'image/*' })}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="btn-gradient w-full mt-6">PDF aus Scans erstellen</button>
    `,

    crop: () => `
    <h2 class="text-2xl font-bold text-white mb-4">PDF zuschneiden</h2>
    <p class="mb-6 text-gray-400">Klicken und ziehen Sie, um einen Zuschneidebereich auf einer beliebigen Seite auszuwählen. Sie können für jede Seite unterschiedliche Zuschneidebereiche festlegen.</p>
>>>>>>> Stashed changes
    ${createFileInputHTML()}
    <div id="crop-editor" class="hidden">
        <div class="flex flex-col md:flex-row items-center justify-center gap-4 mb-4 p-3 bg-gray-900 rounded-lg border border-gray-700">
            <div id="page-nav" class="flex items-center gap-2"></div>
            <div class="border-l border-gray-600 h-6 mx-2 hidden md:block"></div>
            <div id="zoom-controls" class="flex items-center gap-2">
                <button id="zoom-out-btn" class="btn p-2 rounded-full bg-gray-700 hover:bg-gray-600" title="Verkleinern"><i data-lucide="zoom-out" class="w-5 h-5"></i></button>
                <button id="fit-page-btn" class="btn p-2 rounded-full bg-gray-700 hover:bg-gray-600" title="An Ansicht anpassen"><i data-lucide="minimize" class="w-5 h-5"></i></button>
                <button id="zoom-in-btn" class="btn p-2 rounded-full bg-gray-700 hover:bg-gray-600" title="Vergrößern"><i data-lucide="zoom-in" class="w-5 h-5"></i></button>
            </div>
             <div class="border-l border-gray-600 h-6 mx-2 hidden md:block"></div>
            <div id="crop-controls" class="flex items-center gap-2">
<<<<<<< Updated upstream
                 <button id="clear-crop-btn" class="btn-secondary text-sm" title="Clear crop on this page" data-i18n="toolInterface.crop.clearPage">
                     <i data-lucide="eraser" class="w-4 h-4"></i>
                     Clear Page
                 </button>
                 <button id="clear-all-crops-btn" class="btn-danger text-sm" title="Clear all crop selections" data-i18n="toolInterface.crop.clearAll">
                     <i data-lucide="trash-2" class="w-4 h-4"></i>
                     Clear All
                 </button>
=======
                 <button id="clear-crop-btn" class="btn bg-yellow-600 hover:bg-yellow-700 text-white font-semibold px-4 py-2 rounded-lg text-sm" title="Zuschnitt auf dieser Seite löschen">Seite löschen</button>
                 <button id="clear-all-crops-btn" class="btn bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg text-sm" title="Alle Zuschneideauswahlen löschen">Alle löschen</button>
>>>>>>> Stashed changes
            </div>
        </div>
        <div id="canvas-container" class="relative w-full overflow-auto bg-gray-900 rounded-lg border border-gray-600" style="height: 70vh;">
            <canvas id="canvas-editor" class="mx-auto cursor-crosshair"></canvas>
        </div>
<<<<<<< Updated upstream
        <button id="process-btn" class="btn-gradient mt-6" data-i18n="toolInterface.crop.button">
            <i data-lucide="crop" class="w-5 h-5"></i>
            Apply Crop & Save PDF
        </button>
    </div>
`,
    compress: () => `
    <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.compress.title">Compress PDF</h2>
    <p class="mb-6 text-gray-400" data-i18n="toolInterface.compress.description">Reduce file size by choosing the compression method that best suits your document. Supports multiple PDFs.</p>
=======
        <button id="process-btn" class="btn-gradient w-full mt-6">Zuschnitt anwenden & PDF speichern</button>
    </div>
`,
    compress: () => `
    <h2 class="text-2xl font-bold text-white mb-4">PDF komprimieren</h2>
    <p class="mb-6 text-gray-400">Reduzieren Sie die Dateigröße, indem Sie die Komprimierungsmethode wählen, die am besten zu Ihrem Dokument passt. Unterstützt mehrere PDFs.</p>
>>>>>>> Stashed changes
    ${createFileInputHTML({ multiple: true, showControls: true })}
    <div id="file-display-area" class="mt-4 space-y-2"></div>
    <div id="compress-options" class="hidden mt-6 space-y-6">
        <div>
<<<<<<< Updated upstream
            <label for="compression-level" class="block mb-2 text-sm font-medium text-gray-300" data-i18n="toolInterface.compress.level">Compression Level</label>
            <select id="compression-level" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 focus:ring-indigo-500 focus:border-indigo-500">
                <option value="balanced" data-i18n="toolInterface.compress.balanced">Balanced (Recommended)</option>
                <option value="high-quality" data-i18n="toolInterface.compress.highQuality">High Quality (Larger file)</option>
                <option value="small-size" data-i18n="toolInterface.compress.smallSize">Smallest Size (Lower quality)</option>
                <option value="extreme" data-i18n="toolInterface.compress.extreme">Extreme (Very low quality)</option>
=======
            <label for="compression-level" class="block mb-2 text-sm font-medium text-gray-300">Komprimierungsstufe</label>
            <select id="compression-level" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 focus:ring-indigo-500 focus:border-indigo-500">
                <option value="balanced">Ausgewogen (Empfohlen)</option>
                <option value="high-quality">Hohe Qualität (Größere Datei)</option>
                <option value="small-size">Kleinste Größe (Niedrigere Qualität)</option>
                <option value="extreme">Extrem (Sehr niedrige Qualität)</option>
>>>>>>> Stashed changes
            </select>
        </div>

        <div>
<<<<<<< Updated upstream
            <label for="compression-algorithm" class="block mb-2 text-sm font-medium text-gray-300" data-i18n="toolInterface.compress.algorithm">Compression Algorithm</label>
            <select id="compression-algorithm" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 focus:ring-indigo-500 focus:border-indigo-500">
                <option value="vector" data-i18n="toolInterface.compress.vector">Vector (For Text Heavy PDF)</option>
                <option value="photon" data-i18n="toolInterface.compress.photon">Photon (For Complex Images & Drawings)</option>
            </select>
            <p class="mt-2 text-xs text-gray-400" data-i18n="toolInterface.compress.algorithmHint">
                Choose 'Vector' for text based PDFs, or 'Photon' for scanned documents and complex images.
            </p>
        </div>

        <button id="process-btn" class="btn-gradient mt-4" disabled data-i18n="toolInterface.compress.button">
            <i data-lucide="minimize-2" class="w-5 h-5"></i>
            Compress PDF
        </button>
    </div>
`,
    'pdf-to-greyscale': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.greyscale.title">PDF to Greyscale</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.greyscale.description">Convert all pages of a PDF to greyscale. This is done by rendering each page, applying a filter, and rebuilding the PDF.</p>
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="btn-gradient mt-6" data-i18n="toolInterface.greyscale.button">
            <i data-lucide="contrast" class="w-5 h-5"></i>
            Convert to Greyscale
        </button>
    `,
    'pdf-to-zip': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.pdfsToZip.title">Combine PDFs into ZIP</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.pdfsToZip.description">Select multiple PDF files to download them together in a single ZIP archive.</p>
        ${createFileInputHTML({ multiple: true, showControls: true })}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="btn-gradient mt-6" data-i18n="toolInterface.pdfsToZip.button">
            <i data-lucide="archive" class="w-5 h-5"></i>
            Create ZIP File
        </button>
    `,

    'edit-metadata': () => `
    <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.editMetadata.title">Edit PDF Metadata</h2>
    <p class="mb-6 text-gray-400" data-i18n="toolInterface.editMetadata.description">Modify the core metadata fields of your PDF. Leave a field blank to clear it.</p>
=======
            <label for="compression-algorithm" class="block mb-2 text-sm font-medium text-gray-300">Komprimierungsalgorithmus</label>
            <select id="compression-algorithm" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 focus:ring-indigo-500 focus:border-indigo-500">
                <option value="vector">Vektor (Für textlastige PDFs)</option>
                <option value="photon">Photon (Für komplexe Bilder & Zeichnungen)</option>
            </select>
            <p class="mt-2 text-xs text-gray-400">
                Wählen Sie 'Vektor' für textbasierte PDFs oder 'Photon' für gescannte Dokumente und komplexe Bilder.
            </p>
        </div>

        <button id="process-btn" class="btn-gradient w-full mt-4" disabled>PDF komprimieren</button>
    </div>
`,
    'pdf-to-greyscale': () => `
        <h2 class="text-2xl font-bold text-white mb-4">PDF in Graustufen</h2>
        <p class="mb-6 text-gray-400">Konvertieren Sie alle Seiten einer PDF in Graustufen. Dies geschieht durch Rendern jeder Seite, Anwenden eines Filters und Neuerstellen der PDF.</p>
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="btn-gradient w-full mt-6">In Graustufen konvertieren</button>
    `,
    'pdf-to-zip': () => `
        <h2 class="text-2xl font-bold text-white mb-4">PDFs in ZIP kombinieren</h2>
        <p class="mb-6 text-gray-400">Wählen Sie mehrere PDF-Dateien aus, um sie zusammen in einem einzelnen ZIP-Archiv herunterzuladen.</p>
        ${createFileInputHTML({ multiple: true, showControls: true })}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="btn-gradient w-full mt-6">ZIP-Datei erstellen</button>
    `,

    'edit-metadata': () => `
    <h2 class="text-2xl font-bold text-white mb-4">PDF-Metadaten bearbeiten</h2>
    <p class="mb-6 text-gray-400">Ändern Sie die Kern-Metadatenfelder Ihrer PDF. Lassen Sie ein Feld leer, um es zu löschen.</p>
>>>>>>> Stashed changes
    
    <div class="p-3 mb-6 bg-gray-900 border border-yellow-500/30 text-yellow-200/80 rounded-lg text-sm flex items-start gap-3">
        <i data-lucide="info" class="w-5 h-5 flex-shrink-0 mt-0.5"></i>
        <div>
            <strong class="font-semibold text-yellow-200">Wichtiger Hinweis:</strong>
            Dieses Tool verwendet die <code class="bg-gray-700 px-1 rounded text-white">pdf-lib</code> Bibliothek, die beim Hochladen möglicherweise die Felder <strong>Produzent</strong>, <strong>Erstellungsdatum</strong> und <strong>Änderungsdatum</strong> aktualisiert. Um die endgültigen Metadaten einer Datei nach der Bearbeitung oder zum normalen Betrachten genau anzuzeigen, verwenden Sie bitte unser <strong>Metadaten anzeigen</strong> Tool.
        </div>
    </div>

    ${createFileInputHTML()}
    
    <div id="metadata-form" class="hidden mt-6 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <label for="meta-title" class="block mb-2 text-sm font-medium text-gray-300">Titel</label>
                <input type="text" id="meta-title" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
            </div>
            <div>
                <label for="meta-author" class="block mb-2 text-sm font-medium text-gray-300">Autor</label>
                <input type="text" id="meta-author" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
            </div>
            <div>
                <label for="meta-subject" class="block mb-2 text-sm font-medium text-gray-300">Betreff</label>
                <input type="text" id="meta-subject" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
            </div>
             <div>
                <label for="meta-keywords" class="block mb-2 text-sm font-medium text-gray-300">Schlüsselwörter (kommagetrennt)</label>
                <input type="text" id="meta-keywords" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
            </div>
            <div>
                <label for="meta-creator" class="block mb-2 text-sm font-medium text-gray-300">Erstellungsprogramm</label>
                <input type="text" id="meta-creator" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
            </div>
            <div>
                <label for="meta-producer" class="block mb-2 text-sm font-medium text-gray-300">Produzent</label>
                <input type="text" id="meta-producer" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
            </div>
             <div>
                <label for="meta-creation-date" class="block mb-2 text-sm font-medium text-gray-300">Erstellungsdatum</label>
                <input type="datetime-local" id="meta-creation-date" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
            </div>
            <div>
                <label for="meta-mod-date" class="block mb-2 text-sm font-medium text-gray-300">Änderungsdatum</label>
                <input type="datetime-local" id="meta-mod-date" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
            </div>
        </div>

        <div id="custom-metadata-container" class="space-y-3 pt-4 border-t border-gray-700">
             <h3 class="text-lg font-semibold text-white">Benutzerdefinierte Felder</h3>
             <p class="text-sm text-gray-400 -mt-2">Hinweis: Benutzerdefinierte Felder werden nicht von allen PDF-Readern unterstützt.</p>
        </div>
        <button id="add-custom-meta-btn" class="btn border border-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2">
            <i data-lucide="plus"></i> Benutzerdefiniertes Feld hinzufügen
        </button>
        
    </div>

<<<<<<< Updated upstream
    <button id="process-btn" class="hidden btn-gradient mt-6">
        <i data-lucide="file-pen" class="w-5 h-5"></i>
        <span data-i18n="toolInterface.editMetadata.button">Update Metadata & Download</span>
    </button>
`,

    'remove-metadata': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.removeMetadata.title">Remove PDF Metadata</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.removeMetadata.description">Completely remove identifying metadata from your PDF.</p>
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="hidden mt-6 btn-gradient" data-i18n="toolInterface.removeMetadata.button">
            <i data-lucide="file-x" class="w-5 h-5"></i>
            Remove Metadata & Download
        </button>
    `,
    flatten: () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.flatten.title">Flatten PDF</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.flatten.description">Make PDF forms and annotations non-editable by flattening them.</p>
        ${createFileInputHTML({ multiple: true, showControls: true })}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="hidden mt-6 btn-gradient" data-i18n="toolInterface.flatten.button">
            <i data-lucide="layers" class="w-5 h-5"></i>
            Flatten PDF
        </button>
    `,
    'pdf-to-png': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.pdfToPng.title">PDF to PNG</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.pdfToPng.description">Convert each page of a PDF file into a high-quality PNG image.</p>
=======
    <button id="process-btn" class="hidden btn-gradient w-full mt-6">Metadaten aktualisieren & Herunterladen</button>
`,

    'remove-metadata': () => `
        <h2 class="text-2xl font-bold text-white mb-4">PDF-Metadaten entfernen</h2>
        <p class="mb-6 text-gray-400">Entfernen Sie identifizierende Metadaten vollständig aus Ihrer PDF.</p>
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="hidden mt-6 btn-gradient w-full">Metadaten entfernen & Herunterladen</button>
    `,
    flatten: () => `
        <h2 class="text-2xl font-bold text-white mb-4">PDF reduzieren</h2>
        <p class="mb-6 text-gray-400">Machen Sie PDF-Formulare und Anmerkungen nicht bearbeitbar, indem Sie sie reduzieren.</p>
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="hidden mt-6 btn-gradient w-full">PDF reduzieren</button>
    `,
    'pdf-to-png': () => `
        <h2 class="text-2xl font-bold text-white mb-4">PDF zu PNG</h2>
        <p class="mb-6 text-gray-400">Konvertieren Sie jede Seite einer PDF-Datei in ein hochwertiges PNG-Bild.</p>
>>>>>>> Stashed changes
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <div id="png-preview" class="hidden mt-6">
            <div class="mb-4">
                <label for="png-quality" class="block mb-2 text-sm font-medium text-gray-300">Bildqualität (Skalierung)</label>
                <div class="flex items-center gap-4">
                    <input type="range" id="png-quality" min="1.0" max="4.0" step="0.5" value="2.0" class="flex-1">
                    <span id="png-quality-value" class="text-white font-medium w-16 text-right">2.0x</span>
                </div>
                <p class="mt-1 text-xs text-gray-400">Höhere Skalierung = bessere Qualität aber größere Dateigröße</p>
            </div>
<<<<<<< Updated upstream
            <p class="mb-4 text-white text-center">Your file is ready. Click the button to download a ZIP file containing all PNG images.</p>
            <button id="process-btn" class="btn-gradient">
                <i data-lucide="download" class="w-5 h-5"></i>
                <span data-i18n="toolInterface.pdfToPng.button">Download All as ZIP</span>
            </button>
        </div>
    `,
    'png-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.pngToPdf.title">PNG to PDF</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.pngToPdf.description">Convert one or more PNG images into a single PDF file.</p>
=======
            <p class="mb-4 text-white text-center">Ihre Datei ist bereit. Klicken Sie auf den Button, um eine ZIP-Datei mit allen PNG-Bildern herunterzuladen.</p>
            <button id="process-btn" class="btn-gradient w-full">Alle als ZIP herunterladen</button>
        </div>
    `,
    'png-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4">PNG zu PDF</h2>
        <p class="mb-6 text-gray-400">Konvertieren Sie ein oder mehrere PNG-Bilder in eine einzelne PDF-Datei.</p>
>>>>>>> Stashed changes
        ${createFileInputHTML({ multiple: true, accept: 'image/png', showControls: true })}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <div id="png-to-pdf-options" class="hidden mt-6">
            <div class="mb-4">
                <label for="png-pdf-quality" class="block mb-2 text-sm font-medium text-gray-300">PDF-Qualität</label>
                <select id="png-pdf-quality" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                    <option value="high">Hohe Qualität (Größere Datei)</option>
                    <option value="medium" selected>Mittlere Qualität (Ausgewogen)</option>
                    <option value="low">Niedrige Qualität (Kleinere Datei)</option>
                </select>
                <p class="mt-1 text-xs text-gray-400">Steuert die Bildkomprimierung beim Einbetten in PDF</p>
            </div>
        </div>
<<<<<<< Updated upstream
        <button id="process-btn" class="btn-gradient mt-6" data-i18n="toolInterface.pngToPdf.button">
            <i data-lucide="file-output" class="w-5 h-5"></i>
            Convert to PDF
        </button>
    `,
    'pdf-to-webp': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.pdfToWebp.title">PDF to WebP</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.pdfToWebp.description">Convert each page of a PDF file into a modern WebP image.</p>
=======
        <button id="process-btn" class="btn-gradient w-full mt-6">In PDF konvertieren</button>
    `,
    'pdf-to-webp': () => `
        <h2 class="text-2xl font-bold text-white mb-4">PDF zu WebP</h2>
        <p class="mb-6 text-gray-400">Konvertieren Sie jede Seite einer PDF-Datei in ein modernes WebP-Bild.</p>
>>>>>>> Stashed changes
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <div id="webp-preview" class="hidden mt-6">
            <div class="mb-4">
                <label for="webp-quality" class="block mb-2 text-sm font-medium text-gray-300">Bildqualität</label>
                <div class="flex items-center gap-4">
                    <input type="range" id="webp-quality" min="0.1" max="1.0" step="0.1" value="0.9" class="flex-1">
                    <span id="webp-quality-value" class="text-white font-medium w-16 text-right">90%</span>
                </div>
                <p class="mt-1 text-xs text-gray-400">Höhere Qualität = größere Dateigröße</p>
            </div>
<<<<<<< Updated upstream
            <p class="mb-4 text-white text-center">Your file is ready. Click the button to download a ZIP file containing all WebP images.</p>
            <button id="process-btn" class="btn-gradient">
                <i data-lucide="download" class="w-5 h-5"></i>
                <span data-i18n="toolInterface.pdfToWebp.button">Download All as ZIP</span>
            </button>
        </div>
    `,
    'webp-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.webpToPdf.title">WebP to PDF</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.webpToPdf.description">Convert one or more WebP images into a single PDF file.</p>
        ${createFileInputHTML({ multiple: true, accept: 'image/webp', showControls: true })}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="btn-gradient mt-6" data-i18n="toolInterface.webpToPdf.button">
            <i data-lucide="file-output" class="w-5 h-5"></i>
            Convert to PDF
        </button>
    `,
    edit: () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.edit.title">PDF Studio</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.edit.description">An all-in-one PDF workspace where you can annotate, draw, highlight, redact, add comments and shapes, take screenshots, and view PDFs.</p>
=======
            <p class="mb-4 text-white text-center">Ihre Datei ist bereit. Klicken Sie auf den Button, um eine ZIP-Datei mit allen WebP-Bildern herunterzuladen.</p>
            <button id="process-btn" class="btn-gradient w-full">Alle als ZIP herunterladen</button>
        </div>
    `,
    'webp-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4">WebP zu PDF</h2>
        <p class="mb-6 text-gray-400">Konvertieren Sie ein oder mehrere WebP-Bilder in eine einzelne PDF-Datei.</p>
        ${createFileInputHTML({ multiple: true, accept: 'image/webp', showControls: true })}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="btn-gradient w-full mt-6">In PDF konvertieren</button>
    `,
    edit: () => `
        <h2 class="text-2xl font-bold text-white mb-4">PDF Studio</h2>
        <p class="mb-6 text-gray-400">Ein All-in-One PDF-Arbeitsbereich, in dem Sie kommentieren, zeichnen, hervorheben, schwärzen, Kommentare und Formen hinzufügen, Screenshots machen und PDFs anzeigen können.</p>
>>>>>>> Stashed changes
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <div id="embed-pdf-wrapper" class="hidden mt-6 w-full h-[75vh] border border-gray-600 rounded-lg">
            <div id="embed-pdf-container" class="w-full h-full"></div>
        </div>
    `,
    'delete-pages': () => `
<<<<<<< Updated upstream
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.deletePages.title">Delete Pages</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.deletePages.description">Remove specific pages or ranges of pages from your PDF file.</p>
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <div id="delete-options" class="hidden mt-6">
            <p class="mb-2 font-medium text-white">Total Pages: <span id="total-pages"></span></p>
            <label for="pages-to-delete" class="block mb-2 text-sm font-medium text-gray-300">Enter pages to delete (e.g., 2, 4-6, 9):</label>
            <input type="text" id="pages-to-delete" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 mb-6" placeholder="e.g., 2, 4-6, 9">
            <button id="process-btn" class="btn-gradient">Delete Pages & Download</button>
        </div>
    `,
    'add-blank-page': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.addBlankPage.title">Add Blank Pages</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.addBlankPage.description">Insert one or more blank pages at a specific position in your document.</p>
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <div id="blank-page-options" class="hidden mt-6">
            <p class="mb-2 font-medium text-white">Total Pages: <span id="total-pages"></span></p>
            <label for="page-number" class="block mb-2 text-sm font-medium text-gray-300">Insert blank pages after page number:</label>
            <input type="number" id="page-number" min="0" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 mb-4" placeholder="Enter 0 to add to the beginning">
            <label for="page-count" class="block mb-2 text-sm font-medium text-gray-300">Number of blank pages to insert:</label>
            <input type="number" id="page-count" min="1" value="1" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 mb-6" placeholder="Enter number of pages">
            <button id="process-btn" class="btn-gradient">Add Pages & Download</button>
        </div>
    `,
    'extract-pages': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.extractPages.title">Extract Pages</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.extractPages.description">Extract specific pages from a PDF into separate files. Your files will download in a ZIP archive.</p>
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <div id="extract-options" class="hidden mt-6">
            <p class="mb-2 font-medium text-white">Total Pages: <span id="total-pages"></span></p>
            <label for="pages-to-extract" class="block mb-2 text-sm font-medium text-gray-300">Enter pages to extract (e.g., 2, 4-6, 9):</label>
            <input type="text" id="pages-to-extract" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 mb-6" placeholder="e.g., 2, 4-6, 9">
            <button id="process-btn" class="btn-gradient">Extract & Download ZIP</button>
=======
        <h2 class="text-2xl font-bold text-white mb-4">Seiten löschen</h2>
        <p class="mb-6 text-gray-400">Entfernen Sie bestimmte Seiten oder Seitenbereiche aus Ihrer PDF-Datei.</p>
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <div id="delete-options" class="hidden mt-6">
            <p class="mb-2 font-medium text-white">Gesamtseiten: <span id="total-pages"></span></p>
            <label for="pages-to-delete" class="block mb-2 text-sm font-medium text-gray-300">Geben Sie zu löschende Seiten ein (z.B. 2, 4-6, 9):</label>
            <input type="text" id="pages-to-delete" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 mb-6" placeholder="z.B. 2, 4-6, 9">
            <button id="process-btn" class="btn-gradient w-full">Seiten löschen & Herunterladen</button>
        </div>
    `,
    'add-blank-page': () => `
        <h2 class="text-2xl font-bold text-white mb-4">Leere Seiten hinzufügen</h2>
        <p class="mb-6 text-gray-400">Fügen Sie eine oder mehrere leere Seiten an einer bestimmten Position in Ihrem Dokument ein.</p>
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <div id="blank-page-options" class="hidden mt-6">
            <p class="mb-2 font-medium text-white">Gesamtseiten: <span id="total-pages"></span></p>
            <label for="page-number" class="block mb-2 text-sm font-medium text-gray-300">Leere Seiten nach Seitennummer einfügen:</label>
            <input type="number" id="page-number" min="0" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 mb-4" placeholder="Geben Sie 0 ein, um am Anfang hinzuzufügen">
            <label for="page-count" class="block mb-2 text-sm font-medium text-gray-300">Anzahl der einzufügenden leeren Seiten:</label>
            <input type="number" id="page-count" min="1" value="1" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 mb-6" placeholder="Anzahl der Seiten eingeben">
            <button id="process-btn" class="btn-gradient w-full">Seiten hinzufügen & Herunterladen</button>
        </div>
    `,
    'extract-pages': () => `
        <h2 class="text-2xl font-bold text-white mb-4">Seiten extrahieren</h2>
        <p class="mb-6 text-gray-400">Extrahieren Sie bestimmte Seiten aus einer PDF in separate Dateien. Ihre Dateien werden als ZIP-Archiv heruntergeladen.</p>
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <div id="extract-options" class="hidden mt-6">
            <p class="mb-2 font-medium text-white">Gesamtseiten: <span id="total-pages"></span></p>
            <label for="pages-to-extract" class="block mb-2 text-sm font-medium text-gray-300">Geben Sie zu extrahierende Seiten ein (z.B. 2, 4-6, 9):</label>
            <input type="text" id="pages-to-extract" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 mb-6" placeholder="z.B. 2, 4-6, 9">
            <button id="process-btn" class="btn-gradient w-full">Extrahieren & ZIP herunterladen</button>
>>>>>>> Stashed changes
        </div>
    `,

    'add-watermark': () => `
<<<<<<< Updated upstream
    <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.watermark.title">Add Watermark</h2>
    <p class="mb-6 text-gray-400" data-i18n="toolInterface.watermark.description">Apply a text or image watermark to every page of your PDF document.</p>
=======
    <h2 class="text-2xl font-bold text-white mb-4">Wasserzeichen hinzufügen</h2>
    <p class="mb-6 text-gray-400">Fügen Sie ein Text- oder Bildwasserzeichen zu jeder Seite Ihres PDF-Dokuments hinzu.</p>
>>>>>>> Stashed changes
    ${createFileInputHTML()}
    <div id="file-display-area" class="mt-4 space-y-2"></div>

    <div id="watermark-options" class="hidden mt-6 space-y-4">
        <div class="flex gap-4 p-2 rounded-lg bg-gray-900">
            <label class="flex-1 flex items-center justify-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer has-[:checked]:bg-indigo-600">
                <input type="radio" name="watermark-type" value="text" checked class="hidden">
                <span class="font-semibold text-white">Text</span>
            </label>
            <label class="flex-1 flex items-center justify-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer has-[:checked]:bg-indigo-600">
                <input type="radio" name="watermark-type" value="image" class="hidden">
                <span class="font-semibold text-white">Bild</span>
            </label>
        </div>

        <div id="text-watermark-options">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label for="watermark-text" class="block mb-2 text-sm font-medium text-gray-300">Wasserzeichen-Text</label>
                    <input type="text" id="watermark-text" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder="z.B. VERTRAULICH">
                </div>
                <div>
                    <label for="font-size" class="block mb-2 text-sm font-medium text-gray-300">Schriftgröße</label>
                    <input type="number" id="font-size" value="72" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                </div>
            </div>
             <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                    <label for="text-color" class="block mb-2 text-sm font-medium text-gray-300">Textfarbe</label>
                    <input type="color" id="text-color" value="#000000" class="w-full h-[42px] bg-gray-700 border border-gray-600 rounded-lg p-1 cursor-pointer">
                </div>
                <div>
                    <label for="opacity-text" class="block mb-2 text-sm font-medium text-gray-300">Deckkraft (<span id="opacity-value-text">0.3</span>)</label>
                    <input type="range" id="opacity-text" value="0.3" min="0" max="1" step="0.1" class="w-full">
                </div>
            </div>
            <div class="mt-4">
                <label for="angle-text" class="block mb-2 text-sm font-medium text-gray-300">Winkel (<span id="angle-value-text">0</span>°)</label>
                <input type="range" id="angle-text" value="0" min="-180" max="180" step="1" class="w-full">
            </div>
        </div>

        <div id="image-watermark-options" class="hidden space-y-4">
            <div>
                <label for="image-watermark-input" class="block mb-2 text-sm font-medium text-gray-300">Wasserzeichen-Bild hochladen</label>
                <input type="file" id="image-watermark-input" accept="image/png, image/jpeg" class="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700">
            </div>
            <div>
                <label for="opacity-image" class="block mb-2 text-sm font-medium text-gray-300">Deckkraft (<span id="opacity-value-image">0.3</span>)</label>
                <input type="range" id="opacity-image" value="0.3" min="0" max="1" step="0.1" class="w-full">
            </div>
            <div>
                <label for="angle-image" class="block mb-2 text-sm font-medium text-gray-300">Winkel (<span id="angle-value-image">0</span>°)</label>
                <input type="range" id="angle-image" value="0" min="-180" max="180" step="1" class="w-full">
            </div>
        </div>

    </div>
<<<<<<< Updated upstream
    <button id="process-btn" class="hidden btn-gradient mt-6">Add Watermark & Download</button>
`,

    'add-header-footer': () => `
    <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.headerFooter.title">Add Header & Footer</h2>
    <p class="mb-6 text-gray-400" data-i18n="toolInterface.headerFooter.description">Add custom text to the top and bottom margins of every page.</p>
=======
    <button id="process-btn" class="hidden btn-gradient w-full mt-6">Wasserzeichen hinzufügen & Herunterladen</button>
`,

    'add-header-footer': () => `
    <h2 class="text-2xl font-bold text-white mb-4">Kopf- & Fußzeile hinzufügen</h2>
    <p class="mb-6 text-gray-400">Fügen Sie benutzerdefinierten Text in die oberen und unteren Ränder jeder Seite ein.</p>
>>>>>>> Stashed changes
    ${createFileInputHTML()}
    <div id="file-display-area" class="mt-4 space-y-2"></div>
    <div id="header-footer-options" class="hidden mt-6 space-y-4">
        
        <div class="p-4 bg-gray-900 border border-gray-700 rounded-lg">
            <h3 class="text-lg font-semibold text-white mb-3">Formatierungsoptionen</h3>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                    <label for="page-range" class="block mb-2 text-sm font-medium text-gray-300">Seitenbereich (optional)</label>
                    <input type="text" id="page-range" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder="z.B. 1-3, 5">
                    <p class="text-xs text-gray-400 mt-1">Gesamtseiten: <span id="total-pages">0</span></p>
                </div>
                <div>
                    <label for="font-size" class="block mb-2 text-sm font-medium text-gray-300">Schriftgröße</label>
                    <input type="number" id="font-size" value="10" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                </div>
                <div>
                    <label for="font-color" class="block mb-2 text-sm font-medium text-gray-300">Schriftfarbe</label>
                    <input type="color" id="font-color" value="#000000" class="w-full h-[42px] bg-gray-700 border border-gray-600 rounded-lg p-1 cursor-pointer">
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label for="header-left" class="block mb-2 text-sm font-medium text-gray-300">Kopfzeile Links</label>
                <input type="text" id="header-left" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
            </div>
            <div>
                <label for="header-center" class="block mb-2 text-sm font-medium text-gray-300">Kopfzeile Mitte</label>
                <input type="text" id="header-center" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
            </div>
            <div>
                <label for="header-right" class="block mb-2 text-sm font-medium text-gray-300">Kopfzeile Rechts</label>
                <input type="text" id="header-right" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label for="footer-left" class="block mb-2 text-sm font-medium text-gray-300">Fußzeile Links</label>
                <input type="text" id="footer-left" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
            </div>
            <div>
                <label for="footer-center" class="block mb-2 text-sm font-medium text-gray-300">Fußzeile Mitte</label>
                <input type="text" id="footer-center" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
            </div>
            <div>
                <label for="footer-right" class="block mb-2 text-sm font-medium text-gray-300">Fußzeile Rechts</label>
                <input type="text" id="footer-right" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
            </div>
        </div>
    </div>
<<<<<<< Updated upstream
    <button id="process-btn" class="hidden btn-gradient mt-6">Apply Header & Footer</button>
`,

    'image-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.imageToPdf.title">Image to PDF Converter</h2>
        <p class="mb-4 text-gray-400" data-i18n="toolInterface.imageToPdf.description">Combine multiple images into a single PDF. Drag and drop to reorder.</p>
=======
    <button id="process-btn" class="hidden btn-gradient w-full mt-6">Kopf- & Fußzeile anwenden</button>
`,

    'image-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4">Bild zu PDF Konverter</h2>
        <p class="mb-4 text-gray-400">Kombinieren Sie mehrere Bilder in einer einzelnen PDF. Per Drag & Drop neu anordnen.</p>
>>>>>>> Stashed changes
        
        <div class="mb-6 p-3 bg-gray-900/50 border border-gray-700 rounded-lg">
          <p class="text-sm text-gray-300 mb-2"><strong class="text-white">Unterstützte Formate:</strong></p>
          <p class="text-xs text-gray-400">JPG, PNG, WebP, BMP, TIFF, SVG, HEIC/HEIF</p>
        </div>
        
        ${createFileInputHTML({ multiple: true, accept: 'image/jpeg,image/png,image/webp,image/bmp,image/tiff,image/svg+xml', showControls: true })}
        <ul id="image-list" class="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
        </ul>
        <div id="image-to-pdf-options" class="hidden mt-6">
          <div class="mb-4">
            <label for="image-pdf-quality" class="block mb-2 text-sm font-medium text-gray-300">PDF-Bildqualität</label>
            <div class="flex items-center gap-4">
              <input type="range" id="image-pdf-quality" min="0.3" max="1.0" step="0.1" value="0.9" class="flex-1">
              <span id="image-pdf-quality-value" class="text-white font-medium w-16 text-right">90%</span>
            </div>
            <p class="mt-1 text-xs text-gray-400">Höhere Qualität = größere PDF-Größe</p>
          </div>
        </div>
<<<<<<< Updated upstream
        <button id="process-btn" class="btn-gradient mt-6" data-i18n="toolInterface.imageToPdf.button">
            <i data-lucide="file-output" class="w-5 h-5"></i>
            Convert to PDF
        </button>
    `,

    'change-permissions': () => `
    <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.changePermissions.title">Change PDF Permissions</h2>
    <p class="mb-6 text-gray-400" data-i18n="toolInterface.changePermissions.description">Modify passwords and permissions without losing quality.</p>
=======
        <button id="process-btn" class="btn-gradient w-full mt-6">In PDF konvertieren</button>
    `,

    'change-permissions': () => `
    <h2 class="text-2xl font-bold text-white mb-4">PDF-Berechtigungen ändern</h2>
    <p class="mb-6 text-gray-400">Ändern Sie Passwörter und Berechtigungen ohne Qualitätsverlust.</p>
>>>>>>> Stashed changes
    ${createFileInputHTML()}
    <div id="file-display-area" class="mt-4 space-y-2"></div>
    <div id="permissions-options" class="hidden mt-6 space-y-4">
        <div>
            <label for="current-password" class="block mb-2 text-sm font-medium text-gray-300">Aktuelles Passwort (falls verschlüsselt)</label>
            <input type="password" id="current-password" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder="Leer lassen, wenn PDF nicht passwortgeschützt ist">
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label for="new-user-password" class="block mb-2 text-sm font-medium text-gray-300">Neues Benutzer-Passwort (optional)</label>
                <input type="password" id="new-user-password" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder="Passwort zum Öffnen der PDF">
            </div>
            <div>
                <label for="new-owner-password" class="block mb-2 text-sm font-medium text-gray-300">Neues Besitzer-Passwort (optional)</label>
                <input type="password" id="new-owner-password" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder="Passwort für volle Berechtigungen">
            </div>
        </div>

        <div class="p-4 bg-blue-900/20 border border-blue-500/30 text-blue-200 rounded-lg">
            <h3 class="font-semibold text-base mb-2">So funktioniert es</h3>
            <ul class="list-disc list-inside text-sm text-gray-300 space-y-1">
                <li><strong>Benutzer-Passwort:</strong> Erforderlich zum Öffnen der PDF</li>
                <li><strong>Besitzer-Passwort:</strong> Erforderlich zur Durchsetzung der unten stehenden Berechtigungen</li>
                <li>Lassen Sie beide leer, um alle Verschlüsselungen und Einschränkungen zu entfernen</li>
                <li>Aktivieren Sie die Kontrollkästchen unten, um bestimmte Aktionen zu ERLAUBEN (deaktiviert = deaktiviert)</li>
            </ul>
        </div>
        
        <fieldset class="border border-gray-600 p-4 rounded-lg">
            <legend class="px-2 text-sm font-medium text-gray-300">Berechtigungen (nur mit Besitzer-Passwort durchgesetzt):</legend>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <label class="flex items-center gap-2 text-gray-300 cursor-pointer hover:text-white">
                    <input type="checkbox" id="allow-printing" checked class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"> 
                    Drucken erlauben
                </label>
                <label class="flex items-center gap-2 text-gray-300 cursor-pointer hover:text-white">
                    <input type="checkbox" id="allow-copying" checked class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"> 
                    Text-/Bildextraktion erlauben
                </label>
                <label class="flex items-center gap-2 text-gray-300 cursor-pointer hover:text-white">
                    <input type="checkbox" id="allow-modifying" checked class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"> 
                    Änderungen erlauben
                </label>
                <label class="flex items-center gap-2 text-gray-300 cursor-pointer hover:text-white">
                    <input type="checkbox" id="allow-annotating" checked class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"> 
                    Anmerkungen erlauben
                </label>
                <label class="flex items-center gap-2 text-gray-300 cursor-pointer hover:text-white">
                    <input type="checkbox" id="allow-filling-forms" checked class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"> 
                    Formularausfüllung erlauben
                </label>
                <label class="flex items-center gap-2 text-gray-300 cursor-pointer hover:text-white">
                    <input type="checkbox" id="allow-document-assembly" checked class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"> 
                    Seitenzusammenstellung erlauben
                </label>
                <label class="flex items-center gap-2 text-gray-300 cursor-pointer hover:text-white">
                    <input type="checkbox" id="allow-page-extraction" checked class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded"> 
                    Seitenextraktion erlauben
                </label>
            </div>
        </fieldset>
    </div>
<<<<<<< Updated upstream
    <button id="process-btn" class="hidden btn-gradient mt-6">Apply Changes</button>
`,

    'pdf-to-markdown': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.pdfToMarkdown.title">PDF to Markdown</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.pdfToMarkdown.description">Convert a PDF's text content into a structured Markdown file.</p>
=======
    <button id="process-btn" class="hidden btn-gradient w-full mt-6">Änderungen anwenden</button>
`,

    'pdf-to-markdown': () => `
        <h2 class="text-2xl font-bold text-white mb-4">PDF zu Markdown</h2>
        <p class="mb-6 text-gray-400">Konvertieren Sie den Textinhalt einer PDF in eine strukturierte Markdown-Datei.</p>
>>>>>>> Stashed changes
        ${createFileInputHTML({ accept: '.pdf' })}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <div class="hidden mt-4 p-3 bg-gray-900 border border-yellow-500/30 text-yellow-200 rounded-lg" id="quality-note">
            <p class="text-sm text-gray-400"><b>Hinweis:</b> Dies ist eine textfokussierte Konvertierung. Tabellen und Bilder werden nicht berücksichtigt.</p>
        </div>
<<<<<<< Updated upstream
        <button id="process-btn" class="hidden btn-gradient mt-6">Convert to Markdown</button>
    `,
    'txt-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.txtToPdf.title">Text to PDF</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.txtToPdf.description">Upload one or more text files, or type/paste text below to convert to PDF with custom formatting.</p>
        
        <div class="mb-4">
            <div class="flex gap-2 p-1 rounded-lg bg-gray-900 border border-gray-700 mb-4">
                <button id="txt-mode-upload-btn" class="flex-1 btn bg-accent text-white font-semibold py-2 rounded-md" data-i18n="toolInterface.txtToPdf.uploadFiles">Upload Files</button>
                <button id="txt-mode-text-btn" class="flex-1 btn bg-gray-700 text-gray-300 font-semibold py-2 rounded-md" data-i18n="toolInterface.txtToPdf.typeText">Type Text</button>
=======
        <button id="process-btn" class="hidden btn-gradient w-full mt-6">In Markdown konvertieren</button>
    `,
    'txt-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4">Text zu PDF</h2>
        <p class="mb-6 text-gray-400">Laden Sie eine oder mehrere Textdateien hoch oder geben Sie Text ein, um ihn mit benutzerdefinierter Formatierung in PDF zu konvertieren.</p>
        
        <div class="mb-4">
            <div class="flex gap-2 p-1 rounded-lg bg-gray-900 border border-gray-700 mb-4">
                <button id="txt-mode-upload-btn" class="flex-1 btn bg-indigo-600 text-white font-semibold py-2 rounded-md">Dateien hochladen</button>
                <button id="txt-mode-text-btn" class="flex-1 btn bg-gray-700 text-gray-300 font-semibold py-2 rounded-md">Text eingeben</button>
>>>>>>> Stashed changes
            </div>
            
            <div id="txt-upload-panel">
                ${createFileInputHTML({ multiple: true, accept: 'text/plain,.txt', showControls: true })}
                <div id="file-display-area" class="mt-4 space-y-2"></div>
            </div>
            
            <div id="txt-text-panel" class="hidden">
<<<<<<< Updated upstream
                <textarea id="text-input" rows="12" class="w-full bg-gray-900 border border-gray-600 text-gray-300 rounded-lg p-2.5 font-sans" placeholder="Start typing here..." data-i18n-placeholder="toolInterface.txtToPdf.placeholder"></textarea>
=======
                <textarea id="text-input" rows="12" class="w-full bg-gray-900 border border-gray-600 text-gray-300 rounded-lg p-2.5 font-sans" placeholder="Hier mit der Eingabe beginnen..."></textarea>
>>>>>>> Stashed changes
            </div>
        </div>
        
        <div class="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
<<<<<<< Updated upstream
                <label for="font-family" class="block mb-2 text-sm font-medium text-gray-300" data-i18n="toolInterface.txtToPdf.fontFamily">Font Family</label>
=======
                <label for="font-family" class="block mb-2 text-sm font-medium text-gray-300">Schriftfamilie</label>
>>>>>>> Stashed changes
                <select id="font-family" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                    <option value="Helvetica">Helvetica</option>
                    <option value="TimesRoman">Times New Roman</option>
                    <option value="Courier">Courier</option>
                </select>
            </div>
            <div>
<<<<<<< Updated upstream
                <label for="font-size" class="block mb-2 text-sm font-medium text-gray-300" data-i18n="toolInterface.txtToPdf.fontSize">Font Size</label>
                <input type="number" id="font-size" value="12" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
            </div>
            <div>
                <label for="page-size" class="block mb-2 text-sm font-medium text-gray-300" data-i18n="toolInterface.txtToPdf.pageSize">Page Size</label>
=======
                <label for="font-size" class="block mb-2 text-sm font-medium text-gray-300">Schriftgröße</label>
                <input type="number" id="font-size" value="12" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
            </div>
            <div>
                <label for="page-size" class="block mb-2 text-sm font-medium text-gray-300">Seitengröße</label>
>>>>>>> Stashed changes
                <select id="page-size" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                    <option value="A4">A4</option>
                    <option value="Letter">Letter</option>
                </select>
            </div>
            <div>
<<<<<<< Updated upstream
                <label for="text-color" class="block mb-2 text-sm font-medium text-gray-300" data-i18n="toolInterface.txtToPdf.textColor">Text Color</label>
                <input type="color" id="text-color" value="#000000" class="w-full h-[42px] bg-gray-700 border border-gray-600 rounded-lg p-1 cursor-pointer">
            </div>
        </div>
        <button id="process-btn" class="btn-gradient mt-6" data-i18n="toolInterface.txtToPdf.button">Create PDF</button>
    `,
    'invert-colors': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.invertColors.title">Invert PDF Colors</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.invertColors.description">Convert your PDF to a "dark mode" by inverting its colors. This works best on simple text and image documents.</p>
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="hidden btn-gradient mt-6">Invert Colors & Download</button>
    `,
    'view-metadata': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.viewMetadata.title">View PDF Metadata</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.viewMetadata.description">Upload a PDF to view its internal properties, such as Title, Author, and Creation Date.</p>
=======
                <label for="text-color" class="block mb-2 text-sm font-medium text-gray-300">Textfarbe</label>
                <input type="color" id="text-color" value="#000000" class="w-full h-[42px] bg-gray-700 border border-gray-600 rounded-lg p-1 cursor-pointer">
            </div>
        </div>
        <button id="process-btn" class="btn-gradient w-full mt-6">PDF erstellen</button>
    `,
    'invert-colors': () => `
        <h2 class="text-2xl font-bold text-white mb-4">PDF-Farben invertieren</h2>
        <p class="mb-6 text-gray-400">Konvertieren Sie Ihre PDF in einen "Dunkelmodus", indem Sie die Farben invertieren. Dies funktioniert am besten bei einfachen Text- und Bilddokumenten.</p>
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="hidden btn-gradient w-full mt-6">Farben invertieren & Herunterladen</button>
    `,
    'view-metadata': () => `
        <h2 class="text-2xl font-bold text-white mb-4">PDF-Metadaten anzeigen</h2>
        <p class="mb-6 text-gray-400">Laden Sie eine PDF hoch, um ihre internen Eigenschaften wie Titel, Autor und Erstellungsdatum anzuzeigen.</p>
>>>>>>> Stashed changes
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <div id="metadata-results" class="hidden mt-6 p-4 bg-gray-900 border border-gray-700 rounded-lg"></div>
    `,
    'reverse-pages': () => `
<<<<<<< Updated upstream
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.reversePages.title">Reverse PDF Pages</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.reversePages.description">Flip the order of all pages in your document, making the last page the first.</p>
        ${createFileInputHTML({ multiple: true, accept: 'application/pdf', showControls: true })}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="hidden btn-gradient mt-6">Reverse & Download</button>
    `,
    'md-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.mdToPdf.title">Markdown to PDF</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.mdToPdf.description">Write in Markdown, select your formatting options, and get a high-quality, multi-page PDF. <br><strong class="text-gray-300">Note:</strong> Images linked from the web (e.g., https://...) require an internet connection to be rendered.</p>
=======
        <h2 class="text-2xl font-bold text-white mb-4">PDF-Seiten umkehren</h2>
        <p class="mb-6 text-gray-400">Kehren Sie die Reihenfolge aller Seiten in Ihrem Dokument um, sodass die letzte Seite zur ersten wird.</p>
        ${createFileInputHTML({ multiple: true, accept: 'application/pdf', showControls: true })}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="hidden btn-gradient w-full mt-6">Umkehren & Herunterladen</button>
    `,
    'md-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4">Markdown zu PDF</h2>
        <p class="mb-6 text-gray-400">Schreiben Sie in Markdown, wählen Sie Ihre Formatierungsoptionen und erhalten Sie eine hochwertige, mehrseitige PDF. <br><strong class="text-gray-300">Hinweis:</strong> Für Bilder aus dem Web (z.B. https://...) ist eine Internetverbindung erforderlich.</p>
>>>>>>> Stashed changes
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
                <label for="page-format" class="block mb-2 text-sm font-medium text-gray-300">Seitenformat</label>
                <select id="page-format" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                    <option value="a4">A4</option>
                    <option value="letter">Letter</option>
                </select>
            </div>
            <div>
                <label for="orientation" class="block mb-2 text-sm font-medium text-gray-300">Ausrichtung</label>
                <select id="orientation" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                    <option value="portrait">Hochformat</option>
                    <option value="landscape">Querformat</option>
                </select>
            </div>
            <div>
                <label for="margin-size" class="block mb-2 text-sm font-medium text-gray-300">Randgröße</label>
                <select id="margin-size" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                    <option value="normal">Normal</option>
                    <option value="narrow">Schmal</option>
                    <option value="wide">Breit</option>
                </select>
            </div>
        </div>
        <div class="h-[50vh]">
            <label for="md-input" class="block mb-2 text-sm font-medium text-gray-300">Markdown-Editor</label>
            <textarea id="md-input" class="w-full h-full bg-gray-900 border border-gray-600 text-gray-300 rounded-lg p-3 font-mono resize-none" placeholder="# Willkommen bei Markdown..."></textarea>
        </div>
<<<<<<< Updated upstream
        <button id="process-btn" class="btn-gradient mt-6" data-i18n="toolInterface.mdToPdf.button">
            <i data-lucide="file-output" class="w-5 h-5"></i>
            Create PDF from Markdown
        </button>
    `,
    'svg-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.svgToPdf.title">SVG to PDF</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.svgToPdf.description">Convert one or more SVG vector images into a single PDF file.</p>
        ${createFileInputHTML({ multiple: true, accept: 'image/svg+xml', showControls: true })}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="btn-gradient mt-6" data-i18n="toolInterface.svgToPdf.button">
            <i data-lucide="file-output" class="w-5 h-5"></i>
            Convert to PDF
        </button>
    `,
    'bmp-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.bmpToPdf.title">BMP to PDF</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.bmpToPdf.description">Convert one or more BMP images into a single PDF file.</p>
        ${createFileInputHTML({ multiple: true, accept: 'image/bmp', showControls: true })}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="btn-gradient mt-6" data-i18n="toolInterface.bmpToPdf.button">
            <i data-lucide="file-output" class="w-5 h-5"></i>
            Convert to PDF
        </button>
    `,
    'heic-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.heicToPdf.title">HEIC to PDF</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.heicToPdf.description">Convert one or more HEIC (High Efficiency) images from your iPhone or camera into a single PDF file.</p>
        ${createFileInputHTML({ multiple: true, accept: '.heic,.heif', showControls: true })}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="btn-gradient mt-6" data-i18n="toolInterface.heicToPdf.button">
            <i data-lucide="file-output" class="w-5 h-5"></i>
            Convert to PDF
        </button>
    `,
    'tiff-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.tiffToPdf.title">TIFF to PDF</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.tiffToPdf.description">Convert one or more single or multi-page TIFF images into a single PDF file.</p>
        ${createFileInputHTML({ multiple: true, accept: 'image/tiff', showControls: true })}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="btn-gradient mt-6" data-i18n="toolInterface.tiffToPdf.button">
            <i data-lucide="file-output" class="w-5 h-5"></i>
            Convert to PDF
        </button>
    `,
    'pdf-to-bmp': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.pdfToBmp.title">PDF to BMP</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.pdfToBmp.description">Convert each page of a PDF file into a BMP image. Your files will be downloaded in a ZIP archive.</p>
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="btn-gradient mt-6" data-i18n="toolInterface.pdfToBmp.button">
            <i data-lucide="download" class="w-5 h-5"></i>
            Convert to BMP & Download ZIP
        </button>
=======
        <button id="process-btn" class="btn-gradient w-full mt-6">PDF aus Markdown erstellen</button>
    `,
    'svg-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4">SVG zu PDF</h2>
        <p class="mb-6 text-gray-400">Konvertieren Sie ein oder mehrere SVG-Vektorbilder in eine einzelne PDF-Datei.</p>
        ${createFileInputHTML({ multiple: true, accept: 'image/svg+xml', showControls: true })}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="btn-gradient w-full mt-6">In PDF konvertieren</button>
    `,
    'bmp-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4">BMP zu PDF</h2>
        <p class="mb-6 text-gray-400">Konvertieren Sie ein oder mehrere BMP-Bilder in eine einzelne PDF-Datei.</p>
        ${createFileInputHTML({ multiple: true, accept: 'image/bmp', showControls: true })}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="btn-gradient w-full mt-6">In PDF konvertieren</button>
    `,
    'heic-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4">HEIC zu PDF</h2>
        <p class="mb-6 text-gray-400">Konvertieren Sie ein oder mehrere HEIC-Bilder (High Efficiency) von Ihrem iPhone oder Ihrer Kamera in eine einzelne PDF-Datei.</p>
        ${createFileInputHTML({ multiple: true, accept: '.heic,.heif', showControls: true })}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="btn-gradient w-full mt-6">In PDF konvertieren</button>
    `,
    'tiff-to-pdf': () => `
        <h2 class="text-2xl font-bold text-white mb-4">TIFF zu PDF</h2>
        <p class="mb-6 text-gray-400">Konvertieren Sie ein oder mehrere ein- oder mehrseitige TIFF-Bilder in eine einzelne PDF-Datei.</p>
        ${createFileInputHTML({ multiple: true, accept: 'image/tiff', showControls: true })}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="btn-gradient w-full mt-6">In PDF konvertieren</button>
    `,
    'pdf-to-bmp': () => `
        <h2 class="text-2xl font-bold text-white mb-4">PDF zu BMP</h2>
        <p class="mb-6 text-gray-400">Konvertieren Sie jede Seite einer PDF-Datei in ein BMP-Bild. Ihre Dateien werden als ZIP-Archiv heruntergeladen.</p>
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="btn-gradient w-full mt-6">In BMP konvertieren & ZIP herunterladen</button>
>>>>>>> Stashed changes
    `,
    'pdf-to-tiff': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.pdfToTiff.title">PDF to TIFF</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.pdfToTiff.description">Convert each page of a PDF file into a high-quality TIFF image. Your files will be downloaded in a ZIP archive.</p>
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <button id="process-btn" class="btn-gradient mt-6">Convert to TIFF & Download ZIP</button>
    `,

    'split-in-half': () => `
<<<<<<< Updated upstream
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.splitInHalf.title">Split Pages in Half</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.splitInHalf.description">Choose a method to divide every page of your document into two separate pages.</p>
=======
        <h2 class="text-2xl font-bold text-white mb-4">Seiten halbieren</h2>
        <p class="mb-6 text-gray-400">Wählen Sie eine Methode, um jede Seite Ihres Dokuments in zwei separate Seiten zu teilen.</p>
>>>>>>> Stashed changes
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>

        <div id="split-half-options" class="hidden mt-6">
            <label for="split-type" class="block mb-2 text-sm font-medium text-gray-300">Teilungstyp wählen</label>
            <select id="split-type" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5 mb-6">
                <option value="vertical">Vertikal teilen (linke & rechte Hälfte)</option>
                <option value="horizontal">Horizontal teilen (obere & untere Hälfte)</option>
            </select>

<<<<<<< Updated upstream
            <button id="process-btn" class="btn-gradient mt-6">Split PDF</button>
        </div>
    `,
    'page-dimensions': () => `
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.pageDimensions.title">Analyze Page Dimensions</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.pageDimensions.description">Upload a PDF to see the precise dimensions, standard size, and orientation of every page.</p>
=======
            <button id="process-btn" class="btn-gradient w-full mt-6">PDF teilen</button>
        </div>
    `,
    'page-dimensions': () => `
        <h2 class="text-2xl font-bold text-white mb-4">Seitenmaße analysieren</h2>
        <p class="mb-6 text-gray-400">Laden Sie ein PDF hoch, um die genauen Abmessungen, Standardgröße und Ausrichtung jeder Seite zu sehen.</p>
>>>>>>> Stashed changes
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>

        <div id="dimensions-results" class="hidden mt-6">
            <!-- Summary Statistics Panel -->
            <div id="dimensions-summary" class="mb-6"></div>

            <!-- Controls Row -->
            <div class="flex flex-wrap justify-between items-center gap-4 mb-4">
                <div class="flex items-center gap-3">
                    <label for="units-select" class="text-sm font-medium text-gray-300">Anzeigeeinheiten:</label>
                    <select id="units-select" class="bg-gray-700 border border-gray-600 text-white rounded-lg p-2">
                        <option value="pt" selected>Punkte (pt)</option>
                        <option value="in">Zoll (in)</option>
                        <option value="mm">Millimeter (mm)</option>
                        <option value="px">Pixel (bei 96 DPI)</option>
                    </select>
                </div>
                <button id="export-csv-btn" class="btn bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2">
                    <i data-lucide="download" class="w-4 h-4"></i>
                    Als CSV exportieren
                </button>
            </div>

            <!-- Dimensions Table -->
            <div class="overflow-x-auto rounded-lg border border-gray-700">
                <table class="min-w-full divide-y divide-gray-700 text-sm text-left">
                    <thead class="bg-gray-900">
                        <tr>
                            <th class="px-4 py-3 font-medium text-white">Seite #</th>
                            <th class="px-4 py-3 font-medium text-white">Abmessungen (B x H)</th>
                            <th class="px-4 py-3 font-medium text-white">Standardgröße</th>
                            <th class="px-4 py-3 font-medium text-white">Ausrichtung</th>
                            <th class="px-4 py-3 font-medium text-white">Seitenverhältnis</th>
                            <th class="px-4 py-3 font-medium text-white">Fläche</th>
                            <th class="px-4 py-3 font-medium text-white">Rotation</th>
                        </tr>
                    </thead>
                    <tbody id="dimensions-table-body" class="divide-y divide-gray-700">
                        </tbody>
                </table>
            </div>
        </div>
    `,


    'n-up': () => `
<<<<<<< Updated upstream
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.nUp.title">N-Up Page Arrangement</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.nUp.description">Combine multiple pages from your PDF onto a single sheet. This is great for creating booklets or proof sheets.</p>
=======
        <h2 class="text-2xl font-bold text-white mb-4">N-Up Seitenanordnung</h2>
        <p class="mb-6 text-gray-400">Kombinieren Sie mehrere Seiten Ihres PDFs auf einem einzelnen Blatt. Ideal für Broschüren oder Übersichtsbögen.</p>
>>>>>>> Stashed changes
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>

        <div id="n-up-options" class="hidden mt-6 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label for="pages-per-sheet" class="block mb-2 text-sm font-medium text-gray-300">Seiten pro Blatt</label>
                    <select id="pages-per-sheet" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                        <option value="2">2-Up</option>
                        <option value="4" selected>4-Up (2x2)</option>
                        <option value="9">9-Up (3x3)</option>
                        <option value="16">16-Up (4x4)</option>
                    </select>
                </div>
                <div>
                    <label for="output-page-size" class="block mb-2 text-sm font-medium text-gray-300">Ausgabe-Seitengröße</label>
                    <select id="output-page-size" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                        <option value="Letter">Letter (8.5 x 11 in)</option>
                        <option value="Legal">Legal (8.5 x 14 in)</option>
                        <option value="Tabloid">Tabloid (11 x 17 in)</option>
                        <option value="A4" selected>A4 (210 x 297 mm)</option>
                        <option value="A3">A3 (297 x 420 mm)</option>
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                    <label for="output-orientation" class="block mb-2 text-sm font-medium text-gray-300">Ausgabe-Ausrichtung</label>
                    <select id="output-orientation" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                        <option value="auto" selected>Automatisch</option>
                        <option value="portrait">Hochformat</option>
                        <option value="landscape">Querformat</option>
                    </select>
                </div>
                <div class="flex items-end pb-1">
                     <label class="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <input type="checkbox" id="add-margins" checked class="w-4 h-4 rounded text-orange-600 bg-gray-700 border-gray-600 focus:ring-orange-500">
                        Ränder & Abstände hinzufügen
                    </label>
                </div>
            </div>

            <div class="border-t border-gray-700 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="flex items-center">
                     <label class="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <input type="checkbox" id="add-border" class="w-4 h-4 rounded text-orange-600 bg-gray-700 border-gray-600 focus:ring-orange-500">
                        Rahmen um jede Seite zeichnen
                    </label>
                </div>
                 <div id="border-color-wrapper" class="hidden">
                    <label for="border-color" class="block mb-2 text-sm font-medium text-gray-300">Rahmenfarbe</label>
                     <input type="color" id="border-color" value="#000000" class="w-full h-[42px] bg-gray-700 border border-gray-600 rounded-lg p-1 cursor-pointer">
                </div>
            </div>

<<<<<<< Updated upstream
            <button id="process-btn" class="btn-gradient mt-6">Create N-Up PDF</button>
=======
            <button id="process-btn" class="btn-gradient w-full mt-6">N-Up PDF erstellen</button>
>>>>>>> Stashed changes
        </div>
    `,

    'duplicate-organize': () => `
<<<<<<< Updated upstream
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.duplicateOrganize.title">Page Manager</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.duplicateOrganize.description">Drag pages to reorder them. Use the <i data-lucide="copy-plus" class="inline-block w-4 h-4 text-green-400"></i> icon to duplicate a page or the <i data-lucide="x-circle" class="inline-block w-4 h-4 text-red-400"></i> icon to delete it.</p>
=======
        <h2 class="text-2xl font-bold text-white mb-4">Seiten-Manager</h2>
        <p class="mb-6 text-gray-400">Ziehen Sie Seiten zum Neuordnen. Verwenden Sie das <i data-lucide="copy-plus" class="inline-block w-4 h-4 text-green-400"></i> Symbol zum Duplizieren oder das <i data-lucide="x-circle" class="inline-block w-4 h-4 text-red-400"></i> Symbol zum Löschen einer Seite.</p>
>>>>>>> Stashed changes
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>

        <div id="page-manager-options" class="hidden mt-6">
             <div id="page-grid" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 my-6">
                </div>
<<<<<<< Updated upstream
             <button id="process-btn" class="btn-gradient mt-6">Save New PDF</button>
=======
             <button id="process-btn" class="btn-gradient w-full mt-6">Neues PDF speichern</button>
>>>>>>> Stashed changes
        </div>
    `,

    'combine-single-page': () => `
<<<<<<< Updated upstream
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.combineSinglePage.title">Combine to a Single Page</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.combineSinglePage.description">Stitch all pages of your PDF together vertically or horizontally to create one continuous page.</p>
=======
        <h2 class="text-2xl font-bold text-white mb-4">Zu einer Seite kombinieren</h2>
        <p class="mb-6 text-gray-400">Fügen Sie alle Seiten Ihres PDFs vertikal oder horizontal zu einer durchgehenden Seite zusammen.</p>
>>>>>>> Stashed changes
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>

        <div id="combine-options" class="hidden mt-6 space-y-4">
            <div>
                <label for="combine-orientation" class="block mb-2 text-sm font-medium text-gray-300">Ausrichtung</label>
                <select id="combine-orientation" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                    <option value="vertical" selected>Vertikal (Seiten von oben nach unten stapeln)</option>
                    <option value="horizontal">Horizontal (Seiten von links nach rechts stapeln)</option>
                </select>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label for="page-spacing" class="block mb-2 text-sm font-medium text-gray-300">Abstand zwischen Seiten (in Punkten)</label>
                    <input type="number" id="page-spacing" value="18" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                </div>
                <div>
                    <label for="background-color" class="block mb-2 text-sm font-medium text-gray-300">Hintergrundfarbe</label>
                    <input type="color" id="background-color" value="#FFFFFF" class="w-full h-[42px] bg-gray-700 border border-gray-600 rounded-lg p-1 cursor-pointer">
                </div>
            </div>
            
            <div>
                <label class="flex items-center gap-2 text-sm font-medium text-gray-300">
                    <input type="checkbox" id="add-separator" class="w-4 h-4 rounded text-orange-600 bg-gray-700 border-gray-600 focus:ring-orange-500">
                    Trennlinie zwischen Seiten zeichnen
                </label>
            </div>
            
            <div id="separator-options" class="hidden grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-gray-900 border border-gray-700">
                <div>
                    <label for="separator-thickness" class="block mb-2 text-sm font-medium text-gray-300">Trennlinienstärke (in Punkten)</label>
                    <input type="number" id="separator-thickness" value="0.5" min="0.1" max="10" step="0.1" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                </div>
                <div>
                    <label for="separator-color" class="block mb-2 text-sm font-medium text-gray-300">Trennlinienfarbe</label>
                    <input type="color" id="separator-color" value="#CCCCCC" class="w-full h-[42px] bg-gray-700 border border-gray-600 rounded-lg p-1 cursor-pointer">
                </div>
            </div>
            
<<<<<<< Updated upstream
            <button id="process-btn" class="btn-gradient mt-6">Combine Pages</button>
=======
            <button id="process-btn" class="btn-gradient w-full mt-6">Seiten kombinieren</button>
>>>>>>> Stashed changes
        </div>
    `,

    'fix-dimensions': () => `
<<<<<<< Updated upstream
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.fixDimensions.title">Standardize Page Dimensions</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.fixDimensions.description">Convert all pages in your PDF to a uniform size. Choose a standard format or define a custom dimension.</p>
=======
        <h2 class="text-2xl font-bold text-white mb-4">Seitenmaße standardisieren</h2>
        <p class="mb-6 text-gray-400">Konvertieren Sie alle Seiten Ihres PDFs auf eine einheitliche Größe. Wählen Sie ein Standardformat oder definieren Sie eine benutzerdefinierte Abmessung.</p>
>>>>>>> Stashed changes
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>

        <div id="fix-dimensions-options" class="hidden mt-6 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label for="target-size" class="block mb-2 text-sm font-medium text-gray-300">Zielgröße</label>
                    <select id="target-size" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                        <option value="A4" selected>A4</option>
                        <option value="Letter">Letter</option>
                        <option value="Legal">Legal</option>
                        <option value="Tabloid">Tabloid</option>
                        <option value="A3">A3</option>
                        <option value="A5">A5</option>
                        <option value="Custom">Benutzerdefinierte Größe...</option>
                    </select>
                </div>
                <div>
                    <label for="orientation" class="block mb-2 text-sm font-medium text-gray-300">Ausrichtung</label>
                    <select id="orientation" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                        <option value="portrait" selected>Hochformat</option>
                        <option value="landscape">Querformat</option>
                    </select>
                </div>
            </div>

            <div id="custom-size-wrapper" class="hidden p-4 rounded-lg bg-gray-900 border border-gray-700 grid grid-cols-3 gap-3">
                <div>
                    <label for="custom-width" class="block mb-2 text-xs font-medium text-gray-300">Breite</label>
                    <input type="number" id="custom-width" value="8.5" class="w-full bg-gray-700 border-gray-600 text-white rounded-lg p-2">
                </div>
                <div>
                    <label for="custom-height" class="block mb-2 text-xs font-medium text-gray-300">Höhe</label>
                    <input type="number" id="custom-height" value="11" class="w-full bg-gray-700 border-gray-600 text-white rounded-lg p-2">
                </div>
                <div>
                    <label for="custom-units" class="block mb-2 text-xs font-medium text-gray-300">Einheiten</label>
                    <select id="custom-units" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2">
                        <option value="in">Zoll</option>
                        <option value="mm">Millimeter</option>
                    </select>
                </div>
            </div>

            <div>
                <label class="block mb-2 text-sm font-medium text-gray-300">Skalierungsmethode für Inhalt</label>
                <div class="flex gap-4 p-2 rounded-lg bg-gray-900">
                    <label class="flex-1 flex items-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer">
                        <input type="radio" name="scaling-mode" value="fit" checked class="w-4 h-4 text-orange-600 bg-gray-700 border-gray-600 focus:ring-orange-500">
                        <div>
                            <span class="font-semibold text-white">Einpassen</span>
                            <p class="text-xs text-gray-400">Behält gesamten Inhalt bei, kann weiße Balken hinzufügen.</p>
                        </div>
                    </label>
                    <label class="flex-1 flex items-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer">
                        <input type="radio" name="scaling-mode" value="fill" class="w-4 h-4 text-orange-600 bg-gray-700 border-gray-600 focus:ring-orange-500">
                         <div>
                            <span class="font-semibold text-white">Ausfüllen</span>
                            <p class="text-xs text-gray-400">Bedeckt die Seite, kann Inhalt beschneiden.</p>
                        </div>
                    </label>
                </div>
            </div>

             <div>
                <label for="background-color" class="block mb-2 text-sm font-medium text-gray-300">Hintergrundfarbe (für 'Einpassen'-Modus)</label>
                <input type="color" id="background-color" value="#FFFFFF" class="w-full h-[42px] bg-gray-700 border border-gray-600 rounded-lg p-1 cursor-pointer">
            </div>

<<<<<<< Updated upstream
            <button id="process-btn" class="btn-gradient mt-6">Standardize Pages</button>
=======
            <button id="process-btn" class="btn-gradient w-full mt-6">Seiten standardisieren</button>
>>>>>>> Stashed changes
        </div>
    `,

    'change-background-color': () => `
<<<<<<< Updated upstream
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.backgroundColor.title">Change Background Color</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.backgroundColor.description">Select a new background color for every page of your PDF.</p>
=======
        <h2 class="text-2xl font-bold text-white mb-4">Hintergrundfarbe ändern</h2>
        <p class="mb-6 text-gray-400">Wählen Sie eine neue Hintergrundfarbe für jede Seite Ihres PDFs.</p>
>>>>>>> Stashed changes
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <div id="change-background-color-options" class="hidden mt-6">
            <label for="background-color" class="block mb-2 text-sm font-medium text-gray-300">Hintergrundfarbe wählen</label>
            <input type="color" id="background-color" value="#FFFFFF" class="w-full h-[42px] bg-gray-700 border border-gray-600 rounded-lg p-1 cursor-pointer">
<<<<<<< Updated upstream
            <button id="process-btn" class="btn-gradient mt-6">Apply Color & Download</button>
=======
            <button id="process-btn" class="btn-gradient w-full mt-6">Farbe anwenden & herunterladen</button>
>>>>>>> Stashed changes
        </div>
    `,

    'change-text-color': () => `
<<<<<<< Updated upstream
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.textColor.title">Change Text Color</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.textColor.description">Change the color of dark text in your PDF. This process converts pages to images, so text will not be selectable in the final file.</p>
=======
        <h2 class="text-2xl font-bold text-white mb-4">Textfarbe ändern</h2>
        <p class="mb-6 text-gray-400">Ändern Sie die Farbe von dunklem Text in Ihrem PDF. Dieser Prozess konvertiert Seiten zu Bildern, sodass Text in der endgültigen Datei nicht auswählbar ist.</p>
>>>>>>> Stashed changes
        ${createFileInputHTML()}
        <div id="file-display-area" class="mt-4 space-y-2"></div>
        <div id="text-color-options" class="hidden mt-6 space-y-4">
            <div>
                <label for="text-color-input" class="block mb-2 text-sm font-medium text-gray-300">Textfarbe wählen</label>
                <input type="color" id="text-color-input" value="#FF0000" class="w-full h-[42px] bg-gray-700 border border-gray-600 rounded-lg p-1 cursor-pointer">
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div class="text-center">
                    <h3 class="font-semibold text-white mb-2">Original</h3>
                    <canvas id="original-canvas" class="w-full h-auto rounded-lg border-2 border-gray-600"></canvas>
                </div>
                <div class="text-center">
                    <h3 class="font-semibold text-white mb-2">Vorschau</h3>
                    <canvas id="text-color-canvas" class="w-full h-auto rounded-lg border-2 border-gray-600"></canvas>
                </div>
            </div>
<<<<<<< Updated upstream
            <button id="process-btn" class="btn-gradient mt-6">Apply Color & Download</button>
=======
            <button id="process-btn" class="btn-gradient w-full mt-6">Farbe anwenden & herunterladen</button>
>>>>>>> Stashed changes
        </div>
    `,

    'compare-pdfs': () => `
<<<<<<< Updated upstream
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.comparePdfs.title">Compare PDFs</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.comparePdfs.description">Upload two files to visually compare them using either an overlay or a side-by-side view.</p>
=======
        <h2 class="text-2xl font-bold text-white mb-4">PDFs vergleichen</h2>
        <p class="mb-6 text-gray-400">Laden Sie zwei Dateien hoch, um sie visuell mit einer Überlagerung oder Seite-an-Seite-Ansicht zu vergleichen.</p>
>>>>>>> Stashed changes
        
        <div id="compare-upload-area" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div id="drop-zone-1" class="relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer bg-gray-900 hover:bg-gray-700">
                <div id="file-display-1" class="flex flex-col items-center justify-center pt-5 pb-6">
                    <i data-lucide="file-scan" class="w-10 h-10 mb-3 text-gray-400"></i>
<<<<<<< Updated upstream
                    <p class="mb-2 text-sm text-gray-400"><span class="font-semibold" data-i18n="toolInterface.comparePdfs.uploadOriginalPdf">Upload Original PDF</span></p>
=======
                    <p class="mb-2 text-sm text-gray-400"><span class="font-semibold">Original-PDF hochladen</span></p>
>>>>>>> Stashed changes
                </div>
                <input id="file-input-1" type="file" class="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" accept="application/pdf">
            </div>
            <div id="drop-zone-2" class="relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer bg-gray-900 hover:bg-gray-700">
                <div id="file-display-2" class="flex flex-col items-center justify-center pt-5 pb-6">
                    <i data-lucide="file-diff" class="w-10 h-10 mb-3 text-gray-400"></i>
<<<<<<< Updated upstream
                    <p class="mb-2 text-sm text-gray-400"><span class="font-semibold" data-i18n="toolInterface.comparePdfs.uploadRevisedPdf">Upload Revised PDF</span></p>
=======
                    <p class="mb-2 text-sm text-gray-400"><span class="font-semibold">Überarbeitetes PDF hochladen</span></p>
>>>>>>> Stashed changes
                </div>
                <input id="file-input-2" type="file" class="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" accept="application/pdf">
            </div>
        </div>

        <div id="compare-viewer" class="hidden mt-6">
            <div class="flex flex-wrap items-center justify-center gap-4 mb-4 p-3 bg-gray-900 rounded-lg border border-gray-700">
                <button id="prev-page-compare" class="btn p-2 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50"><i data-lucide="chevron-left"></i></button>
                <span class="text-white font-medium">Seite <span id="current-page-display-compare">1</span> von <span id="total-pages-display-compare">1</span></span>
                <button id="next-page-compare" class="btn p-2 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50"><i data-lucide="chevron-right"></i></button>
                <div class="border-l border-gray-600 h-6 mx-2"></div>
                <div class="bg-gray-700 p-1 rounded-md flex gap-1">
                    <button id="view-mode-overlay" class="btn bg-orange-600 px-3 py-1 rounded text-sm font-semibold">Überlagerung</button>
                    <button id="view-mode-side" class="btn px-3 py-1 rounded text-sm font-semibold">Seite-an-Seite</button>
                </div>
                <div class="border-l border-gray-600 h-6 mx-2"></div>
                <div id="overlay-controls" class="flex items-center gap-2">
                    <button id="flicker-btn" class="btn bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-md text-sm font-semibold">Flimmern</button>
                    <label for="opacity-slider" class="text-sm font-medium text-gray-300">Deckkraft:</label>
                    <input type="range" id="opacity-slider" min="0" max="1" step="0.05" value="0.5" class="w-24">
                </div>
                <div id="side-by-side-controls" class="hidden flex items-center gap-2">
                    <label class="flex items-center gap-2 text-sm font-medium text-gray-300 cursor-pointer">
                        <input type="checkbox" id="sync-scroll-toggle" checked class="w-4 h-4 rounded text-orange-600 bg-gray-700 border-gray-600 focus:ring-orange-500">
                        Scrollen synchronisieren
                    </label>
                </div>
            </div>
            <div id="compare-viewer-wrapper" class="compare-viewer-wrapper overlay-mode">
                <div id="panel-1" class="pdf-panel"><canvas id="canvas-compare-1"></canvas></div>
                <div id="panel-2" class="pdf-panel"><canvas id="canvas-compare-2"></canvas></div>
            </div>
        </div>
    `,

    'ocr-pdf': () => `
<<<<<<< Updated upstream
    <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.ocr.title">OCR PDF</h2>
    <p class="mb-6 text-gray-400" data-i18n="toolInterface.ocr.description">Convert scanned PDFs into searchable documents. Select one or more languages present in your file for the best results.</p>
=======
    <h2 class="text-2xl font-bold text-white mb-4">OCR PDF</h2>
    <p class="mb-6 text-gray-400">Konvertieren Sie gescannte PDFs in durchsuchbare Dokumente. Wählen Sie eine oder mehrere Sprachen in Ihrer Datei für beste Ergebnisse.</p>
>>>>>>> Stashed changes
    
    <div class="p-3 bg-gray-900 rounded-lg border border-gray-700 mb-6">
        <p class="text-sm text-gray-300"><strong class="text-white">So funktioniert es:</strong></p>
        <ul class="list-disc list-inside text-xs text-gray-400 mt-1 space-y-1">
            <li><strong class="text-white">Text extrahieren:</strong> Verwendet Tesseract OCR um Text aus gescannten Bildern oder PDFs zu erkennen.</li>
            <li><strong class="text-white">Durchsuchbare Ausgabe:</strong> Erstellt ein neues PDF mit einer unsichtbaren Textebene, wodurch Ihr Dokument vollständig durchsuchbar wird bei Erhaltung des ursprünglichen Erscheinungsbilds.</li>
            <li><strong class="text-white">Zeichenfilterung:</strong> Verwenden Sie Whitelists um unerwünschte Zeichen herauszufiltern und die Genauigkeit für bestimmte Dokumenttypen (Rechnungen, Formulare etc.) zu verbessern.</li>
            <li><strong class="text-white">Mehrsprachige Unterstützung:</strong> Wählen Sie mehrere Sprachen für Dokumente mit gemischtem Sprachinhalt.</li>
        </ul>
    </div>
    
    ${createFileInputHTML()}
    <div id="file-display-area" class="mt-4 space-y-2"></div>
    
    <div id="ocr-options" class="hidden mt-6 space-y-4">
        <div>
            <label class="block mb-2 text-sm font-medium text-gray-300">Sprachen im Dokument</label>
            <div class="relative">
                <input type="text" id="lang-search" class="w-full bg-gray-900 border border-gray-600 text-white rounded-lg p-2.5 mb-2" placeholder="Sprachen suchen...">
                <div id="lang-list" class="max-h-48 overflow-y-auto border border-gray-600 rounded-lg p-2 bg-gray-900">
                    ${Object.entries(tesseractLanguages)
            .map(
                ([code, name]) => `
                        <label class="flex items-center gap-2 p-2 rounded-md hover:bg-gray-700 cursor-pointer">
                            <input type="checkbox" value="${code}" class="lang-checkbox w-4 h-4 rounded text-orange-600 bg-gray-700 border-gray-600 focus:ring-orange-500">
                            ${name}
                        </label>
                    `
            )
            .join('')}
                </div>
            </div>
             <p class="text-xs text-gray-500 mt-1">Ausgewählt: <span id="selected-langs-display" class="font-semibold">Keine</span></p>
        </div>
        
        <!-- Advanced settings section -->
        <details class="bg-gray-900 border border-gray-700 rounded-lg p-3">
            <summary class="text-sm font-medium text-gray-300 cursor-pointer flex items-center justify-between">
                <span>Erweiterte Einstellungen (Empfohlen für bessere Genauigkeit)</span>
                <i data-lucide="chevron-down" class="w-4 h-4 transition-transform details-icon"></i>
            </summary>
            <div class="mt-4 space-y-4">
                <!-- Resolution Setting -->
                <div>
                    <label for="ocr-resolution" class="block mb-1 text-xs font-medium text-gray-400">Auflösung</label>
                    <select id="ocr-resolution" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2 text-sm">
                        <option value="2.0">Standard (192 DPI)</option>
                        <option value="3.0" selected>Hoch (288 DPI)</option>
                        <option value="4.0">Ultra (384 DPI)</option>
                    </select>
                </div>
                <!-- Binarization Toggle -->
                <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="checkbox" id="ocr-binarize" class="w-4 h-4 rounded text-orange-600 bg-gray-700 border-gray-600">
                    Bild binarisieren (Kontrast für saubere Scans verbessern)
                </label>
                
                <!-- Character Whitelist Presets -->
                <div>
                    <label for="whitelist-preset" class="block mb-1 text-xs font-medium text-gray-400">Zeichen-Whitelist Vorlage</label>
                    <select id="whitelist-preset" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2 text-sm mb-2">
                        <option value="">Keine (Alle Zeichen)</option>
                        <option value="alphanumeric">Alphanumerisch + Grundlegende Interpunktion</option>
                        <option value="numbers-currency">Zahlen + Währungssymbole</option>
                        <option value="letters-only">Nur Buchstaben (A-Z, a-z)</option>
                        <option value="numbers-only">Nur Zahlen (0-9)</option>
                        <option value="invoice">Rechnung/Beleg (Zahlen, €, $, ., -, /)</option>
                        <option value="forms">Formulare (Alphanumerisch + Gängige Symbole)</option>
                        <option value="custom">Benutzerdefiniert...</option>
                    </select>
                    <p class="text-xs text-gray-500 mt-1">Nur diese Zeichen werden erkannt. Leer lassen für alle Zeichen.</p>
                </div>
                
                <!-- Character Whitelist Input -->
                <div>
                    <label for="ocr-whitelist" class="block mb-1 text-xs font-medium text-gray-400">Zeichen-Whitelist (Optional)</label>
                    <input type="text" id="ocr-whitelist" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2 text-sm" placeholder="z.B., abcdefghijklmnopqrstuvwxyz0123456789€.,">
                    <p class="text-xs text-gray-500 mt-1">Nur diese Zeichen werden erkannt. Leer lassen für alle Zeichen.</p>
                </div>
            </div>
        </details>
        
<<<<<<< Updated upstream
        <button id="process-btn" class="btn-gradient disabled:opacity-50" disabled>Start OCR</button>
=======
        <button id="process-btn" class="btn-gradient w-full disabled:opacity-50" disabled>OCR starten</button>
>>>>>>> Stashed changes
    </div>

    <div id="ocr-progress" class="hidden mt-6 p-4 bg-gray-900 border border-gray-700 rounded-lg">
        <p id="progress-status" class="text-white mb-2">Initialisierung...</p>
        <div class="w-full bg-gray-700 rounded-full h-4">
            <div id="progress-bar" class="bg-orange-600 h-4 rounded-full transition-width duration-300" style="width: 0%"></div>
        </div>
        <pre id="progress-log" class="mt-4 text-xs text-gray-400 max-h-32 overflow-y-auto bg-black p-2 rounded-md"></pre>
    </div>

    <div id="ocr-results" class="hidden mt-6">
        <h3 class="text-xl font-bold text-white mb-2">OCR abgeschlossen</h3>
        <p class="mb-4 text-gray-400">Ihr durchsuchbares PDF ist fertig. Sie können den extrahierten Text auch kopieren oder herunterladen.</p>
        <div class="relative">
            <textarea id="ocr-text-output" rows="10" class="w-full bg-gray-900 border border-gray-600 text-gray-300 rounded-lg p-2.5 font-sans" readonly></textarea>
            <button id="copy-text-btn" class="absolute top-2 right-2 btn bg-gray-700 hover:bg-gray-600 p-2 rounded-md" title="In Zwischenablage kopieren">
                <i data-lucide="clipboard-copy" class="w-4 h-4 text-gray-300"></i>
            </button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <button id="download-txt-btn" class="btn w-full bg-gray-700 text-white font-semibold py-3 rounded-lg hover:bg-gray-600">Als .txt herunterladen</button>
            <button id="download-searchable-pdf" class="btn w-full bg-green-600 text-white font-semibold py-3 rounded-lg hover:bg-green-700">Durchsuchbares PDF herunterladen</button>
        </div>
    </div>
`,

    'word-to-pdf': () => `
<<<<<<< Updated upstream
        <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.wordToPdf.title">Word to PDF Converter</h2>
        <p class="mb-6 text-gray-400" data-i18n="toolInterface.wordToPdf.description">Upload a .docx file to convert it into a high-quality PDF with selectable text. Complex layouts may not be perfectly preserved.</p>
=======
        <h2 class="text-2xl font-bold text-white mb-4">Word zu PDF Konverter</h2>
        <p class="mb-6 text-gray-400">Laden Sie eine .docx-Datei hoch, um sie in ein hochwertiges PDF mit auswählbarem Text zu konvertieren. Komplexe Layouts werden möglicherweise nicht perfekt beibehalten.</p>
>>>>>>> Stashed changes
        
        <div id="file-input-wrapper">
             <div class="relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer bg-gray-900 hover:bg-gray-700">
                <div class="flex flex-col items-center justify-center pt-5 pb-6">
                    <i data-lucide="file-text" class="w-10 h-10 mb-3 text-gray-400"></i>
<<<<<<< Updated upstream
                    <p class="mb-2 text-sm text-gray-400"><span class="font-semibold" data-i18n="subpages.clickToSelect">Click to select a file</span> <span data-i18n="subpages.orDragDrop">or drag and drop</span></p>
                    <p class="text-xs text-gray-500" data-i18n="subpages.singleDocxFile">A single .docx file</p>
=======
                    <p class="mb-2 text-sm text-gray-400"><span class="font-semibold">Klicken zum Auswählen</span> oder per Drag & Drop</p>
                    <p class="text-xs text-gray-500">Eine einzelne .docx-Datei</p>
>>>>>>> Stashed changes
                </div>
                <input id="file-input" type="file" class="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
            </div>
        </div>
        
        <div id="file-display-area" class="mt-4 space-y-2"></div>
<<<<<<< Updated upstream
        <button id="process-btn" class="btn-gradient mt-6" disabled>Preview & Convert</button>
    `,

    'sign-pdf': () => `
    <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.signPdf.title">Sign PDF</h2>
    <p class="mb-6 text-gray-400" data-i18n="toolInterface.signPdf.description">Upload a PDF to sign it using the built-in PDF.js viewer. Look for the <strong>signature/pen tool</strong> in the toolbar to add your signature.</p>
=======
        <button id="process-btn" class="btn-gradient w-full mt-6" disabled>Vorschau & Konvertieren</button>
    `,

    'sign-pdf': () => `
    <h2 class="text-2xl font-bold text-white mb-4">PDF signieren</h2>
    <p class="mb-6 text-gray-400">Laden Sie ein PDF hoch, um es mit dem integrierten PDF.js-Viewer zu signieren. Suchen Sie nach dem <strong>Signatur-/Stiftwerkzeug</strong> in der Werkzeugleiste, um Ihre Unterschrift hinzuzufügen.</p>
>>>>>>> Stashed changes
    ${createFileInputHTML()}
    <div id="file-display-area" class="mt-4 space-y-2"></div>
    
    <div id="signature-editor" class="hidden mt-6">
        <div id="canvas-container-sign" class="relative w-full overflow-auto bg-gray-900 rounded-lg border border-gray-600" style="height: 85vh;">
            <!-- PDF.js viewer iframe will be loaded here -->
        </div>
        
        <div class="mt-4 flex items-center gap-2">
            <label class="flex items-center gap-2 text-sm font-medium text-gray-300 cursor-pointer">
<<<<<<< Updated upstream
                <input type="checkbox" id="flatten-signature-toggle" class="w-4 h-4 rounded text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500">
                <span data-i18n="toolInterface.signPdf.flattenPdfHint">Flatten PDF (use the Save button below)</span>
            </label>
        </div>

        <button id="process-btn" class="btn-gradient mt-4" style="display:none;">Save & Download Signed PDF</button>
=======
                <input type="checkbox" id="flatten-signature-toggle" class="w-4 h-4 rounded text-orange-600 bg-gray-700 border-gray-600 focus:ring-orange-500">
                PDF glätten (nutzen Sie den Speichern-Button unten)
            </label>
        </div>

        <button id="process-btn" class="btn-gradient w-full mt-4" style="display:none;">Signiertes PDF speichern & herunterladen</button>
>>>>>>> Stashed changes
    </div>
`,

    'remove-annotations': () => `
<<<<<<< Updated upstream
    <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.removeAnnotations.title">Remove Annotations</h2>
    <p class="mb-6 text-gray-400" data-i18n="toolInterface.removeAnnotations.description">Select the types of annotations to remove from all pages or a specific range.</p>
=======
    <h2 class="text-2xl font-bold text-white mb-4">Anmerkungen entfernen</h2>
    <p class="mb-6 text-gray-400">Wählen Sie die Arten von Anmerkungen aus, die von allen Seiten oder einem bestimmten Bereich entfernt werden sollen.</p>
>>>>>>> Stashed changes
    ${createFileInputHTML()}
    <div id="file-display-area" class="mt-4 space-y-2"></div>

    <div id="remove-annotations-options" class="hidden mt-6 space-y-6">
        <div>
            <h3 class="text-lg font-semibold text-white mb-2">1. Seiten wählen</h3>
            <div class="flex gap-4 p-2 rounded-lg bg-gray-900">
                <label class="flex-1 flex items-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer">
                    <input type="radio" name="page-scope" value="all" checked class="w-4 h-4 text-orange-600 bg-gray-700 border-gray-600 focus:ring-orange-500">
                    <span class="font-semibold text-white">Alle Seiten</span>
                </label>
                <label class="flex-1 flex items-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer">
                    <input type="radio" name="page-scope" value="specific" class="w-4 h-4 text-orange-600 bg-gray-700 border-gray-600 focus:ring-orange-500">
                    <span class="font-semibold text-white">Bestimmte Seiten</span>
                </label>
            </div>
            <div id="page-range-wrapper" class="hidden mt-2">
                 <input type="text" id="page-range-input" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder="z.B., 1-3, 5, 8">
                 <p class="text-xs text-gray-400 mt-1">Gesamtseiten: <span id="total-pages"></span></p>
            </div>
        </div>

        <div>
            <h3 class="text-lg font-semibold text-white mb-2">2. Zu entfernende Anmerkungstypen auswählen</h3>
            <div class="space-y-3 p-4 bg-gray-900 rounded-lg border border-gray-700">
                <div class="border-b border-gray-700 pb-2">
                    <label class="flex items-center gap-2 font-semibold text-white cursor-pointer">
                        <input type="checkbox" id="select-all-annotations" class="w-4 h-4 rounded text-orange-600 bg-gray-700 border-gray-600">
                        Alle auswählen / abwählen
                    </label>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 pt-2">
                    <label class="flex items-center gap-2"><input type="checkbox" class="annot-checkbox" value="Highlight"> Hervorhebung</label>
                    <label class="flex items-center gap-2"><input type="checkbox" class="annot-checkbox" value="StrikeOut"> Durchstreichung</label>
                    <label class="flex items-center gap-2"><input type="checkbox" class="annot-checkbox" value="Underline"> Unterstreichung</label>
                    <label class="flex items-center gap-2"><input type="checkbox" class="annot-checkbox" value="Ink"> Freihand / Zeichnung</label>
                    <label class="flex items-center gap-2"><input type="checkbox" class="annot-checkbox" value="Polygon"> Polygon</label>
                    <label class="flex items-center gap-2"><input type="checkbox" class="annot-checkbox" value="Square"> Rechteck</label>
                    <label class="flex items-center gap-2"><input type="checkbox" class="annot-checkbox" value="Circle"> Kreis</label>
                    <label class="flex items-center gap-2"><input type="checkbox" class="annot-checkbox" value="Line"> Linie / Pfeil</label>
                    <label class="flex items-center gap-2"><input type="checkbox" class="annot-checkbox" value="PolyLine"> Polylinie</label>
                    <label class="flex items-center gap-2"><input type="checkbox" class="annot-checkbox" value="Link"> Link</label>
                    <label class="flex items-center gap-2"><input type="checkbox" class="annot-checkbox" value="Text"> Text (Notiz)</label>
                    <label class="flex items-center gap-2"><input type="checkbox" class="annot-checkbox" value="FreeText"> Freier Text</label>
                    <label class="flex items-center gap-2"><input type="checkbox" class="annot-checkbox" value="Popup"> Popup / Kommentar</label>
                    <label class="flex items-center gap-2"><input type="checkbox" class="annot-checkbox" value="Squiggly"> Wellenlinie</label>
                    <label class="flex items-center gap-2"><input type="checkbox" class="annot-checkbox" value="Stamp"> Stempel</label>
                    <label class="flex items-center gap-2"><input type="checkbox" class="annot-checkbox" value="Caret"> Caret</label>
                    <label class="flex items-center gap-2"><input type="checkbox" class="annot-checkbox" value="FileAttachment"> Dateianhang</label>    
                </div>
            </div>
        </div>
    </div>
<<<<<<< Updated upstream
    <button id="process-btn" class="hidden btn-gradient mt-6">Remove Selected Annotations</button>
`,

    cropper: () => `
    <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.cropper.title">PDF Cropper</h2>
    <p class="mb-6 text-gray-400" data-i18n="toolInterface.cropper.description">Upload a PDF to visually crop one or more pages. This tool offers a live preview and two distinct cropping modes.</p>
=======
    <button id="process-btn" class="hidden btn-gradient w-full mt-6">Ausgewählte Anmerkungen entfernen</button>
`,

    cropper: () => `
    <h2 class="text-2xl font-bold text-white mb-4">PDF Zuschneiden</h2>
    <p class="mb-6 text-gray-400">Laden Sie ein PDF hoch, um eine oder mehrere Seiten visuell zuzuschneiden. Dieses Tool bietet eine Live-Vorschau und zwei verschiedene Zuschneidemodi.</p>
>>>>>>> Stashed changes
    
    ${createFileInputHTML()}
    <div id="file-display-area" class="mt-4 space-y-2"></div>
    
    <div id="cropper-ui-container" class="hidden mt-6">
        
        <div class="p-3 bg-gray-900 rounded-lg border border-gray-700 mb-6">
            <p class="text-sm text-gray-300"><strong class="text-white">So funktioniert es:</strong></p>
            <ul class="list-disc list-inside text-xs text-gray-400 mt-1 space-y-1">
                <li><strong class="text-white">Live-Vorschau:</strong> Sehen Sie Ihre Zuschneideauswahl in Echtzeit bevor Sie sie anwenden.</li>
                <li><strong class="text-white">Nicht-destruktiver Modus:</strong> Dies ist der Standardmodus. Er "versteckt" einfach den zugeschnittenen Inhalt durch Anpassung der Seitengrenzen. Die Originaltexte und Daten bleiben in der Datei erhalten.</li>
                <li><strong class="text-white">Destruktiver Modus:</strong> Diese Option entfernt den zugeschnittenen Inhalt dauerhaft durch Abflachung des PDFs. Verwenden Sie dies für maximale Sicherheit und kleinere Dateigröße, beachten Sie jedoch, dass auswählbarer Text entfernt wird.</li>
            </ul>
        </div>
        
        <div class="flex flex-col sm:flex-row items-center justify-between flex-wrap gap-4 mb-4 p-3 bg-gray-900 rounded-lg border border-gray-700">
            <div class="flex items-center gap-2">
                 <button id="prev-page" class="btn p-2 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50"><i data-lucide="chevron-left" class="w-5 h-5"></i></button>
                <span id="page-info" class="text-white font-medium">Seite 0 von 0</span>
                <button id="next-page" class="btn p-2 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50"><i data-lucide="chevron-right" class="w-5 h-5"></i></button>
            </div>
            
            <div class="flex flex-col sm:flex-row items-center gap-4 flex-wrap">
                 <label class="flex items-center gap-2 text-sm font-medium text-gray-300">
                    <input type="checkbox" id="destructive-crop-toggle" class="w-4 h-4 rounded text-orange-600 bg-gray-700 border-gray-600 focus:ring-orange-500">
                    Destruktives Zuschneiden aktivieren
                </label>
                 <label class="flex items-center gap-2 text-sm font-medium text-gray-300">
                    <input type="checkbox" id="apply-to-all-toggle" class="w-4 h-4 rounded text-orange-600 bg-gray-700 border-gray-600 focus:ring-orange-500">
                    Auf alle Seiten anwenden
                </label>
            </div>
        </div>
        
        <div id="status" class="text-center italic text-gray-400 mb-4">Bitte wählen Sie eine PDF-Datei aus, um zu beginnen.</div>
        <div id="cropper-container" class="w-full relative overflow-hidden flex items-center justify-center bg-gray-900 rounded-lg border border-gray-600 min-h-[500px]"></div>
        
        <button id="crop-button" class="btn-gradient w-full mt-6" disabled>Zuschneiden & Herunterladen</button>
    </div>
`,

    'form-filler': () => `
<<<<<<< Updated upstream
    <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.formFiller.title">PDF Form Filler</h2>
    <p class="mb-6 text-gray-400" data-i18n="toolInterface.formFiller.description">Upload a PDF with form fields. Fill them directly in the viewer below, then click the button to save and download the filled form. Also supports XFA forms.</p>
    
    <div class="mb-4 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
      <p class="text-sm text-blue-300">
        <strong>Note on XFA Forms:</strong> XFA (XML Forms Architecture) is a legacy format that's only supported by certain PDF viewers like PDF-Tools and Firefox. 
        If you open an XFA PDF in other software and see blank pages or no form fields, it means that viewer doesn't support XFA. 
        To view and fill XFA forms properly, use Firefox or PDF-Tools' Form Filler.
=======
    <h2 class="text-2xl font-bold text-white mb-4">PDF-Formular ausfüllen</h2>
    <p class="mb-6 text-gray-400">Laden Sie ein PDF mit Formularfeldern hoch. Füllen Sie sie direkt im Viewer unten aus, dann klicken Sie auf den Button, um das ausgefüllte Formular zu speichern und herunterzuladen. Unterstützt auch XFA-Formulare.</p>
    
    <div class="mb-4 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
      <p class="text-sm text-blue-300">
        <strong>Hinweis zu XFA-Formularen:</strong> XFA (XML Forms Architecture) ist ein älteres Format, das nur von bestimmten PDF-Viewern wie PDF Tools und Firefox unterstützt wird. 
        Wenn Sie ein XFA-PDF in anderer Software öffnen und leere Seiten oder keine Formularfelder sehen, bedeutet das, dass dieser Viewer kein XFA unterstützt. 
        Um XFA-Formulare korrekt anzuzeigen und auszufüllen, verwenden Sie Firefox oder den PDF Tools Formular-Füller.
>>>>>>> Stashed changes
      </p>
    </div>
    
    ${createFileInputHTML()}
    <div id="file-display-area" class="mt-4 space-y-2"></div>
    <div id="form-filler-options" class="hidden mt-6">
        <div id="pdf-viewer-container" class="relative w-full overflow-auto bg-gray-900 rounded-lg border border-gray-600" style="height: 80vh;">
            <!-- PDF.js viewer iframe will be loaded here -->
        </div>
<<<<<<< Updated upstream
        <button id="process-btn" class="btn-gradient mt-4">Save & Download Filled Form</button>
=======
        <button id="process-btn" class="btn-gradient w-full mt-4">Ausgefülltes Formular speichern & herunterladen</button>
>>>>>>> Stashed changes
    </div>
`,

    posterize: () => `
<<<<<<< Updated upstream
    <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.posterize.title">Posterize PDF</h2>
    <p class="mb-6 text-gray-400" data-i18n="toolInterface.posterize.description">Split pages into multiple smaller sheets to print as a poster. Navigate the preview and see the grid update based on your settings.</p>
=======
    <h2 class="text-2xl font-bold text-white mb-4">PDF posterisieren</h2>
    <p class="mb-6 text-gray-400">Teilen Sie Seiten in mehrere kleinere Blätter auf, um sie als Poster zu drucken. Navigieren Sie durch die Vorschau und sehen Sie, wie das Raster sich basierend auf Ihren Einstellungen aktualisiert.</p>
>>>>>>> Stashed changes
    ${createFileInputHTML()}
    <div id="file-display-area" class="mt-4 space-y-2"></div>

    <div id="posterize-options" class="hidden mt-6 space-y-6">

        <div class="space-y-2">
             <label class="block text-sm font-medium text-gray-300">Seitenvorschau (<span id="current-preview-page">1</span> / <span id="total-preview-pages">1</span>)</label>
            <div id="posterize-preview-container" class="relative w-full max-w-xl mx-auto bg-gray-900 rounded-lg border-2 border-gray-600 flex items-center justify-center">
                <button id="prev-preview-page" class="absolute left-2 top-1/2 transform -translate-y-1/2 text-white bg-gray-800 bg-opacity-50 rounded-full p-2 hover:bg-gray-700 disabled:opacity-50 z-10"><i data-lucide="chevron-left"></i></button>
                <canvas id="posterize-preview-canvas" class="w-full h-auto rounded-md"></canvas>
                <button id="next-preview-page" class="absolute right-2 top-1/2 transform -translate-y-1/2 text-white bg-gray-800 bg-opacity-50 rounded-full p-2 hover:bg-gray-700 disabled:opacity-50 z-10"><i data-lucide="chevron-right"></i></button>
            </div>
        </div>

        <div class="p-4 bg-gray-900 border border-gray-700 rounded-lg">
            <h3 class="text-lg font-semibold text-white mb-3">Rasterlayout</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label for="posterize-rows" class="block mb-2 text-sm font-medium text-gray-300">Zeilen</label>
                    <input type="number" id="posterize-rows" value="1" min="1" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                </div>
                <div>
                    <label for="posterize-cols" class="block mb-2 text-sm font-medium text-gray-300">Spalten</label>
                    <input type="number" id="posterize-cols" value="2" min="1" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                </div>
            </div>
        </div>

        <div class="p-4 bg-gray-900 border border-gray-700 rounded-lg">
            <h3 class="text-lg font-semibold text-white mb-3">Ausgabe-Seiteneinstellungen</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label for="output-page-size" class="block mb-2 text-sm font-medium text-gray-300">Seitengröße</label>
                    <select id="output-page-size" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                        <option value="A4" selected>A4</option>
                        <option value="Letter">Letter</option>
                        <option value="Legal">Legal</option>
                        <option value="A3">A3</option>
                        <option value="A5">A5</option>
                    </select>
                </div>
                <div>
                    <label for="output-orientation" class="block mb-2 text-sm font-medium text-gray-300">Ausrichtung</label>
                    <select id="output-orientation" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                        <option value="auto" selected>Automatisch (Empfohlen)</option>
                        <option value="portrait">Hochformat</option>
                        <option value="landscape">Querformat</option>
                    </select>
                </div>
            </div>
        </div>

        <div class="p-4 bg-gray-900 border border-gray-700 rounded-lg">
            <h3 class="text-lg font-semibold text-white mb-3">Erweiterte Optionen</h3>
            <div class="space-y-4">
                <div>
                    <label class="block mb-2 text-sm font-medium text-gray-300">Inhaltsskalierung</label>
                    <div class="flex gap-4 p-2 rounded-lg bg-gray-800">
                        <label class="flex-1 flex items-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer has-[:checked]:bg-orange-600">
                            <input type="radio" name="scaling-mode" value="fit" checked class="w-4 h-4 text-orange-600 bg-gray-700 border-gray-600 focus:ring-orange-500">
                            <div>
                                <span class="font-semibold text-white">Einpassen</span>
                                <p class="text-xs text-gray-400">Behält gesamten Inhalt bei, kann Ränder hinzufügen.</p>
                            </div>
                        </label>
                        <label class="flex-1 flex items-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer has-[:checked]:bg-orange-600">
                            <input type="radio" name="scaling-mode" value="fill" class="w-4 h-4 text-orange-600 bg-gray-700 border-gray-600 focus:ring-orange-500">
                             <div>
                                <span class="font-semibold text-white">Ausfüllen (Zuschneiden)</span>
                                <p class="text-xs text-gray-400">Füllt die Seite, kann Inhalt beschneiden.</p>
                            </div>
                        </label>
                    </div>
                </div>
                 <div>
                    <label for="overlap" class="block mb-2 text-sm font-medium text-gray-300">Überlappung (zum Zusammensetzen)</label>
                    <div class="flex items-center gap-2">
                        <input type="number" id="overlap" value="0" min="0" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                        <select id="overlap-units" class="bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5">
                            <option value="pt">Punkte</option>
                            <option value="in">Zoll</option>
                            <option value="mm">mm</option>
                        </select>
                    </div>
                </div>
                 <div>
                    <label for="page-range" class="block mb-2 text-sm font-medium text-gray-300">Seitenbereich (optional)</label>
                    <input type="text" id="page-range" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder="z.B., 1-3, 5">
                    <p class="text-xs text-gray-400 mt-1">Gesamtseiten: <span id="total-pages">0</span></p>
                </div>
            </div>
        </div>

<<<<<<< Updated upstream
        <button id="process-btn" class="btn-gradient mt-6" disabled>Posterize PDF</button>
=======
        <button id="process-btn" class="btn-gradient w-full mt-6" disabled>PDF posterisieren</button>
>>>>>>> Stashed changes
    </div>
`,

    'remove-blank-pages': () => `
<<<<<<< Updated upstream
    <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.removeBlankPages.title">Remove Blank Pages</h2>
    <p class="mb-6 text-gray-400" data-i18n="toolInterface.removeBlankPages.description">Automatically detect and remove blank or nearly blank pages from your PDF. Adjust the sensitivity to control what is considered "blank".</p>
=======
    <h2 class="text-2xl font-bold text-white mb-4">Leere Seiten entfernen</h2>
    <p class="mb-6 text-gray-400">Erkennen und entfernen Sie automatisch leere oder nahezu leere Seiten aus Ihrem PDF. Passen Sie die Empfindlichkeit an, um zu steuern, was als "leer" gilt.</p>
>>>>>>> Stashed changes
    ${createFileInputHTML()}
    <div id="file-display-area" class="mt-4 space-y-2"></div>

    <div id="remove-blank-options" class="hidden mt-6 space-y-4">
        <div>
            <label for="sensitivity-slider" class="block mb-2 text-sm font-medium text-gray-300">
                Empfindlichkeit (<span id="sensitivity-value">99</span>%)
            </label>
            <input type="range" id="sensitivity-slider" min="80" max="100" value="99" class="w-full">
            <p class="text-xs text-gray-400 mt-1">Höhere Empfindlichkeit erfordert, dass Seiten "leerer" sein müssen, um entfernt zu werden.</p>
        </div>
        
        <div id="analysis-preview" class="hidden p-4 bg-gray-900 border border-gray-700 rounded-lg">
             <h3 class="text-lg font-semibold text-white mb-2">Analyseergebnisse</h3>
             <p id="analysis-text" class="text-gray-300"></p>
             <div id="removed-pages-thumbnails" class="mt-4 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2"></div>
        </div>

<<<<<<< Updated upstream
        <button id="process-btn" class="btn-gradient mt-6">Remove Blank Pages & Download</button>
=======
        <button id="process-btn" class="btn-gradient w-full mt-6">Leere Seiten entfernen & herunterladen</button>
>>>>>>> Stashed changes
    </div>
`,

    'alternate-merge': () => `
<<<<<<< Updated upstream
    <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.alternateMix.title">Alternate & Mix Pages</h2>
    <p class="mb-6 text-gray-400" data-i18n="toolInterface.alternateMix.description">Combine pages from 2 or more documents, alternating between them. Drag the files to set the mixing order (e.g., Page 1 from Doc A, Page 1 from Doc B, Page 2 from Doc A, Page 2 from Doc B, etc.).</p>
=======
    <h2 class="text-2xl font-bold text-white mb-4">Seiten alternierend mischen</h2>
    <p class="mb-6 text-gray-400">Kombinieren Sie Seiten aus 2 oder mehr Dokumenten abwechselnd. Ziehen Sie die Dateien, um die Mischreihenfolge festzulegen (z.B. Seite 1 von Dok A, Seite 1 von Dok B, Seite 2 von Dok A, Seite 2 von Dok B, usw.).</p>
>>>>>>> Stashed changes
    ${createFileInputHTML({ multiple: true, accept: 'application/pdf', showControls: true })}
    
    <div id="alternate-merge-options" class="hidden mt-6">
        <div class="p-3 bg-gray-900 rounded-lg border border-gray-700 mb-3">
            <p class="text-sm text-gray-300"><strong class="text-white">So funktioniert es:</strong></p>
            <ul class="list-disc list-inside text-xs text-gray-400 mt-1 space-y-1">
                <li>Das Tool nimmt eine Seite aus jedem Dokument in der unten angegebenen Reihenfolge, dann wiederholt es für die nächste Seite, bis alle Seiten verwendet sind.</li>
                <li>Wenn ein Dokument keine Seiten mehr hat, wird es übersprungen, und das Tool fährt mit den verbleibenden Dokumenten abwechselnd fort.</li>
            </ul>
        </div>
        <ul id="alternate-file-list" class="space-y-2"></ul>
<<<<<<< Updated upstream
        <button id="process-btn" class="btn-gradient mt-6" disabled>Alternate & Mix PDFs</button>
=======
        <button id="process-btn" class="btn-gradient w-full mt-6" disabled>PDFs alternierend mischen</button>
>>>>>>> Stashed changes
    </div>
`,

    linearize: () => `
<<<<<<< Updated upstream
    <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.linearize.title">Linearize PDFs (Fast Web View)</h2>
    <p class="mb-6 text-gray-400" data-i18n="toolInterface.linearize.description">Optimize multiple PDFs for faster loading over the web. Files will be downloaded in a ZIP archive.</p>
    ${createFileInputHTML({ multiple: true, accept: 'application/pdf', showControls: true })} 
    <div id="file-display-area" class="mt-4 space-y-2"></div>
    <button id="process-btn" class="hidden btn-gradient mt-6" disabled>Linearize PDFs & Download ZIP</button> 
  `,
    'add-attachments': () => `
    <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.addAttachments.title">Add Attachments to PDF</h2>
    <p class="mb-6 text-gray-400" data-i18n="toolInterface.addAttachments.description">First, upload the PDF document you want to add files to.</p>
=======
    <h2 class="text-2xl font-bold text-white mb-4">PDFs linearisieren (Schnelle Webansicht)</h2>
    <p class="mb-6 text-gray-400">Optimieren Sie mehrere PDFs für schnelleres Laden im Web. Die Dateien werden als ZIP-Archiv heruntergeladen.</p>
    ${createFileInputHTML({ multiple: true, accept: 'application/pdf', showControls: true })} 
    <div id="file-display-area" class="mt-4 space-y-2"></div>
    <button id="process-btn" class="hidden btn-gradient w-full mt-6" disabled>PDFs linearisieren & ZIP herunterladen</button> 
  `,
    'add-attachments': () => `
    <h2 class="text-2xl font-bold text-white mb-4">Anhänge zu PDF hinzufügen</h2>
    <p class="mb-6 text-gray-400">Laden Sie zuerst das PDF-Dokument hoch, dem Sie Dateien hinzufügen möchten.</p>
>>>>>>> Stashed changes
    ${createFileInputHTML({ accept: 'application/pdf' })}
    <div id="file-display-area" class="mt-4 space-y-2"></div>

    <div id="attachment-options" class="hidden mt-8">
      <h3 class="text-lg font-semibold text-white mb-3">Dateien zum Anhängen hochladen</h3>
      <p class="mb-4 text-gray-400">Wählen Sie eine oder mehrere Dateien aus, die in das PDF eingebettet werden sollen. Sie können jeden Dateityp anhängen (Bilder, Dokumente, Tabellen usw.).</p>
      
      <label for="attachment-files-input" class="w-full flex justify-center items-center px-6 py-10 bg-gray-900 text-gray-400 rounded-lg border-2 border-dashed border-gray-600 hover:bg-gray-800 hover:border-gray-500 cursor-pointer transition-colors">
        <div class="text-center">
          <svg class="mx-auto h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          <span class="mt-2 block text-sm font-medium">Klicken um Dateien hochzuladen</span>
          <span class="mt-1 block text-xs">Jeder Dateityp, mehrere Dateien erlaubt</span>
        </div>
        <input id="attachment-files-input" name="attachment-files" type="file" class="sr-only" multiple>
      </label>

      <div id="attachment-file-list" class="mt-4 space-y-2"></div>

      <div id="attachment-level-options" class="hidden mt-6 space-y-4">
        <div>
          <h3 class="text-lg font-semibold text-white mb-2">Anhangsebene</h3>
          <div class="flex gap-4 p-2 rounded-lg bg-gray-900">
            <label class="flex-1 flex items-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer">
              <input type="radio" name="attachment-level" value="document" checked class="w-4 h-4 text-orange-600 bg-gray-700 border-gray-600 focus:ring-orange-500">
              <div>
                <span class="font-semibold text-white">Dokumentebene</span>
                <p class="text-xs text-gray-400">An das gesamte Dokument anhängen</p>
              </div>
            </label>
            <label class="flex-1 flex items-center gap-2 p-3 rounded-md hover:bg-gray-700 cursor-pointer">
              <input type="radio" name="attachment-level" value="page" class="w-4 h-4 text-orange-600 bg-gray-700 border-gray-600 focus:ring-orange-500">
              <div>
                <span class="font-semibold text-white">Seitenebene</span>
                <p class="text-xs text-gray-400">An bestimmte Seiten anhängen</p>
              </div>
            </label>
          </div>
        </div>

        <div id="page-range-wrapper" class="hidden">
          <label for="attachment-page-range" class="block mb-2 text-sm font-medium text-gray-300">Seitenbereich</label>
          <input type="text" id="attachment-page-range" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder="z.B., 1-3, 5, 8">
          <p class="text-xs text-gray-400 mt-1">Anhänge werden jeder Seite in diesem Bereich hinzugefügt. Gesamtseiten: <span id="attachment-total-pages"></span></p>
        </div>
      </div>

<<<<<<< Updated upstream
      <button id="process-btn" class="hidden btn-gradient mt-6" disabled>Embed Files & Download</button>
    </div>
  `,
    'extract-attachments': () => `
    <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.extractAttachments.title">Extract Attachments</h2>
    <p class="mb-6 text-gray-400" data-i18n="toolInterface.extractAttachments.description">Extract all embedded files from one or more PDFs. All attachments will be downloaded in a ZIP archive.</p>
    ${createFileInputHTML({ multiple: true, accept: 'application/pdf', showControls: true })}
    <div id="file-display-area" class="mt-4 space-y-2"></div>
    <button id="process-btn" class="btn-gradient mt-6">Extract Attachments</button>
  `,
    'edit-attachments': () => `
    <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.editAttachments.title">Edit Attachments</h2>
    <p class="mb-6 text-gray-400" data-i18n="toolInterface.editAttachments.description">View, remove, or replace attachments in your PDF.</p>
=======
      <button id="process-btn" class="hidden btn-gradient w-full mt-6" disabled>Dateien einbetten & herunterladen</button>
    </div>
  `,
    'extract-attachments': () => `
    <h2 class="text-2xl font-bold text-white mb-4">Anhänge extrahieren</h2>
    <p class="mb-6 text-gray-400">Extrahieren Sie alle eingebetteten Dateien aus einem oder mehreren PDFs. Alle Anhänge werden als ZIP-Archiv heruntergeladen.</p>
    ${createFileInputHTML({ multiple: true, accept: 'application/pdf', showControls: true })}
    <div id="file-display-area" class="mt-4 space-y-2"></div>
    <button id="process-btn" class="btn-gradient w-full mt-6">Anhänge extrahieren</button>
  `,
    'edit-attachments': () => `
    <h2 class="text-2xl font-bold text-white mb-4">Anhänge bearbeiten</h2>
    <p class="mb-6 text-gray-400">Anzeigen, entfernen oder ersetzen Sie Anhänge in Ihrem PDF.</p>
>>>>>>> Stashed changes
    ${createFileInputHTML({ accept: 'application/pdf' })}
    <div id="file-display-area" class="mt-4 space-y-2"></div>
    <div id="edit-attachments-options" class="hidden mt-6">
      <div id="attachments-list" class="space-y-3 mb-4"></div>
<<<<<<< Updated upstream
      <button id="process-btn" class="btn-gradient mt-6">Save Changes & Download</button>
=======
      <button id="process-btn" class="btn-gradient w-full mt-6">Änderungen speichern & herunterladen</button>
>>>>>>> Stashed changes
    </div>
  `,

    'sanitize-pdf': () => `
<<<<<<< Updated upstream
    <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.sanitize.title">Sanitize PDF</h2>
    <p class="mb-6 text-gray-400" data-i18n="toolInterface.sanitize.description">Remove potentially sensitive or unnecessary information from your PDF before sharing. Select the items you want to remove.</p>
=======
    <h2 class="text-2xl font-bold text-white mb-4">PDF bereinigen</h2>
    <p class="mb-6 text-gray-400">Entfernen Sie potenziell sensible oder unnötige Informationen aus Ihrem PDF bevor Sie es teilen. Wählen Sie die Elemente aus, die Sie entfernen möchten.</p>
>>>>>>> Stashed changes
    ${createFileInputHTML()}
    <div id="file-display-area" class="mt-4 space-y-2"></div>

    <div id="sanitize-pdf-options" class="hidden mt-6 space-y-4 p-4 bg-gray-900 border border-gray-700 rounded-lg">
        <h3 class="text-lg font-semibold text-white mb-3">Bereinigungsoptionen</h3>
    <div>
            <strong class="font-semibold text-yellow-200">Hinweis:</strong>
            Das Entfernen von <code class="bg-gray-700 px-1 rounded text-white">Eingebetteten Schriftarten</code> kann die Textdarstellung beeinträchtigen! Text wird möglicherweise nicht korrekt oder gar nicht angezeigt. Verwenden Sie dies nur, wenn Sie sicher sind, dass der PDF-Viewer Ersatzschriften hat.
    </div>
        <div class="mb-4">
            <h4 class="text-sm font-semibold text-gray-400 mb-2">Wesentliche Sicherheit</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label class="flex items-center space-x-2 p-3 rounded-md bg-gray-800 hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" id="flatten-forms" name="sanitizeOption" value="flatten-forms" checked class="w-5 h-5 text-orange-600 bg-gray-700 border-gray-600 rounded focus:ring-orange-500">
                    <span class="text-white">Formularfelder glätten</span>
                </label>
                <label class="flex items-center space-x-2 p-3 rounded-md bg-gray-800 hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" id="remove-metadata" name="sanitizeOption" value="metadata" checked class="w-5 h-5 text-orange-600 bg-gray-700 border-gray-600 rounded focus:ring-orange-500">
                    <span class="text-white">Alle Metadaten entfernen</span>
                </label>
                <label class="flex items-center space-x-2 p-3 rounded-md bg-gray-800 hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" id="remove-annotations" name="sanitizeOption" value="annotations" checked class="w-5 h-5 text-orange-600 bg-gray-700 border-gray-600 rounded focus:ring-orange-500">
                    <span class="text-white">Anmerkungen entfernen</span>
                </label>
                <label class="flex items-center space-x-2 p-3 rounded-md bg-gray-800 hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" id="remove-javascript" name="sanitizeOption" value="javascript" checked class="w-5 h-5 text-orange-600 bg-gray-700 border-gray-600 rounded focus:ring-orange-500">
                    <span class="text-white">JavaScript entfernen</span>
                </label>
                <label class="flex items-center space-x-2 p-3 rounded-md bg-gray-800 hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" id="remove-embedded-files" name="sanitizeOption" value="embeddedFiles" checked class="w-5 h-5 text-orange-600 bg-gray-700 border-gray-600 rounded focus:ring-orange-500">
                    <span class="text-white">Eingebettete Dateien entfernen</span>
                </label>
                <label class="flex items-center space-x-2 p-3 rounded-md bg-gray-800 hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" id="remove-layers" name="sanitizeOption" value="layers" checked class="w-5 h-5 text-orange-600 bg-gray-700 border-gray-600 rounded focus:ring-orange-500">
                    <span class="text-white">Ebenen (OCG) entfernen</span>
                </label>
                <label class="flex items-center space-x-2 p-3 rounded-md bg-gray-800 hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" id="remove-links" name="sanitizeOption" value="links" checked class="w-5 h-5 text-orange-600 bg-gray-700 border-gray-600 rounded focus:ring-orange-500">
                    <span class="text-white">Externe Links entfernen</span>
                </label>
            </div>
        </div>

        <div>
            <h4 class="text-sm font-semibold text-gray-400 mb-2">Zusätzliche Optionen</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label class="flex items-center space-x-2 p-3 rounded-md bg-gray-800 hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" id="remove-structure-tree" name="sanitizeOption" value="structure" class="w-5 h-5 text-orange-600 bg-gray-700 border-gray-600 rounded focus:ring-orange-500">
                    <span class="text-white">Strukturbaum entfernen</span>
                </label>
                <label class="flex items-center space-x-2 p-3 rounded-md bg-gray-800 hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" id="remove-markinfo" name="sanitizeOption" value="markinfo" class="w-5 h-5 text-orange-600 bg-gray-700 border-gray-600 rounded focus:ring-orange-500">
                    <span class="text-white">Tagging-Info entfernen</span>
                </label>
                <label class="flex items-center space-x-2 p-3 rounded-md bg-gray-800 hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" id="remove-fonts" name="sanitizeOption" value="fonts" class="w-5 h-5 text-orange-600 bg-gray-700 border-gray-600 rounded focus:ring-orange-500">
                    <span class="text-white text-sm">Eingebettete Schriftarten entfernen</span>
                </label>
            </div>
        </div>

<<<<<<< Updated upstream
        <button id="process-btn" class="btn-gradient mt-6">Sanitize PDF & Download</button>
=======
        <button id="process-btn" class="btn-gradient w-full mt-6">PDF bereinigen & herunterladen</button>
>>>>>>> Stashed changes
    </div>
`,

    'remove-restrictions': () => `
<<<<<<< Updated upstream
  <h2 class="text-2xl font-bold text-white mb-4" data-i18n="toolInterface.removeRestrictions.title">Remove PDF Restrictions</h2>
  <p class="mb-6 text-gray-400" data-i18n="toolInterface.removeRestrictions.description">Remove security restrictions and unlock PDF permissions for editing and printing.</p>
=======
  <h2 class="text-2xl font-bold text-white mb-4">PDF-Einschränkungen entfernen</h2>
  <p class="mb-6 text-gray-400">Entfernen Sie Sicherheitseinschränkungen und entsperren Sie PDF-Berechtigungen für Bearbeitung und Druck.</p>
>>>>>>> Stashed changes
  ${createFileInputHTML()}
  <div id="file-display-area" class="mt-4 space-y-2"></div>
  <div id="remove-restrictions-options" class="hidden space-y-4 mt-6">
        <div class="p-4 bg-blue-900/20 border border-blue-500/30 text-blue-200 rounded-lg">
          <h3 class="font-semibold text-base mb-2">So funktioniert es</h3>
          <p class="text-sm text-gray-300 mb-2">Dieser Vorgang wird:</p>
          <ul class="text-sm text-gray-300 list-disc list-inside space-y-1 ml-2">
            <li>Alle Berechtigungseinschränkungen entfernen (Drucken, Kopieren, Bearbeiten)</li>
            <li>Verschlüsselung entfernen, auch wenn die Datei verschlüsselt ist</li>
            <li>Sicherheitseinschränkungen von digital signierten PDF-Dateien entfernen (macht Signatur ungültig)</li>
            <li>Ein vollständig bearbeitbares, uneingeschränktes PDF erstellen</li>
          </ul>
      </div>

      <div>
          <label for="owner-password-remove" class="block mb-2 text-sm font-medium text-gray-300">Eigentümer-Passwort (falls erforderlich)</label>
          <input type="password" id="owner-password-remove" class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5" placeholder="Leer lassen wenn PDF kein Passwort hat">
          <p class="text-xs text-gray-500 mt-1">Geben Sie das Eigentümer-Passwort ein, wenn das PDF passwortgeschützt ist</p>
      </div>

<div class="p-4 bg-red-900/20 border border-red-500/30 text-red-200 rounded-lg">
  <h3 class="font-semibold text-base mb-2">Hinweis</h3>
  <p class="text-sm text-gray-300 mb-2">Dieses Tool ist nur für legitime Zwecke gedacht, wie z.B.:</p>
  <ul class="text-sm text-gray-300 list-disc list-inside space-y-1 ml-2">
    <li>Entfernen von Einschränkungen aus PDFs, die Ihnen gehören oder die Sie bearbeiten dürfen</li>
    <li>Wiederherstellung des Zugangs zu einem PDF, dessen Passwort Sie legitim vergessen haben</li>
    <li>Zugriff auf Inhalte, die Sie rechtmäßig erworben oder erstellt haben</li>
    <li>Bearbeitung von Dokumenten für autorisierte Geschäftszwecke</li>
    <li>Öffnen von Dokumenten für legitime Archivierungs-, Compliance- oder Wiederherstellungsabläufe</li>
    <li class="font-semibold">Einschränkungen: Dieses Tool kann nur Einschränkungen von schwach geschützten PDFs oder PDFs ohne Eigentümer-Passwort entfernen. Es kann keine korrekt angewandte AES-256 (256-Bit) Verschlüsselung entfernen oder umgehen.</li>
  </ul>
  <p class="text-sm text-gray-300 mt-3 font-semibold">
    Die Verwendung dieses Tools zur Umgehung von Urheberrechtsschutz, Verletzung geistiger Eigentumsrechte oder zum Zugriff auf Dokumente ohne Berechtigung kann in Ihrem Land illegal sein. Wir haften nicht für Missbrauch dieses Tools — falls Sie unsicher sind, konsultieren Sie einen Rechtsberater oder den Dokumenteneigentümer bevor Sie fortfahren.
  </p>
</div>
<<<<<<< Updated upstream
      <button id="process-btn" class="btn-gradient mt-6">Remove Restrictions & Download</button>
=======
      <button id="process-btn" class="btn-gradient w-full mt-6">Einschränkungen entfernen & herunterladen</button>
>>>>>>> Stashed changes
  </div>
`,
};
