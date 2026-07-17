import { describe, it, expect } from 'vitest';
import { expandRequirement, expandSearchTerms } from '../src/query/requirement-expander.js';

describe('requirement-expander', () => {
  describe('expandRequirement', () => {
    it('should expand Redis to related terms', () => {
      const result = expandRequirement('Redis');
      expect(result.original).toBe('Redis');
      expect(result.searchTerms).toContain('redis');
      expect(result.searchTerms).toContain('ioredis');
      expect(result.searchTerms).toContain('cache');
      expect(result.searchTerms).toContain('pub/sub');
      // Note: category is only set from database synonyms, not built-in
    });

    it('should expand Performance to related terms', () => {
      const result = expandRequirement('Performance');
      expect(result.searchTerms).toContain('benchmark');
      expect(result.searchTerms).toContain('latency');
      expect(result.searchTerms).toContain('optimization');
    });

    it('should expand Security to related terms', () => {
      const result = expandRequirement('Security');
      expect(result.searchTerms).toContain('auth');
      expect(result.searchTerms).toContain('jwt');
      expect(result.searchTerms).toContain('oauth');
    });

    it('should handle unknown requirements with fallback', () => {
      const result = expandRequirement('UnknownTech');
      expect(result.searchTerms).toContain('unknowntech');
      expect(result.category).toBeNull();
    });

    it('should handle multi-word requirements', () => {
      const result = expandRequirement('high concurrency');
      expect(result.searchTerms).toContain('high concurrency');
      expect(result.searchTerms).toContain('high');
      expect(result.searchTerms).toContain('concurrency');
    });

    it('should deduplicate search terms', () => {
      const result = expandRequirement('Redis');
      const uniqueTerms = [...new Set(result.searchTerms)];
      expect(result.searchTerms.length).toBe(uniqueTerms.length);
    });
  });

  describe('expandSearchTerms', () => {
    it('should join terms with OR', () => {
      const result = expandSearchTerms(['redis', 'cache', 'ioredis']);
      expect(result).toBe('redis OR cache OR ioredis');
    });

    it('should handle single term', () => {
      const result = expandSearchTerms(['redis']);
      expect(result).toBe('redis');
    });

    it('should handle empty array', () => {
      const result = expandSearchTerms([]);
      expect(result).toBe('');
    });
  });
});
