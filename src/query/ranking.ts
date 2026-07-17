import Database from 'better-sqlite3';

export interface RankedResult {
  nodeId: number;
  score: number;
  breakdown: {
    benchmark: number;
    tests: number;
    gitEvolution: number;
    loc: number;
    recency: number;
    complexity: number;
  };
}

export interface RankingOptions {
  weights?: {
    benchmark: number;
    tests: number;
    gitEvolution: number;
    loc: number;
    recency: number;
    complexity: number;
  };
}

const DEFAULT_WEIGHTS = {
  benchmark: 0.25,
  tests: 0.20,
  gitEvolution: 0.20,
  loc: 0.10,
  recency: 0.15,
  complexity: 0.10,
};

export function rankEvidence(
  db: Database.Database,
  _project: string,
  nodeIds: number[],
  options: RankingOptions = {}
): RankedResult[] {
  if (nodeIds.length === 0) return [];

  const weights = { ...DEFAULT_WEIGHTS, ...options.weights };

  // Batch query to avoid N+1 - single SQL for all nodes
  const placeholders = nodeIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT
      n.id as nodeId,
      n.loc,
      EXISTS(SELECT 1 FROM evidence WHERE fact_id = n.id AND type = 'benchmark') as hasBenchmark,
      EXISTS(SELECT 1 FROM evidence WHERE fact_id = n.id AND type = 'test_coverage') as hasTests,
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
    commitCount: number;
    latestCommit: string | null;
    edgeCount: number;
  }>;

  const results = rows.map(row => {
    const benchmark = row.hasBenchmark > 0 ? 1.0 : 0.0;
    const tests = row.hasTests > 0 ? 1.0 : 0.0;
    const gitEvolution = Math.min(row.commitCount / 10, 1.0);
    const locScore = Math.min((row.loc ?? 50) / 500, 1.0);

    let recency = 0;
    if (row.latestCommit) {
      const daysSince = Math.floor(
        (Date.now() - new Date(row.latestCommit).getTime()) / (1000 * 60 * 60 * 24)
      );
      recency = Math.max(0, 1 - daysSince / 365);
    }

    const complexity = Math.min(row.edgeCount / 5, 1.0);

    const score =
      weights.benchmark * benchmark +
      weights.tests * tests +
      weights.gitEvolution * gitEvolution +
      weights.loc * locScore +
      weights.recency * recency +
      weights.complexity * complexity;

    return {
      nodeId: row.nodeId,
      score,
      breakdown: {
        benchmark,
        tests,
        gitEvolution,
        loc: locScore,
        recency,
        complexity,
      },
    };
  });

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

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
      update.run(r.score, r.nodeId);
      updated++;
    }
  });
  tx();

  return updated;
}
