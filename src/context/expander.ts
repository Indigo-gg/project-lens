/**
 * Expander — 增量扩展已有 Context（在线）
 *
 * 输入：Follow-up Question + 已有 Context Package + Repository Context
 * 输出：扩展后的 Context Package
 *
 * 三种情况：
 * 1. Scope 内追问 → 只扩展 Evidence 和 Relation
 * 2. Scope 相邻追问 → 扩展 Scope，更新 Structure
 * 3. 完全超出 Scope → 触发重新 Assemble（保留历史）
 */
import { assembleContext } from './assembler.js';
import type { RepositoryContext, ContextPackage } from './types.js';

export interface ExpandOptions {
  expansionMode?: 'narrow' | 'broad';
}

export async function expandContext(
  followUpQuestion: string,
  existingContext: ContextPackage,
  repositoryContext: RepositoryContext,
  options: ExpandOptions = {}
): Promise<ContextPackage> {
  const mode = options.expansionMode ?? 'narrow';

  // Check if follow-up is within existing scope
  const keywords = followUpQuestion.toLowerCase().split(/\s+/).filter(k => k.length > 2);
  const existingScope = new Set(existingContext.scope.modules);

  let inScope = true;
  let adjacentModules: string[] = [];

  // Check if any keyword matches modules outside the existing scope
  for (const mod of repositoryContext.modules) {
    const modLower = mod.path.toLowerCase();
    for (const kw of keywords) {
      if (modLower.includes(kw) && !existingScope.has(mod.path)) {
        inScope = false;
        adjacentModules.push(mod.path);
      }
    }
  }

  if (inScope) {
    // Case 1: Within scope — expand evidence and relations only
    return {
      ...existingContext,
      evidence: {
        items: [
          ...existingContext.evidence.items,
          ...generateAdditionalEvidence(repositoryContext, existingContext, keywords),
        ],
      },
      relation: {
        items: [
          ...existingContext.relation.items,
          ...generateAdditionalRelations(repositoryContext, existingContext, keywords),
        ],
      },
    };
  }

  if (mode === 'narrow' && adjacentModules.length > 0) {
    // Case 2: Adjacent — expand scope
    const newScope = [...existingContext.scope.modules, ...adjacentModules];
    // Rebuild structure with expanded scope
    const newContext = await assembleContext(followUpQuestion, repositoryContext);
    return {
      scope: { modules: [...new Set([...existingContext.scope.modules, ...newContext.scope.modules])] },
      structure: newContext.structure,
      evidence: {
        items: [...existingContext.evidence.items, ...newContext.evidence.items],
      },
      relation: {
        items: [...existingContext.relation.items, ...newContext.relation.items],
      },
      confidence: {
        items: [...existingContext.confidence.items, ...newContext.confidence.items],
      },
    };
  }

  // Case 3: Completely out of scope — reassemble
  return assembleContext(followUpQuestion, repositoryContext);
}

function generateAdditionalEvidence(
  context: RepositoryContext,
  existing: ContextPackage,
  keywords: string[]
): Array<{ claim: string; source: string; line: number; snippet?: string }> {
  const existingClaims = new Set(existing.evidence.items.map(e => e.claim));
  const newItems: Array<{ claim: string; source: string; line: number; snippet?: string }> = [];
  const existingScope = new Set(existing.scope.modules);

  // Find signatures in scope modules that weren't already claimed
  for (const sig of context.signatures) {
    if (!existingClaims.has(sig.name)) {
      const inScopeMod = context.modules.find(m =>
        sig.file_path.includes(m.path) && existingScope.has(m.path)
      );
      if (inScopeMod) {
        newItems.push({
          claim: `${inScopeMod.name}.${sig.name}`,
          source: sig.file_path,
          line: sig.start_line,
        });
      }
    }
  }

  return newItems.slice(0, 5);
}

function generateAdditionalRelations(
  context: RepositoryContext,
  existing: ContextPackage,
  keywords: string[]
): Array<{ source: string; verb: string; target: string }> {
  const existingRels = new Set(existing.relation.items.map(r => `${r.source}->${r.target}`));
  const existingScope = new Set(existing.scope.modules);

  return context.dependencies
    .filter(d =>
      existingScope.has(d.source) && existingScope.has(d.target) &&
      !existingRels.has(`${d.source}->${d.target}`)
    )
    .map(d => ({ source: d.source, verb: d.type, target: d.target }))
    .slice(0, 5);
}