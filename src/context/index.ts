/**
 * Project-Lens Context Module
 *
 * 核心模块：Builder / Assembler / Expander / Renderer
 *
 * 依据 Constitution v2.0：
 * Lens 的唯一产出是 Context Package（五部分：Scope / Structure / Evidence / Relation / Confidence）
 */
export { buildRepositoryContext } from './builder.js';
export type { BuildOptions } from './builder.js';

export { assembleContext } from './assembler.js';
export type { AssembleOptions } from './assembler.js';

export { expandContext } from './expander.js';
export type { ExpandOptions } from './expander.js';

export { renderContext } from './renderer.js';
export type { RenderOptions } from './renderer.js';

export type {
  // Repository Context types
  RepositoryContext,
  Module,
  Signature,
  Dependency,
  Structure,
  FileEntry,
  RepositoryMetadata,
  // Context Package types
  ContextPackage,
  ScopeSection,
  StructureSection,
  StructureNode,
  EvidenceSection,
  EvidenceItem,
  RelationSection,
  RelationItem,
  ConfidenceSection,
  ConfidenceItem,
} from './types.js';