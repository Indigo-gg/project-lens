import path from 'path';
import { openDatabase } from '../../store.js';
import { trace, type TraceOptions } from '../../query/trace.js';

export async function handleTrace(args: {
  query?: string;
  fact_id?: number;
  filepath?: string;
  author?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  // Get project name from cwd or infer it
  const projectPath = process.cwd();
  const projectName = path.basename(projectPath);

  const { db, close } = openDatabase(projectName);

  try {
    const options: TraceOptions = {
      query: args.query,
      fact_id: args.fact_id,
      filepath: args.filepath,
      author: args.author,
      date_from: args.date_from,
      date_to: args.date_to,
      limit: args.limit,
    };

    const result = trace(db, projectName, options);

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
