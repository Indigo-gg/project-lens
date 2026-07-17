import Database from 'better-sqlite3';

export interface TraceOptions {
  query?: string;
  fact_id?: number;
  filepath?: string;
  author?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export interface TraceTimeline {
  commit_hash: string;
  author: string;
  timestamp: string;
  change_type: 'introduction' | 'modification' | 'replacement' | 'removal';
  description: string;
  affected_facts: Array<{
    fact_id: number;
    name: string;
    filepath: string;
    change_description: string;
  }>;
  related_issue?: string;
}

export interface TraceResponse {
  timeline: TraceTimeline[];
  decision_summary?: {
    key_decisions: Array<{
      timestamp: string;
      description: string;
      rationale: string;
    }>;
  };
}

export function trace(
  db: Database.Database,
  project: string,
  options: TraceOptions
): TraceResponse {
  const {
    query,
    fact_id,
    filepath,
    author,
    date_from,
    date_to,
    limit = 50,
  } = options;

  let sql = `
    SELECT dt.commit_hash, dt.author, dt.timestamp, dt.change_type, 
           dt.ast_change as description, dt.related_issue,
           n.id as fact_id, n.name as fact_name, n.file_path as fact_filepath
    FROM decision_traces dt
    JOIN nodes n ON dt.fact_id = n.id
    WHERE n.project = ?
  `;
  const params: unknown[] = [project];

  // Filter by fact_id
  if (fact_id) {
    sql += ' AND dt.fact_id = ?';
    params.push(fact_id);
  }

  // Filter by filepath
  if (filepath) {
    sql += ' AND n.file_path LIKE ?';
    params.push(`${filepath}%`);
  }

  // Filter by author
  if (author) {
    sql += ' AND dt.author = ?';
    params.push(author);
  }

  // Filter by date range
  if (date_from) {
    sql += ' AND dt.timestamp >= ?';
    params.push(date_from);
  }
  if (date_to) {
    sql += ' AND dt.timestamp <= ?';
    params.push(date_to);
  }

  // Filter by query term
  if (query) {
    sql += ' AND (n.name LIKE ? OR n.file_path LIKE ? OR dt.ast_change LIKE ?)';
    params.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }

  // Order by timestamp and limit
  sql += ' ORDER BY dt.timestamp DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(sql).all(...params) as Array<{
    commit_hash: string;
    author: string;
    timestamp: string;
    change_type: string;
    description: string;
    related_issue: string | null;
    fact_id: number;
    fact_name: string;
    fact_filepath: string;
  }>;

  // Group by commit_hash to build timeline
  const commitMap = new Map<string, TraceTimeline>();

  for (const row of rows) {
    let timeline = commitMap.get(row.commit_hash);
    if (!timeline) {
      timeline = {
        commit_hash: row.commit_hash,
        author: row.author,
        timestamp: row.timestamp,
        change_type: mapChangeType(row.change_type),
        description: row.description,
        affected_facts: [],
        related_issue: row.related_issue ?? undefined,
      };
      commitMap.set(row.commit_hash, timeline);
    }

    timeline.affected_facts.push({
      fact_id: row.fact_id,
      name: row.fact_name,
      filepath: row.fact_filepath,
      change_description: row.description,
    });
  }

  const timeline = Array.from(commitMap.values());

  // Build decision summary
  const decision_summary = buildDecisionSummary(timeline);

  return {
    timeline,
    decision_summary,
  };
}

function mapChangeType(type: string): 'introduction' | 'modification' | 'replacement' | 'removal' {
  const lower = type.toLowerCase();
  if (lower.includes('introduction') || lower.includes('add') || lower.includes('create')) {
    return 'introduction';
  }
  if (lower.includes('removal') || lower.includes('delete') || lower.includes('remove')) {
    return 'removal';
  }
  if (lower.includes('replacement') || lower.includes('replace')) {
    return 'replacement';
  }
  return 'modification';
}

function buildDecisionSummary(timeline: TraceTimeline[]): TraceResponse['decision_summary'] {
  if (timeline.length === 0) return undefined;

  // Extract key decisions from commit messages
  const keyDecisions = timeline
    .filter(t => t.description.length > 10) // Filter out trivial commits
    .slice(0, 5) // Limit to 5 key decisions
    .map(t => ({
      timestamp: t.timestamp,
      description: t.description,
      rationale: extractRationale(t.description),
    }));

  return {
    key_decisions: keyDecisions,
  };
}

function extractRationale(description: string): string {
  // Simple heuristic to extract rationale from commit message
  // Look for common patterns like "because", "to fix", "to improve", etc.
  const patterns = [
    /because\s+(.+)/i,
    /to\s+(fix|improve|add|remove|update|refactor|optimize)\s+(.+)/i,
    /fix(es|ed)?\s+(.+)/i,
    /improve(s|d)?\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) {
      return match[0];
    }
  }

  // If no pattern found, return the description itself
  return description;
}
