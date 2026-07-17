import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { handleAnalyzeProject } from './tools/analyze-project.js';
import { handleSearchEvidence } from './tools/search-evidence.js';
import { handleVerifyStatement } from './tools/verify-statement.js';
import { handleExportSnapshot } from './tools/export-snapshot.js';
import { handleRenderResume } from './tools/render-resume.js';

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'project-lens',
    version: '2.0.0',
  });

  // Tool 1: analyze_project
  server.registerTool('analyze_project', {
    description: 'Scan a project and build its knowledge index (facts, edges, evidence)',
    inputSchema: {
      project_path: z.string().optional().describe('Project root path (default: cwd)'),
      depth: z.number().optional().default(2).describe('Dependency analysis depth'),
      force_reindex: z.boolean().optional().default(false).describe('Force full re-index'),
    },
  }, async (args) => {
    const result = await handleAnalyzeProject(args);
    return result;
  });

  // Tool 2: search_evidence
  server.registerTool('search_evidence', {
    description: 'Universal search across facts and evidence. Supports keyword, category, requirement, and relation queries.',
    inputSchema: {
      query: z.string().optional().describe('Full-text search keyword'),
      category: z.string().optional().describe('Filter by category (performance, security, data, ...)'),
      evidence_type: z.string().optional().describe('Filter by evidence type (git_commit, test, benchmark, dependency)'),
      fact_type: z.string().optional().describe('Filter by fact type (function, class, interface, module)'),
      relation: z.string().optional().describe('Search by relation type (decision → Decision Trace)'),
      requirement: z.string().optional().describe('Search by JD requirement (auto-expands to search terms)'),
      sort_by: z.enum(['score', 'recent', 'author']).optional().default('score').describe('Sort results by'),
      limit: z.number().optional().default(20).describe('Max results to return'),
      cursor: z.string().optional().describe('Pagination cursor'),
    },
  }, async (args) => {
    const result = await handleSearchEvidence(args);
    return result;
  });

  // Tool 3: verify_statement
  server.registerTool('verify_statement', {
    description: 'Verify whether a statement has supporting code evidence',
    inputSchema: {
      statement: z.string().describe('Statement to verify (e.g., "优化了缓存性能")'),
      context_scope: z.array(z.string()).optional().describe('Limit search scope to specific paths'),
    },
  }, async (args) => {
    const result = await handleVerifyStatement(args);
    return result;
  });

  // Tool 4: export_snapshot
  server.registerTool('export_snapshot', {
    description: 'Export the project knowledge package (Project Snapshot) for an AI agent',
    inputSchema: {
      format: z.enum(['json', 'compact']).optional().default('compact').describe('Output format'),
      include_git_history: z.boolean().optional().default(true).describe('Include recent git decisions'),
      max_tokens: z.number().optional().default(50000).describe('Max token budget for output'),
    },
  }, async (args) => {
    const result = await handleExportSnapshot(args);
    return result;
  });

  // Tool 5: render_resume
  server.registerTool('render_resume', {
    description: 'Render a resume JSON to PDF using Typst',
    inputSchema: {
      resume_json: z.string().describe('Resume JSON string'),
      template: z.string().optional().default('modern').describe('Template name'),
    },
  }, async (args) => {
    const result = await handleRenderResume(args);
    return result;
  });

  return server;
}

export async function startMcpServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Project-Lens MCP Server running on stdio');
}
