import { deduplicateFileName } from '../utils/deduplicate-filename.js';

export function isPdfFile(file: Pick<File, 'type' | 'name'>): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  );
}

export function applyRotationAngle(
  rotations: number[],
  angle: number
): number[] {
  return rotations.map((rotation) => rotation + angle);
}

export function buildRotateOutputNames(fileNames: string[]): string[] {
  const usedNames = new Set<string>();
  return fileNames.map((fileName) => deduplicateFileName(fileName, usedNames));
}
