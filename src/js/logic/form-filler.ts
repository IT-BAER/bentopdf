import { showLoader, hideLoader, showAlert } from '../ui.js';
import { readFileAsArrayBuffer } from '../utils/helpers.js';
import { state } from '../state.js';
import { getTranslations } from '../i18n/index.js';

let viewerIframe: HTMLIFrameElement | null = null;
let viewerReady = false;


export async function setupFormFiller() {
  if (!state.files || !state.files[0]) return;

  showLoader(getTranslations().formFiller.loading);
  const pdfViewerContainer = document.getElementById('pdf-viewer-container');

  if (!pdfViewerContainer) {
    console.error('PDF viewer container not found');
    hideLoader();
    return;
  }

  try {
    pdfViewerContainer.innerHTML = '';

    const file = state.files[0];
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const blob = new Blob([arrayBuffer as ArrayBuffer], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);

    viewerIframe = document.createElement('iframe');
    viewerIframe.src = `/pdfjs-viewer/viewer.html?file=${encodeURIComponent(blobUrl)}`;
    viewerIframe.style.width = '100%';
    viewerIframe.style.height = '100%';
    viewerIframe.style.border = 'none';

    viewerIframe.onload = () => {
      viewerReady = true;
      hideLoader();
    };

    pdfViewerContainer.appendChild(viewerIframe);

    const formFillerOptions = document.getElementById('form-filler-options');
    if (formFillerOptions) formFillerOptions.classList.remove('hidden');
  } catch (e) {
    console.error('Critical error setting up form filler:', e);
    showAlert(
      getTranslations().formFiller.loadErrorTitle,
      getTranslations().formFiller.loadErrorMessage
    );
    hideLoader();
  }
}

export async function processAndDownloadForm() {
  if (!viewerIframe || !viewerReady) {
    showAlert(getTranslations().formFiller.viewerNotReadyTitle, getTranslations().formFiller.viewerNotReadyMessage);
    return;
  }

  try {
    const viewerWindow = viewerIframe.contentWindow;
    if (!viewerWindow) {
      console.error('Cannot access iframe window');
      showAlert(
        getTranslations().formFiller.downloadTitle,
        getTranslations().formFiller.useToolbarButton
      );
      return;
    }

    const viewerDoc = viewerWindow.document;
    if (!viewerDoc) {
      console.error('Cannot access iframe document');
      showAlert(
        getTranslations().formFiller.downloadTitle,
        getTranslations().formFiller.useToolbarButton
      );
      return;
    }

    const downloadBtn = viewerDoc.getElementById('downloadButton') as HTMLButtonElement | null;

    if (downloadBtn) {
      console.log('Clicking download button...');
      downloadBtn.click();
    } else {
      console.error('Download button not found in viewer');
      const secondaryDownload = viewerDoc.getElementById('secondaryDownload') as HTMLButtonElement | null;
      if (secondaryDownload) {
        console.log('Clicking secondary download button...');
        secondaryDownload.click();
      } else {
        showAlert(
          getTranslations().formFiller.downloadTitle,
          getTranslations().formFiller.useToolbarButton
        );
      }
    }
  } catch (e) {
    console.error('Failed to trigger download:', e);
    showAlert(
      'Download',
      'Cannot access viewer controls. Please use the Download button in the PDF viewer toolbar above.'
    );
  }
}
