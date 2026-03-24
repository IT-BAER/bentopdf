/**
 * LibreOffice WASM Converter Wrapper
 *
 * Uses @matbee/libreoffice-converter package for document conversion.
 * Handles progress tracking and provides simpler API.
 */

import {
  BrowserConverter,
  WorkerBrowserConverter,
} from '@matbee/libreoffice-converter/browser';

const LIBREOFFICE_LOCAL_PATH = import.meta.env.BASE_URL + 'libreoffice-wasm/';

export interface LoadProgress {
  phase: 'loading' | 'initializing' | 'converting' | 'complete' | 'ready';
  percent: number;
  message: string;
}

export type ProgressCallback = (progress: LoadProgress) => void;

interface LibreOfficeRuntimeConverter {
  initialize(): Promise<void>;
  convert(
    input: Uint8Array | ArrayBuffer,
    options: any,
    filename?: string
  ): Promise<{ data: Uint8Array; mimeType: string }>;
  destroy(): Promise<void>;
}

// Singleton for converter instance
let converterInstance: LibreOfficeConverter | null = null;

export class LibreOfficeConverter {
  private converter: LibreOfficeRuntimeConverter | null = null;
  private initialized = false;
  private initializing = false;
  private basePath: string;
  private usingMainThreadFallback = false;
  private converterMode: 'worker' | 'main-thread' | null = null;
  private static readonly WORKER_CONVERSION_TIMEOUT_MS = 120_000;
  private static readonly MAIN_THREAD_CONVERSION_TIMEOUT_MS = 240_000;

  constructor(basePath?: string) {
    this.basePath = basePath || LIBREOFFICE_LOCAL_PATH;
  }

  private createProgressHandler(onProgress?: ProgressCallback) {
    return (info: { phase: string; percent: number }) => {
      if (!onProgress || this.initialized) {
        return;
      }

      const simplifiedMessage = `Loading conversion engine (${Math.round(info.percent)}%)...`;
      onProgress({
        phase: info.phase as LoadProgress['phase'],
        percent: info.percent,
        message: simplifiedMessage,
      });
    };
  }

  private createWorkerConverter(
    progressHandler:
      | ((info: { phase: string; percent: number }) => void)
      | undefined
  ): WorkerBrowserConverter {
    return new WorkerBrowserConverter({
      sofficeJs: `${this.basePath}soffice.js`,
      sofficeWasm: `${this.basePath}soffice.wasm.gz`,
      sofficeData: `${this.basePath}soffice.data.gz`,
      sofficeWorkerJs: `${this.basePath}soffice.worker.js`,
      browserWorkerJs: `${this.basePath}browser.worker.global.js`,
      verbose: false,
      onProgress: progressHandler,
      onReady: () => {
        console.log('[LibreOffice] Ready!');
      },
      onError: (error: Error) => {
        console.error('[LibreOffice] Error:', error);
      },
    });
  }

  private createMainThreadConverter(
    progressHandler:
      | ((info: { phase: string; percent: number }) => void)
      | undefined
  ): BrowserConverter {
    return new BrowserConverter({
      sofficeJs: `${this.basePath}soffice.js`,
      sofficeWasm: `${this.basePath}soffice.wasm.gz`,
      sofficeData: `${this.basePath}soffice.data.gz`,
      sofficeWorkerJs: `${this.basePath}soffice.worker.js`,
      verbose: false,
      onProgress: progressHandler,
      onReady: () => {
        console.log('[LibreOffice] Ready!');
      },
      onError: (error: Error) => {
        console.error('[LibreOffice] Error:', error);
      },
    });
  }

  private isWorkerStartupError(error: unknown): boolean {
    const message = (
      error instanceof Error ? error.message : String(error)
    ).toLowerCase();
    return (
      message.includes('worker load timeout') ||
      message.includes('wasm initialization timeout') ||
      message.includes('failed to construct') ||
      message.includes('securityerror') ||
      message.includes('importscripts')
    );
  }

