import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { insertEvidence, insertDecisionTrace } from '../store.js';

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  timestamp: string;
  message: string;
  filesChanged: string[];
}

export interface GitBlameInfo {
  line: number;
  commit: string;
  author: string;
  timestamp: string;
}

export interface EvidenceRecord {
  id: string;
  fact_id: number;
  type: string;
  commit_hash: string;
  author: string;
  timestamp: string;
  description: string;
  confidence: number;
  evidence_score: number;
}

export interface DecisionTraceRecord {
  id: string;
  fact_id: number;
  commit_hash: string;
  author: string;
  timestamp: string;
  ast_change: string;
  change_type: string;
}

function runGit(args: string[], cwd: string): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      timeout: 30000,
      windowsHide: true,
    }).trim();
  } catch {
    return '';
  }
}

export function getGitCommits(cwd: string, limit: number = 100): GitCommit[] {
  const format = '%H|%h|%an|%ae|%aI|%s';
  const output = runGit(['log', `--format=${format}`, `-${limit}`, '--diff-filter=ACMR'], cwd);
  if (!output) return [];

  return output.split('\n').filter(Boolean).map((line) => {
    const [hash, shortHash, author, email, timestamp, ...messageParts] = line.split('|');
    const message = messageParts.join('|');

    // Get files changed in this commit
    const filesOutput = runGit(['diff-tree', '--no-commit-id', '-r', '--name-only', shortHash], cwd);
    const filesChanged = filesOutput ? filesOutput.split('\n').filter(Boolean) : [];

    return { hash, shortHash, author, email, timestamp, message, filesChanged };
  });
}

export function getGitBlame(filePath: string, cwd: string): GitBlameInfo[] {
  const output = runGit(['blame', '--line-porcelain', filePath], cwd);
  if (!output) return [];

  const lines = output.split('\n');
  const result: GitBlameInfo[] = [];
  let currentCommit = '';
  let currentAuthor = '';
  let currentTimestamp = '';
  let lineNumber = 0;

  for (const line of lines) {
    if (line.startsWith('commit ')) {
      currentCommit = line.substring(7);
    } else if (line.startsWith('author ')) {
      currentAuthor = line.substring(7);
    } else if (line.startsWith('author-time ')) {
      const time = parseInt(line.substring(12));
      currentTimestamp = new Date(time * 1000).toISOString();
    } else if (line.match(/^\t/)) {
      lineNumber++;
      result.push({
        line: lineNumber,
        commit: currentCommit,
        author: currentAuthor,
        timestamp: currentTimestamp,
      });
    }
  }

  return result;
}

export function computeEvidenceScore(params: {
  hasBenchmark: boolean;
  hasTests: boolean;
  commitCount: number;
  loc: number;
  daysSinceLastCommit: number;
  edgeCount: number;
}): number {
  const {
    hasBenchmark,
    hasTests,
    commitCount,
    loc,
    daysSinceLastCommit,
    edgeCount,
  } = params;

  const benchmark = hasBenchmark ? 1.0 : 0.0;
  const tests = hasTests ? 1.0 : 0.0;
  const gitEvolution = Math.min(commitCount / 10, 1.0);
  const locScore = Math.min(loc / 500, 1.0);
  const recency = Math.max(0, 1 - daysSinceLastCommit / 365);
  const complexity = Math.min(edgeCount / 5, 1.0);

  return (
    0.25 * benchmark +
    0.20 * tests +
    0.20 * gitEvolution +
    0.10 * locScore +
    0.15 * recency +
    0.10 * complexity
  );
}

