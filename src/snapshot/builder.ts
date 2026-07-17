import Database from 'better-sqlite3';

export interface ProjectSnapshot {
  project: {
    name: string;
    languages: string[];
    total_files: number;
    loc: number;
  };
  key_facts: Array<{
    id: number;
    type: string;
    filepath: string;
    summary: string;
    score: number;
  }>;
  recent_decisions: Array<{
    fact_id: number;
    commit_hash: string;
    author: string;
    timestamp: string;
    change_type: string;
    description: string;
  }>;
  evidence_stats: {
    total: number;
    by_type: Record<string, number>;
  };
  top_evidence: Array<{
    fact_id: number;
    filepath: string;
    evidence_type: string;
    description: string;
    score: number;
  }>;
}

export function buildSnapshot(
  db: Database.Database,
  project: string,
  options: {
    include_git_history?: boolean;
    max_facts?: number;
    max_decisions?: number;
  } = {}
): ProjectSnapshot {
  const {
    include_git_history = true,
    max_facts = 100,
    max_decisions = 30,
  } = options;

  // Get project metadata
  const projectRow = db.prepare(
    'SELECT name, languages, total_files, loc FROM projects WHERE name = ?'
  ).get(project) as {
    name: string;
    languages: string | null;
    total_files: number | null;
    loc: number | null;
  } | undefined;

  const projectInfo = {
    name: projectRow?.name ?? project,
    languages: projectRow?.languages ? JSON.parse(projectRow.languages) : [],
    total_files: projectRow?.total_files ?? 0,
    loc: projectRow?.loc ?? 0,
  };

  // Get key facts (top by score)
  const keyFacts = db.prepare(`
    SELECT n.id, n.label as type, n.file_path as filepath, n.name, n.properties,
           COALESCE(MAX(e.evidence_score), 0) as score
    FROM nodes n
    LEFT JOIN evidence e ON e.fact_id = n.id
    WHERE n.project = ?
    GROUP BY n.id
    ORDER BY score DESC
    LIMIT ?
  `).all(project, max_facts) as Array<{
    id: number;
    type: string;
    filepath: string;
    name: string;
    properties: string | null;
    score: number;
  }>;

  const keyFactsFormatted = keyFacts.map(f => {
    const props = f.properties ? JSON.parse(f.properties) : {};
    const lineCount = (props.lineCount as number) ?? 0;
    return {
      id: f.id,
      type: f.type,
      filepath: f.filepath,
      summary: `${f.type} ${f.name}${lineCount > 0 ? ` (${lineCount} lines)` : ''}`,
      score: f.score,
    };
  });

  // Get recent decisions
  let recentDecisions: ProjectSnapshot['recent_decisions'] = [];
  if (include_git_history) {
    const decisions = db.prepare(`
      SELECT fact_id, commit_hash, author, timestamp, change_type, ast_change as description
      FROM decision_traces
      WHERE fact_id IN (SELECT id FROM nodes WHERE project = ?)
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(project, max_decisions) as ProjectSnapshot['recent_decisions'];

    recentDecisions = decisions;
  }

  // Get evidence stats
  const evidenceStats = db.prepare(`
    SELECT type, COUNT(*) as cnt
    FROM evidence
    WHERE fact_id IN (SELECT id FROM nodes WHERE project = ?)
    GROUP BY type
  `).all(project) as Array<{ type: string; cnt: number }>;

  const totalEvidence = evidenceStats.reduce((sum, s) => sum + s.cnt, 0);
  const byType: Record<string, number> = {};
  for (const s of evidenceStats) {
    byType[s.type] = s.cnt;
  }

  // Get top evidence
  const topEvidence = db.prepare(`
    SELECT e.fact_id, n.file_path as filepath, e.type as evidence_type,
           e.description, e.evidence_score as score
    FROM evidence e
    JOIN nodes n ON n.id = e.fact_id
    WHERE n.project = ?
    ORDER BY e.evidence_score DESC
    LIMIT 20
  `).all(project) as ProjectSnapshot['top_evidence'];

  return {
    project: projectInfo,
    key_facts: keyFactsFormatted,
    recent_decisions: recentDecisions,
    evidence_stats: {
      total: totalEvidence,
      by_type: byType,
    },
    top_evidence: topEvidence,
  };
}
