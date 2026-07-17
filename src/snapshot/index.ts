import Database from 'better-sqlite3';
import { buildSnapshot, type ProjectSnapshot } from './builder.js';
import { compressSnapshot, type CompressedSnapshot } from './compressor.js';

export interface ExportOptions {
  format?: 'json' | 'compact';
  include_git_history?: boolean;
  max_tokens?: number;
}

export interface ExportResult {
  snapshot: ProjectSnapshot | CompressedSnapshot;
  token_estimate: number;
}

export function exportSnapshot(
  db: Database.Database,
  project: string,
  options: ExportOptions = {}
): ExportResult {
  const {
    format = 'compact',
    include_git_history = true,
    max_tokens = 50000,
  } = options;

  // Build full snapshot
  const snapshot = buildSnapshot(db, project, {
    include_git_history,
  });

  // Compress if needed
  if (format === 'compact') {
    const compressed = compressSnapshot(snapshot, max_tokens);
    return {
      snapshot: compressed,
      token_estimate: compressed._compressed_token_estimate,
    };
  }

  // JSON format: return full snapshot
  const tokenEstimate = JSON.stringify(snapshot).length / 4; // rough estimate
  return {
    snapshot,
    token_estimate: Math.ceil(tokenEstimate),
  };
}

export type { ProjectSnapshot, CompressedSnapshot };
export { buildSnapshot } from './builder.js';
export { compressSnapshot } from './compressor.js';
export { estimateTokens, estimateObjectTokens } from './token-estimator.js';
