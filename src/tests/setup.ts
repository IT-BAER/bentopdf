import { afterEach, vi } from 'vitest';

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

// Mock DOMMatrix for pdfjs-dist
class DOMMatrixMock {
  a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
  m11 = 1; m12 = 0; m13 = 0; m14 = 0;
  m21 = 0; m22 = 1; m23 = 0; m24 = 0;
  m31 = 0; m32 = 0; m33 = 1; m34 = 0;
  m41 = 0; m42 = 0; m43 = 0; m44 = 1;
  is2D = true;
  isIdentity = true;
  
  constructor(init?: string | number[]) {
    if (Array.isArray(init) && init.length >= 6) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = init;
    }
  }
  
  multiply() { return new DOMMatrixMock(); }
  translate() { return new DOMMatrixMock(); }
  scale() { return new DOMMatrixMock(); }
  rotate() { return new DOMMatrixMock(); }
  inverse() { return new DOMMatrixMock(); }
  transformPoint() { return { x: 0, y: 0, z: 0, w: 1 }; }
  toFloat32Array() { return new Float32Array(16); }
  toFloat64Array() { return new Float64Array(16); }
}

global.DOMMatrix = DOMMatrixMock as unknown as typeof DOMMatrix;

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
