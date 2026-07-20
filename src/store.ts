import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import type { FileHash } from './extractor/file-scanner.js';

export interface LensDatabase {
  db: Database.Database;
  close: () => void;
}

const DB_DIR = path.join(os.homedir(), '.lens', 'cache');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function openDatabase(projectName: string): LensDatabase {
  ensureDir(DB_DIR);
  const dbPath = path.join(DB_DIR, `${projectName}.db`);

  let db: Database.Database;
  try {
    db = new Database(dbPath);
  } catch (err) {
    // Database may be corrupted, try to recover
    console.error(`Failed to open database, attempting recovery: ${err}`);
    const backupPath = `${dbPath}.backup.${Date.now()}`;
    try {
      fs.renameSync(dbPath, backupPath);
      console.error(`Corrupted database backed up to: ${backupPath}`);
    } catch {
      // Ignore backup failure
    }
    db = new Database(dbPath);
  }

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Integrity check
  try {
    const result = db.pragma('integrity_check') as Array<{ integrity_check: string }>;
    if (result[0]?.integrity_check !== 'ok') {
      console.error('Database integrity check failed, rebuilding...');
      const backupPath = `${dbPath}.integrity-fail.${Date.now()}`;
      db.close();
      fs.renameSync(dbPath, backupPath);
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
    }
  } catch {
    // Integrity check may not be available
  }

  initSchema(db);

  return {
    db,
    close: () => db.close(),
  };
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      name TEXT PRIMARY KEY,
      root_path TEXT NOT NULL,
      languages TEXT,
      dependencies TEXT,
      total_files INTEGER,
      loc INTEGER,
      indexed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS file_hashes (
      project TEXT NOT NULL,
      rel_path TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      mtime_ms REAL NOT NULL,
      size INTEGER NOT NULL,
      PRIMARY KEY (project, rel_path)
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project TEXT NOT NULL,
      label TEXT NOT NULL,
      name TEXT NOT NULL,
      qualified_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      properties TEXT,
      content_hash TEXT,
      loc INTEGER,
      UNIQUE(project, qualified_name)
    );

    CREATE TABLE IF NOT EXISTS edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project TEXT NOT NULL,
      source_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      target_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      properties TEXT,
      UNIQUE(source_id, target_id, type)
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evidence_id TEXT NOT NULL UNIQUE,
      fact_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      commit_hash TEXT,
      author TEXT,
      timestamp TEXT,
      description TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      evidence_score REAL DEFAULT 0.0
    );

    CREATE TABLE IF NOT EXISTS decision_traces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trace_id TEXT NOT NULL UNIQUE,
      fact_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      version TEXT,
      commit_hash TEXT NOT NULL,
      author TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      ast_change TEXT NOT NULL,
      change_type TEXT NOT NULL,
      related_issue TEXT
    );

    CREATE TABLE IF NOT EXISTS requirement_synonyms (
      requirement TEXT PRIMARY KEY,
      search_terms TEXT NOT NULL,
      category TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_nodes_project ON nodes(project);
    CREATE INDEX IF NOT EXISTS idx_nodes_filepath ON nodes(file_path);
    CREATE INDEX IF NOT EXISTS idx_nodes_label ON nodes(label);
    CREATE INDEX IF NOT EXISTS idx_edges_project ON edges(project);
    CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
    CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_fact ON evidence(fact_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_score ON evidence(evidence_score);
    CREATE INDEX IF NOT EXISTS idx_decision_traces_fact ON decision_traces(fact_id);
  `);

  // FTS5 virtual tables (ignore if already exists)
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
        name, qualified_name, file_path, properties,
        content=nodes, content_rowid=id
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS evidence_fts USING fts5(
        description, commit_hash, author
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS decision_traces_fts USING fts5(
        ast_change
      );
    `);
  } catch {
    // FTS5 tables may already exist
  }

  // FTS5 triggers for real-time incremental sync
  try {
    db.exec(`
      -- Nodes triggers
      CREATE TRIGGER IF NOT EXISTS t_nodes_ai AFTER INSERT ON nodes BEGIN
        INSERT INTO nodes_fts(rowid, name, qualified_name, file_path, properties)
        VALUES (new.id, new.name, new.qualified_name, new.file_path, new.properties);
      END;
      CREATE TRIGGER IF NOT EXISTS t_nodes_ad AFTER DELETE ON nodes BEGIN
        INSERT INTO nodes_fts(nodes_fts, rowid, name, qualified_name, file_path, properties)
        VALUES('delete', old.id, old.name, old.qualified_name, old.file_path, old.properties);
      END;
      CREATE TRIGGER IF NOT EXISTS t_nodes_au AFTER UPDATE ON nodes BEGIN
        INSERT INTO nodes_fts(nodes_fts, rowid, name, qualified_name, file_path, properties)
        VALUES('delete', old.id, old.name, old.qualified_name, old.file_path, old.properties);
        INSERT INTO nodes_fts(rowid, name, qualified_name, file_path, properties)
        VALUES (new.id, new.name, new.qualified_name, new.file_path, new.properties);
      END;

      -- Evidence triggers
      CREATE TRIGGER IF NOT EXISTS t_evidence_ai AFTER INSERT ON evidence BEGIN
        INSERT INTO evidence_fts(rowid, description, commit_hash, author)
        VALUES (new.id, new.description, new.commit_hash, new.author);
      END;
      CREATE TRIGGER IF NOT EXISTS t_evidence_ad AFTER DELETE ON evidence BEGIN
        INSERT INTO evidence_fts(evidence_fts, rowid, description, commit_hash, author)
        VALUES('delete', old.id, old.description, old.commit_hash, old.author);
      END;
      CREATE TRIGGER IF NOT EXISTS t_evidence_au AFTER UPDATE ON evidence BEGIN
        INSERT INTO evidence_fts(evidence_fts, rowid, description, commit_hash, author)
        VALUES('delete', old.id, old.description, old.commit_hash, old.author);
        INSERT INTO evidence_fts(rowid, description, commit_hash, author)
        VALUES (new.id, new.description, new.commit_hash, new.author);
      END;

      -- Decision traces triggers
      CREATE TRIGGER IF NOT EXISTS t_dt_ai AFTER INSERT ON decision_traces BEGIN
        INSERT INTO decision_traces_fts(rowid, ast_change)
        VALUES (new.id, new.ast_change);
      END;
      CREATE TRIGGER IF NOT EXISTS t_dt_ad AFTER DELETE ON decision_traces BEGIN
        INSERT INTO decision_traces_fts(decision_traces_fts, rowid, ast_change)
        VALUES('delete', old.id, old.ast_change);
      END;
      CREATE TRIGGER IF NOT EXISTS t_dt_au AFTER UPDATE ON decision_traces BEGIN
        INSERT INTO decision_traces_fts(decision_traces_fts, rowid, ast_change)
        VALUES('delete', old.id, old.ast_change);
        INSERT INTO decision_traces_fts(rowid, ast_change)
        VALUES (new.id, new.ast_change);
      END;
    `);
  } catch {
    // Triggers may already exist
  }

  // Seed default requirement synonyms
  seedRequirementSynonyms(db);
}

