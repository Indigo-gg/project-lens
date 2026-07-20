import { Parser, Language } from 'web-tree-sitter';
import path from 'path';

export interface AstNode {
  type: string;
  name: string;
  qualifiedName: string;
  filePath: string;
  startLine: number;
  endLine: number;
  properties: Record<string, unknown>;
  children: AstNode[];
}

let parserInstance: Parser | null = null;
const loadedLanguages: Map<string, Language> = new Map();

const SUPPORTED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx',
  '.py',
  '.go',
]);

export function isSupportedFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

function getLanguageForFile(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  switch (ext) {
    case '.ts':
    case '.tsx':
    case '.js':
    case '.jsx':
      return 'typescript';
    case '.py':
      return 'python';
    case '.go':
      return 'go';
    default:
      return 'unknown';
  }
}

export function isParserReady(): boolean {
  return parserInstance !== null;
}

export async function initParser(): Promise<void> {
  if (parserInstance) return;

  await Parser.init();
  parserInstance = new Parser();

  // Load language WASMs from each grammar package's own WASM files
  // (grammar packages ship pre-built WASM compatible with web-tree-sitter v0.26+)
  const wasmSources: Record<string, string> = {
    typescript: 'tree-sitter-typescript/tree-sitter-typescript.wasm',
    python: 'tree-sitter-python/tree-sitter-python.wasm',
    go: 'tree-sitter-go/tree-sitter-go.wasm',
  };

  for (const [name, wasmRel] of Object.entries(wasmSources)) {
    try {
      const wasmPath = path.join(
        path.dirname(require.resolve(wasmRel)),
        path.basename(wasmRel)
      );
      const lang = await Language.load(wasmPath);
      loadedLanguages.set(name, lang);
    } catch (err) {
      console.warn(`Failed to load ${name} language: ${err}`);
    }
  }
}

export async function parseFile(
  filePath: string,
  content: string
): Promise<{ nodes: AstNode[]; language: string; error?: string }> {
  if (!parserInstance) {
    return { nodes: [], language: 'unknown', error: 'Parser not initialized' };
  }

  const langName = getLanguageForFile(filePath);
  const lang = loadedLanguages.get(langName);

  if (!lang) {
    return { nodes: [], language: langName, error: `Language not supported: ${langName}` };
  }

  parserInstance.setLanguage(lang);

  try {
    const tree = parserInstance.parse(content);
    if (!tree) {
      return { nodes: [], language: langName, error: 'Parse returned null' };
    }
    const nodes = extractNodes(tree.rootNode, filePath, '', content);
    return { nodes, language: langName };
  } catch (err) {
    return {
      nodes: [],
      language: langName,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractNodes(
  node: any,
  filePath: string,
  parentQualifiedName: string,
  content: string
): AstNode[] {
  const nodes: AstNode[] = [];
  const nodeType = node.type;

  if (isExtractableType(nodeType)) {
    const name = getNodeId(node, content);
    const qualifiedName = parentQualifiedName
      ? `${parentQualifiedName}.${name}`
      : name;

    const astNode: AstNode = {
      type: mapNodeType(nodeType),
      name,
      qualifiedName: `${filePath}::${qualifiedName}`,
      filePath,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      properties: extractProperties(node, content),
      children: [],
    };

    nodes.push(astNode);

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        const childNodes = extractNodes(child, filePath, qualifiedName, content);
        astNode.children.push(...childNodes);
      }
    }
  } else {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        nodes.push(...extractNodes(child, filePath, parentQualifiedName, content));
      }
    }
  }

  return nodes;
}

function isExtractableType(type: string): boolean {
  const extractableTypes = new Set([
    'function_declaration',
    'arrow_function',
    'function',
    'class_declaration',
    'interface_declaration',
    'type_alias_declaration',
    'method_definition',
    'public_field_definition',
    'export_statement',
    'lexical_declaration',
    'variable_declaration',
    'function_definition',
    'class_definition',
    'decorated_definition',
    'method_declaration',
    'type_declaration',
    'struct_type',
    'interface_type',
    'import_statement',
    'import_from_statement',
    'import_declaration',
  ]);
  return extractableTypes.has(type);
}

function mapNodeType(type: string): string {
  const mapping: Record<string, string> = {
    function_declaration: 'function',
    arrow_function: 'function',
    function: 'function',
    class_declaration: 'class',
    interface_declaration: 'interface',
    type_alias_declaration: 'type',
    method_definition: 'method',
    public_field_definition: 'property',
    export_statement: 'export',
    lexical_declaration: 'variable',
    variable_declaration: 'variable',
    function_definition: 'function',
    class_definition: 'class',
    decorated_definition: 'decorated',
    method_declaration: 'method',
    type_declaration: 'type',
    struct_type: 'struct',
    interface_type: 'interface',
    import_statement: 'import',
    import_from_statement: 'import',
    import_declaration: 'import',
  };
  return mapping[type] || type;
}

function getNodeId(node: { type: string; childCount: number; child: (i: number) => any; parent: any; startIndex: number; endIndex: number }, content: string): string {
  // Search direct children for identifier
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && (child.type === 'identifier' || child.type === 'type_identifier')) {
      return content.slice(child.startIndex, child.endIndex);
    }
  }

  // Search nested children recursively (for import statements where identifier is nested under dotted_name)
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      for (let j = 0; j < child.childCount; j++) {
        const grandchild = child.child(j);
        if (grandchild && (grandchild.type === 'identifier' || grandchild.type === 'type_identifier')) {
          return content.slice(grandchild.startIndex, grandchild.endIndex);
        }
      }
    }
  }

  if (node.type === 'arrow_function' || node.type === 'function') {
    const parent = node.parent;
    if (parent) {
      for (let i = 0; i < parent.childCount; i++) {
        const child = parent.child(i);
        if (child && child.type === 'identifier') {
          return content.slice(child.startIndex, child.endIndex);
        }
      }
    }
  }

  return '<anonymous>';
}

function extractProperties(node: { type: string; endPosition: { row: number }; startIndex: number; endIndex: number; childCount: number; child: (i: number) => any }, content: string): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  props.lineCount = node.endPosition.row - (node as any).startPosition.row + 1;

  const text = content.slice(node.startIndex, node.endIndex);
  props.text = text.substring(0, 1000);

  if (node.type === 'function_declaration' || node.type === 'function_definition') {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && (child.type === 'formal_parameters' || child.type === 'parameters')) {
        props.parameters = content.slice(child.startIndex, child.endIndex);
        break;
      }
    }
  }

  return props;
}
