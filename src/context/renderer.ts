/**
 * Renderer — 格式化输出给 Agent
 *
 * 输入：Context Package
 * 输出：格式化的 Agent 可读文本
 *
 * 五部分按顺序输出，用 Markdown 结构。
 * 输出前验证完整性，遇不一致标记但不停止。
 */
import type { ContextPackage } from './types.js';

export interface RenderOptions {
  format?: 'compact' | 'verbose';
  maxDepth?: number;
  maxEvidencePerModule?: number;
  includeConfidence?: boolean;
}

export function renderContext(
  pkg: ContextPackage,
  options: RenderOptions = {}
): string {
  const fmt = options.format ?? 'compact';
  const showConfidence = options.includeConfidence ?? true;
  const parts: string[] = [];

  // Validate
  const warnings = validatePackage(pkg);
  if (warnings.length > 0) {
    parts.push(`> ⚠️ Context warnings: ${warnings.join('; ')}\n`);
  }

  // 1. Scope
  parts.push(renderScope(pkg, fmt));

  // 2. Structure
  parts.push(renderStructure(pkg, fmt, options.maxDepth));

  // 3. Evidence
  parts.push(renderEvidence(pkg, fmt, options.maxEvidencePerModule));

  // 4. Relation
  parts.push(renderRelation(pkg, fmt));

  // 5. Confidence
  if (showConfidence) {
    parts.push(renderConfidence(pkg, fmt));
  }

  return parts.join('\n---\n\n');
}

function renderScope(pkg: ContextPackage, fmt: string): string {
  const lines = ['## Scope'];
  if (pkg.scope.modules.length === 0) {
    lines.push('_(empty — no relevant modules found)_');
  } else {
    for (const mod of pkg.scope.modules) {
      lines.push(`- ${mod}`);
    }
  }
  return lines.join('\n');
}

function renderStructure(pkg: ContextPackage, fmt: string, maxDepth?: number): string {
  const lines = ['## Structure'];
  if (pkg.structure.tree.length === 0) {
    lines.push('_(no structure available)_');
    return lines.join('\n');
  }

  const depth = maxDepth ?? 5;
  renderTreeNodes(pkg.structure.tree, lines, 0, depth, fmt === 'compact');
  return lines.join('\n');
}

function renderTreeNodes(
  nodes: Array<{ name: string; path: string; children?: Array<{ name: string; path: string; children?: any[] }> }>,
  lines: string[],
  depth: number,
  maxDepth: number,
  compact: boolean
): void {
  if (depth >= maxDepth) return;

  for (const node of nodes) {
    if (compact) {
      lines.push(`${'  '.repeat(depth)}- ${node.name}`);
    } else {
      lines.push(`${'  '.repeat(depth)}- **${node.name}** (${node.path})`);
    }
    if (node.children && node.children.length > 0) {
      renderTreeNodes(node.children, lines, depth + 1, maxDepth, compact);
    }
  }
}

function renderEvidence(pkg: ContextPackage, fmt: string, maxPerModule?: number): string {
  const lines = ['## Evidence'];
  if (pkg.evidence.items.length === 0) {
    lines.push('_(no evidence available)_');
    return lines.join('\n');
  }

  const limit = maxPerModule ?? 5;
  const shown = pkg.evidence.items.slice(0, limit);

  for (const item of shown) {
    if (fmt === 'compact') {
      lines.push(`- ${item.claim} → ${item.source}:${item.line}`);
    } else {
      lines.push(`- **${item.claim}**`);
      lines.push(`  - Source: ${item.source}:${item.line}`);
      if (item.snippet) lines.push(`  - ${item.snippet}`);
    }
  }

  if (pkg.evidence.items.length > limit) {
    lines.push(`- *...and ${pkg.evidence.items.length - limit} more*`);
  }

  return lines.join('\n');
}

function renderRelation(pkg: ContextPackage, fmt: string): string {
  const lines = ['## Relation'];
  if (pkg.relation.items.length === 0) {
    lines.push('_(no relations available)_');
    return lines.join('\n');
  }

  for (const item of pkg.relation.items) {
    lines.push(`- ${item.source} → ${item.verb} → ${item.target}`);
  }

  return lines.join('\n');
}

function renderConfidence(pkg: ContextPackage, fmt: string): string {
  const lines = ['## Confidence'];
  if (pkg.confidence.items.length === 0) {
    lines.push('_(no confidence data)_');
    return lines.join('\n');
  }

  for (const item of pkg.confidence.items) {
    const scoreBar = getScoreBar(item.score);
    const warning = item.score < 0.5 ? ' ⚠️' : '';
    lines.push(`- ${item.module}: ${scoreBar} ${(item.score * 100).toFixed(0)}% — ${item.reason}${warning}`);
  }

  return lines.join('\n');
}

function getScoreBar(score: number): string {
  const filled = Math.round(score * 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function validatePackage(pkg: ContextPackage): string[] {
  const warnings: string[] = [];

  if (pkg.scope.modules.length === 0) {
    warnings.push('Scope is empty');
  }

  // Check Structure ⊆ Scope
  const scopeSet = new Set(pkg.scope.modules);
  function checkNode(node: { path: string; children?: any[] }): void {
    // Check if this node's path is in scope (or a parent path is)
    const inScope = [...scopeSet].some(s => node.path === s || node.path.startsWith(s + '/') || s.startsWith(node.path + '/'));
    if (!inScope && node.path) {
      warnings.push(`Structure node "${node.path}" outside Scope`);
    }
    if (node.children) {
      for (const child of node.children) {
        checkNode(child);
      }
    }
  }
  for (const node of pkg.structure.tree) {
    checkNode(node);
  }

  return warnings;
}