function seedRequirementSynonyms(db: Database.Database) {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM requirement_synonyms').get() as { cnt: number };
  if (count.cnt > 0) return;

  const insert = db.prepare(
    'INSERT OR IGNORE INTO requirement_synonyms (requirement, search_terms, category) VALUES (?, ?, ?)'
  );

  const defaults: [string, string, string][] = [
    ['Redis', JSON.stringify(['redis', 'ioredis', 'cache', 'pub/sub', 'session', 'rate limit']), 'data'],
    ['Kafka', JSON.stringify(['kafka', 'message queue', 'pub/sub', 'event', 'stream', 'broker']), 'data'],
    ['Performance', JSON.stringify(['benchmark', 'latency', 'optimization', 'profiling', 'memory', 'cache']), 'performance'],
    ['Concurrency', JSON.stringify(['async', 'queue', 'mutex', 'lock', 'worker', 'parallel', 'thread']), 'performance'],
    ['Security', JSON.stringify(['auth', 'jwt', 'oauth', 'encrypt', 'hash', 'token', 'permission']), 'security'],
    ['Testing', JSON.stringify(['test', 'spec', 'mock', 'fixture', 'coverage', 'snapshot']), 'quality'],
    ['CI/CD', JSON.stringify(['ci', 'cd', 'pipeline', 'deploy', 'docker', 'kubernetes', 'helm']), 'devops'],
    ['Database', JSON.stringify(['sql', 'postgres', 'mysql', 'mongo', 'prisma', 'drizzle', 'query']), 'data'],
    ['API', JSON.stringify(['rest', 'graphql', 'grpc', 'endpoint', 'route', 'middleware']), 'architecture'],
    ['Frontend', JSON.stringify(['react', 'vue', 'svelte', 'component', 'state', 'render']), 'frontend'],
  ];

  const tx = db.transaction(() => {
    for (const [req, terms, cat] of defaults) {
      insert.run(req, terms, cat);
    }
  });
  tx();
}

// File hash operations
export function getFileHashes(db: Database.Database, project: string): Map<string, FileHash> {
  const rows = db.prepare(
    'SELECT rel_path, sha256, mtime_ms, size FROM file_hashes WHERE project = ?'
  ).all(project) as Array<{ rel_path: string; sha256: string; mtime_ms: number; size: number }>;

  const map = new Map<string, FileHash>();
  for (const row of rows) {
    map.set(row.rel_path, {
      relPath: row.rel_path,
      sha256: row.sha256,
      mtimeMs: row.mtime_ms,
      size: row.size,
    });
  }
  return map;
}

