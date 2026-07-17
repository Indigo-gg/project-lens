import path from 'path';
import { openDatabase } from '../../store.js';
import { verifyStatement } from '../../verify/verdict.js';

export async function handleVerifyStatement(args: {
  statement: string;
  context_scope?: string[];
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const projectPath = process.cwd();
  const projectName = path.basename(projectPath);

  const { db, close } = openDatabase(projectName);

  try {
    const result = verifyStatement(db, projectName, args.statement, args.context_scope);

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
