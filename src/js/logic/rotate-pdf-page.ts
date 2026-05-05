import { showLoader, hideLoader, showAlert } from '../ui.js';
import { downloadFile, formatBytes } from '../utils/helpers.js';
import { createIcons, icons } from 'lucide';
import { PDFDocument as PDFLibDocument } from 'pdf-lib';
import { t } from '../i18n/index.js';
import {
  renderPagesProgressively,
  cleanupLazyRendering,
} from '../utils/render-utils.js';
import { rotatePdfPages } from '../utils/pdf-operations.js';
import { loadPdfWithPasswordPrompt } from '../utils/password-prompt.js';
import {
  applyRotationAngle,
  buildRotateOutputNames,
  isPdfFile,
} from './rotate-pdf-helpers.js';
import * as pdfjsLib from 'pdfjs-dist';
import { loadPdfDocument } from '../utils/load-pdf-document.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface RotateDocumentState {
  id: string;
  file: File;
  pdfDoc: PDFLibDocument;
  pdfJsDoc: pdfjsLib.PDFDocumentProxy;
  rotations: number[];
}

interface RotateState {
  documents: RotateDocumentState[];
}

const pageState: RotateState = {
  documents: [],
};

let nextDocumentId = 0;

function pageLabel(count: number): string {
  return count === 1 ? t('common.page') : t('common.pages');
}

function previewSummary(count: number): string {
  return t('tools:rotatePdf.previewSummary', {
    count,
    pagesLabel: pageLabel(count),
  });
}

function resetState() {
  cleanupLazyRendering();
  pageState.documents = [];

  const fileDisplayArea = document.getElementById('file-display-area');
  if (fileDisplayArea) fileDisplayArea.innerHTML = '';

  const toolOptions = document.getElementById('tool-options');
  if (toolOptions) toolOptions.classList.add('hidden');

  const pageThumbnails = document.getElementById('page-thumbnails');
  if (pageThumbnails) pageThumbnails.innerHTML = '';

  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  if (fileInput) fileInput.value = '';
}

function updateRotationDisplays(documentState: RotateDocumentState) {
  const documentSection = document.getElementById(documentState.id);
  if (!documentSection) return;

  const containers =
    documentSection.querySelectorAll<HTMLElement>('[data-page-index]');

  containers.forEach((container) => {
    const pageIndex = Number(container.dataset.pageIndex || '0');
    const wrapper = container.querySelector(
      '.thumbnail-wrapper'
    ) as HTMLElement;
    if (wrapper) {
      wrapper.style.transform = `rotate(${documentState.rotations[pageIndex]}deg)`;
    }
  });
}

function rotateDocumentPages(
  documentState: RotateDocumentState,
  angle: number
) {
  documentState.rotations = applyRotationAngle(documentState.rotations, angle);
  updateRotationDisplays(documentState);
}

function rotateAllDocuments(angle: number) {
  pageState.documents.forEach((documentState) => {
    documentState.rotations = applyRotationAngle(
      documentState.rotations,
      angle
    );
    updateRotationDisplays(documentState);
  });
}

function removeDocument(documentId: string) {
  pageState.documents = pageState.documents.filter(
    (documentState) => documentState.id !== documentId
  );

  if (pageState.documents.length === 0) {
    resetState();
    return;
  }

  void updateUI();
}

