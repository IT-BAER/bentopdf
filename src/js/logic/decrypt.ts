import { showLoader, hideLoader, showAlert } from '../ui.js';
import {
  downloadFile,
  initializeQpdf,
  readFileAsArrayBuffer,
} from '../utils/helpers.js';
import { state } from '../state.js';
import { getTranslations } from '../i18n/index.js';

export async function decrypt() {
  const file = state.files[0];
  const password = (
    document.getElementById('password-input') as HTMLInputElement
  )?.value;

  if (!password) {
    showAlert(getTranslations().decrypt.inputRequired, getTranslations().decrypt.enterPassword);
    return;
  }

  const inputPath = '/input.pdf';
  const outputPath = '/output.pdf';
  let qpdf: any;

  try {
    showLoader(getTranslations().decrypt.initializing);
    qpdf = await initializeQpdf();

    showLoader(getTranslations().decrypt.reading);
    const fileBuffer = await readFileAsArrayBuffer(file);
    const uint8Array = new Uint8Array(fileBuffer as ArrayBuffer);

    qpdf.FS.writeFile(inputPath, uint8Array);

    showLoader(getTranslations().decrypt.decrypting);

    const args = [inputPath, '--password=' + password, '--decrypt', outputPath];

    try {
      qpdf.callMain(args);
    } catch (qpdfError: any) {
      console.error('qpdf execution error:', qpdfError);

      if (
        qpdfError.message?.includes('invalid password') ||
        qpdfError.message?.includes('password')
      ) {
        throw new Error('INVALID_PASSWORD');
      }
      throw qpdfError;
    }

    showLoader(getTranslations().decrypt.preparingDownload);
    const outputFile = qpdf.FS.readFile(outputPath, { encoding: 'binary' });

    if (outputFile.length === 0) {
      throw new Error(getTranslations().decrypt.emptyFile);
    }

    const blob = new Blob([outputFile], { type: 'application/pdf' });
    downloadFile(blob, `unlocked-${file.name}`);

    hideLoader();
    showAlert(
      getTranslations().success,
      getTranslations().decrypt.success
    );
  } catch (error: any) {
    console.error('Error during PDF decryption:', error);
    hideLoader();

    if (error.message === 'INVALID_PASSWORD') {
      showAlert(
        getTranslations().decrypt.incorrectPasswordTitle,
        getTranslations().decrypt.incorrectPasswordMessage
      );
    } else if (error.message?.includes('password')) {
      showAlert(
        getTranslations().decrypt.passwordErrorTitle,
        getTranslations().decrypt.passwordErrorMessage
      );
    } else {
      showAlert(
        getTranslations().decrypt.decryptionFailedTitle,
        getTranslations().decrypt.decryptionFailedMessage.replace('{error}', error.message || getTranslations().decrypt.fallbackError)
      );
    }
  } finally {
    try {
      if (qpdf?.FS) {
        try {
          qpdf.FS.unlink(inputPath);
        } catch (e) {
          console.warn('Failed to unlink input file:', e);
        }
        try {
          qpdf.FS.unlink(outputPath);
        } catch (e) {
          console.warn('Failed to unlink output file:', e);
        }
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup WASM FS:', cleanupError);
    }
  }
}
