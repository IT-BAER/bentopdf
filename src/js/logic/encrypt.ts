import { showLoader, hideLoader, showAlert } from '../ui.js';
import {
  downloadFile,
  initializeQpdf,
  readFileAsArrayBuffer,
} from '../utils/helpers.js';
import { state } from '../state.js';
import { getTranslations } from '../i18n/index.js';

export async function encrypt() {
  const file = state.files[0];
  const userPassword =
    (document.getElementById('user-password-input') as HTMLInputElement)
      ?.value || '';
  const ownerPasswordInput =
    (document.getElementById('owner-password-input') as HTMLInputElement)
      ?.value || '';

  if (!userPassword) {
    showAlert(getTranslations().encrypt.inputRequired, getTranslations().encrypt.enterUserPassword);
    return;
  }

  const ownerPassword = ownerPasswordInput || userPassword;
  const hasDistinctOwnerPassword = ownerPasswordInput !== '';

  const inputPath = '/input.pdf';
  const outputPath = '/output.pdf';
  let qpdf: any;

  try {
    showLoader(getTranslations().encrypt.initializing);
    qpdf = await initializeQpdf();

    showLoader(getTranslations().encrypt.readingPdf);
    const fileBuffer = await readFileAsArrayBuffer(file);
    const uint8Array = new Uint8Array(fileBuffer as ArrayBuffer);

    qpdf.FS.writeFile(inputPath, uint8Array);

    showLoader(getTranslations().encrypt.encrypting);

    const args = [inputPath, '--encrypt', userPassword, ownerPassword, '256'];

    // Only add restrictions if a distinct owner password was provided
    if (hasDistinctOwnerPassword) {
      args.push(
        '--modify=none',
        '--extract=n',
        '--print=none',
        '--accessibility=n',
        '--annotate=n',
        '--assemble=n',
        '--form=n',
        '--modify-other=n'
      );
    }

    args.push('--', outputPath);

    try {
      qpdf.callMain(args);
    } catch (qpdfError: any) {
      console.error('qpdf execution error:', qpdfError);
      throw new Error(
        getTranslations().encrypt.encryptionFailed.replace('{error}', qpdfError.message || getTranslations().addAttachments.unknownError)
      );
    }

    showLoader(getTranslations().encrypt.preparingDownload);
    const outputFile = qpdf.FS.readFile(outputPath, { encoding: 'binary' });

    if (!outputFile || outputFile.length === 0) {
      throw new Error(getTranslations().encrypt.emptyFile);
    }

    const blob = new Blob([outputFile], { type: 'application/pdf' });
    downloadFile(blob, `encrypted-${file.name}`);

    hideLoader();

    let successMessage = getTranslations().encrypt.successMessage;
    if (!hasDistinctOwnerPassword) {
      successMessage += ' ' + getTranslations().encrypt.successMessageNote;
    }

    showAlert(getTranslations().success, successMessage);
  } catch (error: any) {
    console.error('Error during PDF encryption:', error);
    hideLoader();
    showAlert(
      getTranslations().encrypt.encryptionFailedTitle,
      getTranslations().encrypt.errorOccurred.replace('{error}', error.message || 'The PDF might be corrupted.')
    );
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
