import { showLoader, hideLoader, showAlert } from '../ui.js';
import { downloadFile, readFileAsArrayBuffer } from '../utils/helpers.js';
import { state } from '../state.js';
import { getTranslations } from '../i18n/index.js';

import { PDFDocument as PDFLibDocument } from 'pdf-lib';

export async function pngToPdf() {
  if (state.files.length === 0) {
    showAlert(getTranslations().pngToPdf.noFilesTitle, getTranslations().pngToPdf.noFilesMessage);
    return;
  }
  showLoader(getTranslations().pngToPdf.creatingPdf);
  try {
    const pdfDoc = await PDFLibDocument.create();
    for (const file of state.files) {
      const pngBytes = await readFileAsArrayBuffer(file);
      const pngImage = await pdfDoc.embedPng(pngBytes as ArrayBuffer);
      const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pngImage.width,
        height: pngImage.height,
      });
    }
    const pdfBytes = await pdfDoc.save();
    downloadFile(
      new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }),
      'from_pngs.pdf'
    );
  } catch (e) {
    console.error(e);
    showAlert(
      'Error',
      'Failed to create PDF from PNG images. Ensure all files are valid PNGs.'
    );
  } finally {
    hideLoader();
  }
}