export function saveFileHashes(db: Database.Database, project: string, hashes: FileHash[]) {
  const upsert = db.prepare(`
    INSERT OR REPLACE INTO file_hashes (project, rel_path, sha256, mtime_ms, size)
    VALUES (?, ?, ?, ?, ?)
  `);
  const tx = db.transaction(() => {
    for (const h of hashes) {
      upsert.run(project, h.relPath, h.sha256, h.mtimeMs, h.size);
    }
  });
  tx();
}

export function removeFileHashes(db: Database.Database, project: string, paths: string[]) {
  const del = db.prepare('DELETE FROM file_hashes WHERE project = ? AND rel_path = ?');
  const tx = db.transaction(() => {
    for (const p of paths) {
      del.run(project, p);
    }
  });
  tx();
}

// Node/Fact operations
export function insertNode(db: Database.Database, node: {
  project: string;
  label: string;
  name: string;
  qualified_name: string;
  file_path: string;
  start_line: number;
  end_line: number;
  properties?: Record<string, unknown>;
  content_hash?: string;
  loc?: number;
}): number {
  const result = db.prepare(`
    INSERT OR REPLACE INTO nodes (project, label, name, qualified_name, file_path, start_line, end_line, properties, content_hash, loc)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    node.project, node.label, node.name, node.qualified_name,
    node.file_path, node.start_line, node.end_line,
    node.properties ? JSON.stringify(node.properties) : null,
    node.content_hash ?? null,
    node.loc ?? null
  );
  return result.lastInsertRowid as number;
}

export function insertEdge(db: Database.Database, edge: {
  project: string;
  source_id: number;
  target_id: number;
  type: string;
  properties?: Record<string, unknown>;
}) {
  db.prepare(`
    INSERT OR IGNORE INTO edges (project, source_id, target_id, type, properties)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    edge.project, edge.source_id, edge.target_id, edge.type,
    edge.properties ? JSON.stringify(edge.properties) : null
  );
}

// Evidence operations
export function insertEvidence(db: Database.Database, ev: {
  id: string;
  fact_id: number;
  type: string;
  commit_hash?: string;
  author?: string;
  timestamp?: string;
  description: string;
  confidence?: number;
  evidence_score?: number;
}) {
  db.prepare(`
    INSERT OR REPLACE INTO evidence (evidence_id, fact_id, type, commit_hash, author, timestamp, description, confidence, evidence_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ev.id, ev.fact_id, ev.type,
    ev.commit_hash ?? null, ev.author ?? null, ev.timestamp ?? null,
    ev.description, ev.confidence ?? 1.0, ev.evidence_score ?? 0.0
  );
}

// Decision trace operations
export function insertDecisionTrace(db: Database.Database, dt: {
  trace_id: string;
  fact_id: number;
  version?: string;
  commit_hash: string;
  author: string;
  timestamp: string;
  ast_change: string;
  change_type: string;
  related_issue?: string;
}) {
  db.prepare(`
    INSERT OR REPLACE INTO decision_traces (trace_id, fact_id, version, commit_hash, author, timestamp, ast_change, change_type, related_issue)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    dt.trace_id, dt.fact_id, dt.version ?? null,
    dt.commit_hash, dt.author, dt.timestamp,
    dt.ast_change, dt.change_type, dt.related_issue ?? null
  );
}

// FTS sync helpers (triggers handle incremental sync, these are for recovery/initial index)
export function syncNodesFts(db: Database.Database) {
  // Triggers handle incremental sync; rebuild only needed for recovery
  try {
    db.exec(`INSERT INTO nodes_fts(nodes_fts) VALUES('rebuild')`);
  } catch { /* ignore */ }
}

export function syncEvidenceFts(db: Database.Database) {
  // Triggers handle incremental sync; no rebuild needed for standalone FTS
}

export function syncDecisionTracesFts(db: Database.Database) {
  // Triggers handle incremental sync; no rebuild needed for standalone FTS
}

// Project metadata
export function upsertProject(db: Database.Database, project: {
  name: string;
  root_path: string;
  languages?: string[];
  dependencies?: Record<string, string>;
  total_files?: number;
  loc?: number;
}) {
  db.prepare(`
    INSERT OR REPLACE INTO projects (name, root_path, languages, dependencies, total_files, loc, indexed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    project.name, project.root_path,
    project.languages ? JSON.stringify(project.languages) : null,
    project.dependencies ? JSON.stringify(project.dependencies) : null,
    project.total_files ?? null,
    project.loc ?? null,
    new Date().toISOString()
  );
}

// Requirement synonyms
export function getRequirementSynonyms(db: Database.Database, requirement: string): string[] | null {
  const row = db.prepare('SELECT search_terms FROM requirement_synonyms WHERE requirement = ?').get(requirement) as { search_terms: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.search_terms);
  } catch {
    return null;
  }
}
