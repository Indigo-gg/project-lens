import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface FileHash {
  relPath: string;
  sha256: string;
  mtimeMs: number;
  size: number;
}

export interface ScanResult {
  changed: FileHash[];
  added: FileHash[];
  removed: string[];
  unchanged: string[];
}

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next',
  '__pycache__', '.venv', 'venv', '.env',
]);

const IGNORED_EXTENSIONS = new Set([
  '.lock', '.min.js', '.min.css', '.map',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.eot',
]);

export async function scanFiles(
  projectPath: string,
  existingHashes: Map<string, FileHash>,
): Promise<ScanResult> {
  const currentFiles = new Map<string, FileHash>();
  await walkDir(projectPath, projectPath, currentFiles);

  const changed: FileHash[] = [];
  const added: FileHash[] = [];
  const removed: string[] = [];
  const unchanged: string[] = [];

  for (const [relPath, hash] of currentFiles) {
    const existing = existingHashes.get(relPath);
    if (!existing) {
      added.push(hash);
    } else if (existing.sha256 !== hash.sha256) {
      changed.push(hash);
    } else {
      unchanged.push(relPath);
    }
  }

  for (const relPath of existingHashes.keys()) {
    if (!currentFiles.has(relPath)) {
      removed.push(relPath);
    }
  }

  return { changed, added, removed, unchanged };
}

async function walkDir(
  baseDir: string,
  currentDir: string,
  result: Map<string, FileHash>,
): Promise<void> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      await walkDir(baseDir, path.join(currentDir, entry.name), result);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (IGNORED_EXTENSIONS.has(ext)) continue;

    const fullPath = path.join(currentDir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    try {
      const stat = await fs.stat(fullPath);
      const content = await fs.readFile(fullPath);
      const sha256 = crypto.createHash('sha256').update(content).digest('hex');

      result.set(relPath, {
        relPath,
        sha256,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
      });
    } catch {
      // skip unreadable files
    }
  }
}

export function getSupportedExtensions(): string[] {
  return [
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.py', '.pyi',
    '.go',
    '.rs',
    '.java', '.kt',
    '.rb',
    '.php',
    '.c', '.cpp', '.h', '.hpp',
    '.cs',
    '.swift',
    '.vue', '.svelte',
  ];
}
