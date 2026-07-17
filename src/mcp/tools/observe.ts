import path from 'path';
import fs from 'fs';
import { extractProject } from '../../extractor/index.js';

function validateProjectPath(projectPath: string): { valid: boolean; error?: string } {
  const resolved = path.resolve(projectPath);
  const cwd = process.cwd();

  // Check for path traversal
  if (resolved.includes('..')) {
    return { valid: false, error: 'Path traversal detected' };
  }

  // Check if path exists
  if (!fs.existsSync(resolved)) {
    return { valid: false, error: `Path does not exist: ${resolved}` };
  }

  // Check if path is a directory
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    return { valid: false, error: `Path is not a directory: ${resolved}` };
  }

  // Check if path is within allowed范围 (current working directory or its subdirectories)
  if (!resolved.startsWith(cwd) && resolved !== cwd) {
    return { valid: false, error: `Path must be within current working directory: ${cwd}` };
  }

  return { valid: true };
}

export async function handleObserve(args: {
  project_path?: string;
  force_reindex?: boolean;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const projectPath = args.project_path ?? process.cwd();

  const validation = validateProjectPath(projectPath);
  if (!validation.valid) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: validation.error }),
      }],
    };
  }

  try {
    const result = await extractProject(projectPath, {
      forceReindex: args.force_reindex ?? false,
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
  }
}
