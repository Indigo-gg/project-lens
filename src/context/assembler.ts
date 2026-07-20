/**
 * Assembler — 根据问题组装 Context Package（在线）
 *
 * 输入：Question + Repository Context
 * 输出：Context Package（Scope / Structure / Evidence / Relation / Confidence）
 *
 * 核心逻辑：5 步顺序执行 → Scope → Structure → Evidence → Relation → Confidence
 * 约束：Structure ⊆ Scope
 */
import type { RepositoryContext, ContextPackage } from './types.js';

export interface AssembleOptions {
  maxScopeModules?: number;
  maxEvidence?: number;
}

export async function assembleContext(
  question: string,
  context: RepositoryContext,
  options: AssembleOptions = {}
): Promise<ContextPackage> {
  const maxScopeModules = options.maxScopeModules ?? 20;
  const maxEvidence = options.maxEvidence ?? 5;

  // Step 1: Determine Scope — extract keywords from question, match to modules
  const keywords = question.toLowerCase().split(/\s+/).filter(k => k.length > 0 && k.length < 50);
  const scopeModules = findRelevantModules(context, keywords, maxScopeModules);

  // Step 2: Build Structure — tree of modules within scope
  const structureTree = buildStructureTree(context, scopeModules);

  // Step 3: Match Evidence — for each module in structure, find source evidence
  const evidenceItems = buildEvidence(context, structureTree, maxEvidence);

  // Step 4: Build Relations — connections between modules in structure
  const relationItems = buildRelations(context, structureTree);

  // Step 5: Calculate Confidence — based on references, tests, docs
  const confidenceItems = calculateConfidence(context, structureTree);

  return {
    scope: { modules: scopeModules },
    structure: { root: context.root, tree: structureTree },
    evidence: { items: evidenceItems },
    relation: { items: relationItems },
    confidence: { items: confidenceItems },
  };
}

function findRelevantModules(
  context: RepositoryContext,
  keywords: string[],
  maxModules: number
): string[] {
  const scored = new Map<string, number>();

  // Score modules by name/path match
  for (const mod of context.modules) {
    const nameLower = mod.name.toLowerCase();
    const pathLower = mod.path.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (nameLower.includes(kw)) score += 3;
      else if (pathLower.includes(kw)) score += 1;
    }
    if (score > 0) scored.set(mod.path, (scored.get(mod.path) ?? 0) + score);
  }

  // Score modules by matching signature names AND file paths
  for (const sig of context.signatures) {
    const sigLower = sig.name.toLowerCase();
    const fileLower = sig.file_path.toLowerCase();
    for (const kw of keywords) {
      // Match by signature name (e.g., function named "bind")
      if (sigLower.includes(kw)) {
        const parentMod = context.modules
          .filter(m => sig.file_path.includes(m.path) && m.path !== '.')
          .sort((a, b) => b.path.length - a.path.length)[0];
        if (parentMod) {
          scored.set(parentMod.path, (scored.get(parentMod.path) ?? 0) + 2);
        }
      }
      // Match by file path (e.g., file named "orchestrator.py")
      if (fileLower.includes(kw)) {
        const parentMod = context.modules
          .filter(m => sig.file_path.includes(m.path) && m.path !== '.')
          .sort((a, b) => b.path.length - a.path.length)[0];
        if (parentMod) {
          scored.set(parentMod.path, (scored.get(parentMod.path) ?? 0) + 1);
        }
      }
    }
  }

  // Score modules by matching text content (docs, Chinese text, etc.)
  if (context.textIndex) {
    for (const [filePath, content] of Object.entries(context.textIndex)) {
      const contentLower = content.toLowerCase();
      for (const kw of keywords) {
        if (contentLower.includes(kw)) {
          const parentMod = context.modules
            .filter(m => filePath.includes(m.path) && m.path !== '.')
            .sort((a, b) => b.path.length - a.path.length)[0];
          if (parentMod) {
            scored.set(parentMod.path, (scored.get(parentMod.path) ?? 0) + 1);
          }
        }
      }
    }
  }

  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxModules)
    .map(([path]) => path);
}

interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[];
}

function buildStructureTree(
  context: RepositoryContext,
  scopeModules: string[]
): TreeNode[] {
  const roots: TreeNode[] = [];
  const nodeMap = new Map<string, TreeNode>();

  // Filter modules to scope
  const inScope = context.modules.filter(m =>
    scopeModules.some(s => m.path === s || m.path.startsWith(s + '/'))
  );

  for (const mod of inScope) {
    const parts = mod.path.split('/');
    let currentPath = '';
    for (const part of parts) {
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!nodeMap.has(currentPath)) {
        nodeMap.set(currentPath, { name: part, path: currentPath, children: [] });
      }
    }
  }

  // Build hierarchy
  for (const [nodePath, node] of nodeMap) {
    const parentPath = nodePath.split('/').slice(0, -1).join('/');
    if (parentPath && nodeMap.has(parentPath)) {
      nodeMap.get(parentPath)!.children!.push(node);
    } else if (!parentPath) {
      roots.push(node);
    }
  }

  // Flatten single-child intermediate directories
  function flattenTree(node: TreeNode): TreeNode {
    if (!node.children || node.children.length === 0) return node;
    let current = node;
    while (current.children && current.children.length === 1) {
      const onlyChild = current.children[0];
      if (onlyChild.children !== undefined) {
        current.name = onlyChild.name;
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

  return roots.map(flattenTree);
}

function buildEvidence(
  context: RepositoryContext,
  tree: TreeNode[],
  maxEvidence: number
): Array<{ claim: string; source: string; line: number; snippet?: string }> {
  const items: Array<{ claim: string; source: string; line: number; snippet?: string }> = [];

  for (const node of flattenTree(tree).slice(0, maxEvidence)) {
    const matchingMod = context.modules.find(m => m.path === node.path);
    if (matchingMod) {
      const matchingSig = context.signatures.find(s => s.file_path.includes(node.path));
      if (matchingSig) {
        items.push({
          claim: `${matchingMod.name} implements ${matchingSig.name}`,
          source: matchingSig.file_path,
          line: matchingSig.start_line,
        });
      }
    }
  }

  return items;
}

function buildRelations(
  context: RepositoryContext,
  tree: TreeNode[]
): Array<{ source: string; verb: string; target: string }> {
  const items: Array<{ source: string; verb: string; target: string }> = [];
  const scopePaths = new Set(flattenTree(tree).map(n => n.path));

  // Filter dependencies where both source and target are in scope
  for (const dep of context.dependencies) {
    if (scopePaths.has(dep.source) && scopePaths.has(dep.target)) {
      items.push({
        source: dep.source,
        verb: dep.type,
        target: dep.target,
      });
    }
  }

  return items;
}

function calculateConfidence(
  context: RepositoryContext,
  tree: TreeNode[]
): Array<{ module: string; score: number; reason: string }> {
  const items: Array<{ module: string; score: number; reason: string }> = [];

  for (const node of flattenTree(tree)) {
    const matchingMods = context.modules.filter(m => m.path.startsWith(node.path));
    const matchingSigs = context.signatures.filter(s => s.file_path.includes(node.path));

    // Confidence based on: number of signatures (code volume), dependencies (integration)
    const sigCount = matchingSigs.length;
    const depCount = context.dependencies.filter(d =>
      d.source.includes(node.path) || d.target.includes(node.path)
    ).length;

    const score = Math.min(1.0, 0.3 + sigCount * 0.02 + depCount * 0.05);
    const reason = `${sigCount} signatures, ${depCount} dependencies`;

    items.push({ module: node.path, score: Math.round(score * 100) / 100, reason });
  }

  return items;
}

function flattenTree(tree: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  for (const node of tree) {
    result.push(node);
    if (node.children) {
      result.push(...flattenTree(node.children));
    }
  }
  return result;
}