import Database from 'better-sqlite3';

export interface DecisionTrace {
  commit_hash: string;
  author: string;
  timestamp: string;
  change_type: string;
  description: string;
  related_issue?: string;
}

export interface DecisionTraceResponse {
  fact_id: number;
  timeline: DecisionTrace[];
}

export function getDecisionTrace(
  db: Database.Database,
  project: string,
  options: {
    fact_id?: number;
    query?: string;
    limit?: number;
  }
): DecisionTraceResponse[] {
  const { fact_id, query, limit = 10 } = options;

  if (fact_id) {
    // Get traces for a specific fact
    const traces = db.prepare(
      'SELECT commit_hash, author, timestamp, change_type, ast_change as description, related_issue FROM decision_traces WHERE fact_id = ? ORDER BY timestamp DESC LIMIT ?'
    ).all(fact_id, limit) as DecisionTrace[];

    return [{ fact_id, timeline: traces }];
  }

  if (query) {
    // Search by query term
    const nodes = db.prepare(
      'SELECT id FROM nodes WHERE project = ? AND (name LIKE ? OR file_path LIKE ?)'
    ).all(project, `%${query}%`, `%${query}%`) as Array<{ id: number }>;

    const results: DecisionTraceResponse[] = [];
    for (const node of nodes) {
      const traces = db.prepare(
        'SELECT commit_hash, author, timestamp, change_type, ast_change as description, related_issue FROM decision_traces WHERE fact_id = ? ORDER BY timestamp DESC LIMIT ?'
      ).all(node.id, limit) as DecisionTrace[];

      if (traces.length > 0) {
        results.push({ fact_id: node.id, timeline: traces });
      }
    }

    return results;
  }

  // Get all recent decision traces
  const traces = db.prepare(
    'SELECT fact_id, commit_hash, author, timestamp, change_type, ast_change as description, related_issue FROM decision_traces ORDER BY timestamp DESC LIMIT ?'
  ).all(limit) as Array<{ fact_id: number } & DecisionTrace>;

  const grouped = new Map<number, DecisionTrace[]>();
  for (const trace of traces) {
    const existing = grouped.get(trace.fact_id) ?? [];
    existing.push({
      commit_hash: trace.commit_hash,
      author: trace.author,
      timestamp: trace.timestamp,
      change_type: trace.change_type,
      description: trace.description,
      related_issue: trace.related_issue,
    });
    grouped.set(trace.fact_id, existing);
  }

  return Array.from(grouped.entries()).map(([fact_id, timeline]) => ({
    fact_id,
    timeline,
  }));
}
