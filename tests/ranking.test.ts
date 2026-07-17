import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { openDatabase, insertNode } from '../src/store.js';
import { rankEvidence } from '../src/query/ranking.js';

const TEST_DB_DIR = path.join(os.tmpdir(), 'project-lens-test');

describe('ranking', () => {
  let db: Database.Database;
  let close: () => void;
  let nodeIds: number[] = [];

  beforeAll(() => {
    if (!fs.existsSync(TEST_DB_DIR)) {
      fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    }

    const result = openDatabase('test-ranking');
    db = result.db;
    close = result.close;

    // Seed test data - just nodes, no evidence (evidence tests would need more setup)
    nodeIds = seedTestData();
  });

  afterAll(() => {
    close();
    const dbPath = path.join(TEST_DB_DIR, 'test-ranking.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  function seedTestData(): number[] {
    const ids: number[] = [];

    // Create nodes with different LOC values
    ids.push(insertNode(db, {
      project: 'test-ranking',
      label: 'function',
      name: 'largeFunc',
      qualified_name: 'src/large.ts::largeFunc',
      file_path: 'src/large.ts',
      start_line: 1,
      end_line: 500,
      loc: 500,
    }));

    ids.push(insertNode(db, {
      project: 'test-ranking',
      label: 'function',
      name: 'smallFunc',
      qualified_name: 'src/small.ts::smallFunc',
      file_path: 'src/small.ts',
      start_line: 1,
      end_line: 10,
      loc: 10,
    }));

    ids.push(insertNode(db, {
      project: 'test-ranking',
      label: 'class',
      name: 'mediumClass',
      qualified_name: 'src/medium.ts::mediumClass',
      file_path: 'src/medium.ts',
      start_line: 1,
      end_line: 100,
      loc: 100,
    }));

    return ids;
  }

  describe('rankEvidence', () => {
    it('should rank nodes by score', () => {
      const ranked = rankEvidence(db, 'test-ranking', nodeIds);

      expect(ranked.length).toBe(3);
      // Each result should have a valid score
      for (const r of ranked) {
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(1);
      }
      // Should be sorted by score descending
      expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
      expect(ranked[1].score).toBeGreaterThanOrEqual(ranked[2].score);
    });

    it('should give higher score to node with more LOC', () => {
      const ranked = rankEvidence(db, 'test-ranking', nodeIds);

      // The large function should have higher LOC score
      const largeFuncRank = ranked.find(r => {
        const node = db.prepare('SELECT name FROM nodes WHERE id = ?').get(r.nodeId) as { name: string };
        return node.name === 'largeFunc';
      });

      const smallFuncRank = ranked.find(r => {
        const node = db.prepare('SELECT name FROM nodes WHERE id = ?').get(r.nodeId) as { name: string };
        return node.name === 'smallFunc';
      });

      expect(largeFuncRank).toBeDefined();
      expect(smallFuncRank).toBeDefined();
      expect(largeFuncRank!.breakdown.loc).toBeGreaterThan(smallFuncRank!.breakdown.loc);
    });

    it('should return empty array for empty nodeIds', () => {
      const ranked = rankEvidence(db, 'test-ranking', []);
      expect(ranked).toEqual([]);
    });

    it('should respect custom weights', () => {
      const rankedDefault = rankEvidence(db, 'test-ranking', nodeIds);
      const rankedCustom = rankEvidence(db, 'test-ranking', nodeIds, {
        weights: {
          benchmark: 0.1,
          tests: 0.1,
          gitEvolution: 0.1,
          loc: 0.5, // Much higher weight for LOC
          recency: 0.1,
          complexity: 0.1,
        },
      });

      // Scores should be different with different weights
      expect(rankedDefault[0].score).not.toBe(rankedCustom[0].score);
    });

    it('should have valid breakdown', () => {
      const ranked = rankEvidence(db, 'test-ranking', nodeIds);

      for (const r of ranked) {
        expect(r.breakdown).toBeDefined();
        expect(r.breakdown.benchmark).toBeGreaterThanOrEqual(0);
        expect(r.breakdown.benchmark).toBeLessThanOrEqual(1);
        expect(r.breakdown.tests).toBeGreaterThanOrEqual(0);
        expect(r.breakdown.tests).toBeLessThanOrEqual(1);
        expect(r.breakdown.gitEvolution).toBeGreaterThanOrEqual(0);
        expect(r.breakdown.gitEvolution).toBeLessThanOrEqual(1);
        expect(r.breakdown.loc).toBeGreaterThanOrEqual(0);
        expect(r.breakdown.loc).toBeLessThanOrEqual(1);
        expect(r.breakdown.recency).toBeGreaterThanOrEqual(0);
        expect(r.breakdown.recency).toBeLessThanOrEqual(1);
        expect(r.breakdown.complexity).toBeGreaterThanOrEqual(0);
        expect(r.breakdown.complexity).toBeLessThanOrEqual(1);
      }
    });
  });
});