function createPageWrapper(
  canvas: HTMLCanvasElement,
  pageNumber: number,
  documentState: RotateDocumentState
): HTMLElement {
  const pageIndex = pageNumber - 1;

  const container = document.createElement('div');
  container.className =
    'page-thumbnail relative bg-gray-700 rounded-lg overflow-hidden';
  container.dataset.pageIndex = pageIndex.toString();
  container.dataset.pageNumber = pageNumber.toString();

  const canvasWrapper = document.createElement('div');
  canvasWrapper.className =
    'thumbnail-wrapper flex items-center justify-center p-4 h-56 md:h-72 pointer-events-none';
  canvasWrapper.style.transition = 'transform 0.3s ease';
  // Apply initial rotation if it exists
  const initialRotation = documentState.rotations[pageIndex] || 0;
  canvasWrapper.style.transform = `rotate(${initialRotation}deg)`;

  canvas.className = 'max-w-full max-h-full object-contain';
  canvasWrapper.appendChild(canvas);

  const pageLabel = document.createElement('div');
  pageLabel.className =
    'absolute top-1 left-1 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded';
  pageLabel.textContent = `${pageNumber}`;

  container.appendChild(canvasWrapper);
  container.appendChild(pageLabel);

  // Per-page rotation controls - Left and Right buttons only
  const controls = document.createElement('div');
  controls.className = 'flex items-center justify-center gap-2 p-2 bg-gray-800';

  const rotateLeftBtn = document.createElement('button');
  rotateLeftBtn.className =
    'flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded border border-gray-600 text-xs cursor-pointer';
  rotateLeftBtn.innerHTML = '<i data-lucide="rotate-ccw" class="w-3 h-3"></i>';
  rotateLeftBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    e.preventDefault();
    documentState.rotations[pageIndex] =
      documentState.rotations[pageIndex] - 90;
    const wrapper = container.querySelector(
      '.thumbnail-wrapper'
    ) as HTMLElement;
    if (wrapper)
      wrapper.style.transform = `rotate(${documentState.rotations[pageIndex]}deg)`;
  });

  const rotateRightBtn = document.createElement('button');
  rotateRightBtn.className =
    'flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded border border-gray-600 text-xs cursor-pointer';
  rotateRightBtn.innerHTML = '<i data-lucide="rotate-cw" class="w-3 h-3"></i>';
  rotateRightBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    e.preventDefault();
    documentState.rotations[pageIndex] =
      documentState.rotations[pageIndex] + 90;
    const wrapper = container.querySelector(
      '.thumbnail-wrapper'
    ) as HTMLElement;
    if (wrapper)
      wrapper.style.transform = `rotate(${documentState.rotations[pageIndex]}deg)`;
  });

  controls.append(rotateLeftBtn, rotateRightBtn);
  container.appendChild(controls);

  // Re-create icons scoped to this container only
  setTimeout(function () {
    createIcons({ icons, nameAttr: 'data-lucide', attrs: {} });
  }, 0);

  return container;
}

function createFileCard(documentState: RotateDocumentState): HTMLElement {
  const fileDiv = document.createElement('div');
  fileDiv.className =
    'flex items-center justify-between bg-gray-700 p-3 rounded-lg text-sm';

  const infoContainer = document.createElement('div');
  infoContainer.className = 'flex flex-col overflow-hidden';

  const nameSpan = document.createElement('div');
  nameSpan.className = 'truncate font-medium text-gray-200 text-sm mb-1';
  nameSpan.textContent = documentState.file.name;

  const metaSpan = document.createElement('div');
  metaSpan.className = 'text-xs text-gray-400';
  const pageCount = documentState.pdfDoc.getPageCount();
  metaSpan.textContent = `${formatBytes(documentState.file.size)} • ${pageCount} ${pageLabel(pageCount)}`;

  infoContainer.append(nameSpan, metaSpan);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'ml-4 text-red-400 hover:text-red-300 flex-shrink-0';
  removeBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
  removeBtn.onclick = function () {
    removeDocument(documentState.id);
  };

  fileDiv.append(infoContainer, removeBtn);
  return fileDiv;
}

