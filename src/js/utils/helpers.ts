import createModule from '@neslinesli93/qpdf-wasm';
import type { QpdfInstanceExtended } from '@/types';
import { showLoader, hideLoader, showAlert } from '../ui.js';
import { createIcons } from 'lucide';
import { state, resetState } from '../state.js';
import * as pdfjsLib from 'pdfjs-dist';
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api';

const STANDARD_SIZES = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
  Legal: { width: 612, height: 1008 },
  Tabloid: { width: 792, height: 1224 },
  A3: { width: 841.89, height: 1190.55 },
  A5: { width: 419.53, height: 595.28 },
};

export function getStandardPageName(width: number, height: number) {
  const tolerance = 1; // Allow for minor floating point variations
  for (const [name, size] of Object.entries(STANDARD_SIZES)) {
    if (
      (Math.abs(width - size.width) < tolerance &&
        Math.abs(height - size.height) < tolerance) ||
      (Math.abs(width - size.height) < tolerance &&
        Math.abs(height - size.width) < tolerance)
    ) {
      return name;
    }
  }
  return 'Custom';
}

export function convertPoints(points: number, unit: string) {
  let result: number;
  switch (unit) {
    case 'in':
      result = points / 72;
      break;
    case 'mm':
      result = (points / 72) * 25.4;
      break;
    case 'px':
      result = points * (96 / 72); // Assuming 96 DPI
      break;
    default: // 'pt'
      result = points;
      break;
  }
  return result.toFixed(2);
}

// Convert hex color to RGB
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : { r: 0, g: 0, b: 0 };
}

export const formatBytes = (bytes: number, decimals = 1) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Get MIME type configuration for File System Access API
 */
const getMimeTypeConfig = (
  filename: string
): { description: string; mimeType: string; extensions: string[] } => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  const mimeTypes: Record<
    string,
    { description: string; mimeType: string; extensions: string[] }
  > = {
    pdf: {
      description: 'PDF Document',
      mimeType: 'application/pdf',
      extensions: ['.pdf'],
    },
    zip: {
      description: 'ZIP Archive',
      mimeType: 'application/zip',
      extensions: ['.zip'],
    },
    jpg: {
      description: 'JPEG Image',
      mimeType: 'image/jpeg',
      extensions: ['.jpg', '.jpeg'],
    },
    jpeg: {
      description: 'JPEG Image',
      mimeType: 'image/jpeg',
      extensions: ['.jpg', '.jpeg'],
    },
    png: {
      description: 'PNG Image',
      mimeType: 'image/png',
      extensions: ['.png'],
    },
    webp: {
      description: 'WebP Image',
      mimeType: 'image/webp',
      extensions: ['.webp'],
    },
    svg: {
      description: 'SVG Image',
      mimeType: 'image/svg+xml',
      extensions: ['.svg'],
    },
    bmp: {
      description: 'BMP Image',
      mimeType: 'image/bmp',
      extensions: ['.bmp'],
    },
    tiff: {
      description: 'TIFF Image',
      mimeType: 'image/tiff',
      extensions: ['.tiff', '.tif'],
    },
    tif: {
      description: 'TIFF Image',
      mimeType: 'image/tiff',
      extensions: ['.tiff', '.tif'],
    },
    txt: {
      description: 'Text File',
      mimeType: 'text/plain',
      extensions: ['.txt'],
    },
    csv: {
      description: 'CSV File',
      mimeType: 'text/csv',
      extensions: ['.csv'],
    },
    json: {
      description: 'JSON File',
      mimeType: 'application/json',
      extensions: ['.json'],
    },
    docx: {
      description: 'Word Document',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extensions: ['.docx'],
    },
    xlsx: {
      description: 'Excel Spreadsheet',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extensions: ['.xlsx'],
    },
    md: {
      description: 'Markdown File',
      mimeType: 'text/markdown',
      extensions: ['.md'],
    },
  };

  return (
    mimeTypes[ext] || {
      description: 'File',
      mimeType: 'application/octet-stream',
      extensions: [`.${ext}`],
    }
  );
};

/**
 * File System Access pickers (showOpenFilePicker / showSaveFilePicker) throw a
 * SecurityError inside cross-origin iframes ("Cross origin sub frames aren't
 * allowed to show a file picker"). Returns true only when the picker can
 * actually be used: API present AND not in a cross-origin subframe.
 */
