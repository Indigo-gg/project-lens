import Database from 'better-sqlite3';
import { expandRequirement, expandSearchTerms } from './requirement-expander.js';
import { rankEvidence, type RankedResult } from './ranking.js';

export interface SearchOptions {
  query?: string;
  category?: string;
  evidence_type?: string;
  fact_type?: string;
  relation?: string;
  requirement?: string;
  sort_by?: 'score' | 'recent' | 'author';
  limit?: number;
  cursor?: string;
  context_scope?: string[];
}

export interface SearchResult {
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
  score: number;
  decision_trace?: Array<{
    commit_hash: string;
    author: string;
    timestamp: string;
    change_type: string;
    description: string;
  }>;
}

export interface SearchResponse {
  results: SearchResult[];
  next_cursor?: string;
  total_count: number;
}

export function searchEvidence(
  db: Database.Database,
  project: string,
  options: SearchOptions
): SearchResponse {
  const {
    query,
    category,
    evidence_type,
    fact_type,
    relation,
    requirement,
    sort_by = 'score',
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

  // Build search terms
  let searchTerms: string[] = [];
  let expandedCategory = category ?? null;

  if (requirement) {
    const expanded = expandRequirement(requirement, db);
    searchTerms = expanded.searchTerms;
    expandedCategory = expanded.category ?? category ?? null;
  }

  if (query) {
    searchTerms.push(...query.split(/\s+/).filter(Boolean));
  }

  // Deduplicate search terms
  searchTerms = [...new Set(searchTerms)];

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
  const results: SearchResult[] = [];

  for (const row of rows) {
    const rankInfo = ranked.find(r => r.nodeId === row.id);
    const score = rankInfo?.score ?? 0;

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

    // Get decision traces if requested
    let decisionTrace: SearchResult['decision_trace'] | undefined;
    if (relation === 'decision') {
      const traceRows = db.prepare(
        'SELECT commit_hash, author, timestamp, change_type, ast_change FROM decision_traces WHERE fact_id = ? ORDER BY timestamp DESC'
      ).all(row.id) as Array<{
        commit_hash: string;
        author: string;
        timestamp: string;
        change_type: string;
        ast_change: string;
      }>;

      decisionTrace = traceRows.map(t => ({
        commit_hash: t.commit_hash,
        author: t.author,
        timestamp: t.timestamp,
        change_type: t.change_type,
        description: t.ast_change,
      }));
    }

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
      score,
      decision_trace: decisionTrace,
    });
  }

  // Sort results
  if (sort_by === 'recent') {
    results.sort((a, b) => {
      const aTime = a.evidence[0]?.timestamp ?? '';
      const bTime = b.evidence[0]?.timestamp ?? '';
      return bTime.localeCompare(aTime);
    });
  } else if (sort_by === 'author') {
    results.sort((a, b) => {
      const aAuthor = a.evidence[0]?.author ?? '';
      const bAuthor = b.evidence[0]?.author ?? '';
      return aAuthor.localeCompare(bAuthor);
    });
  } else {
    // Default: sort by score
    results.sort((a, b) => b.score - a.score);
  }

  // Apply offset and limit
  const limitedResults = results.slice(offset, offset + limit);

  // Build cursor for pagination
  let nextCursor: string | undefined;
  if (offset + limit < results.length) {
    nextCursor = JSON.stringify({ offset: offset + limit });
  }

  return {
    results: limitedResults,
    next_cursor: nextCursor,
    total_count: results.length,
  };
}

function buildSummary(label: string, name: string, filePath: string, properties: Record<string, unknown>): string {
  const lineCount = properties.lineCount as number ?? 0;
  const base = `${label} ${name} in ${filePath}`;
  if (lineCount > 0) {
    return `${base} (${lineCount} lines)`;
  }
  return base;
}
