import path from 'path';
import { openDatabase } from '../../store.js';
import { exportSnapshot } from '../../snapshot/index.js';

export async function handleExportSnapshot(args: {
  format?: 'json' | 'compact';
  include_git_history?: boolean;
  max_tokens?: number;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const projectPath = process.cwd();
  const projectName = path.basename(projectPath);

  const { db, close } = openDatabase(projectName);

  try {
    const result = exportSnapshot(db, projectName, {
      format: args.format,
      include_git_history: args.include_git_history,
      max_tokens: args.max_tokens,
    });

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
