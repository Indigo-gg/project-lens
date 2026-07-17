import Database from 'better-sqlite3';

export interface CredibilityScore {
  has_benchmark: boolean;
  has_test: boolean;
  has_docs: boolean;
  has_git_history: boolean;
  score: number; // 0-1
}

export interface ImportanceScore {
  centrality: number; // 连接度
  frequency: number; // 修改频率
  recency: number; // 时效性
  score: number; // 0-1
}

export interface RankedResult {
  nodeId: number;
  credibility: CredibilityScore;
  importance: ImportanceScore;
}

export interface RankingOptions {
  credibilityWeights?: {
    benchmark: number;
    tests: number;
    docs: number;
    gitHistory: number;
  };
  importanceWeights?: {
    centrality: number;
    frequency: number;
    recency: number;
  };
}

const DEFAULT_CREDIBILITY_WEIGHTS = {
  benchmark: 0.3,
  tests: 0.3,
  docs: 0.2,
  gitHistory: 0.2,
};

const DEFAULT_IMPORTANCE_WEIGHTS = {
  centrality: 0.4,
  frequency: 0.3,
  recency: 0.3,
};

export function rankEvidence(
  db: Database.Database,
  _project: string,
  nodeIds: number[],
  options: RankingOptions = {}
): RankedResult[] {
  if (nodeIds.length === 0) return [];

  const credWeights = { ...DEFAULT_CREDIBILITY_WEIGHTS, ...options.credibilityWeights };
  const impWeights = { ...DEFAULT_IMPORTANCE_WEIGHTS, ...options.importanceWeights };

  // Batch query to avoid N+1 - single SQL for all nodes
  const placeholders = nodeIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT
      n.id as nodeId,
      n.loc,
      EXISTS(SELECT 1 FROM evidence WHERE fact_id = n.id AND type = 'benchmark') as hasBenchmark,
      EXISTS(SELECT 1 FROM evidence WHERE fact_id = n.id AND type = 'test_coverage') as hasTests,
      EXISTS(SELECT 1 FROM evidence WHERE fact_id = n.id AND type = 'documentation') as hasDocs,
      EXISTS(SELECT 1 FROM evidence WHERE fact_id = n.id AND type = 'git_commit') as hasGitHistory,
      (SELECT COUNT(*) FROM evidence WHERE fact_id = n.id AND type = 'git_commit') as commitCount,
      (SELECT MAX(timestamp) FROM evidence WHERE fact_id = n.id AND type = 'git_commit') as latestCommit,
      (SELECT COUNT(*) FROM edges WHERE source_id = n.id OR target_id = n.id) as edgeCount
    FROM nodes n
    WHERE n.id IN (${placeholders})
  `).all(...nodeIds) as Array<{
    nodeId: number;
    loc: number | null;
    hasBenchmark: number;
    hasTests: number;
    hasDocs: number;
    hasGitHistory: number;
    commitCount: number;
    latestCommit: string | null;
    edgeCount: number;
  }>;

  // Calculate max values for normalization
  const maxEdgeCount = Math.max(...rows.map(r => r.edgeCount), 1);
  const maxCommitCount = Math.max(...rows.map(r => r.commitCount), 1);

  const results = rows.map(row => {
    // Credibility score
    const has_benchmark = row.hasBenchmark > 0;
    const has_test = row.hasTests > 0;
    const has_docs = row.hasDocs > 0;
    const has_git_history = row.hasGitHistory > 0;

    const benchmarkScore = has_benchmark ? 1.0 : 0.0;
    const testScore = has_test ? 1.0 : 0.0;
    const docsScore = has_docs ? 1.0 : 0.0;
    const gitHistoryScore = has_git_history ? 1.0 : 0.0;

    const credibilityScore =
      credWeights.benchmark * benchmarkScore +
      credWeights.tests * testScore +
      credWeights.docs * docsScore +
      credWeights.gitHistory * gitHistoryScore;

    // Importance score
    const centrality = row.edgeCount / maxEdgeCount;
    const frequency = row.commitCount / maxCommitCount;

    let recency = 0;
    if (row.latestCommit) {
      const daysSince = Math.floor(
        (Date.now() - new Date(row.latestCommit).getTime()) / (1000 * 60 * 60 * 24)
      );
      recency = Math.max(0, 1 - daysSince / 365);
    }

    const importanceScore =
      impWeights.centrality * centrality +
      impWeights.frequency * frequency +
      impWeights.recency * recency;

    return {
      nodeId: row.nodeId,
      credibility: {
        has_benchmark,
        has_test,
        has_docs,
        has_git_history,
        score: credibilityScore,
      },
      importance: {
        centrality,
        frequency,
        recency,
        score: importanceScore,
      },
    };
  });

  return results;
}

export function updateEvidenceScores(
  db: Database.Database,
  project: string
): number {
  const nodes = db.prepare(
    'SELECT id FROM nodes WHERE project = ?'
  ).all(project) as Array<{ id: number }>;

  const ranked = rankEvidence(db, project, nodes.map(n => n.id));

  const update = db.prepare(
    'UPDATE evidence SET evidence_score = ? WHERE fact_id = ?'
  );

  let updated = 0;
  const tx = db.transaction(() => {
    for (const r of ranked) {
      // Use credibility score as the evidence_score for backward compatibility
      update.run(r.credibility.score, r.nodeId);
      updated++;
    }
  });
  tx();

  return updated;
}
