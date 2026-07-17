import path from 'path';
import { openDatabase } from '../../store.js';
import { searchEvidence, type SearchOptions } from '../../query/search.js';

export async function handleSearchEvidence(args: {
  query?: string;
  category?: string;
  evidence_type?: string;
  fact_type?: string;
  relation?: string;
  requirement?: string;
  sort_by?: 'score' | 'recent' | 'author';
  limit?: number;
  cursor?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  // Get project name from cwd or infer it
  const projectPath = process.cwd();
  const projectName = path.basename(projectPath);

  const { db, close } = openDatabase(projectName);

  try {
    const options: SearchOptions = {
      query: args.query,
      category: args.category,
      evidence_type: args.evidence_type,
      fact_type: args.fact_type,
      relation: args.relation,
      requirement: args.requirement,
      sort_by: args.sort_by,
      limit: args.limit,
      cursor: args.cursor,
    };

    const result = searchEvidence(db, projectName, options);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        }),
      }],
    };
  } finally {
    close();
  }
}
