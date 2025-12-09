import { PDFDocument } from 'pdf-lib';
import { showLoader, hideLoader, showAlert } from '../ui.js';
import { readFileAsArrayBuffer } from '../utils/helpers.js';
import { state } from '../state.js';
import { getTranslations } from '../i18n/index.js';

const signState = {
  viewerIframe: null,
  viewerReady: false,
};


export async function setupSignTool() {
  document.getElementById('signature-editor').classList.remove('hidden');

  showLoader(getTranslations().sign.viewerInitializingMessage);

  const container = document.getElementById('canvas-container-sign');
  if (!container) {
    console.error('Sign tool canvas container not found');
    hideLoader();
    return;
  }

  if (!state.files || !state.files[0]) {
    console.error('No file loaded into state for signing');
    hideLoader();
    return;
  }

  container.textContent = '';
  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  container.appendChild(iframe);
  signState.viewerIframe = iframe;

  // Use original uploaded bytes to avoid re-writing the PDF structure
  const file = state.files[0];
  const pdfBytes = await readFileAsArrayBuffer(file);
  const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);

  try {
    const existingPrefsRaw = localStorage.getItem('pdfjs.preferences');
    const existingPrefs = existingPrefsRaw ? JSON.parse(existingPrefsRaw) : {};
    delete (existingPrefs as any).annotationEditorMode;
    const newPrefs = {
      ...existingPrefs,
      enableSignatureEditor: true,
      enablePermissions: false,
    };
    localStorage.setItem('pdfjs.preferences', JSON.stringify(newPrefs));
  } catch { }

  const viewerUrl = new URL('/pdfjs-viewer/viewer.html', window.location.origin);
  const query = new URLSearchParams({ file: blobUrl });
  iframe.src = `${viewerUrl.toString()}?${query.toString()}`;

  iframe.onload = () => {
    hideLoader();
    signState.viewerReady = true;
    try {
      const viewerWindow: any = iframe.contentWindow;
      if (viewerWindow && viewerWindow.PDFViewerApplication) {
        const app = viewerWindow.PDFViewerApplication;
        const doc = viewerWindow.document;
        const eventBus = app.eventBus;
        eventBus?._on('annotationeditoruimanager', () => {
          const editorModeButtons = doc.getElementById('editorModeButtons');
          editorModeButtons?.classList.remove('hidden');
          const editorSignature = doc.getElementById('editorSignature');
          editorSignature?.removeAttribute('hidden');
          const editorSignatureButton = doc.getElementById('editorSignatureButton') as HTMLButtonElement | null;
          if (editorSignatureButton) {
            editorSignatureButton.disabled = false;
          }
          const editorStamp = doc.getElementById('editorStamp');
          editorStamp?.removeAttribute('hidden');
          const editorStampButton = doc.getElementById('editorStampButton') as HTMLButtonElement | null;
          if (editorStampButton) {
            editorStampButton.disabled = false;
          }
          try {
            const highlightBtn = doc.getElementById('editorHighlightButton') as HTMLButtonElement | null;
            highlightBtn?.click();
          } catch { }
        });
      }
    } catch (e) {
      console.error('Could not initialize base PDF.js viewer for signing:', e);
    }

    // Now that the viewer is ready, expose the Save Signed PDF button in the Bento UI
    const saveBtn = document.getElementById('process-btn') as HTMLButtonElement | null;
    if (saveBtn) {
      saveBtn.style.display = '';
      saveBtn.disabled = false;
      saveBtn.onclick = () => {
        void applyAndSaveSignatures();
      };
    }
  };
}

export async function applyAndSaveSignatures() {
  if (!signState.viewerReady || !signState.viewerIframe) {
    showAlert(getTranslations().sign.viewerNotReadyTitle, getTranslations().sign.viewerNotReadyMessage);
    return;
  }

  try {
    const viewerWindow: any = signState.viewerIframe.contentWindow;
    if (!viewerWindow || !viewerWindow.PDFViewerApplication) {
      showAlert(getTranslations().sign.viewerNotReadyTitle, getTranslations().sign.viewerInitializingMessage);
      return;
    }

    const app = viewerWindow.PDFViewerApplication;
    const flattenCheckbox = document.getElementById('flatten-signature-toggle') as HTMLInputElement | null;
    const shouldFlatten = flattenCheckbox?.checked;

    if (shouldFlatten) {
      showLoader(getTranslations().sign.flattening);

      const rawPdfBytes = await app.pdfDocument.saveDocument(app.pdfDocument.annotationStorage);

      const pdfBytes = new Uint8Array(rawPdfBytes);

      const pdfDoc = await PDFDocument.load(pdfBytes);

      pdfDoc.getForm().flatten();

      const flattenedPdfBytes = await pdfDoc.save();

      const blob = new Blob([flattenedPdfBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `signed_flattened_${state.files[0].name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      hideLoader();
    } else {
      // Delegate to the built-in download behavior of the base viewer.
      app.eventBus?.dispatch('download', { source: app });
    }
  } catch (error) {
    console.error('Failed to export the signed PDF:', error);
    hideLoader();
    showAlert(getTranslations().sign.exportFailedTitle, getTranslations().sign.exportFailedMessage);
  }
}