async function renderDocumentSection(
  documentState: RotateDocumentState
): Promise<HTMLElement> {
  const documentSection = document.createElement('section');
  documentSection.id = documentState.id;
  documentSection.className =
    'bg-gray-900 rounded-xl border border-gray-700 p-4 md:p-5';

  const header = document.createElement('div');
  header.className =
    'flex flex-col gap-4 mb-4 lg:flex-row lg:items-center lg:justify-between';

  const heading = document.createElement('div');
  heading.className = 'min-w-0';

  const title = document.createElement('h3');
  title.className = 'text-base md:text-lg font-semibold text-white truncate';
  title.textContent = documentState.file.name;

  const subtitle = document.createElement('p');
  subtitle.className = 'text-sm text-gray-400';
  subtitle.textContent = previewSummary(documentState.pdfDoc.getPageCount());

  heading.append(title, subtitle);

  const controls = document.createElement('div');
  controls.className = 'flex flex-wrap gap-2';

  const rotateLeftBtn = document.createElement('button');
  rotateLeftBtn.className =
    'flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm border border-gray-600';
  rotateLeftBtn.innerHTML = `<i data-lucide="rotate-ccw" class="w-4 h-4"></i> ${t('tools:rotatePdf.documentRotateLeft')}`;
  rotateLeftBtn.addEventListener('click', function () {
    rotateDocumentPages(documentState, -90);
  });

  const rotateRightBtn = document.createElement('button');
  rotateRightBtn.className =
    'flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm border border-gray-600';
  rotateRightBtn.innerHTML = `<i data-lucide="rotate-cw" class="w-4 h-4"></i> ${t('tools:rotatePdf.documentRotateRight')}`;
  rotateRightBtn.addEventListener('click', function () {
    rotateDocumentPages(documentState, 90);
  });

  controls.append(rotateLeftBtn, rotateRightBtn);
  header.append(heading, controls);

  const thumbnailsGrid = document.createElement('div');
  thumbnailsGrid.className = 'grid grid-cols-1 xl:grid-cols-2 gap-6';

  documentSection.append(header, thumbnailsGrid);

  await renderPagesProgressively(
    documentState.pdfJsDoc,
    thumbnailsGrid,
    function (canvas, pageNumber) {
      return createPageWrapper(canvas, pageNumber, documentState);
    },
    {
      batchSize: 8,
      useLazyLoading: true,
      lazyLoadMargin: '200px',
      eagerLoadBatches: 2,
      onBatchComplete: function () {
        createIcons({ icons });
      },
    }
  );

  createIcons({ icons });
  return documentSection;
}

async function updateUI() {
  const fileDisplayArea = document.getElementById('file-display-area');
  const toolOptions = document.getElementById('tool-options');
  const pageThumbnails = document.getElementById('page-thumbnails');

  if (!fileDisplayArea || !pageThumbnails) return;

  cleanupLazyRendering();
  fileDisplayArea.innerHTML = '';
  pageThumbnails.innerHTML = '';

  if (pageState.documents.length === 0) {
    if (toolOptions) toolOptions.classList.add('hidden');
    return;
  }

  pageState.documents.forEach((documentState) => {
    fileDisplayArea.appendChild(createFileCard(documentState));
  });
  createIcons({ icons });

  for (const documentState of pageState.documents) {
    const documentSection = await renderDocumentSection(documentState);
    pageThumbnails.appendChild(documentSection);
  }

  if (toolOptions) toolOptions.classList.remove('hidden');
}

async function applyRotations() {
  if (pageState.documents.length === 0) {
    showAlert(t('common.error'), t('tools:rotatePdf.uploadFirstMessage'));
    return;
  }

  try {
    if (pageState.documents.length === 1) {
      const documentState = pageState.documents[0];
      showLoader(t('tools:rotatePdf.applyingSingle'));

      const pdfBytes = await documentState.pdfDoc.save();
      const rotatedPdfBytes = await rotatePdfPages(
        new Uint8Array(pdfBytes),
        documentState.rotations
      );
      const rotatedBuffer = rotatedPdfBytes.buffer.slice(
        rotatedPdfBytes.byteOffset,
        rotatedPdfBytes.byteOffset + rotatedPdfBytes.byteLength
      ) as ArrayBuffer;

      downloadFile(
        new Blob([rotatedBuffer], {
          type: 'application/pdf',
        }),
        documentState.file.name
      );

      showAlert(
        t('common.success'),
        t('tools:rotatePdf.successSingle'),
        'success',
        function () {
          resetState();
        }
      );
      return;
    }

    showLoader(t('tools:rotatePdf.applyingMultiple'));
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    const outputNames = buildRotateOutputNames(
      pageState.documents.map((documentState) => documentState.file.name)
    );
    let successCount = 0;
    let failureCount = 0;

    for (let index = 0; index < pageState.documents.length; index++) {
      const documentState = pageState.documents[index];
      showLoader(
        t('tools:rotatePdf.applyingProgress', {
          current: index + 1,
          total: pageState.documents.length,
          name: documentState.file.name,
        })
      );

      try {
        const pdfBytes = await documentState.pdfDoc.save();
        const rotatedPdfBytes = await rotatePdfPages(
          new Uint8Array(pdfBytes),
          documentState.rotations
        );

        zip.file(outputNames[index], rotatedPdfBytes, { binary: true });
        successCount++;
      } catch (error) {
        failureCount++;
        console.error(`Failed to rotate ${documentState.file.name}:`, error);
      }
    }

    if (successCount === 0) {
      throw new Error(t('tools:rotatePdf.noSuccessfulFiles'));
    }

    showLoader(t('tools:rotatePdf.preparingZip'));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadFile(zipBlob, 'rotated-pdfs.zip');

    const successMessage =
      failureCount > 0
        ? t('tools:rotatePdf.successMultiplePartial', {
            successCount,
            failureCount,
          })
        : t('tools:rotatePdf.successMultiple', { successCount });

    showAlert(t('common.success'), successMessage, 'success', function () {
      resetState();
    });
  } catch (e) {
    console.error(e);
    showAlert(t('common.error'), t('tools:rotatePdf.processErrorMessage'));
  } finally {
    hideLoader();
  }
}