export function bindEvidenceFromGit(
  db: Database.Database,
  project: string,
  projectPath: string
): { evidenceCount: number; decisionTraceCount: number; warnings: string[] } {
  const warnings: string[] = [];

  // Check if git is available
  const gitVersion = runGit(['--version'], projectPath);
  if (!gitVersion) {
    warnings.push('Git is not available. Evolution scores will be degraded.');
    return { evidenceCount: 0, decisionTraceCount: 0, warnings };
  }

  // Check if .git directory exists
  const gitDir = path.join(projectPath, '.git');
  if (!fs.existsSync(gitDir)) {
    warnings.push('No .git directory found. Git history is unavailable.');
    return { evidenceCount: 0, decisionTraceCount: 0, warnings };
  }

  const commits = getGitCommits(projectPath, 200);
  if (commits.length === 0) {
    warnings.push('No git commits found.');
    return { evidenceCount: 0, decisionTraceCount: 0, warnings };
  }

  let evidenceCount = 0;
  let decisionTraceCount = 0;

  // Get all nodes for this project
  const nodes = db.prepare('SELECT id, file_path, name FROM nodes WHERE project = ?').all(project) as Array<{
    id: number;
    file_path: string;
    name: string;
  }>;

  // Build a map of file paths to node IDs
  const fileNodeMap = new Map<string, number[]>();
  for (const node of nodes) {
    const existing = fileNodeMap.get(node.file_path) ?? [];
    existing.push(node.id);
    fileNodeMap.set(node.file_path, existing);
  }

  for (const commit of commits) {
    // Find nodes affected by this commit
    const affectedNodeIds = new Set<number>();
    for (const changedFile of commit.filesChanged) {
      const nodeIds = fileNodeMap.get(changedFile) ?? [];
      for (const id of nodeIds) {
        affectedNodeIds.add(id);
      }
    }

    // Create evidence for each affected node
    for (const nodeId of affectedNodeIds) {
      const evidenceId = `git-${commit.shortHash}-${nodeId}`;
      const hasTests = commit.message.toLowerCase().includes('test');
      const hasBenchmark = commit.message.toLowerCase().includes('benchmark') ||
                          commit.message.toLowerCase().includes('perf');

      // Check if node has test evidence
      const existingEvidence = db.prepare(
        'SELECT COUNT(*) as cnt FROM evidence WHERE fact_id = ? AND type = ?'
      ).get(nodeId, 'test_coverage') as { cnt: number } | undefined;

      const node = nodes.find(n => n.id === nodeId);
      const nodeLoc = node ? 100 : 50; // Default estimate

      const score = computeEvidenceScore({
        hasBenchmark,
        hasTests: hasTests || (existingEvidence?.cnt ?? 0) > 0,
        commitCount: 1,
        loc: nodeLoc,
        daysSinceLastCommit: Math.floor(
          (Date.now() - new Date(commit.timestamp).getTime()) / (1000 * 60 * 60 * 24)
        ),
        edgeCount: 1,
      });

      insertEvidence(db, {
        id: evidenceId,
        fact_id: nodeId,
        type: 'git_commit',
        commit_hash: commit.shortHash,
        author: commit.author,
        timestamp: commit.timestamp,
        description: commit.message,
        confidence: 1.0,
        evidence_score: score,
      });
      evidenceCount++;
    }

    // Create decision trace for significant commits
    if (isSignificantCommit(commit)) {
      for (const nodeId of affectedNodeIds) {
        const traceId = `dt-${commit.shortHash}-${nodeId}`;
        const changeType = detectChangeType(commit.message);

        insertDecisionTrace(db, {
          id: traceId,
          fact_id: nodeId,
          commit_hash: commit.shortHash,
          author: commit.author,
          timestamp: commit.timestamp,
          ast_change: commit.message,
          change_type: changeType,
        });
        decisionTraceCount++;
      }
    }
  }

  return { evidenceCount, decisionTraceCount, warnings };
}

function isSignificantCommit(commit: GitCommit): boolean {
  const significantPatterns = [
    /feat/i, /fix/i, /refactor/i, /perf/i, /breaking/i,
    /add/i, /remove/i, /update/i, /change/i, /migrate/i,
    /introduce/i, /deprecate/i, /optimize/i,
  ];
  return significantPatterns.some(p => p.test(commit.message));
}

function detectChangeType(message: string): string {
  const msg = message.toLowerCase();
  if (msg.includes('add') || msg.includes('feat') || msg.includes('introduce')) return 'introduction';
  if (msg.includes('remove') || msg.includes('delete') || msg.includes('deprecate')) return 'removal';
  if (msg.includes('replace') || msg.includes('migrate') || msg.includes('switch')) return 'replacement';
  return 'modification';
}
