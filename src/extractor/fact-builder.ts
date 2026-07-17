import crypto from 'crypto';
import type { AstNode } from './ast-parser.js';

export interface Fact {
  project: string;
  label: string;
  name: string;
  qualified_name: string;
  file_path: string;
  start_line: number;
  end_line: number;
  properties: Record<string, unknown>;
  content_hash: string;
  loc: number;
}

export interface Edge {
  project: string;
  source_qualified_name: string;
  target_qualified_name: string;
  type: string;
  properties?: Record<string, unknown>;
}

const NODE_TYPE_TO_LABEL: Record<string, string> = {
  function_declaration: 'function',
  function_definition: 'function',
  method_definition: 'method',
  method_declaration: 'method',
  class_declaration: 'class',
  class_definition: 'class',
  interface_declaration: 'interface',
  type_alias_declaration: 'type',
  type_declaration: 'type',
  enum_declaration: 'enum',
  import_statement: 'import',
  import_declaration: 'import',
  import_from_statement: 'import',
  variable_declaration: 'variable',
  lexical_declaration: 'variable',
  short_var_declaration: 'variable',
  export_statement: 'export',
};

export function buildFacts(
  project: string,
  filePath: string,
  nodes: AstNode[],
  content: string
): { facts: Fact[]; edges: Edge[] } {
  const facts: Fact[] = [];
  const edges: Edge[] = [];
  const lines = content.split('\n');

  for (const node of nodes) {
    const label = NODE_TYPE_TO_LABEL[node.type] ?? node.type;
    const qualifiedName = `${filePath}::${node.name}`;
    const contentHash = computeHash(content.substring(
      getNodeStartOffset(lines, node.startLine),
      getNodeEndOffset(lines, node.endLine)
    ));
    const loc = node.endLine - node.startLine + 1;

    facts.push({
      project,
      label,
      name: node.name,
      qualified_name: qualifiedName,
      file_path: filePath,
      start_line: node.startLine,
      end_line: node.endLine,
      properties: node.properties,
      content_hash: contentHash,
      loc,
    });

    // Build edges for imports
    if (label === 'import') {
      const importPath = extractImportPath(node);
      if (importPath) {
        edges.push({
          project,
          source_qualified_name: qualifiedName,
          target_qualified_name: importPath,
          type: 'imports',
        });
      }
    }

    // Build edges for class methods
    if (label === 'method' || label === 'method_declaration') {
      const parentClass = findParentClass(node, nodes);
      if (parentClass) {
        const parentQN = `${filePath}::${parentClass.name}`;
        edges.push({
          project,
          source_qualified_name: parentQN,
          target_qualified_name: qualifiedName,
          type: 'contains',
        });
      }
    }

    // Build edges for function calls
    if (node.type === 'call_expression' || node.type === 'call') {
      const calledFunc = extractCalledFunction(node);
      if (calledFunc) {
        edges.push({
          project,
          source_qualified_name: qualifiedName,
          target_qualified_name: calledFunc,
          type: 'calls',
        });
      }
    }

    // Build edges for class inheritance
    if (label === 'class' || label === 'interface') {
      const parentType = extractParentType(node);
      if (parentType) {
        edges.push({
          project,
          source_qualified_name: qualifiedName,
          target_qualified_name: parentType,
          type: node.type === 'interface_declaration' ? 'extends' : 'extends',
        });
      }
    }
  }

  return { facts, edges };
}

function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

function getNodeStartOffset(lines: string[], line: number): number {
  let offset = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for newline
  }
  return offset;
}

function getNodeEndOffset(lines: string[], line: number): number {
  let offset = 0;
  for (let i = 0; i < line && i < lines.length; i++) {
    offset += lines[i].length + 1;
  }
  return offset;
}

function extractImportPath(node: AstNode): string | null {
  const text = (node.properties.text as string) ?? '';
  // Try to extract import path from text
  const match = text.match(/from\s+['"]([^'"]+)['"]/);
  if (match) return match[1];

  const match2 = text.match(/import\s+['"]([^'"]+)['"]/);
  if (match2) return match2[1];

  const match3 = text.match(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/);
  if (match3) return match3[1];

  return null;
}

function extractCalledFunction(node: AstNode): string | null {
  const text = (node.properties.text as string) ?? '';
  // Extract function name from call expression
  const match = text.match(/^(\w+(?:\.\w+)*)\s*\(/);
  if (match) return match[1];
  return null;
}

function extractParentType(node: AstNode): string | null {
  const text = (node.properties.text as string) ?? '';
  // Extract parent class/interface from class declaration
  const match = text.match(/class\s+\w+\s+extends\s+(\w+)/);
  if (match) return match[1];

  const match2 = text.match(/class\s+\w+\s+implements\s+(\w+)/);
  if (match2) return match2[1];

  const match3 = text.match(/interface\s+\w+\s+extends\s+(\w+)/);
  if (match3) return match3[1];

  return null;
}

function findParentClass(node: AstNode, allNodes: AstNode[]): AstNode | null {
  for (const other of allNodes) {
    if (
      (other.type === 'class_declaration' || other.type === 'class_definition') &&
      other.startLine <= node.startLine &&
      other.endLine >= node.endLine &&
      other.name !== node.name
    ) {
      return other;
    }
  }
  return null;
}

export function buildQualifiedName(filePath: string, name: string): string {
  return `${filePath}::${name}`;
}
