import Database from 'better-sqlite3';

export interface ConfidenceResult {
  confidence: number;
  factors: {
    hasBenchmark: boolean;
    hasTests: boolean;
    hasGitHistory: boolean;
    evidenceCount: number;
    matchStrength: number;
  };
}

export function computeConfidence(
  db: Database.Database,
  nodeId: number,
  searchTerms: string[]
): ConfidenceResult {
  // Check for benchmark evidence
  const hasBenchmark = db.prepare(
    'SELECT COUNT(*) as cnt FROM evidence WHERE fact_id = ? AND type = ?'
  ).get(nodeId, 'benchmark') as { cnt: number };

  // Check for test evidence
  const hasTests = db.prepare(
    'SELECT COUNT(*) as cnt FROM evidence WHERE fact_id = ? AND type = ?'
  ).get(nodeId, 'test_coverage') as { cnt: number };

  // Check for git history
  const hasGitHistory = db.prepare(
    'SELECT COUNT(*) as cnt FROM evidence WHERE fact_id = ? AND type = ?'
  ).get(nodeId, 'git_commit') as { cnt: number };

  // Count total evidence
  const evidenceCount = db.prepare(
    'SELECT COUNT(*) as cnt FROM evidence WHERE fact_id = ?'
  ).get(nodeId) as { cnt: number };

  // Compute match strength based on search terms
  const node = db.prepare(
    'SELECT name, file_path, properties FROM nodes WHERE id = ?'
  ).get(nodeId) as { name: string; file_path: string; properties: string | null } | undefined;

  let matchStrength = 0;
  if (node) {
    const nodeText = `${node.name} ${node.file_path} ${node.properties ?? ''}`.toLowerCase();
    const matchedTerms = searchTerms.filter(t => nodeText.includes(t.toLowerCase()));
    matchStrength = searchTerms.length > 0 ? matchedTerms.length / searchTerms.length : 0;
  }

  // Compute confidence score
  let confidence = 0;

  // Base confidence from evidence count
  confidence += Math.min(evidenceCount.cnt / 5, 0.3);

  // Bonus for benchmark evidence
  if (hasBenchmark.cnt > 0) confidence += 0.3;

  // Bonus for test evidence
  if (hasTests.cnt > 0) confidence += 0.2;

  // Bonus for git history
  if (hasGitHistory.cnt > 0) confidence += 0.1;

  // Match strength contribution
  confidence += matchStrength * 0.1;

  // Clamp to [0, 1]
  confidence = Math.max(0, Math.min(1, confidence));

  return {
    confidence,
    factors: {
      hasBenchmark: hasBenchmark.cnt > 0,
      hasTests: hasTests.cnt > 0,
      hasGitHistory: hasGitHistory.cnt > 0,
      evidenceCount: evidenceCount.cnt,
      matchStrength,
    },
  };
}
