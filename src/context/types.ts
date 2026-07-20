/**
 * Context Package types for Project-Lens v2.0
 *
 * Repository Context: internal data structure (facts only, no opinions)
 * Context Package: output to Agent (five parts: Scope / Structure / Evidence / Relation / Confidence)
 */

// ─── Repository Context (Builder output, internal) ────────────────────────────

export interface Module {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'class' | 'function' | 'interface' | 'enum' | 'variable';
  parent_module?: string;
  child_modules?: string[];
}

export interface Signature {
  name: string;
  qualified_name: string;
  type: 'function' | 'class' | 'interface' | 'enum' | 'method' | 'variable';
  file_path: string;
  start_line: number;
  end_line: number;
}

export interface Dependency {
  source: string;
  target: string;
  type: 'import' | 'call' | 'extends' | 'implements' | 'contains';
  file_path: string;
  line_number: number;
}

export interface Structure {
  path: string;
  type: 'directory' | 'file';
  children?: Structure[];
}

export interface FileEntry {
  path: string;
  size: number;
  lines: number;
}

export interface RepositoryMetadata {
  total_files: number;
  total_modules: number;
  built_at: string;
  builder_version: string;
}

export interface RepositoryContext {
  root: string;
  modules: Module[];
  signatures: Signature[];
  dependencies: Dependency[];
  structures: Structure[];
  files: FileEntry[];
  metadata: RepositoryMetadata;
  /** Text index for non-code files (docs, configs, etc.) — maps file path to content snippet */
  textIndex?: Record<string, string>;
}

// ─── Context Package (Assembler/Expander output, five parts) ──────────────────

export interface ScopeSection {
  modules: string[];
}

export interface StructureNode {
  name: string;
  path: string;
  children?: StructureNode[];
}

export interface StructureSection {
  root: string;
  tree: StructureNode[];
}

export interface EvidenceItem {
  claim: string;
  source: string;
  line: number;
  snippet?: string;
}

export interface EvidenceSection {
  items: EvidenceItem[];
}

export interface RelationItem {
  source: string;
  verb: string;
  target: string;
}

export interface RelationSection {
  items: RelationItem[];
}

export interface ConfidenceItem {
  module: string;
  score: number;
  reason: string;
}

export interface ConfidenceSection {
  items: ConfidenceItem[];
}

export interface ContextPackage {
  scope: ScopeSection;
  structure: StructureSection;
  evidence: EvidenceSection;
  relation: RelationSection;
  confidence: ConfidenceSection;
}