export function canUseFileSystemAccess(
  apiName: 'showOpenFilePicker' | 'showSaveFilePicker'
): boolean {
  if (!(apiName in window)) return false;
  try {
    // Not framed, or same-origin top => allowed. Cross-origin => reading
    // window.top.location.origin throws => not allowed.
    return (
      window.self === window.top ||
      window.top?.location.origin === window.location.origin
    );
  } catch {
    return false;
  }
}

/**
 * Download a file with optional "Save As" dialog
 * Uses File System Access API on supported browsers (Chrome, Edge, Opera)
 * Falls back to traditional download on unsupported browsers (Firefox, Safari)
 * and inside cross-origin iframes (where the picker is blocked).
 */
export const downloadFile = async (
  blob: Blob,
  filename: string,
  options?: { startIn?: FileSystemHandle }
): Promise<void> => {
  // Use the Save As dialog only where the picker is actually allowed.
  if (canUseFileSystemAccess('showSaveFilePicker')) {
    try {
      const config = getMimeTypeConfig(filename);

      const pickerOptions: Record<string, unknown> = {
        suggestedName: filename,
        types: [
          {
            description: config.description,
            accept: { [config.mimeType]: config.extensions },
          },
        ],
      };

      // Default the save dialog to the folder the source file came from.
      // `startIn` accepts a FileSystemHandle and opens the picker in its
      // containing directory (Chromium only; ignored elsewhere).
      if (options?.startIn) {
        pickerOptions.startIn = options.startIn;
      }

      const handle = await (window as any).showSaveFilePicker(pickerOptions);

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err: any) {
      // User cancelled the save dialog - don't fall back to automatic download
      if (err.name === 'AbortError') {
        return;
      }
      // For other errors, fall back to traditional download
      console.warn(
        'File System Access API failed, falling back to traditional download:',
        err
      );
    }
  }

  // Fallback for browsers that don't support File System Access API
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const readFileAsArrayBuffer = (
  file: Blob
): Promise<ArrayBuffer | null> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer | null);
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

export function parsePageRanges(
  rangeString: string,
  totalPages: number
): number[] {
  if (!rangeString || rangeString.trim() === '') {
    return Array.from({ length: totalPages }, (_, i) => i);
  }

  const indices = new Set<number>();
  const parts = rangeString.split(',');

  for (const part of parts) {
    const trimmedPart = part.trim();
    if (!trimmedPart) continue;

    if (trimmedPart.includes('-')) {
      const [start, end] = trimmedPart.split('-').map(Number);
      if (
        isNaN(start) ||
        isNaN(end) ||
        start < 1 ||
        end > totalPages ||
        start > end
      ) {
        console.warn(`Invalid range skipped: ${trimmedPart}`);
        continue;
      }

      for (let i = start; i <= end; i++) {
        indices.add(i - 1);
      }
    } else {
      const pageNum = Number(trimmedPart);

      if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
        console.warn(`Invalid page number skipped: ${trimmedPart}`);
        continue;
      }
      indices.add(pageNum - 1);
    }
  }

  return Array.from(indices).sort((a, b) => a - b);
}

/**
 * Formats an ISO 8601 date string (e.g., "2008-02-21T17:15:56-08:00")
 * into a localized, human-readable string.
 * @param {string} isoDateString - The ISO 8601 date string.
 * @returns {string} A localized date and time string, or the original string if parsing fails.
 */
export function formatIsoDate(isoDateString: string) {
  if (!isoDateString || typeof isoDateString !== 'string') {
    return isoDateString; // Return original value if it's not a valid string
  }
  try {
    const date = new Date(isoDateString);
    // Check if the date object is valid
    if (isNaN(date.getTime())) {
      return isoDateString; // Return original string if the date is invalid
    }
    return date.toLocaleString();
  } catch (e) {
    console.error('Could not parse ISO date:', e);
    return isoDateString; // Return original string on any error
  }
}

let qpdfInstance: QpdfInstanceExtended | null = null;

/**
 * Initialize qpdf-wasm singleton.
 * Subsequent calls return the same instance.
 */
