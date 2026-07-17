import Database from 'better-sqlite3';
import { rankEvidence, type RankedResult } from './ranking.js';

export interface ExploreOptions {
  query?: string;
  category?: string;
  evidence_type?: string;
  fact_type?: string;
  sort_by?: 'credibility' | 'importance' | 'recent';
  limit?: number;
  cursor?: string;
  context_scope?: string[];
}

export interface ExploreResult {
  fact: {
    id: number;
    type: string;
    filepath: string;
    line_range: [number, number];
    name: string;
    summary: string;
  };
  evidence: Array<{
    type: string;
    commit_hash?: string;
    author?: string;
    timestamp?: string;
    description?: string;
  }>;
  credibility: {
    has_benchmark: boolean;
    has_test: boolean;
    has_docs: boolean;
    has_git_history: boolean;
    score: number;
  };
  importance: {
    centrality: number;
    frequency: number;
    recency: number;
    score: number;
  };
}

export interface ExploreResponse {
  results: ExploreResult[];
  next_cursor?: string;
  total_count: number;
  navigation_guide?: Array<{
    from: string;
    to: string;
    via: string;
  }>;
}

export function explore(
  db: Database.Database,
  project: string,
  options: ExploreOptions
): ExploreResponse {
  const {
    query,
    category,
    evidence_type,
    fact_type,
    sort_by = 'credibility',
    limit = 20,
    cursor,
    context_scope,
  } = options;

  // Parse cursor for pagination offset
  let offset = 0;
  if (cursor) {
    try {
      const parsed = JSON.parse(cursor);
      offset = parsed.offset ?? 0;
    } catch {
      // Invalid cursor, ignore
    }
  }

  // Build search terms from query
  let searchTerms: string[] = [];
  if (query) {
    searchTerms = query.split(/\s+/).filter(Boolean);
  }

  // Build SQL query
  let sql = `
    SELECT DISTINCT n.id, n.label, n.name, n.file_path, n.start_line, n.end_line, n.properties, n.loc
    FROM nodes n
    WHERE n.project = ?
  `;
  const params: unknown[] = [project];

  // Filter by file scope
  if (context_scope && context_scope.length > 0) {
    const scopeConditions = context_scope.map(() => 'n.file_path LIKE ?').join(' OR ');
    sql += ` AND (${scopeConditions})`;
    for (const scope of context_scope) {
      params.push(`${scope}%`);
    }
  }

  // Filter by fact type
  if (fact_type) {
    sql += ' AND n.label = ?';
    params.push(fact_type);
  }

  // FTS search on nodes
  if (searchTerms.length > 0) {
    const ftsQuery = searchTerms.map(t => `"${t}"`).join(' OR ');
    sql += ` AND n.id IN (
      SELECT rowid FROM nodes_fts WHERE nodes_fts MATCH ?
    )`;
    params.push(ftsQuery);
  }

  // Execute query
  const rows = db.prepare(sql).all(...params) as Array<{
    id: number;
    label: string;
    name: string;
    file_path: string;
    start_line: number;
    end_line: number;
    properties: string | null;
    loc: number | null;
  }>;

  // Get node IDs for ranking
  const nodeIds = rows.map(r => r.id);

  // Rank results
  const ranked = rankEvidence(db, project, nodeIds);

  // Build results
  const results: ExploreResult[] = [];

  for (const row of rows) {
    const rankInfo = ranked.find(r => r.nodeId === row.id);

    // Get evidence for this node
    let evidenceSql = 'SELECT type, commit_hash, author, timestamp, description FROM evidence WHERE fact_id = ?';
    const evidenceParams: unknown[] = [row.id];

    if (evidence_type) {
      evidenceSql += ' AND type = ?';
      evidenceParams.push(evidence_type);
    }

    const evidenceRows = db.prepare(evidenceSql).all(...evidenceParams) as Array<{
      type: string;
      commit_hash: string | null;
      author: string | null;
      timestamp: string | null;
      description: string | null;
    }>;

    // Build summary
    const properties = row.properties ? JSON.parse(row.properties) : {};
    const summary = buildSummary(row.label, row.name, row.file_path, properties);

    results.push({
      fact: {
        id: row.id,
        type: row.label,
        filepath: row.file_path,
        line_range: [row.start_line, row.end_line],
        name: row.name,
        summary,
      },
      evidence: evidenceRows.map(e => ({
        type: e.type,
        commit_hash: e.commit_hash ?? undefined,
        author: e.author ?? undefined,
        timestamp: e.timestamp ?? undefined,
        description: e.description ?? undefined,
      })),
      credibility: rankInfo?.credibility ?? {
        has_benchmark: false,
        has_test: false,
        has_docs: false,
        has_git_history: false,
        score: 0,
      },
      importance: rankInfo?.importance ?? {
        centrality: 0,
        frequency: 0,
        recency: 0,
        score: 0,
      },
    });
  }

  // Sort results
  if (sort_by === 'recent') {
    results.sort((a, b) => {
      const aTime = a.evidence[0]?.timestamp ?? '';
      const bTime = b.evidence[0]?.timestamp ?? '';
      return bTime.localeCompare(aTime);
    });
  } else if (sort_by === 'importance') {
    results.sort((a, b) => b.importance.score - a.importance.score);
  } else {
    // Default: sort by credibility
    results.sort((a, b) => b.credibility.score - a.credibility.score);
  }

  // Apply offset and limit
  const limitedResults = results.slice(offset, offset + limit);

  // Build cursor for pagination
  let nextCursor: string | undefined;
  if (offset + limit < results.length) {
    nextCursor = JSON.stringify({ offset: offset + limit });
  }

  // Build navigation guide
  const navigation_guide = buildNavigationGuide(db, project, limitedResults);

  return {
    results: limitedResults,
    next_cursor: nextCursor,
    total_count: results.length,
    navigation_guide,
  };
}

function buildNavigationGuide(
  db: Database.Database,
  project: string,
  results: ExploreResult[]
): Array<{ from: string; to: string; via: string }> {
  if (results.length === 0) return [];

  const guide: Array<{ from: string; to: string; via: string }> = [];
  const nodeIds = results.map(r => r.fact.id);

  // Find connections between results
  const placeholders = nodeIds.map(() => '?').join(',');
  const edges = db.prepare(`
    SELECT e.source_id, e.target_id, e.type, 
           s.file_path as source_file, s.name as source_name,
           t.file_path as target_file, t.name as target_name
    FROM edges e
    JOIN nodes s ON e.source_id = s.id
    JOIN nodes t ON e.target_id = t.id
    WHERE e.source_id IN (${placeholders}) AND e.target_id IN (${placeholders})
  `).all(...nodeIds, ...nodeIds) as Array<{
    source_id: number;
    target_id: number;
    type: string;
    source_file: string;
    source_name: string;
    target_file: string;
    target_name: string;
  }>;

  for (const edge of edges.slice(0, 5)) { // Limit to 5 navigation paths
    guide.push({
      from: `${edge.source_name} (${edge.source_file})`,
      to: `${edge.target_name} (${edge.target_file})`,
      via: edge.type,
    });
  }

  return guide;
}

function buildSummary(label: string, name: string, filePath: string, properties: Record<string, unknown>): string {
  const lineCount = properties.lineCount as number ?? 0;
  const base = `${label} ${name} in ${filePath}`;
  if (lineCount > 0) {
    return `${base} (${lineCount} lines)`;
  }
  return base;
}
