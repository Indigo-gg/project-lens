import path from 'path';
import { openDatabase } from '../../store.js';
import { explore, type ExploreOptions } from '../../query/explore.js';

export async function handleExplore(args: {
  query?: string;
  category?: string;
  evidence_type?: string;
  fact_type?: string;
  sort_by?: 'credibility' | 'importance' | 'recent';
  limit?: number;
  cursor?: string;
  context_scope?: string[];
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  // Get project name from cwd or infer it
  const projectPath = process.cwd();
  const projectName = path.basename(projectPath);

  const { db, close } = openDatabase(projectName);

  try {
    const options: ExploreOptions = {
      query: args.query,
      category: args.category,
      evidence_type: args.evidence_type,
      fact_type: args.fact_type,
      sort_by: args.sort_by,
      limit: args.limit,
      cursor: args.cursor,
      context_scope: args.context_scope,
    };

    const result = explore(db, projectName, options);

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
