import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  openDatabase,
  getFileHashes,
  saveFileHashes,
  removeFileHashes,
  insertNode,
  insertEdge,
  upsertProject,
  getRequirementSynonyms,
  syncNodesFts,
} from '../src/store.js';

// Use a temp directory for test databases
const TEST_DB_DIR = path.join(os.tmpdir(), 'project-lens-test');

describe('store', () => {
  let db: Database.Database;
  let close: () => void;

  beforeAll(() => {
    // Ensure test directory exists
    if (!fs.existsSync(TEST_DB_DIR)) {
      fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    }

    const result = openDatabase('test-project');
    db = result.db;
    close = result.close;
  });

  afterAll(() => {
    close();
    // Clean up test database
    const dbPath = path.join(TEST_DB_DIR, 'test-project.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  describe('openDatabase', () => {
    it('should open database and initialize schema', () => {
      expect(db).toBeDefined();
      // Check that tables exist
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('projects');
      expect(tableNames).toContain('nodes');
      expect(tableNames).toContain('edges');
      expect(tableNames).toContain('evidence');
      expect(tableNames).toContain('decision_traces');
      expect(tableNames).toContain('file_hashes');
      expect(tableNames).toContain('requirement_synonyms');
    });

    it('should have foreign keys enabled', () => {
      const result = db.pragma('foreign_keys') as Array<{ foreign_keys: number }>;
      expect(result[0].foreign_keys).toBe(1);
    });

    it('should have WAL mode enabled', () => {
      const result = db.pragma('journal_mode') as Array<{ journal_mode: string }>;
      expect(result[0].journal_mode).toBe('wal');
    });
  });

  describe('file hash operations', () => {
    const testHashes = [
      { relPath: 'src/index.ts', sha256: 'abc123', mtimeMs: 1000, size: 100 },
      { relPath: 'src/utils.ts', sha256: 'def456', mtimeMs: 2000, size: 200 },
    ];

    it('should save and retrieve file hashes', () => {
      saveFileHashes(db, 'test-project', testHashes);
      const retrieved = getFileHashes(db, 'test-project');
      expect(retrieved.size).toBe(2);
      expect(retrieved.get('src/index.ts')?.sha256).toBe('abc123');
      expect(retrieved.get('src/utils.ts')?.sha256).toBe('def456');
    });

    it('should remove file hashes', () => {
      removeFileHashes(db, 'test-project', ['src/utils.ts']);
      const retrieved = getFileHashes(db, 'test-project');
      expect(retrieved.size).toBe(1);
      expect(retrieved.has('src/utils.ts')).toBe(false);
    });
  });

  describe('node operations', () => {
    it('should insert a node', () => {
      const nodeId = insertNode(db, {
        project: 'test-project',
        label: 'function',
        name: 'testFunction',
        qualified_name: 'src/test.ts::testFunction',
        file_path: 'src/test.ts',
        start_line: 1,
        end_line: 10,
        properties: { text: 'function test() {}' },
        loc: 10,
      });
      expect(nodeId).toBeGreaterThan(0);
    });

    it('should get node by qualified_name', () => {
      const node = db.prepare('SELECT * FROM nodes WHERE qualified_name = ?')
        .get('src/test.ts::testFunction') as { name: string; end_line: number };
      expect(node).toBeDefined();
      expect(node.name).toBe('testFunction');
      expect(node.end_line).toBe(10);
    });
  });

  describe('edge operations', () => {
    it('should insert an edge', () => {
      // First create two nodes
      const sourceId = insertNode(db, {
        project: 'test-project',
        label: 'function',
        name: 'caller',
        qualified_name: 'src/test.ts::caller',
        file_path: 'src/test.ts',
        start_line: 1,
        end_line: 5,
      });

      const targetId = insertNode(db, {
        project: 'test-project',
        label: 'function',
        name: 'callee',
        qualified_name: 'src/test.ts::callee',
        file_path: 'src/test.ts',
        start_line: 10,
        end_line: 15,
      });

      insertEdge(db, {
        project: 'test-project',
        source_id: sourceId,
        target_id: targetId,
        type: 'calls',
      });

      const edge = db.prepare('SELECT * FROM edges WHERE source_id = ? AND target_id = ?').get(sourceId, targetId);
      expect(edge).toBeDefined();
    });
  });

  describe('project metadata', () => {
    it('should upsert project', () => {
      upsertProject(db, {
        name: 'test-project',
        root_path: '/test/path',
        languages: ['typescript', 'javascript'],
        total_files: 100,
        loc: 5000,
      });

      const project = db.prepare('SELECT * FROM projects WHERE name = ?').get('test-project') as {
        root_path: string;
        languages: string;
        total_files: number;
        loc: number;
      };
      expect(project.root_path).toBe('/test/path');
      expect(JSON.parse(project.languages)).toEqual(['typescript', 'javascript']);
      expect(project.total_files).toBe(100);
      expect(project.loc).toBe(5000);
    });
  });

  describe('requirement synonyms', () => {
    it('should get built-in synonyms', () => {
      const synonyms = getRequirementSynonyms(db, 'Redis');
      expect(synonyms).toContain('redis');
      expect(synonyms).toContain('cache');
      expect(synonyms).toContain('pub/sub');
    });

    it('should return null for unknown requirement', () => {
      const synonyms = getRequirementSynonyms(db, 'UnknownTech');
      expect(synonyms).toBeNull();
    });
  });

  describe('FTS sync', () => {
    it('should sync FTS indexes without error', () => {
      expect(() => syncNodesFts(db)).not.toThrow();
    });
  });
});
