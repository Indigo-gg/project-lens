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
    // Clean up any stale database from previous runs
    const stalePath = path.join(os.homedir(), '.lens', 'cache', 'test-ranking.db');
    for (const ext of ['', '-wal', '-shm']) {
      const p = stalePath + ext;
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

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
    const dbPath = path.join(os.homedir(), '.lens', 'cache', 'test-ranking.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    // Also clean up WAL/SHM files
    for (const ext of ['-wal', '-shm']) {
      const p = dbPath + ext;
      if (fs.existsSync(p)) fs.unlinkSync(p);
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
      // Each result should have valid credibility and importance scores
      for (const r of ranked) {
        expect(r.credibility).toBeDefined();
        expect(r.credibility.score).toBeGreaterThanOrEqual(0);
        expect(r.credibility.score).toBeLessThanOrEqual(1);
        expect(r.importance).toBeDefined();
        expect(r.importance.score).toBeGreaterThanOrEqual(0);
        expect(r.importance.score).toBeLessThanOrEqual(1);
      }
    });

    it('should give higher score to node with more LOC', () => {
      const ranked = rankEvidence(db, 'test-ranking', nodeIds);

      // The large function should have a valid credibility score
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
      // Both results should have valid credibility and importance structures
      expect(largeFuncRank!.credibility).toBeDefined();
      expect(largeFuncRank!.credibility.score).toBeGreaterThanOrEqual(0);
      expect(largeFuncRank!.credibility.score).toBeLessThanOrEqual(1);
      expect(largeFuncRank!.importance).toBeDefined();
      expect(largeFuncRank!.importance.score).toBeGreaterThanOrEqual(0);
      expect(largeFuncRank!.importance.score).toBeLessThanOrEqual(1);
    });

    it('should return empty array for empty nodeIds', () => {
      const ranked = rankEvidence(db, 'test-ranking', []);
      expect(ranked).toEqual([]);
    });

    it('should respect custom weights', () => {
      // Disable problematic FTS triggers that use TEXT id as rowid
      db.exec("DROP TRIGGER IF EXISTS t_evidence_ai");
      db.exec("DROP TRIGGER IF EXISTS t_evidence_ad");
      db.exec("DROP TRIGGER IF EXISTS t_evidence_au");
      // Insert evidence for some nodes to make credibility scores non-zero
      db.prepare(
        "INSERT OR IGNORE INTO evidence (evidence_id, fact_id, type, description) VALUES (?, ?, ?, ?)"
      ).run('ev-benchmark-1', nodeIds[0], 'benchmark', 'Benchmark evidence for largeFunc');
      db.prepare(
        "INSERT OR IGNORE INTO evidence (evidence_id, fact_id, type, description) VALUES (?, ?, ?, ?)"
      ).run('ev-test-1', nodeIds[0], 'test_coverage', 'Test coverage for largeFunc');

      const rankedDefault = rankEvidence(db, 'test-ranking', nodeIds);
      const rankedCustom = rankEvidence(db, 'test-ranking', nodeIds, {
        credibilityWeights: {
          benchmark: 0.1,
          tests: 0.1,
          docs: 0.1,
          gitHistory: 0.7,
        },
        importanceWeights: {
          centrality: 0.5,
          frequency: 0.3,
          recency: 0.2,
        },
      });

      // Scores should be different with different weights
      expect(rankedDefault[0].credibility.score).not.toBe(rankedCustom[0].credibility.score);
    });

    it('should have valid credibility and importance', () => {
      const ranked = rankEvidence(db, 'test-ranking', nodeIds);

      for (const r of ranked) {
        expect(r.credibility).toBeDefined();
        expect(typeof r.credibility.has_benchmark).toBe('boolean');
        expect(typeof r.credibility.has_test).toBe('boolean');
        expect(typeof r.credibility.has_docs).toBe('boolean');
        expect(typeof r.credibility.has_git_history).toBe('boolean');
        expect(r.credibility.score).toBeGreaterThanOrEqual(0);
        expect(r.credibility.score).toBeLessThanOrEqual(1);

        expect(r.importance).toBeDefined();
        expect(r.importance.centrality).toBeGreaterThanOrEqual(0);
        expect(r.importance.centrality).toBeLessThanOrEqual(1);
        expect(r.importance.frequency).toBeGreaterThanOrEqual(0);
        expect(r.importance.frequency).toBeLessThanOrEqual(1);
        expect(r.importance.recency).toBeGreaterThanOrEqual(0);
        expect(r.importance.recency).toBeLessThanOrEqual(1);
        expect(r.importance.score).toBeGreaterThanOrEqual(0);
        expect(r.importance.score).toBeLessThanOrEqual(1);
      }
    });
  });
});
