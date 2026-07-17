import { describe, it, expect } from 'vitest';
import { compressSnapshot } from '../src/snapshot/compressor.js';
import type { ProjectSnapshot } from '../src/snapshot/builder.js';

describe('compressor', () => {
  const createLargeSnapshot = (factCount: number): ProjectSnapshot => ({
    project: {
      name: 'test-project',
      languages: ['typescript'],
      total_files: 100,
      loc: 5000,
    },
    key_facts: Array.from({ length: factCount }, (_, i) => ({
      id: i,
      type: 'function',
      filepath: `src/file${i}.ts`,
      summary: `Function ${i} in src/file${i}.ts (100 lines)`,
      score: Math.random(),
    })),
    recent_decisions: Array.from({ length: Math.min(factCount, 30) }, (_, i) => ({
      fact_id: i,
      commit_hash: `abc${i}`,
      author: 'user',
      timestamp: new Date().toISOString(),
      change_type: 'modification',
      description: `Change ${i}`,
    })),
    evidence_stats: {
      total: factCount * 5,
      by_type: {
        git_commit: factCount * 3,
        test_coverage: factCount,
        benchmark: factCount,
      },
    },
    top_evidence: Array.from({ length: Math.min(factCount, 20) }, (_, i) => ({
      fact_id: i,
      filepath: `src/file${i}.ts`,
      evidence_type: 'git_commit',
      description: `Evidence ${i}`,
      score: Math.random(),
    })),
  });

  describe('compressSnapshot', () => {
    it('should not compress small snapshots', () => {
      const snapshot = createLargeSnapshot(5);
      const compressed = compressSnapshot(snapshot, 50000);

      expect(compressed._compressed).toBe(false);
      expect(compressed.key_facts.length).toBe(5);
      expect(compressed.recent_decisions.length).toBe(5);
    });

    it('should compress large snapshots', () => {
      const snapshot = createLargeSnapshot(200);
      const compressed = compressSnapshot(snapshot, 1000);

      expect(compressed._compressed).toBe(true);
      expect(compressed.key_facts.length).toBeLessThan(200);
      expect(compressed.recent_decisions.length).toBeLessThan(30);
      expect(compressed.top_evidence.length).toBeLessThan(20);
    });

    it('should preserve project info after compression', () => {
      const snapshot = createLargeSnapshot(200);
      const compressed = compressSnapshot(snapshot, 1000);

      expect(compressed.project.name).toBe('test-project');
      expect(compressed.project.languages).toEqual(['typescript']);
    });

    it('should track token estimates', () => {
      const snapshot = createLargeSnapshot(200);
      const compressed = compressSnapshot(snapshot, 1000);

      expect(compressed._original_token_estimate).toBeGreaterThan(0);
      expect(compressed._compressed_token_estimate).toBeGreaterThan(0);
      expect(compressed._compressed_token_estimate).toBeLessThan(compressed._original_token_estimate);
    });

    it('should handle empty snapshot', () => {
      const snapshot = createLargeSnapshot(0);
      const compressed = compressSnapshot(snapshot, 50000);

      expect(compressed._compressed).toBe(false);
      expect(compressed.key_facts.length).toBe(0);
    });
  });
});
