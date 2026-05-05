import { describe, expect, it } from 'vitest';
import {
  applyRotationAngle,
  buildRotateOutputNames,
  isPdfFile,
} from '../js/logic/rotate-pdf-helpers.js';

describe('rotate-pdf-helpers', () => {
  it('identifies PDF files by mime type or extension', () => {
    expect(isPdfFile({ type: 'application/pdf', name: 'doc.bin' })).toBe(true);
    expect(isPdfFile({ type: '', name: 'doc.PDF' })).toBe(true);
    expect(isPdfFile({ type: 'image/png', name: 'doc.png' })).toBe(false);
  });

  it('applies same rotation delta to every page without mutating input', () => {
    const rotations = [0, 90, -180];
    const nextRotations = applyRotationAngle(rotations, 90);

    expect(nextRotations).toEqual([90, 180, -90]);
    expect(rotations).toEqual([0, 90, -180]);
  });

  it('deduplicates output names while preserving order', () => {
    expect(
      buildRotateOutputNames(['same.pdf', 'same.pdf', 'other.pdf', 'same.pdf'])
    ).toEqual(['same.pdf', 'same (1).pdf', 'other.pdf', 'same (2).pdf']);
  });
});