  private isWorkerHangError(error: unknown): boolean {
    const message = (
      error instanceof Error ? error.message : String(error)
    ).toLowerCase();
    return (
      message.includes('timed out') ||
      message.includes('timeout') ||
      message.includes('message channel closed') ||
      message.includes('worker')
    );
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private async activateMainThreadFallback(): Promise<void> {
    if (this.converter) {
      try {
        await this.converter.destroy();
      } catch {
        // Ignore cleanup failures and continue with fallback init.
      }
    }

    const fallbackConverter = this.createMainThreadConverter(undefined);
    this.converter = fallbackConverter;
    await fallbackConverter.initialize();
    this.usingMainThreadFallback = true;
    this.converterMode = 'main-thread';
  }

  async initialize(onProgress?: ProgressCallback): Promise<void> {
    if (this.initialized) return;

    if (this.initializing) {
      while (this.initializing) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return;
    }

    this.initializing = true;
    let progressCallback = onProgress; // Store original callback
    const progressHandler = this.createProgressHandler((progress) =>
      progressCallback?.(progress)
    );

    try {
      progressCallback?.({
        phase: 'loading',
        percent: 0,
        message: 'Loading conversion engine...',
      });

      const workerConverter = this.createWorkerConverter(progressHandler);
      this.converter = workerConverter;

      try {
        await workerConverter.initialize();
        this.usingMainThreadFallback = false;
        this.converterMode = 'worker';
      } catch (workerError) {
        const startupIssue = this.isWorkerStartupError(workerError);

        try {
          await workerConverter.destroy();
        } catch {
          // Best-effort cleanup before trying fallback converter.
        }

        if (!startupIssue) {
          throw workerError;
        }

        console.warn(
          '[LibreOffice] Worker initialization failed; falling back to main-thread converter.',
          workerError
        );

        const fallbackConverter =
          this.createMainThreadConverter(progressHandler);
        this.converter = fallbackConverter;
        await fallbackConverter.initialize();
        this.usingMainThreadFallback = true;
        this.converterMode = 'main-thread';
      }

      this.initialized = true;

      // Call completion message
      progressCallback?.({
        phase: 'ready',
        percent: 100,
        message: 'Conversion engine ready!',
      });

      // Null out the callback to prevent any late-firing progress updates
      progressCallback = undefined;
    } finally {
      this.initializing = false;
    }
  }

  isReady(): boolean {
    return this.initialized && this.converter !== null;
  }

  async convertToPdf(file: File): Promise<Blob> {
    if (!this.converter) {
      throw new Error('Converter not initialized');
    }

    console.log(`[LibreOffice] Converting ${file.name} to PDF...`);
    console.log(
      `[LibreOffice] File type: ${file.type}, Size: ${file.size} bytes`
    );

    if (this.usingMainThreadFallback) {
      console.log(
        '[LibreOffice] Using main-thread fallback converter for this session.'
      );
    }

    console.log(`[LibreOffice] Reading file as ArrayBuffer...`);
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    console.log(`[LibreOffice] File loaded, ${uint8Array.length} bytes`);

    console.log(`[LibreOffice] Calling converter.convert() with buffer...`);

    // Detect input format - critical for CSV to apply import filters
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    console.log(`[LibreOffice] Detected format from extension: ${ext}`);

    const convertOptions = {
      outputFormat: 'pdf',
      inputFormat: ext as any,
    };

    const timeoutMs =
      this.converterMode === 'worker'
        ? LibreOfficeConverter.WORKER_CONVERSION_TIMEOUT_MS
        : LibreOfficeConverter.MAIN_THREAD_CONVERSION_TIMEOUT_MS;
    const timeoutMessage =
      this.converterMode === 'worker'
        ? 'Worker conversion timed out while processing the document.'
        : 'Main-thread conversion timed out while processing the document.';

    try {
      const startTime = Date.now();
      const converted = await this.withTimeout(
        this.converter.convert(uint8Array, convertOptions, file.name),
        timeoutMs,
        timeoutMessage
      );

      const duration = Date.now() - startTime;
      console.log(
        `[LibreOffice] Conversion complete! Duration: ${duration}ms, Size: ${converted.data.length} bytes`
      );

      // Create a copy to avoid SharedArrayBuffer type issues
      const data = new Uint8Array(converted.data);
      return new Blob([data], { type: converted.mimeType });
    } catch (error) {
      if (this.converterMode === 'worker' && this.isWorkerHangError(error)) {
        console.warn(
          '[LibreOffice] Worker conversion appears stuck; retrying in main-thread fallback mode.',
          error
        );

        await this.activateMainThreadFallback();

        const retryStart = Date.now();
        const retryResult = await this.withTimeout(
          this.converter.convert(uint8Array, convertOptions, file.name),
          LibreOfficeConverter.MAIN_THREAD_CONVERSION_TIMEOUT_MS,
          'Main-thread conversion timed out while retrying the document.'
        );

        const retryDuration = Date.now() - retryStart;
        console.log(
          `[LibreOffice] Main-thread fallback conversion complete! Duration: ${retryDuration}ms, Size: ${retryResult.data.length} bytes`
        );

        const retryData = new Uint8Array(retryResult.data);
        return new Blob([retryData], { type: retryResult.mimeType });
      }

      console.error(`[LibreOffice] Conversion FAILED for ${file.name}:`, error);
      console.error(`[LibreOffice] Error details:`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async wordToPdf(file: File): Promise<Blob> {
    return this.convertToPdf(file);
  }

  async pptToPdf(file: File): Promise<Blob> {
    return this.convertToPdf(file);
  }

  async excelToPdf(file: File): Promise<Blob> {
    return this.convertToPdf(file);
  }

  async destroy(): Promise<void> {
    if (this.converter) {
      await this.converter.destroy();
    }
    this.converter = null;
    this.initialized = false;
    this.usingMainThreadFallback = false;
    this.converterMode = null;
  }
}

export function getLibreOfficeConverter(
  basePath?: string
): LibreOfficeConverter {
  if (!converterInstance) {
    converterInstance = new LibreOfficeConverter(basePath);
  }
  return converterInstance;
}
