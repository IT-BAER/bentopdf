import { showLoader, hideLoader, showAlert } from '../ui.js';
import { downloadFile, readFileAsArrayBuffer, getPDFDocument, generateOutputFilename } from '../utils/helpers.js';
import { state } from '../state.js';
import { getTranslations } from '../i18n/index.js';
import Sortable from 'sortablejs';

const alternateMergeState = {
  pdfDocs: {} as Record<string, any>,
  pdfBytes: {} as Record<string, ArrayBuffer>,
};

const alternateMergeWorker = new Worker('/workers/alternate-merge.worker.js');

export async function setupAlternateMergeTool() {
  const optionsDiv = document.getElementById('alternate-merge-options');
  const processBtn = document.getElementById(
    'process-btn'
  ) as HTMLButtonElement;
  const fileList = document.getElementById('alternate-file-list');

  if (!optionsDiv || !processBtn || !fileList) return;

  optionsDiv.classList.remove('hidden');
  processBtn.disabled = false;
  processBtn.onclick = alternateMerge;

  fileList.innerHTML = '';
  alternateMergeState.pdfDocs = {};
  alternateMergeState.pdfBytes = {};

  showLoader(getTranslations().alternateMerge.loadingDocuments);
  try {
    for (const file of state.files) {
      const pdfBytes = await readFileAsArrayBuffer(file);
      alternateMergeState.pdfBytes[file.name] = pdfBytes as ArrayBuffer;

      const bytesForPdfJs = (pdfBytes as ArrayBuffer).slice(0);
      const pdfjsDoc = await getPDFDocument({ data: bytesForPdfJs }).promise;
      alternateMergeState.pdfDocs[file.name] = pdfjsDoc;
      const pageCount = pdfjsDoc.numPages;

      const li = document.createElement('li');
      li.className =
        'bg-gray-700 p-3 rounded-lg border border-gray-600 flex items-center justify-between';
      li.dataset.fileName = file.name;

      const infoDiv = document.createElement('div');
      infoDiv.className = 'flex items-center gap-2 truncate';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'truncate font-medium text-white';
      nameSpan.textContent = file.name;

      const pagesSpan = document.createElement('span');
      pagesSpan.className = 'text-sm text-gray-400 flex-shrink-0';
      pagesSpan.textContent = `(${pageCount} pages)`;

      infoDiv.append(nameSpan, pagesSpan);

      const dragHandle = document.createElement('div');
      dragHandle.className =
        'drag-handle cursor-move text-gray-400 hover:text-white p-1 rounded';
      dragHandle.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>`;

      li.append(infoDiv, dragHandle);
      fileList.appendChild(li);
    }

    Sortable.create(fileList, {
      handle: '.drag-handle',
      animation: 150,
    });
  } catch (error) {
    showAlert(
      getTranslations().error,
      getTranslations().alternateMerge.loadError
    );
    console.error(error);
  } finally {
    hideLoader();
  }
}

export async function alternateMerge() {
  if (Object.keys(alternateMergeState.pdfBytes).length < 2) {
    showAlert(
      getTranslations().alternateMerge.notEnoughFilesTitle,
      getTranslations().alternateMerge.notEnoughFilesMessage
    );
    return;
  }

  showLoader(getTranslations().alternateMerge.mixingPages);
  try {
    const fileList = document.getElementById('alternate-file-list');
    if (!fileList) throw new Error('File list not found');

    const sortedFileNames = Array.from(fileList.children).map(
      (li) => (li as HTMLElement).dataset.fileName
    ).filter(Boolean) as string[];

    const filesToMerge: { name: string; data: ArrayBuffer }[] = [];
    for (const name of sortedFileNames) {
      const bytes = alternateMergeState.pdfBytes[name];
      if (bytes) {
        filesToMerge.push({ name, data: bytes });
      }
    }

    if (filesToMerge.length < 2) {
      showAlert(getTranslations().error, getTranslations().alternateMerge.twoValidPdfsRequired);
      hideLoader();
      return;
    }

    alternateMergeWorker.postMessage({
      command: 'interleave',
      files: filesToMerge
    }, filesToMerge.map(f => f.data));

    alternateMergeWorker.onmessage = (e) => {
      hideLoader();
      if (e.data.status === 'success') {
        const blob = new Blob([e.data.pdfBytes], { type: 'application/pdf' });
        downloadFile(blob, generateOutputFilename(state.files[0]?.name, 'alternated-mixed.pdf'));
        showAlert(getTranslations().success, getTranslations().alternateMerge.success);
      } else {
        console.error('Worker interleave error:', e.data.message);
        showAlert(getTranslations().error, e.data.message || getTranslations().alternateMerge.interleaveError);
      }
    };

    alternateMergeWorker.onerror = (e) => {
      hideLoader();
      console.error('Worker error:', e);
      showAlert(getTranslations().error, getTranslations().alternateMerge.workerError);
    };

  } catch (e) {
    console.error('Alternate Merge error:', e);
    showAlert(getTranslations().error, getTranslations().alternateMerge.mixingError);
    hideLoader();
  }
}
