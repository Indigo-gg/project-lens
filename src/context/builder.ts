/**
 * Builder — 建立 Repository Context（离线）
 *
 * 输入：Repository 路径
 * 输出：Repository Context（内部数据结构，不包含观点）
 *
 * Builder 包装现有的 extractor 逻辑，将结果转换为 Repository Context 格式。
 * 不判断相关性，只回答"仓库里有什么"。
 */

import path from 'path';
import { extractProject } from '../extractor/index.js';
import { openDatabase } from '../store.js';
import type {
  Module,
  Signature,
  Dependency,
  Structure,
  FileEntry,
  RepositoryContext,
  RepositoryMetadata,
} from './types.js';

export interface BuildOptions {
  forceReindex?: boolean;
}

/**
 * 构建 Repository Context
 */
export async function buildRepositoryContext(
  repoPath: string,
  options: BuildOptions = {}
): Promise<RepositoryContext> {
  const projectName = path.basename(repoPath);

  // 调用现有 extractor（可能为空如果无增量变更）
  const extractResult = await extractProject(repoPath, {
    forceReindex: options.forceReindex ?? false,
  });

  // 从数据库读取详细信息
  const { db, close } = openDatabase(projectName);
  try {
    // 1. Modules
    const modules = buildModules(extractResult, db, projectName);

    // 2. Signatures
    const signatures = buildSignatures(db, projectName);

    // 3. Dependencies
    const dependencies = buildDependencies(db, projectName);

    // 4. Structure tree
    const structures = buildStructureTree(modules);

    // 5. Text index for non-code files (docs with Chinese text, etc.)
    const textIndex = buildTextIndex(db, projectName);

    // 6. Metadata
    const metadata: RepositoryMetadata = {
      total_files: extractResult.stats.filesScanned || countFiles(db, projectName),
      total_modules: modules.length,
      built_at: new Date().toISOString(),
      builder_version: '2.0.0',
    };

    return {
      root: path.resolve(repoPath),
      modules,
      signatures,
      dependencies,
      structures,
      files: [],
      textIndex,
      metadata,
    };
  } finally {
    close();
  }
}

function buildModules(
  extractResult: { modules: Array<{ path: string; facts: number }> },
  db: any,
  projectName: string
): Module[] {
  if (extractResult.modules.length > 0) {
    return extractResult.modules.map((m) => ({
      name: path.basename(m.path) || m.path,
      path: m.path,
      type: 'directory' as const,
    }));
  }

  // Fallback: derive modules from file paths in database
  const filePaths = db.prepare(
    `SELECT DISTINCT file_path FROM nodes WHERE project = ?`
  ).all(projectName) as Array<{ file_path: string }>;

  const dirSet = new Set<string>();
  for (const { file_path } of filePaths) {
    const dir = path.dirname(file_path);
    if (dir && dir !== '.') dirSet.add(dir);
  }

  return [...dirSet].sort().map(d => ({
    name: path.basename(d),
    path: d,
    type: 'directory' as const,
  }));
}

function buildSignatures(db: any, projectName: string): Signature[] {
  const rows = db.prepare(
    `SELECT name, qualified_name, label, file_path, start_line, end_line
     FROM nodes WHERE project = ? AND label IN ('function', 'class', 'method', 'interface')`
  ).all(projectName) as Array<{
    name: string; qualified_name: string; label: string;
    file_path: string; start_line: number; end_line: number;
  }>;

  return rows.map(r => ({
    name: r.name,
    qualified_name: r.qualified_name,
    type: r.label as Signature['type'],
    file_path: r.file_path,
    start_line: r.start_line,
    end_line: r.end_line,
  }));
}

function buildDependencies(db: any, projectName: string): Dependency[] {
  const rows = db.prepare(
    `SELECT e.source_id, e.target_id, e.type,
            s.qualified_name as source_qn, t.qualified_name as target_qn
     FROM edges e
     JOIN nodes s ON e.source_id = s.id
     JOIN nodes t ON e.target_id = t.id
     WHERE s.project = ?`
  ).all(projectName) as Array<{
    source_id: number; target_id: number; type: string;
    source_qn: string; target_qn: string;
  }>;

  return rows.map(r => ({
    source: r.source_qn,
    target: r.target_qn,
    type: r.type as Dependency['type'],
    file_path: '',
    line_number: 0,
  }));
}

function countFiles(db: any, projectName: string): number {
  const row = db.prepare(
    'SELECT COUNT(DISTINCT file_path) as cnt FROM nodes WHERE project = ?'
  ).get(projectName) as { cnt: number };
  return row?.cnt ?? 0;
}

function buildTextIndex(db: any, projectName: string): Record<string, string> {
  const rows = db.prepare(
    `SELECT file_path, properties FROM nodes
     WHERE project = ? AND label = 'file' AND properties IS NOT NULL
       AND properties LIKE '%text%'`
  ).all(projectName) as Array<{ file_path: string; properties: string }>;

  const index: Record<string, string> = {};
  for (const row of rows) {
    try {
      const props = JSON.parse(row.properties);
      if (props.text && typeof props.text === 'string') {
        index[row.file_path] = props.text.substring(0, 500);
      }
    } catch { /* skip malformed JSON */ }
  }
  return index;
}

/**
 * 从模块列表构建目录结构树
 */
function buildStructureTree(modules: Module[]): Structure[] {
  const dirSet = new Set<string>();
  for (const mod of modules) {
    const parts = mod.path.split('/');
    let acc = '';
    for (const part of parts) {
      if (part) {
        acc = acc ? `${acc}/${part}` : part;
        dirSet.add(acc);
      }
    }
  }

  const root: Structure = { path: '', type: 'directory', children: [] };
  const dirMap = new Map<string, Structure>();
  dirMap.set('', root);

  for (const dirPath of [...dirSet].sort()) {
    const parentPath = path.dirname(dirPath);
    const parent = dirMap.get(parentPath === '.' ? '' : parentPath);
    if (parent && parent.children) {
      const node: Structure = { path: dirPath, type: 'directory', children: [] };
      parent.children.push(node);
      dirMap.set(dirPath, node);
    }
  }

  // Flatten single-child intermediate directories (e.g., "src" with only "core")
  function flattenTree(node: Structure): Structure {
    if (!node.children || node.children.length === 0) return node;
    let current = node;
    while (current.children && current.children.length === 1) {
      const onlyChild: Structure = current.children[0];
      if (onlyChild.type === 'directory') {
        current.path = onlyChild.path;
        current.children = onlyChild.children;
      } else {
        break;
      }
    }
    if (current.children) {
      current.children = current.children.map(flattenTree);
    }
    return current;
  }

  return (root.children || []).map(flattenTree);
}