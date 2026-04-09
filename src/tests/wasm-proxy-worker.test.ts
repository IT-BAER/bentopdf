import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from '../../cloudflare/wasm-proxy-worker.js';

describe('wasm-proxy-worker', () => {
  describe('isAllowedOrigin', () => {
    it('accepts configured origins', () => {
      expect(isAllowedOrigin('https://bentopdf.com')).toBe(true);
      expect(isAllowedOrigin('https://www.bentopdf.com')).toBe(true);
    });

    it('rejects prefix-matching attacker origins', () => {
      expect(isAllowedOrigin('https://bentopdf.com.evil.example')).toBe(false);
      expect(isAllowedOrigin('https://www.bentopdf.com.attacker.test')).toBe(
        false
      );
    });
  });
});
