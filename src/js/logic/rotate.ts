import { showLoader, hideLoader, showAlert } from '../ui.js';
import { downloadFile, resetAndReloadTool, generateOutputFilename } from '../utils/helpers.js';
import { state } from '../state.js';
import { getTranslations } from '../i18n/index.js';
import { getRotationState, resetRotationState } from '../handlers/fileHandler.js';

import { degrees } from 'pdf-lib';

export async function rotate() {
  showLoader(getTranslations().rotate.applying);
  try {
    const pages = state.pdfDoc.getPages();
    const rotationStateArray = getRotationState();

    // Apply rotations from state (not DOM) to ensure all pages including lazy-loaded ones are rotated
    rotationStateArray.forEach((rotation, pageIndex) => {
      if (rotation !== 0 && pages[pageIndex]) {
        const currentRotation = pages[pageIndex].getRotation().angle;
        pages[pageIndex].setRotation(degrees(currentRotation + rotation));
      }
    });

    const rotatedPdfBytes = await state.pdfDoc.save();
    downloadFile(
      new Blob([rotatedPdfBytes], { type: 'application/pdf' }),
      generateOutputFilename(state.files[0]?.name, 'rotated.pdf')
    );

    resetAndReloadTool(() => {
      resetRotationState();
    });
  } catch (e) {
    console.error(e);
    showAlert(getTranslations().error, getTranslations().rotate.error);
  } finally {
    hideLoader();
  }
}
