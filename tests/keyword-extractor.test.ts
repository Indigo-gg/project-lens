import { describe, it, expect } from 'vitest';
import { extractKeywords } from '../src/verify/keyword-extractor.js';

describe('keyword-extractor', () => {
  describe('extractKeywords', () => {
    it('should extract technology entities', () => {
      const result = extractKeywords('Used Redis for caching and Kafka for messaging');
      expect(result.entities).toContain('redis');
      expect(result.entities).toContain('kafka');
    });

    it('should extract architecture patterns', () => {
      const result = extractKeywords('Implemented microservice architecture with REST API');
      expect(result.entities).toContain('microservice');
      expect(result.entities).toContain('rest');
    });

    it('should extract numbers', () => {
      const result = extractKeywords('Improved latency from 100ms to 50ms');
      expect(result.numbers).toContain('100ms');
      expect(result.numbers).toContain('50ms');
    });

    it('should extract general keywords', () => {
      const result = extractKeywords('Optimized database query performance');
      expect(result.keywords.length).toBeGreaterThan(0);
      // Should not include stop words
      expect(result.keywords).not.toContain('the');
      expect(result.keywords).not.toContain('and');
    });

    it('should handle empty input', () => {
      const result = extractKeywords('');
      expect(result.keywords).toEqual([]);
      expect(result.entities).toEqual([]);
      expect(result.numbers).toEqual([]);
    });

    it('should handle Chinese text', () => {
      const result = extractKeywords('优化了Redis缓存性能');
      expect(result.entities).toContain('redis');
    });

    it('should deduplicate results', () => {
      const result = extractKeywords('Redis redis REDIS');
      const uniqueEntities = [...new Set(result.entities)];
      expect(result.entities.length).toBe(uniqueEntities.length);
    });

    it('should filter out short words', () => {
      const result = extractKeywords('I am a test for the API');
      // 'a', 'I' should be filtered out as they are stop words or too short
      expect(result.keywords).not.toContain('a');
      expect(result.keywords).not.toContain('am');
    });
  });
});
