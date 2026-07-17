import { describe, it, expect } from 'vitest';
import { estimateTokens, estimateObjectTokens } from '../src/snapshot/token-estimator.js';

describe('token-estimator', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should estimate tokens for ASCII text', () => {
      // ~4 chars per token for ASCII
      const text = 'Hello World'; // 11 chars
      const estimated = estimateTokens(text);
      expect(estimated).toBeGreaterThan(0);
      expect(estimated).toBeLessThan(20);
    });

    it('should estimate tokens for CJK text', () => {
      // ~1 token per CJK character
      const text = '你好世界'; // 4 CJK chars
      const estimated = estimateTokens(text);
      expect(estimated).toBeGreaterThanOrEqual(4);
      expect(estimated).toBeLessThan(10);
    });

    it('should handle mixed ASCII and CJK', () => {
      const text = 'Hello 你好 World 世界';
      const estimated = estimateTokens(text);
      expect(estimated).toBeGreaterThan(0);
    });

    it('should add overhead for JSON structure', () => {
      const text = '{"key": "value"}';
      const estimated = estimateTokens(text);
      expect(estimated).toBeGreaterThan(0);
    });
  });

  describe('estimateObjectTokens', () => {
    it('should estimate tokens for simple object', () => {
      const obj = { name: 'test', value: 123 };
      const estimated = estimateObjectTokens(obj);
      expect(estimated).toBeGreaterThan(0);
    });

    it('should estimate tokens for nested object', () => {
      const obj = {
        level1: {
          level2: {
            level3: 'deep value',
          },
        },
      };
      const estimated = estimateObjectTokens(obj);
      expect(estimated).toBeGreaterThan(0);
    });

    it('should estimate tokens for array', () => {
      const arr = [1, 2, 3, 4, 5];
      const estimated = estimateObjectTokens(arr);
      expect(estimated).toBeGreaterThan(0);
    });

    it('should estimate tokens for complex structure', () => {
      const obj = {
        project: {
          name: 'test',
          languages: ['typescript', 'javascript'],
          stats: {
            files: 100,
            loc: 5000,
          },
        },
        facts: Array.from({ length: 10 }, (_, i) => ({
          id: i,
          name: `fact${i}`,
        })),
      };
      const estimated = estimateObjectTokens(obj);
      expect(estimated).toBeGreaterThan(50);
    });
  });
});