async function loadRotateDocument(
  file: File,
  documentIndex: number,
  totalDocuments: number
): Promise<RotateDocumentState | null> {
  showLoader(`Loading PDF ${documentIndex}/${totalDocuments}: ${file.name}...`);

  const result = await loadPdfWithPasswordPrompt(file);
  if (!result) {
    return null;
  }

  const pdfDoc = await loadPdfDocument(result.bytes);
  const pageCount = pdfDoc.getPageCount();

  return {
    id: `rotate-document-${nextDocumentId++}`,
    file,
    pdfDoc,
    pdfJsDoc: result.pdf,
    rotations: new Array(pageCount).fill(0),
  };
}

async function handleFileSelect(files: FileList | null) {
  if (!files || files.length === 0) return;

  const selectedFiles = Array.from(files);
  const pdfFiles = selectedFiles.filter((file) => isPdfFile(file));

  if (pdfFiles.length === 0) {
    showAlert(t('common.error'), t('tools:rotatePdf.invalidFileMessage'));
    return;
  }

  if (pdfFiles.length < selectedFiles.length) {
    showAlert(
      t('tools:rotatePdf.skippedFilesTitle'),
      t('tools:rotatePdf.skippedNonPdfMessage')
    );
  }

  const failedFiles: string[] = [];

  try {
    for (let index = 0; index < pdfFiles.length; index++) {
      const documentState = await loadRotateDocument(
        pdfFiles[index],
        index + 1,
        pdfFiles.length
      );

      if (documentState) {
        pageState.documents.push(documentState);
      } else {
        failedFiles.push(pdfFiles[index].name);
      }
    }

    await updateUI();

    if (failedFiles.length > 0) {
      showAlert(
        t('tools:rotatePdf.skippedFilesTitle'),
        t('tools:rotatePdf.skippedFilesMessage', {
          files: failedFiles.join(', '),
        })
      );
    }
  } catch (error) {
    console.error('Error loading PDF:', error);
    showAlert(t('common.error'), t('tools:rotatePdf.loadErrorMessage'));
  } finally {
    hideLoader();
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const dropZone = document.getElementById('drop-zone');
  const processBtn = document.getElementById('process-btn');
  const backBtn = document.getElementById('back-to-tools');
  const rotateAllLeft = document.getElementById('rotate-all-left');
  const rotateAllRight = document.getElementById('rotate-all-right');

  if (backBtn) {
    backBtn.addEventListener('click', function () {
      window.location.href = import.meta.env.BASE_URL;
    });
  }

  if (rotateAllLeft) {
    rotateAllLeft.addEventListener('click', function () {
      rotateAllDocuments(-90);
    });
  }

  if (rotateAllRight) {
    rotateAllRight.addEventListener('click', function () {
      rotateAllDocuments(90);
    });
  }

  if (fileInput && dropZone) {
    fileInput.addEventListener('change', function (e) {
      void handleFileSelect((e.target as HTMLInputElement).files);
    });

    dropZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropZone.classList.add('bg-gray-700');
    });

    dropZone.addEventListener('dragleave', function (e) {
      e.preventDefault();
      dropZone.classList.remove('bg-gray-700');
    });

    dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropZone.classList.remove('bg-gray-700');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const pdfFiles = Array.from(files).filter(function (file) {
          return isPdfFile(file);
        });
        if (pdfFiles.length > 0) {
          const dataTransfer = new DataTransfer();
          pdfFiles.forEach((file) => dataTransfer.items.add(file));
          void handleFileSelect(dataTransfer.files);
        }
      }
    });

    fileInput.addEventListener('click', function () {
      fileInput.value = '';
    });
  }

  if (processBtn) {
    processBtn.addEventListener('click', applyRotations);
  }
});