export async function initializeQpdf(): Promise<QpdfInstanceExtended> {
  if (qpdfInstance) return qpdfInstance;

  showLoader('Initializing PDF engine...');
  try {
    qpdfInstance = (await createModule({
      locateFile: () => import.meta.env.BASE_URL + 'qpdf.wasm',
    })) as unknown as QpdfInstanceExtended;
  } catch (error) {
    console.error('Failed to initialize qpdf-wasm:', error);
    showAlert(
      'Initialization Error',
      'Could not load the PDF engine. Please refresh the page and try again.'
    );
    throw error;
  } finally {
    hideLoader();
  }

  return qpdfInstance;
}

export function initializeIcons(): void {
  createIcons({
    attrs: {
      class: 'bento-icon',
      'stroke-width': '1.5',
    },
  });
}

export function formatStars(num: number) {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

/**
 * Truncates a filename to a maximum length, adding ellipsis if needed.
 * Preserves the file extension.
 * @param filename - The filename to truncate
 * @param maxLength - Maximum length (default: 30)
 * @returns Truncated filename with ellipsis if needed
 */
export function truncateFilename(
  filename: string,
  maxLength: number = 25
): string {
  if (filename.length <= maxLength) {
    return filename;
  }

  const lastDotIndex = filename.lastIndexOf('.');
  const extension = lastDotIndex !== -1 ? filename.substring(lastDotIndex) : '';
  const nameWithoutExt =
    lastDotIndex !== -1 ? filename.substring(0, lastDotIndex) : filename;

  const availableLength = maxLength - extension.length - 3; // 3 for '...'

  if (availableLength <= 0) {
    return filename.substring(0, maxLength - 3) + '...';
  }

  return nameWithoutExt.substring(0, availableLength) + '...' + extension;
}

export function formatShortcutDisplay(
  shortcut: string,
  isMac: boolean
): string {
  if (!shortcut) return '';
  return shortcut
    .replace('mod', isMac ? '⌘' : 'Ctrl')
    .replace('ctrl', isMac ? '^' : 'Ctrl') // Control key on Mac shows as ^
    .replace('alt', isMac ? '⌥' : 'Alt')
    .replace('shift', 'Shift')
    .split('+')
    .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
    .join(isMac ? '' : '+');
}

export function resetAndReloadTool(preResetCallback?: () => void) {
  const toolid = state.activeTool;

  if (preResetCallback) {
    preResetCallback();
  }

  resetState();

  if (toolid) {
    const element = document.querySelector(
      `[data-tool-id="${toolid}"]`
    ) as HTMLElement;
    if (element) element.click();
  }
}

/**
 * Wrapper for pdfjsLib.getDocument that adds the required wasmUrl configuration.
 * Use this instead of calling pdfjsLib.getDocument directly.
 * @param src The source to load (url string, typed array, or parameters object)
 * @returns The PDF loading task
 */
export function getPDFDocument(
  src: string | Uint8Array | ArrayBuffer | DocumentInitParameters
) {
  let params: DocumentInitParameters;

  if (typeof src === 'string') {
    params = { url: src };
  } else if (src instanceof Uint8Array || src instanceof ArrayBuffer) {
    params = { data: src };
  } else {
    params = src;
  }

  return pdfjsLib.getDocument({
    ...params,
    wasmUrl: import.meta.env.BASE_URL + 'pdfjs-viewer/wasm/',
  });
}

/**
 * Escape HTML special characters to prevent XSS
 * @param text - The text to escape
 * @returns The escaped text
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    chunks.push(String.fromCharCode(...chunk));
  }
  return btoa(chunks.join(''));
}

const EMAIL_BLOCKED_TAGS = new Set([
  'base',
  'button',
  'embed',
  'form',
  'iframe',
  'input',
  'link',
  'meta',
  'object',
  'script',
  'select',
  'source',
  'style',
  'textarea',
  'track',
  'video',
]);

const EMAIL_STRIPPED_ATTRIBUTES = new Set([
  'align',
  'bgcolor',
  'border',
  'cellpadding',
  'cellspacing',
  'class',
  'dir',
  'height',
  'id',
  'originalsrc',
  'role',
  'style',
  'valign',
  'width',
]);

function unwrapOutlookSafeLink(value: string): string {
  try {
    const parsed = new URL(value);
    if (!parsed.hostname.endsWith('safelinks.protection.outlook.com')) {
      return value;
    }

    const decodedUrl = parsed.searchParams.get('url');
    return decodedUrl ? decodeURIComponent(decodedUrl) : value;
  } catch {
    return value;
  }
}

function sanitizeEmailHref(value: string): string | null {
  let normalized = unwrapOutlookSafeLink(value.trim());
  if (!normalized) return null;

  const lower = normalized.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) {
    return null;
  }

  if (normalized.length > 500) {
    const baseUrl = normalized.split('?')[0];
    normalized =
      baseUrl && baseUrl.length < 200 ? baseUrl : normalized.slice(0, 200);
  }

  return normalized;
}

function isEmbeddedResourceUrl(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('cid:') || normalized.startsWith('data:');
}

function isEmbeddedSrcset(value: string): boolean {
  return value
    .split(',')
    .map((entry) => entry.trim().split(/\s+/)[0])
    .filter(Boolean)
    .every(isEmbeddedResourceUrl);
}

function sanitizeEmailHtmlWithDom(html: string): string {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, 'text/html');

  for (const element of Array.from(document.body.querySelectorAll('*'))) {
    const tagName = element.tagName.toLowerCase();
    if (EMAIL_BLOCKED_TAGS.has(tagName)) {
      element.remove();
      continue;
    }

    if (
      tagName === 'img' &&
      ((element.getAttribute('width') === '1' &&
        element.getAttribute('height') === '1') ||
        element.getAttribute('style')?.includes('display:none'))
    ) {
      element.remove();
      continue;
    }

    for (const attributeName of element.getAttributeNames()) {
      const lowerName = attributeName.toLowerCase();
      const attributeValue = element.getAttribute(attributeName) || '';

      if (
        lowerName.startsWith('on') ||
        lowerName.startsWith('data-') ||
        lowerName === 'srcdoc' ||
        EMAIL_STRIPPED_ATTRIBUTES.has(lowerName)
      ) {
        element.removeAttribute(attributeName);
        continue;
      }

      if (lowerName === 'href') {
        const safeHref = sanitizeEmailHref(attributeValue);
        if (safeHref) {
          element.setAttribute('href', safeHref);
        } else {
          element.removeAttribute(attributeName);
        }
        continue;
      }

      if (lowerName === 'srcset') {
        if (!isEmbeddedSrcset(attributeValue)) {
          element.removeAttribute(attributeName);
        }
        continue;
      }

      if (
        ['background', 'poster', 'src'].includes(lowerName) &&
        !isEmbeddedResourceUrl(attributeValue)
      ) {
        element.removeAttribute(attributeName);
      }
    }
  }

  return document.body.innerHTML;
}

function sanitizeEmailHtmlFallback(html: string): string {
  let sanitized = html;

  sanitized = sanitized.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
  sanitized = sanitized.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<link[^>]*>/gi, '');
  sanitized = sanitized.replace(
    /<(base|button|embed|form|iframe|input|meta|object|select|source|textarea|track|video)[^>]*>[\s\S]*?<\/\1>/gi,
    ''
  );
  sanitized = sanitized.replace(
    /<(base|button|embed|form|iframe|input|meta|object|select|source|textarea|track|video)[^>]*\/?\s*>/gi,
    ''
  );
  sanitized = sanitized.replace(/\s+style=["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s+class=["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s+data-[a-z-]+=["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(
    /\s+on[a-z-]+=(?:["'][^"']*["']|[^\s>]+)/gi,
    ''
  );
  sanitized = sanitized.replace(/\s+srcdoc=["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(
    /<img[^>]*(?:width=["']1["'][^>]*height=["']1["']|height=["']1["'][^>]*width=["']1["'])[^>]*\/?>/gi,
    ''
  );
  sanitized = sanitized.replace(/\s+originalsrc=["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s+srcset=["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(
    /\s+(background|poster|src)=["'](?!(?:cid:|data:))[^"']*["']/gi,
    ''
  );
  sanitized = sanitized.replace(
    /\s+href=["'](?:javascript:|data:)[^"']*["']/gi,
    ''
  );

  return sanitized;
}

export function sanitizeEmailHtml(html: string): string {
  if (!html) return html;

  let sanitized =
    typeof DOMParser === 'undefined'
      ? sanitizeEmailHtmlFallback(html)
      : sanitizeEmailHtmlWithDom(html);

  sanitized = sanitized.replace(
    /\s+(cellpadding|cellspacing|bgcolor|border|valign|align|width|height|role|dir|id)=["'][^"']*["']/gi,
    ''
  );
  sanitized = sanitized.replace(/<\/?table[^>]*>/gi, '<div>');
  sanitized = sanitized.replace(/<\/?tbody[^>]*>/gi, '');
  sanitized = sanitized.replace(/<\/?thead[^>]*>/gi, '');
  sanitized = sanitized.replace(/<\/?tfoot[^>]*>/gi, '');
  sanitized = sanitized.replace(/<tr[^>]*>/gi, '<div>');
  sanitized = sanitized.replace(/<\/tr>/gi, '</div>');
  sanitized = sanitized.replace(/<td[^>]*>/gi, '<span> ');
  sanitized = sanitized.replace(/<\/td>/gi, ' </span>');
  sanitized = sanitized.replace(/<th[^>]*>/gi, '<strong> ');
  sanitized = sanitized.replace(/<\/th>/gi, ' </strong>');
  sanitized = sanitized.replace(/<div>\s*<\/div>/gi, '');
  sanitized = sanitized.replace(/<span>\s*<\/span>/gi, '');
  sanitized = sanitized.replace(/(<div>)+/gi, '<div>');
  sanitized = sanitized.replace(/(<\/div>)+/gi, '</div>');
  sanitized = sanitized.replace(
    /<a[^>]*href=["']\s*["'][^>]*>([^<]*)<\/a>/gi,
    '$1'
  );

  const MAX_HTML_SIZE = 100000;
  if (sanitized.length > MAX_HTML_SIZE) {
    const truncateAt = sanitized.lastIndexOf('</div>', MAX_HTML_SIZE);
    if (truncateAt > MAX_HTML_SIZE / 2) {
      sanitized = sanitized.substring(0, truncateAt) + '</div></body></html>';
    } else {
      sanitized = sanitized.substring(0, MAX_HTML_SIZE) + '...</body></html>';
    }
  }

  return sanitized;
}

/**
 * Formats a raw RFC 2822 date string into a nicer human-readable format,
 * while preserving the original timezone and time.
 * Example input: "Sun, 8 Jan 2017 20:37:44 +0200"
 * Example output: "Sunday, January 8, 2017 at 8:37 PM (+0200)"
 */
export function formatRawDate(raw: string): string {
  try {
    const match = raw.match(
      /([A-Za-z]{3}),\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s+([+-]\d{4})/
    );

    if (match) {
      const [
        ,
        dayAbbr,
        dom,
        monthAbbr,
        year,
        hoursStr,
        minsStr,
        _secsStr,
        timezone,
      ] = match;

      const days: Record<string, string> = {
        Sun: 'Sunday',
        Mon: 'Monday',
        Tue: 'Tuesday',
        Wed: 'Wednesday',
        Thu: 'Thursday',
        Fri: 'Friday',
        Sat: 'Saturday',
      };
      const months: Record<string, string> = {
        Jan: 'January',
        Feb: 'February',
        Mar: 'March',
        Apr: 'April',
        May: 'May',
        Jun: 'June',
        Jul: 'July',
        Aug: 'August',
        Sep: 'September',
        Oct: 'October',
        Nov: 'November',
        Dec: 'December',
      };

      const fullDay = days[dayAbbr] || dayAbbr;
      const fullMonth = months[monthAbbr] || monthAbbr;

      let hours = parseInt(hoursStr, 10);
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const tzSign = timezone.substring(0, 1);
      const tzHours = timezone.substring(1, 3);
      const tzMins = timezone.substring(3, 5);
      const formattedTz = `UTC${tzSign}${tzHours}:${tzMins}`;

      return `${fullDay}, ${fullMonth} ${dom}, ${year} at ${hours}:${minsStr} ${ampm} (${formattedTz})`;
    }
  } catch {
    console.error('Error parsing date string:', raw);
  }
  return raw;
}

/**
 * Returns a sanitized PDF filename.
 *
 * The provided filename is processed as follows:
 * - Removes a trailing `.pdf` file extension (case-insensitive)
 * - Trims leading and trailing whitespace
 * - Truncates the name to a maximum of 80 characters
 *
 * @param filename The original filename (including extension)
 * @returns The sanitized filename without the `.pdf` extension, limited to 80 characters
 */
export function getCleanPdfFilename(filename: string): string {
  let clean = filename.replace(/\.pdf$/i, '').trim();
  if (clean.length > 80) {
    clean = clean.slice(0, 80);
  }
  return clean;
}
